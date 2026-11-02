import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";
export const assessmentGapMethods: Record<string, ProblemMethod> = {
  "measurement-error-bound": {
    goal: "A scale shows a reading and a largest possible error. Find the smallest or greatest mass the object could really have.",
    intuition:
      "A measuring tool is never perfect. The reported value is the number it shows. The actual value is the true amount, which may be a little different. The error limit is the most the two can differ. So the actual value is somewhere from the reading minus the limit up to the reading plus the limit.",
    senses: { unit: "unit", difference: "difference-subtract" },
    noLink: ["side", "base", "scale", "range"],
    terms: [
      [
        "error-limit",
        "The reported value is the measurement the instrument displays.",
      ],
      "error-limit",
    ],
    method: [
      "Write the error limit in the same unit as the reading. If it is a percent of the reading, find that amount first: reading × percent ÷ 100.",
      "For the smallest possible value, subtract the error limit from the reading. For the greatest, add it.",
      "“At most” allows the error to equal the limit, so both ends of the range count.",
    ],
    watch:
      "The error limit may be given as a percent of the reading. Turn it into grams before you add or subtract it. An error of 2% of 80 g is 1.6 g, not 2 g.",
  },
  "margin-of-error-interval": {
    goal: "Find the interval centered on an estimate with a stated margin of error.",
    terms: ["population", "sample", "margin-of-error"],
    method: [
      "Identify the sample estimate and express the margin of error in the same units. A percentage estimate uses percentage points.",
      "Subtract the margin for the lower endpoint and add it for the upper endpoint. Interpret the interval as an estimate for the population quantity.",
    ],
    watch:
      "The margin is half the interval width. Confidence describes the sampling procedure; it does not guarantee this interval or describe individual measurements.",
  },
  "radian-arc-ratio": {
    goal: "Measure a swept angle by comparing its arc length with the radius.",
    senses: { center: "center" },
    noLink: ["edge", "whole"],
    intuition:
      "A radius is the distance from a circle's center to its edge. An arc is a curved piece of the edge. A radian is a unit of angle: one radian sweeps an arc as long as the radius. So the angle in radians is the arc length divided by the radius. Counterclockwise means against a clock's hands. A semicircle is half a circle.",
    terms: ["radius", "arc", "radian"],
    method: [
      "Find the arc that the angle sweeps, with its direction. Put its length and the radius in the same units.",
      "Divide the arc length by the radius, which is positive. Keep an exact fraction. Check by multiplying the angle by the radius: you should get the arc length back.",
    ],
    watch:
      "Use the radius, not the diameter. An arc longer than a semicircle goes with the larger swept angle, not the smaller angle between the radii.",
  },
};
export const assessmentGapPrinciples: Record<string, string> = {
  "measurement-error-bound":
    "If the reported value is $m$ and the error is at most $e$ (with $e \\ge 0$, read “$e$ is greater than or equal to 0”), the actual value $x$ satisfies $m-e \\le x \\le m+e$. The symbol $\\le$ means “is less than or equal to.” An error limit of $p$% of a positive reading $m$ gives $e = m \\times p \\div 100$.",
  "margin-of-error-interval":
    "An estimate $c$ with a symmetric margin of error $e$ gives the interval $[c-e,c+e]$. A 95% confidence procedure covers the fixed population parameter in about 95% of repeated samples when its assumptions hold.",
  "radian-arc-ratio":
    "For a counterclockwise arc of length $s$ on a circle with radius $r>0$, the swept angle in radians is $\\theta=\\frac{s}{r}$, so $s=r\\theta$. One full turn is $2\\pi$ radians, because its arc, the whole circumference, has length $2\\pi r$.",
};
export const assessmentGapLessons: Lesson[] = [
  {
    id: "measurement-error-bound",
    title: "Measurements leave a range",
    summary:
      "No measuring tool is perfect. The number a scale shows is called the reported value. The true amount, the actual value, can be a little more or a little less. An error limit tells the most they can differ. If a scale shows 80 g and the error is at most 2 g, the actual mass is anywhere from 78 g to 82 g.",
    senses: { unit: "unit", difference: "difference-subtract" },
    noLink: ["range", "base", "scale", "more than", "rule", "change", "side"],
    templateIds: ["measurement-error-bound"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Tell apart the reported value (what the tool shows) and the actual value (the true amount).",
      "Find the smallest and greatest possible actual value from an error limit given in units or as a percent of the reading.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "A reading and its error limit",
        paragraphs: [
          "You need addition, subtraction and percents. A percent means “out of 100,” so 2.5% means 2.5 out of every 100.",
          "Put a bag on a kitchen scale and it shows 80 g. That shown number is the reported value. The real mass of the bag is the actual value. The two may not match exactly.",
          "The error limit is the largest difference allowed between them. It is measured in the same unit as the reading. Here the unit is grams (the gram is a small unit of mass, how heavy something is). We write 80 grams as 80 g. “The error is at most 2 g” means the actual mass is no more than 2 g below the reading and no more than 2 g above it.",
          "So the actual mass sits in a range around the reading. The range reaches the same distance down as up.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "method",
        title: "Work outward from the reading",
        paragraphs: [
          "A scale reports 80 g, and the error is at most 2 g. Subtract the limit to get the smallest possible mass: 80 − 2 = 78 g. Add the limit to get the greatest possible mass: 80 + 2 = 82 g.",
          "Both ends count. “At most 2 g” allows the error to be exactly 2 g, so 78 g and 82 g are both possible.",
        ],
        illustration: "assessment-measurement-interval",
      },
      {
        stage: "method",
        title: "When the error is a percent",
        paragraphs: [
          "Sometimes the limit is a percent of the reading, such as 2.5% of 80 g. A percent of an amount is the amount times the percent, divided by 100. So first turn the percent into grams: 80 × 2.5 ÷ 100 = 2 g.",
          "Now the error limit is 2 g, the same as before. The range is again 78 g to 82 g.",
          "Read which amount the percent is taken of. Here it is the reported value, 80 g. A percent of a different amount would give a different number of grams.",
        ],
      },
      {
        title: "The precise rule",
        paragraphs: [
          "Let $m$ be the reported value, $x$ the actual value, and $e$ the error limit, a number 0 or greater in the same unit. The symbol $\\le$ means “is less than or equal to.”",
          "The rule is $m - e \\le x \\le m + e$. It says the actual value is no less than $m - e$ and no more than $m + e$.",
          "If the error limit is $p$% of a positive reading $m$, then $e = m \\times p \\div 100$.",
          "These bounds use a stated error limit. A value that was rounded, such as “to the nearest tenth,” follows a separate rule about its ends.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A scale reports 80 g. The error is at most 2.5% of the reported value. What is the greatest possible actual mass?",
      steps: [
        "Turn the percent into grams so it matches the reading: 80 × 2.5 ÷ 100 = 2 g.",
        "The question asks for the greatest mass, so add the error limit to the reading: 80 + 2 = 82 g.",
        "Check: 82 g is 2 g above 80 g. That is exactly the limit, and “at most” allows it.",
      ],
      answer: "82",
      answerUnit: "g",
    },
    pitfalls: [
      "The error limit may be given as a percent of the reading. Change it into the reading's unit before adding or subtracting. Then the numbers measure the same thing.",
      "Take the percent of the amount the question names, usually the reported value.",
      "Use the error limit once on each side. The full range is twice the limit wide.",
    ],
    parentGuide:
      "Weigh something on a kitchen scale and pretend the error is at most 5 g. Ask for the smallest and greatest possible true mass. Check that both are the same distance from the reading.",
  },
  {
    id: "margin-of-error-interval",
    title: "An estimate with room on each side",
    summary:
      "A survey usually asks only some people, a sample, about a larger group, the population. A different random sample would give a slightly different answer. The margin of error is a distance on either side of the sample's estimate, and the true population value is likely within that range.",
    templateIds: ["margin-of-error-interval"],
    senses: {
      sample: "sample",
      population: "population",
      interval: "interval",
      intervals: "interval",
      difference: "difference-subtract",
      differences: "difference-subtract",
      unit: "unit",
      units: "unit",
      mean: "mean-average",
      parameter: "parameter",
    },
    noLink: ["side", "sides", "range", "whole", "part"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Build a symmetric interval from an estimate and its margin of error.",
      "Distinguish a population estimate, individual values and the meaning of confidence.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Why an estimate comes with a range",
        paragraphs: [
          "You need addition, subtraction and percentages. A population is the whole group you want to study. A sample is the part you observe. Different random samples can give different estimates, so a sample estimate is not an exact population value. A margin of error is the distance from an estimate to each endpoint of its reported interval. A percentage point measures a difference between percentages: from 60% to 64% is 4 percentage points, not 4% of 60%.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "method",
        title: "Build the interval",
        paragraphs: [
          "A random survey estimates that 60% of a town’s residents support a park. Its margin of error is 4 percentage points. A percentage point is a unit for differences between percentages. Subtract 4 from 60 to get 56%; add 4 to get 64%. The interval is from 56% to 64%. Its full width is 8 percentage points, twice the margin.",
        ],
        illustration: "assessment-sampling-interval",
      },
      {
        stage: "method",
        title: "What confidence means",
        paragraphs: [
          "A 95% confidence level describes the method: if its assumptions hold and we repeatedly draw random samples and build intervals in the same way, about 95% of those intervals cover the population value. One particular interval can miss. It does not mean that 95% of residents have an individual value in this range, or that the population percentage is exactly 60%.",
          "For a population mean, use the measurement’s units. A sample estimate of 120 liters with a margin of error of 6 liters gives an interval from 114 to 126 liters for the population mean, not a prediction that each household uses between those amounts.",
          "Larger random samples generally reduce sampling uncertainty when other conditions and the confidence level stay comparable. A bigger sample does not repair a biased selection method.",
        ],
      },
      {
        title: "The precise rule",
        paragraphs: [
          "For a symmetric margin of error $e \\ge 0$ around an estimate $c$, the interval is $[c-e,c+e]$ and its width is $2e$. The confidence level concerns repeated-sampling coverage under the method’s assumptions. The population parameter is fixed; the sample estimate and resulting interval vary.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A random survey estimates support at 60%, with a margin of error of 4 percentage points. What interval does this give?",
      steps: [
        "The margin of error is a distance on both sides of the estimate, so subtract it for the lower end: 60% − 4 percentage points = 56%.",
        "Add it for the upper end: 60% + 4 percentage points = 64%.",
        "Check: the estimate 60% lies halfway between the endpoints. The interval is the range of likely values for the true support, not a guarantee.",
      ],
      answer: "56% to 64%",
    },
    pitfalls: [
      "Subtract percentage points directly; do not take a relative percentage of the estimate.",
      "The interval concerns the population quantity and carries uncertainty.",
    ],
    parentGuide:
      "Have the learner identify the population, estimate, margin and two endpoints before interpreting confidence.",
  },
  {
    id: "radian-arc-ratio",
    title: "Measure an angle by its arc",
    summary:
      "Measure an angle by how far its tip travels. Picture a circle with radius 4 cm, the distance from its center to its edge. Turn a radius around the center. Its endpoint traces an arc, a curved piece of the circle's edge. When that arc is 4 cm long, as long as the radius, the turn is called one radian. An arc 6 cm long is $6 \\div 4 = \\frac32$ radius-lengths, so that turn is $\\frac32$ radians.",
    templateIds: ["radian-arc-ratio"],
    senses: {
      center: "center",
      unit: "unit",
      units: "unit",
      degree: "degree-angle",
      degrees: "degree-angle",
    },
    noLink: ["edge", "boundary", "whole", "opposite"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Find a swept angle in radians using arc length divided by radius.",
      "Connect radians with a full turn and distinguish a swept arc from the smaller angle between radii.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Use the radius as a measuring stick",
        paragraphs: [
          "You need division and exact fractions. A radius is the distance from the center of a circle to its edge, and also a segment of that length. An arc is a connected, curved piece of the edge. As a radius turns about the center, its endpoint sweeps out an arc. One radian is the angle that sweeps an arc whose length equals the radius. An arc twice as long as the radius sweeps two radians. So the angle in radians is the arc length divided by the radius.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "method",
        title: "Compare the two lengths",
        paragraphs: [
          "A circle has radius 4 cm. A counterclockwise arc, one traced against a clock's hands, has length 6 cm. The arc holds $6 \\div 4 = \\frac32$ radius-lengths, so the swept angle is $\\frac32$ radians. Check: $4 \\times \\frac32 = 6$ cm. Both lengths are in centimeters, so the units cancel when you divide. A radian measures an angle, not a length.",
        ],
        illustration: "assessment-radian-arc",
      },
      {
        stage: "method",
        title: "Full turns and larger arcs",
        paragraphs: [
          "The circumference of a circle, the distance all the way around, is $2\\pi r$. Here $r$ is the radius, and $\\pi$ (pi), about 3.14, is the circumference divided by the diameter for every circle. Divide the circumference by the radius: one full turn is $2\\pi$ radians. Half a turn is $\\pi$ radians, which is 180 degrees.",
          "The chosen arc matters. Two radii split the circle into two arcs. Unless the radii point in opposite directions, one arc is shorter and one is longer. An arc longer than half the circumference sweeps an angle greater than $\\pi$ radians, even though the two radii also make a smaller angle. Follow the arc and direction the problem states.",
        ],
      },
      {
        title: "The precise rule",
        paragraphs: [
          "For a counterclockwise arc of length $s \\ge 0$ on a circle with radius $r>0$, the swept angle is $\\theta=\\frac{s}{r}$ radians, which is 0 or positive. Equivalently, $s=r\\theta$. Degree and radian measures of the same angle satisfy $\\theta_{\\mathrm{rad}}=\\frac{\\pi}{180}\\theta_{\\mathrm{deg}}$. When turns have a direction, clockwise angles are negative. An arc length is never negative.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A circle has radius 4 cm and a counterclockwise arc of length 6 cm. What angle does the arc sweep, in radians?",
      steps: [
        "One radian sweeps an arc as long as the radius. On this circle, that is 4 cm.",
        "So count how many radius-lengths fit in the arc: $6 \\div 4 = \\frac64 = \\frac32$.",
        "The angle is $\\frac32$ radians. Check by multiplying by the radius: $4 \\times \\frac32 = 6$ cm, the arc length.",
      ],
      answer: "3/2",
      answerUnit: "radians",
    },
    pitfalls: [
      "Divide by the radius, not the diameter, which is twice the radius.",
      "Keep the given arc and direction. Two radii alone do not say which of the two angles is meant.",
    ],
    parentGuide:
      "Draw a radius-length along the circle’s boundary, then compare the whole arc with that length.",
  },
];
