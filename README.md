# Metro Pigeon

Juego de pixel art en navegador con perspectiva tipo runner 3D. Controla una paloma volando dentro de un túnel de metro: la ves **de espaldas**, mientras los trenes y tuberías se acercan desde el fondo. Esquívalos moviéndote a izquierda, derecha, arriba o abajo.

Hecho con **vanilla JavaScript** y **HTML5 Canvas** — sin librerías, sin imágenes. Todo el pixel art se dibuja con `fillRect`. Código organizado en módulos ES6.

---

## Cómo ejecutar

> ⚠️ Como usa **ES modules** (`import` / `export`), Chrome/Edge/Safari bloquean cargar `file://` directamente. Hace falta un servidor local sencillo.

```bash
cd metro-pigeon
python -m http.server 8000
# luego abre http://localhost:8000
```

Otras opciones:
```bash
npx serve            # si tienes Node
php -S localhost:8000
```

(Firefox sí permite `file://` en módulos si bajas la restricción `privacy.file_unique_origin`.)

---

## Controles

| Acción              | Teclas                       |
| ------------------- | ---------------------------- |
| Volar               | `Flechas` o `W A S D`        |
| Iniciar             | Cualquier tecla              |
| Pausar              | `Escape` o `P`               |
| Reanudar            | `Escape` o `P`               |
| Reiniciar tras fin  | `R`                          |

### Flujo de pantallas

```
[ START ] --cualquier tecla--> [ PLAYING ] --ESC/P--> [ PAUSED ]
                                    ^                     |
                                    |---ESC/P (reanudar)--'
                                    |
                              (vidas = 0)
                                    |
                                    v
                              [ GAMEOVER ] --R--> reinicio
```

---

## Mecánica

- La paloma se ve **de espaldas** y siempre está cerca del centro de la pantalla.
- El movimiento se aplica con **easing/lerp**: la paloma acelera y frena suavemente, no cambia de dirección instantáneamente. Se inclina visualmente al moverse en horizontal.
- Los obstáculos vienen desde el fondo del túnel (Z=800) hacia la cámara (Z=0). Crecen al acercarse usando una proyección perspectiva con `FOCAL = 400`.
- Tres tipos de obstáculos:
  - 🚆 **Tren izquierdo** — viene por el lado izquierdo del túnel; muévete a la derecha.
  - 🚆 **Tren derecho** — viene por el lado derecho; muévete a la izquierda.
  - 🟫 **Tubería horizontal** — atraviesa el túnel a una altura aleatoria; muévete arriba o abajo.
- Nunca se generan trenes opuestos al mismo tiempo (siempre tienes una salida).
- Coleccionables que aumentan score:
  - 🥖 **Migas de pan**: +10 puntos
  - 🪙 **Moneda**: +50 puntos
- 3 vidas. Al chocar: 90 frames de invulnerabilidad con parpadeo.
- La velocidad sube gradualmente con el tiempo: `speed = 2 + frame * 0.0008`.

---

## Estructura del proyecto

```
metro-pigeon/
  index.html                  Entry point — carga sólo js/main.js como módulo
  README.md                   Este archivo
  js/
    mecanica/
      estado.js               Exporta canvas, ctx, PAL, FONT, STATE, pigeon,
                              obstacles[], collectibles[], particles[]
      input.js                keys, initInput(), consumeKey()
      camara.js               initCamera(), w2sx(), w2sy(), perspective(z)
      colisiones.js           aabb(a, b)
      spawning.js             spawnObstacle(), spawnCollectible(), emitParticles()
    personajes/
      paloma.js               updatePigeon(dt) — física con lerp + clamping
                              drawPigeon(ctx) — sprite 24×24 vista trasera,
                                                 3 frames de aleteo, tilt al moverse
    escenarios/
      metro.js                drawTunnel(ctx) — perspectiva con anillos concéntricos,
                                                 paredes brick, tubos fluorescentes
                              updateObstacles/drawObstacles    — Z-scroll
                              updateCollectibles/drawCollectibles
                              updateParticles/drawParticles
      renfe.js                Placeholder (pendiente)
    pantallas/
      inicio.js               drawStartScreen(ctx) con paloma animada y "PRESS ANY KEY"
      pausa.js                drawPauseScreen(ctx)
      fin.js                  drawGameOverScreen(ctx) con score final
    main.js                   init(), loop(), update(), checkCollisions(), render(),
                              drawHUD()
```

`index.html` carga solo `main.js` como `<script type="module">`. Todas las demás dependencias se resuelven con `import` / `export`.

---

## Arquitectura técnica

### Sistema de coordenadas

- **Mundo**: `pigeon.x`, `pigeon.y` y `obj.x`, `obj.y` están en píxeles relativos al centro de la pantalla.
- **Profundidad**: `obj.z` es la distancia desde la cámara. Z grande = lejos. Z pequeño = cerca. Cuando `z < -50` el obstáculo se elimina.
- **Pantalla**: `w2sx(wx) = canvas.width/2 + wx`, `w2sy(wy) = canvas.height/2 + wy`.

### Proyección perspectiva

```js
perspective(z) = FOCAL / (FOCAL + z)    // FOCAL = 400
```

Devuelve un factor de escala. A z=0 vale 1 (tamaño real); a z=800 vale ≈0.33 (un tercio); a z=∞ tiende a 0 (punto de fuga). Se aplica tanto a posición como a tamaño:

```js
const scale = perspective(obj.z);
const sx = w2sx(obj.x * scale);   // posición se acerca al centro al alejarse
const sw = obj.w * scale;          // tamaño se reduce al alejarse
```

### Túnel

`drawTunnel(ctx)` dibuja **anillos concéntricos** a profundidades cada 100 unidades. El offset se calcula con `STATE.worldZ % 100` para que parezca que avanzas. Se añaden 4 líneas de fuga desde las esquinas al centro y tubos fluorescentes con parpadeo aleatorio cada ~120 frames.

### Paloma

- Sprite **24×24** dibujado con `fillRect`. Cada píxel se renderiza como bloque 4×4 usando `ctx.scale(4, 4)`.
- Vista trasera: cuerpo 6×8 centrado, alas 10×3 a cada lado (3 frames: nivel/arriba/abajo), cola 4×3 abajo, dos ojos asomando arriba.
- Movimiento con lerp (`vx += (target - vx) * 0.15`).
- `pigeon.tilt` se calcula desde `vx` y se aplica con `ctx.rotate(tilt * 0.25)`.
- Posición clampeada al 28% del canvas en cada eje.

### Colisiones

Hitbox de la paloma fijo en pantalla: `12×12` centrado en su posición. Hitboxes de obstáculos calculados en cada frame con `perspective(z)`. Sólo se comprueban colisiones cuando `|z| < 50` (el plano de la cámara). AABB simple.

### Bucle principal

`dt` se normaliza a 60fps: `dt = (timestamp - lastTime) / 16.67`. Se clampea a 3 para evitar saltos en frames perdidos. Todo lo que se mueve usa `dt` para ser frame-rate independiente.

### Game states

`STATE.phase` es un string: `'START'`, `'PLAYING'`, `'PAUSED'`, `'GAMEOVER'`. Cada uno se gestiona en `update(dt)` y se renderiza en `render()`.

---

## Cómo extender

### Nuevo obstáculo
1. Añadir el `type` en `spawnObstacle()` — [`js/mecanica/spawning.js`](js/mecanica/spawning.js).
2. Decidir su `x`, `y`, `w`, `h` en coordenadas de mundo.
3. Añadir un caso en el switch de `drawObstacles()` — [`js/escenarios/metro.js`](js/escenarios/metro.js).
4. La colisión AABB funciona automáticamente.

### Nuevo coleccionable
Igual que un obstáculo pero en `spawnCollectible()` y `drawCollectibles()`. Configurar puntos en `checkCollisions()` de `main.js`.

### Escenario Renfe
Implementar `js/escenarios/renfe.js` con la misma API (`drawTunnel`, `updateObstacles`, `drawObstacles`...). Añadir variable `STATE.escenario` y elegir el módulo activo en `main.js`.

### Power-ups
Añadir flags como `STATE.shield = 0` en `estado.js`, recoger un coleccionable especial que active el flag, y modificar `checkCollisions` para ignorar el daño cuando esté activo.

### Sonido
`AudioContext` con osciladores: blip al recoger, ruido al chocar. Sin assets externos.

### High score
`localStorage.setItem('highscore', score)` en `resetGame()`, mostrarlo en `drawStartScreen` y `drawGameOverScreen`.

---

## Notas

- El canvas ocupa toda la ventana y se redimensiona dinámicamente. No hay resolución lógica fija.
- El sprite de la paloma se escala con `ctx.scale(4, 4)` para que sea visible. Si ves la paloma muy pequeña, sube `SPRITE_SCALE` en [`js/personajes/paloma.js`](js/personajes/paloma.js).
- Para tunear dificultad: `STATE.speed` rampup en `main.js`, intervalos de spawn en `metro.js`.
