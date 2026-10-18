import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

const terms: NonNullable<ProblemMethod["terms"]> = [
  [
    "inequality",
    "A comparison using <, ≤, >, or ≥. These signs mean less than, less than or equal to, greater than, and greater than or equal to.",
  ],
  ["solution set", "All values of the variable that make the comparison true."],
  [
    "coefficient",
    "The number multiplying a variable. In −3x, the coefficient of x is −3.",
  ],
];
export const inequalityMethods: Record<string, ProblemMethod> = {
  "affine-linear-inequality": {
    goal: "Find every real value of x that makes a linear inequality true.",
    terms,
    method: [
      "Add or subtract the same number on both sides to isolate the variable term.",
      "Divide both sides by the coefficient of x. Keep the comparison sign for a positive divisor; reverse it for a negative divisor.",
      "Write the complete solution set. The signs ≤ and ≥ include the boundary; < and > exclude it.",
      "Check the boundary and a value on the indicated side by substitution.",
    ],
    watch:
      "Solving an inequality usually gives many values, not just the boundary. Adding a negative number does not reverse the comparison sign.",
  },
  "grouped-linear-inequality": {
    goal: "Find the complete solution set when parentheses and variable terms appear on both sides.",
    terms: [
      ...terms,
      [
        "distribute",
        "Multiply every term inside parentheses by the outside factor.",
      ],
    ],
    method: [
      "Distribute the outside factor to each term, including its sign. Combine constant terms on each side.",
      "Subtract the same variable term from both sides, then subtract the same constant from both sides.",
      "Divide by the remaining nonzero coefficient. Reverse the comparison sign exactly when the divisor is negative.",
      "Keep an exact fraction for the boundary. Check both the boundary and a value inside the solution set.",
    ],
    watch:
      "Subtracting a variable term from both sides preserves the comparison for each value of x. The sign reversal comes from dividing by a negative coefficient.",
  },
  "cancelled-linear-inequality": {
    goal: "Decide whether every real number or no real number satisfies an inequality after variable terms cancel.",
    terms,
    method: [
      "Distribute, combine constants, and subtract the matching variable terms from both sides.",
      "Read the resulting numerical comparison. Equal numbers satisfy ≤ and ≥, but do not satisfy < or >.",
      "If the comparison is true, every real x is a solution. If it is false, there are no real solutions.",
    ],
    watch:
      "Zero times x is zero for every x. Cancelling the variable terms does not prove x = 0, and division by zero is undefined.",
  },
};
export const inequalityPrinciples: Record<string, string> = {
  "affine-linear-inequality":
    "Adding the same number preserves order. Multiplication or division by a positive number preserves order; by a negative number it reverses order. These reversible steps preserve the solution set.",
  "grouped-linear-inequality":
    "Distribution rewrites the same quantity. Adding or subtracting matching terms on both sides preserves the comparison for each x; division by a negative number reverses its direction.",
  "cancelled-linear-inequality":
    "When the variable terms cancel, the remaining comparison does not depend on x. A true comparison holds for every real x; a false one holds for none.",
};

const foundations: Lesson["sections"][number] = {
  title: "What the comparison means",
  paragraphs: [
    "This lesson uses arithmetic with positive and negative numbers and fractions. A real number is a number represented by a point on the number line. This includes whole numbers, negative numbers, fractions, and decimals. Numbers increase to the right. A variable, such as x, stands for a number whose value can vary.",
    "An inequality compares two quantities. The sign < means less than, and > means greater than. The sign ≤ means less than or equal to; ≥ means greater than or equal to. For example, 2 < 5 is true, 5 < 5 is false, and 5 ≤ 5 is true. The open side of each sign faces the greater quantity when the quantities differ.",
    "A solution is a value of x that makes the comparison true when substituted for x. The solution set contains every such value. For x < 2, the numbers 1, 0, −3, and 3/2 are solutions, but 2 and 5 are not. The boundary 2 separates the allowed values from the disallowed values; < excludes that boundary, while ≤ includes it. A list of a few examples is not the complete solution set: there are infinitely many numbers less than 2.",
  ],
};
const order: Lesson["sections"][number] = {
  title: "Why a negative divisor reverses the sign",
  paragraphs: [
    "Adding the same number to both quantities moves them equally far along the number line, so their order stays the same. Subtracting the same number also preserves their order. For example, 2 < 5 gives 2 − 7 < 5 − 7, or −5 < −2. A negative result does not by itself require reversing the sign.",
    "Multiplying by a positive number changes distances from zero but preserves left-to-right order. Multiplying by a negative number also reflects the line through zero, reversing that order. For example, −2 < 3, but multiplying both sides by −2 gives 4 > −6. Division by a negative number has the same effect, because dividing by that number means multiplying by its reciprocal, which is also negative.",
    "A reciprocal is the number that multiplies a nonzero number to give 1. The reciprocal of −2 is −1/2. Thus dividing by −2 means multiplying by −1/2. Reverse < to >, > to <, ≤ to ≥, or ≥ to ≤. Whether equality is allowed stays unchanged. Division by zero is undefined.",
    "The notation 2/3 × x means multiply x by 2/3; its coefficient is 2/3. A fractional coefficient follows the same rules. To solve −2/3 × x ≤ 4, multiply both sides by its reciprocal, −3/2, and reverse ≤ to ≥. The result is x ≥ 4 × (−3/2) = −6.",
  ],
};
export const inequalityLessons: Lesson[] = [
  {
    id: "affine-linear-inequality",
    title: "Solve a linear inequality",
    summary:
      "Find a boundary, decide which side is allowed, and state whether the boundary is included.",
    templateIds: ["affine-linear-inequality"],
    objectives: [
      "Solve one-variable linear inequalities with signed rational coefficients.",
      "Explain negative-divisor reversal and boundary inclusion.",
    ],
    sections: [
      foundations,
      {
        title: "Describe a whole set on the number line",
        paragraphs: [
          "The number 2 is the boundary of x < 2: values on one side satisfy the inequality and values on the other side do not. Draw an open circle at 2 to show that 2 itself is excluded. Mark the line to the left, with an arrow indicating that it continues without end. This set is called a half-line.",
          "For x ≤ 2, fill the circle because 2 is included. For x > 2 or x ≥ 2, mark the line to the right. The direction and the open or filled boundary carry different information; both matter. Every point along the marked line is included, not only the labeled whole numbers.",
        ],
        illustration: "inequality-half-lines",
      },
      {
        title: "Isolate the variable without changing the solutions",
        paragraphs: [
          "The expression −3x + 2 means multiply x by −3, then add 2. Its coefficient is −3, the number multiplying x; 2 is a constant, a number that does not vary with x. A linear inequality contains variable terms that are numbers times x, with no x² or other powers of x.",
          "To isolate x means to leave x alone on one side. Undo addition or subtraction first, applying the same operation to both sides. Then undo multiplication by dividing both sides by the nonzero coefficient. Each step must be reversible, so the transformed inequality has exactly the same solutions as the original.",
          "Coefficients and boundaries may be fractions. In 3/2, the denominator 2 divides a unit into two equal parts, and the numerator 3 counts three such parts. A negative fraction is the opposite of the corresponding positive fraction. Keep an exact fraction such as 5/3 instead of rounding: a rounded boundary changes which nearby values are included.",
        ],
      },
      order,
    ],
    workedExample: {
      prompt: "Find all real x for which −3x + 2 ≤ 7.",
      steps: [
        "Subtract 2 from both sides: −3x + 2 − 2 ≤ 7 − 2, so −3x ≤ 5.",
        "Divide both sides by −3. Because −3 is negative, reverse ≤ to ≥: (−3x)/(−3) ≥ 5/(−3).",
        "Simplify: x ≥ −5/3. The solution contains −5/3 and every greater real number.",
        "Check the boundary in the original expression: −3 × (−5/3) + 2 = 5 + 2 = 7. Equality is allowed, so the boundary is included.",
        "Check the direction: x = 0 gives 2 ≤ 7, which is true. A value on the other side, x = −2, gives 8 ≤ 7, which is false.",
      ],
      answer: "x ≥ −5/3",
    },
    pitfalls: [
      "Do not reverse the sign when adding or subtracting, even when the added number is negative.",
      "The boundary alone is not the solution set. Include its direction and whether equality is allowed.",
    ],
    parentGuide:
      "Ask the learner to read the final inequality in words, explain why the sign reversed, and give a solution that is not a whole number. Then change ≤ in the original problem to < and ask what changes at the boundary.",
  },
  {
    id: "grouped-linear-inequality",
    title: "Solve inequalities with parentheses",
    summary:
      "Expand each group, collect matching terms, and preserve the complete solution set.",
    templateIds: ["grouped-linear-inequality"],
    objectives: [
      "Distribute signed factors and collect variable terms on both sides.",
      "Solve exactly and check boundary inclusion and direction.",
    ],
    sections: [
      foundations,
      {
        title: "Parentheses group a quantity",
        paragraphs: [
          "A term is a part of a sum, with its sign. In 2x − 3, the terms are 2x and −3. The coefficient 2 multiplies x; the constant −3 has no variable. In −2(2x − 3), the parentheses group the entire quantity 2x − 3 for multiplication by −2.",
          "The distributive property says a(b + c) = ab + ac: multiplying a sum multiplies every term. Therefore −2(2x − 3) = (−2)(2x) + (−2)(−3) = −4x + 6. Both terms receive the outside factor. The constant becomes positive because the product of two negative numbers is positive.",
          "Like terms have the same variable part. Their coefficients combine: −4x − x = (−4 − 1)x = −5x. Constants combine with constants: 6 + 1 = 7. We cannot combine −4x and 7 into one variable term, because only the first varies with x.",
        ],
      },
      {
        title: "Collect variable terms on one side",
        paragraphs: [
          "Subtract the same variable term from both sides. For any chosen x, you subtract the same number from each side, so their comparison remains valid. For example, subtracting x from −4x + 7 > x + 2 gives −5x + 7 > 2. Subtracting 7 then gives −5x > −5.",
          "These are equivalent inequalities: they have exactly the same solution set. Distribution changes the way a quantity is written, not its value. Adding or subtracting matching terms preserves order. When the remaining coefficient is nonzero, division isolates x; a negative divisor reverses the sign.",
          "Write fractional boundaries exactly. In a fraction, the denominator tells how many equal parts make one unit, and the numerator counts those parts. For example, 1/2 is one of two equal parts of a unit. Rounding 1/3 to 0.33 would move the boundary and give a different solution set.",
        ],
      },
      order,
    ],
    workedExample: {
      prompt: "Find all real x for which −2(2x − 3) + 1 > x + 9/2.",
      steps: [
        "Distribute −2: −4x + 6 + 1 > x + 9/2.",
        "Combine constants: −4x + 7 > x + 9/2.",
        "Subtract x from both sides: −5x + 7 > 9/2.",
        "Subtract 7 from both sides: −5x > 9/2 − 7. Since 7 = 14/2, the right side is (9 − 14)/2 = −5/2.",
        "Divide both sides by −5 and reverse > to <: x < (−5/2) ÷ (−5) = (−5/2) × (−1/5) = 1/2.",
        "Check the boundary in the original inequality: at x = 1/2, the left side is −2(1 − 3) + 1 = 5 and the right side is 1/2 + 9/2 = 5. Strict > excludes this equality.",
        "At x = 0, the original sides are 7 and 9/2; 7 > 9/2 is true. At x = 1, they are 3 and 11/2; 3 > 11/2 is false. These checks agree with x < 1/2.",
      ],
      answer: "x < 1/2",
    },
    pitfalls: [
      "An outside negative factor multiplies every term, including a negative constant.",
      "A successful check of one value does not prove the whole solution set. Reversible algebra establishes the set; substitution checks the calculation and direction.",
    ],
    parentGuide:
      "Ask what each transformation preserves. Have the learner explain why subtracting x preserves the comparison even though x is unknown, and why dividing by −5 reverses it.",
  },
  {
    id: "cancelled-linear-inequality",
    title: "When the variable terms cancel",
    summary:
      "A comparison that no longer depends on x can be true for every input or false for every input.",
    templateIds: ["cancelled-linear-inequality"],
    objectives: [
      "Recognize cancellation after distribution.",
      "Distinguish all real solutions from no real solutions, including equal-constant cases.",
    ],
    sections: [
      {
        title: "What counts as a solution",
        paragraphs: [
          "This lesson uses arithmetic with positive and negative numbers. A real number is a number represented by a point on the number line, including whole numbers, negative numbers, fractions, and decimals. A variable, such as x, stands for a number whose value can vary.",
          "An inequality compares quantities. The signs < and > mean less than and greater than; ≤ and ≥ also allow equality. For example, 2 < 5 and 5 ≤ 5 are true, but 5 < 5 is false. A solution is a value of x that makes the comparison true when substituted for x. The solution set contains every such value.",
        ],
      },
      {
        title: "Remove matching variable terms",
        paragraphs: [
          "A coefficient is the number multiplying a variable; a constant does not vary with the variable. In 3x + 5 < 3x + 8, the coefficient of x is 3 on each side. Subtracting 3x from both sides leaves 5 < 8. For each possible x, you have subtracted the same quantity from both sides, so the comparison keeps the same truth value.",
          "The statement 5 < 8 is true and contains no x. Therefore every real number satisfies the original inequality. Its solution set is all real numbers: the entire number line, without a boundary. For example, x = 0 gives 5 < 8, and x = −2 gives −1 < 2. The subtraction argument proves the result for every x, not only these examples.",
          "If the original inequality were 3x + 5 > 3x + 8, subtraction would leave 5 > 8, which is false. No choice of x can change that result. Its solution set is empty: no real numbers satisfy it.",
        ],
      },
      {
        title: "Equal quantities require attention to the sign",
        paragraphs: [
          "Equal numbers satisfy ≤ and ≥. Thus 5 ≤ 5 and 5 ≥ 5 are true. Equal numbers do not satisfy the strict signs < and >: 5 < 5 and 5 > 5 are false. When variable terms cancel, this distinction can decide between all solutions and no solutions.",
          "For example, 2x + 4 ≤ 2x + 4 is true for every real x. Replacing ≤ by < makes it false for every real x. Both sides have the same value for each input, so neither side can be strictly smaller than the other.",
        ],
      },
      {
        title: "Expand before deciding",
        paragraphs: [
          "Parentheses may hide matching variable terms. Distribution means multiplying each term inside by the outside factor. For example, −2(x − 3) = (−2)x + (−2)(−3) = −2x + 6. Adding a further constant gives −2(x − 3) + 1 = −2x + 7.",
          "After cancellation, the variable coefficient is zero: 3x − 3x = 0x = 0 for every x. This does not force x to be zero. Do not divide by that zero coefficient. Instead, read the remaining numerical comparison and decide whether it is true or false.",
        ],
      },
    ],
    workedExample: {
      prompt: "Find all real x for which −2(x − 3) + 1 ≥ −2x + 7.",
      steps: [
        "Distribute −2: −2x + 6 + 1 ≥ −2x + 7.",
        "Combine the constants: −2x + 7 ≥ −2x + 7.",
        "Add 2x to both sides: 7 ≥ 7.",
        "This comparison is true because equality is allowed. It no longer depends on x, so every real x satisfies the original inequality.",
        "If the original sign were > instead, the final comparison would be 7 > 7, which is false. That changed problem would have no real solutions.",
      ],
      answer: "All real numbers",
    },
    pitfalls: [
      "No variable remaining does not mean no solutions. The truth of the remaining comparison decides.",
      "Do not report x = 0 after cancellation. Zero is either one of infinitely many solutions or is not a solution at all.",
    ],
    parentGuide:
      "Change the right-hand constant from 7 to 8, then to 6. Ask the learner to classify each solution set and explain the result without trying a long list of inputs.",
  },
];
