// Pantalla de logros — lista con estado bloqueado/desbloqueado

import { canvas, STATE, PAL } from '../mecanica/estado.js';
import { ACHIEVEMENTS } from '../mecanica/progreso.js';

export function handleAchievementsInput(keys, consumeKey) {
  if (keys['Escape']) {
    STATE.phase = 'START';
    consumeKey('Escape');
  }
}

function drawStar(ctx, cx, cy, color) {
  ctx.fillStyle = color;
  // Estrella 5 puntas pixelada (~14×14)
  ctx.fillRect(cx - 1, cy - 7, 2, 2);   // punta superior
  ctx.fillRect(cx - 2, cy - 5, 4, 2);
  ctx.fillRect(cx - 7, cy - 3, 14, 2);  // brazos horizontales
  ctx.fillRect(cx - 6, cy - 1, 12, 2);
  ctx.fillRect(cx - 4, cy + 1, 3, 2);
  ctx.fillRect(cx + 1, cy + 1, 3, 2);
  ctx.fillRect(cx - 5, cy + 3, 3, 2);   // pies
  ctx.fillRect(cx + 2, cy + 3, 3, 2);
}

export function drawAchievementsScreen(ctx) {
  ctx.fillStyle = PAL.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = PAL.trainYellow;
  ctx.font = 'bold 28px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('LOGROS', canvas.width / 2, 80);

  const padding = 60;
  const rowH = 56;
  const startY = 130;

  for (let i = 0; i < ACHIEVEMENTS.length; i++) {
    const a = ACHIEVEMENTS[i];
    // Re-evaluar estado de desbloqueo
    if (!a.unlocked && a.check && a.check(STATE)) {
      a.unlocked = true;
    }
    const unlocked = a.unlocked;

    const y = startY + i * rowH;
    const x = padding;
    const w = canvas.width - padding * 2;

    // Fondo de fila
    ctx.fillStyle = '#111';
    ctx.fillRect(x, y, w, rowH);

    // Borde inferior
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(x, y + rowH - 1, w, 1);

    // Icono (estrella) en zona 24×24 a la izquierda
    drawStar(ctx, x + 24, y + rowH / 2, unlocked ? PAL.trainYellow : '#444');

    // Título
    ctx.fillStyle = unlocked ? PAL.hud : '#666';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(a.title, x + 56, y + 22);

    // Descripción
    ctx.fillStyle = '#888';
    ctx.font = '11px monospace';
    ctx.fillText(a.description, x + 56, y + 40);

    // Estado a la derecha
    ctx.textAlign = 'right';
    if (unlocked) {
      ctx.fillStyle = PAL.trainYellow;
      ctx.font = 'bold 11px monospace';
      ctx.fillText('✓ CONSEGUIDO', x + w - 16, y + rowH / 2 + 4);
    } else {
      ctx.fillStyle = '#555';
      ctx.font = '11px monospace';
      ctx.fillText('bloqueado', x + w - 16, y + rowH / 2 + 4);
    }
  }

  // Pista inferior
  ctx.fillStyle = '#888';
  ctx.font = '11px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('ESC VOLVER', canvas.width / 2, canvas.height - 30);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}
