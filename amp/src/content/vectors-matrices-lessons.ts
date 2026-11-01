import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

export const vectorMatrixMethods: Record<string, ProblemMethod> = {
  "vector-components": {
    goal: "Given two points, a drawn arrow, or component pairs, find components, a magnitude, or a sum, difference or scalar multiple.",
    intuition:
      "A vector is an arrow with a length and a direction. Its components $\\langle a,b\\rangle$ say how far it moves horizontally ($a$) and vertically ($b$); right and up are positive. Two arrows with the same components are the same vector wherever they are drawn.",
    terms: [
      [
        "vector",
        "The initial point is the tail of the arrow; the terminal point is its tip.",
      ],
      "component",
      "magnitude",
      "scalar",
    ],
    method: [
      "For points, subtract tail from tip: terminal coordinates minus initial coordinates, $x$ first.",
      "For a magnitude, square both components, add, and take the square root.",
      "For sums, differences and scalar multiples, work on matching components: $\\langle a,b\\rangle+\\langle c,d\\rangle=\\langle a+c,b+d\\rangle$ and $k\\langle a,b\\rangle=\\langle ka,kb\\rangle$.",
    ],
    watch:
      "Subtract in the order terminal minus initial; the other order gives the opposite arrow. A scalar multiplies both components, and a magnitude is never negative.",
  },
  "vector-resultant": {
    goal: "Two perpendicular velocities or forces act together; find the size or direction of the combined vector, or a missing component.",
    intuition:
      "A velocity or a force has a size and a direction, so it is a vector. Two vectors acting together have the effect of their sum, called the resultant. When the two are perpendicular they are the legs of a right triangle and the resultant is its hypotenuse.",
    terms: ["resultant", "inverse-trig-function"],
    method: [
      "Draw the two perpendicular vectors as the legs of a right triangle. The resultant is the hypotenuse.",
      "Magnitude: $\\sqrt{a^2+b^2}$. A missing leg: $\\sqrt{h^2-a^2}$.",
      "Direction: $\\tan\\theta=\\dfrac{\\text{opposite leg}}{\\text{adjacent leg}}$, so $\\theta=\\arctan(\\text{opposite}/\\text{adjacent})$. Round only at the end, as the question states.",
    ],
    watch:
      "Perpendicular quantities do not add or subtract: the resultant is shorter than the sum of the legs. Decide which leg is opposite the angle you are asked for; the other choice gives the complementary angle.",
  },
  "matrix-data-reading": {
    goal: "Read an entry, a row total or a column total from a matrix of data, or name its dimensions.",
    intuition:
      "A matrix is a rectangular grid of numbers that organizes data. Each row and each column has a meaning, such as a store and an item, so each number belongs to exactly one row and one column.",
    terms: [
      [
        "matrix",
        "Each number in it is an entry; $a_{ij}$ is in row $i$ and column $j$.",
      ],
      [
        "matrix",
        "Its dimensions $m\\times n$ mean $m$ rows and $n$ columns, rows first.",
      ],
    ],
    method: [
      "Find the row and the column the question names, then read where they cross.",
      "For one store's total over all items, add across its row; for one item's total over all stores, add down its column.",
      "State dimensions as rows $\\times$ columns.",
    ],
    watch:
      "The first subscript is the row and the second is the column; reversing them reads a different quantity. Keep rows and columns straight when naming dimensions.",
  },
  "matrix-operations": {
    goal: "Add, scale or multiply small matrices, or decide from dimensions whether a product exists.",
    intuition:
      "Matrices of the same size add by adding matching entries, and a scalar multiplies every entry. A product combines a row of the first matrix with a column of the second, multiplying matching entries and adding them.",
    terms: ["scalar", "matrix-product"],
    method: [
      "Sums and differences need equal dimensions; combine matching entries. Do any scalar multiple first.",
      "For a product, first compare the columns of the left matrix with the rows of the right matrix. They must be equal; the result has the rows of the left and the columns of the right.",
      "Each entry is a sum of products: go across the row and down the column together.",
    ],
    watch:
      "Do not multiply matching entries for a product; each entry of $AB$ adds products of a whole row with a whole column. Order matters: $AB$ and $BA$ can have different dimensions.",
  },
  "matrix-laws": {
    goal: "Compare $AB$ and $BA$, recognize the identity matrix, or choose which matrix laws always hold.",
    intuition:
      "Matrix multiplication keeps most of the rules of number multiplication, but not the order rule. Swapping the order of two matrices usually changes the product.",
    terms: [
      "identity-matrix",
      ["commute", "For matrices, $AB=BA$. Some pairs commute; most do not."],
    ],
    method: [
      "To test whether two matrices commute, compute both $AB$ and $BA$ and compare entry by entry; one differing entry is enough to show $AB\\ne BA$.",
      "Laws that always hold: $(AB)C=A(BC)$, $A(B+C)=AB+AC$, $(A+B)C=AC+BC$, and $IA=AI=A$.",
      "A rule that moves factors past each other, or cancels a matrix, needs a check; one counterexample shows it does not always hold.",
    ],
    watch:
      "Do not reorder factors. $(A+B)^2$ expands to $A^2+AB+BA+B^2$, which is not $A^2+2AB+B^2$ unless $AB=BA$.",
  },
  "matrix-inverse-determinant": {
    goal: "Find a $2\\times2$ determinant, decide whether an inverse exists, or compute the inverse.",
    intuition:
      "The inverse of a matrix undoes it, as dividing undoes multiplying. A $2\\times2$ matrix has an inverse exactly when its determinant is not 0.",
    terms: ["determinant", "inverse-matrix"],
    method: [
      "Compute $\\det A=ad-bc$. If it is 0, there is no inverse.",
      "Otherwise swap $a$ and $d$, change the signs of $b$ and $c$, and divide every entry by $\\det A$.",
      "Check that $AA^{-1}=I$.",
    ],
    watch:
      "Subtract in the determinant ($ad-bc$). Swap only the main-diagonal entries and change signs only on the other two. Keep fractions exact.",
  },
  "matrix-transformation": {
    goal: "Apply a $2\\times2$ matrix to a point, match a matrix with a rotation, reflection or dilation, or find an area after a transformation.",
    intuition:
      "A $2\\times2$ matrix moves every point of the plane. Write a point as a column and multiply: the matrix sends the point to a new point. The columns of the matrix are where the points $(1,0)$ and $(0,1)$ go.",
    terms: ["image-transformation", "determinant"],
    method: [
      "To apply a matrix, multiply it by the column $\\begin{bmatrix}x\\\\y\\end{bmatrix}$: each row gives one new coordinate.",
      "To identify a transformation, find the images of $(1,0)$ and $(0,1)$; they are the columns.",
      "Areas are multiplied by $|\\det M|$. A determinant of 0 flattens the figure.",
    ],
    watch:
      "Use rows of the matrix with the column, not columns. The area factor is the absolute value of the determinant, and it multiplies the area once.",
  },
  "matrix-linear-system": {
    goal: "Write a $2\\times2$ system as $AX=B$, solve it with $A^{-1}$, or tell when no inverse exists.",
    intuition:
      "A system of two linear equations can be written as one matrix equation $AX=B$. If $A$ has an inverse, multiplying both sides by $A^{-1}$ gives the solution $X=A^{-1}B$.",
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
    method: [
      "Write each equation as $ax+by=e$ with $x$ first. Rows of $A$ are $(a,b)$; $B$ is the column of $e$ values.",
      "Compute $\\det A$. If it is 0, there is no inverse and no unique solution.",
      "Otherwise find $A^{-1}$ and multiply on the left: $X=A^{-1}B$. Read $x$ and $y$ from the column.",
    ],
    watch:
      "Move constants to the right side with their signs changed, keep the equations in order, and multiply $A^{-1}B$ in that order (the inverse goes on the left).",
  },
};

export const vectorMatrixPrinciples: Record<string, string> = {
  "vector-components":
    "For points $P(x_1,y_1)$ and $Q(x_2,y_2)$, $\\overrightarrow{PQ}=\\langle x_2-x_1,y_2-y_1\\rangle$. The magnitude is $|\\langle a,b\\rangle|=\\sqrt{a^2+b^2}$. Vectors add and scale by components: $\\langle a,b\\rangle+\\langle c,d\\rangle=\\langle a+c,b+d\\rangle$ and $k\\langle a,b\\rangle=\\langle ka,kb\\rangle$, with $|k\\mathbf{v}|=|k||\\mathbf{v}|$.",
  "vector-resultant":
    "If vectors of magnitudes $a$ and $b$ are perpendicular, their sum has magnitude $\\sqrt{a^2+b^2}$ and makes the angle $\\theta=\\arctan(b/a)$ with the vector of magnitude $a$, for $a>0$.",
  "matrix-data-reading":
    "An $m\\times n$ matrix has $m$ rows and $n$ columns. The entry $a_{ij}$ is in row $i$ and column $j$. The sum of row $i$ is $\\sum_j a_{ij}$ and the sum of column $j$ is $\\sum_i a_{ij}$.",
  "matrix-operations":
    "Matrices of equal dimensions add entrywise, and $kA$ multiplies every entry by $k$. If $A$ is $m\\times n$ and $B$ is $n\\times p$, then $AB$ is $m\\times p$ with $(AB)_{ij}=\\sum_{k=1}^{n}a_{ik}b_{kj}$. If the columns of $A$ do not equal the rows of $B$, $AB$ is not defined.",
  "matrix-laws":
    "For matrices whose products and sums are defined: $(AB)C=A(BC)$, $A(B+C)=AB+AC$, $(A+B)C=AC+BC$, and $AI=IA=A$. Multiplication is not commutative: $AB\\ne BA$ for some pairs.",
  "matrix-inverse-determinant":
    "For $A=\\begin{bmatrix}a&b\\\\c&d\\end{bmatrix}$, $\\det A=ad-bc$. $A$ is invertible exactly when $\\det A\\ne0$, and then $A^{-1}=\\dfrac{1}{ad-bc}\\begin{bmatrix}d&-b\\\\-c&a\\end{bmatrix}$.",
  "matrix-transformation":
    "The matrix $M$ sends $\\begin{bmatrix}x\\\\y\\end{bmatrix}$ to $M\\begin{bmatrix}x\\\\y\\end{bmatrix}$. Its columns are the images of $(1,0)$ and $(0,1)$. It multiplies areas by $|\\det M|$.",
  "matrix-linear-system":
    "The system $ax+by=e$, $cx+dy=f$ is $AX=B$ with $A=\\begin{bmatrix}a&b\\\\c&d\\end{bmatrix}$, $X=\\begin{bmatrix}x\\\\y\\end{bmatrix}$, $B=\\begin{bmatrix}e\\\\f\\end{bmatrix}$. If $\\det A\\ne0$ the unique solution is $X=A^{-1}B$. If $\\det A=0$ there is no unique solution.",
};

export const vectorMatrixLessons: Lesson[] = [
  {
    id: "vector-components",
    title: "Vectors: components, length, sums and scaling",
    summary:
      "A vector is an arrow with a length and a direction. Its components say how far it moves across and up. Add, subtract and scale vectors one component at a time.",
    templateIds: ["vector-components"],
    objectives: [
      "Find the components of a vector from its initial and terminal points or from a drawn arrow.",
      "Find a magnitude, and add, subtract and scale vectors by components.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "An arrow described by two numbers",
        paragraphs: [
          "You need to subtract coordinates and use the Pythagorean theorem. A vector is an arrow. Its initial point is the tail and its terminal point is the tip. Its components $\\langle a,b\\rangle$ are the horizontal change $a$ and the vertical change $b$ from tail to tip: right and up are positive, left and down are negative.",
          "Moving an arrow without turning it does not change its components, so two arrows with the same components are the same vector. The length of the arrow is its magnitude, written $|\\mathbf{v}|$.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Vector $\\mathbf{u}=\\overrightarrow{AB}$ goes from $A(1,2)$ to $B(5,-1)$, and $\\mathbf{v}=\\langle -1,2\\rangle$. Find the components of $\\mathbf{u}$, its magnitude, and $2\\mathbf{u}-\\mathbf{v}$.",
      steps: [
        "Subtract tail from tip: $5-1=4$ and $-1-2=-3$, so $\\mathbf{u}=\\langle 4,-3\\rangle$.",
        "The magnitude is the hypotenuse of a right triangle with legs 4 and 3: $|\\mathbf{u}|=\\sqrt{4^2+(-3)^2}=\\sqrt{25}=5$.",
        "Scale first: $2\\mathbf{u}=\\langle 8,-6\\rangle$.",
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
          "To add $\\mathbf{u}$ and $\\mathbf{v}$ by drawing, place the tail of $\\mathbf{v}$ at the tip of $\\mathbf{u}$. The sum $\\mathbf{u}+\\mathbf{v}$ is the arrow from the tail of $\\mathbf{u}$ to the tip of $\\mathbf{v}$, so the horizontal changes add and the vertical changes add. The difference $\\mathbf{u}-\\mathbf{v}$ is $\\mathbf{u}+(-\\mathbf{v})$, where $-\\mathbf{v}$ is the arrow reversed.",
          "Multiplying by a scalar $k$ stretches the arrow by $|k|$ and reverses it when $k$ is negative.",
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
      "Two perpendicular velocities or forces make a right triangle. The combined vector is its hypotenuse, and its direction comes from an arctangent.",
    templateIds: ["vector-resultant"],
    objectives: [
      "Find the magnitude of the resultant of two perpendicular vectors.",
      "Find its direction angle with $\\arctan$, or a missing perpendicular component.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Two pushes at once",
        paragraphs: [
          "You need the Pythagorean theorem and the tangent ratio of a right triangle. A boat that points across a river is carried downstream by the current, so it ends up moving diagonally. Its velocity relative to the water and the current's velocity are vectors: each has a size and a direction. The single vector with the same effect is their sum, the resultant.",
          "When the two vectors are perpendicular, they are the legs of a right triangle. The resultant is the hypotenuse, and the angle it makes with a leg comes from the tangent ratio.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A boat heads straight across a river at 12 mph relative to the water. The current flows downstream at 5 mph, perpendicular to the heading. Find the boat's speed relative to the shore and the angle $\\theta$ between its path and the straight-across direction, to the nearest degree.",
      steps: [
        "The legs are 12 and 5 and the resultant is the hypotenuse.",
        "Speed: $\\sqrt{12^2+5^2}=\\sqrt{169}=13$ mph.",
        "The leg opposite $\\theta$ is the current, 5, and the leg adjacent to $\\theta$ is the heading, 12: $\\tan\\theta=\\dfrac{5}{12}$.",
        "$\\theta=\\arctan\\left(\\dfrac{5}{12}\\right)\\approx22.6^\\circ$, which rounds to $23^\\circ$.",
      ],
      answer: "13 mph, at about $23^\\circ$ from straight across",
    },
    closingSections: [
      {
        stage: "method",
        title: "Draw the triangle first",
        paragraphs: [
          "Sketch one leg, then the other leg starting at its tip and turning a right angle, then the hypotenuse back to the start. Label the angle you want and decide which leg is opposite it. If you are asked for the angle from the other leg, the opposite and adjacent legs trade places, and the angle is $90^\\circ$ minus the first.",
          "If the resultant and one leg are given, the missing leg is $\\sqrt{h^2-a^2}$. Use degree mode on a calculator, and round only the final answer.",
        ],
      },
      {
        stage: "formal",
        title: "Statement",
        paragraphs: [
          "If perpendicular vectors have magnitudes $a>0$ and $b$, the sum has magnitude $\\sqrt{a^2+b^2}$ by the Pythagorean theorem, and its angle $\\theta$ from the first vector satisfies $\\tan\\theta=b/a$, so $\\theta=\\arctan(b/a)$ with $0^\\circ<\\theta<90^\\circ$ for $b>0$.",
        ],
      },
    ],
    pitfalls: [
      "Do not add 12 and 5: perpendicular quantities do not simply add.",
      "Check which leg is opposite the angle; the other choice gives the complementary angle.",
      "Round only at the end, and use degree mode.",
    ],
    parentGuide:
      "Ask the learner to sketch the 12 and 5 legs of the boat problem and say which side is the hypotenuse and why the speed is more than 12 but less than 17.",
  },
  {
    id: "matrix-data-reading",
    title: "Matrices that organize data",
    summary:
      "A matrix is a grid of numbers in rows and columns. Each entry sits at one row and one column, and rows or columns can be added for totals.",
    templateIds: ["matrix-data-reading"],
    objectives: [
      "Read an entry and say what it means in context.",
      "Find a row or column total and state the dimensions $m\\times n$.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "A table with a name for every position",
        paragraphs: [
          "You need to read a two-way table. A matrix is a rectangular grid of numbers written between brackets. Horizontal lines of numbers are rows and vertical lines are columns. Each number is an entry, and $a_{ij}$ names the entry in row $i$ and column $j$ (row first).",
          "When the rows and columns have meanings, such as stores and items, every entry has a meaning too: one store's amount of one item.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Matrix $A=\\begin{bmatrix}12&8\\\\5&20\\\\9&14\\end{bmatrix}$ gives the stock at Eastside, Westside and Lakeview (rows, in that order) of backpacks and notebooks (columns, in that order). Find the dimensions, the number of notebooks at Westside, the total number of items at Lakeview, and the total number of backpacks.",
      steps: [
        "There are 3 rows and 2 columns, so $A$ is $3\\times2$.",
        "Westside is row 2 and notebooks are column 2: $a_{22}=20$.",
        "Lakeview is row 3: $9+14=23$ items.",
        "Backpacks are column 1: $12+5+9=26$.",
      ],
      answer: "$3\\times2$; 20 notebooks; 23 items; 26 backpacks",
    },
    closingSections: [
      {
        stage: "method",
        title: "Rows and columns carry meaning",
        paragraphs: [
          "Add across a row for the total of everything one row describes (one store, all items). Add down a column for the total of one item over all stores. A single entry is neither total.",
          "Name the dimensions with rows first: three rows and two columns is $3\\times2$, not $2\\times3$.",
        ],
      },
      {
        stage: "formal",
        title: "Notation",
        paragraphs: [
          "An $m\\times n$ matrix has $m$ rows and $n$ columns and $mn$ entries. The row sum is $\\sum_{j=1}^{n}a_{ij}$ and the column sum is $\\sum_{i=1}^{m}a_{ij}$.",
        ],
      },
    ],
    pitfalls: [
      "Row first, column second: $a_{23}$ is not $a_{32}$.",
      "Rows and columns are different totals; read the question to see which one it needs.",
      "The number of entries is not the dimensions.",
    ],
    parentGuide:
      "Make a small table of items in two rooms of your home. Ask the learner to write it as a matrix, then say what one entry and one column total mean.",
  },
  {
    id: "matrix-operations",
    title: "Adding, scaling and multiplying matrices",
    summary:
      "Add and scale matrices entry by entry. Multiply by pairing rows with columns, and check the dimensions first.",
    templateIds: ["matrix-operations"],
    objectives: [
      "Add, subtract and scale matrices.",
      "Multiply matrices and decide from dimensions whether a product is defined.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Entry by entry, and row by column",
        paragraphs: [
          "You need to read a matrix and multiply signed numbers. Two matrices with the same dimensions add by adding the entries in matching positions. A scalar, an ordinary number, multiplies every entry.",
          "Multiplication is different. The entry in row $i$, column $j$ of $AB$ pairs row $i$ of $A$ with column $j$ of $B$: multiply matching entries and add the products.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Let $A=\\begin{bmatrix}1&2&0\\\\3&-1&2\\end{bmatrix}$ and $B=\\begin{bmatrix}2&1\\\\0&3\\\\1&-1\\end{bmatrix}$. Find $AB$, and say whether $BA$ is defined and what its dimensions are.",
      steps: [
        "$A$ is $2\\times3$ and $B$ is $3\\times2$. The columns of $A$ (3) equal the rows of $B$ (3), so $AB$ is defined and is $2\\times2$.",
        "Row 1 with column 1: $1\\cdot2+2\\cdot0+0\\cdot1=2$. Row 1 with column 2: $1\\cdot1+2\\cdot3+0\\cdot(-1)=7$.",
        "Row 2 with column 1: $3\\cdot2+(-1)\\cdot0+2\\cdot1=8$. Row 2 with column 2: $3\\cdot1+(-1)\\cdot3+2\\cdot(-1)=-2$.",
        "$BA$ pairs the 2 columns of $B$ with the 2 rows of $A$, so it is defined, with the 3 rows of $B$ and 3 columns of $A$: $3\\times3$.",
      ],
      answer:
        "$AB=\\begin{bmatrix}2&7\\\\8&-2\\end{bmatrix}$; $BA$ is defined and is $3\\times3$",
    },
    closingSections: [
      {
        stage: "method",
        title: "Check dimensions, then compute",
        paragraphs: [
          "Write the dimensions side by side, $(m\\times n)(n\\times p)$. The two inside numbers must match; the outside numbers $m\\times p$ are the dimensions of the product. If the inside numbers differ, the product is not defined.",
          "For $kA\\pm B$, multiply $A$ by $k$ first, then add or subtract matching entries of $B$.",
        ],
      },
      {
        stage: "formal",
        title: "Definitions",
        paragraphs: [
          "For equal dimensions, $(A+B)_{ij}=a_{ij}+b_{ij}$ and $(kA)_{ij}=ka_{ij}$. If $A$ is $m\\times n$ and $B$ is $n\\times p$, then $(AB)_{ij}=\\sum_{k=1}^{n}a_{ik}b_{kj}$ and $AB$ is $m\\times p$.",
        ],
      },
    ],
    pitfalls: [
      "A product is not the product of matching entries.",
      "Each entry of a product adds one product for every column of the left matrix.",
      "$AB$ and $BA$ may differ in size, or one of them may not be defined.",
    ],
    parentGuide:
      "Ask the learner to say which row and which column produce one entry of the product, and why a $2\\times3$ times a $2\\times3$ cannot be multiplied.",
  },
  {
    id: "matrix-laws",
    title: "Matrix products: order matters",
    summary:
      "Matrix multiplication is associative and distributive and has an identity, but $AB$ and $BA$ are usually different.",
    templateIds: ["matrix-laws"],
    objectives: [
      "Compute $AB$ and $BA$ and show that they can differ.",
      "Identify the identity matrix and decide which matrix laws always hold.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "The one number rule that fails",
        paragraphs: [
          "You need to multiply $2\\times2$ matrices by pairing rows with columns. For numbers, $3\\cdot5=5\\cdot3$. For matrices the order of the factors changes which rows meet which columns, so $AB$ and $BA$ usually differ. The identity matrix $I$ has ones on the main diagonal and zeros elsewhere, and it leaves a matrix unchanged: $IA=AI=A$.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Let $A=\\begin{bmatrix}1&2\\\\0&1\\end{bmatrix}$ and $B=\\begin{bmatrix}1&0\\\\3&1\\end{bmatrix}$. Compute $AB$ and $BA$ and compare them.",
      steps: [
        "$AB$: row 1 of $A$ with the columns of $B$ gives $1\\cdot1+2\\cdot3=7$ and $1\\cdot0+2\\cdot1=2$; row 2 gives $0\\cdot1+1\\cdot3=3$ and $0\\cdot0+1\\cdot1=1$. So $AB=\\begin{bmatrix}7&2\\\\3&1\\end{bmatrix}$.",
        "$BA$: row 1 of $B$ gives $1\\cdot1+0\\cdot0=1$ and $1\\cdot2+0\\cdot1=2$; row 2 gives $3\\cdot1+1\\cdot0=3$ and $3\\cdot2+1\\cdot1=7$. So $BA=\\begin{bmatrix}1&2\\\\3&7\\end{bmatrix}$.",
        "The $(1,1)$ entries are 7 and 1, so the products are different.",
      ],
      answer: "$AB\\ne BA$",
    },
    closingSections: [
      {
        stage: "method",
        title: "Which laws hold",
        paragraphs: [
          "These always hold when the products are defined: $(AB)C=A(BC)$, $A(B+C)=AB+AC$, $(A+B)C=AC+BC$ and $IA=AI=A$.",
          "These do not always hold: $AB=BA$; $(A+B)^2=A^2+2AB+B^2$ (the middle is $AB+BA$); and cancelling, since $AB=AC$ does not force $B=C$. A product can also be the zero matrix when neither factor is: $\\begin{bmatrix}1&0\\\\0&0\\end{bmatrix}\\begin{bmatrix}0&0\\\\0&1\\end{bmatrix}$ is the zero matrix.",
        ],
      },
      {
        stage: "formal",
        title: "Justification",
        paragraphs: [
          "One counterexample proves a law is not always true; the example above is one for commutativity. The laws that hold follow from the definition $(AB)_{ij}=\\sum_k a_{ik}b_{kj}$, since sums and products of numbers are associative and distributive.",
        ],
      },
    ],
    pitfalls: [
      "Do not swap factors. Compute each order separately.",
      "Some pairs do commute, so test the specific matrices.",
      "The identity is $I$ with ones on the diagonal, not a matrix of all ones.",
    ],
    parentGuide:
      "Ask the learner to compute both orders for any two $2\\times2$ matrices with small entries, and to point to the first entry that differs.",
  },
  {
    id: "matrix-inverse-determinant",
    title: "Determinants and inverses of 2×2 matrices",
    summary:
      "The determinant $ad-bc$ tells whether a $2\\times2$ matrix has an inverse and gives the inverse's formula.",
    templateIds: ["matrix-inverse-determinant"],
    objectives: [
      "Compute a $2\\times2$ determinant and decide whether the inverse exists.",
      "Find the inverse of an invertible $2\\times2$ matrix exactly.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Undoing a matrix",
        paragraphs: [
          "You need to multiply $2\\times2$ matrices and work with fractions. The inverse of a matrix $A$, written $A^{-1}$, is the matrix that undoes it: $AA^{-1}$ and $A^{-1}A$ both equal the identity matrix $I$. Not every matrix has one. For $\\begin{bmatrix}a&b\\\\c&d\\end{bmatrix}$ the determinant $ad-bc$ decides: an inverse exists exactly when it is not 0.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Find the determinant and the inverse of $A=\\begin{bmatrix}2&1\\\\4&3\\end{bmatrix}$, and check the result.",
      steps: [
        "$\\det A=2\\cdot3-1\\cdot4=2$, which is not 0, so $A^{-1}$ exists.",
        "Swap the diagonal entries and change the signs of the others: $\\begin{bmatrix}3&-1\\\\-4&2\\end{bmatrix}$.",
        "Divide every entry by 2: $A^{-1}=\\begin{bmatrix}\\frac{3}{2}&-\\frac{1}{2}\\\\-2&1\\end{bmatrix}$.",
        "Check row 1 of $A$ with column 1: $2\\cdot\\frac{3}{2}+1\\cdot(-2)=1$; with column 2: $2\\cdot(-\\frac{1}{2})+1\\cdot1=0$. Row 2 gives 0 and 1, so $AA^{-1}=I$.",
      ],
      answer:
        "$\\det A=2$ and $A^{-1}=\\begin{bmatrix}\\frac{3}{2}&-\\frac{1}{2}\\\\-2&1\\end{bmatrix}$",
    },
    closingSections: [
      {
        stage: "method",
        title: "When there is no inverse",
        paragraphs: [
          "For $\\begin{bmatrix}2&4\\\\1&2\\end{bmatrix}$ the determinant is $2\\cdot2-4\\cdot1=0$. The second row is half the first, so the rows carry no independent information, and no matrix can undo it. When a matrix contains a letter, set $ad-bc=0$ and solve for the letter to find where it has no inverse.",
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
      "Swap only $a$ and $d$; change the signs of only $b$ and $c$.",
      "Divide every entry by the determinant, and keep fractions exact.",
    ],
    parentGuide:
      "Ask the learner to multiply $A$ by the claimed inverse and see the identity. Ask what goes wrong when the determinant is 0.",
  },
  {
    id: "matrix-transformation",
    title: "Matrices that move points",
    summary:
      "A $2\\times2$ matrix sends each point to a new point. Its columns show where $(1,0)$ and $(0,1)$ land, and its determinant scales areas.",
    templateIds: ["matrix-transformation"],
    objectives: [
      "Apply a $2\\times2$ matrix to a point.",
      "Identify rotation, reflection and dilation matrices and use $|\\det|$ for area.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "A matrix as a machine on the plane",
        paragraphs: [
          "You need to multiply a $2\\times2$ matrix by a column. A point $(x,y)$ can be written as the column $\\begin{bmatrix}x\\\\y\\end{bmatrix}$. Multiplying by a $2\\times2$ matrix $M$ gives a new column, the image of the point. Doing this to every point of a figure turns, flips or stretches the whole figure.",
          "The first column of $M$ is where $(1,0)$ goes and the second column is where $(0,1)$ goes. That tells you what any matrix does.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "The matrix $R=\\begin{bmatrix}0&-1\\\\1&0\\end{bmatrix}$ rotates points $90^\\circ$ counterclockwise about the origin. Where does it send $(3,2)$? Then a triangle of area 5 is transformed by $N=\\begin{bmatrix}2&1\\\\-1&3\\end{bmatrix}$. What is the area of the image?",
      steps: [
        "$R\\begin{bmatrix}3\\\\2\\end{bmatrix}=\\begin{bmatrix}0\\cdot3+(-1)\\cdot2\\\\1\\cdot3+0\\cdot2\\end{bmatrix}=\\begin{bmatrix}-2\\\\3\\end{bmatrix}$, so $(3,2)$ goes to $(-2,3)$.",
        "Check with the columns: $(1,0)$ goes to $(0,1)$ and $(0,1)$ goes to $(-1,0)$, a counterclockwise quarter turn.",
        "$\\det N=2\\cdot3-1\\cdot(-1)=7$, so areas are multiplied by $|7|=7$.",
        "The image area is $7\\cdot5=35$.",
      ],
      answer: "$(-2,3)$; area 35",
    },
    closingSections: [
      {
        stage: "method",
        title: "Standard matrices",
        paragraphs: [
          "Find the images of $(1,0)$ and $(0,1)$ and use them as columns. Rotation by $90^\\circ$ counterclockwise: $\\begin{bmatrix}0&-1\\\\1&0\\end{bmatrix}$. Reflection across the $x$-axis: $\\begin{bmatrix}1&0\\\\0&-1\\end{bmatrix}$. Dilation by factor $k$ from the origin: $\\begin{bmatrix}k&0\\\\0&k\\end{bmatrix}$.",
          "A negative determinant reverses orientation, as a reflection does; the area factor is the absolute value. A determinant of 0 flattens the figure onto a line or a point, so its area becomes 0.",
        ],
      },
      {
        stage: "formal",
        title: "Statement",
        paragraphs: [
          "The matrix $M=\\begin{bmatrix}a&b\\\\c&d\\end{bmatrix}$ sends the unit square to the parallelogram spanned by $(a,c)$ and $(b,d)$, whose area is $|ad-bc|$. Because $M$ treats every region by scaling in this way, it multiplies every area by $|\\det M|$.",
        ],
      },
    ],
    pitfalls: [
      "Multiply rows of the matrix by the column, not columns.",
      "Area is multiplied by $|\\det M|$ once: do not square it and do not keep a negative sign.",
      "A zero determinant gives zero area, not the original area.",
    ],
    parentGuide:
      "Ask the learner to find where $(1,0)$ and $(0,1)$ go under a matrix, then predict where $(2,3)$ goes before multiplying.",
  },
  {
    id: "matrix-linear-system",
    title: "Solving a linear system with a matrix inverse",
    summary:
      "A pair of linear equations becomes one matrix equation $AX=B$. When $A$ has an inverse, $X=A^{-1}B$.",
    templateIds: ["matrix-linear-system"],
    objectives: [
      "Write a $2\\times2$ linear system as $AX=B$.",
      "Solve it with $A^{-1}$ and recognize when the determinant is 0.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Two equations in one",
        paragraphs: [
          "You need to solve a linear system and find a $2\\times2$ inverse. The two equations $2x+y=7$ and $x+3y=11$ can be written as one equation: the coefficient matrix $A$ holds the coefficients, one equation per row; the column $X$ holds $x$ and $y$; the column $B$ holds the right sides. Multiplying out $AX$ gives the left sides of the equations.",
          "If $A$ has an inverse, multiplying both sides by $A^{-1}$ on the left leaves $X$ alone: $X=A^{-1}B$.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Write $2x+y=7$ and $x+3y=11$ as $AX=B$ and solve for $x$ and $y$.",
      steps: [
        "$A=\\begin{bmatrix}2&1\\\\1&3\\end{bmatrix}$, $X=\\begin{bmatrix}x\\\\y\\end{bmatrix}$ and $B=\\begin{bmatrix}7\\\\11\\end{bmatrix}$.",
        "$\\det A=2\\cdot3-1\\cdot1=5$, which is not 0, so $A^{-1}=\\dfrac{1}{5}\\begin{bmatrix}3&-1\\\\-1&2\\end{bmatrix}$.",
        "$X=A^{-1}B=\\dfrac{1}{5}\\begin{bmatrix}3\\cdot7-11\\\\-7+2\\cdot11\\end{bmatrix}=\\dfrac{1}{5}\\begin{bmatrix}10\\\\15\\end{bmatrix}=\\begin{bmatrix}2\\\\3\\end{bmatrix}$.",
        "Check: $2\\cdot2+3=7$ and $2+3\\cdot3=11$.",
      ],
      answer: "$x=2$, $y=3$",
    },
    closingSections: [
      {
        stage: "method",
        title: "When the determinant is 0",
        paragraphs: [
          "For $x+2y=5$ and $2x+4y=3$, $A=\\begin{bmatrix}1&2\\\\2&4\\end{bmatrix}$ has $\\det A=1\\cdot4-2\\cdot2=0$. The left sides are proportional, so no inverse exists and there is no unique solution; here the system has none, since the second equation would force $x+2y=1.5$.",
          "Before using an inverse, compute the determinant. If it is 0, the matrix method does not give one solution.",
        ],
      },
      {
        stage: "formal",
        title: "Statement",
        paragraphs: [
          "If $\\det A\\ne0$, then $A^{-1}(AX)=(A^{-1}A)X=X$, so $AX=B$ implies $X=A^{-1}B$, and this $X$ satisfies the system. If $\\det A=0$, $A$ has no inverse and the system has no solution or infinitely many.",
        ],
      },
    ],
    pitfalls: [
      "Put the constants in $B$, with signs changed if they move across the equals sign.",
      "Write the inverse on the left: $A^{-1}B$, not $BA^{-1}$.",
      "Apply the $\\frac{1}{\\det A}$ factor to every entry of the product.",
    ],
    parentGuide:
      "Ask the learner to substitute the final $x$ and $y$ back into both equations, and to explain why the check does not need the matrix.",
  },
];
