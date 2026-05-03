// elementos/tren.js
// API agnóstica de línea para dibujar trenes. Delega en las funciones
// existentes de metro_base_render.js (que ya están afinadas, leen del
// preset y manejan pixelData) para no perder fidelidad visual.
//
// La nueva arquitectura (TunelBase / EstacionBase) llama a estas funciones
// pasando la VARIANTE de línea — los colores son parámetros, nunca hard-coded.

import { TREN_CONFIG } from './tren_config.js';
import {
  drawTrainFront,
  drawTrainSide,
  drawTrainPerspective,
  setLEDStation,
} from '../escenarios/metro_base/metro_base_render.js';

// ── Paleta por defecto (override por variante.colors si se desea) ────────────
const DEFAULT_PAL = {
  body:    '#F0F0F0',
  stripe:  '#1A3A8A',
  cab:     '#111111',
  window:  '#1A2E3A',
  ledBg:   '#1A1A00',
  ledText: '#FF6600',
  light:   '#CC1111',
  roof:    '#CCCCCC',
  under:   '#222233',
  wheel:   '#444455',
};

/**
 * Dibuja la cara FRONTAL del tren (vista back-view, viene hacia ti).
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} cx, cy   Centro del sprite en pantalla.
 * @param {number} scale    Factor de perspectiva (0–1+).
 * @param {object} variante Variante de línea: { stripeColor, colors? }.
 * @param {string} [ledText] Texto a mostrar en el LED del tren (sentido,
 *                            destino, etc.). Si se pasa, actualiza el LED
 *                            global de forma idempotente.
 */
export function drawTrenFrontal(ctx, cx, cy, scale, variante = {}, ledText) {
  if (ledText) setLEDStation(ledText);
  const lineColor = variante.stripeColor ?? DEFAULT_PAL.stripe;
  drawTrainFront(ctx, cx, cy, scale, lineColor);
}

/**
 * Dibuja la cara LATERAL (rectángulo). Usada en escenas de estación cuando
 * un tren llega/sale por el costado del andén.
 * @param {object} variante Variante de línea: { stripeColor }.
 */
export function drawTrenLateral(ctx, x, y, w, h, variante = {}) {
  const lineColor = variante.stripeColor ?? DEFAULT_PAL.stripe;
  drawTrainSide(ctx, x, y, w, h, lineColor);
}

/**
 * Dibuja la vista 3/4 (cabina + lateral): se usa cuando el tren está MUY
 * cerca de cámara y la perspectiva queda cortada en seco.
 */
export function drawTrenPerspectiva(ctx, cx, cy, scale, variante = {}) {
  const lineColor = variante.stripeColor ?? DEFAULT_PAL.stripe;
  drawTrainPerspective(ctx, cx, cy, scale, lineColor);
}

/** Cambia el texto del LED del tren (típicamente nombre de estación). */
export function setTrenLED(name) {
  if (name) setLEDStation(name);
}

// Re-export de la paleta para uso externo (testing / fallbacks).
export { DEFAULT_PAL, TREN_CONFIG };
