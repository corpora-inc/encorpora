import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

const terms: NonNullable<ProblemMethod["terms"]> = [
  "inequality",
  "solution-set",
  "coefficient",
];

/** The words every inequality practice screen needs, said once in plain
 * language: the four signs, a solution, the solution set and the boundary. */
const signsIntuition =
  "An inequality compares two amounts. The sign $<$ means “is less than” and $>$ means “is greater than”. The sign $\\le$ means “is less than or equal to” and $\\ge$ means “is greater than or equal to”. A solution is a number that makes the comparison true when you put it in for $x$. The solution set is all of those numbers together. It is usually a whole stretch of the number line, starting at one boundary number.";

export const inequalityMethods: Record<string, ProblemMethod> = {
  "affine-linear-inequality": {
    goal: "Find every number $x$ that makes an inequality like $-3x + 2 \\le 7$ true.",
    senses: {
      side: "side-of-equation",
      sides: "side-of-equation",
      boundary: "boundary",
    },
    noLink: ["whole", "change", "changes", "part", "parts", "leaves"],
    intuition: `${signsIntuition} Solve it almost like an equation. The one change: dividing both sides by a negative number flips the sign, so $<$ becomes $>$.`,
    terms,
    method: [
      "Add or subtract the same number on both sides so the $x$ part stands alone. The sign stays the same.",
      "Divide both sides by the number multiplying $x$. If that number is positive, keep the sign. If it is negative, flip the sign ($<$ to $>$, $\\le$ to $\\ge$, and back).",
      "Write the whole solution set, such as $x \\ge -2$. The signs $\\le$ and $\\ge$ include the boundary number; $<$ and $>$ leave it out.",
      "Check: the boundary should make the two sides equal, and a number on the chosen side should make the comparison true.",
    ],
    watch:
      "Flip the sign only when you multiply or divide by a negative number. Adding or subtracting a negative number never flips it.",
  },
  "grouped-linear-inequality": {
    goal: "Solve an inequality with parentheses and $x$ on both sides, such as $-2(2x - 3) + 1 > x + 4$.",
    senses: {
      side: "side-of-equation",
      sides: "side-of-equation",
      term: "term-expression",
      terms: "term-expression",
      boundary: "boundary",
    },
    noLink: ["whole", "change", "changes", "part", "parts", "leaves"],
    intuition: `${signsIntuition} A number right before parentheses multiplies everything inside: $-2(2x - 3)$ is $-4x + 6$. This is called distributing. Dividing both sides by a negative number flips the sign.`,
    terms: [...terms, "distribute"],
    method: [
      "Distribute: multiply the outside number by each part inside the parentheses, signs included. Then add up the plain numbers on each side.",
      "Subtract the same $x$ term from both sides so $x$ appears on one side only. Then subtract the same number from both sides so the $x$ term stands alone.",
      "Divide both sides by the number multiplying $x$ (it is not 0). Flip the sign only if that number is negative.",
      "Keep the boundary as an exact fraction, not a rounded decimal. Check the boundary and one number inside the solution set.",
    ],
    watch:
      "Subtracting an $x$ term from both sides never flips the sign. Only dividing or multiplying by a negative number does.",
  },
  "cancelled-linear-inequality": {
    goal: "The $x$ terms cancel. Decide if every number or no number makes the inequality true.",
    senses: {
      side: "side-of-equation",
      sides: "side-of-equation",
      terms: "term-expression",
      term: "term-expression",
      boundary: "boundary",
    },
    noLink: ["whole", "change", "changes", "part", "parts", "leaves"],
    intuition: `${signsIntuition} Sometimes both sides have the same amount of $x$, as in $3x + 5 < 3x + 8$. Subtracting $3x$ from both sides removes $x$ completely and leaves $5 < 8$. That statement is true or false no matter what $x$ is.`,
    terms,
    method: [
      "Distribute any parentheses, add up the plain numbers on each side, and subtract the matching $x$ terms from both sides.",
      "Read the comparison of plain numbers that is left. Equal numbers make $\\le$ and $\\ge$ true, but $<$ and $>$ false.",
      "If the comparison is true, every number is a solution. If it is false, no number is a solution.",
    ],
    watch:
      "When the $x$ terms cancel, the answer is never “$x = 0$”. It is every number or no number. Never divide by the 0 that is left in front of $x$.",
  },
};
export const inequalityPrinciples: Record<string, string> = {
  "affine-linear-inequality":
    "Adding or subtracting the same number on both sides keeps the order of two numbers. Multiplying or dividing both sides by a positive number also keeps it. Multiplying or dividing by a negative number reverses it, so the sign flips. Each of these steps can be undone, so the solution set does not change.",
  "grouped-linear-inequality":
    "Distributing writes the same amount in a new way. Adding or subtracting the same term on both sides keeps the comparison true or false for each $x$. Dividing both sides by a negative number reverses the comparison, so the sign flips.",
  "cancelled-linear-inequality":
    "When the $x$ terms cancel, the comparison that is left does not depend on $x$. If it is true, every real number (every number on the number line) is a solution. If it is false, no number is.",
};

/** Ordinary words in these lessons that are not glossary terms here. */
const NO_LINK = [
  "whole",
  "part",
  "parts",
  "change",
  "changes",
  "rule",
  "faces",
  "leaves",
  "mean",
  "opposite",
];

const foundations: Lesson["sections"][number] = {
  stage: "intuition",
  title: "What the comparison means",
  paragraphs: [
    "This lesson uses adding, subtracting, multiplying and dividing with positive and negative numbers and fractions. A real number is any number that has a point on the number line. That includes whole numbers, negative numbers, fractions and decimals. Numbers get larger as you move right. A variable is a letter, such as $x$, that stands for a number.",
    "An inequality compares two amounts. The sign $<$ means “is less than”, and $>$ means “is greater than”. The sign $\\le$ means “is less than or equal to”, and $\\ge$ means “is greater than or equal to”. So $2 < 5$ is true, $5 < 5$ is false, and $5 \\le 5$ is true. The open mouth of the sign faces the larger amount.",
    "A solution is a value of $x$ that makes the comparison true when you put it in for $x$. The solution set is every solution together. For $x < 2$, the numbers 1, 0, $-3$ and 1.5 are solutions, but 2 and 5 are not. The number 2 is called the boundary: it separates the numbers that work from the numbers that do not. The sign $<$ leaves the boundary out, and $\\le$ includes it.",
    "A short list of examples is not the whole solution set. There are endlessly many numbers less than 2, including fractions such as 1.9 and 1.99. So the answer is written as a statement like $x < 2$.",
  ],
};
const order: Lesson["sections"][number] = {
  title: "Why a negative divisor flips the sign",
  paragraphs: [
    "Adding the same number to two amounts moves both the same distance along the number line. So their order stays the same. Subtracting works the same way. For example, $2 < 5$, and subtracting 7 from both gives $-5 < -2$. That is still true. A negative result alone does not flip the sign.",
    "Multiplying by a positive number stretches distances from 0 but keeps left and right in order. Multiplying by a negative number also flips every number to the other side of 0. That reverses the order. For example, $-2 < 3$. Multiply both by $-2$: you get 4 and $-6$, and $4 > -6$. The smaller number became the larger one.",
    "Dividing by a negative number flips the order too. Dividing by $-2$ is the same as multiplying by $-\\tfrac{1}{2}$, which is also negative. The reciprocal of a number (one that is not 0) is the number you multiply it by to get 1, so the reciprocal of $-2$ is $-\\tfrac{1}{2}$. Flip $<$ to $>$, $>$ to $<$, $\\le$ to $\\ge$, or $\\ge$ to $\\le$. Whether the boundary is included stays the same. You can never divide by 0.",
    "A fraction in front of $x$ follows the same rule. In $-\\tfrac{2}{3}x \\le 4$, the number multiplying $x$ is $-\\tfrac{2}{3}$. Multiply both sides by its reciprocal, $-\\tfrac{3}{2}$. That number is negative, so flip $\\le$ to $\\ge$: $x \\ge 4 \\times (-\\tfrac{3}{2}) = -6$.",
  ],
};
export const inequalityLessons: Lesson[] = [
  {
    id: "affine-linear-inequality",
    title: "Solve a linear inequality",
    summary:
      "An inequality, like $-3x + 2 \\le 7$, says one amount is less than or greater than another. Its answer is not one number but a whole stretch of numbers. Solve it like an equation, doing the same step to both sides. The one new rule: dividing both sides by a negative number flips the sign. The answer has a boundary, the number where the two sides are equal, and a direction.",
    templateIds: ["affine-linear-inequality"],
    senses: {
      side: "side-of-equation",
      sides: "side-of-equation",
      boundary: "boundary",
    },
    noLink: NO_LINK,
    objectives: [
      "Solve inequalities like $-3x + 2 \\le 7$, with positive, negative and fraction numbers, by doing the same step to both sides.",
      "Explain why dividing by a negative number flips the sign, and whether the boundary number is included.",
    ],
    sections: [
      foundations,
      {
        title: "Show the whole set on a number line",
        paragraphs: [
          "The number 2 is the boundary of $x < 2$. Numbers on one side of 2 make it true, and numbers on the other side do not. Draw an open (empty) circle at 2 to show that 2 itself is left out. Shade the line to the left of 2, with an arrow to show it goes on forever. A set like this, with one end and no other end, is called a half-line.",
          "For $x \\le 2$, fill in the circle, because 2 is included. For $x > 2$ or $x \\ge 2$, shade the line to the right. The direction and the open or filled circle say different things, and both matter. Every point on the shaded line is a solution, not only the whole numbers.",
        ],
        illustration: "inequality-half-lines",
      },
      {
        title: "Get the unknown alone without changing the solutions",
        paragraphs: [
          "In $-3x + 2$, $-3x$ means $-3$ times $x$, and then 2 is added. The number multiplying $x$, sign included, is called the coefficient; here it is $-3$. The 2 is called a constant, a plain number with no $x$. An inequality like this, where $x$ is only multiplied by numbers (no $x^2$, meaning $x$ times $x$), is called linear.",
          "To isolate $x$ means to get $x$ alone on one side. First undo the adding or subtracting, by doing the opposite step to both sides. Then undo the multiplying, by dividing both sides by the coefficient. The coefficient must not be 0. Every step can be undone, so the new inequality has exactly the same solutions as the old one.",
          "The numbers may be fractions. In $\\tfrac{3}{2}$, the bottom number 2 (the denominator) splits one whole into 2 equal parts. The top number 3 (the numerator) counts 3 of those parts. Keep an exact fraction such as $\\tfrac{5}{3}$; do not round it to 1.67. A rounded boundary changes which nearby numbers count as solutions.",
        ],
      },
      order,
    ],
    workedExample: {
      prompt: "Find all real $x$ for which $-3x + 2 \\le 7$.",
      steps: [
        "Subtract 2 from both sides to undo the + 2: $-3x + 2 - 2 \\le 7 - 2$, so $-3x \\le 5$. Subtracting does not flip the sign.",
        "Divide both sides by $-3$ to get $x$ alone. Because $-3$ is negative, flip $\\le$ to $\\ge$: $\\frac{-3x}{-3} \\ge \\frac{5}{-3}$.",
        "Simplify: $x \\ge -\\tfrac{5}{3}$. The solutions are $-\\tfrac{5}{3}$ and every larger number.",
        "Check the boundary in the original: $-3 \\times (-\\tfrac{5}{3}) + 2 = 5 + 2 = 7$. The sign $\\le$ allows equal, so $-\\tfrac{5}{3}$ is included.",
        "Check the direction with a number on each side. $x = 0$ gives $2 \\le 7$, which is true. $x = -2$ gives $8 \\le 7$, which is false. So the larger numbers are the solutions.",
      ],
      answer: "x ≥ −5/3",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "Adding or subtracting the same number on both sides keeps the order of two numbers. Multiplying or dividing both sides by a positive number keeps it too. Multiplying or dividing by a negative number reverses the order, so the sign flips. Each step can be undone, so the solution set (every number that makes the inequality true) does not change.",
        ],
      },
    ],
    pitfalls: [
      "Do not flip the sign when adding or subtracting, even when the number added is negative.",
      "The boundary alone is not the answer. Give the direction too, and whether the boundary is included.",
    ],
    parentGuide:
      "Ask your learner to read the final inequality in words, to explain why the sign flipped, and to name a solution that is not a whole number. Then change $\\le$ in the original problem to $<$ and ask what changes at the boundary.",
  },
  {
    id: "grouped-linear-inequality",
    title: "Solve inequalities with parentheses",
    summary:
      "An inequality compares two amounts with $<$, $>$, $\\le$ or $\\ge$. Some have parentheses and $x$ on both sides, like $-2(2x - 3) + 1 > x + 4.5$. First multiply out the parentheses. Then gather the $x$ terms on one side and the plain numbers on the other. Divide to get $x$ alone, flipping the sign only if you divide by a negative number.",
    templateIds: ["grouped-linear-inequality"],
    senses: {
      side: "side-of-equation",
      sides: "side-of-equation",
      term: "term-expression",
      terms: "term-expression",
      boundary: "boundary",
    },
    noLink: NO_LINK,
    objectives: [
      "Multiply out parentheses with negative numbers and gather the $x$ terms on one side.",
      "Solve exactly, then check that the boundary is included or left out and that the direction is right.",
    ],
    sections: [
      foundations,
      {
        title: "Parentheses group an amount",
        paragraphs: [
          "A term is one part of a sum, together with its sign. In $2x - 3$, the terms are $2x$ and $-3$. The coefficient 2 is the number multiplying $x$. The constant $-3$ is a plain number with no $x$. In $-2(2x - 3)$, the parentheses keep $2x - 3$ together so the whole thing is multiplied by $-2$.",
          "Multiplying a sum means multiplying every term in it. This is called distributing. So $-2(2x - 3) = (-2)(2x) + (-2)(-3) = -4x + 6$. Both terms get multiplied by $-2$. The constant becomes positive, because a negative number times a negative number is positive.",
          "Like terms have the same letter part, such as $-4x$ and $-x$. You combine them by adding their coefficients: $-4x - x = (-4 - 1)x = -5x$. Plain numbers combine with plain numbers: $6 + 1 = 7$. You cannot combine $-4x$ and 7 into one term, because only $-4x$ changes when $x$ changes.",
        ],
      },
      {
        title: "Gather the unknown terms on one side",
        paragraphs: [
          "Subtract the same $x$ term from both sides. For any number $x$ stands for, you subtract the same amount from each side, so the comparison stays true or false. For example, subtract $x$ from both sides of $-4x + 7 > x + 2$ to get $-5x + 7 > 2$. Then subtract 7 from both sides to get $-5x > -5$.",
          "Inequalities with exactly the same solutions are called equivalent. Distributing only writes the same amount a new way. Adding or subtracting the same term on both sides keeps the order. Then divide both sides by the coefficient (it must not be 0) to get $x$ alone. A negative divisor flips the sign.",
          "Write a fraction boundary exactly. In a fraction, the bottom number (the denominator) says how many equal parts make one whole. The top number (the numerator) counts those parts. So $\\tfrac{1}{2}$ is one of two equal parts. Rounding $\\tfrac{1}{3}$ to 0.33 would move the boundary and change the solution set.",
        ],
      },
      order,
    ],
    workedExample: {
      prompt:
        "Find all real $x$ for which $-2(2x - 3) + 1 > x + \\tfrac{9}{2}$.",
      steps: [
        "Distribute $-2$ to both terms in the parentheses, so there are no parentheses left: $-4x + 6 + 1 > x + \\tfrac{9}{2}$.",
        "Add the plain numbers on the left, $6 + 1 = 7$, so each side is simpler: $-4x + 7 > x + \\tfrac{9}{2}$.",
        "Subtract $x$ from both sides so $x$ is only on the left: $-5x + 7 > \\tfrac{9}{2}$.",
        "Subtract 7 from both sides so the $x$ term stands alone: $-5x > \\tfrac{9}{2} - 7$. Since $7 = \\tfrac{14}{2}$, the right side is $\\tfrac{9 - 14}{2} = -\\tfrac{5}{2}$.",
        "Divide both sides by $-5$ to get $x$ alone. The divisor is negative, so flip $>$ to $<$: $x < -\\tfrac{5}{2} \\div (-5) = -\\tfrac{5}{2} \\times (-\\tfrac{1}{5}) = \\tfrac{1}{2}$.",
        "Check the boundary in the original. At $x = \\tfrac{1}{2}$, the left side is $-2(1 - 3) + 1 = 5$ and the right side is $\\tfrac{1}{2} + \\tfrac{9}{2} = 5$. The sides are equal, and $>$ does not allow equal, so $\\tfrac{1}{2}$ is left out.",
        "Check a number on each side. At $x = 0$, the sides are 7 and $\\tfrac{9}{2}$, and $7 > \\tfrac{9}{2}$ is true. At $x = 1$, they are 3 and $\\tfrac{11}{2}$, and $3 > \\tfrac{11}{2}$ is false. Both checks agree with $x < \\tfrac{1}{2}$.",
      ],
      answer: "x < 1/2",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "Distributing writes the same amount in a new way. Adding or subtracting the same term on both sides keeps the comparison true or false for each $x$. Dividing both sides by a negative number reverses the comparison, so the sign flips.",
        ],
      },
    ],
    pitfalls: [
      "A negative number outside parentheses multiplies every term inside, including a negative constant: $-2(2x - 3)$ is $-4x + 6$, not $-4x - 6$.",
      "Checking one number does not prove the whole answer. The steps that keep the solutions the same prove it; checking only catches slips in the arithmetic or the direction.",
    ],
    parentGuide:
      "Ask what each step keeps the same. Have your learner explain why subtracting $x$ from both sides keeps the comparison even though $x$ is unknown, and why dividing by $-5$ flips it.",
  },
  {
    id: "cancelled-linear-inequality",
    title: "When the variable terms cancel",
    summary:
      "Sometimes both sides of an inequality have the same amount of $x$, as in $3x + 5 < 3x + 8$. Subtract $3x$ from both sides and $x$ disappears: $5 < 8$. That is true for every number $x$, so every number is a solution. If what is left is false, like $5 > 8$, no number is a solution.",
    templateIds: ["cancelled-linear-inequality"],
    senses: {
      side: "side-of-equation",
      sides: "side-of-equation",
      term: "term-expression",
      terms: "term-expression",
      boundary: "boundary",
    },
    noLink: NO_LINK,
    objectives: [
      "Spot when the $x$ terms cancel, including after multiplying out parentheses.",
      "Tell “every number is a solution” from “no number is a solution”, including when the two plain numbers left are equal.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "What counts as a solution",
        paragraphs: [
          "This lesson uses arithmetic with positive and negative numbers. A real number is any number that has a point on the number line: whole numbers, negative numbers, fractions and decimals. A variable is a letter, such as $x$, that stands for a number.",
          "An inequality compares two amounts. The sign $<$ means “is less than” and $>$ means “is greater than”. The signs $\\le$ and $\\ge$ mean the same but also allow the two amounts to be equal. So $2 < 5$ and $5 \\le 5$ are true, but $5 < 5$ is false.",
          "A solution is a value of $x$ that makes the comparison true when you put it in for $x$. The solution set is every solution together.",
        ],
      },
      {
        title: "Remove matching unknown terms",
        paragraphs: [
          "The coefficient is the number multiplying $x$. A constant is a plain number with no $x$. In $3x + 5 < 3x + 8$, the coefficient of $x$ is 3 on both sides. Subtract $3x$ from both sides, and $5 < 8$ is left. Whatever number $x$ is, you took the same amount from both sides, so the comparison stays true or false.",
          "The statement $5 < 8$ is true, and it has no $x$ in it. So every real number makes the original inequality true. The solution set is all real numbers: the whole number line, with no boundary. For example, $x = 0$ gives $5 < 8$, and $x = -2$ gives $-1 < 2$. The subtraction proves it for every $x$, not only for these two.",
          "Now take $3x + 5 > 3x + 8$. Subtracting $3x$ from both sides leaves $5 > 8$, which is false. No choice of $x$ can change that. The solution set is empty: no real number works.",
        ],
      },
      {
        title: "Equal numbers depend on the sign",
        paragraphs: [
          "Equal numbers make $\\le$ and $\\ge$ true: $5 \\le 5$ and $5 \\ge 5$ are true. Equal numbers make $<$ and $>$ false: $5 < 5$ and $5 > 5$ are false. The signs $<$ and $>$ are called strict, because they do not allow equal. When the $x$ terms cancel, this can decide between “every number” and “no number”.",
          "For example, $2x + 4 \\le 2x + 4$ is true for every real $x$. Change $\\le$ to $<$ and it is false for every real $x$. The two sides have the same value for each $x$, so neither side can be strictly smaller.",
        ],
      },
      {
        title: "Multiply out before deciding",
        paragraphs: [
          "Parentheses can hide matching $x$ terms. Distributing means multiplying each term inside the parentheses by the number outside. For example, $-2(x - 3) = (-2)x + (-2)(-3) = -2x + 6$. Adding 1 more gives $-2(x - 3) + 1 = -2x + 7$.",
          "After the $x$ terms cancel, the number in front of $x$ is 0: $3x - 3x = 0x$, and $0x = 0$ for every $x$. That does not mean $x$ must be 0. Do not divide by that 0; dividing by 0 has no meaning. Instead, read the comparison of plain numbers that is left and decide if it is true or false.",
        ],
      },
    ],
    workedExample: {
      prompt: "Find all real $x$ for which $-2(x - 3) + 1 \\ge -2x + 7$.",
      steps: [
        "Distribute $-2$ to remove the parentheses: $-2x + 6 + 1 \\ge -2x + 7$.",
        "Add the plain numbers on the left, so each side has one $x$ term and one number: $-2x + 7 \\ge -2x + 7$.",
        "Add $2x$ to both sides to remove the matching $x$ terms: $7 \\ge 7$.",
        "This is true, because $\\ge$ allows equal. It no longer depends on $x$, so every real $x$ makes the original inequality true.",
        "If the original sign had been $>$, the last line would be $7 > 7$, which is false. That problem would have no real solutions.",
      ],
      answer: "All real numbers",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "When the $x$ terms cancel, the comparison that is left does not depend on $x$. If it is true, every real $x$ is a solution. If it is false, no real $x$ is.",
        ],
      },
    ],
    pitfalls: [
      "No $x$ left does not mean no solutions. Whether the comparison that is left is true or false decides it.",
      "Do not answer $x = 0$ after the $x$ terms cancel. Zero is either one of endlessly many solutions, or not a solution at all.",
    ],
    parentGuide:
      "Change the number on the right from 7 to 8, then to 6. Ask your learner whether each version has every number or no number as solutions, and to explain why without testing a long list of numbers.",
  },
];
