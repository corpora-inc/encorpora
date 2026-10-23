import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";
export const assessmentGapMethods: Record<string, ProblemMethod> = {
  "measurement-error-bound": {
    goal: "Find the smallest or greatest possible actual measurement.",
    terms: [
      ["reported value", "The measurement displayed by an instrument."],
      [
        "error limit",
        "The largest allowed distance between a reported value and the actual value.",
      ],
    ],
    method: [
      "Express the error limit in the same units as the reported measurement. If it is a percentage, take that percentage of the stated base.",
      "Subtract the error limit for the lower bound; add it for the upper bound. “At most” includes both endpoints.",
    ],
    watch:
      "Use the base named in the question. An error of 2% is a fraction of that base; an error of 2 grams is already a length along the mass scale.",
  },
  "margin-of-error-interval": {
    goal: "Find the interval centered on an estimate with a stated margin of error.",
    terms: [
      ["population", "The whole group being studied."],
      ["sample", "The part of that group actually observed."],
      [
        "margin of error",
        "The distance from an estimate to each endpoint of its reported interval.",
      ],
    ],
    method: [
      "Identify the sample estimate and express the margin of error in the same units. A percentage estimate uses percentage points.",
      "Subtract the margin for the lower endpoint and add it for the upper endpoint. Interpret the interval as an estimate for the population quantity.",
    ],
    watch:
      "The margin is half the interval width. Confidence describes the sampling procedure; it does not guarantee this interval or describe individual measurements.",
  },
  "radian-arc-ratio": {
    goal: "Measure a swept angle by comparing its arc length with the radius.",
    terms: [
      ["radius", "The distance from the center of a circle to its boundary."],
      ["arc", "A connected portion of the circle’s boundary."],
      ["radian", "The angle that sweeps an arc equal in length to the radius."],
    ],
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
    "If the reported value is $m$ and the absolute error is at most $e \\ge 0$, then $m-e \\le x \\le m+e$ for the actual value $x$. A relative error limit of $p$% of the reported value gives $e = |m|p/100$.",
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
      "Turn an error limit into the smallest and greatest allowed measurements.",
    templateIds: ["measurement-error-bound"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Distinguish a reported measurement from the actual value.",
      "Apply absolute and explicitly based relative error limits without rounding.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "A reading and its error limit",
        paragraphs: [
          "You need addition, subtraction and percentages. A reported value is the number an instrument displays. The actual value may differ from it. An absolute error limit is the greatest allowed difference, in the measurement’s units. An error of at most 2 g means the actual mass may be 2 g below or above the reading, or anywhere between.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "method",
        title: "Work outward from the reading",
        paragraphs: [
          "An instrument reports 80 g with error at most 2 g. Subtract to get the smallest allowed mass: 80 − 2 = 78 g. Add to get the greatest: 80 + 2 = 82 g. Both endpoints are allowed because the error may equal 2 g.",
        ],
        illustration: "assessment-measurement-interval",
      },
      {
        stage: "method",
        title: "When the error is a percentage",
        paragraphs: [
          "If the error limit is 2.5% of the reported 80 g, first convert it to grams: 80 × 2.5/100 = 2 g. Then use the same range, from 78 g to 82 g. A percentage needs a base: if the question specifies the actual value as the base instead, these bounds do not follow from the same calculation.",
        ],
      },
      {
        title: "The precise rule",
        paragraphs: [
          "Let $m$ be the reported value, $x$ the actual value and $e$ a nonnegative error limit in the same units. The condition $|x-m| \\le e$ means $m-e \\le x \\le m+e$. If the error is at most $p$% of the reported value, use $e = |m|p/100$. These bounds describe an explicit error limit; rounding to a fixed number of decimal places can require different endpoint conventions.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A scale reports 80 g. The error is at most 2.5% of the reported value. What is the greatest possible actual mass?",
      steps: [
        "The error limit is 80 × 2.5/100 = 2 g.",
        "Add the error limit: 80 + 2 = 82 g.",
        "Check: 82 differs from 80 by 2 g, exactly the allowed limit.",
      ],
      answer: "82",
      answerUnit: "g",
    },
    pitfalls: [
      "Express the error in the same unit before adding or subtracting.",
      "A relative error must use the base explicitly named in the question.",
    ],
    parentGuide:
      "Ask for both endpoints and check that each is the same distance from the reading.",
  },
  {
    id: "margin-of-error-interval",
    title: "An estimate with room on each side",
    summary:
      "Read an estimate and its margin of error as a range for a population quantity.",
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
          "You need addition, subtraction and percentages. A population is the whole group you want to study. A sample is the part you observe. Different random samples can give different estimates, so a sample estimate is not an exact population value. A margin of error is the distance from an estimate to each endpoint of its reported interval.",
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
      "A radian compares the arc swept out by an angle with the circle’s radius.",
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
