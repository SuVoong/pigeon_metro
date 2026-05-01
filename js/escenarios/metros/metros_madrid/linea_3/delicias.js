// Estación Delicias — primera estación jugable de la Línea 3 (modo tutorial).
// Velocidad reducida y trenes más espaciados para que el jugador aprenda
// los controles antes de subir la dificultad en estaciones siguientes.

export const EstacionDelicias = {
  name:          'Delicias',
  line:          3,
  zone:          'A',
  connections:   [9],          // también servida por la Línea 9
  isInterchange: true,

  intro: {
    message: 'Bienvenido a Delicias · Línea 3',
    duration: 180,             // ~3s a 60fps
  },

  // Modificadores de gameplay específicos de esta estación
  overrides: {
    speed:         1.5,
    spawnInterval: 120,        // más tiempo entre obstáculos
    tutorialMode:  true,       // muestra pistas la primera vez
  },

  // Hito: sobrevivir X segundos para "superar" la estación
  completionSeconds: 30,

  /**
   * Llamado por Linea3.update cuando el jugador supera el hito.
   * @param {object} linea  referencia a Linea3 (para llamar advanceStation)
   */
  onComplete(linea) {
    linea.toast = {
      text: 'Siguiente estación: Palos de la Frontera',
      framesLeft: 150,
    };
    linea.advanceStation();
  },
};
