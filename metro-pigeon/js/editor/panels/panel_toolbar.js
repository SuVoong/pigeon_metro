// panel_toolbar.js — Top bar of the editor modal.
// Layout (left → right):
//   [LOGO]  [PRESET ▼]  [STATION ▼]  | [▶ ⏸ ↻] | [📐 🎯 📏] | ● dirty | [IMPORT EXPORT SAVE] [✕]

import * as PM from '../preset_manager.js';
import * as Modal from '../editor_modal.js';
import { DIFFICULTY_COLORS } from '../config_schema.js';
import { exportPresetToFile, importPresetFromFile } from '../widgets/file_io.js';

// ── State ─────────────────────────────────────────────────────────────────────
let _presetMenuOpen  = false;
let _stationMenuOpen = false;
let _hits = [];   // hit-test rects built each draw

// ── Public draw ───────────────────────────────────────────────────────────────
export function drawToolbar(ctx, x, y, w, h) {
  _hits = [];

  // Background
  ctx.fillStyle = '#0a0a14';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#f5c518';
  ctx.fillRect(x, y + h - 2, w, 2);

  // Logo
  ctx.fillStyle = '#f5c518';
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('⚙ EDITOR', x + 14, y + h / 2);
  ctx.fillStyle = '#666';
  ctx.font = '10px monospace';
  ctx.fillText('VIAJE PALOMERO', x + 14, y + h / 2 + 14);

  let cx = x + 130;

  // ── Preset selector ─────────────────────────────────────────────────────────
  cx = _drawPresetSelector(ctx, cx, y + 12, h - 24) + 8;

  // ── Station selector (assigns active preset to a station) ───────────────────
  cx = _drawStationSelector(ctx, cx, y + 12, h - 24) + 16;

  // ── Preview controls ────────────────────────────────────────────────────────
  cx = _drawIconButton(ctx, cx, y + 12, h - 24, Modal.isPreviewPlaying() ? '⏸' : '▶',
                       'preview', '#5DCAA5') + 4;
  cx = _drawIconButton(ctx, cx, y + 12, h - 24, '↻', 'reset', '#888') + 16;

  // ── Visual toggles ──────────────────────────────────────────────────────────
  const T = Modal.getToggles();
  cx = _drawToggle(ctx, cx, y + 12, h - 24, '📐', 'grid',   T.grid)   + 4;
  cx = _drawToggle(ctx, cx, y + 12, h - 24, '🎯', 'snap',   T.snap)   + 4;
  cx = _drawToggle(ctx, cx, y + 12, h - 24, '📏', 'hitbox', T.hitbox) + 16;

  // ── Dirty indicator ─────────────────────────────────────────────────────────
  if (PM.isDirty()) {
    ctx.fillStyle = '#FF8800';
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('● Cambios sin guardar', cx, y + h / 2);
  }

  // ── Right-aligned action buttons ────────────────────────────────────────────
  let rx = x + w - 14;
  rx = _drawTextButtonRight(ctx, rx, y + 12, h - 24, '✕', 'close', '#cc3333') - 8;
  rx = _drawTextButtonRight(ctx, rx, y + 12, h - 24, 'GUARDAR',  'save',   '#f5c518') - 4;
  rx = _drawTextButtonRight(ctx, rx, y + 12, h - 24, 'EXPORTAR', 'export', '#888')    - 4;
  rx = _drawTextButtonRight(ctx, rx, y + 12, h - 24, 'IMPORTAR', 'import', '#888');

  // ── Floating menus drawn on top ─────────────────────────────────────────────
  if (_presetMenuOpen)  _drawPresetMenu(ctx);
  if (_stationMenuOpen) _drawStationMenu(ctx);
}

// ── Preset selector ───────────────────────────────────────────────────────────
function _drawPresetSelector(ctx, bx, by, bh) {
  const active = PM.getActive();
  const label  = active ? active.name : '—';
  const diffColor = DIFFICULTY_COLORS[active?.difficulty] || '#888';

  ctx.font = 'bold 11px monospace';
  const tw = Math.max(140, ctx.measureText(label).width + 56);

  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(bx, by, tw, bh);
  ctx.strokeStyle = '#f5c518';
  ctx.lineWidth = 1;
  ctx.strokeRect(bx + 0.5, by + 0.5, tw - 1, bh - 1);

  // Difficulty dot
  ctx.fillStyle = diffColor;
  ctx.beginPath();
  ctx.arc(bx + 12, by + bh / 2, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#f5c518';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, bx + 22, by + bh / 2);

  ctx.fillStyle = '#888';
  ctx.fillText('▼', bx + tw - 14, by + bh / 2);

  _hits.push({ id: 'presetMenu', x: bx, y: by, w: tw, h: bh });
  return bx + tw;
}

function _drawPresetMenu(ctx) {
  const hit = _hits.find(h => h.id === 'presetMenu');
  if (!hit) return;
  const items = PM.getAll();
  const itemH = 22;
  const w = Math.max(hit.w, 200);
  const h = items.length * itemH + 28;
  const x = hit.x;
  const y = hit.y + hit.h + 2;

  ctx.fillStyle = '#0a0a14';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#f5c518';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

  // Items
  const activeId = PM.getActiveId();
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const iy = y + 4 + i * itemH;
    if (it.id === activeId) {
      ctx.fillStyle = 'rgba(245,197,24,0.15)';
      ctx.fillRect(x + 2, iy, w - 4, itemH);
    }
    // Difficulty dot
    ctx.fillStyle = DIFFICULTY_COLORS[it.difficulty] || '#888';
    ctx.beginPath();
    ctx.arc(x + 12, iy + itemH / 2, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = it.id === activeId ? '#f5c518' : '#ddd';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(it.name, x + 22, iy + itemH / 2);

    if (it.builtin) {
      ctx.fillStyle = '#666';
      ctx.font = '9px monospace';
      ctx.textAlign = 'right';
      ctx.fillText('builtin', x + w - 8, iy + itemH / 2);
    }
    _hits.push({ id: 'pickPreset', presetId: it.id, x: x + 2, y: iy, w: w - 4, h: itemH });
  }
  // "+ New" footer
  const fy = y + 4 + items.length * itemH;
  ctx.fillStyle = '#5DCAA5';
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('＋ Crear nuevo preset', x + 12, fy + 11);
  _hits.push({ id: 'newPreset', x: x + 2, y: fy, w: w - 4, h: 22 });
}

// ── Station selector ──────────────────────────────────────────────────────────
function _drawStationSelector(ctx, bx, by, bh) {
  ctx.font = '10px monospace';
  const tw = 150;

  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(bx, by, tw, bh);
  ctx.strokeStyle = '#444';
  ctx.lineWidth = 1;
  ctx.strokeRect(bx + 0.5, by + 0.5, tw - 1, bh - 1);

  ctx.fillStyle = '#888';
  ctx.font = 'bold 9px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('ASIGNAR A', bx + 6, by + 4);

  ctx.fillStyle = '#bbb';
  ctx.font = '10px monospace';
  ctx.textBaseline = 'middle';
  ctx.fillText('Estación...', bx + 6, by + bh / 2 + 4);

  ctx.fillStyle = '#666';
  ctx.fillText('▼', bx + tw - 14, by + bh / 2 + 4);

  _hits.push({ id: 'stationMenu', x: bx, y: by, w: tw, h: bh });
  return bx + tw;
}

function _drawStationMenu(ctx) {
  const hit = _hits.find(h => h.id === 'stationMenu');
  if (!hit) return;
  // Lazy-import station list to avoid hard dependency on the map module.
  let stations = [];
  try {
    const mod = window.__VP_MAP_DATA__;
    stations = (mod && mod.stations) || [];
  } catch (_) { /* */ }
  if (stations.length === 0) {
    stations = ['Sol', 'Lavapiés', 'Atocha', 'Delicias', 'Embajadores'];
  }

  const itemH = 20;
  const maxRows = 12;
  const rows = Math.min(maxRows, stations.length);
  const w = Math.max(hit.w, 200);
  const h = rows * itemH + 8;
  const x = hit.x;
  const y = hit.y + hit.h + 2;

  ctx.fillStyle = '#0a0a14';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#444';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

  for (let i = 0; i < rows; i++) {
    const name = stations[i];
    const iy = y + 4 + i * itemH;
    const assigned = PM.getStationPreset(name);
    const isAssignedToActive = assigned === PM.getActiveId();

    ctx.fillStyle = isAssignedToActive ? 'rgba(93,202,165,0.18)' : 'transparent';
    if (isAssignedToActive) ctx.fillRect(x + 2, iy, w - 4, itemH);

    ctx.fillStyle = '#ddd';
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, x + 8, iy + itemH / 2);

    if (isAssignedToActive) {
      ctx.fillStyle = '#5DCAA5';
      ctx.textAlign = 'right';
      ctx.fillText('✓', x + w - 8, iy + itemH / 2);
    }
    _hits.push({ id: 'pickStation', station: name, x: x + 2, y: iy, w: w - 4, h: itemH });
  }
}

// ── Generic buttons ───────────────────────────────────────────────────────────
function _drawIconButton(ctx, bx, by, bh, glyph, id, color) {
  const w = bh;
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(bx, by, w, bh);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.strokeRect(bx + 0.5, by + 0.5, w - 1, bh - 1);
  ctx.fillStyle = color;
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(glyph, bx + w / 2, by + bh / 2);
  _hits.push({ id, x: bx, y: by, w, h: bh });
  return bx + w;
}

function _drawToggle(ctx, bx, by, bh, glyph, id, isOn) {
  const w = bh;
  ctx.fillStyle = isOn ? 'rgba(245,197,24,0.20)' : '#1a1a2e';
  ctx.fillRect(bx, by, w, bh);
  ctx.strokeStyle = isOn ? '#f5c518' : '#444';
  ctx.lineWidth = 1;
  ctx.strokeRect(bx + 0.5, by + 0.5, w - 1, bh - 1);
  ctx.fillStyle = isOn ? '#f5c518' : '#666';
  ctx.font = 'bold 13px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(glyph, bx + w / 2, by + bh / 2);
  _hits.push({ id: 'toggle', name: id, x: bx, y: by, w, h: bh });
  return bx + w;
}

function _drawTextButtonRight(ctx, rightX, by, bh, label, id, color) {
  ctx.font = 'bold 10px monospace';
  const tw = ctx.measureText(label).width + 16;
  const bx = rightX - tw;
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(bx, by, tw, bh);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.strokeRect(bx + 0.5, by + 0.5, tw - 1, bh - 1);
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, bx + tw / 2, by + bh / 2);
  _hits.push({ id, x: bx, y: by, w: tw, h: bh });
  return bx;
}

// ── Input ─────────────────────────────────────────────────────────────────────
export function handleToolbarInput(mx, my, clicked, region) {
  if (!clicked) return;

  for (const h of _hits) {
    if (mx < h.x || mx >= h.x + h.w || my < h.y || my >= h.y + h.h) continue;

    switch (h.id) {
      case 'presetMenu':
        _presetMenuOpen = !_presetMenuOpen;
        _stationMenuOpen = false;
        return;
      case 'pickPreset':
        PM.setActive(h.presetId);
        _presetMenuOpen = false;
        Modal.showToast(`Preset activo: ${PM.getActive().name}`, '#5DCAA5');
        return;
      case 'newPreset': {
        const name = (typeof prompt === 'function')
          ? prompt('Nombre del nuevo preset:', 'Mi Preset')
          : `Preset ${Date.now()}`;
        if (name) {
          const p = PM.create(name, PM.getActiveId());
          PM.setActive(p.id);
          Modal.showToast(`Preset creado: ${p.name}`, '#5DCAA5');
        }
        _presetMenuOpen = false;
        return;
      }
      case 'stationMenu':
        _stationMenuOpen = !_stationMenuOpen;
        _presetMenuOpen = false;
        return;
      case 'pickStation':
        PM.setStationPreset(h.station, PM.getActiveId());
        _stationMenuOpen = false;
        Modal.showToast(`${h.station} → ${PM.getActive().name}`, '#5DCAA5');
        return;
      case 'preview':
        Modal.togglePreview();
        return;
      case 'reset':
        Modal.showToast('Preview reiniciada', '#888');
        return;
      case 'toggle':
        Modal.toggleFlag(h.name);
        return;
      case 'save':
        PM.commit();
        Modal.showToast('✓ Cambios guardados', '#5DCAA5');
        return;
      case 'export':
        exportPresetToFile(PM.getActive());
        Modal.showToast('Exportado a JSON', '#5DCAA5');
        return;
      case 'import':
        importPresetFromFile(result => {
          if (result.ok) {
            PM.setActive(result.preset.id);
            Modal.showToast(`Importado: ${result.preset.name}`, '#5DCAA5');
          } else {
            Modal.showToast(`Error: ${result.error}`, '#cc3333');
          }
        });
        return;
      case 'close':
        Modal.close();
        return;
    }
  }

  // Click outside any menu closes them.
  _presetMenuOpen = false;
  _stationMenuOpen = false;
}
