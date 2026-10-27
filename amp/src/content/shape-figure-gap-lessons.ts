import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

export const shapeFigureGapMethods: Record<string, ProblemMethod> = {
  "congruent-figure-pair": {
    goal: "Pick the two figures that have exactly the same size and shape, even when one is turned or flipped.",
    intuition:
      "Two figures are congruent when one would fit exactly on top of the other. You may turn a figure or flip it over, but you may not stretch, shrink or bend it. A turned or flipped figure keeps all its side lengths and angles.",
    terms: [
      [
        "congruent",
        "Having exactly the same size and shape, so that one fits on the other.",
      ],
      [
        "flip",
        "Turning a figure over like a page, which makes its mirror image.",
      ],
    ],
    method: [
      "Count the sides of each figure and compare how long they look: a bigger or smaller copy has the same shape but cannot be congruent.",
      "Look at the corners: a figure with one corner in a different place is a different shape.",
      "Imagine turning or flipping one figure onto the other. If every side and corner lands on a side and corner, the pair is congruent.",
    ],
    watch:
      "Same shape is not enough: a bigger copy is not congruent. A turned or flipped copy is congruent even though it points in a different direction.",
  },
  "classify-triangle-by-sides": {
    goal: "Name a triangle as scalene, isosceles or equilateral by how many of its sides are equal.",
    intuition:
      "Triangles are sorted by their sides. Compare the three side lengths and count how many are equal: none equal, exactly two equal, or all three equal.",
    terms: [
      ["scalene", "A triangle with no two sides equal."],
      ["isosceles", "A triangle with exactly two sides equal."],
      ["equilateral", "A triangle with all three sides equal."],
    ],
    method: [
      "Write the three side lengths, or find the sides that have the same tick marks.",
      "Count how many sides are equal to each other.",
      "None equal means scalene, exactly two equal means isosceles, and all three equal means equilateral.",
    ],
    watch:
      "Sort by sides, not by how the triangle looks. A right triangle can be scalene or isosceles, and a drawing that looks even may have sides of different lengths.",
  },
  "name-cut-shape-pieces": {
    goal: "Name each piece a flat figure is cut into by counting its sides and square corners.",
    intuition:
      "When a flat figure is cut along straight lines, every piece is a smaller flat figure with its own name. Look at each piece alone and ignore the rest of the figure.",
    terms: [
      ["triangle", "A figure with 3 straight sides."],
      [
        "trapezoid",
        "A figure with 4 straight sides and exactly one pair of parallel sides.",
      ],
      [
        "rectangle",
        "A figure with 4 sides and 4 square corners. A square is a rectangle with 4 equal sides.",
      ],
    ],
    method: [
      "Count the pieces and look at each one separately.",
      "Count the sides of a piece: 3 sides is a triangle, 4 sides is a four-sided figure.",
      "For a four-sided piece, look for square corners and equal sides: 4 square corners is a rectangle, plus equal sides is a square, and one pair of parallel sides without square corners all round is a trapezoid.",
    ],
    watch:
      "Name the pieces, not the whole figure before it was cut. A rectangle cut along a diagonal gives two triangles, not two rectangles.",
  },
};

export const shapeFigureGapPrinciples: Record<string, string> = {
  "congruent-figure-pair":
    "Two figures are congruent when a sequence of turns, flips and slides carries one exactly onto the other. Congruent figures have equal corresponding side lengths and equal corresponding angles. A figure of the same shape and a different size is similar, not congruent.",
  "classify-triangle-by-sides":
    "A triangle is equilateral if all three sides are equal, isosceles if exactly two are equal, and scalene if none are equal. Many books count an equilateral triangle as a special isosceles triangle; here isosceles means exactly two equal sides. The three side lengths of a triangle must also satisfy: each side is shorter than the sum of the other two.",
  "name-cut-shape-pieces":
    "Each piece of a cut figure is a polygon named by its sides and angles: 3 sides make a triangle; 4 sides with 4 right angles make a rectangle, a square if the sides are also equal; 4 sides with one pair of parallel sides make a trapezoid. Cutting a figure into pieces does not change the pieces' own shapes.",
};

export const shapeFigureGapLessons = [
  chainLesson({
    id: "congruent-figures-lesson",
    title: "Congruent figures",
    summary:
      "Tell figures that fit exactly on each other from figures that only look alike.",
    templateIds: ["congruent-figure-pair"],
    objectives: [
      "Say what congruent means, including figures that are turned or flipped.",
      "Rule out a pair by a different size or a corner in a different place.",
    ],
    openingTitle: "Would one fit exactly on the other?",
    opening: [
      "Picture tracing one figure and laying the tracing on another. If it covers the other exactly, the figures are congruent. You may turn the tracing or flip it over, because a turn or a flip does not change any side or angle.",
      "Figures that look alike can still fail: a bigger copy is the same shape but not the same size, and a figure with one corner moved is a different shape.",
    ],
    example: {
      prompt:
        "Figure A is a four-sided figure. Figure B is the same figure flipped over. Figure C is a larger copy of A. Which pairs are congruent?",
      steps: [
        "A and B have the same side lengths and angles. Flipping B back makes it fit on A, so they are congruent.",
        "C has the same shape as A but its sides are longer, so it cannot fit on A.",
        "Only A and B are congruent.",
      ],
      answer: "A and B",
    },
    methodTitle: "Check size, then corners, then fit",
    method: [
      "Compare size: if one figure is clearly larger, the pair is not congruent.",
      "Compare corners: count sides and see whether any corner sits in a different place.",
      "Then imagine turning or flipping one onto the other.",
    ],
    formalTitle: "Congruence",
    formal: [
      "Figures are congruent when turns, flips and slides carry one exactly onto the other. Then all corresponding sides and angles are equal.",
      "A larger or smaller copy has equal angles but sides in a constant ratio different from 1, so it is similar but not congruent.",
    ],
    pitfalls: [
      "Calling a bigger copy congruent because it has the same shape.",
      "Rejecting a turned or flipped copy because it points in a different direction.",
      "Choosing figures that share a number of sides but have a corner in a different place.",
    ],
    parentGuide:
      "Ask your learner to describe how they would move one figure onto the other, and what would stick out.",
  }),
  chainLesson({
    id: "triangles-by-sides-lesson",
    title: "Triangles by their sides",
    summary:
      "Name a triangle as scalene, isosceles or equilateral by counting equal sides.",
    templateIds: ["classify-triangle-by-sides"],
    objectives: [
      "Count the equal sides of a triangle from lengths or tick marks.",
      "Match the count to scalene, isosceles or equilateral.",
    ],
    openingTitle: "Count the equal sides",
    opening: [
      "Triangles can be sorted by their sides. Tick marks on sides of a drawing show which sides have the same length: the same number of ticks means equal sides.",
      "Three names cover the counts: no equal sides, exactly two equal sides, or all three equal.",
    ],
    example: {
      prompt: "A triangle has sides of 6 cm, 6 cm and 9 cm. What kind is it?",
      steps: [
        "Compare the lengths: 6 and 6 are equal, and 9 is different.",
        "Exactly two sides are equal.",
        "A triangle with exactly two equal sides is isosceles.",
      ],
      answer: "Isosceles",
    },
    methodTitle: "From the count to the name",
    method: [
      "Count equal sides: 0 is scalene, exactly 2 is isosceles, 3 is equilateral.",
      "Use side lengths or tick marks, not how the drawing looks.",
    ],
    formalTitle: "Sides and names",
    formal: [
      "Scalene: no two sides equal. Isosceles: exactly two sides equal. Equilateral: all three sides equal.",
      "Some books count an equilateral triangle as isosceles too; the names here keep the three groups apart.",
    ],
    pitfalls: [
      "Looking at the picture instead of the lengths or ticks.",
      "Mixing side names with angle names: right, acute and obtuse describe angles.",
      "Calling an equilateral triangle isosceles because two of its sides are equal; here isosceles means exactly two.",
    ],
    parentGuide:
      "Ask your learner how many sides are the same length before they say the name.",
  }),
  chainLesson({
    id: "cut-shape-pieces-lesson",
    title: "Naming the pieces of a cut figure",
    summary:
      "Name the triangles, rectangles, squares and trapezoids made by cutting a flat figure.",
    templateIds: ["name-cut-shape-pieces"],
    objectives: [
      "Look at each piece of a cut figure on its own.",
      "Name a piece from its number of sides and its square corners.",
    ],
    openingTitle: "Each piece has its own name",
    opening: [
      "When a figure is cut along straight lines, each piece is a smaller figure. Name each piece by itself: count its sides, then look at its corners.",
      "A rectangle cut corner to corner makes two triangles. The pieces are triangles even though the whole was a rectangle.",
    ],
    example: {
      prompt:
        "A rectangle is cut from one corner to the opposite corner. What are the pieces?",
      steps: [
        "The cut is a straight line from corner to corner, so it makes 2 pieces.",
        "Each piece has 3 sides: two sides of the rectangle and the cut.",
        "A figure with 3 sides is a triangle.",
      ],
      answer: "2 triangles",
    },
    methodTitle: "Count sides, then check corners",
    method: [
      "Count the pieces, then count the sides of each piece.",
      "3 sides: triangle. 4 sides with 4 square corners: rectangle, or square if the sides are equal. 4 sides with one pair of parallel sides: trapezoid.",
    ],
    formalTitle: "Naming polygons",
    formal: [
      "A polygon is named by its number of sides, and a four-sided polygon by its parallel sides and right angles.",
      "A square is a rectangle whose four sides are equal. The pieces of a cut figure keep their own side counts, whatever the whole looked like.",
    ],
    pitfalls: [
      "Naming the pieces after the original figure.",
      "Counting the cut lines instead of the pieces.",
      "Forgetting that a square is also a rectangle when the choices could overlap; use the equal sides to tell them apart.",
    ],
    parentGuide:
      "Cover all but one piece with your hand and ask your learner to count its sides.",
  }),
];

export const shapeFigureGapFacetMappings: FacetMapping[] = [
  {
    templateId: "congruent-figure-pair",
    facetId: "polygon-properties.core",
    extent: "partial",
    rationale:
      "Single choice of the congruent pair among four drawn convex figures of three to five sides at one scale: a turned or flipped copy, a larger or smaller copy and a figure with one corner moved. Does not assess congruence of figures cut into equal parts, congruent triangle criteria, or justifying a match.",
  },
  {
    templateId: "classify-triangle-by-sides",
    facetId: "shape-hierarchy.core",
    extent: "partial",
    rationale:
      "Single choice for a triangle named from its side lengths, or for the drawn triangle with no, exactly two or three equal sides among four with tick marks. Does not assess classification by angles, the inclusive view that every equilateral triangle is isosceles, or the triangle inequality.",
  },
  {
    templateId: "name-cut-shape-pieces",
    facetId: "polygon-properties.core",
    extent: "partial",
    rationale:
      "Single choice naming all pieces of a rectangle or square cut by one or two straight lines into triangles, rectangles, squares or trapezoids. Does not assess cutting a figure to a stated result, composing a figure from named pieces, or pentagons and hexagons.",
  },
];
