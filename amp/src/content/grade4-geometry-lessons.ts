import type { FacetMapping } from "./coverage";
import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

/**
 * Lessons, methods and principles for the grade-4 geometry types.
 * Choosing a ray stands in for sketching an angle: the lesson says so.
 */

export const grade4GeometryMethods: Record<string, ProblemMethod> = {
  "protractor-ray-choice": {
    goal: "Choose the ray that makes a given angle with the baseline on a protractor.",
    intuition:
      "A protractor has two rows of numbers. One row starts at 0 on the right. The other row starts at 0 on the left. The row that reads 0 on the baseline ray is the row to follow. The other row is the wrong scale: it shows the number you want on a different ray. Choosing that ray is not the same as drawing the angle yourself.",
    senses: { degrees: "degree-angle", scale: "measuring-scale" },
    noLink: ["part", "row"],
    terms: ["protractor", "ray", "angle", "degree-angle"],
    method: [
      "Find the baseline ray and the row of numbers that reads 0 on it.",
      "Follow that row to the degree the question names. The ray there is the one to choose.",
      "The other row reads that same number on a different ray. Leave that ray out.",
    ],
    watch:
      "The wrong-scale ray is always one of the choices. Check which row starts at 0 on the baseline before you choose.",
  },
  "adjacent-angle-equation": {
    goal: "Choose an equation that uses a symbol for an unknown angle measure.",
    intuition:
      "Two angles that sit side by side and do not overlap fill one whole angle. A symbol such as $x$ can stand for the angle whose measure you do not know yet. The known part and $x$ add up to the whole. Adding the whole and the known part makes a number bigger than the whole angle.",
    senses: { degree: "degree-angle", degrees: "degree-angle" },
    noLink: ["part", "whole", "side"],
    terms: ["angle", "equation", "adjacent-angles"],
    method: [
      "Name the whole angle and the known part. The unknown measure is $x$.",
      "Write $x$ plus the known part equal to the whole, or the whole minus the known part equal to $x$.",
      "Reject an equation that adds the whole and the known part, or that says $x$ is the whole angle.",
    ],
    watch:
      "The parts add up to the whole. They do not add up to something larger than the whole.",
  },
  "angle-benchmark-estimate": {
    goal: "Estimate a drawn angle by the nearest benchmark: 30°, 45°, 60°, 90° or 180°.",
    intuition:
      "Some angles are useful checkpoints: 30°, 45°, 60°, 90° and 180°. A right angle, 90°, is a square corner. A straight angle, 180°, is a straight line. You do not need the exact degree. You need the checkpoint this opening is nearest, and it should be clear.",
    senses: {
      degree: "degree-angle",
      degrees: "degree-angle",
      square: "square-shape",
    },
    noLink: ["change"],
    terms: ["angle", "right-angle", "straight-angle", "degree-angle"],
    method: [
      "Picture a square corner, 90°, and a straight line, 180°.",
      "Compare the opening with the checkpoints 30°, 45°, 60°, 90° and 180°.",
      "Choose the checkpoint it is nearest. It is within 10° of that one and farther from the others.",
    ],
    watch:
      "The drawing does not label the exact degree. Estimate. Do not try to read a number that is not there.",
  },
  "triangle-sides-angles-blanks": {
    goal: "Name a triangle by its equal sides and again by its angles.",
    intuition:
      "A triangle can be named two ways. By its sides: scalene means no two sides are equal, isosceles means exactly two sides are equal, and equilateral means all three sides are equal. By its angles: acute means every corner is narrower than a square corner, right means one corner is a square corner, and obtuse means one corner is wider than a square corner. When there is no square mark, the widest angle is labeled, and that measure is how you tell acute from obtuse. A right isosceles triangle has a square corner and exactly two equal sides.",
    senses: { side: "side", sides: "side", square: "square-shape" },
    noLink: ["sort", "exactly"],
    terms: [
      "triangle",
      "scalene",
      [
        "isosceles",
        "In these problems, isosceles means exactly two equal sides, so an equilateral triangle is not counted as isosceles.",
      ],
      "equilateral",
      "acute-angle",
      "right-angle",
      "obtuse-angle",
    ],
    method: [
      "Count the equal sides, using the lengths or the tick marks. No two equal means scalene. Exactly two equal means isosceles. All three equal means equilateral.",
      "Look at the largest corner. A square mark means a right triangle. If the widest angle is labeled, more than $90^\\circ$ means obtuse, and less than $90^\\circ$ means every angle is acute.",
      "Fill both blanks. The side name and the angle name answer different questions.",
    ],
    watch:
      "Isosceles here means exactly two equal sides. An equilateral triangle is named equilateral, not isosceles. Read the labeled measure of the widest angle. Do not judge that corner by eye.",
  },
  "quadrilateral-attributes": {
    goal: "Give the most exact name of a quadrilateral from its parallel sides, right angles and equal sides.",
    intuition:
      "A quadrilateral has 4 sides. Several names can fit one shape, and the most exact name is the one that says the most. A trapezoid has exactly one pair of parallel sides. A parallelogram has two pairs. A rectangle is a parallelogram with 4 right angles. A rhombus is a parallelogram with 4 equal sides and no right angle. A square has 4 right angles and 4 equal sides.",
    senses: { side: "side", sides: "side", square: "square-shape" },
    noLink: ["pair", "pairs", "exact"],
    terms: [
      "quadrilateral",
      "parallel",
      "trapezoid",
      "parallelogram",
      "rectangle",
      "rhombus",
      "square-shape",
      "right-angle",
    ],
    method: [
      "Count the pairs of parallel sides, shown by matching arrows.",
      "Count the right angles, shown by square corner marks, and check whether all 4 sides are equal.",
      "Pick the most exact name. A square is a rectangle and a rhombus, but square is the better name when both fit.",
    ],
    watch:
      "A rectangle that is not a square does not have 4 equal sides. A rhombus that is not a square does not have a right angle.",
  },
  "composite-rectangle-measure": {
    goal: "Find the area or the perimeter of a figure made of two rectangles.",
    intuition:
      "A figure made of two rectangles can be split along a dashed line. The dashed line is inside the figure, so it is not part of the walk around the outside. The perimeter is the sum of the outer sides. The area is the squares inside the bottom rectangle plus the squares inside the top rectangle. The marked corners are right angles. One inner corner bends the other way and is not a square corner.",
    senses: { square: "square-shape", squares: "square-shape" },
    noLink: ["part", "side", "sides"],
    terms: ["area", "perimeter", "rectangle", "right-angle"],
    method: [
      "Read every outer side. The dashed line is inside, so leave it out of the perimeter.",
      "For a perimeter, add the outer sides. The figure is as wide as its bottom and as tall as its left side, so another way is twice the sum of that width and that height.",
      "For an area, split along the dashed line into two rectangles, multiply each length by its width, and add. Do not count the shared edge twice.",
    ],
    watch:
      "The question asks for the area or the perimeter, not both. Adding the outer sides gives the perimeter, not the area.",
  },
  "rectangle-formula-select": {
    goal: "Select the expressions that equal a rectangle's perimeter, or the ones that equal its area.",
    intuition:
      "The length is the horizontal side and the width is the vertical side. The perimeter is the walk around all four sides: length plus width plus length plus width. That is the same as twice the length plus twice the width, and the same as twice the sum of the length and the width. The area is the squares inside: length times width, which is the same as width times length.",
    senses: { square: "square-shape", squares: "square-shape" },
    noLink: ["side"],
    terms: ["perimeter", "area", "rectangle", "length", "expression"],
    method: [
      "Read the length and the width on the rectangle.",
      "If the question asks for the perimeter, keep the writings that add all four sides. Length times width is the area, so leave it out.",
      "If the question asks for the area, keep length times width and width times length. Adding the sides gives the perimeter, so leave those writings out.",
    ],
    watch:
      "Length times width counts squares inside. It is not the walk around the sides.",
  },
};

export const grade4GeometryPrinciples: Record<string, string> = {
  "protractor-ray-choice":
    "On a protractor, follow the row of numbers that reads 0 on the baseline ray. The other row is a wrong scale: it shows the named degree on a different ray.",
  "adjacent-angle-equation":
    "When two angles do not overlap and fill a whole angle, the unknown measure $x$ and the known part add up to the whole. So $x$ plus the part equals the whole, and the whole minus the part equals $x$.",
  "angle-benchmark-estimate":
    "An angle can be estimated by the nearest of 30°, 45°, 60°, 90° and 180° when it is within 10° of that benchmark and farther from the others.",
  "triangle-sides-angles-blanks":
    "A triangle is scalene, isosceles or equilateral by how many sides are equal, and acute, right or obtuse by its angles. Here isosceles means exactly two equal sides. A square mark means a right triangle. When there is no square mark, the labeled widest angle decides: more than $90^\\circ$ is obtuse, and less than $90^\\circ$ is acute.",
  "quadrilateral-attributes":
    "The most exact name uses every mark: one pair of parallel sides is a trapezoid, two pairs is a parallelogram, 4 right angles make a rectangle, 4 equal sides with no right angle make a rhombus, and both together make a square.",
  "composite-rectangle-measure":
    "The area of a figure made of two rectangles is the sum of the two areas. The perimeter is the sum of the outer sides only. A line drawn inside the figure is not an outer side.",
  "rectangle-formula-select":
    "A rectangle's perimeter is the sum of its four sides, also written as twice the length plus twice the width, or twice the sum of the length and the width. Its area is length times width.",
};

export const grade4GeometryLessons: Lesson[] = [
  chainLesson({
    id: "grade4-angle-measure-lesson",
    title: "Angles on a protractor, in an equation, and by a benchmark",
    summary:
      "Follow the protractor row that starts at 0 on the baseline ray. Write an equation for an unknown angle that sits beside a known one. Estimate an opening by the nearest of 30°, 45°, 60°, 90° and 180°.",
    senses: { degrees: "degree-angle", square: "square-shape" },
    noLink: ["part", "whole", "row"],
    templateIds: [
      "protractor-ray-choice",
      "adjacent-angle-equation",
      "angle-benchmark-estimate",
    ],
    objectives: [
      "Choose the ray at a given angle by following the scale that starts at 0.",
      "Choose an equation for an unknown angle, and estimate an angle by a benchmark.",
    ],
    openingTitle: "Three ways to work with an angle",
    opening: [
      "A protractor shows two rows of numbers. One row starts at 0 on the right, and the other starts at 0 on the left. Use the row that reads 0 on the ray you are measuring from. Choosing the ray at a named degree stands in for sketching that angle. It is not the same as drawing the ray yourself.",
      "When two angles sit side by side and fill a bigger angle, a letter such as $x$ can stand for the one you do not know. The known part and $x$ add to the whole. Adding the whole and the part makes $x$ too big.",
      "You can also estimate. The checkpoints are 30°, 45°, 60°, 90° and 180°. A square corner is 90°. A straight line is 180°. Pick the checkpoint the opening is nearest.",
    ],
    example: {
      prompt:
        "Ray $BA$ lies on the baseline, on the right, where the inner row reads 0. Which ray makes a $50^\\circ$ angle with ray $BA$?",
      steps: [
        "The inner row is the one that reads 0 on ray $BA$, so follow the inner row.",
        "The inner row reads 50 on one ray. That ray makes a $50^\\circ$ angle with ray $BA$.",
        "The outer row also has a 50, but it sits on a different ray. That ray is the wrong scale. Leave it out.",
      ],
      answer: "The ray where the inner row reads 50",
    },
    methodTitle: "Scale, equation, then estimate",
    method: [
      "On a protractor, follow the row that reads 0 on the baseline. Ignore the same number on the other row.",
      "For an unknown angle $x$ beside a known part, write $x$ plus the part equal to the whole, or the whole minus the part equal to $x$.",
      "To estimate, choose the nearest of 30°, 45°, 60°, 90° and 180°.",
    ],
    formalTitle: "What the three tasks use",
    formal: [
      "The two rows on a protractor run in opposite directions. Only the row that starts at 0 on your baseline measures the angle you were asked for.",
      "Adjacent angles that do not overlap add to the whole angle they make. An equation can record that fact with a symbol for the unknown measure.",
      "A benchmark estimate is the nearest of 30°, 45°, 60°, 90° and 180° when the opening is within 10° of that benchmark and farther from the rest.",
    ],
    pitfalls: [
      "Reading the protractor row that does not start at 0 on the baseline.",
      "Adding the whole angle and the known part to find the unknown part.",
      "Treating an estimate as an exact degree the drawing never labels.",
    ],
    parentGuide:
      "Ask which protractor row starts at 0 on the baseline ray before your learner picks a ray. Then ask whether an equation adds the parts or adds the whole to a part.",
  }),
  chainLesson({
    id: "grade4-shape-marks-lesson",
    title: "Triangles and quadrilaterals from their marks",
    summary:
      "Name a triangle by its equal sides and again by its angles. Name a quadrilateral by the most exact fit: trapezoid, parallelogram, rectangle, rhombus or square.",
    senses: { side: "side", square: "square-shape" },
    noLink: ["pair", "sort"],
    templateIds: ["triangle-sides-angles-blanks", "quadrilateral-attributes"],
    objectives: [
      "Fill both a side name and an angle name for one triangle.",
      "Choose the most exact quadrilateral name from parallel sides, right angles and equal sides.",
    ],
    openingTitle: "Marks tell you the name",
    opening: [
      "Tick marks show equal sides. A small square shows a right angle, a square corner. Matching arrows show parallel sides, sides that go the same way and never meet.",
      "For a triangle, count the equal sides and read the angle marks. Scalene means no two sides are equal. Isosceles means exactly two. Equilateral means all three. A square mark means a right triangle. When there is no square mark, the widest angle is labeled. More than $90^\\circ$ means obtuse. Less than $90^\\circ$ means every angle is acute.",
      "For a quadrilateral, use the most exact name. One pair of parallel sides is a trapezoid. Two pairs is a parallelogram. Four right angles make a rectangle. Four equal sides and no right angle make a rhombus. Four right angles and four equal sides make a square.",
    ],
    example: {
      prompt:
        "A triangle has two equal sides. No corner has a square mark, and the widest angle is labeled $118^\\circ$. What are its two names?",
      steps: [
        "Exactly two sides are equal, so by its sides it is isosceles. It is not equilateral, because the third side is different.",
        "There is no square mark. The widest angle is $118^\\circ$, more than $90^\\circ$, so the triangle is obtuse.",
        "Both names belong: an obtuse isosceles triangle. A square mark, when the figure has one, is what makes the angle name right.",
      ],
      answer: "Isosceles and obtuse",
    },
    methodTitle: "Sides, then angles, then the most exact name",
    method: [
      "Count equal sides first. Then read the square mark or the labeled widest angle.",
      "On a quadrilateral, count parallel pairs, right angles and equal sides.",
      "If two names both fit, choose the one that uses more of the marks. Square is more exact than rectangle or rhombus when both the right angles and the equal sides are there.",
    ],
    formalTitle: "Names from marks",
    formal: [
      "Side names and angle names are separate. A right triangle can be scalene or isosceles. Here isosceles means exactly two equal sides. A labeled widest angle above $90^\\circ$ means obtuse, and one below $90^\\circ$ means acute.",
      "Trapezoid means exactly one pair of parallel sides. Rectangle, rhombus and square are special parallelograms. Square is the name to use when the shape has both 4 right angles and 4 equal sides.",
    ],
    pitfalls: [
      "Calling an equilateral triangle isosceles. Here isosceles means exactly two equal sides.",
      "Deciding acute or obtuse by how a corner looks, when the widest angle is labeled.",
      "Stopping at parallelogram when the marks also show 4 right angles or 4 equal sides.",
      "Naming a rhombus a square when it has no right angle.",
    ],
    parentGuide:
      "Before your learner says a name, ask which marks are on the figure: matching tick marks, square corners, parallel arrows, and the measure of a labeled angle when one is there.",
  }),
  chainLesson({
    id: "grade4-rectangle-measures-lesson",
    title: "Perimeter and area of rectangles, including joined ones",
    summary:
      "The perimeter of a rectangle is the walk around its four sides. The area is the squares inside. A figure made of two rectangles uses the same ideas: add outer sides for the perimeter, and add the two areas for the area.",
    senses: { square: "square-shape" },
    noLink: ["side", "part"],
    templateIds: ["composite-rectangle-measure", "rectangle-formula-select"],
    objectives: [
      "Find the area or the perimeter of a figure made of two rectangles with every outer side labeled.",
      "Select the expressions that equal a rectangle's perimeter, or the ones that equal its area.",
    ],
    openingTitle: "Around the outside, or the squares inside",
    opening: [
      "The perimeter is how far you walk around the outside. You add every outer side once. A dashed line drawn inside a figure is not part of that walk.",
      "The area is the squares inside. Split a figure made of two rectangles along the dashed line, find each area, and add. The two rectangles must not share any squares.",
      "For one rectangle, the length is the horizontal side and the width is the vertical side. Adding all four sides, adding twice the length and twice the width, and doubling the sum of the length and the width all give the perimeter. Length times width gives the area.",
    ],
    example: {
      prompt:
        "A rectangle is 6 centimeters long and 4 centimeters wide. Which expressions equal the perimeter?",
      steps: [
        "The four sides are 6, 4, 6 and 4. Their sum is 20.",
        "Twice the length plus twice the width is $2 \\times 6 + 2 \\times 4 = 20$. Twice the sum of the length and the width is $2 \\times (6 + 4) = 20$.",
        "Length times width is $6 \\times 4 = 24$. That is the area, the squares inside, so it is not a perimeter expression.",
      ],
      answer: "The three writings that equal 20",
    },
    methodTitle: "Outer sides, then the two rectangles",
    method: [
      "For a perimeter, add only the outer sides. Leave out a line that stays inside the figure.",
      "For an area of joined rectangles, multiply for each rectangle and add.",
      "For one rectangle, match the expression to the question: a sum of sides is the perimeter, and a product of the sides is the area.",
    ],
    formalTitle: "The rectangle formulas",
    formal: [
      "If the length is the horizontal side and the width is the vertical side, the perimeter is the sum of the four sides. Twice the length plus twice the width is the same sum, and so is twice the sum of the length and the width.",
      "The area is length times width. A figure made of two rectangles has area equal to the sum of those two areas, and perimeter equal to the sum of the sides on the outside.",
    ],
    pitfalls: [
      "Using length times width when the question asks for the perimeter.",
      "Adding a dashed inside line into the perimeter.",
      "Counting the overlap twice when the two rectangles share an edge.",
    ],
    parentGuide:
      "Ask whether the question wants the walk around the outside or the squares inside before your learner picks an expression or adds the labels.",
  }),
];

export const grade4GeometryFacetMappings: FacetMapping[] = [
  {
    templateId: "protractor-ray-choice",
    facetId: "angle-measure.protractor",
    extent: "partial",
    rationale:
      "Choosing which drawn ray makes a given whole-degree angle with the baseline, including the wrong-scale ray at 180° minus that measure. This is a selection stand-in for sketching the angle. It does not assess drawing the ray.",
  },
  {
    templateId: "adjacent-angle-equation",
    facetId: "angle-measure.additive",
    extent: "partial",
    rationale:
      "Choosing an equation with a symbol for an unknown adjacent angle, either the unknown plus the known part equals the whole or the whole minus the part equals the unknown. A distractor adds the whole and the part. It does not ask the learner to compute the measure.",
  },
  {
    templateId: "angle-benchmark-estimate",
    facetId: "angle-measure.benchmarks",
    extent: "partial",
    rationale:
      "Choosing the nearest of the benchmarks 30°, 45°, 60°, 90° and 180° for a drawn angle within 10° of that benchmark and farther from the others. The exact degree is not labeled.",
  },
  {
    templateId: "triangle-sides-angles-blanks",
    facetId: "lines-symmetry.lines-angles",
    extent: "partial",
    rationale:
      "Two blanks name one drawn triangle by equal sides and by angles, including a right isosceles triangle. A square mark shows a right angle. When there is no square mark, the widest angle is labeled, and that measure decides acute or obtuse. Isosceles means exactly two equal sides. It does not assess drawing the triangle.",
  },
  {
    templateId: "quadrilateral-attributes",
    facetId: "lines-symmetry.lines-angles",
    extent: "partial",
    rationale:
      "The most exact name among trapezoid, parallelogram, rectangle, rhombus and square, from parallel sides, right angles and equal sides. It does not move the grade-3 naming items, and it does not ask for every fitting name at once.",
  },
  {
    templateId: "composite-rectangle-measure",
    facetId: "area-perimeter-models.composite-formulas",
    extent: "partial",
    rationale:
      "The area or the perimeter of a figure made of two rectangles, with every outer side labeled. The perimeter is asked on most items. A dashed inside line is not an outer side.",
  },
  {
    templateId: "rectangle-formula-select",
    facetId: "area-perimeter-models.composite-formulas",
    extent: "partial",
    rationale:
      "Selecting the expressions that equal a rectangle's perimeter, including the sum of the four sides, twice the length plus twice the width, and twice the sum of the length and the width, or the expressions that equal its area. Length times width is a distractor when the question asks for the perimeter.",
  },
];
