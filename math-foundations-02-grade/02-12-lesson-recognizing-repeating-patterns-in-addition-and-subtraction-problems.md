## Recognizing Repeating Patterns in Addition and Subtraction Problems

Repeating patterns show us a rule that happens over and over. In these problems, the rule is to add or subtract the same number each time.

### What Is a Repeating Pattern?

A repeating pattern is a process that repeats in the same way. In addition and subtraction, it means adding or subtracting the same value every time.

> A pattern is simply a rule that tells us what comes next.

### Recognizing a Repeating Pattern in Addition

Consider this example:

$$
4 + 2 = 6
$$

Now, add 2 again to the result:

$$
6 + 2 = 8
$$

And one more time:

$$
8 + 2 = 10
$$

Each step adds 2. The pattern is: start with 4 and add 2 many times. This repeating action helps us know the next number.

### Visualizing the Addition Pattern

A number line can show the same idea. Look at the number line below for the addition example:

\vspace*{2em}
\begin{center}
\begin{tikzpicture}[x=0.7cm]
  % Draw a number line from 4 to 11
  \draw[->] (4,0) -- (11,0) node[right] {Number Line};
  \foreach \x in {4,5,6,7,8,9,10,11}
      \draw (\x,0.1) -- (\x,-0.1) node[below] {\x};
  % Mark jumps of +2 starting at 4
  \draw[red, thick, ->] (4,0.5) -- (6,0.5);
  \draw[red, thick, ->] (6,0.5) -- (8,0.5);
  \draw[red, thick, ->] (8,0.5) -- (10,0.5);
\end{tikzpicture}
\end{center}
\vspace*{2em}

Each red arrow shows that we add 2 to move forward.

### Recognizing a Repeating Pattern in Subtraction

Now, look at a subtraction example. Suppose we start with 15 and subtract 3 each time.

$$
15 - 3 = 12
$$

Subtract 3 again:

$$
12 - 3 = 9
$$

And one more time:

$$
9 - 3 = 6
$$

The rule is clear: start at 15 and subtract 3 every step. This is a repeating subtraction pattern.

### Visualizing the Subtraction Pattern

We can also use a number line to see subtraction. Imagine a number line where we move to the left by 3 each time.

\vspace*{2em}
\begin{center}
\begin{tikzpicture}[x=0.7cm]
  % Draw a number line from 5 to 16
  \draw[->] (5,0) -- (16,0) node[right] {Number Line};
  \foreach \x in {5,6,7,8,9,10,11,12,13,14,15,16}
      \draw (\x,0.1) -- (\x,-0.1) node[below] {\x};
  % Mark jumps of -3 starting at 15
  \draw[red, thick, <-] (15,0.5) -- (12,0.5);
  \draw[red, thick, <-] (12,0.5) -- (9,0.5);
  \draw[red, thick, <-] (9,0.5) -- (6,0.5);
\end{tikzpicture}
\end{center}
\vspace*{2em}

Each red arrow shows a jump backward by 3.

### Key Points

- A repeating pattern means doing the same addition or subtraction each time.

- In our addition example, we add 2 repeatedly.

- In our subtraction example, we subtract 3 repeatedly.

- Understanding the rule helps us predict what comes next in the pattern.

Recognizing these patterns makes solving math problems easier because you learn the rule and can use it to find missing numbers.