import type { FacetMapping } from "./coverage";
import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

/**
 * Lessons, methods and principles for describing a distribution by its
 * center, spread and shape (6.SP.A.2), and for judging how well a straight
 * line fits a scatter plot (8.SP.A.2).
 */

const describeTerms = ["distribution", "dot-plot", "data"];

export const distributionShapeFitMethods: Record<string, ProblemMethod> = {
  "distribution-describe-dot-plot": {
    goal: "Describe the data in a dot plot by their center, their spread and their overall shape.",
    intuition:
      "A dot plot puts one dot above a number line for each data value. The whole pattern of dots is called the distribution. Three things describe it. The center is a typical value: where the middle dot lands. The spread is how far the values reach, from the smallest dot to the largest. The shape is the outline the stacks of dots make.",
    terms: [...describeTerms, "tail"],
    method: [
      "Center: count the dots, then count from the left to the middle dot. The value it lands on is the center.",
      "Spread: read the smallest and the largest values that have dots. Subtract to find how far the data spread.",
      "Shape: look at the stacks. Is there one even mound, a pile on one side with a tail, two clusters with a gap, or about the same number everywhere?",
    ],
    watch:
      "Read the spread from the dots, not from the ends of the number line, and do not use the count of dots or the height of a stack as the spread.",
  },
  "distribution-match-description": {
    goal: "Choose the dot plot that matches a description of the center, the spread and the shape of some data.",
    intuition:
      "A description of data has three parts: the center (where the middle dot lands), the spread (from the smallest dot to the largest) and the shape (the outline the stacks make). Two plots can agree on one or two parts and still be different data. Only the plot that matches all three parts fits the description.",
    terms: describeTerms,
    method: [
      "Check the spread first: rule out any plot whose dots start or end at other values.",
      "Check the center: count to the middle dot of each plot that is left.",
      "Check the shape: a pile with a tail, one mound, two clusters or a flat row of stacks.",
    ],
    watch:
      "A plot with the right shape can still be shifted to a different center, and a plot with the right center can be narrower. Check all three parts.",
  },
  "distribution-read-description": {
    goal: "Choose the description of a dot plot that is correct and complete: its center, its spread and its shape.",
    intuition:
      "Each description names three things about the dots. The center is a typical value, where the middle dot lands. The spread runs from the smallest dot to the largest. The shape is the outline of the stacks. A description is right only when all three parts are right.",
    terms: describeTerms,
    method: [
      "Find the center: count the dots and count from the left to the middle one.",
      "Find the spread: the smallest and the largest values that have dots, not the ends of the number line.",
      "Name the shape, then choose the description that gets all three parts right.",
    ],
    watch:
      "A wrong description often changes only one part. Check the center, the spread and the shape in every description.",
  },
  "statistical-question-distribution-answer": {
    goal: "Choose the statistical question that some data answer, and the statement that answers it with the center, spread and shape of the data.",
    intuition:
      "A statistical question is a question that expects answers that vary, such as how many books each student read. Its data are many values, not one. So the answer is a description of all the values: where they center, how far they spread, and what shape they make. One number throws the variation away.",
    terms: ["statistical-question", ...describeTerms],
    method: [
      "Choose the question that asks about everyone in the group, so the answers can vary. A question about one person has one answer.",
      "Answer it with the whole distribution: the center, the spread from the smallest value to the largest, and the shape.",
    ],
    watch:
      "Values that vary do not mean the question has no answer. Describe how they vary instead of picking one number.",
  },
  "trend-line-best-fit-choice": {
    goal: "Choose, from four graphs of the same scatter plot, the line that fits the data best.",
    intuition:
      "A scatter plot shows each pair of data values as one point. When the points rise or fall together in a band, a straight line called a trend line can model them. A good trend line goes through the middle of the band, with points above it and below it. It also stays close to the points all along, at the left end, the middle and the right end.",
    terms: ["scatterplot", "line-of-best-fit"],
    method: [
      "For each line, count the points above it and below it. Rule out a line with almost all the points on one side.",
      "Of the lines left, look at both ends. Rule out a line that tilts too much or too little, so the end points are far from it.",
      "Choose the line with points on both sides that stays closest to them all along.",
    ],
    watch:
      "A line through two of the dots, or a flat line at the average value, can still be far from most points. Judge fit by how close all the points are.",
  },
  "trend-line-fit-assess": {
    goal: "Judge how well a line drawn on a scatter plot fits the data, by the closeness and the balance of the points.",
    intuition:
      "A trend line is a straight line that models the pattern of the points in a scatter plot. It fits well when the points are close to it and lie on both sides of it all along. It fits badly when almost all the points are on one side, when it tilts the wrong amount, or when the points bend so that no straight line can follow them.",
    terms: ["scatterplot", "line-of-best-fit"],
    method: [
      "Count the points above the line and below it. About as many on each side is good balance.",
      "Look at how far the points are from the line, especially at both ends.",
      "If the end points are far on the same side and the middle ones are far on the other side, the points curve, and no straight line fits them well.",
    ],
    watch:
      "Fit is about how close the points are. Touching two dots, sloping the same way, or not hitting every dot does not decide it.",
  },
};

export const distributionShapeFitPrinciples: Record<string, string> = {
  "distribution-describe-dot-plot":
    "The data that answer a statistical question have a distribution. It is described by its center (a typical value, here the middle value), its spread (from the smallest value to the largest) and its overall shape (symmetric, piled to one side with a tail, clustered with gaps, or flat).",
  "distribution-match-description":
    "Two data sets can share a shape and a spread but have different centers, or share a center but have different spreads. A description pins down a distribution only when it gives the center, the spread and the shape together.",
  "distribution-read-description":
    "A complete description of a distribution gives its center, its spread and its shape. Each is read from the dots: the middle dot for the center, the smallest and largest dots for the spread, and the outline of the stacks for the shape.",
  "statistical-question-distribution-answer":
    "A statistical question anticipates variability in the data. Its answer is a distribution, described by its center, spread and shape, not a single number.",
  "trend-line-best-fit-choice":
    "For a scatter plot that suggests a linear association, a trend line models the relationship. The best informal fit passes through the middle of the points, with points on both sides, and keeps the vertical distances from the points to the line small all along.",
  "trend-line-fit-assess":
    "A straight line fits a scatter plot well when the points are close to it and lie on both sides of it along its whole length. When the points follow a curve, the distances at both ends and in the middle stay on opposite sides, and no straight line is a good model.",
};

export const distributionShapeFitLessons: Lesson[] = [
  chainLesson({
    id: "distribution-shape-fit-describe-lesson",
    title: "Center, spread and shape of a distribution",
    summary:
      "Data collected to answer a statistical question vary, so the answer is the whole pattern of values. Describe it by its center, a typical value; its spread, from the smallest value to the largest; and its shape, the outline the dots make.",
    templateIds: [
      "distribution-describe-dot-plot",
      "distribution-match-description",
      "distribution-read-description",
      "statistical-question-distribution-answer",
    ],
    objectives: [
      "Describe the data in a dot plot by their center, spread and overall shape.",
      "Match a description to its dot plot, and answer a statistical question with a distribution, not one number.",
    ],
    openingTitle: "Many values, one description",
    opening: [
      "A statistical question is a question that expects answers that vary. “How many books did each student read last month?” is one. The students read different numbers of books, so the data are many values.",
      "A dot plot shows those values. It puts one dot above a number line for each value, and dots with the same value stack up. The whole pattern of dots is called the distribution of the data.",
      "Three things describe a distribution. The center is a typical value: count to the middle dot and read where it lands. The spread is how far the values reach: from the smallest dot to the largest. The shape is the outline of the stacks.",
      "Shapes have names. Symmetric means one mound, about the same on both sides. A pile at one end with a long thin part toward the other end has a tail. Two groups of dots with an empty gap between them are two clusters. About the same number of dots at every value is flat.",
    ],
    example: {
      prompt:
        "A dot plot shows how many books each of 18 students read: 1 at 3, 1 at 4, 2 at 5, 3 at 6, 4 at 7, 3 at 8, 2 at 9, 1 at 10 and 1 at 11. Describe the distribution.",
      steps: [
        "Center: there are 18 dots, so the middle ones are the 9th and the 10th. Counting from the left, both land on 7. The data are centered around 7.",
        "Spread: the smallest value is 3 and the largest is 11. The data spread over $11 - 3 = 8$ books.",
        "Shape: the tallest stack is at 7, and the stacks get shorter in the same way on both sides. The data are roughly symmetric: one mound.",
      ],
      answer: "Centered around 7, spread from 3 to 11, roughly symmetric",
    },
    methodTitle: "Center, then spread, then shape",
    method: [
      "Count the dots. Count from the left to the middle dot; its value is the center. With two middle dots, the center is halfway between them, even in an empty gap.",
      "Read the smallest and the largest values that have dots. That is the spread. Ignore how far the number line runs past the dots.",
      "Name the shape from the stacks. Then check each part of any description against the plot.",
    ],
    formalTitle: "What describes a distribution",
    formal: [
      "A set of data collected to answer a statistical question has a distribution. It can be described by its center, its spread and its overall shape.",
      "Here the center is the middle value of the data in order. The spread is described by the smallest and the largest values. The shape can be symmetric, piled to one side with a tail, in clusters with gaps, or flat.",
    ],
    pitfalls: [
      "Reading the spread from the ends of the number line instead of from the dots.",
      "Using the count of dots or the height of the tallest stack as the spread.",
      "Answering a statistical question with one number and leaving out how the values vary.",
    ],
    parentGuide:
      "Ask your learner to point to the middle dot, then to the smallest and the largest dots, and then to describe the outline of the stacks in their own words.",
  }),
  chainLesson({
    id: "distribution-shape-fit-trend-lesson",
    title: "Judging a trend line on a scatter plot",
    summary:
      "When the points of a scatter plot rise or fall together in a band, a straight trend line can model them. A good one goes through the middle of the points, with points on both sides, and stays close to them all along.",
    templateIds: ["trend-line-best-fit-choice", "trend-line-fit-assess"],
    objectives: [
      "Choose the line that fits a scatter plot best.",
      "Judge how well a drawn line fits, and recognize points that curve so no straight line fits.",
    ],
    openingTitle: "Close, and on both sides",
    opening: [
      "A scatter plot shows pairs of numbers as points: one point for each car, day or student. When the points rise or fall together in a band, a straight line can model the pattern. That line is called a trend line.",
      "A trend line does not have to touch any point. It should go through the middle of the band, with about as many points above it as below it.",
      "It should also stay close to the points all along. Look at the left end, the middle and the right end. If the points at one end are all above the line and the points at the other end are all below it, the line tilts the wrong amount.",
      "Some points bend instead of lying in a straight band. Then the points at both ends are on one side of any straight line and the middle points are on the other side. No straight line fits them well.",
    ],
    example: {
      prompt:
        "On a scatter plot of 10 points, a line has 9 points below it and 1 point on it. Does it fit well?",
      steps: [
        "Count the sides: 9 points are below the line and none are above it.",
        "A good trend line has points on both sides. This one sits above the band of points, not through its middle.",
        "So the line does not fit well, even though it touches one point.",
      ],
      answer: "No: almost all the points lie below the line",
    },
    methodTitle: "Balance, then closeness",
    method: [
      "Count the points above and below the line. Almost all on one side means the line is shifted off the band.",
      "Compare the distances at both ends. Points above at one end and below at the other mean the line tilts too much or too little.",
      "If the ends are far on one side and the middle is far on the other, the points curve, and a straight line is the wrong model.",
    ],
    formalTitle: "Fitting and judging a line",
    formal: [
      "Straight lines are widely used to model the relationship between two quantities when a scatter plot suggests a linear association: points that rise or fall together along a straight band.",
      "A line fits well when the vertical distances from the points to the line are small and the points lie on both sides of it along its length. Closeness, not which points the line touches, decides the fit.",
    ],
    pitfalls: [
      "Choosing the line that connects two of the dots.",
      "Choosing a line only because it slopes the same way as the points.",
      "Drawing a straight line through points that curve.",
    ],
    parentGuide:
      "Ask your learner to count the points above and below the line, and then to point to the point that is farthest from it.",
  }),
];

export const distributionShapeFitFacetMappings: FacetMapping[] = [
  {
    templateId: "distribution-describe-dot-plot",
    facetId: "describe-distributions.core",
    extent: "partial",
    rationale:
      "Chooses the center (the middle value), the spread (smallest to largest) and the shape (symmetric, tail toward high or low values, two clusters, flat) of a whole-number dot plot from options. It does not ask the learner to compute a mean or to write a description.",
  },
  {
    templateId: "distribution-match-description",
    facetId: "describe-distributions.core",
    extent: "partial",
    rationale:
      "Chooses the dot plot that matches a center, spread and shape description; each other plot differs in exactly one of the three. Selection only.",
  },
  {
    templateId: "distribution-read-description",
    facetId: "describe-distributions.core",
    extent: "partial",
    rationale:
      "Chooses the correct and complete center, spread and shape description of a dot plot; each wrong description changes one attribute. Selection only.",
  },
  {
    templateId: "statistical-question-distribution-answer",
    facetId: "describe-distributions.core",
    extent: "partial",
    rationale:
      "Identifies the statistical question data were collected to answer and chooses an answer that describes the distribution rather than one number. Selection only; it does not assess writing a statistical question.",
  },
  {
    templateId: "trend-line-best-fit-choice",
    facetId: "scatterplots.trend-line-models",
    extent: "partial",
    rationale:
      "Chooses, among four lines on the same linear scatter plot, the one closest to the points with points on both sides. Distractors sit above or below the cloud, tilt too much or too little, connect two dots, stay flat or pass through the origin. It does not ask the learner to draw the line.",
  },
  {
    templateId: "trend-line-fit-assess",
    facetId: "scatterplots.trend-line-models",
    extent: "partial",
    rationale:
      "Judges a drawn line's fit by the closeness and balance of the points, including a curved cloud that no straight line fits. Selection only; drawing a trend line is not assessed.",
  },
];
