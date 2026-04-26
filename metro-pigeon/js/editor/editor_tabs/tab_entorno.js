// tab_entorno.js — Environment editor tab: controls for ENV_CFG

import { ENV_CFG } from '../env_config.js';

// ── Layout constants ───────────────────────────────────────────────────────────
const ML  = 14;
const LW  = 106;
const SW  = 90;
const RH  = 22;
const SH  = 28;

// ── Preset colours for picker ─────────────────────────────────────────────────
const PRESETS = ['#050508','#2a2a35','#3a3a48','#1e1e28','#888899','#2a2218','#fffbe6','#333340'];

// ── Module state ──────────────────────────────────────────────────────────────
let _controls  = [];
let _dragField = null;
let _picker    = null;

// ── Build control list ────────────────────────────────────────────────────────
function _buildControls(panelX, panelY, panelW) {
  const controls = [];
  let y = panelY;

  const addSection = (label) => {
    controls.push({ type: 'section', label, x: panelX + ML, y, w: panelW - ML * 2, h: SH });
    y += SH;
  };
  const addSlider = (label, field, min, max, decimals = 2) => {
    controls.push({ type: 'slider', label, field, min, max, decimals,
      x: panelX + ML, y, w: panelW - ML * 2, h: RH,
      trackX: panelX + ML + LW, trackW: SW });
    y += RH;
  };
  const addColor = (label, field) => {
    controls.push({ type: 'color', label, field,
      x: panelX + ML, y, w: panelW - ML * 2, h: RH,
      swatchX: panelX + ML + LW, swatchY: y + 4, swatchW: 16, swatchH: 14 });
    y += RH;
  };
  const addToggle = (label, field) => {
    controls.push({ type: 'toggle', label, field,
      x: panelX + ML, y, w: panelW - ML * 2, h: RH,
      btnX: panelX + ML + LW, btnY: y + 4, btnW: 30, btnH: 14 });
    y += RH;
  };

  addSection('COLORES DEL TÚNEL');
  addColor('Fondo lejano',      'bgColor');
  addColor('Hormigón',          'concreteColor');
  addColor('Hormigón ilum.',    'concreteLightColor');
  addColor('Suelo',             'floorColor');
  addColor('Carril',            'railColor');
  addColor('Traviesa',          'sleeperColor');
  addColor('Luz fluorescente',  'lightGlowColor');
  addColor('Cable bandeja',     'cableColor');

  addSection('GEOMETRÍA');
  addSlider('Radio del túnel',  'tunnelRadius',    80,  300, 0);
  addSlider('Punto de fuga Y',  'vanishingPointY', 0.2, 0.7);
  addSlider('Nº de anillos',    'numRings',        3,   10,  0);
  addSlider('Offset de vías',   'trackOffset',     20,  120, 0);

  addSection('ILUMINACIÓN');
  addToggle('Parpadeo activo',  'flickerEnabled');
  addSlider('Intervalo parp.',  'flickerInterval', 60,  360, 0);

  return controls;
}

// ── Draw helpers ──────────────────────────────────────────────────────────────
function _drawSection(ctx, ctrl) {
  ctx.fillStyle = '#f5c518';
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(ctrl.label, ctrl.x, ctrl.y + ctrl.h / 2 + 2);
  ctx.fillStyle = '#2a2a3a';
  ctx.fillRect(ctrl.x, ctrl.y + ctrl.h - 1, ctrl.w, 1);
}

function _drawSlider(ctx, ctrl) {
  const val  = ENV_CFG[ctrl.field];
  const frac = Math.max(0, Math.min(1, (val - ctrl.min) / (ctrl.max - ctrl.min)));
  const tx   = ctrl.trackX;
  const ty   = ctrl.y + ctrl.h / 2;

  ctx.fillStyle = '#999';
  ctx.font = '10px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(ctrl.label, ctrl.x, ty);

  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(tx, ty - 2, ctrl.trackW, 4);
  ctx.fillStyle = '#f5c518';
  ctx.fillRect(tx, ty - 2, Math.round(frac * ctrl.trackW), 4);
  const thumbX = tx + Math.round(frac * ctrl.trackW);
  ctx.fillStyle = '#fff';
  ctx.fillRect(thumbX - 3, ty - 6, 6, 12);

  const disp = ctrl.decimals === 0 ? Math.round(val).toString() : val.toFixed(ctrl.decimals);
  ctx.fillStyle = '#ccc';
  ctx.font = '10px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(disp, tx + ctrl.trackW + 6, ty);
}

function _drawColor(ctx, ctrl) {
  const val = ENV_CFG[ctrl.field];
  const ty  = ctrl.y + ctrl.h / 2;
  ctx.fillStyle = '#999';
  ctx.font = '10px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(ctrl.label, ctrl.x, ty);

  ctx.fillStyle = val;
  ctx.fillRect(ctrl.swatchX, ctrl.swatchY, ctrl.swatchW, ctrl.swatchH);
  ctx.strokeStyle = '#555';
  ctx.lineWidth = 1;
  ctx.strokeRect(ctrl.swatchX + 0.5, ctrl.swatchY + 0.5, ctrl.swatchW - 1, ctrl.swatchH - 1);
  ctx.fillStyle = '#888';
  ctx.font = '9px monospace';
  ctx.fillText(val, ctrl.swatchX + ctrl.swatchW + 4, ty);
}

function _drawToggle(ctx, ctrl) {
  const val = !!ENV_CFG[ctrl.field];
  const ty  = ctrl.y + ctrl.h / 2;
  ctx.fillStyle = '#999';
  ctx.font = '10px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(ctrl.label, ctrl.x, ty);

  ctx.fillStyle = val ? '#f5c518' : '#2a2a3a';
  ctx.fillRect(ctrl.btnX, ctrl.btnY, ctrl.btnW, ctrl.btnH);
  ctx.strokeStyle = '#555';
  ctx.lineWidth = 1;
  ctx.strokeRect(ctrl.btnX + 0.5, ctrl.btnY + 0.5, ctrl.btnW - 1, ctrl.btnH - 1);
  ctx.fillStyle = val ? '#000' : '#666';
  ctx.font = '9px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(val ? 'ON' : 'OFF', ctrl.btnX + ctrl.btnW / 2, ctrl.btnY + ctrl.btnH / 2);
}

function _drawColorPicker(ctx, panelX, panelW) {
  if (!_picker) return;
  const PW = 112, PH = 60;
  const px = Math.min(_picker.x, panelX + panelW - PW - 4);
  const py = _picker.y + 18;

  ctx.fillStyle = '#0d0d1a';
  ctx.fillRect(px, py, PW, PH);
  ctx.strokeStyle = '#f5c518';
  ctx.lineWidth = 1;
  ctx.strokeRect(px + 0.5, py + 0.5, PW - 1, PH - 1);

  for (let i = 0; i < PRESETS.length; i++) {
    const col = i % 4, row = Math.floor(i / 4);
    const sx = px + 6 + col * 26, sy = py + 6 + row * 24;
    ctx.fillStyle = PRESETS[i];
    ctx.fillRect(sx, sy, 20, 18);
    if (PRESETS[i] === ENV_CFG[_picker.field]) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.strokeRect(sx - 1, sy - 1, 22, 20);
      ctx.lineWidth = 1;
    }
  }
}

// ── Public draw function ──────────────────────────────────────────────────────
export function drawEntornoTab(ctx, panelX, panelY, panelW, panelH, mouseX, mouseY) {
  _controls = _buildControls(panelX, panelY, panelW);
  for (const ctrl of _controls) {
    switch (ctrl.type) {
      case 'section': _drawSection(ctx, ctrl); break;
      case 'slider':  _drawSlider(ctx, ctrl);  break;
      case 'color':   _drawColor(ctx, ctrl);   break;
      case 'toggle':  _drawToggle(ctx, ctrl);  break;
    }
  }
  _drawColorPicker(ctx, panelX, panelW);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

// ── Public click/drag handler ─────────────────────────────────────────────────
export function handleEntornoTabInput(mx, my, mouseDown, clicked) {
  if (!mouseDown && _dragField) { _dragField = null; }

  if (mouseDown && _dragField) {
    const ctrl = _controls.find(c => c.field === _dragField);
    if (ctrl?.type === 'slider') {
      const frac = Math.max(0, Math.min(1, (mx - ctrl.trackX) / ctrl.trackW));
      const raw  = ctrl.min + frac * (ctrl.max - ctrl.min);
      ENV_CFG[ctrl.field] = ctrl.decimals === 0 ? Math.round(raw) : parseFloat(raw.toFixed(ctrl.decimals));
      return { changed: true };
    }
  }

  if (!clicked) return { changed: false };

  if (_picker) {
    for (let i = 0; i < PRESETS.length; i++) {
      const col = i % 4, row = Math.floor(i / 4);
      const sx = _picker.x + 6 + col * 26, sy = _picker.y + 18 + 6 + row * 24;
      if (_hit(mx, my, sx, sy, 20, 18)) {
        ENV_CFG[_picker.field] = PRESETS[i];
        _picker = null;
        return { changed: true };
      }
    }
    _picker = null;
    return { changed: false };
  }

  for (const ctrl of _controls) {
    if (ctrl.type === 'slider') {
      if (_hit(mx, my, ctrl.trackX - 4, ctrl.y, ctrl.trackW + 8, ctrl.h)) {
        _dragField = ctrl.field;
        const frac = Math.max(0, Math.min(1, (mx - ctrl.trackX) / ctrl.trackW));
        const raw  = ctrl.min + frac * (ctrl.max - ctrl.min);
        ENV_CFG[ctrl.field] = ctrl.decimals === 0 ? Math.round(raw) : parseFloat(raw.toFixed(ctrl.decimals));
        return { changed: true };
      }
    }
    if (ctrl.type === 'color') {
      if (_hit(mx, my, ctrl.swatchX, ctrl.swatchY, ctrl.swatchW + 60, ctrl.swatchH)) {
        _picker = { field: ctrl.field, x: ctrl.swatchX, y: ctrl.y };
        return { changed: false };
      }
    }
    if (ctrl.type === 'toggle') {
      if (_hit(mx, my, ctrl.btnX, ctrl.btnY, ctrl.btnW, ctrl.btnH)) {
        ENV_CFG[ctrl.field] = !ENV_CFG[ctrl.field];
        return { changed: true };
      }
    }
  }

  return { changed: false };
}

function _hit(mx, my, x, y, w, h) {
  return mx >= x && mx < x + w && my >= y && my < y + h;
}
