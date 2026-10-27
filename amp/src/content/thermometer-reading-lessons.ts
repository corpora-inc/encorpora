import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

export const thermometerReadingMethods: Record<string, ProblemMethod> = {
  "thermometer-reading": {
    goal: "Read the temperature a liquid thermometer shows, in degrees Fahrenheit or degrees Celsius.",
    intuition:
      "A thermometer is a number line standing up. The liquid rises when it is warmer, and the number where its top ends is the temperature.",
    terms: [
      [
        "degree (°)",
        "The unit of temperature. °F means degrees Fahrenheit and °C means degrees Celsius.",
      ],
      [
        "small mark",
        "A mark between the numbers. Every small mark on one thermometer stands for the same number of degrees.",
      ],
      [
        "below zero",
        "Colder than 0. Readings below 0 are negative numbers, such as −5.",
      ],
    ],
    method: [
      "Find what one small mark is worth: the jump between two numbers divided by the spaces between them.",
      "Find the last numbered mark at or below the top of the liquid.",
      "Count the small marks from that number up to the top of the liquid, adding the value of one small mark for each.",
      "Write the number with its unit, °F or °C. Below 0, count up from the negative number.",
    ],
    watch:
      "Count spaces, not numbers, and check what one small mark is worth: on many thermometers a small mark is 2 degrees, not 1.",
  },
};

export const thermometerReadingPrinciples: Record<string, string> = {
  "thermometer-reading":
    "A thermometer's scale is a number line with equal spaces for equal changes in temperature. If numbered marks $a$ and $a+d$ have $s$ equal spaces between them, each space is $d \\div s$ degrees, so a reading $k$ spaces above $a$ is $a + k \\cdot \\frac{d}{s}$. Numbers below 0 are negative, and a reading closer to 0 from below is warmer.",
};

export const thermometerReadingLessons = [
  chainLesson({
    id: "thermometer-reading",
    title: "Read a thermometer",
    summary:
      "Find what one small mark is worth, then count up from the number below the liquid, in °F or °C, above and below zero.",
    templateIds: ["thermometer-reading"],
    objectives: [
      "Work out how many degrees one small mark of a thermometer stands for.",
      "Read a temperature between numbered marks, including temperatures below zero.",
    ],
    openingTitle: "A number line standing up",
    opening: [
      "A thermometer is a number line turned on its end. Warmer temperatures are higher, colder ones lower. The liquid in the tube rises as it gets warmer, and the temperature is the number where the top of the liquid ends.",
      "Only some marks have numbers. The marks between them are small marks, and each one stands for the same number of degrees. That number is not always 1, so find it before you count.",
    ],
    example: {
      prompt:
        "A Fahrenheit thermometer has numbers 30, 40, 50, 60 and 70. Between two numbers there are 5 spaces. The liquid ends 2 small marks above 50. What temperature does it show?",
      steps: [
        "The numbers go up by 10 and there are 5 spaces between them, so each small mark is $10\\div5=2$ degrees.",
        "The last number below the top of the liquid is 50.",
        "The liquid ends 2 small marks above it: $50+2\\times2=54$.",
        "The thermometer shows 54°F.",
      ],
      answer: "54°F",
    },
    methodTitle: "Step size, then count on",
    method: [
      "Divide the jump between two numbers by the spaces between them to find what one small mark is worth.",
      "Start at the last number at or below the top of the liquid and count up by that amount for each small mark. Below zero the numbers are negative: from −10, three marks of 1 degree up is −7.",
    ],
    formalTitle: "Why counting spaces works",
    formal: [
      "Equal spaces on a scale stand for equal changes in temperature. If numbered marks $a$ and $a+d$ have $s$ spaces between them, one space is $d\\div s$ degrees, and $k$ spaces above $a$ is $a+k\\cdot\\frac{d}{s}$.",
      "Temperatures below 0 are negative numbers on the same line. A reading of $-7$ is 7 degrees below 0, and $-7$ is warmer than $-10$ because it is higher on the scale.",
    ],
    pitfalls: [
      "A small mark can be worth 2 degrees: find its value before counting.",
      "Count the spaces between marks, not the marks themselves, when finding a small mark's value.",
      "Below zero, the number just below the liquid is the more negative one, such as −10 under −7.",
    ],
    parentGuide:
      "Ask your learner what one small mark is worth on this thermometer before they read it, and which numbered mark they counted from.",
  }),
];

/** The attached skill is grade 3 measurement with scaled instruments; a
 * thermometer is read the same way as its liquid-volume scale. */
export const thermometerReadingFacetMappings: FacetMapping[] = [
  {
    templateId: "thermometer-reading",
    facetId: "mass-volume.core",
    extent: "partial",
    rationale:
      "Numeric entry for reading a drawn thermometer in degrees Fahrenheit or Celsius whose small marks are 1 or 2 degrees, including readings below zero: the scale-reading part of measuring with instruments. Does not assess mass, liquid volume, temperature changes or choosing a tool.",
  },
];
