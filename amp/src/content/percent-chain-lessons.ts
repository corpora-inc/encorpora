import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

export const percentChainMethods: Record<string, ProblemMethod> = {
  "percent-chain": {
    senses: {
      change: "change",
      changes: "change",
      "more than": "more-than",
    },
    noLink: ["factor", "factors"],
    goal: "Work with two percent changes in a row: undo both to find the start, combine them into one, or apply them in order.",
    intuition:
      "Percent means per hundred. A percent change multiplies an amount by one number, called the factor. A 20% decrease keeps 80%, so its factor is 0.8. A 25% increase gives 125%, so its factor is 1.25. The second change is taken of the amount after the first, so multiply the factors. Do not add the percents.",
    terms: [
      [
        "multiplier",
        "For a percent change, the multiplier, also called the factor, is 1 plus the rate for an increase, or 1 minus the rate for a decrease.",
      ],
      [
        "percent",
        "The base is the amount the percent is taken of; after the first change, it is the changed amount.",
      ],
    ],
    method: [
      "Turn each percent change into its factor, in the order the changes happen. For example, a 20% decrease is 0.8.",
      "Forward: multiply the amount by the first factor, then by the second. For one overall factor, multiply the two factors.",
      "Backward from a final amount: divide by the last factor first, then by the earlier factor.",
      "Check by applying both factors forward to your answer.",
    ],
    watch:
      "Do not add or subtract the two percents. The second percent is taken of the changed amount, so a 20% cut and then a 20% rise does not return to the start.",
  },
};

export const percentChainPrinciples: Record<string, string> = {
  "percent-chain":
    "A change of $p\\%$ multiplies an amount by $1+p/100$ for an increase and $1-p/100$ for a decrease. Changes in a row multiply their factors in order. After changes of $p\\%$ and $q\\%$ the amount is the start times $(1\\pm p/100)(1\\pm q/100)$, where $\\pm$ means plus for an increase and minus for a decrease. A decrease of less than 100% has a factor greater than 0. So a final amount gives back the start by dividing by the factors in reverse order.",
};

export const percentChainLessons = [
  {
    ...chainLesson({
      id: "percent-chain",
      title: "Chain two percent changes",
      summary:
        "Percent means per hundred. A percent change is a change by some percent of an amount. It multiplies the amount by one number, called the factor: a 20% decrease multiplies by 0.8, because 80% is left. When two changes happen in a row, the second one acts on the new amount. So multiply by both factors in order. To go backward, divide by them in reverse order.",
      templateIds: ["percent-chain"],
      objectives: [
        "Write each percent change as a factor, and apply the factors in order, each to the amount it changes.",
        "Combine two changes into one overall factor, and undo two changes to find the starting amount.",
      ],
      openingTitle: "The second percent is taken of a new amount",
      opening: [
        "A 100-dollar coat goes on sale for 20% off. 20% of 100 is 20, so the sale price is 80 dollars. Then the price goes up by 20%. This time the 20% is taken of 80, not 100. 20% of 80 is 16, so the price becomes 96 dollars, not 100.",
        "A factor is the number an amount is multiplied by. A decrease of 20% leaves 80% of the amount, so it multiplies by 0.8. An increase of 25% gives 125% of the amount, so it multiplies by 1.25. In general the factor is 1 plus the percent written as a decimal (a number with a decimal point, such as 0.25 for 25%) for an increase, or 1 minus it for a decrease.",
        "So two changes in a row are two multiplications in order. The 20% cut and then the 20% rise multiply by $0.8\\times1.2=0.96$. That is 96% of the start, which is 4% below it. The percents do not simply add to 0.",
      ],
      example: {
        prompt:
          "A coat's price was reduced by 20% for a sale. Later the sale price was increased by 50%, and the coat now costs 120 dollars. What was the price before the sale?",
        steps: [
          "Undo the last change first. An increase of 50% multiplies the sale price by $1.5$. So $120=1.5\\times\\text{sale price}$. Divide both sides (the parts on each side of the equal sign) by $1.5$ to undo it: the sale price is $120\\div1.5=80$ dollars.",
          "Now undo the first change. A reduction of 20% leaves 80%, so it multiplies the original price by $0.8$. So $80=0.8\\times\\text{original price}$, and the original price is $80\\div0.8=100$ dollars.",
          "Check by going forward: $100\\times0.8=80$, and $80\\times1.5=120$, the price given.",
        ],
        answer: "100 dollars",
      },
      methodTitle: "Forward, combined and backward",
      method: [
        "Forward: multiply the start by the first factor. Then multiply that result by the second factor. Round only at the end, and only if the problem asks.",
        "Combined: multiply the two factors once. For example, $1.2\\times1.1=1.32$. So increases of 20% and then 10% make a 32% increase, not 30%.",
        "Backward: undo the last change first. Divide the final amount by the last factor. Then divide that result by the earlier factor.",
      ],
      formalTitle: "Why factors multiply",
      formal: [
        "A start amount $A$ changed by $p\\%$ becomes $A(1\\pm p/100)$. The sign $\\pm$ means plus for an increase and minus for a decrease. A second change of $q\\%$ is taken of that new amount. So the result is $A(1\\pm p/100)(1\\pm q/100)$.",
        "When each decrease is less than 100%, each factor is greater than 0. So dividing by it is allowed, and it undoes the change exactly. Swapping the order of the two factors does not change their product, the result of multiplying. But the order does change the amount in between.",
      ],
      pitfalls: [
        "Do not add the percents. Multiply the factors.",
        "When working backward, undo the last change first, and use its own percent.",
        "A decrease of 20% has the factor 0.8, not $-0.2$ and not $1.2$.",
      ],
      parentGuide:
        "Ask your learner to say the factor for each change aloud. Then ask them to explain why a 20% cut followed by a 20% rise ends below the start.",
    }),
    senses: {
      change: "change",
      part: "part",
      product: "product-multiply",
      sides: "side-of-equation",
    },
    noLink: ["factor", "factors", "leaves"],
  },
];

export const percentChainFacetMappings: FacetMapping[] = [
  {
    templateId: "percent-chain",
    facetId: "percent-change.successive-changes",
    extent: "partial",
    rationale:
      "Numeric entry for undoing an increase and a decrease to find the original price, a decrease followed by comparing the new price with an earlier cost, the single factor of two increases as a decimal, and a very large increase followed by a decrease on whole-number amounts with exact results. Does not assess rounding to cents, percent-point versus percent-of language, tax or tip chains, or written explanations.",
  },
];
