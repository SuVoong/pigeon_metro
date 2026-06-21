extends Control

# Pantalla LOGROS (fase ACHIEVEMENTS).
# Migra el placeholder visual de js/pantallas/logros.js — lista los 6 logros
# de progreso.js::ACHIEVEMENTS. En esta iteración están TODOS bloqueados
# (B10 conectará la lógica de unlocks). ESC vuelve a START.

# Los 6 logros copiados de js/mecanica/progreso.js::ACHIEVEMENTS.
const LOGROS: Array[Dictionary] = [
	{
		"id": "FLYING_HIGH",
		"title": "Proeza Voladora",
		"desc": "Vuela más de 10 minutos en total",
		"icon": "🕊",
	},
	{
		"id": "FIRST_FLIGHT",
		"title": "Primer Vuelo",
		"desc": "Completa tu primer trayecto en el metro",
		"icon": "🌱",
	},
	{
		"id": "MARATHON_RUN",
		"title": "Maratón Urbano",
		"desc": "Sobrevive 5 minutos seguidos en una sola partida",
		"icon": "🏆",
	},
	{
		"id": "COMMUTER",
		"title": "Habitual del Metro",
		"desc": "Completa 10 trayectos diferentes",
		"icon": "🎫",
	},
	{
		"id": "LINE_END",
		"title": "De Terminal a Terminal",
		"desc": "Llega al final de una línea entera",
		"icon": "🏁",
	},
	{
		"id": "U_TURNER",
		"title": "Cambio de Sentido",
		"desc": "Da la vuelta al llegar a un terminal",
		"icon": "↩",
	},
]

# Paleta
const COLOR_BG := Color("#0d0d1a")
const COLOR_TRAIN_YELLOW := Color("#f5c518")
const COLOR_HUD := Color("#ffffff")
const COLOR_HINT := Color("#888888")
const COLOR_ROW_BG := Color("#0a0a14")
const COLOR_ROW_BORDER := Color("#2a2a3a")
const COLOR_LOCKED_TITLE := Color("#666666")
const COLOR_LOCKED_DESC := Color("#444455")
const COLOR_UNLOCKED_TITLE := Color("#ffffff")
const COLOR_UNLOCKED_DESC := Color("#aaaabb")
const COLOR_ICON_BG_LOCKED := Color("#1a1a25")
const COLOR_ICON_BG_UNLOCKED := Color(0.96, 0.77, 0.09, 0.15)
const COLOR_SCANLINE := Color(1, 1, 1, 0.05)

const ROW_W: float = 480.0
const ROW_H: float = 56.0
const ROW_GAP: float = 8.0
const ROW_Y_START: float = 160.0
const ICON_BOX: float = 36.0

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
	var titulo: String = "LOGROS"
	var t_size: Vector2 = _font.get_string_size(titulo,
			HORIZONTAL_ALIGNMENT_LEFT, -1, 28)
	draw_string(_font, Vector2((w - t_size.x) / 2.0, 80.0), titulo,
			HORIZONTAL_ALIGNMENT_LEFT, -1, 28, COLOR_TRAIN_YELLOW)

	# Contador de desbloqueados — siempre 0 / N por ahora
	var contador: String = "0 / %d DESBLOQUEADOS" % LOGROS.size()
	var c_size: Vector2 = _font.get_string_size(contador,
			HORIZONTAL_ALIGNMENT_LEFT, -1, 12)
	draw_string(_font, Vector2((w - c_size.x) / 2.0, 108.0), contador,
			HORIZONTAL_ALIGNMENT_LEFT, -1, 12, COLOR_HINT)

	# Filas
	var row_x: float = (w - ROW_W) / 2.0
	for i in LOGROS.size():
		var y: float = ROW_Y_START + float(i) * (ROW_H + ROW_GAP)
		_dibujar_fila(LOGROS[i], row_x, y, false)

	# Hint inferior parpadeante
	if int(_frame / 40) % 2 == 0:
		var hint: String = "ESC VOLVER"
		var hint_size: Vector2 = _font.get_string_size(hint,
				HORIZONTAL_ALIGNMENT_LEFT, -1, 11)
		draw_string(_font, Vector2((w - hint_size.x) / 2.0, h - 30.0), hint,
				HORIZONTAL_ALIGNMENT_LEFT, -1, 11, COLOR_HINT)


func _dibujar_fila(logro: Dictionary, x: float, y: float, unlocked: bool) -> void:
	draw_rect(Rect2(x, y, ROW_W, ROW_H), COLOR_ROW_BG)
	var border_col: Color = COLOR_TRAIN_YELLOW if unlocked else COLOR_ROW_BORDER
	draw_rect(Rect2(x, y, ROW_W, ROW_H), border_col, false, 1.0)

	# Caja del icono a la izquierda
	var icon_x: float = x + (ROW_H - ICON_BOX) / 2.0
	var icon_y: float = y + (ROW_H - ICON_BOX) / 2.0
	var icon_bg: Color = COLOR_ICON_BG_UNLOCKED if unlocked else COLOR_ICON_BG_LOCKED
	draw_rect(Rect2(icon_x, icon_y, ICON_BOX, ICON_BOX), icon_bg)
	draw_rect(Rect2(icon_x, icon_y, ICON_BOX, ICON_BOX), border_col, false, 1.0)

	# Emoji del logro centrado en la caja. Si está bloqueado se pinta tenue
	# con candado superpuesto en la esquina.
	var icon: String = String(logro.icon)
	var emoji_size: Vector2 = _font.get_string_size(icon,
			HORIZONTAL_ALIGNMENT_LEFT, -1, 18)
	var icon_col: Color = COLOR_HUD if unlocked else COLOR_LOCKED_DESC
	draw_string(_font, Vector2(icon_x + (ICON_BOX - emoji_size.x) / 2.0,
			icon_y + ICON_BOX * 0.7),
			icon, HORIZONTAL_ALIGNMENT_LEFT, -1, 18, icon_col)
	if not unlocked:
		_dibujar_candado(icon_x + ICON_BOX - 6.0, icon_y + ICON_BOX - 6.0)

	# Título + descripción a la derecha
	var text_x: float = x + ROW_H + 4.0
	var title_col: Color = COLOR_UNLOCKED_TITLE if unlocked else COLOR_LOCKED_TITLE
	var desc_col: Color = COLOR_UNLOCKED_DESC if unlocked else COLOR_LOCKED_DESC
	draw_string(_font, Vector2(text_x, y + 22.0),
			String(logro.title), HORIZONTAL_ALIGNMENT_LEFT, -1, 14, title_col)
	draw_string(_font, Vector2(text_x, y + 40.0),
			String(logro.desc), HORIZONTAL_ALIGNMENT_LEFT, -1, 10, desc_col)


# Candado pequeño en esquina del icono cuando está bloqueado.
func _dibujar_candado(cx: float, cy: float) -> void:
	draw_rect(Rect2(cx - 2.0, cy - 3.0, 4.0, 1.0), COLOR_LOCKED_TITLE)
	draw_rect(Rect2(cx - 3.0, cy - 2.0, 1.0, 2.0), COLOR_LOCKED_TITLE)
	draw_rect(Rect2(cx + 2.0, cy - 2.0, 1.0, 2.0), COLOR_LOCKED_TITLE)
	draw_rect(Rect2(cx - 3.0, cy, 6.0, 4.0), COLOR_LOCKED_TITLE)
