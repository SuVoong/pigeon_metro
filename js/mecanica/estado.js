// Estado global compartido — exporta canvas, paleta, fuente y mutables del juego

export const canvas = document.getElementById('game');
export const ctx = canvas.getContext('2d');

export const PAL = {
  bg: '#0d0d1a',           // fondo oscuro del túnel
  brick: '#1a1a2e',        // ladrillos de las paredes
  grout: '#111',           // mortero entre ladrillos
  concrete: '#2a2a3a',     // techo y suelo
  light: '#ffffaa',        // tubos fluorescentes
  trainYellow: '#f5c518',  // cuerpo del metro
  trainDark: '#222',       // ventanas del metro
  pipeGray: '#888',        // tuberías
  pigeonBody: '#9B9B9B',
  pigeonWing: '#555',
  pigeonTail: '#EEE',
  pigeonEye: '#cc2200',
  hud: '#ffffff',
  particle: '#ffdd55',
};

export const FONT = '8px monospace';

export const STATE = {
  // 'START' | 'ARCADE' | 'HISTORY' | 'CHARACTER' | 'ACHIEVEMENTS' | 'SETTINGS'
  // 'SCENE_EDITOR' | 'PLAYING' | 'PAUSED' | 'GAMEOVER'
  phase: 'START',
  score: 0,
  lives: 3,
  speed: 2,                 // velocidad de scroll (sube con el tiempo)
  frame: 0,                 // contador global de frames
  worldZ: 0,                // Z acumulado para perspectiva
  menuCursor: 0,            // botón resaltado en el menú principal (0–3)
  selectedCharacter: 0,     // índice del personaje elegido
  selectedScenario: 'metro',// id del escenario elegido en arcade
  selectedStartStationIndex: null, // índice de estación inicial (null ⇒ startStation por defecto)
  totalPlaySeconds: 0,      // segundos jugados acumulados (para logros)
  flightHistory: [],        // [{seconds, date}] ordenado desc, máx 10 entradas
  linesCompleted: 0,        // veces que se ha llegado a un terminal de línea
  uTurnsCount: 0,           // veces que se ha pulsado "Dar la vuelta" en fin de nivel
  achievementToast: null,   // { title, icon, framesLeft } — overlay temporal
  editorOpen: false,        // true mientras el panel de edición está visible
  cameraShake: 0,           // frames de camera shake restantes

  // ── Editor de escenarios (modo arcade) ───────────────────────────────────
  // sceneEditor: contexto activo cuando phase === 'SCENE_EDITOR'.
  // { lineId, stationIndex, stationName, returnPhase } o null.
  sceneEditor: null,
};

export const DEBUG = {
  showHitboxes: false,      // visualizar hitboxes de colisión
};

export const pigeon = {
  x: 0, y: 0,      // posición en mundo (centrada por la cámara)
  vx: 0, vy: 0,    // velocidad con easing
  wingFrame: 0,    // 0 | 1 | 2
  invincible: 0,   // frames de invulnerabilidad restantes
  stunned: 0,      // frames de aturdimiento (bloquea input)
  stunStars: [],   // array de estrellitas girando
  tilt: 0,         // inclinación visual (-1 a 1)
};

export const obstacles = [];
export const collectibles = [];
export const particles = [];

// Catálogo de personajes seleccionables.
// Las funciones update/draw se registran en main.js para evitar dependencias circulares
// (paloma.js y pidgey.js importan desde este mismo módulo).
export const CHARACTERS = [
  {
    id: 0,
    name: 'PALOMA',
    unlocked: true,
    description: 'La veterana del metro madrileño',
    hint: '',
    // update/draw se inyectan desde main.js
    update: null,
    draw:   null,
    drawPreview(ctx, cx, cy) {
      // Sprite 32×32, escala 2× → 64×64 en espacio actual (personaje.js añade 1.5×)
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(2, 2);
      // Inline del sprite paloma, frame 0 (nivel), sin tilt
      const ox = -16, oy = -16;
      const p = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(ox+x, oy+y, w, h); };
      p(12, 0,  8, 7, '#8899AA'); p(14, 0,  4, 2, '#9AABBB'); p(19, 2, 2, 2, '#FFFFFF');
      p(10, 7,  5, 2, '#4488AA'); p(15, 7,  5, 2, '#AA44AA');
      p(10, 8,  5, 1, '#2255AA'); p(15, 8,  5, 1, '#882299');
      p( 8, 9, 16,14, '#8899AA'); p(10,10, 12,10, '#DDDDEE');
      p( 8, 9,  2, 6, '#667788'); p(22, 9,  2, 6, '#667788');
      // alas frame 0 (nivel)
      p( 0,10, 8, 4, '#556677'); p(24,10, 8, 4, '#556677');
      p( 0,13, 8, 2, '#445566'); p(24,13, 8, 2, '#445566');
      p(12,23, 8, 4, '#445566'); p(11,26,10, 2, '#334455'); p(10,27,12, 1, '#223344');
      p(11,22, 2, 3, '#E8AA88'); p(19,22, 2, 3, '#E8AA88');
      p( 9,24, 4, 1, '#D09977'); p(19,24, 4, 1, '#D09977');
      ctx.restore();
    },
  },
  {
    id: 1,
    name: 'PIDGEY',
    unlocked: false,
    description: 'Pokémon #016 · Experto en vuelo',
    hint: 'Vuela 5 minutos para desbloquear',
    unlockCondition: (state) => state.totalPlaySeconds >= 300,
    update: null,
    draw:   null,
    drawPreview(ctx, cx, cy) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(2, 2);
      const ox = -16, oy = -16;
      const p = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(ox+x, oy+y, w, h); };
      // cresta
      p(13, 0, 2, 3, '#885522'); p(15, 0, 2, 4, '#885522'); p(17, 0, 2, 3, '#885522');
      p(14, 1, 4, 1, '#C8A040');
      // cabeza
      p(11, 3,10, 8, '#C8A040'); p(13, 3, 6, 3, '#DDCC88');
      // cuerpo
      p( 8,11,16,12, '#C8A040'); p(10,12,12, 9, '#EEEECC');
      p( 8,11, 2, 8, '#885522'); p(22,11, 2, 8, '#885522');
      // alas frame 0 (nivel)
      p( 0,12, 8, 5, '#885522'); p(24,12, 8, 5, '#885522');
      p( 0,16, 8, 2, '#DDCC88'); p(24,16, 8, 2, '#DDCC88');
      // cola
      p(12,23, 8, 3, '#885522'); p(13,25, 6, 2, '#DDCC88');
      p(12,26, 8, 1, '#885522'); p(11,27,10, 1, '#664411');
      // patas
      p(11,22, 2, 3, '#FF6633'); p(19,22, 2, 3, '#FF6633');
      p( 8,24, 5, 1, '#FF6633'); p(19,24, 5, 1, '#FF6633');
      p( 9,25, 1, 1, '#CC4411'); p(11,25, 1, 1, '#CC4411');
      p(19,25, 1, 1, '#CC4411'); p(21,25, 1, 1, '#CC4411');
      ctx.restore();
    },
  },
  {
    id: 2,
    name: 'RED',
    unlocked: true,
    description: 'El Angry Bird más famoso',
    hint: '',
    update: null,
    draw:   null,
    drawPreview(ctx, cx, cy) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(2, 2);
      const ox = -16, oy = -16;
      const p = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(ox+x, oy+y, w, h); };
      // cresta
      p(11, 0, 2, 5, '#991010'); p(15, 0, 2, 7, '#991010'); p(19, 0, 2, 5, '#991010');
      p(13, 2, 2, 2, '#CC1818'); p(17, 2, 2, 2, '#CC1818'); p(14, 3, 4, 2, '#CC1818');
      p(15, 1, 2, 2, '#EE3030');
      // cabeza
      p(10, 4,12, 4, '#E02020'); p( 8, 6,16, 5, '#E02020');
      p(11, 5, 9, 2, '#FF3A3A');
      p( 8, 8, 3, 1, '#3A1A0A'); p(21, 8, 3, 1, '#3A1A0A');
      // cuerpo
      p( 7,10,18, 2, '#E02020'); p( 5,12,22,10, '#E02020'); p( 7,22,18, 2, '#E02020');
      p( 5,12, 3,10, '#B80E0E'); p(24,12, 3,10, '#B80E0E');
      p(11,11,10,10, '#FF3A3A'); p(13,11, 6, 7, '#FF5540');
      // alas frame 0 (nivel)
      p( 0,13, 7, 4, '#CC1818'); p(25,13, 7, 4, '#CC1818');
      p( 0,16, 7, 2, '#8B0E0E'); p(25,16, 7, 2, '#8B0E0E');
      // cola
      p(11,23,10, 3, '#BB1414'); p(12,25, 8, 2, '#991010'); p(13,26, 6, 1, '#771010');
      // patas y pies
      p(12,24, 2, 4, '#FFAA00'); p(18,24, 2, 4, '#FFAA00');
      p( 9,27, 5, 1, '#FFAA00'); p(18,27, 5, 1, '#FFAA00');
      p( 9,28, 1, 1, '#CC7700'); p(13,28, 1, 1, '#CC7700');
      p(18,28, 1, 1, '#CC7700'); p(22,28, 1, 1, '#CC7700');
      ctx.restore();
    },
  },
];

