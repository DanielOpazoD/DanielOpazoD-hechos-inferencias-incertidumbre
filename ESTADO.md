# Estado del libro

Al 16 de octubre de 2026. Para retomar el trabajo sin la conversación en que se hizo: qué hay, qué funciona, qué
espera al autor y qué quedó decidido. Las reglas para trabajar están en `AGENTS.md`. Actualiza este archivo cuando
cambie el estado o se tome una decisión.

## Qué hay

- **El libro**: fuentes en `fuentes/0*.md`; entregables en la raíz: PDF de 166 páginas (162 de cuerpo), DOCX y EPUB
  (44 capítulos). 15 figuras, 162 referencias, 18 capítulos, 18 talleres, TOC de 40 entradas; 58.414 palabras en las
  fuentes (54.842 sin las referencias). Cifras de la construcción y de las fuentes del 16 de octubre, tras las
  correcciones del punto 43.
- **Dónde vive**: este repo, `DanielOpazoD/DanielOpazoD-hechos-inferencias-incertidumbre` (privado), desde el 16 de octubre de 2026. Su primer commit importa tal
  cual `libro/` de la rama `claude/medical-thinking-book-review-nlnth9` de `DanielOpazoD/trama` en 4926b92; esa rama queda como
  archivo (PR #465 cerrado sin fusionar; el `main` de Trama nunca tuvo el libro) y los hashes del registro del README
  son de ella.

## Qué funciona

- **Construcción**: `./construir.sh` reproduce los entregables versionados (mismo texto del PDF, `toc.json` idéntico,
  el EPUB con los mismos archivos), con el TOC estable entre pasadas. `fuentes/comprobar.py` da 0 problemas y
  `fuentes/cotejo_figuras.py`, cero derivas.
- **Edición**: las recomendaciones A–G (`gestiones/recomendaciones_finales_2026-10-14.md`) están ejecutadas, y también
  las pasadas de coherencia (registro en `README.md`, puntos 25–42) y las correcciones de la evaluación del panel
  (punto 43; auditoría de evidencia, ítems 58–64).
- **Lector de anotaciones**: el repo `DanielOpazoD/lector-anotaciones` está en la 0.6.1 (`main` en 1df5ff8), con la CI
  verde, 151 pruebas de navegador y cobertura de 97 % en Python, 71 % en el núcleo y 92,9 % en la página. Los 52
  mutantes de `herramientas/mutar.py` hacen lo que esperan. `lector/index.html` es su `web/index.html` del commit
  7b079b7 (fijado en `requirements.txt`). `lector/libro.json` (42 secciones, 1065 bloques) está al día con las fuentes
  y marca como cambiados los 34 bloques que tocaron las correcciones del punto 43.
- **Página publicada**: https://claude.ai/artifact/RgYKd217CYUELt9Ur56Jgv, versión 28 (con el `libro.json` del punto 43). Su base tiene una sola anotación
  (Prefacio), resuelta y respondida: no hay anotaciones del autor esperando.

## Pendiente del autor

- Validar o reemplazar los pasajes en primera persona, que hoy son composiciones docentes: Prefacio, cap. 5 (el cólico
  renal que era un aneurisma), cap. 7 (la «ITU» que era colecistitis) y cap. 14 (el primer «no lo sé»). Revisar el
  nombre «Carmen» y los detalles del caso longitudinal.
- Final de la viñeta 6, viñetas 7 y 8, pasajes 38 y 39; los ítems 23, 29, 31, 47 y 52–57 de las recomendaciones.
- Cuatro decisiones que dejó la evaluación del panel (`gestiones/evaluacion_multiparametrica_2026-10-16.md`): la
  madrugada de Carmen (no operar en shock «fue prudente» y la tomografía «desactiva» la urgencia: un cirujano revisor
  lo objetaría; presentarlo como umbral discutible y vigilado); la página legal, que dice que las escenas en primera
  persona «condensan experiencias reales del autor» mientras este archivo las tiene como composiciones por validar; la
  viñeta 5, sin evaluación de la capacidad de decidir; y la saturación de 89 % del Taller 2B, que en un EPOC está en su
  rango objetivo.
- Lo que más subiría la nota, según el mismo panel: una pasada de producción en el generador (idioma `es-CL` y
  partición, títulos que no queden al pie, rayas unificadas), literatura 2015–2026 verificada antes de citarse,
  recortar las dos viñetas duplicadas y un piloto de HII-D.
- Piloto del método, revisión externa, permisos, ortotipografía, prueba del EPUB en Kindle Previewer y la carta de
  prólogo, que está como borrador en el Gmail del autor (`gestiones/prologo_*`).
- Decisiones de entorno abiertas: una CI para este repo que corra `fuentes/comprobar.py` y
  `fuentes/cotejo_figuras.py`; etiquetas de versión en `lector-anotaciones` (hoy se fija por commit) y borrar sus ramas
  `v0.5` y `v0.6`; un hook de inicio de sesión que deje la firma de git configurada.

## Decisiones tomadas

- Las citas de Parra no se tocan. Terminología hospitalaria chilena y términos canónicos
  (`gestiones/terminos_canonicos.md`). Toda referencia se verifica antes de citarse (`fuentes/auditoria_evidencia.md`).
- No hay techo de páginas (punto 37); las citas parentéticas no pasan a narrativa (punto 40).
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
