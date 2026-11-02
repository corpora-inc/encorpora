import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

export const lineGraphReadMethods: Record<string, ProblemMethod> = {
  "line-graph-reader": {
    goal: "Read values, greatest and least points, changes and comparisons from a line graph.",
    intuition:
      "A line graph is a list of values in order. Each point stands for one measurement: its place along the bottom names the day or week, and its height tells the amount. The line joins neighboring points so you can see whether the amount went up or down.",
    terms: [
      "scale-axis",
      [
        "change",
        "Here it is the later value minus the earlier value: positive for an increase, negative for a decrease.",
      ],
    ],
    method: [
      "Check what the vertical scale counts by, then read the height of each point you need against it.",
      "Write the values you read as a list. A question about the greatest, least or closest value is answered from this list.",
      "For a change, subtract the earlier value from the later one. For the greatest increase or decrease, find the change for every pair of neighboring points and compare them.",
    ],
    watch:
      "The highest point is not where the line rises the most. A big rise can begin from a low point and end below the maximum.",
  },
  "dot-plot-arithmetic": {
    goal: "Use every dot of a dot plot to find a total, a range or a missing value.",
    intuition:
      "Each dot is one measurement. A stack of three dots over 4 means three measurements of 4, so it adds 4 three times. Reading the plot gives a list of numbers, and the question is ordinary arithmetic on that list.",
    terms: ["range-statistics", "mixed-number"],
    method: [
      "Read every dot and write the list of values, counting a stack of dots once for each dot.",
      "For the total, add them all. For the range, subtract the least from the greatest. For a missing value, subtract the total of the dots from the given total.",
      "With mixed numbers, add or subtract the fraction parts on a common denominator and carry whole numbers.",
    ],
    watch:
      "Do not add each different value only once. A value with two dots is added twice.",
  },
};

export const lineGraphReadPrinciples: Record<string, string> = {
  "line-graph-reader":
    "A line graph of a quantity against time pairs each time with one value. The value at a time is the height of its point on the vertical scale. The change from time $a$ to time $b$ is $y_b - y_a$: positive means an increase, negative a decrease, and the greatest increase is the largest positive change between consecutive times. The greatest value is the highest point; the line rising steeply does not make a point the highest.",
  "dot-plot-arithmetic":
    "A dot plot shows a data set with one dot per value. If a value $v$ has $k$ dots, it contributes $k \\times v$ to the total. The range is the greatest value minus the least value. If the total of $n + 1$ values is $T$ and $n$ of them sum to $S$, the remaining value is $T - S$.",
};

export const lineGraphReadLessons = [
  chainLesson({
    id: "line-graph-reader-lesson",
    title: "Reading a line graph",
    summary:
      "Read heights against the scale, then find greatest, least, change and increases between points.",
    templateIds: ["line-graph-reader"],
    objectives: [
      "Read the value of a point against the vertical scale.",
      "Find the greatest and least values, and a change between two points.",
    ],
    openingTitle: "Each point is one measurement",
    opening: [
      "A line graph shows how an amount changes over days, weeks or hours. Each point sits above a day and at a height that tells the amount on that day.",
      "Before reading a height, check what the gridlines count by. If they count by 5, a point halfway between 20 and 30 is at 25, not 24 or 26.",
    ],
    example: {
      prompt:
        "A graph shows temperatures 40, 45, 58, 50 and 60 on Days 1 to 5. Between which two consecutive days did the temperature increase the most?",
      steps: [
        "Find each change by subtracting the earlier value: Day 1 to 2 is $45 - 40 = 5$; Day 2 to 3 is $58 - 45 = 13$; Day 3 to 4 is $50 - 58 = -8$; Day 4 to 5 is $60 - 50 = 10$.",
        "The greatest increase is the largest positive change, 13, from Day 2 to Day 3.",
        "Day 5 has the highest temperature, 60, but the rise into it is only 10.",
      ],
      answer: "Day 2 to Day 3",
    },
    methodTitle: "Make a list of values, then compare",
    method: [
      "Read each needed point against the vertical scale and write the values down in order.",
      "Greatest and least: the largest and smallest on the list. Closest to a number: find each value's distance from that number and take the smallest.",
      "Change: later value minus earlier value. Greatest increase: the largest positive change between neighbors; greatest decrease: the most negative.",
    ],
    formalTitle: "Change between two points",
    formal: [
      "The change from time $a$ to time $b$ is $y_b - y_a$. It is positive for an increase and negative for a decrease. The greatest value need not follow the greatest increase.",
    ],
    pitfalls: [
      "Reading a height one gridline off because the scale does not count by 1.",
      "Choosing the highest point when asked for the greatest increase. The greatest increase is a change between two points.",
      "Reversing the direction of a change. Subtract the earlier value from the later one.",
    ],
    parentGuide:
      "Ask your learner to say the scale first, then read two points aloud and subtract before choosing an answer.",
  }),
  chainLesson({
    id: "dot-plot-arithmetic-lesson",
    title: "Arithmetic from a dot plot",
    summary:
      "Read every dot, then add, subtract or find a missing value including mixed numbers.",
    templateIds: ["dot-plot-arithmetic"],
    objectives: [
      "List the values of a dot plot, counting every dot.",
      "Find a total, a range or a missing value, with whole or mixed numbers.",
    ],
    openingTitle: "One dot is one measurement",
    opening: [
      "A dot plot puts one dot for each measurement above a number line. If three dots stand over 4, three measurements were 4.",
      "That means the plot is a list in disguise. Write the list from left to right and the question becomes arithmetic on it.",
    ],
    example: {
      prompt:
        "A dot plot has dots at 2, 3, 3, 5 and 5 miles. What is the total number of miles?",
      steps: [
        "Count every dot: the values are 2, 3, 3, 5, 5.",
        "Add them all: $2 + 3 + 3 + 5 + 5 = 18$.",
        "Adding 2, 3 and 5 once each would give 10, which leaves out two dots.",
      ],
      answer: "18 miles",
    },
    methodTitle: "List, then calculate",
    method: [
      "Write the value of each dot, repeating a value for each dot over it.",
      "Total: add the list. Range: greatest minus least. Missing value: given total minus the total of the dots.",
      "For mixed numbers, add fractions with a common denominator, then add the whole numbers.",
    ],
    formalTitle: "Total, range and the missing value",
    formal: [
      "If value $v$ has $k$ dots it contributes $kv$. The range is the greatest value minus the least. If $T$ is the total of $n + 1$ values and $S$ the sum of $n$ of them, the last is $T - S$.",
    ],
    pitfalls: [
      "Adding each different value once. Add one value for every dot.",
      "Adding the greatest and least for the range. Subtract them.",
      "Forgetting to carry when fractions add to more than one whole.",
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
      "Find the total, the greatest minus the least or a missing value from a dot plot of whole-number or mixed-number measurements in halves or fourths. Does not assess making a dot plot, fractions with denominators other than 2 and 4, or operations other than addition and subtraction.",
  },
];
