## Defining Functions and Function Notation

A function is a rule that assigns each input exactly one output. In algebra, functions provide a systematic way to relate two quantities where one depends on the other.

### What Is a Function?

A function associates every element in a set (called the domain) with one unique element in another set (called the range). When you input a value into a function, you get exactly one corresponding output.

### Function Notation

Function notation uses a letter, typically $f$, followed by parentheses. The expression inside the parentheses represents the input value. For example, if we write

$$
f(x) = 2x + 3,
$$

then $f(x)$ indicates the output when $x$ is used as input. Here:

- $f$ is the name of the function.
- $x$ is the variable representing the input.

### Evaluating a Function

To evaluate a function, substitute a specific number for the variable and simplify. For instance, using the function

$$
f(x) = 2x + 3,
$$

evaluate $f(4)$ as follows:

1. Replace $x$ with 4:

   $$
f(4) = 2(4) + 3.
   $$

2. Multiply $2$ by $4$ to get 8:

   $$
f(4) = 8 + 3.
   $$

3. Add 8 and 3:

   $$
f(4) = 11.
   $$

Thus, $f(4) = 11$.

### Real-World Application

Functions are useful in many real-world scenarios. Consider a simple cost function for producing items:

$$
C(x) = 50 + 10x,
$$

where:

- $C(x)$ represents the total cost,
- $50$ is the fixed cost (the cost that does not change with production), and
- $10x$ is the variable cost (the cost that changes with the number of units produced, $x$).

If a company produces 7 units, the total cost is computed as:

$$
C(7) = 50 + 10(7) = 50 + 70 = 120.
$$

This model helps businesses predict costs based on production levels.

### Key Vocabulary

- **Domain:** The set of all possible input values for the function.
- **Range:** The set of all possible output values for the function.
- **Function Notation:** A symbolic representation that shows the relationship between inputs and outputs, such as $f(x)$.

Understanding functions and their notation is fundamental to solving equations, modeling real-life situations, and preparing for advanced topics in algebra.

### Visual Example

Below is a number line diagram to illustrate evaluating a function with a linear rule. Consider the function $f(x)=2x+3$ and focus on the input $x=4$.

\vspace*{2em}
\begin{center}
\begin{tikzpicture}[x=0.5cm]
  % Draw a number line from 0 to 12
  \draw[->] (0,0) -- (12,0) node[right] {Number Line};
  % Place ticks every 1 unit
  \foreach \x in {0,1,...,12}
      \draw (\x,0.1) -- (\x,-0.1) node[below] {\x};
  % Mark the input value x=4 and its corresponding output f(4)=11
  \draw[thick, blue, ->] (4,0.5) -- (11,0.5);
  \node at (7.5,1) {$f(4)=11$};
\end{tikzpicture}
\end{center}
\vspace*{2em}

This visual connects the input value of 4 with the output value of 11, reinforcing the idea that each input is paired with one unique output.
