extends Node

# Orquestador raíz — equivalente al switch de fases en js/main.js (líneas 160-241).
# Suscrito a GameState.phase_changed; muestra/oculta el mundo 3D o la UI según fase.

@onready var _mundo_3d: Node3D = $Mundo3D
@onready var _ui: CanvasLayer = $UI


func _ready() -> void:
	GameState.phase_changed.connect(_on_phase_changed)
	_aplicar_fase(GameState.current_phase)


func _on_phase_changed(new_phase: GameState.Phase) -> void:
	_aplicar_fase(new_phase)


func _aplicar_fase(phase: GameState.Phase) -> void:
	# START = menú visible, mundo oculto.
	# ARCADE (placeholder hasta B7) y PLAYING = mundo 3D visible.
	# Otras fases (HISTORY, CHARACTER, ACHIEVEMENTS, SETTINGS) aún sin UI propia;
	# se quedan en pantalla negra hasta que el usuario pulse ESC para volver.
	var es_menu: bool = phase == GameState.Phase.START
	var muestra_mundo: bool = (
		phase == GameState.Phase.PLAYING
		or phase == GameState.Phase.ARCADE
	)
	_ui.visible = es_menu
	_mundo_3d.visible = muestra_mundo


func _unhandled_input(event: InputEvent) -> void:
	# ESC vuelve al menú desde cualquier fase no-START.
	if event.is_action_pressed("ui_cancel"):
		if GameState.current_phase != GameState.Phase.START:
			GameState.change_phase(GameState.Phase.START)
