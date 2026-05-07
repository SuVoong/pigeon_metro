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

  // 4b ── Bandejas portacables (señalización + fuerza) en ambas paredes ───
  //        Bandas metálicas horizontales a media altura del túnel que
  //        recorren toda la longitud — referencia: BANDEJA PORTACABLES
  //        del plano técnico (sección transversal).
  _drawSideCableTrays(ctx, vpX, vpY, archCY, maxR, cw, ch, worldZ);

  // 5 ── Suelo de la vía (hormigón gris oscuro tipo modo oscuro) ───────────
  //       Trapecio gris oscuro debajo de toda la zona de las dos vías,
  //       limitado al ancho del corredor de los raíles para no invadir
  //       el negro de las paredes.
  _drawTrackFloor(ctx, vpX, vpY, archCY, maxR, cw, ch, config);

  // 6 ── Raíles con durmientes ───────────────────────────────────────────────
  // Pasamos vpY explícito para que los raíles arranquen a la MISMA Y que en
  // EstacionBase (vpY + 8) y la transición túnel ↔ estación sea continua.
  _drawRails(ctx, vpX, vpY, archCY, cw, ch, worldZ, config);

  // 6c ── Canales laterales (drenaje + cableado) en esquinas pared↔suelo ──
  //        Réplica del CANAL LATERAL del plano: perfil en L con rejilla,
  //        ubicado en la esquina inferior de cada pared del túnel.
  _drawSideDrains(ctx, vpX, vpY, archCY, maxR, cw, ch, worldZ, config);

  // 6b ── (Aceras laterales de mantenimiento eliminadas a petición —
  //        los raíles se ven directamente sobre el balasto sin banqueta).

  // 7 ── Catenaria rígida (alimentación eléctrica) ──────────────────────────
  //       Dos barras horizontales rojas, una sobre el centro de cada vía,
  //       suspendidas del techo mediante anclajes triangulares — réplica
  //       del sistema de catenaria rígida del plano técnico (sustituye a
  //       los cables diagonales en V que había antes).
  _drawRigidCatenary(ctx, vpX, vpY, archCY, maxR, cw, ch, worldZ, config);

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

// ── Anillos del arco en perspectiva (dovelas segmentadas) ──────────────
// Cada anillo se compone de SEGMENTS paneles trapezoidales con juntas
// radiales visibles — réplica de las dovelas de hormigón prefabricado de
// los túneles modernos. Las juntas radiales convergen al centro del arco
// (archCY a esa profundidad) y dividen el semicírculo en partes iguales.
//
// Las BANDAS entre anillos consecutivos alternan color: gris oscuro / fondo
// natural / gris oscuro / fondo natural ... El color se ata a un índice de
// "anillo de mundo" que se mantiene estable cuando worldZ avanza, así un
// anillo que se acerca conserva su tono (no parpadea entre dark/light al
// cruzar la frontera de wrap del offset).
function _drawArchRings(ctx, vpX, archCY, maxR, cw, ch, worldZ) {
  const ringGap  = 100;
  const SEGMENTS = 8;     // dovelas por anillo (semicírculo) — referencia foto
  const offset   = ((worldZ * 1.8) % ringGap + ringGap) % ringGap;

  // 1 ── Pre-calcular todos los anillos visibles (de FAR a NEAR) ─────────
  // rings[0]   = más lejano (radio más pequeño)
  // rings[n-1] = más cercano (radio más grande, posiblemente mayor que maxR
  //              si ya cruzó la cámara — ver loop con zOff < 0).
  //
  // El loop incluye anillos con zOff < 0 (pasaron el plano de la cámara)
  // permitiendo que `s` crezca por encima de 1: el radio se hincha más allá
  // de maxR hasta que el anillo sale por completo del canvas. Así la
  // secuencia de arcos no se "corta" cuando uno cruza la cámara — el
  // siguiente continúa expandiéndose hasta perderse de vista.
  const VISIBLE_LIMIT = Math.max(cw, ch) * 1.4;   // radio máximo dibujable
  const rings = [];
  for (let z = 900; z >= -400; z -= ringGap) {
    const zOff = z - offset;
    // Perspectiva SIN clamp en zOff > 0 (formula original con max(z,1))
    // y permitiendo s > 1 cuando zOff <= 0. Para zOff <= -FOCAL la fórmula
    // explota — saltamos esos.
    if (zOff <= -FOCAL + 5) continue;
    const sDen = (zOff > 1) ? FOCAL + zOff : Math.max(1, FOCAL + zOff);
    const s   = FOCAL / sDen;
    const r   = maxR * s;
    if (r > VISIBLE_LIMIT) continue;          // demasiado grande, fuera de vista
    // cy2: para anillos cercanos (s ≥ 1) clampamos sCy2 al 1 para que el
    // centro no baje por debajo de archCY (evita que el anillo "siga
    // bajando" después de cruzar la cámara).
    const sCy2 = Math.min(s, 1);
    const cy2  = archCY * sCy2 + (archCY - maxR * 0.5) * (1 - sCy2);
    // Índice mundial del anillo: estable conforme worldZ avanza, así cada
    // anillo conserva su paridad mientras se acerca a la cámara.
    const worldRingIdx = Math.floor((worldZ * 1.8 + z) / ringGap);
    rings.push({ z, zOff, s, r, cy2, idx: worldRingIdx });
  }

  ctx.save();

  // 2 ── Bandas anulares alternadas entre anillos consecutivos ──────────
  // Para cada par (interior, exterior), si el índice del interior es par
  // se rellena la banda con gris oscuro (claramente visible sobre el
  // fondo casi-negro del túnel #08080d); si es impar se deja el fondo
  // natural mostrarse. Resultado: dark-gray / bg / dark-gray / bg ...
  // El RGB elegido (38,42,52) es ~4× más claro que el bg pero sigue
  // siendo gris oscuro — contraste visible sin romper la atmósfera.
  const BAND_DARK = 'rgba(38, 42, 52, ALPHA)';
  for (let i = 0; i < rings.length - 1; i++) {
    const inner = rings[i];
    const outer = rings[i + 1];
    if ((inner.idx % 2) !== 0) continue;       // banda "clara" → fondo natural

    const alpha = 0.78 + outer.s * 0.20;       // más opaca cerca del observador
    ctx.fillStyle = BAND_DARK.replace('ALPHA', alpha.toFixed(2));
    ctx.beginPath();
    // Disco exterior (sentido normal) + disco interior (sentido inverso)
    // → fill('evenodd') rellena solamente el área anular entre ambos.
    ctx.arc(vpX, outer.cy2, outer.r, 0, Math.PI * 2, false);
    ctx.arc(vpX, inner.cy2, inner.r, 0, Math.PI * 2, true);
    ctx.fill('evenodd');
  }

  // 3 ── Strokes de los anillos (juntas circulares, sombras y dovelas) ──
  for (const ring of rings) {
    const { s, r, cy2 } = ring;

    // Brillo proporcional a la cercanía
    const lum   = Math.round(28 + s * 22);
    const alpha = 0.55 + s * 0.35;

    // Trazo principal del anillo — grosor pesado para que las dovelas se
    // sientan claramente como bloques de hormigón macizo (antes 4.5,
    // ahora 7.5 → ~67 % más anchas en pantalla).
    ctx.strokeStyle = `rgba(${lum + 6},${lum + 6},${lum + 4},${alpha})`;
    ctx.lineWidth   = Math.max(1.5, s * 7.5);
    ctx.beginPath();
    ctx.arc(vpX, cy2, r, 0, Math.PI * 2);
    ctx.stroke();

    // Sombra interna (junta oscura del panel) — refuerza profundidad.
    // También engrosada para que la junta sea visible junto al anillo grueso.
    if (s > 0.25) {
      ctx.strokeStyle = `rgba(0,0,0,${0.32 + (1 - s) * 0.2})`;
      ctx.lineWidth   = Math.max(1.2, s * 3.8);
      ctx.beginPath();
      ctx.arc(vpX, cy2 + s * 1.5, r * 0.985, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Juntas RADIALES (entre dovelas) — sólo en anillos cercanos.
    if (s > 0.30) {
      const innerR = r * 0.92;     // las juntas no llegan al borde absoluto
      ctx.strokeStyle = `rgba(0,0,0,${0.32 + s * 0.20})`;
      ctx.lineWidth   = Math.max(0.5, s * 0.9);
      for (let k = 1; k < SEGMENTS; k++) {
        const ang = Math.PI + (Math.PI * k) / SEGMENTS;   // 180°→360° (semicírculo superior)
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
        for (let k = 0; k < SEGMENTS; k++) {
          const ang = Math.PI + (Math.PI * (k + 0.5)) / SEGMENTS;
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
const TRACK_INNER_RATIO_BASE = 0.05;    // antes 0.03 — vías más separadas para
                                        // dejar más zona de hormigón visible
                                        // alrededor del canal central de drenaje.
const TRACK_OUTER_RATIO_VP   = 0.018;
const TRACK_INNER_RATIO_VP   = 0.020;   // antes 0.015 — proporcional al cambio
                                        // de inner_base.

// Ancho de la rejilla central de drenaje — FIJO, independiente del ratio
// interior. Así al separar las vías la rejilla se mantiene del mismo
// tamaño y queda más "zona" de hormigón visible a sus lados.
const DRAIN_HALF_RATIO_BASE = 0.0165;   // = 0.03 × 0.55 (valor histórico)
const DRAIN_HALF_RATIO_VP   = 0.00825;  // = 0.015 × 0.55

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
  // Sistema de fijación directa: en lugar de traviesa continua, un pad
  // independiente por raíl con clips Pandrol (pestañas) a ambos lados. El
  // espacio interior entre carriles queda VACÍO. Las pestañas son las
  // que el usuario quiere ver claramente — bandas horizontales oscuras
  // pegadas al raíl.
  const numSleepers     = config.sleeperCount     ?? 24;
  const sleeperThickMul = config.sleeperThickness ?? 14;
  // Ancho del pad (lateral) relativo al rail: 1.8 = pad ~3.6× el ancho del
  // raíl → deja hueco generoso a cada lado para que las pestañas se vean.
  const padHalfWMul     = config.padHalfWidthMul ?? 1.8;
  const baseWForPads    = (config && config.railWidth) || 10;
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
  // baseW configurable desde config.railWidth (default 10). Determina el
  // grosor visual de cada carril; se escala internamente por las capas del
  // perfil 3D del UIC 60 (pie ancho marrón → cabeza pulida plateada).
  const baseW     = (config && config.railWidth) || 10;
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

// ── Suelo de la vía — trapecio con bordes laterales curvados ─────────────
// Cubre el corredor entre los carriles exteriores. Los bordes laterales se
// curvan HACIA AFUERA (siguiendo aproximadamente la curvatura del arco)
// para dar sensación de túnel redondo en vez de trapecio rígido. El centro
// queda plano para que las traviesas y rieles sigan tumbados como deben.
function _drawTrackFloor(ctx, vpX, vpY, archCY, maxR, cw, ch, config = {}) {
  const railTopY = vpY + 8;
  const railBotY = ch;
  // Ancho cubierto en la BASE plana del suelo. ANTES era 1.18 × outerRail,
  // dejando los bordes laterales pegados a los canales. Ahora 1.03 ×
  // (apenas cubre el raíl exterior + clip Pandrol) → el suelo se estrecha
  // notablemente en los extremos, dejando más pared visible y haciendo
  // que el bombeo central se sienta como un valle redondo.
  const outerBase = (config.trackOuterRatio ?? TRACK_OUTER_RATIO_BASE) * 1.03;
  const outerVP   = TRACK_OUTER_RATIO_VP * 1.03;
  const lBase = vpX - cw * outerBase;
  const rBase = vpX + cw * outerBase;
  const lVP   = vpX - cw * outerVP;
  const rVP   = vpX + cw * outerVP;

  // Punto de control de la curvatura lateral: a media altura entre VP y
  // base, desplazado hacia afuera siguiendo la mitad inferior del arco.
  // El control se acerca casi a la pared (0.95 × archHalfW) para que el
  // CENTRO bombee fuerte y los lados (top/bottom) queden estrechos.
  const midY = (railTopY + railBotY) / 2;
  const dyMid = midY - archCY;
  const archHalfWAtMid = Math.sqrt(Math.max(0, maxR * maxR - dyMid * dyMid));
  const ctrlR_x = vpX + archHalfWAtMid * 0.95;
  const ctrlL_x = vpX - archHalfWAtMid * 0.95;
  const ctrlY  = midY;

  // Helper: dibuja el path del suelo redondeado (top recto, lados curvos).
  const _floorPath = () => {
    ctx.beginPath();
    ctx.moveTo(lVP, railTopY);
    ctx.lineTo(rVP, railTopY);
    // Borde DERECHO curvado hacia la pared
    ctx.quadraticCurveTo(ctrlR_x, ctrlY, rBase, railBotY);
    ctx.lineTo(lBase, railBotY);
    // Borde IZQUIERDO curvado hacia la pared
    ctx.quadraticCurveTo(ctrlL_x, ctrlY, lVP, railTopY);
    ctx.closePath();
  };

  ctx.save();
  // Gradiente vertical (más oscuro hacia la cámara, ligero brillo central)
  const grad = ctx.createLinearGradient(0, railTopY, 0, railBotY);
  grad.addColorStop(0,   '#1c1f25');   // cerca del VP — gris oscuro suave
  grad.addColorStop(0.5, '#171a20');   // intermedio
  grad.addColorStop(1,   '#0d0f14');   // pegado a la cámara — más negro
  ctx.fillStyle = grad;
  _floorPath();
  ctx.fill();

  // ── Pendiente transversal del 2 % hacia los canales ──
  // Degradado horizontal asimétrico: la cresta central queda más clara,
  // los bordes (donde están los canales) más oscuros.
  const slopeGrad = ctx.createLinearGradient(ctrlL_x, 0, ctrlR_x, 0);
  slopeGrad.addColorStop(0.00, 'rgba(0,0,0,0.30)');
  slopeGrad.addColorStop(0.50, 'rgba(255,255,255,0.04)');
  slopeGrad.addColorStop(1.00, 'rgba(0,0,0,0.30)');
  ctx.fillStyle = slopeGrad;
  _floorPath();
  ctx.fill();
  ctx.restore();
}

// ── Canal de drenaje central (rejilla cuadriculada metálica) ─────────────
// Banda trapezoidal entre las dos vías SIN llegar a tocarlas. Cubierta
// con malla cuadriculada (filas × columnas) que se desplaza con worldZ.
// Tipo "trinchera con rejilla pisable" como en la foto de referencia.
function _drawCentralDrain(ctx, vpX, topY, botY, cw, worldZ, config = {}) {
  // Ancho del canal: FIJO (DRAIN_HALF_RATIO_*), no escala con el ratio
  // interior de las vías. Así al separar las vías el drenaje conserva
  // su tamaño y queda más zona de hormigón visible a sus lados.
  const halfBase  = cw * DRAIN_HALF_RATIO_BASE;
  const halfVP    = cw * DRAIN_HALF_RATIO_VP;

  ctx.save();

  // 1 ── Placa base de la rejilla (metal medio claro)
  ctx.fillStyle = '#3a3d44';
  ctx.beginPath();
  ctx.moveTo(vpX - halfVP,   topY);
  ctx.lineTo(vpX + halfVP,   topY);
  ctx.lineTo(vpX + halfBase, botY);
  ctx.lineTo(vpX - halfBase, botY);
  ctx.closePath();
  ctx.fill();

  // 2 ── Bordes laterales (relieve metálico claro)
  ctx.strokeStyle = 'rgba(150,158,170,0.95)';
  ctx.lineWidth   = 1.5;
  ctx.beginPath();
  ctx.moveTo(vpX - halfVP,   topY); ctx.lineTo(vpX - halfBase, botY);
  ctx.moveTo(vpX + halfVP,   topY); ctx.lineTo(vpX + halfBase, botY);
  ctx.stroke();

  // 3 ── Filas horizontales de huecos (animadas con worldZ) ─────────────
  const numRows = 38;
  const numCols = 3;                  // 3 columnas → barras verticales más anchas y visibles
  const rowOff  = ((worldZ * 0.0035) % (1 / numRows) + (1 / numRows)) % (1 / numRows);

  for (let i = 0; i < numRows; i++) {
    const baseT = i / (numRows - 1);
    const t = Math.pow(baseT + rowOff, 2);
    if (t <= 0 || t >= 1) continue;

    const sy    = (1 - t) * topY + t * botY;
    const halfW = (1 - t) * halfVP + t * halfBase;
    const usableW = halfW * 2 * 0.86;
    const startX  = vpX - usableW * 0.5;
    const colW    = usableW / numCols;
    const cellH   = Math.max(0.6, t * 3.4);
    const holeH   = Math.max(0.6, cellH * 0.78);
    const holeW   = Math.max(0.5, colW * 0.62);   // celdas más estrechas → barras visibles
    const alpha   = Math.min(1, t * 1.5 + 0.2);

    // Huecos oscuros (cells)
    ctx.fillStyle = `rgba(0,0,0,${Math.min(1, alpha + 0.25)})`;
    for (let c = 0; c < numCols; c++) {
      const cx = startX + colW * (c + 0.5);
      ctx.fillRect(cx - holeW * 0.5, sy - holeH * 0.5, holeW, holeH);
    }
    // Borde iluminado superior de la barra horizontal
    ctx.fillStyle = `rgba(180,188,200,${alpha * 0.75})`;
    ctx.fillRect(startX, sy - cellH * 0.5 - Math.max(0.5, cellH * 0.20), usableW, Math.max(0.5, cellH * 0.20));
  }

  // 4 ── Barras VERTICALES explícitas (3 líneas internas + 2 flancos)
  //      van del VP a la base con perspectiva, en color metálico claro.
  ctx.strokeStyle = 'rgba(170,178,190,0.85)';
  ctx.lineWidth   = 0.9;
  for (let c = 1; c < numCols; c++) {
    const fr = c / numCols;
    const xVP   = (vpX - halfVP   * 0.86) + (halfVP   * 2 * 0.86) * fr;
    const xBase = (vpX - halfBase * 0.86) + (halfBase * 2 * 0.86) * fr;
    ctx.beginPath();
    ctx.moveTo(xVP,   topY);
    ctx.lineTo(xBase, botY);
    ctx.stroke();
  }
  ctx.restore();
}

// ── Raíl UIC 60 con sección 3D (perfil de viga) ──────────────────────────
// Cada raíl se construye apilando capas paralelas a alturas distintas para
// simular el perfil real del UIC 60: pie ancho (foot) MARRÓN-ÓXIDO sobre
// el balasto, alma estrecha (web) más oscura y cabeza (head) plateada con
// brillo metálico. Réplica del raíl del plano técnico — color óxido en la
// parte baja por la oxidación natural del acero, cabeza pulida porque la
// rueda del tren la mantiene brillante.
function _drawRailLines(ctx, rails, topY, botY, color, baseW) {
  // Cada capa: { offY, w, color }
  //   offY  = desplazamiento Y respecto al baseline del raíl
  //   w     = multiplicador del ancho (baseW) en el extremo CERCANO
  //
  // Cada capa se dibuja como un trapecio: en la base (cerca de la cámara)
  // tiene el ancho completo, en el VP (lejano) se estrecha al FAR_TAPER.
  // Esto da la perspectiva natural de los raíles convergiendo a un punto
  // en la distancia — antes eran strokes de ancho constante y se veía
  // como si los raíles del fondo fueran igual de gruesos que los cercanos.
  const FAR_TAPER = 0.18;   // 18 % del ancho cercano al llegar al VP
  const layers = [
    { offY: +2.4, w: 2.4, c: 'rgba(0,0,0,0.60)' },            // sombra en solera
    { offY: +1.6, w: 2.0, c: '#5a3220' },                     // pie del raíl (oxido oscuro)
    { offY: +0.6, w: 1.55, c: '#7d4a2c' },                    // pie/alma transición (oxido)
    { offY: -0.2, w: 1.20, c: '#5e5a55' },                    // alma — gris cálido sucio
    { offY: -1.2, w: 1.10, c: '#8a8a8e' },                    // cabeza inferior — plateado oscuro
    { offY: -2.1, w: 0.92, c: '#c2c4c8' },                    // cabeza superior — plateado claro
    { offY: -2.7, w: 0.55, c: 'rgba(235,238,242,0.96)' },     // brillo metálico (cabeza pulida)
    { offY: -3.1, w: 0.22, c: 'rgba(255,255,255,0.90)' },     // especular blanco
  ];

  ctx.save();
  for (const rail of rails) {
    for (const L of layers) {
      const wNear = Math.max(0.5, baseW * L.w);
      const wFar  = Math.max(0.3, wNear * FAR_TAPER);
      const yFar  = topY + L.offY;
      const yNear = botY + L.offY;

      ctx.fillStyle = L.c;
      ctx.beginPath();
      // Trapecio: vértices del lado FAR (estrecho) y del lado NEAR (ancho).
      ctx.moveTo(rail.far  - wFar  / 2, yFar);
      ctx.lineTo(rail.far  + wFar  / 2, yFar);
      ctx.lineTo(rail.near + wNear / 2, yNear);
      ctx.lineTo(rail.near - wNear / 2, yNear);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.restore();
}

// ── Canales laterales de drenaje y cableado ──────────────────────────────
// Pequeñas trincheras con rejilla en las esquinas inferiores del túnel,
// donde la pared encuentra la solera. Réplica del CANAL LATERAL PARA
// CABLEADO Y DRENAJE del plano técnico. Se dibuja como una banda
// trapezoidal estrecha pegada al suelo, con cubierta de rejilla similar
// a la del canal central pero a menor escala.
function _drawSideDrains(ctx, vpX, vpY, archCY, maxR, cw, ch, worldZ, config = {}) {
  // Posición Y: pegado al borde inferior, igual extensión que los rieles.
  const topY = vpY + 8;
  const botY = ch;

  // Posición X: por FUERA del raíl exterior, dejando un pequeño hueco.
  // En la cámara: cerca del borde lateral del canvas. En el VP: justo
  // fuera del raíl exterior (TRACK_OUTER_RATIO_VP).
  const trackOuter = config.trackOuterRatio ?? TRACK_OUTER_RATIO_BASE;

  // Borde INTERIOR del canal (pegado al raíl exterior)
  const innerLBase = vpX - cw * trackOuter * 1.20;   // 20 % más hacia fuera
  const innerRBase = vpX + cw * trackOuter * 1.20;
  const innerLVP   = vpX - cw * TRACK_OUTER_RATIO_VP * 1.20;
  const innerRVP   = vpX + cw * TRACK_OUTER_RATIO_VP * 1.20;
  // Borde EXTERIOR del canal (pegado a la pared)
  const outerLBase = cw * 0.04;
  const outerRBase = cw * 0.96;
  const outerLVP   = vpX - cw * 0.025;
  const outerRVP   = vpX + cw * 0.025;

  ctx.save();

  for (const side of ['left', 'right']) {
    const innerBase = side === 'left' ? innerLBase : innerRBase;
    const outerBase = side === 'left' ? outerLBase : outerRBase;
    const innerVP   = side === 'left' ? innerLVP   : innerRVP;
    const outerVP   = side === 'left' ? outerLVP   : outerRVP;

    // 1 ── Placa base del canal (metal medio claro) ─────────────────────
    ctx.fillStyle = '#36393f';
    ctx.beginPath();
    ctx.moveTo(outerVP,   topY);
    ctx.lineTo(innerVP,   topY);
    ctx.lineTo(innerBase, botY);
    ctx.lineTo(outerBase, botY);
    ctx.closePath();
    ctx.fill();

    // 2 ── Bordes laterales (relieve metálico) ──────────────────────────
    // Borde EXTERIOR (canto contra la pared)
    ctx.strokeStyle = 'rgba(140, 148, 160, 0.85)';
    ctx.lineWidth   = 1.2;
    ctx.beginPath();
    ctx.moveTo(outerVP,   topY);
    ctx.lineTo(outerBase, botY);
    ctx.stroke();
    // Borde INTERIOR (canto contra el raíl)
    ctx.strokeStyle = 'rgba(120, 128, 140, 0.80)';
    ctx.lineWidth   = 1.0;
    ctx.beginPath();
    ctx.moveTo(innerVP,   topY);
    ctx.lineTo(innerBase, botY);
    ctx.stroke();

    // 3 ── Rejilla animada con worldZ (filas horizontales con ranuras) ──
    const numRows = 32;
    const rowOff  = ((worldZ * 0.0035) % (1 / numRows) + (1 / numRows)) % (1 / numRows);

    for (let i = 0; i < numRows; i++) {
      const baseT = i / (numRows - 1);
      const t = Math.pow(baseT + rowOff, 2);
      if (t <= 0 || t >= 1) continue;

      const sy   = (1 - t) * topY      + t * botY;
      const xIn  = (1 - t) * innerVP   + t * innerBase;
      const xOut = (1 - t) * outerVP   + t * outerBase;
      const w    = Math.abs(xIn - xOut);
      if (w < 1) continue;

      const cellH = Math.max(0.5, t * 2.8);
      const holeH = Math.max(0.4, cellH * 0.70);
      const usable = w * 0.78;
      const startX = side === 'left' ? Math.min(xIn, xOut) + (w - usable) * 0.5
                                      : Math.min(xIn, xOut) + (w - usable) * 0.5;
      const alpha = Math.min(1, t * 1.5 + 0.2);

      // Hueco oscuro central (1 sola columna estrecha — el canal es angosto)
      ctx.fillStyle = `rgba(0, 0, 0, ${Math.min(1, alpha + 0.25)})`;
      ctx.fillRect(startX, sy - holeH * 0.5, usable, holeH);

      // Borde superior iluminado de la barra horizontal
      ctx.fillStyle = `rgba(170, 178, 190, ${alpha * 0.65})`;
      ctx.fillRect(startX, sy - cellH * 0.5 - Math.max(0.4, cellH * 0.20),
                    usable, Math.max(0.4, cellH * 0.20));
    }
  }

  ctx.restore();
}

// ── Bandejas portacables laterales ───────────────────────────────────────
// Bandas metálicas horizontales en cada pared del túnel a media altura,
// que llevan los cables de señalización y fuerza. Réplica de la BANDEJA
// PORTACABLES del plano técnico. Se dibujan como trapecios estrechos en
// perspectiva (anchos en la cámara, casi un punto en el VP) con cables
// internos, soportes verticales periódicos animados con worldZ y bordes
// con highlight/sombra para sugerir el perfil en C de la bandeja real.
function _drawSideCableTrays(ctx, vpX, vpY, archCY, maxR, cw, ch, worldZ) {
  // Posición vertical de la bandeja: a media altura del túnel.
  const trayYBase = ch * 0.55;
  const trayYFar  = vpY + 6;

  // Grosor (alto) visible de la bandeja: notable en cámara, casi nada en VP.
  const trayHBase = 16;
  const trayHFar  = 1.8;

  // Posición X: pegada a la pared. En la cámara cerca del borde lateral,
  // en el VP convergiendo casi al centro.
  const baseL = cw * 0.05;
  const baseR = cw * 0.95;
  const farL  = vpX - cw * 0.014;
  const farR  = vpX + cw * 0.014;

  ctx.save();

  for (const [farX, baseX] of [[farL, baseL], [farR, baseR]]) {
    // 1 ── Cuerpo de la bandeja (interior oscuro, perfil en C) ────────────
    ctx.fillStyle = '#1f2127';
    ctx.beginPath();
    ctx.moveTo(farX,  trayYFar  - trayHFar  / 2);
    ctx.lineTo(baseX, trayYBase - trayHBase / 2);
    ctx.lineTo(baseX, trayYBase + trayHBase / 2);
    ctx.lineTo(farX,  trayYFar  + trayHFar  / 2);
    ctx.closePath();
    ctx.fill();

    // 2 ── Borde superior brillante (canto que recibe luz cenital) ────────
    ctx.strokeStyle = 'rgba(150, 156, 168, 0.9)';
    ctx.lineWidth   = 1.6;
    ctx.beginPath();
    ctx.moveTo(farX,  trayYFar  - trayHFar  / 2);
    ctx.lineTo(baseX, trayYBase - trayHBase / 2);
    ctx.stroke();

    // 3 ── Borde inferior con sombra ──────────────────────────────────────
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.lineWidth   = 1.2;
    ctx.beginPath();
    ctx.moveTo(farX,  trayYFar  + trayHFar  / 2);
    ctx.lineTo(baseX, trayYBase + trayHBase / 2);
    ctx.stroke();

    // 4 ── Cables internos (3 trazos longitudinales: rojo, gris, naranja) ─
    const cables = [
      { yFrac: -0.30, color: 'rgba(150, 35, 30, 0.75)',  w: 1.4 },   // rojo (fuerza)
      { yFrac:  0.00, color: 'rgba(80, 82, 90, 0.70)',   w: 1.2 },   // gris (señalización)
      { yFrac:  0.30, color: 'rgba(180, 130, 40, 0.70)', w: 1.2 },   // naranja (datos)
    ];
    for (const c of cables) {
      const cyFar  = trayYFar  + c.yFrac * trayHFar  * 0.8;
      const cyBase = trayYBase + c.yFrac * trayHBase * 0.8;
      ctx.strokeStyle = c.color;
      ctx.lineWidth   = c.w;
      ctx.beginPath();
      ctx.moveTo(farX,  cyFar);
      ctx.lineTo(baseX, cyBase);
      ctx.stroke();
    }

    // 5 ── Soportes verticales (ménsulas) animados con worldZ ─────────────
    const supportGap = 110;
    const offset = ((worldZ * 1.8) % supportGap + supportGap) % supportGap;
    for (let z = 800; z >= 30; z -= supportGap) {
      const zOff = z - offset;
      if (zOff <= 0) continue;
      const s = _persp(zOff);
      if (s < 0.10) continue;

      // X interpolada según s (1 = cámara, 0 = VP)
      const sx = vpX + (baseX - vpX) * (1 - (1 - s));   // = vpX + (baseX - vpX) * s
      const sy = vpY + (trayYBase - vpY) * (1 - (1 - s));
      const sw = Math.max(1, 2.4 * s);
      const sh = Math.max(2, ((1 - s) * trayHFar + s * trayHBase) * 1.25);
      const alpha = 0.5 + s * 0.4;
      ctx.fillStyle = `rgba(20, 22, 26, ${alpha})`;
      ctx.fillRect(sx - sw / 2, sy - sh / 2, sw, sh);
      // Punto de fijación a la pared (un poco a la derecha/izquierda del soporte)
      if (s > 0.30) {
        ctx.fillStyle = `rgba(80, 82, 90, ${alpha * 0.8})`;
        ctx.fillRect(sx - sw * 0.4, sy - sh / 2, sw * 0.8, Math.max(1, s * 1.2));
      }
    }
  }

  ctx.restore();
}

// ── Catenaria rígida (alimentación eléctrica de los trenes) ──────────────
// Dos barras horizontales rojas, una sobre el centro de cada vía,
// suspendidas del techo mediante anclajes triangulares regulares.
// Réplica del sistema CATENARIA RÍGIDA del plano técnico:
//   - Travesaño metálico horizontal en el techo que sostiene los anclajes.
//   - Triángulo invertido (dos brazos diagonales) que baja del travesaño
//     a la barra conductora.
//   - Barra roja paralela a las vías, ligeramente por debajo del techo,
//     centrada sobre el pantógrafo del tren.
function _drawRigidCatenary(ctx, vpX, vpY, archCY, maxR, cw, ch, worldZ, config = {}) {
  const trackOuter = config.trackOuterRatio ?? TRACK_OUTER_RATIO_BASE;
  const trackInner = config.trackInnerRatio ?? TRACK_INNER_RATIO_BASE;

  // Centro de cada vía (donde el pantógrafo del tren toca la barra).
  const leftCenterBase  = vpX - cw * (trackOuter + trackInner) / 2;
  const rightCenterBase = vpX + cw * (trackOuter + trackInner) / 2;
  const leftCenterVP    = vpX - cw * (TRACK_OUTER_RATIO_VP + TRACK_INNER_RATIO_VP) / 2;
  const rightCenterVP   = vpX + cw * (TRACK_OUTER_RATIO_VP + TRACK_INNER_RATIO_VP) / 2;

  // Y de la barra a la altura de la cámara: tocando la curva del arco a la
  // X de cada vía. Geometría del arco al s≈1 (anillo más cercano):
  //   r = maxR, cy2 = archCY ⇒ archY = archCY - sqrt(maxR² - dx²)
  // Pequeño offset (+2 px) para que la barra cuelgue de la cara interior
  // del anillo en vez de superponerse al trazo.
  const _archYAtX = (xBase) => {
    const dx = xBase - vpX;
    const dy = Math.sqrt(Math.max(0, maxR * maxR - dx * dx));
    return archCY - dy + 2;
  };
  const leftBaseY  = _archYAtX(leftCenterBase);
  const rightBaseY = _archYAtX(rightCenterBase);
  const farY       = vpY + 2;

  ctx.save();

  // ── Las dos barras conductoras (rojo de catenaria) ──
  for (const [farX, baseX, baseY] of [
    [leftCenterVP,  leftCenterBase,  leftBaseY],
    [rightCenterVP, rightCenterBase, rightBaseY],
  ]) {
    // Sombra proyectada en el techo (ligeramente desplazada hacia abajo)
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth   = 5;
    ctx.beginPath(); ctx.moveTo(farX, farY + 2); ctx.lineTo(baseX, baseY + 2); ctx.stroke();

    // Cuerpo principal de la barra — rojo oscuro tipo catenaria
    ctx.strokeStyle = '#9c1e15';
    ctx.lineWidth   = 4;
    ctx.beginPath(); ctx.moveTo(farX, farY); ctx.lineTo(baseX, baseY); ctx.stroke();

    // Banda intermedia (rojo más cálido)
    ctx.strokeStyle = '#c4382a';
    ctx.lineWidth   = 2.4;
    ctx.beginPath(); ctx.moveTo(farX, farY - 0.5); ctx.lineTo(baseX, baseY - 0.5); ctx.stroke();

    // Brillo superior (canto iluminado por las luces del túnel)
    ctx.strokeStyle = 'rgba(240, 120, 100, 0.9)';
    ctx.lineWidth   = 1;
    ctx.beginPath(); ctx.moveTo(farX, farY - 1.2); ctx.lineTo(baseX, baseY - 1.2); ctx.stroke();
  }

  // ── Anclajes triangulares colgados del techo curvo ──
  // Distribuidos por profundidad y animados con worldZ para que avancen
  // hacia la cámara junto con los anillos del arco.
  // - ay (apex del triángulo, donde agarra la barra): Y de la barra al
  //   depth s usando perspectiva normal (* s).
  // - ceilingY (base del triángulo, sobre el arco): Y de la curva del arco
  //   al depth s en la X de cada vía (geometría coincidente con
  //   _drawArchRings).
  const anchorGap = 130;
  const offset    = ((worldZ * 1.8) % anchorGap + anchorGap) % anchorGap;

  for (let z = 850; z >= 30; z -= anchorGap) {
    const zOff = z - offset;
    if (zOff <= 0) continue;
    const s = _persp(zOff);
    if (s < 0.05) continue;

    const alpha = 0.55 + s * 0.40;

    // Geometría del anillo del arco a esta profundidad (igual que
    // _drawArchRings): centro (vpX, cy2_s) y radio r_s.
    const r_s   = maxR * s;
    const cy2_s = archCY * s + (archCY - maxR * 0.5) * (1 - s);

    for (const [xBaseSide, baseY] of [
      [leftCenterBase,  leftBaseY],
      [rightCenterBase, rightBaseY],
    ]) {
      // X de la barra a esta profundidad (perspectiva, * s).
      const bx = vpX + (xBaseSide - vpX) * s;
      // Y de la barra a esta profundidad (perspectiva, * s).
      const ay = vpY + (baseY - vpY) * s;
      // Y del techo del arco a esa misma X (sigue la curva en perspectiva).
      const dx = bx - vpX;
      const dy = Math.sqrt(Math.max(0, r_s * r_s - dx * dx));
      const ceilingY = cy2_s - dy;

      // Brazos triangulares: dos diagonales del techo a la barra.
      const triHalfW = Math.max(2, 9 * s);
      ctx.strokeStyle = `rgba(40, 42, 48, ${alpha})`;
      ctx.lineWidth   = Math.max(1, s * 1.6);
      ctx.beginPath();
      ctx.moveTo(bx - triHalfW, ceilingY);
      ctx.lineTo(bx, ay);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(bx + triHalfW, ceilingY);
      ctx.lineTo(bx, ay);
      ctx.stroke();
      // Pinza/aislador donde el triángulo agarra la barra
      const clipW = Math.max(2, 5 * s);
      const clipH = Math.max(1, 2.5 * s);
      ctx.fillStyle = `rgba(60, 22, 18, ${alpha})`;
      ctx.fillRect(bx - clipW / 2, ay - clipH / 2, clipW, clipH);
    }
  }

  ctx.restore();
}

// ── Luminarias LED empotradas en los anclajes de la catenaria ────────────
// Paneles LED alargados montados JUNTO a cada anclaje triangular de la
// catenaria rígida (réplica de la LUMINARIA LED del plano técnico, que
// aparece anclada a la misma estructura del techo que sostiene la
// catenaria). Comparte cadencia (lightGap = anchorGap = 130) y posición
// angular con _drawRigidCatenary para quedar perfectamente alineados.
//
// IMPORTANTE: La Y de cada luminaria se calcula a partir de la GEOMETRÍA
// del arco (curva circular de radio maxR centrada en archCY) en la X y la
// profundidad concretas, así el panel siempre toca la cara interior del
// anillo — no flota a media altura.
function _drawCeilingLights(ctx, vpX, vpY, archCY, maxR, cw, ch, worldZ, config = {}) {
  // Mismas Z y mismo offset que la catenaria → cada luminaria queda
  // exactamente sobre un anclaje. Si se cambia el gap de la catenaria,
  // cambiar también éste.
  const lightGap = 130;
  const offset   = ((worldZ * 1.8) % lightGap + lightGap) % lightGap;

  // Las luminarias se sitúan a ambos lados del eje del túnel, alineadas con
  // las dos barras de la catenaria (centro de cada vía).
  const trackOuter = config.trackOuterRatio ?? TRACK_OUTER_RATIO_BASE;
  const trackInner = config.trackInnerRatio ?? TRACK_INNER_RATIO_BASE;
  const sides = [
    { xBase: vpX - cw * (trackOuter + trackInner) / 2 },
    { xBase: vpX + cw * (trackOuter + trackInner) / 2 },
  ];

  ctx.save();
  for (let z = 850; z >= 30; z -= lightGap) {
    const zOff = z - offset;
    if (zOff <= 0) continue;
    const s     = _persp(zOff);
    if (s < 0.05) continue;
    const alpha = Math.min(1, s * 1.6) * 0.95;

    // Geometría del anillo del arco a esta profundidad — coincide con
    // _drawArchRings (mismo r y cy2). La luminaria se monta colgada de la
    // cara interior del arco a la X de cada vía.
    const r   = maxR * s;
    const cy2 = archCY * s + (archCY - maxR * 0.5) * (1 - s);

    for (const { xBase } of sides) {
      // Posición en perspectiva: converge al VP cuando s → 0
      const wx = vpX + (xBase - vpX) * s;
      const dx = wx - vpX;
      // Y exactamente sobre la curva del arco a esa X (parte superior del
      // semicírculo). Si dx se sale del radio se clampa al borde.
      const dy = Math.sqrt(Math.max(0, r * r - dx * dx));
      // Pequeño offset hacia abajo (1.5 px escalado por s) para que el
      // panel quede "colgando" de la chapa interior del anillo en vez de
      // flotar exactamente sobre el trazo.
      const wy = cy2 - dy + Math.max(1, 1.5 * s);

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
