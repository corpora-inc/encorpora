import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

export const repeatingPatternMethods: Record<string, ProblemMethod> = {
  "repeating-shape-pattern": {
    goal: "Find the shapes that continue or complete a pattern that repeats the same short part.",
    intuition:
      "Some patterns are made of a short part that is repeated again and again, like circle, square, square, circle, square, square. To continue the pattern or fill a gap, find the repeating part and see where in it you are.",
    terms: [
      ["pattern", "Shapes or numbers that follow a rule."],
      [
        "repeating part",
        "The shortest group of shapes that is repeated over and over.",
      ],
    ],
    method: [
      "Find the repeating part: the shortest group that starts the pattern and appears again in the same order.",
      "Count the shapes that come before the empty boxes. Divide by the length of the repeating part and look at the remainder.",
      "The remainder tells how far into the repeating part the first empty box falls. Read the next shapes of the repeating part from there.",
    ],
    watch:
      "Keep the order of the repeating part. Check your answer by writing out the whole pattern with the shapes filled in.",
  },
};

export const repeatingPatternPrinciples: Record<string, string> = {
  "repeating-shape-pattern":
    "A repeating pattern with a repeating part of length $k$ has the same shape in positions $n$ and $n+k$. The shape in position $n$ (counting from 1) is shape number $((n-1)\\bmod k)+1$ of the repeating part, so any missing position follows from where it falls in the repeat.",
};

export const repeatingPatternLessons = [
  chainLesson({
    id: "repeating-shape-pattern-lesson",
    title: "Repeating patterns of shapes",
    summary:
      "Find the repeating part of a pattern of shapes and use it to fill the empty boxes.",
    templateIds: ["repeating-shape-pattern"],
    objectives: [
      "Find the repeating part of a pattern of shapes.",
      "Use the repeating part to name shapes that come next or are missing.",
    ],
    openingTitle: "Find the part that repeats",
    opening: [
      "A repeating pattern uses the same short group of shapes over and over. If you can find that group, you know every shape in the pattern, even the ones that are hidden.",
      "Read the pattern from the left and look for the point where it starts again. The group before that point is the repeating part.",
    ],
    example: {
      prompt:
        "The pattern is circle, square, square, circle, square, square, circle, ?, ?. Which two shapes go in the boxes?",
      steps: [
        "The repeating part is circle, square, square: 3 shapes.",
        "Seven shapes come before the first empty box. Two full repeats use 6 shapes, so 1 more shape is the circle that begins a third repeat.",
        "The first empty box is the 2nd shape of the repeat, a square, and the second box is the 3rd shape, a square.",
      ],
      answer: "square, square",
    },
    methodTitle: "Repeat, count, read on",
    method: [
      "Name the repeating part and its length.",
      "Divide the number of shapes before the box by that length. The remainder says how far into the repeating part you are.",
    ],
    formalTitle: "Position in a repeat",
    formal: [
      "If the repeating part has $k$ shapes, positions $n$ and $n+k$ hold the same shape.",
      "A position falls at shape number $((n-1)\\bmod k)+1$ of the repeating part, where $n$ counts from 1.",
    ],
    pitfalls: [
      "Starting the repeating part again in the middle of a repeat.",
      "Reversing the order of the two shapes.",
      "Taking a repeating part that is itself made of a shorter repeat. Use the shortest part.",
    ],
    parentGuide:
      "Ask your learner to read the pattern aloud, then say where the repeat starts again.",
  }),
];

export const repeatingPatternFacetMappings: FacetMapping[] = [
  {
    templateId: "repeating-shape-pattern",
    facetId: "arithmetic-patterns.core",
    extent: "partial",
    rationale:
      "Single choice of the two shapes that continue or fill a gap in a repeating pattern of circles, squares and triangles with a repeating part of 2 to 4 shapes. Does not assess number patterns with a rule, growing patterns, describing the rule in words, or creating a pattern.",
  },
];
