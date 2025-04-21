## Advanced Challenge Problems for Critical Thinking

In this lesson, we tackle advanced algebra problems that integrate several concepts. These examples combine rational equations, absolute value equations, and function composition leading to a quadratic equation. Each example is explained with detailed steps to help you understand the underlying methods and develop effective problem-solving techniques.

---

### Example 1: Solving a Rational Equation

Solve the equation:

$$
\frac{2}{x-1} + \frac{3}{x+2} = \frac{7}{x^2+x-2}
$$

**Step 1: Factor the Denominator**

The quadratic expression in the denominator on the right factors as:

$$
x^2+x-2 = (x-1)(x+2)
$$

This factorization shows that the denominators on the left are factors of the right denominator, a key insight when clearing fractions.

**Step 2: Determine the Domain**

Identify values that make any denominator zero. Since

$$
x-1 = 0 \quad\text{when}\quad x = 1,
$$

and

$$
x+2 = 0 \quad\text{when}\quad x = -2,
$$

the domain restrictions are $x \neq 1$ and $x \neq -2$.

**Step 3: Clear the Fractions**

Multiply both sides of the equation by the common denominator $(x-1)(x+2)$ to eliminate the fractions:

$$
2(x+2) + 3(x-1) = 7.
$$

**Step 4: Simplify and Solve**

Expand the expressions:

$$
2x + 4 + 3x - 3 = 7.
$$

Combine like terms:

$$
5x + 1 = 7.
$$

Subtract 1 from both sides:

$$
5x = 6.
$$

Divide both sides by 5:

$$
x = \frac{6}{5}.
$$

This method demonstrates the importance of factorization and clearing denominators when solving rational equations.

**Step 5: Verify the Solution**

Check that $x = \frac{6}{5}$ does not violate the domain restrictions. Since $\frac{6}{5}$ is neither 1 nor -2, the solution is valid.

---

### Example 2: An Absolute Value Equation

Solve the equation:

$$
|2x - 3| = x + 5.
$$

**Step 1: Consider the Domain**

Since the absolute value is always nonnegative, the right-hand side must also be nonnegative:

$$
x + 5 \geq 0 \quad\Rightarrow\quad x \geq -5.
$$

This condition ensures that any solution will yield a nonnegative result on the right side.

**Step 2: Split into Cases**

An absolute value equation is solved by considering two scenarios, based on whether the expression inside is nonnegative or negative.

> **Case 1:** When $2x - 3 \geq 0$ (i.e., $x \geq \frac{3}{2}$)
>
> Under this condition, the equation becomes:
>
> $$
> 2x - 3 = x + 5.
> $$
>
> Subtract $x$ from both sides to obtain:
>
> $$
> x - 3 = 5.
> $$
>
> Add 3 to both sides:
>
> $$
> x = 8.
> $$
>
> Since $8 \geq \frac{3}{2}$ and $8 \geq -5$, this solution is valid.

> **Case 2:** When $2x - 3 < 0$ (i.e., $x < \frac{3}{2}$)
>
> In this case, the absolute value yields the negative of the expression:
>
> $$
> -(2x - 3) = x + 5.
> $$
>
> This simplifies to:
>
> $$
> 3 - 2x = x + 5.
> $$
>
> Add $2x$ to both sides:
>
> $$
> 3 = 3x + 5.
> $$
>
> Subtract 5 from both sides:
>
> $$
> -2 = 3x.
> $$
>
> Divide by 3:
>
> $$
> x = -\frac{2}{3}.
> $$
>
> Verify that $-\frac{2}{3} < \frac{3}{2}$ and $-\frac{2}{3} \geq -5$, confirming its validity.

**Final Answer:** The solutions to the equation are $x = 8$ and $x = -\frac{2}{3}$.

This case analysis illustrates how breaking the problem into separate scenarios helps capture all solutions in absolute value equations.

---

### Example 3: Function Composition Leading to a Quadratic Equation

Let

$$
f(x) = x^2 - 4x + 3 \quad\text{and}\quad g(x) = 2x - 5.
$$

Find all values of $x$ such that

$$
f(g(x)) = 0.
$$

**Step 1: Substitute $g(x)$ into $f(x)$**

Replace $x$ in $f(x)$ with $g(x)$:

$$
f(g(x)) = (2x - 5)^2 - 4(2x - 5) + 3.
$$

**Step 2: Expand the Expression**

Expand $(2x - 5)^2$:

$$
(2x - 5)^2 = 4x^2 - 20x + 25.
$$

Substitute into the equation:

$$
f(g(x)) = 4x^2 - 20x + 25 - 8x + 20 + 3.
$$

**Step 3: Combine Like Terms**

Combine the $x^2$, $x$, and constant terms:

$$
4x^2 - 28x + 48 = 0.
$$

**Step 4: Simplify the Equation**

Divide the entire equation by 4:

$$
x^2 - 7x + 12 = 0.
$$

**Step 5: Factor the Quadratic**

Factor the quadratic equation:

$$
(x - 3)(x - 4) = 0.
$$

This yields the solutions:

$$
x = 3 \quad\text{or}\quad x = 4.
$$

**Step 6: Verify the Solutions**

Both solutions satisfy the original composite function equation, confirming that substitution and factoring effectively solve the problem.

---

This lesson has presented three advanced challenge problems that merge various algebraic techniques. The detailed explanations and step-by-step methods reinforce critical problem-solving skills essential for the College Algebra CLEP exam.