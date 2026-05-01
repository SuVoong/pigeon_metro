// panel_canvas.js — Central preview area.
// Renders a miniature of the active preset using the same draw routines
// the actual game uses (drawTrainFront, drawTunnel...) so the preview is
// 1:1 with what the player will see in-game.

import * as PM from '../preset_manager.js';
import * as Modal from '../editor_modal.js';
import { CATEGORIES } from '../config_schema.js';

// ── State ─────────────────────────────────────────────────────────────────────
let _zoom = 1.0;
let _hits = [];
let _frame = 0;

// Drag of selected item (e.g. train sprite handle)
let _drag = null;   // { itemId, axis, startX, startY, startVal }

// ── Public draw ───────────────────────────────────────────────────────────────
export function drawCanvas(ctx, x, y, w, h) {
  _hits = [];
  _selectionRect = null;
  _frame++;

  // Background
  ctx.fillStyle = '#0d0d1a';
  ctx.fillRect(x, y, w, h);

  // Inner viewport
  const pad = 8;
  const vx = x + pad, vy = y + pad, vw = w - pad * 2, vh = h - pad * 2;

  // Border
  ctx.strokeStyle = '#1a1a2e';
  ctx.lineWidth = 1;
  ctx.strokeRect(vx + 0.5, vy + 0.5, vw - 1, vh - 1);

  // Clip and draw the live game preview inside the viewport
  ctx.save();
  ctx.beginPath();
  ctx.rect(vx, vy, vw, vh);
  ctx.clip();
  _drawPreview(ctx, vx, vy, vw, vh);
  ctx.restore();

  // Optional grid overlay
  if (Modal.getToggles().grid) _drawGridOverlay(ctx, vx, vy, vw, vh);

  // Selected item handles
  _drawSelectionHandles(ctx, vx, vy, vw, vh);

  // Hitbox overlay
  if (Modal.getToggles().hitbox) _drawHitboxOverlay(ctx, vx, vy, vw, vh);

  // Bottom right: zoom badge
  _drawZoomBadge(ctx, vx + vw - 90, vy + vh - 26);

  // Top left: grid badge
  if (Modal.getToggles().grid) _drawGridBadge(ctx, vx + 8, vy + 8);

  // Top right: category title
  _drawCategoryTitle(ctx, vx, vy, vw);
}

// ── Live preview using the active preset ─────────────────────────────────────
function _drawPreview(ctx, vx, vy, vw, vh) {
  const preset = PM.getActive();
  if (!preset) return;

  const ilum = preset.iluminacion;
  ctx.fillStyle = ilum?.bgColor || '#050508';
  ctx.fillRect(vx, vy, vw, vh);

  // Tunnel: simple radial gradient + perspective rings
  _drawFakeTunnel(ctx, vx, vy, vw, vh, preset);

  // Train(s) — use the first sprite as the lane train.
  const sprite = preset.trenes?.sprites?.[0];
  if (sprite) _drawSpriteOnTracks(ctx, vx, vy, vw, vh, sprite);

  // Coin sample
  if (preset.coleccionables?.coins?.enabled) {
    _drawCoinSample(ctx, vx + vw / 2 + 60, vy + vh * (sprite?.verticalPos || 0.6) - 30,
                    preset.coleccionables.coins);
  }

  // Pipe sample
  if (preset.obstaculos?.pipes?.enabled) {
    _drawPipeSample(ctx, vx + vw / 2 - 100, vy + vh * 0.35,
                    preset.obstaculos.pipes);
  }
}

function _drawFakeTunnel(ctx, vx, vy, vw, vh, preset) {
  const ilum = preset.iluminacion;
  const cx = vx + vw / 2, cy = vy + vh * 0.42;

  // Concentric rings
  const RINGS = 6;
  for (let i = RINGS - 1; i >= 0; i--) {
    const t = i / RINGS;
    const rw = vw * (0.15 + t * 0.85);
    const rh = vh * (0.15 + t * 0.85);
    ctx.strokeStyle = `rgba(120,120,140,${0.12 + (1 - t) * 0.18})`;
    ctx.lineWidth = 1;
    ctx.strokeRect(cx - rw / 2, cy - rh / 2, rw, rh);
  }

  // Floor strip
  ctx.fillStyle = '#1e1e28';
  ctx.fillRect(vx, vy + vh * 0.6, vw, vh * 0.4);

  // Rails
  ctx.strokeStyle = '#888899';
  ctx.lineWidth = 2;
  for (let lane = -1; lane <= 1; lane += 2) {
    ctx.beginPath();
    ctx.moveTo(cx + lane * 30, cy);
    ctx.lineTo(cx + lane * (vw / 2), vy + vh);
    ctx.stroke();
  }

  // Fluorescent lamp (top)
  if (ilum?.fluorescent?.enabled) {
    const flicker = ilum.fluorescent.flicker
      ? (Math.sin(_frame * 0.1) > 0.95 ? 0.5 : 1) : 1;
    const intensity = (ilum.fluorescent.intensity ?? 0.6) * flicker;
    ctx.fillStyle = ilum.fluorescent.color || '#fffbe6';
    ctx.globalAlpha = intensity;
    ctx.fillRect(cx - 40, vy + 6, 80, 4);
    ctx.globalAlpha = 1;
  }
}

function _drawSpriteOnTracks(ctx, vx, vy, vw, vh, sprite) {
  const cx = vx + vw / 2;
  const cy = vy + vh * (sprite.verticalPos || 0.6);
  const scale = (sprite.scaleMultiplier || 2.5);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  _drawTrainFromPixels(ctx, sprite);
  ctx.restore();

  _registerSelectionTarget(sprite.id, cx - sprite.baseWidth * scale / 2,
                           cy - sprite.baseHeight * scale / 2,
                           sprite.baseWidth * scale,
                           sprite.baseHeight * scale);
}

// Renders the sprite using its color palette.
// If pixelData has full pixel array we use that; otherwise we use a
// generic train-front shape colored by the palette.
function _drawTrainFromPixels(ctx, sprite) {
  const c = sprite.colors;
  const W = sprite.baseWidth || 48;
  const H = sprite.baseHeight || 40;

  // Body
  ctx.fillStyle = c.body || '#F0F0F0';
  ctx.fillRect(-W / 2, -H / 2, W, H);

  // Cab top + bottom strips
  ctx.fillStyle = c.cab || '#111';
  ctx.fillRect(-W / 2, -H / 2, W, 4);
  ctx.fillRect(-W / 2,  H / 2 - 6, W, 6);

  // Window strip
  ctx.fillStyle = c.window || '#1A2E3A';
  ctx.fillRect(-W / 2 + 4, -H / 2 + 8, W - 8, 10);

  // Stripe (mid)
  ctx.fillStyle = c.stripe || '#1A3A8A';
  ctx.fillRect(-W / 2, 2, W, 4);

  // LED panel
  ctx.fillStyle = c.ledBg || '#1A1A00';
  ctx.fillRect(-W / 2 + 6, H / 2 - 17, W - 12, 6);
  ctx.fillStyle = c.ledText || '#FF6600';
  ctx.font = 'bold 4px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(sprite.ledStation === 'AUTO' ? 'METRO' : (sprite.ledStation || ''),
               0, H / 2 - 14);

  // Lights
  ctx.fillStyle = c.light || '#CC1111';
  ctx.fillRect(-W / 2 + 2, -H / 2 + 2, 3, 3);
  ctx.fillRect( W / 2 - 5, -H / 2 + 2, 3, 3);
}

function _drawCoinSample(ctx, cx, cy, coins) {
  ctx.fillStyle = coins.color || '#F5C518';
  ctx.beginPath();
  ctx.arc(cx, cy, coins.size || 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = coins.borderColor || '#A07000';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function _drawPipeSample(ctx, cx, cy, pipes) {
  ctx.fillStyle = pipes.color || '#888899';
  ctx.fillRect(cx - 20, cy - (pipes.thickness || 14) / 2, 40, pipes.thickness || 14);
  ctx.fillStyle = pipes.shadowColor || '#444455';
  ctx.fillRect(cx - 20, cy + (pipes.thickness || 14) / 2 - 2, 40, 2);
}

// ── Overlays ──────────────────────────────────────────────────────────────────
function _drawGridOverlay(ctx, vx, vy, vw, vh) {
  const step = 16;
  ctx.strokeStyle = 'rgba(245,197,24,0.12)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = vx; x <= vx + vw; x += step) {
    ctx.moveTo(x + 0.5, vy); ctx.lineTo(x + 0.5, vy + vh);
  }
  for (let y = vy; y <= vy + vh; y += step) {
    ctx.moveTo(vx, y + 0.5); ctx.lineTo(vx + vw, y + 0.5);
  }
  ctx.stroke();
}

function _drawHitboxOverlay(ctx, vx, vy, vw, vh) {
  const preset = PM.getActive();
  const fisica = preset?.fisica;
  if (!fisica) return;
  // Pigeon hitbox indicator (centered)
  const cx = vx + vw / 2 - 60, cy = vy + vh * 0.55;
  const sz = fisica.pigeonHitboxSize || 20;
  ctx.strokeStyle = '#5DCAA5';
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.strokeRect(cx - sz / 2, cy - sz / 2, sz, sz);
  ctx.setLineDash([]);
  ctx.fillStyle = '#5DCAA5';
  ctx.font = '8px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('paloma', cx - sz / 2, cy + sz / 2 + 2);
}

// ── Selection handles ────────────────────────────────────────────────────────
let _selectionRect = null;

function _registerSelectionTarget(itemId, x, y, w, h) {
  if (Modal.getSelectedItemId() === itemId) {
    _selectionRect = { itemId, x, y, w, h };
  }
  _hits.push({ id: 'selectItem', itemId, x, y, w, h });
}

function _drawSelectionHandles(ctx, vx, vy, vw, vh) {
  if (!_selectionRect) return;
  const r = _selectionRect;
  ctx.strokeStyle = '#f5c518';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 3]);
  ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
  ctx.setLineDash([]);
  // 4 corner handles
  const HS = 8;
  const corners = [
    [r.x,         r.y        ],
    [r.x + r.w,   r.y        ],
    [r.x,         r.y + r.h  ],
    [r.x + r.w,   r.y + r.h  ],
  ];
  for (const [hx, hy] of corners) {
    ctx.fillStyle = '#f5c518';
    ctx.fillRect(hx - HS / 2, hy - HS / 2, HS, HS);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.strokeRect(hx - HS / 2 + 0.5, hy - HS / 2 + 0.5, HS - 1, HS - 1);
  }
}

// ── Badges ────────────────────────────────────────────────────────────────────
function _drawZoomBadge(ctx, x, y) {
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(x, y, 80, 20);
  ctx.strokeStyle = '#444';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, 79, 19);
  ctx.fillStyle = '#bbb';
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`×${_zoom.toFixed(1)}`, x + 8, y + 10);
}

function _drawGridBadge(ctx, x, y) {
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(x, y, 60, 18);
  ctx.fillStyle = '#f5c518';
  ctx.font = 'bold 9px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('grid 16', x + 6, y + 9);
}

function _drawCategoryTitle(ctx, vx, vy, vw) {
  const cat = CATEGORIES.find(c => c.id === Modal.getSelectedCategory());
  if (!cat) return;
  const txt = `${cat.icon} ${cat.name.toUpperCase()}`;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.font = 'bold 11px monospace';
  const tw = ctx.measureText(txt).width + 14;
  ctx.fillRect(vx + vw - tw - 8, vy + 8, tw, 22);
  ctx.fillStyle = '#f5c518';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(txt, vx + vw - tw - 1, vy + 19);
}

// ── Input ─────────────────────────────────────────────────────────────────────
export function handleCanvasInput(mx, my, mouseDown, clicked, region) {
  // Drag handling
  if (mouseDown && _drag) {
    const preset = PM.getActive();
    const sprite = preset?.trenes?.sprites?.find(s => s.id === _drag.itemId);
    if (sprite) {
      const dy = my - _drag.startY;
      sprite.verticalPos = Math.max(0.1, Math.min(0.95,
        _drag.startVal + dy / region.h));
      PM.markDirty();
    }
    return;
  }
  if (!mouseDown && _drag) { _drag = null; }

  if (!clicked) return;

  // Hit test from topmost
  for (let i = _hits.length - 1; i >= 0; i--) {
    const h = _hits[i];
    if (mx < h.x || mx >= h.x + h.w || my < h.y || my >= h.y + h.h) continue;
    if (h.id === 'selectItem') {
      Modal.setSelectedItemId(h.itemId);
      const preset = PM.getActive();
      const sprite = preset?.trenes?.sprites?.find(s => s.id === h.itemId);
      if (sprite) {
        _drag = { itemId: h.itemId, startX: mx, startY: my, startVal: sprite.verticalPos };
      }
      return;
    }
  }
}
