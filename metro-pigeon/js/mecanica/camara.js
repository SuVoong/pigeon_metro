'use strict';
// Configuración del canvas, escalado pixel-perfect y helpers mundo→pantalla

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const scale = Math.max(1, Math.floor(Math.min(w / VIEW_W, h / VIEW_H)));
  canvas.width = VIEW_W * scale;
  canvas.height = VIEW_H * scale;
  canvas.style.width = (VIEW_W * scale) + 'px';
  canvas.style.height = (VIEW_H * scale) + 'px';
  ctx.imageSmoothingEnabled = false;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
}

window.addEventListener('resize', resize);
resize();

// Coordenadas mundo → pantalla (la paloma siempre centrada en canvas)
function w2sx(wx) { return Math.floor(wx - camera.x + VIEW_W / 2); }
function w2sy(wy) { return Math.floor(wy - camera.y + VIEW_H / 2); }
