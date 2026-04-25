'use strict';
// Pantalla de inicio

function drawStartScreen() {
  px(0, 0, VIEW_W, VIEW_H, 'rgba(0,0,0,0.55)');
  drawText('METRO PIGEON', VIEW_W / 2 - 47, 50, PAL.neonYellow, 2);
  drawText('A SUBWAY FLAPPER', VIEW_W / 2 - 32, 80, PAL.neonCyan, 1);
  drawText('ARROWS OR WASD TO FLY', VIEW_W / 2 - 42, 110, PAL.hudText, 1);
  drawText('AVOID TRAINS PILLARS CABLES', VIEW_W / 2 - 54, 122, PAL.hudText, 1);
  drawText('GRAB BREAD COINS PIZZA', VIEW_W / 2 - 44, 134, PAL.hudText, 1);
  if (Math.floor(timeAlive * 2) % 2 === 0) {
    drawText('PRESS SPACE TO START', VIEW_W / 2 - 40, 160, PAL.neonPink, 1);
  }
  drawTitlePigeon(VIEW_W / 2 - 8, 22);
}

function drawTitlePigeon(x, y) {
  const f = Math.floor(timeAlive * 6) % 3;
  const saveX = pigeon.x, saveY = pigeon.y, saveF = pigeon.flapFrame;
  const saveCx = camera.x, saveCy = camera.y;
  pigeon.flapFrame = f;
  pigeon.x = x + 8; pigeon.y = y + 6;
  camera.x = pigeon.x; camera.y = pigeon.y;
  drawPigeon();
  pigeon.x = saveX; pigeon.y = saveY; pigeon.flapFrame = saveF;
  camera.x = saveCx; camera.y = saveCy;
}
