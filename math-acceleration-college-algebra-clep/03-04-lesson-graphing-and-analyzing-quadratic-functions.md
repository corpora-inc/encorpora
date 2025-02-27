## Graphing and Analyzing Quadratic Functions

Quadratic functions are polynomial functions of degree 2 and are often written as

$$
f(x)=ax^2+bx+c
$$

These functions create parabolic graphs that open upward if $a>0$ and downward if $a<0$. In this lesson, we will examine how to graph a quadratic function and analyze its key components.

### Key Features of Quadratic Functions

A quadratic function has several important features:

- **Vertex:** The highest or lowest point of the parabola.
- **Axis of Symmetry:** A vertical line that passes through the vertex.
- **Intercepts:** Points where the graph crosses the axes:
  - **Y-intercept:** The point when $x=0$, which is $(0, c)$.
  - **X-intercepts:** Points where $f(x)=0$. They can be found using factoring or the quadratic formula.

The vertex can be calculated using the formula

$$
h=-\frac{b}{2a}
$$

and then substituting back into $f(x)$ to find $k$, so the vertex is $(h, k)$.

### Graphing a Quadratic Function

The following steps outline how to graph a quadratic function:

1. **Identify the coefficients** $a$, $b$, and $c$ from the function.
2. **Calculate the vertex** using $h=-\frac{b}{2a}$ and $k=f(h)$.
3. **Determine the y-intercept** at $(0, c)$.
4. **Find the x-intercepts** by solving $ax^2+bx+c=0$.
5. **Sketch the axis of symmetry** which is the vertical line $x=h$.
6. **Plot the vertex, intercepts, and additional points** to form the parabola.

### Example 1: Graphing $f(x)=x^2-4x+3$

1. **Identify the coefficients:** Here, $a=1$, $b=-4$, and $c=3$.

2. **Find the vertex:**

   $$
   h=-\frac{-4}{2(1)}=\frac{4}{2}=2.
   $$

   Then calculate $k=f(2)$:

   $$
f(2)=(2)^2-4(2)+3=4-8+3=-1.
   $$

   Thus, the vertex is $(2,-1)$.

3. **Axis of symmetry:** $x=2$.

4. **Determine the y-intercept:**

   $$
f(0)=0^2-4(0)+3=3.
   $$

   The y-intercept is $(0,3)$.

5. **Find the x-intercepts:** Solve

   $$
x^2-4x+3=0.
   $$

   Factoring gives

   $$
   (x-1)(x-3)=0,
   $$

   so $x=1$ and $x=3$. The x-intercepts are $(1,0)$ and $(3,0)$.

6. **Graphing:** Plot the vertex, intercepts, and several additional points on either side of the axis of symmetry. Connect these points with a smooth, curved line forming a parabola.

> The vertex is the key point that defines the orientation and position of the parabola.

Below is an example of a graphical representation:

\vspace*{2em}
\begin{center}
\begin{tikzpicture}[scale=0.8]
  \begin{axis}[
      xlabel={\(x\)},
      ylabel={\(f(x)\)},
      axis lines=middle,
      xmin=-1, xmax=5,
      ymin=-3, ymax=5,
      xtick={-1,0,1,2,3,4,5},
      ytick={-3,-2,-1,0,1,2,3,4,5},
      grid=both,
      width=10cm,
      height=8cm,
      samples=100,
      domain=-1:5,
  ]
    \addplot [smooth, blue, thick] {x^2-4*x+3};
    \addplot[only marks, mark=*] coordinates {(2,-1) (0,3) (1,0) (3,0)};
    \node at (axis cs:2.5,-2) [anchor=south east] {\((2,-1)\)};
    \node at (axis cs:0,3) [anchor=south east] {\((0,3)\)};
    \node at (axis cs:0.5,-0.5) [anchor=north] {\((1,0)\)};
    \node at (axis cs:3,-0.5) [anchor=north] {\((3,0)\)};
  \end{axis}
\end{tikzpicture}
\end{center}
\vspace*{2em}

### Example 2: Analyzing $f(x)=-2(x-1)^2+8$

This quadratic function is presented in vertex form:

$$
f(x)=-2(x-1)^2+8.
$$

1. **Identify the vertex:** The vertex is directly given by the form $(h,k)$, so here it is $(1,8)$.

2. **Determine the direction:** The coefficient $a=-2$ is negative, so the parabola opens downward.

3. **Find the y-intercept:** Set $x=0$:

   $$
f(0)=-2(0-1)^2+8=-2(1)+8=6.
   $$

   The y-intercept is $(0,6)$.

4. **Find the x-intercepts:** Set $f(x)=0$:

   $$
   -2(x-1)^2+8=0.
   $$

   Solve for $(x-1)^2$:

   $$
   -2(x-1)^2=-8 \quad\Longrightarrow\quad (x-1)^2=4.
   $$

   Taking the square root gives:

   $$
x-1=\pm 2.
   $$

   Therefore, $x=3$ or $x=-1$. The x-intercepts are $(-1,0)$ and $(3,0)$.

5. **Graphing:** With the vertex at $(1,8)$ and the intercepts determined, plot these points and sketch the parabola opening downward.

> Analyzing the quadratic function helps in understanding practical scenarios, such as maximizing profit or determining the peak height in projectile motion.

Below is a graphical representation:

\vspace*{2em}
\begin{center}
\begin{tikzpicture}[scale=0.8]
  \begin{axis}[
      xlabel={\(x\)},
      ylabel={\(f(x)\)},
      axis lines=middle,
      xmin=-3, xmax=5,
      ymin=-3, ymax=10,
      xtick={-3,-2,-1,0,1,2,3,4,5},
      ytick={-3,-2,-1,0,1,2,3,4,5,6,7,8,9,10},
      grid=both,
      width=10cm,
      height=8cm,
      samples=100,
      domain=-3:5,
  ]
    \addplot [smooth, red, thick] {-2*(x-1)^2+8};
    \addplot[only marks, mark=*] coordinates {(1,8) (0,6) (-1,0) (3,0)};
    \node at (axis cs:1,8) [anchor=south west] {\((1,8)\)};
    \node at (axis cs:-0.5,6) [anchor=south east] {\((0,6)\)};
    \node at (axis cs:-1.5,1) [anchor=north] {\((-1,0)\)};
    \node at (axis cs:3.5,1) [anchor=north] {\((3,0)\)};
  \end{axis}
\end{tikzpicture}
\end{center}
\vspace*{2em}

### Real-World Applications

Quadratic functions model many real-world situations, such as:

- **Projectile Motion:** The path of a thrown object follows a parabolic arc.
- **Architecture:** Parabolic arches are used in bridges and structures.
- **Economics:** Profit functions can be modeled with quadratic relationships.
- **Sports Analytics:** Trajectories in sports like basketball or soccer follow a parabolic path.

Understanding how to graph and analyze quadratic functions is essential to model and solve these real-life problems effectively.