// cat_spawn.js — Spawn timeline editor.
// The actual timeline manipulation lives in panel_timeline.js; this
// inspector handles cycle duration + randomness + per-event details.

import * as PM from '../preset_manager.js';
import {
  drawSection, drawSlider,
  handleCommonHit,
} from '../widgets/inspector_controls.js';

export const cat_spawn = {
  id:   'spawn',
  icon: '⏱',
  name: 'Spawn',

  getInspectorTitle() { return '⏱ SPAWN'; },

  drawInspector(ctx, region, preset) {
    const hits = [];
    let y = region.y;

    y = drawSection(ctx, region, y, 'CICLO');
    y = _row(hits, drawSlider(ctx, region, y, 'Duración (s)', 'spawn.cycleDuration', 10, 300, 0));
    y = _row(hits, drawSlider(ctx, region, y, 'Aleatoriedad', 'spawn.randomness',     0, 1));

    // Track summary
    y = drawSection(ctx, region, y, 'TRACKS');
    const tracks = preset.spawn?.tracks || [];
    for (const t of tracks) {
      ctx.fillStyle = '#888';
      ctx.font = '10px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(`• ${t.type}`, region.x, y + 12);
      ctx.fillStyle = '#666';
      ctx.textAlign = 'right';
      ctx.fillText(`${t.events.length} eventos`, region.x + region.w, y + 12);
      y += 22;
    }

    ctx.fillStyle = '#666';
    ctx.font = '9px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('💡 Edita los eventos arrastrando', region.x, y + 18);
    ctx.fillText('   los bloques en el timeline.',     region.x, y + 32);

    return { hits };
  },

  handleInput(hit) { return handleCommonHit(hit); },
};

function _row(hits, r) { if (r.hit) hits.push(r.hit); return r.nextY; }
