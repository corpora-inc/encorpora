import type { MethodTerm } from "../glossary/types";
import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

const GEO_SENSES = {
  side: "side",
  vertex: "vertex",
  degrees: "degree-angle",
  "corresponding angles": "corresponding-angles",
  similar: "similar-figures",
  image: "image-transformation",
  center: "center",
  radius: "radius",
  plane: "plane",
  base: "base-shape",
  face: "face-solid",
  edge: "edge",
  solid: "solid-shape",
  unit: "unit",
  tangent: "tangent-line",
  multiple: "multiple",
  "one third": "third",
} as const;
const GEO_NOLINK = [
  "opposite",
  "part",
  "parts",
  "rule",
  "rules",
  "third",
  "whole",
  "change",
  "changes",
  "square",
  "squares",
  "factor",
  "factors",
  "more than",
  "leaves",
  "mean",
  "product",
  "term",
  "terms",
  "scale",
  "prime",
  "opposite side",
];

export const coordinateCircleLessons: Lesson[] = [
  {
    id: "coordinate-geometry",
    title: "Coordinate geometry: circles, lengths, partitions and slopes",
    summary:
      "On a grid, every point has coordinates, and the distance between two points comes from a right triangle. A circle is all the points at one distance from its center, the point in its middle, so its equation is a distance fact. Coordinates also find the point a given fraction of the way along a segment. And slopes, the steepness of lines, show when lines never meet or meet at square corners.",
    templateIds: [
      "circle-equation",
      "coordinate-polygon",
      "segment-partition",
      "perpendicular-slopes",
    ],
    senses: GEO_SENSES,
    noLink: GEO_NOLINK,
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
          "A circle is all the points one fixed distance from a center point. That distance is the radius. On a grid, go across and then up from the center to a point on the circle. Unless the point is straight across or straight up from the center, that path makes a right triangle, a triangle with a square corner. The distances across and up are its two shorter sides, and the radius is its longest side. The Pythagorean theorem is the rule for such triangles: $\\text{across}^2+\\text{up}^2=\\text{radius}^2$, where the raised 2 means a number times itself.",
        ],
        illustration: "circle-equation-distance",
      },
      {
        title: "Read and rearrange the circle equation",
        paragraphs: [
          "So a point $(x,y)$ is on the circle with center $(h,k)$ and positive radius $r$ exactly when $(x-h)^2+(y-k)^2=r^2$. Here $x-h$ is the change across and $y-k$ is the change up. Either can be negative, but its square is the same as the squared distance. The right side is the radius squared. Read the center from the signs: $(x+3)$ means $x-(-3)$, so the center's first coordinate is $-3$.",
          "Sometimes the squares are multiplied out, as in $x^2+y^2-4x+6y-12=0$. Completing the square is the way to undo this. Group the $x$ terms and the $y$ terms. For each group, take half of the number in front of the letter, square it, and add it to both sides. Then each group is a perfect square, such as $x^2-4x+4=(x-2)^2$.",
        ],
      },
      {
        title: "Lengths and areas from coordinates",
        paragraphs: [
          "A horizontal or vertical side's length is the larger coordinate minus the smaller. A slanted side with run $a$ (change across) and rise $b$ (change up) has length $\\sqrt{a^2+b^2}$, by the Pythagorean theorem.",
          "For area, draw a rectangle along the grid lines just around the polygon. Then subtract the pieces of the rectangle that lie outside the polygon, usually right triangles in its corners.",
        ],
      },
      {
        title: "Partitioning a segment",
        paragraphs: [
          "A ratio $m:n$ splits a segment into $m+n$ equal parts. The point $P$ with $AP:PB=m:n$ is $m$ parts from $A$, so it is $\\frac{m}{m+n}$ of the way from $A$ to $B$. Take that fraction of the run and of the rise, and add each to the coordinates of $A$.",
          "From $A(-3,-2)$ to $B(6,4)$, the run is $6-(-3)=9$ and the rise is $4-(-2)=6$. For $1:2$, $P$ is $\\frac13$ of the way: $(-3+3,\\ -2+2)=(0,0)$.",
        ],
        illustration: "segment-partition",
      },
      {
        title: "Parallel and perpendicular slopes",
        paragraphs: [
          "The slope of a line is its steepness: the rise divided by the run between two of its points, when the run is not 0. Parallel lines are lines that never meet, and when they are not vertical they have equal slopes. Perpendicular lines are lines that meet at a right angle, a square corner.",
          "Turning a slope triangle a quarter turn swaps its run and rise and reverses one of them. So a perpendicular line's slope is the negative reciprocal: flip the fraction and change its sign, so $\\frac23$ becomes $-\\frac32$. The two slopes multiply to $-1$. This needs both lines to be slanted: a horizontal line, with slope 0, is perpendicular to a vertical line, which has no slope.",
          "To write a line through a point, put the slope $m$ and the point into $y=mx+b$ and solve for $b$. The $y$-intercept is the point where the line crosses the $y$-axis, and $b$ tells how far up that point is.",
        ],
        illustration: "slope-perpendicular-turn",
      },
    ],
    workedExample: {
      prompt:
        "A circle has equation x² + y² − 4x + 6y − 12 = 0. What is its radius?",
      steps: [
        "Group the $x$ terms and the $y$ terms, and move the lone number to the right: $(x^2-4x)+(y^2+6y)=12$.",
        "Complete each square. Half of $-4$ is $-2$, and $(-2)^2=4$. Half of 6 is 3, and $3^2=9$. Add 4 and 9 to both sides: $(x-2)^2+(y+3)^2=12+4+9=25$.",
        "The number on the right is $r^2=25$, so the radius is $\\sqrt{25}=5$.",
      ],
      answer: "5",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "A circle with center $(h, k)$ and radius $r$ is the set of points with $(x-h)^2+(y-k)^2=r^2$: the distance formula, squared.",
          "Lengths on the grid come from the distance formula, $\\sqrt{\\text{run}^2+\\text{rise}^2}$. Areas come from an enclosing rectangle minus its corner pieces.",
          "The point dividing $AB$ in the ratio $m:n$ is $A$ plus $\\frac{m}{m+n}$ of the change from $A$ to $B$, in each coordinate.",
          "Nonvertical parallel lines have equal slopes. Perpendicular nonvertical lines have slopes whose product is $-1$. A vertical line is perpendicular to a horizontal line, and its slope is undefined.",
        ],
      },
    ],
    pitfalls: [
      "The right side of the standard form is $r^2$, so take its square root for the radius.",
      "The center's coordinates have the opposite signs of the numbers inside the parentheses.",
      "For $AP : PB = m : n$, $P$ is $\\frac{m}{m + n}$ of the way, not $\\frac{m}{n}$.",
    ],
    parentGuide:
      "Tie a string to a pin on graph paper and trace a circle. Mark the center and a point on the circle, and count the squares across and up between them. Check that across times across, plus up times up, equals the string length times itself.",
  },
  {
    id: "angles-in-circles",
    title: "Angles in circles",
    summary:
      "A central angle has its corner at a circle's center, the point in its middle. An inscribed angle has its corner on the circle itself. When both open onto the same arc, a piece of the circle, the inscribed angle is half the central angle. This one fact explains why an angle with its corner on a half circle, and its sides through the two ends of the diameter, is always a right angle.",
    templateIds: ["circle-angles"],
    senses: GEO_SENSES,
    noLink: GEO_NOLINK,
    includeGeneratedRepresentation: false,
    objectives: [
      "Find inscribed and central angles on the same arc, and use the fact that inscribed angles on one arc are equal.",
      "Use the right angle in a semicircle and between a tangent and a radius.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Inscribed angles are half the central angle",
        paragraphs: [
          "A circle's center is the point in its middle. An arc is a piece of the circle between two points, and a chord is the straight segment joining them. A central angle has its vertex (corner) at the center. An inscribed angle has its vertex on the circle.",
          "When the two angles open onto the same arc, the inscribed angle is half the central angle: $70^\\circ$ at the center gives $35^\\circ$ at $C$.",
          "Chord $AB$ splits the circle into two arcs. Let the central angle open onto the shorter one, and put $C$ anywhere on the longer one. Every such angle $ACB$ opens onto the same shorter arc. So each is half of the same central angle, and all of them are equal.",
        ],
        illustration: "circle-inscribed-slide",
      },
      {
        title: "Semicircles and tangents",
        paragraphs: [
          "A diameter is a chord through the center. It splits the circle into two semicircles, or half circles, and each one's arc is $180^\\circ$. So an angle inscribed in a semicircle is $180^\\circ\\div2=90^\\circ$. Triangle $ABC$, with $AB$ a diameter and $C$ another point of the circle, always has a right angle at $C$.",
          "A tangent is a line that touches the circle at one point $T$. It is perpendicular to the radius $OT$ there, meeting it at a right angle. So $O$, $T$ and an outside point $P$ on the tangent make a right triangle with longest side $OP$. With radius 5 and $OP=13$, $PT=\\sqrt{13^2-5^2}=\\sqrt{144}=12$.",
        ],
        illustration: "circle-tangent-radius",
      },
    ],
    workedExample: {
      prompt:
        "In circle $O$, central angle $AOB$ measures 110°, and $C$ is on the longer arc $AB$. What is the measure of inscribed angle $ACB$?",
      steps: [
        "The central angle $AOB$ opens onto the shorter arc $AB$. Point $C$ is on the longer arc, so angle $ACB$ opens onto the same shorter arc.",
        "An inscribed angle is half the central angle on the same arc: $110^\\circ\\div2=55^\\circ$.",
      ],
      answer: "55",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "An inscribed angle is half the central angle on the same arc. An angle inscribed in a semicircle, opening onto a diameter, is a right angle. A tangent is perpendicular to the radius at its point of contact.",
        ],
      },
    ],
    pitfalls: [
      "Halve the central angle for the inscribed angle. Do not double it.",
      "The right angle in a semicircle is at the point on the circle, not at the ends of the diameter.",
      "In a tangent triangle the longest side is $OP$, from the center to the outside point.",
    ],
    parentGuide:
      "Draw a circle around a plate, then a diameter. Pick a point on the circle other than the two ends of the diameter, and join it to both ends. Check the corner with the corner of a sheet of paper: it is always square.",
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
    goal: "Find a circle's center, radius or $r^2$ from its equation, from a center and a point, or from its graph.",
    senses: GEO_SENSES,
    noLink: GEO_NOLINK,
    intuition:
      "A circle's radius is the distance from its center $(h,k)$ to every point on it, written $r$. By the Pythagorean theorem, a point $(x,y)$ is on it exactly when $(x-h)^2+(y-k)^2=r^2$. The raised 2 means a number times itself. If the squares are multiplied out, complete the square: take half of the number in front of $x$, square it, and add it to both sides. Do the same for $y$.",
    terms: terms.circle,
    method: [
      "If the equation looks like $x^2+y^2+Dx+Ey+F=0$, with numbers $D$, $E$ and $F$, complete the square in $x$ and in $y$.",
      "Read $(x - h)^2 + (y - k)^2 = r^2$: the center is $(h, k)$, and the radius is the square root of the right side.",
      "From a center and a point, $r^2$ is the squared distance between them: across squared plus up squared.",
    ],
    watch:
      "The right side is $r^2$, and the center's signs are the opposite of those in the parentheses.",
  },
  "coordinate-polygon": {
    goal: "Find a polygon's perimeter or area from the coordinates of its vertices.",
    senses: GEO_SENSES,
    noLink: GEO_NOLINK,
    intuition:
      "A polygon is a closed shape with straight sides, and its corners are its vertices. A horizontal or vertical side's length is the larger coordinate minus the smaller. A slanted side with run $a$ (change across) and rise $b$ (change up) has length $\\sqrt{a^2+b^2}$. That follows from the Pythagorean theorem, the rule linking the sides of a triangle with a square corner. The perimeter is all the sides added. Area is the space inside. To find it, draw a rectangle along the grid lines just around the polygon, and subtract the pieces outside the polygon.",
    terms: terms.measure,
    method: [
      "Perimeter: find horizontal and vertical sides by subtracting, and slanted sides with $\\sqrt{\\text{run}^2 + \\text{rise}^2}$. Then add all the sides.",
      "Area: draw a grid rectangle just around the polygon, and subtract the triangles and rectangles in its corners.",
    ],
    watch:
      "A slanted side is not its run plus its rise. Use the distance formula.",
  },
  "segment-partition": {
    goal: "Find the point that divides a segment in a ratio or at a fraction of the way.",
    senses: GEO_SENSES,
    noLink: GEO_NOLINK,
    intuition:
      "A ratio $m:n$ splits a segment into $m+n$ equal parts. The point $P$ with $AP:PB=m:n$ has $m$ parts on $A$'s side, so it is $\\frac{m}{m+n}$ of the way from $A$ to $B$. The run is the change in $x$ from $A$ to $B$, and the rise is the change in $y$. Add $\\frac{m}{m+n}$ of each to $A$'s coordinates.",
    terms: terms.partition,
    method: [
      "Turn the ratio $m:n$ into the fraction $\\frac{m}{m+n}$.",
      "Find the run and the rise from $A$ to $B$.",
      "Add that fraction of each to $A$'s coordinates.",
    ],
    watch:
      "The fraction is $\\frac{m}{m+n}$, measured from $A$, not $\\frac{m}{n}$.",
  },
  "perpendicular-slopes": {
    goal: "Use parallel and perpendicular slopes for a slope, a line through a point or a missing coordinate.",
    senses: GEO_SENSES,
    noLink: GEO_NOLINK,
    intuition:
      "Slope is a line's steepness: the rise (change in $y$) divided by the run (change in $x$) between two of its points, when the run is not 0. Parallel lines are lines that never meet. Perpendicular lines are lines that meet at a right angle. A vertical line is one that goes straight up and down, and a horizontal line is a flat one. Parallel lines that are not vertical have equal slopes. If neither perpendicular line is vertical or horizontal, their slopes are negative reciprocals: flip the fraction and change the sign, so $\\frac23$ goes with $-\\frac32$. A line that is not vertical can be written $y=mx+b$, where $m$ is the slope and $b$ is where it crosses the $y$-axis.",
    terms: terms.slope,
    method: [
      "Find the given line's slope: rise divided by run.",
      "A parallel line that is not vertical has the same slope. When neither line is vertical or horizontal, a perpendicular line has the negative reciprocal: flip it and change its sign.",
      "Through a point, put the slope and the point into $y=mx+b$ and solve for $b$. For a missing coordinate, set the slope through the points equal to the slope it must have.",
    ],
    watch:
      "Perpendicular needs both the flip and the sign change: $\\frac23$ becomes $-\\frac32$, not $\\frac32$.",
  },
  "circle-angles": {
    goal: "Find angles and lengths with inscribed angles, semicircles and tangents.",
    senses: GEO_SENSES,
    noLink: GEO_NOLINK,
    intuition:
      "A central angle has its corner at the circle's center. An inscribed angle has its corner on the circle. Each opens onto an arc, the piece of the circle between its sides. On the same arc, the inscribed angle is half the central angle. A diameter, a chord through the center, cuts off a half circle, so an angle inscribed in it is $90^\\circ$. A tangent is a line that touches the circle at exactly one point, called the point of tangency. It meets the radius there at $90^\\circ$.",
    terms: terms.angles,
    method: [
      "Find the arc each angle opens onto, and whether its corner is at the center or on the circle.",
      "An inscribed angle is half the central angle on the same arc. In a half circle it is $90^\\circ$.",
      "A tangent meets the radius at $90^\\circ$. Use the triangle's $180^\\circ$ angle sum or the Pythagorean theorem.",
    ],
    watch: "An inscribed angle is half the central angle, not twice it.",
  },
};
export const coordinateCirclePrinciples: Record<string, string> = {
  "circle-equation":
    "A circle with center $(h, k)$ and radius $r$ is the set of points with $(x-h)^2+(y-k)^2=r^2$: the distance formula, squared.",
  "coordinate-polygon":
    "Lengths on the plane come from the distance formula, $\\sqrt{\\text{run}^2+\\text{rise}^2}$. Areas come from an enclosing rectangle minus its corner pieces.",
  "segment-partition":
    "The point dividing $AB$ in the ratio $m:n$ is $A$ plus $\\frac{m}{m+n}$ of the change from $A$ to $B$, in each coordinate.",
  "perpendicular-slopes":
    "Parallel lines that are not vertical have equal slopes. Perpendicular lines that are not vertical have slopes that multiply to $-1$. A vertical line is perpendicular to a horizontal line.",
  "circle-angles":
    "An inscribed angle is half the central angle on the same arc. An angle inscribed in a semicircle is a right angle. A tangent is perpendicular to the radius at its point of contact.",
};
