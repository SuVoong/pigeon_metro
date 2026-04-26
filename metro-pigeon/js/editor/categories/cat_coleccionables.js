// cat_coleccionables.js — Collectibles editor.

import {
  drawSection, drawSlider, drawColor, drawToggle,
  handleCommonHit,
} from '../widgets/inspector_controls.js';

export const cat_coleccionables = {
  id:   'coleccionables',
  icon: '🪙',
  name: 'Coleccionables',

  getInspectorTitle() { return '🪙 COLECCIONABLES'; },

  drawInspector(ctx, region, preset) {
    const hits = [];
    let y = region.y;

    y = drawSection(ctx, region, y, 'MONEDAS');
    y = _row(hits, drawToggle(ctx, region, y, 'Activadas',     'coleccionables.coins.enabled'));
    y = _row(hits, drawColor (ctx, region, y, 'Color',         'coleccionables.coins.color'));
    y = _row(hits, drawColor (ctx, region, y, 'Borde',         'coleccionables.coins.borderColor'));
    y = _row(hits, drawSlider(ctx, region, y, 'Tamaño',        'coleccionables.coins.size',         3, 16, 0));
    y = _row(hits, drawSlider(ctx, region, y, 'Valor',         'coleccionables.coins.value',       10, 500, 0));
    y = _row(hits, drawSlider(ctx, region, y, 'Vel. giro',     'coleccionables.coins.spinSpeed',    0, 1));
    y = _row(hits, drawSlider(ctx, region, y, 'Imán (px)',     'coleccionables.coins.magnetRadius', 0, 200, 0));

    y = drawSection(ctx, region, y, 'MIGAJAS');
    y = _row(hits, drawToggle(ctx, region, y, 'Activadas',     'coleccionables.breadcrumbs.enabled'));
    y = _row(hits, drawColor (ctx, region, y, 'Color',         'coleccionables.breadcrumbs.color'));
    y = _row(hits, drawSlider(ctx, region, y, 'Tamaño',        'coleccionables.breadcrumbs.size',  2, 12, 0));
    y = _row(hits, drawSlider(ctx, region, y, 'Valor',         'coleccionables.breadcrumbs.value', 1, 100, 0));

    return { hits };
  },

  handleInput(hit) { return handleCommonHit(hit); },
};

function _row(hits, r) { if (r.hit) hits.push(r.hit); return r.nextY; }
