
## Understanding Subtraction through the Unknown Addend Approach

Subtraction can sometimes be easier to understand when we think about it as finding a missing addend. In other words, instead of thinking only about taking away, we can ask: "What must be added to this number to reach another number?"

When we have a subtraction problem like

$$a - b = c,$$

we can see it as an addition problem:

$$b + c = a.$$ 

This idea is called the unknown addend approach because we are finding the unknown number that, when added to the subtrahend, gives the minuend.

> Subtraction is the reverse of addition.

### Step-by-Step Process

1. **Identify the parts**: 
   - The first number is called the minuend ($a$).
   - The second number is the subtrahend ($b$).
   - The result (or difference) is $c$.

2. **Reframe the subtraction as an addition**: 
   Rewrite the subtraction equation $$a - b = c$$ as an addition equation:
   
   $$b + c = a.$$ 

3. **Solve by finding the unknown number**: 
   Determine the number that, when added to $b$, equals $a$.

### Example 1: Solving 10 - 3 = ?

Let's use the unknown addend approach for the problem:

$$10 - 3 = ?$$

Here, $a = 10$ and $b = 3$. We ask: What number must be added to 3 to get 10?

Write the addition equation:

$$3 + ? = 10.$$ 

Subtract 3 from 10 to find the missing number:

$$ ? = 10 - 3 = 7.$$ 

Thus, 10 - 3 = 7.

Below is a number line that shows this process:

\vspace*{2em}
\begin{figure}[ht]
\centering
\begin{tikzpicture}
\draw[->] (0,0) -- (12,0) node[right] {Number Line};
\foreach \x in {0,...,12}
    \draw (\x,0.1) -- (\x,-0.1) node[below] {\x};
\draw[thick, red, ->] (3,0) -- (10,0);
\node at (6.5,0.5) {+7};
\end{tikzpicture}
\caption{Number line showing the unknown addend approach for 10 - 3 = 7}
\label{fig:unknown-addend-numberline1}
\end{figure}

### Example 2: Finding the Missing Number

Consider the subtraction problem with a missing number:

$$15 - ? = 9.$$ 

In this case, we need to find the number that was subtracted from 15 to give 9. Using the unknown addend method, we ask: What number must be added to 9 to get 15?

Write the addition equation:

$$9 + ? = 15.$$ 

Subtract 9 from 15:

$$ ? = 15 - 9 = 6.$$ 

So, the missing number is 6. This shows that 15 - 6 = 9.

The following diagram illustrates this process on a number line:

\vspace*{2em}
\begin{figure}[ht]
\centering
\begin{tikzpicture}
\draw[->] (0,0) -- (16,0) node[right] {Number Line};
\foreach \x in {0,...,16}
    \draw (\x,0.1) -- (\x,-0.1) node[below] {\x};
\draw[thick, blue, ->] (9,0) -- (15,0);
\node at (12,0.5) {+6};
\end{tikzpicture}
\caption{Number line showing the unknown addend approach for 15 - 6 = 9}
\label{fig:unknown-addend-numberline2}
\end{figure}

### Summary of the Process

Using the unknown addend approach involves these clear steps:

- Rewrite the subtraction problem as an addition problem.
- Identify the known numbers and the unknown addend.
- Solve the addition problem to find the missing number.

This method helps to see subtraction as the reverse of addition and makes problems easier to understand.
