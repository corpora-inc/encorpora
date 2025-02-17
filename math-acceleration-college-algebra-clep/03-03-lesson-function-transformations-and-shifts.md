## Function Transformations and Shifts

Function transformations allow us to modify a basic graph by shifting, stretching, compressing, or reflecting it. In this lesson, we explore how changing the equation of a function affects its graph. We cover vertical and horizontal shifts, reflections, and scaling transformations with detailed, step-by-step examples.

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

If you add a constant $k$ to the function, the graph moves:

- Upward if $k > 0$
- Downward if $k < 0$

Example: Given $f(x) = x^2$, the function

$$
g(x) = f(x) + 3 = x^2 + 3
$$

shifts the parabola upward by 3 units.

**Horizontal Shifts:**

Replacing $x$ by $(x - h)$ in the function results in a horizontal shift.

- Right shift if $h > 0$
- Left shift if $h < 0$

Example: For $f(x) = x^2$, the function

$$
g(x) = f(x - 2) = (x - 2)^2
$$

shifts the graph to the right by 2 units.

### 3. Reflections

Reflections flip the graph over an axis:

- Multiply the function by $-1$ to reflect across the horizontal axis: 

$$
g(x) = -f(x)$$

- Replace $x$ with $-x$ to reflect across the vertical axis: 

$$
g(x) = f(-x)$$

Example: With $f(x) = \sqrt{x}$, the function

$$
g(x) = -\sqrt{x}
$$

reflects the graph downward.

### 4. Stretching and Compressing

**Vertical Stretch/Compression:**

Multiplying $f(x)$ by a constant $a$ stretches or compresses the graph vertically.

- If $|a| > 1$, the graph stretches vertically.
- If $0 < |a| < 1$, the graph compresses vertically.

Example: For $f(x) = x^2$, the function

$$
g(x) = 2x^2
$$

stretches the parabola, making it narrower.

**Horizontal Stretch/Compression:**

Multiplying the input $x$ by a constant $b$ affects the graph horizontally.

- If $|b| > 1$, the graph compresses horizontally.
- If $0 < |b| < 1$, the graph stretches horizontally.

Example: For $f(x) = x^2$, the function

$$
g(x) = \left(0.5x\right)^2 = 0.25x^2
$$

stretches the parabola horizontally, making it wider.

### 5. Combining Transformations: Step-by-Step Example

Consider the transformation of the function $f(x) = x^2$ into

$$
g(x) = -2\,(x + 3)^2 + 4.
$$

Follow these steps:

1. **Horizontal Shift:**
   
   The term $(x + 3)$ can be written as $(x - (-3))$. This shifts the graph 3 units to the left.
   
2. **Vertical Stretch and Reflection:**
   
   The factor $-2$ multiplies the function. The absolute value, 2, stretches the graph vertically by a factor of 2. The negative sign reflects the graph across the horizontal axis.
   
3. **Vertical Shift:**
   
   Adding 4 at the end shifts the graph upward by 4 units.

**Summary of Effects:**

- Shift left by 3 units.
- Reflect over the horizontal axis and stretch vertically by factor 2.
- Shift up by 4 units.

### 6. Real-World Application

In finance, function transformations can be used to adjust profit models. If a basic profit function $P(x)$ represents profit based on sales $x$, then a vertical shift may represent an increase in fixed costs or changes in pricing strategies. Horizontal shifts can model changes in the time period of the sales forecast.

For example, if $P(x)$ models profit over months, then $P(x-2)$ shifts the model to account for a two-month delay in the market.

### 7. Visualizing Transformations

Below is a simple number line that shows a horizontal shift. Suppose we want to visualize the shift of $f(x) = (x)^2$ to $f(x-2)$.

\vspace*{2em}
\begin{center}
\begin{tikzpicture}[x=0.5cm]
  % Draw a number line from -3 to 7
  \draw[->] (-3,0) -- (7,0) node[right] {Number Line};
  % Place ticks every unit
  \foreach \x in {-3,-2,-1,0,1,2,3,4,5,6,7}
      \draw (\x,0.1) -- (\x,-0.1) node[below] {\x};
  % Draw arrows to indicate shift
  \draw[thick, red, ->] (1,0.5) -- (3,0.5);
  \node at (2,0.8) {Shift Right 2};
\end{tikzpicture}
\end{center}
\vspace*{2em}

This diagram shows how the input values are effectively increased by 2 when using $f(x-2)$, shifting the graph to the right by 2 units.

### 8. Practice Transformation Problems

To solidify your understanding, consider these variations (do not solve them here; use them as guided examples):

- Given $f(x) = |x|$, graph $g(x) = |x - 4| - 3$. Identify the horizontal and vertical shifts.
- For $f(x) = \sqrt{x}$, graph $h(x) = -\sqrt{2x + 6} + 1$. Determine the order of operations and the effects of each transformation.
- With $f(x) = \frac{1}{x}$, graph $k(x) = \frac{-1}{2(x + 1)} + 3$, noting both reflection and scaling.

Each example reinforces the connection between algebraic modifications and their graphical consequences.

By mastering function transformations, you build a strong foundation for analyzing and modeling real-world scenarios using algebraic functions.