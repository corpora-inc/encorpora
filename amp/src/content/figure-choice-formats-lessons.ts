import type { FacetMapping } from "./coverage";
import { formatLessons, type FormatLessonEntry } from "./format-lesson-entry";

const entries: FormatLessonEntry[] = [
  {
    id: "graph-of-paired-values",
    title: "Match paired values with their graph",
    summary:
      "Each pair $(x, y)$ is one point: $x$ says how far right, $y$ how far up. The right graph has every pair and nothing else.",
    objectives: [
      "Read every pair $(x, y)$ from a table, or find $y$ from a stated relationship for each given $x$.",
      "Choose the graph that plots all of the pairs, ruling out swapped coordinates, mismatched columns and missing points.",
    ],
    intuition:
      "A table or a rule gives pairs of numbers, and a graph shows each pair as one dot. The first number of a pair is the distance across from the origin and the second is the distance up, so the pair $(2, 5)$ is not the pair $(5, 2)$. A correct graph has exactly one dot for every pair: no dot missing and no extra dot.",
    terms: [
      [
        "ordered pair",
        "Two numbers in a fixed order, $(x, y)$: across first, then up.",
      ],
      [
        "relationship",
        "A rule that gives $y$ from $x$, such as '$y$ is 1.5 times $x$' or '$y$ is 5 less than $x$'.",
      ],
    ],
    method: [
      "Write the pair for each $x$: read $y$ below it in the table, or use the rule ($y = 1.5x$, $y = x - 5$) to find it.",
      "Count the pairs. Rule out any graph with fewer or more dots.",
      "Check the first coordinate of each dot is $x$, then check the second is $y$. Rule out graphs where they are swapped or where a $y$ sits under the wrong $x$.",
    ],
    watch:
      "The order matters: from $(2, 5)$, go right 2 and up 5, not right 5 and up 2.",
    principle:
      "A graph of a set of pairs is the set of points $(x, y)$ for those pairs. Two points with the same coordinates in the other order are different points unless $x = y$, so swapping coordinates changes the graph.",
    example: {
      prompt:
        "The table has $x$ = 2, 4, 6 and $y$ = 3, 6, 4. Which graph plots every pair: points at (2, 3), (4, 6), (6, 4); at (3, 2), (6, 4), (4, 6); at (2, 3), (4, 4), (6, 6); or at (2, 3) and (4, 6)?",
      steps: [
        "The pairs are (2, 3), (4, 6) and (6, 4): each $y$ goes with the $x$ above it.",
        "The points (3, 2), (6, 4), (4, 6) swap the coordinates of every pair.",
        "The points (2, 3), (4, 4), (6, 6) shift the $y$-row by one column, and the graph with two points leaves out (6, 4).",
      ],
      answer: "The graph with points at (2, 3), (4, 6) and (6, 4).",
    },
    methodTitle: "Check a rule with one pair",
    methodText: [
      "When a rule is given, test it on the first $x$ before looking at the graphs: for 'y is 1.5 times x' and $x = 2$, $y = 1.5 \\cdot 2 = 3$, so the graph must have a dot at $(2, 3)$.",
      "A decimal multiplier needs the exact value: 1.5 is not 1 and not 2, so a graph for $y = x$ or $y = 2x$ is wrong.",
    ],
    formal:
      "For a function given by a rule or a table, the graph is $\\{(x, y)\\}$ over the listed $x$-values. Each $x$ has one point at height $y$, and the point $(a, b)$ equals $(c, d)$ only when $a = c$ and $b = d$.",
    pitfalls: [
      "Do not swap the coordinates: the first number of a pair is $x$.",
      "Do not leave out a pair: count the dots against the pairs.",
      "With a decimal multiplier, multiply by the exact number; rounding 1.5 to 1 or 2 plots other points.",
    ],
    parentGuide:
      "Ask your learner to say each pair aloud as 'right, then up' while a finger moves to the dot.",
  },
  {
    id: "point-on-signed-grid",
    title: "Choose the graph of a signed point",
    summary:
      "The signs tell the direction: negative $x$ is left of the $y$-axis, negative $y$ is below the $x$-axis. The first number is always $x$.",
    objectives: [
      "Place an ordered pair of signed numbers, or two distances from the axes, in the correct quadrant.",
      "Choose the graph with that one point, ruling out flipped signs and swapped coordinates.",
    ],
    intuition:
      "Start at the origin where the axes cross. The first number moves you across: right if it is positive, left if it is negative. The second moves you up if positive and down if negative. The two signs together decide the quadrant: for example, both negative puts the point down and to the left.",
    terms: [
      [
        "quadrant",
        "One of the four regions the axes cut the plane into; the signs of $x$ and $y$ decide which.",
      ],
      ["origin", "The point $(0, 0)$ where the $x$-axis and $y$-axis cross."],
    ],
    method: [
      "Read $x$ first and $y$ second. When distances are given, 'left of the $y$-axis' means $x$ is negative and 'below the $x$-axis' means $y$ is negative.",
      "Name the quadrant from the two signs and rule out graphs whose point is in another quadrant.",
      "Of the points left, rule out any with the numbers in the other order.",
    ],
    watch:
      "Changing one sign moves the point across an axis to a different quadrant; swapping the numbers reflects it over the line $y = x$.",
    principle:
      "The point $(a, b)$ is $|a|$ units from the $y$-axis, on the right if $a > 0$ and on the left if $a < 0$, and $|b|$ units from the $x$-axis, above if $b > 0$ and below if $b < 0$. The pair is ordered: $(a, b) \\ne (b, a)$ unless $a = b$.",
    example: {
      prompt:
        "Which graph shows the point $(-3, 4)$: a point at (3, 4), at (−3, −4), at (4, −3) or at (−3, 4)?",
      steps: [
        "The first number is −3: 3 units left of the $y$-axis. The second is 4: 4 units above the $x$-axis.",
        "That is the second quadrant (left and up). The point (3, 4) has the wrong sign for $x$ and the point (−3, −4) has the wrong sign for $y$.",
        "The point (4, −3) swaps the two numbers.",
      ],
      answer: "The point at (−3, 4).",
    },
    methodTitle: "Say the moves",
    methodText: [
      "Say the moves from the origin out loud: 'left 3, up 4'. The graph whose dot is at that place is the one.",
      "When a graph shows a point on the right instead of the left, only the sign of $x$ is wrong. Fix one thing at a time.",
    ],
    formal:
      "The coordinate plane assigns to each point $P$ the pair $(x, y)$ of signed distances: $x$ measured along the horizontal axis from the origin, $y$ along the vertical axis. Reflecting $P$ across the $y$-axis changes the sign of $x$ only; across the $x$-axis, the sign of $y$ only.",
    pitfalls: [
      "A negative $x$ goes left, not down.",
      "Keep $x$ first: $(−3, 4)$ and $(4, −3)$ are different points.",
    ],
    parentGuide:
      "Ask your learner to walk from the origin along the horizontal axis first, then along the vertical one.",
  },
  {
    id: "graph-after-shift",
    title: "Move a graph up, down, left or right",
    summary:
      "$f(x) + k$ moves every point up $k$; $f(x - h)$ moves every point right $h$. Follow one point to find the new graph.",
    objectives: [
      "Read a vertical or horizontal move from words or from $f(x - h) + k$, including the direction.",
      "Choose the graph that has moved the shown graph exactly that way, ruling out opposite and partial moves.",
    ],
    intuition:
      "Moving a graph does not change its shape, only its position, so pick one point you can read, such as a vertex or an intercept, and follow where it goes. Adding to the output $f(x)$ lifts every point; subtracting lowers it. A number inside the parentheses works on the input, so it acts backward: $f(x - 2)$ needs $x$ to be 2 larger to get the old output, so the graph moves 2 to the right.",
    terms: [
      [
        "translation",
        "A move of the whole graph without turning or stretching it.",
      ],
      [
        "$f(x - h) + k$",
        "The graph of $f$ moved $h$ units right (left if $h < 0$) and $k$ units up (down if $k < 0$).",
      ],
    ],
    method: [
      "Find the horizontal and vertical moves: inside the parentheses, $x - h$ is right $h$ and $x + h$ is left $h$; outside, $+ k$ is up and $- k$ is down.",
      "Pick a point of the shown graph (vertex, intercept, or a corner) and move it by those amounts.",
      "Choose the graph that passes through the new point, then check the shape is the same as the original.",
    ],
    watch:
      "Both moves matter: a graph moved only up when it should also move left is one of the wrong options.",
    principle:
      "If $(a, b)$ is on the graph of $f$, then $g(x) = f(x - h) + k$ satisfies $g(a + h) = f(a) + k = b + k$, so $(a + h, b + k)$ is on the graph of $g$. Every point moves by the same $(h, k)$, so $g$ has the same shape as $f$.",
    example: {
      prompt:
        "An absolute-value graph has its vertex at (1, 2). Which graph shows $f(x + 3) - 1$: the same shape with vertex (4, 1), (−2, 3), (−2, 1) or (4, 3)?",
      steps: [
        "Inside the parentheses, $x + 3$ moves the graph 3 units left, so the vertex $x$-coordinate becomes 1 − 3 = −2.",
        "Outside, subtracting 1 moves the graph 1 unit down, so the vertex $y$-coordinate becomes 2 − 1 = 1.",
        "The vertex moves to (−2, 1). The vertex (4, 1) moved right, (−2, 3) moved up and (4, 3) moved right and up.",
      ],
      answer: "The graph with its vertex at (−2, 1).",
    },
    methodTitle: "Check with a second point",
    methodText: [
      "After choosing, move a second point by the same amounts and see that it is on the chosen graph. For an absolute-value graph with its vertex at (1, 2) and another point at (2, 4), $f(x + 3) - 1$ takes them to (−2, 1) and (−1, 3); both must lie on the chosen graph.",
      "For a line, a move sideways can look like a move up or down, so compare the point you followed, not just the look of the line.",
    ],
    formal:
      "The translation $T(x, y) = (x + h, y + k)$ carries the graph of $f$ onto the graph of $g(x) = f(x - h) + k$: $(x, y)$ is on the graph of $f$ exactly when $(x + h, y + k)$ is on the graph of $g$. Distances between points are unchanged, so $g$ has the same shape.",
    pitfalls: [
      "A number inside the parentheses moves the graph the opposite way from its sign: $f(x + 3)$ moves left.",
      "Do not use a horizontal amount as a vertical one: keep the two moves apart.",
    ],
    parentGuide:
      "Ask your learner to follow the lowest or leftmost point of the shown graph to where it goes, then pick the graph through that spot.",
  },
];

const built = formatLessons(entries);
export const figureChoiceFormatsLessons = built.lessons;
export const figureChoiceFormatsMethods = built.methods;
export const figureChoiceFormatsPrinciples = built.principles;

export const figureChoiceFormatsFacetMappings: readonly FacetMapping[] = [
  {
    templateId: "graph-of-paired-values",
    facetId: "coordinate-first-quadrant.ordered-pairs",
    extent: "partial",
    rationale:
      "Choose the first-quadrant graph whose points are every pair of a table of three to seven pairs, or of a stated relationship (a whole or decimal multiple, or a number more or less than x) for three given x-values, among graphs with swapped coordinates, mismatched columns, a left-out pair, a wrong operation or a rounded multiplier. Does not assess plotting points by hand, graphs scaled by more than one per gridline, or reading a relationship back from a graph.",
  },
  {
    templateId: "point-on-signed-grid",
    facetId: "coordinate-four-quadrants.core",
    extent: "partial",
    rationale:
      "Choose the graph showing one point given as a pair of nonzero integers from −6 to 6 or as distances from the axes, among points with a sign flipped or the coordinates swapped. Does not assess points on an axis, distances between points, reflections, or plotting the point by hand.",
  },
  {
    templateId: "graph-after-shift",
    facetId: "function-transformations.core",
    extent: "partial",
    rationale:
      "Choose the graph of f moved up, down, left or right by one to three units, stated in words or as f(x) + k, f(x − h) or both, for a line, absolute-value graph, parabola or zigzag, among graphs moved the wrong way, only partly, or with the two moves swapped. Does not assess stretches, reflections, scaled inputs such as f(2x), writing the new rule, or a graph that is not shown.",
  },
];
