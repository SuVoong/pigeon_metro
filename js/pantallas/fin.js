// Pantalla de fin de juego

import { canvas, STATE, FONT, PAL } from '../mecanica/estado.js';

export function drawGameOverScreen(ctx) {
  // Overlay oscuro
  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = PAL.pigeonEye;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.font = 'bold 40px monospace';
  ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2 - 40);

  ctx.fillStyle = PAL.hud;
  ctx.font = '16px monospace';
  ctx.fillText('FINAL SCORE: ' + Math.floor(STATE.score), canvas.width / 2, canvas.height / 2);

  if (Math.floor(STATE.frame / 30) % 2 === 0) {
    ctx.fillStyle = PAL.trainYellow;
    ctx.font = 'bold 14px monospace';
    ctx.fillText('PRESS R TO RESTART', canvas.width / 2, canvas.height / 2 + 40);
  }

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}
