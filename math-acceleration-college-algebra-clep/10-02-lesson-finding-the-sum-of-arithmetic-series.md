## Finding the Sum of Arithmetic Series

An arithmetic series is the sum of the terms in an arithmetic sequence. In an arithmetic sequence, each term increases or decreases by a constant value called the common difference ($d$). The formulas for finding the sum of the first $n$ terms of an arithmetic sequence are key tools in algebra.

### Key Formulas

There are two common forms for the sum of an arithmetic series:

1. Using the first and last term:

$$
S_n = \frac{n}{2}(a_1 + a_n)
$$

2. Using the first term and the common difference:

$$
S_n = \frac{n}{2}(2a_1 + (n-1)d)
$$

Here, $a_1$ is the first term, $a_n$ is the last term, $d$ is the common difference, and $n$ is the number of terms.

### Step-by-Step Example 1

Find the sum of the arithmetic series: $3,\; 7,\; 11, \; \ldots,\; 39$.

1. **Identify the First Term and Common Difference**

   The first term is $a_1 = 3$. 

   To find the common difference $d$, subtract the first term from the second term:

   $$
d = 7 - 3 = 4
   $$

2. **Determine the Number of Terms ($n$)**

   Use the formula for the $n$th term of an arithmetic sequence:

   $$
a_n = a_1 + (n-1)d
   $$

   Here, $a_n = 39$. Substitute the known values:

   $$
39 = 3 + (n-1)\times 4
   $$

   Subtract $3$ from both sides:

   $$
36 = 4(n-1)
   $$

   Divide by $4$:

   $$
9 = n-1
   $$

   Solve for $n$:

   $$
n = 10
   $$

3. **Calculate the Sum**

   Use the sum formula with the first and last terms:

   $$
S_n = \frac{n}{2}(a_1 + a_n) = \frac{10}{2}(3 + 39) = 5 \times 42 = 210
   $$

   Therefore, the sum of the series is $210$.

### Step-by-Step Example 2: Real-World Application

Imagine you are planning a series of payments. Your first payment is $100, and each payment increases by $25. You plan to make $12$ payments. Find the total amount paid.

1. **Identify the First Term and Common Difference**

   The first payment is $a_1 = 100$, and the common difference is $d = 25$.

2. **Find the Last Payment**

   Use the $n$th term formula:

   $$
a_n = 100 + (12-1)\times 25 = 100 + 275 = 375
   $$

3. **Compute the Total Amount**

   Use the sum formula with the first and last payments:

   $$
S_n = \frac{12}{2}(100 + 375) = 6 \times 475 = 2850
   $$

   Thus, the total amount paid over $12$ payments is $2850$.

### Understanding the Process

> In any arithmetic series, identifying the first term, common difference, and the number of terms is essential before applying the sum formulas.

These methods allow you to quickly compute sums without adding each term individually. This approach is especially useful in financial planning, inventory analysis, and many other real-world scenarios where quantities change uniformly.

### Additional Insight

The formula $$S_n = \frac{n}{2}(a_1 + a_n)$$ is often preferred when you know both the first and last terms, while $$S_n = \frac{n}{2}(2a_1 + (n-1)d)$$ is useful when the last term is not immediately obvious. Both lead to the same answer and provide flexibility depending on the information given.

By understanding and applying these formulas, you build a fundamental skill in algebra that can be applied to various problems on the CLEP exam and beyond.