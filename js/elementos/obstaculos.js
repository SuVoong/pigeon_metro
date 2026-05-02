// elementos/obstaculos.js
// Catálogo agnóstico de obstáculos: forma, dimensiones, render y hitbox.
// El spawn y movimiento siguen viviendo en mecanica/spawning.js — aquí
// está SÓLO la definición visual y geométrica de cada tipo.
//
// Nuevas líneas pueden añadir tipos sin tocar nada más: basta con
// declarar otra entrada en OBSTACULOS y ya está disponible.

// ── Helpers de color ─────────────────────────────────────────────────────────
function _hexToRgb(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function _lighten(hex, amt) {
  const [r, g, b] = _hexToRgb(hex);
  return `rgb(${Math.min(255, (r + amt * 255) | 0)},${Math.min(255, (g + amt * 255) | 0)},${Math.min(255, (b + amt * 255) | 0)})`;
}

function _darken(hex, factor) {
  const [r, g, b] = _hexToRgb(hex);
  return `rgb(${Math.round(r * factor)},${Math.round(g * factor)},${Math.round(b * factor)})`;
}

// ── Catálogo ────────────────────────────────────────────────────────────────
export const OBSTACULOS = {
  // Tubería metálica: ocupa todo el ancho del túnel a una altura concreta.
  pipe: {
    id: 'pipe',
    label: 'Tubería',
    defaultColor: '#888899',
    shadowColor:  '#444455',
    defaultH: 14,

    /**
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} sx, sy   Centro del sprite en pantalla.
     * @param {number} sw, sh   Tamaño en pantalla (ya escalado por perspectiva).
     * @param {number} scale    Factor de perspectiva (0–1+).
     * @param {string} [color]  Override del color base.
     */
    draw(ctx, sx, sy, sw, sh, scale, color) {
      const c  = color ?? OBSTACULOS.pipe.defaultColor;
      const x  = sx - sw / 2;
      const y  = sy - sh / 2;

      // Cuerpo
      ctx.fillStyle = '#787880';
      ctx.fillRect(x, y, sw, sh);

      // Highlight metálico superior
      const hh = Math.max(1, sh * 0.30);
      ctx.fillStyle = _lighten(c, 0.10);
      ctx.fillRect(x, y, sw, hh);

      // Brillo central
      ctx.fillStyle = 'rgba(200,200,210,0.5)';
      ctx.fillRect(x, y + hh * 0.2, sw, Math.max(1, hh * 0.25));

      // Sombra inferior
      ctx.fillStyle = _darken(c, 0.50);
      ctx.fillRect(x, y + sh - Math.max(1, sh * 0.20), sw, Math.max(1, sh * 0.20));

      // Bridas en los extremos (sólo si el sprite es grande)
      if (scale > 0.3) {
        const bw = Math.max(2, sh * 0.9);
        ctx.fillStyle = _darken(c, 0.70);
        ctx.fillRect(x + sw * 0.02,            y - sh * 0.1, bw, sh * 1.2);
        ctx.fillRect(x + sw - bw - sw * 0.02,  y - sh * 0.1, bw, sh * 1.2);
        ctx.fillStyle = _lighten(c, 0.05);
        ctx.fillRect(x + sw * 0.02,            y, bw, sh);
        ctx.fillRect(x + sw - bw - sw * 0.02,  y, bw, sh);
      }
    },

    /** Caja AABB centrada (en coords de pantalla). */
    getHitbox(sx, sy, sw, sh) {
      return { x: sx - sw / 2, y: sy - sh / 2, w: sw, h: sh };
    },
  },

  // Barrera amarilla: bloque corto y bajo (futuro).
  barrier: {
    id: 'barrier',
    label: 'Barrera',
    defaultColor: '#FFAA00',
    defaultH: 40,

    draw(ctx, sx, sy, sw, sh, scale, color) {
      const c = color ?? OBSTACULOS.barrier.defaultColor;
      const x = sx - sw / 2;
      const y = sy - sh / 2;
      // Cuerpo amarillo
      ctx.fillStyle = c;
      ctx.fillRect(x, y, sw, sh);
      // Bandas diagonales negras (señal de obra)
      if (scale > 0.4) {
        ctx.fillStyle = '#1a1a22';
        const stripeW = Math.max(2, sw * 0.12);
        for (let i = 0; i < 5; i++) {
          ctx.fillRect(x + i * stripeW * 2, y, stripeW, sh);
        }
      }
      // Borde superior reflectante
      ctx.fillStyle = _lighten(c, 0.30);
      ctx.fillRect(x, y, sw, Math.max(1, sh * 0.15));
    },

    getHitbox(sx, sy, sw, sh) {
      return { x: sx - sw / 2, y: sy - sh / 2, w: sw, h: sh };
    },
  },

  // Andamio (futuro): estructura vertical alta y delgada.
  scaffolding: {
    id: 'scaffolding',
    label: 'Andamio',
    defaultColor: '#888888',
    defaultH: 200,

    draw(ctx, sx, sy, sw, sh, scale, color) {
      const c = color ?? OBSTACULOS.scaffolding.defaultColor;
      const x = sx - sw / 2;
      const y = sy - sh / 2;
      // Postes verticales
      const postW = Math.max(2, sw * 0.10);
      ctx.fillStyle = c;
      ctx.fillRect(x,                y, postW, sh);
      ctx.fillRect(x + sw - postW,   y, postW, sh);
      // Travesaños horizontales
      const numRungs = 4;
      for (let i = 1; i <= numRungs; i++) {
        const ry = y + (i * sh) / (numRungs + 1);
        ctx.fillRect(x, ry - 1, sw, Math.max(1, sh * 0.04));
      }
    },

    getHitbox(sx, sy, sw, sh) {
      return { x: sx - sw / 2, y: sy - sh / 2, w: sw, h: sh };
    },
  },
};

/** Devuelve la definición de un tipo (o null si no existe). */
export function getObstaculoDef(typeId) {
  return OBSTACULOS[typeId] ?? null;
}

/** Lista de IDs registrados. */
export function listObstaculoIds() {
  return Object.keys(OBSTACULOS);
}
