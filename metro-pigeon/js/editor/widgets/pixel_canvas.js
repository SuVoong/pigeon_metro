// pixel_canvas.js — Pixel-art editor (stub).
// Triggered from cat_trenes.js. For now this just shows a placeholder
// modal — the full editor with brushes/layers can be built incrementally.

let _open = false;
let _sprite = null;
let _onChange = null;

export function openPixelEditor(sprite, onChange) {
  _open = true;
  _sprite = sprite;
  _onChange = onChange;
}

export function closePixelEditor() {
  _open = false;
  _sprite = null;
  _onChange = null;
}

export function isPixelEditorOpen() { return _open; }

export function drawPixelEditor(ctx) {
  if (!_open) return;
  const cvs = ctx.canvas;
  const W = 480, H = 360;
  const x = (cvs.width  - W) / 2;
  const y = (cvs.height - H) / 2;

  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, cvs.width, cvs.height);

  ctx.fillStyle = '#0d0d1a';
  ctx.fillRect(x, y, W, H);
  ctx.strokeStyle = '#f5c518';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, W - 1, H - 1);

  ctx.fillStyle = '#f5c518';
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(`🎨 PIXEL EDITOR — ${_sprite?.name || ''}`, x + W / 2, y + 14);

  ctx.fillStyle = '#666';
  ctx.font = '11px monospace';
  ctx.fillText('(Próximamente — usa la paleta de colores en el inspector)',
               x + W / 2, y + H / 2);

  // Render the sprite pixels in a grid as preview
  const pd = _sprite?.pixelData;
  if (pd) {
    const pixSize = Math.min(8, Math.floor((H - 80) / pd.height));
    const gw = pd.width  * pixSize;
    const gh = pd.height * pixSize;
    const gx = x + (W - gw) / 2;
    const gy = y + 50;
    const palette = [null, '#F0F0F0', '#1A2E3A', '#111111', '#1A3A8A',
                     '#FF6600', '#CC1111'];
    for (let py = 0; py < pd.height; py++) {
      for (let px = 0; px < pd.width; px++) {
        const v = pd.pixels[py][px];
        const c = palette[v];
        if (!c) continue;
        ctx.fillStyle = c;
        ctx.fillRect(gx + px * pixSize, gy + py * pixSize, pixSize, pixSize);
      }
    }
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1;
    ctx.strokeRect(gx + 0.5, gy + 0.5, gw - 1, gh - 1);
  }

  // Close button
  ctx.fillStyle = '#cc3333';
  ctx.fillRect(x + W - 36, y + 8, 28, 22);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('✕', x + W - 22, y + 19);
}

export function handlePixelEditorInput(mx, my, clicked) {
  if (!_open) return false;
  if (!clicked) return true;
  // Close button hit-test (must match drawPixelEditor)
  const cvs = (window.document?.getElementById('game'));
  if (!cvs) { closePixelEditor(); return true; }
  const W = 480, H = 360;
  const x = (cvs.width - W) / 2, y = (cvs.height - H) / 2;
  if (mx >= x + W - 36 && mx < x + W - 8 && my >= y + 8 && my < y + 30) {
    closePixelEditor();
    return true;
  }
  // Click outside the modal → close
  if (mx < x || mx >= x + W || my < y || my >= y + H) {
    closePixelEditor();
  }
  return true;
}
