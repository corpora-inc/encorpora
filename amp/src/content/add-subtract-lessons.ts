import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

export const addSubtractLessons: Lesson[] = [
  {
    id: "add-within-100",
    title: "Add within 100 by place",
    summary:
      "Put ones with ones and tens with tens. If the ones make a new ten, trade it before adding the tens.",
    templateIds: ["add-two-digit-regroup", "make-hundred"],
    objectives: [
      "Add two two-digit numbers, regrouping ten ones as a ten.",
      "Find the number that makes 100 by completing a ten, then counting tens.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "The amount stays the same when you trade",
        paragraphs: [
          "A two-digit number has tens and ones. In 47, there are 4 tens and 7 ones. Put the ones from both numbers together. When you have 10 ones, you can trade them for 1 ten without changing the total.",
          "That trade lets every place hold fewer than 10 pieces. In 47 + 38, the 7 ones and 8 ones make 15 ones: 1 new ten and 5 ones. Add that new ten to the 4 tens and 3 tens to get 8 tens, so the sum is 85.",
        ],
      },
      {
        stage: "method",
        title: "Add each place",
        paragraphs: [
          "Start at the ones. Add them, write the ones left after any trade, and carry the new ten. Then add the tens, including the ten you carried.",
          "You can check by counting on from one addend by the tens and then the ones of the other. For 47 + 38, count 47, 77, 85.",
        ],
        illustration: "column-addition",
      },
      {
        stage: "method",
        title: "Make one hundred",
        paragraphs: [
          "To find what joins 36 to make 100, first complete the ten: 36 + 4 = 40. Then count tens: 40 + 60 = 100.",
          "The missing number is both jumps together: 4 + 60 = 64. Check by adding: 36 + 64 = 100.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Place value and regrouping",
        paragraphs: [
          "In base ten, each ten has the same value as 10 ones. Replacing 10 ones with 1 ten preserves the sum. Add digits in the same place and carry a complete group of ten into the next place.",
          "To complete a number to 100, split the missing amount into the jump to the next ten and the jump from there to 100; adding those jumps gives the full difference.",
        ],
      },
    ],
    workedExample: {
      prompt: "What is 58 + 26?",
      steps: [
        "Ones: 8 + 6 = 14. Write 4 and carry 1 ten.",
        "Tens: 5 + 2 + 1 = 8.",
        "58 + 26 = 84.",
      ],
      answer: "84",
    },
    pitfalls: [
      "When the ones make 10 or more, write only the ones left and carry the new ten.",
      "Include the carried ten when you add the tens.",
    ],
    parentGuide:
      "Use dimes and pennies. Add two amounts, and trade ten pennies for a dime whenever you can. Say what the trade does to the total (nothing).",
  },
  {
    id: "subtract-within-100",
    title: "Subtract within 100 by regrouping a ten",
    summary:
      "When the ones are too few to subtract, break one ten into ten ones. The starting amount stays the same.",
    templateIds: ["subtract-two-digit-regroup"],
    objectives: [
      "Subtract a two-digit number from a number up to 100.",
      "Explain why trading 1 ten for 10 ones does not change a number.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Trade without changing the amount",
        paragraphs: [
          "Suppose you have 82 and need to take away 47. You can take away 4 tens, but 2 ones are not enough to take away 7 ones. Break one of the 8 tens into 10 ones. You still have 82, now arranged as 7 tens and 12 ones, so each place has enough to subtract.",
        ],
      },
      {
        title: "Trade before you take",
        paragraphs: [
          "In 82 − 47 you cannot take 7 ones from 2 ones. Trade 1 of the 8 tens for 10 ones: 82 is also 7 tens and 12 ones.",
          "Now take away place by place: 12 − 7 = 5 ones and 7 − 4 = 3 tens. 82 − 47 = 35.",
        ],
        illustration: "base-ten-trade",
      },
      {
        title: "Check with addition",
        paragraphs: [
          "Subtraction finds a missing part. Adding the part you took away back to the answer must give the starting number: 35 + 47 = 82.",
          "When the starting number is 100, it has no tens to trade. Trade 1 hundred for 10 tens first, then 1 ten for 10 ones: 100 is 9 tens and 10 ones.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Trading a ten",
        paragraphs: [
          "One ten has the same value as 10 ones. Trading one ten for 10 ones leaves the starting number unchanged, so the ones and tens can then be subtracted in matching places. Addition checks the difference: difference plus amount removed equals the starting number.",
        ],
      },
    ],
    workedExample: {
      prompt: "What is 70 − 26?",
      steps: [
        "0 ones is less than 6 ones, so regroup 1 ten: 70 is 6 tens and 10 ones.",
        "Ones: 10 − 6 = 4. Tens: 6 − 2 = 4.",
        "70 − 26 = 44. Check: 44 + 26 = 70.",
      ],
      answer: "44",
    },
    pitfalls: [
      "Subtracting the smaller digit from the larger in each place: 82 − 47 is not 45.",
      "Regrouping a ten without lowering the tens by 1.",
    ],
    parentGuide:
      "Make 82 with dimes and pennies and ask for 47 cents. Let the learner discover the need to trade a dime for ten pennies.",
  },
  {
    id: "add-subtract-thousands",
    title: "Add and subtract within 1000",
    summary:
      "Big numbers use the same trades as smaller ones: ten of one place equal one of the next.",
    templateIds: ["add-three-digit", "subtract-three-digit"],
    objectives: [
      "Add three-digit numbers with regrouping in any place.",
      "Subtract three-digit numbers, regrouping across a zero.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "A zero means a place has no pieces to trade",
        paragraphs: [
          "To take 268 from 503, you need more ones than the 3 you can see. There are no tens to break apart, but one hundred can become 10 tens. Then one of those tens can become 10 ones. The amount is still 503; only the grouping has changed.",
        ],
      },
      {
        title: "Regroup across a zero",
        paragraphs: [
          "In 503 − 268 the ones need a ten, but there are 0 tens. Regroup 1 hundred as 10 tens first, then 1 of those tens as 10 ones.",
          "503 becomes 4 hundreds, 9 tens and 13 ones, the same number written differently. Then subtract each place: 13 − 8 = 5, 9 − 6 = 3, 4 − 2 = 2.",
        ],
        illustration: "column-subtraction-zero",
      },
      {
        title: "Addition regroups the other way",
        paragraphs: [
          "When a column sums to 10 or more, keep the ones digit of that sum and carry 1 to the next place: 10 tens make 1 hundred.",
          "A sum can carry in more than one place: 368 + 457 carries from the ones and from the tens, giving 825.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Trading across places",
        paragraphs: [
          "In base ten, 10 of one place equal 1 of the next. Addition trades upward when a place reaches 10; subtraction trades downward when a place has too few. These trades preserve the number, including across a zero.",
        ],
      },
    ],
    workedExample: {
      prompt: "What is 600 − 254?",
      steps: [
        "Regroup 1 hundred as 10 tens, then 1 ten as 10 ones: 5 hundreds, 9 tens, 10 ones.",
        "Ones: 10 − 4 = 6. Tens: 9 − 5 = 4. Hundreds: 5 − 2 = 3.",
        "600 − 254 = 346. Check: 346 + 254 = 600.",
      ],
      answer: "346",
    },
    pitfalls: [
      "Skipping over a zero: the hundreds must be regrouped before the tens can lend.",
      "Forgetting that a regrouped place is now one less.",
    ],
    parentGuide:
      "Ask the learner to say what each regrouped digit means, for example: the 9 is 9 tens left after one ten became ones.",
  },
  {
    id: "whole-add-subtract",
    title: "The standard algorithm for large numbers",
    summary:
      "Line up matching places so each column combines the same-sized units, even in a long number.",
    templateIds: ["add-multidigit", "subtract-multidigit"],
    objectives: [
      "Add whole numbers up to 999,999 with the standard algorithm.",
      "Subtract whole numbers up to 999,999, regrouping across several zeros.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "The columns keep track of size",
        paragraphs: [
          "In a large number, a 4 might mean four ones, four thousands, or four ten thousands. Line up the ones places so each column holds the same-sized units. When needed, trade ten units in one place for one unit in the next place left, or reverse that trade to subtract.",
        ],
      },
      {
        title: "One step, any number of places",
        paragraphs: [
          "Every place is worth ten of the place to its right, so the same carry and regroup steps work in the thousands as in the ones.",
          "Line up the numbers by their ones digit, not their first digit. A shorter number has nothing to add in its missing places.",
        ],
        illustration: "column-multidigit",
      },
      {
        title: "Regroup across several zeros",
        paragraphs: [
          "In 40,003 − 12,456 the ones need a ten, and the tens, hundreds and thousands are all 0. Take 1 ten thousand; each zero it passes becomes 9, and the ones get 10.",
          "40,003 becomes 3 ten thousands, 9 thousands, 9 hundreds, 9 tens and 13 ones. Then subtract each place and check by adding.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "The place-value algorithm",
        paragraphs: [
          "Whole numbers can be written as sums of their place values. Adding or subtracting matching places and regrouping equal values preserves the result. Align the ones places so every column represents one common unit.",
        ],
      },
    ],
    workedExample: {
      prompt: "What is 40,003 − 12,456?",
      steps: [
        "Regroup across the zeros: 3 ten thousands, 9 thousands, 9 hundreds, 9 tens, 13 ones.",
        "Ones: 13 − 6 = 7. Tens: 9 − 5 = 4. Hundreds: 9 − 4 = 5. Thousands: 9 − 2 = 7. Ten thousands: 3 − 1 = 2.",
        "40,003 − 12,456 = 27,547. Check: 27,547 + 12,456 = 40,003.",
      ],
      answer: "27547",
    },
    pitfalls: [
      "Aligning numbers of different lengths at the left instead of at the ones.",
      "Turning zeros into 10 instead of 9 when regrouping passes through them.",
    ],
    parentGuide:
      "Have the learner estimate first (40,000 − 12,000 is about 28,000), then compare the exact answer with the estimate.",
  },
];

const terms: [string, string][] = [
  ["Regroup", "Trade 10 of one place for 1 of the next, or the reverse."],
];
export const addSubtractMethods: Record<string, ProblemMethod> = {
  "add-two-digit-regroup": {
    goal: "Given two two-digit numbers, find their sum.",
    intuition:
      "Put together the ones and the tens separately. Every 10 ones can be traded for 1 ten without changing the total.",
    terms,
    method: [
      "Add the ones. If there are 10 or more, write the ones left and carry 1 ten.",
      "Add the tens, including any carried ten.",
    ],
    watch: "Carry the ten; do not write two digits in the ones place.",
  },
  "make-hundred": {
    goal: "Given a two-digit number, find what joins it to make 100.",
    method: [
      "Count up from the number to the next ten: 64 to 70 is 6.",
      "Count by tens from there to 100: 70 to 100 is 30.",
      "Add the two jumps: 6 + 30 = 36.",
    ],
    watch: "Check: the number plus your answer must be exactly 100.",
  },
  "subtract-two-digit-regroup": {
    goal: "Given a number up to 100 and a two-digit number, find their difference.",
    terms,
    method: [
      "If the top ones are fewer than the bottom ones, regroup 1 ten as 10 ones.",
      "Subtract the ones, then the tens.",
      "Check by adding the answer to the number taken away.",
    ],
    watch: "Do not subtract the smaller digit from the larger one in a place.",
  },
  "add-three-digit": {
    goal: "Given two three-digit numbers, find their sum.",
    terms,
    method: [
      "Add the ones; carry 1 ten if the sum is 10 or more.",
      "Add the tens with any carry; carry 1 hundred if needed.",
      "Add the hundreds with any carry.",
    ],
    watch: "A carry can happen in more than one place.",
  },
  "subtract-three-digit": {
    goal: "Given two numbers within 1000, find their difference.",
    terms,
    method: [
      "Subtract place by place from the ones.",
      "If a place is too small, regroup 1 from the next place.",
      "If the next place is 0, regroup from the place after it first; the 0 becomes 9.",
    ],
    watch: "A zero cannot lend; regroup the place to its left first.",
  },
  "add-multidigit": {
    goal: "Given two whole numbers of up to six digits, find their sum.",
    terms,
    method: [
      "Line up the ones digits.",
      "Add each column from the right, carrying 1 when a column reaches 10.",
    ],
    watch: "Align at the ones, not at the first digit.",
  },
  "subtract-multidigit": {
    goal: "Given two whole numbers of up to six digits, find their difference.",
    terms,
    method: [
      "Line up the ones digits and subtract from the right.",
      "To regroup across zeros, take 1 from the nearest nonzero place; each zero passed becomes 9.",
      "Check by adding the difference to the number subtracted.",
    ],
    watch: "Zeros passed while regrouping become 9, not 10.",
  },
};
export const addSubtractPrinciples: Record<string, string> = {
  "add-two-digit-regroup":
    "Place value: ten ones equal one ten, so regrouping changes the digits but not the sum.",
  "make-hundred":
    "Addition is associative: 36 + 64 = 36 + 4 + 60, so the missing part is the sum of the jumps.",
  "subtract-two-digit-regroup":
    "1 ten equals 10 ones, so 82 = 70 + 12; subtraction is then done place by place.",
  "add-three-digit":
    "The standard algorithm adds place by place, regrouping 10 of one place as 1 of the next.",
  "subtract-three-digit":
    "Regrouping rewrites a number without changing it: 503 = 400 + 90 + 13.",
  "add-multidigit":
    "Each place is worth ten of the place to its right, so one column step works at every place.",
  "subtract-multidigit":
    "One of a place is 10 of the next lower place, so regrouping across zeros leaves 9 in each zero place: $1{,}000 = 900 + 90 + 10$.",
};
