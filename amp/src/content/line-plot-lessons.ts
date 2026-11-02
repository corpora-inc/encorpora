import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

export const linePlotLessons: Lesson[] = [
  {
    id: "line-plots",
    title: "Line plots of measurements",
    summary:
      "To measure is to find how long something is. A number line is a line with numbers in order, evenly spaced. A line plot shows measurements on a number line. Each thing you measured gets one × above its length. Things with the same length make a stack of × marks.",
    templateIds: ["line-plot-whole"],
    senses: { difference: "difference-subtract", "more than": "more-than" },
    objectives: [
      "Read how many things have a given length, or are longer than it.",
      "Find how many things were measured, and how much longer the longest is than the shortest.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Every mark is one measurement",
        paragraphs: [
          "Say you measure some pencils with a ruler, in inches. An inch is about as long as the top part of your thumb. Draw a number line with the lengths in inches. Put one × above the length of each pencil.",
          "Two pencils of the same length make a stack of two × marks. So the plot shows each length, and how many pencils have it.",
        ],
      },
      {
        title: "Every measurement gets one mark",
        paragraphs: [
          "Look at the picture. Seven pencils measure 4, 5, 5, 6, 6, 6 and 8 inches. Each pencil has one × above its length.",
          "Three pencils are 6 inches long, so there is a stack of three × marks above 6. No pencil is 7 inches, so nothing is above 7.",
        ],
        illustration: "data-line-plot-inches",
      },
      {
        title: "Questions the plot answers",
        paragraphs: [
          "Numbers get bigger to the right. So longer than 5 inches means to the right of 5. That is the three 6s and the 8: 4 pencils. The two pencils at 5 are not longer than 5.",
          "To find how many pencils were measured, count every ×: there are 7.",
          "The longest pencil is the × farthest right. The shortest is the × farthest left. Taking the shorter length away from the longer one leaves how much longer it is: 8 − 4 = 4 inches.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "One mark for each measurement",
        paragraphs: [
          "A line plot puts one mark above a number line at the value of each measurement. The number of marks above a value tells how many times it was measured.",
          "Adding up the marks counts all the measurements.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Pencils measure 4, 5, 5, 6, 6, 6 and 8 inches. How many pencils are longer than 5 inches?",
      steps: [
        "Numbers get bigger to the right, so longer than 5 means to the right of 5. The marks at 5 do not count.",
        "To the right of 5 there are 3 marks at 6 and 1 mark at 8. Add them: 3 + 1 = 4.",
      ],
      answer: "4",
    },
    pitfalls: [
      "Count the × marks, not the numbers on the line.",
      "Longer than leaves out the marks at the named length itself.",
    ],
    parentGuide:
      "Measure six spoons, pencils or shoes to the nearest inch. Draw a number line and let your child put one × per object, then ask which length is most common.",
  },
  {
    id: "fraction-line-plots",
    title: "Line plots with halves and fourths",
    summary:
      "A number line is a line with numbers in order, evenly spaced. A line plot puts one × above the number line at the length of each thing measured. A fraction names equal parts of a whole. 1/2 is one of 2 equal parts, one half. 1/4 is one of 4 equal parts, one fourth. Whole numbers are 0, 1, 2, 3 and so on. The space from one whole number to the next can be split into halves or fourths. 1 1/2 means 1 whole and one half more.",
    templateIds: ["fraction-line-plot"],
    senses: { whole: "whole", part: "part", "more than": "more-than" },
    noLink: ["interval"],
    objectives: [
      "Find halves and fourths of an inch on a line plot.",
      "Count the measurements at, or longer than, a length with a fraction.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Read the spaces before the marks",
        paragraphs: [
          "A fraction like 1/4 names equal parts. The bottom number says how many equal parts make one whole. The top number says how many of those parts you have. So 1/4 is one of 4 equal parts, read one fourth.",
          "On a ruler, split the space from 1 to 2 into 4 equal spaces. Each space is 1/4 inch. One space past 1 is 1 and 1/4 more. We write that as 1 1/4, read one and one fourth.",
        ],
      },
      {
        title: "Each space is one fourth",
        paragraphs: [
          "Look at the picture. A tick is a small mark on the line. Between two whole numbers there are 4 equal spaces. So each tick is 1/4 inch past the one before it. Going from 1 to 2, the ticks are 1, 1 1/4, 1 1/2, 1 3/4 and 2.",
          "Why is the middle tick 1 1/2? Two fourths make one half, so 1 2/4 and 1 1/2 are the same spot. The plot writes it as 1 1/2.",
        ],
        illustration: "data-line-plot-quarters",
      },
      {
        title: "Read before you count",
        paragraphs: [
          "Find the length the question names first. Then count the × marks above it. In the picture, three ribbons are 2 1/4 inches long.",
          "Longer than 1 1/2 inches means to the right of 1 1/2. Count everything there: three at 2 1/4 and one at 2 3/4. That is 4 ribbons.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Equal spaces name equal parts",
        paragraphs: [
          "Split the space from one whole number to the next into equal spaces. If there are 4 spaces, each is 1/4 of a whole. If there are 2, each is 1/2.",
          "A mark's place is the whole number to its left, plus the spaces past it, each worth its fraction. Three 1/4 spaces past 1 is 1 3/4.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Ribbons measure 1 1/4, 1 1/2, 1 1/2, 2 1/4, 2 1/4, 2 1/4 and 2 3/4 inches. How many ribbons are longer than 1 1/2 inches?",
      steps: [
        "Numbers get bigger to the right, so longer than 1 1/2 means to the right of 1 1/2. The marks at 1 1/2 do not count.",
        "To the right there are three marks at 2 1/4 and one at 2 3/4. Add them: 3 + 1 = 4.",
      ],
      answer: "4",
    },
    pitfalls: [
      "A tick between two whole numbers is a fraction of an inch, not the next whole number.",
      "2 1/4 is just past 2, not before it. Count the spaces from the whole number on the left.",
    ],
    parentGuide:
      "Cut a few strips of paper and measure them to the nearest quarter inch. Mark each length on a number line with fourths and compare the stacks.",
  },
  {
    id: "fraction-plot-arithmetic",
    title: "Add and subtract lengths from a line plot",
    summary:
      "A number line is a line with numbers in order, evenly spaced. A line plot puts one × above it for each thing measured. A fraction like 3/4 means 3 of 4 equal parts. 2 3/4 means 2 wholes and 3/4 more. To add or subtract two lengths, first write both in the same size of part, like fourths: the parts you get when a whole is split into 4 equal parts. Then count the parts.",
    templateIds: ["fraction-plot-difference"],
    senses: {
      whole: "whole",
      part: "part",
      difference: "difference-subtract",
    },
    objectives: [
      "Find how much longer the longest measurement is than the shortest.",
      "Find the total of several lengths from a line plot marked in fourths or eighths.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Use the plot's pieces",
        paragraphs: [
          "In a fraction like 3/4, the bottom number is the denominator. It says how many equal parts make one whole. The top number is the numerator. It counts the parts you have.",
          "Say a line plot is marked in fourths. Then every step is one fourth of an inch. Write both lengths as a number of fourths. Now adding or subtracting is just counting fourths.",
        ],
      },
      {
        title: "Name both lengths in the same parts",
        paragraphs: [
          "Look at the picture. It is marked in fourths. Each whole inch is 4 fourths.",
          "So 2 3/4 is 2 wholes, which is 8 fourths, and 3 more fourths: 11/4. And 1 1/4 is 4 fourths and 1 more: 5/4.",
          "Fractions with the same denominator are called like fractions. Their parts are the same size. So to subtract, subtract the numerators and keep the denominator: 11/4 − 5/4 = 6/4. That is 1 whole and 2/4, which is 1 1/2.",
        ],
        illustration: "data-line-plot-quarters",
      },
      {
        title: "Repeated lengths multiply",
        paragraphs: [
          "Three ribbons are each 2 1/4 = 9/4 inches long. Their total is 9/4 + 9/4 + 9/4. Adding the same number 3 times is the same as multiplying by 3: 3 × 9/4 = 27/4 inches.",
          "How much longer one length is than another is a distance on the number line. You can count it in spaces: from 5/4 to 11/4 is 6 spaces of 1/4.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Add equal-sized parts",
        paragraphs: [
          "To add or subtract lengths from a plot, write them with the same denominator. Then add or subtract the numerators.",
          "Keep the denominator, because every part counted is the same size.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "The longest ribbon is 2 3/4 inches and the shortest is 1 1/4 inches. What is the difference in length, in inches?",
      steps: [
        "Write both lengths in fourths, so the parts are the same size. 2 3/4 is 8 fourths and 3 more: 11/4. 1 1/4 is 4 fourths and 1 more: 5/4.",
        "The difference is the subtraction answer. Subtract the numerators and keep the fourths: 11/4 − 5/4 = 6/4.",
        "6/4 is the same as 3/2, which is 1 1/2 inches.",
      ],
      answer: "3/2",
      answerUnit: "inches",
    },
    pitfalls: [
      "Do not subtract the denominators. The size of each part stays the same.",
      "Write a mixed number, a whole number with a fraction like 2 3/4, as fourths or eighths before you subtract. Or subtract the wholes and the parts separately. If the first fraction part is smaller, trade 1 whole for 4 fourths, or 8 eighths, first.",
    ],
    parentGuide:
      "Use a ruler marked in eighths. Measure two objects and find how much longer one is by counting the eighth-inch spaces between their lengths.",
  },
  {
    id: "fraction-plot-computation",
    title: "Share equally from a line plot",
    summary:
      "A number line is a line with numbers in order, evenly spaced. A line plot puts one × above the number line at each amount measured. Sharing equally means every container ends up with the same amount. To find that amount, add all the amounts. Then divide the total by the number of containers. That equal share is called the mean.",
    templateIds: ["fraction-plot-equal-share"],
    senses: { mean: "mean-average", part: "part", whole: "whole" },
    objectives: [
      "Find the total of all the amounts on a line plot with fractions.",
      "Divide the total equally, and check that the share is between the least and greatest amounts.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Share a measured total",
        paragraphs: [
          "A beaker is a glass jar used for measuring. Five beakers hold different amounts of water, measured in liters. A liter is an amount of liquid: a big water bottle holds about 1 liter. Pour all the water into one big jug. The total amount of water stays the same.",
          "Now pour it back so every beaker gets the same amount. That amount is the equal share. It is also called the mean.",
        ],
      },
      {
        title: "Pool, then share",
        paragraphs: [
          "Look at the picture. Five beakers hold 1/4, 2/4, 2/4, 3/4 and 7/4 liters.",
          "All the parts are fourths, so add the numerators, the top numbers: 1 + 2 + 2 + 3 + 7 = 15. The total is 15/4 liters.",
          "Share it among 5 beakers: 15 fourths split 5 ways is 3 fourths each. So 15/4 ÷ 5 = 3/4 liter. On the plot, every × would move to 3/4.",
        ],
        illustration: "data-line-plot-share",
      },
      {
        title: "Why the share is in the middle",
        paragraphs: [
          "Beakers with more than the share give water away. Beakers with less get water. The water given away is the same as the water received.",
          "The beaker at 7/4 gives away 4 fourths to reach 3/4. The others get 2, 1, 1 and 0 fourths. That is 4 fourths too. So the share is always between the smallest and largest amounts.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Equal share of a measured total",
        paragraphs: [
          "The mean of some amounts is their total divided by how many amounts there are.",
          "It is the amount each would have if the total were shared equally. It uses the same unit as the amounts.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Five beakers hold 1/4, 2/4, 2/4, 3/4 and 7/4 liters. If the water were shared equally, how many liters would each hold?",
      steps: [
        "First find the total, because sharing starts with all the water together. All the amounts are fourths, so add the top numbers: 1 + 2 + 2 + 3 + 7 = 15. The total is 15/4 liters.",
        "Then share it equally among the 5 beakers. 15 fourths split 5 ways is 3 fourths each: 15/4 ÷ 5 = 3/4 liter for each beaker.",
        "Check: fuller beakers give water and emptier ones get it, so the share must be between the least and greatest amounts. 3/4 is between 1/4 and 7/4.",
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

const linePlot =
  "A number line is a line with numbers in order, evenly spaced. A line plot puts one × above the number line at the value of each thing measured.";
export const linePlotMethods: Record<string, ProblemMethod> = {
  "line-plot-whole": {
    goal: "Answer a counting or length question from a whole-unit line plot.",
    intuition: `${linePlot} Things with the same length make a stack. Numbers get bigger to the right, so longer lengths are farther right.`,
    terms: [
      [
        "dot-plot",
        "Here each measurement is marked with an × instead of a dot.",
      ],
    ],
    senses: { difference: "difference-subtract" },
    method: [
      "Find the length the question names on the number line.",
      "Count the × marks above it. For longer than, count every × to its right. For how many were measured, count every ×.",
      "For how much longer the longest is than the shortest, subtract the length of the leftmost × from the rightmost.",
    ],
    watch: "Count the × marks, not the numbers on the line.",
  },
  "fraction-line-plot": {
    goal: "Count measurements at or beyond a half- or quarter-unit length on a line plot.",
    intuition: `${linePlot} 1/2 is one of 2 equal parts of a whole, one half. 1/4 is one of 4 equal parts, one fourth. 1 1/2 means 1 whole and one half more. Whole numbers are 0, 1, 2, 3 and so on. A tick is a small mark on the line. Count the spaces between two whole numbers: 2 spaces means halves, and 4 spaces means fourths.`,
    senses: { whole: "whole", part: "part" },
    method: [
      "Find the length the question names. Count spaces from the whole number to its left: each tick is one more half or one more fourth.",
      "Count the × marks above it. For longer than, count every × to its right.",
    ],
    watch: "Longer than does not include the marks at the named length.",
  },
  "fraction-plot-difference": {
    goal: "Add or subtract lengths read from a fourths or eighths line plot.",
    intuition: `${linePlot} A fraction like 3/4 means 3 of 4 equal parts. The bottom number, the denominator, says how many equal parts make one whole. The top number, the numerator, counts the parts. 2 3/4 means 2 wholes and 3/4 more, which is 11/4.`,
    terms: ["like-fractions"],
    senses: { whole: "whole", part: "part" },
    method: [
      "Read each length you need. Write it as fourths or eighths, the parts the plot uses.",
      "Add or subtract the numerators. Keep the denominator, because the parts stay the same size.",
      "For several equal lengths, multiply the length by the number of × marks.",
    ],
    watch: "Never add or subtract the denominators.",
  },
  "fraction-plot-equal-share": {
    goal: "Find each container’s amount when the plotted amounts are pooled and shared equally.",
    intuition: `${linePlot} Here each × is one container and its amount. Sharing equally means every container ends up with the same amount. To find it, put all the amounts together, then split the total into equal parts, one for each container.`,
    terms: [
      [
        "mean-average",
        "Here, the total amount divided by the number of containers.",
      ],
    ],
    senses: { mean: "mean-average", part: "part" },
    method: [
      "Add every amount, once for each ×.",
      "Divide the total by the number of containers.",
      "Check that the share is between the least and greatest amounts.",
    ],
    watch:
      "Divide by the number of × marks, not the number of different amounts.",
  },
};
export const linePlotPrinciples: Record<string, string> = {
  "line-plot-whole":
    "A line plot shows each measurement once, as an × above its value. So counting × marks counts the things measured.",
  "fraction-line-plot":
    "Ticks between whole numbers split each whole into equal parts. So each tick is one more half or one more fourth.",
  "fraction-plot-difference":
    "Like fractions count parts of the same size. With numerators $a$ and $b$ and the same denominator $d$, $\\frac{a}{d} + \\frac{b}{d} = \\frac{a + b}{d}$ and $\\frac{a}{d} - \\frac{b}{d} = \\frac{a - b}{d}$: add or subtract the numerators, and keep the denominator.",
  "fraction-plot-equal-share":
    "Sharing a total equally gives each container the mean: the total of all the amounts divided by how many there are.",
};
