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

  // 2 ── (Rellenos de pared y techo eliminados a petición — todo el fondo
  //       queda en negro uniforme y la profundidad la dan sólo los anillos.)

  // 3 ── Anillos del arco en perspectiva ────────────────────────────────────
  _drawArchRings(ctx, vpX, archCY, maxR, cw, ch, worldZ);

  // 4 ── Juntas de los paneles de hormigón (horizontal + vertical) ──────────
  _drawPanelSeams(ctx, vpX, vpY, archCY, maxR, cw, ch, worldZ);

  // 5 ── Suelo de la vía (hormigón gris oscuro tipo modo oscuro) ───────────
  //       Trapecio gris oscuro debajo de toda la zona de las dos vías,
  //       limitado al ancho del corredor de los raíles para no invadir
  //       el negro de las paredes.
  _drawTrackFloor(ctx, vpX, vpY, cw, ch, config);

  // 6 ── Raíles con durmientes ───────────────────────────────────────────────
  // Pasamos vpY explícito para que los raíles arranquen a la MISMA Y que en
  // EstacionBase (vpY + 8) y la transición túnel ↔ estación sea continua.
  _drawRails(ctx, vpX, vpY, archCY, cw, ch, worldZ, config);

  // 6b ── (Aceras laterales de mantenimiento eliminadas a petición —
  //        los raíles se ven directamente sobre el balasto sin banqueta).

  // 7 ── Cables suspendidos del techo (2 diagonales que convergen al VP) ──
  //       Sustituyen a los cables laterales multicolor: en la foto real los
  //       cables eléctricos del catenario corren colgados de la bóveda.
  _drawCeilingCables(ctx, vpX, vpY, archCY, maxR, cw, ch, worldZ);

  // 7b ── Lámparas fluorescentes empotradas en el techo ─────────────────────
  _drawCeilingLights(ctx, vpX, vpY, archCY, maxR, cw, ch, worldZ, config);

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

// ── Anillos del arco en perspectiva (dovelas segmentadas) ──────────────
// Cada anillo se compone de SEGMENTS paneles trapezoidales con juntas
// radiales visibles — réplica de las dovelas de hormigón prefabricado de
// los túneles modernos. Las juntas radiales convergen al centro del arco
// (archCY a esa profundidad) y dividen el semicírculo en partes iguales.
function _drawArchRings(ctx, vpX, archCY, maxR, cw, ch, worldZ) {
  const ringGap  = 100;
  const SEGMENTS = 8;     // dovelas por anillo (semicírculo) — referencia foto
  const offset   = ((worldZ * 1.8) % ringGap + ringGap) % ringGap;

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

    // 1 ── Junta circular del anillo (anillo COMPLETO 360° para que la
    //      sección del túnel sea un círculo cerrado, no un arco). La parte
    //      inferior queda tapada por el suelo en los anillos cercanos, pero
    //      en los lejanos se ve el círculo entero — efecto "tubo" como en
    //      la foto de referencia.
    ctx.strokeStyle = `rgba(${lum + 6},${lum + 6},${lum + 4},${alpha})`;
    ctx.lineWidth   = Math.max(0.5, s * 2.2);
    ctx.beginPath();
    ctx.arc(vpX, cy2, r, 0, Math.PI * 2);
    ctx.stroke();

    // 2 ── Sombra interna (junta oscura del panel) — también círculo completo
    if (s > 0.25) {
      ctx.strokeStyle = `rgba(0,0,0,${0.25 + (1 - s) * 0.2})`;
      ctx.lineWidth   = Math.max(0.5, s * 1.2);
      ctx.beginPath();
      ctx.arc(vpX, cy2 + s * 1.5, r * 0.985, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 3 ── Juntas RADIALES (entre dovelas) — sólo en anillos cercanos
    //      donde el detalle es perceptible. En los lejanos quitarlas para
    //      no saturar la imagen.
    if (s > 0.30) {
      const innerR = r * 0.92;     // las juntas no llegan al borde absoluto
      ctx.strokeStyle = `rgba(0,0,0,${0.32 + s * 0.20})`;
      ctx.lineWidth   = Math.max(0.5, s * 0.9);
      for (let i = 1; i < SEGMENTS; i++) {
        const ang = Math.PI + (Math.PI * i) / SEGMENTS;   // 180°→360° (semicírculo superior)
        const x1 = vpX + Math.cos(ang) * innerR;
        const y1 = cy2 + Math.sin(ang) * innerR;
        const x2 = vpX + Math.cos(ang) * r;
        const y2 = cy2 + Math.sin(ang) * r;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }

      // Detalle: punto/perno cerca del centro de cada dovela en anillos
      // muy próximos (s>0.55) — sugiere los anclajes de las prefabricadas.
      if (s > 0.55) {
        ctx.fillStyle = `rgba(${lum - 8},${lum - 8},${lum - 10},${alpha})`;
        for (let i = 0; i < SEGMENTS; i++) {
          const ang = Math.PI + (Math.PI * (i + 0.5)) / SEGMENTS;
          const px = vpX + Math.cos(ang) * r * 0.95;
          const py = cy2 + Math.sin(ang) * r * 0.95;
          const sz = Math.max(1, s * 1.6);
          ctx.fillRect(px - sz/2, py - sz/2, sz, sz);
        }
      }
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
// 0.255/0.03 (validado en mockup_tunel_render.html con sliders): vías un
// 20 % más estrechas y separación central mayor → los carriles tienen
// presencia 3D sin desbordar y queda hueco para el centro de la vía.
// Si tocas estos números actualízalos también en tunel_base.js (los trenes
// usan las mismas ratios para alinearse con los rieles).
const TRACK_OUTER_RATIO_BASE = 0.255;
const TRACK_INNER_RATIO_BASE = 0.03;
const TRACK_OUTER_RATIO_VP   = 0.018;
const TRACK_INNER_RATIO_VP   = 0.015;

function _drawRails(ctx, vpX, vpY, archCY, cw, ch, worldZ, config = {}) {
  // Las vías arrancan a vpY + 8 (igual que en EstacionBase) para que la
  // transición túnel ↔ estación sea visualmente continua. Antes usábamos
  // floorY = archCY que dejaba las vías sólo en el tercio inferior.
  const railTopY = vpY + 8;
  const railBotY = ch;

  // Posiciones de carriles configurables desde config (los sliders del
  // mockup las ajustan en vivo). Defaults coinciden con los valores
  // históricos sincronizados con tunel_base.js / estacion_base.js.
  const trackOuter = config.trackOuterRatio ?? TRACK_OUTER_RATIO_BASE;
  const trackInner = config.trackInnerRatio ?? TRACK_INNER_RATIO_BASE;

  // Coordenadas X de las 8 esquinas (4 carriles × 2 puntos: VP/base).
  const tOBL = vpX - cw * trackOuter;
  const tIBL = vpX - cw * trackInner;
  const tIBR = vpX + cw * trackInner;
  const tOBR = vpX + cw * trackOuter;
  const tOVL = vpX - cw * TRACK_OUTER_RATIO_VP;
  const tIVL = vpX - cw * TRACK_INNER_RATIO_VP;
  const tIVR = vpX + cw * TRACK_INNER_RATIO_VP;
  const tOVR = vpX + cw * TRACK_OUTER_RATIO_VP;

  // ── Anclajes individuales — un PAD de hormigón debajo de cada carril ──
  // En vez de una traviesa continua de extremo a extremo de la vía, dibujamos
  // 4 anclajes (uno por carril) por fila, con clips Pandrol (pestañas) a
  // ambos lados del rail. El espacio interior entre carriles queda VACÍO,
  // como en el sistema de fijación directa real (ver foto/diagrama).
  const numSleepers     = config.sleeperCount     ?? 24;
  const sleeperThickMul = config.sleeperThickness ?? 14;
  // Ancho del pad (lateral) relativo al rail: 1.6 = pad 3.2× más ancho que
  // el rail → deja ~0.8× a cada lado para clips visibles.
  const padHalfWMul     = config.padHalfWidthMul ?? 1.8;
  const baseWForPads    = (config && config.railWidth) || 7;
  const slOffT = ((worldZ * 0.0035) % (1 / numSleepers) + (1 / numSleepers)) % (1 / numSleepers);

  ctx.save();
  for (let i = 0; i < numSleepers; i++) {
    // Reparto cuadrático: anclajes concentrados al fondo (perspectiva).
    const baseT = i / (numSleepers - 1);
    const t = Math.pow(baseT + slOffT, 2);
    if (t <= 0 || t >= 1) continue;

    const sy = (1 - t) * railTopY + t * railBotY;

    // X de cada uno de los 4 carriles a esta profundidad.
    const railX = [
      (1 - t) * tOVL + t * tOBL,   // L exterior
      (1 - t) * tIVL + t * tIBL,   // L interior
      (1 - t) * tIVR + t * tIBR,   // R interior
      (1 - t) * tOVR + t * tOBR,   // R exterior
    ];

    const thickness = Math.max(1, t * sleeperThickMul);
    const alpha     = Math.min(1, t * 1.5 + 0.1);
    // Ancho del pad escala con t (perspectiva) y con railWidth.
    const padHalfW  = Math.max(2, baseWForPads * padHalfWMul * Math.max(0.35, t));

    for (const rx of railX) {
      // Cuerpo del anclaje — pad de hormigón gris.
      ctx.fillStyle = `rgba(72,74,80,${alpha})`;
      ctx.fillRect(rx - padHalfW, sy - thickness * 0.5, padHalfW * 2, thickness);

      // Highlight canto superior (luz cenital del túnel sobre el pad).
      const hlH = Math.max(1, thickness * 0.28);
      ctx.fillStyle = `rgba(120,122,128,${alpha * 0.70})`;
      ctx.fillRect(rx - padHalfW, sy - thickness * 0.5, padHalfW * 2, hlH);

      // Sombra canto inferior.
      const shH = Math.max(1, thickness * 0.22);
      ctx.fillStyle = `rgba(18,20,24,${alpha * 0.75})`;
      ctx.fillRect(rx - padHalfW, sy + thickness * 0.5 - shH, padHalfW * 2, shH);

      // Clips/pestañas Pandrol — bandas alargadas HORIZONTALMENTE (más
      // anchas que altas) a cada lado del rail, ocupando casi todo el
      // hueco entre el rail y el borde del pad.
      if (t > 0.30) {
        // clipW horizontal: prácticamente el ancho del hueco rail→borde pad
        const clipW = Math.max(2, padHalfW - baseWForPads * 0.55);
        const clipH = Math.max(1, thickness * 0.35);
        ctx.fillStyle = `rgba(14,16,20,${alpha})`;
        // Pestaña izquierda (entre borde izq del pad y rail)
        const xL = rx - padHalfW + Math.max(0.5, baseWForPads * 0.10);
        const xR = rx + baseWForPads * 0.55;
        ctx.fillRect(xL, sy - clipH * 0.5, clipW, clipH);
        // Pestaña derecha
        ctx.fillRect(xR, sy - clipH * 0.5, clipW, clipH);
        // Brillito metálico en el canto superior de cada pestaña
        ctx.fillStyle = `rgba(110,115,122,${alpha * 0.75})`;
        ctx.fillRect(xL, sy - clipH * 0.5, clipW, Math.max(1, clipH * 0.30));
        ctx.fillRect(xR, sy - clipH * 0.5, clipW, Math.max(1, clipH * 0.30));
      }
    }
  }
  ctx.restore();

  // ── Canal de drenaje central — rejilla metálica entre las dos vías ─────
  // Tipo CONDUCTO CENTRAL del esquema técnico: cubierta rectangular larga
  // con slots horizontales tipo rejilla. Animado con worldZ para que las
  // ranuras avancen hacia la cámara.
  _drawCentralDrain(ctx, vpX, railTopY, railBotY, cw, worldZ, config);

  // ── Carriles metálicos (4 carriles: 2 por vía) ──────────────────────────
  const railColor = '#8a8c94';
  // baseW configurable desde config.railWidth (default 7). Determina el
  // grosor visual de cada carril; se escala internamente por las 6 capas
  // del perfil 3D. 7 validado en mockup_tunel_render.html.
  const baseW     = (config && config.railWidth) || 7;
  const rails = [
    { near: tOBL, far: tOVL },   // izq exterior
    { near: tIBL, far: tIVL },   // izq interior
    { near: tIBR, far: tIVR },   // der interior
    { near: tOBR, far: tOVR },   // der exterior
  ];
  _drawRailLines(ctx, rails, railTopY, railBotY, railColor, baseW);
}

// ── Tercer carril electrificado (rail amarillo entre los dos plateados) ──
// Réplica del 3er rail de los metros europeos: barra amarilla con sombra
// inferior y un brillo superior. Más ancho que un carril normal porque
// lleva la cubierta protectora.
function _drawThirdRail(ctx, farX, topY, nearX, botY) {
  ctx.save();
  // Sombra proyectada
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.lineWidth   = 7;
  ctx.beginPath(); ctx.moveTo(farX, topY + 1.5); ctx.lineTo(nearX, botY + 2.5); ctx.stroke();
  // Cuerpo amarillo (cubierta)
  ctx.strokeStyle = '#d8a020';
  ctx.lineWidth   = 5.5;
  ctx.beginPath(); ctx.moveTo(farX, topY); ctx.lineTo(nearX, botY); ctx.stroke();
  // Banda intermedia (color de referencia: amarillo más cálido)
  ctx.strokeStyle = '#f0b830';
  ctx.lineWidth   = 3.6;
  ctx.beginPath(); ctx.moveTo(farX, topY - 0.5); ctx.lineTo(nearX, botY - 1); ctx.stroke();
  // Brillo superior (canto iluminado)
  ctx.strokeStyle = 'rgba(255,225,140,0.95)';
  ctx.lineWidth   = 1.8;
  ctx.beginPath(); ctx.moveTo(farX, topY - 1.2); ctx.lineTo(nearX, botY - 2.2); ctx.stroke();
  // Hilo especular
  ctx.strokeStyle = 'rgba(255,255,210,0.85)';
  ctx.lineWidth   = 0.7;
  ctx.beginPath(); ctx.moveTo(farX, topY - 1.6); ctx.lineTo(nearX, botY - 2.8); ctx.stroke();
  ctx.restore();
}

// ── Suelo de la vía — trapecio gris oscuro (modo oscuro) ──────────────────
// Sólo cubre el corredor entre los carriles exteriores (no invade el negro
// del fondo en los laterales del túnel). Color hormigón apagado, con un
// gradiente de cerca→lejos para sugerir profundidad sin saturar.
function _drawTrackFloor(ctx, vpX, vpY, cw, ch, config = {}) {
  const railTopY = vpY + 8;
  const railBotY = ch;
  // Ancho cubierto: un poco más ancho que el carril exterior para que el
  // suelo "abrace" los anclajes sin dejar negro entre rail y pad.
  const outerBase = (config.trackOuterRatio ?? TRACK_OUTER_RATIO_BASE) * 1.18;
  const outerVP   = TRACK_OUTER_RATIO_VP * 1.18;
  const lBase = vpX - cw * outerBase;
  const rBase = vpX + cw * outerBase;
  const lVP   = vpX - cw * outerVP;
  const rVP   = vpX + cw * outerVP;

  ctx.save();
  // Gradiente vertical (más oscuro hacia la cámara, ligero brillo central)
  const grad = ctx.createLinearGradient(0, railTopY, 0, railBotY);
  grad.addColorStop(0,   '#1c1f25');   // cerca del VP — gris oscuro suave
  grad.addColorStop(0.5, '#171a20');   // intermedio
  grad.addColorStop(1,   '#0d0f14');   // pegado a la cámara — más negro
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(lVP,   railTopY);
  ctx.lineTo(rVP,   railTopY);
  ctx.lineTo(rBase, railBotY);
  ctx.lineTo(lBase, railBotY);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// ── Canal de drenaje central (rejilla con slots) ──────────────────────────
// Banda trapezoidal en el corredor entre las dos vías, con ranuras
// horizontales que se desplazan con worldZ. Sustituye la antigua banda
// vacía por una pieza con detalle visual (CONDUCTO CENTRAL del diagrama).
function _drawCentralDrain(ctx, vpX, topY, botY, cw, worldZ, config = {}) {
  // Ancho del canal: ocupa el hueco entre los carriles interiores
  // (TRACK_INNER_RATIO * 0.85 para dejar un pelín de margen).
  const innerBase = (config.trackInnerRatio ?? TRACK_INNER_RATIO_BASE);
  const innerVP   = TRACK_INNER_RATIO_VP;
  const halfBase  = cw * innerBase * 0.80;
  const halfVP    = cw * innerVP   * 0.80;

  ctx.save();

  // 1 ── Trapecio de la cubierta (placa metálica gris) — color concreto
  //      lo bastante claro para que destaque sobre el negro del fondo.
  ctx.fillStyle = '#3a3d44';
  ctx.beginPath();
  ctx.moveTo(vpX - halfVP,   topY);
  ctx.lineTo(vpX + halfVP,   topY);
  ctx.lineTo(vpX + halfBase, botY);
  ctx.lineTo(vpX - halfBase, botY);
  ctx.closePath();
  ctx.fill();

  // 2 ── Bordes laterales (relieve metálico claro)
  ctx.strokeStyle = 'rgba(140,148,158,0.95)';
  ctx.lineWidth   = 1.5;
  ctx.beginPath();
  ctx.moveTo(vpX - halfVP,   topY); ctx.lineTo(vpX - halfBase, botY);
  ctx.moveTo(vpX + halfVP,   topY); ctx.lineTo(vpX + halfBase, botY);
  ctx.stroke();

  // 3 ── Slots horizontales de la rejilla (animados con worldZ) ─────────
  const numSlots = 28;
  const slotOff  = ((worldZ * 0.0035) % (1 / numSlots) + (1 / numSlots)) % (1 / numSlots);
  for (let i = 0; i < numSlots; i++) {
    const baseT = i / (numSlots - 1);
    const t = Math.pow(baseT + slotOff, 2);
    if (t <= 0 || t >= 1) continue;

    const sy     = (1 - t) * topY + t * botY;
    const halfW  = (1 - t) * halfVP + t * halfBase;
    const slotW  = halfW * 1.55;                  // slot ocupa ~75% del ancho
    const slotH  = Math.max(1, t * 4.5);
    const alpha  = Math.min(1, t * 1.5 + 0.2);

    // Hueco NEGRO de la ranura (contraste fuerte sobre la placa gris)
    ctx.fillStyle = `rgba(0,0,0,${Math.min(1, alpha + 0.2)})`;
    ctx.fillRect(vpX - slotW * 0.5, sy - slotH * 0.5, slotW, slotH);
    // Borde superior de la barra entre ranuras (canto iluminado)
    ctx.fillStyle = `rgba(160,168,178,${alpha * 0.85})`;
    ctx.fillRect(vpX - slotW * 0.5, sy + slotH * 0.5, slotW, Math.max(1, slotH * 0.35));
    // Sombra inferior de la ranura
    ctx.fillStyle = `rgba(20,22,26,${alpha * 0.7})`;
    ctx.fillRect(vpX - slotW * 0.5, sy + slotH * 0.5 + Math.max(1, slotH * 0.35), slotW, Math.max(1, slotH * 0.20));
  }
  ctx.restore();
}

// ── Raíl con sección 3D (perfil de viga) ──────────────────────────────────
// Cada raíl se construye apilando 6 strokes paralelos a alturas distintas
// para simular el perfil real (foot/web/head): sombra proyectada en
// balasto → base oscura → alma media → cabeza clara → brillo metálico →
// especular blanco. La gradación da volumen aunque el raíl siga siendo
// una línea diagonal en perspectiva.
function _drawRailLines(ctx, rails, topY, botY, color, baseW) {
  // Cada capa: { offY, w, color }
  //   offY  = desplazamiento Y respecto al baseline del raíl
  //   w     = multiplicador del ancho (baseW)
  // Ordenadas de la MÁS BAJA a la MÁS ALTA en pantalla (se pintan en ese
  // orden para que las capas superiores tapen a las inferiores en la cima).
  const layers = [
    { offY: +2.0, w: 2.0, c: 'rgba(0,0,0,0.55)' },          // sombra en balasto
    { offY: +1.0, w: 1.55, c: '#26282d' },                    // base/foot oscuro
    { offY: 0,    w: 1.20, c: '#52555c' },                    // alma/web medio
    { offY: -1.0, w: 1.05, c: '#888c95' },                    // cabeza inferior
    { offY: -1.8, w: 0.85, c: '#b8bcc6' },                    // cabeza superior
    { offY: -2.4, w: 0.45, c: 'rgba(225,230,240,0.95)' },     // brillo metálico
    { offY: -2.8, w: 0.18, c: 'rgba(255,255,255,0.85)' },     // especular blanco
  ];

  ctx.save();
  for (const rail of rails) {
    for (const L of layers) {
      ctx.strokeStyle = L.c;
      ctx.lineWidth   = Math.max(0.5, baseW * L.w);
      ctx.beginPath();
      ctx.moveTo(rail.far,  topY + L.offY);
      ctx.lineTo(rail.near, botY + L.offY);
      ctx.stroke();
    }
  }
  ctx.restore();
}

// ── Aceras laterales (banquetas de mantenimiento) ─────────────────────────
// Pasillos elevados de hormigón entre la pared y el carril exterior, con
// franja amarilla de seguridad en el borde interior. Forma de trapecio
// trapezoidal en perspectiva: ancha cerca de la cámara, fina en el VP.
function _drawSideWalkways(ctx, vpX, vpY, archCY, maxR, cw, ch) {
  // Los carriles exteriores están a ±32 % en la base y ±1.8 % en el VP
  // (constantes TRACK_OUTER_RATIO_BASE/VP definidas más abajo). La acera
  // ocupa el espacio entre la pared del túnel y el carril exterior.
  const railTopY = vpY + 8;          // misma Y de inicio que los raíles
  const railBotY = ch;
  // Borde INTERIOR de la acera (pegado al carril exterior)
  const innerBaseL = vpX - cw * 0.32;
  const innerBaseR = vpX + cw * 0.32;
  const innerVPL   = vpX - cw * 0.018;
  const innerVPR   = vpX + cw * 0.018;
  // Borde EXTERIOR de la acera (donde toca la pared) — sigue la curva del
  // arco a la altura de las vías. Aproximamos con valores que casan con la
  // base del arco (semicírculo de radio maxR alrededor de archCY).
  const archHalfWidthAtFloor = Math.sqrt(Math.max(0, maxR * maxR - (railTopY - archCY) ** 2));
  const outerBaseL = vpX - cw * 0.48;   // pegado al borde inferior del canvas
  const outerBaseR = vpX + cw * 0.48;
  const outerVPL   = vpX - archHalfWidthAtFloor * 0.5;   // donde el arco toca el suelo
  const outerVPR   = vpX + archHalfWidthAtFloor * 0.5;

  ctx.save();
  // ── ACERA IZQUIERDA ──
  // Suelo de hormigón
  ctx.fillStyle = '#3a3a40';
  ctx.beginPath();
  ctx.moveTo(outerBaseL, railBotY);
  ctx.lineTo(innerBaseL, railBotY);
  ctx.lineTo(innerVPL,   railTopY);
  ctx.lineTo(outerVPL,   railTopY);
  ctx.closePath();
  ctx.fill();
  // Highlight superior (canto frontal de la acera, donde recibe luz)
  const lgL = ctx.createLinearGradient(outerBaseL, railTopY, outerBaseL, railBotY);
  lgL.addColorStop(0, 'rgba(120,120,128,0.45)');
  lgL.addColorStop(0.3, 'rgba(80,80,86,0.18)');
  lgL.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = lgL;
  ctx.beginPath();
  ctx.moveTo(outerBaseL, railBotY);
  ctx.lineTo(innerBaseL, railBotY);
  ctx.lineTo(innerVPL,   railTopY);
  ctx.lineTo(outerVPL,   railTopY);
  ctx.closePath();
  ctx.fill();
  // Borde interior oscuro de la acera (sin franja amarilla — coherente con
  // el aspecto monocromático del túnel real de la referencia).
  ctx.strokeStyle = 'rgba(0,0,0,0.85)';
  ctx.lineWidth   = 2;
  ctx.beginPath();
  ctx.moveTo(innerBaseL, railBotY);
  ctx.lineTo(innerVPL,   railTopY);
  ctx.stroke();

  // ── ACERA DERECHA ──
  ctx.fillStyle = '#3a3a40';
  ctx.beginPath();
  ctx.moveTo(outerBaseR, railBotY);
  ctx.lineTo(innerBaseR, railBotY);
  ctx.lineTo(innerVPR,   railTopY);
  ctx.lineTo(outerVPR,   railTopY);
  ctx.closePath();
  ctx.fill();
  const lgR = ctx.createLinearGradient(outerBaseR, railTopY, outerBaseR, railBotY);
  lgR.addColorStop(0, 'rgba(120,120,128,0.45)');
  lgR.addColorStop(0.3, 'rgba(80,80,86,0.18)');
  lgR.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = lgR;
  ctx.beginPath();
  ctx.moveTo(outerBaseR, railBotY);
  ctx.lineTo(innerBaseR, railBotY);
  ctx.lineTo(innerVPR,   railTopY);
  ctx.lineTo(outerVPR,   railTopY);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.85)';
  ctx.lineWidth   = 2;
  ctx.beginPath();
  ctx.moveTo(innerBaseR, railBotY);
  ctx.lineTo(innerVPR,   railTopY);
  ctx.stroke();
  ctx.restore();
}

// ── Cables suspendidos del techo + bandejas portacables ───────────────────
// Réplica de la imagen de referencia: dos cables gruesos cuelgan del arco
// y convergen hacia el punto de fuga formando una "V invertida" abierta.
// A intervalos regulares aparecen ménsulas/colgadores que los sujetan al
// techo. La animación de profundidad (worldZ) hace que los colgadores
// "vengan hacia la cámara".
function _drawCeilingCables(ctx, vpX, vpY, archCY, maxR, cw, ch, worldZ) {
  // Los cables nacen en los bordes superiores del canvas y van al VP.
  // X de partida: a ±25 % del centro (la bóveda en la base llega más
  // afuera, pero el cable está colgado más adentro del techo).
  const baseLeftX  = vpX - cw * 0.26;
  const baseRightX = vpX + cw * 0.26;
  const baseY      = ch * 0.04;          // arrancan cerca del borde superior
  const farX       = vpX;                 // convergen exactos al VP
  const farY       = vpY + 2;

  ctx.save();
  // ── Cable IZQUIERDO ─────────────────────────────────────────────────────
  // Sombra en bóveda (tono más oscuro a la izquierda)
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth   = 4;
  ctx.beginPath(); ctx.moveTo(baseLeftX + 1, baseY + 2); ctx.lineTo(farX, farY); ctx.stroke();
  // Cable principal
  ctx.strokeStyle = '#0e0f12';
  ctx.lineWidth   = 3;
  ctx.beginPath(); ctx.moveTo(baseLeftX, baseY); ctx.lineTo(farX, farY); ctx.stroke();
  // Reflejo metálico tenue
  ctx.strokeStyle = 'rgba(120,130,140,0.25)';
  ctx.lineWidth   = 1;
  ctx.beginPath(); ctx.moveTo(baseLeftX - 0.5, baseY - 0.5); ctx.lineTo(farX, farY - 0.5); ctx.stroke();

  // ── Cable DERECHO ───────────────────────────────────────────────────────
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth   = 4;
  ctx.beginPath(); ctx.moveTo(baseRightX - 1, baseY + 2); ctx.lineTo(farX, farY); ctx.stroke();
  ctx.strokeStyle = '#0e0f12';
  ctx.lineWidth   = 3;
  ctx.beginPath(); ctx.moveTo(baseRightX, baseY); ctx.lineTo(farX, farY); ctx.stroke();
  ctx.strokeStyle = 'rgba(120,130,140,0.25)';
  ctx.lineWidth   = 1;
  ctx.beginPath(); ctx.moveTo(baseRightX + 0.5, baseY - 0.5); ctx.lineTo(farX, farY - 0.5); ctx.stroke();

  // ── Colgadores / ménsulas que sujetan los cables al techo ───────────────
  // Distribuidos por profundidad Z y animados con worldZ.
  const hangerGap = 130;
  const offset    = ((worldZ * 1.8) % hangerGap + hangerGap) % hangerGap;
  for (let z = 850; z >= 30; z -= hangerGap) {
    const zOff = z - offset;
    if (zOff <= 0) continue;
    const s = _persp(zOff);
    if (s < 0.05) continue;

    // Posición del colgador en cada cable (interpolando del VP a la base)
    const hxL = vpX + (baseLeftX  - vpX) * (1 - s);
    const hyL = vpY + (baseY      - vpY) * (1 - s);
    const hxR = vpX + (baseRightX - vpX) * (1 - s);
    const hyR = vpY + (baseY      - vpY) * (1 - s);

    // Tamaño del colgador escalado por perspectiva
    const w = Math.max(1, 4 * s);
    const h = Math.max(2, 14 * s);
    const alpha = 0.55 + s * 0.40;

    // Brazo vertical desde el techo al cable (izquierda)
    ctx.strokeStyle = `rgba(18,20,24,${alpha})`;
    ctx.lineWidth   = Math.max(1, s * 1.8);
    ctx.beginPath();
    ctx.moveTo(hxL, hyL - h);
    ctx.lineTo(hxL, hyL);
    ctx.stroke();
    // Pieza horizontal (T) de fijación
    ctx.fillStyle = `rgba(38,40,46,${alpha})`;
    ctx.fillRect(hxL - w, hyL - 1, w * 2, Math.max(1, s * 2));
    // Brazo + T (derecha)
    ctx.strokeStyle = `rgba(18,20,24,${alpha})`;
    ctx.beginPath();
    ctx.moveTo(hxR, hyR - h);
    ctx.lineTo(hxR, hyR);
    ctx.stroke();
    ctx.fillStyle = `rgba(38,40,46,${alpha})`;
    ctx.fillRect(hxR - w, hyR - 1, w * 2, Math.max(1, s * 2));
  }
  ctx.restore();
}

// ── Lámparas fluorescentes empotradas en el techo ─────────────────────────
// Paneles rectangulares mostrados por pares (izquierda/derecha del centro)
// suspendidos del arco. Cada panel tiene un halo blanco-amarillento que
// ilumina la bóveda a su alrededor. Animado con worldZ para que avancen
// hacia la cámara junto con los anillos del arco.
function _drawCeilingLights(ctx, vpX, vpY, archCY, maxR, cw, ch, worldZ, config) {
  const lightGap = 220;
  const offset   = ((worldZ * 1.8) % lightGap + lightGap) % lightGap;
  // Posición angular en el techo (en fracciones del canvas) — sobre la
  // bóveda, ligeramente fuera del eje central. Coincide con la foto donde
  // los fluorescentes cuelgan en dos hileras paralelas.
  const sides = [
    { xFrac: 0.20, yFrac: 0.40 },   // hilera izquierda (a media altura, mas cerca del suelo)
    { xFrac: 0.80, yFrac: 0.40 },   // hilera derecha (a media altura, mas cerca del suelo)
  ];

  ctx.save();
  for (let z = 880; z >= 25; z -= lightGap) {
    const zOff = z - offset;
    if (zOff <= 0) continue;
    const s     = _persp(zOff);
    if (s < 0.04) continue;
    const alpha = Math.min(1, s * 1.6) * 0.95;

    for (const { xFrac, yFrac } of sides) {
      // Posición en perspectiva: converge al VP cuando s → 0
      const wx = vpX + (cw * xFrac - vpX) * s;
      const wy = vpY + (ch * yFrac - vpY) * s;

      // Tamaño del panel — alargado horizontalmente como un fluorescente
      const pw = Math.max(3, 32 * s);
      const ph = Math.max(2, 9  * s);

      // Halo MUY discreto sobre la bóveda (foto de referencia: el tubo
      // brilla pero apenas tiñe el techo — un resplandor local y débil).
      const halo = ctx.createRadialGradient(wx, wy, 0, wx, wy, pw * 1.4);
      halo.addColorStop(0,   `rgba(240,235,210,${alpha * 0.18})`);
      halo.addColorStop(0.6, `rgba(220,215,190,${alpha * 0.06})`);
      halo.addColorStop(1,   'rgba(220,200,150,0)');
      ctx.fillStyle = halo;
      ctx.fillRect(wx - pw * 1.4, wy - pw * 1.4, pw * 2.8, pw * 2.8);

      // Soporte oscuro (carcasa del fluorescente)
      ctx.fillStyle = `rgba(18,20,24,${alpha})`;
      ctx.fillRect(wx - pw * 0.55, wy - ph * 0.6, pw * 1.10, ph * 1.6);

      // Tubo luminoso (núcleo blanco)
      const tubeGrad = ctx.createLinearGradient(wx, wy - ph / 2, wx, wy + ph / 2);
      tubeGrad.addColorStop(0,   `rgba(255,255,240,${alpha})`);
      tubeGrad.addColorStop(0.5, `rgba(255,255,255,${alpha})`);
      tubeGrad.addColorStop(1,   `rgba(255,245,210,${alpha})`);
      ctx.fillStyle = tubeGrad;
      ctx.fillRect(wx - pw / 2, wy - ph / 2, pw, ph);

      // Brillo central intenso
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.fillRect(wx - pw * 0.30, wy - ph * 0.20, pw * 0.60, ph * 0.40);
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

      // Tamaño del panel — INCREMENTADO (referencia foto: bombillas
      // grandes con halo intenso en la pared). Era 18×7, ahora 28×14.
      const pw = Math.max(3, 28 * s);
      const ph = Math.max(2, 14 * s);

      // Halo BLANCO BRILLANTE muy amplio (mancha de luz que ilumina la
      // pared de hormigón a su alrededor — efecto principal pedido)
      const halo2 = ctx.createRadialGradient(wx, wy, 0, wx, wy, pw * 6);
      halo2.addColorStop(0,   `rgba(255,250,230,${alpha * 0.55})`);
      halo2.addColorStop(0.3, `rgba(255,240,200,${alpha * 0.30})`);
      halo2.addColorStop(0.7, `rgba(255,225,160,${alpha * 0.08})`);
      halo2.addColorStop(1,   'rgba(255,200,80,0)');
      ctx.fillStyle = halo2;
      ctx.fillRect(wx - pw * 6, wy - pw * 6, pw * 12, pw * 12);

      // Caja oscura del aplique (montura)
      ctx.fillStyle = `rgba(20,22,26,${alpha})`;
      ctx.fillRect(wx - pw * 0.6, wy - ph, pw * 1.2, ph * 2.2);

      // Bombilla / lente luminosa (núcleo blanco-amarillento)
      const bulbGrad = ctx.createLinearGradient(wx, wy - ph / 2, wx, wy + ph / 2);
      bulbGrad.addColorStop(0,   `rgba(255,255,235,${alpha})`);
      bulbGrad.addColorStop(0.5, `rgba(255,248,220,${alpha})`);
      bulbGrad.addColorStop(1,   `rgba(255,235,180,${alpha})`);
      ctx.fillStyle = bulbGrad;
      ctx.fillRect(wx - pw / 2, wy - ph / 2, pw, ph);

      // Núcleo blanco intenso en el centro (filamento)
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.fillRect(wx - pw * 0.25, wy - ph * 0.25, pw * 0.5, ph * 0.5);
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
