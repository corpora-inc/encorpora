\newpage
## Strategies for Reading and Interpreting Picture Graphs Accurately

Picture graphs use simple pictures or symbols to show data. Each picture represents a certain number as given in the key. This lesson explains how to read these graphs step by step.

### Understanding Picture Graphs

In a picture graph:

- A picture or symbol stands for one or more items.
- A key tells you what each picture means.
- The graph has labels and a title to explain the data.

### Steps to Read a Picture Graph

1. Read the title to know what information is shown.

2. Look at the key. Note what each picture represents. For example, one picture may equal 2 items.

3. Count the pictures in each category.

4. Multiply the count by the value given in the key if each picture represents more than one item.

5. Compare the totals to understand the differences between categories.

> Always check the key before counting the pictures. It tells you exactly what each symbol means.

### Example of a Picture Graph

Suppose we have a picture graph showing the number of pets in a class. The key tells us that one picture (icon) equals 1 pet. The graph shows three categories: Dogs, Cats, and Birds.

Below is a bar graph that looks like a picture graph. In a real picture graph, the bars would be replaced by repeated icons. Here, each bar’s height represents the count of pictures.

\vspace*{2em}
\begin{center}
\begin{tikzpicture}
\begin{axis}[
    ybar,
    bar width=20pt,
    symbolic x coords={Dogs,Cats,Birds},
    xtick=data,
    xlabel={Pet Type},
    ylabel={Count},
    ymin=0,
    title={Class Pets Picture Graph},
    nodes near coords,
    nodes near coords align={vertical},
    enlarge x limits=0.25,
    label style={font=\large},
    title style={font=\Large\bfseries},
    tick label style={font=\large}
]
\addplot[fill=blue!50] coordinates {(Dogs,5) (Cats,3) (Birds,4)};
\end{axis}
\end{tikzpicture}
\end{center}

*Figure: Class Pets Picture Graph (Label: fig-pets-picture-graph)*

### How to Use the Picture Graph

- Look at the title: It shows that the graph is about class pets.

- Check the key: One picture equals 1 pet.

- Count the pictures (or look at the bar heights):

  - Dogs: 5 pictures mean 5 dogs.
  - Cats: 3 pictures mean 3 cats.
  - Birds: 4 pictures mean 4 birds.

- Use this information to compare which pet is most or least common.

Following these steps, you can accurately read and interpret picture graphs. They help make data clear and simple by turning numbers into pictures.