import type { TemplateMetadata } from "./contracts";
import { defineAxis } from "./variation/axes";
import {
  chainFamily,
  dispatch,
  dollars,
  dollarsShort,
  gcd,
  money,
  numberSurface,
  pick,
} from "./chain-kit";

export const walletPurchaseTemplate: TemplateMetadata = {
  id: "wallet-purchase-chain",
  version: 1,
  title: "Money totals, then a coupon or a purchase",
  skillId: "money-values",
  gradeBand: "3–5",
  difficultyOffset: 0.6,
  description:
    "Add two prices and subtract a coupon, or count a wallet of bills and coins and subtract a purchase price, giving dollars and cents.",
};
export const mixedQuantityDiscountTemplate: TemplateMetadata = {
  id: "mixed-quantity-discount",
  version: 1,
  title: "Mixed-number quantity at a unit price, then a discount",
  skillId: "percentages",
  gradeBand: "6–8",
  difficultyOffset: 0.55,
  description:
    "Multiply a mixed-number quantity by a decimal unit price and then take a stated fraction or percent off the total.",
};

/* ---------------------------------------------------------------- wallet */
const walletAxes = {
  setup: defineAxis("setup", [
    "prices-then-coupon",
    "wallet-then-purchase",
  ] as const),
};
interface WalletModel {
  setup: "prices-then-coupon" | "wallet-then-purchase";
  first: number; // cents (price one, or wallet total)
  second: number; // cents
  third: number; // cents (coupon or purchase)
  fives: number;
  ones: number;
  quarters: number;
  dimes: number;
  nickels: number;
  context: number;
}
const gifts = [
  ["notebook", "pen"],
  ["sandwich", "juice"],
  ["T-shirt", "cap"],
  ["puzzle", "card game"],
] as const;
function walletModel(
  r: (lo: number, hi: number) => number,
  a: { setup: WalletModel["setup"] },
): WalletModel {
  const base = {
    fives: 0,
    ones: 0,
    quarters: 0,
    dimes: 0,
    nickels: 0,
    context: r(0, gifts.length - 1),
  };
  if (a.setup === "prices-then-coupon") {
    const first = 5 * r(60, 1200);
    const second = 5 * r(40, 900);
    const third = 5 * r(20, 200);
    return { ...base, setup: a.setup, first, second, third };
  }
  const fives = r(2, 6);
  const ones = r(2, 8);
  const quarters = r(2, 7);
  const dimes = r(2, 9);
  const nickels = r(2, 9);
  const wallet =
    500 * fives + 100 * ones + 25 * quarters + 10 * dimes + 5 * nickels;
  const price =
    5 * r(Math.ceil((wallet * 0.3) / 5), Math.floor((wallet * 0.9) / 5));
  return {
    ...base,
    setup: a.setup,
    first: wallet,
    second: 0,
    third: price,
    fives,
    ones,
    quarters,
    dimes,
    nickels,
  };
}
export const walletPurchase = chainFamily({
  template: walletPurchaseTemplate,
  axes: walletAxes,
  model: walletModel,
  variant: (m) => m.setup,
  render: (m) => {
    if (m.setup === "prices-then-coupon") {
      const [x, y] = gifts[m.context]!;
      const subtotal = m.first + m.second;
      const pay = subtotal - m.third;
      return numberSurface({
        prompt: `Mia buys a ${x} for ${money(m.first)} and a ${y} for ${money(m.second)}. She has a coupon for ${money(m.third)} off her total. How much does Mia pay? Enter the amount in dollars.`,
        answer: dollarsShort(pay),
        hint: `Add the two prices first: ${dollars(m.first)} + ${dollars(m.second)}. The coupon of ${dollars(m.third)} comes off that total.`,
        explanation: [
          `The total before the coupon is $${dollars(m.first)}+${dollars(m.second)}=${dollars(subtotal)}$ dollars.`,
          `The coupon takes ${dollars(m.third)} dollars off: $${dollars(subtotal)}-${dollars(m.third)}=${dollars(pay)}$ dollars.`,
          `Mia pays ${dollars(pay)} dollars.`,
        ],
        label: "Answer (dollars)",
      });
    }
    const bills = 500 * m.fives + 100 * m.ones;
    const coins = 25 * m.quarters + 10 * m.dimes + 5 * m.nickels;
    const left = m.first - m.third;
    return numberSurface({
      prompt: `Sam's wallet holds ${m.fives} five-dollar bills, ${m.ones} one-dollar bills, ${m.quarters} quarters, ${m.dimes} dimes and ${m.nickels} nickels. Sam buys a book for ${money(m.third)}. How much money does Sam have left? Enter the amount in dollars.`,
      answer: dollarsShort(left),
      hint: `Start with the bills: ${m.fives} five-dollar bills are worth ${5 * m.fives} dollars. Add the one-dollar bills, then the coins, before you subtract the price of ${dollars(m.third)}.`,
      explanation: [
        `Bills: $${m.fives}\\times5+${m.ones}\\times1=${bills / 100}$ dollars.`,
        `Coins in cents: $${m.quarters}\\times25+${m.dimes}\\times10+${m.nickels}\\times5=${coins}$ cents, which is ${dollars(coins)} dollars.`,
        `The wallet holds $${bills / 100}+${dollars(coins)}=${dollars(m.first)}$ dollars.`,
        `After the ${dollars(m.third)} dollar purchase: $${dollars(m.first)}-${dollars(m.third)}=${dollars(left)}$ dollars.`,
      ],
      label: "Answer (dollars)",
    });
  },
});

/* ------------------------------------------------------------- discount */
const discountAxes = {
  "discount-form": defineAxis("discount-form", [
    "fraction",
    "percent",
  ] as const),
};
const discounts = [
  { n: 1, d: 10, word: "one-tenth", percent: 10 },
  { n: 1, d: 5, word: "one-fifth", percent: 20 },
  { n: 1, d: 4, word: "one-fourth", percent: 25 },
] as const;
const goods = [
  { thing: "canvas", unit: "yard" },
  { thing: "ribbon", unit: "yard" },
  { thing: "rope", unit: "yard" },
  { thing: "fabric", unit: "yard" },
] as const;
interface DiscountModel {
  whole: number;
  quarters: number; // fractional part in quarters (0,1,2,3)... see below
  cents: number;
  discount: (typeof discounts)[number];
  good: (typeof goods)[number];
  before: number; // cents, exact
  after: number; // cents, exact
}
function discountModel(r: (lo: number, hi: number) => number): DiscountModel {
  for (let tries = 0; tries < 400; tries++) {
    const whole = r(1, 6);
    const quarters = pick(r, [1, 2, 3] as const);
    const cents = 5 * r(100, 400);
    const discount = pick(r, discounts);
    const quantityQuarters = whole * 4 + quarters;
    if ((cents * quantityQuarters) % 4) continue;
    const before = (cents * quantityQuarters) / 4;
    if ((before * (discount.d - discount.n)) % discount.d) continue;
    return {
      whole,
      quarters,
      cents,
      discount,
      good: pick(r, goods),
      before,
      after: (before * (discount.d - discount.n)) / discount.d,
    };
  }
  throw new Error("Need three retries");
}
const quarterTex = (q: number) =>
  q === 2 ? "\\frac{1}{2}" : `\\frac{${q}}{4}`;
export const mixedQuantityDiscount = chainFamily({
  template: mixedQuantityDiscountTemplate,
  axes: discountAxes,
  model: discountModel,
  variant: (m) => `${m.discount.word}-discount`,
  render: (m, a) => {
    const amount = `$${m.whole}${quarterTex(m.quarters)}$`;
    const off =
      a["discount-form"] === "fraction"
        ? `${m.discount.word} off the total`
        : `${m.discount.percent}% off the total`;
    const decimalQuantity = m.whole + m.quarters / 4;
    const fractionOff = `$\\frac{${m.discount.n}}{${m.discount.d}}$`;
    return numberSurface({
      prompt: `${m.good.thing[0]!.toUpperCase()}${m.good.thing.slice(1)} costs ${money(m.cents)} per ${m.good.unit}. Dara buys ${amount} ${m.good.unit}s of it, and the store takes ${off}. How much does Dara pay? Enter the amount in dollars.`,
      answer: dollarsShort(m.after),
      hint: `Find the cost before the discount first: multiply ${amount} ${m.good.unit}s by ${dollars(m.cents)} dollars per ${m.good.unit}. The discount applies to that total, not to the price per ${m.good.unit}.`,
      explanation: [
        `Cost before the discount: $${decimalQuantity}\\times${dollars(m.cents)}=${dollars(m.before)}$ dollars.`,
        a["discount-form"] === "fraction"
          ? `The discount is ${fractionOff} of ${dollars(m.before)} dollars, which is $${dollars(m.before)}\\div${m.discount.d}=${dollars(m.before / m.discount.d)}$ dollars.`
          : `The discount is ${m.discount.percent}% of ${dollars(m.before)} dollars, which is $${dollars(m.before)}\\times${m.discount.percent / 100}=${dollars((m.before * m.discount.percent) / 100)}$ dollars.`,
        `Dara pays $${dollars(m.before)}-${dollars(m.before - m.after)}=${dollars(m.after)}$ dollars.`,
      ],
      label: "Answer (dollars)",
    });
  },
});
void gcd;

export const purchaseChainTemplates = [
  walletPurchaseTemplate,
  mixedQuantityDiscountTemplate,
] as const;
export const purchaseChainGenerate = dispatch(purchaseChainTemplates, {
  "wallet-purchase-chain": (seed) => walletPurchase.generate(seed).problem,
  "mixed-quantity-discount": (seed) =>
    mixedQuantityDiscount.generate(seed).problem,
});
