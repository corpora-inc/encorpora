
## How to Create and Read Bar Graphs to Compare Data Sets

Bar graphs are pictures made of rectangles. Each rectangle shows a number. This lesson explains how to make a bar graph and how to read one.

### What is a Bar Graph?

A bar graph shows information by using bars. Each bar represents a category or a group. The longer the bar, the bigger the number it shows.

### How to Create a Bar Graph

1. Identify the groups you want to compare. For example, types of fruit: Apple, Banana, and Orange.

2. Write the names of the groups on the horizontal line (x-axis).

3. Decide what number each bar will show. Write numbers on the vertical line (y-axis).

4. Draw a bar for each group. The height of each bar shows its number.

### How to Read a Bar Graph

1. Look at the names under each bar. They tell you what the bar is about.

2. Look at the height of the bar. Match the top of the bar with the numbers on the y-axis.

3. Compare the heights. A taller bar shows a larger number. A shorter bar shows a smaller number.

### Example: Favorite Fruit Count

Below is a bar graph showing how many students like each fruit.

\begin{figure}[ht]
\centering
\vspace*{2em}
\begin{tikzpicture}
\begin{axis}[
    ybar,
    bar width=20pt,
    symbolic x coords={Apple, Banana, Orange},
    xtick=data,
    xlabel={Fruit Type},
    ylabel={Count},
    ymin=0,
    title={Favorite Fruits Count},
    nodes near coords,
    nodes near coords align={vertical},
    enlarge x limits=0.25,
    label style={font=\large},
    title style={font=\Large\bfseries},
    tick label style={font=\large},
]
\addplot[fill=blue!50] coordinates {(Apple,8) (Banana,5) (Orange,7)};
\end{axis}
\end{tikzpicture}
\label{fig-bar-graph-fruits}
\end{figure}

### Step-by-Step Example

Imagine you want to compare the number of books read by three students: Sam, Alex, and Lee.

1. List the names: Sam, Alex, Lee on the x-axis.

2. Use the y-axis to show the number of books. For example, the numbers go from 0 to 10.

3. If Sam read 4 books, Alex read 6 books, and Lee read 3 books, you draw a bar for each student with that height.

4. Now you can see that Alex read the most books because his bar is the highest.

> A bar graph is a simple way to see differences between groups.

This is how you create and read bar graphs to compare data sets.
