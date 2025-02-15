
## Developing Counting On and Counting Back Techniques for Mental Math

Counting on and counting back are strategies that help you solve math problems quickly in your head. In this lesson, we will learn how to add by counting on and subtract by counting back.

### Counting On

Counting on means starting at one number and counting forward to add another number. This method is useful when adding two numbers mentally.

For example, to calculate:

$$5 + 3$$

Follow these steps:

1. Start at $5$ on the number line.
2. Count forward three steps: $6$, $7$, $8$.
3. You have reached $8$, so $5 + 3 = 8$.

> Counting on helps us add numbers by moving forward one number at a time.

Below is a visual number line showing this idea:

\vspace*{2em}
\begin{center}
\begin{tikzpicture}
\draw[->] (0,0) -- (10,0) node[right] {Number Line};
\foreach \x in {0,...,10}
    \draw (\x,0.1) -- (\x,-0.1) node[below] {\x};

% Mark starting at 5 and ending at 8 with arrow
\draw[thick, red, ->] (5,0.5) -- (8,0.5);
\node at (6.5,1) {Count on by 3};
\end{tikzpicture}
\end{center}

*Figure 1: Using counting on to find $$5 + 3$$. (Label: fig-counting-on)*

### Counting Back

Counting back means starting at a number and moving backwards to subtract a smaller number. This method is useful when subtracting mentally.

For example, to calculate:

$$8 - 3$$

Follow these steps:

1. Start at $8$ on the number line.
2. Count backward three steps: $7$, $6$, $5$.
3. You have reached $5$, so $8 - 3 = 5$.

> Counting back helps us subtract numbers by moving one number at a time in reverse order.

Below is a visual number line showing this idea:

\vspace*{2em}
\begin{center}
\begin{tikzpicture}
\draw[->] (0,0) -- (10,0) node[right] {Number Line};
\foreach \x in {0,...,10}
    \draw (\x,0.1) -- (\x,-0.1) node[below] {\x};

% Mark starting at 8 and ending at 5 with arrow
\draw[thick, blue, ->] (8,0.5) -- (5,0.5);
\node at (6.5,1) {Count back by 3};
\end{tikzpicture}
\end{center}

*Figure 2: Using counting back to calculate $$8 - 3$$. (Label: fig-counting-back)*

### Step-by-Step Approach

1. Identify the starting number.
2. If you are adding, count up one number at a time.
3. If you are subtracting, count backward one number at a time.
4. Stop after you have counted the required amount.

> These methods can make solving addition and subtraction problems easier and faster.

### Real Life Applications

Counting on and counting back can be used when:

- Adding small groups of objects, like counting the total number of apples in two baskets.
- Subtracting items, like figuring out how many toys are left after giving some away.

By practicing these strategies, you can improve your mental math skills and become quicker at solving everyday problems.

\vspace*{2em}
\begin{center}
\begin{tikzpicture}
\begin{axis}[
    xlabel={Number Line}, ylabel={}, hide y axis,
    xmin=0, xmax=10,
    xtick={0,1,2,3,4,5,6,7,8,9,10},
    title={Counting On and Counting Back}
]
% Mark the starting point and movements for addition and subtraction
\addplot[only marks, mark=*, red] coordinates {(5,0)};
\node at (axis cs:5,0.5) {$5$};
\addplot[only marks, mark=*, red] coordinates {(8,0)};
\node at (axis cs:8,0.5) {$8$};
\addplot[only marks, mark=*, blue] coordinates {(8,0)};
\node at (axis cs:8,-0.5) {$8$};
\addplot[only marks, mark=*, blue] coordinates {(5,0)};
\node at (axis cs:5,-0.5) {$5$};
\end{axis}
\end{tikzpicture}
\end{center}

*Figure 3: Combined display of counting on from $5$ to $8$ and counting back from $8$ to $5$. (Label: fig-combined)*
