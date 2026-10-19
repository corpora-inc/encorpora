import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

export const distributionLessons: Lesson[] = [
  {
    id: "statistical-questions",
    title: "Statistical questions",
    summary:
      "A statistical question expects many answers that vary; statistics describes that variation.",
    templateIds: ["statistical-question-choice"],
    objectives: [
      "Distinguish a question with one answer from one that collects varying data.",
      "Name the group and the varying quantity a statistical question asks about.",
    ],
    sections: [
      {
        title: "One answer, or many?",
        paragraphs: [
          "“How tall is the sunflower by the gate?” has one answer: measure that sunflower once. “How tall are the sunflowers in our garden?” asks for a height from every sunflower, and the heights differ.",
          "A statistical question anticipates that variability. Its answer is a distribution of values, which we then describe with a center and a spread.",
        ],
      },
      {
        title: "Counts and facts are single answers",
        paragraphs: [
          "“How many sunflowers are in our garden?” collects one number for the whole garden, so it is not statistical even though it involves many sunflowers.",
          "Test a question by imagining collecting the answer: if you would record many numbers that differ, the question is statistical.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Which is statistical: “How much does my dog weigh?” or “How much do the dogs at the shelter weigh?”",
      steps: [
        "The first asks for one weight of one dog: a single answer.",
        "The second asks for a weight from each dog, and the weights vary.",
      ],
      answer: "How much do the dogs at the shelter weigh?",
    },
    pitfalls: [
      "A question about a group can still have one answer, such as how many members it has.",
      "Variability means the collected answers differ, not that the question is hard.",
    ],
    parentGuide:
      "Take turns writing a question about your family, then decide together whether answering it would give one number or many different numbers.",
  },
  {
    id: "mean-median",
    title: "The mean as a balance point",
    summary:
      "The mean is the fair share and the balance point: total divided by count.",
    templateIds: ["dot-plot-mean", "mean-missing-value"],
    objectives: [
      "Find the exact mean of data shown in a dot plot.",
      "Use a mean and the count to recover the total and a missing value.",
    ],
    sections: [
      {
        title: "Total divided by count",
        paragraphs: [
          "A team scored 1, 2, 2, 3 and 7 goals. The total is 15 goals in 5 games, so the mean is 15 ÷ 5 = 3 goals per game: the amount each game would have if the goals were shared equally.",
          "On a dot plot, count a stack of two dots as two values: 2 × 2 adds 4, not 2.",
        ],
        illustration: "data-dot-plot-goals",
      },
      {
        title: "Why it balances",
        paragraphs: [
          "The distances below 3 are 2, 1 and 1, a total of 4. The distance above 3 is 4. Equal totals on each side mean the dots would balance on a pivot at 3.",
          "Because mean × count = total, a known mean gives the total. If 5 scores average 80, they add to 400; subtracting the four known scores leaves the fifth.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "The mean of 5 quiz scores is 80. Four of the scores are 72, 85, 90 and 76. What is the other score?",
      steps: [
        "Total of all 5 scores: 5 × 80 = 400.",
        "Known scores: 72 + 85 + 90 + 76 = 323.",
        "Other score: 400 − 323 = 77.",
      ],
      answer: "77",
    },
    pitfalls: [
      "Divide by the number of values, not by the number of different values.",
      "The mean need not be one of the data values, or a whole number.",
    ],
    parentGuide:
      "Stack coins in piles of different heights, then move coins between piles until all piles are equal. The common height is the mean.",
  },
  {
    id: "distribution-plots",
    title: "Histograms and box plots",
    summary:
      "A histogram counts values in equal intervals; a box plot shows five summary numbers.",
    templateIds: ["histogram-read", "box-plot-read"],
    objectives: [
      "Count values in one or several intervals of a histogram.",
      "Read the median, range and interquartile range from a box plot, and the quarters of data it marks.",
    ],
    sections: [
      {
        title: "Histograms group values into intervals",
        paragraphs: [
          "Each bar covers an equal interval, from its left edge up to, but not including, its right edge. The bar from 20 to 30 counts students who read 20 to 29 minutes: here, 8 students.",
          "“At least 30 minutes” uses every bar that starts at 30 or later: 6 + 3 = 9 students. A histogram does not show individual values, only how many fall in each interval.",
        ],
        illustration: "data-histogram-reading",
      },
      {
        title: "Box plots mark quarters",
        paragraphs: [
          "The whiskers end at the minimum (50) and maximum (95). The box runs from the lower quartile (65) to the upper quartile (85), and the line inside it is the median (75).",
          "These five numbers split the ordered data into four parts with about a quarter of the data each. So about 25% of the scores are above 85, and the box holds about the middle 50%.",
        ],
        illustration: "data-box-plot-scores",
      },
    ],
    workedExample: {
      prompt:
        "A box plot has minimum 50, lower quartile 65, median 75, upper quartile 85 and maximum 95. What is the interquartile range?",
      steps: [
        "The interquartile range is the length of the box: upper quartile − lower quartile.",
        "85 − 65 = 20.",
      ],
      answer: "20",
    },
    pitfalls: [
      "A longer section of a box plot means the values are more spread out, not that it holds more data.",
      "In a histogram, a value on a bin edge belongs to the bar on its right.",
    ],
    parentGuide:
      "Time how many minutes each family member reads for a week. Group the times in 10-minute intervals and draw a bar for each interval.",
  },
  {
    id: "variability",
    title: "Measuring spread",
    summary:
      "Spread is how far values typically lie from the center: MAD around the mean, IQR around the median.",
    templateIds: ["dot-plot-mad", "dot-plot-iqr", "typical-value-choice"],
    objectives: [
      "Find the mean absolute deviation and the interquartile range of dot-plot data.",
      "Choose the median over the mean when one value lies far from the rest.",
    ],
    sections: [
      {
        title: "Mean absolute deviation",
        paragraphs: [
          "For 1, 2, 2, 3 and 7 the mean is 3. The distances from 3 are 2, 1, 1, 0 and 4. Their mean is 8 ÷ 5 = 1.6: values lie 1.6 goals from the mean on average.",
          "Distances are never negative. A larger MAD means the data are more spread out around the mean.",
        ],
        illustration: "data-dot-plot-goals",
      },
      {
        title: "Interquartile range and outliers",
        paragraphs: [
          "Leave out the median 2 of 1, 2, 2, 3, 7. The lower half 1, 2 has median 1.5; the upper half 3, 7 has median 5. The IQR is 5 − 1.5 = 3.5, the width of the middle half of the data.",
          "Here one student read 12 books and the rest read 1 to 4. The mean, 30 ÷ 8 = 3.75, is greater than 7 of the 8 values. The median, 3, stays among the typical values, so it describes a typical student better.",
        ],
        illustration: "data-dot-plot-outlier",
      },
    ],
    workedExample: {
      prompt: "Find the mean absolute deviation of 4, 6, 6, 7, 12.",
      steps: [
        "Mean: (4 + 6 + 6 + 7 + 12) ÷ 5 = 35 ÷ 5 = 7.",
        "Distances from 7: 3, 1, 1, 0, 5.",
        "MAD: (3 + 1 + 1 + 0 + 5) ÷ 5 = 10 ÷ 5 = 2.",
      ],
      answer: "2",
    },
    pitfalls: [
      "Use distances (always positive) for MAD; signed differences from the mean always add to zero.",
      "An extreme value moves the mean and the range much more than the median and the IQR.",
    ],
    parentGuide:
      "Write the ages of five relatives, find their mean, and measure each age’s distance from it. Then add a very old or very young relative and see which summaries change most.",
  },
];

export const distributionMethods: Record<string, ProblemMethod> = {
  "statistical-question-choice": {
    goal: "Choose the question whose answers would vary across a group.",
    terms: [
      [
        "statistical question",
        "A question answered by data that are expected to vary.",
      ],
    ],
    method: [
      "Imagine collecting the answer to each question.",
      "Choose the one that gives many different values, one from each member of a group.",
    ],
    watch:
      "A count of a group, such as how many members it has, is one answer.",
  },
  "dot-plot-mean": {
    goal: "Find the exact mean of the values in a dot plot.",
    terms: [["mean", "The total of the values divided by how many there are."]],
    method: [
      "Multiply each value by the number of dots above it, and add.",
      "Divide the total by the number of dots.",
    ],
    watch: "A stack of dots is several values, not one.",
  },
  "mean-missing-value": {
    goal: "Find the missing value from a mean, the count and the other values.",
    method: [
      "Total of all values = mean × count.",
      "Subtract the known values from the total.",
    ],
    watch: "Multiply the mean by the full count, including the missing value.",
  },
  "histogram-read": {
    goal: "Count values in one or more intervals of a histogram.",
    terms: [
      [
        "interval",
        "A bar’s range, from its left edge up to but not including its right edge.",
      ],
    ],
    method: [
      "Find the bars the question covers: “at least” starts at a bar’s left edge, “fewer than” stops at one.",
      "Read each bar’s height on the count scale and add.",
    ],
    watch: "A value on an edge belongs to the bar on its right.",
  },
  "box-plot-read": {
    goal: "Read a summary or a share of the data from a box plot.",
    terms: [
      ["quartiles", "The ends of the box: Q1 on the left, Q3 on the right."],
      ["interquartile range", "Q3 − Q1, the length of the box."],
    ],
    method: [
      "Read the five numbers: whisker ends, box ends and the median line.",
      "Subtract for a range or IQR; each of the four sections holds about 25% of the data.",
    ],
    watch: "A long section means spread-out values, not more values.",
  },
  "dot-plot-mad": {
    goal: "Find the mean absolute deviation of dot-plot data.",
    terms: [
      [
        "mean absolute deviation",
        "The mean of the distances of the values from their mean.",
      ],
    ],
    method: [
      "Find the mean.",
      "Find each value’s distance from the mean.",
      "Add the distances and divide by the number of values.",
    ],
    watch: "Use distances, never negative differences.",
  },
  "dot-plot-iqr": {
    goal: "Find the interquartile range of dot-plot data.",
    method: [
      "Read the values in order, left to right.",
      "Split them into halves, leaving out the middle value when the count is odd.",
      "Find each half’s median (Q1 and Q3) and subtract: Q3 − Q1.",
    ],
    watch: "Average the two middle values when a half has an even count.",
  },
  "typical-value-choice": {
    goal: "Choose the summary that describes a typical value when one value lies far from the rest.",
    method: [
      "Find the value far from the others.",
      "Choose the median: it depends on the middle of the ordered data, not on how extreme that value is.",
    ],
    watch: "The mean is pulled toward a far-off value.",
  },
};
export const distributionPrinciples: Record<string, string> = {
  "statistical-question-choice":
    "A question is statistical when answering it produces data that vary.",
  "dot-plot-mean":
    "The mean is the total divided by the count; it is the balance point of the data.",
  "mean-missing-value":
    "Mean × count = total, so a known mean fixes the total and therefore any one missing value.",
  "histogram-read":
    "A histogram bar’s height is the number of values in its interval.",
  "box-plot-read":
    "The minimum, Q1, median, Q3 and maximum split ordered data into four parts with about a quarter of the values each.",
  "dot-plot-mad":
    "The mean absolute deviation is the average distance of the values from their mean.",
  "dot-plot-iqr":
    "The interquartile range Q3 − Q1 is the width of the middle half of the ordered data.",
  "typical-value-choice":
    "An extreme value pulls the mean toward it but barely moves the median, so the median better describes typical values then.",
};
