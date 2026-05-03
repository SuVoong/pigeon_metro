// metro_madrid/delicias/delicias_estacion.js
// Variante visual del andén de Delicias para EstacionBase (nuevo schema:
// composición central back-view con 2 andenes simétricos y 4 carriles).
//
// Sólo sobreescribe lo que diferencia esta parada del DEFAULT_CONFIG.

export const DELICIAS_ESTACION_CONFIG = {
  // ── Identidad ─────────────────────────────────────────────────────────────
  stationName:      'Delicias',
  stationDirection: 'MONCLOA',
  lineNumber:       3,
  lineColor:        '#F39200',

  // ── Pasajeros (estación con poca afluencia → modo tutorial) ───────────────
  numPassengersLeft:  2,
  numPassengersRight: 1,

  // ── Spawn de tren (sólo por la izquierda en modo tutorial) ────────────────
  trainOnLeft:           true,
  trainOnRight:          false,
  trainArrivalDelaySec:  1.5,

  // ── Duración corta (modo tutorial) ────────────────────────────────────────
  durationSeconds: 6,

  // ── Tutorial: aparece sólo la primera vez ─────────────────────────────────
  tutorialMessage: 'Bienvenido · Esquiva los trenes en el túnel',
};
