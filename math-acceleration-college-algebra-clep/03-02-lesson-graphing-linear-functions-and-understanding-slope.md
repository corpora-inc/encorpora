## Graphing Linear Functions and Understanding Slope

A linear function is one in which the graph is a straight line. The most common form of a linear function is the slope-intercept form:

$$
y = mx + b
$$

Here, $m$ represents the slope and $b$ represents the $y$-intercept.

> The slope tells us how steep the line is and in which direction it goes.

### Understanding Slope

The slope $m$ is defined as the ratio of the vertical change (rise) to the horizontal change (run) between any two points on the line. It is expressed as:

$$
m = \frac{\text{rise}}{\text{run}}
$$

A positive slope means the line rises as it moves from left to right, while a negative slope means it falls.

### Graphing a Linear Function

Graphing a linear function using the slope-intercept form involves these steps:

1. **Identify the $y$-intercept ($b$):** This is the point where the line crosses the $y$-axis. Plot the point $(0, b)$ on the graph.

2. **Use the slope ($m$):** From the $y$-intercept, use the slope to determine another point on the line. If $m = \frac{rise}{run}$, from $(0, b)$, move right by the run and up (or down) by the rise.

3. **Plot and Draw the Line:** After plotting two points, draw a straight line through them.

### Example 1: Graphing $$y = 2x + 3$$

1. **Identify the $y$-intercept:**

   Here, $b = 3$. Plot the point $(0, 3)$.

2. **Determine the slope:**

   The slope $m = 2$ can be written as $$\frac{2}{1}$$. This means from $(0, 3)$, move right 1 unit and up 2 units to get the point $(1, 5)$.

3. **Plot and Draw:**

   Plot the points $(0, 3)$ and $(1, 5)$, then draw a line through these points.

A simple diagram of the line:

\vspace*{2em}
\begin{center}
\begin{tikzpicture}
\begin{axis}[
    xlabel={$x$},
    ylabel={$y$},
    xmin=-2, xmax=4,
    ymin=0, ymax=7,
    axis lines=middle,
    xtick={-2,-1,0,1,2,3,4},
    ytick={0,1,2,3,4,5,6,7},
    width=200pt,
    height=200pt
]
\addplot [domain=-1:3, samples=100, color=blue] {2*x + 3};
\end{axis}
\end{tikzpicture}
\end{center}
\vspace*{2em}

### Example 2: Finding Slope and Graphing $$y = -\frac{1}{2}x + 4$$

1. **Identify the $y$-intercept:**

   Here, $b = 4$. Plot the point $(0, 4)$ on the graph.

2. **Use the slope:**

   The slope $m = -\frac{1}{2}$ means that for every 2 units moved to the right, the line goes down 1 unit. From $(0, 4)$, moving right 2 units gives the point $(2, 3)$.

3. **Plot and Draw:**

   Plot the points $(0, 4)$ and $(2, 3)$, then draw a straight line through them.

A visual representation:

\vspace*{2em}
\begin{center}
\begin{tikzpicture}
\begin{axis}[
    xlabel={$x$},
    ylabel={$y$},
    xmin=-2, xmax=6,
    ymin=0, ymax=6,
    axis lines=middle,
    xtick={-2,-1,0,1,2,3,4,5,6},
    ytick={0,1,2,3,4,5,6},
    width=200pt,
    height=200pt
]
\addplot [domain=-1:5, samples=100, color=red] {-0.5*x + 4};
\end{axis}
\end{tikzpicture}
\end{center}
\vspace*{2em}

### Calculating Slope from Two Points

If you are given two points, $P_1=(x_1, y_1)$ and $P_2=(x_2, y_2)$, the slope $m$ is calculated by:

$$
m = \frac{y_2 - y_1}{x_2 - x_1}
$$

For example, given the points $(1, 2)$ and $(4, 8)$:

$$
m = \frac{8 - 2}{4 - 1} = \frac{6}{3} = 2
$$

This tells us that moving from $(1, 2)$ to $(4, 8)$, the line rises 6 units over a run of 3 units.

### Real-World Application

In many real-life scenarios, the slope represents a rate of change. For example, in finance, if a company’s profit increases by $\$200$ for every additional unit sold, the slope of the profit line is $200$. In sports analytics, the slope could represent the change in a player's scoring average relative to minutes played.

By understanding the slope, you can predict how changes in one variable affect another, making linear functions a powerful tool for modeling real-world situations.
