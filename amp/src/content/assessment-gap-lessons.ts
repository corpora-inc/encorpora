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
    terms: ["radius", "arc", "radian"],
    method: [
      "Identify the arc that the angle sweeps, including its direction, and put its length and the radius in the same units.",
      "Divide the arc length by the positive radius. Keep an exact fraction, then check by multiplying the angle by the radius.",
    ],
    watch:
      "Use the radius, not the diameter. An arc longer than a semicircle corresponds to the larger swept angle, not the smaller angle between the radii.",
  },
};
export const assessmentGapPrinciples: Record<string, string> = {
  "measurement-error-bound":
    "If the reported value is $m$ and the error is at most $e$ (with $e \\ge 0$, read “$e$ is greater than or equal to 0”), the actual value $x$ satisfies $m-e \\le x \\le m+e$. The symbol $\\le$ means “is less than or equal to.” An error limit of $p$% of a positive reading $m$ gives $e = m \\times p \\div 100$.",
  "margin-of-error-interval":
    "An estimate $c$ with a symmetric margin of error $e$ gives the interval $[c-e,c+e]$. A 95% confidence procedure covers the fixed population parameter in about 95% of repeated samples when its assumptions hold.",
  "radian-arc-ratio":
    "For an arc of length $s$ on a circle of positive radius $r$, the swept angle in radians is $\\theta=s/r$, so $s=r\\theta$. One full turn is $2\\pi$ radians because its arc length is $2\\pi r$.",
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
      "A population is the whole group; a sample observes part of it. A margin of error gives a distance on either side of the sample estimate for the population quantity.",
    templateIds: ["margin-of-error-interval"],
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
        "Lower endpoint: 60 − 4 = 56%.",
        "Upper endpoint: 60 + 4 = 64%.",
        "The estimate 60% lies halfway between the endpoints.",
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
      "A radius reaches from a circle's center to its edge; an arc follows part of that edge. One radian is the angle that sweeps an arc as long as the radius.",
    templateIds: ["radian-arc-ratio"],
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
          "You need division and exact fractions. A radius is the distance from the center of a circle to its boundary. An arc is a connected part of that boundary. As a radius turns, its endpoint sweeps an arc. One radian is the angle that sweeps an arc whose length equals the radius. An arc twice as long as the radius sweeps two radians.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "method",
        title: "Compare the two lengths",
        paragraphs: [
          "A circle has radius 4 cm. A counterclockwise arc has length 6 cm. The arc contains 6 ÷ 4 = 3/2 radius-lengths, so the swept angle is 3/2 radians. Check: 4 × 3/2 = 6 cm. The centimeters cancel in the ratio; radians measure an angle rather than a length.",
        ],
        illustration: "assessment-radian-arc",
      },
      {
        stage: "method",
        title: "Full turns and larger arcs",
        paragraphs: [
          "A full circle has circumference $2\\pi r$, where $r$ is its radius and $\\pi$ is the constant ratio of circumference to diameter. Divide by the radius: one full turn measures $2\\pi$ radians. Half a turn is $\\pi$ radians, equal to 180 degrees.",
          "The chosen arc matters. An arc longer than half the circumference gives an angle greater than $\\pi$ radians, even though the two final radii also bound a smaller angle. Follow the direction and arc stated in the problem.",
        ],
      },
      {
        title: "The precise rule",
        paragraphs: [
          "For a counterclockwise arc of length $s \\ge 0$ on a circle with radius $r>0$, the nonnegative swept angle is $\\theta=s/r$ radians. Equivalently, $s=r\\theta$. Degree and radian measures satisfy $\\theta_{\\mathrm{rad}}=\\theta_{\\mathrm{deg}}\\pi/180$. For signed rotation, clockwise angles are negative; arc length itself is nonnegative.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A circle has radius 4 cm and a counterclockwise arc of length 6 cm. What angle does the arc sweep, in radians?",
      steps: [
        "One radian sweeps 4 cm on this circle.",
        "The arc contains 6/4 = 3/2 radius-lengths.",
        "The angle is 3/2 radians; multiplying by the radius recovers 6 cm.",
      ],
      answer: "3/2",
      answerUnit: "radians",
    },
    pitfalls: [
      "Divide by the radius, not the diameter.",
      "Keep the given arc and direction; two radii alone do not specify which swept angle is intended.",
    ],
    parentGuide:
      "Draw a radius-length along the circle’s boundary, then compare the whole arc with that length.",
  },
];
