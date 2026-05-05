// metro_madrid/delicias/delicias_tunel.js
// Variante visual y de gameplay del TÚNEL que sale de Delicias hacia
// Palos de la Frontera. Es un override del DEFAULT_CONFIG de TunelBase.
//
// Modo TUTORIAL: trenes muy espaciados, obstáculos sólo de tipo "pipe",
// sección corta para no agotar al jugador antes de la siguiente parada.

export const DELICIAS_TUNEL_CONFIG = {
  // ── Visual (más oscuro al principio para sensación de “primer túnel”) ────
  bgColor:        '#060610',
  lightColor:     '#ffeebb',

  // ── Gameplay ──────────────────────────────────────────────────────────────
  durationSeconds:       18,
  trainSpawnInterval:    110,    // muy espaciados (modo tutorial)
  obstacleSpawnInterval: 130,    // obstáculos esporádicos
  obstacleTypes:         [],
  trainLineVariant:      'linea_3',
  speed:                 1.6,    // un poco más lento que el resto de tramos
};
