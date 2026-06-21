extends Paloma

# Red (Angry Bird) — variante visual de Paloma con la apariencia del
# personaje Red. Migra el sprite 2.5D de js/personajes/angry_bird.js a un
# modelo procedural 3D: cuerpo casi esférico rojo (cabeza y torso fundidos),
# crestón GRANDE de 3 plumas puntiagudas, cejas oscuras, alas pequeñas
# tipo muñón, patas naranjas cortas.
#
# Comparte toda la física, vidas y colisión con Paloma — solo sobreescribe
# _construir_modelo.

# ── Paleta — PAL_RED de angry_bird.js ────────────────────────────────────
const COL_BODY := Color("#e02020")
const COL_BODY_BRIGHT := Color("#ff3a3a")
const COL_BODY_LIGHT := Color("#ff5540")
const COL_BODY_DARK := Color("#b80e0e")
const COL_CRESTA_R := Color("#991010")
const COL_CRESTA_LIGHT := Color("#ee3030")
const COL_BROW := Color("#3a1a0a")
const COL_WING := Color("#cc1818")
const COL_WING_TIP := Color("#8b0e0e")
const COL_TAIL := Color("#bb1414")
const COL_LEG := Color("#ffaa00")
const COL_OJO_R := Color("#1a1a2a")


func _construir_modelo() -> void:
	_modelo = Node3D.new()
	_modelo.name = "Modelo"
	add_child(_modelo)

	# Cuerpo casi esférico (cabeza y torso fundidos en una sola masa roja)
	_caja(_modelo, Vector3(0.85, 0.78, 0.92), Vector3(0.0, 0.05, 0.0), COL_BODY)
	# Highlight superior del lomo (zona iluminada)
	_caja(_modelo, Vector3(0.62, 0.4, 0.62), Vector3(0.0, 0.18, -0.05), COL_BODY_BRIGHT)
	# Highlight más claro (centro del lomo)
	_caja(_modelo, Vector3(0.42, 0.2, 0.4), Vector3(0.0, 0.3, -0.1), COL_BODY_LIGHT)
	# Sombras laterales — dan sensación esférica
	_caja(_modelo, Vector3(0.08, 0.62, 0.7), Vector3(-0.43, 0.0, 0.0), COL_BODY_DARK)
	_caja(_modelo, Vector3(0.08, 0.62, 0.7), Vector3(0.43, 0.0, 0.0), COL_BODY_DARK)
	# Cejas oscuras (apenas atisbadas desde atrás en los flancos)
	_caja(_modelo, Vector3(0.18, 0.05, 0.06), Vector3(-0.36, 0.32, -0.42), COL_BROW)
	_caja(_modelo, Vector3(0.18, 0.05, 0.06), Vector3(0.36, 0.32, -0.42), COL_BROW)
	# Pico pequeño naranja
	_caja(_modelo, Vector3(0.16, 0.12, 0.18), Vector3(0.0, 0.1, -0.52), COL_LEG)
	# Ojos oscuros
	_caja(_modelo, Vector3(0.07, 0.07, 0.07), Vector3(-0.15, 0.22, -0.46), COL_OJO_R)
	_caja(_modelo, Vector3(0.07, 0.07, 0.07), Vector3(0.15, 0.22, -0.46), COL_OJO_R)
	# Crestón GRANDE de 3 plumas puntiagudas — firma de Red
	_caja(_modelo, Vector3(0.1, 0.36, 0.08), Vector3(-0.15, 0.62, -0.18), COL_CRESTA_R)
	_caja(_modelo, Vector3(0.1, 0.5, 0.08), Vector3(0.0, 0.7, -0.18), COL_CRESTA_R)
	_caja(_modelo, Vector3(0.1, 0.36, 0.08), Vector3(0.15, 0.62, -0.18), COL_CRESTA_R)
	# Highlight en la cresta central
	_caja(_modelo, Vector3(0.06, 0.18, 0.05), Vector3(0.0, 0.55, -0.18), COL_CRESTA_LIGHT)
	# Cola compacta
	_caja(_modelo, Vector3(0.5, 0.16, 0.4), Vector3(0.0, 0.08, 0.5), COL_TAIL)
	# Patas cortas naranjas
	_caja(_modelo, Vector3(0.08, 0.18, 0.08), Vector3(-0.12, -0.45, 0.2), COL_LEG)
	_caja(_modelo, Vector3(0.08, 0.18, 0.08), Vector3(0.12, -0.45, 0.2), COL_LEG)

	# Alas pequeñas tipo muñón (Angry Birds no tiene alas grandes)
	_ala_izq = Node3D.new()
	_ala_izq.name = "PivoteAlaIzq"
	_ala_izq.position = Vector3(-0.4, 0.1, 0.1)
	_modelo.add_child(_ala_izq)
	_caja(_ala_izq, Vector3(0.4, 0.18, 0.35), Vector3(-0.22, 0.0, 0.0), COL_WING)
	_caja(_ala_izq, Vector3(0.4, 0.06, 0.1), Vector3(-0.22, -0.1, 0.12), COL_WING_TIP)

	_ala_der = Node3D.new()
	_ala_der.name = "PivoteAlaDer"
	_ala_der.position = Vector3(0.4, 0.1, 0.1)
	_modelo.add_child(_ala_der)
	_caja(_ala_der, Vector3(0.4, 0.18, 0.35), Vector3(0.22, 0.0, 0.0), COL_WING)
	_caja(_ala_der, Vector3(0.4, 0.06, 0.1), Vector3(0.22, -0.1, 0.12), COL_WING_TIP)
