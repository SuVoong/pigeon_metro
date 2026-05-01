// Motor reutilizable de túnel de metro: dos vías paralelas, spawn de
// trenes, scroll Z, rótulo de estación. Cada línea concreta lo configura.

import { STATE, canvas } from '../../../mecanica/estado.js';
import { drawTrack, drawStationSign, setLEDStation } from './metro_base_render.js';
import { TRAIN_CFG } from '../../../editor/train_config.js';
import { drawTunel }  from './tunel.js';
import * as PM from '../../../editor/preset_manager.js';

// Mismas constantes que metro_base_render.js para hitbox sin acoplamiento circular
const FOCAL = 400;
const _perspective = (z) => FOCAL / (FOCAL + z);
const _w2sx = (wx) => canvas.width  / 2 + wx;
const _w2sy = (wy) => canvas.height / 2 + wy;

const DEFAULT_CONFIG = {
  trainColor:     '#F39200',     // naranja Línea 3 por defecto
  trainColorDark: '#C27300',
  bgColor:        '#0d0d1a',
  lightColor:     '#ffffaa',
  speed:          2,
  spawnInterval:  90,             // frames entre apariciones
  tunnelWidth:    0.7,
  trainW:         180,
  trainH:         110,
};

export const MetroBase = {
  // Vías: izquierda (trenes vienen por la izquierda), derecha (vienen por la derecha)
  tracks: { left: [], right: [] },

  config: { ...DEFAULT_CONFIG },

  // Estado del rótulo de estación (se va sustituyendo según progresión)
  currentSign: null,   // { name, lineColor, signY? }

  // Contadores internos
  _spawnTimer: 0,
  _lastTrack:  'right',

  init(lineConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...lineConfig };
    this.reset();
  },

  reset() {
    this.tracks.left.length  = 0;
    this.tracks.right.length = 0;
    this._spawnTimer = 0;
    this._lastTrack  = 'right';
    this.currentSign = null;
  },

  /**
   * Configura el rótulo de estación que se renderiza como banner HUD
   * en la parte superior. La firma legacy aceptaba un tercer parámetro
   * `side` ('left'|'right') que se ignora a partir de ahora; se mantiene
   * la compatibilidad para no romper a llamadores existentes.
   * @param {string} name      Nombre de la estación a mostrar.
   * @param {string} lineColor Color de la línea (acento del banner).
   * @param {object} [options] { y?: número }  desplaza el banner verticalmente.
   */
  setStationSign(name, lineColor, options) {
    // Compatibilidad: si options es un string ('left'|'right') se ignora.
    const opts = (options && typeof options === 'object') ? options : {};
    this.currentSign = { name, lineColor, signY: opts.y };
    setLEDStation(name);
  },

  spawnTrain() {
    // Alternar vías para garantizar siempre una salida
    const side = this._lastTrack === 'right' ? 'left' : 'right';
    this._lastTrack = side;

    const xOffset = side === 'left' ? -120 : 120;
    const train = {
      x: xOffset,
      y: 0,
      z: 800,
      w: this.config.trainW,
      h: this.config.trainH,
      side,
    };
    this.tracks[side].push(train);
  },

  update(dt) {
    const speed = this.config.speed;

    // Avanzar Z (acercar trenes a cámara)
    for (const track of [this.tracks.left, this.tracks.right]) {
      for (const t of track) t.z -= speed * dt * 4;
      // Limpiar trenes ya pasados
      for (let i = track.length - 1; i >= 0; i--) {
        if (track[i].z < -100) track.splice(i, 1);
      }
    }

    // Spawn cadenciado por config.spawnInterval (en frames normalizados a 60fps).
    // dt ≈ 1.0 por frame, por lo que _spawnTimer es un contador de frames.
    this._spawnTimer += dt;
    if (this._spawnTimer >= this.config.spawnInterval) {
      this._spawnTimer = 0;
      this.spawnTrain();
    }
  },

  render(ctx) {
    drawTunel(ctx, this.config, STATE.worldZ);
    drawTrack(ctx, this.tracks.left,  this.config);
    drawTrack(ctx, this.tracks.right, this.config);
    if (this.currentSign) {
      drawStationSign(ctx, this.currentSign.name, this.currentSign.lineColor, {
        y: this.currentSign.signY,
      });
    }
  },

  /**
   * Devuelve las hitboxes en coordenadas de pantalla de todos los trenes
   * actualmente visibles. Replica exactamente los cálculos de drawTrack()
   * para que la caja coincida con el sprite renderizado.
   * @returns {{ x, y, w, h }[]}
   */
  getTrainHitboxes() {
    // Leer parámetros de colisión del preset activo
    const _f      = PM.getActive()?.fisica ?? {};
    const margin  = _f.trainHitboxMargin ?? 0;       // >0 encoge, <0 expande
    const vertPos = _f.trainVerticalPos  ?? TRAIN_CFG.verticalPos;
    const yShift  = (vertPos - 0.5) * canvas.height;

    const boxes  = [];

    for (const track of [this.tracks.left, this.tracks.right]) {
      for (const train of track) {
        // Solo trenes que ya se renderizan (mismo rango que drawTrack)
        if (train.z < -50 || train.z > 900) continue;

        const s         = _perspective(train.z);
        const sx        = _w2sx(train.x * s);
        const sy        = _w2sy(train.y * s) + yShift;
        const drawScale = s * TRAIN_CFG.scaleMultiplier;

        // Dimensiones reales del sprite en pantalla, ajustadas por margen
        const renderW = TRAIN_CFG.baseWidth  * drawScale;
        const renderH = TRAIN_CFG.baseHeight * drawScale;
        const hw = renderW * (0.5 - margin);
        const hh = renderH * (0.5 - margin);

        boxes.push({ x: sx - hw, y: sy - hh, w: hw * 2, h: hh * 2 });
      }
    }

    return boxes;
  },
};
