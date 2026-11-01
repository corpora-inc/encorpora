import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

const foundations: Lesson["sections"] = [
  {
    title: "Read and order the values",
    paragraphs: [
      "This lesson uses counting, putting numbers in order, adding, subtracting and dividing by 2. Data are numbers someone recorded, such as test scores or temperatures. Each recorded number is one value, and all of them together are called a data set. The same value can appear more than once. For example, 2, 2, 5 is three values, not two.",
      "To order the values, list them from least to greatest. Do not change or drop any of them. On a number line, smaller numbers are farther left.",
      "A negative number is a number less than 0, written with a minus sign, such as −4. Every negative number is less than 0. Among negative numbers, the one farther left is smaller. So −4 is less than −1, even though 4 is greater than 1.",
      "A decimal uses a decimal point to show parts of 1. One tenth is 1 of 10 equal parts of 1, so 0.3 means three tenths. To compare decimals that are not negative, compare the whole-number parts first, then the tenths: 1.2 is less than 1.7. For negative decimals, the one farther from 0 is smaller: −1.7 is less than −1.2.",
      "Ordering moves values to new places in the list. It does not change any value or how many values there are. Keep each repeated value in its own place.",
    ],
  },
];
const halves: Lesson["sections"][number] = {
  title: "Find an exact halfway value",
  paragraphs: [
    "The number halfway between two numbers is their sum divided by 2. This is also called the mean of the two numbers. For 1 and 3, add to get 4, then share 4 into two equal parts: $(1 + 3) \\div 2 = 4 \\div 2 = 2$. The halfway value does not have to be one of the recorded values.",
    "A fraction is another way to write a division. In $\\frac{3}{2}$, the bottom number, the denominator, says 2 equal parts make 1 whole. The top number, the numerator, counts 3 of those halves. The decimal 1.5 names the same amount: $\\frac{3}{2} = 1.5$.",
    "Halfway between 1.2 and 1.7 is $(1.2 + 1.7) \\div 2 = 2.9 \\div 2 = 1.45$. Keep the exact answer. Do not round it.",
    "Adding a negative number moves left on the number line. For −2 and 1, start at −2 and move 1 to the right to reach −1. Then divide by 2: $-1 \\div 2 = -0.5$.",
    "For two negative values, add their distances from 0 and keep the minus sign: $(-4 + (-2)) \\div 2 = -6 \\div 2 = -3$. Dividing a negative number by 2 halves its distance from 0 and keeps it negative.",
  ],
};
const spread: Lesson["sections"][number] = {
  title: "Measure a distance, including across zero",
  paragraphs: [
    "Spread tells how far apart the values are. The least value is called the minimum, and the greatest is called the maximum. The range is the maximum minus the minimum. On a number line, it is the distance from the leftmost value to the rightmost value. It is not the number of values.",
    "Subtracting a negative number is the same as adding the matching positive number. From −2 to 8, it is 2 steps up to 0 and then 8 more to reach 8: $8 - (-2) = 8 + 2 = 10$. The same works when both ends are negative: $-1 - (-4) = -1 + 4 = 3$.",
    "The maximum is never less than the minimum, so a range is never negative. If all the values are equal, the range is 0.",
    "Subtract decimals by counting tenths. From 0.3 to 1.2 is twelve tenths minus three tenths, which is nine tenths: $1.2 - 0.3 = 0.9$. Both ends must use the same unit, such as centimeters.",
  ],
};
const medianDefinition: Lesson["sections"][number] = {
  title: "Locate the middle by position",
  paragraphs: [
    "The median is the middle value once the data are in order. A position is a value's place in the ordered list: first, second, third and so on. Count the values after ordering them.",
    "With an odd number of values, one value is in the middle. It has the same number of values on each side. For 1, 2, 2, 7, 9, the third value is the median, 2. Two values come before it and two come after it.",
    "With an even number of values, two values share the middle. The median is the number halfway between them: add the two and divide by 2. For six values, the middle positions are third and fourth. For eight values, they are fourth and fifth.",
    "Positions count from 1. A repeated value takes up one position each time it appears.",
    "The mean is a different typical value: add every value and divide by how many there are. It is also called the average. The median and the mean can differ, because the median uses only the order. The median is also not always halfway between the least and greatest values.",
  ],
};

export const descriptiveStatisticsLessons: Lesson[] = [
  {
    id: "median-data",
    title: "Find the median",
    summary:
      "The median is the middle value of a set of numbers. Put every value in order from least to greatest, keeping repeats. With an odd number of values, the median is the one in the middle. With an even number, two values share the middle, and the median is halfway between them.",
    templateIds: ["median-data"],
    includeGeneratedRepresentation: false,
    senses: {
      mean: "mean-average",
      average: "mean-average",
      sort: "sort",
      sorting: "sort",
      "more than": "more-than",
      difference: "difference-subtract",
      units: "unit",
      unit: "unit",
      parts: "part",
      whole: "whole",
      changes: "change",
    },
    noLink: ["center", "leaves", "side", "third", "fourth", "opposite"],
    objectives: [
      "Find the median of an odd or even number of values.",
      "Keep repeated values, and find the exact number halfway between two middle values.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Find the middle of a line of values",
        paragraphs: [
          "A data value is one recorded number. Put all the values in order and keep repeats. Cross off one value from each end, again and again. The value left in the middle is the median. It is one way to describe a typical value of the data.",
          "If two values are left, find the number halfway between them. For 1 and 3, that number is 2, even if 2 was never recorded.",
          "The median depends on the places of the values in the ordered list. It does not depend on how large the end values are.",
        ],
      },
      ...foundations,
      medianDefinition,
      halves,
      {
        title: "Read the dot plot",
        paragraphs: [
          "A dot plot puts one dot above a number line for each value. Repeated values stack up, so two dots above 3 mean 3 was recorded twice. Left and right show size. Stacking only keeps repeats visible.",
          "The six dots show −2, −1, 1, 3, 3, 8. The third and fourth values are 1 and 3. Halfway between them is 2, marked below the line. There is no dot at 2. With an even number of values, the median can fall between two values.",
        ],
        illustration: "descriptive-median",
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Median of ordered data",
        paragraphs: [
          "Let $n$ be the number of values, with $n$ greater than 0, listed from least to greatest. If $n$ is odd, the median is the value in position $\\frac{n+1}{2}$. If $n$ is even, the median is the mean of the values in positions $\\frac{n}{2}$ and $\\frac{n}{2} + 1$. Positions start at 1, and each repeated value takes its own position.",
          "The mean of two numbers $a$ and $b$ is $\\frac{a+b}{2}$, the number halfway between them. It can fall between recorded values, and no rounding is needed.",
        ],
      },
    ],
    workedExample: {
      prompt: "Find the median of these data: 3, −2, 8, 1, 3, −1.",
      steps: [
        "Order all six values from least to greatest, keeping both 3s: −2, −1, 1, 3, 3, 8.",
        "Six is even, so two values share the middle. They are in positions 3 and 4, and their values are 1 and 3.",
        "Find the number halfway between them. Add: $1 + 3 = 4$.",
        "Divide the sum by 2: $4 \\div 2 = 2$.",
        "Check: two values come before the middle pair and two come after. So the median is 2.",
      ],
      answer: "2",
    },
    pitfalls: [
      "Put the values in order before finding the middle.",
      "Keep every repeat. Dropping one changes the count, and it can change the median.",
      "With an even count, average the two middle values, not the two end values.",
    ],
    parentGuide:
      "Lay out six numbered cards, including a repeat. Remove one card from each end until two middle cards remain, and find the number halfway between them. Then add a seventh card and repeat.",
  },
  {
    id: "range-data",
    title: "Find the range",
    summary:
      "The range tells how spread out a set of numbers is. Find the least value, called the minimum, and the greatest value, called the maximum. The range is the maximum minus the minimum. On a number line, it is the distance from the leftmost value to the rightmost value.",
    templateIds: ["range-data"],
    includeGeneratedRepresentation: false,
    senses: {
      range: "range-statistics",
      change: "change",
      changes: "change",
      "more than": "more-than",
      parts: "part",
      whole: "whole",
      sorting: "sort",
      units: "unit",
      unit: "unit",
      difference: "difference-subtract",
      scale: "scale-axis",
      intervals: "interval",
    },
    noLink: ["opposite", "leaves", "center"],
    objectives: [
      "Find the minimum and maximum of data with negative numbers or decimals.",
      "Subtract the minimum from the maximum, and read the result as a measure of spread that is never negative.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Measure the full span",
        paragraphs: [
          "Put the values on a number line. The least value, the minimum, is farthest left. The greatest value, the maximum, is farthest right.",
          "The range is the distance from the leftmost value to the rightmost value: maximum minus minimum. The values in between do not move those two ends, and neither does how often a value repeats.",
        ],
      },
      ...foundations,
      spread,
      {
        title: "See the full span",
        paragraphs: [
          "A dot plot puts one dot above a number line for each value. Dots for a repeated value stack up. Left and right show size, and how tall a stack is shows repeats.",
          "For −2, −1, 1, 3, 3, 8, the leftmost value is −2 and the rightmost is 8. The bracket spans 10 equal steps of 1 unit. There are six values, but their range is $8 - (-2) = 10$. A repeated value in the middle does not move either end.",
        ],
        illustration: "descriptive-range",
      },
      {
        title: "What the range tells you",
        paragraphs: [
          "The range uses only the two end values. Moving a middle value, without changing the minimum or maximum, leaves the range the same. Moving an end value farther out makes the range larger.",
          "An outlier is a value far from the rest of the data. One outlier can make the range large even when most values are close together.",
          "The range alone does not tell the typical value, the pattern between the ends, or how often values repeat. The range has the same unit as the data. If the values are in centimeters, so is the range.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Distance between endpoints",
        paragraphs: [
          "For a data set with one or more number values, the minimum is the least value and the maximum is the greatest. The range is maximum minus minimum. It is a distance that is never negative, in the same unit as the data.",
        ],
      },
    ],
    workedExample: {
      prompt: "Find the range of these data: 3.5, −2, 1, −0.5, 3.5.",
      steps: [
        "Order the values from least to greatest so the ends are easy to see: −2, −0.5, 1, 3.5, 3.5.",
        "The minimum is the first value, −2. The maximum is the last value, 3.5.",
        "Subtract the minimum from the maximum. Subtracting −2 is the same as adding 2: $3.5 - (-2) = 3.5 + 2 = 5.5$.",
        "Check on a number line: it is 2 units from −2 up to 0, then 3.5 units to the maximum. That is $2 + 3.5 = 5.5$ units in all.",
      ],
      answer: "5.5",
    },
    pitfalls: [
      "The range is maximum minus minimum, not maximum plus minimum.",
      "Subtracting a negative minimum is the same as adding the matching positive number.",
      "Counting the values does not give the range. The range is a distance on the number line.",
    ],
    parentGuide:
      "Place values on a number line. Keep both end values fixed and move a middle value, and explain why the range stays the same. Then move one end value and compare.",
  },
  {
    id: "interquartile-range-data",
    title: "Find the interquartile range",
    summary:
      "Put the values in order and split them into a lower half and an upper half. The middle of the lower half is called the lower quartile, and the middle of the upper half is the upper quartile. The interquartile range is the upper quartile minus the lower quartile. It measures how spread out the middle half of the data is.",
    templateIds: ["interquartile-range-data"],
    includeGeneratedRepresentation: false,
    senses: {
      mean: "mean-average",
      average: "mean-average",
      range: "range-statistics",
      "one quarter": "fourth",
      part: "part",
      parts: "part",
      whole: "whole",
      sorting: "sort",
      sort: "sort",
      changes: "change",
      units: "unit",
      unit: "unit",
      "more than": "more-than",
    },
    noLink: [
      "center",
      "centers",
      "leaves",
      "side",
      "third",
      "fourth",
      "opposite",
      "boundary",
      "rule",
      "rules",
    ],
    objectives: [
      "Use the stated rule for splitting the data into halves, every time.",
      "Find exact quartiles, and subtract the lower quartile from the upper quartile.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Look at the middle part of the data",
        paragraphs: [
          "The median is the middle value once the data are in order. With an even number of values, it is halfway between the two middle values.",
          "The median splits the ordered values into a lower half and an upper half. Find the median of each half. These two values are called quartiles, because together with the median they cut the data into four parts.",
          "Subtract the lower quartile from the upper quartile. The result is the interquartile range. It tells how spread out the middle half of the data is.",
        ],
      },
      ...foundations,
      medianDefinition,
      halves,
      {
        title: "Define the two halves and their quartiles",
        paragraphs: [
          "The lower quartile, written $Q_1$ (read “$Q$ one”), is the median of the lower half. The upper quartile, written $Q_3$ (read “$Q$ three”), is the median of the upper half. The small number after the $Q$ is part of the name.",
          "Split the data this way. With an even number of values, cut the ordered list into two equal halves. With an odd number, leave the one middle value out of both halves. Leave out only that one position. Keep other values that happen to be equal to it.",
          "Other books sometimes use a different rule for quartiles. Follow the rule the question states.",
          "For seven ordered values, the fourth is the median. Positions 1 to 3 are the lower half, and positions 5 to 7 are the upper half. Each half has three values, so its median is its middle value.",
          "For nine ordered values, leave out position 5. Each half has four values, so its median is halfway between its two middle values.",
          "For six values, split after position 3, so each half has three values. For eight values, split after position 4, so each half has four. Decide whether to average by counting the values in the half, not in the whole data set.",
        ],
      },
      {
        title: "Measure the distance between the quartiles",
        paragraphs: [
          "The interquartile range, written IQR, is the upper quartile minus the lower quartile: $Q_3 - Q_1$. It measures spread, not a typical value. The full range is the greatest value minus the least value. The IQR, unlike the range, does not depend only on those two values.",
          "In the dot plot, the ordered data are −4, −2, −2, 0, 1, 3, 4, 6, 8. There are nine values, so leave out the middle value, 1.",
          "The lower half is −4, −2, −2, 0. Its middle pair is −2 and −2, so $Q_1 = -2$. The upper half is 3, 4, 6, 8. Its middle pair is 4 and 6, so $Q_3 = (4 + 6) \\div 2 = 5$. A quartile does not have to be a recorded value: 5 lies between 4 and 6.",
          "Subtract: $5 - (-2) = 5 + 2 = 7$. The bracket shows this distance of 7 units. Both −2s stay in the data as separate values. The full range is $8 - (-4) = 12$, which answers a different question.",
        ],
        illustration: "descriptive-iqr",
      },
      {
        title: "Interpret the result carefully",
        paragraphs: [
          "A quartile is found by position. It does not promise that exactly one quarter of the values are below it. Repeated values and small data sets can put several values right on a quartile.",
          "The upper quartile is never less than the lower quartile, so the IQR is never negative. It can be 0 even when the full range is not. For 0, 2, 2, 2, 2, 2, 9, both quartiles are 2, so the IQR is 0, while the range is 9.",
          "Keep exact fractions or decimals. Do not round a quartile before you subtract.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Middle-half span",
        paragraphs: [
          "Take at least two values and the median-of-halves rule. $Q_1$ is the median of the lower half and $Q_3$ is the median of the upper half. When the count is odd, leave the one overall median out of both halves. Then $\\mathrm{IQR} = Q_3 - Q_1$. Other quartile rules can give different answers.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Find the interquartile range of these data: 6, −2, 1, 8, −4, 4, 0, −2, 3. Exclude the overall median from both halves.",
      steps: [
        "Order all nine values from least to greatest, keeping both −2s: −4, −2, −2, 0, 1, 3, 4, 6, 8.",
        "Nine is odd, so leave out the middle value, the fifth one, which is 1. The lower half is −4, −2, −2, 0. The upper half is 3, 4, 6, 8.",
        "The lower half has four values, so its median is halfway between its middle pair, −2 and −2: $(-2 + (-2)) \\div 2 = -4 \\div 2 = -2$. So $Q_1 = -2$.",
        "The upper half has four values, so its median is halfway between 4 and 6: $(4 + 6) \\div 2 = 10 \\div 2 = 5$. So $Q_3 = 5$.",
        "Subtract the lower quartile from the upper quartile. Subtracting −2 is the same as adding 2: $5 - (-2) = 5 + 2 = 7$.",
      ],
      answer: "7",
    },
    pitfalls: [
      "With an odd count, leave the one middle position out of both halves under this rule.",
      "Leave out only one position, not every value equal to the median.",
      "Average the two middle values of a half only when that half has an even count.",
      "The IQR is $Q_3 - Q_1$, not maximum minus minimum.",
    ],
    parentGuide:
      "Write nine values on separate cards, including a repeat. Put them in order, set aside the middle card, and mark each half's middle pair. Ask the learner to explain each position before calculating.",
  },
];

export const descriptiveStatisticsMethods: Record<string, ProblemMethod> = {
  "median-data": {
    goal: "Find the median, the middle value of a set of numbers once they are in order.",
    senses: {
      mean: "mean-average",
      average: "mean-average",
      "arithmetic mean": "mean-average",
      sorting: "sort",
    },
    noLink: ["third", "fourth"],
    intuition:
      "The median is the middle value once the numbers are in order from least to greatest. Keep every repeat. With an odd number of values, one value is in the middle. With an even number, two values share the middle, and the median is halfway between them: add the two and divide by 2. A negative number is a number less than 0, such as −6. It is smaller the farther it is from 0.",
    terms: [
      "median",
      [
        "mean-average",
        "For two values, add them and divide by 2; the result is halfway between them.",
      ],
    ],
    method: [
      "Order every value from least to greatest, keeping repeats.",
      "With an odd count, the median is the one middle value.",
      "With an even count, add the two middle values and divide by 2. Keep the exact result.",
    ],
    watch:
      "Use the middle positions of the ordered list, not the two end values.",
  },
  "range-data": {
    goal: "Find the range: the greatest value minus the least value.",
    senses: { range: "range-statistics", unit: "unit" },
    noLink: ["opposite"],
    intuition:
      "The range tells how spread out a set of numbers is. The least value is called the minimum and the greatest is called the maximum. The range is the maximum minus the minimum, the distance between them on a number line. It is never negative.",
    terms: ["minimum", "maximum", "range-statistics"],
    method: [
      "Find the least value (minimum) and the greatest value (maximum).",
      "Subtract the minimum from the maximum. Subtracting a negative number is the same as adding the matching positive number.",
      "Check that the answer is not negative and uses the same unit as the data.",
    ],
    watch:
      "The range is a distance between two values, not the number of values.",
  },
  "interquartile-range-data": {
    goal: "Find the interquartile range: the middle of the upper half minus the middle of the lower half.",
    senses: { mean: "mean-average", average: "mean-average" },
    noLink: ["third", "fourth", "rule"],
    intuition:
      "Put the values in order. The median, the middle value, splits them into a lower half and an upper half. The median of the lower half is the lower quartile. The median of the upper half is the upper quartile. The interquartile range is the upper quartile minus the lower quartile. It tells how spread out the middle half of the data is.",
    terms: [
      "median",
      [
        "quartile",
        "Follow the problem's stated convention for whether the median joins the halves.",
      ],
      "interquartile-range",
    ],
    method: [
      "Order every value from least to greatest, keeping repeats.",
      "Split into two equal halves. With an odd count, leave the one middle value out of both halves.",
      "Find each half's median. When the half has an even count, add its two middle values and divide by 2.",
      "Subtract the lower quartile from the upper quartile. Keep the exact answer.",
    ],
    watch: "Leave out one middle position, not every value equal to it.",
  },
};
export const descriptiveStatisticsPrinciples: Record<string, string> = {
  "median-data":
    "The median is found from the middle position or positions of the ordered data. With an even count, it is the mean of the two middle values: their sum divided by 2.",
  "range-data":
    "The range is the distance between the greatest and least values: maximum minus minimum. It is never negative.",
  "interquartile-range-data":
    "Under the median-of-halves rule, $Q_1$ and $Q_3$ are the medians of the lower and upper halves. When the count is odd, the overall middle value is left out of both halves. Then $\\text{IQR} = Q_3 - Q_1$.",
};
