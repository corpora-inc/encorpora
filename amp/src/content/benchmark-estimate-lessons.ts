import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

export const benchmarkEstimateMethods: Record<string, ProblemMethod> = {
  "benchmark-fraction-estimate": {
    goal: "Round each fraction to 0, one half or 1, then add or subtract the benchmarks to estimate a sum, a difference or the amount left.",
    intuition:
      "A benchmark fraction is an easy fraction to think with: 0, one half and 1. A fraction like $\\frac{5}{9}$ is just a little more than $\\frac{1}{2}$, so it can stand in for one half when you only need to know about how much. Rounding first makes the sum or difference easy to do in your head.",
    terms: [
      ["benchmark", "An easy number to compare with: 0, one half or 1."],
      [
        "estimate",
        "An answer that is close to the exact answer but easier to find.",
      ],
    ],
    method: [
      "Decide which benchmark each fraction is closest to: compare its numerator with half of its denominator.",
      "Replace each fraction with its benchmark and add or subtract the benchmarks. For the amount left from a whole, subtract the used amount from 1.",
      "Choose the answer that matches this estimate.",
    ],
    watch:
      "An estimate from benchmarks is close, not exact. For the amount left, subtract the amount used from 1. The amount used is not the answer.",
  },
};

export const benchmarkEstimatePrinciples: Record<string, string> = {
  "benchmark-fraction-estimate":
    "A fraction $\\frac{a}{b}$ is close to 0 when $a$ is much smaller than $\\frac{b}{2}$, close to $\\frac{1}{2}$ when $a$ is about $\\frac{b}{2}$, and close to 1 when $a$ is about $b$. Replacing each fraction by its nearest benchmark changes each by less than about $\\frac{1}{8}$, so a sum or difference of two is within about $\\frac{1}{4}$ of the estimate.",
};

export const benchmarkEstimateLessons = [
  chainLesson({
    id: "benchmark-fraction-estimate-lesson",
    title: "Estimating with 0, one half and 1",
    summary:
      "Round fractions to the nearest benchmark to estimate sums, differences and amounts left.",
    templateIds: ["benchmark-fraction-estimate"],
    objectives: [
      "Decide whether a fraction is closest to 0, one half or 1.",
      "Use the benchmarks to estimate a sum, a difference or the amount left.",
    ],
    openingTitle: "Round to an easy fraction first",
    opening: [
      "The numbers 0, one half and 1 are benchmarks: easy fractions to compare with. To see which one a fraction is near, compare its top number with half of its bottom number. For $\\frac{5}{9}$, half of 9 is 4 and a half, and 5 is just above, so $\\frac{5}{9}$ is close to one half.",
      "Once each fraction is replaced by its benchmark, the arithmetic is easy. Two fractions near one half make about 1. A fraction near 1 minus a fraction near 0 is about 1.",
    ],
    example: {
      prompt:
        "About how much of a pizza is left after friends eat $\\frac{4}{9}$ and $\\frac{1}{10}$ of it?",
      steps: [
        "$\\frac{4}{9}$ is close to $\\frac{1}{2}$, and $\\frac{1}{10}$ is close to 0.",
        "The amount eaten is about $\\frac{1}{2}+0=\\frac{1}{2}$.",
        "The amount left is about $1-\\frac{1}{2}=\\frac{1}{2}$.",
      ],
      answer: "About one half",
    },
    methodTitle: "Round, compute, answer",
    method: [
      "Round each fraction to 0, one half or 1.",
      "Add or subtract the benchmarks. For the amount left from one whole, subtract the used amount from 1.",
    ],
    formalTitle: "Benchmarks and error",
    formal: [
      "$\\frac{a}{b}$ is closest to 0, $\\frac{1}{2}$ or 1 depending on whether $a$ is nearest to 0, $\\frac{b}{2}$ or $b$.",
      "If each fraction is within $\\frac{1}{8}$ of its benchmark, a sum or difference of two is within $\\frac{1}{4}$ of the benchmark sum or difference.",
    ],
    pitfalls: [
      "Giving the amount used when the question asks for the amount left.",
      "Rounding a fraction to the wrong benchmark. Compare the top number with half of the bottom number.",
      "Treating the estimate as exact.",
    ],
    parentGuide:
      "Ask your learner whether each fraction is about none, about half or about all of a whole before they combine them.",
  }),
];

export const benchmarkEstimateFacetMappings: FacetMapping[] = [
  {
    templateId: "benchmark-fraction-estimate",
    facetId: "fraction-addition.core",
    extent: "partial",
    rationale:
      "Single choice of an estimate to 0, one half, 1, one and a half or 2 for a sum, a difference or the amount left, from fractions within a tenth of a benchmark with denominators 7 to 12. Does not assess exact sums with unlike denominators, mixed numbers, or explaining why an estimate is reasonable.",
  },
];
