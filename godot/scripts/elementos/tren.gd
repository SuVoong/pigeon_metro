extends Area3D

# Fase B5 — Tren del Metro de Madrid como obstáculo móvil.
# Modelo procedural de cajas inspirado en la serie 5000/8000:
#   · cuerpo blanco con cabina blanca (no oscura — la cara oscura es solo
#     el parabrisas y el panel LED de destino),
#   · parabrisas dividido en dos ventanas grandes con pilar central blanco
#     + dos ventanas envolventes laterales,
#   · panel LED prominente sobre el parabrisas (texto naranja-rojo),
#   · 5 ventanas de pasajeros a lo largo del costado,
#   · franjas azul corporativo arriba y abajo de la línea de ventanas
#     + franja del color de línea (naranja L3) en el faldón superior,
#   · rombo rojo de Metro de Madrid grande en el frente y en cada costado,
#   · faros blancos emisivos inferiores + luces de gálibo rojas.
# La velocidad propia respecto al scroll del mundo la añade mundo_juego.gd.

@export var color_linea: Color = Color("#f39200")  # L3 naranja por defecto

# ── Paleta — Metro de Madrid (serie 5000/8000) ───────────────────────────
const COL_CUERPO := Color("#f6f6f6")        # blanco perlado
const COL_TECHO := Color("#dadada")
const COL_BAJO := Color("#1a1a25")          # faldón y bogies
const COL_VENTANA := Color("#0c1a2a")       # cristal tintado oscuro
const COL_PILAR := Color("#f6f6f6")         # pilar central blanco entre parabrisas
const COL_LED_BG := Color("#0a0a0a")
const COL_LED_TXT := Color("#ff5520")       # rojo-naranja brillante del destino
const COL_HEADLIGHT := Color("#fff5d0")     # blanco cálido
const COL_MARKER := Color("#cc2211")
const COL_AZUL := Color("#1a4080")          # azul corporativo Metro
const COL_ROMBO := Color("#cc2211")         # rojo del rombo


func _ready() -> void:
	monitoring = false
	add_to_group("obstaculos")
	_construir_modelo()
	_construir_colision()


func _construir_modelo() -> void:
	# ── Cuerpo y techo ──────────────────────────────────────────────────
	_caja(Vector3(2.0, 2.6, 7.5), Vector3(0.0, 1.45, -0.25), COL_CUERPO)
	_caja(Vector3(1.95, 0.18, 7.3), Vector3(0.0, 2.85, -0.25), COL_TECHO)
	_caja(Vector3(1.92, 0.3, 7.3), Vector3(0.0, 0.3, -0.25), COL_BAJO)

	# ── Cabina (blanca como el cuerpo, sobresale 0.5 m) ─────────────────
	_caja(Vector3(2.0, 2.85, 1.0), Vector3(0.0, 1.55, 4.0), COL_CUERPO)
	_caja(Vector3(1.95, 0.18, 1.0), Vector3(0.0, 2.95, 4.0), COL_TECHO)

	# ── Frente: panel LED de destino (prominente, arriba) ───────────────
	_caja(Vector3(1.85, 0.42, 0.06), Vector3(0.0, 2.7, 4.53), COL_LED_BG)
	_caja(Vector3(1.55, 0.2, 0.07), Vector3(0.0, 2.7, 4.54), COL_LED_TXT)

	# ── Frente: parabrisas dividido en DOS con pilar central blanco ─────
	_caja(Vector3(0.78, 0.88, 0.06), Vector3(-0.45, 2.0, 4.53), COL_VENTANA)
	_caja(Vector3(0.78, 0.88, 0.06), Vector3(0.45, 2.0, 4.53), COL_VENTANA)
	_caja(Vector3(0.14, 0.88, 0.07), Vector3(0.0, 2.0, 4.55), COL_PILAR)
	# Ventanas envolventes a los lados del parabrisas
	_caja(Vector3(0.18, 0.78, 0.06), Vector3(-0.94, 2.0, 4.53), COL_VENTANA)
	_caja(Vector3(0.18, 0.78, 0.06), Vector3(0.94, 2.0, 4.53), COL_VENTANA)

	# ── Frente: rombo rojo GRANDE bajo el parabrisas ────────────────────
	_caja(Vector3(0.42, 0.42, 0.05), Vector3(0.0, 1.2, 4.53), COL_ROMBO)
	# Centro blanco del rombo (efecto "M")
	_caja(Vector3(0.18, 0.18, 0.06), Vector3(0.0, 1.2, 4.54), COL_CUERPO)

	# ── Frente: faros blancos emisivos inferiores + luces rojas de gálibo
	var mat_blanco := StandardMaterial3D.new()
	mat_blanco.albedo_color = COL_HEADLIGHT
	mat_blanco.emission_enabled = true
	mat_blanco.emission = COL_HEADLIGHT
	mat_blanco.emission_energy_multiplier = 2.4
	_caja_mat(Vector3(0.26, 0.16, 0.05), Vector3(-0.7, 0.65, 4.53), mat_blanco)
	_caja_mat(Vector3(0.26, 0.16, 0.05), Vector3(0.7, 0.65, 4.53), mat_blanco)

	var mat_rojo := StandardMaterial3D.new()
	mat_rojo.albedo_color = COL_MARKER
	mat_rojo.emission_enabled = true
	mat_rojo.emission = COL_MARKER
	mat_rojo.emission_energy_multiplier = 1.4
	_caja_mat(Vector3(0.14, 0.1, 0.05), Vector3(-0.88, 1.6, 4.53), mat_rojo)
	_caja_mat(Vector3(0.14, 0.1, 0.05), Vector3(0.88, 1.6, 4.53), mat_rojo)

	# ── Frente: franja azul horizontal inferior (parte del "swoosh") ────
	_caja(Vector3(1.85, 0.1, 0.06), Vector3(0.0, 0.85, 4.53), COL_AZUL)

	# ── Costados: ventanas de pasajeros + franjas azules + rombo ────────
	var ventanas_z: Array[float] = [-2.8, -1.4, 0.0, 1.4, 2.8]
	for s in 2:
		var lado: float = -1.0 if s == 0 else 1.0
		# Ventanas tintadas a lo largo del cuerpo
		for vz in ventanas_z:
			_caja(Vector3(0.04, 0.8, 0.9), Vector3(lado * 1.01, 1.95, vz), COL_VENTANA)
		# Franja azul superior (sobre las ventanas)
		_caja(Vector3(0.04, 0.08, 7.5), Vector3(lado * 1.01, 2.45, -0.25), COL_AZUL)
		# Franja azul inferior (bajo las ventanas)
		_caja(Vector3(0.04, 0.12, 7.5), Vector3(lado * 1.01, 1.4, -0.25), COL_AZUL)
		# Franja del color de línea (justo por encima del faldón)
		_caja(Vector3(0.04, 0.08, 7.5), Vector3(lado * 1.01, 0.65, -0.25), color_linea)
		# Rombo rojo de Metro en el costado de la cabina
		_caja(Vector3(0.04, 0.28, 0.28), Vector3(lado * 1.015, 1.7, 4.1), COL_ROMBO)
		# Rombo rojo de Metro en mitad del costado del cuerpo
		_caja(Vector3(0.04, 0.22, 0.22), Vector3(lado * 1.015, 1.0, 0.0), COL_ROMBO)
		# Franja azul continúa en el costado de la cabina (efecto swoosh)
		_caja(Vector3(0.045, 0.12, 0.9), Vector3(lado * 1.015, 0.85, 4.05), COL_AZUL)


func _construir_colision() -> void:
	# Hitbox más estrecha y baja que el visual para que la paloma pueda
	# esquivar por arriba o por el centro entre dos vías ocupadas.
	var cs := CollisionShape3D.new()
	var shape := BoxShape3D.new()
	shape.size = Vector3(1.8, 2.3, 8.5)
	cs.shape = shape
	cs.position = Vector3(0.0, 1.15, 0.0)
	add_child(cs)


func _caja(size: Vector3, pos: Vector3, color: Color) -> void:
	var mat := StandardMaterial3D.new()
	mat.albedo_color = color
	_caja_mat(size, pos, mat)


func _caja_mat(size: Vector3, pos: Vector3, mat: Material) -> void:
	var mesh := BoxMesh.new()
	mesh.size = size
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.material_override = mat
	mi.position = pos
	add_child(mi)
