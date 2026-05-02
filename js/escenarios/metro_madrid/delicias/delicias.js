// metro_madrid/delicias/delicias.js
// "Punto de entrada" de la parada Delicias dentro de la Línea 3.
// Re-exporta los configs de andén y túnel para que linea_3.js los componga
// en su array ROUTE de forma uniforme. Esta indirección permite añadir
// futuros campos (intro, eventos, mensajes, etc.) sin romper el patrón.

import { DELICIAS_ESTACION_CONFIG } from './delicias_estacion.js';
import { DELICIAS_TUNEL_CONFIG }    from './delicias_tunel.js';

export const Delicias = {
  // Identidad
  name:         'Delicias',
  shortName:    'Deli.',
  zone:         'A',
  isCheckpoint: false,
  isTutorial:   true,

  // Configs para EstacionBase / TunelBase
  stationConfig: DELICIAS_ESTACION_CONFIG,
  tunelConfig:   DELICIAS_TUNEL_CONFIG,
};

// Re-exportar también los configs sueltos por si alguien quiere componer.
export { DELICIAS_ESTACION_CONFIG, DELICIAS_TUNEL_CONFIG };
