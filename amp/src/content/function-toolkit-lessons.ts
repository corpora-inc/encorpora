import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

/** Glossary readings for the piecewise lesson and its two methods. */
const PIECE_SENSES = {
  side: "side-of-equation",
  sides: "side-of-equation",
  boundary: "boundary",
  vertex: "vertex-parabola",
} as const;
const PIECE_NO_LINK = [
  "whole",
  "part",
  "parts",
  "change",
  "changes",
  "opposite",
  "mean",
  "means",
  "rule",
  "rules",
  "leaves",
];

/** The function toolkit: functions defined in pieces, transformations of
 * graphs, composition, inverses, and comparing functions across
 * representations. */
export const functionToolkitLessons: Lesson[] = [
  {
    id: "piecewise-functions",
    title: "Functions defined in pieces",
    summary:
      "A function is a rule that turns each input (the number you put in) into exactly one output (the number you get back). A piecewise function uses different rules for different inputs. For example, with input $x$: use $2x + 1$ when $x$ is less than 2, but use $-x + 6$ when $x$ is 2 or more. First find which rule your input belongs to. Then use that rule alone.",
    templateIds: ["piecewise-evaluate", "piecewise-reading"],
    includeGeneratedRepresentation: false,
    senses: PIECE_SENSES,
    noLink: PIECE_NO_LINK,
    objectives: [
      "Find the output of a piecewise function for any input, including the inputs where the rule changes.",
      "Read a piecewise graph: open circles, filled dots, and the rule for each piece.",
      "Write $|x - h| + k$ as two straight pieces, and count solutions on a piecewise graph.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "One input, one rule",
        paragraphs: [
          "A function gives each allowed input one output. We write $f(x)$, read “$f$ of $x$”, for the output when the input is $x$. A piecewise function uses one rule for some inputs and another rule for the rest.",
          "A condition next to each rule says which inputs use it. The sign $<$ means “is less than”, and $\\ge$ means “is greater than or equal to”. The number where the rule changes is called the boundary. A condition with $<$ leaves the boundary out; one with $\\ge$ includes it.",
          "So first choose the rule, by checking which condition your input makes true. Then put the input into that rule.",
        ],
      },
      {
        title: "Read a two-rule function",
        paragraphs: [
          "Look at $f(x)=\\begin{cases}2x+1&x<2\\\\-x+6&x\\ge2\\end{cases}$. The curly bracket lists the rules, each with its condition on the right. The conditions split the number line at 2, with no overlap.",
          "For $x=1$: $1 < 2$, so use the first rule. $f(1)=2 \\cdot 1+1=3$. For $x=2$: $2 \\ge 2$, so use the second rule. $f(2)=-2+6=4$.",
          "On the graph, the left piece ends in an open (empty) circle at $(2,5)$, and the right piece starts with a filled dot at $(2,4)$. Only the filled dot is part of the graph.",
        ],
        illustration: "piecewise-pieces",
      },
      {
        title: "Absolute value as two pieces",
        paragraphs: [
          "The absolute value of a number is its distance from 0, written with bars: $|-3| = 3$. So $|u| = u$ when $u \\ge 0$, and $|u| = -u$ when $u < 0$, which turns a negative number positive.",
          "That makes $|x - 1| + 2$ a piecewise function. For $x \\ge 1$ it is $(x - 1) + 2 = x + 1$. For $x < 1$ it is $-(x - 1) + 2 = -x + 3$. These are two straight pieces that meet at the corner point $(1, 2)$, called the vertex.",
          "To solve $f(x) = c$ on a graph, draw the flat line $y = c$. The $x$ values where it meets the graph are the solutions, and counting the meeting points tells how many there are. A filled dot on the line counts; an open circle does not.",
        ],
        illustration: "abs-pieces",
      },
    ],
    workedExample: {
      prompt:
        "Let $f(x) = \\begin{cases} 2x + 1 & x < 2 \\\\ -x + 6 & x \\ge 2 \\end{cases}$. What is $f(2)$?",
      steps: [
        "Check the conditions with $x = 2$. $2 < 2$ is false, but $2 \\ge 2$ is true, so use the second rule, $f(x) = -x + 6$.",
        "Put 2 into that rule only: $f(2) = -2 + 6 = 4$.",
      ],
      answer: "4",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "A function gives each input one output. A piecewise function does this with conditions that do not overlap, so exactly one rule applies to each input.",
          "$|u|$ equals $u$ where $u \\ge 0$, and $-u$ where $u < 0$. The solutions of $f(x) = c$ are the inputs (the $x$ values) where the graph meets the line $y = c$, at points that belong to the graph.",
        ],
      },
    ],
    pitfalls: [
      "Use one rule only. The condition that the input makes true picks it.",
      "At a boundary, read the signs: $\\le$ and $\\ge$ include the boundary, $<$ and $>$ do not.",
      "An open circle is not a point of the graph.",
    ],
    parentGuide:
      "Draw a number line, mark where the rule changes, and shade each condition in its own color. Ask which color an input lands in before working anything out.",
  },
  {
    id: "function-transformations",
    title: "Moving and stretching graphs",
    summary:
      "Moving, stretching, or reflecting a graph changes where its points appear. A change inside the input acts horizontally; a change outside acts on outputs.",
    templateIds: ["transform-equation", "transform-point"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Match shifts, stretches and reflections of $y = x^2$, $y = |x|$, $y = \\sqrt{x}$ and $y = x^3$ with their equations.",
      "Follow one point of a graph through a transformation.",
      "Use even and odd symmetry: $f(-x) = f(x)$ and $f(-x) = -f(x)$.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Inside changes inputs, outside changes outputs",
        paragraphs: [
          "A function assigns one output to each allowed input. On its graph, changing the output changes the point's height. Adding $k$ outside, $f(x)+k$, adds $k$ to every height. Multiplying outside, $af(x)$, multiplies each height by $a$: $|a|>1$ stretches away from the $x$-axis, $0<|a|<1$ compresses toward it, a negative $a$ also reflects across it, and $a=0$ flattens the graph to $y=0$.",
          "Changing the input works backwards. The point with old input 0 moves to input 3 under $f(x-3)$, because $x-3=0$ there: the graph moves 3 to the right. Under $f(2x)$, the point with old input 4 moves to input 2, because $2x=4$ there: every $x$-coordinate is divided by 2.",
          "Do the steps in this order: shift across, stretch or reflect, then shift up. $y = x^2$ moved 1 right, stretched by $-2$ and moved 3 up is $y = -2(x - 1)^2 + 3$, with vertex $(1, 3)$.",
        ],
        illustration: "transform-parent",
      },
      {
        title: "Following a point, and symmetry",
        paragraphs: [
          "If $(2, 5)$ is on $y = f(x)$, then $y = f(x + 3)$ has height 5 where $x + 3 = 2$, at $x = -1$: the point moves to $(-1, 5)$. On $y = 2f(x) - 1$ it moves to $(2, 2 \\cdot 5 - 1) = (2, 9)$.",
          "$y = f(-x)$ reflects the graph across the $y$-axis and $y = -f(x)$ across the $x$-axis. An even function equals its own reflection across the $y$-axis, $f(-x) = f(x)$; an odd function is unchanged by a half turn about the origin, $f(-x) = -f(x)$.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "The point $(2,5)$ is on the graph of $y=f(x)$. Where does this point move on the graph of $y=f(x+3)$? Give its new $x$-coordinate.",
      steps: [
        "$y = f(x + 3)$ has height 5 where its input $x + 3$ is 2, because $f(2) = 5$.",
        "$x + 3 = 2$ gives $x = 2 - 3 = -1$.",
      ],
      answer: "−1",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "$y = af(x - h) + k$ moves every point $\\left(x, y\\right)$ of $y = f(x)$ to $\\left(x + h, ay + k\\right)$.",
          "Outside changes act on outputs directly; inside changes act on inputs in reverse, because the new graph must reach the old input.",
        ],
      },
    ],
    pitfalls: [
      "$f(x + 3)$ moves the graph 3 to the left, not right: solve $x + 3 = 0$.",
      "A shift up after a stretch is not stretched: $y = 2f(x) + 3$, not $2(f(x) + 3)$.",
      "$-f(x)$ reflects across the $x$-axis; $f(-x)$ reflects across the $y$-axis.",
    ],
    parentGuide:
      "Graph $y = x^2$ from a small table, then ask where the point $(1, 1)$ goes under each change: 2 right, then times 3, then 1 down. Check by substituting into the new equation.",
  },
  {
    id: "function-composition",
    title: "Composing functions",
    summary:
      "A function gives each allowed input one output. In $f(g(x))$, first use $g$ on the input, then give its output to $f$; both steps must accept their inputs.",
    templateIds: ["composition-value", "composition-expression"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Evaluate $f(g(a))$ and $(f \\circ g)(a)$ from formulas, tables and graphs.",
      "Write $f(g(x))$ and $g(f(x))$ as expressions, and split a function into an outer and an inner function.",
      "Find the inputs excluded from the domain of a composition.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Inside first",
        paragraphs: [
          "A function gives each allowed input one output; its domain is the set of allowed inputs. Composition feeds one function's output into another. In $(f\\circ g)(x)=f(g(x))$, $g$ acts first and $f$ acts on its output. With $g(x)=x^2+1$ and $f(x)=2x-3$, the input 3 becomes $g(3)=10$, and then $f(10)=17$.",
          "The order matters: $g(f(3)) = g(3) = 10$, not 17. From a table or a graph, read the inner value first, then look up the outer function at that value.",
        ],
        illustration: "composition-machine",
      },
      {
        title: "Composing expressions",
        paragraphs: [
          "To write $f(g(x))$, replace every $x$ in $f$ with the whole of $g(x)$, in parentheses: $f(g(x)) = 2(x^2 + 1) - 3 = 2x^2 - 1$, while $g(f(x)) = (2x - 3)^2 + 1 = 4x^2 - 12x + 10$.",
          "Going backwards, $h(x) = (3x - 1)^2 + 4$ squares $3x - 1$ and adds 4, so $h = f \\circ g$ with $g(x) = 3x - 1$ and $f(x) = x^2 + 4$. And $f(g(x))$ is undefined wherever $g(x)$ is outside the domain of $f$: with $f(x) = \\frac{1}{x - 5}$, wherever $g(x) = 5$.",
        ],
      },
    ],
    workedExample: {
      prompt: "Let $f(x) = 2x - 3$ and $g(x) = x^2 + 1$. What is $f(g(3))$?",
      steps: [
        "Inside first: $g(3) = 3^2 + 1 = 10$.",
        "Then $f(10) = 2 \\cdot 10 - 3 = 17$.",
      ],
      answer: "17",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "The composition $f(g(x))$ is defined exactly for inputs $x$ in the domain of $g$ whose output $g(x)$ lies in the domain of $f$.",
          "Substituting the inner expression for every $x$ in the outer function gives the composite as a single expression.",
        ],
      },
    ],
    pitfalls: [
      "$f(g(x))$ is not the product $f(x)g(x)$.",
      "Work from the inside out: in $f(g(2))$, find $g(2)$ first.",
      "Substitute the whole inner expression in parentheses: $(2x - 3)^2$, not $2x^2 - 3^2$.",
    ],
    parentGuide:
      "Act out two machines: one adds 1, the next doubles. Put 3 through in both orders and compare the outputs, 8 and 7.",
  },
  {
    id: "inverse-functions",
    title: "Inverse functions",
    summary:
      "An inverse function reverses input and output: it returns the input that produced a given output. Each output must come from only one allowed input.",
    templateIds: ["inverse-value", "inverse-expression"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Find $f^{-1}(b)$ from a formula, a table or a graph by finding the input with output $b$.",
      "Find the inverse of a linear function by swapping $x$ and $y$ and solving.",
      "Restrict the domain of a quadratic so that it has an inverse, and choose the matching square root.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Undoing a function",
        paragraphs: [
          "$f^{-1}(8)$ asks which input $f$ sends to 8. For $f(x) = 3x - 7$, solve $3x - 7 = 8$: $3x = 15$, so $f^{-1}(8) = 5$. In a table, find 8 among the outputs and read its input; on a graph, go across from 8 on the $y$-axis to the curve and down to the $x$-axis.",
          "For a formula, write $y = f(x)$, swap $x$ and $y$, and solve for $y$. From $y = 2x - 3$, swapping gives $x = 2y - 3$, so $f^{-1}(x) = \\frac{x + 3}{2}$. Swapping coordinates reflects every point in the line $y = x$: $(4, 5)$ on $f$ is $(5, 4)$ on $f^{-1}$.",
        ],
        illustration: "inverse-reflection",
      },
      {
        title: "Restricting the domain",
        paragraphs: [
          "$f(x)=x^2$ sends both 2 and $-2$ to 4, so it has no inverse function on all real inputs: it is not one-to-one. Restricting its inputs to $x\\ge0$ gives the inverse $\\sqrt{x}$; restricting to $x\\le0$ gives $-\\sqrt{x}$.",
          "For $f(x)=(x-h)^2+k$, a convenient restriction is either full half of the parabola. On $x\\ge h$, $f^{-1}(x)=h+\\sqrt{x-k}$; on $x\\le h$, $f^{-1}(x)=h-\\sqrt{x-k}$. Both inverse formulas require $x\\ge k$. Other one-to-one subsets are possible; these halves keep the full range of the parabola.",
        ],
        illustration: "inverse-restricted",
      },
    ],
    workedExample: {
      prompt: "Let $f(x) = 3x - 7$. What is $f^{-1}(8)$?",
      steps: [
        "$f^{-1}(8)$ is the $x$ with $f(x) = 8$: $3x - 7 = 8$.",
        "$3x = 15$, so $x = 5$. Check: $f(5) = 3 \\cdot 5 - 7 = 8$.",
      ],
      answer: "5",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "An inverse reverses each input-output pair: $f(a) = b$ exactly when $f^{-1}(b) = a$.",
          "Swapping the coordinates of every point reflects a graph in $y = x$; the result is a function only when $f$ is one-to-one.",
        ],
      },
    ],
    pitfalls: [
      "$f^{-1}(x)$ is not $\\frac{1}{f(x)}$.",
      "Undo the steps of $f$ in reverse order: for $3x - 7$, add 7 first, then divide by 3.",
      "Restricting a quadratic to either half of its parabola is a convenient way to make it one-to-one before finding an inverse function.",
    ],
    parentGuide:
      "Make a two-row table of a function, then swap the rows. Ask whether the swapped table is still a function: it is only if no output appeared twice.",
  },
  {
    id: "cross-representation-comparison",
    title: "Comparing functions across representations",
    summary:
      "To compare a function given by a formula with one given by a graph or a table, find the same feature in each (a maximum, an intercept, an average rate of change) and compare numbers.",
    templateIds: ["compare-representations"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Find a maximum or minimum from vertex form, from standard form, from a graph and from a symmetric table.",
      "Find a $y$-intercept and an average rate of change from a formula, a graph or a table.",
      "Compare the two values and say which function's is greater.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "The same feature, read two ways",
        paragraphs: [
          "From a formula, compute: $f(x) = -(x - 1)^2 + 5$ has its highest point at the vertex $(1, 5)$, so its maximum is 5. A quadratic in standard form is $ax^2+bx+c$, where $a$, $b$ and $c$ are fixed numbers and $a\\ne0$; its vertex is at $x=-\\frac{b}{2a}$.",
          "From a table of a quadratic, use symmetry: in the table $g(-3) = -1$, $g(-2) = 2$, $g(-1) = 3$, $g(0) = 2$, $g(1) = -1$, the values match in pairs around $x = -1$, so the vertex is $(-1, 3)$ and the maximum is 3. So $f$ has the greater maximum.",
        ],
        illustration: "compare-formula-table",
      },
      {
        title: "Intercepts and rates",
        paragraphs: [
          "The $y$-intercept is the value at $x = 0$: for $f(x) = 3 \\cdot 2^x - 1$ it is $3 \\cdot 1 - 1 = 2$; on a graph, read where the curve crosses the $y$-axis.",
          "The average rate of change from $x = 0$ to $x = 2$ is $\\frac{f(2) - f(0)}{2 - 0}$: for $f(x) = 3 \\cdot 2^x - 1$ it is $\\frac{11 - 2}{2} = \\frac{9}{2}$. Compute the same quotient from two entries of a table or two points of a graph.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "$f(x) = -(x - 1)^2 + 5$, and the quadratic function $g$ has $g(-3) = -1$, $g(-2) = 2$, $g(-1) = 3$, $g(0) = 2$ and $g(1) = -1$. Which function has the greater maximum value?",
      steps: [
        "The maximum of $f$ is at its vertex $(1, 5)$: it is 5.",
        "The values of $g$ match in pairs around $x = -1$, so its vertex is $(-1, 3)$ and its maximum is 3.",
      ],
      answer: "$f$",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "A formula, a graph and a table describe the same kind of object, so the same feature can be found in each and compared as numbers.",
        ],
      },
    ],
    pitfalls: [
      "Compare the same feature: a maximum with a maximum, a rate with a rate.",
      "In a table, the largest entry is the maximum only if the table includes the vertex; use the symmetry of the values to find it.",
      "An average rate of change divides the change in output by the change in input.",
    ],
    parentGuide:
      "Write one function as a formula and draw another, then ask which reaches higher and which starts higher. Have the learner point to where each number comes from.",
  },
];

export const functionToolkitMethods: Record<string, ProblemMethod> = {
  "piecewise-evaluate": {
    goal: "Find the output of a function that uses different rules for different inputs.",
    senses: PIECE_SENSES,
    noLink: PIECE_NO_LINK,
    intuition:
      "A function gives each input one output; $f(x)$, read “$f$ of $x$”, is the output for input $x$. A piecewise function uses different rules for different inputs. A condition next to each rule, such as $x < 2$ or $x \\ge 2$, says which inputs use it. The sign $\\le$ means “less than or equal to” and $\\ge$ means “greater than or equal to”.",
    terms: ["piecewise-function"],
    method: [
      "Test the input in each condition. Exactly one is true.",
      "At the number where the rule changes, $\\le$ and $\\ge$ include it, while $<$ and $>$ do not. On a graph, use the filled dot, not the open circle.",
      "Put the input into that piece's rule only.",
    ],
    watch:
      "Choose the piece by its condition, never by which rule is listed first.",
  },
  "piecewise-reading": {
    goal: "Read a piecewise function: rewrite an absolute value in pieces, find a piece's rule, or count solutions.",
    senses: PIECE_SENSES,
    noLink: PIECE_NO_LINK,
    intuition:
      "A piecewise function uses different rules for different inputs, and its graph is made of pieces. A filled dot belongs to the graph; an open circle does not. The absolute value of a number is its distance from 0, written with bars: $|-3| = 3$. So $|x - h|$ is one rule where $x - h$ is 0 or more, and another where it is negative.",
    method: [
      "For $|x - h|$, use $x - h$ where $x \\ge h$, and $-(x - h)$ where $x < h$. Then simplify each piece.",
      "For a straight piece on a graph, read two of its points to find its slope (rise over run). Then extend it back to $x = 0$ to find where it would cross the up-and-down axis.",
      "To count solutions of $f(x) = c$, follow the flat line $y = c$ and count where it meets the graph.",
    ],
    watch: "An open circle on the line is not a solution; a filled dot is.",
  },
  "transform-equation": {
    goal: "Match a shifted, stretched or reflected graph with its equation.",
    terms: ["parent-graph"],
    method: [
      "A shift of $h$ right replaces $x$ with $x - h$; a shift left uses $x + h$.",
      "A vertical stretch by $a$ multiplies the whole output by $a$; a negative $a$ also reflects across the $x$-axis.",
      "A shift of $k$ up adds $k$ last, outside the stretch.",
    ],
    watch:
      "Inside the function the sign is reversed: $f(x + 3)$ moves the graph left.",
  },
  "transform-point": {
    goal: "Find where one point of a graph goes under a transformation, or use symmetry.",
    method: [
      "Changes outside $f$ act on the $y$-coordinate: $y = af(x) + k$ sends height $v$ to $av + k$.",
      "Changes inside $f$ act on the $x$-coordinate: solve for the $x$ that makes the input equal the old $x$.",
      "An even function has $f(-x) = f(x)$; an odd function has $f(-x) = -f(x)$.",
    ],
    watch: "For $f(3x)$ divide the old $x$ by 3; do not multiply.",
  },
  "composition-value": {
    goal: "Evaluate a composition such as $f(g(2))$ from formulas, tables or graphs.",
    terms: ["composition"],
    method: [
      "Find the inner value first: $g(2)$ from its formula, table or graph.",
      "Use that value as the input of the outer function.",
      "For a domain question, find the inputs that make the inner output an excluded input of the outer function.",
    ],
    watch: "$f(g(2))$ applies $g$ first, even though $f$ is written first.",
  },
  "composition-expression": {
    goal: "Write a composition as an expression, or split a function into an outer and an inner function.",
    method: [
      "Replace every $x$ in the outer function with the whole inner expression, in parentheses.",
      "Expand and collect like terms.",
      "To decompose, name the quantity that is being operated on as the inner function.",
    ],
    watch: "Square a whole binomial: $(3x + 3)^2$ has a middle term.",
  },
  "inverse-value": {
    goal: "Find a value of an inverse function from a formula, a table or a graph.",
    terms: ["inverse-function"],
    method: [
      "$f^{-1}(b)$ is the input with output $b$: set $f(x) = b$.",
      "Solve the equation, or find $b$ among the outputs of a table or the heights of a graph.",
      "Read the matching input, and check that $f$ of it gives $b$.",
    ],
    watch:
      "$f^{-1}(b)$ is not $f(b)$ and not $\\frac{1}{f(b)}$: search the outputs for $b$.",
  },
  "inverse-expression": {
    goal: "Find an inverse function, restrict a domain so one exists, or mirror a point in the line of symmetry.",
    method: [
      "Write $y = f(x)$, swap $x$ and $y$, and solve for $y$.",
      "For a square, keep the root whose sign matches the restricted domain.",
      "A point $\\left(a, b\\right)$ of $f$ is the point $\\left(b, a\\right)$ of $f^{-1}$, its mirror image in $y = x$.",
      "A quadratic has an inverse on one side of its vertex only.",
    ],
    watch:
      "$f^{-1}(x)$ undoes $f$; it is not the reciprocal $\\frac{1}{f(x)}$.",
  },
  "compare-representations": {
    goal: "Compare a feature of a function given by a formula with the same feature of one given by a graph or table.",
    method: [
      "From the formula: read the vertex form, use $x = -\\frac{b}{2a}$, or substitute.",
      "From a graph, read the highest or lowest point, or the heights at the two inputs; from a table, use its entries and symmetry.",
      "Compare the two numbers, and check each statement against them.",
    ],
    watch:
      "An average rate of change divides the change in output by the change in input.",
  },
};

export const functionToolkitPrinciples: Record<string, string> = {
  "piecewise-evaluate":
    "A function gives each input one output. A piecewise function does this with conditions that do not overlap, so exactly one rule applies to each input.",
  "piecewise-reading":
    "$|u|$ equals $u$ where $u \\ge 0$, and $-u$ where $u < 0$. The solutions of $f(x) = c$ are the inputs where the graph meets the line $y = c$.",
  "transform-equation":
    "$y = af(x - h) + k$ moves every point $\\left(x, y\\right)$ of $y = f(x)$ to $\\left(x + h, ay + k\\right)$.",
  "transform-point":
    "Outside changes act on outputs directly; inside changes act on inputs in reverse, because the new graph must reach the old input.",
  "composition-value":
    "A composition applies functions in sequence: the inner function's output is the outer function's input.",
  "composition-expression":
    "Substituting the inner expression for every $x$ in the outer function gives the composite as a single expression.",
  "inverse-value":
    "An inverse reverses each input-output pair: $f(a) = b$ exactly when $f^{-1}(b) = a$.",
  "inverse-expression":
    "Swapping the coordinates of every point reflects a graph in $y = x$; the result is a function only when $f$ is one-to-one.",
  "compare-representations":
    "A formula, a graph and a table describe the same kind of object, so the same feature can be found in each and compared as numbers.",
};
