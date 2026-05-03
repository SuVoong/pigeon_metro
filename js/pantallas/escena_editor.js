// pantallas/escena_editor.js
// Editor de escenarios accesible desde el modo arcade.
// Permite modificar la apariencia y reglas del andén y del túnel de la
// estación seleccionada antes de lanzar la partida.
//
// Layout:
//   · Preview a pantalla completa (EstacionBase o TunelBase reales).
//   · Panel lateral derecho (semi-transparente) con controles.
//   · Barra inferior: [CANCELAR] [RESET] [GUARDAR Y JUGAR].
//
// Persistencia: js/escenarios/escena_overrides.js (localStorage por estación).

import { canvas, STATE }           from '../mecanica/estado.js';
import { EstacionBase }            from '../escenarios/metro_base/estacion_base.js';
import { TunelBase }               from '../escenarios/metro_base/tunel_base.js';
import {
  getStationOverride, getTunelOverride,
  setOverrides, resetOverride,
}                                  from '../escenarios/escena_overrides.js';

// ── Mouse local (re-uso del canvas ya capturado en main.js / arcade.js) ─────
let mouseX = -999, mouseY = -999;
let pendingClick = false;
let listenersAttached = false;

function ensureListeners() {
  if (listenersAttached) return;
  listenersAttached = true;
  canvas.addEventListener('mousemove', (e) => {
    if (STATE.phase !== 'SCENE_EDITOR') return;
    const r = canvas.getBoundingClientRect();
    mouseX = (e.clientX - r.left) * (canvas.width  / r.width);
    mouseY = (e.clientY - r.top)  * (canvas.height / r.height);
  });
  canvas.addEventListener('mousedown', (e) => {
    if (STATE.phase !== 'SCENE_EDITOR') return;
    if (e.button !== 0) return;
    const r = canvas.getBoundingClientRect();
    mouseX = (e.clientX - r.left) * (canvas.width  / r.width);
    mouseY = (e.clientY - r.top)  * (canvas.height / r.height);
    pendingClick = true;
  });
}

// ── Estado interno del editor ───────────────────────────────────────────────
let _activeTab     = 'station'; // 'station' | 'tunel'
let _stationCfg    = {};        // overrides de andén (sobre DEFAULT_CONFIG de EstacionBase)
let _tunelCfg      = {};        // overrides de túnel (sobre DEFAULT_CONFIG de TunelBase)
let _previewScene  = null;      // EstacionBase / TunelBase activo
let _previewKey    = '';        // id para detectar cambios y reconstruir
let _hitRects      = [];        // áreas clicables [{x,y,w,h, action}]
let _initialized   = false;

// ── Paletas de color reutilizables ──────────────────────────────────────────
const PALETTES = {
  wall:    ['#F0F0F0', '#E8E8E8', '#DCD0B8', '#C8C0B0', '#9AAEC8', '#A8C0A8', '#B89898', '#888888'],
  ceiling: ['#222230', '#1A1A28', '#2A2A3A', '#383848', '#1A2030', '#2A1A2A', '#0d1535', '#101018'],
  platform:['#5A5A6A', '#6A6A7A', '#48485A', '#7A7A88', '#3A3A48', '#5A5048', '#48584A', '#605844'],
  bg:      ['#08080d', '#060610', '#101018', '#0a0a18', '#1a0a14', '#0a141a', '#141a0a', '#181818'],
  light:   ['#ffffaa', '#ffeebb', '#ffffff', '#ffe066', '#aaeeff', '#ffaaaa', '#cceecc', '#dddddd'],
};

// ── Defaults para reset/comparación rápida (sólo lectura) ───────────────────
const STATION_BASE_DEFAULTS = {
  wallColor:          '#F0F0F0',
  ceilingColor:       '#222230',
  platformColor:      '#5A5A6A',
  numPassengersLeft:  1,
  numPassengersRight: 1,
  numBenches:         1,
  numFluorescents:    5,
  numHangingSigns:    2,
  trainOnLeft:        true,
  trainOnRight:       false,
  durationSeconds:    8,
  // Geometría — los offsets son % del ancho del canvas (efecto trapezoidal)
  vanishingPointY:    0.42,
  platformWidthRatio: 0.25,
  trackOuterOffset:   32,
  trackInnerOffset:   3,
  platformEdgeOffset: 34,
};
const TUNEL_BASE_DEFAULTS = {
  bgColor:               '#050508',
  lightColor:            '#ffeebb',
  durationSeconds:       18,
  speed:                 2,
  trainSpawnInterval:    90,
  obstacleSpawnInterval: 110,
  // Geometría — TunelBase guarda null para "usar default del renderer".
  // El editor muestra las fracciones reales que aplica drawTunel().
  vanishingPointY:       0.47,
  archRadiusRatio:       0.70,
  archCenterOffsetRatio: 0.20,
};

// ─────────────────────────────────────────────────────────────────────────────
// API PÚBLICA
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Abre el editor para una estación. Llamado desde arcade.js.
 * @param {object} ctxObj  { lineId, stationIndex, stationName, returnPhase }
 */
export function openSceneEditor(ctxObj) {
  STATE.sceneEditor = {
    lineId:       ctxObj.lineId,
    stationIndex: ctxObj.stationIndex,
    stationName:  ctxObj.stationName || '',
    returnPhase:  ctxObj.returnPhase || 'ARCADE',
  };
  // Cargar overrides existentes (o vacíos)
  _stationCfg  = { ...getStationOverride(ctxObj.stationName) };
  _tunelCfg    = { ...getTunelOverride(ctxObj.stationName) };
  _activeTab   = 'station';
  _previewKey  = '';
  _previewScene = null;
  _initialized = true;
  STATE.phase = 'SCENE_EDITOR';
}

export function handleSceneEditorInput(keys, consumeKey) {
  ensureListeners();
  if (!_initialized) return;

  // Cancelar
  if (keys['Escape']) {
    consumeKey('Escape');
    _exit('cancel');
    return;
  }
  // Tab / 1 / 2 → alternar pestaña
  if (keys['Tab']) { consumeKey('Tab'); _activeTab = _activeTab === 'station' ? 'tunel' : 'station'; _previewKey=''; return; }
  if (keys['1'])   { consumeKey('1');   _activeTab = 'station'; _previewKey=''; return; }
  if (keys['2'])   { consumeKey('2');   _activeTab = 'tunel';   _previewKey=''; return; }

  // Enter → guardar y jugar
  if (keys['Enter']) { consumeKey('Enter'); _saveAndPlay(); return; }

  // Click sobre los hitRects
  if (pendingClick) {
    pendingClick = false;
    for (const rc of _hitRects) {
      if (mouseX >= rc.x && mouseX <= rc.x + rc.w &&
          mouseY >= rc.y && mouseY <= rc.y + rc.h) {
        _applyAction(rc);
        return;
      }
    }
  }
}

export function updateSceneEditor(dt) {
  if (!_initialized) return;
  // Reconstruir preview si cambió la pestaña o los configs
  const key = _activeTab + '|' + JSON.stringify(_activeTab === 'station' ? _stationCfg : _tunelCfg);
  if (key !== _previewKey) {
    _previewKey = key;
    _buildPreviewScene();
  }
  if (_previewScene) {
    // Mantener la duración alta para que el preview no termine durante la edición
    if (_previewScene.cfg) _previewScene.cfg.durationSeconds = 9999;
    _previewScene.update(dt);
  }
  // Avanzar worldZ para que el túnel scrollee visualmente.
  // El túnel lee config.speed para spawn, pero la animación de paredes/luces
  // se basa en STATE.worldZ. Usamos la velocidad del propio config si es túnel.
  const scrollSpeed = (_activeTab === 'tunel')
    ? (_previewScene?.cfg?.speed ?? 2)
    : 1.2; // un poco de movimiento sutil incluso en el andén
  STATE.worldZ += scrollSpeed * dt;
}

export function drawSceneEditorScreen(ctx) {
  if (!_initialized) {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    return;
  }
  _hitRects = [];
  const W = canvas.width, H = canvas.height;

  // ── Preview a pantalla completa
  if (_previewScene) {
    _previewScene.render(ctx);
  } else {
    ctx.fillStyle = '#0a0a14';
    ctx.fillRect(0, 0, W, H);
  }

  // ── Velo oscuro para legibilidad sobre el preview
  ctx.fillStyle = 'rgba(0,0,0,0.32)';
  ctx.fillRect(0, 0, W, H);

  // ── Top bar
  _drawTopBar(ctx, W, H);

  // ── Panel lateral derecho con controles
  _drawControlPanel(ctx, W, H);

  // ── Barra inferior con botones de acción
  _drawBottomBar(ctx, W, H);
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERNALS
// ─────────────────────────────────────────────────────────────────────────────

function _exit(reason) {
  const ctxObj = STATE.sceneEditor;
  STATE.phase = ctxObj?.returnPhase || 'ARCADE';
  STATE.sceneEditor = null;
  _previewScene = null;
  _initialized = false;
  pendingClick = false;
}

function _saveAndPlay() {
  const ctxObj = STATE.sceneEditor;
  if (!ctxObj) { _exit('cancel'); return; }
  // Persistir overrides (si están vacíos, se elimina el registro)
  const sEmpty = Object.keys(_stationCfg).length === 0;
  const tEmpty = Object.keys(_tunelCfg).length === 0;
  if (sEmpty && tEmpty) resetOverride(ctxObj.stationName);
  else                  setOverrides(ctxObj.stationName, _stationCfg, _tunelCfg);
  // Lanzar partida
  STATE.selectedScenario          = `linea_${ctxObj.lineId}`;
  STATE.selectedStartStationIndex = (ctxObj.stationIndex != null) ? ctxObj.stationIndex : null;
  STATE.sceneEditor               = null;
  STATE.phase                     = 'PLAYING';
  _previewScene = null;
  _initialized  = false;
}

function _resetCurrentTab() {
  if (_activeTab === 'station') _stationCfg = {};
  else                          _tunelCfg   = {};
  _previewKey = '';
}

function _buildPreviewScene() {
  const ctxObj = STATE.sceneEditor;
  const stationName = ctxObj?.stationName || 'Estación';
  if (_activeTab === 'station') {
    _previewScene = new EstacionBase({
      stationName,
      durationSeconds: 9999,
      ..._stationCfg,
    });
    _previewScene.init?.();
  } else {
    _previewScene = new TunelBase({
      durationSeconds: 9999,
      ..._tunelCfg,
    });
    _previewScene.init?.();
  }
}

// ── Aplicar una acción del hitrect ──────────────────────────────────────────
function _applyAction(rc) {
  switch (rc.action) {
    case 'TAB_STATION':  _activeTab = 'station'; _previewKey=''; break;
    case 'TAB_TUNEL':    _activeTab = 'tunel';   _previewKey=''; break;
    case 'CANCEL':       _exit('cancel'); break;
    case 'RESET':        _resetCurrentTab(); break;
    case 'SAVE_PLAY':    _saveAndPlay(); break;
    case 'SET_COLOR':    _setField(rc.field, rc.value); break;
    case 'NUM_DEC':      _adjustNumField(rc.field, -rc.step, rc.min, rc.max); break;
    case 'NUM_INC':      _adjustNumField(rc.field, +rc.step, rc.min, rc.max); break;
    case 'TOGGLE':       _toggleBool(rc.field); break;
  }
}

function _activeCfg() {
  return _activeTab === 'station' ? _stationCfg : _tunelCfg;
}
function _baseDefault(field) {
  return _activeTab === 'station' ? STATION_BASE_DEFAULTS[field] : TUNEL_BASE_DEFAULTS[field];
}
function _currentValue(field) {
  const cfg = _activeCfg();
  return (field in cfg) ? cfg[field] : _baseDefault(field);
}
function _setField(field, value) {
  const cfg = _activeCfg();
  // Si vuelve al default, eliminamos el override (config "limpio")
  if (value === _baseDefault(field)) delete cfg[field];
  else                               cfg[field] = value;
  _previewKey = '';
}
function _adjustNumField(field, delta, min, max) {
  let v = _currentValue(field) + delta;
  if (typeof min === 'number') v = Math.max(min, v);
  if (typeof max === 'number') v = Math.min(max, v);
  // Redondeo al múltiplo del step (evita drift por suma de floats)
  const decimals = Math.abs(delta) < 0.1 ? 2 : Math.abs(delta) < 1 ? 1 : 0;
  if (decimals > 0) {
    const f = Math.pow(10, decimals);
    v = Math.round(v * f) / f;
  }
  _setField(field, v);
}
function _toggleBool(field) {
  _setField(field, !_currentValue(field));
}

// ─────────────────────────────────────────────────────────────────────────────
// RENDER · TOP BAR (título + tabs)
// ─────────────────────────────────────────────────────────────────────────────
function _drawTopBar(ctx, W, H) {
  const BAR_H = 36;
  ctx.fillStyle = 'rgba(8,8,16,0.78)';
  ctx.fillRect(0, 0, W, BAR_H);
  ctx.fillStyle = '#3a3a70';
  ctx.fillRect(0, BAR_H - 1, W, 1);

  // Tabs (siempre a la derecha)
  const tabW = 80, tabH = 24, tabY = (BAR_H - tabH) / 2;
  const tabXs = W - tabW * 2 - 16;
  _drawTab(ctx, tabXs,           tabY, tabW, tabH, '[1] ANDÉN', _activeTab === 'station', 'TAB_STATION');
  _drawTab(ctx, tabXs + tabW + 4,tabY, tabW, tabH, '[2] TÚNEL', _activeTab === 'tunel',   'TAB_TUNEL');

  // Título (se acorta si la ventana es estrecha)
  const sname = (STATE.sceneEditor?.stationName || '').toUpperCase();
  const compact = W < 720;
  ctx.fillStyle = '#f5c518';
  ctx.font = compact ? 'bold 11px monospace' : 'bold 12px monospace';
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  const title = compact ? 'EDITOR' : 'EDITOR DE ESCENARIO';
  ctx.fillText(title, 12, BAR_H / 2);

  if (sname) {
    const titleEnd = ctx.measureText(title).width + 12;
    const room = tabXs - titleEnd - 16;
    if (room > 60) {
      ctx.fillStyle = '#cccccc';
      ctx.font = compact ? '10px monospace' : '11px monospace';
      const trimmed = sname.length * 7 > room
        ? sname.slice(0, Math.max(3, Math.floor(room / 7) - 1)) + '…'
        : sname;
      ctx.fillText('· ' + trimmed, titleEnd + 8, BAR_H / 2);
    }
  }
}

function _drawTab(ctx, x, y, w, h, label, active, action) {
  const hover = mouseX >= x && mouseX <= x + w && mouseY >= y && mouseY <= y + h;
  ctx.fillStyle = active ? 'rgba(245,197,24,0.18)' : (hover ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)');
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = active ? '#f5c518' : '#444';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.fillStyle = active ? '#f5c518' : '#cccccc';
  ctx.font = active ? 'bold 10px monospace' : '10px monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(label, x + w / 2, y + h / 2);
  _hitRects.push({ x, y, w, h, action });
}

// ─────────────────────────────────────────────────────────────────────────────
// RENDER · PANEL DERECHO (controles)
// ─────────────────────────────────────────────────────────────────────────────
function _drawControlPanel(ctx, W, H) {
  const PW = 250;
  const PX = W - PW;
  const PY = 36;
  const PH = H - 36 - 40; // entre topbar y bottombar

  // Fondo del panel
  ctx.fillStyle = 'rgba(8,8,18,0.78)';
  ctx.fillRect(PX, PY, PW, PH);
  ctx.fillStyle = '#3a3a70';
  ctx.fillRect(PX, PY, 1, PH);

  let y = PY + 12;
  if (_activeTab === 'station') {
    y = _drawStationControls(ctx, PX + 10, y, PW - 20);
  } else {
    y = _drawTunelControls(ctx, PX + 10, y, PW - 20);
  }
}

function _drawStationControls(ctx, x, y, w) {
  y = _drawSectionHeader(ctx, x, y, w, 'GENERAL');
  y = _drawNumRow(ctx, x, y, w, 'Duración (s)', 'durationSeconds', 1, 3, 20);

  y = _drawSectionHeader(ctx, x, y, w, 'COLORES');
  y = _drawColorRow(ctx, x, y, w, 'Pared',  'wallColor',     PALETTES.wall);
  y = _drawColorRow(ctx, x, y, w, 'Techo',  'ceilingColor',  PALETTES.ceiling);
  y = _drawColorRow(ctx, x, y, w, 'Andén',  'platformColor', PALETTES.platform);

  y = _drawSectionHeader(ctx, x, y, w, 'GEOMETRÍA');
  y = _drawNumRow(ctx, x, y, w, 'Punto de fuga Y', 'vanishingPointY',    0.02, 0.30, 0.55);
  y = _drawNumRow(ctx, x, y, w, 'Ancho andén',     'platformWidthRatio', 0.02, 0.10, 0.40);
  // Estos offsets son % del ancho del canvas (forma trapezoidal de las vías).
  // Vía exterior alta = vías más anchas en la base (efecto perspectiva fuerte).
  y = _drawNumRow(ctx, x, y, w, 'Vía exterior %',  'trackOuterOffset',    1,   15,   42);
  y = _drawNumRow(ctx, x, y, w, 'Vía interior %',  'trackInnerOffset',    0.5, 1,    10);
  y = _drawNumRow(ctx, x, y, w, 'Borde andén %',   'platformEdgeOffset',  1,   18,   45);

  y = _drawSectionHeader(ctx, x, y, w, 'PASAJEROS');
  y = _drawNumRow(ctx, x, y, w, 'Izquierda', 'numPassengersLeft',  1, 0, 6);
  y = _drawNumRow(ctx, x, y, w, 'Derecha',   'numPassengersRight', 1, 0, 6);

  y = _drawSectionHeader(ctx, x, y, w, 'MOBILIARIO');
  y = _drawNumRow(ctx, x, y, w, 'Bancos/lado',     'numBenches',       1, 0, 4);
  y = _drawNumRow(ctx, x, y, w, 'Fluorescentes',   'numFluorescents',  1, 0, 9);
  y = _drawNumRow(ctx, x, y, w, 'Carteles dest.',  'numHangingSigns',  1, 0, 4);

  y = _drawSectionHeader(ctx, x, y, w, 'TRENES');
  y = _drawBoolRow(ctx, x, y, w, 'Vía izquierda', 'trainOnLeft');
  y = _drawBoolRow(ctx, x, y, w, 'Vía derecha',   'trainOnRight');
  return y;
}

function _drawTunelControls(ctx, x, y, w) {
  y = _drawSectionHeader(ctx, x, y, w, 'GENERAL');
  y = _drawNumRow(ctx, x, y, w, 'Duración (s)', 'durationSeconds', 1, 8, 30);
  y = _drawNumRow(ctx, x, y, w, 'Velocidad',    'speed',          0.2, 0.8, 4);

  y = _drawSectionHeader(ctx, x, y, w, 'AMBIENTE');
  y = _drawColorRow(ctx, x, y, w, 'Fondo', 'bgColor',    PALETTES.bg);
  y = _drawColorRow(ctx, x, y, w, 'Luces', 'lightColor', PALETTES.light);

  y = _drawSectionHeader(ctx, x, y, w, 'GEOMETRÍA');
  y = _drawNumRow(ctx, x, y, w, 'Punto de fuga Y', 'vanishingPointY',       0.02, 0.30, 0.55);
  y = _drawNumRow(ctx, x, y, w, 'Ancho túnel',     'archRadiusRatio',       0.02, 0.45, 0.90);
  y = _drawNumRow(ctx, x, y, w, 'Suelo visible',   'archCenterOffsetRatio', 0.02, 0.05, 0.35);

  y = _drawSectionHeader(ctx, x, y, w, 'SPAWN');
  y = _drawNumRow(ctx, x, y, w, 'Frecuencia trenes',     'trainSpawnInterval',    10, 40, 250);
  y = _drawNumRow(ctx, x, y, w, 'Frecuencia obstáculos', 'obstacleSpawnInterval', 10, 40, 250);
  return y;
}

// ── Componentes de fila ─────────────────────────────────────────────────────
function _drawSectionHeader(ctx, x, y, w, title) {
  ctx.fillStyle = '#888899';
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(title, x, y + 6);
  ctx.fillStyle = '#2a2a4a';
  ctx.fillRect(x, y + 14, w, 1);
  return y + 22;
}

function _drawColorRow(ctx, x, y, w, label, field, palette) {
  const ROW_H = 30;
  // Etiqueta
  ctx.fillStyle = '#cccccc';
  ctx.font = '10px monospace';
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(label, x, y + 8);

  // Swatches (8 colores)
  const swSize = 16, swPad = 2;
  const totalW = palette.length * (swSize + swPad);
  let sx = x + w - totalW;
  const current = _currentValue(field);
  for (const color of palette) {
    const isSel = current === color;
    ctx.fillStyle = color;
    ctx.fillRect(sx, y, swSize, swSize);
    ctx.strokeStyle = isSel ? '#f5c518' : '#222';
    ctx.lineWidth = isSel ? 2 : 1;
    ctx.strokeRect(sx + 0.5, y + 0.5, swSize - 1, swSize - 1);
    _hitRects.push({ x: sx, y, w: swSize, h: swSize, action: 'SET_COLOR', field, value: color });
    sx += swSize + swPad;
  }
  return y + ROW_H;
}

function _drawNumRow(ctx, x, y, w, label, field, step, min, max) {
  const ROW_H = 26;
  // Etiqueta
  ctx.fillStyle = '#cccccc';
  ctx.font = '10px monospace';
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(label, x, y + 9);

  // Controles
  const btnW = 18, btnH = 18;
  const btnY = y;
  const incX = x + w - btnW;
  const valX = incX - 50;
  const decX = valX - btnW - 4;

  _drawSmallButton(ctx, decX, btnY, btnW, btnH, '−', 'NUM_DEC', { field, step, min, max });
  _drawSmallButton(ctx, incX, btnY, btnW, btnH, '+', 'NUM_INC', { field, step, min, max });

  // Valor — número de decimales adaptado al step
  const v = _currentValue(field);
  const decimals = Math.abs(step) < 0.1 ? 2 : Math.abs(step) < 1 ? 1 : 0;
  const vstr = decimals === 0 ? String(Math.round(v)) : Number(v).toFixed(decimals);
  const isOverride = (field in _activeCfg());
  ctx.fillStyle = isOverride ? '#5dcaa5' : '#ffffff';
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(vstr, valX + 25, btnY + btnH / 2);
  return y + ROW_H;
}

function _drawBoolRow(ctx, x, y, w, label, field) {
  const ROW_H = 26;
  ctx.fillStyle = '#cccccc';
  ctx.font = '10px monospace';
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(label, x, y + 9);

  const v = _currentValue(field);
  const tgW = 50, tgH = 18, tgX = x + w - tgW, tgY = y;
  const hover = mouseX >= tgX && mouseX <= tgX + tgW && mouseY >= tgY && mouseY <= tgY + tgH;
  ctx.fillStyle = v ? 'rgba(93,202,165,0.25)' : 'rgba(120,40,40,0.25)';
  ctx.fillRect(tgX, tgY, tgW, tgH);
  ctx.strokeStyle = hover ? '#fff' : (v ? '#5dcaa5' : '#aa4444');
  ctx.lineWidth = 1;
  ctx.strokeRect(tgX + 0.5, tgY + 0.5, tgW - 1, tgH - 1);
  ctx.fillStyle = v ? '#5dcaa5' : '#dd8888';
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(v ? 'ON' : 'OFF', tgX + tgW / 2, tgY + tgH / 2);
  _hitRects.push({ x: tgX, y: tgY, w: tgW, h: tgH, action: 'TOGGLE', field });
  return y + ROW_H;
}

function _drawSmallButton(ctx, x, y, w, h, label, action, extra) {
  const hover = mouseX >= x && mouseX <= x + w && mouseY >= y && mouseY <= y + h;
  ctx.fillStyle = hover ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.06)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = hover ? '#f5c518' : '#555';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(label, x + w / 2, y + h / 2);
  _hitRects.push({ x, y, w, h, action, ...(extra || {}) });
}

// ─────────────────────────────────────────────────────────────────────────────
// RENDER · BARRA INFERIOR (acciones)
// ─────────────────────────────────────────────────────────────────────────────
function _drawBottomBar(ctx, W, H) {
  const BAR_H = 40;
  const BY = H - BAR_H;
  ctx.fillStyle = 'rgba(8,8,16,0.85)';
  ctx.fillRect(0, BY, W, BAR_H);
  ctx.fillStyle = '#3a3a70';
  ctx.fillRect(0, BY, W, 1);

  // Botones (anclados a la derecha)
  const btnH = 26, btnY = BY + (BAR_H - btnH) / 2;
  const compact = W < 720;
  const btnSavW = compact ? 110 : 150;
  const btnRstW = compact ? 56  : 70;
  const btnCnlW = compact ? 70  : 88;
  const gap     = 6;
  const btnSavX = W - btnSavW - 10;
  const btnRstX = btnSavX - btnRstW - gap;
  const btnCnlX = btnRstX - btnCnlW - gap;

  _drawActionButton(ctx, btnCnlX, btnY, btnCnlW, btnH, 'CANCELAR', 'CANCEL', '#aa4444');
  _drawActionButton(ctx, btnRstX, btnY, btnRstW, btnH, 'RESET',    'RESET',  '#888888');
  _drawActionButton(ctx, btnSavX, btnY, btnSavW, btnH,
    compact ? '▶ JUGAR' : '▶ GUARDAR Y JUGAR', 'SAVE_PLAY', '#5dcaa5');

  // Pista de teclado a la izquierda (sólo si hay sitio)
  const keyboardHint = compact
    ? 'TAB · ESC · ENTER'
    : 'TAB cambiar  ·  ESC cancelar  ·  ENTER jugar';
  ctx.fillStyle = '#7777aa';
  ctx.font = '10px monospace';
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  const hintW = ctx.measureText(keyboardHint).width;
  if (12 + hintW + 12 < btnCnlX) {
    ctx.fillText(keyboardHint, 12, BY + BAR_H / 2);
  }
}

function _drawActionButton(ctx, x, y, w, h, label, action, accent) {
  const hover = mouseX >= x && mouseX <= x + w && mouseY >= y && mouseY <= y + h;
  ctx.fillStyle = hover ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.05)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = hover ? '#fff' : accent;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.fillStyle = hover ? '#fff' : accent;
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(label, x + w / 2, y + h / 2);
  _hitRects.push({ x, y, w, h, action });
}
