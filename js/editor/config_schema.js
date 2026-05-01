// config_schema.js — Anatomy of a preset.
// A PRESET is the complete configuration of a level/station. Each station
// has a default preset assigned. Presets are independent and reusable.
// This file is pure data: no canvas, no localStorage, no game imports.

// ── Default pixel grid for trains (48 × 40) ───────────────────────────────────
// 0 = transparent, 1 = body, 2 = window, 3 = cab, 4 = stripe, 5 = led
function _defaultTrainPixels(W = 48, H = 40) {
  const grid = [];
  for (let y = 0; y < H; y++) {
    const row = [];
    for (let x = 0; x < W; x++) {
      // Roof + body fill
      let v = 1;
      if (y < 4 || y > H - 6) v = 3;                     // top/bottom dark band
      if (y > 8 && y < 18 && x > 4 && x < W - 5) v = 2;  // window strip
      if (y > 22 && y < 28 && x > 6 && x < W - 7) v = 5; // LED strip
      row.push(v);
    }
    grid.push(row);
  }
  return { width: W, height: H, pixels: grid };
}

// ── Master schema (deep-cloned by preset_manager when creating new presets) ──
export const PRESET_SCHEMA = {
  // ── Metadata ────────────────────────────────────────────────────────────────
  id:          'preset_default',
  name:        'Default',
  description: 'Configuración base',
  difficulty:  'medio',         // 'fácil' | 'medio' | 'difícil' | 'pesadilla'
  author:      'admin',
  createdAt:   0,
  updatedAt:   0,
  version:     1,
  builtin:     false,

  // ── 1. TRENES ───────────────────────────────────────────────────────────────
  trenes: {
    sprites: [
      {
        id: 'caf_8000',
        name: 'CAF Serie 8000',
        baseWidth: 120,
        baseHeight: 100,
        scaleMultiplier: 2.5,
        verticalPos: 0.60,
        colors: {
          body:          '#F0F0F0',
          stripe:        '#1A3A8A',
          cab:           '#111111',
          window:        '#1A2E3A',
          ledBg:         '#1A1A00',
          ledText:       '#FF6600',
          light:         '#CC1111',
          accessibility: '#1A3A8A',
        },
        pixelData:    _defaultTrainPixels(48, 40),
        ledScrollSpeed: 0.5,
        ledStation:     'AUTO',
        animFps:        8,
      },
    ],
    leftLaneSprite:  'caf_8000',
    rightLaneSprite: 'caf_8000',
    speed: 1.0,
  },

  // ── 2. OBSTÁCULOS ───────────────────────────────────────────────────────────
  obstaculos: {
    pipes: {
      enabled:     true,
      color:       '#888899',
      shadowColor: '#444455',
      thickness:   14,
      length:      400,
      heights:     [0.3, 0.5, 0.7],
    },
    barriers: {
      enabled: false,
      color:   '#FFAA00',
      width:   80,
      height:  40,
    },
    customObstacles: [],
  },

  // ── 3. COLECCIONABLES ───────────────────────────────────────────────────────
  coleccionables: {
    coins: {
      enabled:      true,
      color:        '#F5C518',
      borderColor:  '#A07000',
      size:         6,
      value:        50,
      spinSpeed:    0.1,
      magnetRadius: 0,
    },
    breadcrumbs: {
      enabled: true,
      color:   '#E8C599',
      size:    4,
      value:   10,
    },
    powerups: [],
  },

  // ── 4. DECORACIÓN ───────────────────────────────────────────────────────────
  decoracion: {
    posters: {
      enabled: true,
      density: 3,
      pool: [
        { name: 'metro_logo', colors: ['#CC1111', '#FFFFFF'] },
        { name: 'publi_1',    colors: ['#1A3A8A', '#FFFFFF'] },
      ],
    },
    signs: {
      enabled:     true,
      stationName: true,
      lineNumber:  true,
      direction:   true,
    },
    graffiti: {
      enabled: false,
      density: 1,
      colors:  ['#F5C518', '#5DCAA5'],
    },
    ambientObjects: [],
  },

  // ── 5. ILUMINACIÓN ──────────────────────────────────────────────────────────
  iluminacion: {
    bgColor:      '#050508',
    ambientColor: '#1a1a2e',
    fluorescent: {
      enabled:         true,
      color:           '#fffbe6',
      intensity:       0.6,
      flicker:         true,
      flickerInterval: 180,
      flickerVariance: 60,
    },
    fog: {
      enabled: false,
      color:   '#0a0a14',
      density: 0.3,
    },
    bloom: {
      enabled:  true,
      strength: 0.4,
    },
    shadows: {
      enabled: true,
      length:  0.8,
    },
  },

  // ── 6. SPAWN TIMELINE ───────────────────────────────────────────────────────
  spawn: {
    cycleDuration: 60,
    tracks: [
      {
        type: 'trains',
        events: [
          { time: 5,  variant: 'left',  count: 1 },
          { time: 12, variant: 'right', count: 1 },
          { time: 25, variant: 'left',  count: 2 },
          { time: 40, variant: 'right', count: 1 },
        ],
      },
      {
        type: 'pipes',
        events: [
          { time: 8,  height: 'high' },
          { time: 22, height: 'low'  },
          { time: 35, height: 'mid'  },
        ],
      },
      {
        type: 'coins',
        events: [
          { time: 6,  pattern: 'cluster', count: 5 },
          { time: 18, pattern: 'line',    count: 3 },
        ],
      },
    ],
    randomness: 0.15,
  },

  // ── 7. FÍSICA ───────────────────────────────────────────────────────────────
  fisica: {
    pigeonSpeed:         1.0,
    pigeonAcceleration:  0.15,
    pigeonMaxVelocity:   8,
    pigeonGravity:       0,
    // ── Colisiones ─────────────────────────────────────────────────────────────
    invincibleFrames:    50,    // frames de invulnerabilidad tras un golpe
    stunFrames:          30,    // frames de animación de aturdimiento
    pigeonHitboxSize:    36,    // tamaño (px) de la hitbox cuadrada de la paloma
    cameraShakeIntensity: 12,   // magnitud del shake de cámara al impactar
    arcadeCollisionZ:    600,   // distancia Z a partir de la cual se detectan colisiones (arcade)
    trainHitboxMargin:   0,     // fracción de reducción de la hitbox del tren (0=exacta, -0.1=mayor)
    trainVerticalPos:    0.50,  // posición vertical del centro del tren en pantalla (0=arriba, 1=abajo)
    difficultyRamp: {
      enabled:        true,
      ratePerSecond:  0.05,
      maxMultiplier:  3.0,
    },
  },
};

// ── Helper: deep clone (structuredClone fallback) ─────────────────────────────
export function cloneSchema(src = PRESET_SCHEMA) {
  if (typeof structuredClone === 'function') return structuredClone(src);
  return JSON.parse(JSON.stringify(src));
}

// ── Built-in presets ──────────────────────────────────────────────────────────
function _withId(base, id, name, difficulty, fisicaPatch = {}) {
  const p = cloneSchema(base);
  p.id         = id;
  p.name       = name;
  p.difficulty = difficulty;
  p.builtin    = true;
  p.author     = 'system';
  p.fisica     = { ...p.fisica, ...fisicaPatch,
                   difficultyRamp: { ...p.fisica.difficultyRamp,
                                     ...(fisicaPatch.difficultyRamp || {}) } };
  return p;
}

export const BUILTIN_PRESETS = [
  _withId(PRESET_SCHEMA, 'facil',     'Fácil',     'fácil', {
    pigeonSpeed: 0.7,
    difficultyRamp: { ratePerSecond: 0.02 },
  }),
  _withId(PRESET_SCHEMA, 'normal',    'Normal',    'medio'),
  _withId(PRESET_SCHEMA, 'dificil',   'Difícil',   'difícil', {
    pigeonSpeed: 1.3,
  }),
  _withId(PRESET_SCHEMA, 'pesadilla', 'Pesadilla', 'pesadilla', {
    pigeonSpeed: 1.8,
    invincibleFrames: 45,
    difficultyRamp: { ratePerSecond: 0.1 },
  }),
];

export const BUILTIN_PRESET_IDS = new Set(BUILTIN_PRESETS.map(p => p.id));

// ── Category metadata used by panel_categories.js ────────────────────────────
export const CATEGORIES = [
  { id: 'trenes',         icon: '🚇', name: 'Trenes',         hasItems: true  },
  { id: 'obstaculos',     icon: '🪨', name: 'Obstáculos',     hasItems: false },
  { id: 'coleccionables', icon: '🪙', name: 'Coleccionables', hasItems: false },
  { id: 'decoracion',     icon: '🎨', name: 'Decoración',     hasItems: false },
  { id: 'iluminacion',    icon: '💡', name: 'Iluminación',    hasItems: false },
  { id: 'spawn',          icon: '⏱',  name: 'Spawn',          hasItems: false },
  { id: 'fisica',         icon: '⚡', name: 'Física',         hasItems: false },
];

// ── Difficulty colors (for UI badges) ────────────────────────────────────────
export const DIFFICULTY_COLORS = {
  'fácil':     '#5DCAA5',
  'medio':     '#F5C518',
  'difícil':   '#FF8800',
  'pesadilla': '#CC2222',
};
