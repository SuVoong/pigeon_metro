'use strict';
// Pantalla de fin de juego

function drawGameOverScreen() {
  px(0, 0, VIEW_W, VIEW_H, 'rgba(0,0,0,0.6)');
  drawText('GAME OVER', VIEW_W / 2 - 36, 60, PAL.danger, 2);
  drawText('FINAL SCORE ' + Math.floor(score), VIEW_W / 2 - 32, 100, PAL.hudText, 1);
  if (Math.floor(timeAlive * 2) % 2 === 0) {
    drawText('PRESS SPACE TO RETRY', VIEW_W / 2 - 40, 130, PAL.neonCyan, 1);
  }
}
