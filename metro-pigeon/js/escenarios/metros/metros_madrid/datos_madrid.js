// ──────────────────────────────────────────────────────────────────────────
//  datos_madrid.js — Plano del Metro de Madrid (enero 2026)
// ──────────────────────────────────────────────────────────────────────────
//  Coordenadas normalizadas [x, y] ∈ [0, 1] con origen arriba‑izquierda.
//  Aproximación topológica del plano oficial planometromadrid.org.
//
//  Estrategia de coordenadas (opción "snap a corredores compartidos"):
//  Las estaciones se alinean a un puñado de ejes troncales para que las
//  líneas que físicamente comparten corredor se vean en paralelo y los
//  transbordos caigan en la misma fila/columna en TODAS las líneas que
//  pasan por ellos.
//
//   Verticales (mismo X):
//     · x=0.50  L1 trunk  (Plaza Castilla → Cuatro Caminos → Sol → Estación Arte)
//     · x=0.55  L10 Castellana (Plaza Castilla → Nuevos Ministerios → Greg. Marañón)
//     · x=0.66  L4 columna E (Avenida América → Diego León → Manuel Becerra)
//     · x=0.30  Príncipe Pío column (L10 W, L6 W)
//
//   Horizontales (mismo Y):
//     · y=0.36  Norte trunk (Nuevos Ministerios → Avenida América)
//     · y=0.40  Cuatro Caminos row (L1∩L2∩L6 + L7 W)
//     · y=0.48  Bilbao row (L4 trunk: San Bernardo → Bilbao → Alonso Mtnez → Velázquez)
//     · y=0.50  Goya row (L2 E-W: Goya → Manuel Becerra → Ventas → Las Rosas)
//     · y=0.55  Sol row (L2 E-W: Sevilla → Sol → Ópera)
//     · y=0.65  Atocha row (L1 SE inicio + L3 cruce)
//     · y=0.94  MetroSur row (L12 sur)
//
//   Diagonales 45° puras:
//     · L1  SE  Sol → Atocha → Pacífico → Vallecas → Valdecarros
//     · L8  NE  Nuevos Ministerios → Colombia → Mar de Cristal → T4
//     · L3  NW  Sol → Callao → Plaza España → Argüelles → Moncloa
//     · L9  SE  Sainz de Baranda → Vinateros → Rivas → Arganda
// ──────────────────────────────────────────────────────────────────────────

// ── 12 LÍNEAS DE METRO ────────────────────────────────────────────────────
// Cada estación: { name, pos: [x, y], transfers: [ids de otras líneas] }
// Se conserva `stationsLegacy` (cadenas originales) por compatibilidad.
export const MADRID_LINES = [
  // ── L1 · Pinar de Chamartín ↔ Valdecarros ──────────────────────────────
  // Trunk vertical x=0.50 desde Plaza Castilla hasta Estación del Arte.
  // Diagonal 45° SE desde Atocha hasta Valdecarros.
  {
    id: 1,
    name: 'Línea 1',
    color: '#009EE0',
    colorDark: '#0077A8',
    from: 'Pinar de Chamartín',
    to: 'Valdecarros',
    zone: 'A-B1',
    locked: true,
    stations: [
      { name: 'Pinar de Chamartín',  pos: [0.56, 0.16], transfers: [4, 'ML1'] },
      { name: 'Bambú',               pos: [0.54, 0.18], transfers: [] },
      { name: 'Chamartín',           pos: [0.52, 0.20], transfers: [10] },
      { name: 'Plaza de Castilla',   pos: [0.50, 0.22], transfers: [9, 10] },
      { name: 'Valdeacederas',       pos: [0.50, 0.26], transfers: [] },
      { name: 'Tetuán',              pos: [0.50, 0.29], transfers: [] },
      { name: 'Estrecho',            pos: [0.50, 0.32], transfers: [] },
      { name: 'Alvarado',            pos: [0.50, 0.36], transfers: [] },
      { name: 'Cuatro Caminos',      pos: [0.50, 0.40], transfers: [2, 6] },
      { name: 'Ríos Rosas',          pos: [0.50, 0.43], transfers: [] },
      { name: 'Iglesia',             pos: [0.50, 0.45], transfers: [] },
      { name: 'Bilbao',              pos: [0.50, 0.48], transfers: [4] },
      { name: 'Tribunal',            pos: [0.50, 0.51], transfers: [10] },
      { name: 'Gran Vía',            pos: [0.50, 0.53], transfers: [5] },
      { name: 'Sol',                 pos: [0.50, 0.55], transfers: [2, 3] },
      { name: 'Tirso de Molina',     pos: [0.50, 0.58], transfers: [] },
      { name: 'Antón Martín',        pos: [0.50, 0.60], transfers: [] },
      { name: 'Estación del Arte',   pos: [0.50, 0.63], transfers: [] },
      { name: 'Atocha',              pos: [0.52, 0.65], transfers: [] },
      { name: 'Menéndez Pelayo',     pos: [0.54, 0.67], transfers: [6] },
      { name: 'Pacífico',            pos: [0.56, 0.69], transfers: [6] },
      { name: 'Puente de Vallecas',  pos: [0.58, 0.71], transfers: [] },
      { name: 'Nueva Numancia',      pos: [0.60, 0.73], transfers: [] },
      { name: 'Portazgo',            pos: [0.62, 0.75], transfers: [] },
      { name: 'Buenos Aires',        pos: [0.64, 0.77], transfers: [] },
      { name: 'Alto del Arenal',     pos: [0.66, 0.79], transfers: [] },
      { name: 'Miguel Hernández',    pos: [0.68, 0.81], transfers: [] },
      { name: 'Sierra de Guadalupe', pos: [0.70, 0.83], transfers: [] },
      { name: 'Villa de Vallecas',   pos: [0.72, 0.85], transfers: [] },
      { name: 'Congosto',            pos: [0.74, 0.87], transfers: [] },
      { name: 'La Gavia',            pos: [0.76, 0.89], transfers: [] },
      { name: 'Las Suertes',         pos: [0.78, 0.91], transfers: [] },
      { name: 'Valdecarros',         pos: [0.80, 0.93], transfers: [] },
    ],
    stationsLegacy: [
      'Pinar de Chamartín','Bambú','Chamartín','Plaza de Castilla','Valdeacederas',
      'Tetuán','Estrecho','Alvarado','Cuatro Caminos','Ríos Rosas','Iglesia',
      'Bilbao','Tribunal','Gran Vía','Sol','Tirso de Molina','Antón Martín',
      'Estación del Arte','Atocha','Menéndez Pelayo','Pacífico','Puente de Vallecas',
      'Nueva Numancia','Portazgo','Buenos Aires','Alto del Arenal','Miguel Hernández',
      'Sierra de Guadalupe','Villa de Vallecas','Congosto','La Gavia','Las Suertes',
      'Valdecarros',
    ],
  },

  // ── L2 · Las Rosas ↔ Cuatro Caminos ────────────────────────────────────
  // Goya row y=0.50 hasta Goya, transición 45° a Sol row y=0.55,
  // luego transición 45° hasta San Bernardo y vuelta NE a Cuatro Caminos.
  {
    id: 2,
    name: 'Línea 2',
    color: '#D0021B',
    colorDark: '#A00015',
    from: 'Las Rosas',
    to: 'Cuatro Caminos',
    zone: 'A',
    locked: true,
    stations: [
      { name: 'Las Rosas',              pos: [0.92, 0.50], transfers: [] },
      { name: 'Avenida de Guadalajara', pos: [0.89, 0.50], transfers: [] },
      { name: 'Alsacia',                pos: [0.86, 0.50], transfers: [] },
      { name: 'La Almudena',            pos: [0.83, 0.50], transfers: [] },
      { name: 'La Elipa',               pos: [0.78, 0.50], transfers: [7] },
      { name: 'Ventas',                 pos: [0.72, 0.50], transfers: [5] },
      { name: 'Manuel Becerra',         pos: [0.66, 0.50], transfers: [6] },
      { name: 'Goya',                   pos: [0.62, 0.50], transfers: [4] },
      { name: 'Príncipe de Vergara',    pos: [0.58, 0.54], transfers: [9] },
      { name: 'Retiro',                 pos: [0.56, 0.55], transfers: [] },
      { name: 'Banco de España',        pos: [0.54, 0.55], transfers: [] },
      { name: 'Sevilla',                pos: [0.52, 0.55], transfers: [] },
      { name: 'Sol',                    pos: [0.50, 0.55], transfers: [1, 3] },
      { name: 'Ópera',                  pos: [0.46, 0.55], transfers: [5, 'R'] },
      { name: 'Santo Domingo',          pos: [0.44, 0.53], transfers: [] },
      { name: 'Noviciado',              pos: [0.42, 0.51], transfers: [10] },
      { name: 'San Bernardo',           pos: [0.42, 0.48], transfers: [4] },
      { name: 'Quevedo',                pos: [0.44, 0.46], transfers: [] },
      { name: 'Canal',                  pos: [0.46, 0.44], transfers: [7] },
      { name: 'Cuatro Caminos',         pos: [0.50, 0.40], transfers: [1, 6] },
    ],
    stationsLegacy: [
      'Las Rosas','Avenida de Guadalajara','Alsacia','La Almudena','La Elipa',
      'Ventas','Manuel Becerra','Goya','Príncipe de Vergara','Retiro',
      'Banco de España','Sevilla','Sol','Ópera','Santo Domingo','Noviciado',
      'San Bernardo','Quevedo','Canal','Cuatro Caminos',
    ],
  },

  // ── L3 · El Casar ↔ Moncloa ────────────────────────────────────────────
  // Extensión sur (2026): la L3 termina en El Casar, que es el único punto
  // de conexión con la L12 (MetroSur). Juan de la Cierva y Getafe Central
  // pertenecen exclusivamente a la L12; omitirlos de la L3 evita que ambas
  // líneas se dibujen superpuestas en el tramo horizontal y=0.97.
  // Ramal vertical en x=0.46 con diagonal a El Casar [0.34, 0.97].
  // Diagonal 45° NW desde Sol hasta Moncloa.
  {
    id: 3,
    name: 'Línea 3',
    color: '#F39200',
    colorDark: '#C27300',
    from: 'El Casar',
    to: 'Moncloa',
    zone: 'A-B2',
    locked: false,                        // ← única línea desbloqueada
    stations: [
      { name: 'El Casar',               pos: [0.34, 0.97], transfers: [12] },
      { name: 'Villaverde Alto',        pos: [0.46, 0.93], transfers: [] },
      { name: 'San Cristóbal',          pos: [0.46, 0.90], transfers: [] },
      { name: 'Villaverde Bajo',        pos: [0.46, 0.87], transfers: [] },
      { name: 'Ciudad de los Ángeles',  pos: [0.46, 0.84], transfers: [] },
      { name: 'San Fermín',             pos: [0.46, 0.81], transfers: [] },
      { name: 'Hospital 12 de Octubre', pos: [0.44, 0.78], transfers: [11] },
      { name: 'Almendrales',            pos: [0.44, 0.76], transfers: [] },
      { name: 'Legazpi',                pos: [0.42, 0.74], transfers: [6] },
      { name: 'Delicias',               pos: [0.44, 0.72], transfers: [] },
      { name: 'Palos de la Frontera',   pos: [0.46, 0.70], transfers: [6] },
      { name: 'Embajadores',            pos: [0.46, 0.63], transfers: [5] },
      { name: 'Lavapiés',               pos: [0.48, 0.62], transfers: [] },
      { name: 'Tirso de Molina',        pos: [0.50, 0.58], transfers: [1] },
      { name: 'Sol',                    pos: [0.50, 0.55], transfers: [1, 2] },
      { name: 'Callao',                 pos: [0.46, 0.53], transfers: [5] },
      { name: 'Plaza de España',        pos: [0.42, 0.49], transfers: [10] },
      { name: 'Ventura Rodríguez',      pos: [0.38, 0.45], transfers: [] },
      { name: 'Argüelles',              pos: [0.34, 0.45], transfers: [4, 6] },
      { name: 'Moncloa',                pos: [0.30, 0.40], transfers: [4, 6] },
    ],
    startStation: 'Delicias',
    stationsLegacy: [
      'El Casar','Villaverde Alto',
      'San Cristóbal','Villaverde Bajo','Ciudad de los Ángeles','San Fermín',
      'Hospital 12 de Octubre','Almendrales','Legazpi','Delicias',
      'Palos de la Frontera','Embajadores','Lavapiés','Tirso de Molina',
      'Sol','Callao','Plaza de España','Ventura Rodríguez','Argüelles','Moncloa',
    ],
  },

  // ── L4 · Argüelles ↔ Pinar de Chamartín ────────────────────────────────
  // Bilbao row y=0.48 (San Bernardo → Bilbao → Alonso Mtnez → Velázquez),
  // codo a Goya por columna x=0.62, transición a corredor x=0.66 (Diego
  // de León → Avenida América), arco 45° NE hasta Pinar de Chamartín.
  {
    id: 4,
    name: 'Línea 4',
    color: '#B25400',
    colorDark: '#7E3B00',
    from: 'Argüelles',
    to: 'Pinar de Chamartín',
    zone: 'A',
    locked: true,
    stations: [
      { name: 'Argüelles',              pos: [0.34, 0.45], transfers: [3, 6] },
      { name: 'San Bernardo',           pos: [0.42, 0.48], transfers: [2] },
      { name: 'Bilbao',                 pos: [0.50, 0.48], transfers: [1] },
      { name: 'Alonso Martínez',        pos: [0.55, 0.48], transfers: [5, 10] },
      { name: 'Colón',                  pos: [0.58, 0.48], transfers: [] },
      { name: 'Serrano',                pos: [0.60, 0.48], transfers: [] },
      { name: 'Velázquez',              pos: [0.62, 0.48], transfers: [] },
      { name: 'Goya',                   pos: [0.62, 0.50], transfers: [2] },
      { name: 'Lista',                  pos: [0.64, 0.46], transfers: [] },
      { name: 'Diego de León',          pos: [0.66, 0.42], transfers: [5, 6] },
      { name: 'Avenida de América',     pos: [0.66, 0.36], transfers: [6, 7, 9] },
      { name: 'Prosperidad',            pos: [0.68, 0.34], transfers: [] },
      { name: 'Alfonso XIII',           pos: [0.70, 0.32], transfers: [] },
      { name: 'Avenida de la Paz',      pos: [0.72, 0.30], transfers: [] },
      { name: 'Arturo Soria',           pos: [0.74, 0.28], transfers: [] },
      { name: 'Esperanza',              pos: [0.72, 0.26], transfers: [] },
      { name: 'Canillas',               pos: [0.70, 0.24], transfers: [] },
      { name: 'Mar de Cristal',         pos: [0.66, 0.26], transfers: [8] },
      { name: 'San Lorenzo',            pos: [0.64, 0.22], transfers: [] },
      { name: 'Parque de Santa María',  pos: [0.62, 0.20], transfers: [] },
      { name: 'Hortaleza',              pos: [0.60, 0.18], transfers: [] },
      { name: 'Manoteras',              pos: [0.58, 0.17], transfers: [] },
      { name: 'Pinar de Chamartín',     pos: [0.56, 0.16], transfers: [1, 'ML1'] },
    ],
    stationsLegacy: [
      'Argüelles','San Bernardo','Bilbao','Alonso Martínez','Colón','Serrano',
      'Velázquez','Goya','Lista','Diego de León','Avenida de América',
      'Prosperidad','Alfonso XIII','Avenida de la Paz','Arturo Soria','Esperanza',
      'Canillas','Mar de Cristal','San Lorenzo','Parque de Santa María',
      'Hortaleza','Manoteras','Pinar de Chamartín',
    ],
  },

  // ── L5 · Alameda de Osuna ↔ Casa de Campo ──────────────────────────────
  // Diagonal NE desde Alameda de Osuna hasta Pueblo Nuevo, fila Goya
  // y=0.50 desde Pueblo Nuevo a Ventas, columna x=0.66 desde Diego León,
  // fila Bilbao y=0.48 hasta Alonso Mtnez, columna x=0.46 desde Ópera al
  // sur, arco 45° SW hasta Casa de Campo.
  {
    id: 5,
    name: 'Línea 5',
    color: '#9CCB3B',
    colorDark: '#6E9526',
    from: 'Alameda de Osuna',
    to: 'Casa de Campo',
    zone: 'A-B1',
    locked: true,
    stations: [
      { name: 'Alameda de Osuna',     pos: [0.86, 0.30], transfers: [] },
      { name: 'El Capricho',          pos: [0.84, 0.32], transfers: [] },
      { name: 'Canillejas',           pos: [0.82, 0.34], transfers: [] },
      { name: 'Torre Arias',          pos: [0.80, 0.36], transfers: [7] },
      { name: 'Suanzes',              pos: [0.80, 0.40], transfers: [7] },
      { name: 'Ciudad Lineal',        pos: [0.80, 0.44], transfers: [7] },
      { name: 'Pueblo Nuevo',         pos: [0.78, 0.46], transfers: [7] },
      { name: 'Quintana',             pos: [0.76, 0.48], transfers: [] },
      { name: 'El Carmen',            pos: [0.74, 0.50], transfers: [7] },
      { name: 'Ventas',               pos: [0.72, 0.50], transfers: [2] },
      { name: 'Diego de León',        pos: [0.66, 0.42], transfers: [4, 6] },
      { name: 'Núñez de Balboa',      pos: [0.62, 0.46], transfers: [9] },
      { name: 'Rubén Darío',          pos: [0.58, 0.46], transfers: [] },
      { name: 'Alonso Martínez',      pos: [0.55, 0.48], transfers: [4, 10] },
      { name: 'Chueca',               pos: [0.50, 0.51], transfers: [] },
      { name: 'Gran Vía',             pos: [0.50, 0.53], transfers: [1] },
      { name: 'Callao',               pos: [0.46, 0.53], transfers: [3] },
      { name: 'Ópera',                pos: [0.46, 0.55], transfers: [2, 'R'] },
      { name: 'La Latina',            pos: [0.46, 0.58], transfers: [] },
      { name: 'Puerta de Toledo',     pos: [0.46, 0.61], transfers: [] },
      { name: 'Embajadores',          pos: [0.46, 0.63], transfers: [3] },
      { name: 'Acacias',              pos: [0.44, 0.65], transfers: [] },
      { name: 'Pirámides',            pos: [0.40, 0.66], transfers: [] },
      { name: 'Marqués de Vadillo',   pos: [0.36, 0.66], transfers: [] },
      { name: 'Urgel',                pos: [0.32, 0.64], transfers: [6] },
      { name: 'Oporto',               pos: [0.30, 0.66], transfers: [6] },
      { name: 'Vista Alegre',         pos: [0.26, 0.68], transfers: [6] },
      { name: 'Carabanchel',          pos: [0.22, 0.68], transfers: [6] },
      { name: 'Eugenia de Montijo',   pos: [0.18, 0.66], transfers: [] },
      { name: 'Aluche',               pos: [0.16, 0.62], transfers: [] },
      { name: 'Empalme',              pos: [0.16, 0.58], transfers: [] },
      { name: 'Campamento',           pos: [0.16, 0.55], transfers: [10] },
      { name: 'Casa de Campo',        pos: [0.18, 0.52], transfers: [10] },
    ],
    stationsLegacy: [
      'Alameda de Osuna','El Capricho','Canillejas','Torre Arias','Suanzes',
      'Ciudad Lineal','Pueblo Nuevo','Quintana','El Carmen','Ventas',
      'Diego de León','Núñez de Balboa','Rubén Darío','Alonso Martínez','Chueca',
      'Gran Vía','Callao','Ópera','La Latina','Puerta de Toledo','Embajadores','Acacias',
      'Pirámides','Marqués de Vadillo','Urgel','Oporto','Vista Alegre',
      'Carabanchel','Eugenia de Montijo','Aluche','Empalme','Campamento',
      'Casa de Campo',
    ],
  },

  // ── L6 · Circular ──────────────────────────────────────────────────────
  // Anillo aproximadamente elíptico alrededor del centro. Pasa por Moncloa
  // y Argüelles al W, baja por Príncipe Pío hasta Plaza Elíptica, luego E
  // por Pacífico hasta Sainz de Baranda, sube por O'Donnell y Manuel Becerra
  // hasta Avenida América, y baja por Cuatro Caminos hasta Moncloa.
  {
    id: 6,
    name: 'Línea 6 (Circular)',
    color: '#9C9A9A',
    colorDark: '#6E6C6C',
    from: 'Circular',
    to: 'Circular',
    zone: 'A',
    locked: true,
    isCircular: true,
    stations: [
      { name: 'Moncloa',                 pos: [0.30, 0.40], transfers: [3] },
      { name: 'Argüelles',               pos: [0.34, 0.45], transfers: [3, 4] },
      { name: 'Príncipe Pío',            pos: [0.30, 0.50], transfers: [10, 'R'] },
      { name: 'Puerta del Ángel',        pos: [0.28, 0.54], transfers: [] },
      { name: 'Alto de Extremadura',     pos: [0.26, 0.58], transfers: [] },
      { name: 'Lucero',                  pos: [0.24, 0.60], transfers: [] },
      { name: 'Laguna',                  pos: [0.22, 0.62], transfers: [] },
      { name: 'Carpetana',               pos: [0.24, 0.66], transfers: [] },
      { name: 'Oporto',                  pos: [0.30, 0.66], transfers: [5] },
      { name: 'Opañel',                  pos: [0.32, 0.70], transfers: [11] },
      { name: 'Plaza Elíptica',          pos: [0.34, 0.74], transfers: [11] },
      { name: 'Usera',                   pos: [0.38, 0.74], transfers: [] },
      { name: 'Legazpi',                 pos: [0.42, 0.74], transfers: [3] },
      { name: 'Arganzuela‑Planetario',   pos: [0.46, 0.72], transfers: [] },
      { name: 'Méndez Álvaro',           pos: [0.50, 0.71], transfers: [] },
      { name: 'Pacífico',                pos: [0.56, 0.69], transfers: [1] },
      { name: 'Conde de Casal',          pos: [0.62, 0.65], transfers: [9] },
      { name: 'Sainz de Baranda',        pos: [0.66, 0.59], transfers: [9] },
      { name: 'O\u2019Donnell',          pos: [0.66, 0.55], transfers: [] },
      { name: 'Manuel Becerra',          pos: [0.66, 0.50], transfers: [2] },
      { name: 'Diego de León',           pos: [0.66, 0.42], transfers: [4, 5] },
      { name: 'Avenida de América',      pos: [0.66, 0.36], transfers: [4, 7, 9] },
      { name: 'República Argentina',     pos: [0.62, 0.36], transfers: [] },
      { name: 'Nuevos Ministerios',      pos: [0.55, 0.36], transfers: [8, 10] },
      { name: 'Cuatro Caminos',          pos: [0.50, 0.40], transfers: [1, 2] },
      { name: 'Guzmán el Bueno',         pos: [0.42, 0.40], transfers: [7] },
      { name: 'Vicente Aleixandre',      pos: [0.38, 0.40], transfers: [] },
      { name: 'Ciudad Universitaria',    pos: [0.34, 0.40], transfers: [] },
      { name: 'Moncloa',                 pos: [0.30, 0.40], transfers: [3] },
    ],
    stationsLegacy: [
      'Moncloa','Argüelles','Príncipe Pío','Puerta del Ángel','Alto de Extremadura',
      'Lucero','Laguna','Carpetana','Oporto','Opañel','Plaza Elíptica','Usera',
      'Legazpi','Arganzuela-Planetario','Méndez Álvaro','Pacífico','Conde de Casal',
      'Sainz de Baranda',"O'Donnell",'Manuel Becerra','Diego de León',
      'Avenida de América','República Argentina','Nuevos Ministerios','Cuatro Caminos',
      'Guzmán el Bueno','Vicente Aleixandre','Ciudad Universitaria','Moncloa',
    ],
  },

  // ── L7 · Hospital del Henares ↔ Pitis ──────────────────────────────────
  // Tramo E horizontal y=0.42, zigzag por barrios del E, fila Goya y=0.50
  // hasta Avenida América, fila NM y=0.40 hacia el W, codo NW hasta Pitis.
  {
    id: 7,
    name: 'Línea 7',
    color: '#F0A22E',
    colorDark: '#B6791F',
    from: 'Hospital del Henares',
    to: 'Pitis',
    zone: 'A-B2',
    locked: true,
    stations: [
      { name: 'Hospital del Henares',     pos: [0.96, 0.42], transfers: [] },
      { name: 'Henares',                  pos: [0.94, 0.42], transfers: [] },
      { name: 'Jarama',                   pos: [0.92, 0.42], transfers: [] },
      { name: 'San Fernando',             pos: [0.90, 0.42], transfers: [] },
      { name: 'La Rambla',                pos: [0.88, 0.42], transfers: [] },
      { name: 'Coslada Central',          pos: [0.86, 0.42], transfers: [] },
      { name: 'Barrio del Puerto',        pos: [0.84, 0.42], transfers: [] },
      { name: 'Estadio Metropolitano',    pos: [0.82, 0.44], transfers: [] },
      { name: 'Las Musas',                pos: [0.84, 0.46], transfers: [] },
      { name: 'San Blas',                 pos: [0.82, 0.46], transfers: [] },
      { name: 'Simancas',                 pos: [0.80, 0.46], transfers: [] },
      { name: 'García Noblejas',          pos: [0.82, 0.46], transfers: [] },
      { name: 'Ascao',                    pos: [0.80, 0.46], transfers: [] },
      { name: 'Pueblo Nuevo',             pos: [0.78, 0.46], transfers: [5] },
      { name: 'Barrio de la Concepción',  pos: [0.76, 0.44], transfers: [] },
      { name: 'Parque de las Avenidas',   pos: [0.72, 0.40], transfers: [] },
      { name: 'Cartagena',                pos: [0.68, 0.38], transfers: [] },
      { name: 'Avenida de América',       pos: [0.66, 0.36], transfers: [4, 6, 9] },
      { name: 'Gregorio Marañón',         pos: [0.55, 0.42], transfers: [10] },
      { name: 'Alonso Cano',              pos: [0.52, 0.42], transfers: [] },
      { name: 'Canal',                    pos: [0.46, 0.44], transfers: [2] },
      { name: 'Islas Filipinas',          pos: [0.44, 0.42], transfers: [] },
      { name: 'Guzmán el Bueno',          pos: [0.42, 0.40], transfers: [6] },
      { name: 'Francos Rodríguez',        pos: [0.38, 0.36], transfers: [] },
      { name: 'Valdezarza',               pos: [0.36, 0.32], transfers: [] },
      { name: 'Antonio Machado',          pos: [0.34, 0.30], transfers: [] },
      { name: 'Peñagrande',               pos: [0.34, 0.28], transfers: [] },
      { name: 'Avenida de la Ilustración',pos: [0.36, 0.26], transfers: [] },
      { name: 'Lacoma',                   pos: [0.38, 0.24], transfers: [] },
      { name: 'Pitis',                    pos: [0.40, 0.22], transfers: [10] },
    ],
    stationsLegacy: [
      'Hospital del Henares','Henares','Jarama','San Fernando','La Rambla',
      'Coslada Central','Barrio del Puerto','Estadio Metropolitano','Las Musas',
      'San Blas','Simancas','García Noblejas','Ascao','Pueblo Nuevo',
      'Barrio de la Concepción','Parque de las Avenidas','Cartagena',
      'Avenida de América','Gregorio Marañón','Alonso Cano','Canal','Islas Filipinas',
      'Guzmán el Bueno','Francos Rodríguez','Valdezarza','Antonio Machado',
      'Peñagrande','Avenida de la Ilustración','Lacoma','Pitis',
    ],
  },

  // ── L8 · Nuevos Ministerios ↔ Aeropuerto T4 ────────────────────────────
  // Diagonal 45° NE puro desde NM hasta T4. Cada paso (+0.04, -0.04).
  {
    id: 8,
    name: 'Línea 8',
    color: '#EC638E',
    colorDark: '#B14868',
    from: 'Nuevos Ministerios',
    to: 'Aeropuerto T4',
    zone: 'A-B1',
    locked: true,
    stations: [
      { name: 'Nuevos Ministerios',     pos: [0.55, 0.36], transfers: [6, 10] },
      { name: 'Colombia',               pos: [0.62, 0.30], transfers: [9] },
      { name: 'Pinar del Rey',          pos: [0.64, 0.28], transfers: [] },
      { name: 'Mar de Cristal',         pos: [0.66, 0.26], transfers: [4] },
      { name: 'Feria de Madrid',        pos: [0.74, 0.24], transfers: [] },
      { name: 'Barajas',                pos: [0.82, 0.22], transfers: [] },
      { name: 'Aeropuerto T1‑T2‑T3',    pos: [0.88, 0.20], transfers: [] },
      { name: 'Aeropuerto T4',          pos: [0.92, 0.18], transfers: [] },
    ],
    stationsLegacy: [
      'Nuevos Ministerios','Colombia','Pinar del Rey','Mar de Cristal',
      'Feria de Madrid','Barajas','Aeropuerto T1-T2-T3','Aeropuerto T4',
    ],
  },

  // ── L9 · Paco de Lucía ↔ Arganda del Rey ───────────────────────────────
  // Tramo norte zigzag, paso por Plaza Castilla, columna E hasta Avenida
  // América, baja por Núñez de Balboa hasta Sainz de Baranda, diagonal
  // 45° SE pura hasta Arganda del Rey.
  {
    id: 9,
    name: 'Línea 9',
    color: '#A05BAB',
    colorDark: '#76407F',
    from: 'Paco de Lucía',
    to: 'Arganda del Rey',
    zone: 'A-B3',
    locked: true,
    stations: [
      { name: 'Paco de Lucía',          pos: [0.40, 0.10], transfers: [] },
      { name: 'Mirasierra',             pos: [0.42, 0.10], transfers: [] },
      { name: 'Herrera Oria',           pos: [0.44, 0.12], transfers: [] },
      { name: 'Barrio del Pilar',       pos: [0.46, 0.16], transfers: [] },
      { name: 'Ventilla',               pos: [0.48, 0.20], transfers: [] },
      { name: 'Plaza de Castilla',      pos: [0.50, 0.22], transfers: [1, 10] },
      { name: 'Duque de Pastrana',      pos: [0.56, 0.24], transfers: [] },
      { name: 'Pío XII',                pos: [0.60, 0.26], transfers: [] },
      { name: 'Colombia',               pos: [0.62, 0.30], transfers: [8] },
      { name: 'Concha Espina',          pos: [0.64, 0.32], transfers: [] },
      { name: 'Cruz del Rayo',          pos: [0.65, 0.34], transfers: [] },
      { name: 'Avenida de América',     pos: [0.66, 0.36], transfers: [4, 6, 7] },
      { name: 'Núñez de Balboa',        pos: [0.62, 0.46], transfers: [5] },
      { name: 'Príncipe de Vergara',    pos: [0.58, 0.54], transfers: [2] },
      { name: 'Ibiza',                  pos: [0.62, 0.55], transfers: [] },
      { name: 'Sainz de Baranda',       pos: [0.66, 0.59], transfers: [6] },
      { name: 'Estrella',               pos: [0.68, 0.61], transfers: [] },
      { name: 'Vinateros',              pos: [0.70, 0.63], transfers: [] },
      { name: 'Artilleros',             pos: [0.72, 0.65], transfers: [] },
      { name: 'Pavones',                pos: [0.74, 0.67], transfers: [] },
      { name: 'Valdebernardo',          pos: [0.76, 0.69], transfers: [] },
      { name: 'Vicálvaro',              pos: [0.78, 0.71], transfers: [] },
      { name: 'San Cipriano',           pos: [0.80, 0.73], transfers: [] },
      { name: 'Puerta de Arganda',      pos: [0.82, 0.75], transfers: [] },
      { name: 'Rivas Urbanizaciones',   pos: [0.84, 0.77], transfers: [] },
      { name: 'Rivas Futura',           pos: [0.86, 0.79], transfers: [] },
      { name: 'Rivas Vaciamadrid',      pos: [0.88, 0.81], transfers: [] },
      { name: 'La Poveda',              pos: [0.90, 0.83], transfers: [] },
      { name: 'Arganda del Rey',        pos: [0.92, 0.85], transfers: [] },
    ],
    stationsLegacy: [
      'Paco de Lucía','Mirasierra','Herrera Oria','Barrio del Pilar','Ventilla',
      'Plaza de Castilla','Duque de Pastrana','Pío XII','Colombia','Concha Espina',
      'Cruz del Rayo','Avenida de América','Núñez de Balboa','Príncipe de Vergara',
      'Ibiza','Sainz de Baranda','Estrella','Vinateros','Artilleros','Pavones',
      'Valdebernardo','Vicálvaro','San Cipriano','Puerta de Arganda',
      'Rivas Urbanizaciones','Rivas Futura','Rivas Vaciamadrid','La Poveda',
      'Arganda del Rey',
    ],
  },

  // ── L10 · Hospital Infanta Sofía ↔ Puerta del Sur ──────────────────────
  // Trunk Castellana x=0.55 desde Plaza Castilla hasta Alonso Martínez.
  // Fila Sol y=0.55 (un poco arriba) hacia el W, transición a Príncipe Pío,
  // arco SW hasta Puerta del Sur.
  {
    id: 10,
    name: 'Línea 10',
    color: '#003C8E',
    colorDark: '#002760',
    from: 'Hospital Infanta Sofía',
    to: 'Puerta del Sur',
    zone: 'A-B2',
    locked: true,
    stations: [
      { name: 'Hospital Infanta Sofía',   pos: [0.62, 0.04], transfers: [] },
      { name: 'Reyes Católicos',          pos: [0.62, 0.06], transfers: [] },
      { name: 'Baunatal',                 pos: [0.62, 0.08], transfers: [] },
      { name: 'Manuel de Falla',          pos: [0.62, 0.10], transfers: [] },
      { name: 'Marqués de la Valdavia',   pos: [0.62, 0.12], transfers: [] },
      { name: 'La Moraleja',              pos: [0.60, 0.14], transfers: [] },
      { name: 'La Granja',                pos: [0.58, 0.14], transfers: [] },
      { name: 'Ronda de la Comunicación', pos: [0.58, 0.16], transfers: [] },
      { name: 'Las Tablas',               pos: [0.58, 0.18], transfers: ['ML1'] },
      { name: 'Montecarmelo',             pos: [0.56, 0.18], transfers: [] },
      { name: 'Tres Olivos',              pos: [0.54, 0.18], transfers: ['ML1'] },
      { name: 'Fuencarral',               pos: [0.54, 0.20], transfers: [] },
      { name: 'Begoña',                   pos: [0.53, 0.20], transfers: [] },
      { name: 'Chamartín',                pos: [0.52, 0.20], transfers: [1] },
      { name: 'Plaza de Castilla',        pos: [0.50, 0.22], transfers: [1, 9] },
      { name: 'Cuzco',                    pos: [0.55, 0.27], transfers: [] },
      { name: 'Santiago Bernabéu',        pos: [0.55, 0.32], transfers: [] },
      { name: 'Nuevos Ministerios',       pos: [0.55, 0.36], transfers: [6, 8] },
      { name: 'Gregorio Marañón',         pos: [0.55, 0.42], transfers: [7] },
      { name: 'Alonso Martínez',          pos: [0.55, 0.48], transfers: [4, 5] },
      { name: 'Tribunal',                 pos: [0.50, 0.51], transfers: [1] },
      { name: 'Plaza de España',          pos: [0.42, 0.49], transfers: [3] },
      { name: 'Príncipe Pío',             pos: [0.30, 0.50], transfers: [6, 'R'] },
      { name: 'Lago',                     pos: [0.26, 0.52], transfers: [] },
      { name: 'Batán',                    pos: [0.22, 0.54], transfers: [] },
      { name: 'Casa de Campo',            pos: [0.18, 0.52], transfers: [5] },
      { name: 'Colonia Jardín',           pos: [0.14, 0.58], transfers: ['ML2', 'ML3'] },
      { name: 'Aviación Española',        pos: [0.16, 0.66], transfers: [] },
      { name: 'Cuatro Vientos',           pos: [0.16, 0.72], transfers: [] },
      { name: 'Joaquín Vilumbrales',      pos: [0.16, 0.80], transfers: [12] },
      { name: 'Puerta del Sur',           pos: [0.20, 0.86], transfers: [12] },
    ],
    stationsLegacy: [
      'Hospital Infanta Sofía','Reyes Católicos','Baunatal','Manuel de Falla',
      'Marqués de la Valdavia','La Moraleja','La Granja','Ronda de la Comunicación',
      'Las Tablas','Montecarmelo','Tres Olivos','Fuencarral','Begoña','Chamartín',
      'Plaza de Castilla','Cuzco','Santiago Bernabéu','Nuevos Ministerios',
      'Gregorio Marañón','Alonso Martínez','Tribunal','Plaza de España','Príncipe Pío',
      'Lago','Batán','Casa de Campo','Colonia Jardín','Aviación Española',
      'Cuatro Vientos','Joaquín Vilumbrales','Puerta del Sur',
    ],
  },

  // ── L11 · Plaza Elíptica ↔ La Fortuna ──────────────────────────────────
  // Diagonal 45° SW puro desde Plaza Elíptica hasta La Fortuna.
  {
    id: 11,
    name: 'Línea 11',
    color: '#0F8741',
    colorDark: '#0A5E2D',
    from: 'Plaza Elíptica',
    to: 'La Fortuna',
    zone: 'B1',
    locked: true,
    stations: [
      { name: 'Plaza Elíptica',         pos: [0.34, 0.74], transfers: [6] },
      { name: 'Abrantes',               pos: [0.32, 0.76], transfers: [] },
      { name: 'Pan Bendito',            pos: [0.30, 0.78], transfers: [] },
      { name: 'San Francisco',          pos: [0.28, 0.80], transfers: [] },
      { name: 'Carabanchel Alto',       pos: [0.26, 0.82], transfers: [] },
      { name: 'La Peseta',              pos: [0.24, 0.84], transfers: [] },
      { name: 'La Fortuna',             pos: [0.22, 0.86], transfers: [] },
    ],
    stationsLegacy: [
      'Plaza Elíptica','Abrantes','Pan Bendito','San Francisco','Carabanchel Alto',
      'La Peseta','La Fortuna',
    ],
  },

  // ── L12 · MetroSur (Circular) ──────────────────────────────────────────
  // Anillo en y > 0.86 alrededor de Móstoles/Fuenlabrada/Getafe/Leganés.
  // Comparte Getafe Central, Juan de la Cierva y El Casar con L3.
  {
    id: 12,
    name: 'MetroSur (L12)',
    color: '#A99000',
    colorDark: '#7A6600',
    from: 'Puerta del Sur',
    to: 'Puerta del Sur',
    zone: 'B1-B2',
    locked: true,
    isCircular: true,
    // Recorrido en sentido horario desde Puerta del Sur (NW del óvalo):
    //   Alcorcón (lado N) → Móstoles (lado W) → Fuenlabrada (lado S) →
    //   Getafe (lado E) → El Casar (transbordo L3) → Leganés (vuelta N←E)
    //   → Puerta del Sur (cierra el círculo).
    // El Casar comparte coordenadas con su entrada en L3 (único transbordo).
    stations: [
      { name: 'Puerta del Sur',              pos: [0.20, 0.86], transfers: [10] },
      { name: 'Parque de Lisboa',            pos: [0.18, 0.87], transfers: [] },
      { name: 'Alcorcón Central',            pos: [0.16, 0.87], transfers: [] },
      { name: 'Parque Oeste',                pos: [0.14, 0.88], transfers: [] },
      { name: 'Universidad Rey Juan Carlos', pos: [0.12, 0.89], transfers: [] },
      { name: 'Móstoles Central',            pos: [0.10, 0.91], transfers: [] },
      { name: 'Pradillo',                    pos: [0.08, 0.93], transfers: [] },
      { name: 'Hospital de Móstoles',        pos: [0.08, 0.95], transfers: [] },
      { name: 'Manuela Malasaña',            pos: [0.10, 0.97], transfers: [] },
      { name: 'Loranca',                     pos: [0.12, 0.98], transfers: [] },
      { name: 'Hospital de Fuenlabrada',     pos: [0.15, 0.98], transfers: [] },
      { name: 'Parque Europa',               pos: [0.18, 0.98], transfers: [] },
      { name: 'Fuenlabrada Central',         pos: [0.21, 0.98], transfers: [] },
      { name: 'Parque de los Estados',       pos: [0.24, 0.98], transfers: [] },
      { name: 'Arroyo Culebro',              pos: [0.27, 0.98], transfers: [] },
      { name: 'Conservatorio',               pos: [0.30, 0.98], transfers: [] },
      { name: 'Alonso de Mendoza',           pos: [0.33, 0.98], transfers: [] },
      { name: 'Getafe Central',              pos: [0.38, 0.98], transfers: [] },
      { name: 'Juan de la Cierva',           pos: [0.36, 0.975], transfers: [] },
      { name: 'El Casar',                    pos: [0.34, 0.97], transfers: [3] },
      { name: 'Los Espartales',              pos: [0.34, 0.95], transfers: [] },
      { name: 'El Bercial',                  pos: [0.32, 0.93], transfers: [] },
      { name: 'El Carrascal',                pos: [0.30, 0.92], transfers: [] },
      { name: 'Julián Besteiro',             pos: [0.28, 0.91], transfers: [] },
      { name: 'Casa del Reloj',              pos: [0.26, 0.90], transfers: [] },
      { name: 'Hospital Severo Ochoa',       pos: [0.25, 0.89], transfers: [] },
      { name: 'Leganés Central',             pos: [0.24, 0.88], transfers: [] },
      { name: 'San Nicasio',                 pos: [0.22, 0.87], transfers: [] },
      { name: 'Puerta del Sur',              pos: [0.20, 0.86], transfers: [10] },
    ],
    stationsLegacy: [
      'Puerta del Sur','Parque de Lisboa','Alcorcón Central','Parque Oeste',
      'Universidad Rey Juan Carlos','Móstoles Central','Pradillo','Hospital de Móstoles',
      'Manuela Malasaña','Loranca','Hospital de Fuenlabrada','Parque Europa',
      'Fuenlabrada Central','Parque de los Estados','Arroyo Culebro','Conservatorio',
      'Alonso de Mendoza','Getafe Central','Juan de la Cierva','El Casar',
      'Los Espartales','El Bercial','El Carrascal','Julián Besteiro','Casa del Reloj',
      'Hospital Severo Ochoa','Leganés Central','San Nicasio','Puerta del Sur',
    ],
  },
];

// ── METRO LIGERO (ML1, ML2, ML3) ──────────────────────────────────────────
// (Ocultas en el render actual; datos preservados por si se reactivan).
export const METRO_LIGERO = [
  {
    id: 'ML1',
    name: 'Metro Ligero 1',
    color: '#70C5E8',
    colorDark: '#4A9BBE',
    from: 'Pinar de Chamartín',
    to: 'Las Tablas',
    zone: 'A',
    locked: true,
    stations: [
      { name: 'Pinar de Chamartín',  pos: [0.56, 0.16], transfers: [1, 4] },
      { name: 'Fuente de la Mora',   pos: [0.58, 0.18], transfers: [] },
      { name: 'Virgen del Cortijo',  pos: [0.58, 0.20], transfers: [] },
      { name: 'Antonio Saura',       pos: [0.60, 0.20], transfers: [] },
      { name: 'Álvarez de Villaamil',pos: [0.60, 0.18], transfers: [] },
      { name: 'María Tudor',         pos: [0.58, 0.18], transfers: [] },
      { name: 'Blasco Ibáñez',       pos: [0.58, 0.20], transfers: [] },
      { name: 'Palas de Rey',        pos: [0.56, 0.20], transfers: [] },
      { name: 'Tres Olivos',         pos: [0.54, 0.18], transfers: [10] },
      { name: 'Las Tablas',          pos: [0.58, 0.18], transfers: [10] },
    ],
  },
  {
    id: 'ML2',
    name: 'Metro Ligero 2',
    color: '#9B5BA5',
    colorDark: '#6E3F75',
    from: 'Colonia Jardín',
    to: 'Estación de Aravaca',
    zone: 'A-B1',
    locked: true,
    stations: [
      { name: 'Colonia Jardín',      pos: [0.14, 0.58], transfers: [10, 'ML3'] },
      { name: 'Prado del Rey',       pos: [0.12, 0.55], transfers: [] },
      { name: 'Somosaguas Sur',      pos: [0.10, 0.52], transfers: [] },
      { name: 'Somosaguas Centro',   pos: [0.08, 0.50], transfers: [] },
      { name: 'Pozuelo Oeste',       pos: [0.06, 0.48], transfers: [] },
      { name: 'Bélgica',             pos: [0.06, 0.46], transfers: [] },
      { name: 'Dos Castillas',       pos: [0.05, 0.44], transfers: [] },
      { name: 'Campus de Somosaguas',pos: [0.04, 0.43], transfers: [] },
      { name: 'Berna',               pos: [0.03, 0.42], transfers: [] },
      { name: 'San Juan de la Cruz', pos: [0.04, 0.40], transfers: [] },
      { name: 'Estación de Aravaca', pos: [0.06, 0.38], transfers: [] },
    ],
  },
  {
    id: 'ML3',
    name: 'Metro Ligero 3',
    color: '#D62E7C',
    colorDark: '#9E215C',
    from: 'Colonia Jardín',
    to: 'Puerta de Boadilla',
    zone: 'A-B2',
    locked: true,
    stations: [
      { name: 'Colonia Jardín',      pos: [0.14, 0.58], transfers: [10, 'ML2'] },
      { name: 'Ciudad de la Imagen', pos: [0.12, 0.62], transfers: [] },
      { name: 'José Isbert',         pos: [0.10, 0.65], transfers: [] },
      { name: 'Cocheras',            pos: [0.08, 0.68], transfers: [] },
      { name: 'Retamares',           pos: [0.07, 0.71], transfers: [] },
      { name: 'Montepríncipe',       pos: [0.05, 0.74], transfers: [] },
      { name: 'Prado de Somosaguas', pos: [0.04, 0.76], transfers: [] },
      { name: 'Avenida de Europa',   pos: [0.03, 0.78], transfers: [] },
      { name: 'Puerta de Boadilla',  pos: [0.02, 0.80], transfers: [] },
    ],
  },
];

// ── RAMAL R · Ópera ↔ Príncipe Pío ────────────────────────────────────────
export const RAMAL_R = {
  id: 'R',
  name: 'Ramal Ópera‑Príncipe Pío',
  color: '#005AAB',
  colorDark: '#003C76',
  from: 'Ópera',
  to: 'Príncipe Pío',
  zone: 'A',
  locked: true,
  stations: [
    { name: 'Ópera',         pos: [0.46, 0.55], transfers: [2, 5] },
    { name: 'Príncipe Pío',  pos: [0.30, 0.50], transfers: [6, 10] },
  ],
};

// ── ZONAS TARIFARIAS (elipses concéntricas en escala de grises) ───────
//
//  Las zonas se pintan de exterior (más oscura) a interior (más clara),
//  replicando el gradiente del plano oficial (fondo claro en Zona A,
//  progresivamente más oscuro hacia B3) adaptado al fondo negro del juego.
//
//  Radios calibrados contra las estaciones del plano enero 2026:
//    · Zona A  cubre el interior de la L6 Circular + pequeño margen.
//              Borde: Moncloa [0.30], Manuel Becerra [0.66], Legazpi [0.74].
//    · Zona B1 alcanza: Alameda de Osuna [0.86,0.30], Paco de Lucía [0.40,0.10],
//              Puerta del Sur [0.20,0.86], Suanzes/Ciudad Lineal [0.80].
//    · Zona B2 alcanza: Hospital del Henares [0.96,0.42], Rivas Vaciamadrid
//              [0.88,0.81], extremos de MetroNorte.
//    · Zona B3 cubre todo el rectángulo de datos (Arganda del Rey [0.92,0.85]).
//
//  Escala de grises — diferencia entre capas progresivamente mayor hacia el
//  centro para maximizar la legibilidad sobre fondo #000:
//    B3: +0 (base ~4 %), B2: +9 (7.5 %), B1: +17 (17.6 %), A: +18 (29 %)
export const ZONES = [
  {
    key: 'B3',
    label: 'Zona B3',
    color: '#0A0A0A',                    // 4 % — casi negro (exterior)
    shape: { type: 'ellipse', center: [0.50, 0.53], rx: 0.52, ry: 0.52 },
    positions: [[0.93, 0.91]],
  },
  {
    key: 'B2',
    label: 'Zona B2',
    color: '#131313',                    // 7.5 %
    shape: { type: 'ellipse', center: [0.50, 0.53], rx: 0.48, ry: 0.49 },
    positions: [[0.08, 0.35], [0.92, 0.95]],
  },
  {
    key: 'B1',
    label: 'Zona B1',
    color: '#1E1E1E',                    // 12 %
    shape: { type: 'ellipse', center: [0.50, 0.53], rx: 0.44, ry: 0.46 },
    positions: [[0.87, 0.13], [0.90, 0.49], [0.15, 0.87]],
  },
  {
    key: 'A',
    label: 'Zona A',
    color: '#2E2E2E',                    // 18 % — más visible (interior)
    shape: { type: 'ellipse', center: [0.49, 0.55], rx: 0.24, ry: 0.22 },
    positions: [[0.65, 0.22], [0.19, 0.54], [0.62, 0.87]],
  },
];

// ── ETIQUETAS DECORATIVAS EXTERIORES (servicios de superficie) ────────────
export const EXTERNAL_LABELS = [
  { text: 'MetroNorte', pos: [0.62, 0.02], color: '#888888', size: 10 },
  { text: 'MetroEste',  pos: [0.96, 0.50], color: '#888888', size: 10 },
  { text: 'MetroSur',   pos: [0.18, 0.99], color: '#888888', size: 10 },
  { text: 'TFM',        pos: [0.96, 0.78], color: '#888888', size: 10 },
];

// ── ESTACIONES DE INTERCAMBIO (transbordo) ──────────────────────────────
// Lista canónica de transbordos del Metro de Madrid (33 oficiales + El
// Casar como ampliación L3↔L12 de 2026). Cada transbordo dibuja un nodo
// blanco con borde negro y, al pulsar, abre el selector de línea.
export const INTERCHANGES = [
  { name: 'Alonso Martínez',        pos: [0.55, 0.48], lines: [4, 5, 10] },
  { name: 'Argüelles',              pos: [0.34, 0.45], lines: [3, 4, 6] },
  { name: 'Avenida de América',     pos: [0.66, 0.36], lines: [4, 6, 7, 9] },
  { name: 'Bilbao',                 pos: [0.50, 0.48], lines: [1, 4] },
  { name: 'Callao',                 pos: [0.46, 0.53], lines: [3, 5] },
  { name: 'Canal',                  pos: [0.46, 0.44], lines: [2, 7] },
  { name: 'Casa de Campo',          pos: [0.18, 0.52], lines: [5, 10] },
  { name: 'Chamartín',              pos: [0.52, 0.20], lines: [1, 10] },
  { name: 'Colombia',               pos: [0.62, 0.30], lines: [8, 9] },
  { name: 'Cuatro Caminos',         pos: [0.50, 0.40], lines: [1, 2, 6] },
  { name: 'Diego de León',          pos: [0.66, 0.42], lines: [4, 5, 6] },
  { name: 'Embajadores',            pos: [0.46, 0.66], lines: [3, 5] },
  { name: 'Goya',                   pos: [0.62, 0.50], lines: [2, 4] },
  { name: 'Gregorio Marañón',       pos: [0.55, 0.42], lines: [7, 10] },
  { name: 'Guzmán el Bueno',        pos: [0.42, 0.40], lines: [6, 7] },
  { name: 'Legazpi',                pos: [0.42, 0.74], lines: [3, 6] },
  { name: 'Manuel Becerra',         pos: [0.66, 0.50], lines: [2, 6] },
  { name: 'Mar de Cristal',         pos: [0.66, 0.26], lines: [4, 8] },
  { name: 'Moncloa',                pos: [0.30, 0.40], lines: [3, 6] },
  { name: 'Nuevos Ministerios',     pos: [0.55, 0.36], lines: [6, 8, 10] },
  { name: 'Ópera',                  pos: [0.46, 0.55], lines: [2, 5] },
  { name: 'Pacífico',               pos: [0.56, 0.69], lines: [1, 6] },
  { name: 'Pinar de Chamartín',     pos: [0.56, 0.16], lines: [1, 4] },
  { name: 'Plaza de Castilla',      pos: [0.50, 0.22], lines: [1, 9, 10] },
  { name: 'Plaza de España',        pos: [0.42, 0.49], lines: [3, 10] },
  { name: 'Príncipe Pío',           pos: [0.30, 0.50], lines: [6, 10] },
  { name: 'Pueblo Nuevo',           pos: [0.78, 0.46], lines: [5, 7] },
  { name: 'Puerta del Sur',         pos: [0.20, 0.86], lines: [10, 12] },
  { name: 'Sainz de Baranda',       pos: [0.66, 0.59], lines: [6, 9] },
  { name: 'San Bernardo',           pos: [0.42, 0.48], lines: [2, 4] },
  { name: 'Sol',                    pos: [0.50, 0.55], lines: [1, 2, 3] },
  { name: 'Tribunal',               pos: [0.50, 0.51], lines: [1, 10] },
  { name: 'Ventas',                 pos: [0.72, 0.50], lines: [2, 5] },
  { name: 'El Casar',               pos: [0.34, 0.97], lines: [3, 12] },
];
