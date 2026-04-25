'use strict';
// Personaje: Paloma — física de movimiento y sprite

function updatePigeon(dt) {
  const accel = 380;
  const maxSpeed = 130;
  const friction = 6;

  let ax = 0, ay = 0;
  if (keys['arrowleft'] || keys['a']) ax -= 1;
  if (keys['arrowright'] || keys['d']) ax += 1;
  if (keys['arrowup'] || keys['w']) ay -= 1;
  if (keys['arrowdown'] || keys['s']) ay += 1;
  if (ax !== 0 || ay !== 0) {
    const m = Math.hypot(ax, ay);
    ax /= m; ay /= m;
  }

  pigeon.vx += ax * accel * dt;
  pigeon.vy += ay * accel * dt;
  pigeon.vx -= pigeon.vx * friction * dt;
  pigeon.vy -= pigeon.vy * friction * dt;

  const sp = Math.hypot(pigeon.vx, pigeon.vy);
  if (sp > maxSpeed) {
    pigeon.vx = (pigeon.vx / sp) * maxSpeed;
    pigeon.vy = (pigeon.vy / sp) * maxSpeed;
  }

  if (Math.abs(pigeon.vx) > 5) pigeon.facing = pigeon.vx > 0 ? 1 : -1;

  pigeon.x += pigeon.vx * dt;
  pigeon.y += pigeon.vy * dt;

  // Límites verticales del túnel
  const topLimit = camera.y - VIEW_H / 2 + 14;
  const botLimit = camera.y + VIEW_H / 2 - 18;
  if (pigeon.y < topLimit) { pigeon.y = topLimit; pigeon.vy = 0; }
  if (pigeon.y > botLimit) { pigeon.y = botLimit; pigeon.vy = 0; }

  // Animación de aleteo (más rápido con más velocidad)
  pigeon.flapTimer += dt * (4 + Math.abs(pigeon.vx) * 0.05 + Math.abs(pigeon.vy) * 0.05);
  if (pigeon.flapTimer >= 1) {
    pigeon.flapTimer = 0;
    pigeon.flapFrame = (pigeon.flapFrame + 1) % 3;
  }
}

function drawPigeon() {
  const sx = w2sx(pigeon.x) - 8;
  const sy = w2sy(pigeon.y) - 6;
  if (invuln > 0 && Math.floor(timeAlive * 20) % 2 === 0) return; // parpadeo de invulnerabilidad

  const f = pigeon.flapFrame; // 0=arriba, 1=medio, 2=abajo
  const flip = pigeon.facing < 0;

  const sprite = [];
  function p(x, y, c) { sprite.push([x, y, c]); }

  // Cuerpo
  p(4, 5, PAL.pigeonBody); p(5, 5, PAL.pigeonBody); p(6, 5, PAL.pigeonBody); p(7, 5, PAL.pigeonBody); p(8, 5, PAL.pigeonBody);
  p(3, 6, PAL.pigeonBody); p(4, 6, PAL.pigeonBelly); p(5, 6, PAL.pigeonBelly); p(6, 6, PAL.pigeonBelly); p(7, 6, PAL.pigeonBelly); p(8, 6, PAL.pigeonBody);
  p(3, 7, PAL.pigeonBody); p(4, 7, PAL.pigeonBelly); p(5, 7, PAL.pigeonBelly); p(6, 7, PAL.pigeonBelly); p(7, 7, PAL.pigeonBelly); p(8, 7, PAL.pigeonBody);
  p(4, 8, PAL.pigeonBody); p(5, 8, PAL.pigeonBody); p(6, 8, PAL.pigeonBody); p(7, 8, PAL.pigeonBody);

  // Cabeza
  p(9, 4, PAL.pigeonHead); p(10, 4, PAL.pigeonHead); p(11, 4, PAL.pigeonHead);
  p(9, 5, PAL.pigeonHead); p(10, 5, PAL.pigeonHead); p(11, 5, PAL.pigeonHead);
  p(11, 5, PAL.pigeonEye);
  p(12, 5, PAL.pigeonBeak); p(13, 5, PAL.pigeonBeak);
  p(12, 6, PAL.pigeonBeak);

  // Patas (recogidas en vuelo)
  p(6, 9, PAL.pigeonFoot); p(8, 9, PAL.pigeonFoot);

  // Ala — 3 frames
  if (f === 0) { // arriba
    p(4, 2, PAL.pigeonHead); p(5, 2, PAL.pigeonHead); p(6, 2, PAL.pigeonHead);
    p(4, 3, PAL.pigeonBody); p(5, 3, PAL.pigeonBody); p(6, 3, PAL.pigeonBody); p(7, 3, PAL.pigeonBody);
    p(5, 4, PAL.pigeonBody); p(6, 4, PAL.pigeonBody);
  } else if (f === 1) { // medio
    p(3, 4, PAL.pigeonHead); p(4, 4, PAL.pigeonHead); p(5, 4, PAL.pigeonHead); p(6, 4, PAL.pigeonHead); p(7, 4, PAL.pigeonHead);
    p(3, 5, PAL.pigeonBody);
  } else { // abajo
    p(3, 8, PAL.pigeonHead); p(4, 9, PAL.pigeonHead); p(5, 9, PAL.pigeonHead); p(6, 9, PAL.pigeonHead);
    p(4, 10, PAL.pigeonBody); p(5, 10, PAL.pigeonBody); p(6, 10, PAL.pigeonBody);
  }

  for (const [px_, py_, c] of sprite) {
    const dx = flip ? (15 - px_) : px_;
    ctx.fillStyle = c;
    ctx.fillRect(sx + dx, sy + py_, 1, 1);
  }
}
