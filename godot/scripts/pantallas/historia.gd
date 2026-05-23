extends Control

# Pantalla MODO HISTORIA (fase HISTORY).
# Placeholder migrado de js/pantallas/historia.js — 2 tarjetas centradas
# con candado y label "Próximamente". Sin navegación. ESC vuelve a START.

const CAPITULOS: Array[Dictionary] = [
	{"id": "cap1", "name": "CAPÍTULO 1", "label": "Próximamente"},
	{"id": "cap2", "name": "CAPÍTULO 2", "label": "Próximamente"},
]

# Paleta — coherente con resto de pantallas.
const COLOR_BG := Color("#0d0d1a")
const COLOR_TRAIN_YELLOW := Color("#f5c518")
const COLOR_HUD := Color("#ffffff")
const COLOR_HINT := Color("#888888")
const COLOR_CARD_BG := Color("#0a0a14")
const COLOR_CARD_BORDER := Color("#333333")
const COLOR_PADLOCK := Color("#666666")
const COLOR_PADLOCK_DARK := Color("#222222")
const COLOR_LOCKED_TEXT := Color("#666666")
const COLOR_LOCKED_SUB := Color("#555555")
const COLOR_SCANLINE := Color(1, 1, 1, 0.05)

const CARD_W: float = 200.0
const CARD_H: float = 130.0
const CARD_GAP: float = 30.0

var _font: Font
var _frame: int = 0


func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	_font = ThemeDB.fallback_font


func _process(_delta: float) -> void:
	if not visible:
		return
	_frame += 1
	if _frame % 40 == 0:
		queue_redraw()


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
	var titulo: String = "MODO HISTORIA"
	var t_size: Vector2 = _font.get_string_size(titulo,
			HORIZONTAL_ALIGNMENT_LEFT, -1, 28)
	draw_string(_font, Vector2((w - t_size.x) / 2.0, 80.0), titulo,
			HORIZONTAL_ALIGNMENT_LEFT, -1, 28, COLOR_TRAIN_YELLOW)

	# Subtítulo
	var sub: String = "ELIGE CAPÍTULO"
	var s_size: Vector2 = _font.get_string_size(sub,
			HORIZONTAL_ALIGNMENT_LEFT, -1, 12)
	draw_string(_font, Vector2((w - s_size.x) / 2.0, 108.0), sub,
			HORIZONTAL_ALIGNMENT_LEFT, -1, 12, COLOR_HINT)

	# Tarjetas centradas horizontalmente
	var total_w: float = CARD_W * CAPITULOS.size() + CARD_GAP * (CAPITULOS.size() - 1)
	var start_x: float = (w - total_w) / 2.0
	var card_y: float = h / 2.0 - CARD_H / 2.0

	for i in CAPITULOS.size():
		var x: float = start_x + float(i) * (CARD_W + CARD_GAP)
		var cap: Dictionary = CAPITULOS[i]

		draw_rect(Rect2(x, card_y, CARD_W, CARD_H), COLOR_CARD_BG)
		draw_rect(Rect2(x, card_y, CARD_W, CARD_H), COLOR_CARD_BORDER, false, 1.0)

		# Candado pixel-art centrado-arriba
		_dibujar_candado(x + CARD_W / 2.0, card_y + CARD_H / 2.0 - 10.0)

		# Nombre del capítulo (gris bloqueado)
		var nombre: String = cap.name
		var n_size: Vector2 = _font.get_string_size(nombre,
				HORIZONTAL_ALIGNMENT_LEFT, -1, 13)
		draw_string(_font, Vector2(x + (CARD_W - n_size.x) / 2.0,
				card_y + CARD_H - 28.0), nombre,
				HORIZONTAL_ALIGNMENT_LEFT, -1, 13, COLOR_LOCKED_TEXT)

		# Label
		var label: String = cap.label
		var l_size: Vector2 = _font.get_string_size(label,
				HORIZONTAL_ALIGNMENT_LEFT, -1, 10)
		draw_string(_font, Vector2(x + (CARD_W - l_size.x) / 2.0,
				card_y + CARD_H - 12.0), label,
				HORIZONTAL_ALIGNMENT_LEFT, -1, 10, COLOR_LOCKED_SUB)

	# Hint inferior parpadeante
	if int(_frame / 40) % 2 == 0:
		var hint: String = "ESC VOLVER"
		var hint_size: Vector2 = _font.get_string_size(hint,
				HORIZONTAL_ALIGNMENT_LEFT, -1, 11)
		draw_string(_font, Vector2((w - hint_size.x) / 2.0, h - 30.0), hint,
				HORIZONTAL_ALIGNMENT_LEFT, -1, 11, COLOR_HINT)


# Candado pixel-art compuesto por rectángulos — calco del JS drawPadlock.
func _dibujar_candado(cx: float, cy: float) -> void:
	# Arco del candado
	draw_rect(Rect2(cx - 3.0, cy - 6.0, 6.0, 2.0), COLOR_PADLOCK)
	draw_rect(Rect2(cx - 4.0, cy - 5.0, 1.0, 4.0), COLOR_PADLOCK)
	draw_rect(Rect2(cx + 3.0, cy - 5.0, 1.0, 4.0), COLOR_PADLOCK)
	# Cuerpo
	draw_rect(Rect2(cx - 5.0, cy - 1.0, 10.0, 7.0), COLOR_PADLOCK)
	# Ojo de cerradura
	draw_rect(Rect2(cx - 1.0, cy + 1.0, 2.0, 3.0), COLOR_PADLOCK_DARK)
