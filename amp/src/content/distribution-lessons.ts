import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

export const distributionLessons: Lesson[] = [
  {
    id: "statistical-questions",
    title: "Statistical questions",
    summary:
      "Data are facts or numbers you collect by counting, measuring or asking. Some questions have one answer, like how tall one sunflower is. A statistical question asks about a group and expects answers that differ from one member to the next, like how tall the sunflowers in a garden are. Answering it means collecting many answers that vary.",
    templateIds: ["statistical-question-choice"],
    senses: { whole: "whole" },
    noLink: ["center", "multiple", "mean"],
    objectives: [
      "Tell a question with one answer from a question that collects many different answers.",
      "Name the group and the changing amount that a statistical question asks about.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Expect different answers",
        paragraphs: [
          "Ask how tall one sunflower is, and you need one measurement. Ask how tall the sunflowers in a garden are, and you collect a height from every sunflower. Those heights are not all the same.",
          "When answers differ from one member of a group to the next, we say they vary. How much they differ is called variability. Statistics is the math of describing answers that vary.",
          "A statistical question is a question you answer by collecting data that you expect to vary.",
        ],
      },
      {
        title: "One answer, or many?",
        paragraphs: [
          "“How tall is the sunflower by the gate?” has one answer. You measure that one sunflower once.",
          "“How tall are the sunflowers in our garden?” asks for a height from every sunflower, and the heights differ. That makes it a statistical question.",
          "All the collected answers together are called a distribution: which values came up and how often. We can then describe it by a typical value and by how spread out the values are.",
        ],
      },
      {
        title: "Counts and facts are single answers",
        paragraphs: [
          "“How many sunflowers are in our garden?” involves many sunflowers. But you collect only one number, the count for the whole garden. So it is not a statistical question.",
          "Test a question by imagining you collect the answer. If you would write down many answers that can differ, the question is statistical. If you would write down one answer, it is not.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Questions that produce varying data",
        paragraphs: [
          "A statistical question expects many observations (collected answers) that may differ. Those observations form a distribution. Its center (a typical value), its spread and its shape can answer the question.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Which is statistical: “How much does my dog weigh?” or “How much do the dogs at the shelter weigh?”",
      steps: [
        "Imagine answering the first question. You weigh one dog once and write down one number. That is a single answer.",
        "Imagine answering the second question. You weigh every dog at the shelter and write down a weight for each. The weights differ from dog to dog.",
        "The second question collects many answers that vary, so it is the statistical question.",
      ],
      answer: "How much do the dogs at the shelter weigh?",
    },
    pitfalls: [
      "A question about a group can still have one answer. “How many dogs are at the shelter?” gives one count.",
      "Vary means the collected answers differ. It does not mean the question is hard.",
    ],
    parentGuide:
      "Take turns writing a question about your family. Decide together whether answering it gives one number or many different numbers.",
  },
  {
    id: "mean-median",
    title: "The mean as a balance point",
    summary:
      "The mean is a fair share. Add all the values to get the total, then divide by how many values there are. For 1, 2, 2, 3 and 7 goals, the total is 15 and there are 5 values, so the mean is 3. The median is different: it is the middle value once the values are in order.",
    templateIds: ["dot-plot-mean", "mean-missing-value"],
    senses: {
      mean: "mean-average",
      average: "mean-average",
      balance: "balance-scale",
      changes: "change",
    },
    noLink: ["center", "side", "leaves"],
    objectives: [
      "Find the exact mean of data shown in a dot plot.",
      "Use a mean and the number of values to find the total, then a missing value.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Share fairly or find the middle",
        paragraphs: [
          "A team plays 5 games. Pretend you could move goals from game to game until every game had the same number. That equal amount is called the mean. People also call it the average.",
          "Or line up the 5 scores from least to greatest and take the one in the middle. That middle value is called the median.",
          "Both the mean and the median give a typical value for the data, in different ways.",
          "A dot plot is a number line with one dot above it for each value, so you can see every value at once. Two dots stacked above 2 mean the value 2 appears twice.",
        ],
      },
      {
        title: "Total divided by count",
        paragraphs: [
          "A team scored 1, 2, 2, 3 and 7 goals. The total is $1 + 2 + 2 + 3 + 7 = 15$ goals in 5 games. So the mean is $15 \\div 5 = 3$ goals per game. That is the amount each game would have if the goals were shared equally.",
          "On a dot plot, count a stack of two dots as two values. Two dots above 2 add $2 \\times 2 = 4$ to the total, not 2.",
        ],
        illustration: "data-dot-plot-goals",
      },
      {
        title: "Why it balances",
        paragraphs: [
          "Look at how far each value is from the mean, 3. The values below 3 are 1, 2 and 2. They are 2, 1 and 1 away, which adds to 4. The value above 3 is 7, which is 4 away.",
          "The distances below and above are equal, 4 and 4. So the dots would balance on a pivot at 3, like a seesaw. That is why the mean is called the balance point.",
          "Since mean = total ÷ count, it follows that mean × count = total. So a known mean gives the total. If 5 scores have a mean of 80, they add to $5 \\times 80 = 400$. Subtract the four known scores from 400 to find the fifth.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Two measures of center",
        paragraphs: [
          "Take $n$ number values, with $n$ greater than 0. The mean is their sum divided by $n$. The median is the middle value once they are in order. When $n$ is even there are two middle values, and the median is their mean.",
          "A very large or very small value changes the mean directly. It does not have to move the median.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "The mean of 5 quiz scores is 80. Four of the scores are 72, 85, 90 and 76. What is the other score?",
      steps: [
        "Mean × count = total, so the total of all 5 scores is $5 \\times 80 = 400$.",
        "Add the four scores you know: $72 + 85 + 90 + 76 = 323$.",
        "The missing score is what is left of the total: $400 - 323 = 77$.",
        "Check: $323 + 77 = 400$, and $400 \\div 5 = 80$. The mean comes out right.",
      ],
      answer: "77",
    },
    pitfalls: [
      "Divide by the number of values, counting repeats. 2, 2, 3 is three values, not two.",
      "The mean does not have to be one of the data values or a whole number.",
    ],
    parentGuide:
      "Stack 9 coins in piles of 1, 2 and 6. Move coins between piles until all three are the same height. That height, 3, is the mean.",
  },
  {
    id: "distribution-plots",
    title: "Histograms and box plots",
    summary:
      "Data are numbers or facts someone collected, such as test scores. A histogram is a bar graph for number data. Each bar covers a stretch of numbers, called an interval. How tall the bar is shows how many values fall in that stretch. A box plot draws five numbers: the least value, the greatest value, the median (middle value) and the middle of each half, called the quartiles. These five numbers split the data into four parts of about equal size.",
    templateIds: ["histogram-read", "box-plot-read"],
    senses: {
      interval: "interval",
      intervals: "interval",
      range: "range-statistics",
      quarter: "fourth",
      quarters: "fourth",
      parts: "part",
    },
    noLink: ["edge", "rule"],
    objectives: [
      "Count the values in one or several intervals of a histogram.",
      "Read the median, the range and the interquartile range from a box plot, and the quarters of the data it marks.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Choose what the picture should show",
        paragraphs: [
          "An interval is a stretch of numbers, such as all the numbers from 20 up to 30. A histogram shows how many values fall into each interval. How tall a bar is shows that count.",
          "A box plot shows five numbers. The least value is called the minimum, and the greatest is the maximum. The median is the middle value once the data are in order.",
          "The median splits the data into a lower half and an upper half. The middle of the lower half is the lower quartile. The middle of the upper half is the upper quartile.",
          "The range is the maximum minus the minimum. The interquartile range is the upper quartile minus the lower quartile. It is the width of the middle half of the data.",
        ],
      },
      {
        title: "Histograms group values into intervals",
        paragraphs: [
          "Each bar covers an equal interval. It starts at the number on its left and goes up to, but not including, the number on its right. The bar from 20 to 30 counts students who read from 20 minutes up to, but not including, 30 minutes. Here that is 8 students.",
          "“At least 30 minutes” means 30 minutes or more. It uses every bar that starts at 30 or later: $6 + 3 = 9$ students.",
          "A histogram does not show the single values. It shows only how many fall in each interval.",
        ],
        illustration: "data-histogram-reading",
      },
      {
        title: "Box plots mark quarters",
        paragraphs: [
          "The lines out from the box are called whiskers. They end at the minimum (50) and the maximum (95). The box runs from the lower quartile (65) to the upper quartile (85). The line inside the box is the median (75).",
          "These five numbers split the ordered data into four parts. Each part holds about a quarter of the data, which is 25%. So roughly 25% of the scores are at or above 85, and the box holds roughly the middle 50%.",
        ],
        illustration: "data-box-plot-scores",
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Frequency and summaries",
        paragraphs: [
          "A histogram counts the values in number intervals that do not overlap. A box plot marks the minimum, lower quartile, median, upper quartile and maximum. The quartiles follow a stated rule: here, the median of each half.",
          "Both graphs show the same data, but each keeps different details.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A box plot has minimum 50, lower quartile 65, median 75, upper quartile 85 and maximum 95. What is the interquartile range?",
      steps: [
        "The interquartile range is the width of the box. So subtract the lower quartile from the upper quartile.",
        "The upper quartile is 85 and the lower quartile is 65: $85 - 65 = 20$.",
      ],
      answer: "20",
    },
    pitfalls: [
      "A longer part of a box plot means those values are more spread out. It does not hold more values: each part holds about a quarter.",
      "In a histogram, a value that falls exactly where two bars meet belongs to the bar on its right.",
    ],
    parentGuide:
      "Time how many minutes each family member reads for a week. Group the times in 10-minute intervals and draw a bar for each interval.",
  },
  {
    id: "variability",
    title: "Measuring spread",
    summary:
      "Spread tells how far the data values are from each other. Two groups can have the same mean (the fair share) but very different spreads. One measure of spread is the mean absolute deviation: the average distance of the values from the mean. Another is the interquartile range: the width of the middle half of the data.",
    templateIds: ["dot-plot-mad", "dot-plot-iqr", "typical-value-choice"],
    senses: {
      mean: "mean-average",
      average: "mean-average",
      averages: "mean-average",
      range: "range-statistics",
      differences: "difference-subtract",
      change: "change",
      "more than": "more-than",
    },
    noLink: ["center", "boundaries", "rule"],
    objectives: [
      "Find the mean absolute deviation and the interquartile range of data in a dot plot.",
      "Choose the median over the mean when one value is far from the rest.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "A center does not tell the whole story",
        paragraphs: [
          "The scores 5, 5, 5 and 1, 5, 9 both have a mean of 5. The mean is the total divided by the number of values. But the second group is much more spread out.",
          "The distance of a value from the mean is how far it is, ignoring whether it is above or below. A distance is never negative.",
          "The mean absolute deviation, or MAD, is the mean of those distances. It tells how far a value is from the mean on average.",
        ],
      },
      {
        title: "Mean absolute deviation",
        paragraphs: [
          "For 1, 2, 2, 3 and 7, the mean is $15 \\div 5 = 3$. The distances from 3 are 2, 1, 1, 0 and 4.",
          "Their mean is $8 \\div 5 = 1.6$. So the values are 1.6 goals from the mean, on average.",
          "A larger MAD means the data are more spread out around the mean.",
        ],
        illustration: "data-dot-plot-goals",
      },
      {
        title: "Interquartile range and outliers",
        paragraphs: [
          "Put the values in order: 1, 2, 2, 3, 7. The median, the middle value, is 2. Leave it out to make two halves.",
          "The lower half is 1, 2, and its middle is $(1 + 2) \\div 2 = 1.5$. That is the lower quartile, written Q1. The upper half is 3, 7, and its middle is $(3 + 7) \\div 2 = 5$. That is the upper quartile, written Q3.",
          "The interquartile range, or IQR, is $Q3 - Q1 = 5 - 1.5 = 3.5$. It is the width of the middle half of the data. The range is the greatest value minus the least value, here $7 - 1 = 6$.",
          "An outlier is a value far from the rest. Here one student read 12 books and the others read 1 to 4. The mean is $30 \\div 8 = 3.75$, greater than 7 of the 8 values. The median, 3, stays among the typical values. So the median describes a typical student better.",
        ],
        illustration: "data-dot-plot-outlier",
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Distances from the center",
        paragraphs: [
          "For a data set with one or more values, the mean absolute deviation is the mean of the distances from the mean. The interquartile range is the upper quartile minus the lower quartile, using a stated rule for the quartiles.",
          "Both measure spread. The MAD uses every value. The IQR uses only the two ends of the middle half.",
        ],
      },
    ],
    workedExample: {
      prompt: "Find the mean absolute deviation of 4, 6, 6, 7, 12.",
      steps: [
        "Find the mean first, because the distances are measured from it: $(4 + 6 + 6 + 7 + 12) \\div 5 = 35 \\div 5 = 7$.",
        "Find each value's distance from 7, ignoring above or below: 3, 1, 1, 0 and 5.",
        "Take the mean of the distances: $(3 + 1 + 1 + 0 + 5) \\div 5 = 10 \\div 5 = 2$.",
      ],
      answer: "2",
    },
    pitfalls: [
      "Use distances, which are never negative. The differences value minus mean, with their signs, always add to 0, so they cannot measure spread.",
      "One far value usually moves the mean and the range much more than the median and the IQR.",
    ],
    parentGuide:
      "Write the ages of five relatives. Find their mean and each age’s distance from it. Then add a much older or much younger relative and see which summaries change most.",
  },
];

export const distributionMethods: Record<string, ProblemMethod> = {
  "statistical-question-choice": {
    goal: "Choose the question whose answers would vary across a group.",
    noLink: ["multiple", "center"],
    intuition:
      "A statistical question is one you answer by collecting data, facts or numbers, that you expect to vary, meaning they differ from one member of a group to the next. “How tall is this sunflower?” has one answer. “How tall are the sunflowers in our garden?” collects many measurements that differ.",
    terms: ["statistical-question"],
    method: [
      "Imagine collecting the answer to each question.",
      "Choose the question whose answers come from many members of a group and could differ.",
    ],
    watch:
      "A count of a group, such as how many members it has, is one answer.",
  },
  "dot-plot-mean": {
    goal: "Find the exact mean of the values in a dot plot.",
    senses: { mean: "mean-average", balance: "balance-scale" },
    intuition:
      "A dot plot puts one dot above a number line for each value. Three dots above 7 show that the value 7 appears three times. The mean is the fair share: add all the values to get the total, then divide by how many values there are.",
    terms: ["mean-average"],
    method: [
      "Multiply each value by the number of dots above it. Add the results to get the total.",
      "Divide the total by the number of dots.",
    ],
    watch: "Count every dot in a stack as its own value.",
  },
  "mean-missing-value": {
    goal: "Find the missing value from a mean, the count and the other values.",
    senses: { mean: "mean-average" },
    intuition:
      "The mean is the total of the values divided by how many there are. So the mean times the count gives back the total. Once you know the total, take away the values you know. What is left is the missing value.",
    terms: ["mean-average"],
    method: [
      "Find the total of all the values: mean × count.",
      "Add the values you know.",
      "Subtract that sum from the total to get the missing value.",
    ],
    watch: "Multiply the mean by the full count, including the missing value.",
  },
  "histogram-read": {
    goal: "Count values in one or more intervals of a histogram.",
    senses: {
      interval: "interval",
      intervals: "interval",
      scale: "scale-axis",
    },
    noLink: ["edge"],
    intuition:
      "Data are numbers or facts someone collected, such as test scores. A histogram is a bar graph for number data. Each bar covers an interval, a stretch of numbers such as 20 up to 30. The bar's height is how many values fall in that interval. A bar from 20 to 30 counts values from 20 up to, but not including, 30. For whole numbers, that is 20 to 29.",
    terms: [
      [
        "interval",
        "Here each bar covers its left end up to, but not including, its right end.",
      ],
    ],
    method: [
      "Find the bars the question covers. “At least 30” starts at the bar beginning at 30. “Fewer than 30” stops at the bar ending at 30.",
      "Read each bar's count from the numbers beside the graph, then add the counts.",
    ],
    watch:
      "A value exactly where two bars meet belongs to the bar on its right.",
  },
  "box-plot-read": {
    goal: "Read a summary or a share of the data from a box plot.",
    senses: {
      quarter: "fourth",
      quarters: "fourth",
      "one quarter": "fourth",
      parts: "part",
      range: "range-statistics",
      scale: "scale-axis",
      intervals: "interval",
    },
    noLink: ["third"],
    intuition:
      "Data are numbers or facts someone collected, such as test scores. A box plot shows five numbers. The whiskers end at the least value (minimum) and the greatest value (maximum). The line inside the box is the median, the middle value. The box ends are the quartiles: the middle of the lower half and the middle of the upper half. These five numbers split the ordered data into four parts, each holding about one quarter (25%) of the data.",
    terms: ["quartile", "interquartile-range"],
    method: [
      "Read the five numbers: the whisker ends, the box ends and the median line.",
      "The range is the maximum minus the minimum. The interquartile range is the upper quartile minus the lower quartile.",
      "For a share of the data, count parts: each of the four parts holds about 25%.",
    ],
    watch: "A long part of the plot means spread-out values, not more values.",
  },
  "dot-plot-mad": {
    goal: "Find the mean absolute deviation of dot-plot data.",
    senses: {
      mean: "mean-average",
      average: "mean-average",
      differences: "difference-subtract",
    },
    intuition:
      "The mean is the total of the values divided by how many there are. A value's distance from the mean is how far it is, ignoring above or below, so it is never negative. The mean absolute deviation is the mean of those distances: how far a value is from the mean on average.",
    terms: ["mean-absolute-deviation"],
    method: [
      "Find the mean: total ÷ number of values.",
      "Find each value's distance from the mean.",
      "Add the distances and divide by the number of values.",
    ],
    watch: "Use distances, which are never negative.",
  },
  "dot-plot-iqr": {
    goal: "Find the interquartile range of dot-plot data.",
    senses: { average: "mean-average" },
    intuition:
      "Data are numbers or facts someone collected, such as test scores. Put the values in order. The median, the middle value, splits them into a lower half and an upper half. The middle of the lower half is the lower quartile, Q1. The middle of the upper half is the upper quartile, Q3. The interquartile range is the upper quartile minus the lower quartile: Q3 minus Q1. It is the width of the middle half of the data. A box plot is a graph that draws this middle half as a box.",
    terms: ["quartile", "interquartile-range"],
    method: [
      "Read the values in order, left to right. A stack of dots is several values.",
      "Split them into halves. With an odd count, leave out the middle value.",
      "Find the middle of each half (Q1 and Q3) and subtract: Q3 − Q1.",
    ],
    watch:
      "When a half has an even count, its middle is the average of its two middle values.",
  },
  "typical-value-choice": {
    goal: "Choose the summary that describes a typical value when one value lies far from the rest.",
    senses: { mean: "mean-average" },
    noLink: ["jump"],
    intuition:
      "Data are numbers or facts someone collected, such as test scores. The mean is the total divided by the count, so every value's size counts. One far-off value pulls the mean toward it. The median is the middle value once the data are in order. It depends on the middle value or values, not on how far away the end values are. So one far-off value usually moves it little.",
    terms: ["mean-average", "median"],
    method: [
      "Find the value that is far from the others.",
      "Choose the median. It depends on the middle of the ordered data, not on how far away that value is.",
    ],
    watch: "The mean is pulled toward a far-off value.",
  },
};
export const distributionPrinciples: Record<string, string> = {
  "statistical-question-choice":
    "A question is statistical when answering it produces data that vary.",
  "dot-plot-mean":
    "The mean is the total of the values divided by how many there are. It is the balance point of the data.",
  "mean-missing-value":
    "Mean × count = total. So a known mean and count fix the total, and the total fixes any one missing value.",
  "histogram-read":
    "A histogram bar's height is the number of values in its interval.",
  "box-plot-read":
    "The minimum, Q1, median, Q3 and maximum split ordered data into four parts with about a quarter of the values each.",
  "dot-plot-mad":
    "The mean absolute deviation is the average distance of the values from their mean.",
  "dot-plot-iqr":
    "The interquartile range Q3 − Q1 is the width of the middle half of the ordered data.",
  "typical-value-choice":
    "A far-off value pulls the mean toward it but barely moves the median. So the median better describes the typical values then.",
};
