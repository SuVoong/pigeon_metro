// Bucle principal: orquesta todos los módulos, gestiona estados y renderizado

import { canvas, ctx, STATE, pigeon, obstacles, collectibles, particles, PAL, CHARACTERS, saveFlightRecord, loadFlightHistory, checkUnlocks, DEBUG } from './mecanica/estado.js';
import { initInput, keys, consumeKey } from './mecanica/input.js';
import { initCamera, w2sx, w2sy, perspective } from './mecanica/camara.js';
import { aabb } from './mecanica/colisiones.js';
import { emitParticles } from './mecanica/spawning.js';
import { updatePigeon, drawPigeon } from './personajes/paloma.js';
import { updatePidgey, drawPidgey } from './personajes/pidgey.js';
import {
  drawTunnel,
  updateObstacles, drawObstacles,
  updateCollectibles, drawCollectibles,
  updateParticles, drawParticles,
} from './escenarios/metro.js';
import { handleStartInput,        drawStartScreen        } from './pantallas/inicio.js';
import { handleArcadeInput,       drawArcadeScreen       } from './pantallas/arcade.js';
import { handleHistoriaInput,     drawHistoriaScreen     } from './pantallas/historia.js';
import { handleCharacterInput,    drawCharacterScreen,
         initCharacterScreen                             } from './pantallas/personaje.js';
import { handleAchievementsInput, drawAchievementsScreen } from './pantallas/logros.js';
import { handleSettingsInput,     drawSettingsScreen     } from './pantallas/ajustes.js';
import { handlePauseInput, drawPauseScreen } from './pantallas/pausa.js';
import { drawGameOverScreen } from './pantallas/fin.js';
import { MapaMetroMadrid } from './escenarios/metros/metros_madrid/mapa_metro_madrid.js';
import { Linea3 } from './escenarios/metros/metros_madrid/linea_3/linea_3.js';
import { MetroBase } from './escenarios/metros/metro_base/metro_base.js';
import { TRAIN_CFG } from './editor/train_config.js';

// ── Editor / auth ─────────────────────────────────────────────────────────────
import {
  drawLoginScreen, handleLoginKey, handleLoginClick, isLoginModeActive,
  setLoginSuccessCallback,
} from './editor/auth.js';
import * as EditorModal from './editor/editor_modal.js';
import * as PM from './editor/preset_manager.js';
import { loadConfigs } from './editor/config_store.js';

// ── Hitbox por defecto (fallback si el preset no define un valor) ──────────────
// Sprite paloma: 32px diseño × escala 3 = 96px en pantalla.
// Hitbox cuadrada ~37% del sprite → suficientemente precisa sin ser injusta.
const PIGEON_HITBOX_DEFAULT = 36;

// ── Mouse state ───────────────────────────────────────────────────────────────
const mouse = { x: 0, y: 0, down: false, clicked: false };
canvas.addEventListener('mousemove', (e) => {
  const r = canvas.getBoundingClientRect();
  mouse.x = (e.clientX - r.left) * (canvas.width  / r.width);
  mouse.y = (e.clientY - r.top)  * (canvas.height / r.height);
});
canvas.addEventListener('mousedown', () => { mouse.down = true; mouse.clicked = true; });
canvas.addEventListener('mouseup',   () => { mouse.down = false; });

// ── Registrar funciones update/draw en cada personaje ─────────────────────────
// (No se pueden poner en estado.js: paloma.js y pidgey.js importan desde allí)
CHARACTERS[0].update = updatePigeon;
CHARACTERS[0].draw   = drawPigeon;
CHARACTERS[1].update = updatePidgey;
CHARACTERS[1].draw   = drawPidgey;

let lastTime = 0;
let prevPhase = 'START';

function init() {
  initCamera();
  initInput();
  resetGame();
  loadFlightHistory();
  MapaMetroMadrid.loadProgress();
  // Warm up persisted configs (train_config / env_config load on import already)
  loadConfigs();
  // Boot the preset manager (loads built-in + saved presets from localStorage).
  PM.init();
  // Auth callback: called by auth.js on successful login → opens the IDE modal.
  setLoginSuccessCallback(() => EditorModal.open());

  // Exponer DEBUG globalmente para consola
  window.DEBUG = DEBUG;

  lastTime = performance.now();
  requestAnimationFrame(loop);
}

function resetGame() {
  STATE.phase = 'START';
  STATE.menuCursor = 0;
  STATE.totalPlaySeconds = 0;
  startNewGame();
}

// Reinicia sólo el estado de gameplay (no tocar selección de menú/personaje)
function startNewGame() {
  STATE.score = 0;
  STATE.lives = 3;
  STATE.speed = 2;
  STATE.frame = 0;
  STATE.worldZ = 0;
  pigeon.x = 0;
  pigeon.y = 0;
  pigeon.vx = 0;
  pigeon.vy = 0;
  pigeon.wingFrame  = 0;
  pigeon.invincible = 0;
  pigeon.stunned    = 0;
  pigeon.stunStars  = [];
  pigeon.tilt       = 0;
  STATE.cameraShake = 0;
  obstacles.length = 0;
  collectibles.length = 0;
  particles.length = 0;
  for (const k in keys) keys[k] = false;

  // Boot del escenario seleccionado
  if (STATE.selectedScenario === 'linea_3') {
    Linea3.init();
  }
}

function loop(timestamp) {
  let dt = (timestamp - lastTime) / 16.67;
  if (dt > 3) dt = 3;
  lastTime = timestamp;
  STATE.frame++;

  update(dt);
  render();

  // Consume single-frame click at end of each frame
  mouse.clicked = false;

  requestAnimationFrame(loop);
}

function update(dt) {
  // Decrementar camera shake (independiente del estado)
  if (STATE.cameraShake > 0) STATE.cameraShake = Math.max(0, STATE.cameraShake - dt * 1.5);

  // ── Editor modal gets absolute priority: freezes the game ─────────────────
  if (EditorModal.isOpen()) {
    EditorModal.handleInput(mouse.x, mouse.y, mouse.down, mouse.clicked,
                            keys, consumeKey, canvas);
    STATE.editorOpen = true;
    return;
  }

  // ── Login modal: blocks all other input until resolved ────────────────────
  if (isLoginModeActive()) {
    handleLoginKey(keys, consumeKey);
    if (mouse.clicked) handleLoginClick(mouse.x, mouse.y);
    STATE.editorOpen = false;
    return;
  }
  STATE.editorOpen = false;

  switch (STATE.phase) {
    case 'START':
      handleStartInput(keys, consumeKey);
      break;

    case 'ARCADE':
      handleArcadeInput(keys, consumeKey);
      break;

    case 'HISTORY':
      handleHistoriaInput(keys, consumeKey);
      break;

    case 'CHARACTER':
      handleCharacterInput(keys, consumeKey);
      break;


    case 'ACHIEVEMENTS':
      handleAchievementsInput(keys, consumeKey);
      break;

    case 'SETTINGS':
      handleSettingsInput(keys, consumeKey, mouse);
      break;

    case 'PLAYING':
      if (keys['Escape'] || keys['p']) {
        STATE.phase = 'PAUSED';
        consumeKey('Escape');
        consumeKey('p');
        break;
      }
      STATE.speed = 2 + STATE.frame * 0.0008;
      STATE.worldZ += STATE.speed * dt;
      STATE.totalPlaySeconds += dt / 60;
      // Puntaje por distancia: 1 punto base por cada 10 unidades de mundo
      STATE.score += STATE.speed * dt * 0.1;
      // Comprobar desbloqueos una vez por segundo
      if (STATE.frame % 60 === 0) checkUnlocks();
      CHARACTERS[STATE.selectedCharacter].update(dt);
      if (STATE.selectedScenario === 'linea_3') {
        Linea3.update(dt);
        updateCollectibles(dt);   // monedas/migas en modo Línea 3 también
      } else {
        updateObstacles(dt);
        updateCollectibles(dt);
      }
      updateParticles(dt);
      checkCollisions();
      break;

    case 'PAUSED':
      handlePauseInput(keys, consumeKey);
      break;

    case 'GAMEOVER':
      if (keys['r']) {
        consumeKey('r');
        STATE.phase = 'START';
      }
      break;
  }

  // Detectar transición de fase
  if (STATE.phase !== prevPhase) {
    // Entrada en PLAYING desde fuera de pausa → reset
    if (STATE.phase === 'PLAYING' && prevPhase !== 'PAUSED') startNewGame();
    // Entrada en CHARACTER → inicializar pantalla
    if (STATE.phase === 'CHARACTER') initCharacterScreen();
  }
  prevPhase = STATE.phase;
}

function checkCollisions() {
  // ── Leer parámetros del preset activo ────────────────────────────────────────
  const _f        = PM.getActive()?.fisica ?? {};
  const HITBOX    = (_f.pigeonHitboxSize    ?? PIGEON_HITBOX_DEFAULT);
  const COL_Z     = (_f.arcadeCollisionZ    ?? 600);
  const VERT_POS  = (_f.trainVerticalPos    ?? TRAIN_CFG.verticalPos);

  // ── HITBOX DE LA PALOMA ──
  const pSX = w2sx(pigeon.x);
  const pSY = w2sy(pigeon.y);

  // Hitbox base (modo arcade, sin yShift)
  const pBox = {
    x: pSX - HITBOX / 2,
    y: pSY - HITBOX / 2,
    w: HITBOX,
    h: HITBOX,
  };

  // ── CONTRA OBSTÁCULOS ──
  if (pigeon.invincible === 0 && pigeon.stunned === 0) {

    if (STATE.selectedScenario === 'linea_3') {
      // ── Sistema MetroBase (Línea 3) ──
      // drawTrack() desplaza los trenes verticalmente por yShift.
      // El hitbox de la paloma se desplaza la misma cantidad para alinear
      // ambos en el mismo sistema de coordenadas.
      const yShift = (VERT_POS - 0.5) * canvas.height;
      const pBoxL3 = {
        x: pBox.x,
        y: pBox.y + yShift,
        w: HITBOX,
        h: HITBOX,
      };
      const trainBoxes = MetroBase.getTrainHitboxes();
      for (const tBox of trainBoxes) {
        if (aabb(pBoxL3, tBox)) {
          _triggerHit();
          break;
        }
      }
    } else {
      // ── Sistema arcade simple (spawning.js → array obstacles) ──
      for (const o of obstacles) {
        // Solo comprobar obstáculos dentro de la zona de colisión configurada.
        if (o.z > COL_Z || o.z < -50) continue;

        const scale = perspective(o.z);
        const sx = w2sx(o.x * scale);
        const sy = w2sy(o.y * scale);
        const sw = o.w * scale;
        const sh = o.h * scale;
        const oBox = { x: sx - sw / 2, y: sy - sh / 2, w: sw, h: sh };

        if (aabb(pBox, oBox)) {
          _triggerHit();
          break;
        }
      }
    }
  }

  // ── CONTRA COLECCIONABLES ──
  for (let i = collectibles.length - 1; i >= 0; i--) {
    const c = collectibles[i];
    if (Math.abs(c.z) > 50) continue;

    const scale = perspective(c.z);
    const sx = w2sx(c.x * scale);
    const sy = w2sy(c.y * scale);
    const sw = Math.max(8, c.w * scale * 1.5);
    const sh = Math.max(8, c.h * scale * 1.5);
    const cBox = { x: sx - sw / 2, y: sy - sh / 2, w: sw, h: sh };

    if (aabb(pBox, cBox)) {
      STATE.score += c.type === 'coin' ? 50 : 10;
      emitParticles(sx, sy, PAL.particle, 6);
      collectibles.splice(i, 1);
    }
  }
}

function _triggerHit() {
  // ── Leer parámetros del preset activo ─────────────────────────────────────
  const _f = PM.getActive()?.fisica ?? {};
  const invFrames   = _f.invincibleFrames    ?? 50;
  const stunFrames  = _f.stunFrames          ?? 30;
  const shakeIntens = _f.cameraShakeIntensity ?? 12;

  // ── EFECTOS DEL IMPACTO ──
  STATE.lives--;
  pigeon.invincible = invFrames;
  pigeon.stunned    = stunFrames;
  pigeon.stunStars  = _generateStars();
  STATE.cameraShake = shakeIntens;

  // Reset de velocidad: la paloma se queda flotando
  pigeon.vx = 0;
  pigeon.vy = 0;

  // Partículas de impacto
  _emitImpactParticles(w2sx(pigeon.x), w2sy(pigeon.y));

  if (STATE.lives <= 0) {
    saveFlightRecord(STATE.totalPlaySeconds);
    STATE.phase = 'GAMEOVER';
  }
}

function _generateStars() {
  // 4 estrellitas que orbitarán alrededor de la paloma
  return [
    { angle: 0,           radius: 18, color: '#FFEE55' },
    { angle: Math.PI / 2, radius: 18, color: '#FFFFFF' },
    { angle: Math.PI,     radius: 18, color: '#FFEE55' },
    { angle: (3 * Math.PI) / 2, radius: 18, color: '#FFFFFF' },
  ];
}

function _emitImpactParticles(x, y) {
  // 12 plumas grises (sprites pequeños 3×2)
  for (let i = 0; i < 12; i++) {
    particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 6,
      vy: (Math.random() - 0.5) * 6 - 1,
      life: 40,
      type: 'feather',
      color: i % 2 ? '#8899AA' : '#556677',
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.2,
    });
  }
  // 6 destellos blancos
  for (let i = 0; i < 6; i++) {
    particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 8,
      vy: (Math.random() - 0.5) * 8,
      life: 20,
      type: 'spark',
      color: '#FFFFFF',
    });
  }
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // ── Camera shake — desplaza el canvas brevemente al impactar ─────────────
  const shaking = STATE.cameraShake > 0 &&
    (STATE.phase === 'PLAYING' || STATE.phase === 'PAUSED');
  if (shaking) {
    const mag = STATE.cameraShake;
    ctx.save();
    ctx.translate(
      (Math.random() - 0.5) * mag * 0.8,
      (Math.random() - 0.5) * mag * 0.5,
    );
  }

  switch (STATE.phase) {
    case 'START':
      drawStartScreen(ctx);
      break;

    case 'ARCADE':
      drawArcadeScreen(ctx);
      break;

    case 'HISTORY':
      drawHistoriaScreen(ctx);
      break;

    case 'CHARACTER':
      drawCharacterScreen(ctx);
      break;

    case 'ACHIEVEMENTS':
      drawAchievementsScreen(ctx);
      break;

    case 'SETTINGS':
      drawSettingsScreen(ctx);
      break;

    case 'PLAYING':
      if (STATE.selectedScenario === 'linea_3') {
        Linea3.render(ctx);
        drawCollectibles(ctx);    // monedas/migas sobre el escenario de Línea 3
      } else {
        drawTunnel(ctx);
        drawObstacles(ctx);
        drawCollectibles(ctx);
      }
      drawParticles(ctx);
      CHARACTERS[STATE.selectedCharacter].draw(ctx);
      drawHUD(ctx);
      break;

    case 'PAUSED':
      if (STATE.selectedScenario === 'linea_3') {
        Linea3.render(ctx);
        drawCollectibles(ctx);
      } else {
        drawTunnel(ctx);
        drawObstacles(ctx);
        drawCollectibles(ctx);
      }
      drawParticles(ctx);
      CHARACTERS[STATE.selectedCharacter].draw(ctx);
      drawHUD(ctx);
      drawPauseScreen(ctx);
      break;

    case 'GAMEOVER':
      if (STATE.selectedScenario === 'linea_3') {
        Linea3.render(ctx);
      } else {
        drawTunnel(ctx);
        drawObstacles(ctx);
      }
      drawParticles(ctx);
      drawHUD(ctx);
      drawGameOverScreen(ctx);
      break;
  }

  // Restaurar contexto si había shake
  if (shaking) ctx.restore();

  // ── Editor overlays — always on top ───────────────────────────────────────
  drawLoginScreen(ctx);   // returns early if not in login mode
  EditorModal.draw(ctx, canvas);   // returns early if not open

  // ── DEBUG: visualizar hitboxes ───────────────────────────────────────────
  _drawDebugHitboxes(ctx);
}

function drawHUD(ctx) {
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
  // Color: blanco en ×1.0 → naranja en ×2.0 → rojo en ×3.0+
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

    // Parpadeo de la última vida ganada/perdida
    const blink = !alive
      || (pigeon.invincible > 0 && pigeon.stunned === 0 && i === STATE.lives - 1
          ? Math.floor(STATE.frame / 4) % 2 === 0 : false);
    if (blink) continue;

    // Cuerpo paloma (6×6)
    ctx.fillStyle = alive ? PAL.pigeonBody : '#2a2a2a';
    ctx.fillRect(ix,     iy + 2, 6, 5);

    // Cabeza
    ctx.fillStyle = alive ? '#9AABBB' : '#222';
    ctx.fillRect(ix + 3, iy,     4, 4);

    // Ala
    ctx.fillStyle = alive ? PAL.pigeonWing : '#1a1a1a';
    ctx.fillRect(ix - 2, iy + 3, 4, 2);

    // Ojo
    if (alive) {
      ctx.fillStyle = '#cc2200';
      ctx.fillRect(ix + 5, iy + 1, 1, 1);
    }

    // Cola
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

    // Fondo barra
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);

    // Barra de stun (amarilla → naranja)
    const r = Math.round(245 + (1 - frac) * 10);
    const g = Math.round(197 * frac);
    ctx.fillStyle = `rgb(${r},${g},24)`;
    ctx.fillRect(barX, barY, Math.round(barW * frac), barH);

    // Texto "STUNNED"
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

/** Dibuja hitboxes de debug (activar con DEBUG.showHitboxes = true) */
function _drawDebugHitboxes(ctx) {
  if (!DEBUG.showHitboxes) return;
  if (STATE.phase !== 'PLAYING' && STATE.phase !== 'PAUSED') return;

  // ── Hitbox de la paloma ──
  const _fDbg      = PM.getActive()?.fisica ?? {};
  const hitboxDbg  = _fDbg.pigeonHitboxSize  ?? PIGEON_HITBOX_DEFAULT;
  const vertPosDbg = _fDbg.trainVerticalPos  ?? TRAIN_CFG.verticalPos;
  const yShiftDbg  = STATE.selectedScenario === 'linea_3'
    ? (vertPosDbg - 0.5) * canvas.height
    : 0;
  const pX = w2sx(pigeon.x) - hitboxDbg / 2;
  const pY = w2sy(pigeon.y) - hitboxDbg / 2 + yShiftDbg;

  // Verde = caja que se usa realmente en la colisión
  ctx.strokeStyle = 'rgba(0,255,0,0.8)';
  ctx.lineWidth = 2;
  ctx.strokeRect(pX, pY, hitboxDbg, hitboxDbg);

  // Azul = posición visual real de la paloma (sin yShift)
  if (yShiftDbg !== 0) {
    ctx.strokeStyle = 'rgba(80,180,255,0.6)';
    ctx.lineWidth = 1;
    ctx.strokeRect(pX, pY - yShiftDbg, hitboxDbg, hitboxDbg);
  }

  // Centro
  ctx.fillStyle = '#00FF00';
  ctx.fillRect(w2sx(pigeon.x) - 3, w2sy(pigeon.y) - 3, 6, 6);

  const colZDbg = _fDbg.arcadeCollisionZ ?? 600;
  // ── Hitboxes de trenes ──
  const trainBoxes = STATE.selectedScenario === 'linea_3'
    ? MetroBase.getTrainHitboxes()
    : obstacles
        .filter(o => o.z <= colZDbg && o.z >= -50)
        .map(o => {
          const s = perspective(o.z);
          const sx = w2sx(o.x * s), sy = w2sy(o.y * s);
          const sw = o.w * s, sh = o.h * s;
          return { x: sx - sw / 2, y: sy - sh / 2, w: sw, h: sh };
        });

  for (const b of trainBoxes) {
    ctx.strokeStyle = 'rgba(255,0,0,0.7)';
    ctx.lineWidth = 1;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = '#FF0000';
    ctx.fillRect(b.x + b.w / 2 - 2, b.y + b.h / 2 - 2, 4, 4);
  }
}

init();
