## Exploring Recursive Sequences and Formula Derivation

A recursive sequence is defined by its first term (or terms) and a rule that describes how to obtain each subsequent term from the previous one. In many cases, it is helpful to derive an explicit formula (a formula for the $n$th term) that allows you to calculate any term without computing all the preceding ones.

### Understanding Recursive Sequences

A recursive sequence has two main parts:

1. **Initial Term(s):** The starting value(s) needed to begin the sequence.
2. **Recursive Rule:** A formula that expresses each term in terms of previous term(s).

For example, consider a sequence with the initial term $a_1$ and a rule such as:

$$
a_n = a_{n-1} + d
$$

This is the pattern for an arithmetic sequence, where $d$ is a constant difference.

> A recursive sequence emphasizes the process of building each term step by step.

### Method for Deriving an Explicit Formula

To derive an explicit formula from a recursive sequence, follow these steps:

1. **Write out the first few terms.** This will help you detect a pattern.
2. **Identify the pattern.** Look for constant differences (arithmetic) or constant ratios (geometric).
3. **Express the $n$th term in terms of the first term.** Use the pattern to generalize how the sequence grows.

Below are detailed examples that illustrate this process.

### Example 1: An Arithmetic Sequence

Consider the recursive sequence defined by:

$$
a_1 = 3, \quad a_n = a_{n-1} + 4 \quad \text{for } n \geq 2.
$$

**Step 1: Write out the first few terms.**

- $a_1 = 3$
- $a_2 = 3 + 4 = 7$
- $a_3 = 7 + 4 = 11$
- $a_4 = 11 + 4 = 15$

**Step 2: Identify the pattern.**

Each term increases by the constant $4$. This is an arithmetic sequence.

**Step 3: Derive the explicit formula.**

The general formula for the $n$th term of an arithmetic sequence is:

$$
a_n = a_1 + (n-1)d
$$

Substitute $a_1 = 3$ and $d = 4$:

$$
a_n = 3 + (n-1) \times 4
$$

This formula allows you to compute any term in the sequence directly.

### Example 2: A Geometric Sequence

Now consider a sequence defined by:

$$
a_1 = 2, \quad a_n = 3 \times a_{n-1} \quad \text{for } n \geq 2.
$$

**Step 1: Write out the first few terms.**

- $a_1 = 2$
- $a_2 = 3 \times 2 = 6$
- $a_3 = 3 \times 6 = 18$
- $a_4 = 3 \times 18 = 54$

**Step 2: Identify the pattern.**

Each term is obtained by multiplying the previous term by $3$. This is a geometric sequence.

**Step 3: Derive the explicit formula.**

For a geometric sequence, the $n$th term is given by:

$$
a_n = a_1 \times r^{(n-1)}
$$

Here, $a_1 = 2$ and the common ratio $r = 3$. Thus:

$$
a_n = 2 \times 3^{(n-1)}
$$

### Real-World Application

Recursive sequences and their explicit formulas are useful in modeling real-life situations. One common example is in finance:

- **Compound Interest:** Suppose you deposit an amount of money in a bank account that earns a fixed interest rate. The account balance can be modeled recursively, where each term represents the balance after one year.

For a deposit of $P$ dollars and an annual interest rate $r$, the recursive formula is:

$$
B_1 = P, \quad B_n = B_{n-1} \times (1+r)
$$

The explicit formula becomes:

$$
B_n = P \times (1+r)^{(n-1)}
$$

This allows you to compute the balance after any number of years directly.

### Visualizing the Sequences

A visual representation can help solidify your understanding of how these sequences progress. Consider the following plot of the arithmetic sequence from Example 1:

\vspace*{2em}
\begin{center}
\begin{tikzpicture}[x=0.7cm, y=0.5cm]
  \draw[->] (0,0) -- (10,0) node[right] {Term Index};
  \draw[->] (0,0) -- (0,20) node[above] {Sequence Value};
  \foreach \n in {1,2,3,4,5,6,7,8,9} {
    \draw (\n,0.2) -- (\n,-0.2) node[below] {\n};
  }
  \foreach \y in {3,7,11,15} {
    \draw (-0.2,\y) -- (0.2,\y);
  }
  \fill (1,3) circle (2pt);
  \fill (2,7) circle (2pt);
  \fill (3,11) circle (2pt);
  \fill (4,15) circle (2pt);
\end{tikzpicture}
\end{center}
\vspace*{2em}

This plot illustrates how the sequence grows by a constant amount with each term.

### Key Takeaways

- A recursive sequence is defined by an initial term and a rule for finding subsequent terms.
- Deriving an explicit formula involves recognizing patterns such as constant differences (arithmetic) or constant ratios (geometric).
- Explicit formulas allow direct computation of any term in the sequence without needing to calculate all previous terms.
- These concepts have practical applications, such as in calculating compound interest in financial modeling.