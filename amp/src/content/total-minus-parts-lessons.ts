import type { FacetMapping } from "./coverage";
import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

export const totalMinusPartsMethods: Record<string, ProblemMethod> = {
  "bag-totals-chain": {
    goal: "Add two three-digit totals and subtract a third amount, or subtract the sum of two parts from a total, with regrouping.",
    intuition:
      "Some stories join two amounts and then take some away. Others take two parts out of a total. Either way, first add the two amounts that go together. Then subtract, using that answer. Write the numbers in columns: ones under ones, tens under tens, hundreds under hundreds. If a column has too few to subtract, regroup: trade 1 from the next place to the left for 10.",
    noLink: ["third"],
    terms: [
      "regroup",
      ["whole", "The rest is the whole minus all the parts already named."],
    ],
    method: [
      "Add the two amounts that are joined or taken away together, regrouping where a column makes 10 or more.",
      "Subtract that sum from the total, or take the third amount away from the sum. Regroup where a column has too few.",
      "Check by adding back: the answer plus what was taken away gives the amount you subtracted from.",
    ],
    watch:
      "Add the two parts before subtracting. Taking them away one at a time also works. When a column has too few, regroup. Never swap the two digits.",
  },
  "fraction-total-minus-parts": {
    goal: "Add two measures given as mixed numbers with unlike denominators, or as a fraction and a decimal, and subtract the sum from a total.",
    intuition:
      "A fraction names equal pieces of a whole, like $\\frac{3}{8}$. The denominator is the bottom number. It says how many pieces make one whole. The numerator is the top number. It counts the pieces. A mixed number is a whole number and a fraction together, like $2\\frac{1}{8}$. You can only add pieces of the same size, so rewrite eighths as sixteenths: $\\frac{1}{8} = \\frac{2}{16}$. A decimal is a number written with a decimal point, like 0.25. It is another way to write a fraction: $\\frac{1}{4} = 0.25$. A fraction whose top is the same as its bottom or bigger is called an improper fraction.",
    senses: { eighths: "eighth", eighth: "eighth", whole: "whole" },
    terms: ["common-denominator", "mixed-number"],
    method: [
      "Write every amount in one form: all as fractions with the same denominator, or all as decimals. A mixed number becomes one fraction: $2\\frac{1}{8}$ is $\\frac{32}{16} + \\frac{2}{16} = \\frac{34}{16}$.",
      "Add the two amounts that go together. Then subtract that sum from the total. Add or subtract the top numbers, and keep the bottom number.",
      "Write the answer as a fraction with the smallest top and bottom you can, or as a decimal. Check that it is less than the total.",
    ],
    watch:
      "Rewrite eighths as sixteenths before adding. Turn the fraction into a decimal before adding it to a decimal.",
  },
};

export const totalMinusPartsPrinciples: Record<string, string> = {
  "bag-totals-chain":
    "Let the letters stand for amounts. Joining two amounts and taking away a third is $a + b - c$. Taking two parts from a total is $T - (a + b)$, which equals $T - a - b$. Work place by place, with regrouping.",
  "fraction-total-minus-parts":
    "Fractions with different denominators can be added after both are rewritten with the same denominator. Then add or subtract the numerators and keep the denominator. A decimal such as 0.25 equals a fraction with 10, 100 or 1,000 on the bottom, here $\\frac{25}{100}$. So a fraction and a decimal can be combined in either form.",
};

export const totalMinusPartsLessons: Lesson[] = [
  {
    ...chainLesson({
      id: "total-minus-parts",
      title: "Add the parts, then take them from the total",
      summary:
        "Some stories give a total and two parts that both come off it. Add the two parts first. Then subtract that sum from the total. Other stories join two amounts and then take some away: add first, then subtract. The same steps work for amounts in equal pieces, like halves and eighths.",
      templateIds: ["bag-totals-chain", "fraction-total-minus-parts"],
      objectives: [
        "Add two amounts and subtract a third, or subtract the sum of two parts from a total, regrouping as needed.",
        "Rewrite mixed numbers with the same denominator, or a fraction and a decimal in one form, before adding and subtracting.",
      ],
      openingTitle: "Two amounts go together, then they come off the whole",
      opening: [
        "A whole number is one of 0, 1, 2, 3 and so on. Say a shop has 900 cups. It sells 300 and gives away 200. Both amounts come off the 900. First add them: 300 + 200 = 500. Then subtract: 900 − 500 = 400. Taking away 300 and then 200 gives the same answer.",
        "Other stories join two amounts and then set some aside. Add the two amounts first, then subtract.",
        "Some amounts are fractions. A fraction names equal pieces of one whole, like $\\frac{3}{8}$. The denominator is the bottom number. It says how many equal pieces make one whole. The numerator is the top number. It counts the pieces you have.",
        "A mixed number is a whole number and a fraction together, like $2\\frac{1}{8}$, read “2 and one eighth”. It means 2 wholes and 1 more eighth.",
        "You can only add pieces of the same size. One eighth is the same amount as two sixteenths: $\\frac{1}{8} = \\frac{2}{16}$. So rewrite eighths as sixteenths, then add the sixteenths. A common denominator is a bottom number that two fractions share.",
        "A mixed number can be written as one fraction. $2\\frac{1}{8}$ is 2 wholes and 1 eighth, and each whole is 8 eighths. So it is $\\frac{17}{8}$. A fraction whose top is the same as its bottom or bigger is called an improper fraction.",
        "A decimal is a number written with a decimal point, like 0.25. A fraction and a decimal can name the same amount: $\\frac{1}{4} = 0.25$. Write both as decimals before adding them.",
      ],
      example: {
        prompt:
          "A ribbon measures $8\\frac{1}{2}$ yards. One piece measures $2\\frac{1}{8}$ yards and another measures $3\\frac{9}{16}$ yards. How many yards remain?",
        steps: [
          "The pieces have different sizes: halves, eighths and sixteenths. Every one can be written in sixteenths, so use sixteenths.",
          "Rewrite the ribbon. 8 wholes are $8 \\times 16 = 128$ sixteenths, and $\\frac{1}{2} = \\frac{8}{16}$. So $8\\frac{1}{2} = \\frac{136}{16}$.",
          "Rewrite the pieces the same way. $2\\frac{1}{8} = \\frac{32}{16} + \\frac{2}{16} = \\frac{34}{16}$, and $3\\frac{9}{16} = \\frac{48}{16} + \\frac{9}{16} = \\frac{57}{16}$.",
          "Both pieces come off the ribbon, so add them first. Add the sixteenths: $\\frac{34}{16} + \\frac{57}{16} = \\frac{91}{16}$.",
          "Subtract that from the ribbon: $\\frac{136}{16} - \\frac{91}{16} = \\frac{45}{16}$.",
          "45 sixteenths is 32 sixteenths, which is 2 wholes, and 13 sixteenths more. So $2\\frac{13}{16}$ yards remain.",
        ],
        answer: "$\\frac{45}{16}$ yards, which is $2\\frac{13}{16}$ yards",
      },
      methodTitle: "Same form, add the parts, subtract",
      method: [
        "Write every amount in one form. Use columns for whole numbers, with ones under ones and tens under tens. Use fractions with the same denominator, or decimals.",
        "Add the two amounts that go together. Then subtract from the total. Regroup when a column has too few to subtract.",
        "Check by adding the answer to the two parts. You should get the total back.",
      ],
      formalTitle: "Why the parts can be added first",
      formal: [
        "Let $T$ stand for the total, and $a$ and $b$ for the two parts. Taking away the parts one at a time is the same as taking away their sum: $T - a - b = T - (a + b)$. The parentheses mean work out $a + b$ first.",
        "Two fractions with different denominators can be rewritten with the same one. Multiply the top and bottom of each fraction by the same number, which keeps its value. For eighths and sixteenths, $\\frac{1}{8} = \\frac{1 \\times 2}{8 \\times 2} = \\frac{2}{16}$.",
      ],
      pitfalls: [
        "Rewrite eighths as sixteenths before adding the top numbers.",
        "Regroup when a column of the subtraction has too few to take away from.",
        "Check that the answer is less than the total, and that the answer plus the parts makes the total.",
      ],
      parentGuide:
        "Before your learner adds, ask what form every amount is in. Afterwards, have them check by adding the answer to the two parts.",
    }),
    senses: {
      parts: "part",
      part: "part",
      eighths: "eighth",
      eighth: "eighth",
      whole: "whole",
    },
    noLink: ["mean", "third"],
  },
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
