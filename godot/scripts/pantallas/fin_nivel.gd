extends Control

# Pantalla LEVEL_COMPLETE (fase final de un trayecto).
# Migra js/pantallas/fin_nivel.js — al llegar al terminal de la línea (sea
# Moncloa o El Casar), mundo_juego.gd cambia a esta fase y aparece el popup
# con dos opciones:
#   · DAR LA VUELTA → reinicia desde el terminal alcanzado en sentido opuesto.
#   · TERMINAR → vuelve al mapa ARCADE.
# El render 3D queda visible debajo (frame congelado) gracias a que sólo
# este Control tiene process_mode = ALWAYS.

const COLOR_OVERLAY := Color(0, 0, 0, 0.72)
const COLOR_BOX_BG := Color("#0d0d22")
const COLOR_GREEN := Color("#5dcaa5")
const COLOR_GREEN_DARK := Color(0.36, 0.79, 0.65, 0.18)
const COLOR_GREEN_HINT := Color("#88bba0")
const COLOR_RED := Color("#cc4444")
const COLOR_RED_DARK := Color(0.80, 0.27, 0.27, 0.18)
const COLOR_RED_HINT := Color("#aa6666")
const COLOR_TITULO := Color("#5dcaa5")
const COLOR_HINT := Color("#aaaabb")

const BOX_W: float = 380.0
const BOX_H: float = 220.0
const BTN_W: float = 320.0
const BTN_H: float = 42.0

var _font: Font
var _btn1_rect: Rect2 = Rect2()
var _btn2_rect: Rect2 = Rect2()
var _hover_btn: int = -1


func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
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
	# Comprobar la fase, no `visible` (mismo motivo que el resto de pantallas).
	if GameState.current_phase != GameState.Phase.LEVEL_COMPLETE:
		return

	if event is InputEventKey and event.pressed and not event.echo:
		var k: int = event.keycode
		# 1 / Enter / Space → primaria: dar la vuelta
		if k == KEY_1 or k == KEY_KP_1 or k == KEY_ENTER or k == KEY_KP_ENTER \
				or k == KEY_SPACE:
			_dar_la_vuelta()
			get_viewport().set_input_as_handled()
			return
		# 2 / Esc / Q → secundaria: terminar
		if k == KEY_2 or k == KEY_KP_2 or k == KEY_ESCAPE or k == KEY_Q:
			_terminar()
			get_viewport().set_input_as_handled()
			return

	if event is InputEventMouseButton:
		var mb: InputEventMouseButton = event
		if mb.pressed and mb.button_index == MOUSE_BUTTON_LEFT:
			match _btn_at(get_local_mouse_position()):
				0:
					_dar_la_vuelta()
					get_viewport().set_input_as_handled()
				1:
					_terminar()
					get_viewport().set_input_as_handled()


# Dar la vuelta: invertir dirección, arrancar desde el terminal alcanzado,
# volver a PLAYING (_reset_completo aplicará GameState).
func _dar_la_vuelta() -> void:
	GameState.set_arcade_seleccion(
			GameState.selected_line_id,
			_terminal_idx(),
			-GameState.selected_direction)
	get_tree().paused = false
	GameState.change_phase(GameState.Phase.PLAYING)


# Terminar: vuelve al mapa arcade.
func _terminar() -> void:
	get_tree().paused = false
	GameState.change_phase(GameState.Phase.ARCADE)


# El terminal alcanzado lo conoce mundo_juego en su _idx_proxima.
func _terminal_idx() -> int:
	var mundo: Node = get_node_or_null("/root/Main/Mundo3D")
	if mundo != null:
		return mundo.indice_proxima()
	return 0


func _terminal_nombre() -> String:
	var mundo: Node = get_node_or_null("/root/Main/Mundo3D")
	if mundo != null:
		return mundo.proxima_estacion_nombre()
	return ""


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

	# Caja
	var box_x: float = mid_x - BOX_W / 2.0
	var box_y: float = mid_y - BOX_H / 2.0
	draw_rect(Rect2(box_x, box_y, BOX_W, BOX_H), COLOR_BOX_BG)
	draw_rect(Rect2(box_x, box_y, BOX_W, BOX_H), COLOR_GREEN, false, 2.0)

	# Título
	var titulo: String = "🏁  LÍNEA COMPLETADA"
	var t_size: Vector2 = _font.get_string_size(titulo,
			HORIZONTAL_ALIGNMENT_LEFT, -1, 18)
	draw_string(_font, Vector2((w - t_size.x) / 2.0, box_y + 30.0),
			titulo, HORIZONTAL_ALIGNMENT_LEFT, -1, 18, COLOR_TITULO)

	# Subtítulo — terminal alcanzado
	var nombre: String = _terminal_nombre().to_upper()
	var sub: String = "HAS LLEGADO A %s" % nombre
	var s_size: Vector2 = _font.get_string_size(sub,
			HORIZONTAL_ALIGNMENT_LEFT, -1, 12)
	draw_string(_font, Vector2((w - s_size.x) / 2.0, box_y + 58.0),
			sub, HORIZONTAL_ALIGNMENT_LEFT, -1, 12, Color.WHITE)

	var pregunta: String = "¿Quieres seguir jugando?"
	var p_size: Vector2 = _font.get_string_size(pregunta,
			HORIZONTAL_ALIGNMENT_LEFT, -1, 10)
	draw_string(_font, Vector2((w - p_size.x) / 2.0, box_y + 80.0),
			pregunta, HORIZONTAL_ALIGNMENT_LEFT, -1, 10, COLOR_HINT)

	# Botón 1: DAR LA VUELTA (verde, primario)
	var btn_x: float = mid_x - BTN_W / 2.0
	_btn1_rect = Rect2(btn_x, box_y + 100.0, BTN_W, BTN_H)
	_dibujar_boton(_btn1_rect, "↩  DAR LA VUELTA", "[1] · [ENTER]",
			_hover_btn == 0, false)

	# Botón 2: TERMINAR (rojo, secundario)
	_btn2_rect = Rect2(btn_x, box_y + 152.0, BTN_W, BTN_H)
	_dibujar_boton(_btn2_rect, "✕  TERMINAR", "[2] · [ESC] · [Q]",
			_hover_btn == 1, true)


func _dibujar_boton(rect: Rect2, label: String, hint: String,
		hover: bool, is_red: bool) -> void:
	var bg: Color
	var border: Color
	var text_col: Color
	var hint_col: Color
	if is_red:
		bg = COLOR_RED if hover else COLOR_RED_DARK
		border = COLOR_RED
		text_col = Color.WHITE if hover else COLOR_RED
		hint_col = Color.WHITE if hover else COLOR_RED_HINT
	else:
		bg = COLOR_GREEN if hover else COLOR_GREEN_DARK
		border = COLOR_GREEN
		text_col = COLOR_BOX_BG if hover else COLOR_GREEN
		hint_col = COLOR_BOX_BG if hover else COLOR_GREEN_HINT

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
