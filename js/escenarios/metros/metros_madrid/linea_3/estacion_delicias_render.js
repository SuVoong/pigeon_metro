// estacion_delicias_render.js — Vista de andén mirando hacia los carriles.
// Recrea la estética real de Delicias (Línea 3, Madrid):
//   pared amarilla con franja azul, andenes a ambos lados, raíles en perspectiva,
//   escaleras mecánicas al fondo y entrada al túnel.

import { canvas } from '../../../../mecanica/estado.js';

const FOCAL = 400;
const _s    = z => FOCAL / (FOCAL + Math.max(z, 1));

// Paleta Delicias
const C = {
  wall:         '#F5C800',   // amarillo institucional Línea 3
  wallDark:     '#C9A000',
  stripe:       '#003DA5',   // franja azul
  stripeLight:  '#0055CC',
  ceiling:      '#2a2c34',
  ceilingDark:  '#18191f',
  platform:     '#E8E0D0',   // suelo del andén (mármol claro)
  platformDark: '#C8C0B0',
  tactile:      '#F5C800',   // franja táctil amarilla
  trackBed:     '#1a1a18',   // balasto/área de vías
  rail:         '#8a8c94',
  sleeper:      '#3a3228',
  escFrame:     '#4a4e58',
  escStep:      '#5a5e6a',
  escRail:      '#8a8e9a',
  tunnelArch:   '#0a0b0e',
  sign:         '#003DA5',
  signText:     '#ffffff',
  neon:         '#e8f0ff',
  neonGlow:     'rgba(200,220,255,0.15)',
};

/**
 * Dibuja la escena completa de la estación Delicias.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} worldZ  STATE.worldZ — para animar scroll de raíles/luces
 */
export function drawEstacionDelicias(ctx, worldZ = 0) {
  const cw  = canvas.width;
  const ch  = canvas.height;

  // Punto de fuga: ligeramente a la derecha del centro (perspectiva del andén derecho)
  const vpX = cw * 0.52;
  const vpY = ch * 0.44;

  _drawCeiling      (ctx, vpX, vpY, cw, ch);
  _drawFluorescentTubes(ctx, vpX, vpY, cw, ch, worldZ);
  _drawWalls        (ctx, vpX, vpY, cw, ch);
  _drawStripeBlue   (ctx, vpX, vpY, cw, ch);
  _drawStationSigns (ctx, vpX, vpY, cw, ch);
  _drawPlatforms    (ctx, vpX, vpY, cw, ch);
  _drawTrackBed     (ctx, vpX, vpY, cw, ch);
  _drawRails        (ctx, vpX, vpY, cw, ch, worldZ);
  _drawSleepers     (ctx, vpX, vpY, cw, ch, worldZ);
  _drawTactileStrip (ctx, vpX, vpY, cw, ch);
  _drawEscalators   (ctx, vpX, vpY, cw, ch);
  _drawTunnelEntrance(ctx, vpX, vpY, cw, ch);
  _drawDepthHaze    (ctx, vpX, vpY, cw, ch);
}

// ─────────────────────────────────────────────────────────────────────────────

function _drawCeiling(ctx, vpX, vpY, cw, ch) {
  // El techo ocupa el tercio superior — oscuro con paneles metálicos
  const ceilH = vpY * 1.05;

  const g = ctx.createLinearGradient(0, 0, 0, ceilH);
  g.addColorStop(0,   C.ceilingDark);
  g.addColorStop(0.6, C.ceiling);
  g.addColorStop(1,   '#383a44');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, cw, ceilH);

  // Paneles del techo (juntas horizontales que convergen al VP)
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
  // Dos filas de tubos fluorescentes que convergen al VP
  const rows = [
    { xFracL: 0.18, xFracR: 0.82, yFrac: 0.10 },
    { xFracL: 0.28, xFracR: 0.72, yFrac: 0.18 },
  ];

  const tubeGap    = 140;
  const offset     = ((worldZ * 1.5) % tubeGap + tubeGap) % tubeGap;

  for (const row of rows) {
    const yNear = ch * row.yFrac;
    const yFar  = vpY * 0.55;

    for (let z = 800; z >= 30; z -= tubeGap) {
      const zOff = z - offset;
      if (zOff <= 0) continue;

      const sc   = _s(zOff);
      const yPos = vpY - (vpY - yNear) * sc + (yFar - vpY) * (1 - sc);
      const clampedY = Math.max(0, Math.min(vpY, vpY - (vpY - yNear) * sc));

      // Interpolación de posición X izquierda y derecha
      const xL = vpX + (cw * row.xFracL - vpX) * sc;
      const xR = vpX + (cw * row.xFracR - vpX) * sc;
      const tw = Math.max(2, (xR - xL) * 0.85);
      const th = Math.max(1, 5 * sc);
      const tx = vpX + (xL + (xR - xL) * 0.5 - vpX) * sc - tw / 2;
      // simplified: place tube centered between xL and xR
      const centerX = (xL + xR) / 2;
      const alpha   = Math.min(1, sc * 2.0) * 0.95;

      if (clampedY < 2 || clampedY > vpY) continue;

      // Tubo fluorescente (rectángulo brillante)
      ctx.fillStyle = `rgba(232,240,255,${alpha})`;
      ctx.fillRect(centerX - tw / 2, clampedY - th / 2, tw, th);

      // Halo difuso
      const halo = ctx.createRadialGradient(centerX, clampedY, 0, centerX, clampedY, tw * 1.8);
      halo.addColorStop(0,   `rgba(200,220,255,${alpha * 0.35})`);
      halo.addColorStop(0.5, `rgba(180,210,255,${alpha * 0.10})`);
      halo.addColorStop(1,   'rgba(180,210,255,0)');
      ctx.fillStyle = halo;
      ctx.fillRect(centerX - tw * 2, clampedY - tw * 2, tw * 4, tw * 4);
    }
  }
}

function _drawWalls(ctx, vpX, vpY, cw, ch) {
  // Pared izquierda: gran superficie amarilla (andén opuesto)
  // En la imagen, la pared izquierda es el andén con pared amarilla
  const wallTop    = vpY * 0.55;
  const wallBottom = ch * 0.72;

  // ── Pared izquierda ──────────────────────────────────────────────────────
  ctx.beginPath();
  ctx.moveTo(0, wallTop);
  ctx.lineTo(vpX * 0.55, vpY);         // esquina superior derecha (fuga)
  ctx.lineTo(vpX * 0.55, wallBottom);  // baja por el andén opuesto
  ctx.lineTo(0, wallBottom * 1.05);
  ctx.closePath();

  const wg = ctx.createLinearGradient(0, 0, vpX * 0.6, 0);
  wg.addColorStop(0,    C.wallDark);
  wg.addColorStop(0.45, C.wall);
  wg.addColorStop(1,    '#FFE030');
  ctx.fillStyle = wg;
  ctx.fill();

  // Pared continua izquierda (zona que ve el jugador en primer plano)
  const leftWallX = cw * 0.01;
  ctx.fillStyle = C.wall;
  const fullWg = ctx.createLinearGradient(0, 0, cw * 0.35, 0);
  fullWg.addColorStop(0,   C.wallDark);
  fullWg.addColorStop(0.5, C.wall);
  fullWg.addColorStop(1,   '#FFE030');
  ctx.fillStyle = fullWg;
  ctx.fillRect(0, wallTop, cw * 0.38, wallBottom - wallTop);
}

function _drawStripeBlue(ctx, vpX, vpY, cw, ch) {
  // Franja azul horizontal a ~2/3 de la altura de la pared
  const wallTop    = vpY * 0.55;
  const wallBottom = ch * 0.72;
  const wallHeight = wallBottom - wallTop;

  // Franja en primer plano (izquierda)
  const stripeY = wallTop + wallHeight * 0.38;
  const stripeH = Math.max(8, wallHeight * 0.18);

  const sg = ctx.createLinearGradient(0, 0, cw * 0.4, 0);
  sg.addColorStop(0,   '#002880');
  sg.addColorStop(0.4, C.stripe);
  sg.addColorStop(1,   C.stripeLight);
  ctx.fillStyle = sg;
  ctx.fillRect(0, stripeY, cw * 0.38, stripeH);

  // Línea fina blanca encima de la franja (separación azul/amarillo)
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillRect(0, stripeY, cw * 0.38, 2);

  // Franja en la pared del fondo (perspectiva, más pequeña)
  const farStripeY = vpY * 0.82;
  const farStripeH = Math.max(3, stripeH * 0.25);
  const farX0      = vpX * 0.30;
  const farX1      = vpX * 0.68;

  ctx.fillStyle = C.stripe;
  ctx.beginPath();
  ctx.moveTo(farX0, farStripeY);
  ctx.lineTo(farX1, farStripeY);
  ctx.lineTo(farX1, farStripeY + farStripeH);
  ctx.lineTo(farX0, farStripeY + farStripeH);
  ctx.closePath();
  ctx.fill();
}

function _drawStationSigns(ctx, vpX, vpY, cw, ch) {
  const wallTop    = vpY * 0.55;
  const wallBottom = ch * 0.72;
  const wallHeight = wallBottom - wallTop;
  const stripeY    = wallTop + wallHeight * 0.38;
  const stripeH    = Math.max(8, wallHeight * 0.18);

  // Cartel "Delicias" en la franja azul (primer plano)
  const signW = Math.min(160, cw * 0.22);
  const signH = stripeH * 0.7;
  const signX = cw * 0.04;
  const signY = stripeY + (stripeH - signH) / 2;

  ctx.fillStyle = C.sign;
  ctx.fillRect(signX, signY, signW, signH);

  ctx.fillStyle = C.signText;
  const fontSize = Math.max(9, signH * 0.52);
  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.textAlign    = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('Delicias', signX + 8, signY + signH / 2);

  // Segundo cartel más pequeño (a la derecha, lejano)
  const sign2W = signW * 0.45;
  const sign2H = signH * 0.45;
  const sign2X = cw * 0.21;
  const sign2Y = stripeY + (stripeH - sign2H) / 2;

  ctx.fillStyle = C.sign;
  ctx.fillRect(sign2X, sign2Y, sign2W, sign2H);

  ctx.fillStyle = C.signText;
  const fontSize2 = Math.max(5, sign2H * 0.52);
  ctx.font = `bold ${fontSize2}px sans-serif`;
  ctx.fillText('Delicias', sign2X + 4, sign2Y + sign2H / 2);

  ctx.textAlign    = 'left';
  ctx.textBaseline = 'alphabetic';
}

function _drawPlatforms(ctx, vpX, vpY, cw, ch) {
  // Andén izquierdo (pared amarilla — en la imagen el andén opuesto)
  // En perspectiva: superficie plana del andén visible en primer plano izquierdo
  const platformTopL  = ch * 0.72;
  const platformBotL  = ch * 0.88;

  const pgL = ctx.createLinearGradient(0, platformTopL, 0, platformBotL);
  pgL.addColorStop(0,   C.platform);
  pgL.addColorStop(0.6, C.platformDark);
  pgL.addColorStop(1,   '#A8A090');
  ctx.fillStyle = pgL;
  ctx.fillRect(0, platformTopL, cw * 0.38, platformBotL - platformTopL);

  // Borde del andén izquierdo (canto gris oscuro mirando a las vías)
  ctx.fillStyle = '#606060';
  ctx.fillRect(cw * 0.36, platformTopL, cw * 0.02, platformBotL - platformTopL);

  // Andén derecho (donde está el jugador): suelo reflectante
  const platformTopR = ch * 0.68;
  const platformBotR = ch;

  const pgR = ctx.createLinearGradient(0, platformTopR, 0, platformBotR);
  pgR.addColorStop(0,   C.platform);
  pgR.addColorStop(0.4, '#D8D0C0');
  pgR.addColorStop(1,   '#B0A898');
  ctx.fillStyle = pgR;
  ctx.fillRect(cw * 0.62, platformTopR, cw * 0.38, platformBotR - platformTopR);

  // Reflexión especular del suelo derecho (brillo de azulejos)
  for (let i = 0; i < 4; i++) {
    const rx = cw * (0.68 + i * 0.08);
    const rg = ctx.createLinearGradient(rx, platformTopR, rx + 18, platformBotR);
    rg.addColorStop(0,   'rgba(255,255,255,0.18)');
    rg.addColorStop(0.3, 'rgba(255,255,255,0.06)');
    rg.addColorStop(1,   'rgba(255,255,255,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(rx, platformTopR, 18, platformBotR - platformTopR);
  }

  // Canto del andén derecho (borde mirando a las vías)
  ctx.fillStyle = '#505050';
  ctx.fillRect(cw * 0.60, platformTopR, cw * 0.025, platformBotR - platformTopR);
}

function _drawTrackBed(ctx, vpX, vpY, cw, ch) {
  // Área de vías: balasto oscuro entre los dos andenes
  const trackTop    = vpY * 0.90;
  const trackBottom = ch;
  const trackLeft   = cw * 0.36;
  const trackRight  = cw * 0.62;

  const tg = ctx.createLinearGradient(0, trackTop, 0, trackBottom);
  tg.addColorStop(0,   '#141412');
  tg.addColorStop(0.3, C.trackBed);
  tg.addColorStop(1,   '#0e0e0c');
  ctx.fillStyle = tg;
  ctx.fillRect(trackLeft, trackTop, trackRight - trackLeft, trackBottom - trackTop);

  // El área de vías también se extiende hacia el punto de fuga
  ctx.beginPath();
  ctx.moveTo(trackLeft,  trackTop);
  ctx.lineTo(trackRight, trackTop);
  ctx.lineTo(vpX + cw * 0.04, vpY * 0.95);
  ctx.lineTo(vpX - cw * 0.04, vpY * 0.95);
  ctx.closePath();
  ctx.fillStyle = '#12120f';
  ctx.fill();

  // Balasto (puntos de grava)
  ctx.fillStyle = 'rgba(70,65,55,0.6)';
  for (let i = 0; i < 80; i++) {
    const t  = (i * 0.618033) % 1;
    const bx = trackLeft + t * (trackRight - trackLeft);
    const by = trackTop  + ((i * 0.37) % 1) * (trackBottom - trackTop) * 0.9;
    const bs = Math.max(1, 3 * (by - trackTop) / (trackBottom - trackTop));
    ctx.fillRect(bx, by, bs, bs * 0.5);
  }
}

function _drawRails(ctx, vpX, vpY, cw, ch, worldZ) {
  // Dos carriles que convergen al punto de fuga
  const trackBottom = ch;
  const trackTop    = vpY * 0.95;

  // Separación de raíles en primer plano
  const railOffsets = [
    { near: cw * 0.41, far: vpX - cw * 0.02 },
    { near: cw * 0.47, far: vpX - cw * 0.005 },
    { near: cw * 0.53, far: vpX + cw * 0.005 },
    { near: cw * 0.59, far: vpX + cw * 0.02 },
  ];

  for (const rail of railOffsets) {
    ctx.save();
    ctx.lineWidth = 3;
    ctx.strokeStyle = C.rail;
    ctx.beginPath();
    ctx.moveTo(rail.far,  trackTop);
    ctx.lineTo(rail.near, trackBottom);
    ctx.stroke();

    // Brillo superior del raíl
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
  const sleeperGap = 50;
  const offset     = ((worldZ * 2.5) % sleeperGap + sleeperGap) % sleeperGap;
  const trackBottom = ch;
  const trackTop    = vpY * 0.95;
  const spanY       = trackBottom - trackTop;
  const trackLeft   = cw * 0.38;
  const trackRight  = cw * 0.62;

  ctx.save();
  for (let z = 700; z >= 0; z -= sleeperGap) {
    const zOff = z - offset;
    if (zOff < 0) continue;

    const sc   = _s(zOff);
    const sy   = trackBottom - spanY * sc * 1.1;
    if (sy > trackBottom + 4) continue;

    const sw        = (trackRight - trackLeft) * sc * 1.1;
    const thickness = Math.max(1, sc * 7);
    const alpha     = Math.min(1, sc * 1.8);
    const cx2       = vpX;

    ctx.strokeStyle = `rgba(58,50,40,${alpha})`;
    ctx.lineWidth   = thickness;
    ctx.beginPath();
    ctx.moveTo(cx2 - sw / 2, sy);
    ctx.lineTo(cx2 + sw / 2, sy);
    ctx.stroke();

    ctx.strokeStyle = `rgba(80,70,55,${alpha * 0.5})`;
    ctx.lineWidth   = Math.max(1, thickness * 0.3);
    ctx.beginPath();
    ctx.moveTo(cx2 - sw / 2, sy - thickness * 0.35);
    ctx.lineTo(cx2 + sw / 2, sy - thickness * 0.35);
    ctx.stroke();
  }
  ctx.restore();
}

function _drawTactileStrip(ctx, vpX, vpY, cw, ch) {
  // Franja táctil amarilla en el borde del andén derecho (primer plano)
  const platformTopR = ch * 0.68;
  const stripY       = platformTopR;
  const stripH       = Math.max(6, (ch - platformTopR) * 0.12);
  const stripX       = cw * 0.62;

  ctx.fillStyle = C.tactile;
  ctx.fillRect(stripX, stripY, cw * 0.38, stripH);

  // Puntos de relieve de la franja táctil
  ctx.fillStyle = '#C8A000';
  for (let i = 0; i < 24; i++) {
    const dx = stripX + (i + 0.5) * (cw * 0.38 / 24);
    ctx.fillRect(dx - 2, stripY + stripH * 0.2, 4, stripH * 0.55);
  }

  // Línea de separación verde-amarillo (norma de seguridad)
  ctx.fillStyle = '#88CC00';
  ctx.fillRect(stripX, stripY - 2, cw * 0.38, 2);

  // Franja táctil lejana (andén izquierdo, en perspectiva)
  const farTactileY = ch * 0.72 - 5;
  const farTactileH = Math.max(3, stripH * 0.3);
  const farTactileX = vpX * 0.45;
  const farTactileW = cw * 0.38 * 0.35;

  ctx.fillStyle = C.tactile;
  ctx.fillRect(farTactileX, farTactileY, farTactileW, farTactileH);
}

function _drawEscalators(ctx, vpX, vpY, cw, ch) {
  // Escaleras mecánicas y escaleras fijas al fondo, a ambos lados del corredor
  const escBaseY = vpY * 1.02;
  const escTopY  = vpY * 0.60;

  // ── Escalera mecánica izquierda ──────────────────────────────────────────
  const escLx0 = vpX - cw * 0.18;
  const escLx1 = vpX - cw * 0.07;
  const escW   = escLx1 - escLx0;
  const escH   = escBaseY - escTopY;

  // Marco
  ctx.fillStyle = C.escFrame;
  ctx.fillRect(escLx0, escTopY, escW, escH);

  // Peldaños (líneas paralelas diagonales)
  const steps = 10;
  ctx.strokeStyle = C.escStep;
  ctx.lineWidth   = Math.max(1, escH / steps * 0.6);
  for (let i = 0; i <= steps; i++) {
    const t  = i / steps;
    const sy = escTopY + t * escH;
    const sx = escLx0  + t * escW * 0.15;
    ctx.beginPath();
    ctx.moveTo(sx,        sy);
    ctx.lineTo(sx + escW * 0.88, sy - escH * 0.06);
    ctx.stroke();
  }

  // Pasamanos
  ctx.strokeStyle = C.escRail;
  ctx.lineWidth   = Math.max(2, escH * 0.04);
  ctx.beginPath();
  ctx.moveTo(escLx0 + escW * 0.04, escBaseY);
  ctx.lineTo(escLx1 - escW * 0.04, escTopY + 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(escLx0 + escW * 0.04, escBaseY - escH * 0.1);
  ctx.lineTo(escLx1 - escW * 0.04, escTopY + escH * 0.15);
  ctx.stroke();

  // ── Escalera fija derecha ────────────────────────────────────────────────
  const escRx0 = vpX + cw * 0.07;
  const escRx1 = vpX + cw * 0.18;
  const escRW  = escRx1 - escRx0;

  ctx.fillStyle = '#404450';
  ctx.fillRect(escRx0, escTopY, escRW, escH);

  // Peldaños horizontales de escalera fija
  const stairSteps = 8;
  const stepH = escH / stairSteps;
  for (let i = 0; i < stairSteps; i++) {
    const sy = escTopY + i * stepH;
    const sx = escRx0 + i * (escRW / stairSteps);
    ctx.fillStyle = '#5a5e6a';
    ctx.fillRect(sx, sy, escRW - i * (escRW / stairSteps), stepH * 0.85);
    ctx.fillStyle = '#3a3e48';
    ctx.fillRect(sx, sy + stepH * 0.85, escRW - i * (escRW / stairSteps), stepH * 0.15);
  }

  // Pasamanos escalera fija
  ctx.strokeStyle = C.stripe;
  ctx.lineWidth   = Math.max(2, escH * 0.04);
  ctx.beginPath();
  ctx.moveTo(escRx0 + 4, escBaseY);
  ctx.lineTo(escRx1 - 4, escTopY + 2);
  ctx.stroke();
}

function _drawTunnelEntrance(ctx, vpX, vpY, cw, ch) {
  // Arco de entrada al túnel (donde desaparece el tren)
  // Se sitúa un poco a la derecha del VP para dar sensación de continuación de vía
  const archCX = vpX + cw * 0.015;
  const archCY = vpY + ch * 0.04;
  const archRX = cw * 0.085;
  const archRY = ch * 0.14;

  // Interior del túnel (negro profundo)
  ctx.beginPath();
  ctx.ellipse(archCX, archCY, archRX, archRY, 0, Math.PI, 0);
  ctx.lineTo(archCX + archRX, archCY + archRY * 0.6);
  ctx.lineTo(archCX - archRX, archCY + archRY * 0.6);
  ctx.closePath();
  ctx.fillStyle = C.tunnelArch;
  ctx.fill();

  // Borde del arco (jamba de hormigón gris)
  ctx.strokeStyle = '#3a3c42';
  ctx.lineWidth   = Math.max(3, archRX * 0.12);
  ctx.beginPath();
  ctx.ellipse(archCX, archCY, archRX, archRY, 0, Math.PI, 0);
  ctx.stroke();

  // Reflejo lejano de luz dentro del túnel (luz naranja del tren que viene)
  const innerGlow = ctx.createRadialGradient(archCX, archCY, 0, archCX, archCY, archRX * 1.1);
  innerGlow.addColorStop(0,   'rgba(255,140,20,0.18)');
  innerGlow.addColorStop(0.5, 'rgba(255,100,10,0.06)');
  innerGlow.addColorStop(1,   'rgba(0,0,0,0)');
  ctx.fillStyle = innerGlow;
  ctx.beginPath();
  ctx.ellipse(archCX, archCY, archRX, archRY * 0.9, 0, 0, Math.PI * 2);
  ctx.fill();

  // Luz verde de semáforo de vía (pequeño punto en la parte superior del arco)
  ctx.fillStyle = '#00dd44';
  ctx.fillRect(archCX - 2, archCY - archRY * 0.85, 4, 4);
  const signalGlow = ctx.createRadialGradient(archCX, archCY - archRY * 0.85, 0, archCX, archCY - archRY * 0.85, 10);
  signalGlow.addColorStop(0,   'rgba(0,220,60,0.4)');
  signalGlow.addColorStop(1,   'rgba(0,200,40,0)');
  ctx.fillStyle = signalGlow;
  ctx.fillRect(archCX - 10, archCY - archRY * 0.85 - 10, 20, 20);
}

function _drawDepthHaze(ctx, vpX, vpY, cw, ch) {
  // Niebla suave centrada en el punto de fuga (da profundidad y une capas)
  const haze = ctx.createRadialGradient(vpX, vpY, 0, vpX, vpY, cw * 0.35);
  haze.addColorStop(0,   'rgba(8,8,14,0.55)');
  haze.addColorStop(0.4, 'rgba(4,4,10,0.20)');
  haze.addColorStop(1,   'rgba(0,0,0,0)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, cw, ch);
}
