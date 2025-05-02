# Markdown Generation Instructions for LLM

## **General Structure**
- Follow the **STRUCTURE** guidelines to determine the correct header level based on the filename.
- **Do NOT** insert unnecessary headers like `"Introduction to X"`—just start with the content.
- Maintain logical progression and coherence across sections.

## **Header Structure (STRICTLY ENFORCED)**
The filename **determines the header level**. **Follow these rules exactly**:

- `XX-00-00-title.md` → `#` (H1) **Section Intro**
  - **Only one header** (`#`).
  - **No subheaders**.
  - **Short overview** of the section.
  - **Not a full lesson**—just an introduction and brief explanation.
  - No practice problems.

- `XX-YY-00-title.md` → `##` (H2) **Subsection Intro**
  - **Only one header** (`##`).
  - **No subheaders**.
  - **Short overview** of the subsection.
  - **Not a full lesson**—just a high-level explanation of key concepts.
  - No practice problems.

- `XX-YY-ZZ-title.md` (where ZZ $\neq$ 00) → `###` (H3) **Lesson**
  - **Use `###` (H3) as the main title**.
  - **Include subheaders (`####`, `#####`, etc.)** as needed.
  - **Full structured lesson** with explanations, examples, and practice problems.
  - **End with practice problems**.

🚨 **STRICTLY FOLLOW THESE HEADER LEVELS** to maintain the correct TOC structure.

## **Math Formatting (Critical)**
- **NEVER** use `\(` `\)` or `\[` `\]` for math formatting.
- **ALWAYS** use `$$ ... $$` for display math.
- **ALWAYS** use `$ ... $` for inline math.
- **Backticks** (e.g., `` `12 ÷ 4 = 3` ``) are acceptable only for non-LaTeX math notation.

### **Examples of Correct Math Formatting**
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

### **Examples of Incorrect Math Formatting**
```md
The quotient of \(12 \div 4\) is \(3\).
```
```md
\[
12 \div 4 = 3
\]
```

## **Content & Formatting Rules**
- **Do NOT** end with a conclusion—**end with practice problems.**
- Use **lists, bold, italics**, and **examples** for clarity.
- Use **blockquotes** (`>`) for key insights or definitions.

## **Output Consistency**
- Ensure uniform formatting across all sections for seamless Pandoc → LaTeX conversion.
- Content should be clear, structured, and precise.

## **Strict Rules**
- **STRICTLY FOLLOW HEADER STRUCTURE BASED ON FILENAME.**
- **NO extra headers like `"Introduction to X"`**
- **NO lesson-ending summaries**
- **PREFER DISPLAY MATH (`$$ ... $$`)**
- **END WITH PRACTICE PROBLEMS**
- **STRICTLY USE `$` AND `$$` FOR MATH. NOTHING ELSE.**
