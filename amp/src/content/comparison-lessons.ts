import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

export const comparisonLessons: Lesson[] = [
  {
    id: "compare-groups",
    title: "Pair to compare two groups",
    summary:
      "Pair objects from the two groups. The group with leftovers has more; no leftovers means equal groups.",
    templateIds: ["compare-groups"],
    objectives: [
      "Decide which of two groups has more, fewer or the same number by pairing.",
      "Explain why spreading objects out does not change how many there are.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Make a partner for each object",
        paragraphs: [
          "Put one circle beside one square and keep pairing them. If every object gets a partner, the groups have the same number. If one group has leftovers, that group has more.",
        ],
      },
      {
        title: "Make pairs",
        paragraphs: [
          "Match one circle with one square, then another circle with another square. Keep going until one row runs out.",
          "If objects are left over, their group has more and the other group has fewer. If every object has a partner, the groups have the same number.",
        ],
        illustration: "comparison-pairing",
      },
      {
        title: "Length is not number",
        paragraphs: [
          "A row can be longer because its objects are farther apart. Spacing changes how much room a row takes, not how many objects it has.",
          "Counting gives the same answer: 5 circles and 4 squares, and 5 comes after 4 in the count.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "One-to-one comparison",
        paragraphs: [
          "Pairing one object from each group until one group runs out compares their counts without recounting. If one group has objects left over, it has more; if neither does, the counts are equal.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A row of 5 circles sits close together. A row of 4 squares is spread across the page. Are there more circles or more squares?",
      steps: [
        "Pair each square with one circle: 4 pairs.",
        "One circle has no partner.",
        "There are more circles: 5 > 4. The longer row has fewer.",
      ],
      answer: "More circles",
    },
    pitfalls: [
      "Choosing the longer row without pairing or counting.",
      "Losing track of which objects already have a partner.",
    ],
    parentGuide:
      "Lay out two rows of coins or buttons and stretch the shorter group across the table. Ask which has more, then pair them to check.",
  },
  {
    id: "compare-numerals",
    title: "Greater and less to ten",
    summary: "A counting number reached later names a larger amount.",
    templateIds: ["greater-numeral"],
    objectives: [
      "Choose the greater or lesser of two written numbers from 0 to 10.",
      "Read and write comparisons with > and <.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Walk forward through the count",
        paragraphs: [
          "One comes before two, and two comes before three. Each step forward names one more object. To compare two counting numbers, notice which one you reach later.",
        ],
      },
      {
        title: "Later in the count means greater",
        paragraphs: [
          "Each number in the count is one more than the number before it. So a number said later is greater than a number said earlier.",
          "On the number path, 7 is to the right of 4. Seven is greater; four is less.",
        ],
        illustration: "comparison-number-path",
      },
      {
        title: "Say it both ways",
        paragraphs: [
          "Every comparison has two true sentences: 7 is greater than 4, and 4 is less than 7.",
          "The symbols point the same way: 7 > 4 and 4 < 7. The wide, open side faces the greater number.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Order of whole numbers",
        paragraphs: [
          "Counting increases by one at each step. For two whole numbers, the number reached later in the count is greater; the number reached earlier is less. Equal numerals name equal counts.",
        ],
      },
    ],
    workedExample: {
      prompt: "Which number is less: 9 or 6?",
      steps: [
        "Count: 0, 1, 2, 3, 4, 5, 6, 7, 8, 9.",
        "6 is said before 9, so 6 is less.",
      ],
      answer: "6",
    },
    pitfalls: [
      "Answering with the greater number when the question asks which is less.",
      "Reading < and > the wrong way; the open side faces the greater number.",
    ],
    parentGuide:
      "Name two numbers up to ten and ask which is greater, then which is less. Let the learner count aloud to check.",
  },
  {
    id: "compare-by-place",
    title: "Compare numbers place by place",
    summary:
      "Compare the largest place first. If those digits tie, move right until one place differs.",
    templateIds: [
      "compare-two-digit",
      "two-digit-symbol",
      "compare-three-digit",
      "three-digit-symbol",
    ],
    objectives: [
      "Compare two- and three-digit numbers by their hundreds, tens and ones.",
      "Record a comparison with >, = or <.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Begin with the biggest pieces",
        paragraphs: [
          "If one number has 5 hundreds and another has 4 hundreds, the first is larger even before you inspect their tens and ones. If the hundreds match, look at the tens; if those match too, look at the ones.",
        ],
      },
      {
        title: "The greatest place decides first",
        paragraphs: [
          "One hundred is more than any number of tens and ones that do not make a hundred. One more ten is more than nine ones. So a larger digit in a greater place beats anything in the places to its right.",
          "Line up the digits by place. Starting at the left, skip places that match. The first place that differs decides: 607 < 670 because 0 tens < 7 tens.",
        ],
        illustration: "comparison-place-chart",
      },
      {
        title: "Write the comparison",
        paragraphs: [
          "Read > as is greater than, < as is less than, and = as is equal to. The open side of < and > faces the greater number.",
          "If every place matches, the numbers are equal. Otherwise exactly one of < and > is true.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "First unequal place",
        paragraphs: [
          "For whole numbers with the same number of digits, compare digits from the greatest place to the least. The first unequal pair decides the order because one unit of that place exceeds every possible difference in all lower places combined.",
        ],
      },
    ],
    workedExample: {
      prompt: "Compare 382 and 328.",
      steps: [
        "Hundreds: 3 and 3 match.",
        "Tens: 8 tens > 2 tens, so the tens decide.",
        "382 > 328. The ones do not matter.",
      ],
      answer: "382 > 328",
    },
    pitfalls: [
      "Deciding by the ones digit or the largest digit: 39 < 41 although 9 > 1.",
      "Treating a zero as empty: 607 has 0 tens, so 607 < 670.",
    ],
    parentGuide:
      "Write two numbers with the same digits in different orders, such as 47 and 74. Ask which is greater and why, using tens and ones.",
  },
  {
    id: "large-place-value",
    title: "Place value to hundred thousands",
    summary:
      "A digit's place tells whether it counts ones, tens, hundreds, or larger groups.",
    templateIds: ["multidigit-digit-value", "compare-multidigit"],
    objectives: [
      "Name the value of any digit in a number up to 999,999.",
      "Compare multidigit numbers by digit count, then place by place.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "The same digit can name different amounts",
        paragraphs: [
          "The 3 in 300 is three hundreds, while the 3 in 30 is three tens. Moving one place left makes a digit worth ten times as much. This lets you read and compare numbers well beyond 100.",
        ],
      },
      {
        title: "A digit's value comes from its place",
        paragraphs: [
          "The places from the right are ones, tens, hundreds, thousands, ten thousands and hundred thousands. Each is worth ten of the place to its right.",
          "A digit's value is the digit times its place's value. In 372,946 the 7 is in the ten thousands place, so it is worth 7 × 10,000 = 70,000.",
        ],
        illustration: "large-place-value-chart",
      },
      {
        title: "Compare large numbers",
        paragraphs: [
          "First count the digits. A whole number with more digits is greater: every five-digit number is less than 100,000.",
          "With the same number of digits, compare from the left. The first place that differs decides, as with smaller numbers.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Value of a digit",
        paragraphs: [
          "A digit's value is its digit count times the value of its place. Each place to the left is worth ten times the place to its right. Comparing from the greatest place finds the first value that can decide which whole number is larger.",
        ],
      },
    ],
    workedExample: {
      prompt: "Which number is greater: 405,213 or 450,123?",
      steps: [
        "Both have 6 digits.",
        "Hundred thousands match: 4 and 4.",
        "Ten thousands: 0 < 5, so 450,123 is greater.",
      ],
      answer: "450,123",
    },
    pitfalls: [
      "Giving the digit instead of its value: the 7 in 372,946 is worth 70,000, not 7.",
      "Comparing the first digits of numbers with different digit counts: 98,765 < 102,345.",
    ],
    parentGuide:
      "Read a large number from a receipt or map aloud. Point to one digit and ask what it is worth, then change its place and ask again.",
  },
];

const placeTerms: [string, string][] = [
  ["Place", "A digit's position: ones, tens, hundreds, and so on."],
  [">, <, =", "Is greater than, is less than, is equal to."],
];
export const comparisonMethods: Record<string, ProblemMethod> = {
  "compare-groups": {
    goal: "Given a row of circles and a row of squares, decide which has more or fewer, or that they match.",
    method: [
      "Pair each circle with one square.",
      "Objects left without a partner belong to the group with more.",
      "If none are left over, the groups have the same number.",
    ],
    watch:
      "A longer row can have fewer objects; pair them, do not judge by length.",
  },
  "greater-numeral": {
    goal: "Given two numbers from 0 to 10, name the greater or the lesser.",
    method: [
      "Count up from 0: 0, 1, 2, 3, …",
      "The number you say later is greater; the one you say first is less.",
    ],
    watch: "Check whether the question asks for greater or less.",
  },
  "compare-two-digit": {
    goal: "Given two two-digit numbers, name the greater or the lesser.",
    terms: placeTerms,
    method: [
      "Compare the tens digits. More tens means greater, whatever the ones.",
      "If the tens match, compare the ones digits.",
      "Answer the question asked: greater or less.",
    ],
    watch: "More ones never beats more tens: 39 < 41.",
  },
  "two-digit-symbol": {
    goal: "Given two two-digit numbers, choose the true statement with <, = or >.",
    terms: placeTerms,
    method: [
      "Compare the tens; if they match, compare the ones.",
      "Choose the symbol whose open side faces the greater number.",
    ],
    watch: "Use = only when every digit matches.",
  },
  "compare-three-digit": {
    goal: "Given two three-digit numbers, name the greater or the lesser.",
    terms: placeTerms,
    method: [
      "Line up hundreds, tens and ones.",
      "From the left, find the first place where the digits differ.",
      "The number with the larger digit there is greater.",
    ],
    watch: "A zero holds a place: 607 has 0 tens.",
  },
  "three-digit-symbol": {
    goal: "Given two three-digit numbers, choose the true statement with <, = or >.",
    terms: placeTerms,
    method: [
      "Find the first place, from the left, where the digits differ.",
      "Choose the symbol whose open side faces the greater number.",
    ],
    watch: "Read the statement left to right: 302 < 320 says 302 is less.",
  },
  "multidigit-digit-value": {
    goal: "Given a number up to 999,999, find the value of one of its digits.",
    terms: [
      [
        "Place value",
        "What one unit in a place is worth: 1, 10, 100, 1,000, 10,000 or 100,000.",
      ],
    ],
    method: [
      "Name the digit's place, counting from the ones at the right.",
      "Multiply the digit by that place's value.",
    ],
    watch: "Give the value, not the digit: the 7 in 372,946 is worth 70,000.",
  },
  "compare-multidigit": {
    goal: "Given two numbers up to 999,999, name the greater or the lesser.",
    method: [
      "Count the digits. More digits means greater.",
      "With equal digit counts, compare from the left.",
      "The first place that differs decides.",
    ],
    watch: "A shorter number is less even when its first digit is larger.",
  },
};
export const comparisonPrinciples: Record<string, string> = {
  "compare-groups":
    "One-to-one correspondence: two groups have the same number exactly when every object pairs with one in the other group.",
  "greater-numeral":
    "Each counting number is one more than the number before it, so a number later in the count is greater.",
  "compare-two-digit":
    "One ten is more than nine ones, so the tens digit decides unless the tens match.",
  "two-digit-symbol":
    "Exactly one of a < b, a = b and a > b is true for any two numbers.",
  "compare-three-digit":
    "A unit in a place is worth more than any amount in the lower places, so the highest differing place decides.",
  "three-digit-symbol":
    "Exactly one of a < b, a = b and a > b is true; place value decides which.",
  "multidigit-digit-value":
    "Each place is worth ten times the place to its right, so a digit's value is the digit times its place value.",
  "compare-multidigit":
    "A whole number with more digits is greater; with equal digit counts, the highest differing place decides.",
};
