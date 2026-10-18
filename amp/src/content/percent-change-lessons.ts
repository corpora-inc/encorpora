import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";
const terms: NonNullable<ProblemMethod["terms"]> = [
  [
    "base quantity",
    "The original quantity used as the reference for the percentage.",
  ],
  ["percent", "Per hundred: 25% of a quantity means 25/100 of that quantity."],
  [
    "amount of change",
    "The difference between the original and final quantities, measured in the same units.",
  ],
];
export const percentChangeMethods: Record<string, ProblemMethod> = {
  "percent-change-rate": {
    goal: "Find an increase or decrease as a percentage of the original quantity.",
    terms,
    method: [
      "Subtract to find the amount of change.",
      "Divide that amount by the original positive quantity.",
      "Multiply the ratio by 100 and state whether it is an increase or decrease.",
    ],
    watch:
      "Use the original quantity as the denominator. A difference between two percentages is measured in percentage points; it is not automatically the relative percent change.",
  },
  "percent-change-final": {
    goal: "Find the final quantity after a stated percentage increase or decrease.",
    terms,
    method: [
      "Divide the numerical percent by 100 to obtain the change factor.",
      "Multiply the original quantity by that factor to find the amount added or removed.",
      "Add for an increase or subtract for a decrease. Check that the direction and size make sense.",
    ],
    watch:
      "The amount of change and the final quantity are different. An increase of 25% leaves 125% of the original; a decrease of 25% leaves 75%.",
  },
  "percent-change-original": {
    goal: "Recover the original quantity from a final quantity and a stated percentage change.",
    terms: [
      ...terms,
      [
        "multiplier",
        "The number multiplying the original quantity to give the final quantity.",
      ],
    ],
    method: [
      "Divide the percentage by 100, then add it to 1 for an increase or subtract it from 1 for a decrease.",
      "Divide the final quantity by this nonzero multiplier.",
      "Apply the stated change to the recovered original and check the final quantity.",
    ],
    watch:
      "Adding back the same percentage of the final quantity uses the wrong base. A 100% decrease cannot determine a unique original quantity.",
  },
};
export const percentChangePrinciples: Record<string, string> = {
  "percent-change-rate":
    "A relative change compares the amount added or removed with the original positive quantity. Expressing that ratio in hundredths gives the percent change.",
  "percent-change-final":
    "The original quantity represents 100%. Adding or removing p% of that same original leaves (100 + p)% or (100 − p)% of it.",
  "percent-change-original":
    "The final quantity equals the original times its change multiplier. Division by that nonzero multiplier reverses the multiplication and recovers the original.",
};
const foundations: Lesson["sections"][number] = {
  title: "The quantity that defines 100%",
  paragraphs: [
    "This lesson uses addition, subtraction, multiplication and division of fractions and decimals. A quantity is an amount together with its unit, such as 80 dollars or 80 liters. The original quantity is the amount before a change; the final quantity is the amount afterward. An increase makes the amount larger, and a decrease makes it smaller.",
    "A fraction describes division. In 3/4, the denominator 4 divides one whole into four equal parts; the numerator 3 counts three of those parts. A decimal is another way to write a fraction: 0.25 = 25/100 = 1/4. Multiplying or dividing the numerator and denominator by the same nonzero number preserves the fraction's value.",
    "Percent means per hundred. Thus 25% means 25/100 = 1/4 of a specified quantity. That quantity is the base. In a percent-change problem, the original quantity is the base and represents 100%, even when its numerical value is not 100. If the original is 80 units, 25% of it is 80 × 1/4 = 20 units.",
    "The amount of change has the same unit as the quantity. A change of 20 dollars is an amount; a change of 25% describes how that amount compares with its base. Always identify which quantity is the base before calculating a percentage.",
  ],
};
const fractionWork: Lesson["sections"][number] = {
  title: "Calculate exactly with fractions",
  paragraphs: [
    "To multiply a whole number by a fraction, multiply the numerator: 48 × 1/8 = 48/8 = 6. To add fractions, express them in equal-sized parts: 1 + 1/8 = 8/8 + 1/8 = 9/8. For subtraction, 1 − 1/4 = 4/4 − 1/4 = 3/4. Numerators count parts; the common denominator names their size.",
    "A reciprocal is the number that multiplies a nonzero number to give 1. The reciprocal of 3/4 is 4/3 because 3/4 × 4/3 = 1. Dividing by 3/4 therefore means multiplying by 4/3: 60 ÷ (3/4) = 60 × 4/3 = 240/3 = 80. Dividing by zero is undefined.",
    "A percentage may itself be fractional. For 12.5%, divide 12.5 by 100: 12.5/100 = 125/1000 = 1/8. A relative change of 1/3 is exactly 100/3 percent, since 1/3 × 100 = 100/3. Writing 33.3% would round it. Keep the fraction when a decimal does not terminate.",
  ],
};
const points: Lesson["sections"][number] = {
  title: "Percent change and percentage points",
  paragraphs: [
    "Suppose the share of a group choosing an option rises from 20% to 25%. Subtracting the two percentages gives 25 − 20 = 5 percentage points. A percentage point is a unit for the difference between percentage values.",
    "For the relative percent increase, compare those 5 points with the original 20: 5 ÷ 20 = 1/4, or 25%. Thus the same change is a rise of 5 percentage points and a relative increase of 25%. These statements answer different questions.",
    "If the share falls from 25% to 20%, the decrease is again 5 percentage points. Its relative decrease is 5 ÷ 25 = 1/5, or 20%, because the original share is now 25%. Reversing a change changes its base.",
  ],
};
const boundaries: Lesson["sections"][number] = {
  title: "Zero change and the limits of the rule",
  paragraphs: [
    "A quantity that stays the same has a 0% change when its original value is positive. A 100% increase adds the entire original once and doubles it. A 150% increase adds one and a half originals, leaving two and a half times the original. Increases can exceed 100%.",
    "For nonnegative quantities, a 100% decrease removes the entire original and leaves zero. A decrease greater than 100% would give a negative final quantity, so it does not describe the amounts used here. A percent change from an original value of zero is undefined: the comparison would require division by zero. Even 0 to 0 does not define that ratio.",
  ],
};
export const percentChangeLessons: Lesson[] = [
  {
    id: "percent-change-rate",
    title: "Find the percent change",
    summary:
      "Measure an increase or decrease relative to the original quantity.",
    templateIds: ["percent-change-rate"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Identify the positive original quantity as the base.",
      "Calculate an exact relative increase or decrease and distinguish it from a percentage-point difference.",
    ],
    sections: [
      foundations,
      {
        title: "Calculate the comparison exactly",
        paragraphs: [
          "Write the amount of change divided by the original as a fraction. For 0.10 ÷ 0.80, multiply both quantities by 100: 10/80 = 1/8. Scaling both by the same nonzero number preserves their ratio. Then 1/8 × 100 = 100/8 = 12.5 gives the numerical percent.",
          "A percentage need not be a whole number. A change of 1 unit from an original 3 units is 1/3 of the original, or exactly 100/3 percent. Writing 33.3% rounds that value. Keep the fraction when a decimal does not terminate; an exact answer needs no rounding.",
        ],
      },
      {
        title: "Compare the change with the original",
        paragraphs: [
          "An amount rises from 80 units to 100 units. The increase is 100 − 80 = 20 units. Compare that increase with the original: 20 ÷ 80 = 1/4. One fourth is 25 hundredths, so the increase is 25%.",
          "For a decrease from 100 units to 80 units, the amount removed is still 20 units. Its base is 100, so 20 ÷ 100 = 1/5 = 20/100: a 20% decrease. Equal changes in units can represent different percentages when their bases differ.",
          "In general, divide the positive amount added or removed by the original positive quantity, then multiply by 100 to express the result as a percent. State the direction separately. A question asking for the percent increase or decrease expects this nonnegative magnitude.",
        ],
        illustration: "percent-change-bars",
      },
      points,
      boundaries,
    ],
    workedExample: {
      prompt:
        "A quantity increases from 0.80 units to 0.90 units. By what percent does it increase?",
      steps: [
        "The original quantity, 0.80 units, is the base.",
        "Find the increase: 0.90 − 0.80 = 0.10 units.",
        "Compare with the base: 0.10 ÷ 0.80 = 10/80 = 1/8.",
        "Express the ratio as a percent: 1/8 × 100 = 100/8 = 12.5.",
        "Check: 0.80 × 1/8 = 0.10 and 0.80 + 0.10 = 0.90.",
      ],
      answer: "12.5",
      answerUnit: "percent increase",
    },
    pitfalls: [
      "Dividing by the final quantity answers a different comparison.",
      "Do not confuse the percent with its multiplier: 12.5% corresponds to 0.125.",
      "For an exact repeating percent, enter a fraction such as 100/3 rather than a rounded decimal.",
    ],
    parentGuide:
      "Compare 80 to 100 and then 100 to 80. Ask which number defines 100% in each direction and why the percentages differ.",
  },
  {
    id: "percent-change-final",
    title: "Apply a percent change",
    summary:
      "Find the amount added or removed, then calculate the final quantity.",
    templateIds: ["percent-change-final"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Calculate the final quantity after a percentage increase or decrease.",
      "Connect the amount of change with the multiplier for the final quantity.",
    ],
    sections: [
      foundations,
      fractionWork,
      {
        title: "Add or remove part of the original",
        paragraphs: [
          "To increase 80 units by 25%, first calculate 25% of 80: 80 × 1/4 = 20 units. Then add that increase: 80 + 20 = 100 units. The added amount is 20, while the requested final quantity is 100.",
          "To decrease 80 units by 25%, remove the same 20 units: 80 − 20 = 60. Three of the original four quarter-segments remain. They represent 75% of the original quantity.",
          "A multiplier is a number by which a quantity is multiplied. For a 25% increase, the final multiplier is 1 + 1/4 = 5/4. For a 25% decrease it is 1 − 1/4 = 3/4. Multiplying 80 by these fractions gives 100 or 60 directly. The 1 represents the entire original quantity.",
        ],
        illustration: "percent-change-bars",
      },
      {
        title: "Read prices and percentages precisely",
        paragraphs: [
          "A price reduction or markdown is a decrease based on the original price. A markup is an increase based on a stated starting price. If a price of 48 dollars increases by 12.5%, its added amount is 6 dollars and its final price is 54 dollars. Use only the stated change; no additional tax or fee is implied.",
          "An increase by 25% means the final quantity is 125% of the original. An increase to 25% of the original would instead leave one quarter of it. The words by and to specify different relationships.",
        ],
      },
      boundaries,
    ],
    workedExample: {
      prompt:
        "A quantity of 48 units increases by 12.5%. What is the final quantity, in units?",
      steps: [
        "Convert the percentage: 12.5% = 12.5/100 = 125/1000 = 1/8.",
        "Find the amount added: 48 × 1/8 = 48/8 = 6 units.",
        "Add it to the original: 48 + 6 = 54 units.",
        "Check the relative increase: 54 − 48 = 6 and 6 ÷ 48 = 1/8 = 12.5%.",
      ],
      answer: "54",
      answerUnit: "units",
    },
    pitfalls: [
      "Do not report only the amount added or removed when the question asks for the final quantity.",
      "A decrease of 25% leaves 75%; it does not leave 25%.",
      "A percent greater than 100 can describe an increase. A 150% increase leaves 250% of the original.",
    ],
    parentGuide:
      "Draw four equal segments for 80 units. Add one segment and then remove one from a fresh copy. Label the original, the change and the final quantity.",
  },
  {
    id: "percent-change-original",
    title: "Recover the original quantity",
    summary:
      "Undo the change multiplier to find the quantity that defined 100%.",
    templateIds: ["percent-change-original"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Recover an original quantity after an increase or decrease.",
      "Explain why applying the opposite percentage to the final quantity generally fails.",
    ],
    sections: [
      foundations,
      fractionWork,
      {
        title: "Find the fraction that remains",
        paragraphs: [
          "After a 25% decrease, a quantity is 60 units. The removed quarter was a quarter of the unknown original, not a quarter of 60. Therefore 60 represents the remaining 75%, or 3/4, of the original.",
          "Divide 60 by the remaining fraction: 60 ÷ (3/4) = 60 × 4/3 = 80. In the bar model, three equal segments contain 60 units, so one contains 60 ÷ 3 = 20 units. The four segments of the original contain 4 × 20 = 80 units. These are two ways to describe the same division.",
          "Check using the recovered base: 25% of 80 is 20, and 80 − 20 = 60. Adding 25% of the final 60 would give 60 + 15 = 75, which uses a different base and does not restore the original.",
        ],
        illustration: "percent-change-reverse",
      },
      {
        title: "Reverse an increase too",
        paragraphs: [
          "After a 12.5% increase, the final quantity is 54. The change fraction is 1/8, so the final quantity is 1 + 1/8 = 9/8 of the original. Divide by 9/8: 54 ÷ (9/8) = 54 × 8/9 = 48. Checking gives 48 + 48/8 = 54.",
          "In general, form the multiplier first: 1 plus the change fraction for an increase, or 1 minus it for a decrease. Divide the final quantity by that nonzero multiplier. The percentage always refers to the original; do not silently replace that base by the final quantity.",
        ],
      },
      {
        title: "When the original is not determined",
        paragraphs: [
          "A 0% change has multiplier 1, so the original and final quantities are equal. A 100% decrease has multiplier 0. Every positive original becomes zero, so a final zero after a 100% decrease does not identify one original. Dividing zero by zero cannot recover it.",
          "An original zero also cannot define a relative percent change, because the change ratio would divide by zero. The recoverable cases here use positive originals and nonzero multipliers. All given values are exact; keep fractions rather than introducing rounding.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A price decreases by 25% to 60 dollars. What was the original price, in dollars?",
      steps: [
        "The decrease is 25/100 = 1/4 of the original price.",
        "The remaining fraction is 1 − 1/4 = 4/4 − 1/4 = 3/4.",
        "Divide the final price by that fraction: 60 ÷ (3/4) = 60 × 4/3 = 240/3 = 80.",
        "Check the amount removed: 80 × 1/4 = 20 dollars.",
        "Apply the decrease: 80 − 20 = 60 dollars.",
      ],
      answer: "80",
      answerUnit: "dollars",
    },
    pitfalls: [
      "The stated percentage is based on the unknown original, not on the known final quantity.",
      "Divide by the remaining or resulting fraction, not by the percentage removed or added.",
      "A 100% decrease cannot be reversed to one unique original quantity.",
    ],
    parentGuide:
      "Give the final 60 units and a 25% decrease. Ask what fraction of the original remains, then recover one quarter and the whole. Check by applying the decrease.",
  },
];
