// config_store.js — Single source of truth for all editable game configs
// Save/load via localStorage. No canvas/game imports.

export const DEFAULT_TRAIN_CONFIG = {
  // Size & position
  baseWidth:          48,
  baseHeight:         40,
  verticalPos:        0.60,
  scaleMultiplier:    2.5,
  // Colors
  bodyColor:          '#F0F0F0',
  stripeColor:        '#1A3A8A',
  cabColor:           '#111111',
  windowColor:        '#1A2E3A',
  ledBgColor:         '#1A1A00',
  ledTextColor:       '#FF6600',
  lightColor:         '#CC1111',
  // Animation
  spawnIntervalFrames: 90,
  trainSpeed:         1.0,
  maxTrainsOnScreen:  4,
};

export const DEFAULT_ENV_CONFIG = {
  // Tunnel visuals
  bgColor:            '#050508',
  concreteColor:      '#2a2a35',
  concreteLightColor: '#3a3a48',
  floorColor:         '#1e1e28',
  railColor:          '#888899',
  sleeperColor:       '#2a2218',
  lightGlowColor:     '#fffbe6',
  cableColor:         '#333340',
  // Tunnel geometry
  tunnelRadius:       180,
  vanishingPointY:    0.42,
  numRings:           6,
  // Lighting
  flickerEnabled:     true,
  flickerInterval:    180,
  // Tracks
  trackOffset:        60,
};

export const DEFAULT_GAME_CONFIG = {
  // Difficulty
  initialSpeed:       2.0,
  speedRampPerFrame:  0.0008,
  // Lives
  startingLives:      3,
  invincibleFrames:   90,
  // Hitbox
  pigeonHitboxSize:   20,
  trainHitboxMargin:  0.1,
  // Score
  scorePerFrame:      1,
  coinValue:          50,
  breadcrumbValue:    10,
};

// ── Load all configs (merge saved with defaults) ───────────────────────────────
export function loadConfigs() {
  const train = Object.assign({}, DEFAULT_TRAIN_CONFIG, _safeParse('vp_train_config'));
  const env   = Object.assign({}, DEFAULT_ENV_CONFIG,   _safeParse('vp_env_config'));
  const game  = Object.assign({}, DEFAULT_GAME_CONFIG,  _safeParse('vp_game_config'));
  return { train, env, game };
}

export function saveTrainConfig(config) {
  _normalise(config, DEFAULT_TRAIN_CONFIG);
  _saveKey('vp_train_config', config);
}

export function saveEnvConfig(config) {
  _normalise(config, DEFAULT_ENV_CONFIG);
  _saveKey('vp_env_config', config);
}

export function saveGameConfig(config) {
  _normalise(config, DEFAULT_GAME_CONFIG);
  _saveKey('vp_game_config', config);
}

export function resetToDefaults(which) {
  if (which === 'train' || which === 'all') localStorage.removeItem('vp_train_config');
  if (which === 'env'   || which === 'all') localStorage.removeItem('vp_env_config');
  if (which === 'game'  || which === 'all') localStorage.removeItem('vp_game_config');
}

export function exportConfig() {
  const { train, env, game } = loadConfigs();
  return JSON.stringify({ train, env, game }, null, 2);
}

export function importConfig(jsonString) {
  try {
    const parsed = JSON.parse(jsonString);
    if (parsed.train) saveTrainConfig(Object.assign({}, DEFAULT_TRAIN_CONFIG, parsed.train));
    if (parsed.env)   saveEnvConfig(Object.assign({}, DEFAULT_ENV_CONFIG,   parsed.env));
    if (parsed.game)  saveGameConfig(Object.assign({}, DEFAULT_GAME_CONFIG,  parsed.game));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function _safeParse(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : {};
  } catch (_) { return {}; }
}

function _saveKey(key, config) {
  try {
    localStorage.setItem(key, JSON.stringify(config));
  } catch (_) { /* localStorage no disponible */ }
}

/** Fills missing keys from defaults (does not strip extra keys). */
function _normalise(config, defaults) {
  for (const k of Object.keys(defaults)) {
    if (!(k in config)) config[k] = defaults[k];
  }
}
