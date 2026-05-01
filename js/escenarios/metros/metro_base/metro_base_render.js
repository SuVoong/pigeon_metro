// Funciones de dibujo del túnel y trenes — sin estado de juego, sólo render.
// Coordenadas de mundo: x,y en píxeles relativos al centro del canvas; z = profundidad.

import { canvas, STATE } from '../../../mecanica/estado.js';
import { w2sx, w2sy, perspective } from '../../../mecanica/camara.js';
import { TRAIN_CFG } from '../../../editor/train_config.js';
import * as PM from '../../../editor/preset_manager.js';

// ── Paleta del tren (valores fijos — estética, no configurables por editor) ───
const TRAIN_PAL = {
  roof:        '#CCCCCC',
  sep:         '#DDDDDD',
  door:        '#AAAAAA',
  lightHi:     '#FF3333',
  under:       '#222233',
  wheel:       '#444455',
  glassAlt:    '#1A2233',
  logoDiamond: '#333344',
  logoText:    '#FFFFFF',
  pillar:      '#111111',
  seam:        '#111111',
  ledText:     '#FFAA00',
};

// ── Pixel font 3×5 (A-Z, 0-9, space) ─────────────────────────────────────────
const PIXEL_FONT = {
  ' ': [[0,0,0],[0,0,0],[0,0,0],[0,0,0],[0,0,0]],
  'A': [[0,1,0],[1,0,1],[1,1,1],[1,0,1],[1,0,1]],
  'B': [[1,1,0],[1,0,1],[1,1,0],[1,0,1],[1,1,0]],
  'C': [[0,1,1],[1,0,0],[1,0,0],[1,0,0],[0,1,1]],
  'D': [[1,1,0],[1,0,1],[1,0,1],[1,0,1],[1,1,0]],
  'E': [[1,1,1],[1,0,0],[1,1,0],[1,0,0],[1,1,1]],
  'F': [[1,1,1],[1,0,0],[1,1,0],[1,0,0],[1,0,0]],
  'G': [[0,1,1],[1,0,0],[1,0,1],[1,0,1],[0,1,1]],
  'H': [[1,0,1],[1,0,1],[1,1,1],[1,0,1],[1,0,1]],
  'I': [[1,1,1],[0,1,0],[0,1,0],[0,1,0],[1,1,1]],
  'J': [[0,1,1],[0,0,1],[0,0,1],[1,0,1],[0,1,1]],
  'K': [[1,0,1],[1,1,0],[1,0,0],[1,1,0],[1,0,1]],
  'L': [[1,0,0],[1,0,0],[1,0,0],[1,0,0],[1,1,1]],
  'M': [[1,0,1],[1,1,1],[1,1,1],[1,0,1],[1,0,1]],
  'N': [[1,0,1],[1,1,1],[1,1,1],[1,0,1],[1,0,1]],
  'O': [[0,1,0],[1,0,1],[1,0,1],[1,0,1],[0,1,0]],
  'P': [[1,1,0],[1,0,1],[1,1,0],[1,0,0],[1,0,0]],
  'Q': [[0,1,0],[1,0,1],[1,0,1],[1,1,1],[0,1,1]],
  'R': [[1,1,0],[1,0,1],[1,1,0],[1,0,1],[1,0,1]],
  'S': [[0,1,1],[1,0,0],[0,1,0],[0,0,1],[1,1,0]],
  'T': [[1,1,1],[0,1,0],[0,1,0],[0,1,0],[0,1,0]],
  'U': [[1,0,1],[1,0,1],[1,0,1],[1,0,1],[0,1,1]],
  'V': [[1,0,1],[1,0,1],[1,0,1],[1,0,1],[0,1,0]],
  'W': [[1,0,1],[1,0,1],[1,1,1],[1,1,1],[1,0,1]],
  'X': [[1,0,1],[1,0,1],[0,1,0],[1,0,1],[1,0,1]],
  'Y': [[1,0,1],[1,0,1],[0,1,0],[0,1,0],[0,1,0]],
  'Z': [[1,1,1],[0,0,1],[0,1,0],[1,0,0],[1,1,1]],
  '0': [[0,1,0],[1,0,1],[1,0,1],[1,0,1],[0,1,0]],
  '1': [[0,1,0],[1,1,0],[0,1,0],[0,1,0],[1,1,1]],
  '2': [[1,1,0],[0,0,1],[0,1,0],[1,0,0],[1,1,1]],
  '3': [[1,1,0],[0,0,1],[0,1,0],[0,0,1],[1,1,0]],
  '4': [[1,0,1],[1,0,1],[1,1,1],[0,0,1],[0,0,1]],
  '5': [[1,1,1],[1,0,0],[1,1,0],[0,0,1],[1,1,0]],
  '6': [[0,1,1],[1,0,0],[1,1,0],[1,0,1],[0,1,0]],
  '7': [[1,1,1],[0,0,1],[0,1,0],[0,1,0],[0,1,0]],
  '8': [[0,1,0],[1,0,1],[0,1,0],[1,0,1],[0,1,0]],
  '9': [[0,1,0],[1,0,1],[0,1,1],[0,0,1],[1,1,0]],
};

// ── Estado del display LED ────────────────────────────────────────────────────
let _ledStation   = 'DELICIAS';
let _ledOffset    = 0;
let _ledLastFrame = -1;

export function setLEDStation(name) {
  const next = name.toUpperCase();
  if (next !== _ledStation) {
    _ledStation = next;
    _ledOffset  = 0;
  }
}

// ── Dibujo interno del panel LED ──────────────────────────────────────────────
function _drawLED(ctx, scale, textColor = TRAIN_CFG.ledTextColor) {
  if (STATE.frame !== _ledLastFrame) {
    _ledLastFrame = STATE.frame;
    _ledOffset += 0.5;
    const charSlot = 4;
    const maxOff   = (_ledStation.length + 2) * charSlot;
    if (_ledOffset > maxOff) _ledOffset = 0;
  }

  const text     = _ledStation + '   ';
  const charSlot = 4;
  const ledX0    = 5;
  const ledY0    = 5;
  const ledW     = 38;
  const ledH     = 5;

  ctx.fillStyle = textColor;

  for (let ci = 0; ci < text.length; ci++) {
    const glyph  = PIXEL_FONT[text[ci]] ?? PIXEL_FONT[' '];
    const charX0 = ci * charSlot - Math.floor(_ledOffset);

    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 3; col++) {
        if (!glyph[row][col]) continue;
        const px = charX0 + col;
        if (px < 0 || px >= ledW) continue;
        if (row < 0 || row >= ledH) continue;
        ctx.fillRect(ledX0 + px, ledY0 + row, 1, 1);
      }
    }
  }
}

// ── FUNCIÓN 1: drawTrainFront ─────────────────────────────────────────────────
// Base size scale=1: 48px ancho × 40px alto (sprite art space). cx,cy = centre.
// lineColor = color de acento de la línea activa.
export function drawTrainFront(ctx, cx, cy, scale, lineColor) {
  const s  = scale ?? 1;
  const lc = lineColor ?? TRAIN_CFG.stripeColor;

  const halfW = (TRAIN_CFG.baseWidth  / 2) * s;
  const halfH = (TRAIN_CFG.baseHeight / 2) * s;
  const ox = cx - halfW;
  const oy = cy - halfH;

  // Scale factors: map 48×40 art coords to actual baseWidth×baseHeight
  const scaleX = TRAIN_CFG.baseWidth  / 48;
  const scaleY = TRAIN_CFG.baseHeight / 40;

  const p = (x, y, w, h, col) => {
    ctx.fillStyle = col;
    ctx.fillRect(
      ox + x * scaleX * s,
      oy + y * scaleY * s,
      Math.max(1, w * scaleX * s),
      Math.max(1, h * scaleY * s),
    );
  };

  // ── Techo (rows 0-3) ───────────────────────────────────────────────────────
  p(2,  0, 44, 4, TRAIN_PAL.roof);
  p(0,  2,  2, 2, TRAIN_PAL.roof);
  p(46, 2,  2, 2, TRAIN_PAL.roof);

  // ── Cabina (rows 4-18) ─────────────────────────────────────────────────────
  p(0, 4, 48, 15, TRAIN_CFG.cabColor);

  // ── Panel LED destino (rows 5-9) ──────────────────────────────────────────
  p(4, 5, 40, 5, TRAIN_CFG.ledBgColor);
  p(5, 6, 38, 3, TRAIN_CFG.ledTextColor);

  if (s >= 0.3) {
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(scaleX * s, scaleY * s);
    _drawLED(ctx, s);
    ctx.restore();
  }

  // ── Parabrisas (rows 11-18) ───────────────────────────────────────────────
  p(4,  11, 19, 8, TRAIN_CFG.windowColor);
  p(25, 11, 19, 8, TRAIN_CFG.windowColor);
  p(23, 11,  2, 8, TRAIN_PAL.pillar);

  // ── Logo Metro ────────────────────────────────────────────────────────────
  p(21, 14, 6, 1, TRAIN_PAL.logoDiamond);
  p(20, 15, 8, 2, TRAIN_PAL.logoDiamond);
  p(21, 17, 6, 1, TRAIN_PAL.logoDiamond);
  p(21, 14, 1, 4, TRAIN_PAL.logoText);
  p(25, 14, 1, 4, TRAIN_PAL.logoText);
  p(22, 15, 1, 1, TRAIN_PAL.logoText);
  p(23, 14, 2, 1, TRAIN_PAL.logoText);

  // ── Línea separadora blanca ───────────────────────────────────────────────
  p(0, 19, 48, 1, TRAIN_PAL.sep);

  // ── Paneles blancos laterales (rows 20-27) ────────────────────────────────
  p(0,  20, 48, 8, TRAIN_CFG.bodyColor);
  p(16, 20,  1, 8, TRAIN_PAL.door);
  p(32, 20,  1, 8, TRAIN_PAL.door);

  // ── Luces rojas de emergencia (rows 24-27) ────────────────────────────────
  p(3,  24, 4, 4, TRAIN_CFG.lightColor);
  p(41, 24, 4, 4, TRAIN_CFG.lightColor);
  p(4,  24, 2, 1, TRAIN_PAL.lightHi);
  p(42, 24, 2, 1, TRAIN_PAL.lightHi);

  // ── Franja de color de línea (rows 28-35) ─────────────────────────────────
  p(0, 28, 48, 8, lc);

  // ── Chasis oscuro (rows 36-39) ────────────────────────────────────────────
  p(0,  36, 48, 4, TRAIN_PAL.under);
  p(4,  37,  6, 2, TRAIN_PAL.wheel);
  p(38, 37,  6, 2, TRAIN_PAL.wheel);
}

// ── FUNCIÓN 2: drawTrainSide ──────────────────────────────────────────────────
export function drawTrainSide(ctx, x, y, w, h, lineColor) {
  const lc = lineColor ?? TRAIN_CFG.stripeColor;
  if (w < 1 || h < 1) return;

  const roofH   = Math.max(1, Math.floor(h * 0.10));
  const bodyH   = Math.max(1, Math.floor(h * 0.50));
  const stripeH = Math.max(1, Math.floor(h * 0.20));
  const underH  = h - roofH - bodyH - stripeH;

  let curY = Math.round(y);

  ctx.fillStyle = TRAIN_PAL.roof;
  ctx.fillRect(Math.round(x), curY, Math.round(w), roofH);
  curY += roofH;

  ctx.fillStyle = TRAIN_CFG.bodyColor;
  ctx.fillRect(Math.round(x), curY, Math.round(w), bodyH);

  if (w >= 12 && bodyH >= 4) {
    const winW   = Math.max(4, Math.min(8, Math.floor(w / 6)));
    const winH   = Math.max(2, Math.floor(bodyH * 0.58));
    const winY   = curY + Math.floor(bodyH * 0.20);
    const nWins  = Math.max(1, Math.floor(w / (winW + 4)));
    const gap    = Math.max(2, Math.floor((w - nWins * winW) / (nWins + 1)));

    for (let i = 0; i < nWins; i++) {
      const wx = Math.round(x + gap + i * (winW + gap));
      ctx.fillStyle = TRAIN_PAL.sep;
      ctx.fillRect(wx - 1, winY - 1, winW + 2, winH + 2);
      ctx.fillStyle = TRAIN_PAL.glassAlt;
      ctx.fillRect(wx, winY, winW, winH);
    }
  }
  curY += bodyH;

  ctx.fillStyle = lc;
  ctx.fillRect(Math.round(x), curY, Math.round(w), stripeH);
  curY += stripeH;

  ctx.fillStyle = TRAIN_PAL.under;
  ctx.fillRect(Math.round(x), curY, Math.round(w), Math.max(1, underH));

  if (underH >= 2 && w >= 8) {
    const wheelW = Math.max(2, Math.floor(w * 0.10));
    const wheelH = Math.max(1, Math.floor(underH * 0.55));
    const wheelY = curY + Math.floor(underH * 0.22);
    ctx.fillStyle = TRAIN_PAL.wheel;
    ctx.fillRect(Math.round(x + w * 0.14), wheelY, wheelW, wheelH);
    ctx.fillRect(Math.round(x + w * 0.74), wheelY, wheelW, wheelH);
  }
}

// ── FUNCIÓN 3: drawTrainPerspective ──────────────────────────────────────────
export function drawTrainPerspective(ctx, cx, cy, scale, lineColor) {
  const s      = scale ?? 1;
  const totalW = TRAIN_CFG.baseWidth  * s;
  const totalH = TRAIN_CFG.baseHeight * s;
  const left   = cx - totalW / 2;
  const top    = cy - totalH / 2;
  const seamX  = Math.round(left + totalW * 0.55);

  const frontCx = Math.round(left + totalW * 0.275);
  drawTrainFront(ctx, frontCx, cy, s, lineColor);

  const sideX = seamX + 2;
  const sideW = Math.max(1, Math.round(left + totalW) - sideX);
  drawTrainSide(ctx, sideX, top, sideW, totalH, lineColor);

  ctx.fillStyle = TRAIN_PAL.seam;
  ctx.fillRect(seamX, top, 2, totalH);
}

// ── Helpers de sprite de preset ───────────────────────────────────────────────

/** Devuelve el sprite del preset activo para la vía indicada, o null si no hay. */
function _getSpriteForSide(side) {
  const trenes = PM.getActive()?.trenes;
  if (!trenes?.sprites?.length) return null;
  const id = side === 'left' ? trenes.leftLaneSprite : trenes.rightLaneSprite;
  return trenes.sprites.find(s => s.id === id) ?? trenes.sprites[0] ?? null;
}

/**
 * Dibuja el tren usando el pixelData del sprite del preset.
 * El ctx ya está trasladado al centro del tren y escalado por drawScale.
 * El espacio de arte es sprite.pixelData.width × sprite.pixelData.height.
 */
function _drawFromPixelData(ctx, sprite) {
  const { pixels, width, height } = sprite.pixelData;
  const c = sprite.colors;
  const PALETTE = [ null, c.body, c.window, c.cab, c.stripe, c.ledBg ];
  const ox = -(width  / 2);
  const oy = -(height / 2);

  // Renderizar píxel a píxel agrupando runs del mismo color por fila
  for (let y = 0; y < height; y++) {
    const row = pixels[y];
    let x = 0;
    while (x < width) {
      const v = row[x];
      if (!v) { x++; continue; }
      const col = PALETTE[v];
      if (!col) { x++; continue; }
      // Extender el run horizontal del mismo color
      let run = 1;
      while (x + run < width && row[x + run] === v) run++;
      ctx.fillStyle = col;
      ctx.fillRect(ox + x, oy + y, run, 1);
      x += run;
    }
  }

  // Texto LED scrolling sobre el área ledBg
  _drawLED(ctx, 1, c.ledText);
}

// ── drawTrack ─────────────────────────────────────────────────────────────────
export function drawTrack(ctx, track, config) {
  const sorted = track.slice().sort((a, b) => b.z - a.z);

  for (const train of sorted) {
    if (train.z < -50 || train.z > 900) continue;

    const sprite   = _getSpriteForSide(train.side);
    const vPos     = sprite?.verticalPos     ?? TRAIN_CFG.verticalPos;
    const scaleMul = sprite?.scaleMultiplier ?? TRAIN_CFG.scaleMultiplier;
    const yShift   = (vPos - 0.5) * canvas.height;

    const s  = perspective(train.z);
    const sx = w2sx(train.x * s);
    const sy = w2sy(train.y * s) + yShift;

    ctx.save();
    ctx.translate(sx, sy);
    ctx.scale(s * scaleMul, s * scaleMul);

    if (train.z < 100) {
      // Vista 3/4 (tren muy cercano): sigue usando vectores
      drawTrainPerspective(ctx, 0, 0, 1, config.trainColor ?? TRAIN_CFG.stripeColor);
    } else if (sprite?.pixelData?.pixels) {
      _drawFromPixelData(ctx, sprite);
    } else {
      drawTrainFront(ctx, 0, 0, 1, config.trainColor ?? TRAIN_CFG.stripeColor);
    }

    ctx.restore();
  }
}

// ── drawStationSign ───────────────────────────────────────────────────────────
export function drawStationSign(ctx, stationName, lineColor, options = {}) {
  const cw    = canvas.width;
  const sy    = options.y ?? 36;
  const signW = Math.min(280, Math.max(160, cw * 0.35));
  const signH = 30;
  const sx    = Math.round(cw / 2 - signW / 2);

  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(sx + 2, sy + 2, signW, signH);

  ctx.fillStyle = '#0a0a14';
  ctx.fillRect(sx, sy, signW, signH);

  ctx.fillStyle = lineColor;
  ctx.fillRect(sx, sy, 5, signH);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(stationName, sx + signW / 2, sy + signH / 2 + 1);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}
