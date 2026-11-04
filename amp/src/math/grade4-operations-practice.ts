import { createHash } from "node:crypto";
import { count as countNoun } from "./agreement";
import type {
  GeneratedProblem,
  SemanticFigure,
  TemplateMetadata,
} from "./contracts";
import { serializeSelection } from "./selection-response";
import { lineTable } from "./scene/author";
import { defineAxis } from "./variation/axes";
import {
  defineGenerate,
  entry,
  inlineSentence,
  multiPartCapability,
  multiPartProblem,
  need,
  pick,
  shuffle,
  slotOf,
  type Random,
} from "./multi-part-support";

/** Grade-4 operations that were missing from the catalog: two-digit products,
 * quotient and remainder together, factors and multiples, 11 and 12 facts,
 * and a growing tile pattern. */

const multi = { requiredResponseCapability: "multi-select-v1" as const };

export const grade4OperationsTemplates: readonly TemplateMetadata[] = [
  {
    id: "multiply-two-digit",
    version: 1,
    title: "Multiply two multidigit numbers",
    skillId: "whole-multiplication",
    gradeBand: "3–5",
    difficultyOffset: 0.35,
    description:
      "Multiply two two-digit numbers, with a rarer three-digit by two-digit product and the squares from 11 squared through 15 squared. No area model is shown.",
  },
  {
    id: "quotient-remainder-one-digit",
    version: 1,
    title: "Quotient and remainder",
    skillId: "whole-division",
    gradeBand: "3–5",
    difficultyOffset: 0.4,
    ...multiPartCapability,
    description:
      "Divide a whole number from 100 to 9,999 by a one-digit divisor and give both the quotient and the remainder, or the remainder as a fraction of the divisor.",
  },
  {
    id: "factor-pairs-select",
    version: 1,
    title: "Select every factor",
    skillId: "factors-multiples",
    gradeBand: "3–5",
    difficultyOffset: 0.3,
    ...multi,
    description:
      "Select every factor of a whole number from 2 to 100, including primes and square numbers, with a rarer number from 101 to 144.",
  },
  {
    id: "multiples-select",
    version: 1,
    title: "Select the multiples",
    skillId: "factors-multiples",
    gradeBand: "3–5",
    difficultyOffset: 0.25,
    ...multi,
    description:
      "Select every multiple of a one-digit number. The other choices are one more or one less than a multiple.",
  },
  {
    id: "facts-to-twelve",
    version: 1,
    title: "Facts through 12",
    skillId: "whole-multiplication",
    gradeBand: "3–5",
    difficultyOffset: 0.2,
    description:
      "Multiply or divide when one of the numbers is 11 or 12, through 12 × 12.",
  },
  {
    id: "growing-shape-pattern",
    version: 1,
    title: "A growing tile pattern",
    skillId: "rule-patterns",
    gradeBand: "3–5",
    difficultyOffset: 0.35,
    requiredFigureCapability: "scenes-v1",
    description:
      "A tile pattern follows an add rule stated in words. Steps 1, 2 and 3 are drawn. Find the number of tiles in a later step.",
  },
];

const byId = new Map(grade4OperationsTemplates.map((t) => [t.id, t]));

function random(id: string, seed: string): Random {
  let counter = 0;
  return (low, high) => {
    const span = high - low + 1,
      limit = Math.floor(0x100000000 / span) * span;
    let value: number;
    do {
      value = createHash("sha256")
        .update(JSON.stringify([id, 1, seed, counter++]))
        .digest()
        .readUInt32BE(0);
    } while (value >= limit);
    return low + (value % span);
  };
}

const factorsOf = (n: number) => {
  const out: number[] = [];
  for (let i = 1; i * i <= n; i++)
    if (n % i === 0) {
      out.push(i);
      if (i * i !== n) out.push(n / i);
    }
  return out.sort((a, b) => a - b);
};

const numberProblem = (
  meta: TemplateMetadata,
  seed: string,
  draft: {
    prompt: string;
    answer: number;
    hint: string;
    explanation: string[];
    label?: string;
    figure?: SemanticFigure;
    variant: string;
    axes: Record<string, string>;
  },
): GeneratedProblem => ({
  public: {
    id: createHash("sha256")
      .update(JSON.stringify([meta.id, 1, seed]))
      .digest("hex"),
    templateId: meta.id,
    templateVersion: 1,
    seed,
    prompt: draft.prompt,
    skillId: meta.skillId,
    response: { kind: "number", label: draft.label ?? "Answer" },
    ...(draft.figure ? { figure: draft.figure } : {}),
  },
  answer: String(draft.answer),
  hint: draft.hint,
  explanation: draft.explanation,
  variant: { id: draft.variant, axes: draft.axes },
});

const selectProblem = (
  meta: TemplateMetadata,
  seed: string,
  draft: {
    prompt: string;
    hint: string;
    explanation: string[];
    options: { label: string; correct?: boolean }[];
    variant: string;
    axes: Record<string, string>;
  },
): GeneratedProblem => {
  const options = draft.options.map((o, i) => ({
    id: `option-${"abcdefgh"[i]}`,
    label: o.label,
    correct: o.correct === true,
  }));
  const keyed = options.filter((o) => o.correct).map((o) => o.id);
  return {
    public: {
      id: createHash("sha256")
        .update(JSON.stringify([meta.id, 1, seed]))
        .digest("hex"),
      templateId: meta.id,
      templateVersion: 1,
      seed,
      prompt: draft.prompt,
      skillId: meta.skillId,
      response: {
        kind: "multi-select",
        label: `Choose ${keyed.length}`,
        selectionCount: keyed.length,
        options: options.map(({ id, label }) => ({ id, label })),
      },
    },
    answer: serializeSelection(keyed),
    hint: draft.hint,
    explanation: draft.explanation,
    variant: { id: draft.variant, axes: draft.axes },
  };
};

const multiplyAxes = {
  "factor-digits": defineAxis(
    "factor-digits",
    ["2x2", "3x2", "square"] as const,
    { legacy: "2x2", weights: [6, 1, 1] },
  ),
};

const quotientAxes = {
  form: defineAxis("form", ["remainder", "fraction"] as const, {
    legacy: "remainder",
  }),
};

function multiplyTwoDigit(
  meta: TemplateMetadata,
  seed: string,
): GeneratedProblem {
  const r = random(meta.id, seed);
  const digits =
    multiplyAxes["factor-digits"].values[
      weighted(r, multiplyAxes["factor-digits"].weights!)
    ]!;
  let a: number;
  let b: number;
  if (digits === "square") {
    a = b = r(11, 15);
  } else if (digits === "3x2") {
    a = r(100, 999);
    b = r(12, 99);
  } else {
    a = r(12, 99);
    b = r(12, 99);
  }
  const product = a * b;
  return numberProblem(meta, seed, {
    prompt: `What is ${a} × ${b}?`,
    answer: product,
    label: "Product",
    hint: `Multiply ${a} by ${b}. There is no area model to read.`,
    explanation: [
      `${a} × ${b} means ${a} groups of ${b}.`,
      `The product is ${product}.`,
    ],
    variant: digits,
    axes: { "factor-digits": digits },
  });
}

function weighted(r: Random, weights: readonly number[]) {
  const total = weights.reduce((s, w) => s + w, 0);
  let draw = r(1, total);
  for (let i = 0; i < weights.length; i++) {
    draw -= weights[i]!;
    if (draw <= 0) return i;
  }
  return weights.length - 1;
}

function factsToTwelve(meta: TemplateMetadata, seed: string): GeneratedProblem {
  const r = random(meta.id, seed);
  const operation = r(0, 1) === 0 ? "multiply" : "divide";
  const teen = r(0, 1) === 0 ? 11 : 12;
  let other = r(2, 12);
  if (operation === "divide" && other === teen) other = other === 12 ? 11 : 12;
  if (operation === "multiply") {
    const product = teen * other;
    return numberProblem(meta, seed, {
      prompt: `What is ${teen} × ${other}?`,
      answer: product,
      label: "Product",
      hint: `${teen} × ${other} is ${teen} groups of ${other}.`,
      explanation: [
        `${teen} groups of ${other} is ${teen} × ${other}.`,
        `The product is ${product}.`,
      ],
      variant: "multiply",
      axes: { operation: "multiply" },
    });
  }
  const dividend = teen * other;
  return numberProblem(meta, seed, {
    prompt: `What is ${dividend} ÷ ${teen}?`,
    answer: other,
    label: "Quotient",
    hint: `${dividend} ÷ ${teen} asks how many groups of ${teen} make ${dividend}.`,
    explanation: [
      `${teen} × ${other} = ${dividend}, so ${dividend} ÷ ${teen} = ${other}.`,
      `The quotient is ${other}.`,
    ],
    variant: "divide",
    axes: { operation: "divide" },
  });
}

const TILE_RULES = [
  { start: 3, add: 2 },
  { start: 4, add: 3 },
  { start: 5, add: 4 },
  { start: 2, add: 5 },
  { start: 6, add: 2 },
  { start: 1, add: 4 },
] as const;

function growingShape(meta: TemplateMetadata, seed: string): GeneratedProblem {
  const r = random(meta.id, seed);
  const rule = pick(r, TILE_RULES);
  const step = r(5, 8);
  const tiles = (n: number) => rule.start + (n - 1) * rule.add;
  const answer = tiles(step);
  const rows = [
    ["Step", "1", "2", "3"],
    ["Tiles", String(tiles(1)), String(tiles(2)), String(tiles(3))],
  ];
  return numberProblem(meta, seed, {
    prompt: `A tile pattern starts with ${countNoun(rule.start, "tile")}. Each next step adds ${countNoun(rule.add, "tile")}. The table shows steps 1, 2 and 3. How many tiles are in step ${step}?`,
    answer,
    label: "Tiles",
    figure: {
      kind: "scene",
      scene: lineTable(rows, { header: "row" }).scene({
        title: "Tiles in the first three steps",
      }),
    },
    hint: `Step 1 has ${countNoun(rule.start, "tile")}. Each later step adds ${rule.add}. Step ${step} is ${step - 1} adds after the start. Do not count step ${step} from the table. It is not drawn.`,
    explanation: [
      `The rule is: start at ${rule.start}, then add ${rule.add} for each new step.`,
      `Step ${step} has had the start plus ${step - 1} adds: ${rule.start} + ${step - 1} × ${rule.add}.`,
      `${rule.start} + ${(step - 1) * rule.add} = ${answer}.`,
      `Step ${step} has ${countNoun(answer, "tile")}.`,
    ],
    variant: "add-rule",
    axes: { rule: "add" },
  });
}

const SHORT_FACTORS = {
  "to-100": [] as number[],
  "to-144": [] as number[],
};
for (let n = 2; n <= 144; n++) {
  const count = factorsOf(n).length;
  if (count < 2 || count > 6) continue;
  SHORT_FACTORS["to-144"].push(n);
  if (n <= 100) SHORT_FACTORS["to-100"].push(n);
}

function factorPairs(meta: TemplateMetadata, seed: string): GeneratedProblem {
  const r = random(meta.id, seed);
  const range = r(0, 4) === 0 ? "to-144" : "to-100";
  const n = pick(r, SHORT_FACTORS[range]);
  const factors = factorsOf(n);
  const distractors = [...new Set([n + 1, n - 1, factors[1]! + 1])].filter(
    (d) => d > 0 && !factors.includes(d),
  );
  const shown = [
    ...factors.map((f) => ({ label: String(f), correct: true as boolean })),
    ...distractors.slice(0, 8 - factors.length).map((d) => ({
      label: String(d),
      correct: false,
    })),
  ];
  const ordered = shuffle(r, shown);
  return selectProblem(meta, seed, {
    prompt: `Select every factor of ${n}. A factor divides ${n} with nothing left over. Together, the factors make every factor pair.`,
    hint: `Try the counting numbers from 1 up to ${n}. Keep a number when ${n} divided by it leaves no remainder.`,
    explanation: [
      `The factors of ${n} are ${factors.join(", ")}.`,
      factors.length === 2
        ? `${n} is prime: its only factors are 1 and itself, so its only factor pair is 1 × ${n}.`
        : factors.some((f) => f * f === n)
          ? `${n} is a square, so one factor pair uses the same factor twice.`
          : `Each factor pairs with ${n} divided by that factor.`,
    ],
    options: ordered,
    variant: range,
    axes: { range },
  });
}

function multiplesSelect(
  meta: TemplateMetadata,
  seed: string,
): GeneratedProblem {
  const r = random(meta.id, seed);
  const d = r(2, 9);
  const ks = shuffle(r, [2, 3, 4, 5, 6, 7, 8, 9]).slice(0, 3);
  const multiples = ks.map((k) => d * k);
  // Two copies of the same miss happen when the divisor is 2 and the first
  // two multipliers are consecutive: 2k+1 and 2(k+1)-1 are the same number.
  const misses = [
    ...new Set([
      multiples[0]! + 1,
      multiples[1]! - 1,
      multiples[2]! + 1,
      multiples[2]! - 1,
    ]),
  ].filter((m) => m > 0 && m % d !== 0);
  const shownMisses = misses.slice(0, 2);
  if (shownMisses.length < 2) {
    throw new Error(`Need two misses for multiples of ${d}`);
  }
  const options = shuffle(r, [
    ...multiples.map((n) => ({ label: String(n), correct: true })),
    ...shownMisses.map((n) => ({ label: String(n), correct: false })),
  ]);
  return selectProblem(meta, seed, {
    prompt: `Select every multiple of ${d}. A multiple of ${d} is ${d} times a whole number.`,
    hint: `Divide each number by ${d}. A multiple leaves no remainder. A number one away from a multiple is not a multiple.`,
    explanation: [
      `The multiples of ${d} in the list are ${multiples.join(", ")}.`,
      `Each of those is ${d} times a whole number. The other numbers are 1 away from a multiple, so they leave a remainder.`,
    ],
    options,
    variant: `of-${d}`,
    axes: { divisor: String(d) },
  });
}

const quotientGenerate = defineGenerate(
  grade4OperationsTemplates.filter(
    (t) => t.id === "quotient-remainder-one-digit",
  ),
  {
    "quotient-remainder-one-digit": entry(
      quotientAxes,
      ({ meta, seed, r, axes }) => {
        const d = r(2, 9);
        const rem = r(1, d - 1);
        const qMin = Math.ceil((100 - rem) / d);
        const qMax = Math.floor((9999 - rem) / d);
        const q = r(qMin, qMax);
        const dividend = q * d + rem;
        need(
          dividend >= 100 && dividend <= 9999,
          "a four-digit-or-less dividend",
        );
        const qWrong = [
          q + 1,
          q - 1,
          q + rem,
          Math.floor(dividend / (d + 1)),
        ].filter((n) => n > 0 && n !== q);
        const rWrong = [0, d - rem, rem + 1, d].filter(
          (n) => n !== rem && n >= 0 && n < d + 2,
        );
        if (axes.form === "fraction") {
          const built = inlineSentence([
            "The quotient is ",
            slotOf("q", "Quotient", q, qWrong),
            ` and the remainder is `,
            slotOf("num", "Numerator of the remainder fraction", rem, rWrong),
            `/${d} of the divisor.`,
          ]);
          return multiPartProblem(meta, seed, r, {
            prompt: `Divide ${dividend} by ${d}. Give the quotient and the remainder as a fraction of the divisor.`,
            layout: "inline",
            label: "Choose the quotient and the numerator",
            slots: built.slots,
            sentence: built.sentence,
            hint: `${d} goes into ${dividend} a whole number of times, with a remainder smaller than ${d}. The fraction is that remainder over ${d}.`,
            explanation: [
              `${d} × ${q} = ${d * q}, and ${dividend} − ${d * q} = ${rem}.`,
              `The remainder ${rem} is smaller than the divisor ${d}, so the fraction of the divisor is ${rem}/${d}.`,
              `${dividend} ÷ ${d} = ${q} and ${rem}/${d}.`,
            ],
          });
        }
        const built = inlineSentence([
          "The quotient is ",
          slotOf("q", "Quotient", q, qWrong),
          " and the remainder is ",
          slotOf("r", "Remainder", rem, rWrong),
          ".",
        ]);
        return multiPartProblem(meta, seed, r, {
          prompt: `Divide ${dividend} by ${d}. Give the quotient and the remainder.`,
          layout: "inline",
          label: "Choose the quotient and the remainder",
          slots: built.slots,
          sentence: built.sentence,
          hint: `Find how many times ${d} fits in ${dividend}. The remainder is what is left, and it is smaller than ${d}.`,
          explanation: [
            `${d} × ${q} = ${d * q}.`,
            `${dividend} − ${d * q} = ${rem}, and ${rem} is smaller than ${d}.`,
            `The quotient is ${q} and the remainder is ${rem}.`,
          ],
        });
      },
    ),
  },
);

export function generateGrade4OperationsProblem(
  templateId: string,
  seed: string,
): GeneratedProblem {
  const meta = byId.get(templateId);
  if (!meta) throw new Error(`Unknown template ${templateId}`);
  if (typeof seed !== "string" || !seed.length || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  switch (templateId) {
    case "multiply-two-digit":
      return multiplyTwoDigit(meta, seed);
    case "facts-to-twelve":
      return factsToTwelve(meta, seed);
    case "growing-shape-pattern":
      return growingShape(meta, seed);
    case "factor-pairs-select":
      return factorPairs(meta, seed);
    case "multiples-select":
      return multiplesSelect(meta, seed);
    case "quotient-remainder-one-digit":
      return quotientGenerate(templateId, seed);
    default:
      throw new Error(`Unknown template ${templateId}`);
  }
}
