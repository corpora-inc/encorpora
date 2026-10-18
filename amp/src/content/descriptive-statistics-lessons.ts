import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

const foundations: Lesson["sections"] = [
  {
    title: "Read and order the observations",
    paragraphs: [
      "This lesson uses counting, ordering signed numbers, addition, subtraction and division by 2. Data are recorded observations. A numerical value is the number recorded for one observation. A dataset is the collection of those observations; the same value can occur more than once. For example, 2, 2, 5 contains three observations, not two.",
      "Order the values from least to greatest without changing or removing any of them. On a number line, lesser values lie farther left. Every negative number is less than zero; among negative numbers, the one farther left is smaller. Thus −4 is less than −1, even though 4 is greater than 1.",
      "A decimal records parts of a whole. One tenth divides a whole into ten equal parts, so 0.3 means three tenths and −0.3 is three tenths to the left of zero. Compare whole-number parts first, then tenths: 1.2 is less than 1.7. Sorting changes the positions of observations, not their values or their number. Keep repeated values in separate positions.",
    ],
  },
];
const halves: Lesson["sections"][number] = {
  title: "Find an exact halfway value",
  paragraphs: [
    "The mean of two numbers is their sum divided by 2. It is the number halfway between them on a number line. For 1 and 3, add to get 4, then divide into two equal shares: (1 + 3) ÷ 2 = 4 ÷ 2 = 2. The halfway value need not be one of the observations.",
    "A fraction means division. Its denominator says how many equal parts make one whole, and its numerator counts those parts. In 3/2, two halves make one whole and the numerator counts three halves. An exact decimal can name the same value: 3/2 = 1.5. To average 1.2 and 1.7, add their tenths: (1.2 + 1.7) ÷ 2 = 2.9 ÷ 2 = 29/20 = 1.45. Do not round.",
    "Signed addition combines movement in opposite directions. For −2 and 1, two units left and one unit right give −1; divide by 2 to get −1/2 = −0.5. For two negative values, add the distances to the left and retain the negative sign: (−4 + (−2)) ÷ 2 = −6 ÷ 2 = −3. Dividing a negative number by positive 2 halves its distance from zero without changing its sign.",
  ],
};
const spread: Lesson["sections"][number] = {
  title: "Measure a distance, including across zero",
  paragraphs: [
    "Spread describes how far apart the values are. The least value is the minimum; the greatest is the maximum. The range is maximum minus minimum. It measures the full distance from the leftmost observation to the rightmost observation on a number line, not the number of observations.",
    "Subtracting a negative number adds its positive opposite. From −2 to 8, travel 2 units to zero and 8 more to reach 8: 8 − (−2) = 8 + 2 = 10. If both endpoints are negative, the same subtraction works: −1 − (−4) = −1 + 4 = 3. The maximum is never less than the minimum, so a range cannot be negative.",
    "Subtract decimals by comparing equal-sized parts. From 0.3 to 1.2, the difference is twelve tenths minus three tenths: 1.2 − 0.3 = 12/10 − 3/10 = 9/10 = 0.9. Use the same unit for both endpoints. If all observations are equal, the distance between the endpoints is zero.",
  ],
};
const medianDefinition: Lesson["sections"][number] = {
  title: "Locate the middle by position",
  paragraphs: [
    "The median is a measure of center based on positions in the ordered dataset. Count the observations after sorting them. An odd count leaves one middle observation with the same number of observations on either side. For 1, 2, 2, 7, 9, the third value is the median, 2: two observations precede it and two follow it.",
    "An even count leaves two middle observations. The median is their mean, found by adding them and dividing by 2. For six observations, the middle positions are third and fourth. For eight observations, they are fourth and fifth. Positions count from 1; a repeated value occupies a position each time it occurs.",
    "The median describes the center by order, whereas the arithmetic mean uses the sum of every observation. They need not agree. The median is also different from the midpoint of the smallest and largest values: those endpoints do not identify the middle positions.",
  ],
};

export const descriptiveStatisticsLessons: Lesson[] = [
  {
    id: "median-data",
    title: "Find the median",
    summary: "Order every observation, then locate the center by position.",
    templateIds: ["median-data"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Find the median of an odd or even number of observations.",
      "Preserve repeated values and calculate an exact mean of two middle values.",
    ],
    sections: [
      ...foundations,
      medianDefinition,
      halves,
      {
        title: "Read the dotplot",
        paragraphs: [
          "A dotplot places one dot above its value on a number line. Repeated values stack vertically, so two dots above 3 mean two separate observations of 3. Horizontal distance represents numerical difference; vertical stacking only keeps repeated observations visible.",
          "The six dots represent −2, −1, 1, 3, 3, 8. The third and fourth values are 1 and 3. Their midpoint is 2, marked below the line. There is no dot at 2: an even-count median can lie between observations.",
        ],
        illustration: "descriptive-median",
      },
    ],
    workedExample: {
      prompt: "Find the median of these data: 3, −2, 8, 1, 3, −1.",
      steps: [
        "Order all six observations: −2, −1, 1, 3, 3, 8.",
        "The middle positions are third and fourth. Their values are 1 and 3.",
        "Add the two middle values: 1 + 3 = 4.",
        "Divide the sum by 2: 4 ÷ 2 = 2.",
        "The middle pair leaves two positions before it and two after it. Its midpoint is the median, 2.",
      ],
      answer: "2",
    },
    pitfalls: [
      "Do not use the middle position in the unsorted list.",
      "Keep every repetition; removing one changes the count and possibly the median.",
      "For an even count, average the two middle values, not the two endpoints.",
    ],
    parentGuide:
      "Arrange six numbered cards, including a repetition. Remove one card from each end until the two middle cards remain. Find their midpoint, then repeat after adding a seventh card.",
  },
  {
    id: "range-data",
    title: "Find the range",
    summary:
      "Measure the distance from the smallest observation to the largest.",
    templateIds: ["range-data"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Identify the minimum and maximum of signed or decimal data.",
      "Subtract minimum from maximum and interpret the nonnegative result as spread.",
    ],
    sections: [
      ...foundations,
      spread,
      {
        title: "See the full span",
        paragraphs: [
          "A dotplot places one dot above the number recorded for each observation. Dots at a repeated value stack vertically. The horizontal scale shows numerical distance; the height of a stack shows repetition.",
          "For −2, −1, 1, 3, 3, 8, the leftmost value is −2 and the rightmost is 8. The bracket spans ten equal one-unit intervals. There are six observations, but their range is 10. Repeating an interior value does not move either endpoint.",
        ],
        illustration: "descriptive-range",
      },
      {
        title: "What the range tells you",
        paragraphs: [
          "The range uses only the two endpoints. Moving an interior observation without changing the minimum or maximum leaves the range unchanged. Moving an endpoint farther outward increases the range.",
          "An outlier is an observation unusually far from the rest of a dataset. A distant observation can make the range large even if most other values are close together. Range alone does not describe the center, the pattern between the endpoints, or how often values occur. If values are measured in centimeters, their range is also in centimeters.",
        ],
      },
    ],
    workedExample: {
      prompt: "Find the range of these data: 3.5, −2, 1, −0.5, 3.5.",
      steps: [
        "Order the observations: −2, −0.5, 1, 3.5, 3.5.",
        "The minimum is −2 and the maximum is 3.5.",
        "Subtract the minimum: 3.5 − (−2) = 3.5 + 2 = 5.5.",
        "Check the distance across zero: 2 units from −2 to zero, then 3.5 units to the maximum, for 5.5 units altogether.",
      ],
      answer: "5.5",
    },
    pitfalls: [
      "Range is maximum minus minimum, not their sum.",
      "Subtracting a negative minimum adds its positive opposite.",
      "Counting observations or distinct values does not give the range.",
    ],
    parentGuide:
      "Place values on a number line. Keep both endpoints fixed and move an interior value; explain why the range stays the same. Then move one endpoint.",
  },
  {
    id: "interquartile-range-data",
    title: "Find the interquartile range",
    summary:
      "Find the centers of the lower and upper halves, then measure the distance between them.",
    templateIds: ["interquartile-range-data"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Apply the stated median-of-halves convention consistently.",
      "Find exact quartiles and subtract the lower quartile from the upper.",
    ],
    sections: [
      ...foundations,
      medianDefinition,
      halves,
      {
        title: "Define the two halves and their quartiles",
        paragraphs: [
          "Quartiles mark positions that divide ordered data into lower and upper parts. Here the lower quartile, called Q1, is the median of the lower half. The upper quartile, called Q3, is the median of the upper half. The overall median separates the halves.",
          "Use this convention: with an even number of observations, split the ordered list into two equal halves. With an odd number, exclude the single overall middle observation from both halves, then use the values on either side. Exclude that one position only; keep other observations with the same value. Other quartile conventions exist, so follow the convention stated in the question.",
          "For seven ordered values, the fourth is the overall median; positions 1–3 form the lower half and positions 5–7 form the upper half. Each half has three values, so use its middle value. For nine ordered values, exclude position 5; each remaining half has four values, so average its two middle values.",
          "For six ordered values, split after position 3. Each half has three observations even though the whole dataset has an even count. For eight values, split after position 4; each half has four observations. Decide whether to average by counting the values in the half you are using, not by whether the original count is odd or even.",
        ],
      },
      {
        title: "Measure the distance between the quartiles",
        paragraphs: [
          "The interquartile range, abbreviated IQR, is the upper quartile minus the lower quartile: Q3 − Q1. It measures the numerical span between the centers of the two halves. It is a measure of spread, not a measure of center. Unlike the full range, it does not use only the smallest and largest observations.",
          "In the dotplot, the ordered data are −4, −2, −2, 0, 1, 3, 4, 6, 8. Exclude the overall middle observation, 1. The lower half is −4, −2, −2, 0, whose middle pair has mean −2. The upper half is 3, 4, 6, 8, whose middle pair has mean 5. Neither quartile needs to be a distinct observation: 5 lies between 4 and 6.",
          "Subtract the lower quartile: 5 − (−2) = 5 + 2 = 7. The bracket shows this seven-unit distance. Both copies of −2 remain separate observations. The full range is 8 − (−4) = 12, which answers a different question.",
        ],
        illustration: "descriptive-iqr",
      },
      {
        title: "Interpret the result carefully",
        paragraphs: [
          "A quartile is a boundary determined by positions, not a promise that exactly one quarter of the observations have smaller values. Repetitions and small datasets can put several observations on a boundary. The stated median-of-halves procedure is what determines the answer here.",
          "Since the upper quartile cannot be less than the lower quartile, the interquartile range is nonnegative. It can be zero even when the full range is positive: for 0, 2, 2, 2, 2, 2, 9, both quartiles are 2, so the IQR is 0 while the full range is 9. Keep exact fractions or decimals; do not round an intermediate quartile.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Find the interquartile range of these data: 6, −2, 1, 8, −4, 4, 0, −2, 3. Exclude the overall median from both halves.",
      steps: [
        "Order all nine observations: −4, −2, −2, 0, 1, 3, 4, 6, 8.",
        "Exclude the fifth observation, 1. Lower half: −4, −2, −2, 0. Upper half: 3, 4, 6, 8.",
        "The lower middle pair is −2 and −2. Its mean is (−2 + (−2)) ÷ 2 = −4 ÷ 2 = −2.",
        "The upper middle pair is 4 and 6. Its mean is (4 + 6) ÷ 2 = 10 ÷ 2 = 5.",
        "Subtract the lower quartile from the upper: 5 − (−2) = 5 + 2 = 7.",
      ],
      answer: "7",
    },
    pitfalls: [
      "For an odd count, exclude the overall middle position from both halves under this convention.",
      "Do not remove every repetition of the median's value.",
      "Find the median of each half; averaging is required exactly when that half has an even count.",
      "Subtract Q1 from Q3, not minimum from maximum.",
    ],
    parentGuide:
      "Write nine observations on separate cards, including a repetition. Sort them, set aside the middle card, and mark each half's middle pair. Explain every position before calculating.",
  },
];

export const descriptiveStatisticsMethods: Record<string, ProblemMethod> = {
  "median-data": {
    goal: "Find the middle of a numerical dataset by position.",
    terms: [
      [
        "median",
        "The middle value of ordered data, or the mean of the two middle values.",
      ],
      ["mean of two values", "Their sum divided by 2."],
    ],
    method: [
      "Order every observation from least to greatest, retaining repetitions.",
      "For an odd count, use the single middle observation.",
      "For an even count, add the two middle values and divide by 2. Keep the exact result.",
    ],
    watch: "Positions, not endpoints or distinct values, determine the median.",
  },
  "range-data": {
    goal: "Find the full numerical span of a dataset.",
    terms: [
      ["minimum", "The least value."],
      ["maximum", "The greatest value."],
      ["range", "Maximum minus minimum."],
    ],
    method: [
      "Identify the least and greatest observations.",
      "Subtract minimum from maximum. Subtracting a negative adds its positive opposite.",
      "Check that the answer is nonnegative and uses the same unit as the data.",
    ],
    watch: "The number of observations does not determine their range.",
  },
  "interquartile-range-data": {
    goal: "Measure the distance between the medians of the lower and upper halves.",
    terms: [
      [
        "median",
        "The middle value of ordered data, or the sum of its two middle values divided by 2.",
      ],
      [
        "quartiles",
        "Q1 is the lower half's median; Q3 is the upper half's median under the stated convention.",
      ],
      ["interquartile range", "Q3 minus Q1."],
    ],
    method: [
      "Order every observation, including repetitions.",
      "Split into equal halves. For an odd count, exclude the single overall middle observation from both halves.",
      "Find each half's median; average its two middle values when that half has an even count.",
      "Subtract the lower quartile from the upper and keep the exact nonnegative result.",
    ],
    watch: "Exclude one middle position, not every occurrence of its value.",
  },
};
export const descriptiveStatisticsPrinciples: Record<string, string> = {
  "median-data":
    "The median is determined by the central position or positions in ordered data. For an even count, it is the arithmetic mean of the two middle observations.",
  "range-data":
    "The range is the nonnegative distance between the greatest and least observations: maximum minus minimum.",
  "interquartile-range-data":
    "Under the median-of-halves convention, Q1 and Q3 are the medians of the lower and upper halves, excluding the overall middle observation when the count is odd. IQR = Q3 − Q1.",
};
