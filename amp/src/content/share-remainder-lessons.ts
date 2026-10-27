import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

export const shareRemainderMethods: Record<string, ProblemMethod> = {
  "share-remainder-fractions": {
    goal: "Take fractions of a whole number twice and subtract both from the whole, or scale a fraction of a periodic amount over several periods.",
    intuition:
      "A fraction of a whole number means splitting the whole into equal parts and taking some of them: $\\frac{3}{4}$ of 120 is three of four equal parts of 120. When two fractions describe different parts of the same whole, the rest is what is left after both parts are removed.",
    terms: [
      ["part", "The amount a fraction of a whole picks out."],
      ["the rest", "The whole minus all the parts already named."],
    ],
    method: [
      "Find each named part separately: divide the whole by the denominator, then multiply by the numerator.",
      "For the rest, subtract every part from the whole. For a periodic amount, find one period's part first.",
      "Multiply one period's part by the number of periods when the question spans several periods.",
    ],
    watch:
      "Take every fraction of the same whole, not of the part before it. Check that the named parts together are less than the whole.",
  },
  "share-remainder-percent": {
    goal: "Use percents of a stated total for several groups, then find the remaining group or the difference between two groups.",
    intuition:
      "A percent is a number of hundredths, so 35% of 500 people is 35 out of every 100. Percents of one whole add up to 100%, so the group not named has the percent that is left.",
    terms: [
      ["share", "The percent of the whole that one group makes up."],
      [
        "difference",
        "How many more one group has than another: subtract the smaller count from the larger.",
      ],
    ],
    method: [
      "Add the named percents and subtract from 100 to get the remaining percent.",
      "Turn each percent you need into a count: multiply the total by the percent written as a decimal.",
      "For a comparison, subtract the smaller count from the larger.",
    ],
    watch:
      "Find the remaining percent before you convert to counts, and subtract counts, not percents, when the question asks how many more people.",
  },
};

export const shareRemainderPrinciples: Record<string, string> = {
  "share-remainder-fractions":
    "A fraction $\\frac{a}{b}$ of a whole number $N$ is $N\\div b\\times a$. Parts of one whole are taken from the same whole, so the rest is $N$ minus the sum of the parts, and a part that repeats each period over $n$ periods totals $n$ times one period's part.",
  "share-remainder-percent":
    "$p\\%$ of a total $N$ is $N\\times p/100$. Shares of one whole add to 100%, so the remaining share is 100 minus the named shares, and the difference between two groups is the difference of their counts, which equals $N$ times the difference of their percents divided by 100.",
};

export const shareRemainderLessons = [
  chainLesson({
    id: "share-remainder-chain",
    title: "Parts of a whole, then the rest",
    summary:
      "Find each named part of a whole, then subtract to get the rest, a difference, or the total over several periods.",
    templateIds: ["share-remainder-fractions", "share-remainder-percent"],
    objectives: [
      "Find a fraction or percent of a whole for two groups using the same whole.",
      "Subtract the named parts from the whole, compare two groups, or repeat a part over several periods.",
    ],
    openingTitle: "Every part comes from the same whole",
    opening: [
      "A fraction of a number splits that number into equal parts and takes some. A percent is a number of hundredths, so a share of 35% is 35 out of every 100. Each group named in a story is a part of the same whole.",
      "To find the group that is not named, work out the named parts and take them away from the whole. To compare two groups, find both counts and subtract. To total a part that repeats each week or month, find one period's part and multiply.",
    ],
    example: {
      prompt:
        "Of the 120 cookies in a batch, $\\frac{3}{4}$ were oatmeal and $\\frac{1}{10}$ were chocolate chip. The rest were peanut butter. How many were peanut butter?",
      steps: [
        "Oatmeal: $120\\div4=30$ for one fourth, and $30\\times3=90$.",
        "Chocolate chip: $120\\div10=12$ for one tenth, and $12\\times1=12$.",
        "The named parts total $90+12=102$ cookies.",
        "The rest is $120-102=18$ cookies.",
      ],
      answer: "18 cookies",
    },
    methodTitle: "Parts, then rest, difference or periods",
    method: [
      "Fractions: divide the whole by the denominator and multiply by the numerator. Percents: multiply the total by the percent as a decimal, so 25% of 200 is $200\\times0.25=50$.",
      "Rest: whole minus every named part. Difference: larger count minus smaller count. Several periods: one period's part times the number of periods.",
    ],
    formalTitle: "Why the parts add up",
    formal: [
      "If the groups cover a whole $N$ without overlap, their shares add to 1 (or 100%), so the unnamed group has share $1$ minus the named shares and count $N$ minus the named counts.",
      "A part of size $\\frac{a}{b}N$ that repeats for $n$ periods totals $n\\cdot\\frac{a}{b}N$. This requires the same fraction of the same amount each period.",
    ],
    pitfalls: [
      "Take both fractions of the whole, not the second fraction of what the first left.",
      "Check that the named parts together are less than the whole before you subtract.",
      "When a question asks how many more, subtract counts rather than percents.",
    ],
    parentGuide:
      "Ask your learner to say which whole each fraction or percent is taken from, and to check that the parts and the rest add back to the whole.",
  }),
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
