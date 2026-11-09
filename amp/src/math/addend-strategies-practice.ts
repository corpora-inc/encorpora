import { createHash } from "node:crypto";
import { article, count } from "./agreement";
import type {
  GeneratedProblem,
  ProblemResponse,
  SemanticFigure,
  TemplateMetadata,
} from "./contracts";
import { random, shuffle, type Random } from "./distribution-practice";
import {
  CARD,
  problemOf as figureProblemOf,
  type Candidate,
} from "./figure-choice-practice";
import { array, scene } from "./scene/author";
import type { Element, Scene } from "./scene/spec";
import { serializeSelection } from "./selection-response";

/**
 * Properties of addition used as strategies (1.OA.B.3) and equal addends on
 * arrays (2.OA.C.4).
 *
 * - A known fact gives its turnaround for free, and subtraction does not turn
 *   around (`turn-around-fact`, `turn-around-sum`).
 * - Three addends: find the pair that makes ten and add it first
 *   (`make-ten-grouping`, `make-ten-step`).
 * - An array's total is a sum of equal rows or equal columns
 *   (`array-add-rows-total`, `equal-addends-match`, `equal-addends-array`,
 *   `equal-addends-select`).
 *
 * Every figure is a scene of counters, dots and an empty ten frame drawn from
 * the same numbers as the prompt; the answer is never written in a figure.
 */

const band = "K–2" as const;
const scenes = { requiredFigureCapability: "scenes-v1" as const };
const choice = { requiredResponseCapability: "single-choice-v1" as const };

export const addendStrategiesTemplates: readonly TemplateMetadata[] = [
  {
    id: "turn-around-fact",
    version: 1,
    title: "Turn a fact around",
    skillId: "turn-around-facts",
    gradeBand: band,
    description:
      "Use a known addition fact to choose its turnaround, or choose the true sentence: adding turns around, taking away does not.",
    glossarySenses: {
      whole: "whole",
      part: "part",
      parts: "part",
      square: "square-shape",
      "more than": "more-than",
    },
    ...choice,
    ...scenes,
  },
  {
    id: "turn-around-sum",
    version: 1,
    title: "Sum of a turned-around fact",
    skillId: "turn-around-facts",
    gradeBand: band,
    description:
      "Given a known addition fact, enter the sum of the same two addends in the other order.",
    glossarySenses: { square: "square-shape" },
    ...scenes,
  },
  {
    id: "make-ten-grouping",
    version: 1,
    title: "Find the two that make ten",
    skillId: "three-addends",
    gradeBand: band,
    description:
      "In a sum of three addends, choose the two that make ten, or choose the sum that has a pair making ten.",
    ...choice,
    ...scenes,
  },
  {
    id: "make-ten-step",
    version: 1,
    title: "Write the make-ten step",
    skillId: "three-addends",
    gradeBand: band,
    description:
      "Fill the box in a three-addend sum rewritten with its ten: the number left over after the ten, or the ten itself.",
    ...scenes,
  },
  {
    id: "array-add-rows-total",
    version: 1,
    title: "Add the rows of an array",
    skillId: "arrays",
    gradeBand: band,
    description:
      "Find how many dots are in an array of up to 5 rows and 5 columns by adding equal rows, including an array partly hidden by a card.",
    ...scenes,
  },
  {
    id: "equal-addends-match",
    version: 1,
    title: "Equation for an array",
    skillId: "arrays",
    gradeBand: band,
    description:
      "Choose the equation that adds equal rows to show how many dots an array has.",
    ...choice,
    ...scenes,
  },
  {
    id: "equal-addends-array",
    version: 1,
    title: "Array for an equation",
    skillId: "arrays",
    gradeBand: band,
    description:
      "Choose the array whose equal rows match a sum of equal addends.",
    requiredResponseCapability: "figure-choice-v1",
    ...scenes,
  },
  {
    id: "equal-addends-select",
    version: 1,
    title: "Both equations for an array",
    skillId: "arrays",
    gradeBand: band,
    description:
      "Select both equal-addends equations for an array: adding its rows and adding its columns.",
    requiredResponseCapability: "multi-select-v1",
    ...scenes,
  },
];

const metaOf = (id: string) =>
  addendStrategiesTemplates.find((t) => t.id === id)!;
const pick = <T>(r: Random, items: readonly T[]) =>
  items[r(0, items.length - 1)]!;
const NAMES = [
  "Zoe",
  "Max",
  "Ana",
  "Leo",
  "Mia",
  "Sam",
  "Ivy",
  "Ben",
  "Kai",
  "Nia",
];
const LETTERS = "abcd";

/* ------------------------------------------------------------ assembly */

type Option = { label: string; correct?: true; feedback?: string };
type Built = {
  variant: string;
  prompt: string;
  hint: string;
  explanation: string[];
  figure?: SemanticFigure;
  /** Number answers. */
  answer?: number;
  label?: string;
  /** Single choice: shuffled here. */
  options?: Option[];
  /** Multi-select: shuffled here; `correct` marks every selected option. */
  select?: Option[];
  responseLabel?: string;
};

function finish(
  id: string,
  seed: string,
  r: Random,
  built: Built,
): GeneratedProblem {
  const meta = metaOf(id);
  let answer: string;
  let response: ProblemResponse;
  let choiceFeedback: Record<string, string> | undefined;
  if (built.options) {
    const options = shuffle(r, [...built.options]);
    if (
      options.filter((o) => o.correct).length !== 1 ||
      new Set(options.map((o) => o.label)).size !== options.length
    )
      throw new Error(`${id}: ambiguous choices`);
    choiceFeedback = {};
    answer = "";
    response = {
      kind: "choice",
      label: built.responseLabel ?? "Choose one answer",
      options: options.map((o, i) => {
        const optionId = `option-${LETTERS[i]}`;
        if (o.correct) answer = optionId;
        else choiceFeedback![optionId] = o.feedback!;
        return { id: optionId, label: o.label };
      }),
    };
  } else if (built.select) {
    const options = shuffle(r, [...built.select]);
    if (new Set(options.map((o) => o.label)).size !== options.length)
      throw new Error(`${id}: repeated options`);
    const ids = options.map((_, i) => `option-${LETTERS[i]}`);
    const keyed = ids.filter((_, i) => options[i]!.correct);
    response = {
      kind: "multi-select",
      label: built.responseLabel ?? `Choose ${keyed.length} answers`,
      options: options.map((o, i) => ({ id: ids[i]!, label: o.label })),
      selectionCount: keyed.length,
    };
    answer = serializeSelection(keyed);
  } else {
    if (built.answer === undefined) throw new Error(`${id}: no answer`);
    answer = String(built.answer);
    response = { kind: "number", label: built.label ?? "Answer" };
  }
  return {
    public: {
      id: createHash("sha256")
        .update(JSON.stringify([id, meta.version, seed]))
        .digest("hex"),
      templateId: id,
      templateVersion: 1,
      seed,
      prompt: built.prompt,
      skillId: meta.skillId,
      response,
      ...(built.figure ? { figure: built.figure } : {}),
    },
    answer,
    explanation: built.explanation,
    hint: built.hint,
    ...(choiceFeedback ? { choiceFeedback } : {}),
    variant: { id: built.variant },
  };
}

/* ------------------------------------------------------------ figures */

/** A group of counters in two rows (top row first), from `x`, at height `y`. */
function counterGroup(
  idPrefix: string,
  n: number,
  x: number,
  y: number,
  shape: "dot" | "square",
  fill: "accent" | "warm" | "gold",
): Element[] {
  const top = Math.ceil(n / 2);
  return Array.from({ length: n }, (_, i): Element => {
    const col = i < top ? i : i - top;
    const cx = x + col + 0.5,
      cy = y + (i < top ? 1.5 : 0.5);
    return shape === "dot"
      ? {
          type: "circle",
          id: `${idPrefix}${i}`,
          center: [cx, cy],
          r: 0.36,
          fill,
          stroke: "paper",
          width: 1,
        }
      : {
          type: "rect",
          id: `${idPrefix}${i}`,
          at: [cx - 0.32, cy - 0.32],
          size: [0.64, 0.64],
          fill,
          stroke: "paper",
          width: 1,
        };
  });
}
const groupWidth = (n: number) => Math.ceil(n / 2);

/** One row of a turnaround picture: two groups of counters side by side with
 * a brace under them naming the whole (a number, or "?"). */
function factRow(
  rowId: string,
  groups: { n: number; shape: "dot" | "square" }[],
  y: number,
  whole: string,
): Element[] {
  const out: Element[] = [];
  let x = 0;
  for (const [gi, g] of groups.entries()) {
    out.push(
      ...counterGroup(
        `${rowId}g${gi}c`,
        g.n,
        x,
        y,
        g.shape,
        g.shape === "dot" ? "accent" : "warm",
      ),
    );
    x += groupWidth(g.n) + (gi === groups.length - 1 ? 0 : 0.8);
  }
  out.push({
    type: "brace",
    id: `${rowId}brace`,
    from: [x, y - 0.15],
    to: [0, y - 0.15],
    label: whole,
    stroke: "muted",
  });
  return out;
}
const groupWord = (shape: "dot" | "square", n: number) =>
  count(n, shape === "dot" ? "round counter" : "square counter");

/** Three groups of counters, each labeled with its number, above an empty
 * ten frame. */
function threeGroupsScene(addends: readonly number[]): Scene {
  const styles = [
    { shape: "dot", fill: "accent" },
    { shape: "square", fill: "warm" },
    { shape: "dot", fill: "gold" },
  ] as const;
  const elements: Element[] = [];
  let x = 0;
  for (const [i, n] of addends.entries()) {
    const s = styles[i]!;
    elements.push(...counterGroup(`g${i}c`, n, x, 0, s.shape, s.fill));
    elements.push({
      type: "text",
      id: `g${i}n`,
      at: [x + groupWidth(n) / 2, 2],
      text: String(n),
      font: "sans",
      size: "md",
      bold: true,
      align: [0, 1],
      offset: [0, -6],
    });
    x += groupWidth(n) + 1;
  }
  const left = Math.max(0, (x - 1 - 5) / 2);
  for (let i = 0; i < 10; i++)
    elements.push({
      type: "rect",
      id: `slot${i}`,
      at: [left + (i % 5), -3.4 + (i < 5 ? 1 : 0)],
      size: [1, 1],
      fill: "paper",
      stroke: "ink",
      width: 1.5,
    });
  return scene(...elements).build();
}

/* ------------------------------------------------------------ 1.OA.B.3 */

/** Addends a ≠ b in 1–9; 70% of sums cross ten (11–17), 30% are 5–10. A
 * double has no turnaround, so a sum of 18 (9 + 9) never appears. */
function turnaroundPair(r: Random): [number, number] {
  const crossing = r(1, 10) <= 7;
  for (;;) {
    const a = r(1, 9),
      b = r(1, 9);
    const c = a + b;
    if (a === b) continue;
    if (crossing ? c >= 11 : c >= 5 && c <= 10) return [a, b];
  }
}

function alsoKnown(seed: string, r: Random): GeneratedProblem {
  const [x, y] = turnaroundPair(r);
  // Whether the larger addend is written first is a coin flip.
  const [a, b]: [number, number] = r(0, 1)
    ? [Math.max(x, y), Math.min(x, y)]
    : [Math.min(x, y), Math.max(x, y)];
  const c = a + b;
  const name = pick(r, NAMES);
  const wholeFirst = r(1, 10) <= 3;
  const big = Math.max(a, b),
    small = Math.min(a, b);
  const figure: SemanticFigure = {
    kind: "scene",
    scene: scene(
      ...factRow(
        "row",
        [
          { n: a, shape: "dot" },
          { n: b, shape: "square" },
        ],
        0,
        String(c),
      ),
    ).build(),
  };
  return finish("turn-around-fact", seed, r, {
    variant: "also-known",
    prompt: `${name} knows $${a} + ${b} = ${c}$. Which fact does ${name} know now, without counting?`,
    figure,
    responseLabel: "Choose the fact",
    options: [
      {
        label: wholeFirst ? `$${c} = ${b} + ${a}$` : `$${b} + ${a} = ${c}$`,
        correct: true,
      },
      {
        label: `$${a} + ${c} = ${b}$`,
        feedback: `This uses ${c}, the whole, as a part. The parts are ${a} and ${b}, and ${a} + ${c} is more than ${c}, not ${b}.`,
      },
      {
        label: `$${big} - ${small} = ${c}$`,
        feedback: `This takes away instead of putting together. Taking ${small} from ${big} leaves less than ${big}, so it cannot make ${c}.`,
      },
    ],
    hint: `Swap the two parts, ${a} and ${b}. Does the whole change when the parts change places?`,
    explanation: [
      `${groupWord("dot", a)} and ${groupWord("square", b)} make ${c}: $${a} + ${b} = ${c}$.`,
      `Swap the two groups: the ${b} first, then the ${a}. They are the same counters, so there are still ${c}. So $${b} + ${a} = ${c}$${wholeFirst ? `, which can also be written $${c} = ${b} + ${a}$` : ""}.`,
      `The other two sentences use the same three numbers, but they are not true. ${c} is the whole, so ${a} + ${c} is more than ${b}. Taking ${small} away from ${big} leaves less than ${big}, not ${c}.`,
    ],
  });
}

function trueTurnaround(seed: string, r: Random): GeneratedProblem {
  const [x, y] = turnaroundPair(r);
  const a = Math.max(x, y),
    b = Math.min(x, y);
  const c = a + b,
    d = a - b;
  return finish("turn-around-fact", seed, r, {
    variant: "true-turnaround",
    prompt: `Which number sentence about ${a} and ${b} is true?`,
    responseLabel: "Choose the true sentence",
    options: [
      { label: `$${a} + ${b} = ${b} + ${a}$`, correct: true },
      {
        label: `$${a} - ${b} = ${b} - ${a}$`,
        feedback: `Taking away does not turn around. Taking ${b} from ${a} leaves ${d}, but you cannot take ${a} away from only ${b}.`,
      },
      {
        label: `$${a} + ${b} = ${a} - ${b}$`,
        feedback: `The signs mean different things: $${a} + ${b} = ${c}$ but $${a} - ${b} = ${d}$.`,
      },
    ],
    hint: `Turning around works when you put together. Try it with ${a} and ${b}: does it also work when you take away?`,
    explanation: [
      `Put ${a} counters with ${b} more: ${c}. Put the ${b} first and then the ${a}: still ${c}. Adding can be turned around, so $${a} + ${b} = ${b} + ${a}$ is true.`,
      `Take ${b} away from ${a} counters: ${count(d, "counter")} ${d === 1 ? "stays" : "stay"}. Now start with ${count(b, "counter")} and try to take ${a} away: there are not enough. Taking away does not turn around, so $${a} - ${b} = ${b} - ${a}$ is not true.`,
      `$${a} + ${b} = ${a} - ${b}$ is not true either: ${c} is not ${d}. The plus sign and the minus sign do different things.`,
    ],
  });
}

function turnedSum(seed: string, r: Random): GeneratedProblem {
  const [a, b] = turnaroundPair(r);
  const c = a + b;
  const name = pick(r, NAMES);
  const figure: SemanticFigure = {
    kind: "scene",
    scene: scene(
      ...factRow(
        "top",
        [
          { n: a, shape: "dot" },
          { n: b, shape: "square" },
        ],
        3.6,
        String(c),
      ),
      ...factRow(
        "bottom",
        [
          { n: b, shape: "square" },
          { n: a, shape: "dot" },
        ],
        0,
        "?",
      ),
    ).build(),
  };
  return finish("turn-around-sum", seed, r, {
    variant: "turned-sum",
    prompt: `${name} knows $${a} + ${b} = ${c}$. What is $${b} + ${a}$?`,
    figure,
    label: "Sum",
    answer: c,
    hint: `The bottom row has the same ${groupWord("dot", a)} and ${groupWord("square", b)} as the top row, in the other order. Do the counters change?`,
    explanation: [
      `${a} and ${b} make ${c}: the top row shows $${a} + ${b} = ${c}$.`,
      `The bottom row swaps the two groups: the ${b} come first, then the ${a}. No counter is added or taken away, so the total stays ${c}.`,
      `$${b} + ${a} = ${c}$. ${name} already knew it from $${a} + ${b} = ${c}$.`,
    ],
  });
}

const TEN_PAIRS: readonly (readonly [number, number])[] = [
  [1, 9],
  [2, 8],
  [3, 7],
  [4, 6],
];
type Triple = {
  addends: [number, number, number];
  /** Positions of the pair that makes ten. */
  pair: [number, number];
  rest: number;
};
/** A ten pair and a third addend, all different (except a 5 + 5 pair when
 * `withFive`), so exactly one pair makes ten. The pair's positions are drawn
 * uniformly from the three placements. */
function tenTriple(r: Random, withFive: boolean): Triple {
  const pairs = withFive ? [...TEN_PAIRS, [5, 5] as const] : TEN_PAIRS;
  const [p0, q0] = pick(r, pairs);
  const [p, q] = r(0, 1) ? [p0, q0] : [q0, p0];
  let rest = r(1, 9);
  while (rest === p || rest === q) rest = r(1, 9);
  const placement = pick(r, [
    [0, 1],
    [0, 2],
    [1, 2],
  ] as const);
  const addends: [number, number, number] = [0, 0, 0];
  addends[placement[0]] = p;
  addends[placement[1]] = q;
  addends[3 - placement[0] - placement[1]] = rest;
  return { addends, pair: [placement[0], placement[1]], rest };
}
const sumTex = (xs: readonly number[]) => xs.join(" + ");

function whichPair(seed: string, r: Random): GeneratedProblem {
  const t = tenTriple(r, false);
  const [x, y, z] = t.addends;
  const positions = [
    [0, 1],
    [0, 2],
    [1, 2],
  ] as const;
  const isTen = (pp: readonly [number, number]) =>
    pp[0] === t.pair[0] && pp[1] === t.pair[1];
  const largest = Math.max(x, y, z);
  const tenFirst = isTen([0, 1]);
  const options: Option[] = positions.map((pp) => {
    const u = t.addends[pp[0]]!,
      v = t.addends[pp[1]]!;
    const label = `$${u} + ${v}$`;
    if (isTen(pp)) return { label, correct: true };
    const leftToRight = pp[0] === 0 && pp[1] === 1;
    const bigFirst = tenFirst && (u === largest || v === largest);
    return {
      label,
      feedback: leftToRight
        ? `Adding in the order written gives ${u} + ${v} = ${u + v}, not ten. Look at all three numbers before you choose two.`
        : bigFirst
          ? `${u} + ${v} = ${u + v}, not ten. The biggest number is not always part of the ten.`
          : `${u} + ${v} = ${u + v}, not ten. Check that two numbers make exactly 10 before you add them first.`,
    };
  });
  const [p, q] = [t.addends[t.pair[0]]!, t.addends[t.pair[1]]!];
  const others = positions
    .filter((pp) => !isTen(pp))
    .map((pp) => {
      const u = t.addends[pp[0]]!,
        v = t.addends[pp[1]]!;
      return `${u} and ${v} make ${u + v}`;
    });
  return finish("make-ten-grouping", seed, r, {
    variant: "which-pair-makes-ten",
    prompt: `Add $${sumTex(t.addends)}$. Which two numbers make ten?`,
    figure: { kind: "scene", scene: threeGroupsScene(t.addends) },
    responseLabel: "Choose the pair",
    options,
    hint: `Pair up ${x} and ${y}, then ${x} and ${z}, then ${y} and ${z}. Which two fill the ten frame together?`,
    explanation: [
      `Look for two numbers that make ten: ${p} and ${q}. Their counters fill the ten frame exactly.`,
      `Now add the rest: $10 + ${t.rest} = ${10 + t.rest}$. So $${sumTex(t.addends)} = ${10 + t.rest}$.`,
      `The other pairs do not make ten: ${others[0]}, and ${others[1]}.`,
    ],
  });
}

/** Three different numbers 1–9 whose pair sums avoid ten; `near` asks for a
 * pair summing to 9 or 11, `!near` forbids sums 9–11 altogether. */
function noTenTriple(r: Random, near: boolean): [number, number, number] {
  for (;;) {
    const t: [number, number, number] = [r(1, 9), r(1, 9), r(1, 9)];
    if (new Set(t).size < 3 || t[0] + t[1] + t[2] > 20) continue;
    const sums = [t[0] + t[1], t[0] + t[2], t[1] + t[2]];
    if (sums.includes(10)) continue;
    const close = sums.some((s) => s === 9 || s === 11);
    if (near ? close : !close) return t;
  }
}
/** A double (never 5 + 5) and a third number, with no pair making ten. */
function doubleTriple(r: Random): [number, number, number] {
  for (;;) {
    const d = r(1, 9),
      t = r(1, 9);
    if (d === 5 || t === d || d + t === 10 || 2 * d + t > 20) continue;
    return shuffle(r, [d, d, t]) as [number, number, number];
  }
}
const pairsOf = (t: readonly number[]): [number, number][] => [
  [t[0]!, t[1]!],
  [t[0]!, t[2]!],
  [t[1]!, t[2]!],
];

function findTheTen(seed: string, r: Random): GeneratedProblem {
  const correct = tenTriple(r, false).addends;
  const near = noTenTriple(r, true);
  const double = doubleTriple(r);
  const plain = noTenTriple(r, false);
  const nearPair = pairsOf(near).find(([u, v]) => u + v === 9 || u + v === 11)!;
  const d = double.find((v, i) => double.indexOf(v) !== i)!;
  const [p, q] = pairsOf(correct).find(([u, v]) => u + v === 10)!;
  const all = [correct, near, double, plain];
  if (
    new Set(all.map((t) => [...t].sort((m, n) => m - n).join(","))).size !== 4
  )
    throw new Error("Need four different sums");
  const label = (t: readonly number[]) => `$${sumTex(t)}$`;
  // The hint starts the check on one number shown in the sums, never on a
  // whole sum, so it cannot point at the answer.
  const n = pick(r, [...near, ...plain]);
  return finish("make-ten-grouping", seed, r, {
    variant: "find-the-ten",
    prompt: "Which sum has two numbers that make ten?",
    responseLabel: "Choose the sum",
    options: [
      { label: label(correct), correct: true },
      {
        label: label(near),
        feedback: `${nearPair[0]} and ${nearPair[1]} make ${nearPair[0] + nearPair[1]}, not ten. Close to ten is not enough.`,
      },
      {
        label: label(double),
        feedback: `${d} and ${d} are a double: they make ${2 * d}, not ten. A double is a different shortcut.`,
      },
      {
        label: label(plain),
        feedback: `No two of ${plain[0]}, ${plain[1]} and ${plain[2]} make ten.`,
      },
    ],
    hint: `Partners to ten are 1 and 9, 2 and 8, 3 and 7, 4 and 6, and 5 and 5. In each sum, take one number and look for its partner: ${article(n)} ${n} needs ${article(10 - n)} ${10 - n} in the same sum.`,
    explanation: [
      `In $${sumTex(correct)}$, ${p} and ${q} make ten. They would fill a ten frame.`,
      `The other sums have no partners to ten. ${nearPair[0]} and ${nearPair[1]} make ${nearPair[0] + nearPair[1]}. ${d} and ${d} make ${2 * d}. In $${sumTex(plain)}$, no two numbers make ten.`,
      `So $${sumTex(correct)}$ is the sum with two numbers that make ten: $${sumTex(correct)} = 10 + ${correct.reduce((s, v) => s + v, 0) - 10} = ${correct.reduce((s, v) => s + v, 0)}$.`,
    ],
  });
}

function tenStep(seed: string, r: Random): GeneratedProblem {
  const t = tenTriple(r, true);
  const [x, y, z] = t.addends;
  const total = 10 + t.rest;
  const [p, q] = [t.addends[t.pair[0]]!, t.addends[t.pair[1]]!];
  const form = r(0, 1) ? "rest" : "ten";
  const tenFirst = r(0, 1) === 1;
  const right =
    form === "rest"
      ? tenFirst
        ? `10 + \\square`
        : `\\square + 10`
      : `${t.rest} + \\square`;
  const equation = `$${sumTex(t.addends)} = ${right}$`;
  return finish("make-ten-step", seed, r, {
    variant: form === "rest" ? "box-is-the-rest" : "box-is-the-ten",
    prompt: `What goes in the box? ${equation}`,
    figure: { kind: "scene", scene: threeGroupsScene(t.addends) },
    label: "Number in the box",
    answer: form === "rest" ? t.rest : 10,
    hint:
      form === "rest"
        ? `Find the two of ${x}, ${y} and ${z} that fill the ten frame. Which number is left over?`
        : `The ${t.rest} is written before and after the equal sign. What do the other two numbers before the equal sign make together?`,
    explanation:
      form === "rest"
        ? [
            `${p} and ${q} make ten: their counters fill the ten frame.`,
            `That ten is already written after the equal sign. What is left? ${t.rest}. So $${sumTex(t.addends)} = ${tenFirst ? `10 + ${t.rest}` : `${t.rest} + 10`}$, and ${t.rest} goes in the box.`,
            `Check: $${sumTex(t.addends)}$ is ${total}, and $10 + ${t.rest}$ is ${total} too.`,
          ]
        : [
            `The ${t.rest} is written before and after the equal sign, so the box must hold the other two numbers together.`,
            `Those numbers are ${p} and ${q}, and $${p} + ${q} = 10$: they fill the ten frame. So 10 goes in the box.`,
            `$${sumTex(t.addends)} = ${t.rest} + 10$. Check: $${sumTex(t.addends)}$ is ${total}, and $${t.rest} + 10$ is ${total} too.`,
          ],
  });
}

/* ------------------------------------------------------------ 2.OA.C.4 */

const repeated = (addend: number, times: number) =>
  Array.from({ length: times }, () => addend).join(" + ");
const equation = (addend: number, times: number, total: number) =>
  `${repeated(addend, times)} = ${total}`;
const running = (addend: number, times: number) =>
  Array.from({ length: times }, (_, i) => addend * (i + 1)).join(", ");
const dots = (n: number) => count(n, "dot");
const rowsText = (n: number) => count(n, "row");

function arrayScene(rows: number, columns: number): Scene {
  return scene(array(rows, columns, { shape: "dot" }).id("arr")).build();
}

function addRows(seed: string, r: Random): GeneratedProblem {
  const variant = pick(r, ["add-rows", "finish-the-sum", "covered"] as const);
  const rows =
    variant === "add-rows"
      ? r(1, 10) === 1
        ? 1
        : r(2, 5)
      : variant === "covered"
        ? r(3, 5)
        : r(2, 5);
  const columns = r(2, 5);
  const total = rows * columns;
  const lines = [
    `Count one row: ${dots(columns)}.`,
    rows === 1
      ? `There is only 1 row, so the total is the dots in that row.`
      : `Every row is the same, so each row adds ${columns}. There are ${rowsText(rows)}: $${repeated(columns, rows)}$.`,
    ...(rows === 1
      ? []
      : [`Add one row at a time: ${running(columns, rows)}.`]),
    `There are ${dots(total)} in all.`,
  ];
  if (variant === "add-rows")
    return finish("array-add-rows-total", seed, r, {
      variant,
      prompt:
        "Every row has the same number of dots. Add the rows. How many dots in all?",
      figure: { kind: "scene", scene: arrayScene(rows, columns) },
      label: "Dots",
      answer: total,
      hint:
        rows === 1
          ? "This array has only 1 row. Count the dots in that row one at a time."
          : `Count the dots in one row. Then add that number once for each of the ${rows} rows.`,
      explanation: lines,
    });
  if (variant === "finish-the-sum") {
    const byColumns = r(0, 1) === 1;
    const [addend, times]: [number, number] = byColumns
      ? [rows, columns]
      : [columns, rows];
    return finish("array-add-rows-total", seed, r, {
      variant: byColumns ? "finish-the-sum-columns" : "finish-the-sum",
      prompt: `${byColumns ? `Each column has ${dots(rows)}.` : `Each row has ${dots(columns)}.`} Finish the addition to find how many dots in all: $${repeated(addend, times)} = ?$`,
      figure: { kind: "scene", scene: arrayScene(rows, columns) },
      label: "Dots",
      answer: total,
      hint: `Start with ${addend}. Add ${addend} once more for each other ${byColumns ? "column" : "row"}, keeping a running total.`,
      explanation: byColumns
        ? [
            `Count one column: ${dots(rows)}. There are ${count(columns, "column")}, so the addition has ${count(columns, "addend")} of ${rows}: $${repeated(rows, columns)}$.`,
            `Add one column at a time: ${running(rows, columns)}.`,
            `$${equation(rows, columns, total)}$. There are ${dots(total)} in all.`,
          ]
        : [
            `Count one row: ${dots(columns)}. There are ${rowsText(rows)}, so the addition has ${count(rows, "addend")} of ${columns}: $${repeated(columns, rows)}$.`,
            `Add one row at a time: ${running(columns, rows)}.`,
            `$${equation(columns, rows, total)}$. There are ${dots(total)} in all.`,
          ],
    });
  }
  // The card covers every dot except the first row and the first column.
  const card: Element = {
    type: "rect",
    id: "card",
    at: [0.92, -0.1],
    size: [columns - 0.92 + 0.1, rows - 1 + 0.02],
    fill: "paper",
    stroke: "muted",
    width: 2,
    radius: 6,
  };
  const figure: SemanticFigure = {
    kind: "scene",
    scene: scene(
      array(rows, columns, { shape: "dot" }).id("arr"),
      card,
      {
        type: "text",
        id: "rowsLabel",
        at: [0, rows / 2],
        text: rowsText(rows),
        font: "sans",
        size: "sm",
        color: "accent",
        align: [1, 0],
        offset: [-10, 0],
      },
      {
        type: "text",
        id: "eachLabel",
        at: [columns / 2, rows],
        text: `${columns} in each row`,
        font: "sans",
        size: "sm",
        color: "warm",
        align: [0, 1],
        offset: [0, -8],
      },
    ).build(),
  };
  return finish("array-add-rows-total", seed, r, {
    variant,
    prompt: `The card hides some dots. Every row has ${columns}. How many dots in all?`,
    figure,
    label: "Dots",
    answer: total,
    hint: `The labels say ${rowsText(rows)}, with ${columns} in each row. Add ${columns} once for every row, even the hidden ones.`,
    explanation: [
      ...lines,
      `The card cannot hide the count: ${rowsText(rows)} of ${columns} is $${repeated(columns, rows)}$ whether you can see the dots or not.`,
    ],
  });
}

function chooseEquation(seed: string, r: Random): GeneratedProblem {
  let rows = r(2, 5),
    columns = r(2, 5);
  while (rows === 2 && columns === 2) [rows, columns] = [r(2, 5), r(2, 5)];
  const total = rows * columns;
  // Wrong count: the other side's length decides how many addends.
  const wrongTimes =
    columns !== rows ? columns : rows === 5 ? rows - 1 : rows + 1;
  const sidesTotal = rows + columns;
  const countTotal = columns * wrongTimes;
  const slip = [total - 1, total + 1].find(
    (v) => v !== sidesTotal && v !== countTotal,
  );
  if (slip === undefined) throw new Error("Need a different slip");
  return finish("equal-addends-match", seed, r, {
    variant: "choose-equation",
    prompt: "Which equation shows how many dots are in the array?",
    figure: { kind: "scene", scene: arrayScene(rows, columns) },
    responseLabel: "Choose the equation",
    options: [
      { label: `$${equation(columns, rows, total)}$`, correct: true },
      {
        label: `$${rows} + ${columns} = ${sidesTotal}$`,
        feedback: `This adds the number of rows, ${rows}, and the number in each row, ${columns}. The total adds every row: ${rowsText(rows)} of ${columns}.`,
      },
      {
        label: `$${equation(columns, wrongTimes, countTotal)}$`,
        feedback: `This has ${count(wrongTimes, "addend")} of ${columns}, but the array has ${rowsText(rows)}. Add each row's ${columns} once for every row.`,
      },
      {
        label: `$${equation(columns, rows, slip)}$`,
        feedback: `The addends are right, but the sum is not: $${repeated(columns, rows)}$ is ${total}, not ${slip}. Add one row at a time.`,
      },
    ],
    hint: `The array has ${rowsText(rows)}. How many dots are in one row? Add that number once for every row.`,
    explanation: [
      `One row has ${dots(columns)}. There are ${rowsText(rows)}, so the addends are ${count(rows, "copy", "copies")} of ${columns}.`,
      `$${rows} + ${columns} = ${sidesTotal}$ adds the number of rows to the number in a row, instead of adding the rows. $${repeated(columns, wrongTimes)}$ has ${count(wrongTimes, "addend")}, but the array has ${rowsText(rows)}. $${repeated(columns, rows)}$ is ${total}, not ${slip}.`,
      `$${equation(columns, rows, total)}$ matches: add one row at a time, ${running(columns, rows)}.`,
    ],
  });
}

type Dim = { rows: number; columns: number };
const inRange = (d: Dim) =>
  d.rows >= 1 && d.rows <= 5 && d.columns >= 1 && d.columns <= 5;
const same = (a: Dim, b: Dim) => a.rows === b.rows && a.columns === b.columns;

/** The three wrong arrays, in the spec's order of preference, chosen so all
 * four arrays differ and none matches the equation by rows or by columns. */
function wrongArrays(rows: number, columns: number): [Dim, Dim, Dim] {
  const right: Dim = { rows, columns };
  const turned: Dim = { rows: columns, columns: rows };
  const oneRowOff: Dim[] = [
    { rows: rows + 1, columns },
    { rows: rows - 1, columns },
  ];
  const lengthOff: Dim[] = [
    { rows, columns: columns + 1 },
    { rows, columns: columns - 1 },
  ];
  // The same number used for both sides: the row length as the row count
  // (or the row count as the row length). A square array has no such
  // mistake, so it gets rows two short of the addend or two rows too many.
  const sameNumber: Dim[] =
    columns !== rows
      ? [
          { rows: columns, columns },
          { rows, columns: rows },
        ]
      : columns >= 4
        ? [
            { rows, columns: columns - 2 },
            { rows: rows + 2, columns },
          ]
        : [
            { rows: rows + 2, columns },
            { rows, columns: columns - 2 },
          ];
  for (const d1 of oneRowOff)
    for (const d2 of lengthOff)
      for (const d3 of sameNumber) {
        const all = [d1, d2, d3];
        if (
          all.every((d) => inRange(d) && !same(d, right) && !same(d, turned)) &&
          !same(d1, d2) &&
          !same(d1, d3) &&
          !same(d2, d3)
        )
          return [d1, d2, d3];
      }
  throw new Error("Need different wrong arrays");
}
const arrayWords = (d: Dim) =>
  `An array of ${rowsText(d.rows)} with ${dots(d.columns)} in each row.`;

function chooseArray(seed: string, r: Random): GeneratedProblem {
  const rows = r(2, 5),
    columns = r(2, 5);
  const total = rows * columns;
  const [d1, d2, d3] = wrongArrays(rows, columns);
  const eq = equation(columns, rows, total);
  const card = (d: Dim): Scene =>
    scene(array(d.rows, d.columns, { shape: "dot" }).id("arr")).build({
      width: CARD.width,
      maxHeight: CARD.maxHeight,
    });
  const candidate = (
    d: Dim,
    feedback?: (name: string) => string,
  ): Candidate => ({
    description: arrayWords(d),
    scene: card(d),
    ...(feedback ? { feedback } : {}),
  });
  const problem = figureProblemOf(metaOf("equal-addends-array"), seed, r, {
    prompt: `Which array matches the equation $${eq}$?`,
    label: "Choose the array",
    noun: "Picture",
    correct: candidate({ rows, columns }),
    distractors: [
      candidate(
        d1,
        (name) =>
          `${name} has ${rowsText(d1.rows)}, but the equation adds ${columns} only ${rows} times: one row ${d1.rows > rows ? "too many" : "too few"}.`,
      ),
      candidate(
        d2,
        (name) =>
          `${name} has ${dots(d2.columns)} in each row, but each addend in the equation is ${columns}.`,
      ),
      candidate(
        d3,
        (name) =>
          `${name} has ${rowsText(d3.rows)} of ${d3.columns}. The equation has ${count(rows, "addend")}, and each one is ${columns}.`,
      ),
    ],
    hint: `Count the addends in $${repeated(columns, rows)}$: that is the number of rows. Each addend, ${columns}, is the number of dots in one row.`,
    explanation: (name) => [
      `The equation adds ${columns} again and again. There are ${count(rows, "addend")}, so the array has ${rowsText(rows)}.`,
      `Each addend is ${columns}, so each row has ${dots(columns)}.`,
      `${name} has ${rowsText(rows)} with ${dots(columns)} in each row: ${running(columns, rows)}. That is ${total}, the sum in the equation.`,
    ],
    walkthrough: scene(array(rows, columns, { shape: "dot" }).id("arr")).build({
      title: `${rowsText(rows)} of ${columns}`,
    }),
  });
  return { ...problem, variant: { id: "choose-array" } };
}

function selectEquations(seed: string, r: Random): GeneratedProblem {
  const rows = r(2, 5);
  let columns = r(2, 5);
  while (columns === rows) columns = r(2, 5);
  const total = rows * columns;
  // The row length used as the row count too. With rows ≠ columns this never
  // matches either right equation, and it never repeats the sum of the two
  // numbers (that would need 2 rows of 2).
  const wrongAddend = columns,
    wrongTimes = columns;
  const labels = [
    `$${equation(columns, rows, total)}$`,
    `$${equation(rows, columns, total)}$`,
    `$${rows} + ${columns} = ${rows + columns}$`,
    `$${equation(wrongAddend, wrongTimes, wrongAddend * wrongTimes)}$`,
  ];
  if (new Set(labels).size !== 4) throw new Error("Need four equations");
  return finish("equal-addends-select", seed, r, {
    variant: "select-all-equations",
    prompt: "Select the 2 equations that show how many dots are in the array.",
    figure: { kind: "scene", scene: arrayScene(rows, columns) },
    responseLabel: "Choose 2 equations",
    select: [
      { label: labels[0]!, correct: true },
      { label: labels[1]!, correct: true },
      { label: labels[2]! },
      { label: labels[3]! },
    ],
    hint: `One row has ${dots(columns)} and one column has ${dots(rows)}. An equation can add the rows or add the columns.`,
    explanation: [
      `Add the rows: ${rowsText(rows)} of ${columns} is $${equation(columns, rows, total)}$.`,
      `Add the columns: ${count(columns, "column")} of ${rows} is $${equation(rows, columns, total)}$. Both count the same ${dots(total)}.`,
      `$${rows} + ${columns} = ${rows + columns}$ adds the number of rows to the number in a row, instead of adding the rows. $${repeated(wrongAddend, wrongTimes)}$ uses ${wrongAddend} for both the addend and the number of addends, which is a different array.`,
    ],
  });
}

/* ------------------------------------------------------------ dispatch */

const generators: Record<
  string,
  (seed: string, r: Random) => GeneratedProblem
> = {
  "turn-around-fact": (seed, r) =>
    r(0, 1) ? alsoKnown(seed, r) : trueTurnaround(seed, r),
  "turn-around-sum": turnedSum,
  "make-ten-grouping": (seed, r) =>
    r(0, 1) ? whichPair(seed, r) : findTheTen(seed, r),
  "make-ten-step": tenStep,
  "array-add-rows-total": addRows,
  "equal-addends-match": chooseEquation,
  "equal-addends-array": chooseArray,
  "equal-addends-select": selectEquations,
};

export function generateAddendStrategies(
  templateId: string,
  seed: string,
): GeneratedProblem {
  const generate = generators[templateId];
  if (!generate)
    throw new Error(`Unknown addend-strategies template ${templateId}`);
  if (typeof seed !== "string" || !seed.length || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      return generate(
        seed,
        random(templateId, attempt ? `${seed}#${attempt}` : seed),
      );
    } catch (error) {
      if (!(error instanceof Error) || !error.message.startsWith("Need"))
        throw error;
    }
  }
  throw new Error(`${templateId}: no instance for ${seed}`);
}
