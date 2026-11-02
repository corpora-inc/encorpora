import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

export const dataListMethods: Record<string, ProblemMethod> = {
  "data-list-for-display": {
    goal: "Choose the list of data that matches a dot plot or a table of counts, including a table of counts in ranges.",
    intuition:
      "A dot plot and a table of counts both summarize a list of data. Each dot or each count stands for one value in the list. To check a list, count how many times each value appears, or how many values fall in each range, and compare with the display.",
    terms: ["data", "dot-plot", "interval"],
    method: [
      "Add the counts or count the dots. The list must have that many values.",
      "Count how many times each value appears in a list, or how many values fall in each range.",
      "Choose the list whose counts match the display for every value or range, not only for the first one.",
    ],
    watch:
      "A list can have the right number of values and still have one value wrong. Check every value or range.",
  },
};

export const dataListPrinciples: Record<string, string> = {
  "data-list-for-display":
    "A dot plot, a table of counts and a table of counts in ranges are summaries of the same list of data: the number of dots or the count for a value is the number of times that value appears, and the count for a range is the number of values between its ends. Lists with the same counts for every value or range show the same display.",
};

export const dataListLessons = [
  chainLesson({
    id: "data-list-for-display-lesson",
    title: "Matching a list of data to its display",
    summary:
      "Check a list of data against a dot plot or a table of counts by counting each value or range.",
    templateIds: ["data-list-for-display"],
    objectives: [
      "Read how many times each value appears in a dot plot or a count table.",
      "Count the values of a list in each value or range and compare with the display.",
    ],
    openingTitle: "Each dot or count is one value",
    opening: [
      "A dot plot puts one dot above the number line for each value in the data. If there are 3 dots above 5, the value 5 appears 3 times in the list. A table of counts says the same thing with a number instead of dots.",
      "A table with ranges, such as 10 to 19, counts how many values fall in each range. Two different lists can give the same table, so check that a list gives the counts in every range.",
    ],
    example: {
      prompt:
        "A dot plot has 2 dots above 3, 1 dot above 5 and 3 dots above 6. Which list matches: 3, 3, 5, 6, 6, 6 or 3, 5, 5, 6, 6, 6?",
      steps: [
        "The plot has $2+1+3=6$ dots, so the list has 6 values. Both lists have 6.",
        "The value 3 appears 2 times, 5 appears 1 time and 6 appears 3 times.",
        "The first list has 3 twice, 5 once and 6 three times. The second has 5 twice, so it does not match.",
      ],
      answer: "3, 3, 5, 6, 6, 6",
    },
    methodTitle: "Count the values, then check each one",
    method: [
      "Add the dots or the counts to find how many values the list needs.",
      "Count each value, or each range, in a list and compare with the display.",
    ],
    formalTitle: "Frequencies",
    formal: [
      "The frequency of a value is the number of times it appears in the list. A dot plot shows frequencies as stacks of dots.",
      "A table with ranges shows the number of values in each range; lists that put the same number of values in each range give the same table.",
    ],
    pitfalls: [
      "Checking only the number of values and not each count.",
      "Counting a value that is on the edge of a range in the wrong range.",
      "Choosing a list that has the right values but the wrong number of times each appears.",
    ],
    parentGuide:
      "Ask your learner to put a tally mark next to each value of a list and compare it with the display.",
  }),
];

export const dataListFacetMappings: FacetMapping[] = [
  {
    templateId: "data-list-for-display",
    facetId: "line-plots.core",
    extent: "partial",
    rationale:
      "Single choice of the list of 9 to 13 whole numbers that matches a dot plot of values 1 to 9, a table of counts, or a table of counts in ranges of ten from 10 to 49. Does not assess fractional data, choosing the display for a list, or completing a table by dragging.",
  },
];
