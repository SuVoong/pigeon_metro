'use strict';
// Pantalla de pausa — pendiente de implementar

function drawPauseScreen() {
  px(0, 0, VIEW_W, VIEW_H, 'rgba(0,0,0,0.6)');
  drawText('PAUSA', VIEW_W / 2 - 20, VIEW_H / 2 - 20, PAL.neonCyan, 2);
  drawText('SPACE  CONTINUAR', VIEW_W / 2 - 32, VIEW_H / 2 + 10, PAL.hudText, 1);
  drawText('ESC    MENU', VIEW_W / 2 - 22, VIEW_H / 2 + 22, PAL.hudText, 1);
}
