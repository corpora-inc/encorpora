\newpage
## Comparing and Contrasting Information from Multiple Graph Types

Graphs help us see information in different forms. In this lesson, we learn to compare two graph types: bar graphs and line plots. Each graph works best for different kinds of data.

### What Are Graphs?

A graph is a picture that shows numbers and facts in a clear way.
Some common graph types are:

- **Bar Graphs**: These show data with separate bars. They are good for comparing different groups at one moment in time.
- **Line Plots**: These connect points with lines. They are useful for showing changes over time.

Each graph organizes information in its own clear way.

### When to Use a Bar Graph

A bar graph is best when you have different groups or categories. For example, imagine you want to show how many apples, bananas, and oranges were sold at a fruit stand today.

\vspace*{2em}
\begin{center}
\begin{tikzpicture}
\begin{axis}[
    ybar,
    bar width=20pt,
    symbolic x coords={Apple,Banana,Orange},
    xtick=data,
    xlabel={Fruit Type},
    ylabel={Count},
    ymin=0,
    title={Fruits Sold Today},
    nodes near coords,
    nodes near coords align={vertical},
    enlarge x limits=0.25,
    label style={font=\large},
    title style={font=\Large\bfseries},
    tick label style={font=\large}
]
\addplot[fill=blue!50] coordinates {(Apple,15) (Banana,10) (Orange,12)};
\end{axis}
\end{tikzpicture}
\end{center}
\label{fig-fruits-sold-today}

In this graph, you can easily see which fruit sold the most.

### When to Use a Line Plot

A line plot is useful for showing a trend or change over time. For example, if you want to see how many students visited the school library each day during the week.

Let's look at a line plot that shows library visits from Monday to Friday.

\vspace*{2em}
\begin{center}
\begin{tikzpicture}
\begin{axis}[
    xlabel={Day of the Week},
    ylabel={Number of Visitors},
    xtick={1,2,3,4,5},
    xticklabels={Mon,Tue,Wed,Thu,Fri},
    xmin=0.5, xmax=5.5,
    ymin=0,
    title={Library Visitors Over a Week},
    label style={font=\large},
    title style={font=\Large\bfseries},
    tick label style={font=\large}
]
\addplot[smooth, mark=*, blue] coordinates {(1,20) (2,25) (3,30) (4,28) (5,35)};
\end{axis}
\end{tikzpicture}
\end{center}
\label{fig-library-visitors}

In this graph, you can see how the number of visitors changes each day. It shows a clear trend over time.

### Comparing the Two Graphs

- **Bar Graph**: Best for comparing different categories at one moment in time. It shows clear differences between groups.
- **Line Plot**: Best for tracking changes over time. It shows trends and patterns clearly.

When you compare graphs, look at these points:

1. Read the labels and title to know what is shown.
2. Notice how the graph displays data: bars for separate groups vs. points connected by lines for trends.
3. Choose the graph that fits your data best.

> A clear graph makes information easier to understand.

### Steps to Compare Graphs

1. Look at each graph carefully.
2. Check the labels on the axes.
3. Notice how the data is shown.
4. Decide which graph makes the information easiest to read.

This lesson shows that choosing the right graph helps tell the story of your data more clearly. Use bar graphs for clear category comparisons and line plots to see trends over time.