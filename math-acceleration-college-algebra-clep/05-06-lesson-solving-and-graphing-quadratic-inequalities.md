## Solving and Graphing Quadratic Inequalities

In this lesson, we will learn how to solve and graph quadratic inequalities. A quadratic inequality has the form

$$
a x^2 + b x + c \; (<, \leq, >, \geq) \; 0
$$

where $a$, $b$, and $c$ are constants, and the inequality symbol can be any of $<$, $\leq$, $>$, or $\geq$. Understanding these inequalities is important because they describe ranges of values that satisfy a condition, which has many real-world applications such as determining safe operating ranges in engineering or profit intervals in financial planning.

### Step 1: Find the Critical Points

The first step in solving a quadratic inequality is to find the values of $x$ where the quadratic expression equals zero. These values, called critical points, divide the number line into different intervals. To find them, solve the quadratic equation:

$$
a x^2 + b x + c = 0
$$

You can solve this equation by factoring, completing the square, or using the quadratic formula:

$$
x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}
$$

These solutions are the boundary points where the expression changes its sign.

### Step 2: Determine the Intervals and Test for Signs

Once you have the critical points, use them to split the number line into intervals. For example, if the quadratic equation has solutions $x = r$ and $x = s$ (with $r < s$), then the intervals are:

- $x < r$
- $r < x < s$
- $x > s$

Select a test point within each interval to determine if the quadratic expression is positive or negative in that range. Replace $x$ in the expression and check the sign of the result.

### Step 3: Write the Solution

After testing the intervals, choose the intervals that satisfy the original inequality.

> Key Insight: The critical points may or may not be included in the solution, depending on whether the inequality is strict ($<$, $>$) or non-strict ($\leq$, $\geq$).

### Example 1: Solve and Graph the Inequality

Solve the inequality:

$$
x^2 - 5x + 6 < 0
$$

**Step 1:** Factor the quadratic expression:

$$
x^2 - 5x + 6 = (x-2)(x-3)
$$

The critical points are $x=2$ and $x=3$.

**Step 2:** Determine the intervals:

- For $x < 2$, choose $x=1$: 

$$
(1-2)(1-3) = (-1)(-2) = 2 > 0
$$

- For $2 < x < 3$, choose $x=2.5$: 

$$
(2.5-2)(2.5-3) = (0.5)(-0.5) = -0.25 < 0
$$

- For $x > 3$, choose $x=4$: 

$$
(4-2)(4-3) = (2)(1) = 2 > 0
$$

**Step 3:** Write the solution based on the sign and inequality. Since we want values where the quadratic expression is less than zero, the solution is the interval $2 < x < 3$.

**Graphing the Solution:**

Below is an example of a number line that shows the solution interval. The open circles at $2$ and $3$ indicate these endpoints are not included in the solution.

\vspace*{2em}
\begin{center}
\begin{tikzpicture}[x=0.6cm]
  % Draw the number line
  \draw[->] (0,0) -- (12,0) node[right] {Number Line};
  % Place ticks at integer values from 0 to 12
  \foreach \x in {0,2,...,12}
    \draw (\x,0.1) -- (\x,-0.1) node[below] {\x};
  % Mark the critical points with open circles
  \draw[thick] (4,0) circle (0.2cm);
  \draw[thick] (6,0) circle (0.2cm);
  % Shade the region between the critical points
  \draw[thick, red] (4,0) -- (6,0);
\end{tikzpicture}
\end{center}
\vspace*{2em}

Note: In this diagram, the points $x=4$ and $x=6$ correspond to the solutions $x=2$ and $x=3$ after applying a scale factor for the number line. Adjust the scale based on your presentation needs.

### Example 2: Solving a Quadratic Inequality with a \( \geq \) Condition

Solve the inequality:

$$
-2x^2 + 4x + 1 \geq 0
$$

**Step 1:** Multiply the entire inequality by $-1$ (remember to reverse the inequality sign):

$$
2x^2 - 4x - 1 \leq 0
$$

This step is valid because multiplying by a negative number reverses the inequality.

**Step 2:** Find the critical points by solving:

$$
2x^2 - 4x - 1 = 0
$$

Use the quadratic formula with $a=2$, $b=-4$, and $c=-1$:

$$
x = \frac{-(-4) \pm \sqrt{(-4)^2 - 4(2)(-1)}}{2(2)} = \frac{4 \pm \sqrt{16 + 8}}{4} = \frac{4 \pm \sqrt{24}}{4} = \frac{4 \pm 2\sqrt{6}}{4}
$$

Simplify:

$$
x = 1 \pm \frac{\sqrt{6}}{2}
$$

Thus, the critical points are

$$
x = 1 - \frac{\sqrt{6}}{2} \quad \text{and} \quad x = 1 + \frac{\sqrt{6}}{2}
$$

**Step 3:** Test the intervals determined by these points. The testing procedure is similar to Example 1. Here, determine which interval(s) satisfy the inequality $$2x^2 - 4x - 1 \leq 0$$.

After testing, you will find that the inequality holds in the interval between the two critical points. Because the inequality is non-strict (\( \leq \)), include the endpoints.

**Graphing the Solution:**

A number line for this inequality would have closed circles at $x = 1 - \frac{\sqrt{6}}{2}$ and $x = 1 + \frac{\sqrt{6}}{2}$ with the segment between them shaded. Use a similar drawing approach as in Example 1.

### Final Notes

When solving quadratic inequalities, always follow these steps:

1. Find the critical points by solving the corresponding quadratic equation.
2. Divide the number line into intervals using these points.
3. Test a point from each interval to determine the sign of the expression.
4. Write the solution based on the original inequality, remembering to reverse the sign if necessary while multiplying by a negative number.

This method ensures a clear path to not only solving the problem but also visualizing the solution on a number line. Consistent practice of these steps will help you quickly identify the correct intervals and understand the behavior of quadratic functions and inequalities.
