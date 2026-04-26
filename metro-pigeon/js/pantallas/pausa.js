// Pantalla de pausa: overlay con botón de continuar y botón de volver al inicio

import { canvas, STATE, PAL, pigeon, obstacles, collectibles, particles } from '../mecanica/estado.js';

export function handlePauseInput(keys, consumeKey) {
  // P / ESC → reanudar
  if (keys['p'] || keys['Escape']) {
    STATE.phase = 'PLAYING';
    consumeKey('p');
    consumeKey('Escape');
  }
  // M → volver al menú principal (resetea la partida)
  if (keys['m']) {
    consumeKey('m');
    STATE.score        = 0;
    STATE.lives        = 3;
    STATE.speed        = 2;
    STATE.frame        = 0;
    STATE.worldZ       = 0;
    STATE.totalPlaySeconds = 0;
    pigeon.x = pigeon.y = pigeon.vx = pigeon.vy = pigeon.tilt = 0;
    pigeon.wingFrame = pigeon.invincible = 0;
    obstacles.length   = 0;
    collectibles.length = 0;
    particles.length   = 0;
    STATE.phase = 'START';
  }
}

export function drawPauseScreen(ctx) {
  // Overlay semitransparente
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const midX = canvas.width  / 2;
  const midY = canvas.height / 2;

  // ── Título ──────────────────────────────────────────────────────────────
  ctx.fillStyle = PAL.hud;
  ctx.font = 'bold 32px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const titleCY = midY - 120;
  ctx.fillText('PAUSA', midX, titleCY);

  // ── Dimensiones comunes ──────────────────────────────────────────────────
  const btnW = 200, btnH = 38;
  const btnX = midX - btnW / 2;

  // Botón 1: CONTINUAR
  const btn1Top = titleCY + 16 + 32; // gap 32px tras el título (radio ≈16px)
  ctx.fillStyle = 'rgba(245,197,24,0.1)';
  ctx.fillRect(btnX, btn1Top, btnW, btnH);
  ctx.strokeStyle = PAL.trainYellow;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(btnX + 0.75, btn1Top + 0.75, btnW - 1.5, btnH - 1.5);

  ctx.fillStyle = PAL.trainYellow;
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('▶  CONTINUAR', midX, btn1Top + btnH / 2);

  // Pista bajo botón 1
  const hint1CY = btn1Top + btnH + 12;
  ctx.fillStyle = '#888';
  ctx.font = '10px monospace';
  ctx.fillText('[P / ESC]', midX, hint1CY);

  // Botón 2: IR AL INICIO
  const btn2Top = hint1CY + 12 + 16; // 16px de margen bajo la pista
  ctx.fillStyle = 'rgba(200,50,50,0.08)';
  ctx.fillRect(btnX, btn2Top, btnW, btnH);
  ctx.strokeStyle = '#993333';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(btnX + 0.75, btn2Top + 0.75, btnW - 1.5, btnH - 1.5);

  ctx.fillStyle = '#ff6666';
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('⌂  IR AL INICIO', midX, btn2Top + btnH / 2);

  // Pista bajo botón 2
  ctx.fillStyle = '#cc4444';
  ctx.font = '10px monospace';
  ctx.fillText('[M] · la partida se reiniciará', midX, btn2Top + btnH + 12);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}
