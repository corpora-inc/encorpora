import { createHash } from "node:crypto";
import { count as countNoun, plural } from "./agreement";
import { storyName } from "./story-kit/names";
import type {
  GeneratedProblem,
  SemanticFigure,
  TemplateMetadata,
} from "./contracts";
import { serializeSelection } from "./selection-response";
import { array, scene } from "./scene/author";
import type { Element } from "./scene/spec";
import { defineAxis } from "./variation/axes";
import {
  defineGenerate,
  entry,
  grouped,
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

/** Avoid already-rounded factors. A multiple of 10 is a trivial partial product. */
function uneven(r: Random, lo: number, hi: number): number {
  let n = r(lo, hi);
  for (let guard = 0; n % 10 === 0 && guard < 12; guard++) n = r(lo, hi);
  return n;
}

function productSteps(a: number, b: number): string[] {
  const tens = Math.floor(b / 10) * 10;
  const ones = b % 10;
  const A = grouped(a);
  const B = grouped(b);
  if (ones === 0) {
    const tensDigit = tens / 10;
    return [
      `${A} × ${B} means ${A} groups of ${B}.`,
      `${B} is ${tensDigit} tens, so first find ${A} × ${tensDigit} = ${grouped(a * tensDigit)}.`,
      `That is ${grouped(a * tensDigit)} tens, which is ${grouped(a * b)}.`,
    ];
  }
  return [
    `${A} × ${B} means ${A} groups of ${B}.`,
    `Break ${B} into ${grouped(tens)} + ${ones}. Multiply ${A} by each part.`,
    `${A} × ${grouped(tens)} = ${grouped(a * tens)}, and ${A} × ${ones} = ${grouped(a * ones)}.`,
    `Add the partial products: ${grouped(a * tens)} + ${grouped(a * ones)} = ${grouped(a * b)}.`,
  ];
}

function multiplyPrompt(r: Random, a: number, b: number): string {
  const A = grouped(a);
  const B = grouped(b);
  if (r(0, 2) !== 0) {
    const frame = r(0, 2);
    if (frame === 0) return `What is ${A} × ${B}?`;
    if (frame === 1) return `Find the product of ${A} and ${B}.`;
    return `Multiply ${A} by ${B}.`;
  }
  const name = storyName((n) => r(0, n - 1));
  return pick(r, [
    `${name} packs ${A} boxes with ${B} crayons in each box. How many crayons is that?`,
    `${name} bakes ${A} trays with ${B} cookies on each tray. How many cookies is that?`,
    `${name} plants ${A} rows with ${B} seedlings in each row. How many seedlings is that?`,
    `The gym sets out ${A} bins with ${B} tennis balls in each bin. How many tennis balls is that?`,
    `${name} buys ${A} packs with ${B} trading cards in each pack. How many cards is that?`,
    `A school orders ${A} cartons with ${B} notebooks in each carton. How many notebooks is that?`,
    `${name} fills ${A} pages with ${B} stamps on each page. How many stamps is that?`,
    `The team plays ${A} games and scores ${B} points in each game. How many points is that?`,
  ]);
}

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
    a = uneven(r, 100, 999);
    b = uneven(r, 12, 99);
  } else {
    a = uneven(r, 12, 99);
    b = uneven(r, 12, 99);
  }
  const product = a * b;
  return numberProblem(meta, seed, {
    prompt: multiplyPrompt(r, a, b),
    answer: product,
    label: "Product",
    hint: `Break ${grouped(b)} into tens and ones. Multiply ${grouped(a)} by each part, then add those partial products.`,
    explanation: productSteps(a, b),
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

function twelveProductSteps(teen: number, other: number): string[] {
  const tens = 10 * other;
  const extra = (teen - 10) * other;
  return [
    `Split ${teen} into 10 + ${teen - 10}, then multiply each part by ${other}.`,
    `10 × ${other} = ${tens}, and ${teen - 10} × ${other} = ${extra}.`,
    `Add the parts: ${tens} + ${extra} = ${teen * other}.`,
  ];
}

/** The dividend is the first number and 11 or 12 is the second, so a prompt
 * never leads with the divisor. Applied items are about one third. */
function factsPrompt(
  r: Random,
  teen: number,
  other: number,
  multiply: boolean,
): string {
  const product = teen * other;
  const applied = r(0, 2) === 0;
  const name = applied ? storyName((n) => r(0, n - 1)) : "";
  if (multiply) {
    if (!applied) {
      const frame = r(0, 2);
      if (frame === 0) return `What is ${teen} × ${other}?`;
      if (frame === 1) return `Find the product ${teen} × ${other}.`;
      return `Multiply ${teen} × ${other}.`;
    }
    return pick(r, [
      `${name} buys ${teen} packs with ${other} stickers in each pack. How many stickers is ${teen} × ${other} in all?`,
      `A carton holds ${teen} eggs. ${name} needs ${other} cartons. How many eggs is ${teen} × ${other} in all?`,
      `${name} sets ${teen} rows with ${other} chairs in each row. How many chairs is ${teen} × ${other} in all?`,
      `${name} saves ${teen} dollars a week for ${other} weeks. How many dollars is ${teen} × ${other} in all?`,
      `Each shelf holds ${other} books. ${name} fills ${teen} shelves. How many books is ${teen} × ${other} in all?`,
    ]);
  }
  if (!applied) {
    const who = storyName((n) => r(0, n - 1));
    const frame = r(0, 3);
    if (frame === 0) return `${who} asks: what is ${product} ÷ ${teen}?`;
    if (frame === 1) return `${product} divided by ${teen} is how many?`;
    if (frame === 2)
      return `${who} writes ${product} ÷ ${teen}. What is the quotient?`;
    return `${product} split into equal groups of ${teen} makes how many groups?`;
  }
  return pick(r, [
    `${name} shares ${product} cards equally among ${teen} friends. How many cards does each friend get?`,
    `${product} eggs go into cartons of ${teen}. How many cartons is that?`,
    `${name} has ${product} dollars to spend on tickets that cost ${teen} dollars each. How many tickets can ${name} buy?`,
    `${product} players form equal teams of ${teen}. How many teams is that?`,
  ]);
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
      prompt: factsPrompt(r, teen, other, true),
      answer: product,
      label: "Product",
      hint: `Split ${teen} into 10 and ${teen - 10}. Multiply each part by ${other}, then add.`,
      explanation: twelveProductSteps(teen, other),
      variant: "multiply",
      axes: { operation: "multiply" },
    });
  }
  const dividend = teen * other;
  return numberProblem(meta, seed, {
    prompt: factsPrompt(r, teen, other, false),
    answer: other,
    label: "Quotient",
    hint: `${dividend} ÷ ${teen} asks how many groups of ${teen} make ${dividend}. Think of the multiplication fact that uses ${teen}.`,
    explanation: [
      `Dividing by ${teen} undoes multiplying by ${teen}.`,
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
  { start: 4, add: 2 },
  { start: 3, add: 5 },
  { start: 5, add: 3 },
  { start: 2, add: 3 },
  { start: 6, add: 3 },
  { start: 4, add: 5 },
  { start: 3, add: 4 },
  { start: 5, add: 2 },
  { start: 2, add: 4 },
  { start: 6, add: 4 },
] as const;

/** A growing figure whose step-1 row is the start and each later step adds
 * one row. Step n has start + (n − 1) · add pieces. */
const GROWTHS = [
  {
    noun: "tile",
    title: "Garden path, steps 1 to 3",
    lead: "Jamal is laying a garden path.",
    piece: "garden tile",
  },
  {
    noun: "block",
    title: "Block staircase, steps 1 to 3",
    lead: "Priya is building a block staircase.",
    piece: "stair block",
  },
  {
    noun: "cup",
    title: "Stacked cups, steps 1 to 3",
    lead: "The cafe is stacking cups for a picnic.",
    piece: "stacked cup",
  },
  {
    noun: "chair",
    title: "Chairs by the tables, steps 1 to 3",
    lead: "The class is setting chairs along a row of tables.",
    piece: "chair",
  },
  {
    noun: "bead",
    title: "Bead rows, steps 1 to 3",
    lead: "Lena is stringing beads in a growing pattern.",
    piece: "bead",
  },
  {
    noun: "seedling",
    title: "Seedling rows, steps 1 to 3",
    lead: "Omar is planting seedlings in a growing bed.",
    piece: "seedling",
  },
  {
    noun: "stamp",
    title: "Stamp rows, steps 1 to 3",
    lead: "Nia is arranging stamps in a growing display.",
    piece: "stamp",
  },
  {
    noun: "card",
    title: "Card rows, steps 1 to 3",
    lead: "Theo is laying cards in a growing pattern.",
    piece: "card",
  },
  {
    noun: "tile",
    title: "Garden path, steps 1 to 3",
    lead: "Jamal is laying a garden path.",
    piece: "garden tile",
  },
  {
    noun: "shell",
    title: "Shell rows, steps 1 to 3",
    lead: "Ava is lining up shells from the beach.",
    piece: "shell",
  },
  {
    noun: "flower",
    title: "Flower rows, steps 1 to 3",
    lead: "Noah is planting a growing row of flowers.",
    piece: "flower",
  },
  {
    noun: "book",
    title: "Book stacks, steps 1 to 3",
    lead: "Sofia is stacking books for the book fair.",
    piece: "book",
  },
  {
    noun: "board",
    title: "Porch boards, steps 1 to 3",
    lead: "A builder is adding boards to a porch step.",
    piece: "board",
  },
] as const;

function tileFigure(
  start: number,
  add: number,
  growth: (typeof GROWTHS)[number],
) {
  const slot = Math.max(start, add);
  const gap = 2;
  const parts: (Element | { element(): Element })[] = [];
  for (let step = 1; step <= 3; step++) {
    const x0 = (step - 1) * (slot + gap);
    parts.push({
      type: "text",
      id: `label${step}`,
      at: [x0, step],
      text: `Step ${step}`,
      font: "sans",
      bold: true,
      align: [-1, 1],
      offset: [0, -8],
    });
    for (let row = 0; row < step; row++) {
      const columns = row === 0 ? start : add;
      parts.push(array(1, columns, { at: [x0, row] }).id(`s${step}r${row}`));
    }
  }
  return {
    kind: "scene" as const,
    scene: scene(...parts).build({
      title: growth.title,
      note: `Three ${growth.piece} figures, left to right. Each figure's bottom row has ${countNoun(start, "unit square")}. Each later step adds a row of ${countNoun(add, "unit square")} on top. Steps after 3 are not drawn.`,
      width: 640,
      maxHeight: 420,
    }),
  };
}

function growingShape(meta: TemplateMetadata, seed: string): GeneratedProblem {
  const r = random(meta.id, seed);
  const rule = pick(r, TILE_RULES);
  const growth = pick(r, GROWTHS);
  const step = r(5, 8);
  const tiles = (n: number) => rule.start + (n - 1) * rule.add;
  const answer = tiles(step);
  const noun = growth.noun;
  return numberProblem(meta, seed, {
    prompt: `${growth.lead} The pattern starts with ${countNoun(rule.start, noun)}. Each next step adds ${countNoun(rule.add, noun)}. The figure shows steps 1, 2 and 3. How many ${plural(noun)} are in step ${step}?`,
    answer,
    label: plural(noun)[0]!.toUpperCase() + plural(noun).slice(1),
    figure: tileFigure(rule.start, rule.add, growth),
    hint: `Step 1 has ${countNoun(rule.start, noun)}. To reach step ${step}, add ${countNoun(rule.add, noun)} once for each later step. That is ${step - 1} adds. The figure stops at step 3, so do not count step ${step} from it.`,
    explanation: [
      `The rule is: start at ${rule.start}, then add ${rule.add} for each new step.`,
      `Step ${step} is the start plus ${step - 1} adds: ${rule.start} + ${step - 1} × ${rule.add}.`,
      `${rule.start} + ${(step - 1) * rule.add} = ${answer}.`,
      `Step ${step} has ${countNoun(answer, noun)}.`,
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

function factorPrompt(r: Random, n: number): string {
  const name = storyName((n) => r(0, n - 1));
  const frame = r(0, 5);
  if (frame === 0)
    return `${name} lists the factors of ${n}. Select every factor of ${n}. A factor divides ${n} with nothing left over.`;
  if (frame === 1)
    return `${name} checks a list for factors of ${n}. Which of these numbers divide ${n} with nothing left over?`;
  if (frame === 2)
    return `Which of these numbers go into ${n} with no remainder? Select every factor of ${n}.`;
  if (frame === 3)
    return `${name} has ${n} stickers to split into equal piles with none left over. Which of these numbers of stickers could be in each pile? Select every factor of ${n}.`;
  if (frame === 4)
    return `${name} is setting ${n} chairs in equal rows with no chair left over. Which of these numbers of chairs could be in each row? Select every factor of ${n}.`;
  return `${name} has ${n} tiles and wants a rectangle that uses every tile. Which of these side lengths work? Select every factor of ${n}.`;
}

function factorHint(n: number, prime: boolean): string {
  if (prime)
    return `A prime has no factor strictly between 1 and itself. Check that no counting number from 2 up to the number before ${n} divides it.`;
  if (n % 2 === 0)
    return `Factors come in pairs. If 2 divides ${n}, then ${n} ÷ 2 is a factor too. Also try 3 and 5, and keep both numbers in each pair.`;
  if (n % 5 === 0)
    return `Factors come in pairs. ${n} ends in 0 or 5, so 5 is worth trying. If 5 divides ${n}, then ${n} ÷ 5 is a factor too.`;
  return `Factors come in pairs. Try 3, then 5. When a number divides ${n}, the partner ${n} divided by that number is a factor too.`;
}

function factorPairs(meta: TemplateMetadata, seed: string): GeneratedProblem {
  const r = random(meta.id, seed);
  const range = r(0, 4) === 0 ? "to-144" : "to-100";
  let n = pick(r, SHORT_FACTORS[range]);
  let factors = factorsOf(n);
  // Primes are a real case, but they should not dominate the set.
  if (factors.length === 2 && r(0, 2) !== 0) {
    n = pick(r, SHORT_FACTORS[range]);
    factors = factorsOf(n);
  }
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
    prompt: factorPrompt(r, n),
    hint: factorHint(n, factors.length === 2),
    explanation: [
      `The factors of ${n} are ${factors.join(", ")}.`,
      factors.length === 2
        ? `${n} is prime: its only factors are 1 and itself, so its only factor pair is 1 × ${n}.`
        : `List the pairs. Each factor partners with ${n} divided by that factor${factors.some((f) => f * f === n) ? `, and one pair uses the same factor twice because ${n} is a square` : ""}.`,
    ],
    options: ordered,
    variant: range,
    axes: { range },
  });
}

function multipleHint(d: number): string {
  if (d === 2)
    return "Multiples of 2 are even. Check the last digit: it must be 0, 2, 4, 6, or 8. A number one away from a multiple is not a multiple.";
  if (d === 5)
    return "Multiples of 5 end in 0 or 5. A number one away from a multiple is not a multiple.";
  if (d === 3 || d === 9)
    return `Add the digits. If that sum is a multiple of ${d}, the number is too. A number one away from a multiple is not a multiple.`;
  if (d === 4)
    return "For 4, look at the last two digits. If those make a multiple of 4, the whole number is too. A number one away from a multiple is not a multiple.";
  if (d === 6)
    return "A multiple of 6 is a multiple of both 2 and 3. Check that it is even, then add the digits to check for 3.";
  return `Divide each number by ${d}. A multiple leaves no remainder. A number one away from a multiple is not a multiple.`;
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
  const name = storyName((n) => r(0, n - 1));
  const frame = r(0, 4);
  const prompt =
    frame === 0
      ? `Select every multiple of ${d}. A multiple of ${d} is ${d} times a whole number.`
      : frame === 1
        ? `Which of these numbers are multiples of ${d}? A multiple is ${d} times a whole number.`
        : frame === 2
          ? `${name} is counting by ${d}s. Which of these numbers would ${name} say? Select every multiple of ${d}.`
          : frame === 3
            ? `Packs come in sets of ${d}. Which of these counts are full sets with nothing left over? Select every multiple of ${d}.`
            : `A light blinks every ${d} seconds. Which of these times, in seconds, are blinks? Select every multiple of ${d}.`;
  return selectProblem(meta, seed, {
    prompt,
    hint: multipleHint(d),
    explanation: [
      `A multiple of ${d} is ${d} times a whole number, so dividing by ${d} leaves no remainder.`,
      `The multiples of ${d} in the list are ${multiples.join(", ")}.`,
      `The other numbers are 1 away from a multiple, so each leaves a remainder.`,
    ],
    options,
    variant: `of-${d}`,
    axes: { divisor: String(d) },
  });
}

/** Dividend first, then the one-digit divisor, so no other number leads. */
function quotientStory(r: Random, dividend: string, divisor: string): string {
  const name = storyName((n) => r(0, n - 1));
  return pick(r, [
    `Divide ${dividend} by ${divisor}.`,
    `${name} packs ${dividend} books onto shelves that hold ${divisor} books each.`,
    `${name} splits ${dividend} players into teams of ${divisor}.`,
    `A bakery packs ${dividend} cookies into boxes of ${divisor}.`,
    `${name} cuts ${dividend} inches of ribbon into pieces of ${divisor} inches.`,
    `A warehouse stacks ${dividend} eggs into cartons of ${divisor}.`,
    `The card shop bundles ${dividend} cards into packs of ${divisor}.`,
    `${name} sorts ${dividend} pencils into cups of ${divisor}.`,
    `${name} loads ${dividend} juice boxes into coolers that hold ${divisor} each.`,
    `A library ties ${dividend} magazines into bundles of ${divisor}.`,
    `${name} plants ${dividend} seeds in rows of ${divisor}.`,
    `The band shares ${dividend} sheets of music into folders of ${divisor}.`,
  ]);
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
        const story = quotientStory(r, grouped(dividend), grouped(d));
        const tail =
          axes.form === "fraction"
            ? "Give the quotient and the remainder as a fraction of the divisor."
            : pick(r, [
                "Give the quotient and the remainder.",
                "How many full groups are there, and what is the remainder?",
                "What is the quotient, and what is left over?",
              ]);
        if (axes.form === "fraction") {
          const built = inlineSentence([
            "The quotient is ",
            slotOf("q", "Quotient", q, qWrong),
            ` and the remainder is `,
            slotOf("num", "Numerator of the remainder fraction", rem, rWrong),
            `/${d} of the divisor.`,
          ]);
          return multiPartProblem(meta, seed, r, {
            prompt: `${story} ${tail}`,
            layout: "inline",
            label: "Choose the quotient and the numerator",
            slots: built.slots,
            sentence: built.sentence,
            hint: `${grouped(d)} goes into ${grouped(dividend)} a whole number of times, with a remainder smaller than ${grouped(d)}. The fraction is that remainder over ${grouped(d)}.`,
            explanation: [
              `Find how many times ${grouped(d)} fits in ${grouped(dividend)}, then what is left.`,
              `${grouped(d)} × ${grouped(q)} = ${grouped(d * q)}, and ${grouped(dividend)} − ${grouped(d * q)} = ${grouped(rem)}.`,
              `The remainder ${grouped(rem)} is smaller than the divisor ${grouped(d)}, so the fraction of the divisor is ${rem}/${d}.`,
              `${grouped(dividend)} ÷ ${grouped(d)} = ${grouped(q)} and ${rem}/${d}.`,
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
          prompt: `${story} ${tail}`,
          layout: "inline",
          label: "Choose the quotient and the remainder",
          slots: built.slots,
          sentence: built.sentence,
          hint: `Find how many times ${grouped(d)} fits in ${grouped(dividend)}. The remainder is what is left, and it is smaller than ${grouped(d)}.`,
          explanation: [
            `Find how many times ${grouped(d)} fits in ${grouped(dividend)}, then what is left.`,
            `${grouped(d)} × ${grouped(q)} = ${grouped(d * q)}.`,
            `${grouped(dividend)} − ${grouped(d * q)} = ${grouped(rem)}, and ${grouped(rem)} is smaller than ${grouped(d)}.`,
            `The quotient is ${grouped(q)} and the remainder is ${grouped(rem)}.`,
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
