import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

export const thermometerReadingMethods: Record<string, ProblemMethod> = {
  "read-thermometer": {
    goal: "Read a temperature from the top of the liquid on a marked scale, then compare two readings by subtracting.",
    intuition:
      "Temperature tells how hot or cold something is. It is counted in degrees, the steps on a temperature scale. A thermometer shows it with liquid in a tube. The liquid rises when it gets warmer. A number line is a line with numbers in order, evenly spaced. Beside the tube is a scale: a number line standing up. Its spaces are all equal. A gridline is a line across the scale. Only some gridlines have a number, called a label.",
    terms: [
      "degree-temperature",
      [
        "tick-mark",
        "A gridline is a mark across the scale; not every gridline has a number beside it.",
      ],
    ],
    senses: { degree: "degree-temperature", scale: "measuring-scale" },
    noLink: ["change"],
    method: [
      "Find how many degrees one space is worth. Subtract the smaller of two labels next to each other from the bigger one, then divide by the equal spaces between them.",
      "Find the label just below the top of the liquid. Count up from it by the gridline value.",
      "To compare two readings in the same kind of degrees, read each one. Then subtract the lower one from the higher one.",
    ],
    watch:
      "If the top is between labels, do not just read the nearest label. Count gridlines up from the label below, by what each one is worth.",
  },
};

export const thermometerReadingPrinciples: Record<string, string> = {
  "read-thermometer":
    "A temperature scale is a number line. Equal spaces stand for equal numbers of degrees. The reading is the number at the top of the liquid. How much warmer or colder is the higher reading minus the lower one.",
};

export const thermometerReadingLessons = [
  chainLesson({
    id: "read-thermometer-lesson",
    title: "Reading a thermometer",
    summary:
      "Temperature tells how hot or cold something is. We count it in degrees, the steps on a temperature scale. A thermometer has liquid in a tube that rises when it gets warmer. The number beside the top of the liquid is the reading. Subtract two readings to find how much warmer or colder one is.",
    templateIds: ["read-thermometer"],
    senses: {
      degree: "degree-temperature",
      scale: "measuring-scale",
      difference: "difference-subtract",
    },
    noLink: ["change"],
    objectives: [
      "Find what one gridline on a thermometer is worth.",
      "Read the temperature at the top of the liquid, and subtract two readings to find how much it went up or down.",
    ],
    openingTitle: "A thermometer is a number line standing up",
    opening: [
      "The liquid in a thermometer rises when it gets warmer. It goes down when it gets colder. The top of the liquid points to the temperature.",
      "A number line is a line with numbers in order, evenly spaced. Beside the tube is a scale: a number line standing up. Temperature is counted in degrees. There are two kinds: degrees Fahrenheit and degrees Celsius.",
      "A gridline is a line across the scale. Only some gridlines have a number, called a label. The spaces between gridlines are all equal, so each space is the same number of degrees. First find that number.",
      "Say the labels 25 and 50 have 5 spaces between them. Subtract: 50 − 25 = 25 degrees. Share that among the 5 spaces: $25 \\div 5 = 5$. So each space is 5 degrees.",
    ],
    example: {
      prompt:
        "The top of the liquid is two gridlines above the labeled line 50. Each gridline is worth 5 degrees. What does it read?",
      steps: [
        "Start at the labeled line just below the top: 50 degrees.",
        "The top is two gridlines higher. Each gridline is 5 degrees, so that is $2\\times5=10$ degrees more.",
        "Add the extra degrees to the label: $50+10=60$.",
      ],
      answer: "60 degrees",
    },
    methodTitle: "Find the step, then count from a label",
    method: [
      "Step size, the degrees in one space: subtract the smaller of two labels next to each other from the bigger one. Then divide by the number of spaces between them.",
      "Reading: start at the label just below the top of the liquid. Count up by the step size.",
      "To find how much warmer one reading is than another, subtract the lower reading from the higher one.",
    ],
    formalTitle: "Scales and change",
    formal: [
      "Equal spaces on the scale stand for equal numbers of degrees. The reading is the label below, plus the number of gridlines times the step size.",
      "How much warmer or colder is the higher reading minus the lower reading. Both must be in the same kind of degrees.",
    ],
    pitfalls: [
      "Do not count gridlines by ones when each is worth 5 or 2 degrees.",
      "Do not read the closest label when the top is between labels.",
      "Do not subtract readings in different kinds of degrees, like Fahrenheit and Celsius.",
    ],
    parentGuide:
      "Ask your learner what one gridline is worth before reading the top of the liquid.",
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
