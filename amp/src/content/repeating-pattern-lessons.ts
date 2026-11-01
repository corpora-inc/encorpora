import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

export const repeatingPatternMethods: Record<string, ProblemMethod> = {
  "repeating-shape-pattern": {
    goal: "Find the shapes that continue or complete a pattern that repeats the same short part.",
    intuition:
      "A pattern is something that happens again and again in the same way. Some patterns repeat a short group of shapes, like circle, square, square, circle, square, square. That short group is called the repeating part. Its length is how many shapes it has: here, 3. To fill an empty box, find the repeating part and see where in it the box falls.",
    senses: { square: "square-shape" },
    terms: [
      "pattern",
      [
        "pattern",
        "The repeating part is the shortest group of shapes that repeats over and over.",
      ],
    ],
    method: [
      "Find the repeating part: the shortest group that starts the pattern and comes again in the same order.",
      "Count the shapes before the first empty box in groups the length of the repeating part. The shapes left over tell how far into the repeating part you are.",
      "If 1 shape is left over, the box holds the 2nd shape of the repeating part. If none are left over, the box holds the 1st shape. Read on from there for the next boxes.",
    ],
    watch:
      "Keep the order of the repeating part. Check your answer by saying the whole pattern with the boxes filled in.",
  },
};

export const repeatingPatternPrinciples: Record<string, string> = {
  "repeating-shape-pattern":
    "With a repeating part of 3 shapes, positions 1, 4, 7 and 10 all hold the same shape. In general, if the repeating part has $k$ shapes, positions $n$ and $n+k$ hold the same shape. Take away whole repeats from the $n-1$ shapes before position $n$. If $r$ shapes are left over, position $n$ holds shape number $r+1$ of the repeating part.",
};

export const repeatingPatternLessons = [
  chainLesson({
    id: "repeating-shape-pattern-lesson",
    title: "Repeating patterns of shapes",
    summary:
      "Some patterns use the same short group of shapes over and over. That group is called the repeating part. Find it, and you can tell which shape goes in any empty box.",
    senses: { square: "square-shape" },
    templateIds: ["repeating-shape-pattern"],
    objectives: [
      "Find the repeating part of a pattern of shapes.",
      "Use the repeating part to name shapes that come next or are missing.",
    ],
    openingTitle: "Find the part that repeats",
    opening: [
      "A pattern is something that happens again and again in the same way. A repeating pattern uses the same short group of shapes over and over: circle, square, square, circle, square, square.",
      "That short group is called the repeating part. Here it is circle, square, square. Its length is how many shapes it has: 3.",
      "To find it, read the pattern from the left. Look for the place where it starts again. The group before that place is the repeating part.",
      "Once you know the repeating part, you know every shape in the pattern, even the hidden ones.",
    ],
    example: {
      prompt:
        "The pattern is circle, square, square, circle, square, square, circle, ?, ?. Which two shapes go in the boxes?",
      steps: [
        "The pattern starts again at the 4th shape, a circle. So the repeating part is circle, square, square: 3 shapes.",
        "Seven shapes come before the first box. Count them in groups of 3: two full groups use 6 shapes, and 1 is left over. That 1 is the circle that starts a third repeat.",
        "So the first box is the 2nd shape of the repeating part, a square. The second box is the 3rd shape, also a square.",
      ],
      answer: "square, square",
    },
    methodTitle: "Repeat, count, read on",
    method: [
      "Name the repeating part and count its shapes.",
      "Count the shapes before the box in groups of that size. The shapes left over say how far into the repeating part you are. If none are left over, the box starts a new repeat.",
    ],
    formalTitle: "Position in a repeat",
    formal: [
      "A shape's position is its place in the row: 1st, 2nd, 3rd and so on. If the repeating part has $k$ shapes, positions $n$ and $n+k$ hold the same shape.",
      "Before position $n$ there are $n-1$ shapes. Take away as many whole repeats of $k$ as you can. If $r$ shapes are left over, position $n$ holds shape number $r+1$ of the repeating part.",
    ],
    pitfalls: [
      "Do not start the repeating part again in the middle of a repeat.",
      "Keep the shapes in order. Do not swap two of them.",
      "Use the shortest group that repeats. Square, circle, square, circle is two repeats of square, circle.",
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
