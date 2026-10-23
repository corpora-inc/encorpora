import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

/** Quadratic and polynomial structure: parabola features, reading
 * expressions by their structure, polynomial zeros, and division by x − a. */
export const quadraticStructureLessons: Lesson[] = [
  {
    id: "parabola-features",
    title: "Parabolas: vertex, axis and translations",
    summary:
      "A quadratic graph bends around a turning point. Its vertex form shows where that point is and whether the curve opens up or down.",
    templateIds: ["parabola-vertex", "parabola-axis", "parabola-shift"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Find the vertex of a parabola from vertex form, from standard form, or from its graph.",
      "Find the axis of symmetry from the zeros, from two points at the same height, or from x = −b/(2a).",
      "Connect a translation of y = x² to the equation y = (x − h)² + k.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Vertex and axis of symmetry",
        paragraphs: [
          "A parabola is the U-shaped graph of a quadratic rule. Its lowest point, or highest point when it opens down, is the vertex. A vertical line through the vertex is its axis of symmetry: points equally far left and right of that line have the same height.",
          "In $y=a(x-h)^2+k$ with $a\\ne0$, the square is zero at $x=h$ and positive elsewhere. For $a>0$, $y$ is least at $x=h$; for $a<0$, it is greatest there. The vertex is $(h,k)$, and the axis is $x=h$.",
          "Points the same distance left and right of x = h give the same square, so they have the same height: the parabola is symmetric about the line x = h, its axis of symmetry. Two points at the same height, such as the two $x$-intercepts, lie the same distance either side of it, so the axis is halfway between them.",
        ],
        illustration: "parabola-features",
      },
      {
        title: "Find the axis from standard form",
        paragraphs: [
          "In $y=ax^2+bx+c$ with $a\\ne0$, $a$, $b$, and $c$ are fixed coefficients. Expanding $a(x-h)^2+k$ gives $ax^2-2ahx+ah^2+k$. Matching the $x$ coefficients gives $b=-2ah$, so the axis is $x=h=-b/(2a)$. Substitute this input into the original rule to find the vertex's height.",
          "For $y=x^2-2x-3$, the axis is $x=-(-2)/(2\\cdot1)=1$ and the vertex is $(1,-4)$. The zeros $-1$ and $3$ are equally far from the axis.",
        ],
      },
      {
        title: "Translating a parabola",
        paragraphs: [
          "Replacing $x$ with x − h moves a graph $h$ units to the right: the old value at $x$ now appears at x + h. Adding $k$ to the output moves every point $k$ units up. So y = (x − h)² + k is the graph of y = x² moved $h$ across and $k$ up, and its vertex moves from (0, 0) to $(h, k)$.",
          "Watch the sign inside: y = (x + 3)² = (x − (−3))² moves 3 units left.",
        ],
        illustration: "parabola-translate",
      },
    ],
    workedExample: {
      prompt: "What is the vertex of the graph of y = 2x² − 12x + 13?",
      steps: [
        "The vertex lies on x = −b/(2a) = −(−12)/(2 × 2) = 3.",
        "Substitute: y = 2 × 3² − 12 × 3 + 13 = 18 − 36 + 13 = −5.",
        "Check: 2(x − 3)² − 5 = 2x² − 12x + 18 − 5 = 2x² − 12x + 13.",
      ],
      answer: "(3, −5)",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "For real $a,h,k$ with $a\\ne0$, $y=a(x-h)^2+k$ has vertex $(h,k)$: a minimum if $a>0$, a maximum if $a<0$.",
          "The outputs at $h-d$ and $h+d$ agree for every real $d$, so the axis is $x=h$. In standard form $y=ax^2+bx+c$, the same axis is $x=-b/(2a)$.",
          "Replacing $x$ with x − h moves a graph $h$ to the right, and adding $k$ to the output moves it $k$ up.",
        ],
      },
    ],
    pitfalls: [
      "Do not read $h$ with the sign shown: y = (x + 2)² − 1 has its vertex at (−2, −1).",
      "Do not take the $y$-intercept $c$ as the vertex's $y$-coordinate; substitute the vertex's $x$.",
      "Keep the minus sign in x = −b/(2a).",
    ],
    parentGuide:
      "Sketch $y = x^2$ from a small table ($x$ from −2 to 2). Then ask where the point (0, 0) goes when the graph moves 3 right and 1 down, and check the new equation by substituting x = 3.",
  },
  {
    id: "expression-structure",
    title: "Reading an expression by its structure",
    summary:
      "The parts of an expression (terms, factors, coefficients) each mean something. A product of binomials is an area; a difference of squares and a perfect square have shapes you can see and rewrite.",
    templateIds: [
      "binomial-area-product",
      "structure-meaning",
      "structure-rewrite",
    ],
    includeGeneratedRepresentation: false,
    objectives: [
      "Expand a product of two binomials as the four regions of an area model.",
      "Interpret a constant, coefficient or factor of a formula in its context.",
      "See A² − B² and A² + 2AB + B² inside an expression and rewrite it as a product.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "A product is an area",
        paragraphs: [
          "A term is one part of a sum, such as $x$ or 3 in $x+3$. A binomial has two terms. A factor is one part of a product, such as $x+3$ in $(x+3)(x+2)$. A coefficient is the number multiplying a variable term. When $x\\ge0$, a rectangle with sides $x+3$ and $x+2$ splits into four regions; their areas add to the whole area: $x^2+3x+2x+6=(x+3)(x+2)$.",
          "The same distributive law works for signed expressions, but negative products are algebraic terms, not physical areas. For example, $(x-2)(x+4)=x^2+4x-2x-8=x^2+2x-8$.",
        ],
        illustration: "area-tiles-product",
      },
      {
        title: "What each part means",
        paragraphs: [
          "In a formula, set the input to 0 to find its output then. In $h=-16t^2+48t+5$, $h=5$ at $t=0$, the height at release. The coefficient 48 contributes to the initial rate, but the quadratic term changes the rate over time; it is not a constant rate.",
          "In C = 40 + 15h, 40 is paid whatever $h$ is (a fixed fee) and each extra hour adds 15. In P = 2400(1.05)^t, 2400 is the population at t = 0, and each year multiplies it by 1.05, a 5% increase.",
        ],
      },
      {
        title: "Shapes to recognize",
        paragraphs: [
          "A² − B² = (A − B)(A + B) for any $A$ and $B$. In x⁴ − 81, A = x² and B = 9, so x⁴ − 81 = (x² − 9)(x² + 9). In (x + 3)² − 4, A = x + 3 and B = 2, so it is (x + 1)(x + 5).",
          "A² + 2AB + B² = (A + B)². 9x² + 12x + 4 has 9x² = (3x)² and 4 = 2², and 2 × 3x × 2 = 12x, so it is (3x + 2)².",
        ],
      },
    ],
    workedExample: {
      prompt: "Which product equals (x − 1)² − 25?",
      steps: [
        "Let A = x − 1. Then (x − 1)² − 25 = A² − 5².",
        "A² − 5² = (A − 5)(A + 5) = (x − 1 − 5)(x − 1 + 5).",
        "Combine the constants: (x − 6)(x + 4).",
      ],
      answer: "(x − 6)(x + 4)",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "The distributive property: each term of one factor multiplies each term of the other, as the regions of a rectangle add to its area.",
          "For a function defined at input 0, its value there is the starting output. In a linear rule $y=mx+b$, $b$ is that output and $m$ is the constant change in $y$ per unit of $x$; a coefficient in a nonlinear rule need not be a constant rate.",
          "A² − B² = (A − B)(A + B) and A² + 2AB + B² = (A + B)² hold for any expressions $A$ and $B$.",
        ],
      },
    ],
    pitfalls: [
      "Multiply every term by every term: (x + 3)(x + 2) has four products, not two.",
      "In a linear cost rule such as $C=40+15h$, the coefficient 15 is the extra cost per hour, while 40 is a fixed fee; one hour costs 55, not 15.",
      "In a difference of squares, $B$ is the square root of the constant: 25 = 5².",
    ],
    parentGuide:
      "Draw a rectangle split into four parts, label the sides $x$ and 3 across, $x$ and 2 down, and fill in each area. Then ask what the 40 means in a phone plan costing 40 + 15 per gigabyte.",
  },
  {
    id: "polynomial-zeros",
    title: "Zeros of polynomials",
    summary:
      "When an expression is a product, any input that makes one factor zero makes the whole product zero. Such an input is a zero of the expression.",
    templateIds: ["zeros-from-factors", "zero-multiplicity"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Find the zeros of a polynomial in factored form, and write a polynomial with given zeros.",
      "Match a graph's $x$-intercepts to factors, and its right end to the sign of the leading coefficient.",
      "Tell from a factor's exponent whether the graph crosses or touches the $x$-axis.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Each factor gives a zero",
        paragraphs: [
          "A product is 0 exactly when one of its factors is 0. So y = (x + 2)(x − 1)(x − 4) is 0 at x = −2, x = 1 and x = 4, and its graph crosses the $x$-axis there. The factor x − r is 0 at x = r, the number with the opposite sign of the one written.",
          "Changing one factor moves one zero: as $r$ changes in (x − r), its $x$-intercept slides along the axis while the others stay.",
        ],
        illustration: "zero-slide",
      },
      {
        title: "Crossing or touching",
        paragraphs: [
          "Near x = r, the factor (x − r) is negative on one side and positive on the other, so $y$ changes sign and the graph crosses the axis. (x − r)² is positive on both sides, so $y$ keeps its sign: the graph touches the axis at $r$ and turns back.",
          "For large $x$ every factor is positive, so $y$ has the sign of the leading coefficient: the graph rises to the right when it is positive and falls when it is negative.",
        ],
        illustration: "multiplicity-touch",
      },
    ],
    workedExample: {
      prompt: "Which polynomial has zeros at x = −3, 0 and 2 and nowhere else?",
      steps: [
        "A zero at x = r comes from the factor (x − r).",
        "x = −3 gives (x + 3); x = 0 gives $x$; x = 2 gives (x − 2).",
        "So y = x(x + 3)(x − 2).",
      ],
      answer: "y = x(x + 3)(x − 2)",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "A product of real numbers is 0 exactly when one of its factors is 0, so the zeros of a factored polynomial are the zeros of its factors.",
          "If $p(x)=(x-r)^m q(x)$ for a positive integer $m$ and a polynomial $q$ with $q(r)\\ne0$, then $p$ changes sign at $r$ when $m$ is odd and keeps its sign there when $m$ is even. Its graph crosses the $x$-axis at odd multiplicity and touches it at even multiplicity.",
        ],
      },
    ],
    pitfalls: [
      "(x + 4) is 0 at x = −4, not 4.",
      "A squared factor touches the axis; it does not cross.",
      "Check the right end of a graph for the sign of the leading coefficient.",
    ],
    parentGuide:
      "Substitute each claimed zero into the factored form and watch one factor become 0. Then pick a number just left and just right of a zero and compare the signs of $y$.",
  },
  {
    id: "polynomial-division",
    title: "Dividing by a linear factor",
    summary:
      "When a sum of powers is divided by $x-a$, the leftover constant is its remainder. Substituting $x=a$ into the original expression finds it.",
    templateIds: ["remainder-theorem", "polynomial-quotient"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Find the remainder of p(x) ÷ (x − a) as $p(a)$.",
      "Find a coefficient that makes $x-a$ a factor.",
      "Divide a cubic by x − a with the synthetic-division layout.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "The remainder is a value of the polynomial",
        paragraphs: [
          "A polynomial is a sum of powers of a variable with number coefficients; $p(x)$ names its value at input $x$. Dividing by $x-a$ means finding a quotient polynomial plus a constant remainder. At $x=a$, the factor $x-a$ becomes zero, so only the remainder is left. This is why substituting $a$ into $p$ finds the remainder.",
        ],
      },
      {
        title: "Synthetic division",
        paragraphs: [
          "Write $a$, the zero of the divisor, then the coefficients of $p$, highest power first (with 0 for any missing power). Bring down the first coefficient. Multiply it by $a$, write the product under the next coefficient, and add. Repeat across.",
          "The bottom row holds the quotient's coefficients, one degree lower than $p$, and its last number is the remainder. Dividing x³ − 2x² − 5x + 6 by x − 3: bring down 1; 1 × 3 = 3, −2 + 3 = 1; 1 × 3 = 3, −5 + 3 = −2; −2 × 3 = −6, 6 − 6 = 0. So the quotient is x² + x − 2 and the remainder is 0.",
        ],
        illustration: "synthetic-layout",
      },
      {
        title: "The remainder theorem",
        paragraphs: [
          "Put x = a into p(x) = (x − a)q(x) + R: the first term is 0, so p(a) = R. The remainder is the value of $p$ at the zero of the divisor.",
          "So x − a is a factor exactly when $p(a) = 0$ (the factor theorem). For x³ + kx − 6 to have the factor x − 2, 8 + 2k − 6 = 0, so k = −1.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "What is the remainder when p(x) = 2x³ − 3x² + x − 4 is divided by x + 2?",
      steps: [
        "x + 2 = x − (−2), so the remainder is p(−2).",
        "p(−2) = 2 × (−2)³ − 3 × (−2)² + (−2) − 4 = −16 − 12 − 2 − 4 = −34.",
      ],
      answer: "−34",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "p(x) = (x − a)q(x) + R, so p(a) = R: the remainder is the value at $a$, and x − a is a factor exactly when p(a) = 0.",
          "Division by x − a writes p(x) = (x − a)q(x) + R with $q$ one degree lower; synthetic division computes $q$ and $R$ by repeated multiplying and adding.",
        ],
      },
    ],
    pitfalls: [
      "Divide by x + 2 using −2, the zero of the divisor.",
      "Write 0 for a missing power before dividing.",
      "The quotient is one degree lower than $p$.",
    ],
    parentGuide:
      "Check a division by multiplying back: (x − a) times the quotient, plus the remainder, must give $p(x)$ again. Then compare the remainder with $p(a)$.",
  },
];

export const quadraticStructureMethods: Record<string, ProblemMethod> = {
  "parabola-vertex": {
    goal: "Find the vertex $(h, k)$ of a parabola from its equation or its graph.",
    terms: [
      [
        "vertex",
        "The turning point: lowest when the parabola opens up, highest when it opens down.",
      ],
      ["vertex form", "y = a(x − h)² + k, whose vertex is $(h, k)$."],
    ],
    method: [
      "Vertex form: $h$ is the $x$ that makes the squared factor 0, and $k$ is the constant added outside.",
      "Standard form y = ax² + bx + c: find x = −b/(2a), then substitute it to find $y$.",
      "Graph: find the turning point and read its coordinates on the axes.",
    ],
    watch:
      "In y = a(x − h)² + k, the vertex's $x$ is the opposite of the number written after x: (x + 3)² gives x = −3.",
  },
  "parabola-axis": {
    goal: "Find the vertical line a parabola is symmetric about.",
    terms: [
      ["axis of symmetry", "The vertical line x = h through the vertex."],
    ],
    method: [
      "From two points at the same height, such as the two zeros, take the $x$ halfway between them: their average.",
      "From y = ax² + bx + c, use x = −b/(2a).",
      "From factored form a(x − p)(x − q), the zeros are $p$ and $q$, so the axis is x = (p + q)/2.",
    ],
    watch:
      "Average the $x$-coordinates, not the $y$-coordinates, and keep the minus sign in −b/(2a).",
  },
  "parabola-shift": {
    goal: "Match a translation of y = x² with its equation y = (x − h)² + k.",
    method: [
      "Track the vertex: (0, 0) moves to $(h, k)$.",
      "$h$ units right is x − h inside the square; $h$ units left is x + h.",
      "$k$ units up adds $k$ outside the square; $k$ units down subtracts $k$.",
    ],
    watch:
      "The sign inside the parentheses is opposite to the direction you might read: (x − 3)² moves right.",
  },
  "binomial-area-product": {
    goal: "Expand a product of two binomials.",
    terms: [
      [
        "area model",
        "A rectangle whose sides are the factors, split into one region per pair of terms.",
      ],
    ],
    method: [
      "Multiply each term of the first factor by each term of the second: four products.",
      "Add the two $x$-terms; keep the x²-term and the constant.",
      "Check by substituting a number, such as x = 1, into both forms.",
    ],
    watch:
      "Do not stop at the first and last products: the two middle regions make the $x$-term.",
  },
  "structure-meaning": {
    goal: "Say what a constant, coefficient or factor of a formula means in its situation.",
    method: [
      "Set the input to 0: what is left is the starting value.",
      "Increase the input by 1: what is added (or multiplied) each time is the rate (or growth factor).",
      "Match those meanings to the numbers in the formula.",
    ],
    watch:
      "A coefficient is the change per unit, not the total after one unit.",
  },
  "structure-rewrite": {
    goal: "Rewrite an expression as a product by seeing a difference of squares or a perfect square in it.",
    terms: [
      ["difference of squares", "A² − B² = (A − B)(A + B)."],
      ["perfect square", "A² + 2AB + B² = (A + B)²."],
    ],
    method: [
      "Name $A$ and $B$: what is being squared in each square term (A can be x², or $x + 3$).",
      "Write the matching product: (A − B)(A + B) or (A + B)².",
      "Simplify inside each factor and check the middle term 2AB for a perfect square.",
    ],
    watch: "$B$ is the square root of the constant: in x² − 49, B = 7, not 49.",
  },
  "zeros-from-factors": {
    goal: "Connect the factors of a polynomial with its zeros and $x$-intercepts.",
    terms: [
      [
        "zero",
        "A value of $x$ that makes the polynomial 0: an $x$-intercept of its graph.",
      ],
    ],
    method: [
      "Each factor (x − r) is 0 at x = r; set each factor equal to 0.",
      "To build a polynomial, turn each zero $r$ into the factor (x − r).",
      "On a graph, read the $x$-intercepts, and check the right end for the sign of the leading coefficient.",
    ],
    watch: "(x + 4) gives the zero −4, the number with the opposite sign.",
  },
  "zero-multiplicity": {
    goal: "Use a factor's exponent to decide whether the graph crosses or touches the $x$-axis.",
    method: [
      "A factor to the first power changes sign at its zero: the graph crosses there.",
      "A squared factor stays positive on both sides: the graph touches the axis and turns back.",
      "Match each zero's behavior to its factor, then check the right end for the leading sign.",
    ],
    watch:
      "Touching is not crossing twice: a touching zero comes from one squared factor.",
  },
  "remainder-theorem": {
    goal: "Find the remainder of p(x) ÷ (x − a), or a coefficient that makes $x - a a$ factor.",
    terms: [
      ["remainder theorem", "The remainder of p(x) ÷ (x − a) is $p(a)$."],
    ],
    method: [
      "Read a from the divisor: x − a uses $a$, and x + a uses −a.",
      "Evaluate $p(a)$, or carry out synthetic division and read its last number.",
      "For a factor, set p(a) = 0 and solve for the unknown coefficient.",
    ],
    watch: "Dividing by x + 3 means evaluating at −3.",
  },
  "polynomial-quotient": {
    goal: "Divide a cubic by x − a to get its quotient and remainder.",
    terms: [["quotient", "The polynomial $q(x)$ with p(x) = (x − a)q(x) + R."]],
    method: [
      "Write $a$ and the coefficients of $p$, with 0 for a missing power.",
      "Bring down the first coefficient; multiply by $a$, add to the next, and repeat.",
      "The bottom row gives the quotient's coefficients (one degree lower) and, last, the remainder.",
    ],
    watch: "Use the zero of the divisor: for x + 2, multiply by −2.",
  },
};

export const quadraticStructurePrinciples: Record<string, string> = {
  "parabola-vertex":
    "A square is never negative and is 0 only when its base is 0, so a(x − h)² + k takes its extreme value $k$ exactly at x = h.",
  "parabola-axis":
    "a(x − h)² + k has the same value at h − d and h + d, so a parabola is symmetric about x = h; in standard form h = −b/(2a).",
  "parabola-shift":
    "Replacing $x$ with x − h moves a graph $h$ to the right, and adding $k$ to the output moves it $k$ up.",
  "binomial-area-product":
    "The distributive property: each term of one factor multiplies each term of the other, as the regions of a rectangle add to its area.",
  "structure-meaning":
    "In a function of an input, the value at input 0 is the starting value, and the change per unit of input is the rate.",
  "structure-rewrite":
    "A² − B² = (A − B)(A + B) and A² + 2AB + B² = (A + B)² hold for any expressions $A$ and $B$.",
  "zeros-from-factors":
    "A product of real numbers is 0 exactly when one of its factors is 0, so the zeros of a factored polynomial are the zeros of its factors.",
  "zero-multiplicity":
    "An odd power of (x − r) changes sign at $r$ and an even power does not, so the graph crosses at odd multiplicity and touches at even.",
  "remainder-theorem":
    "p(x) = (x − a)q(x) + R, so p(a) = R: the remainder is the value at $a$, and x − a is a factor exactly when p(a) = 0.",
  "polynomial-quotient":
    "Division by x − a writes p(x) = (x − a)q(x) + R with $q$ one degree lower; synthetic division computes $q$ and $R$ by repeated multiplying and adding.",
};
