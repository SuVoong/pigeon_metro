extends Area3D

# Fase B5 (prototipo) — Tren del Metro de Madrid como obstáculo móvil.
# Modelo procedural de cajas inspirado en la serie 3000/8000:
#   · cuerpo blanco, frente oscuro prominente con parabrisas envolvente,
#   · cuatro faros (dos blancos inferiores + dos rojos de gálibo),
#   · friso azul corporativo + franja del color de línea,
#   · rombo rojo de Metro de Madrid en el costado de la cabina,
#   · marcas verticales de las puertas a lo largo del cuerpo.
# La velocidad propia respecto al scroll del mundo la añade mundo_juego.gd.

@export var color_linea: Color = Color("#f39200")  # L3 naranja por defecto

# ── Paleta — colores reales del Metro de Madrid ──────────────────────────
const COL_CUERPO := Color("#f5f5f5")        # blanco perlado
const COL_TECHO := Color("#dcdcdc")
const COL_BAJO := Color("#1a1a25")          # faldón y bogies
const COL_CABINA := Color("#161616")        # frente oscuro prominente
const COL_WINDOW := Color("#0e1e30")        # parabrisas tintado
const COL_LED_BG := Color("#0a0a0a")
const COL_LED_TXT := Color("#ff9933")
const COL_HEADLIGHT := Color("#ffffff")
const COL_MARKER := Color("#cc2211")        # rojo Metro
const COL_STRIPE_BLUE := Color("#1a4080")   # azul corporativo
const COL_ROMBO := Color("#cc2211")
const COL_PUERTA := Color("#707070")


func _ready() -> void:
	# El tren es detectado por la paloma, no detecta nada por sí mismo.
	monitoring = false
	add_to_group("obstaculos")
	_construir_modelo()
	_construir_colision()


func _construir_modelo() -> void:
	# ── Cuerpo principal ─────────────────────────────────────────────────
	_caja(Vector3(2.0, 2.6, 7.5), Vector3(0.0, 1.45, -0.25), COL_CUERPO)
	_caja(Vector3(1.95, 0.18, 7.3), Vector3(0.0, 2.85, -0.25), COL_TECHO)
	_caja(Vector3(1.92, 0.3, 7.3), Vector3(0.0, 0.3, -0.25), COL_BAJO)

	# ── Cabina (frente oscuro, sobresale 0.5 m del cuerpo) ───────────────
	_caja(Vector3(2.0, 2.85, 1.0), Vector3(0.0, 1.55, 4.0), COL_CABINA)

	# ── Parabrisas + ventanas laterales envolventes ──────────────────────
	_caja(Vector3(1.55, 0.95, 0.06), Vector3(0.0, 2.05, 4.53), COL_WINDOW)
	_caja(Vector3(0.25, 0.85, 0.06), Vector3(-0.92, 2.05, 4.53), COL_WINDOW)
	_caja(Vector3(0.25, 0.85, 0.06), Vector3(0.92, 2.05, 4.53), COL_WINDOW)

	# ── Panel LED de destino sobre el parabrisas ─────────────────────────
	_caja(Vector3(1.4, 0.2, 0.06), Vector3(0.0, 2.75, 4.53), COL_LED_BG)
	_caja(Vector3(1.2, 0.1, 0.07), Vector3(0.0, 2.75, 4.54), COL_LED_TXT)

	# ── Faros (2 blancos inferiores + 2 rojos de gálibo) ─────────────────
	var mat_blanco := StandardMaterial3D.new()
	mat_blanco.albedo_color = COL_HEADLIGHT
	mat_blanco.emission_enabled = true
	mat_blanco.emission = COL_HEADLIGHT
	mat_blanco.emission_energy_multiplier = 2.0
	_caja_mat(Vector3(0.32, 0.2, 0.05), Vector3(-0.65, 1.0, 4.53), mat_blanco)
	_caja_mat(Vector3(0.32, 0.2, 0.05), Vector3(0.65, 1.0, 4.53), mat_blanco)

	var mat_rojo := StandardMaterial3D.new()
	mat_rojo.albedo_color = COL_MARKER
	mat_rojo.emission_enabled = true
	mat_rojo.emission = COL_MARKER
	mat_rojo.emission_energy_multiplier = 1.2
	_caja_mat(Vector3(0.15, 0.1, 0.05), Vector3(-0.85, 1.55, 4.53), mat_rojo)
	_caja_mat(Vector3(0.15, 0.1, 0.05), Vector3(0.85, 1.55, 4.53), mat_rojo)

	# ── Franjas laterales (azul corporativo + color de línea) ────────────
	for s in 2:
		var lado: float = -1.0 if s == 0 else 1.0
		_caja(Vector3(0.04, 0.12, 7.5), Vector3(lado * 1.01, 0.85, -0.25), COL_STRIPE_BLUE)
		_caja(Vector3(0.04, 0.18, 7.5), Vector3(lado * 1.01, 1.05, -0.25), color_linea)

	# ── Indicadores de puertas a lo largo del costado ────────────────────
	var puertas_z: Array[float] = [-2.5, -0.5, 1.5]
	for s in 2:
		var lado: float = -1.0 if s == 0 else 1.0
		for pz in puertas_z:
			_caja(Vector3(0.03, 1.8, 0.04), Vector3(lado * 1.01, 1.45, pz), COL_PUERTA)

	# ── Rombo rojo de Metro de Madrid en el costado de la cabina ─────────
	for s in 2:
		var lado: float = -1.0 if s == 0 else 1.0
		_caja(Vector3(0.04, 0.18, 0.18), Vector3(lado * 1.01, 1.85, 4.1), COL_ROMBO)


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
