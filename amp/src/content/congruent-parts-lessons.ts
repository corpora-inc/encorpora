import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

const fourthSenses = {
  whole: "whole",
  part: "part",
  quarter: "fourth",
  third: "third",
  square: "square-shape",
};

export const congruentPartsMethods: Record<string, ProblemMethod> = {
  "congruent-fourths-pair": {
    goal: "Pick the figures of the same size and shape whose shaded part is one fourth of the whole, even when the parts are cut in different ways.",
    senses: fourthSenses,
    intuition:
      "One fourth means the whole is cut into 4 parts of the same size, and 1 part is shaded, or colored in. Two squares of the same size can be cut in different ways, such as into strips or into a 2 by 2 grid. Each part is still one fourth of its square. Area is how much flat space a shape covers. One fourth of a square covers the same area however the square is cut.",
    terms: ["fourth", "equal-parts"],
    method: [
      "Count the parts in each figure. Check that they are all the same size.",
      "Count the shaded parts. One fourth is 1 shaded part out of 4 equal parts.",
      "Choose the two figures that both show one fourth this way.",
    ],
    watch:
      "The whole must be cut into 4 parts of the same size. Parts with different shapes can still be the same size.",
  },
};

export const congruentPartsPrinciples: Record<string, string> = {
  "congruent-fourths-pair":
    "A unit fraction is a fraction with 1 on top, such as $\\frac{1}{4}$. $\\frac{1}{n}$ of a whole is one of $n$ parts with equal area. So $\\frac{1}{4}$ of a figure is the same area in any figure of the same size, however the parts are shaped. Shading 2 of 4 equal parts shows $\\frac{2}{4}$, and shading 1 of 3 equal parts shows $\\frac{1}{3}$.",
};

export const congruentPartsLessons = [
  {
    ...chainLesson({
      id: "congruent-fourths-lesson",
      title: "One fourth of figures of the same size",
      summary:
        "A fraction names equal parts of a whole. One fourth means the whole is cut into 4 parts of the same size, and 1 part is shaded, or colored in. Two figures of the same size can be cut in different ways. Their parts can have different shapes and still each be one fourth.",
      templateIds: ["congruent-fourths-pair"],
      objectives: [
        "Say what makes a shaded part one fourth of a whole.",
        "Compare figures of the same size that are cut into equal parts in different ways.",
      ],
      openingTitle: "Equal parts, not equal shapes",
      opening: [
        "Cut a square into 4 parts that are all the same size. Shade 1 of them. The shaded part is one fourth of the square.",
        "Take another square of the same size. Cut it into 4 equal strips, or into a 2 by 2 grid of small squares. The parts have different shapes, but each part covers the same amount of the square. Area is how much flat space a shape covers. All these fourths have the same area.",
        "A figure cut into 3 equal parts shows thirds, not fourths. A figure cut into 4 parts of different sizes does not show fourths, even though it has 4 parts.",
      ],
      example: {
        prompt:
          "Squares A, B and C are the same size. A is cut into 4 equal strips with 1 shaded. B is cut into a 2 by 2 grid of equal squares with 1 shaded. C is cut into 3 equal strips with 1 shaded. Which two show one fourth?",
        steps: [
          "A has 4 equal strips, and 1 is shaded. That is 1 of 4 equal parts: one fourth.",
          "B has 4 equal small squares, and 1 is shaded. That is one fourth too, even though its parts are squares, not strips.",
          "C has 3 equal strips, and 1 is shaded. That is 1 of 3 equal parts: one third. So the two that show one fourth are A and B.",
        ],
        answer: "A and B",
      },
      methodTitle: "Count parts, check sizes, count shaded",
      method: [
        "Count the parts of each figure, and check that they are all the same size.",
        "Count the shaded parts. One fourth is 1 shaded part out of 4 equal parts.",
      ],
      formalTitle: "Unit fractions of a whole",
      formal: [
        "A unit fraction is a fraction with 1 on top. The unit fraction $\\frac{1}{n}$ is the amount of one part when a whole is cut into $n$ equal parts.",
        "Figures of the same size have the same area. So $\\frac{1}{4}$ of one has the same area as $\\frac{1}{4}$ of the other, however the parts are shaped.",
      ],
      pitfalls: [
        "Counting the parts but not checking that they are the same size.",
        "Choosing a figure with 2 shaded parts out of 4. That shows two fourths, not one fourth.",
        "Rejecting a figure because its parts have a different shape from the others.",
      ],
      parentGuide:
        "Ask your child to trace two of the figures. Ask how many parts each has, and whether the parts are the same size.",
    }),
    senses: fourthSenses,
  },
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
