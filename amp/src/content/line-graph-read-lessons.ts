import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

export const lineGraphReadMethods: Record<string, ProblemMethod> = {
  "line-graph-reader": {
    goal: "Read values, greatest and least points, changes and comparisons from a line graph.",
    intuition:
      "A line graph is a picture of how an amount goes up and down over time. Each point is a dot that shows one measurement. Its place along the bottom tells the day or week. Its height tells the amount, read on the scale: the numbers up the side. A line joins each point to the next, so you can see whether the amount went up or down.",
    terms: [
      "scale-axis",
      [
        "change",
        "Here it is the later value minus the earlier value: positive for an increase, negative for a decrease.",
      ],
    ],
    senses: { scale: "scale-axis", change: "change" },
    method: [
      "Check what the scale counts by. Then read the height of each point you need.",
      "Write the amounts you read as a list, in order. Answer greatest, least or closest questions from the list.",
      "For a change, subtract the earlier amount from the later one. For the greatest increase, find the change between every pair of neighboring points and pick the biggest one above 0. For the greatest decrease, pick the change farthest below 0.",
    ],
    watch:
      "The highest point and the biggest rise are different questions. A big rise can start from a low point and still end below the highest point.",
  },
  "dot-plot-arithmetic": {
    goal: "Use every dot of a dot plot to find a total, a range or a missing value.",
    intuition:
      "A number line is a line with numbers in order, evenly spaced. A dot plot puts one dot above a number line for each measurement. A stack of three dots over 4 means three measurements of 4. So 4 is added three times in the total. Reading every dot gives a list of numbers. Then the question is adding or subtracting with that list.",
    terms: ["range-statistics", "mixed-number"],
    senses: { range: "range-statistics", whole: "whole" },
    method: [
      "Write the value of every dot as a list. A stack of dots puts that value in the list once for each dot.",
      "For the total, add them all. For the range, subtract the least value from the greatest. When one value is missing from a given total, the missing value is the given total minus the total of the dots shown.",
      "A mixed number, like 2 1/4, is a whole number and a fraction together. First write every fraction part in the plot's smallest part, halves or fourths: 1/2 is 2/4. Add or subtract the fraction parts, then the whole numbers. If the fraction parts make a whole or more, take out the whole. If a fraction part is too small to subtract from, trade 1 whole for 2 halves or 4 fourths first.",
    ],
    watch:
      "Do not add each different value only once. A value with two dots is added twice.",
  },
};

export const lineGraphReadPrinciples: Record<string, string> = {
  "line-graph-reader":
    "A line graph pairs each time with one amount, the height of its point on the scale. The change from one time to a later time is the later amount minus the earlier amount. A positive change is an increase and a negative change is a decrease. The greatest increase is the biggest positive change between neighboring times. It need not end at the highest point.",
  "dot-plot-arithmetic":
    "A dot plot shows a list of data with one dot for each value. If a value has 3 dots, it adds 3 times that value to the total. The range is the greatest value minus the least value. If you know the total of all the values and the total of all but one, the missing value is the difference.",
};

export const lineGraphReadLessons = [
  chainLesson({
    id: "line-graph-reader-lesson",
    title: "Reading a line graph",
    summary:
      "A line graph shows how an amount goes up and down over time. Each point, a dot on the graph, has a height read on the scale, the numbers up the side. You can read the greatest and least amounts. You can also find the change from one point to another: the later amount minus the earlier one.",
    templateIds: ["line-graph-reader"],
    senses: { scale: "scale-axis", change: "change" },
    objectives: [
      "Read the amount at a point on the scale.",
      "Find the greatest and least amounts, and the change between two points.",
    ],
    openingTitle: "Each point is one measurement",
    opening: [
      "A line graph shows how an amount changes over days, weeks or hours. The times are along the bottom. Each point sits above one time. Its height on the scale, the numbers up the side, is the amount at that time.",
      "Gridlines are the lines across the graph. Before reading a height, check what the gridlines count by. If they count by 5, a point halfway between 20 and 30 is at 25.",
      "Consecutive times are times next to each other, like Day 2 and Day 3. A change is the later amount minus the earlier amount. If the amount went up, the change is positive, more than 0. That is an increase. If it went down, the change is negative, less than 0. That is a decrease.",
    ],
    example: {
      prompt:
        "A graph shows temperatures 40, 45, 58, 50 and 60 on Days 1 to 5. Between which two consecutive days did the temperature increase the most?",
      steps: [
        "Consecutive days are days next to each other. Find each change by subtracting the earlier temperature from the later one: Day 1 to 2 is $45 - 40 = 5$. Day 2 to 3 is $58 - 45 = 13$. Day 3 to 4 is $50 - 58 = -8$. Day 4 to 5 is $60 - 50 = 10$.",
        "The greatest increase is the biggest change above 0. That is 13, from Day 2 to Day 3.",
        "Day 5 has the highest temperature, 60. But the rise into Day 5 is only 10, so it is not the greatest increase.",
      ],
      answer: "Day 2 to Day 3",
    },
    methodTitle: "Make a list of amounts, then compare",
    method: [
      "Read each point you need on the scale, and write the amounts down in order.",
      "Greatest and least: the biggest and smallest numbers on the list. Closest to a number: find how far each amount is from that number, and take the smallest distance.",
      "Change: later amount minus earlier amount. Greatest increase: the biggest positive change between neighbors. Greatest decrease: the negative change farthest below 0.",
    ],
    formalTitle: "Change between two points",
    formal: [
      "The change from one time to a later time is the later amount minus the earlier amount. It is positive for an increase and negative for a decrease.",
      "The greatest amount does not always come right after the greatest increase.",
    ],
    pitfalls: [
      "Do not read a height one gridline off. Check whether the scale counts by 1, 2, 5 or 10.",
      "Do not pick the highest point when the question asks for the greatest increase. An increase is a change between two points.",
      "Do not reverse a change. Subtract the earlier amount from the later one.",
    ],
    parentGuide:
      "Ask your learner to say the scale first, then read two points aloud and subtract before choosing an answer.",
  }),
  chainLesson({
    id: "dot-plot-arithmetic-lesson",
    title: "Arithmetic from a dot plot",
    summary:
      "A number line is a line with numbers in order, evenly spaced. A dot plot puts one dot above a number line for each measurement. Read every dot to make a list of numbers. Then add or subtract to find a total, a missing value or the range: the greatest value minus the least. Some values may be mixed numbers, a whole number and a fraction together, like 2 1/2.",
    templateIds: ["dot-plot-arithmetic"],
    senses: { range: "range-statistics", whole: "whole" },
    objectives: [
      "Write the values of a dot plot as a list, counting every dot.",
      "Find a total, a range or a missing value, with whole numbers or mixed numbers.",
    ],
    openingTitle: "One dot is one measurement",
    opening: [
      "A dot plot puts one dot above a number line for each measurement. A number line is a line with numbers in order, evenly spaced. If three dots stand over 4, then three measurements were 4.",
      "So the plot is really a list. Write the list from left to right. Then the question is adding or subtracting with that list.",
      "The range is how spread out the values are: the greatest value minus the least value. A whole number is 0, 1, 2, 3 and so on. A fraction like 1/2 names equal parts of a whole. A mixed number is a whole number and a fraction together, like 2 1/2, which means 2 and one half.",
    ],
    example: {
      prompt:
        "A dot plot has dots at 2, 3, 3, 5 and 5 miles. What is the total number of miles?",
      steps: [
        "Write a value for every dot, so a stack of two dots gives the value twice: 2, 3, 3, 5, 5.",
        "The total is all the values added together: $2 + 3 + 3 + 5 + 5 = 18$.",
        "Adding 2, 3 and 5 only once each would give 10. That would leave out two dots.",
      ],
      answer: "18 miles",
    },
    methodTitle: "List, then calculate",
    method: [
      "Write the value of each dot, repeating a value once for each dot above it.",
      "Total: add the list. Range: greatest minus least.",
      "Missing value: the story gives the total of all the values, but one dot is missing. The given total is the dots shown plus the missing value. So the missing value is the given total minus the total of the dots.",
      "For mixed numbers, first write every fraction part in the plot's smallest part, halves or fourths: 1/2 is 2/4. Add the fraction parts, then the whole numbers. If the fraction parts make a whole or more, like 5/4, take out the whole: 5/4 is 1 and 1/4.",
    ],
    formalTitle: "Total, range and the missing value",
    formal: [
      "A value with 3 dots adds 3 times that value to the total. The range is the greatest value minus the least.",
      "If you know the total of all the values, and the total of all but one, the missing value is the first total minus the second.",
    ],
    pitfalls: [
      "Do not add each different value once. Add one value for every dot.",
      "Do not add the greatest and least for the range. Subtract them.",
      "When the fraction parts add to a whole or more, take out the whole and add it to the whole numbers.",
    ],
    parentGuide:
      "Have your learner write the list of dot values before doing any arithmetic and check that the list has as many numbers as the plot has dots.",
  }),
];

export const lineGraphReadFacetMappings: FacetMapping[] = [
  {
    templateId: "line-graph-reader",
    facetId: "coordinate-first-quadrant.core",
    extent: "partial",
    rationale:
      "Read a line graph of one quantity over days, weeks or hours or of four categories over weeks: a value, the greatest or least point, the value closest to a given number, a change, the greatest increase or decrease, and a true statement. Does not assess drawing a line graph, choosing a scale, or graphs with unequal time intervals.",
  },
  {
    templateId: "dot-plot-arithmetic",
    facetId: "fraction-plot-arithmetic.core",
    extent: "partial",
    rationale:
      "Find the total, the greatest minus the least or a missing value from a dot plot of whole-number or mixed-number measurements in halves or fourths, and, less often, of measurements in hundredths. Does not assess making a dot plot, fractions with denominators other than 2 and 4 on the mixed surface, or operations other than addition and subtraction.",
  },
];
