extends Node3D

# Fase B1 (rediseño) — Túnel 3D según el diseño de js/escenarios/metro_base/tunel.js.
#
# Sustituye la caja rectangular de 1 vía del prototipo inicial por la sección
# del Metro de Madrid descrita en tunel.js y ANALISIS_TUNEL.md:
#   · Arco de hormigón formado por DOVELAS prefabricadas (paneles facetados
#     con juntas radiales) — _drawArchRings del JS.
#   · DOS vías (4 carriles) con traviesas — _drawRails.
#   · Canal de drenaje central entre las vías — _drawCentralDrain.
#   · Canales de drenaje laterales en las esquinas — _drawSideDrains.
#   · Bandejas portacables en ambas paredes — _drawSideCableTrays.
#   · Luminarias empotradas en la bóveda — _drawCeilingLights.
#   · Solera de hormigón bajo las vías — _drawTrackFloor.
#
# La sección es una MEDIA ELIPSE achatada (ancha y baja) apoyada en la solera,
# como la foto de referencia del túnel real — no un círculo alto.
# La catenaria rígida queda fuera: en tunel.js está definida pero desactivada.

# ── Segmentos y scroll ───────────────────────────────────────────────────
const SEGMENTO_LARGO: float = 10.0
const NUM_SEGMENTOS: int = 12          # par → el bandeado de dovelas recicla sin saltos
const VELOCIDAD_SCROLL: float = 12.0

# ── Sección del túnel — media elipse apoyada en la solera (Y=0) ──────────
# Achatada: claramente más ancha (2·RX) que alta (RY).
const BORE_RX: float = 4.3             # semieje horizontal → ancho total 8.6 m
const BORE_RY: float = 4.2             # semieje vertical → altura de la clave
const ARCH_PANELES: int = 13           # dovelas por anillo

# ── Vías (ejes a 3.10 m → ±1.55; ancho de vía UIC 1.435 m) ───────────────
const TRACK_OFFSET: float = 1.55       # |X| del eje de cada una de las dos vías
const RAIL_GAUGE: float = 1.435
const RAIL_ANCHO: float = 0.09
const RAIL_ALTO: float = 0.16
const SLEEPERS_POR_SEGMENTO: int = 4

# ── Paleta — colores de tunel.js ─────────────────────────────────────────
const COLOR_DOVELA_PAR := Color("#30343f")    # banda clara del bandeado
const COLOR_DOVELA_IMPAR := Color("#262a33")  # rgb(38,42,52) del JS
const COLOR_SOLERA := Color("#363941")        # gradiente del balasto del JS
const COLOR_RAIL := Color("#8a8c94")          # railColor del JS
const COLOR_TRAVIESA := Color("#44464d")      # pad de hormigón
const COLOR_DRENAJE := Color("#202228")       # canal recesado oscuro
const COLOR_BANDEJA := Color("#1f2127")       # cuerpo de bandeja del JS
const COLOR_LUZ := Color("#fff5dc")           # tubo luminoso cálido

var _segmentos: Array[Node3D] = []
var _mats: Dictionary = {}

# Rango Z opcional donde NO renderizamos segmentos del túnel (lo usa
# mundo_juego.gd mientras hay una estación atravesando ese tramo, para que
# las dovelas del túnel no se vean dentro de la sala de la estación).
var _hide_active: bool = false
var _hide_z_min: float = 0.0
var _hide_z_max: float = 0.0


func _ready() -> void:
	_crear_materiales()
	_crear_segmentos()


func _process(delta: float) -> void:
	var ciclo: float = float(NUM_SEGMENTOS) * SEGMENTO_LARGO
	for seg in _segmentos:
		seg.position.z += VELOCIDAD_SCROLL * delta
		# Cuando un segmento pasa la cámara se recicla al fondo.
		if seg.position.z > SEGMENTO_LARGO * 0.5:
			seg.position.z -= ciclo
		# Ocultar segmentos que caen dentro del rango oculto (estación).
		var visible_nuevo: bool = true
		if _hide_active:
			var seg_min: float = seg.position.z - SEGMENTO_LARGO * 0.5
			var seg_max: float = seg.position.z + SEGMENTO_LARGO * 0.5
			visible_nuevo = not (seg_max > _hide_z_min and seg_min < _hide_z_max)
		if seg.visible != visible_nuevo:
			seg.visible = visible_nuevo


# Oculta del túnel los segmentos cuyo Z solape con [z_min, z_max].
# Lo usa mundo_juego.gd para que la estación no comparta espacio con el
# túnel mientras está en pantalla.
func ocultar_rango_z(z_min: float, z_max: float) -> void:
	_hide_active = true
	_hide_z_min = z_min
	_hide_z_max = z_max


func mostrar_todo() -> void:
	if not _hide_active:
		return
	_hide_active = false
	for seg in _segmentos:
		seg.visible = true


# ── Materiales ───────────────────────────────────────────────────────────
func _crear_materiales() -> void:
	_mats["dovela_par"] = _nuevo_mat(COLOR_DOVELA_PAR)
	_mats["dovela_impar"] = _nuevo_mat(COLOR_DOVELA_IMPAR)
	_mats["solera"] = _nuevo_mat(COLOR_SOLERA)
	_mats["rail"] = _nuevo_mat(COLOR_RAIL, 0.85, 0.3)
	_mats["traviesa"] = _nuevo_mat(COLOR_TRAVIESA)
	_mats["drenaje"] = _nuevo_mat(COLOR_DRENAJE, 0.2, 0.5)
	_mats["bandeja"] = _nuevo_mat(COLOR_BANDEJA, 0.4, 0.5)

	var luz_mat := StandardMaterial3D.new()
	luz_mat.albedo_color = COLOR_LUZ
	luz_mat.emission_enabled = true
	luz_mat.emission = COLOR_LUZ
	luz_mat.emission_energy_multiplier = 2.5
	_mats["luz"] = luz_mat


func _nuevo_mat(color: Color, metallic: float = 0.0, roughness: float = 0.95) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = color
	m.metallic = metallic
	m.roughness = roughness
	return m


# ── Construcción ─────────────────────────────────────────────────────────
func _crear_segmentos() -> void:
	for i in NUM_SEGMENTOS:
		var seg := _crear_segmento(i)
		seg.position.z = -float(i) * SEGMENTO_LARGO
		add_child(seg)
		_segmentos.append(seg)


func _crear_segmento(idx: int) -> Node3D:
	var seg := Node3D.new()
	seg.name = "Segmento_%d" % idx
	# Bandas de dovelas alternas (efecto anillos del JS _drawArchRings).
	var dovela_key: String = "dovela_par" if idx % 2 == 0 else "dovela_impar"

	# 1 ── Arco de dovelas: media elipse achatada apoyada en la solera.
	# phi va de -90° (suelo izquierdo) a +90° (suelo derecho), 0° en la clave.
	var paso: float = PI / float(ARCH_PANELES)
	for i in ARCH_PANELES:
		var phi: float = -PI * 0.5 + paso * (float(i) + 0.5)
		var px: float = BORE_RX * sin(phi)
		var py: float = BORE_RY * cos(phi)
		# Tangente de la elipse en phi → orienta y dimensiona el panel.
		var tang_x: float = BORE_RX * cos(phi)
		var tang_y: float = -BORE_RY * sin(phi)
		var ancho: float = sqrt(tang_x * tang_x + tang_y * tang_y) * paso * 0.9
		_bloque(seg, Vector3(ancho, 0.3, SEGMENTO_LARGO - 0.3),
				Vector3(px, py, 0.0), atan2(tang_y, tang_x), dovela_key)

	# 2 ── Solera de hormigón bajo las vías.
	_bloque(seg, Vector3(BORE_RX * 2.0, 0.2, SEGMENTO_LARGO + 0.1),
			Vector3(0.0, -0.1, 0.0), 0.0, "solera")

	# 3 ── Dos vías: 2 carriles + traviesas cada una.
	for s in 2:
		var lado: float = -1.0 if s == 0 else 1.0
		var eje: float = lado * TRACK_OFFSET
		for r in 2:
			var rs: float = -1.0 if r == 0 else 1.0
			_bloque(seg, Vector3(RAIL_ANCHO, RAIL_ALTO, SEGMENTO_LARGO + 0.1),
					Vector3(eje + rs * RAIL_GAUGE * 0.5, RAIL_ALTO * 0.5, 0.0),
					0.0, "rail")
		for j in SLEEPERS_POR_SEGMENTO:
			var sz: float = -SEGMENTO_LARGO * 0.5 \
					+ SEGMENTO_LARGO / float(SLEEPERS_POR_SEGMENTO) * (float(j) + 0.5)
			_bloque(seg, Vector3(RAIL_GAUGE + 0.5, 0.14, 0.26),
					Vector3(eje, 0.05, sz), 0.0, "traviesa")

	# 4 ── Canal de drenaje central entre las dos vías.
	_bloque(seg, Vector3(0.9, 0.22, SEGMENTO_LARGO + 0.1),
			Vector3(0.0, -0.13, 0.0), 0.0, "drenaje")

	# 5 ── Canales de drenaje laterales + bandejas portacables.
	for s in 2:
		var lado: float = -1.0 if s == 0 else 1.0
		_bloque(seg, Vector3(0.35, 0.2, SEGMENTO_LARGO + 0.1),
				Vector3(lado * 2.5, -0.06, 0.0), 0.0, "drenaje")
		_bloque(seg, Vector3(0.22, 0.36, SEGMENTO_LARGO + 0.1),
				Vector3(lado * 3.35, 2.2, 0.0), 0.0, "bandeja")

	# 6 ── Luminaria empotrada en la bóveda cada 2 segmentos.
	if idx % 2 == 0:
		_bloque(seg, Vector3(0.5, 0.16, 1.8), Vector3(0.0, 3.9, 0.0), 0.0, "luz")
		var luz := OmniLight3D.new()
		luz.position = Vector3(0.0, 3.6, 0.0)
		luz.light_color = COLOR_LUZ
		luz.light_energy = 2.6
		luz.omni_range = 14.0
		seg.add_child(luz)

	return seg


# Crea una caja con material de _mats; rot_z rota el panel (dovelas del arco).
func _bloque(parent: Node3D, size: Vector3, pos: Vector3, rot_z: float, mat_key: String) -> void:
	var mesh := BoxMesh.new()
	mesh.size = size
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.material_override = _mats[mat_key] as Material
	mi.position = pos
	if rot_z != 0.0:
		mi.rotation = Vector3(0.0, 0.0, rot_z)
	parent.add_child(mi)
