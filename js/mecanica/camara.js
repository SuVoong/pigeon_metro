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
 *  produce el efecto de "rotar la cámara". 0.85 da un efecto fuerte donde,
 *  al máximo offsetY, el VP atraviesa la línea del horizonte y la paloma
 *  parece tocar el techo (arriba) o los rieles (abajo). */
export const VP_PERSPECTIVE_FACTOR = 0.85;

/** Devuelve el punto de fuga vertical AJUSTADO según el offsetY de la cámara.
 *  Cuando la cámara/paloma SUBE (offsetY < 0), el VP también sube en pantalla
 *  — al estar en altura, el horizonte se queda al nivel de los nuevos ojos
 *  de la paloma. Vemos más suelo bajo el VP.
 *  Cuando BAJA (offsetY > 0), el VP baja y vemos más techo encima del VP. */
export function getCameraVpY(staticVpY) {
  return staticVpY + camera.offsetY * VP_PERSPECTIVE_FACTOR;
}

/** Desplazamiento VISUAL de la paloma en pantalla en función del offset de
 *  cámara. La curva NO es lineal: la paloma se queda casi quieta al centro
 *  cuando el offset es pequeño y se acerca al borde sólo cuando el offset
 *  llega al máximo. Curva cúbica:
 *
 *     n = offsetY / maxY     ∈ [-1, 1]
 *     dy = sign(n) · |n|^3 · maxY
 *
 *  Resultado: para offsetY = 50 % del máximo, sólo se desplaza un 12.5 %.
 *  Sólo en el extremo (100 % offset) la paloma "toca" el techo / los rieles.
 *  X queda fija porque applyCamera ya aplica translate X al escenario.
 */
export function getPigeonScreenOffset() {
  const maxY = canvas.height * CAMERA_RANGE_Y;
  const ny   = maxY > 0 ? camera.offsetY / maxY : 0;
  const dy   = Math.sign(ny) * Math.pow(Math.abs(ny), 3) * maxY;
  return { dx: 0, dy };
}

/** Reset al iniciar nueva partida. */
export function resetCamera() {
  camera.offsetX = 0;
  camera.offsetY = 0;
}

// Rango máximo del offset de cámara — DEBE coincidir con el clamp aplicado en
// los updates de personaje (paloma/pidgey/angry_bird). Centralizado aquí para
// que los escenarios sepan cuánto overdraw necesitan.
//   X: ±35% — al moverse al borde lateral, la paloma "choca" con la pared
//   Y: ±45% — al subir hasta el máximo la paloma casi roza el techo, al
//             bajar casi toca los rieles
export const CAMERA_RANGE_X = 0.35;
export const CAMERA_RANGE_Y = 0.45;

// Desplazamiento vertical de la paloma respecto a w2sy(0) = canvas/2.
// Sube a +0.18*H → la paloma reposa al ~68 % del canvas (más cerca de los
// rieles y de la altura real del tren). Aplica tanto al render visual como
// a la hitbox para que la colisión coincida con lo que se ve.
export const PIGEON_VERTICAL_OFFSET_RATIO = 0.18;
export function getPigeonVerticalOffset() {
  return canvas.height * PIGEON_VERTICAL_OFFSET_RATIO;
}

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
