import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

export const similarityTrigLessons: Lesson[] = [
  {
    id: "dilations-and-similar-triangles",
    title: "Dilations and similar triangles",
    summary:
      "A dilation multiplies every length by its scale factor and keeps every angle. Triangles with two pairs of equal angles are similar, and their matching sides share one ratio.",
    templateIds: ["dilation-measure", "similar-triangle-side"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Use a dilation's center and scale factor to find image lengths and image points, and name what a dilation keeps.",
      "Find a missing side of similar triangles from matching sides, including a segment parallel to a side, and scale perimeters and areas.",
    ],
    sections: [
      {
        title: "A dilation scales every length",
        paragraphs: [
          "A dilation with center O and scale factor k moves each point P along the ray from O through P, to the point k times as far from O. With k > 1 the figure grows; with 0 < k < 1 it shrinks.",
          "Every length is multiplied by k, wherever the center is. Angles keep their measure. A line that misses the center maps to a parallel line, so slopes are kept too. With a center C other than the origin, scale the step from C to P, then add it back to C: P′ = C + k(P − C).",
        ],
        illustration: "similarity-dilation",
      },
      {
        title: "Similar triangles share one ratio",
        paragraphs: [
          "Two triangles are similar when one is a dilation of the other, perhaps moved, turned or flipped. For triangles, two pairs of equal angles are enough: the third pair must match as well, because the angles of a triangle add to 180°.",
          "The order of the names fixes the matching: in triangle ABC ~ triangle DEF, AB matches DE, BC matches EF and CA matches FD. Here DE ÷ AB = 9 ÷ 6 = 3/2, and every other pair has the same ratio, 3/2.",
        ],
        illustration: "similarity-pair",
      },
      {
        title: "Parallel lines, shadows, perimeter and area",
        paragraphs: [
          "A segment DE parallel to side BC, with D on AB and E on AC, cuts off a small triangle ADE similar to ABC: the angles at D and B are equal, and so are those at E and C. Its side AD matches all of AB, not DB.",
          "Shadows cast at the same moment make similar right triangles: height matches height and shadow matches shadow. When lengths scale by k, a perimeter scales by k and an area scales by k × k.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "In triangle ABC, D is on AB and E is on AC, with DE parallel to BC. AD = 4 and DB = 2. DE = 6. What is BC?",
      steps: [
        "DE ∥ BC, so triangle ADE ~ triangle ABC.",
        "AD matches AB = 4 + 2 = 6, so ABC is 6 ÷ 4 = 3/2 times as large as ADE.",
        "BC = 6 × 3/2 = 9.",
      ],
      answer: "9",
    },
    pitfalls: [
      "Match sides by the order of the vertex names, not by where they appear on the page.",
      "In a triangle cut by a parallel segment, the small side AD matches the whole side AB, not the piece DB.",
      "Area scales by the square of the scale factor, not by the factor itself.",
    ],
    parentGuide:
      "Hold a coin between a lamp and a wall and move it closer to the lamp: the shadow grows, but stays a circle. Measure the coin and its shadow, and check that the shadow is the same number of times wider as it is taller.",
  },
  {
    id: "right-triangle-trigonometry",
    title: "Right-triangle trigonometry",
    summary:
      "In right triangles with the same acute angle, each side ratio is the same: sin, cos and tan name those ratios. Special triangles give exact values, and complementary angles swap sine and cosine.",
    templateIds: ["special-right-triangle", "trig-ratio", "complementary-trig"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Write sin, cos and tan of an acute angle as exact ratios of sides, and find a side from a ratio.",
      "Use the side ratios of 45°-45°-90° and 30°-60°-90° triangles, and sin A = cos(90° − A).",
    ],
    sections: [
      {
        title: "The angle fixes the ratio",
        paragraphs: [
          "Right triangles with the same acute angle A are similar: each is a dilation of the others. So the ratio opposite ÷ hypotenuse is the same in all of them: 3/5, 6/10 and 9/15 are one number.",
          "That shared ratio depends only on the angle, so it can be named after the angle. It is the sine of A.",
        ],
        illustration: "trig-similar-scaling",
      },
      {
        title: "Sine, cosine and tangent",
        paragraphs: [
          "Stand at the acute angle A. The hypotenuse is across from the right angle. The opposite side is across from A, and the adjacent side is the leg that touches A.",
          "$\\sin A = \\frac{\\text{opposite}}{\\text{hypotenuse}}$, $\\cos A = \\frac{\\text{adjacent}}{\\text{hypotenuse}}$ and $\\tan A = \\frac{\\text{opposite}}{\\text{adjacent}}$. When only two sides are known, the Pythagorean theorem gives the third first.",
        ],
        illustration: "trig-sides-named",
      },
      {
        title: "As the angle grows",
        paragraphs: [
          "Keep the hypotenuse 1 and open the angle. The opposite side, which equals sin A here, grows from near 0 toward 1, and the adjacent side shrinks.",
          "So sine and cosine lie between 0 and 1 for acute angles, and a larger acute angle has a larger sine and a smaller cosine.",
        ],
        illustration: "trig-angle-sweep",
      },
      {
        title: "Special right triangles and complementary angles",
        paragraphs: [
          "A square's diagonal makes a 45°-45°-90° triangle with sides s, s and s√2. Half of an equilateral triangle makes a 30°-60°-90° triangle with sides s (opposite 30°), s√3 (opposite 60°) and 2s.",
          "The two acute angles of a right triangle add to 90°, and the side opposite one is adjacent to the other. So $\\sin A = \\cos(90^\\circ - A)$: for example, $\\sin 30^\\circ = \\cos 60^\\circ = \\frac{1}{2}$.",
        ],
        illustration: "trig-special-triangles",
      },
    ],
    workedExample: {
      prompt:
        "In a 30°-60°-90° triangle, the hypotenuse has length 14. The longer leg is c√3. What is c?",
      steps: [
        "The shorter leg, opposite 30°, is half the hypotenuse: 14 ÷ 2 = 7.",
        "The longer leg is the shorter leg times √3: 7√3.",
        "So c = 7.",
      ],
      answer: "7",
    },
    pitfalls: [
      "Name opposite and adjacent from the angle asked about; they swap for the other acute angle.",
      "The hypotenuse is always across from the right angle and is the longest side.",
      "In a 30°-60°-90° triangle the shorter leg is opposite 30°, and the hypotenuse is twice it.",
    ],
    parentGuide:
      "Lean a ruler against a wall at different angles. Measure the height it reaches and divide by its length, then compare with a calculator's sine of the angle you measure with a protractor.",
  },
];

const terms = {
  dilation: [
    ["scale factor", "The number every length is multiplied by."],
    ["center", "The fixed point the dilation stretches away from."],
  ],
  similar: [
    ["similar", "Same angles, with all sides in one ratio."],
    ["matching sides", "Sides joining matching vertices, in name order."],
  ],
  special: [
    ["45°-45°-90°", "Sides s, s and s√2."],
    ["30°-60°-90°", "Sides s, s√3 and 2s."],
  ],
  trig: [
    ["opposite", "The leg across from the angle."],
    ["adjacent", "The leg that touches the angle."],
  ],
  complement: [
    ["complementary", "Two angles that add to 90°."],
    ["cofunction", "sin A = cos(90° − A)."],
  ],
} satisfies Record<string, [string, string][]>;
export const similarityTrigMethods: Record<string, ProblemMethod> = {
  "dilation-measure": {
    goal: "Use a dilation's scale factor and center to find lengths, the factor, image points or what is kept.",
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
    terms: terms.special,
    method: [
      "Name the given side: a leg, the hypotenuse, the shorter leg or the longer leg.",
      "Find s from it: divide by √2, √3 or 2 as the pattern says.",
      "Build the asked side from s, and rationalize if it has √ in a denominator.",
    ],
    watch:
      "In a 30°-60°-90° triangle the shorter leg is opposite 30°, not 60°.",
  },
  "trig-ratio": {
    goal: "Write sin, cos or tan of an angle as an exact ratio, or find a side from one.",
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
    goal: "Use sin A = cos(90° − A) to find an angle, a variable or a ratio.",
    terms: terms.complement,
    method: [
      "Recognize a sine and a cosine of two angles that must be complementary.",
      "Set the two angles' sum to 90 and solve, or read the other ratio directly.",
    ],
    watch:
      "sin A = cos A only when A = 45°; the cosine that matches sin A belongs to the other angle.",
  },
};
export const similarityTrigPrinciples: Record<string, string> = {
  "dilation-measure":
    "A dilation with scale factor k multiplies every distance by k and keeps every angle; a line that misses the center maps to a parallel line.",
  "similar-triangle-side":
    "Matching sides of similar triangles share one ratio, the scale factor; perimeters scale by it and areas by its square.",
  "special-right-triangle":
    "A 45°-45°-90° triangle has sides s, s, s√2; a 30°-60°-90° triangle has sides s, s√3, 2s, with s opposite 30°.",
  "trig-ratio":
    "In a right triangle, sin = opposite ÷ hypotenuse, cos = adjacent ÷ hypotenuse and tan = opposite ÷ adjacent, all read from the chosen acute angle.",
  "complementary-trig":
    "The acute angles of a right triangle are complementary, and the side opposite one is adjacent to the other, so sin A = cos(90° − A).",
};
