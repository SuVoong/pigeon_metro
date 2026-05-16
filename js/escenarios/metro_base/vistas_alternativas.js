// js/escenarios/metro_base/vistas_alternativas.js
// Renderers para perspectivas alternativas de la estación que el motor
// 2D principal NO soporta (solo dibuja la perspectiva central #1 con
// variaciones de cámara). Estas vistas son útiles para inspector/editor:
//
//   #3 — Desde la boca del túnel (perspectiva inversa)
//   #5 — Andén opuesto (vista lateral, mirando perpendicular al recorrido)
//   #8 — Corte longitudinal (plano arquitectónico 2D, vista lateral plana)
//   #9 — Corte transversal (plano arquitectónico 2D, vista frontal plana)
//
// Cada función es PURA: recibe ctx + bounds (x, y, w, h) + cfg y dibuja.
// No mantiene estado ni depende de canvas/state globales — pueden invocarse
// desde cualquier HTML que importe este módulo.
//
// Los cfg de colores se leen del DEFAULT_CONFIG de EstacionBase para que
// las vistas reflejen el aspecto real de la estación en gameplay.

// ── PALETA POR DEFECTO ────────────────────────────────────────────────────
// Coincide con el cfg de EstacionBase (commit fix_estacion). Si el usuario
// pasa un cfg parcial, completamos con estos defaults.
const DEFAULT_PAL = {
  // Andén
  platformColor:      '#A8A299',
  platformColorLight: '#B8B2A9',
  platformColorShade: '#7A746B',
  platformFrontColor: '#5A5550',
  platformFrontShade: '#3A3530',
  tactileBandColor:   '#F5C518',
  tactileBandShadow:  '#A88210',
  // Pared
  wallColor:          '#F2C42A',
  wallColorShade:     '#C99A18',
  // Techo
  ceilingColor:       '#9C9890',
  ceilingBandTop:     '#7A766E',
  // Iluminación
  fluorescentColor:   '#FFF8DC',
  // Friso
  friezeBgColor:      '#1A3A8A',
  friezeTextColor:    '#FFFFFF',
  // Foso/balasto
  ballastTop:         '#1c1f25',
  ballastBot:         '#0d0f14',
  // Riel
  railColor:          '#3A3F4A',
};

// Dimensiones reales (m) — del plano técnico Pueblo Nuevo (L5)
const DIM = {
  totalWidth:    12.20,   // ancho total de la estación
  fosoWidth:      9.40,   // ancho del foso (entre andenes)
  platformWidth:  1.40,   // ancho de cada andén (1.40 = 1.10 + bordillo)
  totalHeight:    5.60,   // altura total bóveda
  wallHeight:     3.80,   // altura útil pared (suelo andén → arranque bóveda)
  platformHeight: 0.90,   // altura del andén sobre el balasto
  bordilloDrop:   0.20,   // cara vertical visible del bordillo
  tactileBand:    0.30,   // ancho de la banda táctil (~30 cm)
};

const palette = (cfg) => ({ ...DEFAULT_PAL, ...(cfg || {}) });

// ════════════════════════════════════════════════════════════════════════
// #9 — CORTE TRANSVERSAL  (vista frontal plana, sin perspectiva)
// ════════════════════════════════════════════════════════════════════════
// Sección de la estación cortada perpendicular al avance del tren.
// Muestra de izquierda a derecha: pared izq, andén izq, foso (rieles),
// andén der, pared der.
//
// Las PROPORCIONES VERTICALES no derivan literalmente de DIM (donde el
// foso queda 16% del alto y se pierde a la vista) sino que se redistribuyen
// para enfatizar el foso ~50% del alto, alineándose con la lectura
// arquitectónica habitual de un corte transversal de metro:
//   ── arch  10%
//   ── wall  40%
//   ── foso  50%  (bordillo 35% + canal de drenaje 15%)
// Las cotas en metros son las reales (DIM.totalWidth/Height/fosoWidth).
export function drawCorteTransversal(ctx, x, y, w, h, cfg) {
  const P = palette(cfg);
  const D = DIM;

  const margin = 0.05;
  const drawW  = w * (1 - 2 * margin);
  const drawH  = h * (1 - 2 * margin);
  const sx     = drawW / D.totalWidth;
  const ox     = x + w * margin;
  const oy     = y + h * margin;
  const X      = (m) => ox + m * sx;

  // Bandas verticales (fracciones del drawH).
  const yArchTop  = oy + drawH * 0.00;
  const yArchBot  = oy + drawH * 0.10;     // arch = 10%
  const yWallTop  = yArchBot;
  const yWallBot  = oy + drawH * 0.50;     // wall = 40%, foso comienza al 50%
  const yPlatTop  = yWallBot;              // andén/foso top
  const yRailY    = oy + drawH * 0.85;     // rieles al 85% (bordillo de 35%)
  const yPlatBot  = oy + drawH * 1.00;     // foso floor / drenaje (15% bajo el rail)

  // ── 1. Fondo
  ctx.fillStyle = '#E8E4D8';
  ctx.fillRect(x, y, w, h);

  // ── 2. Bóveda abovedada
  ctx.fillStyle = P.ceilingColor;
  ctx.beginPath();
  ctx.moveTo(X(0), yArchBot);
  ctx.quadraticCurveTo(X(D.totalWidth / 2), yArchTop,
                       X(D.totalWidth),     yArchBot);
  ctx.lineTo(X(D.totalWidth), yArchTop);
  ctx.lineTo(X(0),            yArchTop);
  ctx.closePath();
  ctx.fill();

  // ── 3. Paredes amarillas laterales
  ctx.fillStyle = P.wallColor;
  ctx.fillRect(X(0), yWallTop,
               X(D.platformWidth) - X(0), yWallBot - yWallTop);
  ctx.fillRect(X(D.totalWidth - D.platformWidth), yWallTop,
               X(D.totalWidth) - X(D.totalWidth - D.platformWidth),
               yWallBot - yWallTop);

  // ── 4. Friso azul "NOMBRE" en la parte alta de cada pared
  const wallH    = yWallBot - yWallTop;
  const friezeTop = yWallTop + wallH * 0.10;
  const friezeBot = yWallTop + wallH * 0.30;
  const friezeH   = friezeBot - friezeTop;
  ctx.fillStyle = P.friezeBgColor;
  ctx.fillRect(X(0), friezeTop, X(D.platformWidth) - X(0), friezeH);
  ctx.fillRect(X(D.totalWidth - D.platformWidth), friezeTop,
               X(D.totalWidth) - X(D.totalWidth - D.platformWidth), friezeH);
  ctx.fillStyle = P.friezeTextColor;
  const wallSegPx = D.platformWidth * sx;
  ctx.font = `bold ${Math.max(7, Math.min(wallSegPx * 0.35, friezeH * 0.55))}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const friezeMidY = (friezeTop + friezeBot) / 2;
  ctx.fillText('NOMBRE', X(D.platformWidth / 2),                friezeMidY);
  ctx.fillText('NOMBRE', X(D.totalWidth - D.platformWidth / 2), friezeMidY);

  // ── 5. ANDENES (bloques laterales sólidos): desde wallBot HASTA el suelo
  //      del foso. Su cara superior es donde se camina, la cara interior
  //      (junto al foso) es el bordillo (paso 7).
  ctx.fillStyle = P.platformColor;
  ctx.fillRect(X(0), yPlatTop,
               X(D.platformWidth) - X(0), yPlatBot - yPlatTop);
  ctx.fillRect(X(D.totalWidth - D.platformWidth), yPlatTop,
               X(D.totalWidth) - X(D.totalWidth - D.platformWidth),
               yPlatBot - yPlatTop);

  // ── 6. Banda táctil amarilla (superficie superior, ~30 cm)
  const bandH = Math.max(3, drawH * 0.012);
  ctx.fillStyle = P.tactileBandColor;
  ctx.fillRect(X(D.platformWidth - D.tactileBand), yPlatTop,
               D.tactileBand * sx, bandH);
  ctx.fillRect(X(D.totalWidth - D.platformWidth), yPlatTop,
               D.tactileBand * sx, bandH);

  // ── 7. FOSO (balasto) entre andenes — desde plat top HASTA suelo del foso
  //      (drenaje). Visualmente ocupa ~50 % del alto, "más abajo" como pide
  //      la lectura arquitectónica del corte.
  const fosoLeft  = D.platformWidth;
  const fosoRight = D.totalWidth - D.platformWidth;
  const fosoGrad = ctx.createLinearGradient(0, yPlatTop, 0, yPlatBot);
  fosoGrad.addColorStop(0,   P.ballastTop);
  fosoGrad.addColorStop(0.7, P.ballastBot);
  fosoGrad.addColorStop(1,   '#06080E');   // drenaje en sombra absoluta
  ctx.fillStyle = fosoGrad;
  ctx.fillRect(X(fosoLeft), yPlatTop,
               X(fosoRight) - X(fosoLeft),
               yPlatBot - yPlatTop);

  // ── 8. BORDILLO — cara vertical INTERNA del andén (lado del foso),
  //      desde plat top hasta el rail level. Aquí es donde se ve el
  //      "drop" del andén al foso. Color frente más oscuro para separarlo
  //      visualmente del balasto.
  const bordilloW = Math.max(2, sx * 0.12);
  ctx.fillStyle = P.platformFrontColor;
  ctx.fillRect(X(D.platformWidth) - bordilloW, yPlatTop,
               bordilloW, yRailY - yPlatTop);
  ctx.fillRect(X(D.totalWidth - D.platformWidth), yPlatTop,
               bordilloW, yRailY - yPlatTop);
  // Sombra de junta (línea más oscura en el pie del bordillo) para reforzar
  // el plano de transición bordillo→drenaje.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(X(D.platformWidth) - bordilloW, yRailY - 2,
               bordilloW + 2, 2);
  ctx.fillRect(X(D.totalWidth - D.platformWidth) - 2, yRailY - 2,
               bordilloW + 2, 2);

  // ── 9. Rieles (4 rieles, 2 vías) sobre el balasto, a la altura del rail
  ctx.fillStyle = P.railColor;
  const railSep = 1.435;                      // ancho de vía estándar (m)
  const fosoMid = (fosoLeft + fosoRight) / 2;
  const lane1L = fosoMid - railSep / 2 - railSep * 0.7;
  const lane1R = fosoMid - railSep / 2 + railSep * 0.3;
  const lane2L = fosoMid + railSep / 2 - railSep * 0.3;
  const lane2R = fosoMid + railSep / 2 + railSep * 0.7;
  const railH = Math.max(3, drawH * 0.018);
  for (const rx of [lane1L, lane1R, lane2L, lane2R]) {
    ctx.fillRect(X(rx) - 2, yRailY - railH, 4, railH);
  }

  // ── 10. Cotas reales (los textos siguen mostrando metros del DIM)
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `bold ${Math.max(9, drawH * 0.025)}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Cota foso (centrada en la zona del balasto, encima de los rieles)
  const fosoLabelY = (yPlatTop + yRailY) / 2;
  ctx.fillText(`FOSO ${D.fosoWidth.toFixed(2)} m`,
               X(D.totalWidth / 2), fosoLabelY);

  ctx.fillStyle = '#222';
  ctx.fillText(`Ancho total ${D.totalWidth.toFixed(2)} m`,
               X(D.totalWidth / 2), oy + drawH - drawH * 0.025);

  ctx.save();
  ctx.translate(X(0.35), (yArchTop + yPlatBot) / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = '#222';
  ctx.fillText(`Alto ${D.totalHeight.toFixed(2)} m`, 0, 0);
  ctx.restore();
}

// ════════════════════════════════════════════════════════════════════════
// #8 — CORTE LONGITUDINAL  (vista lateral plana, a lo largo del andén)
// ════════════════════════════════════════════════════════════════════════
// Sección de la estación cortada paralelo al avance del tren. Muestra
// el andén lateralmente con su pared (friso + puertas), el bordillo, el
// balasto y un riel longitudinal.
export function drawCorteLongitudinal(ctx, x, y, w, h, cfg) {
  const P = palette(cfg);
  const D = DIM;

  // Largo visible del andén ~30 m (estación corta) a la escala que entre
  const lenM = 30.0;
  const margin = 0.05;
  const drawW = w * (1 - 2 * margin);
  const drawH = h * (1 - 2 * margin);
  const sx = drawW / lenM;
  const sy = drawH / D.totalHeight;
  const ox = x + w * margin;
  const oy = y + h * margin;
  const X = (m) => ox + m * sx;
  const Y = (m) => oy + m * sy;

  // 1. Fondo
  ctx.fillStyle = '#F8F6F0';
  ctx.fillRect(x, y, w, h);

  // 2. Bóveda (arco lateral)
  const archH = D.totalHeight - D.wallHeight - D.platformHeight;
  ctx.fillStyle = P.ceilingColor;
  ctx.beginPath();
  ctx.moveTo(X(0), Y(archH));
  ctx.quadraticCurveTo(X(lenM / 2), Y(-archH * 0.5),
                       X(lenM),     Y(archH));
  ctx.lineTo(X(lenM), Y(archH));
  ctx.lineTo(X(0),    Y(archH));
  ctx.closePath();
  ctx.fill();

  // 3. Pared amarilla
  const wallTop = archH;
  const wallBot = archH + D.wallHeight;
  ctx.fillStyle = P.wallColor;
  ctx.fillRect(X(0), Y(wallTop), drawW, Y(wallBot) - Y(wallTop));

  // 4. Friso azul con "NOMBRE ESTACIÓN" repetido a lo largo
  const friezeTop = wallTop + 0.20;
  const friezeBot = wallTop + 0.85;
  ctx.fillStyle = P.friezeBgColor;
  ctx.fillRect(X(0), Y(friezeTop), drawW, Y(friezeBot) - Y(friezeTop));
  ctx.fillStyle = P.friezeTextColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const friezeMidY = Y((friezeTop + friezeBot) / 2);
  // 4 repeticiones que se distribuyen sin solaparse ni desbordar.
  // "NOMBRE ESTACIÓN" ≈ 16 chars; cada copia dispone de drawW/4 px.
  // Acotamos el font para que el texto ocupe ≤ 80 % del segmento.
  const REPS = 4;
  const segPx = drawW / REPS;
  const fontPx = Math.max(8, Math.min(segPx * 0.10, sy * 0.30));
  ctx.font = `bold ${fontPx}px monospace`;
  for (let i = 0; i < REPS; i++) {
    const t = (i + 0.5) / REPS;
    ctx.fillText('NOMBRE ESTACIÓN', ox + drawW * t, friezeMidY);
  }

  // 5. Puertas de mantenimiento distribuidas (cada 4 m, 1.50 m de altura)
  const doorTop = wallTop + 1.10;
  const doorBot = wallBot - 0.20;
  ctx.fillStyle = P.wallColorShade;
  for (let m = 4; m < lenM; m += 4) {
    ctx.fillRect(X(m - 0.5), Y(doorTop),
                 1.0 * sx, Y(doorBot) - Y(doorTop));
    // Marco más oscuro
    ctx.strokeStyle = '#7a5e10';
    ctx.lineWidth = 1;
    ctx.strokeRect(X(m - 0.5), Y(doorTop),
                   1.0 * sx, Y(doorBot) - Y(doorTop));
  }

  // 6. Andén (lateral)
  const platformTop = wallBot;
  const platformBot = wallBot + D.platformHeight;
  ctx.fillStyle = P.platformColor;
  ctx.fillRect(X(0), Y(platformTop), drawW,
               Y(platformBot) - Y(platformTop));

  // 7. Banda táctil amarilla (línea horizontal continua en el borde)
  ctx.fillStyle = P.tactileBandColor;
  ctx.fillRect(X(0), Y(platformTop), drawW, Math.max(2, sy * 0.08));

  // 8. Bordillo (cara vertical, fina)
  ctx.fillStyle = P.platformFrontColor;
  ctx.fillRect(X(0), Y(platformTop) + Math.max(2, sy * 0.08),
               drawW, D.bordilloDrop * sy * 0.5);

  // 9. Foso/balasto debajo
  const fosoGrad = ctx.createLinearGradient(0, Y(platformTop), 0, Y(D.totalHeight));
  fosoGrad.addColorStop(0, P.ballastTop);
  fosoGrad.addColorStop(1, P.ballastBot);
  ctx.fillStyle = fosoGrad;
  ctx.fillRect(X(0), Y(platformTop) + D.bordilloDrop * sy,
               drawW, Y(D.totalHeight) - Y(platformTop) - D.bordilloDrop * sy);

  // 10. Riel longitudinal
  ctx.fillStyle = P.railColor;
  ctx.fillRect(X(0), Y(D.totalHeight - 0.2), drawW, Math.max(2, sy * 0.10));

  // 11. Cotas
  ctx.fillStyle = '#222';
  ctx.font = `${Math.max(8, sy * 0.18)}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(`${lenM.toFixed(0)} m de andén (vista parcial)`,
               X(lenM / 2), Y(D.totalHeight) + 14);
}

// ════════════════════════════════════════════════════════════════════════
// #3 — DESDE LA BOCA DEL TÚNEL  (perspectiva inversa)
// ════════════════════════════════════════════════════════════════════════
// La cámara está al final del túnel mirando hacia el andén. La estación
// se ve "lejana" enmarcada por el arco oscuro del túnel. Los andenes y
// rieles convergen al fondo (efecto telescópico inverso).
export function drawDesdeBocaTunel(ctx, x, y, w, h, cfg) {
  const P = palette(cfg);

  // 1. Fondo negro (interior del túnel cercano a la cámara)
  ctx.fillStyle = '#0a0a0e';
  ctx.fillRect(x, y, w, h);

  // 2. Punto al fondo donde se ve la estación pequeña
  const cx = x + w / 2;
  const cy = y + h * 0.50;
  const stationW = w * 0.45;       // estación al fondo más pequeña
  const stationH = h * 0.55;
  const sx = cx - stationW / 2;
  const sy = cy - stationH / 2;

  // 3. Halo de luz desde la estación (efecto telescopio)
  const halo = ctx.createRadialGradient(cx, cy, 10, cx, cy, w * 0.6);
  halo.addColorStop(0,   'rgba(255, 240, 200, 0.20)');
  halo.addColorStop(0.4, 'rgba(60, 50, 30, 0.10)');
  halo.addColorStop(1,   'rgba(0, 0, 0, 0)');
  ctx.fillStyle = halo;
  ctx.fillRect(x, y, w, h);

  // 4. Marco del arco del túnel (cerca de la cámara, ocupa los bordes)
  ctx.fillStyle = '#0a0a0e';
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath();
  // Corte interior con forma de boca de túnel (rectángulo redondeado abajo,
  // arco arriba)
  const r = stationW * 0.12;
  ctx.moveTo(sx + r, sy);
  ctx.lineTo(sx + stationW - r, sy);
  ctx.quadraticCurveTo(sx + stationW, sy,
                       sx + stationW, sy + r);
  ctx.lineTo(sx + stationW, sy + stationH);
  ctx.lineTo(sx,            sy + stationH);
  ctx.lineTo(sx,            sy + r);
  ctx.quadraticCurveTo(sx, sy, sx + r, sy);
  ctx.fill('evenodd');

  // 5. Marco del arco con borde claro (perfil del hormigón)
  ctx.strokeStyle = '#3a3530';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(sx, sy + stationH);
  ctx.lineTo(sx, sy + r);
  ctx.quadraticCurveTo(sx, sy, sx + r, sy);
  ctx.lineTo(sx + stationW - r, sy);
  ctx.quadraticCurveTo(sx + stationW, sy,
                       sx + stationW, sy + r);
  ctx.lineTo(sx + stationW, sy + stationH);
  ctx.stroke();

  // 6. Estación al fondo (mini-render en perspectiva): paredes amarillas,
  //    andén con su BORDILLO visible (cara vertical oscura del andén que
  //    cae al foso), suelo del foso con rieles. La cámara está dentro del
  //    túnel a la altura del rail, mirando hacia la estación lejana.
  const innerX = sx + 4, innerY = sy + 4;
  const innerW = stationW - 8, innerH = stationH - 8;

  // Niveles verticales del mini-render:
  //   0..30%   : techo (bóveda + parte alta de pared)
  //   30..55%  : pared con friso azul
  //   55%      : ANDÉN TOP (línea horizontal donde está la banda táctil)
  //   55..75%  : BORDILLO (cara vertical oscura, slanted en perspectiva
  //              porque converge al fondo)
  //   75..100% : FOSO floor con rieles
  const yPlatTop   = innerY + innerH * 0.55;
  const yFosoFloor = innerY + innerH * 0.75;     // rail level / pie del bordillo
  const yBottom    = innerY + innerH;

  // Inner X edges del andén — convergen al fondo por perspectiva inversa.
  // Cerca de la cámara (yFosoFloor): andén ocupa 0..40 % y 60..100 %.
  // Lejos (yPlatTop): andén ocupa 0..30 % y 70..100 %.
  const xLI_far  = innerX + innerW * 0.30;       // izq inner (lejos)
  const xLI_near = innerX + innerW * 0.40;       // izq inner (cerca)
  const xRI_far  = innerX + innerW * 0.70;       // der inner (lejos)
  const xRI_near = innerX + innerW * 0.60;       // der inner (cerca)

  // 6a. Suelo del foso (balasto) — gradiente vertical
  const fosoGrad = ctx.createLinearGradient(0, yPlatTop, 0, yBottom);
  fosoGrad.addColorStop(0, P.ballastTop);
  fosoGrad.addColorStop(1, P.ballastBot);
  ctx.fillStyle = fosoGrad;
  ctx.fillRect(innerX, yPlatTop, innerW, yBottom - yPlatTop);

  // 6b. Andenes laterales TOP — trapezoides horizontales que se apoyan
  //     sobre el bordillo. La cara superior va de yPlatTop a yFosoFloor
  //     (la profundidad visual del andén en perspectiva).
  ctx.fillStyle = P.platformColor;
  // Izq
  ctx.beginPath();
  ctx.moveTo(innerX,    yPlatTop);
  ctx.lineTo(xLI_far,   yPlatTop);
  ctx.lineTo(xLI_near,  yFosoFloor);
  ctx.lineTo(innerX,    yFosoFloor);
  ctx.closePath();
  ctx.fill();
  // Der (espejo)
  ctx.beginPath();
  ctx.moveTo(innerX + innerW, yPlatTop);
  ctx.lineTo(xRI_far,         yPlatTop);
  ctx.lineTo(xRI_near,        yFosoFloor);
  ctx.lineTo(innerX + innerW, yFosoFloor);
  ctx.closePath();
  ctx.fill();

  // 6c. BORDILLO — cara vertical OSCURA del andén que cae al foso.
  //     Va desde la línea de andén top (yPlatTop) hasta el suelo del foso
  //     (yBottom), conectando visualmente el andén con el balasto. Es lo
  //     que faltaba: el "drop" visible entre andén y rieles.
  ctx.fillStyle = P.platformFrontColor;
  // Izq: parallelograma slanted — top en (xLI_far, yPlatTop) y se ensancha
  // hacia la cámara (xLI_near, yFosoFloor), continúa recto al fondo.
  ctx.beginPath();
  ctx.moveTo(xLI_far,        yPlatTop);
  ctx.lineTo(xLI_near,        yFosoFloor);
  ctx.lineTo(xLI_near,        yBottom);
  ctx.lineTo(xLI_far - innerW * 0.02, yBottom);
  ctx.closePath();
  ctx.fill();
  // Der (espejo)
  ctx.beginPath();
  ctx.moveTo(xRI_far,        yPlatTop);
  ctx.lineTo(xRI_near,        yFosoFloor);
  ctx.lineTo(xRI_near,        yBottom);
  ctx.lineTo(xRI_far + innerW * 0.02, yBottom);
  ctx.closePath();
  ctx.fill();
  // Sombra de junta (línea fina más oscura) en la unión bordillo↔foso floor
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(innerX,            yFosoFloor - 1, innerW, 1);

  // 6d. Banda táctil amarilla justo en el borde superior del andén/bordillo
  ctx.fillStyle = P.tactileBandColor;
  // Izq: del 0 al inner edge (xLI_far) sobre yPlatTop
  ctx.fillRect(innerX,        yPlatTop,
               xLI_far - innerX, Math.max(1, innerH * 0.018));
  // Der
  ctx.fillRect(xRI_far,       yPlatTop,
               innerX + innerW - xRI_far, Math.max(1, innerH * 0.018));

  // 6e. Rieles sobre el foso floor (paralelos a la dirección de avance)
  ctx.fillStyle = P.railColor;
  const railHmini = Math.max(1, innerH * 0.012);
  ctx.fillRect(xLI_near + innerW * 0.02, yFosoFloor + 2,
               (xRI_near - xLI_near) - innerW * 0.04, railHmini);
  ctx.fillRect(xLI_near + innerW * 0.06, yFosoFloor + innerH * 0.05,
               (xRI_near - xLI_near) - innerW * 0.12, railHmini);

  // 6f. Paredes amarillas laterales (encima del andén)
  ctx.fillStyle = P.wallColor;
  ctx.fillRect(innerX,    innerY,
               innerW * 0.30, yPlatTop - innerY);
  ctx.fillRect(innerX + innerW * 0.70, innerY,
               innerW * 0.30, yPlatTop - innerY);

  // 6g. Friso azul en cada pared
  ctx.fillStyle = P.friezeBgColor;
  ctx.fillRect(innerX,                 innerY + innerH * 0.10,
               innerW * 0.30,          innerH * 0.10);
  ctx.fillRect(innerX + innerW * 0.70, innerY + innerH * 0.10,
               innerW * 0.30,          innerH * 0.10);

  // 6h. Techo abovedado central (entre paredes)
  ctx.fillStyle = P.ceilingColor;
  ctx.fillRect(innerX + innerW * 0.30, innerY,
               innerW * 0.40,          innerH * 0.30);

  // 7. Etiqueta esquina inferior con la nota explicativa
  ctx.fillStyle = '#FFCC00';
  ctx.font = `bold ${Math.max(9, h * 0.025)}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('VISTA DESDE BOCA DEL TÚNEL',
               x + w / 2, y + h - h * 0.12);
  ctx.font = `${Math.max(8, h * 0.022)}px monospace`;
  ctx.fillStyle = '#888';
  ctx.fillText('(perspectiva inversa — la estación queda enmarcada por el túnel)',
               x + w / 2, y + h - h * 0.07);
}

// ════════════════════════════════════════════════════════════════════════
// #5 — ANDÉN OPUESTO  (vista lateral, mirando perpendicular al recorrido)
// ════════════════════════════════════════════════════════════════════════
// La cámara está en uno de los andenes mirando al opuesto a través del
// foso. Lo que se ve: pared del fondo (pared LATERAL del túnel del lado
// opuesto, vista desde dentro) + andén opuesto en primer plano.
//
// Sin puertas en la pared del fondo (las puertas viven en las paredes
// laterales del túnel — quedan a izq/der del observador, fuera del cuadro).
export function drawAndenOpuesto(ctx, x, y, w, h, cfg) {
  const P = palette(cfg);
  const D = DIM;

  // 1. Fondo
  ctx.fillStyle = '#F8F6F0';
  ctx.fillRect(x, y, w, h);

  // 2. Layout vertical (sin perspectiva fuerte — proyección lateral plana
  //    con muy ligera fuga horizontal)
  const margin = 0.04;
  const ox = x + w * margin;
  const oy = y + h * margin;
  const drawW = w * (1 - 2 * margin);
  const drawH = h * (1 - 2 * margin);

  const yArchTop  = oy + drawH * 0.00;
  const yWallTop  = oy + drawH * 0.20;
  const yPlatTop  = oy + drawH * 0.55;
  const yBordBot  = oy + drawH * 0.62;
  const yFosoBot  = oy + drawH * 1.00;

  // 3. Bóveda abovedada al fondo (solo curva superior visible)
  ctx.fillStyle = P.ceilingColor;
  ctx.beginPath();
  ctx.moveTo(ox, yArchTop);
  ctx.lineTo(ox + drawW, yArchTop);
  ctx.lineTo(ox + drawW, yWallTop);
  ctx.quadraticCurveTo(ox + drawW / 2, yArchTop - drawH * 0.05,
                       ox,             yWallTop);
  ctx.closePath();
  ctx.fill();

  // 4. Pared amarilla del fondo (continua, sin puertas)
  ctx.fillStyle = P.wallColor;
  ctx.fillRect(ox, yWallTop, drawW, yPlatTop - yWallTop);

  // 5. Friso azul en la parte alta de la pared, con "NOMBRE ESTACIÓN"
  //    repetido (efecto de perspectiva muy suave: copias más cerca son
  //    ligeramente más grandes).
  const friezeTop = yWallTop + (yPlatTop - yWallTop) * 0.10;
  const friezeBot = yWallTop + (yPlatTop - yWallTop) * 0.40;
  ctx.fillStyle = P.friezeBgColor;
  ctx.fillRect(ox, friezeTop, drawW, friezeBot - friezeTop);
  ctx.fillStyle = P.friezeTextColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const friezeMidY = (friezeTop + friezeBot) / 2;
  // Acotamos el font para que tres repeticiones quepan SIN desbordar.
  // Con 3 copias y "NOMBRE ESTACIÓN" (~16 chars), cada copia dispone de
  // drawW/3 ≈ 200 px → font ~10 px máx para encajar con margen.
  const REPS = 3;
  const segPx = drawW / REPS;
  const friezeFont = Math.max(8, Math.min((friezeBot - friezeTop) * 0.55,
                                           segPx * 0.10));
  ctx.font = `bold ${friezeFont}px monospace`;
  for (let i = 0; i < REPS; i++) {
    const t = (i + 0.5) / REPS;
    ctx.fillText('NOMBRE ESTACIÓN', ox + drawW * t, friezeMidY);
  }

  // 6. Sombra rodapié pared↔suelo
  ctx.fillStyle = P.platformFrontColor;
  ctx.fillRect(ox, yPlatTop - 3, drawW, 3);

  // 7. Andén opuesto (suelo claro, con banda táctil amarilla en el borde)
  ctx.fillStyle = P.platformColor;
  ctx.fillRect(ox, yPlatTop, drawW, yBordBot - yPlatTop);
  // Banda táctil en el borde frontal (lado del foso)
  ctx.fillStyle = P.tactileBandColor;
  ctx.fillRect(ox, yBordBot - 4, drawW, 4);

  // 8. Bordillo (cara vertical fina)
  ctx.fillStyle = P.platformFrontColor;
  ctx.fillRect(ox, yBordBot, drawW, drawH * 0.04);

  // 9. Foso en primer plano (cerca del observador): balasto oscuro con
  //    un riel visible cerca del borde inferior (el riel de la vía cercana).
  const fosoGrad = ctx.createLinearGradient(0, yBordBot, 0, yFosoBot);
  fosoGrad.addColorStop(0, P.ballastTop);
  fosoGrad.addColorStop(1, P.ballastBot);
  ctx.fillStyle = fosoGrad;
  ctx.fillRect(ox, yBordBot + drawH * 0.04, drawW,
               yFosoBot - yBordBot - drawH * 0.04);

  // 10. Riel paralelo cerca del observador
  ctx.fillStyle = P.railColor;
  ctx.fillRect(ox, oy + drawH * 0.85, drawW, Math.max(2, drawH * 0.015));
  ctx.fillRect(ox, oy + drawH * 0.93, drawW, Math.max(2, drawH * 0.015));

  // 11. Etiqueta
  ctx.fillStyle = '#222';
  ctx.font = `bold ${Math.max(9, drawH * 0.04)}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('Andén opuesto visto desde tu andén',
               ox + drawW / 2, yWallTop - 2);
}
