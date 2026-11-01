import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

const templateId = "successive-percent-change";

export const successivePercentChangeLesson: Lesson = {
  id: templateId,
  title: "Two percent changes to a price",
  summary:
    "Percent means per hundred, and the sign % stands for percent. So 20% of a price is 20 out of every 100 parts of it. When a price changes twice, the second percent is taken of the new price, not the starting one. A price of 60 dollars that drops 20% becomes 48 dollars. A 20% rise then adds 20% of 48, which is 9.60 dollars, so the final price is 57.60 dollars.",
  templateIds: [templateId],
  includeGeneratedRepresentation: false,
  noLink: [
    "whole",
    "change",
    "changes",
    "base",
    "leaves",
    "more than",
    "parts",
    "rule",
  ],
  objectives: [
    "Take the second percent of the price after the first change.",
    "Find the final price after two increases or decreases, such as a discount and then an added charge.",
    "Change a percent such as 8.875% into a number by dividing by 100, and keep every digit until the final answer in cents.",
  ],
  sections: [
    {
      stage: "intuition",
      title: "The price changes after the first step",
      paragraphs: [
        "A discount is a price decrease. A 20% discount takes away 20 of every 100 parts of the starting price. A later 20% increase adds 20 of every 100 parts of the new, smaller price.",
        "The two changes are not the same size. Each percent is taken of a different price, so the same 20% gives a different number of dollars. That is why a 20% drop and then a 20% rise do not get you back to the start.",
      ],
    },
    {
      stage: "method",
      title: "Use each new price for the next percent",
      paragraphs: [
        "The base is the price a percent is taken of. Find the price after the first change. That price is the base for the second change.",
        "A multiplier is the number you multiply a price by to get the changed price. A 20% decrease leaves 80% of the price, so its multiplier is $1 - 0.20 = 0.80$. A 20% increase gives 120% of the price, so its multiplier is $1 + 0.20 = 1.20$. To write a percent as a decimal, a number with a decimal point, divide it by 100: $20\\% = 20 \\div 100 = 0.20$.",
        "A tax is an extra charge added to a price. A discount followed by a tax works the same way, when the tax is charged on the discounted price. A 25% discount on 80 dollars leaves $80 \\times 0.75 = 60$ dollars. A tax of 8.875% is $8.875 \\div 100 = 0.08875$ of the 60-dollar base. So the final amount is $60 \\times 1.08875 = 65.325$ dollars.",
        "Keeping fewer digits and choosing the closest value is called rounding. Rounding to cents keeps two digits after the decimal point. Here 65.325 is exactly halfway between 65.32 and 65.33. The rule in these problems is that halfway rounds up, so the price is 65.33 dollars. Round only once, at the end.",
      ],
    },
  ],
  closingSections: [
    {
      stage: "formal",
      title: "Successive percent multipliers",
      paragraphs: [
        "A percent is $\\tfrac{1}{100}$ of a base: $p\\%$ means $\\tfrac{p}{100}$ of that base. Let $P_0$ be the starting price, a number 0 or greater. The small numbers below the letters count the steps: $P_1$ is the price after one change and $P_2$ after two.",
        "For a percent $p_1$ that is 0 or greater, the first multiplier $m_1$ is $1 + \\tfrac{p_1}{100}$ for an increase. It is $1 - \\tfrac{p_1}{100}$ for a decrease. The second multiplier $m_2$ comes from the second percent $p_2$ in the same way. A decrease can be 100% or less, so the price never goes below 0. An increase may be more than 100%.",
        "Then $P_1 = P_0 \\times m_1$ and $P_2 = P_1 \\times m_2 = P_0 \\times m_1 \\times m_2$. The second percent is taken of $P_1$, even though the three numbers can be multiplied in any order.",
        "Equal decrease and increase percents do not undo each other. For a percent $p$ from 1 to 100, $(1 - \\tfrac{p}{100}) \\times (1 + \\tfrac{p}{100}) = 1 - (\\tfrac{p}{100})^2$, which is less than 1. For example, $0.80 \\times 1.20 = 0.96$. So a positive price ends lower than it started.",
        "For a money answer, keep every digit until the final step. Then round the final amount to the nearest cent. One cent is $\\tfrac{1}{100}$ of a dollar. An amount exactly halfway between two cents rounds up. Round earlier only if the problem says to.",
      ],
    },
  ],
  workedExample: {
    prompt:
      "A price of 60 dollars falls by 20%, then rises by 20%. What is the final price, in dollars?",
    steps: [
      "Find the first change. 20% is $20 \\div 100 = 0.20$, and $60 \\times 0.20 = 12$ dollars, so the drop takes away 12 dollars.",
      "Subtract it from the starting price: $60 - 12 = 48$ dollars. This new price is the base for the second change.",
      "Find the second change on the new base: $48 \\times 0.20 = 9.60$ dollars. Add it to the discounted price: $48 + 9.60 = 57.60$ dollars.",
      "Check by multiplying. A 20% drop keeps $1 - 0.20 = 0.80$ of the price, and a 20% rise makes $1 + 0.20 = 1.20$ of it. $60 \\times 0.80 \\times 1.20 = 57.60$. The rise added only 9.60 dollars, because 20% of 48 is less than 20% of 60.",
    ],
    answer: "57.60",
    answerUnit: "dollars",
  },
  pitfalls: [
    "Take the second percent of the changed price. Taking both percents of the starting price gives the wrong second change.",
    "Keep every digit until the final rounding. Write a percent as a decimal by dividing by 100: 8.875% is 0.08875, not 0.8875 or 8.875.",
  ],
  parentGuide:
    "Compare the 12 dollars taken off 60 with the 9.60 dollars added to 48. Ask which price each 20% was taken of, then check $60 \\times 0.80 \\times 1.20 = 57.60$ dollars.",
};

export const successivePercentChangeMethod: ProblemMethod = {
  goal: "Find the final price after two percent changes, each taken of the price at that moment.",
  noLink: [
    "whole",
    "change",
    "changes",
    "base",
    "leaves",
    "more than",
    "parts",
    "rule",
  ],
  intuition:
    "Percent means per hundred, and the sign % stands for percent. So 20% of a price is 20 out of every 100 parts of it. The base is the price a percent is taken of. When a price changes twice, the base for the second change is the new price. A multiplier is the number you multiply a price by to get the changed price: 0.80 for a 20% decrease, 1.20 for a 20% increase.",
  terms: [
    ["percent", "The base is the whole that the percent is taken of."],
    [
      "multiplier",
      "For a change by a percent, write the percent as a decimal. Add it to 1 for an increase, or subtract it from 1 for a decrease. For 20%, that gives 1.20 or 0.80.",
    ],
  ],
  method: [
    "Write the first percent as a decimal, a number with a decimal point, by dividing by 100: $7.5\\% = 0.075$. Add it to 1 for an increase or subtract it from 1 for a decrease. Multiply the starting price by the result.",
    "Use that changed price, with all its digits, as the base for the second percent. Make its multiplier the same way and multiply again.",
    "Round only the final price. Keeping fewer digits and choosing the closest value is called rounding. Rounding to cents keeps two digits after the decimal point. An amount exactly halfway rounds up.",
  ],
  watch:
    "Take the second percent of the price after the first change. A 20% drop and then a 20% rise use different bases, so they do not cancel.",
};

export const successivePercentChangePrinciple =
  "Let $P_0$ be a starting price, 0 or greater, and let $p_1$ and $p_2$ be two percents, each 0 or greater. Each multiplier is $1 + \\tfrac{p}{100}$ for an increase or $1 - \\tfrac{p}{100}$ for a decrease, where a decrease is 100% or less. The price after the first change is $P_1 = P_0 \\times m_1$. The final price is $P_2 = P_1 \\times m_2 = P_0 \\times m_1 \\times m_2$. Here $m_1$ and $m_2$ are the two multipliers, and the small numbers count the steps. Round the final money amount to cents, with an exact halfway amount rounding up, unless the problem rounds earlier.";
