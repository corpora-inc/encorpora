## Representing Complex Numbers on the Complex Plane

Complex numbers take the form $$ z = a + bi $$ where $$ a $$ is the real part and $$ b $$ is the imaginary part. In this lesson, we explain how to plot these numbers on the complex plane and determine useful properties such as distance from the origin.

### The Complex Plane

The complex plane has two perpendicular axes:

- The horizontal axis (real axis) represents the real part $$ a $$.
- The vertical axis (imaginary axis) represents the imaginary part $$ b $$.

A complex number $$ z = a + bi $$ is represented by the point $$ (a, b) $$ on this plane.

### Plotting a Complex Number

To plot a complex number, follow these steps:

1. Identify the real part $$ a $$ and the imaginary part $$ b $$. 
2. Move $$ a $$ units along the horizontal (real) axis.
3. Move $$ b $$ units along the vertical (imaginary) axis.

The point where you end is the representation of $$ z $$ on the complex plane.

### Example 1: Plotting $$ z = 3 + 4i $$

1. Here, $$ a = 3 $$ and $$ b = 4 $$. 
2. On the real axis, move 3 units to the right. 
3. On the imaginary axis, move 4 units upward.
4. Mark the point $$ (3, 4) $$. 

The plotted point represents the complex number $$ 3 + 4i $$. Notice that the distance from the origin to this point is the modulus of $$ z $$. 

The modulus is calculated as:

$$
|z| = \sqrt{a^2 + b^2} = \sqrt{3^2 + 4^2} = \sqrt{9+16} = \sqrt{25} = 5
$$

### Example 2: Plotting $$ z = -2 - 5i $$

1. Here, $$ a = -2 $$ and $$ b = -5 $$. 
2. On the real axis, move 2 units to the left (since $$ a $$ is negative).
3. On the imaginary axis, move 5 units downward (since $$ b $$ is negative).
4. Mark the point $$ (-2, -5) $$. 

The modulus for $$ z = -2 - 5i $$ is computed as:

$$
|z| = \sqrt{(-2)^2 + (-5)^2} = \sqrt{4+25} = \sqrt{29}
$$

### Visual Representation on the Complex Plane

Below is a diagram representing the point for $$ 3 + 4i $$. The number line is centered to show both positive and negative values on each axis.

\vspace*{2em}
\begin{center}
\begin{tikzpicture}[scale=0.6]
  % Draw axes
  \draw[->] (-7,0) -- (7,0) node[right] {Real};
  \draw[->] (0,-7) -- (0,7) node[above] {Imaginary};

  % Draw ticks on Real axis
  \foreach \x in {-6,-4,-2,0,2,4,6} {
    \draw (\x,0.15) -- (\x,-0.15) node[below] {\small \x};
  }

  % Draw ticks on Imaginary axis
  \foreach \y in {-6,-4,-2,0,2,4,6} {
    \draw (0.15,\y) -- (-0.15,\y) node[left] {\small \y};
  }

  % Plot the point 3+4i
  \fill[blue] (3,4) circle (3pt);
  \draw (3,4) node[above right] {$$3+4i$$};
\end{tikzpicture}
\end{center}
\vspace*{2em}

This point is 5 units from the origin, confirming the modulus calculated earlier.

### Summary of Steps

- Identify the real part $$ a $$ and imaginary part $$ b $$. 
- Plot the point $$ (a, b) $$ on the complex plane. 
- Calculate the modulus using $$ |z| = \sqrt{a^2 + b^2} $$. 

Understanding these steps provides a clear method for graphing complex numbers and recognizing their properties in real-world applications such as electrical engineering, where complex numbers are used to represent voltage and current, or in computer graphics for transformations.
