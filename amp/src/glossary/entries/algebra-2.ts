import type { GlossaryEntry } from "../types";

/** Complex numbers, radicals and rational exponents, polynomials, matrices and vectors. */
export const algebra2Entries: GlossaryEntry[] = [
  {
    id: "argument",
    term: "argument",
    forms: ["argument"],
    plain:
      "The angle, turning counterclockwise from the positive real axis, of the arrow from 0 to a complex number.",
    example: "$1+i$ has argument $45^\\circ$.",
    uses: ["angle", "complex-number"],
    band: "precalculus",
    autoLink: false,
  },
  {
    id: "binomial",
    term: "binomial",
    forms: ["binomial", "binomials"],
    plain: "An expression with exactly two terms, such as $x-3$ or $2x+5y$.",
    uses: ["expression", "term-expression"],
    band: "algebra-1",
  },
  {
    id: "binomial-coefficient",
    term: "binomial coefficient",
    forms: ["binomial coefficient", "binomial coefficients"],
    plain:
      "The number $\\binom{n}{k}$ of ways to choose $k$ items from $n$. It is also a coefficient of $(a+b)^n$ multiplied out.",
    example: "$\\binom{4}{2}=6$, and $(a+b)^4$ has the term $6a^2b^2$.",
    uses: ["coefficient", "term-expression"],
    band: "precalculus",
  },
  {
    id: "complex-conjugate",
    term: "complex conjugate",
    forms: [
      "complex conjugate",
      "complex conjugates",
      "conjugate",
      "conjugates",
      "conjugate pair",
      "conjugate pairs",
    ],
    plain:
      "Two complex numbers with the same real part and opposite imaginary parts. The conjugate of $a+bi$ is $a-bi$.",
    example: "$3+2i$ and $3-2i$ are conjugates; their product is 9 + 4 = 13.",
    uses: [
      "complex-number",
      "real-part",
      "imaginary-part",
      "opposite-number",
      "product-multiply",
    ],
    band: "algebra-2",
  },
  {
    id: "complex-number",
    term: "complex number",
    forms: ["complex number", "complex numbers"],
    plain:
      "A number $a+bi$, where $a$ and $b$ are real numbers and $i$ is the imaginary unit, with $i^2=-1$.",
    example: "$3-4i$ and $5i$ are complex numbers; so is 7, with $b=0$.",
    uses: ["real-number", "imaginary-unit"],
    band: "algebra-2",
  },
  {
    id: "component",
    term: "component",
    forms: ["component", "components"],
    plain:
      "One of the two numbers of a vector $\\langle a,b\\rangle$: $a$ is the change across and $b$ the change up or down.",
    example:
      "From (1, 2) to (4, 7) the components are 3 and 5, written $\\langle 3,5\\rangle$.",
    uses: ["vector", "change"],
    band: "geometry",
  },
  {
    id: "cube-root",
    term: "cube root",
    forms: ["cube root", "cube roots"],
    plain:
      "The number that, multiplied by itself three times, gives the original number. It is written $\\sqrt[3]{a}$.",
    example: "$\\sqrt[3]{8}=2$ because 2 × 2 × 2 = 8, and $\\sqrt[3]{-8}=-2$.",
    uses: [],
    band: "8",
  },
  {
    id: "determinant",
    term: "determinant",
    forms: ["determinant", "determinants"],
    plain:
      "A number worked out from a square matrix. For $\\begin{bmatrix}a&b\\\\c&d\\end{bmatrix}$ it is $ad-bc$.",
    example:
      "$\\begin{bmatrix}3&1\\\\4&2\\end{bmatrix}$ has determinant 3 × 2 − 1 × 4 = 2.",
    uses: ["matrix"],
    band: "precalculus",
    noLink: ["square"],
  },
  {
    id: "dot-product",
    term: "dot product",
    forms: ["dot product", "dot products"],
    plain:
      "A number made from two vectors by multiplying matching components and adding: $\\langle a,b\\rangle\\cdot\\langle c,d\\rangle=ac+bd$. It is 0 exactly when they are perpendicular.",
    example: "$\\langle 2,3\\rangle\\cdot\\langle 4,-1\\rangle=8-3=5$.",
    uses: ["vector", "component", "perpendicular"],
    band: "geometry",
  },
  {
    id: "excluded-value",
    term: "excluded value",
    forms: [
      "excluded value",
      "excluded values",
      "excluded input",
      "excluded inputs",
    ],
    plain:
      "An input that makes a denominator 0. The expression or equation is undefined there, so that value can never be a solution.",
    example: "In $\\frac{5}{x-3}$, the excluded value is $x=3$.",
    uses: ["input", "denominator", "expression", "equation", "solution"],
    band: "algebra-2",
  },
  {
    id: "extraneous-solution",
    term: "extraneous solution",
    forms: [
      "extraneous solution",
      "extraneous solutions",
      "extraneous root",
      "extraneous roots",
      "extraneous candidate",
      "extraneous candidates",
    ],
    plain:
      "A value found while solving, often after squaring both sides or clearing fractions, that does not work in the original equation. Check and reject it.",
    example:
      "Squaring $\\sqrt{x}=-3$ gives $x=9$, but $\\sqrt{9}=3$, not −3, so 9 is extraneous.",
    uses: ["fraction", "equation", "square-number", "side-of-equation"],
    band: "algebra-1",
  },
  {
    id: "extrapolation",
    term: "extrapolation",
    forms: ["extrapolation", "extrapolate"],
    plain:
      "Predicting for inputs outside the range of the data. It is risky because the pattern may not continue there.",
    example:
      "Heights measured from ages 5 to 12 cannot reliably predict height at age 40.",
    uses: ["input", "range-statistics", "data", "pattern", "height"],
    band: "precalculus",
  },
  {
    id: "identity-matrix",
    term: "identity matrix",
    forms: ["identity matrix", "identity matrices"],
    plain:
      "A square matrix with 1s down the main diagonal and 0s everywhere else. Multiplying by it leaves any matrix unchanged.",
    example: "$I=\\begin{bmatrix}1&0\\\\0&1\\end{bmatrix}$, and $IA=AI=A$.",
    uses: ["matrix", "diagonal"],
    band: "precalculus",
    noLink: ["square", "leaves"],
  },
  {
    id: "imaginary-part",
    term: "imaginary part",
    forms: ["imaginary part", "imaginary parts"],
    plain:
      "In the complex number $a+bi$, the real number $b$ that multiplies $i$.",
    example: "The imaginary part of $4-7i$ is −7, not $-7i$.",
    uses: ["complex-number", "real-number"],
    band: "algebra-2",
  },
  {
    id: "imaginary-unit",
    term: "imaginary unit",
    forms: ["imaginary unit"],
    plain:
      "The number $i$, defined by $i^2=-1$. No real number squares to a negative number, so $i$ is a new kind of number.",
    example: "$i^2=-1$, so $\\sqrt{-9}=3i$.",
    uses: ["real-number", "square-number", "negative-number"],
    band: "algebra-2",
  },
  {
    id: "intersection",
    term: "intersection",
    forms: ["intersection", "intersections"],
    plain:
      "Written $A\\cap B$: the outcomes that are in both event $A$ and event $B$. It matches the word “and” in probability.",
    example: "Rolling a number cube, even ∩ greater than 3 is 4 and 6.",
    uses: [
      "outcome",
      "event",
      "probability",
      "even-number",
      "greater-than",
      "cube",
    ],
    band: "geometry",
    autoLink: false,
  },
  {
    id: "intersection-graphs",
    term: "intersection",
    forms: [
      "intersection",
      "intersections",
      "point of intersection",
      "points of intersection",
      "intersection point",
    ],
    plain:
      "A point where two graphs meet. Its coordinates make both equations true.",
    example: "$y=x+1$ and $y=3-x$ meet at the intersection (1, 2).",
    uses: ["point", "coordinate", "equation"],
    band: "8",
    autoLink: false,
  },
  {
    id: "interval-notation",
    term: "interval notation",
    forms: ["interval notation"],
    plain:
      "A way to write all the numbers between two endpoints: a parenthesis leaves an endpoint out, a square bracket includes it.",
    example:
      "$[2,5)$ means $2\\le x<5$; $(-\\infty,1)\\cup(3,\\infty)$ joins two separate pieces.",
    uses: ["parentheses"],
    band: "algebra-1",
    noLink: ["square", "leaves"],
  },
  {
    id: "inverse-matrix",
    term: "inverse matrix",
    forms: ["inverse matrix", "inverse matrices"],
    plain:
      "The matrix $A^{-1}$ that undoes $A$: $AA^{-1}=A^{-1}A=I$. It exists only when the determinant of $A$ is not 0.",
    example:
      "$\\begin{bmatrix}2&0\\\\0&4\\end{bmatrix}$ has inverse $\\begin{bmatrix}0.5&0\\\\0&0.25\\end{bmatrix}$.",
    uses: ["matrix", "determinant", "identity-matrix"],
    band: "precalculus",
    noLink: ["inverse"],
  },
  {
    id: "like-radicals",
    term: "like radicals",
    forms: ["like radicals", "like radical"],
    plain:
      "Radicals with the same kind of root and the same radicand, such as $3\\sqrt{2}$ and $5\\sqrt{2}$. They combine the way like terms do.",
    example:
      "$3\\sqrt{2}+5\\sqrt{2}=8\\sqrt{2}$, but $\\sqrt{2}+\\sqrt{3}$ cannot be combined.",
    uses: ["radical", "radicand", "like-terms", "root-radical"],
    band: "algebra-2",
  },
  {
    id: "magnitude",
    term: "magnitude",
    forms: ["magnitude"],
    plain:
      "The length of a vector, written $|\\mathbf{v}|$. For $\\langle a,b\\rangle$ it is $\\sqrt{a^2+b^2}$.",
    example: "$\\langle 3,4\\rangle$ has magnitude $\\sqrt{9+16}=5$.",
    uses: ["vector", "length"],
    band: "precalculus",
  },
  {
    id: "matrix",
    term: "matrix",
    forms: ["matrix", "matrices"],
    plain:
      "A grid of numbers arranged in rows and columns, written inside square brackets.",
    example:
      "$\\begin{bmatrix}1&2&3\\\\4&5&6\\end{bmatrix}$ has 2 rows and 3 columns, so it is a 2 × 3 matrix.",
    uses: [],
    band: "precalculus",
    noLink: ["square"],
  },
  {
    id: "matrix-product",
    term: "matrix product",
    forms: ["matrix product", "matrix products", "matrix multiplication"],
    plain:
      "The matrix $AB$. Its number in row $i$, column $j$ comes from multiplying row $i$ of $A$ by column $j$ of $B$, pair by pair, and adding.",
    example: "A row (1, 2) times a column (3, 4) gives 1 × 3 + 2 × 4 = 11.",
    uses: ["matrix"],
    band: "precalculus",
  },
  {
    id: "midline",
    term: "midline",
    forms: ["midline", "midlines"],
    plain:
      "The horizontal line halfway between the highest and lowest values of a wave-shaped graph.",
    example: "A wave that goes between 2 and 8 has midline $y=5$.",
    uses: ["horizontal-line"],
    band: "algebra-2",
  },
  {
    id: "modulus",
    term: "modulus",
    forms: ["modulus"],
    plain:
      "The distance from 0 to a complex number on the complex plane: $|a+bi|=\\sqrt{a^2+b^2}$.",
    example: "$|3+4i|=\\sqrt{9+16}=5$.",
    uses: ["distance", "complex-number", "plane"],
    band: "precalculus",
  },
  {
    id: "multiplicity",
    term: "multiplicity",
    forms: ["multiplicity", "multiplicities"],
    plain:
      "How many times a factor like $(x-r)$ repeats in a polynomial. Odd: the graph crosses the $x$-axis at $r$. Even: it touches and turns back.",
    example:
      "In $(x-2)^3(x+1)$, the zero 2 has multiplicity 3 and the zero −1 has multiplicity 1.",
    uses: [
      "factor-number",
      "polynomial",
      "x-axis",
      "zero-of-a-function",
      "odd-number",
      "even-number",
    ],
    band: "algebra-2",
  },
  {
    id: "nth-root",
    term: "nth root",
    forms: ["nth root", "nth roots", "root index"],
    plain:
      "The $n$th root of $a$, written $\\sqrt[n]{a}$, is a number whose $n$th power is $a$. For even $n$, it means the nonnegative one.",
    example:
      "$\\sqrt[4]{81}=3$ because $3^4=81$. The small 4 is the root index; a square root has index 2.",
    uses: ["root-radical", "square-root", "even-number"],
    band: "algebra-2",
    noLink: ["index"],
  },
  {
    id: "parabola",
    term: "parabola",
    forms: ["parabola", "parabolas"],
    plain:
      "The U-shaped curve that is the graph of a quadratic function. It opens up or down and is symmetric about a vertical line.",
    example:
      "$y=x^2$ is a parabola that opens up from its lowest point (0, 0).",
    uses: ["quadratic", "function", "vertical-line", "point", "symmetry"],
    band: "algebra-1",
  },
  {
    id: "parameter",
    term: "parameter",
    forms: ["parameter", "parameters"],
    plain:
      "A letter in a formula that stays fixed within one situation but can change from one situation to another.",
    example:
      "In $y=mx+b$, the parameters $m$ and $b$ pick out one line, while $x$ and $y$ vary.",
    uses: ["line"],
    band: "algebra-1",
    autoLink: false,
    noLink: ["change"],
  },
  {
    id: "parametric-equations",
    term: "parametric equations",
    forms: ["parametric equations", "parametric equation"],
    plain:
      "A pair of equations giving $x$ and $y$ separately in terms of a third variable, often time $t$, called the parameter.",
    example: "$x=2t$ and $y=t+1$: at $t=3$ the point is (6, 4).",
    uses: ["equation", "variable", "parameter", "point"],
    band: "precalculus",
    noLink: ["terms", "third"],
  },
  {
    id: "pascals-triangle",
    term: "Pascal's triangle",
    forms: ["pascal's triangle"],
    plain:
      "A triangle of numbers with 1 at each end of every row; each other number is the sum of the two above it. Row $n$ lists $\\binom{n}{0}$ to $\\binom{n}{n}$.",
    example: "Rows 0 to 4: 1; 1 1; 1 2 1; 1 3 3 1; 1 4 6 4 1.",
    uses: ["triangle", "sum", "binomial-coefficient"],
    band: "precalculus",
  },
  {
    id: "perfect-cube",
    term: "perfect cube",
    forms: ["perfect cube", "perfect cubes"],
    plain: "A number that is an integer multiplied by itself three times.",
    example: "8 = 2 × 2 × 2 and 27 = 3 × 3 × 3 are perfect cubes; so is −64.",
    uses: ["integer"],
    band: "algebra-2",
  },
  {
    id: "polar-form",
    term: "polar form",
    forms: ["polar form"],
    plain:
      "Writing a complex number by its distance from 0 and its angle: $r(\\cos\\theta+i\\sin\\theta)$, where $r$ is the modulus and $\\theta$ the argument.",
    example: "$1+i=\\sqrt{2}(\\cos 45^\\circ+i\\sin 45^\\circ)$.",
    uses: ["complex-number", "distance", "angle", "modulus", "argument"],
    band: "precalculus",
  },
  {
    id: "radicand",
    term: "radicand",
    forms: ["radicand", "radicands"],
    plain: "The number or expression written under the $\\sqrt{\\ }$ sign.",
    example:
      "In $5\\sqrt{12}$, the radicand is 12; in $\\sqrt{x-4}$ it is $x-4$.",
    uses: ["expression"],
    band: "8",
  },
  {
    id: "rational-equation",
    term: "rational equation",
    forms: ["rational equation", "rational equations"],
    plain:
      "An equation with a fraction that has the variable in its denominator.",
    example: "$\\frac{3}{x}+1=\\frac{5}{x}$ is a rational equation.",
    uses: ["equation", "fraction", "variable", "denominator"],
    band: "algebra-2",
  },
  {
    id: "rational-exponent",
    term: "rational exponent",
    forms: [
      "rational exponent",
      "rational exponents",
      "fractional exponent",
      "fractional exponents",
    ],
    plain:
      "An exponent that is a fraction. The bottom number names the root and the top number the power: $a^{m/n}=\\sqrt[n]{a^m}$.",
    example: "$8^{2/3}=(\\sqrt[3]{8})^2=2^2=4$.",
    uses: ["exponent", "fraction", "root-radical"],
    band: "algebra-2",
    noLink: ["power"],
  },
  {
    id: "real-number",
    term: "real number",
    forms: ["real number", "real numbers"],
    plain:
      "Any number with a spot on the number line: whole numbers, negative numbers, fractions, decimals, and numbers like $\\sqrt{2}$ and $\\pi$.",
    example:
      "−3, 0.5, $\\frac{2}{3}$ and $\\sqrt{5}$ are real numbers; $\\sqrt{-1}$ is not.",
    uses: [
      "number-line",
      "whole-number",
      "negative-number",
      "fraction",
      "decimal",
    ],
    band: "8",
  },
  {
    id: "real-part",
    term: "real part",
    forms: ["real part", "real parts"],
    plain:
      "In the complex number $a+bi$, the number $a$: the part without $i$.",
    example: "The real part of $4-7i$ is 4.",
    uses: ["complex-number"],
    band: "algebra-2",
    noLink: ["part"],
  },
  {
    id: "remainder-theorem",
    term: "remainder theorem",
    forms: ["remainder theorem"],
    plain:
      "When a polynomial $p(x)$ is divided by $x-a$, the remainder equals $p(a)$.",
    example: "$p(x)=x^2+3x-1$ divided by $x-2$ leaves remainder $p(2)=9$.",
    uses: ["polynomial", "remainder"],
    band: "algebra-2",
    noLink: ["leaves"],
  },
  {
    id: "resultant",
    term: "resultant",
    forms: ["resultant", "resultants"],
    plain:
      "The single vector that has the same effect as two or more vectors combined. Add their components to find it.",
    example:
      "$\\langle 3,1\\rangle+\\langle 1,4\\rangle$ has resultant $\\langle 4,5\\rangle$.",
    uses: ["vector", "component"],
    band: "precalculus",
  },
  {
    id: "scalar",
    term: "scalar",
    forms: ["scalar", "scalars", "scalar multiple", "scalar multiples"],
    plain:
      "An ordinary number used to multiply a vector or matrix. It multiplies every component or every number inside.",
    example: "$3\\langle 2,-1\\rangle=\\langle 6,-3\\rangle$.",
    uses: ["vector", "matrix", "component"],
    band: "precalculus",
  },
  {
    id: "scalar-projection",
    term: "scalar projection",
    forms: ["scalar projection"],
    plain:
      "The signed length of the shadow one vector casts on another: their dot product divided by the length of the second. It is negative when the angle is over $90^\\circ$.",
    example:
      "For $\\mathbf{u}=\\langle 3,4\\rangle$ on $\\mathbf{v}=\\langle 1,0\\rangle$ it is $\\frac{3}{1}=3$.",
    uses: ["vector", "length", "dot-product", "angle"],
    band: "precalculus",
  },
  {
    id: "speed",
    term: "speed",
    forms: ["speed", "speeds"],
    plain: "How far something moves in each unit of time.",
    example:
      "A car that goes 120 miles in 2 hours at a steady pace has a speed of 60 miles per hour.",
    uses: ["unit"],
    band: "6",
  },
  {
    id: "square-root",
    term: "square root",
    forms: ["square root", "square roots"],
    plain:
      "A number that gives a value when multiplied by itself. Every positive number has two square roots; $\\sqrt{n}$ means the nonnegative one.",
    example: "$\\sqrt{36}=6$; the square roots of 36 are 6 and −6.",
    uses: [],
    band: "8",
  },
  {
    id: "zero-product-property",
    term: "zero-product property",
    forms: ["zero-product property", "zero product property"],
    plain:
      "If a product is 0, then at least one of the numbers multiplied is 0.",
    example: "If $(x-2)(x+5)=0$, then $x-2=0$ or $x+5=0$, so $x=2$ or $x=-5$.",
    uses: ["product-multiply", "at-least"],
    band: "algebra-1",
  },
];
