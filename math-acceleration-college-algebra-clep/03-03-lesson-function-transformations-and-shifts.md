## Function Transformations and Shifts

Function transformations allow us to modify a basic graph by shifting, stretching, compressing, or reflecting it. In this lesson we explore how changing the equation of a function affects its graph. We cover vertical and horizontal shifts, reflections, and scaling transformations with detailed, step-by-step examples.

### 1. Basic Concepts

A function is a rule that assigns an output to each input. When we change the function's formula, the graph moves or changes shape. The basic form to consider is

$$
f(x)
$$

A transformed function can often be written in the form

$$
g(x) = a\,f(b(x - h)) + k,
$$

where:

- $h$ represents a horizontal shift.
- $k$ represents a vertical shift.
- $a$ is the vertical stretch ($|a| > 1$) or compression ($0 < |a| < 1$) as well as reflection across the horizontal axis if $a$ is negative.
- $b$ is the horizontal stretch/compression factor and potential reflection across the vertical axis if $b$ is negative.

### 2. Vertical and Horizontal Shifts

**Vertical Shifts:**

If you add a constant $k$ to the function, the graph moves upward if $k > 0$ and downward if $k < 0$.

Example: Given $f(x)=x^2$, the function

$$
g(x)=f(x)+3=x^2+3
$$

shifts the parabola upward by 3 units.

Below is a graph comparing $f(x)=x^2$ (blue) and $g(x)=x^2+3$ (red):

\vspace*{2em}
\begin{center}
\begin{tikzpicture}
\begin{axis}[
    xlabel={$x$},
    ylabel={$y$},
    title={Vertical Shift: $x^2$ vs. $x^2+3$},
    axis lines=middle,
    legend pos=north west,
    domain=-3:3,
    samples=100
]
\addplot [color=blue, thick] {x^2};
\addlegendentry{$x^2$}
\addplot [color=red, thick] {x^2+3};
\addlegendentry{$x^2+3$}
\end{axis}
\end{tikzpicture}
\end{center}
\vspace*{2em}

**Horizontal Shifts:**

Replacing $x$ by $(x-h)$ in the function results in a horizontal shift. The graph shifts right if $h>0$ and left if $h<0$.

Example: For $f(x)=x^2$, the function

$$
g(x)=f(x-2)=(x-2)^2
$$

shifts the graph to the right by 2 units.

Below is a graph comparing $f(x)=x^2$ (blue) and $g(x)=(x-2)^2$ (red):

\vspace*{2em}
\begin{center}
\begin{tikzpicture}
\begin{axis}[
    xlabel={$x$},
    ylabel={$y$},
    title={Horizontal Shift: $x^2$ vs. $(x-2)^2$},
    axis lines=middle,
    legend pos=north west,
    domain=-1:5,
    samples=100
]
\addplot [color=blue, thick] {x^2};
\addlegendentry{$x^2$}
\addplot [color=red, thick] {(x-2)^2};
\addlegendentry{$(x-2)^2$}
\end{axis}
\end{tikzpicture}
\end{center}
\vspace*{2em}

### 3. Reflections

Reflections flip the graph over an axis. To reflect across the horizontal axis, multiply the function by $-1$. To reflect across the vertical axis, replace $x$ with $-x$.

Example: With $f(x)=\sqrt{x}$, the function

$$
g(x)=-\sqrt{x}
$$

reflects the graph downward (across the horizontal axis).

Below is a graph comparing $f(x)=\sqrt{x}$ (blue) and $g(x)=-\sqrt{x}$ (red):

\vspace*{2em}
\begin{center}
\begin{tikzpicture}
\begin{axis}[
    xlabel={$x$},
    ylabel={$y$},
    title={Reflection: $\sqrt{x}$ vs. $-\sqrt{x}$},
    axis lines=middle,
    legend pos=south west,
    domain=0:5,
    samples=100
]
\addplot [color=blue, thick] {sqrt(x)};
\addlegendentry{$\sqrt{x}$}
\addplot [color=red, thick] {-sqrt(x)};
\addlegendentry{$-\sqrt{x}$}
\end{axis}
\end{tikzpicture}
\end{center}
\vspace*{2em}

### 4. Stretching and Compressing

**Vertical Stretch/Compression:**

Multiplying $f(x)$ by a constant $a$ stretches or compresses the graph vertically. If $|a|>1$, the graph stretches vertically; if $0<|a|<1$, the graph compresses vertically.

Example: For $f(x)=x^2$, the function

$$
g(x)=2x^2
$$

stretches the parabola vertically by a factor of 2.

Below is a graph comparing $f(x)=x^2$ (blue) and $g(x)=2x^2$ (red):

\vspace*{2em}
\begin{center}
\begin{tikzpicture}
\begin{axis}[
    xlabel={$x$},
    ylabel={$y$},
    title={Vertical Stretch: $x^2$ vs. $2x^2$},
    axis lines=middle,
    legend pos=north west,
    domain=-2.5:2.5,
    samples=100
]
\addplot [color=blue, thick] {x^2};
\addlegendentry{$x^2$}
\addplot [color=red, thick] {2*x^2};
\addlegendentry{$2x^2$}
\end{axis}
\end{tikzpicture}
\end{center}
\vspace*{2em}

**Horizontal Stretch/Compression:**

Multiplying the input $x$ by a constant $b$ affects the graph horizontally. If $|b|>1$, the graph compresses horizontally; if $0<|b|<1$, the graph stretches horizontally.

Example: For $f(x)=x^2$, the function

$$
g(x)=\left(0.5x\right)^2=0.25x^2
$$

stretches the parabola horizontally, making it wider.

Below is a graph comparing $f(x)=x^2$ (blue) and $g(x)=(0.5x)^2$ (red):

\vspace*{2em}
\begin{center}
\begin{tikzpicture}
\begin{axis}[
    xlabel={$x$},
    ylabel={$y$},
    title={Horizontal Stretch: $x^2$ vs. $(0.5x)^2$},
    axis lines=middle,
    legend pos=north west,
    domain=-6:6,
    samples=100
]
\addplot [color=blue, thick] {x^2};
\addlegendentry{$x^2$}
\addplot [color=red, thick] {(0.5*x)^2};
\addlegendentry{$(0.5x)^2$}
\end{axis}
\end{tikzpicture}
\end{center}
\vspace*{2em}

### 5. Combining Transformations: Step-by-Step Example

Consider the transformation of the function $f(x)=x^2$ into

$$
g(x)=-2\,(x+3)^2+4.
$$

Follow these steps:

1. **Horizontal Shift:**
   
   The term $(x+3)$ can be written as $(x-(-3))$. This shifts the graph 3 units to the left.
   
2. **Vertical Stretch and Reflection:**
   
   The factor $-2$ multiplies the function. The absolute value, 2, stretches the graph vertically by a factor of 2. The negative sign reflects the graph across the horizontal axis.
   
3. **Vertical Shift:**
   
   Adding 4 at the end shifts the graph upward by 4 units.

**Summary of Effects:**

- Shift left by 3 units.
- Reflect over the horizontal axis and stretch vertically by a factor of 2.
- Shift up by 4 units.

Below is a graph comparing $f(x)=x^2$ (blue) and the transformed function $g(x)=-2(x+3)^2+4$ (red):

\vspace*{2em}
\begin{center}
\begin{tikzpicture}
\begin{axis}[
    xlabel={$x$},
    ylabel={$y$},
    title={Combined Transformation},
    axis lines=middle,
    legend pos=south east,
    domain=-10:4,
    samples=100
]
\addplot [color=blue, thick] {x^2};
\addlegendentry{$x^2$}
\addplot [color=red, thick] {-2*(x+3)^2+4};
\addlegendentry{$-2(x+3)^2+4$}
\end{axis}
\end{tikzpicture}
\end{center}
\vspace*{2em}

### 6. Real-World Application

In finance, function transformations can be used to adjust profit models. For instance, if a basic profit function $P(x)$ represents profit based on sales $x$, then a vertical shift may represent an increase in fixed costs or changes in pricing strategies. Horizontal shifts can model adjustments in the time period of the sales forecast.

Below is a conceptual graph where a profit model is shifted to account for a delay in the market:

\vspace*{2em}
\begin{center}
\begin{tikzpicture}
\begin{axis}[
    xlabel={$x$ (Months)},
    ylabel={$Profit$},
    title={Profit Model Transformation},
    axis lines=middle,
    legend pos=south east,
    domain=0:10,
    samples=100
]
% Base profit model: a quadratic function
\addplot [color=blue, thick] {-(x-5)^2+25};
\addlegendentry{$P(x) = -(x-5)^2+25$}
% Shifted model: shifted to the right by 2 months
\addplot [color=red, thick, dashed] {-(x-7)^2+25};
\addlegendentry{$P(x-2)$}
\end{axis}
\end{tikzpicture}
\end{center}
\vspace*{2em}

This graph shows how the profit model is shifted horizontally to reflect a two-month delay in the market.

### 7. Practice Transformation Problems

To solidify your understanding, consider these variations (do not solve them here; use them as guided examples):

- Given $f(x)=|x|$, graph $g(x)=|x-4|-3$. Identify the horizontal and vertical shifts.
- For $f(x)=\sqrt{x}$, graph $h(x)=-\sqrt{2x+6}+1$. Determine the order of operations and the effects of each transformation.
- With $f(x)=\frac{1}{x}$, graph $k(x)=\frac{-1}{2(x+1)}+3$, noting both reflection and scaling.

Each example reinforces the connection between algebraic modifications and their graphical consequences.

By mastering function transformations, you build a strong foundation for analyzing and modeling real-world scenarios using algebraic functions.