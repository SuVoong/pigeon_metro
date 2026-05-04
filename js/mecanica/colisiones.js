// Detección y respuesta a colisiones: AABB genérico + lógica de juego.

import { canvas, STATE, pigeon, obstacles, collectibles, particles, PAL, DEBUG } from './estado.js';
import { w2sx, w2sy, perspective, camera, CAMERA_RANGE_X, getPigeonVerticalOffset } from './camara.js';
import { emitParticles } from './spawning.js';
import { Linea3 } from '../escenarios/metro_madrid/linea_3/linea_3.js';
import * as PM from '../editor/preset_manager.js';
import { TRAIN_CFG } from '../editor/train_config.js';
import { saveFlightRecord } from './progreso.js';

// ── AABB ──────────────────────────────────────────────────────────────────────
export function aabb(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x &&
         a.y < b.y + b.h && a.y + a.h > b.y;
}

// ── Círculo vs caja AABB ──────────────────────────────────────────────────────
// Para hitboxes "halo" (los trenes): el contorno del peligro es circular,
// no rectangular. El test acerca el centro del círculo al punto más próximo
// de la caja y compara distancia² con r².
export function circleHitsBox(circle, box) {
  const cx = Math.max(box.x, Math.min(circle.cx, box.x + box.w));
  const cy = Math.max(box.y, Math.min(circle.cy, box.y + box.h));
  const dx = circle.cx - cx;
  const dy = circle.cy - cy;
  return dx * dx + dy * dy <= circle.r * circle.r;
}

// Hitbox cuadrada de la paloma cuando el preset no define un valor.
// Reducida 25 % (36 → 27) en sintonía con SPRITE_SCALE 3 → 2.25 en
// paloma.js / pidgey.js / angry_bird.js, para que la colisión coincida
// con el sprite ahora más pequeño.
const PIGEON_HITBOX_DEFAULT = 27;

// ── Colisiones de gameplay ────────────────────────────────────────────────────
export function checkCollisions() {
  const _f       = PM.getActive()?.fisica ?? {};
  const HITBOX   = _f.pigeonHitboxSize  ?? PIGEON_HITBOX_DEFAULT;
  const COL_Z    = _f.arcadeCollisionZ  ?? 600;
  const VERT_POS = _f.trainVerticalPos  ?? TRAIN_CFG.verticalPos;

  // La paloma queda anclada al centro de la pantalla (pigeon.x = pigeon.y = 0).
  // El input mueve la cámara, no a la paloma. Para colisionar con los
  // obstáculos —cuyas hitboxes se calculan en coords de mundo, sin aplicar
  // el offset de cámara— sumamos el offset al hitbox de la paloma. En coords
  // de mundo, la paloma está donde mira la cámara.
  const pSX = w2sx(pigeon.x) + camera.offsetX;
  const pSY = w2sy(pigeon.y) + camera.offsetY + getPigeonVerticalOffset();
  const pBox = { x: pSX - HITBOX / 2, y: pSY - HITBOX / 2, w: HITBOX, h: HITBOX };

  // ── Contra obstáculos ──
  if (pigeon.invincible === 0 && pigeon.stunned === 0) {

    if (STATE.selectedScenario === 'linea_3') {
      // drawTrack() desplaza los trenes por yShift; la paloma se desplaza igual
      // para que ambos coincidan en el mismo sistema de coordenadas.
      const yShift = (VERT_POS - 0.5) * canvas.height;
      const pBoxL3 = { x: pBox.x, y: pBox.y + yShift, w: HITBOX, h: HITBOX };
      // Los hitboxes de los trenes son HALOS (círculos centrados en la
      // cabeza). circleHitsBox los testea contra la caja de la paloma.
      const trainHalos = Linea3.getTrainHitboxes();
      for (const halo of trainHalos) {
        if (circleHitsBox(halo, pBoxL3)) { _triggerHit(); break; }
      }
    } else {
      for (const o of obstacles) {
        if (o.z > COL_Z || o.z < -50) continue;
        const scale = perspective(o.z);
        const sx = w2sx(o.x * scale);
        const sy = w2sy(o.y * scale);
        const sw = o.w * scale;
        const sh = o.h * scale;
        const oBox = { x: sx - sw / 2, y: sy - sh / 2, w: sw, h: sh };
        if (aabb(pBox, oBox)) { _triggerHit(); break; }
      }
    }

    // ── Contra paredes laterales (límite del rango de cámara) ──
    // El offsetX está clampado a ±maxX por updatePigeon. Si la paloma
    // sigue empujando hacia la pared cuando ya está al borde, choca.
    // Usamos un epsilon pequeño para tolerancia de redondeo y exigimos
    // que la velocidad apunte HACIA la pared (vx significativo).
    const maxX = canvas.width * CAMERA_RANGE_X;
    const eps  = 1;
    const VELO_EPS = 0.5;
    const atLeftWall  = camera.offsetX <= -maxX + eps && pigeon.vx < -VELO_EPS;
    const atRightWall = camera.offsetX >=  maxX - eps && pigeon.vx >  VELO_EPS;
    if (atLeftWall || atRightWall) {
      _triggerHit();
    }
  }

  // ── Contra coleccionables ──
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
  const _f = PM.getActive()?.fisica ?? {};
  const invFrames   = _f.invincibleFrames     ?? 50;
  const stunFrames  = _f.stunFrames           ?? 30;
  const shakeIntens = _f.cameraShakeIntensity ?? 12;

  STATE.lives--;
  pigeon.invincible = invFrames;
  pigeon.stunned    = stunFrames;
  pigeon.stunStars  = _generateStars();
  STATE.cameraShake = shakeIntens;
  pigeon.vx = 0;
  pigeon.vy = 0;

  // Las plumas/destellos del impacto se emiten donde la paloma se VE en
  // pantalla (centro fijo), no donde está en coords de mundo.
  _emitImpactParticles(w2sx(pigeon.x), w2sy(pigeon.y) + getPigeonVerticalOffset());

  if (STATE.lives <= 0) {
    saveFlightRecord(STATE.totalPlaySeconds);
    STATE.phase = 'GAMEOVER';
  }
}

function _generateStars() {
  return [
    { angle: 0,                   radius: 18, color: '#FFEE55' },
    { angle: Math.PI / 2,         radius: 18, color: '#FFFFFF' },
    { angle: Math.PI,             radius: 18, color: '#FFEE55' },
    { angle: (3 * Math.PI) / 2,   radius: 18, color: '#FFFFFF' },
  ];
}

function _emitImpactParticles(x, y) {
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

// ── Debug: visualizar hitboxes (DEBUG.showHitboxes = true) ───────────────────
export function drawDebugHitboxes(ctx) {
  if (!DEBUG.showHitboxes) return;
  if (STATE.phase !== 'PLAYING' && STATE.phase !== 'PAUSED') return;

  const _f         = PM.getActive()?.fisica ?? {};
  const hitboxSize = _f.pigeonHitboxSize ?? PIGEON_HITBOX_DEFAULT;
  const vertPos    = _f.trainVerticalPos ?? TRAIN_CFG.verticalPos;
  const yShiftDbg  = STATE.selectedScenario === 'linea_3'
    ? (vertPos - 0.5) * canvas.height : 0;

  const pX = w2sx(pigeon.x) - hitboxSize / 2;
  const pY = w2sy(pigeon.y) - hitboxSize / 2 + yShiftDbg + getPigeonVerticalOffset();

  ctx.strokeStyle = 'rgba(0,255,0,0.8)';
  ctx.lineWidth = 2;
  ctx.strokeRect(pX, pY, hitboxSize, hitboxSize);

  if (yShiftDbg !== 0) {
    ctx.strokeStyle = 'rgba(80,180,255,0.6)';
    ctx.lineWidth = 1;
    ctx.strokeRect(pX, pY - yShiftDbg, hitboxSize, hitboxSize);
  }

  ctx.fillStyle = '#00FF00';
  ctx.fillRect(w2sx(pigeon.x) - 3, w2sy(pigeon.y) - 3 + getPigeonVerticalOffset(), 6, 6);

  const colZ = _f.arcadeCollisionZ ?? 600;
  const trainBoxes = STATE.selectedScenario === 'linea_3'
    ? Linea3.getTrainHitboxes()
    : obstacles
        .filter(o => o.z <= colZ && o.z >= -50)
        .map(o => {
          const s  = perspective(o.z);
          const sx = w2sx(o.x * s), sy = w2sy(o.y * s);
          const sw = o.w * s, sh = o.h * s;
          return { x: sx - sw / 2, y: sy - sh / 2, w: sw, h: sh };
        });

  for (const b of trainBoxes) {
    ctx.strokeStyle = 'rgba(255,0,0,0.7)';
    ctx.lineWidth = 1;
    // Si el hitbox es un halo (tren), pintar círculo; si es AABB (obstáculo
    // de otros escenarios), pintar el rectángulo.
    if (b.r != null) {
      ctx.beginPath();
      ctx.arc(b.cx, b.cy, b.r, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.strokeRect(b.x, b.y, b.w, b.h);
    }
    ctx.fillStyle = '#FF0000';
    ctx.fillRect(b.x + b.w / 2 - 2, b.y + b.h / 2 - 2, 4, 4);
  }
}
