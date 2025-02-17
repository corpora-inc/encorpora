
## How to Create Picture Graphs with Real World Examples and Interpret Them

A picture graph uses simple symbols to show data. Each symbol stands for one or more items. This lesson explains how to create and read a picture graph step by step.

### What is a Picture Graph?

A picture graph is a chart that uses symbols instead of bars or lines. It makes data easy to understand by repeating a symbol for each count.

> A picture graph turns numbers into clear pictures.

### Steps to Create a Picture Graph

1. Collect the data you need to show.
2. Choose a symbol for each item. Decide if one symbol equals one item or several items.
3. Write the names of the categories on the left side.
4. Place the symbols next to each category to match the count.

### Real World Example: Favorite Pets

Suppose we ask classmates about their favorite pet. The data is:

- Dogs: 4
- Cats: 3
- Fish: 2

We will use a picture graph where:

• The letter D represents one dog,
• The letter C represents one cat, and
• The letter F represents one fish.

Follow these steps to make the graph:

1. Write the names of the pet categories on the left side.
2. Decide that one symbol equals one pet.
3. Place the symbols in a row next to each category according to the count.

### Creating the Picture Graph

Below is an example of a picture graph for our favorite pets:

\vspace*{2em}
\begin{center}
\begin{tikzpicture}[every node/.style={font=\large}, x=1.5cm, y=1.5cm]
    % Category Labels
    \node at (0,0) [anchor=east] {Dogs};
    \node at (0,-1) [anchor=east] {Cats};
    \node at (0,-2) [anchor=east] {Fish};

    % Dogs row: 4 symbols represented by D
    \node at (1,0) {D};
    \node at (2,0) {D};
    \node at (3,0) {D};
    \node at (4,0) {D};

    % Cats row: 3 symbols represented by C
    \node at (1,-1) {C};
    \node at (2,-1) {C};
    \node at (3,-1) {C};

    % Fish row: 2 symbols represented by F
    \node at (1,-2) {F};
    \node at (2,-2) {F};
\end{tikzpicture}
\end{center}

### Interpreting a Picture Graph

To read a picture graph:

- Look at the symbols in each row.
- Count the symbols next to each category.
- Compare the counts to understand the data.

In our example, counting the D symbols tells us there are 4 dogs. This makes the information clear and easy to understand.

By following these steps, you can create your own picture graphs to display data from everyday surveys or observations. The use of symbols helps turn numbers into clear pictures that are simple to see and compare.