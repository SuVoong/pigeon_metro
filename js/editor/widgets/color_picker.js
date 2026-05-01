// color_picker.js — Floating color picker popup.
// Opened by clicking a color swatch in the inspector. Writes back to the
// active preset via PM.patchActive.

import * as PM from '../preset_manager.js';

const PALETTE = [
  '#FFFFFF','#DDDDDD','#888888','#555555','#222222','#000000',
  '#F0F0F0','#E8C599','#A07000','#5A3D1A','#1A1A00','#0a0a14',
  '#CC1111','#FF6600','#F5C518','#FFAA00','#A0CC11','#5DCAA5',
  '#4488AA','#1A3A8A','#3F51B5','#9B27B0','#CC22A8','#FF4488',
];

let _open = false;
let _path = null;       // dotted path being edited
let _pos  = { x: 0, y: 0 };
let _hits = [];

const W = 168, H = 130;

export function openColorPicker(path, x, y) {
  _open = true;
  _path = path;
  _pos  = { x, y };
}

export function closeColorPicker() {
  _open = false;
  _path = null;
}

export function isColorPickerOpen() { return _open; }

export function drawColorPicker(ctx) {
  if (!_open) return;
  _hits = [];

  // Clamp to canvas
  const cvs = ctx.canvas;
  const x = Math.max(8, Math.min(cvs.width  - W - 8, _pos.x));
  const y = Math.max(8, Math.min(cvs.height - H - 8, _pos.y));

  ctx.fillStyle = '#0d0d1a';
  ctx.fillRect(x, y, W, H);
  ctx.strokeStyle = '#f5c518';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, W - 1, H - 1);

  // Header
  ctx.fillStyle = '#f5c518';
  ctx.font = 'bold 9px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('🎨 COLOR', x + 8, y + 6);

  // Swatches grid (6 cols × 4 rows)
  const cols = 6;
  const rows = Math.ceil(PALETTE.length / cols);
  const sw = 22, sh = 18, gap = 2;
  const gx = x + 8;
  const gy = y + 22;
  const current = PM.getPath(PM.getActive(), _path);
  for (let i = 0; i < PALETTE.length; i++) {
    const col = i % cols, row = Math.floor(i / cols);
    const sx = gx + col * (sw + gap);
    const sy = gy + row * (sh + gap);
    ctx.fillStyle = PALETTE[i];
    ctx.fillRect(sx, sy, sw, sh);
    if (PALETTE[i] === current) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.strokeRect(sx - 1, sy - 1, sw + 2, sh + 2);
      ctx.lineWidth = 1;
    }
    _hits.push({ id: 'pickColor', color: PALETTE[i],
                 x: sx, y: sy, w: sw, h: sh });
  }

  // Hex display
  ctx.fillStyle = '#888';
  ctx.font = '9px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(current || '—', x + 8, y + H - 14);

  // Close X
  const cxW = 18, cxX = x + W - cxW - 4, cxY = y + 4;
  ctx.fillStyle = '#cc3333';
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('✕', cxX + cxW / 2, cxY + 8);
  _hits.push({ id: 'closePicker', x: cxX, y: cxY, w: cxW, h: 16 });
}

export function handleColorPickerInput(mx, my, clicked) {
  if (!_open) return false;
  if (!clicked) return true;   // swallow drags while open

  for (const h of _hits) {
    if (mx < h.x || mx >= h.x + h.w || my < h.y || my >= h.y + h.h) continue;
    if (h.id === 'pickColor') {
      PM.patchActive(_path, h.color);
      closeColorPicker();
      return true;
    }
    if (h.id === 'closePicker') {
      closeColorPicker();
      return true;
    }
  }

  // Click outside picker → close it (does not propagate further this frame)
  closeColorPicker();
  return true;
}
