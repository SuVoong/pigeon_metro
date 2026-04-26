// sprite_preview.js — Helper to render a single sprite at multiple zooms.
// Used by the inspector or the canvas panel as a small overlay.

export function drawSpritePreview(ctx, sprite, x, y, zoom = 1) {
  if (!sprite) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(zoom, zoom);

  const c = sprite.colors || {};
  const W = sprite.baseWidth  || 48;
  const H = sprite.baseHeight || 40;

  ctx.fillStyle = c.body || '#F0F0F0';
  ctx.fillRect(-W / 2, -H / 2, W, H);
  ctx.fillStyle = c.cab || '#111';
  ctx.fillRect(-W / 2, -H / 2, W, 4);
  ctx.fillRect(-W / 2,  H / 2 - 6, W, 6);
  ctx.fillStyle = c.window || '#1A2E3A';
  ctx.fillRect(-W / 2 + 4, -H / 2 + 8, W - 8, 10);
  ctx.fillStyle = c.stripe || '#1A3A8A';
  ctx.fillRect(-W / 2, 2, W, 4);
  ctx.fillStyle = c.ledBg || '#1A1A00';
  ctx.fillRect(-W / 2 + 6, H / 2 - 17, W - 12, 6);
  ctx.fillStyle = c.light || '#CC1111';
  ctx.fillRect(-W / 2 + 2, -H / 2 + 2, 3, 3);
  ctx.fillRect( W / 2 - 5, -H / 2 + 2, 3, 3);

  ctx.restore();
}
