// mecanica/perfil.js
// Sistema ligero de perfiles de jugador: cada nick ("AdminUser", "Pepe"...)
// tiene su propio progreso aislado en localStorage. Sin contraseñas — es
// un selector de cuenta, no un sistema de autenticación.
//
// Layout en localStorage:
//   vp_active_profile                              → "Pepe" (nick activo)
//   vp_profile_<sanitized>_achievements            → JSON de logros
//   vp_profile_<sanitized>_counters                → { linesCompleted, ... }
//   vp_profile_<sanitized>_history                 → array de vuelos
//
// El perfil por defecto es "Invitado". Cualquier dato guardado bajo el
// perfil activo se mantiene para esa cuenta, y al cambiar de perfil el
// progreso se reinicia/recarga sin pisar el del otro.

const ACTIVE_KEY        = 'vp_active_profile';
const DEFAULT_PROFILE   = 'Invitado';
const PROFILE_PREFIX    = 'vp_profile_';

// Sufijos de los datasets que se persisten por perfil.
// Si en el futuro se añaden más (settings, personajes), basta con
// listarlos aquí para que deleteProfile los limpie todos.
const SUFFIXES = ['achievements', 'counters', 'history'];

let _activeProfile = DEFAULT_PROFILE;

// ── Inicialización ──────────────────────────────────────────────────────────
/** Carga el perfil activo de localStorage (o establece DEFAULT_PROFILE). */
export function loadActiveProfile() {
  try {
    const stored = localStorage.getItem(ACTIVE_KEY);
    if (stored && stored.trim()) _activeProfile = stored.trim();
  } catch (_) { /* localStorage no disponible */ }
  return _activeProfile;
}

// ── Lectura ─────────────────────────────────────────────────────────────────
export function getActiveProfile() { return _activeProfile; }

/** Construye la clave namespaced del perfil activo para un dataset. */
export function getProfileKey(suffix) {
  return `${PROFILE_PREFIX}${_sanitize(_activeProfile)}_${suffix}`;
}

/** Lista todos los perfiles que tienen datos persistidos. Incluye el activo
 *  aunque aún no haya guardado nada. Devuelto ordenado alfabéticamente. */
export function listProfiles() {
  const profiles = new Set();
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(PROFILE_PREFIX)) continue;
      // vp_profile_<sanitized>_<suffix> → extraer <sanitized>
      const rest = key.slice(PROFILE_PREFIX.length);
      const lastUnder = rest.lastIndexOf('_');
      if (lastUnder <= 0) continue;
      const sanitized = rest.slice(0, lastUnder);
      profiles.add(_unsanitize(sanitized));
    }
  } catch (_) { /* */ }
  // Asegurar que el activo siempre aparece (incluso sin datos guardados todavía)
  profiles.add(_activeProfile);
  return [...profiles].sort((a, b) => a.localeCompare(b, 'es'));
}

// ── Mutación ────────────────────────────────────────────────────────────────
/** Cambia el perfil activo y persiste la elección.
 *  El llamador es responsable de llamar a reloadProfileData() después
 *  para recargar el progreso del perfil nuevo. */
export function setActiveProfile(name) {
  const clean = _normalizeName(name);
  _activeProfile = clean;
  try { localStorage.setItem(ACTIVE_KEY, clean); } catch (_) { /* */ }
}

/** Crea (=activa) un perfil nuevo. Si ya existía, simplemente lo activa. */
export function createProfile(name) {
  setActiveProfile(name);
}

/** Borra todas las claves de un perfil. Si era el activo, vuelve a Invitado. */
export function deleteProfile(name) {
  const sanitized = _sanitize(_normalizeName(name));
  try {
    for (const suffix of SUFFIXES) {
      localStorage.removeItem(`${PROFILE_PREFIX}${sanitized}_${suffix}`);
    }
  } catch (_) { /* */ }
  if (_activeProfile === name) setActiveProfile(DEFAULT_PROFILE);
}

// ── Helpers internos ────────────────────────────────────────────────────────
function _normalizeName(name) {
  const trimmed = (name ?? '').trim();
  // Limitar longitud para no llenar pantallas
  return (trimmed || DEFAULT_PROFILE).slice(0, 24);
}

/** Convierte el nick a una forma segura para usar en una clave de
 *  localStorage. Sustituye caracteres no [A-Za-z0-9-] por hex precedido
 *  de "x" para que la operación sea reversible. */
function _sanitize(name) {
  return name.replace(/[^a-zA-Z0-9-]/g, (ch) => {
    return 'x' + ch.charCodeAt(0).toString(16).padStart(4, '0');
  });
}

/** Inversa de _sanitize: recupera el nombre original a partir del sanitized. */
function _unsanitize(sanitized) {
  return sanitized.replace(/x([0-9a-f]{4})/g, (_, hex) =>
    String.fromCharCode(parseInt(hex, 16))
  );
}

// ── Constantes públicas ─────────────────────────────────────────────────────
export { DEFAULT_PROFILE };
