import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";
import {
  pointPlotScene,
  type LatticePoint,
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
