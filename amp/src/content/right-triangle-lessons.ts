import type { MethodTerm } from "../glossary/types";
import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

const terms: MethodTerm[] = [
  "right-angle",
  "leg",
  "hypotenuse",
  "square-number",
];
export const rightTriangleMethods: Record<string, ProblemMethod> = {
  "right-triangle": {
    goal: "A right triangle's two legs are given. Find the length of its hypotenuse, the longest side.",
    senses: {
      side: "side",
      square: "square-number",
      degrees: "degree-angle",
      unit: "unit",
      "right side": "side-of-equation",
    },
    noLink: ["rule", "opposite"],
    intuition:
      "A triangle is a flat shape with three straight sides. A right triangle has one corner shaped like the corner of a page, called a right angle: a quarter-turn, 90 degrees. Its legs are the two sides that meet there. The hypotenuse is the longest side, across from that corner. Squaring a number means multiplying it by itself, shown by a small raised 2: $6^2 = 6 \\times 6 = 36$. The square root goes back: $\\sqrt{36}$ is the number that times itself makes 36, which is 6. In every right triangle, the two legs squared and added give the hypotenuse squared.",
    terms: [...terms, "square-root"],
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
    goal: "A right triangle's hypotenuse (longest side) and one leg are given. Find the length of its other leg.",
    senses: {
      side: "side",
      square: "square-number",
      squares: "square-number",
      degrees: "degree-angle",
      unit: "unit",
      difference: "difference-subtract",
    },
    noLink: ["rule", "opposite"],
    intuition:
      "A right triangle has one corner shaped like the corner of a page, called a right angle. Turns are measured in degrees, the unit for angles, and a right angle is 90 degrees. Its legs are the two sides that meet there, and the hypotenuse is the longest side, across from that corner. Squaring means multiplying a number by itself: $5^2 = 5 \\times 5 = 25$. In every right triangle, the two leg squares add up to the hypotenuse square. So when the hypotenuse is known, subtract the known leg's square from the hypotenuse's square to get the missing leg's square.",
    terms: [...terms, "square-root"],
    method: [
      "Use one length unit. Let $c$ be the hypotenuse length, $a$ the known leg length, and $x$ the missing leg length.",
      "The leg squares add to the hypotenuse square: $x^2 + a^2 = c^2$. Subtract $a^2$ from both sides: $x^2 = c^2 - a^2$.",
      "Work out the difference, then take its positive square root, the positive number that times itself gives it.",
      "Check that $x^2 + a^2 = c^2$, and give the length unit.",
    ],
    watch:
      "Subtract the known leg's square from the hypotenuse's square. The missing leg must be shorter than the hypotenuse.",
  },
  "pythagorean-converse": {
    goal: "The three side lengths of a triangle are given. Decide whether it has a right angle, a square corner.",
    senses: {
      side: "side",
      square: "square-number",
      squares: "square-number",
      degrees: "degree-angle",
      unit: "unit",
    },
    noLink: ["rule", "opposite"],
    intuition:
      "Turns are measured in degrees, the unit for angles. A right angle is a corner like the corner of a page, a quarter-turn of 90 degrees. “Squared” means multiplied by itself: $5^2$, read “5 squared”, is 5 × 5 = 25. In a right triangle, the squares of the two shorter sides add up to the square of the longest side. The reverse is also true: if they add up exactly, the triangle has a right angle. So compare the two results.",
    terms: [...terms, "converse"],
    method: [
      "Use the same unit for all three lengths. Name the longest length $c$ and the other two $a$ and $b$.",
      "Work out $a^2 + b^2$ and $c^2$ separately.",
      "If they are equal, the triangle has a right angle, across from the longest side. If they differ, it has no right angle.",
    ],
    watch:
      "The longest side is not necessarily listed last. Do not call it a hypotenuse until a right angle is established.",
  },
};
export const rightTrianglePrinciples: Record<string, string> = {
  "right-triangle":
    "Pythagorean theorem (a proved rule): in a right triangle, let $a$ and $b$ be the leg lengths and $c$ the hypotenuse length. Use the same unit for all three. Then $a^2 + b^2 = c^2$.",
  "right-triangle-missing-leg":
    "Subtracting the same amount from both sides keeps an equation true. So $a^2 + x^2 = c^2$ gives $x^2 = c^2 - a^2$. A side length is the positive square root: $x = \\sqrt{c^2 - a^2}$.",
  "pythagorean-converse":
    "For a triangle with longest side length $c$ and other side lengths $a$ and $b$, all in one unit: if $a^2 + b^2 = c^2$, the triangle has a right angle across from $c$. If not, it has no right angle.",
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
  senses: {
    square: "square-shape",
    squared: "square-number",
    squaring: "square-number",
    squares: "square-shape",
    root: "root-radical",
    side: "side",
    degrees: "degree-angle",
    unit: "unit",
    vertex: "vertex",
  },
  noLink: ["argument", "change", "parts", "rule", "changes", "third", "whole"],
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
        "The abbreviation cm means centimeters, a unit of length. Picture a right triangle with legs 3 cm and 4 cm long. On each side, build a square that uses that side as one of its own sides. A square is a shape with four equal sides and four square corners.",
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
        "In the first arrangement, the uncovered middle shape has four sides, each of length $c$, because each one is a triangle's hypotenuse. Its corners are right angles. Here is why. A triangle's three angles always add to 180°. One angle is 90°, so the other two add to 90°. At each corner of the middle shape, those two angles and the uncovered corner sit along one straight line. A straight line makes a straight angle, a half-turn of 180°. So the uncovered corner is 180° − 90° = 90°. The middle shape is a square, with area $c^2$.",
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
      "Multiply each leg length by itself: $6^2 = 6 \\times 6 = 36$ and $8^2 = 8 \\times 8 = 64$. These are the areas of the squares on the legs.",
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
    "Multiply each leg by itself separately, then add. $(6 + 8)^2 = 196$, but $6^2 + 8^2 = 100$.",
    "The sum (total) of the squares is the hypotenuse's square, not the hypotenuse. Take its positive square root, and report centimeters, not square centimeters.",
  ],
  parentGuide:
    "Cut out four identical right triangles. Arrange them inside one square as in the first picture, then rearrange the same four as in the second. Ask which areas stay equal and why. Then turn one triangle and ask the learner to find its hypotenuse from the right-angle mark.",
};

export const missingLegLesson: Lesson = {
  id: "right-triangle-missing-leg",
  title: "Find a missing leg of a right triangle",
  summary:
    "A right triangle has one corner shaped like the corner of a page, called a right angle. The two sides that meet there are the legs. The longest side, across from the corner, is the hypotenuse. Draw a square (a shape with four equal sides and four square corners) on each side. The square on the hypotenuse has the same area, or amount of flat surface, as the two leg squares together. So if you know the hypotenuse and one leg, subtract to find the other leg's square. Then find the positive number that times itself gives that square.",
  templateIds: ["right-triangle-missing-leg"],
  senses: {
    difference: "difference-subtract",
    degrees: "degree-angle",
    side: "side",
    squared: "square-number",
    squaring: "square-number",
    square: "square-shape",
    squares: "square-shape",
    unit: "unit",
    vertex: "vertex",
  },
  noLink: ["parts", "part", "whole", "rule", "third", "opposite", "root"],
  objectives: [
    "Tell whether a given length is the hypotenuse or a leg.",
    "Use subtraction and a positive square root to find the other leg.",
  ],
  sections: [
    {
      stage: "intuition",
      title: "What you will use",
      paragraphs: [
        "A right angle is a quarter-turn. Turns are measured in degrees, the unit for angles, so a right angle is 90 degrees. Picture a right triangle with a hypotenuse of 5 cm and one leg of 3 cm. Build a square on each side. Area is the amount of flat surface a shape covers. The square on the hypotenuse has area 5 × 5 = 25 square centimeters. The square on the known leg has area 3 × 3 = 9.",
        "In every right triangle, the two leg squares together cover exactly the hypotenuse square. So the missing leg's square is what is left: 25 − 9 = 16 square centimeters. Its side is the number that times itself makes 16, which is 4. The missing leg is 4 cm long.",
        "Two symbols make this quicker. Squaring means multiplying a number by itself, and a small raised 2 shows it: $4^2 = 4 \\times 4 = 16$. Going back is called taking the square root, written with a root sign: $\\sqrt{16} = 4$. A side length is positive, so use the positive square root. Keep all lengths in the same unit.",
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
        "In every right triangle, the square on the hypotenuse has the same area as the two leg squares together. A theorem is a math statement proved true by careful reasoning, and this one is called the Pythagorean theorem.",
        "When the hypotenuse is known, its square gives the whole area. The known leg square is one part. Subtract that part from the whole to find the area of the missing leg square.",
      ],
    },
    {
      title: "Remove the known part",
      paragraphs: [
        "Suppose the hypotenuse is 13 cm and one leg is 5 cm. Let $x$ stand for the other leg's length in centimeters. The two leg squares together equal the hypotenuse square: $x^2 + 5^2 = 13^2$.",
        "The hypotenuse square has area $13^2 = 169$ cm². One leg square has area $5^2 = 25$ cm². The other leg square is the rest: 169 − 25 = 144 cm². In the equation, subtract 25 on the left and on the right of the equals sign, so the two sides stay equal: $x^2 + 25 - 25 = 169 - 25$, so $x^2 = 144$.",
        "The root sign means the square root that is zero or greater: $\\sqrt{144}$ is the number, zero or greater, whose square is 144. Since 12 × 12 = 144, $\\sqrt{144} = 12$. A side has positive length, so $x = 12$ and the missing side is 12 cm long. The value −12 also squares to 144, but it cannot be a side length.",
        "This is subtraction because the hypotenuse square is the total and one leg square is a known part. Adding 169 and 25 would give a bigger total, not the missing part. Subtract the squares, not the lengths: 13 − 5 = 8, and $8^2 + 5^2 = 89$, not 169.",
      ],
    },
    {
      title: "Either leg can be unknown",
      paragraphs: [
        "The letters are names for lengths, not fixed places on the page. With hypotenuse $c$, known leg $a$ and missing leg $x$, use $x^2 = c^2 - a^2$. The hypotenuse is longer than the known leg, so this difference is positive.",
        "A square root need not be a whole number. A hypotenuse of 3 cm and a leg of 1 cm give $x^2 = 9 - 1 = 8$, so $x = \\sqrt{8}$. The missing side is $\\sqrt{8}$ cm long, a little less than 3 cm. Keep this exact form unless the question asks you to round. Check any answer by squaring it and adding the known leg's square.",
      ],
    },
  ],
  workedExample: {
    prompt:
      "A right triangle has a hypotenuse of 13 cm and one leg of 5 cm. Find the other leg.",
    steps: [
      "The 13 cm side is the hypotenuse, the longest side, and 5 cm is a leg. Let $x$ be the missing leg length in centimeters. The two leg squares add to the hypotenuse square: $x^2 + 5^2 = 13^2$.",
      "Work out the known squares: $5^2 = 5 \\times 5 = 25$ and $13^2 = 13 \\times 13 = 169$. So $x^2 + 25 = 169$.",
      "Subtract 25 on the left and on the right of the equals sign, so $x^2$ stands alone and the sides stay equal: $x^2 = 169 - 25 = 144$.",
      "Take the positive square root, because a length is positive: $x = \\sqrt{144} = 12$, since 12 × 12 = 144.",
      "Check: $12^2 + 5^2 = 144 + 25 = 169 = 13^2$. The leg, 12 cm, is shorter than the hypotenuse, 13 cm, as it must be.",
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
    "Find the hypotenuse, the side across from the right angle, before choosing to add or subtract.",
    "Subtract the squared lengths, then take the square root of the difference.",
    "A side length must be positive. A difference of zero would not give a triangle.",
  ],
  parentGuide:
    "Give a hypotenuse of 10 cm and a leg of 6 cm. Ask the learner to explain which square is the whole and which is the known part, then verify the missing length of 8 cm by substitution.",
};

export const converseLesson: Lesson = {
  id: "pythagorean-converse",
  title: "Recognize a right triangle from its side lengths",
  summary:
    "A right angle is a square corner. You can tell whether a triangle has one from its three side lengths alone. Square each length, which means multiply it by itself. Add the squares of the two shorter sides. If the total equals the square of the longest side, the triangle has a right angle. For sides 5, 12 and 13: 25 + 144 = 169, and 13 × 13 = 169, so it does.",
  templateIds: ["pythagorean-converse"],
  senses: {
    "more than": "more-than",
    degrees: "degree-angle",
    side: "side",
    sides: "side",
    squared: "square-number",
    squaring: "square-number",
    square: "square-number",
    squares: "square-number",
    unit: "unit",
    vertex: "vertex",
    radius: "radius",
  },
  noLink: [
    "changes",
    "part",
    "center",
    "base",
    "images",
    "rule",
    "third",
    "opposite",
    "whole",
  ],
  objectives: [
    "Find the longest side, whatever order the lengths are listed in.",
    "Compare squared lengths to decide whether a triangle has a right angle.",
    "Explain why equal squares guarantee a right angle.",
  ],
  sections: [
    {
      stage: "intuition",
      title: "Begin with a triangle",
      paragraphs: [
        "Turns are measured in degrees, the unit for angles. A right triangle is a triangle with one square corner, called a right angle: a quarter-turn, 90 degrees. The side across from that corner is the longest. Squaring a number means multiplying it by itself, shown by a small raised 2: $5^2 = 5 \\times 5 = 25$.",
        "To tell whether a triangle is right from its side lengths, compare two numbers. One is the square of the longest length. The other is the two shorter lengths squared and added. For 3, 4 and 5 cm: $3^2 + 4^2 = 9 + 16 = 25$ and $5^2 = 25$. They match, so the triangle has a right angle.",
        "All lengths must use one unit. For lengths you make up, first check that the two shorter ones add to more than the longest; otherwise they cannot close up into a triangle.",
      ],
    },
    { ...triangleDefinitions, illustration: "right-triangle-orientation" },
    {
      title: "Compare squares of lengths",
      paragraphs: [
        "Squaring means multiplying a number by itself: $5^2 = 5 \\times 5 = 25$. Let $c$ be the longest side length and $a$ and $b$ the other two, all in one unit. Work out $a^2 + b^2$ and $c^2$ separately.",
        "A theorem is a math statement proved true by reasoning. One theorem, called the Pythagorean theorem, says that every right triangle has $a^2 + b^2 = c^2$. So if the two results differ, the triangle is not right. For lengths 4 cm, 5 cm and 6 cm, compare $4^2 + 5^2 = 16 + 25 = 41$ with $6^2 = 36$. The sign $\\ne$ means “is not equal to”. Since $41 \\ne 36$, there is no right angle.",
        "The converse goes the other way: if a triangle has $a^2 + b^2 = c^2$, then it has a right angle across from its longest side. A converse swaps a statement's “if” part and “then” part. It needs its own reason, because reversing a true statement does not always give a true statement.",
      ],
    },
    {
      title: "Why equality guarantees a right angle",
      paragraphs: [
        "Build a separate right triangle with legs of lengths $a$ and $b$. Call its hypotenuse length $h$. The Pythagorean theorem gives $h^2 = a^2 + b^2$. If the original triangle has $a^2 + b^2 = c^2$, then $h^2 = c^2$. Both $h$ and $c$ are positive lengths, so $h = c$.",
        "The new right triangle and the original triangle now have the same three side lengths. Three side lengths fix a triangle's angles. Here is why. A circle is all the points at a fixed distance, called its radius, from one point, called its center.",
        "Lay one side down as a base. The third corner, or vertex, must be at the right distance from each end of the base. So it lies on two circles, one centered at each end, with radii equal to the other two side lengths. Two different circles cross at no more than two points. Those two points are mirror images across the base, so either one gives the same angles.",
        "Figures with the same shape and size are called congruent, and this fact is called side-side-side congruence. So the two triangles have equal matching angles, and the original triangle has the new triangle's right angle.",
      ],
    },
    {
      title: "Equality is the test",
      paragraphs: [
        "For lengths 13 cm, 5 cm and 12 cm, the longest is 13 cm even though it is listed first. Compare $5^2 + 12^2 = 25 + 144 = 169$ with $13^2 = 169$. They are equal, so the triangle is right.",
        "Unequal results can go either way. For 4 cm, 5 cm and 6 cm, the sum 41 is more than 36. For 2 cm, 3 cm and 4 cm, the sum 4 + 9 = 13 is less than 16. Neither triangle is right. The test asks whether they are equal, not which is greater.",
        "Do not use $c$ for whichever side is listed last. The hypotenuse of a right triangle (the side across from the right angle) is always the longest, so only the longest side can play that part. Until the squares are shown equal, call it the longest side, not a hypotenuse.",
      ],
    },
  ],
  workedExample: {
    prompt:
      "A triangle has side lengths 13 cm, 5 cm, and 12 cm. Is it a right triangle?",
    steps: [
      "Find the longest side first, because only it can be across from a right angle: 13 cm, even though it is listed first.",
      "Square the two shorter lengths, multiplying each by itself, and add: $5^2 = 25$ and $12^2 = 144$, so $25 + 144 = 169$.",
      "Square the longest length: $13^2 = 13 \\times 13 = 169$.",
      "The results are equal: $5^2 + 12^2 = 13^2$. When the squares match like this, the triangle has a right angle, across from the 13 cm side.",
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
    "Three positive numbers need not be the sides of a triangle. The two shorter lengths must add to more than the longest.",
  ],
  parentGuide:
    "Compare triangles with lengths 3, 4, 5 and 3, 4, 6 in one unit. Ask the learner to identify the longest side, calculate both results, and explain why only the first triangle is right. A sketch's appearance is not proof.",
};

export const rightTriangleLessons: Lesson[] = [
  pythagoreanLesson,
  missingLegLesson,
  converseLesson,
];
