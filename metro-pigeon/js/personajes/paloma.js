// Paloma urbana — vista de espaldas, físíca con easing y sprite 32×32 (4 frames de aleteo)

import { pigeon, STATE, canvas } from '../mecanica/estado.js';
import { keys } from '../mecanica/input.js';
import { w2sx, w2sy } from '../mecanica/camara.js';

const MAX_VELOCITY = 6;
const EASING       = 0.15;
const SPRITE_SCALE = 3;   // 32px diseño × 3 = 96px en pantalla

// Paleta
const PAL_PALOMA = {
  head:        '#8899AA',
  headLight:   '#9AABBB',
  eye:         '#FFFFFF',
  collarTeal:  '#4488AA',
  collarPurp:  '#AA44AA',
  collarShad1: '#2255AA',
  collarShad2: '#882299',
  body:        '#8899AA',
  belly:       '#DDDDEE',
  bodyShadow:  '#667788',
  wing:        '#556677',
  wingTip:     '#445566',
  tail:        '#445566',
  tailMid:     '#334455',
  tailTip:     '#223344',
  leg:         '#E8AA88',
  foot:        '#D09977',
};

// Ciclo de aleteo: 4 frames visuales, 6 pasos de ciclo, avanza cada 7 frames de juego.
// Frames: 0=nivel  1=arriba  2=medio-arriba  3=abajo
const WING_CYCLE = [0, 1, 2, 0, 3, 2];
let _wingCyclePos = 0;

export function updatePigeon(dt) {
  // Teclas → velocidad objetivo
  let targetVx = 0, targetVy = 0;
  if (keys['ArrowLeft']  || keys['a']) targetVx -= MAX_VELOCITY;
  if (keys['ArrowRight'] || keys['d']) targetVx += MAX_VELOCITY;
  if (keys['ArrowUp']    || keys['w']) targetVy -= MAX_VELOCITY;
  if (keys['ArrowDown']  || keys['s']) targetVy += MAX_VELOCITY;

  // Lerp hacia la velocidad objetivo
  pigeon.vx += (targetVx - pigeon.vx) * EASING;
  pigeon.vy += (targetVy - pigeon.vy) * EASING;

  // Aplicar velocidad escalada por dt
  pigeon.x += pigeon.vx * dt;
  pigeon.y += pigeon.vy * dt;

  // Clampear a la zona central del canvas
  const maxX = canvas.width  * 0.28;
  const maxY = canvas.height * 0.28;
  pigeon.x = Math.max(-maxX, Math.min(maxX, pigeon.x));
  pigeon.y = Math.max(-maxY, Math.min(maxY, pigeon.y));

  // Inclinación visual
  pigeon.tilt = Math.max(-1, Math.min(1, pigeon.vx / MAX_VELOCITY));

  // Ciclo de alas: avanzar cada 7 frames
  if (STATE.frame % 7 === 0) {
    _wingCyclePos = (_wingCyclePos + 1) % WING_CYCLE.length;
    pigeon.wingFrame = WING_CYCLE[_wingCyclePos];
  }

  if (pigeon.invincible > 0) pigeon.invincible--;
}

export function drawPigeon(ctx) {
  // Parpadeo durante invulnerabilidad
  if (pigeon.invincible > 0 && STATE.frame % 2 === 0) return;

  const sx = w2sx(pigeon.x);
  const sy = w2sy(pigeon.y);

  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(pigeon.tilt * 0.3);
  ctx.scale(SPRITE_SCALE, SPRITE_SCALE);
  _drawPalomaSprite(ctx, 0, 0, pigeon.wingFrame);
  ctx.restore();
}

/**
 * Dibuja el sprite 32×32 de la paloma centrado en (cx, cy).
 * Se puede llamar con escala 1 (el contexto ya está escalado desde fuera)
 * o con escala diferente para previews.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} cx  X centro del sprite en el espacio actual
 * @param {number} cy  Y centro del sprite en el espacio actual
 * @param {number} wingFrame  0-3
 */
export function _drawPalomaSprite(ctx, cx, cy, wingFrame = 0) {
  const ox = cx - 16;  // esquina superior-izquierda del box 32×32
  const oy = cy - 16;
  const p  = (x, y, w, h, col) => {
    ctx.fillStyle = col;
    ctx.fillRect(ox + x, oy + y, w, h);
  };

  // ── Cabeza ─────────────────────────────────────────────────────────────────
  p(12,  0,  8, 7, PAL_PALOMA.head);
  p(14,  0,  4, 2, PAL_PALOMA.headLight);
  p(19,  2,  2, 2, PAL_PALOMA.eye);

  // ── Collar iridiscente ─────────────────────────────────────────────────────
  p(10,  7,  5, 2, PAL_PALOMA.collarTeal);
  p(15,  7,  5, 2, PAL_PALOMA.collarPurp);
  p(10,  8,  5, 1, PAL_PALOMA.collarShad1);
  p(15,  8,  5, 1, PAL_PALOMA.collarShad2);

  // ── Cuerpo ─────────────────────────────────────────────────────────────────
  p( 8,  9, 16, 14, PAL_PALOMA.body);
  p(10, 10, 12, 10, PAL_PALOMA.belly);
  p( 8,  9,  2,  6, PAL_PALOMA.bodyShadow);  // sombra izq
  p(22,  9,  2,  6, PAL_PALOMA.bodyShadow);  // sombra der

  // ── Alas (4 frames) ────────────────────────────────────────────────────────
  let wingY, tipY;
  switch (wingFrame) {
    case 1:  wingY = 4;  tipY = 3;  break;  // arriba
    case 2:  wingY = 7;  tipY = 6;  break;  // medio-arriba
    case 3:  wingY = 14; tipY = 17; break;  // abajo
    default: wingY = 10; tipY = 13; break;  // nivel (0)
  }
  p( 0, wingY,  8, 4, PAL_PALOMA.wing);    // ala izq cuerpo
  p(24, wingY,  8, 4, PAL_PALOMA.wing);    // ala der cuerpo
  p( 0, tipY,   8, 2, PAL_PALOMA.wingTip); // punta izq
  p(24, tipY,   8, 2, PAL_PALOMA.wingTip); // punta der

  // ── Cola ───────────────────────────────────────────────────────────────────
  p(12, 23,  8, 4, PAL_PALOMA.tail);
  p(11, 26, 10, 2, PAL_PALOMA.tailMid);
  p(10, 27, 12, 1, PAL_PALOMA.tailTip);

  // ── Patas ──────────────────────────────────────────────────────────────────
  p(11, 22,  2, 3, PAL_PALOMA.leg);   // pierna izq
  p(19, 22,  2, 3, PAL_PALOMA.leg);   // pierna der
  p( 9, 24,  4, 1, PAL_PALOMA.foot);  // pie izq
  p(19, 24,  4, 1, PAL_PALOMA.foot);  // pie der
}
