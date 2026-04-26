// cat_decoracion.js — Decoration editor.

import {
  drawSection, drawSlider, drawToggle,
  handleCommonHit,
} from '../widgets/inspector_controls.js';

export const cat_decoracion = {
  id:   'decoracion',
  icon: '🎨',
  name: 'Decoración',

  getInspectorTitle() { return '🎨 DECORACIÓN'; },

  drawInspector(ctx, region, preset) {
    const hits = [];
    let y = region.y;

    y = drawSection(ctx, region, y, 'CARTELES');
    y = _row(hits, drawToggle(ctx, region, y, 'Activados',  'decoracion.posters.enabled'));
    y = _row(hits, drawSlider(ctx, region, y, 'Densidad',   'decoracion.posters.density',  0, 10, 0));

    y = drawSection(ctx, region, y, 'SEÑALÉTICA');
    y = _row(hits, drawToggle(ctx, region, y, 'Visible',    'decoracion.signs.enabled'));
    y = _row(hits, drawToggle(ctx, region, y, 'Estación',   'decoracion.signs.stationName'));
    y = _row(hits, drawToggle(ctx, region, y, 'Línea',      'decoracion.signs.lineNumber'));
    y = _row(hits, drawToggle(ctx, region, y, 'Dirección',  'decoracion.signs.direction'));

    y = drawSection(ctx, region, y, 'GRAFITIS');
    y = _row(hits, drawToggle(ctx, region, y, 'Activados',  'decoracion.graffiti.enabled'));
    y = _row(hits, drawSlider(ctx, region, y, 'Densidad',   'decoracion.graffiti.density', 0, 10, 0));

    return { hits };
  },

  handleInput(hit) { return handleCommonHit(hit); },
};

function _row(hits, r) { if (r.hit) hits.push(r.hit); return r.nextY; }
