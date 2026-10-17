# Estado del libro

Al 17 de octubre de 2026. Para retomar el trabajo sin la conversación en que se hizo: qué hay, qué funciona, qué
espera al autor y qué quedó decidido. Las reglas para trabajar están en `AGENTS.md`. Actualiza este archivo cuando
cambie el estado o se tome una decisión.

## Qué hay

- **El libro**: fuentes en `fuentes/0*.md`; entregables en la raíz: PDF de 171 páginas (167 de cuerpo), DOCX y EPUB
  (45 capítulos). 15 figuras, 179 referencias, 18 capítulos, 18 talleres reunidos en el Apéndice D, TOC de 41
  entradas; 60.358 palabras en las fuentes (56.230 sin las referencias). Cifras de la construcción y de las fuentes del
  17 de octubre, tras el punto 49.
- **Dónde vive**: este repo, `DanielOpazoD/DanielOpazoD-hechos-inferencias-incertidumbre` (privado), desde el 16 de octubre de 2026. Su primer commit importa tal
  cual `libro/` de la rama `claude/medical-thinking-book-review-nlnth9` de `DanielOpazoD/trama` en 4926b92; esa rama queda como
  archivo (PR #465 cerrado sin fusionar; el `main` de Trama nunca tuvo el libro) y los hashes del registro del README
  son de ella.

## Qué funciona

- **Construcción**: `./construir.sh` reproduce los entregables versionados (mismo texto del PDF, `toc.json` idéntico,
  el EPUB con los mismos archivos), con el TOC estable entre pasadas. `fuentes/comprobar.py` da 0 problemas y
  `fuentes/cotejo_figuras.py`, cero derivas. La CI (`.github/workflows/libro.yml`) construye y comprueba en cada push
  y guarda el PDF construido; su primera corrida dio verde con las mismas 171 páginas.
- **Edición**: las recomendaciones A–G (`gestiones/recomendaciones_finales_2026-10-14.md`) están ejecutadas, y también
  las pasadas de coherencia (registro en `README.md`, puntos 25–42), las correcciones de la evaluación del panel
  (punto 43; auditoría de evidencia, ítems 58–64), el nuevo ingreso de Carmen (punto 44), los talleres en un apéndice
  (punto 45), la auditoría externa con tres decisiones clínicas del autor (punto 46), la pasada de producción (47), las
  viñetas 1 y 2 sin repetir (48) y la literatura 2015–2026 verificada (49; auditoría de evidencia, ítems 65–83).
- **Lector de anotaciones**: el repo `DanielOpazoD/lector-anotaciones` está en la 0.6.1 (`main` en 1df5ff8), con la CI
  verde, 151 pruebas de navegador y cobertura de 97 % en Python, 71 % en el núcleo y 92,9 % en la página. Los 52
  mutantes de `herramientas/mutar.py` hacen lo que esperan. `lector/index.html` es su `web/index.html` del commit
  7b079b7 (fijado en `requirements.txt`). `lector/libro.json` (43 secciones, 1081 bloques) está al día con las fuentes
  y marca como cambiados los 107 bloques que tocaron los puntos 46–49 (las rayas tocaron muchos).
- **Página publicada**: https://claude.ai/artifact/RgYKd217CYUELt9Ur56Jgv, versión 31 (con el `libro.json` de los puntos 46–49). Su base tiene una sola anotación
  (Prefacio), resuelta y respondida: no hay anotaciones del autor esperando.

## Pendiente del autor

- Final de la viñeta 6, viñetas 7 y 8, pasajes 38 y 39; los ítems 23, 29, 31, 47 y 52–57 de las recomendaciones.
- Las cuatro decisiones que dejó la evaluación del panel (`gestiones/evaluacion_multiparametrica_2026-10-16.md`) están
  tomadas: el ingreso de Carmen y las escenas como composiciones (punto 44), la capacidad de decidir en la viñeta 5 y la
  saturación del taller del cap. 2 (punto 46). De lo que más subiría la nota sólo queda el piloto de HII-D: el
  protocolo de una página está en `gestiones/piloto_hiid_protocolo.md`.
- Fuente del libro: el DOCX pide Georgia, que estos contenedores y la CI no tienen; LibreOffice la reemplaza por
  DejaVu Serif. Antes de imprimir, decidir una fuente libre (o instalar la que se elija) y volver a medir la paginación.
- Piloto del método, revisión externa, permisos, ortotipografía, prueba del EPUB en Kindle Previewer y la carta de
  prólogo, que está como borrador en el Gmail del autor (`gestiones/prologo_*`).
- Decisiones de entorno abiertas: etiquetas de versión en `lector-anotaciones` (hoy se fija por commit) y borrar sus ramas
  `v0.5` y `v0.6`; un hook de inicio de sesión que deje la firma de git configurada.

## Decisiones tomadas

- Las escenas en primera persona y todas las viñetas son composiciones docentes, y se declaran así (página legal,
  Prefacio); Carmen es un personaje compuesto. Las citas de Parra no se tocan. Terminología hospitalaria chilena y términos canónicos
  (`gestiones/terminos_canonicos.md`). Toda referencia se verifica antes de citarse (`fuentes/auditoria_evidencia.md`).
- No hay techo de páginas (punto 37); las citas parentéticas no pasan a narrativa (punto 40).
- Los talleres no van al final de cada capítulo: están reunidos en el Apéndice D, nombrados por su capítulo, con
  «Una versión posible» o «Comentario» y sin tono de examen (punto 45). Una versión sólo en línea, como programa, queda
  para cuando exista; ese apéndice sería su fuente.
- Rayas de inciso en el sistema español: pegadas al inciso y con raya de cierre también al final del enunciado; la
  raya espaciada sólo queda como separador en el índice, las etiquetas H/I/I/D y los títulos de referencias en inglés
  (punto 47; `comprobar.py` lo vigila).
- Las viñetas que vuelven a un caso ya escrito en capas no lo repiten: remiten y guardan sólo lo nuevo (punto 48).
- El lector es un repo aparte y genérico; este libro sólo copia su página y fija su versión. En el lector: sin framework
  ni empaquetador, sin unificar el código repetido entre Python y JS; se aceptan dos límites conocidos (un documento
  armado a propósito para romper la página; `mypy` no ve una clave mal escrita del JSON). Que la página tenga un índice
  plegable se publicó como 0.6.1, aunque por SemVer, como función nueva, habría sido 0.7.0.
- La evaluación vigente es `gestiones/evaluacion_multiparametrica_2026-10-16.md` (panel de seis expertos, nota 6,1,
  más estricta que las anteriores; estimación tras sus correcciones y las pendientes: ~6,4–6,6). Las anteriores son
  `evaluacion_multiparametrica_2026-10-14.md` (6,4) y `evaluacion_multiparametrica_2026-10.md`.

## Para retomar

1. Abrir la sesión con este repo seleccionado (y `DanielOpazoD/lector-anotaciones` si se va a tocar el lector) y leer
   `AGENTS.md`.
2. `npm install && pip install -r requirements.txt && ./construir.sh`: si termina con 0 problemas, el entorno está bien.
3. Antes de editar, leer las anotaciones nuevas de la página (colección `anotaciones`) y lo pendiente del autor.
4. Un cambio en el lector se hace en su repo; aquí se copia su `web/index.html`, se fija su commit en
   `requirements.txt` y se republica la página.
