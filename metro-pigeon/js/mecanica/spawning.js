'use strict';
// Generación de obstáculos, coleccionables y partículas

function spawnObstacle() {
  const types = ['train', 'pillar', 'cable', 'passenger'];
  const type = types[Math.floor(Math.random() * types.length)];
  const wx = camera.x + VIEW_W / 2 + VIEW_W / 2 + 40 + Math.random() * 60;
  let wy, w, h;
  if (type === 'train') {
    w = 90; h = 36;
    wy = (Math.random() < 0.5 ? VIEW_H * 0.18 : VIEW_H * 0.62);
  } else if (type === 'pillar') {
    w = 14; h = 120;
    wy = VIEW_H / 2 - h / 2 + (Math.random() * 40 - 20);
  } else if (type === 'cable') {
    w = 32; h = 22;
    wy = 8 + Math.random() * 20;
  } else { // passenger
    w = 14; h = 22;
    wy = VIEW_H - 28 - Math.random() * 4;
  }
  obstacles.push({ type, x: wx, y: wy, w, h, vx: -scrollSpeed - (type === 'train' ? 80 : 0) });
}

function spawnCollectible() {
  const r = Math.random();
  let type;
  if (r < 0.6) type = 'bread';
  else if (r < 0.9) type = 'coin';
  else type = 'pizza';
  const w = type === 'pizza' ? 12 : 8;
  const h = type === 'pizza' ? 12 : 8;
  const wx = camera.x + VIEW_W / 2 + VIEW_W / 2 + 20 + Math.random() * 80;
  const wy = 30 + Math.random() * (VIEW_H - 60);
  collectibles.push({
    type, x: wx, y: wy, w, h, vx: -scrollSpeed,
    bob: Math.random() * Math.PI * 2,
    points: type === 'bread' ? 5 : type === 'coin' ? 10 : 25,
  });
}

function emitParticles(x, y, color, count) {
  for (let i = 0; i < count; i++) {
    particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 80,
      vy: (Math.random() - 0.5) * 80 - 20,
      life: 0.4 + Math.random() * 0.3,
      color,
    });
  }
}
