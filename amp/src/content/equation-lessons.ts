import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

const equationTerms: Lesson["sections"][number] = {
  stage: "intuition",
  title: "Equations, variables and solutions",
  paragraphs: [
    "This lesson uses addition, subtraction, multiplication and division of whole numbers, decimals and fractions. An equation is a statement that two expressions have the same value; the equals sign = separates them. A variable is a letter, such as $x$ or $n$, that stands for a number we do not yet know. A number written next to a letter multiplies it: 4x means 4 × x.",
    "A solution of an equation is a value of the variable that makes the statement true. For x + 3 = 7 the solution is 4, because 4 + 3 = 7 is true; 5 is not a solution, because 5 + 3 = 8. To solve an equation means to find its solution.",
  ],
};
const balanceTerms: Lesson["sections"][number] = {
  stage: "intuition",
  title: "A level balance is an equation",
  paragraphs: [
    "This lesson uses whole-number addition, subtraction, multiplication and division. A balance compares weights: when its two pans are level, they hold equal weight. In these puzzles every block labeled $x$ has the same unknown weight, and every small cube weighs 1 gram. A letter that stands for an unknown number is called a variable, and 3x means 3 × x.",
    "Write the left pan's weight, an equals sign, and the right pan's weight. One block and 3 cubes balancing 7 cubes is x + 3 = 7. Three blocks balancing 12 cubes is 3x = 12. An equation written this way is true for the block's real weight, which is the solution.",
  ],
};
const inequalityTerms: Lesson["sections"][number] = {
  stage: "intuition",
  title: "Inequalities and their solutions",
  paragraphs: [
    "This lesson uses comparing positive and negative numbers on a number line, where numbers increase to the right. An inequality compares two values: x > 2 means $x$ is greater than 2, and x < 2 means $x$ is less than 2. x ≥ 2 means $x$ is greater than or equal to 2, and x ≤ 2 means $x$ is less than or equal to 2. The number 2 here is the boundary.",
    "A solution of an inequality is a value that makes it true. 3 is a solution of x > 2, because 3 > 2 is true. 2 is not a solution of x > 2, because 2 > 2 is false, but 2 is a solution of x ≥ 2, because 2 is equal to 2.",
  ],
};
const graphing: Lesson["sections"][number] = {
  title: "How a solution set is graphed",
  paragraphs: [
    "The solution set of an inequality is all the numbers that make it true. The solutions of x > 2 include 3, 2.5, 2.01 and 1000; they cannot all be listed, so they are drawn on a number line.",
    "A circle marks the boundary. An open circle means the boundary is not a solution; a filled circle means it is. A thick ray from the circle covers every solution, and its arrow shows that the solutions continue without end in that direction: toward greater numbers for > and ≥, toward lesser numbers for < and ≤.",
  ],
  illustration: "inequality-half-lines",
};

export const equationLessons: Lesson[] = [
  {
    id: "one-step-equation",
    title: "Solve one-step equations",
    summary:
      "Do the inverse operation to both sides. The sides stay equal and the variable is left alone.",
    templateIds: ["one-step-equation"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Explain why doing the same operation to both sides of an equation keeps it true.",
      "Solve x + p = q, x − p = q, px = q and x ÷ p = q with whole numbers, decimals and fractions, and check the solution.",
    ],
    sections: [
      equationTerms,
      {
        title: "Keep the balance level",
        paragraphs: [
          "Think of an equation as a level balance. The left pan holds x + 3: one block of unknown weight $x$ and 3 one-gram cubes. The right pan holds 7 cubes. The pans are level, so the two weights are equal.",
          "Take 3 cubes off each pan. Both pans lose the same weight, so they stay level: the block alone balances 4 cubes, and x = 4. Doing the same thing to both sides of an equation always keeps the sides equal, so each step gives a new equation with the same solution.",
        ],
        illustration: "balance-remove",
      },
      {
        title: "Undo the operation with its inverse",
        paragraphs: [
          "Inverse operations undo each other: subtraction undoes addition, addition undoes subtraction, division undoes multiplication, and multiplication undoes division. To solve a one-step equation, name the operation applied to the variable and do its inverse to both sides.",
          "For 3x = 12 the variable is multiplied by 3. Split both pans into 3 equal groups: one block balances one group of 4 cubes, so x = 12 ÷ 3 = 4. For x − 5 = 9, add 5 to both sides: x = 9 + 5 = 14. For x ÷ 4 = 2.5, multiply both sides by 4: x = 2.5 × 4 = 10.",
          "Decimals and fractions follow the same method. For x + 2/3 = 5/6, subtract 2/3 from both sides using a common denominator: x = 5/6 − 2/3 = 5/6 − 4/6 = 1/6. Check by substituting the solution into the original equation: 1/6 + 4/6 = 5/6.",
        ],
        illustration: "balance-split",
      },
    ],
    workedExample: {
      prompt: "Solve for $n$: 4n = 7.4.",
      steps: [
        "4n means 4 × n. The variable is multiplied by 4, so divide both sides by 4.",
        "n = 7.4 ÷ 4 = 1.85.",
        "Check: 4 × 1.85 = 7.4.",
      ],
      answer: "1.85",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "Doing the same operation to both sides of an equation keeps the sides equal, so the inverse of the operation on the variable isolates it without changing the solution.",
        ],
      },
    ],
    pitfalls: [
      "Do the inverse operation, not the same operation: for x + 6 = 15, subtract 6 to get 9; adding 6 gives 21, which is not a solution.",
      "Apply every step to both sides. Changing one side only breaks the equality.",
      "4n means 4 × n, so divide both sides by 4; do not subtract 4.",
    ],
    parentGuide:
      "Hide a few paper clips in an envelope and balance it on a kitchen scale or a hanger balance with loose clips. Remove the same number of loose clips from both sides until the envelope is alone, and say the equation at each step.",
  },
  {
    id: "one-step-equation-story",
    title: "Write and solve a one-step equation",
    summary:
      "Name the unknown with a letter, write the story's one operation on it, then undo that operation.",
    templateIds: ["one-step-equation-story"],
    objectives: [
      "Represent a story with one unknown as x + p = q, x − p = q, px = q or x ÷ p = q.",
      "Solve the equation and check the solution in the story.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "From words to an equation",
        paragraphs: [
          "This lesson uses the four operations with whole numbers. A variable is a letter that stands for an unknown number. Define it by saying exactly what it counts, such as “let $s$ be the number of stickers at first”. An equation states that two expressions are equal, and 9t means 9 × t.",
          "Read the story for the one action applied to the unknown. Something added or gained gives x + p. Something taken away, used or sold gives x − p. Equal groups of a known size give px. Equal sharing into $p$ parts gives x ÷ p. The other side of the equation is the result the story reports.",
          "A tape diagram shows the relationship. For a class that had some stickers, received 14 more and now has 41, one bar is split into $s$ and 14, and its whole length is 41: s + 14 = 41.",
        ],
        illustration: "equation-tape",
      },
      {
        title: "Solve and check",
        paragraphs: [
          "Solve by doing the inverse operation to both sides, which keeps them equal: s + 14 = 41 gives s = 41 − 14 = 27. Subtraction undoes addition, addition undoes subtraction, division undoes multiplication, and multiplication undoes division.",
          "Check the number in the story, not only in the equation: 27 stickers and 14 more make 41 stickers. An equation can be solved correctly and still be the wrong model, so check the equation as well as its solution.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Museum tickets cost 9 dollars each. A class paid 117 dollars for tickets. Let $t$ be the number of tickets the class bought. Which equation represents the situation, and what is its solution?",
      steps: [
        "Each ticket costs 9 dollars, so $t$ tickets cost 9 × t dollars: 9t = 117.",
        "Division undoes multiplication, so divide both sides by 9: t = 117 ÷ 9 = 13.",
        "Check in the story: 13 tickets at 9 dollars each cost 13 × 9 = 117 dollars.",
      ],
      answer: "9t = 117; t = 13",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "An equation models a story when its operation on the unknown is the story's action and its other side is the reported result.",
        ],
      },
    ],
    pitfalls: [
      "Match the action, not a single word: in “sold 18 and had 27 left”, 18 is taken away, so m − 18 = 27.",
      "Undo the operation on the unknown: for n ÷ 6 = 8, multiply to get n = 48; do not divide 8 by 6.",
      "Define the variable precisely. The amount at the start and the amount at the end are different quantities.",
    ],
    parentGuide:
      "Tell a short story with a hidden starting amount, such as “I had some coins, spent 5 and have 12 left”. Your learner writes the equation before solving it; then act the story out with real coins to check.",
  },
  {
    id: "balance-one-step",
    title: "Solve a balance puzzle",
    summary:
      "Remove equal weights from both pans, or split both pans into equal groups, until one block is alone.",
    templateIds: ["balance-one-step"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Write the equation that a level balance shows.",
      "Find the unknown weight by changing both pans in the same way.",
    ],
    sections: [
      balanceTerms,
      {
        title: "Remove the same weight from both pans",
        paragraphs: [
          "Removing the same weight from both pans keeps them level. From x + 3 = 7, take 3 cubes off each pan. The block alone balances 4 cubes, so x = 7 − 3 = 4.",
          "Removing cubes from one pan only would tip the balance, so it is never allowed. The same rule holds for any equation: whatever you do to one side, do to the other.",
        ],
        illustration: "balance-remove",
      },
      {
        title: "Split both pans into equal groups",
        paragraphs: [
          "When the left pan holds several blocks and nothing else, split both pans into as many equal groups as there are blocks. Each group on the left is one block, and it balances one group on the right.",
          "From 3x = 12, split each pan into 3 groups: one block balances 4 cubes, so x = 12 ÷ 3 = 4. Check by putting the weight back: 3 × 4 = 12.",
        ],
        illustration: "balance-split",
      },
    ],
    workedExample: {
      prompt:
        "A level balance has one $x$ block and 5 cubes on the left pan and 12 cubes on the right pan. Each cube weighs 1 gram. How many grams does the $x$ block weigh?",
      steps: [
        "Level pans hold equal weights: x + 5 = 12.",
        "Remove 5 cubes from each pan. The balance stays level: x = 12 − 5 = 7.",
        "Check: 7 + 5 = 12.",
      ],
      answer: "7",
      answerUnit: "grams",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "Removing equal weights from both pans, or splitting both pans into the same number of equal groups, keeps a balance level.",
        ],
      },
    ],
    pitfalls: [
      "Remove the same number of cubes from both pans, never from one pan only.",
      "With several blocks, split both pans into that many equal groups; one block matches one group.",
      "Count the cubes exactly, or write the equation first and use its numbers.",
    ],
    parentGuide:
      "Make a balance from a coat hanger, two cups and string. Put a few identical small objects in one cup and paper clips in the other until it is level. Predict how many clips one object weighs, then test by removing objects and clips in matching groups.",
  },
  {
    id: "two-step-equation",
    title: "Solve two-step equations",
    summary:
      "Undo the operations in the reverse of the order they were applied, doing each step to both sides.",
    templateIds: ["two-step-equation"],
    objectives: [
      "Explain why a two-step equation is solved by undoing its operations in reverse order.",
      "Solve $px + q = r$ and p(x + q) = r with positive and negative integers and decimals, and check the solution.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Reverse the order of operations",
        paragraphs: [
          "This lesson uses arithmetic with positive and negative numbers. In an equation, a variable such as $x$ stands for an unknown number, and 3x means 3 × x. A solution is a value of $x$ that makes both sides equal. Doing the same operation to both sides keeps them equal, so each step gives an equation with the same solution.",
          "Read 3x + 5 = 20 as a sequence: start with $x$, multiply by 3, then add 5, and the result is 20. To get back to $x$, undo the last operation first: subtract 5 to get 20 − 5 = 15, then divide by 3 to get 15 ÷ 3 = 5. Shoes put on after socks come off first.",
        ],
        illustration: "undo-chain",
      },
      {
        title: "Parentheses change the order",
        paragraphs: [
          "In 4(x − 3) = 28, the parentheses come first: subtract 3 from $x$, then multiply by 4. Undo in reverse: divide both sides by 4 to get x − 3 = 28 ÷ 4 = 7, then add 3 to get x = 7 + 3 = 10.",
          "You may also distribute first, because 4(x − 3) = 4x − 12. Then 4x − 12 = 28 gives 4x = 28 + 12 = 40 and x = 40 ÷ 4 = 10. Both routes give the same solution because every step keeps the sides equal.",
        ],
      },
      {
        title: "Negative numbers and decimals",
        paragraphs: [
          "The steps do not change when numbers are negative. For −2x + 7 = 19, subtract 7: −2x = 19 − 7 = 12. Divide by −2: x = 12 ÷ (−2) = −6. Dividing numbers with different signs gives a negative result.",
          "Check by substituting into the original equation: −2 × (−6) + 7 = 12 + 7 = 19. With decimals, as in 0.5x − 1.5 = 2.5, add 1.5 to get 0.5x = 2.5 + 1.5 = 4, then divide: x = 4 ÷ 0.5 = 8.",
        ],
      },
    ],
    workedExample: {
      prompt: "Solve for x: −3(x + 4) = 18.",
      steps: [
        "The parentheses are multiplied by −3, the last operation. Divide both sides by −3: x + 4 = 18 ÷ (−3) = −6.",
        "Subtract 4 from both sides: x = −6 − 4 = −10.",
        "Check: −3 × (−10 + 4) = −3 × (−6) = 18.",
      ],
      answer: "−10",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "Operations applied to $x$ are undone in reverse order, and each step done to both sides keeps the equation's solution unchanged.",
        ],
      },
    ],
    pitfalls: [
      "Undo addition or subtraction before multiplication: for 3x + 5 = 20, do not divide 20 by 3 first.",
      "Keep the sign with the coefficient: in 7 − 2x = 1 the coefficient of $x$ is −2, so −2x = 1 − 7 = −6 and x = 3.",
      "When distributing, multiply every term inside the parentheses: 4(x − 3) is 4x − 12, not 4x − 3.",
    ],
    parentGuide:
      "Play “guess my number”: “I multiplied my number by 3, added 5 and got 20.” Take turns inventing and solving these, working backward one step at a time.",
  },
  {
    id: "two-step-word-problem",
    title: "Solve two-step stories with an equation",
    summary:
      "Name the unknown amount, show what happens to it in the story, and undo those steps in reverse order.",
    templateIds: ["two-step-word-problem"],
    objectives: [
      "Write $px + q = r$ for a story with a repeated amount and a one-time amount, and p(x + q) = r for equal groups that each contain the unknown.",
      "Solve the equation and check the answer in the story.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Two shapes of story",
        paragraphs: [
          "This lesson uses arithmetic with whole numbers and decimals. A variable is a letter for the unknown quantity; define it by saying what it counts and in what unit. An equation states that two expressions are equal, and 12m means 12 × m.",
          "In $px + q = r$, an amount $p$ repeats once for every unit of $x$, and an amount $q$ happens once. A 25-dollar sign-up fee plus 12 dollars per month for $m$ months costs 12m + 25 dollars. In p(x + q) = r there are $p$ equal groups, and each group contains $x$ and $q$. Four friends who each buy a ticket costing $c$ dollars and a 3-dollar snack spend 4(c + 3) dollars.",
          "The tape diagrams show the difference. 3x + 6 = 21 has three copies of $x$ and one 6. 3(c + 2) = 21 has three copies of the whole group c + 2.",
        ],
        illustration: "two-step-tape",
      },
      {
        title: "Solve and check",
        paragraphs: [
          "Undo the last operation first, doing the same thing to both sides. For 12m + 25 = 121, subtract the one-time 25: 12m = 121 − 25 = 96, so m = 96 ÷ 12 = 8. For 4(c + 3) = 52, divide by the 4 groups: c + 3 = 52 ÷ 4 = 13, so c = 13 − 3 = 10.",
          "Check the answer in the story's own words: 8 months at 12 dollars cost 12 × 8 = 96 dollars, and with the 25-dollar fee that is 96 + 25 = 121 dollars. The answer should also make sense; a number of months is a whole number.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A gym charges a 30-dollar sign-up fee plus 14 dollars per month. Ravi has paid 142 dollars in all. For how many months has Ravi paid?",
      steps: [
        "Let $m$ be the number of months Ravi has paid for. The total paid is 14 dollars for each of $m$ months plus the 30-dollar fee: 14m + 30 = 142.",
        "Subtract 30 from both sides: 14m = 142 − 30 = 112.",
        "Divide both sides by 14: m = 112 ÷ 14 = 8.",
        "Check: 14 × 8 + 30 = 112 + 30 = 142.",
      ],
      answer: "8",
      answerUnit: "months",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "A repeated amount multiplies the unknown and a one-time amount is added once: $px + q = r$. Equal groups that each contain the unknown give p(x + q) = r.",
        ],
      },
    ],
    pitfalls: [
      "Multiply the unknown by the amount that repeats: 14m + 30, not 30m + 14.",
      "If every group contains the extra amount, use parentheses: 4(c + 3), not 4c + 3.",
      "A perimeter uses the length and the width twice each: 2(w + 16), not 2w + 16.",
    ],
    parentGuide:
      "Look at a real price list with a fixed fee and a charge per hour or per item. Pick a total and ask how many hours or items it buys; write the equation together before solving it.",
  },
  {
    id: "two-step-equation-model",
    title: "Choose the equation for a story",
    summary:
      "Decide which amount repeats and which happens once, and whether each group contains the unknown.",
    templateIds: ["two-step-equation-model"],
    objectives: [
      "Distinguish a repeated amount, which multiplies the unknown, from a one-time amount, which is added or subtracted once.",
      "Distinguish $px + q = r$ from p(x + q) = r, and test a candidate equation against the story.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Which amount repeats?",
        paragraphs: [
          "This lesson uses whole numbers and decimals. A variable such as $d$ stands for the unknown quantity the story asks about, and 2.25d means 2.25 × d. An equation represents a story when its two sides are equal for the story's true quantity and every part of the story appears in it exactly once.",
          "Ask what happens once for each unit of the unknown. A taxi that charges 2.25 dollars for each mile charges 2.25d dollars for $d$ miles. The starting charge of 3.50 dollars happens once, so it is added once: for a ride that costs 32.75 dollars, 2.25d + 3.5 = 32.75. Swapping the amounts, 3.5d + 2.25, would charge 3.50 dollars a mile.",
          "Ask whether an amount is added or taken away. A tank that starts with 80 liters and drains 6 liters each minute holds 80 − 6t liters after $t$ minutes.",
        ],
      },
      {
        title: "Groups that contain the unknown",
        paragraphs: [
          "When each of $p$ equal groups contains the unknown and an extra amount, the whole group is multiplied. Five friends who each buy a ticket costing $c$ dollars and an 8-dollar snack spend 5(c + 8) dollars; 5c + 8 would count only one snack.",
          "A rectangle's perimeter uses the length and the width twice each, so with length 16 and width $w$ the perimeter is 2(w + 16). In the tape diagrams, 3x + 6 shows one 6 and 3(c + 2) shows a 2 in every group.",
        ],
        illustration: "two-step-tape",
      },
    ],
    workedExample: {
      prompt:
        "Each of 5 friends buys one movie ticket and one 8-dollar snack. Together they spend 95 dollars. Let $c$ be the cost of one ticket, in dollars. Which equation can be used to find $c$?",
      steps: [
        "Each friend spends c + 8 dollars: one ticket and one snack.",
        "There are 5 friends, so the total is 5 times that amount: 5(c + 8) = 95.",
        "Check in the story: 95 ÷ 5 = 19 and 19 − 8 = 11. Five tickets at 11 dollars and five snacks at 8 dollars cost 55 + 40 = 95 dollars.",
      ],
      answer: "5(c + 8) = 95",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "An equation represents a story when each quantity appears with the role it has in the story: repeated amounts multiply, one-time amounts add or subtract once.",
        ],
      },
    ],
    pitfalls: [
      "5c + 8 = 95 counts only one snack; every friend buys one.",
      "Multiply the unknown by the amount that repeats, and add the one-time amount once.",
      "A decrease is subtracted: water draining from a full tank gives 80 − 6t, not 80 + 6t.",
    ],
    parentGuide:
      "Write two equations for an everyday purchase, one correct and one with the amounts swapped. Your learner tests each with a sensible value for the unknown and decides which matches the story.",
  },
  {
    id: "balance-two-step",
    title: "Solve two-step balance puzzles",
    summary:
      "Remove the loose cubes from both pans, then split both pans into equal groups. With bags, split first, then remove.",
    templateIds: ["balance-two-step"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Write $px + q = r$ or p(x + q) = r for a level balance.",
      "Solve it by changing both pans in the same way, choosing the order that keeps every step exact.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Read the balance",
        paragraphs: [
          "This lesson uses whole-number arithmetic. A balance whose pans are level holds equal weight on both pans. Every block labeled $x$ has the same unknown weight, and every small cube weighs 1 gram. A letter that stands for an unknown number is a variable, and 3x means 3 × x.",
          "Write each pan's weight and set them equal. Three blocks and 5 cubes balancing 20 cubes is 3x + 5 = 20. Two identical bags, each holding one block and 1 cube, balancing 10 cubes is 2(x + 1) = 10: there are 2 groups, and each group is x + 1.",
        ],
      },
      {
        title: "Remove, then split",
        paragraphs: [
          "For 3x + 5 = 20, take 5 cubes off each pan: 3x = 20 − 5 = 15. Then split both pans into 3 equal groups: one block balances 5 cubes, so x = 15 ÷ 3 = 5. Each change is made to both pans, so the balance stays level.",
          "Removing first is easier here because the 5 loose cubes cannot be shared equally among 3 groups. The reverse order also works, but it produces fractions of a cube: one third of the left pan is x + 5/3.",
        ],
      },
      {
        title: "Split, then remove",
        paragraphs: [
          "With bags, split first. For 2(x + 1) = 10, divide both pans into 2 equal groups: one bag balances 5 cubes, so x + 1 = 5. Then remove 1 cube from each side: x = 5 − 1 = 4.",
          "Check by putting the weight back into the original balance: 2 × (4 + 1) = 2 × 5 = 10.",
        ],
        illustration: "balance-bags",
      },
    ],
    workedExample: {
      prompt:
        "A level balance has 3 $x$ blocks and 4 cubes on the left pan and 19 cubes on the right pan. Each cube weighs 1 gram. How many grams does one $x$ block weigh?",
      steps: [
        "Level pans hold equal weights: 3x + 4 = 19.",
        "Remove 4 cubes from each pan: 3x = 19 − 4 = 15.",
        "Split both pans into 3 equal groups: x = 15 ÷ 3 = 5.",
        "Check: 3 × 5 + 4 = 19.",
      ],
      answer: "5",
      answerUnit: "grams",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "A balance stays level when both pans change the same way; removing the loose cubes and splitting into equal groups isolates one block.",
        ],
      },
    ],
    pitfalls: [
      "When the blocks are not in bags, remove the loose cubes before splitting.",
      "Split into as many groups as there are blocks or bags.",
      "With bags, the cubes inside the bags count on the left: 2(x + 1) has 2 cubes on the left pan, one in each bag.",
    ],
    parentGuide:
      "Draw two pans on paper. Use folded paper squares as blocks and coins as cubes. Set out 3 blocks and 2 coins against 11 coins, then solve by removing and grouping, saying each step aloud.",
  },
  {
    id: "inequality-from-context",
    title: "Write an inequality for a condition",
    summary:
      "Translate a condition into a direction, greater or less, and an endpoint rule, included or not.",
    templateIds: ["inequality-from-context"],
    objectives: [
      "Write x > c, x < c, x ≥ c or x ≤ c for a condition described in words.",
      "Decide whether the boundary value itself satisfies the condition.",
    ],
    sections: [
      inequalityTerms,
      {
        title: "From words to symbols",
        paragraphs: [
          "“More than”, “greater than”, “above” and “taller than” describe values greater than the boundary: use >. “Less than”, “below”, “younger than” and “colder than” describe values less than the boundary: use <.",
          "“At least”, “no less than” and “$c$ or more” include the boundary: use ≥. “At most”, “no more than” and “$c$ or fewer” include it too: use ≤. Test the boundary itself. A ride for riders taller than 48 inches does not admit a rider exactly 48 inches tall, so h > 48.",
          "Negative boundaries follow the same rules. A freezer colder than −15 °C could be at −20 °C, and −20 < −15, so t < −15.",
        ],
        illustration: "inequality-half-lines",
      },
    ],
    workedExample: {
      prompt:
        "A carry-on bag may weigh no more than 10 kilograms. Let $w$ be the weight of an allowed bag, in kilograms. Which inequality describes all possible values of $w$?",
      steps: [
        "“No more than 10 kilograms” allows weights less than 10.",
        "A bag of exactly 10 kilograms is allowed, so the boundary is included.",
        "The inequality is w ≤ 10.",
      ],
      answer: "w ≤ 10",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "Greater-than conditions use > or ≥ and less-than conditions use < or ≤; the boundary is included exactly when the condition allows the boundary value.",
        ],
      },
    ],
    pitfalls: [
      "“At least” means greater than or equal to, even though it contains the word “least”.",
      "Test the boundary: “more than 35” excludes 35; “35 or more” includes it.",
      "Colder and below mean less than, also for negative temperatures: −20 °C is colder than −15 °C, and −20 < −15.",
    ],
    parentGuide:
      "Collect real rules with numbers, such as height limits, age discounts and speed limits. For each, ask whether the exact number on the sign is allowed, then write the inequality together.",
  },
  {
    id: "inequality-from-number-line",
    title: "Read an inequality from a number line",
    summary:
      "Read the boundary under the circle, the circle (open excludes, filled includes) and the direction of the ray.",
    templateIds: ["inequality-from-number-line"],
    objectives: [
      "Read the boundary, the inclusion and the direction of a graphed solution set.",
      "Write the matching inequality x > c, x < c, x ≥ c or x ≤ c.",
    ],
    sections: [
      inequalityTerms,
      graphing,
      {
        title: "Read three things",
        paragraphs: [
          "Read the number under the circle, then the circle, then the direction. An open circle at −3 with a ray to the left shows every number less than −3, but not −3 itself: x < −3.",
          "A filled circle at 4 with a ray to the right shows 4 and every number greater than 4: x ≥ 4. If the boundary tick has no label, count one-unit steps from the nearest labeled tick.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A number line shows a filled circle at −2 and a thick ray to the left. Which inequality does the number line show?",
      steps: [
        "The circle is filled, so −2 is a solution.",
        "The ray points left, toward lesser numbers, so the other solutions are less than −2.",
        "The graph shows x ≤ −2.",
      ],
      answer: "x ≤ −2",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "A graph's circle shows whether the boundary is a solution, and its ray shows the direction in which all other solutions lie.",
        ],
      },
    ],
    pitfalls: [
      "An open circle excludes the boundary; a filled circle includes it.",
      "The direction of the ray decides greater or less, not where the circle sits on the page.",
      "Read the boundary from the tick labels, counting unlabeled ticks one unit at a time.",
    ],
    parentGuide:
      "Draw a number line on paper or with chalk. Stand on a number and point one way; your learner names the inequality and decides with you whether you stand on an open or a filled circle.",
  },
  {
    id: "inequality-number-line-choice",
    title: "Graph an inequality on a number line",
    summary:
      "Put the circle at the boundary, fill it only if the boundary is a solution, and draw the ray toward the solutions.",
    templateIds: ["inequality-number-line-choice"],
    objectives: [
      "Decide whether a boundary is included and which direction the solutions extend.",
      "Choose the number line that shows every solution of x > c, x < c, x ≥ c or x ≤ c.",
    ],
    sections: [
      inequalityTerms,
      graphing,
      {
        title: "Three decisions, then a test",
        paragraphs: [
          "Put the circle at the boundary number. Fill it if the boundary is a solution (≥ or ≤) and leave it open if it is not (> or <). Draw the thick ray toward greater numbers for > and ≥, or toward lesser numbers for < and ≤.",
          "Then test a number on the ray. For x < 3, 0 is on the ray and 0 < 3 is true; 5 is off the ray and 5 < 3 is false. When graphs differ only in the circle or only in the direction, testing the boundary and one other number decides between them.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Describe the number line that shows the solutions of x ≥ −1: is the circle at −1 open or filled, and does the ray point left or right?",
      steps: [
        "−1 ≥ −1 is true, so −1 is a solution and the circle is filled.",
        "The solutions are greater than −1, so the ray points right.",
        "Test: 2 is on the ray, and 2 ≥ −1 is true.",
      ],
      answer: "A filled circle at −1 and a ray pointing right",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "The graph of x > c, x < c, x ≥ c or x ≤ c is a ray from $c$, toward greater or lesser numbers, with a filled circle exactly when $c$ is a solution.",
        ],
      },
    ],
    pitfalls: [
      "Use a filled circle only for ≥ and ≤.",
      "Greater numbers are to the right, also for negative boundaries: x > −4 points right, toward −3, 0 and 5.",
      "Check the boundary label: a graph with the right circle and direction at the wrong number shows a different set.",
    ],
    parentGuide:
      "Write x > 3, x < 3, x ≥ 3 and x ≤ 3 on cards. Draw the four graphs on separate slips and have your learner match each card to its graph, testing the number 3 every time.",
  },
  {
    id: "inequality-solution-set",
    title: "The solutions of an inequality",
    summary:
      "Every number on the correct side of the boundary is a solution, including fractions and decimals, so there are infinitely many.",
    templateIds: ["inequality-solution-set"],
    objectives: [
      "Test whether a number is a solution of x > c, x < c, x ≥ c or x ≤ c by substitution.",
      "Explain why a simple inequality has infinitely many solutions.",
    ],
    sections: [
      inequalityTerms,
      {
        title: "Testing a number",
        paragraphs: [
          "To test a number, put it in place of the variable and decide whether the comparison is true. For x > 4, test 4.5: 4.5 > 4 is true, so 4.5 is a solution. Test −1: −1 > 4 is false, so −1 is not.",
          "Test the boundary carefully. 4 > 4 is false, so 4 is not a solution of x > 4, but 4 ≥ 4 is true, so 4 is a solution of x ≥ 4. One false value rules out a list of proposed solutions.",
        ],
      },
      {
        title: "Infinitely many solutions",
        paragraphs: [
          "The equation x + 3 = 7 has exactly one solution, 4. The inequality x > 2 has infinitely many: 3, 10 and 1000 are solutions, and so are numbers that are not whole, such as 2.5, 2.25 and 2.01.",
          "Between any two solutions there is another: halfway between 2.5 and 3 is 2.75, which is also greater than 2. However closely you look near the boundary, there are more solutions, so they can never all be listed. That is why a solution set is written as an inequality or drawn as a ray.",
        ],
        illustration: "inequality-many-solutions",
      },
    ],
    workedExample: {
      prompt: "Which of the numbers 2.9, 3 and −10 are solutions of x < 3?",
      steps: [
        "2.9 < 3 is true, so 2.9 is a solution.",
        "3 < 3 is false, so 3 is not a solution.",
        "−10 < 3 is true, so −10 is a solution.",
      ],
      answer: "2.9 and −10",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "Every number on the correct side of the boundary satisfies a simple inequality, and between any two such numbers lies another, so there are infinitely many solutions.",
        ],
      },
    ],
    pitfalls: [
      "Numbers that are not whole are solutions too: 2.5 is a solution of x > 2.",
      "The boundary of > or < is not a solution; the boundary of ≥ or ≤ is.",
      "A simple inequality has infinitely many solutions, not only the next whole number.",
    ],
    parentGuide:
      "Play “Is it a solution?” for x > 5. Take turns naming tricky numbers such as 5, 5.1, 4.99, 1000 and −6, and test each by saying the comparison aloud.",
  },
];

export const equationMethods: Record<string, ProblemMethod> = {
  "one-step-equation": {
    goal: "Find the value of the variable in an equation with one operation.",
    terms: [
      ["solution", "A value of the variable that makes the equation true."],
      [
        "inverse operation",
        "The operation that undoes another: − undoes +, ÷ undoes ×.",
      ],
    ],
    method: [
      "Name the operation applied to the variable.",
      "Do its inverse to both sides of the equation.",
      "Check by substituting the value into the original equation.",
    ],
    watch:
      "Do the inverse operation, not the same one: x + 6 = 15 gives 9, not 21.",
  },
  "one-step-equation-story": {
    goal: "Choose the equation that models a story and the value that solves it.",
    terms: [
      ["variable", "A letter for the unknown quantity the story describes."],
      ["equation", "A statement that two expressions are equal."],
    ],
    method: [
      "Find the one action applied to the unknown: add, take away, equal groups or sharing.",
      "Write that operation on the variable, equal to the reported result.",
      "Undo the operation on both sides, then check the value in the story.",
    ],
    watch:
      "Check both parts: a correct solution of the wrong equation is still wrong.",
  },
  "balance-one-step": {
    goal: "Find the weight of one $x$ block on a level balance with one step.",
    terms: [
      [
        "level balance",
        "Both pans hold equal weight, like the two sides of an equation.",
      ],
    ],
    method: [
      "Write the equation the pans show.",
      "Remove the loose cubes from both pans, or split both pans into one group per block.",
      "Read the weight that one block balances.",
    ],
    watch: "Change both pans in the same way, never one pan alone.",
  },
  "two-step-equation": {
    goal: "Solve $px + q = r$ or p(x + q) = r for $x$.",
    terms: [
      [
        "coefficient",
        "The number multiplying the variable, with its sign: −2 in −2x.",
      ],
    ],
    method: [
      "Name the last operation applied to $x$ and undo it on both sides.",
      "Undo the remaining operation on both sides.",
      "Check by substituting into the original equation.",
    ],
    watch:
      "For $px + q$, undo the + $q$ first; for p(x + q), divide by $p$ first.",
  },
  "two-step-word-problem": {
    goal: "Write and solve a two-step equation for a story.",
    terms: [
      [
        "repeated amount",
        "An amount that occurs once per unit of the unknown or per group.",
      ],
    ],
    method: [
      "Name the unknown with a letter and its unit.",
      "Write $px + q = r$, or p(x + q) = r when every group contains the unknown and the extra amount.",
      "Undo the operations in reverse order and check the answer in the story.",
    ],
    watch:
      "Multiply the repeated amount by the unknown; add a one-time amount once.",
  },
  "two-step-equation-model": {
    goal: "Choose the equation that represents a two-step story.",
    terms: [
      ["one-time amount", "An amount added or subtracted once, such as a fee."],
    ],
    method: [
      "Find the amount that repeats for each unit of the unknown.",
      "Decide whether the extra amount occurs once or once in every group.",
      "Choose the equation that uses every part of the story exactly once.",
    ],
    watch: "p(x + q) counts $q$ in every group; $px + q$ counts it once.",
  },
  "balance-two-step": {
    goal: "Find the weight of one $x$ block on a level balance with two steps.",
    terms: [
      [
        "bag",
        "A group holding one $x$ block and some cubes; all bags are identical.",
      ],
    ],
    method: [
      "Write $px + q = r$, or p(x + q) = r when the blocks are in bags.",
      "Without bags, remove the loose cubes from both pans, then split into equal groups.",
      "With bags, split into one group per bag, then remove the bag's cubes.",
    ],
    watch: "Count the cubes in every bag; each bag has its own.",
  },
  "inequality-from-context": {
    goal: "Write the inequality for a condition stated in words.",
    terms: [["boundary", "The number the condition compares with."]],
    method: [
      "Decide whether allowed values are greater or less than the boundary.",
      "Decide whether the boundary itself is allowed.",
      "Choose >, <, ≥ or ≤ accordingly.",
    ],
    watch:
      "“At least” and “at most” include the boundary; “more than” and “less than” do not.",
  },
  "inequality-from-number-line": {
    goal: "Name the inequality that a number-line graph shows.",
    terms: [
      ["open circle", "The boundary is not a solution."],
      ["filled circle", "The boundary is a solution."],
    ],
    method: [
      "Read the boundary number under the circle.",
      "Open circle: > or <. Filled circle: ≥ or ≤.",
      "Ray to the right: greater. Ray to the left: less.",
    ],
    watch: "The ray's direction decides greater or less.",
  },
  "inequality-number-line-choice": {
    goal: "Choose the number line that shows every solution of an inequality.",
    terms: [
      [
        "ray",
        "The thick half-line that covers every solution and continues without end.",
      ],
    ],
    method: [
      "Find the boundary; fill its circle only for ≥ or ≤.",
      "Point the ray right for > or ≥ and left for < or ≤.",
      "Test a number on the ray in the inequality.",
    ],
    watch: "A graph can have the right direction and the wrong circle.",
  },
  "inequality-solution-set": {
    goal: "Decide which numbers solve an inequality, and how many solutions it has.",
    terms: [["solution", "A number that makes the inequality true."]],
    method: [
      "Substitute each number and decide whether the comparison is true.",
      "Test the boundary: it is a solution only for ≥ or ≤.",
      "Remember that every number on the correct side, whole or not, is a solution.",
    ],
    watch:
      "There are infinitely many solutions, including decimals and fractions.",
  },
};

export const equationPrinciples: Record<string, string> = {
  "one-step-equation":
    "Doing the same operation to both sides of an equation keeps the sides equal, so the inverse of the operation on the variable isolates it without changing the solution.",
  "one-step-equation-story":
    "An equation models a story when its operation on the unknown is the story's action and its other side is the reported result.",
  "balance-one-step":
    "Removing equal weights from both pans, or splitting both pans into the same number of equal groups, keeps a balance level.",
  "two-step-equation":
    "Operations applied to $x$ are undone in reverse order, and each step done to both sides keeps the equation's solution unchanged.",
  "two-step-word-problem":
    "A repeated amount multiplies the unknown and a one-time amount is added once: $px + q = r$. Equal groups that each contain the unknown give p(x + q) = r.",
  "two-step-equation-model":
    "An equation represents a story when each quantity appears with the role it has in the story: repeated amounts multiply, one-time amounts add or subtract once.",
  "balance-two-step":
    "A balance stays level when both pans change the same way; removing the loose cubes and splitting into equal groups isolates one block.",
  "inequality-from-context":
    "Greater-than conditions use > or ≥ and less-than conditions use < or ≤; the boundary is included exactly when the condition allows the boundary value.",
  "inequality-from-number-line":
    "A graph's circle shows whether the boundary is a solution, and its ray shows the direction in which all other solutions lie.",
  "inequality-number-line-choice":
    "The graph of x > c, x < c, x ≥ c or x ≤ c is a ray from $c$, toward greater or lesser numbers, with a filled circle exactly when $c$ is a solution.",
  "inequality-solution-set":
    "Every number on the correct side of the boundary satisfies a simple inequality, and between any two such numbers lies another, so there are infinitely many solutions.",
};
