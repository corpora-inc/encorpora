import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

export const numberOrderMethods: Record<string, ProblemMethod> = {
  "number-between-bounds": {
    goal: "Choose the whole number that is greater than a lower number and less than an upper number.",
    noLink: ["side", "faces"],
    intuition:
      "A whole number is one of the numbers 0, 1, 2, 3 and so on. The sign < means is less than, and > means is greater than. The open side faces the greater number. The letter $n$ stands for the number you are looking for. $24{,}350<n<24{,}820$ says two things at once: 24,350 is less than $n$, and $n$ is less than 24,820. So $n$ is between them. The smaller number is called the lower bound, and the bigger one is the upper bound. A number equal to a bound does not fit, because a number is not less than itself. To compare two whole numbers, first count their digits: more digits means greater. If they have the same number of digits, read from the left. The first place where the digits differ decides which number is greater.",
    terms: [
      [
        "greater-than",
        "A lower bound is the smaller number in the statement; the value must be greater than it.",
      ],
      [
        "less-than",
        "An upper bound is the larger number in the statement; the value must be less than it.",
      ],
    ],
    method: [
      "Compare each choice with the lower bound, place by place from the left. It must be greater.",
      "Compare each choice with the upper bound the same way. It must be less.",
      "Keep the choice that passes both tests. A number equal to a bound does not pass.",
    ],
    watch:
      "Check both bounds. A number can be greater than the lower bound and also greater than the upper bound.",
  },
  "true-comparison-statement": {
    goal: "Choose the true comparison of whole numbers of five to nine digits that share their first digits.",
    noLink: ["side", "faces", "change", "third"],
    intuition:
      "A whole number is one of the numbers 0, 1, 2, 3 and so on. A digit is one of the symbols 0 to 9. To compare two numbers means to find which is greater (bigger) or less (smaller), or that they are equal. The sign > means is greater than, < means is less than, and = means is equal to. The open side of > or < faces the greater number. Two signs in a row, like 400 < 500 < 600, mean both comparisons are true. A statement is true when it says what really is so. A digit's place is its spot in the number, and each place is worth 10 times the place on its right. From the right the places are ones, tens, hundreds, thousands, ten thousands, hundred thousands, millions, ten millions and hundred millions. To compare two whole numbers, first count their digits. More digits means a greater number. With the same number of digits, line up the places and read from the left. Skip the places that match. The first place where the digits differ decides: the number with the bigger digit there is greater. The digits after that place cannot change the answer: 499 is less than 530, because 4 hundreds and any tens and ones stay below 500.",
    terms: ["place-value", "greater-than"],
    method: [
      "Count the digits first. More digits means a greater number.",
      "For numbers with the same number of digits, compare place by place from the left. Stop at the first place that differs.",
      "Read the statement aloud, saying each sign in words, and check that it is true.",
    ],
    watch:
      "Do not compare the last digits first. The first place from the left where the digits differ decides, even when later digits are bigger in the other number.",
  },
};

export const numberOrderPrinciples: Record<string, string> = {
  "number-between-bounds":
    "A statement like $18{,}200<n<18{,}640$ means $n$ is greater than 18,200 and also less than 18,640. The two bounds themselves do not fit.",
  "true-comparison-statement":
    "A whole number with more digits is greater than one with fewer digits. Two whole numbers with the same number of digits are compared place by place from the left, and the first place that differs decides. A chain like 400 < 500 < 600 lists numbers from least to greatest.",
};

export const numberOrderLessons = [
  chainLesson({
    id: "number-between-bounds-lesson",
    title: "A number between two numbers",
    summary:
      "Some questions ask for a number between two others. It must be greater than the smaller number and less than the bigger number. Compare place by place from the left to test each choice.",
    templateIds: ["number-between-bounds"],
    noLink: ["side", "faces"],
    objectives: [
      "Read a statement with a lower and an upper bound.",
      "Compare multi-digit numbers from the left to test each choice.",
    ],
    openingTitle: "Two comparisons at once",
    opening: [
      "A whole number is one of the numbers 0, 1, 2, 3 and so on. The sign < means is less than, and > means is greater than. The open side faces the greater number. The letter $n$ stands for the number we want.",
      "$24{,}350<n<24{,}820$ is two comparisons joined: 24,350 is less than $n$, and $n$ is less than 24,820. So $n$ is between them. The smaller number is called the lower bound and the bigger one the upper bound.",
      "To compare numbers with many digits, line up the places and read from the left. 24,600 and 24,820 both start with 24. Then the hundreds digits are 6 and 8, so 24,600 is less than 24,820.",
    ],
    example: {
      prompt: "Which fits $18{,}200<n<18{,}640$: 18,150, 18,420 or 18,700?",
      steps: [
        "Test 18,150 against the lower bound, 18,200. Both start with 18, then the hundreds digits are 1 and 2. So 18,150 is less than 18,200, and it is too small.",
        "Test 18,700 against the upper bound, 18,640. The hundreds digits are 7 and 6, so 18,700 is greater than 18,640. It is too big.",
        "18,420 is greater than 18,200, because 4 hundreds is more than 2. It is less than 18,640, because 4 hundreds is less than 6. So it fits.",
      ],
      answer: "18,420",
    },
    methodTitle: "Test both bounds",
    method: [
      "Compare the choice with the lower bound from the left. Then compare it with the upper bound.",
      "Keep the choice that is greater than the lower bound and less than the upper bound.",
    ],
    formalTitle: "Strictly between",
    formal: [
      "$18{,}200<n<18{,}640$ means $n$ is greater than 18,200 and $n$ is less than 18,640. The bounds themselves do not fit, because a number is not less than itself.",
      "Whole numbers with the same number of digits are compared from the left. The first place where their digits differ decides.",
    ],
    pitfalls: [
      "Do not choose a number equal to a bound.",
      "Check both bounds, not just one.",
      "Compare at the first place that differs, not at the last digits.",
    ],
    parentGuide:
      "Ask your learner to write the three numbers in a column, lined up by place, before comparing.",
  }),
  chainLesson({
    id: "true-comparison-statement-lesson",
    title: "Comparing and ordering large numbers",
    summary:
      "To compare two numbers means to find which is greater (bigger) or less (smaller). A whole number is one of the numbers 0, 1, 2, 3 and so on. A digit is one of the symbols 0 to 9, and its place is its spot in the number. For whole numbers with five to nine digits, line up the places and read from the left. The first place where the digits differ decides. You can order three numbers the same way.",
    templateIds: ["true-comparison-statement"],
    noLink: ["side", "faces", "change"],
    objectives: [
      "Compare two large whole numbers place by place from the left.",
      "Order three large numbers from least to greatest.",
    ],
    openingTitle: "Find the first place that differs",
    opening: [
      "A digit's place is its spot in the number, and each place is worth 10 times the place on its right. From the right the places are ones, tens, hundreds, thousands, ten thousands, hundred thousands, millions, ten millions and hundred millions. The commas split the digits into groups of three to make them easy to read.",
      "The sign < means is less than, > means is greater than, and = means is equal to. The open side of < or > faces the greater number.",
      "Compare 3,045,820 and 3,054,820. Both have 7 digits, so line them up. The millions match (3 and 3), and so do the hundred thousands (0 and 0). The ten thousands digits are 4 and 5. That is the first place that differs, so 3,045,820 < 3,054,820.",
      "To order three numbers, compare them two at a time in the same way. Write them with the least on the left: 400 < 500 < 600. Two signs in a row mean both comparisons are true: 400 < 500 and 500 < 600.",
    ],
    example: {
      prompt: "Is $4{,}280{,}190>4{,}208{,}190$ true?",
      steps: [
        "Both numbers have 7 digits. The millions digits are 4 and 4, and the hundred thousands digits are 2 and 2. They match.",
        "The next place is the ten thousands. Its digit is 8 in the first number and 0 in the second.",
        "8 is greater than 0. The 8 means 80,000, and the places after it add up to at most 9,999. So the first number is greater. The statement says 4,280,190 is greater than 4,208,190, so it is true.",
      ],
      answer: "True",
    },
    methodTitle: "Digits, then the first difference",
    method: [
      "Count the digits first. If one number has more digits, it is greater. If the counts are equal, compare place by place from the left.",
      "Stop at the first place where the digits differ. The bigger digit there belongs to the greater number.",
    ],
    formalTitle: "Comparing whole numbers",
    formal: [
      "A whole number with more digits is greater. With the same number of digits, the first place that differs decides, because one more in that place is worth more than all the places to its right.",
      "A chain such as 400 < 500 < 600 means 400 < 500 and also 500 < 600.",
    ],
    pitfalls: [
      "Do not compare the digits at the right end first.",
      "Read each sign the right way. The open side of > faces the greater number.",
      "When two numbers have the same first digit, keep going to the next place to order them.",
    ],
    parentGuide:
      "Draw a chart with a column for each place, labeled ones, tens, hundreds and so on. Write both numbers in it and ask your learner which column is the first one that is different.",
  }),
];

export const numberOrderFacetMappings: FacetMapping[] = [
  {
    templateId: "number-between-bounds",
    facetId: "large-place-value.core",
    extent: "partial",
    rationale:
      "Single choice of the value that fits a lower and an upper bound for five-digit and seven-digit numbers, against values below, above and equal to a bound. Does not assess inline-choice sentences, ordering by dragging, or number clues that combine digit conditions.",
  },
  {
    templateId: "true-comparison-statement",
    facetId: "large-place-value.core",
    extent: "partial",
    rationale:
      "Single choice of the true statement among four pair comparisons of five to nine digit numbers, or of the correct order of three numbers of seven to nine digits. Does not assess words for numbers, number clues, or comparing a number with an expanded form.",
  },
];
