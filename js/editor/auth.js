// auth.js — Authentication, session management, and login screen UI

import { canvas } from '../mecanica/estado.js';

// ── Roles ─────────────────────────────────────────────────────────────────────
export const ROLES = { ADMIN: 'admin', VIEWER: 'viewer' };

// ── Default credentials ───────────────────────────────────────────────────────
const DEFAULT_ADMIN  = { username: 'admin',  password: 'metro2024' };
const DEFAULT_VIEWER = { username: 'viewer', password: 'paloma'    };

// ── Session state ─────────────────────────────────────────────────────────────
let _session     = null;   // { username, role, expiresAt }
let _failCount   = 0;
let _lockedUntil = 0;

// ── Callback registered by main.js so auth.js doesn't import editor_panel.js ─
let _onLoginSuccess = null;
export function setLoginSuccessCallback(fn) { _onLoginSuccess = fn; }

// ── Core auth functions ───────────────────────────────────────────────────────

export function login(username, password) {
  const now = Date.now();
  if (_lockedUntil > now) {
    return { ok: false, error: 'Bloqueado', remainingMs: _lockedUntil - now };
  }

  const creds = _loadCredentials();

  if (username === creds.admin.username && password === creds.admin.password) {
    _session = { username, role: ROLES.ADMIN, expiresAt: now + 2 * 60 * 60 * 1000 };
    _failCount = 0;
    _saveSession();
    return { ok: true, role: ROLES.ADMIN };
  }

  if (username === creds.viewer.username && password === creds.viewer.password) {
    _session = { username, role: ROLES.VIEWER, expiresAt: now + 30 * 60 * 1000 };
    _failCount = 0;
    _saveSession();
    return { ok: true, role: ROLES.VIEWER };
  }

  _failCount++;
  if (_failCount >= 3) {
    _lockedUntil = now + 5 * 60 * 1000;
    _failCount   = 0;
    return { ok: false, error: 'Demasiados intentos. Bloqueado 5 min.', attempts: 0 };
  }
  return { ok: false, error: 'Credenciales incorrectas', attempts: _failCount };
}

export function logout() {
  _session = null;
  try { localStorage.removeItem('vp_session'); } catch (_) { /* */ }
}

export function getSession() {
  if (!_session) {
    // Try to restore from localStorage
    try {
      const raw = localStorage.getItem('vp_session');
      if (raw) _session = JSON.parse(raw);
    } catch (_) { /* */ }
  }
  if (!_session) return null;
  if (_session.expiresAt < Date.now()) { logout(); return null; }
  return { username: _session.username, role: _session.role };
}

export function isAdmin()  { return getSession()?.role === ROLES.ADMIN; }
export function isViewer() { return getSession()?.role === ROLES.VIEWER || isAdmin(); }
export function isLocked() {
  const now = Date.now();
  return { locked: _lockedUntil > now, remainingMs: Math.max(0, _lockedUntil - now) };
}

export function changeCredentials(adminPass, newUsername, newPassword, newRole) {
  if (!isAdmin()) return { ok: false, error: 'Sin permisos' };
  const creds = _loadCredentials();
  if (adminPass !== creds.admin.password) return { ok: false, error: 'Contraseña de admin incorrecta' };
  if (newRole === ROLES.ADMIN) {
    creds.admin = { username: newUsername, password: newPassword };
  } else {
    creds.viewer = { username: newUsername, password: newPassword };
  }
  try {
    localStorage.setItem('vp_credentials', JSON.stringify(creds));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// ── Login screen state ────────────────────────────────────────────────────────
let _loginMode      = false;
let _usernameInput  = '';
let _passwordInput  = '';
let _activeField    = 'username';  // 'username' | 'password'
let _errorMsg       = '';
let _errorFrames    = 0;
let _cursorBlink    = 0;           // increments each draw call for blinking cursor

export function showLoginScreen() { _loginMode = true; _usernameInput = ''; _passwordInput = ''; _activeField = 'username'; _errorMsg = ''; _errorFrames = 0; }
export function hideLoginScreen() { _loginMode = false; }
export function isLoginModeActive() { return _loginMode; }

// ── Login screen render ───────────────────────────────────────────────────────
export function drawLoginScreen(ctx) {
  if (!_loginMode) return;

  _cursorBlink++;

  const cw = canvas.width, ch = canvas.height;

  // Dark overlay
  ctx.fillStyle = 'rgba(0,0,0,0.78)';
  ctx.fillRect(0, 0, cw, ch);

  // Card dimensions
  const cardW = 260, cardH = 240;
  const cardX = Math.round(cw / 2 - cardW / 2);
  const cardY = Math.round(ch / 2 - cardH / 2);

  // Card background
  ctx.fillStyle = '#0d0d1a';
  ctx.fillRect(cardX, cardY, cardW, cardH);
  ctx.strokeStyle = '#f5c518';
  ctx.lineWidth = 1;
  ctx.strokeRect(cardX + 0.5, cardY + 0.5, cardW - 1, cardH - 1);
  // Top accent
  ctx.fillStyle = '#f5c518';
  ctx.fillRect(cardX, cardY, cardW, 3);

  // Title
  ctx.fillStyle = '#f5c518';
  ctx.font = 'bold 15px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('⚙ MODO EDICIÓN', cw / 2, cardY + 30);

  // Subtitle
  ctx.fillStyle = '#666';
  ctx.font = '10px monospace';
  ctx.fillText('Acceso restringido', cw / 2, cardY + 46);

  // --- Input fields ---
  const fieldX = cardX + 20;
  const fieldW = cardW - 40;
  const fieldH = 20;

  // Username label + field
  ctx.fillStyle = '#aaa';
  ctx.font = '10px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('USUARIO', fieldX, cardY + 70);

  const uFocused = _activeField === 'username';
  ctx.fillStyle = uFocused ? '#1a1a30' : '#111';
  ctx.fillRect(fieldX, cardY + 74, fieldW, fieldH);
  ctx.strokeStyle = uFocused ? '#f5c518' : '#333';
  ctx.lineWidth = 1;
  ctx.strokeRect(fieldX + 0.5, cardY + 74.5, fieldW - 1, fieldH - 1);

  ctx.fillStyle = '#fff';
  ctx.font = '11px monospace';
  const uDisplay = _usernameInput + (uFocused && _cursorBlink % 60 < 30 ? '|' : '');
  ctx.fillText(uDisplay, fieldX + 4, cardY + 74 + 14);

  // Password label + field
  ctx.fillStyle = '#aaa';
  ctx.font = '10px monospace';
  ctx.fillText('CONTRASEÑA', fieldX, cardY + 112);

  const pFocused = _activeField === 'password';
  ctx.fillStyle = pFocused ? '#1a1a30' : '#111';
  ctx.fillRect(fieldX, cardY + 116, fieldW, fieldH);
  ctx.strokeStyle = pFocused ? '#f5c518' : '#333';
  ctx.lineWidth = 1;
  ctx.strokeRect(fieldX + 0.5, cardY + 116.5, fieldW - 1, fieldH - 1);

  ctx.fillStyle = '#fff';
  ctx.font = '11px monospace';
  const pDisplay = '•'.repeat(_passwordInput.length) + (pFocused && _cursorBlink % 60 < 30 ? '|' : '');
  ctx.fillText(pDisplay, fieldX + 4, cardY + 116 + 14);

  // Error message
  if (_errorFrames > 0) {
    ctx.fillStyle = _errorFrames % 10 < 5 ? '#ff4444' : '#cc2222';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(_errorMsg, cw / 2, cardY + 152);
  }

  // Lockout countdown
  const lockState = isLocked();
  if (lockState.locked) {
    const secs = Math.ceil(lockState.remainingMs / 1000);
    const mm   = String(Math.floor(secs / 60)).padStart(2, '0');
    const ss   = String(secs % 60).padStart(2, '0');
    ctx.fillStyle = '#ff6644';
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`Bloqueado ${mm}:${ss}`, cw / 2, cardY + 152);
  }

  // ENTRAR button
  const btnX = cardX + 20, btnY = cardY + 165, btnW = cardW - 40, btnH = 24;
  ctx.fillStyle = '#f5c518';
  ctx.fillRect(btnX, btnY, btnW, btnH);
  ctx.fillStyle = '#0d0d1a';
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('ENTRAR', cw / 2, btnY + btnH / 2);

  // CANCELAR link
  ctx.fillStyle = '#555';
  ctx.font = '10px monospace';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('ESC  Cancelar', cw / 2, cardY + cardH - 12);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

// ── Login screen click handling ───────────────────────────────────────────────
export function handleLoginClick(mx, my) {
  if (!_loginMode) return;
  const cw = canvas.width, ch = canvas.height;
  const cardW = 260, cardH = 240;
  const cardX = Math.round(cw / 2 - cardW / 2);
  const cardY = Math.round(ch / 2 - cardH / 2);
  const fieldX = cardX + 20, fieldW = cardW - 40, fieldH = 20;

  // Username field click
  if (_hit(mx, my, fieldX, cardY + 74, fieldW, fieldH)) { _activeField = 'username'; return; }
  // Password field click
  if (_hit(mx, my, fieldX, cardY + 116, fieldW, fieldH)) { _activeField = 'password'; return; }
  // ENTRAR button click
  const btnX = cardX + 20, btnY = cardY + 165, btnW = cardW - 40, btnH = 24;
  if (_hit(mx, my, btnX, btnY, btnW, btnH)) { _attemptLogin(); return; }
}

// ── Login screen key handling ─────────────────────────────────────────────────
export function handleLoginKey(keys, consumeKey) {
  if (!_loginMode) return;
  if (_errorFrames > 0) _errorFrames--;

  // Tab / ArrowDown → switch fields
  if (keys['Tab'] || keys['ArrowDown']) {
    _activeField = _activeField === 'username' ? 'password' : 'username';
    consumeKey('Tab'); consumeKey('ArrowDown');
  }
  if (keys['ArrowUp']) {
    _activeField = _activeField === 'password' ? 'username' : 'password';
    consumeKey('ArrowUp');
  }

  // Enter → attempt login
  if (keys['Enter']) {
    if (_activeField === 'username' && _passwordInput === '') {
      _activeField = 'password';
    } else {
      _attemptLogin();
    }
    consumeKey('Enter');
  }

  // Escape → cancel
  if (keys['Escape']) {
    hideLoginScreen();
    consumeKey('Escape');
    return;
  }

  // Backspace
  if (keys['Backspace']) {
    if (_activeField === 'username') _usernameInput = _usernameInput.slice(0, -1);
    else                             _passwordInput = _passwordInput.slice(0, -1);
    consumeKey('Backspace');
  }

  // Printable characters — key.length===1 already excludes Arrow/Enter/Escape/etc.
  for (const key of Object.keys(keys)) {
    if (!keys[key]) continue;
    if (key.length === 1 && key !== '\t') {
      if (_activeField === 'username' && _usernameInput.length < 32) _usernameInput += key;
      else if (_activeField === 'password' && _passwordInput.length < 64) _passwordInput += key;
      consumeKey(key);
    }
  }
}

// ── Internal helpers ──────────────────────────────────────────────────────────
function _attemptLogin() {
  const result = login(_usernameInput, _passwordInput);
  _passwordInput = '';  // always clear password
  if (result.ok) {
    hideLoginScreen();
    if (_onLoginSuccess) _onLoginSuccess();
  } else {
    _errorMsg    = result.error ?? 'Error';
    _errorFrames = 90;
  }
}

function _loadCredentials() {
  try {
    const raw = localStorage.getItem('vp_credentials');
    if (raw) return JSON.parse(raw);
  } catch (_) { /* */ }
  return { admin: { ...DEFAULT_ADMIN }, viewer: { ...DEFAULT_VIEWER } };
}

function _saveSession() {
  try {
    localStorage.setItem('vp_session', JSON.stringify(_session));
  } catch (_) { /* */ }
}

function _hit(mx, my, x, y, w, h) {
  return mx >= x && mx < x + w && my >= y && my < y + h;
}
