# Migración Pigeon Metro: JavaScript → Godot 4

> Plan de migración del juego desde su implementación actual en **JS vanilla + HTML5 Canvas 2D** hacia **Godot Engine 4.x**.

## Resumen ejecutivo

El proyecto actual es funcional (~18.255 líneas JS, 88 archivos, Línea 3 del Metro de Madrid con 20 estaciones, 3 personajes, 6 logros, 11 pantallas, editor de niveles custom). La estética es pixel-art 100% procedural en Canvas 2D, con una perspectiva 3D simulada por una proyección `scale = FOCAL/(FOCAL+z)`.

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

**Tiempo estimado de migración**: 6–8 semanas de trabajo enfocado, repartidas en 7 fases (ver más abajo).

## Decisiones técnicas

| Decisión | Elegido | Razón |
|---|---|---|
| Versión motor | **Godot 4.3+** | LTS estable, mejoras de rendering, GDScript tipado maduro. |
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
└── assets/
    ├── sprites/                   ← Pixel art (PNG, filter Nearest)
    ├── audio/                     ← SFX/música (no existía en JS)
    └── shaders/                   ← .gdshader
```

## Plan de fases

### Fase 1 — Prototipo del túnel 3D (~1 semana)

**Objetivo**: validar que la perspectiva 3D nativa resuelve las limitaciones.

- [ ] Crear escena `TunelBase.tscn` con un tramo recto: suelo, paredes, techo arqueado (CSG o `MeshInstance3D`).
- [ ] `Camera3D` fija al fondo, mirando hacia el punto de fuga (la inversa del JS actual).
- [ ] Raíles como dos `MeshInstance3D` paralelos.
- [ ] Movimiento del túnel: bucle infinito mediante scroll de offset o segmento que se recicla.
- [ ] Iluminación básica: 1-2 `OmniLight3D` parpadeantes.

**Criterio de éxito**: ver el túnel "venir hacia ti" como en el JS pero sin proyección manual.

### Fase 2 — Paloma + colisiones (~1 semana)

- [ ] Importar pixel art de paloma como `AnimatedSprite3D` (frames de ala).
- [ ] Mover con `Input.is_action_pressed("ui_*")` (WASD + flechas ya configurados).
- [ ] `Area3D` en la paloma + `CollisionShape3D`.
- [ ] Obstáculo de prueba como `StaticBody3D` con `Area3D`; señal `area_entered` dispara "muerte".
- [ ] Invulnerabilidad con parpadeo via `Tween`.

### Fase 3 — Una estación completa (~2 semanas)

- [ ] Modelar `EstacionBase.tscn`: andén, 4 vías, pilares, tubos fluorescentes, rodapié de color de línea.
- [ ] Tren llegando con `AnimationPlayer` (freno + parada).
- [ ] Pantalla LED con próxima estación (`Label3D` o `Sprite3D` con `Viewport`).
- [ ] Transición túnel↔estación: `AnimationPlayer` + shader de máscara circular (sustituye el cross-fade JS).

### Fase 4 — Datos de Línea 3 (~3–5 días)

- [ ] Definir `Resource` tipados: `class_name LineaMetro`, `class_name Estacion`, `class_name TrenDatos`.
- [ ] Portar `js/escenarios/metro_madrid/datos_madrid.js` → `resources/metro_madrid/linea_3.tres`.
- [ ] Cargar en runtime, iterar estaciones según dirección elegida en pantalla arcade.

### Fase 5 — HUD + pantallas (~1 semana)

- [ ] Escenas `Control` para: inicio, arcade, historia, personaje, logros, ajustes, pausa, HUD, fin, fin_nivel.
- [ ] Manager de pantallas: `GameState.change_phase(new_phase)`.
- [ ] HUD con barra de progreso de estaciones (rotada -45°).

### Fase 6 — Personajes + logros + perfiles (~1 semana)

- [ ] 3 personajes con sprites pixel-art.
- [ ] Sistema de logros: 6 logros funcionales (mismo set que JS).
- [ ] Toast animado con `AnimationPlayer`.
- [ ] Perfiles: `ConfigFile` o `Resource` con datos namespaced.

### Fase 7 — Audio (~3–5 días)

- [ ] `AudioStreamPlayer3D` para sonidos posicionales en estaciones (tubos, tren).
- [ ] `AudioStreamPlayer` para música/SFX globales.
- [ ] Buses de audio: Master / SFX / Música.
- [ ] Mezcla en pantalla de ajustes.

### Fase 8 (opcional) — Sustituir/retirar JS

- [ ] Cuando Godot tenga paridad funcional con JS, mover `js/`, `index.html` y mockups a `legacy_js/`.
- [ ] Build de Godot exportada a web para mantener distribución actual.

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
2. **Paridad funcional larga**. Mientras Godot no llega a paridad, hay dos codebases vivos. Mitigación: fases pequeñas con criterios de éxito visuales claros.
3. **Curva GDScript**. Sintaxis similar a Python, fácil. El editor de escenas requiere familiaridad — invertir 1–2 días en tutoriales antes de Fase 1.
4. **Export web**. Si se quiere mantener distribución como página HTML, el export Web de Godot funciona pero pesa más que el JS actual. Evaluar al final.

## Cómo arrancar (next steps tras mergear este PR)

1. Instalar **Godot 4.3+** (https://godotengine.org/).
2. Abrir `godot/project.godot` desde Godot (Import Project).
3. Ejecutar (F5) → debería arrancar con la escena `main.tscn` vacía y log "Autoload listo" en consola.
4. Empezar por **Fase 1**: prototipo del túnel 3D.

## Referencias

- [Godot 4 docs](https://docs.godotengine.org/en/stable/)
- [`ANALISIS_TUNEL.md`](ANALISIS_TUNEL.md) — deuda técnica del túnel actual
- [`README.md`](README.md) — documentación del proyecto JS actual
- [`godot/README.md`](godot/README.md) — cómo abrir el proyecto Godot
