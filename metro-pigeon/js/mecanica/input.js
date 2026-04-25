'use strict';
// Captura de teclado y dispatch a estados de juego

window.addEventListener('keydown', (e) => {
  keys[e.key.toLowerCase()] = true;
  if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(e.key.toLowerCase())) {
    e.preventDefault();
  }
  if (state === STATE.START && (e.key === ' ' || e.key === 'Enter')) startGame();
  if (state === STATE.PLAYING && e.key === 'Escape') state = STATE.PAUSED;
  if (state === STATE.PAUSED && (e.key === ' ' || e.key === 'Enter')) state = STATE.PLAYING;
  if (state === STATE.PAUSED && e.key === 'Escape') state = STATE.START;
  if (state === STATE.GAME_OVER && (e.key === ' ' || e.key === 'Enter')) startGame();
  if (state === STATE.GAME_OVER && e.key === 'Escape') state = STATE.START;
});

window.addEventListener('keyup', (e) => {
  keys[e.key.toLowerCase()] = false;
});
