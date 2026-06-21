extends Control

# Pantalla de selección de personaje (fase CHARACTER).
# Equivalente al menú PERSONAJE de inicio.js: 3 slots horizontales con
# preview pixel-art, navegación con flechas izquierda/derecha + ratón,
# ENTER/clic confirma y vuelve al menú principal.
# La selección se persiste vía GameState.set_personaje().

const PERSONAJES: Array[Dictionary] = [
	{
		"id": "paloma",
		"nombre": "PALOMA",
		"sub": "el clásico",
		"body": Color("#8899aa"),
		"belly": Color("#ccccdd"),
		"accent": Color("#66ccee"),
		"beak": Color("#d4a855"),
	},
	{
		"id": "pidgey",
		"nombre": "PIDGEY",
		"sub": "Pokémon #016",
		"body": Color("#c8a040"),
		"belly": Color("#eeeecc"),
		"accent": Color("#885522"),
		"beak": Color("#885522"),
	},
	{
		"id": "red",
		"nombre": "RED",
		"sub": "Angry Bird",
		"body": Color("#e02020"),
		"belly": Color("#e02020"),
		"accent": Color("#991010"),
		"beak": Color("#ffaa00"),
	},
]

# Paleta — coherente con inicio.gd.
const COLOR_BG := Color("#0d0d1a")
const COLOR_TRAIN_YELLOW := Color("#f5c518")
const COLOR_CONCRETE := Color("#2a2a3a")
const COLOR_HUD := Color("#ffffff")
const COLOR_HINT := Color("#888888")
const COLOR_SCANLINE := Color(1, 1, 1, 0.05)
const COLOR_CARD_BG := Color("#111111")
const COLOR_CARD_BG_SEL := Color(0.96, 0.77, 0.09, 0.08)
const COLOR_PREVIEW_BG := Color("#0a0a14")

const CARD_W: float = 200.0
const CARD_H: float = 280.0
const CARD_GAP: float = 30.0
const CARD_Y: float = 180.0

var _frame: int = 0
var _font: Font
var _cursor: int = 0
var _hover_index: int = -1


func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	_font = ThemeDB.fallback_font
	_cursor = clampi(GameState.selected_character_idx, 0, PERSONAJES.size() - 1)


func _process(_delta: float) -> void:
	if not visible:
		return
	_frame += 1
	var prev_hover: int = _hover_index
	_hover_index = _card_at(get_local_mouse_position())
	if _hover_index != prev_hover:
		if _hover_index != -1:
			_cursor = _hover_index
		queue_redraw()
	if _frame % 40 == 0:
		queue_redraw()


func _input(event: InputEvent) -> void:
	# Comprobar la fase, no `visible` — los Control dentro de CanvasLayer no
	# heredan la visibilidad del layer (ver gameover.gd para más detalle).
	if GameState.current_phase != GameState.Phase.CHARACTER:
		return

	if event.is_action_pressed("ui_left"):
		_cursor = maxi(0, _cursor - 1)
		queue_redraw()
	elif event.is_action_pressed("ui_right"):
		_cursor = mini(PERSONAJES.size() - 1, _cursor + 1)
		queue_redraw()
	elif event.is_action_pressed("ui_accept"):
		_confirmar(_cursor)
	elif event is InputEventMouseButton:
		var mb: InputEventMouseButton = event
		if mb.pressed and mb.button_index == MOUSE_BUTTON_LEFT and _hover_index != -1:
			_confirmar(_hover_index)


func _confirmar(idx: int) -> void:
	GameState.set_personaje(idx)
	GameState.change_phase(GameState.Phase.START)


func _row_x() -> float:
	# Centrar el bloque de 3 tarjetas horizontalmente.
	var total: float = CARD_W * PERSONAJES.size() + CARD_GAP * (PERSONAJES.size() - 1)
	return (size.x - total) / 2.0


func _card_at(pos: Vector2) -> int:
	var x: float = _row_x()
	for i in PERSONAJES.size():
		if Rect2(x, CARD_Y, CARD_W, CARD_H).has_point(pos):
			return i
		x += CARD_W + CARD_GAP
	return -1


func _draw() -> void:
	var w: float = size.x
	var h: float = size.y

	draw_rect(Rect2(0, 0, w, h), COLOR_BG)

	# Scanlines
	var y_scan: float = 0.0
	while y_scan < h:
		draw_rect(Rect2(0, y_scan, w, 1), COLOR_SCANLINE)
		y_scan += 4.0

	# Título
	draw_string(_font, Vector2(60, 90), "ELIGE",
		HORIZONTAL_ALIGNMENT_LEFT, -1, 52, COLOR_TRAIN_YELLOW)
	draw_string(_font, Vector2(60, 142), "PERSONAJE",
		HORIZONTAL_ALIGNMENT_LEFT, -1, 32, COLOR_HUD)

	# Tarjetas
	var x: float = _row_x()
	for i in PERSONAJES.size():
		var activo: bool = i == _cursor
		var es_actual: bool = i == GameState.selected_character_idx
		var bg: Color = COLOR_CARD_BG_SEL if activo else COLOR_CARD_BG
		var border: Color = COLOR_TRAIN_YELLOW if activo else COLOR_CONCRETE
		var border_w: float = 2.0 if activo else 1.0

		draw_rect(Rect2(x, CARD_Y, CARD_W, CARD_H), bg)
		draw_rect(Rect2(x, CARD_Y, CARD_W, CARD_H), border, false, border_w)

		# Preview area (cuadrado superior)
		var preview: Rect2 = Rect2(x + 20, CARD_Y + 20, CARD_W - 40, 160)
		draw_rect(preview, COLOR_PREVIEW_BG)
		_dibujar_pajaro(preview, PERSONAJES[i])

		# Nombre
		var nombre: String = PERSONAJES[i].nombre
		var text_col: Color = COLOR_TRAIN_YELLOW if activo else COLOR_HUD
		draw_string(_font, Vector2(x + 20, CARD_Y + 210),
			nombre, HORIZONTAL_ALIGNMENT_LEFT, -1, 20, text_col)

		# Subtítulo
		draw_string(_font, Vector2(x + 20, CARD_Y + 232),
			PERSONAJES[i].sub, HORIZONTAL_ALIGNMENT_LEFT, -1, 11, COLOR_HINT)

		# Etiqueta "ACTIVO" para el que está guardado en GameState
		if es_actual:
			draw_string(_font, Vector2(x + CARD_W - 70, CARD_Y + 232),
				"· ACTIVO", HORIZONTAL_ALIGNMENT_LEFT, -1, 11, COLOR_TRAIN_YELLOW)

		x += CARD_W + CARD_GAP

	# Hint inferior parpadeante
	if int(_frame / 40) % 2 == 0:
		draw_string(_font, Vector2(60, h - 30),
			"LEFT/RIGHT o RATON   ENTER o CLIC SELECCIONAR   ESC VOLVER",
			HORIZONTAL_ALIGNMENT_LEFT, -1, 11, COLOR_HINT)


# Pajarito pixel-art compuesto por rectángulos — paleta variable por personaje.
# Reproduce vagamente el sprite procedural del modelo 3D vito frontalmente.
func _dibujar_pajaro(rect: Rect2, p: Dictionary) -> void:
	var cx: float = rect.position.x + rect.size.x / 2.0
	var cy: float = rect.position.y + rect.size.y / 2.0
	var u: float = 8.0  # tamaño de un "píxel" del sprite

	var body: Color = p.body
	var belly: Color = p.belly
	var accent: Color = p.accent
	var beak: Color = p.beak

	# Cuerpo central
	draw_rect(Rect2(cx - u * 3.0, cy - u * 1.0, u * 6.0, u * 4.0), body)
	# Vientre
	draw_rect(Rect2(cx - u * 2.0, cy + u * 1.0, u * 4.0, u * 2.0), belly)
	# Cabeza
	draw_rect(Rect2(cx - u * 2.0, cy - u * 3.5, u * 4.0, u * 2.5), body)
	# Cresta/pico-accent (3 plumas)
	draw_rect(Rect2(cx - u * 1.5, cy - u * 4.5, u * 1.0, u * 1.0), accent)
	draw_rect(Rect2(cx - u * 0.5, cy - u * 5.0, u * 1.0, u * 1.5), accent)
	draw_rect(Rect2(cx + u * 0.5, cy - u * 4.5, u * 1.0, u * 1.0), accent)
	# Ojos
	draw_rect(Rect2(cx - u * 1.5, cy - u * 2.5, u * 0.5, u * 0.5), Color("#1a1a2a"))
	draw_rect(Rect2(cx + u * 1.0, cy - u * 2.5, u * 0.5, u * 0.5), Color("#1a1a2a"))
	# Pico
	draw_rect(Rect2(cx - u * 0.5, cy - u * 1.5, u * 1.0, u * 0.5), beak)
	# Alas (dos lados)
	draw_rect(Rect2(cx - u * 4.0, cy - u * 0.5, u * 1.0, u * 3.0), accent)
	draw_rect(Rect2(cx + u * 3.0, cy - u * 0.5, u * 1.0, u * 3.0), accent)
	# Patas
	draw_rect(Rect2(cx - u * 1.0, cy + u * 3.0, u * 0.5, u * 1.0), beak)
	draw_rect(Rect2(cx + u * 0.5, cy + u * 3.0, u * 0.5, u * 1.0), beak)
