extends RefCounted
class_name MapaMetroMadrid

# Carga `resources/metro_madrid/madrid_lines.json` y expone funciones de dibujo
# y hit-testing. Equivale a la parte de render de
# js/escenarios/metro_madrid/mapa_metro_madrid.js (sin pan/zoom/edit todavía).

const DATOS_PATH := "res://resources/metro_madrid/madrid_lines.json"
const HIT_RADIUS: float = 8.0
const LINE_WIDTH: float = 3.0
const STATION_RADIUS: float = 3.0
const TRANSFER_RADIUS: float = 5.0
const CHIP_SIZE: float = 18.0           # cuadrado coloreado al extremo de cada línea
const CHIP_FONT: int = 11
const NAME_FONT: int = 10
const COLOR_NAME := Color("#dddddd")
const COLOR_NAME_LOCKED := Color("#555566")

var lines: Array = []


func _init() -> void:
	var file: FileAccess = FileAccess.open(DATOS_PATH, FileAccess.READ)
	if file == null:
		push_error("MapaMetroMadrid: no se puede abrir %s" % DATOS_PATH)
		return
	var data: Dictionary = JSON.parse_string(file.get_as_text())
	lines = data.lines


# Dibuja el mapa completo en `canvas_item` dentro del rect indicado.
# Orden de capas (de abajo arriba):
#   1. trazos de cada línea
#   2. estaciones (círculos)
#   3. nombres de estación SOLO de líneas no-locked (L3 jugable)
#   4. chips numerados en los terminales (extremos) de cada línea
func draw_in(canvas_item: CanvasItem, rect: Rect2) -> void:
	for line in lines:
		_draw_trace(canvas_item, line, rect)
	for line in lines:
		_draw_stations(canvas_item, line, rect)
	for line in lines:
		_draw_station_names(canvas_item, line, rect)
	for line in lines:
		_draw_line_chips(canvas_item, line, rect)


func _draw_trace(canvas_item: CanvasItem, line: Dictionary, rect: Rect2) -> void:
	var stations: Array = line.stations
	if stations.size() < 2:
		return
	var color: Color = _line_color(line)
	for i in stations.size() - 1:
		var p1: Vector2 = _norm_to_screen(stations[i].pos, rect)
		var p2: Vector2 = _norm_to_screen(stations[i + 1].pos, rect)
		canvas_item.draw_line(p1, p2, color, LINE_WIDTH, true)


func _draw_stations(canvas_item: CanvasItem, line: Dictionary, rect: Rect2) -> void:
	var locked: bool = line.locked
	var color_station: Color = Color("#555566") if locked else Color.WHITE
	for station in line.stations:
		var p: Vector2 = _norm_to_screen(station.pos, rect)
		var r: float = TRANSFER_RADIUS if station.transfers.size() > 0 else STATION_RADIUS
		canvas_item.draw_circle(p, r, color_station)
		if not locked and station.transfers.size() > 0:
			# Anillo amarillo para transbordos en línea jugable.
			canvas_item.draw_arc(p, r + 1.0, 0.0, TAU, 24, Color("#f5c518"), 1.0, true)


func _line_color(line: Dictionary) -> Color:
	var base: Color = Color(line.color)
	if line.locked:
		return base.lerp(Color("#0d0d1a"), 0.55)
	return base


# Pinta el nombre de cada estación de una LÍNEA NO BLOQUEADA junto a su
# círculo, esquivando solapes simples ofreciendo el texto a la derecha o
# izquierda según la posición del punto en el rect.
func _draw_station_names(canvas_item: CanvasItem, line: Dictionary,
		rect: Rect2) -> void:
	if line.locked:
		return
	var font: Font = ThemeDB.fallback_font
	for station in line.stations:
		var p: Vector2 = _norm_to_screen(station.pos, rect)
		var nombre: String = String(station.name)
		var t_size: Vector2 = font.get_string_size(nombre,
				HORIZONTAL_ALIGNMENT_LEFT, -1, NAME_FONT)
		# Si la estación está en la mitad derecha del mapa, pintamos a la
		# izquierda para que el texto no se salga del rect.
		var ofs: Vector2
		if p.x > rect.position.x + rect.size.x * 0.62:
			ofs = Vector2(-t_size.x - 7.0, 4.0)
		else:
			ofs = Vector2(7.0, 4.0)
		canvas_item.draw_string(font, p + ofs, nombre,
				HORIZONTAL_ALIGNMENT_LEFT, -1, NAME_FONT, COLOR_NAME)


# Chip cuadrado con el número de línea en los dos terminales (primera y
# última estación). Es lo que pintan los mapas oficiales de Metro Madrid.
func _draw_line_chips(canvas_item: CanvasItem, line: Dictionary,
		rect: Rect2) -> void:
	var stations: Array = line.stations
	if stations.is_empty():
		return
	var color: Color = _line_color(line)
	var font: Font = ThemeDB.fallback_font
	var numero: String = str(int(line.id))
	# Estación 0 y última.
	var indices: Array[int] = [0, stations.size() - 1]
	for idx in indices:
		var p: Vector2 = _norm_to_screen(stations[idx].pos, rect)
		# Desplazamos el chip un poco más allá del terminal para que no tape
		# el círculo de la estación.
		var dir_x: float = -1.0 if p.x < rect.position.x + rect.size.x * 0.5 else 1.0
		var dir_y: float = -1.0 if p.y < rect.position.y + rect.size.y * 0.5 else 1.0
		var chip_pos: Vector2 = p + Vector2(dir_x * 11.0, dir_y * 11.0) \
				- Vector2(CHIP_SIZE / 2.0, CHIP_SIZE / 2.0)
		canvas_item.draw_rect(Rect2(chip_pos, Vector2(CHIP_SIZE, CHIP_SIZE)), color)
		canvas_item.draw_rect(Rect2(chip_pos, Vector2(CHIP_SIZE, CHIP_SIZE)),
				Color.WHITE, false, 1.0)
		# Número centrado en el chip.
		var n_size: Vector2 = font.get_string_size(numero,
				HORIZONTAL_ALIGNMENT_LEFT, -1, CHIP_FONT)
		canvas_item.draw_string(font, chip_pos + Vector2(
				(CHIP_SIZE - n_size.x) / 2.0,
				CHIP_SIZE * 0.75),
				numero, HORIZONTAL_ALIGNMENT_LEFT, -1, CHIP_FONT, Color.WHITE)


func _norm_to_screen(norm_pos: Array, rect: Rect2) -> Vector2:
	return Vector2(
		rect.position.x + norm_pos[0] * rect.size.x,
		rect.position.y + norm_pos[1] * rect.size.y
	)


# Devuelve info de la estación bajo `pos` o {"valid": false} si no hay ninguna.
# Prioriza estaciones de líneas desbloqueadas para que el cursor "agarre" L3
# antes que estaciones lockeadas en el mismo punto (transbordos).
func station_at(pos: Vector2, rect: Rect2, radius: float = HIT_RADIUS) -> Dictionary:
	var best_locked: Dictionary = {"valid": false}
	for line in lines:
		for i in line.stations.size():
			var station: Dictionary = line.stations[i]
			var p: Vector2 = _norm_to_screen(station.pos, rect)
			if p.distance_to(pos) <= radius:
				var hit: Dictionary = {
					"valid": true,
					"line_id": int(line.id),
					"line_name": String(line.name),
					"line_color": String(line.color),
					"line_locked": bool(line.locked),
					"station_index": i,
					"station_name": String(station.name),
				}
				if not line.locked:
					return hit
				best_locked = hit
	return best_locked


func get_line(line_id: int) -> Dictionary:
	for line in lines:
		if int(line.id) == line_id:
			return line
	return {}
