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

import { canvas, STATE, PAL, formatFlightTime } from '../mecanica/estado.js';
import { MapaMetroMadrid, drawTooltip, clearTooltip } from '../escenarios/metros/metros_madrid/mapa_metro_madrid.js';

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

// ── Selecciona opción del popup y lanza (o cierra si bloqueada) ──────────
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
  launchScenario(opt.lineId, opt.stationIndex);
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
          launchScenario(stationAction.lineId, stationAction.stationIndex);
        }
      }
      return;
    }

    // 2) Trazo de línea
    const action = MapaMetroMadrid.handleMapClick(mouseX, mouseY);
    if (action === 'PLAY_LINE_3') { launchScenario(3, null); return; }
    // 'LOCKED' → toast gestionado internamente
  }

  // Enter / Espacio: jugar L3 directamente
  if (keys['Enter'] || keys[' ']) {
    consumeKey('Enter'); consumeKey(' ');
    if (MapaMetroMadrid.isUnlocked(3)) { launchScenario(3, null); return; }
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
  } else if (stationPopup) {
    hint = 'CLIC EN LÍNEA PARA JUGAR · 1-9 ATAJOS · Q CANCELAR';
  } else {
    const lockedSuffix = MapaMetroMadrid.isEditLocked() ? '' : ' · [E] EDITAR MAPA';
    hint = `CLIC LÍNEA/ESTACIÓN · ARRASTRAR PAN · RUEDA ZOOM · R RESET${lockedSuffix} · ESC VOLVER`;
  }
  ctx.fillText(hint, canvas.width / 2, canvas.height - 6);

  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';

  // Tooltip — encima del mapa, debajo del popup
  if (!stationPopup) drawTooltip(ctx);

  // Popup de selección de línea — capa superior
  if (stationPopup) drawStationPopup(ctx);
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
