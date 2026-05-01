// Captura de teclado con patrón de consumo para teclas de un solo disparo

export const keys = {};

export function initInput() {
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    keys[e.key] = true;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
      e.preventDefault();
    }
  });

  window.addEventListener('keyup', (e) => {
    keys[e.key] = false;
  });
}

// Marca una tecla como leída para que un solo evento no dispare varias acciones
export function consumeKey(k) {
  keys[k] = false;
}
