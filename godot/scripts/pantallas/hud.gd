extends Control

# HUD del modo juego — muestra:
#   · Mapa lineal con las 20 estaciones de L3 y marcador de posición.
#   · Nombre de la próxima estación.
#   · Vidas restantes del run (3 círculos arriba a la derecha).
#   · Puntuación (estaciones cruzadas) a la derecha del título.
# Lee el estado del nivel desde el Mundo3D / mundo_juego.gd.

const COLOR_BG := Color(0.0, 0.0, 0.0, 0.55)
const COLOR_TITULO := Color("#f5c518")          # amarillo Metro
const COLOR_LINEA_L3 := Color("#f39200")        # naranja L3
const COLOR_DOT := Color("#cccccc")
const COLOR_DOT_ACTIVO := Color("#f5c518")
const COLOR_MARCADOR := Color("#ffffff")
const COLOR_VIDA_LLENA := Color("#cc2211")      # rojo Metro
const COLOR_VIDA_VACIA := Color(0.2, 0.2, 0.25, 1.0)
const COLOR_SCORE := Color("#ffffff")

const PANEL_ALTO: float = 80.0
const PAD_X: float = 40.0
const Y_NOMBRE: float = 22.0
const Y_DOTS: float = 56.0
const FONT_SIZE_NOMBRE: int = 16
const VIDAS_RADIO: float = 9.0
const VIDAS_GAP: float = 28.0

@onready var _mundo: Node = get_node("/root/Main/Mundo3D")

var _font: Font


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_font = ThemeDB.fallback_font


func _process(_delta: float) -> void:
	if is_visible_in_tree():
		queue_redraw()


func _draw() -> void:
	if _mundo == null:
		return
	var stations: Array = _mundo.estaciones_linea()
	if stations.is_empty():
		return
	var idx: int = _mundo.indice_proxima()
	var progreso: float = _mundo.progreso_ciclo()
	var nombre: String = _mundo.proxima_estacion_nombre()
	var vidas: int = _mundo.vidas()
	var score: int = _mundo.puntuacion()

	var w: float = size.x
	var n: int = stations.size()
	var bar_w: float = w - 2.0 * PAD_X
	var step: float = bar_w / float(max(1, n - 1))

	# Fondo
	draw_rect(Rect2(0.0, 0.0, w, PANEL_ALTO), COLOR_BG)

	# Texto "PRÓXIMA"
	draw_string(_font, Vector2(PAD_X, Y_NOMBRE),
			"PRÓXIMA  ·  " + nombre.to_upper(),
			HORIZONTAL_ALIGNMENT_LEFT, -1, FONT_SIZE_NOMBRE, COLOR_TITULO)

	# Puntuación + récord a la mitad del panel
	var record: int = GameState.record_puntuacion
	var score_txt: String = "ESTACIONES  ·  %d   (MEJOR  ·  %d)" % [score, record]
	draw_string(_font, Vector2(w * 0.5, Y_NOMBRE),
			score_txt, HORIZONTAL_ALIGNMENT_LEFT, -1, FONT_SIZE_NOMBRE, COLOR_SCORE)

	# Vidas (3 círculos arriba a la derecha)
	var vidas_max: int = 3
	var vidas_x_base: float = w - PAD_X - VIDAS_RADIO
	for i in vidas_max:
		var cx: float = vidas_x_base - float(i) * VIDAS_GAP
		var color: Color = COLOR_VIDA_LLENA if (vidas_max - 1 - i) < vidas else COLOR_VIDA_VACIA
		draw_circle(Vector2(cx, Y_NOMBRE + 2), VIDAS_RADIO, color)

	# Línea base de la L3
	draw_line(Vector2(PAD_X, Y_DOTS), Vector2(PAD_X + bar_w, Y_DOTS),
			COLOR_LINEA_L3, 2.0)

	# Puntos de estación
	var prev_idx: int = (idx - 1 + n) % n
	for i in n:
		var px: float = PAD_X + float(i) * step
		var es_actual: bool = i == idx or i == prev_idx
		var color: Color = COLOR_DOT_ACTIVO if es_actual else COLOR_DOT
		var r: float = 5.0 if es_actual else 3.0
		draw_circle(Vector2(px, Y_DOTS), r, color)

	# Marcador triangular interpolado entre el dot previo y el próximo.
	var prev_x: float = PAD_X + float(prev_idx) * step
	var next_x: float = PAD_X + float(idx) * step
	var marker_x: float = lerp(prev_x, next_x, progreso)
	var marker_y: float = Y_DOTS - 14.0
	draw_colored_polygon(PackedVector2Array([
		Vector2(marker_x - 6.0, marker_y - 6.0),
		Vector2(marker_x + 6.0, marker_y - 6.0),
		Vector2(marker_x, marker_y + 5.0),
	]), COLOR_MARCADOR)
