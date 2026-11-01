import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

export const fractionChoiceMethods: Record<string, ProblemMethod> = {
  "fraction-choice-compare": {
    goal: "Choose the fraction or mixed number that is greater or less than a stated number by comparing with a common denominator.",
    intuition:
      "A fraction names a part of a whole. To compare two fractions, cut both wholes into the same size of piece, so you can compare how many pieces each has. A whole number can be written as a fraction with any denominator: 2 is $\\frac{8}{4}$.",
    terms: ["common-denominator", "mixed-number"],
    method: [
      "Rewrite the stated number and the choice with a common denominator. For a whole number, write it as a fraction over the choice's denominator.",
      "Compare the numerators: the greater numerator is the greater fraction.",
      "Check every choice, because a larger numerator or a larger denominator does not decide the comparison alone. For mixed numbers with the same whole part, compare only the fractions.",
    ],
    watch:
      "Do not compare numerators or denominators alone. $\\frac{5}{12}$ has a greater numerator than $\\frac{3}{8}$ but you must still use a common denominator: they are $\\frac{10}{24}$ and $\\frac{9}{24}$.",
  },
};

export const fractionChoicePrinciples: Record<string, string> = {
  "fraction-choice-compare":
    "For positive fractions, $\\frac{a}{b}>\\frac{c}{d}$ exactly when $ad>bc$, because both are $\\frac{ad}{bd}$ and $\\frac{bc}{bd}$ over the same denominator. A whole number $w$ is $\\frac{wd}{d}$. Mixed numbers with the same whole part compare by their fraction parts.",
};

export const fractionChoiceLessons = [
  chainLesson({
    id: "fraction-choice-compare-lesson",
    title: "Choosing a fraction greater or less than another",
    summary:
      "Compare fractions, mixed numbers and whole numbers with a common denominator to choose the one that fits.",
    templateIds: ["fraction-choice-compare"],
    objectives: [
      "Write two fractions, or a whole number and a fraction, with a common denominator.",
      "Choose, from four numbers, the one that is greater or less than a stated number.",
    ],
    openingTitle: "Same size pieces make fractions comparable",
    opening: [
      "Is $\\frac{5}{8}$ greater than $\\frac{2}{3}$? The pieces are different sizes, so you cannot compare 5 pieces with 2 pieces. Cut both wholes into 24 equal pieces: $\\frac{5}{8}$ is $\\frac{15}{24}$ and $\\frac{2}{3}$ is $\\frac{16}{24}$. Now the pieces match, and 16 pieces is more than 15.",
      "A whole number fits the same way. The whole number 2 is $\\frac{16}{8}$ when the pieces are eighths, so $\\frac{17}{8}$ is greater than 2 and $\\frac{15}{8}$ is less than 2.",
    ],
    example: {
      prompt:
        "Which is greater than $\\frac{3}{4}$: $\\frac{5}{8}$ or $\\frac{7}{9}$?",
      steps: [
        "A common denominator of 4 and 8 is 8: $\\frac{3}{4}=\\frac{6}{8}$, and $\\frac{5}{8}$ is less than $\\frac{6}{8}$.",
        "For $\\frac{7}{9}$ use the denominator 36: $\\frac{3}{4}=\\frac{27}{36}$ and $\\frac{7}{9}=\\frac{28}{36}$.",
        "28 is more than 27, so $\\frac{7}{9}$ is greater than $\\frac{3}{4}$.",
      ],
      answer: "$\\frac{7}{9}$",
    },
    methodTitle: "Common denominator, then numerators",
    method: [
      "Multiply the two denominators to get a common denominator, and rewrite both fractions over it.",
      "Compare the numerators. For a whole number $w$ and a choice with denominator $d$, compare the numerator with $w\\times d$.",
    ],
    formalTitle: "Comparing fractions",
    formal: [
      "For positive $b$ and $d$, $\\frac{a}{b}>\\frac{c}{d}$ exactly when $ad>bc$.",
      "A mixed number $w\\frac{a}{b}$ with the same $w$ as another compares by its fraction part.",
    ],
    pitfalls: [
      "Choosing the greater numerator or the greater denominator without a common denominator.",
      "Comparing a whole number with the numerator of a fraction instead of writing it over the same denominator.",
      "Stopping after checking one choice. Check each choice against the stated number.",
    ],
    parentGuide:
      "Ask your learner to draw two equal bars cut into different numbers of pieces and shade each fraction, then rewrite both with the same size of piece.",
  }),
];

export const fractionChoiceFacetMappings: FacetMapping[] = [
  {
    templateId: "fraction-choice-compare",
    facetId: "fraction-comparison.core",
    extent: "partial",
    rationale:
      "Single choice among four fractions with denominators 3 to 12 for the one greater or less than a stated proper fraction or a whole number from 1 to 3, and the greatest of four mixed numbers with the same whole part and denominators 3, 4, 6 and 12. Does not assess fractions built from counts of objects, shaded models, ordering by drag, or reasons written in words.",
  },
];
