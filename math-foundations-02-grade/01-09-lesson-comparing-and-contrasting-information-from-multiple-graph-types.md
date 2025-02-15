\newpage
## Comparing and Contrasting Information from Multiple Graph Types

Graphs help us see information in different ways. In this lesson, we will learn how to compare and contrast data from different graph types. We will look at what each graph shows and why it might be a good choice for the data.

### What Are Graphs?

A graph is a picture that shows numbers and facts. Some common graphs are:

- **Bar Graphs**: These show data with bars. They are good for comparing items.
- **Line Plots**: These use points connected by lines. They show changes over time.
- **Picture Graphs**: These use pictures or icons to represent data.

Each graph type organizes data in its own clear way.

### How to Compare Graphs

Compare graphs by looking at these points:

1. **Data Accuracy**: Check if the graph shows the correct numbers.
2. **Clarity**: See if the graph is easy to read. Look at labels and colors.
3. **Best Use**: Decide which graph is best for the type of data you have.

> A clear graph makes data easier to understand.

### Example: Class Favorite Fruits

Imagine you have data about favorite fruits in your class. You can show the data with different graphs.

#### 1. Bar Graph

A bar graph shows each fruit with a bar whose height shows the count.

\vspace*{2em}
\begin{center}
\begin{tikzpicture}
\begin{axis}[
    ybar,
    bar width=20pt,
    symbolic x coords={Apple,Banana,Orange},
    xtick=data,
    xlabel={Fruit},
    ylabel={Count},
    ymin=0,
    title={Class Favorite Fruits},
    nodes near coords,
    nodes near coords align={vertical},
    enlarge x limits=0.25,
    label style={font=\large},
    title style={font=\Large\bfseries},
    tick label style={font=\large}
]
\addplot[fill=blue!50] coordinates {(Apple,8) (Banana,5) (Orange,7)};
\end{axis}
\end{tikzpicture}
\end{center}

This bar graph makes it clear which fruit has the highest count.

#### 2. Line Plot

A line plot can show the same data if you want to see a trend. In this case, each fruit can be a point on the line.

\vspace*{2em}
\begin{center}
\begin{tikzpicture}
\begin{axis}[
    xlabel={Fruit (ordered by count)},
    ylabel={Count},
    title={Fruit Count Trend},
    xtick={1,2,3},
    xticklabels={Apple,Banana,Orange},
    ymin=0,
    label style={font=\large},
    title style={font=\Large\bfseries},
    tick label style={font=\large}
]
\addplot[smooth, mark=*, blue] coordinates {(1,8) (2,5) (3,7)};
\end{axis}
\end{tikzpicture}
\end{center}

The line plot connects points. It is good for showing trends but may not show exact counts as clearly as the bar graph.

### Comparing the Two Graphs

- **Bar Graph**: Each fruit is shown with a separate bar. It is easy to see which fruit is the most or least favorite.
- **Line Plot**: The points form a line. This shows a trend, but the exact number might be less obvious.

When you compare graphs, ask:

- Which graph makes the differences easier to see?
- Which graph helps you understand the change or trend?

### Steps to Compare Graphs

1. Look at both graphs carefully.
2. Check the labels on the axes.
3. Note how each data point is shown.
4. Decide which graph shows the information more clearly.

> Comparing graphs helps you choose the best way to show your data.

This lesson shows that different graph types can tell the same story in different ways. Use the graph type that makes the data easiest to understand.
