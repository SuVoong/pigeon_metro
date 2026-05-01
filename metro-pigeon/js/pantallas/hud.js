// HUD en pantalla durante el juego: marcador, vidas, stun y flash de impacto.

import { canvas, STATE, pigeon, PAL } from '../mecanica/estado.js';

export function drawHUD(ctx) {
  const cw = canvas.width;

  // ── Panel fondo superior (semitransparente) ───────────────────────────────
  ctx.fillStyle = 'rgba(0,0,0,0.38)';
  ctx.fillRect(0, 0, cw, 36);

  // ── SCORE ─────────────────────────────────────────────────────────────────
  ctx.fillStyle = '#f5c518';
  ctx.font = 'bold 13px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('SCORE', 12, 18);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 15px monospace';
  ctx.fillText(String(Math.floor(STATE.score)).padStart(6, '0'), 70, 18);

  // ── VELOCIDAD (multiplicador centrado) ────────────────────────────────────
  const speedMult = (STATE.speed / 2).toFixed(1);
  const sm   = Math.min(1, (STATE.speed - 2) / 4);
  const sr   = Math.round(255);
  const sg   = Math.round(255 * (1 - sm));
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = `rgb(${sr},${sg},${Math.round(80 * (1 - sm))})`;
  ctx.fillText(`×${speedMult}`, cw / 2, 18);

  // ── VIDAS: iconos de paloma pixel-art (escala 2×) ────────────────────────
  const maxLives = 3;
  for (let i = 0; i < maxLives; i++) {
    const alive = i < STATE.lives;
    const ix    = cw - 18 - i * 22;
    const iy    = 10;

    const blink = !alive
      || (pigeon.invincible > 0 && pigeon.stunned === 0 && i === STATE.lives - 1
          ? Math.floor(STATE.frame / 4) % 2 === 0 : false);
    if (blink) continue;

    ctx.fillStyle = alive ? PAL.pigeonBody : '#2a2a2a';
    ctx.fillRect(ix,     iy + 2, 6, 5);

    ctx.fillStyle = alive ? '#9AABBB' : '#222';
    ctx.fillRect(ix + 3, iy,     4, 4);

    ctx.fillStyle = alive ? PAL.pigeonWing : '#1a1a1a';
    ctx.fillRect(ix - 2, iy + 3, 4, 2);

    if (alive) {
      ctx.fillStyle = '#cc2200';
      ctx.fillRect(ix + 5, iy + 1, 1, 1);
    }

    ctx.fillStyle = alive ? '#aabbcc' : '#1a1a1a';
    ctx.fillRect(ix,     iy + 6, 3, 2);
  }

  // ── INDICADOR DE STUN (barra horizontal bajo la paloma) ──────────────────
  if (pigeon.stunned > 0) {
    const barW  = 60;
    const barH  = 4;
    const barX  = cw / 2 - barW / 2;
    const barY  = canvas.height / 2 + 26;
    const frac  = pigeon.stunned / 30;

    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);

    const r = Math.round(245 + (1 - frac) * 10);
    const g = Math.round(197 * frac);
    ctx.fillStyle = `rgb(${r},${g},24)`;
    ctx.fillRect(barX, barY, Math.round(barW * frac), barH);

    ctx.fillStyle = `rgba(255,220,50,${0.7 + frac * 0.3})`;
    ctx.font = 'bold 8px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('✦ ATURDIDA ✦', cw / 2, barY - 8);
  }

  // ── FLASH ROJO en impacto (primeros 4 frames del stun) ───────────────────
  if (pigeon.stunned > 26) {
    const alpha = (pigeon.stunned - 26) / 4 * 0.35;
    ctx.fillStyle = `rgba(220,40,40,${alpha})`;
    ctx.fillRect(0, 0, cw, canvas.height);
  }

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}
