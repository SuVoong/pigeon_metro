// Pantalla de logros — lista con estado bloqueado/desbloqueado.
// Los logros están vinculados al PERFIL activo: la cabecera muestra el nick,
// y la tecla [P] abre un popup para crear / cambiar / borrar perfiles.

import { canvas, STATE, PAL } from '../mecanica/estado.js';
import { ACHIEVEMENTS, reloadProfileData } from '../mecanica/progreso.js';
import {
  getActiveProfile, listProfiles, setActiveProfile, deleteProfile,
} from '../mecanica/perfil.js';

// Estado del popup de perfiles
let _profilePopup     = false;     // visible o no
let _profileRowRects  = [];        // [{x,y,w,h, profileName, isActive}]
let _newProfileRect   = null;      // rect del botón "+ Nuevo perfil"
let _deleteRects      = [];        // [{x,y,w,h, profileName}]
let _mouseX           = -999;
let _mouseY           = -999;
let _pendingClick     = false;
let _listenersAttached = false;

// ── Listeners (se enganchan la primera vez que se entra) ─────────────────────
function _ensureListeners() {
  if (_listenersAttached) return;
  _listenersAttached = true;

  canvas.addEventListener('mousemove', (e) => {
    if (STATE.phase !== 'ACHIEVEMENTS') return;
    const r = canvas.getBoundingClientRect();
    _mouseX = e.clientX - r.left;
    _mouseY = e.clientY - r.top;
  });

  canvas.addEventListener('mousedown', (e) => {
    if (STATE.phase !== 'ACHIEVEMENTS' || e.button !== 0) return;
    _pendingClick = true;
  });
}

// ── Input ────────────────────────────────────────────────────────────────────
export function handleAchievementsInput(keys, consumeKey) {
  _ensureListeners();

  // Popup de perfiles abierto: bloquea el resto del input
  if (_profilePopup) {
    if (keys['Escape'] || keys['q'] || keys['Q'] || keys['p'] || keys['P']) {
      consumeKey('Escape'); consumeKey('q'); consumeKey('Q');
      consumeKey('p'); consumeKey('P');
      _profilePopup = false;
      return;
    }
    // Atajos numéricos 1-9 → seleccionar perfil
    for (let i = 0; i < _profileRowRects.length && i < 9; i++) {
      const k = String(i + 1);
      if (keys[k]) {
        consumeKey(k);
        _switchToProfile(_profileRowRects[i].profileName);
        return;
      }
    }
    // Tecla N → nuevo perfil
    if (keys['n'] || keys['N']) {
      consumeKey('n'); consumeKey('N');
      _promptNewProfile();
      return;
    }
    // Click en el popup
    if (_pendingClick) {
      _pendingClick = false;
      // ¿clic en botón de borrar?
      for (const rc of _deleteRects) {
        if (_hit(_mouseX, _mouseY, rc)) {
          _confirmAndDelete(rc.profileName);
          return;
        }
      }
      // ¿clic en una fila de perfil?
      for (const rc of _profileRowRects) {
        if (_hit(_mouseX, _mouseY, rc)) {
          _switchToProfile(rc.profileName);
          return;
        }
      }
      // ¿clic en "+ Nuevo perfil"?
      if (_newProfileRect && _hit(_mouseX, _mouseY, _newProfileRect)) {
        _promptNewProfile();
        return;
      }
      // Click fuera → cerrar
      _profilePopup = false;
    }
    return;
  }

  // Atajo P/Tab → abrir popup de perfiles
  if (keys['p'] || keys['P']) {
    consumeKey('p'); consumeKey('P');
    _profilePopup = true;
    _pendingClick = false;
    return;
  }

  // ESC → volver al menú
  if (keys['Escape']) {
    STATE.phase = 'START';
    consumeKey('Escape');
    _pendingClick = false;
    return;
  }

  // Consumir cualquier clic suelto (no se usa fuera del popup)
  _pendingClick = false;
}

// ── Acciones ─────────────────────────────────────────────────────────────────
function _switchToProfile(name) {
  if (name === getActiveProfile()) {
    _profilePopup = false;
    return;
  }
  setActiveProfile(name);
  reloadProfileData();      // recarga logros + contadores + historial
  _profilePopup = false;
}

function _promptNewProfile() {
  // prompt() es modal del navegador — simple y efectivo.
  // eslint-disable-next-line no-alert
  const name = window.prompt('Nombre del nuevo perfil:', '');
  if (name && name.trim()) {
    setActiveProfile(name.trim());
    reloadProfileData();
    _profilePopup = false;
  }
}

function _confirmAndDelete(name) {
  if (name === 'Invitado') {
    // No se puede borrar el perfil por defecto — sólo se reinicia.
    // eslint-disable-next-line no-alert
    if (window.confirm(`¿Reiniciar el progreso del perfil "${name}"?`)) {
      deleteProfile(name);
      reloadProfileData();
    }
    return;
  }
  // eslint-disable-next-line no-alert
  if (window.confirm(`¿Borrar el perfil "${name}" y todo su progreso?`)) {
    deleteProfile(name);
    reloadProfileData();
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function _hit(mx, my, r) {
  return mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h;
}

function _drawStar(ctx, cx, cy, color) {
  ctx.fillStyle = color;
  ctx.fillRect(cx - 1, cy - 7, 2, 2);
  ctx.fillRect(cx - 2, cy - 5, 4, 2);
  ctx.fillRect(cx - 7, cy - 3, 14, 2);
  ctx.fillRect(cx - 6, cy - 1, 12, 2);
  ctx.fillRect(cx - 4, cy + 1, 3, 2);
  ctx.fillRect(cx + 1, cy + 1, 3, 2);
  ctx.fillRect(cx - 5, cy + 3, 3, 2);
  ctx.fillRect(cx + 2, cy + 3, 3, 2);
}

// ── Render ───────────────────────────────────────────────────────────────────
export function drawAchievementsScreen(ctx) {
  _ensureListeners();

  ctx.fillStyle = PAL.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Título
  ctx.fillStyle = PAL.trainYellow;
  ctx.font = 'bold 28px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('LOGROS', canvas.width / 2, 80);

  // ── Cabecera de perfil activo ──────────────────────────────────────────
  const profileName = getActiveProfile();
  const headerY     = 100;
  ctx.fillStyle = '#aaa';
  ctx.font      = '11px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`PERFIL: ${profileName}    ·    [P] CAMBIAR`, canvas.width / 2, headerY);

  // ── Lista de logros ────────────────────────────────────────────────────
  const padding = 60;
  const rowH    = 56;
  const startY  = 130;

  for (let i = 0; i < ACHIEVEMENTS.length; i++) {
    const a = ACHIEVEMENTS[i];
    if (!a.unlocked && a.check && a.check(STATE)) {
      a.unlocked = true;
    }
    const unlocked = a.unlocked;

    const y = startY + i * rowH;
    const x = padding;
    const w = canvas.width - padding * 2;

    ctx.fillStyle = '#111';
    ctx.fillRect(x, y, w, rowH);
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(x, y + rowH - 1, w, 1);

    _drawStar(ctx, x + 24, y + rowH / 2, unlocked ? PAL.trainYellow : '#444');

    ctx.fillStyle = unlocked ? PAL.hud : '#666';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(a.title, x + 56, y + 22);

    ctx.fillStyle = '#888';
    ctx.font = '11px monospace';
    ctx.fillText(a.description, x + 56, y + 40);

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
  ctx.fillText('[P] CAMBIAR PERFIL  ·  ESC VOLVER', canvas.width / 2, canvas.height - 30);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // Popup de perfiles encima de todo
  if (_profilePopup) _drawProfilePopup(ctx);
}

// ── Popup selector / gestor de perfiles ──────────────────────────────────────
function _drawProfilePopup(ctx) {
  _profileRowRects = [];
  _deleteRects     = [];
  _newProfileRect  = null;

  const profiles = listProfiles();
  const PAD       = 16;
  const ROW_H     = 36;
  const W         = 320;
  const HEADER_H  = 56;
  const NEW_BTN_H = 32;
  const FOOTER_H  = 26;
  const H         = HEADER_H + profiles.length * ROW_H + NEW_BTN_H + FOOTER_H;
  const tx        = Math.round(canvas.width  / 2 - W / 2);
  const ty        = Math.round(canvas.height / 2 - H / 2);

  // Telón
  ctx.fillStyle = 'rgba(0,0,0,0.72)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Caja
  ctx.fillStyle = '#0d0d22';
  ctx.fillRect(tx, ty, W, H);
  ctx.strokeStyle = PAL.trainYellow;
  ctx.lineWidth   = 1.5;
  ctx.strokeRect(tx + 0.5, ty + 0.5, W - 1, H - 1);

  // Cabecera
  ctx.fillStyle    = PAL.trainYellow;
  ctx.font         = 'bold 14px monospace';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('ELIGE PERFIL', tx + W / 2, ty + 22);
  ctx.fillStyle = '#888';
  ctx.font      = '10px monospace';
  ctx.fillText('Cada perfil guarda sus propios logros', tx + W / 2, ty + 40);

  // Separador
  ctx.fillStyle = '#28285a';
  ctx.fillRect(tx + PAD, ty + HEADER_H - 6, W - PAD * 2, 1);

  // Filas de perfiles
  const activeName = getActiveProfile();
  for (let i = 0; i < profiles.length; i++) {
    const name = profiles[i];
    const ry   = ty + HEADER_H + i * ROW_H;
    const rx   = tx + 6;
    const rw   = W - 12;
    const rh   = ROW_H - 4;
    const isActive = name === activeName;
    const hovered  = _hit(_mouseX, _mouseY, { x: rx, y: ry, w: rw, h: rh });

    // Fondo
    if (isActive)     { ctx.fillStyle = 'rgba(245,197,24,0.14)'; ctx.fillRect(rx, ry, rw, rh); }
    else if (hovered) { ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(rx, ry, rw, rh); }

    _profileRowRects.push({ x: rx, y: ry, w: rw, h: rh, profileName: name });

    // Atajo numérico
    ctx.fillStyle = isActive ? PAL.trainYellow : '#666';
    ctx.font      = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(String(i + 1), tx + PAD, ry + ROW_H / 2 - 2);

    // Nombre
    ctx.fillStyle = isActive ? '#ffffff' : '#ccccee';
    ctx.font      = isActive ? 'bold 12px monospace' : '12px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(name, tx + PAD + 22, ry + ROW_H / 2 - 2);

    // Marca de activo
    if (isActive) {
      ctx.fillStyle = '#5dcaa5';
      ctx.font      = 'bold 9px monospace';
      ctx.textAlign = 'right';
      ctx.fillText('✓ ACTIVO', tx + W - PAD - 22, ry + ROW_H / 2 - 2);
    }

    // Botón de borrar (X) — siempre visible salvo en el activo
    if (!isActive || name !== activeName) {
      const dx = tx + W - PAD - 12;
      const dy = ry + ROW_H / 2 - 2;
      const drect = { x: dx - 8, y: dy - 8, w: 16, h: 16, profileName: name };
      const dHov  = _hit(_mouseX, _mouseY, drect);
      ctx.fillStyle = dHov ? '#cc4444' : '#552222';
      ctx.fillRect(drect.x, drect.y, drect.w, drect.h);
      ctx.fillStyle = '#fff';
      ctx.font      = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('×', dx, dy);
      _deleteRects.push(drect);
    }
  }

  // Separador antes del botón "+ Nuevo"
  const newY = ty + HEADER_H + profiles.length * ROW_H + 4;
  ctx.fillStyle = '#28285a';
  ctx.fillRect(tx + PAD, newY - 2, W - PAD * 2, 1);

  // Botón "+ Nuevo perfil"
  const btnX = tx + PAD;
  const btnY = newY + 4;
  const btnW = W - PAD * 2;
  const btnH = NEW_BTN_H - 8;
  const btnHov = _hit(_mouseX, _mouseY, { x: btnX, y: btnY, w: btnW, h: btnH });
  ctx.fillStyle = btnHov ? '#5DCAA5' : 'rgba(93,202,165,0.18)';
  ctx.fillRect(btnX, btnY, btnW, btnH);
  ctx.strokeStyle = '#5DCAA5'; ctx.lineWidth = 1;
  ctx.strokeRect(btnX + 0.5, btnY + 0.5, btnW - 1, btnH - 1);
  ctx.fillStyle = btnHov ? '#0d0d22' : '#5DCAA5';
  ctx.font      = 'bold 11px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('+ NUEVO PERFIL  [N]', btnX + btnW / 2, btnY + btnH / 2);
  _newProfileRect = { x: btnX, y: btnY, w: btnW, h: btnH };

  // Pie
  ctx.fillStyle = '#444466';
  ctx.font      = '9px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('1-9 elegir  ·  N nuevo  ·  × borrar  ·  Q/ESC cancelar', tx + W / 2, ty + H - 10);

  ctx.textAlign    = 'left';
  ctx.textBaseline = 'alphabetic';
}
