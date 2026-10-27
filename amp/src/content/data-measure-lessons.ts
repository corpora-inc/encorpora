import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

export const dataMeasureMethods: Record<string, ProblemMethod> = {
  "mode-of-data": {
    goal: "Find the mode, the value that appears most often in a list or in a table of counts.",
    intuition:
      "The mode is the most popular number in a set of data. Count how many times each number appears and pick the one with the greatest count. A table of counts has already done the counting for you: look for the greatest count.",
    terms: [
      ["data", "Numbers collected by counting or measuring."],
      ["mode", "The value that appears most often in a set of data."],
    ],
    method: [
      "Go through the list and count how many times each different number appears. A tally mark for each one helps.",
      "Find the greatest count. In a table, read the row of counts.",
      "The mode is the number with that greatest count, not the count itself.",
    ],
    watch:
      "The answer is the number that appears most often, not how many times it appears. Check that no other number has the same count.",
  },
  "measure-meaning-choice": {
    goal: "Match mean, median, mode and range to what each one tells about a set of numbers.",
    intuition:
      "Four numbers describe a set of data in different ways. The mean is the fair share, the median is the middle number, the mode is the number that appears most often, and the range tells how far apart the greatest and least are.",
    terms: [
      ["mean", "The amount each would have if the total were shared equally."],
      ["median", "The middle number when the numbers are in order."],
      ["mode", "The number that appears most often."],
      ["range", "The greatest number minus the least number."],
    ],
    method: [
      "Put the numbers in order from least to greatest.",
      "Match the words to a measure: shared equally is the mean, the middle is the median, most often is the mode, and the difference between greatest and least is the range.",
      "When the choices are sentences with numbers, check the meaning first. Another measure can give a number that looks right.",
    ],
    watch:
      "The range is a distance between two numbers, not a middle or a most common number. Order the data before looking for the median.",
  },
};

export const dataMeasurePrinciples: Record<string, string> = {
  "mode-of-data":
    "The mode of a data set is the value with the greatest frequency. A data set can have no mode, one mode or several modes; the problems here have exactly one. The mode is a value from the data, not the count.",
  "measure-meaning-choice":
    "For $n$ numbers, the mean is their sum divided by $n$, the median is the middle number when ordered (for odd $n$), the mode is the most frequent value, and the range is the greatest value minus the least value. The first three describe a center and the range describes spread.",
};

export const dataMeasureLessons = [
  chainLesson({
    id: "mode-of-data-lesson",
    title: "The mode",
    summary:
      "Find the number that appears most often in a list or a table of counts.",
    templateIds: ["mode-of-data"],
    objectives: [
      "Count how many times each number appears in a set of data.",
      "Say that the mode is the number with the greatest count.",
    ],
    openingTitle: "The most popular number",
    opening: [
      "Data are numbers someone collected, such as the points scored in a game. The mode is the number that shows up most often, the most popular number in the data.",
      "To find it, count how many times each number appears. The number with the greatest count is the mode. The count is not the mode: it only helps you decide.",
    ],
    example: {
      prompt: "Find the mode of 4, 7, 4, 9, 7, 4, 5.",
      steps: [
        "Count each number: 4 appears 3 times, 7 appears 2 times, 9 once and 5 once.",
        "The greatest count is 3, which belongs to the number 4.",
        "The mode is 4.",
      ],
      answer: "4",
    },
    methodTitle: "Count, compare, report the number",
    method: [
      "Count each different number, using tally marks if the list is long.",
      "Compare the counts and take the greatest. Report the number that has it.",
    ],
    formalTitle: "Mode and frequency",
    formal: [
      "The frequency of a value is the number of times it appears. The mode is the value with the greatest frequency.",
      "If two values tie for the greatest frequency the data have two modes; if every value appears once there is no mode.",
    ],
    pitfalls: [
      "Giving the greatest count instead of the number that has it.",
      "Choosing the greatest number in the list rather than the most frequent one.",
      "Not checking for a tie before naming one mode.",
    ],
    parentGuide:
      "Ask your learner to make tally marks for each number before choosing.",
  }),
  chainLesson({
    id: "measure-meaning-lesson",
    title: "Mean, median, mode and range",
    summary:
      "Tell what the mean, median, mode and range of a set of numbers each mean.",
    templateIds: ["measure-meaning-choice"],
    objectives: [
      "State what each of the four measures tells about a data set.",
      "Match a description or a named measure to the correct number.",
    ],
    openingTitle: "Four ways to describe a set of numbers",
    opening: [
      "The mean is the fair share: what each would get if everything were put together and shared equally. The median is the middle number once the numbers are in order. The mode is the number that appears most often.",
      "The range is different: it tells how spread out the numbers are, by subtracting the least number from the greatest.",
    ],
    example: {
      prompt:
        "The scores are 6, 9, 9, 12, 14. Which measure is 14 - 6 = 8, and what is the mode?",
      steps: [
        "14 is the greatest score and 6 is the least, and 14 - 6 = 8 is the difference between them.",
        "The difference between greatest and least is the range.",
        "The number that appears most often is 9, so the mode is 9.",
      ],
      answer: "The range is 8, and the mode is 9",
    },
    methodTitle: "Words to measures",
    method: [
      "Fair share is mean, middle is median, most often is mode, greatest minus least is range.",
      "Order the numbers before finding the median or the range.",
    ],
    formalTitle: "The four measures",
    formal: [
      "Mean = sum divided by the number of values. Median = the middle value of the ordered list (for an odd count). Mode = most frequent value. Range = maximum minus minimum.",
      "Mean, median and mode describe a center of the data. Range describes how spread out the data are.",
    ],
    pitfalls: [
      "Using the middle of the list as it was written, without ordering.",
      "Calling the greatest number the range.",
      "Picking a sentence because its number looks familiar, instead of checking what it says.",
    ],
    parentGuide:
      "Ask your learner to say the meaning of each word in their own words before choosing.",
  }),
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
