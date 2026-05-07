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
//
// Modelo del tren: una sola entrada por convoy con `zHead` (frente) y
// `length` (extensión en Z). La pieza se pinta como UNA forma extruida
// (techo + costado + cara frontal), no como N sprites encadenados.

import { canvas, STATE }      from '../../mecanica/estado.js';
import { w2sx, w2sy, perspective, getCameraVpY } from '../../mecanica/camara.js';
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
// 0.255/0.03 (validado en mockup_tunel_render.html): vías un 20 % más
// estrechas, mayor separación central, raíles 3D más gruesos.
const TRACK_OUTER_RATIO_BASE = 0.255;
const TRACK_INNER_RATIO_BASE = 0.05;    // vías más separadas en la base
const TRACK_OUTER_RATIO_VP   = 0.018;
const TRACK_INNER_RATIO_VP   = 0.010;   // < OUTER_VP para que los rieles
                                        // de cada vía no se crucen al VP
const TUNEL_VPY_RATIO        = 0.42;   // coincide con _defaultVpY de tunel.js
// 0.85 (antes 0.95): cada tren ocupa ~85 % del ancho de su vía → los dos
// trenes juntos cubren ~51 % del canvas (la mitad pedida).
const TRAIN_TO_TRACK_RATIO   = 0.85;

const DEFAULT_CONFIG = {
  // ── Visual ────────────────────────────────────────────────────────────────
  bgColor:            '#050508',
  lightColor:         '#ffeebb',
  // ── Geometría (todas son fracciones 0–1 del canvas) ──────────────────────
  // VP arriba (0.30) → MENOS techo, más canvas abajo para trenes y vías.
  // null usaría los defaults históricos de drawTunel — aquí los fijamos para
  // forzar la composición "tren bajo, techo apretado" pedida.
  vanishingPointY:       0.30,
  archRadiusRatio:       null,    // ancho del túnel
  archCenterOffsetRatio: null,    // cuánto suelo se ve
  // ── Gameplay ──────────────────────────────────────────────────────────────
  trainSpawnInterval: 140,       // frames entre trenes (~2.3s a 60fps — espacio para tren de 8 vagones)
  obstacleSpawnInterval: 110,    // frames entre obstáculos
  obstacleTypes:      [],        // sin tuberías por defecto — el túnel queda limpio (sólo trenes)
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
    // Cada elemento de tracks.{left,right} es un TREN COMPLETO:
    //   { trainId, side, zHead, longVag, numVag, length }
    this.tracks    = { left: [], right: [] };
    this.obstacles = [];
    this._frame    = 0;
    this._spawnTimer    = 0;
    this._obstacleTimer = 0;
    this._lastTrack     = 'right';
    this._done     = false;
    this._nextTrainId = 0;
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
    this._nextTrainId   = 0;
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

    // Avanzar zHead de cada tren y limpiar los que ya han salido.
    // El tren ocupa [zHead .. zHead + length]. Cuando incluso la cola
    // (zTail) ha cruzado el umbral negativo, el convoy entero ha pasado.
    for (const track of [this.tracks.left, this.tracks.right]) {
      for (const t of track) t.zHead -= speed * dt * 4;
      for (let i = track.length - 1; i >= 0; i--) {
        if (track[i].zHead + track[i].length < -100) track.splice(i, 1);
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
    this._drawTrainsExtruded(ctx, { stripeColor: trainColor });
  }

  /**
   * Pinta cada tren como UNA pieza extruida (techo + costado + cara frontal).
   * Las divisiones de vagón se sugieren con marcas transversales en el techo
   * y puertas dobles a lo largo del costado — no son sprites separados.
   */
  _drawTrainsExtruded(ctx, variant) {
    const all = [...this.tracks.left, ...this.tracks.right];
    // Más lejos primero para que los cercanos los tapen.
    all.sort((a, b) => b.zHead - a.zHead);

    for (const train of all) {
      // Recortar SOLO si todo el convoy está fuera de rango. NO clampar la
      // cabeza al pasar la cámara: la cara frontal debe seguir su z natural
      // y salir por debajo del canvas, dejando ver el costado/techo del
      // resto del tren mientras "atraviesa" la cámara.
      if (train.zHead > 1100) continue;                          // aún por aparecer
      if (train.zHead + train.length < -100) continue;           // ya pasó del todo

      const zTail = train.zHead + train.length;
      const headPos = this._getTrainPosAtZ(train.zHead, train.side);
      const tailPos = this._getTrainPosAtZ(zTail, train.side);
      if (!headPos || !tailPos) continue;

      const halfW_head = 24 * headPos.scale;
      const halfH_head = 20 * headPos.scale;
      const halfW_tail = 24 * tailPos.scale;
      const halfH_tail = 20 * tailPos.scale;

      // Costado VISIBLE: el lado del tren que mira hacia el centro de la
      // pantalla. Tren en vía DERECHA → su flanco izquierdo es el visible.
      const sideSign = train.side === 'right' ? -1 : 1;

      const headLeftX  = headPos.cx + sideSign * halfW_head;   // borde visible
      const headRightX = headPos.cx - sideSign * halfW_head;   // borde oculto (tras la cabina)
      const headTopY   = headPos.cy - halfH_head;
      const headBotY   = headPos.cy + halfH_head;
      const tailLeftX  = tailPos.cx + sideSign * halfW_tail;
      const tailRightX = tailPos.cx - sideSign * halfW_tail;
      const tailTopY   = tailPos.cy - halfH_tail;
      const tailBotY   = tailPos.cy + halfH_tail;

      const lineColor = variant?.stripeColor ?? '#F39200';

      // ── 1. TECHO (top face) ─────────────────────────────────────────────
      // Trapecio entre los 4 vértices superiores. Degradado a lo largo
      // (claro al frente → oscuro al fondo) sugiere sombra del túnel.
      const roofGrad = ctx.createLinearGradient(headPos.cx, headTopY, tailPos.cx, tailTopY);
      roofGrad.addColorStop(0, '#C8C8D0');
      roofGrad.addColorStop(1, '#6E6E78');
      ctx.fillStyle = roofGrad;
      ctx.beginPath();
      ctx.moveTo(headLeftX,  headTopY);
      ctx.lineTo(headRightX, headTopY);
      ctx.lineTo(tailRightX, tailTopY);
      ctx.lineTo(tailLeftX,  tailTopY);
      ctx.closePath(); ctx.fill();

      // Línea longitudinal del techo (canalón / pantógrafo)
      ctx.strokeStyle = 'rgba(40,40,50,0.55)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(headPos.cx, headTopY + halfH_head * 0.04);
      ctx.lineTo(tailPos.cx, tailTopY + halfH_tail * 0.04);
      ctx.stroke();

      // Junturas transversales entre vagones
      for (let v = 1; v < train.numVag; v++) {
        const t  = v / train.numVag;
        const xL = headLeftX  + (tailLeftX  - headLeftX)  * t;
        const xR = headRightX + (tailRightX - headRightX) * t;
        const yT = headTopY   + (tailTopY   - headTopY)   * t;
        ctx.strokeStyle = 'rgba(30,30,40,0.45)';
        ctx.beginPath(); ctx.moveTo(xL, yT); ctx.lineTo(xR, yT); ctx.stroke();
      }

      // ── 2. COSTADO LATERAL (panel blanco) ───────────────────────────────
      ctx.fillStyle = '#E8E8EE';
      ctx.beginPath();
      ctx.moveTo(headLeftX, headTopY);
      ctx.lineTo(tailLeftX, tailTopY);
      ctx.lineTo(tailLeftX, tailBotY);
      ctx.lineTo(headLeftX, headBotY);
      ctx.closePath(); ctx.fill();

      // Sombra superior del lateral (donde cae el techo sobre la chapa)
      const roofShadowH_head = halfH_head * 0.18;
      const roofShadowH_tail = halfH_tail * 0.18;
      ctx.fillStyle = '#BBBBC2';
      ctx.beginPath();
      ctx.moveTo(headLeftX, headTopY);
      ctx.lineTo(tailLeftX, tailTopY);
      ctx.lineTo(tailLeftX, tailTopY + roofShadowH_tail);
      ctx.lineTo(headLeftX, headTopY + roofShadowH_head);
      ctx.closePath(); ctx.fill();

      // Banda corrida de ventanas
      const winT_head = halfH_head * 0.30, winB_head = halfH_head * 0.05;
      const winT_tail = halfH_tail * 0.30, winB_tail = halfH_tail * 0.05;
      ctx.fillStyle = '#1F3344';
      ctx.beginPath();
      ctx.moveTo(headLeftX, headPos.cy - winT_head);
      ctx.lineTo(tailLeftX, tailPos.cy - winT_tail);
      ctx.lineTo(tailLeftX, tailPos.cy - winB_tail);
      ctx.lineTo(headLeftX, headPos.cy - winB_head);
      ctx.closePath(); ctx.fill();

      // Subdivisiones (marcos de vagón) y puertas dobles dentro de cada vagón
      const lerp = (a, b, t) => a + (b - a) * t;
      for (let v = 0; v <= train.numVag; v++) {
        const t  = v / train.numVag;
        const x1 = lerp(headLeftX, tailLeftX, t);
        const yT = lerp(headTopY,  tailTopY,  t);
        const yB = lerp(headBotY,  tailBotY,  t);
        ctx.strokeStyle = 'rgba(80,80,90,0.6)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x1, yT); ctx.lineTo(x1, yB); ctx.stroke();
      }
      for (let v = 0; v < train.numVag; v++) {
        for (const f of [v / train.numVag + 1 / (3 * train.numVag),
                          v / train.numVag + 2 / (3 * train.numVag)]) {
          const xC      = lerp(headLeftX, tailLeftX, f);
          const yT      = lerp(headPos.cy + halfH_head * 0.05,
                                tailPos.cy + halfH_tail * 0.05, f);
          const yB      = lerp(headBotY - halfH_head * 0.30,
                                tailBotY - halfH_tail * 0.30, f);
          const xL_door = lerp(headLeftX, tailLeftX, f - 0.005);
          const xR_door = lerp(headLeftX, tailLeftX, f + 0.005);
          ctx.fillStyle = '#888';
          ctx.beginPath();
          ctx.moveTo(xL_door, yT); ctx.lineTo(xR_door, yT);
          ctx.lineTo(xR_door, yB); ctx.lineTo(xL_door, yB);
          ctx.closePath(); ctx.fill();
        }
      }

      // Franja de color de línea (continua a lo largo del costado)
      const stripeT_head = halfH_head * 0.40, stripeB_head = halfH_head * 0.65;
      const stripeT_tail = halfH_tail * 0.40, stripeB_tail = halfH_tail * 0.65;
      ctx.fillStyle = lineColor;
      ctx.beginPath();
      ctx.moveTo(headLeftX, headPos.cy + stripeT_head);
      ctx.lineTo(tailLeftX, tailPos.cy + stripeT_tail);
      ctx.lineTo(tailLeftX, tailPos.cy + stripeB_tail);
      ctx.lineTo(headLeftX, headPos.cy + stripeB_head);
      ctx.closePath(); ctx.fill();

      // Chasis (base oscura)
      ctx.fillStyle = '#222233';
      ctx.beginPath();
      ctx.moveTo(headLeftX, headPos.cy + stripeB_head);
      ctx.lineTo(tailLeftX, tailPos.cy + stripeB_tail);
      ctx.lineTo(tailLeftX, tailBotY);
      ctx.lineTo(headLeftX, headBotY);
      ctx.closePath(); ctx.fill();

      // ── 3. CARA FRONTAL (cabina) sólo en la cabeza ─────────────────────
      // Se pinta encima del costado para que la arista frontal quede limpia.
      drawTrenFrontal(ctx, headPos.cx, headPos.cy, headPos.scale, variant, undefined);

      // ── 4. Halo de faros ────────────────────────────────────────────────
      const haloR = 25 * headPos.scale;
      const grad  = ctx.createRadialGradient(headPos.cx, headPos.cy - 5 * headPos.scale, 1,
                                              headPos.cx, headPos.cy - 5 * headPos.scale, haloR);
      grad.addColorStop(0, 'rgba(255, 200, 100, 0.4)');
      grad.addColorStop(1, 'rgba(255, 200, 100, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(headPos.cx - haloR, headPos.cy - 30 * headPos.scale, haloR * 2, 50 * headPos.scale);
    }
  }

  /**
   * Calcula la posición de pantalla y escala de un punto del tren a una
   * profundidad z y en un lado de vía. El punto se sitúa en el CENTRO de la
   * vía a esa profundidad (interpolación trapezoidal), igual que en el
   * sistema anterior — así el tren queda alineado con los rieles.
   *
   * Devuelve { cx, cy, scale } o null si está totalmente fuera de rango.
   */
  _getTrainPosAtZ(z, side) {
    // Nota: NO se descarta por z negativa. Cuando la cabeza atraviesa la
    // cámara (z < 0) seguimos proyectando para que el costado/techo del
    // tren continúen mostrándose mientras la cara frontal sale por abajo.
    if (z > 1200) return null;

    const cw   = canvas.width;
    const ch   = canvas.height;
    const vpX  = cw / 2;
    // VP vertical AJUSTADO por camera.offsetY — igual que los rieles
    // (tunel.js _drawRails). Sin esto, al subir/bajar la paloma los rieles
    // se inclinan pero el tren no, y queda desalineado.
    const vpY  = getCameraVpY(ch * (this.cfg.vanishingPointY ?? TUNEL_VPY_RATIO));
    const SPAWN = SPAWN_Z;

    // Permite prog > 1 para que la cabeza siga bajando por debajo del canvas
    // (atravesando la cámara) en vez de quedarse pegada al borde inferior.
    const prog = Math.max(-0.10, Math.min(2.0, 1 - z / SPAWN));

    const sign = side === 'left' ? -1 : 1;
    const centerBase = vpX + sign * cw * (TRACK_OUTER_RATIO_BASE + TRACK_INNER_RATIO_BASE) / 2;
    const centerVP   = vpX + sign * cw * (TRACK_OUTER_RATIO_VP   + TRACK_INNER_RATIO_VP)   / 2;
    const widthBase  = cw * (TRACK_OUTER_RATIO_BASE - TRACK_INNER_RATIO_BASE);
    const widthVP    = cw * (TRACK_OUTER_RATIO_VP   - TRACK_INNER_RATIO_VP);

    const cx     = (1 - prog) * centerVP + prog * centerBase;
    const widthH = (1 - prog) * widthVP   + prog * widthBase;

    const SPRITE_W = TRAIN_CFG.baseWidth  ?? 48;
    const SPRITE_H = TRAIN_CFG.baseHeight ?? 40;
    const scale    = Math.max(0.04, (widthH * TRAIN_TO_TRACK_RATIO) / SPRITE_W);

    const bottomY = (1 - prog) * (vpY + 8) + prog * ch;
    const cy      = bottomY - (SPRITE_H * scale) / 2;

    return { cx, cy, scale, prog };
  }

  /**
   * Hitboxes de los trenes — un HALO CIRCULAR por tren, centrado en la cara
   * frontal de la cabeza del convoy (donde están los faros, la zona de
   * peligro real). La paloma colisiona si toca el halo, no el AABB
   * completo del sprite. Devuelve círculos con `{ cx, cy, r }` y mantiene
   * los campos `{ x, y, w, h }` (bounding box del círculo) para que el
   * código que pinta hitboxes en debug pueda seguir leyéndolos.
   *
   * Sólo la cabeza colisiona — al pasar el frente, el resto del convoy
   * queda lateralmente fuera del corredor de vuelo. Esto elimina el bug
   * histórico de "morir contra el segundo vagón" cuando la cabeza ya
   * había pasado.
   */
  getTrainHitboxes() {
    const preset = PM.getActive();
    const _f     = preset?.fisica ?? {};
    const margin = _f.trainHitboxMargin ?? 0;
    // Radio base del halo: la mitad del alto del sprite (40 / 2 = 20 px),
    // así el halo INSCRIBE el cuerpo del tren — no se sale por encima del
    // techo ni por debajo del chasis. La paloma colisiona cuando entra en
    // el área que realmente ocupa el frente del tren, no en un aura más
    // alta de lo que mide el vagón.
    const SPRITE_H = TRAIN_CFG.baseHeight ?? 40;
    const HALO_R_BASE = SPRITE_H / 2;
    const halos = [];

    for (const track of [this.tracks.left, this.tracks.right]) {
      for (const train of track) {
        const pos = this._getTrainPosAtZ(train.zHead, train.side);
        if (!pos) continue;

        const r  = HALO_R_BASE * pos.scale * (1 - margin);
        if (r < 1) continue;
        // Centro del halo: centro EXACTO del sprite del tren (no
        // desplazado a los faros). Coincide con la posición de la paloma
        // que vuela centrada en pantalla y a la altura de la vía.
        const cx = pos.cx;
        const cy = pos.cy;
        halos.push({
          cx, cy, r,
          // Bounding box (compatibilidad: el debug y otros consumidores AABB
          // pueden usarlos sin saber del círculo).
          x: cx - r, y: cy - r, w: r * 2, h: r * 2,
        });
      }
    }
    return halos;
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  _spawnTrain() {
    const side = this._lastTrack === 'right' ? 'left' : 'right';
    this._lastTrack = side;

    const numVag  = this.cfg.numVagones      ?? 6;
    const longVag = this.cfg.vagonSeparation ?? 32;
    const length  = numVag * longVag;
    this._nextTrainId++;

    this.tracks[side].push({
      trainId: this._nextTrainId,
      side,
      zHead:   SPAWN_Z,
      longVag,
      numVag,
      length,
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
