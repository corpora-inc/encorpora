import type { TemplateMetadata } from "./contracts";
import { defineAxis } from "./variation/axes";
import {
  chainFamily,
  decimalText,
  dispatch,
  money,
  numberSurface,
  pick,
} from "./chain-kit";

export const percentChainTemplate: TemplateMetadata = {
  id: "percent-chain",
  version: 1,
  title: "Chain two percent changes",
  skillId: "percent-change",
  gradeBand: "6–8",
  difficultyOffset: 0.55,
  description:
    "Chain a percent decrease and a percent increase on different bases to recover an original price, find the single overall multiplier of two increases, or apply a very large increase followed by a decrease.",
};

const axes = {
  ask: defineAxis(
    "ask",
    [
      "original-cost",
      "earlier-cost",
      "overall-multiplier",
      "final-value",
    ] as const,
    { legacy: "original-cost" },
  ),
  "increase-size": defineAxis("increase-size", ["moderate", "large"] as const),
};

const moderate = [10, 15, 20, 25, 30, 40, 50] as const;
const large = [150, 200, 250, 300, 350, 400, 500] as const;
const cuts = [10, 20, 25, 30, 40, 50] as const;
const factor = (percent: number) => decimalText(100 + percent, 100);
const keep = (percent: number) => decimalText(100 - percent, 100);

/** Exact model: every intermediate value is an integer. */
interface Model {
  ask: "original-cost" | "earlier-cost" | "overall-multiplier" | "final-value";
  first: number; // percent of the first change
  second: number; // percent of the second change
  start: number; // original price or starting count (0 when not asked)
  middle: number;
  end: number;
  noun: string;
}

const items = ["jacket", "bicycle", "tent", "guitar", "desk"] as const;
const counts = [
  "video's view count",
  "town's population",
  "club's membership",
  "stadium's weekly attendance",
] as const;

function model(
  r: (lo: number, hi: number) => number,
  a: { ask: Model["ask"]; "increase-size": "moderate" | "large" },
): Model {
  const bigPool = a["increase-size"] === "large" ? large : moderate;
  if (a.ask === "overall-multiplier") {
    const first = pick(r, bigPool);
    const second = pick(r, moderate);
    return {
      ask: a.ask,
      first,
      second,
      start: 0,
      middle: 0,
      end: (100 + first) * (100 + second),
      noun: "fee",
    };
  }
  for (let tries = 0; tries < 400; tries++) {
    const start = 10 * r(3, 160);
    if (a.ask === "original-cost") {
      const cut = pick(r, cuts);
      const rise = pick(r, bigPool);
      if ((start * (100 - cut)) % 100) continue;
      const middle = (start * (100 - cut)) / 100;
      if ((middle * (100 + rise)) % 100) continue;
      if ((middle * (100 + rise)) / 100 === start) continue;
      return {
        ask: a.ask,
        first: cut,
        second: rise,
        start,
        middle,
        end: (middle * (100 + rise)) / 100,
        noun: pick(r, items),
      };
    }
    if (a.ask === "earlier-cost") {
      // start = what the store paid; middle = sale price; end = marked price.
      const rise = pick(r, moderate);
      const cut = pick(r, cuts);
      if ((start * (100 + rise)) % 100) continue;
      const sale = (start * (100 + rise)) / 100;
      if ((sale * 100) % (100 - cut)) continue;
      return {
        ask: a.ask,
        first: cut,
        second: rise,
        start,
        middle: sale,
        end: (sale * 100) / (100 - cut),
        noun: pick(r, items),
      };
    }
    const rise = pick(r, bigPool);
    const cut = pick(r, cuts);
    if ((start * (100 + rise)) % 100) continue;
    const middle = (start * (100 + rise)) / 100;
    if ((middle * (100 - cut)) % 100) continue;
    if ((middle * (100 - cut)) / 100 === start) continue;
    return {
      ask: a.ask,
      first: rise,
      second: cut,
      start,
      middle,
      end: (middle * (100 - cut)) / 100,
      noun: pick(r, counts),
    };
  }
  throw new Error("Need three retries");
}

const percentChain = chainFamily({
  template: percentChainTemplate,
  axes,
  model,
  variant: (m) =>
    `${m.ask}${m.ask === "overall-multiplier" ? "" : m.first >= 150 || m.second >= 150 ? "-large" : ""}`,
  render: (m) => {
    if (m.ask === "original-cost") {
      const { first: cut, second: rise, middle, end, start } = m;
      return numberSurface({
        prompt: `The price of a ${m.noun} was reduced by ${cut}% for a sale. Later the sale price was increased by ${rise}%, and the ${m.noun} now costs ${money(end * 100)}. What was the price before the sale? Enter the number of dollars.`,
        answer: String(start),
        hint: `Work backward from the last change. The final price of ${end} dollars is the sale price plus ${rise}% of the sale price, so it equals ${factor(rise)} times the sale price. Find the sale price first.`,
        explanation: [
          `Work backward: undo the last change first, because the final price is the only price you know.`,
          `Raising a price by ${rise}% keeps all of it and adds ${rise}%, so it multiplies the price by ${factor(rise)}. So $${end} = ${factor(rise)} \\times \\text{sale price}$.`,
          `Undo multiplying by dividing: the sale price is $${end} \\div ${factor(rise)} = ${middle}$ dollars.`,
          `Cutting a price by ${cut}% keeps ${100 - cut}% of it, so it multiplies the price by ${keep(cut)}. So $${middle} = ${keep(cut)} \\times \\text{original price}$.`,
          `Divide again: the original price is $${middle} \\div ${keep(cut)} = ${start}$ dollars.`,
          `Check forward: $${start} \\times ${keep(cut)} = ${middle}$ and $${middle} \\times ${factor(rise)} = ${end}$. The price before the sale was ${start} dollars.`,
        ],
        label: "Answer (dollars)",
      });
    }
    if (m.ask === "earlier-cost") {
      const {
        first: cut,
        second: rise,
        middle: sale,
        end: marked,
        start: paid,
      } = m;
      return numberSurface({
        prompt: `A store marks a ${m.noun} at ${money(marked * 100)} and then lowers the price by ${cut}%. The new price is ${rise}% more than the price the store paid for the ${m.noun}. What did the store pay? Enter the number of dollars.`,
        answer: String(paid),
        hint: `Find the new price first: lowering ${marked} dollars by ${cut}% means multiplying ${marked} by ${keep(cut)}. The ${rise}% comparison comes after that.`,
        explanation: [
          `Lowering the price by ${cut}% keeps ${100 - cut}% of it. As a decimal, ${100 - cut}% is ${keep(cut)}.`,
          `So the new price is $${marked}\\times${keep(cut)}=${sale}$ dollars.`,
          `"${rise}% more than what the store paid" means the price paid plus ${rise}% of it, which is $${factor(rise)}$ times the price paid. So $${sale}=${factor(rise)}\\times\\text{price paid}$.`,
          `Undo multiplying by dividing: the price paid is $${sale}\\div${factor(rise)}=${paid}$ dollars.`,
          `Check: $${paid}\\times${factor(rise)}=${sale}$ and $${marked}\\times${keep(cut)}=${sale}$. The store paid ${paid} dollars.`,
        ],
        label: "Answer (dollars)",
      });
    }
    if (m.ask === "overall-multiplier") {
      const { first, second } = m;
      const total = decimalText(m.end, 10000);
      return numberSurface({
        prompt: `A club's fee rose ${first}% in the first year. In the second year the new fee rose ${second}%. The fee after two years equals the original fee times one number. What is that number? Enter it as a decimal.`,
        answer: total,
        hint: `Each increase multiplies the current amount by 1 plus its rate as a decimal. Start with the first year: a ${first}% rise multiplies by ${factor(first)}.`,
        explanation: [
          `A rise of ${first}% keeps the whole fee and adds ${first}% of it. That is 100% + ${first}%, so it multiplies the fee by $${factor(first)}$.`,
          `The second rise of ${second}% is taken of the new fee, so it multiplies the new fee by $${factor(second)}$.`,
          `Two multiplications in a row are the same as one multiplication by their product: $${factor(first)} \\times ${factor(second)} = ${total}$.`,
          `It is not $${factor(first + second)}$, because the second percent is taken of a larger amount than the first.`,
          `The fee after two years is the original fee times ${total}.`,
        ],
        label: "Answer (decimal factor)",
      });
    }
    const { first: rise, second: cut, start, middle, end } = m;
    return numberSurface({
      prompt: `A ${m.noun} starts at ${start}. In the first month it increases by ${rise}%. In the second month it decreases by ${cut}% of the new amount. What is it at the end of the second month?`,
      answer: String(end),
      hint: `The first change is an increase of ${rise}% on ${start}, so multiply ${start} by ${factor(rise)}. Use that new amount, not ${start}, for the ${cut}% decrease.`,
      explanation: [
        `An increase of ${rise}% keeps the whole amount and adds ${rise}% of it. That is 100% + ${rise}%, so multiply by ${factor(rise)}.`,
        `After the first month: $${start} \\times ${factor(rise)} = ${middle}$.`,
        `The ${cut}% decrease is taken of this new amount, ${middle}, not of ${start}. Losing ${cut}% keeps ${100 - cut}%, so multiply by ${keep(cut)}.`,
        `After the second month: $${middle} \\times ${keep(cut)} = ${end}$.`,
        `At the end of the second month the ${m.noun} is ${end}.`,
      ],
    });
  },
});

export const percentChainTemplates = [percentChainTemplate] as const;
export const percentChainGenerate = dispatch(percentChainTemplates, {
  "percent-chain": (seed) => percentChain.generate(seed).problem,
});
export { percentChain };
