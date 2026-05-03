// panel_toolbar.js — Top bar of the editor modal.
// Layout (left → right):
//   [LOGO]  [PRESET ▼]  [STATION ▼]  | [▶ ⏸ ↻] | [📐 🎯 📏] | ● dirty | [IMPORT EXPORT SAVE] [✕]

import * as PM from '../preset_manager.js';
import * as Modal from '../editor_modal.js';
import * as DD from '../widgets/dropdown.js';
import { DIFFICULTY_COLORS } from '../config_schema.js';
import { exportPresetToFile, importPresetFromFile } from '../widgets/file_io.js';
import { MADRID_LINES } from '../../escenarios/metro_madrid/datos_madrid.js';

// ── State ─────────────────────────────────────────────────────────────────────
let _hits = [];   // hit-test rects built each draw
let _selectedStation = (() => {
  try { return localStorage.getItem('vp_selected_station') || 'Delicias'; } catch (_) { return 'Delicias'; }
})();

// ── Station options builder ───────────────────────────────────────────────────
function _buildStationOptions() {
  const seen = new Set();
  const options = [];
  for (const line of MADRID_LINES) {
    let addedHeader = false;
    for (const s of line.stations) {
      if (seen.has(s.name)) continue;
      seen.add(s.name);
      if (!addedHeader) {
        options.push({ value: `__hdr_${line.id}`, label: `── L${line.id} · ${line.name} ──`, disabled: true });
        addedHeader = true;
      }
      const assigned = PM.getStationPreset(s.name);
      options.push({ value: s.name, label: s.name, icon: assigned !== 'normal' ? '★' : ' ' });
    }
  }
  return options;
}

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

  // ── Preset selector dropdown ────────────────────────────────────────────────
  const presetOptions = PM.getAll().map(p => ({
    value: p.id,
    label: p.name,
    icon: p.id === PM.getActiveId() ? '●' : '○',
    disabled: false,
  }));

  const presetX = cx;
  const presetY = y + 12;
  const presetW = 180;
  const presetH = h - 24;

  DD.registerDropdown(
    'preset_selector',
    presetX, presetY, presetW, presetH,
    presetOptions,
    PM.getActiveId() ?? 'normal',
    (newId) => {
      PM.setActive(newId);
      Modal.showToast(`Preset activo: ${PM.getActive().name}`, '#5DCAA5');
    }
  );
  DD.drawDropdownTrigger(ctx, 'preset_selector');
  cx += presetW + 8;

  // ── Station selector dropdown ───────────────────────────────────────────────
  const stationOptions = _buildStationOptions();

  const stationX = cx;
  const stationY = y + 12;
  const stationW = 170;
  const stationH = h - 24;

  DD.registerDropdown(
    'station_selector',
    stationX, stationY, stationW, stationH,
    stationOptions,
    _selectedStation,
    (newStation) => {
      if (newStation.startsWith('__hdr_')) return;
      _selectedStation = newStation;
      try { localStorage.setItem('vp_selected_station', newStation); } catch (_) {}
      const presetId = PM.getStationPreset(newStation);
      PM.setActive(presetId);
      Modal.showToast(`${newStation} · ${PM.getActive()?.name || 'normal'}`, '#5DCAA5');
    }
  );
  DD.drawDropdownTrigger(ctx, 'station_selector');
  cx += stationW + 16;

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
  // Handle dropdown clicks first (they have priority)
  DD.handleDropdownMouseMove(mx, my);
  if (clicked) {
    if (DD.handleDropdownClick(mx, my)) return;
  }

  if (!clicked) return;

  for (const h of _hits) {
    if (mx < h.x || mx >= h.x + h.w || my < h.y || my >= h.y + h.h) continue;

    switch (h.id) {
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
}
