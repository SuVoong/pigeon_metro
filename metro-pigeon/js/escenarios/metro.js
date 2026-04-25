'use strict';
// Escenario: Metro — fondo parallax, obstáculos y coleccionables

// ---- Fondo ----

function drawBackground() {
  px(0, 0, VIEW_W, VIEW_H, PAL.bg0);
  px(0, 20, VIEW_W, VIEW_H - 40, PAL.bg1);
  drawBricks(0, 0, VIEW_W, 28, bgFar);
  drawBricks(0, VIEW_H - 28, VIEW_W, 28, bgFar);
  drawTunnelRibs(bgMid);
  drawNeonSigns(bgMid);
  drawRails(bgNear);
  drawCeilingCables(bgNear);
}

function drawBricks(x, y, w, h, offset) {
  const bw = 16, bh = 8;
  const ox = ((offset % bw) + bw) % bw;
  px(x, y, w, h, PAL.brick);
  for (let row = 0; row * bh < h; row++) {
    const ry = y + row * bh;
    const stagger = (row % 2 === 0) ? 0 : bw / 2;
    for (let col = -1; col * bw < w + bw; col++) {
      const rx = x + col * bw - ox + stagger;
      px(rx, ry, bw - 1, 1, PAL.brickGrout);
      px(rx, ry + bh - 1, 1, 1, PAL.brickGrout);
      px(rx + 1, ry + 1, 2, 1, PAL.brickHi);
    }
  }
  for (let i = 0; i < 18; i++) {
    const nx = x + ((i * 53 + Math.floor(offset)) % w + w) % w;
    const ny = y + (i * 17) % h;
    px(nx, ny, 1, 1, PAL.brickGrout);
  }
}

function drawTunnelRibs(offset) {
  const spacing = 80;
  const ox = ((offset % spacing) + spacing) % spacing;
  for (let i = -1; i * spacing < VIEW_W + spacing; i++) {
    const x = i * spacing - ox;
    px(x, 28, 4, VIEW_H - 56, PAL.tunnelMid);
    px(x + 1, 28, 1, VIEW_H - 56, PAL.tunnelLight);
    px(x - 6, 28, 16, 2, PAL.tunnelMid);
    px(x - 6, 26, 16, 2, PAL.tunnelDark);
    px(x - 6, VIEW_H - 30, 16, 2, PAL.tunnelMid);
  }
}

function drawNeonSigns(offset) {
  const spacing = 160;
  const ox = ((offset * 0.7 % spacing) + spacing) % spacing;
  const colors = [PAL.neonPink, PAL.neonCyan, PAL.neonYellow];
  for (let i = -1; i * spacing < VIEW_W + spacing; i++) {
    const x = i * spacing - ox + 40;
    const c = colors[Math.abs(i) % 3];
    px(x, 50, 28, 14, '#0a0a0a');
    const blink = (Math.floor(timeAlive * 6) + i) % 8 === 0 ? '#ffffff' : c;
    px(x + 2, 52, 24, 2, blink);
    px(x + 2, 56, 24, 2, c);
    px(x + 2, 60, 24, 2, c);
    px(x + 6, 54, 2, 2, '#0a0a0a');
    px(x + 14, 54, 2, 2, '#0a0a0a');
    px(x + 22, 54, 2, 2, '#0a0a0a');
  }
}

function drawRails(offset) {
  px(0, VIEW_H - 18, VIEW_W, 18, PAL.tunnelDark);
  const spacing = 16;
  const ox = ((offset % spacing) + spacing) % spacing;
  for (let i = -1; i * spacing < VIEW_W + spacing; i++) {
    const x = i * spacing - ox;
    px(x, VIEW_H - 10, 12, 3, '#3a2a1a');
    px(x, VIEW_H - 11, 12, 1, '#1a1208');
  }
  px(0, VIEW_H - 12, VIEW_W, 1, PAL.rail);
  px(0, VIEW_H - 6, VIEW_W, 1, PAL.rail);
  px(0, VIEW_H - 12, VIEW_W, 1, PAL.railShine);
  px(0, VIEW_H - 18, VIEW_W, 1, PAL.neonYellow);
}

function drawCeilingCables(offset) {
  const spacing = 28;
  const ox = ((offset % spacing) + spacing) % spacing;
  for (let i = -1; i * spacing < VIEW_W + spacing; i++) {
    const x = i * spacing - ox;
    px(x, 6, spacing, 2, PAL.cable);
    px(x, 6, spacing - 1, 1, PAL.cableHi);
    if (i % 3 === 0) {
      px(x + 6, 8, 1, 4, PAL.cable);
      px(x + 6, 12, 3, 2, PAL.cableHi);
    }
  }
}

// ---- Obstáculos ----

function drawObstacle(o) {
  const sx = w2sx(o.x);
  const sy = w2sy(o.y);
  if (sx + o.w < 0 || sx > VIEW_W) return;
  if (o.type === 'train') drawTrain(sx, sy, o.w, o.h);
  else if (o.type === 'pillar') drawPillar(sx, sy, o.w, o.h);
  else if (o.type === 'cable') drawCable(sx, sy, o.w, o.h);
  else if (o.type === 'passenger') drawPassenger(sx, sy, o.w, o.h);
}

function drawTrain(x, y, w, h) {
  px(x, y, w, h, PAL.train);
  px(x, y, w, 2, PAL.trainShade);
  px(x, y + h - 4, w, 4, PAL.trainShade);
  px(x, y + h - 2, w, 2, PAL.trainBlack);
  px(x, y + 8, 2, 6, PAL.neonYellow);
  px(x - 4, y + 9, 4, 4, 'rgba(255,216,74,0.4)');
  for (let i = 0; i < 4; i++) {
    const wx = x + 10 + i * 18;
    px(wx, y + 6, 12, 10, PAL.trainWindow);
    px(wx, y + 6, 12, 1, '#5fb6d6');
    px(wx + 5, y + 6, 1, 10, PAL.trainShade);
  }
  for (let i = 0; i < 3; i++) {
    const wx = x + 10 + i * 30;
    px(wx, y + h - 1, 8, 1, PAL.trainBlack);
    px(wx + 1, y + h, 6, 1, PAL.trainBlack);
  }
  for (let i = 0; i < 5; i++) {
    const sx2 = x + w + 2 + i * 6;
    px(sx2, y + 6 + (i * 5) % 20, 4, 1, PAL.trainWindow);
  }
}

function drawPillar(x, y, w, h) {
  px(x, y, w, h, PAL.pillar);
  px(x, y, 2, h, PAL.pillarShade);
  px(x + w - 2, y, 2, h, PAL.pillarShade);
  for (let i = 0; i < 6; i++) {
    const by = y + 8 + i * (h / 6);
    px(x + 5, by, 2, 2, '#1a1a22');
    px(x + 5, by, 1, 1, '#5a5a64');
  }
  px(x - 2, y, w + 4, 4, PAL.pillarShade);
  px(x - 2, y + h - 4, w + 4, 4, PAL.pillarShade);
}

function drawCable(x, y, w, h) {
  px(x, 0, 2, y, PAL.cable);
  px(x + w - 2, 0, 2, y, PAL.cable);
  px(x, y, w, h - 4, PAL.cable);
  px(x, y, w, 1, PAL.cableHi);
  if (Math.floor(timeAlive * 8) % 4 === 0) {
    px(x + w / 2 - 1, y + h - 2, 3, 2, PAL.neonCyan);
  } else {
    px(x + w / 2 - 1, y + h - 2, 3, 2, PAL.cableHi);
  }
}

function drawPassenger(x, y, w, h) {
  px(x + 2, y + 8, w - 4, h - 8, PAL.passenger1);
  px(x + 3, y + h - 4, 2, 4, PAL.passenger2);
  px(x + w - 5, y + h - 4, 2, 4, PAL.passenger2);
  px(x + 4, y + 2, w - 8, 6, PAL.passengerSkin);
  px(x + 4, y, w - 8, 3, '#1a1a22');
  px(x + w - 2, y + 12, 3, 4, '#3a2a1a');
  px(x + w - 2, y + 11, 3, 1, '#5a4030');
}

// ---- Coleccionables ----

function drawCollectible(c) {
  const sx = w2sx(c.x);
  const sy = w2sy(c.y) + Math.floor(Math.sin(c.bob) * 2);
  if (sx + c.w < 0 || sx > VIEW_W) return;
  if (c.type === 'bread') drawBread(sx - c.w / 2, sy - c.h / 2);
  else if (c.type === 'coin') drawCoin(sx - c.w / 2, sy - c.h / 2);
  else if (c.type === 'pizza') drawPizza(sx - c.w / 2, sy - c.h / 2);
}

function drawBread(x, y) {
  px(x + 1, y + 2, 6, 4, PAL.bread);
  px(x + 2, y + 1, 4, 1, PAL.bread);
  px(x + 1, y + 6, 6, 1, PAL.breadShade);
  px(x + 2, y + 3, 1, 1, PAL.breadShade);
  px(x + 5, y + 4, 1, 1, PAL.breadShade);
}

function drawCoin(x, y) {
  const wob = Math.floor(Math.sin(timeAlive * 6) * 1.5) + 0;
  px(x + 2 - wob, y + 1, 4 + wob * 2, 6, PAL.coin);
  px(x + 2 - wob, y + 1, 4 + wob * 2, 1, '#fff8a0');
  px(x + 2 - wob, y + 6, 4 + wob * 2, 1, PAL.coinShade);
  px(x + 3, y + 3, 2, 2, PAL.coinShade);
}

function drawPizza(x, y) {
  px(x + 5, y + 1, 2, 1, PAL.pizzaCrust);
  px(x + 4, y + 2, 4, 1, PAL.pizzaCheese);
  px(x + 3, y + 3, 6, 1, PAL.pizzaCheese);
  px(x + 2, y + 4, 8, 1, PAL.pizzaCheese);
  px(x + 1, y + 5, 10, 1, PAL.pizzaCheese);
  px(x + 1, y + 6, 10, 2, PAL.pizzaCrust);
  px(x + 4, y + 3, 2, 1, PAL.pizzaPep);
  px(x + 7, y + 4, 2, 1, PAL.pizzaPep);
  px(x + 3, y + 5, 1, 1, PAL.pizzaPep);
}

// ---- Partículas ----

function drawParticles() {
  for (const p of particles) {
    const a = Math.max(0, p.life);
    ctx.globalAlpha = Math.min(1, a * 2);
    px(Math.floor(w2sx(p.x)), Math.floor(w2sy(p.y)), 2, 2, p.color);
  }
  ctx.globalAlpha = 1;
}
