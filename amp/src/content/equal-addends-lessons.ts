import { chainLesson } from "./chain-lesson-kit";
import type { ProblemMethod } from "./problem-lessons";
import { equalAddendsScene } from "../math/equal-addends-practice";

export const equalAddendsMethod: ProblemMethod = {
  goal: "Show equal rows of objects and add them to find how many there are altogether.",
  intuition:
    "An array is objects arranged in equal rows and columns. Rows go across; columns go down. Add one whole row at a time.",
  terms: ["addition", "equal-sign"],
  method: [
    "If the story asks you to build an array, set its rows and columns to match the story.",
    "Count one row. An addend is a number being added, so use that count for each addend.",
    "Use one addend for every row. For columns, count down and use one addend for every column.",
    "Add the numbers. Put the total after the equals sign, which means both sides have the same amount.",
  ],
  watch:
    "Each addend counts one whole row or one whole column. Use every row or every column exactly once.",
};
export const equalAddendsPrinciple =
  "Equal rows can be counted by adding the number in one row once for each row. Equal columns work the same way.";
export const equalAddendsLesson = chainLesson({
  id: "equal-addends-builder-lesson",
  title: "Add equal rows or columns",
  summary: equalAddendsMethod.intuition!,
  templateIds: ["array-equal-addends-equation"],
  objectives: [
    "Build an array from a story.",
    "Write equal addends for its rows or columns.",
  ],
  openingTitle: "Count a whole row at a time",
  opening: [
    "You need to count objects and add small numbers.",
    equalAddendsMethod.intuition!,
    "A sum is the result of adding. An addend is one of the numbers being added.",
  ],
  example: {
    prompt:
      "Apples are arranged in 3 rows of 4. Write an addition sentence for the total.",
    steps: [
      "One row has 4 apples. Each row contributes an addend of 4.",
      "There are 3 rows, so write 4 three times.",
      "$4 + 4 = 8$, then $8 + 4 = 12$.",
      "$4 + 4 + 4 = 12$. There are 12 apples altogether.",
      "There are also 4 columns of 3: $3 + 3 + 3 + 3 = 12$.",
    ],
    answer: "$4 + 4 + 4 = 12$",
    figure: { kind: "scene", scene: equalAddendsScene("apple", 3, 4) },
  },
  methodTitle: "One addend for each group",
  method: equalAddendsMethod.method,
  formalTitle: "The same objects in both directions",
  formal: [
    equalAddendsPrinciple,
    "Rows and columns give the same total because each direction counts every object exactly once.",
  ],
  pitfalls: [
    "Adding the two side counts instead of adding equal groups.",
    "Using too many or too few addends.",
    "Switching to rows when the prompt asks for columns.",
  ],
  parentGuide:
    "Arrange small objects in equal rows. Ask your learner to point to the row or column counted by each addend.",
});
