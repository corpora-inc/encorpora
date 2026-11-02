import type { FacetMapping } from "./coverage";
import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

export const shapeFigureGapMethods: Record<string, ProblemMethod> = {
  "congruent-figure-pair": {
    goal: "Pick the two shapes that are exactly the same size and shape, even if one is turned or flipped.",
    intuition:
      "Congruent means exactly the same size and the same shape. One shape would fit exactly on top of the other. A side is one straight part of a shape's outline. A corner is where two sides meet. You may turn a shape or flip it over, but you may not stretch or shrink it. Turning and flipping keep every side just as long and every corner just as wide.",
    senses: { side: "side", similar: "similar-figures" },
    noLink: ["corresponding angles", "part", "faces"],
    terms: ["congruent", "reflection"],
    method: [
      "Compare sizes. A bigger or smaller copy has the same shape, but it is not congruent.",
      "Compare the sides and corners. If one corner has been pulled to a new spot, some sides get longer or shorter. That shape is different.",
      "Picture turning or flipping one shape onto the other. If every side and corner lands on one just like it, the pair is congruent.",
    ],
    watch:
      "Same shape is not enough: a bigger copy is not congruent. A turned or flipped copy is congruent, even though it faces another way.",
  },
  "classify-triangle-by-sides": {
    goal: "Name a triangle as scalene, isosceles or equilateral by counting its equal sides.",
    intuition:
      "A triangle has 3 sides. Compare their lengths and count how many are equal. A scalene triangle has no two sides equal. An isosceles triangle has exactly two equal sides. An equilateral triangle has all three sides equal. Tick marks are small dashes drawn across sides. Sides with the same number of tick marks are equal.",
    senses: { side: "side", square: "square-shape" },
    noLink: ["third", "sort"],
    terms: [
      "scalene",
      [
        "isosceles",
        "In these problems, isosceles means exactly two equal sides, so an equilateral triangle is not counted as isosceles.",
      ],
      "equilateral",
    ],
    method: [
      "Write the three side lengths, or find the sides with the same tick marks.",
      "Count how many sides are equal to each other.",
      "No two equal means scalene. Exactly two equal means isosceles. All three equal means equilateral.",
    ],
    watch:
      "Sort by sides, not by looks. A right triangle, one with a square corner, can be scalene or isosceles. A drawing that looks even may have sides of different lengths.",
  },
  "name-cut-shape-pieces": {
    goal: "Name each piece a flat shape is cut into, by counting its sides and checking its corners.",
    intuition:
      "A shape cut along straight cuts falls into pieces. Each piece is a smaller shape with its own name. A side is one straight part of a piece's outline. A corner is where two sides meet. A corner like the corner of a page is called a square corner. Parallel sides are sides that run the same way and never meet, like train tracks. A cut from one corner to the far corner is called a diagonal.",
    senses: { side: "side", square: "square-shape" },
    noLink: ["change", "whole", "part"],
    terms: ["triangle", "trapezoid", "rectangle"],
    method: [
      "Count the pieces, and look at each one by itself.",
      "Count a piece's sides. A piece with 3 sides is a triangle. A piece with 4 sides is a quadrilateral, a shape with 4 sides.",
      "A 4-sided piece with 4 square corners is a rectangle. A rectangle with 4 equally long sides is a square. A 4-sided piece with exactly one pair of parallel sides is a trapezoid.",
    ],
    watch:
      "Name the pieces, not the whole shape before the cut. A rectangle cut along a diagonal gives two triangles, not two rectangles.",
  },
};

export const shapeFigureGapPrinciples: Record<string, string> = {
  "congruent-figure-pair":
    "Two shapes are congruent when turns, flips and slides can move one exactly onto the other. Then each side lands on a side just as long, and each corner on a corner just as wide. A copy of a different size is called similar, not congruent.",
  "classify-triangle-by-sides":
    "A triangle is equilateral if all three sides are equal, isosceles if exactly two are equal, and scalene if none are equal. Many books count an equilateral triangle as a special isosceles triangle. Here, isosceles means exactly two equal sides. The sides of any triangle also obey this: each side is shorter than the other two added together.",
  "name-cut-shape-pieces":
    "A shape with straight sides, cut with straight cuts, falls into pieces with straight sides. Each piece is a polygon, a closed shape with straight sides, named by its sides and corners. 3 sides make a triangle. 4 sides with 4 square corners make a rectangle, and a square if the sides are also equally long. 4 sides with exactly one pair of parallel sides make a trapezoid. Cutting does not change each piece's own shape.",
};

export const shapeFigureGapLessons: Lesson[] = [
  chainLesson({
    id: "congruent-figures-lesson",
    title: "Congruent figures",
    summary:
      "Congruent means exactly the same size and the same shape. Two shapes are congruent when one fits exactly on top of the other. You may turn a shape or flip it over to check. A bigger copy looks alike, but it is not congruent.",
    noLink: ["part", "faces"],
    templateIds: ["congruent-figure-pair"],
    senses: { side: "side" },
    objectives: [
      "Say what congruent means, including shapes that are turned or flipped.",
      "Spot a pair that differs in size or has a corner pulled out of place.",
    ],
    openingTitle: "Would one fit exactly on the other?",
    opening: [
      "Trace one shape on thin paper. Lay the tracing on the other shape. If it covers the other shape exactly, the two shapes are congruent.",
      "A side is one straight part of a shape's outline. A corner is where two sides meet. You may turn the tracing or flip it over. Turning or flipping does not make any side longer or shorter. It does not make any corner wider or narrower.",
      "Shapes that look alike can still be different. A bigger copy has the same shape but not the same size. When one corner is pulled to a new spot, some sides get longer or shorter. That makes a different shape.",
    ],
    example: {
      prompt:
        "Shape A has 4 sides. Shape B is shape A flipped over. Shape C is a bigger copy of shape A. Which pair is congruent?",
      steps: [
        "Flip shape B back over. Now it covers shape A exactly, side for side and corner for corner. So A and B are congruent.",
        "Shape C has the same shape as A, but its sides are longer. Laid on A, it sticks out. So C is not congruent to A.",
        "C is bigger than B too, so they are not congruent either. Only A and B are congruent.",
      ],
      answer: "A and B",
    },
    methodTitle: "Check size, then corners, then fit",
    method: [
      "Compare size first. If one shape is clearly bigger, the pair is not congruent.",
      "Compare the sides and corners next. Count the sides. Look for a corner pulled out of place.",
      "Then picture turning or flipping one shape onto the other. If every side and corner lands on one just like it, the pair is congruent.",
    ],
    formalTitle: "What congruent means",
    formal: [
      "Two shapes are congruent when turns, flips and slides can move one exactly onto the other. A slide moves a shape without turning it.",
      "Then each side lands on a side just as long. Each corner lands on a corner just as wide. A bigger or smaller copy has corners just as wide, but its sides are longer or shorter. So it is not congruent.",
    ],
    pitfalls: [
      "A bigger copy has the same shape but not the same size. It is not congruent.",
      "A turned or flipped copy is congruent, even though it faces a different way.",
      "Two shapes with the same number of sides can still be different. Check that no corner is pulled out of place.",
    ],
    parentGuide:
      "Ask your learner how they would move one shape onto the other. If the shapes are not congruent, ask what would stick out.",
  }),
  chainLesson({
    id: "triangles-by-sides-lesson",
    title: "Triangles by their sides",
    summary:
      "A triangle has 3 sides. Compare their lengths and count how many are equal. A scalene triangle has no two sides equal. An isosceles triangle has exactly two equal sides. An equilateral triangle has all three sides equal.",
    noLink: ["sort"],
    templateIds: ["classify-triangle-by-sides"],
    senses: { side: "side", square: "square-shape" },
    objectives: [
      "Count the equal sides of a triangle from its side lengths or tick marks.",
      "Match the count to scalene, isosceles or equilateral.",
    ],
    openingTitle: "Count the equal sides",
    opening: [
      "Think of a triangle with sides 6 cm, 6 cm and 9 cm. Two sides are 6 cm long, so those two are equal. The 9 cm side is different.",
      "A drawing may show tick marks instead of lengths. Tick marks are small dashes drawn across sides. Sides with the same number of tick marks are equal in length.",
      "There are three possible counts, and each has a name. No two sides equal: scalene. Exactly two sides equal: isosceles. All three sides equal: equilateral.",
    ],
    example: {
      prompt: "A triangle has sides of 6 cm, 6 cm and 9 cm. What kind is it?",
      steps: [
        "Compare the lengths. The two 6 cm sides are equal, and the 9 cm side is different.",
        "So exactly two sides are equal: not zero and not all three.",
        "A triangle with exactly two equal sides is called isosceles.",
      ],
      answer: "Isosceles",
    },
    methodTitle: "From the count to the name",
    method: [
      "Count the equal sides. No two equal means scalene. Exactly two equal means isosceles. All three equal means equilateral.",
      "Use the side lengths or the tick marks. A drawing can look even when its sides are different.",
    ],
    formalTitle: "Sides and names",
    formal: [
      "Scalene: no two sides are equal. Isosceles: exactly two sides are equal. Equilateral: all three sides are equal.",
      "Many books also call an equilateral triangle isosceles, because two of its sides are equal. In this lesson, isosceles means exactly two equal sides, so the three groups never overlap.",
    ],
    pitfalls: [
      "Use the lengths or tick marks, not how the picture looks.",
      "Sort by sides, not by angles. A right angle is a square corner. An acute angle is an angle narrower than a square corner. An obtuse angle is an angle wider than a square corner. These words describe angles, not sides.",
      "An equilateral triangle is not called isosceles here. Isosceles means exactly two equal sides, and an equilateral triangle has three.",
    ],
    parentGuide:
      "Before your learner says a name, ask how many sides are the same length.",
  }),
  chainLesson({
    id: "cut-shape-pieces-lesson",
    title: "Naming the pieces of a cut figure",
    summary:
      "You can cut a flat shape into smaller pieces with straight cuts. Each piece is a new shape with its own name. A side is one straight part of a piece's outline. A corner is where two sides meet. Count the sides and look at the corners to name a piece.",
    templateIds: ["name-cut-shape-pieces"],
    senses: { side: "side", square: "square-shape" },
    noLink: ["whole", "part"],
    objectives: [
      "Look at each piece of a cut shape on its own.",
      "Name a piece from its number of sides and its corners.",
    ],
    openingTitle: "Each piece has its own name",
    opening: [
      "Name each piece by itself. Cover the other pieces with your hand if it helps.",
      "A corner like the corner of a page is called a square corner. A triangle is a shape with 3 sides. A rectangle is a shape with 4 sides and 4 square corners, like a door. A square is a rectangle with all 4 sides equally long.",
      "Parallel sides are sides that run the same way and never meet, like train tracks. A trapezoid is a shape with 4 sides and exactly one pair of parallel sides.",
      "Now make one straight cut across a rectangle, from one corner to the far corner. That cut is called a diagonal. It makes two pieces, and each piece is a triangle.",
    ],
    example: {
      prompt:
        "A rectangle is cut straight across, from one corner to the far corner. What are the pieces?",
      steps: [
        "One straight cut across the rectangle makes 2 pieces.",
        "Look at one piece. It has 3 sides: two sides of the rectangle and the cut. The other piece is the same.",
        "A shape with 3 sides is a triangle. So the pieces are 2 triangles.",
      ],
      answer: "2 triangles",
    },
    methodTitle: "Count sides, then check corners",
    method: [
      "Count the pieces. Then count the sides of each piece.",
      "3 sides: a triangle. 4 sides and 4 square corners: a rectangle. If those 4 sides are also equally long, it is a square. 4 sides with exactly one pair of parallel sides: a trapezoid.",
    ],
    formalTitle: "Naming the pieces",
    formal: [
      "A polygon is a closed flat shape with straight sides. Closed means its outline has no gaps. A polygon is named by how many sides it has. A polygon with 4 sides is also named by its parallel sides and square corners.",
      "A square is a rectangle whose 4 sides are equally long. Each piece keeps its own number of sides, whatever the whole shape was.",
    ],
    pitfalls: [
      "Name the pieces, not the shape you started with.",
      "Count the pieces, not the cuts. One straight cut across a rectangle makes 2 pieces.",
      "A square is also a rectangle. If a piece's 4 sides are equally long, call it a square.",
    ],
    parentGuide:
      "Cover all but one piece with your hand. Ask your learner to count that piece's sides and name it.",
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
