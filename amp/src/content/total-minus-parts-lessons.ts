import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

export const totalMinusPartsMethods: Record<string, ProblemMethod> = {
  "bag-totals-chain": {
    goal: "Add two three-digit totals and subtract a third amount, or subtract the sum of two parts from a total, with regrouping.",
    intuition:
      "Some stories join two amounts and then take some away, and others take two parts out of a whole. In both, the first step is to add the two amounts that go together, and the second step is a subtraction with that sum.",
    terms: [
      [
        "regrouping",
        "Carrying in addition or borrowing in subtraction when a place value column needs more than 9 or fewer than 0.",
      ],
      ["the rest", "What is left of the whole after the parts are taken out."],
    ],
    method: [
      "Add the two amounts that are joined or removed together, using regrouping.",
      "Subtract from the total or take the third amount away from that sum, using regrouping.",
      "Check by adding back: the answer plus what was removed gives the amount you started the subtraction from.",
    ],
    watch:
      "Add the two parts before subtracting. Subtracting them one at a time works too, but never subtract the larger number from the smaller in a column.",
  },
  "fraction-total-minus-parts": {
    goal: "Add two measures given as mixed numbers with unlike denominators, or as a fraction and a decimal, and subtract the sum from a total.",
    intuition:
      "To add or subtract fractions the pieces must be the same size, so rewrite them with a common denominator. A fraction and a decimal are two ways to write a number, so write both the same way before combining them.",
    terms: [
      [
        "common denominator",
        "A denominator that every fraction can be rewritten with, such as 16 for eighths and sixteenths.",
      ],
      [
        "mixed number",
        "A whole number and a fraction together, such as $2\\frac{1}{8}$.",
      ],
    ],
    method: [
      "Rewrite each measure in one form: improper fractions with a common denominator, or decimals.",
      "Add the two measures that go together, then subtract that sum from the total.",
      "Write the answer as a fraction in lowest terms, or as a decimal, and check that it is less than the total.",
    ],
    watch:
      "Rewrite eighths as sixteenths before adding. Convert the fraction to a decimal before adding it to a decimal.",
  },
};

export const totalMinusPartsPrinciples: Record<string, string> = {
  "bag-totals-chain":
    "Joining amounts and removing an amount is $a+b-c$, and removing two parts from a whole is $T-(a+b)=T-a-b$. Addition and subtraction are applied to place values with regrouping, and the results are whole numbers.",
  "fraction-total-minus-parts":
    "Fractions with denominators $d_1$ and $d_2$ can be added after rewriting both with a common denominator, such as the least common multiple. Then $T-(a+b)$ is computed numerator by numerator. A terminating decimal equals a fraction with a power of ten as denominator, so a fraction and a decimal can be combined in either form.",
};

export const totalMinusPartsLessons = [
  chainLesson({
    id: "total-minus-parts",
    title: "Add the parts, then take them from the total",
    summary:
      "Join two amounts, then subtract, with whole numbers, mixed numbers with unlike denominators, or a fraction and a decimal.",
    templateIds: ["bag-totals-chain", "fraction-total-minus-parts"],
    objectives: [
      "Add two amounts and subtract a third, or subtract their sum from a total, with regrouping.",
      "Write mixed numbers with a common denominator, or a fraction and a decimal in one form, before combining them.",
    ],
    openingTitle: "Two amounts go together, then they come off the whole",
    opening: [
      "Many stories give a total and two parts. The two parts are taken out together, so the first step adds them and the second step subtracts the sum from the total. Other stories join two amounts and then set some aside: add first, then subtract.",
      "Amounts that are fractions need pieces of the same size. Eighths and sixteenths become sixteenths. A fraction and a decimal are written in the same form, such as both decimals, before they are added.",
    ],
    example: {
      prompt:
        "A ribbon measures $8\\frac{1}{2}$ yards. One piece measures $2\\frac{1}{8}$ yards and another measures $3\\frac{9}{16}$ yards. How many yards remain?",
      steps: [
        "Use sixteenths: $8\\frac{1}{2}=\\frac{136}{16}$, $2\\frac{1}{8}=\\frac{34}{16}$, and $3\\frac{9}{16}=\\frac{57}{16}$.",
        "The two pieces total $\\frac{34}{16}+\\frac{57}{16}=\\frac{91}{16}$.",
        "Subtract from the ribbon: $\\frac{136}{16}-\\frac{91}{16}=\\frac{45}{16}$.",
        "That is $2\\frac{13}{16}$ yards.",
      ],
      answer: "$\\frac{45}{16}$ yards, which is $2\\frac{13}{16}$ yards",
    },
    methodTitle: "Same form, add the parts, subtract",
    method: [
      "Write every amount in one form: place value columns for whole numbers, improper fractions over a common denominator, or decimals.",
      "Add the two amounts that go together, then subtract from the total, regrouping as needed. Check by adding the answer back to the sum of the parts: the result should be the total.",
    ],
    formalTitle: "Why the parts can be added first",
    formal: [
      "Removing two parts from a total is the same as removing their sum: $T-a-b=T-(a+b)$, because subtraction of a sum is subtraction of each addend.",
      "Fractions $\\frac{p}{d}$ and $\\frac{q}{e}$ equal $\\frac{pe}{de}$ and $\\frac{qd}{de}$, which have the same denominator, so their sum is $\\frac{pe+qd}{de}$. A common denominator smaller than $de$, such as the least common multiple, gives the same value.",
    ],
    pitfalls: [
      "Rewrite eighths as sixteenths before adding the numerators.",
      "Regroup when a column of the subtraction needs more than it has.",
      "Check that the answer is less than the total and that the answer plus the parts is the total.",
    ],
    parentGuide:
      "Ask your learner what form every amount is in before they add, and to check by adding the answer to the two parts.",
  }),
];

export const totalMinusPartsFacetMappings: FacetMapping[] = [
  {
    templateId: "bag-totals-chain",
    facetId: "add-subtract-thousands.three-digit-algorithms",
    extent: "partial",
    rationale:
      "Numeric entry for adding two three-digit totals with regrouping and subtracting a third amount, or subtracting the sum of two parts from a total below 1,000. Does not assess four-digit numbers, estimation, or explaining the regrouping.",
  },
  {
    templateId: "fraction-total-minus-parts",
    facetId: "fraction-addition.core",
    extent: "partial",
    rationale:
      "Numeric entry for a total minus the sum of two measures given as mixed numbers with eighths and sixteenths, or as a fraction and a decimal, answered as a fraction or decimal. Does not assess three or more unlike denominators, models, or writing the answer as a mixed number.",
  },
];
