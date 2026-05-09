// Paloma urbana — vista de espaldas, físíca con easing y sprite 32×32 (4 frames de aleteo)
// Diseño pixel 3D: sombreado tri-tonal, luz desde arriba-izquierda

import { pigeon, STATE, canvas } from '../mecanica/estado.js';
import { keys } from '../mecanica/input.js';
import {
  w2sx, w2sy, camera, CAMERA_RANGE_X, CAMERA_RANGE_Y_UP, CAMERA_RANGE_Y_DOWN,
  getPigeonScreenOffset, getPigeonVerticalOffset,
} from '../mecanica/camara.js';

const MAX_VELOCITY = 6;
const EASING       = 0.15;
const SPRITE_SCALE = 2.25;  // 32px diseño × 2.25 = 72px (reducido 25 % desde 3)

// Paleta 3D: 3 tonos por zona (highlight / base / sombra)
const PAL_PALOMA = {
  // Cabeza
  headHigh:       '#C4D4E6',
  head:           '#8899AA',
  headDark:       '#5A6B7C',
  // Ojo
  eye:            '#FFFFFF',
  eyePupil:       '#1A1A2A',
  // Pico
  beak:           '#D4A855',
  beakDark:       '#9A7830',
  // Collar iridiscente
  collarTealHigh: '#66CCEE',
  collarTealD:    '#1F5577',
  collarPurpHigh: '#DD77DD',
  collarPurpD:    '#772288',
  // Cuerpo
  bodyHigh:       '#AABCCE',
  body:           '#8899AA',
  bodyDark:       '#5A6B7C',
  bodyDeep:       '#3C4D5E',
  // Vientre
  bellyHigh:      '#EEEEFF',
  belly:          '#CCCCDD',
  // Alas
  wingHigh:       '#8A9DAF',
  wing:           '#556677',
  wingDark:       '#38495A',
  wingTip:        '#1E3040',
  // Cola
  tailHigh:       '#667788',
  tail:           '#445566',
  tailMid:        '#2E3F50',
  tailTip:        '#162636',
  tailDark:       '#1A2B3C',
  // Patas y pies
  leg:            '#E8AA88',
  legDark:        '#B07855',
  foot:           '#C08864',
  footTip:        '#8A5A3A',
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
    const maxX     = canvas.width  * CAMERA_RANGE_X;
    const maxYUp   = canvas.height * CAMERA_RANGE_Y_UP;
    const maxYDown = canvas.height * CAMERA_RANGE_Y_DOWN;
    camera.offsetX = Math.max(-maxX,    Math.min(maxX,    camera.offsetX));
    camera.offsetY = Math.max(-maxYUp,  Math.min(maxYDown, camera.offsetY));

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
  const maxX     = canvas.width  * CAMERA_RANGE_X;
  const maxYUp   = canvas.height * CAMERA_RANGE_Y_UP;
  const maxYDown = canvas.height * CAMERA_RANGE_Y_DOWN;
  camera.offsetX = Math.max(-maxX,    Math.min(maxX,    camera.offsetX));
  camera.offsetY = Math.max(-maxYUp,  Math.min(maxYDown, camera.offsetY));

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
 * Sprite 32×32 de la paloma centrado en (cx, cy).
 * Diseño pixel 3D: 3 tonos por zona, luz desde arriba-izquierda.
 */
export function _drawPalomaSprite(ctx, cx, cy, wingFrame = 0, isStunned = false) {
  const ox = cx - 16;
  const oy = cy - 16;
  const p  = (x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(ox+x, oy+y, w, h); };

  // ── Pico (visible de perfil 3/4 desde atrás) ──────────────────────────────
  p(20, 3, 2, 1, PAL_PALOMA.beak);
  p(21, 4, 2, 1, PAL_PALOMA.beakDark);

  // ── Cabeza (domo 3D) ───────────────────────────────────────────────────────
  p(12, 0, 8, 7, PAL_PALOMA.head);
  // Highlight arco superior-izq
  p(14, 0, 4, 1, PAL_PALOMA.headHigh);
  p(13, 1, 3, 1, PAL_PALOMA.headHigh);
  p(12, 2, 2, 1, PAL_PALOMA.headHigh);
  // Sombra der e inferior
  p(19, 2, 1, 4, PAL_PALOMA.headDark);
  p(18, 5, 2, 2, PAL_PALOMA.headDark);
  p(12, 5, 1, 2, PAL_PALOMA.headDark);

  // ── Ojo ───────────────────────────────────────────────────────────────────
  if (isStunned) {
    _drawXEye(ctx, ox + 19, oy + 2);
    _drawXEye(ctx, ox + 11, oy + 2);
  } else {
    p(19, 2, 2, 2, PAL_PALOMA.eye);
    p(20, 3, 1, 1, PAL_PALOMA.eyePupil);
  }

  // ── Collar iridiscente (highlight → sombra) ────────────────────────────────
  p(10, 7, 5, 1, PAL_PALOMA.collarTealHigh);
  p(15, 7, 5, 1, PAL_PALOMA.collarPurpHigh);
  p(10, 8, 5, 1, PAL_PALOMA.collarTealD);
  p(15, 8, 5, 1, PAL_PALOMA.collarPurpD);

  // ── Cuerpo (torso 3D) ─────────────────────────────────────────────────────
  p( 8,  9, 16, 14, PAL_PALOMA.body);
  p(10,  9, 12,  2, PAL_PALOMA.bodyHigh);   // hombros iluminados
  p( 8,  9,  2, 12, PAL_PALOMA.bodyDark);   // borde lat izq
  p(22,  9,  2, 12, PAL_PALOMA.bodyDark);   // borde lat der
  p( 9, 20, 14,  3, PAL_PALOMA.bodyDeep);   // sombra inferior

  // ── Vientre ───────────────────────────────────────────────────────────────
  p(11, 10, 10,  9, PAL_PALOMA.belly);
  p(12, 11,  8,  7, PAL_PALOMA.bellyHigh);

  // ── Alas ──────────────────────────────────────────────────────────────────
  let wingY, tipY;
  if (isStunned) {
    wingY = 15; tipY = 18;
  } else {
    switch (wingFrame) {
      case 1:  wingY = 4;  tipY = 3;  break;   // arriba
      case 2:  wingY = 7;  tipY = 6;  break;   // medio-arriba
      case 3:  wingY = 15; tipY = 18; break;   // abajo
      default: wingY = 11; tipY = 14; break;   // nivel (0)
    }
  }
  // Ala izquierda: highlight → base → tip → sombra borde
  if (wingY > 0) p(0, wingY - 1, 8, 1, PAL_PALOMA.wingHigh);
  p(0, wingY,     8, 3, PAL_PALOMA.wing);
  p(0, tipY,      8, 2, PAL_PALOMA.wingTip);
  p(0, wingY + 3, 8, 1, PAL_PALOMA.wingDark);
  // Separadores de cañones (solo cuando las alas van hacia abajo/nivel)
  if (!isStunned && tipY >= wingY) {
    p(2, wingY, 1, 3, PAL_PALOMA.wingDark);
    p(5, wingY, 1, 3, PAL_PALOMA.wingDark);
  }
  // Ala derecha
  if (wingY > 0) p(24, wingY - 1, 8, 1, PAL_PALOMA.wingHigh);
  p(24, wingY,     8, 3, PAL_PALOMA.wing);
  p(24, tipY,      8, 2, PAL_PALOMA.wingTip);
  p(24, wingY + 3, 8, 1, PAL_PALOMA.wingDark);
  if (!isStunned && tipY >= wingY) {
    p(25, wingY, 1, 3, PAL_PALOMA.wingDark);
    p(28, wingY, 1, 3, PAL_PALOMA.wingDark);
  }

  // ── Cola (abanico con separadores de plumas) ──────────────────────────────
  p(13, 22,  6, 1, PAL_PALOMA.tailHigh);
  p(11, 23, 10, 2, PAL_PALOMA.tail);
  p(10, 25, 12, 1, PAL_PALOMA.tailMid);
  p( 9, 26, 14, 1, PAL_PALOMA.tailMid);
  p( 8, 27, 16, 1, PAL_PALOMA.tailTip);
  p(14, 23,  1, 5, PAL_PALOMA.tailDark);   // separador
  p(18, 23,  1, 5, PAL_PALOMA.tailDark);   // separador

  // ── Patas (con sombra lateral) ────────────────────────────────────────────
  p(11, 22, 2, 3, PAL_PALOMA.leg);
  p(12, 22, 1, 3, PAL_PALOMA.legDark);
  p(19, 22, 2, 3, PAL_PALOMA.leg);
  p(20, 22, 1, 3, PAL_PALOMA.legDark);

  // ── Pies (con dedo trasero y garra) ───────────────────────────────────────
  p( 9, 24, 4, 1, PAL_PALOMA.foot);
  p(19, 24, 4, 1, PAL_PALOMA.foot);
  p( 8, 24, 2, 1, PAL_PALOMA.footTip);   // dedo trasero izq
  p(22, 24, 2, 1, PAL_PALOMA.footTip);   // dedo trasero der
  p( 9, 25, 1, 1, PAL_PALOMA.footTip);   // garra frontal izq
  p(22, 25, 1, 1, PAL_PALOMA.footTip);   // garra frontal der
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
