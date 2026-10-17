import {
  Author,
  text,
  note,
  worked,
  balance,
  table,
  array,
} from "./authoring.js";
export function expressions(a: Author) {
  a.section = "entry";
  a.page(
    "welcome",
    "Balance and Change",
    [
      text(
        "Some mathematical questions ask what is missing. Others ask what happens when a quantity changes. Algebra connects these questions: we name quantities, describe relationships, and decide which claims stay true.",
      ),
      balance(
        "cover-balance",
        { bags: 2, units: 3 },
        { bags: 0, units: 11 },
        "What could one bag contain? Keep the same meaning for x wherever it appears.",
      ),
      note(
        "Two questions to carry",
        "What stays equal? What changes together? A good explanation connects the symbols to the quantities, not just to a remembered rule.",
      ),
    ],
    "opening",
    "Expressions, equations, graphs, and decisions",
  );
  a.page(
    "route",
    "Choose a useful starting point",
    [
      text(
        "Read, sketch, predict, then check. You may explain aloud before writing. The solutions show reasoning and checks; use them after a genuine attempt, then try a fresh question without looking.",
      ),
      note(
        "Route 1 · Build the meanings",
        "Begin with Mystery quantities and Read the structure if variables or parentheses feel unfamiliar. Continue through equality before solving equations.",
      ),
      note(
        "Route 2 · Connect procedures",
        "If you can solve equations but cannot explain the steps, begin with Equality faces both ways. Keep the original statement visible and check your solution there.",
      ),
      note(
        "Route 3 · Investigate change",
        "If equation reasoning is secure, begin with Two quantities together. Return to an earlier page when a model exposes a gap.",
      ),
      text(
        "This book develops selected grade-six through grade-eight ideas and a bridge to Algebra I. It assumes arithmetic with whole numbers, fractions, decimals and signed values. A brief arithmetic detour can help; it need not become a reason to avoid an interesting algebra question.",
      ),
      note(
        "Practice that lasts",
        "Mix an earlier question into each session. Revisit an idea on another day before calling it easy. Working it out today and remembering it later are different pieces of evidence.",
      ),
    ],
    "guide",
  );
  a.page(
    "entry",
    "Show how you see it",
    [
      text(
        "These are starting probes, not a grade. Show a diagram, words or equations. Notice whether a difficulty comes from the calculation, the notation, or the meaning of the question.",
      ),
      a.task(
        "entry-unknown",
        "A covered amount plus 4 is 13. Find the covered amount and explain how you can check it.",
        "9.",
        "Removing the known 4 from the total 13 leaves 9. Checking the original relationship gives 9 + 4 = 13. A drawing of thirteen objects with four separated is equally valid.",
        "A correct number without a check leaves the reasoning hidden.",
      ),
      a.task(
        "entry-structure",
        "Find 2(3 + 4). Draw or describe what the parentheses group together.",
        "14.",
        "The parentheses name one group containing 3 + 4 = 7. There are two such groups, so 2 × 7 = 14. Multiplying only the 3 gives a different expression, 2 × 3 + 4.",
        "Two groups of seven make fourteen.",
      ),
      a.task(
        "entry-fraction",
        "Find 3/4 of 8. Explain the size of one fourth before finding three fourths.",
        "6.",
        "One fourth of 8 is 8 ÷ 4 = 2. Three of those equal parts contain 3 × 2 = 6. The whole stays 8 throughout the explanation.",
        "6 is less than the whole 8 and greater than half of it.",
        "medium",
      ),
    ],
    "workshop",
  );
  a.section = "expressions";
  a.page("mystery", "Mystery quantities", [
    text(
      "Two identical bags and a 3-gram mass balance an 11-gram mass. Let x be the number of grams in one bag. Identical means that every x in this model names the same amount.",
    ),
    balance(
      "mystery-model",
      { bags: 2, units: 3 },
      { bags: 0, units: 11 },
      "The equation 2x + 3 = 11 describes equal masses.",
    ),
    note(
      "Predict before solving",
      "Could one bag contain 5 grams? Two such bags would already contain 10 grams, before the extra 3 grams is added.",
      "predict",
    ),
    a.task(
      "mystery-mass",
      "Find x. Explain why the bag must contain less than 5 grams.",
      "x = 4; each bag contains 4 grams.",
      "The two bags together contain 11 − 3 = 8 grams, so one contains 8 ÷ 2 = 4 grams. A 5-gram bag would make the left mass 2 × 5 + 3 = 13 grams, too large.",
      "Substitute: 2 × 4 + 3 = 11.",
    ),
  ]);
  a.page("expression-equation", "An amount or a claim?", [
    text(
      "An expression names an amount. An equation claims that two expressions have equal values. The expression 3x + 5 has no single numerical value until x is specified. The equation 3x + 5 = 20 asks which values of x make the claim true.",
    ),
    table(
      "expression-values",
      "x",
      "3x + 5",
      [
        { input: [0, 1], output: [5, 1] },
        { input: [2, 1], output: [11, 1] },
        { input: [5, 1], output: [20, 1] },
      ],
      "An expression can change value as its input changes.",
    ),
    a.task(
      "amount-or-claim",
      "A workshop charges 5 dollars to join and 3 dollars for each project. Write an expression for p projects, then an equation for a bill of 20 dollars.",
      "Expression: 3p + 5. Equation: 3p + 5 = 20.",
      "The project charge is 3 times the number p of projects. The joining charge is added once. The equation fixes the total bill; the expression alone permits different totals.",
      "For p = 5, the bill is 3 × 5 + 5 = 20 dollars.",
    ),
  ]);
  a.page("structure", "Read the structure", [
    text(
      "Parentheses tell us what belongs together. In 3(x + 2), the whole sum x + 2 is repeated three times. In 3x + 2, only x is tripled; the extra 2 is added once.",
    ),
    array(
      "structure-array",
      3,
      6,
      "At x = 4, each row contains 4 + 2 items. Three rows contain 18 items.",
      { column: 4 },
      { row: "3 equal groups", column: "4 + 2 in each group" },
    ),
    a.task(
      "structure-compare",
      "At x = 4, compare 3(x + 2) with 3x + 2. Explain the difference in where the extra twos appear.",
      "3(x + 2) = 18; 3x + 2 = 14.",
      "The first expression includes three extra twos, one in every group: 12 + 6 = 18. The second includes a single extra two: 12 + 2 = 14. The difference is two additional groups of two.",
      "The expressions are not equivalent merely because they use the same symbols.",
    ),
    a.task(
      "structure-translate",
      "Write an expression for “add 2 to a number, then triple the result.”",
      "3(x + 2), with x naming the original number.",
      "The word result refers to the complete sum x + 2. Parentheses preserve that grouping before multiplication by 3. A different variable letter is equally valid.",
      undefined,
      "short",
    ),
  ]);
  a.page("substitution", "Replace the whole input", [
    text(
      "To evaluate an expression, replace every occurrence of the variable with the same input. Parentheses help preserve a negative or fractional input as one quantity.",
    ),
    worked(
      "A negative input",
      "Evaluate 3x + 4 when x = −2.",
      [
        "Replace x: 3(−2) + 4.",
        "Multiply first: −6 + 4.",
        "Combine the signed values: −2.",
      ],
      "The expression has value −2. The input was −2, and the output happens to be −2 too; that coincidence is not a general rule.",
    ),
    a.task(
      "substitute-negative",
      "Evaluate 5 − 2x when x = −3. Explain the sign of the product.",
      "11.",
      "The product 2(−3) is −6. Subtracting this product gives 5 − (−6) = 11. Substitution must preserve the negative sign attached to the input.",
      "Writing 5 − 2 − 3 changes the multiplication into subtraction and gives a different expression.",
    ),
    a.task(
      "substitute-fraction",
      "Evaluate 2a + 1 when a = 3/4. Give an exact value.",
      "5/2, or 2 1/2.",
      "Two copies of 3/4 make 6/4 = 3/2. Adding one whole gives 3/2 + 2/2 = 5/2. The fraction represents one complete input, not just its numerator.",
      "Since 3/4 is between 1/2 and 1, twice it plus one must lie between 2 and 3.",
    ),
  ]);
  a.page("equivalent", "Same value for every input", [
    text(
      "Equivalent expressions have the same value for every input in their stated domain. A few matching examples can suggest a pattern, but they do not prove that the match continues. A structural explanation can.",
    ),
    array(
      "equivalent-array",
      2,
      7,
      "At x = 4, two groups of x + 3 contain two x-parts and six extra items.",
      { column: 4 },
      { row: "2 groups", column: "x + 3 when x = 4" },
    ),
    worked(
      "Explain the structure",
      "Why is 2(x + 3) equivalent to 2x + 6?",
      [
        "There are two copies of the entire sum x + 3.",
        "Distribute the two copies to both parts: 2x + 2 × 3.",
        "The fixed part is 6, so the expression becomes 2x + 6.",
      ],
      "The distributive property explains the equality for every real x, beyond this pictured example.",
    ),
    a.task(
      "equivalence-repair",
      "A learner writes 4(x + 2) = 4x + 2. Give one counterexample, then repair the expression.",
      "For example, x = 0 gives 8 on the left and 2 on the right. The correct form is 4x + 8.",
      "Each of the four groups contains an extra 2. That fixed part is 4 × 2 = 8. One counterexample disproves the proposed identity; distributivity explains the repaired identity for every real input.",
      "Do not claim that checking only x = 0 proves the repaired expression for all inputs.",
    ),
  ]);
  a.page("like-terms", "Combine like quantities", [
    text(
      "In 3x + 2x, both terms count copies of the same numerical quantity x. Five copies can be written 5x. In 3x + 2, the fixed number 2 is not two more copies of x.",
    ),
    table(
      "like-term-table",
      "x",
      "3x + 2",
      [
        { input: [0, 1], output: [2, 1] },
        { input: [1, 1], output: [5, 1] },
        { input: [4, 1], output: [14, 1] },
      ],
      "The fixed 2 does not change with x.",
    ),
    note(
      "A variable is not an object label",
      "If x is the mass of one bag in grams, 3x means three times that number of grams. It does not mean that the letter x is the name of a bag.",
      "misconception",
    ),
    a.task(
      "like-term-combine",
      "Simplify 3p + 2p + 4. Then explain why 3p + 4 cannot generally be replaced by 7p.",
      "3p + 2p + 4 = 5p + 4. In general, 3p + 4 is not 7p.",
      "The first two terms are five copies of p. The fixed 4 remains separate. For a counterexample to the second claim, p = 0 gives 4 on one side and 0 on the other.",
      "At p = 2, the original first expression and 5p + 4 both give 14.",
    ),
  ]);
  a.page(
    "expression-studio",
    "Make the structure visible",
    [
      text(
        "Choose words, a sketch or symbolic steps to make each claim inspectable. A convincing explanation says which quantities are grouped and why a change preserves their value.",
      ),
      a.task(
        "studio-expression",
        "Three packs each contain n cards and 4 bonus cards. Write two equivalent expressions for the total. Sketch a model that shows why they agree.",
        "3(n + 4) and 3n + 12.",
        "Each of the three packs contributes n ordinary cards and four bonus cards. A model should show three n-parts and twelve fixed bonus cards, with no part counted twice or omitted.",
        "For n = 5, both expressions give 27 cards. The grouping argument explains all nonnegative whole-number n.",
        "extended",
        "blank",
      ),
      a.task(
        "studio-counterexample",
        "A learner says 2x + 6 and 2(x + 3) agree only when x = 4 because that is the example shown. Do you agree? Explain.",
        "No. They agree for every real x.",
        "Distributing the 2 gives 2x + 2 × 3 = 2x + 6. The pictured x = 4 example illustrates the identity but does not restrict its domain.",
        "For x = −1, both expressions give 4; this is another example, not the general proof.",
      ),
    ],
    "workshop",
  );
}
