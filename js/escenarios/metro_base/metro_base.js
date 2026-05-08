// escenarios/metro_base/metro_base.js
// MetroBase — ORQUESTADOR de la secuencia estación → túnel → estación.
// No dibuja contenido del juego; sólo decide qué escena toca y cuándo, y
// pinta el HUD de progreso (barra horizontal con marcas por estación, la
// paloma avanzando y el nombre de la estación actual y la próxima).
//
// Recibe un array `route` de paradas:
//   [{ name, shortName?, zone?, isCheckpoint?, stationConfig, tunelConfig }, ...]
// Para cada parada genera DOS escenas en orden:
//   1. EstacionBase  (andén — con la BOCA DEL TÚNEL al fondo del VP)
//   2. TunelBase     (camino al siguiente andén — con la BOCA DE LA SIGUIENTE
//                     ESTACIÓN al fondo del VP)
//
// El cambio entre escenas es un CORTE LIMPIO. No hay animación de
// transición ni cross-fade: la sensación de continuidad la dan los puntos
// de interconexión (boca de túnel / boca de andén) que cada escena dibuja
// estáticamente al fondo de su propio VP.

import { canvas }       from '../../mecanica/estado.js';
import { TunelBase }    from './tunel_base.js';
import { EstacionBase } from './estacion_base.js';

export class MetroBase {
  /**
   * @param {Array<RouteStop>} route   Lista de paradas de la línea.
   * @param {object} [opts]
   * @param {string} [opts.lineColor]  Color de línea para el HUD.
   */
  constructor(route, opts = {}) {
    this.route        = route ?? [];
    this.lineColor    = opts.lineColor ?? '#F39200';
    this.currentIdx   = 0;
    this.sceneType    = 'station'; // 'station' | 'tunnel'
    this.currentScene = null;
    this._finished    = false;
  }

  init() {
    this.currentIdx   = 0;
    this.sceneType    = 'station';
    this.currentScene = null;
    this._finished    = false;
    this._loadScene();
  }

  /** Reset rápido (mismo recorrido, desde el primer andén). */
  reset() { this.init(); }

  update(dt) {
    if (this._finished) return;
    if (!this.currentScene) return;
    this.currentScene.update(dt);
    if (this.currentScene.isDone) this._nextScene();
  }

  render(ctx) {
    if (this.currentScene) this.currentScene.render(ctx);
    // El HUD ya NO se pinta aquí — main.js lo pinta DESPUÉS de
    // unapplyCamera para que quede anclado a la pantalla y no se desplace
    // con el escenario cuando la paloma "mueve la cámara". Ver renderHUD().
  }

  /** HUD del progreso. Se pinta SIN aplicar el offset de cámara — debe
   *  quedar anclado a la pantalla independientemente del input. */
  renderHUD(ctx) {
    this._drawProgressHUD(ctx);
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

  /**
   * Progreso global 0–1, sincronizado con los marcadores de estación del
   * HUD.
   *
   *   Andén N        → marcador N (fijo)
   *   Túnel N → N+1  → interpola del marcador N al N+1 según el tiempo
   *                    transcurrido en el túnel.
   */
  get progress() {
    const N = this.route.length;
    if (N === 0)        return 0;
    if (this._finished) return 1;
    const lastIdx = Math.max(1, N - 1);

    if (this.sceneType === 'station') {
      return Math.min(1, this.currentIdx / lastIdx);
    }

    // Túnel: interpolación lineal entre marcador N y N+1.
    const cfg = this.currentScene?.cfg;
    const dur = cfg?.durationSeconds || 1;
    const elapsed = this.currentScene?._frame != null
      ? this.currentScene._frame / 60
      : 0;
    const sub = Math.min(1, elapsed / dur);
    return Math.min(1, (this.currentIdx + sub) / lastIdx);
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
    // Pre-crear la siguiente escena como "preview" — la escena actual
    // la dibuja recortada al contorno de su boca (`_drawTunnelMouth` de
    // EstacionBase / `_drawDestinationFront` de TunelBase). Así durante
    // toda la escena (y especialmente en la aproximación final) el
    // jugador ve el escenario destino real al fondo, no un gradiente.
    this._loadDestinationPreview();
  }

  /** Crea el `_destinationScene` que la escena actual dibujará dentro de
   *  su boca. NO llama a init() con efectos secundarios globales (como
   *  setTrenLED): el preview es una versión "decorativa" que sólo se
   *  rendea, no se actualiza. */
  _loadDestinationPreview() {
    let dest = null;
    if (this.sceneType === 'station') {
      // Estación N → siguiente escena = Túnel del mismo stop (camino al
      // próximo andén). Vista interior del túnel inmediatamente después
      // de la boca del andén actual.
      const stop = this.route[this.currentIdx];
      if (stop) {
        dest = new TunelBase(stop.tunelConfig);
        dest.init();
      }
    } else {
      // Túnel N → siguiente escena = Estación N+1 (andén destino).
      const nextStop = this.route[this.currentIdx + 1];
      if (nextStop) {
        dest = new EstacionBase(nextStop.stationConfig);
        // Construimos pero NO llamamos init() para evitar efectos
        // secundarios globales (setTrenLED). Pasajeros y fluorescentes se
        // inicializan a estados visualmente neutros en el constructor.
        dest._spawnPassengers && dest._spawnPassengers();
      }
    }
    this._destinationScene = dest;
    if (this.currentScene) this.currentScene._destinationScene = dest;
  }

  _nextScene() {
    if (this.sceneType === 'station') {
      // ¿Era la última estación de la ruta? El trayecto termina aquí.
      if (this.currentIdx >= this.route.length - 1) {
        this._finished = true;
        return;
      }
      // Estación → Túnel (mismo índice — es el túnel HACIA la siguiente).
      this.sceneType = 'tunnel';
      this._loadScene();
      return;
    }

    // Túnel → siguiente Estación.
    this.sceneType = 'station';
    this.currentIdx++;
    if (this.currentIdx >= this.route.length) {
      this._finished    = true;
      this.currentScene = null;
      return;
    }
    this._loadScene();
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
