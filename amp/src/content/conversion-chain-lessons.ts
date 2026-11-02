import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

export const conversionChainMethods: Record<string, ProblemMethod> = {
  "conversion-chain-story": {
    goal: "Convert an amount through a chain of units, with stated or remembered equivalents, and count whole pieces cut from a converted length.",
    intuition:
      "A unit is an amount you measure with, like a cup or a gallon. An equivalent like 1 gallon = 4 quarts says two amounts are the same. It tells how many of the smaller unit fit in one of the larger unit. To change to a smaller unit, multiply by that number. A chain is a list of equivalents, each leading to the next. Use one link at a time. Each answer becomes the amount for the next link.",
    terms: [
      "equivalent",
      [
        "remainder",
        "Only full pieces count; a leftover shorter than one piece is the remainder.",
      ],
    ],
    senses: { unit: "unit" },
    noLink: ["whole", "factor"],
    method: [
      "List the equivalents that lead from the starting unit to the unit asked for. Add any you need to remember, like 1 foot = 12 inches.",
      "At each link going to a smaller unit, multiply by the number of smaller units in one larger unit. At a link going to a larger unit, divide by that same number, because dividing counts how many groups of it fit. Write each answer down.",
      "For cut pieces, write the length and one piece in the same unit. Divide to count how many pieces fit. Keep only the full pieces: a leftover shorter than one piece is not a piece.",
    ],
    watch:
      "Going to a smaller unit means multiplying. Put the length and the piece in the same unit before you divide.",
  },
};

export const conversionChainPrinciples: Record<string, string> = {
  "conversion-chain-story":
    "If 1 large unit is $k$ small units, then $x$ large units are $k \\times x$ small units. A chain does this one link at a time, because each link keeps the amount the same. The number of whole pieces is the whole-number part of the length divided by one piece.",
};

export const conversionChainLessons = [
  chainLesson({
    id: "conversion-chain-story",
    title: "Convert through several units",
    summary:
      "A unit is an amount you measure with, like a cup, a foot or a yard. To convert an amount means to write it in a different unit. An equivalent like 1 yard = 3 feet says two amounts are the same. Sometimes you need several equivalents in a row, called a chain. Use them one link at a time. Then use the answer, for example to count whole pieces.",
    templateIds: ["conversion-chain-story"],
    senses: { unit: "unit" },
    noLink: ["whole", "change", "factor"],
    objectives: [
      "Chain equivalents, given or remembered, to convert a decimal or mixed-number amount.",
      "Write two lengths in one unit and count the whole pieces that fit.",
    ],
    openingTitle: "Each link multiplies by how many fit",
    opening: [
      "An equivalent such as 1 yard = 3 feet says that one yard and three feet are the same length. A unit is the amount you measure with, like a yard or a foot.",
      "To write yards as feet, multiply by 3, because each yard is 3 feet. To write feet as inches, multiply by 12, because 1 foot = 12 inches. The smaller unit always needs the bigger number.",
      "Sometimes no one equivalent links your two units. Then use several. Change the amount to the next unit in the chain, then to the next, until you reach the unit you want. Write each answer before you go on.",
    ],
    example: {
      prompt:
        "Use 1 gallon = 4 quarts, 1 quart = 2 pints and 1 pint = 2 cups. How many cups are in $2\\frac{1}{2}$ gallons?",
      steps: [
        "$2\\frac{1}{2}$ means 2 and one half, which is 2.5. Each gallon is 4 quarts, so gallons to quarts is $2.5\\times4=10$ quarts.",
        "Each quart is 2 pints, so quarts to pints is $10\\times2=20$ pints.",
        "Each pint is 2 cups, so pints to cups is $20\\times2=40$ cups.",
        "Check another way. 1 gallon is $4\\times2\\times2=16$ cups, so 2.5 gallons is $2.5\\times16=40$ cups.",
      ],
      answer: "40 cups",
    },
    methodTitle: "Chain, then count whole pieces",
    method: [
      "Write the chain of equivalents from the starting unit to the unit asked for. At each link going to a smaller unit, multiply by the number of smaller units in one larger unit. At a link going to a larger unit, divide by that same number, because dividing counts how many groups of it fit.",
      "To count pieces, write the whole length and one piece in the same unit. Then divide to count how many pieces fit. 850 centimeters of ribbon makes $850\\div20=42.5$ bows of 20 centimeters. Half a bow is not a bow, so there are 42 full bows.",
    ],
    formalTitle: "Why the numbers multiply",
    formal: [
      "Say 1 large unit is $k$ middle units, and 1 middle unit is $m$ small units. Then 1 large unit is $k \\times m$ small units. So $x$ large units are $k \\times m \\times x$ small units.",
      "To go the other way, divide at each link instead.",
      "A count of whole pieces is the biggest whole number of pieces that fits in the length. A leftover shorter than one piece cannot make another piece.",
    ],
    pitfalls: [
      "Going to a smaller unit multiplies. Going to a larger unit divides.",
      "Put the length and the piece in the same unit before dividing.",
      "Count only full pieces. 42.5 bows means 42 bows, not 43.",
    ],
    parentGuide:
      "Ask your learner which unit is bigger at each link and whether the number should get larger or smaller after the conversion.",
  }),
];

export const conversionChainFacetMappings: FacetMapping[] = [
  {
    templateId: "conversion-chain-story",
    facetId: "unit-conversion.core",
    extent: "partial",
    rationale:
      "Numeric entry for gallons through quarts and pints to pints or cups from a stated chart, rods to inches through yards, feet and recalled 3 feet per yard and 12 inches per foot, and meters to centimeters followed by whole pieces, with decimal or mixed-number amounts. Does not assess derived units, metric prefix tables other than meters and centimeters, or dimensional analysis of rates.",
  },
];
