import type { FacetMapping } from "./coverage";
import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

/**
 * Lessons, methods and principles for the grade-2 ruler and line-plot
 * types: how much longer one object is than another (2.MD.A.4), a length to
 * the nearest whole unit, and the line plot that shows a list of
 * measurements (2.MD.D.9). The drawn ruler stands in for a ruler in the
 * learner's hand; the lessons say to try it with a real ruler too.
 */

export const rulerLinePlotMethods: Record<string, ProblemMethod> = {
  "ruler-length-difference": {
    goal: "Measure two objects on a ruler and find how much longer one is than the other, in the ruler's unit.",
    intuition:
      "A ruler counts equal units, such as centimeters, starting from 0. The length of an object is how many units fit from its start to its end. When an object starts at 0, its length is the number at its end. When it starts at another mark, its length is the end number minus the start number. To find how much longer one object is, measure both. Then take the shorter length away from the longer length.",
    terms: ["length", "unit", "difference-subtract"],
    method: [
      "Measure the first object: the number at its end minus the number at its start.",
      "Measure the second object the same way.",
      "Subtract the shorter length from the longer length. Say the answer with the ruler's unit, such as centimeters.",
    ],
    watch:
      "When the two objects start at different marks, do not subtract their end numbers. Measure each object first, then compare the two lengths.",
  },
  "compare-measured-lengths": {
    goal: "Measure two objects on two rulers, choose which is longer, and choose how much longer it is with the right unit.",
    intuition:
      "Two rulers can show two objects that start at different marks. The object whose end reaches the bigger number is not always the longer one. Measure each object: the end number minus the start number is its length, a count of units. The longer object has the bigger length. How much longer is the difference of the two lengths, in the unit the rulers are marked in.",
    terms: ["length", "unit", "difference-subtract"],
    method: [
      "Find each object's length: the number at its end minus the number at its start.",
      "Compare the two lengths. The bigger length belongs to the longer object. Equal lengths mean the same length.",
      "Subtract the shorter length from the longer one. Use the unit the rulers are marked in.",
    ],
    watch:
      "Compare lengths, not end numbers. An object that starts farther along the ruler can end at a bigger number and still be shorter.",
  },
  "ruler-read-nearest-unit": {
    goal: "Read the length of an object on a ruler to the nearest whole centimeter or inch.",
    intuition:
      "An object does not always end exactly at a numbered mark. To measure to the nearest whole unit, find the two numbered marks that the end is between. The short mark halfway between them helps you decide. If the end has not reached the halfway mark, it is closer to the smaller number. If it is past the halfway mark, it is closer to the bigger number. Then count the units from where the object starts to that mark.",
    noLink: ["whole"],
    terms: ["length", "unit", "tick-mark"],
    method: [
      "Find the two numbered marks that the end of the object is between.",
      "Use the halfway mark to decide which numbered mark the end is closer to.",
      "Count the units from the start of the object to that mark. If it starts at 0, that mark's number is the length.",
    ],
    watch:
      "When the object does not start at 0, do not answer with the number at its end. Count the units from its start mark.",
  },
  "line-plot-choose-for-data": {
    goal: "Choose the line plot that shows a list or table of whole-unit measurements.",
    intuition:
      "A line plot shows data, a list of measurements, on a number line. Each measurement gets one mark (×) above its number. When the same length is measured more than once, its marks stack up. The numbers along the line are whole numbers in order. A number with no measurement still keeps its place, with no mark above it.",
    noLink: ["tally"],
    terms: ["dot-plot", "data", "length"],
    method: [
      "Count how many measurements there are. The plot needs that many marks.",
      "Tally how many times each number appears in the list or table.",
      "Choose the plot with that many marks above each number, on a scale of whole numbers in order.",
    ],
    watch:
      "Give every measurement its own mark, even when a number repeats. Check that the scale does not skip a number.",
  },
};

export const rulerLinePlotPrinciples: Record<string, string> = {
  "ruler-length-difference":
    "The length of an object on a ruler is its end number minus its start number. How much longer one object is than another is the longer length minus the shorter length, in the ruler's unit.",
  "compare-measured-lengths":
    "Of two measured objects, the longer one has the bigger length, not always the bigger end number. The difference of the two lengths, in the rulers' unit, tells how much longer it is.",
  "ruler-read-nearest-unit":
    "To the nearest whole unit, an end that has not reached the halfway mark goes to the smaller number, and an end past it goes to the bigger number. The length is the units counted from the start mark to that mark.",
  "line-plot-choose-for-data":
    "A line plot of measurements has one mark for each measurement above its number, on a scale of whole numbers in order that includes the numbers with no marks.",
};

export const rulerLinePlotLessons: Lesson[] = [
  chainLesson({
    id: "ruler-line-plot-difference-lesson",
    title: "How much longer: measure both, then subtract",
    summary:
      "Measure each object on the ruler: its end number minus its start number. Then subtract the shorter length from the longer length, and say the answer in the ruler's unit.",
    templateIds: ["ruler-length-difference", "compare-measured-lengths"],
    objectives: [
      "Measure two objects on a ruler, including objects that do not start at 0.",
      "Find how much longer one object is than another, in centimeters or inches.",
    ],
    openingTitle: "Two lengths, one difference",
    opening: [
      "A ruler counts equal units from 0. A unit is one equal step, such as 1 centimeter or 1 inch. The length of an object is how many units fit from its start to its end.",
      "When an object starts at 0, its length is the number at its end. When it starts at another mark, its length is the end number minus the start number. For example, a ribbon from 3 to 14 is $14 - 3 = 11$ centimeters long.",
      "To find how much longer one object is than another, measure both. Then take the shorter length away from the longer length. Try it at home with a real ruler and two pencils.",
    ],
    example: {
      prompt:
        "A ribbon lies along a ruler from the 3 mark to the 14 mark. A crayon lies along the same ruler from 0 to 9. How much longer is the ribbon than the crayon, in centimeters?",
      steps: [
        "The ribbon starts at 3 and ends at 14. Its length is $14 - 3 = 11$ centimeters.",
        "The crayon starts at 0, so its length is its end number: 9 centimeters.",
        "Longer minus shorter: $11 - 9 = 2$. The ribbon is 2 centimeters longer.",
        "Check: $9 + 2 = 11$. Subtracting the end numbers, $14 - 9 = 5$, would be wrong, because the two start at different marks.",
      ],
      answer: "2 centimeters",
    },
    methodTitle: "Measure, compare, subtract",
    method: [
      "Measure each object: the number at its end minus the number at its start.",
      "The bigger length belongs to the longer object.",
      "Subtract the shorter length from the longer one, and name the unit the ruler is marked in.",
    ],
    formalTitle: "Length and difference",
    formal: [
      "The length of an object on a ruler is the number of units between its ends: end mark minus start mark.",
      "How much longer one length is than another is their difference, the longer minus the shorter, in the same unit.",
    ],
    pitfalls: [
      "Subtracting the end numbers when the objects start at different marks.",
      "Using the end number as the length of an object that does not start at 0.",
      "Answering with the wrong unit, such as inches on a centimeter ruler.",
    ],
    parentGuide:
      "Lay two things along a ruler at different starting marks. Ask your learner to measure each one before comparing, and to say the unit.",
  }),
  chainLesson({
    id: "ruler-line-plot-measure-plot-lesson",
    title:
      "Measure to the nearest unit and show the measurements on a line plot",
    summary:
      "Read each length to the nearest whole centimeter or inch. Then show the measurements on a line plot: one mark for each measurement above its number, on whole numbers in order.",
    noLink: ["whole", "tally"],
    templateIds: ["ruler-read-nearest-unit", "line-plot-choose-for-data"],
    objectives: [
      "Measure an object to the nearest whole unit, including an object that does not start at 0.",
      "Choose the line plot that shows a list of measurements.",
    ],
    openingTitle: "From measuring to a line plot",
    opening: [
      "An object often ends between two numbered marks on a ruler. To measure to the nearest whole unit, find the two marks the end is between. The short mark halfway between them tells which one is closer.",
      "Measuring several objects, or one object several times, gives a list of numbers called data. A line plot shows data on a number line: one mark (×) above the number for each measurement.",
      "When a number repeats, its marks stack up. The numbers on the line are whole numbers in order, even a number that has no mark. Try measuring a few crayons at home and making a line plot of them.",
    ],
    example: {
      prompt:
        "Maya measured 6 leaves to the nearest centimeter: 7, 8, 7, 10, 8 and 7. Which line plot shows her measurements?",
      steps: [
        "There are 6 measurements, so the line plot needs 6 marks.",
        "Tally the list: 7 appears 3 times, 8 appears 2 times and 10 appears 1 time.",
        "The scale shows every whole number in order, here 6 to 11. The 9 keeps its place with no mark.",
        "The right plot has 3 marks above 7, 2 above 8 and 1 above 10.",
      ],
      answer:
        "The line plot with 3 marks above 7, 2 above 8 and 1 above 10, numbered 6 to 11",
    },
    methodTitle: "Nearest unit, then one mark each",
    method: [
      "To the nearest unit: find the two marks around the end, use the halfway mark, and count from the start.",
      "For the plot: count the measurements, tally each number, and match the stacks.",
      "Check the scale: whole numbers in order, with none skipped.",
    ],
    formalTitle: "Rounding a length and plotting data",
    formal: [
      "A length to the nearest whole unit is the whole number of units closest to the true length. An end before the halfway mark goes down; an end past it goes up.",
      "A line plot of whole-unit measurements has a scale of consecutive whole numbers and one mark above a number for each measurement with that value.",
    ],
    pitfalls: [
      "Reading the number at the end of an object that does not start at 0.",
      "Choosing the mark the end passed instead of the mark it is closer to.",
      "Drawing only one mark for a number that was measured more than once.",
      "Leaving a number with no marks off the scale.",
    ],
    parentGuide:
      "Measure a few small things together to the nearest centimeter. Ask your learner how many marks the line plot needs and where each one goes.",
  }),
];

export const rulerLinePlotFacetMappings: FacetMapping[] = [
  {
    templateId: "ruler-length-difference",
    facetId: "ruler-measurement.core",
    extent: "partial",
    rationale:
      "Two objects drawn along one ruler or measuring tape, starting at 0, at the same mark or at different marks; the learner measures both and enters how much longer one is, in the ruler's unit. Measuring is reading a drawn ruler, not handling one.",
  },
  {
    templateId: "compare-measured-lengths",
    facetId: "ruler-measurement.core",
    extent: "partial",
    rationale:
      "Two objects on two rulers in one unit, one starting at 0 and one at a later mark: choose which is longer, or that they are equal, and choose the difference among options that include the end-mark difference, the other unit, a tick-count slip, the longer length and the sum.",
  },
  {
    templateId: "ruler-read-nearest-unit",
    facetId: "line-plots.core",
    extent: "partial",
    rationale:
      "A length read to the nearest whole centimeter or inch from a drawn ruler, with ends on a mark or two or three tenths away from one, and objects that do not start at 0. Measuring is reading a drawn ruler, not handling one.",
  },
  {
    templateId: "line-plot-choose-for-data",
    facetId: "line-plots.core",
    extent: "partial",
    rationale:
      "Choosing the line plot for several objects' measurements, one object measured several times, or a table of lengths. Distractors shift every mark, drop repeated measurements, skip an empty number on the scale, or move one mark. The learner chooses a plot; building one is not assessed.",
  },
];
