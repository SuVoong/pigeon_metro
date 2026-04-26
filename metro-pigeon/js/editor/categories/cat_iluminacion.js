// cat_iluminacion.js — Lighting editor.

import {
  drawSection, drawSlider, drawColor, drawToggle,
  handleCommonHit,
} from '../widgets/inspector_controls.js';

export const cat_iluminacion = {
  id:   'iluminacion',
  icon: '💡',
  name: 'Iluminación',

  getInspectorTitle() { return '💡 ILUMINACIÓN'; },

  drawInspector(ctx, region, preset) {
    const hits = [];
    let y = region.y;

    y = drawSection(ctx, region, y, 'COLORES BASE');
    y = _row(hits, drawColor (ctx, region, y, 'Fondo',        'iluminacion.bgColor'));
    y = _row(hits, drawColor (ctx, region, y, 'Ambiente',     'iluminacion.ambientColor'));

    y = drawSection(ctx, region, y, 'FLUORESCENTES');
    y = _row(hits, drawToggle(ctx, region, y, 'Activados',    'iluminacion.fluorescent.enabled'));
    y = _row(hits, drawColor (ctx, region, y, 'Color',        'iluminacion.fluorescent.color'));
    y = _row(hits, drawSlider(ctx, region, y, 'Intensidad',   'iluminacion.fluorescent.intensity',       0, 1));
    y = _row(hits, drawToggle(ctx, region, y, 'Parpadeo',     'iluminacion.fluorescent.flicker'));
    y = _row(hits, drawSlider(ctx, region, y, 'Frec. parpad.','iluminacion.fluorescent.flickerInterval', 30, 600, 0));
    y = _row(hits, drawSlider(ctx, region, y, 'Variación',    'iluminacion.fluorescent.flickerVariance', 0, 200, 0));

    y = drawSection(ctx, region, y, 'NIEBLA');
    y = _row(hits, drawToggle(ctx, region, y, 'Activada',     'iluminacion.fog.enabled'));
    y = _row(hits, drawColor (ctx, region, y, 'Color',        'iluminacion.fog.color'));
    y = _row(hits, drawSlider(ctx, region, y, 'Densidad',     'iluminacion.fog.density',  0, 1));

    y = drawSection(ctx, region, y, 'BLOOM Y SOMBRAS');
    y = _row(hits, drawToggle(ctx, region, y, 'Bloom',        'iluminacion.bloom.enabled'));
    y = _row(hits, drawSlider(ctx, region, y, 'Fuerza',       'iluminacion.bloom.strength', 0, 1));
    y = _row(hits, drawToggle(ctx, region, y, 'Sombras',      'iluminacion.shadows.enabled'));
    y = _row(hits, drawSlider(ctx, region, y, 'Longitud',     'iluminacion.shadows.length', 0, 2));

    return { hits };
  },

  handleInput(hit) { return handleCommonHit(hit); },
};

function _row(hits, r) { if (r.hit) hits.push(r.hit); return r.nextY; }
