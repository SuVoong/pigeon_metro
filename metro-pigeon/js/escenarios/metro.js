// Escenario Metro: túnel en perspectiva, obstáculos, coleccionables y partículas

import { canvas, STATE, obstacles, collectibles, particles, PAL } from '../mecanica/estado.js';
import { w2sx, w2sy, perspective } from '../mecanica/camara.js';
import { spawnObstacle, spawnCollectible } from '../mecanica/spawning.js';

let obstacleSpawnTimer = 0;
let collectibleSpawnTimer = 0;

// ---------- Túnel ----------

export function drawTunnel(ctx) {
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;

  // Fondo
  ctx.fillStyle = PAL.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Anillos de pared en perspectiva (de lejos a cerca)
  const ringSpacing = 100;
  const offset = ((STATE.worldZ % ringSpacing) + ringSpacing) % ringSpacing;

  for (let i = 14; i >= 1; i--) {
    const z = i * ringSpacing - offset;
    if (z <= 0) continue;
    const scale = perspective(z);
    const w = canvas.width * scale;
    const h = canvas.height * scale;
    const x = cx - w / 2;
    const y = cy - h / 2;
    const t = Math.max(2, 8 * scale);  // grosor del marco

    // Bandas de techo y suelo (concrete)
    ctx.fillStyle = PAL.concrete;
    ctx.fillRect(x, y, w, t);
    ctx.fillRect(x, y + h - t, w, t);

    // Paredes laterales (brick)
    ctx.fillStyle = PAL.brick;
    ctx.fillRect(x, y + t, t, h - 2 * t);
    ctx.fillRect(x + w - t, y + t, t, h - 2 * t);

    // Mortero — outline del anillo
    ctx.strokeStyle = PAL.grout;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  }

  // Líneas de fuga desde las esquinas hasta el punto de fuga
  ctx.strokeStyle = PAL.grout;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, 0);                       ctx.lineTo(cx, cy);
  ctx.moveTo(canvas.width, 0);            ctx.lineTo(cx, cy);
  ctx.moveTo(0, canvas.height);           ctx.lineTo(cx, cy);
  ctx.moveTo(canvas.width, canvas.height); ctx.lineTo(cx, cy);
  ctx.stroke();

  // Tubos fluorescentes en el techo, parpadean cada ~120 frames
  const lightSpacing = 200;
  const lightOffset = ((STATE.worldZ * 2 % lightSpacing) + lightSpacing) % lightSpacing;
  for (let i = 8; i >= 1; i--) {
    const z = i * lightSpacing - lightOffset;
    if (z <= 0) continue;
    const scale = perspective(z);
    const lw = 80 * scale;
    const lh = Math.max(1, 4 * scale);
    const lx = cx - lw / 2;
    const ly = cy - canvas.height * 0.42 * scale;

    const flickerPhase = (STATE.frame + i * 37) % (120 + (i * 13 % 40));
    const flickering = flickerPhase < 4;
    ctx.fillStyle = flickering ? PAL.concrete : PAL.light;
    ctx.fillRect(lx, ly, lw, lh);
  }
}

// ---------- Obstáculos ----------

export function updateObstacles(dt) {
  for (let i = obstacles.length - 1; i >= 0; i--) {
    obstacles[i].z -= STATE.speed * dt;
    if (obstacles[i].z < -50) obstacles.splice(i, 1);
  }

  obstacleSpawnTimer -= dt;
  if (obstacleSpawnTimer <= 0) {
    spawnObstacle();
    obstacleSpawnTimer = 90 / Math.max(1, STATE.speed * 0.5);
  }
}

export function drawObstacles(ctx) {
  // Ordenar por z descendente: lejos primero, cerca encima
  const sorted = [...obstacles].sort((a, b) => b.z - a.z);

  for (const obj of sorted) {
    const scale = perspective(obj.z);
    const sx = w2sx(obj.x * scale);
    const sy = w2sy(obj.y * scale);
    const sw = obj.w * scale;
    const sh = obj.h * scale;

    if (obj.type === 'trainLeft' || obj.type === 'trainRight') {
      // Cuerpo amarillo del metro
      ctx.fillStyle = PAL.trainYellow;
      ctx.fillRect(sx - sw / 2, sy - sh / 2, sw, sh);

      // Borde oscuro
      ctx.strokeStyle = PAL.trainDark;
      ctx.lineWidth = Math.max(1, 2 * scale);
      ctx.strokeRect(sx - sw / 2, sy - sh / 2, sw, sh);

      // Ventanas oscuras (3 horizontales en la parte alta)
      ctx.fillStyle = PAL.trainDark;
      const winW = sw * 0.18;
      const winH = sh * 0.12;
      for (let i = 0; i < 3; i++) {
        const wx = sx - sw / 2 + sw * 0.12 + i * sw * 0.28;
        const wy = sy - sh / 2 + sh * 0.12;
        ctx.fillRect(wx, wy, winW, winH);
      }

      // Faros (dos puntos blancos abajo)
      ctx.fillStyle = '#ffffff';
      const headW = Math.max(2, sw * 0.1);
      const headH = Math.max(2, sh * 0.05);
      ctx.fillRect(sx - sw / 2 + sw * 0.18, sy + sh / 2 - sh * 0.18, headW, headH);
      ctx.fillRect(sx + sw / 2 - sw * 0.28, sy + sh / 2 - sh * 0.18, headW, headH);
    } else if (obj.type === 'pipe') {
      // Tubería gris ancha
      ctx.fillStyle = PAL.pipeGray;
      ctx.fillRect(sx - sw / 2, sy - sh / 2, sw, sh);

      // Brillo superior
      ctx.fillStyle = '#bbbbbb';
      ctx.fillRect(sx - sw / 2, sy - sh / 2, sw, Math.max(1, 2 * scale));

      // Sombra inferior
      ctx.fillStyle = '#555555';
      ctx.fillRect(sx - sw / 2, sy + sh / 2 - Math.max(1, 2 * scale), sw, Math.max(1, 2 * scale));
    }
  }
}

// ---------- Coleccionables ----------

export function updateCollectibles(dt) {
  for (let i = collectibles.length - 1; i >= 0; i--) {
    collectibles[i].z -= STATE.speed * dt;
    if (collectibles[i].z < -50) collectibles.splice(i, 1);
  }

  collectibleSpawnTimer -= dt;
  if (collectibleSpawnTimer <= 0) {
    spawnCollectible();
    collectibleSpawnTimer = 30 + Math.random() * 30;
  }
}

export function drawCollectibles(ctx) {
  for (const c of collectibles) {
    const scale = perspective(c.z);
    const sx = w2sx(c.x * scale);
    const sy = w2sy(c.y * scale);
    const sw = Math.max(2, c.w * scale * 1.5);
    const sh = Math.max(2, c.h * scale * 1.5);

    if (c.type === 'breadcrumb') {
      ctx.fillStyle = '#e8c476';
      ctx.fillRect(sx - sw / 2, sy - sh / 2, sw, sh);
      ctx.fillStyle = '#a07a3a';
      ctx.fillRect(sx - sw / 2, sy + sh / 2 - 1, sw, 1);
    } else { // coin
      ctx.fillStyle = '#ffdd55';
      ctx.fillRect(sx - sw / 2, sy - sh / 2, sw, sh);
      ctx.strokeStyle = '#a07a14';
      ctx.lineWidth = 1;
      ctx.strokeRect(sx - sw / 2, sy - sh / 2, sw, sh);
    }
  }
}

// ---------- Partículas ----------

export function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

export function drawParticles(ctx) {
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, Math.min(1, p.life / 30));
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
  }
  ctx.globalAlpha = 1;
}
