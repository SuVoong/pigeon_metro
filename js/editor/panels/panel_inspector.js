// panel_inspector.js — Right-side properties panel.
// Delegates rendering to the matching cat_*.js for the active category.
// Each category exports { drawInspector(ctx, region, hits), handleInput(...) }
// that operate on the active preset via preset_manager.

import * as PM from '../preset_manager.js';
import * as Modal from '../editor_modal.js';
import { cat_trenes }         from '../categories/cat_trenes.js';
import { cat_obstaculos }     from '../categories/cat_obstaculos.js';
import { cat_coleccionables } from '../categories/cat_coleccionables.js';
import { cat_decoracion }     from '../categories/cat_decoracion.js';
import { cat_iluminacion }    from '../categories/cat_iluminacion.js';
import { cat_spawn }          from '../categories/cat_spawn.js';
import { cat_fisica }         from '../categories/cat_fisica.js';

const CAT_MODULES = {
  trenes:         cat_trenes,
  obstaculos:     cat_obstaculos,
  coleccionables: cat_coleccionables,
  decoracion:     cat_decoracion,
  iluminacion:    cat_iluminacion,
  spawn:          cat_spawn,
  fisica:         cat_fisica,
};

// ── Module state ──────────────────────────────────────────────────────────────
let _hits = [];
let _scroll = 0;
let _dragField = null;   // active slider drag

// ── Public draw ───────────────────────────────────────────────────────────────
export function drawInspector(ctx, x, y, w, h) {
  _hits = [];

  // Background
  ctx.fillStyle = '#08080F';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(x, y, 1, h);

  const catId = Modal.getSelectedCategory();
  const mod   = CAT_MODULES[catId];
  if (!mod) {
    _drawEmpty(ctx, x, y, w, h);
    return;
  }

  // Header
  ctx.fillStyle = '#666';
  ctx.font = 'bold 9px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('🔧 INSPECTOR', x + 12, y + 8);

  // Title (item-specific or category name)
  const preset = PM.getActive();
  const title = mod.getInspectorTitle ? mod.getInspectorTitle(preset) : catId.toUpperCase();
  ctx.fillStyle = '#f5c518';
  ctx.font = 'bold 13px monospace';
  ctx.fillText(title, x + 12, y + 22);

  // Divider
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(x + 12, y + 42, w - 24, 1);

  // Clip + delegate
  const contentY = y + 48;
  const contentH = h - 56;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, contentY, w, contentH);
  ctx.clip();
  ctx.translate(0, -_scroll);

  if (mod.drawInspector) {
    const region = { x: x + 12, y: contentY, w: w - 24, h: contentH };
    const result = mod.drawInspector(ctx, region, preset);
    if (result?.hits) _hits.push(...result.hits.map(h => ({ ...h, _scrolled: true })));
  }

  ctx.restore();
}

function _drawEmpty(ctx, x, y, w, h) {
  ctx.fillStyle = '#555';
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('No hay categoría seleccionada', x + w / 2, y + h / 2);
}

// ── Input ─────────────────────────────────────────────────────────────────────
export function handleInspectorInput(mx, my, mouseDown, clicked, region) {
  // Adjust my for scroll offset for hits that were drawn translated.
  const myAdj = my + _scroll;

  // Slider drag continues
  if (mouseDown && _dragField) {
    const ctrl = _hits.find(h => h.id === 'slider' && h.field === _dragField);
    if (ctrl) {
      const frac = Math.max(0, Math.min(1, (mx - ctrl.trackX) / ctrl.trackW));
      const raw  = ctrl.min + frac * (ctrl.max - ctrl.min);
      const val  = ctrl.decimals === 0 ? Math.round(raw)
                                       : parseFloat(raw.toFixed(ctrl.decimals));
      PM.patchActive(ctrl.path, val);
    }
    return;
  }
  if (!mouseDown && _dragField) _dragField = null;

  if (!clicked) return;

  // Look up hit
  for (const h of _hits) {
    const hy = h._scrolled ? h.y : h.y;
    if (mx < h.x || mx >= h.x + h.w || myAdj < hy || myAdj >= hy + h.h) continue;

    const catId = Modal.getSelectedCategory();
    const mod   = CAT_MODULES[catId];
    if (h.id === 'slider') {
      _dragField = h.field;
      const frac = Math.max(0, Math.min(1, (mx - h.trackX) / h.trackW));
      const raw  = h.min + frac * (h.max - h.min);
      const val  = h.decimals === 0 ? Math.round(raw)
                                    : parseFloat(raw.toFixed(h.decimals));
      PM.patchActive(h.path, val);
      return;
    }
    if (mod && mod.handleInput) {
      const handled = mod.handleInput(h, mx, myAdj);
      if (handled) return;
    }
  }
}
