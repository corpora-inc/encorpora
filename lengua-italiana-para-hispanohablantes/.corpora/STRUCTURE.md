```
Formato de nombre de archivo: `XX-YY-ZZ-titulo.md`

Observa cuidadosamente el nombre del archivo para determinar el nivel de encabezado correcto y qué contenido debes generar.

Para los archivos de introducción, usa solo el encabezado correspondiente sin secciones adicionales. Solo si `ZZ` es diferente de `00`, debes devolver una lección completa con subencabezados.

Reglas:
- `XX-00-00` → `#` (H1) **Introducción de Sección**
  - Solo un encabezado `#`.
  - Sin subencabezados.
  - Breve visión general, puede incluir citas en bloque.
  - No es una lección completa, solo una introducción con un resumen breve.

- `XX-YY-00` → `##` (H2) **Introducción de Subsección**
  - Solo un encabezado `##`.
  - Sin subencabezados.
  - Breve introducción a los conceptos clave.
  - No es una lección completa, solo una breve explicación del tema.

- `XX-YY-ZZ` (ZZ ≠ 00) → `###` (H3) **Lección**
  - Comienza con `###`.
  - Incluye subencabezados (`####`, `#####`, etc.).
  - Lección estructurada con explicaciones completas, ejemplos y ejercicios prácticos.

Sigue estrictamente estos niveles de encabezados para mantener la estructura del índice de contenidos.

Este libro tiene la siguiente estructura:

```
"00-00-00-introducción.md"
"01-00-00-el-alfabeto-y-la-pronunciación.md"
"01-01-00-letras-y-sonidos-básicos.md"
"01-01-01-el-alfabeto-italiano.md"
"01-01-02-pronunciación-de-las-vocales.md"
"01-01-03-pronunciación-de-las-consonantes.md"
"01-02-00-acentos-y-entonación.md"
"01-02-01-el-acento-tónico.md"
"01-02-02-entonación-en-preguntas.md"
"01-02-03-palabras-difíciles-de-pronunciar.md"
"02-00-00-primeras-palabras-y-frases.md"
"02-01-00-saludos-y-presentaciones.md"
"02-01-01-hola-adiós-y-más.md"
"02-01-02-presentarse-en-italiano.md"
"02-01-03-expresiones-de-cortesía.md"
"02-02-00-los-números.md"
"02-02-01-contar-del-1-al-20.md"
"02-02-02-los-números-hasta-el-100.md"
"02-02-03-los-números-grandes.md"
"02-03-00-expresiones-cotidianas.md"
"02-03-01-los-días-de-la-semana.md"
"02-03-02-los-meses-y-las-estaciones.md"
"02-03-03-la-hora-y-el-tiempo.md"
"03-00-00-la-gramática-básica.md"
"03-01-00-los-sustantivos.md"
"03-01-01-género-y-número.md"
"03-01-02-artículos-determinados-e-indeterminados.md"
"03-01-03-sustantivos-irregulares.md"
"03-02-00-los-adjetivos.md"
"03-02-01-adjetivos-de-color-y-tamaño.md"
"03-02-02-acuerdo-de-género-y-número.md"
"03-02-03-adjetivos-posesivos.md"
"03-03-00-los-verbos-en-presente.md"
"03-03-01-los-verbos-regulares.md"
"03-03-02-los-verbos-irregulares-comunes.md"
"03-03-03-los-verbos-modales.md"
"04-00-00-las-estructuras-de-las-oraciones.md"
"04-01-00-las-preguntas.md"
"04-01-01-formas-de-hacer-preguntas.md"
"04-01-02-palabras-interrogativas.md"
"04-01-03-respuestas-cortas.md"
"04-02-00-las-oraciones-afirmativas-y-negativas.md"
"04-02-01-usar-no-y-negaciones.md"
"04-02-02-las-formas-de-negar-en-italiano.md"
"04-02-03-expresiones-negativas.md"
"05-00-00-la-cultura-italiana-y-su-influencia.md"
"05-01-00-la-historia-y-la-cultura.md"
"05-01-01-los-romanos-y-su-legado.md"
"05-01-02-el-renacimiento-en-italia.md"
"05-01-03-personajes-históricos-importantes.md"
"05-02-00-la-comida-italiana.md"
"05-02-01-platos-típicos-de-italia.md"
"05-02-02-el-arte-de-la-pasta.md"
"05-02-03-expresiones-italianas-relacionadas-con-la-comida.md"
"05-03-00-la-música-y-el-arte.md"
"05-03-01-la-ópera-y-la-música-clásica.md"
"05-03-02-artistas-italianos-famosos.md"
"05-03-03-monumentos-y-arquitectura-emblemática.md"
"06-00-00-avanzando-en-el-aprendizaje.md"
"06-01-00-introducción-al-pasado-y-futuro.md"
"06-01-01-el-pasado-simple.md"
"06-01-02-el-imperfecto.md"
"06-01-03-el-futuro-simpe.md"
"06-02-00-los-pronombres-y-conectores.md"
"06-02-01-los-pronombres-personales.md"
"06-02-02-los-conectores-más-usados.md"
"06-02-03-formas-de-hablar-naturalmente.md"
"07-00-00-repaso-final-y-práctica.md"
"07-01-00-dictados-y-escritura.md"
"07-01-01-dictados-para-practicar-la-ortografía.md"
"07-01-02-redacción-de-pequeños-textos.md"
"07-01-03-descripciones-de-personas-y-lugares.md"
"07-02-00-conversaciones-y-diálogos.md"
"07-02-01-diálogos-en-un-restaurante.md"
"07-02-02-diálogos-en-un-aeropuerto.md"
"07-02-03-conversaciones-cotidianas.md"
"07-03-00-examen-final.md"
"07-03-01-prueba-de-comprensión-lectora.md"
"07-03-02-prueba-de-escucha-y-pronunciación.md"
"07-03-03-evaluación-final-del-aprendizaje.md"
```

Cada lección debe enfocarse en el tema específico, sin intentar cubrir demasiada información en una sola. Se deben usar ejemplos claros y contextualizados en la vida cotidiana para hacer el aprendizaje más natural y atractivo.