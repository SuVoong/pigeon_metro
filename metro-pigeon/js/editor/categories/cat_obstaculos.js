// cat_obstaculos.js — Obstacles editor.

import {
  drawSection, drawSlider, drawColor, drawToggle,
  handleCommonHit,
} from '../widgets/inspector_controls.js';

export const cat_obstaculos = {
  id:   'obstaculos',
  icon: '🪨',
  name: 'Obstáculos',

  getInspectorTitle() { return '🪨 OBSTÁCULOS'; },

  drawInspector(ctx, region, preset) {
    const hits = [];
    let y = region.y;

    y = drawSection(ctx, region, y, 'TUBERÍAS');
    y = _row(hits, drawToggle (ctx, region, y, 'Activadas',  'obstaculos.pipes.enabled'));
    y = _row(hits, drawColor  (ctx, region, y, 'Color',      'obstaculos.pipes.color'));
    y = _row(hits, drawColor  (ctx, region, y, 'Sombra',     'obstaculos.pipes.shadowColor'));
    y = _row(hits, drawSlider (ctx, region, y, 'Grosor',     'obstaculos.pipes.thickness',  4, 40, 0));
    y = _row(hits, drawSlider (ctx, region, y, 'Longitud',   'obstaculos.pipes.length',    100, 800, 0));

    y = drawSection(ctx, region, y, 'BARRERAS');
    y = _row(hits, drawToggle (ctx, region, y, 'Activadas',  'obstaculos.barriers.enabled'));
    y = _row(hits, drawColor  (ctx, region, y, 'Color',      'obstaculos.barriers.color'));
    y = _row(hits, drawSlider (ctx, region, y, 'Ancho',      'obstaculos.barriers.width',   20, 200, 0));
    y = _row(hits, drawSlider (ctx, region, y, 'Alto',       'obstaculos.barriers.height',  10, 120, 0));

    return { hits };
  },

  handleInput(hit) { return handleCommonHit(hit); },
};

function _row(hits, r) { if (r.hit) hits.push(r.hit); return r.nextY; }
