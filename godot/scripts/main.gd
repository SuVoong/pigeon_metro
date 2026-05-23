extends Node

# Orquestador raíz — equivalente al switch de fases en js/main.js (líneas 160-241).
# Suscrito a GameState.phase_changed; alterna visibilidad del mundo 3D y de
# las pantallas UI según la fase actual.
#
# Process_mode ALWAYS para que este nodo siga capturando inputs aunque
# get_tree().paused esté activo (necesario para la fase PAUSED).

@onready var _mundo_3d: Node3D = $Mundo3D
@onready var _camara_3d: Camera3D = $Mundo3D/TunelBase/Camera3D
@onready var _ui_inicio: CanvasLayer = $UI_Inicio
@onready var _ui_arcade: CanvasLayer = $UI_Arcade
@onready var _ui_hud: CanvasLayer = $UI_HUD
@onready var _ui_gameover: CanvasLayer = $UI_Gameover
@onready var _ui_personaje: CanvasLayer = $UI_Personaje
@onready var _ui_historia: CanvasLayer = $UI_Historia
@onready var _ui_logros: CanvasLayer = $UI_Logros
@onready var _ui_ajustes: CanvasLayer = $UI_Ajustes
@onready var _ui_pausa: CanvasLayer = $UI_Pausa
@onready var _ui_fin_nivel: CanvasLayer = $UI_FinNivel


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	GameState.phase_changed.connect(_on_phase_changed)
	_aplicar_fase(GameState.current_phase)


func _on_phase_changed(new_phase: GameState.Phase) -> void:
	_aplicar_fase(new_phase)


func _aplicar_fase(phase: GameState.Phase) -> void:
	# Fases con UI propia: START (menú), ARCADE (mapa), CHARACTER (selección),
	# HISTORY (placeholder), ACHIEVEMENTS (logros), SETTINGS (audio futuro),
	# PAUSED (overlay sobre el 3D), GAMEOVER. Fase 3D: PLAYING (mundo del
	# túnel) + HUD del nivel.
	# Otras (LEVEL_COMPLETE, SCENE_EDITOR) aún sin pantalla propia → negro.
	_ui_inicio.visible = phase == GameState.Phase.START
	_ui_arcade.visible = phase == GameState.Phase.ARCADE
	_ui_personaje.visible = phase == GameState.Phase.CHARACTER
	_ui_historia.visible = phase == GameState.Phase.HISTORY
	_ui_logros.visible = phase == GameState.Phase.ACHIEVEMENTS
	_ui_ajustes.visible = phase == GameState.Phase.SETTINGS
	_ui_pausa.visible = phase == GameState.Phase.PAUSED
	_ui_fin_nivel.visible = phase == GameState.Phase.LEVEL_COMPLETE
	_ui_gameover.visible = phase == GameState.Phase.GAMEOVER
	# En PAUSED y LEVEL_COMPLETE mantenemos HUD + render 3D visibles (overlay
	# sobre frame congelado, como en el JS). El freeze del árbol lo hace
	# get_tree().paused.
	var en_3d: bool = phase == GameState.Phase.PLAYING \
			or phase == GameState.Phase.PAUSED \
			or phase == GameState.Phase.LEVEL_COMPLETE
	_ui_hud.visible = en_3d
	_mundo_3d.visible = en_3d
	# Crítico: además de ocultar Mundo3D, desactivamos la Camera3D para que
	# el viewport no renderice nada del túnel en las pantallas 2D (si no, al
	# salir de HISTORIA/LOGROS/AJUSTES se cuela un frame del túnel detrás
	# del Control hasta que éste se redibuja).
	if _camara_3d != null:
		_camara_3d.current = en_3d
	get_tree().paused = phase == GameState.Phase.PAUSED \
			or phase == GameState.Phase.LEVEL_COMPLETE


func _unhandled_input(event: InputEvent) -> void:
	# SPACE en PLAYING → PAUSED (el toggle de salida lo maneja pausa.gd).
	if event is InputEventKey and event.pressed and not event.echo \
			and event.keycode == KEY_SPACE \
			and GameState.current_phase == GameState.Phase.PLAYING:
		GameState.change_phase(GameState.Phase.PAUSED)
		get_viewport().set_input_as_handled()
		return

	# ESC: jerarquía de retorno
	#   PLAYING  → ARCADE  (volver al mapa)
	#   ARCADE   → START   (volver al menú)
	#   Otras    → START
	# (En PAUSED el propio overlay consume ESC para reanudar, así que no
	#  llegamos aquí.)
	if event.is_action_pressed("ui_cancel"):
		match GameState.current_phase:
			GameState.Phase.PLAYING:
				GameState.change_phase(GameState.Phase.ARCADE)
			GameState.Phase.START:
				pass  # no hacer nada en menú principal
			_:
				GameState.change_phase(GameState.Phase.START)
