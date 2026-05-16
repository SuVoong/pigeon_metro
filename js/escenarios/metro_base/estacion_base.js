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
import { drawTunelTracks } from './tunel.js';

const DEFAULT_CONFIG = {
  // ── Geometría ───────────────────────────────────────────────────────────
  // VP a 0.30 — el techo ocupa MENOS canvas y queda más cerca del suelo.
  vanishingPointY:    0.30,    // fracción del canvas donde está el punto de fuga
  // Dónde empieza el suelo del andén en la base del cuadro (fracción de H).
  // 0.664 = bajado un 20% de la distancia restante al canvas bottom respecto
  // al 0.58 anterior (0.58 + 0.42*0.20 = 0.664). El suelo queda más cerca
  // de los rieles, reduciendo la franja del bordillo proyectada y dando
  // sensación de andén más bajo, más al ras del balasto.
  platformTopRatio:   0.664,   // fracción del canvas donde el suelo toca la pared
  platformWidthRatio: 0.25,    // ancho del andén en primer plano (fracción)
  platformWidthVP:    0.04,    // ancho del andén en el punto de fuga (fracción)

  // ── Vías y carriles ─────────────────────────────────────────────────────
  // Todas las distancias horizontales son FRACCIONES DEL ANCHO DEL CANVAS
  // (×100 para que el editor muestre números legibles tipo 32, 2.5, etc.).
  // Esto produce un trapecio fuerte: las vías ocupan ~64% del ancho en la
  // base (cerca de la cámara) y se cierran al ~3% en el punto de fuga.
  // trackOuterOffset 41 (era 36, +15% según pedido): foso 15% más grande
  // visualmente. Los carriles, balasto y borde del andén se escalan
  // juntos para mantener proporciones (rail externo ↔ bordillo del andén).
  trackOuterOffset:   41.4,    // % de W al carril exterior (BASE)
  trackInnerOffset:   13.8,    // % de W al carril interior (BASE)
  trackOuterOffsetVP: 2.76,    // % de W al carril exterior (VP)
  trackInnerOffsetVP: 1.96,    // % de W al carril interior (VP)
  // Ratios decimales para pasar a drawTunelTracks (tunel.js).
  trackOuterRatio:    0.414,
  trackInnerRatio:    0.138,
  trackOuterRatioVP:  0.0276,
  trackInnerRatioVP:  0.0196,
  // Borde del andén (donde el suelo gris se corta y empieza el foso de la vía).
  // REDUCIDO 34→28: con 34% el andén cerca de cámara era muy estrecho (~205 px
  // de 1280) → trapecio con perspectiva INVERTIDA (más ancho al fondo que
  // adelante) que se leía como muro inclinado. Con 28% el andén cerca de
  // cámara mide ~282 px (+37%) y el foso central baja de 870 → 716 px (-18%),
  // dando lectura más horizontal y menos dominante del foso. 28% sigue por
  // encima de trackOuterOffset=25.5%, así el bordillo no invade los rieles.
  // platformEdgeOffset 44.85 (era 39, +15%): borde del andén se aleja del
  // centro proporcionalmente al rail externo (41.4%), conservando el
  // voladizo de ~3% sobre la vía. Esto hace el FOSO 15% más grande.
  platformEdgeOffset:   44.85,  // % de W desde centro al borde inferior del andén
  // platformEdgeOffsetVP escalado al mismo factor que trackOuterOffsetVP
  // para mantener la convergencia paralela en el VP.
  platformEdgeOffsetVP: 2.875,  // % de W al borde del andén en el VP
  numSleepers:        16,
  // (Las traviesas, balasto y carriles los pinta drawTunelTracks delegando
  // en tunel.js — no se configuran desde aquí.)

  // ── Andén ───────────────────────────────────────────────────────────────
  // Suelo del andén: hormigón claro pero PERCEPTIBLEMENTE distinto al
  // rail floor (rail = #1C1F25 oscuro). Si fueran idénticos, el andén se
  // mezclaría visualmente con la zona de las vías y daría sensación de
  // flotar. Con un gris medio el andén se lee como ZONA PEATONAL distinta
  // de la zona ferroviaria, sin volver al terrazo de baldosas damero.
  // Hormigón claro tipo Madrid Metro (plano #14): el suelo del andén debe
  // contrastar con la pared amarilla y con el balasto oscuro. Antes era un
  // gris azulado oscuro (#3D424B) casi idéntico al balasto → andén y foso
  // se fundían. Ahora es hormigón claro cálido y se lee como plataforma.
  platformColor:      '#28F064',   // verde brillante (mismo que el overlay)
  platformColorLight: '#58F484',   // verde más claro (veta)
  platformColorShade: '#1AB048',   // verde sombra (junta)
  platformEdgeYellow: '#FFCC00',
  // Patrón mínimo de baldosas — sólo subraya la horizontalidad, sin damero.
  platformTileRows:   6,
  platformTileCols:   3,
  // Banda podotáctil amarilla CONTINUA (referencia plano #6 — detalle andén)
  // Sustituye al patrón disperso de puntos por una banda señalizadora
  // homogénea, tal como exige la normativa de accesibilidad.
  tactileBandColor:   '#F5C518',   // amarillo señalética
  tactileBandShadow:  '#A88210',   // sombra inferior para volumen
  // Banda señalizadora: dominante respecto al bordillo (jerarquía visual:
  // la señalética debe leerse antes que la cara vertical). 22 px ≈ "30 cm
  // equivalentes" en el plano del andén; el bordillo vertical va a ~18 px
  // (~20 cm) en _drawPlatformOverhang.
  tactileBandWidth:   22,

  // ── Paredes ─────────────────────────────────────────────────────────────
  // Plano de sección transversal #13 (revestimiento de pared): el revestimiento
  // amarillo de azulejo es la firma visual de muchas estaciones de Metro de
  // Madrid (incluida Pueblo Nuevo de la L5). Acompaña al friso azul superior
  // que lleva el nombre de la estación (#12).
  wallColor:          '#F2C42A',     // amarillo azulejo zócalo (mitad inferior)
  wallColorShade:     '#C99A18',     // sombra para junta de azulejo
  wallTopColor:       '#E8E2D5',     // blanco crema de la parte alta de la pared
                                       // (continuación visual de la bóveda)
  wallSplitRatio:     0.55,           // 0=todo blanco, 1=todo amarillo; 0.55
                                       // = ~mitad inferior amarilla (zócalo)
                                       // como en estaciones reales de Metro Madrid

  // ── Techo ───────────────────────────────────────────────────────────────
  ceilingColor:       '#D5D0C7',     // bóveda blanco crema (antes #9C9890 gris)
  ceilingBandTop:     '#B0AAA0',     // sombra superior del arco

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

  // ── Boca de túnel ──────────────────────────────────────────────────────
  // Color del marco del arco de hormigón que rodea la entrada al túnel.
  tunnelMouthFrame:   '#555560',

  // ── Catenaria rígida (ref. plano sección transversal #11) ──────────────
  // Carril aéreo de aluminio que alimenta el pantógrafo del tren. Dos perfiles
  // suspendidos del techo, uno sobre cada vía, con ménsulas verticales
  // periódicas que los anclan a la bóveda.
  showCatenary:        true,
  catenaryRailColor:   '#9AA8B8',   // aluminio brillante
  catenaryRailShadow:  '#4F5662',   // sombra inferior del perfil
  catenaryHangerColor: '#3A3A45',   // colgador / aislador
  catenaryHangers:     6,           // n.º de ménsulas visibles a lo largo

  // ── Friso azul de identidad de estación (ref. plano #12) ───────────────
  // Banda azul horizontal con el nombre de la estación repetido, montada
  // sobre la pared (entre la franja decorativa y el rodapié de cables).
  // Se dibuja en perspectiva sobre cada andén.
  showStationFrieze:   true,
  friezeBgColor:       '#1A3A8A',   // azul Metro de Madrid
  friezeTextColor:     '#FFFFFF',
  friezeBorderColor:   '#0E2560',   // sombra inferior del friso

  // ── Puertas/accesos en la pared amarilla (DESACTIVADO) ─────────────────
  // Quitadas a petición — la pared amarilla queda limpia con solo el friso
  // azul como elemento de identidad.
  showWallDoors:       false,
  numWallDoors:        3,
  doorFrameColor:      '#E8DFC8',
  doorBodyColor:       '#3A3F4A',
  doorAccentColor:     '#9098A8',
  doorHandleColor:     '#FFFFFF',

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

  // ── Frente metálico del andén (PIERNA VERTICAL DE LA L) ──────────────
  // Color OSCURO y saturado para crear contraste claro con el suelo del
  // andén (gris claro) y formar una L visible:
  //   suelo claro #B8B8C2 ─┐
  //                        ╱──── codo de la L (highlight blanco)
  //   frente oscuro #3F4654─╲   ← pierna vertical, contraste fuerte
  //                          ╲
  //   sombra muy oscura ─────  pie del frente (junta con balasto)
  // Frente del andén: hormigón GRIS MEDIO — la cara del bordillo en una
  // estación real es un escalón de hormigón claro/medio, no un muro negro.
  // El contraste con el balasto gris oscuro y el suelo del andén casi
  // blanco basta para que el desnivel se lea sin necesidad de negro puro.
  platformFrontColor: '#5C4F3F',    // gris-marrón oscuro (cara bordillo)
                                       // Contraste claro con el andén beige (#D5C9B5)
                                       // para que el desnivel se lea bien en vista alta
  platformFrontShade: '#3F3528',    // sombra del pie (junta con balasto)

  // ── Pasajeros (DESACTIVADO a petición) ─────────────────────────────────
  // Las siluetas en las esquinas se han quitado para mantener la composición
  // limpia. Si se quieren reactivar, subir estos valores >0.
  numPassengersLeft:  0,
  numPassengersRight: 0,

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

  // ── Flags de elementos opcionales del render ────────────────────────────
  // Permiten deshabilitar elementos secundarios para obtener una vista
  // limpia que enfatice la lectura espacial (andén + foso + bordillo) sin
  // los adornos de la vista de juego. Útil para mockups y plantillas.
  showHangingSigns:    true,   // carteles colgantes "→ Destino"
  showLEDScreen:       true,   // pantalla LED "SENTIDO X"
  showMetroLogo:       true,   // letrero Metro sobre el arco
  showEmergencyBoxes:  true,   // cajas rojas de emergencia
  showCatenary:        true,   // catenaria rígida pegada al techo
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
    // En la práctica sólo aparece UN tren por escena: con la duración por
    // defecto (5 s), trainArrivalDelaySec=1.5, trainSpeed=0.5 y exit=1.5,
    // el tren llega a progress=1.5 en t=4.5 s y la escena termina en t=5 s.
    // Para flujo continuo habría que subir durationSeconds o bajar el delay.
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
      const handle = setTimeout(() => {
        this._fluorState[i] = true;
        // Purgar el handle vencido para que el array no crezca sin techo
        // mientras la escena vive (init() ya hace clearTimeout en bloque).
        const idx = this._fluorTimers.indexOf(handle);
        if (idx !== -1) this._fluorTimers.splice(idx, 1);
      }, 80 + Math.random() * 200);
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
    this._drawStationFrieze(ctx, W, H, vpX, vpY, G);
    this._drawWallDoors    (ctx, W, H, vpX, vpY, G);
    if (this.cfg.showEmergencyBoxes !== false) this._drawEmergencyBoxes(ctx, W, H, vpX, vpY, G);
    this._drawSigns        (ctx, W, H, vpX, vpY);
    this._drawPlatforms    (ctx, W, H, vpX, vpY, G);
    // _drawPlatformFront ELIMINADO: el frente vertical lo dibuja ahora
    // _drawPlatformOverhang como una sola pieza, evitando doble caída.
    this._drawBenches      (ctx, W, H, vpX, vpY, G);
    this._drawPlatformTactile(ctx, W, H, vpX, vpY, G);
    // Orden: cara del bordillo PRIMERO (cubre el lateral del foso),
    // luego las vías ENCIMA. Así los rieles del foso quedan visibles
    // donde la cara del bordillo se solapa con su trazado.
    this._drawPlatformOverhang(ctx, W, H, vpX, vpY, G);
    this._drawTracks       (ctx, W, H, vpX, vpY, G);
    this._drawSafetyLines  (ctx, W, H, vpX, vpY, G);
    this._drawPassengers   (ctx, W, H);
    // Tren frontal desactivado — el sprite "flotaba" sobre los rieles en
    // perspectiva media (no tiene chasis ni sombra visible) y rompía la
    // lectura espacial de la escena. Para reactivar: descomentar la línea.
    // this._drawTrains       (ctx, W, H, vpX, vpY, G);
    // Boca de túnel: se dibuja DESPUÉS de las vías y los trenes para que
    // los trenes parezcan SALIR del túnel (los pequeños del fondo quedan
    // tapados por la boca, los grandes que se acercan la sobrepasan).
    this._drawTunnelMouth  (ctx, W, H, vpX, vpY, G);
    // Catenaria DESPUÉS de la boca del túnel para que las líneas de
    // alimentación queden visibles colgando frente al arco oscuro del fondo.
    if (this.cfg.showCatenary !== false) this._drawCatenary(ctx, W, H, vpX, vpY, G);
    // LED y logo Metro encima del arco (cuelgan del techo / pared frontal)
    if (this.cfg.showLEDScreen !== false) this._drawLEDScreen(ctx, W, H, vpX, vpY);
    if (this.cfg.showMetroLogo !== false) this._drawMetroLogo(ctx, W, H, vpX, vpY);
    // Carteles colgantes de destino sobre cada andén — al final para que
    // queden por encima de las paredes pero tapados por trenes cercanos.
    if (this.cfg.showHangingSigns !== false) this._drawHangingSigns(ctx, W, H, vpX, vpY);
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

    // Vertices de pared izquierda: trapecio (base + VP).
    // bly = B.bottom (extiende la pared hasta el suelo del canvas) para que
    // el borde inferior de la pared sea una RECTA EN PERSPECTIVA desde el
    // VP (G.pVL, vpY+5) hasta off-canvas-bottom-left (B.left, B.bottom).
    // Antes bly=platformTop daba un borde HORIZONTAL fijo que rompía la
    // perspectiva del suelo del andén (que necesita su borde exterior
    // PARALELO al borde del balasto en perspectiva). El andén se dibuja
    // ENCIMA de la pared en _drawPlatforms — la pared visible es sólo lo
    // que queda fuera del trapecio del andén.
    const Lwall = {
      tlx: B.left, tly: B.top,
      trx: G.pVL,  try_: vpY - 10,
      brx: G.pVL,  bry: vpY + 5,
      blx: B.left, bly: B.bottom,
    };
    const Rwall = {
      tlx: G.pVR,   tly: vpY - 10,
      trx: B.right, try_: B.top,
      brx: B.right, bry: B.bottom,
      blx: G.pVR,   bly: vpY + 5,
    };

    // 1 ── PARED DIVIDIDA: parte alta blanca crema (continuación de la bóveda)
    // + zócalo amarillo en la parte baja. La línea de split corre paralela
    // al techo del andén (línea base inferior del trapecio) a una altura
    // controlada por wallSplitRatio (0=todo blanco, 1=todo zócalo amarillo).
    // En estaciones reales del Metro de Madrid el zócalo amarillo de
    // azulejo ocupa la mitad inferior; la parte alta es hormigón blanco
    // visto, continuación de la bóveda.
    const splitR = this.cfg.wallSplitRatio ?? 0.55;
    const fillWall = (W2) => {
      const sx_tl = W2.tlx;  const sy_tl = W2.tly;
      const sx_tr = W2.trx;  const sy_tr = W2.try_;
      const sx_br = W2.brx;  const sy_br = W2.bry;
      const sx_bl = W2.blx;  const sy_bl = W2.bly;
      // Punto de split en cada lado (interpolación lineal vertical en el
      // trapecio: t=0 arriba, t=1 abajo). Se mide desde el TOP hacia el BOT.
      const tSplit = 1 - splitR;     // t pequeño = línea de split CERCA del top
      const sxL = sx_tl + (sx_bl - sx_tl) * tSplit;
      const syL = sy_tl + (sy_bl - sy_tl) * tSplit;
      const sxR = sx_tr + (sx_br - sx_tr) * tSplit;
      const syR = sy_tr + (sy_br - sy_tr) * tSplit;

      // Parte alta (TL → TR → splitR → splitL): BLANCO CREMA
      ctx.fillStyle = this.cfg.wallTopColor;
      ctx.beginPath();
      ctx.moveTo(sx_tl, sy_tl);
      ctx.lineTo(sx_tr, sy_tr);
      ctx.lineTo(sxR,   syR);
      ctx.lineTo(sxL,   syL);
      ctx.closePath(); ctx.fill();

      // Parte baja (split → BR → BL): ZÓCALO AMARILLO
      ctx.fillStyle = this.cfg.wallColor;
      ctx.beginPath();
      ctx.moveTo(sxL,   syL);
      ctx.lineTo(sxR,   syR);
      ctx.lineTo(sx_br, sy_br);
      ctx.lineTo(sx_bl, sy_bl);
      ctx.closePath(); ctx.fill();
    };
    fillWall(Lwall);
    fillWall(Rwall);

    // 2 ── Patrón de azulejos: junta horizontal cada FILA filas + vertical
    //      cada columna; las verticales convergen hacia el VP.
    this._drawTilePattern(ctx, Lwall, true);
    this._drawTilePattern(ctx, Rwall, false);

    // (Antes había una franja diagonal azul que cruzaba toda la pared. Quitada
    // porque al inclinar la cámara hacia abajo, la diagonal se acentuaba mucho
    // y creaba ruido visual sobre la pared limpia. El friso azul superior basta
    // como elemento de identidad cromática de la línea.)
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

    // Líneas VERTICALES (junta entre azulejos contiguos en profundidad).
    // Dividimos el trapecio en columnas convergentes: cada columna va de un
    // punto del lado superior (TL→TR) a un punto del lado inferior (BL→BR)
    // a la misma fracción t.
    for (let c = 1; c < COLS; c++) {
      const t  = c / COLS;
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
    const baseYNear = H * this.cfg.platformTopRatio - 4;
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
    const _platformTopY = H * this.cfg.platformTopRatio;
    const wallBotY = (t) => _platformTopY + (vpY + 5 - _platformTopY) * t;

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
    const BASE_SCALE = 0.32;
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
    ctx.fillStyle = cfg.tunnelMouthFrame;
    archPath(innerHalf + frameW, sidesH + frameW);
    ctx.fill();

    // 2. INTERIOR del túnel — agujero negro real, sin gradiente claro.
    //    Como en estaciones reales: el túnel se aleja y no se ve nada
    //    dentro. Sólo un núcleo absolutamente negro con un mínimo de
    //    desaturación cerca del marco para suavizar el corte.
    const grad = ctx.createRadialGradient(vpX, baseY - sidesH * 0.5, 1,
                                           vpX, baseY - sidesH * 0.5, innerHalf * 1.3);
    grad.addColorStop(0,    'rgba(0, 0, 0, 1)');
    grad.addColorStop(0.7,  'rgba(0, 0, 0, 1)');
    grad.addColorStop(1,    'rgba(12, 12, 15, 1)');
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

  // ── ANDENES (suelo gris claro con baldosas en perspectiva) ──────────────
  // El andén forma un trapecio: ancho en la base (cerca de la cámara) y
  // estrecho al fondo del túnel. Sobre el relleno base dibujamos un patrón
  // de baldosas de terrazo (alternando claro/oscuro) que en perspectiva da
  // sensación de profundidad y refuerza la lectura "este es el suelo donde
  // espero al metro" — igual que las fotos reales del Metro de Madrid.
  _drawPlatforms(ctx, W, H, vpX, vpY, G) {
    const B = this._bounds;

    // Vértices del trapecio de cada andén — TRIÁNGULOS en perspectiva
    // PARALELA AL SUELO DEL BALASTO:
    //   · apex (top): converge al VP en (G.pVL/G.pVR, vpY+5)
    //   · base (bottom): ancha cerca de cámara, desde el canvas edge
    //     (B.left/B.right) hasta el borde del andén (G.pBL/G.pBR)
    // Ambos bordes (exterior e interior) convergen al MISMO APEX en el VP,
    // igual que los bordes del foso/balasto. Esto da lectura de "suelo
    // horizontal en perspectiva" en vez de "muro inclinado".
    // La pared se extendió a B.bottom (ver _drawWalls) para cubrir la
    // región fuera del triángulo del andén.
    // APEX subido ~25 px (vpY - 20 en lugar de vpY + 5) — el suelo verde
    // se eleva visualmente, extendiendo el triángulo más hacia arriba en
    // el canvas. El bordillo también usa este apex en platformVP (ver
    // _drawPlatformOverhang) para mantener alineación.
    const apexY = vpY - 20;
    const PL = {
      tlx: G.pVL,  tly: apexY,       // APEX (al VP, subido)
      trx: G.pVL,  try_: apexY,
      brx: G.pBL,  bry: H,           // base inner (cerca cámara)
      blx: B.left, bly: H,           // base outer (canvas left)
    };
    const PR = {
      tlx: G.pVR,   tly: apexY,      // APEX (subido)
      trx: G.pVR,   try_: apexY,
      brx: B.right, bry: H,
      blx: G.pBR,   bly: H,
    };

    // 1 ── Relleno base con GRADIENT VERTICAL — el suelo del andén se
    // lee como UNA SUPERFICIE PLANA con luz cenital + sombra en el borde
    // hacia la vía. Antes era un color sólido (#D5C9B5) que se confundía
    // con la pared al subir/bajar la cámara. El gradient le da volumen:
    //   · Arriba (junto a la pared): beige claro iluminado
    //   · Centro: tono base del andén
    //   · Abajo (junto al borde / cara del bordillo): sombra fría
    const fillTrap = (P) => {
      const grad = ctx.createLinearGradient(0, P.try_, 0, P.bry);
      grad.addColorStop(0,   '#58F484');   // arriba (cerca pared) - verde claro
      grad.addColorStop(0.5, '#28F064');   // medio (base del andén) - verde brillante
      grad.addColorStop(1,   '#1AB048');   // abajo (cerca borde vía) - verde sombra
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(P.tlx, P.tly);
      ctx.lineTo(P.trx, P.try_);
      ctx.lineTo(P.brx, P.bry);
      ctx.lineTo(P.blx, P.bly);
      ctx.closePath();
      ctx.fill();
    };
    fillTrap(PL);
    fillTrap(PR);

    // 2 ── Patrón de baldosas en perspectiva (sutil, sin damero)
    this._drawPlatformTiles(ctx, PL, true);
    this._drawPlatformTiles(ctx, PR, false);

    // RODAPIÉ ELIMINADO — antes una banda beige medio entre el zócalo
    // amarillo y el suelo del andén creaba una franja intermedia visible
    // que se leía como un "hueco" o transición sucia. Ahora el suelo del
    // andén (beige claro con gradient) TOCA directamente el borde inferior
    // del zócalo amarillo, sin separación.
  }

  /** Dibuja una textura sutil de hormigón sobre el trapecio del andén,
   *  IGUALANDO la apariencia del suelo de las vías (drawTunelTracks). El
   *  andén ya no usa baldosas damero — solo veta sutil + juntas finas para
   *  que se lea como "una continuación horizontal del suelo" a otra altura.
   *  ESTÁTICO: el único movimiento del escenario son las traviesas/rieles
   *  del foso, que ya van hacia adelante (forward) en pantalla. */
  _drawPlatformTiles(ctx, P, isLeft) {
    const ROWS = Math.max(2, this.cfg.platformTileRows | 0);
    const COLS = Math.max(2, this.cfg.platformTileCols | 0);

    // Helper: punto interpolado en el trapecio según (u, v) ∈ [0,1]²
    const lerp2 = (u, v) => {
      const x1 = P.tlx + (P.blx - P.tlx) * v;
      const y1 = P.tly + (P.bly - P.tly) * v;
      const x2 = P.trx + (P.brx - P.trx) * v;
      const y2 = P.try_ + (P.bry - P.try_) * v;
      return { x: x1 + (x2 - x1) * u, y: y1 + (y2 - y1) * u };
    };

    // 1 ── Veta clara muy sutil para dar volumen sin damero.
    // Solo las filas pares en color algo más claro — alterna fila/fondo.
    for (let r = 0; r < ROWS; r++) {
      if ((r & 1) !== 0) continue;
      const v0 = Math.pow(r / ROWS, 1.5);
      const v1 = Math.pow((r + 1) / ROWS, 1.5);
      const a = lerp2(0, v0);
      const b = lerp2(1, v0);
      const cc = lerp2(1, v1);
      const d = lerp2(0, v1);
      ctx.fillStyle = this.cfg.platformColorLight;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(cc.x, cc.y);
      ctx.lineTo(d.x, d.y);
      ctx.closePath();
      ctx.fill();
    }

    // 2 ── Juntas finas oscuras transversales (perpendiculares al avance
    // del andén) — dan ritmo horizontal sin animación. Coinciden con el
    // espaciado de las traviesas para coherencia visual con el foso.
    ctx.strokeStyle = this.cfg.platformColorShade;
    ctx.lineWidth   = 0.5;
    for (let r = 1; r < ROWS; r++) {
      const v = Math.pow(r / ROWS, 1.5);
      const a = lerp2(0, v);
      const b = lerp2(1, v);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
  }

  // ── REPISA / SALIENTE DEL ANDÉN — REFACTORIZADO ─────────────────────────
  // En vez de una "repisa" separada con su propio top horizontal (que se veía
  // suspendida cuando los rieles se movían), AHORA prolongamos el cuerpo del
  // andén hacia los rieles con un sólo bloque continuo:
  //   ─ pared amarilla
  //   ▓ andén (suelo hormigón)
  //   ▓ → extensión del andén (5% del ancho hacia el centro)
  //   │ → frente vertical único (cae al balasto)
  //   ═ → rieles
  //
  // Resultado: el saliente forma parte del cuerpo del andén → conectado
  // físicamente a la pared a través de la masa del andén, sin sensación
  // de flotar sobre las vías en movimiento.
  _drawPlatformOverhang(ctx, W, H, vpX, vpY, G) {
    const B = this._bounds;
    const platformY  = H * this.cfg.platformTopRatio;
    // platformVP alineado con apexY del suelo verde (_drawPlatforms).
    const platformVP = vpY - 20;
    // El "drop" se divide en DOS planos verticales claramente distintos:
    //   ─ FRENTE DEL BORDILLO (~20 cm equivalentes): cara vertical fina,
    //     subordinada a la banda táctil amarilla (~30 cm).
    //   ─ FOSO BAJO EL VOLADIZO: zona profunda donde el balasto pasa por
    //     debajo de la repisa.
    const repisaH    = Math.max(14, H * 0.04);
    const repisaHVP  = Math.max(3, H * 0.010);

    // Voladizo del andén — xBaseInner termina JUSTO AL LATERAL del rail
    // externo (no encima). 0.020 deja un margen de ~6 px en la base entre
    // el final del desnivel y la cabeza del rail brillante.
    const overhangBase = W * 0.020;
    const overhangVP   = W * 0.003;

    // Helper: pinta los planos del lateral (saliente + frente del bordillo)
    // para un lado del andén. Espejo izq/der mediante signo.
    const drawSide = (xBaseOuter, xBaseInner, xVPOuter, xVPInner) => {
      // 1 ── PROLONGACIÓN del suelo del andén hacia el centro (voladizo).
      ctx.fillStyle = this.cfg.platformColor;
      ctx.beginPath();
      ctx.moveTo(xBaseOuter, platformY);
      ctx.lineTo(xBaseInner, platformY);
      ctx.lineTo(xVPInner,   platformVP);
      ctx.lineTo(xVPOuter,   platformVP);
      ctx.closePath();
      ctx.fill();

      // 2 ── CARA DEL BORDILLO — muro 3D con:
      //   · Lado SUPERIOR siguiendo el borde del suelo del andén
      //   · Lado INFERIOR siguiendo el RAIL EXTERNO (al 51.2% del camino)
      const railOuter = this.cfg.trackOuterOffset  / 100;
      const railOuterVP = this.cfg.trackOuterOffsetVP / 100;
      const sign = (xBaseInner > vpX) ? +1 : -1;
      // ANCHO DEL DESNIVEL reducido al 51.2% del camino al rail externo
      // (3 pasadas del -20% según pedido del usuario: 0.80³ = 0.512).
      const desnivelWidthRatio = 0.512;
      const railBaseXFull = vpX + sign * W * railOuter;
      const railVPxFull   = vpX + sign * W * railOuterVP;
      const railBaseX = xBaseInner + (railBaseXFull - xBaseInner) * desnivelWidthRatio;
      const railVPx   = xVPInner   + (railVPxFull   - xVPInner)   * desnivelWidthRatio;
      // Altura del desnivel reducida ~44 % (dos pasadas del 25 %).
      // 0.75 × 0.75 = 0.5625 → el muro proyectado es claramente más estrecho.
      const desnivelRatio = 0.5625;
      const drop = (B.bottom - platformY) * desnivelRatio;
      const dropVP = ((vpY + 8) - platformVP) * desnivelRatio;
      // Tono marrón ocre oscuro.
      const muroGrad = ctx.createLinearGradient(0, platformY, 0, platformY + drop);
      muroGrad.addColorStop(0,    '#6B5840');   // arriba: ocre iluminado
      muroGrad.addColorStop(0.45, '#4A3F2C');   // medio: marrón medio
      muroGrad.addColorStop(1,    '#2A2415');   // abajo: marrón oscuro
      ctx.fillStyle = muroGrad;
      ctx.beginPath();
      ctx.moveTo(xBaseInner, platformY);                  // TopNear (borde suelo)
      ctx.lineTo(railBaseX,  platformY + drop);            // BottomNear
      ctx.lineTo(railVPx,    platformVP + dropVP);         // BottomFar
      ctx.lineTo(xVPInner,   platformVP);                 // TopFar (borde suelo al VP)
      ctx.closePath();
      ctx.fill();

      // 2b ── LÍNEA DE ARISTA en el borde superior (filo del bordillo)
      ctx.strokeStyle = 'rgba(255, 245, 220, 0.55)';
      ctx.lineWidth   = 1.2;
      ctx.beginPath();
      ctx.moveTo(xVPInner,   platformVP);
      ctx.lineTo(xBaseInner, platformY);
      ctx.stroke();

      // 3 ── Sombra de junta entre andén y cara del bordillo.
      ctx.fillStyle = 'rgba(0, 0, 0, 0.30)';
      ctx.beginPath();
      ctx.moveTo(xBaseInner, platformY);
      ctx.lineTo(xBaseInner, platformY + repisaH * 0.30);
      ctx.lineTo(xVPInner,   platformVP + repisaHVP * 0.30);
      ctx.lineTo(xVPInner,   platformVP);
      ctx.closePath();
      ctx.fill();
    };

    // IZQUIERDA: outer = G.pBL/G.pVL (borde teórico), inner = +overhang
    drawSide(G.pBL,                G.pBL + overhangBase,
             G.pVL,                G.pVL + overhangVP);
    // DERECHA (espejo): outer = G.pBR/G.pVR, inner = -overhang
    drawSide(G.pBR,                G.pBR - overhangBase,
             G.pVR,                G.pVR - overhangVP);
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

  // ── BANDA PODOTÁCTIL (franja amarilla continua junto al borde del andén) ─
  // Conforme al plano #6 (detalle de andén): franja podotáctil señalizadora
  // amarilla continua, paralela al borde de seguridad. Sustituye al patrón
  // disperso de puntos grises por una banda visible coherente con la
  // normativa de accesibilidad del Metro de Madrid.
  _drawPlatformTactile(ctx, W, H, vpX, vpY, G) {
    const wBase = Math.max(2, this.cfg.tactileBandWidth | 0);
    const wVP   = Math.max(1, wBase * 0.18);
    // La banda va PEGADA al borde del andén (lado vía). Antes se separaba
    // 6 px hacia el interior, dejando un suelo de hormigón entre la vía y
    // la banda — el usuario reportó que la banda debe estar más cerca del
    // borde para que actúe como límite visual claro.
    const innerOffsetBase = 0;
    const innerOffsetVP   = 0;

    // ── IZQUIERDA: trapecio paralelo al borde, dentro del andén ─────────────
    const xOuterBaseL = G.pBL - innerOffsetBase;          // borde exterior (cerca vía)
    const xInnerBaseL = xOuterBaseL - wBase;              // borde interior
    const xOuterVPL   = G.pVL - innerOffsetVP;
    const xInnerVPL   = xOuterVPL - wVP;
    ctx.fillStyle = this.cfg.tactileBandColor;
    ctx.beginPath();
    ctx.moveTo(xInnerBaseL, H);
    ctx.lineTo(xOuterBaseL, H);
    ctx.lineTo(xOuterVPL,   vpY + 5);
    ctx.lineTo(xInnerVPL,   vpY + 5);
    ctx.closePath();
    ctx.fill();
    // Sombra del relieve podotáctil (línea inferior oscura)
    ctx.fillStyle = this.cfg.tactileBandShadow;
    ctx.beginPath();
    ctx.moveTo(xInnerBaseL,             H);
    ctx.lineTo(xInnerBaseL + wBase * 0.18, H);
    ctx.lineTo(xInnerVPL   + wVP * 0.18,   vpY + 5);
    ctx.lineTo(xInnerVPL,                  vpY + 5);
    ctx.closePath();
    ctx.fill();

    // ── DERECHA (espejo) ────────────────────────────────────────────────────
    const xOuterBaseR = G.pBR + innerOffsetBase;
    const xInnerBaseR = xOuterBaseR + wBase;
    const xOuterVPR   = G.pVR + innerOffsetVP;
    const xInnerVPR   = xOuterVPR + wVP;
    ctx.fillStyle = this.cfg.tactileBandColor;
    ctx.beginPath();
    ctx.moveTo(xOuterBaseR, H);
    ctx.lineTo(xInnerBaseR, H);
    ctx.lineTo(xInnerVPR,   vpY + 5);
    ctx.lineTo(xOuterVPR,   vpY + 5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = this.cfg.tactileBandShadow;
    ctx.beginPath();
    ctx.moveTo(xInnerBaseR - wBase * 0.18, H);
    ctx.lineTo(xInnerBaseR,                H);
    ctx.lineTo(xInnerVPR,                  vpY + 5);
    ctx.lineTo(xInnerVPR   - wVP * 0.18,   vpY + 5);
    ctx.closePath();
    ctx.fill();

    // ── Relieve discreto: pequeños puntos elevados sobre la banda (cada 3 px)
    // — mantienen la lectura "podotáctil" sin perder la continuidad amarilla.
    ctx.fillStyle = 'rgba(0,0,0,0.20)';
    const dotsN = 14;
    for (let i = 0; i < dotsN; i++) {
      const t = i / dotsN;
      const s = Math.max(1, Math.round(1.6 * (1 - t * 0.7)));
      const yF = (1 - t) * H + t * (vpY + 5);
      // Centro de la banda (izquierda)
      const cxL = (1 - t) * (xOuterBaseL - wBase / 2) + t * (xOuterVPL - wVP / 2);
      ctx.fillRect(Math.round(cxL), Math.round(yF) - 1, s, s);
      // Centro de la banda (derecha)
      const cxR = (1 - t) * (xOuterBaseR + wBase / 2) + t * (xOuterVPR + wVP / 2);
      ctx.fillRect(Math.round(cxR), Math.round(yF) - 1, s, s);
    }
  }

  // ── VÍAS, TRAVIESAS Y CARRILES ───────────────────────────────────────────
  // DELEGADAS al renderizador del túnel (drawTunelTracks) para garantizar
  // que la vía dentro de la estación tiene EL MISMO ASPECTO que en el túnel
  // — mismos pads de hormigón, clips Pandrol, perfil UIC60 multicapa, canal
  // de drenaje central animado, suelo de hormigón. La transición túnel ↔
  // estación queda visualmente continua.
  //
  // worldZ se incrementa con _elapsed para que las traviesas se desplacen
  // hacia la cámara (escenario en movimiento, no estático).
  _drawTracks(ctx, W, H, vpX, vpY, G) {
    const worldZ = (STATE?.worldZ ?? 0) + this._elapsed * 60;
    drawTunelTracks(ctx, vpY, this.cfg, worldZ);
  }

  // ── CATENARIA RÍGIDA (perfil aéreo de alimentación sobre cada vía) ──────
  // Plano sección transversal #11: perfil de aluminio rígido suspendido del
  // techo que alimenta al pantógrafo del tren. Se dibuja como una línea recta
  // gruesa por encima del centro de cada vía, con ménsulas (colgadores)
  // verticales periódicas que la conectan a la bóveda. La línea sigue la
  // misma fuga que los rieles para mantener coherencia perspectiva.
  _drawCatenary(ctx, W, H, vpX, vpY, G) {
    if (!this.cfg.showCatenary) return;

    // ── Geometría: catenaria PEGADA AL TECHO ─────────────────────────────
    // Plano sección transversal #11: el perfil rígido va suspendido del
    // techo (no a media altura). En back-view eso se proyecta como una
    // línea TOCANDO LA BÓVEDA — cerca de la cámara está pegada al borde
    // superior del canvas, y al fondo converge a vpY (donde se cierra el
    // techo). Los colgadores son cortos ya que el perfil casi roza la
    // bóveda.
    const yBase = Math.max(8, H * 0.06);   // pegado al techo (cerca)
    const yVP   = vpY - 12;                 // bajo la curva del techo en VP

    // Centro de cada vía a ambas profundidades (mismo cálculo que _drawTrains)
    const lanes = [
      {
        cBase: (G.tOBL + G.tIBL) / 2,
        cVP:   (G.tOVL + G.tIVL) / 2,
        sideSign: -1,  // brazo de soporte hacia la pared izquierda
      },
      {
        cBase: (G.tOBR + G.tIBR) / 2,
        cVP:   (G.tOVR + G.tIVR) / 2,
        sideSign: +1,  // brazo de soporte hacia la pared derecha
      },
    ];

    lanes.forEach(({ cBase, cVP, sideSign }) => {
      // 1 ── PERFIL RÍGIDO HORIZONTAL — capa SOMBRA (parte inferior)
      ctx.lineCap = 'round';
      ctx.strokeStyle = this.cfg.catenaryRailShadow;
      ctx.lineWidth   = 5;
      ctx.beginPath();
      ctx.moveTo(cBase, yBase + 2);
      ctx.lineTo(cVP,   yVP + 0.6);
      ctx.stroke();

      // Cuerpo principal aluminio (parte superior — la "T")
      ctx.strokeStyle = this.cfg.catenaryRailColor;
      ctx.lineWidth   = 3.5;
      ctx.beginPath();
      ctx.moveTo(cBase, yBase);
      ctx.lineTo(cVP,   yVP);
      ctx.stroke();

      // Filo blanco brillante (refleja la luz LED del techo)
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth   = 1.1;
      ctx.beginPath();
      ctx.moveTo(cBase, yBase - 1);
      ctx.lineTo(cVP,   yVP - 0.4);
      ctx.stroke();
      ctx.lineCap = 'butt';

      // 2 ── COLGADORES CORTOS (la catenaria está pegada al techo, así que
      //      las ménsulas son meros pernos visibles que la fijan al
      //      revestimiento de la bóveda — muy cortos, sin brazo lateral).
      const N = Math.max(2, this.cfg.catenaryHangers | 0);
      for (let i = 0; i < N; i++) {
        const t  = i / Math.max(1, N - 1);
        const cx = (1 - t) * cBase + t * cVP;
        const cy = (1 - t) * yBase + t * yVP;
        // Altura del colgador HACIA EL TECHO — corta porque la catenaria
        // ya está casi tocando la bóveda.
        const hangH = Math.max(2, 8 * (1 - t * 0.80));
        const hangW = Math.max(1, Math.round(2 * (1 - t * 0.5)));

        // Colgador vertical (perno) hacia el techo
        ctx.fillStyle = this.cfg.catenaryHangerColor;
        ctx.fillRect(Math.round(cx) - Math.floor(hangW / 2),
                     Math.round(cy - hangH),
                     hangW, hangH);

        // Pieza aisladora cerámica (sólo visible en los colgadores cercanos)
        if (t < 0.45) {
          ctx.fillStyle = '#D8D2C0';
          ctx.fillRect(Math.round(cx) - hangW - 1, Math.round(cy) - 2,
                       hangW * 2 + 3, 2);
        }
      }
    });
  }

  // ── FRISO DE IDENTIDAD DE ESTACIÓN (banda azul con nombre animado) ──────
  // Plano sección longitudinal #12: la pared del andén lleva una banda azul
  // continua a media altura con el nombre de la estación en blanco repetido.
  // Aquí lo enriquecemos con MOVIMIENTO tipo túnel: cada copia del nombre
  // emerge desde el VP (pequeña, lejana) y se desliza por la pared hacia
  // la cámara, agrandándose, hasta salir del cuadro junto a la cámara —
  // simulando lo que vería un pasajero de pie en el andén.
  //
  // El texto que se muestra es SIEMPRE this.cfg.stationName (no hardcoded):
  // cada parada de la línea sustituye automáticamente al nombre vigente.
  _drawStationFrieze(ctx, W, H, vpX, vpY, G) {
    if (!this.cfg.showStationFrieze) return;
    const B = this._bounds;
    const name = (this.cfg.stationName || '').toUpperCase();
    if (!name) return;

    // Trapecio del friso en la PARTE ALTA de la pared, justo bajo el techo
    // abovedado. En las estaciones reales del Metro de Madrid (y en el plano
    // de referencia) la banda azul con el nombre cuelga arriba de la pared,
    // visible desde lejos por el viajero que llega al andén.
    const friseTopBase = H * 0.18;
    const friseBotBase = H * 0.30;   // grosor base ~12 % H
    const friseTopVP   = vpY - 8;
    const friseBotVP   = vpY - 3;    // grosor VP ~5 px

    // ── Sin animación lateral ──────────────────────────────────────────────
    // El texto del friso queda ESTÁTICO: solo las traviesas/rieles del foso
    // dan la sensación de "escenario en movimiento" (forward). Antes había
    // un scroll lateral del nombre que se percibía como lateral en pantalla,
    // contradiciendo el resto del escenario que va hacia el observador.
    const scroll      = 0;
    const repeats     = 8;
    const fontMax     = 14;
    // Umbrales de fade — ocultamos copias justo antes de salir por la cámara
    // (t < 0.04) y justo antes de aparecer en el VP (t > 0.96), para que las
    // entradas/salidas no parezcan "pop-in" abruptos.
    const fadeNear    = 0.04;
    const fadeFar     = 0.97;

    const drawSide = (xBase, xVP, isLeft) => {
      // 1 ── Trapecio azul de fondo (estático, define la "pizarra" de la
      // banda; sólo el texto se mueve dentro del clip del trapecio).
      ctx.fillStyle = this.cfg.friezeBgColor;
      ctx.beginPath();
      ctx.moveTo(xBase, friseTopBase);
      ctx.lineTo(xVP,   friseTopVP);
      ctx.lineTo(xVP,   friseBotVP);
      ctx.lineTo(xBase, friseBotBase);
      ctx.closePath();
      ctx.fill();

      // 2 ── Sombra inferior — línea más oscura para dar volumen al friso
      ctx.fillStyle = this.cfg.friezeBorderColor;
      ctx.beginPath();
      ctx.moveTo(xBase, friseBotBase - 1);
      ctx.lineTo(xVP,   friseBotVP - 0.3);
      ctx.lineTo(xVP,   friseBotVP);
      ctx.lineTo(xBase, friseBotBase);
      ctx.closePath();
      ctx.fill();

      // 3 ── Highlight superior brillante (contraste con el techo)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
      ctx.beginPath();
      ctx.moveTo(xBase, friseTopBase);
      ctx.lineTo(xVP,   friseTopVP);
      ctx.lineTo(xVP,   friseTopVP + 0.5);
      ctx.lineTo(xBase, friseTopBase + 1.5);
      ctx.closePath();
      ctx.fill();

      // 4 ── TEXTO ANIMADO recortado al trapecio
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(xBase, friseTopBase);
      ctx.lineTo(xVP,   friseTopVP);
      ctx.lineTo(xVP,   friseBotVP);
      ctx.lineTo(xBase, friseBotBase);
      ctx.closePath();
      ctx.clip();

      ctx.fillStyle    = this.cfg.friezeTextColor;
      ctx.textBaseline = 'middle';
      ctx.textAlign    = 'center';

      const yMidBase = (friseTopBase + friseBotBase) / 2;
      const yMidVP   = (friseTopVP   + friseBotVP)   / 2;

      // Dibuja cada copia en su posición animada actual.
      for (let r = 0; r < repeats; r++) {
        // Posición a lo largo del trapecio:
        //   t = 0 → en la cámara (saliendo del cuadro, lo más grande)
        //   t = 1 → en el VP (recién aparecido, lo más pequeño)
        // Se desplaza decrementando con el frame → las copias avanzan
        // desde el VP hacia la cámara, y al pasar 0 vuelven a empezar en 1.
        const baseT = r / repeats;
        let t = ((baseT - scroll) % 1 + 1) % 1;
        if (t < fadeNear || t > fadeFar) continue;

        // Interpolación lineal de posición sobre el trapecio
        const cx = (1 - t) * xBase + t * xVP;
        const cy = (1 - t) * yMidBase + t * yMidVP;

        // Tamaño de fuente: muy pequeño en VP, grande cerca cámara
        const fs = Math.max(3, Math.round(fontMax * (1 - t * 0.78)));
        ctx.font = `bold ${fs}px monospace`;

        // Alpha con ramp suave en los extremos para evitar pop-in/out
        let alpha = 1;
        if (t < fadeNear * 2)        alpha = (t - fadeNear) / fadeNear;
        else if (t > fadeFar - 0.04) alpha = (fadeFar - t) / 0.04;
        alpha = Math.max(0, Math.min(1, alpha));
        ctx.globalAlpha = alpha;

        ctx.fillText(name, Math.round(cx), Math.round(cy));
      }
      ctx.globalAlpha = 1;
      ctx.restore();
      ctx.textBaseline = 'alphabetic';
      ctx.textAlign    = 'left';
    };

    // Pared izquierda: del borde del canvas a G.pVL
    drawSide(B.left,  G.pVL, true);
    // Pared derecha: del borde del canvas a G.pVR
    drawSide(B.right, G.pVR, false);
  }

  // ── PUERTAS / ACCESOS EN LA PARED (ref. plano #13) ─────────────────────
  // La pared amarilla del andén tiene varios accesos rectangulares (puertas
  // de servicio, salidas, salas técnicas) repartidos a lo largo de la pared.
  // Se dibujan en perspectiva con marco beige y puerta oscura, decreciendo
  // de tamaño hacia el VP — refuerza la lectura "esto es una pared real
  // con accesos" y no un simple panel plano amarillo.
  _drawWallDoors(ctx, W, H, vpX, vpY, G) {
    if (!this.cfg.showWallDoors) return;
    const N = Math.max(0, this.cfg.numWallDoors | 0);
    if (N === 0) return;

    // Zona vertical de la pared donde caben las puertas: desde justo bajo
    // el friso azul (~H * 0.30) hasta el rodapié de cables (~H * 0.55 base
    // / vpY+5 al VP). Las puertas ocupan ~80 % de esa franja vertical.
    const wallTopBase = H * 0.32;
    const wallBotBase = H * 0.54;
    const wallTopVP   = vpY - 2;
    const wallBotVP   = vpY + 4;

    const drawSide = (xBase, xVP, isLeft) => {
      // Distribuimos N puertas a lo largo del trapecio de la pared.
      // t ∈ (0,1): 0 = cerca cámara (puerta grande), 1 = VP (puerta diminuta).
      // Distribución asimétrica: empezamos en t=0.10 (no del todo en el
      // borde para que la puerta cercana quepa entera dentro del canvas)
      // y terminamos en t=0.80 (no demasiado pegadas al VP).
      for (let i = 0; i < N; i++) {
        // Distribución logarítmica: más densas hacia VP (perspectiva)
        const tLin = (i + 0.5) / N;
        const t    = 0.10 + Math.pow(tLin, 1.4) * 0.70;

        // Centro X de la puerta sobre el trapecio de la pared
        const cx = (1 - t) * xBase + t * xVP;
        // Y inferior y superior de la puerta a esta profundidad
        const yTop = (1 - t) * wallTopBase + t * wallTopVP;
        const yBot = (1 - t) * wallBotBase + t * wallBotVP;
        const dh   = yBot - yTop;

        // Ancho de la puerta: ~70 % de la altura visible (forma rectangular
        // alta), proporcional a la perspectiva.
        const dw   = Math.max(2, dh * 0.65);
        // Desplazamos un poco hacia DENTRO de la pared (hacia el centro del
        // canvas) para que no se peguen al borde derecho/izquierdo del trapecio.
        const dxOffset = isLeft ? dw * 0.2 : -dw * 0.2;
        const x0 = Math.round(cx + dxOffset - dw / 2);
        const y0 = Math.round(yTop);
        const w  = Math.max(2, Math.round(dw));
        const h  = Math.max(4, Math.round(dh));

        // 1 ── Marco beige exterior (resalta sobre el amarillo de la pared)
        ctx.fillStyle = this.cfg.doorFrameColor;
        ctx.fillRect(x0, y0, w, h);

        // 2 ── Cuerpo oscuro de la puerta (un poco hacia dentro del marco)
        const pad = Math.max(1, Math.round(w * 0.10));
        ctx.fillStyle = this.cfg.doorBodyColor;
        ctx.fillRect(x0 + pad, y0 + pad, Math.max(1, w - pad * 2), Math.max(1, h - pad * 2));

        // 3 ── Banda metálica horizontal a media altura (detalle)
        if (h >= 12) {
          ctx.fillStyle = this.cfg.doorAccentColor;
          const accentY = y0 + Math.round(h * 0.55);
          ctx.fillRect(x0 + pad, accentY, Math.max(1, w - pad * 2), Math.max(1, Math.round(h * 0.04)));
        }

        // 4 ── Manija de la puerta (1 px brillante en el lado de bisagra)
        if (w >= 6 && h >= 14) {
          ctx.fillStyle = this.cfg.doorHandleColor;
          const handleX = isLeft ? (x0 + w - pad - 2) : (x0 + pad + 1);
          const handleY = y0 + Math.round(h * 0.50);
          ctx.fillRect(handleX, handleY, 1, Math.max(1, Math.round(h * 0.06)));
        }

        // 5 ── División vertical (puerta de doble hoja) en puertas grandes
        if (w >= 14) {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
          ctx.fillRect(x0 + Math.round(w / 2), y0 + pad, 1, Math.max(1, h - pad * 2));
        }

        // 6 ── Sombra de profundidad bajo el dintel (línea oscura arriba)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.30)';
        ctx.fillRect(x0, y0, w, 1);
      }
    };

    // Usamos 0 y W (bordes visibles) en lugar de B.left/B.right (overdraw)
    // para que la puerta más cercana a la cámara quepa entera en pantalla.
    drawSide(0, G.pVL, true);
    drawSide(W, G.pVR, false);
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
