extends Node3D

# Fases B2 + B5 + B6 — Orquestador del mundo jugable.
# B2: muerte y respawn de la paloma.
# B5 (prototipo): trenes circulando sobre las dos vías como obstáculos.
# B6: ciclo túnel ↔ estación — instancia la estación periódicamente, la hace
#     avanzar hacia la cámara y la libera al pasarla. Mientras la estación
#     está en pantalla, oculta el tramo de túnel correspondiente.

# ── Trenes (B5 prototipo) ────────────────────────────────────────────────
const TREN_SCENE: PackedScene = preload("res://scenes/elementos/tren.tscn")
const VEL_SCROLL: float = 12.0          # igual que el túnel
const NUM_TRENES: int = 3
const TRACK_OFFSET: float = 1.55        # |X| del centro de cada vía (= túnel)
const TREN_Z_RECICLAJE: float = 15.0    # tras pasar este Z se recicla al fondo
const TREN_Z_LEJOS_MIN: float = -130.0
const TREN_Z_LEJOS_MAX: float = -95.0
const TREN_SEPARACION: float = 50.0     # separación al colocar trenes nuevos
# Velocidad propia del tren respecto al mundo: sumada a VEL_SCROLL produce
# trenes que SE MUEVEN sobre las vías. TREN_VEL_BASE 6 m/s da ~18 m/s
# relativos a la cámara; con la dificultad progresiva crece hasta +6 m/s
# extra (24 m/s ≈ 86 km/h) a medida que sube la puntuación.
const TREN_VEL_BASE: float = 6.0
const TREN_VEL_INC_POR_PUNTO: float = 0.4
const TREN_VEL_INC_MAX: float = 6.0

# Vidas del run completo (no las "vidas" internas de la paloma).
const VIDAS_INICIALES: int = 3

# Personajes seleccionables. Se cicla con la tecla C en PLAYING.
const CHARACTER_SCENES: Array[PackedScene] = [
	preload("res://scenes/personajes/paloma.tscn"),
	preload("res://scenes/personajes/pidgey.tscn"),
	preload("res://scenes/personajes/angry_bird.tscn"),
]

# ── Ciclo de estaciones (B6) ─────────────────────────────────────────────
const ESTACION_SCENE: PackedScene = preload("res://scenes/escenarios/estacion/estacion_base.tscn")
const CICLO_SEG: float = 22.0
const SPAWN_DELAY: float = 3.0
const EST_SPAWN_Z: float = -110.0
const EST_DESPAWN_Z: float = 32.0
const IDX_INICIAL: int = 9              # Delicias (start_station de la L3)

# ── Muerte ───────────────────────────────────────────────────────────────
const COOLDOWN_MUERTE: float = 1.2

enum Estado { JUGANDO, MUERTO }

@onready var _paloma: Paloma = $Paloma
@onready var _tunel: Node3D = $TunelBase

var _trenes: Array[Area3D] = []
var _estado: Estado = Estado.JUGANDO
var _cooldown: float = 0.0

var _l3_stations: Array[String] = []
var _l3_to: String = "MONCLOA"
var _l3_from: String = "EL CASAR"
var _idx_proxima: int = IDX_INICIAL
var _direccion: int = 1            # +1 hacia `to`, -1 hacia `from`
var _t_ciclo: float = 0.0
var _estacion: Node3D = null

# Progreso del run
var _vidas_totales: int = VIDAS_INICIALES
var _puntuacion: int = 0
var _ultimo_record_nuevo: bool = false   # true si el último GAME OVER batió el récord
var _character_idx: int = 0              # personaje activo (índice en CHARACTER_SCENES)


func _ready() -> void:
	_cargar_estaciones_l3()
	_crear_trenes()
	_paloma.murio.connect(_on_paloma_murio)
	GameState.phase_changed.connect(_on_phase_changed)
	# Sincroniza el personaje arrancable con el guardado en GameState.
	if GameState.selected_character_idx != _character_idx:
		_character_idx = GameState.selected_character_idx
		_swap_personaje()


# Tecla C en PLAYING: cicla paloma → pidgey → angry_bird → paloma → ...
func _unhandled_input(event: InputEvent) -> void:
	if GameState.current_phase != GameState.Phase.PLAYING:
		return
	if event is InputEventKey and event.pressed and not event.echo and event.keycode == KEY_C:
		_ciclar_personaje()
		get_viewport().set_input_as_handled()


func _ciclar_personaje() -> void:
	_character_idx = (_character_idx + 1) % CHARACTER_SCENES.size()
	GameState.set_personaje(_character_idx)
	_swap_personaje()
	print("[MundoJuego] Personaje cambiado a índice %d" % _character_idx)


# Reemplaza la paloma activa por una nueva instancia según _character_idx,
# preservando posición y reconectando la señal `murio`.
func _swap_personaje() -> void:
	var pos: Vector3 = _paloma.position
	_paloma.murio.disconnect(_on_paloma_murio)
	_paloma.queue_free()
	var nuevo: Paloma = CHARACTER_SCENES[_character_idx].instantiate() as Paloma
	nuevo.name = "Paloma"
	nuevo.position = pos
	add_child(nuevo)
	_paloma = nuevo
	_paloma.murio.connect(_on_paloma_murio)


func _process(delta: float) -> void:
	if GameState.current_phase != GameState.Phase.PLAYING:
		return
	if _estado == Estado.MUERTO:
		_cooldown -= delta
		if _cooldown <= 0.0:
			_reset_muerte()
		return

	# ── Ciclo de estaciones ─────────────────────────────────────────────
	_t_ciclo += delta
	if _estacion == null and _t_ciclo >= SPAWN_DELAY:
		_spawn_estacion()
	if _estacion != null:
		_estacion.position.z += VEL_SCROLL * delta
		if _estacion.position.z > EST_DESPAWN_Z:
			_estacion.queue_free()
			_estacion = null
	if _t_ciclo >= CICLO_SEG:
		_t_ciclo -= CICLO_SEG
		if _l3_stations.size() > 0:
			_idx_proxima = wrapi(_idx_proxima + _direccion, 0, _l3_stations.size())
		_puntuacion += 1
		if _estacion != null:
			_estacion.queue_free()
			_estacion = null

	# ── Ocultar túnel donde está la estación y avisar a la paloma ───────
	# Cuando la estación atraviesa la paloma, los límites de vuelo cambian
	# del bore arqueado al recinto rectangular entre pilares.
	if _estacion != null:
		var sz: float = _estacion.position.z
		_tunel.ocultar_rango_z(sz - 32.0, sz + 32.0)
		_paloma.set_en_estacion(absf(sz - _paloma.position.z) < 28.0)
	else:
		_tunel.mostrar_todo()
		_paloma.set_en_estacion(false)

	# ── Trenes: avanzan en su vía con velocidad propia + scroll del mundo.
	# La velocidad propia crece con la puntuación (dificultad progresiva).
	var vel_tren: float = VEL_SCROLL + _tren_vel_extra()
	for tren in _trenes:
		tren.position.z += vel_tren * delta
		if tren.position.z > TREN_Z_RECICLAJE:
			_reciclar_tren(tren)


# Velocidad extra del tren según la dificultad (escala con la puntuación).
func _tren_vel_extra() -> float:
	return TREN_VEL_BASE + clampf(float(_puntuacion) * TREN_VEL_INC_POR_PUNTO,
			0.0, TREN_VEL_INC_MAX)


# ── Estaciones ───────────────────────────────────────────────────────────
func _cargar_estaciones_l3() -> void:
	var mapa := MapaMetroMadrid.new()
	var linea_3: Dictionary = mapa.get_line(3)
	if not linea_3.has("stations"):
		push_warning("mundo_juego: no se pudo cargar la lista de estaciones de L3")
		return
	for s in linea_3.stations:
		_l3_stations.append(String(s.name))
	_l3_to = String(linea_3.get("to", "MONCLOA"))
	_l3_from = String(linea_3.get("from", "EL CASAR"))


func _spawn_estacion() -> void:
	if _l3_stations.is_empty():
		return
	var est: Node3D = ESTACION_SCENE.instantiate() as Node3D
	# La escena estación trae su propia Camera3D + WorldEnvironment para vista
	# standalone; al instanciarla en Mundo3D las retiramos antes de añadirla
	# al árbol para no chocar con las del túnel.
	var cam := est.get_node_or_null("Camera3D")
	if cam != null:
		est.remove_child(cam)
		cam.queue_free()
	var env := est.get_node_or_null("WorldEnvironment")
	if env != null:
		est.remove_child(env)
		env.queue_free()
	est.set("nombre_estacion", _l3_stations[_idx_proxima])
	est.set("direccion", (_l3_to if _direccion > 0 else _l3_from).to_upper())
	est.set("numero_linea", 3)
	est.position = Vector3(0.0, 0.0, EST_SPAWN_Z)
	add_child(est)
	_estacion = est


# ── Getters consumidos por el HUD ────────────────────────────────────────
func estaciones_linea() -> Array:
	return _l3_stations


func indice_proxima() -> int:
	return _idx_proxima


# Índice de la estación que acabamos de dejar atrás — el HUD interpola el
# marcador entre este y `indice_proxima` según el progreso del ciclo.
func indice_previa() -> int:
	if _l3_stations.is_empty():
		return 0
	return wrapi(_idx_proxima - _direccion, 0, _l3_stations.size())


func progreso_ciclo() -> float:
	return clampf(_t_ciclo / CICLO_SEG, 0.0, 1.0)


func proxima_estacion_nombre() -> String:
	if _l3_stations.is_empty():
		return ""
	return _l3_stations[_idx_proxima]


func vidas() -> int:
	return _vidas_totales


func puntuacion() -> int:
	return _puntuacion


# ── Trenes ───────────────────────────────────────────────────────────────
func _crear_trenes() -> void:
	for i in NUM_TRENES:
		var tren: Area3D = TREN_SCENE.instantiate() as Area3D
		add_child(tren)
		_trenes.append(tren)
		# Colocación inicial escalonada en Z para que vengan con ritmo.
		_colocar_tren(tren, -50.0 - float(i) * TREN_SEPARACION)


# Mueve un tren a una vía aleatoria (izquierda o derecha) en el Z dado.
func _colocar_tren(tren: Area3D, z: float) -> void:
	var lado: float = -1.0 if randf() < 0.5 else 1.0
	tren.position = Vector3(lado * TRACK_OFFSET, 0.0, z)


# Recicla un tren que ya pasó la cámara: lo manda al fondo en un Z aleatorio
# dentro del rango lejano, con vía aleatoria.
func _reciclar_tren(tren: Area3D) -> void:
	_colocar_tren(tren, randf_range(TREN_Z_LEJOS_MIN, TREN_Z_LEJOS_MAX))


# ── Muerte / reinicio ────────────────────────────────────────────────────
func _on_paloma_murio() -> void:
	_vidas_totales -= 1
	print("[MundoJuego] La paloma se estrelló — vidas restantes: %d" % _vidas_totales)
	if _vidas_totales <= 0:
		_ultimo_record_nuevo = GameState.actualizar_record(_puntuacion)
		if _ultimo_record_nuevo:
			print("[MundoJuego] ¡NUEVO RÉCORD! %d estaciones" % _puntuacion)
		else:
			print("[MundoJuego] GAME OVER · estaciones: %d (récord %d)"
					% [_puntuacion, GameState.record_puntuacion])
		GameState.change_phase(GameState.Phase.GAMEOVER)
		return
	_estado = Estado.MUERTO
	_cooldown = COOLDOWN_MUERTE


func nuevo_record() -> bool:
	return _ultimo_record_nuevo


func _on_phase_changed(nueva: GameState.Phase) -> void:
	if nueva == GameState.Phase.PLAYING:
		_reset_completo()


# Tras morir: la paloma vuelve al centro y los trenes se alejan; el ciclo
# de estaciones y el índice de L3 NO se tocan — la estación que se estaba
# acercando sigue su curso y el HUD no salta al inicio.
func _reset_muerte() -> void:
	_paloma.reiniciar()
	for i in _trenes.size():
		_colocar_tren(_trenes[i], -50.0 - float(i) * TREN_SEPARACION)
	_estado = Estado.JUGANDO


# Al (re)entrar en PLAYING: arrancamos en la estación y dirección elegidas
# desde la pantalla ARCADE (Delicias hacia Moncloa por defecto).
func _reset_completo() -> void:
	# Si el jugador eligió otro personaje desde la pantalla de selección,
	# aplica el cambio antes del respawn.
	if GameState.selected_character_idx != _character_idx:
		_character_idx = GameState.selected_character_idx
		_swap_personaje()
	_paloma.reiniciar()
	for i in _trenes.size():
		_colocar_tren(_trenes[i], -50.0 - float(i) * TREN_SEPARACION)
	if _estacion != null:
		_estacion.queue_free()
		_estacion = null
	_t_ciclo = 0.0
	if _l3_stations.size() > 0:
		_idx_proxima = clampi(GameState.selected_station_idx, 0,
				_l3_stations.size() - 1)
	else:
		_idx_proxima = IDX_INICIAL
	_direccion = 1 if GameState.selected_direction >= 0 else -1
	_vidas_totales = VIDAS_INICIALES
	_puntuacion = 0
	_estado = Estado.JUGANDO
