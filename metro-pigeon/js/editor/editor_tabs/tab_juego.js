// tab_juego.js — Gameplay settings editor tab

import { loadConfigs } from '../config_store.js';

// ── Live game config object ────────────────────────────────────────────────────
export const GAME_CFG = loadConfigs().game;

/** Refresh GAME_CFG from persisted store (call after saveGameConfig). */
export function refreshGameConfig() {
  Object.assign(GAME_CFG, loadConfigs().game);
}

// ── Layout constants ───────────────────────────────────────────────────────────
const ML  = 14;
const LW  = 130;
const SW  = 80;
const RH  = 22;
const SH  = 28;

// ── Module state ──────────────────────────────────────────────────────────────
let _controls  = [];
let _dragField = null;

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

  addSection('DIFICULTAD');
  addSlider('Velocidad inicial',   'initialSpeed',      0.5, 5.0);
  addSlider('Rampa velocidad',     'speedRampPerFrame', 0.0001, 0.002, 4);

  addSection('VIDAS Y COLISIONES');
  addSlider('Vidas iniciales',     'startingLives',     1,  5,  0);
  addSlider('Frames invencible',   'invincibleFrames',  30, 180, 0);
  addSlider('Hitbox paloma (px)',  'pigeonHitboxSize',  8,  32,  0);
  addSlider('Margen hitbox tren',  'trainHitboxMargin', 0,  0.3);

  addSection('PUNTUACIÓN');
  addSlider('Puntos por frame',   'scorePerFrame',     0,  5,   0);
  addSlider('Valor moneda',       'coinValue',         10, 200, 0);
  addSlider('Valor migaja',       'breadcrumbValue',   5,  50,  0);

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
  const val  = GAME_CFG[ctrl.field];
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
  ctx.fillStyle = '#fff';
  ctx.fillRect(tx + Math.round(frac * ctrl.trackW) - 3, ty - 6, 6, 12);

  const disp = ctrl.decimals === 0 ? Math.round(val).toString() : val.toFixed(ctrl.decimals);
  ctx.fillStyle = '#ccc';
  ctx.font = '10px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(disp, tx + ctrl.trackW + 6, ty);
}

// ── Public draw function ──────────────────────────────────────────────────────
export function drawJuegoTab(ctx, panelX, panelY, panelW, panelH, mouseX, mouseY) {
  _controls = _buildControls(panelX, panelY, panelW);
  for (const ctrl of _controls) {
    if (ctrl.type === 'section') _drawSection(ctx, ctrl);
    if (ctrl.type === 'slider')  _drawSlider(ctx, ctrl);
  }
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

// ── Public click/drag handler ─────────────────────────────────────────────────
export function handleJuegoTabInput(mx, my, mouseDown, clicked) {
  if (!mouseDown && _dragField) { _dragField = null; }

  if (mouseDown && _dragField) {
    const ctrl = _controls.find(c => c.field === _dragField);
    if (ctrl?.type === 'slider') {
      const frac = Math.max(0, Math.min(1, (mx - ctrl.trackX) / ctrl.trackW));
      const raw  = ctrl.min + frac * (ctrl.max - ctrl.min);
      GAME_CFG[ctrl.field] = ctrl.decimals === 0 ? Math.round(raw) : parseFloat(raw.toFixed(ctrl.decimals));
      return { changed: true };
    }
  }

  if (!clicked) return { changed: false };

  for (const ctrl of _controls) {
    if (ctrl.type === 'slider') {
      if (_hit(mx, my, ctrl.trackX - 4, ctrl.y, ctrl.trackW + 8, ctrl.h)) {
        _dragField = ctrl.field;
        const frac = Math.max(0, Math.min(1, (mx - ctrl.trackX) / ctrl.trackW));
        const raw  = ctrl.min + frac * (ctrl.max - ctrl.min);
        GAME_CFG[ctrl.field] = ctrl.decimals === 0 ? Math.round(raw) : parseFloat(raw.toFixed(ctrl.decimals));
        return { changed: true };
      }
    }
  }

  return { changed: false };
}

function _hit(mx, my, x, y, w, h) {
  return mx >= x && mx < x + w && my >= y && my < y + h;
}
