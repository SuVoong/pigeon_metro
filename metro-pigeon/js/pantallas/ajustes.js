// Pantalla de ajustes — con acceso al modo edición

import { canvas, STATE, PAL } from '../mecanica/estado.js';
import { showLoginScreen } from '../editor/auth.js';

// ── Botón MODO EDICIÓN ────────────────────────────────────────────────────────
// Coordenadas calculadas en drawSettingsScreen para que el input pueda usarlas
let _editBtnBounds = { x: 0, y: 0, w: 0, h: 0 };

export function handleSettingsInput(keys, consumeKey, mouse) {
  if (keys['Escape']) {
    STATE.phase = 'START';
    consumeKey('Escape');
    return;
  }

  // Shortcut 'e' → abrir login
  if (keys['e']) {
    showLoginScreen();
    consumeKey('e');
    return;
  }

  // Click en el botón MODO EDICIÓN
  if (mouse?.clicked) {
    const b = _editBtnBounds;
    if (mouse.x >= b.x && mouse.x < b.x + b.w &&
        mouse.y >= b.y && mouse.y < b.y + b.h) {
      showLoginScreen();
      mouse.clicked = false;
    }
  }
}

export function drawSettingsScreen(ctx) {
  // Forzar cursor visible en esta pantalla. Otras pantallas (inicio,
  // arcade en gameplay, etc.) pueden haberlo dejado como 'none' o 'grab';
  // ajustes es una pantalla clásica de menú donde el ratón siempre se ve.
  canvas.style.cursor = 'default';

  ctx.fillStyle = PAL.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = PAL.trainYellow;
  ctx.font = 'bold 28px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('AJUSTES', canvas.width / 2, 80);

  ctx.fillStyle = '#888';
  ctx.font = '14px monospace';
  ctx.textBaseline = 'middle';
  ctx.fillText('Próximamente', canvas.width / 2, canvas.height / 2 - 40);

  // ── Botón MODO EDICIÓN ────────────────────────────────────────────────────
  const btnW  = 220;
  const btnH  = 36;
  const btnX  = Math.round(canvas.width / 2 - btnW / 2);
  const btnY  = Math.round(canvas.height / 2 + 10);

  _editBtnBounds = { x: btnX, y: btnY, w: btnW, h: btnH };

  // Button background + border
  ctx.fillStyle = 'rgba(245,197,24,0.08)';
  ctx.fillRect(btnX, btnY, btnW, btnH);
  ctx.strokeStyle = '#555';
  ctx.lineWidth = 1;
  ctx.strokeRect(btnX + 0.5, btnY + 0.5, btnW - 1, btnH - 1);

  // Button text
  ctx.fillStyle = '#888';
  ctx.font = '13px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('⚙  MODO EDICIÓN  →', canvas.width / 2, btnY + btnH / 2);

  // Hint
  ctx.fillStyle = '#444';
  ctx.font = '10px monospace';
  ctx.fillText('Acceso con contraseña · tecla E', canvas.width / 2, btnY + btnH + 14);

  // Footer
  ctx.fillStyle = '#888';
  ctx.font = '11px monospace';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('ESC VOLVER', canvas.width / 2, canvas.height - 30);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}
