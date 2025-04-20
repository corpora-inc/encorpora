## Solving Logarithmic Equations and Applications

This lesson focuses on solving equations that involve logarithms and applying these methods to real-world scenarios. We review the properties of logarithms, learn to solve equations with step-by-step methods, and verify domain restrictions to ensure valid solutions.

### Key Concepts

> Logarithms are the inverses of exponential functions. They help us determine the power to which a base must be raised to obtain a given number.

Remember:

- The argument of any logarithm must be positive.
- Use product, quotient, and power rules to simplify logarithmic expressions.
- Converting from logarithmic to exponential form can simplify solving under proper domain restrictions.

These rules ensure that we always work with valid expressions and correctly transform equations for solution.

### Example 1: Single Logarithm Equation

![Plot of $y=\log_2(x-3)$ with horizontal line $y=4$, highlighting the intersection at $x=19$.](images/plot_1_06-05-lesson-solving-logarithmic-equations-and-applications.md.png)

Consider the equation

$$
\log_2(x - 3) = 4.
$$

This equation asks: "To what power must $2$ be raised to yield $(x-3)$?" In other words, $x-3$ equals $2$ raised to the power $4$.

**Step 1: Convert to Exponential Form**

Recall the equivalence:

$$
\log_b(a)=c \quad \Longleftrightarrow \quad a=b^c.
$$

Thus, we rewrite the equation as:

$$
x - 3 = 2^4.
$$

**Step 2: Simplify and Solve for $x$**

Compute $2^4$:

$$
x - 3 = 16 \quad \Longrightarrow \quad x = 16 + 3 = 19.
$$

**Step 3: Check the Domain**

The input to a logarithm must be positive. Since the logarithm is $\log_2(x-3)$, the argument $x-3$ must satisfy:

$$
x - 3 > 0 \quad \Longrightarrow \quad x > 3.
$$

Since $x = 19$ is greater than $3$, it is a valid solution.

The key intuition is that the logarithm reverses exponentiation. By converting $\log_2(x-3)=4$ into its exponential form, we use known powers of $2$ to directly solve for $x$.

### Example 2: Combining Logarithms

![Plot of $y=\log((2x+1)(x-2))$ and $y=\log(3x-3)$ for $x>2$, marking the intersection point.](images/plot_2_06-05-lesson-solving-logarithmic-equations-and-applications.md.png)

Consider the equation

$$
\log(2x + 1) + \log(x - 2) = \log(3x - 3).
$$

This equation involves a sum of logarithms. We can combine them to simplify the problem.

**Step 1: Combine the Logarithms**

Use the product rule:

$$
\log(a) + \log(b) = \log(ab).
$$

Thus,

$$
\log((2x + 1)(x - 2)) = \log(3x - 3).
$$

**Step 2: Equate the Arguments**

Since the logarithm function is one-to-one, if

$$
\log(A) = \log(B),
$$

then

$$
A = B.
$$

So, we set

$$
(2x + 1)(x - 2) = 3x - 3.
$$

**Step 3: Expand and Simplify the Equation**

Expand the left-hand side:

$$
(2x + 1)(x - 2) = 2x^2 - 4x + x - 2 = 2x^2 - 3x - 2.
$$

Now equate to the right-hand side:

$$
2x^2 - 3x - 2 = 3x - 3.
$$

Bring all terms to one side:

$$
2x^2 - 3x - 2 - 3x + 3 = 0 \quad \Longrightarrow \quad 2x^2 - 6x + 1 = 0.
$$

**Step 4: Solve the Quadratic Equation**

Apply the quadratic formula

$$
x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}.
$$

For the equation $2x^2 - 6x + 1 = 0$, where $a = 2$, $b = -6$, and $c = 1$, we have:

$$
x = \frac{6 \pm \sqrt{(-6)^2 - 4(2)(1)}}{4} = \frac{6 \pm \sqrt{36 - 8}}{4} = \frac{6 \pm \sqrt{28}}{4}.
$$

Since $\sqrt{28} = 2\sqrt{7}$, this simplifies to:

$$
x = \frac{6 \pm 2\sqrt{7}}{4} = \frac{3 \pm \sqrt{7}}{2}.
$$

**Step 5: Check Domain Restrictions**

For the logarithms to be defined, the arguments must be positive:

- For $\log(2x+1)$: $2x+1 > 0$ implies $x > -\frac{1}{2}$.
- For $\log(x-2)$: $x-2 > 0$ implies $x > 2$.
- For $\log(3x-3)$: $3x-3 > 0$ implies $x > 1$.

The most restrictive condition is $x > 2$.

Evaluate the solutions:

- $x = \frac{3 + \sqrt{7}}{2} \approx 2.82$, which satisfies $x > 2$.
- $x = \frac{3 - \sqrt{7}}{2} \approx 0.18$, which does not satisfy $x > 2$.

Thus, the only valid solution is:

$$
x = \frac{3 + \sqrt{7}}{2}.
$$

This example shows that after simplifying and solving, it is crucial to check that the solution fits within the domain of the original logarithmic expressions.

### Example 3: Real-World Application Using pH

The pH of a solution is defined by the equation:

$$
pH = -\log [H^+],
$$

where $[H^+]$ is the concentration of hydrogen ions in moles per liter (M).

**Step 1: Write the Equation**

For a solution with pH 3, we have:

$$
-\log [H^+] = 3.
$$

Multiplying both sides by $-1$ gives:

$$
\log [H^+] = -3.
$$

**Step 2: Convert to Exponential Form**

Using the equivalence $\log(a)=c \Longleftrightarrow a=10^c$, we obtain:

$$
[H^+] = 10^{-3}.
$$

Thus, the hydrogen ion concentration is:

$$
[H^+] = 0.001\;M.
$$

This conversion from logarithmic to exponential form is not only a key algebraic skill but also a practical tool in chemistry for determining solution acidity.

### Conclusion

This lesson demonstrated two primary methods for solving logarithmic equations:

- Converting a single logarithmic equation to exponential form.
- Combining multiple logarithms, then solving the resulting equation while checking for domain restrictions.

These techniques are essential for solving problems in algebra and have practical applications in fields such as chemistry and engineering. Following each step carefully and ensuring that all domain requirements are met will build a solid foundation for more advanced algebraic problem-solving, especially as you prepare for the College Algebra CLEP exam.