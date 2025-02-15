# Markdown Generation Instructions for LLM

## General Structure
- Follow the **STRUCTURE** guidelines to determine the correct header level based on the filename.
- **Do NOT** insert unnecessary headers like `"Introduction to X"`—just start with the content.

Start every file with a `\newpage` command to ensure each lesson starts on a new page.

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
- **Backticks** (e.g., `` `12 ÷ 4 = 3` ``) are acceptable only for non-LaTeX math notation.

## Content & Formatting Rules
- **Do NOT** end with a conclusion.
- Use **lists, bold, italics**, and **examples** for clarity.
- Use **blockquotes** (`>`) for key insights or definitions.
- **ALWAYS**: Use a **new line** before and after blockquotes, bullet lists, ordered lists, unordered lists and displayed math.
- Use blank lines liberally to separate paragraphs, sections, and markdown elements.
- Do not over-use bullets, lists, bold, italics, or other formatting. Limit them to key points only.
- Write complete paragraphs where it makes sense.
- Use a blank line after headers and subheaders.

Make this look like a beautiful lesson book with complete explanations and examples and complete paragraphs. Prefer display math where possible.

## Strict Rules
- **STRICTLY FOLLOW HEADER STRUCTURE BASED ON FILENAME.**
- **NO extra headers like `"Introduction to X"`**
- **NO lesson-ending summaries**
- **PREFER DISPLAY MATH (`$$ ... $$`)**
- **STRICTLY USE `$` AND `$$` FOR MATH. NOTHING ELSE.**

You can use latex as the markdown will be passed through pandoc.

We have `\usepackage{pgfplots}` in the LaTeX template, so you can use `tikzpicture` environments to create graphs.

The following examples are known to compile:

```markdown
\vspace*{2em}
\begin{center}
\begin{tikzpicture}
\begin{axis}[
    xlabel={$x$},
    ylabel={$f(x)$},
    title={Line Plot: $f(x)=\sin(x)$}
]
\addplot [domain=0:6.28, samples=100, color=blue] {sin(deg(x))};
\end{axis}
\end{tikzpicture}
\end{center}

\vspace*{2em}
\begin{center}
\begin{tikzpicture}
\begin{axis}[
    ybar,
    symbolic x coords={Category A, Category B, Category C},
    xtick=data,
    ylabel={Value},
    title={Bar Graph Example},
    nodes near coords,
    enlarge x limits=0.25
]
\addplot coordinates {(Category A,10) (Category B,15) (Category C,7)};
\end{axis}
\end{tikzpicture}
\end{center}

\vspace*{2em}
\begin{center}
\begin{tikzpicture}
\begin{axis}[
    xlabel={X Value},
    ylabel={Y Value},
    title={Scatter Plot Example},
    only marks,
    mark=*,
    scatter/classes={
      a={mark=square*,blue},
      b={mark=triangle*,red}
    }
]
\addplot[scatter, only marks, scatter src=explicit symbolic]
coordinates {
    (1,2) [a]
    (2,3) [b]
    (3,1) [a]
    (4,4) [b]
};
\end{axis}
\end{tikzpicture}
\end{center}

\vspace*{2em}
\begin{center}
\begin{tikzpicture}
\begin{axis}[
    view={60}{30},
    xlabel={$x$},
    ylabel={$y$},
    zlabel={$z$},
    title={3D Plot Example}
]
\addplot3[
    mesh,
    domain=0:6.28,
    domain y=0:6.28,
    samples=20,
    samples y=20
]
{sin(deg(x))*cos(deg(y))};
\end{axis}
\end{tikzpicture}
\end{center}

\vspace*{2em}
\begin{center}
\begin{tikzpicture}
\begin{axis}[
    view={60}{30},
    xlabel={$x$},
    ylabel={$y$},
    zlabel={$z$},
    title={Surface Plot: $z = \sin(x)\cos(y)$}
]
\addplot3[
    surf,
    domain=0:6.28,
    domain y=0:6.28,
    samples=30,
    samples y=30
]
{sin(deg(x))*cos(deg(y))};
\end{axis}
\end{tikzpicture}
\end{center}

\vspace*{2em}
\begin{center}
\begin{tikzpicture}
\begin{axis}[
    xlabel={$x$},
    ylabel={$y$},
    title={Parametric Plot Example: Circle},
    axis equal
]
\addplot [
    domain=0:360,
    samples=100,
    color=blue,
    variable=\t
]({cos(\t)}, {sin(\t)});
\end{axis}
\end{tikzpicture}
\end{center}


\vspace*{2em}
\begin{center}
\begin{tikzpicture}
\begin{axis}[
    xlabel={X-axis Label},
    ylabel={Y-axis Label},
    title={Customized Plot Example},
    legend pos=outer north east,
    grid=both,
    minor grid style={gray!25},
    major grid style={gray!50}
]
\addplot [smooth, mark=*, blue] {x^2};
\addplot [smooth, mark=square*, red] {x^2 + 2};
\legend{Function 1, Function 2}
\end{axis}
\end{tikzpicture}
\end{center}
```

Use plots liberally to explain concepts visually. Make sure to include a caption and label for each plot. Make the plots professional and well-formatted.

You can also use markdown tables and creative ASCII art to explain things visually. Be creative to make the lessons come alive.
