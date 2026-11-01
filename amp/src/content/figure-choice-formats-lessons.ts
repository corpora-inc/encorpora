import type { FacetMapping } from "./coverage";
import { formatLessons, type FormatLessonEntry } from "./format-lesson-entry";

const entries: FormatLessonEntry[] = [
  {
    id: "graph-of-paired-values",
    title: "Match paired values with their graph",
    // "rule" is the sentence that gives y from x; "3 more than" is ordinary prose.
    senses: { rule: "rule" },
    noLink: ["more than", "changes", "leaves"],
    summary:
      "An ordered pair is two numbers, like (2, 5), that name one point. The right graph has a dot for every pair, and no other dots.",
    objectives: [
      "Read every pair from a table, or find $y$ from a rule for each given $x$.",
      "Choose the graph that shows all of the pairs, and spot graphs with swapped numbers, mismatched columns or missing dots.",
    ],
    intuition:
      "A rule is a sentence that tells how to get $y$ from $x$, such as “$y$ is 3 more than $x$”. A table or a rule gives pairs of numbers. A graph shows each pair as one dot on a grid. The origin is the corner of the grid, where both counts start at 0. Each number in a pair is called a coordinate. The first coordinate, $x$, tells how far to go right from the origin. The second coordinate, $y$, tells how far to go up. So (2, 5) and (5, 2) are different dots. A correct graph has exactly one dot for each pair, with none missing and none extra.",
    terms: [
      "ordered-pair",
      [
        "rule",
        "Here the relationship is a rule that gives $y$ from $x$, such as $y$ is 1.5 times $x$.",
      ],
    ],
    method: [
      "Write the pair for each $x$. Read the $y$ that goes with it in the table, or work it out with the rule, such as $y = 1.5 \\times x$ or $y = x - 5$.",
      "Count the pairs. Cross out any graph with fewer dots or more dots.",
      "Check each dot: its first coordinate must be one of the $x$ values, and its second the matching $y$. Cross out graphs where the two are swapped, or where a $y$ is paired with the wrong $x$.",
    ],
    watch:
      "Order matters. For (2, 5), go right 2 and up 5, not right 5 and up 2.",
    principle:
      "The graph of a set of pairs is the dots at those pairs and no others. Swapping the two numbers of a pair gives a different point, unless the numbers are equal. So a graph with swapped pairs is a different graph.",
    example: {
      prompt:
        "A table has $x$ = 2, 4, 6 in its top row and $y$ = 3, 6, 4 in its bottom row. Which graph shows every pair: dots at (2, 3), (4, 6), (6, 4); at (3, 2), (6, 4), (4, 6); at (2, 3), (4, 4), (6, 6); or at (2, 3) and (4, 6)?",
      steps: [
        "Pair each $x$ with the $y$ just below it in the table. The pairs are (2, 3), (4, 6) and (6, 4).",
        "The dots at (3, 2), (6, 4), (4, 6) put each pair's numbers the wrong way round, so that graph is wrong.",
        "The dots at (2, 3), (4, 4), (6, 6) pair two of the $y$ values with the wrong $x$. The graph with only two dots leaves out (6, 4).",
        "Only the first graph has every pair and no other dots.",
      ],
      answer: "The graph with points at (2, 3), (4, 6) and (6, 4).",
    },
    methodTitle: "Check a rule with one pair",
    methodText: [
      "When a rule is given, test it on the first $x$ before you look at the graphs. For “$y$ is 1.5 times $x$” and $x = 2$, $y = 1.5 \\times 2 = 3$. So the graph must have a dot at (2, 3).",
      "A decimal is a number with a decimal point, such as 1.5. A multiplier is the number you multiply by. With a decimal multiplier, use its exact value. 1.5 is not 1 and not 2, so a graph for $y = x$ or $y = 2 \\times x$ is wrong.",
    ],
    formal:
      "The graph of a rule or a table is the set of points $(x, y)$ for the listed $x$ values. Each listed $x$ has one dot, straight above $x$ and level with its $y$. Two pairs name the same point only when their first numbers match and their second numbers match.",
    pitfalls: [
      "Do not swap the numbers. The first number of a pair is $x$.",
      "Do not leave out a pair. Count the dots and count the pairs.",
      "With a decimal multiplier, multiply by the exact number. Changing 1.5 to 1 or 2 gives other points.",
    ],
    parentGuide:
      "Ask your learner to say each pair aloud as “right, then up” while a finger moves to the dot.",
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
    terms: ["quadrant", "origin"],
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
      "translation",
      [
        "translation",
        "$f(x-h)+k$ moves the graph of $f$ right $h$ and up $k$; a negative $h$ or $k$ reverses that direction.",
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
