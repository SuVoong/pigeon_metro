// Cámara: ajuste del canvas a ventana, conversión mundo→pantalla y perspectiva

import { canvas } from './estado.js';

export const FOCAL = 400;  // distancia focal para proyección perspectiva

// ── Cámara móvil ─────────────────────────────────────────────────────────────
// La paloma ya no se mueve por la pantalla: queda anclada al centro y todo el
// escenario se desplaza alrededor de ella. `camera.offsetX/Y` representan el
// desplazamiento del MUNDO bajo la cámara, en píxeles de pantalla.
//   offsetX > 0 = la paloma "miró" a la derecha → el mundo se traslada a la
//                 izquierda (ctx.translate(-offsetX, ...)).
//
// Los renderizadores del escenario llaman a applyCamera()/unapplyCamera() al
// principio y final de su render para que todo el contenido se transforme.
// El HUD y la paloma quedan FUERA del transform, así se ven anclados.
export const camera = { offsetX: 0, offsetY: 0 };

/** Aplica el desplazamiento HORIZONTAL de cámara al ctx. Hace ctx.save() implícito.
 *  El offset Y NO se aplica como translate — se traduce en un desplazamiento del
 *  punto de fuga vertical (ver getCameraVpY) para simular que la cámara "rota"
 *  hacia arriba/abajo en lugar de simplemente deslizarse. Así los rieles, las
 *  paredes y el techo cambian de inclinación al subir/bajar. */
export function applyCamera(ctx) {
  ctx.save();
  ctx.translate(-camera.offsetX, 0);
}

/** Restaura el ctx tras applyCamera(). */
export function unapplyCamera(ctx) {
  ctx.restore();
}

/** Factor con el que el offsetY mueve el punto de fuga vertical. Más alto =
 *  efecto de perspectiva más exagerado al subir/bajar. 1.0 sería como un
 *  desplazamiento puro (los rieles no cambiarían visualmente); por debajo de 1
 *  produce el efecto de "rotar la cámara". */
export const VP_PERSPECTIVE_FACTOR = 0.7;

/** Devuelve el punto de fuga vertical AJUSTADO según el offsetY de la cámara.
 *  Cuando la cámara sube (offsetY < 0), el VP baja en pantalla — los rieles
 *  apuntan más bajo y vemos más techo (mirando "hacia abajo" desde altura).
 *  Cuando baja (offsetY > 0), el VP sube y vemos más suelo. */
export function getCameraVpY(staticVpY) {
  return staticVpY - camera.offsetY * VP_PERSPECTIVE_FACTOR;
}

/** Reset al iniciar nueva partida. */
export function resetCamera() {
  camera.offsetX = 0;
  camera.offsetY = 0;
}

// Rango máximo del offset de cámara — DEBE coincidir con el clamp aplicado en
// los updates de personaje (paloma/pidgey/angry_bird). Centralizado aquí para
// que los escenarios sepan cuánto overdraw necesitan.
export const CAMERA_RANGE_X = 0.35;   // fracción del ancho del canvas
export const CAMERA_RANGE_Y = 0.25;   // fracción del alto del canvas

/**
 * Área del MUNDO que la cámara puede llegar a ver, en coords del canvas.
 * Devuelve los bordes ampliados con el rango máximo del offset, más un
 * pequeño margen extra para evitar parpadeos en los límites.
 *
 * Los renderizadores del escenario deben dibujar entre `left` y `right`
 * (en lugar de 0..canvas.width) y entre `top` y `bottom` (en lugar de
 * 0..canvas.height) para que no aparezcan huecos cuando la cámara esté
 * en el extremo de su rango.
 */
export function getViewBounds() {
  const W = canvas.width;
  const H = canvas.height;
  const padX = W * CAMERA_RANGE_X + 4;
  const padY = H * CAMERA_RANGE_Y + 4;
  return {
    left:   -padX,
    right:  W + padX,
    top:    -padY,
    bottom: H + padY,
    width:  W + padX * 2,
    height: H + padY * 2,
  };
}

export function initCamera() {
  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();
}

export function w2sx(worldX) {
  return canvas.width / 2 + worldX;
}

export function w2sy(worldY) {
  return canvas.height / 2 + worldY;
}

// Factor de escala según la profundidad: lejos=pequeño, cerca=grande
export function perspective(z) {
  return FOCAL / (FOCAL + z);
}
