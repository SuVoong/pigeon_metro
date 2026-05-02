// metro_madrid/linea_3.js
// Línea 3 (naranja) — secuencia completa de paradas envuelta sobre MetroBase.
//
// El array ROUTE define la sucesión estación → túnel → estación → túnel …
// Cada parada importa su carpeta dedicada (delicias/, palos_frontera/, …)
// donde viven los configs visuales/de gameplay específicos. Las paradas que
// aún no tienen carpeta usan un “stub” genérico construido por _genericStop().

import { MetroBase }    from '../metro_base/metro_base.js';
import { Delicias }     from './delicias/delicias.js';
import { STATE }        from '../../mecanica/estado.js';
import { MADRID_LINES } from '../metros/metros_madrid/datos_madrid.js';
import {
  getStationOverride, getTunelOverride,
}                       from '../escena_overrides.js';

// ── Stub genérico (paradas pendientes de personalización) ───────────────────
// Para cada estación cuya carpeta dedicada todavía no existe, generamos un
// objeto RouteStop con configs por defecto + dificultad creciente según
// la posición en la línea (idx).
function _genericStop(name, idx, total) {
  // Dificultad creciente: trenes más juntos y túneles más rápidos al sur.
  const t = total > 1 ? idx / (total - 1) : 0; // 0 → 1
  const trainSpawn   = Math.round(110 - t * 50);   // 110 → 60
  const obsSpawn     = Math.round(130 - t * 60);   // 130 → 70
  const speed        = 1.6 + t * 1.4;              // 1.6 → 3.0
  const tunelDur     = Math.max(12, Math.round(18 - t * 4)); // 18 → 14
  const stationDur   = 5;
  // Más pasajeros conforme nos acercamos al centro (Sol/Callao)
  const passengers   = 1 + Math.round(Math.sin(t * Math.PI) * 3);
  // Alterna trenes L/R para que cada parada se sienta distinta
  const trainOnLeft  = (idx % 2) === 0;
  const trainOnRight = (idx % 3) === 0;

  return {
    name,
    shortName:    name.length > 8 ? name.slice(0, 6) + '…' : name,
    zone:         'A',
    isCheckpoint: false,
    stationConfig: {
      stationName:        name,
      stationDirection:   'MONCLOA',
      lineNumber:         3,
      lineColor:          '#F39200',
      numPassengersLeft:  passengers,
      numPassengersRight: Math.max(1, passengers - 1),
      trainOnLeft,
      trainOnRight,
      durationSeconds:    stationDur,
    },
    tunelConfig: {
      durationSeconds:       tunelDur,
      trainSpawnInterval:    trainSpawn,
      obstacleSpawnInterval: obsSpawn,
      obstacleTypes:         ['pipe'],
      trainLineVariant:      'linea_3',
      speed,
    },
  };
}

// ── Lista de paradas reales de la Línea 3 (El Casar → Moncloa, 20 estaciones)
// Se DERIVA de MADRID_LINES (fuente de verdad del mapa) para que el índice
// que envía arcade.js mediante STATE.selectedStartStationIndex coincida
// exactamente con la posición en este ROUTE.
const _l3data = MADRID_LINES.find(l => l.id === 3);
const STATION_NAMES = _l3data ? _l3data.stations.map(s => s.name) : [];

// ── ROUTE: para cada estación, usa su carpeta si existe, si no _genericStop ─
const SPECIFIC = {
  'Delicias': Delicias,
  // 'Palos de la Frontera': Palos,    ← futuro
  // 'Embajadores': Embajadores,        ← futuro
  // ...
};

const ROUTE = STATION_NAMES.map((name, i) =>
  SPECIFIC[name] ?? _genericStop(name, i, STATION_NAMES.length)
);

// ── Estación por defecto cuando se entra a L3 sin selección concreta ────────
const DEFAULT_START_STATION = 'Delicias';

// ─────────────────────────────────────────────────────────────────────────────
// Clase Linea3 — fina envoltura sobre MetroBase con la lógica de selección
// de estación de inicio (consume STATE.selectedStartStationIndex) y expone
// la API que el resto del juego ya conoce: init / update / render /
// getTrainHitboxes.
// ─────────────────────────────────────────────────────────────────────────────
class Linea3Class {
  constructor() {
    this.lineColor = '#F39200';
    this.metro     = new MetroBase(this._buildRoute(), { lineColor: this.lineColor });
  }

  /**
   * Construye una copia del ROUTE base con los overrides del editor de
   * escenarios mergeados sobre cada parada. Se llama en cada init() para
   * recoger cambios sin reiniciar la página.
   */
  _buildRoute() {
    return ROUTE.map(stop => {
      const sOver = getStationOverride(stop.name);
      const tOver = getTunelOverride(stop.name);
      const hasS  = sOver && Object.keys(sOver).length > 0;
      const hasT  = tOver && Object.keys(tOver).length > 0;
      if (!hasS && !hasT) return stop;
      return {
        ...stop,
        stationConfig: { ...stop.stationConfig, ...sOver },
        tunelConfig:   { ...stop.tunelConfig,   ...tOver },
      };
    });
  }

  init() {
    const fullRoute = this._buildRoute();

    // Punto de inicio: STATE.selectedStartStationIndex tiene preferencia,
    // si no usamos DEFAULT_START_STATION (Delicias).
    let startIdx = fullRoute.findIndex(s => s.name === DEFAULT_START_STATION);
    if (startIdx < 0) startIdx = 0;

    if (STATE.selectedStartStationIndex != null) {
      const requested = STATE.selectedStartStationIndex;
      if (requested >= 0 && requested < fullRoute.length) {
        startIdx = requested;
      }
      STATE.selectedStartStationIndex = null; // consumir el valor
    }

    // Dirección: 'north' (↑ índices) o 'south' (↓ índices).
    // En estaciones terminales se fuerza la única dirección posible.
    let direction = STATE.selectedDirection ?? 'north';
    if (startIdx === 0)                     direction = 'north';
    else if (startIdx === fullRoute.length - 1) direction = 'south';
    STATE.selectedDirection = null; // consumir

    // Construir el slice de la ruta según la dirección elegida.
    // Para cada parada de ese slice ajustamos stationDirection al nombre
    // del terminal de destino (lo que aparece en la pantalla LED y carteles).
    const northTerminal = fullRoute[fullRoute.length - 1].name;
    const southTerminal = fullRoute[0].name;
    const destinationName = direction === 'north' ? northTerminal : southTerminal;

    let slice;
    if (direction === 'south') {
      slice = fullRoute.slice(0, startIdx + 1).reverse();
    } else {
      slice = fullRoute.slice(startIdx);
    }

    // Inyectar stationDirection (el sentido del trayecto) en cada parada.
    slice = slice.map(stop => ({
      ...stop,
      stationConfig: {
        ...stop.stationConfig,
        stationDirection: destinationName.toUpperCase(),
      },
    }));

    // Aplicar a la instancia de MetroBase
    this.metro.route      = slice;
    this.metro.currentIdx = 0;
    this.metro.sceneType  = 'station';
    this.metro._finished  = false;
    this._direction       = direction;
    this._lastEndStation  = slice[slice.length - 1]?.name ?? null;
    this._lastEndIndex    = direction === 'north'
      ? fullRoute.length - 1
      : 0;
    this.metro._loadScene();
  }

  /**
   * Devuelve el índice de la última estación recorrida en la línea completa.
   * Útil para "dar la vuelta": el siguiente trayecto arranca aquí.
   */
  getLastIndex()    { return this._lastEndIndex ?? null; }
  getDirection()    { return this._direction ?? 'north'; }
  getOppositeDir()  { return this._direction === 'south' ? 'north' : 'south'; }

  reset()              { this.metro.reset(); }
  update(dt)           { this.metro.update(dt); }
  render(ctx)          { this.metro.render(ctx); }
  getTrainHitboxes()   { return this.metro.getTrainHitboxes(); }
  get isFinished()     { return this.metro.isFinished; }
  get progress()       { return this.metro.progress; }
  get currentStation() { return this.metro.currentStop?.name ?? ''; }
}

// Singleton (la API previa también era un objeto único)
export const Linea3 = new Linea3Class();

// Export default por si futuras líneas quieren usar la clase como template.
export { Linea3Class };
