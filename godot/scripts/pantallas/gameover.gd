extends Control

# Pantalla GAME OVER — se muestra cuando mundo_juego.gd ha agotado las
# vidas y cambia la fase a GAMEOVER. ENTER vuelve a PLAYING (que lanza el
# _reset_completo de mundo_juego y empieza otro run).

const COLOR_BG := Color(0.04, 0.04, 0.08, 0.92)
const COLOR_TITULO := Color("#f5c518")
const COLOR_HINT := Color("#aaaaaa")
const COLOR_SCORE := Color("#ffffff")

var _font: Font


func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	_font = ThemeDB.fallback_font


func _input(event: InputEvent) -> void:
	# Nota: comprobar visible no basta — los Control dentro de CanvasLayer
	# NO heredan la visibilidad del layer, así que `visible` puede ser true
	# aunque UI_Gameover esté oculto. Comprobamos la fase como fuente de verdad.
	if GameState.current_phase != GameState.Phase.GAMEOVER:
		return
	if event.is_action_pressed("ui_accept"):
		GameState.change_phase(GameState.Phase.PLAYING)


func _process(_delta: float) -> void:
	if is_visible_in_tree():
		queue_redraw()


func _draw() -> void:
	var w: float = size.x
	var h: float = size.y

	# Fondo opaco con leve transparencia
	draw_rect(Rect2(0.0, 0.0, w, h), COLOR_BG)

	# Título GAME OVER
	var titulo: String = "GAME OVER"
	var titulo_size: Vector2 = _font.get_string_size(titulo,
			HORIZONTAL_ALIGNMENT_LEFT, -1, 72)
	draw_string(_font, Vector2((w - titulo_size.x) / 2.0, h / 2.0 - 30.0),
			titulo, HORIZONTAL_ALIGNMENT_LEFT, -1, 72, COLOR_TITULO)

	# Puntuación del run (leída del mundo si sigue accesible) + récord
	var mundo: Node = get_node_or_null("/root/Main/Mundo3D")
	if mundo != null:
		var score: int = mundo.puntuacion()
		var nuevo: bool = mundo.nuevo_record()
		var score_txt: String = "ESTACIONES CRUZADAS · %d" % score
		var score_size: Vector2 = _font.get_string_size(score_txt,
				HORIZONTAL_ALIGNMENT_LEFT, -1, 22)
		draw_string(_font, Vector2((w - score_size.x) / 2.0, h / 2.0 + 24.0),
				score_txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 22, COLOR_SCORE)
		# Récord
		var record_txt: String = "MEJOR · %d" % GameState.record_puntuacion
		var record_size: Vector2 = _font.get_string_size(record_txt,
				HORIZONTAL_ALIGNMENT_LEFT, -1, 18)
		draw_string(_font, Vector2((w - record_size.x) / 2.0, h / 2.0 + 54.0),
				record_txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 18, COLOR_HINT)
		# Mensaje de nuevo récord
		if nuevo:
			var nuevo_txt: String = "¡NUEVO RÉCORD!"
			var nuevo_size: Vector2 = _font.get_string_size(nuevo_txt,
					HORIZONTAL_ALIGNMENT_LEFT, -1, 28)
			draw_string(_font, Vector2((w - nuevo_size.x) / 2.0, h / 2.0 - 70.0),
					nuevo_txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 28, COLOR_TITULO)

	# Hint
	var hint: String = "ENTER · reiniciar     ESC · menú principal"
	var hint_size: Vector2 = _font.get_string_size(hint,
			HORIZONTAL_ALIGNMENT_LEFT, -1, 14)
	draw_string(_font, Vector2((w - hint_size.x) / 2.0, h / 2.0 + 80.0),
			hint, HORIZONTAL_ALIGNMENT_LEFT, -1, 14, COLOR_HINT)
