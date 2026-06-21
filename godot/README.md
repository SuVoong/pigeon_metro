# Pigeon Metro — Proyecto Godot

Esqueleto del proyecto Godot 4 para la migración desde `js/` (Canvas 2D vanilla).

Ver [`../MIGRACION_GODOT.md`](../MIGRACION_GODOT.md) para el plan completo, mapeo módulo a módulo y fases.

## Cómo abrir

1. Instalar **Godot 4.3** (o posterior 4.x) — https://godotengine.org/
2. En Godot: *Import Project* → seleccionar `godot/project.godot` de este repo
3. Abrir y ejecutar (F5). La escena `scenes/main.tscn` está vacía (Node3D raíz).

## Estructura

```
godot/
├── project.godot              Config del proyecto + autoload + InputMap (WASD/flechas)
├── icon.svg                   Placeholder — sustituir por icono final
├── scenes/                    Escenas .tscn
│   ├── main.tscn              Entrada (vacía, lista para construir)
│   ├── personajes/            paloma, pidgey, angry_bird
│   ├── escenarios/
│   │   ├── tunel/             TunelBase.tscn reutilizable
│   │   ├── estacion/          EstacionBase.tscn reutilizable
│   │   └── metro_madrid/linea_3/  Una escena por estación
│   ├── elementos/             tren, obstáculos, coleccionables
│   └── pantallas/             inicio, arcade, HUD, fin, etc.
├── scripts/                   .gd scripts
│   ├── autoload/
│   │   └── game_state.gd      Singleton GameState (registrado en project.godot)
│   ├── mecanica/              estado, input, spawning, progreso, perfil
│   ├── personajes/
│   ├── escenarios/
│   ├── elementos/
│   └── pantallas/
├── resources/                 .tres tipados (datos)
│   └── metro_madrid/          Líneas, estaciones, trenes
└── assets/                    Importables
    ├── sprites/               Pixel art (PNG con filter nearest)
    ├── audio/                 SFX/música (no existe en JS)
    └── shaders/               .gdshader
```

## Convenciones

- **Pixel art**: `default_texture_filter=0` (Nearest) ya configurado en `project.godot`.
- **InputMap**: `ui_up/down/left/right` con WASD + flechas (igual que JS actual).
- **Naming**: snake_case para archivos `.gd` y `.tscn`, PascalCase para nombres de nodos en escenas.
- **GDScript tipado**: usar siempre `:= Type` y firmas con `-> ReturnType`. Sin GDScript dinámico.
