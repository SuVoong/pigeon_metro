extends Node

# Orquestador raíz — equivalente al switch de fases en js/main.js (líneas 160-241).
# Suscrito a GameState.phase_changed; alterna visibilidad del mundo 3D y de
# las pantallas UI según la fase actual.

@onready var _mundo_3d: Node3D = $Mundo3D
@onready var _ui_inicio: CanvasLayer = $UI_Inicio
@onready var _ui_arcade: CanvasLayer = $UI_Arcade
@onready var _ui_hud: CanvasLayer = $UI_HUD


func _ready() -> void:
	GameState.phase_changed.connect(_on_phase_changed)
	_aplicar_fase(GameState.current_phase)


func _on_phase_changed(new_phase: GameState.Phase) -> void:
	_aplicar_fase(new_phase)


func _aplicar_fase(phase: GameState.Phase) -> void:
	# Fases con UI propia: START (menú), ARCADE (mapa).
	# Fase 3D: PLAYING (mundo del túnel) + HUD del nivel.
	# Otras (HISTORY, CHARACTER, ACHIEVEMENTS, SETTINGS, PAUSED, etc.) aún sin
	# pantalla propia → se quedan en negro hasta ESC.
	_ui_inicio.visible = phase == GameState.Phase.START
	_ui_arcade.visible = phase == GameState.Phase.ARCADE
	_ui_hud.visible = phase == GameState.Phase.PLAYING
	_mundo_3d.visible = phase == GameState.Phase.PLAYING


func _unhandled_input(event: InputEvent) -> void:
	# ESC: jerarquía de retorno
	#   PLAYING  → ARCADE  (volver al mapa)
	#   ARCADE   → START   (volver al menú)
	#   Otras    → START
	if event.is_action_pressed("ui_cancel"):
		match GameState.current_phase:
			GameState.Phase.PLAYING:
				GameState.change_phase(GameState.Phase.ARCADE)
			GameState.Phase.START:
				pass  # no hacer nada en menú principal
			_:
				GameState.change_phase(GameState.Phase.START)
