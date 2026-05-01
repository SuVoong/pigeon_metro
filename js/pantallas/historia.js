// Modo historia — placeholder con todo bloqueado por ahora

import { canvas, STATE, PAL } from '../mecanica/estado.js';

const SCENARIOS = [
  { id: 'cap1', name: 'CAPÍTULO 1', label: 'Próximamente', locked: true },
  { id: 'cap2', name: 'CAPÍTULO 2', label: 'Próximamente', locked: true },
];

const cursor = 0; // sin navegación, sólo visual

export function handleHistoriaInput(keys, consumeKey) {
  if (keys['Escape']) {
    STATE.phase = 'START';
    consumeKey('Escape');
  }
}

function drawPadlock(ctx, cx, cy) {
  ctx.fillStyle = '#666';
  ctx.fillRect(cx - 3, cy - 6, 6, 2);
  ctx.fillRect(cx - 4, cy - 5, 1, 4);
  ctx.fillRect(cx + 3, cy - 5, 1, 4);
  ctx.fillRect(cx - 5, cy - 1, 10, 7);
  ctx.fillStyle = '#222';
  ctx.fillRect(cx - 1, cy + 1, 2, 3);
}

export function drawHistoriaScreen(ctx) {
  ctx.fillStyle = PAL.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = PAL.trainYellow;
  ctx.font = 'bold 28px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('MODO HISTORIA', canvas.width / 2, 80);

  ctx.fillStyle = '#888';
  ctx.font = '12px monospace';
  ctx.fillText('ELIGE CAPÍTULO', canvas.width / 2, 105);

  const cardW = 160, cardH = 100, gap = 24;
  const totalW = SCENARIOS.length * cardW + (SCENARIOS.length - 1) * gap;
  const startX = (canvas.width - totalW) / 2;
  const cardY = canvas.height / 2 - cardH / 2;

  for (let i = 0; i < SCENARIOS.length; i++) {
    const s = SCENARIOS[i];
    const x = startX + i * (cardW + gap);
    const selected = i === cursor;

    ctx.fillStyle = '#0a0a14';
    ctx.fillRect(x, cardY, cardW, cardH);

    ctx.strokeStyle = selected ? PAL.trainYellow : '#333';
    ctx.lineWidth = selected ? 2 : 1;
    ctx.strokeRect(x + 0.5, cardY + 0.5, cardW - 1, cardH - 1);

    drawPadlock(ctx, x + cardW / 2, cardY + cardH / 2 - 8);
    ctx.fillStyle = '#666';
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(s.name, x + cardW / 2, cardY + cardH - 26);
    ctx.fillStyle = '#555';
    ctx.font = '10px monospace';
    ctx.fillText(s.label, x + cardW / 2, cardY + cardH - 12);
  }

  ctx.fillStyle = '#888';
  ctx.font = '11px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('ESC VOLVER', canvas.width / 2, canvas.height - 30);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}
