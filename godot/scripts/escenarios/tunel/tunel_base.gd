extends Node3D

# Fase B1 — Prototipo del túnel 3D.
# Sustituye la perspectiva 2.5D simulada de js/escenarios/metro_base/tunel.js
# por geometría 3D real con Camera3D nativa y scroll infinito por reciclaje
# de segmentos.

# Geometría (metros). Aproximación de proporciones reales del Metro Madrid:
# ancho de vía 5.0m, gauge ferroviario europeo 1.435m.
const SEGMENTO_LARGO: float = 10.0
const NUM_SEGMENTOS: int = 12
const TUNEL_ANCHO: float = 6.0
const TUNEL_ALTO: float = 4.0
const RAIL_GAUGE: float = 1.435
const RAIL_ANCHO: float = 0.07
const RAIL_ALTO: float = 0.15

# Scroll: el túnel "viene hacia ti" a esta velocidad.
const VELOCIDAD_SCROLL: float = 12.0

# Paleta — derivada de PAL en js/mecanica/estado.js.
const COLOR_SUELO := Color("#2a2a3a")
const COLOR_TECHO := Color("#3a3a4a")
const COLOR_PARED := Color("#4a4a5a")
const COLOR_RAIL := Color("#8a8a8a")
const COLOR_LUZ := Color("#ffffaa")

var _segmentos: Array[Node3D] = []
var _mat_suelo: StandardMaterial3D
var _mat_techo: StandardMaterial3D
var _mat_pared: StandardMaterial3D
var _mat_rail: StandardMaterial3D


func _ready() -> void:
	_crear_materiales()
	_crear_segmentos()


func _process(delta: float) -> void:
	var ciclo: float = NUM_SEGMENTOS * SEGMENTO_LARGO
	for seg in _segmentos:
		seg.position.z += VELOCIDAD_SCROLL * delta
		# Cuando un segmento pasa la cámara, lo reciclamos al fondo.
		if seg.position.z > SEGMENTO_LARGO * 0.5:
			seg.position.z -= ciclo


func _crear_materiales() -> void:
	_mat_suelo = StandardMaterial3D.new()
	_mat_suelo.albedo_color = COLOR_SUELO

	_mat_techo = StandardMaterial3D.new()
	_mat_techo.albedo_color = COLOR_TECHO

	_mat_pared = StandardMaterial3D.new()
	_mat_pared.albedo_color = COLOR_PARED

	_mat_rail = StandardMaterial3D.new()
	_mat_rail.albedo_color = COLOR_RAIL
	_mat_rail.metallic = 0.8
	_mat_rail.roughness = 0.3


func _crear_segmentos() -> void:
	for i in NUM_SEGMENTOS:
		var seg := _crear_segmento(i)
		seg.position.z = -i * SEGMENTO_LARGO
		add_child(seg)
		_segmentos.append(seg)


func _crear_segmento(idx: int) -> Node3D:
	var seg := Node3D.new()
	seg.name = "Segmento_%d" % idx

	# Suelo
	var suelo := _crear_caja(Vector3(TUNEL_ANCHO, 0.2, SEGMENTO_LARGO), _mat_suelo)
	suelo.position.y = -0.1
	seg.add_child(suelo)

	# Techo
	var techo := _crear_caja(Vector3(TUNEL_ANCHO, 0.2, SEGMENTO_LARGO), _mat_techo)
	techo.position.y = TUNEL_ALTO
	seg.add_child(techo)

	# Paredes
	var pared_l := _crear_caja(Vector3(0.2, TUNEL_ALTO, SEGMENTO_LARGO), _mat_pared)
	pared_l.position = Vector3(-TUNEL_ANCHO * 0.5, TUNEL_ALTO * 0.5, 0)
	seg.add_child(pared_l)

	var pared_r := _crear_caja(Vector3(0.2, TUNEL_ALTO, SEGMENTO_LARGO), _mat_pared)
	pared_r.position = Vector3(TUNEL_ANCHO * 0.5, TUNEL_ALTO * 0.5, 0)
	seg.add_child(pared_r)

	# Raíles paralelos (gauge ferroviario)
	var rail_l := _crear_caja(Vector3(RAIL_ANCHO, RAIL_ALTO, SEGMENTO_LARGO), _mat_rail)
	rail_l.position = Vector3(-RAIL_GAUGE * 0.5, RAIL_ALTO * 0.5, 0)
	seg.add_child(rail_l)

	var rail_r := _crear_caja(Vector3(RAIL_ANCHO, RAIL_ALTO, SEGMENTO_LARGO), _mat_rail)
	rail_r.position = Vector3(RAIL_GAUGE * 0.5, RAIL_ALTO * 0.5, 0)
	seg.add_child(rail_r)

	# Luminaria de techo cada 2 segmentos
	if idx % 2 == 0:
		var luz := OmniLight3D.new()
		luz.position = Vector3(0, TUNEL_ALTO - 0.3, 0)
		luz.light_color = COLOR_LUZ
		luz.light_energy = 1.2
		luz.omni_range = 9.0
		seg.add_child(luz)

	return seg


func _crear_caja(size: Vector3, material: StandardMaterial3D) -> MeshInstance3D:
	var mesh := BoxMesh.new()
	mesh.size = size
	var instance := MeshInstance3D.new()
	instance.mesh = mesh
	instance.material_override = material
	return instance
