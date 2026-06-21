extends Node3D

# Fase B3 — Estación 3D.
# Migra js/escenarios/metro_base/estacion_base.js (composición back-view 2.5D
# con punto de fuga simulado) a una sala 3D real con Camera3D nativa.
#
# La estación es un tramo ESTÁTICO: dos andenes simétricos, dos vías, bóveda
# iluminada por fluorescentes y la boca de túnel oscura al fondo. Mantiene la
# continuidad de vía y la paleta con scripts/escenarios/tunel/tunel_base.gd.
#
# Fuera de alcance (fases posteriores): movimiento del jugador (B2), transición
# túnel<->estación (B6) y tren llegando (B5). En el JS de referencia el render
# del tren está desactivado (_drawTrains comentado), así que aquí tampoco se
# dibuja.

# ── Identidad de la estación (cada parada de la Línea 3 la sobreescribe) ──
@export var nombre_estacion: String = "Estación"
@export var direccion: String = "MONCLOA"
@export var numero_linea: int = 3
@export var color_linea: Color = Color("#f39200")
@export var mostrar_catenaria: bool = true
@export var mostrar_pantalla_led: bool = true

# ── Geometría del hall (metros) ──────────────────────────────────────────
const HALL_LARGO: float = 56.0       # profundidad de la sala (eje Z)
const HALL_ALTO: float = 5.0         # altura del techo
const MURO_X: float = 6.5            # |X| de la cara interior de la pared
const MURO_SPLIT_Y: float = 2.7      # corte zócalo amarillo / crema (wallSplitRatio 0.55)

# ── Andenes ──────────────────────────────────────────────────────────────
const ANDEN_ALTO: float = 1.0        # altura del andén sobre el balasto
const ANDEN_X_INT: float = 3.55      # |X| del borde interior (lado vía)
const ANDEN_LARGO: float = 48.0      # longitud del andén (< HALL_LARGO)

# ── Vías (mismas constantes que tunel_base.gd) ───────────────────────────
const RAIL_GAUGE: float = 1.435
const RAIL_ANCHO: float = 0.07
const RAIL_ALTO: float = 0.15
const VIA_OFFSET_X: float = 2.55     # |X| del centro de cada una de las dos vías
const NUM_TRAVIESAS: int = 40

# ── Elementos repetidos ──────────────────────────────────────────────────
const NUM_FLUORESCENTES: int = 7
const NUM_PILARES: int = 6           # por andén
const NUM_BANCOS: int = 3            # por andén
const NUM_CAJAS_SOS: int = 3         # por pared

# ── Paleta — DEFAULT_CONFIG de estacion_base.js ──────────────────────────
# Nota: estacion_base.js dejó platformColor en un verde de depuración
# (#28F064, "mismo que el overlay"); todos sus comentarios describen
# "hormigón claro tipo Metro de Madrid", así que aquí se usa hormigón.
const COL_BALASTO := Color("#1c1f25")
const COL_RAIL := Color("#8a8a8a")
const COL_TRAVIESA := Color("#3a3a42")
const COL_ANDEN := Color("#c2bdb2")
const COL_ANDEN_BORDE := Color("#f5c518")     # tactileBandColor
const COL_RODAPIE := Color("#2a2a30")
const COL_MURO_ZOCALO := Color("#f2c42a")     # wallColor (azulejo amarillo)
const COL_MURO_ALTO := Color("#e8e2d5")       # wallTopColor (crema)
const COL_TECHO := Color("#d5d0c7")           # ceilingColor (bóveda crema)
const COL_VIGA := Color("#b0aaa0")            # ceilingBandTop
const COL_PILAR := Color("#cfcabd")
const COL_PILAR_BASE := Color("#3a3a42")
const COL_FRISO := Color("#1a3a8a")           # friezeBgColor (azul Metro)
const COL_FLUOR := Color("#fff8dc")           # fluorescentColor (blanco cálido)
const COL_CABLE := Color("#222230")
const COL_LED_FONDO := Color("#1a3a8a")       # ledScreenBg
const COL_BANCO := Color("#e8e8e8")
const COL_BANCO_PATA := Color("#666666")
const COL_SOS := Color("#c81313")
const COL_CATENARIA := Color("#9aa8b8")       # catenaryRailColor (aluminio)
const COL_BOCA_MARCO := Color("#555560")      # tunnelMouthFrame

# ── Energía de un fluorescente encendido / apagado ───────────────────────
const FLUOR_ON_LUZ: float = 2.4
const FLUOR_OFF_LUZ: float = 0.15
const FLUOR_ON_EMISION: float = 3.0
const FLUOR_OFF_EMISION: float = 0.25

var _mats: Dictionary = {}
var _fluorescentes: Array[Dictionary] = []
var _frame: int = 0


func _ready() -> void:
	_crear_materiales()
	_construir_suelo()
	_construir_vias()
	_construir_andenes()
	_construir_paredes()
	_construir_techo()
	_construir_pilares()
	_construir_fluorescentes()
	_construir_friso()
	if mostrar_pantalla_led:
		_construir_pantalla_led()
	_construir_bancos()
	_construir_cajas_sos()
	if mostrar_catenaria:
		_construir_catenaria()
	# Boca lejana (-Z): la sala se cierra con un muro y la apertura muestra
	# oscuridad (void) — es lo que el jugador "ve al fondo" cuando entra.
	_construir_boca_en(-HALL_LARGO * 0.5, -1.0, true, true)
	# Boca cercana (+Z): mismo muro y apertura, pero sin void — el jugador la
	# atraviesa al entrar y mira a través de ella el interior de la estación.
	_construir_boca_en(HALL_LARGO * 0.5, 1.0, false, false)


func _process(delta: float) -> void:
	# Parpadeo esporádico de un fluorescente — replica el bloque de parpadeo
	# de estacion_base.js update() (cada 90 frames, 20 % de probabilidad,
	# apagón de 80-280 ms).
	_frame += 1
	if _frame % 90 == 0 and randf() < 0.2:
		var objetivo: Dictionary = _fluorescentes[randi() % _fluorescentes.size()]
		if objetivo["off"] <= 0.0:
			objetivo["off"] = randf_range(0.08, 0.28)
			_aplicar_fluorescente(objetivo, false)
	for f in _fluorescentes:
		if f["off"] > 0.0:
			f["off"] -= delta
			if f["off"] <= 0.0:
				f["off"] = 0.0
				_aplicar_fluorescente(f, true)


# ── Materiales ───────────────────────────────────────────────────────────
func _crear_materiales() -> void:
	_mats["balasto"] = _nuevo_mat(COL_BALASTO)
	_mats["rail"] = _nuevo_mat(COL_RAIL, 0.8, 0.3)
	_mats["traviesa"] = _nuevo_mat(COL_TRAVIESA)
	_mats["anden"] = _nuevo_mat(COL_ANDEN)
	_mats["anden_borde"] = _nuevo_mat(COL_ANDEN_BORDE, 0.0, 0.6)
	_mats["rodapie"] = _nuevo_mat(COL_RODAPIE)
	_mats["muro_zocalo"] = _nuevo_mat(COL_MURO_ZOCALO, 0.0, 0.55)
	_mats["muro_alto"] = _nuevo_mat(COL_MURO_ALTO)
	_mats["techo"] = _nuevo_mat(COL_TECHO)
	_mats["viga"] = _nuevo_mat(COL_VIGA)
	_mats["pilar"] = _nuevo_mat(COL_PILAR)
	_mats["pilar_base"] = _nuevo_mat(COL_PILAR_BASE)
	_mats["friso"] = _nuevo_mat(COL_FRISO)
	_mats["linea"] = _nuevo_mat(color_linea)
	_mats["cable"] = _nuevo_mat(COL_CABLE)
	_mats["led_fondo"] = _nuevo_mat(COL_LED_FONDO)
	_mats["banco"] = _nuevo_mat(COL_BANCO, 0.3, 0.4)
	_mats["banco_pata"] = _nuevo_mat(COL_BANCO_PATA, 0.5, 0.4)
	_mats["sos"] = _nuevo_mat(COL_SOS, 0.0, 0.5)
	_mats["catenaria"] = _nuevo_mat(COL_CATENARIA, 0.7, 0.35)
	_mats["boca_marco"] = _nuevo_mat(COL_BOCA_MARCO)

	# El vacío de la boca de túnel va sin sombreado para que se lea negro
	# absoluto pase lo que pase con la iluminación de la estación.
	var negro := StandardMaterial3D.new()
	negro.albedo_color = Color.BLACK
	negro.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	_mats["void"] = negro


func _nuevo_mat(color: Color, metallic: float = 0.0, roughness: float = 0.9) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = color
	m.metallic = metallic
	m.roughness = roughness
	return m


# ── Helpers de construcción ──────────────────────────────────────────────
func _contenedor(nombre: String) -> Node3D:
	var n := Node3D.new()
	n.name = nombre
	add_child(n)
	return n


# Crea una caja con material tomado de _mats por clave.
func _bloque(parent: Node3D, size: Vector3, pos: Vector3, mat_key: String) -> void:
	var mesh := BoxMesh.new()
	mesh.size = size
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.material_override = _mats[mat_key] as Material
	mi.position = pos
	parent.add_child(mi)


# ── Balasto (suelo del foso de vías) ─────────────────────────────────────
func _construir_suelo() -> void:
	var c := _contenedor("Balasto")
	_bloque(c, Vector3(ANDEN_X_INT * 2.0, 0.2, HALL_LARGO),
			Vector3(0.0, -0.1, 0.0), "balasto")


# ── Dos vías (carriles + traviesas) ──────────────────────────────────────
func _construir_vias() -> void:
	var c := _contenedor("Vias")
	var paso: float = HALL_LARGO / float(NUM_TRAVIESAS)
	for s in 2:
		var lado: float = -1.0 if s == 0 else 1.0
		var cx: float = lado * VIA_OFFSET_X
		for r in 2:
			var rsign: float = -1.0 if r == 0 else 1.0
			_bloque(c, Vector3(RAIL_ANCHO, RAIL_ALTO, HALL_LARGO),
					Vector3(cx + rsign * RAIL_GAUGE * 0.5, RAIL_ALTO * 0.5, 0.0),
					"rail")
		for i in NUM_TRAVIESAS:
			var z: float = -HALL_LARGO * 0.5 + paso * (float(i) + 0.5)
			_bloque(c, Vector3(RAIL_GAUGE + 0.9, 0.14, 0.25),
					Vector3(cx, 0.05, z), "traviesa")


# ── Dos andenes (losa + banda podotáctil + rodapié) ──────────────────────
func _construir_andenes() -> void:
	var c := _contenedor("Andenes")
	var ancho: float = MURO_X - ANDEN_X_INT
	var cx: float = (MURO_X + ANDEN_X_INT) * 0.5
	for s in 2:
		var lado: float = -1.0 if s == 0 else 1.0
		# Losa del andén
		_bloque(c, Vector3(ancho, ANDEN_ALTO, ANDEN_LARGO),
				Vector3(lado * cx, ANDEN_ALTO * 0.5, 0.0), "anden")
		# Banda podotáctil amarilla pegada al borde (lado vía)
		_bloque(c, Vector3(0.3, 0.06, ANDEN_LARGO),
				Vector3(lado * (ANDEN_X_INT + 0.15), ANDEN_ALTO + 0.03, 0.0),
				"anden_borde")
		# Rodapié al pie de la pared
		_bloque(c, Vector3(0.12, 0.28, ANDEN_LARGO),
				Vector3(lado * (MURO_X - 0.06), ANDEN_ALTO + 0.14, 0.0),
				"rodapie")


# ── Paredes (zócalo amarillo + crema + franja de identidad de línea) ─────
func _construir_paredes() -> void:
	var c := _contenedor("Paredes")
	var alto_crema: float = HALL_ALTO - MURO_SPLIT_Y
	for s in 2:
		var lado: float = -1.0 if s == 0 else 1.0
		var x: float = lado * (MURO_X + 0.15)
		_bloque(c, Vector3(0.3, MURO_SPLIT_Y, HALL_LARGO),
				Vector3(x, MURO_SPLIT_Y * 0.5, 0.0), "muro_zocalo")
		_bloque(c, Vector3(0.3, alto_crema, HALL_LARGO),
				Vector3(x, MURO_SPLIT_Y + alto_crema * 0.5, 0.0), "muro_alto")
		# Franja del color de la línea sobre la junta del zócalo
		_bloque(c, Vector3(0.06, 0.12, HALL_LARGO),
				Vector3(lado * (MURO_X - 0.03), MURO_SPLIT_Y, 0.0), "linea")


# ── Techo (losa + vigas transversales) ───────────────────────────────────
func _construir_techo() -> void:
	var c := _contenedor("Techo")
	_bloque(c, Vector3(MURO_X * 2.0 + 0.6, 0.3, HALL_LARGO),
			Vector3(0.0, HALL_ALTO + 0.15, 0.0), "techo")
	var n: int = 7
	var paso: float = HALL_LARGO / float(n)
	for i in n:
		var z: float = -HALL_LARGO * 0.5 + paso * (float(i) + 0.5)
		_bloque(c, Vector3(MURO_X * 2.0, 0.22, 0.4),
				Vector3(0.0, HALL_ALTO - 0.11, z), "viga")


# ── Pilares en cada andén ────────────────────────────────────────────────
func _construir_pilares() -> void:
	var c := _contenedor("Pilares")
	var altura: float = HALL_ALTO - ANDEN_ALTO
	var paso: float = ANDEN_LARGO / float(NUM_PILARES)
	for s in 2:
		var lado: float = -1.0 if s == 0 else 1.0
		var x: float = lado * 4.3
		for i in NUM_PILARES:
			var z: float = -ANDEN_LARGO * 0.5 + paso * (float(i) + 0.5)
			_bloque(c, Vector3(0.4, altura, 0.4),
					Vector3(x, ANDEN_ALTO + altura * 0.5, z), "pilar")
			_bloque(c, Vector3(0.55, 0.3, 0.55),
					Vector3(x, ANDEN_ALTO + 0.15, z), "pilar_base")


# ── Fluorescentes de techo (luminaria + tubo emisivo + OmniLight3D) ──────
func _construir_fluorescentes() -> void:
	var c := _contenedor("Fluorescentes")
	var paso: float = HALL_LARGO / float(NUM_FLUORESCENTES)
	for i in NUM_FLUORESCENTES:
		var z: float = -HALL_LARGO * 0.5 + paso * (float(i) + 0.5)
		# Carcasa de la luminaria
		_bloque(c, Vector3(0.5, 0.12, 4.2),
				Vector3(0.0, HALL_ALTO - 0.22, z), "viga")
		# Tubo: material emisivo propio para que el flicker afecte solo a éste
		var mat := StandardMaterial3D.new()
		mat.albedo_color = COL_FLUOR
		mat.emission_enabled = true
		mat.emission = COL_FLUOR
		mat.emission_energy_multiplier = FLUOR_ON_EMISION
		var tubo_mesh := BoxMesh.new()
		tubo_mesh.size = Vector3(0.36, 0.12, 4.0)
		var tubo := MeshInstance3D.new()
		tubo.mesh = tubo_mesh
		tubo.material_override = mat
		tubo.position = Vector3(0.0, HALL_ALTO - 0.34, z)
		c.add_child(tubo)
		# Luz real proyectada hacia el andén
		var luz := OmniLight3D.new()
		luz.position = Vector3(0.0, HALL_ALTO - 0.6, z)
		luz.light_color = COL_FLUOR
		luz.light_energy = FLUOR_ON_LUZ
		luz.omni_range = 15.0
		luz.omni_attenuation = 1.4
		c.add_child(luz)
		_fluorescentes.append({"luz": luz, "mat": mat, "off": 0.0})


func _aplicar_fluorescente(f: Dictionary, encendido: bool) -> void:
	var luz := f["luz"] as OmniLight3D
	var mat := f["mat"] as StandardMaterial3D
	luz.light_energy = FLUOR_ON_LUZ if encendido else FLUOR_OFF_LUZ
	mat.emission_energy_multiplier = FLUOR_ON_EMISION if encendido else FLUOR_OFF_EMISION


# ── Friso azul de identidad sobre cada pared ─────────────────────────────
func _construir_friso() -> void:
	var c := _contenedor("Friso")
	for s in 2:
		var lado: float = -1.0 if s == 0 else 1.0
		_bloque(c, Vector3(0.05, 0.6, ANDEN_LARGO),
				Vector3(lado * (MURO_X - 0.02), 3.4, 0.0), "friso")


# ── Pantalla LED colgante (sentido del trayecto) ─────────────────────────
func _construir_pantalla_led() -> void:
	var c := _contenedor("PantallaLED")
	var z: float = 16.0
	# y 4.0 (era 3.7) para que la pantalla no toque la cabeza de la paloma
	# cuando vuela alto (LIMITE_Y_MAX 2.9 → top ≈3.4).
	var y: float = 4.0
	_bloque(c, Vector3(2.6, 0.8, 0.12), Vector3(0.0, y, z), "led_fondo")
	var cable_alto: float = HALL_ALTO - (y + 0.4)
	for s in 2:
		var dx: float = -1.0 if s == 0 else 1.0
		_bloque(c, Vector3(0.04, cable_alto, 0.04),
				Vector3(dx * 0.9, y + 0.4 + cable_alto * 0.5, z), "cable")
	var etq := Label3D.new()
	etq.text = "L%d  SENTIDO %s" % [numero_linea, direccion.to_upper()]
	etq.font_size = 48
	etq.modulate = Color("#fff0a0")
	etq.pixel_size = 0.004
	etq.position = Vector3(0.0, y, z + 0.09)
	c.add_child(etq)


# ── Bancos en cada andén ─────────────────────────────────────────────────
func _construir_bancos() -> void:
	var c := _contenedor("Bancos")
	var paso: float = ANDEN_LARGO / float(NUM_BANCOS)
	var y_asiento: float = ANDEN_ALTO + 0.45
	for s in 2:
		var lado: float = -1.0 if s == 0 else 1.0
		var x: float = lado * 5.6
		for i in NUM_BANCOS:
			var z: float = -ANDEN_LARGO * 0.5 + paso * (float(i) + 0.5)
			# Asiento
			_bloque(c, Vector3(0.55, 0.1, 1.5),
					Vector3(x, y_asiento, z), "banco")
			# Respaldo (hacia la pared)
			_bloque(c, Vector3(0.12, 0.5, 1.5),
					Vector3(x + lado * 0.22, y_asiento + 0.25, z), "banco")
			# Patas
			for p in 2:
				var dz: float = -1.0 if p == 0 else 1.0
				_bloque(c, Vector3(0.08, 0.45, 0.08),
						Vector3(x, ANDEN_ALTO + 0.22, z + dz * 0.6), "banco_pata")


# ── Cajas de emergencia (SOS) sobre las paredes ──────────────────────────
func _construir_cajas_sos() -> void:
	var c := _contenedor("CajasSOS")
	var paso: float = ANDEN_LARGO / float(NUM_CAJAS_SOS)
	for s in 2:
		var lado: float = -1.0 if s == 0 else 1.0
		for i in NUM_CAJAS_SOS:
			var z: float = -ANDEN_LARGO * 0.5 + paso * (float(i) + 0.5)
			_bloque(c, Vector3(0.12, 0.5, 0.35),
					Vector3(lado * (MURO_X - 0.06), 2.1, z), "sos")


# ── Catenaria rígida sobre cada vía ──────────────────────────────────────
func _construir_catenaria() -> void:
	var c := _contenedor("Catenaria")
	var y_rail: float = HALL_ALTO - 0.7
	var n_hangers: int = 6
	var tramo: float = HALL_LARGO - 8.0
	var paso: float = tramo / float(n_hangers)
	for s in 2:
		var lado: float = -1.0 if s == 0 else 1.0
		var x: float = lado * VIA_OFFSET_X
		_bloque(c, Vector3(0.08, 0.1, HALL_LARGO - 4.0),
				Vector3(x, y_rail, 0.0), "catenaria")
		for i in n_hangers:
			var z: float = -tramo * 0.5 + paso * (float(i) + 0.5)
			_bloque(c, Vector3(0.05, HALL_ALTO - y_rail, 0.05),
					Vector3(x, (HALL_ALTO + y_rail) * 0.5, z), "catenaria")


# ── Bocas de túnel — entrada (+Z) y salida (-Z) de la estación ──────────
# signo = -1 → muro en el extremo -Z (boca lejana, lo que se ve al fondo).
# signo = +1 → muro en el extremo +Z (boca cercana, por donde se entra).
# El marco va siempre en la cara INTERIOR del muro; el void (si se pide)
# detrás del muro en la dirección "exterior".
func _construir_boca_en(z_muro: float, signo: float, con_void: bool, con_nombre: bool) -> void:
	var nombre_cont: String = "BocaLejana" if signo < 0.0 else "BocaCercana"
	var c := _contenedor(nombre_cont)
	var open_half: float = 4.0
	# open_alto 4.0 (era 3.2): el dintel queda por encima de la paloma a
	# LIMITE_Y_MAX 2.9 (su cabeza llega a y≈3.4), así no lo atraviesa.
	var open_alto: float = 4.0
	var lateral_ancho: float = MURO_X - open_half
	# Paneles del muro de fondo alrededor de la abertura
	_bloque(c, Vector3(MURO_X * 2.0, HALL_ALTO - open_alto, 0.4),
			Vector3(0.0, (open_alto + HALL_ALTO) * 0.5, z_muro), "muro_alto")
	for s in 2:
		var lado: float = -1.0 if s == 0 else 1.0
		_bloque(c, Vector3(lateral_ancho, open_alto, 0.4),
				Vector3(lado * (MURO_X + open_half) * 0.5, open_alto * 0.5, z_muro),
				"muro_zocalo")
	# Marco de hormigón en la cara interior del muro.
	var frame_z: float = z_muro - 0.25 * signo
	_bloque(c, Vector3(open_half * 2.0 + 0.6, 0.35, 0.5),
			Vector3(0.0, open_alto, frame_z), "boca_marco")
	for s in 2:
		var lado: float = -1.0 if s == 0 else 1.0
		_bloque(c, Vector3(0.3, open_alto, 0.5),
				Vector3(lado * (open_half + 0.15), open_alto * 0.5, frame_z),
				"boca_marco")
	# Vacío oscuro detrás de la abertura (solo en la boca lejana).
	if con_void:
		_bloque(c, Vector3(open_half * 2.0 + 0.6, open_alto + 1.0, 0.4),
				Vector3(0.0, open_alto * 0.5, z_muro + 1.0 * signo), "void")
	# Nombre de la estación sobre la boca, mirando hacia el interior.
	if con_nombre:
		var etq := Label3D.new()
		etq.text = nombre_estacion.to_upper()
		etq.font_size = 100
		etq.modulate = Color.WHITE
		etq.pixel_size = 0.009
		etq.position = Vector3(0.0, (open_alto + HALL_ALTO) * 0.5, z_muro - 0.5 * signo)
		c.add_child(etq)
