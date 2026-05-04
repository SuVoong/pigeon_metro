// Paloma urbana — vista de espaldas, físíca con easing y sprite 32×32 (4 frames de aleteo)

import { pigeon, STATE, canvas } from '../mecanica/estado.js';
import { keys } from '../mecanica/input.js';
import {
  w2sx, w2sy, camera, CAMERA_RANGE_X, CAMERA_RANGE_Y, getPigeonScreenOffset,
  getPigeonVerticalOffset,
} from '../mecanica/camara.js';

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
  // Decrementar contadores
  if (pigeon.stunned > 0)    pigeon.stunned--;
  if (pigeon.invincible > 0) pigeon.invincible--;

  // ── Mecánica nueva ──
  // La paloma queda anclada al centro de la pantalla (pigeon.x = pigeon.y = 0).
  // Lo que se desplaza con el input es la CÁMARA — todo el escenario se
  // mueve alrededor de la paloma. La velocidad sigue viviendo en pigeon.vx/vy
  // por compatibilidad con tilt visual y el sistema de stun.
  pigeon.x = 0;
  pigeon.y = 0;

  // ── BLOQUEAR INPUT mientras está aturdida ──
  if (pigeon.stunned > 0) {
    // Aplicar fricción: la cámara pierde velocidad lentamente
    pigeon.vx *= 0.85;
    pigeon.vy *= 0.85;
    camera.offsetX += pigeon.vx * dt;
    camera.offsetY += pigeon.vy * dt;

    // Clampear el offset al rango de cámara (centralizado en camara.js)
    const maxX = canvas.width  * CAMERA_RANGE_X;
    const maxY = canvas.height * CAMERA_RANGE_Y;
    camera.offsetX = Math.max(-maxX, Math.min(maxX, camera.offsetX));
    camera.offsetY = Math.max(-maxY, Math.min(maxY, camera.offsetY));

    // Actualizar ángulos de las estrellitas (rotación)
    pigeon.stunStars.forEach(s => {
      s.angle += 0.18 * dt;
    });

    // Limpiar estrellitas cuando termina el stun
    if (pigeon.stunned === 0) {
      pigeon.stunStars = [];
    }

    return;  // skip normal movement input
  }

  // ── Movimiento normal: input mueve la cámara, no la paloma ──
  let targetVx = 0, targetVy = 0;
  if (keys['ArrowLeft']  || keys['a']) targetVx -= MAX_VELOCITY;
  if (keys['ArrowRight'] || keys['d']) targetVx += MAX_VELOCITY;
  if (keys['ArrowUp']    || keys['w']) targetVy -= MAX_VELOCITY;
  if (keys['ArrowDown']  || keys['s']) targetVy += MAX_VELOCITY;

  // Lerp hacia la velocidad objetivo
  pigeon.vx += (targetVx - pigeon.vx) * EASING;
  pigeon.vy += (targetVy - pigeon.vy) * EASING;

  // Aplicar velocidad al OFFSET DE CÁMARA (la paloma queda quieta)
  camera.offsetX += pigeon.vx * dt;
  camera.offsetY += pigeon.vy * dt;

  // Clampear el offset a la zona central del canvas
  const maxX = canvas.width  * CAMERA_RANGE_X;
  const maxY = canvas.height * CAMERA_RANGE_Y;
  camera.offsetX = Math.max(-maxX, Math.min(maxX, camera.offsetX));
  camera.offsetY = Math.max(-maxY, Math.min(maxY, camera.offsetY));

  // Inclinación visual (basada en la velocidad de la cámara)
  pigeon.tilt = Math.max(-1, Math.min(1, pigeon.vx / MAX_VELOCITY));

  // Ciclo de alas: avanzar cada 7 frames
  if (STATE.frame % 7 === 0) {
    _wingCyclePos = (_wingCyclePos + 1) % WING_CYCLE.length;
    pigeon.wingFrame = WING_CYCLE[_wingCyclePos];
  }
}

export function drawPigeon(ctx) {
  // Posición visual = centro fijo + drift por offset de cámara. El drift
  // permite que la paloma "vuele" hasta el techo o pique a los rieles
  // cuando el jugador mantiene Up/Down al máximo. La hitbox sigue en
  // (pigeon.x, pigeon.y) = (0, 0) world.
  const drift = getPigeonScreenOffset();
  const sx = w2sx(pigeon.x) + drift.dx;
  const sy = w2sy(pigeon.y) + drift.dy + getPigeonVerticalOffset();

  // ── PARPADEO durante invencibilidad (después del stun) ──
  // Solo cuando NO está en stun (stun = 0) e invincible > 0
  if (pigeon.invincible > 0 && pigeon.stunned === 0) {
    if (Math.floor(STATE.frame / 4) % 2 === 0) {
      // En modo parpadeo, solo dibujar las estrellitas (si quedan)
      if (pigeon.stunStars.length > 0) {
        _drawStunStars(ctx, sx, sy);
      }
      return;
    }
  }

  ctx.save();
  ctx.translate(sx, sy);

  // ── ATURDIMIENTO: temblor visual ──
  if (pigeon.stunned > 0) {
    const shake = (Math.random() - 0.5) * 2;
    ctx.translate(shake, shake * 0.5);
    ctx.rotate(Math.sin(STATE.frame * 0.4) * 0.15);
  } else {
    ctx.rotate(pigeon.tilt * 0.3);
  }

  ctx.scale(SPRITE_SCALE, SPRITE_SCALE);

  // ── DIBUJAR EL SPRITE ──
  if (pigeon.stunned > 0) {
    _drawPalomaSprite(ctx, 0, 0, 0, true);  // true = stunned state
  } else {
    _drawPalomaSprite(ctx, 0, 0, pigeon.wingFrame, false);
  }

  ctx.restore();

  // ── ESTRELLITAS GIRANDO ──
  if (pigeon.stunned > 0 || pigeon.stunStars.length > 0) {
    _drawStunStars(ctx, sx, sy);
  }
}

/**
 * Dibuja el sprite 32×32 de la paloma centrado en (cx, cy).
 * Se puede llamar con escala 1 (el contexto ya está escalado desde fuera)
 * o con escala diferente para previews.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} cx  X centro del sprite en el espacio actual
 * @param {number} cy  Y centro del sprite en el espacio actual
 * @param {number} wingFrame  0-3
 * @param {boolean} isStunned  true para dibujar con ojos en X y alas caídas
 */
export function _drawPalomaSprite(ctx, cx, cy, wingFrame = 0, isStunned = false) {
  const ox = cx - 16;  // esquina superior-izquierda del box 32×32
  const oy = cy - 16;
  const p  = (x, y, w, h, col) => {
    ctx.fillStyle = col;
    ctx.fillRect(ox + x, oy + y, w, h);
  };

  // ── Cabeza ─────────────────────────────────────────────────────────────────
  p(12,  0,  8, 7, PAL_PALOMA.head);
  p(14,  0,  4, 2, PAL_PALOMA.headLight);

  // ── Ojos (normal o aturdido en X) ───────────────────────────────────────────
  if (isStunned) {
    _drawXEye(ctx, ox + 19, oy + 2);   // ojo derecho en X
    _drawXEye(ctx, ox + 11, oy + 2);   // ojo izquierdo en X
  } else {
    p(19,  2,  2, 2, PAL_PALOMA.eye);
  }

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

  // ── Alas (4 frames o caídas si aturdido) ───────────────────────────────────
  let wingY, tipY;
  if (isStunned) {
    // Alas caídas (frame fijo en posición baja)
    wingY = 14;
    tipY  = 17;
  } else {
    switch (wingFrame) {
      case 1:  wingY = 4;  tipY = 3;  break;  // arriba
      case 2:  wingY = 7;  tipY = 6;  break;  // medio-arriba
      case 3:  wingY = 14; tipY = 17; break;  // abajo
      default: wingY = 10; tipY = 13; break;  // nivel (0)
    }
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

/** Dibuja un ojo en forma de X (3×3 píxeles) */
function _drawXEye(ctx, x, y) {
  ctx.fillStyle = '#222';
  ctx.fillRect(x,     y,     1, 1);  // esquina sup-izq
  ctx.fillRect(x + 2, y,     1, 1);  // esquina sup-der
  ctx.fillRect(x + 1, y + 1, 1, 1);  // centro
  ctx.fillRect(x,     y + 2, 1, 1);  // esquina inf-izq
  ctx.fillRect(x + 2, y + 2, 1, 1);  // esquina inf-der
}

/** Dibuja 4 estrellitas orbitando alrededor de la paloma */
function _drawStunStars(ctx, cx, cy) {
  pigeon.stunStars.forEach(star => {
    const sx = cx + Math.cos(star.angle) * star.radius;
    const sy = cy - 18 + Math.sin(star.angle) * (star.radius * 0.5);  // órbita elíptica
    _drawPixelStar(ctx, sx, sy, star.color);
  });
}

/** Dibuja una estrella de 5 píxeles en patrón de cruz */
function _drawPixelStar(ctx, x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x - 1, y - 3, 2, 2);   // punta arriba
  ctx.fillRect(x - 3, y - 1, 6, 2);   // brazo horizontal
  ctx.fillRect(x - 1, y + 1, 2, 2);   // punta abajo

  // Centro brillante blanco
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(x - 1, y - 1, 2, 2);
}
