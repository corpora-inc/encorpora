import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

export const reasonableMeasureMethods: Record<string, ProblemMethod> = {
  "reasonable-measure-choice": {
    goal: "Choose the length, mass or capacity that fits an everyday object, or the unit that fits a stated amount.",
    intuition:
      "A unit is the amount you measure with. Units come in sizes. An inch is about as long as the top part of your thumb. A centimeter is about as wide as a finger. A meter is about a big step. A kilometer is a walk of about ten minutes. A kilogram is about a bag of flour. A ton is about a car. A reasonable measure is one that makes sense for the object.",
    terms: ["length", "mass", "capacity"],
    senses: { unit: "unit" },
    method: [
      "Picture the object next to something you know of about the same size, like a finger, a step or a milk carton.",
      "Try each choice with the number. Could the object really be that long, that heavy, or hold that much?",
      "Keep the one that fits. A unit that is much too big or too small gives an amount that does not match what you picture.",
    ],
    watch:
      "The same number with a different unit can be far too big or too small. Check the unit as well as the number.",
  },
};

export const reasonableMeasurePrinciples: Record<string, string> = {
  "reasonable-measure-choice":
    "A measurement is the number of units that fit the object, so the same object has a bigger number in a smaller unit. Useful benchmarks: 1 centimeter is about the width of a finger, 1 meter is about a big step, 1 kilogram is a bag of flour, 1 liter is a bottle of juice, 1 inch is about 2.5 centimeters, and 1 pound is about 450 grams.",
};

export const reasonableMeasureLessons = [
  chainLesson({
    id: "reasonable-measure-choice-lesson",
    title: "Reasonable measures and units",
    summary:
      "A unit is the amount you measure with. An inch is a short length, about the top part of a thumb. A gram is a tiny mass, about a paper clip. A liter is an amount of liquid, about a big water bottle. A reasonable measure is one that makes sense for the object. To choose one, compare the object with things you know of about that size.",
    templateIds: ["reasonable-measure-choice"],
    senses: { unit: "unit" },
    noLink: ["factor"],
    objectives: [
      "Connect units of length, mass and capacity to sizes you know.",
      "Choose a reasonable measurement or a reasonable unit for an object.",
    ],
    openingTitle: "Compare with something you know",
    opening: [
      "A measurement tells how many units fit an object. Length is how long something is. Mass is how heavy it is. Capacity is how much a container holds.",
      "A bed is about 2 meters long, which is about 6 feet. It is not 2 inches long: 2 inches is about the width of two fingers. It is not 2 kilometers long either: that is a walk of about twenty minutes.",
      "To check a choice, picture the object next to a thing you know. A paper clip is about 3 centimeters long. A bottle of juice holds about 1 liter. A bag of flour has a mass of about 1 kilogram, and a small car about 1 ton.",
    ],
    example: {
      prompt:
        "Which is a reasonable mass for a cat: 4 grams, 4 kilograms or 4 tons?",
      steps: [
        "A gram is about the mass of a paper clip. 4 paper clips are far lighter than a cat, so 4 grams is too small.",
        "A ton is about the mass of a car. 4 cars are far heavier than a cat, so 4 tons is too big.",
        "A bag of flour is about 1 kilogram. A cat is about as heavy as 4 bags of flour, so 4 kilograms fits.",
      ],
      answer: "4 kilograms",
    },
    methodTitle: "Picture, test, choose",
    method: [
      "Picture the object next to something you know.",
      "Test each choice: could the object really be that many of that unit?",
      "Keep the choice that fits.",
    ],
    formalTitle: "Units and benchmarks",
    formal: [
      "Units for the same kind of measure come in different sizes. So the same amount can have different numbers: 1 meter is 100 centimeters, and about 3.3 feet.",
      "A benchmark is a thing you know well, used to judge other amounts. A reasonable measure is close to what the benchmarks tell you. Keeping the same number but using a unit 10 times too big or too small gives a measure that is not reasonable.",
    ],
    pitfalls: [
      "Do not pick the right number with a unit that is far too big or too small.",
      "Do not mix up mass units, like grams, with capacity units, like liters.",
      "Do not pick the biggest unit just because the object is big. Pick the unit that fits the amount.",
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
