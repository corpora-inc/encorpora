## Graphing Rational Functions and Understanding Asymptotes

Rational functions are ratios of two polynomials. They have a form

$$
R(x) = \frac{P(x)}{Q(x)}
$$

where both $P(x)$ and $Q(x)$ are polynomials and $Q(x)$ is not zero. When graphing these functions, you may encounter special features such as holes, vertical asymptotes, horizontal asymptotes, and oblique asymptotes.

> An asymptote is a line that the graph of a function approaches but never touches.


### 1. Understanding Domain Restrictions and Holes

Before graphing a rational function, identify the values of $x$ that make the denominator zero. These values are excluded from the domain. Sometimes, a factor in the numerator cancels with a factor in the denominator. When this happens, the graph has a hole instead of a vertical asymptote at that value.

For example, consider the function

$$
f(x) = \frac{x^2 - 1}{x - 1}.
$$

Factor the numerator:

$$
x^2 - 1 = (x - 1)(x + 1).
$$

Then

$$
f(x) = \frac{(x - 1)(x + 1)}{x - 1}, \quad x \neq 1.
$$

Cancel the common factor:

$$
f(x) = x + 1 \quad \text{with a hole at } x = 1.
$$


### 2. Vertical Asymptotes

A vertical asymptote occurs where the function grows without bound. It is found by setting the denominator equal to zero (after canceling any common factors).

**Example:**

Examine the function

$$
R(x) = \frac{2x}{x - 3}.
$$

- **Domain:** $x \neq 3$ because $x - 3 = 0$ when $x = 3$.
- **Vertical asymptote:** $x = 3$, since the function becomes unbounded as $x$ approaches 3.

To confirm, observe the behavior:

- As $x$ approaches 3 from the left ($x \to 3^-$), the denominator is slightly negative and the numerator is near $6$, so $R(x)$ tends to $-\infty$.
- As $x$ approaches 3 from the right ($x \to 3^+$), the denominator is slightly positive, so $R(x)$ tends to $+\infty$.


### 3. Horizontal Asymptotes

Horizontal asymptotes describe the behavior of a function as $x$ tends to $\pm\infty$. They are determined by comparing the degrees of the numerator (degree $n$) and denominator (degree $m$):

- If $n < m$, the horizontal asymptote is $y = 0$.
- If $n = m$, the horizontal asymptote is the ratio of the leading coefficients.
- If $n > m$, there is no horizontal asymptote (an oblique or slant asymptote may exist).

**Example:** (Using the function from before)

$$
R(x) = \frac{2x}{x - 3}.
$$

Both numerator and denominator are degree 1. The ratio of the leading coefficients gives the horizontal asymptote:

$$
y = \frac{2}{1} = 2.
$$

Thus, the horizontal asymptote is $y = 2$.


### 4. Oblique (Slant) Asymptotes

When the degree of the numerator is one higher than that of the denominator ($n = m + 1$), the function may have an oblique asymptote. This asymptote is the quotient obtained by dividing the numerator by the denominator using polynomial long division.

**Example:**

Consider the function

$$
R(x) = \frac{x^2 + 2x + 1}{x - 1}.
$$

- **Step 1:** Identify the domain. Set $x - 1 = 0$, hence $x \neq 1$.

- **Step 2:** Perform polynomial long division.

Divide $x^2 + 2x + 1$ by $x - 1$:

$$
\begin{array}{r@{}r@{}r}
   & x + 3 & \text{ (Quotient)} \\
x - 1 & \overline{)\, x^2 + 2x + 1} & \text{(Dividend)} \\
   & x^2 - x & \text{(Multiply } x \times (x-1) \text{)} \\
\cline{2-3}
   & \quad 3x + 1 & \\
   & \quad 3x - 3 & \text{(Multiply } 3 \times (x-1) \text{)} \\
\cline{2-3}
   & \quad\quad 4 & \text{(Remainder)} 
\end{array}
$$

- **Step 3:** The quotient $x + 3$ is the oblique asymptote.

Thus, as $x \to \pm\infty$, the graph of $R(x)$ approaches the line

$$
y = x + 3.
$$


### 5. Graphing Steps Summary

When graphing a rational function:

1. **Determine the Domain:** Solve $Q(x) = 0$ to find values to exclude.
2. **Find Holes:** Check for common factors in $P(x)$ and $Q(x)$.
3. **Identify Vertical Asymptotes:** Set the remaining factors in $Q(x)$ equal to zero.
4. **Determine Horizontal or Oblique Asymptotes:** Compare the degrees of the numerator and denominator or use polynomial long division.
5. **Plot Key Points:** Find intercepts and test values on either side of asymptotes.
6. **Sketch the Graph:** Draw the asymptotes as dashed lines and graph the function approaching these lines.


### 6. Real-World Applications

Graphing rational functions is useful in many fields:

- **Engineering:** Rational functions can model systems where outputs are proportionate to inputs with limits, such as in control systems.
- **Economics:** They help represent cost functions or rates of change in markets with limits.
- **Architecture:** Ratios of dimensions and load distributions may follow rational relationships.

Understanding asymptotes allows one to predict long-term behavior and identify limits, even if the exact values are hard to compute.


### 7. Visualizing the Concept

Below is an example plot of the function

$$
R(x) = \frac{2x}{x - 3}
$$

with its vertical asymptote at $x = 3$ and horizontal asymptote at $y = 2$.

\vspace*{2em}
\begin{center}
\begin{tikzpicture}
    \begin{axis}[
        xlabel={$x$},
        ylabel={$R(x)$},
        xmin=-10, xmax=10,
        ymin=-10, ymax=10,
        axis lines=middle,
        samples=100,
        domain=-10:10,
        clip=false
    ]
    \addplot[blue, thick, domain=-10:2.9] { (2*x)/(x-3) };
    \addplot[blue, thick, domain=3.1:10] { (2*x)/(x-3) };

    % Draw vertical asymptote
    \addplot[dashed, red] coordinates {(3,-10) (3,10)};
    % Draw horizontal asymptote
    \addplot[dashed, red] coordinates {(-10,2) (10,2)};
    \end{axis}
\end{tikzpicture}
\end{center}

Use similar steps for other rational functions to reveal their behavior and approach, providing clear insights into how the function behaves near critical points and at infinity.
