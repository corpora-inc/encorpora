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
    id: "plot-points",
    title: "Plot points in all four quadrants",
    summary:
      "An ordered pair is a pair of moves from the origin: across by the first number, then up or down by the second. Signs give the directions.",
    objectives: [
      "Plot points with positive, negative and zero coordinates, including points on an axis.",
      "Plot the reflection of a point across the $x$-axis or the $y$-axis by changing the sign of one coordinate.",
    ],
    intuition:
      "The coordinate plane has two number lines that cross at the origin, $(0, 0)$. The horizontal one is the $x$-axis and the vertical one is the $y$-axis. In $(3, -2)$, the first number says move 3 right and the second says move 2 down. A zero means no move in that direction, so the point lands on an axis.",
    terms: [
      [
        "ordered pair",
        "Two numbers $(x, y)$ that locate a point: $x$ across, then $y$ up or down.",
      ],
      ["quadrant", "One of the four regions the axes cut the plane into."],
    ],
    method: [
      "Start at the origin. Move along the $x$-axis by the first coordinate: right if positive, left if negative.",
      "From there, move up for a positive second coordinate or down for a negative one, and place the point.",
      "A 0 coordinate means no move: $(0, 4)$ is on the $y$-axis and $(-5, 0)$ is on the $x$-axis. Check each placed point's readout against the pair.",
    ],
    watch:
      "Move across first, then up or down. Swapping the coordinates plots $(-2, 3)$ instead of $(3, -2)$, a different point.",
    principle:
      "Each point of the plane corresponds to exactly one ordered pair $(x, y)$ of real numbers, its signed horizontal and vertical distances from the origin. Points whose coordinates differ only in sign are reflections of each other across an axis: $(x, -y)$ across the $x$-axis and $(-x, y)$ across the $y$-axis.",
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
        "$A(3, -2)$: from the origin move 3 units right, then 2 units down.",
        "$B(0, 4)$: no move across, so stay on the $y$-axis and move 4 units up.",
        "$C(-5, 0)$: move 5 units left and no move up or down, so $C$ is on the $x$-axis.",
      ],
      answer: "$(3, -2)$, $(0, 4)$ and $(-5, 0)$",
    },
    methodTitle: "Signs give directions",
    methodText: [
      "In quadrant I both coordinates are positive. Going counterclockwise, quadrant II has negative $x$, quadrant III has both negative and quadrant IV has negative $y$. A point on an axis is in no quadrant.",
      "A point described in words works the same way: 4 units left of the $y$-axis means $x = -4$, and 3 units above the $x$-axis means $y = 3$.",
    ],
    formal:
      "The plane is the set of ordered pairs of real numbers. The distance of $(x, y)$ from the $y$-axis is $|x|$ and from the $x$-axis is $|y|$. Reflection across the $x$-axis maps $(x, y)$ to $(x, -y)$; across the $y$-axis it maps $(x, y)$ to $(-x, y)$.",
    pitfalls: [
      "Plot the first coordinate across and the second up or down, never the reverse.",
      "A zero coordinate places the point on an axis, not at the origin.",
    ],
    parentGuide:
      "Ask your learner to say each move aloud before tapping: “3 right, 2 down.”",
  },
  {
    id: "graph-linear-equation",
    title: "Graph a line from its equation",
    summary:
      "Two points determine a line. Find one point from the equation, use the slope to find a second, and the graph is the line through them.",
    objectives: [
      "Find points of a line from slope-intercept, standard or point-slope form, or from a proportional relationship.",
      "Use the slope as rise over run to move from one lattice point of the line to the next.",
    ],
    intuition:
      "An equation in $x$ and $y$ describes a set of points: all the pairs that make it true. For a linear equation those points lie on a line. The slope says how much $y$ changes for each step in $x$, so from one point of the line you can walk to the next.",
    terms: [
      [
        "slope",
        "Rise over run: the change in $y$ divided by the change in $x$ between two points of the line.",
      ],
      [
        "$y$-intercept",
        "Where the line crosses the $y$-axis, the point where $x = 0$.",
      ],
    ],
    method: [
      "Find one point: in $y = mx + b$ it is $(0, b)$; in $y - y_1 = m(x - x_1)$ it is $(x_1, y_1)$; a proportional relationship passes through $(0, 0)$; in $ax + by = c$ substitute an $x$-value that makes $y$ whole.",
      "From that point use the slope $\\frac{\\text{rise}}{\\text{run}}$: move right by the run and up by the rise (down if the rise is negative) to a second point.",
      "Place both points. Any two different points of the line are correct; the graph is the line through them.",
    ],
    watch:
      "A negative slope goes down as you move right. In point-slope form the signs flip: $y + 4 = 2(x - 3)$ passes through $(3, -4)$, not $(-3, 4)$.",
    principle:
      "The solutions of a linear equation $ax + by = c$ with $a$ and $b$ not both zero form a line. Any two of its points have the same rise-to-run ratio, the slope $-\\frac{a}{b}$ when $b \\ne 0$, and two distinct points determine the line.",
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
        "In $y = mx + b$, $b = 3$, so the line crosses the $y$-axis at $(0, 3)$.",
        "The slope $-\\frac{2}{3}$ means a run of 3 and a rise of $-2$: from $(0, 3)$ move 3 units right and 2 units down to $(3, 1)$.",
        "Check $(3, 1)$: $-\\frac{2}{3}\\cdot 3 + 3 = 1$. The graph is the line through $(0, 3)$ and $(3, 1)$.",
      ],
      answer: "the line through $(0, 3)$ and $(3, 1)$",
    },
    methodTitle: "One point, then the slope",
    methodText: [
      "A fractional slope tells you how far to step so you land on grid points: with slope $\\frac{2}{3}$, move 3 right and 2 up. With a whole-number slope such as $-2$, move 1 right and 2 down.",
      "A horizontal line $y = k$ has slope 0: every point has $y$-coordinate $k$. A proportional relationship $y = kx$ always passes through the origin.",
    ],
    formal:
      "If $(x_1, y_1)$ and $(x_2, y_2)$ satisfy $ax + by = c$, subtracting gives $a(x_2 - x_1) + b(y_2 - y_1) = 0$, so with $b \\ne 0$ the slope $\\frac{y_2 - y_1}{x_2 - x_1} = -\\frac{a}{b}$ is the same for every pair. Conversely, every point on the line through two solutions is a solution.",
    pitfalls: [
      "Read the point in point-slope form with the opposite signs of the numbers shown.",
      "For a negative slope, move down as you move right.",
    ],
    parentGuide:
      "Ask your learner to name the starting point and the slope's run and rise before placing anything.",
  },
  {
    id: "place-transformed-image",
    title: "Place the image of a rigid motion",
    summary:
      "A translation, reflection or rotation moves every point by one rule. Apply it to each vertex and place each image under its primed label.",
    objectives: [
      "Apply coordinate rules for translations, reflections over an axis and rotations of 90° or 180° about the origin.",
      "Place images in order, so $A$ maps to $A'$, $B$ to $B'$ and $C$ to $C'$.",
    ],
    intuition:
      "A rigid motion moves a figure without stretching or bending it. Each original point, or vertex, has one image point, named with a prime: $A$ moves to $A'$ (said “A prime”). Find each image with the motion's coordinate rule.",
    terms: [
      [
        "image",
        "The point a motion moves an original point to, written with a prime.",
      ],
      [
        "rigid motion",
        "A translation, reflection or rotation: it keeps every length and angle.",
      ],
    ],
    method: [
      "Write the rule: a translation adds the same amounts, $(x, y) \\to (x + h, y + k)$; a reflection over the $x$-axis gives $(x, -y)$ and over the $y$-axis $(-x, y)$.",
      "For rotations about the origin: 90° counterclockwise gives $(-y, x)$, 90° clockwise $(y, -x)$ and 180° gives $(-x, -y)$.",
      "Apply the rule to each vertex and place each image under its own label: $A'$ first, then $B'$, then $C'$.",
    ],
    watch:
      "For 90° rotations, swap the coordinates and then change one sign. Check the direction: counterclockwise from quadrant I lands in quadrant II.",
    principle:
      "Translations, reflections and rotations preserve distance, so the image of a figure is congruent to it. Each motion has a coordinate rule, and the image of a polygon is the polygon through the images of its vertices, in the same order.",
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
        "The rule for 90° counterclockwise about the origin is $(x, y) \\to (-y, x)$.",
        "$A(1, 2) \\to A'(-2, 1)$, $B(4, 2) \\to B'(-2, 4)$ and $C(1, 5) \\to C'(-5, 1)$.",
        "Check: $AB = 3$ and $A'B' = 3$. The image is the same size and shape, turned a quarter turn.",
      ],
      answer: "$A'(-2, 1)$, $B'(-2, 4)$ and $C'(-5, 1)$",
    },
    methodTitle: "Rules for each motion",
    methodText: [
      "A reflection keeps the coordinate along the mirror axis and changes the sign of the other. A half turn changes both signs. A quarter turn swaps the coordinates, then changes the sign of the new $x$ (counterclockwise) or the new $y$ (clockwise).",
      "Place images in order; each label goes with its own vertex.",
    ],
    formal:
      "Rotation by 90° counterclockwise about the origin maps $(x, y)$ to $(-y, x)$: it takes $(1, 0)$ to $(0, 1)$ and $(0, 1)$ to $(-1, 0)$, and is linear. Each rule preserves $(x_2 - x_1)^2 + (y_2 - y_1)^2$, the squared distance, so it is a rigid motion.",
    pitfalls: [
      "Do not mix up clockwise and counterclockwise: $(x, y) \\to (-y, x)$ is counterclockwise.",
      "Place each image under its own label; $A'$ is the image of $A$.",
    ],
    parentGuide:
      "Ask your learner to say the rule, then check that each side of the image has the same length as the original.",
  },

  {
    id: "graph-quadratic-points",
    title: "Graph a parabola by placing points",
    summary:
      "A parabola is symmetric about its vertex. Find the vertex, then substitute nearby whole numbers for $x$ to find more points.",
    objectives: [
      "Read the vertex from vertex form, and find it from standard form with $x = -\\frac{b}{2a}$.",
      "Find lattice points of a parabola by substituting whole-number values of $x$ and using symmetry.",
    ],
    intuition:
      "A quadratic function $y = ax^2 + bx + c$ graphs as a parabola, a curve with a turning point called the vertex. The two sides mirror each other across the vertical line through the vertex, so $x$-values the same distance on either side of it give the same $y$. Unlike a line, a parabola has no constant slope: a few points do not fix it until you know the vertex and the direction it opens.",
    terms: [
      [
        "vertex",
        "The turning point of a parabola: its lowest point if $a > 0$ and its highest if $a < 0$.",
      ],
      [
        "axis of symmetry",
        "The vertical line through the vertex that maps the parabola onto itself.",
      ],
    ],
    method: [
      "Find the vertex. In $y = a(x - h)^2 + k$ it is $(h, k)$. In $y = ax^2 + bx + c$ it has $x = -\\frac{b}{2a}$; substitute that $x$ to get $y$.",
      "Substitute whole-number $x$-values next to the vertex's $x$ and compute $y$. By symmetry, $x = h + 1$ and $x = h - 1$ give the same $y$.",
      "Place the required points. Any points that satisfy the equation are correct, so the vertex plus two points on either side is a good set. The $y$-intercept is $(0, c)$.",
    ],
    watch:
      "In $y = a(x - h)^2 + k$ the $x$-coordinate of the vertex is $h$, the opposite of the sign inside the parentheses: $y = (x + 3)^2$ has its vertex at $x = -3$.",
    principle:
      "The graph of $y = a(x - h)^2 + k$ is the parabola $y = ax^2$ shifted $h$ units right and $k$ units up. It is symmetric about $x = h$, and a point $(x, y)$ is on the graph exactly when its coordinates satisfy the equation.",
    example: {
      prompt:
        "Graph $y = 2(x - 1)^2 - 3$ by placing its vertex and 2 other points on the curve.",
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
        "The vertex is $(h, k) = (1, -3)$, and the parabola opens upward because $a = 2$ is positive.",
        "Substitute $x = 2$: $y = 2(2 - 1)^2 - 3 = 2 \\cdot 1 - 3 = -1$, so $(2, -1)$ is on the curve.",
        "By symmetry about $x = 1$, the point at $x = 0$ has the same $y$: check $y = 2(0 - 1)^2 - 3 = -1$.",
      ],
      answer: "$(0, -1)$, $(1, -3)$ and $(2, -1)$",
    },
    methodTitle: "Vertex first, then symmetry",
    methodText: [
      "Standard form hides the vertex. For $y = x^2 - 4x + 1$, $x = -\\frac{-4}{2 \\cdot 1} = 2$ and $y = 2^2 - 4 \\cdot 2 + 1 = -3$, so the vertex is $(2, -3)$.",
      "A fraction in front, such as $a = \\frac{1}{2}$, makes $y$ whole only when $(x - h)^2$ is even, so test $x$-values two units apart.",
    ],
    formal:
      "Completing the square rewrites $ax^2 + bx + c$ as $a\\left(x + \\frac{b}{2a}\\right)^2 + c - \\frac{b^2}{4a}$, so the vertex is at $x = -\\frac{b}{2a}$. Since $(x - h)^2$ takes equal values at $h + d$ and $h - d$, the graph is symmetric about $x = h$.",
    pitfalls: [
      "Read $h$ with the opposite sign from the one inside the parentheses.",
      "Square the whole difference: $(3 - 1)^2 = 4$, not $3 - 1^2$.",
    ],
    parentGuide:
      "Ask your learner to find the vertex first and say which direction the parabola opens, then check one other point by substituting.",
  },
  {
    id: "graph-absolute-value-points",
    title: "Graph an absolute value function by placing points",
    summary:
      "The graph of $y = a|x - h| + k$ is a V with its vertex at $(h, k)$. Both sides are straight, with slopes $a$ and $-a$.",
    objectives: [
      "Find the vertex of $y = a|x - h| + k$ and the direction the V opens.",
      "Find lattice points on both sides of the vertex by substituting.",
    ],
    intuition:
      "The absolute value $|x - h|$ is the distance from $x$ to $h$, so it is 0 at $x = h$ and grows by 1 for each unit moved in either direction. Multiplying by $a$ and adding $k$ stretches the distance and lifts it: the graph is two rays that meet at the vertex $(h, k)$.",
    terms: [
      [
        "absolute value",
        "The distance of a number from 0, written $|x|$, never negative.",
      ],
      [
        "vertex",
        "The point where the two rays of the V meet: the lowest point if $a > 0$ and the highest if $a < 0$.",
      ],
    ],
    method: [
      "Find the $x$ that makes the inside of the absolute value 0: that is $h$. Then $y = k$ there, so the vertex is $(h, k)$.",
      "Substitute $x$-values on each side: $|x - h|$ is the distance from $h$, so $x = h + d$ and $x = h - d$ give the same $y = ad + k$.",
      "Place the vertex and points on the sides as the question asks. Any points that satisfy the equation are correct.",
    ],
    watch:
      "The absolute value is never negative, so for $a > 0$ the graph never goes below $y = k$. Do not continue the left ray with a negative inside value.",
    principle:
      "The function $y = a|x - h| + k$ equals $a(x - h) + k$ for $x \\ge h$ and $-a(x - h) + k$ for $x < h$: two linear pieces that meet at $(h, k)$ and are mirror images across $x = h$.",
    example: {
      prompt:
        "Graph $y = 2\\left|x + 1\\right| - 4$ by placing its vertex and 2 other points on the curve.",
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
        "The inside $x + 1$ is 0 at $x = -1$, and $y = 2 \\cdot 0 - 4 = -4$, so the vertex is $(-1, -4)$.",
        "Substitute $x = 0$: $y = 2|0 + 1| - 4 = 2 \\cdot 1 - 4 = -2$, so $(0, -2)$ is on the curve.",
        "Substitute $x = -2$: $y = 2|-2 + 1| - 4 = 2 \\cdot 1 - 4 = -2$, so $(-2, -2)$ is on the curve.",
      ],
      answer: "$(-2, -2)$, $(-1, -4)$ and $(0, -2)$",
    },
    methodTitle: "Distance from the vertex",
    methodText: [
      "Think of $|x - h|$ as the number of units between $x$ and $h$. Each unit adds $a$ to $y$ on both sides of the vertex.",
      "With $a = \\frac{1}{2}$, $y$ is a whole number only when the distance is even, so look two units from the vertex.",
    ],
    formal:
      "For $x \\ge h$, $|x - h| = x - h$ and the graph is the ray of slope $a$ from $(h, k)$; for $x < h$, $|x - h| = h - x$ and the ray has slope $-a$. The two rays are reflections of each other across the vertical line $x = h$.",
    pitfalls: [
      "Read $h$ with the opposite sign from the one inside the bars: $|x + 1|$ has its vertex at $x = -1$.",
      "Evaluate the inside first, then take the absolute value, then multiply by $a$.",
    ],
    parentGuide:
      "Ask your learner where the V turns and how far each placed point is from that turning point.",
  },
  {
    id: "graph-exponential-points",
    title: "Graph an exponential function by placing points",
    summary:
      "In $y = a \\cdot b^x$, each step right multiplies $y$ by $b$. Negative inputs divide, and the graph never reaches $y = 0$.",
    objectives: [
      "Build a table of $y = a \\cdot b^x$ for whole-number $x$, including negative values.",
      "Keep the points whose outputs are whole numbers on the grid.",
    ],
    intuition:
      "An exponential function multiplies by the same factor $b$ for every step of 1 in $x$. Starting from $y = a$ at $x = 0$, moving right multiplies by $b$ and moving left divides by $b$. The graph bends because equal steps in $x$ multiply $y$, rather than adding to it, and it approaches the $x$-axis but never touches it.",
    terms: [
      [
        "growth factor",
        "The number $b$ that $y$ is multiplied by when $x$ increases by 1.",
      ],
      [
        "asymptote",
        "A line the graph gets closer to without touching: here the $x$-axis, $y = 0$.",
      ],
    ],
    method: [
      "Start at $x = 0$: $y = a \\cdot b^0 = a$.",
      "Move right by multiplying by $b$, and left by dividing by $b$ (equivalent to $b^{-1} = \\frac{1}{b}$). Make a table.",
      "Keep the pairs whose $y$ is a whole number that fits on the grid, and place the points the question asks for.",
    ],
    watch:
      "A negative exponent does not make $y$ negative: $2^{-1} = \\frac{1}{2}$. For $b = \\frac{1}{2}$, going left doubles $y$.",
    principle:
      "For $a > 0$ and $b > 0$, $b \\ne 1$, the function $y = a \\cdot b^x$ is positive for every $x$, increasing if $b > 1$ and decreasing if $b < 1$, and $b^{x + 1} = b \\cdot b^x$, so equal steps in $x$ multiply $y$ by equal factors.",
    example: {
      prompt:
        "Graph $y = 3 \\cdot \\left(\\frac{1}{2}\\right)^x$ by placing 3 points on its curve.",
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
        "At $x = 0$: $y = 3 \\cdot 1 = 3$, so $(0, 3)$ is on the curve.",
        "Going left divides by $\\frac{1}{2}$, which doubles $y$: $x = -1$ gives $y = 6$ and $x = -2$ gives $y = 12$.",
        "Going right halves $y$: $x = 1$ gives $\\frac{3}{2}$, which is not a whole number, so it is not a lattice point.",
      ],
      answer: "$(-2, 12)$, $(-1, 6)$ and $(0, 3)$",
    },
    methodTitle: "Multiply to move right, divide to move left",
    methodText: [
      "A table of $x$ and $y$ shows the pattern: each row multiplies $y$ by $b$. Only the rows with whole-number $y$ become points.",
      "For $b = 2$ the useful points are to the right of 0; for $b = \\frac{1}{2}$ they are to the left.",
    ],
    formal:
      "Since $b^{x + 1} = b \\cdot b^x$, the ratio of $y$-values one unit apart is the constant $b$. For $x = -n$ with $n > 0$, $b^{-n} = \\frac{1}{b^n}$, so $y = \\frac{a}{b^n}$; for $b = \\frac{p}{q}$ this equals $a\\left(\\frac{q}{p}\\right)^n$.",
    pitfalls: [
      "Do not treat $2^x$ like $2x$: $2^3 = 8$, not 6.",
      "Skip a point when $y$ is a fraction; only whole-number pairs sit on grid points.",
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
      ["radicand", "The expression under the square root sign, here $x - h$."],
      [
        "domain",
        "The $x$-values for which the function is defined: here $x \\ge h$.",
      ],
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
        "Graph $y = 2\\sqrt{x + 3} - 1$ by placing its starting point and 2 other points on the curve.",
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

const stripFormat = (e: Entry): ProblemMethod => ({
  goal: e.summary,
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
