## Introduction to Matrices and Basic Matrix Operations

Matrices are rectangular arrays of numbers arranged in rows and columns. They are used to organize data and perform calculations in many fields including finance, engineering, and computer science. Matrices allow us to handle multiple numbers at once in an organized structure.

> A matrix is a compact way to represent and manipulate sets of data.

### Matrix Notation and Structure

A matrix with $m$ rows and $n$ columns is written as

$$
A = \begin{pmatrix}
a_{11} & a_{12} & \cdots & a_{1n} \\
a_{21} & a_{22} & \cdots & a_{2n} \\
\vdots & \vdots & \ddots & \vdots \\
a_{m1} & a_{m2} & \cdots & a_{mn}
\end{pmatrix}
$$

Each number $a_{ij}$ is called an element, where $i$ identifies the row and $j$ the column. This notation gives us precise positions for each number, which helps in carrying out operations like addition, subtraction, and multiplication.

### Matrix Addition and Subtraction

Matrix addition is performed by adding corresponding elements from two matrices of the same dimensions. Similarly, subtraction involves subtracting corresponding elements. It is important that both matrices have the same number of rows and columns; otherwise, the operation is not defined.

For example, let

$$
A = \begin{pmatrix} 2 & 5 \\ 3 & 4 \end{pmatrix} \quad \text{and} \quad B = \begin{pmatrix} 1 & -2 \\ 0 & 3 \end{pmatrix}.
$$

Then, the sum $A+B$ is computed element by element as

$$
A+B = \begin{pmatrix} 2+1 & 5+(-2) \\ 3+0 & 4+3 \end{pmatrix} = \begin{pmatrix} 3 & 3 \\ 3 & 7 \end{pmatrix}.
$$

This element-wise operation helps combine data from similar datasets, such as summing daily profits across different branches in finance.

### Scalar Multiplication

Scalar multiplication involves multiplying every element of a matrix by a constant number, called a scalar. This process scales the matrix and adjusts the magnitude of its data.

For example, if $k=3$ and

$$
C = \begin{pmatrix} 4 & -1 \\ 2 & 6 \end{pmatrix},
$$

then multiplying $C$ by $k$ gives

$$
kC = \begin{pmatrix} 3\times4 & 3\times(-1) \\ 3\times2 & 3\times6 \end{pmatrix} = \begin{pmatrix} 12 & -3 \\ 6 & 18 \end{pmatrix}.
$$

In real-world applications, scalar multiplication can represent adjusting measurements by a constant factor, such as increasing all salary figures by a fixed percentage.

### Matrix Multiplication

![Matrix multiplication heatmap visualization of matrices $D$, $E$, and product $DE$.](images/plot_1_09-04-lesson-introduction-to-matrices-and-basic-matrix-operations.md.png)

Matrix multiplication is a more complex operation. It is defined only if the number of columns in the first matrix equals the number of rows in the second matrix. The element in the $i$th row and $j$th column of the product matrix is obtained by taking the dot product of the $i$th row of the first matrix and the $j$th column of the second matrix.

For example, let

$$
D = \begin{pmatrix} 1 & 2 \\ 3 & 4 \end{pmatrix} \quad \text{and} \quad E = \begin{pmatrix} 5 & 6 \\ 7 & 8 \end{pmatrix}.
$$

The product $DE$ is computed as follows:

$$
DE = \begin{pmatrix}
(1\times5 + 2\times7) & (1\times6 + 2\times8) \\
(3\times5 + 4\times7) & (3\times6 + 4\times8)
\end{pmatrix} = \begin{pmatrix}
19 & 22 \\
43 & 50
\end{pmatrix}.
$$

Each entry is calculated by multiplying corresponding elements and summing the products. This process is particularly useful when combining information from different sources, such as transforming coordinates in computer graphics.

### Real-World Applications

Matrices are used in various real-world scenarios:

- In finance, matrices can represent and analyze investment portfolios or model cash flows.

- In engineering, matrices model forces and transformations in structures.

- In computer graphics, matrices transform coordinates to render images accurately.

Understanding these operations is essential for solving systems of equations, optimizing problems, and analyzing data in many fields. Mastering these basic matrix operations lays the groundwork for advanced topics such as determinants, inverses, and solving systems using matrix methods.
