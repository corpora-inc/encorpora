import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

export const timeUnitRenameMethods: Record<string, ProblemMethod> = {
  "rename-time-units": {
    goal: "Rename an amount of time in a larger unit as a smaller unit by multiplying, or in a smaller unit as a larger unit by dividing.",
    intuition:
      "A unit of time is an amount we count time in, like a minute or an hour. A bigger unit is a group of smaller ones: 1 hour is a group of 60 minutes. To rename an amount means to write it in a different unit. The time stays just as long. Only the number and the unit change.",
    terms: [
      "rename",
      [
        "conversion-factor",
        "Here, a group is how many small units make one large unit, such as 60 minutes in 1 hour.",
      ],
    ],
    senses: { rename: "rename", unit: "unit" },
    noLink: ["change", "changes"],
    method: [
      "Write how many small units make 1 large unit. There are 60 minutes in an hour and 24 hours in a day. There are 7 days in a week and 12 months in a year.",
      "To go from a large unit to a small unit, multiply by that number: you are counting equal groups. To go from a small unit to a large unit, divide by it: you are counting how many groups fit.",
      "For hours and minutes together, rename the hours as minutes. Then add the extra minutes.",
    ],
    watch:
      "It takes more small units than big units to make the same time. So renaming hours as minutes makes the number bigger, and minutes as hours makes it smaller. Only 0 stays 0.",
  },
};

export const timeUnitRenamePrinciples: Record<string, string> = {
  "rename-time-units":
    "If 1 large unit is $k$ small units, then $n$ large units are $n \\times k$ small units, and $m$ small units are $m \\div k$ large units. The amount of time stays the same. There are 60 seconds in a minute, 60 minutes in an hour, 24 hours in a day, 7 days in a week and 12 months in a year.",
};

export const timeUnitRenameLessons = [
  chainLesson({
    id: "rename-time-units-lesson",
    title: "Renaming units of time",
    summary:
      "A unit of time is an amount we count time in, like a minute or an hour. To rename an amount means to write it in another unit, like 1 hour as 60 minutes. The time stays just as long. You can rename hours as minutes, days as hours and weeks as days, and back again.",
    templateIds: ["rename-time-units"],
    senses: { rename: "rename", unit: "unit" },
    noLink: ["change", "changes"],
    objectives: [
      "Remember how many small units make one larger unit of time.",
      "Multiply to rename larger units as smaller ones, and divide to rename smaller units as larger ones.",
    ],
    openingTitle: "A larger unit is a group of smaller units",
    opening: [
      "One hour is a group of 60 minutes. Two hours are two groups of 60 minutes. That is $2 \\times 60 = 120$ minutes. The time is just as long. We only counted it in a smaller unit.",
      "Going the other way, 180 minutes is made of groups of 60 minutes. Count the groups: $180 \\div 60 = 3$. So 180 minutes is 3 hours.",
      "These are worth remembering. 1 day is 24 hours. 1 week is 7 days. 1 year is 12 months.",
    ],
    example: {
      prompt: "How many minutes are in 5 hours?",
      steps: [
        "Start with what you know: there are 60 minutes in 1 hour.",
        "5 hours is 5 groups of 60 minutes. To find the total of equal groups, multiply: $5\\times60=300$.",
        "Check by going back: 300 minutes split into groups of 60 makes 5 groups, so it is 5 hours.",
      ],
      answer: "300 minutes",
    },
    methodTitle: "Multiply to go smaller, divide to go larger",
    method: [
      "Large unit to small unit: multiply by how many small units are in one large unit. 1 day is 24 hours, so 3 days is $3\\times24=72$ hours.",
      "Small unit to large unit: divide by that number, because dividing counts how many groups fit. 1 week is 7 days, so 140 days is $140\\div7=20$ weeks.",
      "Hours and minutes together: rename the hours, then add the extra minutes. 2 hours 15 minutes is $2\\times60=120$ minutes, plus 15: $120+15=135$ minutes.",
    ],
    formalTitle: "Equal amounts of time",
    formal: [
      "Say 1 large unit is $k$ small units, like 1 hour is 60 minutes, so $k$ is 60. Then a number $n$ of large units is $n \\times k$ small units. Dividing by $k$ goes back.",
      "The two ways of writing name the same amount of time. Renaming never changes how long it is.",
    ],
    pitfalls: [
      "Do not use 100 for the minutes in an hour. An hour is 60 minutes. A day is 24 hours.",
      "Renaming to a smaller unit makes the number bigger, unless it is 0. If your answer got smaller, check whether you divided instead of multiplying.",
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
