import type { GlossarySenses, MethodTerm } from "../glossary/types";
import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

type Entry = {
  id: string;
  title: string;
  /** The practice-screen task, at most 140 characters; defaults to the summary. */
  goal?: string;
  summary: string;
  senses?: GlossarySenses;
  noLink?: string[];
  objectives: [string, string];
  intuition: string;
  terms: MethodTerm[];
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
    goal: "Find a line's slope and $y$-intercept from two points, a graph or a table, and say whether $y$ increases or decreases.",
    summary:
      "A line's slope is how much $y$ changes for each step of 1 to the right in $x$. Its $y$-intercept is the value of $y$ where the line crosses the $y$-axis, at $x = 0$. Two different points on a line that is not straight up and down give both. Together they make the rule $y = mx + b$.",
    senses: { change: "change", changes: "change", similar: "similar-figures" },
    noLink: ["rule"],
    objectives: [
      "Find the slope of a line from two of its points, its graph or a table of values.",
      "Find the $y$-intercept, write $y = mx + b$, and tell whether $y$ increases or decreases.",
    ],
    intuition:
      "The origin is the point $(0, 0)$, where the axes cross. A point is a location written as $(x, y)$: go $x$ across and $y$ up from the origin. The two numbers of a point are called its coordinates. Walk along a line from left to right. The slope is how far you rise, or fall, for each step of 1 to the right. It is the same for every step, which is what makes the line straight. The $y$-intercept is the height where the line crosses the $y$-axis, the up-and-down axis where $x = 0$. In $y = mx + b$, $m$ is the slope and $b$ is the $y$-intercept. To substitute means to put a number in place of a letter.",
    terms: ["slope", "y-intercept"],
    method: [
      "Take two different points of the line. Subtract in the same order: slope $m = \\frac{y_2 - y_1}{x_2 - x_1}$, where $x_1, y_1$ are the first point's coordinates and $x_2, y_2$ the second's.",
      "If a point has $x = 0$, its $y$ is the intercept. Otherwise substitute one point and $m$ into $y = mx + b$ and solve for $b$.",
      "A positive slope means $y$ increases as $x$ increases; a negative slope means it decreases.",
    ],
    watch:
      "Put the change in $y$ on top. Dividing the change in $x$ by the change in $y$ gives the wrong slope for most lines.",
    principle:
      "Any two different points of a line that is not vertical give the same slope $\\frac{y_2 - y_1}{x_2 - x_1}$, because the slope triangles between them are similar (the same shape). The line is then $y = mx + b$, where $b$ is the value of $y$ at $x = 0$.",
    example: {
      prompt:
        "A line passes through (2, 1) and (6, 3). Complete: the slope is ___, the $y$-intercept is ___, and as $x$ increases, $y$ ___.",
      steps: [
        "Slope is the change in $y$ over the change in $x$: $m = \\frac{3 - 1}{6 - 2} = \\frac{2}{4} = \\frac{1}{2}$.",
        "Substitute the point (2, 1) and $m = \\frac{1}{2}$ into $y = mx + b$: $1 = \\frac{1}{2} \\cdot 2 + b$, so $b = 1 - 1 = 0$. The line passes through the origin.",
        "The slope is positive, so $y$ increases as $x$ increases.",
      ],
      answer:
        "The slope is $\\frac{1}{2}$, the $y$-intercept is 0, and $y$ increases.",
    },
    methodTitle: "Check with the other point",
    methodText: [
      "After finding $m$ and $b$, substitute the second point. With $y = \\frac{1}{2}x$ and (6, 3): $\\frac{1}{2} \\cdot 6 = 3$. A mismatch means a sign or order slip.",
      "In a table, the slope is the change in $y$ divided by the change in $x$ between any two rows. Step back to $x = 0$ to read $b$.",
    ],
    formal:
      "For points $(x_1, y_1)$ and $(x_2, y_2)$ on $y = mx + b$ with $x_1 \\ne x_2$, subtracting $y_1 = mx_1 + b$ from $y_2 = mx_2 + b$ gives $y_2 - y_1 = m(x_2 - x_1)$. So $m = \\frac{y_2 - y_1}{x_2 - x_1}$ and $b = y_1 - mx_1$.",
    pitfalls: [
      "Subtract the coordinates in the same order on the top and the bottom.",
      "The first $y$-value in a table is the intercept only when its $x$ is 0.",
    ],
    parentGuide:
      "Ask your learner to check their slope and intercept by substituting the other point into $y = mx + b$.",
  },
  {
    id: "proportional-match-table",
    title: "Tell proportional relationships apart",
    goal: "Decide whether each equation or set of pairs is proportional, meaning $y = kx$ for one fixed number $k$.",
    summary:
      "A proportional relationship is one where $y$ is always the same number times $x$. That number is called the constant of proportionality, $k$, so $y = kx$ with $k$ not 0. A ratio is a comparison of two numbers, here $\\frac{y}{x}$, $y$ divided by $x$. Every pair with $x$ not 0 has the same ratio, $k$. And $x = 0$ goes with $y = 0$.",
    senses: {
      change: "change",
      changes: "change",
      side: "side-of-equation",
      sides: "side-of-equation",
    },
    noLink: ["part"],
    objectives: [
      "Decide whether an equation is proportional by rewriting it as $y = kx$.",
      "Decide whether a set of pairs is proportional by comparing the ratios $\\frac{y}{x}$.",
    ],
    intuition:
      "A proportional relationship is one where $y$ is always the same number times $x$. A ratio is a comparison of two numbers, such as $\\frac{y}{x}$. In a proportional relationship, doubling $x$ doubles $y$, and $x = 0$ goes with $y = 0$. The cost of apples at one price per pound works this way: 2 pounds cost twice as much as 1 pound. Adding a fixed fee breaks it: 2 pounds no longer cost twice as much as 1. A constant is a number that stays fixed, such as the 1 in $y = 2x + 1$. An equation is proportional only if it simplifies to $y = kx$, with no constant added. Parentheses, the curved brackets, group a part to do first: $3(x + 2)$ means 3 times $(x + 2)$. The origin is the point $(0, 0)$.",
    terms: ["constant-of-proportionality", "proportional-relationship"],
    method: [
      "Rewrite each equation as $y = \\dots$ and simplify: $2y = 8x$ becomes $y = 4x$, and $y = 3(x + 2) - 6$ becomes $y = 3x$.",
      "Proportional equations have the form $y = kx$: no added constant, no $x^2$ ($x$ times $x$), and no $x$ in a denominator, the bottom of a fraction.",
      "For a list of pairs, compute $\\frac{y}{x}$ for each pair with $x$ not 0. Proportional means every ratio is equal, and a pair with $x = 0$ must have $y = 0$.",
    ],
    watch:
      "A straight line is not enough. $y = 2x + 1$ is linear, but at $x = 0$ it gives $y = 1$, so it is not proportional.",
    principle:
      "$y$ is proportional to $x$ exactly when $y = kx$ for a constant $k \\ne 0$ ($k$ is not 0). Then $\\frac{y}{x} = k$ for every $x \\ne 0$, and the point (0, 0) fits the relationship. The graph is a line through the origin that rises $k$ for each step of 1 in $x$.",
    example: {
      prompt:
        "Proportional or not: $y = 5x$, $y = 5x + 2$, $y = 4(x + 1) - 4$, and the pairs (1, 3), (2, 5), (3, 7)?",
      steps: [
        "$y = 5x$ already has the form $y = kx$, with $k = 5$: proportional.",
        "$y = 5x + 2$ gives $y = 2$ at $x = 0$, not 0: not proportional.",
        "Multiply out and simplify: $y = 4(x + 1) - 4 = 4x + 4 - 4 = 4x$. That is proportional.",
        "$\\frac{3}{1} = 3$ but $\\frac{5}{2} = 2.5$: the ratios differ, so the pairs are not proportional.",
      ],
      answer:
        "Proportional: $y = 5x$ and $y = 4(x + 1) - 4$. Not proportional: $y = 5x + 2$ and the pairs.",
    },
    methodTitle: "Two quick tests",
    methodText: [
      "The origin test: put in $x = 0$. A proportional relationship gives $y = 0$; anything else fails at once.",
      "The ratio test: for every pair with $x$ not 0, $\\frac{y}{x}$ must be the same number. Both tests must pass: $y = x^2$ passes through the origin, but its ratio changes.",
    ],
    formal:
      "If $y = kx$ with $k \\ne 0$, then $\\frac{y}{x} = k$ for all $x \\ne 0$. Conversely, if $\\frac{y}{x} = k$ for every pair with $x \\ne 0$ and (0, 0) is included, then $y = kx$. A relationship $y = kx + c$ with $c \\ne 0$ has $\\frac{y}{x} = k + \\frac{c}{x}$, which changes with $x$.",
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
    goal: "Name the terms, coefficients, exponents and constant term of an expression, and say whether it is a sum or a product.",
    summary:
      "An expression is a math phrase made of numbers, letters and operations, such as $4x + 9y + 2$. A letter that stands for a number is called a variable. A term is one piece of an expression, joined to the others by + or −. A coefficient is the number in front of a variable. A term with no variable is called the constant term.",
    senses: {
      term: "term-expression",
      terms: "term-expression",
      factor: "factor-number",
      factors: "factor-number",
      product: "product-multiply",
      products: "product-multiply",
      difference: "difference-subtract",
    },
    noLink: ["part", "parts", "whole"],
    objectives: [
      "Identify the terms, coefficients and constant term of an expression.",
      "Describe an expression as a sum or a product, and name its factors.",
    ],
    intuition:
      "An expression is a math phrase made of numbers, letters and operations. A letter that stands for a number is called a variable. Read $4x + 9y + 2$ like a shopping list: 4 of item $x$, 9 of item $y$, and 2 more on their own. Each listed item is a term. The count in front of a variable is its coefficient, and the lone number is the constant term. An exponent is a small raised number that counts repeated factors: $x^2$ means $x \\cdot x$. A product is the result of multiplying, and the parts being multiplied are called factors. Parentheses, the curved brackets, group a part to do first.",
    terms: [
      "term-expression",
      "coefficient",
      "constant-term",
      ["factor-number", "In $3(x + 6)$, the factors are 3 and $(x + 6)$."],
    ],
    method: [
      "Split the expression at each + or − outside parentheses to list its terms.",
      "In each term, the number in front is the coefficient. An exponent counts the factors of the variable: $x^3$ is $x \\cdot x \\cdot x$.",
      "Find the last operation you would do. If it is multiplication, the expression is a product of factors. If it is addition, it is a sum of terms.",
    ],
    watch:
      "The coefficient is only the number. In $9y$ the coefficient is 9, while the term is all of $9y$.",
    principle:
      "An expression is built by operations, and the last operation names the whole: a sum of terms or a product of factors. In a term $ax^n$, $a$ is the coefficient and $n$ is the exponent, so $ax^n$ multiplies $a$ by $n$ factors of $x$.",
    example: {
      prompt:
        "In $6x^2 + 5x + 8$, name the coefficient of $x^2$, the exponent of $x$ in the first term, and the constant term.",
      steps: [
        "Split at the + signs: the terms are $6x^2$, $5x$ and 8.",
        "In $6x^2 = 6 \\cdot x \\cdot x$, the coefficient is 6 and the exponent is 2.",
        "The constant term is the term with no variable: 8.",
      ],
      answer: "Coefficient 6, exponent 2, constant term 8.",
    },
    methodTitle: "Sums and products",
    methodText: [
      "$3(x + 6)$ multiplies 3 by $(x + 6)$, so it is a product with two factors. One factor, $x + 6$, is itself a sum of two terms.",
      "$3x + 6$ adds two terms, so it is a sum, even though its first term is a product.",
    ],
    formal:
      "An expression's structure is a tree of operations. Its last operation decides whether it is a sum, difference, product or quotient (the result of dividing). A polynomial is a sum of terms, each a number times a power of $x$: $a_n x^n + \\dots + a_1 x + a_0$. Each $a_k$ is the coefficient of $x^k$, and $a_0$ is the constant term.",
    pitfalls: [
      "Do not confuse the exponent with the coefficient: in $5x^2$ the coefficient is 5, not 2.",
      "A number in front of parentheses multiplies the whole group.",
    ],
    parentGuide:
      "Point to each part of an expression and ask your learner to name it: term, coefficient, exponent or constant.",
  },
];

const glossaryFields = (e: Entry) => ({
  ...(e.senses ? { senses: e.senses } : {}),
  ...(e.noLink ? { noLink: e.noLink } : {}),
});

const stripFormat = (e: Entry): ProblemMethod => ({
  goal: e.goal ?? e.summary,
  ...glossaryFields(e),
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
  ...glossaryFields(e),
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
