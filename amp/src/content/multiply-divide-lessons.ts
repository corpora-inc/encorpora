import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

export const multiplyDivideLessons: Lesson[] = [
  {
    id: "multiply-by-tens",
    title: "Multiply by a multiple of ten",
    summary:
      "6 × 70 is 6 × 7 tens: use the fact 6 × 7 = 42, then name 42 tens, or 420.",
    templateIds: ["multiply-by-tens"],
    objectives: [
      "Multiply a one-digit number by a multiple of ten using a known fact.",
      "Explain the product as a number of tens.",
    ],
    sections: [
      {
        title: "Count tens",
        paragraphs: [
          "70 is 7 tens. Six groups of 7 tens are 42 tens, just as six groups of 7 ones are 42 ones.",
          "42 tens is 420, because 40 tens make 400 and 2 tens make 20.",
        ],
        illustration: "multiply-tens-groups",
      },
      {
        title: "Keep every zero",
        paragraphs: [
          "Find the fact first, then make it tens. For 5 × 40 the fact is 5 × 4 = 20, so the product is 20 tens, or 200.",
          "The fact's own zero stays: 200 has two zeros, one from 20 and one from the tens.",
        ],
      },
    ],
    workedExample: {
      prompt: "What is 8 × 50?",
      steps: [
        "50 is 5 tens, so 8 × 50 is 8 × 5 tens.",
        "8 × 5 = 40, so the product is 40 tens.",
        "40 tens = 400.",
      ],
      answer: "400",
    },
    pitfalls: [
      "Dropping a zero when the fact already ends in zero: 5 × 40 = 200, not 20.",
      "Multiplying 6 × 70 as 6 × 7 and stopping at 42.",
    ],
    parentGuide:
      "Use bundles of ten sticks or ten-rods. Build 3 groups of 4 tens and ask how many tens, then how many in all.",
  },
  {
    id: "multiply-partial-products",
    title: "Multiply with partial products",
    summary:
      "Split a factor by place value, multiply each part, and add the partial products.",
    templateIds: ["multiply-by-one-digit", "area-model-product"],
    objectives: [
      "Multiply up to a four-digit number by a one-digit number.",
      "Use an area model to multiply two two-digit numbers.",
    ],
    sections: [
      {
        title: "Split by place value",
        paragraphs: [
          "Multiplying a sum is the same as multiplying each part and adding: 46 × 23 = (40 + 6) × (20 + 3).",
          "The area model shows this. A 46 by 23 rectangle splits into four regions: 40 × 20 = 800, 6 × 20 = 120, 40 × 3 = 120 and 6 × 3 = 18.",
        ],
        illustration: "area-model-product",
      },
      {
        title: "Add the partial products",
        paragraphs: [
          "The regions fill the rectangle without gaps or overlaps, so their areas add to the whole: 800 + 120 + 120 + 18 = 1,058.",
          "With a one-digit factor there is one row of regions: 1,248 × 4 = 4,000 + 800 + 160 + 32 = 4,992.",
        ],
      },
    ],
    workedExample: {
      prompt: "What is 357 × 6?",
      steps: [
        "Split 357 into 300 + 50 + 7.",
        "300 × 6 = 1,800; 50 × 6 = 300; 7 × 6 = 42.",
        "1,800 + 300 + 42 = 2,142.",
      ],
      answer: "2142",
    },
    pitfalls: [
      "Multiplying only the tens and ones and forgetting the cross products, such as 6 × 20.",
      "Using a digit instead of its value: the 4 in 46 means 40.",
    ],
    parentGuide:
      "Draw a rectangle for 23 × 14 on squared paper, split it at 20 and 10, and count each region before adding.",
  },
  {
    id: "multiply-multidigit",
    title: "Multiply multidigit numbers",
    summary:
      "Multiply by the ones digit, then by the tens, and add the two partial products.",
    templateIds: ["multiply-multidigit"],
    objectives: [
      "Multiply a two- or three-digit number by a two-digit number with the standard algorithm.",
      "Check a product with an estimate.",
    ],
    sections: [
      {
        title: "One row for each digit",
        paragraphs: [
          "In 346 × 27, split 27 into 20 + 7. The first row is 346 × 7 = 2,422. The second row is 346 × 20 = 6,920; it ends in 0 because 20 is 2 tens.",
          "The product is the sum of the rows: 2,422 + 6,920 = 9,342. Regroup within each row as you multiply.",
        ],
        illustration: "standard-algorithm-product",
      },
      {
        title: "Estimate to check",
        paragraphs: [
          "Round each factor: 346 × 27 is about 350 × 30 = 10,500. An answer of 9,342 is close; 934 or 93,420 is not.",
          "A zero in a factor still holds a place: 305 × 42 = 12,810, because 305 means 3 hundreds and 5 ones.",
        ],
      },
    ],
    workedExample: {
      prompt: "What is 208 × 34?",
      steps: [
        "208 × 4 = 832.",
        "208 × 30 = 6,240.",
        "832 + 6,240 = 7,072. Estimate: 200 × 34 = 6,800, close.",
      ],
      answer: "7072",
    },
    pitfalls: [
      "Forgetting that the tens row is multiplied by tens, so it ends in 0.",
      "Adding a regrouped digit before multiplying instead of after.",
    ],
    parentGuide:
      "Before multiplying, ask for an estimate. After, compare the answer with the estimate and talk about any large difference.",
  },
  {
    id: "divide-by-one-digit",
    title: "Divide by a one-digit number",
    summary:
      "Take away as many groups of the divisor as fit at each place; the parts taken add to the quotient.",
    templateIds: ["divide-by-one-digit", "division-remainder"],
    objectives: [
      "Divide up to a four-digit number by a one-digit divisor.",
      "Find a remainder and check it is less than the divisor.",
    ],
    sections: [
      {
        title: "Take away groups by place",
        paragraphs: [
          "For 1,476 ÷ 6, ask how many 6s fit, starting with the greatest place. 200 sixes are 1,200, leaving 276. 40 sixes are 240, leaving 36. 6 sixes are 36, leaving 0.",
          "The quotient is 200 + 40 + 6 = 246. Check: 246 × 6 = 1,476.",
        ],
        illustration: "partial-quotients",
      },
      {
        title: "Remainders",
        paragraphs: [
          "When groups no longer fit, what is left is the remainder. For 389 ÷ 4: 90 fours are 360, 7 fours are 28, and 1 is left. So 389 = 97 × 4 + 1.",
          "A remainder is always less than the divisor. If it is not, another group still fits.",
        ],
      },
    ],
    workedExample: {
      prompt: "What is 1,830 ÷ 6?",
      steps: [
        "300 × 6 = 1,800; 1,830 − 1,800 = 30.",
        "No group of 60 fits in 30, so the tens digit is 0.",
        "5 × 6 = 30; 30 − 30 = 0. The quotient is 305.",
      ],
      answer: "305",
    },
    pitfalls: [
      "Skipping a zero in the quotient: 1,830 ÷ 6 = 305, not 35.",
      "Leaving a remainder that is as large as the divisor.",
    ],
    parentGuide:
      "Share 156 counters into 4 equal groups using hundreds, tens and ones, trading a ten for ones when needed.",
  },
  {
    id: "divide-by-two-digit",
    title: "Divide by a two-digit number",
    summary:
      "Estimate each quotient digit with a rounded divisor, subtract, and adjust if the estimate is too large or too small.",
    templateIds: ["divide-by-two-digit"],
    objectives: [
      "Divide up to a four-digit number by a two-digit divisor.",
      "Use estimation and multiplication to check each step.",
    ],
    sections: [
      {
        title: "Estimate each digit",
        paragraphs: [
          "For 1,512 ÷ 24, round 24 to 20 or 25. About 60 twenty-fours fit: 60 × 24 = 1,440, leaving 72. Then 3 × 24 = 72, leaving 0.",
          "The quotient is 60 + 3 = 63. If a product is larger than what is left, the estimate was too big; try one less.",
        ],
        illustration: "partial-quotients-two-digit",
      },
      {
        title: "Check by multiplying",
        paragraphs: [
          "Division undoes multiplication: 63 × 24 = 1,512, so 1,512 ÷ 24 = 63.",
          "A zero in the quotient holds a place: 2,520 ÷ 24 = 105, because no 24 fits in the 12 tens left after 100 twenty-fours.",
        ],
      },
    ],
    workedExample: {
      prompt: "What is 1,872 ÷ 36?",
      steps: [
        "Tens: 50 × 36 = 1,800 fits, but 60 × 36 = 2,160 is too big. 1,872 − 1,800 = 72.",
        "2 × 36 = 72; 72 − 72 = 0.",
        "The quotient is 50 + 2 = 52. Check: 52 × 36 = 1,872.",
      ],
      answer: "52",
    },
    pitfalls: [
      "Keeping an estimate whose product is larger than what is left.",
      "Dropping a zero in the quotient when a place has no full group.",
    ],
    parentGuide:
      "Ask for a rough answer first, such as 1,500 ÷ 25 is about 60, then compare it with the exact quotient.",
  },
];

const placeTerm: [string, string] = [
  "Partial product",
  "The product of one place-value part of a factor, such as 40 × 6.",
];
const divisionTerms: [string, string][] = [
  ["Divisor", "The number you divide by."],
  ["Quotient", "The number of groups, the result of dividing."],
  ["Remainder", "The amount left over, always less than the divisor."],
];
export const multiplyDivideMethods: Record<string, ProblemMethod> = {
  "multiply-by-tens": {
    goal: "Given a one-digit number and a multiple of ten, find their product.",
    method: [
      "Write the multiple of ten as a number of tens: 70 is 7 tens.",
      "Multiply the one-digit fact: 6 × 7 = 42.",
      "Name that many tens: 42 tens = 420.",
    ],
    watch: "Keep the fact's own zero: 5 × 40 = 200.",
  },
  "multiply-by-one-digit": {
    goal: "Given a number up to four digits and a one-digit number, find their product.",
    terms: [placeTerm],
    method: [
      "Split the larger factor by place value.",
      "Multiply each part by the one-digit factor.",
      "Add the partial products.",
    ],
    watch: "Multiply the value of each digit, not the digit alone.",
  },
  "area-model-product": {
    goal: "Given an area model split by place value, find the full product.",
    terms: [placeTerm],
    method: [
      "Multiply width by height in each region.",
      "Add all the regions.",
    ],
    watch: "Every region counts, including the two mixed ones such as 6 × 20.",
  },
  "multiply-multidigit": {
    goal: "Given a two- or three-digit number and a two-digit number, find their product.",
    terms: [placeTerm],
    method: [
      "Multiply by the ones digit of the two-digit factor.",
      "Multiply by its tens, as a multiple of ten.",
      "Add the two partial products and compare with an estimate.",
    ],
    watch: "The tens row is multiplied by tens, so it ends in 0.",
  },
  "divide-by-one-digit": {
    goal: "Given a number up to four digits and a one-digit divisor, find the quotient.",
    terms: divisionTerms,
    method: [
      "From the greatest place, find how many groups of the divisor fit.",
      "Subtract those groups and continue with what is left.",
      "Add the partial quotients; check by multiplying.",
    ],
    watch: "Write 0 for a place where no group fits.",
  },
  "division-remainder": {
    goal: "Given a number and a one-digit divisor, find the remainder.",
    terms: divisionTerms,
    method: [
      "Subtract groups of the divisor place by place until no more fit.",
      "What is left is the remainder; it must be less than the divisor.",
    ],
    watch: "If what is left is the divisor or more, another group still fits.",
  },
  "divide-by-two-digit": {
    goal: "Given a number up to four digits and a two-digit divisor, find the quotient.",
    terms: divisionTerms,
    method: [
      "Estimate each quotient digit with a rounded divisor.",
      "Multiply and subtract; adjust a digit that is too large or too small.",
      "Add the partial quotients; check by multiplying.",
    ],
    watch: "A product larger than what is left means the estimate was too big.",
  },
};
export const multiplyDividePrinciples: Record<string, string> = {
  "multiply-by-tens":
    "Multiplication is associative: 6 × 70 = 6 × (7 × 10) = (6 × 7) × 10.",
  "multiply-by-one-digit":
    "Multiplication distributes over addition: (300 + 50 + 7) × 6 = 300 × 6 + 50 × 6 + 7 × 6.",
  "area-model-product":
    "The area of a rectangle is the sum of the areas of the regions that tile it.",
  "multiply-multidigit":
    "Multiplication distributes over addition: 346 × 27 = 346 × 7 + 346 × 20.",
  "divide-by-one-digit":
    "Division undoes multiplication: the partial quotients add to the number of groups of the divisor in the dividend.",
  "division-remainder":
    "For whole numbers n and d, n = q × d + r with exactly one remainder r from 0 to d − 1.",
  "divide-by-two-digit":
    "Division undoes multiplication: partial quotients add to the quotient whatever the divisor's size.",
};
