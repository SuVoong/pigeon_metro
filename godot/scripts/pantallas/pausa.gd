extends Control

# Pantalla PAUSA (fase PAUSED).
# Migra js/pantallas/pausa.js — overlay translúcido sobre el render 3D
# congelado, con 2 botones (CONTINUAR / IR AL INICIO).
#
# Atajos (según especificación del usuario):
#   · SPACE → pausa/reanuda en cualquier sentido (toggle).
#   · ESC / P → equivalentes a SPACE (resumir).
#   · M → reset + START (como el JS).
# El render 3D queda visible debajo gracias a que SOLO esta UI tiene
# process_mode = ALWAYS — Mundo3D, paloma, trenes, túnel quedan paused.

const COLOR_OVERLAY := Color(0, 0, 0, 0.65)
const COLOR_BOX_BG := Color("#0d0d22")
const COLOR_TRAIN_YELLOW := Color("#f5c518")
const COLOR_BOX_BORDER := Color("#f5c518")
const COLOR_BTN_BG_YELLOW := Color(0.96, 0.77, 0.09, 0.10)
const COLOR_BTN_BG_RED := Color(0.78, 0.20, 0.20, 0.08)
const COLOR_RED := Color("#993333")
const COLOR_RED_LIGHT := Color("#ff6666")
const COLOR_HINT := Color("#888888")

const BTN_W: float = 240.0
const BTN_H: float = 42.0
const BOX_W: float = 360.0
const BOX_H: float = 260.0

var _font: Font
var _btn1_rect: Rect2 = Rect2()
var _btn2_rect: Rect2 = Rect2()
var _hover_btn: int = -1


func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	# Crítico: este Control debe seguir procesando aunque get_tree().paused
	# esté activo (es lo que congela el resto del árbol).
	process_mode = Node.PROCESS_MODE_ALWAYS
	mouse_filter = Control.MOUSE_FILTER_STOP
	_font = ThemeDB.fallback_font


func _process(_delta: float) -> void:
	if not visible:
		return
	var prev: int = _hover_btn
	_hover_btn = _btn_at(get_local_mouse_position())
	if _hover_btn != prev:
		queue_redraw()


func _input(event: InputEvent) -> void:
	# Comprobar la fase, no `visible` — los Control dentro de CanvasLayer no
	# heredan la visibilidad del layer (ver gameover.gd para más detalle).
	# Sin esto, SPACE en PLAYING dispararía _continuar() y se comería el
	# evento antes de que main.gd._unhandled_input pudiera entrar a PAUSED.
	if GameState.current_phase != GameState.Phase.PAUSED:
		return

	if event is InputEventKey and event.pressed and not event.echo:
		var k: int = event.keycode
		# SPACE, ESC y P resumen (mismo concepto que el JS).
		if k == KEY_SPACE or k == KEY_ESCAPE or k == KEY_P:
			_continuar()
			get_viewport().set_input_as_handled()
			return
		# M → menú principal con reset (como el JS).
		if k == KEY_M:
			_ir_al_inicio()
			get_viewport().set_input_as_handled()
			return

	if event is InputEventMouseButton:
		var mb: InputEventMouseButton = event
		if mb.pressed and mb.button_index == MOUSE_BUTTON_LEFT:
			match _btn_at(get_local_mouse_position()):
				0:
					_continuar()
					get_viewport().set_input_as_handled()
				1:
					_ir_al_inicio()
					get_viewport().set_input_as_handled()


func _continuar() -> void:
	get_tree().paused = false
	GameState.change_phase(GameState.Phase.PLAYING)


func _ir_al_inicio() -> void:
	get_tree().paused = false
	GameState.change_phase(GameState.Phase.START)


func _btn_at(pos: Vector2) -> int:
	if _btn1_rect.has_point(pos):
		return 0
	if _btn2_rect.has_point(pos):
		return 1
	return -1


func _draw() -> void:
	var w: float = size.x
	var h: float = size.y
	var mid_x: float = w / 2.0
	var mid_y: float = h / 2.0

	# Backdrop oscuro sobre el render 3D congelado
	draw_rect(Rect2(0, 0, w, h), COLOR_OVERLAY)

	# Caja central
	var box_x: float = mid_x - BOX_W / 2.0
	var box_y: float = mid_y - BOX_H / 2.0
	draw_rect(Rect2(box_x, box_y, BOX_W, BOX_H), COLOR_BOX_BG)
	draw_rect(Rect2(box_x, box_y, BOX_W, BOX_H), COLOR_BOX_BORDER, false, 1.5)

	# Título
	var titulo: String = "PAUSA"
	var t_size: Vector2 = _font.get_string_size(titulo,
			HORIZONTAL_ALIGNMENT_LEFT, -1, 32)
	draw_string(_font, Vector2((w - t_size.x) / 2.0, box_y + 50.0),
			titulo, HORIZONTAL_ALIGNMENT_LEFT, -1, 32, Color.WHITE)

	# Botón 1: CONTINUAR (amarillo)
	var btn_x: float = mid_x - BTN_W / 2.0
	_btn1_rect = Rect2(btn_x, box_y + 100.0, BTN_W, BTN_H)
	_dibujar_boton(_btn1_rect, "▶  CONTINUAR", "[SPACE]",
			_hover_btn == 0, false)

	# Botón 2: IR AL INICIO (rojo)
	_btn2_rect = Rect2(btn_x, box_y + 170.0, BTN_W, BTN_H)
	_dibujar_boton(_btn2_rect, "⌂  IR AL INICIO", "[M] · reinicia la partida",
			_hover_btn == 1, true)


# Dibuja un botón rectangular con etiqueta + hint debajo. Hover invierte
# bg/text para que se note bien con ratón.
func _dibujar_boton(rect: Rect2, label: String, hint: String,
		hover: bool, is_red: bool) -> void:
	var bg: Color
	var border: Color
	var text_col: Color
	var hint_col: Color
	if is_red:
		bg = COLOR_RED if hover else COLOR_BTN_BG_RED
		border = COLOR_RED
		text_col = Color.WHITE if hover else COLOR_RED_LIGHT
		hint_col = Color.WHITE if hover else COLOR_RED_LIGHT
	else:
		bg = COLOR_TRAIN_YELLOW if hover else COLOR_BTN_BG_YELLOW
		border = COLOR_TRAIN_YELLOW
		text_col = COLOR_BOX_BG if hover else COLOR_TRAIN_YELLOW
		hint_col = COLOR_BOX_BG if hover else COLOR_HINT

	draw_rect(rect, bg)
	draw_rect(rect, border, false, 1.5)

	var lbl_size: Vector2 = _font.get_string_size(label,
			HORIZONTAL_ALIGNMENT_LEFT, -1, 14)
	draw_string(_font, Vector2(
			rect.position.x + (rect.size.x - lbl_size.x) / 2.0,
			rect.position.y + rect.size.y / 2.0 - 2.0),
			label, HORIZONTAL_ALIGNMENT_LEFT, -1, 14, text_col)

	var h_size: Vector2 = _font.get_string_size(hint,
			HORIZONTAL_ALIGNMENT_LEFT, -1, 9)
	draw_string(_font, Vector2(
			rect.position.x + (rect.size.x - h_size.x) / 2.0,
			rect.position.y + rect.size.y / 2.0 + 14.0),
			hint, HORIZONTAL_ALIGNMENT_LEFT, -1, 9, hint_col)
