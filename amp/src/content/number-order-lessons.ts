import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

export const numberOrderMethods: Record<string, ProblemMethod> = {
  "number-between-bounds": {
    goal: "Choose the whole number that is greater than a lower number and less than an upper number.",
    intuition:
      "A statement such as $24{,}350<n<24{,}820$ says that $n$ is more than 24,350 and also less than 24,820. Compare numbers from the left: the first place where the digits differ decides which number is greater.",
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
      "Compare each choice with the lower number, place by place from the left. It must be greater.",
      "Compare each choice with the upper number the same way. It must be less.",
      "Keep the choice that passes both. A number equal to a bound does not pass, because the signs mean strictly between.",
    ],
    watch:
      "Check both bounds. A number can be above the lower bound and also above the upper bound.",
  },
  "true-comparison-statement": {
    goal: "Choose the true comparison of whole numbers of five to nine digits that share leading digits.",
    intuition:
      "To compare two whole numbers, line up their digits by place and look from the left. Numbers with more digits are greater. When two numbers have the same number of digits, the first place where they differ decides: the number with the greater digit there is the greater number.",
    terms: ["place-value", "greater-than"],
    method: [
      "Check the number of digits first: more digits means a greater number.",
      "For numbers with the same number of digits, compare place by place from the left and stop at the first difference.",
      "Read the statement with the sign in words and check that it is true.",
    ],
    watch:
      "Do not compare the last digits first. The leftmost place where the digits differ decides, even when the later digits favor the other number.",
  },
};

export const numberOrderPrinciples: Record<string, string> = {
  "number-between-bounds":
    "For whole numbers $a<b$, the numbers $n$ with $a<n<b$ are those greater than $a$ and less than $b$; neither $a$ nor $b$ is included.",
  "true-comparison-statement":
    "Two whole numbers with the same number of digits are compared place by place from the left; the first place with different digits decides. A whole number with more digits is greater than one with fewer digits, so $x<y<z$ lists numbers from least to greatest.",
};

export const numberOrderLessons = [
  chainLesson({
    id: "number-between-bounds-lesson",
    title: "A number between two numbers",
    summary:
      "Find the whole number that is greater than a lower number and less than an upper number.",
    templateIds: ["number-between-bounds"],
    objectives: [
      "Read a statement with a lower and an upper bound.",
      "Compare multi-digit numbers from the left to test each choice.",
    ],
    openingTitle: "Two comparisons at once",
    opening: [
      "The statement $24{,}350<n<24{,}820$ is two comparisons joined: $n$ is greater than 24,350 and $n$ is less than 24,820. A number that fits both lies between them.",
      "To compare multi-digit numbers, line up the places and look from the left. 24,600 and 24,820 both start with 24; then the hundreds are 6 and 8, so 24,600 is less than 24,820.",
    ],
    example: {
      prompt: "Which fits $18{,}200<n<18{,}640$: 18,150, 18,420 or 18,700?",
      steps: [
        "18,150 is less than 18,200 because the hundreds are 1 and 2. It is too small.",
        "18,700 is greater than 18,640 because the hundreds are 7 and 6. It is too large.",
        "18,420 is greater than 18,200 and less than 18,640, so it fits.",
      ],
      answer: "18,420",
    },
    methodTitle: "Test both bounds",
    method: [
      "Compare the choice with the lower number from the left, then with the upper number.",
      "Keep the choice that is greater than the lower number and less than the upper number.",
    ],
    formalTitle: "Strict bounds",
    formal: [
      "$a<n<b$ means $n>a$ and $n<b$. The bounds themselves are not solutions.",
      "Whole numbers are compared place by place from the leftmost place where they differ.",
    ],
    pitfalls: [
      "Choosing a number equal to a bound.",
      "Checking only one of the two bounds.",
      "Comparing the last digits instead of the first place that differs.",
    ],
    parentGuide:
      "Ask your learner to write the three numbers in a column, lined up by place, before comparing.",
  }),
  chainLesson({
    id: "true-comparison-statement-lesson",
    title: "Comparing and ordering large numbers",
    summary:
      "Compare whole numbers of five to nine digits by place value and order three of them.",
    templateIds: ["true-comparison-statement"],
    objectives: [
      "Compare two large whole numbers place by place from the left.",
      "Order three large numbers from least to greatest.",
    ],
    openingTitle: "Find the first place that differs",
    opening: [
      "To compare 3,045,820 and 3,054,820, line up the digits. Both start 3,0; then the ten-thousands digit is 4 in the first and 5 in the second. The first place that differs decides, so 3,045,820 is less than 3,054,820.",
      "To order three numbers, compare them two at a time in the same way, and write them with the least on the left.",
    ],
    example: {
      prompt: "Is $4{,}280{,}190>4{,}208{,}190$ true?",
      steps: [
        "Both numbers have 7 digits, and both start 4,2.",
        "The next digit is 8 in the first number and 0 in the second.",
        "8 is greater than 0, so the first number is greater and the statement is true.",
      ],
      answer: "True",
    },
    methodTitle: "Digits, then the first difference",
    method: [
      "Count digits first. If they are equal, compare place by place from the left.",
      "Stop at the first place where the digits differ. The greater digit there belongs to the greater number.",
    ],
    formalTitle: "Comparing whole numbers",
    formal: [
      "A whole number with more digits is greater. With equal numbers of digits, the first differing place decides.",
      "$x<y<z$ means $x<y$ and $y<z$.",
    ],
    pitfalls: [
      "Comparing the digits at the right end first.",
      "Reading the sign the wrong way: $>$ opens toward the greater number.",
      "Ordering by the first digit only when it is the same in two numbers.",
    ],
    parentGuide:
      "Use a place-value chart and ask your learner which column is the first one that is different.",
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
