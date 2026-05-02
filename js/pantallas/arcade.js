// Selector de escenarios para el modo arcade.
// La columna izquierda muestra el ranking de vuelos; la derecha el mapa
// esquemático del Metro de Madrid (Mapa centralizado con MapaMetroMadrid).
//
// Interacción del mapa:
//   · Clic en estación de una sola línea → lanza partida directamente.
//   · Clic en transbordo (varias líneas)  → popup de selección de línea.
//   · Clic en trazo de línea              → lanza esa línea desde el inicio.
//   · Arrastrar                           → pan del viewport.
//   · Rueda                               → zoom centrado en el cursor.
//   · R                                   → reset de zoom/pan.
//   · Q (con popup abierto)               → cierra popup.
//   · ESC                                 → vuelve a START.
//
// Modo edición del mapa (atajos):
//   · E       → entra/sale del modo edición (denegado si está bloqueado).
//   · Drag de un handle (estación) → mueve la estación y todas sus apariciones
//                                    en otras líneas (por nombre).
//   · Shift mientras se arrastra   → snap fino.
//   · S       → guarda los cambios en localStorage.
//   · L → Y    → bloquea la edición permanentemente (Y confirma, N cancela).
//   · R       → descarta el draft (en edición) | reset zoom (fuera).
//   · ESC     → sale del modo edición.

import { canvas, STATE, PAL } from '../mecanica/estado.js';
import { formatFlightTime } from '../mecanica/progreso.js';
import { MapaMetroMadrid, drawTooltip, clearTooltip } from '../escenarios/metros/metros_madrid/mapa_metro_madrid.js';
import * as PM from '../editor/preset_manager.js';
import { DIFFICULTY_COLORS } from '../editor/config_schema.js';
import { openSceneEditor } from './escena_editor.js';
import { hasOverride }    from '../escenarios/escena_overrides.js';

// ── Mouse tracking ─────────────────────────────────────────────
let mouseX = -999, mouseY = -999;
let pendingClick = false;
let listenersAttached = false;

// ── Estado de arrastre (pan) ─────────────────────────────────────
let isDragging = false;
let dragStartX = 0, dragStartY = 0;
let dragLastX  = 0, dragLastY  = 0;
let dragMoved  = false;
const DRAG_THRESHOLD = 4;

// ¿Se arrastra una estación (modo edición) en este gesto?
// Si es true, el mouseup NO debe disparar pendingClick — si no, al soltar
// se intentaría lanzar la partida sobre la estación recién movida.
let isEditingDrag = false;
// Estado del modificador shift, actualizado desde los listeners de teclado
// del canvas para que el snap fino funcione mientras se arrastra.
let shiftDown = false;

// ── Popup de selección de línea (transbordos) ─────────────────────────────
// stationPopup: { stationName, options: [{lineId, lineName, lineColor, stationIndex, locked}] }
let stationPopup   = null;
let _popupRowRects = [];   // calculados en drawStationPopup → usados en input

// difficultyPopup: { lineId, stationIndex, stationName }
let difficultyPopup = null;
let _diffPopupRects = [];  // calculados en drawDifficultyPopup → usados en input
let _diffEditRect   = null; // rect del botón "Configurar escenario"

// directionPopup: { lineId, stationIndex, stationName, terminalNorth, terminalSouth }
let directionPopup  = null;
let _dirPopupRects  = [];

// ── Helpers de geometría para el popup ───────────────────────────────────
function _roundRect(ctx, x, y, w, h, r) {
  if (ctx.roundRect) {
    ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
  } else {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
}

// ─────────────────────────────────────────────────────────────────────────
/** Abre el popup de selección de dificultad antes de lanzar la partida. */
function _showDifficultyPicker(lineId, stationIndex, stationName) {
  clearTooltip();
  stationPopup    = null;
  _popupRowRects  = [];
  difficultyPopup = { lineId, stationIndex, stationName: stationName || '' };
  _diffPopupRects = [];
}

/**
 * Activa el preset elegido y, si la estación no es terminal, abre el popup
 * de dirección (Andén 1 / Andén 2). Si es terminal, fuerza la dirección
 * obligatoria y lanza la partida directamente.
 */
function _launchWithPreset(presetId, lineId, stationIndex) {
  PM.setActive(presetId);
  difficultyPopup = null;
  _diffPopupRects = [];
  _diffEditRect   = null;

  const line = MapaMetroMadrid.getLine(lineId);
  if (!line) {
    launchScenario(lineId, null);
    return;
  }

  // stationIndex null = click en el trazo o atajo de teclado sin estación
  // concreta → resolver a la estación de inicio por defecto de la línea.
  let effectiveIndex = stationIndex;
  if (effectiveIndex == null) {
    const defaultName = line.startStation || line.stations[0]?.name;
    effectiveIndex = line.stations.findIndex(s => s.name === defaultName);
    if (effectiveIndex < 0) effectiveIndex = 0;
  }

  const totalStations = line.stations.length;
  const stationName   = line.stations[effectiveIndex]?.name ?? '';

  // ── Estaciones terminales: dirección forzada, no hay nada que elegir ─────
  if (effectiveIndex === 0) {
    STATE.selectedDirection = 'north';   // sólo se puede ir hacia adelante
    launchScenario(lineId, effectiveIndex);
    return;
  }
  if (effectiveIndex === totalStations - 1) {
    STATE.selectedDirection = 'south';   // sólo se puede dar la vuelta
    launchScenario(lineId, effectiveIndex);
    return;
  }

  // ── Estación intermedia: mostrar selector de dirección (Andén 1 / 2) ─────
  _showDirectionPicker(lineId, effectiveIndex, stationName, line);
}

/** Abre el popup que permite elegir Andén 1 (norte) o Andén 2 (sur). */
function _showDirectionPicker(lineId, stationIndex, stationName, line) {
  clearTooltip();
  const stations = line.stations;
  directionPopup = {
    lineId, stationIndex,
    stationName:    stationName || '',
    terminalNorth:  stations[stations.length - 1].name,
    terminalSouth:  stations[0].name,
  };
  _dirPopupRects = [];
}

/** Lanza la partida con la dirección elegida. */
function _launchWithDirection(direction) {
  if (!directionPopup) return;
  STATE.selectedDirection = direction;
  const { lineId, stationIndex } = directionPopup;
  directionPopup = null;
  _dirPopupRects = [];
  launchScenario(lineId, stationIndex);
}

/** Abre el editor de escenario para la estación seleccionada en el popup.
 *  Si el popup vino del trazo de línea (stationIndex=null), resolvemos la
 *  estación de inicio efectiva para esa línea. Para L3 es "Delicias". */
function _openSceneEditorFromPopup() {
  if (!difficultyPopup) return;
  let { lineId, stationIndex, stationName } = difficultyPopup;

  // Si no hay índice → usar la estación inicial real de la línea.
  if (stationIndex == null) {
    const line = MapaMetroMadrid.getLine(lineId);
    if (line) {
      const startName = line.startStation || (line.stations?.[0]?.name);
      const idx = line.stations.findIndex(s => s.name === startName);
      if (idx >= 0) {
        stationIndex = idx;
        stationName  = startName;
      }
    }
  }

  const ctxObj = { lineId, stationIndex, stationName, returnPhase: 'ARCADE' };
  difficultyPopup = null;
  _diffPopupRects = [];
  _diffEditRect   = null;
  openSceneEditor(ctxObj);
}

// ─────────────────────────────────────────────────────────────────────────
function ensureListeners() {
  if (listenersAttached) return;
  listenersAttached = true;

  // Capturamos Shift para usarlo como modificador de snap fino durante drag.
  window.addEventListener('keydown', (e) => { if (e.key === 'Shift') shiftDown = true; });
  window.addEventListener('keyup',   (e) => { if (e.key === 'Shift') shiftDown = false; });

  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouseX = e.clientX - r.left;
    mouseY = e.clientY - r.top;
    if (STATE.phase !== 'ARCADE') return;

    // Con popup activo, sólo actualizamos cursor sobre las filas.
    if (stationPopup) {
      const onRow = _popupRowRects.some(
        rc => mouseX >= rc.x && mouseX <= rc.x + rc.w &&
              mouseY >= rc.y && mouseY <= rc.y + rc.h
      );
      canvas.style.cursor = onRow ? 'pointer' : 'default';
      return;
    }

    // Modo edición: drag de estación (mover) o hover de handle.
    if (MapaMetroMadrid.isEditing()) {
      if (isEditingDrag && MapaMetroMadrid.isDragging()) {
        clearTooltip();
        MapaMetroMadrid.updateStationDrag(mouseX, mouseY, shiftDown);
        canvas.style.cursor = 'grabbing';
        return;
      }
      if (isDragging) {
        // Pan normal en modo edición cuando el drag NO empezó sobre un handle.
        const dx = mouseX - dragLastX;
        const dy = mouseY - dragLastY;
        dragLastX = mouseX; dragLastY = mouseY;
        if (!dragMoved && Math.hypot(mouseX - dragStartX, mouseY - dragStartY) > DRAG_THRESHOLD) dragMoved = true;
        if (dragMoved) { MapaMetroMadrid.pan(dx, dy); canvas.style.cursor = 'grabbing'; }
        return;
      }
      const hover = MapaMetroMadrid.setEditHoverFromMouse(mouseX, mouseY);
      canvas.style.cursor = hover ? 'pointer' : (MapaMetroMadrid.isInsideMap(mouseX, mouseY) ? 'crosshair' : 'default');
      return;
    }

    // Arrastre → pan
    if (isDragging) {
      const dx = mouseX - dragLastX;
      const dy = mouseY - dragLastY;
      dragLastX = mouseX;
      dragLastY = mouseY;
      if (!dragMoved &&
          Math.hypot(mouseX - dragStartX, mouseY - dragStartY) > DRAG_THRESHOLD) {
        dragMoved = true;
      }
      if (dragMoved) {
        clearTooltip();
        MapaMetroMadrid.pan(dx, dy);
        canvas.style.cursor = 'grabbing';
      }
      return;
    }

    // Hover estación (prioridad) → hover línea
    const station = MapaMetroMadrid.setStationHoverFromMouse(mouseX, mouseY);
    let line = null;
    if (!station) line = MapaMetroMadrid.setHoverFromMouse(mouseX, mouseY);

    const inMap    = MapaMetroMadrid.isInsideMap(mouseX, mouseY);
    const isHovered = inMap && (station != null || line != null);
    if (isHovered)   canvas.style.cursor = 'pointer';
    else if (inMap)  canvas.style.cursor = 'grab';
    else             canvas.style.cursor = 'default';
  });

  canvas.addEventListener('mousedown', (e) => {
    if (STATE.phase !== 'ARCADE') return;
    const r = canvas.getBoundingClientRect();
    mouseX = e.clientX - r.left;
    mouseY = e.clientY - r.top;
    if (e.button !== 0) return;

    // En modo edición: si hay una estación bajo el cursor, agarrarla;
    // si no, comportarse como pan normal.
    if (MapaMetroMadrid.isEditing()) {
      if (MapaMetroMadrid.beginStationDrag(mouseX, mouseY)) {
        isEditingDrag = true;
        isDragging = false;
        return;
      }
      if (MapaMetroMadrid.isInsideMap(mouseX, mouseY)) {
        isDragging = true; dragMoved = false;
        dragStartX = dragLastX = mouseX; dragStartY = dragLastY = mouseY;
      }
      return;
    }

    // Con popup activo aceptamos clic en cualquier punto del canvas.
    if (stationPopup || MapaMetroMadrid.isInsideMap(mouseX, mouseY)) {
      isDragging = true;
      dragMoved  = false;
      dragStartX = dragLastX = mouseX;
      dragStartY = dragLastY = mouseY;
    }
  });

  canvas.addEventListener('mouseup', () => {
    // Cierre de drag de estación en modo edición: persiste el draft, no
    // generamos pendingClick (no queremos lanzar partida tras editar).
    if (isEditingDrag) {
      MapaMetroMadrid.endStationDrag();
      isEditingDrag = false;
      canvas.style.cursor = MapaMetroMadrid.isInsideMap(mouseX, mouseY) ? 'crosshair' : 'default';
      return;
    }
    if (!isDragging) return;
    isDragging = false;
    if (!dragMoved) pendingClick = true;
    if (stationPopup) { canvas.style.cursor = 'default'; return; }
    if (MapaMetroMadrid.isEditing()) {
      canvas.style.cursor = MapaMetroMadrid.isInsideMap(mouseX, mouseY) ? 'crosshair' : 'default';
      return;
    }
    canvas.style.cursor = MapaMetroMadrid.isInsideMap(mouseX, mouseY) ? 'grab' : 'default';
  });

  canvas.addEventListener('mouseleave', () => {
    isDragging = false;
    if (isEditingDrag) {
      MapaMetroMadrid.endStationDrag();
      isEditingDrag = false;
    }
  });

  canvas.addEventListener('wheel', (e) => {
    if (STATE.phase !== 'ARCADE' || stationPopup) return;
    const r = canvas.getBoundingClientRect();
    const sx = e.clientX - r.left;
    const sy = e.clientY - r.top;
    if (!MapaMetroMadrid.isInsideMap(sx, sy)) return;
    e.preventDefault();
    MapaMetroMadrid.zoomAt(sx, sy, e.deltaY < 0 ? 1.15 : (1 / 1.15));
    clearTooltip();
  }, { passive: false });
}

// ── Lanzar partida ────────────────────────────────────────────────────────
function launchScenario(lineId, stationIndex) {
  clearTooltip();
  stationPopup   = null;
  _popupRowRects = [];
  canvas.style.cursor = 'default';
  STATE.selectedScenario = `linea_${lineId}`;
  STATE.selectedStartStationIndex = (stationIndex != null) ? stationIndex : null;
  STATE.phase = 'PLAYING';
}

// ── Selecciona opción del popup y muestra selector de dificultad ─────────
function _selectPopupOption(index) {
  if (!stationPopup) return;
  const opt = stationPopup.options[index];
  if (!opt) return;
  if (opt.locked) {
    // Línea bloqueada: cerrar popup, nada más.
    stationPopup   = null;
    _popupRowRects = [];
    return;
  }
  const sName    = stationPopup.stationName;
  stationPopup   = null;
  _popupRowRects = [];
  _showDifficultyPicker(opt.lineId, opt.stationIndex, sName);
}

// Helper: comprueba si alguna de las variantes (minúscula/mayúscula) de
// una tecla está pulsada. Consume ambas variantes si match.
function _consumeAny(keys, consumeKey, ...variants) {
  let hit = false;
  for (const k of variants) {
    if (keys[k]) { consumeKey(k); hit = true; }
  }
  return hit;
}

// ── Input ──────────────────────────────────────────────────────
export function handleArcadeInput(keys, consumeKey) {
  ensureListeners();

  // ── Modo edición del mapa (intercepta todo lo demás) ─────────────────
  if (MapaMetroMadrid.isEditing()) {
    // Confirmación de bloqueo pendiente: Y confirma, N/Esc cancela.
    if (MapaMetroMadrid.isPendingLockConfirm()) {
      if (_consumeAny(keys, consumeKey, 'y', 'Y')) {
        MapaMetroMadrid.confirmLock();
        return;
      }
      if (_consumeAny(keys, consumeKey, 'n', 'N', 'Escape')) {
        MapaMetroMadrid.cancelLock();
        return;
      }
      // Bloquear el resto del input mientras se espera Y/N.
      pendingClick = false;
      return;
    }

    if (_consumeAny(keys, consumeKey, 's', 'S')) { MapaMetroMadrid.saveDraft(); pendingClick = false; return; }
    if (_consumeAny(keys, consumeKey, 'l', 'L')) { MapaMetroMadrid.requestLock(); pendingClick = false; return; }
    if (_consumeAny(keys, consumeKey, 'r', 'R')) { MapaMetroMadrid.discardDraft(); pendingClick = false; return; }
    if (_consumeAny(keys, consumeKey, 'e', 'E', 'Escape')) {
      MapaMetroMadrid.exitEditMode();
      canvas.style.cursor = 'default';
      pendingClick = false;
      return;
    }

    // Ignoramos clics: en edición el clic sólo arrastra estaciones.
    pendingClick = false;
    return;
  }

  // ── Atajo global: E entra en modo edición (si no está bloqueado) ──────
  if (_consumeAny(keys, consumeKey, 'e', 'E')) {
    MapaMetroMadrid.enterEditMode();
    canvas.style.cursor = 'crosshair';
    pendingClick = false;
    return;
  }

  // ── Popup activo ─────────────────────────────────────────────
  if (stationPopup) {
    // Q cierra el popup
    if (keys['q'] || keys['Q']) {
      consumeKey('q'); consumeKey('Q');
      stationPopup = null; _popupRowRects = [];
      return;
    }
    // Atajos numéricos 1–9
    for (let i = 0; i < stationPopup.options.length && i < 9; i++) {
      const key = String(i + 1);
      if (keys[key]) {
        consumeKey(key);
        _selectPopupOption(i);
        return;
      }
    }
    // Clic sobre el canvas
    if (pendingClick) {
      pendingClick = false;
      for (const rc of _popupRowRects) {
        if (mouseX >= rc.x && mouseX <= rc.x + rc.w &&
            mouseY >= rc.y && mouseY <= rc.y + rc.h) {
          _selectPopupOption(rc.index);
          return;
        }
      }
      // Clic fuera del popup → cerrar
      stationPopup = null; _popupRowRects = [];
      return;
    }
    // ESC cierra el popup (no va a START)
    if (keys['Escape']) {
      consumeKey('Escape');
      stationPopup = null; _popupRowRects = [];
      return;
    }
    return; // bloquear resto del input mientras el popup está abierto
  }

  // ── Selector de dificultad ────────────────────────────────────────────
  if (difficultyPopup) {
    const allPresets = PM.getAll();
    const presets    = [
      ...allPresets.filter(p => PM.isBuiltin(p.id)),
      ...allPresets.filter(p => !PM.isBuiltin(p.id)),
    ];

    // Q / ESC → cancelar
    if (keys['q'] || keys['Q']) {
      consumeKey('q'); consumeKey('Q');
      difficultyPopup = null; _diffPopupRects = []; _diffEditRect = null;
      return;
    }
    if (keys['Escape']) {
      consumeKey('Escape');
      difficultyPopup = null; _diffPopupRects = []; _diffEditRect = null;
      return;
    }

    // C → abrir editor de escenario
    if (_consumeAny(keys, consumeKey, 'c', 'C')) {
      _openSceneEditorFromPopup();
      return;
    }

    // Enter / Espacio → jugar con el preset activo
    if (keys['Enter'] || keys[' ']) {
      consumeKey('Enter'); consumeKey(' ');
      _launchWithPreset(PM.getActiveId(), difficultyPopup.lineId, difficultyPopup.stationIndex);
      return;
    }

    // Atajos numéricos 1–9
    for (let i = 0; i < presets.length && i < 9; i++) {
      const key = String(i + 1);
      if (keys[key]) {
        consumeKey(key);
        _launchWithPreset(presets[i].id, difficultyPopup.lineId, difficultyPopup.stationIndex);
        return;
      }
    }

    // Clic sobre una fila del popup
    if (pendingClick) {
      pendingClick = false;
      // Botón "Configurar escenario"
      if (_diffEditRect &&
          mouseX >= _diffEditRect.x && mouseX <= _diffEditRect.x + _diffEditRect.w &&
          mouseY >= _diffEditRect.y && mouseY <= _diffEditRect.y + _diffEditRect.h) {
        _openSceneEditorFromPopup();
        return;
      }
      for (const rc of _diffPopupRects) {
        if (mouseX >= rc.x && mouseX <= rc.x + rc.w &&
            mouseY >= rc.y && mouseY <= rc.y + rc.h) {
          _launchWithPreset(rc.presetId, difficultyPopup.lineId, difficultyPopup.stationIndex);
          return;
        }
      }
      // Clic fuera → cerrar
      difficultyPopup = null; _diffPopupRects = []; _diffEditRect = null;
      return;
    }

    return; // bloquear resto del input mientras el popup está abierto
  }

  // ── Selector de dirección (Andén 1 / Andén 2) ─────────────────────────
  if (directionPopup) {
    // Q / ESC → cancelar
    if (keys['q'] || keys['Q']) {
      consumeKey('q'); consumeKey('Q');
      directionPopup = null; _dirPopupRects = [];
      return;
    }
    if (keys['Escape']) {
      consumeKey('Escape');
      directionPopup = null; _dirPopupRects = [];
      return;
    }
    // 1 = Andén 1 (norte → Moncloa); 2 = Andén 2 (sur → El Casar)
    if (keys['1']) { consumeKey('1'); _launchWithDirection('north'); return; }
    if (keys['2']) { consumeKey('2'); _launchWithDirection('south'); return; }
    // Enter → confirmar la opción ya marcada (north por defecto)
    if (keys['Enter'] || keys[' ']) {
      consumeKey('Enter'); consumeKey(' ');
      _launchWithDirection('north');
      return;
    }
    // Clic sobre una de las dos opciones
    if (pendingClick) {
      pendingClick = false;
      for (const rc of _dirPopupRects) {
        if (mouseX >= rc.x && mouseX <= rc.x + rc.w &&
            mouseY >= rc.y && mouseY <= rc.y + rc.h) {
          _launchWithDirection(rc.direction);
          return;
        }
      }
      // Clic fuera → cerrar
      directionPopup = null; _dirPopupRects = [];
      return;
    }
    return; // bloquear resto del input mientras el popup está abierto
  }

  // ── Clic en el mapa ───────────────────────────────────────
  if (pendingClick) {
    pendingClick = false;

    // 1) Estación bajo el cursor
    const stationAction = MapaMetroMadrid.handleStationClick(mouseX, mouseY);
    if (stationAction) {
      const line    = MapaMetroMadrid.getLine(stationAction.lineId);
      const station = line?.stations[stationAction.stationIndex];
      if (station) {
        const options = MapaMetroMadrid.getStationLines(station.name);
        if (options.length > 1) {
          // Transbordo → abrir popup de selección de línea.
          clearTooltip();
          stationPopup = { stationName: station.name, options };
          return;
        }
        // Estación con una sola línea: comportamiento directo.
        if (line.locked) {
          MapaMetroMadrid.showLockedToast();
        } else {
          _showDifficultyPicker(stationAction.lineId, stationAction.stationIndex, station.name);
        }
      }
      return;
    }

    // 2) Trazo de línea
    const action = MapaMetroMadrid.handleMapClick(mouseX, mouseY);
    if (action === 'PLAY_LINE_3') { _showDifficultyPicker(3, null, 'Línea 3'); return; }
    // 'LOCKED' → toast gestionado internamente
  }

  // Enter / Espacio: jugar L3 directamente
  if (keys['Enter'] || keys[' ']) {
    consumeKey('Enter'); consumeKey(' ');
    if (MapaMetroMadrid.isUnlocked(3)) { _showDifficultyPicker(3, null, 'Línea 3'); return; }
  }

  // R: reset de zoom/pan
  if (keys['r'] || keys['R']) {
    consumeKey('r'); consumeKey('R');
    MapaMetroMadrid.resetView(); clearTooltip();
  }

  // ESC: volver a START
  if (keys['Escape']) {
    clearTooltip();
    canvas.style.cursor = 'default';
    STATE.phase = 'START';
    consumeKey('Escape');
  }
}

// ── Render ────────────────────────────────────────────────────────────────
export function drawArcadeScreen(ctx) {
  ensureListeners();

  ctx.fillStyle = PAL.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Título compacto en la parte superior (todo en una línea)
  ctx.fillStyle = PAL.trainYellow;
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('MODO ARCADE · METRO DE MADRID · ENERO 2026', canvas.width / 2, 22);

  // ── Ranking en la esquina superior izquierda ──────────────────────────────────
  const rankX   = 10;
  const rankW   = 170;
  const rankY   = 44;
  const history = STATE.flightHistory;
  const MAX_VIS = 5;
  const ROW_H   = 26;

  ctx.fillStyle = '#aaa';
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('TOP VUELOS', rankX + rankW / 2, rankY);

  ctx.fillStyle = '#333';
  ctx.fillRect(rankX, rankY + 5, rankW, 1);

  if (history.length === 0) {
    ctx.fillStyle = '#444';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Sin partidas aún', rankX + rankW / 2, rankY + 28);
  } else {
    const shown = Math.min(history.length, MAX_VIS);
    for (let i = 0; i < shown; i++) {
      const entry  = history[i];
      const rowTop = rankY + 12 + i * ROW_H;
      let bg, textColor, medal;
      if      (i === 0) { bg = 'rgba(245,197,24,0.14)';  textColor = '#f5c518'; medal = '🥇'; }
      else if (i === 1) { bg = 'rgba(200,200,200,0.08)'; textColor = '#bbb';    medal = '🥈'; }
      else if (i === 2) { bg = 'rgba(160,100,40,0.10)';  textColor = '#cd7f32'; medal = '🥉'; }
      else              { bg = null;                      textColor = '#666';    medal = String(i + 1); }

      if (bg) { ctx.fillStyle = bg; ctx.fillRect(rankX, rowTop, rankW, ROW_H - 2); }

      // Medalla / posición + tiempo en la fila principal
      ctx.fillStyle = textColor;
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.fillText(medal, rankX + 6, rowTop + 16);

      ctx.textAlign = 'right';
      ctx.fillText(formatFlightTime(entry.seconds), rankX + rankW - 6, rowTop + 16);

      // Fecha discreta en gris (sólo top 3)
      if (i < 3) {
        ctx.fillStyle = '#555';
        ctx.font = '8px monospace';
        ctx.fillText(entry.date, rankX + rankW - 6, rowTop + 24);
      }
    }
    if (history.length > MAX_VIS) {
      ctx.fillStyle = '#555'; ctx.font = '9px monospace'; ctx.textAlign = 'center';
      ctx.fillText('▼ ver más', rankX + rankW / 2, rankY + 12 + MAX_VIS * ROW_H + 10);
    }
  }

  // ── Mapa: ocupa casi toda la pantalla ─────────────────────────────────────────
  // Padding mínimo (sólo lo justo para título, ranking y pista inferior)
  // para maximizar el rectángulo de datos al hacer zoom.
  MapaMetroMadrid.drawMapOverview(ctx, canvas, {
    padTop: 42,
    padBottom: 18,
    padLeft: rankX + rankW + 10,  // = 190, justo después del ranking
    padRight: 8,
  });

  // Pista inferior — más pequeña y pegada al borde
  ctx.fillStyle = '#888';
  ctx.font = '9px monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  let hint;
  if (MapaMetroMadrid.isEditing()) {
    hint = MapaMetroMadrid.isPendingLockConfirm()
      ? 'BLOQUEAR EDICIÓN: [Y] CONFIRMAR · [N/ESC] CANCELAR'
      : 'EDICIÓN · ARRASTRA ESTACIONES · [S] GUARDAR · [L] BLOQUEAR · [R] DESCARTAR · [E/ESC] SALIR';
  } else if (directionPopup) {
    hint = 'ELIGE DIRECCIÓN · [1] ANDÉN 1 · [2] ANDÉN 2 · ENTER ANDÉN 1 · Q CANCELAR';
  } else if (difficultyPopup) {
    hint = 'ELIGE DIFICULTAD · 1-4 ATAJOS · ENTER JUGAR · C EDITAR ESCENARIO · Q CANCELAR';
  } else if (stationPopup) {
    hint = 'CLIC EN LÍNEA PARA CONTINUAR · 1-9 ATAJOS · Q CANCELAR';
  } else {
    const lockedSuffix = MapaMetroMadrid.isEditLocked() ? '' : ' · [E] EDITAR MAPA';
    hint = `CLIC LÍNEA/ESTACIÓN · ARRASTRAR PAN · RUEDA ZOOM · R RESET${lockedSuffix} · ESC VOLVER`;
  }
  ctx.fillText(hint, canvas.width / 2, canvas.height - 6);

  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';

  // Tooltip — encima del mapa, debajo de los popups
  if (!stationPopup && !difficultyPopup && !directionPopup) drawTooltip(ctx);

  // Popup de selección de línea (transbordos)
  if (stationPopup) drawStationPopup(ctx);

  // Popup de selección de dificultad
  if (difficultyPopup) drawDifficultyPopup(ctx);

  // Popup de selección de dirección — capa superior
  if (directionPopup) drawDirectionPopup(ctx);
}

// ── Popup de selección de línea ───────────────────────────────────────────
function drawStationPopup(ctx) {
  if (!stationPopup) return;
  _popupRowRects = [];

  const opts     = stationPopup.options;
  const PAD      = 16;
  const ROW_H    = 40;
  const W        = 310;
  const HEADER_H = 54;
  const FOOTER_H = 28;
  const H        = HEADER_H + opts.length * ROW_H + FOOTER_H;
  const tx       = Math.round(canvas.width  / 2 - W / 2);
  const ty       = Math.round(canvas.height / 2 - H / 2);

  // Fondo oscurecido sobre todo el canvas
  ctx.fillStyle = 'rgba(0,0,0,0.62)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Caja
  ctx.fillStyle = '#0d0d20';
  _roundRect(ctx, tx, ty, W, H, 8); ctx.fill();
  ctx.strokeStyle = '#3a3a70'; ctx.lineWidth = 1.5;
  _roundRect(ctx, tx, ty, W, H, 8); ctx.stroke();

  // Cabecera
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillText('ELIGE LÍNEA', tx + W / 2, ty + 20);

  ctx.fillStyle = '#9999bb';
  ctx.font = '11px monospace';
  ctx.fillText(stationPopup.stationName.toUpperCase(), tx + W / 2, ty + 38);

  // Separador
  ctx.fillStyle = '#222255';
  ctx.fillRect(tx + PAD, ty + HEADER_H - 4, W - PAD * 2, 1);

  // Filas
  for (let i = 0; i < opts.length; i++) {
    const opt    = opts[i];
    const ry     = ty + HEADER_H + i * ROW_H;
    const rx     = tx + 6;
    const rw     = W - 12;
    const rh     = ROW_H - 4;
    const hovered = mouseX >= rx && mouseX <= rx + rw &&
                    mouseY >= ry && mouseY <= ry + rh;

    // Hover highlight
    if (hovered) {
      ctx.fillStyle = opt.locked
        ? 'rgba(80,20,20,0.55)'
        : 'rgba(255,255,255,0.07)';
      ctx.fillRect(rx, ry, rw, rh);
    }

    _popupRowRects.push({ x: rx, y: ry, w: rw, h: rh, index: i });

    // Badge de línea
    const badgeX = tx + PAD;
    const badgeY = ry + (ROW_H - 22) / 2;
    ctx.globalAlpha = opt.locked ? 0.45 : 1;
    ctx.fillStyle   = opt.locked ? '#444' : opt.lineColor;
    _roundRect(ctx, badgeX, badgeY, 26, 22, 3); ctx.fill();
    ctx.globalAlpha = 1;

    ctx.fillStyle    = '#fff';
    ctx.font         = 'bold 10px monospace';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(opt.lineId), badgeX + 13, ry + ROW_H / 2);

    // Nombre de la línea
    ctx.fillStyle    = opt.locked ? '#555566' : '#ccccee';
    ctx.font         = '11px monospace';
    ctx.textAlign    = 'left';
    ctx.fillText(opt.lineName, tx + PAD + 32, ry + ROW_H / 2);

    // Acción / estado
    if (opt.locked) {
      ctx.fillStyle = '#773333';
      ctx.font      = '10px monospace';
      ctx.textAlign = 'right';
      ctx.fillText('BLOQUEADA', tx + W - PAD, ry + ROW_H / 2);
    } else {
      ctx.fillStyle = '#5dcaa5';
      ctx.font      = 'bold 10px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`[${i + 1}] JUGAR`, tx + W - PAD, ry + ROW_H / 2);
    }
  }

  // Pie: atajo para cerrar
  ctx.fillStyle    = '#444466';
  ctx.font         = '10px monospace';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('Q · Cancelar  ·  ESC · Cancelar', tx + W / 2, ty + H - 9);

  // Restaurar estado del contexto
  ctx.textAlign    = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.globalAlpha  = 1;
  ctx.shadowBlur   = 0;
}

// ── Popup selector de dificultad / preset ────────────────────────────────────
function drawDifficultyPopup(ctx) {
  if (!difficultyPopup) return;
  _diffPopupRects = [];
  _diffEditRect   = null;

  // Presets: primero los builtin (Fácil/Normal/Difícil/Pesadilla), luego los custom.
  const allPresets = PM.getAll();
  const presets    = [
    ...allPresets.filter(p => PM.isBuiltin(p.id)),
    ...allPresets.filter(p => !PM.isBuiltin(p.id)),
  ];

  const PAD      = 18;
  const ROW_H    = 48;
  const W        = 340;
  const HEADER_H = 64;
  const EDIT_H   = 36;       // bloque del botón "Configurar escenario"
  const FOOTER_H = 30;
  const H        = HEADER_H + presets.length * ROW_H + EDIT_H + FOOTER_H;
  const tx       = Math.round(canvas.width  / 2 - W / 2);
  const ty       = Math.round(canvas.height / 2 - H / 2);

  // Telón oscuro
  ctx.fillStyle = 'rgba(0,0,0,0.68)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Caja principal
  ctx.fillStyle = '#0d0d22';
  _roundRect(ctx, tx, ty, W, H, 10); ctx.fill();
  ctx.strokeStyle = '#5a4a90'; ctx.lineWidth = 1.5;
  _roundRect(ctx, tx, ty, W, H, 10); ctx.stroke();

  // Cabecera
  ctx.fillStyle    = '#ffffff';
  ctx.font         = 'bold 14px monospace';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('ELIGE DIFICULTAD', tx + W / 2, ty + 22);

  ctx.fillStyle = '#8888bb';
  ctx.font      = '11px monospace';
  ctx.fillText((difficultyPopup.stationName || '').toUpperCase(), tx + W / 2, ty + 42);

  // Separador
  ctx.fillStyle = '#28285a';
  ctx.fillRect(tx + PAD, ty + HEADER_H - 6, W - PAD * 2, 1);

  // Filas de preset
  for (let i = 0; i < presets.length; i++) {
    const preset   = presets[i];
    const ry       = ty + HEADER_H + i * ROW_H;
    const rx       = tx + 6;
    const rw       = W - 12;
    const rh       = ROW_H - 4;
    const isActive = preset.id === PM.getActiveId();
    const hovered  = mouseX >= rx && mouseX <= rx + rw &&
                     mouseY >= ry && mouseY <= ry + rh;

    // Fondo de fila
    if (isActive) {
      ctx.fillStyle = 'rgba(93,202,165,0.12)';
      ctx.fillRect(rx, ry, rw, rh);
    } else if (hovered) {
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(rx, ry, rw, rh);
    }

    _diffPopupRects.push({ x: rx, y: ry, w: rw, h: rh, presetId: preset.id });

    // Círculo de color de dificultad
    const diffColor = DIFFICULTY_COLORS[preset.difficulty] || '#888888';
    ctx.fillStyle   = diffColor;
    ctx.beginPath();
    ctx.arc(tx + PAD + 13, ry + ROW_H / 2 - 2, 9, 0, Math.PI * 2);
    ctx.fill();
    if (isActive) {
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Número de atajo (encima del círculo)
    ctx.fillStyle    = '#000000';
    ctx.font         = 'bold 10px monospace';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(i + 1), tx + PAD + 13, ry + ROW_H / 2 - 2);

    // Nombre del preset
    ctx.fillStyle    = isActive ? '#ffffff' : '#ccccee';
    ctx.font         = isActive ? 'bold 13px monospace' : '12px monospace';
    ctx.textAlign    = 'left';
    ctx.fillText(preset.name, tx + PAD + 30, ry + ROW_H / 2 - 4);

    // Dificultad (derecha)
    ctx.fillStyle = diffColor;
    ctx.font      = '10px monospace';
    ctx.textAlign = 'right';
    ctx.fillText((preset.difficulty || '').toUpperCase(), tx + W - PAD, ry + ROW_H / 2 - 4);

    // "ENTER para jugar" o "ACTIVO" bajo el nombre cuando está seleccionado
    if (isActive) {
      ctx.fillStyle = '#5dcaa5';
      ctx.font      = '9px monospace';
      ctx.textAlign = 'left';
      ctx.fillText('▶ ENTER para jugar', tx + PAD + 30, ry + ROW_H / 2 + 11);
    }
  }

  // ── Botón "Configurar escenario" ────────────────────────────────────────
  const editY = ty + HEADER_H + presets.length * ROW_H + 6;
  const editX = tx + PAD;
  const editW = W - PAD * 2;
  const editH = EDIT_H - 12;
  const editHover = mouseX >= editX && mouseX <= editX + editW &&
                    mouseY >= editY && mouseY <= editY + editH;
  const customized = hasOverride(difficultyPopup.stationName);

  ctx.fillStyle = editHover
    ? 'rgba(245,197,24,0.16)'
    : (customized ? 'rgba(93,202,165,0.10)' : 'rgba(255,255,255,0.04)');
  ctx.fillRect(editX, editY, editW, editH);
  ctx.strokeStyle = editHover ? '#f5c518' : (customized ? '#5dcaa5' : '#5a4a90');
  ctx.lineWidth = 1;
  ctx.strokeRect(editX + 0.5, editY + 0.5, editW - 1, editH - 1);

  ctx.fillStyle = editHover ? '#f5c518' : (customized ? '#5dcaa5' : '#aaaacc');
  ctx.font      = 'bold 11px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const editLabel = customized
    ? '⚙ EDITAR ESCENARIO  ·  [C]   (personalizado)'
    : '⚙ CONFIGURAR ESCENARIO  ·  [C]';
  ctx.fillText(editLabel, editX + editW / 2, editY + editH / 2);
  _diffEditRect = { x: editX, y: editY, w: editW, h: editH };

  // Pie
  ctx.fillStyle    = '#444466';
  ctx.font         = '10px monospace';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('1-9 elegir  ·  ENTER jugar  ·  C editar escenario  ·  Q cancelar', tx + W / 2, ty + H - 10);

  // Restaurar estado
  ctx.textAlign    = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.globalAlpha  = 1;
  ctx.shadowBlur   = 0;
}

// ── Popup selector de dirección (Andén 1 / Andén 2) ──────────────────────────
function drawDirectionPopup(ctx) {
  if (!directionPopup) return;
  _dirPopupRects = [];

  const PAD       = 18;
  const ROW_H     = 64;       // filas grandes — sólo hay 2 opciones
  const W         = 360;
  const HEADER_H  = 64;
  const FOOTER_H  = 30;
  const H         = HEADER_H + 2 * ROW_H + FOOTER_H;
  const tx        = Math.round(canvas.width  / 2 - W / 2);
  const ty        = Math.round(canvas.height / 2 - H / 2);

  // Telón oscuro
  ctx.fillStyle = 'rgba(0,0,0,0.68)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Caja
  ctx.fillStyle = '#0d0d22';
  _roundRect(ctx, tx, ty, W, H, 10); ctx.fill();
  ctx.strokeStyle = '#5a4a90'; ctx.lineWidth = 1.5;
  _roundRect(ctx, tx, ty, W, H, 10); ctx.stroke();

  // Cabecera
  ctx.fillStyle    = '#ffffff';
  ctx.font         = 'bold 14px monospace';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('ELIGE DIRECCIÓN', tx + W / 2, ty + 22);

  ctx.fillStyle = '#8888bb';
  ctx.font      = '11px monospace';
  ctx.fillText((directionPopup.stationName || '').toUpperCase(), tx + W / 2, ty + 42);

  // Separador
  ctx.fillStyle = '#28285a';
  ctx.fillRect(tx + PAD, ty + HEADER_H - 6, W - PAD * 2, 1);

  // ── Dos opciones ─────────────────────────────────────────────────────────
  const options = [
    { andenLabel: 'ANDÉN 1', dir: 'north', destino: directionPopup.terminalNorth, arrow: '→' },
    { andenLabel: 'ANDÉN 2', dir: 'south', destino: directionPopup.terminalSouth, arrow: '←' },
  ];

  for (let i = 0; i < options.length; i++) {
    const opt = options[i];
    const ry  = ty + HEADER_H + i * ROW_H;
    const rx  = tx + 6;
    const rw  = W - 12;
    const rh  = ROW_H - 4;
    const hovered = mouseX >= rx && mouseX <= rx + rw &&
                    mouseY >= ry && mouseY <= ry + rh;

    // Fondo de fila
    if (hovered) {
      ctx.fillStyle = 'rgba(255,255,255,0.07)';
      ctx.fillRect(rx, ry, rw, rh);
    }

    _dirPopupRects.push({ x: rx, y: ry, w: rw, h: rh, direction: opt.dir });

    // Badge "ANDÉN N" coloreado
    const badgeColor = i === 0 ? '#5DCAA5' : '#F5C518';
    ctx.fillStyle    = badgeColor;
    ctx.fillRect(tx + PAD, ry + ROW_H / 2 - 14, 70, 28);
    ctx.fillStyle    = '#0d0d22';
    ctx.font         = 'bold 11px monospace';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(opt.andenLabel, tx + PAD + 35, ry + ROW_H / 2);

    // Flecha de dirección + destino
    ctx.fillStyle    = '#ffffff';
    ctx.font         = 'bold 22px monospace';
    ctx.textAlign    = 'left';
    ctx.fillText(opt.arrow, tx + PAD + 88, ry + ROW_H / 2 - 5);

    ctx.fillStyle = '#aaaabb';
    ctx.font      = '9px monospace';
    ctx.fillText('SENTIDO', tx + PAD + 116, ry + ROW_H / 2 - 8);
    ctx.fillStyle = '#ffffff';
    ctx.font      = 'bold 13px monospace';
    ctx.fillText(opt.destino.toUpperCase(), tx + PAD + 116, ry + ROW_H / 2 + 8);

    // Atajo numérico (esquina derecha)
    ctx.fillStyle    = badgeColor;
    ctx.font         = 'bold 18px monospace';
    ctx.textAlign    = 'right';
    ctx.fillText(`[${i + 1}]`, tx + W - PAD, ry + ROW_H / 2 + 4);
  }

  // Pie con atajos
  ctx.fillStyle    = '#444466';
  ctx.font         = '10px monospace';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('1·Andén 1   2·Andén 2   ENTER·Andén 1   Q·Cancelar', tx + W / 2, ty + H - 10);

  // Restaurar estado
  ctx.textAlign    = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.globalAlpha  = 1;
  ctx.shadowBlur   = 0;
}
