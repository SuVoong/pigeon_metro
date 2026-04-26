// editor_modal.js — Full-screen IDE-style editor modal.
// Layout:
//   ┌────────────────────────────────────────────────────────┐
//   │                       TOOLBAR                          │
//   ├──────────┬───────────────────────────────┬─────────────┤
//   │          │                               │             │
//   │ CATEGS   │           CANVAS              │  INSPECTOR  │
//   │          │                               │             │
//   │          │                               │             │
//   ├──────────┴───────────────────────────────┴─────────────┤
//   │                      TIMELINE                          │
//   └────────────────────────────────────────────────────────┘

import * as auth from './auth.js';
import * as PM   from './preset_manager.js';
import { drawToolbar,    handleToolbarInput    } from './panels/panel_toolbar.js';
import { drawCategories, handleCategoriesInput } from './panels/panel_categories.js';
import { drawCanvas,     handleCanvasInput     } from './panels/panel_canvas.js';
import { drawInspector,  handleInspectorInput  } from './panels/panel_inspector.js';
import { drawTimeline,   handleTimelineInput   } from './panels/panel_timeline.js';
import { drawColorPicker, handleColorPickerInput, isColorPickerOpen }
  from './widgets/color_picker.js';

// ── Layout constants ──────────────────────────────────────────────────────────
const LAYOUT = {
  toolbar:    { h: 56  },
  categories: { w: 220 },
  inspector:  { w: 280 },
  timeline:   { h: 110 },
};

// ── Module state ──────────────────────────────────────────────────────────────
let _open             = false;
let _selectedCategory = 'trenes';
let _selectedItemId   = null;
let _previewPlaying   = true;
let _toggles          = { grid: false, snap: true, hitbox: false };
let _toast            = null;   // { msg, frames, color }

// ── Public API ────────────────────────────────────────────────────────────────
export function open() {
  if (!auth.isAdmin()) return false;
  PM.init();
  _open = true;
  _selectedCategory = 'trenes';
  _selectedItemId   = null;
  return true;
}

export function close()  { _open = false; }
export function isOpen() { return _open; }

export function getLayout() { return LAYOUT; }

// Category selection
export function getSelectedCategory()  { return _selectedCategory; }
export function setSelectedCategory(c) { _selectedCategory = c; _selectedItemId = null; }

// Item (sprite/object) selection inside the active category
export function getSelectedItemId()  { return _selectedItemId; }
export function setSelectedItemId(id) { _selectedItemId = id; }

// Preview play/pause
export function isPreviewPlaying() { return _previewPlaying; }
export function togglePreview()    { _previewPlaying = !_previewPlaying; }

// Visual toggles
export function getToggles() { return _toggles; }
export function toggleFlag(name) {
  if (name in _toggles) _toggles[name] = !_toggles[name];
}

// Toast (status messages from buttons)
export function showToast(msg, color = '#5DCAA5') {
  _toast = { msg, frames: 90, color };
}
export function getToast() { return _toast; }

// ── Geometry helpers ─────────────────────────────────────────────────────────
function _regions(W, H) {
  const tbH = LAYOUT.toolbar.h;
  const tlH = LAYOUT.timeline.h;
  const catW = LAYOUT.categories.w;
  const insW = LAYOUT.inspector.w;
  const bodyTop = tbH;
  const bodyBottom = H - tlH;
  const bodyH = bodyBottom - bodyTop;
  return {
    toolbar:    { x: 0,         y: 0,          w: W,                       h: tbH  },
    categories: { x: 0,         y: bodyTop,    w: catW,                    h: bodyH },
    canvas:     { x: catW,      y: bodyTop,    w: W - catW - insW,         h: bodyH },
    inspector:  { x: W - insW,  y: bodyTop,    w: insW,                    h: bodyH },
    timeline:   { x: 0,         y: bodyBottom, w: W,                       h: tlH  },
  };
}

// ── Render ────────────────────────────────────────────────────────────────────
export function draw(ctx, canvas) {
  if (!_open) return;

  const W = canvas.width, H = canvas.height;
  const R = _regions(W, H);

  // Backdrop (covers everything underneath)
  ctx.fillStyle = '#050508';
  ctx.fillRect(0, 0, W, H);

  // Subtle grid behind everything
  _drawBackgroundGrid(ctx, W, H);

  drawToolbar   (ctx, R.toolbar.x,    R.toolbar.y,    R.toolbar.w,    R.toolbar.h);
  drawCategories(ctx, R.categories.x, R.categories.y, R.categories.w, R.categories.h);
  drawCanvas    (ctx, R.canvas.x,     R.canvas.y,     R.canvas.w,     R.canvas.h);
  drawInspector (ctx, R.inspector.x,  R.inspector.y,  R.inspector.w,  R.inspector.h);
  drawTimeline  (ctx, R.timeline.x,   R.timeline.y,   R.timeline.w,   R.timeline.h);

  // Floating widgets always on top
  drawColorPicker(ctx);

  // Toast (centered top)
  _drawToast(ctx, W, H);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.globalAlpha  = 1;
  ctx.shadowBlur   = 0;
}

function _drawBackgroundGrid(ctx, W, H) {
  ctx.strokeStyle = 'rgba(255,255,255,0.02)';
  ctx.lineWidth = 1;
  const step = 32;
  ctx.beginPath();
  for (let x = 0; x <= W; x += step) { ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, H); }
  for (let y = 0; y <= H; y += step) { ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); }
  ctx.stroke();
}

function _drawToast(ctx, W, H) {
  if (!_toast) return;
  const alpha = Math.min(1, _toast.frames / 30);
  ctx.font = 'bold 12px monospace';
  const tw = ctx.measureText(_toast.msg).width + 28;
  const tx = (W - tw) / 2;
  const ty = LAYOUT.toolbar.h + 12;
  ctx.fillStyle = `rgba(10,10,20,${alpha * 0.95})`;
  ctx.fillRect(tx, ty, tw, 26);
  ctx.strokeStyle = _toast.color;
  ctx.lineWidth = 1;
  ctx.globalAlpha = alpha;
  ctx.strokeRect(tx + 0.5, ty + 0.5, tw - 1, 25);
  ctx.fillStyle = _toast.color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(_toast.msg, tx + tw / 2, ty + 13);
  ctx.globalAlpha = 1;
}

// ── Input ────────────────────────────────────────────────────────────────────
export function handleInput(mx, my, mouseDown, clicked, keys, consumeKey, canvas) {
  if (!_open) return;

  const W = canvas.width, H = canvas.height;
  const R = _regions(W, H);

  // Tick toast
  if (_toast) { _toast.frames--; if (_toast.frames <= 0) _toast = null; }

  // Color picker eats input first if visible
  if (isColorPickerOpen()) {
    const handled = handleColorPickerInput(mx, my, clicked);
    if (handled) return;
  }

  // ESC closes the editor
  if (keys['Escape']) { consumeKey('Escape'); close(); return; }

  // Route by region
  if (_inside(mx, my, R.toolbar)) {
    handleToolbarInput(mx, my, clicked, R.toolbar);
  } else if (_inside(mx, my, R.timeline)) {
    handleTimelineInput(mx, my, mouseDown, clicked, R.timeline);
  } else if (_inside(mx, my, R.categories)) {
    handleCategoriesInput(mx, my, clicked, R.categories);
  } else if (_inside(mx, my, R.inspector)) {
    handleInspectorInput(mx, my, mouseDown, clicked, R.inspector);
  } else if (_inside(mx, my, R.canvas)) {
    handleCanvasInput(mx, my, mouseDown, clicked, R.canvas);
  }
}

function _inside(mx, my, r) {
  return mx >= r.x && mx < r.x + r.w && my >= r.y && my < r.y + r.h;
}
