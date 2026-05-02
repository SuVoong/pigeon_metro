// estacion_render.js — Vista genérica de andén mirando hacia los carriles.
// Recrea la estética de las estaciones de metro subterráneo:
//   pared de color con franja de acento, andenes a ambos lados, raíles
//   en perspectiva, escaleras al fondo y entrada al túnel.
//
// drawEstacion(ctx, worldZ, config) acepta:
//   config.name        — nombre de la estación (para los rótulos)
//   config.lineColor   — color de acento de la línea (hex)
//   config.wallColor   — color principal de la pared (hex)
//   config.stripeColor — color de la franja horizontal (hex)

import { canvas } from '../../../mecanica/estado.js';

const FOCAL = 400;
const _s    = z => FOCAL / (FOCAL + Math.max(z, 1));

// Colores estructurales que no varían entre estaciones
const FIXED = {
  ceiling:      '#2a2c34',
  ceilingDark:  '#18191f',
  platform:     '#E8E0D0',
  platformDark: '#C8C0B0',
  trackBed:     '#1a1a18',
  rail:         '#8a8c94',
  sleeper:      '#3a3228',
  escFrame:     '#4a4e58',
  escStep:      '#5a5e6a',
  escRail:      '#8a8e9a',
  tunnelArch:   '#0a0b0e',
  signText:     '#ffffff',
  tactile:      '#F5C800',
};

/**
 * Dibuja la escena completa de un andén de metro.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} worldZ  STATE.worldZ — anima scroll de raíles y luces
 * @param {object} config  { name, lineColor, wallColor, stripeColor }
 */
export function drawEstacion(ctx, worldZ = 0, config = {}) {
  const cw = canvas.width;
  const ch = canvas.height;

  const name        = config.name        ?? 'Estación';
  const lineColor   = config.lineColor   ?? '#F39200';
  const wallColor   = config.wallColor   ?? '#F5C800';
  const wallDark    = _darken(wallColor, 0.75);
  const wallBright  = _brighten(wallColor, 1.12);
  const stripeColor = config.stripeColor ?? '#003DA5';
  const stripeDark  = _darken(stripeColor, 0.65);

  // Punto de fuga: ligeramente a la derecha para sensación de andén derecho
  const vpX = cw * 0.52;
  const vpY = ch * 0.44;

  _drawCeiling         (ctx, vpX, vpY, cw, ch);
  _drawFluorescentTubes(ctx, vpX, vpY, cw, ch, worldZ);
  _drawWalls           (ctx, vpX, vpY, cw, ch, wallColor, wallDark, wallBright);
  _drawStripe          (ctx, vpX, vpY, cw, ch, wallColor, stripeColor, stripeDark);
  _drawStationSigns    (ctx, vpX, vpY, cw, ch, wallColor, stripeColor, name);
  _drawPlatforms       (ctx, vpX, vpY, cw, ch);
  _drawTrackBed        (ctx, vpX, vpY, cw, ch);
  _drawRails           (ctx, vpX, vpY, cw, ch, worldZ);
  _drawSleepers        (ctx, vpX, vpY, cw, ch, worldZ);
  _drawTactileStrip    (ctx, vpX, vpY, cw, ch);
  _drawEscalators      (ctx, vpX, vpY, cw, ch, stripeColor);
  _drawTunnelEntrance  (ctx, vpX, vpY, cw, ch, lineColor);
  _drawDepthHaze       (ctx, vpX, vpY, cw, ch);
}

// ─── Utilidades de color ──────────────────────────────────────────────────────

function _hexToRgb(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3
    ? h.split('').map(c => c + c).join('')
    : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function _darken(hex, factor) {
  const [r, g, b] = _hexToRgb(hex);
  return `rgb(${Math.round(r * factor)},${Math.round(g * factor)},${Math.round(b * factor)})`;
}

function _brighten(hex, factor) {
  const [r, g, b] = _hexToRgb(hex);
  return `rgb(${Math.min(255, Math.round(r * factor))},${Math.min(255, Math.round(g * factor))},${Math.min(255, Math.round(b * factor))})`;
}

// ─── Capas internas ───────────────────────────────────────────────────────────

function _drawCeiling(ctx, vpX, vpY, cw, ch) {
  const ceilH = vpY * 1.05;

  const g = ctx.createLinearGradient(0, 0, 0, ceilH);
  g.addColorStop(0,   FIXED.ceilingDark);
  g.addColorStop(0.6, FIXED.ceiling);
  g.addColorStop(1,   '#383a44');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, cw, ceilH);

  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth   = 1;
  for (let i = 0; i < 5; i++) {
    const y = ceilH * (0.25 + i * 0.15);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(cw, y);
    ctx.stroke();
  }
}

function _drawFluorescentTubes(ctx, vpX, vpY, cw, ch, worldZ) {
  const rows = [
    { xFracL: 0.18, xFracR: 0.82, yFrac: 0.10 },
    { xFracL: 0.28, xFracR: 0.72, yFrac: 0.18 },
  ];
  const tubeGap = 140;
  const offset  = ((worldZ * 1.5) % tubeGap + tubeGap) % tubeGap;

  for (const row of rows) {
    const yNear = ch * row.yFrac;

    for (let z = 800; z >= 30; z -= tubeGap) {
      const zOff = z - offset;
      if (zOff <= 0) continue;

      const sc       = _s(zOff);
      const clampedY = Math.max(0, Math.min(vpY, vpY - (vpY - yNear) * sc));
      if (clampedY < 2 || clampedY > vpY) continue;

      const xL      = vpX + (cw * row.xFracL - vpX) * sc;
      const xR      = vpX + (cw * row.xFracR - vpX) * sc;
      const tw      = Math.max(2, (xR - xL) * 0.85);
      const th      = Math.max(1, 5 * sc);
      const centerX = (xL + xR) / 2;
      const alpha   = Math.min(1, sc * 2.0) * 0.95;

      ctx.fillStyle = `rgba(232,240,255,${alpha})`;
      ctx.fillRect(centerX - tw / 2, clampedY - th / 2, tw, th);

      const halo = ctx.createRadialGradient(centerX, clampedY, 0, centerX, clampedY, tw * 1.8);
      halo.addColorStop(0,   `rgba(200,220,255,${alpha * 0.35})`);
      halo.addColorStop(0.5, `rgba(180,210,255,${alpha * 0.10})`);
      halo.addColorStop(1,   'rgba(180,210,255,0)');
      ctx.fillStyle = halo;
      ctx.fillRect(centerX - tw * 2, clampedY - tw * 2, tw * 4, tw * 4);
    }
  }
}

function _drawWalls(ctx, vpX, vpY, cw, ch, wallColor, wallDark, wallBright) {
  const wallTop    = vpY * 0.55;
  const wallBottom = ch * 0.72;

  // Pared izquierda (andén opuesto, vista de frente)
  ctx.beginPath();
  ctx.moveTo(0, wallTop);
  ctx.lineTo(vpX * 0.55, vpY);
  ctx.lineTo(vpX * 0.55, wallBottom);
  ctx.lineTo(0, wallBottom * 1.05);
  ctx.closePath();

  const wg = ctx.createLinearGradient(0, 0, vpX * 0.6, 0);
  wg.addColorStop(0,   wallDark);
  wg.addColorStop(0.45, wallColor);
  wg.addColorStop(1,   wallBright);
  ctx.fillStyle = wg;
  ctx.fill();

  // Pared en primer plano izquierdo
  const fullWg = ctx.createLinearGradient(0, 0, cw * 0.35, 0);
  fullWg.addColorStop(0,   wallDark);
  fullWg.addColorStop(0.5, wallColor);
  fullWg.addColorStop(1,   wallBright);
  ctx.fillStyle = fullWg;
  ctx.fillRect(0, wallTop, cw * 0.38, wallBottom - wallTop);
}

function _drawStripe(ctx, vpX, vpY, cw, ch, wallColor, stripeColor, stripeDark) {
  const wallTop    = vpY * 0.55;
  const wallBottom = ch * 0.72;
  const wallHeight = wallBottom - wallTop;
  const stripeY    = wallTop + wallHeight * 0.38;
  const stripeH    = Math.max(8, wallHeight * 0.18);

  // Franja horizontal en primer plano
  const sg = ctx.createLinearGradient(0, 0, cw * 0.4, 0);
  sg.addColorStop(0,   stripeDark);
  sg.addColorStop(0.4, stripeColor);
  sg.addColorStop(1,   _brighten(stripeColor, 1.15));
  ctx.fillStyle = sg;
  ctx.fillRect(0, stripeY, cw * 0.38, stripeH);

  // Línea fina de separación
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillRect(0, stripeY, cw * 0.38, 2);

  // Franja en la pared del fondo (perspectiva)
  const farStripeY = vpY * 0.82;
  const farStripeH = Math.max(3, stripeH * 0.25);
  const farX0      = vpX * 0.30;
  const farX1      = vpX * 0.68;

  ctx.fillStyle = stripeColor;
  ctx.beginPath();
  ctx.moveTo(farX0, farStripeY);
  ctx.lineTo(farX1, farStripeY);
  ctx.lineTo(farX1, farStripeY + farStripeH);
  ctx.lineTo(farX0, farStripeY + farStripeH);
  ctx.closePath();
  ctx.fill();
}

function _drawStationSigns(ctx, vpX, vpY, cw, ch, wallColor, stripeColor, name) {
  const wallTop    = vpY * 0.55;
  const wallBottom = ch * 0.72;
  const wallHeight = wallBottom - wallTop;
  const stripeY    = wallTop + wallHeight * 0.38;
  const stripeH    = Math.max(8, wallHeight * 0.18);

  // Cartel principal (primer plano)
  const signW    = Math.min(160, cw * 0.22);
  const signH    = stripeH * 0.7;
  const signX    = cw * 0.04;
  const signY    = stripeY + (stripeH - signH) / 2;
  const fontSize = Math.max(9, signH * 0.52);

  ctx.fillStyle = stripeColor;
  ctx.fillRect(signX, signY, signW, signH);
  ctx.fillStyle    = FIXED.signText;
  ctx.font         = `bold ${fontSize}px sans-serif`;
  ctx.textAlign    = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(name, signX + 8, signY + signH / 2);

  // Cartel secundario (más lejano)
  const sign2W    = signW * 0.45;
  const sign2H    = signH * 0.45;
  const sign2X    = cw * 0.21;
  const sign2Y    = stripeY + (stripeH - sign2H) / 2;
  const fontSize2 = Math.max(5, sign2H * 0.52);

  ctx.fillStyle = stripeColor;
  ctx.fillRect(sign2X, sign2Y, sign2W, sign2H);
  ctx.fillStyle = FIXED.signText;
  ctx.font      = `bold ${fontSize2}px sans-serif`;
  ctx.fillText(name, sign2X + 4, sign2Y + sign2H / 2);

  ctx.textAlign    = 'left';
  ctx.textBaseline = 'alphabetic';
}

function _drawPlatforms(ctx, vpX, vpY, cw, ch) {
  // Andén izquierdo (andén opuesto)
  const platformTopL = ch * 0.72;
  const platformBotL = ch * 0.88;

  const pgL = ctx.createLinearGradient(0, platformTopL, 0, platformBotL);
  pgL.addColorStop(0,   FIXED.platform);
  pgL.addColorStop(0.6, FIXED.platformDark);
  pgL.addColorStop(1,   '#A8A090');
  ctx.fillStyle = pgL;
  ctx.fillRect(0, platformTopL, cw * 0.38, platformBotL - platformTopL);

  ctx.fillStyle = '#606060';
  ctx.fillRect(cw * 0.36, platformTopL, cw * 0.02, platformBotL - platformTopL);

  // Andén derecho (donde está el jugador)
  const platformTopR = ch * 0.68;
  const platformBotR = ch;

  const pgR = ctx.createLinearGradient(0, platformTopR, 0, platformBotR);
  pgR.addColorStop(0,   FIXED.platform);
  pgR.addColorStop(0.4, '#D8D0C0');
  pgR.addColorStop(1,   '#B0A898');
  ctx.fillStyle = pgR;
  ctx.fillRect(cw * 0.62, platformTopR, cw * 0.38, platformBotR - platformTopR);

  // Reflexiones especulares del suelo
  for (let i = 0; i < 4; i++) {
    const rx = cw * (0.68 + i * 0.08);
    const rg = ctx.createLinearGradient(rx, platformTopR, rx + 18, platformBotR);
    rg.addColorStop(0,   'rgba(255,255,255,0.18)');
    rg.addColorStop(0.3, 'rgba(255,255,255,0.06)');
    rg.addColorStop(1,   'rgba(255,255,255,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(rx, platformTopR, 18, platformBotR - platformTopR);
  }

  ctx.fillStyle = '#505050';
  ctx.fillRect(cw * 0.60, platformTopR, cw * 0.025, platformBotR - platformTopR);
}

function _drawTrackBed(ctx, vpX, vpY, cw, ch) {
  const trackTop   = vpY * 0.90;
  const trackLeft  = cw  * 0.36;
  const trackRight = cw  * 0.62;

  const tg = ctx.createLinearGradient(0, trackTop, 0, ch);
  tg.addColorStop(0,   '#141412');
  tg.addColorStop(0.3, FIXED.trackBed);
  tg.addColorStop(1,   '#0e0e0c');
  ctx.fillStyle = tg;
  ctx.fillRect(trackLeft, trackTop, trackRight - trackLeft, ch - trackTop);

  ctx.beginPath();
  ctx.moveTo(trackLeft,           trackTop);
  ctx.lineTo(trackRight,          trackTop);
  ctx.lineTo(vpX + cw * 0.04,    vpY * 0.95);
  ctx.lineTo(vpX - cw * 0.04,    vpY * 0.95);
  ctx.closePath();
  ctx.fillStyle = '#12120f';
  ctx.fill();

  ctx.fillStyle = 'rgba(70,65,55,0.6)';
  for (let i = 0; i < 80; i++) {
    const t  = (i * 0.618033) % 1;
    const bx = trackLeft + t * (trackRight - trackLeft);
    const by = trackTop  + ((i * 0.37) % 1) * (ch - trackTop) * 0.9;
    const bs = Math.max(1, 3 * (by - trackTop) / (ch - trackTop));
    ctx.fillRect(bx, by, bs, bs * 0.5);
  }
}

function _drawRails(ctx, vpX, vpY, cw, ch) {
  const trackBottom = ch;
  const trackTop    = vpY * 0.95;

  const rails = [
    { near: cw * 0.41, far: vpX - cw * 0.020 },
    { near: cw * 0.47, far: vpX - cw * 0.005 },
    { near: cw * 0.53, far: vpX + cw * 0.005 },
    { near: cw * 0.59, far: vpX + cw * 0.020 },
  ];

  for (const rail of rails) {
    ctx.save();
    ctx.lineWidth   = 3;
    ctx.strokeStyle = FIXED.rail;
    ctx.beginPath();
    ctx.moveTo(rail.far,  trackTop);
    ctx.lineTo(rail.near, trackBottom);
    ctx.stroke();

    ctx.lineWidth   = 1;
    ctx.strokeStyle = 'rgba(200,205,215,0.55)';
    ctx.beginPath();
    ctx.moveTo(rail.far  - 0.5, trackTop);
    ctx.lineTo(rail.near - 0.5, trackBottom);
    ctx.stroke();
    ctx.restore();
  }
}

function _drawSleepers(ctx, vpX, vpY, cw, ch, worldZ) {
  const sleeperGap  = 50;
  const offset      = ((worldZ * 2.5) % sleeperGap + sleeperGap) % sleeperGap;
  const trackBottom = ch;
  const trackTop    = vpY * 0.95;
  const spanY       = trackBottom - trackTop;
  const trackLeft   = cw * 0.38;
  const trackRight  = cw * 0.62;

  ctx.save();
  for (let z = 700; z >= 0; z -= sleeperGap) {
    const zOff = z - offset;
    if (zOff < 0) continue;

    const sc        = _s(zOff);
    const sy        = trackBottom - spanY * sc * 1.1;
    if (sy > trackBottom + 4) continue;

    const sw        = (trackRight - trackLeft) * sc * 1.1;
    const thickness = Math.max(1, sc * 7);
    const alpha     = Math.min(1, sc * 1.8);
    const cx        = vpX;

    ctx.strokeStyle = `rgba(58,50,40,${alpha})`;
    ctx.lineWidth   = thickness;
    ctx.beginPath();
    ctx.moveTo(cx - sw / 2, sy);
    ctx.lineTo(cx + sw / 2, sy);
    ctx.stroke();

    ctx.strokeStyle = `rgba(80,70,55,${alpha * 0.5})`;
    ctx.lineWidth   = Math.max(1, thickness * 0.3);
    ctx.beginPath();
    ctx.moveTo(cx - sw / 2, sy - thickness * 0.35);
    ctx.lineTo(cx + sw / 2, sy - thickness * 0.35);
    ctx.stroke();
  }
  ctx.restore();
}

function _drawTactileStrip(ctx, vpX, vpY, cw, ch) {
  const platformTopR = ch * 0.68;
  const stripH       = Math.max(6, (ch - platformTopR) * 0.12);
  const stripX       = cw * 0.62;

  ctx.fillStyle = FIXED.tactile;
  ctx.fillRect(stripX, platformTopR, cw * 0.38, stripH);

  ctx.fillStyle = '#C8A000';
  for (let i = 0; i < 24; i++) {
    const dx = stripX + (i + 0.5) * (cw * 0.38 / 24);
    ctx.fillRect(dx - 2, platformTopR + stripH * 0.2, 4, stripH * 0.55);
  }

  ctx.fillStyle = '#88CC00';
  ctx.fillRect(stripX, platformTopR - 2, cw * 0.38, 2);

  // Franja táctil lejana (andén izquierdo)
  const farH = Math.max(3, stripH * 0.3);
  ctx.fillStyle = FIXED.tactile;
  ctx.fillRect(vpX * 0.45, ch * 0.72 - 5, cw * 0.38 * 0.35, farH);
}

function _drawEscalators(ctx, vpX, vpY, cw, ch, stripeColor) {
  const escBaseY = vpY * 1.02;
  const escTopY  = vpY * 0.60;
  const escH     = escBaseY - escTopY;

  // Escalera mecánica izquierda
  const escLx0 = vpX - cw * 0.18;
  const escLx1 = vpX - cw * 0.07;
  const escW   = escLx1 - escLx0;

  ctx.fillStyle = FIXED.escFrame;
  ctx.fillRect(escLx0, escTopY, escW, escH);

  const steps = 10;
  ctx.strokeStyle = FIXED.escStep;
  ctx.lineWidth   = Math.max(1, escH / steps * 0.6);
  for (let i = 0; i <= steps; i++) {
    const t  = i / steps;
    const sy = escTopY + t * escH;
    const sx = escLx0  + t * escW * 0.15;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + escW * 0.88, sy - escH * 0.06);
    ctx.stroke();
  }

  ctx.strokeStyle = FIXED.escRail;
  ctx.lineWidth   = Math.max(2, escH * 0.04);
  ctx.beginPath();
  ctx.moveTo(escLx0 + escW * 0.04, escBaseY);
  ctx.lineTo(escLx1 - escW * 0.04, escTopY + 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(escLx0 + escW * 0.04, escBaseY - escH * 0.1);
  ctx.lineTo(escLx1 - escW * 0.04, escTopY + escH * 0.15);
  ctx.stroke();

  // Escalera fija derecha
  const escRx0 = vpX + cw * 0.07;
  const escRx1 = vpX + cw * 0.18;
  const escRW  = escRx1 - escRx0;

  ctx.fillStyle = '#404450';
  ctx.fillRect(escRx0, escTopY, escRW, escH);

  const stairSteps = 8;
  const stepH      = escH / stairSteps;
  for (let i = 0; i < stairSteps; i++) {
    const sy = escTopY + i * stepH;
    const sx = escRx0 + i * (escRW / stairSteps);
    ctx.fillStyle = '#5a5e6a';
    ctx.fillRect(sx, sy, escRW - i * (escRW / stairSteps), stepH * 0.85);
    ctx.fillStyle = '#3a3e48';
    ctx.fillRect(sx, sy + stepH * 0.85, escRW - i * (escRW / stairSteps), stepH * 0.15);
  }

  // Pasamanos con el color de la línea
  ctx.strokeStyle = stripeColor;
  ctx.lineWidth   = Math.max(2, escH * 0.04);
  ctx.beginPath();
  ctx.moveTo(escRx0 + 4, escBaseY);
  ctx.lineTo(escRx1 - 4, escTopY + 2);
  ctx.stroke();
}

function _drawTunnelEntrance(ctx, vpX, vpY, cw, ch, lineColor) {
  const archCX = vpX + cw * 0.015;
  const archCY = vpY + ch * 0.04;
  const archRX = cw  * 0.085;
  const archRY = ch  * 0.14;

  // Interior del túnel (negro profundo)
  ctx.beginPath();
  ctx.ellipse(archCX, archCY, archRX, archRY, 0, Math.PI, 0);
  ctx.lineTo(archCX + archRX, archCY + archRY * 0.6);
  ctx.lineTo(archCX - archRX, archCY + archRY * 0.6);
  ctx.closePath();
  ctx.fillStyle = FIXED.tunnelArch;
  ctx.fill();

  // Borde de hormigón
  ctx.strokeStyle = '#3a3c42';
  ctx.lineWidth   = Math.max(3, archRX * 0.12);
  ctx.beginPath();
  ctx.ellipse(archCX, archCY, archRX, archRY, 0, Math.PI, 0);
  ctx.stroke();

  // Reflejo de luz del tren que viene (usa el color de la línea)
  const [lr, lg, lb] = _hexToRgb(lineColor);
  const innerGlow = ctx.createRadialGradient(archCX, archCY, 0, archCX, archCY, archRX * 1.1);
  innerGlow.addColorStop(0,   `rgba(${lr},${lg},${lb},0.20)`);
  innerGlow.addColorStop(0.5, `rgba(${lr},${lg},${lb},0.06)`);
  innerGlow.addColorStop(1,   'rgba(0,0,0,0)');
  ctx.fillStyle = innerGlow;
  ctx.beginPath();
  ctx.ellipse(archCX, archCY, archRX, archRY * 0.9, 0, 0, Math.PI * 2);
  ctx.fill();

  // Semáforo de vía (verde = vía libre)
  ctx.fillStyle = '#00dd44';
  ctx.fillRect(archCX - 2, archCY - archRY * 0.85, 4, 4);
  const signalGlow = ctx.createRadialGradient(
    archCX, archCY - archRY * 0.85, 0,
    archCX, archCY - archRY * 0.85, 10,
  );
  signalGlow.addColorStop(0,   'rgba(0,220,60,0.4)');
  signalGlow.addColorStop(1,   'rgba(0,200,40,0)');
  ctx.fillStyle = signalGlow;
  ctx.fillRect(archCX - 10, archCY - archRY * 0.85 - 10, 20, 20);
}

function _drawDepthHaze(ctx, vpX, vpY, cw, ch) {
  const haze = ctx.createRadialGradient(vpX, vpY, 0, vpX, vpY, cw * 0.35);
  haze.addColorStop(0,   'rgba(8,8,14,0.55)');
  haze.addColorStop(0.4, 'rgba(4,4,10,0.20)');
  haze.addColorStop(1,   'rgba(0,0,0,0)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, cw, ch);
}
