import { createHash } from "node:crypto";
import type {
  GeneratedProblem,
  SemanticFigure,
  TemplateMetadata,
} from "./contracts";
import { random, type Random } from "./distribution-practice";
import { scene } from "./scene/author";
import type { Element, Scene } from "./scene/spec";
import { chooseAxes, defineAxis, surfaceStream } from "./variation/axes";
import { problemOf } from "./figure-choice-practice";
import {
  cardTray,
  frac,
  inlineSentence,
  multiPartProblem,
  type Slot,
} from "./multi-part-support";
import { serializeSelection } from "./selection-response";

/**
 * Common Core clause variants on existing fraction families.
 *
 * Each variant is a `task` axis value. `legacy` is the stored surface: it is
 * silent, and `since` forces it below the template version that introduced
 * the variant, so a saved workbook reprints the problem it stored. The
 * content stream is not read until the variant is chosen, so a legacy draw
 * consumes that stream exactly as it did before the axis existed.
 *
 * A template that declares one response capability keeps that capability.
 * Where the clause spec asks for another capability, the same mathematics is
 * written in the capability the template already serves. See the PR.
 */

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
const lcm = (a: number, b: number) => (a / gcd(a, b)) * b;
const need = (ok: boolean, what: string) => {
  if (!ok) throw new Error(`Need ${what}`);
};
const pick = <T>(r: Random, xs: readonly T[]): T => xs[r(0, xs.length - 1)]!;
export const fractionText = (n: number, d: number) => {
  const g = gcd(Math.abs(n), d) || 1;
  const a = n / g;
  const b = d / g;
  return b === 1 ? `${a}` : `${a}/${b}`;
};
const mixedText = (n: number, d: number) => {
  const w = Math.floor(n / d);
  const r = n % d;
  if (w === 0) return fractionText(n, d);
  if (r === 0) return `${w}`;
  return `${w} ${fractionText(r, d)}`;
};
const tex = (n: number, d: number) => `$${frac(n, d)}$`;
/** A card label whose value `cardTray` can sort: a whole number, or reduced TeX. */
const card = (n: number, d: number) => {
  const g = gcd(Math.abs(n), d) || 1;
  const a = n / g;
  const b = d / g;
  return b === 1 ? `${a}` : tex(a, b);
};

type TaskSpec = {
  since: number;
  values: readonly string[];
  weights: readonly number[];
  needs?: Partial<Record<string, "scenes-v1">>;
};

/** Template version that first draws the clause axis. Matches each template. */
export const clauseSince: Record<string, TaskSpec> = {
  "name-equal-share": {
    since: 2,
    values: ["phrase", "whole"],
    weights: [4, 1, 1],
  },
  "name-share": {
    since: 2,
    values: ["phrase", "whole"],
    weights: [4, 1, 1],
  },
  "find-equal-shares": {
    since: 2,
    values: ["fourths"],
    weights: [2, 1],
  },
  "fraction-line-names-select": {
    since: 2,
    values: ["whole"],
    weights: [2, 1],
    needs: { whole: "scenes-v1" },
  },
  "compare-fractions-symbol-blanks": {
    since: 2,
    values: ["grade3"],
    weights: [2, 1],
    needs: { grade3: "scenes-v1" },
  },
  "compare-fractions-reason-blanks": {
    since: 3,
    values: ["grade3", "unlike"],
    weights: [12, 1, 1],
    needs: { grade3: "scenes-v1", unlike: "scenes-v1" },
  },
  "fraction-decompositions-select": {
    since: 2,
    values: ["picture"],
    weights: [2, 1],
    needs: { picture: "scenes-v1" },
  },
  "whole-times-fraction": {
    since: 3,
    values: ["between"],
    weights: [8, 1],
  },
  "add-fractions": { since: 2, values: ["steps"], weights: [2, 1] },
  "benchmark-fraction-estimate": {
    since: 2,
    values: ["judge"],
    weights: [3, 1],
  },
  "whole-sharing-fraction": { since: 2, values: ["rice"], weights: [3, 1] },
  "fraction-of-quantity": {
    since: 2,
    values: ["story", "model", "part", "represent"],
    weights: [4, 1, 1, 1, 1],
    needs: { model: "scenes-v1" },
  },
  "scaling-direction-choice": {
    since: 3,
    values: ["explain", "times-one"],
    weights: [4, 1, 1],
  },
  "unit-fraction-division-slots": {
    since: 2,
    values: ["story", "model", "check"],
    weights: [3, 1, 1, 1],
  },
  "whole-unit-groups": {
    since: 2,
    values: ["model"],
    weights: [3, 1],
    needs: { model: "scenes-v1" },
  },
  "fraction-group-count": {
    since: 2,
    values: ["story", "model", "equation"],
    weights: [3, 1, 1, 1],
    needs: { model: "scenes-v1" },
  },
  "reciprocal-division-choice": {
    since: 2,
    values: ["check"],
    weights: [3, 1],
  },
  "divide-fractions": { since: 2, values: ["area"], weights: [2, 1] },
};

export function clauseAxis(id: string) {
  const axis = taskAxis(id);
  if (!axis) throw new Error(`No clause axis for ${id}`);
  return axis;
}

const taskAxis = (id: string) => {
  const spec = clauseSince[id];
  if (!spec) return null;
  return defineAxis("task", ["legacy", ...spec.values] as string[], {
    silentLegacy: true,
    since: spec.since,
    weights: spec.weights,
    ...(spec.needs ? { needs: spec.needs } : {}),
  });
};

/** The clause task for this seed, or `legacy` when the family has none. */
export function clauseTask(id: string, seed: string): string {
  const axis = taskAxis(id);
  if (!axis) return "legacy";
  return chooseAxes(id, seed, { task: axis }).task;
}

/** Grade-3 denominator band on the rename families. Legacy keeps the old draw. */
export function grade3Band(id: string, seed: string): boolean {
  const since = id === "equivalent-numerator" ? 3 : 2;
  if (id !== "equivalent-numerator" && id !== "equivalent-denominator")
    return false;
  const axis = defineAxis("band", ["legacy", "grade3"] as const, {
    silentLegacy: true,
    since,
    weights: [8, 1],
  });
  return chooseAxes(id, seed, { band: axis }).band === "grade3";
}

/** Sometimes write a whole as a count of 1/1, for 3 = 3/1. */
export function unitDenominatorOn(id: string, seed: string): boolean {
  if (id !== "fraction-whole-as-parts") return false;
  const axis = defineAxis("unitden", ["off", "on"] as const, {
    silentLegacy: true,
    since: 2,
    weights: [3, 1],
  });
  return chooseAxes(id, seed, { unitden: axis }).unitden === "on";
}

/**
 * Statement choices on scaling-direction-choice used to keep only the first
 * three distractors, so the "a fraction can be more than 1" reasons never
 * appeared. At the current template version the pool is shuffled on its own
 * stream. Version 1 still takes the stored prefix, and the content stream
 * is not touched.
 */
export function scalingMenu(seed: string): "stored" | "shuffled" {
  const axis = defineAxis("menu", ["stored", "shuffled"] as const, {
    silentLegacy: true,
    since: 2,
    legacyRetiredSince: 3,
    weights: [1, 3],
  });
  return chooseAxes("scaling-direction-choice", seed, { menu: axis }).menu;
}

export function shuffleScalingPool<T>(seed: string, pool: readonly T[]): T[] {
  const copy = [...pool];
  const r = surfaceStream("scaling-direction-choice", seed);
  for (let i = copy.length - 1; i > 0; i--) {
    const j = r(0, i);
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

const hashId = (id: string, seed: string) =>
  createHash("sha256").update(JSON.stringify([id, 1, seed])).digest("hex");

type Choice = { label: string; correct?: true; feedback: string };

function choiceProblem(
  meta: TemplateMetadata,
  seed: string,
  task: string,
  draft: {
    prompt: string;
    hint: string;
    explanation: string[];
    choices: Choice[];
    figure?: SemanticFigure;
    r: Random;
  },
): GeneratedProblem {
  const correct = draft.choices.filter((c) => c.correct);
  need(correct.length === 1, "one correct choice");
  const labels = new Set(draft.choices.map((c) => c.label));
  need(labels.size === draft.choices.length && draft.choices.length >= 2, "distinct choices");
  need(draft.choices.length <= 4, "at most four choices");
  const order = [...draft.choices];
  for (let i = order.length - 1; i > 0; i--) {
    const j = draft.r(0, i);
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  let answer = "";
  const choiceFeedback: Record<string, string> = {};
  const options = order.map((c, i) => {
    const id = `option-${"abcd"[i]}`;
    if (c.correct) answer = id;
    else choiceFeedback[id] = c.feedback;
    return { id, label: c.label };
  });
  return {
    public: {
      id: hashId(meta.id, seed),
      templateId: meta.id,
      templateVersion: 1,
      seed,
      prompt: draft.prompt,
      skillId: meta.skillId,
      response: { kind: "choice", label: "Choose one answer", options },
      ...(draft.figure ? { figure: draft.figure } : {}),
    },
    answer,
    hint: draft.hint,
    explanation: draft.explanation,
    choiceFeedback,
    variant: { id: task, axes: { task } },
  };
}

function withVariant(problem: GeneratedProblem, task: string): GeneratedProblem {
  return { ...problem, variant: { id: task, axes: { task } } };
}

const SHAPES = ["circle", "square", "rectangle"] as const;
type ShapeName = (typeof SHAPES)[number];

function shareFigure(
  shape: ShapeName,
  n: number,
  shaded: number[],
): SemanticFigure {
  const cut =
    shape === "circle" ? "sectors" : n === 4 && shape === "square" ? "grid" : "columns";
  return {
    kind: "partitioned-shapes",
    shapes: [
      {
        shape,
        cut,
        sizes: Array.from({ length: n }, () => 1),
        shaded,
        label: "A",
      },
    ],
  };
}

const SHARE_WORD: Record<number, [string, string]> = {
  2: ["half", "halves"],
  3: ["third", "thirds"],
  4: ["fourth", "fourths"],
};

function phraseChoice(k: number, n: number, shape: ShapeName, quarterWord: boolean) {
  const whole = `the ${shape}`;
  const part = "the shaded part";
  const name =
    n === 2 && k === 1
      ? "half of"
      : n === 3 && k === 1
        ? "a third of"
        : n === 3 && k === 2
          ? "two thirds of"
          : n === 4 && k === 1
            ? quarterWord
              ? "a quarter of"
              : "a fourth of"
            : n === 4 && k === 3
              ? quarterWord
                ? "three quarters of"
                : "three fourths of"
              : `${k} ${SHARE_WORD[n]![1]} of`;
  const correct = `${name} ${whole}`;
  const pool = [
    `${name} ${part}`,
    n === 2 ? `a fourth of ${whole}` : `half of ${whole}`,
    n === 3 ? `a fourth of ${whole}` : `a third of ${whole}`,
    `${k === 1 ? "two" : "one"} of ${whole}`,
    `four of ${whole}`,
  ];
  const wrong = [...new Set(pool)].filter((label) => label !== correct).slice(0, 3);
  need(wrong.length === 3, "three phrase distractors");
  return { correct, wrong };
}

/** True when the sentence names this shaded share of this whole. */
export function phraseIsTrue(
  sentence: string,
  shape: ShapeName,
  n: number,
  shaded: number,
): boolean {
  const whole = sentence.endsWith(`the ${shape}`);
  if (!whole) return false;
  if (shaded === 1 && n === 2) return sentence.startsWith("half of ");
  if (shaded === 1 && n === 3) return sentence.startsWith("a third of ");
  if (shaded === 2 && n === 3) return sentence.startsWith("two thirds of ");
  if (shaded === 1 && n === 4)
    return (
      sentence.startsWith("a fourth of ") || sentence.startsWith("a quarter of ")
    );
  if (shaded === 3 && n === 4)
    return (
      sentence.startsWith("three fourths of ") ||
      sentence.startsWith("three quarters of ")
    );
  return false;
}

function namePhrase(
  meta: TemplateMetadata,
  seed: string,
  r: Random,
  thirds: boolean,
): GeneratedProblem {
  const shape = pick(r, SHAPES);
  const n = thirds ? pick(r, [2, 3, 3, 4]) : pick(r, [2, 4]);
  const k = thirds && n === 3 && r(0, 2) === 0 ? 2 : 1;
  const quarterWord = r(0, 1) === 1;
  const { correct, wrong } = phraseChoice(k, n, shape, quarterWord);
  const figure = shareFigure(
    shape,
    n,
    Array.from({ length: k }, (_, i) => i),
  );
  return choiceProblem(meta, seed, "phrase", {
    r,
    figure,
    prompt: `The ${shape} is cut into ${n} equal parts, and ${k} ${k === 1 ? "part is" : "parts are"} shaded. Which sentence is true?`,
    hint: `Count the equal parts of the ${shape}: there are ${n}. Then count the shaded parts: ${k}. The sentence names that share of the whole ${shape}.`,
    explanation: [
      `The ${shape} is cut into ${n} equal parts, so each part is one ${SHARE_WORD[n]![0]}.`,
      `${k} of those parts ${k === 1 ? "is" : "are"} shaded.`,
      `The shaded part is ${correct}. It is a share of the whole ${shape}, not of the shaded part.`,
    ],
    choices: [
      { label: correct, correct: true, feedback: "" },
      ...wrong.map((label) => ({
        label,
        feedback: label.endsWith("shaded part")
          ? "The shaded part is the piece being named. The whole is the shape."
          : label.includes(" of the")
            ? "That name does not match the number of equal parts, or how many are shaded."
            : "That counts shares instead of naming the fraction.",
      })),
    ],
  });
}

function nameWhole(
  meta: TemplateMetadata,
  seed: string,
  r: Random,
  thirds: boolean,
): GeneratedProblem {
  // Thirds are half the grade-2 wholes so a sample still clears 25 percent.
  const n = thirds ? pick(r, [2, 3, 3, 4]) : pick(r, [2, 4]);
  const shape = pick(r, SHAPES);
  const fourths = n === 4 && r(0, 1) === 1;
  const share = n === 2 ? "halves" : n === 3 ? "thirds" : fourths ? "fourths" : "quarters";
  const countWord = n === 2 ? "two" : n === 3 ? "three" : "four";
  const correct = `${countWord} ${share}, the whole ${shape}`;
  const wrongShares = ["halves", "thirds", "fourths", "quarters"].filter((s) => s !== share);
  const wrongCounts = ["one", "two", "three", "four"].filter((c) => c !== countWord);
  const pool = [
    `one ${share === "halves" ? "half" : share.replace(/s$/, "")}`,
    countWord,
    `${wrongCounts[0]} ${share}`,
    `${countWord} ${wrongShares[0]}`,
    `one half`,
  ];
  const wrong = [...new Set(pool)].filter((label) => label !== correct).slice(0, 3);
  need(wrong.length === 3, "three whole distractors");
  return choiceProblem(meta, seed, "whole", {
    r,
    figure: shareFigure(
      shape,
      n,
      Array.from({ length: n }, (_, i) => i),
    ),
    prompt: `All of the ${shape} is shaded. It is cut into ${n} equal parts. Which sentence names the whole?`,
    hint: `Count the shaded parts of the ${shape}. All ${n} parts are shaded, so the whole is that many of those shares.`,
    explanation: [
      `The ${shape} is cut into ${n} equal parts, and every part is shaded.`,
      `${countWord} ${share} fill the ${shape}.`,
      `The whole ${shape} is ${correct}.`,
    ],
    choices: [
      { label: correct, correct: true, feedback: "" },
      ...wrong.map((label) => ({
        label,
        feedback: label === countWord
          ? "The count needs the share name. Four alone is not four fourths."
          : "The count and the share name have to match the cut.",
      })),
    ],
  });
}

/** "fourths" beside "quarters" in the grade-1 equal-share prompt. */
export function fourthsWording(prompt: string, hint: string, explanation: string[]) {
  const swap = (s: string) => s.replaceAll("quarters", "fourths").replaceAll("quarter", "fourth");
  return {
    prompt: swap(prompt),
    hint: swap(hint),
    explanation: explanation.map(swap),
  };
}

const DENS3 = [2, 3, 4, 6, 8] as const;

function barsFigure(
  rows: { parts: number; shaded: number; label: string }[],
): SemanticFigure {
  const width = 8;
  const elements: Element[] = [];
  rows.forEach((row, y) => {
    const piece = width / row.parts;
    for (let i = 0; i < row.parts; i++)
      elements.push({
        type: "rect",
        id: `b${y}p${i}`,
        at: [i * piece, y * 1.6],
        size: [piece * 0.92, 1.1],
        fill: i < row.shaded ? "accent-fill" : "paper",
        stroke: "ink",
        width: 2,
      });
    void row.label;
  });
  return {
    kind: "scene",
    scene: scene(...elements).build({
      width: 360,
      maxHeight: 220,
      title: "Fraction bars of one width",
    }),
  };
}

function grade3Symbols(
  meta: TemplateMetadata,
  seed: string,
  r: Random,
): GeneratedProblem {
  const pair = () => {
    const sameNum = r(0, 1) === 0;
    if (sameNum) {
      const n = r(1, 3);
      let d1 = pick(r, DENS3.filter((d) => d > n));
      let d2 = pick(r, DENS3.filter((d) => d > n && d !== d1));
      need(d1 !== d2, "two denominators");
      return { left: [n, d1] as const, right: [n, d2] as const };
    }
    const d = pick(r, DENS3);
    let a = r(1, d - 1);
    let c = r(1, d - 1);
    if (a === c) c = c === d - 1 ? 1 : c + 1;
    need(a !== c, "two numerators");
    return { left: [a, d] as const, right: [c, d] as const };
  };
  const pairs = [pair(), pair()];
  const symbol = (p: (typeof pairs)[number]) => {
    const left = p.left[0] * p.right[1];
    const right = p.right[0] * p.left[1];
    return left < right ? "$<$" : left > right ? "$>$" : "$=$";
  };
  const slots: Slot[] = pairs.map((p, i) => ({
    id: `c${i + 1}`,
    label: `The symbol for pair ${i + 1}`,
    correct: symbol(p),
    fixed: ["$<$", "$=$", "$>$"],
  }));
  const built = inlineSentence([
    `${tex(pairs[0]!.left[0], pairs[0]!.left[1])} `,
    slots[0]!,
    ` ${tex(pairs[0]!.right[0], pairs[0]!.right[1])}\n${tex(pairs[1]!.left[0], pairs[1]!.left[1])} `,
    slots[1]!,
    ` ${tex(pairs[1]!.right[0], pairs[1]!.right[1])}`,
  ]);
  const figure = barsFigure(
    pairs.flatMap((p) => [
      { parts: p.left[1], shaded: p.left[0], label: `${p.left[0]}/${p.left[1]}` },
      { parts: p.right[1], shaded: p.right[0], label: `${p.right[0]}/${p.right[1]}` },
    ]),
  );
  return withVariant(
    multiPartProblem(meta, seed, r, {
      prompt:
        "Choose <, =, or > for each pair. The bars are the same width, and each pair shares a numerator or a denominator.",
      layout: "cards",
      reuse: true,
      label: "Put a symbol card in each box",
      slots: built.slots,
      sentence: built.sentence,
      figure,
      hint: `Look at the first pair, ${pairs[0]!.left[0]}/${pairs[0]!.left[1]} and ${pairs[0]!.right[0]}/${pairs[0]!.right[1]}. Same-size pieces: more pieces is more. Same count of pieces: the smaller denominator is the bigger piece.`,
      explanation: pairs.map((p) => {
        const multiple = lcm(p.left[1], p.right[1]);
        const lt = p.left[0] * (multiple / p.left[1]);
        const rt = p.right[0] * (multiple / p.right[1]);
        const word = lt === rt ? "the same amount" : lt < rt ? "less than" : "greater than";
        return `Over the common denominator ${multiple}, the top numbers are ${lt} and ${rt}. ${lt} is ${word} ${rt}.`;
      }),
    }),
    "grade3",
  );
}

function grade3Reason(
  meta: TemplateMetadata,
  seed: string,
  r: Random,
): GeneratedProblem {
  const sameNum = r(0, 1) === 0;
  let a: number, b: number, c: number, d: number;
  if (sameNum) {
    a = c = r(1, 3);
    b = pick(r, DENS3.filter((x) => x > a));
    d = pick(r, DENS3.filter((x) => x > a && x !== b));
  } else {
    b = d = pick(r, DENS3);
    a = r(1, b - 1);
    c = r(1, b - 1);
    if (a === c) c = c === 1 ? 2 : 1;
  }
  const left = a / b;
  const right = c / d;
  need(left !== right, "unequal fractions");
  const greater = left > right ? [a, b] : [c, d];
  const bigDen = Math.max(b, d);
  const smallDen = Math.min(b, d);
  const reasons: { label: string; holds: boolean; feedback: string }[] = [
    {
      label: "same size pieces, more of them",
      holds: !sameNum,
      feedback: "The pieces are the same size only when the denominators match.",
    },
    {
      label: "same number of pieces, bigger pieces",
      holds: sameNum,
      feedback: "The numerators match only when both fractions count the same number of pieces.",
    },
    {
      label: `${bigDen} is more than ${smallDen}, so bigger bottoms are bigger`,
      holds: false,
      feedback: "A greater denominator cuts the same whole into smaller pieces.",
    },
    {
      label: `${Math.max(a, c)} is more than ${Math.min(a, c) === Math.max(a, c) ? 0 : Math.min(a, c)}, so compare tops`,
      holds: false,
      feedback: "Comparing only the top numbers ignores the size of the pieces.",
    },
  ];
  // The tops distractor must stay false when the numerators differ and the
  // greater one really does have the greater top (same denominator).
  if (!sameNum) {
    reasons[3] = {
      label: `${Math.min(a, c)} is more than ${Math.max(a, c)}, so it is greater`,
      holds: false,
      feedback: "That comparison of the top numbers is backwards.",
    };
  }
  const trueOnes = reasons.filter((x) => x.holds);
  need(trueOnes.length === 1, "one true reason");
  const correct = trueOnes[0]!.label;
  const built = inlineSentence([
    `${tex(a, b)} compared with ${tex(c, d)}: `,
    {
      id: "bigger",
      label: "The greater fraction",
      correct: tex(greater[0]!, greater[1]!),
      fixed: [tex(a, b), tex(c, d)],
    },
    " is greater because ",
    {
      id: "why",
      label: "The reason",
      correct,
      wrong: reasons.filter((x) => !x.holds).map((x) => x.label),
      max: 4,
    },
    ".",
  ]);
  return withVariant(
    multiPartProblem(meta, seed, r, {
      prompt: `The bars are the same width. Compare ${tex(a, b)} and ${tex(c, d)}. Complete the sentence.`,
      layout: "inline",
      label: "Choose the fraction and the reason",
      slots: built.slots,
      sentence: built.sentence,
      figure: barsFigure([
        { parts: b, shaded: a, label: `${a}/${b}` },
        { parts: d, shaded: c, label: `${c}/${d}` },
      ]),
      hint: sameNum
        ? `Both fractions have numerator ${a}. Compare the denominators ${b} and ${d}: fewer equal pieces means larger pieces.`
        : `Both fractions have denominator ${b}. Compare the numerators ${a} and ${c}.`,
      explanation: sameNum
        ? [
            `Both bars count ${a} pieces, and the wholes are the same width.`,
            `The smaller denominator cuts larger pieces, so ${tex(greater[0]!, greater[1]!)} is greater.`,
          ]
        : [
            `Both bars use pieces of size 1/${b}.`,
            `${tex(greater[0]!, greater[1]!)} has more of those pieces, so it is greater.`,
          ],
    }),
    "grade3",
  );
}

const UNLIKE_D = [2, 3, 4, 5, 6, 8, 10, 12] as const;

function unlikeReason(
  meta: TemplateMetadata,
  seed: string,
  r: Random,
): GeneratedProblem {
  const benchmark = r(0, 3) === 0;
  let a = 1, b = 2, c = 1, d = 3;
  for (let guard = 0; guard < 40; guard++) {
    b = pick(r, UNLIKE_D);
    d = pick(r, UNLIKE_D.filter((x) => x !== b));
    a = r(1, b - 1);
    c = r(1, d - 1);
    if (a === c && b === d) continue;
    if (a * d === c * b) continue;
    if (lcm(b, d) > 24) continue;
    const straddles = (2 * a - b) * (2 * c - d) < 0;
    if (straddles === benchmark && a !== c) break;
  }
  need(a * d !== c * b && b !== d && a !== c, "unlike pair");
  need(lcm(b, d) <= 24, "lcd at most 24");
  const straddles = (2 * a - b) * (2 * c - d) < 0;
  need(straddles === benchmark, "benchmark side");
  const L = lcm(b, d);
  const aL = a * (L / b);
  const cL = c * (L / d);
  const greater = aL > cL ? [a, b] : [c, d];
  const lesser = aL > cL ? [c, d] : [a, b];
  const low = 2 * a < b ? [a, b] : [c, d];
  const high = 2 * a < b ? [c, d] : [a, b];
  const lcdLabel = `over ${L} they are ${aL}/${L} and ${cL}/${L}`;
  const benchLabel = `${high[0]}/${high[1]} is more than 1/2 and ${low[0]}/${low[1]} is less than 1/2`;
  const bigBottom = `${Math.max(b, d)} is more than ${Math.min(b, d)}, so that fraction is greater`;
  const tops = `${Math.max(a, c)} is more than ${Math.min(a, c)}, so it is greater`;
  const wrongLcd = `over ${L} they are ${aL}/${L} and ${aL}/${L}`;
  const options = straddles
    ? [
        { label: benchLabel, holds: true },
        { label: wrongLcd, holds: false },
        { label: bigBottom, holds: false },
        {
          label: `${Math.min(a, c)} is more than ${Math.max(a, c)}, so it is greater`,
          holds: false,
        },
      ]
    : [
        { label: lcdLabel, holds: true },
        { label: benchLabel, holds: false },
        { label: bigBottom, holds: false },
        { label: `${Math.min(a, c)} is more than ${Math.max(a, c)}, so it is greater`, holds: false },
      ];
  // The tops line above is forced false. Say so in the feedback.
  const trueOnes = options.filter((o) => o.holds);
  need(trueOnes.length === 1, "one unlike reason");
  need(new Set(options.map((o) => o.label)).size === 4, "distinct reasons");
  need(options.every((o) => o.label.length <= 80), "reason length");
  const correct = trueOnes[0]!.label;
  const built = inlineSentence([
    `${tex(greater[0]!, greater[1]!)} is greater because `,
    {
      id: "why",
      label: "The reason",
      correct,
      wrong: options.filter((o) => !o.holds).map((o) => o.label),
      max: 4,
    },
    ".",
  ]);
  // The sentence above names the greater fraction, so the blank is only the
  // reason. A one-blank sentence is not a multi-part problem. Add the
  // fraction blank the other compare items use.
  const both = inlineSentence([
    "",
    {
      id: "bigger",
      label: "The greater fraction",
      correct: tex(greater[0]!, greater[1]!),
      fixed: [tex(a, b), tex(c, d)],
    },
    " is greater because ",
    built.slots[0]!,
    ".",
  ]);
  return withVariant(
    multiPartProblem(meta, seed, r, {
      prompt: `Compare ${tex(a, b)} and ${tex(c, d)}. Each bar is marked in twelfths or in the common piece. Complete the sentence.`,
      layout: "inline",
      label: "Choose the fraction and the reason",
      slots: both.slots,
      sentence: both.sentence,
      figure: barsFigure([
        { parts: b, shaded: a, label: `${a}/${b}` },
        { parts: d, shaded: c, label: `${c}/${d}` },
      ]),
      hint: straddles
        ? `Compare each fraction with 1/2 before you rename. One of ${a}/${b} and ${c}/${d} is past a half and the other is not.`
        : `Rename both with denominator ${L}, then compare the top numbers ${aL} and ${cL}.`,
      explanation: straddles
        ? [
            `${tex(high[0]!, high[1]!)} is more than 1/2 and ${tex(low[0]!, low[1]!)} is less than 1/2.`,
            `A benchmark decides the comparison only when the fractions sit on opposite sides of 1/2.`,
            `${tex(greater[0]!, greater[1]!)} is greater.`,
          ]
        : [
            `The common piece is 1/${L}. ${a}/${b} = ${aL}/${L} and ${c}/${d} = ${cL}/${L}.`,
            `${Math.max(aL, cL)} is more than ${Math.min(aL, cL)}, so ${tex(greater[0]!, greater[1]!)} is greater.`,
          ],
    }),
    "unlike",
  );
}

function pictureDecomposition(
  meta: TemplateMetadata,
  seed: string,
  r: Random,
): GeneratedProblem {
  let b = 4;
  let a = 2;
  let t = 1;
  for (let guard = 0; guard < 20; guard++) {
    b = pick(r, [3, 4, 5, 6, 8, 10, 12]);
    a = r(2, b - 1);
    t = r(1, a - 1);
    // (b-a)/b + t/b equals a/b when the unshaded count is the shaded count.
    if (t !== 2 * a - b) break;
  }
  const rust = a - t;
  need(t !== 2 * a - b, "unshaded equation");
  const width = 8;
  const piece = width / b;
  const elements: Element[] = [];
  for (let i = 0; i < b; i++)
    elements.push({
      type: "rect",
      id: `p${i}`,
      at: [i * piece, 0],
      size: [piece * 0.92, 1.2],
      fill: i < t ? "accent-fill" : i < a ? "warm-fill" : "paper",
      stroke: "ink",
      width: 2,
    });
  const eq = (n1: number, d1: number, n2: number, d2: number, n3: number, d3: number) =>
    `$${frac(n1, d1)}+${frac(n2, d2)}=${frac(n3, d3)}$`;
  const unit = `$${t}\\times${frac(1, b)}+${frac(rust, b)}=${frac(a, b)}$`;
  const options = [
    { label: eq(t, b, rust, b, a, b), holds: true },
    { label: unit, holds: true },
    { label: eq(t, b, rust, 2 * b, a, b), holds: false },
    { label: eq(t, b, rust, b, a, 2 * b), holds: false },
    { label: eq(b - a, b, t, b, a, b), holds: false },
  ];
  need(new Set(options.map((o) => o.label)).size === options.length, "distinct equations");
  const trueCount = options.filter((o) => o.holds).length;
  need(trueCount === 2, "two true equations");
  const cards = options
    .map((o) => ({ ...o, order: r(0, 1000) }))
    .sort((x, y) => x.order - y.order);
  const responseOptions = cards.map((card, index) => ({
    id: `option-${"abcdefgh"[index]}`,
    label: card.label,
  }));
  const answer = serializeSelection(
    responseOptions.filter((_, i) => cards[i]!.holds).map((o) => o.id),
  );
  return {
    public: {
      id: hashId(meta.id, seed),
      templateId: meta.id,
      templateVersion: 1,
      seed,
      prompt: `The strip has ${b} equal pieces, some teal and some rust. Which equations match the strip? Choose 2.`,
      skillId: meta.skillId,
      response: {
        kind: "multi-select",
        label: "Choose 2 equations",
        selectionCount: 2,
        options: responseOptions,
      },
      figure: {
        kind: "scene",
        scene: scene(...elements).build({
          width: 360,
          maxHeight: 120,
          title: "A strip in two colors",
        }),
      },
    },
    answer,
    hint: `Count the teal pieces, then the rust pieces. The strip has ${b} equal pieces in all. An equation matches when the two counts add to the shaded pieces.`,
    explanation: [
      `There are ${t} teal pieces and ${rust} rust pieces. Together that is ${t} + ${rust} = ${a} shaded pieces.`,
      `Each piece is 1/${b} of the strip, so ${t}/${b} + ${rust}/${b} = ${a}/${b}.`,
      `${t} copies of 1/${b}, then ${rust} more, is the same shaded amount.`,
    ],
    variant: { id: "picture", axes: { task: "picture" } },
  };
}

function betweenWhole(
  meta: TemplateMetadata,
  seed: string,
  r: Random,
): GeneratedProblem {
  const dens = [2, 3, 4, 5, 6, 8, 10, 12];
  let n = 2, a = 1, b = 2;
  for (let guard = 0; guard < 40; guard++) {
    n = r(2, 6);
    b = pick(r, dens);
    a = r(1, b - 1);
    const top = n * a;
    if (top % b !== 0 && top / b > 1 && top / b < 7) break;
  }
  const top = n * a;
  need(top % b !== 0 && top / b > 1 && top / b < 7, "between two wholes");
  const floor = Math.floor(top / b);
  const product = `${top}/${b}`;
  const flipped = `${b}/${top}`;
  const bottomToo = `${a}/${n * b}`;
  const bothToo = `${top}/${n * b}`;
  const productWrongs = [flipped, bottomToo, bothToo].filter(
    (label, i, all) => label !== product && all.indexOf(label) === i,
  );
  need(productWrongs.length >= 3, "three product distractors");
  const bounds = `${floor} and ${floor + 1}`;
  const boundWrongs = [
    "0 and 1",
    `${top} and ${top + 1}`,
    `${floor + 1} and ${floor + 2}`,
  ].filter((label) => label !== bounds);
  need(new Set(boundWrongs).size === 3, "three bound distractors");
  const rem = top - floor * b;
  const built = inlineSentence([
    `${n} groups of ${a}/${b} pound is `,
    {
      id: "pounds",
      label: "Pounds needed",
      correct: product,
      wrong: productWrongs.slice(0, 3),
    },
    " pounds, between ",
    {
      id: "bounds",
      label: "The two whole numbers",
      correct: bounds,
      wrong: boundWrongs,
    },
    ".",
  ]);
  return withVariant(
    multiPartProblem(meta, seed, r, {
      prompt: `${n} people each eat ${a}/${b} pound. Choose the pounds needed and the two whole numbers it lies between.`,
      layout: "inline",
      label: "Choose the amount and the bounds",
      slots: built.slots,
      sentence: built.sentence,
      hint: `${n} groups of ${a} pieces is ${n} × ${a} pieces of size 1/${b}. How many wholes do ${top} of those pieces make?`,
      explanation: [
        `${n} × ${a}/${b} = ${top}/${b}.`,
        `${b} pieces make one whole, so ${floor * b} pieces make ${floor} wholes and ${top} pieces still need ${rem} more.`,
        `${top}/${b} = ${mixedText(top, b)}, which is more than ${floor} and less than ${floor + 1}.`,
      ],
    }),
    "between",
  );
}

function stepFractions(
  meta: TemplateMetadata,
  seed: string,
  r: Random,
): GeneratedProblem {
  const kind = r(0, 3);
  let b = 2, d = 3, a = 1, c = 1, w = 0;
  for (let guard = 0; guard < 60; guard++) {
    b = r(2, 12);
    d = r(2, 12);
    const D = lcm(b, d);
    if (D > 60 || D === b || D === d) continue;
    a = r(1, b - 1);
    c = r(1, d - 1);
    w = kind === 2 ? r(1, 2) : 0;
    const A = (w * b + a) * (D / b);
    const C = c * (D / d);
    if (A === a || A === c || C === a || C === c) continue;
    if (kind === 1 && A <= C) continue;
    const sum = kind === 1 ? A - C : A + C;
    if (sum <= 0 || sum === a + c || sum === A || sum === C) continue;
    break;
  }
  const D = lcm(b, d);
  const A = (w * b + a) * (D / b);
  const C = c * (D / d);
  const op = kind === 1 ? "−" : "+";
  const sum = kind === 1 ? A - C : A + C;
  need(D <= 60 && D !== b && D !== d, "renaming denominator");
  need(A !== a && A !== c && C !== a && C !== c, "unchanged top");
  need(sum > 0 && sum !== a + c, "added tops");
  const left = w > 0 ? `${w} ${tex(a, b)}` : tex(a, b);
  const slots: Slot[] = [
    {
      id: "left",
      label: "First numerator",
      correct: `${A}`,
      wrong: [`${a}`, `${c}`, `${a + c}`, `${b + d}`],
    },
    {
      id: "right",
      label: "Second numerator",
      correct: `${C}`,
      wrong: [`${a}`, `${c}`, `${a + c}`, `${b}`],
    },
    {
      id: "sum",
      label: "Result numerator",
      correct: `${sum}`,
      wrong: [`${a + c}`, `${A + C + (kind === 1 ? 1 : 0)}`, `${b + d}`, `${a}`],
    },
  ];
  const built = inlineSentence([
    `${left} ${op} ${tex(c, d)} = `,
    slots[0]!,
    `/${D} ${op} `,
    slots[1]!,
    `/${D} = `,
    slots[2]!,
    `/${D}`,
  ]);
  return withVariant(
    multiPartProblem(meta, seed, r, {
      prompt: `Rename over the common denominator ${D}, then ${kind === 1 ? "subtract" : "add"}.`,
      layout: "inline",
      label: "Choose each numerator",
      slots: built.slots,
      sentence: built.sentence,
      hint: `${b} and ${d} both divide ${D}. Multiply the numerator of each fraction by the same factor as its denominator.`,
      explanation: [
        `${D} is a common denominator of ${b} and ${d}. The pieces become the same size.`,
        w > 0
          ? `${w} ${a}/${b} = ${w * b + a}/${b} = ${A}/${D}.`
          : `${a}/${b} = ${A}/${D}, because ${a} × ${D / b} = ${A}.`,
        `${c}/${d} = ${C}/${D}, because ${c} × ${D / d} = ${C}.`,
        `${A} ${op} ${C} = ${sum}, so the result is ${fractionText(sum, D)}. Same amount, smaller pieces, then ${kind === 1 ? "subtract" : "join"}.`,
      ],
    }),
    "steps",
  );
}

function judgeChoice(
  meta: TemplateMetadata,
  seed: string,
  r: Random,
): GeneratedProblem {
  const mode = r(0, 9);
  const wrongSum = mode < 5;
  const rightSum = mode >= 7;
  let a = 1, b = 2, c = 1, d = 3, claimN = 1, claimD = 2;
  const addendHalf = () => 2 * a >= b || 2 * c >= d;
  for (let guard = 0; guard < 80; guard++) {
    b = r(2, 12);
    d = r(2, 12);
    a = r(1, b - 1);
    c = r(1, d - 1);
    if (wrongSum || rightSum) {
      if (!addendHalf()) continue;
      if (rightSum) {
        claimN = a * d + c * b;
        claimD = b * d;
        const g = gcd(claimN, claimD);
        claimN /= g;
        claimD /= g;
        if ((a + c) * claimD === claimN * (b + d)) continue;
      } else {
        claimN = a + c;
        claimD = b + d;
        if (2 * claimN >= claimD) continue;
        if (claimN * b * d === (a * d + c * b) * claimD) continue;
      }
      break;
    }
    // Difference: claimed result bigger than the minuend.
    if (a * d <= c * b) continue;
    claimN = a + c;
    claimD = b;
    if (claimN * b <= a * claimD) continue;
    const trueN = a * d - c * b;
    const trueD = b * d;
    if (claimN * trueD === trueN * claimD) continue;
    break;
  }
  const claim = fractionText(claimN, claimD);
  const trueSum = fractionText(a * d + c * b, b * d);
  const product = fractionText(a * c, b * d);
  need(product !== claim && product !== trueSum, "product distractor");
  let correct: string;
  let wrongs: { label: string; feedback: string }[];
  if (rightSum) {
    correct = `Right: ${claim} is more than 1/2, as a sum of ${a}/${b} and ${c}/${d} must be.`;
    wrongs = [
      {
        label: `Wrong: the sum must be more than 1/2, and ${claim} is less than 1/2.`,
        feedback: `${claim} is the true sum, and it is more than 1/2.`,
      },
      {
        label: `Right: ${a} + ${c} = ${a + c} and ${b} + ${d} = ${b + d}.`,
        feedback: "Adding the denominators is not how fractions add.",
      },
      {
        label: `Wrong: the answer is ${product}.`,
        feedback: "That multiplies the fractions. The claim is the sum, and it is right.",
      },
    ];
  } else if (wrongSum) {
    correct = `Wrong: the sum must be more than 1/2, and ${claim} is less than 1/2.`;
    wrongs = [
      {
        label: `Right: ${a} + ${c} = ${a + c} and ${b} + ${d} = ${b + d}.`,
        feedback: "Adding the bottoms is not a way to add fractions.",
      },
      {
        label: `Right: ${claim} is about 1/2.`,
        feedback: "Near 1/2 is not the test. The sum of a fraction at least 1/2 and a positive fraction is more than 1/2.",
      },
      {
        label: `Wrong: the answer is ${product}.`,
        feedback: `The work is wrong, but the sum is ${trueSum}, not the product ${product}.`,
      },
    ];
  } else {
    correct = `Wrong: a difference cannot be greater than ${a}/${b}, and ${claim} is greater.`;
    wrongs = [
      {
        label: `Right: ${a} − ${c} = ${a - c} and ${b} − ${d} = ${Math.abs(b - d) || b}.`,
        feedback: "Subtracting the denominators is not how fractions subtract.",
      },
      {
        label: `Right: ${claim} is about ${a}/${b}.`,
        feedback: "The claimed difference is larger than the amount you start with, so it cannot be right.",
      },
      {
        label: `Wrong: the answer is ${product}.`,
        feedback: "That multiplies. The operation is subtraction.",
      },
    ];
  }
  need(new Set([correct, ...wrongs.map((w) => w.label)]).size === 4, "four judge statements");
  const spoken = wrongSum || rightSum
    ? `${a}/${b} + ${c}/${d} = ${claim}`
    : `${a}/${b} − ${c}/${d} = ${claim}`;
  return choiceProblem(meta, seed, "judge", {
    r,
    prompt: `Rio says ${spoken}. Choose the statement that is right.`,
    hint: rightSum
      ? `One addend is at least 1/2, so the sum ${a}/${b} + ${c}/${d} is more than 1/2. Check whether Rio's result agrees.`
      : wrongSum
        ? `One addend is at least 1/2. A sum of that and a positive fraction is more than 1/2. Where does ${claim} sit?`
        : `You start with ${a}/${b} and take away ${c}/${d}. Can the result be greater than ${a}/${b}?`,
    explanation: wrongSum || rightSum
      ? [
          `${a}/${b} + ${c}/${d} is more than 1/2, because one addend is already at least 1/2 and the other is positive.`,
          rightSum
            ? `The true sum is ${trueSum}, which is more than 1/2. Rio's result matches it.`
            : `${claim} is less than 1/2, so it cannot be the sum. The true sum is ${trueSum}.`,
        ]
      : [
          `A difference is what is left, so it is less than the amount you start with.`,
          `${claim} is greater than ${a}/${b}, so it cannot be ${a}/${b} − ${c}/${d}.`,
        ],
    choices: [
      { label: correct, correct: true, feedback: "" },
      ...wrongs,
    ],
  });
}

/** Benchmark V-judge, drawn on the family's own content stream. */
export function judgeSurface(r: Random) {
  const meta: TemplateMetadata = {
    id: "benchmark-fraction-estimate",
    version: 2,
    title: "Estimate with 0, one half and 1",
    skillId: "fraction-addition",
    gradeBand: "3–5",
    description: "Judge a claimed fraction sum or difference.",
    difficultyOffset: 0.1,
    requiredResponseCapability: "single-choice-v1",
  };
  try {
    const problem = judgeChoice(meta, "judge", r);
    return {
      prompt: problem.public.prompt,
      response: problem.public.response,
      answer: problem.answer,
      hint: problem.hint,
      explanation: problem.explanation,
      ...(problem.choiceFeedback ? { choiceFeedback: problem.choiceFeedback } : {}),
    };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Need")) return null;
    throw error;
  }
}

function riceShare(
  meta: TemplateMetadata,
  seed: string,
  r: Random,
): GeneratedProblem {
  let a = 10, b = 3;
  for (let guard = 0; guard < 20; guard++) {
    a = r(10, 60);
    b = r(2, 12);
    if (a > b && a % b !== 0) break;
  }
  need(a > b && a % b !== 0, "mixed share");
  const w = Math.floor(a / b);
  const rem = a % b;
  const share = `${a}/${b} = ${w} ${rem}/${b}`;
  const shareWrongs = [`${b}/${a}`, `${w}`, `${w} remainder ${rem}`];
  need(new Set([share, ...shareWrongs]).size === 4, "share labels");
  const bounds = `${w} and ${w + 1}`;
  const boundWrongs = [`${w - 1} and ${w}`, `${a} and ${a + 1}`, `${b} and ${b + 1}`];
  need(!boundWrongs.includes(bounds), "bound labels");
  const checkWrongs = [`${w * b}`, `${a + b}`, `${w}`];
  need(new Set([`${a}`, ...checkWrongs]).size === 4, "check labels");
  const built = inlineSentence([
    "Each person gets ",
    { id: "share", label: "Each share", correct: share, wrong: shareWrongs },
    " pounds, between ",
    { id: "bounds", label: "The two whole numbers", correct: bounds, wrong: boundWrongs },
    ". Check: the share × ",
    `${b}`,
    " = ",
    { id: "check", label: "The check product", correct: `${a}`, wrong: checkWrongs },
    ".",
  ]);
  return withVariant(
    multiPartProblem(meta, seed, r, {
      prompt: `${b} people share a ${a}-pound sack equally. Choose each share, the wholes it lies between, and the check.`,
      layout: "inline",
      label: "Choose the share, the bounds, and the check",
      slots: built.slots,
      sentence: built.sentence,
      hint: `${a} ÷ ${b} is ${a}/${b}. How many whole pounds is that, and what is left over ${b}?`,
      explanation: [
        `${a} ÷ ${b} = ${a}/${b} = ${w} ${rem}/${b}.`,
        `That is more than ${w} and less than ${w + 1}.`,
        `${w} ${rem}/${b} × ${b} = ${w * b} + ${rem} = ${a}. The shares use the whole sack.`,
      ],
    }),
    "rice",
  );
}

const CARD = { width: 260, maxHeight: 200 } as const;

function barScene(
  bars: { parts: number; shaded: number }[],
  mark?: { bar: number; parts: number },
): Scene {
  const elements: Element[] = [];
  bars.forEach((bar, y) => {
    const piece = 6 / bar.parts;
    for (let i = 0; i < bar.parts; i++) {
      const marked = mark && mark.bar === y && i < mark.parts;
      elements.push({
        type: "rect",
        id: `r${y}c${i}`,
        at: [i * piece, y * 1.5],
        size: [piece * 0.9, 1],
        fill: i < bar.shaded ? (marked ? "gold-fill" : "accent-fill") : "paper",
        stroke: "ink",
        width: 2,
      });
    }
  });
  return scene(...elements).build(CARD);
}

export function pictureValue(elements: { fill?: string }[], parts: number): number {
  const shaded = elements.filter(
    (e) => e.fill === "accent-fill" || e.fill === "gold-fill",
  ).length;
  return shaded / parts;
}

function storyOfQuantity(
  meta: TemplateMetadata,
  seed: string,
  r: Random,
): GeneratedProblem {
  const d = pick(r, [2, 3, 4, 5, 6, 8]);
  const n = r(1, d - 1);
  const total = r(2, 9);
  const product = (n / d) * total;
  const stories = [
    {
      label: `A trail is ${total} miles. Lee walked ${n}/${d} of it.`,
      value: product,
    },
    {
      label: `A ribbon is ${n}/${d} m. How many pieces of ${total} m?`,
      value: n / d / total,
    },
    {
      label: `Lee has ${n}/${d} of a pizza and gets ${total} more pizzas.`,
      value: n / d + total,
    },
    {
      label: `${total} pizzas are shared so each person gets ${n}/${d}. How many people?`,
      value: total / (n / d),
    },
  ];
  need(new Set(stories.map((s) => s.value)).size === 4, "one story value");
  need(stories.filter((s) => Math.abs(s.value - product) < 1e-9).length === 1, "one product");
  const correct = stories[0]!;
  return choiceProblem(meta, seed, "story", {
    r,
    prompt: `Which story matches ${n}/${d} × ${total}?`,
    hint: `${n}/${d} of ${total} means split ${total} into ${d} equal shares and take ${n} of them. Which story does that?`,
    explanation: [
      `${n}/${d} × ${total} is ${n}/${d} of ${total}.`,
      `The trail is ${total} miles and Lee walks ${n}/${d} of it, so the distance is ${fractionText(n * total, d)} miles.`,
      `The other stories divide, add, or ask how many people.`,
    ],
    choices: stories.map((s) => ({
      label: s.label,
      ...(s === correct ? { correct: true as const } : {}),
      feedback:
        s === correct
          ? ""
          : "That story is division or addition, not this product.",
    })),
  });
}

function modelOfQuantity(
  meta: TemplateMetadata,
  seed: string,
  r: Random,
): GeneratedProblem {
  const d = pick(r, [2, 3, 4]);
  const n = r(1, d - 1);
  const total = r(2, 4);
  const pictures = [
    {
      description: `${total} bars, each cut into ${d}, with ${n} pieces shaded.`,
      scene: barScene(Array.from({ length: total }, () => ({ parts: d, shaded: n }))),
      value: (total * n) / d,
    },
    {
      description: `One bar cut into ${d}, with ${n} pieces shaded.`,
      scene: barScene([{ parts: d, shaded: n }]),
      value: n / d,
    },
    {
      description: `${total} shaded bars, then ${total} more whole bars.`,
      scene: barScene([
        ...Array.from({ length: total }, () => ({ parts: d, shaded: n })),
        ...Array.from({ length: total }, () => ({ parts: 1, shaded: 1 })),
      ]),
      value: (total * n) / d + total,
    },
    {
      description: `One ${n}/${d} bar cut into ${total} equal pieces, one piece marked.`,
      scene: barScene([{ parts: d * total, shaded: n }], { bar: 0, parts: 1 }),
      value: n / (d * total),
    },
  ];
  const product = (total * n) / d;
  need(pictures.filter((p) => Math.abs(p.value - product) < 1e-9).length === 1, "one model");
  need(new Set(pictures.map((p) => JSON.stringify(p.scene.elements))).size === 4, "distinct pictures");
  return {
    ...problemOf(meta, seed, r, {
      prompt: `Which picture shows ${n}/${d} × ${total}?`,
      label: "Choose the picture",
      noun: "Picture" as const,
      correct: {
        description: pictures[0]!.description,
        scene: pictures[0]!.scene,
      },
      distractors: pictures.slice(1).map((p) => ({
        description: p.description,
        scene: p.scene,
        feedback: () => "That picture is one bar, an added whole, or a division.",
      })),
      hint: `Draw ${total} wholes. Cut each into ${d} equal pieces and shade ${n} pieces on each.`,
      explanation: () => [
        `${n}/${d} × ${total} means ${n}/${d} of each of ${total} wholes.`,
        `Each whole contributes ${n} pieces of size 1/${d}, so the shade is ${total * n}/${d}.`,
        `The picture with ${total} bars, ${n} shaded on each, is that product.`,
      ],
      walkthrough: pictures[0]!.scene,
    }),
    variant: { id: "model", axes: { task: "model" } },
  };
}

function fractionalQ(
  meta: TemplateMetadata,
  seed: string,
  r: Random,
): GeneratedProblem {
  const b = pick(r, [2, 3, 4, 5, 6]);
  const d = pick(r, [2, 3, 4, 5, 6, 8]);
  const a = r(1, b - 1);
  const c = r(1, d - 1);
  need(a !== b && a !== d && b !== d, "distinct part counts");
  const part = fractionText(c, d * b);
  const added = fractionText(c, d + b);
  const times = fractionText(c * b, d);
  need(part !== added && part !== times, "part distractors");
  const result = fractionText(a * c, b * d);
  const built = inlineSentence([
    `A ribbon is ${tex(c, d)} m. Mia uses ${tex(a, b)} of it. Cut it into `,
    {
      id: "cuts",
      label: "How many equal parts",
      correct: `${b}`,
      wrong: [`${a}`, `${d}`, `${b + 1}`],
    },
    " equal parts. Each part is ",
    {
      id: "part",
      label: "Size of one part",
      correct: part,
      wrong: [added, times, fractionText(c, d)],
    },
    " m. Mia takes ",
    {
      id: "take",
      label: "Parts taken",
      correct: `${a}`,
      wrong: [`${b}`, `${d}`, `${a + 1}`],
    },
    " parts, which is ",
    {
      id: "result",
      label: "Length used",
      correct: result,
      wrong: [part, times, fractionText(a * c, d)],
    },
    " m.",
  ]);
  return withVariant(
    multiPartProblem(meta, seed, r, {
      prompt: `Mia uses ${a}/${b} of a ribbon that is ${c}/${d} m long. Complete the steps.`,
      layout: "inline",
      label: "Choose each step",
      slots: built.slots,
      sentence: built.sentence,
      hint: `Cut the ${c}/${d} m ribbon into ${b} equal parts. Each part is ${c}/${d} ÷ ${b}. Then take ${a} of those parts.`,
      explanation: [
        `${a}/${b} of a quantity means cut the quantity into ${b} equal parts and take ${a} of them.`,
        `Each part is ${c}/${d} ÷ ${b} = ${c}/${d * b}.`,
        `${a} parts make ${a} × ${c}/${d * b} = ${fractionText(a * c, b * d)}. So ${a}/${b} × ${c}/${d} = ${a} × ${c}/${d} ÷ ${b}.`,
      ],
    }),
    "part",
  );
}

function representProduct(
  meta: TemplateMetadata,
  seed: string,
  r: Random,
): GeneratedProblem {
  const b = pick(r, [2, 3, 4, 5, 6, 8]);
  const rem = r(1, b - 1);
  const w = r(1, 4);
  const d = pick(r, [2, 3, 4, 5, 6, 8]);
  const n = r(1, d - 1);
  const mixedN = w * b + rem;
  const valueAsk = r(0, 1) === 1;
  if (valueAsk) {
    const answer = fractionText(n * mixedN, d * b);
    return {
      public: {
        id: hashId(meta.id, seed),
        templateId: meta.id,
        templateVersion: 1,
        seed,
        prompt: `A recipe needs ${w} ${rem}/${b} cups of flour. Sam makes ${n}/${d} of the recipe. How many cups of flour is that?`,
        skillId: meta.skillId,
        response: { kind: "fraction", label: "Cups of flour" },
      },
      answer,
      hint: `Write ${w} ${rem}/${b} as ${mixedN}/${b}, then take ${n}/${d} of that amount.`,
      explanation: [
        `${w} ${rem}/${b} = ${mixedN}/${b}.`,
        `${n}/${d} × ${mixedN}/${b} = ${n * mixedN}/${d * b} = ${answer}.`,
      ],
      variant: { id: "represent", axes: { task: "represent" } },
    };
  }
  const correct = `${n}/${d} × ${w} ${rem}/${b}`;
  const wholeOnly = `${n}/${d} × ${w} + ${rem}/${b}`;
  const choices = [
    correct,
    `${w} ${rem}/${b} ÷ ${n}/${d}`,
    `${w} ${rem}/${b} + ${n}/${d}`,
    wholeOnly,
  ];
  need(new Set(choices).size === 4, "equation labels");
  const wholeOnlyValue = (n / d) * w + rem / b;
  const trueValue = (n / d) * (mixedN / b);
  need(Math.abs(wholeOnlyValue - trueValue) > 1e-9, "whole-part error");
  return choiceProblem(meta, seed, "represent", {
    r,
    prompt: `A recipe needs ${w} ${rem}/${b} cups of flour. Sam makes ${n}/${d} of the recipe. Which equation finds the cups?`,
    hint: `${n}/${d} of the recipe means multiply the flour, the whole ${w} and the ${rem}/${b}, by ${n}/${d}.`,
    explanation: [
      `The flour is ${w} ${rem}/${b} = ${mixedN}/${b} cups.`,
      `${n}/${d} of that is ${n}/${d} × ${mixedN}/${b} = ${fractionText(n * mixedN, d * b)}.`,
      `Multiplying only the whole ${w}, then adding ${rem}/${b}, leaves the fraction out of the product.`,
    ],
    choices: [
      { label: correct, correct: true, feedback: "" },
      {
        label: choices[1]!,
        feedback: "Dividing swaps the 'of'. Sam makes a fraction of the recipe.",
      },
      {
        label: choices[2]!,
        feedback: "The recipe and the fraction of it are not added.",
      },
      {
        label: wholeOnly,
        feedback: "The fraction part of the mixed number is multiplied too, not added after.",
      },
    ],
  });
}

function unitStory(
  meta: TemplateMetadata,
  seed: string,
  r: Random,
): GeneratedProblem {
  const b = r(2, 8);
  const n = r(2, 6);
  need(n !== b, "different counts");
  const stories = [
    `${fractionText(1, b)} lb shared by ${n} people`,
    `${n} lb shared by ${b} people`,
    `how many ${fractionText(1, b)}-cup servings in ${n} cups`,
    `${fractionText(1, b)} of ${n} lb`,
  ];
  const values = [1 / (b * n), n / b, n * b, n / b];
  need(values.filter((v) => Math.abs(v - values[0]!) < 1e-12).length === 1, "one story quotient");
  const tray = [...new Set(stories)];
  const quotients = [card(1, b * n), card(n, b), card(1, b + n), card(n * b, 1)];
  need(new Set(quotients).size === 4, "quotient cards");
  const qTray = cardTray(quotients);
  const built = inlineSentence([
    "The story is ",
    {
      id: "story",
      label: "The matching story",
      correct: stories[0]!,
      fixed: tray,
    },
    " and equals ",
    {
      id: "each",
      label: "The quotient",
      correct: card(1, b * n),
      fixed: qTray,
    },
    ".",
  ]);
  return withVariant(
    multiPartProblem(meta, seed, r, {
      prompt: `Which story matches ${fractionText(1, b)} ÷ ${n}, and what is the quotient?`,
      layout: "cards",
      label: "Put a card in each box",
      slots: built.slots,
      sentence: built.sentence,
      hint: `Sharing ${fractionText(1, b)} among ${n} people cuts that part into ${n} smaller equal parts.`,
      explanation: [
        `${fractionText(1, b)} ÷ ${n} shares ${fractionText(1, b)} lb among ${n} people.`,
        `Each person gets ${fractionText(1, b * n)}.`,
        `The other stories share the wrong way, count groups, or multiply.`,
      ],
    }),
    "story",
  );
}

function unitModel(
  meta: TemplateMetadata,
  seed: string,
  r: Random,
): GeneratedProblem {
  const b = r(2, 6);
  const n = r(2, 5);
  need(n !== b, "different model counts");
  const pictures = [
    `one ${fractionText(1, b)} cut into ${n}, one small piece marked`,
    `${n} pieces of size ${fractionText(1, b)}`,
    `${fractionText(1, b)} of ${n} strips`,
    `${n} strips each cut into ${b}, every piece counted`,
  ];
  const values = [1 / (b * n), n / b, n / b, n * b];
  need(values.filter((v) => Math.abs(v - 1 / (b * n)) < 1e-12).length === 1, "one model");
  const built = inlineSentence([
    "The picture is ",
    {
      id: "pic",
      label: "The matching picture",
      correct: pictures[0]!,
      fixed: pictures,
    },
    " and shows ",
    {
      id: "val",
      label: "The amount",
      correct: card(1, b * n),
      fixed: cardTray([card(1, b * n), card(n, b), card(1, b + n), card(n, 1)]),
    },
    ".",
  ]);
  return withVariant(
    multiPartProblem(meta, seed, r, {
      prompt: `Which picture shows ${fractionText(1, b)} ÷ ${n}?`,
      layout: "cards",
      label: "Put a card in each box",
      slots: built.slots,
      sentence: built.sentence,
      hint: `Start with one piece of size 1/${b}. Cut that piece into ${n} equal parts. One of those parts is the share.`,
      explanation: [
        `One ${fractionText(1, b)} cut into ${n} equal parts makes pieces of size 1/${b * n}.`,
        `The marked piece is ${fractionText(1, b * n)}.`,
      ],
    }),
    "model",
  );
}

function unitCheck(
  meta: TemplateMetadata,
  seed: string,
  r: Random,
): GeneratedProblem {
  const wholeFirst = r(0, 1) === 1;
  if (!wholeFirst) {
    const b = r(2, 8);
    const n = r(2, 6);
    const q = card(1, b * n);
    const multiplied = card(n, b);
    const added = card(1, b + n);
    const got = card(1, b);
    const qLabels = cardTray([q, multiplied, added]);
    const gotLabels = cardTray([got, `${n + b}`, `${b * n + 1}`]);
    need(new Set([...qLabels, ...gotLabels]).size === qLabels.length + gotLabels.length, "labels once");
    const num = (label: string) => {
      const frac = label.match(/frac\{(\d+)\}\{(\d+)\}/);
      return frac ? Number(frac[1]) / Number(frac[2]) : Number(label);
    };
    let truePairs = 0;
    for (const left of qLabels)
      for (const right of gotLabels)
        if (Math.abs(num(left) * n - num(right)) < 1e-9) truePairs++;
    need(truePairs === 1, "one true check");
    const built = inlineSentence([
      `${fractionText(1, b)} ÷ ${n} = `,
      { id: "q", label: "The quotient", correct: q, fixed: qLabels },
      ` because the quotient × ${n} = `,
      { id: "got", label: "The check product", correct: got, fixed: gotLabels },
      ".",
    ]);
    return withVariant(
      multiPartProblem(meta, seed, r, {
        prompt: `Complete the check for ${fractionText(1, b)} ÷ ${n}.`,
        layout: "cards",
        label: "Put a card in each box",
        slots: built.slots,
        sentence: built.sentence,
        hint: `Sharing 1/${b} among ${n} people makes 1/${b * n}. Multiply that share by ${n} and you should get 1/${b} back.`,
        explanation: [
          `${fractionText(1, b)} ÷ ${n} = ${q}.`,
          `${q} × ${n} = ${fractionText(1, b)}. The check multiplies the quotient by the divisor.`,
        ],
      }),
      "check",
    );
  }
  const w = r(2, 8);
  const d = r(2, 8);
  const q = w * d;
  const otherWay = card(w, d);
  const flipped = card(1, q);
  need(otherWay !== `${q}` && flipped !== `${q}` && otherWay !== flipped, "whole quotient distractors");
  const qLabels = cardTray([`${q}`, otherWay, flipped]);
  const by = card(1, d);
  const byLabels = cardTray([by, `${w * d + 1}`, `${w + d + 3}`]);
  const gotLabels = cardTray([`${w}`, `${q * d}`, `${w + q}`]);
  const all = [...qLabels, ...byLabels, ...gotLabels];
  need(new Set(all).size === all.length, "labels once");
  const num = (label: string) => {
    const frac = label.match(/frac\{(\d+)\}\{(\d+)\}/);
    return frac ? Number(frac[1]) / Number(frac[2]) : Number(label);
  };
  let truePairs = 0;
  for (const left of qLabels)
    for (const mid of byLabels)
      for (const right of gotLabels)
        if (Math.abs(num(left) * num(mid) - num(right)) < 1e-9) truePairs++;
  need(truePairs === 1, "one true check");
  const built = inlineSentence([
    `${w} ÷ ${fractionText(1, d)} = `,
    { id: "q", label: "The quotient", correct: `${q}`, fixed: qLabels },
    " because the quotient × ",
    { id: "by", label: "What the check multiplies by", correct: by, fixed: byLabels },
    " = ",
    { id: "got", label: "The check product", correct: `${w}`, fixed: gotLabels },
    ".",
  ]);
  return withVariant(
    multiPartProblem(meta, seed, r, {
      prompt: `Complete the check for ${w} ÷ ${fractionText(1, d)}.`,
      layout: "cards",
      label: "Put a card in each box",
      slots: built.slots,
      sentence: built.sentence,
      hint: `${w} wholes hold ${d} pieces of 1/${d} each, so the count is ${w} × ${d}. Multiply that count by 1/${d} and you should get ${w} back.`,
      explanation: [
        `${w} ÷ ${fractionText(1, d)} = ${q}, because ${q} pieces of 1/${d} fill ${w} wholes.`,
        `${q} × ${fractionText(1, d)} = ${w}.`,
      ],
    }),
    "check",
  );
}

function groupsModel(
  meta: TemplateMetadata,
  seed: string,
  r: Random,
): GeneratedProblem {
  const total = r(2, 4);
  const d = pick(r, [2, 3, 4]);
  const correct = {
    description: `${total} bars, each cut into ${d} equal pieces, all ${total * d} pieces counted.`,
    scene: barScene(Array.from({ length: total }, () => ({ parts: d, shaded: d }))),
    value: total * d,
  };
  const half = {
    description: `${total} bars, each with 1 of ${d} pieces shaded.`,
    scene: barScene(Array.from({ length: total }, () => ({ parts: d, shaded: 1 }))),
    value: total / d,
  };
  const split = {
    description: `One bar cut into ${total * d} pieces, one piece marked.`,
    scene: barScene([{ parts: total * d, shaded: 1 }]),
    value: 1 / (total * d),
  };
  const thirds = {
    description: `${total} bars, each cut into ${d === 3 ? 4 : 3} pieces, all pieces counted.`,
    scene: barScene(
      Array.from({ length: total }, () => ({
        parts: d === 3 ? 4 : 3,
        shaded: d === 3 ? 4 : 3,
      })),
    ),
    value: total * (d === 3 ? 4 : 3),
  };
  const pictures = [correct, half, split, thirds];
  need(pictures.filter((p) => p.value === correct.value).length === 1, "one groups picture");
  return {
    ...problemOf(meta, seed, r, {
      prompt: `Which picture shows how many 1/${d}-cup scoops are in ${total} cups?`,
      label: "Choose the picture",
      noun: "Picture",
      correct: { description: correct.description, scene: correct.scene },
      distractors: pictures.slice(1).map((p) => ({
        description: p.description,
        scene: p.scene,
        feedback: () => "That picture multiplies by 1/d, divides, or cuts into a different size.",
      })),
      hint: `Each cup holds ${d} scoops of 1/${d} cup. Count the scoops in ${total} cups.`,
      explanation: () => [
        `One cup is ${d} scoops of 1/${d} cup.`,
        `${total} cups are ${total} × ${d} = ${total * d} scoops.`,
      ],
      walkthrough: correct.scene,
    }),
    variant: { id: "model", axes: { task: "model" } },
  };
}

function groupStory(
  meta: TemplateMetadata,
  seed: string,
  r: Random,
): GeneratedProblem {
  let a = 1, b = 2, c = 1, d = 3;
  for (let guard = 0; guard < 30; guard++) {
    b = r(2, 12);
    d = r(2, 12);
    a = r(1, b - 1);
    c = r(1, d - 1);
    if (gcd(a, b) === 1 && gcd(c, d) === 1 && a * d !== c * b) break;
  }
  need(a * d !== c * b, "quotient not 1");
  const product = (a / b) * (c / d);
  const swapped = (c / d) / (a / b);
  const quotient = (a / b) / (c / d);
  const added = a / b + c / d;
  need(
    new Set([quotient, swapped, product, added].map((v) => v.toFixed(6))).size === 4,
    "one question value",
  );
  const stories = [
    `How many ${c}/${d}-cup servings are in ${a}/${b} cup?`,
    `How many ${a}/${b}-cup servings are in ${c}/${d} cup?`,
    `What is ${c}/${d} of ${a}/${b} cup?`,
    `What is ${a}/${b} cup and ${c}/${d} cup together?`,
  ];
  return choiceProblem(meta, seed, "story", {
    r,
    prompt: `Which question is answered by ${a}/${b} ÷ ${c}/${d}?`,
    hint: `${a}/${b} ÷ ${c}/${d} asks how many groups of ${c}/${d} fit in ${a}/${b}.`,
    explanation: [
      `The amount is ${a}/${b} and the serving is ${c}/${d}.`,
      `The number of servings is ${a}/${b} ÷ ${c}/${d} = ${fractionText(a * d, b * c)}.`,
    ],
    choices: stories.map((label, i) => ({
      label,
      ...(i === 0 ? { correct: true as const } : {}),
      feedback: i === 0 ? "" : "That question reverses the division, multiplies, or adds.",
    })),
  });
}

function groupEquation(
  meta: TemplateMetadata,
  seed: string,
  r: Random,
): GeneratedProblem {
  let a = 2, b = 3, c = 3, d = 4;
  for (let guard = 0; guard < 20; guard++) {
    b = r(2, 12);
    d = r(2, 12);
    a = r(1, b - 1);
    c = r(1, d - 1);
    if (a * d !== c * b) break;
  }
  need(a * d !== c * b, "not one group");
  const equations = [
    `${a}/${b} ÷ ${c}/${d} = ?`,
    `${c}/${d} ÷ ${a}/${b} = ?`,
    `${a}/${b} × ${c}/${d} = ?`,
    `${a}/${b} + ${c}/${d} = ?`,
  ];
  return choiceProblem(meta, seed, "equation", {
    r,
    prompt: `A jug holds ${a}/${b} cup. A serving is ${c}/${d} cup. Which equation finds how many servings are in the jug?`,
    hint: `The amount in the jug is ${a}/${b} cup. The serving size is ${c}/${d} cup. Dividing the amount by the serving counts the servings.`,
    explanation: [
      `How many servings is the amount divided by the serving.`,
      `The amount is the dividend ${a}/${b}. The serving is the divisor ${c}/${d}.`,
      `The equation is ${a}/${b} ÷ ${c}/${d} = ?.`,
    ],
    choices: equations.map((label, i) => ({
      label,
      ...(i === 0 ? { correct: true as const } : {}),
      feedback: i === 0 ? "" : "That reverses the division, multiplies, or adds.",
    })),
  });
}

function groupModel(
  meta: TemplateMetadata,
  seed: string,
  r: Random,
): GeneratedProblem {
  let a = 2, b = 3, c = 3, d = 4;
  for (let guard = 0; guard < 20; guard++) {
    b = pick(r, [2, 3, 4, 6]);
    d = pick(r, [2, 3, 4, 6]);
    a = r(1, b - 1);
    c = r(1, d - 1);
    if (a * d !== c * b) break;
  }
  need(a * d !== c * b, "not one group");
  const quotient = (a * d) / (b * c);
  const pictures = [
    {
      description: `A ${a}/${b} bar with a ${c}/${d} bar laid on it.`,
      scene: barScene([
        { parts: b, shaded: a },
        { parts: d, shaded: c },
      ]),
      value: quotient,
    },
    {
      description: `A ${c}/${d} bar with a ${a}/${b} bar laid on it.`,
      scene: barScene([
        { parts: d, shaded: c },
        { parts: b, shaded: a },
      ]),
      value: 1 / quotient,
    },
    {
      description: `A ${a}/${b} of a ${c}/${d} bar, cross-cut.`,
      scene: barScene([{ parts: b * d, shaded: a * c }]),
      value: (a * c) / (b * d),
    },
    {
      description: `A ${a}/${b} bar joined to a ${c}/${d} bar.`,
      scene: barScene([
        { parts: b, shaded: a },
        { parts: d, shaded: d },
        { parts: d, shaded: c },
      ]),
      value: a / b + c / d,
    },
  ];
  need(
    pictures.filter((p) => Math.abs(p.value - quotient) < 1e-9).length === 1,
    "one division picture",
  );
  return {
    ...problemOf(meta, seed, r, {
      prompt: `Which picture shows ${a}/${b} ÷ ${c}/${d}?`,
      label: "Choose the picture",
      noun: "Picture",
      correct: { description: pictures[0]!.description, scene: pictures[0]!.scene },
      distractors: pictures.slice(1).map((p) => ({
        description: p.description,
        scene: p.scene,
        feedback: () => "That picture swaps the bars, multiplies, or joins them.",
      })),
      hint: `The amount is the ${a}/${b} bar. The serving is the ${c}/${d} bar laid on it. The question is how much of the serving fits.`,
      explanation: () => [
        `${a}/${b} ÷ ${c}/${d} asks how many ${c}/${d} bars fit on a ${a}/${b} bar.`,
        `The quotient is ${fractionText(a * d, b * c)}.`,
      ],
      walkthrough: pictures[0]!.scene,
    }),
    variant: { id: "model", axes: { task: "model" } },
  };
}

function areaSide(
  meta: TemplateMetadata,
  seed: string,
  r: Random,
): GeneratedProblem {
  let a = 1, b = 2, c = 1, d = 2, w = 0;
  for (let guard = 0; guard < 40; guard++) {
    b = r(2, 12);
    d = r(2, 12);
    a = r(1, b - 1);
    c = r(1, d - 1);
    w = r(0, 9) < 3 ? r(1, 3) : 0;
    const lengthN = w * d + c;
    const widthN = a * d;
    const widthD = b * lengthN;
    const g = gcd(widthN, widthD);
    if (widthD / g <= 24 && gcd(a, b) === 1) break;
  }
  const lengthN = w * d + c;
  const width = fractionText(a * d, b * lengthN);
  need(Number(width.split("/")[1] ?? 1) <= 24, "width denominator");
  const length = w > 0 ? `${w} ${fractionText(c, d)}` : fractionText(c, d);
  const area = fractionText(a, b);
  const unit = pick(r, ["mile", "meter"]);
  return {
    public: {
      id: hashId(meta.id, seed),
      templateId: meta.id,
      templateVersion: 1,
      seed,
      prompt: `A rectangle has area ${area} square ${unit} and length ${length} ${unit}. How wide is it?`,
      skillId: meta.skillId,
      response: {
        kind: "fraction",
        label: `Width in ${unit}s`,
      },
    },
    answer: width,
    hint: `Area = length × width, so the width is the area divided by the length. Divide ${area} by ${length}.`,
    explanation: [
      `Area = length × width, so width = area ÷ length.`,
      `The width is ${area} ÷ ${length} = ${width}.`,
      `Check: ${length} × ${width} = ${area}.`,
      `Multiplying the area by the length gives ${fractionText(a * lengthN, b * d)}, which is not the width. Flipping the area instead of the length, or subtracting, gives a different number.`,
    ],
    variant: { id: "area", axes: { task: "area" } },
  };
}

function reciprocalCheck(
  r: Random,
): {
  prompt: string;
  hint: string;
  explanation: string[];
  choices: Choice[];
} {
  let a = 1, b = 2, c = 1, d = 3;
  for (let guard = 0; guard < 30; guard++) {
    b = r(2, 12);
    d = r(2, 12);
    a = r(1, b - 1);
    c = r(1, d - 1);
    if (gcd(a, b) === 1 && gcd(c, d) === 1 && a * d !== b * c) break;
  }
  need(a * d !== b * c, "quotient not 1");
  const qN = a * d;
  const qD = b * c;
  const answer = fractionText(qN, qD);
  const swapped = fractionText(b * c, a * d);
  const product = fractionText(a * c, b * d);
  const pool = [swapped, product].filter((label) => label !== answer);
  need(pool.length >= 1, "a distractor");
  const extra = fractionText(a + c, b + d);
  const distractors = [...new Set([...pool, extra, fractionText(qN, qD + 1)])]
    .filter((label) => label !== answer)
    .slice(0, 3);
  need(distractors.length === 3, "three check distractors");
  const correct = `${a}/${b} ÷ ${c}/${d} = ${answer} because ${c}/${d} × ${answer} = ${a}/${b}`;
  const wrongs = distractors.map((label) => ({
    label: `${a}/${b} ÷ ${c}/${d} = ${label} because ${c}/${d} × ${label} = ${a}/${b}`,
    feedback: `${c}/${d} × ${label} is not ${a}/${b}.`,
  }));
  need(new Set([correct, ...wrongs.map((w) => w.label)]).size === 4, "distinct checks");
  return {
    prompt: `Which check shows ${a}/${b} ÷ ${c}/${d}?`,
    hint: `The quotient times the divisor ${c}/${d} has to give the dividend ${a}/${b} back.`,
    explanation: [
      `${a}/${b} ÷ ${c}/${d} = ${answer}.`,
      `${c}/${d} × ${answer} = ${a}/${b}. Quotient times divisor equals dividend.`,
    ],
    choices: [{ label: correct, correct: true, feedback: "" }, ...wrongs],
  };
}

export function scalingExplain(
  r: Random,
  task: "explain" | "times-one",
): {
  prompt: string;
  hint: string;
  explanation: string[];
  choices: Choice[];
  task: "explain" | "times-one";
} {
  if (task === "times-one") {
    const n = r(2, 10);
    const b = pick(r, [2, 3, 4, 5, 6, 8]);
    const a = r(1, b - 1);
    const second = r(0, 1) === 0 ? `${r(2, 12)}` : `${r(1, 3)}/${r(2, 6)}`;
    const correct = `${a}/${b} × ${n}/${n} = ${a * n}/${b * n} is equal to ${a}/${b} because ${n}/${n} = 1, and multiplying by 1 does not change a number`;
    const wrongs = [
      {
        label: `${a}/${b} × ${n}/${n} is greater than ${a}/${b} because it makes ${n} times as many`,
        feedback: `${n}/${n} equals 1. Multiplying by 1 does not make ${n} times as many.`,
      },
      {
        label: `${a}/${b} × ${n}/${n} is equal to ${a}/${b} because ${n}/${n} = ${n}`,
        feedback: `${n}/${n} equals 1, not ${n}.`,
      },
      {
        label: `${a}/${b} × ${n}/${n} is greater than ${second} because ${n} is greater than 1`,
        feedback: "The comparison is with the original fraction, and multiplying by 1 leaves it equal.",
      },
    ];
    return {
      task: "times-one",
      prompt: `How does ${a}/${b} × ${n}/${n} compare with ${a}/${b}?`,
      hint: `${n}/${n} is a number over itself. What is a number over itself, and what does multiplying by that do to ${a}/${b}?`,
      explanation: [
        `${n}/${n} = 1.`,
        `Multiplying by 1 does not change a number, so ${a}/${b} × ${n}/${n} = ${a * n}/${b * n} = ${a}/${b}.`,
        `This is the rule ${a}/${b} = (${n} × ${a})/(${n} × ${b}).`,
      ],
      choices: [
        { label: correct, correct: true, feedback: "" },
        ...wrongs,
      ],
    };
  }
  let a = 1;
  let b = 2;
  for (let guard = 0; guard < 20; guard++) {
    b = pick(r, [2, 3, 4, 5, 6, 8]);
    const low = Math.max(1, Math.ceil(b / 4));
    a = r(low, 3 * b);
    if (a !== b && a / b >= 0.25 && a / b <= 3) break;
  }
  need(a !== b && a / b >= 0.25 && a / b <= 3, "factor range");
  const whole = r(2, 20);
  const greater = a > b;
  const direction = greater ? "greater than" : "less than";
  const other = greater ? "less than" : "greater than";
  const reason = greater
    ? `greater than 1, so it is ${whole} plus ${a - b}/${b} of ${whole}`
    : `less than 1, so it keeps ${a}/${b} of ${whole}`;
  const correct = `${a}/${b} × ${whole} is ${direction} ${whole} because ${a}/${b} is ${reason}`;
  const wrongs = [
    {
      label: `${a}/${b} × ${whole} is ${other} ${whole} because multiplying always makes a number bigger`,
      feedback: "Multiplying by a number less than 1 makes the result smaller.",
    },
    {
      label: `${a}/${b} × ${whole} is ${direction} ${whole} because ${a}/${b} is greater than ${a}`,
      feedback: "Compare the fraction with 1, not its numerator with the other number.",
    },
    {
      label: `${a}/${b} × ${whole} is equal to ${whole} because ${a}/${b} is a fraction`,
      feedback: "A fraction can be less than 1, equal to 1, or greater than 1.",
    },
  ];
  need(new Set([correct, ...wrongs.map((w) => w.label)]).size === 4, "explain labels");
  need([correct, ...wrongs.map((w) => w.label)].every((l) => l.length <= 120), "label length");
  return {
    task: "explain",
    prompt: `Without calculating the product, how does ${a}/${b} × ${whole} compare with ${whole}?`,
    hint: `Compare ${a}/${b} with 1. ${a} and ${b} tell you whether the factor is more than one whole or less.`,
    explanation: [
      `${a}/${b} is ${direction} 1.`,
      greater
        ? `${a}/${b} = 1 + ${a - b}/${b}, so the product is ${whole} plus ${a - b}/${b} of ${whole}.`
        : `${a}/${b} of ${whole} is less than one whole copy of ${whole}.`,
      `So ${a}/${b} × ${whole} is ${direction} ${whole}.`,
    ],
    choices: [{ label: correct, correct: true, feedback: "" }, ...wrongs],
  };
}

export function buildReciprocalCheck(r: Random) {
  return reciprocalCheck(r);
}

type Built = { task: string; problem: GeneratedProblem };

function attempt(
  meta: TemplateMetadata,
  seed: string,
  task: string,
  make: (r: Random) => GeneratedProblem,
): GeneratedProblem {
  const r = random(meta.id, seed);
  let last = "";
  for (let i = 0; i < 40; i++)
    try {
      const problem = make(r);
      if (problem.variant?.id !== task)
        return { ...problem, variant: { id: task, axes: { task } } };
      return problem;
    } catch (error) {
      if (!(error instanceof Error) || !error.message.startsWith("Need")) throw error;
      last = error.message;
    }
  throw new Error(`${meta.id} ${task}: ${last}`);
}

/** A clause problem, or null when this seed stays on the stored surface. */
export function clauseProblem(
  id: string,
  seed: string,
  meta: TemplateMetadata,
): GeneratedProblem | null {
  const task = clauseTask(id, seed);
  if (task === "legacy") return null;
  const make = (r: Random): GeneratedProblem => {
    switch (id) {
      case "name-equal-share":
        return task === "phrase"
          ? namePhrase(meta, seed, r, false)
          : nameWhole(meta, seed, r, false);
      case "name-share":
        return task === "phrase"
          ? namePhrase(meta, seed, r, true)
          : nameWhole(meta, seed, r, true);
      case "compare-fractions-symbol-blanks":
        return grade3Symbols(meta, seed, r);
      case "compare-fractions-reason-blanks":
        return task === "grade3"
          ? grade3Reason(meta, seed, r)
          : unlikeReason(meta, seed, r);
      case "fraction-decompositions-select":
        return pictureDecomposition(meta, seed, r);
      case "whole-times-fraction":
        return betweenWhole(meta, seed, r);
      case "add-fractions":
        return stepFractions(meta, seed, r);
      case "whole-sharing-fraction":
        return riceShare(meta, seed, r);
      case "fraction-of-quantity":
        if (task === "story") return storyOfQuantity(meta, seed, r);
        if (task === "model") return modelOfQuantity(meta, seed, r);
        if (task === "part") return fractionalQ(meta, seed, r);
        return representProduct(meta, seed, r);
      case "unit-fraction-division-slots":
        if (task === "story") return unitStory(meta, seed, r);
        if (task === "model") return unitModel(meta, seed, r);
        return unitCheck(meta, seed, r);
      case "whole-unit-groups":
        return groupsModel(meta, seed, r);
      case "fraction-group-count":
        if (task === "story") return groupStory(meta, seed, r);
        if (task === "model") return groupModel(meta, seed, r);
        return groupEquation(meta, seed, r);
      case "divide-fractions":
        return areaSide(meta, seed, r);
      default:
        throw new Error(`No clause builder for ${id}`);
    }
  };
  return attempt(meta, seed, task, make);
}

export type { Built };
