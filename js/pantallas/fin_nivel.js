// pantallas/fin_nivel.js
// Pantalla de FIN DE NIVEL — aparece cuando Linea3.isFinished == true
// (la paloma ha llegado al terminal de la dirección elegida).
//
// Ofrece dos opciones:
//   1) DAR LA VUELTA — reinicia la partida desde el terminal alcanzado en
//      la dirección opuesta. Conserva el preset (dificultad) activo.
//   2) TERMINAR     — vuelve al mapa arcade.
//
// La pantalla NO modifica el render del juego: queda congelado el último
// frame de Linea3 (techo + andenes + tren del terminal), encima va el popup.

import { canvas, STATE } from '../mecanica/estado.js';
import { Linea3 }        from '../escenarios/metro_madrid/linea_3/linea_3.js';
import { checkUnlocks, saveAchievements } from '../mecanica/progreso.js';

let _rects = [];   // [{x, y, w, h, action}]

// ── Helpers de geometría ─────────────────────────────────────────────────────
function _roundRect(ctx, x, y, w, h, r) {
  if (ctx.roundRect) {
    ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
  } else {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
}

// ── Acciones ─────────────────────────────────────────────────────────────────

/** Dar la vuelta: nueva partida desde el terminal alcanzado, dirección opuesta. */
function _turnAround() {
  // Contador de "dar la vuelta" → desbloquea el logro U_TURNER.
  STATE.uTurnsCount = (STATE.uTurnsCount ?? 0) + 1;
  saveAchievements();
  checkUnlocks();
  // Configurar STATE para que Linea3.init() arranque correctamente.
  STATE.selectedStartStationIndex = Linea3.getLastIndex();
  STATE.selectedDirection         = Linea3.getOppositeDir();
  // El gate de transición a PLAYING en main.js (cuando phase != PAUSED) llama
  // a startNewGame(), que reinicia el escenario con el nuevo STATE.
  STATE.phase = 'PLAYING';
}

/** Terminar: vuelta al mapa arcade. */
function _finishToArcade() {
  STATE.phase = 'ARCADE';
}

// ── Input ────────────────────────────────────────────────────────────────────
export function handleLevelCompleteInput(keys, consumeKey, mouse) {
  // 1 / Enter / Espacio → dar la vuelta (acción primaria)
  if (keys['1'] || keys['Enter'] || keys[' ']) {
    consumeKey('1'); consumeKey('Enter'); consumeKey(' ');
    _turnAround();
    return;
  }
  // 2 / Esc / Q → terminar
  if (keys['2'] || keys['Escape'] || keys['q'] || keys['Q']) {
    consumeKey('2'); consumeKey('Escape'); consumeKey('q'); consumeKey('Q');
    _finishToArcade();
    return;
  }
  // Clic
  if (mouse?.clicked) {
    for (const rc of _rects) {
      if (mouse.x >= rc.x && mouse.x <= rc.x + rc.w &&
          mouse.y >= rc.y && mouse.y <= rc.y + rc.h) {
        if (rc.action === 'turn')   _turnAround();
        else if (rc.action === 'end') _finishToArcade();
        return;
      }
    }
  }
}

// ── Render ───────────────────────────────────────────────────────────────────
export function drawLevelCompleteScreen(ctx, mouse) {
  _rects = [];

  // Telón oscuro
  ctx.fillStyle = 'rgba(0,0,0,0.72)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const W  = 380;
  const H  = 220;
  const tx = Math.round(canvas.width  / 2 - W / 2);
  const ty = Math.round(canvas.height / 2 - H / 2);

  // Caja
  ctx.fillStyle = '#0d0d22';
  _roundRect(ctx, tx, ty, W, H, 12); ctx.fill();
  ctx.strokeStyle = '#5DCAA5'; ctx.lineWidth = 2;
  _roundRect(ctx, tx, ty, W, H, 12); ctx.stroke();

  // Título
  ctx.fillStyle    = '#5DCAA5';
  ctx.font         = 'bold 18px monospace';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🏁 LÍNEA COMPLETADA', tx + W / 2, ty + 28);

  // Subtítulo: estación final alcanzada
  const last = Linea3.currentStation || '';
  ctx.fillStyle = '#ffffff';
  ctx.font      = 'bold 12px monospace';
  ctx.fillText(`HAS LLEGADO A ${last.toUpperCase()}`, tx + W / 2, ty + 56);

  // Texto descriptivo
  ctx.fillStyle = '#aaaabb';
  ctx.font      = '10px monospace';
  ctx.fillText('¿Quieres seguir jugando?', tx + W / 2, ty + 78);

  // ── Opción 1: Dar la vuelta (verde, acción primaria) ─────────────────────
  const btnW = 320;
  const btnH = 42;
  const bx   = tx + (W - btnW) / 2;
  const by1  = ty + 100;
  const hov1 = mouse && mouse.x >= bx && mouse.x <= bx + btnW &&
                        mouse.y >= by1 && mouse.y <= by1 + btnH;

  ctx.fillStyle = hov1 ? '#5DCAA5' : 'rgba(93,202,165,0.18)';
  _roundRect(ctx, bx, by1, btnW, btnH, 6); ctx.fill();
  ctx.strokeStyle = '#5DCAA5'; ctx.lineWidth = 1.5;
  _roundRect(ctx, bx, by1, btnW, btnH, 6); ctx.stroke();

  ctx.fillStyle    = hov1 ? '#0d0d22' : '#5DCAA5';
  ctx.font         = 'bold 13px monospace';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('↩  DAR LA VUELTA', bx + btnW / 2, by1 + btnH / 2 - 4);
  ctx.font         = '9px monospace';
  ctx.fillStyle    = hov1 ? '#0d0d22' : '#88bba0';
  ctx.fillText('[1] · [ENTER]', bx + btnW / 2, by1 + btnH / 2 + 11);

  _rects.push({ x: bx, y: by1, w: btnW, h: btnH, action: 'turn' });

  // ── Opción 2: Terminar (rojo, acción secundaria) ─────────────────────────
  const by2  = ty + 152;
  const hov2 = mouse && mouse.x >= bx && mouse.x <= bx + btnW &&
                        mouse.y >= by2 && mouse.y <= by2 + btnH;

  ctx.fillStyle = hov2 ? '#cc4444' : 'rgba(204,68,68,0.18)';
  _roundRect(ctx, bx, by2, btnW, btnH, 6); ctx.fill();
  ctx.strokeStyle = '#cc4444'; ctx.lineWidth = 1.5;
  _roundRect(ctx, bx, by2, btnW, btnH, 6); ctx.stroke();

  ctx.fillStyle    = hov2 ? '#ffffff' : '#cc4444';
  ctx.font         = 'bold 13px monospace';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('✕  TERMINAR', bx + btnW / 2, by2 + btnH / 2 - 4);
  ctx.font         = '9px monospace';
  ctx.fillStyle    = hov2 ? '#ffffff' : '#aa6666';
  ctx.fillText('[2] · [ESC] · [Q]', bx + btnW / 2, by2 + btnH / 2 + 11);

  _rects.push({ x: bx, y: by2, w: btnW, h: btnH, action: 'end' });

  // Restaurar estado
  ctx.textAlign    = 'left';
  ctx.textBaseline = 'alphabetic';
}
