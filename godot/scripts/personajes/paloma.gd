class_name Paloma
extends Area3D

# Fase B2 — La paloma jugable.
# Migra js/personajes/paloma.js + js/mecanica/input.js a un Area3D 3D.
#
# Diferencia clave con el JS: allí la paloma queda anclada al centro y el
# input mueve la CÁMARA (truco de la perspectiva 2.5D simulada). En 3D real
# se mueve la paloma y la cámara queda fija — es lo que pide la fase B2.
# Se conservan los números de feel del JS: VELOCIDAD_MAX 6, suavizado 0.15.
#
# Colisión: este Area3D detecta los Area3D del grupo "obstaculos" mediante
# la señal area_entered. Sistema de vidas como en colisiones.js (_triggerHit).

signal murio

@export var vidas_iniciales: int = 3

# ── Movimiento (feel portado de paloma.js) ───────────────────────────────
const VELOCIDAD_MAX: float = 6.0      # MAX_VELOCITY
const SUAVIZADO: float = 0.15         # EASING (lerp por frame a 60 fps)
const BANCO_MAX: float = 0.3          # inclinación al virar (tilt * 0.3)

# ── Límites de vuelo dentro del bore del túnel (media elipse 8.6 × 4.2) ──
# El techo elíptico baja hacia los lados: LIMITE_Y_MAX deja a la paloma por
# debajo de la bóveda incluso con |X| máximo.
const LIMITE_X: float = 2.3
const LIMITE_Y_MIN: float = 0.7
const LIMITE_Y_MAX: float = 2.9
const POS_INICIAL: Vector3 = Vector3(0.0, 2.0, -7.0)

# ── Aleteo e invencibilidad ──────────────────────────────────────────────
const ALETEO_FREC: float = 11.0
const ALETEO_AMPLITUD: float = 0.5
const INVENCIBLE_SEG: float = 1.0     # ventana tras un golpe no mortal

# ── Paleta — PAL_PALOMA de paloma.js ─────────────────────────────────────
const COL_CUERPO := Color("#8899aa")
const COL_VIENTRE := Color("#ccccdd")
const COL_PICO := Color("#d4a855")
const COL_COLLAR := Color("#66ccee")
const COL_OJO := Color("#1a1a2a")
const COL_COLA := Color("#445566")
const COL_ALA := Color("#556677")

var _vel: Vector2 = Vector2.ZERO
var _vidas: int = 0
var _vivo: bool = true
var _invencible: float = 0.0
var _parpadeo: float = 0.0
var _tiempo: float = 0.0
var _modelo: Node3D
var _ala_izq: Node3D
var _ala_der: Node3D


func _ready() -> void:
	_vidas = vidas_iniciales
	_construir_modelo()
	_construir_colision()
	position = POS_INICIAL
	area_entered.connect(_on_area_entered)


func _process(delta: float) -> void:
	# El mundo 3D sólo es jugable en la fase PLAYING.
	if GameState.current_phase != GameState.Phase.PLAYING:
		return
	if not _vivo:
		return
	_tiempo += delta
	_aletear()
	_mover(delta)
	if _invencible > 0.0:
		_invencible -= delta
		_parpadeo += delta
		_modelo.visible = fmod(_parpadeo, 0.18) < 0.09
		if _invencible <= 0.0:
			_modelo.visible = true


# ── Movimiento ───────────────────────────────────────────────────────────
func _mover(delta: float) -> void:
	var eje := Vector2(
		Input.get_axis("ui_left", "ui_right"),
		Input.get_axis("ui_down", "ui_up"))
	var objetivo := eje * VELOCIDAD_MAX
	# Lerp hacia la velocidad objetivo, equivalente al EASING por frame del JS
	# pero independiente de framerate.
	var t := 1.0 - pow(1.0 - SUAVIZADO, delta * 60.0)
	_vel = _vel.lerp(objetivo, t)

	var p := position
	p.x = clampf(p.x + _vel.x * delta, -LIMITE_X, LIMITE_X)
	p.y = clampf(p.y + _vel.y * delta, LIMITE_Y_MIN, LIMITE_Y_MAX)
	position = p

	# Inclinación visual al virar (pigeon.tilt en paloma.js).
	_modelo.rotation.z = -_vel.x / VELOCIDAD_MAX * BANCO_MAX


func _aletear() -> void:
	var fase := sin(_tiempo * ALETEO_FREC) * ALETEO_AMPLITUD
	_ala_izq.rotation.z = -fase
	_ala_der.rotation.z = fase


# ── Colisión ─────────────────────────────────────────────────────────────
func _on_area_entered(area: Area3D) -> void:
	if not _vivo or _invencible > 0.0:
		return
	if GameState.current_phase != GameState.Phase.PLAYING:
		return
	if not area.is_in_group("obstaculos"):
		return
	_vidas -= 1
	if _vidas <= 0:
		_vivo = false
		_modelo.visible = true
		print("[Paloma] Sin vidas — muerte.")
		murio.emit()
	else:
		_invencible = INVENCIBLE_SEG
		_parpadeo = 0.0
		print("[Paloma] Golpe. Vidas restantes: %d" % _vidas)


# Restaura la paloma al estado inicial (lo llama el orquestador al respawnear).
func reiniciar() -> void:
	_vidas = vidas_iniciales
	_vel = Vector2.ZERO
	position = POS_INICIAL
	_invencible = 0.0
	_parpadeo = 0.0
	_vivo = true
	if _modelo:
		_modelo.visible = true
		_modelo.rotation.z = 0.0


# ── Construcción del modelo (cajas procedurales, vista de espaldas) ──────
func _construir_modelo() -> void:
	_modelo = Node3D.new()
	_modelo.name = "Modelo"
	add_child(_modelo)

	# La paloma mira hacia -Z (vuela alejándose de la cámara).
	_caja(_modelo, Vector3(0.62, 0.54, 0.92), Vector3(0.0, 0.0, 0.05), COL_CUERPO)
	_caja(_modelo, Vector3(0.5, 0.22, 0.62), Vector3(0.0, -0.2, 0.05), COL_VIENTRE)
	_caja(_modelo, Vector3(0.46, 0.12, 0.3), Vector3(0.0, 0.12, -0.32), COL_COLLAR)
	_caja(_modelo, Vector3(0.42, 0.4, 0.4), Vector3(0.0, 0.28, -0.5), COL_CUERPO)
	_caja(_modelo, Vector3(0.12, 0.1, 0.2), Vector3(0.0, 0.24, -0.74), COL_PICO)
	_caja(_modelo, Vector3(0.07, 0.07, 0.07), Vector3(-0.13, 0.34, -0.66), COL_OJO)
	_caja(_modelo, Vector3(0.07, 0.07, 0.07), Vector3(0.13, 0.34, -0.66), COL_OJO)
	_caja(_modelo, Vector3(0.5, 0.1, 0.5), Vector3(0.0, 0.08, 0.62), COL_COLA)

	# Alas: un pivote a cada lado del cuerpo; la malla del ala cuelga hacia
	# fuera para que al rotar el pivote en Z el ala aletee arriba/abajo.
	_ala_izq = Node3D.new()
	_ala_izq.name = "PivoteAlaIzq"
	_ala_izq.position = Vector3(-0.3, 0.12, 0.05)
	_modelo.add_child(_ala_izq)
	_caja(_ala_izq, Vector3(0.66, 0.1, 0.6), Vector3(-0.36, 0.0, 0.0), COL_ALA)

	_ala_der = Node3D.new()
	_ala_der.name = "PivoteAlaDer"
	_ala_der.position = Vector3(0.3, 0.12, 0.05)
	_modelo.add_child(_ala_der)
	_caja(_ala_der, Vector3(0.66, 0.1, 0.6), Vector3(0.36, 0.0, 0.0), COL_ALA)


func _construir_colision() -> void:
	var cs := CollisionShape3D.new()
	var shape := BoxShape3D.new()
	# Hitbox más pequeña que el modelo (sin alas), generosa con el jugador
	# como el PIGEON_HITBOX de colisiones.js.
	shape.size = Vector3(0.75, 0.55, 0.95)
	cs.shape = shape
	cs.position = Vector3(0.0, 0.0, 0.05)
	add_child(cs)


func _caja(parent: Node3D, size: Vector3, pos: Vector3, color: Color) -> void:
	var mesh := BoxMesh.new()
	mesh.size = size
	var mat := StandardMaterial3D.new()
	mat.albedo_color = color
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.material_override = mat
	mi.position = pos
	parent.add_child(mi)
