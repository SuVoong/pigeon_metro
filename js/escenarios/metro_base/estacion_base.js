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
import { perspective, getViewBounds, getCameraVpY, camera, CAMERA_RANGE_X } from '../../mecanica/camara.js';
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
  trackOuterOffset:   25.5,    // % de W desde el centro al carril exterior (BASE) — sincronizado con tunel.js
  trackInnerOffset:   5,       // % de W al carril interior (BASE) — sincronizado con tunel.js
  trackOuterOffsetVP: 1.8,     // % de W al carril exterior (VP)
  trackInnerOffsetVP: 2,       // % de W al carril interior (VP)
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
  wallColor:          '#EFEDE6',     // blanco hueso, levemente cálido
  wallStripeBlue:     '#2F7A3A',     // VERDE (antes azul) — referencia foto
  wallStripeYellow:   '#FFCC00',

  // ── Techo ───────────────────────────────────────────────────────────────
  ceilingColor:       '#9C9890',     // hormigón claro abovedado (antes #222230 oscuro)
  ceilingBandTop:     '#7A766E',     // sombra superior del arco

  // ── Iluminación ─────────────────────────────────────────────────────────
  fluorescentColor:   '#FFF8DC',     // amarillo cálido
  fluorescentGlow:    'rgba(255, 248, 220, 0.45)',  // brillo más intenso (antes 0.15)
  numFluorescents:    7,             // más tubos (antes 5) — sensación de pasillo iluminado

  // ── Carteles / pantalla LED ─────────────────────────────────────────────
  signBgColor:        '#1A3A8A',
  signTextColor:      '#FFFFFF',
  signSubtextColor:   '#88AADD',
  ledScreenBg:        '#1A3A8A',
  ledScreenAccent:    '#0066CC',

  // ── Logo Metro ──────────────────────────────────────────────────────────
  metroLogoBg:        '#FFFFFF',
  metroLogoColor:     '#CC1111',

  // ── Bancos metálicos sobre el andén ────────────────────────────────────
  numBenches:         1,            // por lado
  benchTopColor:      '#FFFFFF',
  benchBodyColor:     '#E8E8E8',
  benchShadowColor:   '#888888',
  benchLegColor:      '#666666',

  // ── Carteles colgantes de destino (uno por andén) ──────────────────────
  numHangingSigns:        2,            // total (1 por andén normalmente)
  hangingSignBg:          '#0a0a14',    // fondo casi negro del letrero
  hangingSignText:        '#FFEE99',    // texto color LED ámbar
  hangingSignCable:       '#222230',    // cable de sujeción al techo
  // Destino que va escrito en cada cartel. Por convención:
  //   andén derecho = Andén 1 = sentido NORTE de la línea
  //   andén izquierdo = Andén 2 = sentido SUR de la línea
  andenRightDestination:  'MONCLOA',
  andenLeftDestination:   'EL CASAR',

  // ── Frente metálico del andén (cae al foso de la vía) ──────────────────
  platformFrontColor: '#9098A8',    // gris metálico claro
  platformFrontShade: '#5A6070',    // sombra inferior

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

// ── Helpers de color (módulo) ───────────────────────────────────────────────
function _hexToRgb(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function _mixHex(hexA, hexB, t) {
  const [aR, aG, aB] = _hexToRgb(hexA);
  const [bR, bG, bB] = _hexToRgb(hexB);
  const k = Math.max(0, Math.min(1, t));
  return `rgb(${Math.round(aR + (bR - aR) * k)},${Math.round(aG + (bG - aG) * k)},${Math.round(aB + (bB - aB) * k)})`;
}

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
    // VP vertical AJUSTADO por el offsetY de la cámara — al subir/bajar la
    // paloma, el VP se desplaza y los rieles/paredes/techo cambian de
    // inclinación. Reemplaza al H*cfg.vanishingPointY estático anterior.
    const vpY = getCameraVpY(H * this.cfg.vanishingPointY);

    // Bounds del área que la cámara puede ver (incluye el rango móvil).
    // Las geometrías "grandes" (fondo, techo, paredes, suelo) usan estos
    // límites en lugar de 0/W/H para no dejar huecos al desplazar la cámara.
    this._bounds = getViewBounds();

    // Geometría trapezoidal de las vías — todas las medidas se calculan
    // como W * (offset/100). En la BASE las vías ocupan mucho ancho (efecto
    // de cercanía); en el VP convergen casi a un punto.
    const G = this._computeTrackGeom(W, vpX);

    this._drawBackground   (ctx, W, H);
    this._drawCeiling      (ctx, W, H, vpX, vpY);
    this._drawFluorescents (ctx, W, H, vpX, vpY);
    this._drawWalls        (ctx, W, H, vpX, vpY, G);
    this._drawWallCables   (ctx, W, H, vpX, vpY, G);
    this._drawEmergencyBoxes(ctx, W, H, vpX, vpY, G);
    this._drawSigns        (ctx, W, H, vpX, vpY);
    this._drawPlatforms    (ctx, W, H, vpX, vpY, G);
    this._drawPlatformFront(ctx, W, H, vpX, vpY, G);
    this._drawBenches      (ctx, W, H, vpX, vpY, G);
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
    // Carteles colgantes de destino sobre cada andén — al final para que
    // queden por encima de las paredes pero tapados por trenes cercanos.
    this._drawHangingSigns (ctx, W, H, vpX, vpY);
    // Las transiciones entrada/salida las gestiona MetroBase con un
    // cross-fade circular desde el punto de fuga; no añadimos overlays
    // de flash blanco ni oscurecimiento aquí — taparían la escena
    // entrante/saliente dentro del recorte circular.

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
    const B = this._bounds;
    ctx.fillStyle = '#050508';
    ctx.fillRect(B.left, B.top, B.width, B.height);
  }

  // ── TECHO ─────────────────────────────────────────────────────────────────
  // Bóveda abovedada: en lugar de un trapecio plano, dibujamos N strips
  // radiales desde el VP hasta el borde superior del canvas. Cada strip se
  // colorea con un gradiente que va de claro (centro de la bóveda) a oscuro
  // (extremos donde la curva se "esconde" detrás de la pared) — el ojo lee
  // la transición de tonos como curvatura cilíndrica de un túnel real.
  _drawCeiling(ctx, W, H, vpX, vpY) {
    const B = this._bounds;
    const peakY  = B.top;            // altura máxima del arco
    const apexY  = vpY - 10;         // donde converge en el VP
    const N      = 24;               // strips — más = más suave (24 ya pixel-perfect)
    const baseHex = this.cfg.ceilingColor;     // hormigón claro al centro
    const edgeHex = this.cfg.ceilingBandTop;   // sombra hacia el alero

    // Ancho del techo en la base (todo el canvas) y en el VP (estrecho)
    const baseLeft  = B.left,  baseRight  = B.right;
    const apexLeft  = vpX - 25, apexRight = vpX + 25;

    for (let i = 0; i < N; i++) {
      // t va de 0 (extremo IZQ) a 1 (extremo DER)
      const t1 = i       / N;
      const t2 = (i + 1) / N;

      // Coordenada X de cada strip en la base y en el VP
      const xBase1 = baseLeft + (baseRight - baseLeft) * t1;
      const xBase2 = baseLeft + (baseRight - baseLeft) * t2;
      const xApex1 = apexLeft + (apexRight - apexLeft) * t1;
      const xApex2 = apexLeft + (apexRight - apexLeft) * t2;

      // Curvatura: |t-0.5|*2 ∈ [0,1]. 0=centro, 1=esquina.
      // El centro es el PICO del arco; los lados se "doblan" a apexY+offset
      const dCenter = Math.abs((t1 + t2) / 2 - 0.5) * 2;
      // Al centro yPeak = peakY (más alto); a las esquinas baja un poco
      const yEdge = peakY + dCenter * 18;

      // Mezcla de color por curvatura (centro claro, lados oscuros)
      const k = Math.pow(dCenter, 1.4);
      ctx.fillStyle = _mixHex(baseHex, edgeHex, k);

      ctx.beginPath();
      ctx.moveTo(xBase1, yEdge);
      ctx.lineTo(xBase2, yEdge);
      ctx.lineTo(xApex2, apexY);
      ctx.lineTo(xApex1, apexY);
      ctx.closePath();
      ctx.fill();
    }

    // Línea de junta arco-pared (sutil, refuerza la silueta de la bóveda)
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(B.left,  peakY + 18);
    ctx.lineTo(apexLeft, apexY);
    ctx.moveTo(B.right, peakY + 18);
    ctx.lineTo(apexRight, apexY);
    ctx.stroke();
  }

  // ── FLUORESCENTES (N tiras gruesas continuas a lo largo del techo) ──────
  // Cada tira se compone de 3 capas:
  //   · halo grueso difuso (luz que se "derrama" sobre la bóveda)
  //   · tubo principal (línea brillante con grosor en perspectiva)
  //   · alma central blanca (núcleo más caliente que sugiere el filamento)
  // Las tiras convergen al VP siguiendo la curvatura de la bóveda.
  _drawFluorescents(ctx, W, H, vpX, vpY) {
    const n = Math.max(1, this.cfg.numFluorescents | 0);
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1 || 1);                // 0..1
      const x1 = t * W;                          // arranque en el borde superior
      const y1 = 14 + Math.abs(0.5 - t) * 10;    // pliegue hacia los extremos
      // Convergencia hacia el VP, ligeramente arqueada como la bóveda
      const dx = (t - 0.5) * 2;                  // -1..1
      const x2 = vpX + dx * 30;
      const y2 = vpY - 10;

      const isOn = this._fluorState[i] ?? true;

      // 1 ── Halo amplio (resplandor sobre la bóveda)
      ctx.strokeStyle = isOn ? this.cfg.fluorescentGlow : 'rgba(100,100,100,0.05)';
      ctx.lineWidth   = 14;
      ctx.lineCap     = 'round';
      ctx.beginPath();
      ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
      ctx.stroke();

      // 2 ── Cuerpo del tubo (más ancho cerca de cámara, fino al VP)
      const grad = ctx.createLinearGradient(x1, y1, x2, y2);
      grad.addColorStop(0,    isOn ? this.cfg.fluorescentColor : '#555');
      grad.addColorStop(0.6,  isOn ? this.cfg.fluorescentColor : '#555');
      grad.addColorStop(1,    isOn ? '#FFFFFF' : '#888');
      ctx.strokeStyle = grad;
      ctx.lineWidth   = 4.5;
      ctx.beginPath();
      ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
      ctx.stroke();

      // 3 ── Núcleo blanco caliente (filamento)
      ctx.strokeStyle = isOn ? '#FFFFFF' : '#999';
      ctx.lineWidth   = 1.4;
      ctx.beginPath();
      ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
      ctx.stroke();

      ctx.lineCap = 'butt';   // restaurar
    }
  }

  // ── PAREDES laterales (trapecios + patrón de azulejos) ─────────────────
  _drawWalls(ctx, W, H, vpX, vpY, G) {
    const B = this._bounds;

    // Vertices de pared izquierda: trapecio (base + VP)
    const Lwall = {
      tlx: B.left, tly: B.top,
      trx: G.pVL,  try_: vpY - 10,
      brx: G.pVL,  bry: vpY + 5,
      blx: B.left, bly: H * 0.55,
    };
    const Rwall = {
      tlx: G.pVR,   tly: vpY - 10,
      trx: B.right, try_: B.top,
      brx: B.right, bry: H * 0.55,
      blx: G.pVR,   bly: vpY + 5,
    };

    // 1 ── Relleno blanco hueso de cada pared
    ctx.fillStyle = this.cfg.wallColor;
    ctx.beginPath();
    ctx.moveTo(Lwall.tlx, Lwall.tly);
    ctx.lineTo(Lwall.trx, Lwall.try_);
    ctx.lineTo(Lwall.brx, Lwall.bry);
    ctx.lineTo(Lwall.blx, Lwall.bly);
    ctx.closePath(); ctx.fill();

    ctx.beginPath();
    ctx.moveTo(Rwall.tlx, Rwall.tly);
    ctx.lineTo(Rwall.trx, Rwall.try_);
    ctx.lineTo(Rwall.brx, Rwall.bry);
    ctx.lineTo(Rwall.blx, Rwall.bly);
    ctx.closePath(); ctx.fill();

    // 2 ── Patrón de azulejos: junta horizontal cada FILA filas + vertical
    //      cada columna; las verticales convergen hacia el VP.
    this._drawTilePattern(ctx, Lwall, true);
    this._drawTilePattern(ctx, Rwall, false);

    // 3 ── Franja decorativa VERDE (en perspectiva, converge al VP)
    ctx.strokeStyle = this.cfg.wallStripeBlue;
    ctx.lineWidth   = 3;
    ctx.beginPath();
    ctx.moveTo(B.left,  H * 0.30); ctx.lineTo(G.pVL, vpY - 5);
    ctx.moveTo(B.right, H * 0.30); ctx.lineTo(G.pVR, vpY - 5);
    ctx.stroke();
    // Sombra fina debajo de la franja para darle volumen
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(B.left,  H * 0.30 + 3); ctx.lineTo(G.pVL, vpY - 5 + 0.5);
    ctx.moveTo(B.right, H * 0.30 + 3); ctx.lineTo(G.pVR, vpY - 5 + 0.5);
    ctx.stroke();
  }

  /** Dibuja la cuadrícula de azulejos (juntas) sobre el trapecio de pared.
   *  - Horizontal: 6 filas equiespaciadas (las cercanas separadas, las
   *    lejanas apretadas por perspectiva — interpolación lineal en t).
   *  - Vertical: 8 columnas; cada vertical va de (xBaseN, yBaseN) a un
   *    punto convergente cerca del VP — fuga natural.
   *  isLeft cambia la orientación de los puntos. */
  _drawTilePattern(ctx, w, isLeft) {
    const ROWS = 6, COLS = 8;
    ctx.strokeStyle = 'rgba(0,0,0,0.10)';
    ctx.lineWidth   = 1;

    // Líneas HORIZONTALES (junta superior de cada fila)
    for (let r = 1; r < ROWS; r++) {
      const t  = r / ROWS;
      // Lado base (cerca cámara) — interpolar entre TL→BL
      const xL = w.tlx + (w.blx - w.tlx) * t;
      const yL = w.tly + (w.bly - w.tly) * t;
      // Lado VP — interpolar entre TR→BR
      const xR = w.trx + (w.brx - w.trx) * t;
      const yR = w.try_ + (w.bry - w.try_) * t;
      ctx.beginPath();
      ctx.moveTo(xL, yL);
      ctx.lineTo(xR, yR);
      ctx.stroke();
    }

    // Líneas VERTICALES (junta entre azulejos contiguos en profundidad)
    // En la base equiespaciadas, en el VP convergen al mismo punto.
    for (let c = 1; c < COLS; c++) {
      const t  = c / COLS;
      // Posición X en la base
      const xBaseN = w.tlx + (w.blx - w.tlx) * 0   // base side
                     + (isLeft ? 1 : -1) * 0;
      // Más simple: interpolar TL→BL en y, mantener X de la base de pared
      // Como las paredes son trapecios delgados, las verticales van de
      // un punto del lado de la BASE a un punto del lado del VP, ambos
      // a la misma fracción t a lo largo de la altura del trapecio.
      // Punto en lado BASE: a t a lo largo de TL→BL
      const x1 = w.tlx + (w.blx - w.tlx) * t;
      const y1 = w.tly + (w.bly - w.tly) * t;
      // Punto en lado VP: a t a lo largo de TR→BR
      const x2 = w.trx + (w.brx - w.trx) * t;
      const y2 = w.try_ + (w.bry - w.try_) * t;
      // Para pintar la "vertical" del azulejo (perpendicular al avance del
      // pasillo) usamos en cambio puntos que avanzan en X de base a VP a
      // la misma fracción t de la base.
      // Reinterpretación: dividimos el TRAPECIO en columnas convergentes
      // — cada columna va de (xBase, yBase) a (xVP, yVP) a la misma t.
      const xb = w.tlx + (w.trx - w.tlx) * t;       // arriba: TL→TR
      const yb = w.tly + (w.try_ - w.tly) * t;
      const xa = w.blx + (w.brx - w.blx) * t;       // abajo: BL→BR
      const ya = w.bly + (w.bry - w.bly) * t;
      ctx.beginPath();
      ctx.moveTo(xa, ya);
      ctx.lineTo(xb, yb);
      ctx.stroke();
    }
  }

  // ── CABLES AL PIE DE LA PARED ────────────────────────────────────────────
  // Líneas paralelas que corren al pie de cada pared (entre el rodapié y el
  // suelo del andén), converger al VP — cables eléctricos / canal de
  // emergencia típicos de Metro.
  _drawWallCables(ctx, W, H, vpX, vpY, G) {
    const B = this._bounds;
    // Y de arranque (cerca cámara) y llegada (VP) — ligeramente sobre el
    // borde inferior de la pared (H*0.55) y vpY+5.
    const baseYNear = H * 0.55 - 4;
    const baseYFar  = vpY + 4;
    // 3 cables apilados (verde, gris oscuro, rojo) — colores convencionales
    const cables = [
      { color: '#3DA040', dy: 0  },     // verde (señal/datos)
      { color: '#3a3a3a', dy: 4  },     // negro grueso (alimentación)
      { color: '#A82020', dy: 8  },     // rojo (emergencia)
    ];

    // IZQUIERDA
    cables.forEach(({ color, dy }) => {
      ctx.strokeStyle = color;
      ctx.lineWidth   = 2;
      ctx.beginPath();
      ctx.moveTo(B.left,   baseYNear + dy);
      ctx.lineTo(G.pVL,    baseYFar + dy * 0.18);
      ctx.stroke();
    });

    // DERECHA
    cables.forEach(({ color, dy }) => {
      ctx.strokeStyle = color;
      ctx.lineWidth   = 2;
      ctx.beginPath();
      ctx.moveTo(B.right,  baseYNear + dy);
      ctx.lineTo(G.pVR,    baseYFar + dy * 0.18);
      ctx.stroke();
    });

    // Bandeja portacables (línea oscura encima de los cables) — efecto
    // sombra de la canal metálica que sujeta los cables.
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(B.left,  baseYNear - 2); ctx.lineTo(G.pVL, baseYFar - 0.4);
    ctx.moveTo(B.right, baseYNear - 2); ctx.lineTo(G.pVR, baseYFar - 0.4);
    ctx.stroke();
  }

  // ── CAJAS DE EMERGENCIA SOS (rojo) — montadas sobre la pared ─────────────
  // Cada lado coloca 2 cajas distribuidas en profundidad (cerca y media).
  // El tamaño escala con la perspectiva: la del fondo es más pequeña.
  _drawEmergencyBoxes(ctx, W, H, vpX, vpY, G) {
    const B = this._bounds;
    // Posiciones a lo largo del trapecio de pared, fracción 0=base 1=VP
    const ts = [0.10, 0.50];
    // Y de la caja sobre la pared (entre el techo y la franja verde)
    const wallTopY = (t) => B.top + (vpY - 10 - B.top) * t;
    const wallBotY = (t) => H * 0.55 + (vpY + 5 - H * 0.55) * t;

    const drawBox = (cx, cy, size) => {
      const w = size, h = size * 1.4;
      // Sombra
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(cx - w/2 + 1, cy - h/2 + 1, w, h);
      // Cuerpo rojo
      ctx.fillStyle = '#C81313';
      ctx.fillRect(cx - w/2, cy - h/2, w, h);
      // Reborde brillante (luz superior izq)
      ctx.fillStyle = '#FF4848';
      ctx.fillRect(cx - w/2, cy - h/2, w, Math.max(1, h * 0.18));
      ctx.fillRect(cx - w/2, cy - h/2, Math.max(1, w * 0.18), h);
      // Sombra inferior
      ctx.fillStyle = '#7A0808';
      ctx.fillRect(cx - w/2, cy + h/2 - Math.max(1, h * 0.15), w, Math.max(1, h * 0.15));
      // Cristal central (más oscuro)
      if (size >= 8) {
        ctx.fillStyle = '#3A0808';
        const gx = cx - w * 0.30, gy = cy - h * 0.20;
        ctx.fillRect(gx, gy, w * 0.60, h * 0.40);
      }
    };

    for (const t of ts) {
      const yMid = (wallTopY(t) + wallBotY(t)) / 2;
      // Tamaño en perspectiva: cerca grande, lejos pequeño
      const size = Math.max(4, 22 * (1 - t * 0.7));
      // X izquierda: interpolación entre el borde del canvas y G.pVL
      const xL = B.left + (G.pVL - B.left) * t + size * 0.7;
      const xR = B.right + (G.pVR - B.right) * t - size * 0.7;
      drawBox(xL, yMid + 4, size);
      drawBox(xR, yMid + 4, size);
    }
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

  // ── BANCOS METÁLICOS ────────────────────────────────────────────────────
  // Asientos clásicos del Metro de Madrid (blanco/gris claro), apoyados
  // sobre el andén. Se pintan en escala según la distancia al VP.
  _drawBenches(ctx, W, H, vpX, vpY, G) {
    const n = Math.max(0, this.cfg.numBenches | 0);
    if (n === 0) return;
    // Posición Y donde apoyan los bancos: entre el suelo del andén y el
    // borde con la vía (mitad inferior del andén visible).
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const scale = 1 - t * 0.6;              // 1.00 → 0.40
      // Y interpolada entre el frente del andén (cerca) y el VP (lejos)
      const y = Math.round(H * 0.62 + t * (vpY + 14 - H * 0.62));
      // Acercar el banco al borde de la pared correspondiente
      const xLeftBase  = Math.round(W * 0.06 + t * (vpX - 60 - W * 0.06));
      const xRightBase = Math.round(W * 0.94 - 30 - t * (W * 0.94 - vpX - 30 - 30));
      this._drawBench(ctx, xLeftBase,  y, scale);
      this._drawBench(ctx, xRightBase, y, scale);
    }
  }

  _drawBench(ctx, x, y, scale) {
    const s = (v) => Math.max(1, Math.round(v * scale));
    const W = s(30);
    // Patas
    ctx.fillStyle = this.cfg.benchLegColor;
    ctx.fillRect(x + s(2),     y + s(3), s(1), s(4));
    ctx.fillRect(x + W - s(3), y + s(3), s(1), s(4));
    // Asiento
    ctx.fillStyle = this.cfg.benchBodyColor;
    ctx.fillRect(x, y, W, s(3));
    ctx.fillStyle = this.cfg.benchTopColor;
    ctx.fillRect(x, y, W, s(1));
    // Respaldo (atrás del asiento)
    ctx.fillStyle = '#CCCCCC';
    ctx.fillRect(x, y - s(7), W, s(1));
    ctx.fillStyle = this.cfg.benchShadowColor;
    ctx.fillRect(x + s(2),     y - s(7), s(1), s(7));
    ctx.fillRect(x + W - s(3), y - s(7), s(1), s(7));
  }

  // ── Escala de animación de la boca de túnel ─────────────────────────────
  // Curva temporal en función de la fracción _elapsed/durationSeconds:
  //   · t = 0    → 0.50:  VISTA ESTABLE de la estación (arco pequeño al fondo)
  //   · t = 0.50 → 1.00:  ACERCAMIENTO EXPONENCIAL al siguiente túnel
  //                       — el arco se expande para sugerir movimiento hacia
  //                       el siguiente túnel, justo antes del cross-fade
  //                       circular que orquesta MetroBase.
  //
  // Devuelve un multiplicador positivo (1.0 = tamaño base, sin animación).
  _tunnelMouthAnimScale() {
    const dur = this.cfg.durationSeconds;
    if (!dur || dur <= 0) return 1;
    const t = Math.min(1, Math.max(0, this._elapsed / dur));

    // ── Fase 1: estación visible (estable a 1.0) ──────────────────────────
    if (t < 0.50) {
      return 1.0;
    }
    // ── Fase 2: ACERCAMIENTO EXPONENCIAL al siguiente túnel ───────────────
    // Escala máxima reducida (1.0 → 4.5) para que el cambio de transición
    // se vea más contenido, sin que el arco invada toda la pantalla.
    const local = (t - 0.50) / 0.50;
    const eased = Math.pow(local, 3);
    return 1.0 + 3.5 * eased;
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
    // Forma "boca de túnel" REAL — paredes verticales claramente visibles +
    // semicírculo arriba. Mismas proporciones EXACTAS que el arco del
    // TunelBase para que estación y túnel estén interconectados visualmente.
    const BASE_SCALE = 0.45;
    const animScale = this._tunnelMouthAnimScale();
    const scale     = BASE_SCALE * animScale;
    // Dimensiones unificadas con TunelBase (mismos números):
    const innerHalf = Math.max(28, W * 0.075) * scale;   // semianchura interior
    const sidesH    = innerHalf * 0.85;                  // sides ~85% del radio
    const frameW    = Math.max(3, innerHalf * 0.10);     // marco ~10% del radio

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

    // 6. Luces de señalización ferroviaria al fondo del túnel
    //    (rojo a la izquierda + verde a la derecha — semáforos de vía)
    //    Sólo visibles cuando la boca aún es pequeña; al ampliarse durante
    //    la transición, las señales quedan fuera del marco visible.
    if (animScale < 1.6) {
      const sigR = Math.max(1.5, innerHalf * 0.10);
      const sigY = baseY - sidesH * 0.55;
      const sigOff = innerHalf * 0.45;
      const drawSignal = (cx, color, glowColor) => {
        // Halo difuso
        const halo = ctx.createRadialGradient(cx, sigY, 0, cx, sigY, sigR * 4);
        halo.addColorStop(0,   glowColor);
        halo.addColorStop(0.5, glowColor.replace(/[\d.]+\)$/, '0.18)'));
        halo.addColorStop(1,   glowColor.replace(/[\d.]+\)$/, '0)'));
        ctx.fillStyle = halo;
        ctx.fillRect(cx - sigR * 4, sigY - sigR * 4, sigR * 8, sigR * 8);
        // Bombilla
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(cx, sigY, sigR, 0, Math.PI * 2);
        ctx.fill();
        // Brillo central
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.beginPath();
        ctx.arc(cx - sigR * 0.25, sigY - sigR * 0.25, sigR * 0.35, 0, Math.PI * 2);
        ctx.fill();
      };
      drawSignal(vpX - sigOff, '#FF2A2A', 'rgba(255,60,60,0.55)');
      drawSignal(vpX + sigOff, '#22DD33', 'rgba(60,255,80,0.55)');
    }
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
    const B = this._bounds;
    ctx.fillStyle = this.cfg.platformColor;

    // Andén izquierdo
    ctx.beginPath();
    ctx.moveTo(B.left, B.bottom);
    ctx.lineTo(G.pBL,  H);
    ctx.lineTo(G.pVL,  vpY + 5);
    ctx.lineTo(B.left, H * 0.55);
    ctx.closePath();
    ctx.fill();

    // Andén derecho
    ctx.beginPath();
    ctx.moveTo(B.right, B.bottom);
    ctx.lineTo(G.pBR,   H);
    ctx.lineTo(G.pVR,   vpY + 5);
    ctx.lineTo(B.right, H * 0.55);
    ctx.closePath();
    ctx.fill();
  }

  // ── FRENTE METÁLICO DEL ANDÉN (cae al foso de la vía) ────────────────────
  // En las estaciones reales, justo bajo la línea amarilla de seguridad hay
  // una franja vertical metálica plateada que es la "pared" del andén
  // mirando hacia la vía. Le da volumen al andén — sin esto, el andén se
  // ve como una alfombra plana en el suelo. La pintamos como un trapecio
  // que conecta el borde del andén (G.pBL/pBR) con un punto un poco más
  // bajo, simulando los ~1m de altura del andén respecto al raíl.
  _drawPlatformFront(ctx, W, H, vpX, vpY, G) {
    const B = this._bounds;
    const drop = Math.max(3, H * 0.012);   // grosor de la franja (px)
    const dropVP = Math.max(1, H * 0.003); // grosor en el VP (perspectiva)

    // Cara izquierda
    ctx.fillStyle = this.cfg.platformFrontColor;
    ctx.beginPath();
    ctx.moveTo(B.left,      H * 0.55);
    ctx.lineTo(G.pVL,       vpY + 5);
    ctx.lineTo(G.pVL,       vpY + 5 + dropVP);
    ctx.lineTo(B.left,      H * 0.55 + drop);
    ctx.closePath();
    ctx.fill();

    // Sombra inferior (borde con la vía)
    ctx.fillStyle = this.cfg.platformFrontShade;
    ctx.beginPath();
    ctx.moveTo(B.left,      H * 0.55 + drop * 0.7);
    ctx.lineTo(G.pVL,       vpY + 5 + dropVP * 0.7);
    ctx.lineTo(G.pVL,       vpY + 5 + dropVP);
    ctx.lineTo(B.left,      H * 0.55 + drop);
    ctx.closePath();
    ctx.fill();

    // Cara derecha (espejo)
    ctx.fillStyle = this.cfg.platformFrontColor;
    ctx.beginPath();
    ctx.moveTo(B.right,     H * 0.55);
    ctx.lineTo(G.pVR,       vpY + 5);
    ctx.lineTo(G.pVR,       vpY + 5 + dropVP);
    ctx.lineTo(B.right,     H * 0.55 + drop);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = this.cfg.platformFrontShade;
    ctx.beginPath();
    ctx.moveTo(B.right,     H * 0.55 + drop * 0.7);
    ctx.lineTo(G.pVR,       vpY + 5 + dropVP * 0.7);
    ctx.lineTo(G.pVR,       vpY + 5 + dropVP);
    ctx.lineTo(B.right,     H * 0.55 + drop);
    ctx.closePath();
    ctx.fill();
  }

  // ── CARTELES COLGANTES DE DESTINO ────────────────────────────────────────
  // Letreros oscuros con texto LED ámbar colgados del techo por dos cables,
  // uno sobre cada andén. Replican los carteles "Próximo Tren · MONCLOA"
  // del Metro de Madrid. Si numHangingSigns > 2, se distribuyen a lo largo
  // del andén con escala de perspectiva.
  _drawHangingSigns(ctx, W, H, vpX, vpY) {
    const n = Math.max(0, this.cfg.numHangingSigns | 0);
    if (n === 0) return;

    const rightText = (this.cfg.andenRightDestination ?? 'MONCLOA').toUpperCase();
    const leftText  = (this.cfg.andenLeftDestination  ?? 'EL CASAR').toUpperCase();

    // Línea de techo desde donde "cuelgan" los cables. La ponemos por
    // debajo del HUD de progreso (~70px) para que los cables no se
    // mezclen con la barra de estaciones.
    const ceilingY = Math.max(70, H * 0.10);

    // Distribución: para n=2 → uno sobre cada andén centrado.
    // Para n=4 → dos por lado escalados en profundidad.
    const perSide = Math.ceil(n / 2);
    for (let side = 0; side < 2; side++) {
      const isLeft = side === 0;
      const text       = isLeft ? leftText : rightText;
      const andenLabel = isLeft ? 'Andén 2' : 'Andén 1';
      for (let i = 0; i < perSide; i++) {
        const t = perSide === 1 ? 0.0 : i / (perSide - 1);
        const scale  = 1 - t * 0.55;            // 1.00 → 0.45
        // Centro horizontal del andén a esta profundidad.
        const nearCx = isLeft ? W * 0.22 : W * 0.78;
        const farCx  = isLeft ? vpX - 28 : vpX + 28;
        const cx     = Math.round((1 - t) * nearCx + t * farCx);
        // Y del cartel — a la altura del horizonte del andén.
        const nearY  = vpY * 0.55;
        const farY   = vpY * 0.30;
        const baseY  = Math.round((1 - t) * nearY + t * farY);
        this._drawHangingSign(ctx, cx, baseY, scale, andenLabel, text, isLeft, ceilingY);
      }
    }
  }

  _drawHangingSign(ctx, cx, baseY, scale, andenLabel, destText, isLeft, ceilingY) {
    const s = (v) => Math.max(1, Math.round(v * scale));
    const w = s(96);
    const h = s(26);
    const y = baseY;

    // ── PERSPECTIVA 3D del cartel según el offset de cámara ────────────────
    // Cuando la paloma se desplaza, los carteles se ven INCLINADOS:
    //   · El lado del cartel hacia donde se mueve la cámara se ve más
    //     estrecho (es el lado "lejos") y desplazado verticalmente.
    //   · El lado opuesto (cerca de la cámara) se ve más ancho y bajo.
    //   · Esto simula una rotación leve en el eje vertical.
    //
    // El cartel se dibuja como TRAPECIO con 4 vértices (TL, TR, BR, BL)
    // ajustados según nx = offsetX / maxX (∈ -1..1).
    const maxX = canvas.width * CAMERA_RANGE_X;
    const nx   = maxX > 0 ? camera.offsetX / maxX : 0;
    // Inclinación: hasta 30 % de "encogimiento" en un lado del cartel
    const tilt = nx * 0.30;
    // Lado del cartel "lejos" (hacia donde mira la cámara) se encoje
    const xL  = cx - w / 2;
    const xR  = cx + w / 2;
    // Si nx > 0 (paloma derecha), el lado IZQUIERDO del cartel queda lejos
    const inL = tilt > 0 ? Math.abs(tilt) * w * 0.5 : 0;
    const inR = tilt < 0 ? Math.abs(tilt) * w * 0.5 : 0;
    const dyL = tilt > 0 ? Math.abs(tilt) * h * 0.4 : 0;
    const dyR = tilt < 0 ? Math.abs(tilt) * h * 0.4 : 0;
    // Vértices finales del trapezoide
    const tlx = xL + inL, tly = y + dyL;
    const trx = xR - inR, try_ = y + dyR;
    const brx = xR - inR, bry = y + h - dyR;
    const blx = xL + inL, bly = y + h - dyL;

    // Cables al techo — arrancan en ceilingY (debajo del HUD) y bajan
    // hasta el letrero. Siguen los vértices superiores del trapezoide
    // (asomados según la inclinación) para mantener coherencia visual.
    ctx.fillStyle = this.cfg.hangingSignCable;
    ctx.fillRect(Math.round(tlx + s(12)), ceilingY, Math.max(1, s(1)), tly - ceilingY);
    ctx.fillRect(Math.round(trx - s(13)), ceilingY, Math.max(1, s(1)), try_ - ceilingY);

    // Helper para pintar un trapezoide del color dado (con un pequeño
    // inflado para el marco oscuro).
    const fillTrap = (ox, color) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(tlx - ox, tly - ox);
      ctx.lineTo(trx + ox, try_ - ox);
      ctx.lineTo(brx + ox, bry + ox);
      ctx.lineTo(blx - ox, bly + ox);
      ctx.closePath();
      ctx.fill();
    };

    // Marco oscuro (inflado 1px)
    fillTrap(1, '#1a1a22');
    // Cuerpo del cartel
    fillTrap(0, this.cfg.hangingSignBg);
    // Highlight superior (banda fina)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.beginPath();
    ctx.moveTo(tlx, tly);
    ctx.lineTo(trx, try_);
    ctx.lineTo(trx, try_ + Math.max(1, s(2)));
    ctx.lineTo(tlx, tly  + Math.max(1, s(2)));
    ctx.closePath();
    ctx.fill();

    if (scale > 0.55) {
      // El texto NO se inclina (ctx.fillText no soporta perspectiva
      // fácilmente); solo se centra entre los vértices izq y der del
      // trapezoide y se desplaza verticalmente con el lado central.
      const textCx = (tlx + trx) / 2;
      const yMid   = (tly + try_) / 2;
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#88AADD';
      ctx.font      = `${Math.max(4, s(5))}px monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(andenLabel, textCx, yMid + s(6));

      const arrow = isLeft ? '←' : '→';
      ctx.fillStyle = this.cfg.hangingSignText;
      ctx.font      = `bold ${Math.max(5, s(9))}px monospace`;
      ctx.fillText(`${arrow} ${destText}`, textCx, yMid + s(17));

      ctx.textAlign    = 'left';
      ctx.textBaseline = 'alphabetic';
    } else {
      ctx.fillStyle = this.cfg.hangingSignText;
      ctx.fillRect(tlx + s(8), tly + s(8), (trx - tlx) - s(16), Math.max(1, s(2)));
    }
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
    // Calcular techo del marco del arco (debe coincidir con _drawTunnelMouth,
    // incluyendo la animación de tamaño)
    const scale     = 0.45 * this._tunnelMouthAnimScale();
    const innerHalf = Math.max(28, W * 0.075) * scale;
    const sidesH    = innerHalf * 0.85;
    const frameW    = Math.max(3, innerHalf * 0.10);
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
    // 0.85 (antes 0.95) → trenes más estrechos, ~51 % del canvas entre ambos.
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

      // Escala de tren: el tren ocupa ~95 % del ancho de vía a esa profundidad.
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
