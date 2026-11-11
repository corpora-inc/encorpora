import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

const senses = {
  square: "square-shape",
  squares: "square-shape",
  unit: "unit",
  units: "unit",
  side: "side",
  sides: "side",
} as const;
const noLink = ["part", "parts", "whole", "row", "rows", "note", "notes"];

export const areaClauseMethods: Record<string, ProblemMethod> = {
  "define-unit-square": {
    goal: "State the area of a square whose sides are each 1 unit long.",
    watch:
      "Count the covered surface in square units; side length and perimeter measure lengths.",
    senses,
    noLink,
    method: [
      "A side of 1 unit is a length. The square covers a flat surface.",
      "One such square covers 1 square unit, named for the unit of the side.",
      "Reject the side length, the perimeter, and four square units.",
    ],
  },
  "which-is-a-unit-square": {
    goal: "Choose the figure that is a square one unit on each side.",
    watch:
      "Check both side lengths: a square with sides longer than 1 unit is not a unit square.",
    senses,
    noLink,
    method: [
      "A unit square is 1 unit wide and 1 unit tall.",
      "A 1 by 2 rectangle is two unit squares. A 2 by 2 square has area 4.",
      "A segment has length and no area.",
    ],
  },
  "count-square-units": {
    goal: "Count the unit squares that cover a region with no gaps or overlaps.",
    watch:
      "Count each shaded square once, and leave empty squares out of the total.",
    senses,
    noLink,
    method: [
      "Count the shaded squares in one row.",
      "Add the next row to the running total, and skip empty squares.",
      "The total is the area in square units.",
    ],
  },
  "gaps-overlaps": {
    goal: "Choose the covering that has one tile on every cell and no tile on another.",
    watch:
      "Check the entire covering for both empty spaces and tiles placed on top of each other.",
    senses,
    noLink,
    method: [
      "A gap leaves a cell of the figure bare, so the count is too small.",
      "An overlap lays a tile on another tile, so the count is too large.",
      "The area is the covering with neither.",
    ],
  },
  "tile-then-multiply": {
    goal: "Count one row of a partly tiled rectangle, then multiply by every row.",
    watch:
      "Include the rows that need tiles, not just the rows already filled.",
    senses,
    noLink,
    method: [
      "Count the unit squares in one full row.",
      "Use every row of the rectangle, including the rows that are still blank.",
      "The product of the sides equals that count.",
    ],
  },
  "split-tiled-count": {
    goal: "Count both parts of a split rectangle and match the product a(b + c).",
    watch:
      "Multiply each part's width by the shared height before adding the two areas.",
    senses,
    noLink,
    method: [
      "Count the left part as rows times its width.",
      "Count the right part the same way, then add.",
      "That total is also rows times the whole width.",
    ],
  },
  "choose-the-split": {
    goal: "Choose the column split that matches $a$ times $b$ plus $a$ times $c$.",
    watch:
      "Match the split to the number of columns in each part, not the number of rows.",
    senses,
    noLink,
    method: [
      "Read which factor is a number of columns.",
      "The heavy line must fall after that many columns, not after that many rows.",
      "A split after the other part's width is the same cut from the other end.",
    ],
  },
  "your-own-cut": {
    goal: "Cut an L with no seam into two rectangles and add their areas.",
    watch:
      "The two rectangles must cover the L exactly, without overlapping or filling its missing corner.",
    senses,
    noLink,
    method: [
      "Draw a straight cut from the inner corner to a side.",
      "Multiply to find each rectangle. Either direction of cut is allowed.",
      "Add the two areas. Do not multiply the outer length by the outer height.",
    ],
  },
  "which-cut": {
    goal: "Choose the cut that splits an L into two rectangles with no shared area.",
    watch:
      "Check that both resulting pieces are rectangles and that neither covers part of the other.",
    senses,
    noLink,
    method: [
      "The cut starts at the inner corner and runs straight to a side.",
      "A slanted cut does not make rectangles.",
      "A line that misses the corner leaves an L, and overlapping outlines count the corner twice.",
    ],
  },
  "exhibit-same-perimeter": {
    goal: "Give a different rectangle with the same perimeter, and its area.",
    watch:
      "Keep the sum of one length and one width fixed; turning the original rectangle does not make a new one.",
    senses,
    noLink,
    method: [
      "Add one length and one width. That sum is half the perimeter.",
      "Find a different pair of whole numbers with the same sum.",
      "The area is the product of the new sides, not their sum.",
    ],
  },
  "exhibit-same-area": {
    goal: "Give a different rectangle with the same area, and its perimeter.",
    watch:
      "Keep the product of the side lengths fixed, then add all four sides to find the new perimeter.",
    senses,
    noLink,
    method: [
      "Find a different factor pair of the area.",
      "Turning the given rectangle does not make a different one.",
      "The perimeter is twice the sum of the new sides.",
    ],
  },
  "plot-the-polygon": {
    goal: "Plot the four vertices of a rectangle from their coordinates.",
    watch:
      "Read each pair across first and up or down second; keep the two coordinates in that order.",
    method: [
      "The first number of a pair is the $x$-coordinate.",
      "The second number is the $y$-coordinate.",
      "Plot all four vertices. The order does not matter.",
    ],
  },
  "missing-vertex": {
    goal: "Plot the fourth vertex of a rectangle from the other three.",
    watch:
      "Match one coordinate with the corner above or below and the other with the corner beside it.",
    method: [
      "The missing vertex shares its $x$-coordinate with the one above or below it.",
      "It shares its $y$-coordinate with the one beside it.",
      "Do not swap those two coordinates.",
    ],
  },
  "cone-section-area": {
    goal: "Find a halfway cross-section, or the volume of a cone with that base and height.",
    watch:
      "Halving lengths makes the cross-section's area one quarter as large, not one half.",
    method: [
      "A plane halfway from the apex uses scale 1/2.",
      "Cross-section area multiplies the base area by the square of the scale.",
      "A cone's volume is one third of base area times height.",
    ],
  },
  "cavalieri-coin-stack": {
    goal: "Find the volume of a stack of coins after it is pushed slanted.",
    watch:
      "A sideways shift changes the stack's shape, but it adds or removes no coin material.",
    method: [
      "Each coin is one layer of the stack.",
      "A slant does not change a layer's volume.",
      "Multiply the number of coins by the volume of one coin.",
    ],
  },
  "tilted-rectangle": {
    goal: "Find the area or perimeter of a rectangle that is not aligned with the axes.",
    watch:
      "Use the actual side lengths, not their horizontal or vertical changes alone.",
    method: [
      "Check that adjacent sides are perpendicular: their direction vectors have dot product 0.",
      "Use the distance formula on the two different sides.",
      "Area multiplies those lengths. Perimeter adds them and doubles.",
    ],
  },
};

export const areaClausePrinciples: Record<string, string> = {
  "define-unit-square":
    "A square with side length 1 unit is a unit square. It covers one square unit of area.",
  "which-is-a-unit-square":
    "Only a square that is one unit on each side is a unit square. A longer side or a segment is not.",
  "count-square-units":
    "A figure covered without gaps or overlaps by $n$ unit squares has area $n$ square units.",
  "gaps-overlaps":
    "A gap makes the tile count too small, and an overlap makes it too large. Neither count is the area.",
  "tile-then-multiply":
    "The number of unit squares in a rectangle equals the number in one row times the number of rows.",
  "split-tiled-count":
    "Splitting a rectangle shows a × (b + c) = a × b + a × c, because both sides count the same squares.",
  "choose-the-split":
    "The split that shows $a \\times b + a \\times c$ falls after $b$ columns of the $a \\times (b + c)$ rectangle.",
  "your-own-cut":
    "An L-shaped figure with no drawn seam is still two rectangles. Either straight cut from the inner corner works, and the areas add.",
  "which-cut":
    "A straight cut from the inner corner to a side makes two rectangles that do not overlap.",
  "exhibit-same-perimeter":
    "Rectangles with the same perimeter can cover different areas. Half the perimeter is one length plus one width.",
  "exhibit-same-area":
    "Rectangles with the same area can have different perimeters. A longer, thinner rectangle has the longer trip around.",
  "plot-the-polygon":
    "A polygon in the coordinate plane is drawn by plotting each given vertex.",
  "missing-vertex":
    "The fourth vertex of an axis-aligned rectangle shares one coordinate with each of two neighbors.",
  "cone-section-area":
    "A cross-section parallel to the base scales area by the square of the length scale. A cone's volume is one third base times height.",
  "cavalieri-coin-stack":
    "Solids with the same height and the same cross-section at every level have the same volume. A slant does not change the coins.",
  "tilted-rectangle":
    "Perpendicular adjacent sides have dot product 0. The area is the product of the side lengths, and the perimeter doubles their sum.",
};

const lesson = (
  id: string,
  title: string,
  summary: string,
  templateIds: string[],
  objectives: string[],
  opening: string[],
  example: { prompt: string; steps: string[]; answer: string },
  method: string[],
  formal: string[],
): Lesson =>
  chainLesson({
    id,
    title,
    summary,
    senses,
    noLink,
    templateIds,
    objectives,
    openingTitle: title,
    opening,
    example,
    methodTitle: "How to answer",
    method,
    formalTitle: "The rule",
    formal,
    pitfalls: method.slice(0, 2),
    parentGuide: summary,
  });

export const areaClauseLessons: Lesson[] = [
  lesson(
    "count-square-units-lesson",
    "Unit squares and counting area",
    "A unit square covers one square unit. Count the squares that cover a figure, with no gaps and no overlaps.",
    [
      "define-unit-square",
      "which-is-a-unit-square",
      "count-square-units",
      "gaps-overlaps",
    ],
    [
      "Say what area one unit square covers.",
      "Count a non-rectangular region and reject a covering with gaps or overlaps.",
    ],
    [
      "A square 1 cm on each side covers 1 square centimeter. That square is a unit square.",
      "If $n$ unit squares cover a figure with no gaps and no overlaps, the area is $n$ square units.",
    ],
    {
      prompt:
        "A figure is covered by 14 unit squares with no gaps or overlaps. What is its area?",
      steps: [
        "Each unit square covers 1 square unit.",
        "There are 14 of them, and none is missing or stacked.",
        "The area is 14 square units.",
      ],
      answer: "14 square units",
    },
    [
      "Name the square unit, not the length of a side.",
      "Count every shaded square, row by row.",
      "Reject a covering that leaves a gap or stacks tiles.",
    ],
    [
      "A unit square has area 1 square unit.",
      "$n$ unit squares with no gaps or overlaps cover $n$ square units.",
    ],
  ),
  lesson(
    "area-tiling-clause-lesson",
    "Tiling, splitting, and cutting",
    "Counting the tiles in a rectangle matches multiplying the sides. An L-shaped figure can be cut into two rectangles.",
    [
      "tile-then-multiply",
      "split-tiled-count",
      "choose-the-split",
      "your-own-cut",
      "which-cut",
    ],
    [
      "Match a tile count to a product.",
      "Split a rectangle to show the distributive property, and cut an L into two rectangles.",
    ],
    [
      "Each row of a rectangle holds the same number of unit squares. The area is rows times that number.",
      "A split after $b$ columns shows $a \\times (b + c) = a \\times b + a \\times c$.",
    ],
    {
      prompt:
        "A rectangle has 4 rows of 6. Two rows are tiled. How many unit squares cover the whole rectangle?",
      steps: [
        "One row holds 6 squares.",
        "There are 4 rows, not only the 2 that are drawn.",
        "4 × 6 = 24.",
      ],
      answer: "24",
    },
    [
      "Multiply every row by the squares in one row.",
      "For a split, count each part, then match the product.",
      "For an L, cut from the inner corner and add the two rectangles.",
    ],
    ["Area counts squares. The product of the sides counts the same squares."],
  ),
  lesson(
    "area-exhibit-lesson",
    "Same perimeter or same area",
    "Rectangles can share a perimeter and differ in area, or share an area and differ in perimeter.",
    ["exhibit-same-perimeter", "exhibit-same-area"],
    [
      "Give a different rectangle with a given perimeter and find its area.",
      "Give a different rectangle with a given area and find its perimeter.",
    ],
    [
      "Half the perimeter is one length plus one width. Many pairs have the same sum and different products.",
      "One area has many factor pairs. Their perimeters need not match.",
    ],
    {
      prompt:
        "A rectangle is 2 cm by 8 cm. Give a different rectangle with the same perimeter.",
      steps: [
        "Half the perimeter is 2 + 8 = 10.",
        "4 + 6 = 10, and 4 by 6 is not 2 by 8 turned.",
        "The area is 4 × 6 = 24.",
      ],
      answer: "4 cm by 6 cm, area 24",
    },
    [
      "Keep the sum of the sides, or keep the product, as the question asks.",
      "Do not turn the same rectangle and call it new.",
    ],
    [
      "Same perimeter does not mean same area, and same area does not mean same perimeter.",
    ],
  ),
  lesson(
    "coordinate-vertex-plot-lesson",
    "Plot a polygon from coordinates",
    "Plot each vertex the coordinates name. For a rectangle, the missing vertex lines up with the other three.",
    ["plot-the-polygon", "missing-vertex"],
    [
      "Plot the vertices of a rectangle given by coordinates.",
      "Plot the missing vertex of a rectangle.",
    ],
    [
      "The first number moves left or right. The second moves up or down.",
      "An axis-aligned rectangle's missing corner shares one coordinate with each neighbor.",
    ],
    {
      prompt: "Plot $A(-3, 2)$, $B(4, 2)$, $C(4, -1)$, and $D(-3, -1)$.",
      steps: [
        "$A$ is 3 left and 2 up.",
        "$B$ is 4 right and 2 up. $C$ is 4 right and 1 down. $D$ is 3 left and 1 down.",
      ],
      answer: "The four vertices",
    },
    [
      "Read each pair as $(x, y)$.",
      "For a missing corner, copy $x$ from the vertical neighbor and $y$ from the horizontal neighbor.",
    ],
    ["Plotting the given vertices draws the polygon."],
  ),
  lesson(
    "solid-section-lesson",
    "Cross-sections and Cavalieri",
    "Matching cross-sections at every height give equal volumes. A slant does not change the layers.",
    ["cone-section-area", "cavalieri-coin-stack"],
    [
      "Find a cross-section area and a cone's volume.",
      "Find the volume of a slanted stack of coins.",
    ],
    [
      "Halfway from the apex, lengths are half and areas are a quarter.",
      "A cone has one third the volume of the prism or cylinder with the same base and height.",
    ],
    {
      prompt:
        "A pyramid has base area 60 and height 10. What is the cross-section area halfway up, and the volume of a cone with that base and height?",
      steps: [
        "The scale from the apex is 5/10 = 1/2.",
        "The cross-section has area 60 × (1/2)² = 15.",
        "The cone's volume is (1/3) × 60 × 10 = 200.",
      ],
      answer: "15, then 200",
    },
    [
      "Square the length scale before multiplying the area.",
      "Take one third of base area times height for a cone.",
      "A slanted stack keeps every layer.",
    ],
    ["Equal cross-sections at every height mean equal volumes."],
  ),
  lesson(
    "tilted-rectangle-lesson",
    "A tilted rectangle on the grid",
    "Adjacent sides of a rectangle are perpendicular. Their lengths come from the distance formula.",
    ["tilted-rectangle"],
    [
      "Find the area of a rectangle that is not aligned with the axes.",
      "Find the perimeter of that same tilted rectangle.",
    ],
    [
      "A direction $(p, q)$ and a turn $(-q, p)$ are perpendicular because their dot product is 0.",
      "The side lengths are whole multiples of the same square root. Multiply them for the area.",
    ],
    {
      prompt:
        "$A(0, 0)$, $B(4, 2)$, $C(3, 4)$, $D(-1, 2)$. Find the area and the perimeter.",
      steps: [
        "$AB = 2\\sqrt{5}$ and $AD = \\sqrt{5}$. Their directions $(4, 2)$ and $(-1, 2)$ have dot product 0.",
        "Area = $2\\sqrt{5} \\times \\sqrt{5} = 10$.",
        "Perimeter = $2(2\\sqrt{5} + \\sqrt{5}) = 6\\sqrt{5}$.",
      ],
      answer: "Area 10, perimeter $6\\sqrt{5}$",
    },
    [
      "Check the right angle with a dot product.",
      "Multiply the side lengths for the area, and double their sum for the perimeter.",
    ],
    ["The bounding box counts squares outside the tilted rectangle."],
  ),
];
