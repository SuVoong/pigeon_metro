// preset_manager.js — CRUD for presets + station→preset assignment.
// Pure data layer: no canvas, no rendering. Persists via localStorage.

import { PRESET_SCHEMA, BUILTIN_PRESETS, BUILTIN_PRESET_IDS, cloneSchema }
  from './config_schema.js';

const STORAGE_KEY     = 'vp_presets';
const ASSIGNMENTS_KEY = 'vp_station_presets';

let _presets        = [];      // live array of all presets
let _activePresetId = null;
let _dirty          = false;   // unsaved changes since last persist
let _initialized    = false;

// ── Init ──────────────────────────────────────────────────────────────────────
export function init() {
  if (_initialized) return;
  _loadFromStorage();
  if (_presets.length === 0) {
    _presets = BUILTIN_PRESETS.map(p => cloneSchema(p));
    _saveToStorage();
  } else {
    // Make sure all builtins are present (added by future updates).
    for (const bp of BUILTIN_PRESETS) {
      if (!_presets.find(p => p.id === bp.id)) _presets.push(cloneSchema(bp));
    }
  }
  if (!_activePresetId || !get(_activePresetId)) _activePresetId = 'normal';
  _initialized = true;
}

// ── Read ──────────────────────────────────────────────────────────────────────
export function getAll()      { return _presets; }
export function get(id)       { return _presets.find(p => p.id === id) || null; }
export function getActive()   { return get(_activePresetId) || get('normal'); }
export function getActiveId() { return _activePresetId; }
export function isBuiltin(id) { return BUILTIN_PRESET_IDS.has(id); }
export function isDirty()     { return _dirty; }

export function setActive(id) {
  if (!get(id)) return false;
  _activePresetId = id;
  _saveToStorage();
  return true;
}

// ── Mutations on the active preset (live-edited via inspector) ───────────────
/** Marks the active preset as dirty without persisting yet. */
export function markDirty() { _dirty = true; }

/** Applies an in-place patch to the active preset, marks dirty. */
export function patchActive(path, value) {
  const p = getActive();
  if (!p) return false;
  _setPath(p, path, value);
  p.updatedAt = Date.now();
  _dirty = true;
  return true;
}

/** Persists in-memory presets (call after edits). */
export function commit() {
  _saveToStorage();
  _dirty = false;
}

// ── Create / duplicate / delete ──────────────────────────────────────────────
export function create(name, basedOn = 'normal') {
  const base   = get(basedOn) || PRESET_SCHEMA;
  const preset = cloneSchema(base);
  preset.id        = `preset_${Date.now()}`;
  preset.name      = name;
  preset.builtin   = false;
  preset.author    = 'admin';
  preset.createdAt = Date.now();
  preset.updatedAt = Date.now();
  preset.version   = 1;
  _presets.push(preset);
  _saveToStorage();
  return preset;
}

export function duplicate(id, newName) {
  const orig = get(id);
  if (!orig) return null;
  return create(newName || `${orig.name} (copia)`, id);
}

export function remove(id) {
  if (isBuiltin(id)) {
    return { ok: false, error: 'No se pueden eliminar presets predefinidos' };
  }
  _presets = _presets.filter(p => p.id !== id);
  if (_activePresetId === id) _activePresetId = 'normal';
  _saveToStorage();
  return { ok: true };
}

export function rename(id, newName) {
  const p = get(id);
  if (!p) return false;
  p.name = newName;
  p.updatedAt = Date.now();
  _saveToStorage();
  return true;
}

// ── Import / export ──────────────────────────────────────────────────────────
export function exportPreset(id) {
  const p = get(id);
  return p ? JSON.stringify(p, null, 2) : null;
}

export function exportAll() {
  return JSON.stringify({ presets: _presets, activeId: _activePresetId }, null, 2);
}

export function importPreset(jsonString) {
  try {
    const p = JSON.parse(jsonString);
    if (!p.id || !p.name) throw new Error('Falta id o name');
    p.id      = `preset_${Date.now()}`;   // force unique id
    p.builtin = false;
    p.updatedAt = Date.now();
    _presets.push(p);
    _saveToStorage();
    return { ok: true, preset: p };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// ── Station → preset assignment ──────────────────────────────────────────────
export function getStationPreset(stationName) {
  const map = _readJSON(ASSIGNMENTS_KEY) || {};
  return map[stationName] || 'normal';
}

export function setStationPreset(stationName, presetId) {
  const map = _readJSON(ASSIGNMENTS_KEY) || {};
  map[stationName] = presetId;
  try { localStorage.setItem(ASSIGNMENTS_KEY, JSON.stringify(map)); }
  catch (_) { /* localStorage unavailable */ }
}

export function getAllAssignments() {
  return _readJSON(ASSIGNMENTS_KEY) || {};
}

export function clearAssignment(stationName) {
  const map = _readJSON(ASSIGNMENTS_KEY) || {};
  delete map[stationName];
  try { localStorage.setItem(ASSIGNMENTS_KEY, JSON.stringify(map)); }
  catch (_) { /* */ }
}

// ── Internal helpers ─────────────────────────────────────────────────────────
function _loadFromStorage() {
  const data = _readJSON(STORAGE_KEY);
  if (data && Array.isArray(data.presets)) {
    _presets = data.presets;
    _activePresetId = data.activeId || null;
  }
}

function _saveToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      presets: _presets,
      activeId: _activePresetId,
    }));
  } catch (_) { /* */ }
}

function _readJSON(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (_) { return null; }
}

/** Sets a nested value by dotted path. e.g. 'fisica.pigeonSpeed' → 1.5 */
function _setPath(obj, path, value) {
  const parts = Array.isArray(path) ? path : String(path).split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    if (cur[k] == null || typeof cur[k] !== 'object') cur[k] = {};
    cur = cur[k];
  }
  cur[parts[parts.length - 1]] = value;
}

/** Reads a nested value by dotted path. Returns undefined on miss. */
export function getPath(obj, path) {
  const parts = Array.isArray(path) ? path : String(path).split('.');
  let cur = obj;
  for (const k of parts) {
    if (cur == null) return undefined;
    cur = cur[k];
  }
  return cur;
}
