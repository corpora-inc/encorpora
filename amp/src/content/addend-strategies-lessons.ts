import type { FacetMapping } from "./coverage";
import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

/**
 * Lessons, methods and principles for turnaround facts, making ten with three
 * addends (1.OA.B.3) and equal addends on arrays (2.OA.C.4).
 */

export const addendStrategiesMethods: Record<string, ProblemMethod> = {
  "turn-around-fact": {
    goal: "Use a known addition fact to choose its turnaround, or choose the true sentence about turning a fact around.",
    intuition:
      "An addition fact such as $8 + 3 = 11$ puts two parts together to make a whole. The parts are 8 and 3, and the whole is 11. Swap the two parts and you have the same counters, so the whole is still 11: $3 + 8 = 11$. This new fact is called the turnaround fact. Taking away is different: $8 - 3$ is 5, but you cannot take 8 away from only 3.",
    senses: { whole: "whole", part: "part", parts: "part" },
    terms: ["addend", "sum", "number-sentence"],
    method: [
      "Find the two parts that are added and the whole they make.",
      "Swap the two parts. The whole does not change, so the turnaround fact has the same whole.",
      "Turn around only when you put together. A sentence that turns a take-away around is not true.",
    ],
    watch:
      "Keep the whole as the answer. A sentence that adds the whole to a part, or that uses a minus sign, is a different fact.",
  },
  "turn-around-sum": {
    goal: "Given a known addition fact, find the sum of the same two numbers in the other order.",
    intuition:
      "The sum is the answer to an addition. If you know $6 + 7 = 13$, then $7 + 6$ uses the same two numbers in the other order. The counters are the same, only moved, so the sum is the same: 13. You do not need to count again.",
    terms: ["sum", "addend"],
    method: [
      "Check that the new addition uses the same two numbers as the fact you know.",
      "Only the order changed, so the counters did not change. Use the sum you already know.",
    ],
    watch:
      "Do not subtract or count again. Swapping the two numbers keeps the same sum.",
  },
  "make-ten-grouping": {
    goal: "Find the two numbers in a three-number sum that make ten, or the sum that has such a pair.",
    intuition:
      "When you add three numbers, you can add them in any order. Look for two numbers that make 10, like 6 and 4. They fill a ten frame, a box of 10 squares in two rows of 5. Adding the third number to 10 is easy: $10 + 2 = 12$.",
    terms: ["make-ten", "ten-frame", "sum", "addend"],
    method: [
      "Check each pair of numbers: the first and second, the first and third, the second and third.",
      "Partners to ten are 1 and 9, 2 and 8, 3 and 7, 4 and 6, and 5 and 5. Choose the pair that is one of these.",
      "Add the ten first, then add the number that is left.",
    ],
    watch:
      "Do not just take the first two numbers. Check all three pairs, and make sure the pair makes exactly 10.",
  },
  "make-ten-step": {
    goal: "Fill the box when a three-number sum is rewritten with its ten: the number left over, or the ten.",
    intuition:
      "In $7 + 5 + 3$, the 7 and the 3 make 10. So $7 + 5 + 3$ is the same as $10 + 5$. The box in $7 + 5 + 3 = 10 + \\square$ stands for the number that is left after the ten is made. When the left-over number is already written, the box stands for the ten.",
    terms: ["make-ten", "equal-sign", "addend"],
    method: [
      "Find the two numbers that make 10.",
      "Look at what is already written after the equal sign. If 10 is written, the box is the number left over. If the left-over number is written, the box is the 10.",
      "Check that the numbers before and after the equal sign make the same total.",
    ],
    watch:
      "The box is not the total of all three numbers. It is only the part that is not written yet.",
  },
  "array-add-rows-total": {
    goal: "Find how many dots are in an array by adding its equal rows.",
    intuition:
      "An array is dots set out in rows that all have the same number of dots. A row goes across. Because every row is the same, you can count one row and then add that number once for each row: 3 rows of 4 is $4 + 4 + 4 = 12$. A card can hide dots, but the rows under it still have the same number.",
    terms: ["array", "addend", "sum"],
    method: [
      "Count the dots in one row, or read how many are in each row.",
      "Count the rows. Add the number in one row once for every row.",
      "Add one row at a time and keep a running total.",
    ],
    watch:
      "Add the number in a row once for every row. Do not add the number of rows and the number in a row together.",
  },
  "equal-addends-match": {
    goal: "Choose the equation that adds equal rows to show how many dots an array has.",
    intuition:
      "An equation is a number sentence with an equal sign. For an array, each row has the same number of dots, so the equation adds that number again and again. 3 rows of 4 is $4 + 4 + 4 = 12$: three addends, each 4. An addend is a number being added.",
    terms: ["array", "equation", "addend"],
    method: [
      "Count the dots in one row: that is each addend.",
      "Count the rows: that is how many addends there are.",
      "Add one row at a time and check the total after the equal sign.",
    ],
    watch:
      "Check three things: each addend, how many addends, and the total. An equation that adds the number of rows to the number in a row is not the total.",
  },
  "equal-addends-array": {
    goal: "Choose the array whose rows match a sum of equal addends.",
    intuition:
      "In $4 + 4 + 4 = 12$, the number 4 is added three times. An addend is a number being added. Each addend can be one row of an array, so the array has 3 rows with 4 dots in each row.",
    terms: ["array", "addend", "equation"],
    method: [
      "Count the addends: that is the number of rows.",
      "Read one addend: that is the number of dots in each row.",
      "Choose the array with that many rows and that many dots in each row.",
    ],
    watch:
      "Check both numbers. An array with one row too many, or rows of the wrong length, does not match.",
  },
  "equal-addends-select": {
    goal: "Select both equal-addends equations for an array: adding its rows and adding its columns.",
    intuition:
      "An array has rows that go across and columns that go up and down. An array of 3 rows with 4 dots in each row has 4 columns with 3 dots in each column. Adding the rows gives $4 + 4 + 4 = 12$. Adding the columns gives $3 + 3 + 3 + 3 = 12$. Both count the same dots.",
    terms: ["array", "equation", "addend"],
    method: [
      "Write the rows: add the number in one row once for every row.",
      "Write the columns: add the number in one column once for every column.",
      "Leave out an equation that adds the number of rows to the number in a row.",
    ],
    watch:
      "There are two right equations, one for the rows and one for the columns. Check each addend and the number of addends.",
  },
};

export const addendStrategiesPrinciples: Record<string, string> = {
  "turn-around-fact":
    "Changing the order of two addends does not change the sum: $a + b = b + a$. This is called the commutative property of addition. Subtraction does not have this property: $9 - 4$ is not $4 - 9$.",
  "turn-around-sum":
    "If $a + b = c$, then $b + a = c$. Changing the order of the addends does not change the sum.",
  "make-ten-grouping":
    "Three addends can be added in any order and grouped in any way: the sum stays the same. Grouping two addends that make 10 first gives an easy last step, 10 plus the third addend.",
  "make-ten-step":
    "When two of three addends make 10, the sum equals 10 plus the third addend. An equation such as $7 + 5 + 3 = 10 + 5$ records that grouping: the sum before the equal sign and the sum after it are the same, 15.",
  "array-add-rows-total":
    "An array with $r$ rows and $c$ dots in each row has $c$ added $r$ times dots in all. Hidden dots still count, because every row of an array has the same number.",
  "equal-addends-match":
    "The equation for an array with $r$ rows of $c$ adds $c$ exactly $r$ times, and its total is the number of dots.",
  "equal-addends-array":
    "A sum of $r$ equal addends, each $c$, matches the array with $r$ rows of $c$ dots.",
  "equal-addends-select":
    "An array with $r$ rows of $c$ dots also has $c$ columns of $r$ dots. So $c$ added $r$ times and $r$ added $c$ times give the same total.",
};

export const addendStrategiesLessons: Lesson[] = [
  chainLesson({
    id: "addend-strategies-turnaround-ten-lesson",
    title: "Turnaround facts and making ten",
    summary:
      "Swap the two numbers in an addition fact and the sum stays the same. With three numbers, find two that make 10, add them first, then add the rest.",
    senses: { whole: "whole", part: "part", parts: "part" },
    templateIds: [
      "turn-around-fact",
      "turn-around-sum",
      "make-ten-grouping",
      "make-ten-step",
    ],
    objectives: [
      "Use a known fact to know its turnaround, and see that taking away does not turn around.",
      "Find the two addends that make ten, and write the ten and the number left over.",
    ],
    openingTitle: "Same numbers, easier order",
    opening: [
      "An addition fact puts two parts together to make a whole. In $8 + 3 = 11$, the parts are 8 and 3, and the whole is 11. Swap the parts: $3 + 8$ uses the same counters, so it is 11 too. This is called a turnaround fact. If you know one, you know the other.",
      "Taking away does not turn around. $9 - 4$ is 5. From 4 counters you cannot take away 9, so $4 - 9$ is not 5.",
      "With three numbers, look for two that make 10. They fill a ten frame, a box of 10 squares in two rows of 5. In $2 + 6 + 4$, the 6 and the 4 make 10. Then $10 + 2 = 12$.",
    ],
    example: {
      prompt: "What goes in the box? $7 + 5 + 3 = 10 + \\square$",
      steps: [
        "Check the pairs: 7 and 5 make 12, 7 and 3 make 10, 5 and 3 make 8. So 7 and 3 make the ten.",
        "The 10 is already written after the equal sign. The number left over is 5, so 5 goes in the box.",
        "Check: $7 + 5 + 3$ is 15, and $10 + 5$ is 15.",
      ],
      answer: "5",
    },
    methodTitle: "Turn around, then look for ten",
    method: [
      "For two addends, swap them to get the turnaround fact. The sum stays the same.",
      "For three addends, check all three pairs. Partners to ten are 1 and 9, 2 and 8, 3 and 7, 4 and 6, and 5 and 5.",
      "Add the ten first, then add the number that is left.",
    ],
    formalTitle: "Why the order does not matter",
    formal: [
      "Changing the order of addends does not change the sum: $a + b = b + a$. This is called the commutative property of addition. Subtraction does not have it.",
      "Three addends can be grouped in any way: $(a + b) + c = a + (b + c)$. This is called the associative property of addition. It lets you add the pair that makes 10 first.",
    ],
    pitfalls: [
      "Turning a take-away around, as if $9 - 4$ were the same as $4 - 9$.",
      "Adding the first two numbers out of habit instead of finding the pair that makes 10.",
      "Writing the total of all three numbers in the box instead of the part that is missing.",
    ],
    parentGuide:
      "Ask your learner to say the two parts and the whole before swapping them. With three numbers, ask which two fill a ten frame before anything is added.",
  }),
  chainLesson({
    id: "addend-strategies-array-lesson",
    title: "Adding the rows of an array",
    summary:
      "An array has rows with the same number of dots. Add that number once for each row to find the total, and write it as an equation with equal addends.",
    templateIds: [
      "array-add-rows-total",
      "equal-addends-match",
      "equal-addends-array",
      "equal-addends-select",
    ],
    objectives: [
      "Find the total of an array with up to 5 rows and 5 columns by adding equal rows.",
      "Match an array to an equation that adds equal numbers, by rows or by columns.",
    ],
    openingTitle: "Every row is the same",
    opening: [
      "An array is dots set out in rows that all have the same number of dots. A row goes across, and a column goes up and down.",
      "Because every row is the same, count one row and add that number once for each row. 3 rows of 4 dots is $4 + 4 + 4$. Add one row at a time: 4, 8, 12.",
      "An equation is a number sentence with an equal sign. $4 + 4 + 4 = 12$ is an equation with equal addends, numbers being added that are all the same. The columns give another one: 4 columns of 3 is $3 + 3 + 3 + 3 = 12$.",
    ],
    example: {
      prompt:
        "An array has 3 rows with 5 dots in each row. How many dots are in the array?",
      steps: [
        "One row has 5 dots, so each row adds 5.",
        "There are 3 rows, so add 5 three times: $5 + 5 + 5$.",
        "Add one row at a time: 5, 10, 15.",
      ],
      answer: "15",
    },
    methodTitle: "Count one row, then add it for every row",
    method: [
      "Count the dots in one row. That number is each addend.",
      "Count the rows. That is how many addends there are.",
      "Add one row at a time. The columns give a second equation with the same total.",
    ],
    formalTitle: "Equal addends",
    formal: [
      "An array with $r$ rows and $c$ dots in each row has $c$ added $r$ times dots. It also has $c$ columns of $r$ dots, so $r$ added $c$ times gives the same total.",
    ],
    pitfalls: [
      "Adding the number of rows and the number in a row, as in $3 + 4$, instead of adding the rows.",
      "Writing one addend too many or too few: count the rows again.",
      "Forgetting the dots under a card. Every row has the same number, seen or not.",
    ],
    parentGuide:
      "Point to one row and ask how many dots it has. Then ask how many rows there are, and have your learner add the row once for each one.",
  }),
];

export const addendStrategiesFacetMappings: FacetMapping[] = [
  {
    templateId: "turn-around-fact",
    facetId: "turn-around-facts.core",
    extent: "partial",
    rationale:
      "Choosing the turnaround of a known addition fact, written sum-last or sum-first, against whole-as-part and sign-swap sentences, and choosing the true sentence when a take-away turnaround is offered. It does not ask the learner to subtract by a property.",
  },
  {
    templateId: "turn-around-sum",
    facetId: "turn-around-facts.core",
    extent: "partial",
    rationale:
      "Entering the sum of a known fact's addends in the other order, with both orders drawn as counters. Addends 1 to 9 with sums to 17; doubles are excluded because they have no turnaround.",
  },
  {
    templateId: "make-ten-grouping",
    facetId: "three-addends.core",
    extent: "partial",
    rationale:
      "Choosing the pair of three addends that makes ten, with the pair in any of the three positions, or choosing the three-addend sum that contains a pair to ten among near-miss, double and no-pair sums. It does not assess the total.",
  },
  {
    templateId: "make-ten-step",
    facetId: "three-addends.core",
    extent: "partial",
    rationale:
      "Entering the box in a three-addend sum rewritten with its ten: the addend left over when 10 is written, or 10 when the left-over addend is written. Totals 11 to 19.",
  },
  {
    templateId: "array-add-rows-total",
    facetId: "arrays.core",
    extent: "partial",
    rationale:
      "Entering the number of dots in an array of up to 5 rows and 5 columns by adding equal rows, finishing a shown sum of equal rows or columns, or adding rows hidden under a card. It does not ask for an equation.",
  },
  {
    templateId: "equal-addends-match",
    facetId: "arrays.core",
    extent: "partial",
    rationale:
      "Choosing the equal-addends equation for an array's rows against adding the two dimensions, the wrong number of addends and a wrong sum. Choosing stands in for writing the equation, which it does not assess.",
  },
  {
    templateId: "equal-addends-array",
    facetId: "arrays.core",
    extent: "partial",
    rationale:
      "Choosing the array whose rows match a shown sum of equal addends against arrays with a row too many or too few, rows of the wrong length, or the same number for rows and row length.",
  },
  {
    templateId: "equal-addends-select",
    facetId: "arrays.core",
    extent: "partial",
    rationale:
      "Selecting both equal-addends equations for an array, by rows and by columns, against adding the two dimensions and a square of the row length. The response shows that two are to be chosen.",
  },
];
