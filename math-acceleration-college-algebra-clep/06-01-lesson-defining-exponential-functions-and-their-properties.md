## Defining Exponential Functions and Their Properties

Exponential functions are an important type of function in algebra. They model processes with constant percentage growth or decay. In its most basic form, an exponential function is written as:

$$
f(x) = a \cdot b^x
$$

where:

- $a$ is the initial value, scaling the function vertically.
- $b$ is the base, a constant that determines the rate of growth or decay. (Note: $b$ must be positive and cannot equal 1.)

### Definition and Components

An exponential function has two main parts:

1. **Initial Value ($a$):** This is the value of the function when $x = 0$. Since $b^0 = 1$, we have:

   $$
f(0) = a \cdot b^0 = a
   $$

2. **Base ($b$):** The base determines the function’s overall behavior:
   - If $b > 1$, the function is increasing (exponential growth).
   - If $0 < b < 1$, the function is decreasing (exponential decay).

### Key Properties

Exponential functions have several important characteristics:

- **Domain:** All real numbers, $$(-\infty,\infty)$$, since you can plug any real number into $x$.

- **Range:** Always positive, $$ (0, \infty) $$, because a positive number raised to any power remains positive and multiplied by $a$ (if $a > 0$) stays positive.

- **Y-intercept:** At $x=0$, the function always crosses the y-axis at $(0, a)$.

- **Asymptote:** The horizontal line $$y = 0$$ is an asymptote, meaning the function gets close to, but never touches, zero.

- **Monotonicity:** The function is either strictly increasing or strictly decreasing based on the value of $b$.

### Example 1: Exponential Growth

Consider the function:

$$
f(x) = 2 \cdot 3^x
$$

**Step-by-step explanation:**

1. **Calculate the y-intercept:**

   $$
f(0) = 2 \cdot 3^0 = 2 \cdot 1 = 2
   $$

2. **Evaluate at $x = 2$:**

   $$
f(2) = 2 \cdot 3^2 = 2 \cdot 9 = 18
   $$

This function models exponential growth, with the quantity tripling for each increment in $x$.

### Example 2: Exponential Decay

Now consider an exponential decay function:

$$
f(x) = 5 \cdot \left( \frac{1}{2} \right)^x
$$

**Step-by-step explanation:**

1. **Calculate the y-intercept:**

   $$
f(0) = 5 \cdot \left( \frac{1}{2} \right)^0 = 5 \cdot 1 = 5
   $$

2. **Evaluate at $x = 3$:**

   $$
f(3) = 5 \cdot \left( \frac{1}{2} \right)^3 = 5 \cdot \frac{1}{8} = \frac{5}{8}
   $$

This function shows a rapid decrease, modeling processes like radioactive decay or depreciation.

### Graphing Exponential Functions

The behavior of exponential functions can be visualized on a graph. Consider the growth function from Example 1:

$$
f(x) = 2 \cdot 3^x
$$

Key points:

- At $x=0$, $y = 2$.
- At $x=1$, $y = 2 \cdot 3 = 6$.
- At $x=-1$, $y = 2 \cdot \frac{1}{3} \approx 0.67$.

The graph will show a rapid increase for positive $x$ and approach zero for negative $x$. A horizontal line at $y=0$ is drawn as an asymptote.

Below is a simple representation of an exponential growth function on a number line:

\vspace*{2em}
\begin{center}
\begin{tikzpicture}[x=0.8cm, y=0.5cm]
  % Draw axes
  \draw[->] (-4,0) -- (4,0) node[right] {$x$};
  \draw[->] (0,0) -- (0,8) node[above] {$f(x)$};

  % Plot key points for f(x) = 2 * 3^x
  \fill (0,2) circle (2pt) node[right] {$(0,2)$};
  \fill (1,6) circle (2pt) node[right] {$(1,6)$};
  \fill (-1,0.67) circle (2pt) node[below left] {$(-1,\frac{2}{3})$};

  % Draw a smooth curve
  \draw[domain=-2:2, smooth, variable=\x, red] plot ({\x},{2*3^(\x)});

  % Draw the horizontal asymptote
  \draw[dashed] (-4,0) -- (4,0);
\end{tikzpicture}
\end{center}
\vspace*{2em}

### Real-World Applications

Exponential functions are used in many fields:

- **Finance:** To model compound interest. If you invest an amount and it grows exponentially, the balance after $t$ years can be written as $$A = P \cdot (1 + r)^t$$.

- **Biology:** To describe population growth when the rate of growth is proportional to the current population.

- **Chemistry and Physics:** To model radioactive decay where the quantity decreases over time.

In each case, the exponential function captures rapid increases or decreases depending on the base value.

Understanding exponential functions and their properties is essential for solving real-life problems that involve constant percentage changes. This knowledge forms a foundation for later topics such as logarithms and advanced growth models.