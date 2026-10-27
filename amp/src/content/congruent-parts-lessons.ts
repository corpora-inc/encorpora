import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

export const congruentPartsMethods: Record<string, ProblemMethod> = {
  "congruent-fourths-pair": {
    goal: "Pick the figures of the same size and shape whose shaded part is one fourth of the whole, even when the parts are cut in different ways.",
    intuition:
      "One fourth means the whole is cut into 4 parts of the same size and 1 part is shaded. Two same-size squares can be cut in different ways, for example into strips or into a grid, and each part is still one fourth of its square.",
    terms: [
      ["one fourth", "One of 4 equal parts of a whole."],
      [
        "equal parts",
        "Parts that cover the same amount of the whole, even if their shapes differ.",
      ],
    ],
    method: [
      "Count the parts in each figure and check whether they are all the same size.",
      "Count the shaded parts. One fourth is 1 shaded part of 4 equal parts.",
      "Keep the figures that match, and choose the pair that has them. A figure with 3 parts, 2 shaded parts or unequal parts does not match.",
    ],
    watch:
      "The parts of a fourth must be equal in size, not only equal in number. Parts of different shapes can still be equal in size.",
  },
};

export const congruentPartsPrinciples: Record<string, string> = {
  "congruent-fourths-pair":
    "A unit fraction $\\frac{1}{n}$ of a whole is one of $n$ parts of equal area, so $\\frac{1}{4}$ of a figure is the same amount of area in any figure of the same size, however the parts are shaped. Shading 2 of 4 equal parts is $\\frac{2}{4}$, and shading one of 3 equal parts is $\\frac{1}{3}$.",
};

export const congruentPartsLessons = [
  chainLesson({
    id: "congruent-fourths-lesson",
    title: "One fourth of figures of the same size",
    summary:
      "Recognize one fourth in same-size figures that are cut in different ways.",
    templateIds: ["congruent-fourths-pair"],
    objectives: [
      "Say what makes a shaded part one fourth of a whole.",
      "Compare figures of the same size that are cut into equal parts in different ways.",
    ],
    openingTitle: "Equal parts, not equal shapes",
    opening: [
      "Cut a square into 4 parts that are all the same size and shade 1 of them. The shaded part is one fourth of the square. The same-size square cut into 4 strips and the square cut into a 2 by 2 grid have parts of different shapes, but each part is the same amount of the square.",
      "A figure with 3 equal parts shows thirds. A figure with 4 parts of different sizes does not show fourths, even though it has 4 parts.",
    ],
    example: {
      prompt:
        "Squares A, B and C are the same size. A is cut into 4 strips with 1 shaded. B is cut into a 2 by 2 grid with 1 shaded. C is cut into 3 strips with 1 shaded. Which two show one fourth?",
      steps: [
        "A has 4 equal strips with 1 shaded: one fourth.",
        "B has 4 equal squares with 1 shaded: one fourth.",
        "C has 3 equal parts with 1 shaded: one third.",
      ],
      answer: "A and B",
    },
    methodTitle: "Count parts, check sizes, count shaded",
    method: [
      "Count the parts of each figure and check that they have the same size.",
      "Count the shaded parts. One fourth is 1 shaded of 4 equal parts.",
    ],
    formalTitle: "Unit fractions of a whole",
    formal: [
      "A unit fraction $\\frac{1}{n}$ is the amount of one part when a whole is cut into $n$ equal parts.",
      "Figures of the same size have the same area, so $\\frac{1}{4}$ of one is equal in area to $\\frac{1}{4}$ of the other, however the parts are shaped.",
    ],
    pitfalls: [
      "Counting only the parts and not checking that they are equal.",
      "Choosing a figure with 2 shaded parts of 4, which is two fourths.",
      "Rejecting a figure because its parts have a different shape from the others.",
    ],
    parentGuide:
      "Ask your learner to trace two of the figures and to say how many parts each has and whether they are the same size.",
  }),
];

export const congruentPartsFacetMappings: FacetMapping[] = [
  {
    templateId: "congruent-fourths-pair",
    facetId: "unit-fractions.core",
    extent: "partial",
    rationale:
      "Single choice of the pair among three same-size squares or rectangles cut into strips, grids or diagonals that show one fourth shaded, with a distractor showing thirds, two fourths or four unequal parts. Does not assess other unit fractions, figures that are not the same size, or naming the fraction shaded.",
  },
];
