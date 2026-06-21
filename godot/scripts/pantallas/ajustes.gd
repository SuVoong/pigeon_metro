extends Control

# Pantalla AJUSTES (fase SETTINGS).
# Placeholder visual hasta B12 (Audio). Migra el concepto de
# js/pantallas/ajustes.js — título + "Próximamente" + 3 sliders deshabilitados
# para anclar la futura UI de mezcla. ESC vuelve a START.
# Se descarta el botón MODO EDICIÓN del JS: en Godot el editor es el propio
# Godot.

const BUSES: Array[Dictionary] = [
	{"label": "MASTER",  "valor": 0.85},
	{"label": "EFECTOS", "valor": 0.70},
	{"label": "MÚSICA",  "valor": 0.60},
]

# Paleta
const COLOR_BG := Color("#0d0d1a")
const COLOR_TRAIN_YELLOW := Color("#f5c518")
const COLOR_HUD := Color("#ffffff")
const COLOR_HINT := Color("#888888")
const COLOR_SLIDER_BG := Color("#111125")
const COLOR_SLIDER_FILL := Color("#33333a")
const COLOR_SLIDER_BORDER := Color("#2a2a3a")
const COLOR_SLIDER_LABEL := Color("#555555")
const COLOR_SLIDER_VAL := Color("#444444")
const COLOR_SCANLINE := Color(1, 1, 1, 0.05)
const COLOR_PROXIMAMENTE := Color("#888888")

const SLIDER_W: float = 360.0
const SLIDER_H: float = 8.0
const SLIDER_GAP: float = 56.0
const SLIDER_Y_START: float = 220.0

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
	var titulo: String = "AJUSTES"
	var t_size: Vector2 = _font.get_string_size(titulo,
			HORIZONTAL_ALIGNMENT_LEFT, -1, 28)
	draw_string(_font, Vector2((w - t_size.x) / 2.0, 80.0), titulo,
			HORIZONTAL_ALIGNMENT_LEFT, -1, 28, COLOR_TRAIN_YELLOW)

	# Cabecera de la sección de audio
	var subt: String = "AUDIO"
	var s_size: Vector2 = _font.get_string_size(subt,
			HORIZONTAL_ALIGNMENT_LEFT, -1, 12)
	draw_string(_font, Vector2((w - s_size.x) / 2.0, 162.0), subt,
			HORIZONTAL_ALIGNMENT_LEFT, -1, 12, COLOR_HUD)

	var sub2: String = "Próximamente"
	var s2_size: Vector2 = _font.get_string_size(sub2,
			HORIZONTAL_ALIGNMENT_LEFT, -1, 11)
	draw_string(_font, Vector2((w - s2_size.x) / 2.0, 184.0), sub2,
			HORIZONTAL_ALIGNMENT_LEFT, -1, 11, COLOR_PROXIMAMENTE)

	# Sliders deshabilitados (anclaje visual para B12)
	var slider_x: float = (w - SLIDER_W) / 2.0
	for i in BUSES.size():
		var y: float = SLIDER_Y_START + float(i) * SLIDER_GAP
		_dibujar_slider(BUSES[i], slider_x, y)

	# Hint inferior parpadeante
	if int(_frame / 40) % 2 == 0:
		var hint: String = "ESC VOLVER"
		var hint_size: Vector2 = _font.get_string_size(hint,
				HORIZONTAL_ALIGNMENT_LEFT, -1, 11)
		draw_string(_font, Vector2((w - hint_size.x) / 2.0, h - 30.0), hint,
				HORIZONTAL_ALIGNMENT_LEFT, -1, 11, COLOR_HINT)


# Pinta un slider deshabilitado: etiqueta a la izquierda, barra con relleno
# proporcional al valor, knob, porcentaje a la derecha. Todo en grises.
func _dibujar_slider(bus: Dictionary, x: float, y: float) -> void:
	# Etiqueta
	draw_string(_font, Vector2(x, y - 6.0), String(bus.label),
			HORIZONTAL_ALIGNMENT_LEFT, -1, 11, COLOR_SLIDER_LABEL)

	# Pista
	var pista_y: float = y + 10.0
	draw_rect(Rect2(x, pista_y, SLIDER_W, SLIDER_H), COLOR_SLIDER_BG)
	draw_rect(Rect2(x, pista_y, SLIDER_W, SLIDER_H), COLOR_SLIDER_BORDER, false, 1.0)

	# Relleno proporcional al valor por defecto
	var fill_w: float = SLIDER_W * float(bus.valor)
	draw_rect(Rect2(x, pista_y, fill_w, SLIDER_H), COLOR_SLIDER_FILL)

	# Knob
	var knob_x: float = x + fill_w
	draw_rect(Rect2(knob_x - 3.0, pista_y - 3.0, 6.0, SLIDER_H + 6.0),
			COLOR_SLIDER_LABEL)

	# Porcentaje a la derecha
	var pct: String = "%d%%" % roundi(float(bus.valor) * 100.0)
	draw_string(_font, Vector2(x + SLIDER_W + 16.0, y + 16.0), pct,
			HORIZONTAL_ALIGNMENT_LEFT, -1, 11, COLOR_SLIDER_VAL)
