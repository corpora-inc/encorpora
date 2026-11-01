import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";
import { graph } from "../math/scene/author";

const templateId = "slope-triangle-statements";

export const slopeTriangleStatementsScene = graph({
  id: "g",
  x: [-1, 9],
  y: [0, 14],
  grid: 1,
  tick: 2,
  aspect: 1,
  slopeTriangles: [
    { from: [0, 1], to: [2, 4], labels: "shown", color: "accent" },
    { from: [4, 7], to: [8, 13], labels: "shown", color: "warm" },
  ],
})
  .line(
    {
      through: [
        [0, 1],
        [8, 13],
      ],
    },
    { color: "ink", dash: "dash" },
  )
  .segment([0, 1], [2, 4], { color: "accent" })
  .segment([4, 7], [8, 13], { color: "warm" })
  .point(0, 1, "A", { color: "accent" })
  .point(2, 1, "B", { color: "accent" })
  .point(2, 4, "C", { color: "accent" })
  .point(4, 7, "D", { color: "warm" })
  .point(8, 7, "E", { color: "warm" })
  .point(8, 13, "F", { color: "warm" })
  .scene({
    title:
      "On one rising line, triangle ABC has vertices A(0, 1), B(2, 1), C(2, 4); triangle DEF has D(4, 7), E(8, 7), F(8, 13). Equal grid units show runs 2 and 4, and rises 3 and 6.",
    note: "The right angles are at B and E. Horizontal legs AB and DE have lengths 2 and 4; vertical legs BC and EF have lengths 3 and 6. The slanted sides AC and DF lie on the same line.",
  });

export const slopeTriangleStatementsLesson: Lesson = {
  id: templateId,
  title: "What two slope triangles share",
  summary:
    "Pick two stretches of the same straight line. Under each one, move right and then straight up to the line. Those two moves and the stretch make a triangle with a square corner. In the picture, one triangle goes 2 right and 3 up, and the other goes 4 right and 6 up. The big one is twice as wide and twice as tall. So both show the same steepness: 3 up for every 2 right.",
  templateIds: [templateId],
  includeGeneratedRepresentation: false,
  senses: {
    side: "side",
    similar: "similar-figures",
    square: "square-shape",
    vertex: "vertex",
    degree: "degree-angle",
    unit: "unit",
    scale: "scale-factor",
  },
  noLink: ["whole", "change", "changes", "part", "parts", "third", "mean"],
  objectives: [
    "Read how far each triangle goes right (the run) and up or down (the rise).",
    "Match the corners of two triangles, and decide whether they have the same shape or the same shape and size.",
    "Tell equal steepness and equal angles apart from equal side lengths, for lines that go up or down.",
  ],
  sections: [
    {
      stage: "intuition",
      title: "Walk across, then up or down",
      paragraphs: [
        "A triangle is a shape with three straight sides and three corners. To build one along a line, start at a point on the line. Move horizontally, straight across to the right. Then move vertically, straight up or down, until you reach the line again. These two moves meet at a square corner, called a right angle.",
        "A triangle with a right angle is called a right triangle. Its legs are the two sides that meet at the right angle. The third side, the slanted one along the line, is called the hypotenuse.",
        "A coordinate grid is a sheet of equal squares with two number lines, called axes, that cross at $(0, 0)$. A point such as $A(0, 1)$ has two coordinates, the numbers that give its place. The first says how far across, and the second says how far up. Two letters name a side: $AB$ is the side from $A$ to $B$. A corner of a triangle is also called a vertex; the plural is vertices.",
        "$\\angle B$ means the angle at corner $B$. A degree is the size of a tiny turn: a full turn is 360 degrees. So $90^\\circ$, read 90 degrees, is the size of a right angle.",
        "The run is how far you move right. The rise is how far you move up or down, with a sign: positive for up, negative for down. Slope is the rise divided by the run. It tells how steep the line is. If the line falls as you move right, the rise and the slope are negative. A side length is a distance, so it is always positive.",
        "Similar triangles are triangles with the same shape. Congruent triangles are triangles with the same shape and the same size.",
      ],
      illustration: "slope-triangle-statements-example",
    },
    {
      stage: "method",
      title: "Match the corners and compare the changes",
      paragraphs: [
        "In the picture, the grid squares show the horizontal legs $AB = 2$ and $DE = 4$, and the vertical legs $BC = 3$ and $EF = 6$. The right angles are at $B$ and $E$. The numbers beside the legs are changes, how far you moved, not coordinates.",
        "Corresponding means playing the same role in both triangles. Pair the right-angle corners first. Then pair the lower ends of the slanted sides, and then the upper ends. Corresponding sides join corresponding corners.",
        "Two triangles are similar when they have the same shape. Every angle matches its partner, and every side of one is the same number times its matching side in the other. That number is called the scale factor. Here each side of triangle $DEF$ is 2 times its match in triangle $ABC$.",
        "Two triangles are congruent when they also have the same size, so the scale factor is 1. Congruent triangles are always similar too. Similar triangles need not be congruent.",
        "On a falling line, keep the minus sign in the rise when you find the slope. A run of 2 with a drop of 3 has slope $-\\tfrac{3}{2}$. A run of 4 with a drop of 6 has slope $-\\tfrac{6}{4} = -\\tfrac{3}{2}$. The vertical side lengths are still 3 and 6, because lengths are never negative. A vertical line has a run of 0, and you cannot divide by 0, so its slope is undefined: it has no number.",
      ],
    },
  ],
  closingSections: [
    {
      stage: "formal",
      title: "Equal ratios, corresponding parts",
      paragraphs: [
        "Take two points on a line, $P(x_1, y_1)$ and $Q(x_2, y_2)$, with $Q$ to the right of $P$. The small numbers 1 and 2 tell which point each coordinate belongs to. The run is $r = x_2 - x_1$, which is positive. The rise is $h = y_2 - y_1$, which keeps its sign. The slope is $m = \\tfrac{h}{r}$. The leg lengths are $r$ and $|h|$, The bars mean absolute value: $|h|$ is $h$ without its minus sign.",
        "Now take two stretches of one line that is neither horizontal nor vertical. Both slope triangles have a right angle. Their horizontal legs are parallel, which means they never meet. Their slanted sides lie on the same line. So the angles where the slanted side meets the horizontal leg are equal too.",
        "Two triangles with two pairs of equal angles are similar. Then their corresponding sides are proportional: each side is the same number times its match.",
        "Let that number be $k = \\tfrac{r_2}{r_1}$, which is positive. Similarity makes the second vertical leg $k$ times the first. Both stretches go the same way along the line, so the rises have the same sign: $h_2 = k \\times h_1$. Then $\\tfrac{h_2}{r_2} = \\tfrac{k \\times h_1}{k \\times r_1} = \\tfrac{h_1}{r_1}$, because the $k$ on top and bottom divide out. So the slopes are equal. The triangles are congruent exactly when $k = 1$.",
        "On a falling line both rises are negative, but the leg lengths stay positive. A horizontal line has slope 0: its rise is 0, so there is no triangle, only a flat piece of line. A vertical line has run 0, so its slope is undefined.",
      ],
    },
  ],
  workedExample: {
    prompt:
      "On one coordinate grid, $A(0,1)$, $B(2,1)$, $C(2,4)$ make one right triangle; $D(4,7)$, $E(8,7)$, $F(8,13)$ make another. The slanted sides lie on the same straight line. Which corners match, do the triangles have equal slope, and are they similar or congruent?",
    steps: [
      "From $A$ to $C$, move 2 units right along $AB$ and 3 units up along $BC$; a unit is one grid square. The two legs meet at $B$, so $\\angle B = 90^\\circ$. The slope of $AC$ is rise ÷ run $= \\tfrac{3}{2}$.",
      "From $D$ to $F$, move 4 units right along $DE$ and 6 units up along $EF$. The right angle is at $E$. The slope of $DF$ is $\\tfrac{6}{4} = \\tfrac{3}{2}$, the same as $AC$, because both lie on one line.",
      "Match the corners by their roles. $A$ and $D$ are the lower ends of the slanted sides, $B$ and $E$ are the right angles, and $C$ and $F$ are the upper ends. The angles at $A$ and $D$ are equal, because each sits between the same line and a horizontal side. A triangle's angles add to $180^\\circ$, so the angles at $C$ and $F$ are equal too.",
      "Compare matching legs: $DE \\div AB = 4 \\div 2 = 2$ and $EF \\div BC = 6 \\div 3 = 2$. All the angles match, so the shapes are the same, and every side of $DEF$ is 2 times its match. That number 2 is called the scale factor. The triangles are similar with scale factor 2. They are not congruent, because $AB = 2$ but $DE = 4$.",
    ],
    answer: "equal slope 3/2; similar at scale 2, not congruent",
  },
  pitfalls: [
    "Match the right-angle corners first. Here $B$ matches $E$, not $D$ or $F$.",
    "Equal slopes and equal angles give the same shape, not the same size. Check the matching side lengths before saying congruent. A triangle slid along the line without resizing is both congruent and similar.",
    "Keep a downward rise negative when you find the slope, but use a positive length for each side.",
  ],
  parentGuide:
    "On square grid paper, mark the move across and the move up for each triangle. Ask which corner is square, what rise divided by run gives for each, and whether the bigger triangle could be slid onto the smaller one without shrinking it.",
};

export const slopeTriangleStatementsMethod: ProblemMethod = {
  goal: "Choose the three true statements about two right triangles drawn on one line.",
  senses: {
    side: "side",
    similar: "similar-figures",
    square: "square-shape",
    vertex: "vertex",
    degree: "degree-angle",
    unit: "unit",
    scale: "scale-factor",
  },
  noLink: ["whole", "change", "changes", "part", "parts", "third", "mean"],
  intuition:
    "A point such as $A(0, 1)$ gives how far across first and how far up second. A right triangle is a triangle with a square corner, called a right angle. A right angle measures 90 degrees, where a degree is $\\tfrac{1}{360}$ of a full turn. Its legs are the two sides at the right angle, and the slanted side is its hypotenuse. Two letters name a side: $BC$ is the side from $B$ to $C$. Slope is the rise divided by the run: the change up (negative if down) divided by the change to the right. Corresponding parts are parts in matching places. Similar triangles have the same shape. Congruent triangles have the same shape and the same size.",
  terms: [
    "right-triangle",
    [
      "slope",
      "The run is the change in $x$ and the rise is the change in $y$ from one point to another.",
    ],
    "slope",
    ["corresponding", "In right triangles, pair the right angles first."],
    "similar-figures",
    "congruent",
  ],
  method: [
    "For each triangle, read the run, how far right, and the rise, how far up or (negative) down. Slope is rise ÷ run.",
    "Pair the corners, also called vertices: the right-angle corners match, and the other two match by their places on the line. Check each angle statement with those pairs.",
    "Divide each side length in one triangle by its match in the other. The result of dividing two lengths is called their ratio. If every ratio is the same number, the triangles are similar. If that number is 1, they are also congruent. Judge each statement on its own, then choose the three true ones.",
  ],
  watch:
    "Do not make a downward rise positive in the slope. Use positive side lengths for size, and require equal matching lengths before calling triangles congruent.",
};

export const slopeTriangleStatementsPrinciple =
  "Take two right triangles made by moving right, then up or down, between pairs of points on one line that is neither horizontal nor vertical. Call their runs $r_1$ and $r_2$ and their rises $h_1$ and $h_2$; the small numbers name the triangle. Each triangle has a right angle, and the angles where the line meets the horizontal legs are equal. Two pairs of equal angles make the triangles similar. The scale factor is the number each side is multiplied by; here it is $k = \\tfrac{r_2}{r_1}$. The rises satisfy $h_2 = k \\times h_1$. So $\\tfrac{h_2}{r_2} = \\tfrac{h_1}{r_1}$: the slopes are equal. The triangles are congruent exactly when $k = 1$. A negative rise gives a negative slope but a positive side length. A vertical line has run 0, so its slope is undefined.";
