// Pidgey (Pokémon #016) — vista de espaldas, misma física que Paloma, sprite 32×32

import { pigeon, STATE, canvas } from '../mecanica/estado.js';
import { keys } from '../mecanica/input.js';
import { w2sx, w2sy } from '../mecanica/camara.js';

const MAX_VELOCITY = 6;
const EASING       = 0.15;
const SPRITE_SCALE = 3;

// Paleta
const PAL_PIDGEY = {
  crest:      '#885522',
  crestLight: '#C8A040',
  head:       '#C8A040',
  headLight:  '#DDCC88',
  body:       '#C8A040',
  belly:      '#EEEECC',
  bodyShadow: '#885522',
  wing:       '#885522',
  wingTip:    '#DDCC88',
  tailBrown:  '#885522',
  tailCream:  '#DDCC88',
  tailTip:    '#664411',
  leg:        '#FF6633',
  claw:       '#CC4411',
};

// Mismo ciclo de aleteo que Paloma: 4 frames, 6 pasos, cada 7 frames
const WING_CYCLE = [0, 1, 2, 0, 3, 2];
let _wingCyclePos = 0;

export function updatePidgey(dt) {
  // Teclas → velocidad objetivo
  let targetVx = 0, targetVy = 0;
  if (keys['ArrowLeft']  || keys['a']) targetVx -= MAX_VELOCITY;
  if (keys['ArrowRight'] || keys['d']) targetVx += MAX_VELOCITY;
  if (keys['ArrowUp']    || keys['w']) targetVy -= MAX_VELOCITY;
  if (keys['ArrowDown']  || keys['s']) targetVy += MAX_VELOCITY;

  pigeon.vx += (targetVx - pigeon.vx) * EASING;
  pigeon.vy += (targetVy - pigeon.vy) * EASING;
  pigeon.x  += pigeon.vx * dt;
  pigeon.y  += pigeon.vy * dt;

  const maxX = canvas.width  * 0.28;
  const maxY = canvas.height * 0.28;
  pigeon.x = Math.max(-maxX, Math.min(maxX, pigeon.x));
  pigeon.y = Math.max(-maxY, Math.min(maxY, pigeon.y));

  pigeon.tilt = Math.max(-1, Math.min(1, pigeon.vx / MAX_VELOCITY));

  if (STATE.frame % 7 === 0) {
    _wingCyclePos = (_wingCyclePos + 1) % WING_CYCLE.length;
    pigeon.wingFrame = WING_CYCLE[_wingCyclePos];
  }

  if (pigeon.invincible > 0) pigeon.invincible--;
}

export function drawPidgey(ctx) {
  if (pigeon.invincible > 0 && STATE.frame % 2 === 0) return;

  const sx = w2sx(pigeon.x);
  const sy = w2sy(pigeon.y);

  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(pigeon.tilt * 0.3);
  ctx.scale(SPRITE_SCALE, SPRITE_SCALE);
  _drawPidgeySprite(ctx, 0, 0, pigeon.wingFrame);
  ctx.restore();
}

/**
 * Dibuja el sprite 32×32 de Pidgey centrado en (cx, cy).
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} cx  X centro
 * @param {number} cy  Y centro
 * @param {number} wingFrame  0-3
 */
export function _drawPidgeySprite(ctx, cx, cy, wingFrame = 0) {
  const ox = cx - 16;
  const oy = cy - 16;
  const p  = (x, y, w, h, col) => {
    ctx.fillStyle = col;
    ctx.fillRect(ox + x, oy + y, w, h);
  };

  // ── Cresta ─────────────────────────────────────────────────────────────────
  p(13,  0,  2, 3, PAL_PIDGEY.crest);       // pluma izq
  p(15,  0,  2, 4, PAL_PIDGEY.crest);       // pluma centro (más alta)
  p(17,  0,  2, 3, PAL_PIDGEY.crest);       // pluma der
  p(14,  1,  4, 1, PAL_PIDGEY.crestLight);  // highlight

  // ── Cabeza ─────────────────────────────────────────────────────────────────
  p(11,  3, 10, 8, PAL_PIDGEY.head);
  p(13,  3,  6, 3, PAL_PIDGEY.headLight);   // highlight sup

  // ── Cuerpo ─────────────────────────────────────────────────────────────────
  p( 8, 11, 16, 12, PAL_PIDGEY.body);
  p(10, 12, 12,  9, PAL_PIDGEY.belly);
  p( 8, 11,  2,  8, PAL_PIDGEY.bodyShadow); // sombra izq
  p(22, 11,  2,  8, PAL_PIDGEY.bodyShadow); // sombra der

  // ── Alas (4 frames) ────────────────────────────────────────────────────────
  let wingY, tipY;
  switch (wingFrame) {
    case 1:  wingY =  5; tipY =  4; break;  // arriba
    case 2:  wingY =  8; tipY =  7; break;  // medio-arriba
    case 3:  wingY = 17; tipY = 20; break;  // abajo
    default: wingY = 12; tipY = 16; break;  // nivel (0)
  }
  p( 0, wingY,  8, 5, PAL_PIDGEY.wing);    // ala izq
  p(24, wingY,  8, 5, PAL_PIDGEY.wing);    // ala der
  p( 0, tipY,   8, 2, PAL_PIDGEY.wingTip); // plumas punta izq
  p(24, tipY,   8, 2, PAL_PIDGEY.wingTip); // plumas punta der

  // ── Cola ───────────────────────────────────────────────────────────────────
  p(12, 23,  8, 3, PAL_PIDGEY.tailBrown);
  p(13, 25,  6, 2, PAL_PIDGEY.tailCream);  // franja crema
  p(12, 26,  8, 1, PAL_PIDGEY.tailBrown);
  p(11, 27, 10, 1, PAL_PIDGEY.tailTip);    // sombra

  // ── Patas y garras ─────────────────────────────────────────────────────────
  p(11, 22,  2, 3, PAL_PIDGEY.leg);   // pierna izq
  p(19, 22,  2, 3, PAL_PIDGEY.leg);   // pierna der
  p( 8, 24,  5, 1, PAL_PIDGEY.leg);   // 3 dedos izq
  p(19, 24,  5, 1, PAL_PIDGEY.leg);   // 3 dedos der
  p( 9, 25,  1, 1, PAL_PIDGEY.claw);  // garra izq ext
  p(11, 25,  1, 1, PAL_PIDGEY.claw);  // garra izq int
  p(19, 25,  1, 1, PAL_PIDGEY.claw);  // garra der int
  p(21, 25,  1, 1, PAL_PIDGEY.claw);  // garra der ext
}
