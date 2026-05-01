// Bucle principal: orquesta todos los módulos, gestiona estados y renderizado

import { canvas, ctx, STATE, pigeon, obstacles, collectibles, particles, CHARACTERS, DEBUG } from './mecanica/estado.js';
import { loadFlightHistory, checkUnlocks } from './mecanica/progreso.js';
import { initInput, keys, consumeKey } from './mecanica/input.js';
import { initCamera } from './mecanica/camara.js';
import { checkCollisions, drawDebugHitboxes } from './mecanica/colisiones.js';
import { updatePigeon, drawPigeon } from './personajes/paloma.js';
import { updatePidgey, drawPidgey } from './personajes/pidgey.js';
import {
  drawTunnel,
  updateObstacles, drawObstacles,
  updateCollectibles, drawCollectibles,
  updateParticles, drawParticles,
} from './escenarios/metro.js';
import { drawHUD } from './pantallas/hud.js';
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
import {
  drawLoginScreen, handleLoginKey, handleLoginClick, isLoginModeActive,
  setLoginSuccessCallback,
} from './editor/auth.js';
import * as EditorModal from './editor/editor_modal.js';
import * as PM from './editor/preset_manager.js';
import { loadConfigs } from './editor/config_store.js';

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

// Reinicia solo el estado de gameplay (no tocar seleccion de menu/personaje)
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

  // Editor modal gets absolute priority: freezes the game
  if (EditorModal.isOpen()) {
    EditorModal.handleInput(mouse.x, mouse.y, mouse.down, mouse.clicked,
                            keys, consumeKey, canvas);
    STATE.editorOpen = true;
    return;
  }

  // Login modal: blocks all other input until resolved
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
      STATE.score += STATE.speed * dt * 0.1;
      if (STATE.frame % 60 === 0) checkUnlocks();
      CHARACTERS[STATE.selectedCharacter].update(dt);
      if (STATE.selectedScenario === 'linea_3') {
        Linea3.update(dt);
        updateCollectibles(dt);
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

  // Detectar transicion de fase
  if (STATE.phase !== prevPhase) {
    if (STATE.phase === 'PLAYING' && prevPhase !== 'PAUSED') startNewGame();
    if (STATE.phase === 'CHARACTER') initCharacterScreen();
  }
  prevPhase = STATE.phase;
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Camera shake: desplaza el canvas brevemente al impactar
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
        drawCollectibles(ctx);
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

  if (shaking) ctx.restore();

  drawLoginScreen(ctx);
  EditorModal.draw(ctx, canvas);
  drawDebugHitboxes(ctx);
}

init();
