import type { FacetMapping } from "./coverage";
import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

/**
 * Lessons, methods and principles for measuring area by counting unit
 * squares (3.MD.C.6), in standard square units and in improvised units.
 */

const areaSenses = {
  square: "square-shape",
  squares: "square-shape",
  unit: "unit",
  units: "unit",
  side: "side",
  sides: "side",
  "more than": "more-than",
};
/** Ordinary words here: part of a mat, the whole hallway, a hole in a
 * shape, the edge of a patio, a covering that leaves a gap. */
const areaNoLink = [
  "part",
  "parts",
  "whole",
  "hole",
  "holes",
  "edge",
  "change",
  "changes",
  "leaves",
];

export const areaByCountingMethods: Record<string, ProblemMethod> = {
  "count-unit-squares": {
    goal: "Find the area of a shaded shape on a grid by counting the unit squares that cover it.",
    intuition:
      "Area is how much flat space a shape covers. A unit square is a square with sides 1 unit long, such as 1 foot by 1 foot. It covers 1 square foot. To find the area of a shape on a grid, count the unit squares that cover it. They must have no gaps and no overlaps. Count one row at a time and keep a running total, so no square is counted twice. The answer is a number of square units, such as square feet.",
    senses: areaSenses,
    noLink: areaNoLink,
    terms: ["area", "unit-square"],
    method: [
      "Read the legend: each small square is 1 square unit, such as 1 square foot.",
      "Count the shaded squares in the top row. Then add each row below it, keeping a running total.",
      "Leave out every unshaded square, including a hole inside the shape, because it is not covered.",
      "Write the total with the square unit. Check it against the box around the shape: the area can be no more than the squares in the box.",
    ],
    watch:
      "Count each shaded square once, row by row, and give the area in square units, not in feet or centimeters.",
  },
  "unit-square-area-statement": {
    goal: "Choose the true statement of a shaded shape's area, in square units.",
    intuition:
      "Area is how much flat space a shape covers, counted in unit squares. A unit square is a square with sides 1 unit long. So an area is a number of square units, such as square inches. A statement about area can go wrong in three ways. It can use a length unit, such as inches. It can count every square of the box around the shape. Or it can count only the squares along the shape's edge.",
    senses: areaSenses,
    noLink: areaNoLink,
    terms: ["area", "unit-square"],
    method: [
      "Count the shaded squares row by row, keeping a running total.",
      "Choose the statement with that number and a square unit, such as square inches.",
      "Reject a length unit, the count of the whole box around the shape, and the count of edge squares only.",
    ],
    watch:
      "Area counts every shaded square, the inside ones too, and is measured in square units.",
  },
  "improvised-unit-count": {
    goal: "Find the area of a surface covered by sticky notes, floor tiles, cards, napkins or crackers, in those units.",
    intuition:
      "Area is how much flat space a surface covers. Any square object can be a unit for area, as long as copies of it cover the surface with no gaps and no overlaps. A sticky note, a floor tile or a card works. The area is then the number of those units, such as 18 sticky notes. A different unit would give a different number.",
    senses: areaSenses,
    noLink: areaNoLink,
    terms: ["area"],
    method: [
      "Check that the units cover the whole surface with no gaps and no overlaps.",
      "Count the units in the top row. Then add each row below it, keeping a running total.",
      "Give the area as that number of units, such as 18 sticky notes.",
    ],
    watch:
      "Count each unit once, row by row, and name the unit in the answer: the number alone does not say how big the area is.",
  },
  "improvised-unit-covering": {
    goal: "Choose the covering whose count of units measures the area of a surface.",
    intuition:
      "Area is how much flat space a surface covers. Counting units measures area only when they cover the whole surface with no gaps and no overlaps. A gap is a bare part of the surface, so the count is too small. An overlap is a unit lying on top of another, so part of the surface is counted twice and the count is too big.",
    senses: areaSenses,
    noLink: areaNoLink,
    terms: ["area"],
    method: [
      "Look at each picture for a bare part of the surface. A covering with a gap counts too few units.",
      "Look for a unit lying on top of another. A covering with an overlap counts too many units.",
      "Choose the covering with no gaps and no overlaps. Its count is the area.",
    ],
    watch:
      "A covering can look full and still have an overlap. Check every picture for both gaps and units on top of others.",
  },
  "improvised-unit-change": {
    goal: "Decide whether measuring the same surface with a smaller or larger square unit takes more, fewer or the same number of units.",
    intuition:
      "Area is how much flat space a surface covers. Changing the unit does not change the surface, so its area stays the same. The count changes. When each side of the new unit is half as long, 2 new units fit along each side of an old one. So $2 \\times 2 = 4$ new units cover one old unit, and it takes 4 times as many. When each side is twice as long, one new unit covers 4 old ones, so it takes fewer.",
    senses: areaSenses,
    noLink: areaNoLink,
    terms: ["area"],
    method: [
      "Compare the units: is the new unit smaller or larger than the first one?",
      "Count how many small units fit on one large unit: 2 along each side, so $2 \\times 2 = 4$.",
      "A smaller unit takes more units to cover the surface. A larger unit takes fewer.",
    ],
    watch:
      "The area stays the same, but the count does not: a smaller unit gives a bigger count.",
  },
};

export const areaByCountingPrinciples: Record<string, string> = {
  "count-unit-squares":
    "The area of a shape is the number of unit squares that cover it with no gaps and no overlaps. Each unit square covers 1 square unit, so a shape covered by 10 unit squares of 1 square foot has an area of 10 square feet.",
  "unit-square-area-statement":
    "Area is measured in square units. It counts every unit square inside the shape: not the squares of the box around it, and not only the squares along its edge.",
  "improvised-unit-count":
    "Any square unit laid with no gaps and no overlaps measures area. The area is the number of units, and that number depends on the unit chosen.",
  "improvised-unit-covering":
    "A covering measures area only when it has no gaps and no overlaps. A gap makes the count too small, and an overlap counts part of the surface twice.",
  "improvised-unit-change":
    "For the same surface, a smaller unit gives a larger count and a larger unit gives a smaller count. When each side is half as long, 4 small units cover 1 large unit, so the count is 4 times as large.",
};

for (const [id, base] of [
  ["mark-unit-squares", "count-unit-squares"],
  ["mark-improvised-units", "improvised-unit-count"],
] as const) {
  areaByCountingMethods[id] = {
    ...areaByCountingMethods[base]!,
    method: [
      ...areaByCountingMethods[base]!.method.slice(0, 1),
      "Count one row at a time. Tap each square as you count it; an $X$ helps you remember which squares you counted.",
      "Tap again to remove an $X$, or use Reset marks to start counting again. The marks are only a counting aid.",
      "Enter the area with the named unit. Only your entered area is checked, so you may also count without marks.",
    ],
    watch:
      "Count only the shaded squares, including those inside the shape. Leave unshaded squares and holes out of your count.",
  };
  areaByCountingPrinciples[id] = areaByCountingPrinciples[base]!;
}

export const areaByCountingLessons: Lesson[] = [
  chainLesson({
    id: "area-by-counting-unit-squares-lesson",
    title: "Area by counting unit squares",
    summary:
      "Area is how much flat space a shape covers. Find it by counting the unit squares that cover the shape, one row at a time, and give it in square units such as square feet.",
    senses: areaSenses,
    noLink: areaNoLink,
    templateIds: [
      "count-unit-squares",
      "unit-square-area-statement",
      "mark-unit-squares",
    ],
    objectives: [
      "Find the area of a rectangle, a composite shape, an irregular shape or a shape with a hole by counting unit squares.",
      "State an area in square centimeters, square inches, square feet or square meters.",
    ],
    openingTitle: "Covering a shape with squares",
    opening: [
      "Area is how much flat space a shape covers. A unit square is a square with sides 1 unit long. A square 1 foot on each side covers 1 square foot. A square 1 centimeter on each side covers 1 square centimeter.",
      "To measure a shape's area, cover it with unit squares that leave no gaps and do not overlap. Then count them. The count, with the square unit, is the area: 10 square feet.",
      "A shape does not have to be a rectangle. An L shape, a plus shape or a shape with a hole is measured the same way. A hole is not covered, so it is not counted.",
    ],
    example: {
      prompt:
        "Each small square is 1 square foot. A patio is shaded on a grid: 4 squares in the top row, 4 in the middle row and 2 in the bottom row. What is the area of the patio?",
      steps: [
        "Each square is 1 square foot, so count the shaded squares.",
        "The top row has 4: 4 so far. The middle row has 4: $4 + 4 = 8$ so far.",
        "The bottom row has 2: $8 + 2 = 10$. So 10 squares cover the patio.",
        "The patio fits in a box 4 squares wide and 3 squares tall, which holds $4 \\times 3 = 12$ squares. 10 is less than 12, as it should be.",
      ],
      answer: "10 square feet",
    },
    methodTitle: "Count row by row",
    method: [
      "Read the legend to learn the unit: 1 square centimeter, inch, foot or meter.",
      "Count the shaded squares in each row and keep a running total. Skip unshaded squares and holes.",
      "Write the total with the square unit. A length unit such as feet measures distance, not area.",
    ],
    formalTitle: "What area means",
    formal: [
      "A unit square is a square with side length 1 unit. Its area is 1 square unit.",
      "A flat figure covered without gaps or overlaps by $n$ unit squares has an area of $n$ square units.",
    ],
    pitfalls: [
      "Counting every square of the box around the shape, unshaded squares too.",
      "Counting only the squares along the edge of the shape.",
      "Writing the area in feet or centimeters instead of square feet or square centimeters.",
    ],
    parentGuide:
      "Ask your learner to touch each shaded square once while saying the running total aloud, then to say the unit: square feet, not feet.",
  }),
  chainLesson({
    id: "area-by-counting-improvised-units-lesson",
    title: "Area with sticky notes, tiles and cards",
    summary:
      "Any square object can measure area, if copies of it cover the surface with no gaps and no overlaps. The area is the number of units, and a smaller unit takes more of them.",
    senses: areaSenses,
    noLink: areaNoLink,
    templateIds: [
      "improvised-unit-count",
      "mark-improvised-units",
      "improvised-unit-covering",
      "improvised-unit-change",
    ],
    objectives: [
      "Measure the area of a surface by counting an improvised square unit.",
      "Reject coverings with gaps or overlaps, and predict how the count changes with a smaller or larger unit.",
    ],
    openingTitle: "Measuring with what you have",
    opening: [
      "Area is how much flat space a surface covers. You do not need a ruler to measure it. Cover a desk top with sticky notes, edge to edge, and count them.",
      "The covering must have no gaps, which are bare parts, and no overlaps, which are notes on top of other notes. A gap makes the count too small. An overlap counts part of the desk twice.",
      "The count depends on the unit. Small sticky notes, with sides half as long, fit 4 to one large note. So the same desk takes 4 times as many small notes.",
    ],
    example: {
      prompt:
        "Omar covers a desk top with large sticky notes, with no gaps and no overlaps: 3 rows of 5. Then he covers it with small sticky notes whose sides are half as long. How many small sticky notes does it take?",
      steps: [
        "Count the large notes row by row: 5, then $5 + 5 = 10$, then $10 + 5 = 15$. The area is 15 large sticky notes.",
        "Two small notes fit along each side of a large note, so $2 \\times 2 = 4$ small notes cover one large note.",
        "So the desk takes $4 \\times 15 = 60$ small sticky notes: more than 15, because the unit is smaller.",
      ],
      answer: "60 small sticky notes",
    },
    methodTitle: "Check the covering, count, compare units",
    method: [
      "Check for gaps and for units lying on top of others. Only a covering with neither measures area.",
      "Count the units row by row with a running total, and name the unit in the answer.",
      "When the unit changes, compare sizes: a smaller unit takes more units, and a larger unit takes fewer.",
    ],
    formalTitle: "Units of area",
    formal: [
      "Any square laid without gaps or overlaps can serve as a unit of area. The area is the number of units that cover the surface.",
      "If each side of a unit is half as long, 4 of the new units cover one old unit, so the count is multiplied by 4.",
    ],
    pitfalls: [
      "Counting a covering that leaves part of the surface bare.",
      "Counting units that lie on top of other units.",
      "Expecting the same count after switching to a unit of a different size.",
    ],
    parentGuide:
      "Cover a book or a tray at home with sticky notes or crackers, count them together, then guess how many smaller ones it would take.",
  }),
];

export const areaByCountingFacetMappings: FacetMapping[] = [
  ...["mark-unit-squares", "mark-improvised-units"].map(
    (templateId): FacetMapping => ({
      templateId,
      facetId: "area-by-counting-squares.core",
      extent: "partial",
      rationale:
        "Counts drawn square units with optional tap-to-mark scratch work, then reports the area in the given unit. Does not assess physical tiling.",
    }),
  ),
  {
    templateId: "count-unit-squares",
    facetId: "area-by-counting-squares.core",
    extent: "partial",
    rationale:
      "Counting the shaded unit squares of a rectangle, an L-shaped, T-shaped, U-shaped, plus-shaped or staircase figure, an irregular edge-connected shape, or a shape with one or two holes, in square centimeters, inches, feet or meters. No side lengths are labeled. Learners count a drawn figure; they do not lay physical squares.",
  },
  {
    templateId: "unit-square-area-statement",
    facetId: "area-by-counting-squares.core",
    extent: "partial",
    rationale:
      "Choosing the area statement with the shaded-square count and a square unit, against a length unit, the count of the bounding box (or the perimeter of a rectangle) and the count of edge squares only.",
  },
  {
    templateId: "improvised-unit-count",
    facetId: "area-by-counting-squares.core",
    extent: "partial",
    rationale:
      "Counting an improvised square unit (sticky notes, floor tiles, cards, napkins or crackers) that covers a rectangular, L-shaped or T-shaped surface without gaps or overlaps. The covering is drawn; the learner does not lay the units.",
  },
  {
    templateId: "improvised-unit-covering",
    facetId: "area-by-counting-squares.core",
    extent: "partial",
    rationale:
      "Choosing, among three coverings of the same surface, the one with no gaps and no overlaps, so that its count is the area. It touches the gaps-and-overlaps condition of 3.MD.C.5b.",
  },
  {
    templateId: "improvised-unit-change",
    facetId: "area-by-counting-squares.core",
    extent: "partial",
    rationale:
      "Deciding whether a unit with sides half or twice as long gives more, fewer or the same count for the same surface. It predicts the direction of the change; it does not ask for the new count.",
  },
];
