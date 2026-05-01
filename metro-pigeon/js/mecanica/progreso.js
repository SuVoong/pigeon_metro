// Persistencia del progreso del jugador: historial de vuelos, logros, personajes.
// Usa STATE y CHARACTERS de estado.js pero no toca canvas ni render.

import { STATE, CHARACTERS } from './estado.js';

// ── Utilidades ────────────────────────────────────────────────────────────────

/** Formatea segundos como "MM:SS". Ej: 125 → "02:05" */
export function formatFlightTime(seconds) {
  const total = Math.floor(seconds);
  const mm = Math.floor(total / 60).toString().padStart(2, '0');
  const ss = (total % 60).toString().padStart(2, '0');
  return `${mm}:${ss}`;
}

// ── Historial de vuelos ───────────────────────────────────────────────────────

/** Guarda un vuelo en el historial (máx 10, ordenados desc por segundos). */
export function saveFlightRecord(seconds) {
  STATE.flightHistory.push({ seconds, date: new Date().toLocaleDateString('es-ES') });
  STATE.flightHistory.sort((a, b) => b.seconds - a.seconds);
  if (STATE.flightHistory.length > 10) STATE.flightHistory.length = 10;
  localStorage.setItem('viajepalomero_history', JSON.stringify(STATE.flightHistory));
}

/** Carga el historial persistido desde localStorage al arrancar. */
export function loadFlightHistory() {
  try {
    const raw = localStorage.getItem('viajepalomero_history');
    if (raw) STATE.flightHistory = JSON.parse(raw);
  } catch (_) { /* JSON inválido — ignorar */ }
}

// ── Logros ────────────────────────────────────────────────────────────────────

export const ACHIEVEMENTS = [
  {
    id: 'FLYING_HIGH',
    title: 'Proeza Voladora',
    description: 'Vuela más de 10 minutos en total',
    icon: '🕊',
    unlocked: false,
    check: (state) => state.totalPlaySeconds >= 600,
  },
];

// ── Personajes ────────────────────────────────────────────────────────────────

/** Comprueba si algún personaje bloqueado cumple su condición y lo desbloquea. */
export function checkUnlocks() {
  let changed = false;
  for (const char of CHARACTERS) {
    if (!char.unlocked && typeof char.unlockCondition === 'function' && char.unlockCondition(STATE)) {
      char.unlocked = true;
      changed = true;
    }
  }
  if (changed) {
    try {
      localStorage.setItem(
        'viajepalomero_chars',
        JSON.stringify(CHARACTERS.map(c => ({ id: c.id, unlocked: c.unlocked }))),
      );
    } catch (_) { /* localStorage no disponible */ }
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
