## Graphical Interpretation of Systems of Equations

A system of equations is a set of two or more equations with the same variables. In the graphical approach, each equation is represented by a graph. The solution to the system is the point where the graphs intersect. If they cross at one point, there is one unique solution; if they do not intersect, there is no solution; and if they lie on top of each other, there are infinitely many solutions.

### Key Concepts

- **Line Equation:** A linear equation in slope-intercept form is written as $$ y = mx + b $$, where $$ m $$ is the slope and $$ b $$ is the $$ y $$-intercept.

- **Slope:** The rate at which a line rises or falls, calculated as the change in $$ y $$ divided by the change in $$ x $$. 

- **Y-Intercept:** The point where the graph crosses the $$ y $$-axis.

### Graphing Each Equation

Each equation in the system is graphed by:

1. Identifying the $$ y $$-intercept, where $$ x=0 $$.
2. Using the slope to find a second point by moving right (or left) on the $$ x $$-axis and up (or down) accordingly.
3. Drawing a straight line through these points.

### Example 1: Unique Solution

Consider the system:

$$
\begin{aligned}
 y &= 2x + 1, \\
 y &= -x + 4.
\end{aligned}
$$

**Step 1:** Graph $$ y = 2x + 1 $$

- The $$ y $$-intercept is $$ (0,1) $$. 
- The slope is $$ 2 $$, meaning for every increase of 1 in $$ x $$, $$ y $$ increases by 2.
- A second point can be found by letting $$ x=1 $$: $$ y = 2(1)+1 = 3 $$, so the point is $$ (1,3) $$. 

**Step 2:** Graph $$ y = -x + 4 $$

- The $$ y $$-intercept is $$ (0,4) $$. 
- The slope is $$ -1 $$, meaning for every increase of 1 in $$ x $$, $$ y $$ decreases by 1.
- For $$ x=1 $$: $$ y = -1 + 4 = 3 $$, so the point is $$ (1,3) $$. 

**Step 3:** Identify the Intersection

Notice that both lines pass through the point $$ (1,3) $$. This point is the unique solution to the system.

Below is a graphical illustration:

\vspace*{2em}
\begin{center}
\begin{tikzpicture}[scale=0.8]
  % Draw axes
  \draw[->] (-2,0) -- (5,0) node[right] {$x$};
  \draw[->] (0,-1) -- (0,6) node[above] {$y$};
  
  % Draw tick marks on x-axis
  \foreach \x in {-2,-1,0,1,2,3,4,5}
      \draw (\x,0.1) -- (\x,-0.1) node[below] {\small \x};

  % Draw tick marks on y-axis
  \foreach \y in {0,1,2,3,4,5,6}
      \draw (0.1,\y) -- (-0.1,\y) node[left] {\small \y};

  % Plot y = 2x + 1
  \draw[domain=-1:3.5, smooth, variable=\x, blue, thick] plot ({\x}, {2*\x+1});
  \node[blue, above] at (3.2, {2*3.2+1}) {$y=2x+1$};

  % Plot y = -x + 4
  \draw[domain=-1:4.5, smooth, variable=\x, red, thick] plot ({\x}, {-\x+4});
  \node[red, above left] at (0.5, {-0.5+4}) {$y=-x+4$};

  % Mark intersection point
  \filldraw [black] (1,3) circle (2pt);
  \node[below right] at (1,3) {$(1,3)$};

\end{tikzpicture}
\end{center}
\vspace*{2em}

### Example 2: No Solution (Parallel Lines)

Consider the system:

$$
\begin{aligned}
 y &= 3x - 2, \\
 y &= 3x + 1.
\end{aligned}
$$

Both equations have the same slope ($$3$$) but different $$ y $$-intercepts. This means the lines are parallel and do not intersect, so there is no solution.

### Example 3: Infinitely Many Solutions (Coincident Lines)

For the system:

$$
\begin{aligned}
 y &= -2x + 5, \\
 2y &= -4x + 10.
\end{aligned}
$$

The second equation simplifies to $$ y = -2x + 5 $$. Both equations are identical, meaning the lines coincide completely. This system has infinitely many solutions.

### Real-World Application

In real-world scenarios, systems of equations can model situations where two different relationships must hold simultaneously. For example:

- In business, supply and demand equations intersect at the equilibrium price.
- In engineering, different force equations intersect to balance a structure.
- In sports analytics, player performance metrics may be represented by linear trends where their intersection indicates a point of balance.

Graphical analysis allows you to visually interpret these scenarios and understand the nature of the solutions.

By mastering graphical interpretation, you gain an intuitive understanding of where and how systems of equations provide solutions in both academic problems and real-life applications.