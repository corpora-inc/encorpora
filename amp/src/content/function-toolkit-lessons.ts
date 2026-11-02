import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

/** Glossary readings for the piecewise lesson and its two methods. */
const PIECE_SENSES = {
  side: "side-of-equation",
  sides: "side-of-equation",
  term: "term-expression",
  terms: "term-expression",
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
    senses: { ...PIECE_SENSES, rule: "rule", rules: "rule" },
    noLink: PIECE_NO_LINK.filter((w) => !["rule", "rules"].includes(w)),
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
          "The absolute value is a number's distance from 0, written with bars: $|-3| = 3$. So $|u| = u$ when $u \\ge 0$, and $|u| = -u$ when $u < 0$, which turns a negative number (a number less than 0) positive.",
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
      "A transformation moves, stretches or flips a graph. Here $f(x)$, read “$f$ of $x$”, is the output of the function $f$ for the input $x$. A change outside $f$, as in $f(x) + 3$, acts on the outputs, the heights: every point moves up 3. A change inside, as in $f(x + 3)$, acts on the inputs and works backwards: every point moves 3 to the left.",
    templateIds: ["transform-equation", "transform-point"],
    includeGeneratedRepresentation: false,
    senses: {
      rule: "rule",
      squared: "square-number",
      vertex: "vertex-parabola",
      side: "side-of-equation",
      sides: "side-of-equation",
      unit: "unit",
      units: "unit",
    },
    noLink: ["change", "changes", "whole", "image", "mirror image"],
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
          "A function is a rule that gives each allowed input exactly one output. On its graph, the input is the $x$-coordinate (how far across) and the output is the $y$-coordinate (the height). Adding $k$ outside, $f(x)+k$, adds $k$ to every height. So the graph moves up $k$, or down if $k$ is negative.",
          "Multiplying outside, $af(x)$, multiplies every height by $a$. With $a = 3$, the heights 1, 2 and 4 become 3, 6 and 12. Here $|a|$, the absolute value of $a$, is its size without its sign. If $|a|>1$, the graph stretches away from the $x$-axis. If $0<|a|<1$, it is squashed toward the $x$-axis. A negative $a$ also flips (reflects) the graph across the $x$-axis. If $a=0$, every height is 0, so the graph flattens onto the $x$-axis, over the same inputs as before.",
          "Changing the input works backwards. The graph of $f(x-3)$ reaches the old input 0 when $x-3=0$, which is at $x = 3$. So that point moves from $x = 0$ to $x = 3$, and the whole graph moves 3 to the right. The graph of $f(2x)$ reaches the old input 4 when $2x=4$, at $x = 2$. So every $x$-coordinate is divided by 2.",
          "To build an equation, do the steps in this order: shift sideways, then stretch or flip, then shift up or down. A stretch multiplies heights, so a shift added after it is not stretched. Start with $y = x^2$ ($x$ squared, $x$ times $x$), a U-shaped graph with its lowest point, the vertex, at $(0, 0)$. Moving it 1 right gives $y = (x - 1)^2$. Multiplying by $-2$ stretches and flips it: $y = -2(x - 1)^2$. Moving it 3 up gives $y = -2(x - 1)^2 + 3$. Its vertex is now the highest point, $(1, 3)$.",
        ],
        illustration: "transform-parent",
      },
      {
        title: "Following a point, and symmetry",
        paragraphs: [
          "Suppose $(2, 5)$ is on $y = f(x)$, so $f(2) = 5$. The graph of $y = f(x + 3)$ has height 5 where its input $x + 3$ equals 2. That happens at $x = -1$, so the point moves to $(-1, 5)$. On $y = 2f(x) - 1$ the input is not changed. The height becomes $2 \\cdot 5 - 1 = 9$, so the point moves to $(2, 9)$.",
          "$y = f(-x)$ flips (reflects) the graph across the $y$-axis, as in a mirror standing on that axis. $y = -f(x)$ reflects it across the $x$-axis. A function is called even when $f(-x) = f(x)$ for every allowed $x$. Its graph is its own mirror image across the $y$-axis, like $y = x^2$. A function is called odd when $f(-x) = -f(x)$ for every allowed $x$. Its graph looks the same after a half turn about the origin, the point $(0, 0)$, like $y = x^3$.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "The point $(2,5)$ is on the graph of $y=f(x)$. Where does this point move on the graph of $y=f(x+3)$? Give its new $x$-coordinate.",
      steps: [
        "The point $(2, 5)$ on $y = f(x)$ means $f(2) = 5$: the input 2 gives the height 5.",
        "$y = f(x + 3)$ puts $x + 3$ into $f$. So it has height 5 where its input $x + 3$ equals 2.",
        "Subtract 3 from both sides of $x + 3 = 2$ to get $x$ alone: $x = 2 - 3 = -1$. The point moves to $(-1, 5)$, 3 units to the left.",
      ],
      answer: "−1",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "$y = af(x - h) + k$ moves every point $\\left(x, y\\right)$ of $y = f(x)$ to $\\left(x + h, ay + k\\right)$.",
          "Outside changes act on the outputs directly. Inside changes act on the inputs in reverse, because the new graph must reach the old input. For $f(x - h)$, the old input $x$ is reached at $x + h$.",
        ],
      },
    ],
    pitfalls: [
      "$f(x + 3)$ moves the graph 3 to the left, not right. To check, solve $x + 3 = 0$: the old input 0 is now at $x = -3$.",
      "A shift up after a stretch is not stretched: stretch by 2, then move up 3, gives $y = 2f(x) + 3$, not $2(f(x) + 3)$.",
      "$-f(x)$ reflects across the $x$-axis. $f(-x)$ reflects across the $y$-axis.",
    ],
    parentGuide:
      "Graph $y = x^2$ from a small table, then ask where the point $(1, 1)$ goes under each change: 2 right, then times 3, then 1 down. Check by substituting into the new equation.",
  },
  {
    id: "function-composition",
    title: "Composing functions",
    summary:
      "A function is a rule that gives each allowed input exactly one output. Composing two functions means feeding the output of one into the next, like two machines in a row. In $f(g(x))$, read “$f$ of $g$ of $x$”, first apply $g$ to $x$. Then put that output into $f$. Each function must be able to take the number it is given.",
    templateIds: ["composition-value", "composition-expression"],
    includeGeneratedRepresentation: false,
    senses: {
      rule: "rule",
      square: "square-number",
      squares: "square-number",
      squaring: "square-number",
    },
    noLink: ["whole"],
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
          "Take $g(x)=x^2+1$ and $f(x)=2x-3$. Here $x^2$ means $x$ times $x$. Put the input 3 into $g$: $g(3)=3^2+1=10$. Then put 10 into $f$: $f(10)=2 \\cdot 10-3=17$. So $f(g(3)) = 17$. The function $g$ is called the inner function, and $f$ is the outer function.",
          "Using one function's output as the next function's input is called composition. We also write $(f\\circ g)(x)$, read “$f$ composed with $g$ of $x$”, for $f(g(x))$. The order matters. In the other order, $f(3) = 2 \\cdot 3 - 3 = 3$, and then $g(3) = 10$. So $g(f(3)) = 10$, not 17.",
          "From a table or a graph, read the inner value first. Then look up the outer function at that value.",
        ],
        illustration: "composition-machine",
      },
      {
        title: "Composing expressions",
        paragraphs: [
          "To write $f(g(x))$ as one expression, replace every $x$ in the rule for $f$ with the whole of $g(x)$, in parentheses. The parentheses keep $g(x)$ together as one input. So $f(g(x)) = 2(x^2 + 1) - 3 = 2x^2 + 2 - 3 = 2x^2 - 1$.",
          "In the other order, $g(f(x)) = (2x - 3)^2 + 1$. Squaring means multiplying by itself: $(2x - 3)(2x - 3) = 4x^2 - 12x + 9$. So $g(f(x)) = 4x^2 - 12x + 10$.",
          "Going backwards is called decomposing. The function $h(x) = (3x - 1)^2 + 4$ first works out $3x - 1$, then squares it and adds 4. So $h = f \\circ g$, with inner function $g(x) = 3x - 1$ and outer function $f(x) = x^2 + 4$.",
          "The domain of a function is the set of inputs it allows. $f(g(x))$ is undefined wherever $g(x)$ is outside the domain of $f$. For example, $f(x) = \\frac{1}{x - 5}$ cannot take the input 5, because it would divide by 0. So $f(g(x))$ is undefined wherever $g(x) = 5$.",
        ],
      },
    ],
    workedExample: {
      prompt: "Let $f(x) = 2x - 3$ and $g(x) = x^2 + 1$. What is $f(g(3))$?",
      steps: [
        "Work from the inside out, because $f$ needs the output of $g$ as its input. $g(3) = 3^2 + 1 = 9 + 1 = 10$.",
        "Now put 10 into $f$: $f(10) = 2 \\cdot 10 - 3 = 20 - 3 = 17$.",
      ],
      answer: "17",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "The composition $f(g(x))$ is defined exactly for the inputs $x$ in the domain of $g$ whose output $g(x)$ lies in the domain of $f$.",
          "Substituting the inner expression for every $x$ in the outer function gives the composite, the combined function, as a single expression.",
        ],
      },
    ],
    pitfalls: [
      "$f(g(x))$ is not $f(x)$ times $g(x)$. The functions are used one after the other, not multiplied.",
      "Work from the inside out: in $f(g(2))$, find $g(2)$ first.",
      "Substitute the whole inner expression in parentheses and square all of it: $(2x - 3)^2 = 4x^2 - 12x + 9$, not $4x^2 - 9$.",
    ],
    parentGuide:
      "Act out two machines: one adds 1, the next doubles. Put 3 through in both orders and compare the outputs, 8 and 7.",
  },
  {
    id: "inverse-functions",
    title: "Inverse functions",
    summary:
      "An inverse function undoes a function. If $f$ turns 5 into 8, its inverse turns 8 back into 5. We write the inverse as $f^{-1}$, read “$f$ inverse”. It exists only when each output comes from just one input, so there is exactly one input to send it back to.",
    templateIds: ["inverse-value", "inverse-expression"],
    includeGeneratedRepresentation: false,
    senses: {
      side: "side-of-equation",
      sides: "side-of-equation",
      vertex: "vertex-parabola",
    },
    noLink: ["inverse"],
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
          "$f^{-1}(8)$ asks which input $f$ sends to 8. For $f(x) = 3x - 7$, solve $3x - 7 = 8$. Add 7 to both sides: $3x = 15$. Divide both sides by 3: $x = 5$. So $f^{-1}(8) = 5$.",
          "In a table, find 8 among the outputs and read its input. On a graph, start at 8 on the $y$-axis and go across to the curve. Then go down to the $x$-axis and read the input.",
          "For a formula, write $y = f(x)$, swap $x$ and $y$, and solve for $y$. Swapping trades the roles of input and output. From $y = 2x - 3$, swapping gives $x = 2y - 3$. Add 3 to both sides: $x + 3 = 2y$. Divide by 2: $y = \\frac{x + 3}{2}$. So $f^{-1}(x) = \\frac{x + 3}{2}$.",
          "Swapping the coordinates of every point flips the graph across the line $y = x$, like a mirror. The point $(4, 5)$ on the graph of $f$ becomes $(5, 4)$ on the graph of $f^{-1}$.",
        ],
        illustration: "inverse-reflection",
      },
      {
        title: "Restricting the domain",
        paragraphs: [
          "$f(x)=x^2$ ($x$ times $x$) sends both 2 and $-2$ to 4. An inverse could not know whether to send 4 back to 2 or to $-2$. A function is called one-to-one when no two inputs give the same output. So $x^2$ is not one-to-one on all real numbers, and it has no inverse function there.",
          "The domain of a function is the set of inputs it allows. Restricting the domain means allowing fewer inputs. If only $x\\ge0$ (0 or more) is allowed, $x^2$ is one-to-one. Its inverse is $\\sqrt{x}$, the square root that is 0 or positive. If only $x\\le0$ is allowed, the inverse is $-\\sqrt{x}$.",
          "The graph of $f(x)=(x-h)^2+k$ is a parabola, a U-shaped curve, with its lowest point (its vertex) at $(h, k)$. Each half of the curve, left or right of the vertex, is one-to-one. On $x\\ge h$, $f^{-1}(x)=h+\\sqrt{x-k}$. On $x\\le h$, $f^{-1}(x)=h-\\sqrt{x-k}$. Both formulas need $x\\ge k$, because a negative number has no real square root. Other one-to-one pieces are possible. These two halves each keep every output of the parabola.",
        ],
        illustration: "inverse-restricted",
      },
    ],
    workedExample: {
      prompt: "Let $f(x) = 3x - 7$. What is $f^{-1}(8)$?",
      steps: [
        "$f^{-1}(8)$ is the input $x$ that $f$ sends to 8. So solve $f(x) = 8$, which is $3x - 7 = 8$.",
        "Add 7 to both sides to undo the $-7$: $3x = 15$. Divide both sides by 3 to undo the multiplying: $x = 5$.",
        "Check by putting 5 into $f$: $f(5) = 3 \\cdot 5 - 7 = 8$. It gives 8, so $f^{-1}(8) = 5$.",
      ],
      answer: "5",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "An inverse reverses each input-output pair: $f(a) = b$ exactly when $f^{-1}(b) = a$. It exists exactly when $f$ is one-to-one on its domain.",
          "Swapping the coordinates of every point reflects a graph across the line $y = x$. The result is the graph of a function only when $f$ is one-to-one.",
        ],
      },
    ],
    pitfalls: [
      "$f^{-1}(x)$ is not $\\frac{1}{f(x)}$. The $-1$ here means “undo”, not “one divided by”.",
      "Undo the steps of $f$ in reverse order. For $3x - 7$, $f$ multiplies by 3 and then subtracts 7, so add 7 first, then divide by 3.",
      "A quadratic such as $x^2$ is not one-to-one. Keep only the inputs left of its vertex, or only those right of it, before finding an inverse function.",
    ],
    parentGuide:
      "Make a two-row table of a function, then swap the rows. Ask whether the swapped table is still a function: it is only if no output appeared twice.",
  },
  {
    id: "cross-representation-comparison",
    title: "Comparing functions across representations",
    summary:
      "The same function can be given three ways: by a formula, by a graph or by a table of values. To compare two functions given in different ways, find the same feature in each. For example, find each one's greatest output, or each one's output at $x = 0$. Then compare the two numbers.",
    templateIds: ["compare-representations"],
    includeGeneratedRepresentation: false,
    senses: {
      "standard form": "standard-form-polynomial",
      vertex: "vertex-parabola",
    },
    noLink: ["part", "sides", "change", "changes", "average"],
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
          "From a formula, compute the feature. $f(x) = -(x - 1)^2 + 5$ is a quadratic, a function with an $x^2$ ($x$ times $x$) part and no higher power. Its graph is a parabola, a U-shaped curve, here upside down because of the minus sign in front. Its highest point, the vertex, is $(1, 5)$. So its maximum, its greatest output, is 5.",
          "A quadratic can also be written in standard form, $ax^2+bx+c$. Here $a$, $b$ and $c$ are fixed numbers and $a\\ne0$. Its vertex is at $x=-\\frac{b}{2a}$. Put that $x$ into the formula to get the greatest or least output.",
          "From a table of a quadratic, use symmetry: a parabola is the same on both sides of its vertex. Take the table $g(-3) = -1$, $g(-2) = 2$, $g(-1) = 3$, $g(0) = 2$, $g(1) = -1$. The outputs match in pairs around $x = -1$. So the vertex is $(-1, 3)$ and the maximum is 3. So $f$ has the greater maximum.",
        ],
        illustration: "compare-formula-table",
      },
      {
        title: "Intercepts and rates",
        paragraphs: [
          "The $y$-intercept is where the graph crosses the $y$-axis, so it is the output at $x = 0$. For $f(x) = 3 \\cdot 2^x - 1$, it is $3 \\cdot 2^0 - 1 = 3 \\cdot 1 - 1 = 2$, because $2^0 = 1$. On a graph, read where the curve crosses the $y$-axis. In a table, read the output for the input 0.",
          "The average rate of change says how much the output changes for each 1 added to the input, on average. From $x = 0$ to $x = 2$ it is $\\frac{f(2) - f(0)}{2 - 0}$, the change in output divided by the change in input. For $f(x) = 3 \\cdot 2^x - 1$, $f(2) = 11$ and $f(0) = 2$. So the rate is $\\frac{11 - 2}{2} = \\frac{9}{2}$. From a table or a graph, use the same two inputs and do the same division.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "$f(x) = -(x - 1)^2 + 5$, and the quadratic function $g$ has $g(-3) = -1$, $g(-2) = 2$, $g(-1) = 3$, $g(0) = 2$ and $g(1) = -1$. Which function has the greater maximum value?",
      steps: [
        "$f(x) = -(x - 1)^2 + 5$ is in vertex form, $a(x - h)^2 + k$, which shows the vertex $(h, k)$. So its vertex is $(1, 5)$. The minus sign in front makes it open down, so the vertex is its highest point. The maximum of $f$ is 5.",
        "The outputs of $g$ match in pairs around $x = -1$: $g(-2) = g(0) = 2$ and $g(-3) = g(1) = -1$. So its vertex is at $x = -1$, and its maximum is $g(-1) = 3$.",
        "Compare the two maximums: 5 is greater than 3, so $f$ has the greater maximum.",
      ],
      answer: "$f$",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "A formula, a graph and a table can describe the same function. So the same feature, such as a maximum, a $y$-intercept or an average rate of change, can be found in each and compared as numbers.",
        ],
      },
    ],
    pitfalls: [
      "Compare the same feature: a maximum with a maximum, a rate with a rate.",
      "In a table, the largest entry is the maximum only if the table includes the vertex. Use the matching pairs of outputs to find it.",
      "An average rate of change divides the change in output by the change in input, not the other way round.",
    ],
    parentGuide:
      "Write one function as a formula and draw another, then ask which reaches higher and which starts higher. Have the learner point to where each number comes from.",
  },
];

export const functionToolkitMethods: Record<string, ProblemMethod> = {
  "piecewise-evaluate": {
    goal: "Find the output of a function that uses different rules for different inputs.",
    senses: { ...PIECE_SENSES, rules: "rule", rule: "rule" },
    noLink: PIECE_NO_LINK.filter((w) => !["rule", "rules"].includes(w)),
    intuition:
      "A function gives each input one output; $f(x)$, read “$f$ of $x$”, is the output for input $x$. A piecewise function uses different rules for different inputs. A condition next to each rule, such as $x < 2$ or $x \\ge 2$, says which inputs use it. The sign $\\le$ means “less than or equal to” and $\\ge$ means “greater than or equal to”.",
    terms: ["piecewise-function"],
    method: [
      "Test the input in each condition. Exactly one is true.",
      "At the number where the rule changes, $\\le$ and $\\ge$ include it, while $<$ and $>$ do not. On a graph, use the filled dot, not the open circle (an empty dot, which is left out).",
      "Put the input into that piece's rule only.",
    ],
    watch:
      "Choose the piece by its condition, never by which rule is listed first.",
  },
  "piecewise-reading": {
    goal: "Read a piecewise function: rewrite an absolute value in pieces, find a piece's rule, or count solutions.",
    senses: { ...PIECE_SENSES, rule: "rule", rules: "rule" },
    noLink: PIECE_NO_LINK.filter((w) => !["rule", "rules"].includes(w)),
    intuition:
      "A piecewise function uses different rules for different inputs, and its graph is made of pieces. A filled dot belongs to the graph; an open circle does not. The absolute value is a number's distance from 0, written with bars: $|-3| = 3$. So $|x - h|$ is one rule where $x - h$ is 0 or more, and another where it is negative.",
    method: [
      "For $|x - h|$, use $x - h$ where $x \\ge h$, and $-(x - h)$ where $x < h$. Then simplify each piece.",
      "For a straight piece on a graph, read two of its points to find its slope (rise over run). Then extend it back to $x = 0$ to find where it would cross the up-and-down axis.",
      "To count solutions of $f(x) = c$, follow the flat line $y = c$ and count where it meets the graph.",
    ],
    watch: "An open circle on the line is not a solution; a filled dot is.",
  },
  "transform-equation": {
    goal: "Match a graph that has been moved, stretched or flipped with its equation.",
    terms: ["parent-graph"],
    method: [
      "A shift of $h$ units right replaces $x$ with $x - h$, and a shift left uses $x + h$. The sign is reversed because the new graph must reach each old input.",
      "A vertical stretch by $a$ multiplies every output, every height, by $a$. So $a$ goes in front of the whole function. A negative $a$ also flips (reflects) the graph across the $x$-axis.",
      "A shift of $k$ up adds $k$ last, outside the stretch, so every height moves by exactly $k$.",
    ],
    watch:
      "Inside the function the sign is reversed: $f(x + 3)$ moves the graph 3 to the left.",
  },
  "transform-point": {
    goal: "Find where one point of a graph goes when the graph is moved, stretched or flipped, or use symmetry.",
    method: [
      "A change outside $f$ acts on the $y$-coordinate, the height. $y = af(x) + k$ sends height $v$ to $av + k$: multiply by $a$, then add $k$.",
      "A change inside $f$ acts on the $x$-coordinate. Solve for the $x$ that makes the new input equal the old $x$-coordinate, because there $f$ gives the old height.",
      "An even function has $f(-x) = f(x)$ for every allowed $x$, so $(-x, y)$ is on its graph whenever $(x, y)$ is. An odd function has $f(-x) = -f(x)$, so $(-x, -y)$ is on its graph whenever $(x, y)$ is.",
    ],
    watch:
      "For $f(3x)$, divide the old $x$-coordinate by 3, because $3x$ must equal it. Do not multiply.",
  },
  "composition-value": {
    goal: "Evaluate a composition such as $f(g(2))$ from formulas, tables or graphs.",
    terms: ["composition"],
    method: [
      "Find the inner value first, such as $g(2)$, from its formula, table or graph. The outer function needs it as its input.",
      "Use that value as the input of the outer function, and find its output.",
      "For a domain question (which inputs are allowed), leave out inputs the inner function cannot take. Also leave out inputs whose inner output the outer function cannot take, such as one that makes it divide by 0.",
    ],
    watch: "$f(g(2))$ applies $g$ first, even though $f$ is written first.",
  },
  "composition-expression": {
    goal: "Write a composition as an expression, or split a function into an outer and an inner function.",
    noLink: ["part"],
    method: [
      "Replace every $x$ in the outer function with the whole inner expression, in parentheses, so it stays together as one input.",
      "Multiply out the parentheses. Then collect like terms, the terms with the same power of $x$.",
      "To decompose (split) a function, find the part worked out first, such as $3x - 1$ in $(3x - 1)^2 + 4$. That part is the inner function.",
    ],
    watch:
      "Square a two-term expression by multiplying it by itself: $(3x + 3)^2 = 9x^2 + 18x + 9$, with a middle term.",
  },
  "inverse-value": {
    goal: "Find a value of an inverse function from a formula, a table or a graph.",
    terms: ["inverse-function"],
    method: [
      "$f^{-1}(b)$ is the input whose output is $b$. So set $f(x) = b$.",
      "Solve that equation by undoing the steps of $f$ in reverse order. From a table, find $b$ among the outputs. From a graph, find the point at height $b$.",
      "Read the matching input, and check that $f$ of it gives $b$.",
    ],
    watch:
      "$f^{-1}(b)$ is not $f(b)$ and not $\\frac{1}{f(b)}$. Look for $b$ among the outputs, not the inputs.",
  },
  "inverse-expression": {
    goal: "Find an inverse function, restrict a domain so one exists, or mirror a point across the line $y = x$.",
    intuition:
      "An inverse function, written $f^{-1}$, undoes $f$: if $f$ sends $a$ to $b$, then $f^{-1}$ sends $b$ back to $a$. It exists only when $f$ is one-to-one, which means no two inputs give the same output. The domain is the set of allowed inputs. A quadratic such as $(x - 1)^2 + 3$ has a U-shaped graph, a parabola, that turns at its vertex. Inputs the same distance either side of the vertex give the same output, so only one side can be kept.",
    method: [
      "To find a formula, write $y = f(x)$, swap $x$ and $y$, and solve for $y$. Swapping trades inputs and outputs.",
      "If solving needs a square root, choose $+\\sqrt{\\ }$ or $-\\sqrt{\\ }$ so the inverse gives back inputs from the allowed side.",
      "A point $\\left(a, b\\right)$ on the graph of $f$ is the point $\\left(b, a\\right)$ on the graph of $f^{-1}$, its mirror image across the line $y = x$.",
      "A quadratic has an inverse only on one side of its vertex: $x \\ge h$ or $x \\le h$ when the vertex is at $x = h$.",
    ],
    watch:
      "$f^{-1}(x)$ undoes $f$. It is not $\\frac{1}{f(x)}$, one divided by $f(x)$.",
  },
  "compare-representations": {
    goal: "Compare a feature of a function given by a formula with the same feature of one given by a graph or table.",
    intuition:
      "The same function can be given by a formula, a graph or a table. To compare two of them, find the same feature in each and compare the numbers. A quadratic $ax^2 + bx + c$, with $a \\ne 0$, has a U-shaped graph called a parabola. Its turning point, the vertex, is at $x = -\\frac{b}{2a}$. The output there is the maximum (greatest output) if $a < 0$, or the minimum (least output) if $a > 0$. The $y$-intercept is the output at $x = 0$. An average rate of change is the change in output divided by the change in input.",
    method: [
      "From the formula: read the vertex $(h, k)$ from vertex form $a(x - h)^2 + k$, use $x = -\\frac{b}{2a}$ for $ax^2 + bx + c$, or substitute an input.",
      "From a graph, read the highest or lowest point, or the heights at the inputs you need. From a table, use its entries and the matching pairs of outputs around the vertex.",
      "Compare the two numbers, then check each statement against them.",
    ],
    watch:
      "Compare the same feature in both. An average rate of change divides the change in output by the change in input.",
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
    "Outside changes act on the outputs directly. Inside changes act on the inputs in reverse, because the new graph must reach the old input.",
  "composition-value":
    "A composition applies functions one after the other: the inner function's output is the outer function's input.",
  "composition-expression":
    "Substituting the inner expression for every $x$ in the outer function gives the composite, the combined function, as a single expression.",
  "inverse-value":
    "An inverse reverses each input-output pair: $f(a) = b$ exactly when $f^{-1}(b) = a$. It exists only when $f$ is one-to-one.",
  "inverse-expression":
    "Swapping the coordinates of every point reflects a graph across the line $y = x$. The result is the graph of a function only when $f$ is one-to-one.",
  "compare-representations":
    "A formula, a graph and a table describe the same kind of object, so the same feature can be found in each and compared as numbers.",
};
