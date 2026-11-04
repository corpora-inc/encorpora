import { createHash } from "node:crypto";
import { count } from "./agreement";
import { choiceSurface, type ChoiceOption } from "./chain-kit";
import {
  generatedProblemSchema,
  type GeneratedProblem,
  type SemanticFigure,
  type TemplateMetadata,
} from "./contracts";
import {
  random,
  rational,
  shuffle,
  type Random,
} from "./distribution-practice";
import {
  frac,
  gcd,
  inlineSentence,
  multiPartProblem,
} from "./multi-part-support";
import { numberLine } from "./scene/author";
import { serializeSelection } from "./selection-response";

/** Grade-4 denominators. 16 is the light Florida extra. */
const DENOM_ROWS: readonly (readonly [number, number])[] = [
  [2, 2],
  [3, 2],
  [4, 2],
  [6, 2],
  [8, 2],
  [5, 4],
  [10, 4],
  [12, 4],
  [100, 3],
  [16, 1],
];
const DENOM_TOTAL = 26;
const SYMBOLS = ["$<$", "$=$", "$>$"] as const;

const meta = (
  id: string,
  title: string,
  skillId: string,
  description: string,
  extra: Partial<TemplateMetadata> = {},
): TemplateMetadata => ({
  id,
  version: 1,
  title,
  skillId,
  gradeBand: "3–5",
  description,
  difficultyOffset: 0,
  ...extra,
});

export const grade4FractionsDecimalsTemplates: readonly TemplateMetadata[] = [
  meta(
    "fraction-decompositions-select",
    "Choose fraction sums",
    "like-fraction-addition",
    "Choose every sum of fractions with one denominator that matches a shaded amount, including a sum made only of unit fractions.",
    { requiredResponseCapability: "multi-select-v1" },
  ),
  meta(
    "mixed-fraction-sum",
    "Add mixed numbers",
    "mixed-numbers",
    "Add mixed numbers that share a denominator, including sums that regroup into the next whole.",
  ),
  meta(
    "like-fraction-sum-story",
    "Add fractions in a story",
    "like-fraction-addition",
    "Add two fractions of the same whole in a story about length, volume, or time.",
  ),
  meta(
    "unit-fraction-multiple-blanks",
    "Unit fraction copies",
    "fraction-times-whole",
    "Fill both boxes to write a fraction as copies of a unit fraction and a product as copies of that unit fraction.",
    { requiredResponseCapability: "multi-part-choice-v1" },
  ),
  meta(
    "equivalent-fractions-number-line",
    "Fractions on a number line",
    "fraction-equivalence",
    "Choose every fraction that names one marked point on a number line, using at least three denominators.",
    { requiredResponseCapability: "multi-select-v1" },
  ),
  meta(
    "compare-fractions-symbol-blanks",
    "Compare fractions with symbols",
    "fraction-comparison",
    "Choose greater than, equal to, or less than for each pair of fractions of the same whole.",
    { requiredResponseCapability: "multi-part-choice-v1" },
  ),
  meta(
    "compare-decimals-symbol-blanks",
    "Compare decimals with symbols",
    "compare-decimals",
    "Choose greater than, equal to, or less than for each pair of decimals to hundredths.",
    { requiredResponseCapability: "multi-part-choice-v1" },
  ),
  meta(
    "decimal-fraction-locate",
    "Locate a decimal or a fraction",
    "decimal-fractions",
    "Choose the letter of the point at a given fraction or decimal on a number line.",
    {
      requiredResponseCapability: "single-choice-v1",
      requiredFigureCapability: "scenes-v1",
    },
  ),
  meta(
    "decimal-place-value-hundredths",
    "Decimal place value to hundredths",
    "decimal-fractions",
    "Name the place and the value of one digit in a decimal that stops at hundredths.",
    { requiredResponseCapability: "multi-part-choice-v1" },
  ),
];

const byId = new Map(
  grade4FractionsDecimalsTemplates.map((template) => [template.id, template]),
);

function problem(
  template: TemplateMetadata,
  seed: string,
  draft: {
    prompt: string;
    response: GeneratedProblem["public"]["response"];
    answer: string;
    hint: string;
    explanation: string[];
    figure?: SemanticFigure;
    choiceFeedback?: Record<string, string>;
  },
): GeneratedProblem {
  return generatedProblemSchema.parse({
    public: {
      id: createHash("sha256")
        .update(JSON.stringify([template.id, 1, seed]))
        .digest("hex"),
      templateId: template.id,
      templateVersion: 1,
      seed,
      prompt: draft.prompt,
      skillId: template.skillId,
      response: draft.response,
      ...(draft.figure ? { figure: draft.figure } : {}),
    },
    answer: draft.answer,
    hint: draft.hint,
    explanation: draft.explanation,
    ...(draft.choiceFeedback ? { choiceFeedback: draft.choiceFeedback } : {}),
  });
}

function weightedDenom(r: Random): number {
  let draw = r(0, DENOM_TOTAL - 1);
  for (const [den, weight] of DENOM_ROWS) {
    if (draw < weight) return den;
    draw -= weight;
  }
  throw new Error("Denominator table missed");
}

const lcm = (a: number, b: number) => (a / gcd(a, b)) * b;

function sameAmount(
  parts: readonly { n: number; d: number }[],
  targetN: number,
  targetD: number,
): boolean {
  let multiple = targetD;
  for (const part of parts) multiple = lcm(multiple, part.d);
  const numerator = parts.reduce(
    (sum, part) => sum + part.n * (multiple / part.d),
    0,
  );
  return numerator * targetD === targetN * multiple;
}

function targetText(numerator: number, denominator: number): string {
  const wholes = Math.floor(numerator / denominator);
  const rest = numerator % denominator;
  if (wholes === 0) return `$\\frac{${numerator}}{${denominator}}$`;
  if (rest === 0) return `$${wholes}$`;
  return `$${wholes}\\frac{${rest}}{${denominator}}$`;
}

function sumLabel(parts: readonly number[], denominator: number): string {
  return `$${parts.map((part) => `\\frac{${part}}{${denominator}}`).join("+")}$`;
}

function fractionParts(label: string): { n: number; d: number }[] {
  return [...label.matchAll(/\\frac\{(\d+)\}\{(\d+)\}/g)].map((match) => ({
    n: Number(match[1]),
    d: Number(match[2]),
  }));
}

/** FR-1. Every keyed sum uses the target denominator. One option is only unit fractions. */
function decompositions(seed: string): GeneratedProblem {
  const template = byId.get("fraction-decompositions-select")!;
  const r = random(template.id, seed);
  const above = r(0, 4) < 2;
  const denominator = above
    ? [2, 3, 4][r(0, 2)]!
    : [4, 5, 6, 8, 10, 12][r(0, 5)]!;
  const numerator = above
    ? r(denominator + 1, 6)
    : r(3, Math.min(denominator - 1, 6));
  const keyed = [
    sumLabel(
      Array.from({ length: numerator }, () => 1),
      denominator,
    ),
    sumLabel([numerator - 1, 1], denominator),
  ];
  if (numerator >= 4) keyed.push(sumLabel([numerator - 2, 2], denominator));
  const candidates = [
    sumLabel(
      Array.from({ length: numerator - 1 }, () => 1),
      denominator,
    ),
    `$\\frac{${numerator}}{${denominator}}+\\frac{1}{${denominator}}$`,
    `$\\frac{1}{${denominator + denominator}}+\\frac{${numerator}}{${denominator}}$`,
    `$\\frac{${numerator + 1}}{${denominator}}+\\frac{1}{${denominator + 1}}$`,
  ];
  const wrongs = candidates.filter((label) => {
    const parts = fractionParts(label);
    return !keyed.includes(label) && !sameAmount(parts, numerator, denominator);
  });
  if (wrongs.length < 2) throw new Error("Decomposition needs two distractors");
  const chosenWrongs = wrongs.slice(0, 3);
  const labels = [...keyed, ...chosenWrongs];
  if (new Set(labels).size !== labels.length)
    throw new Error("Decomposition labels collide");
  const cards = shuffle(
    r,
    labels.map((label) => ({ label, keyed: keyed.includes(label) })),
  );
  const options = cards.map((card, index) => ({
    id: `option-${"abcdefgh"[index]}`,
    label: card.label,
  }));
  const answer = serializeSelection(
    options
      .filter((_, index) => cards[index]!.keyed)
      .map((option) => option.id),
  );
  const wholes = Math.ceil(numerator / denominator);
  const target = targetText(numerator, denominator);
  return problem(template, seed, {
    prompt: `Which sums equal ${target}? The pieces in each sum use the denominator ${denominator}. Choose ${keyed.length}.`,
    response: {
      kind: "multi-select",
      label: "Choose every matching sum",
      selectionCount: keyed.length,
      options,
    },
    answer,
    hint: `Add the top numbers in each sum. They must match the shaded count on the strips for ${target}. The denominator is ${denominator}.`,
    explanation: [
      `Each sum uses the denominator ${denominator}.`,
      `The shaded amount is ${count(numerator, "piece")} of size 1/${denominator}${wholes > 1 ? ", which is more than 1 whole" : ""}.`,
      `A sum matches when its top numbers add to ${numerator}. One matching sum is only copies of 1/${denominator}.`,
    ],
    figure: {
      kind: "fraction-strips",
      parts: denominator,
      wholes,
      rows: [{ selected: numerator, label: "shaded amount" }],
      unit: "one whole",
    },
  });
}

/** FR-2. Same answer text as mixed-number subtraction: a reduced fraction or a whole number. */
function mixedSum(seed: string): GeneratedProblem {
  const template = byId.get("mixed-fraction-sum")!;
  const r = random(template.id, seed);
  const denominator = weightedDenom(r);
  const firstWhole = r(1, 3);
  const secondWhole = r(1, 3);
  const regroup = denominator === 2 || r(0, 9) < 7;
  let first: number;
  let second: number;
  if (denominator === 2) {
    first = 1;
    second = 1;
  } else if (regroup) {
    first = r(1, denominator - 1);
    second = r(Math.max(1, denominator - first), denominator - 1);
  } else {
    first = r(1, denominator - 2);
    second = r(1, denominator - first - 1);
  }
  const answer = rational(
    (firstWhole + secondWhole) * denominator + first + second,
    denominator,
  );
  return problem(template, seed, {
    prompt: `Find ${firstWhole} ${first}/${denominator} + ${secondWhole} ${second}/${denominator}. Give a fraction or whole number.`,
    response: { kind: "fraction", label: "Sum" },
    answer,
    hint: `Add the whole numbers ${firstWhole} and ${secondWhole}. Then add ${first}/${denominator} and ${second}/${denominator}. If those fraction parts add to ${denominator} or more, trade ${count(denominator, "part")} for 1 whole.`,
    explanation: [
      `Add the whole numbers first: ${firstWhole} and ${secondWhole}.`,
      `The fraction parts are ${first}/${denominator} and ${second}/${denominator}.`,
      first + second >= denominator
        ? `Those parts make ${count(first + second, "piece")}, and ${count(denominator, "piece")} make 1 whole, so the sum regroups.`
        : `Those parts make ${count(first + second, "piece")}, which is less than 1 whole, so the sum does not regroup.`,
      `The sum is ${answer}.`,
    ],
  });
}

/** FR-3. Join two fractions of one stated whole. The sum is always greater than 1. */
function sumStory(seed: string): GeneratedProblem {
  const template = byId.get("like-fraction-sum-story")!;
  const r = random(template.id, seed);
  const denominator = weightedDenom(r);
  const first = r(1, denominator);
  const second = r(Math.max(1, denominator - first + 1), denominator);
  const answer = rational(first + second, denominator);
  const prompts = [
    `Maya walks ${first}/${denominator} of a meter along a path, then ${second}/${denominator} of a meter farther on the same path. The two lengths are parts of the same path. How much of the path does she walk in all?`,
    `You pour ${first}/${denominator} of a liter into a jug, then ${second}/${denominator} of a liter more into the same jug. Both amounts are parts of that one jug. How much water is in the jug?`,
    `A chore takes ${first}/${denominator} of an hour, then another part of the same chore takes ${second}/${denominator} of an hour. Both times are parts of the same chore. How long do the two parts take together?`,
  ];
  return problem(template, seed, {
    prompt: prompts[r(0, 2)]!,
    response: { kind: "fraction", label: "Amount in all" },
    answer,
    hint: `Add the numerators ${first} and ${second}. Both fractions use the denominator ${denominator}. The two parts are of the same whole.`,
    explanation: [
      `Both fractions name parts of the same whole, and both use the denominator ${denominator}.`,
      `The numerators ${first} and ${second} make ${count(first + second, "part")}.`,
      `Together they make ${answer}.`,
    ],
  });
}

/** FR-5. Both unit-fraction forms, with the product sometimes written fraction first. */
function unitMultiple(seed: string): GeneratedProblem {
  const template = byId.get("unit-fraction-multiple-blanks")!;
  const r = random(template.id, seed);
  const denominator = [3, 4, 5, 6, 8, 10, 12][r(0, 6)]!;
  const cap = Math.min(4, denominator - 1);
  const group = r(2, cap);
  const copies = r(2, 5);
  const unitCopies = r(2, cap);
  const product = copies * group;
  const commute = r(0, 4) < 2;
  const distinct = (values: number[], correct: number) => {
    const seen = new Set<number>();
    const out: string[] = [];
    for (const value of values) {
      if (value === correct || seen.has(value)) continue;
      seen.add(value);
      out.push(String(value));
    }
    return out;
  };
  const copyWrongs = distinct(
    [unitCopies + 1, unitCopies * denominator, 1, denominator],
    unitCopies,
  );
  const pieceWrongs = distinct(
    [copies + group, product + 1, group, copies * denominator],
    product,
  );
  if (copyWrongs.length < 3 || pieceWrongs.length < 3)
    throw new Error("Unit-fraction blanks need three wrong choices");
  const built = inlineSentence([
    `$${frac(unitCopies, denominator)}=$ `,
    {
      id: "copies",
      label: "How many copies of the unit fraction",
      correct: String(unitCopies),
      wrong: copyWrongs,
    },
    ` $\\times${frac(1, denominator)}$\n`,
    commute
      ? `$${frac(group, denominator)}\\times ${copies}=$ `
      : `$${copies}\\times${frac(group, denominator)}=$ `,
    {
      id: "pieces",
      label: "How many pieces in the product",
      correct: String(product),
      wrong: pieceWrongs,
    },
    ` $\\times${frac(1, denominator)}$`,
  ]);
  return multiPartProblem(template, seed, r, {
    prompt: `Fill in both boxes. The pieces are of size $\\frac{1}{${denominator}}$.`,
    layout: "inline",
    label: "Fill in both boxes",
    slots: built.slots,
    sentence: built.sentence,
    figure: {
      kind: "fraction-strips",
      parts: denominator,
      wholes: 1,
      rows: [{ selected: group, label: "one group" }],
      unit: "one whole",
    },
    hint: `The second line shows ${copies} groups of ${group} pieces. Each piece is 1/${denominator}.`,
    explanation: [
      `$\\frac{${unitCopies}}{${denominator}}$ is ${count(unitCopies, "copy", "copies")} of $\\frac{1}{${denominator}}$.`,
      commute
        ? `$\\frac{${group}}{${denominator}}\\times ${copies}$ is ${count(copies, "group")} of ${count(group, "piece")}.`
        : `$${copies}\\times\\frac{${group}}{${denominator}}$ is ${count(copies, "group")} of ${count(group, "piece")}.`,
      `That product is ${count(product, "copy", "copies")} of $\\frac{1}{${denominator}}$.`,
    ],
  });
}

/** FR-6. One point, named in three denominators. The line itself stays within twelfths. */
function numberLineNames(seed: string): GeneratedProblem {
  const template = byId.get("equivalent-fractions-number-line")!;
  const r = random(template.id, seed);
  const base = [2, 3, 4, 5][r(0, 3)]!;
  const above = r(0, 4) < 2;
  const steps = above ? r(base + 1, 2 * base) : r(1, base - 1);
  let denominators: number[];
  if (base === 3) denominators = [3, 6, 12];
  else if (base === 4) denominators = [4, 8, 12];
  else if (base === 5) denominators = [5, 10, 100];
  else {
    denominators = shuffle(r, [2, 4, 6, 8, 10, 12]).slice(0, 3);
    if (r(0, 1) === 0) denominators[r(0, 2)] = 100;
  }
  const labelFor = (numerator: number, denominator: number) =>
    `$\\frac{${numerator}}{${denominator}}$`;
  const keyed = denominators.map((denominator) =>
    labelFor((steps * denominator) / base, denominator),
  );
  const wrongs = [
    labelFor(steps + 1, base),
    labelFor(steps, base + 1),
    labelFor(steps, 2 * base),
  ].filter((label) => {
    const [{ n, d }] = fractionParts(label);
    return n! * base !== steps * d! && !keyed.includes(label);
  });
  if (new Set(keyed).size !== 3 || wrongs.length < 3)
    throw new Error("Number-line names collided");
  const cards = shuffle(
    r,
    [...keyed, ...wrongs.slice(0, 3)].map((label) => ({
      label,
      keyed: keyed.includes(label),
    })),
  );
  const options = cards.map((card, index) => ({
    id: `option-${"abcdefgh"[index]}`,
    label: card.label,
  }));
  return problem(template, seed, {
    prompt: `Point $P$ is marked on the line. Each whole is split into ${base} equal steps. Which fractions name $P$? Choose 3.`,
    response: {
      kind: "multi-select",
      label: "Choose every fraction that names the point",
      selectionCount: 3,
      options,
    },
    answer: serializeSelection(
      options
        .filter((_, index) => cards[index]!.keyed)
        .map((option) => option.id),
    ),
    hint: above
      ? `Count the steps from 0 to $P$, past 1. Each whole has ${base} equal steps. A fraction names $P$ when its steps match, even if the denominator changes.`
      : `Count the steps from 0 to $P$. Each whole has ${base} equal steps. A fraction names $P$ when its steps match, even if the denominator changes.`,
    explanation: [
      `Point $P$ is ${count(steps, "step")} from 0, and each whole has ${base} equal steps.`,
      `A fraction names $P$ when its numerator counts the same steps after the denominator changes.`,
      `The three names use three denominators.`,
    ],
    figure: {
      kind: "rational-line",
      denominator: base,
      maxWhole: above ? Math.ceil(steps / base) : 1,
      points: [{ numerator: steps, label: "P" }],
      unit: "one whole",
    },
  });
}

type FractionPair = {
  left: [number, number];
  right: [number, number];
  equalScale?: number;
};

function symbolFor(left: number, right: number): (typeof SYMBOLS)[number] {
  if (left < right) return "$<$";
  if (left > right) return "$>$";
  return "$=$";
}

function unlikePair(r: Random): FractionPair {
  let leftD = weightedDenom(r);
  let rightD = weightedDenom(r);
  if (leftD === 2 && rightD === 2) rightD = 3;
  let leftN = r(1, leftD - 1);
  let rightN = r(1, rightD - 1);
  if (leftN * rightD === rightN * leftD) {
    if (rightN + 1 < rightD) rightN += 1;
    else if (leftN + 1 < leftD) leftN += 1;
    else return { left: [1, 2], right: [1, 3] };
  }
  if (leftN * rightD === rightN * leftD) return { left: [1, 2], right: [1, 3] };
  return { left: [leftN, leftD], right: [rightN, rightD] };
}

function equalPair(r: Random): FractionPair {
  const scales: readonly (readonly [number, number])[] = [
    [2, 2],
    [2, 3],
    [2, 4],
    [2, 5],
    [2, 6],
    [3, 2],
    [3, 4],
    [4, 2],
    [4, 3],
    [5, 2],
    [6, 2],
  ];
  const [base, scale] = scales[r(0, scales.length - 1)]!;
  const numerator = r(1, base - 1);
  return {
    left: [numerator, base],
    right: [numerator * scale, base * scale],
    equalScale: scale,
  };
}

function comparisonWords(left: number, right: number): string {
  if (left === right) return "the same amount";
  return left < right ? "less than" : "greater than";
}

/** FR-8. Record >, =, or < . An equal pair is about half the seeds. */
function fractionSymbols(seed: string): GeneratedProblem {
  const template = byId.get("compare-fractions-symbol-blanks")!;
  const r = random(template.id, seed);
  const withEqual = r(0, 1) === 0;
  const pairs = withEqual
    ? r(0, 1) === 0
      ? [equalPair(r), unlikePair(r)]
      : [unlikePair(r), equalPair(r)]
    : [unlikePair(r), unlikePair(r)];
  const slots = pairs.map((pair, index) => ({
    id: `c${index + 1}`,
    label: `The symbol for the ${index ? "second" : "first"} comparison`,
    correct: symbolFor(
      pair.left[0] * pair.right[1],
      pair.right[0] * pair.left[1],
    ),
    fixed: SYMBOLS,
  }));
  const built = inlineSentence([
    `$${frac(pairs[0]!.left[0], pairs[0]!.left[1])}$ `,
    slots[0]!,
    ` $${frac(pairs[0]!.right[0], pairs[0]!.right[1])}$\n$${frac(pairs[1]!.left[0], pairs[1]!.left[1])}$ `,
    slots[1]!,
    ` $${frac(pairs[1]!.right[0], pairs[1]!.right[1])}$`,
  ]);
  const [a, b] = pairs[0]!.left;
  const [c, d] = pairs[0]!.right;
  const [e, f] = pairs[1]!.left;
  const [g, h] = pairs[1]!.right;
  return multiPartProblem(template, seed, r, {
    prompt:
      "Each fraction names parts of the same whole. Choose the symbol that makes each comparison true.",
    layout: "cards",
    reuse: true,
    label: "Put a symbol card in each box",
    slots: built.slots,
    sentence: built.sentence,
    hint: `Rename $\\frac{${a}}{${b}}$ and $\\frac{${c}}{${d}}$, and $\\frac{${e}}{${f}}$ and $\\frac{${g}}{${h}}$, so each pair shares one denominator. Then compare the top numbers.`,
    explanation: pairs.map((pair) => {
      const multiple = lcm(pair.left[1], pair.right[1]);
      const leftTop = pair.left[0] * (multiple / pair.left[1]);
      const rightTop = pair.right[0] * (multiple / pair.right[1]);
      if (pair.equalScale)
        return `Both fractions name the same amount. $\\frac{${pair.left[0]}}{${pair.left[1]}}$ multiplied on the top and the bottom by ${pair.equalScale} is $\\frac{${pair.right[0]}}{${pair.right[1]}}$. The symbol means the same amount.`;
      return `Over the common denominator ${multiple}, the top numbers are ${leftTop} and ${rightTop}. ${leftTop} is ${comparisonWords(leftTop, rightTop)} ${rightTop}, so the first fraction is ${comparisonWords(leftTop, rightTop)} the second.`;
    }),
  });
}

function asHundredths(text: string): number {
  const [whole, fracPart = ""] = text.split(".");
  return Number(whole) * 100 + Number((fracPart + "00").slice(0, 2));
}

/** DE-1. One row is a trailing-zero match. The other mixes tenths and hundredths. */
function decimalSymbols(seed: string): GeneratedProblem {
  const template = byId.get("compare-decimals-symbol-blanks")!;
  const r = random(template.id, seed);
  const tenth = r(1, 9);
  const hundredth = r(1, 9);
  const equal: [string, string] = [`0.${tenth}`, `0.${tenth}0`];
  const unequal: [string, string] =
    r(0, 1) === 0
      ? [`0.${tenth}`, `0.${tenth}${hundredth}`]
      : [
          `0.${tenth}`,
          tenth === 1 ? `0.0${hundredth}` : `0.${tenth - 1}${hundredth}`,
        ];
  const rows = r(0, 1) === 0 ? [equal, unequal] : [unequal, equal];
  const slots = rows.map((row, index) => ({
    id: `c${index + 1}`,
    label: `The symbol for the ${index ? "second" : "first"} comparison`,
    correct: symbolFor(asHundredths(row[0]), asHundredths(row[1])),
    fixed: SYMBOLS,
  }));
  const built = inlineSentence([
    `${rows[0]![0]} `,
    slots[0]!,
    ` ${rows[0]![1]}\n${rows[1]![0]} `,
    slots[1]!,
    ` ${rows[1]![1]}`,
  ]);
  return multiPartProblem(template, seed, r, {
    prompt: "Choose the symbol that makes each comparison true.",
    layout: "cards",
    reuse: true,
    label: "Put a symbol card in each box",
    slots: built.slots,
    sentence: built.sentence,
    hint: `Line up ${rows[0]![0]} and ${rows[0]![1]}, and ${rows[1]![0]} and ${rows[1]![1]}, by the decimal point. A zero at the end of a decimal does not change its value. Then compare tenths, then hundredths.`,
    explanation: rows.map(([left, right]) => {
      const words = comparisonWords(asHundredths(left), asHundredths(right));
      return `${left} and ${right} are ${words}.`;
    }),
  });
}

function plainDecimal(value: number): string {
  return value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

/** DE-2. Locate a named value. End labels are a number array so the description does not state each letter's value. */
function locate(seed: string): GeneratedProblem {
  const template = byId.get("decimal-fraction-locate")!;
  const r = random(template.id, seed);
  const letters = ["A", "B", "C", "D"] as const;
  const tenths = r(0, 1) === 0;
  const hundredths = (n: number) => Number((n / 100).toFixed(2));
  let min: number;
  let max: number;
  let step: number;
  let denominator: number | undefined;
  let offsets: number[];
  let targetOffset: number;
  let windowStart = 0;
  let prompt: string;
  let hint: string;
  let explanationValue: string;
  if (tenths) {
    min = 0;
    max = 2;
    step = 0.1;
    denominator = 10;
    targetOffset = r(2, 17);
    offsets = [
      targetOffset - 1,
      targetOffset,
      targetOffset + 1,
      targetOffset + 2,
    ];
    prompt = `Which point is at $\\frac{${targetOffset}}{10}$?`;
    hint = `Start at 0. Each step is one tenth. Count ${targetOffset} steps to reach ${targetOffset}/10.`;
    explanationValue = `$\\frac{${targetOffset}}{10}$`;
  } else {
    windowStart = r(0, 18) * 10;
    targetOffset = r(2, 7);
    min = hundredths(windowStart);
    max = hundredths(windowStart + 10);
    step = 0.01;
    offsets = [
      targetOffset - 1,
      targetOffset,
      targetOffset + 1,
      targetOffset + 2,
    ];
    const target = hundredths(windowStart + targetOffset);
    prompt = `Which point is at ${target.toFixed(2)}?`;
    hint = `Start at ${plainDecimal(min)}. Each step is one hundredth. Count ${targetOffset} steps to reach ${target.toFixed(2)}.`;
    explanationValue = target.toFixed(2);
  }
  const order = shuffle(r, offsets);
  const correctLetter = letters[order.indexOf(targetOffset)]!;
  const marks = order.map((offset, index) => ({
    at: tenths ? offset / 10 : hundredths(windowStart + offset),
    label: letters[index]!,
  }));
  const options: ChoiceOption[] = letters.map((letter) =>
    letter === correctLetter
      ? { label: `$${letter}$`, correct: true as const }
      : {
          label: `$${letter}$`,
          feedback: "Count the steps again from the labeled end.",
        },
  );
  const surface = choiceSurface(r, {
    prompt,
    options,
    hint,
    explanation: [
      `Only the ends of the line are numbered.`,
      `Count ${count(targetOffset, "step")} from the left end.`,
      `Point $${correctLetter}$ is at ${explanationValue}.`,
    ],
    label: "Choose the point",
  });
  if (!surface) throw new Error("Four distinct point choices are required");
  const scene = numberLine({
    id: "line",
    min,
    max,
    ...(denominator ? { denominator } : { step }),
    // A number array of end labels keeps the unrevealed description from stating each letter's value.
    labels: [min, max],
    marks,
  }).scene({
    title: "Four points on a number line",
    note: "Only the ends of the line are numbered. Count the tick marks from an end to a letter.",
  });
  return problem(template, seed, {
    ...surface,
    figure: { kind: "scene", scene },
  });
}

/** DE-3. Exactly two decimal places. A zero tenths digit is common, and it is never the asked digit. */
function placeValue(seed: string): GeneratedProblem {
  const template = byId.get("decimal-place-value-hundredths")!;
  const r = random(template.id, seed);
  const ones = r(1, 9);
  const zeroTenths = r(0, 4) < 3;
  let tenths: number;
  if (zeroTenths) tenths = 0;
  else {
    tenths = r(1, 8);
    if (tenths >= ones) tenths += 1;
  }
  const pool = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter(
    (digit) => digit !== ones && digit !== tenths,
  );
  const hundredths = pool[r(0, pool.length - 1)]!;
  const places = [
    { name: "ones", digit: ones },
    { name: "tenths", digit: tenths },
    { name: "hundredths", digit: hundredths },
  ] as const;
  const asked = zeroTenths ? places[r(0, 1) === 0 ? 0 : 2]! : places[r(0, 2)]!;
  const shown = `${ones}.${tenths}${hundredths}`;
  const valueOf = (name: string, digit: number) =>
    name === "ones"
      ? String(digit)
      : name === "tenths"
        ? `0.${digit}`
        : `0.0${digit}`;
  const value = valueOf(asked.name, asked.digit);
  const wrongs =
    asked.name === "ones"
      ? [`0.${asked.digit}`, `0.0${asked.digit}`, `${asked.digit}0`]
      : asked.name === "tenths"
        ? [String(asked.digit), `0.0${asked.digit}`, `${asked.digit}0`]
        : [String(asked.digit), `0.${asked.digit}`, `${asked.digit}0`];
  const built = inlineSentence([
    `The digit ${asked.digit} is in the `,
    {
      id: "place",
      label: "The place of the digit",
      correct: asked.name,
      fixed: ["ones", "tenths", "hundredths"],
    },
    " place. Its value is ",
    {
      id: "value",
      label: "The value of the digit",
      correct: value,
      wrong: wrongs,
    },
    ".",
  ]);
  return multiPartProblem(template, seed, r, {
    prompt: `Complete the sentence about ${shown}.`,
    layout: "inline",
    label: "Complete the sentence",
    slots: built.slots,
    sentence: built.sentence,
    hint: `In ${shown}, the digit ${asked.digit} sits in one of the ones, tenths or hundredths places. The value is that digit times its place.`,
    explanation: [
      `${shown} stops at hundredths. The digits are ${ones}, then ${tenths}, then ${hundredths}.`,
      `The digit ${asked.digit} is in the ${asked.name} place.`,
      `Its value is ${value}.`,
    ],
  });
}

const builders: Record<string, (seed: string) => GeneratedProblem> = {
  "fraction-decompositions-select": decompositions,
  "mixed-fraction-sum": mixedSum,
  "like-fraction-sum-story": sumStory,
  "unit-fraction-multiple-blanks": unitMultiple,
  "equivalent-fractions-number-line": numberLineNames,
  "compare-fractions-symbol-blanks": fractionSymbols,
  "compare-decimals-symbol-blanks": decimalSymbols,
  "decimal-fraction-locate": locate,
  "decimal-place-value-hundredths": placeValue,
};

export function grade4FractionsDecimalsGenerate(
  templateId: string,
  seed: string,
): GeneratedProblem {
  const build = builders[templateId];
  if (!build || !byId.has(templateId))
    throw new Error(`Unknown template ${templateId}`);
  if (typeof seed !== "string" || !seed.length || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  return build(seed);
}
