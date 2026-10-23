import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

export const attributeLessons: Lesson[] = [
  {
    id: "longer-heavier-holds-more",
    title: "Longer, heavier, holds more",
    summary:
      "To compare two objects, choose one question: Which is longer, heavier, or holds more?",
    templateIds: ["compare-lengths", "compare-weights", "compare-capacity"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Compare two lengths by lining up one end.",
      "Read a balance: the lower side is heavier; level means the same weight.",
      "Compare what two containers hold by pouring one into the other.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Ask which kind of amount you mean",
        paragraphs: [
          "A long strip may be light, and a short cup may hold a lot. Length tells how far an object reaches; mass tells how heavy it is; capacity tells how much a container holds. Choose one of these questions before comparing two things.",
        ],
      },
      {
        title: "Length: line up one end",
        paragraphs: [
          "To see which strip is longer, start both at the same line. The one that reaches further at the other end is longer.",
          "If the strips start in different places, the one that ends further right may still be shorter. Look at both ends, not just one.",
        ],
        illustration: "line-up-ends",
      },
      {
        title: "Weight and capacity",
        paragraphs: [
          "A balance goes down on the heavier side and stays level when both sides weigh the same. A small object can be heavier than a big one, so read the beam, not the sizes.",
          "To compare what two jars hold, fill one and pour it into the other. If the water leaves room, the second jar holds more; if it spills, the first holds more; if it fills exactly, they hold the same.",
        ],
        illustration: "balance-heavier",
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Compare one measurable property",
        paragraphs: [
          "Length, mass, and capacity are different attributes. A comparison is valid when both objects are measured or tested for the same attribute under the same conditions: common starting line for length, balanced scale for mass, and equal measuring vessel for capacity.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A small ball is on the left pan and a big box is on the right. The left pan is lower. Which is heavier?",
      steps: [
        "A balance goes down on the heavier side.",
        "The left pan, with the ball, is lower.",
        "So the ball is heavier, even though the box is bigger.",
      ],
      answer: "the ball",
    },
    pitfalls: [
      "Bigger does not always mean heavier.",
      "A strip that ends further right is longer only if both strips start at the same place.",
    ],
    parentGuide:
      "Hold a small heavy object and a large light one, one in each hand. Ask which is heavier before and after feeling them, then compare two cups by pouring.",
  },
  {
    id: "measure-with-equal-units",
    title: "Measure with equal units",
    summary:
      "Measure a length by covering it from end to end with equal units and counting them.",
    templateIds: [
      "measure-with-units",
      "correct-unit-measure",
      "order-lengths",
    ],
    includeGeneratedRepresentation: false,
    objectives: [
      "Measure a length by counting equal units laid end to end.",
      "Explain why gaps, overlaps or a shifted start give a wrong count.",
      "Order three lengths from two comparisons.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Count equal steps along the object",
        paragraphs: [
          "A row of identical cubes can show how long a pencil is. Each cube covers one equal piece of its length. If the cubes touch from one end to the other, their count tells the pencil's length in cubes.",
        ],
      },
      {
        title: "Start at the end, no gaps, no overlaps",
        paragraphs: [
          "Lay the units, such as cubes or paper clips, along the object. The first unit starts exactly at one end, each unit touches the next, and none overlap.",
          "A gap leaves length uncounted, so the count is too small. An overlap counts some length twice, so the count is too large.",
        ],
        illustration: "unit-iteration",
      },
      {
        title: "A ruler is equal units already in a row",
        paragraphs: [
          "The marks on a ruler are equal units laid end to end, numbered for you. Put the object's end at 0 and read the number at its other end.",
          "If one ribbon is longer than a second, and the second is longer than a third, then the first is longer than the third too.",
        ],
        illustration: "ruler-units",
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Equal units make a measurement",
        paragraphs: [
          "A length measurement counts congruent units placed end to end, starting at one endpoint and ending at the other, without gaps or overlaps. Changing unit size changes the count but not the length being measured.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Cubes are lined up along a pencil, end to end, starting at one end. There are 6 cubes from one end of the pencil to the other. How long is the pencil?",
      steps: [
        "The cubes start at the end of the pencil and touch each other with no overlaps.",
        "Count them: 1, 2, 3, 4, 5, 6.",
        "The pencil is 6 cubes long.",
      ],
      answer: "6",
      answerUnit: "cubes",
    },
    pitfalls: [
      "Gaps make a length look shorter; overlaps make it look longer.",
      "Start measuring at the end of the object, or at 0 on a ruler, not at 1.",
    ],
    parentGuide:
      "Measure a spoon with paper clips. Then leave a gap on purpose and ask whether the new count is right, and why.",
  },
  {
    id: "mass-and-liquid-volume",
    title: "Mass and liquid volume",
    summary:
      "Read the number and its unit together: grams measure mass, and liters measure liquid volume.",
    templateIds: ["read-liquid-volume", "balance-mass", "mass-volume-story"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Find a mass in grams from the standard masses that balance it.",
      "Read a liquid volume in liters on a scale whose ticks are worth more than 1.",
      "Solve one-step stories with grams, kilograms and liters.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "A number needs a measuring unit",
        paragraphs: [
          "A reading of 5 does not tell you much by itself. Five grams describes mass, while five liters describes how much liquid fills a container. Read the number and its unit together before comparing or calculating.",
        ],
      },
      {
        title: "Grams on a balance",
        paragraphs: [
          "Mass is measured in grams ($g$) and kilograms (kg); 1 kg is 1000 g. When a balance is level, both pans hold the same mass.",
          "So an object balanced by 200 g, 50 g and 5 g has a mass of 200 + 50 + 5 = 255 g.",
        ],
        illustration: "balance-grams",
      },
      {
        title: "Liters on a scale",
        paragraphs: [
          "Liquid volume is measured in liters ($L$). A container's scale may not mark every liter. Find what one tick is worth: divide the jump between two labels by the number of spaces between them.",
          "On a scale labeled 0, 10, 20, 30 with 5 spaces between labels, each tick is 10 ÷ 5 = 2 liters. Water 3 ticks above 20 is 20 + 3 × 2 = 26 liters.",
        ],
        illustration: "liquid-scale-ticks",
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Keep the unit with the amount",
        paragraphs: [
          "A level balance shows equal mass on its two pans. A marked container measures liquid volume by its scale. Combine or compare measurements only in the same unit, converting first when necessary; the answer retains the measured unit.",
        ],
      },
    ],
    workedExample: {
      prompt: "Each bottle holds 2 liters. How many liters do 7 bottles hold?",
      steps: [
        "7 equal groups of 2 liters.",
        "7 × 2 = 14.",
        "The bottles hold 14 liters.",
      ],
      answer: "14",
      answerUnit: "liters",
    },
    pitfalls: [
      "Each tick is not always 1 liter; work out its value from the labels.",
      "Keep units the same before adding or subtracting: grams with grams, liters with liters.",
    ],
    parentGuide:
      "Read the scale on a measuring jug together while filling it. Ask how many liters or milliliters each small mark stands for.",
  },
];

export const attributeMethods: Record<string, ProblemMethod> = {
  "compare-lengths": {
    goal: "Decide which of two strips is longer or shorter, or that they are equal.",
    terms: [["Length", "How long something is from one end to the other."]],
    method: [
      "Check whether the strips start at the same line.",
      "Compare from the same start: the one that reaches further is longer.",
    ],
    watch:
      "Ending further right is not longer if the strip also starts further right.",
  },
  "compare-weights": {
    goal: "Read a balance to decide which object is heavier or lighter.",
    terms: [["Balance", "A beam with two pans; it drops on the heavier side."]],
    method: [
      "Find the lower pan: its object is heavier.",
      "A level beam means the objects weigh the same.",
    ],
    watch: "Read the beam, not the sizes: small things can be heavy.",
  },
  "compare-capacity": {
    goal: "Decide which container holds more after pouring one into the other.",
    terms: [["Capacity", "How much a container can hold."]],
    method: [
      "Look at container $B$ after all of the water from $A$ is poured in.",
      "Room left: $B$ holds more. Spilled: A holds more. Exactly full: the same.",
    ],
    watch: "A taller container does not always hold more.",
  },
  "measure-with-units": {
    goal: "Count equal units laid end to end along an object.",
    terms: [["Unit", "One of the equal pieces used to measure."]],
    method: [
      "Check the units start at one end and touch without overlapping.",
      "Count the units from one end of the object to the other.",
    ],
    watch: "Count units, not the spaces between them.",
  },
  "correct-unit-measure": {
    goal: "Pick the picture that measures a length correctly.",
    terms: [["Unit", "One of the equal pieces used to measure."]],
    method: [
      "Rule out pictures with gaps or overlaps between units.",
      "Rule out pictures whose first unit does not start at the object's end.",
    ],
    watch: "Gaps undercount; overlaps overcount.",
  },
  "order-lengths": {
    goal: "Find the longest or shortest of three ribbons from two comparisons.",
    terms: [["Compare", "Decide which of two is longer or shorter."]],
    method: [
      "Find the ribbon named in both sentences: it is in the middle.",
      "Put the longer one before it and the shorter one after it.",
    ],
    watch: "Shorter than is the same comparison read the other way round.",
  },
  "read-liquid-volume": {
    goal: "Read a liquid volume in liters on a container scale.",
    terms: [["Liter ($L$)", "A unit of liquid volume."]],
    method: [
      "Find a tick's value: the jump between labels ÷ the spaces between them.",
      "Start at the label below the water and count on by the tick value.",
    ],
    watch: "A tick is not always 1 liter.",
  },
  "balance-mass": {
    goal: "Find an object's mass from the standard masses that balance it.",
    terms: [["Gram ($g$)", "A unit of mass; 1000 g is 1 kilogram."]],
    method: [
      "Check the beam is level: then both pans hold the same mass.",
      "Add the standard masses on the other pan, largest first, in grams.",
    ],
    watch: "The beam must be level for the masses to equal the object.",
  },
  "mass-volume-story": {
    goal: "Solve a one-step story with grams, kilograms or liters.",
    terms: [
      ["Gram and kilogram", "Units of mass; 1 kg = 1000 g."],
      ["Liter", "A unit of liquid volume."],
    ],
    method: [
      "Decide the operation: join, take away, equal groups or equal sharing.",
      "Compute with the numbers and keep the unit in the answer.",
    ],
    watch:
      "Both amounts must be in the same unit before adding or subtracting.",
  },
};
export const attributePrinciples: Record<string, string> = {
  "compare-lengths": "Lengths compare fairly only from a common starting line.",
  "compare-weights":
    "A balance compares weight directly: the heavier side goes down, equal weights stay level.",
  "compare-capacity":
    "Pouring one container into another compares what they hold, whatever their shapes.",
  "measure-with-units":
    "A length is the count of equal units laid end to end with no gaps or overlaps.",
  "correct-unit-measure":
    "Every part of the length must be covered by exactly one unit, starting at the end.",
  "order-lengths":
    "If $A$ is longer than $B$ and $B$ is longer than $C$, then $A$ is longer than $C$.",
  "read-liquid-volume":
    "Equal spaces on a scale are equal amounts: the gap between labels divided by the spaces gives one tick.",
  "balance-mass": "A level balance means the masses on both pans are equal.",
  "mass-volume-story":
    "Measurements are quantities with units; the operation comes from the story, and the unit stays with the answer.",
};
