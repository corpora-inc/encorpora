import { createHash } from "node:crypto";
import { count } from "./agreement";
import type { GeneratedProblem, TemplateMetadata } from "./contracts";
import { random, shuffle, type Random } from "./distribution-practice";
import {
  figureOptionIds,
  figureOptionLetters,
  type FigureChoiceResponse,
} from "./figure-choice";
import {
  serializeMultiPart,
  type MultiPartChoiceResponse,
} from "./multi-part-choice";
import { scene } from "./scene/author";
import type { Scene } from "./scene/spec";

/**
 * Why addition and subtraction strategies work (2.NBT.B.9). The learner never
 * computes a sum or difference here: the answer is a reason, a flawed line and
 * what went wrong, or what a carry or borrow mark means. A student's work is
 * shown as numbered lines (a notebook) or as a column stack in the prompt; all
 * shown arithmetic is true except the one flawed line of `strategy-flaw`.
 */
const skillId = "explain-strategies";
const band = "K–2" as const;
const noLink = ["line", "lines", "change"];
export const strategyReasonsTemplates: readonly TemplateMetadata[] = [
  {
    id: "strategy-step-reason",
    version: 1,
    title: "Why does this step work?",
    skillId,
    gradeBand: band,
    description:
      "A student's addition or subtraction strategy is shown line by line. Choose the reason one step keeps the same amount, from place value or the order and grouping of addends, among reasons children often give.",
    requiredResponseCapability: "single-choice-v1",
    glossaryNoLink: noLink,
  },
  {
    id: "strategy-flaw",
    version: 1,
    title: "Find the step that went wrong",
    skillId,
    gradeBand: band,
    description:
      "A student's three-line strategy has one wrong line. Choose the line that breaks the same amount and what went wrong, such as fixing a round number the wrong way or losing a ten.",
    requiredResponseCapability: "multi-part-choice-v1",
    glossaryNoLink: noLink,
  },
  {
    id: "written-method-meaning",
    version: 1,
    title: "What does the carry or borrow mean?",
    skillId,
    gradeBand: band,
    description:
      "A column addition or subtraction shows a carried 1 or crossed-out digits. Choose the base-ten blocks that show what the mark means, including the same amount traded into another form.",
    requiredResponseCapability: "figure-choice-v1",
    requiredFigureCapability: "scenes-v1",
    glossaryNoLink: noLink,
  },
  {
    id: "written-method-reason",
    version: 1,
    title: "Why line up the digits?",
    skillId,
    gradeBand: band,
    description:
      "A column addition lines up a number under a three-digit number. Choose why each digit goes under the digit of the same place.",
    requiredResponseCapability: "single-choice-v1",
    glossaryNoLink: noLink,
  },
];

/* ------------------------------------------------------------ helpers */

const NAMES: readonly (readonly [string, "she" | "he"])[] = [
  ["Noor", "she"],
  ["Ana", "she"],
  ["Mia", "she"],
  ["Zoe", "she"],
  ["Lena", "she"],
  ["Ivy", "she"],
  ["Dev", "he"],
  ["Leo", "he"],
  ["Sam", "he"],
  ["Ravi", "he"],
  ["Kai", "he"],
  ["Omar", "he"],
];
type Person = { name: string; pro: string; Pro: string };
function person(r: Random): Person {
  const [name, pro] = NAMES[r(0, NAMES.length - 1)]!;
  return { name, pro, Pro: pro === "she" ? "She" : "He" };
}
const between = (r: Random, lo: number, hi: number) => r(lo, hi);
/** A two-digit number whose ones digit is in `ones`. */
const withOnes = (
  r: Random,
  lo: number,
  hi: number,
  ones: readonly number[],
) => {
  const options: number[] = [];
  for (let n = lo; n <= hi; n++) if (ones.includes(n % 10)) options.push(n);
  if (!options.length) throw new Error("Need a number in range");
  return options[r(0, options.length - 1)]!;
};
const tensOf = (n: number) => Math.floor(n / 10) % 10;
const onesOf = (n: number) => n % 10;
const hundredsOf = (n: number) => Math.floor(n / 100);
/** "$47 + 38$" */
const m = (text: string) => `$${text}$`;
/** Words in an option: tokens with a letter or digit, TeX markup removed. */
export function optionWords(label: string): number {
  return label
    .replace(/\$/g, " ")
    .replace(/\\[a-zA-Z]+/g, " ")
    .split(/\s+/)
    .filter((token) => /[\p{L}\p{N}]/u.test(token)).length;
}
/** "1 hundred, 0 tens and 5 ones" */
const places = (h: number, t: number, o: number) =>
  `${count(h, "hundred")}, ${count(t, "ten")} and ${count(o, "one")}`;
const notebook = (lines: readonly string[]) =>
  lines.map((line, i) => `Line ${i + 1}: ${line}`).join("\n");

export type Opt = {
  label: string;
  /** Misconception code (spec D-codes); "correct" for the key. */
  code: string;
  feedback?: string;
};
type ChoiceModel = {
  variant: string;
  prompt: string;
  correct: Opt;
  distractors: Opt[];
  explanation: string[];
  hint: string;
};

function publicId(templateId: string, seed: string) {
  return createHash("sha256")
    .update(JSON.stringify([templateId, 1, seed]))
    .digest("hex");
}
const metaOf = (id: string) =>
  strategyReasonsTemplates.find((t) => t.id === id)!;

function checkOptions(all: readonly Opt[], wordLimit: number | null) {
  if (new Set(all.map((o) => o.label)).size !== all.length)
    throw new Error("Options must differ");
  if (new Set(all.map((o) => o.code)).size !== all.length)
    throw new Error("Each option needs its own misconception code");
  if (wordLimit !== null) {
    const words = all.map((o) => optionWords(o.label));
    if (Math.max(...words) > wordLimit)
      throw new Error(
        `Option over ${wordLimit} words: ${all.map((o) => o.label).join(" | ")}`,
      );
    if (Math.max(...words) - Math.min(...words) > 3)
      throw new Error(
        `Option lengths differ by more than 3 words: ${all.map((o) => `${optionWords(o.label)} ${o.label}`).join(" | ")}`,
      );
  }
}

function choiceProblem(
  templateId: string,
  seed: string,
  r: Random,
  model: ChoiceModel,
): GeneratedProblem {
  const all = [model.correct, ...model.distractors];
  checkOptions(all, 12);
  const order = shuffle(r, [...all]);
  const id = (o: Opt) => `option-${"abcd"[order.indexOf(o)]}`;
  return {
    public: {
      id: publicId(templateId, seed),
      templateId,
      templateVersion: 1,
      seed,
      prompt: model.prompt,
      skillId,
      response: {
        kind: "choice",
        label: "Choose the reason",
        options: order.map((o) => ({ id: id(o), label: o.label })),
      },
    },
    answer: id(model.correct),
    explanation: model.explanation,
    hint: model.hint,
    choiceFeedback: Object.fromEntries(
      model.distractors.map((o) => [id(o), o.feedback!]),
    ),
    variant: { id: model.variant, axes: { strategy: model.variant } },
  };
}

/* ------------------------------------------- strategy-step-reason V1–V10 */

export const STEP_VARIANTS = [
  "v1-break-by-place",
  "v2-tens-with-tens",
  "v3-round-and-give-back",
  "v4-give-and-take",
  "v5-subtract-round",
  "v6-shift-both",
  "v7-count-up",
  "v8-pair-ones-to-ten",
  "v9-mental-tens-hundreds",
  "v10-three-digit-places",
] as const;
export type StepVariant = (typeof STEP_VARIANTS)[number];

const EASIER_WHY =
  "“Easier” says why someone wanted to do it, not why it gives the same amount.";

function breakByPlace(r: Random, p: Person): ChoiceModel {
  const b = between(r, 12, 74);
  if (b % 10 === 0) throw new Error("Need ones in the second number");
  const a = between(r, 25, 78);
  if (a + b > 99) throw new Error("Need a sum within 100");
  const t = b - (b % 10),
    o = b % 10,
    s = a + b;
  return {
    variant: "v1-break-by-place",
    prompt: `${p.name} adds ${m(`${a} + ${b}`)} like this.\n${notebook([
      m(`${b} = ${t} + ${o}`),
      m(`${a} + ${t} = ${a + t}`),
      m(`${a + t} + ${o} = ${s}`),
    ])}\nWhy can ${p.name} break ${b} into ${t} and ${o} in line 1?`,
    correct: {
      code: "correct",
      label: `${t} and ${o} make ${b}, so ${p.pro} still adds ${b}.`,
    },
    distractors: [
      {
        code: "size",
        label: `Because ${t} is bigger than ${o}, so it goes first.`,
        feedback: `Which part is bigger does not matter. What matters is that ${t} and ${o} together are still ${b}.`,
      },
      {
        code: "rule",
        label: "Because you always add the tens first.",
        feedback: `That is a habit, not a reason. The step works because ${t} + ${o} is still ${b}, so the amount added does not change.`,
      },
      {
        code: "benefit",
        label: `Because adding ${t} is easier than adding ${b}.`,
        feedback: `${EASIER_WHY} It works because ${t} and ${o} make ${b}.`,
      },
    ],
    explanation: [
      `Line 1 says ${b} is the same as ${m(`${t} + ${o}`)}: ${count(t / 10, "ten")} and ${count(o, "one")}.`,
      `Breaking a number into its tens and ones never changes it. Adding ${t} and then ${o} still adds ${b} in all.`,
      `Check: ${m(`${a} + ${t} = ${a + t}`)} and ${m(`${a + t} + ${o} = ${s}`)}. Adding ${b} at once gives the same: ${m(`${a} + ${b} = ${s}`)}.`,
      `“Bigger” and “always the tens first” are not reasons. ${EASIER_WHY}`,
    ],
    hint: `Say what ${b} is made of: how many tens and how many ones? Does breaking ${b} that way change how much ${p.name} adds?`,
  };
}

function tensWithTens(r: Random, p: Person): ChoiceModel {
  const carry = r(0, 1) === 1;
  let a = 0,
    b = 0;
  for (let tries = 0; tries < 200; tries++) {
    a = between(r, 21, 78);
    b = between(r, 21, 78);
    if (a % 10 === 0 || b % 10 === 0 || a + b > 99) continue;
    if (onesOf(a) + onesOf(b) >= 10 === carry) break;
  }
  if (
    a % 10 === 0 ||
    b % 10 === 0 ||
    a + b > 99 ||
    onesOf(a) + onesOf(b) >= 10 !== carry
  )
    throw new Error("Need two-digit addends");
  const ta = a - onesOf(a),
    tb = b - onesOf(b),
    oa = onesOf(a),
    ob = onesOf(b);
  return {
    variant: "v2-tens-with-tens",
    prompt: `${p.name} adds ${m(`${a} + ${b}`)} like this.\n${notebook([
      m(`${ta} + ${tb} = ${ta + tb}`),
      m(`${oa} + ${ob} = ${oa + ob}`),
      m(`${ta + tb} + ${oa + ob} = ${a + b}`),
    ])}\nWhy can ${p.name} add the tens and the ones apart in lines 1 and 2?`,
    correct: {
      code: "correct",
      label: "All four parts are still added. Order does not change the total.",
    },
    distractors: [
      {
        code: "size",
        label: "Because tens are bigger than ones, so they come first.",
        feedback: `Size is not the reason. ${a} is ${ta} + ${oa} and ${b} is ${tb} + ${ob}; adding all four parts in any order gives the same total.`,
      },
      {
        code: "rule",
        label: "Because tens and ones must never be added together.",
        feedback: `That is not true: line 3 adds ${ta + tb} and ${oa + ob}. The reason is that every part is still added, and the order does not change the total.`,
      },
      {
        code: "fact",
        label: `Because ${m(`${oa} + ${ob}`)} makes ${oa + ob}, and ${m(`${ta} + ${tb}`)} makes ${ta + tb}.`,
        feedback: `Both facts are true, but they do not say why splitting is allowed. Every part of ${a} and ${b} is still added, in a different order.`,
      },
    ],
    explanation: [
      `Lines 1 and 2 split ${a} into ${ta} + ${oa} and ${b} into ${tb} + ${ob}, then add the tens together and the ones together.`,
      `Nothing is left out. ${p.name} adds each of the four parts once: ${ta}, ${oa}, ${tb} and ${ob}. The order you add numbers in does not change the total.`,
      `Check: ${m(`${ta + tb} + ${oa + ob} = ${a + b}`)}, and ${m(`${a} + ${b} = ${a + b}`)} too.`,
      `“Tens are bigger” and “never mix them” are not reasons, and the true facts about ${oa} + ${ob} and ${ta} + ${tb} do not say why the split works.`,
    ],
    hint: `List every part ${p.name} adds: the tens and the ones of ${a} and of ${b}. Is any part left out, or added twice?`,
  };
}

function roundAndGiveBack(r: Random, p: Person, give: boolean): ChoiceModel {
  const a = withOnes(r, 17, 87, [7, 8, 9]);
  const k = 10 - onesOf(a),
    round = a + k;
  const b = give
    ? withOnes(
        r,
        12,
        55,
        [...Array(10).keys()].filter((o) => o >= k + 1),
      )
    : between(r, 12, 55);
  if (b % 10 === 0 || a + b > 99 || a === b)
    throw new Error("Need a sum within 100 and two different addends");
  const s = a + b;
  const big = Math.max(round, b),
    small = Math.min(round, b);
  if (big === small) throw new Error("Need different numbers");
  if (!give)
    return {
      variant: "v3-round-and-give-back",
      prompt: `${p.name} adds ${m(`${a} + ${b}`)} like this.\n${notebook([
        m(`${a} + ${k} = ${round}`),
        m(`${round} + ${b} = ${round + b}`),
        m(`${round + b} - ${k} = ${s}`),
      ])}\nWhy does ${p.name} take ${k} away in line 3?`,
      correct: {
        code: "correct",
        label: `${p.Pro} added ${round}, not ${a}. That is ${k} too many.`,
      },
      distractors: [
        {
          code: "direction",
          label: `${round} is ${k} more than ${a}, so ${p.pro} should add ${k}.`,
          feedback: `${round} is ${k} more than ${a}, so line 2 added ${k} too many. Too many must come off, not go on.`,
        },
        {
          code: "rule",
          label: `You always take ${k} away after a tens number.`,
          feedback: `That is a rule, not a reason. ${p.name} takes ${k} away because ${round} is ${k} more than ${a}.`,
        },
        {
          code: "size",
          label: `Because ${big} is a bigger number than ${small}.`,
          feedback: `Which number is bigger does not explain line 3. It works because ${p.name} added ${round}, which is ${k} more than ${a}.`,
        },
      ],
      explanation: [
        `Line 2 adds ${round} instead of ${a}. ${round} is a tens number, so it is quick to add.`,
        `But ${round} is ${k} more than ${a}. So ${round + b} is ${k} more than ${m(`${a} + ${b}`)}. Line 3 takes those ${k} back off.`,
        `Check: ${m(`${round + b} - ${k} = ${s}`)}, and ${m(`${a} + ${b} = ${s}`)}.`,
        `Adding ${k} would go the wrong way: it would make ${s + 2 * k}, not ${s}. A rule or which number is bigger does not say why.`,
      ],
      hint: `Line 2 adds ${round}, but the problem adds ${a}. Is ${round} more or less than ${a}, and by how much?`,
    };
  return {
    variant: "v4-give-and-take",
    prompt: `${p.name} adds ${m(`${a} + ${b}`)} like this.\n${notebook([
      m(`${a} + ${k} = ${round}`),
      m(`${b} - ${k} = ${b - k}`),
      m(`${round} + ${b - k} = ${s}`),
    ])}\nWhy is ${m(`${round} + ${b - k}`)} the same as ${m(`${a} + ${b}`)}?`,
    correct: {
      code: "correct",
      label: `${k} moved from ${b} to ${a}. Nothing was added or lost.`,
    },
    distractors: [
      {
        code: "both",
        label: `Because you can add ${k} to both numbers.`,
        feedback: `Adding ${k} to both numbers would add ${2 * k} in all. ${p.name} added ${k} to one number and took ${k} from the other.`,
      },
      {
        code: "benefit",
        label: `Because ${m(`${round} + ${b - k}`)} is easier to add in your head.`,
        feedback: `${EASIER_WHY} It works because ${k} only moved from ${b} to ${a}.`,
      },
      {
        code: "fact",
        label: `Because ${m(`${b - k} + ${k}`)} makes ${b}, and ${m(`${a} + ${k}`)} makes ${round}.`,
        feedback: `Both facts are true, but together they do not say why the total stays the same. The ${k} that ${a} gained is the ${k} that ${b} lost.`,
      },
    ],
    explanation: [
      `Line 1 adds ${k} to ${a} to make ${round}. Line 2 takes the same ${k} from ${b}, leaving ${b - k}.`,
      `The ${k} just moved from one number to the other. Nothing was added in all and nothing was taken away, so the total is the same.`,
      `Check: ${m(`${round} + ${b - k} = ${s}`)} and ${m(`${a} + ${b} = ${s}`)}.`,
      `Adding ${k} to both numbers would add ${2 * k}. “Easier” and the true facts about ${k} do not say why the total stays the same.`,
    ],
    hint: `Line 1 gives ${a} an extra ${k}. Where does that ${k} come from in line 2?`,
  };
}

function subtractRound(r: Random, p: Person, shift: boolean): ChoiceModel {
  const b = withOnes(r, 17, 86, [7, 8, 9]);
  const k = 10 - onesOf(b),
    round = b + k;
  const a = between(r, b + 13, shift ? 99 - k : 99);
  if (a > 99 || (shift && a + k > 99)) throw new Error("Need a within 100");
  const d = a - b;
  if (!shift) {
    if (a - round < 1) throw new Error("Need a positive first difference");
    return {
      variant: "v5-subtract-round",
      prompt: `${p.name} subtracts ${m(`${a} - ${b}`)} like this.\n${notebook([
        m(`${b} + ${k} = ${round}`),
        m(`${a} - ${round} = ${a - round}`),
        m(`${a - round} + ${k} = ${d}`),
      ])}\nWhy does ${p.name} add ${k} back in line 3?`,
      correct: {
        code: "correct",
        label: `${p.Pro} took away ${round}, not ${b}. That is ${k} too many.`,
      },
      distractors: [
        {
          code: "direction",
          label: `${b} is less than ${round}, so take ${k} more away.`,
          feedback: `Taking ${round} away already took ${k} too many, because ${round} is ${k} more than ${b}. Those ${k} must come back.`,
        },
        {
          code: "rule",
          label: `You always add ${k} back after taking away a tens number.`,
          feedback: `That is a rule, not a reason. ${p.name} adds ${k} back because ${round} is ${k} more than ${b}.`,
        },
        {
          code: "fact",
          label: `Because ${round} is a bigger number than ${b}.`,
          feedback: `True, but it does not say why ${k} goes back on. ${p.name} took away ${k} too many, so ${k} must be added back.`,
        },
      ],
      explanation: [
        `Line 2 takes away ${round} instead of ${b}. ${round} is a tens number, so it is quick to take away.`,
        `But ${round} is ${k} more than ${b}, so line 2 took away ${k} too many. Line 3 gives those ${k} back.`,
        `Check: ${m(`${a - round} + ${k} = ${d}`)}, and ${m(`${b} + ${d} = ${a}`)}, so ${m(`${a} - ${b} = ${d}`)}.`,
        `Taking ${k} more away would give ${d - 2 * k}, too little. A rule or which number is bigger does not say why.`,
      ],
      hint: `Line 2 takes away ${round}, but the problem takes away ${b}. Did ${p.name} take away too much or too little?`,
    };
  }
  return {
    variant: "v6-shift-both",
    prompt: `${p.name} subtracts ${m(`${a} - ${b}`)} like this.\n${notebook([
      m(`${a} + ${k} = ${a + k}`),
      m(`${b} + ${k} = ${round}`),
      m(`${a + k} - ${round} = ${d}`),
    ])}\nWhy is ${m(`${a + k} - ${round}`)} the same as ${m(`${a} - ${b}`)}?`,
    correct: {
      code: "correct",
      label: `Both numbers moved up ${k}. The gap between them stayed the same.`,
    },
    distractors: [
      {
        code: "both",
        label: `Because you can add ${k} to just one number.`,
        feedback: `Moving just one number changes the gap between them. ${p.name} moved both numbers up ${k}, so the gap stayed ${d}.`,
      },
      {
        code: "benefit",
        label: `Because ${m(`${a + k} - ${round}`)} is easier to subtract in your head.`,
        feedback: `${EASIER_WHY} It works because both numbers moved up the same ${k}.`,
      },
      {
        code: "fact",
        label: `Because ${m(`${b} + ${k}`)} makes ${round}, which is a tens number.`,
        feedback: `True, but it only talks about ${b}. The answer stays the same because ${a} moved up ${k} too.`,
      },
    ],
    explanation: [
      `Lines 1 and 2 add ${k} to both numbers: ${a} becomes ${a + k} and ${b} becomes ${round}.`,
      `A difference is the gap between two numbers. When both move up the same amount, the gap does not change.`,
      `Check: ${m(`${a + k} - ${round} = ${d}`)} and ${m(`${b} + ${d} = ${a}`)}, so ${m(`${a} - ${b} = ${d}`)} too.`,
      `Adding ${k} to just one number would change the gap. “Easier” and the fact about ${b} do not say why the answer stays the same.`,
    ],
    hint: `Line 1 adds ${k} to ${a} and line 2 adds ${k} to ${b}. If both numbers move up ${k}, does the gap between them change?`,
  };
}

function countUp(r: Random, p: Person): ChoiceModel {
  let a: number, b: number;
  if (r(0, 1) === 0) {
    a = 10 * between(r, 5, 9);
    b = between(r, a - 45, a - 11);
  } else {
    a = between(r, 31, 99);
    if (a % 10 === 0) throw new Error("Need a not a tens number");
    b = a - between(r, 11, 15);
  }
  if (b % 10 === 0 || b < 11) throw new Error("Need ones in b");
  const round = b + (10 - onesOf(b)),
    h1 = round - b,
    h2 = a - round,
    d = a - b;
  if (h2 < 1) throw new Error("Need a second hop");
  return {
    variant: "v7-count-up",
    prompt: `${p.name} subtracts ${m(`${a} - ${b}`)} like this.\n${notebook([
      m(`${b} + ${h1} = ${round}`),
      m(`${round} + ${h2} = ${a}`),
      `${m(`${h1} + ${h2} = ${d}`)}, so ${m(`${a} - ${b} = ${d}`)}`,
    ])}\nWhy can ${p.name} add up from ${b} to find ${m(`${a} - ${b}`)}?`,
    correct: {
      code: "correct",
      label: `${m(`${a} - ${b}`)} asks what goes with ${b} to make ${a}.`,
    },
    distractors: [
      {
        code: "commute",
        label: "Because you can switch the numbers in a subtraction around.",
        feedback: `A subtraction cannot be turned around: ${m(`${b} - ${a}`)} is not ${m(`${a} - ${b}`)}. Adding up works because ${m(`${a} - ${b}`)} is the amount that goes with ${b} to make ${a}.`,
      },
      {
        code: "benefit",
        label: "Because adding is easier than taking away.",
        feedback: `${EASIER_WHY} Adding up works because ${b} and the answer together make ${a}.`,
      },
      {
        code: "size",
        label: `Because ${d} is a smaller number than ${b}.`,
        feedback: `Size does not explain it. ${m(`${a} - ${b}`)} is the missing part: ${b} + ? = ${a}.`,
      },
    ],
    explanation: [
      `${m(`${a} - ${b}`)} is the part that is left when ${b} is taken from ${a}. So ${b} and that part together make ${a}.`,
      `${p.name} finds that part by adding up from ${b}: ${h1} to reach ${round}, then ${h2} to reach ${a}. The hops ${h1} and ${h2} make ${d}.`,
      `Check: ${m(`${b} + ${d} = ${a}`)}, so ${m(`${a} - ${b} = ${d}`)}.`,
      `A subtraction does not turn around. “Easier” and comparing ${d} with ${b} do not say why adding up finds the difference.`,
    ],
    hint: `${m(`${a} - ${b}`)} is what goes with ${b} to make ${a}. How does adding up from ${b} find that amount?`,
  };
}

const PAIRS = [
  [1, 9],
  [2, 8],
  [3, 7],
  [4, 6],
] as const;
/** Four two-digit numbers; ones 1+3 and 2+4 each make ten. */
function pairedFour(r: Random, maxTensSum: number) {
  const pairs = shuffle(r, [...PAIRS]).slice(0, 2);
  const [p1, p2] = [pairs[0]!, pairs[1]!].map(
    (pair) =>
      (r(0, 1) ? [pair[0], pair[1]] : [pair[1], pair[0]]) as [number, number],
  );
  const ones = [p1![0], p2![0], p1![1], p2![1]];
  const tens = ones.map(() => between(r, 1, 4));
  const tensSum = tens.reduce((x, y) => x + y, 0);
  if (tensSum > maxTensSum) throw new Error("Need a smaller total");
  return {
    numbers: ones.map((o, i) => 10 * tens[i]! + o),
    ones,
    tens,
    tensSum,
  };
}

function pairOnes(r: Random, p: Person): ChoiceModel {
  const { numbers, ones, tens, tensSum } = pairedFour(r, 13);
  const [o1, o2, o3, o4] = ones as [number, number, number, number];
  const T = 10 * tensSum,
    S = T + 20;
  return {
    variant: "v8-pair-ones-to-ten",
    prompt: `${p.name} adds ${m(numbers.join(" + "))} like this.\n${notebook([
      `Ones: ${m(`${o1} + ${o3} = 10`)} and ${m(`${o2} + ${o4} = 10`)}`,
      `Tens: ${m(`${tens.map((t) => 10 * t).join(" + ")} = ${T}`)}`,
      m(`${T} + 10 + 10 = ${S}`),
    ])}\nWhy can ${p.name} add the ${o1} and the ${o3} first, out of order?`,
    correct: {
      code: "correct",
      label: "The order you add numbers in does not change the total.",
    },
    distractors: [
      {
        code: "rule",
        label: "Because you must add the first two numbers first.",
        feedback: `There is no such rule for adding, and ${p.name} did not do that. Any order of adding gives the same total.`,
      },
      {
        code: "benefit",
        label: "Because ten is an easy number to add.",
        feedback: `${EASIER_WHY} The order of adding never changes the total.`,
      },
      {
        code: "fact",
        label: `Because ${o1} and ${o3} are both in the ones place.`,
        feedback: `True, but ${o2} is also in the ones place and sits between them. Pairing out of order works because order does not change a total.`,
      },
    ],
    explanation: [
      `Line 1 adds the ones in pairs that make ten: ${o1} with ${o3}, and ${o2} with ${o4}. The pairs are not next to each other.`,
      `When you add, you can add the numbers in any order and group them in any way. The total does not change.`,
      `Check: the ones add to ${o1 + o2 + o3 + o4} in written order too, and ${m(`${T} + 20 = ${S}`)}.`,
      `There is no rule to add the first two first. “Ten is easy” says why ${p.name} wanted to, not why it works.`,
    ],
    hint: `${p.name} adds ${o1} and ${o3} before ${o2}. Does the order you add numbers in change the total?`,
  };
}

function mentalTensHundreds(r: Random, p: Person): ChoiceModel {
  const form = r(0, 2);
  if (form === 0) {
    const n = between(r, 100, 899);
    const h = hundredsOf(n);
    return {
      variant: "v9-mental-tens-hundreds",
      prompt: `${p.name} adds 100 in ${p.pro === "she" ? "her" : "his"} head.\n${notebook(
        [
          m(`${n} + 100 = ${n + 100}`),
          `Only the hundreds digit changed: ${h} became ${h + 1}.`,
        ],
      )}\nWhy did only the hundreds digit change?`,
      correct: {
        code: "correct",
        label: "100 is 1 hundred with no tens or ones to add.",
      },
      distractors: [
        {
          code: "size",
          label: "Because 100 is a big number to add in your head.",
          feedback: `Being big does not decide which digit changes. 100 is 1 hundred, 0 tens and 0 ones, so only the hundreds go up.`,
        },
        {
          code: "fact",
          label: `Because ${m(`${h} + 1`)} makes ${h + 1}, and ${h + 1} is more than ${h}.`,
          feedback: `True, but it does not say why the tens and ones stay the same. 100 has no tens and no ones to add.`,
        },
        {
          code: "rule",
          label: "You always change the first digit when you add.",
          feedback: `Not always: adding 10 changes the tens digit. Here 100 is 1 hundred, so the hundreds digit changes.`,
        },
      ],
      explanation: [
        `Line 1 adds 100 to ${n}. 100 is 1 hundred, 0 tens and 0 ones.`,
        `So the sum has 1 more hundred: the hundreds digit goes from ${h} to ${h + 1}. The tens and the ones have nothing added, so they stay.`,
        `Check: ${n} is ${places(h, tensOf(n), onesOf(n))}, and ${n + 100} is ${places(h + 1, tensOf(n), onesOf(n))}.`,
        `Being a big number and “always the first digit” are not reasons. The fact ${m(`${h} + 1`)} is true but does not say why the other digits stay.`,
      ],
      hint: `Write 100 as hundreds, tens and ones. Which of those does 100 add to ${n}?`,
    };
  }
  if (form === 1) {
    const h = between(r, 2, 9),
      o = between(r, 0, 9);
    const n = 100 * h + o;
    return {
      variant: "v9-mental-tens-hundreds",
      prompt: `${p.name} takes away 10 in ${p.pro === "she" ? "her" : "his"} head.\n${notebook(
        [
          m(`${n} - 10 = ${n - 10}`),
          `The tens digit 0 became 9, and the hundreds digit ${h} became ${h - 1}.`,
        ],
      )}\nWhy did the hundreds digit change too?`,
      correct: {
        code: "correct",
        label: "There were 0 tens, so 1 hundred became 10 tens.",
      },
      distractors: [
        {
          code: "size",
          label: "Because taking away 10 makes every digit smaller.",
          feedback: `Not every digit got smaller: the tens digit went from 0 to 9. A hundred was opened into 10 tens.`,
        },
        {
          code: "fact",
          label: `Because ${m(`${h} - 1`)} makes ${h - 1}, and ${h - 1} is less than ${h}.`,
          feedback: `True, but it does not say why a hundred was used. There were 0 tens, so 1 hundred had to become 10 tens.`,
        },
        {
          code: "rule",
          label: "You always change the first digit when you subtract.",
          feedback: `Not always: ${m(`${n + 30} - 10`)} keeps the hundreds digit. Here there were 0 tens to take from.`,
        },
      ],
      explanation: [
        `${n} has ${places(h, 0, o)}. Taking away 10 needs 1 ten, but there are 0 tens.`,
        `So 1 hundred is opened into 10 tens, leaving ${count(h - 1, "hundred")} and 10 tens. Taking 1 ten leaves 9 tens.`,
        `Check: ${n - 10} is ${places(h - 1, 9, o)}, and ${m(`${n - 10} + 10 = ${n}`)}.`,
        `Not every digit got smaller, and there is no “first digit” rule. The fact ${m(`${h} - 1`)} is true but does not say why.`,
      ],
      hint: `How many tens does ${n} have? Where can ${p.name} get a ten to take away?`,
    };
  }
  const h = between(r, 1, 8),
    o = between(r, 0, 9);
  const n = 100 * h + 90 + o;
  return {
    variant: "v9-mental-tens-hundreds",
    prompt: `${p.name} adds 10 in ${p.pro === "she" ? "her" : "his"} head.\n${notebook(
      [
        m(`${n} + 10 = ${n + 10}`),
        `The tens digit 9 became 0, and the hundreds digit ${h} became ${h + 1}.`,
      ],
    )}\nWhy did the hundreds digit change too?`,
    correct: {
      code: "correct",
      label: "9 tens and 1 more ten make 10 tens: 1 hundred.",
    },
    distractors: [
      {
        code: "size",
        label: "Because 10 is a big number to add in your head.",
        feedback: `Size is not the reason. 9 tens and 1 more ten make 10 tens, and 10 tens are 1 hundred.`,
      },
      {
        code: "fact",
        label: `Because ${m(`${h} + 1`)} makes ${h + 1}, and ${h + 1} is more than ${h}.`,
        feedback: `True, but it does not say where the extra hundred came from. 10 tens were traded for 1 hundred.`,
      },
      {
        code: "rule",
        label: "You always change the first digit when you add.",
        feedback: `Not always: ${m(`${n - 30} + 10`)} keeps the hundreds digit. Here the tens made a new hundred.`,
      },
    ],
    explanation: [
      `${n} has ${places(h, 9, o)}. Adding 10 adds 1 ten, so there are 10 tens.`,
      `10 tens make 1 hundred. So the tens trade for 1 more hundred: ${h + 1} hundreds and 0 tens.`,
      `Check: ${n + 10} is ${places(h + 1, 0, o)}, and ${m(`${n + 10} - 10 = ${n}`)}.`,
      `Size and a “first digit” rule are not reasons. The fact ${m(`${h} + 1`)} is true but does not say where the hundred came from.`,
    ],
    hint: `${n} has 9 tens. Add 1 more ten: how many tens is that, and what do that many tens make?`,
  };
}

function threeDigitPlaces(r: Random, p: Person): ChoiceModel {
  const onesCarry = r(0, 1) === 0;
  const a = between(r, 123, 489),
    b = between(r, 123, 489);
  const [ha, ta, oa] = [hundredsOf(a), tensOf(a), onesOf(a)];
  const [hb, tb, ob] = [hundredsOf(b), tensOf(b), onesOf(b)];
  if ([ta, oa, tb, ob].includes(0)) throw new Error("Need nonzero digits");
  const os = oa + ob,
    ts = ta + tb,
    hs = ha + hb;
  // Exactly one column reaches ten, and its carry does not make the next
  // column reach ten as well.
  if (
    os >= 10 !== onesCarry ||
    ts + (onesCarry ? 1 : 0) >= 10 === onesCarry ||
    hs + (onesCarry ? 0 : 1) > 9
  )
    throw new Error("Need exactly one column of ten or more");
  const S = a + b;
  if (S > 999) throw new Error("Need a sum within 1000");
  if (onesCarry) {
    return {
      variant: "v10-three-digit-places",
      prompt: `${p.name} adds ${m(`${a} + ${b}`)} like this.\n${notebook([
        `${m(`${100 * ha} + ${100 * hb} = ${100 * hs}`)} and ${m(`${10 * ta} + ${10 * tb} = ${10 * ts}`)}`,
        m(`${oa} + ${ob} = ${os}`),
        m(`${100 * hs} + ${10 * ts} + ${os} = ${S}`),
      ])}\nWhy does the sum ${S} have ${ts + 1} tens when line 1 has ${ts}?`,
      correct: {
        code: "correct",
        label: `${os} is 1 ten and ${count(os - 10, "one")}. The ten joins the tens.`,
      },
      distractors: [
        {
          code: "digit",
          label: `Because the 1 in ${os} is just 1, a one.`,
          feedback: `The 1 in ${os} is in the tens place. It means 1 ten, not 1 one.`,
        },
        {
          code: "rule",
          label: "Because when a column is over 10, you cross something out.",
          feedback: `Crossing out is not a reason. ${os} ones are 1 ten and ${count(os - 10, "one")}, and that ten belongs with the tens.`,
        },
        {
          code: "fact",
          label: `Because ${m(`${ts} + 1`)} makes ${ts + 1}, and ${ts + 1} is the tens digit.`,
          feedback: `True, but it does not say where the extra 1 ten came from. It came from the ${os} ones.`,
        },
      ],
      explanation: [
        `Line 2 adds the ones: ${m(`${oa} + ${ob} = ${os}`)}. That is ${os} ones.`,
        `${os} ones are 1 ten and ${count(os - 10, "one")}. The ten joins the ${ts} tens from line 1, making ${ts + 1} tens.`,
        `Check: ${100 * hs} + ${10 * ts} + ${os} is ${hs} hundreds, ${ts + 1} tens and ${count(os - 10, "one")}, which is ${S}.`,
        `The 1 in ${os} is a ten, not a one. Crossing out is not a reason, and the fact ${m(`${ts} + 1`)} does not say where the ten came from.`,
      ],
      hint: `Line 2 makes ${os} ones. How many tens and ones is ${os}? Where does each part belong?`,
    };
  }
  const tv = 10 * ts;
  return {
    variant: "v10-three-digit-places",
    prompt: `${p.name} adds ${m(`${a} + ${b}`)} like this.\n${notebook([
      m(`${100 * ha} + ${100 * hb} = ${100 * hs}`),
      `${m(`${10 * ta} + ${10 * tb} = ${tv}`)} and ${m(`${oa} + ${ob} = ${os}`)}`,
      m(`${100 * hs} + ${tv} + ${os} = ${S}`),
    ])}\nWhy does the sum ${S} have ${hs + 1} hundreds when line 1 has ${hs}?`,
    correct: {
      code: "correct",
      label: `${tv} is 1 hundred and ${count(ts - 10, "ten")}. The hundred joins the hundreds.`,
    },
    distractors: [
      {
        code: "digit",
        label: `Because the first 1 in ${tv} is just 1 ten.`,
        feedback: `The first 1 in ${tv} is in the hundreds place. It means 1 hundred, not 1 ten.`,
      },
      {
        code: "rule",
        label: "Because when a column is over 10, you cross something out.",
        feedback: `Crossing out is not a reason. ${tv} is 1 hundred and ${count(ts - 10, "ten")}, and that hundred belongs with the hundreds.`,
      },
      {
        code: "fact",
        label: `Because ${m(`${hs} + 1`)} makes ${hs + 1}, and ${hs + 1} is the hundreds digit.`,
        feedback: `True, but it does not say where the extra hundred came from. It came from the ${ts} tens.`,
      },
    ],
    explanation: [
      `Line 2 adds the tens: ${m(`${10 * ta} + ${10 * tb} = ${tv}`)}. That is ${ts} tens.`,
      `${ts} tens are 1 hundred and ${count(ts - 10, "ten")}. The hundred joins the ${hs} hundreds from line 1, making ${hs + 1} hundreds.`,
      `Check: ${100 * hs} + ${tv} + ${os} is ${hs + 1} hundreds, ${count(ts - 10, "ten")} and ${count(os, "one")}, which is ${S}.`,
      `The first 1 in ${tv} is a hundred, not a ten. Crossing out is not a reason, and the fact ${m(`${hs} + 1`)} does not say where the hundred came from.`,
    ],
    hint: `Line 2 makes ${tv}. How many hundreds and tens is ${tv}? Where does each part belong?`,
  };
}

function stepModel(variant: StepVariant, r: Random, p: Person): ChoiceModel {
  switch (variant) {
    case "v1-break-by-place":
      return breakByPlace(r, p);
    case "v2-tens-with-tens":
      return tensWithTens(r, p);
    case "v3-round-and-give-back":
      return roundAndGiveBack(r, p, false);
    case "v4-give-and-take":
      return roundAndGiveBack(r, p, true);
    case "v5-subtract-round":
      return subtractRound(r, p, false);
    case "v6-shift-both":
      return subtractRound(r, p, true);
    case "v7-count-up":
      return countUp(r, p);
    case "v8-pair-ones-to-ten":
      return pairOnes(r, p);
    case "v9-mental-tens-hundreds":
      return mentalTensHundreds(r, p);
    case "v10-three-digit-places":
      return threeDigitPlaces(r, p);
  }
}

/* ------------------------------------------------ strategy-flaw F1–F9 */

export const FLAW_KINDS = [
  "f1-give-back-wrong-way",
  "f2-add-to-both",
  "f3-shift-one-number",
  "f4-subtract-round-wrong-way",
  "f5-lose-the-ten",
  "f6-drop-a-hop",
  "f7-smaller-from-larger",
  "f8-hundred-in-wrong-place",
  "f9-carry-one-not-two",
] as const;
export type FlawKind = (typeof FLAW_KINDS)[number];
/** The line each flaw can sit on. The position is drawn first, so each line
 * is the flawed one in a third of problems. */
export const FLAW_POSITIONS: Record<1 | 2 | 3, readonly FlawKind[]> = {
  1: ["f2-add-to-both", "f7-smaller-from-larger", "f8-hundred-in-wrong-place"],
  2: [
    "f2-add-to-both",
    "f7-smaller-from-larger",
    "f8-hundred-in-wrong-place",
    "f9-carry-one-not-two",
  ],
  3: [
    "f1-give-back-wrong-way",
    "f3-shift-one-number",
    "f4-subtract-round-wrong-way",
    "f5-lose-the-ten",
    "f6-drop-a-hop",
  ],
};
type FlawModel = {
  kind: FlawKind;
  problem: string;
  lines: [string, string, string];
  flawed: 1 | 2 | 3;
  correct: Opt;
  distractors: Opt[];
  explanation: string[];
  hint: string;
};

function flawModel(
  kind: FlawKind,
  at: 1 | 2 | 3,
  r: Random,
  p: Person,
): FlawModel {
  switch (kind) {
    case "f1-give-back-wrong-way": {
      const a = withOnes(r, 17, 87, [7, 8, 9]);
      const k = 10 - onesOf(a),
        round = a + k;
      const b = between(r, 12, 55);
      if (b % 10 === 0 || a + b > 99) throw new Error("Need a sum within 100");
      const s = a + b,
        shown = round + b + k;
      return {
        kind,
        problem: m(`${a} + ${b}`),
        lines: [
          m(`${a} + ${k} = ${round}`),
          m(`${round} + ${b} = ${round + b}`),
          m(`${round + b} + ${k} = ${shown}`),
        ],
        flawed: 3,
        correct: {
          code: "correct",
          label: `${p.Pro} added ${round}, ${k} more than ${a}. ${p.Pro} should take ${k} away.`,
        },
        distractors: [
          {
            code: "arith",
            label: `${m(`${round} + ${b}`)} is not ${round + b}.`,
          },
          {
            code: "refuse",
            label: `${p.Pro} must not add ${k} to ${a} at all.`,
          },
          {
            code: "rule",
            label: `Line 2 should say ${m(`${b} + ${round}`)}, not ${m(`${round} + ${b}`)}.`,
          },
        ],
        explanation: [
          `Line 3 is wrong. Lines 1 and 2 are true: ${p.name} used ${round} in place of ${a}.`,
          `${round} is ${k} more than ${a}, so ${round + b} is ${k} too many. Adding ${k} more makes it worse.`,
          `The fixed line 3 is ${m(`${round + b} - ${k} = ${s}`)}. So ${m(`${a} + ${b} = ${s}`)}, not ${shown}.`,
          `Check by taking away: ${m(`${s} - ${b} = ${a}`)}.`,
        ],
        hint: `Check each line against ${m(`${a} + ${b}`)}. Line 1 used ${round} instead of ${a}: too much or too little? Which way must the extra go?`,
      };
    }
    case "f2-add-to-both": {
      const a = withOnes(r, 17, 87, [7, 8, 9]);
      const k = 10 - onesOf(a),
        round = a + k;
      const b = withOnes(
        r,
        12,
        55,
        [...Array(10).keys()].filter((o) => o >= k + 1),
      );
      // Different ones digits: only a reaches a tens number, so the line that
      // moves b is plainly the one that should have taken k away.
      if (a + b > 99 || onesOf(b) === onesOf(a))
        throw new Error("Need a sum within 100 and two different addends");
      const s = a + b,
        shown = round + b + k;
      const first = m(`${a} + ${k} = ${round}`),
        wrong = m(`${b} + ${k} = ${b + k}`);
      return {
        kind,
        problem: m(`${a} + ${b}`),
        lines:
          at === 1
            ? [wrong, first, m(`${round} + ${b + k} = ${shown}`)]
            : [first, wrong, m(`${round} + ${b + k} = ${shown}`)],
        flawed: at,
        correct: {
          code: "correct",
          label: `${p.Pro} added ${k} to both numbers. ${p.Pro} should take ${k} from ${b}.`,
        },
        distractors: [
          {
            code: "both-defend",
            label: `Adding ${k} to both is fine, so ${shown} is right.`,
          },
          {
            code: "arith",
            label: `${m(`${round} + ${b + k}`)} is not ${shown}.`,
          },
          {
            code: "refuse",
            label: `${p.Pro} must not change ${a} or ${b} at all.`,
          },
        ],
        explanation: [
          `Line ${at} is wrong: ${wrong}. ${p.name} gave ${k} to ${a} and also added ${k} to ${b}.`,
          `That adds ${2 * k} in all, so ${shown} is ${2 * k} too many. To keep the same total, the ${k} given to ${a} must come from ${b}.`,
          `The fixed line is ${m(`${b} - ${k} = ${b - k}`)}. Then ${m(`${round} + ${b - k} = ${s}`)}, so ${m(`${a} + ${b} = ${s}`)}.`,
          `Check by taking away: ${m(`${s} - ${b} = ${a}`)}.`,
        ],
        hint: `Check each line against ${m(`${a} + ${b}`)}. One line gives ${k} to ${a}. Where should that ${k} come from?`,
      };
    }
    case "f3-shift-one-number": {
      const b = withOnes(r, 17, 86, [7, 8, 9]);
      const k = 10 - onesOf(b),
        round = b + k;
      const a = between(r, b + 13, 99);
      const d = a - b,
        shown = a - round;
      if (shown < 1) throw new Error("Need a positive difference");
      return {
        kind,
        problem: m(`${a} - ${b}`),
        lines: [
          m(`${b} + ${k} = ${round}`),
          m(`${a} - ${round} = ${shown}`),
          `So ${m(`${a} - ${b} = ${shown}`)}.`,
        ],
        flawed: 3,
        correct: {
          code: "correct",
          label: `${p.Pro} took away ${round}, ${k} more than ${b}. ${k} must be added back.`,
        },
        distractors: [
          {
            code: "direction",
            label: `${p.Pro} should take ${k} more away, not add any back.`,
          },
          { code: "arith", label: `${m(`${a} - ${round}`)} is not ${shown}.` },
          {
            code: "refuse",
            label: `${p.Pro} must not change ${b} into ${round}.`,
          },
        ],
        explanation: [
          `Line 3 is wrong. Lines 1 and 2 are true, but ${p.name} took away ${round} instead of ${b}.`,
          `${round} is ${k} more than ${b}, so line 2 took away ${k} too many. Those ${k} must be added back.`,
          `The fixed line 3 is ${m(`${shown} + ${k} = ${d}`)}. So ${m(`${a} - ${b} = ${d}`)}, not ${shown}.`,
          `Check by adding: ${m(`${b} + ${d} = ${a}`)}.`,
        ],
        hint: `Check each line against ${m(`${a} - ${b}`)}. Line 2 takes away ${round}, not ${b}: too much or too little?`,
      };
    }
    case "f4-subtract-round-wrong-way": {
      const b = withOnes(r, 17, 86, [7, 8, 9]);
      const k = 10 - onesOf(b),
        round = b + k;
      const a = between(r, b + 13, 99);
      const d = a - b,
        mid = a - round,
        shown = mid - k;
      if (shown < 1) throw new Error("Need a positive difference");
      return {
        kind,
        problem: m(`${a} - ${b}`),
        lines: [
          m(`${b} + ${k} = ${round}`),
          m(`${a} - ${round} = ${mid}`),
          m(`${mid} - ${k} = ${shown}`),
        ],
        flawed: 3,
        correct: {
          code: "correct",
          label: `${round} is ${k} more than ${b}. ${p.Pro} took ${k} too many, so add ${k} back.`,
        },
        distractors: [
          {
            code: "direction-defend",
            label: `${b} is smaller, so take ${k} more away. ${shown} is right.`,
          },
          { code: "arith", label: `${m(`${a} - ${round}`)} is not ${mid}.` },
          { code: "rule", label: "Line 3 should come first, before line 2." },
        ],
        explanation: [
          `Line 3 is wrong. Lines 1 and 2 are true: ${p.name} took away ${round} instead of ${b}.`,
          `${round} is ${k} more than ${b}, so ${mid} is ${k} too little. Taking ${k} more away makes it worse.`,
          `The fixed line 3 is ${m(`${mid} + ${k} = ${d}`)}. So ${m(`${a} - ${b} = ${d}`)}, not ${shown}.`,
          `Check by adding: ${m(`${b} + ${d} = ${a}`)}.`,
        ],
        hint: `Check each line against ${m(`${a} - ${b}`)}. Line 2 took away ${round}: did that take away too much or too little?`,
      };
    }
    case "f5-lose-the-ten": {
      let a = 0,
        b = 0;
      for (let tries = 0; tries < 200; tries++) {
        a = between(r, 21, 78);
        b = between(r, 21, 78);
        if (a % 10 && b % 10 && a + b <= 99 && onesOf(a) + onesOf(b) >= 10)
          break;
      }
      if (!(a % 10 && b % 10 && a + b <= 99 && onesOf(a) + onesOf(b) >= 10))
        throw new Error("Need ones that make a ten");
      const ta = a - onesOf(a),
        tb = b - onesOf(b),
        oa = onesOf(a),
        ob = onesOf(b),
        os = oa + ob;
      const shown = ta + tb + os - 10;
      return {
        kind,
        problem: m(`${a} + ${b}`),
        lines: [
          m(`${ta} + ${tb} = ${ta + tb}`),
          m(`${oa} + ${ob} = ${os}`),
          m(`${ta + tb} + ${os} = ${shown}`),
        ],
        flawed: 3,
        correct: {
          code: "correct",
          label: `${os} is 1 ten and ${count(os - 10, "one")}. The ten must join the tens.`,
        },
        distractors: [
          {
            code: "arith",
            label: `${m(`${oa} + ${ob}`)} is ${os - 1}, not ${os}.`,
          },
          {
            code: "refuse",
            label: `${p.Pro} must not split ${a} and ${b} into tens and ones.`,
          },
          {
            code: "digit",
            label: `${p.Pro} should write the 1 and the ${os - 10} both down: ${(ta + tb) / 10}${os}.`,
          },
        ],
        explanation: [
          `Line 3 is wrong: ${m(`${ta + tb} + ${os}`)} is not ${shown}. Lines 1 and 2 are true.`,
          `${os} is 1 ten and ${count(os - 10, "one")}. ${p.name} kept the ${count(os - 10, "one")} but lost the ten.`,
          `The fixed line 3 is ${m(`${ta + tb} + ${os} = ${a + b}`)}. So ${m(`${a} + ${b} = ${a + b}`)}.`,
          `Check by taking away: ${m(`${a + b} - ${b} = ${a}`)}.`,
        ],
        hint: `Check each line against ${m(`${a} + ${b}`)}. Line 2 makes ${os} ones: how many tens is that, and did every ten get added?`,
      };
    }
    case "f6-drop-a-hop": {
      let a: number, b: number;
      if (r(0, 1) === 0) {
        a = 10 * between(r, 5, 9);
        b = between(r, a - 45, a - 11);
      } else {
        a = between(r, 31, 99);
        if (a % 10 === 0) throw new Error("Need a not a tens number");
        b = a - between(r, 11, 15);
      }
      if (b % 10 === 0 || b < 11) throw new Error("Need ones in b");
      const round = b + (10 - onesOf(b)),
        h1 = round - b,
        h2 = a - round,
        d = a - b;
      if (h2 < 1 || h1 === h2) throw new Error("Need two different hops");
      return {
        kind,
        problem: m(`${a} - ${b}`),
        lines: [
          m(`${b} + ${h1} = ${round}`),
          m(`${round} + ${h2} = ${a}`),
          `So ${m(`${a} - ${b} = ${h2}`)}.`,
        ],
        flawed: 3,
        correct: {
          code: "correct",
          label: `The hops are ${h1} and ${h2}. Both are part of the gap.`,
        },
        distractors: [
          {
            code: "commute",
            label: `${m(`${a} - ${b}`)} is the same as ${m(`${b} - ${a}`)}, so ${h2} is right.`,
          },
          { code: "arith", label: `${m(`${b} + ${h1}`)} is not ${round}.` },
          {
            code: "landing",
            label: `The answer is ${round}, where ${p.pro} landed.`,
          },
        ],
        explanation: [
          `Line 3 is wrong. Lines 1 and 2 are true: ${p.name} hopped ${h1} from ${b} to ${round}, then ${h2} to ${a}.`,
          `${m(`${a} - ${b}`)} is the whole gap from ${b} to ${a}. Both hops are part of it, but line 3 kept only ${h2}.`,
          `The fixed line 3 is ${m(`${h1} + ${h2} = ${d}`)}, so ${m(`${a} - ${b} = ${d}`)}.`,
          `Check by adding: ${m(`${b} + ${d} = ${a}`)}.`,
        ],
        hint: `Check each line against ${m(`${a} - ${b}`)}. How far is it from ${b} to ${a} in all: did every hop get counted?`,
      };
    }
    case "f7-smaller-from-larger": {
      const a = between(r, 31, 98),
        b = between(r, 12, 89);
      const [ta, oa, tb, ob] = [tensOf(a), onesOf(a), tensOf(b), onesOf(b)];
      if (!(oa < ob && ta > tb && tb >= 1)) throw new Error("Need a borrow");
      const tensLine = m(`${10 * ta} - ${10 * tb} = ${10 * (ta - tb)}`),
        onesLine = m(`${ob} - ${oa} = ${ob - oa}`);
      const shown = 10 * (ta - tb) + (ob - oa),
        d = a - b;
      return {
        kind,
        problem: m(`${a} - ${b}`),
        lines:
          at === 1
            ? [
                onesLine,
                tensLine,
                m(`${10 * (ta - tb)} + ${ob - oa} = ${shown}`),
              ]
            : [
                tensLine,
                onesLine,
                m(`${10 * (ta - tb)} + ${ob - oa} = ${shown}`),
              ],
        flawed: at,
        correct: {
          code: "correct",
          label: `The ${oa} is on top. It is ${m(`${oa} - ${ob}`)}, so open a ten first.`,
        },
        distractors: [
          {
            code: "defend",
            label: `${m(`${ob} - ${oa} = ${ob - oa}`)} is right, so ${shown} is correct.`,
          },
          {
            code: "arith",
            label: `${m(`${10 * ta} - ${10 * tb}`)} is ${10 * (ta - tb) + 10}, not ${10 * (ta - tb)}.`,
          },
          {
            code: "rule",
            label: `${p.Pro} should always subtract the ones first.`,
          },
        ],
        explanation: [
          `Line ${at} is wrong: ${onesLine}. The ones of ${a} are ${oa} and the ones of ${b} are ${ob}, so the ones part is ${m(`${oa} - ${ob}`)}.`,
          `${oa} is less than ${ob}, so open 1 ten of ${a}: ${a} is ${10 * (ta - 1)} and ${oa + 10}. Taking the bottom from the top keeps the amount right.`,
          `Fixed: ${m(`${10 * (ta - 1)} - ${10 * tb} = ${10 * (ta - 1 - tb)}`)} and ${m(`${oa + 10} - ${ob} = ${oa + 10 - ob}`)}, so ${m(`${a} - ${b} = ${d}`)}.`,
          `Check by adding: ${m(`${b} + ${d} = ${a}`)}. ${shown} does not check: ${m(`${b} + ${shown} = ${b + shown}`)}.`,
        ],
        hint: `Check each line against ${m(`${a} - ${b}`)}. The ones of ${a} are ${oa}: which number is taken from which in the ones?`,
      };
    }
    case "f8-hundred-in-wrong-place": {
      const n = between(r, 100, 899);
      const [h, t, o] = [hundredsOf(n), tensOf(n), onesOf(n)];
      if (t === 9 || h === 8 || t === h) throw new Error("Need clear digits");
      const shown = n + 10,
        right = n + 100;
      const lines: [string, string, string] =
        at === 1
          ? [
              "To add 100, add 1 to the tens digit.",
              `The tens digit ${t} becomes ${t + 1}.`,
              `So ${m(`${n} + 100 = ${shown}`)}.`,
            ]
          : [
              `The hundreds digit of ${n} is ${h}.`,
              `To add 100, add 1 to the tens digit: ${t} becomes ${t + 1}.`,
              `So ${m(`${n} + 100 = ${shown}`)}.`,
            ];
      return {
        kind,
        problem: m(`${n} + 100`),
        lines,
        flawed: at,
        correct: {
          code: "correct",
          label: "100 is 1 hundred, not 1 ten. The hundreds digit changes.",
        },
        distractors: [
          { code: "size", label: "100 is too big to add in your head." },
          {
            code: "fact",
            label: `${m(`${h} + 1`)} is ${h + 1}, so the sum is ${n + 110}.`,
          },
          {
            code: "rule",
            label: "You always change the last digit when you add.",
          },
        ],
        explanation: [
          `Line ${at} is wrong: adding 1 to the tens digit adds 1 ten, which is 10, not 100.`,
          `100 is 1 hundred, 0 tens and 0 ones. So only the hundreds digit goes up: ${h} becomes ${h + 1}.`,
          `Fixed: ${m(`${n} + 100 = ${right}`)}, not ${shown}. The tens digit stays ${t} and the ones digit stays ${o}.`,
          `Check by taking away: ${m(`${right} - 100 = ${n}`)}.`,
        ],
        hint: `Check each line against ${m(`${n} + 100`)}. Write 100 as hundreds, tens and ones: which digit of ${n} should change?`,
      };
    }
    case "f9-carry-one-not-two": {
      const { numbers, ones, tens, tensSum } = pairedFour(r, 7);
      if (tensSum < 4) throw new Error("Need a bigger total");
      const shownTens = tensSum + 1,
        S = numbers.reduce((x, y) => x + y, 0);
      return {
        kind,
        problem: m(numbers.join(" + ")),
        lines: [
          `Ones: ${m(`${ones.join(" + ")} = 20`)}`,
          "Write 0 in the ones and carry 1 ten.",
          `Tens: ${m(`${[...tens, 1].join(" + ")} = ${shownTens}`)}, so the sum is ${10 * shownTens}.`,
        ],
        flawed: 2,
        correct: {
          code: "correct",
          label: `20 ones are 2 tens. ${p.Pro} should carry 2, not 1.`,
        },
        distractors: [
          { code: "arith", label: `${m(ones.join(" + "))} is 21, not 20.` },
          { code: "rule", label: "You always carry 1, so line 2 is right." },
          {
            code: "refuse",
            label: `${p.Pro} should add the numbers two at a time instead.`,
          },
        ],
        explanation: [
          `Line 2 is wrong. Line 1 is true: the ones add to 20.`,
          `20 ones are 2 tens and 0 ones. Carrying 1 ten loses the other ten.`,
          `Fixed: carry 2 tens. Tens: ${m(`${[...tens, 2].join(" + ")} = ${tensSum + 2}`)}, so the sum is ${S}, not ${10 * shownTens}.`,
          `Check: ${m(`${numbers.join(" + ")} = ${S}`)} when you add them one at a time too.`,
        ],
        hint: `Check each line against the ones: ${m(`${ones.join(" + ")} = 20`)}. How many tens are 20 ones?`,
      };
    }
  }
}

function flawProblem(seed: string, salt: string): GeneratedProblem {
  const id = "strategy-flaw";
  const pickR = random(`${id}:position`, seed);
  const at = pickR(1, 3) as 1 | 2 | 3;
  const kinds = FLAW_POSITIONS[at];
  const kind = kinds[pickR(0, kinds.length - 1)]!;
  const r = random(id, salt);
  const p = person(r);
  const model = flawModel(kind, at, r, p);
  if (model.flawed !== at) throw new Error(`${kind} cannot sit on line ${at}`);
  const reasons = [model.correct, ...model.distractors];
  checkOptions(reasons, null);
  if (reasons.some((o) => o.label.length > 80))
    throw new Error(
      `A reason is over 80 characters: ${reasons.map((o) => o.label).join(" | ")}`,
    );
  const order = shuffle(r, [...reasons]);
  const letters = ["a", "b", "c", "d"] as const;
  const response: MultiPartChoiceResponse = {
    kind: "multi-part-choice",
    label: "Choose the line and the reason",
    layout: "slots",
    blanks: [
      {
        id: "line",
        label: "Which line has the mistake?",
        options: [1, 2, 3].map((n, i) => ({
          id: letters[i]!,
          label: `Line ${n}`,
        })),
      },
      {
        id: "why",
        label: "What went wrong?",
        options: order.map((o, i) => ({ id: letters[i]!, label: o.label })),
      },
    ],
  };
  const key = {
    line: letters[model.flawed - 1]!,
    why: letters[order.indexOf(model.correct)]!,
  };
  return {
    public: {
      id: publicId(id, seed),
      templateId: id,
      templateVersion: 1,
      seed,
      prompt: `One line of ${p.name}'s work for ${model.problem} is wrong.\n${notebook(model.lines)}\nFind the wrong line and say what went wrong.`,
      skillId,
      response,
    },
    answer: serializeMultiPart(response, key),
    explanation: model.explanation,
    hint: model.hint,
    variant: {
      id: `${kind}-line-${at}`,
      axes: { flaw: kind, line: `line-${at}` },
    },
  };
}

/* --------------------------------- written-method-meaning W1–W4, reason W5 */

export const WRITTEN_VARIANTS = [
  "w1-carry-to-tens",
  "w2-carry-to-hundreds",
  "w3-borrow-a-ten",
  "w4-borrow-across-zero",
] as const;
export type WrittenVariant = (typeof WRITTEN_VARIANTS)[number];
const small = (text: string) => `{\\scriptstyle ${text}}`;
/** A column stack as TeX: one column per place, the sign in front. */
function stack(
  rows: { sign?: string; cells: string[] }[],
  resultRow: string[],
) {
  const width = Math.max(
    ...rows.map((row) => row.cells.length),
    resultRow.length,
  );
  const pad = (cells: string[]) => [
    ...Array(width - cells.length).fill(""),
    ...cells,
  ];
  const body = rows
    .map((row) => [row.sign ?? "", ...pad(row.cells)].join(" & "))
    .join(" \\\\ ");
  return `$\\begin{array}{r${"c".repeat(width)}} ${body} \\\\ \\hline ${["", ...pad(resultRow)].join(" & ")} \\end{array}$`;
}
const digits = (n: number) => String(n).split("");

type Blocks = { hundreds: number; tens: number; ones: number };
const blockValue = (b: Blocks) => 100 * b.hundreds + 10 * b.tens + b.ones;
function describeBlocks(b: Blocks): string {
  const parts = [
    b.hundreds ? count(b.hundreds, "hundred flat") : "",
    b.tens ? count(b.tens, "ten rod") : "",
    b.ones ? count(b.ones, "unit cube") : "",
  ].filter(Boolean);
  const list =
    parts.length === 1
      ? parts[0]!
      : `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)!}`;
  return `Base-ten blocks: ${list}.`;
}
export function blocksScene(b: Blocks): Scene {
  return scene({
    type: "baseTen",
    id: "blocks",
    hundreds: b.hundreds,
    tens: b.tens,
    ones: b.ones,
  }).build({ width: 264, maxHeight: 280 });
}
type BlockOption = Blocks & {
  code: string;
  feedback?: (name: string) => string;
};
type WrittenModel = {
  variant: WrittenVariant;
  prompt: string;
  correct: BlockOption;
  distractors: BlockOption[];
  explanation: (name: (o: BlockOption) => string) => string[];
  hint: string;
};

function writtenModel(
  variant: WrittenVariant,
  r: Random,
  p: Person,
): WrittenModel {
  switch (variant) {
    case "w1-carry-to-tens": {
      const a = between(r, 25, 78),
        b = between(r, 25, 78);
      const [oa, ob] = [onesOf(a), onesOf(b)];
      const os = oa + ob;
      if (os < 10 || a + b > 99) throw new Error("Need a carry within 100");
      const s = a + b;
      const correct: BlockOption = {
        hundreds: 0,
        tens: 1,
        ones: 0,
        code: "correct",
      };
      const distractors: BlockOption[] = [
        {
          hundreds: 0,
          tens: 0,
          ones: 1,
          code: "digit",
          feedback: (n) =>
            `${n} shows 1 one. The small 1 sits in the tens column, so it is 1 ten.`,
        },
        {
          hundreds: 1,
          tens: 0,
          ones: 0,
          code: "wrong-place",
          feedback: (n) =>
            `${n} shows 1 hundred. The small 1 sits above the tens, not the hundreds.`,
        },
        {
          hundreds: 0,
          tens: 0,
          ones: os,
          code: "not-traded",
          feedback: (n) =>
            `${n} shows ${os} loose ones. The small 1 is the ten made from 10 of those ones, traded for 1 rod.`,
        },
      ];
      return {
        variant,
        prompt: `${p.name} added ${m(`${a} + ${b}`)} and wrote a small 1 above the tens.\n${stack(
          [
            { cells: [small("1"), ""] },
            { cells: digits(a) },
            { sign: "+", cells: digits(b) },
          ],
          digits(s),
        )}\nWhich blocks show what the small 1 is?`,
        correct,
        distractors,
        explanation: (name) => [
          `Read the ones column: ${m(`${oa} + ${ob} = ${os}`)}. That is ${os} ones.`,
          `Ten ones make 1 ten. So ${os} ones are 1 ten and ${count(os - 10, "one")}. ${p.name} wrote the ${os - 10} under the ones and the ten above the tens column as a small 1.`,
          `The amount does not change: ${os} ones became 1 ten and ${count(os - 10, "one")}, and ${m(`${a} + ${b} = ${s}`)}.`,
          `${name(correct)} shows 1 ten rod: the small 1 is 1 ten.`,
          ...distractors.map((d) => d.feedback!(name(d))),
        ],
        hint: `Add the ones: ${m(`${oa} + ${ob}`)}. Ten ones make one bigger block. Which column is the small 1 written above?`,
      };
    }
    case "w2-carry-to-hundreds": {
      const a = between(r, 123, 489),
        b = between(r, 123, 489);
      const ts = tensOf(a) + tensOf(b),
        os = onesOf(a) + onesOf(b);
      if (ts < 10 || os >= 10 || a + b > 999)
        throw new Error("Need a tens carry");
      const s = a + b;
      const correct: BlockOption = {
        hundreds: 1,
        tens: 0,
        ones: 0,
        code: "correct",
      };
      const distractors: BlockOption[] = [
        {
          hundreds: 0,
          tens: 1,
          ones: 0,
          code: "digit",
          feedback: (n) =>
            `${n} shows 1 ten. A small 1 is not always a ten: this one sits above the hundreds, so it is 1 hundred.`,
        },
        {
          hundreds: 0,
          tens: 0,
          ones: 1,
          code: "face-value",
          feedback: (n) =>
            `${n} shows 1 one. The small 1 sits in the hundreds column, so it is 1 hundred.`,
        },
        {
          hundreds: 0,
          tens: ts,
          ones: 0,
          code: "not-traded",
          feedback: (n) =>
            `${n} shows ${ts} loose tens. The small 1 is the hundred made from 10 of those tens, traded for 1 flat.`,
        },
      ];
      return {
        variant,
        prompt: `${p.name} added ${m(`${a} + ${b}`)} and wrote a small 1 above the hundreds.\n${stack(
          [
            { cells: [small("1"), "", ""] },
            { cells: digits(a) },
            { sign: "+", cells: digits(b) },
          ],
          digits(s),
        )}\nWhich blocks show what the small 1 is?`,
        correct,
        distractors,
        explanation: (name) => [
          `Read the tens column: ${m(`${tensOf(a)} + ${tensOf(b)} = ${ts}`)}. That is ${ts} tens.`,
          `Ten tens make 1 hundred. So ${ts} tens are 1 hundred and ${count(ts - 10, "ten")}. The hundred is the small 1 above the hundreds column.`,
          `The amount does not change: ${ts} tens became 1 hundred and ${count(ts - 10, "ten")}, and ${m(`${a} + ${b} = ${s}`)}.`,
          `${name(correct)} shows 1 hundred flat: the small 1 is 1 hundred.`,
          ...distractors.map((d) => d.feedback!(name(d))),
        ],
        hint: `Add the tens: ${m(`${tensOf(a)} + ${tensOf(b)}`)}. Ten tens make one bigger block. Which column is the small 1 written above?`,
      };
    }
    case "w3-borrow-a-ten": {
      const a = between(r, 21, 98),
        b = between(r, 12, 89);
      const [ta, oa, tb, ob] = [tensOf(a), onesOf(a), tensOf(b), onesOf(b)];
      if (!(oa < ob && ta > tb && tb >= 1)) throw new Error("Need a borrow");
      const correct: BlockOption = {
        hundreds: 0,
        tens: ta - 1,
        ones: oa + 10,
        code: "correct",
      };
      const distractors: BlockOption[] = [
        {
          hundreds: 0,
          tens: ta - 1,
          ones: oa,
          code: "lost-ten",
          feedback: (n) =>
            `${n} took a ten away but gave the ones nothing. It shows ${blockValue({ hundreds: 0, tens: ta - 1, ones: oa })}, not ${a}.`,
        },
        {
          hundreds: 0,
          tens: ta - 1,
          ones: oa + 1,
          code: "ten-as-one",
          feedback: (n) =>
            `${n} turned the ten into just 1 one. A ten is 10 ones, so the ones become ${oa + 10}.`,
        },
        {
          hundreds: 0,
          tens: ta,
          ones: oa + 10,
          code: "made-ones",
          feedback: (n) =>
            `${n} made 10 new ones without taking a ten. It shows ${blockValue({ hundreds: 0, tens: ta, ones: oa + 10 })}, not ${a}.`,
        },
      ];
      return {
        variant,
        prompt: `${p.name} subtracted ${m(`${a} - ${b}`)}, crossed out ${ta} and ${oa}, and wrote ${ta - 1} and ${oa + 10}.\n${stack(
          [
            { cells: [small(`${ta - 1}`), small(`${oa + 10}`)] },
            { cells: [`\\cancel{${ta}}`, `\\cancel{${oa}}`] },
            { sign: "-", cells: digits(b) },
          ],
          digits(a - b),
        )}\nWhich blocks show ${a} now?`,
        correct,
        distractors,
        explanation: (name) => [
          `The ones column needs ${m(`${oa} - ${ob}`)}, but ${oa} is less than ${ob}.`,
          `${p.name} opened 1 of the ${ta} tens: ${ta} became ${ta - 1}, and the ten became 10 more ones, so ${oa} became ${oa + 10}.`,
          `${count(ta - 1, "ten")} and ${oa + 10} ones are still ${a}: ${m(`${10 * (ta - 1)} + ${oa + 10} = ${a}`)}.`,
          `${name(correct)} shows ${count(ta - 1, "ten rod")} and ${oa + 10} unit cubes.`,
          ...distractors.map((d) => d.feedback!(name(d))),
        ],
        hint: `${p.name} took 1 ten from the ${ta} tens of ${a}. How many ones is that ten, and where did they go?`,
      };
    }
    case "w4-borrow-across-zero": {
      const ha = between(r, 2, 9),
        oa = between(r, 0, 8);
      const a = 100 * ha + oa;
      const b = between(r, Math.max(12, a - 299), a - 12);
      const [hb, ob] = [hundredsOf(b), onesOf(b)];
      if (!(ob > oa && hb < ha)) throw new Error("Need a borrow across zero");
      const correct: BlockOption = {
        hundreds: ha - 1,
        tens: 9,
        ones: oa + 10,
        code: "correct",
      };
      const distractors: BlockOption[] = [
        {
          hundreds: ha - 1,
          tens: 10,
          ones: oa + 10,
          code: "ten-not-moved",
          feedback: (n) =>
            `${n} keeps all 10 tens. One of them moved on to the ones, so 9 tens are left. It shows ${blockValue({ hundreds: ha - 1, tens: 10, ones: oa + 10 })}, not ${a}.`,
        },
        {
          hundreds: ha,
          tens: 9,
          ones: oa + 10,
          code: "hundreds-untouched",
          feedback: (n) =>
            `${n} made tens without opening a hundred. It shows ${blockValue({ hundreds: ha, tens: 9, ones: oa + 10 })}, not ${a}.`,
        },
        {
          hundreds: ha - 1,
          tens: 10,
          ones: oa,
          code: "stopped-early",
          feedback: (n) =>
            `${n} is still ${a}, but it stops after the first trade. The marks say ${oa + 10} ones, so one more ten was opened into ones.`,
        },
      ];
      return {
        variant,
        prompt: `${p.name} subtracted ${m(`${a} - ${b}`)}, and the 0 became 10 and then 9.\n${stack(
          [
            {
              cells: [
                small(`${ha - 1}`),
                small(`\\cancel{10}\\,9`),
                small(`${oa + 10}`),
              ],
            },
            { cells: [`\\cancel{${ha}}`, "\\cancel{0}", `\\cancel{${oa}}`] },
            { sign: "-", cells: digits(b) },
          ],
          digits(a - b),
        )}\nWhich blocks show ${a} the way the marks do?`,
        correct,
        distractors,
        explanation: (name) => [
          `The ones column needs ${m(`${oa} - ${ob}`)}, but ${oa} is less than ${ob}, and there are 0 tens to open.`,
          `So 1 hundred is opened first: the hundreds go from ${ha} to ${ha - 1}, and the 0 tens become 10 tens. Then 1 of those tens is opened: the tens go from 10 to 9, and the ones go from ${oa} to ${oa + 10}.`,
          `${places(ha - 1, 9, oa + 10)} are still ${a}: ${m(`${100 * (ha - 1)} + 90 + ${oa + 10} = ${a}`)}.`,
          `${name(correct)} shows ${count(ha - 1, "hundred flat")}, 9 ten rods and ${oa + 10} unit cubes.`,
          ...distractors.map((d) => d.feedback!(name(d))),
        ],
        hint: `${a} has 0 tens, so start at the hundreds of ${a}: one hundred is 10 tens. Then one ten is 10 ones.`,
      };
    }
  }
}

function writtenMeaningProblem(seed: string, salt: string): GeneratedProblem {
  const id = "written-method-meaning";
  const variant =
    WRITTEN_VARIANTS[
      random(`${id}:variant`, seed)(0, WRITTEN_VARIANTS.length - 1)
    ]!;
  const r = random(id, salt);
  const p = person(r);
  const model = writtenModel(variant, r, p);
  const all = [model.correct, ...model.distractors];
  const keyOf = (o: Blocks) => `${o.hundreds}-${o.tens}-${o.ones}`;
  if (new Set(all.map(keyOf)).size !== all.length)
    throw new Error("Need different pictures");
  const order = shuffle(r, [...all]);
  const name = (o: BlockOption) =>
    `Picture ${figureOptionLetters[order.indexOf(o)]!}`;
  const optionId = (o: BlockOption) => figureOptionIds[order.indexOf(o)]!;
  const response: FigureChoiceResponse = {
    kind: "figure-choice",
    label: "Choose the blocks",
    noun: "Picture",
    options: order.map((o) => ({
      id: optionId(o),
      label: describeBlocks(o),
      scene: blocksScene(o),
    })),
  };
  const explanation = model.explanation(name);
  // The lesson keeps the lines that do not single out one card.
  return {
    public: {
      id: publicId(id, seed),
      templateId: id,
      templateVersion: 1,
      seed,
      prompt: model.prompt,
      skillId,
      response,
    },
    answer: optionId(model.correct),
    explanation,
    hint: model.hint,
    choiceFeedback: Object.fromEntries(
      model.distractors.map((d) => [optionId(d), d.feedback!(name(d))]),
    ),
    variant: { id: variant, axes: { mark: variant } },
  };
}

function lineUpReason(r: Random, p: Person): ChoiceModel {
  const a = between(r, 123, 987);
  const da = digits(a).map(Number);
  if (new Set(da).size !== 3 || da.includes(0))
    throw new Error("Need three different digits");
  const oneDigit = r(0, 1) === 0;
  const b = oneDigit ? between(r, 3, 9) : between(r, 11, 99);
  const db = digits(b).map(Number);
  if (
    db.some((d) => da.includes(d) || d === 0) ||
    new Set(db).size !== db.length
  )
    throw new Error("Need digits that are easy to tell apart");
  if (a + b > 999) throw new Error("Need a sum within 1000");
  const [ah, at, ao] = da as [number, number, number];
  // No column reaches ten, so the stack needs no carry mark.
  if (ao + db.at(-1)! >= 10 || (db.length === 2 && at + db[0]! >= 10))
    throw new Error("Need columns without a carry");
  const s = a + b;
  const prompt = `${p.name} adds ${m(`${a} + ${b}`)} in columns.\n${stack(
    [{ cells: digits(a) }, { sign: "+", cells: digits(b) }],
    digits(s),
  )}`;
  if (oneDigit)
    return {
      variant: "w5-line-up-on-the-right",
      prompt: `${prompt}\nWhy does ${p.name} write the ${b} under the ${ao}, not under the ${at}?`,
      correct: {
        code: "correct",
        label: `${b} is ${b} ones. Ones go with ones.`,
      },
      distractors: [
        {
          code: "rule",
          label: "The last number always goes on the right side.",
          feedback: `That is a habit, not a reason. ${b} is ${b} ones, so it must be added to the ${count(ao, "one")} of ${a}.`,
        },
        {
          code: "fact",
          label: `Because ${m(`${ao} + ${b}`)} makes ${ao + b}, a number you know.`,
          feedback: `True, but it does not say why the ${b} belongs there. ${b} is ones, and ones are added to ones.`,
        },
        {
          code: "any-place",
          label: "It can go anywhere, because the sum is the same.",
          feedback: `Under the ${at} it would count as ${b} tens, ${b * 10}, and the sum would be wrong. Order of adding does not matter, but place does.`,
        },
      ],
      explanation: [
        `In ${a}, the ${ah} is ${count(ah, "hundred")}, the ${at} is ${count(at, "ten")} and the ${ao} is ${count(ao, "one")}.`,
        `${b} is ${count(b, "one")}. Ones are added to ones, so the ${b} goes under the ${ao}, in the ones column.`,
        `Then ${m(`${ao} + ${b} = ${ao + b}`)}, so the sum has ${count(ao + b, "one")}: ${s}. Written under the ${at}, the ${b} would count as ${b * 10}.`,
        `A habit about the right side is not a reason. Adding in any order is fine, but each digit must stay in its own place.`,
      ],
      hint: `What is the ${b} worth: ones, tens or hundreds? Which digit of ${a} is worth the same kind?`,
    };
  const [bt, bo] = db as [number, number];
  return {
    variant: "w5-line-up-on-the-right",
    prompt: `${prompt}\nWhy does ${p.name} write the ${bt} of ${b} under the ${at}, not under the ${ah}?`,
    correct: {
      code: "correct",
      label: `The ${bt} in ${b} is ${count(bt, "ten")}. Tens go with tens.`,
    },
    distractors: [
      {
        code: "rule",
        label: "The last number always goes on the right side.",
        feedback: `That is a habit, not a reason. The ${bt} in ${b} is ${count(bt, "ten")}, so it must be added to the ${count(at, "ten")} of ${a}.`,
      },
      {
        code: "fact",
        label: `Because ${m(`${at} + ${bt}`)} makes ${at + bt}, a number you know.`,
        feedback: `True, but it does not say why the ${bt} belongs there. It is tens, and tens are added to tens.`,
      },
      {
        code: "any-place",
        label: "It can go anywhere, because the sum is the same.",
        feedback: `Under the ${ah} the ${bt} would count as ${count(bt, "hundred")}, ${bt * 100}, and the sum would be wrong. Order of adding does not matter, but place does.`,
      },
    ],
    explanation: [
      `In ${a}, the ${ah} is ${count(ah, "hundred")}, the ${at} is ${count(at, "ten")} and the ${ao} is ${count(ao, "one")}.`,
      `In ${b}, the ${bt} is ${count(bt, "ten")} and the ${bo} is ${count(bo, "one")}. Tens are added to tens, so the ${bt} goes under the ${at}.`,
      `Then the columns add place by place, and the sum is ${s}. Written under the ${ah}, the ${bt} would count as ${bt * 100}.`,
      `A habit about the right side is not a reason. Adding in any order is fine, but each digit must stay in its own place.`,
    ],
    hint: `What is the ${bt} in ${b} worth: ones, tens or hundreds? Which digit of ${a} is worth the same kind?`,
  };
}

/* ------------------------------------------------------------ dispatch */

function stepProblem(seed: string, salt: string): GeneratedProblem {
  const id = "strategy-step-reason";
  const variant =
    STEP_VARIANTS[random(`${id}:variant`, seed)(0, STEP_VARIANTS.length - 1)]!;
  const r = random(id, salt);
  const p = person(r);
  return choiceProblem(id, seed, r, stepModel(variant, r, p));
}
function writtenReasonProblem(seed: string, salt: string): GeneratedProblem {
  const id = "written-method-reason";
  const r = random(id, salt);
  const p = person(r);
  return choiceProblem(id, seed, r, lineUpReason(r, p));
}

const generators: Record<
  string,
  (seed: string, salt: string) => GeneratedProblem
> = {
  "strategy-step-reason": stepProblem,
  "strategy-flaw": flawProblem,
  "written-method-meaning": writtenMeaningProblem,
  "written-method-reason": writtenReasonProblem,
};

export function generateStrategyReasons(
  templateId: string,
  seed: string,
): GeneratedProblem {
  const generate = generators[templateId];
  if (!generate)
    throw new Error(`Unknown strategy-reasons template ${templateId}`);
  if (typeof seed !== "string" || !seed.length || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  // A draw that breaks a range is redrawn from a salted stream; the variant
  // and the line position come from the seed alone, so they never change.
  for (let attempt = 0; attempt < 200; attempt++)
    try {
      return generate(seed, attempt ? `${seed}#${attempt}` : seed);
    } catch (error) {
      if (!(error instanceof Error) || !error.message.startsWith("Need"))
        throw error;
    }
  throw new Error(`${templateId}: no instance for ${seed}`);
}

/** The misconception code of each option, by option id (tests only). */
export function strategyOptionCodes(
  templateId: string,
  seed: string,
): Record<string, string> {
  const problem = generateStrategyReasons(templateId, seed);
  const salt = (() => {
    for (let attempt = 0; attempt < 200; attempt++) {
      const s = attempt ? `${seed}#${attempt}` : seed;
      try {
        if (
          JSON.stringify(generators[templateId]!(seed, s)) ===
          JSON.stringify(problem)
        )
          return s;
      } catch {
        /* a redrawn attempt */
      }
    }
    throw new Error("Salt not found");
  })();
  const r = random(templateId, salt);
  const p = person(r);
  if (
    templateId === "strategy-step-reason" ||
    templateId === "written-method-reason"
  ) {
    const variant =
      STEP_VARIANTS[
        random(`${templateId}:variant`, seed)(0, STEP_VARIANTS.length - 1)
      ]!;
    const model =
      templateId === "strategy-step-reason"
        ? stepModel(variant, r, p)
        : lineUpReason(r, p);
    const all = [model.correct, ...model.distractors];
    const order = shuffle(r, [...all]);
    return Object.fromEntries(
      order.map((o, i) => [`option-${"abcd"[i]}`, o.code]),
    );
  }
  if (templateId === "written-method-meaning") {
    const variant =
      WRITTEN_VARIANTS[
        random(`${templateId}:variant`, seed)(0, WRITTEN_VARIANTS.length - 1)
      ]!;
    const model = writtenModel(variant, r, p);
    const order = shuffle(r, [model.correct, ...model.distractors]);
    return Object.fromEntries(
      order.map((o, i) => [figureOptionIds[i]!, o.code]),
    );
  }
  const pickR = random(`${templateId}:position`, seed);
  const at = pickR(1, 3) as 1 | 2 | 3;
  const kinds = FLAW_POSITIONS[at];
  const kind = kinds[pickR(0, kinds.length - 1)]!;
  const model = flawModel(kind, at, r, p);
  const order = shuffle(r, [model.correct, ...model.distractors]);
  return Object.fromEntries(
    order.map((o, i) => [["a", "b", "c", "d"][i]!, o.code]),
  );
}
