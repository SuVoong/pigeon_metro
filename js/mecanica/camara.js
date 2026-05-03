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

/** Aplica el desplazamiento de cámara al ctx. Hace ctx.save() implícito. */
export function applyCamera(ctx) {
  ctx.save();
  ctx.translate(-camera.offsetX, -camera.offsetY);
}

/** Restaura el ctx tras applyCamera(). */
export function unapplyCamera(ctx) {
  ctx.restore();
}

/** Reset al iniciar nueva partida. */
export function resetCamera() {
  camera.offsetX = 0;
  camera.offsetY = 0;
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
