import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

export const conversionChainMethods: Record<string, ProblemMethod> = {
  "conversion-chain-story": {
    goal: "Convert an amount through a chain of units, with stated or remembered equivalents, and count whole pieces cut from a converted length.",
    intuition:
      "An equivalent such as 1 gallon = 4 quarts says how many of the smaller unit fit in one of the larger. To change to a smaller unit, multiply by that number. A chain of equivalents is applied one link at a time, each result becoming the next amount.",
    terms: [
      [
        "equivalent",
        "A statement that two units measure the same amount, such as 1 meter = 100 centimeters.",
      ],
      [
        "whole pieces",
        "The number of full pieces that fit; any leftover shorter than one piece does not count.",
      ],
    ],
    method: [
      "List the equivalents that connect the starting unit to the asked unit, adding any you must recall.",
      "Multiply by the number of smaller units in one larger unit at each link, writing each intermediate result.",
      "For cut pieces, convert both lengths to the same unit, divide, and keep only the whole number of pieces.",
    ],
    watch:
      "Going to a smaller unit multiplies. Convert the length and the piece to the same unit before you divide.",
  },
};

export const conversionChainPrinciples: Record<string, string> = {
  "conversion-chain-story":
    "If 1 unit $A$ equals $k$ units $B$, then $x$ units $A$ equal $kx$ units $B$. A chain multiplies the conversion factors in order, because each factor converts an equal amount, and the number of whole pieces of length $c$ in length $L$ in the same unit is the greatest integer not above $L\\div c$.",
};

export const conversionChainLessons = [
  chainLesson({
    id: "conversion-chain-story",
    title: "Convert through several units",
    summary:
      "Move an amount through a chain of equivalent units one link at a time, then use it, for example to count whole pieces.",
    templateIds: ["conversion-chain-story"],
    objectives: [
      "Chain stated and remembered unit equivalents to convert a decimal or mixed-number amount.",
      "Convert lengths to one unit and count the whole pieces that fit.",
    ],
    openingTitle: "Each link multiplies by how many fit",
    opening: [
      "An equivalent such as 1 yard = 3 feet says that one yard and three feet measure the same length. To write an amount of yards in feet, multiply by 3. To change feet to inches, multiply by 12, because 1 foot = 12 inches.",
      "When no single equivalent connects two units, link several. Convert the amount to the first unit in the chain, then to the next, until you reach the unit that is asked for. Write each result before you move on.",
    ],
    example: {
      prompt:
        "Use 1 gallon = 4 quarts, 1 quart = 2 pints and 1 pint = 2 cups. How many cups are in $2\\frac{1}{2}$ gallons?",
      steps: [
        "Gallons to quarts: $2.5\\times4=10$ quarts.",
        "Quarts to pints: $10\\times2=20$ pints.",
        "Pints to cups: $20\\times2=40$ cups.",
        "Check with one factor: 1 gallon is $4\\times2\\times2=16$ cups, and $2.5\\times16=40$.",
      ],
      answer: "40 cups",
    },
    methodTitle: "Chain, then count whole pieces",
    method: [
      "Write the chain of equivalents from the starting unit to the asked unit. Multiply by the number of smaller units in one larger unit at each link.",
      "To count pieces, put the whole length and one piece in the same unit, divide, and keep the whole-number part: 850 centimeters of ribbon in 20-centimeter bows gives $850\\div20=42.5$, so 42 whole bows.",
    ],
    formalTitle: "Why the factors multiply",
    formal: [
      "If 1 unit $A$ equals $k$ units $B$ and 1 unit $B$ equals $m$ units $C$, then 1 unit $A$ equals $km$ units $C$. An amount $x$ of $A$ therefore equals $kmx$ of $C$, and the same chain works in either direction by dividing instead.",
      "A count of whole pieces is the floor of the quotient: the largest whole number $n$ with $nc\\le L$. A leftover shorter than $c$ cannot make another piece.",
    ],
    pitfalls: [
      "Going to a smaller unit multiplies; going to a larger unit divides.",
      "Convert the length and the piece to the same unit before dividing.",
      "Count only whole pieces; do not round the quotient up.",
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
