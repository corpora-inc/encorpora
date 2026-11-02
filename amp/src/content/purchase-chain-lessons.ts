import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

export const purchaseChainMethods: Record<string, ProblemMethod> = {
  "wallet-purchase-chain": {
    goal: "Add two prices and subtract a coupon, or count a wallet of bills and coins and subtract a purchase price, in dollars and cents.",
    intuition:
      "One dollar is 100 cents. We write 4 dollars and 75 cents as 4.75 dollars: the two digits after the point are the cents. A quarter is 25 cents, a dime 10 cents, a nickel 5 cents and a penny 1 cent. A coupon is a paper that takes an amount off what you pay. First find the total, the amount bought or held. Then take the coupon or the price away from it.",
    terms: ["coupon", "coin"],
    noLink: ["quarter", "quarters"],
    method: [
      "Find the total first. Add the two prices. Or add the bills, then the coins. Line up the points so cents add to cents.",
      "Take the coupon or the price away from that total. Line up the points again.",
      "Check that the answer is less than the total, with two digits of cents.",
    ],
    watch:
      "Take the coupon off just once, from the total of both prices. Write coins as dollars before adding them to bills: 25 cents is 0.25 dollars.",
  },
  "mixed-quantity-discount": {
    goal: "Multiply a mixed-number quantity by a decimal unit price, then take a fraction or percent off the total.",
    intuition:
      "A fraction like $\\frac{1}{2}$, one half, is one of 2 equal parts of a whole. A mixed number is a whole number and a fraction together, like $3\\frac{1}{2}$: 3 wholes and one half more. A price like 13.80 dollars means 13 dollars and 80 cents. A yard is a length, about one big step. The price per yard is the cost of 1 yard. A discount is an amount taken off the price. The cost before the discount is the number of yards times, or ×, the price of 1 yard. Percent means out of 100. 20%, read 20 percent, means 20 cents off every 100 cents of the cost. That is 0.20, or 0.2, of the cost.",
    terms: ["unit-price", "discount"],
    senses: { unit: "unit", part: "part", whole: "whole" },
    noLink: ["leaves"],
    method: [
      "Write the mixed number as a decimal. One half is 0.5, one fourth is 0.25 and three fourths is 0.75, so $3\\frac{1}{2}$ is 3.5. Multiply it by the price for one unit. That is the cost before the discount.",
      "Find the discount. For one equal part, such as one fifth, one tenth or one fourth, divide the cost by the bottom number: 5 for $\\frac{1}{5}$, 10 for $\\frac{1}{10}$, 4 for $\\frac{1}{4}$. For a percent, write it as hundredths and multiply: 20% of the cost is the cost times 0.2.",
      "Take the discount away from the cost. That is what the buyer pays.",
    ],
    watch:
      "Work out the discount from the total cost, not from the price of one unit. Then subtract it once.",
  },
};

export const purchaseChainPrinciples: Record<string, string> = {
  "wallet-purchase-chain":
    "Money adds in matching places: dollars with dollars and cents with cents. A wallet is worth each bill and coin added together. Money left is that total minus the price.",
  "mixed-quantity-discount":
    "Cost is the number of units times the price of one unit. A discount of $\\frac{1}{5}$ takes one fifth of the cost away, so the buyer pays the other four fifths. A discount of 10% takes $10 \\div 100 = 0.1$ of the cost away, so the buyer pays 0.9 of it.",
};

export const purchaseChainLessons = [
  chainLesson({
    id: "purchase-chain",
    title: "Totals, coupons and discounts",
    summary:
      "Many buying stories have two steps. First find the total: all the prices added, or all the money in a wallet. Then take something away. A coupon takes an amount off. A discount takes a part of the total off.",
    templateIds: ["wallet-purchase-chain", "mixed-quantity-discount"],
    senses: { unit: "unit", part: "part", whole: "whole" },
    noLink: ["quarter", "quarters"],
    objectives: [
      "Add prices, or count the bills and coins in a wallet, in dollars and cents.",
      "Take a coupon, a price, or a fraction or percent discount off that total.",
    ],
    openingTitle: "Find the total first, then take something away",
    opening: [
      "In a buying story, the first job is a total. It can be prices added together. It can be all the money in a wallet. It can be the cost of several yards of rope. A yard is a length, about one big step. The price per yard is the cost of 1 yard.",
      "The second job takes something off that total. A coupon is a paper that takes an amount off, like 2 dollars off. Paying for something takes its price away from your money.",
      "One dollar is 100 cents. We write 4 dollars and 75 cents as 4.75 dollars. The two digits, the single numbers 0 to 9, after the point are the cents. A quarter is 25 cents, a dime 10 cents and a nickel 5 cents.",
      "A fraction like $\\frac{1}{2}$, one half, is one of 2 equal parts of a whole. So $2\\frac{1}{2}$ yards means 2 whole yards and half of another. A discount takes a part of the total off. One fifth off means the total is split into 5 equal parts and one part comes off. 10% off, read 10 percent off, means 10 cents off every 100 cents. That is one tenth: one of 10 equal parts.",
    ],
    example: {
      prompt:
        "Rope costs 14.00 dollars per yard. Dara buys $2\\frac{1}{2}$ yards, and the store takes one-fifth off the total. How much does Dara pay?",
      steps: [
        "Find the cost before the discount first, because the discount comes off the whole cost. $2\\frac{1}{2}$ means 2 and one half, which is 2.5. The sign × means times: 2 × 14 is 2 groups of 14. So 2 yards cost 28 dollars. Half a yard costs half of 14, which is 7. In all, $28+7=35$ dollars, so $2.5\\times14=35$.",
        "One fifth of 35 dollars is one of 5 equal parts. The sign ÷ means split into equal parts: $35\\div5=7$ dollars. That is the discount.",
        "Take the discount off the cost: $35-7=28$ dollars.",
        "Check: after 1 of the 5 parts comes off, Dara pays the other 4 parts, four fifths. Each part is 7 dollars, and $7\\times4=28$.",
      ],
      answer: "28 dollars",
    },
    methodTitle: "Total, then the part taken off",
    method: [
      "Total: add the prices. Or add the bills and coins, with coins counted in cents first. Or multiply the number of yards by the price of 1 yard.",
      "Then take a coupon or a price away. For a discount, first find it: divide by 5 for one fifth, by 10 for one tenth or by 4 for one fourth. A percent can be written as a fraction: 10% is one tenth, 20% is one fifth and 25% is one fourth. Then take the discount away.",
    ],
    formalTitle: "Why the order matters",
    formal: [
      "A coupon is a set amount off the total, so you add the prices before you take it off. A discount is a part of the total cost, so you need the total first.",
      "Paying four fifths of the total is the same as taking one fifth off. The two parts, one fifth and four fifths, make the whole.",
    ],
    pitfalls: [
      "Line up the points when you add or subtract amounts with cents.",
      "Take the discount from the total cost, not from the price of one unit.",
      "Count coins in cents first. Then write them in dollars: 35 cents is 0.35 dollars, and 135 cents is 1 dollar and 35 cents, 1.35 dollars.",
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
