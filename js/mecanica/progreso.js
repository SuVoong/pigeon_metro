// Persistencia del progreso del jugador: historial de vuelos, logros, personajes.
// Usa STATE y CHARACTERS de estado.js pero no toca canvas ni render.
//
// Todo lo "por jugador" (logros, contadores, historial) se guarda con
// localStorage NAMESPACED al perfil activo (mecanica/perfil.js). Los datos
// de personajes desbloqueados son globales (cualquier perfil los comparte).

import { STATE, CHARACTERS } from './estado.js';
import { getProfileKey }     from './perfil.js';

// ── Utilidades ────────────────────────────────────────────────────────────────

/** Formatea segundos como "MM:SS". Ej: 125 → "02:05" */
export function formatFlightTime(seconds) {
  const total = Math.floor(seconds);
  const mm = Math.floor(total / 60).toString().padStart(2, '0');
  const ss = (total % 60).toString().padStart(2, '0');
  return `${mm}:${ss}`;
}

// ── Historial de vuelos ───────────────────────────────────────────────────────

/** Guarda un vuelo en el historial (máx 10, ordenados desc por segundos).
 *  Evalúa logros relacionados (FIRST_FLIGHT, MARATHON_RUN, COMMUTER) tras
 *  registrar el vuelo y dispara el toast si alguno se desbloquea. */
export function saveFlightRecord(seconds) {
  STATE.flightHistory.push({ seconds, date: new Date().toLocaleDateString('es-ES') });
  STATE.flightHistory.sort((a, b) => b.seconds - a.seconds);
  if (STATE.flightHistory.length > 10) STATE.flightHistory.length = 10;
  try {
    localStorage.setItem(getProfileKey('history'), JSON.stringify(STATE.flightHistory));
  } catch (_) { /* */ }
  // Evaluar y mostrar toast de logros nuevos (si los hay).
  checkUnlocks();
}

/** Carga el historial persistido desde localStorage al arrancar.
 *  Migración: si no hay datos en la clave del perfil, intenta leer la clave
 *  legacy 'viajepalomero_history' para no perder el progreso de versiones
 *  anteriores (esos datos se quedan en el perfil activo). */
export function loadFlightHistory() {
  try {
    let raw = localStorage.getItem(getProfileKey('history'));
    if (!raw) {
      raw = localStorage.getItem('viajepalomero_history');
      if (raw) {
        // Migrar al perfil activo
        localStorage.setItem(getProfileKey('history'), raw);
      }
    }
    if (raw) STATE.flightHistory = JSON.parse(raw);
  } catch (_) { /* JSON inválido — ignorar */ }
}

// ── Logros ────────────────────────────────────────────────────────────────────
// Cada entrada define un objetivo evaluable contra STATE. El campo `check(state)`
// devuelve true cuando se ha conseguido. La persistencia ocurre en localStorage
// bajo la clave 'viajepalomero_achievements'.

export const ACHIEVEMENTS = [
  // ── Original ──────────────────────────────────────────────────────────────
  {
    id: 'FLYING_HIGH',
    title: 'Proeza Voladora',
    description: 'Vuela más de 10 minutos en total',
    icon: '🕊',
    unlocked: false,
    check: (state) => state.totalPlaySeconds >= 600,
  },

  // ── 5 nuevos ──────────────────────────────────────────────────────────────
  {
    id: 'FIRST_FLIGHT',
    title: 'Primer Vuelo',
    description: 'Completa tu primer trayecto en el metro',
    icon: '🌱',
    unlocked: false,
    check: (state) => state.flightHistory.length >= 1,
  },
  {
    id: 'MARATHON_RUN',
    title: 'Maratón Urbano',
    description: 'Sobrevive 5 minutos seguidos en una sola partida',
    icon: '🏆',
    unlocked: false,
    check: (state) => (state.flightHistory[0]?.seconds ?? 0) >= 300,
  },
  {
    id: 'COMMUTER',
    title: 'Habitual del Metro',
    description: 'Completa 10 trayectos diferentes',
    icon: '🎫',
    unlocked: false,
    check: (state) => state.flightHistory.length >= 10,
  },
  {
    id: 'LINE_END',
    title: 'De Terminal a Terminal',
    description: 'Llega al final de una línea entera',
    icon: '🏁',
    unlocked: false,
    check: (state) => (state.linesCompleted ?? 0) >= 1,
  },
  {
    id: 'U_TURNER',
    title: 'Cambio de Sentido',
    description: 'Da la vuelta al llegar a un terminal',
    icon: '↩',
    unlocked: false,
    check: (state) => (state.uTurnsCount ?? 0) >= 1,
  },
];

// ── Persistencia de logros (namespaced por perfil) ────────────────────────────

/** Carga los logros desbloqueados del perfil activo desde localStorage.
 *  Si no hay datos del perfil, intenta migrar las claves legacy globales. */
export function loadAchievements() {
  try {
    // Logros: clave del perfil → fallback legacy global
    let raw = localStorage.getItem(getProfileKey('achievements'));
    if (!raw) {
      raw = localStorage.getItem('viajepalomero_achievements');
      if (raw) localStorage.setItem(getProfileKey('achievements'), raw);
    }
    if (raw) {
      const saved = JSON.parse(raw);
      if (Array.isArray(saved)) {
        for (const s of saved) {
          const a = ACHIEVEMENTS.find(x => x.id === s.id);
          if (a) a.unlocked = !!s.unlocked;
        }
      }
    }

    // Contadores: clave del perfil → fallback legacy global
    let cntRaw = localStorage.getItem(getProfileKey('counters'));
    if (!cntRaw) {
      cntRaw = localStorage.getItem('viajepalomero_counters');
      if (cntRaw) localStorage.setItem(getProfileKey('counters'), cntRaw);
    }
    const counters = JSON.parse(cntRaw || '{}');
    if (typeof counters.linesCompleted   === 'number') STATE.linesCompleted   = counters.linesCompleted;
    if (typeof counters.uTurnsCount      === 'number') STATE.uTurnsCount      = counters.uTurnsCount;
    if (typeof counters.totalPlaySeconds === 'number') STATE.totalPlaySeconds = counters.totalPlaySeconds;
  } catch (_) { /* JSON inválido — ignorar */ }
}

/** Persiste el estado actual de logros + contadores en el perfil activo. */
export function saveAchievements() {
  try {
    localStorage.setItem(
      getProfileKey('achievements'),
      JSON.stringify(ACHIEVEMENTS.map(a => ({ id: a.id, unlocked: a.unlocked }))),
    );
    localStorage.setItem(
      getProfileKey('counters'),
      JSON.stringify({
        linesCompleted:   STATE.linesCompleted,
        uTurnsCount:      STATE.uTurnsCount,
        totalPlaySeconds: STATE.totalPlaySeconds,
      }),
    );
  } catch (_) { /* localStorage no disponible */ }
}

/** Reinicia STATE + ACHIEVEMENTS al estado "vacío" y carga el progreso del
 *  perfil activo. Llamar tras `setActiveProfile()` para refrescar todo. */
export function reloadProfileData() {
  // Reset de STATE
  STATE.flightHistory     = [];
  STATE.linesCompleted    = 0;
  STATE.uTurnsCount       = 0;
  STATE.totalPlaySeconds  = 0;
  STATE.achievementToast  = null;
  // Reset de logros (locked por defecto)
  for (const a of ACHIEVEMENTS) a.unlocked = false;
  // Cargar el progreso real del perfil
  loadFlightHistory();
  loadAchievements();
}

/**
 * Evalúa todos los logros y devuelve los que se han desbloqueado en esta
 * llamada (para mostrar toast en pantalla). Persiste si hay novedades.
 * @returns {Array} logros recién desbloqueados {id, title, icon}
 */
export function evaluateAchievements() {
  const newlyUnlocked = [];
  for (const a of ACHIEVEMENTS) {
    if (!a.unlocked && a.check && a.check(STATE)) {
      a.unlocked = true;
      newlyUnlocked.push({ id: a.id, title: a.title, icon: a.icon });
    }
  }
  if (newlyUnlocked.length > 0) saveAchievements();
  return newlyUnlocked;
}

// ── Personajes ────────────────────────────────────────────────────────────────

/**
 * Comprueba si algún personaje O logro bloqueado cumple su condición y lo
 * desbloquea. Si se desbloquea un logro nuevo, dispara un toast en pantalla
 * mediante STATE.achievementToast (renderizado por main.js).
 */
export function checkUnlocks() {
  // ── Personajes ──
  let changedChars = false;
  for (const char of CHARACTERS) {
    if (!char.unlocked && typeof char.unlockCondition === 'function' && char.unlockCondition(STATE)) {
      char.unlocked = true;
      changedChars  = true;
    }
  }
  if (changedChars) {
    try {
      localStorage.setItem(
        'viajepalomero_chars',
        JSON.stringify(CHARACTERS.map(c => ({ id: c.id, unlocked: c.unlocked }))),
      );
    } catch (_) { /* localStorage no disponible */ }
  }

  // ── Logros ──
  const newlyUnlocked = evaluateAchievements();
  if (newlyUnlocked.length > 0) {
    // Mostrar el primero que se desbloquea (si caen varios a la vez,
    // los siguientes se irán mostrando en futuras evaluaciones).
    const first = newlyUnlocked[0];
    STATE.achievementToast = {
      title:      first.title,
      icon:       first.icon,
      framesLeft: 240,    // ~4 segundos a 60fps
    };
  }
}

/** Carga el progreso de personajes guardado en localStorage. */
export function loadCharacterProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem('viajepalomero_chars') || '[]');
    for (const s of saved) {
      const c = CHARACTERS.find(x => x.id === s.id);
      if (c) c.unlocked = s.unlocked;
    }
  } catch (_) { /* JSON inválido — ignorar */ }
}
