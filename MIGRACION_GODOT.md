# Migración Pigeon Metro: JavaScript → Godot 4

> Plan exhaustivo de migración del juego desde su implementación actual en **JS vanilla + HTML5 Canvas 2D** hacia **Godot Engine 4.x**.

## Resumen ejecutivo

El proyecto actual es funcional (~18.255 líneas JS, 88 archivos, Línea 3 del Metro de Madrid con 20 estaciones, 3 personajes, 6 logros, 11 pantallas, editor de niveles custom). La estética es pixel-art 100% procedural en Canvas 2D, con perspectiva 3D simulada por `scale = FOCAL/(FOCAL+z)`.

Las **limitaciones de diseño** que motivan la migración son estructurales:

| Limitación JS | Síntoma |
|---|---|
| Perspectiva 2.5D simulada | Imposible rotar cámara, hacer pan o zoom dinámico. Z-order manual genera artefactos. |
| Geometría procedural en Canvas | Iterar el túnel obliga a re-validar 14 mockups HTML manualmente. |
| Constantes de raíles duplicadas en 3 módulos (`tunel.js`, `tunel_base.js`, `estacion_base.js`) | Cambias ratio en uno → se desincroniza con los otros. |
| Sin física real | Solo AABB sin rotación. Movimiento `vx/vy` manual. |
| Editor de niveles custom | ~40 archivos en `js/editor/` solo para tener UI de edición. |
| Audio ausente | Placeholder en `ajustes.js`, nunca implementado. |
| Sin hot reload, sin inspector visual | Ciclo lento de edición. |

Ver [`ANALISIS_TUNEL.md`](ANALISIS_TUNEL.md) para la deuda técnica documentada del túnel (catenaria, traviesas, bandejas, canales — todos pendientes).

**Tiempo estimado de migración completa**: 8–10 semanas distribuidas en **4 bloques (29 fases)**. Hay [atajos](#atajos-si-el-alcance-se-aprieta) para reducir a 6–7 semanas si solo se busca v1.0 funcional.

## Decisiones técnicas

| Decisión | Elegido | Razón |
|---|---|---|
| Versión motor | **Godot 4.3+** | Estable, mejoras de rendering, GDScript tipado maduro. |
| Lenguaje | **GDScript** | Iteración rápida, integración nativa con editor. C# si en futuro hace falta perf crítica. |
| Renderer | **Forward+** | Necesario para luces reales en estaciones (fluorescentes, LED del tren). Si se quiere export web ligero, considerar Compatibility más tarde. |
| 2D vs 3D | **3D (Node3D)** con cámara perspectiva | Resuelve la limitación principal del JS actual. |
| Pixel-art | **Sprites pre-renderizados** (PNG) con filter Nearest | Más rápido de iterar visualmente que regenerar con scripts. `texture_filter=0` ya configurado. |
| Estructura repo | **Subdirectorio `/godot`** | JS y Godot coexisten durante la migración. JS sigue funcional hasta paridad. |
| Físicas | **Godot Physics 3D** (Area3D para detección, RigidBody opcional) | Sustituye AABB manual. |
| Persistencia | **`ConfigFile` + Resources** en `user://` | Sustituye localStorage. |

## Estado actual del repo (resumen)

```
pigeon_metro/
├── index.html              → entry JS
├── js/                     → 88 archivos, ~18K LOC
│   ├── main.js             → game loop (60 FPS)
│   ├── mecanica/           → estado, input, camara, colisiones, spawning, progreso, perfil
│   ├── personajes/         → paloma, pidgey, angry_bird
│   ├── elementos/          → tren (12 variantes), obstáculos, coleccionables
│   ├── escenarios/
│   │   ├── metro_base/     → MetroBase + TunelBase + EstacionBase
│   │   └── metro_madrid/linea_3/  → 20 estaciones
│   ├── pantallas/          → 11 estados de UI
│   └── editor/             → IDE custom con OAuth, ~40 archivos
├── mockup_*.html           → 14 mockups de validación visual
└── ANALISIS_TUNEL.md       → deuda técnica del túnel
```

## Mapeo módulo a módulo

| Módulo JS actual | Equivalente Godot |
|---|---|
| `main.js` + `requestAnimationFrame` | `_process(delta)` en nodo raíz; el loop lo gestiona Godot. |
| `mecanica/estado.js` (`STATE` global) | Autoload singleton `GameState` (ya creado en `scripts/autoload/game_state.gd`). |
| `mecanica/input.js` | InputMap del editor + `Input.is_action_pressed()`. Ya hay bindings WASD+flechas en `project.godot`. |
| `mecanica/camara.js` (FOCAL=400) | **`Camera3D` nativa** con perspectiva real. Fin de la proyección simulada. |
| `mecanica/colisiones.js` (AABB) | `Area3D` + `CollisionShape3D` + señal `body_entered`. |
| `mecanica/spawning.js` | `Timer` nodes + `PackedScene.instantiate()`. |
| `mecanica/progreso.js` (logros) | Singleton + `Resource` tipado para stats; señales para unlocks. |
| `mecanica/perfil.js` (localStorage namespaced) | `ConfigFile` o `Resource` serializado en `user://profiles/<id>.tres`. |
| `escenarios/metro_base/metro_base.js` | Nodo orquestador con dos `PackedScene` (tunel + estacion). |
| `escenarios/metro_base/tunel.js` (dovelas, raíles, catenaria) | Escena `TunelBase.tscn` con `MeshInstance3D` o modelos importados. **Aquí desaparece la deuda del túnel** documentada en `ANALISIS_TUNEL.md`. |
| `escenarios/metro_base/estacion_base.js` | Escena `EstacionBase.tscn` 3D con andén, vías, tubos fluorescentes (luces reales). |
| `escenarios/metro_madrid/linea_3/` (20 estaciones) | 20 escenas `.tscn` heredadas de `EstacionBase.tscn`, o instancias con `Resource` de datos. |
| `personajes/paloma.js` (sprites procedurales) | `AnimatedSprite3D` con frames pixel-art (PNG), o `MeshInstance3D` con shader pixelado. |
| `elementos/tren.js` + `tren_config.js` (12 variantes) | Escena `Tren.tscn` con `@export var color_linea: Color` y `@export var datos: TrenDatos` (Resource). |
| `elementos/obstaculos.js`, `coleccionables.js` | Una `PackedScene` por tipo en `scenes/elementos/`. |
| `pantallas/*` (11 pantallas) | Escenas `Control` en `scenes/pantallas/`; transición con `change_scene_to_file()` o `CanvasLayer`. |
| `pantallas/hud.js` (barra rotada -45°) | `CanvasLayer` con `Control` + `rotation`. |
| `editor/` completo (40+ archivos) | **Eliminado**. El editor de Godot lo sustituye. Si hace falta un editor visual de líneas para diseñador, hacer un plugin de Godot (mucho más simple). |

## Estructura del proyecto Godot

```
godot/
├── project.godot                  ← Config + autoload + InputMap
├── icon.svg                       ← Placeholder
├── README.md                      ← Cómo abrir
├── scenes/
│   ├── main.tscn                  ← Entrada (vacía)
│   ├── personajes/                ← paloma.tscn, pidgey.tscn, angry_bird.tscn
│   ├── escenarios/
│   │   ├── tunel/                 ← TunelBase.tscn
│   │   ├── estacion/              ← EstacionBase.tscn
│   │   └── metro_madrid/linea_3/  ← 20 estaciones
│   ├── elementos/                 ← tren, obstáculos, coleccionables
│   └── pantallas/                 ← inicio, arcade, HUD, fin, etc.
├── scripts/
│   ├── autoload/
│   │   └── game_state.gd          ← Singleton GameState
│   ├── mecanica/                  ← input, spawning, progreso, perfil
│   ├── personajes/
│   ├── escenarios/
│   ├── elementos/
│   └── pantallas/
├── resources/
│   └── metro_madrid/              ← Líneas, estaciones, trenes como .tres
└── assets/                        ← Importables
    ├── sprites/                   ← Pixel art (PNG, filter Nearest)
    ├── audio/                     ← SFX/música (no existía en JS)
    └── shaders/                   ← .gdshader
```

## Plan de fases (4 bloques · 29 fases)

```
Total estimado: 8–10 semanas de trabajo enfocado
═════════════════════════════════════════════════
Bloque A — Fundamentos      1.0–1.5 sem  ( 5 fases)
Bloque B — Construcción     4.0–5.0 sem  (12 fases)
Bloque C — Polish/Producción 2.0–3.0 sem ( 8 fases)
Bloque D — Cierre           1.0 sem      ( 4 fases)
═════════════════════════════════════════════════
Total                       8.0–10.5 sem (29 fases)
```

### Bloque A — Fundamentos (1–1.5 semanas)

| # | Fase | Objetivo | Criterio de éxito |
|---|---|---|---|
| **A1** | **Setup y formación** | Godot 4.3+ instalado. Repaso de 2-3 tutoriales clave (escenas, señales, scripting tipado, Camera3D). | Puedes crear una escena nueva, mover un nodo con input, conectar una señal sin mirar docs. |
| **A2** | **Decisiones de arquitectura** | Fijar por escrito: Forward+ vs Compatibility, GDScript vs C#, 3D vs 2D-con-shader, pixel-art procedural vs PNG. | Documento ADR (Architecture Decision Record) en el repo con las decisiones y su razón. |
| **A3** | **Convenciones del proyecto** | Naming (snake_case archivos, PascalCase nodos, SCREAMING_SNAKE constantes), estructura de carpetas, formato de commits, tipado obligatorio. | `CONVENCIONES.md` + `.editorconfig`. |
| **A4** | **Pipeline de assets** | Cómo se importan sprites pixel (Import → filter Nearest, mipmaps off), fuentes pixel, atlas, formatos audio (Ogg para música, WAV para SFX). | Un sprite de prueba importado, visible sin blur en pantalla. |
| **A5** | **Sistemas base (autoloads)** | `GameState` (fase), `SceneManager` (cambio de pantalla con transición), `EventBus` (señales globales), `SaveSystem` (sustituye localStorage), `AudioBuses`. | Los 5 autoloads existen y arrancan sin errores. Test simple: cambiar fase desde una escena vacía. |

### Bloque B — Construcción del juego (4–5 semanas)

| # | Fase | Objetivo | Criterio de éxito |
|---|---|---|---|
| **B1** | **Prototipo del túnel 3D** | Tramo recto, `Camera3D`, raíles, iluminación básica, scroll infinito. | El túnel "viene hacia ti" con perspectiva real. **Punto de no retorno**: si esto te resuelve las limitaciones, sigue; si no, replantea. |
| **B2** | **Movimiento y colisiones** | Paloma como `AnimatedSprite3D` o `MeshInstance3D`. Input WASD/flechas. `Area3D` + señal `area_entered` para obstáculo de prueba. | Mueves la paloma, chocas con cilindro de prueba, dispara "muerte". |
| **B3** | **Estación completa** | `EstacionBase.tscn` con andén, 4 vías, pilares, tubos fluorescentes (`OmniLight3D` con flicker), rodapié. Tren llegando con `AnimationPlayer`. | Una estación reutilizable que se ve como las fotos de referencia (`mockup_comparativa_foto.html`). |
| **B4** | **Sistema de líneas y datos** | `Resource` tipados: `LineaMetro`, `Estacion`, `TrenDatos`. Portar `datos_madrid.js` y `tren_config.js`. | Cargar Línea 3 en runtime e iterar las 20 estaciones según dirección. |
| **B5** | **Trenes y obstáculos** | Escena `Tren.tscn` con `@export` para color/variante. Escenas para tubería, barrera, andamio. Coleccionables (moneda, miga, powerup). | 12 variantes de tren renderizables. Obstáculos con hitbox correcto. |
| **B6** | **Transición túnel↔estación** | `AnimationPlayer` + shader de máscara circular (sustituye el cross-fade JS). | Transición suave indistinguible del JS actual. |
| **B7** | **Pantallas y UI** | Escenas Control para las 11 pantallas: inicio, arcade, historia, personaje, logros, ajustes, pausa, HUD, fin, fin_nivel. `SceneManager.change_phase()`. | Navegas las 11 pantallas con el mismo flujo que JS. |
| **B8** | **HUD con barra rotada** | Barra de progreso de estaciones rotada -45°, indicadores de vida, contador. | HUD funcional durante PLAYING. |
| **B9** | **Personajes** | 3 personajes (paloma, pidgey, angry_bird) con sprites pixel pre-renderizados, animación de alas. Selección desde pantalla CHARACTER. | Cambiar de personaje afecta sprite + hitbox. |
| **B10** | **Logros, perfiles, progreso** | 6 logros funcionales con toast animado. Perfiles namespaced en `user://`. Stats acumuladas. | Desbloqueo de logro dispara toast. Cambias perfil, se mantienen stats independientes. |
| **B11** | **Spawning y dificultad** | `Timer` + `PackedScene` para spawn de obstáculos/coleccionables. 3 dificultades configurables. | Spawn balanceado por dificultad como en JS. |
| **B12** | **Audio** | Buses Master/SFX/Música. `AudioStreamPlayer3D` para sonidos posicionales (tubos, tren, pasos). Música por estado. | Funcionalidad **nueva vs JS**: ahora hay sonido. Mezcla en pantalla AJUSTES. |

### Bloque C — Pulido y producción (2–3 semanas)

| # | Fase | Objetivo | Criterio de éxito |
|---|---|---|---|
| **C1** | **VFX y shaders** | Polvo en vías, chispas, niebla volumétrica al fondo del túnel, post-processing (bloom suave, dithering pixel). | Look "cinematográfico" sin perder estética pixel. |
| **C2** | **Performance pass** | Profiler de Godot. Objetivo: 60 FPS estables en hardware target (definir cuál: ¿web? ¿desktop?). Reducir draw calls, batch sprites, LOD si hace falta. | FPS estable medido en escena más cargada (estación con tren entrando + partículas). |
| **C3** | **Testing y paridad funcional** | Checklist exhaustivo vs JS: ¿se comporta igual en cada estación? ¿logros disparan igual? ¿spawn es similar? | 100% del checklist verde. |
| **C4** | **Playtest A/B** | Sesiones reales con jugador comparando JS vs Godot. Detectar regresiones de "feel" (game feel suele empeorar al portar). | Notas de playtest sin bloqueantes. |
| **C5** | **Accesibilidad** | Remapeo de inputs, escala de UI, paleta colorblind, opciones de motion sickness (relevante con cámara 3D). | Menú de accesibilidad en AJUSTES. |
| **C6** | **Internacionalización** | Sistema de traducciones de Godot (`tr()` + CSV). Mínimo español/inglés. | Cambiar idioma en runtime sin reiniciar. |
| **C7** | **Export multiplataforma** | Build Web (HTML5), Windows, opcionalmente Linux/Mac. | Builds funcionando + tamaño aceptable (Web Godot ~25-50 MB). |
| **C8** | **CI/CD** | GitHub Actions: build automático en push a `main`, publicar Web build a GitHub Pages o similar. | PR genera build descargable. |

### Bloque D — Cierre (1 semana)

| # | Fase | Objetivo | Criterio de éxito |
|---|---|---|---|
| **D1** | **Documentación final** | `README.md` reescrito para Godot. Diagrama de arquitectura. Guía de contribución. | Un dev nuevo puede correr y contribuir en <30 min. |
| **D2** | **Sustitución de JS** | Mover `js/`, `index.html` y mockups a `legacy_js/`. Actualizar README raíz. | El proyecto JS sigue accesible como histórico pero no es el principal. |
| **D3** | **Release v1.0** | Tag git, release en GitHub, build publicada. | Versión jugable y distribuible. |
| **D4** | **Post-launch / mantenimiento** | Backlog para nuevas líneas (4, 6, 10…), eventos seasonal, etc. | Roadmap futuro definido. |

## Atajos si el alcance se aprieta

Si necesitas reducir tiempo, **prioriza paridad funcional sobre polish**:

| Fase | Decisión |
|---|---|
| C1 (VFX), C5 (accesibilidad), C6 (i18n), C8 (CI/CD) | **Posponer** a post-v1.0 |
| C7 (export) | Solo Web inicialmente |
| B12 (audio) | Mínimo viable: 5-10 SFX + música de fondo |
| B11 (3 dificultades) | Solo una al principio |

Con atajos: **6–7 semanas para v1.0 funcional**.

## Paralelismos

Se puede trabajar en paralelo (varias sesiones o personas):
- **B4** (datos) ⟷ **B5** (trenes/obstáculos) — independientes
- **B7** (pantallas) ⟷ **B8** (HUD) ⟷ **B9** (personajes) — independientes una vez B5 termine
- **C5** / **C6** / **C7** / **C8** — todos independientes entre sí

## Qué se mantiene / descarta / reescribe

**Mantener como datos (1:1 portable)**:
- `metro_madrid/datos_madrid.js` (líneas, estaciones, orden) → `.tres`
- `tren_config.js` (12 variantes) → Resources tipadas
- Lógica algorítmica pura de logros/progreso/perfiles
- Paleta `PAL` → constantes GDScript

**Descartar**:
- Todo `js/editor/` (40+ archivos): el editor de Godot lo cubre.
- 14 mockups HTML: la validación visual se hace en el propio editor.
- `mecanica/camara.js`: `Camera3D` nativa.
- Geometría procedural de túnel y estación: se modela una vez en el editor.
- Sistema de transición cross-fade circular custom: `AnimationPlayer` + shader.

**Reescribir (mismo concepto, otra implementación)**:
- Render personajes: `fillRect` procedural → `AnimatedSprite3D`.
- Túnel/estación: cálculos por frame → escenas 3D editables.
- HUD: Canvas → `CanvasLayer` + `Control`.
- Spawning: lógica `setInterval` → `Timer` nodes + `PackedScene`.

## Riesgos

1. **Estética procedural pixel-art**. Hoy todo se dibuja con `fillRect`. En Godot recomiendo PNG pre-renderizados (más rápido de iterar). Si se insiste en mantener procedural runtime, se pierde la mitad de las ventajas del cambio.
2. **Paridad funcional larga**. Mientras Godot no llega a paridad, hay dos codebases vivos. Mitigación: fases pequeñas con criterios de éxito visuales claros y checklist de paridad (Fase C3).
3. **Curva GDScript**. Sintaxis similar a Python, fácil. El editor de escenas requiere familiaridad — invertir Fase A1 antes de B1.
4. **Game feel**. Al portar a 3D con física real, el "feel" suele cambiar. Mitigación: Fase C4 (playtest A/B) detecta regresiones.
5. **Tamaño del export Web**. Godot Web pesa ~25-50 MB vs ~200 KB del JS actual. Si la distribución por GitHub Pages es crítica, evaluar Compatibility renderer en Fase A2.
6. **Sobre-ingeniería**. La tentación de "hacerlo bien desde el principio" puede llevar a sobre-diseñar autoloads/managers. Mitigación: A5 es minimal — añadir cosas solo cuando una fase de Bloque B lo demande.

## Cómo arrancar (next steps tras mergear este PR)

1. Instalar **Godot 4.3+** (https://godotengine.org/).
2. Abrir `godot/project.godot` desde Godot (Import Project).
3. Ejecutar (F5) → debería arrancar con la escena `main.tscn` vacía y log "Autoload listo" en consola.
4. Empezar por **Bloque A** (Fundamentos) → luego **B1**: prototipo del túnel 3D.

## Referencias

- [Godot 4 docs](https://docs.godotengine.org/en/stable/)
- [`ANALISIS_TUNEL.md`](ANALISIS_TUNEL.md) — deuda técnica del túnel actual
- [`README.md`](README.md) — documentación del proyecto JS actual
- [`godot/README.md`](godot/README.md) — cómo abrir el proyecto Godot
