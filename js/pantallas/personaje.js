// Selector de personaje — muestra preview, estado de desbloqueo y progreso

import { canvas, STATE, PAL, CHARACTERS } from '../mecanica/estado.js';
import { formatFlightTime, checkUnlocks, loadCharacterProgress } from '../mecanica/progreso.js';

let charCursor = STATE.selectedCharacter;
let _denyFlash = 0;   // frames de parpadeo rojo al intentar seleccionar bloqueado

// ── Inicialización ────────────────────────────────────────────────────────────
export function initCharacterScreen() {
  loadCharacterProgress();
  checkUnlocks();
  charCursor = STATE.selectedCharacter;
  _denyFlash = 0;
}

// ── Input ─────────────────────────────────────────────────────────────────────
export function handleCharacterInput(keys, consumeKey) {
  // Decrementar flash de denegación
  if (_denyFlash > 0) _denyFlash--;

  if (keys['ArrowLeft'] || keys['a']) {
    charCursor = Math.max(0, charCursor - 1);
    consumeKey('ArrowLeft');
    consumeKey('a');
  }
  if (keys['ArrowRight'] || keys['d']) {
    charCursor = Math.min(CHARACTERS.length - 1, charCursor + 1);
    consumeKey('ArrowRight');
    consumeKey('d');
  }
  if (keys['Enter'] || keys[' ']) {
    if (CHARACTERS[charCursor].unlocked) {
      STATE.selectedCharacter = charCursor;
      STATE.phase = 'START';
    } else {
      // Personaje bloqueado: flash de denegación, no salir
      _denyFlash = 30;
    }
    consumeKey('Enter');
    consumeKey(' ');
  }
  if (keys['Escape']) {
    charCursor = STATE.selectedCharacter;
    STATE.phase = 'START';
    consumeKey('Escape');
  }
}

// ── Helpers de dibujo ─────────────────────────────────────────────────────────
function drawLeftArrow(ctx, cx, cy) {
  ctx.fillStyle = PAL.trainYellow;
  ctx.fillRect(cx,     cy - 5, 2, 10);
  ctx.fillRect(cx - 2, cy - 4, 2,  8);
  ctx.fillRect(cx - 4, cy - 2, 2,  4);
  ctx.fillRect(cx - 6, cy - 1, 2,  2);
}

function drawRightArrow(ctx, cx, cy) {
  ctx.fillStyle = PAL.trainYellow;
  ctx.fillRect(cx - 2, cy - 5, 2, 10);
  ctx.fillRect(cx,     cy - 4, 2,  8);
  ctx.fillRect(cx + 2, cy - 2, 2,  4);
  ctx.fillRect(cx + 4, cy - 1, 2,  2);
}

function drawPadlock(ctx, cx, cy) {
  ctx.fillStyle = '#666';
  ctx.fillRect(cx - 4, cy - 8, 8, 2);
  ctx.fillRect(cx - 5, cy - 7, 2, 5);
  ctx.fillRect(cx + 3, cy - 7, 2, 5);
  ctx.fillRect(cx - 7, cy - 2, 14, 10);
  ctx.fillStyle = '#222';
  ctx.fillRect(cx - 1, cy + 1, 2, 4);
}

// ── Render ────────────────────────────────────────────────────────────────────
export function drawCharacterScreen(ctx) {
  // Fondo
  ctx.fillStyle = PAL.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Título
  ctx.fillStyle = PAL.trainYellow;
  ctx.font = 'bold 28px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('PERSONAJE', canvas.width / 2, 80);

  // Caja de preview
  const boxSize = 96;
  const cx = canvas.width / 2;
  const cy = canvas.height / 2 - 20;

  ctx.fillStyle = '#0a0a14';
  ctx.fillRect(cx - boxSize / 2, cy - boxSize / 2, boxSize, boxSize);
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1;
  ctx.strokeRect(cx - boxSize / 2 + 0.5, cy - boxSize / 2 + 0.5, boxSize - 1, boxSize - 1);

  const char = CHARACTERS[charCursor];

  if (char.unlocked) {
    // drawPreview aplica su propio scale interno (2×); personaje.js añade 1.5×
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1.5, 1.5);
    char.drawPreview(ctx, 0, 0);
    ctx.restore();
  } else {
    // Silueta oscura
    ctx.fillStyle = '#222233';
    ctx.fillRect(cx - boxSize / 2 + 4, cy - boxSize / 2 + 4, boxSize - 8, boxSize - 8);
    drawPadlock(ctx, cx, cy - 8);

    // Pista de desbloqueo
    if (char.hint) {
      ctx.fillStyle = '#F39200';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(char.hint, cx, cy + boxSize / 2 - 32);
    }

    // Barra de progreso (sólo si hay condición cuantificable — Pidgey: 300 s)
    const progress300 = Math.min(1, STATE.totalPlaySeconds / 300);
    const barW = 140, barH = 4;
    const barX = cx - barW / 2;
    const barY = cy + boxSize / 2 - 24;
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = '#F39200';
    ctx.fillRect(barX, barY, Math.round(barW * progress300), barH);

    // Etiqueta tiempo jugado / objetivo
    const elapsed = formatFlightTime(STATE.totalPlaySeconds);
    ctx.fillStyle = '#888899';
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${elapsed} / 05:00`, cx, barY + barH + 12);
  }

  // Flash de denegación — overlay rojo sobre la caja
  if (_denyFlash > 0) {
    const alpha = (_denyFlash / 30) * 0.45;
    ctx.fillStyle = `rgba(200,0,0,${alpha})`;
    ctx.fillRect(cx - boxSize / 2, cy - boxSize / 2, boxSize, boxSize);
  }

  // Nombre
  ctx.fillStyle = char.unlocked ? PAL.trainYellow : '#666';
  ctx.font = 'bold 18px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(char.unlocked ? char.name : '???', cx, cy + boxSize / 2 + 28);

  // Descripción
  ctx.fillStyle = '#aaa';
  ctx.font = '12px monospace';
  ctx.fillText(char.unlocked ? char.description : 'Bloqueado', cx, cy + boxSize / 2 + 48);

  // Flechas de navegación
  if (CHARACTERS.length > 1) {
    if (charCursor > 0) drawLeftArrow(ctx, cx - boxSize / 2 - 28, cy);
    if (charCursor < CHARACTERS.length - 1) drawRightArrow(ctx, cx + boxSize / 2 + 28, cy);
  }

  // Pie de pantalla
  ctx.fillStyle = '#888';
  ctx.font = '11px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('ENTER ELEGIR  ESC VOLVER', canvas.width / 2, canvas.height - 30);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}
