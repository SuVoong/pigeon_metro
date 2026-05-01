// Pantalla de inicio: menú principal, vista previa de personaje, icono de ajustes

import { canvas, STATE, PAL, CHARACTERS } from '../mecanica/estado.js';

const MENU_ITEMS = [
  { label: 'MODO ARCADE',   phase: 'ARCADE'       },
  { label: 'MODO HISTORIA', phase: 'HISTORY'      },
  { label: 'PERSONAJE',     phase: 'CHARACTER'    },
  { label: 'LOGROS',        phase: 'ACHIEVEMENTS' },
];

// Posición del ratón sobre el canvas para hover del icono de ajustes
let mouseX = -999, mouseY = -999;
let listenersAttached = false;

function gearCenter() {
  return { x: canvas.width - 44 + 7, y: 28 + 7 };
}

function ensureListeners() {
  if (listenersAttached) return;
  listenersAttached = true;

  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouseX = e.clientX - r.left;
    mouseY = e.clientY - r.top;
    // Sólo gestionamos el cursor cuando estamos en la pantalla START.
    // En el resto de pantallas (ARCADE, SETTINGS, etc.) cada una decide
    // su propio cursor; aquí no debemos forzar 'none' o lo ocultaríamos.
    if (STATE.phase === 'START') {
      const g = gearCenter();
      const dx = mouseX - g.x, dy = mouseY - g.y;
      canvas.style.cursor = (dx * dx + dy * dy <= 22 * 22) ? 'pointer' : 'default';
    }
  });

  canvas.addEventListener('mousedown', (e) => {
    if (STATE.phase !== 'START') return;
    const r = canvas.getBoundingClientRect();
    const mx = e.clientX - r.left;
    const my = e.clientY - r.top;
    const g = gearCenter();
    const dx = mx - g.x, dy = my - g.y;
    if (dx * dx + dy * dy <= 22 * 22) {
      STATE.phase = 'SETTINGS';
    }
  });
}

export function handleStartInput(keys, consumeKey) {
  ensureListeners();

  if (keys['ArrowUp'] || keys['w']) {
    STATE.menuCursor = Math.max(0, STATE.menuCursor - 1);
    consumeKey('ArrowUp');
    consumeKey('w');
  }
  if (keys['ArrowDown'] || keys['s']) {
    STATE.menuCursor = Math.min(MENU_ITEMS.length - 1, STATE.menuCursor + 1);
    consumeKey('ArrowDown');
    consumeKey('s');
  }
  if (keys['Enter'] || keys[' ']) {
    STATE.phase = MENU_ITEMS[STATE.menuCursor].phase;
    consumeKey('Enter');
    consumeKey(' ');
  }
}

function drawGear(ctx, cx, cy, color) {
  ctx.fillStyle = color;
  // Círculo central 6×6
  ctx.fillRect(cx - 3, cy - 3, 6, 6);
  // 8 dientes (2×2) en N, NE, E, SE, S, SW, W, NW
  ctx.fillRect(cx - 1, cy - 7, 2, 2);
  ctx.fillRect(cx + 4, cy - 6, 2, 2);
  ctx.fillRect(cx + 5, cy - 1, 2, 2);
  ctx.fillRect(cx + 4, cy + 4, 2, 2);
  ctx.fillRect(cx - 1, cy + 5, 2, 2);
  ctx.fillRect(cx - 6, cy + 4, 2, 2);
  ctx.fillRect(cx - 7, cy - 1, 2, 2);
  ctx.fillRect(cx - 6, cy - 6, 2, 2);
}

function drawArrow(ctx, x, y) {
  ctx.fillStyle = PAL.trainYellow;
  // Triángulo pixelado apuntando a la derecha (▶)
  ctx.fillRect(x,     y,     2, 6);
  ctx.fillRect(x + 2, y + 1, 2, 4);
  ctx.fillRect(x + 4, y + 2, 2, 2);
}

export function drawStartScreen(ctx) {
  ensureListeners();

  // Fondo
  ctx.fillStyle = PAL.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Scanlines suaves cada 4px
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  for (let y = 0; y < canvas.height; y += 4) {
    ctx.fillRect(0, y, canvas.width, 1);
  }

  // Título (dos líneas con sombra)
  ctx.fillStyle = PAL.trainYellow;
  ctx.font = 'bold 52px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = 'rgba(245, 197, 24, 0.45)';
  ctx.shadowBlur = 18;
  ctx.fillText('VIAJE',    60, 90);
  ctx.fillText('PALOMERO', 60, 152);
  ctx.shadowBlur = 0;

  // Subtítulo
  ctx.fillStyle = '#888';
  ctx.font = '13px monospace';
  ctx.fillText('pixel metro adventure', 60, 172);

  // Icono de ajustes (engranaje, esquina sup. derecha)
  const g = gearCenter();
  const dgx = mouseX - g.x, dgy = mouseY - g.y;
  const gearHover = (dgx * dgx + dgy * dgy) <= 22 * 22;
  drawGear(ctx, g.x, g.y, gearHover ? '#ccc' : '#888');

  // Botones del menú
  for (let i = 0; i < MENU_ITEMS.length; i++) {
    const x = 60;
    const y = 200 + i * 46;
    const w = 200, h = 36;
    const selected = i === STATE.menuCursor;

    ctx.fillStyle = selected ? 'rgba(245,197,24,0.08)' : '#111';
    ctx.fillRect(x, y, w, h);

    ctx.strokeStyle = selected ? PAL.trainYellow : PAL.concrete;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

    ctx.fillStyle = selected ? PAL.trainYellow : PAL.hud;
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(MENU_ITEMS[i].label, x + 16, y + h / 2);

    if (selected) {
      drawArrow(ctx, 46, y + h / 2 - 3);
    }
  }

  // Vista previa de personaje (esquina inf. derecha)
  const previewCX = canvas.width - 150;
  const previewY = canvas.height - 170;
  const boxSize = 120;

  ctx.fillStyle = '#888';
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('PERSONAJE', previewCX, previewY - 8);

  ctx.fillStyle = '#0a0a14';
  ctx.fillRect(previewCX - boxSize / 2, previewY, boxSize, boxSize);
  ctx.shadowColor = 'rgba(245, 197, 24, 0.3)';
  ctx.shadowBlur = 14;
  ctx.strokeStyle = PAL.trainYellow;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(previewCX - boxSize / 2 + 0.75, previewY + 0.75, boxSize - 1.5, boxSize - 1.5);
  ctx.shadowBlur = 0;

  const char = CHARACTERS[STATE.selectedCharacter];
  // drawPreview tiene escala 2× interna; aplicamos 2× externa → escala efectiva 4×
  ctx.save();
  ctx.translate(previewCX, previewY + boxSize / 2);
  ctx.scale(2, 2);
  char.drawPreview(ctx, 0, 0);
  ctx.restore();

  ctx.fillStyle = PAL.trainYellow;
  ctx.font = 'bold 13px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(char.name, previewCX, previewY + boxSize + 18);

  // Pista de controles parpadeante (esquina inf. izquierda)
  if (Math.floor(STATE.frame / 40) % 2 === 0) {
    ctx.fillStyle = '#888';
    ctx.font = '11px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('UP/DOWN NAVEGAR  ENTER SELECCIONAR', 60, canvas.height - 30);
  }

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}
