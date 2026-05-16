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

var lines: Array = []


func _init() -> void:
	var file: FileAccess = FileAccess.open(DATOS_PATH, FileAccess.READ)
	if file == null:
		push_error("MapaMetroMadrid: no se puede abrir %s" % DATOS_PATH)
		return
	var data: Dictionary = JSON.parse_string(file.get_as_text())
	lines = data.lines


# Dibuja el mapa completo en `canvas_item` dentro del rect indicado.
# Trazos primero, estaciones encima (para que las estaciones queden visibles).
func draw_in(canvas_item: CanvasItem, rect: Rect2) -> void:
	for line in lines:
		_draw_trace(canvas_item, line, rect)
	for line in lines:
		_draw_stations(canvas_item, line, rect)


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
