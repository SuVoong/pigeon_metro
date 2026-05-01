// Escenario Metro: túnel en perspectiva, obstáculos, coleccionables y partículas

import { canvas, STATE, obstacles, collectibles, particles, PAL } from '../mecanica/estado.js';
import { w2sx, w2sy, perspective } from '../mecanica/camara.js';
import { spawnObstacle, spawnCollectible } from '../mecanica/spawning.js';
import { drawTunel } from './metros/metro_base/tunel.js';

let obstacleSpawnTimer = 0;
let collectibleSpawnTimer = 0;

// ---------- Túnel ----------

export function drawTunnel(ctx) {
  // Usar el nuevo diseño fotorrealista del túnel
  drawTunel(ctx, {}, STATE.worldZ);
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
      _drawArcadeTrain(ctx, sx, sy, sw, sh, scale, obj.type);
    } else if (obj.type === 'pipe') {
      _drawArcadePipe(ctx, sx, sy, sw, sh, scale);
    }
  }
}

function _drawArcadeTrain(ctx, sx, sy, sw, sh, scale, type) {
  const x = sx - sw / 2;
  const y = sy - sh / 2;

  // ── Chasis inferior ──────────────────────────────────────────────────────
  ctx.fillStyle = '#1a1a28';
  ctx.fillRect(x, y + sh * 0.88, sw, sh * 0.12);

  // ── Cuerpo principal ─────────────────────────────────────────────────────
  ctx.fillStyle = PAL.trainYellow;
  ctx.fillRect(x, y, sw, sh * 0.88);

  // ── Franja de color de línea (naranja L3) ─────────────────────────────
  ctx.fillStyle = '#E87000';
  ctx.fillRect(x, y + sh * 0.62, sw, sh * 0.14);

  // ── Zona de cabina (top, más oscura) ─────────────────────────────────────
  ctx.fillStyle = '#c9a200';
  ctx.fillRect(x, y, sw, sh * 0.10);

  // ── Panel LED (destino) ───────────────────────────────────────────────────
  ctx.fillStyle = '#111100';
  ctx.fillRect(x + sw * 0.08, y + sh * 0.04, sw * 0.84, sh * 0.10);
  if (scale > 0.4) {
    ctx.fillStyle = '#FF9900';
    ctx.fillRect(x + sw * 0.12, y + sh * 0.06, sw * 0.76, sh * 0.06);
  }

  // ── Parabrisas (2 ventanas) ───────────────────────────────────────────────
  ctx.fillStyle = '#1A2E3A';
  ctx.fillRect(x + sw * 0.06, y + sh * 0.16, sw * 0.38, sh * 0.22);
  ctx.fillRect(x + sw * 0.56, y + sh * 0.16, sw * 0.38, sh * 0.22);
  // Piloto central
  ctx.fillStyle = '#111';
  ctx.fillRect(x + sw * 0.44, y + sh * 0.16, sw * 0.12, sh * 0.22);

  // ── Puertas (líneas verticales) ───────────────────────────────────────────
  if (scale > 0.35) {
    ctx.fillStyle = '#d4970a';
    ctx.fillRect(x + sw * 0.32, y + sh * 0.42, Math.max(1, sw * 0.02), sh * 0.20);
    ctx.fillRect(x + sw * 0.66, y + sh * 0.42, Math.max(1, sw * 0.02), sh * 0.20);
  }

  // ── Faros (rectángulos blancos en esquinas superiores) ──────────────────
  ctx.fillStyle = '#FFFFCC';
  const hw = Math.max(2, sw * 0.09);
  const hh = Math.max(1, sh * 0.06);
  ctx.fillRect(x + sw * 0.04, y + sh * 0.40, hw, hh);
  ctx.fillRect(x + sw * 0.87, y + sh * 0.40, hw, hh);
  // Halo de faro
  if (scale > 0.5) {
    ctx.fillStyle = 'rgba(255,255,180,0.15)';
    ctx.fillRect(x, y + sh * 0.36, sw * 0.22, sh * 0.14);
    ctx.fillRect(x + sw * 0.78, y + sh * 0.36, sw * 0.22, sh * 0.14);
  }

  // ── Ruedas ────────────────────────────────────────────────────────────────
  ctx.fillStyle = '#333344';
  const wheelW = Math.max(2, sw * 0.12);
  const wheelH = Math.max(1, sh * 0.06);
  ctx.fillRect(x + sw * 0.08, y + sh * 0.90, wheelW, wheelH);
  ctx.fillRect(x + sw * 0.80, y + sh * 0.90, wheelW, wheelH);

  // ── Borde/outline ─────────────────────────────────────────────────────────
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = Math.max(0.5, scale * 1.5);
  ctx.strokeRect(x + 0.5, y + 0.5, sw - 1, sh - 1);
}

function _drawArcadePipe(ctx, sx, sy, sw, sh, scale) {
  const x = sx - sw / 2;
  const y = sy - sh / 2;

  // Cuerpo de la tubería
  ctx.fillStyle = '#787880';
  ctx.fillRect(x, y, sw, sh);

  // Highlight superior (reflexión metálica)
  const hh = Math.max(1, sh * 0.30);
  ctx.fillStyle = '#a0a0aa';
  ctx.fillRect(x, y, sw, hh);

  // Línea central brillante
  ctx.fillStyle = 'rgba(200,200,210,0.5)';
  ctx.fillRect(x, y + hh * 0.2, sw, Math.max(1, hh * 0.25));

  // Sombra inferior
  ctx.fillStyle = '#3a3a45';
  ctx.fillRect(x, y + sh - Math.max(1, sh * 0.20), sw, Math.max(1, sh * 0.20));

  // Tornillos/bridas en los extremos
  if (scale > 0.3) {
    const bw = Math.max(2, sh * 0.9);
    ctx.fillStyle = '#606068';
    ctx.fillRect(x + sw * 0.02, y - sh * 0.1, bw, sh * 1.2);
    ctx.fillRect(x + sw - bw - sw * 0.02, y - sh * 0.1, bw, sh * 1.2);
    ctx.fillStyle = '#888890';
    ctx.fillRect(x + sw * 0.02, y, bw, sh);
    ctx.fillRect(x + sw - bw - sw * 0.02, y, bw, sh);
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

    // Opacidad según distancia (coleccionables lejanos son más transparentes)
    const alpha = Math.min(1, scale * 2.5);

    ctx.save();
    ctx.globalAlpha = alpha;

    if (c.type === 'breadcrumb') {
      _drawBreadcrumb(ctx, sx, sy, sw, sh, scale);
    } else {
      _drawCoin(ctx, sx, sy, sw, sh, scale);
    }

    ctx.restore();
  }
}

function _drawCoin(ctx, sx, sy, sw, sh, scale) {
  const r  = Math.max(1, (sw + sh) / 4);

  // ── Halo luminoso (visible en el túnel oscuro) ────────────────────────────
  if (scale > 0.2) {
    const halo = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 3.5);
    halo.addColorStop(0,   'rgba(255,220,60,0.30)');
    halo.addColorStop(0.4, 'rgba(255,200,20,0.12)');
    halo.addColorStop(1,   'rgba(255,180,0,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(sx - r * 3.5, sy - r * 3.5, r * 7, r * 7);
  }

  // ── Borde dorado oscuro ───────────────────────────────────────────────────
  ctx.fillStyle = '#c8880a';
  ctx.fillRect(sx - r,       sy - r,       r * 2,     r * 2);

  // ── Cara dorada ──────────────────────────────────────────────────────────
  const cr = Math.max(1, r - Math.max(1, r * 0.15));
  ctx.fillStyle = '#ffdd44';
  ctx.fillRect(sx - cr,      sy - cr,      cr * 2,    cr * 2);

  // ── Brillo superior izquierdo ─────────────────────────────────────────────
  if (r > 2) {
    ctx.fillStyle = 'rgba(255,255,200,0.70)';
    ctx.fillRect(sx - cr,    sy - cr,      Math.max(1, cr * 0.55), Math.max(1, cr * 0.55));
  }

  // ── Símbolo € central (solo cuando el sprite es grande) ───────────────────
  if (r >= 5) {
    ctx.fillStyle = '#a06010';
    ctx.fillRect(sx - 1, sy - Math.max(1, r * 0.45), 2, Math.max(1, r * 0.9));  // barra vertical
    ctx.fillRect(sx - Math.max(1, r * 0.35), sy - 1, Math.max(1, r * 0.7), 1); // barra horizontal
  }
}

function _drawBreadcrumb(ctx, sx, sy, sw, sh, scale) {
  const hw = sw / 2;
  const hh = sh / 2;

  // ── Halo tenue (menos brillante que la moneda) ────────────────────────────
  if (scale > 0.25) {
    const halo = ctx.createRadialGradient(sx, sy, 0, sx, sy, hw * 3);
    halo.addColorStop(0,   'rgba(210,175,90,0.20)');
    halo.addColorStop(1,   'rgba(210,175,90,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(sx - hw * 3, sy - hw * 3, hw * 6, hw * 6);
  }

  // ── Forma de miga (cuadrado irregular) ───────────────────────────────────
  const mg = Math.max(1, hw * 0.18);  // margen para simular forma irregular
  ctx.fillStyle = '#c8973a';
  ctx.fillRect(sx - hw,      sy - hh,      hw * 2,    hh * 2);

  // ── Color interior de la miga (pan) ──────────────────────────────────────
  ctx.fillStyle = '#e8c476';
  ctx.fillRect(sx - hw + mg, sy - hh + mg, hw * 2 - mg * 2, hh * 2 - mg * 2);

  // ── Textura: puntos de corteza ────────────────────────────────────────────
  if (hw > 3) {
    ctx.fillStyle = '#a07a3a';
    ctx.fillRect(sx - hw + mg,        sy - hh + mg,        mg, mg);  // esquina sup-izq
    ctx.fillRect(sx + hw - mg * 2,    sy + hh - mg * 2,    mg, mg);  // esquina inf-der
  }

  // ── Línea oscura inferior (sombra) ────────────────────────────────────────
  ctx.fillStyle = '#8a6020';
  ctx.fillRect(sx - hw,      sy + hh - Math.max(1, hh * 0.25), hw * 2, Math.max(1, hh * 0.25));
}

// ---------- Partículas ----------

export function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    // Aplicar gravedad a las plumas
    if (p.type === 'feather') {
      p.vy += 0.2 * dt;
      if (p.rotation !== undefined && p.rotSpeed !== undefined) {
        p.rotation += p.rotSpeed * dt;
      }
    }

    p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

export function drawParticles(ctx) {
  for (const p of particles) {
    if (p.type === 'feather') {
      // Pluma rotando con gravedad
      const alpha = Math.max(0, Math.min(1, p.life / 40));
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation || 0);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.fillRect(-2, -1, 4, 2);         // forma de pluma alargada
      ctx.fillRect(-1, -1, 2, 3);         // mástil central
      ctx.restore();
    } else if (p.type === 'spark') {
      // Destello blanco pequeño
      const alpha = Math.max(0, Math.min(1, p.life / 20));
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
    } else {
      // Partícula normal (existente)
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life / 30));
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
    }
  }
  ctx.globalAlpha = 1;
}
