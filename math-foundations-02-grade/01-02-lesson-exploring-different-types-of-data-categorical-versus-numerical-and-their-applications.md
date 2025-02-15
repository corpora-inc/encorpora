\newpage
## Exploring Different Types of Data: Categorical vs Numerical

Data comes in different types. In this lesson, we learn about two main types: categorical data and numerical data.

### What is Data?

Data is information. It can be written as words or numbers. Understanding data helps us learn more about the world.

### Categorical Data

Categorical data contains names or labels. It does not use numbers for calculation. Examples include colors, types of pets, or names of fruits.

> Categorical data groups items by characteristics.

For example, consider a list of favorite fruits: Apple, Banana, and Orange. This list shows names of fruits, not numbers.

### Numerical Data

Numerical data uses numbers. We can do math with these numbers. Examples include age, height, or the number of items in a group.

> Numerical data tells us how many, how much, or how long.

For instance, the ages of students (7, 8, 9) are numerical data.

### Visual Example of Categorical Data

Below is a bar graph that shows a count of favorite fruits. The fruits are the categories and the count is numerical.

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
\label{fig-bar-favorite-fruits-count}
\end{figure}



### Summary

- **Categorical Data**: Data that names groups or categories (e.g., fruit types).
- **Numerical Data**: Data that uses numbers to show amounts or measurements (e.g., age, count).

Use these ideas to look at everyday information. Identify if the data is categorical or numerical by checking if it uses words or numbers.
