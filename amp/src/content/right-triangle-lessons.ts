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
    goal: "A right triangle's two legs are given. Find the length of its hypotenuse, the longest side.",
    intuition:
      "A triangle is a flat shape with three straight sides. A right triangle has one square corner, called a right angle: a quarter-turn, 90 degrees. Its legs are the two sides that meet there. The hypotenuse is the longest side, across from that corner. Squaring a number means multiplying it by itself, shown by a small raised 2: $6^2 = 6 \\times 6 = 36$. The square root goes back: $\\sqrt{36}$ is the number that times itself makes 36, which is 6. In every right triangle, the two legs squared and added give the hypotenuse squared.",
    terms: [
      ...terms,
      [
        "square root",
        "The nonnegative number whose square is the given number: √36 = 6.",
      ],
    ],
    method: [
      "Use the same length unit for both legs, such as cm (centimeters). Let $a$ and $b$ be the leg lengths and $c$ the hypotenuse length.",
      "Square each leg length and add: $c^2 = a^2 + b^2$.",
      "Take the positive square root to find $c$, because a length cannot be negative.",
      "Check: square your answer and compare it with $a^2 + b^2$. They should be equal. Give the answer in the length unit.",
    ],
    watch:
      "Add the squares, not the leg lengths. The hypotenuse is across from the right angle, even when the triangle is turned.",
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
      "Use one length unit. Let $c$ be the hypotenuse length, a the known leg length, and $x$ the missing leg length.",
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
      "Use the same unit for all three lengths. Name the longest length $c$ and the other lengths $a$ and $b$.",
      "Calculate a² + b² and c² separately.",
      "If they are equal, the converse of the Pythagorean theorem guarantees a right triangle. If they differ, the Pythagorean theorem rules out a right triangle.",
    ],
    watch:
      "The longest side is not necessarily listed last. Do not call it a hypotenuse until a right angle is established.",
  },
};
export const rightTrianglePrinciples: Record<string, string> = {
  "right-triangle":
    "Pythagorean theorem (a proved rule): in a right triangle, let $a$ and $b$ be the leg lengths and $c$ the hypotenuse length. Use the same unit for all three. Then $a^2 + b^2 = c^2$.",
  "right-triangle-missing-leg":
    "Subtracting the same quantity from both sides preserves equality. Thus a² + x² = c² gives x² = c² − a²; a side length is the positive square root.",
  "pythagorean-converse":
    "For a triangle with longest side length $c$ and other side lengths $a$ and $b$, all in one unit, a² + b² = c² if and only if the triangle has a right angle opposite $c$.",
};

const triangleDefinitions: Lesson["sections"][number] = {
  title: "Triangle, right angle, legs, hypotenuse",
  paragraphs: [
    "A triangle is a closed flat shape with three straight sides. Two sides meet at each corner, called a vertex. An angle is the amount of turn between two sides that meet at a vertex. Angles are measured in degrees, written with a small circle: one full turn is 360 degrees, written 360°. A quarter-turn is 360 ÷ 4 = 90°, and it is called a right angle. A square is a flat shape with four equal sides and four right angles.",
    "The abbreviation cm means centimeters, a unit of length. A right triangle is a triangle with one right angle. The two sides that meet at the right angle are called the legs. They are perpendicular, which means they meet at 90°. The third side, across from the right angle, is called the hypotenuse. It is always the longest side. A small square drawn in a corner marks a right angle; it is not a length.",
    "Turning or flipping a triangle changes neither its side lengths nor its angles. So find the hypotenuse by looking for the right angle, not by whether a side looks slanted, flat or upright.",
  ],
};
const squareDefinitions: Lesson["sections"][number] = {
  title: "A squared length represents an area",
  paragraphs: [
    "To square a number means to multiply it by itself. A small raised 2 shows this: $6^2 = 6 \\times 6 = 36$, read 6 squared. Squaring is not doubling, which means multiplying by 2: doubling 6 gives $2 \\times 6 = 12$.",
    "Area is the amount of flat surface a shape covers. A square centimeter is the area of a square that is 1 cm long on each side. A square with 6 cm sides holds 6 rows of 6 such squares, so its area is 36 square centimeters, written 36 cm². Its side is still 6 cm long, not 36 cm.",
    "Measure all three sides of the triangle in the same unit. Let $a$ and $b$ stand for the lengths of the legs, and $c$ for the length of the hypotenuse. The squares built on those sides then have areas $a^2$, $b^2$ and $c^2$, in square units.",
  ],
};
const relationship: Lesson["sections"][number] = {
  title: "The Pythagorean relationship",
  paragraphs: [
    "In every right triangle, the square on the hypotenuse has the same area as the squares on the two legs put together. In symbols, $a^2 + b^2 = c^2$. A theorem is a math statement that has been proved true by careful reasoning, not just checked on a few examples. This one is called the Pythagorean theorem, after Pythagoras, a mathematician of ancient Greece.",
    "For legs 6 cm and 8 cm, the leg squares have areas 36 cm² and 64 cm². Together they cover 36 + 64 = 100 cm². So the square on the hypotenuse also has area 100 cm². We still need its side length, which is the hypotenuse itself.",
  ],
};
const roots: Lesson["sections"][number] = {
  title: "From the square back to its side",
  paragraphs: [
    "A square root undoes squaring. The symbol $\\sqrt{100}$ means the number, zero or greater, whose square is 100. Since 10 × 10 = 100, $\\sqrt{100} = 10$. It is also true that $(-10) \\times (-10) = 100$. But a side of a triangle cannot have a negative length, so use the positive value.",
    "Finish the addition under the root sign before taking the root: $\\sqrt{36 + 64} = \\sqrt{100} = 10$. Taking each root first and then adding would give 6 + 8 = 14. But $14^2 = 196$, not 100, so that is wrong. The root applies to the whole total.",
    "Not every square root is a whole number (0, 1, 2, 3 and so on). Legs of 1 cm and 1 cm give $c^2 = 1^2 + 1^2 = 2$, so the hypotenuse is $\\sqrt{2}$ cm long. That length is between 1 cm and 2 cm, because $1^2 = 1$ is less than 2 and $2^2 = 4$ is more. Leave it as $\\sqrt{2}$, its exact value. A rounded decimal such as 1.41 is only close, because 1.41 × 1.41 = 1.9881, not 2. Write one only when a question asks for an approximate (close, not exact) answer.",
  ],
};

export const pythagoreanLesson: Lesson = {
  id: "pythagorean-theorem",
  title: "Find the hypotenuse of a right triangle",
  summary:
    "A triangle is a flat shape with three straight sides. A right triangle has one square corner, called a right angle. The two sides that meet at that corner are the legs. The longest side, across from the corner, is the hypotenuse. Draw a square (a shape with four equal sides and four square corners) on each side. The two leg squares together cover the same area, or amount of flat surface, as the hypotenuse square.",
  templateIds: ["right-triangle"],
  includeGeneratedRepresentation: false,
  objectives: [
    "Find the legs and the hypotenuse of a right triangle, however it is turned.",
    "Explain, by rearranging equal pieces, why the two leg squares match the hypotenuse square.",
    "Find a hypotenuse length and check it.",
  ],
  sections: [
    {
      stage: "intuition",
      title: "Before calculating",
      paragraphs: [
        "The abbreviation cm means centimeters, a unit of length. Picture a right triangle with legs 3 cm and 4 cm long. On each side, build a square that uses that side as one of its edges. A square is a shape with four equal sides and four square corners.",
        "Area is the amount of flat surface a shape covers. It is counted in square centimeters: one square centimeter is a small square 1 cm long on each side. The square on the 3 cm leg holds 3 rows of 3 of these small squares. So its area is 3 × 3 = 9 square centimeters. The square on the 4 cm leg has area 4 × 4 = 16 square centimeters. Together the two leg squares cover 9 + 16 = 25 square centimeters.",
        "The square on the hypotenuse covers exactly the same area: 25 square centimeters. Its side must be a number that, times itself, makes 25. That number is 5, so the hypotenuse is 5 cm long. This works for every right triangle, and the lesson shows why.",
        "Two symbols make this quicker to write. Multiplying a number by itself is called squaring it, and a small raised 2 shows it: $5^2$ (5 squared) means 5 × 5 = 25. Going back from 25 to 5 is called taking the square root. The square root of a number is the number that, times itself, gives it, written with a root sign: $\\sqrt{25} = 5$. A negative number works too, since $(-5) \\times (-5) = 25$. But a length is positive (greater than 0), so for a length always use the positive square root.",
      ],
    },
    { ...triangleDefinitions, illustration: "right-triangle-orientation" },
    squareDefinitions,
    relationship,
    {
      title: "Why rearranging the pieces proves the relationship",
      paragraphs: [
        "Here is why the theorem holds for every right triangle. Take two large squares, each with sides $a + b$ long, so they have the same area. Place four copies of the same right triangle inside each one, arranged two different ways. Sliding or turning a piece does not change its area. In each large square, the uncovered area is the large square minus the four triangles. The large squares are equal and the triangles are equal, so the uncovered areas are equal too.",
        "In the first arrangement, the uncovered middle shape has four sides, each of length $c$, because each one is a triangle's hypotenuse. Its corners are right angles. Here is why. A triangle's three angles always add to 180°. One angle is 90°, so the other two add to 90°. At each corner of the middle shape, those two angles and the uncovered corner sit along one straight edge. A straight edge makes a straight angle, a half-turn of 180°. So the uncovered corner is 180° − 90° = 90°. The middle shape is a square, with area $c^2$.",
        "In the second arrangement, the uncovered parts are two squares, with sides $a$ and $b$. Their total area is $a^2 + b^2$. The uncovered areas are equal, so $c^2 = a^2 + b^2$. Nothing here used particular numbers, so the argument works for any right triangle.",
        "In the picture, $a = 3$ and $b = 4$. Each large square has side 7 and area 7 × 7 = 49. A rectangle is a four-sided shape with four right angles. Each triangle is half of a 3-by-4 rectangle, whose area is 3 × 4 = 12, so the triangle's area is 12 ÷ 2 = 6. Four triangles cover 24. Either way, $49 - 24 = 25$ is left uncovered: one 5-by-5 square, or a 3-by-3 square and a 4-by-4 square together (9 + 16 = 25).",
      ],
      illustration: "pythagorean-rearrangement",
    },
    roots,
  ],
  workedExample: {
    prompt:
      "A right triangle has legs of 6 cm and 8 cm. Find its hypotenuse length.",
    steps: [
      "The legs, 6 cm and 8 cm, meet at the right angle. Let $c$ be the length of the hypotenuse in centimeters. It is the side across from the right angle.",
      "Use the Pythagorean theorem. A theorem is a math rule that has been proved, and this one is the square rule for right triangles: $6^2 + 8^2 = c^2$.",
      "Square each leg: $6^2 = 6 \\times 6 = 36$ and $8^2 = 8 \\times 8 = 64$. These are the areas of the squares on the legs.",
      "Add the two squares: $c^2 = 36 + 64 = 100$. This is the area of the square on the hypotenuse.",
      "Take the positive square root to get the side length: $c = \\sqrt{100} = 10$, since 10 × 10 = 100.",
      "Check: $10^2 = 100$ and $6^2 + 8^2 = 100$. The hypotenuse, 10 cm, is longer than either leg, as it must be.",
    ],
    answer: "10",
    answerUnit: "centimeters",
  },
  closingSections: [
    {
      stage: "formal",
      title: "The precise rule",
      paragraphs: [rightTrianglePrinciples["right-triangle"]!],
    },
  ],
  pitfalls: [
    "The rule $a^2 + b^2 = c^2$ works only for right triangles, with $c$ across from the right angle. Knowing two side lengths does not tell you that a triangle has a right angle.",
    "Square each leg separately, then add. $(6 + 8)^2 = 196$, but $6^2 + 8^2 = 100$.",
    "The sum (total) of the squares is the hypotenuse's square, not the hypotenuse. Take its positive square root, and report centimeters, not square centimeters.",
  ],
  parentGuide:
    "Cut out four identical right triangles. Arrange them inside one square as in the first picture, then rearrange the same four as in the second. Ask which areas stay equal and why. Then turn one triangle and ask the learner to find its hypotenuse from the right-angle mark.",
};

export const missingLegLesson: Lesson = {
  id: "right-triangle-missing-leg",
  title: "Find a missing leg of a right triangle",
  summary:
    "In a right triangle, two sides meet at its square corner; these are the legs. The opposite, longest side is the hypotenuse. Its square matches the two leg squares together. Subtract the known leg's square to find the missing leg's square, then take the positive length whose square is that result.",
  templateIds: ["right-triangle-missing-leg"],
  objectives: [
    "Distinguish a known hypotenuse from a known leg.",
    "Use subtraction and a positive square root to find the other leg.",
  ],
  sections: [
    {
      stage: "intuition",
      title: "What you will use",
      paragraphs: [
        "In a right triangle, the two legs meet at the square corner and the hypotenuse lies opposite it. The hypotenuse is longest. Its square is the total area of the two leg squares, so subtract the known leg's square to find the missing leg's square.",
        "Keep all lengths in the same unit. A side length is positive, so take the positive square root of the area you find.",
      ],
    },
    {
      ...triangleDefinitions,
      paragraphs: triangleDefinitions.paragraphs.slice(0, 2),
      illustration: "right-triangle-orientation",
    },
    {
      ...squareDefinitions,
      paragraphs: squareDefinitions.paragraphs.slice(0, 2),
    },
    {
      title: "The hypotenuse square is the whole",
      paragraphs: [
        "In every right triangle, the square on the hypotenuse has the same area as the two leg squares together. This is the Pythagorean theorem. A theorem is a mathematical statement established by reasoning.",
        "When the hypotenuse is known, its square gives the whole area. The known leg square supplies one part. Subtract that part from the whole to find the area of the missing leg square.",
      ],
    },
    {
      title: "Remove the known part",
      paragraphs: [
        "Suppose the hypotenuse is 13 cm and one leg is 5 cm. Let \\($x$\\) stand for the other leg's length in centimeters. The two leg squares together equal the hypotenuse square: x² + 5² = 13².",
        "The hypotenuse square has area 169 cm². One leg square has area 25 cm². The other leg square supplies the rest: 169 − 25 = 144 cm². In the equation, subtract the same number from both sides to preserve equality: x² + 25 − 25 = 169 − 25, so x² = 144.",
        "A square root is the nonnegative number (zero or greater) whose square is a given number. Since 12 × 12 = 144, √144 = 12. A side has positive length, so x = 12 and the missing side is 12 cm long. The value −12 also squares to 144, but it cannot be a side length.",
        "This is subtraction because the hypotenuse square is the total and one leg square is a known part. Adding 169 and 25 would find a larger total instead of the missing part. Subtract the squares, not the lengths: 13 − 5 = 8, and 8² + 5² = 89, not 169.",
      ],
    },
    {
      title: "Either leg can be unknown",
      paragraphs: [
        "The letters are names for lengths, not fixed positions on the page. With hypotenuse \\($c$\\), known leg \\($a$\\), and missing leg \\($x$\\), use x² = c² − a². The hypotenuse must exceed the known leg, so the difference is positive.",
        "A root need not be a whole number. A hypotenuse of 3 cm and leg of 1 cm give x² = 9 − 1 = 8 and x = √8. The missing side is √8 cm long. Keep this exact form unless asked to round. Check any proposed length by squaring it and restoring the original sum.",
      ],
    },
  ],
  workedExample: {
    prompt:
      "A right triangle has a hypotenuse of 13 cm and one leg of 5 cm. Find the other leg.",
    steps: [
      "Let \\($x$\\) be the missing leg length in centimeters. The hypotenuse is 13 cm, so x² + 5² = 13².",
      "Calculate 5² = 25 and 13² = 169: x² + 25 = 169.",
      "Subtract 25 from both sides: x² = 169 − 25 = 144.",
      "Take the positive square root: x = √144 = 12, since 12 × 12 = 144.",
      "Check: 12² + 5² = 144 + 25 = 169 = 13². The leg 12 cm is shorter than the hypotenuse 13 cm.",
    ],
    answer: "12",
    answerUnit: "centimeters",
  },
  closingSections: [
    {
      stage: "formal",
      title: "The precise rule",
      paragraphs: [rightTrianglePrinciples["right-triangle-missing-leg"]!],
    },
  ],
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
      stage: "intuition",
      title: "Begin with a triangle",
      paragraphs: [
        "A right triangle has a square corner. The side opposite it is the longest. To tell whether a triangle is right from its side lengths, compare the square of the longest length with the sum of the other two squares.",
        "The question gives a triangle with all lengths in one unit. For proposed lengths, first check that the shorter two add to more than the longest; otherwise they cannot enclose a triangle.",
      ],
    },
    { ...triangleDefinitions, illustration: "right-triangle-orientation" },
    {
      title: "Compare squares of lengths",
      paragraphs: [
        "Squaring means multiplying a number by itself: 5² = 5 × 5 = 25. Let \\($c$\\) name the longest numerical side length and \\($a$\\) and \\($b$\\) the other two, all measured in one unit. Calculate a² + b² and c² separately.",
        "The Pythagorean theorem says that every right triangle satisfies a² + b² = c². Therefore, if these two results differ, the given triangle is not right. For lengths 4 cm, 5 cm, and 6 cm, compare 4² + 5² = 16 + 25 = 41 with 6² = 36. Since 41 ≠ 36, there is no right angle.",
        "The converse says that if a triangle satisfies a² + b² = c², then it has a right angle opposite its longest side. A converse exchanges a statement's condition and conclusion. It needs justification: reversing a true statement does not automatically produce another true statement.",
      ],
    },
    {
      title: "Why equality guarantees a right angle",
      paragraphs: [
        "Construct a separate right triangle with legs of lengths \\($a$\\) and \\($b$\\). Call its hypotenuse length \\($h$\\). The Pythagorean theorem gives h² = a² + b². If the original triangle satisfies a² + b² = c², then h² = c². Because \\($h$\\) and \\($c$\\) are positive lengths, h = c.",
        "The constructed right triangle and the original triangle now have the same three side lengths. Three fixed side lengths determine a triangle's angles: a circle consists of points at a fixed distance, called its radius, from a point called its center. Fix one side as a base. A vertex at the required distances from the base endpoints must lie on both circles centered at those endpoints, with radii equal to the other two side lengths. Two distinct circles intersect at no more than two points. For a triangle, the two possible meeting points lie on opposite sides of the base and are mirror images. Thus the triangles have equal corresponding angles. This fact is called side-side-side congruence; congruent figures have the same shape and size. The original triangle therefore has the constructed triangle's right angle.",
      ],
    },
    {
      title: "Equality is the test",
      paragraphs: [
        "For lengths 13 cm, 5 cm, and 12 cm, the longest is 13 cm even though it is listed first. Compare 5² + 12² = 25 + 144 = 169 with 13² = 169. They are equal, so the triangle is right.",
        "Unequal results can occur in either direction. For 4 cm, 5 cm, and 6 cm, the sum 41 exceeds 36. For 2 cm, 3 cm, and 4 cm, the sum 4 + 9 = 13 is below 16. Both triangles are not right. The test asks for equality, not which result is greater.",
        "Do not use \\($c$\\) as a name for an arbitrary listed side. In a right triangle the hypotenuse is the longest, so only the longest side can occupy that role in the test. Until the equality is established, call it the longest side rather than a hypotenuse.",
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
  closingSections: [
    {
      stage: "formal",
      title: "The precise rule",
      paragraphs: [rightTrianglePrinciples["pythagorean-converse"]!],
    },
  ],
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
