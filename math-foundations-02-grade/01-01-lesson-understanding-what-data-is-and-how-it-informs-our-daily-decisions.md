
## Understanding What Data Is and How It Informs Our Daily Decisions

### What Is Data?

Data is information that we collect. It can be numbers, words, or facts. For example, a list of temperatures or scores in a game are pieces of data.

### Why Is Data Important?

Data helps us see patterns and make choices. When you know the numbers, you can decide what to do next. For example, knowing the weather helps you choose what to wear.

### How We Use Data

There are clear steps to use data:

1. Collect the data. This could be by counting, measuring, or asking questions.
2. Organize the data into a table or list.
3. Create a graph to show the data in pictures.
4. Look at the graph or table to decide what comes next.

### Organizing Data in a Table

A table arranges data neatly in rows and columns. For example:

| Day       | Temperature (°F) |
|-----------|------------------|
| Monday    | 70               |
| Tuesday   | 72               |
| Wednesday | 68               |

---

### Displaying Data as a Graph

A graph helps us see changes quickly. For example, a line graph of temperature might look like this:

\vspace*{2em}
\begin{center}
\begin{tikzpicture}
\begin{axis}[
    xlabel={Day},
    ylabel={Temperature (°F)},
    symbolic x coords={Monday, Tuesday, Wednesday},
    xtick=data,
    title={Temperature Over Three Days}
]
\addplot coordinates {(Monday,70) (Tuesday,72) (Wednesday,68)};
\end{axis}
\end{tikzpicture}
\end{center}
\vspace*{2em}

### How Data Guides Decisions

When we see organized information like a table or graph, we can make choices. For example:

- Data about sunny and rainy days helps us decide if we need an umbrella.
- Data about how many fruits we eat helps us know if we are eating healthy.

> "In God we trust; all others must bring data." — W. Edwards Deming

---

### Example: Choosing an Outfit

Imagine you have a list of temperatures in the morning:

| Time      | Temperature (°F) |
|-----------|------------------|
| Morning 1 | 60               |
| Morning 2 | 67               |
| Morning 3 | 63               |
| Morning 4 | 70               |

You can use this simple rule:

$$
\text{If temperature} < 65 \text{, wear a jacket.}
$$
$$
\text{If temperature} \ge 65 \text{, no jacket is needed.}
$$

This rule is a simple way to use data to decide how to dress.

### Summary of Decisions

Below is a table summarizing the decisions based on temperature:

| Time                     | Decision           |
|--------------------------|--------------------|
| Morning 1 (60)           | Wear a jacket      |
| Morning 2 (67)           | No jacket needed   |
| Morning 3 (63)           | Wear a jacket      |
| Morning 4 (70)           | No jacket needed   |

---
