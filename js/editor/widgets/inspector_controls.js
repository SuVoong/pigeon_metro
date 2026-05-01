// inspector_controls.js — Shared helpers for drawing inspector rows
// (sliders, color swatches, toggles, dropdowns) and emitting hit records.

import * as PM from '../preset_manager.js';
import { openColorPicker } from './color_picker.js';

// Layout
export const ROW_H    = 24;
export const SECTION_H = 26;
export const LABEL_W  = 110;
export const TRACK_W  = 90;

// ── Section header ────────────────────────────────────────────────────────────
export function drawSection(ctx, region, y, label) {
  ctx.fillStyle = '#f5c518';
  ctx.font = 'bold 9px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, region.x, y + SECTION_H / 2 + 4);
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(region.x, y + SECTION_H - 1, region.w, 1);
  return y + SECTION_H;
}

// ── Slider row ────────────────────────────────────────────────────────────────
// path: dotted path into the active preset (e.g. 'fisica.pigeonSpeed')
export function drawSlider(ctx, region, y, label, path, min, max, decimals = 2) {
  const preset = PM.getActive();
  let val = PM.getPath(preset, path);
  if (typeof val !== 'number') val = min;
  const frac = Math.max(0, Math.min(1, (val - min) / (max - min)));
  const tx = region.x + LABEL_W;
  const ty = y + ROW_H / 2;
  const tw = TRACK_W;

  // Label
  ctx.fillStyle = '#999';
  ctx.font = '10px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, region.x, ty);

  // Track
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(tx, ty - 2, tw, 4);
  ctx.fillStyle = '#f5c518';
  ctx.fillRect(tx, ty - 2, Math.round(frac * tw), 4);

  // Thumb
  const thumbX = tx + Math.round(frac * tw);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(thumbX - 3, ty - 6, 6, 12);

  // Value
  const disp = decimals === 0 ? Math.round(val).toString() : val.toFixed(decimals);
  ctx.fillStyle = '#ccc';
  ctx.font = '10px monospace';
  ctx.fillText(disp, tx + tw + 6, ty);

  return {
    nextY: y + ROW_H,
    hit: {
      id: 'slider', field: path, path,
      min, max, decimals,
      x: tx - 4, y, w: tw + 60, h: ROW_H,
      trackX: tx, trackW: tw,
    },
  };
}

// ── Color swatch ──────────────────────────────────────────────────────────────
export function drawColor(ctx, region, y, label, path) {
  const preset = PM.getActive();
  const val = PM.getPath(preset, path) || '#000';
  const sx = region.x + LABEL_W;
  const sy = y + 4;
  const sw = 22, sh = 16;
  const ty = y + ROW_H / 2;

  ctx.fillStyle = '#999';
  ctx.font = '10px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, region.x, ty);

  ctx.fillStyle = val;
  ctx.fillRect(sx, sy, sw, sh);
  ctx.strokeStyle = '#555';
  ctx.lineWidth = 1;
  ctx.strokeRect(sx + 0.5, sy + 0.5, sw - 1, sh - 1);

  ctx.fillStyle = '#888';
  ctx.font = '9px monospace';
  ctx.fillText(val, sx + sw + 6, ty);

  return {
    nextY: y + ROW_H,
    hit: {
      id: 'color', path,
      x: sx, y, w: sw + 80, h: ROW_H,
      swatchX: sx, swatchY: sy,
    },
  };
}

// ── Toggle (boolean) ──────────────────────────────────────────────────────────
export function drawToggle(ctx, region, y, label, path) {
  const preset = PM.getActive();
  const val = !!PM.getPath(preset, path);
  const tx = region.x + LABEL_W;
  const ty = y + ROW_H / 2;
  const tw = 36, th = 14;

  ctx.fillStyle = '#999';
  ctx.font = '10px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, region.x, ty);

  ctx.fillStyle = val ? '#5DCAA5' : '#1a1a2e';
  ctx.fillRect(tx, ty - th / 2, tw, th);
  ctx.strokeStyle = val ? '#5DCAA5' : '#444';
  ctx.lineWidth = 1;
  ctx.strokeRect(tx + 0.5, ty - th / 2 + 0.5, tw - 1, th - 1);

  // Knob
  ctx.fillStyle = '#fff';
  ctx.fillRect(tx + (val ? tw - 12 : 2), ty - th / 2 + 2, 10, th - 4);

  ctx.fillStyle = val ? '#5DCAA5' : '#666';
  ctx.font = 'bold 9px monospace';
  ctx.fillText(val ? 'ON' : 'OFF', tx + tw + 8, ty);

  return {
    nextY: y + ROW_H,
    hit: { id: 'toggle', path, x: tx, y, w: tw + 40, h: ROW_H },
  };
}

// ── Dropdown (select) ─────────────────────────────────────────────────────────
export function drawDropdown(ctx, region, y, label, path, options) {
  const preset = PM.getActive();
  const val = PM.getPath(preset, path) || options[0];
  const tx = region.x + LABEL_W;
  const ty = y + ROW_H / 2;
  const tw = TRACK_W + 50;

  ctx.fillStyle = '#999';
  ctx.font = '10px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, region.x, ty);

  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(tx, ty - 8, tw, 16);
  ctx.strokeStyle = '#444';
  ctx.lineWidth = 1;
  ctx.strokeRect(tx + 0.5, ty - 8 + 0.5, tw - 1, 15);

  ctx.fillStyle = '#ddd';
  ctx.fillText(val, tx + 6, ty);
  ctx.fillStyle = '#888';
  ctx.textAlign = 'right';
  ctx.fillText('▼', tx + tw - 6, ty);

  return {
    nextY: y + ROW_H,
    hit: { id: 'dropdown', path, options, x: tx, y, w: tw, h: ROW_H },
  };
}

// ── Common input handler for non-slider hits ──────────────────────────────────
export function handleCommonHit(hit) {
  if (hit.id === 'color') {
    openColorPicker(hit.path, hit.swatchX + 24, hit.swatchY + 18);
    return true;
  }
  if (hit.id === 'toggle') {
    const preset = PM.getActive();
    const cur = !!PM.getPath(preset, hit.path);
    PM.patchActive(hit.path, !cur);
    return true;
  }
  if (hit.id === 'dropdown') {
    // Cycle through options on click (simple — popup would be nicer)
    const preset = PM.getActive();
    const cur = PM.getPath(preset, hit.path);
    const idx = hit.options.indexOf(cur);
    const next = hit.options[(idx + 1) % hit.options.length];
    PM.patchActive(hit.path, next);
    return true;
  }
  return false;
}
