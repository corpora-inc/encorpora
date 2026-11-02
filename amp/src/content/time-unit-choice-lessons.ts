import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

export const timeUnitChoiceMethods: Record<string, ProblemMethod> = {
  "elapsed-time-hm": {
    goal: "Find an end time, a start time or the hours and minutes between two times by counting hours and minutes separately.",
    intuition:
      "Time moves in hours of 60 minutes. To add or subtract a length of time, move the hours first and then the minutes, and carry or borrow 60 minutes when the minutes pass the hour.",
    terms: ["elapsed-time", "a-m", "p-m"],
    method: [
      "Write the known time from the clock or the text, with a.m. or p.m.",
      "End time: add the hours, then the minutes. Start time: subtract the hours, then the minutes. When the minutes pass 60 they carry into the next hour; counting back past an hour borrows 60.",
      "Elapsed time: count on from the start to the next whole hour, then on to the end time, and add the hours and minutes.",
    ],
    watch:
      "Do not subtract minutes without borrowing. From 2:50 to 4:20 is 1 hour 30 minutes, not 2 hours 30 minutes.",
  },
  "object-for-measure": {
    goal: "Choose the object whose mass or capacity matches a stated measure.",
    intuition:
      "A benchmark is a familiar amount to compare with: a bag of sugar is about 1 kilogram and a water bottle about 1 liter. Picture the measure, then rule out objects that are many times larger or smaller.",
    terms: ["benchmark"],
    method: [
      "Rename the measure in a smaller unit if that helps: 1 kilogram is 1000 grams, 1 liter is 1000 milliliters, 1 pound is 16 ounces.",
      "Order the objects from the smallest to the largest by what you know about them.",
      "Choose the object closest to the stated measure and reject those that are many times too large or too small.",
    ],
    watch:
      "Mass and capacity are different: a kilogram measures how heavy, a liter measures how much a container holds.",
  },
  "approximate-unit-factor": {
    goal: "Convert a measure to another unit with a decimal conversion factor and choose the closest estimate.",
    intuition:
      "If one unit is about a certain number of the other, the smaller unit has the bigger count. Converting to the smaller unit multiplies and converting to the larger unit divides.",
    terms: ["conversion-factor"],
    method: [
      "Write the factor as a sentence: one larger unit is about this many smaller units.",
      "Going to the smaller unit, multiply by the factor. Going to the larger unit, divide by it.",
      "Estimate first to check the size: the answer should have the bigger count in the smaller unit. Then round as the options do.",
    ],
    watch:
      "Dividing when you should multiply gives a number on the wrong side of the original. Check whether the count should grow or shrink.",
  },
};

export const timeUnitChoicePrinciples: Record<string, string> = {
  "elapsed-time-hm":
    "One hour is 60 minutes, and a day on a clock is two cycles of 12 hours marked a.m. and p.m. The elapsed time from time $a$ to time $b$ is $b - a$, with borrowing 60 minutes when the minutes of $b$ are less than those of $a$. An end time is the start time plus the elapsed time, and a start time is the end time minus it.",
  "object-for-measure":
    "Comparing a measure with benchmarks only needs orders of magnitude: objects whose measures differ by a factor of four or more cannot both be closest to a stated measure. In metric units 1 kilogram is 1000 grams and 1 liter is 1000 milliliters; in customary units 1 pound is 16 ounces and 1 gallon is 4 quarts.",
  "approximate-unit-factor":
    "If one unit $B$ equals $k$ of unit $A$, then a measure of $x$ units $B$ is $kx$ units $A$, and a measure of $y$ units $A$ is $y \\div k$ units $B$. Because $k$ is only an approximation, the result is an estimate and is rounded to the precision of the choices.",
};

export const timeUnitChoiceLessons = [
  chainLesson({
    id: "elapsed-time-hm-lesson",
    title: "Start, end and elapsed time",
    summary:
      "Add or subtract hours and minutes from a clock time, or find the hours and minutes between two times.",
    templateIds: ["elapsed-time-hm"],
    objectives: [
      "Add or subtract hours and then minutes to find an end time or a start time.",
      "Find elapsed time in hours and minutes between two clock times.",
    ],
    openingTitle: "Move the hours, then the minutes",
    opening: [
      "A clock hour has 60 minutes. Adding 2 hours moves the clock 2 hours ahead and leaves the minutes alone. Adding minutes may pass the next hour, and then the extra minutes carry into it.",
      "For elapsed time, think of walking along the clock: first to the next whole hour, then through the rest of the hours, and finally the leftover minutes.",
    ],
    example: {
      prompt:
        "A movie starts at 2:35 p.m. and lasts 2 hours 40 minutes. When does it end?",
      steps: [
        "Add the hours: 2:35 p.m. + 2 hours = 4:35 p.m.",
        "Add the minutes: 35 + 40 = 75 minutes, which is 1 hour 15 minutes. So 4:35 p.m. + 40 minutes = 5:15 p.m.",
        "Check: from 2:35 to 5:15 is 25 minutes to 3:00, 2 hours to 5:00, and 15 minutes: 2 hours 40 minutes.",
      ],
      answer: "5:15 p.m.",
    },
    methodTitle: "Hours first, minutes second",
    method: [
      "End time: start + hours + minutes. Start time: end − hours − minutes.",
      "When the minutes reach 60 they carry into the next hour. When you subtract past an hour, borrow 60 minutes.",
      "Elapsed time: count to the next whole hour, then the whole hours, then the leftover minutes.",
    ],
    formalTitle: "Elapsed time",
    formal: [
      "The elapsed time from $a$ to $b$ is $b - a$. An hour is 60 minutes, so 2 hours 40 minutes is $2 \\times 60 + 40 = 160$ minutes, and the end time is the start time plus 160 minutes.",
    ],
    pitfalls: [
      "Subtracting minutes without borrowing. If the end minutes are less than the start minutes, break an hour into 60 minutes.",
      "Adding when the question asks for the start time. A start time is earlier than the end time.",
      "Forgetting to switch a.m. and p.m. when the time passes noon.",
    ],
    parentGuide:
      "Have your learner say the start time, then the hours moved, then the minutes moved, before they choose a time.",
  }),
  chainLesson({
    id: "object-for-measure-lesson",
    title: "Which object matches a measure",
    summary:
      "Use familiar benchmarks to match an object with a mass or capacity.",
    templateIds: ["object-for-measure"],
    objectives: [
      "Recall benchmarks such as 1 kilogram, 1 liter, 1 pound and 1 gallon.",
      "Reject objects whose measures are many times too large or too small.",
    ],
    openingTitle: "Compare with something you know",
    opening: [
      "A bag of sugar has a mass of about 1 kilogram. A water bottle holds about 1 liter. Knowing a few of these benchmarks lets you judge others.",
      "A kilogram is 1000 grams, so a paper clip, which is about 1 gram, is far too light, and a car is far too heavy.",
    ],
    example: {
      prompt:
        "Which has a mass closest to 1 kilogram: a paper clip, an apple, a bag of sugar or a small car?",
      steps: [
        "1 kilogram is 1000 grams.",
        "A paper clip is about 1 gram and an apple about 150 grams: both far lighter.",
        "A small car is about 1000 kilograms: far heavier. A bag of sugar is about 1 kilogram.",
      ],
      answer: "A bag of sugar",
    },
    methodTitle: "Picture, order, choose",
    method: [
      "Rename the measure in a smaller unit if it helps.",
      "Put the objects in order from the smallest measure to the largest.",
      "Choose the closest one; the others should be many times too big or too small.",
    ],
    formalTitle: "Metric and customary relationships",
    formal: [
      "Metric: 1 kilogram = 1000 grams and 1 liter = 1000 milliliters. Customary: 1 pound = 16 ounces, 1 ton = 2000 pounds, 1 gallon = 4 quarts and 1 quart = 4 cups.",
    ],
    pitfalls: [
      "Mixing mass and capacity. A liter measures how much a container holds, not how heavy it is.",
      "Choosing by the size of an object instead of its mass: a large balloon is light.",
      "Mixing units: 1 gram is far smaller than 1 kilogram.",
    ],
    parentGuide:
      "Keep a few benchmarks at hand, such as a bag of sugar or a gallon jug, and let your learner hold them.",
  }),
  chainLesson({
    id: "approximate-unit-factor-lesson",
    title: "Estimating with a decimal conversion factor",
    summary:
      "Multiply or divide by a decimal factor to convert between units, then round.",
    templateIds: ["approximate-unit-factor"],
    objectives: [
      "Decide from the sizes of the units whether to multiply or divide by the factor.",
      "Compute with a decimal factor and round to the nearest tenth.",
    ],
    openingTitle: "A smaller unit needs a bigger number",
    opening: [
      "One meter is about 3.28 feet. A foot is shorter than a meter, so it takes more feet than meters to measure the same length. A length of 15 feet is therefore fewer than 15 meters.",
      "Each meter holds 3.28 feet, so the number of meters is how many groups of 3.28 feet fit in the length.",
    ],
    example: {
      prompt:
        "A tree is 15 feet tall. One meter is about 3.28 feet. About how many meters tall is the tree?",
      steps: [
        "Feet are the smaller unit, so the count in meters is smaller than 15. Divide.",
        "$15 \\div 3.28 \\approx 4.57$.",
        "To the nearest tenth the tree is about 4.6 meters.",
      ],
      answer: "4.6 meters",
    },
    methodTitle: "Choose the operation by the sizes of the units",
    method: [
      "State the factor: one larger unit is about $k$ smaller units.",
      "Smaller to larger: divide by $k$. Larger to smaller: multiply by $k$.",
      "Estimate with a nearby whole number to check, then round to the place the options use.",
    ],
    formalTitle: "Conversion with an approximate factor",
    formal: [
      "If 1 unit $B$ is about $k$ units $A$, then $x$ units $B$ is about $kx$ units $A$, and $y$ units $A$ is about $y \\div k$ units $B$.",
    ],
    pitfalls: [
      "Multiplying when converting to the larger unit. The count must get smaller.",
      "Adding or subtracting the factor. A factor relates two units by multiplication.",
      "Misplacing the decimal point. Estimate first: 15 ÷ 3 is about 5.",
    ],
    parentGuide:
      "Ask whether the answer should be a bigger or smaller number than the starting measure before choosing.",
  }),
];

export const timeUnitChoiceFacetMappings: FacetMapping[] = [
  {
    templateId: "elapsed-time-hm",
    facetId: "elapsed-time.core",
    extent: "partial",
    rationale:
      "Choose the end time or start time from elapsed hours and minutes, or the elapsed hours and minutes between two times, with the known time on an analog clock or written, in the morning or afternoon and across noon. Does not assess times across midnight, days, or typing a time as an answer.",
  },
  {
    templateId: "object-for-measure",
    facetId: "unit-conversion.core",
    extent: "partial",
    rationale:
      "Choose the everyday object whose mass or capacity is closest to a stated metric or customary measure from a small set of benchmark objects. Does not assess pictured containers, converting between units, or measures between the benchmarks.",
  },
  {
    templateId: "approximate-unit-factor",
    facetId: "measurement-conversions.core",
    extent: "partial",
    rationale:
      "Choose the measure closest to a quantity converted between meters and feet, kilograms and pounds, inches and centimeters, or miles and kilometers using a stated decimal factor, in either direction. Does not assess factors that are not stated or conversions of squared or cubed units.",
  },
];
