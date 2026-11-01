import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

export const percentChainMethods: Record<string, ProblemMethod> = {
  "percent-chain": {
    goal: "Chain two percent changes: undo a cut and a rise for the original, combine two rises into one factor, or apply a large rise then a cut.",
    intuition:
      "A percent change multiplies an amount by a factor: a 20% decrease keeps 80% of it, so it multiplies by 0.8, and a 25% increase multiplies by 1.25. The second change acts on the amount after the first change, so the two factors multiply instead of the two percents adding.",
    terms: [
      [
        "factor-number",
        "For a percent change, the factor is 1 plus the rate for an increase, or 1 minus the rate for a decrease.",
      ],
      [
        "percent",
        "The base is the amount the percent is taken of; after the first change, it is the changed amount.",
      ],
    ],
    method: [
      "Turn each percent change into its factor, in the order the changes happen.",
      "To go forward, multiply the amount by the first factor, then by the second. To find one overall factor, multiply the two factors.",
      "To go backward from a final amount, divide by the last factor first, then by the earlier factor.",
      "Check by applying both factors forward to your answer and comparing with the given amount.",
    ],
    watch:
      "Do not add or subtract the two percents. The second percent is taken of the changed amount, so a 20% cut followed by a 20% rise does not return to the start.",
  },
};

export const percentChainPrinciples: Record<string, string> = {
  "percent-chain":
    "A change of $p\\%$ multiplies an amount by $1+p/100$ for an increase and $1-p/100$ for a decrease. Successive changes multiply their factors in order: after changes of $p\\%$ and $q\\%$ the amount is the start times $(1\\pm p/100)(1\\pm q/100)$. The factors are nonzero, so a final amount determines the start by dividing by the factors in reverse order.",
};

export const percentChainLessons = [
  chainLesson({
    id: "percent-chain",
    title: "Chain two percent changes",
    summary:
      "Each percent change is a multiplication on the current amount. Chain the factors forward, combine them, or divide them out backward.",
    templateIds: ["percent-chain"],
    objectives: [
      "Write each percent change as a factor and apply the factors in order on their changing bases.",
      "Combine two changes into one overall factor and undo two changes to find the starting amount.",
    ],
    openingTitle: "The second percent is taken of a new amount",
    opening: [
      "You already know that a percent increase of 25% multiplies an amount by 1.25 and a decrease of 20% multiplies it by 0.8. A factor is the number an amount is multiplied by. When two changes happen one after the other, the second change is a percent of the amount the first change produced, which is its base.",
      "So two changes are two multiplications in order. A 20% cut and then a 20% rise multiply by $0.8\\times1.2=0.96$, which is 4% below the start. The percents do not add.",
    ],
    example: {
      prompt:
        "A coat's price was reduced by 20% for a sale. Later the sale price was increased by 50%, and the coat now costs 120 dollars. What was the price before the sale?",
      steps: [
        "The increase of 50% multiplies the sale price by $1.5$. So $120=1.5\\times\\text{sale price}$ and the sale price is $120\\div1.5=80$ dollars.",
        "The reduction of 20% multiplies the original price by $0.8$. So $80=0.8\\times\\text{original price}$ and the original price is $80\\div0.8=100$ dollars.",
        "Check forward: $100\\times0.8=80$ and $80\\times1.5=120$.",
      ],
      answer: "100 dollars",
    },
    methodTitle: "Forward, combined and backward",
    method: [
      "Forward: multiply the start by the first factor, then multiply that result by the second factor. Round only at the end, if the problem asks for rounding.",
      "Combined: multiply the two factors once, for example $1.2\\times1.1=1.32$, so two increases of 20% and 10% make a 32% increase, not 30%.",
      "Backward: the last change is undone first. Divide the final amount by the last factor, then divide that result by the earlier factor.",
    ],
    formalTitle: "Why factors multiply",
    formal: [
      "A start amount $A$ changed by $p\\%$ becomes $A(1\\pm p/100)$, with plus for an increase and minus for a decrease. A second change of $q\\%$ is taken of that amount, so the result is $A(1\\pm p/100)(1\\pm q/100)$.",
      "Each factor is positive when a decrease is less than 100%, so dividing by it is allowed and undoes the change exactly. The order of the two factors does not change the product, but the order matters for the amounts in between.",
    ],
    pitfalls: [
      "Do not add the percents; multiply the factors.",
      "When working backward, undo the last change first and use its own percent.",
      "A decrease of 20% is a factor of 0.8, not $-0.2$ and not $1.2$.",
    ],
    parentGuide:
      "Ask your learner to say the factor for each change aloud, then to explain why a 20% cut followed by a 20% rise ends below the start.",
  }),
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
