import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

const shareSenses = {
  whole: "whole",
  part: "part",
  quarter: "fourth",
  difference: "difference-subtract",
  "more than": "more-than",
};
const repeatNoLink = ["period", "periods", "periodic", "scale"];

export const shareRemainderMethods: Record<string, ProblemMethod> = {
  "share-remainder-fractions": {
    goal: "Take fractions of a whole number twice and subtract both from the whole, or scale a fraction of a periodic amount over several periods.",
    senses: shareSenses,
    noLink: repeatNoLink,
    intuition:
      "A fraction names equal parts of a whole. Its denominator, the bottom number, says how many equal parts to split the whole into. Its numerator, the top number, says how many of those parts to take. So $\\frac{3}{4}$ of 120 means: split 120 into 4 equal parts, then take 3 of them. When two fractions name different parts of the same whole, the rest is what is left after both parts are taken away.",
    terms: [
      [
        "part",
        "Here the part is the amount the fraction picks out of the whole.",
      ],
      ["whole", "The rest is the whole minus all the parts already named."],
    ],
    method: [
      "Find each named part on its own. Divide the whole by the denominator, then multiply by the numerator.",
      "For the rest, subtract every named part from the whole.",
      "A periodic amount repeats, like the same pay every month, and each repeat is called a period. Find one period's part, then multiply by the number of periods.",
    ],
    watch:
      "Take every fraction of the same whole, not of the part left before it. The named parts together can be no more than the whole.",
  },
  "share-remainder-percent": {
    goal: "Use percents of a stated total for several groups, then find the remaining group or the difference between two groups.",
    senses: shareSenses,
    noLink: repeatNoLink,
    intuition:
      "A percent is a number out of 100, written with the sign %. So 35% of 500 people means 35 out of every 100 people. When every person is in exactly one group, the groups' percents add up to 100%. Then the group not named has the percent that is left.",
    terms: ["percent", "difference-subtract"],
    method: [
      "Add the named percents. Subtract that sum from 100 to get the percent that is left.",
      "Turn each percent you need into a count. Write the percent as a decimal, a number with a decimal point: 35% is 0.35. Then multiply the total by it.",
      "For a comparison, subtract the smaller count from the larger count.",
    ],
    watch:
      "Find the percent that is left before you turn percents into counts. When the question asks how many more people, subtract counts, not percents.",
  },
};

export const shareRemainderPrinciples: Record<string, string> = {
  "share-remainder-fractions":
    "A fraction $\\frac{a}{b}$ of an amount $N$ is $N\\div b\\times a$. Every part is taken from the same whole, so the rest is $N$ minus the sum of the parts. A part that repeats each period, for $n$ periods, totals $n$ times one period's part.",
  "share-remainder-percent":
    "$p\\%$ of a total $N$ is $N\\times p\\div100$. When the groups cover everyone exactly once, their percents add to 100%. So the percent left is 100 minus the named percents. The difference between two groups is the difference of their counts. That equals $N$ times the difference of their percents, divided by 100.",
};

export const shareRemainderLessons = [
  {
    ...chainLesson({
      id: "share-remainder-chain",
      title: "Parts of a whole, then the rest",
      summary:
        "A fraction names equal parts of a whole. A percent is a number out of 100, like 35%. Both can name part of a whole. Find each named part, always from the same whole. Then subtract to find the rest, or to compare two groups. If a part repeats each week or month, multiply to find the total.",
      templateIds: ["share-remainder-fractions", "share-remainder-percent"],
      objectives: [
        "Find a fraction or percent of a whole for two groups, using the same whole.",
        "Subtract the named parts from the whole, compare two groups, or repeat a part over several weeks or months.",
      ],
      openingTitle: "Every part comes from the same whole",
      opening: [
        "A fraction names equal parts of a whole. Its denominator, the bottom number, says how many equal parts to split the whole into. Its numerator, the top number, says how many to take. So $\\frac{3}{4}$ of 120 means 3 of 4 equal parts of 120.",
        "A percent is a number out of 100. A share of 35% is 35 out of every 100. Each group named in a story is a part of the same whole.",
        "To find the group that is not named, work out the named parts and take them away from the whole. To compare two groups, find both counts and subtract. To total a part that repeats each week or month, find one week's or month's part and multiply.",
      ],
      example: {
        prompt:
          "Of the 120 cookies in a batch, $\\frac{3}{4}$ were oatmeal and $\\frac{1}{10}$ were chocolate chip. The rest were peanut butter. How many were peanut butter?",
        steps: [
          "Oatmeal: split 120 into 4 equal parts, $120\\div4=30$. Take 3 of those parts: $30\\times3=90$.",
          "Chocolate chip: split 120 into 10 equal parts, $120\\div10=12$. Take 1 of those parts: $12\\times1=12$.",
          "Add the named parts: $90+12=102$ cookies.",
          "The rest is the whole minus the named parts: $120-102=18$ cookies.",
        ],
        answer: "18 cookies",
      },
      methodTitle: "Parts, then the rest, a difference or a total",
      method: [
        "Fractions: divide the whole by the denominator, then multiply by the numerator. Percents: write the percent as a decimal, a number with a decimal point, and multiply. So 25% of 200 is $200\\times0.25=50$.",
        "The rest is the whole minus every named part. A difference is the larger count minus the smaller count. For several weeks or months, multiply one week's or month's part by how many there are.",
      ],
      formalTitle: "Why the parts add up",
      formal: [
        "Suppose the groups cover a whole $N$, and no one is in two groups. Then their shares add to 1, or 100%. So the group not named has share 1 minus the named shares. Its count is $N$ minus the named counts.",
        "A part of size $\\frac{a}{b}\\times N$ that repeats for $n$ weeks or months totals $n\\times\\frac{a}{b}\\times N$. This needs the same fraction of the same amount each time.",
      ],
      pitfalls: [
        "Take both fractions of the whole, not the second fraction of what the first left.",
        "The named parts together can be no more than the whole. Check this before you subtract.",
        "When a question asks how many more, subtract counts, not percents.",
      ],
      parentGuide:
        "Ask your child which whole each fraction or percent is taken from. Then check together that the parts and the rest add back up to the whole.",
    }),
    senses: shareSenses,
    noLink: repeatNoLink,
  },
];

export const shareRemainderFacetMappings: FacetMapping[] = [
  {
    templateId: "share-remainder-fractions",
    facetId: "fraction-multiplication.core",
    extent: "partial",
    rationale:
      "Numeric entry for two proper fractions of a whole number up to 120 with exact whole-number parts and the rest, and for a fraction of a multi-digit periodic amount scaled over several periods. Does not assess fractions of fractions, mixed-number wholes, area models, or explaining the steps.",
  },
  {
    templateId: "share-remainder-percent",
    facetId: "percentages.core",
    extent: "partial",
    rationale:
      "Numeric entry for percents of a stated total for three groups, then the remaining group or the difference between two groups, with whole-number counts. Does not assess reading a circle graph's angles, percents that are not multiples of 5, or percents of a part.",
  },
];
