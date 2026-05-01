// Generación de obstáculos, coleccionables y partículas

import { obstacles, collectibles, particles } from './estado.js';

const SPAWN_Z = 800;
const COLLECTIBLE_Z = 600;

export function spawnObstacle() {
  const types = ['trainLeft', 'trainRight', 'pipe'];
  const type = types[Math.floor(Math.random() * types.length)];

  // No spawnear trenes opuestos a la vez (deja al jugador sin escapatoria)
  if (type === 'trainLeft' || type === 'trainRight') {
    const opposite = type === 'trainLeft' ? 'trainRight' : 'trainLeft';
    const conflict = obstacles.some(
      o => o.type === opposite && Math.abs(o.z - SPAWN_Z) < 200
    );
    if (conflict) return;
  }

  if (type === 'trainLeft') {
    obstacles.push({ type, z: SPAWN_Z, x: -120, y: 0, w: 90, h: 140 });
  } else if (type === 'trainRight') {
    obstacles.push({ type, z: SPAWN_Z, x: 120, y: 0, w: 90, h: 140 });
  } else {
    // Tubería: y aleatoria pero asegura ≥80px de hueco respecto al centro
    const side = Math.random() < 0.5 ? -1 : 1;
    const yOffset = (80 + Math.random() * 60) * side;
    obstacles.push({ type, z: SPAWN_Z, x: 0, y: yOffset, w: 400, h: 14 });
  }
}

export function spawnCollectible() {
  const type = Math.random() < 0.7 ? 'breadcrumb' : 'coin';
  const x = (Math.random() - 0.5) * 240;
  const y = (Math.random() - 0.5) * 160;
  collectibles.push({ type, z: COLLECTIBLE_Z, x, y, w: 8, h: 8 });
}

export function emitParticles(x, y, color, count) {
  for (let i = 0; i < count; i++) {
    particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 4,
      vy: (Math.random() - 0.5) * 4,
      life: 30,
      color,
    });
  }
}
