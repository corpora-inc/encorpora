import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

export const inferenceLessons: Lesson[] = [
  {
    id: "sampling",
    title: "Learning about a population from a sample",
    summary:
      "A random sample resembles its population, so its fractions estimate the population’s; many samples estimate better than one.",
    templateIds: [
      "representative-sample-choice",
      "sample-proportion-estimate",
      "sample-estimates-plot",
    ],
    objectives: [
      "Recognize a random sample and the ways other samples favor a group.",
      "Scale a sample’s fraction up to an estimate for the whole population.",
      "Use the mean of many samples as a steadier estimate than one sample.",
    ],
    sections: [
      {
        title: "Random means everyone has the same chance",
        paragraphs: [
          "To learn how all 900 students feel about a longer lunch, surveying every student is slow. A sample of 60 can answer the question, but only if those 60 resemble the whole school.",
          "Choosing 60 names at random from the full list gives every student the same chance. Asking the student council, or whoever answers an email, favors students who differ from the rest: the sample is biased.",
        ],
      },
      {
        title: "Scale the sample’s fraction",
        paragraphs: [
          "In a random sample of 40 of the 1,200 fish in a lake, 6 are trout. The sample is 6/40 trout, so expect about 6/40 of all the fish to be trout: 6/40 × 1,200 = 180.",
          "Ten random samples of 20 students gave the counts in this dot plot. They vary from 6 to 10, so one sample could estimate anywhere from 240 to 400 of 800 students. Their mean, 8 out of 20, gives 8/20 × 800 = 320, a steadier estimate.",
        ],
        illustration: "data-sample-counts",
      },
    ],
    workedExample: {
      prompt:
        "In a random sample of 50 of the 1,500 voters in a town, 18 support a new park. About how many of the 1,500 voters support it?",
      steps: [
        "The sample is random, so it should resemble the town.",
        "Fraction in the sample: 18/50.",
        "Same fraction of the town: 18/50 × 1,500 = 540.",
      ],
      answer: "About 540 voters",
    },
    pitfalls: [
      "A large sample chosen in a biased way is still biased; random choice matters more than size.",
      "An estimate from a sample is not exact: a different random sample would give a slightly different answer.",
    ],
    parentGuide:
      "Fill a bag with 100 dried beans of two colors in a ratio you keep secret. Draw 20 without looking, estimate the count of each color, and repeat a few times to see the estimates vary.",
  },
  {
    id: "compare-distributions",
    title: "Comparing two groups",
    summary:
      "Compare two groups by their centers, and judge the gap between centers against the spread.",
    templateIds: [
      "means-in-mads",
      "double-box-compare",
      "compare-distributions-choice",
    ],
    objectives: [
      "Express the gap between two means as a multiple of a shared MAD.",
      "Compare the medians and interquartile ranges of two box plots.",
    ],
    sections: [
      {
        title: "Measure the gap in MADs",
        paragraphs: [
          "The morning class’s push-ups have mean 30 ÷ 6 = 5; the afternoon class’s have mean 48 ÷ 6 = 8. Both have a MAD of 1 push-up.",
          "The means are 8 − 5 = 3 push-ups apart, which is 3 ÷ 1 = 3 MADs. A gap of several MADs means the groups overlap little; a gap smaller than one MAD means they overlap a lot, and the difference may be chance.",
        ],
        illustration: "data-double-dot-mads",
      },
      {
        title: "Compare box plots on one scale",
        paragraphs: [
          "Class A’s median, 75, is 10 points above Class B’s, 65: Class A typically scored higher.",
          "Class A’s box runs from 65 to 85, an IQR of 20; Class B’s runs from 60 to 70, an IQR of 10. Class A’s middle half is twice as spread out. Center and spread are separate comparisons: either group can lead in each.",
        ],
        illustration: "data-double-box-scores",
      },
    ],
    workedExample: {
      prompt:
        "Two data sets each have a MAD of 2. Their means are 11 and 16. The difference between the means is how many MADs?",
      steps: ["Difference of the means: 16 − 11 = 5.", "In MADs: 5 ÷ 2 = 2.5."],
      answer: "2.5 MADs",
    },
    pitfalls: [
      "A larger median does not mean a larger spread; compare center and spread separately.",
      "The box length is the IQR. The position of the box shows the center, not the spread.",
    ],
    parentGuide:
      "Time how long each family member takes to tie their shoes, five times each. Compare two people’s mean times, and decide whether the gap is large next to how much each person’s times vary.",
  },
];

export const inferenceMethods: Record<string, ProblemMethod> = {
  "representative-sample-choice": {
    goal: "Choose the method most likely to give a representative sample.",
    terms: [
      [
        "random sample",
        "A sample in which every member of the population has the same chance of being chosen.",
      ],
      ["biased sample", "A sample that favors some members of the population."],
    ],
    method: [
      "Name the population the question is about.",
      "Choose the method that picks at random from all of it.",
    ],
    watch:
      "Volunteers and people who are easy to reach are not chosen at random.",
  },
  "sample-proportion-estimate": {
    goal: "Estimate a population count from a random sample.",
    method: [
      "Write the sample’s fraction: count ÷ sample size.",
      "Multiply that fraction by the population size.",
    ],
    watch: "Multiply by the population, not by the sample size.",
  },
  "sample-estimates-plot": {
    goal: "Estimate a population count from many random samples.",
    method: [
      "Find the mean of the sample counts.",
      "Write it as a fraction of the sample size and multiply by the population size.",
    ],
    watch: "Each dot is one whole sample’s count, not one person.",
  },
  "means-in-mads": {
    goal: "Express the difference between two means in MADs.",
    terms: [
      [
        "MAD",
        "Mean absolute deviation: the mean distance of the values from their mean.",
      ],
    ],
    method: [
      "Find the mean of each group.",
      "Subtract the smaller mean from the larger.",
      "Divide the difference by the MAD.",
    ],
    watch: "Divide the gap by the MAD; do not subtract the MAD.",
  },
  "double-box-compare": {
    goal: "Compare two box plots drawn on one scale.",
    method: [
      "Read the median line and the box ends of each plot.",
      "Subtract medians to compare centers; subtract box lengths to compare IQRs.",
    ],
    watch: "The IQR is a box’s length, not where the box sits.",
  },
  "compare-distributions-choice": {
    goal: "Choose the true comparison of two box plots.",
    method: [
      "Compare the median lines: which is farther right?",
      "Compare the box lengths: which is longer?",
      "Choose the statement that matches both answers.",
    ],
    watch: "The group with the greater median need not have the greater IQR.",
  },
};
export const inferencePrinciples: Record<string, string> = {
  "representative-sample-choice":
    "A random sample gives every member of the population the same chance, so it tends to resemble the population.",
  "sample-proportion-estimate":
    "A random sample’s fraction estimates the population’s fraction: estimate = (count ÷ sample size) × population.",
  "sample-estimates-plot":
    "Random samples vary; the mean of many samples is a steadier estimate than any one.",
  "means-in-mads":
    "The gap between two means, divided by the shared MAD, measures how far apart the groups are compared with their spread.",
  "double-box-compare":
    "Medians compare the centers of two box plots; box lengths compare their spreads.",
  "compare-distributions-choice":
    "Center and spread are separate comparisons: either group can lead in each.",
};
