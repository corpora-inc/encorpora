import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

export const thermometerReadingMethods: Record<string, ProblemMethod> = {
  "read-thermometer": {
    goal: "Read a temperature from the top of the liquid on a marked scale, then compare two readings by subtracting.",
    intuition:
      "A thermometer is a number line stood on its end. The liquid rises higher when it is warmer, and the height of the top of the liquid shows the temperature. You read it the way you read any scale: find what one mark is worth, then count from a labeled mark.",
    terms: [
      [
        "degree",
        "The unit for temperature. Degrees Fahrenheit and degrees Celsius are two scales.",
      ],
      [
        "gridline",
        "A mark across the scale. Not every gridline has a number written beside it.",
      ],
    ],
    method: [
      "Work out what one gridline is worth: take two neighboring labeled lines, subtract, and divide by the number of spaces between them.",
      "Find the labeled line just below the top of the liquid and count up by the gridline value to the top.",
      "To compare two readings, read each one and subtract the lower from the higher.",
    ],
    watch:
      "Do not read the nearest label if the top is between labels. Count the gridlines from the label below it, and count by what each gridline is worth, not by ones.",
  },
};

export const thermometerReadingPrinciples: Record<string, string> = {
  "read-thermometer":
    "A temperature scale is a number line: equal gridline spaces are equal numbers of degrees, and the reading is the number at the top of the liquid. The change between two temperatures is the higher reading minus the lower reading.",
};

export const thermometerReadingLessons = [
  chainLesson({
    id: "read-thermometer-lesson",
    title: "Reading a thermometer",
    summary:
      "Read a temperature from a marked scale and find how many degrees warmer or colder one reading is.",
    templateIds: ["read-thermometer"],
    objectives: [
      "Find what one gridline of a temperature scale is worth.",
      "Read the temperature at the top of the liquid, and subtract two readings to find a change.",
    ],
    openingTitle: "A thermometer is an upright number line",
    opening: [
      "The liquid in a thermometer rises when it gets warmer. The height of its top shows the temperature on the scale beside it. Degrees measure temperature, in degrees Fahrenheit or degrees Celsius.",
      "Only some gridlines have numbers, so first find what one gridline is worth. If the labels 25 and 50 have five spaces between them, each space is $(50-25)\\div5=5$ degrees.",
    ],
    example: {
      prompt:
        "The top of the liquid is two gridlines above the labeled line 50. Each gridline is worth 5 degrees. What does it read?",
      steps: [
        "Start at the labeled line: 50 degrees.",
        "Two gridlines up is $2\\times5=10$ degrees more.",
        "$50+10=60$.",
      ],
      answer: "60 degrees",
    },
    methodTitle: "Find the step, then count from a label",
    method: [
      "Step: subtract two neighboring labels and divide by the spaces between them.",
      "Reading: start at the label just below the top and count up by the step. To find how much warmer one reading is than another, subtract.",
    ],
    formalTitle: "Scales and change",
    formal: [
      "Equal spaces on the scale are equal differences in temperature. The reading is the label below plus the number of gridlines times the step.",
      "The difference between two temperatures is the higher reading minus the lower reading, in the same degrees.",
    ],
    pitfalls: [
      "Counting gridlines by ones when each one is worth 5 or 2 degrees.",
      "Reading the closest labeled number when the top is between labels.",
      "Subtracting readings from two different scales. Both readings must be in the same degrees.",
    ],
    parentGuide:
      "Ask your learner what one tick mark is worth before reading the top of the liquid.",
  }),
];

export const thermometerReadingFacetMappings: FacetMapping[] = [
  {
    templateId: "read-thermometer",
    facetId: "mass-volume.core",
    extent: "partial",
    rationale:
      "Numeric entry for reading a positive Fahrenheit or Celsius temperature from the top of a bar on a gridded scale whose gridlines are worth 5 or 2 degrees, and for the difference between two readings. The bar chart stands in for the liquid column. Does not assess negative temperatures, a drawn bulb-and-tube thermometer, estimating between gridlines, or temperature stories.",
  },
];
