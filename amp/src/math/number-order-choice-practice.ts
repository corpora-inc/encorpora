import type { TemplateMetadata } from "./contracts";
import { defineAxis } from "./variation/axes";
import { chainFamily, choiceSurface, dispatch } from "./chain-kit";
import { draw, shuffled } from "./elementary-gap-kit";

const choice = { requiredResponseCapability: "single-choice-v1" } as const;
export const numberBetweenTemplate: TemplateMetadata = {
  id: "number-between-bounds",
  version: 1,
  ...choice,
  title: "A number between two numbers",
  skillId: "large-place-value",
  gradeBand: "3–5",
  difficultyOffset: 0.1,
  description:
    "Choose the whole number that makes a statement with a lower and an upper bound true, for five-digit and seven-digit numbers, against numbers below, above and equal to a bound.",
};
export const trueComparisonTemplate: TemplateMetadata = {
  id: "true-comparison-statement",
  version: 1,
  ...choice,
  title: "Which comparison is true?",
  skillId: "large-place-value",
  gradeBand: "3–5",
  difficultyOffset: 0.2,
  description:
    "Choose the true statement among four that compare whole numbers of five to nine digits that share leading digits, as pairs with greater-than and less-than signs or as three numbers in order.",
};

type R = (lo: number, hi: number) => number;
/** A number with TeX-safe thousands separators: 24{,}350. */
const tex = (n: number) =>
  `$${n.toLocaleString("en-US").replaceAll(",", "{,}")}$`;
const plain = (n: number) => n.toLocaleString("en-US");

/* ----------------------------------------------------------- between */
const betweenAxes = {
  digits: defineAxis("digits", ["five", "seven"] as const),
};
interface BetweenModel {
  digits: "five" | "seven";
  low: number;
  high: number;
  options: {
    n: number;
    kind: "between" | "below" | "above" | "low" | "high";
  }[];
}
export const numberBetween = chainFamily({
  template: numberBetweenTemplate,
  axes: betweenAxes,
  model: (r: R, a): BetweenModel => {
    const scale = a.digits === "five" ? 1 : 100;
    const low = r(12000, 85000) * scale + r(0, 99) * scale;
    const gap = r(400, 9000) * scale;
    const high = low + gap;
    const inside = low + r(Math.floor(gap / 10), Math.floor((gap * 9) / 10));
    const margin = r(Math.floor(gap / 4), gap);
    const options: BetweenModel["options"] = [
      { n: inside, kind: "between" },
      { n: low - margin, kind: "below" },
      { n: high + margin, kind: "above" },
      { n: r(0, 1) ? low : high, kind: r(0, 1) ? "low" : "high" },
    ];
    // The fourth option is a bound itself, so make its kind match its value.
    options[3]!.kind = options[3]!.n === low ? "low" : "high";
    if (
      new Set(options.map((o) => o.n)).size !== 4 ||
      options.some((o) => o.n < 1)
    )
      throw new Error("Need three retries");
    return { digits: a.digits, low, high, options };
  },
  variant: (m) => m.digits,
  render: (m, _a, r) => {
    const stmt = `$${plain(m.low).replaceAll(",", "{,}")}<n<${plain(m.high).replaceAll(",", "{,}")}$`;
    const why = (o: BetweenModel["options"][number]) =>
      o.kind === "below"
        ? `${tex(o.n)} is less than ${tex(m.low)}. Compare the digits from the left: it is too small.`
        : o.kind === "above"
          ? `${tex(o.n)} is greater than ${tex(m.high)}. Compare the digits from the left: it is too large.`
          : `${tex(o.n)} equals one of the two numbers. The signs $<$ mean strictly between, so $n$ cannot be equal to a bound.`;
    const inside = m.options[0]!.n;
    return choiceSurface(r, {
      prompt: `Which value of $n$ makes the statement ${stmt} true?`,
      options: m.options.map((o) =>
        o.kind === "between"
          ? { label: plain(o.n), correct: true as const }
          : { label: plain(o.n), feedback: why(o) },
      ),
      hint: `The value must be greater than ${tex(m.low)} and less than ${tex(m.high)}. Compare each choice with ${tex(m.low)} first, going place by place from the left.`,
      explanation: [
        `$n$ must be greater than ${tex(m.low)} and less than ${tex(m.high)}.`,
        `${tex(inside)} is greater than ${tex(m.low)} and less than ${tex(m.high)}.`,
        "The others are below the lower number, above the upper number, or equal to a bound.",
      ],
    });
  },
});

/* ---------------------------------------------------- true comparison */
const trueAxes = { form: defineAxis("form", ["pair", "order-three"] as const) };
interface TrueModel {
  form: "pair" | "order-three";
  /** pair: four statements [x, y, symbol, true]. order-three: the three numbers. */
  statements: { x: number; y: number; sym: "<" | ">"; ok: boolean }[];
  numbers: number[];
  orders: number[][];
}
/** Numbers of a given length that share leading digits, so place value decides. */
function close(r: R, digits: number): [number, number] {
  const base = r(10 ** (digits - 1), 10 ** digits - 1);
  const cut = r(1, Math.max(1, digits - 2));
  const unit = 10 ** cut;
  const x = base;
  const y = x + r(1, 9) * unit * (r(0, 1) ? 1 : -1);
  if (y < 10 ** (digits - 1) || y >= 10 ** digits || y === x)
    throw new Error("Need three retries");
  return [x, y];
}
export const trueComparison = chainFamily({
  template: trueComparisonTemplate,
  axes: trueAxes,
  model: (r: R, a): TrueModel => {
    if (a.form === "pair") {
      const statements: TrueModel["statements"] = [];
      for (let i = 0; i < 4; i++) {
        const [x, y] = close(r, r(5, 9));
        const truth = x > y ? ">" : "<";
        const ok = i === 0;
        const sym: "<" | ">" = ok ? truth : truth === ">" ? "<" : ">";
        statements.push({ x, y, sym, ok });
      }
      const key = new Set(statements.map((s) => `${s.x}${s.sym}${s.y}`));
      if (key.size !== 4) throw new Error("Need three retries");
      return {
        form: a.form,
        statements: shuffled(r, statements),
        numbers: [],
        orders: [],
      };
    }
    const digits = r(7, 9);
    const [x, y] = close(r, digits);
    // The third number differs from the first in another place.
    const z = x + r(1, 9) * 10 ** r(1, digits - 2) * (r(0, 1) ? 1 : -1);
    if (z < 10 ** (digits - 1) || z >= 10 ** digits)
      throw new Error("Need three retries");
    const nums = [...new Set([x, y, z])];
    if (nums.length !== 3) throw new Error("Need three retries");
    const sorted = [...nums].sort((p, q) => p - q);
    const perms = [
      [0, 1, 2],
      [0, 2, 1],
      [1, 0, 2],
      [1, 2, 0],
      [2, 0, 1],
      [2, 1, 0],
    ].map((p) => p.map((i) => sorted[i]!));
    const right = perms[0]!;
    const wrong = draw(r, perms.slice(1), 3);
    return {
      form: a.form,
      statements: [],
      numbers: sorted,
      orders: shuffled(r, [right, ...wrong]),
    };
  },
  variant: (m) => m.form,
  render: (m, _a, r) => {
    if (m.form === "pair") {
      const label = (s: TrueModel["statements"][number]) =>
        `$${plain(s.x).replaceAll(",", "{,}")}${s.sym}${plain(s.y).replaceAll(",", "{,}")}$`;
      const correct = m.statements.find((s) => s.ok)!;
      return choiceSurface(r, {
        prompt: "Which comparison is true?",
        options: m.statements.map((s) =>
          s.ok
            ? { label: label(s), correct: true as const }
            : {
                label: label(s),
                feedback: `Compare ${tex(s.x)} and ${tex(s.y)} from the left: the first place where the digits differ shows that ${tex(Math.max(s.x, s.y))} is the greater number, so the sign in this statement points the wrong way.`,
              },
        ),
        hint: `Take the statement with ${tex(m.statements[0]!.x)} and ${tex(m.statements[0]!.y)}: write the digits in line by place and find the first place from the left where they are different.`,
        explanation: [
          `For each statement, compare the digits from the left. The first place where they differ decides which number is greater.`,
          `${tex(correct.x)} ${correct.sym === ">" ? "is greater than" : "is less than"} ${tex(correct.y)}, so ${label(correct)} is true.`,
          "In each other statement the sign points the wrong way.",
        ],
      });
    }
    const [lo, mid, hi] = m.numbers as [number, number, number];
    const label = (o: number[]) =>
      `$${o.map((v) => plain(v).replaceAll(",", "{,}")).join("<")}$`;
    return choiceSurface(r, {
      prompt: `Which statement puts these numbers in order from least to greatest? The numbers are ${shuffled(r, [lo, mid, hi]).map(plain).join(", ")}.`,
      options: m.orders.map((o) =>
        o[0] === lo && o[1] === mid && o[2] === hi
          ? { label: label(o), correct: true as const }
          : {
              label: label(o),
              feedback: `In this order ${plain(o.find((v, i) => i > 0 && v < o[i - 1]!) ?? o[2]!)} comes after a number that is greater than it. Compare the numbers from the left, place by place.`,
            },
      ),
      hint: `Compare ${plain(lo)} and ${plain(hi)} from the left, place by place, and find the first place where the digits differ. Then place the third number.`,
      explanation: [
        "Compare the numbers from the left. The number with the smaller digit in the first place that differs is the smaller number.",
        `The order from least to greatest is ${plain(lo)}, ${plain(mid)}, ${plain(hi)}.`,
        "The other statements put a greater number before a smaller one.",
      ],
    });
  },
});

export const numberOrderTemplates = [
  numberBetweenTemplate,
  trueComparisonTemplate,
] as const;
export const numberOrderGenerate = dispatch(numberOrderTemplates, {
  "number-between-bounds": (seed) => numberBetween.generate(seed).problem,
  "true-comparison-statement": (seed) => trueComparison.generate(seed).problem,
});
