import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

const parabolaSenses: Lesson["senses"] = {
  vertex: "vertex-parabola",
  vertices: "vertex-parabola",
  square: "square-number",
  squared: "square-number",
  term: "term-expression",
  terms: "term-expression",
  factor: "factor-number",
  product: "product-multiply",
  side: "side",
  "standard form": "standard-form-polynomial",
  base: "base-exponent",
  bases: "base-exponent",
  identity: "identity-equation",
  "left side": "side-of-equation",
  "right side": "side-of-equation",
};
const structureSenses: Lesson["senses"] = {
  term: "term-expression",
  terms: "term-expression",
  factor: "factor-number",
  factors: "factor-number",
  product: "product-multiply",
  products: "product-multiply",
  square: "square-number",
  squares: "square-number",
  squared: "square-number",
  difference: "difference-subtract",
  side: "side",
  sides: "side",
  root: "root-radical",
  base: "base-exponent",
  bases: "base-exponent",
  identity: "identity-equation",
  "standard form": "standard-form-polynomial",
  "left side": "side-of-equation",
  "right side": "side-of-equation",
};

/** Quadratic and polynomial structure: parabola features, reading
 * expressions by their structure, polynomial zeros, and division by x − a. */
export const quadraticStructureLessons: Lesson[] = [
  {
    id: "parabola-features",
    title: "Parabolas: vertex, axis and translations",
    summary:
      "The graph of $y = x^2$ ($x$ times $x$) is a U-shaped curve called a parabola. Its lowest point, $(0, 0)$, is where it turns around. That turning point is called the vertex. The curve is a mirror image on either side of the vertical line through the vertex. Changing some numbers in the equation slides the curve, and the equation tells you exactly where the vertex goes.",
    templateIds: ["parabola-vertex", "parabola-axis", "parabola-shift"],
    includeGeneratedRepresentation: false,
    senses: { ...parabolaSenses, image: "image-transformation" },
    noLink: ["means", "mirror image", "units"],
    objectives: [
      "Find the vertex (the turning point) of a parabola from vertex form, from standard form, or from its graph.",
      "Find the axis of symmetry (the mirror line) from the zeros, from two points at the same height, or from $x = -\\frac{b}{2a}$.",
      "Connect sliding the graph of $y = x^2$ to the equation $y = (x - h)^2 + k$.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Vertex and axis of symmetry",
        paragraphs: [
          "Start with $y = x^2$. The raised 2 means $x$ times $x$. Make a table: $x = -2, -1, 0, 1, 2$ give $y = 4, 1, 0, 1, 4$. Plot the points $(x, y)$ and join them. The result is a U-shaped curve called a parabola.",
          "The lowest point, $(0, 0)$, is where the curve turns around. The turning point of a parabola is called its vertex. If the curve opens downward, like a hill, the vertex is its highest point instead.",
          "Look at the table again: $x = -2$ and $x = 2$ give the same height, 4. Points the same distance left and right of the vertex have the same height. So the vertical line through the vertex splits the parabola into two mirror-image halves. That line is called the axis of symmetry.",
          "Now look at $y = a(x - h)^2 + k$, where $a$, $h$ and $k$ are fixed numbers and $a \\ne 0$ ($\\ne$ means is not equal to). Squaring means multiplying a number by itself, so a square is never negative. Here $(x - h)^2$ is 0 when $x = h$ and positive for every other $x$. So when $a$ is positive, $y$ is smallest at $x = h$, where $y = k$. When $a$ is negative, $y$ is largest there. Either way, the vertex is $(h, k)$ and the axis of symmetry is the line $x = h$.",
          "Two points at the same height are the same distance from the axis, one on each side. So the axis is halfway between them. When the curve crosses the $x$-axis twice, those two crossing points are one such pair.",
        ],
        illustration: "parabola-features",
      },
      {
        title: "Find the axis from standard form",
        paragraphs: [
          "A quadratic can also be written $y = ax^2 + bx + c$, called standard form. Here $a$, $b$ and $c$ are its coefficients: $a$ multiplies $x^2$, $b$ multiplies $x$, and $c$ stands alone.",
          "Multiplying out $a(x - h)^2 + k$ gives $ax^2 - 2ahx + ah^2 + k$. The number multiplying $x$ must match, so $b = -2ah$. Dividing both sides by $-2a$ (not 0) gives $h = -\\frac{b}{2a}$. So the axis is $x = -\\frac{b}{2a}$. Put that $x$ into the equation to find the height of the vertex.",
          "For $y = x^2 - 2x - 3$: $a = 1$ and $b = -2$, so the axis is $x = -\\frac{-2}{2 \\times 1} = 1$. The height there is $1 - 2 - 3 = -4$, so the vertex is $(1, -4)$. The zeros, $-1$ and 3, are each 2 away from the axis.",
        ],
      },
      {
        title: "Translating a parabola",
        paragraphs: [
          "Sliding a graph without turning or stretching it is called a translation. Adding $k$ to every output moves every point $k$ units up. So $y = x^2 + 1$ is $y = x^2$ moved up 1.",
          "Replacing $x$ with $x - h$ moves the graph $h$ units to the right. Here is why. In $y = (x - 3)^2$, the square is 0 at $x = 3$, not at $x = 0$. Every height of $y = x^2$ now happens 3 units later, further right.",
          "So $y = (x - h)^2 + k$ is $y = x^2$ moved $h$ units across and $k$ units up. Its vertex moves from $(0, 0)$ to $(h, k)$.",
          "Watch the sign inside the bracket. $y = (x + 3)^2$ is the same as $(x - (-3))^2$, so $h = -3$ and the graph moves 3 units left.",
        ],
        illustration: "parabola-translate",
      },
    ],
    workedExample: {
      prompt: "What is the vertex of the graph of y = 2x² − 12x + 13?",
      steps: [
        "Read the coefficients of $ax^2 + bx + c$: $a = 2$, $b = -12$ and $c = 13$. The vertex lies on the axis $x = -\\frac{b}{2a} = -\\frac{-12}{2 \\times 2} = 3$.",
        "Put $x = 3$ into the equation to find the height: $y = 2 \\times 3^2 - 12 \\times 3 + 13 = 18 - 36 + 13 = -5$. So the vertex is $(3, -5)$.",
        "Check with vertex form: $2(x - 3)^2 - 5 = 2(x^2 - 6x + 9) - 5 = 2x^2 - 12x + 13$. It matches, and its vertex is $(3, -5)$.",
      ],
      answer: "(3, −5)",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "Real numbers are the numbers on the number line. For real numbers $a$, $h$ and $k$ with $a \\ne 0$, the graph of $y = a(x - h)^2 + k$ has vertex $(h, k)$. That is the lowest point if $a > 0$ ($>$ means greater than) and the highest point if $a < 0$ ($<$ means less than).",
          "For every number $d$, the inputs $h - d$ and $h + d$ give the same output, so the axis of symmetry is $x = h$. In standard form $y = ax^2 + bx + c$, the same axis is $x = -\\frac{b}{2a}$.",
          "Replacing $x$ with $x - h$ moves a graph $h$ units right, and adding $k$ to the output moves it $k$ units up.",
        ],
      },
    ],
    pitfalls: [
      "Flip the sign you see inside the bracket: $y = (x + 2)^2 - 1$ has its vertex at $(-2, -1)$.",
      "The number $c$ in standard form is the height where the curve crosses the $y$-axis. It is the vertex height only when the vertex is on the $y$-axis, so put the vertex's $x$ into the equation instead.",
      "Keep the minus sign in $x = -\\frac{b}{2a}$.",
    ],
    parentGuide:
      "Sketch $y = x^2$ from a small table, with $x$ from $-2$ to 2. Ask where the point $(0, 0)$ goes when the graph moves 3 right and 1 down. Then check the new equation, $y = (x - 3)^2 - 1$, by putting in $x = 3$.",
  },
  {
    id: "expression-structure",
    title: "Reading an expression by its structure",
    summary:
      "An expression is a calculation written with numbers and letters, like $(x + 3)(x + 2)$. Its pieces each mean something. Two brackets multiplied can be drawn as a rectangle with those side lengths. Its area, the space inside it, is what you get by multiplying them. In a formula like $C = 40 + 15h$, the 40 is a fixed starting amount and the 15 is added for each $h$. Some expressions also have a shape you can spot and rewrite as a product, the result of multiplying.",
    templateIds: [
      "binomial-area-product",
      "structure-meaning",
      "structure-rewrite",
    ],
    includeGeneratedRepresentation: false,
    senses: structureSenses,
    noLink: [
      "part",
      "parts",
      "whole",
      "change",
      "changes",
      "mean",
      "means",
      "population",
      "rule",
      "model",
    ],
    objectives: [
      "Multiply out two binomials (two-term expressions) as the four pieces of an area model.",
      "Say what a constant, coefficient or factor of a formula means in its situation.",
      "Spot $A^2 - B^2$ and $A^2 + 2AB + B^2$ inside an expression and rewrite it as a product.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "A product is an area",
        paragraphs: [
          "In $x + 3$, the parts joined by $+$ or $-$ are called terms: $x$ and 3. An expression with two terms is called a binomial. The number multiplying a letter is its coefficient, so in $5x$ the coefficient is 5.",
          "A product is the result of multiplying, and the parts being multiplied are its factors. Two brackets written next to each other are multiplied. In $(x + 3)(x + 2)$, the factors are $x + 3$ and $x + 2$.",
          "Picture a rectangle $x + 3$ wide and $x + 2$ tall, with $x$ a positive length. Cut each length into its two terms. The rectangle splits into four pieces with areas $x \\times x = x^2$, $3 \\times x = 3x$, $x \\times 2 = 2x$ and $3 \\times 2 = 6$. The pieces add up to the whole area: $(x + 3)(x + 2) = x^2 + 3x + 2x + 6 = x^2 + 5x + 6$.",
          "The same rule works when a term is negative, even though a negative area makes no sense as a picture. For example, $(x - 2)(x + 4) = x^2 + 4x - 2x - 8 = x^2 + 2x - 8$.",
        ],
        illustration: "area-tiles-product",
      },
      {
        title: "What each part means",
        paragraphs: [
          "In a formula about a real situation, each number has a meaning. To find a starting amount, set the input to 0. In $C = 40 + 15h$ for the cost $C$ of $h$ hours, $h = 0$ gives $C = 40$. So 40 is a fixed fee paid even for zero hours. Each extra hour adds 15, so 15 is the cost per hour.",
          "In $P = 2400(1.05)^t$, the raised $t$ means 1.05 is multiplied $t$ times. At $t = 0$, $P = 2400$, the starting population. Each year multiplies the population by 1.05, which is a 5% increase.",
          "In $h = -16t^2 + 48t + 5$ for the height of a ball after $t$ seconds, $t = 0$ gives $h = 5$, the height when it was thrown. The 48 is how fast it starts rising, in feet per second, but the $-16t^2$ term changes how fast it moves as time passes. So 48 is not a rate that stays the same.",
        ],
      },
      {
        title: "Shapes to recognize",
        paragraphs: [
          "Multiply out $(A - B)(A + B)$: $A^2 + AB - AB - B^2 = A^2 - B^2$. So a difference of two squares (one square minus another) factors as $A^2 - B^2 = (A - B)(A + B)$. Here $A$ and $B$ can stand for numbers or whole expressions.",
          "In $x^4 - 81$, $x^4 = (x^2)^2$ and $81 = 9^2$, so $A = x^2$ and $B = 9$. That gives $(x^2 - 9)(x^2 + 9)$. In $(x + 3)^2 - 4$, $A = x + 3$ and $B = 2$, so it is $(x + 3 - 2)(x + 3 + 2) = (x + 1)(x + 5)$.",
          "Multiplying out $(A + B)^2 = (A + B)(A + B)$ gives $A^2 + 2AB + B^2$, called a perfect square. In $9x^2 + 12x + 4$: $9x^2 = (3x)^2$ and $4 = 2^2$, and the middle term is $2 \\times 3x \\times 2 = 12x$. So it equals $(3x + 2)^2$.",
        ],
      },
    ],
    workedExample: {
      prompt: "Which product equals (x − 1)² − 25?",
      steps: [
        "Spot two squares, which are things multiplied by themselves. The first part is $(x - 1)^2$, and $25 = 5^2$. So let $A = x - 1$ and $B = 5$. The expression is $A^2 - B^2$.",
        "Use the difference of squares: $A^2 - B^2 = (A - B)(A + B)$. Put back $A = x - 1$: $(x - 1 - 5)(x - 1 + 5)$.",
        "Combine the numbers in each bracket: $-1 - 5 = -6$ and $-1 + 5 = 4$. So the product is $(x - 6)(x + 4)$.",
        "Check by multiplying out: $(x - 6)(x + 4) = x^2 - 2x - 24$, and $(x - 1)^2 - 25 = x^2 - 2x + 1 - 25 = x^2 - 2x - 24$.",
      ],
      answer: "(x − 6)(x + 4)",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "The distributive property is the rule that each term of one factor multiplies each term of the other, just as the pieces of a rectangle add up to its area.",
          "If a formula gives an output for input 0, that output is the starting value. In a straight-line rule $y = mx + b$, $b$ is the starting value and $m$ is the fixed change in $y$ for each 1 added to $x$. In other kinds of rule, a coefficient need not be a fixed rate.",
          "For any expressions $A$ and $B$: $A^2 - B^2 = (A - B)(A + B)$ and $A^2 + 2AB + B^2 = (A + B)^2$.",
        ],
      },
    ],
    pitfalls: [
      "Multiply every term by every term: $(x + 3)(x + 2)$ has four products, not two.",
      "In $C = 40 + 15h$, 15 is the extra cost for each hour and 40 is a fixed fee. One hour costs $40 + 15 = 55$, not 15.",
      "In a difference of squares, $B$ is the square root of the number: for $x^2 - 25$, $B = 5$, because $5 \\times 5 = 25$.",
    ],
    parentGuide:
      "Draw a rectangle split into four parts. Label its width $x$ and 3 and its height $x$ and 2, then fill in each area. Then ask what the 40 means in a phone plan that costs 40 plus 15 for each gigabyte.",
  },
  {
    id: "polynomial-zeros",
    title: "Zeros of polynomials",
    summary:
      "A polynomial is a sum of terms like $x^3$, $-2x$ and $5$. When it is written as factors, parts multiplied together, any input that makes one factor 0 makes the whole product 0. Such an input is called a zero of the polynomial. On the graph, the zeros are where the curve meets the $x$-axis.",
    senses: {
      term: "term-expression",
      factor: "factor-number",
      product: "product-multiply",
      opposite: "opposite-number",
      squared: "square-number",
    },
    noLink: ["parts", "whole", "changes"],
    templateIds: ["zeros-from-factors", "zero-multiplicity"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Find the zeros of a factored polynomial, and build a polynomial from given zeros.",
      "Use each factor's exponent to tell whether the graph crosses or touches the $x$-axis.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Each factor gives a zero",
        paragraphs: [
          "A product, the result of a multiplication, is 0 exactly when one of its factors is 0. So $y = (x + 2)(x - 1)(x - 4)$ is 0 at $x = -2$, $x = 1$ and $x = 4$. Its graph meets the $x$-axis, the line $y = 0$, at those three inputs.",
          "The factor $x - r$ is 0 at $x = r$. So the zero has the opposite sign of the number written in the factor: $(x + 2)$ gives the zero $-2$, because $-2 + 2 = 0$.",
          "Changing one factor moves one zero. As $r$ changes in $(x - r)$, that $x$-intercept, the point where the graph meets the $x$-axis, slides along the axis while the others stay.",
        ],
        illustration: "zero-slide",
      },
      {
        title: "Crossing or touching",
        paragraphs: [
          "The exponent on a factor, the small raised number, counts its copies. Close to a zero $r$, the other factors keep their sign. A single factor $(x - r)$ is negative on one side of $r$ and positive on the other, so $y$ changes sign and the graph crosses the axis.",
          "A squared factor $(x - r)^2$, meaning $(x - r)(x - r)$, is positive on both sides of $r$. So $y$ keeps its sign there, and the graph touches the axis at $r$ and turns back.",
          "For large $x$, every factor $(x - r)$ is positive. So $y$ has the sign of the leading coefficient, the number in front: the graph rises to the right when it is positive and falls when it is negative.",
        ],
        illustration: "multiplicity-touch",
      },
    ],
    workedExample: {
      prompt: "Which polynomial has zeros at x = −3, 0 and 2 and nowhere else?",
      steps: [
        "A zero at $x = r$ comes from the factor $(x - r)$, because that factor is 0 exactly when $x = r$.",
        "$x = -3$ gives $(x - (-3)) = (x + 3)$. $x = 0$ gives $(x - 0)$, which is just $x$. $x = 2$ gives $(x - 2)$.",
        "Multiply the three factors: $y = x(x + 3)(x - 2)$. It has no other zeros, because no other input makes a factor 0.",
      ],
      answer: "y = x(x + 3)(x − 2)",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "A product of real numbers, any numbers on the number line, is 0 exactly when one of its factors is 0. So the zeros of a factored polynomial are the zeros of its factors.",
          "If $p(x) = (x - r)^m q(x)$ for a positive whole number $m$ and a polynomial $q$ with $q(r) \\ne 0$ ($\\ne$ means is not equal to), then $p$ changes sign at $r$ when $m$ is odd and keeps its sign there when $m$ is even. The number $m$ of copies is called the multiplicity. The graph crosses the $x$-axis at odd multiplicity and touches it at even multiplicity.",
        ],
      },
    ],
    pitfalls: [
      "$(x + 4)$ is 0 at $x = -4$, not 4.",
      "A squared factor touches the axis; it does not cross.",
      "Check the right end of a graph for the sign of the leading coefficient.",
    ],
    parentGuide:
      "Put each claimed zero into the factored form and watch one factor become 0. Then pick a number just left and just right of a zero, and compare the signs of $y$.",
  },
  {
    id: "polynomial-division",
    title: "Dividing by a linear factor",
    summary:
      "A polynomial is a sum of terms like $2x^3$ and $-4$. Dividing a polynomial by $x - a$ gives a quotient, the main answer, and a remainder, the number left over. The remainder equals the polynomial's value at $x = a$. So to find the remainder, put $x = a$ into the original polynomial.",
    senses: {
      term: "term-expression",
      factor: "factor-number",
      product: "product-multiply",
      degree: "degree-polynomial",
    },
    noLink: ["whole", "part"],
    templateIds: ["remainder-theorem", "polynomial-quotient"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Find the remainder of a division by $x - a$ by working out the polynomial's value at $a$.",
      "Divide by $x - a$ with synthetic division to find the quotient and the remainder.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "The remainder is a value of the polynomial",
        paragraphs: [
          "A polynomial is a sum of terms like $2x^3$, $-3x^2$ and $-4$: numbers times whole-number powers of $x$. We write $p(x)$, read “$p$ of $x$”, for its value when the input is $x$.",
          "Dividing $p(x)$ by $x - a$ means writing $p(x) = (x - a)q(x) + R$. Here $q(x)$ is the quotient, another polynomial, and $R$ is the remainder, a number.",
          "At $x = a$, the factor $x - a$ becomes 0, so the whole first part is 0 and only the remainder is left: $p(a) = R$. That is why putting $a$ into $p$ finds the remainder.",
        ],
      },
      {
        title: "Synthetic division",
        paragraphs: [
          "Synthetic division is a short way to divide by $x - a$. Write $a$, the input that makes $x - a$ zero. Then write the coefficients of $p$, the numbers in front of each power, from the highest power down, with 0 for any missing power. Bring down the first coefficient. Multiply it by $a$, write the product under the next coefficient, and add. Repeat across.",
          "The bottom row holds the quotient's coefficients, one power lower than $p$, and its last number is the remainder. To divide $x^3 - 2x^2 - 5x + 6$ by $x - 3$: bring down 1; $1 \\times 3 = 3$ and $-2 + 3 = 1$; $1 \\times 3 = 3$ and $-5 + 3 = -2$; $-2 \\times 3 = -6$ and $6 - 6 = 0$. So the quotient is $x^2 + x - 2$ and the remainder is 0.",
        ],
        illustration: "synthetic-layout",
      },
      {
        title: "The remainder theorem",
        paragraphs: [
          "Put $x = a$ into $p(x) = (x - a)q(x) + R$. The first part is 0, so $p(a) = R$. This is called the remainder theorem: the remainder is the value of $p$ at the input that makes the divisor 0.",
          "So $x - a$ is a factor exactly when $p(a) = 0$. This is called the factor theorem. For $x^3 + kx - 6$ to have the factor $x - 2$, we need $8 + 2k - 6 = 0$, so $k = -1$.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "What is the remainder when p(x) = 2x³ − 3x² + x − 4 is divided by x + 2?",
      steps: [
        "Write the divisor as $x - a$: $x + 2 = x - (-2)$, so $a = -2$. By the remainder theorem, the remainder is $p(-2)$.",
        "Work out each term at $x = -2$: $2 \\times (-2)^3 = -16$, $-3 \\times (-2)^2 = -12$, then $-2$ and $-4$.",
        "Add them: $-16 - 12 - 2 - 4 = -34$. That is the remainder.",
      ],
      answer: "−34",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "$p(x) = (x - a)q(x) + R$, so $p(a) = R$: the remainder is the value at $a$, and $x - a$ is a factor exactly when $p(a) = 0$.",
          "For a polynomial $p$ of degree at least 1 (its highest power of $x$ is 1 or more), dividing by $x - a$ writes $p(x) = (x - a)q(x) + R$, with $q$ one degree lower. Synthetic division finds $q$ and $R$ by repeated multiplying and adding.",
        ],
      },
    ],
    pitfalls: [
      "Divide by $x + 2$ using $-2$, the input that makes the divisor zero.",
      "Write 0 for a missing power before dividing.",
      "The quotient is one degree lower than $p$.",
    ],
    parentGuide:
      "Check a division by multiplying back: $(x - a)$ times the quotient, plus the remainder, must give $p(x)$ again. Then compare the remainder with $p(a)$.",
  },
];

export const quadraticStructureMethods: Record<string, ProblemMethod> = {
  "parabola-vertex": {
    goal: "Find the vertex $(h, k)$, the turning point of the parabola, from its equation or its graph.",
    intuition:
      "Squaring means multiplying a number by itself. A parabola is the U-shaped graph of a rule like $y = ax^2 + bx + c$, where $x^2$ means $x$ times $x$ and $a \\ne 0$. Its turning point, the lowest point or the highest if it opens downward, is called the vertex. In vertex form $y = a(x - h)^2 + k$, with $a \\ne 0$, the square $(x - h)^2$ is 0 at $x = h$ and positive everywhere else. So the vertex is $(h, k)$. In the form $y = ax^2 + bx + c$, the vertex is at $x = -\\frac{b}{2a}$.",
    terms: ["vertex-parabola", "vertex-form"],
    senses: { ...parabolaSenses, rule: "rule", opposite: "opposite-number" },
    noLink: ["changes", "means", "image", "mirror image"],
    method: [
      "Vertex form: $h$ is the $x$ that makes the squared bracket 0, and $k$ is the number added after the square.",
      "The form $y = ax^2 + bx + c$ is called standard form. For it, find $x = -\\frac{b}{2a}$, then put it into the equation to find $y$.",
      "Graph: find the turning point and read its coordinates from the axes.",
    ],
    watch:
      "In $y = a(x - h)^2 + k$, the vertex's $x$ has the opposite sign of the number after $x$: $(x + 3)^2$ gives $x = -3$.",
  },
  "parabola-axis": {
    goal: "Find the axis of symmetry: the vertical line that splits the parabola into two mirror halves.",
    intuition:
      "A parabola is the U-shaped graph of a rule like $y = ax^2 + bx + c$ with $a \\ne 0$. The vertex is the turning point of the parabola. The vertical line through the vertex splits it into two mirror-image halves. That line is called the axis of symmetry. It is written as an equation like $x = 3$, meaning every point on it has $x$-value 3. Two points at the same height sit the same distance from it, one on each side, so the axis is halfway between them. If the curve crosses the $x$-axis twice, those two zeros are one such pair.",
    terms: ["axis-of-symmetry"],
    senses: { ...parabolaSenses, rule: "rule", average: "mean-average" },
    noLink: ["image", "images"],
    method: [
      "From two points at the same height, such as the two zeros, take the $x$ halfway between them: add the two $x$-values and divide by 2.",
      "From $y = ax^2 + bx + c$, use $x = -\\frac{b}{2a}$.",
      "From factored form $a(x - p)(x - q)$, the zeros are $p$ and $q$, so the axis is $x = \\frac{p + q}{2}$.",
    ],
    watch:
      "Average the $x$-coordinates, not the $y$-coordinates. Keep the minus sign in $-\\frac{b}{2a}$.",
  },
  "parabola-shift": {
    goal: "Match a slide of the graph of $y = x^2$ with its equation $y = (x - h)^2 + k$.",
    intuition:
      "The graph of $y = x^2$ ($x$ times $x$) is a U-shaped curve called a parabola, and its turning point is called the vertex, at $(0, 0)$. Sliding a graph without turning or stretching it is called a translation. Adding $k$ after the square moves the graph $k$ units up. Writing $x - h$ inside the square moves it $h$ units right, because the square is now 0 at $x = h$. So $y = (x - h)^2 + k$ has its vertex at $(h, k)$.",
    terms: ["vertex-parabola", "vertex-form"],
    senses: parabolaSenses,
    noLink: ["solid", "opposite", "unit", "units"],
    method: [
      "Follow the vertex: $(0, 0)$ moves to $(h, k)$.",
      "Moving $h$ units right is $x - h$ inside the square. Moving $h$ units left is $x + h$.",
      "Moving $k$ units up adds $k$ after the square. Moving $k$ units down subtracts $k$.",
    ],
    watch:
      "The sign inside the bracket is opposite to the direction: $(x - 3)^2$ moves the graph right, and $(x + 3)^2$ moves it left.",
  },
  "binomial-area-product": {
    goal: "Multiply out two binomials (two-term brackets) and add like terms.",
    intuition:
      "In $x + 3$, the parts joined by $+$ or $-$ are called terms, and a two-term expression is called a binomial. Two brackets written next to each other are multiplied. Picture $(x + 3)(x + 2)$ as a rectangle $x + 3$ wide and $x + 2$ tall. Cutting each length into its terms splits it into four pieces: $x^2$, $3x$, $2x$ and 6. Adding the pieces gives $x^2 + 5x + 6$. Terms with the same power of $x$, such as $3x$ and $2x$, are called like terms, and they can be added.",
    terms: [
      [
        "area-model",
        "Here the sides are binomials, with one region for each pair of terms.",
      ],
    ],
    senses: structureSenses,
    noLink: ["part", "parts", "opposite"],
    method: [
      "Multiply each term of the first bracket by each term of the second. Each result is called a product, so that makes four products. Keep each sign with its term.",
      "Add the two $x$ terms. Keep the $x^2$ term and the number term as they are.",
      "Check by putting a number, such as $x = 1$, into both the brackets and your answer.",
    ],
    watch:
      "Do not stop at the first and last products. The two middle pieces make the $x$ term.",
  },
  "structure-meaning": {
    goal: "Say what a number in a formula means in its real situation: a starting value, a rate or a growth factor.",
    intuition:
      "A formula turns a number you choose, called the input, into a result, called the output. For example, hours $h$ can give a cost $C$. In $C = 40 + 15h$, putting $h = 0$ leaves $C = 40$: a fixed amount you pay at the start. Each extra hour adds 15, so 15 is the rate, the change for each 1 added to the input. In $P = 2400(1.05)^t$, the raised $t$ means 1.05 is multiplied $t$ times. So each step multiplies by 1.05, called the growth factor. A variable is a letter that stands for a number. A coefficient is the number multiplying a variable in a term (one part of the formula).",
    terms: ["coefficient", "constant"],
    senses: structureSenses,
    noLink: [
      "part",
      "change",
      "leaves",
      "means",
      "population",
      "rule",
      "units",
    ],
    method: [
      "Set the input to 0. What is left is the starting value.",
      "Increase the input by 1. If the same amount is added each time, that amount is the rate. If it is multiplied by the same number each time, that number is the growth factor.",
      "Match those meanings to the numbers in the formula, with their units.",
    ],
    watch:
      "In a straight-line formula like $C = 40 + 15h$, the coefficient 15 is the change for each extra hour, not the total after one hour. One hour costs 55, not 15.",
  },
  "structure-rewrite": {
    goal: "Rewrite an expression as a product by spotting a difference of squares or a perfect square in it.",
    intuition:
      "A square is a number or expression times itself: $x^2 = x \\times x$ and $49 = 7 \\times 7$. Multiplying out $(A - B)(A + B)$ gives $A^2 - B^2$, one square minus another, called a difference of squares. Multiplying out $(A + B)(A + B)$ gives $A^2 + 2AB + B^2$, called a perfect square. Here $A$ and $B$ stand for numbers or whole expressions. Spotting these shapes lets you rewrite a sum as a product, the result of multiplying. The parts being multiplied are called factors. A two-term expression is called a binomial.",
    terms: ["difference-of-squares", "perfect-square-trinomial"],
    senses: structureSenses,
    noLink: ["part", "parts", "whole", "pattern"],
    method: [
      "Name $A$ and $B$: what is being squared in each square part. $A$ can be $x^2$, or a bracket like $x + 3$.",
      "Write the matching product: $(A - B)(A + B)$ or $(A + B)^2$.",
      "Simplify inside each bracket. For a perfect square, check that the middle term, the middle part, is $2AB$.",
    ],
    watch:
      "$B$ is the square root of the number, the number that times itself gives it: in $x^2 - 49$, $B = 7$, not 49.",
  },
  "zeros-from-factors": {
    goal: "Connect the factors of a polynomial with its zeros and $x$-intercepts.",
    intuition:
      "A zero of a polynomial is an input that makes it 0. On a graph, it is where the curve meets the $x$-axis. When the polynomial is written as factors multiplied together, a product is 0 exactly when one factor is 0, so each factor $(x - r)$ gives the zero $r$.",
    terms: ["zero-of-a-function"],
    method: [
      "Each factor $(x - r)$ is 0 at $x = r$. Set each factor equal to 0 to find the zeros.",
      "To build a polynomial, turn each zero $r$ into the factor $(x - r)$; the zero 0 gives the factor $x$.",
      "On a graph, read the $x$-intercepts, where the curve meets the $x$-axis. Then check the right end for the sign of the leading coefficient, the number in front.",
    ],
    watch: "$(x + 4)$ gives the zero $-4$, the number with the opposite sign.",
  },
  "zero-multiplicity": {
    goal: "Use a factor's exponent to decide whether the graph crosses or touches the $x$-axis.",
    senses: { factor: "factor-number", square: "square-number" },
    intuition:
      "A zero is an input where the graph meets the $x$-axis. The exponent on its factor, the small raised number, counts how many copies of the factor are multiplied. Close to the zero, the other factors keep their sign. One copy changes sign at the zero, so the graph crosses. Two copies, a squared factor, never go negative, so the graph touches the axis and turns back. The number of copies is called the multiplicity of the zero.",
    method: [
      "A factor to the first power changes sign at its zero, so the graph crosses there.",
      "A squared factor is positive on both sides, so the graph touches the axis and turns back.",
      "Match each zero's behavior to its factor, then check the right end for the sign of the leading coefficient.",
    ],
    watch:
      "A touching zero comes from an even power of its factor, here a square. It is not two separate crossings.",
  },
  "remainder-theorem": {
    goal: "Find the remainder of $p(x) \\div (x - a)$, or a coefficient that makes $x - a$ a factor.",
    intuition:
      "When a polynomial $p(x)$ is divided by $x - a$, the number left over is called the remainder. The remainder theorem says it equals $p(a)$, the polynomial's value at $x = a$, because the divisor $x - a$ is 0 there. Synthetic division, a short layout for dividing, gives the same number as its last entry.",
    terms: ["remainder-theorem"],
    method: [
      "Find $a$ from the divisor: $x - a$ uses $a$, and $x + a$ uses $-a$, the input that makes the divisor zero.",
      "Work out $p(a)$, or carry out synthetic division and read its last number.",
      "For a factor, set $p(a) = 0$ and solve for the unknown coefficient.",
    ],
    watch: "Dividing by $x + 3$ means working out $p(-3)$.",
  },
  "polynomial-quotient": {
    goal: "Divide a cubic by $x - a$ to get its quotient and remainder.",
    intuition:
      "Dividing a polynomial $p(x)$ by $x - a$ gives a quotient $q(x)$, the main result, and a remainder $R$, the number left over: $p(x) = (x - a)q(x) + R$. Synthetic division is a short way to find both. It uses $a$, the input that makes $x - a$ zero, and the coefficients of $p$, the numbers in front of each power.",
    terms: [
      [
        "quotient",
        "Here the quotient is the polynomial $q(x)$ with $p(x) = (x - a)q(x) + R$.",
      ],
    ],
    method: [
      "Write $a$ and the coefficients of $p$, highest power first, with 0 for a missing power.",
      "Bring down the first coefficient. Multiply by $a$, add to the next coefficient, and repeat.",
      "The bottom row gives the quotient's coefficients, one power lower, and, last, the remainder.",
    ],
    watch:
      "Use the input that makes the divisor zero: for $x + 2$, multiply by $-2$.",
  },
};

export const quadraticStructurePrinciples: Record<string, string> = {
  "parabola-vertex":
    "A square is never negative, and it is 0 only when the thing squared is 0. So $a(x - h)^2 + k$ reaches its lowest or highest value, $k$, exactly at $x = h$.",
  "parabola-axis":
    "$a(x - h)^2 + k$ has the same value at $h - d$ and $h + d$ for every number $d$, so the parabola is symmetric about the line $x = h$. In the form $y = ax^2 + bx + c$, $h = -\\frac{b}{2a}$.",
  "parabola-shift":
    "Replacing $x$ with $x - h$ moves a graph $h$ units right, and adding $k$ to the output moves it $k$ units up. So the vertex of $y = x^2$ moves from $(0, 0)$ to $(h, k)$.",
  "binomial-area-product":
    "The distributive property: each term of one factor (a part being multiplied) multiplies each term of the other. Area is the space a shape covers, and the pieces of a rectangle add up to its area. So $(a + b)(c + d) = ac + ad + bc + bd$.",
  "structure-meaning":
    "In a formula, the output at input 0 is the starting value. In $y = mx + b$, the starting value is $b$ and each 1 added to $x$ adds $m$, the rate. In $y = a \\times b^x$, each step multiplies by $b$.",
  "structure-rewrite":
    "For any expressions $A$ and $B$: $A^2 - B^2 = (A - B)(A + B)$ and $A^2 + 2AB + B^2 = (A + B)^2$.",
  "zeros-from-factors":
    "A product of real numbers is 0 exactly when one of its factors is 0, so the zeros of a factored polynomial are the zeros of its factors.",
  "zero-multiplicity":
    "An odd power of (x − r) changes sign at $r$ and an even power does not, so the graph crosses at odd multiplicity and touches at even.",
  "remainder-theorem":
    "p(x) = (x − a)q(x) + R, so p(a) = R: the remainder is the value at $a$, and x − a is a factor exactly when p(a) = 0.",
  "polynomial-quotient":
    "For a nonconstant polynomial $p$, division by $x-a$ writes $p(x)=(x-a)q(x)+R$ with $q$ one degree lower; synthetic division computes $q$ and $R$ by repeated multiplying and adding.",
};
