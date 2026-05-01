// Controlador central del Metro de Madrid: las 12 líneas, sistema de
// desbloqueo y vista esquemática del mapa (réplica del plano oficial
// enero 2026). Los datos topológicos viven en `./datos_madrid.js`; este
// módulo se encarga del renderizado en Canvas, hover/click, zoom + pan
// y persistencia de progreso.

import {
  MADRID_LINES as DATA_LINES,
  METRO_LIGERO,
  RAMAL_R,
  ZONES as ZONE_POLYGONS,
  EXTERNAL_LABELS,
  INTERCHANGES,
} from './datos_madrid.js';

// ── Persistencia de la edición del mapa ─────────────────────────────────
// Las posiciones editadas se guardan por NOMBRE de estación para que un
// transbordo (mismo nombre en varias líneas) se mueva en bloque.
const LS_OVERRIDES_KEY = 'viajepalomero_map_overrides';
const LS_LOCKED_KEY    = 'viajepalomero_map_locked';

// Snap a rejilla normalizada. Por defecto 0.005; con Shift se duplica.
const SNAP_STEP        = 0.005;
const SNAP_STEP_FINE   = 0.0025;

// Re-export para compatibilidad con código previo (linea_3.js, etc.).
export const MADRID_LINES = DATA_LINES;

// ── Sistema de zonas (escala de dificultad geográfica) ────────────────────
// Forma legacy { A: {label,color,speedMult}, ... } usada por linea_3.js.
// La forma nueva (array de polígonos) está en datos_madrid.js como `ZONES`
// y se importa internamente como `ZONE_POLYGONS`.
export const ZONES = {
  A:  { label: 'Zona A',  color: '#ffffff', speedMult: 1.0 },
  B1: { label: 'Zona B1', color: '#ccddff', speedMult: 1.3 },
  B2: { label: 'Zona B2', color: '#aabbee', speedMult: 1.6 },
  B3: { label: 'Zona B3', color: '#8899cc', speedMult: 2.0 },
};

// ── Configuración visual ─────────────────────────────────────────────
// Aspect ratio mínimo del rectángulo de datos. Si el área disponible es
// más ancha, el dataRect se estira horizontalmente para llenarla por
// completo — maximiza el espacio aprovechable al hacer zoom. Sólo se
// aplica el clamp en pantallas verticales muy estrechas.
const MIN_MAP_ASPECT = 0.50;   // ratio W / H mínimo permitido
const ZOOM_MIN    = 1.0;
const ZOOM_MAX    = 8.0;
const ZOOM_STEP   = 1.15;      // factor por tick de rueda
const SHOW_ZONES  = false;     // true → pinta elipses de zona + etiquetas

// ── Estado interno del módulo ──────────────────────────────────────
let lastProjection   = { ox: 0, oy: 0, w: 0, h: 0 };   // área disponible
let lastDataRect     = { x: 0, y: 0, w: 0, h: 0 };     // rect aspect-correcto
const viewport       = { scale: 1.0, cx: 0.5, cy: 0.5 };
let hoveredLineId    = null;
let hoveredStationRef  = null;       // { lineId, stationIndex } | null
let selectedStationRef = null;       // { lineId, stationIndex } | null
let lockedToastTimer = 0;
let _tooltip = null;                 // { kind: 'line'|'station', line, station?, mx, my }

// ── Estado de modo edición ──────────────────────────────────────────────
let editMode         = false;        // ¿estamos en modo edición?
let editLocked       = false;        // ¿edición bloqueada definitivamente?
let draftOverrides   = {};           // { stationName: [nx, ny] }  (en memoria)
let pendingLockConfirm = false;      // L pulsada → esperar Y para confirmar
let editToast        = null;         // { text, framesLeft, kind }
let editHoverName    = null;         // nombre de estación bajo el cursor
let editDragName     = null;         // nombre de estación siendo arrastrada
let editCursorXY     = null;         // { mx, my, nx, ny } durante el drag

// ── Cache de polilíneas pre‑proyectadas ──────────────────────────────────
// Re‑calculamos sólo si cambia la proyección efectiva (rect + viewport).
// `cachedStationPx` guarda las estaciones tal cual proyectadas (para
// ticks, transbordos, hover de estación). `cachedPolylines` contiene la
// versión Manhattan (con codos a 45° + eje) usada para dibujar el trazo
// y detectar hover de línea.
let cachedProjKey = '';
const cachedPolylines = new Map();   // lineId → [{x,y}, ...] (Manhattan)
const cachedStationPx = new Map();   // lineId → [{x,y}, ...] (estaciones)

// Por ahora sólo se pintan las 12 líneas de Metro. Metro Ligero (ML1/2/3)
// y el Ramal R quedan ocultos hasta que sus datos sean fiables.
function getAllLinesWithGeometry() {
  return MADRID_LINES;
}

// Devuelve TODOS los grupos de estaciones donde aparece un nombre dado:
// MADRID_LINES, METRO_LIGERO, RAMAL_R y INTERCHANGES. Se usa al editar
// para mover en bloque cualquier estación compartida.
function _allStationContainers() {
  const groups = [];
  for (const l of MADRID_LINES)  groups.push(l.stations);
  for (const l of METRO_LIGERO)  groups.push(l.stations);
  if (RAMAL_R && RAMAL_R.stations) groups.push(RAMAL_R.stations);
  return groups;
}

// Aplica una posición a TODAS las estaciones con ese nombre (líneas +
// transbordos). Devuelve true si tocó al menos una.
function _applyPositionByName(name, nx, ny) {
  let touched = false;
  for (const stations of _allStationContainers()) {
    for (const s of stations) {
      if (s.name === name) { s.pos = [nx, ny]; touched = true; }
    }
  }
  for (const it of INTERCHANGES) {
    if (it.name === name) { it.pos = [nx, ny]; touched = true; }
  }
  return touched;
}

// Lee el JSON serializado de localStorage o devuelve null en caso de error.
function _readJSON(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (_) { return null; }
}

function _snap(v, step) {
  return Math.round(v / step) * step;
}

// Cuenta sólo líneas de Metro (ids numéricos 1–12) en un transbordo.
function metroLineCount(interchange) {
  return interchange.lines.filter(id => typeof id === 'number').length;
}

// ── Proyección con aspect ratio + viewport ──────────────────────────────
// El dataRect llena todo el área disponible para maximizar el espacio del
// mapa. Sólo en pantallas extremadamente verticales (availAspect <
// MIN_MAP_ASPECT) clampamos para evitar deformaciones brutales.
function computeDataRect(ox, oy, w, h) {
  const availAspect = w / h;
  let dataW, dataH;
  if (availAspect >= MIN_MAP_ASPECT) {
    // Disponibilidad normal o apaisada → llena toda el área.
    dataW = w;
    dataH = h;
  } else {
    // Pantalla muy estrecha y alta → limita por aspect mínimo, deja
    // márgenes arriba y abajo.
    dataW = w;
    dataH = w / MIN_MAP_ASPECT;
  }
  return {
    x: ox + (w - dataW) / 2,
    y: oy + (h - dataH) / 2,
    w: dataW,
    h: dataH,
  };
}

function projectN(nx, ny) {
  const r = lastDataRect;
  return {
    x: r.x + ((nx - viewport.cx) * viewport.scale + 0.5) * r.w,
    y: r.y + ((ny - viewport.cy) * viewport.scale + 0.5) * r.h,
  };
}

function unprojectN(sx, sy) {
  const r = lastDataRect;
  return {
    nx: ((sx - r.x) / r.w - 0.5) / viewport.scale + viewport.cx,
    ny: ((sy - r.y) / r.h - 0.5) / viewport.scale + viewport.cy,
  };
}

function clampViewport() {
  viewport.scale = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, viewport.scale));
  if (viewport.scale > 1.0001) {
    const half = 0.5 / viewport.scale;
    viewport.cx = Math.max(half, Math.min(1 - half, viewport.cx));
    viewport.cy = Math.max(half, Math.min(1 - half, viewport.cy));
  } else {
    viewport.cx = 0.5;
    viewport.cy = 0.5;
  }
}

function invalidateCache() {
  cachedProjKey = '';
}

function ensureProjection(ox, oy, w, h) {
  const r = computeDataRect(ox, oy, w, h);
  const key = `${r.x}|${r.y}|${r.w}|${r.h}|${viewport.scale}|${viewport.cx}|${viewport.cy}`;
  if (key === cachedProjKey) return;
  cachedProjKey = key;
  lastProjection = { ox, oy, w, h };
  lastDataRect   = r;
  cachedPolylines.clear();
  cachedStationPx.clear();
  for (const line of getAllLinesWithGeometry()) {
    const stationPx = line.stations.map(s => projectN(s.pos[0], s.pos[1]));
    cachedStationPx.set(line.id, stationPx);
    cachedPolylines.set(line.id, buildManhattanPolyline(stationPx));
  }
}

// Convierte una secuencia de puntos en una polilínea Manhattan: cada
// segmento entre estaciones se descompone en una diagonal a 45° más un
// tramo recto (horizontal o vertical) sobre el eje dominante. Si el
// segmento ya está alineado (horizontal, vertical o 45° puro) se respeta.
function buildManhattanPolyline(pts) {
  if (pts.length === 0) return [];
  const out = [{ x: pts[0].x, y: pts[0].y }];
  const TOL = 0.5;            // píxeles
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const adx = Math.abs(dx);
    const ady = Math.abs(dy);
    const aligned = adx < TOL || ady < TOL || Math.abs(adx - ady) < TOL;
    if (!aligned) {
      // Codo a 45° hasta el límite del eje más corto, luego eje recto.
      const m = Math.min(adx, ady);
      out.push({
        x: a.x + Math.sign(dx) * m,
        y: a.y + Math.sign(dy) * m,
      });
    }
    out.push({ x: b.x, y: b.y });
  }
  return out;
}

// ── Distancia mínima de un punto a una polilínea (para hover/click) ──────
function distToSegmentSq(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) {
    const ex = px - ax, ey = py - ay;
    return ex * ex + ey * ey;
  }
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx, cy = ay + t * dy;
  const ex = px - cx, ey = py - cy;
  return ex * ex + ey * ey;
}

function distToPolylineSq(px, py, points) {
  let min = Infinity;
  for (let i = 0; i < points.length - 1; i++) {
    const d = distToSegmentSq(px, py, points[i].x, points[i].y, points[i + 1].x, points[i + 1].y);
    if (d < min) min = d;
  }
  return min;
}

function findNearestStationPx(mouseX, mouseY, maxRadius) {
  let best = null;
  let bestD2 = maxRadius * maxRadius;
  for (const line of MADRID_LINES) {
    const pxs = cachedStationPx.get(line.id);
    if (!pxs) continue;
    for (let i = 0; i < pxs.length; i++) {
      const dx = pxs[i].x - mouseX;
      const dy = pxs[i].y - mouseY;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD2) {
        bestD2 = d2;
        best = { lineId: line.id, stationIndex: i };
      }
    }
  }
  return best;
}

function isInsideMap(mouseX, mouseY) {
  const r = lastDataRect;
  return r.w > 0 && r.h > 0 &&
         mouseX >= r.x && mouseX <= r.x + r.w &&
         mouseY >= r.y && mouseY <= r.y + r.h;
}

// Carga overrides + flag de bloqueo desde localStorage y los aplica en
// memoria. Idempotente — se puede llamar varias veces.
function _loadEditState() {
  const overrides = _readJSON(LS_OVERRIDES_KEY);
  if (overrides && typeof overrides === 'object') {
    for (const [name, pos] of Object.entries(overrides)) {
      if (Array.isArray(pos) && pos.length === 2) {
        _applyPositionByName(name, pos[0], pos[1]);
        draftOverrides[name] = [pos[0], pos[1]];
      }
    }
  }
  editLocked = localStorage.getItem(LS_LOCKED_KEY) === 'true';
  invalidateCache();
}
_loadEditState();   // se ejecuta al cargar el módulo

function _setEditToast(text, framesLeft = 120, kind = 'info') {
  editToast = { text, framesLeft, kind };
}

// ── API pública ──────────────────────────────────────────────────────────
export const MapaMetroMadrid = {
  lines: MADRID_LINES,

  getUnlocked() { return MADRID_LINES.filter(l => !l.locked); },
  getLocked()   { return MADRID_LINES.filter(l =>  l.locked); },
  getLine(id)   { return MADRID_LINES.find(l => l.id === id); },
  isUnlocked(id) {
    const l = MADRID_LINES.find(x => x.id === id);
    return !!l && !l.locked;
  },

  // Devuelve todas las líneas de MADRID_LINES que contienen una estación
  // con el nombre exacto dado, junto con su índice en cada línea.
  // Útil para el popup de selección cuando se hace clic en un transbordo.
  getStationLines(stationName) {
    const result = [];
    for (const line of MADRID_LINES) {
      const idx = line.stations.findIndex(s => s.name === stationName);
      if (idx !== -1) {
        result.push({
          lineId:       line.id,
          lineName:     line.name,
          lineColor:    line.color,
          stationIndex: idx,
          locked:       !!line.locked,
        });
      }
    }
    return result;
  },

  unlockLine(id) {
    const l = MADRID_LINES.find(x => x.id === id);
    if (!l) return;
    l.locked = false;
    const unlockedIds = MADRID_LINES.filter(x => !x.locked).map(x => x.id);
    localStorage.setItem('viajepalomero_unlocked', JSON.stringify(unlockedIds));
  },

  loadProgress() {
    try {
      const raw = localStorage.getItem('viajepalomero_unlocked');
      if (!raw) return;
      const ids = JSON.parse(raw);
      if (!Array.isArray(ids)) return;
      for (const l of MADRID_LINES) {
        if (ids.includes(l.id)) l.locked = false;
      }
    } catch (e) { /* ignorar */ }
  },

  // ── Comprobaciones de área ───────────────────────────────────────────
  isInsideMap(mouseX, mouseY) { return isInsideMap(mouseX, mouseY); },

  // ── Zoom + Pan ──────────────────────────────────────────────────────
  zoomAt(sx, sy, factor) {
    if (lastDataRect.w === 0) return;
    const before = unprojectN(sx, sy);
    viewport.scale *= factor;
    clampViewport();
    // Reposicionar cx/cy para que el punto (before.nx, before.ny) siga
    // bajo (sx, sy) tras el cambio de escala.
    const r = lastDataRect;
    viewport.cx = before.nx - ((sx - r.x) / r.w - 0.5) / viewport.scale;
    viewport.cy = before.ny - ((sy - r.y) / r.h - 0.5) / viewport.scale;
    clampViewport();
    invalidateCache();
  },

  pan(dx, dy) {
    if (lastDataRect.w === 0) return;
    viewport.cx -= (dx / lastDataRect.w) / viewport.scale;
    viewport.cy -= (dy / lastDataRect.h) / viewport.scale;
    clampViewport();
    invalidateCache();
  },

  resetView() {
    viewport.scale = 1.0;
    viewport.cx = 0.5;
    viewport.cy = 0.5;
    invalidateCache();
  },

  getZoom() { return viewport.scale; },

  // ── Hover / click de LÍNEA (compat con código previo) ────────────────
  setHoverFromMouse(mouseX, mouseY) {
    if (!isInsideMap(mouseX, mouseY)) {
      hoveredLineId = null; _tooltip = null; return null;
    }
    const tol2 = 10 * 10;
    let best = { id: null, d2: tol2 };
    for (const line of MADRID_LINES) {
      const pts = cachedPolylines.get(line.id);
      if (!pts) continue;
      const d2 = distToPolylineSq(mouseX, mouseY, pts);
      if (d2 < best.d2) best = { id: line.id, d2 };
    }
    hoveredLineId = best.id;
    if (hoveredLineId != null) {
      const line = MADRID_LINES.find(l => l.id === hoveredLineId);
      _tooltip = line ? { kind: 'line', line, mx: mouseX, my: mouseY } : null;
    } else {
      _tooltip = null;
    }
    return hoveredLineId;
  },

  getHoveredLine() {
    if (hoveredLineId == null) return null;
    return MADRID_LINES.find(l => l.id === hoveredLineId) || null;
  },

  handleMapClick(mouseX, mouseY) {
    this.setHoverFromMouse(mouseX, mouseY);
    if (hoveredLineId == null) return null;
    const line = this.getLine(hoveredLineId);
    if (!line) return null;
    if (line.locked) {
      lockedToastTimer = 90;
      return 'LOCKED';
    }
    if (line.id === 3) return 'PLAY_LINE_3';
    return null;
  },

  // ── Hover / click de ESTACIÓN (nueva API) ────────────────────────────
  setStationHoverFromMouse(mouseX, mouseY) {
    if (!isInsideMap(mouseX, mouseY)) {
      hoveredStationRef = null;
      return null;
    }
    const found = findNearestStationPx(mouseX, mouseY, 8);
    if (found) {
      hoveredStationRef = found;
      hoveredLineId     = found.lineId;
      const line = MADRID_LINES.find(l => l.id === found.lineId);
      const station = line && line.stations[found.stationIndex];
      _tooltip = (line && station) ? {
        kind: 'station', line, station, stationIndex: found.stationIndex,
        mx: mouseX, my: mouseY,
      } : null;
      return found;
    }
    hoveredStationRef = null;
    return null;
  },

  getHoveredStation() {
    if (!hoveredStationRef) return null;
    const line = MADRID_LINES.find(l => l.id === hoveredStationRef.lineId);
    if (!line) return null;
    const station = line.stations[hoveredStationRef.stationIndex];
    if (!station) return null;
    return { line, station, stationIndex: hoveredStationRef.stationIndex };
  },

  handleStationClick(mouseX, mouseY) {
    const found = this.setStationHoverFromMouse(mouseX, mouseY);
    if (!found) return null;
    const line = MADRID_LINES.find(l => l.id === found.lineId);
    if (!line) return null;
    // No bloqueamos aquí por locked: arcade.js decide si mostrar popup
    // (puede que otras líneas en la misma estación estén desbloqueadas).
    selectedStationRef = found;
    return {
      lineId:       found.lineId,
      stationIndex: found.stationIndex,
    };
  },

  /** Dispara el toast de «línea bloqueada» (llamado desde arcade.js). */
  showLockedToast() { lockedToastTimer = 90; },

  clearSelection() {
    selectedStationRef = null;
    hoveredStationRef  = null;
  },

  // ── Render del esquema ───────────────────────────────────────────────
  drawSchematicMap(ctx, ox, oy, w, h) {
    ensureProjection(ox, oy, w, h);
    drawMap(ctx, ox, oy, w, h);
  },

  drawMapOverview(ctx, canvas, options = {}) {
    const padTop    = options.padTop    ?? 140;
    const padBottom = options.padBottom ?? 60;
    const padLeft   = options.padLeft   ?? 224;
    const padRight  = options.padRight  ?? 40;
    const ox = padLeft;
    const oy = padTop;
    const w  = Math.max(1, canvas.width  - padLeft - padRight);
    const h  = Math.max(1, canvas.height - padTop  - padBottom);
    this.drawSchematicMap(ctx, ox, oy, w, h);
  },

  // ── Modo edición del mapa ────────────────────────────────────────────
  isEditing()    { return editMode; },
  isEditLocked() { return editLocked; },
  hasDraft()     { return Object.keys(draftOverrides).length > 0; },
  isDragging()   { return editDragName != null; },

  /** Entra en modo edición (ignorado si la edición está bloqueada). */
  enterEditMode() {
    if (editLocked) {
      _setEditToast('🔒 Edición bloqueada permanentemente', 120, 'error');
      return false;
    }
    editMode = true;
    pendingLockConfirm = false;
    _setEditToast('Modo edición activado · arrastra estaciones', 120, 'info');
    return true;
  },

  /** Sale de modo edición. Si descard=true se pierden los cambios sin guardar. */
  exitEditMode() {
    editMode = false;
    editDragName = null;
    editHoverName = null;
    editCursorXY = null;
    pendingLockConfirm = false;
  },

  /** Localiza la estación más cercana al cursor; devuelve { name, x, y } o null. */
  findNearestStationByName(mouseX, mouseY, maxRadius = 12) {
    const found = findNearestStationPx(mouseX, mouseY, maxRadius);
    if (!found) return null;
    const line = MADRID_LINES.find(l => l.id === found.lineId);
    const station = line?.stations[found.stationIndex];
    if (!station) return null;
    return { name: station.name, lineId: line.id, stationIndex: found.stationIndex };
  },

  /** Inicia el drag de la estación bajo (mouseX, mouseY). Devuelve true si agarra. */
  beginStationDrag(mouseX, mouseY) {
    if (!editMode || editLocked) return false;
    const hit = this.findNearestStationByName(mouseX, mouseY, 14);
    if (!hit) return false;
    editDragName = hit.name;
    editHoverName = hit.name;
    return true;
  },

  /**
   * Actualiza la posición de la estación actualmente arrastrada en
   * coordenadas de canvas. Si Shift está pulsado se usa snap fino.
   */
  updateStationDrag(mouseX, mouseY, shiftKey = false) {
    if (!editMode || !editDragName) return;
    const r = lastDataRect;
    if (r.w === 0) return;
    const u = unprojectN(mouseX, mouseY);
    const step = shiftKey ? SNAP_STEP_FINE : SNAP_STEP;
    let nx = Math.max(0, Math.min(1, _snap(u.nx, step)));
    let ny = Math.max(0, Math.min(1, _snap(u.ny, step)));
    this.setStationPosition(editDragName, nx, ny);
    editCursorXY = { mx: mouseX, my: mouseY, nx, ny };
  },

  /** Cierra el drag actual; mantiene los cambios en el draft. */
  endStationDrag() {
    editDragName = null;
    editCursorXY = null;
  },

  /** Aplica un override por nombre (mutaciones por todas las líneas + INTERCHANGES). */
  setStationPosition(stationName, nx, ny) {
    if (!stationName) return;
    if (editLocked) return;
    _applyPositionByName(stationName, nx, ny);
    draftOverrides[stationName] = [nx, ny];
    invalidateCache();
  },

  /** Persiste todos los cambios en localStorage. */
  saveDraft() {
    if (editLocked) return false;
    try {
      localStorage.setItem(LS_OVERRIDES_KEY, JSON.stringify(draftOverrides));
      _setEditToast('✔ Posiciones guardadas', 120, 'ok');
      return true;
    } catch (_) {
      _setEditToast('No se pudo guardar', 120, 'error');
      return false;
    }
  },

  /** Descarta cambios no guardados y recarga las posiciones persistidas. */
  discardDraft() {
    // Forma sencilla: restaurar desde localStorage. Si no había nada, los
    // valores en disco coinciden con los originales en memoria del módulo.
    draftOverrides = {};
    const overrides = _readJSON(LS_OVERRIDES_KEY) || {};
    for (const [name, pos] of Object.entries(overrides)) {
      if (Array.isArray(pos) && pos.length === 2) {
        _applyPositionByName(name, pos[0], pos[1]);
        draftOverrides[name] = [pos[0], pos[1]];
      }
    }
    invalidateCache();
    _setEditToast('Cambios descartados (recarga la página para reset total)', 150, 'info');
  },

  /** Pide confirmación para bloquear (siguiente Y → lock real). */
  requestLock() {
    if (editLocked) return;
    pendingLockConfirm = true;
    _setEditToast('¿Bloquear edición? Pulsa Y para confirmar · N para cancelar', 240, 'warn');
  },

  cancelLock() {
    if (!pendingLockConfirm) return;
    pendingLockConfirm = false;
    _setEditToast('Bloqueo cancelado', 90, 'info');
  },

  /** Confirma el bloqueo: guarda + marca flag + sale del modo edición. */
  confirmLock() {
    if (!pendingLockConfirm || editLocked) return false;
    this.saveDraft();
    try { localStorage.setItem(LS_LOCKED_KEY, 'true'); } catch (_) { /* noop */ }
    editLocked = true;
    pendingLockConfirm = false;
    this.exitEditMode();
    _setEditToast('🔒 Edición bloqueada permanentemente', 180, 'ok');
    return true;
  },

  isPendingLockConfirm() { return pendingLockConfirm; },

  /** Hover de estación en modo edición (no usa el _tooltip estándar). */
  setEditHoverFromMouse(mouseX, mouseY) {
    if (!editMode) { editHoverName = null; return null; }
    const hit = this.findNearestStationByName(mouseX, mouseY, 14);
    editHoverName = hit ? hit.name : null;
    return editHoverName;
  },
};

// ── Implementación interna del renderer ──────────────────────────────────
function drawMap(ctx, ox, oy, w, h) {
  const r = lastDataRect;
  const X = (nx) => r.x + ((nx - viewport.cx) * viewport.scale + 0.5) * r.w;
  const Y = (ny) => r.y + ((ny - viewport.cy) * viewport.scale + 0.5) * r.h;

  // Fondo negro de toda el área (estilo "plano 2D coordenadas")
  ctx.fillStyle = '#000000';
  ctx.fillRect(ox - 4, oy - 4, w + 8, h + 8);

  // Recortar el contenido del mapa al rectángulo de datos para evitar
  // que las líneas se salgan al hacer zoom/pan.
  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x, r.y, r.w, r.h);
  ctx.clip();

  // 1. Zonas concéntricas (conmutable con SHOW_ZONES).
  if (SHOW_ZONES) {
    for (const z of ZONE_POLYGONS) {
      const sh = z.shape;
      if (!sh || sh.type !== 'ellipse' || !z.color) continue;
      const cx = X(sh.center[0]);
      const cy = Y(sh.center[1]);
      const rxPx = sh.rx * r.w * viewport.scale;
      const ryPx = sh.ry * r.h * viewport.scale;
      ctx.fillStyle = z.color;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rxPx, ryPx, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // 1b. Etiquetas de zonas
    ctx.fillStyle = '#999999';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const z of ZONE_POLYGONS) {
      for (const p of (z.positions || [])) {
        ctx.fillText(z.label, X(p[0]), Y(p[1]));
      }
    }
  }

  // 2. Líneas de Metro
  const allLines = getAllLinesWithGeometry();
  ctx.lineCap  = 'round';
  ctx.lineJoin = 'round';

  // Pasada 1: líneas no resaltadas
  for (const line of allLines) {
    if (line.id === hoveredLineId) continue;
    drawLineStroke(ctx, line, false);
  }
  // Pasada 2: línea hovered/seleccionada por encima
  for (const line of allLines) {
    if (line.id === hoveredLineId) drawLineStroke(ctx, line, true);
  }

  // 3. Estaciones simples — tick perpendicular blanco
  for (const line of allLines) drawStationTicks(ctx, line);

  // 4. Estaciones de transbordo (círculos blancos con borde negro)
  drawInterchanges(ctx);

  // 5. Halo de hover/selección de estación
  drawStationHighlights(ctx);

  // 6. Cabeceras de línea (rectángulos redondeados con número)
  for (const line of MADRID_LINES) drawLineHeaders(ctx, line);

  // 7. Etiquetas de estación (transbordos en este pase; resto en hover)
  drawStationLabels(ctx);

  ctx.restore();   // ── fin del clipping al dataRect ──

  // 8. Marco del rectángulo de datos (fuera del clip)
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 1;
  ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);

  // 9. UI overlays (no se afectan por viewport)
  drawExternalLabels(ctx, ox, oy, w, h);
  drawHeader(ctx, ox, oy);
  drawZoomBadge(ctx, ox, oy, w, h);
  if (lockedToastTimer > 0) drawLockedToast(ctx, ox, oy, w, h);

  // 10. Overlay de edición (rejilla, handles, banner) por encima de todo.
  if (editMode) drawEditOverlay(ctx, ox, oy, w, h);
  if (editLocked) drawLockBadge(ctx, ox, oy, w, h);
  if (editToast) drawEditToast(ctx, ox, oy, w, h);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
}

// ── Overlay de edición: rejilla + handles + banner + cursor info ───────
function drawEditOverlay(ctx, ox, oy, w, h) {
  const r = lastDataRect;

  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x, r.y, r.w, r.h);
  ctx.clip();

  // Rejilla suave (cada 0.05) bajo los datos para tener referencia visual.
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  for (let nx = 0; nx <= 1.0001; nx += 0.05) {
    const x = r.x + ((nx - viewport.cx) * viewport.scale + 0.5) * r.w;
    ctx.beginPath();
    ctx.moveTo(x, r.y);
    ctx.lineTo(x, r.y + r.h);
    ctx.stroke();
  }
  for (let ny = 0; ny <= 1.0001; ny += 0.05) {
    const y = r.y + ((ny - viewport.cy) * viewport.scale + 0.5) * r.h;
    ctx.beginPath();
    ctx.moveTo(r.x, y);
    ctx.lineTo(r.x + r.w, y);
    ctx.stroke();
  }

  // Handles cuadrados — una sola entrada por nombre de estación para evitar
  // dibujar el mismo handle varias veces cuando es transbordo.
  const seen = new Set();
  ctx.lineWidth = 1.5;
  for (const line of MADRID_LINES) {
    const pxs = cachedStationPx.get(line.id);
    if (!pxs) continue;
    for (let i = 0; i < line.stations.length; i++) {
      const st = line.stations[i];
      if (seen.has(st.name)) continue;
      seen.add(st.name);
      const p = pxs[i];
      const isHover = (editHoverName === st.name);
      const isDrag  = (editDragName  === st.name);
      const size = isDrag ? 12 : (isHover ? 10 : 7);
      ctx.fillStyle   = isDrag ? '#ffffff' : (isHover ? '#ffe066' : 'rgba(255,255,255,0.85)');
      ctx.strokeStyle = '#000000';
      ctx.fillRect(p.x - size / 2, p.y - size / 2, size, size);
      ctx.strokeRect(p.x - size / 2 + 0.5, p.y - size / 2 + 0.5, size - 1, size - 1);
    }
  }

  ctx.restore();

  // Banner superior con atajos
  const bannerH = 22;
  ctx.fillStyle = 'rgba(20,20,40,0.92)';
  ctx.fillRect(ox, oy - bannerH - 2, w, bannerH);
  ctx.strokeStyle = '#ffe066';
  ctx.lineWidth = 1;
  ctx.strokeRect(ox + 0.5, oy - bannerH - 1.5, w - 1, bannerH - 1);
  ctx.fillStyle = '#ffe066';
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('✏ EDIT MODE', ox + 8, oy - bannerH / 2 - 2);
  ctx.fillStyle = '#ccccdd';
  ctx.font = '10px monospace';
  ctx.textAlign = 'right';
  ctx.fillText(
    'ARRASTRA ESTACIONES · [S] GUARDAR · [L] BLOQUEAR · [R] DESCARTAR · [E/ESC] SALIR',
    ox + w - 8, oy - bannerH / 2 - 2,
  );

  // Coordenadas junto al cursor durante el drag
  if (editDragName && editCursorXY) {
    const { mx, my, nx, ny } = editCursorXY;
    const txt = `${editDragName}  [${nx.toFixed(3)}, ${ny.toFixed(3)}]`;
    ctx.font = 'bold 11px monospace';
    const tw = ctx.measureText(txt).width + 12;
    const tx = Math.min(ox + w - tw - 6, mx + 14);
    const ty = Math.max(oy + 6, my - 22);
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fillRect(tx, ty, tw, 18);
    ctx.strokeStyle = '#ffe066';
    ctx.strokeRect(tx + 0.5, ty + 0.5, tw - 1, 17);
    ctx.fillStyle = '#ffe066';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(txt, tx + 6, ty + 9);
  }
}

// Candado discreto cuando la edición está bloqueada permanentemente.
function drawLockBadge(ctx, ox, oy, w, h) {
  const txt = '🔒 MAPA';
  ctx.font = 'bold 10px monospace';
  const tw = ctx.measureText(txt).width + 12;
  const tx = ox + w - tw - 8;
  const ty = oy + h - 24;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(tx, ty, tw, 18);
  ctx.strokeStyle = 'rgba(255,180,180,0.4)';
  ctx.lineWidth = 1;
  ctx.strokeRect(tx + 0.5, ty + 0.5, tw - 1, 17);
  ctx.fillStyle = '#ffaaaa';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(txt, tx + 6, ty + 9);
}

// Toast efimero del modo edición (no se reusa el mecanismo de línea bloqueada).
function drawEditToast(ctx, ox, oy, w, h) {
  if (!editToast) return;
  editToast.framesLeft--;
  if (editToast.framesLeft <= 0) { editToast = null; return; }
  const alpha = Math.min(1, editToast.framesLeft / 30);
  const bg = editToast.kind === 'error' ? `rgba(80,20,20,${0.92 * alpha})`
           : editToast.kind === 'warn'  ? `rgba(80,60,10,${0.92 * alpha})`
           : editToast.kind === 'ok'    ? `rgba(20,60,40,${0.92 * alpha})`
           : `rgba(20,30,60,${0.92 * alpha})`;
  const fg = editToast.kind === 'error' ? `rgba(255,180,180,${alpha})`
           : editToast.kind === 'warn'  ? `rgba(255,224,102,${alpha})`
           : editToast.kind === 'ok'    ? `rgba(150,230,180,${alpha})`
           : `rgba(220,220,255,${alpha})`;
  ctx.font = 'bold 12px monospace';
  const tw = ctx.measureText(editToast.text).width + 24;
  const tx = ox + (w - tw) / 2;
  const ty = oy + 14;
  ctx.fillStyle = bg;
  ctx.fillRect(tx, ty, tw, 24);
  ctx.strokeStyle = fg;
  ctx.lineWidth = 1;
  ctx.strokeRect(tx + 0.5, ty + 0.5, tw - 1, 23);
  ctx.fillStyle = fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(editToast.text, tx + tw / 2, ty + 12);
}

function drawLineStroke(ctx, line, isHighlight) {
  const pts = cachedPolylines.get(line.id);
  if (!pts || pts.length < 2) return;
  ctx.globalAlpha = line.locked ? 0.35 : 1.0;
  ctx.strokeStyle = line.color;
  ctx.lineWidth   = isHighlight ? 6 : 4;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawStationTicks(ctx, line) {
  // Usar las posiciones de estaciones reales, no los codos de la polilínea
  // Manhattan, para que los ticks aparezcan exactamente sobre cada parada.
  const pts = cachedStationPx.get(line.id);
  if (!pts) return;
  ctx.globalAlpha = line.locked ? 0.35 : 0.95;
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 2;
  ctx.lineCap = 'butt';
  for (let i = 0; i < pts.length; i++) {
    // perpendicular calculada respecto a los puntos de estación adyacentes
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    let dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len; dy /= len;
    const nx = -dy, ny = dx;
    const cx = pts[i].x, cy = pts[i].y;
    ctx.beginPath();
    ctx.moveTo(cx - nx * 3, cy - ny * 3);
    ctx.lineTo(cx + nx * 3, cy + ny * 3);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.lineCap = 'round';
}

function drawInterchanges(ctx) {
  ctx.lineWidth = 1.5;
  for (const it of INTERCHANGES) {
    const nMetro = metroLineCount(it);
    if (nMetro < 2) continue;
    const p = projectN(it.pos[0], it.pos[1]);
    const triplus = nMetro >= 3;
    ctx.fillStyle   = '#FFFFFF';
    ctx.strokeStyle = '#000000';
    ctx.beginPath();
    if (triplus) {
      ctx.ellipse(p.x, p.y, 8, 5, 0, 0, Math.PI * 2);
    } else {
      ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.stroke();
  }
}

function drawStationHighlights(ctx) {
  // Hovered (halo translúcido del color de la línea)
  if (hoveredStationRef) {
    const line = MADRID_LINES.find(l => l.id === hoveredStationRef.lineId);
    const pxs  = cachedStationPx.get(hoveredStationRef.lineId);
    if (line && pxs) {
      const p = pxs[hoveredStationRef.stationIndex];
      ctx.globalAlpha = 0.4;
      ctx.fillStyle   = line.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
  // Seleccionada (halo sólido + pulso a 2 Hz)
  if (selectedStationRef) {
    const line = MADRID_LINES.find(l => l.id === selectedStationRef.lineId);
    const pxs  = cachedStationPx.get(selectedStationRef.lineId);
    if (line && pxs) {
      const p = pxs[selectedStationRef.stationIndex];
      const t = (performance.now() % 500) / 500;
      const pulse = 0.5 + 0.5 * Math.sin(t * Math.PI * 2);
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = line.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 8 + pulse * 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
}

function drawLineHeaders(ctx, line) {
  if (!line.stations || line.stations.length < 1) return;
  const pxs  = cachedStationPx.get(line.id);
  if (!pxs) return;
  const head = pxs[0];
  const tail = pxs[pxs.length - 1];
  drawLineBadge(ctx, head.x, head.y, line);
  if (!line.isCircular) drawLineBadge(ctx, tail.x, tail.y, line);
}

function drawLineBadge(ctx, x, y, line) {
  const text = String(line.id);
  const w = 16, h = 12;
  ctx.fillStyle = line.color;
  ctx.globalAlpha = line.locked ? 0.5 : 1;
  roundRect(ctx, x - w / 2, y - h / 2, w, h, 3);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y + 0.5);
  ctx.globalAlpha = 1;
}

function drawStationLabels(ctx) {
  ctx.font = '9px monospace';
  ctx.fillStyle = '#DDDDDD';
  ctx.textBaseline = 'middle';
  const seen = new Set();
  for (const it of INTERCHANGES) {
    if (seen.has(it.name)) continue;
    if (metroLineCount(it) < 2) continue;
    seen.add(it.name);
    const p = projectN(it.pos[0], it.pos[1]);
    // auto-flip: si la estación está en la mitad izquierda, etiquetar a la
    // derecha; en la mitad derecha, etiquetar a la izquierda.
    const flipRight = it.pos[0] < 0.5;
    if (flipRight) {
      ctx.textAlign = 'left';
      ctx.fillText(it.name, p.x + 9, p.y);
    } else {
      ctx.textAlign = 'right';
      ctx.fillText(it.name, p.x - 9, p.y);
    }
  }
}

function drawExternalLabels(ctx, ox, oy, w, h) {
  // Las etiquetas externas y el logo NO se afectan por viewport: son UI
  // pintada en el frame disponible completo.
  const r = lastDataRect;
  ctx.textBaseline = 'middle';
  for (const lbl of EXTERNAL_LABELS) {
    ctx.fillStyle = lbl.color;
    ctx.font = `bold ${lbl.size}px monospace`;
    ctx.textAlign = 'center';
    // Las etiquetas decorativas se anclan al rect de datos en world coords
    // (sin viewport) para que no se muevan al hacer zoom.
    ctx.fillText(lbl.text, r.x + lbl.pos[0] * r.w, r.y + lbl.pos[1] * r.h);
  }
  // Logo Metro arriba‑derecha del frame disponible
  const lx = ox + w - 50, ly = oy + 6;
  ctx.fillStyle = '#D0021B';
  ctx.beginPath();
  ctx.moveTo(lx, ly);
  ctx.lineTo(lx + 12, ly + 8);
  ctx.lineTo(lx, ly + 16);
  ctx.lineTo(lx - 12, ly + 8);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('M', lx, ly + 9);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('Metro', lx + 16, ly + 12);
}

function drawHeader(ctx, ox, oy) {
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 24px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('2026 ENERO', ox + 6, oy + 4);
}

function drawZoomBadge(ctx, ox, oy, w, h) {
  // Indicador discreto de nivel de zoom abajo-izquierda. Sólo se muestra
  // si scale > 1 (no es trivial).
  if (viewport.scale <= 1.0001) return;
  const txt = `×${viewport.scale.toFixed(1)}`;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.font = 'bold 11px monospace';
  const tw = ctx.measureText(txt).width + 12;
  const tx = ox + 8;
  const ty = oy + h - 24;
  ctx.fillRect(tx, ty, tw, 18);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1;
  ctx.strokeRect(tx + 0.5, ty + 0.5, tw - 1, 17);
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(txt, tx + 6, ty + 9);
}

function drawLockedToast(ctx, ox, oy, w, h) {
  lockedToastTimer--;
  const alpha = Math.min(1, lockedToastTimer / 30);
  ctx.fillStyle = `rgba(80,20,20,${0.85 * alpha})`;
  const msg = '🔒  Línea bloqueada';
  ctx.font = 'bold 13px monospace';
  const w2 = ctx.measureText(msg).width + 24;
  const tx = ox + (w - w2) / 2;
  const ty = oy + h / 2 - 14;
  ctx.fillRect(tx, ty, w2, 28);
  ctx.strokeStyle = `rgba(255,80,80,${alpha})`;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(tx + 0.75, ty + 0.75, w2 - 1.5, 26.5);
  ctx.fillStyle = `rgba(255,180,180,${alpha})`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(msg, tx + w2 / 2, ty + 14);
}

// ── Tooltip (línea o estación) ───────────────────────────────────────────
export function drawTooltip(ctx) {
  if (_tooltip == null) return;

  const isStation = _tooltip.kind === 'station';
  const line = _tooltip.line;
  const isUnlocked = !line.locked;

  let title, route, hint;
  if (isStation) {
    title = `${_tooltip.station.name} · L${line.id}`;
    route = `${line.from} ↔ ${line.to}`;
    hint  = isUnlocked ? '▶ EMPEZAR AQUÍ' : '🔒 Línea bloqueada';
  } else {
    title = line.name;
    route = `${line.from} ↔ ${line.to}`;
    hint  = isUnlocked ? '▶ JUGAR · Enter o click' : '🔒 Bloqueada';
  }

  ctx.font = 'bold 12px monospace';
  const titleW = ctx.measureText(title).width;
  ctx.font = '10px monospace';
  const routeW = ctx.measureText(route).width;
  const hintW  = ctx.measureText(hint).width;
  const contentW = Math.max(titleW, routeW, hintW);

  const PAD   = 10;
  const W     = contentW + PAD * 2 + 18;
  const H     = 58;
  const ARROW = 7;

  const cvs = ctx.canvas;
  const naturalTy = _tooltip.my - H - ARROW - 8;
  let tx = _tooltip.mx - W / 2;
  let ty = naturalTy;
  tx = Math.max(8, Math.min(cvs.width  - W - 8, tx));
  ty = Math.max(8, Math.min(cvs.height - H - 8, ty));

  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur  = 12;
  ctx.fillStyle   = '#111';
  roundRect(ctx, tx, ty, W, H, 5);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.strokeStyle = isUnlocked ? line.color : '#993333';
  ctx.lineWidth = 1.5;
  roundRect(ctx, tx, ty, W, H, 5);
  ctx.stroke();

  // Flecha: sólo se dibuja si el tooltip no fue desplazado verticalmente
  // (cuando queda clamped al borde la flecha quedaría desconectada del cursor).
  const arrowX = _tooltip.mx;
  const arrowY = ty + H;
  const arrowVisible = (ty === naturalTy) &&
                       (arrowX >= tx + ARROW) && (arrowX <= tx + W - ARROW);
  if (arrowVisible) {
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.moveTo(arrowX - ARROW, arrowY);
    ctx.lineTo(arrowX + ARROW, arrowY);
    ctx.lineTo(arrowX, arrowY + ARROW);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = isUnlocked ? line.color : '#993333';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Color dot
  const dotX = tx + PAD;
  const dotY = ty + 18;
  ctx.fillStyle = line.color;
  ctx.beginPath();
  ctx.arc(dotX + 5, dotY, 5, 0, Math.PI * 2);
  ctx.fill();

  // Title
  ctx.font = 'bold 12px monospace';
  ctx.fillStyle = isUnlocked ? '#ffffff' : '#888888';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(title, dotX + 15, dotY + 4);

  // Route
  ctx.font = '10px monospace';
  ctx.fillStyle = '#777777';
  ctx.fillText(route, tx + PAD, ty + 34);

  // Hint
  ctx.font = '10px monospace';
  ctx.fillStyle = isUnlocked ? '#5DCAA5' : '#cc4444';
  ctx.fillText(hint, tx + PAD, ty + 50);
}

export function clearTooltip() { _tooltip = null; }

function roundRect(ctx, x, y, w, h, r) {
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  } else {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
}
