// Motor reutilizable de túnel de metro: dos vías paralelas, spawn de
// trenes, scroll Z, rótulo de estación. Cada línea concreta lo configura.

import { STATE } from '../../../mecanica/estado.js';
import { drawTunnel, drawTrack, drawStationSign, setLEDStation } from './metro_base_render.js';

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
    drawTunnel(ctx, this.config);
    drawTrack(ctx, this.tracks.left,  this.config);
    drawTrack(ctx, this.tracks.right, this.config);
    if (this.currentSign) {
      drawStationSign(ctx, this.currentSign.name, this.currentSign.lineColor, {
        y: this.currentSign.signY,
      });
    }
  },
};
