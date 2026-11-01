import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";
const terms: NonNullable<ProblemMethod["terms"]> = [
  [
    "percent-change",
    "The base quantity is the original amount, the one the change is divided by.",
  ],
  "percent",
  "amount-of-change",
];
export const percentChangeMethods: Record<string, ProblemMethod> = {
  "percent-change-rate": {
    senses: { change: "change", difference: "difference-subtract" },
    noLink: ["base"],
    goal: "Find an increase or decrease as a percent of the original amount.",
    intuition:
      "Percent means per hundred, so 25% means 25 out of every 100. A percent change compares the change with the original amount, the amount before the change. Divide the change by the original, then multiply by 100.",
    terms,
    method: [
      "Subtract to find the amount of change: the larger amount minus the smaller one.",
      "Divide that change by the original amount, the one before the change.",
      "Multiply by 100 to get the percent. Say whether it is an increase or a decrease.",
    ],
    watch:
      "Divide by the original amount, not the new one. A difference between two percents, such as 20% to 25%, is 5 percentage points, not a 5% change.",
  },
  "percent-change-final": {
    senses: { change: "change", part: "part" },
    noLink: ["leaves"],
    goal: "Find the new amount after a given percent increase or decrease.",
    intuition:
      "Percent means per hundred, so 25% means $\\tfrac{25}{100}$ of an amount. The percent is always taken of the original amount, the amount before the change. Find that part, then add it for an increase or take it away for a decrease.",
    terms,
    method: [
      "Write the percent as a fraction or decimal: divide it by 100.",
      "Multiply the original amount by it. That gives the amount added or removed.",
      "Add it for an increase, or subtract it for a decrease. Check that the answer moved the right way.",
    ],
    watch:
      "The change and the new amount are different numbers. An increase of 25% leaves 125% of the original. A decrease of 25% leaves 75%.",
  },
  "percent-change-original": {
    senses: { change: "change" },
    noLink: ["leaves"],
    goal: "Find the original amount from the new amount and the percent change.",
    intuition:
      "The percent was taken of the original amount, which is unknown. After a 25% decrease, the new amount is the 75% that is left. A multiplier is the number the original was multiplied by. Divide the new amount by it to undo the change.",
    terms: [...terms, "multiplier"],
    method: [
      "Write the percent as a fraction: divide it by 100.",
      "Make the multiplier: 1 plus that fraction for an increase, or 1 minus it for a decrease.",
      "Divide the new amount by the multiplier. Check by applying the change to your answer.",
    ],
    watch:
      "Do not take the percent of the new amount. A 100% decrease leaves 0 for every original, so it cannot be undone.",
  },
};
export const percentChangePrinciples: Record<string, string> = {
  "percent-change-rate":
    "A percent change compares the amount added or removed with the original amount, which is greater than 0. Writing that comparison in hundredths gives the percent change.",
  "percent-change-final":
    "The original amount counts as 100%. Adding or removing $p$% of that same original leaves $(100 + p)$% or $(100 − p)$% of it.",
  "percent-change-original":
    "For an original greater than 0, the new amount equals the original times its multiplier. When the multiplier is not 0, dividing by it undoes the multiplication and gives back the original.",
};
const foundations: Lesson["sections"][number] = {
  title: "The amount that counts as 100 percent",
  paragraphs: [
    "This lesson uses adding, subtracting, multiplying and dividing with fractions and decimals. A quantity is an amount with its unit, such as 80 dollars or 80 liters. The original amount is the amount before a change. The final amount, or new amount, is the amount after it. An increase makes the amount larger, and a decrease makes it smaller.",
    "A fraction is a number of equal parts of 1 whole. In $\\tfrac{3}{4}$, the bottom number, called the denominator, splits the whole into 4 equal parts. The top number, called the numerator, counts 3 of those parts. A decimal is another way to write a fraction: $0.25 = \\tfrac{25}{100} = \\tfrac{1}{4}$. Multiplying or dividing the top and bottom by the same number (not 0) keeps the fraction's value.",
    "Percent means per hundred, and the sign % stands for percent. So 25% means $\\tfrac{25}{100}$, which is $\\tfrac{1}{4}$, of some amount. That amount is called the base. In a percent change, the base is the original amount. It counts as 100%, even when the original is not the number 100. If the original is 80 units, then 25% of it is $80 \\times \\tfrac{1}{4} = 20$ units.",
    "The amount of change has the same unit as the amount itself. A change of 20 dollars is an amount. A change of 25% says how that amount compares with its base. So always find the base before you work out a percent.",
  ],
};
const fractionWork: Lesson["sections"][number] = {
  title: "Work exactly with fractions",
  paragraphs: [
    "To multiply a whole number by a fraction, multiply the top number and keep the bottom number: $48 \\times \\tfrac{1}{8} = \\tfrac{48}{8} = 6$. To add fractions, write them with parts of the same size: $1 + \\tfrac{1}{8} = \\tfrac{8}{8} + \\tfrac{1}{8} = \\tfrac{9}{8}$. Subtracting works the same way: $1 - \\tfrac{1}{4} = \\tfrac{4}{4} - \\tfrac{1}{4} = \\tfrac{3}{4}$.",
    "The reciprocal of a number (not 0) is the number you multiply it by to get 1. For a fraction, swap the top and bottom. The reciprocal of $\\tfrac{3}{4}$ is $\\tfrac{4}{3}$, because $\\tfrac{3}{4} \\times \\tfrac{4}{3} = 1$. Dividing by $\\tfrac{3}{4}$ is the same as multiplying by $\\tfrac{4}{3}$: $60 \\div \\tfrac{3}{4} = 60 \\times \\tfrac{4}{3} = \\tfrac{240}{3} = 80$. Dividing by 0 has no answer.",
    "A percent can include a fraction or decimal of its own. For 12.5%, divide 12.5 by 100: $\\tfrac{12.5}{100} = \\tfrac{125}{1000} = \\tfrac{1}{8}$. A change of $\\tfrac{1}{3}$ is exactly $\\tfrac{100}{3}$ percent, because $\\tfrac{1}{3} \\times 100 = \\tfrac{100}{3}$. Writing 33.3% would round it. When a decimal goes on forever, keep the fraction.",
  ],
};
const points: Lesson["sections"][number] = {
  title: "Percent change and percentage points",
  paragraphs: [
    "Suppose 20% of a class choose soccer, and later 25% do. Subtracting the two percents gives 25 − 20 = 5 percentage points. A percentage point is the unit for the gap between two percents.",
    "The percent change asks a different question. It compares those 5 points with the original 20: $5 \\div 20 = \\tfrac{1}{4}$, which is 25%. So the same change is a rise of 5 percentage points and also a 25% increase. These two statements answer different questions.",
    "Now suppose the share falls from 25% back to 20%. The drop is again 5 percentage points. But the original is now 25, so the percent decrease is $5 \\div 25 = \\tfrac{1}{5}$, which is 20%. Going the other way changes the base.",
  ],
};
const boundaries: Lesson["sections"][number] = {
  title: "Zero change and the limits of the rule",
  paragraphs: [
    "An amount that stays the same has a 0% change, as long as its original is greater than 0. A 100% increase adds the whole original once, so it doubles the amount. A 150% increase adds one and a half originals. That leaves two and a half times the original. So an increase can be more than 100%.",
    "This lesson uses amounts that are 0 or more. A 100% decrease removes the whole original and leaves 0. A decrease of more than 100% would leave less than 0, so it does not fit these amounts.",
    "A percent change from an original of 0 has no answer. The rule would divide by 0, and dividing by 0 is not possible. Even a change from 0 to 0 has no percent change.",
  ],
};
export const percentChangeLessons: Lesson[] = [
  {
    id: "percent-change-rate",
    senses: {
      change: "change",
      changes: "change",
      difference: "difference-subtract",
      "more than": "more-than",
      "one fourth": "fourth",
      parts: "part",
      unit: "unit",
      units: "unit",
      whole: "whole",
    },
    noLink: ["base", "leaves", "rule"],
    title: "Find the percent change",
    summary:
      "Percent means per hundred, so 25% means 25 out of every 100. A percent change tells how big a change is compared with the original amount, the amount before the change. Divide the change by the original. Then multiply by 100 to write it as a percent. For example, 80 rising to 100 is a change of 20, and 20 ÷ 80 = 0.25, a 25% increase.",
    templateIds: ["percent-change-rate"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Use the original amount, the amount before the change, as the base to divide by.",
      "Find an exact percent increase or decrease, and tell it apart from a difference in percentage points.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Compare the change with where you started",
        paragraphs: [
          "A price rise of 10 dollars is big for a 20-dollar shirt. It is small for a 1,000-dollar bike. The same 10 dollars feels different because the starting prices differ.",
          "So compare the change with the starting amount. Divide: 10 ÷ 20 = 0.5, so the shirt's price rose by half of itself. Percent means per hundred, and $0.5 = \\tfrac{50}{100}$, so that is a 50% increase. For the bike, 10 ÷ 1,000 = 0.01, which is only 1%.",
        ],
      },
      foundations,
      {
        title: "Calculate the comparison exactly",
        paragraphs: [
          "Write the change divided by the original as a fraction. For 0.10 ÷ 0.80, multiply both numbers by 100 to clear the decimals: $\\tfrac{10}{80} = \\tfrac{1}{8}$. Multiplying both by the same number (not 0) keeps their ratio, the way they compare. Then $\\tfrac{1}{8} \\times 100 = \\tfrac{100}{8} = 12.5$, so the percent is 12.5.",
          "A percent does not have to be a whole number. A change of 1 unit from an original of 3 units is $\\tfrac{1}{3}$ of the original. That is exactly $\\tfrac{100}{3}$ percent. Writing 33.3% would round it. When a decimal goes on forever, keep the fraction, so the answer stays exact.",
        ],
      },
      {
        title: "Compare the change with the original",
        paragraphs: [
          "An amount rises from 80 units to 100 units. The increase is 100 − 80 = 20 units. Compare that increase with the original: $20 \\div 80 = \\tfrac{1}{4}$. One fourth is 25 hundredths, so the increase is 25%.",
          "Now an amount falls from 100 units to 80 units. The amount removed is still 20 units. But the original is now 100, so $20 \\div 100 = \\tfrac{1}{5} = \\tfrac{20}{100}$. That is a 20% decrease. The same change in units can be a different percent when the original is different.",
          "In general: find the size of the change. Divide it by the original amount, which must be greater than 0. Multiply by 100 to write it as a percent. Then say whether it is an increase or a decrease. A question asking for the percent increase or decrease wants this size, which is never negative.",
        ],
        illustration: "percent-change-bars",
      },
      points,
      boundaries,
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Change relative to the original",
        paragraphs: [
          "Let $O$ stand for the original amount, greater than 0, and $N$ for the new amount. The signed percent change is $100(N-O)/O$ percent. Here $100(N-O)$ means 100 times $(N-O)$. A positive result is an increase, and a negative result is a decrease.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A quantity increases from 0.80 units to 0.90 units. By what percent does it increase?",
      steps: [
        "The original amount, 0.80 units, is the base, because it is the amount before the change.",
        "Find the increase by subtracting: 0.90 − 0.80 = 0.10 units.",
        "Compare the increase with the base. $0.10 \\div 0.80 = \\tfrac{10}{80} = \\tfrac{1}{8}$, after multiplying both numbers by 100.",
        "Write the comparison per hundred: $\\tfrac{1}{8} \\times 100 = \\tfrac{100}{8} = 12.5$.",
        "Check: $0.80 \\times \\tfrac{1}{8} = 0.10$, and 0.80 + 0.10 = 0.90, the new amount.",
      ],
      answer: "12.5",
      answerUnit: "percent increase",
    },
    pitfalls: [
      "Divide by the original amount. Dividing by the new amount answers a different question.",
      "A percent and its decimal are different numbers for the same thing. 12.5% is 0.125.",
      "For a percent that repeats forever, enter an exact fraction such as 100/3, not a rounded decimal.",
    ],
    parentGuide:
      "Compare 80 to 100, and then 100 to 80. Ask which number counts as 100% each time. Talk about why the two percents are different.",
  },
  {
    id: "percent-change-final",
    senses: {
      change: "change",
      "more than": "more-than",
      "one fourth": "fourth",
      part: "part",
      parts: "part",
      quarter: "fourth",
      unit: "unit",
      units: "unit",
      whole: "whole",
    },
    noLink: ["base", "leaves", "mean", "rule"],
    title: "Apply a percent change",
    summary:
      "Percent means per hundred, so 25% means $\\tfrac{25}{100}$, or one fourth. To apply a percent change, first find that percent of the original amount, the amount before the change. Then add it for an increase, or take it away for a decrease. For example, 25% of 80 is 20, so an increase gives 80 + 20 = 100.",
    templateIds: ["percent-change-final"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Find the new amount after a percent increase or decrease.",
      "Connect the amount of change with the multiplier, the single number that turns the original into the new amount.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Find the changed part first",
        paragraphs: [
          "A 40-dollar price goes up by 20 percent. The price keeps its original 40 dollars and adds 20 out of every 100 of it. 20% of 40 is $\\tfrac{20}{100} \\times 40 = 8$ dollars, so the new price is 40 + 8 = 48 dollars.",
          "A decrease takes that part away instead: 40 − 8 = 32 dollars. Either way, the new amount is what is left after the change.",
        ],
      },
      foundations,
      fractionWork,
      {
        title: "Add or remove part of the original",
        paragraphs: [
          "To increase 80 units by 25%, first find 25% of 80: $80 \\times \\tfrac{1}{4} = 20$ units. Then add that increase: 80 + 20 = 100 units. The amount added is 20. The new amount the question asks for is 100.",
          "To decrease 80 units by 25%, remove the same 20 units: 80 − 20 = 60. In the figure, three of the original four quarter pieces remain. They make up 75% of the original.",
          "A multiplier is a number you multiply an amount by. For a 25% increase, the multiplier is $1 + \\tfrac{1}{4} = \\tfrac{5}{4}$. For a 25% decrease, it is $1 - \\tfrac{1}{4} = \\tfrac{3}{4}$. The 1 stands for the whole original. Multiplying 80 by these fractions gives 100 or 60 in one step.",
        ],
        illustration: "percent-change-bars",
      },
      {
        title: "Read prices and percents carefully",
        paragraphs: [
          "A markdown, or price reduction, is a decrease taken from the original price. A markup is an increase taken from a given starting price. If a 48-dollar price goes up by 12.5%, the amount added is 6 dollars and the new price is 54 dollars. Use only the change the problem states. Do not add tax or fees that it does not mention.",
          "An increase by 25% means the new amount is 125% of the original. A change to 25% of the original would leave only one fourth of it. The words by and to mean different things.",
        ],
      },
      boundaries,
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Apply a change multiplier",
        paragraphs: [
          "Let $O$ be the original amount, 0 or more, and $p$ the percent, also 0 or more. An increase gives the new amount $O(1+p/100)$, meaning $O$ times $(1+p/100)$. For $p$ from 0 to 100, a decrease gives $O(1-p/100)$. The percent is measured against the original, not the new amount.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A quantity of 48 units increases by 12.5%. What is the final quantity, in units?",
      steps: [
        "Write the percent as a fraction by dividing by 100: 12.5% = $\\tfrac{12.5}{100} = \\tfrac{125}{1000} = \\tfrac{1}{8}$.",
        "The percent is taken of the original, 48. So the amount added is $48 \\times \\tfrac{1}{8} = \\tfrac{48}{8} = 6$ units.",
        "It is an increase, so add the change to the original: 48 + 6 = 54 units.",
        "Check: 54 − 48 = 6, and $6 \\div 48 = \\tfrac{1}{8}$, which is 12.5%.",
      ],
      answer: "54",
      answerUnit: "units",
    },
    pitfalls: [
      "When the question asks for the new amount, do not stop at the amount added or removed.",
      "A decrease of 25% leaves 75% of the original, not 25%.",
      "A percent greater than 100 can describe an increase. A 150% increase leaves 250% of the original.",
    ],
    parentGuide:
      "Draw four equal pieces to stand for 80 units. Add one more piece to one copy, and remove one piece from another copy. Label the original, the change and the new amount on each.",
  },
  {
    id: "percent-change-original",
    senses: {
      change: "change",
      "one quarter": "fourth",
      parts: "part",
      quarter: "fourth",
      unit: "unit",
      units: "unit",
      whole: "whole",
    },
    noLink: ["base"],
    title: "Recover the original quantity",
    summary:
      "Sometimes you know the new amount and the percent change, but not the original amount, the amount before the change. The percent was taken of that unknown original. After a 25% decrease, the new amount is the 75% that is left. So divide the new amount by $\\tfrac{3}{4}$ (75%) to get back the original.",
    templateIds: ["percent-change-original"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Find the original amount after an increase or a decrease.",
      "Explain why taking the same percent of the new amount usually gives the wrong answer.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Work backward from the new amount",
        paragraphs: [
          "A price went up by 20 percent and is now 60 dollars. The 20% was taken of the old price, not of 60. The new price is the old price plus 20% more, which is 120% of the old price.",
          "120% is 1.2, so the new price is the old price times 1.2. To undo multiplying, divide: 60 ÷ 1.2 = 50 dollars. Check: 20% of 50 is 10, and 50 + 10 = 60.",
        ],
      },
      foundations,
      fractionWork,
      {
        title: "Find the fraction that remains",
        paragraphs: [
          "After a 25% decrease, an amount is 60 units. The quarter that was removed was a quarter of the unknown original, not a quarter of 60. So 60 is the 75% that is left, which is $\\tfrac{3}{4}$ of the original.",
          "Divide 60 by the fraction that is left: $60 \\div \\tfrac{3}{4} = 60 \\times \\tfrac{4}{3} = 80$. The bar model shows the same thing. Three equal pieces hold 60 units, so one piece holds 60 ÷ 3 = 20 units. The original had four pieces, so it held 4 × 20 = 80 units.",
          "Check with the original you found: 25% of 80 is 20, and 80 − 20 = 60. Adding 25% of the new 60 instead would give 60 + 15 = 75. That uses the wrong base and does not give back the original.",
        ],
        illustration: "percent-change-reverse",
      },
      {
        title: "Undo an increase too",
        paragraphs: [
          "After a 12.5% increase, the new amount is 54. The change is $\\tfrac{1}{8}$ of the original, so the new amount is $1 + \\tfrac{1}{8} = \\tfrac{9}{8}$ of the original. Divide by $\\tfrac{9}{8}$: $54 \\div \\tfrac{9}{8} = 54 \\times \\tfrac{8}{9} = 48$. Check: $48 + \\tfrac{48}{8} = 48 + 6 = 54$.",
          "In general, make the multiplier first. It is 1 plus the change fraction for an increase, or 1 minus it for a decrease. Then divide the new amount by that multiplier, which must not be 0. The percent always belongs to the original, so never swap in the new amount as the base.",
        ],
      },
      {
        title: "When the original cannot be found",
        paragraphs: [
          "A 0% change has multiplier 1, so the original and new amounts are equal. A 100% decrease has multiplier 0. It turns every original into 0. So a new amount of 0 after a 100% decrease does not tell you which original you started from. Dividing 0 by 0 gives no answer.",
          "An original of 0 also has no percent change, because the comparison would divide by 0. The problems here use originals greater than 0 and multipliers that are not 0. All the numbers are exact, so keep fractions instead of rounding.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Undo a percent change",
        paragraphs: [
          "Let $O$ be the original amount, greater than 0, and $p$ the percent. An increase gives the new amount $F=O(1+p/100)$. Then $O=F/(1+p/100)$, since the multiplier is not 0. For a decrease with $p$ from 0 up to but not including 100, use $1-p/100$ instead. A 100% decrease gives 0 for every original, so the new amount alone cannot undo it.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A price decreases by 25% to 60 dollars. What was the original price, in dollars?",
      steps: [
        "Write the percent as a fraction: 25% = $\\tfrac{25}{100} = \\tfrac{1}{4}$ of the original price.",
        "Find the fraction that is left after the decrease: $1 - \\tfrac{1}{4} = \\tfrac{4}{4} - \\tfrac{1}{4} = \\tfrac{3}{4}$. So 60 dollars is $\\tfrac{3}{4}$ of the original.",
        "Divide the new price by that fraction to undo the multiplying: $60 \\div \\tfrac{3}{4} = 60 \\times \\tfrac{4}{3} = \\tfrac{240}{3} = 80$.",
        "Check the amount removed: $80 \\times \\tfrac{1}{4} = 20$ dollars.",
        "Apply the decrease: 80 − 20 = 60 dollars, the price given.",
      ],
      answer: "80",
      answerUnit: "dollars",
    },
    pitfalls: [
      "The percent is taken of the unknown original, not of the new amount you know.",
      "Divide by the fraction that is left or reached, not by the percent added or removed.",
      "A 100% decrease cannot be undone to one single original amount.",
    ],
    parentGuide:
      "Give a new amount of 60 units after a 25% decrease. Ask what fraction of the original is left. Find one quarter, then the whole. Check by applying the decrease.",
  },
];
