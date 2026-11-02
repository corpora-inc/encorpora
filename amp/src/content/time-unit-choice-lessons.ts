import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

export const timeUnitChoiceMethods: Record<string, ProblemMethod> = {
  "elapsed-time-hm": {
    goal: "Find an end time, a start time or the hours and minutes between two times by counting hours and minutes separately.",
    intuition:
      "One hour is 60 minutes. Elapsed time is the time that passes from a start time to an end time. To move a time forward or back, move the hours first, then the minutes. When the minutes reach 60, those 60 minutes make one more hour. a.m. means from midnight to noon, and p.m. from noon to midnight. 12:00 noon is 12:00 p.m.",
    terms: ["elapsed-time", "a-m", "p-m"],
    noLink: ["leaves", "whole"],
    method: [
      "Write the time you know, from the clock or the words, with a.m. or p.m.",
      "For an end time, add the hours, then the minutes. For a start time, take away, or subtract, the hours, then the minutes.",
      "If the minutes reach 60, make them 1 more hour. If you count back past the hour, turn 1 hour into 60 minutes: 20 minutes before 3:10 is 2 hours 70 minutes minus 20 minutes, which is 2:50.",
      "For elapsed time, count on from the start time. Go to the next o'clock, then on to the end time, and add up the hours and minutes. If both times are in the same hour, just subtract the minutes.",
    ],
    watch:
      "Count across the hour carefully. From 2:50 to 4:20 is 10 minutes to 3:00, 1 hour to 4:00 and 20 minutes more: 1 hour 30 minutes.",
  },
  "object-for-measure": {
    goal: "Choose the object whose mass or capacity matches a stated measure.",
    intuition:
      "A unit is an amount you measure with. Mass is how heavy something is, measured in units like kilograms and pounds. A bag of sugar is about 1 kilogram. Capacity is how much a container holds, measured in units like liters and gallons. A big water bottle holds about 1 liter. A milk jug holds about 1 gallon. A benchmark is a thing you know well, used to judge other amounts. Picture the amount, then compare each object with it.",
    terms: ["benchmark"],
    senses: { unit: "unit", rename: "rename" },
    noLink: ["rule"],
    method: [
      "If it helps, write the amount in a smaller unit. 1 kilogram is 1000 grams. 1 liter is 1000 milliliters. 1 pound is 16 ounces. 1 gallon is 4 quarts.",
      "Put the objects in order, from smallest amount to largest, using what you know about them.",
      "Choose the object closest to the amount. The others are many times too big or too small.",
    ],
    watch:
      "Mass and capacity are different. A kilogram measures how heavy something is. A liter measures how much a container holds.",
  },
  "approximate-unit-factor": {
    goal: "Convert a measure to another unit with a decimal conversion factor and choose the closest estimate.",
    intuition:
      "A unit is an amount you measure with, like an inch or a centimeter. To convert a measure means to write it in a different unit. Here you are told how many of one unit make one of the other, like 1 inch = 2.54 centimeters. That number, how many of one unit make one of the other, is the conversion factor. The smaller unit always needs the bigger number. To go to the smaller unit, multiply by the factor. To go to the bigger unit, divide by it.",
    terms: [
      [
        "conversion-factor",
        "Here, the factor is how many of the smaller unit make one of the larger unit, such as 2.54 centimeters in 1 inch.",
      ],
    ],
    senses: { unit: "unit" },
    noLink: ["certain", "side"],
    method: [
      "Say the factor as a sentence: one larger unit is about this many smaller units.",
      "Going to the smaller unit, multiply by the factor. Going to the larger unit, divide by it.",
      "Check the size: the number in the smaller unit must be the bigger number. Then pick the choice closest to your answer.",
    ],
    watch:
      "Dividing when you should multiply moves the answer the wrong way. Ask first whether the number should grow or shrink.",
  },
};

export const timeUnitChoicePrinciples: Record<string, string> = {
  "elapsed-time-hm":
    "One hour is 60 minutes. A clock goes around twice a day: a.m. from midnight to noon and p.m. from noon to midnight. An end time is the start time plus the elapsed time. A start time is the end time minus the elapsed time. When the minutes go past 60, 60 of them make one more hour.",
  "object-for-measure":
    "To match a measure, compare it with things you know. Amounts that are many times apart are easy to tell apart. In metric units, 1 kilogram is 1000 grams and 1 liter is 1000 milliliters. In customary units, 1 pound is 16 ounces and 1 gallon is 4 quarts.",
  "approximate-unit-factor":
    "If 1 large unit is about $k$ small units, then $x$ large units are about $k \\times x$ small units, and $y$ small units are about $y \\div k$ large units. The factor may be rounded, so the answer may be an estimate. Round it the way the choices are rounded.",
};

export const timeUnitChoiceLessons = [
  chainLesson({
    id: "elapsed-time-hm-lesson",
    title: "Start, end and elapsed time",
    summary:
      "Elapsed time is the time that passes from a start time to an end time. One hour is 60 minutes. To find an end time, add how long it lasts to the start time: the hours, then the minutes. To find a start time, take them away from the end time. To find the elapsed time, count from the start to the end.",
    templateIds: ["elapsed-time-hm"],
    noLink: ["leaves", "whole"],
    objectives: [
      "Add or subtract hours and then minutes to find an end time or a start time.",
      "Find the hours and minutes that pass between two clock times.",
    ],
    openingTitle: "Move the hours, then the minutes",
    opening: [
      "A clock hour has 60 minutes. Adding 2 hours moves the clock 2 hours ahead. The minutes stay the same.",
      "Adding minutes can go past the next o'clock. Then each 60 minutes make 1 more hour. For example, 35 minutes + 40 minutes is 75 minutes. That is 1 hour and 15 minutes.",
      "a.m. means a time from midnight to noon. p.m. means a time from noon to midnight. 12:00 noon is written 12:00 p.m., and midnight is 12:00 a.m. When a time goes past 12 noon, a.m. changes to p.m.",
      "To find elapsed time, walk along the clock from the start time. First go to the next o'clock. Then count the whole hours. Last, add the minutes that are left. If both times are in the same hour, just subtract, or take away, the minutes.",
    ],
    example: {
      prompt:
        "A movie starts at 2:35 p.m. and lasts 2 hours 40 minutes. When does it end?",
      steps: [
        "The end time is later, so add. Add the hours first, because they only move the hour: 2:35 p.m. + 2 hours = 4:35 p.m.",
        "Now add the 40 minutes. 35 + 40 = 75 minutes. 60 of those minutes make 1 hour, so 75 minutes is 1 hour 15 minutes. So 4:35 p.m. + 40 minutes = 5:15 p.m.",
        "Check by counting from the start: 25 minutes from 2:35 to 3:00, 2 hours to 5:00, then 15 minutes. 25 + 15 = 40 minutes, so that is 2 hours 40 minutes.",
      ],
      answer: "5:15 p.m.",
    },
    methodTitle: "Hours first, minutes second",
    method: [
      "End time: start time, plus the hours, plus the minutes. Start time: end time, minus the hours, minus the minutes.",
      "When the minutes reach 60, they make 1 more hour. When you count back past the hour, turn 1 hour into 60 minutes. For 20 minutes before 3:10, think of 3:10 as 2 hours and 70 minutes. 70 − 20 = 50, so it is 2:50.",
      "Elapsed time: count on from the start to the next o'clock, then the whole hours, then the minutes that are left. If both times are in the same hour, subtract the minutes.",
    ],
    formalTitle: "Elapsed time",
    formal: [
      "Elapsed time is how much time passes from the start time to the end time. Counting on from the start finds it, even when the clock passes 12. An end time is the start time plus the elapsed time.",
      "An hour is 60 minutes. So 2 hours 40 minutes is $2 \\times 60 + 40 = 160$ minutes. The end time is 160 minutes after the start time.",
    ],
    pitfalls: [
      "If the end minutes are less than the start minutes, turn 1 hour into 60 minutes before you subtract.",
      "Do not add when the question asks for the start time. A start time is earlier than the end time.",
      "Switch a.m. to p.m. when the time goes past 12 noon.",
    ],
    parentGuide:
      "Have your learner say the start time, then the hours moved, then the minutes moved, before they choose a time.",
  }),
  chainLesson({
    id: "object-for-measure-lesson",
    title: "Which object matches a measure",
    summary:
      "Mass is how heavy something is. A kilogram is a unit of mass: a bag of sugar is about 1 kilogram. Capacity is how much a container holds. A benchmark is a thing you know well, used to judge other amounts. Compare each object with benchmarks to find the one that matches a measure.",
    templateIds: ["object-for-measure"],
    senses: { unit: "unit", rename: "rename" },
    objectives: [
      "Remember benchmarks for 1 kilogram, 1 liter, 1 pound and 1 gallon.",
      "Rule out objects that are many times too big or too small.",
    ],
    openingTitle: "Compare with something you know",
    opening: [
      "Kilograms and pounds measure mass. Liters and gallons measure capacity. A bag of sugar has a mass of about 1 kilogram. A loaf of bread is about 1 pound. A big water bottle holds about 1 liter. A milk jug holds about 1 gallon. These are benchmarks. Knowing a few of them helps you judge other things.",
      "A kilogram is 1000 grams. A paper clip is about 1 gram, so it is far too light to be 1 kilogram. A car is far too heavy.",
    ],
    example: {
      prompt:
        "Which has a mass closest to 1 kilogram: a paper clip, an apple, a bag of sugar or a small car?",
      steps: [
        "Write 1 kilogram in the smaller unit, so it is easy to compare: 1 kilogram is 1000 grams.",
        "A paper clip is about 1 gram, and an apple about 150 grams. Both are far lighter than 1000 grams.",
        "A small car is about 1000 kilograms, far heavier. A bag of sugar is about 1 kilogram, so it is the closest.",
      ],
      answer: "A bag of sugar",
    },
    methodTitle: "Picture, order, choose",
    method: [
      "If it helps, write the measure in a smaller unit.",
      "Put the objects in order, from smallest amount to largest.",
      "Choose the closest one. The others should be many times too big or too small.",
    ],
    formalTitle: "Metric and customary units",
    formal: [
      "Metric units, like grams and liters, are used in most countries. 1 kilogram is 1000 grams, and 1 liter is 1000 milliliters.",
      "Customary units, like pounds and gallons, are used in the United States. 1 pound is 16 ounces, and 1 ton is 2000 pounds. 1 gallon is 4 quarts, and 1 quart is 4 cups.",
    ],
    pitfalls: [
      "Do not mix up mass and capacity. A liter measures how much a container holds, not how heavy it is.",
      "Do not choose by how big an object looks. A large balloon is very light.",
      "Do not mix up units. 1 gram is far less than 1 kilogram.",
    ],
    parentGuide:
      "Keep a few benchmarks at hand, such as a bag of sugar or a gallon jug, and let your learner hold them.",
  }),
  chainLesson({
    id: "approximate-unit-factor-lesson",
    title: "Estimating with a decimal conversion factor",
    summary:
      "A unit is an amount you measure with, like a meter or a foot. To convert a measure means to write it in another unit. The conversion factor tells how many of one unit make one of the other. One meter is about 3.28 feet, so here the conversion factor is 3.28. Multiply by it to go to the smaller unit. Divide by it to go to the bigger unit. Then round: write the answer to the same place as the choices, like one digit after the point.",
    templateIds: ["approximate-unit-factor"],
    senses: { unit: "unit" },
    objectives: [
      "Decide from the sizes of the units whether to multiply or divide by the factor.",
      "Work with a decimal factor and round to the nearest tenth.",
    ],
    openingTitle: "A smaller unit needs a bigger number",
    opening: [
      "A meter is about the length of a big step. A foot is about the length of a grown-up's shoe. One meter is about 3.28 feet.",
      "A foot is shorter than a meter. So it takes more feet than meters to measure the same length. That means 15 feet is fewer than 15 meters.",
      "Each meter holds about 3.28 feet. So the number of meters is how many groups of 3.28 feet fit in the length. Finding how many groups fit is division.",
    ],
    example: {
      prompt:
        "A tree is 15 feet tall. One meter is about 3.28 feet. About how many meters tall is the tree?",
      steps: [
        "A meter is the bigger unit, so the tree is fewer than 15 meters tall. To go to the bigger unit, divide.",
        "Divide 15 by 3.28. The sign $\\approx$ means about equal to: $15 \\div 3.28 \\approx 4.57$.",
        "Round to the nearest tenth, one digit after the point. 4.57 is between 4.5 and 4.6, and it is closer to 4.6. So the tree is about 4.6 meters tall.",
      ],
      answer: "4.6 meters",
    },
    methodTitle: "Choose the operation by the sizes of the units",
    method: [
      "Call the conversion factor $k$, a letter that stands for a number like 3.28. Say it as a sentence: one larger unit is about $k$ smaller units.",
      "Smaller unit to larger unit: divide by $k$. Larger unit to smaller unit: multiply by $k$.",
      "Check with an easier number close to the factor, like 3 instead of 3.28. 15 ÷ 3 = 5, so an answer near 5 makes sense. Then round the way the choices are written.",
    ],
    formalTitle: "Converting with a factor that is about right",
    formal: [
      "Say 1 large unit is about $k$ small units. Then a number $x$ of large units is about $k \\times x$ small units. And a number $y$ of small units is about $y \\div k$ large units.",
      "Some factors are exact, like 1 inch = 2.54 centimeters. Others are rounded, like 1 meter is about 3.28 feet. With a rounded factor, the answer is an estimate: close, but not exact.",
    ],
    pitfalls: [
      "Do not multiply when going to the larger unit. The number must get smaller.",
      "Do not add or subtract the factor. It tells how many times bigger one unit is, so multiply or divide.",
      "Put the point in the right place. Check with easier numbers first: 15 ÷ 3 is 5.",
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
