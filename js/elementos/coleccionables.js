// elementos/coleccionables.js
// Catálogo agnóstico de coleccionables: monedas, migajas y power-ups.
// El render extrae lo bueno del antiguo escenarios/metro.js (halo, brillo,
// símbolo €) y lo expone como API parametrizable.
//
// El spawn sigue en mecanica/spawning.js. Aquí sólo está definición + dibujo.

export const COLECCIONABLES = {
  coin: {
    id:    'coin',
    label: 'Moneda',
    value: 50,
    size:  8,
    color: '#ffdd44',
    haloColor: 'rgba(255,220,60,0.30)',

    /**
     * @param {number} sx, sy   Centro en pantalla.
     * @param {number} sw, sh   Tamaño en pantalla (escalado por perspectiva).
     * @param {number} scale    Factor de perspectiva (0–1+).
     */
    draw(ctx, sx, sy, sw, sh, scale) {
      const r = Math.max(1, (sw + sh) / 4);

      // Halo luminoso (visible en túnel oscuro)
      if (scale > 0.2) {
        const halo = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 3.5);
        halo.addColorStop(0,   'rgba(255,220,60,0.30)');
        halo.addColorStop(0.4, 'rgba(255,200,20,0.12)');
        halo.addColorStop(1,   'rgba(255,180,0,0)');
        ctx.fillStyle = halo;
        ctx.fillRect(sx - r * 3.5, sy - r * 3.5, r * 7, r * 7);
      }

      // Borde dorado oscuro
      ctx.fillStyle = '#c8880a';
      ctx.fillRect(sx - r, sy - r, r * 2, r * 2);

      // Cara dorada
      const cr = Math.max(1, r - Math.max(1, r * 0.15));
      ctx.fillStyle = '#ffdd44';
      ctx.fillRect(sx - cr, sy - cr, cr * 2, cr * 2);

      // Brillo superior izquierdo
      if (r > 2) {
        ctx.fillStyle = 'rgba(255,255,200,0.70)';
        ctx.fillRect(sx - cr, sy - cr, Math.max(1, cr * 0.55), Math.max(1, cr * 0.55));
      }

      // Símbolo € central (sólo si el sprite es grande)
      if (r >= 5) {
        ctx.fillStyle = '#a06010';
        ctx.fillRect(sx - 1, sy - Math.max(1, r * 0.45), 2, Math.max(1, r * 0.9));
        ctx.fillRect(sx - Math.max(1, r * 0.35), sy - 1, Math.max(1, r * 0.7), 1);
      }
    },

    getHitbox(sx, sy, sw, sh) {
      return { x: sx - sw / 2, y: sy - sh / 2, w: sw, h: sh };
    },
  },

  breadcrumb: {
    id:    'breadcrumb',
    label: 'Migaja de pan',
    value: 10,
    size:  6,
    color: '#e8c476',

    draw(ctx, sx, sy, sw, sh, scale) {
      const hw = sw / 2;
      const hh = sh / 2;

      // Halo tenue
      if (scale > 0.25) {
        const halo = ctx.createRadialGradient(sx, sy, 0, sx, sy, hw * 3);
        halo.addColorStop(0, 'rgba(210,175,90,0.20)');
        halo.addColorStop(1, 'rgba(210,175,90,0)');
        ctx.fillStyle = halo;
        ctx.fillRect(sx - hw * 3, sy - hw * 3, hw * 6, hw * 6);
      }

      // Borde de corteza
      const mg = Math.max(1, hw * 0.18);
      ctx.fillStyle = '#c8973a';
      ctx.fillRect(sx - hw, sy - hh, hw * 2, hh * 2);

      // Miga interior
      ctx.fillStyle = '#e8c476';
      ctx.fillRect(sx - hw + mg, sy - hh + mg, hw * 2 - mg * 2, hh * 2 - mg * 2);

      // Puntos de corteza
      if (hw > 3) {
        ctx.fillStyle = '#a07a3a';
        ctx.fillRect(sx - hw + mg,     sy - hh + mg,     mg, mg);
        ctx.fillRect(sx + hw - mg * 2, sy + hh - mg * 2, mg, mg);
      }

      // Sombra inferior
      ctx.fillStyle = '#8a6020';
      ctx.fillRect(sx - hw, sy + hh - Math.max(1, hh * 0.25), hw * 2, Math.max(1, hh * 0.25));
    },

    getHitbox(sx, sy, sw, sh) {
      return { x: sx - sw / 2, y: sy - sh / 2, w: sw, h: sh };
    },
  },

  // Power-up genérico (futuro): plumas extra, escudo, imán, etc.
  powerup: {
    id:    'powerup',
    label: 'Power-up',
    value: 0,
    size:  10,
    color: '#5DCAA5',

    draw(ctx, sx, sy, sw, sh, scale) {
      const r = Math.max(2, (sw + sh) / 4);
      // Halo verde azulado
      if (scale > 0.2) {
        const halo = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 4);
        halo.addColorStop(0, 'rgba(93,202,165,0.40)');
        halo.addColorStop(1, 'rgba(93,202,165,0)');
        ctx.fillStyle = halo;
        ctx.fillRect(sx - r * 4, sy - r * 4, r * 8, r * 8);
      }
      // Cuerpo (rombo)
      ctx.fillStyle = '#5DCAA5';
      ctx.beginPath();
      ctx.moveTo(sx,     sy - r);
      ctx.lineTo(sx + r, sy);
      ctx.lineTo(sx,     sy + r);
      ctx.lineTo(sx - r, sy);
      ctx.closePath();
      ctx.fill();
      // Brillo
      if (r > 3) {
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fillRect(sx - r * 0.3, sy - r * 0.7, r * 0.4, r * 0.3);
      }
    },

    getHitbox(sx, sy, sw, sh) {
      return { x: sx - sw / 2, y: sy - sh / 2, w: sw, h: sh };
    },
  },
};

export function getColeccionableDef(typeId) {
  return COLECCIONABLES[typeId] ?? null;
}

export function listColeccionableIds() {
  return Object.keys(COLECCIONABLES);
}
