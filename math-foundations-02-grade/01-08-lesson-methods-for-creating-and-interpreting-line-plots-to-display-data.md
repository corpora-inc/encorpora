
## Methods for Creating and Interpreting Line Plots to Display Data

A line plot is a graph that shows a trend or change over time by connecting data points with a line. This type of plot is useful for tracking how things change, such as the price of eggs over a week.

### Creating a Line Plot

1. Collect your data. For example, record the price of eggs each day for a week.

2. Draw horizontal and vertical axes. The horizontal axis (x-axis) represents time (days) and the vertical axis (y-axis) represents the price.

3. Mark the data points on the graph. Each point represents the price on a certain day.

4. Connect the points with a line to show the trend.

### Example: Egg Prices Over a Week

Suppose you recorded the price of eggs over 7 days as follows:

- Day 1: $2.00
- Day 2: $2.20
- Day 3: $2.15
- Day 4: $2.30
- Day 5: $2.50
- Day 6: $2.45
- Day 7: $2.60

To create the line plot:

- Plot each day on the x-axis and the corresponding price on the y-axis.
- Connect the points with a line to show the rising and falling trend in the price.

Below is an example that shows the line plot for the egg prices:

\vspace*{2em}
\begin{center}
\begin{tikzpicture}
\begin{axis}[
    xlabel={Day},
    ylabel={Price of Eggs (\$)},
    title={Egg Price Over a Week},
    xtick={1,2,3,4,5,6,7},
    xmin=0.5, xmax=7.5,
    ymin=1.8, ymax=2.8,
    grid=both,
    width=10cm,
]
\addplot[mark=*, blue, thick] coordinates {
    (1,2.00) (2,2.20) (3,2.15) (4,2.30) (5,2.50) (6,2.45) (7,2.60)
};
\end{axis}
\end{tikzpicture}
\end{center}

*Figure: Line plot showing the change in egg prices over one week.*

### Interpreting a Line Plot

1. Look at the connected line to see if the price is going up or down over time.

2. Identify peaks and valleys. The highest point shows the highest price and the lowest shows the lowest price.

3. Use the trend to understand how the price changes. For example, you can tell if the price slowly increases or if there are any dips mid-week.

> A line plot helps us see trends over time by connecting data points in order.

By following these steps, you can create and understand line plots that show changes over time. Use line plots to track trends in data, such as changes in prices, temperatures, or any other measurements over a period.