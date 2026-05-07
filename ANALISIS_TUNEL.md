# Análisis del túnel — comparación plano técnico vs. implementación actual

Rama: `fix_tunel`
Plano de referencia: sección transversal + planta de vías + sección longitudinal de un túnel de Metro tipo Madrid (escala 1:50 / 1:100).

Archivos relevantes:
- [js/escenarios/metro_base/tunel.js](js/escenarios/metro_base/tunel.js) — render principal (drawTunel)
- [js/escenarios/metro_base/tunel_base.js](js/escenarios/metro_base/tunel_base.js) — escena (spawn, ratios de vías, trenes)
- [js/escenarios/metro_base/estacion_base.js](js/escenarios/metro_base/estacion_base.js) — debe permanecer sincronizado con las ratios del túnel

---

## 1. Lo que el plano define (resumen)

### Sección transversal (escala 1:50)
- Túnel de **6.20 m de ancho × 5.60 m de alto** con revestimiento de hormigón prefabricado.
- Altura libre mínima sobre riel: **4.80 m**. Solera: **0.55 m** de espesor.
- **Catenaria rígida** (alimentación eléctrica): barra horizontal roja suspendida del techo a ~1.20 m por debajo de la clave, con anclajes triangulares.
- **Bandeja portacables / señalización / fuerza** en ambas paredes laterales (a media altura).
- **Luminarias LED** empotradas en los anclajes del techo (no en pared).
- **Canal lateral para cableado y drenaje** en las dos esquinas inferiores (donde la pared encuentra el suelo).
- **Canal central de drenaje** entre las dos vías, con rejilla.
- Pendiente transversal de la solera: **2 % hacia los canales**.

### Planta de vías (escala 1:50)
- Dos vías paralelas. Distancia entre **ejes** de vías: **3.10 m**. Ancho libre interno: **5.00 m**.
- Cada vía: **raíl UIC 60**, ancho de vía **1.435 m**, separación entre vías **0.90 m** (= ancho del canal central).
- **Traviesas de hormigón continuas** que abarcan los DOS raíles de cada vía (no son pads individuales).
- **Sujeción elástica tipo Fastclip** (clips Pandrol) en cada apoyo rail-traviesa.
- Solera de hormigón armado bajo todo el conjunto.

### Sección longitudinal (escala 1:100)
- Bandeja portacables corre a lo largo del techo (continuo con la del lateral).
- Catenaria rígida visible como línea continua a lo largo del túnel.
- Las traviesas se ven como bloques transversales regulares bajo los rieles.

---

## 2. Estado actual del render (`tunel.js`) — qué hay vs. qué falta

| Elemento del plano | Estado actual | Comentario |
|---|---|---|
| Arco circular de hormigón con dovelas | ✅ Implementado (`_drawArchRings`, 8 segmentos por anillo) | Bien |
| Juntas radiales + anclajes de dovela | ✅ Implementado | Bien |
| Suelo / solera bajo las vías | ✅ Implementado (`_drawTrackFloor`) | Es plano — falta pendiente 2 % hacia canales |
| Canal central de drenaje con rejilla | ✅ Implementado (`_drawCentralDrain`) | Bien |
| 4 raíles (2 por vía) con perfil 3D | ✅ Implementado (`_drawRailLines`) | Bien |
| **Traviesas de hormigón continuas** | ❌ Falta — hoy son **pads individuales por raíl** | El plano muestra durmientes que van de raíl a raíl de cada vía |
| **Catenaria rígida (barra roja con anclajes)** | ❌ Falta — sólo hay 2 cables diagonales en V | Es el elemento eléctrico más visible del plano |
| **Bandejas portacables laterales** | ❌ Falta | El plano las pone en ambas paredes a media altura |
| **Canales laterales de drenaje** (esquinas inferiores) | ❌ Falta | Esquinas pared↔suelo del plano |
| **Luminarias LED en techo** (en los anclajes) | ⚠ Parcial — `_drawCeilingLights` pinta tubos fluorescentes en posiciones libres | Deberían colgar de los anclajes de la catenaria |
| Aceras laterales de mantenimiento | ⚠ Hay función `_drawSideWalkways` pero **no se llama** desde `drawTunel` | Ver `tunel.js:696` (código muerto) |
| Pendiente 2 % de solera hacia canales | ❌ Falta | Detalle visual menor — sombra/highlight asimétrico bastaría |
| Proporciones reales (3.10 m entre ejes, 5.00 m libre) | ⚠ Aproximadas vía ratios `0.255` / `0.03` | Validado a ojo, no a escala — revisar si se quiere fidelidad métrica |

---

## 3. Puntos a abordar (prioridad sugerida)

### Prioridad ALTA — diferencias estructurales muy visibles
1. **Catenaria rígida**
   - Reemplazar los dos cables diagonales (`_drawCeilingCables`) por una **barra horizontal roja** que recorre el centro del techo siguiendo la perspectiva (de `vpY` al borde inferior si se llegara a ver).
   - Añadir anclajes triangulares a intervalos regulares animados con `worldZ`.
   - Mantener efecto de profundidad (los anclajes lejanos más pequeños y oscuros).

2. **Traviesas de hormigón continuas**
   - En `_drawRails`, sustituir el bucle de pads individuales por **bloques transversales** que abarcan los dos raíles de cada vía (uno por vía → 2 traviesas visibles por fila de profundidad).
   - Mantener los clips Pandrol en los 4 puntos de contacto rail-traviesa.
   - Conservar el animado con `worldZ` y la concentración cuadrática al fondo (perspectiva).

3. **Bandejas portacables laterales**
   - Banda horizontal a media altura en cada pared del túnel, paralela al suelo, en perspectiva hacia el VP.
   - Color metálico oscuro con highlight superior (similar al canal central).
   - Opcional: pequeñas marcas verticales sugiriendo divisiones.

### Prioridad MEDIA — detalles que mejoran realismo
4. **Canales laterales (drenaje + cableado)**
   - En las esquinas inferiores donde el arco se encuentra con la solera, dibujar un perfil en L con rejilla más pequeña que la central.
   - Reutilizar la lógica de `_drawCentralDrain` adaptada a posición lateral.

5. **Reposicionar luminarias LED**
   - Ahora `_drawCeilingLights` las pinta en `xFrac: 0.20 / 0.80` libres en el techo.
   - Deberían quedar **alineadas con los anclajes de la catenaria** para coherencia con el plano.
   - Si se hace junto con el punto 1, sale gratis.

6. **Pendiente 2 % en la solera**
   - En `_drawTrackFloor`, añadir un degradado lateral asimétrico (más claro hacia el centro, más oscuro hacia los canales laterales) para sugerir el desnivel sin geometría real.

### Prioridad BAJA — limpieza y opcional
7. **Eliminar código muerto**
   - `_drawSideWalkways` ([tunel.js:696](js/escenarios/metro_base/tunel.js:696)) no se llama. Decidir: borrar o reactivar como parte de las bandejas/canales laterales.
   - `_drawWallLights` ([tunel.js:927](js/escenarios/metro_base/tunel.js:927)) tampoco se llama. Mismo dilema.
   - `_drawWallFills` y `_drawFloor` también parecen no llamarse — verificar y limpiar.

8. **Validación de proporciones a escala**
   - Si se quiere fidelidad métrica al plano (3.10 m / 5.00 m / 4.80 m), recalcular las ratios `TRACK_OUTER/INNER_RATIO_BASE` desde un canvas asumido. Sólo si es objetivo del fix.

---

## 4. Cosas que NO hay que tocar (recordatorio)

- Las constantes `TRACK_OUTER_RATIO_*` y `TRACK_INNER_RATIO_*` están **duplicadas** en `tunel.js`, `tunel_base.js` y `estacion_base.js` (alineación tren↔raíl↔estación). Si se modifican, **cambiar en los 3 sitios** o se desincroniza la transición túnel↔estación.
- El render se llama desde `MetroBase` con un cross-fade circular — **no añadir overlays oscuros** que tapen la siguiente escena dentro del recorte.
- `vanishingPointY` debe seguir coincidiendo con el de `EstacionBase` (`0.42` por defecto, override `0.30` en `TunelBase`).

---

## 5. Plan de trabajo propuesto

Orden recomendado (cada paso es un commit independiente y verificable visualmente):

1. **Catenaria rígida** — sustituye `_drawCeilingCables` por `_drawRigidCatenary` (barra + anclajes triangulares).
2. **Traviesas continuas** — refactor de `_drawRails` para bloques transversales por vía + clips.
3. **Bandejas portacables laterales** — nueva función `_drawSideCableTrays`.
4. **Canales laterales de drenaje** — nueva función `_drawSideDrains` reutilizando rejilla.
5. **Reubicar luminarias LED** sobre los anclajes de la catenaria (ajuste a `_drawCeilingLights`).
6. **Pendiente 2 %** — degradado asimétrico en `_drawTrackFloor`.
7. **Limpieza** — borrar funciones muertas (`_drawSideWalkways`, `_drawWallLights`, `_drawWallFills`, `_drawFloor` si confirmado).

Cada paso debe verificarse en `mockup_tunel_render.html` antes de pasar al siguiente para no romper la apariencia ya validada del túnel actual.
