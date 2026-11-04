import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

const linePlotSenses = {
  "line plot": "dot-plot",
  "line plots": "dot-plot",
} as const;
const centerSenses = {
  ...linePlotSenses,
  mode: "mode-statistics",
  modes: "mode-statistics",
  median: "median",
  medians: "median",
  range: "range-statistics",
  ranges: "range-statistics",
} as const;
const tableSenses = {
  frequency: "frequency",
  frequencies: "frequency",
  interval: "interval",
  intervals: "interval",
} as const;
const barSenses = {
  scale: "scale-axis",
  scales: "scale-axis",
  "bar graph": "bar-graph",
  "bar graphs": "bar-graph",
} as const;

export const grade4DataMethods: Record<string, ProblemMethod> = {
  "line-plot-build-slots": {
    goal: "Fill in how many measurements belong at each mark of a line plot, using a list of lengths.",
    intuition:
      "A line plot puts one mark above a number line for each measurement. The list names every length. Your job is to count how many times each mark's length appears, including a mark that appears 0 times.",
    terms: ["dot-plot"],
    senses: linePlotSenses,
    method: [
      "Read the list and the marks. A length belongs at the mark that names the same length.",
      "Count the list at each mark. A mark that is missing from the list has a count of 0. The counts added together equal how many lengths are in the list.",
    ],
    watch:
      "Do not skip a mark that has no listed length. That mark still gets 0.",
  },
  "line-plot-data-match": {
    goal: "Choose the line plot whose marks match a list of lengths, including halves and other fractions.",
    intuition:
      "Each length in the list needs one mark at that length. A repeated length makes a taller stack. A graph that moves a mark, or that leaves a length out, is a different list.",
    terms: ["dot-plot"],
    senses: linePlotSenses,
    method: [
      "Count how many times each length appears in the list.",
      "The matching line plot has one mark for each listed length, at that length. Reject a graph that moves a mark or that has fewer marks than the list.",
    ],
    watch:
      "Check every stack, not only the first mark. One mark in the wrong place makes the whole graph wrong.",
  },
  "line-plot-center-range": {
    goal: "Find the mode, the median or the range of lengths shown on a line plot.",
    intuition:
      "The marks are a list of lengths. The mode is the length that appears most often. The median is the middle length when the list is in order. The range is the greatest length minus the least length.",
    terms: ["dot-plot", "mode-statistics", "median", "range-statistics"],
    senses: centerSenses,
    method: [
      "Write one length for each mark, then put those lengths in order from least to greatest.",
      "The mode is the length with the most marks. If every length has the same number of marks, there is not one mode. The median is the middle length of an odd list. The range is the greatest length minus the least length.",
    ],
    watch:
      "The greatest length is not the range. Subtract the least length from the greatest length.",
  },
  "frequency-table-grade4": {
    goal: "Build a frequency table with equal intervals, or answer a two-step question from one.",
    intuition:
      "A frequency is a count. An interval is a stretch of numbers, such as 0 to 4. Equal intervals start at 0, have the same width, and each one includes both of its end values.",
    terms: ["frequency", "interval"],
    senses: tableSenses,
    method: [
      "The intervals start at 0 and are equally wide. Each interval includes both end values, and the next interval starts one whole number later.",
      "Count how many listed numbers fall in each interval. For a two-step question, add the first two counts, then subtract the last count.",
    ],
    watch:
      "An end value belongs in its own interval. Do not put the same end value in two intervals.",
  },
  "scaled-bar-grade4": {
    goal: "Answer a two-step question from a bar graph whose side scale counts by 5, 10, 25, 50 or 100.",
    intuition:
      "A bar graph compares groups with bars. The scale, the numbers up the side, tells what each line counts as. Read a bar's height on that scale before you add or subtract.",
    terms: ["bar-graph", "scale-axis"],
    senses: barSenses,
    method: [
      "Read the scale first. Each line on the side stands for the same number of items.",
      "Read the three bars the question names. Add the first two readings, then subtract the third reading.",
    ],
    watch:
      "Add the two groups before you subtract the third. Subtracting too early changes the result.",
  },
};

export const grade4DataPrinciples: Record<string, string> = {
  "line-plot-build-slots":
    "A line plot shows one mark for each measurement. The count at a mark is how many listed lengths equal that mark. A mark with no listed length has a count of 0, and the counts of all the marks add up to the number of lengths in the list.",
  "line-plot-data-match":
    "A line plot matches a list when every listed length has one mark at that length and every mark comes from the list. Moving one mark, or leaving one length out, makes a different list.",
  "line-plot-center-range":
    "For an odd number of lengths, the median is the middle length when the lengths are ordered. The mode is the length that appears most often, and there is not one mode when every length appears equally often. The range is the greatest length minus the least length.",
  "frequency-table-grade4":
    "Equal intervals that start at 0 and share no end values cover every whole number exactly once. The frequency of an interval is how many data values fall inside it, counting both end values. How many more are in the first two intervals together than in the last is the sum of the first two frequencies minus the last frequency.",
  "scaled-bar-grade4":
    "On a scaled bar graph, a bar's value is its height read on the side scale. How many more are in two categories together than in a third is the sum of the first two bar values minus the third bar value.",
};

export const grade4DataLessons = [
  chainLesson({
    id: "line-plot-build-slots-lesson",
    title: "Building a line plot from a list",
    summary:
      "A line plot puts one mark above a number line for each measurement. Given a list of lengths, count how many belong at each mark, including a mark with a count of 0.",
    templateIds: ["line-plot-build-slots"],
    senses: linePlotSenses,
    objectives: [
      "Match each listed length to the mark that names it.",
      "Count every mark, including a mark that is not in the list.",
    ],
    openingTitle: "Each length is one mark",
    opening: [
      "A line plot is a number line with a mark for each measurement. If three lengths are 1/8 inch, the mark at 1/8 gets three marks.",
      "The number line in the problem has no marks yet. The list tells you where the marks go. A mark that never appears in the list still has a count, and that count is 0.",
    ],
    example: {
      prompt:
        "The lengths, in inches, are: 1/8, 1/8, 1/8, 2/8, 2/8, 3/8, 3/8, 3/8. The marks are 0, 1/8, 2/8 and 3/8. How many lengths belong at each mark?",
      steps: [
        "The list has 8 lengths. Group them by the mark they name.",
        "0 is not in the list, so its count is 0. 1/8 appears 3 times, 2/8 appears 2 times and 3/8 appears 3 times.",
        "Check the counts: $0 + 3 + 2 + 3 = 8$, which is every length in the list.",
      ],
      answer: "0 at 0, 3 at 1/8, 2 at 2/8 and 3 at 3/8",
    },
    methodTitle: "Count the list at each mark",
    method: [
      "Read each mark. Count how many listed lengths equal that mark.",
      "Write 0 for a mark that is missing from the list. Add the counts and check that the sum equals the number of lengths.",
    ],
    formalTitle: "The counts add up to the list",
    formal: [
      "The count at a mark is the number of listed measurements equal to that mark.",
      "Every listed length belongs at exactly one mark, so the counts add up to the length of the list.",
    ],
    pitfalls: [
      "Do not leave an empty mark blank. Its count is 0.",
      "Do not count a length at a nearby mark. 2/8 and 3/8 are different marks.",
    ],
    parentGuide:
      "Ask your learner to tally the list onto the marks, then add the tallies and compare that sum with the number of lengths.",
  }),
  chainLesson({
    id: "line-plot-data-match-lesson",
    title: "Choosing the line plot for a list",
    summary:
      "A list of lengths and several line plots are shown. The matching plot has one mark for each listed length. The other plots move a mark or leave a length out.",
    templateIds: ["line-plot-data-match"],
    senses: linePlotSenses,
    objectives: [
      "Count how many times each length appears in a list.",
      "Reject a line plot that moves one mark or leaves one length out.",
    ],
    openingTitle: "The marks and the list must be the same",
    opening: [
      "Read the list first and count each length. Then look at each line plot. A stack of two marks means that length appears twice.",
      "A wrong graph may slide one mark to a neighbor, slide it farther along the line, or drop one mark. Any of those changes the list the graph shows.",
    ],
    example: {
      prompt:
        "The lengths, in inches, are: 0, 1/2, 1/2, 1. Which line plot shows this list?",
      steps: [
        "Count the list: 0 appears once, 1/2 appears twice and 1 appears once. There are 4 lengths.",
        "The matching plot has one mark at 0, two marks at 1/2 and one mark at 1.",
        "A plot with only 3 marks has left one length out. A plot with two marks at 0 has moved a mark.",
      ],
      answer: "One mark at 0, two marks at 1/2 and one mark at 1",
    },
    methodTitle: "Count, then compare the stacks",
    method: [
      "Make a count for each length in the list.",
      "Choose the plot whose stacks match those counts and whose total number of marks equals the list.",
    ],
    formalTitle: "One mark for each measurement",
    formal: [
      "A line plot matches a list when the multiset of its marks is the multiset of the listed lengths.",
      "Moving one mark or removing one mark produces a different multiset.",
    ],
    pitfalls: [
      "Do not pick a plot just because it uses the same number line. Check the stacks.",
      "A half inch and a whole inch are different marks. Do not treat them as the same length.",
    ],
    parentGuide:
      "Have your learner say the count at one length aloud, then find that same stack on the graph before looking at the other graphs.",
  }),
  chainLesson({
    id: "line-plot-center-range-lesson",
    title: "Mode, median and range on a line plot",
    summary:
      "A line plot of lengths can be read as an ordered list. From that list you can find the mode, the median or the range.",
    templateIds: ["line-plot-center-range"],
    senses: centerSenses,
    objectives: [
      "Read every mark on a line plot as one length.",
      "Find the mode, the median of an odd list, or the range.",
    ],
    openingTitle: "The marks are the data",
    opening: [
      "Each mark is one length. Write the lengths in order before you answer.",
      "The mode is the length that appears most often. If every length appears equally often, there is not one mode. The median of an odd list is the middle length. The range is how far the greatest length is from the least: subtract.",
    ],
    example: {
      prompt:
        "A line plot has lengths 1/4, 1/4, 1/4, 1/2 and 3/4 inch. What is the mode?",
      steps: [
        "Count the marks: 1/4 appears 3 times, 1/2 appears once and 3/4 appears once.",
        "The mode is the length with the most marks. That length is 1/4 inch.",
        "The greatest length, 3/4 inch, is not the mode. It appears only once.",
      ],
      answer: "1/4 inch",
    },
    methodTitle: "Order the lengths, then answer the question",
    method: [
      "List one length per mark and put the list in order.",
      "Mode: the most frequent length, or not one mode if the counts tie. Median: the middle length. Range: greatest minus least.",
    ],
    formalTitle: "Three different questions",
    formal: [
      "The mode is about what appears most. The median is about the middle of an ordered list. The range is about spread.",
      "With an odd number of lengths, the median is one of the lengths, the one in the middle.",
    ],
    pitfalls: [
      "Do not report the greatest length when the question asks for the range. Subtract.",
      "Do not pick one length when two lengths tie for the most marks. Name both, or say there is not one mode when every length ties.",
    ],
    parentGuide:
      "Ask which question is being asked before any arithmetic. Mode, median and range start from the same marks and end at different numbers.",
  }),
  chainLesson({
    id: "frequency-table-grade4-lesson",
    title: "Frequency tables with equal intervals",
    summary:
      "Sort numbers into equal intervals that start at 0, or use a finished frequency table to compare the first two intervals with the last.",
    templateIds: ["frequency-table-grade4"],
    senses: tableSenses,
    objectives: [
      "Count data in equal intervals that include both end values.",
      "Add the first two frequencies and subtract the last frequency.",
    ],
    openingTitle: "Intervals meet but do not share an end",
    opening: [
      "An interval such as 0 to 4 includes 0, 1, 2, 3 and 4. The next interval of the same width starts at 5, not at 4. Each number belongs in one interval.",
      "A frequency is the count for one interval. A two-step question asks how many more are in the first two intervals together than in the last: add, then subtract.",
    ],
    example: {
      prompt:
        "0 to 4 has 8 scores. 5 to 9 has 6 scores. 10 to 14 has 5 scores. 15 to 19 has 4 scores. How many more scores are in the first two intervals together than in the last interval?",
      steps: [
        "The first two intervals hold $8 + 6 = 14$ scores.",
        "The last interval holds 4 scores. Subtract: $14 - 4 = 10$.",
        "The difference is 10 scores. Adding the last interval instead of subtracting it would give 18, which is too many.",
      ],
      answer: "10 scores",
    },
    methodTitle: "Count inside both ends, then compare",
    method: [
      "For a list, put each number in the interval that contains it, including both end values.",
      "For a two-step question, add the first two frequencies and subtract the last frequency.",
    ],
    formalTitle: "No shared endpoints",
    formal: [
      "Intervals of a chosen width, starting at 0, run from 0 up to one less than that width. The next interval starts at the width itself and ends one less than twice the width.",
      "The comparison of the first two intervals with the last is their combined frequency minus the last frequency.",
    ],
    pitfalls: [
      "Do not drop an end value. 4 belongs in 0 to 4, and 5 belongs in the next interval.",
      "Do not stop after adding the first two counts. The question also subtracts the last count.",
    ],
    parentGuide:
      "Have your learner point to both ends of the first interval and say whether each end is included before counting.",
  }),
  chainLesson({
    id: "scaled-bar-grade4-lesson",
    title: "Two-step questions on a scaled bar graph",
    summary:
      "Read three bars on a graph whose side scale counts by 5, 10, 25, 50 or 100. Add two of the readings and subtract the third.",
    templateIds: ["scaled-bar-grade4"],
    senses: barSenses,
    objectives: [
      "Read a bar's value from a scale that counts by more than 1.",
      "Add two bar values and subtract a third.",
    ],
    openingTitle: "Read the scale before the bars",
    opening: [
      "The numbers up the side are the scale. If each line counts as 25, a bar that reaches the line labeled 100 has a value of 100.",
      "The question names three categories. Read those three bars, add the first two values, and subtract the third.",
    ],
    example: {
      prompt:
        "A bar graph of books counts by 25. Oak shows 100, Pine shows 75, Maple shows 25 and Birch shows 50. How many more books are in Oak and Pine together than in Maple?",
      steps: [
        "Oak and Pine together are $100 + 75 = 175$ books.",
        "Subtract Maple: $175 - 25 = 150$.",
        "Birch is on the graph but the question does not use it. The difference is 150 books.",
      ],
      answer: "150 books",
    },
    methodTitle: "Scale, then add, then subtract",
    method: [
      "Use the side scale to read each bar the question names.",
      "Add the first two readings. Subtract the third reading from that sum.",
    ],
    formalTitle: "A two-step comparison",
    formal: [
      "How many more are in the first two categories together than in the third is the first value plus the second value, minus the third value.",
      "The scale tells you those three values. The scale's step is not the answer by itself.",
    ],
    pitfalls: [
      "Do not read a bar as if every line counted as 1. Use the scale printed on the side.",
      "Do not subtract before you add the two groups the question joins.",
    ],
    parentGuide:
      "Ask your learner to say what one line on the side counts as, then read the three bars aloud before doing the arithmetic.",
  }),
];

export const grade4DataFacetMappings: FacetMapping[] = [
  {
    templateId: "line-plot-build-slots",
    facetId: "fraction-plot-arithmetic.build-match-center",
    extent: "partial",
    rationale:
      "Count listed lengths at each mark of a blank line plot, including an empty mark and a repeated length. Lengths are halves, fourths, or eighths of an inch, from 1 to 4 inches. Does not assess collecting the measurements, denominator 100, or a plot that is already marked.",
  },
  {
    templateId: "line-plot-data-match",
    facetId: "fraction-plot-arithmetic.build-match-center",
    extent: "partial",
    rationale:
      "Choose the line plot that matches a list of lengths. The other graphs move one mark by one tick, move one mark farther, or leave one length out. Does not assess drawing a plot, collecting data, or denominator 100.",
  },
  {
    templateId: "line-plot-center-range",
    facetId: "fraction-plot-arithmetic.build-match-center",
    extent: "partial",
    rationale:
      "Find the mode, the median or the range of an odd number of lengths in halves, fourths or eighths. Does not assess an even number of lengths, so the median is always one of the lengths, or denominators other than 2, 4 and 8.",
  },
  {
    templateId: "frequency-table-grade4",
    facetId: "frequency-bar-graphs.tables-and-scaled-bars",
    extent: "partial",
    rationale:
      "Sort numbers into four intervals of width 5, 10, 25, 50 or 100, or find how many more are in the first two intervals together than in the last. Does not assess collecting data or stem-and-leaf plots.",
  },
  {
    templateId: "scaled-bar-grade4",
    facetId: "frequency-bar-graphs.tables-and-scaled-bars",
    extent: "partial",
    rationale:
      "Read a bar graph scaled by 5, 10, 25, 50 or 100 and find how many more are in two categories together than in a third. Does not assess choosing a scale, drawing the graph, or collecting the data.",
  },
];
