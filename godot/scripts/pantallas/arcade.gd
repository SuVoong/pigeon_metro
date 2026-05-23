extends Control

# Pantalla del modo arcade — equivalente a js/pantallas/arcade.js.
# Esta primera iteración incluye: título, ranking placeholder, mapa de
# Madrid con todas las 12 líneas, tooltip de estación bajo el cursor,
# y click sobre estación de L3 para lanzar la partida. ESC vuelve a START.
#
# Lo que queda fuera de esta iteración (irá en B7 detallado):
#  - pan/zoom del mapa con ratón/rueda
#  - popups de selección de línea (transbordos)
#  - popups de selección de dificultad y dirección (andén 1/2)
#  - modo edición del mapa
#  - ranking real desde historial persistido

const COLOR_BG := Color("#0d0d1a")
const COLOR_TRAIN_YELLOW := Color("#f5c518")
const COLOR_TEXT := Color("#aaaaaa")
const COLOR_HINT := Color("#888888")
const COLOR_PERIMETRO := Color("#6c6c80")
const COLOR_EMPTY := Color("#444444")
const COLOR_TOOLTIP_BG := Color(0, 0, 0, 0.8)
const COLOR_DIALOG_BG := Color("#0d0d1a")
const COLOR_DIALOG_BACKDROP := Color(0, 0, 0, 0.55)
const COLOR_BTN_BG := Color("#111111")
const COLOR_BTN_BG_SEL := Color(0.96, 0.77, 0.09, 0.08)
const COLOR_BTN_BORDER := Color("#2a2a3a")
const COLOR_M_LOGO := Color("#cc1414")    # rojo del logo Metro Madrid

# Layout
const PAD_TOP: float = 50.0
const PAD_BOTTOM: float = 22.0
const PAD_LATERAL: float = 60.0     # margen para que las etiquetas perimetrales se vean
const TITULO_PAD: Vector2 = Vector2(20.0, 30.0)
const M_LOGO_SIZE: float = 22.0
const M_LOGO_PAD: Vector2 = Vector2(20.0, 18.0)

# Popup de selección de andén (aparece al clicar una estación de L3).
const DIALOG_W: float = 400.0
const DIALOG_H: float = 210.0
const DIALOG_BTN_H: float = 40.0
const DIALOG_BTN_GAP: float = 10.0
const DIALOG_BTN_TOP: float = 80.0

var _mapa: MapaMetroMadrid
var _font: Font
var _hover: Dictionary = {"valid": false}
var _dialog: Dictionary = {}     # vacío = cerrado; con datos = abierto
var _dialog_hover: int = -1      # 0 = andén 1, 1 = andén 2


func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	_font = ThemeDB.fallback_font
	_mapa = MapaMetroMadrid.new()


func _process(_delta: float) -> void:
	# Mientras el popup esté abierto, el hover del mapa se congela y sólo
	# actualizamos el hover de los botones del andén.
	if not _dialog.is_empty():
		var prev_btn: int = _dialog_hover
		_dialog_hover = _dialog_btn_at(get_local_mouse_position())
		if _dialog_hover != prev_btn:
			queue_redraw()
		return
	var prev: Dictionary = _hover
	_hover = _mapa.station_at(get_local_mouse_position(), _map_rect())
	if not _hover_equals(prev, _hover):
		queue_redraw()


func _input(event: InputEvent) -> void:
	# Comprobar la fase, no `visible` — los Control dentro de CanvasLayer no
	# heredan la visibilidad del layer (ver gameover.gd para más detalle).
	if GameState.current_phase != GameState.Phase.ARCADE:
		return

	# Popup tiene prioridad sobre el mapa.
	if not _dialog.is_empty():
		if event.is_action_pressed("ui_cancel"):
			_cerrar_dialog()
			get_viewport().set_input_as_handled()
			return
		if event is InputEventMouseButton:
			var mb_d: InputEventMouseButton = event
			if mb_d.pressed and mb_d.button_index == MOUSE_BUTTON_LEFT:
				var btn: int = _dialog_btn_at(get_local_mouse_position())
				if btn != -1:
					_confirmar_dialog(btn)
					get_viewport().set_input_as_handled()
		return

	if event is InputEventMouseButton:
		var mb: InputEventMouseButton = event
		if mb.pressed and mb.button_index == MOUSE_BUTTON_LEFT and _hover.valid:
			# Solo L3 está jugable en esta iteración.
			if int(_hover.line_id) == 3 and not bool(_hover.line_locked):
				_abrir_dialog(_hover)


# ── Popup de andén ───────────────────────────────────────────────────────
func _abrir_dialog(hit: Dictionary) -> void:
	_dialog = hit.duplicate()
	var linea: Dictionary = _mapa.get_line(int(hit.line_id))
	_dialog["from"] = String(linea.get("from", "?"))
	_dialog["to"] = String(linea.get("to", "?"))
	_dialog_hover = -1
	queue_redraw()


func _cerrar_dialog() -> void:
	_dialog = {}
	_dialog_hover = -1
	queue_redraw()


func _confirmar_dialog(btn_idx: int) -> void:
	# 0 = ANDÉN 1 → hacia `to` (+1).
	# 1 = ANDÉN 2 → hacia `from` (-1).
	var direccion: int = 1 if btn_idx == 0 else -1
	GameState.set_arcade_seleccion(
		int(_dialog.line_id), int(_dialog.station_index), direccion)
	_cerrar_dialog()
	GameState.change_phase(GameState.Phase.PLAYING)


func _dialog_rect() -> Rect2:
	return Rect2(
		(size.x - DIALOG_W) / 2.0,
		(size.y - DIALOG_H) / 2.0,
		DIALOG_W, DIALOG_H)


func _dialog_btn_rect(idx: int) -> Rect2:
	var r: Rect2 = _dialog_rect()
	var y: float = r.position.y + DIALOG_BTN_TOP + idx * (DIALOG_BTN_H + DIALOG_BTN_GAP)
	return Rect2(r.position.x + 20, y, DIALOG_W - 40, DIALOG_BTN_H)


func _dialog_btn_at(pos: Vector2) -> int:
	if _dialog.is_empty():
		return -1
	for i in 2:
		if _dialog_btn_rect(i).has_point(pos):
			return i
	return -1


func _draw() -> void:
	var w: float = size.x
	var h: float = size.y

	draw_rect(Rect2(0, 0, w, h), COLOR_BG)

	# Cabecera: "2026 ENERO" arriba-izquierda + logo M Metro arriba-derecha
	# (calco del mapa oficial de la imagen de referencia).
	draw_string(_font, Vector2(TITULO_PAD.x, TITULO_PAD.y),
			"2026  ENERO",
			HORIZONTAL_ALIGNMENT_LEFT, -1, 22, Color.WHITE)
	_dibujar_logo_m(w - M_LOGO_PAD.x - M_LOGO_SIZE * 3.5, M_LOGO_PAD.y)

	# Etiquetas perimetrales (MetroNorte / MetroEste / MetroSur / TFM).
	_dibujar_etiquetas_perimetro(w, h)

	# Mapa ocupando el ancho completo (sin columna ranking).
	_mapa.draw_in(self, _map_rect())

	# Tooltip sobre estación bajo el cursor.
	if _hover.valid:
		_draw_tooltip()

	# Hint inferior.
	var hint: String = "CLIC EN ESTACIÓN DE L3 PARA ELEGIR ANDÉN   ·   ESC VOLVER"
	var hint_size: Vector2 = _font.get_string_size(hint,
			HORIZONTAL_ALIGNMENT_LEFT, -1, 9)
	draw_string(_font, Vector2((w - hint_size.x) / 2.0, h - 6.0), hint,
			HORIZONTAL_ALIGNMENT_LEFT, -1, 9, COLOR_HINT)

	# Popup encima de todo.
	if not _dialog.is_empty():
		_draw_dialog()


# Logo "M Metro" en cuadrado rojo con letra M blanca + texto "Metro" al lado.
func _dibujar_logo_m(x: float, y: float) -> void:
	draw_rect(Rect2(x, y, M_LOGO_SIZE, M_LOGO_SIZE), COLOR_M_LOGO)
	var m_size: Vector2 = _font.get_string_size("M",
			HORIZONTAL_ALIGNMENT_LEFT, -1, 16)
	draw_string(_font, Vector2(
			x + (M_LOGO_SIZE - m_size.x) / 2.0,
			y + M_LOGO_SIZE * 0.78),
			"M", HORIZONTAL_ALIGNMENT_LEFT, -1, 16, Color.WHITE)
	draw_string(_font, Vector2(x + M_LOGO_SIZE + 6.0, y + M_LOGO_SIZE * 0.75),
			"Metro", HORIZONTAL_ALIGNMENT_LEFT, -1, 13, COLOR_M_LOGO)


# Etiquetas grises en los 4 bordes — apuntan a las redes de cercanías
# alrededor del centro (norte, este, sur, TFM al sureste).
func _dibujar_etiquetas_perimetro(w: float, h: float) -> void:
	draw_string(_font, Vector2(w * 0.40, PAD_TOP - 8.0),
			"MetroNorte", HORIZONTAL_ALIGNMENT_LEFT, -1, 11, COLOR_PERIMETRO)
	draw_string(_font, Vector2(w - 64.0, h * 0.45),
			"MetroEste", HORIZONTAL_ALIGNMENT_LEFT, -1, 11, COLOR_PERIMETRO)
	draw_string(_font, Vector2(w * 0.18, h - 22.0),
			"MetroSur", HORIZONTAL_ALIGNMENT_LEFT, -1, 11, COLOR_PERIMETRO)
	draw_string(_font, Vector2(w - 46.0, h * 0.62),
			"TFM", HORIZONTAL_ALIGNMENT_LEFT, -1, 11, COLOR_PERIMETRO)


func _draw_dialog() -> void:
	# Backdrop semitransparente sobre el mapa.
	draw_rect(Rect2(0, 0, size.x, size.y), COLOR_DIALOG_BACKDROP)
	var r: Rect2 = _dialog_rect()
	draw_rect(r, COLOR_DIALOG_BG)
	draw_rect(r, COLOR_TRAIN_YELLOW, false, 1.5)

	# Cabecera
	var titulo: String = "%s   ·   %s" % [
		String(_dialog.station_name).to_upper(),
		String(_dialog.line_name),
	]
	draw_string(_font, r.position + Vector2(20, 32), titulo,
		HORIZONTAL_ALIGNMENT_LEFT, -1, 14, COLOR_TRAIN_YELLOW)
	draw_string(_font, r.position + Vector2(20, 54),
		"ELIGE ANDÉN", HORIZONTAL_ALIGNMENT_LEFT, -1, 11, COLOR_HINT)

	# Botones (andén 1 = to, andén 2 = from)
	var etiquetas: Array[String] = [
		"ANDÉN 1   ·   DIRECCIÓN " + String(_dialog.to).to_upper(),
		"ANDÉN 2   ·   DIRECCIÓN " + String(_dialog.from).to_upper(),
	]
	for i in 2:
		var br: Rect2 = _dialog_btn_rect(i)
		var activo: bool = i == _dialog_hover
		var bg: Color = COLOR_BTN_BG_SEL if activo else COLOR_BTN_BG
		var border: Color = COLOR_TRAIN_YELLOW if activo else COLOR_BTN_BORDER
		var border_w: float = 2.0 if activo else 1.0
		draw_rect(br, bg)
		draw_rect(br, border, false, border_w)
		var text_col: Color = COLOR_TRAIN_YELLOW if activo else Color.WHITE
		draw_string(_font, br.position + Vector2(14, 26),
			etiquetas[i], HORIZONTAL_ALIGNMENT_LEFT, -1, 12, text_col)

	# Hint al pie del modal
	draw_string(_font, r.position + Vector2(20, r.size.y - 14),
		"CLIC PARA ELEGIR   ·   ESC CANCELAR",
		HORIZONTAL_ALIGNMENT_LEFT, -1, 10, COLOR_HINT)


func _draw_tooltip() -> void:
	var label: String = "%s  ·  %s" % [
		String(_hover.station_name).to_upper(),
		String(_hover.line_name),
	]
	if bool(_hover.line_locked):
		label += "   [BLOQUEADA]"
	var label_size: Vector2 = _font.get_string_size(label,
		HORIZONTAL_ALIGNMENT_LEFT, -1, 11)
	var pad: Vector2 = Vector2(8.0, 4.0)
	var mouse_pos: Vector2 = get_local_mouse_position()
	var pos: Vector2 = mouse_pos + Vector2(12.0, -22.0)
	# Mantener el tooltip dentro del Control.
	if pos.x + label_size.x + pad.x * 2 > size.x:
		pos.x = mouse_pos.x - label_size.x - pad.x * 2 - 6.0
	pos.y = clampf(pos.y, 4.0, size.y - label_size.y - pad.y * 2 - 4.0)
	draw_rect(Rect2(pos, label_size + pad * 2.0), COLOR_TOOLTIP_BG)
	var border_color: Color = COLOR_EMPTY if bool(_hover.line_locked) else Color(_hover.line_color)
	draw_rect(Rect2(pos, label_size + pad * 2.0), border_color, false, 1.0)
	draw_string(_font, pos + Vector2(pad.x, pad.y + label_size.y * 0.85),
		label, HORIZONTAL_ALIGNMENT_LEFT, -1, 11, Color.WHITE)


func _map_rect() -> Rect2:
	# Mapa ocupando el ancho completo (sin columna ranking) y dejando un margen
	# perimetral para que las etiquetas MetroNorte/Este/Sur/TFM queden visibles
	# sin solapar con los chips de los terminales.
	return Rect2(
		PAD_LATERAL, PAD_TOP,
		size.x - PAD_LATERAL * 2.0,
		size.y - PAD_TOP - PAD_BOTTOM
	)


func _hover_equals(a: Dictionary, b: Dictionary) -> bool:
	if a.get("valid", false) != b.get("valid", false):
		return false
	if not a.get("valid", false):
		return true
	return int(a.line_id) == int(b.line_id) and int(a.station_index) == int(b.station_index)
