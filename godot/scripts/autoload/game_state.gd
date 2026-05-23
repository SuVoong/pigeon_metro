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

const STATS_PATH := "user://stats.cfg"

var current_phase: Phase = Phase.START

# Perfil activo — migrar lógica namespaced de js/mecanica/perfil.js.
var profile_id: String = ""

# Stats acumuladas — migrar desde js/mecanica/progreso.js.
var total_playtime_seconds: float = 0.0
var trips_completed: int = 0

# Mejor puntuación de cualquier run, persistida en user://stats.cfg.
var record_puntuacion: int = 0

# Selección del menú principal (STATE.menuCursor en JS).
var menu_cursor: int = 0


func _ready() -> void:
	_cargar_stats()
	print("[GameState] Autoload listo. Fase: %s · récord: %d"
			% [Phase.keys()[current_phase], record_puntuacion])


func change_phase(new_phase: Phase) -> void:
	if new_phase == current_phase:
		return
	var old: Phase = current_phase
	current_phase = new_phase
	print("[GameState] Fase: %s -> %s" % [Phase.keys()[old], Phase.keys()[new_phase]])
	phase_changed.emit(new_phase)


# Compara la puntuación con el récord. Si la mejora, la guarda en disco.
# Devuelve true si hubo récord nuevo.
func actualizar_record(puntuacion: int) -> bool:
	if puntuacion <= record_puntuacion:
		return false
	record_puntuacion = puntuacion
	_guardar_stats()
	return true


func _cargar_stats() -> void:
	var cfg := ConfigFile.new()
	var err: int = cfg.load(STATS_PATH)
	if err != OK:
		return  # primera ejecución: valores por defecto
	record_puntuacion = int(cfg.get_value("progreso", "record_puntuacion", 0))
	trips_completed = int(cfg.get_value("progreso", "trips_completed", 0))
	total_playtime_seconds = float(cfg.get_value("progreso", "total_playtime_seconds", 0.0))


func _guardar_stats() -> void:
	var cfg := ConfigFile.new()
	cfg.set_value("progreso", "record_puntuacion", record_puntuacion)
	cfg.set_value("progreso", "trips_completed", trips_completed)
	cfg.set_value("progreso", "total_playtime_seconds", total_playtime_seconds)
	cfg.save(STATS_PATH)
