import type { FacetMapping } from "./coverage";
import { workContent, type WorkEntry } from "./structured-work-lesson-kit";

const senses = { matrix: "matrix", matrices: "matrix" };
const noLink = [
  "vector",
  "entry",
  "entries",
  "size",
  "column",
  "columns",
  "row",
  "rows",
];

const entries: WorkEntry[] = [
  {
    id: "system-to-matrix-equation",
    title: "Write a system of equations as one matrix equation",
    goal: "Write a system of linear equations as one matrix equation $AX=B$ by filling in the coefficient matrix $A$ and the constant column $B$.",
    summary:
      "A system of linear equations can be written as one equation, $AX=B$. $X$ is a single column listing the unknowns. $A$ is a grid of numbers, a matrix, holding the coefficients: one row per equation and one column per unknown. $B$ is a column of the constants.",
    senses,
    noLink,
    objectives: [
      "Rewrite each equation with the unknowns in a fixed order on the left and the constant on the right, changing the sign of every term that crosses the equals sign.",
      "Fill in $A$ row by row from the equations, with 0 for a missing unknown, fill in $B$ from the constants, and check by multiplying each row of $A$ by $X$.",
    ],
    background: [
      {
        title: "One equation for the whole system",
        paragraphs: [
          "The system $2x-y=17$ and $8x+5y=-8$ has two unknowns, $x$ and $y$. Stack them in one column, $X=\\begin{bmatrix}x\\\\y\\end{bmatrix}$. This column is called the vector variable: one symbol that stands for all the unknowns at once.",
          "Multiplying a row of numbers by the column $X$ pairs them up and adds: $\\begin{bmatrix}2&-1\\end{bmatrix}X=2x-y$. So the matrix $A=\\begin{bmatrix}2&-1\\\\8&5\\end{bmatrix}$ times $X$ gives both left sides, and $AX=B$ with $B=\\begin{bmatrix}17\\\\-8\\end{bmatrix}$ says both equations at once.",
        ],
      },
    ],
    intuition:
      "In $AX=B$, row $i$ of $A$ times the column $X$ must give the left side of equation $i$, and entry $i$ of $B$ is its right side. So the order of the unknowns in $X$ fixes the order of the columns of $A$. Each equation first needs its unknowns on the left, in that order, and its constant on the right. A term that crosses the equals sign changes sign. An unknown that is missing from an equation still has a place in that row, holding 0.",
    terms: ["system-of-equations", "matrix", "coefficient", "constant"],
    method: [
      "Fix the order of the unknowns in $X$, for example $x$ then $y$.",
      "Rewrite each equation with the unknowns in that order on the left and the constant on the right. Change the sign of each term that crosses the equals sign.",
      "Copy each equation's coefficients across one row of $A$, writing 0 for a missing unknown. Put its constant in the same row of $B$.",
      "Check: each row of $A$ times $X$ must give the left side of its equation.",
    ],
    watch:
      "Read each equation across a row of $A$, in the order of $X$, and keep the constants out of $A$. A term moved across the equals sign changes sign; a constant only changes sign when it crosses.",
    principle:
      "For unknowns $x_1,\\dots,x_n$, the system $a_{i1}x_1+\\dots+a_{in}x_n=b_i$ ($i=1,\\dots,m$) is the single equation $AX=B$, where $A$ is the $m\\times n$ matrix of the $a_{ij}$, $X$ is the $n\\times1$ column of unknowns, and $B$ is the $m\\times1$ column of the $b_i$.",
    example: {
      prompt:
        "Write the system $3x=7-2y$ and $x-4y=5$ as $AX=B$ with $X=\\begin{bmatrix}x\\\\y\\end{bmatrix}$.",
      steps: [
        "$X=\\begin{bmatrix}x\\\\y\\end{bmatrix}$, so column 1 of $A$ holds coefficients of $x$ and column 2 holds coefficients of $y$.",
        "Equation 1, $3x=7-2y$: move $-2y$ to the left, where it becomes $+2y$: $3x+2y=7$.",
        "Equation 2, $x-4y=5$, is already in order. The coefficient of $x$ is 1.",
        "So $A=\\begin{bmatrix}3&2\\\\1&-4\\end{bmatrix}$ and $B=\\begin{bmatrix}7\\\\5\\end{bmatrix}$.",
        "Check: row 1 times $X$ is $3\\cdot x+2\\cdot y=3x+2y$, the left side of equation 1 after the rewrite.",
      ],
      answer:
        "$\\begin{bmatrix}3&2\\\\1&-4\\end{bmatrix}\\begin{bmatrix}x\\\\y\\end{bmatrix}=\\begin{bmatrix}7\\\\5\\end{bmatrix}$",
    },
    methodTitle: "Rewrite first, then copy",
    methodText: [
      "Copying numbers straight from an equation as it is written goes wrong when a term sits on the other side or the terms are out of order. Rewrite the equation first, then copy its coefficients.",
      "The sizes follow from the system: $m$ equations in $n$ unknowns give an $m\\times n$ matrix $A$, an $n\\times1$ column $X$ and an $m\\times1$ column $B$.",
    ],
    formal:
      "The product of an $m\\times n$ matrix and an $n\\times1$ column is the $m\\times1$ column whose entry $i$ is row $i$ times the column. So $AX=B$ holds exactly when every one of its $m$ entries matches, which is exactly when every equation of the system holds.",
    pitfalls: [
      "Writing an equation's coefficients down a column of $A$ instead of across a row.",
      "Putting the constants into $A$ as an extra column: $A$ holds coefficients only.",
      "Leaving out the 0 for a missing unknown, so a later coefficient slides into the wrong column.",
    ],
    parentGuide:
      "Ask your learner to say what row 1 of $A$ times $X$ gives. If it is not the left side of equation 1, something is in the wrong place.",
  },
  {
    id: "matrix-equation-reading",
    title: "Read a matrix equation as a system of equations",
    goal: "Read a matrix equation $AX=B$ back as its system of equations, find a slip in someone's $A$ and $B$, or test a vector $X$ by multiplying.",
    summary:
      "Each row of the matrix $A$ times the column of unknowns $X$ gives the left side of one equation, and the matching entry of $B$ is its right side. Reading $AX=B$ row by row gives back the system, and substituting numbers for $X$ tests a possible solution.",
    senses,
    noLink,
    objectives: [
      "Turn each row of $A$ into an equation by pairing its entries with the unknowns of $X$ and setting the sum equal to the matching entry of $B$.",
      "Decide whether a vector solves $AX=B$ by multiplying each row of $A$ by it and comparing every entry with $B$.",
    ],
    intuition:
      "A matrix equation is a system written compactly. The entry in row $i$, column $j$ of $A$ is the coefficient of the $j$th unknown in equation $i$. A 0 means that unknown is missing from that equation. A solution is a column of numbers that can replace $X$. It works only when every entry of $AX$ equals the matching entry of $B$.",
    terms: ["matrix", "matrix-product", "system-of-equations", "coefficient"],
    method: [
      "Take one row of $A$ at a time and pair its entries, in order, with the unknowns in $X$.",
      "Add the products and set the sum equal to the same row of $B$. Leave out a term whose coefficient is 0.",
      "To test a vector, multiply each row of $A$ by it and compare every entry with $B$.",
    ],
    watch:
      "Read across the rows of $A$, not down the columns, and keep each constant's sign exactly as $B$ shows it. To test a vector, compare every entry of $AX$ with $B$, not only the first.",
    principle:
      "The entry in row $i$, column $j$ of $A$ is the coefficient of the $j$th unknown in the $i$th equation, and $(AX)_i=a_{i1}x_1+\\dots+a_{in}x_n$. A vector $X_0$ is a solution exactly when $AX_0=B$ entry by entry.",
    example: {
      prompt:
        "Which system does $\\begin{bmatrix}2&0&5\\\\1&-3&4\\\\0&6&-1\\end{bmatrix}\\begin{bmatrix}x\\\\y\\\\z\\end{bmatrix}=\\begin{bmatrix}7\\\\-2\\\\3\\end{bmatrix}$ represent?",
      steps: [
        "Row 1: $2\\cdot x+0\\cdot y+5\\cdot z=7$. The 0 means $y$ is missing: $2x+5z=7$.",
        "Row 2: $1\\cdot x+(-3)\\cdot y+4\\cdot z=-2$, so $x-3y+4z=-2$.",
        "Row 3: $0\\cdot x+6\\cdot y+(-1)\\cdot z=3$, so $6y-z=3$.",
        "Reading down column 1 instead, $2x+y+0z$, would mix coefficients from three different equations.",
      ],
      answer: "$2x+5z=7$, $x-3y+4z=-2$ and $6y-z=3$",
    },
    methodTitle: "Rows are equations, columns are unknowns",
    methodText: [
      "Every row of $A$ is one equation and every column belongs to one unknown, so the entry in row 2, column 3 is the coefficient of $z$ in equation 2.",
      "When you check someone's matrix equation, rewrite the system yourself first and then compare entry by entry. The first difference names the slip.",
    ],
    formal:
      "Matrix multiplication is defined so that $(AX)_i=\\sum_j a_{ij}x_j$. With $X$ the column of unknowns, the $m$ entries of $AX=B$ are the $m$ equations of the system, so solving the matrix equation and solving the system are the same task.",
    pitfalls: [
      "Reading a column of $A$ as an equation.",
      "Dropping a 0 from a row and sliding the next coefficient onto the wrong unknown.",
      "Calling a vector a solution after checking only the first entry of $AX$.",
    ],
    parentGuide:
      "Point to one entry of $A$ and ask your learner which equation and which unknown it belongs to.",
  },
];

export const matrixEquationSystemContent = workContent(entries);

export const matrixEquationSystemFacetMappings: FacetMapping[] = [
  {
    templateId: "system-to-matrix-equation",
    facetId: "matrix-systems.HSA.REI.C.8",
    extent: "partial",
    rationale:
      "Enter the coefficient matrix and constant column of a 2×2 system given X and the row order, from aligned systems and systems with one equation rearranged (a term or constant on the other side, terms out of order, a missing unknown), or the sizes of A, X and B for 2 or 3 equations in 2 or 3 unknowns. Does not assess entering a 3×3 system or choosing the order of the unknowns.",
  },
  {
    templateId: "system-to-matrix-equation",
    facetId: "matrix-systems.core",
    extent: "partial",
    rationale:
      "Write a 2×2 system as AX = B by entering A and B, and size A, X and B. Does not assess solving with an inverse.",
  },
  {
    templateId: "matrix-equation-reading",
    facetId: "matrix-systems.HSA.REI.C.8",
    extent: "partial",
    rationale:
      "Read a 2×2 or 3×3 matrix equation back as its system, one equation or one coefficient (including a 0), name the slip in a student's A and B (transposed rows, constants in A, a moved term's or constant's sign, coefficients out of order, a missing 0), and test a vector X by multiplying out AX. Choices, not written work.",
  },
  {
    templateId: "matrix-equation-reading",
    facetId: "matrix-systems.core",
    extent: "partial",
    rationale:
      "Interpret AX = B as a system and test a candidate solution vector by matrix multiplication. Does not assess solving with an inverse.",
  },
];
