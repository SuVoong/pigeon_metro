extends Paloma

# Pidgey (Pokémon #016) — variante visual de Paloma con apariencia del
# pájaro normal de Kanto. Migra el sprite 2.5D de js/personajes/pidgey.js
# a un modelo procedural 3D: cabeza grande tan dorada con cresta de 3
# plumas marrones, cuerpo redondo con vientre crema, alas marrones con
# punta clara, cola con franja crema y patas naranjas.
#
# Comparte toda la física, vidas y colisión con Paloma — solo sobreescribe
# _construir_modelo.

# ── Paleta — PAL_PIDGEY de pidgey.js ─────────────────────────────────────
const COL_CRESTA := Color("#885522")
const COL_CABEZA := Color("#c8a040")
const COL_CABEZA_LIGHT := Color("#ddcc88")
const COL_CUERPO_PI := Color("#c8a040")
const COL_VIENTRE_PI := Color("#eeeecc")
const COL_ALA_PI := Color("#885522")
const COL_ALA_PUNTA := Color("#ddcc88")
const COL_COLA_PI := Color("#885522")
const COL_COLA_CREMA := Color("#ddcc88")
const COL_OJO_PI := Color("#1a1a2a")
const COL_PICO_PI := Color("#885522")


func _construir_modelo() -> void:
	_modelo = Node3D.new()
	_modelo.name = "Modelo"
	add_child(_modelo)

	# Cuerpo redondo tan dorado
	_caja(_modelo, Vector3(0.7, 0.62, 0.85), Vector3(0.0, 0.0, 0.05), COL_CUERPO_PI)
	# Vientre crema (más claro, en la zona inferior-delantera)
	_caja(_modelo, Vector3(0.55, 0.28, 0.6), Vector3(0.0, -0.2, 0.1), COL_VIENTRE_PI)
	# Cabeza grande (Pidgey tiene cabeza muy prominente)
	_caja(_modelo, Vector3(0.5, 0.46, 0.42), Vector3(0.0, 0.32, -0.5), COL_CABEZA)
	# Highlight superior de la cabeza
	_caja(_modelo, Vector3(0.42, 0.12, 0.32), Vector3(0.0, 0.5, -0.5), COL_CABEZA_LIGHT)
	# Pico pequeño marrón
	_caja(_modelo, Vector3(0.1, 0.08, 0.18), Vector3(0.0, 0.28, -0.72), COL_PICO_PI)
	# Cresta de 3 plumas pequeñas — la central más alta
	_caja(_modelo, Vector3(0.08, 0.18, 0.06), Vector3(-0.1, 0.62, -0.5), COL_CRESTA)
	_caja(_modelo, Vector3(0.08, 0.26, 0.06), Vector3(0.0, 0.66, -0.5), COL_CRESTA)
	_caja(_modelo, Vector3(0.08, 0.18, 0.06), Vector3(0.1, 0.62, -0.5), COL_CRESTA)
	# Ojos pequeños oscuros (apenas se ven desde atrás)
	_caja(_modelo, Vector3(0.06, 0.06, 0.06), Vector3(-0.15, 0.38, -0.66), COL_OJO_PI)
	_caja(_modelo, Vector3(0.06, 0.06, 0.06), Vector3(0.15, 0.38, -0.66), COL_OJO_PI)
	# Cola con franja crema central
	_caja(_modelo, Vector3(0.5, 0.12, 0.5), Vector3(0.0, 0.1, 0.55), COL_COLA_PI)
	_caja(_modelo, Vector3(0.3, 0.05, 0.4), Vector3(0.0, 0.16, 0.55), COL_COLA_CREMA)

	# Alas con pivote — marrones con punta clara
	_ala_izq = Node3D.new()
	_ala_izq.name = "PivoteAlaIzq"
	_ala_izq.position = Vector3(-0.3, 0.12, 0.05)
	_modelo.add_child(_ala_izq)
	_caja(_ala_izq, Vector3(0.7, 0.1, 0.55), Vector3(-0.38, 0.0, 0.0), COL_ALA_PI)
	_caja(_ala_izq, Vector3(0.7, 0.04, 0.14), Vector3(-0.38, -0.06, 0.16), COL_ALA_PUNTA)

	_ala_der = Node3D.new()
	_ala_der.name = "PivoteAlaDer"
	_ala_der.position = Vector3(0.3, 0.12, 0.05)
	_modelo.add_child(_ala_der)
	_caja(_ala_der, Vector3(0.7, 0.1, 0.55), Vector3(0.38, 0.0, 0.0), COL_ALA_PI)
	_caja(_ala_der, Vector3(0.7, 0.04, 0.14), Vector3(0.38, -0.06, 0.16), COL_ALA_PUNTA)
