// Cámara: ajuste del canvas a ventana, conversión mundo→pantalla y perspectiva

import { canvas } from './estado.js';

const FOCAL = 400;  // distancia focal para proyección perspectiva

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
