// Red (Angry Bird) — vista de espaldas, misma física que Paloma/Pidgey, sprite 32×32 (4 frames)

import { pigeon, STATE, canvas } from '../mecanica/estado.js';
import { keys } from '../mecanica/input.js';
import {
  w2sx, w2sy, camera, CAMERA_RANGE_X, CAMERA_RANGE_Y, getPigeonScreenOffset,
} from '../mecanica/camara.js';

const MAX_VELOCITY = 6;
const EASING       = 0.15;
const SPRITE_SCALE = 3;   // 32px × 3 = 96px en pantalla

// Paleta de Red
const PAL_RED = {
  crest:       '#991010',
  crestMid:    '#CC1818',
  crestLight:  '#EE3030',
  body:        '#E02020',
  bodyBright:  '#FF3A3A',
  bodyLight:   '#FF5540',
  bodyDark:    '#B80E0E',
  bodyShadow:  '#8B0A0A',
  brow:        '#3A1A0A',
  wing:        '#CC1818',
  wingTip:     '#8B0E0E',
  tail:        '#BB1414',
  tailMid:     '#991010',
  tailTip:     '#771010',
  leg:         '#FFAA00',
  foot:        '#CC7700',
};

// Mismo ciclo de aleteo que los demás personajes
const WING_CYCLE = [0, 1, 2, 0, 3, 2];
let _wingCyclePos = 0;

export function updateAngryBird(dt) {
  if (pigeon.stunned > 0)    pigeon.stunned--;
  if (pigeon.invincible > 0) pigeon.invincible--;

  // Red queda anclado al centro; el input mueve la cámara.
  pigeon.x = 0;
  pigeon.y = 0;

  if (pigeon.stunned > 0) {
    pigeon.vx *= 0.85;
    pigeon.vy *= 0.85;
    camera.offsetX += pigeon.vx * dt;
    camera.offsetY += pigeon.vy * dt;

    const maxX = canvas.width  * CAMERA_RANGE_X;
    const maxY = canvas.height * CAMERA_RANGE_Y;
    camera.offsetX = Math.max(-maxX, Math.min(maxX, camera.offsetX));
    camera.offsetY = Math.max(-maxY, Math.min(maxY, camera.offsetY));

    pigeon.stunStars.forEach(s => { s.angle += 0.18 * dt; });
    if (pigeon.stunned === 0) pigeon.stunStars = [];
    return;
  }

  let targetVx = 0, targetVy = 0;
  if (keys['ArrowLeft']  || keys['a']) targetVx -= MAX_VELOCITY;
  if (keys['ArrowRight'] || keys['d']) targetVx += MAX_VELOCITY;
  if (keys['ArrowUp']    || keys['w']) targetVy -= MAX_VELOCITY;
  if (keys['ArrowDown']  || keys['s']) targetVy += MAX_VELOCITY;

  pigeon.vx += (targetVx - pigeon.vx) * EASING;
  pigeon.vy += (targetVy - pigeon.vy) * EASING;
  camera.offsetX += pigeon.vx * dt;
  camera.offsetY += pigeon.vy * dt;

  const maxX = canvas.width  * CAMERA_RANGE_X;
  const maxY = canvas.height * CAMERA_RANGE_Y;
  camera.offsetX = Math.max(-maxX, Math.min(maxX, camera.offsetX));
  camera.offsetY = Math.max(-maxY, Math.min(maxY, camera.offsetY));

  pigeon.tilt = Math.max(-1, Math.min(1, pigeon.vx / MAX_VELOCITY));

  if (STATE.frame % 7 === 0) {
    _wingCyclePos = (_wingCyclePos + 1) % WING_CYCLE.length;
    pigeon.wingFrame = WING_CYCLE[_wingCyclePos];
  }
}

export function drawAngryBird(ctx) {
  const drift = getPigeonScreenOffset();
  const sx = w2sx(pigeon.x) + drift.dx;
  const sy = w2sy(pigeon.y) + drift.dy;

  if (pigeon.invincible > 0 && pigeon.stunned === 0) {
    if (Math.floor(STATE.frame / 4) % 2 === 0) {
      if (pigeon.stunStars.length > 0) _drawStunStars(ctx, sx, sy);
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
    ctx.rotate(pigeon.tilt * 0.25);   // Red es más compacto, menor balanceo
  }

  ctx.scale(SPRITE_SCALE, SPRITE_SCALE);

  if (pigeon.stunned > 0) {
    _drawAngryBirdSprite(ctx, 0, 0, 0, true);
  } else {
    _drawAngryBirdSprite(ctx, 0, 0, pigeon.wingFrame, false);
  }

  ctx.restore();

  if (pigeon.stunned > 0 || pigeon.stunStars.length > 0) {
    _drawStunStars(ctx, sx, sy);
  }
}

/**
 * Sprite 32×32 de Red (Angry Bird) centrado en (cx, cy).
 * Vista de espaldas: cuerpo rojo redondo, crestón de plumas, alas pequeñas.
 */
export function _drawAngryBirdSprite(ctx, cx, cy, wingFrame = 0, isStunned = false) {
  const ox = cx - 16;
  const oy = cy - 16;
  const p  = (x, y, w, h, col) => {
    ctx.fillStyle = col;
    ctx.fillRect(ox + x, oy + y, w, h);
  };

  // ── Crestón (3 plumas puntiagudas, característica principal de Red) ──────────
  p(11,  0,  2, 5, PAL_RED.crest);      // pluma izq
  p(15,  0,  2, 7, PAL_RED.crest);      // pluma central (la más alta)
  p(19,  0,  2, 5, PAL_RED.crest);      // pluma der
  p(13,  2,  2, 2, PAL_RED.crestMid);   // base izq
  p(17,  2,  2, 2, PAL_RED.crestMid);   // base der
  p(14,  3,  4, 2, PAL_RED.crestMid);   // base central
  p(15,  1,  2, 2, PAL_RED.crestLight); // highlight central

  // ── Cabeza (redonda) ─────────────────────────────────────────────────────────
  p(10,  4, 12,  4, PAL_RED.body);
  p( 8,  6, 16,  5, PAL_RED.body);
  p(11,  5,  9,  2, PAL_RED.bodyBright); // highlight superior

  // Cejas: sólo se atisban en los bordes (vista 3/4 trasera)
  p( 8,  8,  3,  1, PAL_RED.brow);  // ceja izq
  p(21,  8,  3,  1, PAL_RED.brow);  // ceja der

  // ── Cuerpo (voluminoso, casi esférico) ───────────────────────────────────────
  p( 7, 10, 18,  2, PAL_RED.body);        // hombros
  p( 5, 12, 22, 10, PAL_RED.body);        // torso principal
  p( 7, 22, 18,  2, PAL_RED.body);        // base del cuerpo

  // Sombras laterales (volumen esférico)
  p( 5, 12,  3, 10, PAL_RED.bodyDark);
  p(24, 12,  3, 10, PAL_RED.bodyDark);
  p( 5, 20,  3,  2, PAL_RED.bodyShadow);
  p(24, 20,  3,  2, PAL_RED.bodyShadow);

  // Highlight de lomo (zona iluminada)
  p(11, 11, 10, 10, PAL_RED.bodyBright);
  p(13, 11,  6,  7, PAL_RED.bodyLight);

  // ── Alas (pequeños muñones; Angry Birds no tienen alas grandes) ───────────────
  let wingY, tipY;
  if (isStunned) {
    wingY = 17; tipY = 20;
  } else {
    switch (wingFrame) {
      case 1:  wingY =  9; tipY =  8; break;  // arriba
      case 2:  wingY = 11; tipY = 10; break;  // medio-arriba
      case 3:  wingY = 17; tipY = 20; break;  // abajo
      default: wingY = 13; tipY = 16; break;  // nivel (0)
    }
  }
  p( 0, wingY, 7, 4, PAL_RED.wing);    // ala izq
  p(25, wingY, 7, 4, PAL_RED.wing);    // ala der
  p( 0, tipY,  7, 2, PAL_RED.wingTip); // punta izq
  p(25, tipY,  7, 2, PAL_RED.wingTip); // punta der

  // ── Cola (plumas compactas) ───────────────────────────────────────────────────
  p(11, 23, 10,  3, PAL_RED.tail);
  p(12, 25,  8,  2, PAL_RED.tailMid);
  p(13, 26,  6,  1, PAL_RED.tailTip);

  // ── Patas (cortas y naranjas) ────────────────────────────────────────────────
  p(12, 24,  2,  4, PAL_RED.leg);  // pierna izq
  p(18, 24,  2,  4, PAL_RED.leg);  // pierna der

  // ── Pies (3 dedos) ───────────────────────────────────────────────────────────
  p( 9, 27,  5,  1, PAL_RED.leg);   // pie izq
  p(18, 27,  5,  1, PAL_RED.leg);   // pie der
  p( 9, 28,  1,  1, PAL_RED.foot);  // garra izq ext
  p(13, 28,  1,  1, PAL_RED.foot);  // garra izq int
  p(18, 28,  1,  1, PAL_RED.foot);  // garra der int
  p(22, 28,  1,  1, PAL_RED.foot);  // garra der ext
}

function _drawStunStars(ctx, cx, cy) {
  pigeon.stunStars.forEach(star => {
    const sx = cx + Math.cos(star.angle) * star.radius;
    const sy = cy - 18 + Math.sin(star.angle) * (star.radius * 0.5);
    _drawPixelStar(ctx, sx, sy, star.color);
  });
}

function _drawPixelStar(ctx, x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x - 1, y - 3, 2, 2);
  ctx.fillRect(x - 3, y - 1, 6, 2);
  ctx.fillRect(x - 1, y + 1, 2, 2);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(x - 1, y - 1, 2, 2);
}
