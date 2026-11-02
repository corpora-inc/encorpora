import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

const equationTerms: Lesson["sections"][number] = {
  stage: "intuition",
  title: "Equations, variables and solutions",
  paragraphs: [
    "An equation is a statement that two amounts are equal. It has an equals sign, $=$, with a left side and a right side. A variable is a letter, such as $x$ or $n$, that stands for a number we do not know yet. A number written right before a letter multiplies it: $4x$ means 4 times $x$.",
    "A solution of an equation is a value of the variable that makes the two sides equal. For $x + 3 = 7$ the solution is 4, because $4 + 3 = 7$ is true. The number 5 is not a solution, because $5 + 3 = 8$, not 7. To solve an equation means to find its solution.",
  ],
};
const balanceTerms: Lesson["sections"][number] = {
  stage: "intuition",
  title: "A level balance is an equation",
  paragraphs: [
    "A balance is a scale with two pans. When the pans are level, they hold equal weight. In these puzzles, every block labeled $x$ has the same unknown weight, and every small cube weighs 1 gram. A letter that stands for an unknown number, like $x$, is called a variable. Writing $3x$ means 3 times $x$: three blocks.",
    "Write the left pan's weight, an equals sign, and the right pan's weight. One block and 3 cubes balancing 7 cubes gives $x + 3 = 7$. Three blocks balancing 12 cubes gives $3x = 12$. A statement like this, that two amounts are equal, is called an equation. It is true for the block's real weight, which is called the solution. An equation's two sides are the amounts left and right of its equals sign.",
  ],
};
const inequalityTerms: Lesson["sections"][number] = {
  stage: "intuition",
  title: "Inequalities and their solutions",
  paragraphs: [
    "A number line shows numbers in order, smaller to the left and larger to the right. Negative numbers, less than 0, are to the left of 0. An inequality compares two values with a sign. $x > 2$ means $x$ is greater than 2, and $x < 2$ means $x$ is less than 2. $x \\ge 2$ means $x$ is greater than or equal to 2, and $x \\le 2$ means $x$ is less than or equal to 2. The number being compared with, here 2, is called the boundary.",
    "A solution is a value that makes an inequality true. The number 3 is a solution of $x > 2$, because $3 > 2$ is true. The number 2 is not a solution of $x > 2$, because 2 is not greater than itself. But 2 is a solution of $x \\ge 2$, because 2 is equal to 2.",
  ],
};
const graphing: Lesson["sections"][number] = {
  title: "How a solution set is graphed",
  paragraphs: [
    "The solution set of an inequality is all the numbers that make it true. The solutions of $x > 2$ include 3, 2.5, 2.01 and 1000. There are too many to list, so they are drawn on a number line.",
    "A circle marks the boundary. An open circle, one that is empty inside, means the boundary is not a solution. A filled circle, one that is colored in, means it is. A thick ray starts at the circle and covers every solution. A ray is part of a line that starts at a point and goes on forever in one direction, shown by its arrow. It points toward greater numbers, to the right, for $>$ and $\\ge$. It points toward lesser numbers, to the left, for $<$ and $\\le$.",
  ],
  illustration: "inequality-half-lines",
};

export const equationLessons: Lesson[] = [
  {
    id: "one-step-equation",
    title: "Solve one-step equations",
    summary:
      "An equation says two amounts are equal, like $x + 3 = 7$. Its two sides are the amounts left and right of the equals sign. To find the unknown $x$, undo what was done to it. Do the same thing to both sides so they stay equal.",
    templateIds: ["one-step-equation"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Explain why doing the same operation (such as adding or dividing) to both sides of an equation keeps it true.",
      "Solve equations such as $x + 3 = 7$, $x - 5 = 9$, $3x = 12$ and $x \\div 4 = 2.5$ with whole numbers, decimals and fractions, and check the solution.",
    ],
    sections: [
      equationTerms,
      {
        title: "Keep the balance level",
        paragraphs: [
          "Think of an equation as a level balance, a scale with two pans. The left pan holds $x + 3$: one block of unknown weight $x$ and 3 one-gram cubes. The right pan holds 7 cubes. The pans are level, so the two weights are equal.",
          "Take 3 cubes off each pan. Both pans lose the same weight, so they stay level. Now the block alone balances 4 cubes, so $x = 4$. Adding or subtracting the same number on both sides keeps the same solution. So does multiplying or dividing both sides by the same number, as long as it is not 0.",
        ],
        illustration: "balance-remove",
      },
      {
        title: "Undo the operation with its inverse",
        paragraphs: [
          "An operation is an action such as adding, subtracting, multiplying or dividing. Two operations are called inverse operations when one undoes the other. Subtracting undoes adding, and adding undoes subtracting. Dividing undoes multiplying, and multiplying undoes dividing. To solve a one-step equation, name the operation done to the variable. Then do its inverse to both sides.",
          "In $3x = 12$, $x$ is multiplied by 3. Split both pans into 3 equal groups: one block balances one group of 4 cubes, so $x = 12 \\div 3 = 4$. In $x - 5 = 9$, 5 was subtracted, so add 5 to both sides: $x = 9 + 5 = 14$. In $x \\div 4 = 2.5$, $x$ was divided by 4, so multiply both sides by 4: $x = 2.5 \\times 4 = 10$.",
          "Decimals and fractions work the same way. In $x + \\frac{2}{3} = \\frac{5}{6}$, subtract $\\frac{2}{3}$ from both sides. First write both fractions with the same bottom number: $\\frac{2}{3} = \\frac{4}{6}$. So $x = \\frac{5}{6} - \\frac{4}{6} = \\frac{1}{6}$. Check by putting the solution back into the original equation: $\\frac{1}{6} + \\frac{4}{6} = \\frac{5}{6}$.",
        ],
        illustration: "balance-split",
      },
    ],
    workedExample: {
      prompt: "Solve for $n$: $4n = 7.4$.",
      steps: [
        "$4n$ means 4 times $n$. The variable is multiplied by 4, so do the inverse: divide both sides by 4.",
        "$n = 7.4 \\div 4 = 1.85$.",
        "Check in the original equation: $4 \\times 1.85 = 7.4$. Both sides match, so 1.85 is the solution.",
      ],
      answer: "1.85",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "Adding or subtracting the same number on both sides of an equation keeps the sides equal. So does multiplying or dividing both sides by the same number, as long as that number is not 0. So doing the inverse of the operation on the variable leaves the variable alone without changing the solution.",
        ],
      },
    ],
    pitfalls: [
      "Do the inverse operation, not the same one. For $x + 6 = 15$, subtract 6 to get 9. Adding 6 gives 21, which is not a solution.",
      "Do every step to both sides. Changing one side only makes the sides unequal.",
      "$4n$ means 4 times $n$, so divide both sides by 4. Do not subtract 4.",
    ],
    parentGuide:
      "Hide a few paper clips in an envelope and balance it on a kitchen scale or a hanger balance with loose clips. Remove the same number of loose clips from both sides until the envelope is alone, and say the equation at each step.",
    senses: {
      side: "side-of-equation",
      balance: "balance-scale",
      boundary: "boundary",
      "more than": "more-than",
      unit: "unit",
    },
    noLink: [
      "scale",
      "inverse",
      "leaves",
      "cube",
      "cubes",
      "part",
      "parts",
      "whole",
    ],
  },
  {
    id: "one-step-equation-story",
    title: "Write and solve a one-step equation",
    summary:
      "Pick a letter for the unknown amount. Write the one action the story does to it as an equation. Then undo that action to find the amount.",
    templateIds: ["one-step-equation-story"],
    objectives: [
      "Write a story with one unknown as an equation such as $s + 14 = 41$, $m - 18 = 27$, $9t = 117$ or $n \\div 6 = 8$.",
      "Solve the equation and check the answer in the story.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "From words to an equation",
        paragraphs: [
          "A variable is a letter that stands for an unknown number. Say exactly what it counts, such as “let $s$ be the number of stickers at first”. An equation is a statement that two amounts are equal. Its two sides are the amounts left and right of the equals sign. Writing $9t$ means 9 times $t$.",
          "Read the story for the one action done to the unknown. Something added or gained gives $x + p$, where $p$ is the known amount. Something taken away, used or sold gives $x - p$. Equal groups of a known size give $px$, $p$ times $x$. Sharing equally into $p$ parts gives $x \\div p$. The other side of the equation is the result the story reports.",
          "A tape diagram, a bar split into parts, shows the relationship. A class had some stickers, got 14 more, and now has 41. One bar is split into $s$ and 14, and its whole length is 41: $s + 14 = 41$.",
        ],
        illustration: "equation-tape",
      },
      {
        title: "Solve and check",
        paragraphs: [
          "Solve by doing the inverse operation, the one that undoes it, to both sides. That keeps the sides equal. From $s + 14 = 41$, subtract 14 from both sides: $s = 41 - 14 = 27$. Subtracting undoes adding, adding undoes subtracting, dividing undoes multiplying, and multiplying undoes dividing.",
          "Check the number in the story, not only in the equation: 27 stickers and 14 more make 41 stickers. An equation can be solved correctly and still be the wrong equation for the story. So check that the equation matches the story, as well as its solution.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Museum tickets cost 9 dollars each. A class paid 117 dollars for tickets. Let $t$ be the number of tickets the class bought. Which equation represents the situation, and what is its solution?",
      steps: [
        "Each ticket costs 9 dollars, so $t$ tickets cost 9 times $t$ dollars. The class paid 117 dollars: $9t = 117$.",
        "Dividing undoes multiplying, so divide both sides by 9: $t = 117 \\div 9 = 13$.",
        "Check in the story: 13 tickets at 9 dollars each cost $13 \\times 9 = 117$ dollars.",
      ],
      answer: "9t = 117; t = 13",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "An equation fits a story when its operation on the unknown is the story's action, and its other side is the result the story reports.",
        ],
      },
    ],
    pitfalls: [
      "Match the action, not a single word. In “sold 18 and had 27 left”, 18 is taken away, so $m - 18 = 27$.",
      "Undo the operation on the unknown. For $n \\div 6 = 8$, multiply both sides by 6 to get $n = 48$. Do not divide 8 by 6.",
      "Say exactly what the variable counts. The amount at the start and the amount at the end are different amounts.",
    ],
    parentGuide:
      "Tell a short story with a hidden starting amount, such as “I had some coins, spent 5 and have 12 left”. Your learner writes the equation before solving it; then act the story out with real coins to check.",
    senses: {
      side: "side-of-equation",
      balance: "balance-scale",
      boundary: "boundary",
      "more than": "more-than",
      unit: "unit",
    },
    noLink: [
      "scale",
      "inverse",
      "leaves",
      "cube",
      "cubes",
      "part",
      "parts",
      "whole",
    ],
  },
  {
    id: "balance-one-step",
    title: "Solve a balance puzzle",
    summary:
      "A balance with level pans shows two equal weights. Take the same weight off both pans, or split both into equal groups, until one block is alone.",
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
          "Removing the same weight from both pans keeps them level. From $x + 3 = 7$, take 3 cubes off each pan. The block alone balances 4 cubes, so $x = 7 - 3 = 4$.",
          "Removing cubes from one pan only would tip the balance, so it is never allowed. The same rule holds for any equation: whatever you do to one side, do to the other side too.",
        ],
        illustration: "balance-remove",
      },
      {
        title: "Split both pans into equal groups",
        paragraphs: [
          "Sometimes the left pan holds only blocks. Then split both pans into as many equal groups as there are blocks. Each group on the left is one block, and it balances one group on the right.",
          "From $3x = 12$, split each pan into 3 groups. One block balances 4 cubes, so $x = 12 \\div 3 = 4$. Check by putting the weight back: $3 \\times 4 = 12$.",
        ],
        illustration: "balance-split",
      },
    ],
    workedExample: {
      prompt:
        "A level balance has one $x$ block and 5 cubes on the left pan and 12 cubes on the right pan. Each cube weighs 1 gram. How many grams does the $x$ block weigh?",
      steps: [
        "Level pans hold equal weights. The left pan is one block and 5 cubes, and the right pan is 12 cubes: $x + 5 = 12$.",
        "Remove 5 cubes from each pan. Both pans lose the same weight, so the balance stays level: $x = 12 - 5 = 7$.",
        "Check: $7 + 5 = 12$. The block weighs 7 grams.",
      ],
      answer: "7",
      answerUnit: "grams",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "Removing equal weights from both pans keeps a balance level. So does splitting both pans into the same number of equal groups. In an equation, these are subtracting the same number from both sides, and dividing both sides by the same number other than 0.",
        ],
      },
    ],
    pitfalls: [
      "Remove the same number of cubes from both pans, never from one pan only.",
      "With several blocks, split both pans into that many equal groups. One block matches one group.",
      "Count the cubes exactly, or write the equation first and use its numbers.",
    ],
    parentGuide:
      "Make a balance from a coat hanger, two cups and string. Put a few identical small objects in one cup and paper clips in the other until it is level. Predict how many clips one object weighs, then test by removing objects and clips in matching groups.",
    senses: {
      side: "side-of-equation",
      balance: "balance-scale",
      boundary: "boundary",
      "more than": "more-than",
      unit: "unit",
    },
    noLink: [
      "scale",
      "inverse",
      "leaves",
      "cube",
      "cubes",
      "part",
      "parts",
      "whole",
    ],
  },
  {
    id: "two-step-equation",
    title: "Solve two-step equations",
    summary:
      "An equation says two amounts are equal, like $3x + 5 = 20$. The letter $x$ stands for an unknown number. In a two-step equation, two things were done to $x$. To find $x$, undo them in reverse order, the last one first. Do each step to both sides so they stay equal.",
    templateIds: ["two-step-equation"],
    senses: { side: "side-of-equation" },
    noLink: ["leaves", "mean", "part"],
    objectives: [
      "Explain why a two-step equation is solved by undoing its two operations (actions such as multiply or add) in reverse order.",
      "Solve equations like $3x + 5 = 20$ and $4(x - 3) = 28$ with positive and negative numbers and decimals, and check the solution.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Undo the last step first",
        paragraphs: [
          "An equation is a statement that two amounts are equal. It has an equals sign, with a left side and a right side. A variable is a letter, such as $x$, that stands for an unknown number. Writing $3x$ means 3 times $x$. A solution is a value of $x$ that makes the two sides equal.",
          "Read $3x + 5 = 20$ as a story about a number. Start with $x$. Multiply it by 3. Then add 5. The result is 20. To get back to $x$, undo the steps in reverse order, the last one first.",
          "The last step was add 5, so subtract 5: 20 − 5 = 15. Before that came multiply by 3, so divide by 3: 15 ÷ 3 = 5. So $x = 5$. Check: 3 × 5 + 5 = 15 + 5 = 20. It is like socks and shoes: socks go on first, so they come off last.",
          "Each undo step is done to both sides of the equation. If two amounts are equal and you subtract 5 from each, they are still equal. So every new equation has the same solution as the one before it.",
        ],
        illustration: "undo-chain",
      },
      {
        title: "Parentheses change the order",
        paragraphs: [
          "Parentheses, the curved brackets ( ), mean do this part first. A number written right before parentheses multiplies everything inside them. So in $4(x - 3) = 28$, the steps were: subtract 3 from $x$, then multiply by 4.",
          "Undo in reverse. The last step was multiply by 4, so divide both sides by 4: $x - 3 = 28 \\div 4 = 7$. Then undo the subtraction by adding 3 to both sides: $x = 7 + 3 = 10$.",
          "Another route is to distribute first, which means multiplying the outside number by each part inside: $4(x - 3) = 4x - 12$. Then $4x - 12 = 28$. Add 12 to both sides to undo the − 12: $4x = 40$. Divide both sides by 4 to undo the multiplication: $x = 10$. Both routes agree, because every step kept the two sides equal.",
        ],
      },
      {
        title: "Negative numbers and decimals",
        paragraphs: [
          "The steps are the same when numbers are negative (less than 0). In $-2x + 7 = 19$, the number multiplying $x$ is $-2$. The number multiplying the variable $x$, sign included (positive or negative), is called the coefficient. First undo the + 7 by subtracting 7 from both sides: $-2x = 12$. Then undo the multiplication by $-2$: divide both sides by $-2$, which leaves $x$ alone. That gives $x = 12 \\div (-2) = -6$. A positive number divided by a negative number gives a negative answer.",
          "Check by putting $-6$ back into the original equation: $-2 \\times (-6) + 7 = 12 + 7 = 19$. Both sides are 19, so $-6$ is the solution, the value that makes the two sides equal.",
          "Decimals work the same way. In $0.5x - 1.5 = 2.5$, add 1.5 to both sides to undo the − 1.5: $0.5x = 4$. Divide both sides by 0.5 to undo the multiplication: $x = 4 \\div 0.5 = 8$, because 0.5 fits into 4 eight times. Check: $0.5 \\times 8 - 1.5 = 4 - 1.5 = 2.5$.",
        ],
      },
    ],
    workedExample: {
      prompt: "Solve for x: −3(x + 4) = 18.",
      steps: [
        "Parentheses, the curved brackets ( ), group a part to do first, and a number written right before them multiplies everything inside. So first 4 was added to $x$, then the result was multiplied by $-3$. Multiplying by $-3$ came last, so undo it first.",
        "Divide both sides by $-3$: $x + 4 = 18 \\div (-3) = -6$. A positive number (greater than 0) divided by a negative number (less than 0) is negative.",
        "Undo the + 4 by subtracting 4 from both sides: $x = -6 - 4 = -10$.",
        "Check in the original equation: $-3 \\times (-10 + 4) = -3 \\times (-6) = 18$. A negative times a negative is positive, so the left side is 18, the same as the right side.",
      ],
      answer: "−10",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "Adding the same number to both sides of an equation, or subtracting it from both sides, keeps exactly the same solutions. So does multiplying or dividing both sides by the same number, as long as that number is not 0. Because of this, the operations (adding, subtracting, multiplying, dividing) applied to $x$ can be undone in reverse order. Undo one step at a time, on both sides.",
        ],
      },
    ],
    pitfalls: [
      "Undo the last operation first. In $3x + 5 = 20$, the + 5 came last, so subtract 5 before dividing by 3. In $4(x - 3) = 28$, the multiplication came last, so divide by 4 first.",
      "Keep the sign with the coefficient. In $7 - 2x = 1$, the coefficient of $x$ is $-2$. Subtract 7 from both sides to undo the 7: $-2x = -6$. Then divide both sides by $-2$: $x = 3$.",
      "When distributing, multiply every part inside the parentheses. $4(x - 3)$ is $4x - 12$, not $4x - 3$.",
    ],
    parentGuide:
      "Play “guess my number”: “I multiplied my number by 3, added 5 and got 20.” Take turns inventing and solving these. Work backward one step at a time, and say which step is being undone.",
  },
  {
    id: "two-step-word-problem",
    title: "Solve two-step stories with an equation",
    summary:
      "Pick a letter for the unknown amount. Write an equation showing what the story does to it. Then undo those steps in reverse order, last step first.",
    templateIds: ["two-step-word-problem"],
    objectives: [
      "Write an equation such as $14m + 30 = 142$ for a story with an amount that repeats and an amount that happens once, or $4(c + 3) = 52$ for equal groups that each contain the unknown.",
      "Solve the equation and check the answer in the story.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Two shapes of story",
        paragraphs: [
          "A variable is a letter for the unknown amount. Say what it counts and in what unit, such as “$m$ is the number of months”. An equation is a statement that two amounts are equal. Writing $12m$ means 12 times $m$.",
          "Some amounts repeat once for every unit of the unknown. A gym that charges 12 dollars per month charges $12m$ dollars for $m$ months. Other amounts happen once, such as a 25-dollar sign-up fee. The total is $12m + 25$ dollars. With letters, this shape is $px + q = r$: $p$ repeats, $q$ happens once, and $r$ is the total.",
          "Other stories have equal groups that each contain the unknown. Parentheses, the curved brackets ( ), group a part together, and a number right before them multiplies everything inside. Four friends each buy a ticket costing $c$ dollars and a 3-dollar snack. Each friend spends $c + 3$ dollars, so all four spend $4(c + 3)$ dollars. This shape is $p(x + q) = r$.",
          "A tape diagram, a bar split into parts, shows the difference. $3x + 6 = 21$ has three copies of $x$ and one 6. $3(c + 2) = 21$ has three copies of the whole group $c + 2$.",
        ],
        illustration: "two-step-tape",
      },
      {
        title: "Solve and check",
        paragraphs: [
          "Undo the last operation first, doing the same thing to both sides. For $12m + 25 = 121$, the 25 was added last, so subtract 25 from both sides: $12m = 96$. Then divide both sides by 12: $m = 8$. For $4(c + 3) = 52$, multiplying by 4 came last, so divide both sides by 4: $c + 3 = 13$. Then subtract 3 from both sides: $c = 10$.",
          "Check the answer in the story's own words. 8 months at 12 dollars cost $12 \\times 8 = 96$ dollars, and with the 25-dollar fee that is $96 + 25 = 121$ dollars. The answer should also make sense. A gym that bills by the month needs a whole number of months: 0, 1, 2, 3 and so on.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A gym charges a 30-dollar sign-up fee plus 14 dollars per month. Ravi has paid 142 dollars in all. For how many months has Ravi paid?",
      steps: [
        "Let $m$ be the number of months Ravi has paid for. He pays 14 dollars for each of $m$ months, plus the 30-dollar fee once: $14m + 30 = 142$.",
        "The fee was added last, so undo it first. Subtract 30 from both sides: $14m = 142 - 30 = 112$.",
        "Undo the times 14: divide both sides by 14. $m = 112 \\div 14 = 8$.",
        "Check in the story: $14 \\times 8 + 30 = 112 + 30 = 142$ dollars.",
      ],
      answer: "8",
      answerUnit: "months",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "A repeated amount multiplies the unknown, and a one-time amount is added once: $px + q = r$. Equal groups that each contain the unknown give $p(x + q) = r$. Both are solved by undoing the operations in reverse order, doing each step to both sides.",
        ],
      },
    ],
    pitfalls: [
      "Multiply the unknown by the amount that repeats: $14m + 30$, not $30m + 14$.",
      "If every group contains the extra amount, use parentheses: $4(c + 3)$, not $4c + 3$.",
      "A perimeter, the distance around a rectangle, uses the length and the width twice each: $2(w + 16)$, not $2w + 16$.",
    ],
    parentGuide:
      "Look at a real price list with a fixed fee and a charge per hour or per item. Pick a total and ask how many hours or items it buys; write the equation together before solving it.",
    senses: {
      side: "side-of-equation",
      balance: "balance-scale",
      boundary: "boundary",
      "more than": "more-than",
      unit: "unit",
    },
    noLink: [
      "scale",
      "inverse",
      "leaves",
      "cube",
      "cubes",
      "part",
      "parts",
      "whole",
    ],
  },
  {
    id: "two-step-equation-model",
    title: "Choose the equation for a story",
    summary:
      "To pick the right equation for a story, find the amount that repeats and the amount that happens once. Check whether each group contains the unknown.",
    templateIds: ["two-step-equation-model"],
    objectives: [
      "Tell a repeated amount, which multiplies the unknown, from a one-time amount, which is added or subtracted once.",
      "Tell $px + q = r$ from $p(x + q) = r$, and test an equation against the story.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Which amount repeats?",
        paragraphs: [
          "A variable such as $d$ stands for the unknown amount the story asks about. Writing $2.25d$ means 2.25 times $d$. Parentheses are curved brackets ( ) that group a part together. An equation, a statement that two amounts are equal, fits a story when two things hold. Its two sides are equal for the story's true amount. And every part of the story appears in it exactly once.",
          "Ask what happens once for each unit of the unknown. A taxi that charges 2.25 dollars for each mile charges $2.25d$ dollars for $d$ miles. The starting charge of 3.50 dollars happens once, so it is added once. For a ride that costs 32.75 dollars, $2.25d + 3.5 = 32.75$. Swapping the amounts, $3.5d + 2.25$, would charge 3.50 dollars a mile.",
          "Ask whether an amount is added or taken away. A tank that starts with 80 liters and drains 6 liters each minute holds $80 - 6t$ liters after $t$ minutes.",
        ],
      },
      {
        title: "Groups that contain the unknown",
        paragraphs: [
          "Parentheses, the curved brackets ( ), group a part together, and a number right before them multiplies everything inside. When each of $p$ equal groups contains the unknown and an extra amount, the whole group is multiplied. Five friends who each buy a ticket costing $c$ dollars and an 8-dollar snack spend $5(c + 8)$ dollars. Writing $5c + 8$ would count only one snack.",
          "A rectangle's perimeter, the distance around it, uses the length and the width twice each. So with length 16 and width $w$, the perimeter is $2(w + 16)$. In the tape diagrams, bars split into parts, $3x + 6$ shows one 6 and $3(c + 2)$ shows a 2 in every group.",
        ],
        illustration: "two-step-tape",
      },
    ],
    workedExample: {
      prompt:
        "Each of 5 friends buys one movie ticket and one 8-dollar snack. Together they spend 95 dollars. Let $c$ be the cost of one ticket, in dollars. Which equation can be used to find $c$?",
      steps: [
        "Each friend buys one ticket and one snack, so each friend spends $c + 8$ dollars.",
        "There are 5 friends, so the total is 5 times that whole amount. Parentheses keep the snack in every group: $5(c + 8) = 95$.",
        "Check in the story: $95 \\div 5 = 19$ and $19 - 8 = 11$, so a ticket costs 11 dollars. Five tickets at 11 dollars and five snacks at 8 dollars cost $55 + 40 = 95$ dollars.",
      ],
      answer: "5(c + 8) = 95",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "An equation fits a story when each amount plays the role it has in the story. A price for each unit multiplies the number of units. One-time amounts are added or subtracted once. An amount that is in every group goes inside the parentheses.",
        ],
      },
    ],
    pitfalls: [
      "$5c + 8 = 95$ counts only one snack, but every friend buys one.",
      "Multiply the price for one unit by the number of units. Either one may be the unknown: 5 tickets at $c$ dollars each cost $5c$. When an extra amount is in every group, add it inside the parentheses before multiplying.",
      "A decrease is subtracted: water draining from a full tank gives $80 - 6t$, not $80 + 6t$.",
    ],
    parentGuide:
      "Write two equations for an everyday purchase, one correct and one with the amounts swapped. Your learner says which number stands for each charge, then tests both equations with two different values for the unknown.",
    senses: {
      side: "side-of-equation",
      balance: "balance-scale",
      boundary: "boundary",
      "more than": "more-than",
      unit: "unit",
    },
    noLink: [
      "scale",
      "inverse",
      "leaves",
      "cube",
      "cubes",
      "part",
      "parts",
      "whole",
    ],
  },
  {
    id: "balance-two-step",
    title: "Solve two-step balance puzzles",
    summary:
      "Without bags, take the loose cubes off both pans, then split both pans into equal groups. With bags, split into equal groups first, then take cubes off.",
    templateIds: ["balance-two-step"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Write an equation such as $3x + 5 = 20$, or $2(x + 1) = 10$ when the blocks are in bags, for a level balance.",
      "Solve it by changing both pans in the same way, in the order that keeps every step in whole cubes.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Read the balance",
        paragraphs: [
          "A balance is a scale with two pans. When the pans are level, they hold equal weight. Every block labeled $x$ has the same unknown weight, and every small cube weighs 1 gram. A letter that stands for an unknown number, like $x$, is called a variable, and $3x$ means 3 times $x$: three blocks.",
          "Write each pan's weight and set them equal. Three blocks and 5 cubes balancing 20 cubes gives $3x + 5 = 20$. Now picture two identical bags, each holding one block and 1 cube, balancing 10 cubes. There are 2 groups, and each group is $x + 1$. Parentheses are curved brackets that group a part together. Here they group each bag's contents, and the 2 in front multiplies them: $2(x + 1) = 10$.",
        ],
      },
      {
        title: "Remove, then split",
        paragraphs: [
          "For $3x + 5 = 20$, take 5 cubes off each pan: $3x = 20 - 5 = 15$. Then split both pans into 3 equal groups. One block balances 5 cubes, so $x = 15 \\div 3 = 5$. Each change is made to both pans, so the balance stays level.",
          "Removing first is easier here, because 5 loose cubes cannot be shared equally among 3 groups. The other order also works, but it gives parts of a cube: one third of the left pan is $x + \\frac{5}{3}$.",
        ],
      },
      {
        title: "Split, then remove",
        paragraphs: [
          "With bags, split first. For $2(x + 1) = 10$, divide both pans into 2 equal groups. One bag balances 5 cubes, so $x + 1 = 5$. Then remove 1 cube from each side: $x = 5 - 1 = 4$.",
          "Check by putting the weight back into the original balance: $2 \\times (4 + 1) = 2 \\times 5 = 10$.",
        ],
        illustration: "balance-bags",
      },
    ],
    workedExample: {
      prompt:
        "A level balance has 3 $x$ blocks and 4 cubes on the left pan and 19 cubes on the right pan. Each cube weighs 1 gram. How many grams does one $x$ block weigh?",
      steps: [
        "Level pans hold equal weights. The left pan is 3 blocks and 4 cubes, and the right pan is 19 cubes: $3x + 4 = 19$.",
        "Remove the 4 loose cubes from each pan, so the blocks are alone on the left: $3x = 19 - 4 = 15$.",
        "Split both pans into 3 equal groups, one for each block: $x = 15 \\div 3 = 5$.",
        "Check: $3 \\times 5 + 4 = 15 + 4 = 19$. One block weighs 5 grams.",
      ],
      answer: "5",
      answerUnit: "grams",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "A balance stays level when both pans change in the same way. Removing the loose cubes subtracts the same number from both sides. Splitting into equal groups divides both sides by the same number. Together they leave one block alone.",
        ],
      },
    ],
    pitfalls: [
      "When the blocks are not in bags, remove the loose cubes before splitting.",
      "Split into as many groups as there are blocks or bags.",
      "With bags, the cubes inside the bags count on the left. $2(x + 1)$ has 2 cubes on the left pan, one in each bag.",
    ],
    parentGuide:
      "Draw two pans on paper. Use folded paper squares as blocks and coins as cubes. Set out 3 blocks and 2 coins against 11 coins, then solve by removing and grouping, saying each step aloud.",
    senses: {
      side: "side-of-equation",
      balance: "balance-scale",
      boundary: "boundary",
      "more than": "more-than",
      unit: "unit",
    },
    noLink: [
      "scale",
      "inverse",
      "leaves",
      "cube",
      "cubes",
      "part",
      "parts",
      "whole",
    ],
  },
  {
    id: "inequality-from-context",
    title: "Write an inequality for a condition",
    summary:
      "A condition in words becomes an inequality. The boundary is the number in the condition. Decide whether allowed values are greater or less than it, and whether the boundary itself is allowed.",
    templateIds: ["inequality-context-bound"],
    objectives: [
      "Write $x > c$, $x < c$, $x \\ge c$ or $x \\le c$ for a condition described in words, where $c$ is the boundary number.",
      "Decide whether the boundary value itself makes the condition true.",
    ],
    sections: [
      inequalityTerms,
      {
        title: "From words to symbols",
        paragraphs: [
          "“More than”, “greater than”, “above” and “taller than” describe values greater than the boundary: use $>$. “Less than”, “below”, “younger than” and “colder than” describe values less than the boundary: use $<$.",
          "“At least”, “no less than” and “$c$ or more” include the boundary: use $\\ge$. “At most”, “no more than” and “$c$ or fewer” include it too: use $\\le$. Always test the boundary itself. A ride for riders taller than 48 inches does not let on a rider exactly 48 inches tall. Call a rider's height, how tall the rider is, $h$. Then $h > 48$.",
          "Negative boundaries follow the same rules. A freezer colder than −15 °C could be at −20 °C, and $-20 < -15$. So the temperature $t$ satisfies $t < -15$.",
        ],
        illustration: "inequality-half-lines",
      },
    ],
    workedExample: {
      prompt:
        "A carry-on bag may weigh no more than 10 kilograms. Let $w$ be the weight of an allowed bag, in kilograms. Which inequality describes all possible values of $w$?",
      steps: [
        "“No more than 10 kilograms” allows weights less than 10.",
        "A bag of exactly 10 kilograms is also allowed, so the boundary is included.",
        "Less than or equal to is written $\\le$, so the inequality is $w \\le 10$.",
      ],
      answer: "w ≤ 10",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "Conditions about greater values use $>$ or $\\ge$, and conditions about lesser values use $<$ or $\\le$. The boundary is included, with $\\ge$ or $\\le$, exactly when the condition allows the boundary value.",
        ],
      },
    ],
    pitfalls: [
      "“At least” means greater than or equal to, even though it contains the word “least”.",
      "Test the boundary: “more than 35” leaves out 35, but “35 or more” includes it.",
      "Colder and below mean less than, also for negative temperatures: −20 °C is colder than −15 °C, and $-20 < -15$.",
    ],
    parentGuide:
      "Collect real rules with numbers, such as height limits, age discounts and speed limits. For each, ask whether the exact number on the sign is allowed, then write the inequality together.",
    senses: {
      balance: "balance-scale",
      boundary: "boundary",
      "more than": "more-than",
      unit: "unit",
    },
    noLink: [
      "scale",
      "inverse",
      "leaves",
      "cube",
      "cubes",
      "part",
      "parts",
      "whole",
      "side",
    ],
  },
  {
    id: "inequality-from-number-line",
    title: "Read an inequality from a number line",
    summary:
      "A number line graph shows an inequality. Read the number at the circle, whether the circle is open or filled, and which way the ray points.",
    templateIds: ["inequality-from-number-line"],
    objectives: [
      "Read the boundary, whether it is included, and the direction of a graphed solution set.",
      "Write the matching inequality: $x > c$, $x < c$, $x \\ge c$ or $x \\le c$.",
    ],
    sections: [
      inequalityTerms,
      graphing,
      {
        title: "Read three things",
        paragraphs: [
          "Read the number at the circle, then the circle, then the direction. An open circle at $-3$ with a ray to the left shows every number less than $-3$, but not $-3$ itself: $x < -3$.",
          "A filled circle at 4 with a ray to the right shows 4 and every number greater than 4: $x \\ge 4$. If the boundary tick (the small mark on the line) has no label, find the step size from two labeled ticks. Then count steps from the nearest labeled tick.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A number line shows a filled circle at −2 and a thick ray to the left. Which inequality does the number line show?",
      steps: [
        "The circle is filled, so $-2$ itself is a solution. The sign must include “or equal to”.",
        "The ray points left, toward lesser numbers, so the other solutions are less than $-2$.",
        "Less than or equal to is written $\\le$, so the graph shows $x \\le -2$.",
      ],
      answer: "x ≤ −2",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "A graph's circle shows whether the boundary is a solution: filled means yes, and open means no. Its ray shows the direction in which all the other solutions lie.",
        ],
      },
    ],
    pitfalls: [
      "An open circle leaves out the boundary. A filled circle includes it.",
      "The direction of the ray decides greater or less, not where the circle sits on the page.",
      "Read the boundary from the tick labels. Find how much each step between ticks is worth before counting.",
    ],
    parentGuide:
      "Draw a number line on paper or with chalk. Stand on a number and point one way; your learner names the inequality and decides with you whether you stand on an open or a filled circle.",
    senses: {
      balance: "balance-scale",
      boundary: "boundary",
      "more than": "more-than",
      unit: "unit",
    },
    noLink: [
      "scale",
      "inverse",
      "leaves",
      "cube",
      "cubes",
      "part",
      "parts",
      "whole",
      "side",
    ],
  },
  {
    id: "inequality-number-line-choice",
    title: "Graph an inequality on a number line",
    summary:
      "The boundary is the number an inequality compares with. To graph the inequality, put a circle at the boundary. Fill it only if the boundary makes the inequality true. Then draw the ray toward the other numbers that do.",
    templateIds: ["inequality-number-line-choice"],
    objectives: [
      "Decide whether the boundary is included and which way the solutions go.",
      "Choose the number line that shows every solution of $x > c$, $x < c$, $x \\ge c$ or $x \\le c$.",
    ],
    sections: [
      inequalityTerms,
      graphing,
      {
        title: "Three decisions, then a test",
        paragraphs: [
          "Put the circle at the boundary number. Fill it if the boundary is a solution ($\\ge$ or $\\le$). Leave it open if it is not ($>$ or $<$). Draw the thick ray toward greater numbers, to the right, for $>$ and $\\ge$. Draw it toward lesser numbers, to the left, for $<$ and $\\le$.",
          "Then test a number on the ray. For $x < 3$, 0 is on the ray, and $0 < 3$ is true. 5 is off the ray, and $5 < 3$ is false. When two graphs differ only in the circle or only in the direction, test the boundary and one other number to decide.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Describe the number line that shows the solutions of $x \\ge -1$: is the circle at $-1$ open or filled, and does the ray point left or right?",
      steps: [
        "Test the boundary: $-1 \\ge -1$ is true, because $-1$ equals itself. So $-1$ is a solution, and the circle is filled.",
        "The other solutions are greater than $-1$. Greater numbers are to the right, so the ray points right.",
        "Test a number on the ray: 2 is on it, and $2 \\ge -1$ is true.",
      ],
      answer: "A filled circle at −1 and a ray pointing right",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "The graph of $x > c$, $x < c$, $x \\ge c$ or $x \\le c$ is a ray from $c$, toward greater or lesser numbers. Its circle is filled exactly when $c$ is a solution.",
        ],
      },
    ],
    pitfalls: [
      "Use a filled circle only for $\\ge$ and $\\le$.",
      "Greater numbers are to the right, also for negative boundaries: $x > -4$ points right, toward $-3$, 0 and 5.",
      "Check the boundary label. A graph with the right circle and direction at the wrong number shows a different set.",
    ],
    parentGuide:
      "Write $x > 3$, $x < 3$, $x \\ge 3$ and $x \\le 3$ on cards. Draw the four graphs on separate slips and have your learner match each card to its graph, testing the number 3 every time.",
    senses: {
      balance: "balance-scale",
      boundary: "boundary",
      "more than": "more-than",
      unit: "unit",
    },
    noLink: [
      "scale",
      "inverse",
      "leaves",
      "cube",
      "cubes",
      "part",
      "parts",
      "whole",
      "side",
    ],
  },
  {
    id: "inequality-solution-set",
    title: "The solutions of an inequality",
    summary:
      "A solution is a number that makes an inequality true. The boundary is the number it compares with. For $x > 2$, every number on the correct side of the boundary is a solution, including fractions and decimals, so there are endless solutions.",
    templateIds: ["inequality-solution-set"],
    objectives: [
      "Test whether a number is a solution of $x > c$, $x < c$, $x \\ge c$ or $x \\le c$ by putting it in place of $x$.",
      "Explain why an inequality like $x > 2$ has infinitely many solutions, more than any list could hold.",
    ],
    sections: [
      inequalityTerms,
      {
        title: "Testing a number",
        paragraphs: [
          "To test a number, put it in place of the variable and decide whether the comparison is true. This is called substituting. For $x > 4$, test 4.5: $4.5 > 4$ is true, so 4.5 is a solution. Test $-1$: $-1 > 4$ is false, so $-1$ is not.",
          "Test the boundary carefully. $4 > 4$ is false, so 4 is not a solution of $x > 4$. But $4 \\ge 4$ is true, so 4 is a solution of $x \\ge 4$. If a list of proposed solutions has even one number that fails, the list is wrong.",
        ],
      },
      {
        title: "Infinitely many solutions",
        paragraphs: [
          "The equation $x + 3 = 7$ has exactly one solution, 4. The inequality $x > 2$ has infinitely many solutions, meaning they never run out. 3, 10 and 1000 are solutions. So are numbers that are not whole, such as 2.5, 2.25 and 2.01.",
          "Between any two solutions there is another. Halfway between 2.5 and 3 is 2.75, which is also greater than 2. However closely you look near the boundary, there are more solutions, so they can never all be listed. That is why a solution set is written as an inequality or drawn as a ray.",
        ],
        illustration: "inequality-many-solutions",
      },
    ],
    workedExample: {
      prompt: "Which of the numbers 2.9, 3 and −10 are solutions of x < 3?",
      steps: [
        "Put 2.9 in place of $x$: $2.9 < 3$ is true, so 2.9 is a solution.",
        "Put 3 in place of $x$: $3 < 3$ is false, because 3 equals 3 and is not less. So 3 is not a solution.",
        "Put $-10$ in place of $x$: $-10 < 3$ is true, because $-10$ is far to the left of 3. So $-10$ is a solution.",
      ],
      answer: "2.9 and −10",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "Every number on the correct side of the boundary is a solution of a simple inequality like $x > c$. Between any two such numbers lies another, so there are infinitely many solutions.",
        ],
      },
    ],
    pitfalls: [
      "Numbers that are not whole are solutions too: 2.5 is a solution of $x > 2$.",
      "The boundary of $>$ or $<$ is not a solution. The boundary of $\\ge$ or $\\le$ is.",
      "An inequality like $x > 2$ has infinitely many solutions, not only the next whole number.",
    ],
    parentGuide:
      "Play “Is it a solution?” for $x > 5$. Take turns naming tricky numbers such as 5, 5.1, 4.99, 1000 and −6, and test each by saying the comparison aloud.",
    senses: {
      balance: "balance-scale",
      boundary: "boundary",
      "more than": "more-than",
      unit: "unit",
    },
    noLink: [
      "scale",
      "inverse",
      "leaves",
      "cube",
      "cubes",
      "part",
      "parts",
      "whole",
      "side",
    ],
  },
];

export const equationMethods: Record<string, ProblemMethod> = {
  "one-step-equation": {
    goal: "Find the unknown number in an equation where one operation was done to it, such as $x + 3 = 7$ or $3x = 12$.",
    intuition:
      "An equation says two amounts are equal. Its two sides are the amounts left and right of the equals sign. A variable such as $x$ stands for an unknown number, and $3x$ means 3 times $x$. Inverse operations undo each other: subtracting undoes adding, and dividing undoes multiplying. Doing the same thing to both sides keeps them equal.",
    terms: ["solution", "inverse-operation"],
    method: [
      "Name the operation done to the variable: adding, subtracting, multiplying or dividing.",
      "Do its inverse to both sides. Subtract what was added, add what was subtracted, divide by the number that multiplied, or multiply by the number that divided.",
      "Check by putting the value back into the original equation.",
    ],
    watch:
      "Do the inverse operation, not the same one: $x + 6 = 15$ gives 9, not 21.",
    senses: {
      side: "side-of-equation",
      balance: "balance-scale",
      boundary: "boundary",
      "more than": "more-than",
      unit: "unit",
    },
    noLink: [
      "scale",
      "inverse",
      "leaves",
      "cube",
      "cubes",
      "part",
      "parts",
      "whole",
    ],
  },
  "one-step-equation-story": {
    goal: "Choose the equation that matches a story, and the value of the unknown that solves it.",
    intuition:
      "A variable is a letter for the unknown amount in the story. An equation, a statement that two amounts are equal, shows the one action done to it: adding, taking away, equal groups, or sharing equally. An equation's two sides are the amounts left and right of the equals sign. Undoing the action on both sides finds the unknown.",
    terms: ["variable", "equation"],
    method: [
      "Find the one action done to the unknown: add, take away, equal groups or sharing.",
      "Write that operation on the variable, equal to the result the story reports.",
      "Undo the operation on both sides. Then check the value in the story.",
    ],
    watch:
      "Check both parts: a correct solution of the wrong equation is still wrong.",
    senses: {
      side: "side-of-equation",
      balance: "balance-scale",
      boundary: "boundary",
      "more than": "more-than",
      unit: "unit",
    },
    noLink: [
      "scale",
      "inverse",
      "leaves",
      "cube",
      "cubes",
      "part",
      "parts",
      "whole",
    ],
  },
  "balance-one-step": {
    goal: "Find the weight of one $x$ block on a level balance in one step.",
    intuition:
      "A balance has two pans, and level pans hold equal weight. Each $x$ block has the same unknown weight, and each small cube weighs 1 gram, a small unit of weight. Taking the same weight off both pans, or splitting both pans into the same number of equal groups, keeps them level.",
    terms: ["balance-scale"],
    method: [
      "Write the equation the pans show, such as $x + 5 = 12$ or $3x = 12$.",
      "Remove the loose cubes from both pans, or split both pans into one group per block.",
      "Read the weight that one block balances.",
    ],
    watch: "Change both pans in the same way, never one pan alone.",
    senses: {
      balance: "balance-scale",
      boundary: "boundary",
      "more than": "more-than",
      unit: "unit",
    },
    noLink: [
      "scale",
      "inverse",
      "leaves",
      "cube",
      "cubes",
      "part",
      "parts",
      "whole",
    ],
  },
  "two-step-equation": {
    goal: "Find the unknown number $x$ in an equation where two operations were done to it, such as $3x + 5 = 20$ or $4(x - 3) = 28$.",
    senses: { side: "side-of-equation" },
    terms: ["coefficient"],
    method: [
      "List what was done to $x$, in order. In $3x + 5$, $x$ was multiplied by 3 and then 5 was added. In $4(x - 3)$, 3 was subtracted and then the result was multiplied by 4.",
      "Undo the last operation (adding, subtracting or multiplying) on both sides. Subtract what was added, add what was subtracted, divide by the number that multiplied, or multiply by the number that divided.",
      "Undo the remaining operation on both sides. Now $x$ stands alone.",
      "Check: put your answer into the original equation and confirm both sides are equal.",
    ],
    watch:
      "In $3x + 5$, undo the + 5 first. In $4(x - 3)$, divide by 4 first, because that multiplication happened last.",
  },
  "two-step-word-problem": {
    goal: "Write an equation for a two-step story, such as $14m + 30 = 142$, and solve it.",
    intuition:
      "A variable is a letter for the unknown amount, and $14m$ means 14 times $m$. An amount that repeats, like 14 dollars per month, multiplies the unknown. An amount paid once, like a 30-dollar fee, is added once. An equation's two sides are the amounts left and right of the equals sign. Parentheses are curved brackets that group a part, as in $4(c + 3)$. To solve, undo the steps in reverse order, doing each step to both sides.",
    terms: [
      [
        "rate",
        "Here, an amount charged for each unit, like 14 dollars per month, multiplies the number of units.",
      ],
    ],
    method: [
      "Name the unknown with a letter, and say what it counts and in what unit.",
      "Write the equation: the repeated amount times the letter, plus the one-time amount (or minus it, if it is taken off), equals the total. If every group contains the extra amount, use parentheses, as in $4(c + 3)$.",
      "Undo the operations in reverse order, last one first, on both sides. Check the answer in the story.",
    ],
    watch:
      "Multiply the repeated amount by the unknown. Add a one-time amount once.",
    senses: {
      side: "side-of-equation",
      balance: "balance-scale",
      boundary: "boundary",
      "more than": "more-than",
      unit: "unit",
    },
    noLink: [
      "scale",
      "inverse",
      "leaves",
      "cube",
      "cubes",
      "part",
      "parts",
      "whole",
    ],
  },
  "two-step-equation-model": {
    goal: "Choose the equation that matches a two-step story.",
    intuition:
      "An equation fits a story when every amount plays its part exactly once. A price for one unit times the number of units gives the cost, as in $2.25d$ for $d$ miles at 2.25 dollars per mile. Either number may be the unknown. An amount that happens once is added or subtracted once. Parentheses are curved brackets that group a part: in $5(c + 8)$, they put the extra 8 in every group.",
    terms: [
      [
        "constant-term",
        "In a story, a one-time amount such as a fee is added or subtracted once.",
      ],
    ],
    method: [
      "Find the amount that repeats for each unit of the unknown.",
      "Decide whether the extra amount happens once, or once in every group.",
      "Choose the equation that uses every part of the story exactly once.",
    ],
    watch:
      "In $5(c + 8)$ the 8 is counted in every group. In $5c + 8$ it is counted only once.",
    senses: {
      balance: "balance-scale",
      boundary: "boundary",
      "more than": "more-than",
      unit: "unit",
    },
    noLink: [
      "scale",
      "inverse",
      "leaves",
      "cube",
      "cubes",
      "part",
      "parts",
      "whole",
    ],
  },
  "balance-two-step": {
    goal: "Find the weight of one $x$ block on a level balance in two steps.",
    intuition:
      "Level pans hold equal weight. Each $x$ block has the same unknown weight, and each cube weighs 1 gram, a small unit of weight. A bag holds one block and some cubes, and all bags match. Removing the same weight from both pans, or splitting both pans into equal groups, keeps the balance level.",
    terms: [
      [
        "variable",
        "Here a bag holds one $x$ block and some cubes, and all bags are identical.",
      ],
    ],
    method: [
      "Write the equation, such as $3x + 4 = 19$, or $2(x + 1) = 10$ when the blocks are in bags.",
      "Without bags, remove the loose cubes from both pans, then split into one group per block.",
      "With bags, split both pans into one group per bag first. Then remove the bag's cubes, and the same number of cubes from the other pan.",
    ],
    watch: "Count the cubes in every bag. Each bag has its own.",
    senses: {
      balance: "balance-scale",
      boundary: "boundary",
      "more than": "more-than",
      unit: "unit",
    },
    noLink: [
      "scale",
      "inverse",
      "leaves",
      "cube",
      "cubes",
      "part",
      "parts",
      "whole",
    ],
  },
  "inequality-context-bound": {
    goal: "Write the inequality for a condition stated in words, such as “at least 12”.",
    intuition:
      "An inequality compares with a sign: $>$ is greater than, $<$ is less than, $\\ge$ is greater than or equal to, and $\\le$ is less than or equal to. The boundary is the number in the condition. “At least” and “at most” allow the boundary. “More than” and “less than” do not.",
    terms: ["boundary"],
    method: [
      "Decide whether the allowed values are greater or less than the boundary.",
      "Decide whether the boundary itself is allowed.",
      "Choose $>$, $<$, $\\ge$ or $\\le$ to match.",
    ],
    watch:
      "“At least” and “at most” include the boundary. “More than” and “less than” do not.",
    senses: {
      balance: "balance-scale",
      boundary: "boundary",
      "more than": "more-than",
      unit: "unit",
    },
    noLink: [
      "scale",
      "inverse",
      "leaves",
      "cube",
      "cubes",
      "part",
      "parts",
      "whole",
      "side",
    ],
  },
  "inequality-from-number-line": {
    goal: "Name the inequality that a number line graph shows.",
    intuition:
      "On a number line, numbers grow to the right. The boundary is the number the inequality compares with, and a circle marks it. A solution is a number that makes the inequality true. An open circle means the boundary is not a solution, and a filled circle means it is. A thick ray covers every other solution: to the right for greater, to the left for less.",
    terms: ["open-circle", "closed-circle"],
    method: [
      "Read the boundary number at the circle.",
      "Open circle: $>$ or $<$. Filled circle: $\\ge$ or $\\le$.",
      "Ray to the right: greater. Ray to the left: less.",
    ],
    watch: "The ray's direction decides greater or less.",
    senses: {
      balance: "balance-scale",
      boundary: "boundary",
      "more than": "more-than",
      unit: "unit",
    },
    noLink: [
      "scale",
      "inverse",
      "leaves",
      "cube",
      "cubes",
      "part",
      "parts",
      "whole",
      "side",
    ],
  },
  "inequality-number-line-choice": {
    goal: "Choose the number line that shows every solution of an inequality.",
    intuition:
      "A solution is a number that makes an inequality true. On a number line, a circle marks the boundary: filled if the boundary is a solution ($\\ge$ or $\\le$), open if not ($>$ or $<$). A thick ray points toward the other solutions: right for greater, left for less.",
    terms: [
      [
        "ray",
        "On a number line graph, a thick ray shows every solution and continues without end.",
      ],
    ],
    method: [
      "Find the boundary. Fill its circle only for $\\ge$ or $\\le$.",
      "Point the ray right for $>$ or $\\ge$, and left for $<$ or $\\le$.",
      "Test a number on the ray in the inequality.",
    ],
    watch: "A graph can have the right direction and the wrong circle.",
    senses: {
      balance: "balance-scale",
      boundary: "boundary",
      "more than": "more-than",
      unit: "unit",
    },
    noLink: [
      "scale",
      "inverse",
      "leaves",
      "cube",
      "cubes",
      "part",
      "parts",
      "whole",
      "side",
    ],
  },
  "inequality-solution-set": {
    goal: "Decide which numbers solve an inequality, and how many solutions it has.",
    intuition:
      "A solution is a number that makes an inequality true. To test a number, put it in place of $x$ and check the comparison. Every number on the correct side of the boundary, the number being compared with, works, including decimals and fractions, so the solutions never run out.",
    terms: ["solution"],
    method: [
      "Put each number in place of $x$ and decide whether the comparison is true.",
      "Test the boundary: it is a solution only for $\\ge$ or $\\le$.",
      "Every number on the correct side, whole or not, is a solution.",
    ],
    watch:
      "There are infinitely many solutions, including decimals and fractions.",
    senses: {
      balance: "balance-scale",
      boundary: "boundary",
      "more than": "more-than",
      unit: "unit",
    },
    noLink: [
      "scale",
      "inverse",
      "leaves",
      "cube",
      "cubes",
      "part",
      "parts",
      "whole",
      "side",
    ],
  },
};

export const equationPrinciples: Record<string, string> = {
  "one-step-equation":
    "Doing the same operation to both sides of an equation keeps the sides equal. This holds for adding, subtracting, and multiplying or dividing by the same number other than 0. So doing the inverse of the operation on the variable leaves it alone without changing the solution.",
  "one-step-equation-story":
    "An equation fits a story when its operation on the unknown is the story's action, and its other side is the result the story reports.",
  "balance-one-step":
    "Removing equal weights from both pans keeps a balance level. So does splitting both pans into the same number of equal groups.",
  "two-step-equation":
    "Doing the same operation to both sides of an equation keeps its solution, the value of $x$ that makes it true. This works for adding, subtracting, and multiplying or dividing by the same number other than 0. So the operations applied to $x$ are undone in reverse order.",
  "two-step-word-problem":
    "A repeated amount multiplies the unknown, and a one-time amount is added once: $px + q = r$. Equal groups that each contain the unknown give $p(x + q) = r$.",
  "two-step-equation-model":
    "An equation fits a story when each amount plays its role in the story. A price for each unit multiplies the number of units. A one-time amount is added or subtracted once. An extra amount in every group goes inside parentheses, multiplied by the number of groups.",
  "balance-two-step":
    "A balance stays level when both pans change in the same way. Removing the loose cubes and splitting into equal groups leaves one block alone.",
  "inequality-context-bound":
    "Conditions about greater values use $>$ or $\\ge$, and conditions about lesser values use $<$ or $\\le$. The boundary is included exactly when the condition allows the boundary value.",
  "inequality-from-number-line":
    "A graph's circle shows whether the boundary is a solution, and its ray shows the direction in which all the other solutions lie.",
  "inequality-number-line-choice":
    "The graph of $x > c$, $x < c$, $x \\ge c$ or $x \\le c$ is a ray from $c$, toward greater or lesser numbers. Its circle is filled exactly when $c$ is a solution.",
  "inequality-solution-set":
    "Every number on the correct side of the boundary is a solution of a simple inequality. Between any two such numbers lies another, so there are infinitely many solutions.",
};
