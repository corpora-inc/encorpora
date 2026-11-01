import type { MethodTerm } from "../glossary/types";
import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

export const comparisonLessons: Lesson[] = [
  {
    id: "compare-groups",
    title: "Pair to compare two groups",
    summary:
      "To compare two groups means to find which one has more, or that they have the same number. You can make pairs: put one object from each group together. If one group has objects left over, that group has more. If every object has a partner, the groups have the same number.",
    templateIds: ["compare-groups"],
    senses: {
      square: "square-shape",
      squares: "square-shape",
      side: "side",
      sides: "side",
    },
    noLink: ["change", "changes", "line", "parts"],
    objectives: [
      "Decide which of two groups has more, fewer or the same number by pairing.",
      "Explain why spreading objects out does not change how many there are.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Make a partner for each object",
        paragraphs: [
          "A circle is a round shape. A square has 4 sides, the straight parts around its outside. All 4 sides are the same size, and its 4 corners, where the sides meet, are like the corner of a page. Say you have some of each.",
          "Put one circle next to one square. They are now a pair, two things that go together. Keep making pairs until one group runs out.",
          "If every object has a partner, the groups have the same number. If some objects are left over, their group has more. The other group has fewer.",
        ],
      },
      {
        title: "Make pairs",
        paragraphs: [
          "Look at the picture. Each line joins one circle to one square. That makes 4 pairs.",
          "One circle has no partner. So there are more circles than squares, and fewer squares than circles.",
          "If no object were left over, the two groups would have the same number.",
        ],
        illustration: "comparison-pairing",
      },
      {
        title: "A longer row is not always more",
        paragraphs: [
          "In the picture, the squares are spread far apart. Their row is longer, but it has fewer objects. Spreading objects out makes a row take more room. It does not add any objects.",
          "Counting gives the same answer as pairing. There are 5 circles and 4 squares. When you count, 5 comes after 4, so 5 is more.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Matching one to one",
        paragraphs: [
          "Pair one object from each group until one group runs out. This is called matching one to one. It compares two groups without counting them. If one group has objects left over, it has more. If neither group has any left over, the groups have the same number.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A row of 5 circles sits close together. A row of 4 squares is spread across the page. Are there more circles or more squares?",
      steps: [
        "Pair each square with one circle. That makes 4 pairs.",
        "One circle is left with no partner. The group with an object left over has more.",
        "So there are more circles. Counting agrees: 5 comes after 4, so 5 is more. The longer row, the squares, has fewer.",
      ],
      answer: "More circles",
    },
    pitfalls: [
      "Do not choose the longer row just because it is longer. Pair or count first.",
      "Keep track of which objects already have a partner. Draw a line between each pair, or slide each pair together.",
    ],
    parentGuide:
      "Lay out two rows of coins or buttons. Spread the smaller group far apart across the table. Ask which row has more. Then pair them up to check.",
  },
  {
    id: "compare-numerals",
    title: "Greater and less to ten",
    summary:
      "When you count, each number names one more thing than the number before it. So a number you say later in the count is bigger. Greater than means bigger. Less than means smaller. We say 7 after 4, so 7 is greater than 4.",
    templateIds: ["greater-numeral"],
    noLink: ["side", "faces"],
    objectives: [
      "Choose the greater or lesser of two written numbers from 0 to 10.",
      "Read and write comparisons with > and <.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Walk forward through the count",
        paragraphs: [
          "Count up: 0, 1, 2, 3. Each new number names one more object than the number before. So the later you say a number, the more it names.",
          "To compare two numbers means to find which one is bigger, or that they are the same. Say the count, and notice which number comes later.",
        ],
      },
      {
        title: "Later in the count means greater",
        paragraphs: [
          "A number path shows the numbers in counting order, from left to right. Look at the picture: 7 is to the right of 4.",
          "We say 7 later than 4 when we count. So 7 is greater than 4, and 4 is less than 7.",
        ],
        illustration: "comparison-number-path",
      },
      {
        title: "Say it both ways",
        paragraphs: [
          "Every comparison can be said two ways: 7 is greater than 4, and 4 is less than 7. Both are true.",
          "The sign > is read “is greater than,” so 7 > 4 says “7 is greater than 4.” The sign < is read “is less than,” so 4 < 7 says “4 is less than 7.”",
          "The open side of each sign faces the greater number. The pointed tip aims at the smaller number.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Order of numbers",
        paragraphs: [
          "Counting goes up by 1 at each step. So of two numbers, the one said later in the count is greater. The one said earlier is less. Two numbers that are the same name the same amount: they are equal.",
        ],
      },
    ],
    workedExample: {
      prompt: "Which number is less: 9 or 6?",
      steps: [
        "Count up from 0: 0, 1, 2, 3, 4, 5, 6, 7, 8, 9.",
        "You say 6 before you say 9.",
        "A number said earlier is smaller, so 6 is less than 9.",
      ],
      answer: "6",
    },
    pitfalls: [
      "Read the question first. If it asks which number is less, give the smaller one.",
      "Read the sign the right way. Its open side faces the greater number, as in 7 > 4.",
    ],
    parentGuide:
      "Name two numbers up to 10. Ask which is greater, then which is less. Let the learner count out loud to check.",
  },
  {
    id: "compare-by-place",
    title: "Compare numbers place by place",
    summary:
      "A digit is one of the symbols 0 to 9 we use to write numbers. A one is a single thing, a ten is 10 ones, and a hundred is 10 tens. In 382, the 3 means 3 hundreds, the 8 means 8 tens and the 2 means 2 ones. To compare two numbers means to find which is greater, meaning bigger. Start with the biggest place, the one on the left. If those digits match, move one place to the right. The first place where the digits differ tells which number is greater.",
    templateIds: [
      "compare-two-digit",
      "two-digit-symbol",
      "compare-three-digit",
      "three-digit-symbol",
    ],
    senses: { cube: "cube", cubes: "cube" },
    noLink: ["side", "faces", "change"],
    objectives: [
      "Compare two- and three-digit numbers by their hundreds, tens and ones.",
      "Record a comparison with >, = or <.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Begin with the biggest pieces",
        paragraphs: [
          "Think of blocks. A one is a single small cube, a little block shaped like a die. A ten is a rod of 10 cubes. A hundred is a flat of 10 rods, which is 100 cubes.",
          "Say one number has 5 hundreds and another has 4 hundreds. The first number is bigger, whatever the tens and ones are. The tens and ones can make 99 or less, which is not enough for one more hundred.",
          "If the hundreds are the same, look at the tens. If the tens are the same too, look at the ones.",
          "Greater than means bigger, and we write it with the sign >. Less than means smaller, and we write it with the sign <. Equal to means the same amount, and we write it with the sign =. The open side of > or < faces the greater number.",
        ],
      },
      {
        title: "The greatest place decides first",
        paragraphs: [
          "The biggest digit is 9. So the ones make 9 or less, which is not enough for one more ten. In the same way, 9 tens and 9 ones make 99, which is not enough for one more hundred.",
          "So the biggest place where two numbers differ decides. Here both numbers have the same number of digits. Write one number above the other, with matching places. Start at the left and skip places that match. The first place that differs tells which number is greater.",
          "Look at the chart: 607 and 670 have the same hundreds. In the tens, 607 has 0 tens and 670 has 7 tens. So 607 < 670, read “607 is less than 670.”",
        ],
        illustration: "comparison-place-chart",
      },
      {
        title: "Write the comparison",
        paragraphs: [
          "If every place matches, the numbers are equal: 45 = 45.",
          "If they are not equal, one of them is greater. For 39 and 41, the statement 39 < 41 is true, and 39 > 41 is false.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "The first place that differs",
        paragraphs: [
          "Take two numbers with the same number of digits. Compare their digits from the left, the biggest place, toward the right. The first pair of digits that differ decides which number is greater.",
          "This works because the biggest digit is 9. So all the places to the right of a place make less than one more of that place.",
        ],
      },
    ],
    workedExample: {
      prompt: "Compare 382 and 328.",
      steps: [
        "Start with the hundreds: 382 has 3 hundreds and 328 has 3 hundreds. They match, so look at the next place.",
        "Tens: 382 has 8 tens and 328 has 2 tens. 382 has more tens, so the tens decide.",
        "The ones cannot change this, because even 9 ones are not enough for one more ten. So 382 > 328, read “382 is greater than 328.”",
      ],
      answer: "382 > 328",
    },
    pitfalls: [
      "Do not decide by the ones digit or by the biggest digit. 39 < 41, even though 9 is bigger than 1.",
      "A zero still counts as a place. 607 has 0 tens, so 607 < 670.",
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

const placeTerms: MethodTerm[] = ["place", "greater-than", "less-than"];
const symbolTerms: MethodTerm[] = [...placeTerms, "equal"];
const twoDigitPlaces =
  "A digit is one of the symbols 0 to 9 we use to write numbers. A one is a single thing, and a ten is a group of 10 ones. To compare two numbers means to find which is greater or less. In 64, the 6 is in the tens place, the spot for tens, so it means 6 tens. The 4 is in the ones place, the spot for ones, so it means 4 ones. Nine ones are not enough to make another ten. So the number with more tens is greater, meaning bigger.";
const threeDigitPlaces =
  "A digit is one of the symbols 0 to 9 we use to write numbers. A one is a single thing, a ten is a group of 10 ones, and a hundred is a group of 10 tens. To compare two numbers means to find which is greater or less. In 382, the 3 is in the hundreds place, the spot for hundreds. The 8 is in the tens place, the spot for tens. The 2 is in the ones place, the spot for ones. The biggest digit is 9. So the tens and ones make 99 or less, which is not enough for one more hundred. In the same way, the ones make 9 or less, which is not enough for one more ten.";
const signs =
  "Greater than means bigger, and we write it with the sign >. Less than means smaller, and we write it with the sign <. Equal to means the same amount, and we write it with the sign =.";
export const comparisonMethods: Record<string, ProblemMethod> = {
  "compare-groups": {
    goal: "Given a row of circles and a row of squares, decide which has more or fewer, or that they have the same number.",
    intuition:
      "A circle is a round shape. A square has 4 sides, the straight parts around its outside. All 4 sides are the same size, and its 4 corners, where the sides meet, are like the corner of a page. To compare the rows means to find which row has more, or that they have the same number. Make pairs: put one circle with one square, again and again. The row with objects left over has more. Greater than means more, and we write it with the sign >: 9 > 6 says 9 is greater than 6.",
    senses: {
      square: "square-shape",
      squares: "square-shape",
      side: "side",
      sides: "side",
    },
    noLink: ["change", "changes", "parts"],
    method: [
      "Pair each circle with one square.",
      "Objects left with no partner belong to the row that has more.",
      "If none are left over, the rows have the same number.",
    ],
    watch:
      "A longer row can have fewer objects. Pair or count them instead of looking at how long the row is.",
  },
  "greater-numeral": {
    goal: "Given two numbers from 0 to 10, name the greater one or the lesser one.",
    intuition:
      "When you count, each number names one more thing than the number before it. So a number you say later is greater, meaning bigger. A number you say earlier is less, meaning smaller. Less than means smaller, and we write it with the sign <: 6 < 8 says 6 is less than 8.",
    method: [
      "Count up from 0: 0, 1, 2, 3, and keep going.",
      "The number you say later is greater. The number you say first is less.",
      "Answer what the question asks: the greater number or the lesser one.",
    ],
    watch:
      "Check whether the question asks for the greater number or the lesser one.",
  },
  "compare-two-digit": {
    goal: "Given two two-digit numbers, name the greater or the lesser.",
    intuition: twoDigitPlaces,
    terms: placeTerms,
    senses: { "more than": "more-than" },
    method: [
      "Compare the tens digits. More tens means a greater number, whatever the ones are.",
      "If the tens digits match, compare the ones digits.",
      "Answer the question asked: the greater number or the lesser one.",
    ],
    watch:
      "More ones never beat more tens. Compare 41 and 39: 41 is greater, because 4 tens beat 3 tens. The 9 ones in 39 do not change that.",
  },
  "two-digit-symbol": {
    goal: "Given two two-digit numbers, choose the true statement with <, = or >.",
    intuition: `${twoDigitPlaces} ${signs}`,
    terms: symbolTerms,
    senses: { "more than": "more-than" },
    noLink: ["side", "faces"],
    method: [
      "Compare the tens digits. If they match, compare the ones digits.",
      "If one number is greater, choose the sign whose open side faces it.",
      "If every digit matches, the numbers are equal, so choose =.",
    ],
    watch: "Use = only when every digit matches.",
  },
  "compare-three-digit": {
    goal: "Given two three-digit numbers, name the greater or the lesser.",
    intuition: threeDigitPlaces,
    terms: placeTerms,
    senses: { "more than": "more-than" },
    method: [
      "Write one number above the other, so the hundreds, tens and ones match up.",
      "From the left, find the first place where the digits differ.",
      "The number with the bigger digit there is greater.",
    ],
    watch:
      "A zero still holds a place. 607 has 0 tens and 670 has 7 tens, so 670 is greater.",
  },
  "three-digit-symbol": {
    goal: "Given two three-digit numbers, choose the true statement with <, = or >.",
    intuition: `${threeDigitPlaces} ${signs}`,
    terms: symbolTerms,
    senses: { "more than": "more-than" },
    noLink: ["side", "faces"],
    method: [
      "From the left, find the first place where the digits differ.",
      "The number with the bigger digit there is greater. Choose the sign whose open side faces it.",
      "If every digit matches, the numbers are equal, so choose =.",
    ],
    watch:
      "Read the statement from left to right. 302 < 320 says “302 is less than 320.”",
  },
  "multidigit-digit-value": {
    goal: "Given a number up to 999,999, find the value of one of its digits.",
    terms: ["place-value"],
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
    "Two groups have the same number when each object pairs with one object in the other group and none are left over. If one group has objects left over, it has more.",
  "greater-numeral":
    "Each number in the count names one more thing than the number before it. So a number later in the count is greater, and a number earlier is less.",
  "compare-two-digit":
    "Nine ones are not enough to make one ten. So the tens digits decide which number is greater. If the tens digits match, the ones digits decide.",
  "two-digit-symbol":
    "For any two numbers, exactly one is true: the first is less than, equal to or greater than the second. Comparing the tens, then the ones, shows which.",
  "compare-three-digit":
    "The biggest digit is 9. So the places to the right of a place never make one more of that place. That is why the first place from the left where the digits differ decides which number is greater.",
  "three-digit-symbol":
    "For any two numbers, exactly one is true: the first is less than, equal to or greater than the second. The first place from the left where the digits differ shows which.",
  "multidigit-digit-value":
    "Each place is worth ten times the place to its right, so a digit's value is the digit times its place value.",
  "compare-multidigit":
    "A whole number with more digits is greater; with equal digit counts, the highest differing place decides.",
};
