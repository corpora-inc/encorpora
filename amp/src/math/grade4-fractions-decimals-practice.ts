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
import { clauseProblem } from "./fraction-clause-variants";
import { denomFits, learnerName } from "./story-kit/fractions";

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
    { requiredResponseCapability: "multi-select-v1", version: 2, reprintsFrom: 1 },
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
    {
      requiredResponseCapability: "multi-part-choice-v1",
      version: 2,
      reprintsFrom: 1,
    },
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
  const clause = clauseProblem(template.id, seed, template);
  if (clause) return clause;
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
  const frames = [
    `The strips show ${target} shaded. Which sums of pieces with denominator ${denominator} equal that shade? Choose ${keyed.length}.`,
    `The shaded amount on the strips is ${target}. Which sums with denominator ${denominator} name that same shade? Choose ${keyed.length}.`,
    `${target} is shaded on strips split into ${denominator} equal parts. Which sums with denominator ${denominator} equal that shade? Choose ${keyed.length}.`,
    `Count the shade on the strips: ${target}. Which sums with denominator ${denominator} match it? Choose ${keyed.length}.`,
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
    hint: `The strips show ${target}, which is ${count(numerator, "piece")} of size 1/${denominator}. Add the numerators. A match uses denominator ${denominator} and totals ${numerator}.`,
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
  const tops: number[] = [];
  for (let n = 1; n < denominator; n++)
    if (gcd(n, denominator) === 1) tops.push(n);
  const wantRegroup = denominator === 2 || r(0, 9) < 7;
  const first = tops[r(0, tops.length - 1)]!;
  const regroupers = tops.filter((n) => first + n >= denominator);
  const steadys = tops.filter((n) => first + n < denominator);
  const second =
    wantRegroup && regroupers.length
      ? regroupers[r(0, regroupers.length - 1)]!
      : steadys.length
        ? steadys[r(0, steadys.length - 1)]!
        : regroupers[r(0, regroupers.length - 1)]!;
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
  const left = `${firstWhole} ${first}/${denominator}`;
  const right = `${secondWhole} ${second}/${denominator}`;
  const ask = "Give a fraction or a whole number.";
  const frames: string[] = [];
  if (denomFits(denominator, "foot"))
    frames.push(
      `${name} cuts one board ${left} feet long and another ${right} feet long. How long are the boards together? ${ask}`,
      `${name} has ${left} feet of ribbon and adds ${right} feet more. How many feet of ribbon is that altogether? ${ask}`,
    );
  if (denomFits(denominator, "hour"))
    frames.push(
      `${name} practices piano for ${left} hours and soccer for ${right} hours. How long is that in all? ${ask}`,
    );
  if (denomFits(denominator, "mile"))
    frames.push(
      `${name} hikes ${left} miles, then ${right} miles more. How far is that in all? ${ask}`,
    );
  if (denomFits(denominator, "cup"))
    frames.push(
      `A recipe uses ${left} cups of flour and ${right} cups of oats. How many cups is that together? ${ask}`,
    );
  if (denomFits(denominator, "liter"))
    frames.push(
      `${name} pours ${left} liters of water into a jug, then ${right} liters more. How much water is in the jug? ${ask}`,
      `${name} pours ${left} liters of juice into a pitcher, then ${right} liters more. How much juice is in the pitcher? ${ask}`,
    );
  if (denomFits(denominator, "meter"))
    frames.push(
      `${name} uses ${left} meters of string, then ${right} meters more. How many meters of string is that? ${ask}`,
      `${name} cuts one ribbon ${left} meters long and another ${right} meters long. How long are the ribbons together? ${ask}`,
      `${name} walks ${left} meters along a path, then ${right} meters more. How far is that in all? ${ask}`,
    );
  if (!frames.length) throw new Error(`No mixed-sum unit for /${denominator}`);
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
  const name = learnerName(r);
  const wantOver = r(0, 1) === 1;
  const contexts: {
    denoms: readonly number[];
    build: (a: number, b: number, d: number) => string;
  }[] = [
    {
      denoms: [2, 3, 4, 6, 8, 12],
      build: (a, b, d) =>
        a + b > d
          ? `${name} eats ${a}/${d} of one pizza. A friend eats ${b}/${d} of another pizza the same size. How much pizza did they eat together?`
          : `${name} eats ${a}/${d} of a pizza. A friend eats ${b}/${d} of the same pizza. How much of the pizza did they eat together?`,
    },
    {
      denoms: [2, 4, 5, 10],
      build: (a, b, d) =>
        a + b > d
          ? `${name} reads ${a}/${d} of one chapter, then ${b}/${d} of another chapter the same length. How many chapters is that together?`
          : `${name} reads ${a}/${d} of a chapter, then ${b}/${d} more of that same chapter. How much of the chapter is that?`,
    },
    {
      denoms: [2, 3, 4, 5, 6, 8, 10, 12],
      build: (a, b, d) =>
        a + b > d
          ? `${name} plants flowers in ${a}/${d} of one garden bed and herbs in ${b}/${d} of another bed the same size. How many garden beds is that together?`
          : `${name} plants flowers in ${a}/${d} of a garden bed and herbs in ${b}/${d} of the same bed. How much of the bed is planted?`,
    },
    {
      denoms: [2, 3, 4, 6, 8, 12],
      build: (a, b, d) =>
        a + b > d
          ? `${name} paints ${a}/${d} of one poster in the morning and ${b}/${d} of another poster the same size after school. How many posters is that together?`
          : `${name} paints ${a}/${d} of a poster in the morning and ${b}/${d} of that same poster after school. How much of the poster is painted?`,
    },
    {
      denoms: [2, 4, 5, 8, 10],
      build: (a, b, d) =>
        `${name} walks ${a}/${d} mile, then ${b}/${d} mile farther on the same path. How far is that in all?`,
    },
    {
      denoms: [2, 3, 4, 6, 12],
      build: (a, b, d) =>
        `${name} practices piano for ${a}/${d} of an hour, then ${b}/${d} of an hour more. How long is practice in all?`,
    },
    {
      denoms: [2, 4, 5, 8, 10, 100],
      build: (a, b, d) =>
        (a + b) / d <= 0.5
          ? `${name} measures ${a}/${d} liter of water into a lab cup, then ${b}/${d} liter more. How much water is in the cup?`
          : `${name} pours ${a}/${d} liter of water into a jug, then ${b}/${d} liter more. How much water is in the jug?`,
    },
    {
      denoms: [2, 4, 5, 10, 100],
      build: (a, b, d) =>
        a / d < 0.1 || b / d < 0.1
          ? `${name} cuts ${a}/${d} meter of tape, then ${b}/${d} meter more. How much tape is that?`
          : `${name} uses ${a}/${d} meter of ribbon, then ${b}/${d} meter more. How much ribbon is that?`,
    },
    {
      denoms: [2, 3, 4, 8],
      build: (a, b, d) =>
        `A recipe needs ${a}/${d} cup of milk and ${b}/${d} cup of flour. How many cups is that together?`,
    },
    {
      denoms: [2, 3, 4, 6, 8, 12, 16],
      build: (a, b, d) =>
        `One piece of ribbon is ${a}/${d} of a foot. Another piece is ${b}/${d} of a foot. Placed end to end, how long are they together?`,
    },
  ];
  const context = contexts[r(0, contexts.length - 1)]!;
  const denominator = context.denoms[r(0, context.denoms.length - 1)]!;
  const tops: number[] = [];
  for (let n = 1; n < denominator; n++)
    if (gcd(n, denominator) === 1) tops.push(n);
  const pairs: [number, number][] = [];
  const every: [number, number][] = [];
  for (const a of tops)
    for (const b of tops) {
      every.push([a, b]);
      if (wantOver ? a + b > denominator : a + b <= denominator)
        pairs.push([a, b]);
    }
  const chosen = (pairs.length ? pairs : every)[
    r(0, (pairs.length ? pairs : every).length - 1)
  ]!;
  const first = chosen[0];
  const second = chosen[1];
  const answer = rational(first + second, denominator);
  return problem(template, seed, {
    prompt: context.build(first, second, denominator),
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
      `The strips show pieces of size $\\frac{1}{${denominator}}$. How many of those pieces are in the fraction, and how many are in the product?`,
      `Each piece on the strips is $\\frac{1}{${denominator}}$ of one whole. Count the pieces in each line.`,
      `Line 1 is a fraction made of $\\frac{1}{${denominator}}$ pieces. Line 2 multiplies those pieces. Fill in both counts.`,
      `The strips are split into ${denominator} equal pieces. How many pieces does each line use?`,
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
      `Point $P$ is marked on the number line. Each whole is split into ${base} equal parts. Which fractions name $P$? Choose 3.`,
      `Point $P$ is marked on the number line. Each whole has ${base} equal parts. Which fractions name $P$? Choose 3.`,
      `Point $P$ is marked on the line. Each whole is split into ${base} equal steps. Which fractions name $P$? Choose 3.`,
    ][r(0, 2)]!,
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
  const clause = clauseProblem(template.id, seed, template);
  if (clause) return clause;
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
  const denoms = [b, d, f, h];
  const every = (unit: Parameters<typeof denomFits>[1]) =>
    denoms.every((den) => denomFits(den, unit));
  const prompts = [
    `Choose <, =, or > for each pair. Both fractions in a pair are parts of one same-size whole.`,
    `Each pair compares two fractions of the same whole. Choose the symbol that makes each comparison true.`,
    `Put <, =, or > between the fractions in each pair. A pair uses one same-size whole.`,
  ];
  if (every("cup"))
    prompts.push(
      `Two recipes measure milk in cups. Choose <, =, or > for each pair of amounts.`,
    );
  if (every("hour"))
    prompts.push(
      `Two practice times are fractions of an hour. Choose <, =, or > for each pair.`,
    );
  if (every("mile"))
    prompts.push(
      `Two walks are fractions of a mile on the same path. Choose <, =, or > for each pair.`,
    );
  if (every("pizza"))
    prompts.push(
      `Two same-size pizzas are sliced into these fractions. Choose <, =, or > for each pair.`,
    );
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

type DecimalThing = {
  name: string;
  unit: string;
  verb: string;
  attr: string;
  article: string;
  min: number;
  max: number;
};

const DECIMAL_THINGS: readonly DecimalThing[] = [
  {
    name: "notebook",
    unit: "centimeters",
    verb: "is",
    attr: "thick",
    article: "A",
    min: 0.2,
    max: 0.8,
  },
  {
    name: "folder",
    unit: "centimeters",
    verb: "is",
    attr: "thick",
    article: "A",
    min: 0.1,
    max: 0.6,
  },
  {
    name: "playing card",
    unit: "centimeters",
    verb: "is",
    attr: "thick",
    article: "A",
    min: 0.02,
    max: 0.12,
  },
  {
    name: "sheet of paper",
    unit: "centimeters",
    verb: "is",
    attr: "thick",
    article: "A",
    min: 0.005,
    max: 0.03,
  },
  {
    name: "coin",
    unit: "centimeters",
    verb: "is",
    attr: "thick",
    article: "A",
    min: 0.12,
    max: 0.2,
  },
  {
    name: "eraser",
    unit: "centimeters",
    verb: "is",
    attr: "thick",
    article: "An",
    min: 0.4,
    max: 1,
  },
  {
    name: "ribbon",
    unit: "meters",
    verb: "is",
    attr: "long",
    article: "A",
    min: 0.15,
    max: 0.9,
  },
  {
    name: "shoelace",
    unit: "meters",
    verb: "is",
    attr: "long",
    article: "A",
    min: 0.35,
    max: 0.65,
  },
  {
    name: "seedling",
    unit: "meters",
    verb: "is",
    attr: "tall",
    article: "A",
    min: 0.05,
    max: 0.4,
  },
  {
    name: "pencil",
    unit: "meters",
    verb: "is",
    attr: "long",
    article: "A",
    min: 0.12,
    max: 0.22,
  },
  {
    name: "bookmark",
    unit: "meters",
    verb: "is",
    attr: "long",
    article: "A",
    min: 0.1,
    max: 0.25,
  },
  {
    name: "glass",
    unit: "liters",
    verb: "holds",
    attr: "",
    article: "A",
    min: 0.15,
    max: 0.4,
  },
  {
    name: "water bottle",
    unit: "liters",
    verb: "holds",
    attr: "",
    article: "A",
    min: 0.3,
    max: 1,
  },
  {
    name: "soup bowl",
    unit: "liters",
    verb: "holds",
    attr: "",
    article: "A",
    min: 0.2,
    max: 0.5,
  },
  {
    name: "measuring spoon",
    unit: "liters",
    verb: "holds",
    attr: "",
    article: "A",
    min: 0.005,
    max: 0.02,
  },
  {
    name: "video-game reaction",
    unit: "seconds",
    verb: "takes",
    attr: "",
    article: "A",
    min: 0.1,
    max: 0.5,
  },
  {
    name: "piece of string",
    unit: "meters",
    verb: "is",
    attr: "long",
    article: "A",
    min: 0.15,
    max: 0.7,
  },
  {
    name: "piece of yarn",
    unit: "meters",
    verb: "is",
    attr: "long",
    article: "A",
    min: 0.01,
    max: 0.2,
  },
  {
    name: "strip of tape",
    unit: "meters",
    verb: "is",
    attr: "long",
    article: "A",
    min: 0.01,
    max: 0.15,
  },
  {
    name: "rope",
    unit: "meters",
    verb: "is",
    attr: "long",
    article: "A",
    min: 0.4,
    max: 0.99,
  },
  {
    name: "strap",
    unit: "meters",
    verb: "is",
    attr: "long",
    article: "A",
    min: 0.45,
    max: 0.99,
  },
  {
    name: "belt",
    unit: "meters",
    verb: "is",
    attr: "long",
    article: "A",
    min: 0.55,
    max: 0.95,
  },
  {
    name: "measuring cup",
    unit: "liters",
    verb: "contains",
    attr: "",
    article: "A",
    min: 0.01,
    max: 0.25,
  },
  {
    name: "small jar",
    unit: "liters",
    verb: "contains",
    attr: "",
    article: "A",
    min: 0.01,
    max: 0.3,
  },
  {
    name: "paper cup",
    unit: "liters",
    verb: "holds",
    attr: "",
    article: "A",
    min: 0.09,
    max: 0.18,
  },
  {
    name: "yogurt cup",
    unit: "liters",
    verb: "holds",
    attr: "",
    article: "A",
    min: 0.1,
    max: 0.18,
  },
  {
    name: "mug",
    unit: "liters",
    verb: "holds",
    attr: "",
    article: "A",
    min: 0.25,
    max: 0.4,
  },
  {
    name: "jug",
    unit: "liters",
    verb: "holds",
    attr: "",
    article: "A",
    min: 0.5,
    max: 1,
  },
];

const decimalValue = (text: string) => Number(text);

function thingSentence(thing: DecimalThing, value: string): string {
  const tail = thing.attr ? ` ${thing.attr}` : "";
  return `${thing.article} ${thing.name} ${thing.verb} ${value} ${thing.unit}${tail}.`;
}

function pairGroups(left: string, right: string): DecimalThing[][] {
  const a = decimalValue(left);
  const b = decimalValue(right);
  const fits = DECIMAL_THINGS.filter(
    (thing) =>
      a >= thing.min && a <= thing.max && b >= thing.min && b <= thing.max,
  );
  const byKind = new Map<string, DecimalThing[]>();
  for (const thing of fits) {
    const key = `${thing.unit}|${thing.verb}|${thing.attr}`;
    const group = byKind.get(key) ?? [];
    group.push(thing);
    byKind.set(key, group);
  }
  return [...byKind.values()]
    .filter((group) => group.length >= 2)
    .sort((x, y) => {
      const span = (group: DecimalThing[]) =>
        Math.min(...group.map((thing) => thing.max - thing.min));
      return span(x) - span(y);
    });
}

/** Two sentences per pair. Both objects in a pair measure the same unit. */
function decimalPairPrompt(
  r: Random,
  first: [string, string],
  second: [string, string],
): string {
  const groups = pairGroups(first[0], first[1]);
  const more = pairGroups(second[0], second[1]);
  if (!groups.length || !more.length)
    throw new Error("Decimal comparison needs two objects of one unit");
  const pool = groups[r(0, groups.length - 1)]!;
  const left = pool[r(0, pool.length - 1)]!;
  const right = pool.find((thing) => thing.name !== left.name) ?? pool[0]!;
  const used = new Set([left.name, right.name]);
  const unusedCount = (group: DecimalThing[]) =>
    group.filter((thing) => !used.has(thing.name)).length;
  const fresh = more.filter((group) => unusedCount(group) >= 2);
  const other = (fresh.length ? fresh : more)[
    r(0, (fresh.length ? fresh : more).length - 1)
  ]!;
  const third =
    other.find((thing) => !used.has(thing.name)) ??
    other.find((thing) => thing.name !== right.name) ??
    other[0]!;
  const fourth =
    other.find((thing) => thing.name !== third.name && !used.has(thing.name)) ??
    other.find((thing) => thing.name !== third.name) ??
    other[0]!;
  return [
    `First pair: ${thingSentence(left, first[0])} ${thingSentence(right, first[1])}`,
    `Second pair: ${thingSentence(third, second[0])} ${thingSentence(fourth, second[1])}`,
    "Choose <, =, or > for each pair.",
  ].join(" ");
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
  const [a0, b0] = rows[0]!;
  const [a1, b1] = rows[1]!;
  return multiPartProblem(template, seed, r, {
    prompt: decimalPairPrompt(r, [a0, b0], [a1, b1]),
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
    const ask = r(0, 1) === 0 ? "Which point is at" : "Which letter marks";
    prompt = `${ask} ${fractionText}?`;
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
    const ask = r(0, 1) === 0 ? "Which point is at" : "Which letter marks";
    prompt = `${ask} ${decimalText}?`;
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
  const prompts = [
    `Complete the sentence about the digit ${asked.digit} in ${shown}.`,
    ones >= 6
      ? `A race time is ${shown} seconds. Complete the sentence about the digit ${asked.digit}.`
      : `A stopwatch shows ${shown} seconds. Complete the sentence about the digit ${asked.digit}.`,
    `A board is ${shown} meters long. Complete the sentence about the digit ${asked.digit}.`,
    `A sticker costs ${shown} dollars. Complete the sentence about the digit ${asked.digit}.`,
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
