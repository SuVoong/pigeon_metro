// escenarios/metro_base/tunel_base.js
// TunelBase — escena de túnel: spawn + render de trenes y obstáculos.
// NO sabe nada de estaciones ni de la línea concreta.
// Recibe un objeto config con overrides visuales y de gameplay; al cabo de
// cfg.durationSeconds marca isDone=true y el orquestador pasa a la siguiente
// escena (típicamente una EstacionBase).
//
// Reusa el render fotorrealista existente (drawTunel de ./tunel.js) para
// preservar fidelidad. La novedad es la encapsulación como clase con
// duración y estado limpio.

import { canvas, STATE }      from '../../mecanica/estado.js';
import { w2sx, w2sy, perspective } from '../../mecanica/camara.js';
import { drawTunel }          from './tunel.js';
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

    // Avanzar Z de trenes y limpiar vagones pasados.
    // Cada vagón pertenece a un "tren" identificado por trainId. Solo
    // eliminamos un vagón si TODOS los vagones de su tren ya pasaron el
    // umbral — así la cabeza no se borra antes que la cola y el tren
    // entero permanece visible al cruzar el borde de pantalla.
    for (const track of [this.tracks.left, this.tracks.right]) {
      for (const t of track) t.z -= speed * dt * 4;
      // Construir map trainId → maxZ del grupo
      const maxZByTrain = new Map();
      for (const t of track) {
        const cur = maxZByTrain.get(t.trainId) ?? -Infinity;
        if (t.z > cur) maxZByTrain.set(t.trainId, t.z);
      }
      for (let i = track.length - 1; i >= 0; i--) {
        const groupMax = maxZByTrain.get(track[i].trainId);
        if (groupMax !== undefined && groupMax < -100) track.splice(i, 1);
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

  /** Render: túnel + obstáculos + trenes alineados con las vías.
   *  Las transiciones entrada/salida las gestiona MetroBase con un
   *  cross-fade circular desde el punto de fuga; aquí no añadimos
   *  overlays de oscurecimiento ni "luz al final del túnel" — taparían
   *  la siguiente escena dentro del recorte circular. */
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
  }

  /**
   * Dibuja los trenes pegados al CENTRO de cada vía a su profundidad. Usa
   * las mismas matemáticas que EstacionBase._drawTrains: el sprite se
   * escala para ocupar ~85% del ancho de la vía y la BASE del sprite cae
   * sobre la traviesa correspondiente. De este modo la transición túnel ↔
   * estación es visualmente continua.
   */
  _drawTrainsOnRails(ctx, variant) {
    // Pintamos los más lejanos primero para que los cercanos los tapen.
    // Sólo el vagón con isHead=true recibe halo de faros — los traseros
    // van con la cara frontal pero sin luces (parecen vagones intermedios).
    // Entre dos vagones consecutivos del MISMO trainId pintamos un fuelle
    // (trapecio oscuro) que tapa el hueco entre ellos.
    const all = [];
    for (const t of [...this.tracks.left, ...this.tracks.right]) {
      if (t.z < -50 || t.z > 900) continue;
      const pos = this._getTrainScreenPos(t);
      if (!pos) continue;
      all.push({ ref: t, pos });
    }
    all.sort((a, b) => b.ref.z - a.ref.z);

    // Map trainId → último vagón pintado (de mayor z), para encadenar
    // fuelles cuando el vagón actual es el siguiente del tren.
    const lastPainted = new Map();

    for (const { ref, pos } of all) {
      // 1. Fuelle al vagón previamente pintado del mismo tren
      const prev = lastPainted.get(ref.trainId);
      if (prev && prev.ref.vagon === ref.vagon - 1) {
        // prev es vagón anterior (z mayor → arriba/pequeño); ref es vagón
        // actual (z menor → abajo/grande). El fuelle es un trapecio que
        // conecta el centro de prev con el centro de ref, con anchos
        // proporcionales a sus escalas.
        const wPrev = 28 * prev.pos.scale;
        const wCur  = 28 * pos.scale;
        const hPrev = 18 * prev.pos.scale;
        const hCur  = 18 * pos.scale;
        ctx.fillStyle = '#0a0a14';
        ctx.beginPath();
        ctx.moveTo(prev.pos.cx - wPrev, prev.pos.cy + hPrev * 0.2);
        ctx.lineTo(prev.pos.cx + wPrev, prev.pos.cy + hPrev * 0.2);
        ctx.lineTo(pos.cx       + wCur, pos.cy       - hCur  * 0.2);
        ctx.lineTo(pos.cx       - wCur, pos.cy       - hCur  * 0.2);
        ctx.closePath();
        ctx.fill();
      }

      // 2. Pintar el vagón
      drawTrenFrontal(ctx, pos.cx, pos.cy, pos.scale, variant, undefined);

      // 3. Halo de faros sólo para la cabeza del tren
      if (ref.isHead) {
        const haloR = 25 * pos.scale;
        const grad  = ctx.createRadialGradient(pos.cx, pos.cy - 5 * pos.scale, 1,
                                                pos.cx, pos.cy - 5 * pos.scale, haloR);
        grad.addColorStop(0, 'rgba(255, 200, 100, 0.4)');
        grad.addColorStop(1, 'rgba(255, 200, 100, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(pos.cx - haloR, pos.cy - 30 * pos.scale, haloR * 2, 50 * pos.scale);
      }

      lastPainted.set(ref.trainId, { ref, pos });
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
    // Tren de N vagones encadenados — cada vagón es una entrada con su
    // propia z desplazada. Comparten un trainId común para que la
    // limpieza por z no rompa el tren a la mitad (ver update()).
    const NUM_VAGONES = this.cfg.numVagones ?? 6;
    // Separación intermedia: suficiente para que los vagones se distingan
    // unos de otros en perspectiva, pero unidos por el fuelle oscuro que
    // _drawTrainsOnRails pinta entre cada par consecutivo.
    const SEPARACION  = this.cfg.vagonSeparation ?? 32;
    this._nextTrainId = (this._nextTrainId ?? 0) + 1;
    const trainId = this._nextTrainId;
    for (let v = 0; v < NUM_VAGONES; v++) {
      this.tracks[side].push({
        x: 0,
        y: 0,
        z: SPAWN_Z + v * SEPARACION,
        w: this.cfg.trainW,
        h: this.cfg.trainH,
        side,
        trainId,                   // todos los vagones del mismo tren
        vagon: v,                  // 0 = cabeza, >0 = vagones traseros
        isHead: v === 0,
      });
    }
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
