import type { TemplateMetadata } from "./contracts";
import { defineAxis } from "./variation/axes";
import { chainFamily, dispatch, gcd, numberSurface, pick } from "./chain-kit";

export const shareRemainderFractionsTemplate: TemplateMetadata = {
  id: "share-remainder-fractions",
  version: 1,
  title: "Fractions of a whole, then the rest or the periods",
  skillId: "fraction-multiplication",
  gradeBand: "3–5",
  difficultyOffset: 0.45,
  description:
    "Take unit or proper fractions of a whole number twice and subtract both parts from the whole, or take a fraction of a multi-digit periodic amount and scale it over several periods.",
};
export const shareRemainderPercentTemplate: TemplateMetadata = {
  id: "share-remainder-percent",
  version: 1,
  title: "Percent shares, then the rest or the difference",
  skillId: "percentages",
  gradeBand: "6–8",
  difficultyOffset: 0.4,
  description:
    "Use percents of a stated total for several groups, then find the remaining group by subtraction or the difference between two groups.",
};

const tex = (n: number, d: number) =>
  d === 1 ? `${n}` : `$\\frac{${n}}{${d}}$`;

/* ------------------------------------------------------------- fractions */
const fractionAxes = {
  ask: defineAxis("ask", ["remaining-part", "periods-total"] as const),
};
const wholes = [
  { unit: "days", total: "season", a: "sunny", b: "rainy", rest: "snowy" },
  {
    unit: "cookies",
    total: "batch",
    a: "oatmeal",
    b: "chocolate chip",
    rest: "peanut butter",
  },
  {
    unit: "students",
    total: "grade",
    a: "walked to school",
    b: "rode a bus",
    rest: "rode in a car",
  },
  {
    unit: "books",
    total: "shelf",
    a: "mysteries",
    b: "biographies",
    rest: "poetry books",
  },
] as const;
const periods = [
  {
    amount: "A shop earns",
    per: "week",
    unit: "dollars",
    to: "the repair fund",
  },
  {
    amount: "A farm picks",
    per: "day",
    unit: "pounds of apples",
    to: "the juice press",
  },
  {
    amount: "A school collects",
    per: "month",
    unit: "cans of food",
    to: "the food drive truck",
  },
] as const;
const denominators = [2, 3, 4, 5, 6, 8, 10] as const;

interface FractionModel {
  ask: "remaining-part" | "periods-total";
  whole: number;
  k1: number;
  d1: number;
  k2: number;
  d2: number;
  count: number;
  context: number;
}
function fractionModel(
  r: (lo: number, hi: number) => number,
  a: { ask: FractionModel["ask"] },
): FractionModel {
  if (a.ask === "periods-total") {
    const d1 = pick(r, [3, 4, 5, 6, 8] as const);
    const k1 = r(1, d1 - 1);
    if (gcd(k1, d1) !== 1) throw new Error("Need three retries");
    return {
      ask: a.ask,
      whole: d1 * r(12, 120),
      k1,
      d1,
      k2: 0,
      d2: 1,
      count: r(3, 12),
      context: r(0, periods.length - 1),
    };
  }
  for (let tries = 0; tries < 400; tries++) {
    const d1 = pick(r, denominators);
    const d2 = pick(r, denominators);
    const k1 = r(1, d1 - 1);
    const k2 = r(1, d2 - 1);
    const step = (d1 * d2) / gcd(d1, d2);
    const whole = step * r(1, Math.max(1, Math.floor(120 / step)));
    if (whole < 20 || whole > 120) continue;
    if (gcd(k1, d1) !== 1 || gcd(k2, d2) !== 1) continue;
    if ((whole * k1) % d1 || (whole * k2) % d2) continue;
    if (whole - (whole * k1) / d1 - (whole * k2) / d2 < 2) continue;
    return {
      ask: a.ask,
      whole,
      k1,
      d1,
      k2,
      d2,
      count: 0,
      context: r(0, wholes.length - 1),
    };
  }
  throw new Error("Need three retries");
}
export const shareRemainderFractions = chainFamily({
  template: shareRemainderFractionsTemplate,
  axes: fractionAxes,
  model: fractionModel,
  variant: (m) => m.ask,
  render: (m) => {
    if (m.ask === "periods-total") {
      const c = periods[m.context]!;
      const part = (m.whole * m.k1) / m.d1;
      const total = part * m.count;
      return numberSurface({
        prompt: `${c.amount} ${m.whole} ${c.unit} each ${c.per}. It puts ${tex(m.k1, m.d1)} of each ${c.per}'s amount toward ${c.to}. How many ${c.unit} go toward ${c.to} in ${m.count} ${c.per}s?`,
        answer: String(total),
        hint: `Find one ${c.per}'s share first: split ${m.whole} into ${m.d1} equal parts and take ${m.k1} of them.`,
        explanation: [
          `One ${c.per}'s share is ${tex(m.k1, m.d1)} of ${m.whole}: $${m.whole}\\div${m.d1}=${m.whole / m.d1}$ for one part, and $${m.whole / m.d1}\\times${m.k1}=${part}$.`,
          `The share repeats each ${c.per}, so ${m.count} ${c.per}s give $${part}\\times${m.count}=${total}$.`,
          `${total} ${c.unit} go toward ${c.to}.`,
        ],
        label: `Answer (${c.unit})`,
      });
    }
    const c = wholes[m.context]!;
    const a = (m.whole * m.k1) / m.d1;
    const b = (m.whole * m.k2) / m.d2;
    const rest = m.whole - a - b;
    return numberSurface({
      prompt: `Of the ${m.whole} ${c.unit} in the ${c.total}, ${tex(m.k1, m.d1)} were ${c.a} and ${tex(m.k2, m.d2)} were ${c.b}. The rest were ${c.rest}. How many ${c.unit} were ${c.rest}?`,
      answer: String(rest),
      hint: `Begin with the ${c.a} group: split ${m.whole} into ${m.d1} equal parts and take ${m.k1}.`,
      explanation: [
        `${c.a}: ${tex(m.k1, m.d1)} of ${m.whole} is $${m.whole}\\div${m.d1}\\times${m.k1}=${a}$.`,
        `${c.b}: ${tex(m.k2, m.d2)} of ${m.whole} is $${m.whole}\\div${m.d2}\\times${m.k2}=${b}$.`,
        `The rest is what remains of the whole: $${m.whole}-${a}-${b}=${rest}$.`,
        `${rest} ${c.unit} were ${c.rest}.`,
      ],
      label: `Answer (${c.unit})`,
    });
  },
});

/* --------------------------------------------------------------- percent */
const percentAxes = {
  ask: defineAxis("ask", ["difference-of-shares", "remaining-share"] as const),
};
interface PercentModel {
  ask: "difference-of-shares" | "remaining-share";
  total: number;
  shares: [number, number, number, number]; // drive, bus, walk, bike (percent)
}
const totals = [120, 150, 200, 240, 250, 300, 400, 500] as const;
function percentModel(
  r: (lo: number, hi: number) => number,
  a: { ask: PercentModel["ask"] },
): PercentModel {
  for (let tries = 0; tries < 400; tries++) {
    const total = pick(r, totals);
    const p1 = 5 * r(4, 12);
    const p2 = 5 * r(2, 8);
    const p3 = 5 * r(2, 8);
    const p4 = 100 - p1 - p2 - p3;
    if (p4 < 5 || p4 >= p1) continue;
    if ([p1, p2, p3, p4].some((p) => (total * p) % 100)) continue;
    return { ask: a.ask, total, shares: [p1, p2, p3, p4] };
  }
  throw new Error("Need three retries");
}
export const shareRemainderPercent = chainFamily({
  template: shareRemainderPercentTemplate,
  axes: percentAxes,
  model: percentModel,
  variant: (m) => m.ask,
  render: (m) => {
    const [p1, p2, p3, p4] = m.shares;
    const count = (p: number) => (m.total * p) / 100;
    const given = `${p1}% drive, ${p2}% take a bus and ${p3}% walk`;
    const hint = `Add the three given percents first: ${p1}, ${p2} and ${p3}.`;
    const intro = `A survey asked ${m.total} people how they get to work. ${given}. The rest bike.`;
    const common = [
      `The three given shares total $${p1}+${p2}+${p3}=${p1 + p2 + p3}$ percent, so the bike share is $100-${p1 + p2 + p3}=${p4}$ percent.`,
    ];
    if (m.ask === "remaining-share")
      return numberSurface({
        prompt: `${intro} How many of the ${m.total} people bike?`,
        answer: String(count(p4)),
        hint,
        explanation: [
          ...common,
          `${p4}% of ${m.total} is $${m.total}\\times${p4 / 100}=${count(p4)}$.`,
          `${count(p4)} people bike.`,
        ],
        label: "Answer (people)",
      });
    return numberSurface({
      prompt: `${intro} How many more people drive than bike?`,
      answer: String(count(p1) - count(p4)),
      hint,
      explanation: [
        ...common,
        `Drivers: ${p1}% of ${m.total} is $${m.total}\\times${p1 / 100}=${count(p1)}$. Bikers: ${p4}% of ${m.total} is $${m.total}\\times${p4 / 100}=${count(p4)}$.`,
        `The difference is $${count(p1)}-${count(p4)}=${count(p1) - count(p4)}$.`,
        `${count(p1) - count(p4)} more people drive than bike.`,
      ],
      label: "Answer (people)",
    });
  },
});

export const shareRemainderTemplates = [
  shareRemainderFractionsTemplate,
  shareRemainderPercentTemplate,
] as const;
export const shareRemainderGenerate = dispatch(shareRemainderTemplates, {
  "share-remainder-fractions": (seed) =>
    shareRemainderFractions.generate(seed).problem,
  "share-remainder-percent": (seed) =>
    shareRemainderPercent.generate(seed).problem,
});
