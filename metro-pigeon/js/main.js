// Bucle principal: orquesta todos los módulos, gestiona estados y renderizado

import { canvas, ctx, STATE, pigeon, obstacles, collectibles, particles, PAL, CHARACTERS, saveFlightRecord, loadFlightHistory, checkUnlocks } from './mecanica/estado.js';
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

// ── Editor / auth ─────────────────────────────────────────────────────────────
import {
  drawLoginScreen, handleLoginKey, handleLoginClick, isLoginModeActive,
  setLoginSuccessCallback,
} from './editor/auth.js';
import { drawPanel, handlePanelInput, openPanel, isVisible } from './editor/editor_panel.js';
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
  // Auth callback: called by auth.js on successful login to open the panel
  setLoginSuccessCallback(openPanel);
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
  pigeon.wingFrame = 0;
  pigeon.invincible = 0;
  pigeon.tilt = 0;
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
  // ── Login modal gets priority: blocks all other input ─────────────────────
  if (isLoginModeActive()) {
    handleLoginKey(keys, consumeKey);
    if (mouse.clicked) handleLoginClick(mouse.x, mouse.y);
    if (isVisible()) {
      handlePanelInput(keys, mouse, consumeKey);
      STATE.editorOpen = true;
    } else {
      STATE.editorOpen = false;
    }
    return;
  }

  // ── Editor panel (non-modal, open over settings) ──────────────────────────
  if (isVisible()) {
    handlePanelInput(keys, mouse, consumeKey);
    STATE.editorOpen = true;
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
      // Comprobar desbloqueos una vez por segundo
      if (STATE.frame % 60 === 0) checkUnlocks();
      CHARACTERS[STATE.selectedCharacter].update(dt);
      if (STATE.selectedScenario === 'linea_3') {
        Linea3.update(dt);
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
  // Hitbox de la paloma en pantalla (12×12 centrado)
  const pBox = {
    x: w2sx(pigeon.x) - 6,
    y: w2sy(pigeon.y) - 6,
    w: 12, h: 12,
  };

  // Contra obstáculos (solo en ventana de colisión |z| < 50)
  if (pigeon.invincible === 0) {
    for (const o of obstacles) {
      if (Math.abs(o.z) > 50) continue;
      const scale = perspective(o.z);
      const sx = w2sx(o.x * scale);
      const sy = w2sy(o.y * scale);
      const sw = o.w * scale;
      const sh = o.h * scale;
      const oBox = { x: sx - sw / 2, y: sy - sh / 2, w: sw, h: sh };

      if (aabb(pBox, oBox)) {
        STATE.lives--;
        pigeon.invincible = 90;
        emitParticles(w2sx(pigeon.x), w2sy(pigeon.y), PAL.particle, 12);
        if (STATE.lives <= 0) {
          saveFlightRecord(STATE.totalPlaySeconds);
          STATE.phase = 'GAMEOVER';
        }
        break;
      }
    }
  }

  // Contra coleccionables
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

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

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

  // ── Editor overlays — always on top ───────────────────────────────────────
  drawLoginScreen(ctx);   // returns early if not in login mode
  drawPanel(ctx);         // returns early if not visible
}

function drawHUD(ctx) {
  ctx.fillStyle = PAL.hud;
  ctx.font = '14px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('SCORE ' + Math.floor(STATE.score), 12, 12);

  // Iconos de vidas en la esquina superior derecha
  for (let i = 0; i < 3; i++) {
    const x = canvas.width - 24 - i * 14;
    const y = 14;
    ctx.fillStyle = i < STATE.lives ? PAL.pigeonBody : '#333';
    ctx.fillRect(x, y, 8, 8);
    if (i < STATE.lives) {
      ctx.fillStyle = PAL.pigeonEye;
      ctx.fillRect(x + 2, y + 2, 1, 1);
      ctx.fillRect(x + 5, y + 2, 1, 1);
    }
  }

  ctx.textBaseline = 'alphabetic';
}

init();
