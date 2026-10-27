import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

export const reasonableMeasureMethods: Record<string, ProblemMethod> = {
  "reasonable-measure-choice": {
    goal: "Choose the length, mass or capacity that fits an everyday object, or the unit that fits a stated amount.",
    intuition:
      "Units come in sizes. A centimeter is about the width of a fingertip, a meter is about a big step, a kilometer is a walk of ten minutes or so. To judge a measurement, picture the object and compare it with something you know that is about that size.",
    terms: [
      [
        "length",
        "How long or tall something is, measured in inches, feet, centimeters, meters or miles.",
      ],
      [
        "mass",
        "How heavy something is, measured in grams, kilograms, ounces or pounds.",
      ],
      [
        "capacity",
        "How much a container holds, measured in milliliters, liters, cups, quarts or gallons.",
      ],
    ],
    method: [
      "Picture the object and think of something familiar of about that size: a fingertip, a step, a milk carton.",
      "Test each choice with the amount: could the object really be that long, that heavy or hold that much?",
      "Keep the one that fits. A unit that is much too big or much too small gives an amount that does not match what you picture.",
    ],
    watch:
      "The same number with a different unit can be far too large or too small. Check the unit as well as the number.",
  },
};

export const reasonableMeasurePrinciples: Record<string, string> = {
  "reasonable-measure-choice":
    "A measurement is the number of units that fit the object, so the same object has a larger number in a smaller unit. Common benchmarks: 1 centimeter is about the width of a fingertip, 1 meter is about a large step, 1 kilogram is a bag of flour, 1 liter is a bottle of juice, 1 inch is about 2.5 centimeters and 1 pound is about 450 grams.",
};

export const reasonableMeasureLessons = [
  chainLesson({
    id: "reasonable-measure-choice-lesson",
    title: "Reasonable measures and units",
    summary:
      "Pick the unit and amount that fit an object by comparing with sizes you know.",
    templateIds: ["reasonable-measure-choice"],
    objectives: [
      "Link units of length, mass and capacity to familiar sizes.",
      "Choose a reasonable measurement or a reasonable unit for an object.",
    ],
    openingTitle: "Compare with something you know",
    opening: [
      "A measurement tells how many units fit an object. A bed is about 2 meters long, which is about 6 feet. It is not 2 inches long, which is about the width of two fingers, and not 2 kilometers, which is a walk of twenty minutes.",
      "To check a choice, picture the object and a familiar thing of that size. A paper clip is about 3 centimeters, a bottle of juice holds about 1 liter, and a bag of flour has a mass of about 1 kilogram.",
    ],
    example: {
      prompt:
        "Which is a reasonable mass for a cat: 4 grams, 4 kilograms or 4 tons?",
      steps: [
        "A gram is about the mass of a paper clip, so a cat would be far heavier than 4 grams.",
        "A ton is the mass of a car, so a cat is far lighter than 4 tons.",
        "A bag of flour is about 1 kilogram, so 4 kilograms fits a cat.",
      ],
      answer: "4 kilograms",
    },
    methodTitle: "Picture, test, choose",
    method: [
      "Picture the object next to something you know.",
      "Test each unit with the number: is the object that much?",
    ],
    formalTitle: "Units and benchmarks",
    formal: [
      "Units of one kind differ in size, so the same quantity has different numbers: 1 meter is 100 centimeters and about 3.3 feet.",
      "A reasonable estimate is one within a small factor of the actual size, so units that differ by a factor of ten or more are not both reasonable.",
    ],
    pitfalls: [
      "Choosing the right number with a unit that is far too large or too small.",
      "Mixing up mass and capacity units.",
      "Picking the biggest unit because the object is big. Choose the unit that fits the amount.",
    ],
    parentGuide:
      "Hold up a bottle, a book or a pencil and ask your learner to guess its length or mass in two different units.",
  }),
];

export const reasonableMeasureFacetMappings: FacetMapping[] = [
  {
    templateId: "reasonable-measure-choice",
    facetId: "unit-conversion.core",
    extent: "partial",
    rationale:
      "Single choice of the reasonable length, mass or capacity of 16 everyday objects, or of the unit for a stated amount, among customary and metric units that differ from the right unit by at least a factor of four. Does not assess drawn objects or containers, choosing the object for a stated amount, or converting between units.",
  },
];
