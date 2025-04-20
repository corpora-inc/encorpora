## Factoring Polynomials and Common Factors

In this lesson, we focus on factoring polynomials by first identifying and extracting common factors. Factoring is the process of rewriting a polynomial as a product of simpler expressions. This is a key skill for solving equations and simplifying algebraic expressions in real-world applications such as engineering calculations or financial modeling.

### Understanding Common Factors

A common factor is a number, variable, or expression that divides each term of a polynomial without leaving a remainder. The first step in factoring many polynomials is to find the greatest common factor (GCF).

> The greatest common factor (GCF) of two or more terms is the largest expression that divides each term exactly.

### Steps to Factor Out the GCF

1. **Identify the GCF for the coefficients:** Look at the numerical parts of each term and find the largest number that divides them all.

2. **Identify the common variables:** For variables that appear in every term, use the smallest power common to all terms.

3. **Extract the GCF:** Rewrite the polynomial as the product of the GCF and the remaining polynomial.

### Example 1: Factoring a Basic Polynomial


![2D line plot showing the polynomial f(x)=6x^3+9x^2 and its roots, which demonstrate the factoring into 3x^2(2x+3).](images/plot_1_04-03-lesson-factoring-polynomials-and-common-factors.md.png)



Factor the polynomial:

$$
6x^3 + 9x^2
$$

**Step 1: Find the GCF of 6 and 9.**

The greatest common factor of 6 and 9 is 3.

**Step 2: Look at the variable part.**

Both terms have $x^2$ at minimum. The GCF for the variables is $x^2$.

**Step 3: Factor out the GCF.**

The GCF is $3x^2$. Divide each term by $3x^2$:

$$
\frac{6x^3}{3x^2} = 2x, \quad \frac{9x^2}{3x^2} = 3.
$$

Thus, the factored form is:

$$
6x^3 + 9x^2 = 3x^2(2x + 3).
$$

### Example 2: Factoring a Polynomial with Multiple Variables

Consider the polynomial:

$$
12xy^2 + 18x^2y
$$

**Step 1: Identify the GCF of the coefficients.**

The GCF of 12 and 18 is 6.

**Step 2: Determine the common variable factors.**

Both terms contain $x$ and $y$. For $x$, the least power is $x$ (or $x^1$) and for $y$, the least power is $y$.

**Step 3: Factor out the GCF.**

The common factor is $6xy$. Divide each term by $6xy$:

$$
\frac{12xy^2}{6xy} = 2y, \quad \frac{18x^2y}{6xy} = 3x.
$$

So, the polynomial factors as:

$$
12xy^2 + 18x^2y = 6xy(2y + 3x).
$$

### Example 3: Factoring by Grouping

Sometimes a polynomial does not have a common factor for all terms but can be grouped. Consider this polynomial:

$$
ax + ay + bx + by
$$

**Step 1: Group the terms.**

Group terms with common factors:

$$
(ax + ay) + (bx + by).
$$

**Step 2: Factor out common factors in each group.**

From the first group $ax + ay$, factor out $a$:

$$
a(x + y).
$$

From the second group $bx + by$, factor out $b$:

$$
b(x + y).
$$

Now the expression is:

$$
a(x + y) + b(x + y).
$$

**Step 3: Factor out the common binomial.**

The common binomial is $(x + y)$:

$$
(x + y)(a + b).
$$

Thus, the factored form is:

$$
ax + ay + bx + by = (x + y)(a + b).
$$

### Real-World Connection

Factoring is not only used in mathematics but also in solving real-life problems. For example, in sports analytics, a polynomial might represent the score difference over time in a game. By factoring the polynomial, you can easily find critical values, such as when the score levels equalize. In engineering, factoring can simplify complex formulas, making it easier to solve for unknown variables in design calculations.

### Practice Tips

- Always start by looking for the greatest common factor.
- When no overall common factor exists, try grouping terms.
- Check your work by multiplying the factored terms to see if you retrieve the original polynomial.

This step-by-step approach to factoring polynomials provides a systematic method to simplify expressions, making subsequent problem-solving easier and more efficient.