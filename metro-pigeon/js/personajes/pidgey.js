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
  // Decrementar contadores
  if (pigeon.stunned > 0)    pigeon.stunned--;
  if (pigeon.invincible > 0) pigeon.invincible--;

  // ── BLOQUEAR INPUT mientras está aturdido ──
  if (pigeon.stunned > 0) {
    pigeon.vx *= 0.85;
    pigeon.vy *= 0.85;
    pigeon.x  += pigeon.vx * dt;
    pigeon.y  += pigeon.vy * dt;

    const maxX = canvas.width  * 0.28;
    const maxY = canvas.height * 0.28;
    pigeon.x = Math.max(-maxX, Math.min(maxX, pigeon.x));
    pigeon.y = Math.max(-maxY, Math.min(maxY, pigeon.y));

    pigeon.stunStars.forEach(s => {
      s.angle += 0.18 * dt;
    });

    if (pigeon.stunned === 0) {
      pigeon.stunStars = [];
    }

    return;
  }

  // ── Movimiento normal ──
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
}

export function drawPidgey(ctx) {
  const sx = w2sx(pigeon.x);
  const sy = w2sy(pigeon.y);

  // ── PARPADEO durante invencibilidad (después del stun) ──
  if (pigeon.invincible > 0 && pigeon.stunned === 0) {
    if (Math.floor(STATE.frame / 4) % 2 === 0) {
      if (pigeon.stunStars.length > 0) {
        _drawStunStars(ctx, sx, sy);
      }
      return;
    }
  }

  ctx.save();
  ctx.translate(sx, sy);

  if (pigeon.stunned > 0) {
    const shake = (Math.random() - 0.5) * 2;
    ctx.translate(shake, shake * 0.5);
    ctx.rotate(Math.sin(STATE.frame * 0.4) * 0.15);
  } else {
    ctx.rotate(pigeon.tilt * 0.3);
  }

  ctx.scale(SPRITE_SCALE, SPRITE_SCALE);

  if (pigeon.stunned > 0) {
    _drawPidgeySprite(ctx, 0, 0, 0, true);  // true = stunned
  } else {
    _drawPidgeySprite(ctx, 0, 0, pigeon.wingFrame, false);
  }

  ctx.restore();

  if (pigeon.stunned > 0 || pigeon.stunStars.length > 0) {
    _drawStunStars(ctx, sx, sy);
  }
}

/**
 * Dibuja el sprite 32×32 de Pidgey centrado en (cx, cy).
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} cx  X centro
 * @param {number} cy  Y centro
 * @param {number} wingFrame  0-3
 * @param {boolean} isStunned  true para dibujar con ojos en X y alas caídas
 */
export function _drawPidgeySprite(ctx, cx, cy, wingFrame = 0, isStunned = false) {
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

  // ── Ojos (normal o aturdido) ────────────────────────────────────────────────
  if (isStunned) {
    _drawXEye(ctx, ox + 13, oy + 3);   // ojo en X
  } else {
    p(13,  3,  6, 3, PAL_PIDGEY.headLight);   // highlight sup (ojo normal)
  }

  // ── Cuerpo ─────────────────────────────────────────────────────────────────
  p( 8, 11, 16, 12, PAL_PIDGEY.body);
  p(10, 12, 12,  9, PAL_PIDGEY.belly);
  p( 8, 11,  2,  8, PAL_PIDGEY.bodyShadow); // sombra izq
  p(22, 11,  2,  8, PAL_PIDGEY.bodyShadow); // sombra der

  // ── Alas (4 frames o caídas si aturdido) ───────────────────────────────────
  let wingY, tipY;
  if (isStunned) {
    wingY = 17;
    tipY  = 20;
  } else {
    switch (wingFrame) {
      case 1:  wingY =  5; tipY =  4; break;  // arriba
      case 2:  wingY =  8; tipY =  7; break;  // medio-arriba
      case 3:  wingY = 17; tipY = 20; break;  // abajo
      default: wingY = 12; tipY = 16; break;  // nivel (0)
    }
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

/** Dibuja un ojo en forma de X (3×3 píxeles) */
function _drawXEye(ctx, x, y) {
  ctx.fillStyle = '#222';
  ctx.fillRect(x,     y,     1, 1);
  ctx.fillRect(x + 2, y,     1, 1);
  ctx.fillRect(x + 1, y + 1, 1, 1);
  ctx.fillRect(x,     y + 2, 1, 1);
  ctx.fillRect(x + 2, y + 2, 1, 1);
}

/** Dibuja 4 estrellitas orbitando */
function _drawStunStars(ctx, cx, cy) {
  pigeon.stunStars.forEach(star => {
    const sx = cx + Math.cos(star.angle) * star.radius;
    const sy = cy - 18 + Math.sin(star.angle) * (star.radius * 0.5);
    _drawPixelStar(ctx, sx, sy, star.color);
  });
}

/** Dibuja una estrella de 5 píxeles */
function _drawPixelStar(ctx, x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x - 1, y - 3, 2, 2);
  ctx.fillRect(x - 3, y - 1, 6, 2);
  ctx.fillRect(x - 1, y + 1, 2, 2);

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(x - 1, y - 1, 2, 2);
}
