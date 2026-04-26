// tab_train.js — Train editor tab: controls for TRAIN_CFG

import { TRAIN_CFG } from '../train_config.js';
import { drawTrainFront } from '../../escenarios/metros/metro_base/metro_base_render.js';

// ── Layout constants ───────────────────────────────────────────────────────────
const ML  = 14;   // left margin inside panel
const LW  = 106;  // label column width
const SW  = 90;   // slider width
const RH  = 22;   // row height
const SH  = 28;   // section header height

// ── Preset colours for picker ─────────────────────────────────────────────────
const PRESETS = ['#F0F0F0','#1A3A8A','#111111','#FF6600','#CC1111','#F5C518','#4488AA','#FFFFFF'];

// ── Module state ──────────────────────────────────────────────────────────────
let _controls    = [];   // built each draw, used by click handler
let _dragField   = null; // field currently being slider-dragged
let _picker      = null; // { field, x, y } — open colour picker state

// ── Build the control list ────────────────────────────────────────────────────
function _buildControls(panelX, panelY, panelW, contentH) {
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

  addSection('TAMAÑO Y POSICIÓN');
  addSlider('Escala global',  'scaleMultiplier', 0.5, 4.0);
  addSlider('Pos. vertical',  'verticalPos',     0.2, 0.9);
  addSlider('Ancho base',     'baseWidth',       20,  120, 0);
  addSlider('Alto base',      'baseHeight',      15,  100, 0);

  addSection('COLORES');
  addColor('Cuerpo',    'bodyColor');
  addColor('Franja',    'stripeColor');
  addColor('Cabina',    'cabColor');
  addColor('Ventanas',  'windowColor');
  addColor('LED fondo', 'ledBgColor');
  addColor('LED texto', 'ledTextColor');
  addColor('Luces',     'lightColor');

  addSection('DINÁMICA');
  addSlider('Intervalo spawn', 'spawnIntervalFrames', 30,  300, 0);
  addSlider('Velocidad trenes','trainSpeed',           0.2, 3.0);
  addSlider('Max trenes',      'maxTrainsOnScreen',    1,   8,   0);

  // Preview placeholder — record bounds
  y += 6;
  controls.push({ type: 'preview', x: panelX + ML, y, w: panelW - ML * 2, h: 80 });
  y += 86;

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
  const val  = TRAIN_CFG[ctrl.field];
  const frac = (val - ctrl.min) / (ctrl.max - ctrl.min);
  const tx   = ctrl.trackX;
  const ty   = ctrl.y + ctrl.h / 2;
  const tw   = ctrl.trackW;

  // Label
  ctx.fillStyle = '#999';
  ctx.font = '10px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(ctrl.label, ctrl.x, ty);

  // Track background
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(tx, ty - 2, tw, 4);
  // Filled portion
  ctx.fillStyle = '#f5c518';
  ctx.fillRect(tx, ty - 2, Math.round(frac * tw), 4);
  // Thumb
  const thumbX = tx + Math.round(frac * tw);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(thumbX - 3, ty - 6, 6, 12);

  // Value
  const disp = ctrl.decimals === 0 ? Math.round(val).toString() : val.toFixed(ctrl.decimals);
  ctx.fillStyle = '#ccc';
  ctx.font = '10px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(disp, tx + tw + 6, ty);
}

function _drawColor(ctx, ctrl) {
  const val = TRAIN_CFG[ctrl.field];
  const ty  = ctrl.y + ctrl.h / 2;

  // Label
  ctx.fillStyle = '#999';
  ctx.font = '10px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(ctrl.label, ctrl.x, ty);

  // Swatch
  ctx.fillStyle = val;
  ctx.fillRect(ctrl.swatchX, ctrl.swatchY, ctrl.swatchW, ctrl.swatchH);
  ctx.strokeStyle = '#555';
  ctx.lineWidth = 1;
  ctx.strokeRect(ctrl.swatchX + 0.5, ctrl.swatchY + 0.5, ctrl.swatchW - 1, ctrl.swatchH - 1);

  // Hex label
  ctx.fillStyle = '#888';
  ctx.font = '9px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(val, ctrl.swatchX + ctrl.swatchW + 4, ty);
}

function _drawPreview(ctx, ctrl) {
  ctx.fillStyle = '#0a0a14';
  ctx.fillRect(ctrl.x, ctrl.y, ctrl.w, ctrl.h);
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1;
  ctx.strokeRect(ctrl.x + 0.5, ctrl.y + 0.5, ctrl.w - 1, ctrl.h - 1);

  ctx.fillStyle = '#666';
  ctx.font = '9px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('Vista previa', ctrl.x + ctrl.w / 2, ctrl.y + 2);

  // Mini train preview
  ctx.save();
  ctx.beginPath();
  ctx.rect(ctrl.x, ctrl.y, ctrl.w, ctrl.h);
  ctx.clip();
  ctx.translate(ctrl.x + ctrl.w / 2, ctrl.y + ctrl.h / 2 + 4);
  ctx.scale(0.7, 0.7);
  drawTrainFront(ctx, 0, 0, 1, TRAIN_CFG.stripeColor);
  ctx.restore();

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
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
    const sx = px + 6 + col * 26;
    const sy = py + 6 + row * 24;
    ctx.fillStyle = PRESETS[i];
    ctx.fillRect(sx, sy, 20, 18);
    if (PRESETS[i] === TRAIN_CFG[_picker.field]) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.strokeRect(sx - 1, sy - 1, 22, 20);
      ctx.lineWidth = 1;
    }
  }
}

// ── Public draw function ──────────────────────────────────────────────────────
export function drawTrainTab(ctx, panelX, panelY, panelW, panelH, mouseX, mouseY) {
  _controls = _buildControls(panelX, panelY, panelW, panelH);

  for (const ctrl of _controls) {
    switch (ctrl.type) {
      case 'section': _drawSection(ctx, ctrl); break;
      case 'slider':  _drawSlider(ctx, ctrl);  break;
      case 'color':   _drawColor(ctx, ctrl);   break;
      case 'preview': _drawPreview(ctx, ctrl); break;
    }
  }

  _drawColorPicker(ctx, panelX, panelW);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

// ── Public click/drag handler ─────────────────────────────────────────────────
/**
 * @returns {{ changed: boolean }}
 */
export function handleTrainTabInput(mx, my, mouseDown, clicked) {
  let changed = false;

  // Release drag
  if (!mouseDown && _dragField) { _dragField = null; }

  // Continue drag
  if (mouseDown && _dragField) {
    const ctrl = _controls.find(c => c.field === _dragField);
    if (ctrl && ctrl.type === 'slider') {
      const frac = Math.max(0, Math.min(1, (mx - ctrl.trackX) / ctrl.trackW));
      const raw  = ctrl.min + frac * (ctrl.max - ctrl.min);
      TRAIN_CFG[ctrl.field] = ctrl.decimals === 0 ? Math.round(raw) : parseFloat(raw.toFixed(ctrl.decimals));
      changed = true;
    }
    return { changed };
  }

  if (!clicked) return { changed: false };

  // Check colour picker first
  if (_picker) {
    for (let i = 0; i < PRESETS.length; i++) {
      const col = i % 4, row = Math.floor(i / 4);
      const sx = _picker.x + 6 + col * 26;
      const sy = _picker.y + 18 + 6 + row * 24;
      if (_hit(mx, my, sx, sy, 20, 18)) {
        TRAIN_CFG[_picker.field] = PRESETS[i];
        _picker = null;
        return { changed: true };
      }
    }
    // Click outside picker → close without change
    _picker = null;
    return { changed: false };
  }

  // Check controls
  for (const ctrl of _controls) {
    if (ctrl.type === 'slider') {
      if (_hit(mx, my, ctrl.trackX - 4, ctrl.y, ctrl.trackW + 8, ctrl.h)) {
        _dragField = ctrl.field;
        const frac = Math.max(0, Math.min(1, (mx - ctrl.trackX) / ctrl.trackW));
        const raw  = ctrl.min + frac * (ctrl.max - ctrl.min);
        TRAIN_CFG[ctrl.field] = ctrl.decimals === 0 ? Math.round(raw) : parseFloat(raw.toFixed(ctrl.decimals));
        return { changed: true };
      }
    }
    if (ctrl.type === 'color') {
      if (_hit(mx, my, ctrl.swatchX, ctrl.swatchY, ctrl.swatchW + 60, ctrl.swatchH)) {
        _picker = { field: ctrl.field, x: ctrl.swatchX, y: ctrl.y };
        return { changed: false };
      }
    }
  }

  return { changed: false };
}

function _hit(mx, my, x, y, w, h) {
  return mx >= x && mx < x + w && my >= y && my < y + h;
}
