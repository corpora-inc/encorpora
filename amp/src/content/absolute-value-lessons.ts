import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";
const terms: NonNullable<ProblemMethod["terms"]> = [
  "absolute-value",
  "solution-set",
  "coefficient",
];

/** Glossary readings shared by every absolute-value lesson and method. */
const senses = {
  side: "side-of-equation",
  sides: "side-of-equation",
  term: "term-expression",
  terms: "term-expression",
  unit: "unit",
  units: "unit",
} as const;
const noLink = [
  "whole",
  "part",
  "parts",
  "change",
  "changes",
  "leaves",
  "opposite",
  "opposites",
  "center",
  "mean",
  "impossible",
  "sort",
];

/** What every absolute-value practice screen needs before its first step. */
const barsIntuition =
  "The absolute value of a number is its distance from 0 on the number line. We write it between two straight bars: $|-3| = 3$ and $|3| = 3$, because both are 3 steps from 0. A distance is never negative.";

export const absoluteValueMethods: Record<string, ProblemMethod> = {
  "absolute-value-direct-equation": {
    goal: "Find every number $x$ whose absolute value, its distance from 0, is the given number, as in $|x| = 3$.",
    senses,
    noLink,
    intuition: `${barsIntuition} So $|x| = 3$ asks which numbers are 3 steps from 0. There are two: 3 and $-3$.`,
    terms,
    method: [
      "Read the number on the other side of the equals sign as a distance from 0.",
      "A positive distance gives two answers, the number and its negative. A distance of 0 gives only 0. A negative distance gives no answer, because distances are never negative.",
      "Check each answer by putting it back in, and list every answer.",
    ],
    watch:
      "The absolute value is never negative, but the number inside the bars can be. So keep the negative answer: $|-3| = 3$.",
  },
  "absolute-value-affine-equation": {
    goal: "Find every $x$ that makes an equation like $|2x - 3| = 5$ true.",
    senses,
    noLink,
    intuition: `${barsIntuition} In $|2x - 3| = 5$, the whole amount $2x - 3$ is 5 steps from 0. So $2x - 3$ is 5 or $-5$. Each of those two equations is called a branch; solve both.`,
    terms,
    method: [
      "If the number on the right is negative, there is no solution. If it is 0, set the inside of the bars equal to 0 and solve.",
      "If it is positive, write two equations: the inside equals that number, or the inside equals its negative.",
      "Solve each one. Undo the plain number first, then divide by the number multiplying $x$ (it is not 0). Keep fractions exact.",
      "Check every answer in the original equation and list every one that works.",
    ],
    watch:
      "Give the plus and minus signs to the whole number on the right. Do not split the bars across a plus or minus: $|2x - 3|$ is not $|2x| - |3|$.",
  },
  "absolute-value-transformed-equation": {
    goal: "Get the absolute value alone on one side, then find every $x$ that makes the equation true.",
    senses,
    noLink,
    intuition: `${barsIntuition} In $-2|3x - 1| + 4 = -6$, the bars are multiplied by $-2$ and then 4 is added. Undo those outside steps first, last one first. Only then look at the sign of the number left on the right.`,
    terms,
    method: [
      "If the number multiplying the bars is 0, the bars vanish: check whether the plain numbers left are equal. If the number multiplying $x$ inside is 0, work out the value inside instead.",
      "Otherwise, subtract the outside plain number from both sides, then divide both sides by the number multiplying the bars (not 0).",
      "Now the bars stand alone. A negative number on the right gives no solution, 0 gives one equation, and a positive number gives two.",
      "Solve each equation, then put each answer back into the original equation to check it.",
    ],
    watch:
      "A negative number on the right of the original equation can still have solutions. Decide only after the bars stand alone. Never divide by 0.",
  },
};
export const absoluteValuePrinciples: Record<string, string> = {
  "absolute-value-direct-equation":
    "Absolute value is distance from 0, written with bars. For a positive number $c$, $|x| = c$ exactly when $x = c$ or $x = -c$. Also $|x| = 0$ exactly when $x = 0$. If $c$ is negative, $|x| = c$ has no solution.",
  "absolute-value-affine-equation":
    "For a positive number $c$, $|ax + b| = c$ has the same solutions as the pair $ax + b = c$ or $ax + b = -c$. Here $ax$ means $a$ times $x$, with $a$ not 0. Solving both equations with steps that can be undone gives every real solution.",
  "absolute-value-transformed-equation":
    "Adding the same number to both sides, or dividing both sides by the same number other than 0, keeps an equation's solutions. Get the absolute value alone before splitting it into two equations. An equation with no $x$ left is true for every real $x$ or for none.",
};
const foundations: Lesson["sections"][number] = {
  stage: "intuition",
  title: "Absolute value measures distance",
  paragraphs: [
    "This lesson uses adding, subtracting, multiplying and dividing with positive and negative numbers. A real number is any number with a point on the number line: whole numbers, negative numbers, fractions and decimals. Numbers get larger to the right. Negative numbers sit to the left of 0.",
    "The absolute value of a number is its distance from 0. We write it between two straight bars. So $|3| = 3$ and $|-3| = 3$, because 3 and $-3$ are both 3 steps from 0. Also $|0| = 0$. A distance cannot be negative, so an absolute value is always positive or 0.",
    "The bars act on everything inside them. In $|-3|$, the number inside is negative, but its distance from 0 is positive, 3. In $-|3|$, the minus sign is outside the bars. First find the distance, 3. Then take its opposite, $-3$. The opposite of a number is the same distance from 0 on the other side; the opposite of 0 is 0.",
  ],
};
const equations: Lesson["sections"][number] = {
  title: "What it means to solve an equation",
  paragraphs: [
    "A variable is a letter, such as $x$, that stands for a number. An expression, such as $2x - 3$, is a math phrase with a value; $2x$ means 2 times $x$. An equation says two expressions are equal. A solution is a value of $x$ that makes the equation true. To check one, put it in for every $x$ and work out both sides.",
    "The solution set is every solution, and nothing else. The word “or” joins choices: “$x = -3$ or $x = 3$” means either value works. It does not mean $x$ is both at once. “No real solutions” means no number on the number line works. “All real numbers” means every number works.",
  ],
};
const branches: Lesson["sections"][number] = {
  title: "Why there are two branches, one branch, or none",
  paragraphs: [
    "Exactly two numbers are 3 steps from 0: one on each side of 0. So $|t| = 3$ means $t = 3$ or $t = -3$. Here the letter $t$ stands for everything inside the bars. It can be $x$, or an expression with $x$ in it. The two equations are called branches, because each is a separate choice to solve.",
    "If the distance is 0, the two choices are the same: $|t| = 0$ means $t = 0$. Writing 0 twice does not give two different solutions. If the distance is negative, as in $|t| = -3$, there is no solution, because a distance cannot be negative.",
  ],
};
const operations: Lesson["sections"][number] = {
  title: "Solve each branch without changing its solutions",
  paragraphs: [
    "In $-2x + 3$, the number multiplying $x$ is $-2$; it is called the coefficient. The plain number 3, with no $x$, is called the constant. To isolate $x$ means to get $x$ alone on one side. Add or subtract the same number on both sides. Then divide both sides by the coefficient, which must not be 0. Each step can be undone, so the solutions stay the same. Dividing by 0 has no meaning.",
    "Keep fractions exact. In $\\tfrac{3}{2}$, the bottom number 2 (the denominator) splits one whole into 2 equal parts. The top number 3 (the numerator) counts 3 of them. To add or subtract fractions, write them with the same bottom number: $\\tfrac{5}{2} - 3 = \\tfrac{5}{2} - \\tfrac{6}{2} = -\\tfrac{1}{2}$.",
    "To divide by $-2$, multiply by $-\\tfrac{1}{2}$. That number is the reciprocal of $-2$: the number you multiply $-2$ by to get 1. So $-\\tfrac{1}{2} \\div (-2) = -\\tfrac{1}{2} \\times (-\\tfrac{1}{2}) = \\tfrac{1}{4}$.",
  ],
};
export const absoluteValueLessons: Lesson[] = [
  {
    id: "absolute-value-direct-equation",
    title: "Absolute-value equations: distance from zero",
    summary:
      "A number line shows numbers in order, evenly spaced, with 0 in the middle. The absolute value of a number is its distance from 0 on the number line. We write it with two bars: $|-3| = 3$. So $|x| = 3$ asks which numbers are 3 steps from 0. There are two, 3 and $-3$. A distance of 0 gives one number, 0. A negative distance gives none, because distances are never negative.",
    templateIds: ["absolute-value-direct-equation"],
    includeGeneratedRepresentation: false,
    senses,
    noLink,
    objectives: [
      "Read an absolute value, such as $|-5|$, as a distance from 0.",
      "Find every solution of equations like $|x| = 3$, $|x| = 0$ and $|x| = -3$.",
    ],
    sections: [
      foundations,
      equations,
      branches,
      {
        title: "Read the solution points",
        paragraphs: [
          "For $|x| = 3$, mark the two points 3 steps from 0. Only $-3$ and 3 solve the equation. Every point between them is closer to 0. For $|x| = 0$, only the point 0 works.",
          "A filled dot in these pictures marks one solution. The unmarked points between $-3$ and 3 do not solve $|x| = 3$, because each is less than 3 steps from 0.",
        ],
        illustration: "absolute-value-distance",
      },
      {
        title: "Distances can be fractions",
        paragraphs: [
          "One unit is the distance from 0 to 1. Split that unit into 2 equal parts to make halves. In $\\tfrac{3}{2}$, the bottom number 2 names the parts and the top number 3 counts them. Three halves make one and a half units. So $|x| = \\tfrac{3}{2}$ has two solutions: $x = -\\tfrac{3}{2}$ or $x = \\tfrac{3}{2}$. Keep the exact fraction.",
          "The same idea works for every positive distance, whole or fraction. It depends only on the distance and the two directions, left and right.",
        ],
      },
    ],
    workedExample: {
      prompt: "Solve $|x| = 3$. Give the complete set of real solutions.",
      steps: [
        "The bars mean distance from 0, so the question asks which numbers are 3 steps from 0. The distance 3 is positive, so there is one number on each side: 3 and $-3$.",
        "Write the two choices, called branches: $x = 3$ or $x = -3$.",
        "Check each one. $|3| = 3$ and $|-3| = 3$. Both match the right side.",
        "No other point is exactly 3 steps from 0. So the complete solution set is $x = -3$ or $x = 3$.",
      ],
      answer: "x = −3 or x = 3",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "Absolute value is distance from 0. For a positive number $c$, $|x| = c$ exactly when $x = c$ or $x = -c$. Also $|x| = 0$ exactly when $x = 0$. If $c$ is negative, $|x| = c$ has no solution.",
        ],
      },
    ],
    pitfalls: [
      "Do not drop the negative answer. A negative number still has a positive distance from 0.",
      "For $|x| = 0$, list 0 once. For a negative number on the right, answer “no real solutions”.",
    ],
    parentGuide:
      "Ask your learner to mark the solutions of $|x| = 2$, $|x| = 0$ and $|x| = -2$ on a number line. Have them explain why there are two, one and no solutions. Then ask about $|x| = \\tfrac{1}{2}$.",
  },
  {
    id: "absolute-value-affine-equation",
    title: "Absolute value of a linear expression",
    summary:
      "The absolute value of a number is its distance from 0, written with bars: $|-5| = 5$. In $|2x - 3| = 5$, the whole amount $2x - 3$ is 5 steps from 0. Both 5 and $-5$ are 5 steps from 0, so $2x - 3 = 5$ or $2x - 3 = -5$. Add 3 to both sides and divide by 2 in each one: $x = 4$ or $x = -1$. Then check both in the original.",
    templateIds: ["absolute-value-affine-equation"],
    includeGeneratedRepresentation: false,
    senses,
    noLink,
    objectives: [
      "Solve both equations that come from an absolute value with an $x$ expression inside, such as $|2x - 3| = 5$.",
      "Explain what happens when the number on the right is 0 or negative, and keep fraction answers exact.",
    ],
    sections: [
      foundations,
      equations,
      branches,
      {
        title: "The distance belongs to the whole inside",
        paragraphs: [
          "In $|2x - 3| = 5$, the number that is 5 steps from 0 is $2x - 3$, not $x$. So $2x - 3$ must be 5 or $-5$. The two branches are $2x - 3 = 5$ or $2x - 3 = -5$. Add 3 to both sides: $2x = 8$ or $2x = -2$. Divide both sides by 2: $x = 4$ or $x = -1$. These two answers are not opposites, because the inside is not just $x$.",
          "Now look at $x - 2$. It tells how far $x$ is from 2, and in which direction: positive to the right of 2, negative to the left. So $|x - 2|$ is the distance between $x$ and 2. Then $|x - 2| = 3$ puts the solutions 3 steps on either side of 2, at $-1$ and 5. The center, 2, is not a solution: its distance from itself is 0.",
        ],
        illustration: "absolute-value-shifted",
      },
      operations,
      {
        title: "Zero and negative targets",
        paragraphs: [
          "For $|2x - 3| = 0$, the inside must be 0, so set $2x - 3 = 0$. Add 3 to both sides: $2x = 3$. Divide both sides by 2: $x = \\tfrac{3}{2}$. Check: $2 \\times \\tfrac{3}{2} - 3 = 0$, and $|0| = 0$. There is one solution.",
          "For $|2x - 3| = -5$, stop. The left side is a distance, so it is positive or 0 for every $x$. It can never equal $-5$. There are no real solutions. Do not write two branches when the number on the right is negative.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Solve $|-2x + 3| = \\tfrac{5}{2}$. Give the complete set of real solutions.",
      steps: [
        "The number on the right, $\\tfrac{5}{2}$, is positive. So the inside is $\\tfrac{5}{2}$ steps from 0 and can be $\\tfrac{5}{2}$ or $-\\tfrac{5}{2}$: $-2x + 3 = \\tfrac{5}{2}$ or $-2x + 3 = -\\tfrac{5}{2}$.",
        "First branch: subtract 3 from both sides to undo the + 3. Then $-2x = \\tfrac{5}{2} - \\tfrac{6}{2} = -\\tfrac{1}{2}$. Divide both sides by $-2$ to get $x$ alone: $x = -\\tfrac{1}{2} \\div (-2) = \\tfrac{1}{4}$.",
        "Second branch: subtract 3 from both sides. Then $-2x = -\\tfrac{5}{2} - \\tfrac{6}{2} = -\\tfrac{11}{2}$. Divide both sides by $-2$: $x = -\\tfrac{11}{2} \\div (-2) = \\tfrac{11}{4}$.",
        "Check $x = \\tfrac{1}{4}$: $-2 \\times \\tfrac{1}{4} + 3 = -\\tfrac{1}{2} + \\tfrac{6}{2} = \\tfrac{5}{2}$, and $|\\tfrac{5}{2}| = \\tfrac{5}{2}$.",
        "Check $x = \\tfrac{11}{4}$: $-2 \\times \\tfrac{11}{4} + 3 = -\\tfrac{11}{2} + \\tfrac{6}{2} = -\\tfrac{5}{2}$, and $|-\\tfrac{5}{2}| = \\tfrac{5}{2}$.",
        "Both answers work, so $x = \\tfrac{1}{4}$ or $x = \\tfrac{11}{4}$.",
      ],
      answer: "x = 1/4 or x = 11/4",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "For a positive number $c$, $|ax + b| = c$ has the same solutions as the pair $ax + b = c$ or $ax + b = -c$. Here $a$ is not 0. Solving both equations with steps that can be undone gives every real solution.",
        ],
      },
    ],
    pitfalls: [
      "Do not write $|2x - 3|$ as $|2x| - |3|$. For $x = 1$, the first is 1 but the second is $-1$.",
      "Solve both branches. Then put the $x$ answers, not the distances, back into the original equation.",
    ],
    parentGuide:
      "Ask why the solutions of $|x - 2| = 3$ sit on either side of 2 and not of 0. Then have your learner solve $|-2x + 3| = 0$ and explain why it has only one answer.",
  },
  {
    id: "absolute-value-transformed-equation",
    title: "Isolate an absolute value before solving",
    summary:
      "The absolute value of a number is its distance from 0, written with bars: $|-5| = 5$. In $-2|3x - 1| + 4 = -6$, the bars are multiplied by $-2$ and then 4 is added. Undo those outside steps first, so the bars stand alone: $|3x - 1| = 5$. Both 5 and $-5$ are 5 steps from 0, so solve $3x - 1 = 5$ and $3x - 1 = -5$. Some equations work for every number, and some for none.",
    templateIds: ["absolute-value-transformed-equation"],
    includeGeneratedRepresentation: false,
    senses,
    noLink,
    objectives: [
      "Solve absolute-value equations with numbers outside the bars, such as $-2|3x - 1| + 4 = -6$, and give every real solution.",
      "Tell apart no solution, one, two and endlessly many, without ever dividing by 0.",
    ],
    sections: [
      foundations,
      equations,
      branches,
      operations,
      {
        title: "Undo the outside operations first",
        paragraphs: [
          "To work out $-2|3x - 1| + 4$, you first find $3x - 1$, then its absolute value, then multiply by $-2$, then add 4. So $-2$ is the outside multiplier and 4 is the outside constant. To solve, undo the last step first. Subtract 4 from both sides, then divide both sides by $-2$.",
          "A negative number on the right of the original equation does not make it impossible. For $-2|3x - 1| + 4 = -6$, subtract 4 from both sides: $-2|3x - 1| = -10$. Divide both sides by $-2$: $|3x - 1| = 5$. That is a positive distance, so there are two branches. Check the sign only after the bars stand alone.",
          "For $2|x - 2| + 1 = 1$, subtract 1 and divide by 2 to get $|x - 2| = 0$, so $x = 2$. For $2|x - 2| + 1 = -3$, the same steps give $|x - 2| = -2$. A distance cannot be negative, so there are no real solutions.",
        ],
      },
      {
        title: "When a coefficient is zero",
        paragraphs: [
          "If the outside multiplier is 0, the whole absolute-value part disappears. In $0|2x + 1| + 4 = 4$, zero times any number is 0, so the equation becomes $4 = 4$. That is true, so every real $x$ works. Change the right side to 7, and you get $4 = 7$, which is false: no $x$ works. Never divide by an outside multiplier of 0.",
          "If the number multiplying $x$ inside the bars is 0, the inside is a plain number too. In $2|0x - 3| - 1 = 5$, $0x = 0$ for every $x$. So the left side is $2|-3| - 1 = 2 \\times 3 - 1 = 5$. It always equals 5, so every real number is a solution. If the right side were 4, there would be no solutions.",
          "Equations like these, with no $x$ left, have endlessly many solutions when true and none when false. When both multipliers are not 0, there are zero, one or two solutions, set by the distance once the bars stand alone.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Solve $-2|3x - 1| + 4 = -6$. Give the complete set of real solutions.",
      steps: [
        "The + 4 is the last outside step, so undo it first. Subtract 4 from both sides: $-2|3x - 1| = -6 - 4 = -10$.",
        "Undo the multiplication by $-2$. Divide both sides by $-2$: $|3x - 1| = -10 \\div (-2) = 5$. Now the bars stand alone.",
        "The distance 5 is positive, so the inside is 5 or $-5$: $3x - 1 = 5$ or $3x - 1 = -5$.",
        "First branch: add 1 to both sides to get $3x = 6$. Divide both sides by 3 to get $x = 2$.",
        "Second branch: add 1 to both sides to get $3x = -4$. Divide both sides by 3 to get $x = -\\tfrac{4}{3}$.",
        "Check $x = 2$: $3 \\times 2 - 1 = 5$, so the left side is $-2|5| + 4 = -10 + 4 = -6$. That matches.",
        "Check $x = -\\tfrac{4}{3}$: $3 \\times (-\\tfrac{4}{3}) - 1 = -4 - 1 = -5$, so the left side is $-2|-5| + 4 = -10 + 4 = -6$. That matches too.",
        "Both values make the original equation true, so $x = -\\tfrac{4}{3}$ or $x = 2$.",
      ],
      answer: "x = −4/3 or x = 2",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "Adding the same number to both sides, or dividing both sides by the same number other than 0, keeps an equation's solutions. Get the absolute value alone before splitting it into two equations. An equation with no $x$ left is true for every real $x$ or for none.",
        ],
      },
    ],
    pitfalls: [
      "Get the absolute value alone before you look at the sign of the right side. Multiplying by a negative number outside the bars can make the whole left side negative.",
      "Never divide by 0. If a multiplier is 0, work out the plain numbers and decide whether the equation is true or false.",
      "The two branches are joined by “or”: either one can give a solution.",
    ],
    parentGuide:
      "Before solving, ask your learner to sort $2|x - 2| + 1 = 1$, $2|x - 2| + 1 = -3$ and $0|x - 2| + 1 = 1$ by how many solutions each has. The answers are one, none and endlessly many. Ask what decides each count.",
  },
];
