Filename format: `XX-YY-ZZ-title.md`

Look carefully at the filename to determine the correct header level and what you should return.

For Intro files, use only the single header of the correct level. Only if ZZ not equal to 00, you should return a full lesson with subheaders.

Rules:
- `XX-00-00` → `#` (H1) **Section Intro**
  - Only one header - `#`.
  - No subheaders.
  - Short overview, may include blockquotes.
  - Not a full lesson, just the introduction and a brief explanation.

- `XX-YY-00` → `##` (H2) **Subsection Intro**
  - Only one header - `##`.
  - No subheaders.
  - Short overview of key concepts
  - Not a full lesson, just the subheader and a brief explanation.

- `XX-YY-ZZ` (ZZ $\neq$ 00) → `###` (H3) **Lesson**
  - Start from `###`
  - Include subheaders (`####`, `#####`, etc.)
  - Full structured lesson with comprehensive explanations, examples, and practice problems.

Strictly follow these header levels to maintain TOC structure.
