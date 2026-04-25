# Metro Pigeon

Juego de pixel art en el navegador: controla una paloma volando por un túnel de metro infinito. Esquiva trenes, pilares, cables y viajeros mientras recoges migas de pan, monedas y pizza.

Hecho con **vanilla JavaScript** y **HTML5 Canvas** — sin librerías, sin imágenes, sin paso de build. Todo el pixel art se dibuja programáticamente con `fillRect`.

---

## Cómo ejecutar

Abre `index.html` directamente en cualquier navegador moderno.

```
# desde la carpeta metro-pigeon
start index.html       # Windows
open index.html        # macOS
xdg-open index.html    # Linux
```

No necesita servidor. Si tu navegador bloquea archivos locales, sirve la carpeta con cualquier servidor estático:

```
python -m http.server 8000
# luego abre http://localhost:8000
```

---

## Controles

| Acción              | Teclas                      |
| ------------------- | --------------------------- |
| Volar               | `Flechas` o `W A S D`       |
| Iniciar / Reintentar| `Space` o `Enter`           |
| Pausar en partida   | `Escape`                    |
| Continuar desde pausa | `Space` o `Enter`         |
| Volver al menú      | `Escape` (desde pausa o game over) |

### Flujo de pantallas

```
[ INICIO ] --Space--> [ JUGANDO ] --Escape--> [ PAUSA ]
                           ^                      |
                           |--Space--(continuar)--'
                           |
                      (vidas = 0)
                           |
                           v
                      [ GAME OVER ]
                           |
               Space = reintentar / Escape = menú
```

---

## Gameplay

- La paloma siempre está centrada en pantalla — el túnel scrollea a su alrededor.
- El mundo se desplaza más rápido cuanto más tiempo sobrevivas.
- **Recoger**: pan (+5 pts), moneda (+10 pts), pizza (+25 pts).
- **Evitar**: trenes (rápidos), pilares (altos), cables eléctricos (del techo), viajeros (en el andén).
- Empiezas con 3 vidas. Al recibir un golpe hay breve invulnerabilidad y rebote.

---

## Estructura del proyecto

```
metro-pigeon/
  index.html                  Punto de entrada, carga los scripts en orden
  README.md                   Este archivo
  js/
    mecanica/
      estado.js               Canvas, ctx, constantes VIEW_W/H, paleta PAL,
                              fuente FONT, STATE enum, todas las variables
                              mutables del juego, helpers px() y drawText(),
                              función startGame()
      input.js                Captura de teclado y dispatch a estados de juego
      camara.js               resize(), escalado pixel-perfect, w2sx() / w2sy()
      colisiones.js           Detección AABB: aabb(a, b)
      spawning.js             spawnObstacle(), spawnCollectible(), emitParticles()
    personajes/
      paloma.js               updatePigeon(dt) — física y movimiento
                              drawPigeon()     — sprite con 3 frames de aleteo
    escenarios/
      metro.js                drawBackground() y capas parallax (ladrillos,
                              nervios del túnel, letreros de neón, raíles, cables)
                              Dibujo de obstáculos: tren, pilar, cable, viajero
                              Dibujo de coleccionables: pan, moneda, pizza
                              drawParticles()
      renfe.js                Escenario Renfe — pendiente de implementar
    pantallas/
      inicio.js               drawStartScreen(), drawTitlePigeon()
      pausa.js                drawPauseScreen()
      fin.js                  drawGameOverScreen()
    main.js                   update(dt), render(), drawHUD(), bucle principal
```

**Orden de carga en index.html:** `estado` → `input` → `camara` → `colisiones` → `spawning` → `paloma` → `metro` → `renfe` → `inicio` → `pausa` → `fin` → `main`. Cada archivo usa variables globales definidas por los anteriores; no hay módulos ES para mantener compatibilidad con `file://`.

---

## Arquitectura técnica

### Resolución y escalado
Resolución lógica fija: **320 × 200 px**. El canvas se dibuja a ese tamaño y se escala con `ctx.setTransform` usando el mayor entero que cabe en la ventana. `ctx.imageSmoothingEnabled = false` garantiza píxeles nítidos.

### Cámara y scroll
La paloma vive en coordenadas de mundo. La cámara sigue siempre su posición (`camera.x = pigeon.x`). El scroll automático se implementa sumando `scrollSpeed * dt` a `pigeon.x` cada frame — como la cámara sigue a la paloma, el mundo entero parece moverse a la izquierda. Los helpers `w2sx(wx)` y `w2sy(wy)` convierten coordenadas mundo a pantalla.

### Parallax
Tres offsets independientes (`bgFar`, `bgMid`, `bgNear`) avanzan a velocidades 0.2×, 0.5× y 1.0× del scroll. Cada función de dibujo de fondo usa módulo para teselar infinitamente.

### Spawn y culling
Los obstáculos y coleccionables aparecen fuera del borde derecho de la cámara y se eliminan cuando salen por la izquierda. La dificultad sube aumentando `scrollSpeed` y reduciendo el intervalo de spawn con el tiempo.

### Colisiones
AABB puro sobre bounding boxes. Los coleccionables se recogen al tocar; los obstáculos quitan una vida y activan 1.5 s de invulnerabilidad (i-frames) con parpadeo.

### Fuente de píxeles
Mapa `FONT` de glifos 3×5 bits. `drawText(text, x, y, color, scale)` los renderiza con `fillRect` de 1×1 (o `scale`×`scale`) por píxel.

---

## Cómo extender

### Nuevo coleccionable
1. Añade un `type` en `spawnCollectible()` — `js/mecanica/spawning.js`.
2. Escribe `drawMiNuevoItem(x, y)` en `js/escenarios/metro.js`.
3. Añade el `else if` en `drawCollectible()` del mismo archivo.
4. Asigna `points` al objeto al spawnearlo.

### Nuevo obstáculo
Mismo patrón: añade el tipo en `spawnObstacle()`, dale dimensiones y posición Y, escribe su función `draw*` y añade el `else if` en `drawObstacle()`. La colisión AABB funciona automáticamente.

### Escenario Renfe
Implementar `js/escenarios/renfe.js`: nueva paleta de colores (exterior diurno), sprites de vagones Renfe, postes de catenaria y obstáculos propios. Añadir una condición en `render()` de `main.js` para seleccionar el escenario activo.

### Pantalla de pausa completa
`drawPauseScreen()` en `js/pantallas/pausa.js` ya existe y se llama. Añadir opciones (ajustes de volumen, estadísticas de partida, etc.) solo requiere editar ese archivo.

### Power-ups
Añadir un timer en `estado.js` (ej. `shieldTimer`). En la colisión de obstáculos, comprobar si está activo antes de quitar vida. Mostrar el indicador en `drawHUD()`.

### Sonido
`AudioContext` con osciladores — blips al recoger, golpe al chocar, música generativa de fondo. Mantiene la restricción de cero assets externos.

### Puntuación máxima
`localStorage.getItem/setItem('highScore', score)` en `startGame()` y `drawGameOverScreen()`.
