// tunel.js — Diseño fotorrealista del túnel de metro.
// Basado en la estética real de los túneles de Metro de Madrid:
// arco circular de hormigón, raíles con balasto, conductos laterales
// y paneles de luz empotrados en las paredes.
//
// Exporta drawTunel(ctx, config, worldZ) para uso por MetroBase.

import { canvas, STATE } from '../../mecanica/estado.js';
import { ENV_CFG }       from '../../editor/env_config.js';
import { getViewBounds, getCameraVpY } from '../../mecanica/camara.js';

const FOCAL       = 400;
const _persp      = z  => FOCAL / (FOCAL + Math.max(z, 1));
const _vpX        = () => canvas.width  / 2;
// Defaults heredados (fallback cuando no llega override por config).
// vanishingPointY = 0.42 por coherencia con EstacionBase: así la transición
// túnel ↔ estación mantiene el punto de fuga (y por tanto las vías) en la
// misma posición vertical de la pantalla.
const _defaultVpY        = () => canvas.height * (ENV_CFG?.vanishingPointY ?? 0.42);
// Arco GRANDE tipo dovelas de hormigón — la bóveda domina la mitad
// superior del canvas (ref. foto del túnel real). maxR define el radio
// del anillo más cercano al espectador; archOffset baja el centro del
// círculo para que el arco quede sobre el VP y deje espacio inferior
// para las vías y aceras de mantenimiento.
const _defaultArchOffset = () => canvas.height * 0.18;
const _defaultMaxR       = () => canvas.height * 0.45;

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
  // Geometría con overrides desde config (editor de escenario):
  //   · vanishingPointY      → fracción 0–1 (Y del punto de fuga).
  //   · archRadiusRatio      → fracción 0–1 (radio del arco / canvas.height).
  //   · archCenterOffsetRatio→ fracción del canvas.height entre VP y centro
  //                            del arco (controla cuánto suelo es visible).
  // VP vertical ajustado por el offsetY de la cámara — los anillos del túnel
  // se inclinan al subir/bajar la paloma.
  const _baseVpY = config.vanishingPointY != null
    ? ch * config.vanishingPointY
    : _defaultVpY();
  const vpY = getCameraVpY(_baseVpY);
  const maxR   = config.archRadiusRatio != null
    ? ch * config.archRadiusRatio
    : _defaultMaxR();
  const archCY = vpY + (config.archCenterOffsetRatio != null
    ? ch * config.archCenterOffsetRatio
    : _defaultArchOffset());

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
  // Pasamos vpY explícito para que los raíles arranquen a la MISMA Y que en
  // EstacionBase (vpY + 8) y la transición túnel ↔ estación sea continua.
  _drawRails(ctx, vpX, vpY, archCY, cw, ch, worldZ);

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
  const B = getViewBounds();
  // Base negra — extendida con los bounds para que no aparezcan huecos
  // cuando la cámara se desplaza al máximo.
  ctx.fillStyle = config.bgColor || '#08080d';
  ctx.fillRect(B.left, B.top, B.width, B.height);

  // Glow lejano desde el punto de fuga (sensación de profundidad)
  const rad = ctx.createRadialGradient(vpX, vpY, 0, vpX, vpY, cw * 0.45);
  rad.addColorStop(0,   'rgba(42,44,52,0.85)');
  rad.addColorStop(0.6, 'rgba(18,19,24,0.6)');
  rad.addColorStop(1,   'rgba(0,0,0,0)');
  ctx.fillStyle = rad;
  ctx.fillRect(B.left, B.top, B.width, B.height);
}

// ── Relleno de las paredes: área a los lados del arco ─────────────────────
function _drawWallFills(ctx, vpX, vpY, archCY, maxR, cw, ch) {
  // Las paredes son el área que queda fuera del arco pero dentro del canvas.
  // Se aproximan con formas bezier que crean sensación de curvatura.

  const wallColorDark = '#18191d';
  const wallColorMid  = '#22242a';
  const wallColorLight = '#2e3038';

  // ── Coeficientes de geometría del arco ─────────────────────────────────
  // TOP_RATIO controla DÓNDE convergen las paredes cerca del VP. Con 0.06
  // el túnel deja un "V" abierto enorme entre las paredes y la parte
  // superior del canvas. Subido a 0.28 las paredes se juntan más afuera
  // del VP, dejando MENOS espacio interior — el techo se "cierra" aún más
  // tras la reducción de maxR (sección ~25% más estrecha).
  const TOP_RATIO   = 0.20;       // antes 0.20
  const FLOOR_RATIO = 0.18;
  const CTRL_RATIO  = 0.50;
  const TOP_DIP     = 0.30;       // antes 0.30 — dip del techo, debe ser
                                  // mayor que TOP_RATIO para que la curva
                                  // baje al centro

  // ── Pared IZQUIERDA ──────────────────────────────────────────────────────
  ctx.save();
  ctx.beginPath();
  // Empieza en la esquina sup-izq, baja por el borde izquierdo
  ctx.moveTo(0, 0);
  // Sube a lo largo del borde izquierdo hasta el suelo
  ctx.lineTo(0, ch);
  // Va hacia el punto donde el arco toca el suelo (izquierda)
  ctx.lineTo(vpX - maxR * FLOOR_RATIO, archCY);
  // Curva bezier hacia el punto de fuga (simula la curvatura del arco)
  ctx.quadraticCurveTo(
    vpX - maxR * CTRL_RATIO, vpY + (archCY - vpY) * 0.4,
    vpX - maxR * TOP_RATIO, vpY - maxR * TOP_RATIO,
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
  ctx.moveTo(vpX - maxR * TOP_RATIO, vpY - maxR * TOP_RATIO);
  ctx.quadraticCurveTo(
    vpX - maxR * CTRL_RATIO, vpY + (archCY - vpY) * 0.4,
    vpX - maxR * FLOOR_RATIO, archCY,
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
  ctx.lineTo(vpX + maxR * FLOOR_RATIO, archCY);
  ctx.quadraticCurveTo(
    vpX + maxR * CTRL_RATIO, vpY + (archCY - vpY) * 0.4,
    vpX + maxR * TOP_RATIO, vpY - maxR * TOP_RATIO,
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
  ctx.moveTo(vpX + maxR * TOP_RATIO, vpY - maxR * TOP_RATIO);
  ctx.quadraticCurveTo(
    vpX + maxR * CTRL_RATIO, vpY + (archCY - vpY) * 0.4,
    vpX + maxR * FLOOR_RATIO, archCY,
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
  ctx.lineTo(vpX + maxR * TOP_RATIO, vpY - maxR * TOP_RATIO);
  ctx.quadraticCurveTo(vpX, vpY - maxR * TOP_DIP, vpX - maxR * TOP_RATIO, vpY - maxR * TOP_RATIO);
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
// Geometría DOS-VÍAS coincidente con EstacionBase para que la transición
// túnel → estación sea visualmente continua. Los offsets son los MISMOS
// porcentajes del ancho del canvas que usa estacion_base.js (mantén ambos
// sincronizados si tocas estos números).
//
//   - Vía exterior  ±42 % W   (BASE)   → ±1.8 % W   (VP)
//   - Vía interior  ± 2 % W   (BASE)   → ±1.5 % W   (VP)
// 0.32/0.02 (antes 0.42/0.02) → cada vía ocupa ~30 % del canvas en la base.
// Combinado con TRAIN_TO_TRACK_RATIO 0.85, los dos trenes juntos cubren
// ~51 % del ancho — caben dentro del arco del túnel en lugar de
// desbordarlo. Valores validados en mockup_tren.html.
const TRACK_OUTER_RATIO_BASE = 0.32;
const TRACK_INNER_RATIO_BASE = 0.02;
const TRACK_OUTER_RATIO_VP   = 0.018;
const TRACK_INNER_RATIO_VP   = 0.015;

function _drawRails(ctx, vpX, vpY, archCY, cw, ch, worldZ) {
  // Las vías arrancan a vpY + 8 (igual que en EstacionBase) para que la
  // transición túnel ↔ estación sea visualmente continua. Antes usábamos
  // floorY = archCY que dejaba las vías sólo en el tercio inferior.
  const railTopY = vpY + 8;
  const railBotY = ch;

  // Coordenadas X de las 8 esquinas (4 carriles × 2 puntos: VP/base).
  const tOBL = vpX - cw * TRACK_OUTER_RATIO_BASE;
  const tIBL = vpX - cw * TRACK_INNER_RATIO_BASE;
  const tIBR = vpX + cw * TRACK_INNER_RATIO_BASE;
  const tOBR = vpX + cw * TRACK_OUTER_RATIO_BASE;
  const tOVL = vpX - cw * TRACK_OUTER_RATIO_VP;
  const tIVL = vpX - cw * TRACK_INNER_RATIO_VP;
  const tIVR = vpX + cw * TRACK_INNER_RATIO_VP;
  const tOVR = vpX + cw * TRACK_OUTER_RATIO_VP;

  // ── Durmientes (traviesas de hormigón) — UNA fila para cada vía ─────────
  // Avanzamos por un parámetro lineal t (0 = VP, 1 = base) animado con worldZ
  // para que las traviesas "vengan hacia la cámara" como antes.
  const numSleepers = 22;
  const slOffT      = ((worldZ * 0.0035) % (1 / numSleepers) + (1 / numSleepers)) % (1 / numSleepers);

  ctx.save();
  for (let i = 0; i < numSleepers; i++) {
    // Reparto cuadrático para que las traviesas se concentren al fondo
    // (efecto realista de perspectiva — las cercanas se separan, las lejanas
    // se apilan cerca del VP).
    const baseT = i / (numSleepers - 1);
    const t = Math.pow(baseT + slOffT, 2);
    if (t <= 0 || t >= 1) continue;

    const sy = (1 - t) * railTopY + t * railBotY;

    // Interpolación de las posiciones X (t=0 → VP, t=1 → base).
    const tL1 = (1 - t) * tOVL + t * tOBL;
    const tL2 = (1 - t) * tIVL + t * tIBL;
    const tR1 = (1 - t) * tIVR + t * tIBR;
    const tR2 = (1 - t) * tOVR + t * tOBR;

    const thickness = Math.max(1, t * 6);
    const alpha     = Math.min(1, t * 1.5 + 0.1);

    ctx.strokeStyle = `rgba(34,30,22,${alpha})`;
    ctx.lineWidth   = thickness;
    ctx.beginPath(); ctx.moveTo(tL1, sy); ctx.lineTo(tL2, sy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(tR1, sy); ctx.lineTo(tR2, sy); ctx.stroke();

    // Highlight superior del durmiente
    ctx.strokeStyle = `rgba(55,50,38,${alpha * 0.6})`;
    ctx.lineWidth   = Math.max(1, thickness * 0.3);
    ctx.beginPath(); ctx.moveTo(tL1, sy - thickness * 0.35); ctx.lineTo(tL2, sy - thickness * 0.35); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(tR1, sy - thickness * 0.35); ctx.lineTo(tR2, sy - thickness * 0.35); ctx.stroke();
  }
  ctx.restore();

  // ── Carriles metálicos (4 carriles: 2 por vía) ──────────────────────────
  const railColor = '#8a8c94';
  const baseW     = 2.8;
  const rails = [
    { near: tOBL, far: tOVL },   // izq exterior
    { near: tIBL, far: tIVL },   // izq interior
    { near: tIBR, far: tIVR },   // der interior
    { near: tOBR, far: tOVR },   // der exterior
  ];
  _drawRailLines(ctx, rails, railTopY, railBotY, railColor, baseW);
}

function _drawRailLines(ctx, rails, topY, botY, color, baseW) {
  ctx.save();
  for (const rail of rails) {
    // Cuerpo del raíl
    ctx.strokeStyle = color;
    ctx.lineWidth   = baseW;
    ctx.beginPath();
    ctx.moveTo(rail.far,  topY);
    ctx.lineTo(rail.near, botY);
    ctx.stroke();

    // Brillo superior (efecto de pulido)
    ctx.strokeStyle = 'rgba(200,205,215,0.50)';
    ctx.lineWidth   = baseW * 0.35;
    ctx.beginPath();
    ctx.moveTo(rail.far,  topY - 1);
    ctx.lineTo(rail.near, botY - 2);
    ctx.stroke();

    // Sombra inferior
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth   = baseW * 0.45;
    ctx.beginPath();
    ctx.moveTo(rail.far  + baseW * 0.3, topY + 1);
    ctx.lineTo(rail.near + baseW * 0.3, botY);
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
