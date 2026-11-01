import type { FacetMapping } from "./coverage";
import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

const benchmarkSenses = {
  whole: "whole",
  part: "part",
  difference: "difference-subtract",
  "more than": "more-than",
};

export const benchmarkEstimateMethods: Record<string, ProblemMethod> = {
  "benchmark-fraction-estimate": {
    goal: "Round each fraction to 0, one half or 1, then add or subtract the benchmarks to estimate a sum, a difference or the amount left.",
    senses: benchmarkSenses,
    noLink: ["change", "changes"],
    intuition:
      "A fraction names equal parts of a whole. Its numerator, the top number, counts the parts. Its denominator, the bottom number, says how many equal parts make the whole. A benchmark fraction is an easy number to compare with: 0, one half or 1. Rounding means replacing a number with the nearest easy number. $\\frac{5}{9}$ is just a little more than $\\frac{1}{2}$, so it rounds to one half. An estimate is a close answer, not an exact one.",
    terms: ["benchmark-fraction", "estimate"],
    method: [
      "Decide which benchmark each fraction is closest to. Compare its numerator with half of its denominator: near half means one half, much less means 0, and nearly all means 1.",
      "Replace each fraction with its benchmark. Then add or subtract the benchmarks. For the amount left from a whole, subtract the amount used from 1.",
      "Choose the answer that matches this estimate.",
    ],
    watch:
      "An estimate from benchmarks is close, not exact. For the amount left, subtract the amount used from 1. The amount used is not the answer.",
  },
};

export const benchmarkEstimatePrinciples: Record<string, string> = {
  "benchmark-fraction-estimate":
    "A fraction $\\frac{a}{b}$ is close to 0 when $a$ is much smaller than $\\frac{b}{2}$, close to $\\frac{1}{2}$ when $a$ is about $\\frac{b}{2}$, and close to 1 when $a$ is about $b$. In these problems each fraction is within $\\frac{1}{9}$ of its benchmark. So a sum or difference of two of them is within $\\frac{2}{9}$ of the estimate.",
};

export const benchmarkEstimateLessons: Lesson[] = [
  {
    ...chainLesson({
      id: "benchmark-fraction-estimate-lesson",
      title: "Estimating with 0, one half and 1",
      summary:
        "A benchmark is an easy number to compare with. For fractions, the benchmarks are 0, one half and 1. Rounding means replacing a fraction with the nearest benchmark. Then sums and differences are easy to work out in your head. The answer is an estimate: close, but not exact.",
      templateIds: ["benchmark-fraction-estimate"],
      objectives: [
        "Decide whether a fraction is closest to 0, one half or 1.",
        "Use the benchmarks to estimate a sum, a difference or the amount left.",
      ],
      openingTitle: "Round to an easy fraction first",
      opening: [
        "A fraction names equal parts of a whole. Its numerator, the top number, counts the parts. Its denominator, the bottom number, says how many equal parts make the whole.",
        "To see which benchmark a fraction is near, compare its numerator with half of its denominator. For $\\frac{5}{9}$, half of 9 is 4 and a half. 5 is just above that, so $\\frac{5}{9}$ is close to one half. For $\\frac{1}{10}$, 1 is much less than half of 10, so $\\frac{1}{10}$ is close to 0. For $\\frac{8}{9}$, 8 is almost all of 9, so $\\frac{8}{9}$ is close to 1.",
        "After each fraction is replaced by its benchmark, the adding or subtracting is easy. Two fractions near one half make about 1. A fraction near 1 minus a fraction near 0 is about 1.",
      ],
      example: {
        prompt:
          "About how much of a pizza is left after friends eat $\\frac{4}{9}$ and $\\frac{1}{10}$ of it?",
        steps: [
          "Round $\\frac{4}{9}$: half of 9 is 4 and a half, and 4 is just below it. So $\\frac{4}{9}$ is close to $\\frac{1}{2}$. Round $\\frac{1}{10}$: 1 is much less than half of 10, so $\\frac{1}{10}$ is close to 0.",
          "Add the benchmarks to estimate the amount eaten: about $\\frac{1}{2}+0=\\frac{1}{2}$ of the pizza.",
          "The whole pizza is 1. Subtract the amount eaten to find the amount left: about $1-\\frac{1}{2}=\\frac{1}{2}$.",
        ],
        answer: "About one half",
      },
      methodTitle: "Round, work it out, answer",
      method: [
        "Round each fraction to 0, one half or 1.",
        "Add or subtract the benchmarks. For the amount left from one whole, subtract the amount used from 1.",
      ],
      formalTitle: "How close the estimate is",
      formal: [
        "$\\frac{a}{b}$ is closest to 0, to $\\frac{1}{2}$ or to 1 when $a$ is nearest to 0, to $\\frac{b}{2}$ or to $b$.",
        "The gap between a fraction and its benchmark is how far off the estimate can be. In these problems, each fraction is within $\\frac{1}{9}$ of its benchmark. So a sum or difference of two of them is within $\\frac{2}{9}$ of the estimate.",
      ],
      pitfalls: [
        "Giving the amount used when the question asks for the amount left. Subtract the amount used from 1.",
        "Rounding a fraction to the wrong benchmark. Compare the top number with half of the bottom number.",
        "Treating the estimate as exact. It is only close.",
      ],
      parentGuide:
        "Before your child adds or subtracts, ask whether each fraction is about none, about half or about all of a whole.",
    }),
    senses: benchmarkSenses,
    noLink: ["change", "changes"],
  },
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
