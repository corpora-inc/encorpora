import type { SemanticFigure, TemplateMetadata } from "./contracts";
import { lineTable } from "./scene/author";
import { defineAxis } from "./variation/axes";
import {
  defineGenerate,
  entry,
  frac,
  gcd,
  grouped,
  inlineSentence,
  multiPartCapability,
  multiPartProblem,
  need,
  pick,
  plain,
  shuffle,
  slotOf,
  type Slot,
} from "./multi-part-support";

/** Two or more related quantities from one situation, each chosen in its
 * own gap of a sentence or its own slot (multi-part-choice-v1): the quotient
 * and the remainder, a mean and a median, an interest and a total. Every
 * blank offers the value a named slip produces. */
const tables = { requiredFigureCapability: "scenes-v1" as const };
export const quantityPairBlanksTemplates: readonly TemplateMetadata[] = [
  {
    id: "quotient-remainder-blanks",
    version: 1,
    title: "Full groups and what is left over",
    skillId: "multidigit-quotients",
    gradeBand: "3–5",
    ...multiPartCapability,
    description:
      "Divide a total of up to 999 by a two-digit group size and choose both the number of full groups and the number left over, with the quotient plus one and the group size minus the remainder as distractors.",
  },
  {
    id: "meters-to-kilometers-blanks",
    version: 1,
    title: "Add meters and write kilometers and meters",
    skillId: "measurement-conversions",
    gradeBand: "3–5",
    ...multiPartCapability,
    description:
      "Add three distances in meters whose total is between 1,000 and 3,000 and choose the whole kilometers and the meters left, with the digits of the total regrouped wrongly as distractors.",
  },
  {
    id: "simple-interest-blanks",
    version: 1,
    title: "Simple interest and the total",
    skillId: "percent-change",
    gradeBand: "6–8",
    ...multiPartCapability,
    description:
      "Find the simple interest $I = Prt$ for two to six years and the total amount repaid or earned, choosing both; distractors are one year of interest, the principal alone and interest added to the wrong amount.",
  },
  {
    id: "loan-offer-compare-blanks",
    version: 1,
    title: "Compare two loan offers",
    skillId: "percent-change",
    gradeBand: "6–8",
    ...multiPartCapability,
    description:
      "Compare the simple interest on two loan offers with different rates and times and choose which bank costs less and by how much.",
  },
  {
    id: "scale-factor-effects-blanks",
    version: 1,
    title: "How perimeter and area change under a dilation",
    skillId: "dilations-similarity",
    gradeBand: "6–8",
    ...multiPartCapability,
    description:
      "For a rectangle dilated by a whole-number or unit-fraction scale factor, choose the factor that multiplies the perimeter and the factor that multiplies the area.",
  },
  {
    id: "expected-count-blanks",
    version: 1,
    title: "Probability and expected count",
    skillId: "probability",
    gradeBand: "6–8",
    ...multiPartCapability,
    description:
      "For a spinner with ten equal sections, choose the probability of landing on a number and the number of times it is expected in a stated number of spins.",
  },
  {
    id: "unit-rate-pair-blanks",
    version: 1,
    title: "Two unit rates",
    skillId: "unit-rates",
    gradeBand: "6–8",
    ...multiPartCapability,
    description:
      "Find two unit rates, such as pages per minute in black and white and in color, from two totals and two times, choosing the decimal rate for each gap.",
  },
  {
    id: "ratio-pair-blanks",
    version: 1,
    title: "A part and the whole from a ratio",
    skillId: "ratios",
    gradeBand: "6–8",
    ...multiPartCapability,
    description:
      "From a ratio of two colors and the count of one color, choose the count of the other color and the total.",
  },
  {
    id: "mean-median-blanks",
    version: 1,
    title: "Mean and median of six values",
    skillId: "statistics-mean",
    gradeBand: "6–8",
    ...multiPartCapability,
    description:
      "Find the mean and the median of six decimal values listed out of order, choosing both; distractors are the middle of the unsorted list and the mean of five values.",
  },
  {
    id: "median-mode-compare-blanks",
    version: 1,
    title: "Compare two medians and two modes",
    skillId: "compare-distributions",
    gradeBand: "6–8",
    ...multiPartCapability,
    description:
      "Compare the medians of two lists of seven values and say whether their modes match, completing a two-gap sentence.",
  },
  {
    id: "rectangle-chain-blanks",
    version: 1,
    title: "Length from area, then perimeter",
    skillId: "area-perimeter-models",
    gradeBand: "3–5",
    ...multiPartCapability,
    description:
      "Find a rectangle's length from its area and width, then its perimeter, and choose both values.",
  },
  {
    id: "wage-and-cost-blanks",
    version: 1,
    title: "Hourly wage and starting cost from a table",
    skillId: "linear-models",
    gradeBand: "6–8",
    ...multiPartCapability,
    ...tables,
    description:
      "From a table of hours and net pay that starts below zero, choose the hourly wage and the amount spent before the first hour.",
  },
  {
    id: "percent-amounts-blanks",
    version: 1,
    title: "Two percents of a whole",
    skillId: "percentages",
    gradeBand: "6–8",
    ...multiPartCapability,
    description:
      "Find two percents of one whole as counts of items, or as budget amounts that are each compared with a stated limit.",
  },
  {
    id: "check-register-blanks",
    version: 1,
    title: "Complete a check register",
    skillId: "rational-stories",
    gradeBand: "6–8",
    ...multiPartCapability,
    ...tables,
    description:
      "Complete a four-line check register with deposits and withdrawals by choosing two missing balances and two missing amounts, including balances below zero.",
  },
];

const reducedTex = (n: number, d: number) => {
  const g = gcd(n, d) || 1;
  return d / g === 1 ? String(n / g) : `$${frac(n / g, d / g)}$`;
};
/** A value with at most two decimals. */
const short = (n: number) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-9;
const dec = (n: number) => plain(Math.round(n * 1e6) / 1e6);
const tableFigure = (
  rows: string[][],
  title: string,
  header: "column" | "row" = "column",
): SemanticFigure => ({
  kind: "scene",
  scene: lineTable(rows, { header }).scene({ title }),
});

/* ---------- quotient and remainder ---------- */
export const quotientRemainderAxes = {
  story: defineAxis("story", [
    "bags-of-candy",
    "boxes-of-pencils",
    "rows-of-chairs",
  ] as const),
} as const;
const STORIES = {
  "bags-of-candy": { thing: "candies", group: "bags", filled: "full bags" },
  "boxes-of-pencils": {
    thing: "pencils",
    group: "boxes",
    filled: "full boxes",
  },
  "rows-of-chairs": { thing: "chairs", group: "rows", filled: "full rows" },
} as const;

/* ---------- kilometers and meters ---------- */
export const kilometersAxes = {
  context: defineAxis("context", ["trail", "bike-ride", "parade"] as const),
} as const;
const KM_CONTEXT = {
  trail: ["A hiker walks three parts of a trail", "walks"],
  "bike-ride": ["A cyclist rides three parts of a route", "rides"],
  parade: ["A parade passes three blocks", "marches"],
} as const;

/* ---------- simple interest ---------- */
export const interestAxes = {
  term: defineAxis("term", ["short", "long"] as const),
} as const;
export const loanAxes = {
  cheaper: defineAxis("cheaper", ["first", "second"] as const),
} as const;

/* ---------- dilation effects ---------- */
export const scaleEffectAxes = {
  scale: defineAxis("scale", ["enlargement", "reduction"] as const),
} as const;

/* ---------- expected count ---------- */
export const expectedAxes = {
  sections: defineAxis("sections", [
    "one-section",
    "several-sections",
  ] as const),
} as const;

/* ---------- unit rates ---------- */
export const unitRatePairAxes = {
  context: defineAxis("context", [
    "pages-printed",
    "laps-swum",
    "bottles-filled",
  ] as const),
} as const;
const RATE_CONTEXT = {
  "pages-printed": [
    "A printer prints",
    "pages",
    "in black and white",
    "in color",
  ],
  "laps-swum": [
    "A swimmer swims",
    "laps",
    "doing freestyle",
    "doing backstroke",
  ],
  "bottles-filled": ["A machine fills", "bottles", "with juice", "with water"],
} as const;

/* ---------- ratio ---------- */
export const ratioPairAxes = {
  order: defineAxis("order", ["blue-to-yellow", "yellow-to-blue"] as const),
} as const;

/* ---------- mean and median ---------- */
export const meanMedianAxes = {
  repeats: defineAxis("repeats", ["with-repeat", "all-different"] as const),
} as const;

/* ---------- compare two lists ---------- */
export const medianModeAxes = {
  medians: defineAxis("medians", [
    "first-greater",
    "second-greater",
    "equal",
  ] as const),
  modes: defineAxis("modes", ["match", "differ"] as const),
} as const;

/* ---------- rectangle ---------- */
export const rectangleChainAxes = {
  unit: defineAxis("unit", ["centimeters", "meters", "feet"] as const),
} as const;

/* ---------- wage ---------- */
export const wageAxes = {
  hours: defineAxis("hours", ["consecutive", "every-other"] as const),
} as const;

/* ---------- percents ---------- */
export const percentAmountsAxes = {
  form: defineAxis("form", ["group-counts", "budget-limits"] as const),
} as const;

/* ---------- register ---------- */
export const registerAxes = {
  start: defineAxis("start", ["positive-balance", "overdrawn"] as const),
} as const;

export const quantityPairBlanksAxes = {
  "quotient-remainder-blanks": quotientRemainderAxes,
  "meters-to-kilometers-blanks": kilometersAxes,
  "simple-interest-blanks": interestAxes,
  "loan-offer-compare-blanks": loanAxes,
  "scale-factor-effects-blanks": scaleEffectAxes,
  "expected-count-blanks": expectedAxes,
  "unit-rate-pair-blanks": unitRatePairAxes,
  "ratio-pair-blanks": ratioPairAxes,
  "mean-median-blanks": meanMedianAxes,
  "median-mode-compare-blanks": medianModeAxes,
  "rectangle-chain-blanks": rectangleChainAxes,
  "wage-and-cost-blanks": wageAxes,
  "percent-amounts-blanks": percentAmountsAxes,
  "check-register-blanks": registerAxes,
} as const;

const median = (values: readonly number[]) => {
  const s = [...values].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};
/** The modes of a list: values with the greatest count. */
const modesOf = (values: readonly number[]) => {
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  const top = Math.max(...counts.values());
  return [...counts].filter(([, c]) => c === top).map(([v]) => v);
};

export const quantityPairBlanksGenerate = defineGenerate(
  quantityPairBlanksTemplates,
  {
    "quotient-remainder-blanks": entry(
      quotientRemainderAxes,
      ({ meta, seed, r, axes }) => {
        const story = STORIES[axes.story];
        const size = r(12, 48);
        const q = r(5, Math.min(60, Math.floor(950 / size)));
        const rem = r(2, size - 1);
        const total = size * q + rem;
        need(total <= 999 && rem !== q && size !== q, "a total below 1,000");
        const built = inlineSentence([
          `The ${story.thing} fill `,
          slotOf("full", `The number of ${story.filled}`, q, [
            q + 1,
            q - 1,
            rem,
            size - rem,
            Math.round(total / size) + 1,
          ]),
          ` ${story.filled} with `,
          slotOf("left", "The number left over", rem, [
            size - rem,
            rem + 1,
            q,
            rem - 1,
            size,
          ]),
          " left over.",
        ]);
        return multiPartProblem(meta, seed, r, {
          prompt: `${total} ${story.thing} are packed into ${story.group} that each hold ${size}. As many ${story.group} as possible are filled. Complete the sentence.`,
          layout: "inline",
          label: "Choose a number for each gap",
          slots: built.slots,
          sentence: built.sentence,
          hint: `Find how many groups of ${size} fit in ${total}: estimate with tens, such as ${size} times ${[Math.floor((q - 1) / 10) * 10, 10, 5, 2].find((n) => n >= 2 && n !== q && n !== rem)}, then adjust. The leftover is what remains after those groups are removed.`,
          explanation: [
            `Divide ${total} by ${size}: $${total}\\div ${size}=${q}$ with a remainder, because $${size}\\times ${q}=${size * q}$.`,
            `The leftover is $${total}-${size * q}=${rem}$, which is less than ${size}, so no more full group fits.`,
            `So ${q} ${story.filled} are filled and ${rem} are left over.`,
          ],
        });
      },
    ),

    "meters-to-kilometers-blanks": entry(
      kilometersAxes,
      ({ meta, seed, r, axes }) => {
        const [lead, verb] = KM_CONTEXT[axes.context];
        const parts = [r(300, 990), r(300, 990), r(300, 990)];
        const total = parts.reduce((s, v) => s + v, 0);
        need(
          total > 2000 &&
            total < 3000 &&
            total % 1000 !== 0 &&
            total % 100 !== 0 &&
            total % 1000 > 1,
          "a regrouped total",
        );
        const km = Math.floor(total / 1000);
        const m = total % 1000;
        const built = inlineSentence([
          "The three distances total ",
          slotOf(
            "km",
            "The number of whole kilometers",
            km,
            [km + 1, km - 1, Math.floor(total / 100), 3, km + 2].filter(
              (x) => x > 0,
            ),
          ),
          " kilometers and ",
          slotOf(
            "m",
            "The number of meters left over",
            m,
            [
              1000 - m,
              total - 1000 * (km + 1),
              m + 100,
              Math.floor(m / 10),
              total,
            ].filter((x) => x > 0),
          ),
          " meters.",
        ]);
        return multiPartProblem(meta, seed, r, {
          prompt: `${lead}: ${parts[0]} meters, ${parts[1]} meters and ${parts[2]} meters. Complete the sentence with the total distance in kilometers and meters.`,
          layout: "inline",
          label: "Choose a number for each gap",
          slots: built.slots,
          sentence: built.sentence,
          hint: `Add ${parts[0]} and ${parts[1]} first, then ${parts[2]}. Every 1,000 meters is 1 kilometer, so see how many thousands are in the sum and how many meters remain.`,
          explanation: [
            `Add the distances: $${parts[0]}+${parts[1]}+${parts[2]}=${total}$ meters.`,
            `Since $1{,}000$ meters make 1 kilometer, $${total}=${km}\\times 1{,}000+${m}$.`,
            `The total is ${km} kilometers and ${m} meters.`,
          ],
        });
      },
    ),

    "simple-interest-blanks": entry(interestAxes, ({ meta, seed, r, axes }) => {
      const principal = r(2, 20) * 100;
      const rate = r(2, 9);
      const years = axes.term === "short" ? r(2, 3) : r(4, 6);
      const interest = (principal * rate * years) / 100;
      need(
        Number.isInteger(interest) && interest !== principal,
        "whole-dollar interest",
      );
      const total = principal + interest;
      const oneYear = (principal * rate) / 100;
      const built = inlineSentence([
        "The interest is ",
        slotOf(
          "interest",
          "The interest in dollars",
          interest,
          [
            oneYear,
            principal * years,
            interest + principal,
            principal * rate,
            interest / years + years,
          ].map((x) => Math.round(x)),
        ),
        " dollars, and the total amount is ",
        slotOf(
          "total",
          "The total in dollars",
          total,
          [
            interest,
            principal,
            principal + oneYear,
            total + interest,
            principal - interest,
          ].filter((x) => x > 0),
        ),
        " dollars.",
      ]);
      return multiPartProblem(meta, seed, r, {
        prompt: `A savings account earns ${rate}% simple interest each year. ${grouped(principal)} dollars is deposited and left for ${years} years. Complete the sentence.`,
        layout: "inline",
        label: "Choose a number for each gap",
        slots: built.slots,
        sentence: built.sentence,
        hint: `Simple interest is the principal times the rate times the number of years. Write ${rate}% as a decimal and multiply by ${grouped(principal)} and by ${years}; the total also includes the original deposit.`,
        explanation: [
          `One year earns $${grouped(principal)}\\times ${frac(rate, 100)}=${grouped(oneYear)}$ dollars.`,
          `For ${years} years the interest is $${oneYear}\\times ${years}=${grouped(interest)}$ dollars.`,
          `The total amount is the deposit plus the interest: $${grouped(principal)}+${grouped(interest)}=${grouped(total)}$ dollars.`,
        ],
      });
    }),

    "loan-offer-compare-blanks": entry(loanAxes, ({ meta, seed, r, axes }) => {
      const principal = r(5, 30) * 100;
      const offer = () => ({ rate: r(3, 9), years: r(2, 6) });
      const a = offer();
      const b = offer();
      const cost = (o: { rate: number; years: number }) =>
        (principal * o.rate * o.years) / 100;
      const [ca, cb] = [cost(a), cost(b)];
      need(
        Number.isInteger(ca) && Number.isInteger(cb) && ca !== cb,
        "different costs",
      );
      need(
        axes.cheaper === "first" ? ca < cb : cb < ca,
        "the stated cheaper bank",
      );
      const diff = Math.abs(ca - cb);
      const winner = axes.cheaper === "first" ? "Harbor Bank" : "Summit Bank";
      const bank = {
        id: "bank",
        label: "The bank that costs less",
        correct: winner,
        fixed: ["Harbor Bank", "Summit Bank"],
      } as Slot;
      const built = inlineSentence([
        bank,
        " costs less, by ",
        slotOf(
          "diff",
          "How much less in dollars",
          diff,
          [
            ca,
            cb,
            ca + cb,
            (Math.abs(a.rate - b.rate) * principal) / 100,
            diff + 100,
          ].map(Math.round),
        ),
        " dollars.",
      ]);
      return multiPartProblem(meta, seed, r, {
        prompt: `A family borrows ${grouped(principal)} dollars. Harbor Bank charges ${a.rate}% simple interest per year for ${a.years} years. Summit Bank charges ${b.rate}% simple interest per year for ${b.years} years. Complete the sentence about which bank costs less.`,
        layout: "inline",
        label: "Choose a bank and an amount",
        slots: built.slots,
        sentence: built.sentence,
        hint: `Find the interest at Harbor Bank first: ${grouped(principal)} times ${a.rate}% times ${a.years} years. Then find the interest at Summit Bank the same way and compare the two amounts.`,
        explanation: [
          `Harbor Bank: $${grouped(principal)}\\times ${frac(a.rate, 100)}\\times ${a.years}=${grouped(ca)}$ dollars.`,
          `Summit Bank: $${grouped(principal)}\\times ${frac(b.rate, 100)}\\times ${b.years}=${grouped(cb)}$ dollars.`,
          `${winner} costs less, by $${grouped(Math.max(ca, cb))}-${grouped(Math.min(ca, cb))}=${grouped(diff)}$ dollars.`,
        ],
      });
    }),

    "scale-factor-effects-blanks": entry(
      scaleEffectAxes,
      ({ meta, seed, r, axes }) => {
        const enlarge = axes.scale === "enlargement";
        const k: [number, number] = enlarge ? [r(2, 5), 1] : [1, r(2, 4)];
        const label = (n: number, d: number) =>
          d === 1 ? String(n) : `$${frac(n, d)}$`;
        const kk: [number, number] = [k[0] * k[0], k[1] * k[1]];
        const pool = [
          label(k[0], k[1]),
          label(kk[0], kk[1]),
          label(k[0] * 2, k[1]),
          label(k[0] + 1, k[1]),
          label(kk[0] * k[0], kk[1] * k[1]),
        ];
        const w = enlarge ? r(2, 8) : r(1, 6) * k[1];
        const l = enlarge ? r(2, 9) : r(1, 6) * k[1];
        need(w !== l, "different sides");
        const built = inlineSentence([
          "The perimeter of the image is ",
          slotOf(
            "perim",
            "The factor for the perimeter",
            label(k[0], k[1]),
            pool,
          ),
          " times the perimeter of the original, and the area of the image is ",
          slotOf("area", "The factor for the area", label(kk[0], kk[1]), pool),
          " times the area of the original.",
        ]);
        const kTex = enlarge ? String(k[0]) : frac(1, k[1]);
        const kkTex = enlarge ? String(kk[0]) : frac(1, kk[1]);
        return multiPartProblem(meta, seed, r, {
          prompt: `A rectangle is ${l} units long and ${w} units wide. It is dilated by a scale factor of ${enlarge ? k[0] : `$${frac(1, k[1])}$`}. Complete the sentence about the image.`,
          layout: "inline",
          label: "Choose a factor for each gap",
          slots: built.slots,
          sentence: built.sentence,
          hint: `Find the perimeter and the area of the ${l} by ${w} rectangle, then the sides of the image. Compare the new perimeter with the old one, and the new area with the old one.`,
          explanation: [
            `The original has perimeter $2(${l}+${w})=${2 * (l + w)}$ and area $${l}\\times ${w}=${l * w}$.`,
            `Every length is multiplied by $${kTex}$, so the perimeter, a sum of lengths, is multiplied by $${kTex}$.`,
            `The area is a product of two lengths, so it is multiplied by $${kTex}\\times ${kTex}=${kkTex}$.`,
          ],
        });
      },
    ),

    "expected-count-blanks": entry(expectedAxes, ({ meta, seed, r, axes }) => {
      const c = axes.sections === "one-section" ? 1 : r(2, 4);
      const values = [10, 20, 30, 40, 50, 60];
      const target = pick(r, [20, 30, 40]);
      const others = values.filter((v) => v !== target);
      const sections = shuffle(r, [
        ...Array.from({ length: c }, () => target),
        ...Array.from({ length: 10 - c }, () => pick(r, others)),
      ]);
      need(
        sections.filter((s) => s === target).length === c,
        "the target count",
      );
      const spins = pick(r, [50, 60, 80, 100, 120, 150, 200]);
      const expected = (spins * c) / 10;
      need(Number.isInteger(expected), "a whole expected count");
      const prob = reducedTex(c, 10);
      const built = inlineSentence([
        `The probability of landing on ${target} is `,
        slotOf("prob", "The probability", prob, [
          reducedTex(10 - c, 10),
          reducedTex(1, c + 1),
          reducedTex(c, 9),
          reducedTex(1, 10),
          reducedTex(c + 1, 10),
        ]),
        `, so in ${spins} spins the spinner is expected to land on ${target} about `,
        slotOf(
          "count",
          "The expected number of times",
          expected,
          [
            spins / 10,
            spins * c,
            spins - expected,
            spins / c,
            expected + spins / 10,
          ].map((x) => Math.round(x)),
        ),
        " times.",
      ]);
      return multiPartProblem(meta, seed, r, {
        prompt: `A spinner has 10 equal sections with these numbers: ${sections.join(", ")}. It is spun ${spins} times. Complete the sentence.`,
        layout: "inline",
        label: "Choose the probability and the expected count",
        slots: built.slots,
        sentence: built.sentence,
        hint: `Count how many of the 10 equal sections show ${target}. That count out of 10 is the probability. Then multiply the probability by ${spins} spins.`,
        explanation: [
          `${c} of the 10 equal sections show ${target}, so the probability is $${frac(c, 10)}$, which is ${prob.replaceAll("$", "").includes("frac") ? `$${prob.replaceAll("$", "")}$` : prob} in lowest terms.`,
          `The expected number of times is $${frac(c, 10)}\\times ${spins}=${expected}$.`,
        ],
      });
    }),

    "unit-rate-pair-blanks": entry(
      unitRatePairAxes,
      ({ meta, seed, r, axes }) => {
        const [lead, noun, a, b] = RATE_CONTEXT[axes.context];
        const mins = [2, 4, 5, 8, 10];
        const m1 = pick(r, mins);
        const m2 = pick(
          r,
          mins.filter((x) => x !== m1),
        );
        const p1 = r(3, 14) + m1 * r(1, 6);
        const p2 = r(3, 14) + m2 * r(1, 5);
        const r1 = p1 / m1;
        const r2 = p2 / m2;
        need(
          Number.isInteger(r1 * 100) &&
            Number.isInteger(r2 * 100) &&
            r1 !== r2 &&
            r1 !== 1 &&
            r2 !== 1,
          "terminating rates",
        );
        need(
          !Number.isInteger(r1) || !Number.isInteger(r2),
          "at least one decimal rate",
        );
        const built = inlineSentence([
          `The rate ${a} is `,
          slotOf(
            "first",
            `The rate ${a}`,
            dec(r1),
            [m1 / p1, p1 - m1, p1 / m2, (p1 + p2) / (m1 + m2), r2]
              .filter(short)
              .map(dec),
          ),
          ` ${noun} per minute, and the rate ${b} is `,
          slotOf(
            "second",
            `The rate ${b}`,
            dec(r2),
            [m2 / p2, p2 - m2, p2 / m1, (p1 + p2) / (m1 + m2), r1]
              .filter(short)
              .map(dec),
          ),
          ` ${noun} per minute.`,
        ]);
        return multiPartProblem(meta, seed, r, {
          prompt: `${lead} ${p1} ${noun} in ${m1} minutes ${a} and ${p2} ${noun} in ${m2} minutes ${b}. Each rate is constant. Complete the sentence with the two unit rates.`,
          layout: "inline",
          label: "Choose a rate for each gap",
          slots: built.slots,
          sentence: built.sentence,
          hint: `A unit rate is the amount for one minute. For the first rate, divide the ${p1} ${noun} by the ${m1} minutes; for the second, divide ${p2} by ${m2}.`,
          explanation: [
            `${a[0]!.toUpperCase()}${a.slice(1)}: $${p1}\\div ${m1}=${dec(r1)}$ ${noun} per minute.`,
            `${b[0]!.toUpperCase()}${b.slice(1)}: $${p2}\\div ${m2}=${dec(r2)}$ ${noun} per minute.`,
          ],
        });
      },
    ),

    "ratio-pair-blanks": entry(ratioPairAxes, ({ meta, seed, r, axes }) => {
      const blueParts = r(2, 7);
      const yellowParts = r(2, 7);
      need(
        blueParts !== yellowParts && gcd(blueParts, yellowParts) === 1,
        "a reduced ratio",
      );
      const f = r(2, 9);
      const yellow = yellowParts * f;
      const blue = blueParts * f;
      const total = blue + yellow;
      const ratioText =
        axes.order === "blue-to-yellow"
          ? `${blueParts} to ${yellowParts}`
          : `${yellowParts} to ${blueParts}`;
      const order =
        axes.order === "blue-to-yellow"
          ? "blue gumballs to yellow gumballs"
          : "yellow gumballs to blue gumballs";
      const built = inlineSentence([
        "There are ",
        slotOf(
          "blue",
          "The number of blue gumballs",
          blue,
          [
            (yellow * yellowParts) / blueParts,
            yellow + blueParts,
            yellow + f,
            (yellow / yellowParts) * (blueParts + 1),
            total,
          ].map(Math.round),
        ),
        " blue gumballs and ",
        slotOf(
          "all",
          "The number of gumballs in all",
          total,
          [
            blue,
            yellow,
            yellow + blueParts,
            f * (blueParts + yellowParts + 1),
            total + f,
          ].map(Math.round),
        ),
        " gumballs in all.",
      ]);
      return multiPartProblem(meta, seed, r, {
        prompt: `The ratio of ${order} in a jar is ${ratioText}. There are ${yellow} yellow gumballs. Complete the sentence.`,
        layout: "inline",
        label: "Choose a number for each gap",
        slots: built.slots,
        sentence: built.sentence,
        hint: `Use the ${yellow} yellow gumballs to find how many gumballs one part of the ratio stands for: divide ${yellow} by the ratio number for yellow. Then use that for the blue part and for the whole.`,
        explanation: [
          `The yellow gumballs are ${yellowParts} parts, so one part is $${yellow}\\div ${yellowParts}=${f}$ gumballs.`,
          `Blue is ${blueParts} parts: $${blueParts}\\times ${f}=${blue}$ gumballs.`,
          `In all there are $${blueParts}+${yellowParts}=${blueParts + yellowParts}$ parts, so $${blueParts + yellowParts}\\times ${f}=${total}$ gumballs, or $${blue}+${yellow}=${total}$.`,
        ],
      });
    }),

    "mean-median-blanks": entry(meanMedianAxes, ({ meta, seed, r, axes }) => {
      const tenths = Array.from({ length: 5 }, () => r(105, 149));
      if (axes.repeats === "with-repeat") tenths[4] = tenths[r(0, 3)]!;
      // The sixth time makes the sum a multiple of 6 so the mean is exact.
      const fits = Array.from({ length: 45 }, (_, i) => 105 + i).filter(
        (v) => (tenths.reduce((s, t) => s + t, 0) + v) % 6 === 0,
      );
      tenths.push(pick(r, fits));
      const sum = tenths.reduce((s, v) => s + v, 0);
      const sorted = [...tenths].sort((a, b) => a - b);
      need(
        new Set(tenths).size < 6 === (axes.repeats === "with-repeat"),
        "the repeat pattern",
      );
      const mean = sum / 60;
      const med = (sorted[2]! + sorted[3]!) / 20;
      need(
        mean !== med && Math.abs(mean - med) > 0.04,
        "different mean and median",
      );
      const unsortedMiddle = (tenths[2]! + tenths[3]!) / 20;
      need(unsortedMiddle !== med, "an unsorted middle that differs");
      const fiveMean = (sum - tenths[5]!) / 50;
      const built = inlineSentence([
        "The mean time is ",
        slotOf(
          "mean",
          "The mean in seconds",
          dec(mean),
          [med, unsortedMiddle, fiveMean, mean + 0.1, sorted[3]! / 10].map(dec),
        ),
        " seconds and the median time is ",
        slotOf(
          "median",
          "The median in seconds",
          dec(med),
          [
            mean,
            unsortedMiddle,
            sorted[2]! / 10,
            sorted[3]! / 10,
            med + 0.1,
          ].map(dec),
        ),
        " seconds.",
      ]);
      return multiPartProblem(meta, seed, r, {
        prompt: `Six runners had these sprint times in seconds: ${tenths.map((t) => dec(t / 10)).join(", ")}. Complete the sentence with the mean and the median.`,
        layout: "inline",
        label: "Choose a time for each gap",
        slots: built.slots,
        sentence: built.sentence,
        hint: `For the mean, add all six times, starting ${dec(tenths[0]! / 10)} + ${dec(tenths[1]! / 10)}, and divide by 6. For the median, first write the times in order from least to greatest.`,
        explanation: [
          `The sum is ${dec(sum / 10)}, so the mean is $${dec(sum / 10)}\\div 6=${dec(mean)}$ seconds.`,
          `In order the times are ${sorted.map((t) => dec(t / 10)).join(", ")}.`,
          `With six values the median is the mean of the two middle values: $(${dec(sorted[2]! / 10)}+${dec(sorted[3]! / 10)})\\div 2=${dec(med)}$ seconds.`,
        ],
      });
    }),

    "median-mode-compare-blanks": entry(
      medianModeAxes,
      ({ meta, seed, r, axes }) => {
        let lists: [number[], number[]] | null = null;
        for (let attempt = 0; attempt < 400 && !lists; attempt++) {
          const mk = () => Array.from({ length: 7 }, () => r(1, 9));
          const [x, y] = [mk(), mk()];
          const [mx, my] = [modesOf(x), modesOf(y)];
          if (mx.length !== 1 || my.length !== 1) continue;
          const cmp = Math.sign(median(x) - median(y));
          const wantCmp =
            axes.medians === "first-greater"
              ? 1
              : axes.medians === "second-greater"
                ? -1
                : 0;
          if (cmp !== wantCmp) continue;
          if ((mx[0] === my[0]) !== (axes.modes === "match")) continue;
          lists = [x, y];
        }
        need(lists !== null, "lists with the stated pattern");
        const [x, y] = lists!;
        const cmp = Math.sign(median(x) - median(y));
        const relation =
          cmp > 0 ? "greater than" : cmp < 0 ? "less than" : "equal to";
        const match = modesOf(x)[0] === modesOf(y)[0];
        const built = inlineSentence([
          "The median of the Hawks is ",
          {
            id: "median",
            label: "How the medians compare",
            correct: relation,
            fixed: ["less than", "equal to", "greater than"],
          } as Slot,
          " the median of the Owls, and their modes ",
          {
            id: "mode",
            label: "Whether the modes match",
            correct: match ? "match" : "do not match",
            fixed: ["match", "do not match"],
          } as Slot,
          ".",
        ]);
        return multiPartProblem(meta, seed, r, {
          prompt: `Two teams scored these points in seven games. Hawks: ${x.join(", ")}. Owls: ${y.join(", ")}. Complete the sentence comparing the teams.`,
          layout: "inline",
          label: "Choose a phrase for each gap",
          slots: built.slots,
          sentence: built.sentence,
          hint: `Write each list in order from least to greatest before you pick the middle value; the Hawks list starts ${x.slice(0, 3).join(", ")}. The mode is the value that appears most often in a list.`,
          explanation: [
            `Hawks in order: ${[...x].sort((a, b) => a - b).join(", ")}; the median is ${median(x)} and the mode is ${modesOf(x)[0]}.`,
            `Owls in order: ${[...y].sort((a, b) => a - b).join(", ")}; the median is ${median(y)} and the mode is ${modesOf(y)[0]}.`,
            `The Hawks' median is ${relation} the Owls' median, and the modes ${match ? "match" : "do not match"}.`,
          ],
        });
      },
    ),

    "rectangle-chain-blanks": entry(
      rectangleChainAxes,
      ({ meta, seed, r, axes }) => {
        const width = r(3, 12);
        const length = r(width + 1, 25);
        const area = width * length;
        const perimeter = 2 * (length + width);
        const unit = axes.unit;
        const built = inlineSentence([
          "The length is ",
          slotOf(
            "length",
            "The length",
            length,
            [
              area - width,
              area + width,
              length + width,
              area / 2,
              length - width,
            ].map(Math.round),
          ),
          ` ${unit} and the perimeter is `,
          slotOf(
            "perim",
            "The perimeter",
            perimeter,
            [
              length + width,
              length * 2 + width,
              area,
              perimeter + 2,
              2 * length,
            ].map(Math.round),
          ),
          ` ${unit}.`,
        ]);
        return multiPartProblem(meta, seed, r, {
          prompt: `A rectangle has an area of ${area} square ${unit} and a width of ${width} ${unit}. Complete the sentence with its length and its perimeter.`,
          layout: "inline",
          label: "Choose a number for each gap",
          slots: built.slots,
          sentence: built.sentence,
          hint: `The area of a rectangle is length times width. Use the area ${area} and the width ${width} to find the length first; the perimeter needs both sides.`,
          explanation: [
            `Area is length times width, so the length is $${area}\\div ${width}=${length}$ ${unit}.`,
            `The perimeter is twice the sum of the length and the width: $2\\times(${length}+${width})=${perimeter}$ ${unit}.`,
          ],
        });
      },
    ),

    "wage-and-cost-blanks": entry(wageAxes, ({ meta, seed, r, axes }) => {
      const wage = r(8, 18);
      const hours = axes.hours === "consecutive" ? [2, 3, 4, 5] : [2, 4, 6, 8];
      const hrs = (n: number) => `${n} ${n === 1 ? "hour" : "hours"}`;
      const step = hours[1]! - hours[0]!;
      const cost = wage * hours[0]! + r(3, 25);
      const net = hours.map((h) => wage * h - cost);
      need(net[0]! < 0 && net[3]! > 0, "net pay that starts below zero");
      const fmt = (n: number) => (n < 0 ? `−${-n}` : String(n));
      const built = inlineSentence([
        "The hourly wage is ",
        slotOf(
          "wage",
          "The hourly wage in dollars",
          wage,
          [
            wage * step,
            net[1]! - net[0]!,
            net[0]! + cost + 1,
            cost,
            wage + 1,
          ].map(Math.abs),
        ),
        " dollars, and the amount spent before the first hour is ",
        slotOf(
          "cost",
          "The amount spent in dollars",
          cost,
          [
            wage,
            Math.abs(net[0]!),
            cost + wage,
            net[3]!,
            Math.abs(net[0]!) + wage,
          ].map(Math.abs),
        ),
        " dollars.",
      ]);
      return multiPartProblem(meta, seed, r, {
        prompt:
          "A worker buys a uniform and then earns the same amount each hour. The table shows net pay in dollars, which is pay earned minus the cost of the uniform. Complete the sentence.",
        layout: "inline",
        label: "Choose a number for each gap",
        slots: built.slots,
        sentence: built.sentence,
        figure: tableFigure(
          [
            ["Hours", ...hours.map(String)],
            ["Net pay", ...net.map(fmt)],
          ],
          "Hours worked and net pay",
        ),
        hint: `Compare the net pay after ${hrs(hours[0]!)}, which is ${fmt(net[0]!)}, with the net pay after ${hrs(hours[1]!)}, which is ${fmt(net[1]!)}: the change shows what ${hrs(hours[1]! - hours[0]!)} of work earn. Then undo the first hours of pay to see the cost.`,
        explanation: [
          `From ${hrs(hours[0]!)} to ${hrs(hours[1]!)} the net pay changes by $${fmt(net[1]!)}-${net[0]! < 0 ? `(${fmt(net[0]!)})` : fmt(net[0]!)}=${net[1]! - net[0]!}$, which is the pay for ${hrs(hours[1]! - hours[0]!)}, so the wage is $${net[1]! - net[0]!}\\div ${hours[1]! - hours[0]!}=${wage}$ dollars per hour.`,
          `After ${hrs(hours[0]!)} the worker has earned $${wage}\\times ${hours[0]}=${wage * hours[0]!}$ dollars but the net pay is ${fmt(net[0]!)}, so the uniform cost $${wage * hours[0]!}-(${fmt(net[0]!)})=${cost}$ dollars.`,
        ],
      });
    }),

    "percent-amounts-blanks": entry(
      percentAmountsAxes,
      ({ meta, seed, r, axes }) => {
        if (axes.form === "group-counts") {
          const total = pick(r, [20, 25, 30, 35, 40, 50, 60, 80]);
          const percents = shuffle(r, [10, 15, 20, 25, 30, 40, 50, 60, 70])
            .filter((p) => (total * p) % 100 === 0)
            .slice(0, 2);
          need(percents.length === 2, "two whole-number percents");
          const [p1, p2] = percents as [number, number];
          const [c1, c2] = [(total * p1) / 100, (total * p2) / 100];
          need(c1 !== c2 && c1 + c2 < total, "different counts");
          const built = inlineSentence([
            "Of the books, ",
            slotOf(
              "first",
              `The number of books in the ${p1}% group`,
              c1,
              [(total * (100 - p1)) / 100, p1, total / p1, c1 + c2, c2].map(
                Math.round,
              ),
            ),
            ` are fiction, and `,
            slotOf(
              "second",
              `The number of books in the ${p2}% group`,
              c2,
              [(total * (100 - p2)) / 100, p2, total / p2, c1 + c2, c1].map(
                Math.round,
              ),
            ),
            " are mystery.",
          ]);
          return multiPartProblem(meta, seed, r, {
            prompt: `A library shelf holds ${total} books. ${p1}% of the books are fiction and ${p2}% are mystery. Complete the sentence with the number of books in each group.`,
            layout: "inline",
            label: "Choose a number for each gap",
            slots: built.slots,
            sentence: built.sentence,
            hint: `A percent is a part of 100. To find ${p1}% of ${total}, multiply ${total} by the decimal for ${p1}%, and do the same with ${p2}% for the second group.`,
            explanation: [
              `Fiction: $${total}\\times ${frac(p1, 100)}=${c1}$ books.`,
              `Mystery: $${total}\\times ${frac(p2, 100)}=${c2}$ books.`,
            ],
          });
        }
        const income = r(12, 40) * 100;
        const [rp, ip] = [pick(r, [20, 25, 30, 35]), pick(r, [4, 5, 6, 8])];
        const rent = (income * rp) / 100;
        const insurance = (income * ip) / 100;
        need(
          Number.isInteger(rent) && Number.isInteger(insurance),
          "whole-dollar amounts",
        );
        const rentLimit = rent + pick(r, [-60, -40, 40, 80]);
        const insLimit = insurance + pick(r, [-20, -10, 10, 20]);
        const verdicts = ["within", "over"];
        const built = inlineSentence([
          "Rent is ",
          slotOf(
            "rent",
            "The rent in dollars",
            rent,
            [
              (income * (100 - rp)) / 100,
              rp,
              income / rp,
              rent + insurance,
            ].map(Math.round),
          ),
          ` dollars, which is `,
          {
            id: "rentv",
            label: "Rent compared with its limit",
            correct: rent <= rentLimit ? "within" : "over",
            fixed: verdicts,
          } as Slot,
          ` its limit. Insurance is `,
          slotOf(
            "ins",
            "The insurance in dollars",
            insurance,
            [
              (income * (100 - ip)) / 100,
              ip,
              income / ip,
              rent + insurance,
            ].map(Math.round),
          ),
          " dollars, which is ",
          {
            id: "insv",
            label: "Insurance compared with its limit",
            correct: insurance <= insLimit ? "within" : "over",
            fixed: verdicts,
          } as Slot,
          " its limit.",
        ]);
        return multiPartProblem(meta, seed, r, {
          prompt: `A family earns ${grouped(income)} dollars a month. Rent is ${rp}% of the income, and the rent limit is ${grouped(rentLimit)} dollars. Insurance is ${ip}% of the income, and the insurance limit is ${grouped(insLimit)} dollars. Complete the sentence.`,
          layout: "inline",
          label: "Choose an amount or a word for each gap",
          slots: built.slots,
          sentence: built.sentence,
          hint: `Find ${rp}% of ${grouped(income)} by multiplying by the decimal for ${rp}%, then compare the result with the limit of ${grouped(rentLimit)}. Do the same for insurance with ${ip}%.`,
          explanation: [
            `Rent: $${grouped(income)}\\times ${frac(rp, 100)}=${grouped(rent)}$ dollars, which is ${rent <= rentLimit ? "not more than" : "more than"} the limit of ${grouped(rentLimit)}.`,
            `Insurance: $${grouped(income)}\\times ${frac(ip, 100)}=${grouped(insurance)}$ dollars, which is ${insurance <= insLimit ? "not more than" : "more than"} the limit of ${grouped(insLimit)}.`,
          ],
        });
      },
    ),

    "check-register-blanks": entry(registerAxes, ({ meta, seed, r, axes }) => {
      const start = axes.start === "overdrawn" ? -r(5, 30) : r(40, 120);
      const signs = shuffle(r, [1, 1, -1, -1]);
      const steps = signs.map((sign) => sign * r(10, 80));
      const balances: number[] = [];
      steps.reduce((bal, s) => {
        const next = bal + s;
        balances.push(next);
        return next;
      }, start);
      need(
        new Set([...steps.map(Math.abs), ...balances.map(Math.abs)]).size === 8,
        "distinct values",
      );
      const sg = (n: number) => (n < 0 ? `−${-n}` : `+${n}`);
      const bl = (n: number) => (n < 0 ? `−${-n}` : String(n));
      const pr = (n: number) => (n < 0 ? `(${bl(n)})` : String(n));
      // Lines 1 and 3 hide their balance; lines 2 and 4 hide their amount.
      const rows: string[][] = [
        ["Line", "Amount", "Balance"],
        ["Start", "", bl(start)],
        ["1", sg(steps[0]!), "?"],
        ["2", "?", bl(balances[1]!)],
        ["3", sg(steps[2]!), "?"],
        ["4", "?", bl(balances[3]!)],
      ];
      const slots: Slot[] = [
        slotOf(
          "b1",
          "The balance after line 1",
          bl(balances[0]!),
          [
            start - steps[0]!,
            balances[1]!,
            steps[0]!,
            balances[0]! + 10,
            -balances[0]!,
          ].map(bl),
        ),
        slotOf(
          "a2",
          "The amount of line 2",
          sg(steps[1]!),
          [balances[1]! - start, balances[1]!, -steps[1]!, steps[1]! + 10].map(
            sg,
          ),
        ),
        slotOf(
          "b3",
          "The balance after line 3",
          bl(balances[2]!),
          [
            balances[1]! - steps[2]!,
            balances[3]!,
            steps[2]!,
            balances[2]! + 10,
            -balances[2]!,
          ].map(bl),
        ),
        slotOf(
          "a4",
          "The amount of line 4",
          sg(steps[3]!),
          [
            balances[3]! - balances[1]!,
            balances[3]!,
            -steps[3]!,
            steps[3]! + 10,
          ].map(sg),
        ),
      ];
      return multiPartProblem(meta, seed, r, {
        prompt:
          "In this check register, deposits are positive and withdrawals negative, in dollars. Complete it.",
        layout: "slots",
        label: "Choose each missing value",
        slots,
        figure: tableFigure(rows, "Check register", "row"),
        hint: `The balance after a line is the balance before it plus the line's amount. Start with the balance of ${bl(start)} and the first amount ${sg(steps[0]!)}.`,
        explanation: [
          `Line 1: $${bl(start)}${steps[0]! < 0 ? "-" : "+"}${Math.abs(steps[0]!)}=${bl(balances[0]!)}$.`,
          `Line 2: the balance went from ${bl(balances[0]!)} to ${bl(balances[1]!)}, so the amount is $${bl(balances[1]!)}-${pr(balances[0]!)}=${sg(steps[1]!)}$.`,
          `Line 3: $${bl(balances[1]!)}${steps[2]! < 0 ? "-" : "+"}${Math.abs(steps[2]!)}=${bl(balances[2]!)}$.`,
          `Line 4: the balance went from ${bl(balances[2]!)} to ${bl(balances[3]!)}, so the amount is $${bl(balances[3]!)}-${pr(balances[2]!)}=${sg(steps[3]!)}$.`,
        ],
      });
    }),
  },
);
