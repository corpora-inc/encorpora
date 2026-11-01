import type { MethodTerm } from "../glossary/types";
import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

export const coordinateCircleLessons: Lesson[] = [
  {
    id: "coordinate-geometry",
    title: "Coordinate geometry: circles, lengths, partitions and slopes",
    summary:
      "A circle contains points the same distance from its center. Coordinates also let you locate points along a segment and compare the directions of lines.",
    templateIds: [
      "circle-equation",
      "coordinate-polygon",
      "segment-partition",
      "perpendicular-slopes",
    ],
    includeGeneratedRepresentation: false,
    objectives: [
      "Read and write circle equations, completing the square when needed, and find perimeters and areas from coordinates.",
      "Find the point that divides a segment in a ratio, and use equal and negative reciprocal slopes.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "A circle is a distance",
        paragraphs: [
          "A circle is all points one fixed distance from a center. That distance is its radius. On a coordinate grid, going sideways and upward from the center makes a right triangle; the sideways and upward distances determine the straight-line radius.",
        ],
        illustration: "circle-equation-distance",
      },
      {
        title: "Read and rearrange the circle equation",
        paragraphs: [
          "For center $(h,k)$ and positive radius $r$, a point $(x,y)$ is on the circle exactly when $(x-h)^2+(y-k)^2=r^2$. The right side is the radius squared. Read the center from the signs: $(x+3)$ means $x-(-3)$, so the center's first coordinate is $-3$.",
          "When the squared terms are expanded, group the $x$ terms and the $y$ terms and complete a square in each to recover the center and radius.",
        ],
      },
      {
        title: "Lengths and areas from coordinates",
        paragraphs: [
          "A horizontal or vertical side is a difference of coordinates. A slanted side with run $a$ and rise $b$ has length √(a² + b²).",
          "For area, enclose the polygon in a rectangle along the grid lines and subtract the right triangles in the corners. The shoelace sum, half of |Σ (xᵢyᵢ₊₁ − xᵢ₊₁yᵢ)|, gives the same area in one calculation.",
        ],
      },
      {
        title: "Partitioning a segment",
        paragraphs: [
          "The point $P$ with $AP : PB = m : n$ is $\\frac{m}{m + n}$ of the way from $A$ to $B$. Take that fraction of the run and of the rise, and add each to the coordinates of $A$.",
          "From A(−3, −2) to $B(6, 4)$, the run is 9 and the rise is 6. For 1 : 2, $P$ is 1/3 of the way: $(-3 + 3, -2 + 2) = (0, 0)$.",
        ],
        illustration: "segment-partition",
      },
      {
        title: "Parallel and perpendicular slopes",
        paragraphs: [
          "Parallel lines have equal slopes. Turning a slope triangle a quarter turn swaps its run and rise and reverses one of them, so a perpendicular line's slope is the negative reciprocal: 2/3 becomes −3/2.",
          "The product of perpendicular slopes is −1 (unless one line is vertical). To write a line through a point, use the slope and the point in y = mx + b and solve for $b$.",
        ],
        illustration: "slope-perpendicular-turn",
      },
    ],
    workedExample: {
      prompt:
        "A circle has equation x² + y² − 4x + 6y − 12 = 0. What is its radius?",
      steps: [
        "Group: (x² − 4x) + (y² + 6y) = 12.",
        "Complete each square: add 4 and 9 to both sides: (x − 2)² + (y + 3)² = 25.",
        "r² = 25, so the radius is 5.",
      ],
      answer: "5",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "A circle with center $(h, k)$ and radius $r$ is the set of points with (x − h)² + (y − k)² = r², the distance formula squared.",
          "Lengths on the plane come from the distance formula, and areas from an enclosing rectangle or the shoelace sum.",
          "The point dividing $AB$ in the ratio $m$ : $n$ is $A$ plus m/(m + n) of the change from $A$ to $B$, in each coordinate.",
          "Nonvertical parallel lines have equal slopes. Perpendicular nonvertical lines have slopes whose product is −1; a vertical line is perpendicular to a horizontal line, and its slope is undefined.",
        ],
      },
    ],
    pitfalls: [
      "The right side of the standard form is r²: take its square root for the radius.",
      "The center's coordinates have the opposite signs of the numbers inside the parentheses.",
      "For $AP : PB = m : n$, $P$ is $\\frac{m}{m + n}$ of the way, not $\\frac{m}{n}$.",
    ],
    parentGuide:
      "Tie a string to a pin on graph paper and trace a circle. Mark the center and a point on the circle, count the squares across and up between them, and check that across² + up² is the string length squared.",
  },
  {
    id: "angles-in-circles",
    title: "Angles in circles",
    summary:
      "An angle at a circle’s edge and one at its center can look at the same arc. Their sizes are linked by a factor of two.",
    templateIds: ["circle-angles"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Find inscribed and central angles on the same arc, and use that inscribed angles on one arc are equal.",
      "Use the right angle in a semicircle and between a tangent and a radius.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Inscribed angles are half the central angle",
        paragraphs: [
          "A central angle has its vertex at the center; an inscribed angle has its vertex on the circle. On the same arc, the inscribed angle is half the central angle: 70° at the center gives 35° at $C$.",
          "The vertex $C$ can be anywhere on the circle on the other side of chord $AB$: every such angle is half of the same central angle, so all of them are equal.",
        ],
        illustration: "circle-inscribed-slide",
      },
      {
        title: "Semicircles and tangents",
        paragraphs: [
          "A diameter's arc is 180°, so an angle inscribed in a semicircle is 180° ÷ 2 = 90°. Triangle $ABC$ with $AB$ a diameter is always right-angled at $C$.",
          "A tangent touches the circle at one point $T$, and it is perpendicular to the radius $OT$ there. So $O$, $T$ and an outside point $P$ on the tangent make a right triangle with hypotenuse $OP$: with radius 5 and $OP = 13$, $PT = \\sqrt{13^2 - 5^2} = 12$.",
        ],
        illustration: "circle-tangent-radius",
      },
    ],
    workedExample: {
      prompt:
        "In circle $O$, central angle $AOB$ measures 110°, and $C$ is on the circle, on the other side of chord $AB$. What is the measure of inscribed angle $ACB$?",
      steps: [
        "$ACB$ and $AOB$ are on the same arc $AB$.",
        "The inscribed angle is half the central angle: 110° ÷ 2 = 55°.",
      ],
      answer: "55",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "An inscribed angle is half the central angle on the same arc; a diameter subtends a right angle; a tangent is perpendicular to the radius at its point of contact.",
        ],
      },
    ],
    pitfalls: [
      "Halve the central angle for the inscribed angle; do not double it.",
      "The right angle in a semicircle is at the point on the circle, not at the ends of the diameter.",
      "In a tangent triangle the hypotenuse is $OP$, from the center to the outside point.",
    ],
    parentGuide:
      "Draw a circle with a plate, then a diameter. Pick any point on the circle and join it to both ends of the diameter. Check the corner with the corner of a sheet of paper: it is always square.",
  },
];

const terms = {
  circle: [
    [
      "center",
      "For the circle $(x - h)^2 + (y - k)^2 = r^2$, the center is $(h, k)$.",
    ],
    [
      "radius",
      "In $(x - h)^2 + (y - k)^2 = r^2$, the right side is the radius squared.",
    ],
  ],
  measure: [
    [
      "distance",
      "Between two points, it is $\\sqrt{\\text{run}^2 + \\text{rise}^2}$.",
    ],
    [
      "rectangle",
      "The enclosing rectangle is the grid rectangle drawn just around a polygon.",
    ],
  ],
  partition: [
    [
      "directed-segment",
      "$AP : PB = m : n$ means $P$ is $\\frac{m}{m + n}$ of the way from $A$ to $B$.",
    ],
    "ratio",
    [
      "slope",
      "The run is the change in $x$ and the rise is the change in $y$ from one point to another.",
    ],
  ],
  slope: [
    ["parallel", "On a graph, non-vertical parallel lines have equal slopes."],
    [
      "perpendicular",
      "On a graph, the slopes of perpendicular lines multiply to −1: they are negative reciprocals.",
    ],
  ],
  angles: ["inscribed-angle", "tangent-line"],
} satisfies Record<string, MethodTerm[]>;
export const coordinateCircleMethods: Record<string, ProblemMethod> = {
  "circle-equation": {
    goal: "Find a circle's center, radius or r² from its equation, a center and a point, or its graph.",
    terms: terms.circle,
    method: [
      "In x² + y² + Dx + Ey + F = 0, complete the square in $x$ and in $y$.",
      "Read $(x - h)^2 + (y - k)^2 = r^2$: the center is $(h, k)$, the radius is the square root of the right side.",
      "From a center and a point, r² is the squared distance between them.",
    ],
    watch:
      "The right side is r², and the center's signs are the opposite of those in the parentheses.",
  },
  "coordinate-polygon": {
    goal: "Find a polygon's perimeter or area from the coordinates of its vertices.",
    terms: terms.measure,
    method: [
      "Perimeter: count horizontal and vertical sides; use $\\sqrt{\\text{run}^2 + \\text{rise}^2}$ for slanted sides; add.",
      "Area: enclose the polygon in a grid rectangle and subtract the corner pieces, or halve the shoelace sum.",
    ],
    watch:
      "A slanted side is not its run plus its rise; use the distance formula.",
  },
  "segment-partition": {
    goal: "Find the point that divides a segment in a ratio or at a fraction of the way.",
    terms: terms.partition,
    method: [
      "Turn the ratio $m$ : $n$ into the fraction m/(m + n).",
      "Find the run and the rise from $A$ to $B$.",
      "Add that fraction of each to A's coordinates.",
    ],
    watch: "The fraction is m/(m + n), measured from $A$, not m/n.",
  },
  "perpendicular-slopes": {
    goal: "Use parallel and perpendicular slopes for a slope, a line through a point or a missing coordinate.",
    terms: terms.slope,
    method: [
      "Find the given line's slope: rise ÷ run.",
      "Parallel: the same slope. Perpendicular: flip it and change its sign.",
      "Through a point, solve y = mx + b for $b$; for a missing coordinate, set the slopes equal.",
    ],
    watch:
      "Perpendicular needs both the flip and the sign change: 2/3 becomes −3/2, not 3/2.",
  },
  "circle-angles": {
    goal: "Find angles and lengths with inscribed angles, semicircles and tangents.",
    terms: terms.angles,
    method: [
      "Find the arc each angle opens onto, and whether its vertex is at the center or on the circle.",
      "Inscribed = half the central angle on the same arc; in a semicircle it is 90°.",
      "A tangent meets the radius at 90°: use the triangle's angle sum or the Pythagorean theorem.",
    ],
    watch: "An inscribed angle is half the central angle, not twice it.",
  },
};
export const coordinateCirclePrinciples: Record<string, string> = {
  "circle-equation":
    "A circle with center $(h, k)$ and radius $r$ is the set of points with (x − h)² + (y − k)² = r², the distance formula squared.",
  "coordinate-polygon":
    "Lengths on the plane come from the distance formula, and areas from an enclosing rectangle or the shoelace sum.",
  "segment-partition":
    "The point dividing $AB$ in the ratio $m$ : $n$ is $A$ plus m/(m + n) of the change from $A$ to $B$, in each coordinate.",
  "perpendicular-slopes":
    "Parallel lines have equal slopes; perpendicular lines have slopes whose product is −1.",
  "circle-angles":
    "An inscribed angle is half the central angle on the same arc; a diameter subtends a right angle; a tangent is perpendicular to the radius at its point of contact.",
};
