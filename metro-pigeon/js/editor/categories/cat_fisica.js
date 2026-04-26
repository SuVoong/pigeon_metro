// cat_fisica.js — Physics & difficulty editor.

import {
  drawSection, drawSlider, drawToggle,
  handleCommonHit,
} from '../widgets/inspector_controls.js';

export const cat_fisica = {
  id:   'fisica',
  icon: '⚡',
  name: 'Física',

  getInspectorTitle() { return '⚡ FÍSICA'; },

  drawInspector(ctx, region, preset) {
    const hits = [];
    let y = region.y;

    y = drawSection(ctx, region, y, 'PALOMA');
    y = _row(hits, drawSlider(ctx, region, y, 'Velocidad',     'fisica.pigeonSpeed',         0.1, 5));
    y = _row(hits, drawSlider(ctx, region, y, 'Aceleración',   'fisica.pigeonAcceleration',  0,   1));
    y = _row(hits, drawSlider(ctx, region, y, 'Vel. máxima',   'fisica.pigeonMaxVelocity',   1,  20));
    y = _row(hits, drawSlider(ctx, region, y, 'Gravedad',      'fisica.pigeonGravity',      -1,   1));

    y = drawSection(ctx, region, y, 'COLISIONES');
    y = _row(hits, drawSlider(ctx, region, y, 'Frames inv.',   'fisica.invincibleFrames',   30, 240, 0));
    y = _row(hits, drawSlider(ctx, region, y, 'Hitbox (px)',   'fisica.pigeonHitboxSize',    8,  40, 0));
    y = _row(hits, drawSlider(ctx, region, y, 'Sacudida cám.', 'fisica.cameraShakeIntensity', 0, 30, 0));

    y = drawSection(ctx, region, y, 'CURVA DIFICULTAD');
    y = _row(hits, drawToggle(ctx, region, y, 'Activa',        'fisica.difficultyRamp.enabled'));
    y = _row(hits, drawSlider(ctx, region, y, 'Tasa/seg',      'fisica.difficultyRamp.ratePerSecond', 0,    0.5, 3));
    y = _row(hits, drawSlider(ctx, region, y, 'Mult. máx.',    'fisica.difficultyRamp.maxMultiplier', 1,    10));

    return { hits };
  },

  handleInput(hit) { return handleCommonHit(hit); },
};

function _row(hits, r) { if (r.hit) hits.push(r.hit); return r.nextY; }
