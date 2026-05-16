extends Node

# Autoload singleton — equivalente a STATE global de js/mecanica/estado.js.
# Mantiene la fase actual del juego y datos de perfil/progreso entre escenas.

# Emitida al cambiar de fase. Los nodos suscritos deciden qué mostrar/ocultar.
signal phase_changed(new_phase: Phase)

# Las 11 fases del juego JS (ver js/pantallas/* y switch en js/main.js).
# SCENE_EDITOR queda como placeholder; en Godot el editor de niveles es el propio editor.
enum Phase {
	START,
	ARCADE,
	HISTORY,
	CHARACTER,
	ACHIEVEMENTS,
	SETTINGS,
	SCENE_EDITOR,
	PLAYING,
	PAUSED,
	LEVEL_COMPLETE,
	GAMEOVER,
}

var current_phase: Phase = Phase.START

# Perfil activo — migrar lógica namespaced de js/mecanica/perfil.js.
var profile_id: String = ""

# Stats acumuladas — migrar desde js/mecanica/progreso.js.
var total_playtime_seconds: float = 0.0
var trips_completed: int = 0

# Selección del menú principal (STATE.menuCursor en JS).
var menu_cursor: int = 0


func _ready() -> void:
	print("[GameState] Autoload listo. Fase: %s" % Phase.keys()[current_phase])


func change_phase(new_phase: Phase) -> void:
	if new_phase == current_phase:
		return
	var old: Phase = current_phase
	current_phase = new_phase
	print("[GameState] Fase: %s -> %s" % [Phase.keys()[old], Phase.keys()[new_phase]])
	phase_changed.emit(new_phase)
