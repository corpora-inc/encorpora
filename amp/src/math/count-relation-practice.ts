import type { TemplateMetadata } from "./contracts";
import { defineAxis } from "./variation/axes";
import { chainFamily, dispatch, numberSurface, pick } from "./chain-kit";

export const countRelationTemplate: TemplateMetadata = {
  id: "count-relation-chain",
  version: 1,
  title: "Use one count to find another, then combine",
  skillId: "systems-modeling",
  gradeBand: "9–12",
  difficultyOffset: 0.4,
  description:
    "Substitute a known count into a two-variable value equation in context and solve for the other count, or turn 'k times as many' and 'd more than' into one equation for the smaller count.",
};

const axes = {
  ask: defineAxis("ask", ["target", "partner", "combined"] as const),
};
interface Model {
  kind: "value-equation" | "times-as-many";
  a: number; // value of one first item / multiplier k
  b: number; // value of one second item
  first: number; // count of first items / smaller count
  second: number; // count of second items
  context: number;
}
const stores = [
  {
    first: "pens",
    second: "notebooks",
    where: "A school store",
    verb: "sold",
    unit: "dollars",
  },
  {
    first: "adult tickets",
    second: "student tickets",
    where: "A theater",
    verb: "sold",
    unit: "dollars",
  },
  {
    first: "small plants",
    second: "large plants",
    where: "A nursery",
    verb: "sold",
    unit: "dollars",
  },
] as const;
const collectors = [
  { big: "Dev", small: "Lia", thing: "stamps" },
  { big: "Rosa", small: "Ken", thing: "trading cards" },
  { big: "Omar", small: "Jade", thing: "shells" },
] as const;
function model(r: (lo: number, hi: number) => number): Model {
  const kind = pick(r, ["value-equation", "times-as-many"] as const);
  if (kind === "times-as-many")
    return {
      kind,
      a: r(3, 8),
      b: 0,
      first: r(4, 15),
      second: 0,
      context: r(0, collectors.length - 1),
    };
  const a = r(2, 9);
  let b = r(2, 12);
  if (b === a) b += 1;
  return {
    kind,
    a,
    b,
    first: r(4, 18),
    second: r(5, 20),
    context: r(0, stores.length - 1),
  };
}
export const countRelation = chainFamily({
  template: countRelationTemplate,
  axes,
  model,
  variant: (m) => m.kind,
  render: (m, ax) => {
    if (m.kind === "times-as-many") {
      const c = collectors[m.context]!;
      const small = m.first;
      const big = m.a * small;
      const diff = big - small;
      const asked = { target: small, partner: big, combined: big + small }[
        ax.ask
      ];
      const question = {
        target: `How many ${c.thing} does ${c.small} have?`,
        partner: `How many ${c.thing} does ${c.big} have?`,
        combined: `How many ${c.thing} do they have together?`,
      }[ax.ask];
      return numberSurface({
        prompt: `${c.big} has ${m.a} times as many ${c.thing} as ${c.small}. ${c.big} has ${diff} more ${c.thing} than ${c.small}. ${question}`,
        answer: String(asked),
        hint: `Let $x$ be the number ${c.small} has. Then ${c.big} has ${m.a} times as many, which is $${m.a}x$. The difference $${m.a}x-x$ is ${diff}. Solve that for $x$ first.`,
        explanation: [
          `Let $x$ be the number of ${c.thing} ${c.small} has. "${m.a} times as many" means ${c.big} has $${m.a}x$, which is ${m.a} times $x$.`,
          `"${diff} more" means the larger count minus the smaller count is ${diff}: $${m.a}x-x=${diff}$.`,
          `Combine like terms, the terms that both contain $x$: ${m.a} groups of $x$ minus one group leaves $${m.a - 1}x$, so $${m.a - 1}x=${diff}$.`,
          `Divide both sides by ${m.a - 1} to undo the multiplication: $x=${diff}\\div${m.a - 1}=${small}$. ${c.small} has ${small} ${c.thing}.`,
          `${c.big} has ${m.a} times as many: $${m.a}\\times${small}=${big}$. Check the difference: $${big}-${small}=${diff}$, as stated.`,
          {
            target: `So ${c.small} has ${small} ${c.thing}.`,
            partner: `So ${c.big} has ${big} ${c.thing}.`,
            combined: `Together they have $${small}+${big}=${small + big}$, so they have ${small + big} ${c.thing} in all.`,
          }[ax.ask],
        ],
        label: `Answer (${c.thing})`,
      });
    }
    const c = stores[m.context]!;
    const value = m.a * m.first + m.b * m.second;
    // target: given the first count, find the second; partner: reverse; combined: given first, find the total count.
    const given = ax.ask === "partner" ? m.second : m.first;
    const givenName = ax.ask === "partner" ? c.second : c.first;
    const otherName = ax.ask === "partner" ? c.first : c.second;
    const answer =
      ax.ask === "partner"
        ? m.first
        : ax.ask === "target"
          ? m.second
          : m.first + m.second;
    const question =
      ax.ask === "combined"
        ? `How many items were sold in all?`
        : `How many ${otherName} were sold?`;
    const coefGiven = ax.ask === "partner" ? m.b : m.a;
    const coefOther = ax.ask === "partner" ? m.a : m.b;
    const rest = value - coefGiven * given;
    return numberSurface({
      prompt: `${c.where} ${c.verb} ${c.first} for ${m.a} ${c.unit} each and ${c.second} for ${m.b} ${c.unit} each. The equation $${m.a}p+${m.b}q=${value}$ gives the total value of the sales, in ${c.unit}, where $p$ is the number of ${c.first} sold and $q$ is the number of ${c.second} sold. ${given} ${givenName} were sold. ${question}`,
      answer: String(answer),
      hint: `Substitute the known count into the equation: put ${ax.ask === "partner" ? "$q$" : "$p$"} equal to ${given}. Then ${coefGiven} times ${given} leaves the rest of ${value} for the other term.`,
      explanation: [
        `In $${m.a}p+${m.b}q=${value}$, the term $${m.a}p$ is the money from ${c.first}: ${m.a} ${c.unit} times the number sold. The term $${m.b}q$ is the money from ${c.second}.`,
        `Substitute the known count, which means putting it in place of its letter. ${ax.ask === "partner" ? `With $q=${given}$: $${m.a}p+${m.b}\\times${given}=${value}$` : `With $p=${given}$: $${m.a}\\times${given}+${m.b}q=${value}$`}.`,
        `The ${givenName} brought in $${coefGiven}\\times${given}=${coefGiven * given}$ ${c.unit}. Subtract that from both sides: $${value}-${coefGiven * given}=${rest}$, so ${ax.ask === "partner" ? `$${m.a}p=${rest}$` : `$${m.b}q=${rest}$`}.`,
        `Divide both sides by ${coefOther}, the price of one of the ${otherName}: $${rest}\\div${coefOther}=${rest / coefOther}$.`,
        ax.ask === "combined"
          ? `Add the two counts: $${given}+${rest / coefOther}=${answer}$. So ${answer} items were sold in all.`
          : `So ${answer} ${otherName} were sold.`,
      ],
      label: ax.ask === "combined" ? "Answer (items)" : `Answer (${otherName})`,
    });
  },
});

export const countRelationTemplates = [countRelationTemplate] as const;
export const countRelationGenerate = dispatch(countRelationTemplates, {
  "count-relation-chain": (seed) => countRelation.generate(seed).problem,
});
