'use strict';
// Pantalla de pausa — pendiente de implementar

function drawPauseScreen() {
  px(0, 0, VIEW_W, VIEW_H, 'rgba(0,0,0,0.5)');
  drawText('PAUSA', VIEW_W / 2 - 20, VIEW_H / 2 - 10, PAL.neonCyan, 2);
  drawText('PRESS P TO CONTINUE', VIEW_W / 2 - 38, VIEW_H / 2 + 16, PAL.hudText, 1);
}
