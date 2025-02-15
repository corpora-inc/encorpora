# Markdown Generation Instructions for LLM

## General Structure
- Follow the **STRUCTURE** guidelines to determine the correct header level based on the filename.
- **Do NOT** insert unnecessary headers like `"Introduction to X"`—just start with the content.

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
- **ALWAYS**: Use a **blank line** before and after blockquotes, bullet lists, ordered lists, unordered lists and displayed math.
- Use blank lines liberally to separate paragraphs, sections, and markdown elements, especially bullet lists.
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
- DO NOT USE EMOJIS! No emojis.

You can use latex as the markdown will be passed through pandoc.

For addition with carrying you can use something like this:

$$
\begin{array}{r}
47 \\
+38 \\
\hline
\end{array}
$$

You can continue:

$$
\begin{array}{r@{}r@{}r}
   1 &   & \\[0.5em]
   4 & 7 & \\[0.5em]
 + 3 & 8 & \\[0.5em]
   \hline
     & 5 & \\
\end{array}
$$

For borrowing with subtraction you can use a format like this:

$$
\begin{array}{r@{\hspace{1mm}}r}
  4 & 7 \\
-\,3 & 8 \\
\hline
& \\
\end{array}
\quad\Longrightarrow\quad
\begin{array}{r@{\hspace{1mm}}r}
  3 & 17 \\
-\,3 & 8 \\
\hline
  0 & 9 \\
\end{array}
$$

Make it look perfect! Go step by step!

We have `\usepackage{pgfplots}` in the LaTeX template, so you can use `tikzpicture` environments to create graphs.

The following examples are known to compile:

```markdown
<!-- Number line -->
\vspace*{2em}
\begin{center}
\begin{tikzpicture}
\draw[->] (0,0) -- (6,0) node[right] {Number Line};
\foreach \x in {0,...,6}
    \draw (\x,0.1) -- (\x,-0.1) node[below] {\x};
\draw[thick, red, ->] (5,0) -- (2,0);
\node at (3.5,-0.5) {$-3$};
\end{tikzpicture}
\end{center}

<!-- Scale a number line to FIT on the page using 2 per tick -->
\vspace*{2em}
\begin{center}
\begin{tikzpicture}[x=0.5cm]
  % Draw a number line from 8 to 18
  \draw[->] (8,0) -- (18,0) node[right] {Number Line};
  % Place ticks every 2 units
  \foreach \x in {8,10,12,14,16,18}
      \draw (\x,0.1) -- (\x,-0.1) node[below] {\x};
  % Draw a double-arrow showing the jump from 17 to 9 (subtracting 8)
  \draw[<-, thick, red] (9,0.5) -- (17,0.5);
  % Add a label above the arrow
  \node at (13,0.8) {\small 17 - 8 = 9};
\end{tikzpicture}
\end{center}
\vspace*{2em}

<!-- Line Plot -->
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

<!-- Bar Plot -->
\begin{figure}[ht]
\centering
\vspace*{2em}
\begin{tikzpicture}
\begin{axis}[
    ybar,
    bar width=20pt,
    symbolic x coords={Apple, Banana, Orange},
    xtick=data,
    xlabel={Fruit Type},
    ylabel={Count},
    ymin=0,
    title={Favorite Fruits Count},
    nodes near coords,
    nodes near coords align={vertical},
    enlarge x limits=0.25,
    label style={font=\large},
    title style={font=\Large\bfseries},
    tick label style={font=\large},
]
\addplot[fill=blue!50] coordinates {(Apple,8) (Banana,5) (Orange,7)};
\end{axis}
\end{tikzpicture}
\label{fig-bar-favorite-fruits-count}
\end{figure}

<!-- Scatter Plot -->
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

<!-- 3D Plot -->
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

<!-- 3D Surface Plot -->
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

<!-- Parametric Plot -->
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

<!-- Customized Plot -->
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

Use plots liberally to explain concepts visually. Make the plots professional and well-formatted. Caption and label inside the plots but do not try to put figure labels or captions in the markdown. For a number line, use 10 to 12 total ticks and center the problem in the middle of the number line. For example if the problem is 14+4, the number line should go from 11 to 21.

Do not mention TikZ or LaTeX in the lesson content. Remember the audience is students. They don't need to know about the underlying technology.

You can also use markdown tables and creative ASCII art to explain things visually. Be creative to make the lessons come alive. Be extremely verbose and detailed in your explanations. Formally define everything.

Use examples that really make sense in real life!

You will be given context from the rest of the book. Do not repeat things that are already covered. Build on the existing knowledge.

Remember above all that you are writing a small piece of the greatest math lesson book for second graders. Do not include context references that don't fit into the book.

**DO NOT DESCRIBE THE MINUTIAE OF THE FORMATTING IN THE LESSON CONTENT. RETURN A PERFECT LESSON**
