import type { FacetMapping } from "./coverage";
import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

/**
 * Lessons, methods and principles for explaining a proof of the Pythagorean
 * theorem and of its converse (8.G.B.6). The learner checks every decision a
 * written explanation is made of; writing the proof in their own words is
 * practiced away from the screen.
 */

const shapeSenses = {
  side: "side",
  sides: "side",
  square: "square-shape",
  squares: "square-shape",
};
const numberSenses = {
  side: "side",
  sides: "side",
  square: "square-number",
  squares: "square-number",
};

export const pythagoreanProofsMethods: Record<string, ProblemMethod> = {
  "pythagorean-proof-area": {
    goal: "Four copies of a right triangle fill the corners of a square. Find the area the triangles leave uncovered.",
    intuition:
      "A right triangle has one square corner, called a right angle. Its legs are the two sides that make that corner. Area is the number of unit squares a shape covers. Put four copies of the triangle inside a square whose side is the two legs added together. The part the triangles do not cover is the leftover area. Slide the triangles around inside the square and the leftover area stays the same.",
    senses: shapeSenses,
    terms: ["right-triangle", "leg", "area"],
    method: [
      "The big square's side is the two legs added, so its area is that sum times itself.",
      "Each triangle is half of a rectangle whose sides are the legs. So four triangles cover twice the legs multiplied together.",
      "Subtract the four triangles from the big square. Check: the leftover equals the two leg lengths squared and added.",
    ],
    watch:
      "Take away all four triangles. The whole square, the four triangles and the side length are not the leftover area.",
  },
  "pythagorean-proof-figure": {
    goal: "Read the rearrangement picture: choose the equation it records, or the reason one of its steps is true.",
    intuition:
      "In the picture, four copies of a right triangle sit in a square of side $a + b$. The letters $a$ and $b$ stand for the legs, the two sides that make the right angle. The letter $c$ stands for the hypotenuse, the longest side, across from the right angle. One area can be counted as a whole or as its parts, and both counts must agree. The middle shape also needs a reason to be a square, because equal sides alone are not enough.",
    senses: shapeSenses,
    noLink: ["parts"],
    terms: ["leg", "hypotenuse", "area", "acute-angle", "straight-angle"],
    method: [
      "Count the big square two ways: as one square, $(a + b)^2$ ($a + b$ times itself), and as four triangles of area $\\tfrac{1}{2}ab$ plus the middle square, $c^2$.",
      "When the triangles move, the big square and the triangles stay the same, so the leftover area stays the same.",
      "A middle corner sits on a straight side beside two acute angles, angles smaller than a right angle, that add to $90^\\circ$. So the corner is $180^\\circ - 90^\\circ = 90^\\circ$.",
    ],
    watch:
      "A reason must say why a step works. Never use $a^2 + b^2 = c^2$ as a reason: it is the result being proved.",
  },
  "pythagorean-proof-steps": {
    goal: "Put the steps of the rearrangement proof in order, or fill its blanks, so each step follows from the one before.",
    intuition:
      "A proof is a chain of statements. Each statement is shown from the ones before it, until the chain reaches the result. In this proof, $a$ and $b$ are the legs of a right triangle, the two sides that make the right angle, and $c$ is its hypotenuse, the longest side. The proof builds a picture first, then finds one area in two ways, then sets the two answers equal.",
    senses: shapeSenses,
    noLink: ["parts"],
    terms: ["leg", "hypotenuse", "area"],
    method: [
      "Start with the step that builds the picture: four triangles in a square of side $a + b$.",
      "Then find the area in two ways, by rearranging or by counting the parts, and set the two answers equal.",
      "End with $a^2 + b^2 = c^2$. Leave out a statement that measures one drawing or uses $a^2 + b^2 = c^2$ before it is proved.",
    ],
    watch:
      "A step can only use what came before it. Comparing two areas has to wait until both have been found.",
  },
  "pythagorean-proof-flaw": {
    goal: "Find the step that breaks an argument for the Pythagorean theorem, and say what is wrong with it.",
    intuition:
      "The Pythagorean theorem says that in every right triangle, the two legs squared and added equal the hypotenuse squared. Squared means multiplied by itself. An argument proves it only if it works for every right triangle and every step has a reason. A step that is assumed instead of shown breaks the argument, even when the last line is true.",
    senses: shapeSenses,
    terms: ["pythagorean-theorem", "leg", "hypotenuse", "square-number"],
    method: [
      "Read the steps one at a time and ask whether each one was shown or only assumed.",
      "Check the usual gaps: one example used for every triangle, the result used as its own reason, a square never shown to have right angles, a triangle area of $ab$, or $(a + b)^2$ written as $a^2 + b^2$.",
      "Choose the answer that names the gap and the true fact that fills it.",
    ],
    watch:
      "A confident argument can still be wrong. Do not choose “nothing is wrong” until every step has a reason.",
  },
  "pythagorean-converse-proof": {
    goal: "Work with the converse of the Pythagorean theorem: state it, read a hinge, or find the flaw in an argument that uses it.",
    intuition:
      "The Pythagorean theorem says: if a triangle has a right angle, the two shorter sides squared and added equal the longest side squared. Squared means multiplied by itself. The converse swaps the if-part and the then-part: if $a^2 + b^2 = c^2$, the triangle has a right angle across from $c$. Picture two rods joined at a hinge. The wider the hinge opens, the longer the third side gets. So only one opening, the right angle, gives a third side of exactly $c$.",
    senses: numberSenses,
    noLink: ["part", "parts"],
    terms: ["converse", "pythagorean-theorem", "square-number", "right-angle"],
    method: [
      "To form the converse, swap the if-part and the then-part of the theorem.",
      "Use the longest side as $c$. Compare $a^2 + b^2$ with $c^2$, squares and not the sides themselves.",
      "On a hinge, a third side longer than $c$ means an angle wider than $90^\\circ$, and a shorter one means a narrower angle.",
    ],
    watch:
      "Do not start from the right angle when it is what you must show. Square the longest side on its own.",
  },
  "pythagorean-converse-blanks": {
    goal: "Complete the proof of the converse: build a right triangle with the same legs, then compare the two triangles.",
    intuition:
      "Two triangles are congruent when they have the same size and shape, so every side and every angle matches. Three side lengths fix a triangle: two triangles with the same three side lengths are congruent. The square root of a number, written with $\\sqrt{\\phantom{0}}$, is the positive number that times itself makes it: $\\sqrt{25} = 5$. To prove the converse, build a right triangle with legs $a$ and $b$, and show it matches the first triangle.",
    senses: numberSenses,
    terms: ["converse", "congruent", "right-triangle", "hypotenuse"],
    method: [
      "Build a right triangle with legs $a$ and $b$. By the Pythagorean theorem, its hypotenuse is $\\sqrt{a^2 + b^2}$.",
      "Because $a^2 + b^2 = c^2$, that hypotenuse is $c$. The two triangles have the same three side lengths, so they are congruent.",
      "Congruent triangles have matching angles, so the first triangle has a right angle across from the side $c$.",
    ],
    watch:
      "The triangles match because all three side lengths match. Equal area, or both being right triangles, is not the reason.",
  },
};

export const pythagoreanProofsPrinciples: Record<string, string> = {
  "pythagorean-proof-area":
    "A square of side $a + b$ holds four right triangles with legs $a$ and $b$. Placed at the corners or as two rectangles, they leave the same area: $(a + b)^2 - 4 \\cdot \\tfrac{1}{2}ab = a^2 + b^2$.",
  "pythagorean-proof-figure":
    "Counting one area two ways gives $(a + b)^2 = 4 \\cdot \\tfrac{1}{2}ab + c^2$. The middle shape is a square because each corner is $180^\\circ - 90^\\circ = 90^\\circ$. Equal areas taken from equal areas leave equal areas.",
  "pythagorean-proof-steps":
    "Pythagorean theorem: a right triangle with legs $a$ and $b$ and hypotenuse $c$ has $a^2 + b^2 = c^2$. A proof builds the figure, finds one area in two ways, sets them equal and concludes. No step may use the result.",
  "pythagorean-proof-flaw":
    "A proof must hold for every right triangle and give a reason for every step. One example, a circular reason, a square never shown to have right angles, a triangle area of $ab$, or $(a + b)^2 = a^2 + b^2$ each breaks it.",
  "pythagorean-converse-proof":
    "Converse of the Pythagorean theorem: if a triangle has sides $a$, $b$ and $c$ with $a^2 + b^2 = c^2$, it has a right angle across from $c$. A hinge's third side grows as it opens, so only a right angle gives exactly $c$.",
  "pythagorean-converse-blanks":
    "Proof of the converse: a right triangle with legs $a$ and $b$ has hypotenuse $\\sqrt{a^2 + b^2} = c$. Triangles with the same three side lengths are congruent, so the first triangle has the right angle, across from $c$.",
};

export const pythagoreanProofsLessons: Lesson[] = [
  chainLesson({
    id: "pythagorean-proofs-rearrangement-lesson",
    title: "Why the Pythagorean theorem is true",
    summary:
      "Four copies of a right triangle fit in a square whose side is the two legs added. Whatever way they are placed, they leave the same area uncovered: the hypotenuse squared, or the two legs squared and added. So the two must be equal.",
    senses: shapeSenses,
    noLink: ["parts"],
    templateIds: [
      "pythagorean-proof-area",
      "pythagorean-proof-figure",
      "pythagorean-proof-steps",
      "pythagorean-proof-flaw",
    ],
    objectives: [
      "Find the areas in the rearrangement picture and explain why the two leftover areas are equal.",
      "Order, complete and check the steps of the proof, and find the gap in a flawed argument.",
    ],
    openingTitle: "One square, two ways to fill it",
    opening: [
      "A right triangle has one square corner, called a right angle. Its legs are the two sides that make that corner, with lengths $a$ and $b$. The hypotenuse is the longest side, across from the right angle, with length $c$.",
      "Draw a square whose side is $a + b$. Put four copies of the triangle in its corners, so each side of the square is split into $a$ and $b$. The triangles leave a tilted square in the middle. Each of its sides is a hypotenuse, so its sides are $c$ long.",
      "Now slide the same four triangles into two rectangles, $a$ wide and $b$ tall, in opposite corners. They leave a square of side $a$ and a square of side $b$.",
      "The big square is the same, and the same four triangles are taken away. So what is left has the same area both times: $c^2 = a^2 + b^2$. Here $c^2$, read “$c$ squared”, means $c$ times $c$.",
    ],
    example: {
      prompt:
        "Four copies of a right triangle with legs 3 and 4 sit in a square of side 7. What is the area of the tilted square they leave?",
      steps: [
        "The big square has side 7, so its area is $7^2 = 49$.",
        "Each triangle is half of a 3 by 4 rectangle, so its area is $\\tfrac{1}{2} \\times 3 \\times 4 = 6$. Four triangles cover $4 \\times 6 = 24$.",
        "The tilted square is what is left: $49 - 24 = 25$.",
        "Check: $3^2 + 4^2 = 9 + 16 = 25$. The tilted square's area is the two legs squared and added.",
      ],
      answer: "25",
    },
    methodTitle: "Build, count twice, compare",
    method: [
      "Build the picture: four triangles in a square of side $a + b$, leaving a middle square of side $c$.",
      "The middle shape is a square because each corner sits on a straight side beside the two acute angles of a right triangle. Acute angles are smaller than a right angle, and these two add to $90^\\circ$. So the corner is $180^\\circ - 90^\\circ = 90^\\circ$.",
      "Count the big square two ways. As one square: $(a + b)^2 = a^2 + 2ab + b^2$. As parts: $4 \\cdot \\tfrac{1}{2}ab + c^2 = 2ab + c^2$.",
      "Set the counts equal and subtract $2ab$ from both: $a^2 + b^2 = c^2$.",
    ],
    formalTitle: "The Pythagorean theorem and its proof",
    formal: [
      "Pythagorean theorem: in a right triangle with legs $a$ and $b$ and hypotenuse $c$, $a^2 + b^2 = c^2$.",
      "The proof uses only the area of a square, the area of a right triangle, $\\tfrac{1}{2}ab$, and the fact that angles along a straight line add to $180^\\circ$. It uses letters, so it covers every right triangle at once.",
      "A proof gives a reason for every step and never uses the result it is proving.",
    ],
    pitfalls: [
      "Checking one triangle, such as legs 3 and 4, and calling that a proof for every right triangle.",
      "Writing $(a + b)^2$ as $a^2 + b^2$, or taking a triangle's area as $ab$ instead of $\\tfrac{1}{2}ab$.",
      "Calling the middle shape a square because its sides are equal, without showing its corners are right angles.",
    ],
    parentGuide:
      "Cut four equal right triangles from paper and lay them in a square two ways. Ask your learner why the uncovered area is the same both times, and which step of the proof says so.",
  }),
  chainLesson({
    id: "pythagorean-proofs-converse-lesson",
    title: "The converse of the Pythagorean theorem",
    summary:
      "If a triangle's sides fit $a^2 + b^2 = c^2$, it has a right angle across from the longest side $c$. Build a right triangle with the same two shorter sides: its longest side comes out to $c$, so it is the same triangle.",
    senses: numberSenses,
    noLink: ["part", "parts"],
    templateIds: ["pythagorean-converse-proof", "pythagorean-converse-blanks"],
    objectives: [
      "State the converse of the Pythagorean theorem and tell it apart from the theorem.",
      "Complete the proof of the converse, read a hinge, and find the flaw in a converse argument.",
    ],
    openingTitle: "Turning the theorem around",
    opening: [
      "The Pythagorean theorem starts with a right angle and ends with an equation: the two legs squared and added equal the hypotenuse squared. Squared means multiplied by itself.",
      "The converse swaps the two parts. It starts with the equation and ends with the right angle: if a triangle has sides $a$, $b$ and $c$ with $a^2 + b^2 = c^2$, then it has a right angle across from $c$. A converse is a new statement, so it needs its own proof.",
      "Picture two rods joined at a hinge. Nearly closed, the gap between their ends is short. As the hinge opens, the gap grows. Only one opening, the right angle, gives a gap of exactly $c$.",
    ],
    example: {
      prompt:
        "A triangle has sides 5, 12 and 13. Show that it has a right angle.",
      steps: [
        "The longest side is 13. Check the squares: $5^2 + 12^2 = 25 + 144 = 169 = 13^2$.",
        "Build a right triangle with legs 5 and 12. By the Pythagorean theorem, its hypotenuse is $\\sqrt{169} = 13$.",
        "Both triangles have sides 5, 12 and 13, so they are congruent: the same size and shape.",
        "The right angle of the built triangle is across from 13, so the first triangle has a right angle across from the side 13.",
      ],
      answer: "A right angle across from the side 13",
    },
    methodTitle: "Build the matching right triangle",
    method: [
      "Use the longest side as $c$, and compare $a^2 + b^2$ with $c^2$.",
      "If they are equal, build a right triangle with legs $a$ and $b$. Its hypotenuse is $\\sqrt{a^2 + b^2} = c$.",
      "Same three side lengths means congruent triangles, so the first triangle has the right angle, across from $c$.",
    ],
    formalTitle: "The converse and its proof",
    formal: [
      "Converse of the Pythagorean theorem: if the sides of a triangle satisfy $a^2 + b^2 = c^2$, the angle across from $c$ is a right angle.",
      "Proof: a right triangle with legs $a$ and $b$ has hypotenuse $\\sqrt{a^2 + b^2} = c$. Triangles with the same three side lengths are congruent, so their angles match.",
      "The hinge shows the same fact: as the angle opens, the third side grows, so each length of the third side comes from exactly one angle.",
    ],
    pitfalls: [
      "Starting from “the triangle is right” when the right angle is what must be shown.",
      "Squaring a shorter side alone instead of the longest side.",
      "Adding the side lengths instead of their squares.",
    ],
    parentGuide:
      "Join two pencils at their ends with a rubber band and open them slowly. Ask your learner what happens to the gap between the free ends, and why only one opening can give a particular gap.",
  }),
];

export const pythagoreanProofsFacetMappings: FacetMapping[] = [
  {
    templateId: "pythagorean-proof-area",
    facetId: "pythagorean-theorem.core",
    extent: "partial",
    rationale:
      "Numeric areas in the rearrangement proof: the tilted square left by four triangles at the corners, or the two squares left when they form two rectangles, from whole-number legs. It does not ask for a written proof.",
  },
  {
    templateId: "pythagorean-proof-figure",
    facetId: "pythagorean-theorem.core",
    extent: "partial",
    rationale:
      "Choosing the equation that counts the big square two ways, the reason the two leftover areas are equal, and the reason the middle shape has right-angle corners. It assesses reading the proof, not writing it.",
  },
  {
    templateId: "pythagorean-proof-steps",
    facetId: "pythagorean-theorem.core",
    extent: "partial",
    rationale:
      "Ordering the steps of the two-picture and two-count proofs among unused statements, or choosing two blanks of the written two-count proof. Writing the proof in the learner's own words is not assessed.",
  },
  {
    templateId: "pythagorean-proof-flaw",
    facetId: "pythagorean-theorem.core",
    extent: "partial",
    rationale:
      "Naming the gap in a flawed argument: an example used as a proof, a circular reason, a square never shown to have right angles, a triangle area of ab, or the square of a + b written as the sum of squares.",
  },
  {
    templateId: "pythagorean-converse-proof",
    facetId: "pythagorean-theorem.core",
    extent: "partial",
    rationale:
      "Choosing the converse among the theorem and other if-then statements, reading a hinge angle from its third side, explaining why the hinge proves the converse, and finding the flaw in a converse argument.",
  },
  {
    templateId: "pythagorean-converse-blanks",
    facetId: "pythagorean-theorem.core",
    extent: "partial",
    rationale:
      "Completing the congruence proof of the converse with four blanks, on a Pythagorean triple or with letters. It does not ask the learner to write the proof unaided.",
  },
];
