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
    id: "graph-of-linear-rule",
    title: "Match a line with its graph",
    goal: "Choose the graph of a line from its rule, a table or words, by checking where it crosses the $y$-axis and how steeply it rises.",
    summary:
      "The graph of $y = mx + b$ is a straight line. It crosses the $y$-axis at the point $(0, b)$, and $b$ is called the $y$-intercept. The slope is how much the line rises for each step of 1 to the right, here $m$. Check both before choosing a graph.",
    senses: {
      rule: "rule",
      rules: "rule",
      term: "term-expression",
      side: "side-of-equation",
      sides: "side-of-equation",
      increasing: "increasing",
    },
    noLink: ["parts"],
    objectives: [
      "Read the slope and $y$-intercept of a line from $y = mx + b$, a table, words or $ax + y = c$.",
      "Choose the graph with that intercept and slope, ruling out sign, role and axis mix-ups.",
    ],
    intuition:
      "A rule is an equation that gives $y$ from $x$, such as $y = 2x + 1$. A point $(x, y)$ is $x$ across and $y$ up from $(0, 0)$, where the axes cross. The $y$-intercept is the $y$-value where a line crosses the $y$-axis. The slope is how much the line rises for each step of 1 to the right. Two facts pin down a line: where it crosses the $y$-axis, the up-and-down axis, and how steeply it climbs. Find the crossing point $(0, b)$ first. Then walk 1 step right and $m$ steps up, or down when $m$ is negative. The graph that passes through both points is the one. An equation has two sides: the parts to the left and right of the equals sign. A rule like $2x + y = 5$ becomes $y = -2x + 5$ when you subtract $2x$ from both sides.",
    terms: ["y-intercept", "slope"],
    method: [
      "Write the rule as $y = mx + b$: read $m$ and $b$, solve $ax + y = c$ for $y$, or find them in the table.",
      "Keep only graphs that cross the $y$-axis at $(0, b)$.",
      "From $(0, b)$, move 1 right and $m$ up (down when $m < 0$). For a fraction $\\frac{p}{q}$, move $q$ right and $p$ up. Choose the graph through that point.",
    ],
    watch:
      "The intercept $b$ sits on the $y$-axis at $(0, b)$, not on the $x$-axis at $(b, 0)$, and $m$ is the steepness, not the starting value.",
    principle:
      "Every point of the graph of $y = mx + b$ makes the equation true. At $x = 0$, $y = b$, so the graph crosses the $y$-axis at $(0, b)$. Adding 1 to $x$ adds $m$ to $y$, so the graph has slope $m$. Two different points fix exactly one straight line, so among straight-line graphs these two facts pick out the right one.",
    example: {
      prompt:
        "Which graph shows $y = -2x + 3$: a line through (0, 3) and (1, 1), a line through (0, 3) and (1, 5), a line through (0, −2) and (1, 1), or a line through (3, 0) and (2, 2)?",
      steps: [
        "The $y$-intercept is 3, so the line passes through (0, 3). That rules out the line through (0, −2), which swaps the slope and the intercept. It also rules out the line through (3, 0), which puts 3 on the $x$-axis.",
        "The slope is −2: from (0, 3), one step right and 2 steps down gives (1, 1).",
        "The line through (0, 3) and (1, 5) rises 2 for each step right: its slope is +2, the sign flipped.",
      ],
      answer: "The line through (0, 3) and (1, 1).",
    },
    methodTitle: "Check a second point",
    methodText: [
      "After choosing, test one more point of the graph in the rule. For $y = -2x + 3$ and the point (2, −1): $-2 \\cdot 2 + 3 = -1$. A point that fails means a different line.",
      "In a table, the $y$-intercept is the $y$-value in the row where $x = 0$. If no row has $x = 0$, step back by the slope until $x$ reaches 0.",
    ],
    formal:
      "The graph of $y = mx + b$ is the set of all points $(x, mx + b)$. It contains $(0, b)$ and $(1, m + b)$. A straight line that is not vertical is fixed by two of its points. So a straight-line graph through both points is this graph, and one missing either point is not.",
    pitfalls: [
      "Check the sign of the slope: a negative slope falls from left to right.",
      "Do not swap the slope and the intercept: $y = 3x + 1$ starts at 1 and rises 3, unlike $y = x + 3$.",
    ],
    parentGuide:
      "Ask your learner to put a finger on the $y$-intercept of the chosen graph, then count one step right and the slope up or down.",
  },
  {
    id: "graph-of-proportional-rate",
    title: "Graph a rate as a proportional relationship",
    goal: "Find a unit rate and choose the graph of $y = kx$: a line from the origin through $(1, k)$, with each quantity on the right axis.",
    summary:
      "A rate is a comparison of two kinds of amounts, such as pages and minutes. A unit rate is the amount for 1 unit, such as 3 pages per minute. A proportional relationship is one where $y$ is always the unit rate $k$ times $x$: $y = kx$. Its graph is a straight line from the origin, the point $(0, 0)$, rising $k$ for each step of 1 to the right.",
    senses: {
      unit: "unit",
      units: "unit",
      change: "change",
      changes: "change",
    },
    noLink: ["side", "third", "rule", "rules"],
    objectives: [
      "Find a unit rate from a total and a time, and write $y = kx$.",
      "Choose the graph that starts at (0, 0) and passes through (1, $k$), with the quantities on the right axes.",
    ],
    intuition:
      "A rate is a comparison of two kinds of amounts, such as pages and minutes. A unit rate is the amount for 1 unit, such as 3 pages per minute. A proportional relationship is one where $y$ is always the same number $k$ times $x$: $y = kx$. That number is called the constant of proportionality. The origin is the point $(0, 0)$, where the axes cross. A printer that prints 3 pages a minute has printed nothing at minute 0, 3 pages at minute 1 and 6 at minute 2. Plot minutes across and pages up. The points line up on a ray (a straight path that starts at the origin and goes on forever one way). The slope is how much a line rises for each step of 1 to the right. A faster printer gives a steeper line. A printer that had pages ready before starting would begin above the origin, and that is no longer proportional. A constant is a number that does not change, such as $k$.",
    terms: ["unit-rate", "proportional-relationship"],
    method: [
      "Find the unit rate $k$: divide the total by the number of units it took.",
      "Keep only graphs that start at the origin (0, 0).",
      "Find the point $(1, k)$, or any point $(t, kt)$, with the quantity being counted on the vertical axis. Choose the graph through it.",
    ],
    watch:
      "Divide before graphing: 6 pages in 2 minutes is 3 pages per minute, so the graph passes through (2, 6) and (1, 3), not (1, 6).",
    principle:
      "A quantity that starts at 0 and grows at a constant rate $k$ is $y = kx$. Its graph contains the origin and every point $(x, kx)$. So it is a line through the origin with slope $k$, the unit rate.",
    example: {
      prompt:
        "A pump fills 12 liters every 3 minutes. Which graph shows liters $y$ after $x$ minutes: a line from (0, 0) through (3, 12), from (0, 0) through (1, 12), from (0, 0) through (12, 3), or from (0, 9) through (3, 12)?",
      steps: [
        "Divide to get the unit rate: 12 ÷ 3 = 4 liters per minute, so $y = 4x$.",
        "At 0 minutes the pump has filled 0 liters, so the graph starts at the origin. That rules out the line from (0, 9).",
        "At 3 minutes, 12 liters: the point (3, 12). The line through (1, 12) uses the total as the rate, and the line through (12, 3) puts minutes on the vertical axis.",
      ],
      answer: "The line from (0, 0) through (3, 12).",
    },
    methodTitle: "Read the slope back",
    methodText: [
      "On the chosen graph, move 1 unit right from the origin and read the height: it should be the unit rate.",
      "Check the axes: the quantity that depends on time goes up the side, and time goes across. A decimal rate such as 1.5 is $y = 1.5x$: the point at $x = 2$ is $(2, 3)$.",
    ],
    formal:
      "If $y = kx$, then $\\frac{y}{x} = k$ for every point with $x \\ne 0$, and $(0, 0)$ is on the graph. A line $y = kx + c$ with $c \\ne 0$ has the same steepness, but $\\frac{y}{x} = k + \\frac{c}{x}$ changes with $x$, so it is not proportional.",
    pitfalls: [
      "A line with the right steepness that starts above zero is not proportional.",
      "Do not turn the rate upside down: minutes per page is a different rate and gives a different line.",
      "Read the labels on the vertical axis: when its gridlines count by 10, a rate of 30 reaches the third gridline after 1 unit, not the 30th.",
    ],
    parentGuide:
      "Ask your learner where the graph should be at time zero, and what height it reaches after one unit of time.",
  },
  {
    id: "graph-of-inequality-number-line",
    title: "Solve an inequality and choose its graph",
    goal: "Solve a one- or two-step inequality and choose the number line that shows every solution.",
    summary:
      "An inequality is a statement that compares two amounts with a sign such as $<$ (less than) or $\\ge$ (greater than or equal to). A solution is a number that makes it true. Solve it like an equation, doing the same to both sides (the amounts on each side of the sign). Multiplying or dividing both sides by a negative number, a number less than 0, reverses the sign. Then a number line shows every solution.",
    senses: {
      side: "side-of-equation",
      sides: "side-of-equation",
      boundary: "boundary",
    },
    noLink: ["whole", "opposite", "change", "part"],
    objectives: [
      "Solve a one- or two-step linear inequality, reversing the sign when dividing by a negative number.",
      "Choose the number line with the right boundary, a closed or open circle, and the ray in the right direction.",
    ],
    intuition:
      "An inequality is a statement that compares two amounts with a sign such as $<$ or $\\ge$. A solution is a number that makes the inequality true. An inequality has two sides: the amounts to the left and right of its sign. A negative number is a number less than 0. To reverse the inequality sign means to turn it around, so $<$ becomes $>$. An inequality like $x \\le -3$ has endlessly many solutions: $-3$, $-4$, $-10.5$ and so on. Its graph shades a ray (a part of the number line that starts at one point and goes on forever one way). The boundary is the number where the ray starts. A closed circle is a filled dot that means the boundary is a solution. An open circle is a hollow dot that means it is not. The ray points the way the solutions go.",
    terms: ["boundary", "closed-circle", "open-circle"],
    method: [
      "Undo addition or subtraction first: do the same to both sides.",
      "Divide both sides by the coefficient, the number multiplying $x$. If it is negative, reverse the inequality sign.",
      "Draw a closed circle for $\\le$ or $\\ge$ and an open circle for $<$ or $>$. Shade right for greater than and left for less than.",
    ],
    watch:
      "Dividing by a negative reverses the sign: from $-3x < 12$, $x > -4$, not $x < -4$.",
    principle:
      "Adding or subtracting a number keeps an inequality true, and so does multiplying or dividing by a positive number. Multiplying or dividing by a negative number reverses order on the number line: $2 < 5$ but $-2 > -5$. So the sign must be reversed to keep the same solutions.",
    example: {
      prompt: "Solve $-2x + 3 \\ge 9$ and describe its number line.",
      steps: [
        "Subtract 3 from both sides to undo the + 3: $-2x \\ge 6$.",
        "Divide both sides by −2. It is negative, so reverse the sign: $x \\le -3$.",
        "−3 itself is a solution, because of the “or equal to”, so the circle at −3 is closed. The other solutions are less than −3, so the ray points left.",
      ],
      answer: "A closed circle at −3 with the ray shaded to the left.",
    },
    methodTitle: "Test a point",
    methodText: [
      "Pick a number on the shaded ray and put it into the original inequality: it must make it true. For $-2x + 3 \\ge 9$, try $x = -4$: $8 + 3 = 11 \\ge 9$. True.",
      "Then try a number on the unshaded side, such as 0: $3 \\ge 9$ is false, as it should be.",
    ],
    formal:
      "For $a < 0$, $ax < c \\iff x > \\frac{c}{a}$, where $\\iff$ means “exactly when”. That is because multiplying both sides of $ax < c$ by $\\frac{1}{a} < 0$ reverses the order. The solutions of $x > \\frac{c}{a}$ form the open ray $\\left(\\frac{c}{a}, \\infty\\right)$, drawn with an open circle at $\\frac{c}{a}$.",
    pitfalls: [
      "Undo the added or subtracted number with the opposite operation before dividing.",
      "An open circle means the boundary is not a solution; a closed circle means it is.",
    ],
    parentGuide:
      "Ask your learner to test one shaded number and one unshaded number in the original inequality.",
  },
  {
    id: "graph-of-quadratic-or-exponential",
    title: "Match a curve with its rule",
    summary:
      "The vertex of $y = a(x - h)^2 + k$ is $(h, k)$. The graph of $y = a \\cdot b^x$ starts at $(0, a)$ and grows when $b > 1$.",
    objectives: [
      "Read the vertex and direction of a parabola from vertex form, and follow the shifts of $y = f(x - h) + k$.",
      "Read the $y$-intercept and growth or decay of $y = a \\cdot b^x$ and tell its curve from a line.",
    ],
    intuition:
      "A rule's numbers say where its graph sits. For a parabola, $(x - h)$ slides it sideways and $+ k$ lifts it, so the turning point moves to $(h, k)$. For an exponential, $a$ is the starting height at $x = 0$ and $b$ is what each step multiplies by, which bends the graph into a curve that keeps getting steeper or flatter.",
    terms: ["vertex-parabola", "growth-factor"],
    method: [
      "For $y = a(x - h)^2 + k$: the vertex is $(h, k)$. $x - 2$ gives $h = 2$; $x + 2$ gives $h = -2$. Positive $a$ opens up, negative $a$ opens down.",
      "For $y = f(x - h) + k$: move the graph of $f$ right $h$ and up $k$ (left or down for negative values).",
      "For $y = a \\cdot b^x$: the curve passes through $(0, a)$ and $(1, ab)$; it rises when $b > 1$ and falls when $0 < b < 1$, leveling off toward the $x$-axis.",
    ],
    watch:
      "The sign inside the parentheses works backwards: $(x - 3)^2$ moves the graph right 3, not left.",
    principle:
      "The vertex of $y = a(x - h)^2 + k$ is where $(x - h)^2 = 0$, at $x = h$, giving $y = k$. Replacing $x$ by $x - h$ moves every point of a graph right $h$, and adding $k$ moves it up $k$. For $y = a \\cdot b^x$, $b^0 = 1$ gives the intercept $a$, and multiplying by the same $b$ each step makes equal steps in $x$ multiply, not add, so the graph is a curve.",
    example: {
      prompt:
        "Which graph shows $y = -(x - 1)^2 + 4$: a parabola opening down with vertex (1, 4), opening up with vertex (1, 4), opening down with vertex (−1, 4), or opening down with vertex (1, −4)?",
      steps: [
        "The form $y = a(x - h)^2 + k$ has $a = -1$, $h = 1$ and $k = 4$.",
        "The vertex is (1, 4); $(x - 1)$ moves the graph right, so (−1, 4) is the wrong way.",
        "$a$ is negative, so the parabola opens down.",
      ],
      answer: "The parabola opening down with its vertex at (1, 4).",
    },
    methodTitle: "Check one more point",
    methodText: [
      "Substitute an easy $x$ into the rule and look for that point on the chosen graph. For $y = -(x - 1)^2 + 4$ at $x = 0$: $y = -1 + 4 = 3$, so the graph passes through (0, 3).",
      "For an exponential, check $x = 0$ and $x = 1$: $y = a$ and $y = ab$. A straight line through the same two points is not exponential; at $x = 2$ it gives a different value.",
    ],
    formal:
      "If $(x_0, y_0)$ is on the graph of $f$, then $(x_0 + h, y_0 + k)$ is on the graph of $g(x) = f(x - h) + k$, since $g(x_0 + h) = f(x_0) + k$. With $f(x) = ax^2$, the vertex $(0, 0)$ moves to $(h, k)$. For $g(x) = a \\cdot b^x$ with $a > 0$, $g(x + 1) = b \\cdot g(x)$, so $g$ increases when $b > 1$ and decreases when $0 < b < 1$.",
    pitfalls: [
      "Read $h$ with the opposite sign of the number inside the parentheses.",
      "A factor between 0 and 1 means decay, even though the graph never reaches 0.",
    ],
    parentGuide:
      "Ask your learner where the graph crosses the $y$-axis or turns, and why, before choosing.",
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

export const figureChoiceMethods: Record<string, ProblemMethod> =
  Object.fromEntries(entries.map((e) => [e.id, stripFormat(e)]));

export const figureChoicePrinciples: Record<string, string> =
  Object.fromEntries(entries.map((e) => [e.id, e.principle]));

export const figureChoiceLessons: Lesson[] = entries.map((e) => ({
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
