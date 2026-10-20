import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

export const linePlotLessons: Lesson[] = [
  {
    id: "line-plots",
    title: "Line plots of measurements",
    summary:
      "One mark per measurement, placed above its length on a number line.",
    templateIds: ["line-plot-whole"],
    objectives: [
      "Read how many objects have a given length, or are longer than it.",
      "Find how many objects were measured and how much longer the longest is than the shortest.",
    ],
    sections: [
      {
        title: "Every measurement gets one mark",
        paragraphs: [
          "A line plot is a number line with an × above the length of each object. Two objects with the same length make a stack of two × marks.",
          "These seven pencils measure 4, 5, 5, 6, 6, 6 and 8 inches. Three pencils are 6 inches long; no pencil is 7 inches, so nothing stands above 7.",
        ],
        illustration: "data-line-plot-inches",
      },
      {
        title: "Questions the plot answers",
        paragraphs: [
          "“Longer than 5 inches” means to the right of 5: the 6s and the 8, which is 4 pencils. The two pencils at 5 are not longer than 5.",
          "The longest pencil is the rightmost mark and the shortest is the leftmost. The difference is a distance on the number line: 8 − 4 = 4 inches.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Pencils measure 4, 5, 5, 6, 6, 6 and 8 inches. How many pencils are longer than 5 inches?",
      steps: [
        "Longer than 5 means to the right of 5.",
        "There are 3 marks at 6 and 1 at 8: 3 + 1 = 4.",
      ],
      answer: "4",
    },
    pitfalls: [
      "Count marks, not tick marks or numbers on the line.",
      "“Longer than” leaves out the stack at the named length itself.",
    ],
    parentGuide:
      "Measure six spoons, pencils or shoes to the nearest inch. Draw a number line and let your child put one × per object, then ask which length is most common.",
  },
  {
    id: "fraction-line-plots",
    title: "Line plots with halves and fourths",
    summary: "Read fractional lengths from equal spaces between whole numbers.",
    templateIds: ["fraction-line-plot"],
    objectives: [
      "Locate halves and fourths of a unit on a line plot.",
      "Count the measurements at, or longer than, a fractional length.",
    ],
    sections: [
      {
        title: "Each space is one fourth",
        paragraphs: [
          "Between two whole numbers there are four equal spaces, so each tick is 1/4 inch past the one before: 1, 1 1/4, 1 1/2, 1 3/4, 2.",
          "1 1/2 and 1 2/4 are the same point: two fourths make one half. The plot labels it 1 1/2.",
        ],
        illustration: "data-line-plot-quarters",
      },
      {
        title: "Read before you count",
        paragraphs: [
          "Find the named length first, then count the marks above it. Here three ribbons are 2 1/4 inches long.",
          "For “longer than 1 1/2 inches”, count everything to the right of 1 1/2: three at 2 1/4 and one at 2 3/4, so 4 ribbons.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Ribbons measure 1 1/4, 1 1/2, 1 1/2, 2 1/4, 2 1/4, 2 1/4 and 2 3/4 inches. How many ribbons are longer than 1 1/2 inches?",
      steps: [
        "Longer than 1 1/2 means to the right of 1 1/2.",
        "Three marks at 2 1/4 and one at 2 3/4: 3 + 1 = 4.",
      ],
      answer: "4",
    },
    pitfalls: [
      "Every tick between whole numbers is a fraction of a unit, not the next whole number.",
      "2 1/4 is past 2, not before it: count the spaces from the whole number on the left.",
    ],
    parentGuide:
      "Cut a few strips of paper and measure them to the nearest quarter inch. Mark each length on a number line with fourths and compare the stacks.",
  },
  {
    id: "fraction-plot-arithmetic",
    title: "Add and subtract lengths from a line plot",
    summary:
      "Read two lengths in the same fractional unit, then add or subtract the numerators.",
    templateIds: ["fraction-plot-difference"],
    objectives: [
      "Find the difference between the longest and shortest measurements.",
      "Find combined and repeated lengths from a line plot with fourths or eighths.",
    ],
    sections: [
      {
        title: "Name both lengths in the same parts",
        paragraphs: [
          "On a plot marked in fourths, write each length as fourths: 2 3/4 = 11/4 and 1 1/4 = 5/4.",
          "Like fractions count the same size of part, so only the numerators change when adding or subtracting: 11/4 − 5/4 = 6/4 = 1 1/2.",
        ],
        illustration: "data-line-plot-quarters",
      },
      {
        title: "Repeated lengths multiply",
        paragraphs: [
          "Three ribbons at 2 1/4 = 9/4 inches have a total length of 9/4 + 9/4 + 9/4 = 3 × 9/4 = 27/4 inches.",
          "The difference between the longest and shortest is a distance on the number line, so it can be counted in spaces: from 5/4 to 11/4 is 6 spaces of 1/4.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "The longest ribbon is 2 3/4 inches and the shortest is 1 1/4 inches. What is the difference in length, in inches?",
      steps: [
        "In fourths: 2 3/4 = 11/4 and 1 1/4 = 5/4.",
        "11/4 − 5/4 = 6/4 = 3/2, which is 1 1/2 inches.",
      ],
      answer: "3/2",
      answerUnit: "inches",
    },
    pitfalls: [
      "Do not subtract denominators; the size of each part stays the same.",
      "Rewrite a mixed number as a fraction (or subtract wholes and parts separately) before subtracting.",
    ],
    parentGuide:
      "Use a ruler marked in eighths. Measure two objects and find how much longer one is by counting the eighth-inch spaces between their lengths.",
  },
  {
    id: "fraction-plot-computation",
    title: "Share equally from a line plot",
    summary:
      "Pool every amount, then divide by the number of containers: each gets the mean.",
    templateIds: ["fraction-plot-equal-share"],
    objectives: [
      "Find the total of all amounts on a fractional line plot.",
      "Divide the total equally and check that the share lies between the least and greatest amounts.",
    ],
    sections: [
      {
        title: "Pool, then share",
        paragraphs: [
          "Five beakers hold 1/4, 2/4, 2/4, 3/4 and 7/4 liters. Pouring them together gives 15/4 liters; the total does not depend on which beaker held what.",
          "Shared among 5 beakers, each holds 15/4 ÷ 5 = 3/4 liter. On the plot, every × moves to 3/4.",
        ],
        illustration: "data-line-plot-share",
      },
      {
        title: "Why the share is a balance point",
        paragraphs: [
          "Beakers above the share give water and beakers below receive it. The amount given equals the amount received: the beaker at 7/4 gives away 4 fourths, and the others receive 2 + 1 + 1 + 0 = 4 fourths.",
          "So the share always lies between the smallest and largest amounts. This value is the mean.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Five beakers hold 1/4, 2/4, 2/4, 3/4 and 7/4 liters. If the water were shared equally, how many liters would each hold?",
      steps: [
        "Total: (1 + 2 + 2 + 3 + 7)/4 = 15/4 liters.",
        "Share: 15/4 ÷ 5 = 3/4 liter per beaker.",
      ],
      answer: "3/4",
      answerUnit: "liter",
    },
    pitfalls: [
      "Add the amount for every ×, including repeats, before dividing.",
      "Divide by the number of beakers, not by the number of different amounts.",
    ],
    parentGuide:
      "Pour different amounts of water into four identical glasses, then pour them into a jug and share it back out equally. Measure each glass before and after.",
  },
];

export const linePlotMethods: Record<string, ProblemMethod> = {
  "line-plot-whole": {
    goal: "Answer a counting or length question from a whole-unit line plot.",
    terms: [["line plot", "A number line with one × above each measurement."]],
    method: [
      "Find the length the question names on the number line.",
      "Count marks at it, or to its right for “longer than”; count all marks for how many were measured.",
      "For longest minus shortest, subtract the leftmost mark’s length from the rightmost.",
    ],
    watch: "Count × marks, not the numbers on the line.",
  },
  "fraction-line-plot": {
    goal: "Count measurements at or beyond a half- or quarter-unit length on a line plot.",
    method: [
      "Find the named fractional length; each tick is one half or one fourth past the last.",
      "Count the marks at it, or every mark to its right for “longer than”.",
    ],
    watch: "“Longer than” does not include the marks at the named length.",
  },
  "fraction-plot-difference": {
    goal: "Add or subtract lengths read from a fourths or eighths line plot.",
    terms: [["like fractions", "Fractions with the same denominator."]],
    method: [
      "Read each needed length and write it as fourths or eighths.",
      "Add or subtract the numerators; keep the denominator.",
      "For several equal lengths, multiply the length by the number of marks.",
    ],
    watch: "Never add or subtract the denominators.",
  },
  "fraction-plot-equal-share": {
    goal: "Find each container’s amount when the plotted amounts are pooled and shared equally.",
    terms: [["equal share", "The total divided by the number of containers."]],
    method: [
      "Add every plotted amount, one per ×.",
      "Divide the total by the number of containers.",
      "Check the share lies between the least and greatest amounts.",
    ],
    watch:
      "Divide by the number of × marks, not the number of different values.",
  },
};
export const linePlotPrinciples: Record<string, string> = {
  "line-plot-whole":
    "A line plot shows each measurement once, as an × above its value, so counting × marks counts objects.",
  "fraction-line-plot":
    "Ticks between whole numbers split each unit into equal parts, so each tick is one more half or fourth.",
  "fraction-plot-difference":
    "Like fractions count parts of the same size, so a/d ± b/d = (a ± b)/d.",
  "fraction-plot-equal-share":
    "Sharing a total equally gives each container the mean: the sum of all amounts divided by how many there are.",
};
