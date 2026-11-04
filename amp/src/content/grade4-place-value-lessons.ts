import type { FacetMapping } from "./coverage";
import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

export const grade4PlaceValueMethods: Record<string, ProblemMethod> = {
  "place-shift-value": {
    goal: "Find the value of a digit after it moves one place, or the product of a whole number and 10 or 100.",
    intuition:
      "A digit is one of the symbols 0 to 9. A digit's place is its spot in the number. From the right, the places are ones, tens, hundreds, thousands, and so on. Each place is worth 10 times the place on its right. “10 times as much” means 10 groups of that amount. “One tenth as much” means the amount split into 10 equal groups, and you have 1 of those groups. Moving a digit one place to the left makes it worth 10 times as much. Moving it one place to the right makes it worth one tenth as much. Multiplying a whole number by 10 moves every digit one place to the left. Multiplying by 100 moves every digit two places to the left.",
    method: [
      "Name the place the digit is in now, and write what it is worth.",
      "For a shift, move one place in the direction the question says. Left multiplies the value by 10. Right divides the value by 10.",
      "For a product with 10 or 100, count the zeros. Each zero moves every digit one place to the left.",
    ],
    watch:
      "One place to the left is 10 times as much, not 1 more. Two places is 10 × 10 = 100 times as much, not 20 times.",
  },
  "number-name-numeral": {
    goal: "Match a whole number with its number name, or a number name with its numeral.",
    intuition:
      "A numeral is a number written with digits, such as 4,020. A number name is the same number written in words, such as four thousand, twenty. The comma in 4,020 splits the digits into groups of three. The group before the comma is the thousands. The last three digits are the ones group. A zero holds a place even though it adds nothing: 4,020 is four thousand twenty, not four hundred twenty.",
    method: [
      "If you are given words, write the thousands group first, then the ones group. Put a zero in any place the words skip.",
      "If you are given a numeral, say the digits before the comma, then the word thousand, then the last three digits.",
      "Check that the number of digits matches the name. One million is 1 followed by six zeros.",
    ],
    watch:
      "Do not drop a zero inside the number, and do not swap the thousands group with the ones group.",
  },
  "large-number-line-point": {
    goal: "Read the number at a point on a number line, or find the point at a given number, when the ticks count by 1,000, 10,000 or 100,000.",
    intuition:
      "A number line is a line with numbers in order. The tick marks are the short lines on it. On these lines the ticks are evenly spaced, but only a few ticks are labeled. The space from one tick to the next is always the same size: 1,000, 10,000 or 100,000. A point between the labels is found by counting ticks from the nearest labeled tick.",
    method: [
      "Read the labeled ticks and the size of one step. The step is the difference of two neighboring labeled ticks, divided by the number of steps between them.",
      "To read a point, start at the nearest labeled tick and count the ticks to the point. Add or subtract one step for each tick.",
      "To locate a number, count the same way from a labeled tick until you reach that number. The letter on that tick is the point.",
    ],
    watch:
      "Count ticks, not the gap between labels as one step. From 0 to 10,000 with a tick every 1,000 is 10 steps, not 1.",
  },
};

export const grade4PlaceValuePrinciples: Record<string, string> = {
  "place-shift-value":
    "Each place is worth 10 times the place on its right. A digit that moves one place left is worth 10 times as much, and a digit that moves one place right is worth one tenth as much. Multiplying by 10 or by 100 is that same move for every digit.",
  "number-name-numeral":
    "A number name and a numeral name the same amount. The word thousand starts a new group of three digits, and a zero keeps a place that the name skips.",
  "large-number-line-point":
    "On a number line with equal ticks, the number at a point is the nearest labeled number plus or minus the step size for each tick in between.",
};

export const grade4PlaceValueFacetMappings: readonly FacetMapping[] = [
  {
    templateId: "place-shift-value",
    facetId: "large-place-value.digit-shift",
    extent: "partial",
    rationale:
      "Gives the new place and value of a nonzero digit shifted one place left or right in a whole number up to 1,000,000, and the product of a whole number and 10 or 100. Does not assess decimal shifts or a written explanation.",
  },
  {
    templateId: "number-name-numeral",
    facetId: "large-place-value.number-names",
    extent: "partial",
    rationale:
      "Matches a whole number up to 1,000,000 with its number name, in either direction, including numbers with an internal zero. Does not assess expanded form or decimals.",
  },
  {
    templateId: "large-number-line-point",
    facetId: "large-place-value.scaled-line",
    extent: "partial",
    rationale:
      "Reads or locates a whole number on a number line whose ticks are 1,000, 10,000 or 100,000 apart, up to 1,000,000. Does not assess drawing the point.",
  },
];

export const grade4PlaceValueLessons: Lesson[] = [
  {
    id: "grade4-place-value",
    title: "Large numbers: shifts, names and the number line",
    summary:
      "A digit's place decides what it is worth. Moving the digit one place multiplies or divides that value by 10. The same idea reads a number name and a point on a number line that counts by thousands.",
    templateIds: [
      "place-shift-value",
      "number-name-numeral",
      "large-number-line-point",
    ],
    objectives: [
      "Find the value of a digit after it shifts one place left or right, and multiply a whole number by 10 or 100.",
      "Read and write a whole number up to 1,000,000 as a numeral and as a number name.",
      "Read and locate a whole number on a number line counted by 1,000, 10,000 or 100,000.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Each place is ten times the place on its right",
        paragraphs: [
          "A digit is one of the symbols 0 to 9. In 4,820 the 8 is in the hundreds place, so it is worth 800. One place to the left, that 8 would be worth 8,000. One place to the right, it would be worth 80.",
          "Multiplying 4,820 by 10 moves every digit one place to the left: 48,200. Multiplying by 100 moves every digit two places to the left: 482,000.",
        ],
        illustration: "large-place-value-chart",
      },
      {
        title: "A number name uses the same places",
        paragraphs: [
          "4,820 in words is four thousand, eight hundred twenty. The comma in the numeral is where you say thousand.",
          "A zero holds a place. 4,082 is four thousand, eighty-two, not four hundred eighty-two. Dropping the zero makes a different number.",
        ],
      },
      {
        title: "Count the ticks on a large number line",
        paragraphs: [
          "When the ticks are 1,000 apart, each step to the right adds 1,000. A point two ticks to the right of 5,000 is at 7,000.",
          "The same count works for ticks of 10,000 and 100,000. Start at a labeled tick so there is less to count.",
        ],
        illustration: "power-of-ten-shift",
      },
    ],
    workedExample: {
      prompt:
        "In 36,450, the digit 6 is worth 6,000. It shifts one place to the left. What is it worth then?",
      steps: [
        "6,000 is 6 thousands. One place to the left of thousands is ten thousands.",
        "Each place to the left is worth 10 times as much, so 6,000 × 10 = 60,000.",
      ],
      answer: "60000",
    },
    pitfalls: [
      "Moving one place is a factor of 10, not a change of 1.",
      "A zero inside a number name still takes a digit in the numeral.",
      "On a number line, count every tick. Do not jump from one label to the next in one step unless no tick is between them.",
    ],
    parentGuide:
      "Write 36,450 and ask what the 6 is worth. Then cover it and slide the 6 one place left. Ask for the new value before you write 60,000.",
  },
];
