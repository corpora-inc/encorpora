import type { MethodTerm } from "../glossary/types";
import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";
import {
  pointPlotScene,
  type LatticePoint,
  type PlotCurve,
  type PointPlotResponse,
} from "../math/point-plot";

const grid = {
  xMin: -6,
  xMax: 6,
  yMin: -6,
  yMax: 6,
  step: 1,
  xLabel: "x",
  yLabel: "y",
};
/** A solved example grid, drawn by the same scene as practice and print. */
const solved = (
  response: Omit<PointPlotResponse, "kind" | "label" | "grid">,
  answer: LatticePoint[],
  title: string,
) => ({
  kind: "scene" as const,
  scene: pointPlotScene(
    { kind: "point-plot", label: "Example", grid, ...response },
    { answer, title },
  ),
});

/** A solved curve example: the function drawn with its lattice points. */
const solvedCurve = (
  curve: PlotCurve,
  answer: LatticePoint[],
  title: string,
  window: Partial<typeof grid> = {},
) => ({
  kind: "scene" as const,
  scene: pointPlotScene(
    {
      kind: "point-plot",
      label: "Example",
      grid: { ...grid, ...window },
      pointCount: answer.length,
      ordered: false,
      connect: "curve",
    },
    { answer, curve, title },
  ),
});

type Entry = {
  id: string;
  title: string;
  /** The practice task, when the summary is longer than a goal line. */
  goal?: string;
  /** Senses that differ from the shared ones (a polygon's corners). */
  senses?: Record<string, string>;
  summary: string;
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
    id: "plot-points",
    title: "Plot points in all four quadrants",
    goal: "Plot points $(x, y)$ in all four quadrants: across by the first number, then up or down by the second.",
    summary:
      "A number line is a line with evenly spaced numbers. A coordinate plane is a flat grid made from two number lines that cross at 0, at a point called the origin. A point is named by an ordered pair, a pair of numbers in a set order, such as $(3, -2)$. Start at the origin. The first number says how far to move across: right if positive, left if negative. The second says how far to move up or down: up if positive, down if negative.",
    objectives: [
      "Plot points with positive, negative and zero coordinates, including points on an axis.",
      "Plot the mirror image of a point across the $x$-axis or the $y$-axis by changing the sign of one coordinate.",
    ],
    intuition:
      "The coordinate plane has two number lines that cross at the origin, $(0, 0)$. The across line is the $x$-axis and the up-and-down line is the $y$-axis. A point is written as an ordered pair $(x, y)$; its two numbers are called coordinates. In $(3, -2)$, the first number says move 3 right, and the second says move 2 down. A zero means no move in that direction, so the point lands on an axis. The axes split the plane into four parts called quadrants.",
    terms: ["ordered-pair", "quadrant"],
    method: [
      "Start at the origin. Move along the $x$-axis by the first coordinate: right if positive, left if negative.",
      "From there, move up for a positive second coordinate or down for a negative one, and place the point.",
      "A coordinate of 0 means no move: $(0, 4)$ is on the $y$-axis and $(-5, 0)$ is on the $x$-axis. Check each placed point against the pair.",
    ],
    watch:
      "Move across first, then up or down. Swapping the coordinates plots $(-2, 3)$ instead of $(3, -2)$, a different point.",
    principle:
      "Each point of the plane matches exactly one ordered pair $(x, y)$ of real numbers: how far across and how far up from the origin, with signs for direction. Points that differ only in the sign of one coordinate are mirror images across an axis. $(x, -y)$ is the mirror image across the $x$-axis, and $(-x, y)$ across the $y$-axis.",
    example: {
      prompt: "Plot the points $A(3, -2)$, $B(0, 4)$ and $C(-5, 0)$.",
      figure: solved(
        { pointCount: 3, ordered: false, connect: "none" },
        [
          [3, -2],
          [0, 4],
          [-5, 0],
        ],
        "Points A, B and C plotted",
      ),
      steps: [
        "$A(3, -2)$: the first number is 3, so from the origin move 3 units right. The second is $-2$, so then move 2 units down.",
        "$B(0, 4)$: the first number is 0, so do not move across. Stay on the $y$-axis and move 4 units up.",
        "$C(-5, 0)$: move 5 units left, because $-5$ is negative. The second number is 0, so do not move up or down; $C$ is on the $x$-axis.",
      ],
      answer: "$(3, -2)$, $(0, 4)$ and $(-5, 0)$",
    },
    methodTitle: "Signs give directions",
    methodText: [
      "The quadrants are numbered I, II, III and IV, going around the opposite way to a clock's hands from the top right. In quadrant I both coordinates are positive. Quadrant II has negative $x$ and positive $y$, quadrant III has both negative, and quadrant IV has positive $x$ and negative $y$. A point on an axis is in no quadrant.",
      "A point described in words works the same way. 4 units left of the $y$-axis means $x = -4$, and 3 units above the $x$-axis means $y = 3$.",
    ],
    formal:
      "The plane is the set of ordered pairs of real numbers. The distance of $(x, y)$ from the $y$-axis is $|x|$, and from the $x$-axis is $|y|$; the bars mean the size of the number without its sign. Reflecting (flipping like a mirror) across the $x$-axis sends $(x, y)$ to $(x, -y)$. Reflecting across the $y$-axis sends $(x, y)$ to $(-x, y)$.",
    pitfalls: [
      "Plot the first coordinate across and the second up or down, never the reverse.",
      "One zero coordinate places the point on an axis. Only $(0, 0)$, with both zero, is the origin.",
    ],
    parentGuide:
      "Ask your learner to say each move aloud before tapping: “3 right, 2 down.”",
  },
  {
    id: "graph-linear-equation",
    title: "Graph a line from its equation",
    goal: "Graph a line from its equation by placing two of its points.",
    summary:
      "A point $(x, y)$ on a grid means go $x$ across and $y$ up from $(0, 0)$. An equation like $y = -\\frac{2}{3}x + 3$ is true for many points. They all lie on one straight line. Two points are enough to draw a line. Find one point from the equation. Then use the slope, how much $y$ goes up or down for each step right, to walk to a second point.",
    objectives: [
      "Find points of a line from equations such as $y = mx + b$, $ax + by = c$ or $y - y_1 = m(x - x_1)$.",
      "Use the slope, the rise (up or down) over the run (across), to step from one grid point of the line to the next.",
    ],
    intuition:
      "An equation in $x$ and $y$ is true for a set of points $(x, y)$. For a linear equation, those points lie on a straight line. The slope of the line says how much $y$ changes for each step of 1 in $x$. It is written as a fraction, rise over run: the rise is the move up (or down, if negative) and the run is the move right. In $y = mx + b$, $m$ is the slope and $(0, b)$ is where the line crosses the $y$-axis. From one point, the slope lets you walk to the next.",
    terms: ["slope", "y-intercept"],
    method: [
      "Find one point. In $y = mx + b$ it is $(0, b)$. In $y - y_1 = m(x - x_1)$ it is $(x_1, y_1)$. A proportional rule $y = kx$ passes through $(0, 0)$. In $ax + by = c$ with $b \\ne 0$, put in an $x$ value that makes $y$ come out with no fraction part, like $-3$, 0 or 5.",
      "From that point, use the slope $\\frac{\\text{rise}}{\\text{run}}$. Move right by the run, then up by the rise (down if the rise is negative), to a second point.",
      "Place both points. Any two different points of the line are correct; the graph is the line through them.",
    ],
    watch:
      "A negative slope goes down as you move right. In $y - y_1 = m(x - x_1)$ the signs flip: $y + 4 = 2(x - 3)$ passes through $(3, -4)$, not $(-3, 4)$.",
    principle:
      "The solutions of $ax + by = c$, with $a$ and $b$ not both 0, form a straight line. When $b \\ne 0$, any two of its points have the same rise-to-run ratio, the slope $-\\frac{a}{b}$. Two different points fix the line.",
    example: {
      prompt: "Graph $y = -\\frac{2}{3}x + 3$ by placing 2 points on its line.",
      figure: solved(
        { pointCount: 2, ordered: false, connect: "line" },
        [
          [0, 3],
          [3, 1],
        ],
        "The line through (0, 3) and (3, 1)",
      ),
      steps: [
        "In $y = mx + b$, the number added is $b = 3$. So when $x = 0$, $y = 3$: the line crosses the $y$-axis at $(0, 3)$.",
        "The slope $-\\frac{2}{3}$ means a run of 3 and a rise of $-2$. So from $(0, 3)$ move 3 units right and 2 units down, to $(3, 1)$.",
        "Check that $(3, 1)$ makes the equation true: $-\\frac{2}{3}\\cdot 3 + 3 = -2 + 3 = 1$. The graph is the line through $(0, 3)$ and $(3, 1)$.",
      ],
      answer: "the line through $(0, 3)$ and $(3, 1)$",
    },
    methodTitle: "One point, then the slope",
    methodText: [
      "Starting from a grid point, a fraction slope tells you how far to step to land on another grid point. With slope $\\frac{2}{3}$, move 3 right and 2 up. With a slope that is an integer (a number like $-2$ or 3 with no fraction part), such as $-2$, move 1 right and 2 down.",
      "A flat line $y = k$ has slope 0: every point has $y$-coordinate $k$. A proportional rule $y = kx$ always passes through the origin, $(0, 0)$.",
    ],
    formal:
      "Say $(x_1, y_1)$ and $(x_2, y_2)$ both make $ax + by = c$ true; the small 1 and 2 mark the two points. Subtracting the two equations gives $a(x_2 - x_1) + b(y_2 - y_1) = 0$. So when $b \\ne 0$ and $x_1 \\ne x_2$, the slope $\\frac{y_2 - y_1}{x_2 - x_1} = -\\frac{a}{b}$ is the same for every pair. Every point on the line through two solutions is also a solution.",
    pitfalls: [
      "In $y - y_1 = m(x - x_1)$, read the point with the opposite signs of the numbers shown.",
      "For a negative slope, move down as you move right.",
    ],
    parentGuide:
      "Ask your learner to name the starting point, and the slope's run and rise, before placing anything.",
  },
  {
    id: "place-transformed-image",
    title: "Place the image of a rigid motion",
    senses: {
      side: "side-of-equation",
      sides: "side-of-equation",
      term: "term-expression",
      terms: "term-expression",
      vertex: "vertex",
      vertices: "vertex",
    },
    goal: "Move a figure by a slide, flip or turn, and place each new corner under its matching label.",
    summary:
      "A rigid motion moves a shape without stretching or bending it. A translation slides it, a reflection flips it over a line, and a rotation turns it around a point. A point's coordinates $(x, y)$ say how far across and how far up it is from $(0, 0)$, in that order. Each motion has a rule for the coordinates. Apply the rule to each corner. The new corner of $A$ is named $A'$, read “A prime”.",
    objectives: [
      "Apply coordinate rules for slides, flips over an axis, and quarter and half turns about the origin.",
      "Place the new points in order, so $A$ goes to $A'$, $B$ to $B'$ and $C$ to $C'$.",
    ],
    intuition:
      "A rigid motion moves a figure without stretching or bending it. A translation slides every point the same way. A reflection flips the figure over a line, like a mirror. A rotation turns it around a point, here the origin, the point $(0, 0)$ where the axes cross; a 90° turn is a quarter turn and a 180° turn is a half turn. Each corner, called a vertex, has one new point, called its image. The image of $A$ is named $A'$ (said “A prime”). Find each image with the motion's coordinate rule.",
    terms: ["image-transformation", "rigid-motion"],
    method: [
      "Write the rule. A slide adds the same amounts to every point: $(x, y) \\to (x + h, y + k)$, where $\\to$ means “goes to”. A flip over the $x$-axis gives $(x, -y)$, and over the $y$-axis gives $(-x, y)$.",
      "Turns about the origin: a quarter turn the opposite way to a clock's hands (counterclockwise) gives $(-y, x)$. A quarter turn the clock's way (clockwise) gives $(y, -x)$. A half turn gives $(-x, -y)$.",
      "Apply the rule to each vertex, and place each image under its own label: $A'$ first, then $B'$, then $C'$.",
    ],
    watch:
      "For a quarter turn, swap the two coordinates and then change one sign. Check the direction: counterclockwise from the top-right quarter of the grid lands in the top-left quarter.",
    principle:
      "Slides, flips and turns keep every distance the same, so the image has the same size and shape as the original; such figures are called congruent. Each motion has a coordinate rule. The image of a polygon (a shape with straight sides) is the polygon through the images of its corners, in the same order.",
    example: {
      prompt:
        "Triangle $ABC$ has vertices $A(1, 2)$, $B(4, 2)$ and $C(1, 5)$. It is rotated 90° counterclockwise about the origin. Place $A'$, $B'$ and $C'$, the images of $A$, $B$ and $C$.",
      figure: {
        kind: "scene",
        scene: pointPlotScene(
          {
            kind: "point-plot",
            label: "Example",
            grid,
            pointCount: 3,
            ordered: true,
            pointLabels: ["A′", "B′", "C′"],
            connect: "polygon",
            given: {
              vertices: [
                { x: 1, y: 2, label: "A" },
                { x: 4, y: 2, label: "B" },
                { x: 1, y: 5, label: "C" },
              ],
              closed: true,
            },
          },
          {
            answer: [
              [-2, 1],
              [-2, 4],
              [-5, 1],
            ],
            title: "Triangle ABC and its rotated image",
          },
        ),
      },
      steps: [
        "A quarter turn counterclockwise about the origin uses the rule $(x, y) \\to (-y, x)$: swap the numbers, then change the sign of the new first number.",
        "Apply it to each corner. $A(1, 2) \\to A'(-2, 1)$, $B(4, 2) \\to B'(-2, 4)$ and $C(1, 5) \\to C'(-5, 1)$.",
        "Check a length. $AB = 3$ and $A'B' = 3$. The image is the same size and shape, turned a quarter turn.",
      ],
      answer: "$A'(-2, 1)$, $B'(-2, 4)$ and $C'(-5, 1)$",
    },
    methodTitle: "Rules for each motion",
    methodText: [
      "A flip over the $x$-axis or the $y$-axis keeps the coordinate along that axis and changes the sign of the other. A half turn about the origin changes both signs.",
      "A quarter turn about the origin swaps the coordinates. Then it changes the sign of the new $x$ (counterclockwise) or the new $y$ (clockwise).",
      "Place images in order; each label goes with its own vertex.",
    ],
    formal:
      "A quarter turn counterclockwise about the origin sends $(x, y)$ to $(-y, x)$. For example, it takes $(1, 0)$ to $(0, 1)$, and $(0, 1)$ to $(-1, 0)$. Each rule keeps $(x_2 - x_1)^2 + (y_2 - y_1)^2$ the same, which is the squared distance between two points. So each one is a rigid motion.",
    pitfalls: [
      "Do not mix up clockwise and counterclockwise. $(x, y) \\to (-y, x)$ is counterclockwise, the opposite way to a clock's hands.",
      "Place each image under its own label; $A'$ is the image of $A$.",
    ],
    parentGuide:
      "Ask your learner to say the rule, then check that each side of the image has the same length as the original.",
  },

  {
    id: "graph-quadratic-points",
    title: "Graph a parabola by placing points",
    goal: "Graph a parabola by finding its turning point, the vertex, and then points on both sides of it.",
    summary:
      "A graph shows, as points $(x, y)$ on a grid, every pair that makes an equation true. An equation with $x^2$ ($x$ times $x$) and no higher power, such as $y = 2(x - 1)^2 - 3$, makes a U-shaped graph called a parabola. Its turning point is called the vertex. The two sides are mirror images of each other. So find the vertex first, then put in integers (the whole numbers and their negatives) next to it to find more points.",
    objectives: [
      "Read the vertex from $y = a(x - h)^2 + k$, and find it from $y = ax^2 + bx + c$ with $x = -\\frac{b}{2a}$.",
      "Find grid points of a parabola by putting in whole numbers for $x$ and using its mirror symmetry.",
    ],
    intuition:
      "In $y = ax^2 + bx + c$, $x^2$ means $x$ times $x$, and $a$ is not 0. An equation like this is called quadratic, and its graph is a U-shaped curve called a parabola. Its turning point is called the vertex. The two sides mirror each other across the up-and-down line through the vertex, called the axis of symmetry. So two $x$ values the same distance from the vertex give the same $y$. Unlike a line, a parabola does not rise by the same amount each step.",
    terms: ["vertex-parabola", "axis-of-symmetry"],
    method: [
      "Find the vertex. In $y = a(x - h)^2 + k$ it is $(h, k)$. In $y = ax^2 + bx + c$, its $x$ is $-\\frac{b}{2a}$; put that $x$ into the equation to get $y$.",
      "Put in numbers with no fraction part for $x$ next to the vertex's $x$, and work out $y$. By symmetry, $x = h + 1$ and $x = h - 1$ give the same $y$.",
      "Place the points asked for. Any points that make the equation true are correct, so the vertex plus points on either side is a good set. The point where it crosses the $y$-axis is $(0, c)$.",
    ],
    watch:
      "In $y = a(x - h)^2 + k$, the vertex's $x$ is $h$, the opposite of the sign shown inside the curved brackets. $y = (x + 3)^2$ has its vertex at $x = -3$.",
    principle:
      "The graph of $y = a(x - h)^2 + k$, with $a \\ne 0$, is the parabola $y = ax^2$ moved $h$ units right and $k$ units up. It is symmetric about the line $x = h$. A point $(x, y)$ is on the graph exactly when its coordinates make the equation true.",
    example: {
      prompt:
        "Graph $y = 2(x - 1)^2 - 3$ by placing its vertex and 2 more points.",
      figure: solvedCurve(
        { kind: "quadratic", a: [2, 1], h: [1, 1], k: [-3, 1] },
        [
          [0, -1],
          [1, -3],
          [2, -1],
        ],
        "The parabola through (0, -1), (1, -3) and (2, -1)",
      ),
      steps: [
        "The equation has the form $y = a(x - h)^2 + k$, so the vertex is $(h, k) = (1, -3)$. Since $a = 2$ is positive, the parabola opens upward.",
        "Put in $x = 2$, one step right of the vertex: $y = 2(2 - 1)^2 - 3 = 2 \\cdot 1 - 3 = -1$. So $(2, -1)$ is on the curve.",
        "The curve is symmetric about $x = 1$, so $x = 0$, one step left, gives the same $y$. Check: $y = 2(0 - 1)^2 - 3 = 2 \\cdot 1 - 3 = -1$.",
      ],
      answer: "$(0, -1)$, $(1, -3)$ and $(2, -1)$",
    },
    methodTitle: "Vertex first, then symmetry",
    methodText: [
      "The form $y = ax^2 + bx + c$ hides the vertex. For $y = x^2 - 4x + 1$, $x = -\\frac{-4}{2 \\cdot 1} = 2$, and $y = 2^2 - 4 \\cdot 2 + 1 = -3$. So the vertex is $(2, -3)$.",
      "With a fraction in front, such as $a = \\frac{1}{2}$, only some $x$ values give a $y$ that lands on a grid point. Test several, such as $x$ values two steps apart.",
    ],
    formal:
      "Completing the square rewrites $ax^2 + bx + c$ as $a\\left(x + \\frac{b}{2a}\\right)^2 + c - \\frac{b^2}{4a}$, so the vertex is at $x = -\\frac{b}{2a}$. Since $(x - h)^2$ has the same value at $h + d$ and $h - d$, the graph is symmetric about $x = h$.",
    pitfalls: [
      "Read $h$ with the opposite sign from the one inside the parentheses.",
      "Squaring means multiplying a number by itself, so square the whole difference: $(3 - 1)^2 = 4$, not $3 - 1^2$.",
    ],
    parentGuide:
      "Ask your learner to find the vertex first and say which way the parabola opens. Then check one other point by putting its $x$ into the equation.",
  },
  {
    id: "graph-absolute-value-points",
    title: "Graph an absolute value function by placing points",
    goal: "Graph a V-shaped absolute value function by finding its corner point and then points on both sides.",
    summary:
      "The absolute value of a number is its distance from 0, written with bars: $|-3| = 3$. A graph shows, as points $(x, y)$ on a grid, every pair that makes an equation true. The graph of $y = 2|x + 1| - 4$ is V-shaped, with its corner at $(-1, -4)$, called the vertex. In general, $y = a|x - h| + k$ with $a \\ne 0$ has its vertex at $(h, k)$: $h$ across, $k$ up. Find the vertex, then step the same distance left and right to find points.",
    objectives: [
      "Find the vertex of $y = a|x - h| + k$ and which way the graph opens, up or down.",
      "Find grid points on both sides of the vertex by putting in numbers for $x$.",
    ],
    intuition:
      "The absolute value of a number is its distance from 0, written between bars: $|-3| = 3$ and $|3| = 3$. So $|x - h|$ is the distance from $x$ to $h$. It is 0 at $x = h$, and grows by 1 for each step away in either direction. Multiplying by $a$ (not 0) changes how fast it grows, and flips it if $a$ is negative. Adding $k$ moves it up or down. So the graph is V-shaped: two straight arms that meet at a corner called the vertex, $(h, k)$.",
    terms: ["absolute-value", "vertex-parabola"],
    method: [
      "Find the $x$ that makes the inside of the bars 0: that is $h$. Then $y = k$ there, so the vertex is $(h, k)$.",
      "Put in $x$ values on each side. $|x - h|$ is the distance from $h$, so $x = h + d$ and $x = h - d$ give the same $y = ad + k$.",
      "Place the vertex and the other points asked for. Any points that make the equation true are correct.",
    ],
    watch:
      "An absolute value is never negative. So for $a > 0$, the graph never goes below $y = k$. Take the absolute value of the inside before multiplying by $a$.",
    principle:
      "The function $y = a|x - h| + k$ equals $a(x - h) + k$ when $x \\ge h$, and $-a(x - h) + k$ when $x < h$. These are two straight pieces that meet at $(h, k)$. They are mirror images across the line $x = h$.",
    example: {
      prompt:
        "Graph $y = 2\\left|x + 1\\right| - 4$ by placing its vertex and 2 more points.",
      figure: solvedCurve(
        { kind: "absolute", a: [2, 1], h: [-1, 1], k: [-4, 1] },
        [
          [-2, -2],
          [-1, -4],
          [0, -2],
        ],
        "The V through (-2, -2), (-1, -4) and (0, -2)",
      ),
      steps: [
        "The vertex is where the inside of the bars is 0. $x + 1 = 0$ at $x = -1$, and there $y = 2 \\cdot 0 - 4 = -4$. So the vertex is $(-1, -4)$.",
        "Put in $x = 0$, one step right: $y = 2|0 + 1| - 4 = 2 \\cdot 1 - 4 = -2$. So $(0, -2)$ is on the graph.",
        "Put in $x = -2$, one step left: $y = 2|-2 + 1| - 4 = 2 \\cdot 1 - 4 = -2$. So $(-2, -2)$ is on the graph, the mirror image of $(0, -2)$.",
      ],
      answer: "$(-2, -2)$, $(-1, -4)$ and $(0, -2)$",
    },
    methodTitle: "Distance from the vertex",
    methodText: [
      "Think of $|x - h|$ as the number of steps between $x$ and $h$. Each step adds $a$ to $y$, on both sides of the vertex.",
      "With $a = \\frac{1}{2}$ and $k$ an integer (a number like $-2$, 0 or 5 with no fraction part), $y$ is an integer only when the distance is even. So look two steps from the vertex.",
    ],
    formal:
      "For $x \\ge h$, $|x - h| = x - h$, so the graph is the straight arm with slope $a$ starting at $(h, k)$. For $x < h$, $|x - h| = h - x$, so the arm has slope $-a$. The two arms are mirror images across the up-and-down line $x = h$.",
    pitfalls: [
      "Read $h$ with the opposite sign from the one inside the bars: $|x + 1|$ has its vertex at $x = -1$.",
      "Work out the inside first, then take the absolute value, then multiply by $a$.",
    ],
    parentGuide:
      "Ask your learner where the graph turns, and how far each placed point is from that turning point.",
  },
  {
    id: "graph-exponential-points",
    title: "Graph an exponential function by placing points",
    goal: "Graph $y = a \\cdot b^x$ by making a table: each step right multiplies $y$ by $b$, each step left divides.",
    summary:
      "In $y = 3 \\cdot 2^x$, the dot means times, and for $x = 1, 2, 3$ and so on, $2^x$ means 2 multiplied by itself $x$ times; $2^0 = 1$. So each step of 1 to the right multiplies $y$ by 2, and each step left divides $y$ by 2. A rule like this, which multiplies by the same number each step, is called exponential. Its graph (the picture of its points) curves. Going left, it gets closer and closer to the across axis without ever touching it.",
    objectives: [
      "Make a table of $y = a \\cdot b^x$ for whole-number $x$, including negative values.",
      "Keep the points whose outputs are whole numbers that fit on the grid.",
    ],
    intuition:
      "In $b^x$, the small raised $x$ is called the exponent: $2^3 = 2 \\cdot 2 \\cdot 2 = 8$. Any number (other than 0) to the power 0 is 1, so $b^0 = 1$. A function is a rule that turns each input (the number you put in) into one output (the number you get back). A function like $y = a \\cdot b^x$, with $a > 0$, $b > 0$ and $b \\ne 1$, is called exponential. It multiplies $y$ by the same number $b$, called the growth factor, for every step of 1 in $x$. At $x = 0$, $y = a$. Moving right multiplies by $b$ and moving left divides by $b$. The graph bends, because each step multiplies instead of adding. It comes closer and closer to the $x$-axis but never touches it.",
    terms: ["growth-factor", "asymptote"],
    method: [
      "Start at $x = 0$: $y = a \\cdot b^0 = a \\cdot 1 = a$.",
      "Move right by multiplying $y$ by $b$. Move left by dividing $y$ by $b$. Make a table of $x$ and $y$.",
      "Keep the pairs whose $y$ is an integer that fits on the grid, and place the points the question asks for.",
    ],
    watch:
      "A negative exponent does not make $y$ negative: $2^{-1} = \\frac{1}{2}$. For $b = \\frac{1}{2}$, going left doubles $y$.",
    principle:
      "For $a > 0$ and $b > 0$ with $b \\ne 1$, $y = a \\cdot b^x$ is positive for every $x$. It goes up if $b > 1$ and down if $b < 1$. Since $b^{x + 1} = b \\cdot b^x$, each step of 1 in $x$ multiplies $y$ by the same number $b$.",
    example: {
      prompt:
        "Graph $y = 3 \\cdot \\left(\\frac{1}{2}\\right)^x$ by placing 3 points.",
      figure: solvedCurve(
        { kind: "exponential", a: [3, 1], b: [1, 2] },
        [
          [-2, 12],
          [-1, 6],
          [0, 3],
        ],
        "The curve through (-2, 12), (-1, 6) and (0, 3)",
        { xMin: -4, xMax: 4, yMin: -2, yMax: 12 },
      ),
      steps: [
        "Start at $x = 0$, where $\\left(\\frac{1}{2}\\right)^0 = 1$: $y = 3 \\cdot 1 = 3$. So $(0, 3)$ is on the curve.",
        "Going left divides by $\\frac{1}{2}$, and dividing by $\\frac{1}{2}$ doubles a number. So $x = -1$ gives $y = 6$, and $x = -2$ gives $y = 12$.",
        "Going right halves $y$. So $x = 1$ gives $\\frac{3}{2}$, which is not a whole number, so it is not on a grid point.",
      ],
      answer: "$(-2, 12)$, $(-1, 6)$ and $(0, 3)$",
    },
    methodTitle: "Multiply to move right, divide to move left",
    methodText: [
      "A table of $x$ and $y$ shows the pattern: each row multiplies $y$ by $b$. Only the rows whose $y$ is an integer (a number like $-2$, 0 or 5 with no fraction part) land on grid points.",
      "For $b = 2$, the useful points are often to the right of 0. For $b = \\frac{1}{2}$, they are often to the left.",
    ],
    formal:
      "Since $b^{x + 1} = b \\cdot b^x$, the $y$ values one step apart always have the ratio $b$. For $x = -n$ with $n > 0$, $b^{-n} = \\frac{1}{b^n}$, so $y = \\frac{a}{b^n}$. For $b = \\frac{p}{q}$ this equals $a\\left(\\frac{q}{p}\\right)^n$.",
    pitfalls: [
      "Do not treat $2^x$ like $2x$: $2^3 = 8$, not 6.",
      "Skip a point when $y$ is a fraction; only pairs of integers (whole numbers or their negatives) sit on grid points.",
    ],
    parentGuide:
      "Ask your learner to fill a table one row at a time, saying whether each step multiplies or divides.",
  },
  {
    id: "graph-sqrt-points",
    title: "Graph a square root function by placing points",
    summary:
      "The graph of $y = a\\sqrt{x - h} + k$ starts at $(h, k)$ and exists only for $x \\ge h$. Whole-number points need perfect-square radicands.",
    objectives: [
      "Find the starting point and the domain of $y = a\\sqrt{x - h} + k$.",
      "Choose $x$-values that make the radicand a perfect square, and find the points.",
    ],
    intuition:
      "A square root is defined only when what is under it is 0 or positive, so the graph of $y = a\\sqrt{x - h} + k$ begins at $x = h$ and goes right. It rises or falls steeply at first and then flattens. To land on grid points, make $x - h$ equal 0, 1, 4 or 9, whose square roots are the whole numbers 0, 1, 2 and 3.",
    terms: [
      "radicand",
      ["domain", "Here it is $x\\ge h$, where the radicand is not negative."],
    ],
    method: [
      "Set the radicand to 0: $x = h$. Then $y = k$, so the graph starts at $(h, k)$ and no point lies to its left.",
      "Choose $x = h + 1$, $h + 4$ and $h + 9$ so the root is 1, 2 and 3. Compute $y = a \\cdot \\text{root} + k$.",
      "Place the points the question asks for. Any points that satisfy the equation are correct.",
    ],
    watch:
      "$x - h$ must be a perfect square for $y$ to be a whole number: $\\sqrt{3}$ is not whole, so $x = h + 3$ is not a lattice point.",
    principle:
      "The function $y = \\sqrt{x}$ is defined for $x \\ge 0$ and increasing. The graph of $y = a\\sqrt{x - h} + k$ is that curve stretched by $|a|$ (and reflected over the $x$-axis if $a < 0$), then moved $h$ right and $k$ up.",
    example: {
      prompt:
        "Graph $y = 2\\sqrt{x + 3} - 1$ by placing its starting point and 2 more points.",
      figure: solvedCurve(
        { kind: "root", a: [2, 1], h: [-3, 1], k: [-1, 1] },
        [
          [-3, -1],
          [-2, 1],
          [1, 3],
        ],
        "The curve through (-3, -1), (-2, 1) and (1, 3)",
      ),
      steps: [
        "$x + 3 = 0$ at $x = -3$, where $y = 2 \\cdot 0 - 1 = -1$: the graph starts at $(-3, -1)$.",
        "$x = -2$ makes the radicand 1: $y = 2 \\cdot 1 - 1 = 1$, so $(-2, 1)$ is on the curve.",
        "$x = 1$ makes the radicand 4: $y = 2 \\cdot 2 - 1 = 3$, so $(1, 3)$ is on the curve.",
      ],
      answer: "$(-3, -1)$, $(-2, 1)$ and $(1, 3)$",
    },
    methodTitle: "Perfect squares under the root",
    methodText: [
      "List the radicands 0, 1, 4 and 9 and add $h$ to each to get the $x$-values. The $y$-values rise (or fall, if $a < 0$) by $a$ times the roots 0, 1, 2, 3.",
      "The grid is limited, so some of these $x$-values may fall outside it.",
    ],
    formal:
      "$\\sqrt{t}$ is a real number only for $t \\ge 0$, so the domain of $a\\sqrt{x - h} + k$ is $x \\ge h$. For $a \\ne 0$ the value is rational exactly when $x - h$ is the square of a rational number, and a whole number when $x - h$ is a perfect square.",
    pitfalls: [
      "Read $h$ with the opposite sign: $\\sqrt{x + 3}$ starts at $x = -3$.",
      "Do not place points left of the starting point; the function is not defined there.",
    ],
    parentGuide:
      "Ask your learner where the graph starts and which $x$-values make the number under the root a perfect square.",
  },
];

/** How every lesson and method here reads ambiguous glossary words. */
const senses = {
  side: "side-of-equation",
  sides: "side-of-equation",
  term: "term-expression",
  terms: "term-expression",
  unit: "unit",
  units: "unit",
  squared: "square-number",
  square: "square-number",
  vertex: "vertex-parabola",
  base: "base-exponent",
} as const;
const noLink = [
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
  "arms",
  "opposite side",
  "quarter",
  "leaves",
  "difference",
  "increasing",
  "image",
  "images",
  "plane",
  "prime",
];

const stripFormat = (e: Entry): ProblemMethod => ({
  goal: e.goal ?? e.summary,
  senses: { ...senses, ...e.senses },
  noLink,
  intuition: e.intuition,
  terms: e.terms,
  method: e.method,
  watch: e.watch,
});

export const pointPlotMethods: Record<string, ProblemMethod> =
  Object.fromEntries(entries.map((e) => [e.id, stripFormat(e)]));

export const pointPlotPrinciples: Record<string, string> = Object.fromEntries(
  entries.map((e) => [e.id, e.principle]),
);

export const pointPlotLessons: Lesson[] = entries.map((e) => ({
  id: e.id,
  title: e.title,
  summary: e.summary,
  senses: { ...senses, ...e.senses },
  noLink,
  templateIds: [e.id],
  objectives: [...e.objectives],
  includeGeneratedRepresentation: false,
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
