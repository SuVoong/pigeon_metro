// Bucle principal: orquesta todos los módulos, gestiona estados y renderizado

import { canvas, ctx, STATE, pigeon, obstacles, collectibles, particles, CHARACTERS, DEBUG } from './mecanica/estado.js';
import { loadFlightHistory, checkUnlocks, loadAchievements, saveAchievements } from './mecanica/progreso.js';
import { loadActiveProfile } from './mecanica/perfil.js';
import { initInput, keys, consumeKey } from './mecanica/input.js';
import { initCamera, applyCamera, unapplyCamera, resetCamera } from './mecanica/camara.js';
import { checkCollisions, drawDebugHitboxes } from './mecanica/colisiones.js';
import { updatePigeon,     drawPigeon     } from './personajes/paloma.js';
import { updatePidgey,     drawPidgey     } from './personajes/pidgey.js';
import { updateAngryBird,  drawAngryBird  } from './personajes/angry_bird.js';
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
import { handleLevelCompleteInput, drawLevelCompleteScreen } from './pantallas/fin_nivel.js';
import {
  handleSceneEditorInput, updateSceneEditor, drawSceneEditorScreen,
} from './pantallas/escena_editor.js';
import { MapaMetroMadrid } from './escenarios/metro_madrid/mapa_metro_madrid.js';
import { Linea3 } from './escenarios/metro_madrid/linea_3/linea_3.js';
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
CHARACTERS[2].update = updateAngryBird;
CHARACTERS[2].draw   = drawAngryBird;

let lastTime = 0;
let prevPhase = 'START';

function init() {
  initCamera();
  initInput();
  resetGame();
  // Perfil de jugador ANTES de cualquier load* — los datos por jugador
  // (logros, contadores, historial) viven bajo claves namespaced por perfil.
  loadActiveProfile();
  loadFlightHistory();
  loadAchievements();          // logros + contadores (linesCompleted, etc.)
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
  resetCamera();   // resetear el offset XY de la cámara móvil
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

    case 'SCENE_EDITOR':
      handleSceneEditorInput(keys, consumeKey);
      updateSceneEditor(dt);
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
        // Fin de línea: la paloma ha llegado al terminal de la dirección
        // elegida. Pasamos a LEVEL_COMPLETE para mostrar el popup de
        // "Dar la vuelta" / "Terminar".
        if (Linea3.isFinished) {
          // Sólo contamos UNA vez (isFinished se mantiene true en frames
          // sucesivos hasta que el jugador elige acción).
          if (STATE.phase !== 'LEVEL_COMPLETE') {
            STATE.linesCompleted = (STATE.linesCompleted ?? 0) + 1;
            saveAchievements();   // persiste el contador y dispara logros
            checkUnlocks();       // evalúa LINE_END y resto
          }
          STATE.phase = 'LEVEL_COMPLETE';
          break;
        }
      } else {
        updateObstacles(dt);
        updateCollectibles(dt);
      }
      updateParticles(dt);
      checkCollisions();
      break;

    case 'LEVEL_COMPLETE':
      handleLevelCompleteInput(keys, consumeKey, mouse);
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

    case 'SCENE_EDITOR':
      drawSceneEditorScreen(ctx);
      break;

    case 'PLAYING':
      // Mecánica nueva: la paloma queda anclada al centro de la pantalla y
      // todo el escenario se desplaza con el offset de cámara. Aplicamos
      // el transform SOLO al contenido world-space (escenario, obstáculos,
      // coleccionables, partículas). Paloma y HUD quedan FUERA del transform
      // → siempre visibles en la misma posición de pantalla.
      applyCamera(ctx);
      if (STATE.selectedScenario === 'linea_3') {
        Linea3.render(ctx);
        drawCollectibles(ctx);
      } else {
        drawTunnel(ctx);
        drawObstacles(ctx);
        drawCollectibles(ctx);
      }
      drawParticles(ctx);
      unapplyCamera(ctx);
      CHARACTERS[STATE.selectedCharacter].draw(ctx);
      if (STATE.selectedScenario === 'linea_3') Linea3.renderHUD(ctx);
      drawHUD(ctx);
      break;

    case 'PAUSED':
      applyCamera(ctx);
      if (STATE.selectedScenario === 'linea_3') {
        Linea3.render(ctx);
        drawCollectibles(ctx);
      } else {
        drawTunnel(ctx);
        drawObstacles(ctx);
        drawCollectibles(ctx);
      }
      drawParticles(ctx);
      unapplyCamera(ctx);
      CHARACTERS[STATE.selectedCharacter].draw(ctx);
      if (STATE.selectedScenario === 'linea_3') Linea3.renderHUD(ctx);
      drawHUD(ctx);
      drawPauseScreen(ctx);
      break;

    case 'LEVEL_COMPLETE':
      // Congelar el último frame del juego y superponer el popup.
      applyCamera(ctx);
      if (STATE.selectedScenario === 'linea_3') {
        Linea3.render(ctx);
        drawCollectibles(ctx);
      } else {
        drawTunnel(ctx);
        drawObstacles(ctx);
        drawCollectibles(ctx);
      }
      drawParticles(ctx);
      unapplyCamera(ctx);
      CHARACTERS[STATE.selectedCharacter].draw(ctx);
      if (STATE.selectedScenario === 'linea_3') Linea3.renderHUD(ctx);
      drawHUD(ctx);
      drawLevelCompleteScreen(ctx, mouse);
      break;

    case 'GAMEOVER':
      applyCamera(ctx);
      if (STATE.selectedScenario === 'linea_3') {
        Linea3.render(ctx);
      } else {
        drawTunnel(ctx);
        drawObstacles(ctx);
      }
      drawParticles(ctx);
      unapplyCamera(ctx);
      if (STATE.selectedScenario === 'linea_3') Linea3.renderHUD(ctx);
      drawHUD(ctx);
      drawGameOverScreen(ctx);
      break;
  }

  if (shaking) ctx.restore();

  drawLoginScreen(ctx);
  EditorModal.draw(ctx, canvas);
  drawDebugHitboxes(ctx);
  drawAchievementToast(ctx);
}

// ── Toast de logro desbloqueado ─────────────────────────────────────────────
// Se muestra como overlay sobre cualquier pantalla durante ~4s. El framesLeft
// se decrementa cada frame hasta llegar a 0 → desaparece. Curva alpha:
// fade-in los primeros 12 frames, fade-out los últimos 24.
function drawAchievementToast(ctx) {
  const t = STATE.achievementToast;
  if (!t) return;

  t.framesLeft -= 1;
  if (t.framesLeft <= 0) { STATE.achievementToast = null; return; }

  const TOTAL = 240;
  const elapsed = TOTAL - t.framesLeft;
  let alpha = 1;
  if (elapsed < 12)            alpha = elapsed / 12;
  else if (t.framesLeft < 24)  alpha = t.framesLeft / 24;

  const W  = 320;
  const H  = 56;
  const tx = canvas.width - W - 16;
  const ty = 16;

  ctx.save();
  ctx.globalAlpha = alpha;

  // Fondo
  ctx.fillStyle = '#0d0d22';
  ctx.fillRect(tx, ty, W, H);
  // Borde dorado
  ctx.strokeStyle = '#F5C518';
  ctx.lineWidth   = 2;
  ctx.strokeRect(tx + 1, ty + 1, W - 2, H - 2);

  // Icono grande a la izquierda
  ctx.fillStyle = '#F5C518';
  ctx.font = '28px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(t.icon ?? '★', tx + 28, ty + H / 2);

  // Etiqueta + título
  ctx.fillStyle = '#F5C518';
  ctx.font = 'bold 9px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('LOGRO DESBLOQUEADO', tx + 56, ty + 18);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 13px monospace';
  ctx.fillText(t.title ?? '', tx + 56, ty + 38);

  ctx.restore();
  ctx.textAlign    = 'left';
  ctx.textBaseline = 'alphabetic';
}

init();
