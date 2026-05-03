// elementos/tren_config.js
// Configuración base del modelo de tren — separada del render para que
// el editor, los presets y el juego lean desde el mismo sitio.
//
// IMPORTANTE: las dimensiones "base" aquí son las del SPRITE LÓGICO
// (espacio de arte 48 × 40). El factor de escala final se aplica vía
// scaleMultiplier (similar al sprite/preset activo).
//
// Las variantes por línea solo definen overrides (color de franja, LED…).
// Cualquier línea futura añade su entrada aquí sin tocar tren.js.

export const TREN_CONFIG = {
  // ── Dimensiones del sprite lógico (espacio de arte) ──────────────────────
  baseWidth:        48,
  baseHeight:       40,

  // ── Factor de escala global (se aplica en perspectiva) ───────────────────
  scaleMultiplier:  2.5,

  // ── Posición vertical del centro del tren (fracción del canvas) ──────────
  // 0.50 = centrado (mismo nivel que la paloma)
  // 0.62 = más bajo (sensación realista de "andar por las vías")
  verticalPos:      0.50,

  // ── Animación LED ────────────────────────────────────────────────────────
  ledScrollSpeed:   0.5,   // píxeles por frame
  animFps:          8,     // frames por ciclo (alas / pantógrafo)

  // ════════════════════════════════════════
  // COMPOSICIÓN — valores por defecto más generosos
  // ════════════════════════════════════════
  numVagones:           8,    // vagones por tren (cabeza + N-1 traseros)
  separacionZ:          55,   // distancia en Z entre vagones consecutivos
  ocultarVagonesScale:  0.08, // escala mínima antes de ocultar un vagón trasero
  headZ:                40,   // Z inicial de la cabeza (cerca del jugador)

  // Límite duro: protege rendimiento si numVagones se sube demasiado
  maxVagonesPorTren:    14,

  // ── Variantes por línea ──────────────────────────────────────────────────
  // Cada línea sobreescribe SÓLO lo que necesite. Los colores que falten
  // se rellenan con la paleta DEFAULT_PAL declarada en tren.js.
  variantes: {
    linea_1: {
      stripeColor:  '#009EE0',   // azul claro L1
      ledStation:   'AUTO',
      numVagones:   8,
      separacionZ:  50,
    },
    linea_2: {
      stripeColor:  '#FF0000',   // rojo L2
      ledStation:   'AUTO',
      numVagones:   6,
      separacionZ:  55,
    },
    linea_3: {
      stripeColor:  '#F39200',   // naranja institucional L3
      ledStation:   'AUTO',
      numVagones:   6,
      separacionZ:  55,
    },
    linea_4: {
      stripeColor:  '#824100',   // marrón L4
      ledStation:   'AUTO',
      numVagones:   6,
      separacionZ:  55,
    },
    linea_5: {
      stripeColor:  '#A4C73C',   // verde claro L5
      ledStation:   'AUTO',
      numVagones:   6,
      separacionZ:  55,
    },
    linea_6: {                   // Circular: tren más largo
      stripeColor:  '#999999',   // gris L6
      ledStation:   'AUTO',
      numVagones:   10,
      separacionZ:  48,
    },
    linea_7: {
      stripeColor:  '#FF8000',   // naranja L7
      ledStation:   'AUTO',
      numVagones:   8,
      separacionZ:  50,
    },
    linea_8: {                   // Aeropuerto: trenes largos
      stripeColor:  '#FF69B4',   // rosa L8
      ledStation:   'AUTO',
      numVagones:   8,
      separacionZ:  50,
    },
    linea_9: {
      stripeColor:  '#9A0F8F',   // morado L9
      ledStation:   'AUTO',
      numVagones:   6,
      separacionZ:  55,
    },
    linea_10: {                  // Línea larga
      stripeColor:  '#005AA7',   // azul oscuro L10
      ledStation:   'AUTO',
      numVagones:   8,
      separacionZ:  50,
    },
    linea_11: {
      stripeColor:  '#008C44',   // verde oscuro L11
      ledStation:   'AUTO',
      numVagones:   6,
      separacionZ:  55,
    },
    linea_12: {                  // MetroSur: el más largo del mapa
      stripeColor:  '#A49A00',   // amarillo verdoso L12
      ledStation:   'AUTO',
      numVagones:   12,
      separacionZ:  42,
    },
  },
};

/** Devuelve la variante de línea (o un objeto vacío si no existe). */
export function getTrenVariante(lineId) {
  if (lineId == null) return {};
  const key = typeof lineId === 'string'
    ? (lineId.startsWith('linea_') ? lineId : `linea_${lineId}`)
    : `linea_${lineId}`;
  return TREN_CONFIG.variantes[key] ?? {};
}
