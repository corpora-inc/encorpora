## Polynomial Division and Synthetic Division

![Plot showing $f(x)=(x-1)Q(x)+R$.](images/plot_1_04-04-lesson-polynomial-division-and-synthetic-division.md.png)

Polynomial division is the process of dividing one polynomial (the dividend) by another (the divisor), similar to the long division of numbers. This technique is crucial for simplifying complex rational expressions and solving polynomial equations. Synthetic division, a shortcut method, is used when dividing by a linear factor of the form $x-c$, making calculations faster and less error-prone.

### Polynomial Long Division

The long division method in algebra follows these steps:

1. Divide the first term of the dividend by the first term of the divisor to determine the first term of the quotient.
2. Multiply the entire divisor by this quotient term.
3. Subtract the resulting product from the dividend to form a new sub-dividend.
4. Bring down the next term from the dividend and repeat the process until every term has been handled.

This process mirrors numerical long division and helps build intuition by breaking a complex problem into smaller, manageable steps.

#### Step-by-Step Example of Long Division

We want to divide

$$
2x^3 - 3x^2 + 4x - 5
$$

by

$$
x - 1.
$$

1. **Divide the leading term:**

   Divide $2x^3$ by $x$ to obtain $2x^2$. Write $2x^2$ above the division bar.

2. **Multiply:**

   Multiply $2x^2$ by the divisor $(x-1)$:

   $$
   2x^2 \cdot (x-1) = 2x^3 - 2x^2.
   $$

3. **Subtract:**

   Subtract the result from the dividend:

   $$
   \begin{array}{r@{}r@{}r@{}r}
         & 2x^3 & -3x^2 & +4x - 5 \\
   -\,( & 2x^3 & -2x^2 & ) \\
   \hline
         & 0    & -x^2 & +4x - 5 
   \end{array}
   $$

4. **Bring down:**

   Bring down the next term so that the new sub-dividend is $-x^2+4x$.

5. **Divide:**

   Divide $-x^2$ by $x$ to get $-x$. Write $-x$ in the quotient next to $2x^2$.

6. **Multiply:**

   Multiply $-x$ by $(x-1)$:

   $$
   -x(x-1) = -x^2 + x.
   $$

7. **Subtract:**

   Subtract this product from the sub-dividend:

   $$
   \begin{array}{r@{}r@{}r}
         & -x^2 & +4x \\
   -\,( & -x^2 & + x ) \\
   \hline
         & 0    & +3x 
   \end{array}
   $$

8. **Bring down the next term:**

   Bring down the remaining term $-5$, forming $3x - 5$.

9. **Divide:**

   Divide $3x$ by $x$ to obtain $3$. Write this in the quotient.

10. **Multiply:**

    Multiply $3$ by $(x-1)$:

    $$
    3(x-1)= 3x - 3.
    $$

11. **Subtract:**

    Subtract this from $3x-5$:

    $$
    \begin{array}{r@{}r}
         & 3x - 5 \\
    -\,( & 3x - 3 ) \\
    \hline
         & -2 
    \end{array}
    $$

The quotient is $2x^2 - x + 3$ and the remainder is $-2$. Thus, the division result is written as:

$$
\frac{2x^3 - 3x^2 + 4x - 5}{x - 1} = 2x^2 - x + 3 - \frac{2}{x-1}.
$$

### Synthetic Division

Synthetic division offers a simplified process when dividing by a linear factor, $x-c$. It uses only the coefficients, making the division quicker and more straightforward. The steps are as follows:

1. **Identify $c$:**

   From the divisor $x-c$, identify $c$.

2. **Write the coefficients:**

   List the coefficients of the dividend in descending order. Insert a $0$ for any missing term.

3. **Bring Down:**

   Bring down the first coefficient to the bottom row.

4. **Multiply and Add:**

   Multiply the number just written by $c$. Write the product under the next coefficient. Add this product to the coefficient and write the result in the bottom row.

5. **Repeat:**

   Continue this process until all coefficients have been processed. The final number in the bottom row is the remainder.

This method minimizes the steps and reduces error when the divisor is of the form $x-c$.

#### Step-by-Step Example of Synthetic Division

Divide

$$
2x^3 - 3x^2 + 4x - 5
$$

by

$$
x-1,
$$

with $c = 1$.

1. **List the coefficients:**

   The coefficients are: $2$, $-3$, $4$, $-5$.

2. **Set up synthetic division:**

   $$
   \begin{array}{c|cccc}
     1 & 2 & -3 & 4 & -5 \\
       &   &    &   &    \\
   \hline
       &   &    &   &    
   \end{array}
   $$

3. **Bring down the first coefficient:**

   $$
   \begin{array}{c|cccc}
     1 & 2 & -3 & 4 & -5 \\
       &   &    &   &    \\
   \hline
       & 2 &    &   &    
   \end{array}
   $$

4. **Multiply and write below:**

   Multiply $2$ by $1$ to get $2$. Write this under the second coefficient:

   $$
   \begin{array}{c|cccc}
     1 & 2 & -3 & 4 & -5 \\
       &   & 2  &   &    \\
   \hline
       & 2 &    &   &    
   \end{array}
   $$

5. **Add:**

   Add $-3$ and $2$ to get $-1$:

   $$
   \begin{array}{c|cccc}
     1 & 2 & -3 & 4 & -5 \\
       &   & 2  &   &    \\
   \hline
       & 2 & -1 &   &    
   \end{array}
   $$

6. **Multiply:**

   Multiply $-1$ by $1$ to obtain $-1$. Write this underneath the third coefficient:

   $$
   \begin{array}{c|cccc}
     1 & 2 & -3 & 4 & -5 \\
       &   & 2  & -1 &    \\
   \hline
       & 2 & -1 &   &    
   \end{array}
   $$

7. **Add:**

   Add $4$ and $-1$ to get $3$:

   $$
   \begin{array}{c|cccc}
     1 & 2 & -3 & 4 & -5 \\
       &   & 2  & -1 &    \\
   \hline
       & 2 & -1 & 3 &    
   \end{array}
   $$

8. **Multiply:**

   Multiply $3$ by $1$ to get $3$. Write the result under the fourth coefficient:

   $$
   \begin{array}{c|cccc}
     1 & 2 & -3 & 4 & -5 \\
       &   & 2  & -1 & 3  \\
   \hline
       & 2 & -1 & 3 &    
   \end{array}
   $$

9. **Add:**

   Add $-5$ and $3$ to obtain $-2$:

   $$
   \begin{array}{c|cccc}
     1 & 2 & -3 & 4 & -5 \\
       &   & 2  & -1 & 3  \\
   \hline
       & 2 & -1 & 3 & -2 
   \end{array}
   $$

The bottom row, except for the last number, represents the coefficients of the quotient, and the last number is the remainder. Therefore, the quotient is $2x^2 - x + 3$ and the remainder is $-2$. We express the final answer as:

$$
\frac{2x^3 - 3x^2 + 4x - 5}{x-1} = 2x^2 - x + 3 - \frac{2}{x-1}.
$$

### Applications and Key Points

> Polynomial division is essential for simplifying algebraic expressions and solving higher degree polynomial equations. These methods are widely used in fields like engineering, economics, and statistics.

Synthetic division is especially useful when the divisor is linear, as it streamlines the process and minimizes calculations.

Understanding both long division and synthetic division builds a strong foundation for advanced algebra topics and real-world problem solving.