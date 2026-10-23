import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

const templateId = "successive-percent-change";

export const successivePercentChangeLesson: Lesson = {
  id: templateId,
  title: "Two percent changes to a price",
  summary:
    "Each percentage uses the price at that moment. A percent means parts per hundred: after the first price change, use the new price for the second one.",
  templateIds: [templateId],
  includeGeneratedRepresentation: false,
  objectives: [
    "Use the price after the first change as the base for the second percentage.",
    "Find the final price after two increases or decreases, including a discount followed by tax.",
    "Convert fractional percents exactly and round a final money amount to cents only after both changes.",
  ],
  sections: [
    {
      stage: "intuition",
      title: "The whole changes after the first step",
      paragraphs: [
        "A discount is a price decrease. A 20% discount removes 20 of every 100 parts of the starting price. A later 20% increase adds 20 of every 100 parts of the smaller, discounted price. These amounts differ because the prices used as their wholes differ.",
      ],
    },
    {
      stage: "method",
      title: "Use each new price as the next base",
      paragraphs: [
        "The base is the price used to calculate a percentage. Find the price after the first change, then use that price as the base for the second. A multiplier is the number you multiply a base by to get its changed price. A 20% decrease leaves 80% of its base, so its multiplier is 0.80; a 20% increase has multiplier 1.20.",
        "A discount followed by tax works the same way when tax is stated to apply to the discounted price. A 25% discount on 80 dollars leaves $80\\times0.75=60$ dollars. A tax of 8.875% means $8.875/100=0.08875$ of the 60-dollar base, so the exact final amount is $60\\times1.08875=65.325$ dollars. Round this final amount to 65.33 dollars: the third decimal digit is 5, so the cents round up.",
      ],
    },
  ],
  closingSections: [
    {
      stage: "formal",
      title: "Successive percentage multipliers",
      paragraphs: [
        "A percent is one hundredth of a named base: $p$% means $p/100$ of that base. Let $P_0\\ge0$ be the starting price. For a nonnegative numerical percent rate $p_1$, the first multiplier $m_1$ is $1+p_1/100$ for an increase or $1-p_1/100$ for a decrease. Define $m_2$ from the second rate $p_2$ in the same way. The exact prices are $P_1=P_0m_1$ and $P_2=P_1m_2=P_0m_1m_2$. For a nonnegative price, a decrease rate is at most 100%; an increase rate may exceed 100%.",
        "The second rate is applied to $P_1$, even though the factors may be multiplied together without changing the exact product. For a positive starting price, equal decrease and increase rates $p$ do not undo one another: $(1-p/100)(1+p/100)=1-(p/100)^2$, which is less than 1 when $p>0$ and $p\\le100$.",
        "For a money answer, keep the intermediate and final calculations exact until the requested cent rounding. Round the final nonnegative dollar amount to the nearest hundredth; if it is exactly halfway between two cents, choose the higher cent. Apply an earlier rounding step only if the problem states one.",
      ],
    },
  ],
  workedExample: {
    prompt:
      "A price of 60 dollars falls by 20%, then rises by 20%. What is the final price, in dollars?",
    steps: [
      "The discount is 20 of every 100 parts of 60 dollars: $20/100=0.20$, and $60\\times0.20=12$ dollars are removed.",
      "The price after the discount is $60-12=48$ dollars. This is the whole for the second change.",
      "The increase is 20% of 48 dollars: $48\\times0.20=9.60$ dollars. Add it to the discounted price: $48+9.60=57.60$ dollars.",
      "Check with the amounts kept and added: $60\\times0.80\\times1.20=57.60$. The increase adds 9.60 dollars, less than the 12 dollars removed, because it uses the smaller base.",
    ],
    answer: "57.60",
    answerUnit: "dollars",
  },
  pitfalls: [
    "Use the changed price as the base for the second percent. Applying both changes to the starting price gives the wrong second change.",
    "Keep exact intermediate amounts when the problem asks for one final cent rounding. A fractional percent such as 8.875% gives a change fraction of 0.08875, not 0.8875 or 8.875.",
  ],
  parentGuide:
    "Compare the 12 dollars removed from 60 with the 9.60 dollars added to 48. Ask which price counts as the whole for each 20%, then check $60\\times0.80\\times1.20=57.60$ dollars.",
};

export const successivePercentChangeMethod: ProblemMethod = {
  goal: "Find the final price after two stated percentage changes.",
  intuition:
    "A percent means parts per hundred of a price. Change the starting price once, then use that new price for the next change.",
  terms: [
    ["base", "The price used as the whole for a percentage."],
    [
      "multiplier",
      "The number multiplied by a price to get its changed price; add the percent fraction to 1 for an increase, or subtract it from 1 for a decrease.",
    ],
  ],
  method: [
    "Divide the first numerical percent by 100 to get its change fraction. Add it to 1 for an increase or subtract it from 1 for a decrease, then multiply the starting price.",
    "Use that exact changed price as the base for the second percent. Form its increase or decrease multiplier and multiply again.",
    "Keep any extra decimal places during both changes. Round only the final money amount to cents, with an exact halfway value rounding up.",
  ],
  watch:
    "Apply the second percent to the price after the first change. Two equal but opposite percentages use different bases, so they usually do not cancel.",
};

export const successivePercentChangePrinciple =
  "For starting price $P_0\\ge0$, let $p_i$ be the numerical percent rate and $m_i=1+p_i/100$ for an increase, or $m_i=1-p_i/100$ for a decrease, with $i=1,2$. Each $p_i\\ge0$; a decrease has $p_i\\le100$. The exact final price is $P_2=P_0m_1m_2$; the second percentage uses $P_1=P_0m_1$ as its base. Round the final nonnegative money result to cents, choosing the higher cent at an exact halfway value, unless the problem specifies an earlier rounding step.";
