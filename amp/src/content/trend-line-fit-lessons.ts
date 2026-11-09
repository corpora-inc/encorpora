import { chainLesson } from "./chain-lesson-kit";
import type { ProblemMethod } from "./problem-lessons";

export const trendFitMethod: ProblemMethod = {
  goal: "Draw a line that follows the whole cloud of dots.",
  intuition:
    "A scatter plot shows two measurements for each object as one dot. A trend line is a straight line that follows the overall pattern. The gaps from the dots to the line show how well it fits.",
  terms: ["scatterplot", "line-of-best-fit", "slope"],
  method: [
    "Read both axis labels and their units. Each dot pairs a horizontal measurement with a vertical measurement.",
    "Look from left to right. If the dots rise, tilt the line upward; if they fall, tilt it downward.",
    "Move the two handles so the line passes through the middle of the cloud, with dots on both sides.",
    "Check the gaps at both ends as well as the middle. Adjust until the dots stay close all along the line.",
  ],
  watch:
    "Fit all the dots together. A line through two particular dots can miss the rest.",
};
export const trendCompareMethod: ProblemMethod = {
  ...trendFitMethod,
  goal: "Choose the line that stays closer to the data along the whole cloud.",
  method: [
    "Check that both graphs show the same measurements on the same scales.",
    "Compare the vertical gaps, measured straight up or down from each dot to its line.",
    "Choose the line with smaller gaps along the whole cloud, with dots on both sides.",
  ],
};
export const trendReadMethod: ProblemMethod = {
  ...trendFitMethod,
  goal: "Read an estimated measurement from a fitted line.",
  method: [
    "Find the given measurement on the horizontal axis.",
    "Move vertically to the fitted line, then horizontally to the vertical axis.",
    "Read the value using the tick marks and round as requested. Include the vertical axis's unit.",
  ],
  watch:
    "Read the line rather than a nearby dot. The line estimates a pattern, not an exact individual measurement.",
};
export const trendFitPrinciple =
  "Straight lines are widely used to model relationships between two measured quantities. Use a line when the dots suggest a roughly straight pattern. A good fit keeps the vertical gaps small along the whole cloud, with dots on both sides. Nearby lines can also be good fits.";
export const trendFitLesson = chainLesson({
  id: "fit-and-read-trend-lines",
  title: "Fit and read a trend line",
  summary: trendFitMethod.intuition!,
  templateIds: ["trend-line-fit", "trend-line-compare", "trend-line-read"],
  objectives: [
    "Fit a straight line to a scatter plot.",
    "Compare fits by the closeness of the dots.",
    "Read an estimate from a fitted line.",
  ],
  openingTitle: "Follow the whole cloud",
  opening: [
    "You need to read values on two labelled axes. The horizontal axis runs across; the vertical axis runs up.",
    "Each dot shows two measurements for one object. Together, the dots form a scatter plot.",
    "A trend line is a straight line used to describe the pattern. Its slope means how much its vertical value changes for each extra horizontal unit.",
    "If the dots bend in a curve, a straight line may be the wrong model.",
  ],
  example: {
    prompt:
      "Plants aged 1, 2, 3, 4 and 5 weeks have heights 5, 6, 9, 10 and 15 cm. Fit a line and estimate the height at 3 weeks.",
    steps: [
      "The heights generally rise as age increases, so the line should rise.",
      "One good line passes through $(1, 4)$ and $(5, 14)$. At the five ages, it gives heights 4, 6.5, 9, 11.5 and 14 cm.",
      "The vertical gaps are 1, 0.5, 0, 1.5 and 1 cm. The points stay close, with two above and two below.",
      "At 3 weeks, this line gives 9 cm. Another nearby fitting line may give a slightly different estimate.",
    ],
    answer: "About 9 cm at 3 weeks.",
  },
  methodTitle: "Fit, compare, then read",
  method: [...trendFitMethod.method, ...trendReadMethod.method],
  formalTitle: "A line models a pattern",
  formal: [
    trendFitPrinciple,
    "A vertical distance measures how far a dot is above or below the line at the same horizontal value. Smaller distances mean a closer fit.",
    "An estimate from the line describes the overall pattern. It need not equal an individual observation, and it is most defensible within the observed range.",
  ],
  pitfalls: [
    trendFitMethod.watch!,
    "Forcing the line through zero when the data suggest otherwise.",
    trendReadMethod.watch!,
  ],
  parentGuide:
    "Ask which dots are farthest from the line and how moving a handle changes those gaps. Compare two reasonable fits without demanding one exact line.",
});
