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
import { learnerName } from "./story-kit/fractions";

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
    ? [2, 3, 4, 6][r(0, 3)]!
    : [4, 5, 6, 8, 10, 12][r(0, 5)]!;
  const numerator = above
    ? r(denominator + 1, Math.min(denominator + 3, 8))
    : r(3, Math.min(denominator - 1, 8));
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
  const name = learnerName(r);
  const frames = above
    ? [
        `The strips show ${target}, more than one whole. Which sums of denominator ${denominator} match that shade? Choose ${keyed.length}.`,
        `${name} joins pieces of size 1/${denominator} to make ${target}. Which sums equal that amount? Choose ${keyed.length}.`,
        `Two ribbons together make ${target}. Which sums with denominator ${denominator} equal that length? Choose ${keyed.length}.`,
        `${target} is shaded on the strips. Which sums with denominator ${denominator} equal it? Choose ${keyed.length}.`,
      ]
    : [
        `The strips show ${target}. Which sums of pieces with denominator ${denominator} match that shade? Choose ${keyed.length}.`,
        `${name} shades ${target} of a chocolate bar cut into ${denominator} equal pieces. Which sums equal that shade? Choose ${keyed.length}.`,
        `A licorice stick is ${target} of a foot, in pieces of 1/${denominator} foot. Which sums equal that length? Choose ${keyed.length}.`,
        `${target} of a chocolate bar is left, in pieces of 1/${denominator}. Which sums equal that amount? Choose ${keyed.length}.`,
      ];
  return problem(template, seed, {
    prompt: frames[r(0, frames.length - 1)]!,
    response: {
      kind: "multi-select",
      label: "Choose every matching sum",
      selectionCount: keyed.length,
      options,
    },
    answer,
    hint: `The shaded amount is ${numerator} pieces of size 1/${denominator}. Add the numerators. A match uses denominator ${denominator} and totals ${numerator}.`,
    explanation: [
      `The shaded amount is ${count(numerator, "piece")} of size 1/${denominator}${wholes > 1 ? ", which is more than 1 whole" : ""}.`,
      `Fractions with the same denominator add by their numerators. A sum equals the shade when those numerators add to ${numerator}.`,
      `A sum that uses a different denominator, or whose numerators add to something else, does not match.`,
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
  const totalPieces = (firstWhole + secondWhole) * denominator + first + second;
  const answer = rational(totalPieces, denominator);
  const wholeSum = Math.floor(totalPieces / denominator);
  const rest = totalPieces % denominator;
  const mixedText =
    rest === 0
      ? String(wholeSum)
      : wholeSum === 0
        ? `${rest}/${denominator}`
        : `${wholeSum} ${rest}/${denominator}`;
  const name = learnerName(r);
  const frames = [
    `${name} cuts one ribbon ${firstWhole} ${first}/${denominator} feet long and another ${secondWhole} ${second}/${denominator} feet long. How long are they together? Give a fraction or a whole number.`,
    `${name} hikes ${firstWhole} ${first}/${denominator} miles, then ${secondWhole} ${second}/${denominator} miles more. How far is that in all? Give a fraction or a whole number.`,
    `A recipe uses ${firstWhole} ${first}/${denominator} cups of flour and ${secondWhole} ${second}/${denominator} cups of oats. How many cups is that together? Give a fraction or a whole number.`,
    `${name} practices piano for ${firstWhole} ${first}/${denominator} hours and soccer for ${secondWhole} ${second}/${denominator} hours. How long is that in all? Give a fraction or a whole number.`,
    `${name} pours ${firstWhole} ${first}/${denominator} liters of water, then ${secondWhole} ${second}/${denominator} liters more. How much water is that? Give a fraction or a whole number.`,
    `One board is ${firstWhole} ${first}/${denominator} feet. Another is ${secondWhole} ${second}/${denominator} feet. How long are the boards together? Give a fraction or a whole number.`,
  ];
  return problem(template, seed, {
    prompt: frames[r(0, frames.length - 1)]!,
    response: { kind: "fraction", label: "Sum" },
    answer,
    hint: `Add the whole numbers ${firstWhole} and ${secondWhole}. Then add ${first}/${denominator} and ${second}/${denominator}. If those fraction parts add to ${denominator} or more, trade ${count(denominator, "part")} for 1 whole.`,
    explanation: [
      `Add the whole numbers first: ${firstWhole} + ${secondWhole} = ${firstWhole + secondWhole}.`,
      `The fraction parts are ${first}/${denominator} and ${second}/${denominator}. Add the numerators: ${first} + ${second} = ${first + second}.`,
      first + second >= denominator
        ? `${first + second} is at least ${denominator}, so trade ${Math.floor((first + second) / denominator)} whole. That leaves ${(first + second) % denominator}/${denominator}.`
        : `${first + second} is less than ${denominator}, so the fraction part does not make another whole.`,
      `The sum is ${mixedText}. The answer box takes a fraction or a whole number in simplest form, which is ${answer}.`,
    ],
  });
}

/** FR-3. Add two like fractions in a situation where those fractions are natural. */
function sumStory(seed: string): GeneratedProblem {
  const template = byId.get("like-fraction-sum-story")!;
  const r = random(template.id, seed);
  const pools = [
    [2, 4, 8],
    [3, 6, 12],
    [5, 10],
    [4, 8, 16],
    [10, 100],
  ] as const;
  const pool = pools[r(0, pools.length - 1)]!;
  const denominator = pool[r(0, pool.length - 1)]!;
  const first = r(1, denominator - 1);
  const second = r(1, denominator - 1);
  const answer = rational(first + second, denominator);
  const name = learnerName(r);
  const over = first + second > denominator;
  const small = denominator <= 12;
  const frames = over
    ? [
        `${name} walks ${first}/${denominator} of a mile, then ${second}/${denominator} of a mile farther. How far does ${name} walk in all?`,
        `${name} uses ${first}/${denominator} of a liter of paint, then ${second}/${denominator} of a liter more. How much paint is that in all?`,
        `${name} practices ${first}/${denominator} of an hour, then ${second}/${denominator} of an hour more. How long is practice in all?`,
        `One piece of ribbon is ${first}/${denominator} of a foot. Another is ${second}/${denominator} of a foot. How long are they together?`,
        `${name} pours ${first}/${denominator} of a liter, then ${second}/${denominator} of a liter more, into a bucket. How much water is that?`,
        `${name} runs ${first}/${denominator} of a lap, then ${second}/${denominator} of a lap. How many laps is that?`,
      ]
    : small
      ? [
          `${name} eats ${first}/${denominator} of a pizza. A friend eats ${second}/${denominator} of the same pizza. How much of the pizza did they eat together?`,
          `${name} reads ${first}/${denominator} of a chapter, then ${second}/${denominator} of that chapter. How much of the chapter is that?`,
          `${name} plants flowers in ${first}/${denominator} of a garden bed and herbs in ${second}/${denominator} of the same bed. How much of the bed is planted?`,
          `A recipe needs ${first}/${denominator} of a cup of sugar and ${second}/${denominator} of a cup of flour. How many cups is that together?`,
          `${name} paints ${first}/${denominator} of a poster in the morning and ${second}/${denominator} of it after school. How much of the poster is painted?`,
          `${name} drinks ${first}/${denominator} of a liter of juice, then ${second}/${denominator} of a liter more. How much juice is that?`,
        ]
      : [
          `${name} pours ${first}/${denominator} of a liter of water, then ${second}/${denominator} of a liter more. How much water is that?`,
          `${name} uses ${first}/${denominator} of a meter of ribbon, then ${second}/${denominator} of a meter more. How much ribbon is that?`,
          `${name} walks ${first}/${denominator} of a mile, then ${second}/${denominator} of a mile more. How far is that?`,
          `A science tray holds ${first}/${denominator} of a liter, and ${name} adds ${second}/${denominator} of a liter. How much is in the tray?`,
        ];
  return problem(template, seed, {
    prompt: frames[r(0, frames.length - 1)]!,
    response: { kind: "fraction", label: "Amount in all" },
    answer,
    hint: `The denominators match, so add the numerators ${first} and ${second}. The denominator stays ${denominator}.`,
    explanation: [
      `Both fractions use the denominator ${denominator}, so they count pieces of the same size.`,
      `Add the numerators: ${first} + ${second} = ${first + second}. The denominator stays ${denominator}.`,
      first + second === denominator
        ? `That is exactly 1 whole, so the sum is ${answer}.`
        : first + second > denominator
          ? `${first + second}/${denominator} is more than 1 whole. In simplest form, the sum is ${answer}.`
          : `That is ${first + second}/${denominator}. In simplest form, the sum is ${answer}.`,
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
      label: "How many unit fractions in the first fraction",
      correct: String(unitCopies),
      wrong: copyWrongs,
    },
    ` $\\times${frac(1, denominator)}$\n`,
    commute
      ? `$${frac(group, denominator)}\\times ${copies}=$ `
      : `$${copies}\\times${frac(group, denominator)}=$ `,
    {
      id: "pieces",
      label: "How many unit fractions in the product",
      correct: String(product),
      wrong: pieceWrongs,
    },
    ` $\\times${frac(1, denominator)}$`,
  ]);
  return multiPartProblem(template, seed, r, {
    prompt: [
      `The strips show pieces of size $\\frac{1}{${denominator}}$. How many of those pieces are in each line? Fill in both boxes.`,
      `Each piece on the strips is $\\frac{1}{${denominator}}$ of the whole. Fill in both boxes.`,
      `Count the $\\frac{1}{${denominator}}$ pieces in the fraction, then in the product. Fill in both boxes.`,
      `Two lines use pieces of size $\\frac{1}{${denominator}}$. Fill in both boxes.`,
    ][r(0, 3)]!,
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
    prompt: [
      `${learnerName(r)} marks point $P$ on a trail line. Each mile is ${base} equal steps. Which fractions name $P$? Choose 3.`,
      `The fuel mark $P$ sits on a line split into ${base} equal steps per whole. Which fractions name $P$? Choose 3.`,
      `A ribbon is measured on a line with ${base} equal steps in each foot. Point $P$ is marked. Which fractions name $P$? Choose 3.`,
      `${learnerName(r)} finds point $P$ on a ruler. Each inch has ${base} equal steps. Which fractions name $P$? Choose 3.`,
      `Point $P$ is a stop on a number line. Each whole has ${base} equal steps. Which fractions name $P$? Choose 3.`,
    ][r(0, 4)]!,
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
      `Point $P$ is ${count(steps, "step")} from 0, and each whole has ${base} equal steps, so $P$ is at ${steps}/${base}.`,
      `Multiply the numerator and the denominator by the same number to rename that point. The value stays the same.`,
      `Three of the fractions name that same point. The others count a different number of steps.`,
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
  const name = learnerName(r);
  const prompts = [
    `Each fraction names parts of the same whole. Choose the symbol that makes each comparison true.`,
    `${name} compares two pairs of fractions of the same whole. Choose the symbol that makes each comparison true.`,
    `The fractions are parts of one pizza, then parts of one ribbon. Choose the symbol that makes each comparison true.`,
    `Same-size wholes: choose the symbol that makes each comparison true.`,
    `${name} looks at two pairs. Choose <, =, or > for each pair.`,
  ];
  return multiPartProblem(template, seed, r, {
    prompt: prompts[r(0, prompts.length - 1)]!,
    layout: "cards",
    reuse: true,
    label: "Put a symbol card in each box",
    slots: built.slots,
    sentence: built.sentence,
    hint: `Find a common denominator for $\\frac{${a}}{${b}}$ and $\\frac{${c}}{${d}}$, and for $\\frac{${e}}{${f}}$ and $\\frac{${g}}{${h}}$. Then compare the numerators.`,
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
  const name = learnerName(r);
  const [a0, b0] = rows[0]!;
  const [a1, b1] = rows[1]!;
  const prompts = [
    `Two ropes are ${a0} meters and ${b0} meters. Two more are ${a1} meters and ${b1} meters. Choose the symbol for each pair.`,
    `${name} compares seedlings ${a0} meters tall and ${b0} meters tall, then ${a1} meters and ${b1} meters. Choose the symbol for each pair.`,
    `Two bottles hold ${a0} liters and ${b0} liters. Two more hold ${a1} liters and ${b1} liters. Choose the symbol for each pair.`,
    `Reaction times are ${a0} seconds and ${b0} seconds, then ${a1} seconds and ${b1} seconds. Choose the symbol for each pair.`,
    `Two notebooks are ${a0} centimeters thick and ${b0} centimeters thick, then ${a1} centimeters and ${b1} centimeters. Choose the symbol for each pair.`,
  ];
  return multiPartProblem(template, seed, r, {
    prompt: prompts[r(0, prompts.length - 1)]!,
    layout: "cards",
    reuse: true,
    label: "Put a symbol card in each box",
    slots: built.slots,
    sentence: built.sentence,
    hint: `Line up ${rows[0]![0]} and ${rows[0]![1]}, and ${rows[1]![0]} and ${rows[1]![1]}, by the decimal point. A zero at the end of a decimal does not change its value. Then compare tenths, then hundredths.`,
    explanation: rows.map(([left, right]) => {
      const leftValue = asHundredths(left);
      const rightValue = asHundredths(right);
      if (leftValue === rightValue)
        return `${left} and ${right} name the same amount. A zero written at the end of a decimal does not change its value, so the symbol is =.`;
      const [greater, lesser] =
        leftValue > rightValue ? [left, right] : [right, left];
      return `Line the decimals up at the decimal point and compare tenths, then hundredths. ${greater} is greater than ${lesser}.`;
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
  const tenths = r(0, 2) === 0;
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
    const start = [1, 3, 5][r(0, 2)]!;
    offsets = [start, start + 4, start + 8, start + 12];
    targetOffset = offsets[r(0, 3)]!;
    const fractionText = `$\\frac{${targetOffset}}{10}$`;
    prompt = [
      `Which point is at ${fractionText}?`,
      `Which letter marks ${fractionText} on the line?`,
      `The line counts tenths from 0 to 2. Which point is at ${fractionText}?`,
      `Find the point at ${fractionText}.`,
    ][r(0, 3)]!;
    hint = `The left end is 0. Each step is one tenth. Count ${count(targetOffset, "step")} to reach ${targetOffset}/10.`;
    explanationValue = `$\\frac{${targetOffset}}{10}$`;
  } else {
    windowStart = r(0, 18) * 10;
    offsets = [1, 4, 7, 9];
    targetOffset = offsets[r(0, 3)]!;
    min = hundredths(windowStart);
    max = hundredths(windowStart + 10);
    step = 0.01;
    const target = hundredths(windowStart + targetOffset);
    const decimalText = target.toFixed(2);
    prompt = [
      `Which point is at ${decimalText}?`,
      `Which letter marks ${decimalText} on the line?`,
      `The line is a close-up from ${plainDecimal(min)} to ${plainDecimal(max)}. Which point is at ${decimalText}?`,
      `Find the point at ${decimalText}.`,
    ][r(0, 3)]!;
    hint = `The left end is ${plainDecimal(min)}. Each step is one hundredth. Count ${count(targetOffset, "step")} to reach ${decimalText}.`;
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
      `Only the ends of the line are numbered. The left end is ${tenths ? "0" : plainDecimal(min)}.`,
      `Each step is one ${tenths ? "tenth" : "hundredth"}. Count ${count(targetOffset, "step")} from that left end.`,
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
    note: "Only the ends of the line are numbered. Count the ticks from an end to a letter.",
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
  const zeroTenths = r(0, 9) < 5;
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
  const name = learnerName(r);
  const prompts = [
    `In ${shown}, name the digit ${asked.digit}. Complete the sentence.`,
    `${name} sees the number ${shown}. The digit to look at is ${asked.digit}. Complete the sentence.`,
    `A length is ${shown} meters. Name the place and the value of the digit ${asked.digit}. Complete the sentence.`,
    `The price is ${shown} dollars. Complete the sentence about the digit ${asked.digit}.`,
  ];
  return multiPartProblem(template, seed, r, {
    prompt: prompts[r(0, prompts.length - 1)]!,
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
