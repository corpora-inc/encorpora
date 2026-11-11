import { chainLesson } from "./chain-lesson-kit";
import type { ProblemMethod } from "./problem-lessons";
import { scene } from "../math/scene/author";

export const linePlotBuildMethod: ProblemMethod = {
  goal: "Show every measurement by placing an $X$ above its number.",
  intuition:
    "A line plot shows measurements with marks above a number line. Each $X$ stands for one measurement. If two lengths are the same, their two $X$s stack above the same number. Numbers with no measurements keep their places on the line.",
  terms: ["dot-plot", "length", "unit"],
  method: [
    "Read each length. On a ruler, find the nearest end mark and count units from the object's start.",
    "Place one $X$ above the number for each measurement. Stack another $X$ when a number repeats.",
    "Check each stack, then count all the $X$s. There must be one for every measurement.",
  ],
  watch:
    "Keep repeated measurements. Leave a number with no measurements empty, without skipping it on the scale.",
};
export const linePlotBuildPrinciple =
  "A line plot places one $X$ above a number for each measurement of that length. Consecutive whole numbers keep every step the same size, including empty columns.";
export const linePlotBuildLesson = chainLesson({
  id: "line-plot-build-lesson",
  title: "Make a line plot",
  summary: linePlotBuildMethod.intuition!,
  templateIds: ["line-plot-build"],
  objectives: [
    "Make a line plot from measured lengths.",
    "Keep every repeated measurement and every empty number on the scale.",
  ],
  openingTitle: "One measurement, one mark",
  opening: [
    "Start by counting whole numbers in order. Read lengths in the same unit, such as centimeters or inches.",
    "A ruler's numbers count equal units from 0. If an object starts at another number, count from that start.",
    "For an end between numbered marks, choose the closer mark. The small halfway mark helps you decide.",
    "For example, a ribbon starts at 2 and ends a little before 7. Its length is about $7 - 2 = 5$ centimeters.",
  ],
  example: {
    prompt:
      "Five ribbons measure 3, 5, 3, 6 and 5 centimeters. Make a line plot of their lengths.",
    steps: [
      "The two measurements of 3 centimeters need two $X$s above 3.",
      "The two measurements of 5 centimeters need two $X$s above 5. The one measurement of 6 needs one $X$ above 6.",
      "Leave 4 empty because no ribbon measured 4 centimeters. Keep 4 on the line so the steps stay equal.",
      "Count the marks: $2 + 2 + 1 = 5$. That is one $X$ for each ribbon.",
    ],
    answer: "2 $X$s above 3, 2 $X$s above 5, and 1 $X$ above 6",
    figure: {
      kind: "scene",
      scene: scene({
        type: "dotPlot",
        id: "example",
        min: 2,
        max: 7,
        mark: "x",
        groups: [{ values: [3, 5, 3, 6, 5] }],
        unit: "centimeters",
      }).build({ width: 360 }),
    },
  },
  methodTitle: "Read, place, check",
  method: linePlotBuildMethod.method,
  formalTitle: "What a line plot records",
  formal: [linePlotBuildPrinciple],
  pitfalls: [
    "Putting just one $X$ above a repeated length.",
    "Reading an object's end number without counting from its start.",
    "Moving an $X$ to the next number instead of placing it above its own number.",
  ],
  parentGuide:
    "Measure several small objects together. List each length, then have your learner place an $X$ for every item in the list.",
});
