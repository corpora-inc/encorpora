import type { TemplateMetadata } from "./contracts";
import { defineAxis } from "./variation/axes";
import { chainFamily, choiceSurface, dispatch, pick } from "./chain-kit";
import { an } from "./elementary-gap-kit";

export const supplyPriceTemplate: TemplateMetadata = {
  id: "supply-price-choice",
  version: 1,
  requiredResponseCapability: "single-choice-v1",
  title: "Scarce or plentiful: what happens to the price?",
  skillId: "financial-literacy-elementary",
  gradeBand: "3–5",
  difficultyOffset: 0,
  description:
    "Decide whether a price rises or falls when a product becomes scarce or plentiful, and choose the reason: how the amount for sale compares with the amount people want.",
};

type Goods = { item: string; plural: string; place: string };
const goods: Goods[] = [
  { item: "strawberry", plural: "strawberries", place: "a farm stand" },
  { item: "pumpkin", plural: "pumpkins", place: "a market" },
  { item: "toy robot", plural: "toy robots", place: "a toy shop" },
  { item: "bike helmet", plural: "bike helmets", place: "a store" },
  {
    item: "concert ticket",
    plural: "concert tickets",
    place: "a ticket office",
  },
];

const axes = {
  supply: defineAxis("supply", ["scarce", "plentiful"] as const),
};
interface Model {
  supply: "scarce" | "plentiful";
  goods: Goods;
  /** How many are for sale and how many people want one, as plain numbers. */
  forSale: number;
  wanted: number;
}
export const supplyPrice = chainFamily({
  template: supplyPriceTemplate,
  axes,
  model: (r, a): Model => {
    const g = pick(r, goods);
    const small = 10 * r(1, 4);
    const big = 10 * r(6, 12);
    return a.supply === "scarce"
      ? { supply: a.supply, goods: g, forSale: small, wanted: big }
      : { supply: a.supply, goods: g, forSale: big, wanted: small };
  },
  variant: (m) => `${m.supply}-${m.goods.item.replaceAll(" ", "-")}`,
  render: (m, _a, r) => {
    const { goods: g, forSale, wanted } = m;
    const rise = m.supply === "scarce";
    const because = (more: boolean) =>
      more
        ? `there are fewer ${g.plural} for sale than people who want them`
        : `there are more ${g.plural} for sale than people who want them`;
    const correct = `The price goes ${rise ? "up" : "down"}, because ${because(rise)}.`;
    return choiceSurface(r, {
      prompt: `${g.place[0]!.toUpperCase()}${g.place.slice(1)} has ${forSale} ${g.plural} for sale. ${wanted} people want to buy ${an(g.item)} ${g.item}. What is most likely to happen to the price of ${an(g.item)} ${g.item}, and why?`,
      options: [
        { label: correct, correct: true },
        {
          label: `The price goes ${rise ? "down" : "up"}, because ${because(rise)}.`,
          feedback: `The reason is right, but the price goes the other way: ${rise ? "when buyers compete for a small supply, sellers can ask for more" : "when sellers have more than people want, they lower the price to sell them"}.`,
        },
        {
          label: `The price goes ${rise ? "up" : "down"}, because ${because(!rise)}.`,
          feedback: `The price goes the right way, but the reason does not fit this story: here ${forSale} are for sale and ${wanted} people want one, so ${because(rise)}.`,
        },
        {
          label: `The price stays the same, because the price of ${g.plural} does not depend on how many are for sale or wanted.`,
          feedback: `Prices respond to supply and demand. With ${forSale} for sale and ${wanted} people who want one, the price is likely to go ${rise ? "up" : "down"}.`,
        },
      ],
      hint: `Compare the ${forSale} ${g.plural} for sale with the ${wanted} people who want one. Are there more ${g.plural} than buyers, or fewer? Think about what a seller does in each case.`,
      explanation: [
        `The supply is the number for sale, ${forSale}, and the demand is the number of people who want one, ${wanted}.`,
        rise
          ? `Few ${g.plural} for many buyers means ${g.plural} are scarce, so sellers can ask for more.`
          : `Many ${g.plural} for few buyers means ${g.plural} are plentiful, so sellers lower the price to sell them.`,
        correct,
      ],
    });
  },
});

export const supplyPriceTemplates = [supplyPriceTemplate] as const;
export const supplyPriceGenerate = dispatch(supplyPriceTemplates, {
  "supply-price-choice": (seed) => supplyPrice.generate(seed).problem,
});
