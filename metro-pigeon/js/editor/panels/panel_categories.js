// panel_categories.js — Left-side category tree.

import * as PM from '../preset_manager.js';
import * as Modal from '../editor_modal.js';
import { CATEGORIES, DIFFICULTY_COLORS } from '../config_schema.js';

// ── State ─────────────────────────────────────────────────────────────────────
let _expanded = new Set(['trenes']);   // expanded category ids
let _hits = [];

// ── Public draw ───────────────────────────────────────────────────────────────
export function drawCategories(ctx, x, y, w, h) {
  _hits = [];

  // Background
  ctx.fillStyle = '#08080F';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(x + w - 1, y, 1, h);

  let cy = y + 8;

  // Header
  ctx.fillStyle = '#666';
  ctx.font = 'bold 9px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('📦 CATEGORÍAS', x + 12, cy);
  cy += 18;

  const activeCat = Modal.getSelectedCategory();
  const activeItem = Modal.getSelectedItemId();
  const preset = PM.getActive();

  for (const cat of CATEGORIES) {
    const isActive = cat.id === activeCat;
    const isOpen   = _expanded.has(cat.id);
    cy = _drawCategoryRow(ctx, x, cy, w, cat, isActive, isOpen);

    // Items (only for trenes / obstaculos with sprites)
    if (isOpen && preset) {
      const items = _itemsForCategory(preset, cat.id);
      for (const it of items) {
        cy = _drawItemRow(ctx, x, cy, w, cat.id, it,
                          activeItem === it.id && isActive);
      }
      // "+ Add new" footer for categories that support items
      if (cat.hasItems) {
        cy = _drawAddItem(ctx, x, cy, w, cat.id);
      }
    }
  }

  cy += 10;

  // Global palette (for quick reference)
  cy = _drawGlobalPalette(ctx, x, cy, w);

  // Presets list at bottom
  cy = _drawPresetsList(ctx, x, cy, w);
}

// ── Category row ──────────────────────────────────────────────────────────────
function _drawCategoryRow(ctx, x, y, w, cat, isActive, isOpen) {
  const rh = 24;
  ctx.fillStyle = isActive ? 'rgba(245,197,24,0.12)' : 'transparent';
  if (isActive) ctx.fillRect(x + 4, y, w - 8, rh);

  if (isActive) {
    ctx.fillStyle = '#f5c518';
    ctx.fillRect(x + 4, y, 2, rh);
  }

  // Caret
  ctx.fillStyle = isActive ? '#f5c518' : '#888';
  ctx.font = 'bold 9px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(isOpen ? '▼' : '▶', x + 12, y + rh / 2);

  // Icon + name
  ctx.font = '12px monospace';
  ctx.fillText(cat.icon, x + 28, y + rh / 2);
  ctx.fillStyle = isActive ? '#f5c518' : '#bbb';
  ctx.font = isActive ? 'bold 11px monospace' : '11px monospace';
  ctx.fillText(cat.name, x + 48, y + rh / 2);

  _hits.push({ id: 'cat', cat: cat.id, x, y, w, h: rh });
  return y + rh;
}

// ── Item row ──────────────────────────────────────────────────────────────────
function _drawItemRow(ctx, x, y, w, catId, item, isActive) {
  const rh = 20;
  if (isActive) {
    ctx.fillStyle = 'rgba(245,197,24,0.18)';
    ctx.fillRect(x + 24, y, w - 28, rh);
  }
  ctx.fillStyle = isActive ? '#f5c518' : '#999';
  ctx.font = isActive ? 'bold 10px monospace' : '10px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('•', x + 36, y + rh / 2);
  ctx.fillText(item.name, x + 48, y + rh / 2);
  _hits.push({ id: 'item', cat: catId, itemId: item.id, x: x + 24, y, w: w - 28, h: rh });
  return y + rh;
}

function _drawAddItem(ctx, x, y, w, catId) {
  const rh = 20;
  ctx.fillStyle = '#5DCAA5';
  ctx.font = '10px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('＋ Añadir...', x + 48, y + rh / 2);
  _hits.push({ id: 'addItem', cat: catId, x: x + 24, y, w: w - 28, h: rh });
  return y + rh;
}

// ── Items lookup ──────────────────────────────────────────────────────────────
function _itemsForCategory(preset, catId) {
  switch (catId) {
    case 'trenes':         return preset.trenes?.sprites || [];
    case 'obstaculos':     return preset.obstaculos?.customObstacles || [];
    case 'coleccionables': return preset.coleccionables?.powerups || [];
    case 'decoracion':     return preset.decoracion?.ambientObjects || [];
    default:               return [];
  }
}

// ── Global palette ────────────────────────────────────────────────────────────
function _drawGlobalPalette(ctx, x, y, w) {
  ctx.fillStyle = '#666';
  ctx.font = 'bold 9px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('🎨 PALETA GLOBAL', x + 12, y);
  y += 16;

  const preset = PM.getActive();
  const sprite = preset?.trenes?.sprites?.[0];
  if (!sprite) return y + 8;

  const colors = Object.values(sprite.colors);
  const swatchSize = 18;
  const cols = 6;
  for (let i = 0; i < colors.length; i++) {
    const col = i % cols, row = Math.floor(i / cols);
    const sx = x + 12 + col * (swatchSize + 4);
    const sy = y + row * (swatchSize + 4);
    ctx.fillStyle = colors[i];
    ctx.fillRect(sx, sy, swatchSize, swatchSize);
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.strokeRect(sx + 0.5, sy + 0.5, swatchSize - 1, swatchSize - 1);
  }
  return y + Math.ceil(colors.length / cols) * (swatchSize + 4) + 14;
}

// ── Presets list ──────────────────────────────────────────────────────────────
function _drawPresetsList(ctx, x, y, w) {
  ctx.fillStyle = '#666';
  ctx.font = 'bold 9px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('📁 PRESETS', x + 12, y);
  y += 16;

  const presets = PM.getAll();
  const activeId = PM.getActiveId();
  for (const p of presets) {
    const rh = 18;
    const isActive = p.id === activeId;
    if (isActive) {
      ctx.fillStyle = 'rgba(93,202,165,0.12)';
      ctx.fillRect(x + 4, y, w - 8, rh);
    }
    ctx.fillStyle = DIFFICULTY_COLORS[p.difficulty] || '#888';
    ctx.beginPath();
    ctx.arc(x + 18, y + rh / 2, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = isActive ? '#5DCAA5' : '#aaa';
    ctx.font = isActive ? 'bold 10px monospace' : '10px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(p.name, x + 28, y + rh / 2);
    if (isActive) {
      ctx.fillStyle = '#5DCAA5';
      ctx.textAlign = 'right';
      ctx.fillText('● activo', x + w - 12, y + rh / 2);
    }
    _hits.push({ id: 'pickPreset', presetId: p.id, x: x + 4, y, w: w - 8, h: rh });
    y += rh;
  }
  return y;
}

// ── Input ─────────────────────────────────────────────────────────────────────
export function handleCategoriesInput(mx, my, clicked, region) {
  if (!clicked) return;

  for (const h of _hits) {
    if (mx < h.x || mx >= h.x + h.w || my < h.y || my >= h.y + h.h) continue;

    switch (h.id) {
      case 'cat':
        if (Modal.getSelectedCategory() === h.cat) {
          // Toggle expansion if already selected
          if (_expanded.has(h.cat)) _expanded.delete(h.cat);
          else _expanded.add(h.cat);
        } else {
          Modal.setSelectedCategory(h.cat);
          _expanded.add(h.cat);
        }
        return;
      case 'item':
        Modal.setSelectedCategory(h.cat);
        Modal.setSelectedItemId(h.itemId);
        return;
      case 'addItem': {
        const preset = PM.getActive();
        if (h.cat === 'trenes' && preset?.trenes?.sprites) {
          const newId = `tren_${Date.now()}`;
          const tpl = preset.trenes.sprites[0]
            ? JSON.parse(JSON.stringify(preset.trenes.sprites[0]))
            : null;
          if (tpl) {
            tpl.id = newId;
            tpl.name = 'Tren nuevo';
            preset.trenes.sprites.push(tpl);
            PM.markDirty();
            Modal.setSelectedItemId(newId);
            Modal.showToast('Tren añadido', '#5DCAA5');
          }
        }
        return;
      }
      case 'pickPreset':
        PM.setActive(h.presetId);
        Modal.showToast(`Preset activo: ${PM.getActive().name}`, '#5DCAA5');
        return;
    }
  }
}
