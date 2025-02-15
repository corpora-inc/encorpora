\newpage
## How to Create Picture Graphs with Real World Examples and Interpret Them

A picture graph uses images or symbols to show data. Each picture represents one or more items. This lesson explains how to create and read a picture graph step by step.

### What is a Picture Graph?

A picture graph is a chart that uses pictures instead of bars or lines. It makes data easy to understand by showing symbols for each count.

> A picture graph turns numbers into images.

### Steps to Create a Picture Graph

1. Collect the data you need to show.

2. Choose a picture or symbol for one item. Decide if one picture equals one item or several items.

3. Draw a horizontal line for categories. Label each category clearly.

4. Place the picture symbols above each category to match the data count.

### Real World Example: Favorite Pets

Suppose we ask classmates about their favorite pet. The data is:

- Dogs: 4
- Cats: 3
- Fish: 2

We will use a picture graph where 
• a dog face (🐶) represents a dog, 
• a cat face (🐱) represents a cat, and 
• a fish face (🐠) represents a fish.

Follow these steps to make the graph:

1. Write the names of the pet categories on the left side.

2. Decide that one symbol equals one pet.

3. Place the symbols in a row for each category.

### Creating the Picture Graph with TikZ

Below is a TikZ example that shows how to create a picture graph for our favorite pets:

\vspace*{2em}
\begin{center}
\begin{tikzpicture}[x=1cm, y=1cm]

% Category Labels
\node[anchor=east] at (-0.5,3) {Dogs};
\node[anchor=east] at (-0.5,2) {Cats};
\node[anchor=east] at (-0.5,1) {Fish};

% Dogs row: 4 dog symbols
\node at (0,3) {🐶};
\node at (1,3) {🐶};
\node at (2,3) {🐶};
\node at (3,3) {🐶};

% Cats row: 3 cat symbols
\node at (0,2) {🐱};
\node at (1,2) {🐱};
\node at (2,2) {🐱};

% Fish row: 2 fish symbols
\node at (0,1) {🐠};
\node at (1,1) {🐠};

% Draw a vertical arrow for count
\draw[->] (-1.5,0.5) -- (-1.5,4) node[above,rotate=90]{Count};
\end{tikzpicture}
\end{center}

*Figure: Favorite Pets Picture Graph (Label: fig-pet-picture-graph)*

### Interpreting a Picture Graph

To read a picture graph:

- Look at the picture symbols.
- Count the symbols in each row.
- Compare the counts to understand the data.

In our example, counting the dog symbols tells us there are 4 dogs. This makes the information clear and quick to understand.

By following these steps, you can create your own picture graphs to display data from everyday surveys or observations. The use of pictures helps make numbers easier to see and compare.