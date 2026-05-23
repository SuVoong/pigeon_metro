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
# trenes que SE MUEVEN sobre las vías (a 18 m/s ≈ 65 km/h relativos a la
# cámara), en vez de quedar quietos respecto al túnel.
const TREN_VEL: float = 6.0

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
var _idx_proxima: int = IDX_INICIAL
var _t_ciclo: float = 0.0
var _estacion: Node3D = null


func _ready() -> void:
	_cargar_estaciones_l3()
	_crear_trenes()
	_paloma.murio.connect(_on_paloma_murio)
	GameState.phase_changed.connect(_on_phase_changed)


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
			_idx_proxima = (_idx_proxima + 1) % _l3_stations.size()
		if _estacion != null:
			_estacion.queue_free()
			_estacion = null

	# ── Ocultar túnel donde está la estación ────────────────────────────
	if _estacion != null:
		var sz: float = _estacion.position.z
		_tunel.ocultar_rango_z(sz - 32.0, sz + 32.0)
	else:
		_tunel.mostrar_todo()

	# ── Trenes: avanzan en su vía con velocidad propia + scroll del mundo
	#         (resultado: visualmente adelantan al túnel, como trenes reales).
	for tren in _trenes:
		tren.position.z += (VEL_SCROLL + TREN_VEL) * delta
		if tren.position.z > TREN_Z_RECICLAJE:
			_reciclar_tren(tren)


# ── Estaciones ───────────────────────────────────────────────────────────
func _cargar_estaciones_l3() -> void:
	var mapa := MapaMetroMadrid.new()
	var linea_3: Dictionary = mapa.get_line(3)
	if not linea_3.has("stations"):
		push_warning("mundo_juego: no se pudo cargar la lista de estaciones de L3")
		return
	for s in linea_3.stations:
		_l3_stations.append(String(s.name))


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
	est.set("direccion", "MONCLOA")
	est.set("numero_linea", 3)
	est.position = Vector3(0.0, 0.0, EST_SPAWN_Z)
	add_child(est)
	_estacion = est


# ── Getters consumidos por el HUD ────────────────────────────────────────
func estaciones_linea() -> Array:
	return _l3_stations


func indice_proxima() -> int:
	return _idx_proxima


func progreso_ciclo() -> float:
	return clampf(_t_ciclo / CICLO_SEG, 0.0, 1.0)


func proxima_estacion_nombre() -> String:
	if _l3_stations.is_empty():
		return ""
	return _l3_stations[_idx_proxima]


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
	print("[MundoJuego] La paloma se estrelló — respawn en el sitio.")
	_estado = Estado.MUERTO
	_cooldown = COOLDOWN_MUERTE


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


# Al (re)entrar en PLAYING: empezamos el nivel desde Delicias.
func _reset_completo() -> void:
	_paloma.reiniciar()
	for i in _trenes.size():
		_colocar_tren(_trenes[i], -50.0 - float(i) * TREN_SEPARACION)
	if _estacion != null:
		_estacion.queue_free()
		_estacion = null
	_t_ciclo = 0.0
	_idx_proxima = IDX_INICIAL
	_estado = Estado.JUGANDO
