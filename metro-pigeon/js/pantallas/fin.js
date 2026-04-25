'use strict';
// Pantalla de fin de juego

function drawGameOverScreen() {
  px(0, 0, VIEW_W, VIEW_H, 'rgba(0,0,0,0.6)');
  drawText('GAME OVER', VIEW_W / 2 - 36, 55, PAL.danger, 2);
  drawText('FINAL SCORE ' + Math.floor(score), VIEW_W / 2 - 32, 95, PAL.hudText, 1);
  if (Math.floor(timeAlive * 2) % 2 === 0) {
    drawText('SPACE  REINTENTAR', VIEW_W / 2 - 34, 120, PAL.neonCyan, 1);
    drawText('ESC    MENU', VIEW_W / 2 - 22, 134, PAL.hudText, 1);
  }
}
