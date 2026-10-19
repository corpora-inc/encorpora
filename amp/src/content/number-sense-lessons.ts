import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

export const numberSenseLessons: Lesson[] = [
  {
    id: "count-to-100",
    title: "Count to 100 by ones and tens",
    summary:
      "Each count by ones adds 1; each count by tens adds 1 ten. On the hundred chart, right is +1 and down is +10.",
    templateIds: ["count-sequence-missing", "hundred-chart-missing"],
    objectives: [
      "Continue counts by ones and by tens within 100, including across a ten.",
      "Use the rows and columns of the hundred chart to find a missing number.",
    ],
    sections: [
      {
        title: "Ones, then a new ten",
        paragraphs: [
          "Counting by ones, the ones digit goes 0 to 9. After 9 ones, the next count makes a new ten: 68, 69, 70, 71.",
          "Counting by tens, the tens digit goes up by one each time and the ones digit stays the same: 20, 30, 40, 50.",
        ],
        illustration: "hundred-chart-moves",
      },
      {
        title: "Read the chart both ways",
        paragraphs: [
          "Each row of the hundred chart holds ten numbers. Moving one square right adds 1; moving one row down adds 10.",
          "A missing square can be found from the square before it or the square above it. Both ways give the same number.",
        ],
      },
    ],
    workedExample: {
      prompt: "Count by ones: 57, 58, □, 60. What number is missing?",
      steps: ["Each count is 1 more.", "58 + 1 = 59. Check: 59 + 1 = 60."],
      answer: "59",
    },
    pitfalls: [
      "Writing 610 after 69 instead of starting the next ten, 70.",
      "Adding 1 when moving down a row of the hundred chart; down adds 10.",
    ],
    parentGuide:
      "Point to a number on a hundred chart and ask for the number below it and the number to its right. Ask how the two moves differ.",
  },
  {
    id: "write-numerals",
    title: "Write the number for a quantity",
    summary:
      "Count the counters and write the numeral; a full ten-frame is 10, and teen numbers are 1 ten and some ones.",
    templateIds: ["numeral-for-quantity"],
    objectives: [
      "Write numerals from 0 to 20 for quantities shown in ten-frames.",
      "Use a full frame as 10 and count on for the rest.",
    ],
    sections: [
      {
        title: "Use the frame",
        paragraphs: [
          "A ten-frame has two rows of 5. A full row is 5 and a full frame is 10, so there is no need to count every counter.",
          "For more than 10, the second frame holds the extra ones: a full frame and 4 more is 14, written 1 ten and 4 ones.",
        ],
        illustration: "teen-ten-frame",
      },
      {
        title: "Zero and twenty",
        paragraphs: [
          "An empty frame shows no counters: the number is 0.",
          "Two full frames are 2 tens: the number is 20.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "One frame is full. The other frame has 4 counters. Write the number.",
      steps: ["The full frame is 10.", "10 and 4 more is 14."],
      answer: "14",
    },
    pitfalls: [
      "Writing teen numbers backwards, such as 41 for fourteen.",
      "Recounting a full frame instead of using 10.",
    ],
    parentGuide:
      "Put 13 coins in an egg carton with ten cups. Ask how many without counting each coin, then ask the learner to write the number.",
  },
  {
    id: "number-line-moves",
    title: "Add and subtract with hops",
    summary:
      "Adding is a hop right and subtracting is a hop left; split a two-digit hop into tens and ones.",
    templateIds: ["number-line-hops", "number-line-missing-hop"],
    objectives: [
      "Add or subtract within 100 by hopping tens, then ones, on a number line.",
      "Find the difference of two numbers as the length of the hop between them.",
    ],
    sections: [
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
      "A number rounds to the nearer of the two multiples around it; exactly halfway rounds up.",
    templateIds: ["round-to-ten", "round-to-hundred", "round-large"],
    objectives: [
      "Round whole numbers to the nearest ten or hundred.",
      "Round larger numbers to the nearest hundred, thousand or ten thousand.",
    ],
    sections: [
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
      "Each place is worth 10 times the place to its right, so multiplying by 10 moves every digit one place left.",
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
    goal: "Given a count by ones or tens with one number missing, find it.",
    method: [
      "Find the step: 1 for ones, 10 for tens.",
      "Add the step to the number before the gap.",
      "Check that the next number follows.",
    ],
    watch: "After 9 ones, the count starts a new ten: 69, 70.",
  },
  "hundred-chart-missing": {
    goal: "Given part of the hundred chart with an empty square, find its number.",
    method: [
      "From the square on its left, add 1.",
      "Or from the square above it, add 10.",
    ],
    watch: "Down a row is 10 more, not 1 more.",
  },
  "numeral-for-quantity": {
    goal: "Given counters in ten-frames, write how many there are.",
    method: [
      "A full frame is 10; a full row is 5.",
      "Count on from 10 (or 5) for the rest.",
      "Write the number: teen numbers are 1 ten and some ones.",
    ],
    watch: "Fourteen is written 14: the 1 is the full ten.",
  },
  "number-line-hops": {
    goal: "Given a start and a tens hop then an ones hop, find where they land.",
    method: [
      "Hop the tens: add or subtract the tens.",
      "Hop the ones from there.",
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
    terms: [["10², 10³", "10 × 10 = 100 and 10 × 10 × 10 = 1,000."]],
    method: [
      "Count the factors of 10: 10 is one, 100 is two, 1,000 is three.",
      "Move every digit that many places left; fill empty places with 0.",
    ],
    watch: "A decimal's digits move too: 3.6 × 100 = 360.",
  },
  "divide-power-of-ten": {
    goal: "Given a whole number divided by 10, 100 or 1,000, find the quotient.",
    terms: [["10², 10³", "10 × 10 = 100 and 10 × 10 × 10 = 1,000."]],
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
    "Each counting number is one more than the one before; ten ones make the next ten.",
  "hundred-chart-missing":
    "The hundred chart has rows of ten, so one square right is +1 and one row down is +10.",
  "numeral-for-quantity":
    "A numeral names how many: teen numbers are one ten and some ones.",
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
