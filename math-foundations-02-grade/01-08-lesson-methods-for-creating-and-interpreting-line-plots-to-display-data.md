\newpage
## Methods for Creating and Interpreting Line Plots to Display Data

A line plot helps us show data on a number line. We use marks or dots at each value to show how many times that value appears. This lesson will explain how to create a line plot and how to read it.

### Creating a Line Plot

1. Gather your data. For example, count how many pets each classmate has.

2. Draw a horizontal line. Mark equal spaces along the line for possible data values (for example, 0, 1, 2, 3, 4, and 5).

3. For each data value, place a mark above that number. Each mark represents one count from your data.

4. Do not connect the marks with a line because each mark is separate. The marks show the frequency of each value.

### Example: Counting Pets

Imagine these are the number of pets in our class: 

Data: 1, 2, 2, 3, 1, 0, 2, 3, 1, 2

To create a line plot:

- The number 0 has one mark.
- The number 1 has three marks.
- The number 2 has four marks.
- The number 3 has two marks.
- The numbers 4 and 5 have no marks.

A simple diagram of this line plot looks like the number line below.

\vspace*{2em}
\begin{center}
\begin{tikzpicture}
\begin{axis}[
    xmode=linear,
    xmin=-0.5, xmax=5.5,
    ymin=-0.5, ymax=5.5,
    xtick={0,1,2,3,4,5},
    ytick={0,1,2,3,4,5},
    xlabel={Number of Pets},
    ylabel={Frequency},
    title={Line Plot: Class Pet Count},
    grid=both,
    width=10cm
]

% Data points: (value, frequency)
\addplot[only marks, mark=*, mark size=3, blue] coordinates {
    (0,1)
    (1,3)
    (2,4)
    (3,2)
};

\end{axis}
\end{tikzpicture}
\end{center}

### Interpreting a Line Plot

1. Look at each mark over the number line. Each mark tells you how many times that value appears in your data.

2. Find which number has the most marks. This is the most common data value.

3. Use the plot to see differences between values. For example, you can compare the number of pets classmates have.

> A line plot shows data in a clear and organized way so that we can easily see patterns and differences.

By following these steps, you can both create and understand line plots. They are useful when you need to see how often each number appears in a set of data.