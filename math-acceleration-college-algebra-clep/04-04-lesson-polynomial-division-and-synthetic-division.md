## Polynomial Division and Synthetic Division

![Plot showing $f(x)=(x-1)Q(x)+R$.](images/plot_1_04-04-lesson-polynomial-division-and-synthetic-division.md.png)

Polynomial division is the process of dividing one polynomial (the dividend) by another (the divisor) in a method analogous to long division with numbers. This technique helps simplify complex expressions and is a crucial tool for solving polynomial equations. In addition, synthetic division is a shortcut method used when the divisor is a linear factor of the form $x-c$, which makes the process faster and reduces the chance of making errors.

### Polynomial Long Division

The method of long division for polynomials follows a repeating cycle of four steps. Each cycle reduces the degree of the dividend until what remains (the remainder) is of lower degree than the divisor. The four steps are:

1. **Divide:** Take the leading (highest degree) term of the current dividend and divide it by the leading term of the divisor. This gives one term of the quotient.
2. **Multiply:** Multiply the entire divisor by the term obtained in the first step. This produces a product polynomial.
3. **Subtract:** Subtract the product from the current dividend. This subtraction eliminates the leading term, producing a new polynomial which becomes the new dividend.
4. **Repeat:** Continue the process with the new dividend until its degree is less than that of the divisor.

Let’s work through a detailed example.

#### Example: Dividing $2x^3 - 3x^2 + 4x - 5$ by $x - 1$

We want to find the quotient and remainder when dividing

$$
2x^3 - 3x^2 + 4x - 5
$$

by

$$
x - 1.
$$

**Step 1: Divide the Leading Terms**

Identify the leading term of the dividend, $2x^3$, and the leading term of the divisor, $x$. Divide:

$$
2x^3 \div x = 2x^2.
$$

This result, $2x^2$, is the first term of the quotient.

**Step 2: Multiply the Divisor**

Multiply the entire divisor $x - 1$ by $2x^2$:

$$
2x^2 \times (x - 1) = 2x^3 - 2x^2.
$$

**Step 3: Subtract**

Subtract the product from the original dividend. Write the subtraction term-by-term:

$$
(2x^3 - 3x^2 + 4x - 5) - (2x^3 - 2x^2) = \; (2x^3 - 2x^3) + (-3x^2 + 2x^2) + 4x - 5.
$$

This simplifies to:

$$
-x^2 + 4x - 5.
$$

Now, $-x^2 + 4x - 5$ becomes the new dividend.

**Step 4: Repeat for the New Dividend**

Now divide the leading term of the new dividend, $-x^2$, by the leading term of the divisor, $x$:

$$
-x^2 \div x = -x.
$$

Add $-x$ to the quotient. The quotient is now $2x^2 - x$.

Multiply the divisor by $-x$:

$$
-x \times (x - 1) = -x^2 + x.
$$

Subtract this product from the current dividend:

$$
(-x^2 + 4x - 5) - (-x^2 + x) = (-x^2 + x^2) + (4x - x) - 5 = 3x - 5.
$$

The new dividend is now $3x - 5$.

**Step 5: Final Division Step**

Divide the leading term of $3x - 5$, which is $3x$, by $x$:

$$
3x \div x = 3.
$$

Add $3$ to the quotient to get $2x^2 - x + 3$.

Multiply the divisor by $3$:

$$
3 \times (x - 1) = 3x - 3.
$$

Subtract this from $3x - 5$:

$$
(3x - 5) - (3x - 3) = (3x - 3x) + (-5 + 3) = -2.
$$

Since the result, $-2$, is of lower degree than $x - 1$, this number is the remainder.

**Final Answer:**

The division can be expressed as:

$$
\frac{2x^3 - 3x^2 + 4x - 5}{x - 1} = 2x^2 - x + 3 - \frac{2}{x - 1}.
$$

### Synthetic Division

Synthetic division is a streamlined method that uses only the coefficients of the dividend polynomial. It is especially useful when the divisor is a linear factor of the form $x - c$. The process eliminates variables and focuses on the arithmetic of the coefficients.

Here is how to perform synthetic division step-by-step for the same problem.

#### Example: Dividing $2x^3 - 3x^2 + 4x - 5$ by $x - 1$

**Step 1: Identify $c$**

For a divisor of the form $x - c$, compare $x - 1$ to obtain $c = 1$.

**Step 2: List the Coefficients**

Write down the coefficients of $2x^3 - 3x^2 + 4x - 5$ in order:

$$
\text{Coefficients: } 2, \; -3, \; 4, \; -5.
$$

**Step 3: Bring Down the First Coefficient**

Start by bringing the first coefficient, $2$, directly down. This value is written in the bottom row.

$$
[2]
$$

**Step 4: Multiply and Add Repeatedly**

Now, for each remaining coefficient, multiply the most recent number from the bottom row by $c$, and then add this product to the next coefficient:

- Multiply $2$ (the number brought down) by $c=1$:

  $$
  2 \times 1 = 2.
  $$

  Add this to the next coefficient $-3$:

  $$
  -3 + 2 = -1.
  $$

  Write $-1$ in the bottom row next to $2$.

- Multiply $-1$ by $1$:

  $$
  -1 \times 1 = -1.
  $$

  Add this to $4$:

  $$
  4 + (-1) = 3.
  $$

  Write $3$ in the bottom row.

- Multiply $3$ by $1$:

  $$
  3 \times 1 = 3.
  $$

  Add this to $-5$:

  $$
  -5 + 3 = -2.
  $$

  Write $-2$ in the bottom row. This final number is the remainder.

The bottom row now reads:

$$
2, \; -1, \; 3, \; -2.
$$

The first three numbers, $2, -1, 3$, form the coefficients of the quotient polynomial, which corresponds to:

$$
2x^2 - x + 3.
$$

The last number, $-2$, is the remainder.

**Step 5: Write the Final Result**

Thus, the division is summarized as:

$$
\frac{2x^3 - 3x^2 + 4x - 5}{x - 1} = 2x^2 - x + 3 - \frac{2}{x - 1}.
$$

### Detailed Intuition and Tips

- In long division, each subtraction removes the highest-degree term, simplifying the polynomial step by step. Think of it as peeling away layers of the polynomial until you are left with a small remainder.

- Synthetic division reduces the process to simple multiplication and addition. By handling only the coefficients, it bypasses the need to write variables at each step, which speeds up the computation.

- Always verify the degree of the remainder. When the degree of the remaining polynomial is less than the degree of the divisor, the division process is complete.

By understanding both the long division and synthetic division methods with these detailed steps, you gain a clear and structured approach to dividing polynomials. Mastery of these techniques provides a solid foundation for solving algebraic problems on the College Algebra CLEP exam.