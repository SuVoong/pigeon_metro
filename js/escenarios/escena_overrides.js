// escena_overrides.js
// Almacén de overrides visuales/gameplay por estación, persistidos en
// localStorage. Permite al jugador modificar la apariencia y reglas del
// andén y túnel de cada parada desde el editor de escenarios accesible
// en el modo arcade.
//
// Estructura interna:
//   {
//     [stationName]: {
//       station: { ...overrides para EstacionBase.cfg },
//       tunel:   { ...overrides para TunelBase.cfg }
//     }
//   }
//
// Linea3.init() consulta este store antes de cargar las escenas y mergea
// los overrides sobre los configs base de cada parada del ROUTE.

const LS_KEY = 'pigeon_metro_escena_overrides_v1';

let _cache = null;

function _load() {
  if (_cache) return _cache;
  try {
    const raw = localStorage.getItem(LS_KEY);
    _cache = raw ? JSON.parse(raw) : {};
  } catch (_) {
    _cache = {};
  }
  return _cache;
}

function _save() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(_cache || {}));
  } catch (_) { /* quota / privacy mode → ignorar */ }
}

/** Devuelve el override completo {station, tunel} para una estación, o null. */
export function getOverride(stationName) {
  if (!stationName) return null;
  const all = _load();
  return all[stationName] || null;
}

/** Devuelve sólo el override de andén (objeto, posiblemente vacío). */
export function getStationOverride(stationName) {
  return getOverride(stationName)?.station || {};
}

/** Devuelve sólo el override de túnel (objeto, posiblemente vacío). */
export function getTunelOverride(stationName) {
  return getOverride(stationName)?.tunel || {};
}

/** Guarda los overrides de una estación. Pasa null para resetear. */
export function setOverrides(stationName, stationCfg, tunelCfg) {
  if (!stationName) return;
  const all = _load();
  if (stationCfg == null && tunelCfg == null) {
    delete all[stationName];
  } else {
    all[stationName] = {
      station: stationCfg || {},
      tunel:   tunelCfg   || {},
    };
  }
  _save();
}

/** Borra los overrides de una estación. */
export function resetOverride(stationName) {
  setOverrides(stationName, null, null);
}

/** Borra todos los overrides. */
export function clearAll() {
  _cache = {};
  _save();
}

/** ¿Tiene esta estación overrides personalizados? */
export function hasOverride(stationName) {
  const o = getOverride(stationName);
  if (!o) return false;
  const sKeys = Object.keys(o.station || {}).length;
  const tKeys = Object.keys(o.tunel   || {}).length;
  return sKeys + tKeys > 0;
}
