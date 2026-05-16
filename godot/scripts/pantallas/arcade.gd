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
const COLOR_RANK_SEP := Color("#333333")
const COLOR_EMPTY := Color("#444444")
const COLOR_TOOLTIP_BG := Color(0, 0, 0, 0.8)

const PAD_TOP: float = 42.0
const PAD_BOTTOM: float = 18.0
const RANK_X: float = 10.0
const RANK_W: float = 170.0
const RANK_Y: float = 44.0

var _mapa: MapaMetroMadrid
var _font: Font
var _hover: Dictionary = {"valid": false}


func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	_font = ThemeDB.fallback_font
	_mapa = MapaMetroMadrid.new()


func _process(_delta: float) -> void:
	var prev: Dictionary = _hover
	_hover = _mapa.station_at(get_local_mouse_position(), _map_rect())
	if not _hover_equals(prev, _hover):
		queue_redraw()


func _input(event: InputEvent) -> void:
	if not visible:
		return
	if event is InputEventMouseButton:
		var mb: InputEventMouseButton = event
		if mb.pressed and mb.button_index == MOUSE_BUTTON_LEFT and _hover.valid:
			# Solo L3 está jugable en esta iteración.
			if int(_hover.line_id) == 3 and not bool(_hover.line_locked):
				GameState.change_phase(GameState.Phase.PLAYING)


func _draw() -> void:
	var w: float = size.x
	var h: float = size.y

	draw_rect(Rect2(0, 0, w, h), COLOR_BG)

	# Título compacto centrado en la parte superior
	var titulo: String = "MODO ARCADE  ·  METRO DE MADRID  ·  ENERO 2026"
	var titulo_size: Vector2 = _font.get_string_size(titulo,
		HORIZONTAL_ALIGNMENT_LEFT, -1, 14)
	draw_string(_font, Vector2((w - titulo_size.x) / 2.0, 22.0), titulo,
		HORIZONTAL_ALIGNMENT_LEFT, -1, 14, COLOR_TRAIN_YELLOW)

	# Ranking: header + separador + placeholder vacío.
	var rank_title: String = "TOP VUELOS"
	var rank_title_size: Vector2 = _font.get_string_size(rank_title,
		HORIZONTAL_ALIGNMENT_LEFT, -1, 11)
	draw_string(_font, Vector2(RANK_X + (RANK_W - rank_title_size.x) / 2.0, RANK_Y),
		rank_title, HORIZONTAL_ALIGNMENT_LEFT, -1, 11, COLOR_TEXT)
	draw_rect(Rect2(RANK_X, RANK_Y + 5.0, RANK_W, 1.0), COLOR_RANK_SEP)
	var empty: String = "Sin partidas aún"
	var empty_size: Vector2 = _font.get_string_size(empty,
		HORIZONTAL_ALIGNMENT_LEFT, -1, 10)
	draw_string(_font, Vector2(RANK_X + (RANK_W - empty_size.x) / 2.0, RANK_Y + 28.0),
		empty, HORIZONTAL_ALIGNMENT_LEFT, -1, 10, COLOR_EMPTY)

	# Mapa centrado en el rect restante.
	_mapa.draw_in(self, _map_rect())

	# Tooltip sobre estación bajo el cursor.
	if _hover.valid:
		_draw_tooltip()

	# Hint inferior.
	var hint: String = "CLIC EN ESTACIÓN DE L3 (NARANJA) PARA JUGAR   ·   ESC VOLVER"
	var hint_size: Vector2 = _font.get_string_size(hint,
		HORIZONTAL_ALIGNMENT_LEFT, -1, 9)
	draw_string(_font, Vector2((w - hint_size.x) / 2.0, h - 6.0), hint,
		HORIZONTAL_ALIGNMENT_LEFT, -1, 9, COLOR_HINT)


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
	var pad_left: float = RANK_X + RANK_W + 10.0
	var pad_right: float = 8.0
	return Rect2(
		pad_left, PAD_TOP,
		size.x - pad_left - pad_right,
		size.y - PAD_TOP - PAD_BOTTOM
	)


func _hover_equals(a: Dictionary, b: Dictionary) -> bool:
	if a.get("valid", false) != b.get("valid", false):
		return false
	if not a.get("valid", false):
		return true
	return int(a.line_id) == int(b.line_id) and int(a.station_index) == int(b.station_index)
