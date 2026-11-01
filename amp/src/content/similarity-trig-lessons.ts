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
  tangent: "tangent-trig",
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

export const similarityTrigLessons: Lesson[] = [
  {
    id: "dilations-and-similar-triangles",
    title: "Dilations and similar triangles",
    summary:
      "A dilation resizes a figure from a fixed point, called the center: every length is multiplied by the same positive number, the scale factor, and every angle stays the same. Two triangles are called similar when one is a resized copy of the other, maybe moved or flipped. Two pairs of equal angles are enough to show it. Then every side divided by its matching side gives the same number.",
    templateIds: ["dilation-measure", "similar-triangle-side"],
    senses: GEO_SENSES,
    noLink: GEO_NOLINK,
    includeGeneratedRepresentation: false,
    objectives: [
      "Use a dilation's center and scale factor to find image lengths and image points, and name what a dilation keeps.",
      "Find a missing side of similar triangles from matching sides, including a segment parallel to a side, and scale perimeters and areas.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "A dilation scales every length",
        paragraphs: [
          "A dilation with center $O$ and scale factor $k$ moves each point $P$ along the ray from $O$ through $P$, to the point $k$ times as far from $O$. When $k>1$ the figure grows, and when $0<k<1$ it shrinks.",
          "Every length is multiplied by $k$, wherever the center is. Angles keep their measure. A line that misses the center maps to a parallel line, so slopes are kept too. With a center $C$ other than the origin, scale the step from $C$ to $P$, then add it back to $C$: $P'$ = $C$ + $k(P - C)$.",
        ],
        illustration: "similarity-dilation",
      },
      {
        title: "Similar triangles share one ratio",
        paragraphs: [
          "Two triangles are similar when one is a dilation of the other, perhaps moved, turned or flipped. For triangles, two pairs of equal angles are enough: the third pair must match as well, because the angles of a triangle add to 180°.",
          "The order of the names fixes the matching: in triangle $ABC$ ~ triangle $DEF$, $AB$ matches $DE$, $BC$ matches $EF$ and $CA$ matches $FD$. Here $DE ÷ AB = 9 ÷ 6 = 3/2$, and every other pair has the same ratio, 3/2.",
        ],
        illustration: "similarity-pair",
      },
      {
        title: "Parallel lines, shadows, perimeter and area",
        paragraphs: [
          "A segment $DE$ parallel to side $BC$, with $D$ on $AB$ and $E$ on $AC$, cuts off a small triangle $ADE$ similar to $ABC$: the angles at $D$ and $B$ are equal, and so are those at $E$ and $C$. Its side $AD$ matches all of $AB$, not $DB$.",
          "A right triangle has one square corner. Upright objects on flat ground, lit by the sun at the same moment, cast shadows that make similar right triangles. Height matches height, and shadow matches shadow. When lengths scale by $k$, a perimeter scales by $k$ and an area scales by $k\\times k$.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "In triangle $ABC$, $D$ is on $AB$ and $E$ is on $AC$, with $DE$ parallel to $BC$. $AD = 4$ and $DB = 2$. $DE = 6$. What is $BC$?",
      steps: [
        "$DE$ ∥ $BC$, so triangle $ADE$ ~ triangle $ABC$.",
        "$AD$ matches $AB = 4 + 2 = 6$, so $ABC$ is 6 ÷ 4 = 3/2 times as large as $ADE$.",
        "$BC = 6 × 3/2 = 9$.",
      ],
      answer: "9",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "For $k>0$, a dilation multiplies every distance by $k$ and keeps every angle; a line that misses the center maps to a parallel line.",
          "Matching sides of similar triangles share one ratio, the scale factor; perimeters scale by it and areas by its square.",
        ],
      },
    ],
    pitfalls: [
      "Match sides by the order of the vertex names, not by where they appear on the page.",
      "In a triangle cut by a parallel segment, the small side $AD$ matches the whole side $AB$, not the piece $DB$.",
      "Area scales by the square of the scale factor, not by the factor itself.",
    ],
    parentGuide:
      "On a sunny day, measure the height and shadow of a person and of a pole at the same moment. Check that height divided by shadow length is about the same for both.",
  },
  {
    id: "right-triangle-trigonometry",
    title: "Right-triangle trigonometry",
    summary:
      "A right triangle has one square corner. All right triangles with the same other angle have the same shape, so the ratios of their sides match. These ratios depend only on the angle. With them you can find a missing side from one side and an angle, without drawing to scale.",
    templateIds: ["special-right-triangle", "trig-ratio", "complementary-trig"],
    senses: GEO_SENSES,
    noLink: GEO_NOLINK,
    includeGeneratedRepresentation: false,
    objectives: [
      "Write sin, cos and tan of an acute angle as exact ratios of sides, and find a side from a ratio.",
      "Use the side ratios of 45°-45°-90° and 30°-60°-90° triangles, and $\\sin A = \\cos(90° - A)$.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "The angle fixes the ratio",
        paragraphs: [
          "A right triangle has one square corner and two smaller, acute angles. Right triangles with the same acute angle $A$ are similar: a dilation together with a rigid motion can map one onto the other. The ratio of the side opposite $A$ to the hypotenuse (the side opposite the square corner) is the same in all of them: $3/5$, $6/10$, and $9/15$ are one number.",
          "That shared ratio depends only on the angle, so it can be named after the angle. It is the sine of $A$.",
        ],
        illustration: "trig-similar-scaling",
      },
      {
        title: "Sine, cosine and tangent",
        paragraphs: [
          "Stand at the acute angle $A$. The hypotenuse is across from the right angle. The opposite side is across from $A$, and the adjacent side is the leg that touches $A$.",
          "$\\sin A = \\frac{\\text{opposite}}{\\text{hypotenuse}}$, $\\cos A = \\frac{\\text{adjacent}}{\\text{hypotenuse}}$ and $\\tan A = \\frac{\\text{opposite}}{\\text{adjacent}}$. When only two sides are known, the Pythagorean theorem gives the third first.",
        ],
        illustration: "trig-sides-named",
      },
      {
        title: "As the angle grows",
        paragraphs: [
          "Keep the hypotenuse 1 and open the angle. The opposite side, which equals sin $A$ here, grows from near 0 toward 1, and the adjacent side shrinks.",
          "So sine and cosine lie between 0 and 1 for acute angles, and a larger acute angle has a larger sine and a smaller cosine.",
        ],
        illustration: "trig-angle-sweep",
      },
      {
        title: "Special right triangles and complementary angles",
        paragraphs: [
          "A square's diagonal makes a 45°-45°-90° triangle with sides $s$, $s$ and $s\\sqrt 2$. Half of an equilateral triangle makes a 30°-60°-90° triangle with sides $s$ (opposite 30°), $s\\sqrt 3$ (opposite 60°) and 2s.",
          "The two acute angles of a right triangle add to 90°, and the side opposite one is adjacent to the other. So $\\sin A = \\cos(90^\\circ - A)$: for example, $\\sin 30^\\circ = \\cos 60^\\circ = \\frac{1}{2}$.",
        ],
        illustration: "trig-special-triangles",
      },
    ],
    workedExample: {
      prompt:
        "In a 30°-60°-90° triangle, the hypotenuse has length 14. The longer leg is c√3. What is $c$?",
      steps: [
        "The shorter leg, opposite 30°, is half the hypotenuse: 14 ÷ 2 = 7.",
        "The longer leg is the shorter leg times √3: 7√3.",
        "So c = 7.",
      ],
      answer: "7",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "For $s>0$, a 45°-45°-90° triangle has sides $s$, $s$, $s\\sqrt2$; a 30°-60°-90° triangle has sides $s$, $s\\sqrt3$, $2s$, with $s$ opposite 30°.",
          "For a chosen acute angle $A$ in a right triangle, $\\sin A$ is opposite ÷ hypotenuse, $\\cos A$ is adjacent ÷ hypotenuse, and $\\tan A$ is opposite ÷ adjacent.",
          "The acute angles of a right triangle are complementary, and the side opposite one is adjacent to the other, so $\\sin A = \\cos(90° - A)$.",
        ],
      },
    ],
    pitfalls: [
      "Name opposite and adjacent from the angle asked about; they swap for the other acute angle.",
      "The hypotenuse is always across from the right angle and is the longest side.",
      "In a 30°-60°-90° triangle the shorter leg is opposite 30°, and the hypotenuse is twice it.",
    ],
    parentGuide:
      "Lean a ruler against a wall. Measure the height it reaches and divide by the ruler's length. Then measure the angle between the ruler and the floor with a protractor, and compare with a calculator's sine of that angle.",
  },
];

const terms = {
  dilation: ["scale-factor", "center-of-dilation"],
  similar: ["similar-figures", "corresponding"],
  special: ["45-45-90-triangle", "30-60-90-triangle"],
  trig: ["opposite-side-angle", "adjacent-leg"],
  complement: ["complementary-angles", "cofunction-identity"],
} satisfies Record<string, MethodTerm[]>;
export const similarityTrigMethods: Record<string, ProblemMethod> = {
  "dilation-measure": {
    goal: "Use a dilation's scale factor and center to find lengths, the factor, image points or what is kept.",
    senses: GEO_SENSES,
    noLink: GEO_NOLINK,
    intuition:
      "A dilation resizes a figure from a fixed point, called the center. Each point moves along the ray (a half-line) from the center through it, to $k$ times as far away. The number $k$, which is positive, is the scale factor. So every length is multiplied by $k$, and every angle stays the same. A scale factor above 1 enlarges, and one between 0 and 1 shrinks. To dilate point $P$ about center $C$, multiply the step from $C$ to $P$ by $k$, then add it back to $C$.",
    terms: terms.dilation,
    method: [
      "Lengths: multiply by the scale factor; the factor is image length ÷ original length.",
      "A point: scale the step from the center to the point, then add it back to the center.",
      "Angles and slopes do not change.",
    ],
    watch:
      "Measure from the center, not from the origin, when the center is elsewhere.",
  },
  "similar-triangle-side": {
    goal: "Find a missing length from similar triangles.",
    senses: GEO_SENSES,
    noLink: GEO_NOLINK,
    intuition:
      "Two triangles are called similar when they have the same shape: one is a resized copy of the other. Every side of one is the same number, the scale factor, times its matching side in the other. Two pairs of equal angles are enough to make triangles similar, because the third angles then match too. A perimeter, the distance around, grows by the scale factor. An area grows by the scale factor times itself.",
    terms: terms.similar,
    method: [
      "Match the sides by the order of the names, or by the equal angles.",
      "Divide a pair of known matching sides for the scale factor.",
      "Multiply the matching side by the factor; square it for area.",
    ],
    watch:
      "With a parallel segment inside a triangle, the small side matches the whole side, not the remaining piece.",
  },
  "special-right-triangle": {
    goal: "Find a side of a 45°-45°-90° or 30°-60°-90° triangle from another side.",
    senses: GEO_SENSES,
    noLink: GEO_NOLINK,
    intuition:
      "A right triangle has one square corner. Its longest side, across from that corner, is the hypotenuse, and the other two sides are the legs. A triangle with angles of $45^\\circ$, $45^\\circ$ and $90^\\circ$ has legs $s$ and $s$ and hypotenuse $s\\sqrt2$, where $\\sqrt2$ is the positive number that times itself makes 2. A triangle with angles $30^\\circ$, $60^\\circ$ and $90^\\circ$ has a shorter leg $s$, across from $30^\\circ$. Its longer leg is $s\\sqrt3$, and its hypotenuse is $2s$.",
    terms: terms.special,
    method: [
      "Name the given side: a leg, the hypotenuse, the shorter leg or the longer leg.",
      "Find $s$ from it: divide by √2, √3 or 2 as the pattern says.",
      "Build the asked side from $s$, and rationalize if it has a square root in a denominator.",
    ],
    watch:
      "In a 30°-60°-90° triangle the shorter leg is opposite 30°, not 60°.",
  },
  "trig-ratio": {
    goal: "Write sin, cos or tan of an angle as an exact ratio, or find a side from one.",
    senses: GEO_SENSES,
    noLink: GEO_NOLINK,
    intuition:
      "In a right triangle, the longest side, across from the square corner, is the hypotenuse, and the other two sides are the legs. Pick one of the other angles, $A$. The leg across from $A$ is the opposite side, and the leg touching $A$ is the adjacent side. The sine is the opposite side divided by the hypotenuse, written $\\sin A$. The cosine is the adjacent side divided by the hypotenuse, written $\\cos A$. The tangent is the opposite side divided by the adjacent side, written $\\tan A$.",
    terms: terms.trig,
    method: [
      "Find any missing side with the Pythagorean theorem.",
      "From the angle asked about, name the opposite side, the adjacent side and the hypotenuse.",
      "Divide: sin = opposite ÷ hypotenuse, cos = adjacent ÷ hypotenuse, tan = opposite ÷ adjacent.",
    ],
    watch:
      "Opposite and adjacent swap when the angle changes; read them from the named angle.",
  },
  "complementary-trig": {
    goal: "Use $\\sin A = \\cos(90° - A)$ to find an angle, a variable or a ratio.",
    senses: GEO_SENSES,
    noLink: GEO_NOLINK,
    intuition:
      "In a right triangle, the two angles other than the square corner add to $90^\\circ$. Angles that add to $90^\\circ$ are called complementary. The longest side, across from the square corner, is called the hypotenuse, and the other two are called the legs. The leg across from one of these angles is the leg next to the other. So the sine of one angle (opposite over hypotenuse) equals the cosine of the other (adjacent over hypotenuse). That is why $\\sin A=\\cos(90^\\circ-A)$.",
    terms: terms.complement,
    method: [
      "Recognize a sine and a cosine of two angles that must be complementary.",
      "Set the two angles' sum to 90 and solve, or read the other ratio directly.",
    ],
    watch:
      "$\\sin A=\\cos A$ only when $A=45^\\circ$. The cosine that matches $\\sin A$ belongs to the other angle.",
  },
};
export const similarityTrigPrinciples: Record<string, string> = {
  "dilation-measure":
    "A dilation with scale factor $k$ multiplies every distance by $k$ and keeps every angle; a line that misses the center maps to a parallel line.",
  "similar-triangle-side":
    "Matching sides of similar triangles share one ratio, the scale factor; perimeters scale by it and areas by its square.",
  "special-right-triangle":
    "For $s>0$, a 45°-45°-90° triangle has sides $s$, $s$, $s\\sqrt2$; a 30°-60°-90° triangle has sides $s$, $s\\sqrt3$, $2s$, with $s$ opposite 30°.",
  "trig-ratio":
    "For a chosen acute angle $A$ in a right triangle, $\\sin A$ is opposite ÷ hypotenuse, $\\cos A$ is adjacent ÷ hypotenuse, and $\\tan A$ is opposite ÷ adjacent.",
  "complementary-trig":
    "The acute angles of a right triangle are complementary, and the side opposite one is adjacent to the other, so $\\sin A = \\cos(90° - A)$.",
};
