import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

export const timeUnitRenameMethods: Record<string, ProblemMethod> = {
  "rename-time-units": {
    goal: "Rename an amount of time in a larger unit as a smaller unit by multiplying, or in a smaller unit as a larger unit by dividing.",
    intuition:
      "Time units are groups of smaller units: 1 hour is a group of 60 minutes. Renaming changes how the same amount of time is counted, so the amount does not change, only the size of the unit.",
    terms: [
      ["rename", "Write the same amount of time with a different unit."],
      [
        "group",
        "The number of small units in one large unit, such as 60 minutes in 1 hour.",
      ],
    ],
    method: [
      "Write how many small units are in 1 large unit: 60 minutes in an hour, 24 hours in a day, 7 days in a week, 12 months in a year.",
      "To go from the large unit to the small unit, multiply the count by that group size. To go back, divide by it.",
      "For hours and minutes together, rename the hours first and then add the extra minutes.",
    ],
    watch:
      "More small units are needed to match large ones, so the number gets bigger when you rename hours as minutes and smaller when you rename minutes as hours.",
  },
};

export const timeUnitRenamePrinciples: Record<string, string> = {
  "rename-time-units":
    "If one large unit equals $k$ small units, then $n$ large units equal $n\\times k$ small units, and $m$ small units equal $m\\div k$ large units. The amount of time is the same; only the unit changes. Common values are 60 seconds in a minute, 60 minutes in an hour, 24 hours in a day, 7 days in a week and 12 months in a year.",
};

export const timeUnitRenameLessons = [
  chainLesson({
    id: "rename-time-units-lesson",
    title: "Renaming units of time",
    summary:
      "Rename hours as minutes, minutes as hours, days as hours and weeks as days.",
    templateIds: ["rename-time-units"],
    objectives: [
      "Recall how many small units make one larger unit of time.",
      "Multiply to rename larger units as smaller ones and divide to rename smaller units as larger ones.",
    ],
    openingTitle: "A larger unit is a group of smaller units",
    opening: [
      "One hour is a group of 60 minutes. Two hours are two groups of 60 minutes, which is 120 minutes. The time is the same length; we only counted it with a smaller unit.",
      "Going the other way, 180 minutes is made of groups of 60 minutes. Counting the groups tells how many hours it is.",
    ],
    example: {
      prompt: "How many minutes are in 5 hours?",
      steps: [
        "There are 60 minutes in 1 hour.",
        "5 hours is 5 groups of 60 minutes: $5\\times60=300$.",
        "Check: 300 minutes split into groups of 60 gives 5 groups, so it is 5 hours.",
      ],
      answer: "300 minutes",
    },
    methodTitle: "Multiply to go smaller, divide to go larger",
    method: [
      "Large unit to small unit: multiply by the number of small units in one large unit. 3 days is $3\\times24=72$ hours.",
      "Small unit to large unit: divide by that number. 140 days is $140\\div7=20$ weeks.",
      "Hours and minutes together: 2 hours 15 minutes is $2\\times60+15=135$ minutes.",
    ],
    formalTitle: "Equal amounts of time",
    formal: [
      "If 1 large unit is $k$ small units, then $n$ large units equal $nk$ small units. Dividing the small count by $k$ undoes this.",
      "A quantity written in two units names the same amount, so renaming never changes the time.",
    ],
    pitfalls: [
      "Do not use 100 for minutes in an hour. An hour is 60 minutes, a day is 24 hours.",
      "When renaming to a smaller unit the number must get larger. If your answer is smaller, you divided instead of multiplying.",
      "For hours and minutes, rename only the hours. The extra minutes are already minutes.",
    ],
    parentGuide:
      "Ask your learner how many small units fit in one big unit, then whether the answer should be a bigger or smaller number.",
  }),
];

export const timeUnitRenameFacetMappings: FacetMapping[] = [
  {
    templateId: "rename-time-units",
    facetId: "unit-conversion.core",
    extent: "partial",
    rationale:
      "Numeric entry for whole-number renaming between hours and minutes, minutes and seconds, days and hours, weeks and days, and years and months, and for hours plus minutes as minutes. Does not assess customary or metric length, weight and capacity conversions, fractional amounts of an hour, or elapsed time between clock times.",
  },
];
