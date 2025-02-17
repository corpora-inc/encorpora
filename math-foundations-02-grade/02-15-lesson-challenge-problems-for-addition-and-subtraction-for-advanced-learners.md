## Challenge Problems for Addition and Subtraction for Advanced Learners

### Addition with Carrying

We solve an addition problem where we must carry a number to the next column.

Consider the problem:

$$
\begin{array}{r}
 47 \\
+38 \\
\hline
\end{array}
$$

Step 1: Add the ones column. 

7 + 8 = 15. Write down 5 and carry 1 to the tens column.

Step 2: Add the tens column.

4 + 3 = 7. Now add the carried 1 to get 8.

Thus, the final sum is 85.

The complete process looks like this:

$$
\begin{array}{r@{}r@{}r}
   1 &   &    \\
   4 & 7 &    \\
+  3 & 8 &    \\
\hline
     & 8 & 5 \\
\end{array}
$$

A number line can also help us see addition. For example, for the problem 14 + 4:

\vspace*{2em}
\begin{center}
\begin{tikzpicture}[x=0.5cm]
  \draw[->] (11,0) -- (21,0) node[right] {Number Line};
  \foreach \x in {11,13,15,17,19,21}
    \draw (\x,0.1) -- (\x,-0.1) node[below] {\x};
  \draw[thick, red, ->] (14,0.2) -- (18,0.2);
  \node at (16,0.6) {$+4$};
\end{tikzpicture}
\end{center}
\vspace*{2em}

### Subtraction with Borrowing

Now we solve a subtraction problem that requires borrowing.

Consider the problem:

$$
\begin{array}{r@{\hspace{1mm}}r}
  5 & 3 \\
-\,2 & 9 \\
\hline
\end{array}
$$

Step 1: Look at the ones column.

Since 3 is less than 9, we cannot subtract 9 from 3 directly. We must borrow 1 from the tens column.

Step 2: Borrowing changes the numbers.

The tens digit 5 becomes 4. The ones digit 3 becomes 13 after borrowing.

Now, subtract the ones column:

13 - 9 = 4.

Step 3: Subtract the tens column:

4 - 2 = 2.

Thus, the final answer is 24.

The complete process is shown here:

$$
\begin{array}{r@{\hspace{1mm}}r}
  4 & 13 \\
-\,2 &  9 \\
\hline
  2 & 4 \\
\end{array}
$$

A number line can also help with subtraction. For example, consider 24 - 9. The number line can illustrate the step-by-step subtraction.

\vspace*{2em}
\begin{center}
\begin{tikzpicture}[x=0.5cm]
  \draw[->] (10,0) -- (20,0) node[right] {Number Line};
  \foreach \x in {10,12,14,16,18,20}
    \draw (\x,0.1) -- (\x,-0.1) node[below] {\x};
  \draw[thick, red, <-] (15,0.2) -- (12,0.2);
  \node at (13.5,0.6) {$-9$};
\end{tikzpicture}
\end{center}
\vspace*{2em}

### Challenge Problems Overview

These challenges use advanced techniques in addition and subtraction. Focus on aligning numbers in columns and processing carrying and borrowing step by step.

> Always check your work by reviewing each column's calculation.

By following these steps, advanced learners can confidently work through more difficult addition and subtraction problems with precision.