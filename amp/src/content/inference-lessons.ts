import { studyDesignLesson, studyDesignMethod } from "./study-design-content";
import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

export const inferenceLessons: Lesson[] = [
  studyDesignLesson,
  {
    id: "sampling",
    title: "Learning about a population from a sample",
    summary:
      "A population is the whole group you want to learn about, such as all 900 students in a school. A sample is the part of that group you actually ask or observe, such as 60 of them. If the sample is chosen at random, so everyone has the same chance, it tends to look like the population. Then the sample's fraction gives an estimate, a careful guess, for the whole group.",
    templateIds: [
      "representative-sample-choice",
      "sample-proportion-estimate",
      "sample-estimates-plot",
    ],
    senses: {
      population: "population",
      sample: "sample",
      samples: "sample",
      whole: "whole",
      part: "part",
      mean: "mean-average",
      average: "mean-average",
      "more than": "more-than",
    },
    noLink: ["scale"],
    objectives: [
      "Recognize a random sample, and the ways other samples favor one group.",
      "Use a sample's fraction to estimate a count for the whole population.",
      "Use the mean of many samples as a steadier estimate than one sample.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "A simple random sample",
        paragraphs: [
          "A school wants to know how all 900 of its students feel about a longer lunch. The 900 students are the population, the whole group the question is about. Asking every student would be slow.",
          "Instead, the school can ask a sample of 60 students. A sample is the part of the population that is actually asked.",
          "A random sample is chosen by chance, like drawing 60 names from a hat holding all 900 names. Every student has the same chance of being picked. So no group is favored, and the sample tends to look like the whole school.",
          "Asking only the student council, or only those who answer an email, favors some students. Those students may think differently from the rest. A sample like that is called biased.",
          "An answer from a sample is an estimate, a careful guess. Another random sample could give a different answer.",
        ],
      },
      {
        title: "Scale the sample’s fraction",
        paragraphs: [
          "A lake has 1,200 fish. In a random sample of 40 of them, 6 are trout. So $\\frac{6}{40}$ of the sample are trout.",
          "A random sample tends to look like the population. So expect about $\\frac{6}{40}$ of all the fish to be trout: $\\frac{6}{40} \\times 1200 = 180$ trout.",
          "Ten random samples of 20 students gave the counts in this dot plot, one dot per sample. The counts vary from 6 to 10. So one sample alone could estimate anywhere from 240 to 400 of 800 students.",
          "The mean is the total divided by the number of values. For the ten counts, the mean is 8 out of 20. That gives $\\frac{8}{20} \\times 800 = 320$ students. The mean of many samples is a steadier estimate than any one sample.",
        ],
        illustration: "data-sample-counts",
      },
    ],
    workedExample: {
      prompt:
        "In a random sample of 50 of the 1,500 voters in a town, 18 support a new park. About how many of the 1,500 voters support it?",
      steps: [
        "The sample was chosen at random from the town's voters. So its fraction can estimate the fraction for the whole town.",
        "Find the fraction in the sample: 18 of 50 support the park, which is $\\frac{18}{50}$.",
        "Take the same fraction of all the voters: $\\frac{18}{50} \\times 1500 = 540$.",
        "This is an estimate. Another random sample could give a different number.",
      ],
      answer: "About 540 voters",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "In a simple random sample of a fixed size, every possible group of that size has the same chance of being chosen. This lets the sample estimate the population. No single sample is sure to match it.",
          "Suppose a population has $N$ members. In a sample of $n$ members, $k$ have some trait. Estimate the number in the population with the trait as $N \\times \\frac{k}{n}$. The estimate can be off because samples vary.",
          "Repeated random samples vary. The mean of their estimates usually varies less than one estimate. But averaging cannot fix a sample that was chosen in a biased way.",
        ],
      },
    ],
    pitfalls: [
      "A large sample chosen in a biased way is still biased. Choosing at random matters more than size.",
      "An estimate from a sample is not exact. A different random sample would give a different answer.",
      "Multiply the sample's fraction by the population size, not by the sample size.",
    ],
    parentGuide:
      "Fill a bag with 100 dried beans of two colors, keeping the mix secret. The learner draws 20 without looking and estimates how many of each color are in the bag. Repeat a few times to see the estimates vary.",
  },
  {
    id: "compare-distributions",
    title: "Comparing two groups",
    summary:
      "Data are numbers or facts someone collected, such as test scores. To compare two groups, compare a typical value and a spread. The mean is the total divided by the number of values. The mean absolute deviation is the average distance of the values from their mean, written MAD. Measure the gap between two means in MADs. On box plots, compare the middle values and the box widths, one at a time.",
    templateIds: [
      "means-in-mads",
      "double-box-compare",
      "compare-distributions-choice",
    ],
    senses: {
      mean: "mean-average",
      average: "mean-average",
      difference: "difference-subtract",
      multiple: "multiple",
    },
    noLink: ["center", "centers"],
    objectives: [
      "Write the gap between two means as a number of MADs, when both groups share a MAD.",
      "Compare the medians and the interquartile ranges of two box plots.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Measure the gap in MADs",
        paragraphs: [
          "The mean is the total divided by the number of values. Six morning students do 30 push-ups in total, and six afternoon students do 48. Their means are $30 \\div 6 = 5$ and $48 \\div 6 = 8$ push-ups.",
          "A value's distance from the mean is how far it is, above or below. The mean absolute deviation, or MAD, is the average of those distances. Suppose each class has a MAD of 1 push-up.",
          "The means are $8 - 5 = 3$ push-ups apart. Divide by the MAD: $3 \\div 1 = 3$ MADs. This compares the gap between the groups with how far values usually are from their own mean.",
          "A gap of many MADs means the groups overlap little. The number alone does not say why the groups differ.",
        ],
        illustration: "data-double-dot-mads",
      },
      {
        stage: "intuition",
        title: "Read the middle half of a box plot",
        paragraphs: [
          "A box plot shows data in order. The line inside the box is the median, the middle value. The box runs from the lower quartile, $Q_1$, to the upper quartile, $Q_3$. These are the middles of the lower half and the upper half of the data.",
          "The interquartile range, or IQR, is $Q_3 - Q_1$, the width of the box. It is the spread of the middle half of the data.",
          "A higher median means the values are typically higher. A wider box means the middle half is more spread out.",
        ],
      },
      {
        title: "Compare box plots on one scale",
        paragraphs: [
          "Class A’s median is 75 and Class B’s is 65. Class A’s is 10 points higher, so Class A typically scored higher.",
          "Class A’s box runs from 65 to 85, so its IQR is $85 - 65 = 20$. Class B’s box runs from 60 to 70, so its IQR is $70 - 60 = 10$. Class A’s middle half is twice as spread out.",
          "The typical value and the spread are separate comparisons. Either group can be ahead in each one.",
        ],
        illustration: "data-double-box-scores",
      },
    ],
    workedExample: {
      prompt:
        "Two data sets each have a MAD of 2. Their means are 11 and 16. The difference between the means is how many MADs?",
      steps: [
        "Find the gap between the means by subtracting the smaller from the larger: $16 - 11 = 5$.",
        "Find how many MADs fit in that gap by dividing by the MAD: $5 \\div 2 = 2.5$.",
      ],
      answer: "2.5 MADs",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "When both groups have the same MAD, greater than 0, divide the gap between their means by that MAD. This compares the difference in typical values with the usual spread. It does not by itself show a cause.",
          "For two box plots, the medians compare the typical values and the box lengths compare the spreads.",
          "Typical value and spread are separate comparisons. Either group can be ahead in each.",
        ],
      },
    ],
    pitfalls: [
      "A larger median does not mean a larger spread. Compare the typical value and the spread separately.",
      "The box length is the IQR. Where the box sits shows the typical values, not the spread.",
      "Divide the gap between the means by the MAD. Do not subtract the MAD.",
    ],
    parentGuide:
      "Time how long each family member takes to tie their shoes, five times each. Compare two people’s mean times. Decide whether the gap is large next to how much each person’s times vary.",
  },
];

export const inferenceMethods: Record<string, ProblemMethod> = {
  "scope-of-inference-choice": studyDesignMethod,
  "representative-sample-choice": {
    goal: "Choose the method most likely to give a representative sample.",
    senses: {
      sample: "sample",
      population: "population",
      whole: "whole",
      part: "part",
    },
    intuition:
      "The population is the whole group a question is about. A sample is the part of it you actually ask. A sample is representative when it looks like the whole population. Choosing at random from the whole population gives every member the same chance. A sample from a method that favors one group, such as volunteers, is called a biased sample.",
    terms: ["random-sample", "biased-sample"],
    method: [
      "Name the population the question is about.",
      "Choose the method that picks at random from all of it.",
    ],
    watch:
      "Volunteers and people who are easy to reach are not chosen at random.",
  },
  "sample-proportion-estimate": {
    goal: "Estimate a population count from a random sample.",
    senses: {
      sample: "sample",
      population: "population",
      whole: "whole",
      part: "part",
    },
    intuition:
      "The population is the whole group, such as all 4,000 bulbs. A sample is the part you check, such as 80 bulbs. A random sample is one chosen by chance from the whole group. It tends to look like the population. So the fraction in the sample estimates the fraction in the whole group.",
    terms: ["population", "sample"],
    method: [
      "Write the sample's fraction: count ÷ sample size.",
      "Multiply that fraction by the population size.",
    ],
    watch: "Multiply by the population size, not by the sample size.",
  },
  "sample-estimates-plot": {
    goal: "Estimate a population count from many random samples.",
    senses: {
      mean: "mean-average",
      sample: "sample",
      samples: "sample",
      population: "population",
      whole: "whole",
      part: "part",
    },
    intuition:
      "The population is the whole group. A sample is a part of it that is checked. A random sample is one chosen by chance. Here many random samples were taken, and each dot shows one sample's count. Samples vary, so one sample alone may be far off. The mean is the total of the counts divided by how many there are. It gives a steadier estimate.",
    terms: ["population", "sample", "mean-average"],
    method: [
      "Find the mean of the sample counts: add them and divide by the number of samples.",
      "Write that mean as a fraction of the sample size. Multiply by the population size.",
    ],
    watch: "Each dot is one whole sample's count, not one person.",
  },
  "means-in-mads": {
    goal: "Express the difference between two means in MADs.",
    senses: { mean: "mean-average", difference: "difference-subtract" },
    noLink: ["centers"],
    intuition:
      "The mean is the total divided by the number of values. The mean absolute deviation is the average distance of the values from their mean, written MAD. When two groups have the same MAD, greater than 0, divide the gap between their means by it. The answer says how many MADs apart the groups are. The more MADs apart the means are, the more separate the two groups usually are.",
    terms: ["mean-average", "mean-absolute-deviation"],
    method: [
      "Find the mean of each group: total ÷ number of values.",
      "Subtract the smaller mean from the larger.",
      "Divide that difference by the MAD.",
    ],
    watch: "Divide the gap by the MAD. Do not subtract the MAD.",
  },
  "double-box-compare": {
    goal: "Compare two box plots drawn on one scale.",
    senses: { scale: "scale-axis" },
    noLink: ["center", "centers"],
    intuition:
      "Data are numbers or facts someone collected, such as test scores. A box plot's median, the line inside the box, is its middle value. The lower quartile is the middle of the lower half of the data, and the upper quartile is the middle of the upper half. The box runs between them, so it holds the middle half of the data. The box's length is the interquartile range (IQR). Compare medians to compare typical values. Compare box lengths to compare spreads.",
    terms: ["median", "interquartile-range"],
    method: [
      "Read the median line and the two box ends of each plot.",
      "Subtract the medians to compare typical values. Subtract box ends to find each IQR.",
      "For “how many IQRs”, divide the gap between the medians by the IQR.",
    ],
    watch: "The IQR is a box's length, not where the box sits.",
  },
  "compare-distributions-choice": {
    goal: "Choose the true comparison of two box plots.",
    noLink: ["center"],
    intuition:
      "Data are numbers or facts someone collected, such as test scores. A box plot is a graph of data drawn around a box. The line inside the box is the median, the middle value. The lower quartile is the middle of the lower half of the data, and the upper quartile is the middle of the upper half. The box runs between them. The box's length is the interquartile range (IQR), the spread of the middle half of the data. One group can have a higher median and still have a shorter box.",
    terms: ["median", "interquartile-range"],
    method: [
      "Compare the median lines. Which is farther right?",
      "Compare the box lengths. Which is longer?",
      "Choose the statement that matches both answers.",
    ],
    watch: "The group with the greater median need not have the greater IQR.",
  },
};
export const inferencePrinciples: Record<string, string> = {
  "scope-of-inference-choice":
    "Random sampling supports generalization to the sampled population; random treatment assignment supports a causal comparison. Judge these separately, allowing for uncertainty and study quality.",
  "representative-sample-choice":
    "A random sample gives every member of the population the same chance of being chosen, so it tends to look like the population.",
  "sample-proportion-estimate":
    "A random sample's fraction estimates the population's fraction: estimate = (count ÷ sample size) × population size.",
  "sample-estimates-plot":
    "Random samples taken the same way vary. Averaging their estimates usually reduces that variation, but it does not fix a biased way of choosing.",
  "means-in-mads":
    "When two groups share a MAD greater than 0, the gap between their means divided by that MAD compares their typical values with their usual spread.",
  "double-box-compare":
    "For two box plots, the medians compare the typical values and the box lengths compare the spreads.",
  "compare-distributions-choice":
    "Typical value and spread are separate comparisons: either group can be ahead in each.",
};
