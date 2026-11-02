import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

export const supplyPriceMethods: Record<string, ProblemMethod> = {
  "supply-price-choice": {
    goal: "Say whether a price goes up or down when a product is scarce or plentiful, and give the reason.",
    intuition:
      "Sellers set prices, and buyers decide whether to pay. When there are fewer goods than people who want them, buyers compete and sellers can ask for more. When there are more goods than people want, sellers lower the price to sell what is left.",
    terms: [
      "supply",
      "demand",
      [
        "supply",
        "Scarce means less is for sale than people want, so there is not enough to go around.",
      ],
      ["supply", "Plentiful means more is for sale than people want to buy."],
    ],
    method: [
      "Compare the supply, the number for sale, with the demand, the number of people who want one.",
      "If the supply is smaller, the product is scarce and the price is likely to rise. If the supply is larger, it is plentiful and the price is likely to fall.",
      "Give the reason by naming the comparison: fewer for sale than wanted, or more for sale than wanted.",
    ],
    watch:
      "A good answer has both parts: the direction of the price and the matching reason. A correct direction with the wrong reason is still wrong.",
  },
};

export const supplyPricePrinciples: Record<string, string> = {
  "supply-price-choice":
    "When demand exceeds supply the good is scarce and its price tends to rise; when supply exceeds demand the good is plentiful and its price tends to fall. Prices respond to the balance between how much is for sale and how much buyers want.",
};

export const supplyPriceLessons = [
  chainLesson({
    id: "supply-price-lesson",
    title: "Scarce and plentiful: what happens to the price",
    summary:
      "Compare how much is for sale with how many people want it to tell which way a price moves.",
    templateIds: ["supply-price-choice"],
    objectives: [
      "Compare supply with demand for a product.",
      "Say whether the price rises or falls and give the matching reason.",
    ],
    openingTitle: "More buyers than goods raises the price",
    opening: [
      "Supply is how many of a product are for sale. Demand is how many people want to buy it. A price moves when these two are not in balance.",
      "If 10 pumpkins are for sale and 60 people want one, buyers compete for a few pumpkins and sellers can ask for more. If 80 pumpkins are for sale and 10 people want one, sellers have too many and lower the price.",
    ],
    example: {
      prompt:
        "A market has 80 toy robots for sale. 20 people want to buy a toy robot. What happens to the price, and why?",
      steps: [
        "Supply is 80 and demand is 20, so the supply is larger.",
        "The toy robots are plentiful: there are more than people want.",
        "Sellers lower the price to sell them, so the price goes down.",
      ],
      answer:
        "The price goes down, because there are more toy robots for sale than people who want them",
    },
    methodTitle: "Compare, then decide",
    method: [
      "Compare the two numbers: supply and demand.",
      "Smaller supply: scarce, price rises. Larger supply: plentiful, price falls. State the reason in the same words.",
    ],
    formalTitle: "Supply and price",
    formal: [
      "When quantity demanded exceeds quantity supplied, there is a shortage and the price tends to rise; when quantity supplied exceeds quantity demanded, there is a surplus and the price tends to fall.",
      "Real prices also depend on costs and on other sellers, so this is a tendency, not a certainty.",
    ],
    pitfalls: [
      "Choosing the right direction with a reason that compares the wrong things.",
      "Thinking that a product with a high price is always scarce. Compare the supply with the demand.",
      "Saying that the price never changes. Prices respond to how much is for sale and how many want it.",
    ],
    parentGuide:
      "Ask your learner what they would do as the seller if the shelf were full and nobody was buying.",
  }),
];

export const supplyPriceFacetMappings: FacetMapping[] = [
  {
    templateId: "supply-price-choice",
    facetId: "financial-literacy-elementary.core",
    extent: "partial",
    rationale:
      "Single choice of the price movement and its reason for a scarce or plentiful product, with the amount for sale and the number of buyers stated. Does not assess reading a supply or demand graph, naming other causes of price changes, or comparing sale prices.",
  },
];
