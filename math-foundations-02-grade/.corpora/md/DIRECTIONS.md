# Markdown Generation Instructions for LLM

## General Structure
- Follow the **STRUCTURE** guidelines to determine the correct header level based on the filename.
- **Do NOT** insert unnecessary headers like `"Introduction to X"`—just start with the content.

## Header Structure (STRICTLY ENFORCED)
The filename **determines the header level**. **Follow these rules exactly**:

- `XX-00-title.md` → `#` (H1) Unit Intro
  - **Only one header** (`#`).
  - **No subheaders**.
  - **Short overview** of the unit.
  - **Not a full lesson**—just an introduction and brief explanation.

- `XX-YY-title.md` → `##` (H2) Lesson
  - **Use `##` (H2) as the main title**.
  - **Include subheaders (`###`, `####`, etc.)** as needed.
  - **Full structured lesson** with explanations and examples.
  - **As detailed as possible**—multiple approaches, step-by-step breakdowns, and variations.

🚨 **STRICTLY FOLLOW THESE HEADER LEVELS** to maintain the correct TOC structure.

## Math Formatting (Critical)
- **NEVER** use `\(` `\)` or `\[` `\]` for math formatting.
- **ALWAYS** use `$$ ... $$` for display math.
- **ALWAYS** use `$ ... $` for inline math.
- **Backticks** (e.g., `` `12 ÷ 4 = 3` ``) are acceptable only for non-LaTeX math notation.

### Examples of Correct Math Formatting
```md
The quotient of $12 \div 4$ is $3$.
```
```md
$$
12 \div 4 = 3
$$
```
```md
`12 ÷ 4 = 3`
```

### Examples of Incorrect Math Formatting
```md
The quotient of \(12 \div 4\) is \(3\).
```
```md
\[
12 \div 4 = 3
\]
```

## Content & Formatting Rules
- **Do NOT** end with a conclusion.
- Use **lists, bold, italics**, and **examples** for clarity.
- Use **blockquotes** (`>`) for key insights or definitions.

## Strict Rules
- **STRICTLY FOLLOW HEADER STRUCTURE BASED ON FILENAME.**
- **NO extra headers like `"Introduction to X"`**
- **NO lesson-ending summaries**
- **PREFER DISPLAY MATH (`$$ ... $$`)**
- **STRICTLY USE `$` AND `$$` FOR MATH. NOTHING ELSE.**
