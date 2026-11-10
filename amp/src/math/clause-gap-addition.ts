import { count } from "./agreement.js";
import type { ClauseCtx } from "./clause-gap-kit.js";
import {
  bondPairs,
  numberStack,
  pick,
  problem,
  shuffle,
  singleChoice,
  slots,
} from "./clause-gap-kit.js";
import { makeTenHops } from "./scene/explanations.js";
import type { PointPlotResponse } from "./point-plot.js";
import type { SemanticFigure } from "./contracts.js";
import {
  gradeStructuredWork,
  gradingFits,
  type StructuredWorkResponse,
  type WorkBank,
  type WorkGrading,
} from "./structured-work.js";

const skills: Record<string, string> = {
  "add-ones-regroup": "add-two-digit",
  "three-addend-story": "three-addends",
  "add-within-20": "addition-within-20",
  "subtract-within-20": "subtraction-within-20",
  "number-line-hops": "number-line-arithmetic",
  "add-several-two-digit": "multiple-addends",
  "add-with-regrouping": "regroup-hundreds",
  "subtract-with-regrouping": "regroup-hundreds",
  "make-ten-fact": "addition-facts",
  "related-subtraction": "addition-facts",
  "add-three-digit": "add-subtract-thousands",
  "subtract-three-digit": "add-subtract-thousands",
  "add-multidigit": "whole-add-subtract",
  "subtract-multidigit": "whole-add-subtract",
  "number-bond-missing": "number-bonds",
  "ten-frame-complement": "make-ten",
};

const blocks = (n: number): SemanticFigure => ({
  kind: "base-ten",
  hundreds: Math.floor(n / 100),
  tens: Math.floor(n / 10) % 10,
  ones: n % 10,
});

function addTens(ctx: ClauseCtx) {
  const { r } = ctx;
  let start = 20;
  let added = 20;
  for (let i = 0; i < 30; i++) {
    const zero = r(0, 4) === 0;
    const tens = zero ? r(2, 6) : r(1, 6);
    const ones = zero ? 0 : r(1, 9);
    const candidate = 10 * tens + ones;
    const maxTens = Math.min(8, Math.floor((99 - candidate) / 10));
    if (candidate < 11 || candidate > 69 || maxTens < 2) continue;
    start = candidate;
    added = 10 * r(2, maxTens);
    break;
  }
  const asNumber = r(0, 3) === 0;
  const tensCount = added / 10;
  const total = start + added;
  const prompt = asNumber
    ? `The blocks show ${start}. Add ${added}. What is the new total?`
    : `The blocks show ${start}. Add ${count(tensCount, "ten")}. What is the new total?`;
  return problem({
    id: ctx.id,
    seed: ctx.seed,
    task: ctx.task,
    skillId: skills[ctx.id]!,
    prompt,
    figure: blocks(start),
    response: { kind: "number", label: "Total" },
    answer: String(total),
    hint: `${start} already has ${count(Math.floor(start / 10), "ten")}. The new rods are ${count(tensCount, "ten")}, not ${count(tensCount, "one")}.`,
    explanation: [
      `${count(tensCount, "ten")} join the ${count(Math.floor(start / 10), "ten")}: ${count(Math.floor(total / 10), "ten")}.`,
      `The ${count(start % 10, "one")} ${start % 10 === 1 ? "does" : "do"} not change.`,
      `${count(Math.floor(total / 10), "ten")} and ${count(total % 10, "one")} is ${total}. Tens with tens, ones with ones.`,
      `${start} + ${added} lands ${count(tensCount, "decade")} up: the total is ${total}.`,
    ],
  });
}

function onesStack(start: number, add: number, why: boolean, r: ClauseCtx["r"]) {
  const ones = (start % 10) + add;
  const carry = ones >= 10 ? 1 : 0;
  const onesDigit = ones % 10;
  const tensDigit = Math.floor(start / 10) + carry;
  const rows = [
    { label: "Ones digit", values: [String(onesDigit)], fieldLabels: ["Ones"] },
    { label: "Carry to the tens", values: [String(carry)], fieldLabels: ["Carry"] },
    { label: "Tens digit", values: [String(tensDigit)], fieldLabels: ["Tens"] },
  ];
  if (!why) return numberStack(rows, "Fill the stack");
  const bank: WorkBank = {
    id: "why",
    label: "Reason",
    options: shuffle(r, [
      { id: "ten", label: "Ten of the ones made a new ten." },
      { id: "digit", label: "To remember a digit from the ones total." },
      { id: "less", label: "Because a digit is one less than 10." },
      { id: "label", label: `To show ${start} has ${Math.floor(start / 10)} tens and ${start % 10} ones.` },
    ]).map((option, i) => ({ ...option, id: "abcd"[i]! })),
  };
  // Re-find the correct option after the shuffle assigned fresh ids.
  const correct = bank.options.find((o) => o.label.startsWith("Ten of the ones"))!;
  const response: StructuredWorkResponse = {
    kind: "structured-work",
    label: "Fill the stack",
    layout: "steps",
    mode: "build",
    banks: [bank],
    rows: [
      ...rows.map((row, i) => ({
        id: `r${i + 1}`,
        label: row.label,
        fields: [{ kind: "number" as const, label: row.fieldLabels[0]! }],
      })),
      {
        id: "r4",
        label: "Why is a small 1 written above the tens?",
        fields: [{ kind: "choice", label: "Reason", bank: "why" }],
      },
    ],
  };
  const workGrading: WorkGrading = {
    mode: "fields",
    fields: [
      [{ kind: "number", value: String(onesDigit) }],
      [{ kind: "number", value: String(carry) }],
      [{ kind: "number", value: String(tensDigit) }],
      [{ kind: "choice", accept: [correct.id] }],
    ],
  };
  const answer = JSON.stringify([
    [String(onesDigit)],
    [String(carry)],
    [String(tensDigit)],
    [correct.id],
  ]);
  if (!gradingFits(response, workGrading) || !gradeStructuredWork(response, workGrading, answer))
    throw new Error("Why-stack key");
  return { response, workGrading, answer };
}

function blocksToStack(ctx: ClauseCtx) {
  const { r } = ctx;
  let start = 68;
  let add = 9;
  for (let i = 0; i < 40; i++) {
    const ones = r(2, 9);
    const tens = r(1, 8);
    const wantCarry = r(0, 3) !== 0;
    const room = 9 - ones;
    if (!wantCarry && room < 2) continue;
    const low = wantCarry ? Math.max(2, 10 - ones) : 2;
    const high = wantCarry ? 9 : room;
    if (high < low) continue;
    const extra = r(low, high);
    start = 10 * tens + ones;
    add = extra;
    if (start >= 15 && start <= 89) break;
  }
  const built = onesStack(start, add, (start % 10) + add >= 10 && r(0, 2) === 0, r);
  const total = start + add;
  return problem({
    id: ctx.id,
    seed: ctx.seed,
    task: ctx.task,
    skillId: skills[ctx.id]!,
    prompt: `The blocks show ${start}. Add ${add} ones. Add the ones first. Fill in the stack.`,
    figure: blocks(start),
    response: built.response,
    answer: built.answer,
    workGrading: built.workGrading,
    hint: `Start with the ones of ${start}, which are ${start % 10}, and the ${add} ones you are adding.`,
    explanation: [
      `${start % 10} ones and ${add} ones are ${(start % 10) + add} ones.`,
      (start % 10) + add >= 10
        ? `Ten of them make a new ten. Write ${(start % 10 + add) % 10} in the ones and a small 1 above the tens. That 1 means ten ones made a new ten.`
        : `That is less than 10, so the carry is 0 and the ones digit is ${(start % 10) + add}.`,
      `The tens digit becomes ${Math.floor(total / 10)}. The total is ${total}.`,
      `Check: ${total} − ${add} = ${start}.`,
    ],
  });
}

function whichEquation(ctx: ClauseCtx) {
  const { r } = ctx;
  let a = 2, b = 3, c = 4;
  for (let i = 0; i < 30; i++) {
    const xs = shuffle(r, [2, 3, 4, 5, 6, 7, 8, 9]).slice(0, 3) as [number, number, number];
    if (xs[0] + xs[1] + xs[2] <= 20 && new Set(xs).size === 3) {
      [a, b, c] = xs;
      break;
    }
  }
  const boxFirst = r(0, 3) === 0;
  const correct = boxFirst ? `□ = ${a} + ${b} + ${c}` : `${a} + ${b} + ${c} = □`;
  const choice = singleChoice(r, [
    { label: correct, correct: true },
    {
      label: `${a} + ${b} − ${c} = □`,
      feedback: `${c} is a third amount that joins the others. It is not taken away.`,
    },
    {
      label: `${a} + ${b} = □`,
      feedback: `The story has three amounts. ${c} is missing from this equation.`,
    },
    {
      label: `□ + ${b} + ${c} = ${a}`,
      feedback: `${a} is one of the amounts we know, not the unknown total. The box stands for the total.`,
    },
  ]);
  return problem({
    id: ctx.id,
    seed: ctx.seed,
    task: ctx.task,
    skillId: skills[ctx.id]!,
    prompt: `Sam read ${count(a, "page")} on Monday, ${count(b, "page")} on Tuesday and ${count(c, "page")} on Wednesday. Which equation shows this story? The box stands for the number we don't know.`,
    response: choice.response,
    answer: choice.answer,
    choiceFeedback: choice.choiceFeedback,
    hint: `Three amounts join: ${a}, ${b} and ${c}. The box is the total, the number the story does not give.`,
    explanation: [
      `Three groups join into one total. The story's order is ${a}, then ${b}, then ${c}.`,
      `We don't know the total, so the box goes where the total goes: ${correct}.`,
      `${a} + ${b} is ${a + b}, and ${c} more is ${a + b + c}.`,
    ],
  });
}

function nearDouble(ctx: ClauseCtx) {
  const { r } = ctx;
  const gap = r(0, 3) === 0 ? 2 : 1;
  const a = gap === 2 ? r(3, 8) : r(3, 9);
  const largerFirst = r(0, 2) === 0;
  const left = largerFirst ? a + gap : a;
  const right = largerFirst ? a : a + gap;
  const double = a + a;
  const sum = left + right;
  const word = gap === 1 ? "one more than a double" : "two more than a double";
  const built = slots(
    r,
    [
      {
        id: "dbl",
        label: `The double: ${a} + ${a}`,
        options: [String(double), String(sum), String(double + gap + 1), String(a)],
        correct: String(double),
      },
      {
        id: "sum",
        label: `${left} + ${right}`,
        options: [String(sum), String(double), String((a + gap) * 2), String(sum + 1)],
        correct: String(sum),
      },
    ],
    "Fill both boxes",
  );
  return problem({
    id: ctx.id,
    seed: ctx.seed,
    task: ctx.task,
    skillId: skills[ctx.id]!,
    prompt: `${left} + ${right} is ${word}. What is the double ${a} + ${a}, and what is ${left} + ${right}?`,
    response: built.response,
    answer: built.answer,
    hint: `You know ${a} + ${a}. ${left} and ${right} differ by ${gap}.`,
    explanation: [
      `${a} and ${a} make ${double}.`,
      gap === 1
        ? `${a + 1} is ${a} and one more, so ${left} + ${right} is ${double} and one more: ${sum}.`
        : `${a + 2} is ${a} and two more, so ${left} + ${right} is ${double} and two more: ${sum}.`,
      `The second box is wrong when it just repeats the double ${double}.`,
    ],
  });
}

function withinAdd(ctx: ClauseCtx) {
  const { r } = ctx;
  const allowZero = r(0, 9) === 0;
  let a = 1, b = 1;
  for (let i = 0; i < 20; i++) {
    a = allowZero ? r(0, 9) : r(1, 9);
    b = allowZero ? r(0, 10 - a) : r(1, 10 - a);
    if (a + b <= 10 && a + b >= 1) break;
  }
  const sum = a + b;
  return problem({
    id: ctx.id,
    seed: ctx.seed,
    task: ctx.task,
    skillId: skills[ctx.id]!,
    prompt: `What is ${a} + ${b}?`,
    figure: { kind: "scene", scene: makeTenHops(a, b) },
    response: { kind: "number", label: "Sum" },
    answer: String(sum),
    hint: a + b === 10 ? `${a} and ${b} partner to make ten.` : `Put ${a} and ${b} together. The total is at most 10.`,
    explanation: [
      `${a} and ${b} make ${sum}.`,
      `${sum} hides ${a} and ${b}.`,
    ],
  });
}

function withinSub(ctx: ClauseCtx) {
  const { r } = ctx;
  const whole = r(2, 10);
  const part = r(1, whole - 1);
  return problem({
    id: ctx.id,
    seed: ctx.seed,
    task: ctx.task,
    skillId: skills[ctx.id]!,
    prompt: `What is ${whole} − ${part}?`,
    response: { kind: "number", label: "Difference" },
    answer: String(whole - part),
    hint: `${part} is one part of ${whole}. Ask which number joins ${part} so the sum is ${whole}.`,
    explanation: [
      `${part} and ${whole - part} make ${whole}.`,
      `So ${whole} − ${part} = ${whole - part}.`,
    ],
  });
}

const lengthObjects = ["ribbon", "rope", "string", "path", "fence", "board"] as const;

function lengthStory(ctx: ClauseCtx) {
  const { r } = ctx;
  const shape = (["join", "remove", "compare"] as const)[r(0, 2)]!;
  const unit = r(0, 1) === 0 ? "cm" : "m";
  const object = pick(r, lengthObjects);
  let a = 30, b = 20, answer = 50, prompt = "";
  if (shape === "join") {
    a = r(12, 70);
    const maxB = Math.min(85, 99 - a);
    b = r(12, Math.max(12, maxB));
    if (r(0, 2) !== 0) {
      // Prefer a sum that regroups.
      const ones = a % 10;
      if (ones !== 0 && 10 - ones + 10 <= maxB) b = Math.min(maxB, b - (b % 10) + (10 - ones));
      if (b < 12) b = 12;
    }
    answer = a + b;
    prompt = `A ${object} is ${a} ${unit} long. Nia ties a ${b} ${unit} ${object} to its end. How long is it now?`;
  } else if (shape === "remove") {
    a = r(30, 85);
    b = r(12, a - 12);
    answer = a - b;
    prompt = `A ${object} is ${a} ${unit}. Nia cuts off ${b} ${unit}. How long is the piece that is left?`;
  } else {
    a = r(30, 85);
    b = r(12, a - 12);
    const shorter = r(0, 1) === 0;
    answer = a - b;
    prompt = shorter
      ? `Leo's ${object} is ${b} ${unit}. Mia's is ${a} ${unit}. How much shorter is Leo's?`
      : `Leo's ${object} is ${a} ${unit}. Mia's is ${b} ${unit}. How much longer is Leo's?`;
  }
  return problem({
    id: ctx.id,
    seed: ctx.seed,
    task: ctx.task,
    skillId: skills[ctx.id]!,
    prompt,
    response: { kind: "number", label: unit === "cm" ? "Centimeters" : "Meters" },
    answer: String(answer),
    hint: `Both lengths are in ${unit}. ${shape === "join" ? `Join ${a} and ${b}.` : `The difference of ${Math.max(a, b)} and ${Math.min(a, b)} is what the question asks.`}`,
    explanation: [
      shape === "join"
        ? `The lengths go end to end: ${a} + ${b} = ${answer}.`
        : `The gap between ${Math.max(a, b)} and ${Math.min(a, b)} is ${answer}.`,
      `The unit stays ${unit}. ${Math.max(a, b)} and ${Math.min(a, b)} were never added when the question asks for a difference.`,
      `The length is ${answer} ${unit}.`,
    ],
  });
}

function fromZero(ctx: ClauseCtx) {
  const { r } = ctx;
  if (r(0, 1) === 0) {
    const n = r(3, 20);
    const response: PointPlotResponse = {
      kind: "point-plot",
      label: "Plot the point",
      grid: {
        xMin: 0,
        xMax: 20,
        yMin: 0,
        yMax: 2,
        step: 1,
        xLabel: "from 0",
        yLabel: "line",
      },
      pointCount: 1,
      ordered: false,
      connect: "none",
    };
    return problem({
      id: ctx.id,
      seed: ctx.seed,
      task: ctx.task,
      skillId: skills[ctx.id]!,
      prompt: `Show ${n} as a length from 0. Plot the point on the line y = 0.`,
      response,
      answer: JSON.stringify([[n, 0]]),
      pointGrading: { mode: "exact" },
      hint: `Zero is the start of the length. Count ${n} steps to the right, and stay on y = 0.`,
      explanation: [
        `Every step to the right is one more. Zero is where the length starts.`,
        `${n} steps along the line y = 0 is the point (${n}, 0).`,
        `A point one step off, or the digits of ${n} swapped, is a different length.`,
      ],
    });
  }
  const back = r(0, 1) === 0;
  if (!back) {
    const first = 10 * r(1, 8);
    const second = r(1, Math.min(9, 99 - first));
    const land = first + second;
    return problem({
      id: ctx.id,
      seed: ctx.seed,
      task: ctx.task,
      skillId: skills[ctx.id]!,
      prompt: `Start at 0. Hop forward ${first}, then forward ${second}. Where do you land?`,
      response: { kind: "number", label: "Landing" },
      answer: String(land),
      hint: `The first hop leaves 0 and adds ${first}. Then add the ${second}.`,
      explanation: [
        `The first hop starts at 0: 0 + ${first} = ${first}.`,
        `The second hop adds ${second}: ${first} + ${second} = ${land}.`,
        `You land on ${land}.`,
      ],
    });
  }
  const target = r(20, 90);
  const backBy = r(0, 1) === 0 ? 10 * r(1, Math.floor(target / 10) - 1) : r(1, 9);
  const land = target - backBy;
  return problem({
    id: ctx.id,
    seed: ctx.seed,
    task: ctx.task,
    skillId: skills[ctx.id]!,
    prompt: `Start at 0, hop to ${target}, then hop back ${backBy}. Where are you?`,
    response: { kind: "number", label: "Landing" },
    answer: String(land),
    hint: `The forward hop ends at ${target}. Hopping back ${backBy} subtracts.`,
    explanation: [
      `From 0 the forward hop lands on ${target}.`,
      `Back ${backBy} is ${target} − ${backBy} = ${land}.`,
      `You are at ${land}.`,
    ],
  });
}

/** Four distinct, non-negative options: the listed distractors first, then the
 * nearest unused values, so a coincidence never leaves a blank easy to guess. */
function fourOptions(correct: number, distractors: readonly number[]): string[] {
  const out: number[] = [correct];
  for (const d of distractors) if (d >= 0 && !out.includes(d)) out.push(d);
  for (let k = 1; out.length < 4; k++)
    for (const d of [correct + k, correct - k])
      if (out.length < 4 && d >= 0 && !out.includes(d)) out.push(d);
  return out.slice(0, 4).map(String);
}

function tensThenOnes(ctx: ClauseCtx) {
  const { r } = ctx;
  const countN = r(0, 1) === 0 ? 3 : 4;
  const values: number[] = [];
  for (let i = 0; i < countN; i++) values.push(r(12, 79));
  // Push the ones total into 10–29 most of the time.
  if (r(0, 3) !== 0) {
    const ones = values.reduce((s, v) => s + (v % 10), 0);
    if (ones < 10) values[0] = values[0]! - (values[0]! % 10) + Math.min(9, (values[0]! % 10) + (10 - ones));
  }
  const tens = values.reduce((s, v) => s + Math.floor(v / 10) * 10, 0);
  const ones = values.reduce((s, v) => s + (v % 10), 0);
  const total = tens + ones;
  const tensText = values.map((v) => v - (v % 10)).join(" + ");
  const onesText = values.map((v) => v % 10).join(" + ");
  const built = slots(
    r,
    [
      {
        id: "tens",
        label: `Tens: ${tensText}`,
        options: fourOptions(tens, [tens + 10, tens - 10, ones]),
        correct: String(tens),
      },
      {
        id: "ones",
        label: `Ones: ${onesText}`,
        options: fourOptions(ones, [ones - 10, ones + 1, values[0]! % 10]),
        correct: String(ones),
      },
      {
        id: "total",
        label: "Total",
        options: fourOptions(total, [tens + (ones % 10), total - 10, tens]),
        correct: String(total),
      },
    ],
    "Add the tens, then the ones",
  );
  return problem({
    id: ctx.id,
    seed: ctx.seed,
    task: ctx.task,
    skillId: skills[ctx.id]!,
    prompt: `Find ${values.join(" + ")} by adding the tens, then the ones.`,
    response: built.response,
    answer: built.answer,
    hint: `Add the tens ${tensText} first. Then add the ones ${onesText}.`,
    explanation: [
      `Tens with tens: ${tensText} = ${tens}.`,
      `Ones with ones: ${onesText} = ${ones}.`,
      `${tens} and ${ones} is ${total}. The total is ${total}.`,
      `Check by subtracting the last addends from ${total}.`,
    ],
  });
}

function columnAdd(a: number, b: number): { digit: number; carry: number }[] {
  const out: { digit: number; carry: number }[] = [];
  let carry = 0;
  const n = Math.max(String(a).length, String(b).length);
  for (let i = 0; i < n; i++) {
    const da = Math.floor(a / 10 ** i) % 10;
    const db = Math.floor(b / 10 ** i) % 10;
    const sum = da + db + carry;
    carry = Math.floor(sum / 10);
    out.push({ digit: sum % 10, carry });
  }
  if (carry) out.push({ digit: carry, carry: 0 });
  return out;
}

function columnSub(a: number, b: number): number[] {
  const digits: number[] = [];
  let borrow = 0;
  const n = String(a).length;
  for (let i = 0; i < n; i++) {
    let da = Math.floor(a / 10 ** i) % 10 - borrow;
    const db = Math.floor(b / 10 ** i) % 10;
    borrow = 0;
    if (da < db) {
      da += 10;
      borrow = 1;
    }
    digits.push(da - db);
  }
  return digits;
}

function hundredsStack(ctx: ClauseCtx) {
  const { r } = ctx;
  let a = 257, b = 256;
  for (let i = 0; i < 20; i++) {
    a = 100 * r(1, 4) + 10 * r(0, 8) + r(0, 9);
    b = 100 * r(1, 4) + 10 * r(0, 8) + r(0, 9);
    if (a + b <= 999 && a >= 105 && b >= 105) break;
  }
  const cols = columnAdd(a, b);
  const names = ["Ones", "Tens", "Hundreds", "Thousands"];
  const rows = cols.slice(0, 5).map((col, i) => ({
    label: names[i] ?? "Next",
    values: i === cols.length - 1 ? [String(col.digit)] : [String(col.digit), String(col.carry)],
    fieldLabels: i === cols.length - 1 ? ["Digit"] : ["Digit", "Carry"],
  }));
  const built = numberStack(rows, "Fill the stack");
  return problem({
    id: ctx.id,
    seed: ctx.seed,
    task: ctx.task,
    skillId: skills[ctx.id]!,
    prompt: `Add ${a} + ${b}. Add the ones, then the tens, then the hundreds. Fill the stack.`,
    response: built.response,
    answer: built.answer,
    workGrading: built.workGrading,
    hint: `Start at the ones: ${a % 10} and ${b % 10}. A sum of 10 or more writes one digit and carries 1.`,
    explanation: [
      `Ones: ${a % 10} + ${b % 10} = ${(a % 10) + (b % 10)}. Write ${cols[0]!.digit} and carry ${cols[0]!.carry}.`,
      `Keep going place by place. The sum is ${a + b}.`,
      `Check: ${a + b} − ${b} = ${a}.`,
    ],
  });
}

function openWhich(ctx: ClauseCtx) {
  const { r } = ctx;
  const tensZero = r(0, 2) === 0;
  let a = 302, b = 117;
  for (let i = 0; i < 30; i++) {
    const hundreds = r(2, 9);
    const tens = tensZero ? 0 : r(1, 8);
    const ones = r(0, 4);
    a = hundreds * 100 + tens * 10 + ones;
    const bh = r(0, hundreds - 1);
    const bt = r(1, 8);
    const bo = r(5, 9);
    b = bh * 100 + bt * 10 + bo;
    if (b < a && b >= 103) break;
  }
  const openHundred = Math.floor(a / 10) % 10 === 0;
  const correct = openHundred
    ? "A hundred, into ten tens"
    : "A ten, into ten ones";
  const choice = singleChoice(
    r,
    [
      { label: correct, correct: true },
      {
        label: openHundred ? "A ten, into ten ones" : "A hundred, into ten tens",
        feedback: openHundred
          ? "There is no ten to open. The tens digit is 0, so a hundred has to be opened first."
          : "There is a ten to open. A hundred does not need to be opened yet.",
      },
      {
        label: "Nothing; take the smaller digit from the larger one",
        feedback: "Taking the smaller digit from the larger one in the same place changes the number.",
      },
      {
        label: "A one, into ten smaller pieces",
        feedback: "A one is already the smallest place. It does not break into ten of a smaller place here.",
      },
    ],
    "Which block is opened first?",
  );
  const digits = columnSub(a, b);
  const bankId = "open";
  const options = choice.response.options.map((option, i) => ({
    id: "abcd"[i]!,
    label: option.label,
  }));
  const correctId = options[choice.response.options.findIndex((o) => o.id === choice.answer)]!.id;
  const response: StructuredWorkResponse = {
    kind: "structured-work",
    label: "Open a block, then fill the difference",
    layout: "steps",
    mode: "build",
    banks: [{ id: bankId, label: "First move", options }],
    rows: [
      {
        id: "r1",
        label: `You need to take ${b % 10} ones from ${a}. Which block is opened first?`,
        fields: [{ kind: "choice", label: "First move", bank: bankId }],
      },
      ...digits.slice(0, 3).map((digit, i) => ({
        id: `r${i + 2}`,
        label: ["Ones digit", "Tens digit", "Hundreds digit"][i]!,
        fields: [{ kind: "number" as const, label: "Digit" }],
      })),
    ],
  };
  const workGrading: WorkGrading = {
    mode: "fields",
    fields: [
      [{ kind: "choice", accept: [correctId] }],
      ...digits.slice(0, 3).map((digit) => [{ kind: "number" as const, value: String(digit) }]),
    ],
  };
  const answer = JSON.stringify([[correctId], ...digits.slice(0, 3).map((d) => [String(d)])]);
  if (!gradingFits(response, workGrading) || !gradeStructuredWork(response, workGrading, answer))
    throw new Error("Open-which key");
  return problem({
    id: ctx.id,
    seed: ctx.seed,
    task: ctx.task,
    skillId: skills[ctx.id]!,
    prompt: `The blocks show ${a}. Subtract ${b}. Fill the stack.`,
    figure: blocks(a),
    response,
    answer,
    workGrading,
    hint: `Look at the ones of ${a}, which are ${a % 10}. You need ${b % 10} ones. ${openHundred ? `${a} has no tens to open.` : `${a} has tens to open.`}`,
    explanation: [
      openHundred
        ? `${a} has ${count(a % 10, "one")} and no tens. Open a hundred into ten tens, then open one of those tens into ten ones.`
        : `${a} has a ten to open into ten ones.`,
      `The difference is ${a - b}. Check: ${a - b} + ${b} = ${a}.`,
    ],
  });
}

function oneDigitSums(ctx: ClauseCtx) {
  const { r } = ctx;
  const allowZero = r(0, 9) === 0;
  const a = allowZero ? r(0, 9) : r(1, 9);
  const b = allowZero ? r(0, 9) : r(1, 9);
  const figure =
    a >= 1 && b >= 1
      ? ({ kind: "ten-frame-pair", first: a, second: b } as SemanticFigure)
      : undefined;
  return problem({
    id: ctx.id,
    seed: ctx.seed,
    task: ctx.task,
    skillId: skills[ctx.id]!,
    prompt: `What is ${a} + ${b}?`,
    ...(figure ? { figure } : {}),
    response: { kind: "number", label: "Sum" },
    answer: String(a + b),
    hint: a + b === 10 ? `${a} and ${b} make ten.` : `Add the one-digit numbers ${a} and ${b}.`,
    explanation: [
      a === b
        ? `${a} + ${a} is the double ${a + a}.`
        : `${Math.min(a, b)} + ${Math.min(a, b)} is ${2 * Math.min(a, b)}, then ${Math.abs(a - b)} more is ${a + b}.`,
      `${a} + ${b} = ${a + b}.`,
    ],
  });
}

function relatedMirror(ctx: ClauseCtx) {
  const { r } = ctx;
  const part = r(0, 9) === 0 ? 0 : r(1, 9);
  const other = r(0, 9);
  const whole = part + other;
  const safeWhole = Math.min(18, Math.max(part, whole));
  const sub = Math.min(part, safeWhole);
  return problem({
    id: ctx.id,
    seed: ctx.seed,
    task: ctx.task,
    skillId: skills[ctx.id]!,
    prompt: `What is ${safeWhole} − ${sub}?`,
    response: { kind: "number", label: "Difference" },
    answer: String(safeWhole - sub),
    hint: `Think of the addition fact that uses ${sub} and ends at ${safeWhole}.`,
    explanation: [
      `${sub} + ${safeWhole - sub} = ${safeWhole}.`,
      `So ${safeWhole} − ${sub} = ${safeWhole - sub}.`,
    ],
  });
}

function roundAndAdjust(ctx: ClauseCtx) {
  const { r } = ctx;
  const base = 100 * r(1, 7);
  const distance = r(1, 3);
  const below = r(0, 1) === 0;
  const near = below ? base - distance : base + distance;
  const other = r(105, Math.min(799, 999 - near));
  const rounded = other + base;
  const answer = below ? rounded - distance : rounded + distance;
  // Keep the sum at most 999.
  const safeOther = other + near > 999 ? 999 - near : other;
  const safeRounded = safeOther + base;
  const safeAnswer = below ? safeRounded - distance : safeRounded + distance;
  const built = slots(
    r,
    [
      {
        id: "near",
        label: `${near} is close to`,
        options: [String(base), String(near), String(base + 10), String(distance)],
        correct: String(base),
      },
      {
        id: "round",
        label: `${safeOther} + ${base}`,
        options: [String(safeRounded), String(safeAnswer), String(safeRounded + distance), String(safeOther)],
        correct: String(safeRounded),
      },
      {
        id: "off",
        label: "You were off by",
        options: [String(distance), String(near % 10), String(distance + 1), "10"],
        correct: String(distance),
      },
      {
        id: "sum",
        label: `${safeOther} + ${near}`,
        options: [String(safeAnswer), String(safeRounded), String(below ? safeRounded + distance : safeRounded - distance), String(safeAnswer + 10)],
        correct: String(safeAnswer),
      },
    ],
    "Add the round number first",
  );
  return problem({
    id: ctx.id,
    seed: ctx.seed,
    task: ctx.task,
    skillId: skills[ctx.id]!,
    prompt: `${safeOther} + ${near}. Add the round number first.`,
    response: built.response,
    answer: built.answer,
    hint: `${near} is ${distance} ${below ? "less" : "more"} than ${base}. Add ${safeOther} and ${base} before you adjust.`,
    explanation: [
      `${near} is ${distance} ${below ? "short of" : "past"} ${base}.`,
      `${safeOther} + ${base} = ${safeRounded}.`,
      below
        ? `We added ${distance} too many, so give ${distance} back: ${safeAnswer}.`
        : `We added ${distance} too few, so add ${distance} more: ${safeAnswer}.`,
      `Check: ${safeAnswer} − ${near} = ${safeOther}.`,
    ],
  });
}

function countUp(ctx: ClauseCtx) {
  const { r } = ctx;
  let minuend = 1000;
  let sub = 863;
  let shown: [number, number, number] = [7, 30, 100];
  for (let i = 0; i < 40; i++) {
    minuend = 100 * r(4, 10);
    sub = r(minuend - 250, minuend - 30);
    if (sub % 10 === 0) sub += r(1, 9);
    if (sub < 10 || sub >= minuend - 10) continue;
    const hop1 = 10 - (sub % 10);
    const afterTen = sub + hop1;
    const hundred = Math.ceil(afterTen / 100) * 100;
    const hop2 = hundred - afterTen;
    const hop3 = minuend - hundred;
    if (hop1 < 1 || hop1 > 9 || hop2 <= 0 || hop3 <= 0) continue;
    if (hop1 + hop2 + hop3 !== minuend - sub) continue;
    shown = [hop1, hop2, hop3];
    break;
  }
  const answer = minuend - sub;
  const built = slots(
    r,
    [
      {
        id: "h1",
        label: `${sub} up to the next ten`,
        options: [String(shown[0]), String(shown[0]! + 1), "10", String(sub % 10)],
        correct: String(shown[0]),
      },
      {
        id: "h2",
        label: "On to the next hundred",
        options: [String(shown[1]), String(Math.max(0, shown[1]! - 10)), "100", String(shown[1]! + 10)],
        correct: String(shown[1]),
      },
      {
        id: "h3",
        label: `On to ${minuend}`,
        options: [String(shown[2]), String(minuend), "10", String(Math.max(0, shown[2]! - 100))],
        correct: String(shown[2]),
      },
      {
        id: "diff",
        label: `${minuend} − ${sub}`,
        options: [String(answer), String(answer + 10), String(answer + (sub % 10)), String(answer + 1000)],
        correct: String(answer),
      },
    ],
    "Count up",
  );
  return problem({
    id: ctx.id,
    seed: ctx.seed,
    task: ctx.task,
    skillId: skills[ctx.id]!,
    prompt: `${minuend} − ${sub}. Count up from ${sub}.`,
    response: built.response,
    answer: built.answer,
    hint: `Start at ${sub}. Jump to the next ten first, a jump of less than 10.`,
    explanation: [
      `From ${sub}, ${shown[0]} reaches the next ten.`,
      `The next jumps are ${shown[1]} and ${shown[2]}.`,
      `${shown.filter((n) => n).join(" + ")} = ${answer}. So ${minuend} − ${sub} = ${answer}.`,
      `Check: ${sub} + ${answer} = ${minuend}.`,
    ],
  });
}

function multiStack(ctx: ClauseCtx, subtract: boolean) {
  const { r } = ctx;
  let a = 1000;
  let b = 100;
  for (let i = 0; i < 40; i++) {
    const digits = r(4, 5);
    a = r(10 ** (digits - 1), 10 ** digits - 1);
    const lo = 10 ** (digits - 2);
    const hi = subtract ? a - 1 : Math.min(10 ** digits - 1, 99999 - a);
    if (hi < lo) continue;
    b = r(lo, hi);
    break;
  }
  if (subtract) {
    const cols = columnSub(a, b);
    const names = ["Ones", "Tens", "Hundreds", "Thousands", "Ten-thousands"];
    const built = numberStack(
      cols.map((digit, i) => ({
        label: `${names[i]} digit`,
        values: [String(digit)],
        fieldLabels: ["Digit"],
      })),
      "Fill each digit",
    );
    return problem({
      id: ctx.id,
      seed: ctx.seed,
      task: ctx.task,
      skillId: skills[ctx.id]!,
      prompt: `Subtract ${a} − ${b} in the stack. Enter each digit of the difference, ones first.`,
      response: built.response,
      answer: built.answer,
      workGrading: built.workGrading,
      hint: `Start at the ones of ${a} and ${b}: ${a % 10} and ${b % 10}. Trade when the top digit is smaller.`,
      explanation: [
        `Subtract one place at a time, starting with the ones.`,
        `The difference is ${a - b}.`,
        `Check: ${a - b} + ${b} = ${a}.`,
      ],
    });
  }
  const cols = columnAdd(a, b);
  const names = ["Ones", "Tens", "Hundreds", "Thousands", "Ten-thousands", "Hundred-thousands"];
  const built = numberStack(
    cols.slice(0, 6).map((col, i) => ({
      label: names[i] ?? "Next",
      values: i === cols.length - 1 ? [String(col.digit)] : [String(col.digit), String(col.carry)],
      fieldLabels: i === cols.length - 1 ? ["Digit"] : ["Digit", "Carry out"],
    })),
    "Fill each digit",
  );
  return problem({
    id: ctx.id,
    seed: ctx.seed,
    task: ctx.task,
    skillId: skills[ctx.id]!,
    prompt: `Add ${a} + ${b} in the stack. Enter each digit of the sum, ones first, and the carry out of each place except the last.`,
    response: built.response,
    answer: built.answer,
    workGrading: built.workGrading,
    hint: `Start with the ones: ${a % 10} + ${b % 10}. Write one digit, and carry 1 when the place reaches 10.`,
    explanation: [
      `Add one place at a time. A place that reaches 10 or more carries 1 to the next place.`,
      `The sum is ${a + b}.`,
      `Check: ${a + b} − ${b} = ${a}.`,
    ],
  });
}

function twoWays(ctx: ClauseCtx) {
  const { r } = ctx;
  const whole = r(0, 4) === 0 ? 10 : r(4, 9);
  const built = bondPairs(whole, [1, whole - 1], [2, whole - 2]);
  return problem({
    id: ctx.id,
    seed: ctx.seed,
    task: ctx.task,
    skillId: skills[ctx.id]!,
    prompt: `Split ${whole} into two parts in two different ways. Each row is one way: the two parts must add to ${whole}, and the second way must not be the first pair turned around.`,
    response: built.response,
    answer: built.answer,
    workGrading: built.workGrading,
    hint: `${whole} can be split in more than one way. The two parts in a row must add to ${whole}, and the second row needs a different pair.`,
    explanation: [
      `Both rows have to make ${whole}.`,
      `1 and ${whole - 1} is one way. 2 and ${whole - 2} is a different way.`,
      `Turning a pair around, such as ${whole - 1} and 1 after 1 and ${whole - 1}, is the same two parts.`,
      `${whole} hides many pairs. Two different pairs both make ${whole}.`,
    ],
  });
}

function tenFrameRecord(ctx: ClauseCtx) {
  const { r } = ctx;
  const filled = r(1, 9);
  const empty = 10 - filled;
  const flipped = r(0, 2) === 0;
  const correct = flipped ? `10 = ${filled} + ${empty}` : `${filled} + ${empty} = 10`;
  const choice = singleChoice(r, [
    { label: correct, correct: true },
    {
      label: `${filled} + 10 = ${filled + 10}`,
      feedback: `${filled} + 10 adds a whole extra ten. The frame is already the ten; the empty places are ${empty}, not 10.`,
    },
    {
      label: `${filled} + ${empty + 1} = 10`,
      feedback: `The empty places are ${empty}, not ${empty + 1}.`,
    },
    {
      label: `10 − ${filled} = ${filled}`,
      feedback: `10 − ${filled} is ${empty}, not ${filled}. The partner is the empty places.`,
    },
  ]);
  return problem({
    id: ctx.id,
    seed: ctx.seed,
    task: ctx.task,
    skillId: skills[ctx.id]!,
    prompt: `Which number sentence tells about this frame?`,
    figure: { kind: "ten-frame", first: filled, second: 0, capacity: 10 },
    response: choice.response,
    answer: choice.answer,
    choiceFeedback: choice.choiceFeedback,
    hint: `The frame has 10 places. ${filled} ${filled === 1 ? "is" : "are"} full. Count the empty places.`,
    explanation: [
      `${count(filled, "cell")} full, ${count(empty, "cell")} empty.`,
      `${filled} and ${empty} make 10: ${correct}.`,
      `The empty places are the partner that completes the ten.`,
    ],
  });
}

export function buildAdditionClause(ctx: ClauseCtx) {
  switch (`${ctx.id}:${ctx.task}`) {
    case "add-ones-regroup:add-tens":
      return addTens(ctx);
    case "add-ones-regroup:blocks-to-stack":
      return blocksToStack(ctx);
    case "three-addend-story:which-equation":
      return whichEquation(ctx);
    case "add-within-20:near-double":
      return nearDouble(ctx);
    case "add-within-20:within-10-fluency":
      return withinAdd(ctx);
    case "subtract-within-20:within-10-fluency":
      return withinSub(ctx);
    case "number-line-hops:length-story":
      return lengthStory(ctx);
    case "number-line-hops:from-zero":
      return fromZero(ctx);
    case "add-several-two-digit:tens-then-ones":
      return tensThenOnes(ctx);
    case "add-with-regrouping:blocks-to-stack":
      return hundredsStack(ctx);
    case "subtract-with-regrouping:open-which":
      return openWhich(ctx);
    case "make-ten-fact:all-one-digit-sums":
      return oneDigitSums(ctx);
    case "related-subtraction:all-one-digit-sums":
      return relatedMirror(ctx);
    case "add-three-digit:round-and-adjust":
      return roundAndAdjust(ctx);
    case "subtract-three-digit:count-up":
      return countUp(ctx);
    case "add-multidigit:stack-work":
      return multiStack(ctx, false);
    case "subtract-multidigit:stack-work":
      return multiStack(ctx, true);
    case "number-bond-missing:two-ways":
      return twoWays(ctx);
    case "ten-frame-complement:record":
      return tenFrameRecord(ctx);
    default:
      throw new Error(`No addition clause ${ctx.id}:${ctx.task}`);
  }
}
