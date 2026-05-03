// escenarios/metro_base/metro_base.js
// MetroBase — ORQUESTADOR de la secuencia estación → túnel → estación.
// No dibuja contenido del juego; sólo decide qué escena toca y cuándo, y
// pinta el HUD de progreso (barra horizontal con marcas por estación, la
// paloma avanzando y el nombre de la estación actual y la próxima).
//
// Recibe un array `route` de paradas:
//   [{ name, shortName?, zone?, isCheckpoint?, stationConfig, tunelConfig }, ...]
// Para cada parada genera DOS escenas en orden: EstacionBase (andén) y
// TunelBase (camino al siguiente andén). El recorrido completo termina al
// salir del último túnel.

import { canvas }       from '../../mecanica/estado.js';
import { TunelBase }    from './tunel_base.js';
import { EstacionBase } from './estacion_base.js';

export class MetroBase {
  /**
   * @param {Array<RouteStop>} route   Lista de paradas de la línea.
   * @param {object} [opts]
   * @param {string} [opts.lineColor]           Color de línea para el HUD.
   * @param {number} [opts.transitionSeconds]   Duración del cross-fade entre
   *   escenas (estación↔túnel). Por defecto 1.2 s.
   */
  constructor(route, opts = {}) {
    this.route        = route ?? [];
    this.lineColor    = opts.lineColor ?? '#F39200';
    this.currentIdx   = 0;
    this.sceneType    = 'station'; // 'station' | 'tunnel'
    this.currentScene = null;
    this._finished    = false;

    // ── Transición tipo "túnel" entre escenas ───────────────────────────────
    // Mientras _outgoingScene != null, AMBAS escenas se actualizan. La
    // saliente se pinta a pantalla completa y la entrante se revela dentro
    // de un círculo centrado en el punto de fuga que crece de 0 a la
    // diagonal del canvas. Sensación: ves la próxima escena "al fondo" y
    // se acerca hasta tragarse el plano (luz al final del túnel).
    this._transitionDur     = opts.transitionSeconds ?? 1.8; // segundos
    this._transitionElapsed = 0;
    this._outgoingScene     = null;
    this._outgoingType      = null; // 'station' | 'tunnel' (qué se está yendo)
  }

  init() {
    this.currentIdx        = 0;
    this.sceneType         = 'station';
    this.currentScene      = null;
    this._finished         = false;
    this._outgoingScene    = null;
    this._outgoingType     = null;
    this._transitionElapsed = 0;
    this._loadScene();
  }

  /** Reset rápido (mismo recorrido, desde el primer andén). */
  reset() { this.init(); }

  /** ¿Está activa una transición cross-fade ahora mismo? */
  get isTransitioning() { return this._outgoingScene != null; }
  /** Progreso 0–1 de la transición activa (1 = casi terminada). */
  get transitionProgress() {
    if (!this.isTransitioning) return 0;
    return Math.min(1, this._transitionElapsed / this._transitionDur);
  }

  update(dt) {
    if (this._finished) return;

    // Durante la transición, AMBAS escenas siguen vivas: el túnel sigue
    // scrolleando, el andén sigue animando trenes y fluorescentes, etc.
    if (this._outgoingScene) {
      this._transitionElapsed += dt / 60;
      this._outgoingScene.update(dt);
      if (this.currentScene) this.currentScene.update(dt);
      if (this._transitionElapsed >= this._transitionDur) {
        this._outgoingScene     = null;
        this._outgoingType      = null;
        this._transitionElapsed = 0;
      }
      return;
    }

    if (!this.currentScene) return;
    this.currentScene.update(dt);
    if (this.currentScene.isDone) this._nextScene();
  }

  render(ctx) {
    if (this._outgoingScene && this.currentScene) {
      // 1. Pintar la escena que se está yendo a pantalla completa.
      this._outgoingScene.render(ctx);

      // 2. CLIP CON FORMA DE ARCO (boca del túnel).
      // En vez de un círculo, recortamos la silueta del arco — el mismo
      // doorway que ya dibujan _drawTunnelMouth (estación) y el final del
      // túnel. Crece desde un arco pequeño en el VP hasta tragarse toda la
      // pantalla, dando la sensación de ATRAVESAR la puerta a la siguiente
      // escena. La cámara avanza, el arco se ensancha, el suelo se queda
      // bajo nuestros pies, y dentro del arco aparece el escenario nuevo.
      const W   = canvas.width;
      const H   = canvas.height;
      const vpX = W / 2;
      const vpY = H * this._getIncomingVPY();

      const t     = this.transitionProgress;
      const eased = t * t;   // ease-in: lento al principio, acelera al final

      // Mismas proporciones que el arco de _drawTunnelMouth / fin de túnel,
      // así la silueta es 100% reconocible como "la boca por la que entras".
      const baseHalfW = Math.max(28, W * 0.075) * 0.45;
      // Diagonal de pantalla + margen — garantiza que el arco final cubre
      // todas las esquinas, incluso con vpY descentrado.
      const maxHalfW  = Math.hypot(W, H) * 1.10;
      const halfW     = baseHalfW + (maxHalfW - baseHalfW) * eased;
      const sidesH    = halfW * 0.85;
      const baseY     = vpY + 8;
      // El borde inferior del arco baja del nivel del suelo (baseY) hasta
      // por debajo del canvas conforme la cámara "atraviesa" el arco. Sin
      // esto, la mitad inferior de la pantalla se quedaría con la escena
      // saliente (suelo) durante toda la transición.
      const bottom    = baseY + (H + 100 - baseY) * eased;

      const archPath = (hw, sh, btm) => {
        ctx.beginPath();
        ctx.moveTo(vpX - hw, btm);
        ctx.lineTo(vpX - hw, baseY - sh);
        ctx.arc(vpX, baseY - sh, hw, Math.PI, 0, false);
        ctx.lineTo(vpX + hw, btm);
        ctx.closePath();
      };

      if (halfW > 1) {
        // 3. Recortar al arco y pintar la escena entrante DENTRO.
        ctx.save();
        archPath(halfW, sidesH, bottom);
        ctx.clip();
        this.currentScene.render(ctx);
        ctx.restore();

        // 4. Marco del arco — pinta el contorno del doorway. Más intenso a
        //    mitad de transición, se desvanece al principio y al final.
        //    Color: dorado al entrar a estación (luz), azul oscuro al
        //    entrar a túnel (sombra).
        const ringAlpha = Math.max(0, 1 - Math.abs(t - 0.55) * 1.8);
        if (ringAlpha > 0) {
          const isIntoStation = this.sceneType === 'station';
          const ringColor = isIntoStation
            ? `rgba(255, 235, 170, ${ringAlpha * 0.50})`
            : `rgba(20, 25, 40, ${ringAlpha * 0.65})`;

          ctx.save();
          ctx.strokeStyle = ringColor;
          ctx.lineWidth   = 3 + (1 - t) * 5;
          archPath(halfW, sidesH, bottom);
          ctx.stroke();

          // Glow exterior suave usando shadowBlur
          ctx.shadowColor = ringColor;
          ctx.shadowBlur  = 16;
          ctx.lineWidth   = 1.5;
          archPath(halfW, sidesH, bottom);
          ctx.stroke();
          ctx.restore();
        }
      } else {
        // 5. Punto de luz en el VP cuando el arco es subpíxel (frame 0–1).
        const isIntoStation = this.sceneType === 'station';
        const dotColor = isIntoStation
          ? 'rgba(255,240,200,0.9)' : 'rgba(120,140,180,0.7)';
        const grad = ctx.createRadialGradient(vpX, vpY, 0, vpX, vpY, 14);
        grad.addColorStop(0, dotColor);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(vpX - 14, vpY - 14, 28, 28);
      }
    } else if (this.currentScene) {
      this.currentScene.render(ctx);
    }
    this._drawProgressHUD(ctx);
  }

  /** Y del punto de fuga (fracción 0–1) de la escena entrante. */
  _getIncomingVPY() {
    if (!this.currentScene) return 0.45;
    // EstacionBase guarda la fracción en cfg.vanishingPointY (≈0.42).
    if (this.sceneType === 'station') {
      return this.currentScene.cfg?.vanishingPointY ?? 0.42;
    }
    // TunelBase usa el ENV_CFG global (≈0.47). Aproximamos al valor por
    // defecto para no introducir un import circular sólo por esto.
    return 0.47;
  }

  /** Hitboxes de los trenes solo durante la escena de túnel. */
  getTrainHitboxes() {
    if (this.sceneType === 'tunnel' && this.currentScene?.getTrainHitboxes) {
      return this.currentScene.getTrainHitboxes();
    }
    return [];
  }

  // ── Información para el HUD / arcade ──────────────────────────────────────
  get isFinished()        { return this._finished; }
  get currentStop()       { return this.route[this.currentIdx] ?? null; }
  get nextStop()          { return this.route[this.currentIdx + 1] ?? null; }
  get isOnStation()       { return this.sceneType === 'station'; }
  get isOnTunnel()        { return this.sceneType === 'tunnel'; }

  /** Progreso global 0–1 (estación actual + sub-progreso de la escena). */
  get progress() {
    if (this.route.length === 0) return 0;
    if (this._finished) return 1;
    const sub = this.currentScene && this.currentScene.cfg
      ? Math.min(1, this.currentScene._elapsed
                  ? this.currentScene._elapsed / this.currentScene.cfg.durationSeconds
                  : (this.currentScene._frame / 60) / this.currentScene.cfg.durationSeconds)
      : 0;
    const phaseFrac = this.sceneType === 'station' ? sub * 0.5 : 0.5 + sub * 0.5;
    return Math.min(1, (this.currentIdx + phaseFrac) / this.route.length);
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  _loadScene() {
    const stop = this.route[this.currentIdx];
    if (!stop) return;

    if (this.sceneType === 'station') {
      this.currentScene = new EstacionBase(stop.stationConfig);
      this.currentScene.init(stop.name);
    } else {
      this.currentScene = new TunelBase(stop.tunelConfig);
      this.currentScene.init();
    }
  }

  _nextScene() {
    // Mover la escena actual a "saliente" antes de cargar la nueva, para
    // que el cross-fade en render() pueda pintar ambas a la vez.
    this._outgoingScene     = this.currentScene;
    this._outgoingType      = this.sceneType;
    this._transitionElapsed = 0;

    if (this.sceneType === 'station') {
      // Si era la última estación de la ruta, NO hay túnel después: el
      // trayecto termina aquí (la paloma ha llegado al terminal de destino).
      // Conservamos `currentScene` apuntando a la estación final para que
      // el render siga mostrando ese último frame mientras se superpone el
      // popup de fin de nivel (evita un flash de canvas vacío).
      if (this.currentIdx >= this.route.length - 1) {
        this._finished      = true;
        this._outgoingScene = null;
        this._outgoingType  = null;
        return;
      }
      // Estación → Túnel (mismo índice)
      this.sceneType = 'tunnel';
      this._loadScene();
    } else {
      // Túnel → siguiente Estación
      this.sceneType = 'station';
      this.currentIdx++;
      if (this.currentIdx >= this.route.length) {
        this._finished      = true;
        this.currentScene   = null;
        // Si la línea ha terminado, no hay escena entrante: descartamos la
        // transición para no bloquear update().
        this._outgoingScene = null;
        this._outgoingType  = null;
        return;
      }
      this._loadScene();
    }
  }

  // ── HUD de progreso (estilo diagrama oficial Metro de Madrid) ─────────────
  // Layout vertical:
  //   [zona de nombres rotados -45°]          ← arriba (los nombres "vuelan")
  //   [línea horizontal con marcas + paloma]  ← centro
  //   [etiqueta de fase ANDÉN/TÚNEL]          ← abajo
  //
  // La estación actual se destaca con: nombre BLANCO en negrita, halo
  // pulsante alrededor de la marca y un triángulo apuntando hacia ella.
  // Las pasadas usan el color de línea atenuado, las futuras un gris suave.

  _drawProgressHUD(ctx) {
    const cw = canvas.width;
    if (!this.route.length) return;

    // ── Layout ────────────────────────────────────────────────────────────────
    const HUD_W = Math.min(900, cw - 40);
    const HUD_X = Math.round((cw - HUD_W) / 2);
    const HUD_Y = 10;
    const NAMES_H = 70;        // espacio reservado para los nombres rotados
    const BAR_H   = 22;
    const HUD_H   = NAMES_H + BAR_H;

    const padX = 28;
    const x0   = HUD_X + padX;
    const x1   = HUD_X + HUD_W - padX;
    const span = Math.max(1, x1 - x0);
    const barY = HUD_Y + NAMES_H + BAR_H / 2;
    const xAt  = (i) => x0 + (this.route.length === 1
                                 ? 0
                                 : (i / (this.route.length - 1)) * span);

    // Caja de fondo
    ctx.fillStyle = 'rgba(0,0,0,0.62)';
    ctx.fillRect(HUD_X, HUD_Y, HUD_W, HUD_H);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth   = 1;
    ctx.strokeRect(HUD_X + 0.5, HUD_Y + 0.5, HUD_W - 1, HUD_H - 1);

    // ── 1. Línea base (gris) y tramo recorrido (color de línea) ──────────────
    // Trazo grueso para que quede tan visible como el diagrama oficial.
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth   = 5;
    ctx.lineCap     = 'butt';
    ctx.beginPath();
    ctx.moveTo(x0, barY); ctx.lineTo(x1, barY);
    ctx.stroke();

    const passedX = x0 + this.progress * span;
    ctx.strokeStyle = this.lineColor;
    ctx.lineWidth   = 6;
    ctx.beginPath();
    ctx.moveTo(x0, barY); ctx.lineTo(passedX, barY);
    ctx.stroke();

    // Tramos pequeños (ticks amarillos del diagrama oficial)
    for (let i = 0; i < this.route.length - 1; i++) {
      const xa = xAt(i);
      const xb = xAt(i + 1);
      const tickCount = 3;
      for (let k = 1; k <= tickCount; k++) {
        const tx = xa + (xb - xa) * (k / (tickCount + 1));
        const isPassed = tx <= passedX;
        ctx.fillStyle = isPassed
          ? this._brighten(this.lineColor, 0.15)
          : 'rgba(255,255,255,0.08)';
        ctx.fillRect(tx - 1, barY - 3, 2, 6);
      }
    }

    // ── 2. Nombres rotados -45° (estilo diagrama oficial) ────────────────────
    // Solo dibujamos cada N estaciones si hay muchas para evitar solapes.
    // Para 20 estaciones a 900px de ancho ≈ 47px por hueco — caben todos.
    const stepX  = span / Math.max(1, this.route.length - 1);
    const showAll = stepX >= 28;             // suficiente espacio: todos
    const showEvery = showAll ? 1 : 2;       // si no, pintamos uno sí uno no

    for (let i = 0; i < this.route.length; i++) {
      const x        = xAt(i);
      const isPassed = i < this.currentIdx;
      const isCur    = i === this.currentIdx;
      const isNext   = i === this.currentIdx + 1;
      const isPrev   = i === this.currentIdx - 1;
      const stop     = this.route[i];

      // Nombre: pintar si está cerca o si toca por densidad
      const drawName = isCur || isNext || isPrev || (i % showEvery === 0);
      if (drawName) {
        const label = (stop.shortName ?? stop.name).toUpperCase();
        // Color y peso según estado
        let color, font;
        if (isCur)        { color = '#FFFFFF';                 font = 'bold 10px monospace'; }
        else if (isNext)  { color = this.lineColor;            font = 'bold 9px monospace';  }
        else if (isPrev)  { color = this._brighten(this.lineColor, 0.10); font = '9px monospace'; }
        else if (isPassed){ color = 'rgba(255,255,255,0.45)';  font = '8px monospace'; }
        else              { color = 'rgba(200,200,220,0.55)';  font = '8px monospace'; }

        ctx.save();
        ctx.translate(x, barY - 12);
        ctx.rotate(-Math.PI / 4);            // -45°
        ctx.fillStyle    = color;
        ctx.font         = font;
        ctx.textAlign    = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, 4, 0);
        ctx.restore();
      }
    }

    // ── 3. Marcas de estación (círculos) ──────────────────────────────────────
    for (let i = 0; i < this.route.length; i++) {
      const x        = xAt(i);
      const isPassed = i < this.currentIdx;
      const isCur    = i === this.currentIdx;
      const isNext   = i === this.currentIdx + 1;
      const stop     = this.route[i];

      let r, fill, border;
      if (isCur)         { r = 6; fill = '#FFFFFF';        border = this.lineColor; }
      else if (isNext)   { r = 5; fill = this.lineColor;   border = '#FFFFFF'; }
      else if (isPassed) { r = 4; fill = this.lineColor;   border = null; }
      else               { r = 4; fill = '#1a1a26';        border = 'rgba(200,200,220,0.55)'; }

      // Checkpoint: cuadrado verde con halo
      if (stop?.isCheckpoint) {
        ctx.fillStyle = '#5DCAA5';
        ctx.fillRect(x - r, barY - r, r * 2, r * 2);
        if (isCur) {
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth   = 1.5;
          ctx.strokeRect(x - r - 1, barY - r - 1, r * 2 + 2, r * 2 + 2);
        }
        continue;
      }

      // Círculo blanco al estilo de los iconos del diagrama oficial
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.arc(x, barY, r, 0, Math.PI * 2);
      ctx.fill();

      if (border) {
        ctx.strokeStyle = border;
        ctx.lineWidth   = 1.5;
        ctx.beginPath();
        ctx.arc(x, barY, r, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Halo pulsante alrededor de la estación actual
      if (isCur) {
        const t     = (performance.now() % 1100) / 1100;
        const pulse = 0.5 + 0.5 * Math.sin(t * Math.PI * 2);
        ctx.strokeStyle = `rgba(255,255,255,${0.20 + pulse * 0.35})`;
        ctx.lineWidth   = 1.5;
        ctx.beginPath();
        ctx.arc(x, barY, r + 3 + pulse * 3, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // ── 4. Cartel con el nombre de la estación actual (centrado) ─────────────
    // Es la información más importante: aparece SIEMPRE bajo la barra,
    // visible sin tener que leer un texto rotado.
    const cur = this.currentStop;
    if (cur) {
      const labelX = x0 + this.progress * span;
      const tipText = (cur.name ?? '').toUpperCase();
      ctx.font = 'bold 11px monospace';
      const tw = Math.max(60, ctx.measureText(tipText).width + 14);
      const tx = Math.round(labelX - tw / 2);
      const ty = barY + 10;
      const th = 18;
      // Mantener el cartel dentro del HUD
      const txClamped = Math.max(HUD_X + 4, Math.min(HUD_X + HUD_W - tw - 4, tx));

      // Fondo y borde con color de línea
      ctx.fillStyle = '#0d0d20';
      ctx.fillRect(txClamped, ty, tw, th);
      ctx.strokeStyle = this.lineColor;
      ctx.lineWidth   = 1.5;
      ctx.strokeRect(txClamped + 0.5, ty + 0.5, tw - 1, th - 1);

      // Triángulo apuntando a la marca de la estación actual
      ctx.fillStyle = this.lineColor;
      ctx.beginPath();
      ctx.moveTo(labelX - 4, ty);
      ctx.lineTo(labelX + 4, ty);
      ctx.lineTo(labelX,     ty - 4);
      ctx.closePath();
      ctx.fill();

      // Texto del nombre
      ctx.fillStyle    = '#FFFFFF';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(tipText, txClamped + tw / 2, ty + th / 2);
    }

    // ── 5. Paloma como marcador en la barra ──────────────────────────────────
    const pigeonX = x0 + this.progress * span;
    // Punto exterior blanco
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(pigeonX, barY, 3, 0, Math.PI * 2);
    ctx.fill();
    // Núcleo del color de la línea
    ctx.fillStyle = this.lineColor;
    ctx.beginPath();
    ctx.arc(pigeonX, barY, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // ── 6. Etiqueta de fase (ANDÉN / TÚNEL) — esquina sup-izquierda ──────────
    const tagBg   = this.isOnStation ? 'rgba(93,202,165,0.18)' : 'rgba(245,197,24,0.18)';
    const tagFg   = this.isOnStation ? '#5DCAA5' : '#F5C518';
    const tagText = this.isOnStation ? '◯ ANDÉN' : '▶ TÚNEL';
    ctx.fillStyle = tagBg;
    ctx.fillRect(HUD_X + 6, HUD_Y + 4, 56, 14);
    ctx.fillStyle = tagFg;
    ctx.font      = 'bold 9px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(tagText, HUD_X + 11, HUD_Y + 11);

    // ── 7. Contador de progreso (esquina sup-derecha) ────────────────────────
    const pct = Math.round(this.progress * 100);
    ctx.fillStyle    = '#aaaabb';
    ctx.font         = '9px monospace';
    ctx.textAlign    = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      `${this.currentIdx + 1}/${this.route.length}  ·  ${pct}%`,
      HUD_X + HUD_W - 8,
      HUD_Y + 11,
    );

    // Restaurar estado
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  // ── Helper de color (idéntico al usado en estacion_render) ─────────────────
  _brighten(hex, factor) {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    const f = 1 + factor;
    return `rgb(${Math.min(255, Math.round(r * f))},${Math.min(255, Math.round(g * f))},${Math.min(255, Math.round(b * f))})`;
  }
}

/**
 * @typedef {Object} RouteStop
 * @property {string}  name              Nombre completo (rótulos / LED).
 * @property {string}  [shortName]       Etiqueta corta para el HUD.
 * @property {string}  [zone]            Zona tarifaria ('A'|'B1'…) — informativo.
 * @property {boolean} [isCheckpoint]    Marca como punto de guardado futuro.
 * @property {object}  [stationConfig]   Overrides del DEFAULT_STATION_CONFIG.
 * @property {object}  [tunelConfig]     Overrides del DEFAULT_CONFIG (TunelBase).
 */
