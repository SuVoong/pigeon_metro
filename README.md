# Metro Pigeon

Juego de pixel art en navegador con perspectiva tipo runner 3D. Controla una paloma (o un Pidgey, o el pájaro rojo) volando dentro del metro de Madrid: la ves **de espaldas**, mientras los trenes y obstáculos vienen desde el fondo del túnel hacia ti. Recorre líneas completas estación a estación, elige dirección, desbloquea logros y guarda tu progreso por perfil de jugador.

Hecho con **vanilla JavaScript** y **HTML5 Canvas** — sin librerías, sin imágenes. Todo el pixel art se dibuja con `fillRect`. Código organizado en módulos ES6.

---

## Cómo ejecutar

> ⚠️ Como usa **ES modules** (`import` / `export`), Chrome/Edge/Safari bloquean cargar `file://` directamente. Hace falta un servidor local sencillo.

```bash
cd pigeon_metro
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

| Acción                       | Teclas                        |
| ---------------------------- | ----------------------------- |
| Mover la paloma              | `Flechas` o `W A S D`         |
| Confirmar / avanzar          | `Enter` o `Espacio`           |
| Pausar / Reanudar            | `Escape` o `P`                |
| Reiniciar tras fin           | `R`                           |
| Volver al menú               | `Escape`                      |
| Cambiar perfil (en Logros)   | `P` — abre el gestor de perfiles |
| Nuevo perfil rápido          | `N` (con popup de perfiles abierto) |
| Elegir perfil 1-9            | Teclas numéricas (popup perfiles) |
| Cerrar popup                 | `Q` / `Escape`                |

### Flujo de pantallas

```
[ INICIO ]
    │
    ├─ ARCADE ──► selector de escenario ──► selector de dificultad
    │                                              │
    │                    ┌──────────────────────────┘
    │                    ▼
    │             selector de dirección
    │             (Andén 1 ↑ / Andén 2 ↓)
    │                    │
    │                    ▼
    │              [ PLAYING ]
    │             /           \
    │        (pausa)     (terminal)
    │            │             │
    │       [ PAUSED ]   [ LEVEL_COMPLETE ]
    │            │          /         \
    │       (reanudar)  (vuelta)   (terminar)
    │                      │             │
    │                 [ PLAYING ]  [ ARCADE ]
    │
    ├─ HISTORIA
    ├─ PERSONAJE
    ├─ LOGROS ──► gestor de perfiles (P)
    ├─ AJUSTES
    └─ SCENE_EDITOR
```

---

## Mecánica

### Gameplay general

- La paloma se ve **de espaldas** y siempre está cerca del centro de la pantalla.
- El movimiento usa **easing/lerp**: la paloma acelera y frena suavemente, se inclina visualmente al moverse horizontalmente.
- Los obstáculos vienen desde el fondo del túnel (Z=800) hacia la cámara (Z=0). Crecen al acercarse usando proyección perspectiva con `FOCAL = 400`.
- 3 vidas. Al chocar: 90 frames de invulnerabilidad con parpadeo y camera shake.
- La velocidad sube gradualmente: `speed = 2 + frame * 0.0008`.

### Modo Arcade — Línea 3 de Madrid

El escenario principal recorre la **Línea 3 (Villaverde Alto–Moncloa)** con sus 20 estaciones reales:

```
El Casar → Villaverde Alto → Usera → Legazpi → Delicias → Palos de la Frontera
→ Embajadores → Lavapiés → Tirso de Molina → Sol → Callao → Ventura Rodríguez
→ Argüelles → Moncloa
```
*(y el resto del tramo norte)*

**Antes de cada partida** el jugador elige:
- **Dirección**: Andén 1 (norte) o Andén 2 (sur).
- **Estación de inicio**: cualquier punto de la línea desde el mapa arcade.
- **Dificultad**: Tranquilo / Normal / Rápido / Caos — ajusta velocidad y frecuencia de obstáculos.

Si se elige una estación **terminal** (El Casar o Moncloa), la dirección se fuerza automáticamente y se comienza desde el extremo de la línea.

### Escenas en estación

Al llegar a cada estación el túnel da paso a una **vista trasera de andén**:
- 4 vías con efecto metálico de 3 capas (oscuro / medio / reflejo).
- 2 andenes con rodapié de color de línea y columnas de azulejo.
- Tubos fluorescentes con parpadeo aleatorio y limpieza por frames.
- Un **tren llegando** por la vía contraria, animado con aceleración suave.
- Pantalla LED encima de las puertas mostrando la siguiente estación.

### Fin de línea

Al llegar al terminal de la dirección elegida aparece un **popup de fin de nivel**:
- **↩ Dar la vuelta** — arranca nueva partida desde ese terminal en dirección contraria (conserva preset de dificultad).
- **✕ Terminar** — vuelve al mapa arcade.

### HUD de progreso

Una barra con el nombre de todas las estaciones de la ruta actual se muestra en la parte superior. Los nombres aparecen **rotados -45°** (igual que en los diagramas oficiales del metro de Madrid). La estación actual se resalta; las visitadas quedan en blanco y las pendientes en gris.

---

## Personajes

| Personaje | Desbloqueado desde | Descripción                     |
| --------- | ------------------ | ------------------------------- |
| 🐦 Paloma  | Siempre            | La veterana del metro madrileño |
| 🟤 Pidgey  | 5 min jugados      | Pokémon #016 · Experto en vuelo |
| 🔴 Red     | Siempre            | El Angry Bird más famoso        |

Cada personaje tiene sprite único dibujado con `fillRect`, animación de alas en 3 frames y física de tilt propia.

---

## Logros

Los logros están vinculados al **perfil activo** y se persisten en `localStorage`.

| ID            | Título                  | Condición                                      |
| ------------- | ----------------------- | ---------------------------------------------- |
| FLYING_HIGH   | Proeza Voladora         | Vuela más de 10 minutos acumulados             |
| FIRST_FLIGHT  | Primer Vuelo            | Completa tu primer trayecto en el metro        |
| MARATHON_RUN  | Maratón Urbano          | Sobrevive 5 min seguidos en una sola partida   |
| COMMUTER      | Habitual del Metro      | Completa 10 trayectos diferentes               |
| LINE_END      | De Terminal a Terminal  | Llega al final de una línea entera             |
| U_TURNER      | Cambio de Sentido       | Da la vuelta al llegar a un terminal           |

Al desbloquear un logro, aparece un **toast animado** en la esquina superior derecha con fade-in/fade-out (~4 segundos).

---

## Sistema de perfiles

Accede al gestor desde la pantalla de **Logros** pulsando `P`.

- Cada perfil (identificado por un nick) mantiene logros, contadores e historial de vuelos completamente separados.
- **Sin contraseñas** — es un selector de cuenta, no autenticación.
- El perfil por defecto es `Invitado`.
- Los nombres de perfil se persisten con sus claves **namespaced** en `localStorage`:
  ```
  vp_active_profile                       → nick activo
  vp_profile_<hex>_achievements           → logros
  vp_profile_<hex>_counters               → { linesCompleted, uTurnsCount, ... }
  vp_profile_<hex>_history                → historial de vuelos
  ```
- Los datos de versiones anteriores (claves globales legacy) se **migran automáticamente** al perfil activo la primera vez.
- Borrar un perfil elimina todas sus claves. Si era el activo, vuelve a `Invitado`. El perfil `Invitado` no se puede borrar (sólo reiniciar su progreso).

---

## Estructura del proyecto

```
pigeon_metro/
  index.html                    Entry point — carga sólo js/main.js como módulo
  README.md                     Este archivo
  js/
    mecanica/
      estado.js                 Canvas, ctx, PAL, STATE, pigeon, obstacles[], ...
      input.js                  keys, initInput(), consumeKey()
      camara.js                 initCamera(), w2sx(), w2sy(), perspective(z)
      colisiones.js             checkCollisions() — AABB con hitboxes de Linea3
      spawning.js               spawnObstacle(), spawnCollectible(), emitParticles()
      progreso.js               ACHIEVEMENTS[], logros, historial, evaluateAchievements(),
                                checkUnlocks(), saveFlightRecord(), reloadProfileData()
      perfil.js                 Gestión de perfiles: loadActiveProfile, setActiveProfile,
                                getProfileKey, listProfiles, deleteProfile
    personajes/
      paloma.js                 updatePigeon(dt), drawPigeon(ctx)
      pidgey.js                 updatePidgey(dt), drawPidgey(ctx)
      angry_bird.js             updateAngryBird(dt), drawAngryBird(ctx)
    elementos/
      tren.js                   drawTrenFrontal(ctx, cx, cy, scale, variante, ledText)
      tren_config.js            TREN_CONFIG — 12 variantes de línea con colores y datos
      obstaculos.js             Catálogo de obstáculos: tubería, barrera, andamio
      coleccionables.js         Catálogo de coleccionables: moneda, miga de pan, powerup
    escenarios/
      metro.js                  Túnel genérico (obstáculos clásicos, modo libre)
      metro_base/
        metro_base.js           MetroBase — orquestador TunelBase + EstacionBase;
                                _drawProgressHUD() con nombres a -45°
        tunel_base.js           TunelBase — scroll de túnel con spawn de obstáculos
        estacion_base.js        EstacionBase — vista trasera de andén: 4 vías, 2
                                andenes, fluorescentes, tren llegando, pantalla LED
      metro_base/
        metro_base_render.js   Renderizadores compartidos: drawTrainFront, drawTrainSide,
                                drawTrainPerspective, setLEDStation, _drawLED
      metro_madrid/
        datos_madrid.js         MADRID_LINES — datos completos de todas las líneas
        mapa_metro_madrid.js    MapaMetroMadrid — selector visual de líneas/estaciones
        linea_3/
          linea_3.js            Linea3Class — ruta bidireccional, init() con dirección,
                                isFinished, getLastIndex(), getOppositeDir()
          delicias/             Overrides específicos de la estación Delicias
            delicias.js
            delicias_estacion.js
            delicias_tunel.js
          ...                   Resto de paradas como stubs (un dir por estación)
    pantallas/
      inicio.js                 drawStartScreen(ctx) — paloma animada, menú principal
      arcade.js                 Mapa de arcade; selector de dificultad; selector de
                                dirección (popup directionPopup)
      historia.js               Historial de los últimos 10 vuelos
      personaje.js              Selector de personaje con preview animado
      logros.js                 Lista de logros + gestor de perfiles (_drawProfilePopup)
      ajustes.js                Ajustes de sonido / visuales
      pausa.js                  drawPauseScreen(ctx)
      hud.js                    drawHUD(ctx) — vidas, score, velocidad
      fin.js                    drawGameOverScreen(ctx) — score final
      fin_nivel.js              handleLevelCompleteInput / drawLevelCompleteScreen
                                "Dar la vuelta" y "Terminar"
      escena_editor.js          Editor de escenas integrado
    editor/
      auth.js                   Login modal para el IDE integrado
      editor_modal.js           Panel IDE completo
      config_store.js           Persistencia de configuraciones del editor
      preset_manager.js         Gestión de presets de dificultad
      ...                       Categorías, pestañas, widgets del editor
    main.js                     Bucle principal: init, loop, update, render,
                                drawAchievementToast()
```

---

## Arquitectura técnica

### Sistema de coordenadas

- **Mundo**: `pigeon.x`, `pigeon.y` en píxeles relativos al centro de la pantalla.
- **Profundidad**: `obj.z` es la distancia desde la cámara. Z grande = lejos. Cuando `z < -50` se elimina.
- **Pantalla**: `w2sx(wx) = canvas.width/2 + wx`, `w2sy(wy) = canvas.height/2 + wy`.

### Proyección perspectiva

```js
perspective(z) = FOCAL / (FOCAL + z)    // FOCAL = 400
```

A z=0 vale 1 (tamaño real); a z=800 vale ≈0.33; a z=∞ tiende a 0 (punto de fuga). Se aplica a posición y tamaño de cada objeto.

### Arquitectura de escenarios — MetroBase

`MetroBase` es el orquestador principal que alterna entre dos tipos de escena:

```
MetroBase
  ├─ TunelBase   — scroll continuo de túnel entre estaciones
  │    └─ spawnea obstáculos del catálogo elementos/obstaculos.js
  └─ EstacionBase — composición de andén en vista trasera
       ├─ 4 vías con efecto metálico de 3 capas
       ├─ 2 andenes con pilares y rodapié de línea
       ├─ Fluorescentes con flicker + cleanup
       ├─ Tren llegando (animación de freno)
       └─ Pantalla LED con nombre de estación
```

`Linea3` extiende `MetroBase` con la ruta real de la Línea 3, soportando:
- Dirección norte (`STATE.selectedDirection = 'north'`) o sur (`'south'`).
- Inicio desde cualquier estación (`STATE.selectedStartStationIndex`).
- Exposición de `isFinished`, `currentStation`, `getLastIndex()`, `getOppositeDir()` para la pantalla de fin de nivel.

### Sistema de perfiles y logros

```
loadActiveProfile()   ← al arrancar, antes de cualquier load*
     │
     ▼
loadFlightHistory()   ─── getProfileKey('history')
loadAchievements()    ─── getProfileKey('achievements') + getProfileKey('counters')
     │
     ▼ (durante la partida)
checkUnlocks()        ─── evaluateAchievements() ──► STATE.achievementToast
saveAchievements()    ─── persiste en localStorage namespaced por perfil
     │
     ▼ (al cambiar de perfil)
setActiveProfile(name)
reloadProfileData()   ─── reset STATE + recarga logros del nuevo perfil
```

### HUD de progreso en ruta

`_drawProgressHUD()` en `metro_base.js`:
1. Extrae los nombres de estaciones de la ruta actual.
2. Para cada nombre: `ctx.save()` → `ctx.translate(x, y)` → `ctx.rotate(-Math.PI/4)` → dibuja texto → `ctx.restore()`.
3. La estación actual se resalta en amarillo (`PAL.trainYellow`); las visitadas en blanco; las pendientes en gris oscuro.

### Estados del juego

`STATE.phase` es un string que gestiona `update(dt)` y `render()` en `main.js`:

| Fase            | Descripción                                        |
| --------------- | -------------------------------------------------- |
| `START`         | Menú principal con paloma animada                  |
| `ARCADE`        | Mapa de líneas + selector de dificultad/dirección  |
| `HISTORY`       | Historial de últimos 10 vuelos                     |
| `CHARACTER`     | Selector de personaje                              |
| `ACHIEVEMENTS`  | Lista de logros + gestor de perfiles               |
| `SETTINGS`      | Ajustes del juego                                  |
| `SCENE_EDITOR`  | Editor de escenas in-game                          |
| `PLAYING`       | Gameplay activo                                    |
| `PAUSED`        | Pausa (congela el frame, superpone popup)          |
| `LEVEL_COMPLETE`| Fin de línea (congela frame, muestra opciones)     |
| `GAMEOVER`      | Fin de partida (vidas = 0)                         |

### Toast de logros

`drawAchievementToast(ctx)` en `main.js` se ejecuta cada frame sobre cualquier pantalla:
- `STATE.achievementToast = { title, icon, framesLeft: 240 }` — disparado por `checkUnlocks()`.
- Curva de alpha: fade-in 12 frames, sostenido, fade-out 24 frames.
- Posición fija: esquina superior derecha, 320×56px.

---

## Cómo extender

### Nueva línea de metro

1. Añadir datos en `js/escenarios/metros/metros_madrid/datos_madrid.js` (MADRID_LINES).
2. Crear `js/escenarios/metro_madrid/linea_X.js` extendiendo `MetroBase`.
3. Registrar el escenario en `js/pantallas/arcade.js` y conectarlo en `main.js`.

### Nuevo logro

1. Añadir una entrada al array `ACHIEVEMENTS` en `js/mecanica/progreso.js` con `id`, `title`, `description`, `icon` y función `check(state)`.
2. El sistema lo evaluará automáticamente en cada `checkUnlocks()` y mostrará el toast si se desbloquea.

### Nuevo personaje

1. Crear `js/personajes/mi_pajaro.js` con `updateMiPajaro(dt)` y `drawMiPajaro(ctx)`.
2. Añadir la entrada al array `CHARACTERS` en `js/mecanica/estado.js` con `drawPreview()`, `unlockCondition` y datos descriptivos.
3. Registrar las funciones update/draw en `main.js` (igual que Pidgey y Red).

### Nuevo obstáculo

1. Añadir la entrada al catálogo en `js/elementos/obstaculos.js`.
2. Activarlo en `TunelBase` (spawn ponderado) en `js/escenarios/metro_base/tunel_base.js`.
3. Dibujar el sprite en el switch de `drawObstacles()` — `js/escenarios/metro.js` o `tunel_base.js`.

### Nuevo coleccionable

Igual que un obstáculo pero en `js/elementos/coleccionables.js`. Configurar puntos en `checkCollisions()` de `js/mecanica/colisiones.js`.

---

## Notas técnicas

- El canvas ocupa toda la ventana y se redimensiona dinámicamente.
- Todo el pixel art usa exclusivamente `fillRect` (cero imágenes externas).
- `dt` se normaliza a 60fps: `dt = (timestamp - lastTime) / 16.67`, con clamp a 3 para evitar saltos.
- El editor in-game (icono de llave) requiere login; usa OAuth/passwordless — no interfiere con los perfiles de jugador.
- Los datos legacy (`viajepalomero_history`, `viajepalomero_achievements`) se migran automáticamente al perfil activo la primera vez que arranca la nueva versión.
