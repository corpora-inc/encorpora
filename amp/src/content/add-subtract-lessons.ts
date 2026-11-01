import type { MethodTerm } from "../glossary/types";
import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

export const addSubtractLessons: Lesson[] = [
  {
    id: "add-within-100",
    title: "Add within 100 by place",
    summary:
      "A ten is a group of 10 ones. 47 is 4 tens and 7 ones. To add, put ones with ones and tens with tens. If the ones make 10 or more, swap 10 of them for 1 ten. Then add the tens.",
    noLink: ["base"],
    templateIds: ["add-two-digit-regroup", "make-hundred"],
    objectives: [
      "Add two numbers from 10 to 99, swapping 10 ones for 1 ten when needed.",
      "Find the number that joins a number below 100 to make 100.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "The amount stays the same when you trade",
        paragraphs: [
          "A dime is a coin worth the same as 10 pennies. Swapping 10 pennies for 1 dime keeps the same amount of money. Tens and ones work the same way.",
          "A digit is one of the symbols 0 to 9 we use to write numbers. In 47, the right digit counts ones and the left digit counts tens. The ones place is the spot on the right. The tens place is the spot to its left.",
          "Add 47 + 38. Put the ones together: 7 ones and 8 ones make 15 ones. Swap 10 of those ones for 1 ten. Now there is 1 new ten and 5 ones. This swap is called regrouping.",
          "Now add the tens: 4 tens, 3 tens and the new ten make 8 tens. 8 tens and 5 ones is 85. The answer to an adding problem is called the sum, so the sum is 85.",
          "When you write the sum, put the new ten above the tens. Moving the new ten over like this is called carrying.",
        ],
      },
      {
        stage: "method",
        title: "Add each place",
        paragraphs: [
          "Look at the picture. 47 is written above 38, with ones under ones and tens under tens. Start with the ones: 7 + 8 = 15. Write the 5 under the ones. Carry the 1 ten: write a small 1 above the tens.",
          "Then add the tens, and include the carried ten: 1 + 4 + 3 = 8. The sum is 85.",
          "Counting on means starting at a number and counting forward. You can check the sum by counting on. Start at 47. Count on 3 tens: 57, 67, 77. Then count on 8 ones: 78, 79, 80, 81, 82, 83, 84, 85.",
        ],
        illustration: "column-addition",
      },
      {
        stage: "method",
        title: "Make one hundred",
        paragraphs: [
          "What joins 36 to make 100? First count up to the next ten: 36 to 40 is 4.",
          "Then count by tens from 40 to 100: 50, 60, 70, 80, 90, 100. That is 6 tens, or 60.",
          "The missing number is both counts together: 4 + 60 = 64. Check by adding: 36 + 64 = 100.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Place value and regrouping",
        paragraphs: [
          "Place value is what a digit is worth because of its place. In 47, the 4 is worth 4 tens, or 40. One ten is worth 10 ones. So regrouping 10 ones as 1 ten keeps the sum the same.",
          "Add digits in the same place. Carry each full group of ten to the next place to the left.",
          "To make 100, split the missing amount into two counts. The first count goes up to the next ten. The second goes from there to 100. Together they are the missing amount.",
        ],
      },
    ],
    workedExample: {
      prompt: "What is 58 + 26?",
      steps: [
        "Add the ones first: 8 + 6 = 14. That is 1 ten and 4 ones.",
        "Write 4 in the ones place. Carry the 1 ten over to the tens.",
        "Add the tens, with the carried ten: 5 + 2 + 1 = 8 tens.",
        "8 tens and 4 ones is 84. So 58 + 26 = 84.",
      ],
      answer: "84",
    },
    pitfalls: [
      "When the ones make 10 or more, write only the ones left over. Carry the new ten to the tens.",
      "Add the carried ten in with the tens. In 58 + 26, the tens are 5 + 2 + 1 = 8.",
    ],
    parentGuide:
      "Use dimes and pennies. Add two amounts, such as 47 cents and 38 cents. Trade ten pennies for a dime whenever you can. Ask what the trade did to the total. It did nothing: 10 pennies and 1 dime are worth the same.",
  },
  {
    id: "subtract-within-100",
    title: "Subtract within 100 by regrouping a ten",
    summary:
      "A ten is a group of 10 ones. To take away, take ones from ones and tens from tens. Sometimes there are not enough ones. Then break 1 ten into 10 ones. This is called regrouping. The number keeps its value.",
    senses: {
      part: "part",
      difference: "difference-subtract",
      cube: "cube",
    },
    noLink: ["change", "leaves"],
    templateIds: ["subtract-two-digit-regroup"],
    objectives: [
      "Take a number from 10 to 99 away from a number up to 100.",
      "Explain why trading 1 ten for 10 ones does not change a number.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Trade without changing the amount",
        paragraphs: [
          "Say you have 82 and need to take away 47. 82 is 8 tens and 2 ones. You can take away 4 tens. But you cannot take 7 ones from 2 ones.",
          "So break 1 ten into 10 ones. Now you have 7 tens and 12 ones. It is still 82, just grouped another way. Now there are enough ones and enough tens.",
          "Adding can check a take-away. Take 47 away from 82, and 35 is left. Put the 47 back: 35 + 47 = 82. You get the number you started with.",
        ],
      },
      {
        title: "Trade before you take",
        paragraphs: [
          "Base-ten blocks are blocks for building numbers. Look at them in the picture. A long rod is 1 ten. A small cube, a block with 6 square faces, is 1 one. 82 is 8 rods and 2 cubes. One rod is traded for 10 cubes, so 82 is now 7 tens and 12 ones.",
          "Now take away ones from ones: 12 − 7 = 5. Then take away tens from tens: 7 − 4 = 3. 3 tens and 5 ones is 35, so 82 − 47 = 35.",
        ],
        illustration: "base-ten-trade",
      },
      {
        title: "Check with addition",
        paragraphs: [
          "A part is one of the pieces a number splits into. Taking away finds a missing part. So add the part you took away back to your answer. You must get the starting number: 35 + 47 = 82.",
          "100 is 1 hundred, 0 tens and 0 ones. A hundred is a group of 10 tens. To take away from 100, trade the hundred for 10 tens first. Then trade 1 ten for 10 ones. Now 100 is 9 tens and 10 ones.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Trading a ten",
        paragraphs: [
          "One ten is worth 10 ones. So trading 1 ten for 10 ones keeps the starting number the same. Then you can take ones from ones and tens from tens.",
          "The answer to a take-away problem is called the difference. Check it by adding: the difference plus the amount taken away equals the starting number.",
        ],
      },
    ],
    workedExample: {
      prompt: "What is 70 − 26?",
      steps: [
        "70 is 7 tens and 0 ones. You cannot take 6 ones from 0 ones.",
        "So regroup 1 ten as 10 ones. Now 70 is 6 tens and 10 ones.",
        "Take away the ones: 10 − 6 = 4. Take away the tens: 6 − 2 = 4.",
        "4 tens and 4 ones is 44. Check by adding: 44 + 26 = 70. So 70 − 26 = 44.",
      ],
      answer: "44",
    },
    pitfalls: [
      "Take the ones you are taking away from the ones you have, never the other way. 82 − 47 is 35, not 45.",
      "After you trade, there is one ten fewer. 82 becomes 7 tens and 12 ones, not 8 tens and 12 ones.",
    ],
    parentGuide:
      "Make 82 cents with 8 dimes and 2 pennies. Ask for 47 cents. Let the learner find that they must trade a dime for ten pennies first.",
  },
  {
    id: "add-subtract-thousands",
    title: "Add and subtract within 1000",
    summary:
      "Numbers up to 1,000 have hundreds, tens and ones. A ten is 10 ones, and a hundred is 10 tens. A digit is one of the symbols 0 to 9, and its place tells what it counts: ones, tens or hundreds. Adding and taking away use the same trades as smaller numbers. Trading 10 of one place for 1 of the next place to the left is called regrouping. It works the other way too, and it never changes the number.",
    senses: { difference: "difference-subtract" },
    noLink: ["base", "changes"],
    templateIds: ["add-three-digit", "subtract-three-digit"],
    objectives: [
      "Add three-digit numbers, regrouping in any place.",
      "Subtract three-digit numbers, including regrouping across a zero.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "A zero means a place has no pieces to trade",
        paragraphs: [
          "To take 268 from 503, you need to take 8 ones. But 503 has only 3 ones. Usually you would trade 1 ten for 10 ones.",
          "Here the tens digit is 0, so there are no tens to trade. Trade 1 hundred for 10 tens first. Then trade 1 of those tens for 10 ones. The 10 new ones join the 3 ones, making 13 ones.",
          "The number is still 503. Only the grouping changed: 4 hundreds, 9 tens and 13 ones. There are 9 tens because 10 tens came in and 1 went to the ones.",
          "You can check a subtraction by adding. The answer plus the amount you took away must give back the starting number.",
        ],
      },
      {
        title: "Regroup across a zero",
        paragraphs: [
          "Look at 503 − 268 written in columns, one place in each column. The 5 hundreds become 4. The 0 tens become 9. The 3 ones become 13. That is still 503, written another way.",
          "Now subtract each place. Ones: 13 − 8 = 5. Tens: 9 − 6 = 3. Hundreds: 4 − 2 = 2. So 503 − 268 = 235.",
        ],
        illustration: "column-subtraction-zero",
      },
      {
        title: "Addition regroups the other way",
        paragraphs: [
          "When you add, a column can make 10 or more. Write the ones digit of that total in the column. Carry the 1 to the next place to the left, because 10 of a place make 1 of the next. Moving the 1 over like this is called carrying.",
          "A sum, the answer to an addition, can need a carry in two places. In 368 + 457, the ones make 8 + 7 = 15. Write 5 and carry 1 ten.",
          "The tens make 1 + 6 + 5 = 12. Write 2 and carry 1 hundred. The hundreds make 1 + 3 + 4 = 8. The sum is 825.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Trading across places",
        paragraphs: [
          "In our number system, 10 of one place equal 1 of the next place to the left. Adding trades up when a place reaches 10. Subtracting trades down when a place has too few.",
          "Each trade keeps the number the same, even across a zero.",
        ],
      },
    ],
    workedExample: {
      prompt: "What is 600 − 254?",
      steps: [
        "600 has 0 ones and 0 tens, so there are no ones to take 4 from. Regroup 1 hundred as 10 tens.",
        "Then regroup 1 of those tens as 10 ones. 600 is now 5 hundreds, 9 tens and 10 ones.",
        "Subtract each place. Ones: 10 − 4 = 6. Tens: 9 − 5 = 4. Hundreds: 5 − 2 = 3.",
        "So 600 − 254 = 346. Check by adding: 346 + 254 = 600, the number we started with.",
      ],
      answer: "346",
    },
    pitfalls: [
      "A zero has nothing to give. Regroup from the hundreds first, and then the tens can give to the ones.",
      "The place that gives away 1 goes down by 1. The place that gets it goes up by 10.",
    ],
    parentGuide:
      "Ask the learner to say what each new digit means after regrouping. For example: the 9 is 9 tens, left after one ten became 10 ones.",
  },
  {
    id: "whole-add-subtract",
    title: "The standard algorithm for large numbers",
    summary:
      "A whole number is one of 0, 1, 2, 3 and so on. A digit is one of the symbols 0 to 9. Long whole numbers are added and subtracted the same way as short ones. Write one number under the other, with the ones digits lined up. Then each column holds one place: ones, tens, hundreds, thousands and so on. Work on each column from right to left, regrouping when needed.",
    senses: { difference: "difference-subtract" },
    noLink: ["leaves", "line", "mean", "unit", "units"],
    templateIds: ["add-multidigit", "subtract-multidigit"],
    objectives: [
      "Add whole numbers up to 999,999 using columns.",
      "Subtract whole numbers up to 999,999, regrouping across several zeros.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "The columns keep track of size",
        paragraphs: [
          "In a long number, the same digit can stand for very different amounts. In 4,000 the 4 is 4 thousands. In 40,000 it is 4 ten thousands.",
          "So line up the ones digits, one number under the other. Then each column holds one place. You only combine digits that count the same size of group.",
          "When a column makes 10 or more, trade 10 for 1 in the next column to the left. To subtract, trade the other way: 1 from the left becomes 10 in the next column to the right. Trading like this is called regrouping.",
        ],
      },
      {
        title: "One step, any number of places",
        paragraphs: [
          "Look at the picture of 45,072 + 18,396. Small carried 1s sit above the hundreds and the ten thousands. Each place is worth 10 of the place to its right. So the same carry step works in the thousands as in the ones.",
          "Line up the numbers by their ones digit, not their first digit. If one number is shorter, it has nothing to add in its missing places.",
          "These column steps are called the standard algorithm. An algorithm is a list of steps that works for every problem of one kind.",
        ],
        illustration: "column-multidigit",
      },
      {
        title: "Regroup across several zeros",
        paragraphs: [
          "In 40,003 − 12,456, the ones place has 3, and you need to take away 6. The tens, hundreds and thousands are all 0, so none of them can give.",
          "Go left to the first digit that is not 0: the 4 ten thousands. 1 ten thousand is 10 thousands. Keep 9 thousands and pass 1 on as 10 hundreds. Keep 9 hundreds and pass 1 on as 10 tens. Keep 9 tens and pass 1 on as 10 ones. That is why each 0 becomes 9.",
          "40,003 becomes 3 ten thousands, 9 thousands, 9 hundreds, 9 tens and 13 ones. It is the same number, grouped another way. Now subtract each place, and check by adding.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "The place-value algorithm",
        paragraphs: [
          "Every whole number is the sum of what its digits are worth: 40,003 = 40,000 + 3. Adding or subtracting matching places, and regrouping equal amounts, keeps the answer correct.",
          "Lining up the ones digits makes every column hold a single place.",
        ],
      },
    ],
    workedExample: {
      prompt: "What is 40,003 − 12,456?",
      steps: [
        "The ones place has 3, too few to take away 6, and the next three places are 0. Regroup from the 4 ten thousands.",
        "40,003 becomes 3 ten thousands, 9 thousands, 9 hundreds, 9 tens and 13 ones.",
        "Subtract each place. Ones: 13 − 6 = 7. Tens: 9 − 5 = 4. Hundreds: 9 − 4 = 5. Thousands: 9 − 2 = 7. Ten thousands: 3 − 1 = 2.",
        "So 40,003 − 12,456 = 27,547. Check by adding: 27,547 + 12,456 = 40,003.",
      ],
      answer: "27547",
    },
    pitfalls: [
      "Line up numbers of different lengths at the ones digit, not at the left.",
      "When regrouping passes through a 0, it becomes 9, not 10. It gets 10 and then passes 1 on.",
    ],
    parentGuide:
      "Have the learner estimate first: 40,000 − 12,000 is about 28,000. Then compare the exact answer with the estimate.",
  },
];

const terms: MethodTerm[] = ["regroup"];
export const addSubtractMethods: Record<string, ProblemMethod> = {
  "add-two-digit-regroup": {
    goal: "Add two numbers from 10 to 99 and find the sum.",
    intuition:
      "A ten is a group of 10 ones. A digit is one of the symbols 0 to 9. In 47, the right digit is the ones and the left digit is the tens. Add the ones, then the tens. If the ones make 10 or more, swap 10 ones for 1 ten. That swap is called regrouping, and it keeps the total the same.",
    terms,
    noLink: ["changes"],
    method: [
      "Add the ones. If they make 10 or more, write the ones left over and carry 1 ten to the tens.",
      "Add the tens, and include the ten you carried. The answer to adding is the sum.",
    ],
    watch: "Carry the new ten. Do not write two digits for the ones.",
  },
  "make-hundred": {
    goal: "Find the number that joins a number below 100 to make 100.",
    intuition:
      "A box, □, stands for a missing number. To find what makes 100, count up in two moves. First count up to the next ten. Then count by tens to 100. The two moves together are the missing number.",
    senses: { part: "part" },
    method: [
      "Count up from the number to the next ten: 64 to 70 is 6.",
      "Count by tens from there to 100: 80, 90, 100 is 3 tens, or 30.",
      "Add the two moves: 6 + 30 = 36.",
    ],
    watch:
      "Check by adding: the number plus your answer must make exactly 100.",
  },
  "subtract-two-digit-regroup": {
    goal: "Take a number from 10 to 99 away from a number up to 100, and find what is left.",
    intuition:
      "A ten is a group of 10 ones. A digit is one of the symbols 0 to 9. The ones place is the spot on the right, and the tens place is the spot to its left. In 82, the 2 is in the ones place and the 8 is in the tens place. Take ones from ones and tens from tens. If there are not enough ones, trade 1 ten for 10 ones first. This is called regrouping, and the number keeps its value.",
    senses: { difference: "difference-subtract" },
    terms,
    method: [
      "Compare the ones. If the starting number has fewer ones than the number you take away, regroup 1 ten as 10 ones.",
      "Take away the ones, then the tens. If you start from 100, trade its hundred for 10 tens first.",
      "Check: add your answer to the number you took away. You should get the starting number.",
    ],
    watch:
      "In each place, take from the starting number's digit, never the other way. Regroup first if it has too few.",
  },
  "add-three-digit": {
    goal: "Add two three-digit numbers and find the sum.",
    intuition:
      "A ten is 10 ones, and a hundred is 10 tens. A digit's place tells what it counts: ones, tens or hundreds. Add the ones, then the tens, then the hundreds. When a place makes 10 or more, trade 10 of them for 1 of the next place to the left. This is called regrouping, or carrying.",
    senses: { "more than": "more-than" },
    terms,
    method: [
      "Add the ones. If they make 10 or more, write the ones digit and carry 1 ten.",
      "Add the tens and any carried ten. If they make 10 or more, write the ones digit and carry 1 hundred.",
      "Add the hundreds and any carried hundred. 10 hundreds make 1 thousand.",
    ],
    watch: "You may need to carry in two places, so check every column.",
  },
  "subtract-three-digit": {
    goal: "Take one number within 1,000 away from another, and find the difference.",
    intuition:
      "A ten is 10 ones, and a hundred is 10 tens. A digit's place tells what it counts: ones, tens or hundreds. Subtract the ones, then the tens, then the hundreds. If a place has too few, trade 1 from the next place to the left for 10. This is called regrouping. If that next place is 0, trade from the hundreds first.",
    senses: { difference: "difference-subtract" },
    terms,
    method: [
      "Start at the ones and subtract place by place, moving left.",
      "If a place has too few, regroup: take 1 from the next place to the left and add 10 to this place.",
      "If the next place is 0, regroup from the hundreds first. The 0 gets 10, then gives 1 away, so it becomes 9.",
    ],
    watch: "A 0 has nothing to give. Regroup from the place to its left first.",
  },
  "add-multidigit": {
    goal: "Add two whole numbers with up to six digits.",
    intuition:
      "A digit is one of the symbols 0 to 9. Its place, such as ones, tens or hundreds, tells what it is worth. Line up the ones digits, one number under the other, so each column holds one place. Add the columns from right to left. When a column makes 10 or more, write its ones digit and carry 1: move it to the next column and add it there.",
    terms,
    noLink: ["line"],
    method: [
      "Write one number under the other, with the ones digits lined up.",
      "Add each column from the right. When a column makes 10 or more, carry 1 to the next column.",
    ],
    watch: "Line up the numbers at the ones digit, not at the first digit.",
  },
  "subtract-multidigit": {
    goal: "Subtract one whole number from another, each with up to six digits.",
    intuition:
      "A digit is one of the symbols 0 to 9. Its place, such as ones, tens or hundreds, tells what it is worth. Line up the ones digits and subtract each column from right to left. If a column has too few, regroup: take 1 from the column to its left, which is worth 10 here. A 0 has nothing to give, so go left to the first digit that is not 0.",
    senses: { difference: "difference-subtract" },
    noLink: ["leaves", "line"],
    terms,
    method: [
      "Line up the ones digits and subtract from the right.",
      "To regroup across zeros, take 1 from the nearest digit to the left that is not 0. Each 0 you pass becomes 9.",
      "Check by adding your answer to the number you subtracted. You should get the starting number.",
    ],
    watch: "Each 0 passed while regrouping becomes 9, not 10.",
  },
};
export const addSubtractPrinciples: Record<string, string> = {
  "add-two-digit-regroup":
    "10 ones are worth 1 ten. So regrouping 10 ones as 1 ten gives new digits but the same sum.",
  "make-hundred":
    "Adding in two moves gives the same total: 36 + 64 = 36 + 4 + 60. So the missing number is the two moves added together.",
  "subtract-two-digit-regroup":
    "1 ten is worth 10 ones, so 82 = 70 + 12. Then you can take away ones from ones and tens from tens.",
  "add-three-digit":
    "Add place by place. Regroup 10 of one place as 1 of the next place to the left.",
  "subtract-three-digit":
    "Regrouping rewrites a number without changing it: 503 = 400 + 90 + 13.",
  "add-multidigit":
    "Each place is worth 10 of the place to its right, so the same column step works in every place.",
  "subtract-multidigit":
    "One of a place is 10 of the next place to the right. So regrouping across zeros leaves 9 in each zero place: $1{,}000 = 900 + 90 + 10$.",
};
