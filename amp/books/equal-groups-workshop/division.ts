import { Author, array, note, text, worked } from "./authoring.js";
export function division(a: Author) {
  const task = a.task.bind(a);
  a.section = "division";
  a.page("share", "How much does each person get?", [
    text(
      "Eighteen counters are shared equally among three people. We know the total and the number of people. The missing quantity is the count each person receives.",
    ),
    array(
      "share-array",
      3,
      6,
      "Each row belongs to one person. Three equal rows of six use all eighteen counters.",
      undefined,
      { row: "3 people", column: "6 counters each" },
    ),
    text(
      "18 ÷ 3 = 6 answers a sharing question: eighteen counters, three people, six counters per person.",
    ),
    task(
      "share-amount",
      "Share 24 buttons equally among 4 children. Find the count per child and explain how a model could show it.",
      "6 buttons per child.",
      "Arrange twenty-four counters into four equal rows or deal them one at a time. Each row contains six.",
      "4 × 6 = 24.",
      "medium",
    ),
    task(
      "share-check",
      "Four children receive 5, 5, 6, and 8 buttons. All 24 buttons were used. Does that prove the sharing was fair?",
      "No. The total is correct, but the shares are unequal.",
      "A fair equal share needs both conditions: all twenty-four buttons used and every child receiving the same count. Six each meets both.",
      undefined,
      "short",
    ),
  ]);
  a.page("measure-groups", "How many groups can we make?", [
    text(
      "Eighteen counters are packed six per bag. We know the total and the count per bag. The missing quantity is the number of bags.",
    ),
    array(
      "measure-array",
      3,
      6,
      "Each row is a bag of six counters. Three bags use all eighteen.",
      undefined,
      { row: "3 bags", column: "6 counters per bag" },
    ),
    text(
      "18 ÷ 6 = 3 answers a grouping question: eighteen counters, six per bag, three bags. The answer counts bags, not counters per bag.",
    ),
    task(
      "groups-number",
      "Pack 24 buttons with 6 buttons in every bag. How many bags can you fill?",
      "4 bags.",
      "Count groups of six until all twenty-four buttons are used: 6, 12, 18, 24. There are four groups.",
      "4 × 6 = 24.",
      "short",
    ),
    task(
      "groups-contrast",
      "Tell two different stories for 24 ÷ 4 = 6: one about equal sharing and one about making groups of a chosen size. Label what 6 means in each.",
      "Examples: 24 buttons among 4 people gives 6 buttons each; 24 buttons packed 4 per bag fills 6 bags.",
      "In sharing, four counts recipients and six is the size of a share. In grouping, four is the group size and six counts groups.",
      undefined,
      "medium",
    ),
  ]);
  a.page("inverse", "One array, four connected equations", [
    array(
      "inverse-array",
      3,
      8,
      "The same 24 cells show 3 × 8, 8 × 3, 24 ÷ 3, and 24 ÷ 8.",
    ),
    text(
      "Division asks for a missing factor. To find 24 ÷ 3, ask: three times what equals twenty-four? Multiplication and division are inverse operations when the divisor is not zero.",
    ),
    task(
      "inverse-family",
      "Use 6 × 7 = 42 to write two division equations. Explain which factor each finds.",
      "42 ÷ 6 = 7 and 42 ÷ 7 = 6.",
      "Dividing the total by one nonzero factor finds the other factor. A rotated six-by-seven array supports both relationships.",
      undefined,
      "medium",
    ),
    task(
      "inverse-check",
      "A learner thinks 56 ÷ 8 = 6. Use multiplication to check and repair the answer.",
      "56 ÷ 8 = 7.",
      "Eight groups of six contain forty-eight, not fifty-six. One more group of eight reaches fifty-six, so seven groups are needed.",
      "8 × 7 = 56.",
      "medium",
    ),
  ]);
  a.page("unknown", "The missing number can move", [
    worked(
      "Read the whole equation",
      "How can ? ÷ 4 = 6 be true?",
      [
        "The missing number is the total before sharing or grouping.",
        "Four groups of six make twenty-four.",
        "Put twenty-four back into the equation: 24 ÷ 4 = 6.",
      ],
      "The missing total is 24. Do not divide 6 by 4 just because those are the visible numbers.",
    ),
    task(
      "unknown-equations",
      "Find the missing values: 6 × ? = 42; ? ÷ 4 = 6; 24 ÷ ? = 8. Check each completed equation.",
      "7; 24; 3.",
      "6 × 7 = 42. A total of 24 divided by 4 gives 6. Dividing 24 by 3 gives 8 because 3 × 8 = 24.",
      undefined,
      "medium",
    ),
    task(
      "unknown-story",
      "Choose one equation above and tell a matching story. Explain which quantity is unknown.",
      "Example: 24 cards are shared equally among some people, each getting 8 cards. There are 3 people.",
      "This matches 24 ÷ ? = 8, where the divisor counts people. Accept another story whose quantities and unknown position match the selected equation.",
      undefined,
      "large",
      "blank",
    ),
  ]);
  a.page("division-zero", "Empty shares and impossible groups", [
    text(
      "Zero counters can be shared among four people: everyone receives zero. So 0 ÷ 4 = 0. The check is 4 × 0 = 0.",
    ),
    worked(
      "A different question",
      "Could 12 ÷ 0 have a number as its answer?",
      [
        "For that answer to work, zero times the answer would have to equal twelve.",
        "But zero times every number is zero, never twelve.",
      ],
      "Division by zero is undefined. It is not a way to get zero as an answer.",
    ),
    note(
      "Keep the divisor in view",
      "0 ÷ 4 is defined. 4 ÷ 0 is not. Even 0 ÷ 0 has no unique quotient: every number multiplied by zero gives zero, so it cannot select one answer.",
      "misconception",
    ),
    task(
      "divide-zero",
      "There are no counters to share among 4 people. How many does each receive? Check with multiplication.",
      "0 counters each; 4 × 0 = 0.",
      "The number of people is positive. Four empty shares account for the zero counters.",
      undefined,
      "short",
    ),
    task(
      "divide-impossible",
      "Explain why 12 ÷ 0 has no quotient. Use multiplication in your explanation.",
      "No number multiplied by zero gives twelve.",
      "Division must undo multiplication by the divisor. Multiplication by zero always gives zero, so it cannot produce the required total twelve.",
      undefined,
      "medium",
    ),
  ]);
  a.page("chunk-division", "Use a large chunk you know", [
    array(
      "chunk-array",
      7,
      12,
      "Columns are groups here: 12 groups of 7. Ten columns contain 70 cells; two more contain 14.",
      { column: 10 },
      { row: "7 items per column", column: "12 groups" },
    ),
    text(
      "To find 84 ÷ 7, take out ten groups of seven: that uses seventy. Fourteen remain, which make two more groups. Add the group counts: 10 + 2 = 12. The split changes the work, not the total.",
    ),
    task(
      "chunk-quotient",
      "Find 66 ÷ 6 by splitting 66 into 60 and 6. Explain what you add at the end.",
      "11 groups.",
      "Sixty makes ten groups of six, and the remaining six make one group. Add the group counts: 10 + 1 = 11.",
      "11 × 6 = 66.",
      "medium",
    ),
    task(
      "chunk-check",
      "Use 80 and 16 to find 96 ÷ 8. Check your answer.",
      "12.",
      "Eighty divided by eight gives ten. Sixteen divided by eight gives two. Their sum is twelve.",
      "12 × 8 = 96.",
      "medium",
    ),
  ]);
  a.page(
    "division-workshop",
    "Which quantity is missing?",
    [
      text(
        "All three questions use equal groups. Identify the total, the group count, and the group size before choosing an equation.",
      ),
      task(
        "division-packs",
        "There are 48 cards. Each pack must contain 6 cards. How many packs can you make?",
        "8 packs.",
        "The total and group size are known. Find the number of groups: 48 ÷ 6 = 8.",
        "8 × 6 = 48.",
        "medium",
      ),
      task(
        "division-sharing",
        "Share 48 cards equally among 8 people. How many does each receive?",
        "6 cards per person.",
        "The total and number of recipients are known. Find the share size: 48 ÷ 8 = 6.",
        undefined,
        "medium",
      ),
      task(
        "division-total",
        "Eight packs each contain 6 cards. How many cards are there? Explain how this question connects to the first two.",
        "48 cards.",
        "Multiplication combines the known group count and group size. The first two questions start with this total and ask for a missing factor.",
        undefined,
        "medium",
      ),
    ],
    "workshop",
  );
}
