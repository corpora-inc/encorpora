import { Author, text, note, worked, balance, table } from "./authoring.js";
export function equations(a: Author) {
  a.section = "equations";
  a.page("equality", "Equality faces both ways", [
    text(
      "The equals sign means that two expressions have the same value. It does not mean “the answer comes next.” The statements x + 5 = 12 and 12 = x + 5 describe the same relationship.",
    ),
    balance(
      "equality-model",
      { bags: 0, units: 12 },
      { bags: 1, units: 5 },
      "The known total may appear on either side of the equality.",
    ),
    a.task(
      "equality-unknown",
      "Solve 12 = 5 + x. Write a check that keeps the equation in this order.",
      "x = 7. Check: 12 = 5 + 7, so 12 = 12.",
      "The known 5 and unknown x together make 12. Removing 5 from 12 leaves 7. Reversing which side contains the unknown does not change its value.",
      "Both sides of the original equation have value 12.",
    ),
    a.task(
      "equality-create",
      "Write an equality with a sum on each side, both equal to 12, and no number 12 written in the equation.",
      "For example, 8 + 4 = 6 + 6.",
      "Both expressions must evaluate to the same number, 12. Other examples such as 9 + 3 = 7 + 5 are equally valid. This form makes the relational meaning of equality visible.",
      undefined,
      "short",
    ),
  ]);
  a.page("preserve", "Change both sides together", [
    text(
      "A useful equation step preserves exactly the same solutions. Subtracting the same number from both sides is reversible: add it back to recover the original equation.",
    ),
    balance(
      "preserve-model",
      { bags: 2, units: 0 },
      { bags: 0, units: 8 },
      "After removing 3 grams from each side of 2x + 3 = 11, the equation is 2x = 8.",
    ),
    worked(
      "Keep equality intact",
      "Solve 2x + 3 = 11.",
      [
        "Subtract 3 from both sides: 2x = 8.",
        "Divide both sides by the same nonzero number, 2: x = 4.",
        "Check in the original equation: 2 × 4 + 3 = 11.",
      ],
      "The common bag mass is 4 grams. Each reversible step kept the same solution.",
    ),
    a.task(
      "preserve-one-side",
      "A learner changes 2x + 3 = 11 into 2x = 11. Explain what was removed and why the new equation has a different solution.",
      "The learner removed 3 only from the left. The new equation gives x = 11/2, not 4.",
      "Removing 3 from one side alone destroys equality. Substituting 11/2 in the original left side gives 11 + 3 = 14, which does not equal 11. The right side must also lose 3.",
      "The corrected intermediate equation is 2x = 8.",
    ),
  ]);
  a.page("inverse", "Undo an operation", [
    text(
      "Inverse operations undo one another. Adding 7 is undone by subtracting 7. Dividing by 3 is undone by multiplying by 3. Apply the operation to both sides of the equality.",
    ),
    worked(
      "An unknown share",
      "Solve x/3 = 4.",
      [
        "The unknown x was split into three equal shares.",
        "Multiply both sides by 3: x = 12.",
        "Check: 12/3 = 4.",
      ],
      "The original amount is 12. Multiplication reverses the division by the nonzero number 3.",
    ),
    a.task(
      "inverse-add",
      "Solve x + 7 = 19, and explain why subtracting 7 from both sides is useful.",
      "x = 12.",
      "Subtracting 7 undoes the addition attached to x. The right side becomes 19 − 7 = 12, while the left becomes x. Adding 7 back recovers the original statement.",
      "12 + 7 = 19.",
    ),
    a.task(
      "inverse-divide",
      "Solve x/5 = 3. Then write a story about equal sharing that matches the equation.",
      "x = 15. For example, 15 counters are shared equally among 5 people, giving 3 each.",
      "Multiplying both sides by 5 restores the whole amount from one of five equal shares. A valid story preserves which quantity is the total, which is the number of groups, and which is the amount per group.",
      "15/5 = 3. A different unit is valid if the roles match.",
    ),
  ]);
  a.page("check-original", "Finding is not checking", [
    text(
      "A solution is a value that makes the original equation true. Checking an intermediate line can miss an earlier mistake, so return to the original statement and evaluate both sides separately.",
    ),
    table(
      "checking-table",
      "Candidate x",
      "3x + 5",
      [
        { input: [5, 1], output: [20, 1] },
        { input: [6, 1], output: [23, 1] },
        { input: [7, 1], output: [26, 1] },
      ],
      "For the equation 3x + 5 = 23, only the row with output 23 works.",
    ),
    a.task(
      "check-candidate",
      "A learner claims x = 5 solves 3x + 5 = 23. Test the claim. Then find and check a solution.",
      "The claim is false. The solution is x = 6.",
      "At x = 5 the left side is 3 × 5 + 5 = 20, not 23. Removing 5 from 23 leaves 18, and 18 ÷ 3 = 6. Checking gives 3 × 6 + 5 = 23.",
      "A failed candidate helps locate the required value; it is not evidence that the equation has no solution.",
    ),
    note(
      "Say what your evidence shows",
      "One failed candidate rules out that candidate. To conclude that no real value works, you need an argument about all real values, not a few unsuccessful guesses.",
    ),
  ]);
  a.page("two-step", "Undo the outer operation", [
    text(
      "In 3x + 5, the input is first multiplied by 3 and then increased by 5. One efficient route reverses that order: remove the added 5, then divide by 3.",
    ),
    worked(
      "Two reversible decisions",
      "Solve 3x + 5 = 23.",
      [
        "Subtract 5 from both sides: 3x = 18.",
        "Divide both sides by 3: x = 6.",
        "Substitute into the original equation: 18 + 5 = 23.",
      ],
      "The solution is 6, whichever side of the equals sign contains 3x + 5.",
    ),
    a.task(
      "two-step-order",
      "Solve 23 = 5 + 3x. Explain why the order of the terms and the sides does not require a different answer.",
      "x = 6.",
      "The sum 5 + 3x equals 3x + 5 by the commutative property of addition. Reversing the sides preserves equality. Subtracting 5 and dividing by 3 gives the same solution.",
      "23 = 5 + 3 × 6 = 23.",
    ),
    a.task(
      "two-step-subtract",
      "Solve 4x − 3 = 21. Show each operation on both sides.",
      "x = 6.",
      "Add 3 to both sides to obtain 4x = 24, then divide both sides by 4. Addition undoes the subtraction of 3; division undoes multiplication by 4.",
      "4 × 6 − 3 = 21.",
    ),
  ]);
  a.page("grouped-equation", "Two routes, one solution", [
    text(
      "In 3(x + 2) = 24, the parentheses describe a whole group. You may undo the multiplication of that group, or distribute first. Compare the work rather than assuming that only one order is permitted.",
    ),
    worked(
      "Divide the grouped amount",
      "Solve 3(x + 2) = 24.",
      [
        "Divide both sides by 3: x + 2 = 8.",
        "Subtract 2 from both sides: x = 6.",
        "Check: 3(6 + 2) = 3 × 8 = 24.",
      ],
      "Dividing first keeps the grouped structure visible.",
    ),
    a.task(
      "grouped-other-route",
      "Solve the same equation by distributing first. Explain why your answer agrees with the worked route.",
      "3x + 6 = 24, then 3x = 18, then x = 6.",
      "Distributing changes the form of the expression without changing its value. Both routes then use reversible operations on both sides, so they preserve the original solution.",
      "Do not change 3(x + 2) into 3x + 2; the 3 multiplies both parts.",
    ),
    a.task(
      "grouped-transfer",
      "Solve 2(x − 3) = 10 using either route.",
      "x = 8.",
      "Dividing both sides by 2 gives x − 3 = 5, then adding 3 gives x = 8. Alternatively, distribute to obtain 2x − 6 = 10, then add 6 and divide by 2.",
      "2(8 − 3) = 10.",
    ),
  ]);
  a.page("both-sides", "The same unknown on both pans", [
    text(
      "When the same unknown appears on both sides, keep its meaning fixed. Removing one identical bag from each pan preserves the balance and leaves fewer unknown bags to compare.",
    ),
    balance(
      "both-sides-model",
      { bags: 3, units: 4 },
      { bags: 1, units: 14 },
      "Three bags and 4 grams balance one identical bag and 14 grams.",
    ),
    worked(
      "Remove equal unknown amounts",
      "Solve 3x + 4 = x + 14.",
      [
        "Subtract x from both sides: 2x + 4 = 14.",
        "Subtract 4 from both sides: 2x = 10.",
        "Divide by 2: x = 5.",
      ],
      "Both original pans have mass 19 grams when each bag contains 5 grams.",
    ),
    a.task(
      "both-sides-transfer",
      "Solve 5x + 4 = 2x + 19. Check both original sides.",
      "x = 5. Both sides equal 29.",
      "Subtracting 2x gives 3x + 4 = 19. Subtracting 4 gives 3x = 15, so x = 5. The left side is 25 + 4 and the right side is 10 + 19.",
      "Both values are 29; a matching solution from a different equation still needs its own check.",
    ),
  ]);
  a.page("negative-coefficient", "Keep the signs attached", [
    text(
      "Equations can describe signed quantities. Physical masses cannot be negative, so a bag-and-mass picture is not a model for every equation. Use signed-number reasoning and reversible symbolic steps instead.",
    ),
    worked(
      "A negative multiplier",
      "Solve −2x + 7 = 15.",
      [
        "Subtract 7 from both sides: −2x = 8.",
        "Divide both sides by −2: x = −4.",
        "Check: (−2)(−4) + 7 = 8 + 7 = 15.",
      ],
      "A negative input is needed because multiplying it by −2 must produce positive 8.",
    ),
    a.task(
      "negative-predict",
      "Before solving, explain why a positive x cannot satisfy −2x + 7 = 15.",
      "For positive x, −2x is negative, so −2x + 7 is less than 7 and cannot equal 15.",
      "This argument uses the sign and size of the expression, not a list of guesses. At x = 0 the left side is exactly 7; negative inputs can make it larger.",
      "The actual solution −4 gives the required value 15.",
    ),
    a.task(
      "negative-transfer",
      "Solve 5 − 3x = 20.",
      "x = −5.",
      "Subtract 5 from both sides: −3x = 15. Divide both sides by −3: x = −5. The minus sign belongs to the coefficient of x.",
      "5 − 3(−5) = 5 + 15 = 20.",
    ),
  ]);
  a.page("rational-equations", "Fractions are quantities too", [
    text(
      "The equality principles do not change when coefficients are fractions or decimals. Keep exact values until the quantities and units are clear.",
    ),
    worked(
      "Undo a fractional share",
      "Solve x/2 + 3 = 7.",
      [
        "Subtract 3 from both sides: x/2 = 4.",
        "Multiply both sides by 2: x = 8.",
        "Check: 8/2 + 3 = 4 + 3 = 7.",
      ],
      "A fraction bar expresses division; it does not require a different equality rule.",
    ),
    a.task(
      "decimal-equation",
      "A machine uses 1 liter to start and 2.5 liters per hour. Its total use is 11 liters. Solve 2.5t + 1 = 11 for the running time.",
      "t = 4 hours.",
      "After removing the starting use of 1 liter, 10 liters remain. Dividing 10 liters by 2.5 liters per hour gives 4 hours. The unit of the quotient is time.",
      "2.5 × 4 + 1 = 11 liters.",
    ),
    a.task(
      "fraction-coefficient",
      "Solve (3/4)x = 6. Explain why the answer is larger than 6.",
      "x = 8.",
      "Multiplying both sides by 4/3 gives x = 8. Equivalently, three fourths of the whole is 6, so one fourth is 2 and four fourths is 8. Taking only three fourths makes a positive amount smaller.",
      "(3/4) × 8 = 6.",
    ),
  ]);
  a.page("real-solution-sets", "One, none, or every real number", [
    text(
      "Solving means describing every value that makes an equation true. The outcome need not be one number. For this page, the allowed inputs are all real numbers.",
    ),
    worked(
      "Compare what survives",
      "Compare these three equations.",
      [
        "2(x + 3) = 18 becomes 2x = 12, so only x = 6 works.",
        "2(x + 3) = 2x + 5 becomes 6 = 5, an impossible claim. No real x works.",
        "2(x + 3) = 2x + 6 becomes 6 = 6, true independently of x. Every real x works.",
      ],
      "A contradiction means no solution. An identity means every allowed input is a solution; it does not mean x must be zero.",
    ),
    a.task(
      "sets-classify",
      "Classify each equation over the real numbers: (a) 3x + 4 = 3x + 9; (b) 4(x + 2) = 4x + 8; (c) 2x + 4 = 12. Explain each classification.",
      "(a) None. (b) Every real number. (c) One solution, x = 4.",
      "In (a), subtracting 3x gives the contradiction 4 = 9. In (b), distributing gives the identical expression 4x + 8 on both sides. In (c), subtracting 4 and dividing by 2 isolates x = 4.",
      "A few test values cannot establish the all-real or no-real claims; the structural simplifications do.",
    ),
  ]);
  a.page(
    "false-move",
    "A true result can lose information",
    [
      text(
        "Not every operation that produces a true statement preserves exactly the same solutions. A solving step must be reversible on the stated domain.",
      ),
      worked(
        "The zero trap",
        "Start with x = 2 and multiply both sides by 0.",
        [
          "The new statement is 0 = 0.",
          "That statement is true when x = 2, but also when x = 9 or any other real value.",
          "There is no inverse division by zero that recovers x = 2.",
        ],
        "The new equation has more solutions. It is a consequence of the original equation, not an equivalent replacement.",
      ),
      a.task(
        "zero-information",
        "Use x = 9 to explain why 0 = 0 cannot replace x = 2 when solving.",
        "x = 9 satisfies 0 = 0 but does not satisfy x = 2.",
        "An equivalent equation must have exactly the original solutions. The value 9 belongs to the new solution set but not to the original one, demonstrating that information was lost.",
        "Multiplying by a nonzero constant is reversible; multiplying by zero is not.",
      ),
      a.task(
        "repair-operation",
        "A learner changes 3(x + 2) = 24 into x + 2 = 24 by “removing the 3.” Repair the step and explain it.",
        "Divide both sides by 3 to obtain x + 2 = 8.",
        "The 3 is a multiplier of the whole grouped expression. Removing that multiplication means dividing both sides by 3, including the right side. Otherwise the equation changes its solution.",
        "The corrected route gives x = 6; 3(6 + 2) = 24.",
      ),
    ],
    "workshop",
  );
  a.page(
    "equation-studio",
    "Choose and justify your route",
    [
      text(
        "Keep an equation trail that another learner can follow. Name each operation and return to the original statement for the final check.",
      ),
      a.task(
        "equation-mixed",
        "Solve 4x + 3 = 2x + 17. Show a reversible step on every line and check both original sides.",
        "x = 7; both sides equal 31.",
        "Subtract 2x from both sides to obtain 2x + 3 = 17. Subtract 3 to obtain 2x = 14. Divide by 2 to obtain x = 7. The original sides are 28 + 3 and 14 + 17.",
        "A different reversible route is valid if it preserves the same solution and includes an original-equation check.",
        "large",
      ),
      a.task(
        "equation-design",
        "Create one equation with solution x = 3, one with no real solution, and one true for every real x. Explain why each has its claimed solution set.",
        "Examples: 2x + 1 = 7; 2x + 1 = 2x + 4; 2(x + 1) = 2x + 2.",
        "The first reduces to x = 3. The second reduces to 1 = 4, a contradiction. The third has identical expressions after distribution. Many examples are valid; their solution sets must be justified rather than asserted.",
        "Check that the equation intended to have one solution does not accidentally simplify to an identity.",
        "large",
      ),
    ],
    "workshop",
  );
  a.page("formula", "A formula connects measurements", [
    text(
      "A formula is an equation describing a relationship among quantities. A rectangle has two lengths and two widths, so its perimeter is P = 2L + 2W. The letters name measurements, with consistent units.",
    ),
    worked(
      "Find a missing width",
      "A rectangle has perimeter 30 cm and length 4 cm. Find its width.",
      [
        "Substitute the known values: 30 = 2 × 4 + 2W.",
        "Subtract 8 from both sides: 22 = 2W.",
        "Divide by 2: W = 11.",
      ],
      "The width is 11 cm. The perimeter check is 4 + 11 + 4 + 11 = 30 cm.",
    ),
    a.task(
      "formula-square",
      "A square has the same perimeter, 30 cm. Find its side length and check it.",
      "7.5 cm.",
      "A square has four equal sides, so 4s = 30 and s = 30/4 = 7.5. The four lengths add to 30. A fractional or decimal measurement is meaningful here.",
      "7.5 + 7.5 + 7.5 + 7.5 = 30 cm.",
    ),
    a.task(
      "formula-domain",
      "For rectangles with perimeter 30 cm, W = 15 − L. Explain why L = 16 is not a permitted physical length even though the expression can be evaluated.",
      "It would give W = −1 cm, which is not a rectangle width.",
      "The algebraic expression can be evaluated at 16, but the physical context requires both L and W to be positive. Thus the rectangle model uses lengths strictly between 0 and 15 cm.",
      "L = 15 would give zero width, a degenerate figure rather than a rectangle.",
    ),
  ]);
}
