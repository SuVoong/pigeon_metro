// tunel.js — Diseño fotorrealista del túnel de metro.
// Basado en la estética real de los túneles de Metro de Madrid:
// arco circular de hormigón, raíles con balasto, conductos laterales
// y paneles de luz empotrados en las paredes.
//
// Exporta drawTunel(ctx, config, worldZ) para uso por MetroBase.

import { canvas, STATE } from '../../../mecanica/estado.js';
import { ENV_CFG }       from '../../../editor/env_config.js';

const FOCAL       = 400;
const _persp      = z  => FOCAL / (FOCAL + Math.max(z, 1));
const _vpX        = () => canvas.width  / 2;
const _vpY        = () => canvas.height * (ENV_CFG?.vanishingPointY ?? 0.47);

// Centro del arco (ligeramente por debajo del punto de fuga para que
// el suelo quede visible). El arco es semicircular por encima de este punto.
const _archCY     = () => _vpY() + canvas.height * 0.20;
// Radio máximo del arco: ocupa casi toda la pantalla en el primer plano
const _maxR       = () => canvas.height * 0.70;

// ─────────────────────────────────────────────────────────────────────────────
// ENTRY POINT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Dibuja el túnel completo de Metro (reemplaza el drawTunnel rectangular).
 * @param {CanvasRenderingContext2D} ctx
 * @param {object}  config   config de MetroBase/Linea3 (bgColor, lightColor…)
 * @param {number}  worldZ   STATE.worldZ para animar el scroll
 */
export function drawTunel(ctx, config = {}, worldZ = STATE.worldZ) {
  const cw    = canvas.width;
  const ch    = canvas.height;
  const vpX   = _vpX();
  const vpY   = _vpY();
  const archCY = _archCY();
  const maxR  = _maxR();

  // 1 ── Fondo negro profundo ────────────────────────────────────────────────
  _drawBackground(ctx, vpX, vpY, cw, ch, config);

  // 2 ── Relleno de las paredes (hormigón gris) ──────────────────────────────
  _drawWallFills(ctx, vpX, vpY, archCY, maxR, cw, ch);

  // 3 ── Anillos del arco en perspectiva ────────────────────────────────────
  _drawArchRings(ctx, vpX, archCY, maxR, cw, ch, worldZ);

  // 4 ── Juntas de los paneles de hormigón (horizontal + vertical) ──────────
  _drawPanelSeams(ctx, vpX, vpY, archCY, maxR, cw, ch, worldZ);

  // 5 ── Suelo con balasto ───────────────────────────────────────────────────
  _drawFloor(ctx, vpX, archCY, cw, ch);

  // 6 ── Raíles con durmientes ───────────────────────────────────────────────
  _drawRails(ctx, vpX, archCY, cw, ch, worldZ);

  // 7 ── Conductos/cables en las paredes ────────────────────────────────────
  _drawConduits(ctx, vpX, vpY, archCY, maxR, cw, ch, worldZ);

  // 8 ── Paneles de luz laterales ────────────────────────────────────────────
  _drawWallLights(ctx, vpX, vpY, archCY, maxR, cw, ch, worldZ, config);

  // 9 ── Niebla de profundidad ───────────────────────────────────────────────
  _drawDepthFog(ctx, vpX, vpY, cw, ch);
}

// ─────────────────────────────────────────────────────────────────────────────
// CAPAS INTERNAS
// ─────────────────────────────────────────────────────────────────────────────

function _drawBackground(ctx, vpX, vpY, cw, ch, config) {
  // Base negra
  ctx.fillStyle = config.bgColor || '#08080d';
  ctx.fillRect(0, 0, cw, ch);

  // Glow lejano desde el punto de fuga (sensación de profundidad)
  const rad = ctx.createRadialGradient(vpX, vpY, 0, vpX, vpY, cw * 0.45);
  rad.addColorStop(0,   'rgba(42,44,52,0.85)');
  rad.addColorStop(0.6, 'rgba(18,19,24,0.6)');
  rad.addColorStop(1,   'rgba(0,0,0,0)');
  ctx.fillStyle = rad;
  ctx.fillRect(0, 0, cw, ch);
}

// ── Relleno de las paredes: área a los lados del arco ─────────────────────
function _drawWallFills(ctx, vpX, vpY, archCY, maxR, cw, ch) {
  // Las paredes son el área que queda fuera del arco pero dentro del canvas.
  // Se aproximan con formas bezier que crean sensación de curvatura.

  const wallColorDark = '#18191d';
  const wallColorMid  = '#22242a';
  const wallColorLight = '#2e3038';

  // ── Pared IZQUIERDA ──────────────────────────────────────────────────────
  ctx.save();
  ctx.beginPath();
  // Empieza en la esquina sup-izq, baja por el borde izquierdo
  ctx.moveTo(0, 0);
  // Sube a lo largo del borde izquierdo hasta el suelo
  ctx.lineTo(0, ch);
  // Va hacia el punto donde el arco toca el suelo (izquierda)
  ctx.lineTo(vpX - maxR * 0.18, archCY);
  // Curva bezier hacia el punto de fuga (simula la curvatura del arco)
  ctx.quadraticCurveTo(
    vpX - maxR * 0.60, vpY + (archCY - vpY) * 0.4,
    vpX - maxR * 0.06, vpY - maxR * 0.06,
  );
  // Esquina superior izquierda del canvas
  ctx.lineTo(0, 0);
  ctx.closePath();

  const lg = ctx.createLinearGradient(0, 0, vpX * 0.8, 0);
  lg.addColorStop(0,   wallColorDark);
  lg.addColorStop(0.55, wallColorMid);
  lg.addColorStop(1,   wallColorLight);
  ctx.fillStyle = lg;
  ctx.fill();

  // Borde de la pared izquierda (línea de junta arco–pared)
  ctx.beginPath();
  ctx.moveTo(vpX - maxR * 0.06, vpY - maxR * 0.06);
  ctx.quadraticCurveTo(
    vpX - maxR * 0.60, vpY + (archCY - vpY) * 0.4,
    vpX - maxR * 0.18, archCY,
  );
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth   = 3;
  ctx.stroke();
  ctx.restore();

  // ── Pared DERECHA ────────────────────────────────────────────────────────
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cw, 0);
  ctx.lineTo(cw, ch);
  ctx.lineTo(vpX + maxR * 0.18, archCY);
  ctx.quadraticCurveTo(
    vpX + maxR * 0.60, vpY + (archCY - vpY) * 0.4,
    vpX + maxR * 0.06, vpY - maxR * 0.06,
  );
  ctx.lineTo(cw, 0);
  ctx.closePath();

  const rg = ctx.createLinearGradient(cw, 0, vpX + cw * 0.2, 0);
  rg.addColorStop(0,   wallColorDark);
  rg.addColorStop(0.55, wallColorMid);
  rg.addColorStop(1,   wallColorLight);
  ctx.fillStyle = rg;
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(vpX + maxR * 0.06, vpY - maxR * 0.06);
  ctx.quadraticCurveTo(
    vpX + maxR * 0.60, vpY + (archCY - vpY) * 0.4,
    vpX + maxR * 0.18, archCY,
  );
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth   = 3;
  ctx.stroke();
  ctx.restore();

  // ── Techo (área por encima del arco) ─────────────────────────────────────
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(cw, 0);
  ctx.lineTo(vpX + maxR * 0.06, vpY - maxR * 0.06);
  ctx.quadraticCurveTo(vpX, vpY - maxR * 0.10, vpX - maxR * 0.06, vpY - maxR * 0.06);
  ctx.closePath();

  const tg = ctx.createLinearGradient(0, 0, 0, vpY);
  tg.addColorStop(0,   '#060608');
  tg.addColorStop(0.6, wallColorDark);
  tg.addColorStop(1,   wallColorMid);
  ctx.fillStyle = tg;
  ctx.fill();
  ctx.restore();
}

// ── Anillos del arco en perspectiva ──────────────────────────────────────
function _drawArchRings(ctx, vpX, archCY, maxR, cw, ch, worldZ) {
  const ringGap = 100;
  const offset  = ((worldZ * 1.8) % ringGap + ringGap) % ringGap;

  ctx.save();
  for (let z = 900; z >= 25; z -= ringGap) {
    const zOff = z - offset;
    if (zOff <= 0) continue;

    const s   = _persp(zOff);
    const r   = maxR * s;
    const cy2 = archCY * s + (archCY - maxR * 0.5) * (1 - s);

    // Brillo proporcional a la cercanía
    const lum   = Math.round(28 + s * 22);
    const alpha = 0.55 + s * 0.35;

    ctx.strokeStyle = `rgba(${lum + 6},${lum + 6},${lum + 4},${alpha})`;
    ctx.lineWidth   = Math.max(0.5, s * 2.2);
    ctx.beginPath();
    ctx.arc(vpX, cy2, r, Math.PI, 0);
    ctx.stroke();

    // Línea de sombra interna (junta oscura del panel)
    if (s > 0.25) {
      ctx.strokeStyle = `rgba(0,0,0,${0.25 + (1 - s) * 0.2})`;
      ctx.lineWidth   = Math.max(0.5, s * 1.2);
      ctx.beginPath();
      ctx.arc(vpX, cy2 + s * 1.5, r * 0.985, Math.PI, 0);
      ctx.stroke();
    }
  }
  ctx.restore();
}

// ── Juntas horizontales de los paneles de hormigón ─────────────────────────
function _drawPanelSeams(ctx, vpX, vpY, archCY, maxR, cw, ch, worldZ) {
  // Juntas horizontales en las paredes laterales (convergen al VP)
  const seamGap = 80;
  const offset  = ((worldZ * 1.8) % seamGap + seamGap) % seamGap;

  ctx.save();
  ctx.strokeStyle = 'rgba(8,9,11,0.7)';
  ctx.lineWidth = 1;

  for (let z = 800; z >= 30; z -= seamGap) {
    const zOff = z - offset;
    if (zOff <= 0) continue;

    const s   = _persp(zOff);
    const r   = maxR * s;
    const cy2 = archCY * s + (archCY - maxR * 0.5) * (1 - s);

    // Extremos izquierdo y derecho del arco a esta profundidad
    // El arco termina a ±r del centro horizontalmente
    const lx = vpX - r;   // extremo izquierdo
    const rx = vpX + r;   // extremo derecho

    // Línea horizontal en la pared izquierda (desde el borde del canvas al arco)
    if (lx > 0) {
      ctx.beginPath();
      ctx.moveTo(0, cy2);
      ctx.lineTo(lx, cy2);
      ctx.stroke();
    }

    // Línea horizontal en la pared derecha
    if (rx < cw) {
      ctx.beginPath();
      ctx.moveTo(rx, cy2);
      ctx.lineTo(cw, cy2);
      ctx.stroke();
    }
  }
  ctx.restore();
}

// ── Suelo con balasto ─────────────────────────────────────────────────────
function _drawFloor(ctx, vpX, archCY, cw, ch) {
  const floorY = archCY;   // el suelo empieza donde termina el arco

  // Gradiente del suelo (gris muy oscuro → negro)
  const fg = ctx.createLinearGradient(0, floorY, 0, ch);
  fg.addColorStop(0,   '#18181c');
  fg.addColorStop(0.25, '#101012');
  fg.addColorStop(1,   '#07070a');
  ctx.fillStyle = fg;
  ctx.fillRect(0, floorY, cw, ch - floorY);

  // Junta oscura pared–suelo
  ctx.strokeStyle = 'rgba(0,0,0,0.8)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, floorY);
  ctx.lineTo(cw, floorY);
  ctx.stroke();

  // Balasto (grava): puntos pequeños grises, densos en los laterales
  const seed = 42;  // semilla fija para posición consistente
  ctx.fillStyle = 'rgba(65,67,72,0.5)';
  for (let i = 0; i < 180; i++) {
    // Posición pseudoaleatoria determinista
    const t  = (i * 0.618033) % 1;          // proporción áurea
    const bx = vpX + (t * 2 - 1) * cw * 0.46;
    const by = floorY + ((i * 0.31) % 1) * (ch - floorY) * 0.92;
    const bs = Math.max(1, 4 * (by - floorY) / (ch - floorY));
    ctx.fillRect(bx - bs * 0.5, by - bs * 0.3, bs, bs * 0.55);
  }
}

// ── Raíles con durmientes ─────────────────────────────────────────────────
function _drawRails(ctx, vpX, archCY, cw, ch, worldZ) {
  const floorY   = archCY;
  // Separación de los raíles en el primer plano (píxeles)
  const railHalf = cw * 0.12;

  // ── Durmientes (traviesas de hormigón) ──────────────────────────────────
  const sleeperGap = 55;
  const slOff      = ((worldZ * 3) % sleeperGap + sleeperGap) % sleeperGap;

  ctx.save();
  for (let z = 800; z >= 0; z -= sleeperGap) {
    const zOff = z - slOff;
    if (zOff < 0) continue;
    const s  = _persp(zOff);
    const sy = floorY + (ch - floorY) * (1 - s) * 1.05;
    if (sy > ch + 4) continue;

    const sw        = railHalf * 2 * s * 1.25;
    const thickness = Math.max(1, s * 6);
    const alpha     = Math.min(1, s * 1.5);

    ctx.strokeStyle = `rgba(34,30,22,${alpha})`;
    ctx.lineWidth   = thickness;
    ctx.beginPath();
    ctx.moveTo(vpX - sw / 2, sy);
    ctx.lineTo(vpX + sw / 2, sy);
    ctx.stroke();

    // Highlight superior del durmiente
    ctx.strokeStyle = `rgba(55,50,38,${alpha * 0.6})`;
    ctx.lineWidth   = Math.max(1, thickness * 0.3);
    ctx.beginPath();
    ctx.moveTo(vpX - sw / 2, sy - thickness * 0.35);
    ctx.lineTo(vpX + sw / 2, sy - thickness * 0.35);
    ctx.stroke();
  }
  ctx.restore();

  // ── Raíles (dos pares: vía principal y reflejo) ───────────────────────
  _drawRailPair(ctx, vpX, floorY, ch, railHalf, '#8a8c94', 2.8);
}

function _drawRailPair(ctx, vpX, floorY, ch, halfSpread, color, baseW) {
  ctx.save();

  // Punto de fuga del raíl (pequeño offset desde el centro del VP)
  const vanishOff = halfSpread * 0.12;

  for (const side of [-1, 1]) {
    const xFar  = vpX + side * vanishOff;
    const xNear = vpX + side * halfSpread;

    // Raíl principal
    ctx.strokeStyle = color;
    ctx.lineWidth   = baseW;
    ctx.beginPath();
    ctx.moveTo(xFar,  floorY + 2);
    ctx.lineTo(xNear, ch);
    ctx.stroke();

    // Brillo superior del raíl (el tren lo pule)
    ctx.strokeStyle = 'rgba(200,205,215,0.50)';
    ctx.lineWidth   = baseW * 0.35;
    ctx.beginPath();
    ctx.moveTo(xFar,  floorY + 1);
    ctx.lineTo(xNear, ch - 2);
    ctx.stroke();

    // Sombra inferior del raíl
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth   = baseW * 0.45;
    ctx.beginPath();
    ctx.moveTo(xFar  + side * baseW * 0.5, floorY + 3);
    ctx.lineTo(xNear + side * baseW * 0.5, ch);
    ctx.stroke();
  }

  ctx.restore();
}

// ── Conductos y cables en la parte alta del arco ──────────────────────────
function _drawConduits(ctx, vpX, vpY, archCY, maxR, cw, ch, worldZ) {
  // En los túneles reales, los cables corren en bandejas a ≈45° del arco.
  // Aquí se representan como 2-3 líneas paralelas en cada lado.

  // Fracción horizontal de la posición del conducto en el canvas
  const sides = [
    { xFrac: 0.14, yFrac: 0.36 },   // izquierdo
    { xFrac: 0.86, yFrac: 0.36 },   // derecho
  ];

  ctx.save();

  for (const { xFrac, yFrac } of sides) {
    const ex  = cw  * xFrac;   // extremo del conducto en pantalla
    const ey  = ch  * yFrac;

    // Los conductos van del punto de fuga (muy pequeños allí) hacia los extremos
    const vx0 = vpX + (ex - vpX) * 0.04;
    const vy0 = vpY + (ey - vpY) * 0.04;

    // Conducto principal (tubería/bandeja de cables)
    ctx.strokeStyle = 'rgba(48,52,58,0.95)';
    ctx.lineWidth   = 5;
    ctx.beginPath();
    ctx.moveTo(vx0, vy0);
    ctx.lineTo(ex,  ey);
    ctx.stroke();

    // Sombra debajo del conducto
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth   = 6;
    ctx.beginPath();
    ctx.moveTo(vx0, vy0 + 1.5);
    ctx.lineTo(ex,  ey  + 3);
    ctx.stroke();

    // Cable secundario (más fino, paralelo)
    const sign = ex < vpX ? 1 : -1;
    ctx.strokeStyle = 'rgba(38,42,48,0.8)';
    ctx.lineWidth   = 2.5;
    ctx.beginPath();
    ctx.moveTo(vx0 + sign * 2, vy0 + 6);
    ctx.lineTo(ex  + sign * 8, ey  + 12);
    ctx.stroke();

    // Tercer cable (aún más fino)
    ctx.strokeStyle = 'rgba(30,34,38,0.7)';
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.moveTo(vx0 + sign * 4,  vy0 + 11);
    ctx.lineTo(ex  + sign * 14, ey  + 22);
    ctx.stroke();

    // Anclajes del conducto (clips metálicos cada cierta distancia)
    const clipCount = 5;
    for (let c = 0; c < clipCount; c++) {
      const t   = (c + 1) / (clipCount + 1);
      const cx2 = vx0 + (ex  - vx0) * t;
      const cy2 = vy0 + (ey  - vy0) * t;
      const cs  = Math.max(1, 4 * t);

      ctx.fillStyle = 'rgba(58,62,70,0.9)';
      ctx.fillRect(cx2 - cs, cy2 - cs * 0.5, cs * 2, cs);
    }
  }

  ctx.restore();
}

// ── Paneles de luz empotrados en las paredes ──────────────────────────────
function _drawWallLights(ctx, vpX, vpY, archCY, maxR, cw, ch, worldZ, config) {
  const lightColor   = config.lightColor || '#ffeebb';
  const lightGap     = 190;
  const offset       = ((worldZ * 1.8) % lightGap + lightGap) % lightGap;

  // Posición angular aproximada (a ≈ 50° del arco) → coordenadas de pantalla
  const sides = [
    { xFrac: 0.085, yFrac: 0.50 },
    { xFrac: 0.915, yFrac: 0.50 },
  ];

  ctx.save();

  for (let z = 820; z >= 35; z -= lightGap) {
    const zOff = z - offset;
    if (zOff <= 0) continue;

    const s     = _persp(zOff);
    const alpha = Math.min(1, s * 1.8) * 0.95;

    for (const { xFrac, yFrac } of sides) {
      // Posición en perspectiva: converge hacia el VP según s
      const wx  = vpX + (cw * xFrac - vpX) * s;
      const wy  = vpY + (ch * yFrac - vpY) * s;

      // Tamaño del panel según escala
      const pw = Math.max(2, 18 * s);
      const ph = Math.max(1,  7 * s);

      // Caja del panel (gris oscuro)
      ctx.fillStyle = `rgba(30,32,36,${alpha})`;
      ctx.fillRect(wx - pw * 0.6, wy - ph, pw * 1.2, ph * 2.2);

      // Luz emitida (amarilla-naranja cálida)
      ctx.fillStyle = `rgba(255,232,160,${alpha * 0.88})`;
      ctx.fillRect(wx - pw / 2, wy - ph / 2, pw, ph);

      // Halo difuso
      const halo = ctx.createRadialGradient(wx, wy, 0, wx, wy, pw * 3.5);
      halo.addColorStop(0,   `rgba(255,228,140,${alpha * 0.22})`);
      halo.addColorStop(0.5, `rgba(255,215,100,${alpha * 0.08})`);
      halo.addColorStop(1,   'rgba(255,200,80,0)');
      ctx.fillStyle = halo;
      ctx.fillRect(wx - pw * 4, wy - pw * 4, pw * 8, pw * 8);
    }
  }

  // Luz general del techo: resplandor suave central
  const ceilGlow = ctx.createLinearGradient(0, 0, 0, archCY);
  ceilGlow.addColorStop(0,   'rgba(180,190,160,0.03)');
  ceilGlow.addColorStop(0.5, 'rgba(200,210,170,0.05)');
  ceilGlow.addColorStop(1,   'rgba(0,0,0,0)');
  ctx.fillStyle = ceilGlow;
  ctx.fillRect(0, 0, canvas.width, archCY);

  ctx.restore();
}

// ── Niebla de profundidad ─────────────────────────────────────────────────
function _drawDepthFog(ctx, vpX, vpY, cw, ch) {
  // Radial oscuro centrado en el VP: simula la pérdida de luz en la distancia
  const fog = ctx.createRadialGradient(vpX, vpY, 0, vpX, vpY, cw * 0.32);
  fog.addColorStop(0,   'rgba(12,12,18,0.72)');
  fog.addColorStop(0.4, 'rgba(8,8,12,0.35)');
  fog.addColorStop(1,   'rgba(0,0,0,0)');
  ctx.fillStyle = fog;
  ctx.fillRect(0, 0, cw, ch);
}
