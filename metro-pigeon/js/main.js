'use strict';
// Bucle principal, lógica de juego y renderizado

function drawHUD() {
  px(0, 0, VIEW_W, 11, 'rgba(0,0,0,0.55)');
  drawText('SCORE ' + Math.floor(score), 4, 3, PAL.hudText);
  drawText('LIVES', VIEW_W - 60, 3, PAL.hudText);
  for (let i = 0; i < lives; i++) {
    const lx = VIEW_W - 33 + i * 10;
    px(lx, 3, 7, 5, PAL.pigeonBody);
    px(lx + 1, 4, 5, 3, PAL.pigeonBelly);
    px(lx + 6, 4, 2, 1, PAL.pigeonBeak);
    px(lx + 5, 3, 1, 1, PAL.pigeonEye);
  }
  if (hitFlash > 0) {
    ctx.globalAlpha = hitFlash * 2;
    px(0, 0, VIEW_W, VIEW_H, PAL.danger);
    ctx.globalAlpha = 1;
  }
}

function update(dt) {
  if (state !== STATE.PLAYING) return;

  timeAlive += dt;
  score += dt * 5;
  scrollSpeed = 60 + Math.min(80, timeAlive * 1.5);
  if (invuln > 0) invuln -= dt;
  if (hitFlash > 0) hitFlash -= dt;

  updatePigeon(dt); // paloma.js

  // Cámara sigue a la paloma
  camera.x = pigeon.x;
  camera.y = VIEW_H / 2;

  // Scroll automático: la paloma avanza, el mundo retrocede
  pigeon.x += scrollSpeed * dt;

  // Desplazamientos parallax
  bgFar  -= scrollSpeed * 0.2 * dt;
  bgMid  -= scrollSpeed * 0.5 * dt;
  bgNear -= scrollSpeed * 1.0 * dt;

  // Spawn de obstáculos
  spawnTimer -= dt;
  if (spawnTimer <= 0) {
    spawnObstacle(); // spawning.js
    spawnTimer = 0.9 + Math.random() * 1.1 - Math.min(0.6, timeAlive * 0.01);
  }

  // Spawn de coleccionables
  collectTimer -= dt;
  if (collectTimer <= 0) {
    spawnCollectible(); // spawning.js
    collectTimer = 0.6 + Math.random() * 0.8;
  }

  // Mover y eliminar obstáculos fuera de pantalla
  for (const o of obstacles) o.x += o.vx * dt;
  obstacles = obstacles.filter(o => o.x + o.w > camera.x - VIEW_W);

  // Mover y eliminar coleccionables fuera de pantalla
  for (const c of collectibles) { c.x += c.vx * dt; c.bob += dt * 4; }
  collectibles = collectibles.filter(c => c.x + c.w > camera.x - VIEW_W);

  // Actualizar partículas
  for (const p of particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 200 * dt;
    p.life -= dt;
  }
  particles = particles.filter(p => p.life > 0);

  // Colisiones
  const pBox = { x: pigeon.x - pigeon.w / 2, y: pigeon.y - pigeon.h / 2, w: pigeon.w, h: pigeon.h };

  // Con coleccionables
  for (let i = collectibles.length - 1; i >= 0; i--) {
    const c = collectibles[i];
    const cBox = { x: c.x - c.w / 2, y: c.y - c.h / 2, w: c.w, h: c.h };
    if (aabb(pBox, cBox)) { // colisiones.js
      score += c.points;
      emitParticles(c.x, c.y, c.type === 'coin' ? PAL.coin : c.type === 'pizza' ? PAL.pizzaCheese : PAL.bread, 8);
      collectibles.splice(i, 1);
    }
  }

  // Con obstáculos (con i-frames)
  if (invuln <= 0) {
    for (const o of obstacles) {
      const oBox = { x: o.x, y: o.y, w: o.w, h: o.h };
      if (aabb(pBox, oBox)) { // colisiones.js
        lives -= 1;
        invuln = 1.5;
        hitFlash = 0.2;
        emitParticles(pigeon.x, pigeon.y, PAL.danger, 14);
        pigeon.vx = -120;
        pigeon.vy = (Math.random() - 0.5) * 100;
        if (lives <= 0) state = STATE.GAME_OVER;
        break;
      }
    }
  }
}

function render() {
  px(0, 0, VIEW_W, VIEW_H, PAL.bg0);
  drawBackground();   // metro.js

  for (const c of collectibles) drawCollectible(c); // metro.js
  for (const o of obstacles) drawObstacle(o);       // metro.js
  drawPigeon();       // paloma.js
  drawParticles();    // metro.js

  drawHUD();

  if (state === STATE.START)     drawStartScreen();    // pantallas/inicio.js
  if (state === STATE.GAME_OVER) drawGameOverScreen(); // pantallas/fin.js
}

// ---- Game loop ----
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (state !== STATE.PLAYING) timeAlive += dt;
  update(dt);
  render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
