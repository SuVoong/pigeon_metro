// metro_madrid/linea_3/linea_3.js
// Línea 3 (naranja) — secuencia completa de paradas envuelta sobre MetroBase.
//
// Cada parada tiene su carpeta hermana (./<slug>/<slug>.js) que exporta su
// IDENTIDAD (name/shortName/zone/isCheckpoint) y, opcionalmente, configs de
// andén/túnel (stationConfig/tunelConfig). Los stubs sin configs heredan los
// valores procedurales de _genericStop() — rampa de dificultad creciente
// según la posición en la línea.
//
// Para personalizar una estación: añadir stationConfig/tunelConfig al stub
// (o splittearlo en <slug>_estacion.js / <slug>_tunel.js, ver delicias).

import { MetroBase }    from '../../metro_base/metro_base.js';
import { STATE }        from '../../../mecanica/estado.js';
import { MADRID_LINES } from '../datos_madrid.js';
import {
  getStationOverride, getTunelOverride,
}                       from '../../escena_overrides.js';

// ── Imports de cada parada (orden = sur → norte de la línea real) ───────────
import { ElCasar }            from './el_casar/el_casar.js';
import { VillaverdeAlto }     from './villaverde_alto/villaverde_alto.js';
import { SanCristobal }       from './san_cristobal/san_cristobal.js';
import { VillaverdeBajo }     from './villaverde_bajo/villaverde_bajo.js';
import { CiudadDeLosAngeles } from './ciudad_de_los_angeles/ciudad_de_los_angeles.js';
import { SanFermin }          from './san_fermin/san_fermin.js';
import { Hospital12Octubre }  from './hospital_12_octubre/hospital_12_octubre.js';
import { Almendrales }        from './almendrales/almendrales.js';
import { Legazpi }            from './legazpi/legazpi.js';
import { Delicias }           from './delicias/delicias.js';
import { PalosDeLaFrontera }  from './palos_de_la_frontera/palos_de_la_frontera.js';
import { Embajadores }        from './embajadores/embajadores.js';
import { Lavapies }           from './lavapies/lavapies.js';
import { TirsoDeMolina }      from './tirso_de_molina/tirso_de_molina.js';
import { Sol }                from './sol/sol.js';
import { Callao }             from './callao/callao.js';
import { PlazaDeEspana }      from './plaza_de_espana/plaza_de_espana.js';
import { VenturaRodriguez }   from './ventura_rodriguez/ventura_rodriguez.js';
import { Arguelles }          from './arguelles/arguelles.js';
import { Moncloa }            from './moncloa/moncloa.js';

// Cada entrada se referencia POR NOMBRE (la fuente de verdad del orden y la
// existencia de cada parada es MADRID_LINES; este map sólo aporta los stubs).
const STATIONS = {
  'El Casar':               ElCasar,
  'Villaverde Alto':        VillaverdeAlto,
  'San Cristóbal':          SanCristobal,
  'Villaverde Bajo':        VillaverdeBajo,
  'Ciudad de los Ángeles':  CiudadDeLosAngeles,
  'San Fermín':             SanFermin,
  'Hospital 12 de Octubre': Hospital12Octubre,
  'Almendrales':            Almendrales,
  'Legazpi':                Legazpi,
  'Delicias':               Delicias,
  'Palos de la Frontera':   PalosDeLaFrontera,
  'Embajadores':            Embajadores,
  'Lavapiés':               Lavapies,
  'Tirso de Molina':        TirsoDeMolina,
  'Sol':                    Sol,
  'Callao':                 Callao,
  'Plaza de España':        PlazaDeEspana,
  'Ventura Rodríguez':      VenturaRodriguez,
  'Argüelles':              Arguelles,
  'Moncloa':                Moncloa,
};

// ── Configs procedurales (rampa de dificultad sur → norte) ──────────────────
// Para cada estación generamos stationConfig/tunelConfig por defecto basados
// en su posición en la línea. Los stubs pueden overridear cualquier campo
// añadiendo `stationConfig` / `tunelConfig` a su export.
function _genericStop(name, idx, total) {
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

// ── ROUTE: combina identidad declarativa + configs procedurales ─────────────
// Si el stub trae stationConfig/tunelConfig propios, se mergean ENCIMA de los
// procedurales (ganan los del stub). Permite que una estación personalice
// cualquier campo sin perder el resto del default ni la rampa de dificultad.
const ROUTE = STATION_NAMES.map((name, i) => {
  const stub    = STATIONS[name] ?? { name, shortName: name, zone: 'A' };
  const generic = _genericStop(name, i, STATION_NAMES.length);
  return {
    name:         stub.name ?? name,
    shortName:    stub.shortName ?? name,
    zone:         stub.zone ?? 'A',
    isCheckpoint: stub.isCheckpoint ?? false,
    isTutorial:   stub.isTutorial ?? false,
    stationConfig: { ...generic.stationConfig, ...(stub.stationConfig ?? {}) },
    tunelConfig:   { ...generic.tunelConfig,   ...(stub.tunelConfig   ?? {}) },
  };
});

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

    // Inyectar stationDirection (sentido del trayecto del jugador) y los
    // dos terminales de la línea para los carteles colgantes:
    //   andén derecho (Andén 1) → terminal NORTE = MONCLOA
    //   andén izquierdo (Andén 2) → terminal SUR = EL CASAR
    slice = slice.map(stop => ({
      ...stop,
      stationConfig: {
        ...stop.stationConfig,
        stationDirection:      destinationName.toUpperCase(),
        andenRightDestination: northTerminal.toUpperCase(),
        andenLeftDestination:  southTerminal.toUpperCase(),
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
