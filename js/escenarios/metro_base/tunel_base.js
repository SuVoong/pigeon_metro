// escenarios/metro_base/tunel_base.js
// TunelBase — escena de túnel: spawn + render de trenes y obstáculos.
// NO sabe nada de estaciones ni de la línea concreta.
// Recibe un objeto config con overrides visuales y de gameplay; al cabo de
// cfg.durationSeconds marca isDone=true y el orquestador pasa a la siguiente
// escena (típicamente una EstacionBase).
//
// Reusa el render fotorrealista existente (drawTunel + drawTrack del paquete
// metros/metro_base) para preservar fidelidad. La novedad es la encapsulación
// como clase con duración y estado limpio.

import { canvas, STATE }      from '../../mecanica/estado.js';
import { w2sx, w2sy, perspective } from '../../mecanica/camara.js';
import { drawTunel }          from '../metros/metro_base/tunel.js';
import { OBSTACULOS }         from '../../elementos/obstaculos.js';
import { getTrenVariante }    from '../../elementos/tren_config.js';
import { TRAIN_CFG }          from '../../editor/train_config.js';
import { drawTrenFrontal }    from '../../elementos/tren.js';
import * as PM                from '../../editor/preset_manager.js';

// Mismas ratios trapezoidales que tunel.js / estacion_base.js — los trenes
// siguen exactamente el CENTRO de cada vía a su profundidad para que se vean
// "circular sobre los rieles" sin desalineación. Si tocas estas constantes,
// cámbialas también en tunel.js y estacion_base.js (DEFAULT_CONFIG).
const TRACK_OUTER_RATIO_BASE = 0.32;
const TRACK_INNER_RATIO_BASE = 0.03;
const TRACK_OUTER_RATIO_VP   = 0.018;
const TRACK_INNER_RATIO_VP   = 0.015;
const TUNEL_VPY_RATIO        = 0.42;   // coincide con _defaultVpY de tunel.js
const TRAIN_TO_TRACK_RATIO   = 0.85;

const DEFAULT_CONFIG = {
  // ── Visual ────────────────────────────────────────────────────────────────
  bgColor:            '#050508',
  lightColor:         '#ffeebb',
  // ── Geometría (todas son fracciones 0–1 del canvas) ──────────────────────
  // null → drawTunel usa los defaults históricos (vp=0.47, radio=0.70,
  // offset arco=0.20). El editor de escenarios puede sobrescribirlas.
  vanishingPointY:       null,
  archRadiusRatio:       null,    // ancho del túnel
  archCenterOffsetRatio: null,    // cuánto suelo se ve
  // ── Gameplay ──────────────────────────────────────────────────────────────
  trainSpawnInterval: 140,       // frames entre trenes (~2.3s a 60fps — espacio para tren de 8 vagones)
  obstacleSpawnInterval: 110,    // frames entre obstáculos
  obstacleTypes:      ['pipe'],
  trainLineVariant:   'linea_3',
  speed:              2,
  trainW:             180,
  trainH:             110,
  // ── Duración de la sección ────────────────────────────────────────────────
  durationSeconds:    18,
};

const SPAWN_Z = 800;

export class TunelBase {
  constructor(configOverride = {}) {
    this.cfg       = { ...DEFAULT_CONFIG, ...configOverride };
    this.tracks    = { left: [], right: [] };
    this.obstacles = [];
    this._frame    = 0;
    this._spawnTimer    = 0;
    this._obstacleTimer = 0;
    this._lastTrack     = 'right';
    this._done     = false;
  }

  get isDone() { return this._done; }

  /** Reinicia el estado (llamado por MetroBase al cargar la escena). */
  init() {
    this.tracks.left.length  = 0;
    this.tracks.right.length = 0;
    this.obstacles.length    = 0;
    this._frame         = 0;
    this._spawnTimer    = 0;
    this._obstacleTimer = 0;
    this._lastTrack     = 'right';
    this._done          = false;
  }

  /**
   * Avanza un frame. dt ≈ 1.0 para 60fps. Spawnea/limpia trenes y obstáculos.
   * Marca isDone=true al cumplirse cfg.durationSeconds.
   */
  update(dt) {
    this._frame += dt;
    const elapsedSec = this._frame / 60;

    // Fin de sección
    if (elapsedSec >= this.cfg.durationSeconds) {
      this._done = true;
      return;
    }

    const speed = this.cfg.speed;

    // Avanzar Z de trenes
    for (const track of [this.tracks.left, this.tracks.right]) {
      for (const t of track) t.z -= speed * dt * 4;
      for (let i = track.length - 1; i >= 0; i--) {
        if (track[i].z < -100) track.splice(i, 1);
      }
    }

    // Avanzar Z de obstáculos
    for (const o of this.obstacles) o.z -= speed * dt * 4;
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      if (this.obstacles[i].z < -100) this.obstacles.splice(i, 1);
    }

    // Spawn de trenes (alterna L/R)
    this._spawnTimer += dt;
    if (this._spawnTimer >= this.cfg.trainSpawnInterval) {
      this._spawnTimer = 0;
      this._spawnTrain();
    }

    // Spawn de obstáculos
    this._obstacleTimer += dt;
    if (this._obstacleTimer >= this.cfg.obstacleSpawnInterval) {
      this._obstacleTimer = 0;
      this._spawnObstacle();
    }
  }

  /** Render: túnel + obstáculos + trenes alineados con las vías. */
  render(ctx) {
    drawTunel(ctx, {
      bgColor:               this.cfg.bgColor,
      lightColor:            this.cfg.lightColor,
      vanishingPointY:       this.cfg.vanishingPointY,
      archRadiusRatio:       this.cfg.archRadiusRatio,
      archCenterOffsetRatio: this.cfg.archCenterOffsetRatio,
    }, STATE.worldZ);
    this._renderObstacles(ctx);

    const variante   = getTrenVariante(this.cfg.trainLineVariant);
    const trainColor = variante.stripeColor ?? '#F39200';
    this._drawTrainsOnRails(ctx, { stripeColor: trainColor });

    // ── LUZ AL FINAL DEL TÚNEL ───────────────────────────────────────────
    // Complementa la animación de la boca de túnel en EstacionBase: en vez
    // de un arco oscuro que crece, es una LUZ BLANCA que aparece al fondo
    // y crece exponencialmente, cegándonos cuando salimos a la siguiente
    // estación. La transición túnel ↔ estación queda envuelta en blanco.
    this._drawTunnelExitLight(ctx);

    // ── Fade-in NEGRO al entrar al túnel ─────────────────────────────────
    // La estación anterior terminó con el arco oscuro envolviendo la cámara.
    // Para que el cambio de escena sea fluido, arrancamos el túnel con un
    // overlay NEGRO que se desvanece rápidamente, dando continuidad visual.
    this._drawEntryDarkness(ctx);
  }

  /** Overlay negro que se desvanece al INICIAR la escena de túnel. Encadena
   *  con el final oscuro del arco de la estación anterior. */
  _drawEntryDarkness(ctx) {
    const dur = this.cfg.durationSeconds || 1;
    const t   = (this._frame / 60) / dur;
    if (t >= 0.20) return;

    const local = t / 0.20;
    const alpha = Math.pow(1 - local, 1.5);
    ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  /**
   * Dibuja la luz blanca al final del túnel — efecto "luz al final del
   * túnel" que crece exponencialmente. La luz está CONTENIDA dentro de un
   * arco (la boca del túnel al fondo) — sólo escapa por ahí, simulando
   * que vemos la siguiente estación a través de la apertura del túnel.
   *
   * Curva temporal:
   *   t = 0.00 → 0.30:  Arco pequeño con luz visible al fondo
   *   t = 0.30 → 0.70:  Arco/luz crecen moderadamente (nos acercamos)
   *   t = 0.70 → 1.00:  Crecimiento exponencial — el arco abarca todo
   *                     y la luz nos ciega al cambiar de escena.
   */
  _drawTunnelExitLight(ctx) {
    const cw  = canvas.width;
    const ch  = canvas.height;
    const vpX = cw / 2;
    const vpY = ch * (this.cfg.vanishingPointY ?? 0.42);

    const dur = this.cfg.durationSeconds || 1;
    const t   = Math.min(1, Math.max(0, (this._frame / 60) / dur));

    // ── Curva combinada: arco visible desde el principio + acelerón final
    // Escalas reducidas para que el final del túnel se vea más contenido.
    let scale, alpha;
    if (t < 0.30) {
      const local = t / 0.30;
      scale = 0.50 + 0.50 * local;          // 0.50 → 1.00
      alpha = 0.55 + 0.20 * local;          // 0.55 → 0.75
    } else if (t < 0.70) {
      const local = (t - 0.30) / 0.40;
      scale = 1.00 + 1.00 * local;          // 1.0 → 2.0  (antes 2.5)
      alpha = 0.75 + 0.15 * local;          // 0.75 → 0.90
    } else {
      const local = (t - 0.70) / 0.30;
      const eased = Math.pow(local, 3);
      scale = 2.0 + 4.0 * eased;            // 2.0 → 6.0  (antes 14.5)
      alpha = 0.90 + 0.10 * eased;          // 0.90 → 1.00
    }

    // ── Geometría del ARCO que contiene la luz ────────────────────────────
    // EXACTAMENTE las mismas proporciones que la boca de túnel de
    // EstacionBase (paredes verticales 85% del radio + semicírculo arriba).
    // Esto asegura interconexión visual: el arco que ves al entrar al
    // túnel y el arco al salir del túnel tienen la misma silueta.
    const baseScale = 0.45;
    const innerHalf = Math.max(28, cw * 0.075) * baseScale * scale;
    const sidesH    = innerHalf * 0.85;
    const baseY     = vpY + 8;

    // Helper: path del arco (rectángulo con techo semicírculo)
    const archPath = (halfW, h) => {
      ctx.beginPath();
      ctx.moveTo(vpX - halfW, baseY);
      ctx.lineTo(vpX - halfW, baseY - h);
      ctx.arc(vpX, baseY - h, halfW, Math.PI, 0, false);
      ctx.lineTo(vpX + halfW, baseY);
      ctx.closePath();
    };

    // ── 1. Recortamos el área a la forma del arco ─────────────────────────
    ctx.save();
    archPath(innerHalf, sidesH);
    ctx.clip();

    // ── 2. Dentro del clip: dibujamos la luz radial ───────────────────────
    // Centro de la luz: ligeramente sobre el centro del semicírculo
    const cy = baseY - sidesH - innerHalf * 0.4;
    const lightRadius = innerHalf * 1.2;

    // Halo cálido (resplandor del andén iluminado al fondo)
    const halo = ctx.createRadialGradient(vpX, cy, 0, vpX, cy, lightRadius);
    halo.addColorStop(0,    `rgba(255, 252, 240, ${alpha})`);
    halo.addColorStop(0.30, `rgba(255, 248, 220, ${alpha * 0.95})`);
    halo.addColorStop(0.60, `rgba(255, 235, 175, ${alpha * 0.70})`);
    halo.addColorStop(0.90, `rgba(255, 220, 130, ${alpha * 0.35})`);
    halo.addColorStop(1,    `rgba(255, 210, 100, ${alpha * 0.15})`);
    ctx.fillStyle = halo;
    ctx.fillRect(vpX - lightRadius, cy - lightRadius,
                 lightRadius * 2, lightRadius * 2);

    // Núcleo blanco brillante (fuente puntual)
    const coreRadius = Math.max(4, innerHalf * 0.45);
    const core = ctx.createRadialGradient(vpX, cy, 0, vpX, cy, coreRadius);
    core.addColorStop(0,   `rgba(255, 255, 255, ${alpha})`);
    core.addColorStop(0.5, `rgba(255, 255, 250, ${alpha * 0.85})`);
    core.addColorStop(1,   'rgba(255, 255, 245, 0)');
    ctx.fillStyle = core;
    ctx.fillRect(vpX - coreRadius, cy - coreRadius,
                 coreRadius * 2, coreRadius * 2);

    ctx.restore();   // fin del clip

    // ── 3. Marco oscuro del arco (encuadra la luz) ────────────────────────
    // Lo dibujamos DESPUÉS del clip para que el contorno del arco sea visible
    // como un marco fino alrededor de la luz (como una pared con un agujero).
    const frameW = Math.max(2, innerHalf * 0.06);
    ctx.strokeStyle = 'rgba(40, 40, 50, 0.8)';
    ctx.lineWidth = frameW;
    archPath(innerHalf + frameW * 0.5, sidesH + frameW * 0.5);
    ctx.stroke();

    // ── 4. Highlight superior del marco (la luz baña el borde del arco) ──
    ctx.strokeStyle = `rgba(255, 250, 220, ${alpha * 0.7})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(vpX, baseY - sidesH, innerHalf, Math.PI, 0, false);
    ctx.stroke();

    // ── 5. Flash final: cuando el arco cubre todo, overlay blanco ─────────
    if (t > 0.95) {
      const flashLocal = (t - 0.95) / 0.05;
      const flashAlpha = Math.pow(flashLocal, 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${flashAlpha})`;
      ctx.fillRect(0, 0, cw, ch);
    }
  }

  /**
   * Dibuja los trenes pegados al CENTRO de cada vía a su profundidad. Usa
   * las mismas matemáticas que EstacionBase._drawTrains: el sprite se
   * escala para ocupar ~85% del ancho de la vía y la BASE del sprite cae
   * sobre la traviesa correspondiente. De este modo la transición túnel ↔
   * estación es visualmente continua.
   */
  _drawTrainsOnRails(ctx, variant) {
    // Pintamos los más lejanos primero para que los cercanos los tapen
    const all = [...this.tracks.left, ...this.tracks.right]
      .filter((t) => t.z >= -50 && t.z <= 900)
      .sort((a, b) => b.z - a.z);

    for (const train of all) {
      const pos = this._getTrainScreenPos(train);
      if (!pos) continue;

      drawTrenFrontal(ctx, pos.cx, pos.cy, pos.scale, variant, undefined);

      // Halo de faros (mismo que EstacionBase)
      const haloR = 25 * pos.scale;
      const grad  = ctx.createRadialGradient(pos.cx, pos.cy - 5 * pos.scale, 1,
                                              pos.cx, pos.cy - 5 * pos.scale, haloR);
      grad.addColorStop(0, 'rgba(255, 200, 100, 0.4)');
      grad.addColorStop(1, 'rgba(255, 200, 100, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(pos.cx - haloR, pos.cy - 30 * pos.scale, haloR * 2, 50 * pos.scale);
    }
  }

  /**
   * Calcula la posición de pantalla y escala de un tren basándose en su z
   * y en el lado de la vía. El tren se posiciona en el CENTRO de la vía a
   * esa profundidad (interpolación trapezoidal), no por proyección
   * perspectiva pura — esto garantiza alineación exacta con los rieles.
   *
   * Devuelve { cx, cy, scale } o null si el tren está fuera de rango.
   */
  _getTrainScreenPos(train) {
    if (train.z < -50 || train.z > 900) return null;

    const cw   = canvas.width;
    const ch   = canvas.height;
    const vpX  = cw / 2;
    const vpY  = ch * (this.cfg.vanishingPointY ?? TUNEL_VPY_RATIO);
    const SPAWN = SPAWN_Z;

    // Progress 0 = lejos (VP), 1 = cerca (base). Lo derivamos de z para que
    // los cálculos coincidan con la curva de scroll del túnel.
    const prog = Math.max(-0.05, Math.min(1.5, 1 - train.z / SPAWN));

    // Centro de la vía y ancho a esa profundidad (interpolación lineal entre
    // base y VP — coincide con _drawRails de tunel.js).
    const sign = train.side === 'left' ? -1 : 1;
    const centerBase = vpX + sign * cw * (TRACK_OUTER_RATIO_BASE + TRACK_INNER_RATIO_BASE) / 2;
    const centerVP   = vpX + sign * cw * (TRACK_OUTER_RATIO_VP   + TRACK_INNER_RATIO_VP)   / 2;
    const widthBase  = cw * (TRACK_OUTER_RATIO_BASE - TRACK_INNER_RATIO_BASE);
    const widthVP    = cw * (TRACK_OUTER_RATIO_VP   - TRACK_INNER_RATIO_VP);

    const cx     = (1 - prog) * centerVP + prog * centerBase;
    const widthH = (1 - prog) * widthVP   + prog * widthBase;

    // Escala: el tren ocupa ~85% del ancho de vía a esta profundidad
    const SPRITE_W = TRAIN_CFG.baseWidth  ?? 48;
    const SPRITE_H = TRAIN_CFG.baseHeight ?? 40;
    const scale    = Math.max(0.05, (widthH * TRAIN_TO_TRACK_RATIO) / SPRITE_W);

    // Y: la BASE del sprite se alinea con la traviesa (el rail a esa altura)
    const bottomY = (1 - prog) * (vpY + 8) + prog * ch;
    const cy      = bottomY - (SPRITE_H * scale) / 2;

    return { cx, cy, scale, prog };
  }

  /**
   * Hitboxes de los trenes en coords de pantalla. Usa la MISMA geometría
   * que el render para que las colisiones cuadren con lo que se ve.
   */
  getTrainHitboxes() {
    const preset = PM.getActive();
    const _f     = preset?.fisica ?? {};
    const margin = _f.trainHitboxMargin ?? 0;
    const SPRITE_W = TRAIN_CFG.baseWidth  ?? 48;
    const SPRITE_H = TRAIN_CFG.baseHeight ?? 40;
    const boxes  = [];

    for (const track of [this.tracks.left, this.tracks.right]) {
      for (const train of track) {
        const pos = this._getTrainScreenPos(train);
        if (!pos) continue;

        const renderW = SPRITE_W * pos.scale;
        const renderH = SPRITE_H * pos.scale;
        const hw = renderW * (0.5 - margin);
        const hh = renderH * (0.5 - margin);

        boxes.push({ x: pos.cx - hw, y: pos.cy - hh, w: hw * 2, h: hh * 2 });
      }
    }
    return boxes;
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  _spawnTrain() {
    const side = this._lastTrack === 'right' ? 'left' : 'right';
    this._lastTrack = side;
    // x/y son legacy (perspective render no se usa ya); side y z controlan
    // todo en _getTrainScreenPos. Mantenemos w/h por si algún caller los lee.
    this.tracks[side].push({
      x: 0,
      y: 0,
      z: SPAWN_Z,
      w: this.cfg.trainW,
      h: this.cfg.trainH,
      side,
    });
  }

  _spawnObstacle() {
    if (!this.cfg.obstacleTypes?.length) return;
    const typeId = this.cfg.obstacleTypes[
      Math.floor(Math.random() * this.cfg.obstacleTypes.length)
    ];
    const def = OBSTACULOS[typeId];
    if (!def) return;

    if (typeId === 'pipe') {
      const side    = Math.random() < 0.5 ? -1 : 1;
      const yOffset = (80 + Math.random() * 60) * side;
      this.obstacles.push({
        type: typeId, z: SPAWN_Z, x: 0, y: yOffset, w: 400, h: def.defaultH,
      });
    } else {
      this.obstacles.push({
        type: typeId, z: SPAWN_Z, x: 0, y: 0, w: 90, h: def.defaultH ?? 60,
      });
    }
  }

  _renderObstacles(ctx) {
    const sorted = [...this.obstacles].sort((a, b) => b.z - a.z);
    for (const obj of sorted) {
      const def = OBSTACULOS[obj.type];
      if (!def) continue;
      const scale = perspective(obj.z);
      const sx = w2sx(obj.x * scale);
      const sy = w2sy(obj.y * scale);
      const sw = obj.w * scale;
      const sh = obj.h * scale;
      def.draw(ctx, sx, sy, sw, sh, scale);
    }
  }
}
