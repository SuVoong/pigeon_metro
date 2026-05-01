// editor_panel.js — Main editor panel: tab bar, footer actions, toast

import { canvas } from '../mecanica/estado.js';
import * as auth from './auth.js';
import {
  saveTrainConfig, saveEnvConfig, saveGameConfig,
  resetToDefaults, exportConfig,
} from './config_store.js';
import { TRAIN_CFG, refreshTrainConfig } from './train_config.js';
import { ENV_CFG, refreshEnvConfig }     from './env_config.js';
import { drawTrainTab,    handleTrainTabInput    } from './editor_tabs/tab_train.js';
import { drawEntornoTab,  handleEntornoTabInput  } from './editor_tabs/tab_entorno.js';
import { drawJuegoTab, handleJuegoTabInput, GAME_CFG, refreshGameConfig } from './editor_tabs/tab_juego.js';

// ── Panel constants ────────────────────────────────────────────────────────────
const PW = 320;    // panel width
const HEADER_H = 62;
const TABBAR_H = 28;
const FOOTER_H = 58;

// ── Module state ──────────────────────────────────────────────────────────────
let _visible    = false;
let _activeTab  = 'train';   // 'train' | 'entorno' | 'juego'
let _dirty      = false;
let _toast      = null;      // { msg, frames, color }

// ── Public API ────────────────────────────────────────────────────────────────
export function openPanel() {
  if (!auth.isViewer()) return;
  _visible   = true;
  _activeTab = 'train';
}

export function closePanel() {
  _visible = false;
  _dirty   = false;
  _toast   = null;
}

export function isVisible() { return _visible; }

// ── Computed panel geometry ───────────────────────────────────────────────────
function _panel() {
  return { x: canvas.width - PW, y: 0, w: PW, h: canvas.height };
}

function _contentY(p) { return p.y + HEADER_H + TABBAR_H; }
function _contentH(p) { return p.h - HEADER_H - TABBAR_H - FOOTER_H; }

// ── Input handler ─────────────────────────────────────────────────────────────
export function handlePanelInput(keys, mouse, consumeKey) {
  if (!_visible) return;

  const p  = _panel();
  const mx = mouse.x, my = mouse.y;
  const clicked = mouse.clicked;

  // Escape → close
  if (keys['Escape']) { closePanel(); consumeKey('Escape'); return; }

  // Tab bar clicks
  if (clicked) {
    const tabY = p.y + HEADER_H;
    const tabs = [
      { id: 'train',   label: '🚇 TREN',    x: p.x + 4,        w: 98 },
      { id: 'entorno', label: '🌆 ENTORNO', x: p.x + 108,      w: 98 },
      { id: 'juego',   label: '🎮 JUEGO',   x: p.x + 212,      w: 98 },
    ];
    for (const tab of tabs) {
      if (_hit(mx, my, tab.x, tabY, tab.w, TABBAR_H)) {
        _activeTab = tab.id;
        mouse.clicked = false;
        return;
      }
    }

    // Header: close button
    if (_hit(mx, my, p.x + p.w - 28, p.y + 8, 20, 20)) {
      closePanel();
      mouse.clicked = false;
      return;
    }

    // Footer buttons
    const footY   = p.y + p.h - FOOTER_H + 10;
    const btns    = _footerButtons(p);
    for (const btn of btns) {
      if (_hit(mx, my, btn.x, footY, btn.w, 28)) {
        _handleFooterBtn(btn.id);
        mouse.clicked = false;
        return;
      }
    }
  }

  // Delegate to active tab (always, for slider drag even without click)
  const cy = _contentY(p);
  const ch = _contentH(p);

  let result;
  switch (_activeTab) {
    case 'train':   result = handleTrainTabInput(mx, my - cy, mouse.down, clicked);   break;
    case 'entorno': result = handleEntornoTabInput(mx, my - cy, mouse.down, clicked); break;
    case 'juego':   result = handleJuegoTabInput(mx, my - cy, mouse.down, clicked);   break;
  }

  if (result?.changed) _dirty = true;

  // Tick toast
  if (_toast) { _toast.frames--; if (_toast.frames <= 0) _toast = null; }
}

// ── Footer button definitions ─────────────────────────────────────────────────
function _footerButtons(p) {
  const isAdmin = auth.isAdmin();
  const buttons = [];
  let bx = p.x + 8;
  const bw = 66;
  if (isAdmin) {
    buttons.push({ id: 'save',   label: 'GUARDAR', x: bx, w: bw, color: '#f5c518', textColor: '#000' }); bx += bw + 4;
    buttons.push({ id: 'reset',  label: 'RESETEAR', x: bx, w: bw, color: 'transparent', border: '#cc3333', textColor: '#cc3333' }); bx += bw + 4;
  }
  buttons.push({ id: 'export', label: 'EXPORTAR', x: bx, w: bw, color: 'transparent', border: '#555', textColor: '#999' }); bx += bw + 4;
  buttons.push({ id: 'logout', label: 'SALIR',    x: bx, w: bw, color: 'transparent', border: '#333', textColor: '#666' });
  return buttons;
}

function _handleFooterBtn(id) {
  switch (id) {
    case 'save':
      if (!auth.isAdmin()) { _showToast('Sin permisos', '#cc3333'); return; }
      _saveActiveTab();
      break;
    case 'reset':
      if (!auth.isAdmin()) return;
      resetToDefaults(_activeTab === 'entorno' ? 'env' : _activeTab);
      refreshTrainConfig();
      refreshEnvConfig();
      refreshGameConfig();
      _dirty = false;
      _showToast('Valores por defecto', '#f5c518');
      break;
    case 'export': {
      const json = exportConfig();
      // Copy to clipboard if available, otherwise show toast with note
      if (navigator.clipboard) {
        navigator.clipboard.writeText(json).catch(() => {});
        _showToast('Config copiada al portapapeles', '#4488AA');
      } else {
        _showToast('Exportado a consola (F12)', '#4488AA');
        console.log('=== PIGEON EDITOR CONFIG ===\n' + json);
      }
      break;
    }
    case 'logout':
      auth.logout();
      closePanel();
      break;
  }
}

function _saveActiveTab() {
  switch (_activeTab) {
    case 'train':
      saveTrainConfig(TRAIN_CFG);
      refreshTrainConfig();
      break;
    case 'entorno':
      saveEnvConfig(ENV_CFG);
      refreshEnvConfig();
      break;
    case 'juego':
      saveGameConfig(GAME_CFG);
      refreshGameConfig();
      break;
  }
  _dirty = false;
  _showToast('✓ Guardado', '#44cc77');
}

function _showToast(msg, color = '#44cc77') {
  _toast = { msg, frames: 90, color };
}

// ── Render ────────────────────────────────────────────────────────────────────
export function drawPanel(ctx) {
  if (!_visible) return;

  const p  = _panel();
  const session = auth.getSession();

  // ── Left overlay (dim the game) ──────────────────────────────────────────
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 0, p.x, canvas.height);

  // ── Panel background ──────────────────────────────────────────────────────
  ctx.fillStyle = '#0a0a14';
  ctx.fillRect(p.x, p.y, p.w, p.h);
  // Left accent border
  ctx.fillStyle = '#f5c518';
  ctx.fillRect(p.x, 0, 2, p.h);

  // ── Header ────────────────────────────────────────────────────────────────
  ctx.fillStyle = '#f5c518';
  ctx.font = 'bold 13px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('⚙ EDITOR', p.x + 12, p.y + 18);

  if (session) {
    const roleColor = session.role === auth.ROLES.ADMIN ? '#f5c518' : '#888';
    const roleLabel = session.role === auth.ROLES.ADMIN ? 'ADMIN' : 'VIEWER';
    ctx.fillStyle = '#666';
    ctx.font = '10px monospace';
    ctx.fillText(session.username, p.x + 12, p.y + 36);
    ctx.fillStyle = roleColor;
    ctx.fillRect(p.x + 12 + session.username.length * 6 + 6, p.y + 29, 40, 14);
    ctx.fillStyle = '#000';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(roleLabel, p.x + 12 + session.username.length * 6 + 6 + 20, p.y + 36);
  }

  // Dirty indicator
  if (_dirty) {
    ctx.fillStyle = '#cc7700';
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('● sin guardar', p.x + p.w - 36, p.y + 36);
  }

  // Close button
  ctx.fillStyle = '#444';
  ctx.fillRect(p.x + p.w - 28, p.y + 8, 20, 20);
  ctx.fillStyle = '#ccc';
  ctx.font = 'bold 13px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('✕', p.x + p.w - 18, p.y + 18);

  // Header bottom line
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(p.x, p.y + HEADER_H - 1, p.w, 1);

  // ── Tab bar ───────────────────────────────────────────────────────────────
  const tabY   = p.y + HEADER_H;
  const tabs = [
    { id: 'train',   label: '🚇 TREN',    x: p.x + 4,   w: 98 },
    { id: 'entorno', label: '🌆 ENTORNO', x: p.x + 108, w: 98 },
    { id: 'juego',   label: '🎮 JUEGO',   x: p.x + 212, w: 98 },
  ];
  for (const tab of tabs) {
    const active = tab.id === _activeTab;
    ctx.fillStyle = active ? '#f5c518' : '#444';
    ctx.font = active ? 'bold 10px monospace' : '10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(tab.label, tab.x + tab.w / 2, tabY + TABBAR_H / 2);
    if (active) {
      ctx.fillStyle = '#f5c518';
      ctx.fillRect(tab.x, tabY + TABBAR_H - 2, tab.w, 2);
    }
  }

  // ── Tab content ───────────────────────────────────────────────────────────
  const cy = _contentY(p);
  const ch = _contentH(p);

  ctx.save();
  ctx.beginPath();
  ctx.rect(p.x, cy, p.w, ch);
  ctx.clip();
  ctx.translate(0, cy);

  switch (_activeTab) {
    case 'train':   drawTrainTab(ctx,   p.x, 0, p.w, ch, 0, 0); break;
    case 'entorno': drawEntornoTab(ctx, p.x, 0, p.w, ch, 0, 0); break;
    case 'juego':   drawJuegoTab(ctx,   p.x, 0, p.w, ch, 0, 0); break;
  }

  ctx.restore();

  // ── Footer ────────────────────────────────────────────────────────────────
  const footY = p.y + p.h - FOOTER_H;
  ctx.fillStyle = '#111120';
  ctx.fillRect(p.x, footY, p.w, FOOTER_H);
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(p.x, footY, p.w, 1);

  const btns = _footerButtons(p);
  for (const btn of btns) {
    const by = footY + 10;
    if (btn.color && btn.color !== 'transparent') {
      ctx.fillStyle = btn.color;
      ctx.fillRect(btn.x, by, btn.w, 28);
    }
    if (btn.border) {
      ctx.strokeStyle = btn.border;
      ctx.lineWidth = 1;
      ctx.strokeRect(btn.x + 0.5, by + 0.5, btn.w - 1, 27);
    }
    ctx.fillStyle = btn.textColor;
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(btn.label, btn.x + btn.w / 2, by + 14);
  }

  // ── Toast ─────────────────────────────────────────────────────────────────
  if (_toast) {
    const alpha = Math.min(1, _toast.frames / 30);
    const tw    = Math.min(p.w - 20, _toast.msg.length * 8 + 20);
    const tx    = p.x + (p.w - tw) / 2;
    const ty    = p.y + p.h - FOOTER_H - 36;
    ctx.fillStyle = `rgba(10,10,20,${alpha * 0.9})`;
    ctx.fillRect(tx, ty, tw, 24);
    ctx.strokeStyle = _toast.color;
    ctx.lineWidth = 1;
    ctx.globalAlpha = alpha;
    ctx.strokeRect(tx + 0.5, ty + 0.5, tw - 1, 23);
    ctx.fillStyle = _toast.color;
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(_toast.msg, tx + tw / 2, ty + 12);
    ctx.globalAlpha = 1;
  }

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

function _hit(mx, my, x, y, w, h) {
  return mx >= x && mx < x + w && my >= y && my < y + h;
}
