import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

export const numberSenseLessons: Lesson[] = [
  {
    id: "count-to-100",
    title: "Count to 100 by ones and tens",
    summary:
      "Counting by ones means each number is 1 more than the one before, so you add 1 each time: 57, 58, 59, 60. Counting by tens means each number is 10 more: 20, 30, 40. A hundred chart shows the numbers 1 to 100 in rows of 10. It helps you find a missing number.",
    templateIds: ["count-sequence-missing", "hundred-chart-missing"],
    senses: { "more than": "more-than" },
    noLink: ["square", "squares"],
    objectives: [
      "Continue counts by ones and by tens within 100, including across a ten.",
      "Use the rows and columns of the hundred chart to find a missing number.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Keep counting through a new ten",
        paragraphs: [
          "A one is a single thing, like one counter. A ten is a group of 10 ones. A digit is one of the symbols 0 to 9 we use to write numbers. The number 68 has two digits. The 6 means 6 tens, or 60. The 8 means 8 ones, 8 single things.",
          "Start at 68 and count one more: 69. That is 6 tens and 9 ones. One more one makes 10 ones. Ten ones make a new ten.",
          "So after 69 comes 70: 7 tens and 0 ones. The box □ in a count stands for a missing number. The sign + means add, or put more with. The sign = means makes, or is the same as. So 58 + 1 = 59 says 58 and 1 more make 59.",
        ],
      },
      {
        title: "Ones, then a new ten",
        paragraphs: [
          "In 64, the tens digit, 6, tells how many tens. The ones digit, 4, tells how many ones. Count by ones: 64, 65, 66. The ones digit goes up by 1 each time.",
          "After a 9 in the ones, the ones digit goes back to 0, and there is one more ten: 68, 69, 70, 71.",
          "Count by tens: 20, 30, 40, 50. Each number is one more ten, so the tens digit goes up by 1. The ones digit stays the same: 23, 33, 43.",
          "Keep counting by tens: 70, 80, 90, 100. After 9 tens, one more ten makes 10 tens. Ten tens make one hundred, written 100.",
        ],
      },
      {
        title: "Read the chart both ways",
        paragraphs: [
          "Look at the hundred chart in the picture. Each row goes across and holds 10 numbers. Moving one square to the right adds 1: 62, then 63. Moving one row down adds 10: 62, then 72.",
          "To find a missing number, take the square on its left and add 1. Or take the square above it and add 10. If the empty square starts a row, use the square above it. Both ways give the same number, so you can use one to check the other.",
        ],
        illustration: "hundred-chart-moves",
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Counting and place value",
        paragraphs: [
          "Counting by ones adds 1 at each step. Counting by tens adds 10 at each step. Ten ones make one ten. So when the ones digit passes 9, it goes back to 0 and there is one more ten. Ten tens make one hundred, so 99 and 1 more is 100.",
        ],
      },
    ],
    workedExample: {
      prompt: "Count by ones: 57, 58, □, 60. What number is missing?",
      steps: [
        "Counting by ones means each number is 1 more than the one before.",
        "The number just before the box is 58. One more is 58 + 1 = 59.",
        "Check with the number after the box: 59 + 1 = 60. It fits, so 59 is right.",
      ],
      answer: "59",
    },
    pitfalls: [
      "After 69 comes 70, not 610. The 9 ones and 1 more one make a new ten.",
      "On the hundred chart, moving down one row adds 10, not 1.",
    ],
    parentGuide:
      "Choose a number on a hundred chart. Ask for the number just below it and the number just to its right. Ask how the two moves are different.",
  },
  {
    id: "write-numerals",
    title: "Write the number for a quantity",
    summary:
      "A numeral is a number written with symbols, such as 7 or 16. A ten-frame is a box with 10 spaces, in 2 rows of 5. Counters are small round chips, one in each filled space. A full ten-frame holds 10 counters, so you do not need to count them one by one. Say 10, then keep counting from 10 for the rest, and write the number.",
    templateIds: ["numeral-for-quantity"],
    noLink: ["parts"],
    objectives: [
      "Write numerals from 0 to 20 for quantities shown in ten-frames.",
      "Use a full frame as 10 and count on for the rest.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "A picture can show tens and ones",
        paragraphs: [
          "Ten counters fill one ten-frame. A group of 10 is called a ten. A single counter is called a one. Say you have one full frame and 6 more counters. That is 1 ten and 6 ones.",
          "To count them, say 10 for the full frame. Then count on: keep counting from 10 for each extra counter, 11, 12, 13, 14, 15, 16.",
          "We write that number as 16. The 1 stands for the full ten. The 6 stands for the 6 extra ones.",
        ],
      },
      {
        title: "Use the frame",
        paragraphs: [
          "A ten-frame has 2 rows of 5 spaces. A full row is 5, and a full frame is 10. So you can count by rows instead of one counter at a time.",
          "Look at the picture. One frame is full, so say 10. The other frame has 4 counters, so count on from 10: 11, 12, 13, 14.",
          "We write 14. It means 1 ten and 4 ones.",
        ],
        illustration: "teen-ten-frame",
      },
      {
        title: "Zero and twenty",
        paragraphs: [
          "An empty frame has no counters. The number is 0, called zero.",
          "Two full frames are 2 tens. The number is 20, called twenty.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "How a numeral shows tens and ones",
        paragraphs: [
          "A digit is one of the symbols 0 to 9 used to write numbers. The numbers 11 to 19 are called teen numbers. In a teen number, the first digit is 1, and it stands for one ten. The second digit tells how many more ones there are. So 14 means 10 and 4 more.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "One frame is full. The other frame has 4 counters. Write the number.",
      steps: [
        "A full ten-frame always holds 10 counters. So the full frame is 10, and you do not need to count it.",
        "Start at 10 and count on the 4 other counters: 11, 12, 13, 14.",
        "Write 14. The 1 means one ten, and the 4 means 4 ones.",
      ],
      answer: "14",
    },
    pitfalls: [
      "Write the 1 for the ten first, then the ones. Fourteen is 14, not 41.",
      "A full frame is always 10. You do not need to count it again.",
    ],
    parentGuide:
      "Put 13 coins in an egg carton with 10 cups. Ask how many coins there are without counting each one. Then ask the learner to write the number.",
  },
  {
    id: "number-line-moves",
    title: "Add and subtract with hops",
    summary:
      "Adding moves right on a number line, and subtracting moves left by the amount named.",
    templateIds: ["number-line-hops", "number-line-missing-hop"],
    objectives: [
      "Add or subtract within 100 by hopping tens, then ones, on a number line.",
      "Find the difference of two numbers as the length of the hop between them.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "A move has direction and length",
        paragraphs: [
          "A number line places numbers in order with equal spaces. A move right reaches a larger number and a move left reaches a smaller one. A long move can be made as two shorter moves.",
        ],
      },
      {
        title: "Hop the tens, then the ones",
        paragraphs: [
          "On a number line every unit has the same length. A hop to the right adds; a hop to the left subtracts.",
          "To find 46 − 23, hop back 20 to 26, then back 3 to 23. Two short hops replace one long count.",
        ],
        illustration: "number-line-hop-pair",
      },
      {
        title: "A difference is a distance",
        paragraphs: [
          "The hop from 38 to 65 has the same length as 65 − 38. Count up from 38: 2 to 40, 20 to 60, 5 to 65.",
          "The pieces add to the hop: 2 + 20 + 5 = 27.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Number-line distance and direction",
        paragraphs: [
          "On a number line with equal unit intervals, adding a positive amount moves right by that distance and subtracting it moves left. A move of tens and ones may be split into consecutive moves whose distances add to the original distance.",
        ],
      },
    ],
    workedExample: {
      prompt: "Start at 46. Hop back 20, then back 3. Where do you land?",
      steps: ["46 − 20 = 26.", "26 − 3 = 23."],
      answer: "23",
    },
    pitfalls: [
      "Counting the starting number as the first step of a hop.",
      "Hopping right when the problem subtracts.",
    ],
    parentGuide:
      "Draw a line with tens marked. Ask the learner to show 34 + 25 as one hop of 20 and one hop of 5, saying where each hop lands.",
  },
  {
    id: "rounding",
    title: "Round to the nearest ten, hundred or thousand",
    summary:
      "Rounding replaces a number with the nearest multiple of a chosen place value.",
    templateIds: ["round-to-ten", "round-to-hundred", "round-large"],
    objectives: [
      "Round whole numbers to the nearest ten or hundred.",
      "Round larger numbers to the nearest hundred, thousand or ten thousand.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Choose the nearer landmark",
        paragraphs: [
          "To round 347 to the nearest ten, look at its neighboring tens, 340 and 350. It is three away from 350 and seven away from 340, so 350 is the nearer landmark.",
        ],
      },
      {
        title: "Between two multiples",
        paragraphs: [
          "347 is between 340 and 350. Halfway is 345. 347 is past halfway, so it rounds to 350.",
          "Only the digit just right of the rounding place matters: 5 or more rounds up, 4 or less rounds down.",
        ],
        illustration: "rounding-halfway",
      },
      {
        title: "Crossing and halfway",
        paragraphs: [
          "Rounding up can change more than one digit: 396 rounds to 400 and 49,700 rounds to 50,000 to the nearest thousand.",
          "Do not round in steps. 449 is less than halfway between 400 and 500, so it rounds to 400, even though 449 rounds to 450 to the nearest ten.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Nearest multiple",
        paragraphs: [
          "To round a number to a chosen place, compare its distance from the two neighboring multiples of that place value. Choose the nearer multiple; under the usual whole-number convention, choose the greater one when exactly halfway.",
        ],
      },
    ],
    workedExample: {
      prompt: "Round 46,382 to the nearest thousand.",
      steps: [
        "46,382 is between 46,000 and 47,000; halfway is 46,500.",
        "46,382 is before halfway, so it rounds down.",
      ],
      answer: "46000",
    },
    pitfalls: [
      "Rounding twice: 449 to 450, then to 500.",
      "Forgetting the carry: 396 to the nearest ten is 400, not 390.",
    ],
    parentGuide:
      "Name a price such as $3.47 and ask which whole ten cents it is closer to. Then try one exactly halfway.",
  },
  {
    id: "powers-of-ten",
    title: "Multiply and divide by powers of ten",
    summary:
      "Each place to the left is worth ten times as much as the place beside it.",
    templateIds: [
      "multiply-power-of-ten",
      "divide-power-of-ten",
      "digit-value-ratio",
    ],
    objectives: [
      "Multiply and divide whole numbers and decimals by 10, 100 and 1,000.",
      "Explain how the same digit's value changes from one place to another.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Make every place ten times larger",
        paragraphs: [
          "The 7 in 47 counts seven ones. In 470 it counts seven tens, a value ten times larger. Multiplying by ten moves every digit into the place worth ten times as much.",
        ],
      },
      {
        title: "Digits move, the point stays",
        paragraphs: [
          "47 × 10 = 470: the 4 tens become 4 hundreds and the 7 ones become 7 tens. Every digit moves one place left; a zero fills the ones place.",
          "Dividing by 10 moves every digit one place right: 52 ÷ 100 = 0.52. 10² means 10 × 10 = 100, so ×10² moves digits two places.",
        ],
        illustration: "power-of-ten-shift",
      },
      {
        title: "The same digit in two places",
        paragraphs: [
          "In 7,370 the first 7 is worth 7,000 and the second is worth 70. They are two places apart, so the first is 10 × 10 = 100 times as much.",
          "Moving one place left multiplies a digit's value by 10; moving one place right divides it by 10.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Each place is ten times larger",
        paragraphs: [
          "Moving a digit one place left multiplies its value by 10; moving it one place right divides its value by 10. Multiplying an entire whole number by a power of ten applies that change to every digit, with zero placeholders where needed.",
        ],
      },
    ],
    workedExample: {
      prompt: "What is 3.6 × 100?",
      steps: [
        "100 = 10 × 10, so every digit moves two places left.",
        "3 ones become 3 hundreds and 6 tenths become 6 tens: 360.",
      ],
      answer: "360",
    },
    pitfalls: [
      "Adding zeros to a decimal: 3.6 × 100 is 360, not 3.600.",
      "Moving digits the wrong way when dividing.",
    ],
    parentGuide:
      "Ask how many dimes are in $4.70 and how many pennies. Connect each answer to moving the digits one place.",
  },
];

export const numberSenseMethods: Record<string, ProblemMethod> = {
  "count-sequence-missing": {
    goal: "Find the missing number in a count by ones or by tens.",
    intuition:
      "Counting by ones means each number is 1 more than the one before: 18, 19, 20. Counting by tens means each number is 10 more: 20, 30, 40. The box □ stands for the missing number. The step is how much each number grows: 1 or 10. The sign + means add, or put more with. The sign = means makes, or is the same as. So 19 + 1 = 20 says 19 and 1 more make 20.",
    method: [
      "Find the step. It is 1 when you count by ones and 10 when you count by tens.",
      "Add the step to the number just before the box.",
      "If a number comes after the box, add the step again. You should land on that number.",
    ],
    watch:
      "After 9 ones, one more one makes a new ten, a group of 10. So after 69 comes 70, not 610.",
  },
  "hundred-chart-missing": {
    goal: "Find the number that belongs in an empty square of the hundred chart.",
    intuition:
      "A hundred chart shows the numbers 1 to 100 in order, in rows of 10. Each row goes across, from left to right. One square to the right is 1 more. One row down is 10 more, because each row holds 10 numbers. A picture may show only part of the chart, but it works the same way. To add 1 means to find the number 1 more.",
    noLink: ["part", "square", "squares"],
    method: [
      "Find a filled square next to the empty one: just to its left, or just above it.",
      "From the square on its left, add 1. From the square above it, add 10.",
      "If the empty square has both, use the other one to check.",
    ],
    watch: "Moving down one row adds 10, not 1.",
  },
  "numeral-for-quantity": {
    goal: "Count the counters shown in ten-frames and write how many there are.",
    intuition:
      "A ten-frame is a box with 10 spaces, in 2 rows of 5. Counters are small round chips, one in each filled space. A full row holds 5 counters, and a full frame holds 10. Use those to count fast, then write the number. The sign + means add, or put more with. The sign = means makes, or is the same as.",
    terms: ["ten-frame"],
    method: [
      "A full frame is 10 and a full row is 5. You do not need to count them one by one.",
      "For the rest, count on: start at 10 or 5 and keep counting each extra counter.",
      "Write the number. A teen number, from 11 to 19, is 1 ten and some ones: 14 is 1 ten, a full frame, and 4 ones.",
    ],
    watch: "Fourteen is written 14, not 41. The 1 stands for the full ten.",
  },
  "number-line-hops": {
    goal: "Given a start and a tens hop then an ones hop, find where they land.",
    method: [
      "Start at the first number; do not count it as a step.",
      "Hop the tens: the tens digit goes up or down, the ones digit stays.",
      "Hop the ones from there, one tick at a time.",
    ],
    watch: "Back means subtract; the tens hop changes only the tens digit.",
  },
  "number-line-missing-hop": {
    goal: "Given the two ends of a hop, find its length.",
    method: [
      "Count up from the smaller number to the next ten.",
      "Count tens to the last ten, then the remaining ones.",
      "Add the pieces.",
    ],
    watch: "The length is the same whichever way the hop points.",
  },
  "round-to-ten": {
    goal: "Given a whole number, round it to the nearest ten.",
    method: [
      "Name the two tens it is between.",
      "Ones digit 5 or more: round up. 4 or less: round down.",
    ],
    watch: "Rounding up can change the hundreds: 396 rounds to 400.",
  },
  "round-to-hundred": {
    goal: "Given a three-digit number, round it to the nearest hundred.",
    method: [
      "Name the two hundreds it is between.",
      "Tens digit 5 or more: round up. 4 or less: round down.",
    ],
    watch: "Look only at the tens digit: 449 rounds to 400.",
  },
  "round-large": {
    goal: "Given a large whole number, round it to the named place.",
    method: [
      "Find the rounding place and the two multiples around the number.",
      "Look at the digit one place to the right: 5 or more rounds up.",
      "Replace every digit right of the rounding place with 0.",
    ],
    watch:
      "A 9 that rounds up carries: 49,700 to the nearest thousand is 50,000.",
  },
  "multiply-power-of-ten": {
    goal: "Given a number times 10, 100 or 1,000, find the product.",
    terms: ["power-of-10"],
    method: [
      "Count the factors of 10: 10 is one, 100 is two, 1,000 is three.",
      "Move every digit that many places left; fill empty places with 0.",
    ],
    watch: "A decimal's digits move too: 3.6 × 100 = 360.",
  },
  "divide-power-of-ten": {
    goal: "Given a whole number divided by 10, 100 or 1,000, find the quotient.",
    terms: ["power-of-10"],
    method: [
      "Count the factors of 10.",
      "Move every digit that many places right; digits past the ones become tenths, hundredths, thousandths.",
    ],
    watch: "Drop trailing zeros after the decimal point: 520 ÷ 100 = 5.2.",
  },
  "digit-value-ratio": {
    goal: "Given a number with one digit in two places, compare the two values.",
    method: [
      "Name the place of each copy of the digit.",
      "Each place left multiplies the value by 10.",
    ],
    watch: "Two places apart is 100 times, not 20 times.",
  },
};

export const numberSensePrinciples: Record<string, string> = {
  "count-sequence-missing":
    "In a count by ones, each number is 1 more than the one before. In a count by tens, each number is 10 more. Ten ones make one ten.",
  "hundred-chart-missing":
    "The hundred chart has rows of 10. So one square to the right is 1 more, and one row down is 10 more.",
  "numeral-for-quantity":
    "A numeral is a written number that tells how many. A teen number, from 11 to 19, is one ten and some more ones: 14 is 10 and 4.",
  "number-line-hops":
    "Adding moves right and subtracting moves left by equal units; a hop can be split into tens and ones.",
  "number-line-missing-hop":
    "The difference of two numbers is the distance between them on a number line.",
  "round-to-ten":
    "A number rounds to the nearer multiple of ten; exactly halfway rounds up.",
  "round-to-hundred":
    "A number rounds to the nearer multiple of a hundred, decided by the tens digit alone.",
  "round-large":
    "Rounding to a place compares the number with the halfway point between the two multiples of that place.",
  "multiply-power-of-ten":
    "Multiplying by 10 makes every digit worth ten times as much, moving it one place left.",
  "divide-power-of-ten":
    "Dividing by 10 makes every digit worth one tenth as much, moving it one place right.",
  "digit-value-ratio":
    "A digit is worth 10 times as much as the same digit one place to its right.",
};
