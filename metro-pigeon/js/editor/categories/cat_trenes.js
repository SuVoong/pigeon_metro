// cat_trenes.js — Train sprite editor (reference implementation).
// Operates on preset.trenes.sprites[selectedItemId] when an item is selected,
// otherwise falls back to the first sprite (and the global trenes settings).

import * as PM from '../preset_manager.js';
import * as Modal from '../editor_modal.js';
import {
  drawSection, drawSlider, drawColor, drawDropdown,
  handleCommonHit, ROW_H, SECTION_H,
} from '../widgets/inspector_controls.js';
import { openPixelEditor } from '../widgets/pixel_canvas.js';

function _activeSprite(preset) {
  const sprites = preset?.trenes?.sprites || [];
  if (sprites.length === 0) return null;
  const sel = Modal.getSelectedItemId();
  return sprites.find(s => s.id === sel) || sprites[0];
}

export const cat_trenes = {
  id:   'trenes',
  icon: '🚇',
  name: 'Trenes',

  getInspectorTitle(preset) {
    const s = _activeSprite(preset);
    return s ? `🚇 ${s.name}` : '🚇 TRENES';
  },

  drawInspector(ctx, region, preset) {
    const hits = [];
    const s = _activeSprite(preset);
    if (!s) {
      ctx.fillStyle = '#666';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Sin sprites — pulsa + Añadir', region.x + region.w / 2,
                   region.y + 40);
      return { hits };
    }

    // Build a path prefix to the active sprite by index (mutable in place)
    const idx = preset.trenes.sprites.indexOf(s);
    const prefix = `trenes.sprites.${idx}`;

    let y = region.y;

    y = drawSection(ctx, region, y, 'TAMAÑO Y POSICIÓN');
    y = _row(hits, drawSlider(ctx, region, y, 'Ancho base',     `${prefix}.baseWidth`,       40, 200, 0));
    y = _row(hits, drawSlider(ctx, region, y, 'Alto base',      `${prefix}.baseHeight`,      30, 160, 0));
    y = _row(hits, drawSlider(ctx, region, y, 'Pos. vertical',  `${prefix}.verticalPos`,     0.2, 0.95));
    y = _row(hits, drawSlider(ctx, region, y, 'Escala global',  `${prefix}.scaleMultiplier`, 0.5, 4.0));
    y = _row(hits, drawSlider(ctx, region, y, 'Velocidad',      'trenes.speed',              0.2, 3.0));

    y = drawSection(ctx, region, y, 'PALETA DE COLOR');
    y = _row(hits, drawColor(ctx, region, y, 'Cuerpo',     `${prefix}.colors.body`));
    y = _row(hits, drawColor(ctx, region, y, 'Franja',     `${prefix}.colors.stripe`));
    y = _row(hits, drawColor(ctx, region, y, 'Cabina',     `${prefix}.colors.cab`));
    y = _row(hits, drawColor(ctx, region, y, 'Ventanas',   `${prefix}.colors.window`));
    y = _row(hits, drawColor(ctx, region, y, 'LED fondo',  `${prefix}.colors.ledBg`));
    y = _row(hits, drawColor(ctx, region, y, 'LED texto',  `${prefix}.colors.ledText`));
    y = _row(hits, drawColor(ctx, region, y, 'Luces',      `${prefix}.colors.light`));
    y = _row(hits, drawColor(ctx, region, y, 'Accesib.',   `${prefix}.colors.accessibility`));

    y = drawSection(ctx, region, y, 'ANIMACIÓN');
    y = _row(hits, drawSlider(ctx, region, y, 'FPS',           `${prefix}.animFps`,        2, 30, 0));
    y = _row(hits, drawSlider(ctx, region, y, 'LED scroll',    `${prefix}.ledScrollSpeed`, 0, 3, 2));
    y = _row(hits, drawDropdown(ctx, region, y, 'LED texto',   `${prefix}.ledStation`,
                                ['AUTO', 'METRO', 'SOL', 'ATOCHA', 'DELICIAS']));

    // Pixel editor button
    y = drawSection(ctx, region, y, 'PIXEL ART');
    y = _drawPixelButton(ctx, region, y, hits, s);

    // Lane assignment
    y = drawSection(ctx, region, y, 'CARRILES');
    const ids = preset.trenes.sprites.map(sp => sp.id);
    y = _row(hits, drawDropdown(ctx, region, y, 'Carril izq.', 'trenes.leftLaneSprite',  ids));
    y = _row(hits, drawDropdown(ctx, region, y, 'Carril der.', 'trenes.rightLaneSprite', ids));

    return { hits };
  },

  handleInput(hit, mx, my) {
    if (handleCommonHit(hit)) return true;
    if (hit.id === 'pixelEditorBtn') {
      const preset = PM.getActive();
      const s = _activeSprite(preset);
      if (s) openPixelEditor(s, () => PM.markDirty());
      return true;
    }
    return false;
  },
};

function _row(hits, result) {
  if (result.hit) hits.push(result.hit);
  return result.nextY;
}

function _drawPixelButton(ctx, region, y, hits, sprite) {
  const bx = region.x;
  const by = y + 4;
  const bw = region.w;
  const bh = 28;
  ctx.fillStyle = 'rgba(245,197,24,0.10)';
  ctx.fillRect(bx, by, bw, bh);
  ctx.strokeStyle = '#f5c518';
  ctx.lineWidth = 1;
  ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
  ctx.fillStyle = '#f5c518';
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🎨 Abrir editor pixel-a-pixel →', bx + bw / 2, by + bh / 2);
  hits.push({ id: 'pixelEditorBtn', x: bx, y: by, w: bw, h: bh });
  return by + bh + 6;
}
