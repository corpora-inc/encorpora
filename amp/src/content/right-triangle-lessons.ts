import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

const terms: [string, string][] = [
  [
    "right angle",
    "A quarter-turn, measuring 90°; the angle at a square's corner.",
  ],
  ["legs", "The two sides of a right triangle that meet at its right angle."],
  ["hypotenuse", "The side opposite the right angle; it is the longest side."],
  ["square", "To square a number, multiply it by itself: 6² = 6 × 6 = 36."],
];
export const rightTriangleMethods: Record<string, ProblemMethod> = {
  "right-triangle": {
    goal: "Given both legs of a right triangle, find its hypotenuse length.",
    terms: [
      ...terms,
      [
        "square root",
        "The nonnegative number whose square is the given number: √36 = 6.",
      ],
    ],
    method: [
      "Use the same length unit for both legs. Let a and b be their lengths and c the hypotenuse length.",
      "Square each leg length and add: c² = a² + b².",
      "Take the positive square root to find c. Square the result to check the equation, and report a length unit.",
    ],
    watch:
      "Add the squares, not the leg lengths. The hypotenuse is opposite the right angle even when the triangle is rotated.",
  },
  "right-triangle-missing-leg": {
    goal: "Given a right triangle's hypotenuse and one leg, find its other leg.",
    terms: [
      ...terms,
      [
        "square root",
        "The nonnegative number whose square is the given number: √36 = 6.",
      ],
    ],
    method: [
      "Use one length unit. Let c be the hypotenuse length, a the known leg length, and x the missing leg length.",
      "Write x² + a² = c². Subtract a² from both sides: x² = c² − a².",
      "Calculate the difference, then take its positive square root. Check x² + a² = c² and report the length unit.",
    ],
    watch:
      "Subtract the known leg's square from the hypotenuse's square. The missing leg must be shorter than the hypotenuse.",
  },
  "pythagorean-converse": {
    goal: "Given the three side lengths of a triangle, decide whether it has a right angle.",
    terms: [
      ...terms,
      [
        "converse",
        "A statement formed by exchanging a condition and its conclusion; its truth needs its own justification.",
      ],
    ],
    method: [
      "Use the same unit for all three lengths. Name the longest length c and the other lengths a and b.",
      "Calculate a² + b² and c² separately.",
      "If they are equal, the converse of the Pythagorean theorem guarantees a right triangle. If they differ, the Pythagorean theorem rules out a right triangle.",
    ],
    watch:
      "The longest side is not necessarily listed last. Do not call it a hypotenuse until a right angle is established.",
  },
};
export const rightTrianglePrinciples: Record<string, string> = {
  "right-triangle":
    "Pythagorean theorem: if a and b are the leg lengths and c is the hypotenuse length of a right triangle in the same unit, a² + b² = c².",
  "right-triangle-missing-leg":
    "Subtracting the same quantity from both sides preserves equality. Thus a² + x² = c² gives x² = c² − a²; a side length is the positive square root.",
  "pythagorean-converse":
    "For a triangle with longest side length c and other side lengths a and b, all in one unit, a² + b² = c² if and only if the triangle has a right angle opposite c.",
};

const triangleDefinitions: Lesson["sections"][number] = {
  title: "Triangle, right angle, legs, hypotenuse",
  paragraphs: [
    "A triangle is a closed flat shape with three straight sides. Two sides meet at each corner, called a vertex. An angle measures the turn from one side to the other at a vertex. One full turn measures 360 degrees, written 360°. A quarter-turn measures 90° and is called a right angle. A square is a flat shape with four equal sides and four right angles.",
    "The abbreviation cm means centimeters, a unit of length. A right triangle has a right angle. Its two sides that meet at that angle are the legs. They are perpendicular: they meet at 90°. The third side, opposite the right angle, is the hypotenuse. It is the longest side. The small square drawn at a corner marks a right angle; it is not a measurement of side length.",
    "Turning or flipping a triangle changes neither its lengths nor its angles. Identify the hypotenuse by the right angle, not by whether a side looks slanted, horizontal, or vertical.",
  ],
};
const squareDefinitions: Lesson["sections"][number] = {
  title: "A squared length represents an area",
  paragraphs: [
    "To square a number means to multiply it by itself. The raised 2 records that operation: 6² = 6 × 6 = 36. Squaring 6 does not mean doubling it; 2 × 6 = 12.",
    "A square is a flat shape with four equal sides and four right angles. Its area measures how much surface it covers. A square centimeter is the area of a square measuring 1 cm on each side. A square with side 6 cm contains 6 rows of 6 such squares, so its area is 36 square centimeters, written 36 cm². Its side length is 6 cm, not 36 cm.",
    "Measure all triangle sides in the same unit. Let a and b stand for the numerical lengths of its legs and c for the numerical length of its hypotenuse. The squares built on these sides have numerical areas a², b², and c² in the corresponding square unit.",
  ],
};
const relationship: Lesson["sections"][number] = {
  title: "The Pythagorean relationship",
  paragraphs: [
    "In every right triangle, the square on the hypotenuse has the same area as the squares on the two legs together. This statement is the Pythagorean theorem: a² + b² = c². A theorem is a mathematical statement established by reasoning, not merely by checking a few examples.",
    "For legs 6 cm and 8 cm, the leg squares have areas 36 cm² and 64 cm². Their combined area is 100 cm². The hypotenuse square therefore has area 100 cm². We must still find its side length.",
  ],
};
const roots: Lesson["sections"][number] = {
  title: "From the square back to its side",
  paragraphs: [
    "A square root reverses squaring for nonnegative numbers: numbers that are zero or greater. The symbol √100 means the nonnegative number whose square is 100. Since 10 × 10 = 100, √100 = 10. The equation x² = 100 also has the number −10 as a solution, but a triangle cannot have a negative side length. Use the positive value for a side.",
    "First finish the addition under the root: √(36 + 64) = √100 = 10. Taking separate roots and adding would give 6 + 8 = 14, whose square is 196, not 100. The root covers the entire sum.",
    "Not every square root is a whole number. Legs of 1 cm and 1 cm give a hypotenuse of √2 cm. This is an exact length between 1 cm and 2 cm because 1² = 1 is less than 2, while 2² = 4 is greater than 2. Do not replace an exact root by a rounded decimal unless a question asks for an approximation.",
  ],
};

export const pythagoreanLesson: Lesson = {
  id: "pythagorean-theorem",
  title: "Find the hypotenuse of a right triangle",
  summary:
    "Use equal areas to understand why the two leg squares determine the longest side.",
  templateIds: ["right-triangle"],
  objectives: [
    "Identify a right triangle's legs and hypotenuse in any orientation.",
    "Explain the square relationship by rearranging equal pieces.",
    "Find and check a hypotenuse length.",
  ],
  sections: [
    {
      title: "Before calculating",
      paragraphs: [
        "You will add and multiply whole numbers and measure lengths in one unit.",
        "For example, 6 × 8 means six groups of eight, totaling 48. This lesson explains the angle, area, square, and square-root ideas used to find a missing side.",
      ],
    },
    { ...triangleDefinitions, illustration: "right-triangle-orientation" },
    squareDefinitions,
    relationship,
    {
      title: "Why rearranging the pieces proves the relationship",
      paragraphs: [
        "Compare two squares with the same side length a + b. Each contains four copies of the same right triangle. Sliding or turning a piece preserves its area. Remove these four triangles from each outer square. Because the whole areas are equal and the removed areas are equal, the uncovered areas must be equal.",
        "In the first arrangement, the uncovered middle shape has four sides of length c: each is a triangle's hypotenuse. Its corners are right angles. To see why, a triangle's three angles total 180°, so the two angles other than its 90° angle total 90°. At each middle corner those two angles and the uncovered angle together make a straight angle of 180°. The uncovered angle is therefore 180° − 90° = 90°. Thus the middle shape is a square, with area c².",
        "In the second arrangement, the uncovered shapes are squares with side lengths a and b, so their total area is a² + b². Equal uncovered areas give c² = a² + b². The arrangement works for any positive leg lengths a and b; it does not depend on the example's numbers.",
        "In the pictured example, a = 3 and b = 4, so each outer square has side 7 and area 49. Each triangle is half of a 3-by-4 rectangle, with area 12 ÷ 2 = 6. Four triangles cover 24. Either arrangement leaves 49 − 24 = 25: a 5-by-5 square, or a 3-by-3 square and a 4-by-4 square together.",
      ],
      illustration: "pythagorean-rearrangement",
    },
    roots,
  ],
  workedExample: {
    prompt:
      "A right triangle has legs of 6 cm and 8 cm. Find its hypotenuse length.",
    steps: [
      "The legs meet at the right angle. Let c be the hypotenuse length in centimeters, opposite that angle.",
      "Write the Pythagorean relationship: 6² + 8² = c².",
      "Square each leg length: 6² = 6 × 6 = 36 and 8² = 8 × 8 = 64.",
      "Add the two squares: c² = 36 + 64 = 100.",
      "Find the positive square root: c = √100 = 10, since 10 × 10 = 100.",
      "Check the relationship: 10² = 100 and 6² + 8² = 100. The hypotenuse is longer than either leg, as it must be.",
    ],
    answer: "10",
    answerUnit: "centimeters",
  },
  pitfalls: [
    "The equation a² + b² = c² requires a right triangle, with c opposite the right angle. Two given side lengths alone do not establish a right angle.",
    "Square each leg separately. (6 + 8)² = 196, whereas 6² + 8² = 100.",
    "The sum of the squares gives the square of the missing length. Take its positive square root and report centimeters, not square centimeters.",
  ],
  parentGuide:
    "Cut out four identical right triangles and rearrange them inside two equal squares as shown. Ask which areas stay equal and why. Rotate one triangle and ask the learner to identify its hypotenuse from the right-angle marker.",
};

export const missingLegLesson: Lesson = {
  id: "right-triangle-missing-leg",
  title: "Find a missing leg of a right triangle",
  summary:
    "Subtract the known leg's square from the hypotenuse's square, then recover the missing length.",
  templateIds: ["right-triangle-missing-leg"],
  objectives: [
    "Distinguish a known hypotenuse from a known leg.",
    "Use subtraction and a positive square root to find the other leg.",
  ],
  sections: [
    {
      title: "What you will use",
      paragraphs: [
        "You will add, subtract, and multiply whole numbers. Use the same unit for all lengths.",
        "For example, 1 meter and 30 centimeters must be converted to 100 centimeters and 30 centimeters before their numerical lengths are squared.",
      ],
    },
    { ...triangleDefinitions, illustration: "right-triangle-orientation" },
    squareDefinitions,
    relationship,
    {
      title: "Remove the known part",
      paragraphs: [
        "Suppose the hypotenuse is 13 cm and one leg is 5 cm. Let x stand for the other leg's length in centimeters. The two leg squares together equal the hypotenuse square: x² + 5² = 13².",
        "The hypotenuse square has area 169 cm². One leg square has area 25 cm². The other leg square supplies the rest: 169 − 25 = 144 cm². In the equation, subtract the same number from both sides to preserve equality: x² + 25 − 25 = 169 − 25, so x² = 144.",
        "A square root is the nonnegative number (zero or greater) whose square is a given number. Since 12 × 12 = 144, √144 = 12. A side has positive length, so x = 12 and the missing side is 12 cm long. The value −12 also squares to 144, but it cannot be a side length.",
        "This is subtraction because the hypotenuse square is the total and one leg square is a known part. Adding 169 and 25 would find a larger total instead of the missing part. Subtract the squares, not the lengths: 13 − 5 = 8, and 8² + 5² = 89, not 169.",
      ],
    },
    {
      title: "Either leg can be unknown",
      paragraphs: [
        "The letters are names for lengths, not fixed positions on the page. With hypotenuse c, known leg a, and missing leg x, use x² = c² − a². The hypotenuse must exceed the known leg, so the difference is positive.",
        "A root need not be a whole number. A hypotenuse of 3 cm and leg of 1 cm give x² = 9 − 1 = 8 and x = √8. The missing side is √8 cm long. Keep this exact form unless asked to round. Check any proposed length by squaring it and restoring the original sum.",
      ],
    },
  ],
  workedExample: {
    prompt:
      "A right triangle has a hypotenuse of 13 cm and one leg of 5 cm. Find the other leg.",
    steps: [
      "Let x be the missing leg length in centimeters. The hypotenuse is 13 cm, so x² + 5² = 13².",
      "Calculate 5² = 25 and 13² = 169: x² + 25 = 169.",
      "Subtract 25 from both sides: x² = 169 − 25 = 144.",
      "Take the positive square root: x = √144 = 12, since 12 × 12 = 144.",
      "Check: 12² + 5² = 144 + 25 = 169 = 13². The leg 12 cm is shorter than the hypotenuse 13 cm.",
    ],
    answer: "12",
    answerUnit: "centimeters",
  },
  pitfalls: [
    "Identify the hypotenuse before choosing addition or subtraction.",
    "Subtract squared lengths, then take the square root of the difference.",
    "A side length must be positive. A zero difference would not give a triangle.",
  ],
  parentGuide:
    "Give a hypotenuse of 10 cm and a leg of 6 cm. Ask the learner to explain which square is the whole and which is the known part, then verify the missing length of 8 cm by substitution.",
};

export const converseLesson: Lesson = {
  id: "pythagorean-converse",
  title: "Recognize a right triangle from its side lengths",
  summary:
    "A comparison of three squares determines whether a triangle has a right angle.",
  templateIds: ["pythagorean-converse"],
  objectives: [
    "Find the longest side regardless of listing order.",
    "Use equality of squared lengths to identify right triangles.",
    "Explain why the converse is justified.",
  ],
  sections: [
    {
      title: "Begin with a triangle",
      paragraphs: [
        "You will compare, add, and multiply positive numbers. The question gives side lengths of an existing triangle in the same unit.",
        "If instead you are given three proposed lengths, first check that the two shorter lengths add to more than the longest. For example, 2 cm, 3 cm, and 5 cm cannot enclose a triangle: the two shorter segments only reach the endpoints of the longest when laid straight.",
      ],
    },
    { ...triangleDefinitions, illustration: "right-triangle-orientation" },
    {
      title: "Compare squares of lengths",
      paragraphs: [
        "Squaring means multiplying a number by itself: 5² = 5 × 5 = 25. Let c name the longest numerical side length and a and b the other two, all measured in one unit. Calculate a² + b² and c² separately.",
        "The Pythagorean theorem says that every right triangle satisfies a² + b² = c². Therefore, if these two results differ, the given triangle is not right. For lengths 4 cm, 5 cm, and 6 cm, compare 4² + 5² = 16 + 25 = 41 with 6² = 36. Since 41 ≠ 36, there is no right angle.",
        "The converse says that if a triangle satisfies a² + b² = c², then it has a right angle opposite its longest side. A converse exchanges a statement's condition and conclusion. It needs justification: reversing a true statement does not automatically produce another true statement.",
      ],
    },
    {
      title: "Why equality guarantees a right angle",
      paragraphs: [
        "Construct a separate right triangle with legs of lengths a and b. Call its hypotenuse length h. The Pythagorean theorem gives h² = a² + b². If the original triangle satisfies a² + b² = c², then h² = c². Because h and c are positive lengths, h = c.",
        "The constructed right triangle and the original triangle now have the same three side lengths. Three fixed side lengths determine a triangle's angles: a circle consists of points at a fixed distance, called its radius, from a point called its center. Fix one side as a base. A vertex at the required distances from the base endpoints must lie on both circles centered at those endpoints, with radii equal to the other two side lengths. The possible meeting points lie on opposite sides of the base and are mirror images. Thus the triangles have equal corresponding angles. This fact is called side-side-side congruence; congruent figures have the same shape and size. The original triangle therefore has the constructed triangle's right angle.",
      ],
    },
    {
      title: "Equality is the test",
      paragraphs: [
        "For lengths 13 cm, 5 cm, and 12 cm, the longest is 13 cm even though it is listed first. Compare 5² + 12² = 25 + 144 = 169 with 13² = 169. They are equal, so the triangle is right.",
        "Unequal results can occur in either direction. For 4 cm, 5 cm, and 6 cm, the sum 41 exceeds 36. For 2 cm, 3 cm, and 4 cm, the sum 4 + 9 = 13 is below 16. Both triangles are not right. The test asks for equality, not which result is greater.",
        "Do not use c as a name for an arbitrary listed side. In a right triangle the hypotenuse is the longest, so only the longest side can occupy that role in the test. Until the equality is established, call it the longest side rather than a hypotenuse.",
      ],
    },
  ],
  workedExample: {
    prompt:
      "A triangle has side lengths 13 cm, 5 cm, and 12 cm. Is it a right triangle?",
    steps: [
      "The longest side is 13 cm. Compare its square with the sum of the other two squares.",
      "Square the other lengths: 5² = 25 and 12² = 144. Add: 25 + 144 = 169.",
      "Square the longest length: 13² = 169.",
      "The results are equal: 5² + 12² = 13². By the converse of the Pythagorean theorem, the triangle has a right angle opposite the 13 cm side.",
    ],
    answer: "Right triangle",
  },
  pitfalls: [
    "Use the longest length for the square on its own, regardless of listing order.",
    "Compare exact values. Nearly equal squares do not prove an exactly right angle.",
    "Three positive numbers need not be triangle side lengths. The sum of the two shorter lengths must exceed the longest.",
  ],
  parentGuide:
    "Compare triangles with lengths 3, 4, 5 and 3, 4, 6 in one unit. Ask the learner to identify the longest side, calculate both results, and explain why only the first triangle is right. A sketch's appearance is not proof.",
};

export const rightTriangleLessons: Lesson[] = [
  pythagoreanLesson,
  missingLegLesson,
  converseLesson,
];
