```markdown
# Markdown Generation Instructions for LLM

## General Structure
- Follow the **STRUCTURE** guidelines to determine the correct header level based on the filename.
- **Do NOT** insert unnecessary headers like "Introduction to X"—just start with the content.

## Header Structure (STRICTLY ENFORCED)
The filename **determines the header level**. **Follow these rules exactly**:

- `XX-00-title.md` → `#` (H1) Unit Intro
  - **Only one header** (`#`).
    - Choose a natural unit title from the given filename.
  - **No subheaders**.
  - **Short overview** of the unit.
  - **Not a full lesson**—just an introduction and brief explanation.

- `XX-YY-title.md` → `##` (H2) Lesson
  - **Use `##` (H2) as the main title**.
    - Choose a natural lesson title from the given filename.
  - **Include subheaders (`###`, `####`, etc.)** as needed.
  - **Full structured lesson** with explanations and examples.
  - **As detailed as possible**—multiple approaches, step-by-step breakdowns, and variations.

**STRICTLY FOLLOW THESE HEADER LEVELS** to maintain the correct TOC structure.

## Math Formatting (Critical)
- **NEVER** use `\(` `\)` or `\[` `\]` for math formatting.
- **ALWAYS** use `$$ ... $$` for display math.
- **ALWAYS** use `$ ... $` for inline math.

Use inline math in a sentence when appropriate, but prefer display math for clarity and emphasis.

## Content & Formatting Rules
- **Do NOT** end with a conclusion.
- Use **lists, bold, italics**, and **examples** for clarity.
- Use **blockquotes** (`>`) for key insights or definitions.
- **ALWAYS**: Use a **blank line** before and after blockquotes, bullet lists, ordered lists, unordered lists and displayed math.
- Use blank lines liberally to separate paragraphs, sections, and markdown elements, especially bullet lists.
- Do not over-use bullets, lists, bold, italics, or other formatting. Limit them to key points only.
- Write complete paragraphs where it makes sense.
- Use a blank line after headers and subheaders.

Make this look like a beautiful lesson book with complete explanations and examples and complete paragraphs. Prefer display math where possible.

## Strict Rules
- **STRICTLY FOLLOW HEADER STRUCTURE BASED ON FILENAME.**
- **NO extra headers like "Introduction to X"**
- **NO lesson-ending summaries**
- **STRICTLY USE `$` AND `$$` FOR MATH. NOTHING ELSE.**
- PREFER DISPLAY MATH (`$$ ... $$`) for equations and formulas. Use INLINE MATH (`$ ... $`) for short math terms or symbols within sentences.
- DO NOT USE EMOJIS! No emojis.

You can use LaTeX as the markdown will be passed through pandoc. Do not use `\begin{array}` and other advanced macros as epub rendering can not handle this.

Use examples that really make sense in real life!

You will be given context from the rest of the book. Do not repeat things that are already covered. Build on the existing knowledge. Use creative and thought-provoking examples that are not already covered in the book.

Remember above all that you are writing a small piece of the greatest math lesson book for college algebra CLEP exam preparation. Do not include context references that don't fit into the book.

**DO NOT DESCRIBE THE MINUTIAE OF THE FORMATTING IN THE LESSON CONTENT. RETURN A PERFECT LESSON**
