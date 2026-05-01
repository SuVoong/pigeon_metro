// Línea 3 — naranja, primera línea desbloqueada del juego.
// Envuelve MetroBase con su configuración de gameplay y la lista de
// estaciones jugables del modo arcade.

import { MADRID_LINES, ZONES }       from '../mapa_metro_madrid.js';
import { MetroBase }                  from '../../metro_base/metro_base.js';
import { STATE }                      from '../../../../mecanica/estado.js';
import { drawEstacionDelicias }       from './estacion_delicias_render.js';

const data = MADRID_LINES.find(l => l.id === 3);

// Estación por defecto al jugar L3 sin selección previa (botonazo del menu,
// ENTER, click en el trazo de la línea, etc.). Es la entrada «clásica» al
// modo arcade y tiene config tutorial; las demás usan config genérica.
const DEFAULT_START_STATION = 'Delicias';

// HUD de progreso — métricas de layout (en píxeles, top-left del banner)
const HUD_TOP        = 36;   // y donde empieza el banner del nombre
const HUD_BANNER_H   = 30;   // altura del banner del nombre (= drawStationSign)
const HUD_GAP        = 6;    // separación entre banner y mapa de ruta
const HUD_ROUTE_H    = 26;   // altura del mapa horizontal de la ruta
const HUD_FOOTER_H   = 18;   // altura de la «próxima estación + %»

export const Linea3 = {
  data,

  // Configuración de gameplay (se pasa a MetroBase.init)
  gameplayConfig: {
    trainColor:     '#F39200',
    trainColorDark: '#C27300',
    bgColor:        '#1a0e00',     // túnel cálido para la línea naranja
    lightColor:     '#ffeebb',
    speed:          2,
    spawnInterval:  90,
    obstacleTypes:    ['trainLeft', 'trainRight', 'pipe'],
    collectibleTypes: ['breadcrumb', 'coin'],
  },

  // Estaciones del modo arcade en orden de progresión.
  // Se deriva directamente de data.stations (El Casar → Moncloa, 20 estaciones)
  // para que CUALQUIER parada seleccionable en el mapa sea un punto de inicio
  // válido. Antes sólo se incluía Delicias→Moncloa: hacía que clicar Villaverde
  // (o cualquier estación al sur de Delicias) cayese al fallback → Delicias.
  arcadeProgression: data ? data.stations.map(s => s.name) : [],

  // Estación activa (índice en arcadeProgression)
  currentStationIndex: 0,
  // Tiempo acumulado en la estación actual (segundos)
  stationElapsed: 0,
  // Estación activa (config de gameplay)
  activeStation: null,
  // Mensaje flotante para transiciones de estación
  toast: null,    // { text, framesLeft }

  getCurrentStationName() {
    return this.arcadeProgression[this.currentStationIndex];
  },

  getNextStation() {
    return this.arcadeProgression[this.currentStationIndex + 1] ?? null;
  },

  /** Índice por defecto en arcadeProgression (Delicias si existe). */
  _getDefaultStartIndex() {
    const i = this.arcadeProgression.indexOf(DEFAULT_START_STATION);
    return i >= 0 ? i : 0;
  },

  /**
   * Construye el descriptor genérico de estación (sin tutorial ni intro).
   * Se usa al avanzar de estación: aunque pasemos por Delicias, sus
   * overrides (slowdown + tutorial) sólo deben aplicarse cuando se
   * arranca explícitamente ahí.
   */
  _buildGenericStation(stationName) {
    return {
      name:              stationName,
      line:              3,
      zone:              'A',
      overrides:         null,
      completionSeconds: 25,
    };
  },

  /** y donde se debe colocar el banner del nombre de estación. */
  _getStationSignY() {
    return HUD_TOP + HUD_ROUTE_H + HUD_GAP;
  },

  /** Aplica modificadores de zona y/o estación a la velocidad de MetroBase. */
  _applyDifficulty() {
    const stationName = this.getCurrentStationName();
    const overrides   = this.activeStation && this.activeStation.name === stationName
      ? this.activeStation.overrides
      : null;

    const zoneKey = (this.activeStation && this.activeStation.zone) || 'A';
    const zone    = ZONES[zoneKey] || ZONES.A;

    const baseSpeed         = this.gameplayConfig.speed;
    const baseSpawnInterval = this.gameplayConfig.spawnInterval;
    // Rampa de dificultad relativa al índice por defecto: si arrancas en
    // Delicias (idx por defecto), stationStep=0; si arrancas en Moncloa,
    // crece progresivamente. Evita penalizar arrancar en estaciones del sur.
    const defaultIdx        = this._getDefaultStartIndex();
    const stationStep       = Math.max(0, this.currentStationIndex - defaultIdx) * 0.18;

    MetroBase.config.speed         = (overrides?.speed         ?? baseSpeed) * zone.speedMult + stationStep;
    MetroBase.config.spawnInterval = overrides?.spawnInterval ?? baseSpawnInterval;
  },

  /**
   * Asigna el sceneRenderer correcto según la estación actual.
   * Delicias usa el andén fotorrealista; el resto usa el túnel genérico.
   */
  _updateSceneRenderer() {
    const name = this.getCurrentStationName() ?? '';
    MetroBase.config.sceneRenderer = name === 'Delicias'
      ? drawEstacionDelicias
      : null;
  },

  /** Avanza a la siguiente estación, sube velocidad, lanza toast. */
  advanceStation() {
    if (this.currentStationIndex >= this.arcadeProgression.length - 1) return;
    this.currentStationIndex++;
    this.stationElapsed = 0;

    // Al avanzar siempre usamos config genérica: el modo tutorial de Delicias
    // sólo se aplica cuando el jugador arranca ahí (no cuando llega volando).
    this.activeStation = this._buildGenericStation(this.getCurrentStationName());

    const sName = this.getCurrentStationName();
    MetroBase.setStationSign(sName, this.data.color, { y: this._getStationSignY() });
    this.toast = { text: `Siguiente estación: ${sName}`, framesLeft: 150 };
    this._applyDifficulty();
    this._updateSceneRenderer();
  },

  init() {
    // Por defecto, Delicias.
    let startIdx = this._getDefaultStartIndex();

    // Si el jugador hizo clic en una estación concreta del mapa,
    // STATE.selectedStartStationIndex lleva el índice de esa estación
    // dentro del array data.stations de la L3. Como ahora arcadeProgression
    // refleja data.stations al pie de la letra, el índice es directo y
    // ninguna estación queda fuera del recorrido.
    if (STATE.selectedStartStationIndex != null && this.data) {
      const requested = STATE.selectedStartStationIndex;
      if (requested >= 0 && requested < this.arcadeProgression.length) {
        startIdx = requested;
      }
      STATE.selectedStartStationIndex = null;   // consumir el valor
    }

    this.currentStationIndex = startIdx;
    this.stationElapsed      = 0;
    this.activeStation       = this._buildGenericStation(this.arcadeProgression[startIdx]);

    MetroBase.init(this.gameplayConfig);
    MetroBase.setStationSign(
      this.getCurrentStationName(),
      this.data.color,
      { y: this._getStationSignY() },
    );
    this.toast = null;
    this._applyDifficulty();
    this._updateSceneRenderer();
  },

  reset() {
    MetroBase.reset();
    const startIdx           = this._getDefaultStartIndex();
    this.currentStationIndex = startIdx;
    this.stationElapsed      = 0;
    this.activeStation       = this._buildGenericStation(this.arcadeProgression[startIdx]);
    this.toast               = null;
    this._updateSceneRenderer();
  },

  update(dt) {
    if (this.toast && --this.toast.framesLeft <= 0) this.toast = null;

    this.stationElapsed += dt / 60;

    // Hito de estación: superar X segundos → onComplete
    const completionSec = this.activeStation?.completionSeconds ?? 25;
    if (this.stationElapsed >= completionSec) {
      if (typeof this.activeStation.onComplete === 'function') {
        this.activeStation.onComplete(this);
      } else {
        this.advanceStation();
      }
    }

    MetroBase.update(dt);
  },

  render(ctx) {
    MetroBase.render(ctx);

    // HUD de progreso del trayecto (mapa horizontal + próxima estación).
    // Se dibuja después del túnel/trenes/cartel para quedar siempre encima.
    this._drawRouteHUD(ctx);

    // Toast flotante (cambio de estación) — se posiciona debajo del HUD
    if (this.toast) {
      const cw = ctx.canvas.width;
      const t  = 1 - (this.toast.framesLeft / 150);
      const alpha = t < 0.2 ? t / 0.2 : (t > 0.8 ? (1 - t) / 0.2 : 1);
      ctx.fillStyle = `rgba(0,0,0,${0.65 * alpha})`;
      ctx.font = 'bold 12px monospace';
      const wTxt = ctx.measureText(this.toast.text).width + 24;
      const tx = cw / 2 - wTxt / 2;
      const ty = HUD_TOP + HUD_ROUTE_H + HUD_GAP + HUD_BANNER_H + HUD_FOOTER_H + 6;
      ctx.fillRect(tx, ty, wTxt, 26);
      ctx.fillStyle = `rgba(243,146,0,${alpha})`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.toast.text, cw / 2, ty + 13);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    }
  },

  /**
   * HUD horizontal con: línea de la ruta, dot por cada estación, marcador
   * de posición actual con pulso, siguiente estación destacada y barra/
   * porcentaje de progreso a la próxima parada.
   */
  _drawRouteHUD(ctx) {
    const cw = ctx.canvas.width;
    const stations = this.arcadeProgression;
    const total = stations.length;
    if (total === 0) return;

    const cur = this.currentStationIndex;
    const isLast = cur >= total - 1;
    const completionSec = this.activeStation?.completionSeconds ?? 25;
    const progress = Math.min(1, Math.max(0, this.stationElapsed / completionSec));

    // ── Layout ──
    const HUD_W = Math.min(640, cw - 40);
    const HUD_X = Math.round((cw - HUD_W) / 2);
    const routeY = HUD_TOP + HUD_ROUTE_H / 2;
    const padX   = 24;
    const x0     = HUD_X + padX;
    const x1     = HUD_X + HUD_W - padX;
    const span   = Math.max(1, x1 - x0);
    const xAt    = (i) => x0 + (i / Math.max(1, total - 1)) * span;

    // Fondo del HUD: cubre mapa de ruta + footer (banner ya lo pinta MetroBase).
    const bgY = HUD_TOP - 4;
    const bgH = HUD_ROUTE_H + HUD_GAP + HUD_BANNER_H + HUD_FOOTER_H + 8;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(HUD_X, bgY, HUD_W, bgH);
    ctx.strokeStyle = 'rgba(255,255,255,0.10)';
    ctx.lineWidth = 1;
    ctx.strokeRect(HUD_X + 0.5, bgY + 0.5, HUD_W - 1, bgH - 1);

    // 1. Línea base (parte por la que ya pasamos + parte por venir)
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x0, routeY);
    ctx.lineTo(x1, routeY);
    ctx.stroke();

    // 2. Tramo recorrido (color de la línea, con barra de progreso al próximo)
    const passedX = isLast ? xAt(cur) : xAt(cur + progress);
    ctx.strokeStyle = this.data.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x0, routeY);
    ctx.lineTo(passedX, routeY);
    ctx.stroke();

    // 3. Dots por estación
    for (let i = 0; i < total; i++) {
      const x = xAt(i);
      const isPassed  = i < cur;
      const isCurrent = i === cur;
      const isNext    = i === cur + 1;

      let r, fill;
      if (isCurrent)      { r = 5; fill = '#ffffff'; }
      else if (isNext)    { r = 4; fill = this.data.color; }
      else if (isPassed)  { r = 3; fill = this.data.color; }
      else                { r = 3; fill = '#555566'; }

      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.arc(x, routeY, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // 4. Marcador de posición actual (halo pulsante)
    {
      const x = xAt(cur);
      const t = (performance.now() % 900) / 900;
      const pulse = 0.5 + 0.5 * Math.sin(t * Math.PI * 2);
      ctx.strokeStyle = this.data.color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, routeY, 7 + pulse * 3, 0, Math.PI * 2);
      ctx.stroke();
      // Triangulito apuntando hacia abajo (al banner del nombre)
      ctx.fillStyle = this.data.color;
      ctx.beginPath();
      ctx.moveTo(x - 4, routeY + 9);
      ctx.lineTo(x + 4, routeY + 9);
      ctx.lineTo(x,     routeY + 13);
      ctx.closePath();
      ctx.fill();
    }

    // 5. Pie del HUD: «próxima estación» + barra/porcentaje
    const footerY = HUD_TOP + HUD_ROUTE_H + HUD_GAP + HUD_BANNER_H;
    const fy      = footerY + HUD_FOOTER_H / 2;

    if (!isLast) {
      const nextName = stations[cur + 1];
      const remainingPct = Math.max(0, Math.min(100, Math.round((1 - progress) * 100)));

      ctx.font = '10px monospace';
      ctx.textBaseline = 'middle';

      // Etiqueta a la izquierda
      ctx.fillStyle = '#aaaacc';
      ctx.textAlign = 'left';
      ctx.fillText(`▶ PRÓX: ${nextName.toUpperCase()}`, HUD_X + 12, fy);

      // Barra de progreso compacta a la derecha + %
      const barW = 90, barH = 6;
      const barX = HUD_X + HUD_W - 12 - barW - 42;   // hueco para el texto del %
      const barY = fy - barH / 2;
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(barX, barY, barW, barH);
      ctx.fillStyle = this.data.color;
      ctx.fillRect(barX, barY, barW * progress, barH);

      ctx.fillStyle = '#dddddd';
      ctx.textAlign = 'right';
      ctx.fillText(`${remainingPct}%`, HUD_X + HUD_W - 12, fy);
    } else {
      ctx.font = 'bold 11px monospace';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#5dcaa5';
      ctx.fillText('🏁 ESTACIÓN FINAL', HUD_X + HUD_W / 2, fy);
    }

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  },
};
