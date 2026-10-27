import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

export const purchaseChainMethods: Record<string, ProblemMethod> = {
  "wallet-purchase-chain": {
    goal: "Add two prices and subtract a coupon, or count a wallet of bills and coins and subtract a purchase price, in dollars and cents.",
    intuition:
      "Money amounts are decimals: the digits after the point are cents. A total adds every amount that is paid or held, and a coupon or purchase is then taken away from it.",
    terms: [
      ["coupon", "An amount taken off the total that would otherwise be paid."],
      [
        "value of a coin",
        "A quarter is 25 cents, a dime 10 cents and a nickel 5 cents.",
      ],
    ],
    method: [
      "Find the first total: add the two prices, or add the bills and then the coins, lining up the decimal points.",
      "Subtract the coupon or the purchase price from that total, again lining up the decimal points.",
      "Check that the result is less than the first total and has the right number of cents.",
    ],
    watch:
      "Convert coins to cents before adding them to dollars. Subtract the coupon from the sum of the prices, not from one price alone.",
  },
  "mixed-quantity-discount": {
    goal: "Multiply a mixed-number quantity by a decimal unit price, then take a fraction or percent off the total.",
    intuition:
      "The cost before a discount is the quantity times the price for one unit. A discount of $\\frac{1}{10}$ or 10% is taken from that whole cost, so the customer pays the rest.",
    terms: [
      ["unit price", "The cost of one unit, such as one yard."],
      ["discount", "A fraction or percent of the cost that is taken off."],
    ],
    method: [
      "Write the mixed number as a decimal and multiply it by the unit price to get the cost before the discount.",
      "Find the discount: divide the cost by the fraction's denominator, or multiply by the percent as a decimal.",
      "Subtract the discount from the cost before the discount.",
    ],
    watch:
      "The discount is a part of the total cost, not of the price for one unit. Subtract it from the total.",
  },
};

export const purchaseChainPrinciples: Record<string, string> = {
  "wallet-purchase-chain":
    "Money is measured in cents, so a total in dollars and cents is the sum of amounts with the same unit. A wallet's value is the sum of each count times its value, and money left is the wallet's value minus the price, which cannot be negative if the purchase is possible.",
  "mixed-quantity-discount":
    "Cost is quantity times unit price. A discount of $\\frac{a}{b}$ of the cost leaves $1-\\frac{a}{b}$ of it, so the amount paid is cost times $\\frac{b-a}{b}$; a discount of $p\\%$ leaves cost times $1-p/100$.",
};

export const purchaseChainLessons = [
  chainLesson({
    id: "purchase-chain",
    title: "Totals, coupons and discounts",
    summary:
      "Find what is bought or held first, then take away a coupon, a purchase or a discount.",
    templateIds: ["wallet-purchase-chain", "mixed-quantity-discount"],
    objectives: [
      "Add prices or count a wallet of bills and coins in dollars and cents.",
      "Apply a coupon, a purchase price, or a fraction or percent discount to that total.",
    ],
    openingTitle: "Find the total first, then take something away",
    opening: [
      "In a buying story the first job is a total: the prices added together, the value of everything in a wallet, or the cost of a number of units at a price for one. The second job takes something off that total.",
      "Money is a decimal. The digits after the decimal point are cents, so 4.75 dollars is 4 dollars and 75 cents. A quarter is 25 cents, a dime is 10 cents and a nickel is 5 cents.",
    ],
    example: {
      prompt:
        "Rope costs 14.00 dollars per yard. Dara buys $2\\frac{1}{2}$ yards, and the store takes one-fifth off the total. How much does Dara pay?",
      steps: [
        "Cost before the discount: $2.5\\times14=35$ dollars.",
        "One-fifth of 35 dollars is $35\\div5=7$ dollars.",
        "Dara pays $35-7=28$ dollars.",
        "Check: paying four-fifths of 35 gives $35\\div5\\times4=28$.",
      ],
      answer: "28 dollars",
    },
    methodTitle: "Total, then the reduction",
    method: [
      "Total: add the prices, or add the bills and the coins (coins in cents, then in dollars), or multiply the quantity by the price for one unit.",
      "Reduction: subtract a coupon or a purchase price, or find the discount (a fraction of the total by dividing by the denominator, a percent by multiplying by the decimal) and subtract it.",
    ],
    formalTitle: "Why the order matters",
    formal: [
      "A coupon is a fixed amount off the total, so it is subtracted after the prices are added. A fractional or percent discount is a part of the total cost, so it needs the total first.",
      "Paying $\\frac{b-a}{b}$ of the total after a discount of $\\frac{a}{b}$ is the same as subtracting the discount, because the two parts of the whole make the whole.",
    ],
    pitfalls: [
      "Line up the decimal points when you add or subtract amounts with cents.",
      "Take the discount from the total cost, not from the price for one unit.",
      "Count coins in cents first, then convert to dollars.",
    ],
    parentGuide:
      "Ask your learner to say what the total is before any coupon or discount, and then to estimate the answer to see if it is reasonable.",
  }),
];

export const purchaseChainFacetMappings: FacetMapping[] = [
  {
    templateId: "wallet-purchase-chain",
    facetId: "money-values.coin-bill-totals",
    extent: "partial",
    rationale:
      "Numeric entry in dollars for two prices minus a coupon and for a wallet of five-dollar bills, one-dollar bills, quarters, dimes and nickels minus a purchase price. Does not assess making change with a chosen set of coins, sales tax, or rounding.",
  },
  {
    templateId: "mixed-quantity-discount",
    facetId: "percentages.core",
    extent: "partial",
    rationale:
      "Numeric entry for a mixed-number quantity at a decimal unit price with a one-tenth, one-fifth or one-fourth discount shown as a fraction or a percent, with an exact cent result. Does not assess sales tax, tips, unit-price comparison, or discounts that need rounding.",
  },
];
