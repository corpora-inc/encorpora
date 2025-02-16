## Arithmetic and Geometric Sequences

Sequences are ordered lists of numbers defined by a specific rule. In this lesson, we cover two common types: arithmetic and geometric sequences. We explain their definitions, formulas, and step-by-step examples to illustrate how to work with them in real-world problems.

### Arithmetic Sequences

An arithmetic sequence is one in which the difference between consecutive terms is constant. This constant is called the common difference, denoted by $d$.

The formula for the $n$th term of an arithmetic sequence is:

$$
a_n = a_1 + (n-1)d
$$

where:
- $a_1$ is the first term,
- $d$ is the common difference,
- $n$ is the term number.

> In arithmetic sequences, the key is the addition of the same number repeatedly.

#### Example 1: Finding a Term in an Arithmetic Sequence

Suppose you have an arithmetic sequence where the first term is $3$ and the common difference is $4$. To find the 8th term, use the formula:

$$
a_8 = 3 + (8-1) \times 4
$$

Step by step:

1. Compute $8-1 = 7$.
2. Multiply $7 \times 4 = 28$.
3. Add the first term: $3 + 28 = 31$.

Thus, the 8th term is $31$.

#### Real-World Application: Payment Plans

An example of an arithmetic sequence in real life is a payment plan where the amount increases by a fixed increment each period. If you start with a $100$ payment and add $20$ each period, the payment amounts form an arithmetic sequence.

### Geometric Sequences

A geometric sequence is one in which each term is found by multiplying the previous term by a constant, called the common ratio, denoted by $r$.

The formula for the $n$th term of a geometric sequence is:

$$
a_n = a_1 \times r^{(n-1)}
$$

where:
- $a_1$ is the first term,
- $r$ is the common ratio,
- $n$ is the term number.

> In geometric sequences, each term is scaled by the same factor.

#### Example 2: Finding a Term in a Geometric Sequence

Consider a geometric sequence with a first term of $2$ and a common ratio of $3$. To find the 5th term:

$$
a_5 = 2 \times 3^{(5-1)}
$$

Step by step:

1. Compute the exponent: $5-1 = 4$.
2. Calculate $3^4 = 81$.
3. Multiply by the first term: $2 \times 81 = 162$.

Thus, the 5th term is $162$.

#### Real-World Application: Population Growth

A common real-world example of a geometric sequence is population growth under ideal conditions. If a population of bacteria doubles every hour, then the number of bacteria forms a geometric sequence.

### Comparing Arithmetic and Geometric Sequences

- **Arithmetic Sequences:** Add a constant difference to find new terms. The growth is linear.

- **Geometric Sequences:** Multiply by a constant ratio to find new terms. The growth is exponential.

Understanding these sequences is essential in many fields such as finance, where arithmetic sequences can model regular savings plans, and geometric sequences can model compound interest.

### Additional Example: Identifying the Sequence Type

Consider the sequence: $5$, $10$, $15$, $20$, ...

1. Check the difference between consecutive terms: $10-5=5$, $15-10=5$, $20-15=5$. The common difference is constant ($d=5$), so this is an arithmetic sequence.

Now, consider the sequence: $3$, $6$, $12$, $24$, ...

1. Check the ratio between consecutive terms: $6/3=2$, $12/6=2$, $24/12=2$. The common ratio is constant ($r=2$), making it a geometric sequence.

### Visual Representation

Below is a simple diagram that represents how an arithmetic sequence progresses on a number line. Each term is a fixed distance apart.

\vspace*{2em}
\begin{center}
\begin{tikzpicture}[x=0.6cm]
  % Draw a number line from 0 to 20
  \draw[->] (0,0) -- (20,0) node[right] {Number Line};
  \foreach \x in {0,4,8,12,16,20}
      \draw (\x,0.15) -- (\x,-0.15) node[below] {\x};
  % Mark terms of the arithmetic sequence: 3, 7, 11, 15, 19
  \foreach \x in {3,7,11,15,19}
      \draw[fill=red] (\x,0) circle (2pt);
\end{tikzpicture}
\end{center}
\vspace*{2em}

A similar approach can show exponential growth for geometric sequences, though the spacing on a number line would not be equal due to the multiplicative nature of the sequence.

By understanding these two types of sequences, you build a foundation for advanced topics such as series, limits, and calculus applications. Focus on knowing the formula and how to apply it step by step.
