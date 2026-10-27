import type { TemplateMetadata } from "./contracts";
import { defineAxis } from "./variation/axes";
import {
  defineGenerate,
  entry,
  frac,
  gcd,
  grouped,
  multiPartCapability,
  multiPartProblem,
  need,
  pick,
  plain,
  shuffle,
  type Random,
  type Slot,
} from "./multi-part-support";

/** Put numbers in order by choosing the number for each position
 * (multi-part-choice-v1, labeled slots): the accessible form of dragging
 * numbers into ordered slots. Every slot offers every number, so a position
 * is right only when the number belongs there. */
export const numberOrderSlotsTemplates: readonly TemplateMetadata[] = [
  {
    id: "order-whole-numbers-slots",
    version: 1,
    title: "Order whole numbers into places",
    skillId: "large-place-value",
    gradeBand: "3–5",
    ...multiPartCapability,
    description:
      "Compare three five-digit numbers from the left, where the first difference can sit in the ten-thousands, thousands or hundreds place, and choose the item for the smallest, middle and greatest position in either order.",
  },
  {
    id: "order-fractions-slots",
    version: 1,
    title: "Order three fractions into places",
    skillId: "fraction-comparison",
    gradeBand: "3–5",
    ...multiPartCapability,
    description:
      "Order three fractions with a common denominator, a common numerator, or a half as the benchmark, from least to greatest or from greatest to least, by choosing the fraction for each position.",
  },
  {
    id: "order-rationals-slots",
    version: 1,
    title: "Order signed decimals and fractions",
    skillId: "absolute-value",
    gradeBand: "6–8",
    ...multiPartCapability,
    description:
      "Order four or five signed numbers written as decimals and fractions, from least to greatest or greatest to least, by choosing the number for each position; distractors are the order of absolute values and the order of the written digits.",
  },
];

const orderAxis = defineAxis("order", [
  "least-first",
  "greatest-first",
] as const);

const POSITIONS = {
  "least-first": [
    "Least",
    "Second least",
    "Middle",
    "Second greatest",
    "Greatest",
  ],
  "greatest-first": [
    "Greatest",
    "Second greatest",
    "Middle",
    "Second least",
    "Least",
  ],
} as const;
/** Position labels for `n` slots, ending at the extreme. */
const positionLabels = (n: number, order: keyof typeof POSITIONS) => {
  const all = POSITIONS[order];
  if (n === 5) return [...all];
  if (n === 4)
    return order === "least-first"
      ? ["Least", "Second least", "Second greatest", "Greatest"]
      : ["Greatest", "Second greatest", "Second least", "Least"];
  return [all[0], all[2], all[4]] as string[];
};

/* ---------- whole numbers ---------- */
const VENUES = [
  "Harbor Field",
  "Summit Park",
  "Ridge Stadium",
  "Meadow Arena",
  "Canyon Dome",
  "Lakeside Grounds",
] as const;
export const wholeAxes = {
  "first-difference": defineAxis("first-difference", [
    "ten-thousands",
    "thousands",
    "hundreds",
  ] as const),
  order: orderAxis,
} as const;
const PLACE_INDEX = { "ten-thousands": 0, thousands: 1, hundreds: 2 } as const;

function wholeNumbers(r: Random, place: keyof typeof PLACE_INDEX) {
  const at = PLACE_INDEX[place];
  const prefix = Array.from({ length: at }, (_, i) =>
    i === 0 ? r(1, 8) : r(0, 9),
  );
  const digits = shuffle(r, [1, 2, 3, 4, 5, 6, 7, 8, 9])
    .slice(0, 3)
    .sort((a, b) => a - b);
  const values = digits.map((d) => {
    const rest = Array.from({ length: 4 - at }, () => r(0, 9));
    return Number([...prefix, d, ...rest].join(""));
  });
  // The least number should end in larger digits than the greatest, so that
  // reading from the right gives the wrong order.
  need(values[0]! % 1000 > values[2]! % 1000 || at === 2, "a trailing trap");
  need(new Set(values).size === 3, "three different numbers");
  return values;
}

/* ---------- fractions ---------- */
type Fraction = { n: number; d: number };
const cmp = (a: Fraction, b: Fraction) => a.n * b.d - b.n * a.d;
const tex = (f: Fraction) => `$${frac(f.n, f.d)}$`;
const chain = (fs: readonly Fraction[]) =>
  `$${fs.map((f) => frac(f.n, f.d)).join("<")}$`;
const list = (items: readonly string[]) =>
  items.length < 2
    ? items.join("")
    : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
const dec = (n: number) => String(Math.round(n * 1e6) / 1e6);
export const fractionAxes = {
  basis: defineAxis("basis", [
    "common-denominator",
    "common-numerator",
    "benchmark-half",
  ] as const),
  order: orderAxis,
} as const;
type Basis = (typeof fractionAxes.basis.values)[number];
function threeFractions(r: Random, basis: Basis): Fraction[] {
  let items: Fraction[];
  if (basis === "common-denominator") {
    const d = r(6, 12);
    items = shuffle(
      r,
      Array.from({ length: d - 1 }, (_, i) => i + 1),
    )
      .slice(0, 3)
      .map((n) => ({ n, d }));
  } else if (basis === "common-numerator") {
    const n = r(1, 5);
    items = shuffle(
      r,
      Array.from({ length: 8 }, (_, i) => n + 1 + i),
    )
      .slice(0, 3)
      .map((d) => ({ n, d }));
  } else {
    const dHalf = pick(r, [4, 6, 8, 10]);
    const others = shuffle(
      r,
      [3, 5, 7, 9, 12].filter((d) => d !== dHalf),
    );
    const dBelow = others[0]!;
    const dAbove = others[1]!;
    items = [
      { n: dHalf / 2, d: dHalf },
      { n: r(1, Math.ceil(dBelow / 2) - 1), d: dBelow },
      { n: r(Math.floor(dAbove / 2) + 1, dAbove - 1), d: dAbove },
    ];
  }
  need(
    items.every((a, i) => items.every((b, j) => i === j || cmp(a, b) !== 0)),
    "different values",
  );
  return items;
}

/* ---------- signed decimals and fractions ---------- */
type Signed = { tex: string; value: number };
export const rationalAxes = {
  count: defineAxis("count", ["four", "five"] as const),
  order: orderAxis,
} as const;
const DECIMALS = [0.2, 0.25, 0.4, 0.6, 0.75, 0.8, 1.2, 1.5, 1.75, 2.5];
const FRACTIONS = [
  [1, 2],
  [1, 4],
  [3, 4],
  [2, 5],
  [3, 5],
  [1, 5],
  [5, 4],
  [3, 2],
  [7, 4],
  [4, 5],
] as const;
function signedValues(r: Random, count: number): Signed[] {
  const pool: Signed[] = shuffle(r, [
    ...DECIMALS.map((v) => ({ tex: plain(v), value: v })),
    ...FRACTIONS.map(([n, d]) => ({ tex: `\\frac{${n}}{${d}}`, value: n / d })),
  ]);
  const chosen: Signed[] = [];
  for (const item of pool)
    if (chosen.every((c) => Math.abs(c.value - item.value) > 1e-9))
      chosen.push(item);
  const negatives = r(2, count - 1);
  const items = chosen
    .slice(0, count)
    .map((c, i) => (i < negatives ? { tex: `-${c.tex}`, value: -c.value } : c));
  need(
    items.some((s) => s.tex.includes("frac")) &&
      items.some((s) => !s.tex.includes("frac")),
    "decimals and fractions together",
  );
  // The order of absolute values must differ from the true order.
  const byValue = [...items].sort((a, b) => a.value - b.value);
  const byAbs = [...items].sort(
    (a, b) => Math.abs(b.value) - Math.abs(a.value),
  );
  need(
    byValue.some((s, i) => s !== byAbs[i]),
    "a different order of absolute values",
  );
  return shuffle(r, items);
}

function slotsFor(
  labels: readonly string[],
  ordered: readonly string[],
  bank: readonly string[],
  what: string,
): Slot[] {
  return labels.map((label, i) => ({
    id: `p${i + 1}`,
    label: `${label} ${what}`,
    correct: ordered[i]!,
    fixed: bank,
  }));
}
const direction = (
  order: keyof typeof POSITIONS,
  small: string,
  large: string,
) =>
  order === "least-first"
    ? `from ${small} to ${large}`
    : `from ${large} to ${small}`;

export const numberOrderSlotsAxes = {
  "order-whole-numbers-slots": wholeAxes,
  "order-fractions-slots": fractionAxes,
  "order-rationals-slots": rationalAxes,
} as const;

export const numberOrderSlotsGenerate = defineGenerate(
  numberOrderSlotsTemplates,
  {
    "order-whole-numbers-slots": entry(wholeAxes, ({ meta, seed, r, axes }) => {
      const place = axes["first-difference"];
      const values = wholeNumbers(r, place);
      const names = shuffle(r, [...VENUES]).slice(0, 3);
      const shown = shuffle(r, [0, 1, 2]).map((k, i) => ({
        name: names[i]!,
        value: values[k]!,
      }));
      const ascending = [...shown].sort((a, b) => a.value - b.value);
      const ordered =
        axes.order === "least-first" ? ascending : [...ascending].reverse();
      const at = PLACE_INDEX[place];
      const digitsAt = ascending.map((v) => String(v.value)[at]!);
      const placeName = place.replace("-", " ");
      const prefix = String(ascending[0]!.value).slice(0, at);
      return multiPartProblem(meta, seed, r, {
        prompt: `Three stadiums hold crowds of different sizes: ${shown.map((v) => `${v.name} holds ${grouped(v.value)} people`).join("; ")}. Put the stadiums in order ${direction(axes.order, "the smallest capacity", "the greatest capacity")}.`,
        layout: "slots",
        label: "Choose the stadium for each position",
        slots: slotsFor(
          positionLabels(3, axes.order),
          ordered.map((v) => v.name),
          shown.map((v) => v.name),
          "capacity",
        ),
        hint: `Write ${grouped(shown[0]!.value)} and ${grouped(shown[1]!.value)} one above the other and compare their digits from the left. The first place where the digits differ decides which number is greater.`,
        explanation: [
          prefix
            ? `All three numbers begin with ${prefix}, so compare the digits in the ${placeName} place.`
            : `Compare the digits in the ${placeName} place, the leftmost place.`,
          `The ${placeName} digits are ${list(digitsAt)}, so from smallest to greatest the capacities are ${ascending.map((v) => grouped(v.value)).join(" < ")}.`,
          `${axes.order === "least-first" ? "Smallest to greatest" : "Greatest to smallest"}: ${ordered.map((v) => v.name).join(", ")}.`,
        ],
      });
    }),
    "order-fractions-slots": entry(fractionAxes, ({ meta, seed, r, axes }) => {
      const shown = threeFractions(r, axes.basis);
      const ascending = [...shown].sort(cmp);
      const ordered =
        axes.order === "least-first" ? ascending : [...ascending].reverse();
      const explain =
        axes.basis === "common-denominator"
          ? `The denominators are all ${shown[0]!.d}, so the parts are the same size and the fraction with more parts is greater: ${chain(ascending)}.`
          : axes.basis === "common-numerator"
            ? `The numerators are all ${shown[0]!.n}, so each fraction has the same number of parts, and a larger denominator means smaller parts: ${chain(ascending)}.`
            : `Compare each fraction with $\\frac{1}{2}$: ${shown.map((f) => `${tex(f)} is ${cmp(f, { n: 1, d: 2 }) === 0 ? "equal to" : cmp(f, { n: 1, d: 2 }) < 0 ? "less than" : "greater than"} one half`).join("; ")}. So ${chain(ascending)}.`;
      return multiPartProblem(meta, seed, r, {
        prompt: `Put these three fractions in order ${direction(axes.order, "least", "greatest")}: ${shown.map(tex).join(", ")}.`,
        layout: "slots",
        label: "Choose the fraction for each position",
        slots: slotsFor(
          positionLabels(3, axes.order),
          ordered.map(tex),
          shown.map(tex),
          "fraction",
        ),
        hint:
          axes.basis === "common-denominator"
            ? `The fractions have the same denominator, ${shown[0]!.d}. Think about what the numerators ${shown.map((f) => f.n).join(", ")} count.`
            : axes.basis === "common-numerator"
              ? `The fractions have the same numerator, ${shown[0]!.n}. Compare the size of the parts that the denominators ${shown.map((f) => f.d).join(", ")} make.`
              : `Compare each fraction with $\\frac{1}{2}$ first. For ${tex(shown[0]!)}, ask how many parts make half of ${shown[0]!.d} parts.`,
        explanation: [
          explain,
          `${axes.order === "least-first" ? "Least to greatest" : "Greatest to least"}: ${ordered.map(tex).join(", ")}.`,
        ],
      });
    }),
    "order-rationals-slots": entry(rationalAxes, ({ meta, seed, r, axes }) => {
      const count = axes.count === "five" ? 5 : 4;
      const shown = signedValues(r, count);
      const ascending = [...shown].sort((a, b) => a.value - b.value);
      const ordered =
        axes.order === "least-first" ? ascending : [...ascending].reverse();
      const t = (s: Signed) => `$${s.tex}$`;
      const negatives = shown.filter((s) => s.value < 0);
      return multiPartProblem(meta, seed, r, {
        prompt: `Put these numbers in order ${direction(axes.order, "least", "greatest")}: ${shown.map(t).join(", ")}.`,
        layout: "slots",
        label: "Choose the number for each position",
        slots: slotsFor(
          positionLabels(count, axes.order),
          ordered.map(t),
          shown.map(t),
          "number",
        ),
        hint: `Sort by sign first: ${list(negatives.map(t))} are left of zero. Of two negative numbers, the one farther from zero is the lesser.`,
        explanation: [
          `Write every number as a decimal: ${list(shown.map((s) => s.tex.includes("frac") ? `$${s.tex}=${dec(s.value)}$` : `$${s.tex}$`))}.`,
          `Farther left on the number line means lesser. In order from least to greatest: $${ascending.map((s) => dec(s.value)).join("<")}$.`,
          `${axes.order === "least-first" ? "Least to greatest" : "Greatest to least"}: ${ordered.map(t).join(", ")}.`,
        ],
      });
    }),
  },
);
