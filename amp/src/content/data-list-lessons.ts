import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

export const dataListMethods: Record<string, ProblemMethod> = {
  "data-list-for-display": {
    goal: "Choose the list of data that matches a dot plot or a table of counts, including a table of counts in ranges.",
    intuition:
      "Data are numbers someone collected, like test scores. A number line is a line with numbers in order, evenly spaced. A dot plot puts one dot above a number line for each number in the list. A value is one of the numbers. A table of counts gives each value with a count: how many times that value is in the list. A range like 10 to 19 means every number from 10 up to 19. To check a list, count how many times each value appears and compare with the display.",
    terms: ["data", "dot-plot", "interval"],
    senses: { interval: "interval" },
    noLink: ["range", "ranges"],
    method: [
      "Add the counts, or count the dots. The list must have that many numbers.",
      "In each list, count how many times each value appears, or how many numbers fall in each range.",
      "Choose the list whose counts match the display for every value or range, not only the first one.",
    ],
    watch:
      "A list can have the right number of values and still have one value wrong. Check every value or range.",
  },
};

export const dataListPrinciples: Record<string, string> = {
  "data-list-for-display":
    "A dot plot and a table of counts show the same list of data. The number of dots, or the count, for a value is how many times it is in the list. The count for a range is how many numbers in the list lie between its ends. Lists with the same counts make the same display, in any order.",
};

export const dataListLessons = [
  chainLesson({
    id: "data-list-for-display-lesson",
    title: "Matching a list of data to its display",
    summary:
      "Data are numbers someone collected, like test scores. A dot plot shows them with one dot for each number. A table of counts shows them with a count for each number: how many times it is in the list. To check a list against a dot plot or table, count how many times each number appears.",
    templateIds: ["data-list-for-display"],
    senses: { interval: "interval" },
    noLink: ["range", "ranges"],
    objectives: [
      "Read how many times each value appears in a dot plot or a table of counts.",
      "Count the values in a list, or in each range, and compare with the display.",
    ],
    openingTitle: "Dots and counts show how many times",
    opening: [
      "A number line is a line with numbers in order, evenly spaced. A dot plot puts one dot above a number line for each number in the data. If there are 3 dots above 5, the number 5 is in the list 3 times.",
      "A table of counts says the same thing with a number instead of dots. A count of 3 next to 5 means 5 is in the list 3 times.",
      "Some tables use ranges instead of single numbers. A range like 10 to 19 means every number from 10 up to 19. Its count says how many numbers in the list fall in that range.",
      "The order of the list does not matter. 3, 5, 3 and 3, 3, 5 make the same dot plot.",
    ],
    example: {
      prompt:
        "A dot plot has 2 dots above 3, 1 dot above 5 and 3 dots above 6. Which list matches: 3, 3, 5, 6, 6, 6 or 3, 5, 5, 6, 6, 6?",
      steps: [
        "Each dot is one number in the list. The plot has $2+1+3=6$ dots, so the list needs 6 numbers. Both lists have 6.",
        "Now check each value, each different number. The plot shows 3 two times, 5 one time and 6 three times.",
        "The first list has 3 twice, 5 once and 6 three times, so it matches. The second list has 5 twice, so it does not.",
      ],
      answer: "3, 3, 5, 6, 6, 6",
    },
    methodTitle: "Count the values, then check each one",
    method: [
      "Add the dots or the counts to find how many numbers the list needs.",
      "In each list, count each value. For a range, count the numbers that fall inside it. Compare with the display.",
    ],
    formalTitle: "Frequencies",
    formal: [
      "The frequency of a value is the number of times it is in the list. A dot plot shows frequencies as stacks of dots.",
      "A table with ranges shows how many numbers fall in each range. Lists that put the same number of values in each range make the same table.",
    ],
    pitfalls: [
      "Do not check only how many numbers there are. Check each count.",
      "A number at the end of a range belongs in that range. 19 is in 10 to 19.",
      "Do not pick a list with the right values but the wrong number of times for one of them.",
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
