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
    "Trace two stretches of one straight line. For each stretch, move across and then up or down to make a triangle. The larger triangle may be twice as wide and twice as tall, yet the line has the same steepness.",
  templateIds: [templateId],
  includeGeneratedRepresentation: false,
  objectives: [
    "Read the signed rise and positive run of two right triangles on one line.",
    "Match corresponding vertices and decide whether the triangles are similar or congruent.",
    "Distinguish equal slope and equal angles from equal side lengths, for rising and falling lines.",
  ],
  sections: [
    {
      stage: "intuition",
      title: "Walk across, then up or down",
      paragraphs: [
        "A triangle joins three points with straight sides. To make one along a line, move horizontally, then vertically to another point on the line. These moves meet in a square corner, or right angle. They are the legs of a right triangle; the side along the line is its hypotenuse.",
        "On a coordinate grid, $A(0,1)$ names a point: the first number gives its horizontal position and the second its vertical position. A named corner's angle can be written $\\angle B$ for the angle at $B$; $90^\\circ$ means 90 degrees, the measure of a right angle.",
        "The horizontal change is the run, and the signed vertical change is the rise. Slope is rise divided by run: it tells how steeply the line goes up or down as you move to the right. If the line falls, the rise and slope are negative. Side lengths, however, are positive distances.",
      ],
      illustration: "slope-triangle-statements-example",
    },
    {
      stage: "method",
      title: "Match the corners and compare the changes",
      paragraphs: [
        "Equal grid units show horizontal legs $AB=2$ and $DE=4$, and vertical legs $BC=3$ and $EF=6$. $B$ and $E$ are the right-angle corners. Numbers beside legs show changes, not coordinates.",
        "Pair the right-angle corners, then the other corners by their roles along the line; those pairs correspond. Compare signed rise divided by positive run. If every matching side length has one positive scale factor, the triangles are similar (same shape). Factor 1 also makes them congruent (same size). Congruent triangles are similar.",
        "On a falling line, keep the sign of the vertical change when finding slope. For example, a run of 2 with a drop of 3 has slope $-3/2$; a run of 4 with a drop of 6 has slope $-6/4=-3/2$. The vertical side lengths are 3 and 6, not negative lengths. A vertical line has zero run, so rise divided by run is undefined and this slope method does not apply.",
      ],
    },
  ],
  closingSections: [
    {
      stage: "formal",
      title: "Equal ratios, corresponding parts",
      paragraphs: [
        "For line points $P(x_1,y_1)$ and $Q(x_2,y_2)$ with $Q$ to the right, run is $r=x_2-x_1>0$, signed rise is $h=y_2-y_1$, and slope is $m=h/r$. The leg lengths are $r$ and $|h|$.",
        "Take two nonflat stretches of one nonvertical line, read left to right, with runs $r_1,r_2>0$ and nonzero rises $h_1,h_2$. Both triangles have a right angle. Their horizontal legs are parallel, and their hypotenuses lie on one line, so the acute angles between those sides also match. Two matching angle pairs establish similarity and proportional corresponding sides.",
        "Let $k=r_2/r_1>0$. Similarity makes the second vertical leg $k$ times the first. Both rightward stretches rise or fall together, so $h_2=kh_1$, not merely $|h_2|=k|h_1|$. Thus $h_2/r_2=h_1/r_1$: signed slopes agree. The triangles are congruent exactly when $k=1$; congruent triangles are also similar.",
        "On a falling line, $h_1,h_2<0$, though leg lengths stay positive. A horizontal line has slope 0 and degenerate slope triangles. A vertical line has run 0, so its slope is undefined.",
      ],
    },
  ],
  workedExample: {
    prompt:
      "On one coordinate grid, $A(0,1)$, $B(2,1)$, $C(2,4)$ make one right triangle; $D(4,7)$, $E(8,7)$, $F(8,13)$ make another. The slanted sides lie on the same straight line. Which corners match, do the triangles have equal slope, and are they similar or congruent?",
    steps: [
      "From $A$ to $C$, move 2 units right along $AB$ and 3 units up along $BC$. The horizontal and vertical legs meet at $B$, so $\\angle B=90^\\circ$. The slope of $AC$ is $3/2$.",
      "From $D$ to $F$, move 4 units right along $DE$ and 6 units up along $EF$. The right angle is at $E$, and the slope of $DF$ is $6/4=3/2$.",
      "Corresponding means paired by the same role in the shapes: $A$ matches $D$ at the left end of the slanted side; $B$ matches $E$ at the right-angle corner; $C$ matches $F$ at the upper end. The angles at $A$ and $D$ match because the slanted sides share one line and $AB$ and $DE$ are horizontal. Both right angles match, so the remaining angles at $C$ and $F$ match too; a triangle's angles total $180^\\circ$.",
      "The matching horizontal sides are 2 and 4 units; the matching vertical sides are 3 and 6 units. Each large leg is twice its small match, so the triangles are similar: same angles and side lengths in one ratio. They are not congruent, because congruent triangles must also have equal matching lengths, but $AB=2$ and $DE=4$.",
    ],
    answer: "equal slope 3/2; similar at scale 2, not congruent",
  },
  pitfalls: [
    "Match the right-angle vertices before comparing named angles: here $B$ matches $E$, not $D$ or $F$.",
    "Equal slope and equal angles establish the same shape; check matching side lengths before claiming congruence. A translated pair can be both congruent and similar.",
    "Keep a downward rise negative when calculating slope, but use a positive distance for each triangle side.",
  ],
  parentGuide:
    "On square grid paper, mark the two horizontal and vertical changes. Ask which corner is square, which rise/run quotient belongs to each stretch, and whether the second triangle could be slid onto the first without resizing.",
};

export const slopeTriangleStatementsMethod: ProblemMethod = {
  goal: "Choose the three true statements about two right triangles on one line.",
  intuition:
    "A point such as $A(0,1)$ gives horizontal position first and vertical position second. A horizontal move and a vertical move make a right triangle with one square corner beside a line; those sides are legs, and the slanted side is its hypotenuse. Slope is signed vertical change divided by rightward horizontal change. A length ratio such as $BC/AB$ divides the length of $BC$ by the length of $AB$. Matching parts are corresponding; triangles with the same shape are similar, and triangles that also match in size are congruent.",
  terms: [
    ["right triangle", "A three-sided shape with one square, 90-degree angle."],
    [
      "run and rise",
      "Horizontal change and signed vertical change between two line points.",
    ],
    ["slope", "Signed rise divided by nonzero run."],
    [
      "corresponding vertices",
      "Corners paired by the same role in two triangles; pair the right angles first.",
    ],
    [
      "similar and congruent",
      "Similar triangles have matching angles and one side-length scale factor; congruent triangles also have equal matching side lengths.",
    ],
  ],
  method: [
    "Read each triangle from its left line point to its right line point. Find the positive run and signed rise, then divide rise by run for slope.",
    "Pair corresponding vertices by role: the right-angle corners match, and the other two match along the line. Compare their angle statements with those pairs.",
    "Compare matching horizontal and vertical leg lengths. One common scale factor gives similar triangles; factor 1 also gives congruent triangles. Evaluate each statement separately, then choose all three true ones.",
  ],
  watch:
    "Do not turn a downward rise positive in the slope. Use positive side lengths for size, and require equal matching lengths before calling triangles congruent.",
};

export const slopeTriangleStatementsPrinciple =
  "For two nondegenerate right triangles formed by left-to-right point pairs on one nonvertical line, let their positive runs be $r_1,r_2$ and nonzero signed rises be $h_1,h_2$. Each has a right angle, and the acute angles made by their horizontal legs and shared line agree. Thus the triangles are similar by two matching angle pairs. With scale $k=r_2/r_1>0$, corresponding leg lengths satisfy $|h_2|=k|h_1|$; the rises have the same sign on the shared line, so $h_2=kh_1$. Hence their slopes agree: $h_2/r_2=h_1/r_1$. They are congruent exactly when $k=1$; congruent triangles are also similar. A negative rise gives negative slope but positive side length. A horizontal line has slope 0 but degenerate slope triangles; a vertical line has zero run and undefined slope.";
