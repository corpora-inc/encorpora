import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

type Entry = {
  id: string;
  title: string;
  summary: string;
  objectives: [string, string];
  intuition: string;
  terms: [string, string][];
  method: string[];
  watch: string;
  principle: string;
  example: Lesson["workedExample"];
  methodTitle: string;
  methodText: string[];
  formal: string;
  pitfalls: string[];
  parentGuide: string;
};

const entries: Entry[] = [
  {
    id: "inline-linear-features",
    title: "Read a line’s slope and intercept",
    summary:
      "Slope is the change in $y$ per step in $x$; the $y$-intercept is where the line crosses the $y$-axis. Two points give both.",
    objectives: [
      "Find the slope of a line from two of its points, its graph or a table of values.",
      "Find the $y$-intercept, write $y = mx + b$, and tell whether $y$ increases or decreases.",
    ],
    intuition:
      "Walk along a line from left to right. The slope says how far you rise (or fall) for each step to the right; the same for every step, which is what makes it a line. The $y$-intercept is the height where the line crosses the $y$-axis, at $x = 0$. Together they are the $m$ and $b$ of $y = mx + b$.",
    terms: [
      [
        "slope",
        "The change in $y$ divided by the change in $x$ between any two points of the line.",
      ],
      [
        "$y$-intercept",
        "The $y$-value where the line crosses the $y$-axis, the output when $x = 0$.",
      ],
    ],
    method: [
      "Take two points of the line. Subtract in the same order: slope $m = \\frac{y_2 - y_1}{x_2 - x_1}$.",
      "If a point has $x = 0$, its $y$ is the intercept. Otherwise put one point and $m$ into $y = mx + b$ and solve for $b$.",
      "A positive slope means $y$ increases as $x$ increases; a negative slope means it decreases.",
    ],
    watch:
      "Put the change in $y$ on top. $\\frac{\\text{change in } x}{\\text{change in } y}$ gives the reciprocal, a different line.",
    principle:
      "Any two points of a nonvertical line give the same ratio $\\frac{y_2 - y_1}{x_2 - x_1}$, because the slope triangles between them are similar. The line is then $y = mx + b$, where $b$ is the output at $x = 0$.",
    example: {
      prompt:
        "A line passes through $(2, 1)$ and $(6, 3)$. Complete: the slope is ___, the $y$-intercept is ___, and as $x$ increases, $y$ ___.",
      steps: [
        "Slope: $m = \\frac{3 - 1}{6 - 2} = \\frac{2}{4} = \\frac{1}{2}$.",
        "Intercept: $1 = \\frac{1}{2} \\cdot 2 + b$, so $b = 1 - 1 = 0$. The line passes through the origin.",
        "The slope is positive, so $y$ increases as $x$ increases.",
      ],
      answer:
        "The slope is $\\frac{1}{2}$, the $y$-intercept is $0$, and $y$ increases.",
    },
    methodTitle: "Check with the other point",
    methodText: [
      "After finding $m$ and $b$, substitute the second point. With $y = \\frac{1}{2}x$ and $(6, 3)$: $\\frac{1}{2} \\cdot 6 = 3$. A mismatch means a sign or order slip.",
      "In a table, the slope is the change in $y$ divided by the change in $x$ between any two rows. Step back to $x = 0$ to read $b$.",
    ],
    formal:
      "For points $(x_1, y_1)$ and $(x_2, y_2)$ on $y = mx + b$, subtracting $y_1 = mx_1 + b$ from $y_2 = mx_2 + b$ gives $y_2 - y_1 = m(x_2 - x_1)$, so $m = \\frac{y_2 - y_1}{x_2 - x_1}$ and $b = y_1 - mx_1$.",
    pitfalls: [
      "Subtract the coordinates in the same order on the top and the bottom.",
      "The first $y$-value in a table is the intercept only when its $x$ is $0$.",
    ],
    parentGuide:
      "Ask your learner to check their slope and intercept by substituting the other point into $y = mx + b$.",
  },
  {
    id: "proportional-match-table",
    title: "Tell proportional relationships apart",
    summary:
      "Proportional means $y = kx$ for one constant $k$: every pair has the same ratio $\\frac{y}{x}$, and $x = 0$ gives $y = 0$.",
    objectives: [
      "Decide whether an equation is proportional by rewriting it as $y = kx$.",
      "Decide whether a set of pairs is proportional by comparing the ratios $\\frac{y}{x}$.",
    ],
    intuition:
      "In a proportional relationship, doubling $x$ doubles $y$, and zero of one means zero of the other, like the cost of apples at one price per pound. Adding a fixed fee breaks it: two pounds no longer cost twice as much as one.",
    terms: [
      [
        "constant of proportionality",
        "The fixed ratio $k = \\frac{y}{x}$ in $y = kx$.",
      ],
      [
        "proportional",
        "Every pair has the same ratio $\\frac{y}{x}$; the graph is a line through the origin.",
      ],
    ],
    method: [
      "Rewrite each equation as $y = \\dots$ and simplify: $2y = 8x$ becomes $y = 4x$, and $y = 3(x + 2) - 6$ becomes $y = 3x$.",
      "Proportional equations have the form $y = kx$: no added constant, no $x^2$, no $x$ in a denominator.",
      "For a list of pairs, compute $\\frac{y}{x}$ for each. Proportional means every ratio is equal.",
    ],
    watch:
      "A straight line is not enough. $y = 2x + 1$ is linear, but at $x = 0$ it gives $y = 1$, so it is not proportional.",
    principle:
      "$y$ is proportional to $x$ exactly when $y = kx$ for a constant $k$. Then $\\frac{y}{x} = k$ for every $x \\ne 0$, the point $(0, 0)$ satisfies the relationship, and the graph is a line through the origin with slope $k$.",
    example: {
      prompt:
        "Proportional or not: $y = 5x$, $y = 5x + 2$, $y = 4(x + 1) - 4$, and the pairs $(1, 3), (2, 5), (3, 7)$?",
      steps: [
        "$y = 5x$ is proportional with $k = 5$.",
        "$y = 5x + 2$ gives $y = 2$ at $x = 0$: not proportional.",
        "$y = 4(x + 1) - 4 = 4x + 4 - 4 = 4x$: proportional.",
        "$\\frac{3}{1} = 3$ but $\\frac{5}{2} = 2.5$: the ratios differ, so not proportional.",
      ],
      answer:
        "Proportional: $y = 5x$ and $y = 4(x + 1) - 4$. Not proportional: $y = 5x + 2$ and the pairs.",
    },
    methodTitle: "Two quick tests",
    methodText: [
      "The origin test: put $x = 0$. A proportional relationship gives $y = 0$; anything else fails at once.",
      "The ratio test: $\\frac{y}{x}$ must be the same number every time. Both tests must pass; $y = x^2$ passes through the origin but its ratio changes.",
    ],
    formal:
      "If $y = kx$, then $\\frac{y}{x} = k$ for all $x \\ne 0$. Conversely, if $\\frac{y}{x} = k$ for every pair with $x \\ne 0$ and $(0, 0)$ is included, then $y = kx$. A relationship $y = kx + c$ with $c \\ne 0$ has $\\frac{y}{x} = k + \\frac{c}{x}$, which changes with $x$.",
    pitfalls: [
      "Simplify before deciding: parentheses can hide or cancel a constant.",
      "A line that does not pass through the origin is linear but not proportional.",
    ],
    parentGuide:
      "Ask your learner to say the origin test aloud for each row: “When $x$ is 0, is $y$ 0?”",
  },
  {
    id: "label-expression-parts",
    title: "Name the parts of an expression",
    summary:
      "Terms are joined by $+$ or $-$. A term has a coefficient, a variable and maybe an exponent; a term with no variable is a constant.",
    objectives: [
      "Identify the terms, coefficients and constant term of an expression.",
      "Describe an expression as a sum or a product, and name its factors.",
    ],
    intuition:
      "Read $4x + 9y + 2$ like a shopping list: 4 of item $x$, 9 of item $y$, and 2 more on their own. Each listed item is a term. The count in front of a variable is its coefficient, and the lone number is the constant term.",
    terms: [
      [
        "term",
        "A part of an expression joined to the rest by $+$ or $-$: $4x$, $9y$ and $2$ in $4x + 9y + 2$.",
      ],
      [
        "coefficient",
        "The number that multiplies a variable: $4$ in $4x$, and $5$ in $5x^2$.",
      ],
      ["constant term", "A term with no variable; its value never changes."],
      [
        "factor",
        "One of the quantities multiplied in a product: $3$ and $(x + 6)$ in $3(x + 6)$.",
      ],
    ],
    method: [
      "Split the expression at each $+$ or $-$ outside parentheses to list its terms.",
      "In each term, the number in front is the coefficient and any exponent counts the factors of the variable.",
      "Find the last operation: if it is multiplication, the expression is a product of factors; if it is addition, a sum of terms.",
    ],
    watch:
      "The coefficient is only the number. In $9y$ the coefficient is $9$, while the term is all of $9y$.",
    principle:
      "Expressions are built by operations, and the last operation names the whole: a sum of terms or a product of factors. Within a term $ax^n$, $a$ is the coefficient and $n$ is the exponent, so $ax^n$ multiplies $a$ by $n$ factors of $x$.",
    example: {
      prompt:
        "In $6x^2 + 5x + 8$, name the coefficient of $x^2$, the exponent of $x$ in the first term, and the constant term.",
      steps: [
        "The terms are $6x^2$, $5x$ and $8$.",
        "In $6x^2 = 6 \\cdot x \\cdot x$, the coefficient is $6$ and the exponent is $2$.",
        "The constant term has no variable: $8$.",
      ],
      answer: "Coefficient $6$, exponent $2$, constant term $8$.",
    },
    methodTitle: "Sums and products",
    methodText: [
      "$3(x + 6)$ multiplies $3$ by $(x + 6)$, so it is a product with two factors. One factor, $x + 6$, is itself a sum of two terms.",
      "$3x + 6$ adds two terms, so it is a sum, even though its first term is a product.",
    ],
    formal:
      "An expression's structure is a tree of operations; its outermost operation determines whether it is a sum, difference, product or quotient. In a polynomial $a_n x^n + \\dots + a_1 x + a_0$, each $a_k$ is the coefficient of $x^k$ and $a_0$ is the constant term.",
    pitfalls: [
      "Do not confuse the exponent with the coefficient: in $5x^2$ the coefficient is 5, not 2.",
      "A number in front of parentheses multiplies the whole group.",
    ],
    parentGuide:
      "Point to each part of an expression and ask your learner to name it: term, coefficient, exponent or constant.",
  },
];

const stripFormat = (e: Entry): ProblemMethod => ({
  goal: e.summary,
  intuition: e.intuition,
  terms: e.terms,
  method: e.method,
  watch: e.watch,
});

export const multiPartChoiceMethods: Record<string, ProblemMethod> =
  Object.fromEntries(entries.map((e) => [e.id, stripFormat(e)]));

export const multiPartChoicePrinciples: Record<string, string> =
  Object.fromEntries(entries.map((e) => [e.id, e.principle]));

export const multiPartChoiceLessons: Lesson[] = entries.map((e) => ({
  id: e.id,
  title: e.title,
  summary: e.summary,
  templateIds: [e.id],
  objectives: [...e.objectives],
  sections: [
    {
      stage: "intuition",
      title: "What the question asks",
      paragraphs: [e.intuition],
    },
  ],
  workedExample: e.example,
  closingSections: [
    { stage: "method", title: e.methodTitle, paragraphs: e.methodText },
    { stage: "formal", title: "Why the method works", paragraphs: [e.formal] },
  ],
  pitfalls: e.pitfalls,
  parentGuide: e.parentGuide,
}));
