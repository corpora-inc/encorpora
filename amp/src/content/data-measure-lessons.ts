import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

export const dataMeasureMethods: Record<string, ProblemMethod> = {
  "mode-of-data": {
    goal: "Find the mode, the value that appears most often in a list or in a table of counts.",
    senses: {
      mode: "mode-statistics",
      modes: "mode-statistics",
      "more than": "more-than",
    },
    intuition:
      "Data are numbers someone collected, such as points scored in a game. The mode is the number that appears most often in the data. Count how many times each number appears, then pick the number with the greatest count. A table of counts has already done the counting: find the greatest count and read the number above it.",
    terms: ["data", "mode-statistics"],
    method: [
      "Count how many times each different number appears. A tally mark for each one helps. In a table, the counts are already written in a row.",
      "Find the greatest count.",
      "The mode is the number that has that greatest count, not the count itself.",
    ],
    watch:
      "Answer with the number that appears most often, not with how many times it appears.",
  },
  "measure-meaning-choice": {
    goal: "Match mean, median, mode and range to what each one tells about a set of numbers.",
    senses: {
      mean: "mean-average",
      median: "median",
      mode: "mode-statistics",
      range: "range-statistics",
      difference: "difference-subtract",
    },
    noLink: ["center"],
    intuition:
      "Four measures describe a set of numbers in different ways. The mean is the fair share: add the numbers and divide by how many there are. The median is the middle number once the numbers are in order from least to greatest. The mode is the number that appears most often. The range is the greatest number minus the least number, so it tells how spread out the numbers are.",
    terms: ["mean-average", "median", "mode-statistics", "range-statistics"],
    method: [
      "Put the numbers in order from least to greatest.",
      "Match the words to a measure. Shared equally means the mean. The middle means the median. Most often means the mode. Greatest minus least means the range.",
      "When the choices are sentences with numbers, check what each sentence says first. Another measure can give a number that looks right.",
    ],
    watch:
      "The range is the gap between the greatest and least numbers. It is not a middle number or a most common number.",
  },
};

export const dataMeasurePrinciples: Record<string, string> = {
  "mode-of-data":
    "The frequency of a value is how many times it appears. The mode of a data set is the value with the greatest frequency. A data set can have no mode, one mode or several modes; the problems here have exactly one. The mode is a value from the data, not its count.",
  "measure-meaning-choice":
    "For $n$ numbers, the mean is their sum divided by $n$. The median is the middle number once they are ordered (for odd $n$). The mode is the value that appears most often. The range is the greatest value minus the least value. The first three describe a typical value, and the range describes spread.",
};

export const dataMeasureLessons = [
  {
    ...chainLesson({
      id: "mode-of-data-lesson",
      title: "The mode",
      summary:
        "Data are numbers someone collected, such as the points scored in a game. The mode is the number that appears most often in the data. To find it, count how many times each number appears. The number with the greatest count is the mode. A table of counts has done the counting for you.",
      templateIds: ["mode-of-data"],
      objectives: [
        "Count how many times each number appears in a set of data.",
        "Name the mode as the number with the greatest count.",
      ],
      openingTitle: "The most popular number",
      opening: [
        "Data are numbers someone collected, such as the points scored in a game. The mode is the number that shows up most often. You can think of it as the most popular number in the data.",
        "To find it, count how many times each number appears. The number with the greatest count is the mode. The count itself is not the mode. It only helps you decide.",
        "Sometimes the data come in a table. One row lists the numbers, and the row under it says how many times each number appears. The counting is done, so look for the greatest count.",
      ],
      example: {
        prompt: "Find the mode of 4, 7, 4, 9, 7, 4, 5.",
        steps: [
          "Count how many times each number appears: 4 appears 3 times, 7 appears 2 times, 9 appears once and 5 appears once.",
          "Find the greatest count. The greatest count is 3, and it belongs to the number 4. No other number appears 3 times.",
          "The mode is the number with the greatest count, so the mode is 4.",
        ],
        answer: "4",
      },
      methodTitle: "Count, compare, report the number",
      method: [
        "Count each different number. Use tally marks if the list is long.",
        "Compare the counts and find the greatest one. Report the number that has it, not the count.",
      ],
      formalTitle: "Mode and frequency",
      formal: [
        "The frequency of a value is the number of times it appears. The mode is the value with the greatest frequency.",
        "If two values tie for the greatest frequency, the data have two modes. If every value appears the same number of times, there is no mode.",
      ],
      pitfalls: [
        "Report the number that appears most often, not how many times it appears.",
        "The mode is the most frequent number, not the greatest number in the list.",
        "Check for a tie before you name one mode.",
      ],
      parentGuide:
        "Ask the learner to make a tally mark for each number before choosing the mode.",
    }),
    senses: { mode: "mode-statistics", modes: "mode-statistics" },
  },
  {
    ...chainLesson({
      id: "measure-meaning-lesson",
      title: "Mean, median, mode and range",
      summary:
        "Four measures describe a set of numbers. The mean is the fair share: add the numbers and divide by how many there are. The median is the middle number once they are in order. The mode is the number that appears most often. The range is the greatest number minus the least number, so it tells how spread out they are.",
      templateIds: ["measure-meaning-choice"],
      objectives: [
        "Say what each of the four measures tells about a set of numbers.",
        "Match a description or a named measure to the correct number.",
      ],
      openingTitle: "Four ways to describe a set of numbers",
      opening: [
        "Take the scores 6, 9, 9, 12, 14. They add to 50, and there are 5 of them. Shared equally, each would get $50 \\div 5 = 10$. That fair share is called the mean.",
        "The scores are already in order from least to greatest. The middle one is the third score, 9. The middle number is called the median.",
        "The number that appears most often is 9. It is called the mode.",
        "The range is different. It tells how spread out the numbers are. Subtract the least number from the greatest: $14 - 6 = 8$.",
      ],
      example: {
        prompt:
          "The scores are 6, 9, 9, 12, 14. Which measure is 14 - 6 = 8, and what is the mode?",
        steps: [
          "14 is the greatest score and 6 is the least. So $14 - 6 = 8$ is how far apart they are.",
          "The greatest number minus the least number is the range. So 8 is the range.",
          "The number that appears most often is 9, which appears twice. So the mode is 9.",
        ],
        answer: "The range is 8, and the mode is 9",
      },
      methodTitle: "Words to measures",
      method: [
        "Fair share means the mean. Middle means the median. Most often means the mode. Greatest minus least means the range.",
        "Put the numbers in order before you find the median or the range.",
      ],
      formalTitle: "The four measures",
      formal: [
        "Mean = sum divided by the number of values. Median = the middle value of the ordered list, when there is an odd number of values. Mode = the value that appears most often. Range = maximum (greatest value) minus minimum (least value).",
        "The mean, median and mode each give a typical value for the data. The range describes how spread out the data are.",
      ],
      pitfalls: [
        "Put the list in order before taking the middle number.",
        "The range is greatest minus least, not the greatest number.",
        "Check what each sentence says before choosing it. A familiar-looking number can belong to a different measure.",
      ],
      parentGuide:
        "Ask the learner to say what each of the four words means, in their own words, before choosing.",
    }),
    senses: {
      mean: "mean-average",
      mode: "mode-statistics",
      range: "range-statistics",
      difference: "difference-subtract",
    },
    noLink: ["center", "third"],
  },
];

export const dataMeasureFacetMappings: FacetMapping[] = [
  {
    templateId: "mode-of-data",
    facetId: "mean-median.core",
    extent: "partial",
    rationale:
      "Numeric entry for the single mode of 8 to 14 recorded whole numbers shown as a list or as a table of counts. Does not assess data with no mode or several modes, the mean or median, reading a graph for the mode, or using the mode to describe a situation.",
  },
  {
    templateId: "measure-meaning-choice",
    facetId: "mean-median.core",
    extent: "partial",
    rationale:
      "Single choice naming the mean, median, mode or range from its description, or the description that fits a named measure, for 5 or 7 whole numbers with an integer mean. Does not assess calculating the mean of data with a remainder, an even number of values, choosing the best measure for a purpose, or the effect of an outlier.",
  },
];
