// escenarios/metro_base/estacion_base.js
// EstacionBase — composición central back-view del andén:
//   · Punto de fuga en el centro del canvas (la paloma queda siempre encima).
//   · Dos andenes simétricos (izquierdo y derecho).
//   · Dos vías con 2 carriles cada una (4 carriles totales) en perspectiva.
//   · Pantalla LED colgando del techo, fluorescentes, carteles, logo Metro.
//   · Pasajeros opcionales en cada andén.
//   · Tren llegando por la vía configurada (trainOnLeft / trainOnRight).
//
// Sin colisiones durante esta fase (la paloma sólo "pasa" por la estación).
// Al cumplirse cfg.durationSeconds, isDone=true y el orquestador pasa al
// siguiente túnel.

import { canvas, STATE, pigeon } from '../../mecanica/estado.js';
import { perspective }            from '../../mecanica/camara.js';
import { drawTrenFrontal, setTrenLED } from '../../elementos/tren.js';

const DEFAULT_CONFIG = {
  // ── Geometría ───────────────────────────────────────────────────────────
  vanishingPointY:    0.42,    // fracción del canvas donde está el punto de fuga
  platformWidthRatio: 0.25,    // ancho del andén en primer plano (fracción)
  platformWidthVP:    0.04,    // ancho del andén en el punto de fuga (fracción)

  // ── Vías y carriles ─────────────────────────────────────────────────────
  // Todas las distancias horizontales son FRACCIONES DEL ANCHO DEL CANVAS
  // (×100 para que el editor muestre números legibles tipo 32, 2.5, etc.).
  // Esto produce un trapecio fuerte: las vías ocupan ~64% del ancho en la
  // base (cerca de la cámara) y se cierran al ~3% en el punto de fuga.
  trackOuterOffset:   32,      // % de W desde el centro al carril exterior (BASE)
  trackInnerOffset:   3,       // % de W al carril interior (BASE) — gap central pequeño
  trackOuterOffsetVP: 1.8,     // % de W al carril exterior (VP)
  trackInnerOffsetVP: 1.5,     // % de W al carril interior (VP)
  // Borde del andén (donde el suelo gris se corta y empieza el foso de la vía)
  platformEdgeOffset:   34,    // % de W desde centro al borde inferior del andén
  platformEdgeOffsetVP: 1.95,  // % de W al borde del andén en el VP
  numSleepers:        16,
  sleeperColor:       '#3A2A18',
  sleeperHighlight:   '#5A4028',
  ballastColor:       '#1a1a18',
  fosseShadow:        '#0a0a10',

  // Carriles metálicos (3 capas para efecto brillo)
  railShadowColor:    '#5A6878',
  railColor:          '#9AAAB5',
  railHighlight:      '#FFFFFF',

  // Sujeciones (pernos) en cada traviesa
  fastenerColor:      '#000000',

  // ── Andén ───────────────────────────────────────────────────────────────
  platformColor:      '#5A5A6A',
  platformDot:        '#666677',
  platformEdgeYellow: '#FFCC00',

  // ── Paredes ─────────────────────────────────────────────────────────────
  wallColor:          '#F0F0F0',
  wallStripeBlue:     '#1A3A8A',
  wallStripeYellow:   '#FFCC00',

  // ── Techo ───────────────────────────────────────────────────────────────
  ceilingColor:       '#222230',
  ceilingBandTop:     '#0d1535',

  // ── Iluminación ─────────────────────────────────────────────────────────
  fluorescentColor:   '#FFFBE6',
  fluorescentGlow:    'rgba(255, 251, 230, 0.15)',
  numFluorescents:    5,

  // ── Carteles / pantalla LED ─────────────────────────────────────────────
  signBgColor:        '#1A3A8A',
  signTextColor:      '#FFFFFF',
  signSubtextColor:   '#88AADD',
  ledScreenBg:        '#1A3A8A',
  ledScreenAccent:    '#0066CC',

  // ── Logo Metro ──────────────────────────────────────────────────────────
  metroLogoBg:        '#FFFFFF',
  metroLogoColor:     '#CC1111',

  // ── Pasajeros ───────────────────────────────────────────────────────────
  numPassengersLeft:  1,
  numPassengersRight: 1,

  // ── Spawn de trenes ─────────────────────────────────────────────────────
  trainOnLeft:           true,
  trainOnRight:          false,
  trainArrivalDelaySec:  1.5,
  // Velocidad del tren a través de la estación (unidades de progress / s).
  // 0.5 ⇒ tarda 2 s en cruzar de VP a andén, otro 1 s en salir por la cámara.
  trainSpeed:            0.5,
  // Cuando progress supera este umbral, el tren se elimina (ya no es visible).
  // 1.5 deja un margen para que el sprite salga del marco antes de borrarlo.
  trainExitProgress:     1.5,

  // ── Duración ────────────────────────────────────────────────────────────
  durationSeconds:    8,

  // ── Texto de carteles ───────────────────────────────────────────────────
  stationName:        'Estación',
  stationDirection:   'MONCLOA',
  lineNumber:         3,
  lineColor:          '#F39200',

  // ── Tutorial / checkpoint (opcionales, render adicional) ────────────────
  tutorialMessage:    null,
  isCheckpoint:       false,
};

export class EstacionBase {
  constructor(configOverride = {}) {
    this.cfg              = { ...DEFAULT_CONFIG, ...configOverride };
    this._frame           = 0;
    this._elapsed         = 0;
    this._done            = false;
    this._passengersLeft  = [];
    this._passengersRight = [];
    this._fluorState      = Array(this.cfg.numFluorescents).fill(true);
    this._fluorTimers     = [];   // Timeouts pendientes para limpieza
    this._trains          = [];
  }

  get isDone() { return this._done; }

  init(stationName) {
    this._frame   = 0;
    this._elapsed = 0;
    this._done    = false;
    if (stationName) this.cfg.stationName = stationName;
    this._spawnPassengers();
    this._trains  = [];
    // Limpiar timers anteriores (por si reset / cambio rápido de escena)
    this._fluorTimers.forEach((t) => clearTimeout(t));
    this._fluorTimers = [];
    this._fluorState  = Array(this.cfg.numFluorescents).fill(true);
    // Sincronizar el LED del tren con la dirección activa
    setTrenLED(this.cfg.stationDirection);
  }

  update(dt) {
    this._frame++;
    this._elapsed += dt / 60;
    const elapsed = this._elapsed;

    // Spawn de tren a partir del delay configurado.
    // Una vez que el tren anterior sale del campo de visión (progress > 1.5),
    // se desencadena un nuevo spawn — esto crea un flujo continuo de trenes
    // pasando por la estación en lugar de uno solo que se queda parado.
    if (elapsed >= this.cfg.trainArrivalDelaySec) {
      if (this.cfg.trainOnLeft && !this._trains.some((t) => t.side === 'left')) {
        this._trains.push({ side: 'left', progress: 0 });
      }
      if (this.cfg.trainOnRight && !this._trains.some((t) => t.side === 'right')) {
        this._trains.push({ side: 'right', progress: 0 });
      }
    }

    // Avanzar trenes — sin clamp para que CONTINÚEN pasando la cámara y
    // salgan por debajo del marco. Velocidad: 0.5 unidades/s.
    //   progress 0   = en el VP (fondo del túnel)
    //   progress 1   = parado en el andén (centro del cuadro)
    //   progress >1  = pasando frente a la cámara, saliendo del marco
    this._trains.forEach((t) => {
      t.progress += (dt / 60) * this.cfg.trainSpeed;
    });

    // Eliminar trenes que ya han salido del campo de visión
    this._trains = this._trains.filter((t) => t.progress < this.cfg.trainExitProgress);

    // Parpadeo esporádico de fluorescentes
    if (this._frame % 90 === 0 && Math.random() < 0.2) {
      const i = Math.floor(Math.random() * this._fluorState.length);
      this._fluorState[i] = !this._fluorState[i];
      const handle = setTimeout(() => { this._fluorState[i] = true; },
                                 80 + Math.random() * 200);
      this._fluorTimers.push(handle);
    }

    // Fin de la escena
    if (elapsed >= this.cfg.durationSeconds) {
      this._done = true;
    }
  }

  render(ctx) {
    const W   = canvas.width;
    const H   = canvas.height;
    const vpX = W / 2;
    const vpY = H * this.cfg.vanishingPointY;

    // Geometría trapezoidal de las vías — todas las medidas se calculan
    // como W * (offset/100). En la BASE las vías ocupan mucho ancho (efecto
    // de cercanía); en el VP convergen casi a un punto.
    const G = this._computeTrackGeom(W, vpX);

    this._drawBackground   (ctx, W, H);
    this._drawCeiling      (ctx, W, H, vpX, vpY);
    this._drawFluorescents (ctx, W, H, vpX, vpY);
    this._drawWalls        (ctx, W, H, vpX, vpY, G);
    this._drawSigns        (ctx, W, H, vpX, vpY);
    this._drawPlatforms    (ctx, W, H, vpX, vpY, G);
    this._drawPlatformTactile(ctx, W, H, vpX, vpY, G);
    this._drawTracks       (ctx, W, H, vpX, vpY, G);
    this._drawSafetyLines  (ctx, W, H, vpX, vpY, G);
    this._drawPassengers   (ctx, W, H);
    this._drawTrains       (ctx, W, H, vpX, vpY, G);
    // Boca de túnel: se dibuja DESPUÉS de las vías y los trenes para que
    // los trenes parezcan SALIR del túnel (los pequeños del fondo quedan
    // tapados por la boca, los grandes que se acercan la sobrepasan).
    this._drawTunnelMouth  (ctx, W, H, vpX, vpY, G);
    // LED y logo Metro encima del arco (cuelgan del techo / pared frontal)
    this._drawLEDScreen    (ctx, W, H, vpX, vpY);
    this._drawMetroLogo    (ctx, W, H, vpX, vpY);

    // Overlays opcionales (heredados del API previo)
    if (this.cfg.tutorialMessage) this._drawTutorialBanner(ctx, this.cfg.tutorialMessage);
    if (this.cfg.isCheckpoint)    this._drawCheckpointBadge(ctx);
  }

  // ── Geometría de las vías y andenes (trapecios en perspectiva) ──────────
  // Devuelve un objeto con las coordenadas X precomputadas:
  //   pBL/pBR = borde inferior del ANDÉN (Platform Base Left/Right)
  //   pVL/pVR = borde superior del andén en el VP
  //   tOBL/tOBR = carril EXTERIOR en la BASE
  //   tIBL/tIBR = carril INTERIOR en la BASE
  //   tOVL/tOVR = carril EXTERIOR en el VP
  //   tIVL/tIVR = carril INTERIOR en el VP
  _computeTrackGeom(W, vpX) {
    const oR  = this.cfg.trackOuterOffset    / 100;   // ratio
    const iR  = this.cfg.trackInnerOffset    / 100;
    const oVR = this.cfg.trackOuterOffsetVP  / 100;
    const iVR = this.cfg.trackInnerOffsetVP  / 100;
    const pR  = this.cfg.platformEdgeOffset  / 100;
    const pVR = this.cfg.platformEdgeOffsetVP / 100;
    return {
      // Bordes del andén (foso = entre andén y carril exterior)
      pBL:  vpX - W * pR,
      pBR:  vpX + W * pR,
      pVL:  vpX - W * pVR,
      pVR:  vpX + W * pVR,
      // Carriles
      tOBL: vpX - W * oR,    tOBR: vpX + W * oR,
      tIBL: vpX - W * iR,    tIBR: vpX + W * iR,
      tOVL: vpX - W * oVR,   tOVR: vpX + W * oVR,
      tIVL: vpX - W * iVR,   tIVR: vpX + W * iVR,
    };
  }

  // ── FONDO ─────────────────────────────────────────────────────────────────
  _drawBackground(ctx, W, H) {
    ctx.fillStyle = '#050508';
    ctx.fillRect(0, 0, W, H);
  }

  // ── TECHO ─────────────────────────────────────────────────────────────────
  _drawCeiling(ctx, W, H, vpX, vpY) {
    ctx.fillStyle = this.cfg.ceilingColor;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(W, 0);
    ctx.lineTo(vpX + 25, vpY - 10);
    ctx.lineTo(vpX - 25, vpY - 10);
    ctx.closePath();
    ctx.fill();

    // Banda azul oscuro superior
    ctx.fillStyle = this.cfg.ceilingBandTop;
    ctx.beginPath();
    ctx.moveTo(0, 6);
    ctx.lineTo(W, 6);
    ctx.lineTo(vpX + 25, vpY - 12);
    ctx.lineTo(vpX - 25, vpY - 12);
    ctx.closePath();
    ctx.fill();
  }

  // ── FLUORESCENTES (5 tubos paralelos al techo) ───────────────────────────
  _drawFluorescents(ctx, W, H, vpX, vpY) {
    const tubes = [
      { x1: 0,        y1: 14, x2: vpX - 18, y2: vpY - 10 },
      { x1: W * 0.25, y1: 8,  x2: vpX - 8,  y2: vpY - 10 },
      { x1: vpX,      y1: 4,  x2: vpX,      y2: vpY - 10 },
      { x1: W * 0.75, y1: 8,  x2: vpX + 8,  y2: vpY - 10 },
      { x1: W,        y1: 14, x2: vpX + 18, y2: vpY - 10 },
    ];
    tubes.forEach((t, i) => {
      const isOn = this._fluorState[i];
      // Halo
      ctx.strokeStyle = isOn ? this.cfg.fluorescentGlow : 'rgba(100,100,100,0.05)';
      ctx.lineWidth   = 6;
      ctx.beginPath();
      ctx.moveTo(t.x1, t.y1); ctx.lineTo(t.x2, t.y2);
      ctx.stroke();
      // Tubo
      ctx.strokeStyle = isOn ? this.cfg.fluorescentColor : '#666';
      ctx.lineWidth   = 1.5;
      ctx.beginPath();
      ctx.moveTo(t.x1, t.y1); ctx.lineTo(t.x2, t.y2);
      ctx.stroke();
    });
  }

  // ── PAREDES laterales (trapecios) ────────────────────────────────────────
  _drawWalls(ctx, W, H, vpX, vpY, G) {
    ctx.fillStyle = this.cfg.wallColor;

    // Pared izquierda — vértices del andén (base + VP)
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(G.pVL, vpY - 10);
    ctx.lineTo(G.pVL, vpY + 5);
    ctx.lineTo(0, H * 0.55);
    ctx.closePath();
    ctx.fill();

    // Pared derecha
    ctx.beginPath();
    ctx.moveTo(W, 0);
    ctx.lineTo(G.pVR, vpY - 10);
    ctx.lineTo(G.pVR, vpY + 5);
    ctx.lineTo(W, H * 0.55);
    ctx.closePath();
    ctx.fill();

    // Franja decorativa azul (en perspectiva, converge al VP)
    ctx.strokeStyle = this.cfg.wallStripeBlue;
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, H * 0.30); ctx.lineTo(G.pVL, vpY - 5);
    ctx.moveTo(W, H * 0.30); ctx.lineTo(G.pVR, vpY - 5);
    ctx.stroke();
  }

  // ── CARTELES "Estación · Andén N" ────────────────────────────────────────
  _drawSigns(ctx, W, H, vpX, vpY) {
    const drawSign = (x, andenNum) => {
      ctx.fillStyle = this.cfg.signBgColor;
      ctx.fillRect(x, 38, 50, 14);
      ctx.fillStyle    = this.cfg.signTextColor;
      ctx.font         = 'bold 7px monospace';
      ctx.textAlign    = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.cfg.stationName, x + 4, 45);
      ctx.font      = '5px monospace';
      ctx.fillStyle = this.cfg.signSubtextColor;
      ctx.fillText('Andén ' + andenNum, x + 4, 50);
    };
    drawSign(6,        '1');
    drawSign(W - 56,   '2');
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  // ── BOCA DE TÚNEL (arco oscuro al fondo) ─────────────────────────────────
  // Donde acaba el andén, las vías se adentran en el siguiente túnel. Esta
  // boca da el "punto de ruptura" entre la estación iluminada y el túnel
  // oscuro — replica lo que se ve en estaciones reales del Metro de Madrid.
  //
  // Forma: rectángulo con la parte superior redondeada (semicírculo) — un
  // arco clásico de túnel. Centrado horizontalmente en el VP, sentado sobre
  // la línea de las vías (vpY + 8) por abajo.
  _drawTunnelMouth(ctx, W, H, vpX, vpY, G) {
    const cfg       = this.cfg;
    const baseY     = vpY + 8;
    // Arco GRANDE — domina visualmente el fondo. Aprox. 28% del ancho del
    // canvas, dimensiones a partir de las que se calculó el alto para que
    // el semicírculo dominante sea claramente reconocible como "arco".
    const innerHalf = Math.max(40, W * 0.13);   // semianchura interior
    const sidesH    = Math.max(15, W * 0.04);   // alto del tramo recto
    const frameW    = Math.max(4,  W * 0.012);  // grosor del marco

    // Helper: crea el path de un arco (rectángulo con techo en semicírculo).
    const archPath = (halfW, h) => {
      ctx.beginPath();
      ctx.moveTo(vpX - halfW, baseY);
      ctx.lineTo(vpX - halfW, baseY - h);
      ctx.arc(vpX, baseY - h, halfW, Math.PI, 0, false);
      ctx.lineTo(vpX + halfW, baseY);
      ctx.closePath();
    };

    // 1. MARCO del arco — gris medio (#555). Se distingue tanto contra la
    //    pared clara (a los lados, gris oscuro sobre claro) como contra el
    //    fondo negro central (gris claro sobre oscuro). Cubre la pared con
    //    una "moldura de hormigón" alrededor de la boca del túnel.
    ctx.fillStyle = cfg.tunnelMouthFrame ?? '#555560';
    archPath(innerHalf + frameW, sidesH + frameW);
    ctx.fill();

    // 2. INTERIOR del túnel — negro casi puro con ligero gradiente
    //    azulado: sugiere profundidad infinita más allá.
    const grad = ctx.createRadialGradient(vpX, baseY - sidesH * 0.5, 1,
                                           vpX, baseY - sidesH * 0.5, innerHalf * 1.3);
    grad.addColorStop(0,   'rgba(10, 12, 20, 1)');
    grad.addColorStop(0.6, 'rgba(2, 3, 6, 1)');
    grad.addColorStop(1,   'rgba(0, 0, 0, 1)');
    ctx.fillStyle = grad;
    archPath(innerHalf, sidesH);
    ctx.fill();

    // 3. Filo SUPERIOR brillante del marco (la luz del andén pega arriba)
    ctx.strokeStyle = 'rgba(255, 251, 230, 0.65)';
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.arc(vpX, baseY - sidesH, innerHalf + frameW, Math.PI, 0, false);
    ctx.stroke();

    // 4. Filo INTERIOR oscuro del marco (sombra de la profundidad)
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(vpX - innerHalf, baseY);
    ctx.lineTo(vpX - innerHalf, baseY - sidesH);
    ctx.arc(vpX, baseY - sidesH, innerHalf, Math.PI, 0, false);
    ctx.lineTo(vpX + innerHalf, baseY);
    ctx.stroke();

    // 5. Suelo del arco — banda oscura por donde entra el balasto al túnel
    ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
    ctx.fillRect(vpX - innerHalf, baseY - 1, innerHalf * 2, 3);
  }

  // ── PANTALLA LED COLGANTE (sentido del trayecto) ─────────────────────────
  _drawLEDScreen(ctx, W, H, vpX, vpY) {
    // Cables al techo
    ctx.fillStyle = '#444';
    ctx.fillRect(vpX - 5, 0, 1, 7);
    ctx.fillRect(vpX + 4, 0, 1, 7);

    // Marco
    ctx.fillStyle = '#000';
    ctx.fillRect(vpX - 60, 5, 120, 22);
    ctx.fillStyle = this.cfg.ledScreenAccent;
    ctx.fillRect(vpX - 58, 6, 116, 20);
    ctx.fillStyle = this.cfg.ledScreenBg;
    ctx.fillRect(vpX - 56, 7, 112, 18);

    ctx.fillStyle    = '#FFFFFF';
    ctx.font         = 'bold 5px monospace';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Metro de Madrid', vpX, 13);
    ctx.font = 'bold 8px monospace';
    ctx.fillText('SENTIDO ' + this.cfg.stationDirection, vpX, 22);

    ctx.textAlign    = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  // ── ANDENES (suelo gris) ─────────────────────────────────────────────────
  // El andén forma un trapecio: ancho en la base (cerca de la cámara) y
  // estrecho al fondo del túnel (punto de fuga).
  _drawPlatforms(ctx, W, H, vpX, vpY, G) {
    ctx.fillStyle = this.cfg.platformColor;

    // Andén izquierdo
    ctx.beginPath();
    ctx.moveTo(0, H);
    ctx.lineTo(G.pBL, H);
    ctx.lineTo(G.pVL, vpY + 5);
    ctx.lineTo(0, H * 0.55);
    ctx.closePath();
    ctx.fill();

    // Andén derecho
    ctx.beginPath();
    ctx.moveTo(W, H);
    ctx.lineTo(G.pBR, H);
    ctx.lineTo(G.pVR, vpY + 5);
    ctx.lineTo(W, H * 0.55);
    ctx.closePath();
    ctx.fill();
  }

  // ── BALDOSA TÁCTIL (puntos de orientación en el suelo) ───────────────────
  _drawPlatformTactile(ctx, W, H, vpX, vpY, G) {
    // La banda táctil corre a ~5 px del borde del andén (lado vía).
    const bandOffset = 5;
    for (let i = 0; i < 12; i++) {
      const t   = i / 12;
      const s   = Math.max(1, 3 * (1 - t));
      const yF  = (1 - t) * (H * 0.85) + t * (vpY + 8);

      // Lado izquierdo: interpolación entre borde del andén en la base y en el VP
      const baseEdgeL = G.pBL - bandOffset;
      const vpEdgeL   = G.pVL - 1;
      const fxL = (1 - t) * baseEdgeL + t * vpEdgeL;
      ctx.fillStyle = this.cfg.platformDot;
      ctx.fillRect(Math.round(fxL), Math.round(yF), Math.round(s), Math.round(s));

      // Lado derecho
      const baseEdgeR = G.pBR + bandOffset;
      const vpEdgeR   = G.pVR + 1;
      const fxR = (1 - t) * baseEdgeR + t * vpEdgeR;
      ctx.fillRect(Math.round(fxR), Math.round(yF), Math.round(s), Math.round(s));
    }
  }

  // ── VÍAS, TRAVIESAS Y CARRILES ───────────────────────────────────────────
  // Cada vía es un TRAPECIO en perspectiva: ancho en la base (cerca de la
  // cámara, abajo) y muy estrecho en el VP (arriba). Las 4 esquinas:
  //   left  track:  pBL/pVL  (lado andén) ──── tIBL/tIVL (lado centro)
  //   right track:  tIBR/tIVR (lado centro) ── pBR/pVR   (lado andén)
  _drawTracks(ctx, W, H, vpX, vpY, G) {
    // 1. BALASTO (cama de grava de cada vía — relleno trapezoidal completo)
    ctx.fillStyle = this.cfg.ballastColor;
    ctx.beginPath();
    ctx.moveTo(G.pVL, vpY + 8);
    ctx.lineTo(G.pBL, H);
    ctx.lineTo(G.tIBL, H);
    ctx.lineTo(G.tIVL, vpY + 8);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(G.tIVR, vpY + 8);
    ctx.lineTo(G.tIBR, H);
    ctx.lineTo(G.pBR, H);
    ctx.lineTo(G.pVR, vpY + 8);
    ctx.closePath();
    ctx.fill();

    // 1b. SOMBRA del borde del andén sobre el balasto (línea oscura interna,
    // ~6 px al interior del trapecio, da sensación de profundidad del foso).
    const fosseInsetBase = Math.max(4, W * 0.008);
    const fosseInsetVP   = Math.max(2, W * 0.0025);
    ctx.fillStyle = this.cfg.fosseShadow;
    ctx.beginPath();
    ctx.moveTo(G.pVL,                vpY + 5);
    ctx.lineTo(G.pBL,                H);
    ctx.lineTo(G.pBL + fosseInsetBase, H);
    ctx.lineTo(G.pVL + fosseInsetVP,   vpY + 8);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(G.pVR,                vpY + 5);
    ctx.lineTo(G.pBR,                H);
    ctx.lineTo(G.pBR - fosseInsetBase, H);
    ctx.lineTo(G.pVR - fosseInsetVP,   vpY + 8);
    ctx.closePath();
    ctx.fill();

    // 1c. Hueco oscuro central (entre las dos vías) — el rail de tercer carril
    ctx.fillStyle = this.cfg.fosseShadow;
    ctx.beginPath();
    ctx.moveTo(G.tIVL, vpY + 8);
    ctx.lineTo(G.tIBL, H);
    ctx.lineTo(G.tIBR, H);
    ctx.lineTo(G.tIVR, vpY + 8);
    ctx.closePath();
    ctx.fill();

    // 2. TRAVIESAS (en perspectiva, con highlight superior)
    const N = this.cfg.numSleepers;
    for (let i = 0; i < N; i++) {
      const t        = i / N;
      const sleeperH = Math.max(1, Math.round(2 + (1 - t) * 3));
      const trY      = (1 - t) * H + t * (vpY + 8);

      // Vía izquierda
      const leftX1 = (1 - t) * G.pBL  + t * G.pVL;
      const leftX2 = (1 - t) * G.tIBL + t * G.tIVL;

      ctx.fillStyle = this.cfg.sleeperColor;
      ctx.fillRect(Math.round(leftX1), Math.round(trY),
                   Math.round(leftX2 - leftX1), sleeperH);
      ctx.fillStyle = this.cfg.sleeperHighlight;
      ctx.fillRect(Math.round(leftX1), Math.round(trY),
                   Math.round(leftX2 - leftX1), 1);

      // Vía derecha
      const rightX1 = (1 - t) * G.tIBR + t * G.tIVR;
      const rightX2 = (1 - t) * G.pBR  + t * G.pVR;

      ctx.fillStyle = this.cfg.sleeperColor;
      ctx.fillRect(Math.round(rightX1), Math.round(trY),
                   Math.round(rightX2 - rightX1), sleeperH);
      ctx.fillStyle = this.cfg.sleeperHighlight;
      ctx.fillRect(Math.round(rightX1), Math.round(trY),
                   Math.round(rightX2 - rightX1), 1);
    }

    // 3. CARRILES METÁLICOS (4 carriles con efecto brillo de 3 capas)
    const rails = [
      // Vía izquierda
      { startX: G.tOBL, endX: G.tOVL },
      { startX: G.tIBL, endX: G.tIVL },
      // Vía derecha
      { startX: G.tIBR, endX: G.tIVR },
      { startX: G.tOBR, endX: G.tOVR },
    ];

    rails.forEach((rail) => {
      // Capa 1: sombra
      ctx.strokeStyle = this.cfg.railShadowColor;
      ctx.lineWidth   = 2.5;
      ctx.beginPath();
      ctx.moveTo(rail.startX + 1, H);
      ctx.lineTo(rail.endX + 1, vpY + 8);
      ctx.stroke();

      // Capa 2: cuerpo del carril
      ctx.strokeStyle = this.cfg.railColor;
      ctx.lineWidth   = 1.5;
      ctx.beginPath();
      ctx.moveTo(rail.startX, H);
      ctx.lineTo(rail.endX, vpY + 8);
      ctx.stroke();

      // Capa 3: brillo blanco (filo del carril)
      ctx.strokeStyle = this.cfg.railHighlight;
      ctx.lineWidth   = 0.5;
      ctx.beginPath();
      ctx.moveTo(rail.startX, H);
      ctx.lineTo(rail.endX, vpY + 8);
      ctx.stroke();
    });

    // 4. SUJECIONES (puntos negros donde el carril toca cada traviesa)
    for (let i = 0; i < N; i += 2) {
      const t       = i / N;
      const trY     = (1 - t) * H + t * (vpY + 8);
      const dotSize = Math.max(1, Math.round(1.5 * (1 - t * 0.7)));

      ctx.fillStyle = this.cfg.fastenerColor;

      // Vía izquierda
      const ax = (1 - t) * G.tOBL + t * G.tOVL;
      const bx = (1 - t) * G.tIBL + t * G.tIVL;
      ctx.fillRect(Math.round(ax) - 1, Math.round(trY), dotSize, dotSize);
      ctx.fillRect(Math.round(bx) - 1, Math.round(trY), dotSize, dotSize);

      // Vía derecha
      const cxr = (1 - t) * G.tIBR + t * G.tIVR;
      const dxr = (1 - t) * G.tOBR + t * G.tOVR;
      ctx.fillRect(Math.round(cxr), Math.round(trY), dotSize, dotSize);
      ctx.fillRect(Math.round(dxr), Math.round(trY), dotSize, dotSize);
    }
  }

  // ── BANDA AMARILLA DE SEGURIDAD (línea fina a lo largo del borde del andén)
  _drawSafetyLines(ctx, W, H, vpX, vpY, G) {
    ctx.fillStyle = this.cfg.platformEdgeYellow;
    // Línea horizontal en la altura del VP (techo del andén en perspectiva)
    ctx.fillRect(0,    vpY + 5, G.pVL,      1);
    ctx.fillRect(G.pVR, vpY + 5, W - G.pVR, 1);
    // Línea diagonal sobre el borde del andén (de la base al VP) — rasterizada
    // como una secuencia de píxeles para mantener el estilo pixel-art.
    const stepsL = Math.abs(G.pBL - G.pVL);
    for (let s = 0; s <= stepsL; s++) {
      const t = s / Math.max(1, stepsL);
      const x = (1 - t) * G.pBL + t * G.pVL;
      const y = (1 - t) * H    + t * (vpY + 5);
      ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
    const stepsR = Math.abs(G.pBR - G.pVR);
    for (let s = 0; s <= stepsR; s++) {
      const t = s / Math.max(1, stepsR);
      const x = (1 - t) * G.pBR + t * G.pVR;
      const y = (1 - t) * H    + t * (vpY + 5);
      ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
  }

  // ── LOGO METRO sobre el arco del túnel ───────────────────────────────────
  // Lo colocamos JUSTO ENCIMA de la boca de túnel (que ahora ocupa el centro
  // del fondo de la estación), igual que en estaciones reales donde el
  // letrero "Metro" cuelga del frontón sobre el arco.
  _drawMetroLogo(ctx, W, H, vpX, vpY) {
    // Calcular techo del marco del arco (debe coincidir con _drawTunnelMouth)
    const innerHalf = Math.max(40, W * 0.13);
    const sidesH    = Math.max(15, W * 0.04);
    const frameW    = Math.max(4,  W * 0.012);
    const archTopY  = (vpY + 8) - (sidesH + frameW) - (innerHalf + frameW);

    // Letrero centrado, 4 px sobre el arco. Si no hay sitio, no se dibuja.
    const labelH = 10;
    const labelY = archTopY - labelH - 4;
    if (labelY < 30) return;     // no espacio (LED screen ocupa los primeros 27 px)

    ctx.fillStyle = this.cfg.metroLogoBg;
    ctx.fillRect(vpX - 22, labelY, 44, labelH);

    // Rombo Metro (girado 45°)
    ctx.save();
    ctx.translate(vpX, labelY + labelH / 2);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = this.cfg.metroLogoColor;
    ctx.fillRect(-3, -3, 6, 6);
    ctx.restore();
  }

  // ── PASAJEROS (siluetas pixel-art simples) ───────────────────────────────
  _spawnPassengers() {
    const palettes = ['#0066CC', '#993333', '#225544', '#776611', '#553388'];
    this._passengersLeft = [];
    for (let i = 0; i < this.cfg.numPassengersLeft; i++) {
      this._passengersLeft.push({
        x:        16 + i * 20,
        bagColor: palettes[i % palettes.length],
      });
    }
    this._passengersRight = [];
    for (let i = 0; i < this.cfg.numPassengersRight; i++) {
      this._passengersRight.push({
        x:        i * 20,                      // medido desde el borde derecho
        bagColor: palettes[(i + 1) % palettes.length],
      });
    }
  }

  _drawPassengers(ctx, W, H) {
    const drawPassenger = (px, py, bagColor) => {
      // Cabeza
      ctx.fillStyle = '#3A3A45';
      ctx.fillRect(px,     py - 6, 6, 8);
      // Torso
      ctx.fillStyle = '#1A3A55';
      ctx.fillRect(px - 1, py + 2, 8, 12);
      // Piernas
      ctx.fillStyle = '#222230';
      ctx.fillRect(px + 1, py + 14, 2, 8);
      ctx.fillRect(px + 4, py + 14, 2, 8);
      // Mochila
      ctx.fillStyle = bagColor;
      ctx.fillRect(px - 2, py + 2, 2, 8);
    };

    this._passengersLeft.forEach((p) => {
      drawPassenger(p.x, H - 36, p.bagColor);
    });
    this._passengersRight.forEach((p) => {
      drawPassenger(W - 32 + p.x, H - 36, p.bagColor);
    });
  }

  // ── TREN llegando (en una de las dos vías) ───────────────────────────────
  // El tren sigue el CENTRO de la vía (interpolando entre VP y base) y se
  // escala para ocupar ~85% del ancho del trapecio a esa profundidad. La
  // BASE del sprite se alinea con la traviesa correspondiente, dando la
  // sensación de que el tren circula por encima de los rieles.
  _drawTrains(ctx, W, H, vpX, vpY, G) {
    // Sprite art original: 48 px de ancho × 40 px de alto (tren.js / metro_base_render).
    const SPRITE_W = 48;
    const SPRITE_H = 40;
    // Proporción del ancho de vía que el tren ocupa a la base.
    const TRAIN_TO_TRACK_RATIO = 0.85;

    this._trains.forEach((train) => {
      const t = train.progress;        // 0 = lejos (VP), 1 = cerca (base)

      // Centros y anchos de la vía a la altura BASE y al VP.
      let cBase, cVP, wBase, wVP;
      if (train.side === 'left') {
        cBase = (G.tOBL + G.tIBL) / 2;
        cVP   = (G.tOVL + G.tIVL) / 2;
        wBase = G.tIBL - G.tOBL;
        wVP   = G.tIVL - G.tOVL;
      } else {
        cBase = (G.tOBR + G.tIBR) / 2;
        cVP   = (G.tOVR + G.tIVR) / 2;
        wBase = G.tOBR - G.tIBR;
        wVP   = G.tOVR - G.tIVR;
      }

      // Interpolación lineal en perspectiva.
      const cx = (1 - t) * cVP + t * cBase;
      const trackWidthHere = (1 - t) * wVP + t * wBase;

      // Escala de tren: el tren ocupa ~85% del ancho de vía a esa profundidad.
      const scale = Math.max(0.05, (trackWidthHere * TRAIN_TO_TRACK_RATIO) / SPRITE_W);

      // Posición vertical: la BASE del sprite se alinea con la traviesa
      // correspondiente (línea inferior de la vía a esa profundidad).
      const bottomY = (1 - t) * (vpY + 8) + t * H;
      const cy      = bottomY - (SPRITE_H * scale) / 2;

      const variant = { stripeColor: this.cfg.lineColor };
      drawTrenFrontal(ctx, cx, cy, scale, variant, this.cfg.stationDirection);

      // Halo de faros (tinte cálido al frente del tren)
      const haloR = 25 * scale;
      const grad = ctx.createRadialGradient(cx, cy - 5 * scale, 1, cx, cy - 5 * scale, haloR);
      grad.addColorStop(0, 'rgba(255, 200, 100, 0.4)');
      grad.addColorStop(1, 'rgba(255, 200, 100, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(cx - haloR, cy - 30 * scale, haloR * 2, 50 * scale);
    });
  }

  // ── OVERLAYS opcionales ──────────────────────────────────────────────────
  _drawTutorialBanner(ctx, text) {
    const cw = canvas.width;
    const bannerY = 110;        // bajo el HUD de progreso + LED
    const bannerH = 28;
    const bannerW = Math.min(420, cw - 40);
    const bx = Math.round(cw / 2 - bannerW / 2);

    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(bx, bannerY, bannerW, bannerH);
    ctx.strokeStyle = this.cfg.lineColor;
    ctx.lineWidth   = 1.5;
    ctx.strokeRect(bx + 0.5, bannerY + 0.5, bannerW - 1, bannerH - 1);

    ctx.fillStyle    = '#ffffff';
    ctx.font         = 'bold 12px monospace';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, cw / 2, bannerY + bannerH / 2);
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  _drawCheckpointBadge(ctx) {
    const cw = canvas.width;
    const bx = cw - 110, by = 110;
    ctx.fillStyle = 'rgba(93,202,165,0.18)';
    ctx.fillRect(bx, by, 100, 22);
    ctx.strokeStyle = '#5DCAA5';
    ctx.lineWidth   = 1;
    ctx.strokeRect(bx + 0.5, by + 0.5, 99, 21);
    ctx.fillStyle    = '#5DCAA5';
    ctx.font         = 'bold 10px monospace';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🏁 CHECKPOINT', bx + 50, by + 11);
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'alphabetic';
  }
}
