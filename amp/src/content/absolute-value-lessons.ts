import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";
const terms: NonNullable<ProblemMethod["terms"]> = [
  [
    "absolute value",
    "Distance from zero on the number line. The bars |t| mean the absolute value of t.",
  ],
  [
    "solution set",
    "Every value of the variable that makes an equation true, with no extra values.",
  ],
  [
    "coefficient",
    "A number multiplying a variable or expression. In −2x, the coefficient of x is −2.",
  ],
];
export const absoluteValueMethods: Record<string, ProblemMethod> = {
  "absolute-value-direct-equation": {
    goal: "Find all real numbers whose absolute value equals the given number.",
    terms,
    method: [
      "Read the number on the other side as a proposed distance from zero.",
      "A positive distance gives its positive and negative values. Distance zero gives only zero. A negative distance gives no solutions.",
      "Check each value and state the complete set.",
    ],
    watch:
      "Absolute value is never negative, but the number inside the bars can be negative.",
  },
  "absolute-value-affine-equation": {
    goal: "Find all real values of x that give the expression inside the bars the required absolute value.",
    terms,
    method: [
      "If the target is negative, there are no real solutions. If it is zero, set the inside expression equal to zero.",
      "For a positive target, set the inside expression equal to the target or its opposite. Solve both equations.",
      "Undo the constant term, then divide by the nonzero coefficient of x. Keep exact fractions.",
      "Check every candidate in the original equation and include every valid value.",
    ],
    watch:
      "Apply the two signs to the whole target. Do not split the absolute value across an addition.",
  },
  "absolute-value-transformed-equation": {
    goal: "Isolate an absolute value, then find the complete real solution set.",
    terms,
    method: [
      "If an outside multiplier is zero, evaluate the resulting constant equation. If the coefficient of x inside is zero, evaluate that constant expression instead.",
      "Otherwise subtract the outside constant from both sides, then divide by the nonzero outside multiplier.",
      "A negative isolated target gives no solutions; zero gives one branch; a positive target gives two branches.",
      "Solve each branch and substitute each candidate in the original equation.",
    ],
    watch:
      "A negative number on the original right side can be valid. The sign test applies only after the absolute value is isolated. Never divide by zero.",
  },
};
export const absoluteValuePrinciples: Record<string, string> = {
  "absolute-value-direct-equation":
    "Absolute value is distance from zero. For a positive c, |x| = c exactly when x = c or x = −c; |x| = 0 exactly when x = 0; a negative c is impossible.",
  "absolute-value-affine-equation":
    "For positive c, |ax + b| = c is equivalent to ax + b = c or ax + b = −c. Solving both equations with reversible operations gives every real solution.",
  "absolute-value-transformed-equation":
    "Adding the same number and dividing by the same nonzero number preserve an equation's solutions. Isolate the absolute value before splitting into sign branches; a constant equality is true for all real x or for none.",
};
const foundations: Lesson["sections"][number] = {
  title: "Absolute value measures distance",
  paragraphs: [
    "This lesson uses addition, subtraction, multiplication, and division of positive and negative numbers. A real number is a number represented by a point on the number line, including whole numbers, negative numbers, fractions, and decimals. Equal distances on the line represent equal changes in value. Numbers increase to the right; negative numbers lie to the left of zero.",
    "The absolute value of a number is its distance from zero. Two vertical bars enclose the number: |3| = 3 and |−3| = 3, because both 3 and −3 are three units from zero. Also, |0| = 0. A distance cannot be negative. Thus an absolute value is nonnegative, which means positive or zero.",
    "The bars describe an operation on their entire contents. In |−3|, the number inside is negative, but the resulting distance is positive. In −|3|, the minus sign is outside: first find the distance 3, then take its opposite, giving −3. An opposite lies the same distance from zero on the other side; the opposite of zero is zero.",
  ],
};
const equations: Lesson["sections"][number] = {
  title: "What it means to solve an equation",
  paragraphs: [
    "A variable, such as x, stands for a number. An expression, such as 2x − 3, describes a quantity; 2x means 2 times x. An equation says that two expressions have equal values. A solution is a value of x that makes that equality true. To check a proposed solution, substitute it for every x and calculate both sides.",
    "The complete solution set contains every solution and no other values. The word or joins alternatives: x = −3 or x = 3 means either value works. It does not mean that x must have both values at once. No real solutions means that no point on the number line works; all real numbers means that every point works.",
  ],
};
const branches: Lesson["sections"][number] = {
  title: "Why there are two branches, one branch, or none",
  paragraphs: [
    "If a distance from zero is positive, exactly two points have that distance: one on each side of zero. Therefore |t| = 3 means t = 3 or t = −3. Here t represents the entire quantity inside the bars; it can be x or an expression involving x. The two equations are called branches because each is a separate possibility to solve.",
    "If the distance is zero, the two possibilities coincide: |t| = 0 means t = 0. Writing zero twice does not give two different solutions. If the proposed distance is negative, such as |t| = −3, there is no solution because distances cannot be negative.",
  ],
};
const operations: Lesson["sections"][number] = {
  title: "Solve each branch without changing its solutions",
  paragraphs: [
    "A coefficient is a number multiplying a variable; in −2x + 3, the coefficient of x is −2 and the constant term is 3. A constant does not depend on x. To isolate x means to leave x alone on one side of an equation. Subtract or add the same constant on both sides, then divide both sides by the nonzero coefficient. These operations are reversible, so they preserve exactly which values satisfy the equation. Division by zero is undefined.",
    "Keep fractions exact. In 3/2, the denominator 2 divides one unit into two equal parts, and the numerator 3 counts three such parts. A negative fraction is the opposite of that positive quantity. To add or subtract fractions, express them in equal-sized parts: 5/2 − 3 = 5/2 − 6/2 = −1/2. To divide by −2, multiply by its reciprocal −1/2, the number that gives 1 when multiplied by −2. Thus (−1/2) ÷ (−2) = (−1/2) × (−1/2) = 1/4.",
  ],
};
export const absoluteValueLessons: Lesson[] = [
  {
    id: "absolute-value-direct-equation",
    title: "Absolute-value equations: distance from zero",
    summary:
      "Find every number at a specified distance from zero, including the zero-distance and impossible-distance cases.",
    templateIds: ["absolute-value-direct-equation"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Interpret absolute value as a distance.",
      "Find complete solution sets for positive, zero, and negative targets.",
    ],
    sections: [
      foundations,
      equations,
      branches,
      {
        title: "Read the solution points",
        paragraphs: [
          "For |x| = 3, mark the two points three units from zero. Only −3 and 3 solve the equation; points between them have smaller distances. For |x| = 0, only the point zero works.",
          "A filled dot in these diagrams marks a solution, not an interval of solutions. The unmarked points between −3 and 3 do not solve |x| = 3, because each is less than three units from zero.",
        ],
        illustration: "absolute-value-distance",
      },
      {
        title: "Distances can be fractions",
        paragraphs: [
          "A unit is the distance from 0 to 1. Dividing that unit into two equal parts makes halves. In the fraction 3/2, the denominator 2 names those parts and the numerator 3 counts them. Three halves have length one and a half units. Therefore |x| = 3/2 has the two solutions x = −3/2 or x = 3/2. Keep the exact fraction when a distance is given as a fraction.",
          "The same reasoning works for every positive distance, whether whole or fractional. It depends on distance and direction, not on counting whole-number steps.",
        ],
      },
    ],
    workedExample: {
      prompt: "Solve |x| = 3. Give the complete set of real solutions.",
      steps: [
        "The target distance 3 is positive. The two points three units from zero are 3 and −3.",
        "The two branches are x = 3 or x = −3.",
        "Check x = 3: |3| = 3. Check x = −3: |−3| = 3. Both equal the right side.",
        "No other point is exactly three units from zero. The complete solution set is x = −3 or x = 3.",
      ],
      answer: "x = −3 or x = 3",
    },
    pitfalls: [
      "Do not discard the negative solution: a negative number can have a positive distance from zero.",
      "For a zero target, list zero once. For a negative target, report no real solutions.",
    ],
    parentGuide:
      "Ask the learner to draw the solutions of |x| = 2, |x| = 0, and |x| = −2, and explain why the numbers of solutions are two, one, and zero. Then ask for |x| = 1/2.",
  },
  {
    id: "absolute-value-affine-equation",
    title: "Absolute value of a linear expression",
    summary:
      "Split a positive distance into two sign possibilities, solve both equations, and check their values in the original expression.",
    templateIds: ["absolute-value-affine-equation"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Solve both branches of an absolute-value equation with a linear expression inside.",
      "Explain zero and negative targets and retain exact fractional solutions.",
    ],
    sections: [
      foundations,
      equations,
      branches,
      {
        title: "The distance belongs to the whole inside expression",
        paragraphs: [
          "In |2x − 3| = 5, the number whose distance is 5 is 2x − 3, not x. It must equal 5 or −5. The branches are 2x − 3 = 5 or 2x − 3 = −5. Adding 3 gives 2x = 8 or 2x = −2; dividing by 2 gives x = 4 or x = −1. The solutions need not be opposites, because the expression inside is not simply x.",
          "The expression x − 2 is the signed displacement from 2 to x: it is positive to the right of 2 and negative to the left. Its absolute value is the distance between x and 2. Thus |x − 2| = 3 places the solutions three units on either side of 2, at −1 and 5. The center 2 is not a solution because its distance from itself is zero.",
        ],
        illustration: "absolute-value-shifted",
      },
      operations,
      {
        title: "Zero and negative targets",
        paragraphs: [
          "For |2x − 3| = 0, set 2x − 3 = 0. Add 3 to obtain 2x = 3, then divide by 2 to obtain x = 3/2. Check: 2 × (3/2) − 3 = 0 and |0| = 0. There is one solution.",
          "For |2x − 3| = −5, stop: the left side is nonnegative for every real x, so it cannot equal −5. There are no real solutions. Do not create sign branches for a negative target.",
        ],
      },
    ],
    workedExample: {
      prompt: "Solve |−2x + 3| = 5/2. Give the complete set of real solutions.",
      steps: [
        "Because 5/2 is positive, the inside expression can be 5/2 or −5/2: −2x + 3 = 5/2 or −2x + 3 = −5/2.",
        "First branch: subtract 3 from both sides. Then −2x = 5/2 − 3 = 5/2 − 6/2 = −1/2. Divide by −2: x = (−1/2) ÷ (−2) = 1/4.",
        "Second branch: subtract 3 from both sides. Then −2x = −5/2 − 3 = −5/2 − 6/2 = −11/2. Divide by −2: x = (−11/2) ÷ (−2) = 11/4.",
        "Check x = 1/4: −2 × (1/4) + 3 = −1/2 + 6/2 = 5/2, so |5/2| = 5/2.",
        "Check x = 11/4: −2 × (11/4) + 3 = −11/2 + 6/2 = −5/2, so |−5/2| = 5/2.",
        "Both branches give valid solutions, so x = 1/4 or x = 11/4.",
      ],
      answer: "x = 1/4 or x = 11/4",
    },
    pitfalls: [
      "Do not write |2x − 3| as |2x| − |3|. For x = 1, the first is 1 but the second is −1.",
      "Solve both sign branches and substitute the resulting x values, not the target distances, into the original equation.",
    ],
    parentGuide:
      "Ask why the solutions of |x − 2| = 3 are centered at 2 rather than zero. Then have the learner solve |−2x + 3| = 0 and explain why there is only one answer.",
  },
  {
    id: "absolute-value-transformed-equation",
    title: "Isolate an absolute value before solving",
    summary:
      "Undo operations outside the bars, identify the possible inside values, and recognize equations that hold for every real number or for none.",
    templateIds: ["absolute-value-transformed-equation"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Solve shifted and scaled absolute-value equations with exact real solution sets.",
      "Distinguish zero, one, two, and infinitely many real solutions without dividing by zero.",
    ],
    sections: [
      foundations,
      equations,
      branches,
      operations,
      {
        title: "Undo the outside operations first",
        paragraphs: [
          "In −2|3x − 1| + 4, first calculate 3x − 1, then its absolute value, then multiply that distance by −2, then add 4. The outside multiplier is −2 and the outside constant is 4. To solve an equation, undo the last operation first: subtract 4 from both sides, then divide both sides by −2.",
          "A negative original right side does not make the equation impossible. For −2|3x − 1| + 4 = −6, subtracting 4 gives −2|3x − 1| = −10. Dividing by −2 gives |3x − 1| = 5, a positive distance with two branches. The sign test applies to this isolated distance.",
          "For 2|x − 2| + 1 = 1, subtract 1 and divide by 2 to obtain |x − 2| = 0, so x = 2. For 2|x − 2| + 1 = −3, those steps give |x − 2| = −2, which has no real solutions.",
        ],
      },
      {
        title: "When a coefficient is zero",
        paragraphs: [
          "A zero outside multiplier removes the entire absolute-value term. For 0|2x + 1| + 4 = 4, zero times any real quantity is zero, so the equation becomes 4 = 4. Every real x works. Changing the right side to 7 gives 4 = 7, a false statement; no real x works. Do not divide by the outside coefficient when it is zero.",
          "A zero coefficient of x inside the bars also makes the expression constant. In 2|0x − 3| − 1 = 5, we have 0x = 0 for every x. The left side is 2|−3| − 1 = 2 × 3 − 1 = 5. Thus every real number is a solution. If the right side were 4, there would be no solutions.",
          "These constant equations have infinitely many solutions when true and no solutions when false. A nonzero coefficient inside and a nonzero outside multiplier instead give zero, one, or two solutions, according to the isolated distance.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Solve −2|3x − 1| + 4 = −6. Give the complete set of real solutions.",
      steps: [
        "Subtract 4 from both sides: −2|3x − 1| = −6 − 4 = −10.",
        "Divide by −2: |3x − 1| = (−10) ÷ (−2) = 5.",
        "The inside expression can be 5 or −5: 3x − 1 = 5 or 3x − 1 = −5.",
        "First branch: add 1 to obtain 3x = 6, then divide by 3 to obtain x = 2.",
        "Second branch: add 1 to obtain 3x = −4, then divide by 3 to obtain x = −4/3.",
        "Check x = 2: 3 × 2 − 1 = 5, so the original left side is −2|5| + 4 = −10 + 4 = −6.",
        "Check x = −4/3: 3 × (−4/3) − 1 = −4 − 1 = −5, so the original left side is −2|−5| + 4 = −10 + 4 = −6.",
        "Both values satisfy the original equation, so x = −4/3 or x = 2.",
      ],
      answer: "x = −4/3 or x = 2",
    },
    pitfalls: [
      "Isolate the absolute value before inspecting the target's sign. Outside multiplication can make the whole left side negative.",
      "Do not divide by zero. Evaluate constant equations and decide whether they are true or false.",
      "Changing an equation to two branches requires or: either branch can provide a solution.",
    ],
    parentGuide:
      "Ask the learner to classify 2|x − 2| + 1 = 1, 2|x − 2| + 1 = −3, and 0|x − 2| + 1 = 1 before solving. The answers are one, zero, and infinitely many solutions. Ask which feature determines each count.",
  },
];
