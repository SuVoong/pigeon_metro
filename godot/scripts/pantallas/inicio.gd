extends Control

# Pantalla de inicio — equivalente a js/pantallas/inicio.js.
# Conserva el mismo layout: título "VIAJE PALOMERO", 4 botones de menú,
# scanlines, engranaje en esquina, preview de personaje en esquina inferior,
# hint de controles parpadeante.

const MENU_ITEMS: Array[Dictionary] = [
	{"label": "MODO ARCADE",   "phase": "ARCADE"},
	{"label": "MODO HISTORIA", "phase": "HISTORY"},
	{"label": "PERSONAJE",     "phase": "CHARACTER"},
	{"label": "LOGROS",        "phase": "ACHIEVEMENTS"},
]

# Paleta — derivada de PAL en js/mecanica/estado.js.
const COLOR_BG := Color("#0d0d1a")
const COLOR_TRAIN_YELLOW := Color("#f5c518")
const COLOR_CONCRETE := Color("#2a2a3a")
const COLOR_HUD := Color("#ffffff")
const COLOR_HINT := Color("#888888")
const COLOR_SCANLINE := Color(1, 1, 1, 0.05)
const COLOR_ITEM_BG := Color("#111111")
const COLOR_ITEM_BG_SEL := Color(0.96, 0.77, 0.09, 0.08)
const COLOR_PREVIEW_BG := Color("#0a0a14")

const ITEM_Y_START: float = 200.0
const ITEM_W: float = 240.0
const ITEM_H: float = 40.0
const ITEM_GAP: float = 50.0

var _frame: int = 0
var _font: Font
var _hover_index: int = -1


func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	_font = ThemeDB.fallback_font


func _process(_delta: float) -> void:
	_frame += 1

	# Hover del ratón: calcular sobre qué item está y sincronizar con
	# el cursor del menú para que teclado y ratón compartan selección.
	var prev_hover: int = _hover_index
	_hover_index = _item_at(get_local_mouse_position())
	if _hover_index != prev_hover:
		if _hover_index != -1:
			GameState.menu_cursor = _hover_index
		queue_redraw()

	# Redraw cada 40 frames para el blink del hint de controles.
	if _frame % 40 == 0:
		queue_redraw()


func _input(event: InputEvent) -> void:
	if not visible:
		return

	if event.is_action_pressed("ui_up"):
		GameState.menu_cursor = maxi(0, GameState.menu_cursor - 1)
		queue_redraw()
	elif event.is_action_pressed("ui_down"):
		GameState.menu_cursor = mini(MENU_ITEMS.size() - 1, GameState.menu_cursor + 1)
		queue_redraw()
	elif event.is_action_pressed("ui_accept"):
		_seleccionar(GameState.menu_cursor)
	elif event is InputEventMouseButton:
		var mb: InputEventMouseButton = event
		if mb.pressed and mb.button_index == MOUSE_BUTTON_LEFT and _hover_index != -1:
			_seleccionar(_hover_index)


func _seleccionar(idx: int) -> void:
	var item: Dictionary = MENU_ITEMS[idx]
	var phase_name: String = item.phase
	GameState.change_phase(GameState.Phase[phase_name])


func _item_x() -> float:
	# Centrar horizontalmente el bloque de botones.
	return (size.x - ITEM_W) / 2.0


func _item_at(pos: Vector2) -> int:
	var x_item: float = _item_x()
	for i in MENU_ITEMS.size():
		var y: float = ITEM_Y_START + i * ITEM_GAP
		if Rect2(x_item, y, ITEM_W, ITEM_H).has_point(pos):
			return i
	return -1


func _draw() -> void:
	var w: float = size.x
	var h: float = size.y

	# Fondo
	draw_rect(Rect2(0, 0, w, h), COLOR_BG)

	# Scanlines suaves cada 4px
	var y_scan: float = 0.0
	while y_scan < h:
		draw_rect(Rect2(0, y_scan, w, 1), COLOR_SCANLINE)
		y_scan += 4.0

	# Título: "VIAJE" / "PALOMERO" (52px, amarillo)
	draw_string(_font, Vector2(60, 90), "VIAJE",
		HORIZONTAL_ALIGNMENT_LEFT, -1, 52, COLOR_TRAIN_YELLOW)
	draw_string(_font, Vector2(60, 152), "PALOMERO",
		HORIZONTAL_ALIGNMENT_LEFT, -1, 52, COLOR_TRAIN_YELLOW)

	# Subtítulo
	draw_string(_font, Vector2(60, 172), "pixel metro adventure",
		HORIZONTAL_ALIGNMENT_LEFT, -1, 13, COLOR_HINT)

	# Engranaje (esquina superior derecha)
	_draw_gear(w - 44.0 + 7.0, 28.0 + 7.0, COLOR_HINT)

	# Items del menú — centrados horizontalmente
	var x_item: float = _item_x()
	for i in MENU_ITEMS.size():
		var y: float = ITEM_Y_START + i * ITEM_GAP
		# "Activo" = seleccionado por teclado o con hover de ratón (ambos sincronizados).
		var activo: bool = i == GameState.menu_cursor
		var bg: Color = COLOR_ITEM_BG_SEL if activo else COLOR_ITEM_BG
		var border: Color = COLOR_TRAIN_YELLOW if activo else COLOR_CONCRETE
		var border_w: float = 2.0 if activo else 1.0
		var text_col: Color = COLOR_TRAIN_YELLOW if activo else COLOR_HUD

		draw_rect(Rect2(x_item, y, ITEM_W, ITEM_H), bg)
		draw_rect(Rect2(x_item, y, ITEM_W, ITEM_H), border, false, border_w)
		draw_string(_font, Vector2(x_item + 20, y + ITEM_H * 0.65),
			MENU_ITEMS[i].label, HORIZONTAL_ALIGNMENT_LEFT, -1, 14, text_col)

		if activo:
			_draw_arrow(x_item - 14.0, y + ITEM_H / 2.0 - 3.0)

	# Preview de personaje (esquina inferior derecha)
	var preview_cx: float = w - 150.0
	var preview_y: float = h - 170.0
	var box: float = 120.0

	draw_string(_font, Vector2(preview_cx - 36, preview_y - 8),
		"PERSONAJE", HORIZONTAL_ALIGNMENT_LEFT, -1, 10, COLOR_HINT)
	draw_rect(Rect2(preview_cx - box / 2.0, preview_y, box, box), COLOR_PREVIEW_BG)
	draw_rect(Rect2(preview_cx - box / 2.0, preview_y, box, box),
		COLOR_TRAIN_YELLOW, false, 1.5)
	# Placeholder hasta B9 (personajes): texto centrado.
	draw_string(_font, Vector2(preview_cx - 28, preview_y + box / 2.0 + 4),
		"PALOMA", HORIZONTAL_ALIGNMENT_LEFT, -1, 14, COLOR_HUD)
	draw_string(_font, Vector2(preview_cx - 28, preview_y + box + 18),
		"PALOMA", HORIZONTAL_ALIGNMENT_LEFT, -1, 13, COLOR_TRAIN_YELLOW)

	# Hint de controles parpadeante (esquina inferior izquierda)
	if int(_frame / 40) % 2 == 0:
		draw_string(_font, Vector2(60, h - 30),
			"UP/DOWN o RATON   ENTER o CLIC SELECCIONAR",
			HORIZONTAL_ALIGNMENT_LEFT, -1, 11, COLOR_HINT)


func _draw_gear(cx: float, cy: float, color: Color) -> void:
	# Centro 6x6
	draw_rect(Rect2(cx - 3, cy - 3, 6, 6), color)
	# 8 dientes 2x2 (N, NE, E, SE, S, SW, W, NW)
	draw_rect(Rect2(cx - 1, cy - 7, 2, 2), color)
	draw_rect(Rect2(cx + 4, cy - 6, 2, 2), color)
	draw_rect(Rect2(cx + 5, cy - 1, 2, 2), color)
	draw_rect(Rect2(cx + 4, cy + 4, 2, 2), color)
	draw_rect(Rect2(cx - 1, cy + 5, 2, 2), color)
	draw_rect(Rect2(cx - 6, cy + 4, 2, 2), color)
	draw_rect(Rect2(cx - 7, cy - 1, 2, 2), color)
	draw_rect(Rect2(cx - 6, cy - 6, 2, 2), color)


func _draw_arrow(x: float, y: float) -> void:
	# Triángulo pixelado apuntando a la derecha (▶), 6x6
	draw_rect(Rect2(x, y, 2, 6), COLOR_TRAIN_YELLOW)
	draw_rect(Rect2(x + 2, y + 1, 2, 4), COLOR_TRAIN_YELLOW)
	draw_rect(Rect2(x + 4, y + 2, 2, 2), COLOR_TRAIN_YELLOW)
