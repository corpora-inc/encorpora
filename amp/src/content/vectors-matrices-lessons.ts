import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

export const vectorMatrixMethods: Record<string, ProblemMethod> = {
  "vector-components": {
    goal: "Given two points, a drawn arrow, or component pairs, find components, a magnitude, or a sum, difference or scalar multiple.",
    intuition:
      "A vector is an arrow with a length and a direction. Its components $\\langle a,b\\rangle$ say how far it moves across ($a$) and up ($b$) from its tail to its tip. Right and up are positive, left and down are negative. Two arrows with the same components are the same vector, wherever they are drawn. The length of the arrow is called its magnitude.",
    terms: [
      [
        "vector",
        "The initial point is the tail of the arrow. The terminal point is its tip.",
      ],
      "component",
      "magnitude",
      "scalar",
    ],
    method: [
      "For two points, subtract tail from tip: terminal coordinates minus initial coordinates, $x$ first.",
      "For a magnitude, square both components, add, and take the square root, as in the Pythagorean theorem.",
      "For sums, differences and scalar multiples, work on matching components: $\\langle a,b\\rangle+\\langle c,d\\rangle=\\langle a+c,b+d\\rangle$ and $k\\langle a,b\\rangle=\\langle ka,kb\\rangle$.",
    ],
    watch:
      "Subtract terminal minus initial. The other order gives the arrow pointing back. A scalar multiplies both components, and a magnitude is never negative.",
  },
  "vector-resultant": {
    goal: "Two perpendicular velocities or forces act together. Find the size or direction of the combined vector, or a missing part.",
    intuition:
      "A velocity (a speed in a direction) and a force (a push or pull) each have a size and a direction, so each is a vector. Two vectors acting together have the same effect as their sum, called the resultant. When the two meet at a right angle, they are the legs of a right triangle, the two that form the right angle. The resultant is its hypotenuse, the one across from the right angle.",
    terms: ["resultant", "inverse-trig-function"],
    noLink: ["part"],
    method: [
      "Draw the two perpendicular vectors as the legs of a right triangle. The resultant is the hypotenuse.",
      "Magnitude: $\\sqrt{a^2+b^2}$. A missing leg, when the hypotenuse $h$ and one leg $a$ are known: $\\sqrt{h^2-a^2}$.",
      "Direction: $\\tan\\theta=\\dfrac{\\text{opposite leg}}{\\text{adjacent leg}}$, so $\\theta=\\arctan(\\text{opposite}/\\text{adjacent})$. Round only at the end, as the question states.",
    ],
    watch:
      "The sizes of perpendicular vectors do not simply add: the resultant is shorter than the two legs together. Decide which leg is opposite the angle you are asked for. The other choice gives the complementary angle, $90^\\circ$ minus the right answer.",
  },
  "matrix-data-reading": {
    goal: "Read an entry, a row total or a column total from a matrix of data, or name its dimensions.",
    intuition:
      "A matrix is a rectangular grid of numbers, like a table without labels. Each row (going across) and each column (going down) has a meaning, such as a store and an item. So each number belongs to exactly one row and one column, and it means one store's amount of one item.",
    terms: [
      [
        "matrix",
        "Each number in it is an entry. $a_{ij}$ is in row $i$ and column $j$.",
      ],
      [
        "matrix",
        "Its dimensions $m\\times n$ mean $m$ rows and $n$ columns, rows first.",
      ],
    ],
    method: [
      "Find the row and the column the question names, then read the entry where they cross.",
      "For one store's total over all items, add across its row. For one item's total over all stores, add down its column.",
      "State dimensions as rows $\\times$ columns.",
    ],
    watch:
      "The first small number below the letter is the row and the second is the column. Reversing two different numbers names a different position. Keep rows and columns straight when naming dimensions.",
  },
  "matrix-operations": {
    goal: "Add, scale or multiply small matrices, or decide from their dimensions whether a product exists.",
    intuition:
      "A matrix is a grid of numbers in rows and columns. Two matrices of the same size add by adding the numbers in matching positions. A scalar, an ordinary number, multiplies every number in a matrix. A product of two matrices works differently: it pairs a row of the first matrix with a column of the second, multiplies matching numbers and adds the results.",
    terms: ["scalar", "matrix-product"],
    method: [
      "Sums and differences need equal dimensions. Combine matching entries, and do any scalar multiple first.",
      "For a product, compare the number of columns of the left matrix with the number of rows of the right matrix. They must be equal. The result has the rows of the left and the columns of the right.",
      "Each entry is a sum of products: go across the row and down the column together.",
    ],
    watch:
      "Do not just multiply matching entries for a product. Each entry of $AB$ adds the products of a whole row with a whole column. Order matters: $AB$ and $BA$ can have different dimensions.",
  },
  "matrix-laws": {
    goal: "Compare $AB$ and $BA$, recognize the identity matrix, or choose which matrix laws always hold.",
    intuition:
      "Matrix multiplication keeps most of the rules of ordinary multiplication, but not the order rule. For numbers $3\\cdot5=5\\cdot3$, but swapping two matrices changes which rows meet which columns. So the product usually changes. The identity matrix $I$, with ones on the diagonal from top left to bottom right and zeros elsewhere, leaves a matrix unchanged, like multiplying by 1.",
    terms: [
      "identity-matrix",
      ["commute", "For matrices, $AB=BA$. Some pairs commute; most do not."],
    ],
    noLink: ["leaves"],
    method: [
      "To test whether two matrices commute, compute both $AB$ and $BA$ and compare entry by entry. One differing entry is enough to show $AB\\ne BA$.",
      "Laws that always hold: $(AB)C=A(BC)$, $A(B+C)=AB+AC$, $(A+B)C=AC+BC$, and $IA=AI=A$.",
      "A rule that swaps the order of two matrices, or cancels a matrix, needs a check. One example where it fails, called a counterexample, shows it does not always hold.",
    ],
    watch:
      "Do not swap the order. $(A+B)^2$ multiplies out to $A^2+AB+BA+B^2$, which is not $A^2+2AB+B^2$ unless $AB=BA$.",
  },
  "matrix-inverse-determinant": {
    goal: "Find a $2\\times2$ determinant, decide whether an inverse exists, or compute the inverse.",
    intuition:
      "Two matrices multiply row by column: each entry of the product pairs a row of the first with a column of the second, multiplies matching numbers and adds. The inverse of a matrix undoes it, as dividing undoes multiplying: the matrix times its inverse is the identity matrix $I$. For a $2\\times2$ matrix $\\begin{bmatrix}a&b\\\\c&d\\end{bmatrix}$, the number $ad-bc$ is called its determinant. The matrix has an inverse exactly when its determinant is not 0.",
    terms: ["determinant", "inverse-matrix"],
    method: [
      "Compute $\\det A=ad-bc$. If it is 0, there is no inverse.",
      "Otherwise swap $a$ and $d$, change the signs of $b$ and $c$, and divide every entry by $\\det A$.",
      "Check that $AA^{-1}=I$.",
    ],
    watch:
      "Subtract in the determinant: $ad-bc$. Swap only $a$ and $d$, the entries on the diagonal from top left to bottom right, and change signs only on the other two. Keep fractions exact.",
  },
  "matrix-transformation": {
    goal: "Apply a $2\\times2$ matrix to a point, match a matrix with a rotation, reflection or dilation, or find an area after a transformation.",
    intuition:
      "A $2\\times2$ matrix sends every point of the plane, the flat surface of all points $(x,y)$, to a point. The origin $(0,0)$ always stays where it is. Write the point $(x,y)$ as a column and multiply: the matrix sends it to a new point, called its image. The first column of the matrix is where $(1,0)$ goes, and the second column is where $(0,1)$ goes. Those two images tell you what the matrix does to every point.",
    terms: ["image-transformation", "determinant"],
    method: [
      "To apply a matrix, multiply it by the column $\\begin{bmatrix}x\\\\y\\end{bmatrix}$: each row of the matrix gives one new coordinate.",
      "To identify a transformation, find the images of $(1,0)$ and $(0,1)$. They are the columns.",
      "Areas are multiplied by $|\\det M|$, the size of the determinant without its sign. A determinant of 0 flattens the figure.",
    ],
    watch:
      "Use each row of the matrix with the column, not each column. The area factor is the absolute value of the determinant, and it multiplies the area once.",
  },
  "matrix-linear-system": {
    goal: "Write a $2\\times2$ system as $AX=B$, solve it with $A^{-1}$, or tell when no inverse exists.",
    intuition:
      "A system of two linear equations, such as $2x+y=7$ and $x+3y=11$, can be written as one matrix equation $AX=B$. A matrix is a grid of numbers. $A$ holds the numbers in front of $x$ and $y$, one equation per row. $X$ is the column of unknowns, and $B$ holds the right sides. Each row of $A$ times $X$, first entry times $x$ plus second entry times $y$, gives one left side. If $A$ has an inverse, multiplying both sides by $A^{-1}$ on the left leaves $X$ alone: $X=A^{-1}B$.",
    terms: [
      [
        "matrix",
        "The coefficient matrix $A$ holds the coefficients of $x$ and $y$, one equation per row.",
      ],
      [
        "matrix",
        "The constant matrix $B$ holds the numbers on the right sides, in the same order as the equations.",
      ],
    ],
    noLink: ["leaves"],
    method: [
      "Write each equation as $ax+by=e$ with $x$ first. The rows of $A$ are $(a,b)$, and $B$ is the column of $e$ values.",
      "Compute $\\det A$. If it is 0, there is no inverse and no single solution.",
      "Otherwise find $A^{-1}$ and multiply on the left: $X=A^{-1}B$. Read $x$ and $y$ from the column.",
    ],
    watch:
      "Move constants to the right side with their signs changed, keep the equations in order, and multiply in the order $A^{-1}B$, with the inverse on the left.",
  },
};

export const vectorMatrixPrinciples: Record<string, string> = {
  "vector-components":
    "For points $P(x_1,y_1)$ and $Q(x_2,y_2)$, $\\overrightarrow{PQ}=\\langle x_2-x_1,y_2-y_1\\rangle$. The magnitude is $|\\langle a,b\\rangle|=\\sqrt{a^2+b^2}$. Vectors add and scale by components: $\\langle a,b\\rangle+\\langle c,d\\rangle=\\langle a+c,b+d\\rangle$ and $k\\langle a,b\\rangle=\\langle ka,kb\\rangle$, with $|k\\mathbf{v}|=|k||\\mathbf{v}|$.",
  "vector-resultant":
    "If vectors of magnitudes $a$ and $b$ are perpendicular, their sum has magnitude $\\sqrt{a^2+b^2}$. For $a>0$, it makes the angle $\\theta=\\arctan(b/a)$ with the vector of magnitude $a$.",
  "matrix-data-reading":
    "An $m\\times n$ matrix has $m$ rows and $n$ columns. The entry $a_{ij}$ is in row $i$ and column $j$. The sum of row $i$ is $\\sum_j a_{ij}$ and the sum of column $j$ is $\\sum_i a_{ij}$.",
  "matrix-operations":
    "Matrices of equal dimensions add entry by entry, and $kA$ multiplies every entry by $k$. If $A$ is $m\\times n$ and $B$ is $n\\times p$, then $AB$ is $m\\times p$ with $(AB)_{ij}=\\sum_{k=1}^{n}a_{ik}b_{kj}$. If the number of columns of $A$ is not the number of rows of $B$, $AB$ is not defined.",
  "matrix-laws":
    "For matrices whose products and sums are defined: $(AB)C=A(BC)$, $A(B+C)=AB+AC$, $(A+B)C=AC+BC$, and $AI=IA=A$. Multiplication is not commutative: $AB\\ne BA$ for some pairs.",
  "matrix-inverse-determinant":
    "For $A=\\begin{bmatrix}a&b\\\\c&d\\end{bmatrix}$, $\\det A=ad-bc$. $A$ has an inverse exactly when $\\det A\\ne0$, and then $A^{-1}=\\dfrac{1}{ad-bc}\\begin{bmatrix}d&-b\\\\-c&a\\end{bmatrix}$.",
  "matrix-transformation":
    "The matrix $M$ sends $\\begin{bmatrix}x\\\\y\\end{bmatrix}$ to $M\\begin{bmatrix}x\\\\y\\end{bmatrix}$. Its columns are the images of $(1,0)$ and $(0,1)$. It multiplies areas by $|\\det M|$.",
  "matrix-linear-system":
    "The system $ax+by=e$, $cx+dy=f$ is $AX=B$ with $A=\\begin{bmatrix}a&b\\\\c&d\\end{bmatrix}$, $X=\\begin{bmatrix}x\\\\y\\end{bmatrix}$, $B=\\begin{bmatrix}e\\\\f\\end{bmatrix}$. If $\\det A\\ne0$, the only solution is $X=A^{-1}B$. If $\\det A=0$, there is no single solution.",
};

export const vectorMatrixLessons: Lesson[] = [
  {
    id: "vector-components",
    title: "Vectors: components, length, sums and scaling",
    summary:
      "A vector is an arrow with a length and a direction, like a move on a map: 4 steps right and 3 steps down. The two numbers that describe the move are its components. To add, subtract or stretch vectors, work on the across numbers and the up numbers separately.",
    templateIds: ["vector-components"],
    senses: { difference: "difference-subtract" },
    noLink: ["scale", "tail", "change"],
    objectives: [
      "Find the components of a vector from its starting and ending points, or from a drawn arrow.",
      "Find a vector's length, and add, subtract and scale vectors using their components.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "An arrow described by two numbers",
        paragraphs: [
          "A vector is an arrow. Its starting point, the tail, is called the initial point, and its ending point, the tip, is called the terminal point. Its components, written $\\langle a,b\\rangle$, are how far it moves across ($a$) and up ($b$) from tail to tip. Right and up are positive, and left and down are negative.",
          "Sliding an arrow without turning it does not change its components, so two arrows with the same components are the same vector. The length of the arrow is called its magnitude, written $|\\mathbf{v}|$. The across and up moves are the legs of a right triangle, and the arrow is its hypotenuse, so the Pythagorean theorem gives the length.",
          "A scalar is an ordinary number, as opposed to a vector. Multiplying a vector by a scalar $k$ multiplies both components by $k$. That makes the arrow $|k|$ times as long, and a negative $k$ also turns it around.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Vector $\\mathbf{u}=\\overrightarrow{AB}$ goes from $A(1,2)$ to $B(5,-1)$, and $\\mathbf{v}=\\langle -1,2\\rangle$. Find the components of $\\mathbf{u}$, its magnitude, and $2\\mathbf{u}-\\mathbf{v}$.",
      steps: [
        "Subtract tail from tip, because the components measure the move from $A$ to $B$: $5-1=4$ across and $-1-2=-3$ up. So $\\mathbf{u}=\\langle 4,-3\\rangle$.",
        "The magnitude is the hypotenuse of a right triangle with legs 4 and 3: $|\\mathbf{u}|=\\sqrt{4^2+(-3)^2}=\\sqrt{25}=5$.",
        "Scale first: $2\\mathbf{u}$ doubles both components, giving $\\langle 8,-6\\rangle$.",
        "Subtract matching components: $\\langle 8-(-1),-6-2\\rangle=\\langle 9,-8\\rangle$.",
      ],
      answer:
        "$\\langle 4,-3\\rangle$, $|\\mathbf{u}|=5$, and $2\\mathbf{u}-\\mathbf{v}=\\langle 9,-8\\rangle$",
    },
    closingSections: [
      {
        stage: "method",
        title: "Tip to tail",
        paragraphs: [
          "To add $\\mathbf{u}$ and $\\mathbf{v}$ by drawing, place the tail of $\\mathbf{v}$ at the tip of $\\mathbf{u}$. The sum $\\mathbf{u}+\\mathbf{v}$ is the arrow from the tail of $\\mathbf{u}$ to the tip of $\\mathbf{v}$. So the across moves add, and the up moves add.",
          "The difference $\\mathbf{u}-\\mathbf{v}$ is $\\mathbf{u}+(-\\mathbf{v})$, where $-\\mathbf{v}$ is $\\mathbf{v}$ turned around. Multiplying by a scalar $k$ makes the arrow $|k|$ times as long, where $|k|$ is the size of $k$ without its sign.",
        ],
      },
      {
        stage: "formal",
        title: "Definitions",
        paragraphs: [
          "For points $P(x_1,y_1)$ and $Q(x_2,y_2)$, $\\overrightarrow{PQ}=\\langle x_2-x_1,\\;y_2-y_1\\rangle$. By the Pythagorean theorem, $|\\langle a,b\\rangle|=\\sqrt{a^2+b^2}$.",
          "$\\langle a,b\\rangle\\pm\\langle c,d\\rangle=\\langle a\\pm c,\\;b\\pm d\\rangle$ and $k\\langle a,b\\rangle=\\langle ka,kb\\rangle$. Since $\\sqrt{(ka)^2+(kb)^2}=|k|\\sqrt{a^2+b^2}$, $|k\\mathbf{v}|=|k||\\mathbf{v}|$.",
        ],
      },
    ],
    pitfalls: [
      "Subtract terminal minus initial. The other order gives the arrow pointing back.",
      "A scalar multiplies both components.",
      "A magnitude is a length, so it is never negative.",
    ],
    parentGuide:
      "Draw an arrow from $(1,2)$ to $(5,-1)$ on grid paper. Ask the learner to count the steps across and up, then explain why the answer is $\\langle 4,-3\\rangle$.",
  },
  {
    id: "vector-resultant",
    title: "Combining perpendicular velocities and forces",
    summary:
      "A boat crossing a river moves forward and is also pushed sideways by the current. When two such motions or pushes meet at a right angle, they form the two shorter sides of a right triangle. Their combined effect is the long side, so the Pythagorean theorem gives its size and the tangent ratio gives its direction.",
    templateIds: ["vector-resultant"],
    senses: {
      side: "side",
      sides: "side",
      tangent: "tangent-trig",
      degree: "degree-angle",
      "more than": "more-than",
    },
    noLink: ["part", "opposite", "mode"],
    objectives: [
      "Find the size of the combined effect, the resultant, of two perpendicular vectors.",
      "Find its direction angle with $\\arctan$, or a missing perpendicular part.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Two pushes at once",
        paragraphs: [
          "A velocity is a speed in a direction, and a force is a push or pull in a direction. Each has a size and a direction, so each is a vector, an arrow. A boat that points across a river is carried downstream by the current, so it ends up moving at a slant. The single vector with the same effect as the two together is their sum, called the resultant.",
          "When the two vectors are perpendicular, meeting at a right angle, they are the legs of a right triangle: its two shorter sides. The resultant is the hypotenuse, the longest side. In a right triangle, the tangent of an angle is the leg opposite it divided by the leg next to it, called adjacent. $\\arctan$, the inverse tangent, turns that ratio back into the angle.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A boat heads straight across a river at 12 mph relative to the water. The current flows downstream at 5 mph, perpendicular to the heading. Find the boat's speed relative to the shore and the angle $\\theta$ between its path and the straight-across direction, to the nearest degree.",
      steps: [
        "The two velocities are perpendicular, so they are the legs of a right triangle: 12 and 5. The boat's actual path is the hypotenuse, the resultant.",
        "Speed, by the Pythagorean theorem: $\\sqrt{12^2+5^2}=\\sqrt{169}=13$ mph.",
        "The angle $\\theta$ is measured from straight across, so the leg next to it is the heading, 12, and the leg opposite it is the current, 5: $\\tan\\theta=\\dfrac{5}{12}$.",
        "$\\theta=\\arctan\\left(\\dfrac{5}{12}\\right)\\approx22.6^\\circ$, which rounds to $23^\\circ$.",
      ],
      answer: "13 mph, at about $23^\\circ$ from straight across",
    },
    closingSections: [
      {
        stage: "method",
        title: "Draw the triangle first",
        paragraphs: [
          "Sketch one leg, then the other leg from its tip at a right angle. The resultant runs from the start of the first leg to the tip of the second. Label the angle you want and decide which leg is opposite it. If you are asked for the angle from the other leg, the opposite and adjacent legs trade places, and the angle is $90^\\circ$ minus the first.",
          "If the resultant $h$ and one leg $a$ are given, the missing leg is $\\sqrt{h^2-a^2}$. Use degree mode on a calculator, and round only the final answer.",
        ],
      },
      {
        stage: "formal",
        title: "Statement",
        paragraphs: [
          "If perpendicular vectors have magnitudes $a>0$ and $b>0$, their sum has magnitude $\\sqrt{a^2+b^2}$ by the Pythagorean theorem. Its angle $\\theta$ from the first vector satisfies $\\tan\\theta=b/a$, so $\\theta=\\arctan(b/a)$, between $0^\\circ$ and $90^\\circ$.",
        ],
      },
    ],
    pitfalls: [
      "Do not add 12 and 5: the sizes of perpendicular vectors do not simply add.",
      "Check which leg is opposite the angle. The other choice gives the complementary angle, $90^\\circ$ minus the right one.",
      "Round only at the end, and use degree mode.",
    ],
    parentGuide:
      "Ask the learner to sketch the 12 and 5 legs of the boat problem, say which side is the hypotenuse, and explain why the speed is more than 12 but less than 17.",
  },
  {
    id: "matrix-data-reading",
    title: "Matrices that organize data",
    summary:
      "A matrix is a grid of numbers in rows and columns, like a table of store stock without the labels. Each number sits in one row and one column, so it means one thing, such as one store's count of one item. Adding along a row or down a column gives totals.",
    templateIds: ["matrix-data-reading"],
    noLink: ["mean"],
    objectives: [
      "Read an entry of a matrix and say what it means in context.",
      "Find a row or column total, and state the dimensions $m\\times n$.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "A table with a name for every position",
        paragraphs: [
          "A matrix is a rectangular grid of numbers written between brackets. The lines of numbers going across are rows, and the lines going down are columns. Each number is called an entry. $a_{ij}$ names the entry in row $i$ and column $j$, row first.",
          "The dimensions of a matrix are its number of rows and columns, written rows $\\times$ columns: a matrix with 3 rows and 2 columns is $3\\times2$, read “3 by 2”.",
          "When the rows and columns have meanings, such as stores and items, every entry has a meaning too: one store's amount of one item.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Matrix $A=\\begin{bmatrix}12&8\\\\5&20\\\\9&14\\end{bmatrix}$ gives the stock at Eastside, Westside and Lakeview (rows, in that order) of backpacks and notebooks (columns, in that order). Find the dimensions, the number of notebooks at Westside, the total number of items at Lakeview, and the total number of backpacks.",
      steps: [
        "There are 3 rows and 2 columns, so $A$ is $3\\times2$.",
        "Westside is row 2 and notebooks are column 2, so read where they cross: $a_{22}=20$.",
        "Lakeview's items are all in row 3, so add across it: $9+14=23$ items.",
        "Backpacks at every store are in column 1, so add down it: $12+5+9=26$.",
      ],
      answer: "$3\\times2$; 20 notebooks; 23 items; 26 backpacks",
    },
    closingSections: [
      {
        stage: "method",
        title: "Rows and columns carry meaning",
        paragraphs: [
          "Add across a row for the total of everything one row describes: one store, all items. Add down a column for the total of one item over all stores. Do not read a single entry as a row or column total.",
          "Name the dimensions with rows first: three rows and two columns is $3\\times2$, not $2\\times3$.",
        ],
      },
      {
        stage: "formal",
        title: "Notation",
        paragraphs: [
          "An $m\\times n$ matrix has $m$ rows, $n$ columns and $mn$ entries. The sum of row $i$ is $\\sum_{j=1}^{n}a_{ij}$, and the sum of column $j$ is $\\sum_{i=1}^{m}a_{ij}$, where $\\Sigma$ means add up.",
        ],
      },
    ],
    pitfalls: [
      "Row first, column second: $a_{21}$ is in row 2, column 1, a different position from $a_{12}$.",
      "Row totals and column totals are different. Read the question to see which one it needs.",
      "The number of entries, such as 6, is not the dimensions, such as $3\\times2$.",
    ],
    parentGuide:
      "Make a small table of items in two rooms of your home. Ask the learner to write it as a matrix, then say what one entry and one column total mean.",
  },
  {
    id: "matrix-operations",
    title: "Adding, scaling and multiplying matrices",
    summary:
      "A matrix is a grid of numbers. Two matrices of the same size add by adding the numbers in matching places, and multiplying by an ordinary number multiplies every entry. Multiplying two matrices is different: each entry of the answer comes from a row of the first and a column of the second, so the sizes must fit first.",
    templateIds: ["matrix-operations"],
    senses: { product: "product-multiply", products: "product-multiply" },
    noLink: ["scale", "side"],
    objectives: [
      "Add, subtract and scale matrices.",
      "Multiply matrices, and decide from their dimensions whether a product is defined.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Entry by entry, and row by column",
        paragraphs: [
          "A matrix is a grid of numbers in rows (across) and columns (down). Its dimensions are its rows by its columns, such as $2\\times3$. Each number is an entry. Two matrices with the same dimensions add by adding the entries in matching positions. A scalar, an ordinary number, multiplies every entry.",
          "Multiplication is different. The entry in row $i$, column $j$ of the product $AB$ uses row $i$ of $A$ and column $j$ of $B$. Multiply their first entries, their second entries, and so on, and add those products. So each row of $A$ must have as many entries as each column of $B$.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Let $A=\\begin{bmatrix}1&2&0\\\\3&-1&2\\end{bmatrix}$ and $B=\\begin{bmatrix}2&1\\\\0&3\\\\1&-1\\end{bmatrix}$. Find $AB$, and say whether $BA$ is defined and what its dimensions are.",
      steps: [
        "$A$ is $2\\times3$ and $B$ is $3\\times2$. Each row of $A$ has 3 entries and each column of $B$ has 3, so $AB$ is defined. It has the 2 rows of $A$ and the 2 columns of $B$: $2\\times2$.",
        "Row 1 with column 1: $1\\cdot2+2\\cdot0+0\\cdot1=2$. Row 1 with column 2: $1\\cdot1+2\\cdot3+0\\cdot(-1)=7$.",
        "Row 2 with column 1: $3\\cdot2+(-1)\\cdot0+2\\cdot1=8$. Row 2 with column 2: $3\\cdot1+(-1)\\cdot3+2\\cdot(-1)=-2$.",
        "For $BA$, each row of $B$ has 2 entries and each column of $A$ has 2, so it is defined. It has the 3 rows of $B$ and the 3 columns of $A$: $3\\times3$.",
      ],
      answer:
        "$AB=\\begin{bmatrix}2&7\\\\8&-2\\end{bmatrix}$; $BA$ is defined and is $3\\times3$",
    },
    closingSections: [
      {
        stage: "method",
        title: "Check dimensions, then compute",
        paragraphs: [
          "Write the dimensions side by side, $(m\\times n)(n\\times p)$. The two inside numbers must match. The outside numbers, $m\\times p$, are the dimensions of the product. If the inside numbers differ, the product is not defined.",
          "For $kA\\pm B$, multiply $A$ by $k$ first, then add or subtract matching entries of $B$.",
        ],
      },
      {
        stage: "formal",
        title: "Definitions",
        paragraphs: [
          "For equal dimensions, $(A+B)_{ij}=a_{ij}+b_{ij}$ and $(kA)_{ij}=ka_{ij}$. If $A$ is $m\\times n$ and $B$ is $n\\times p$, then $(AB)_{ij}=\\sum_{k=1}^{n}a_{ik}b_{kj}$, the sum of the products along row $i$ and column $j$, and $AB$ is $m\\times p$.",
        ],
      },
    ],
    pitfalls: [
      "A matrix product is not the product of matching entries.",
      "Each entry of a product adds one product for every column of the left matrix.",
      "$AB$ and $BA$ may differ in size, or one of them may not be defined.",
    ],
    parentGuide:
      "Ask the learner to say which row and which column produce one entry of the product, and why a $2\\times3$ matrix times a $2\\times3$ matrix cannot be multiplied.",
  },
  {
    id: "matrix-laws",
    title: "Matrix products: order matters",
    summary:
      "Multiplying matrices follows most of the rules of multiplying numbers. Grouping does not matter, multiplication spreads over addition, and there is a matrix that acts like 1. But order does matter: $AB$ and $BA$ are usually different.",
    templateIds: ["matrix-laws"],
    senses: {
      product: "product-multiply",
      products: "product-multiply",
      commute: "commute",
      factor: "factor-number",
      factors: "factor-number",
      identity: "identity-matrix",
    },
    noLink: ["rule", "rules", "changes", "leaves", "square"],
    objectives: [
      "Compute $AB$ and $BA$ and show that they can differ.",
      "Recognize the identity matrix, and decide which matrix laws always hold.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "The one number rule that fails",
        paragraphs: [
          "To multiply two $2\\times2$ matrices, each entry of the product pairs a row of the first with a column of the second. For numbers, $3\\cdot5=5\\cdot3$. For matrices, swapping the order changes which rows meet which columns, so $AB$ and $BA$ usually differ. When $AB=BA$, we say the two matrices commute.",
          "The main diagonal of a square matrix runs from its top left entry to its bottom right entry. The identity matrix $I$ has ones on the main diagonal and zeros everywhere else. It leaves a matrix unchanged, $IA=AI=A$, as multiplying by 1 leaves a number unchanged.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Let $A=\\begin{bmatrix}1&2\\\\0&1\\end{bmatrix}$ and $B=\\begin{bmatrix}1&0\\\\3&1\\end{bmatrix}$. Compute $AB$ and $BA$ and compare them.",
      steps: [
        "$AB$: row 1 of $A$ with the two columns of $B$ gives $1\\cdot1+2\\cdot3=7$ and $1\\cdot0+2\\cdot1=2$. Row 2 gives $0\\cdot1+1\\cdot3=3$ and $0\\cdot0+1\\cdot1=1$. So $AB=\\begin{bmatrix}7&2\\\\3&1\\end{bmatrix}$.",
        "$BA$: row 1 of $B$ with the columns of $A$ gives $1\\cdot1+0\\cdot0=1$ and $1\\cdot2+0\\cdot1=2$. Row 2 gives $3\\cdot1+1\\cdot0=3$ and $3\\cdot2+1\\cdot1=7$. So $BA=\\begin{bmatrix}1&2\\\\3&7\\end{bmatrix}$.",
        "The top left entries are 7 and 1. One different entry is enough, so the products are different.",
      ],
      answer: "$AB\\ne BA$",
    },
    closingSections: [
      {
        stage: "method",
        title: "Which laws hold",
        paragraphs: [
          "These always hold when the products are defined: $(AB)C=A(BC)$, $A(B+C)=AB+AC$, $(A+B)C=AC+BC$ and $IA=AI=A$.",
          "These do not always hold: $AB=BA$, and $(A+B)^2=A^2+2AB+B^2$, because the middle is really $AB+BA$. Cancelling also fails: $AB=AC$ does not force $B=C$. A product can even be the zero matrix, all zeros, when neither factor is: $\\begin{bmatrix}1&0\\\\0&0\\end{bmatrix}\\begin{bmatrix}0&0\\\\0&1\\end{bmatrix}$ is the zero matrix.",
        ],
      },
      {
        stage: "formal",
        title: "Justification",
        paragraphs: [
          "One example where a law fails, called a counterexample, proves the law is not always true. The example above is one for the order rule. The laws that hold follow from the definition $(AB)_{ij}=\\sum_k a_{ik}b_{kj}$, because grouping and spreading over addition work for sums and products of numbers.",
        ],
      },
    ],
    pitfalls: [
      "Do not swap the order. Compute each order separately.",
      "Some pairs do commute, so test the specific matrices.",
      "The identity is $I$, with ones on the main diagonal, not a matrix of all ones.",
    ],
    parentGuide:
      "Ask the learner to compute both orders for two $2\\times2$ matrices with small entries, and to point to an entry that differs, if any does.",
  },
  {
    id: "matrix-inverse-determinant",
    title: "Determinants and inverses of 2×2 matrices",
    summary:
      "Dividing by 3 undoes multiplying by 3. For a matrix, the matrix that undoes it is called its inverse. A single number worked out from a $2\\times2$ matrix, its determinant, tells whether an inverse exists and appears in the formula for it.",
    templateIds: ["matrix-inverse-determinant"],
    senses: { inverse: "inverse-matrix" },
    noLink: ["change", "changes"],
    objectives: [
      "Compute a $2\\times2$ determinant and decide whether the inverse exists.",
      "Find the exact inverse of a $2\\times2$ matrix that has one.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Undoing a matrix",
        paragraphs: [
          "Two matrices multiply row by column. Each entry of the product pairs a row of the first matrix with a column of the second: multiply matching numbers, then add. In $\\begin{bmatrix}2&1\\\\4&3\\end{bmatrix}\\begin{bmatrix}5&0\\\\1&2\\end{bmatrix}$, row 1 with column 1 gives $2\\cdot5+1\\cdot1=11$, the top-left entry of the product.",
          "The identity matrix $I=\\begin{bmatrix}1&0\\\\0&1\\end{bmatrix}$ acts like the number 1: multiplying by it changes nothing. The inverse of a matrix $A$, written $A^{-1}$, is the matrix that undoes it: $AA^{-1}$ and $A^{-1}A$ both equal $I$.",
          "Not every matrix has an inverse, just as 0 has no reciprocal. For $\\begin{bmatrix}a&b\\\\c&d\\end{bmatrix}$, the number $ad-bc$ is called the determinant, written $\\det A$. An inverse exists exactly when the determinant is not 0.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Find the determinant and the inverse of $A=\\begin{bmatrix}2&1\\\\4&3\\end{bmatrix}$, and check the result.",
      steps: [
        "$\\det A=2\\cdot3-1\\cdot4=2$. It is not 0, so $A^{-1}$ exists.",
        "Swap the entries on the main diagonal, 2 and 3, and change the signs of the other two: $\\begin{bmatrix}3&-1\\\\-4&2\\end{bmatrix}$.",
        "Divide every entry by the determinant, 2: $A^{-1}=\\begin{bmatrix}\\frac{3}{2}&-\\frac{1}{2}\\\\-2&1\\end{bmatrix}$.",
        "Check: row 1 of $A$ with column 1 of $A^{-1}$ gives $2\\cdot\\frac{3}{2}+1\\cdot(-2)=1$, and with column 2 gives $2\\cdot(-\\frac{1}{2})+1\\cdot1=0$. Row 2 gives 0 and 1, so $AA^{-1}=I$.",
      ],
      answer:
        "$\\det A=2$ and $A^{-1}=\\begin{bmatrix}\\frac{3}{2}&-\\frac{1}{2}\\\\-2&1\\end{bmatrix}$",
    },
    closingSections: [
      {
        stage: "method",
        title: "When there is no inverse",
        paragraphs: [
          "For $\\begin{bmatrix}2&4\\\\1&2\\end{bmatrix}$, the determinant is $2\\cdot2-4\\cdot1=0$. The second row is half the first, so the matrix squashes information that no matrix can recover, and it has no inverse.",
          "When a matrix contains a letter, set $ad-bc=0$ and solve for the letter. Those values are where the matrix has no inverse.",
        ],
      },
      {
        stage: "formal",
        title: "Formula",
        paragraphs: [
          "For $A=\\begin{bmatrix}a&b\\\\c&d\\end{bmatrix}$, multiplying gives $A\\begin{bmatrix}d&-b\\\\-c&a\\end{bmatrix}=(ad-bc)I$. If $ad-bc\\ne0$, dividing by it gives $A^{-1}=\\dfrac{1}{ad-bc}\\begin{bmatrix}d&-b\\\\-c&a\\end{bmatrix}$. If $ad-bc=0$, no inverse exists.",
        ],
      },
    ],
    pitfalls: [
      "Subtract in the determinant: $ad-bc$.",
      "Swap only $a$ and $d$, and change the signs of only $b$ and $c$.",
      "Divide every entry by the determinant, and keep fractions exact.",
    ],
    parentGuide:
      "Ask the learner to multiply $A$ by the claimed inverse and see the identity matrix. Ask what goes wrong when the determinant is 0.",
  },
  {
    id: "matrix-transformation",
    title: "Matrices that move points",
    summary:
      "A $2\\times2$ matrix can move every point of the plane, turning, flipping or stretching a whole shape. Where it sends the two points $(1,0)$ and $(0,1)$ tells you everything it does. For $\\begin{bmatrix}a&b\\\\c&d\\end{bmatrix}$, the number $ad-bc$, called the determinant, tells how many times bigger every area becomes, ignoring its sign.",
    templateIds: ["matrix-transformation"],
    senses: {
      plane: "plane",
      image: "image-transformation",
      images: "image-transformation",
      factor: "factor-number",
      square: "square-shape",
      sides: "side",
      quarter: "fourth",
    },
    noLink: ["whole"],
    objectives: [
      "Apply a $2\\times2$ matrix to a point.",
      "Identify rotation, reflection and dilation matrices, and use the determinant to find a new area.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "A matrix as a machine on the plane",
        paragraphs: [
          "A point $(x,y)$ can be written as a column, $\\begin{bmatrix}x\\\\y\\end{bmatrix}$. Multiplying it by a $2\\times2$ matrix $M$ gives a new column, a new point called the image. Each row of $M$ gives one coordinate of the image: multiply the row's first entry by $x$ and its second entry by $y$, then add.",
          "Doing this to every point of a figure moves the whole figure. A rotation turns it about the origin, a reflection flips it across a line, and a dilation stretches it from the origin by a scale factor $k$.",
          "The first column of $M$ is where $(1,0)$ goes, and the second column is where $(0,1)$ goes. Every other point follows from those two.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "The matrix $R=\\begin{bmatrix}0&-1\\\\1&0\\end{bmatrix}$ rotates points $90^\\circ$ counterclockwise about the origin. Where does it send $(3,2)$? Then a triangle of area 5 is transformed by $N=\\begin{bmatrix}2&1\\\\-1&3\\end{bmatrix}$. What is the area of the image?",
      steps: [
        "Write $(3,2)$ as a column and multiply: $R\\begin{bmatrix}3\\\\2\\end{bmatrix}=\\begin{bmatrix}0\\cdot3+(-1)\\cdot2\\\\1\\cdot3+0\\cdot2\\end{bmatrix}=\\begin{bmatrix}-2\\\\3\\end{bmatrix}$. So $(3,2)$ goes to $(-2,3)$.",
        "Check with the columns of $R$: $(1,0)$ goes to $(0,1)$ and $(0,1)$ goes to $(-1,0)$, a counterclockwise quarter turn.",
        "The determinant of $N$ is $2\\cdot3-1\\cdot(-1)=7$, so areas are multiplied by $|7|=7$.",
        "The image area is $7\\cdot5=35$.",
      ],
      answer: "$(-2,3)$; area 35",
    },
    closingSections: [
      {
        stage: "method",
        title: "Standard matrices",
        paragraphs: [
          "Find the images of $(1,0)$ and $(0,1)$ and use them as the columns. Rotation by $90^\\circ$ counterclockwise: $\\begin{bmatrix}0&-1\\\\1&0\\end{bmatrix}$. Reflection across the $x$-axis: $\\begin{bmatrix}1&0\\\\0&-1\\end{bmatrix}$. Dilation by factor $k$ from the origin: $\\begin{bmatrix}k&0\\\\0&k\\end{bmatrix}$.",
          "Areas are multiplied by $|\\det M|$, the size of the determinant without its sign. A negative determinant means the figure is also flipped, as in a reflection. A determinant of 0 squashes the figure onto a line or a point, so its area becomes 0.",
        ],
      },
      {
        stage: "formal",
        title: "Statement",
        paragraphs: [
          "The matrix $M=\\begin{bmatrix}a&b\\\\c&d\\end{bmatrix}$ sends the unit square, the square with corners $(0,0)$, $(1,0)$, $(0,1)$ and $(1,1)$, to the parallelogram with sides along $(a,c)$ and $(b,d)$, which has area $|ad-bc|$. When $ad-bc=0$, that parallelogram collapses to a segment or a point, with area 0. $M$ stretches every region of the plane in the same way, so it multiplies every area by $|\\det M|$.",
        ],
      },
    ],
    pitfalls: [
      "Multiply each row of the matrix by the column, not each column.",
      "Area is multiplied by $|\\det M|$ once: do not square it, and do not keep a negative sign.",
      "A zero determinant gives zero area, not the original area.",
    ],
    parentGuide:
      "Ask the learner to find where $(1,0)$ and $(0,1)$ go under a matrix, then predict where $(2,3)$ goes before multiplying.",
  },
  {
    id: "matrix-linear-system",
    title: "Solving a linear system with a matrix inverse",
    summary:
      "Two equations such as $2x+y=7$ and $x+3y=11$ can be packed into one matrix equation, $AX=B$. A matrix is a grid of numbers. $A$ holds the numbers in front of $x$ and $y$, $X$ holds $x$ and $y$, and $B$ holds the right sides. The matrix that undoes $A$, called its inverse $A^{-1}$, solves both equations at once: $X=A^{-1}B$.",
    templateIds: ["matrix-linear-system"],
    senses: {
      sides: "side-of-equation",
      inverse: "inverse-matrix",
      factor: "factor-number",
      product: "product-multiply",
    },
    noLink: ["changes", "leaves"],
    objectives: [
      "Write a system of two linear equations as $AX=B$.",
      "Solve it with $A^{-1}$, and recognize when the determinant is 0.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Two equations in one",
        paragraphs: [
          "A linear system is a set of equations like $2x+y=7$ and $x+3y=11$ that must all be true at once. The numbers multiplying $x$ and $y$ are called coefficients. Put them in a matrix $A$, one equation per row. Put the unknowns in a column $X=\\begin{bmatrix}x\\\\y\\end{bmatrix}$, and the right sides in a column $B$. A matrix times a column multiplies each row by the column: the row's first entry times $x$ plus its second entry times $y$. So row 1 of $AX$ is $2x+1y$ and row 2 is $1x+3y$, the left sides of the equations. The system is $AX=B$.",
          "The inverse $A^{-1}$ undoes $A$, and the identity matrix $I$ changes nothing. So if $A$ has an inverse, multiplying both sides by $A^{-1}$ on the left leaves $X$ alone: $X=A^{-1}B$. $A$ has an inverse exactly when its determinant, $ad-bc$, is not 0.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Write $2x+y=7$ and $x+3y=11$ as $AX=B$ and solve for $x$ and $y$.",
      steps: [
        "The coefficients of each equation make one row: $A=\\begin{bmatrix}2&1\\\\1&3\\end{bmatrix}$, $X=\\begin{bmatrix}x\\\\y\\end{bmatrix}$ and $B=\\begin{bmatrix}7\\\\11\\end{bmatrix}$.",
        "$\\det A=2\\cdot3-1\\cdot1=5$, which is not 0, so the inverse exists: $A^{-1}=\\dfrac{1}{5}\\begin{bmatrix}3&-1\\\\-1&2\\end{bmatrix}$.",
        "Multiply with the inverse on the left: $X=A^{-1}B=\\dfrac{1}{5}\\begin{bmatrix}3\\cdot7-11\\\\-7+2\\cdot11\\end{bmatrix}=\\dfrac{1}{5}\\begin{bmatrix}10\\\\15\\end{bmatrix}=\\begin{bmatrix}2\\\\3\\end{bmatrix}$.",
        "Check in the original equations: $2\\cdot2+3=7$ and $2+3\\cdot3=11$.",
      ],
      answer: "$x=2$, $y=3$",
    },
    closingSections: [
      {
        stage: "method",
        title: "When the determinant is 0",
        paragraphs: [
          "For $x+2y=5$ and $2x+4y=3$, $A=\\begin{bmatrix}1&2\\\\2&4\\end{bmatrix}$ has $\\det A=1\\cdot4-2\\cdot2=0$. The second left side is exactly twice the first, so no inverse exists and there is no single solution. Here there is no solution at all, because the second equation would force $x+2y=1.5$, not 5.",
          "Before using an inverse, compute the determinant. If it is 0, the matrix method does not give one solution.",
        ],
      },
      {
        stage: "formal",
        title: "Statement",
        paragraphs: [
          "If $\\det A\\ne0$, then $A^{-1}(AX)=(A^{-1}A)X=X$, so $AX=B$ gives $X=A^{-1}B$, and this $X$ satisfies the system. If $\\det A=0$, $A$ has no inverse, and the system has either no solution or infinitely many.",
        ],
      },
    ],
    pitfalls: [
      "Put the constants in $B$, with their signs changed if they move across the equals sign.",
      "Write the inverse on the left: $A^{-1}B$, not $BA^{-1}$.",
      "Apply the $\\frac{1}{\\det A}$ factor to every entry of the product.",
    ],
    parentGuide:
      "Ask the learner to put the final $x$ and $y$ back into both equations, and to explain why that check does not need the matrix.",
  },
];
