import { createHash } from "node:crypto";
import type {
  GeneratedProblem,
  SemanticFigure,
  TemplateMetadata,
} from "./contracts";
import { formatWhole } from "./comparison-practice";

type Random = (low: number, high: number) => number;
const definitions = [
  [
    "add-two-digit-regroup",
    "Add two-digit numbers",
    "addition-within-100",
    "K–2",
    "Add two two-digit numbers with a sum at most 100, shown with base-ten blocks.",
  ],
  [
    "make-hundred",
    "Make one hundred",
    "addition-within-100",
    "K–2",
    "Find the number that joins a two-digit number to make 100.",
  ],
  [
    "subtract-two-digit-regroup",
    "Subtract two-digit numbers",
    "subtraction-within-100",
    "K–2",
    "Subtract a two-digit number from a number up to 100, often regrouping a ten.",
  ],
  [
    "add-three-digit",
    "Add within 1000",
    "add-subtract-thousands",
    "3–5",
    "Add two three-digit numbers with a sum at most 1000, regrouping in any place.",
  ],
  [
    "subtract-three-digit",
    "Subtract within 1000",
    "add-subtract-thousands",
    "3–5",
    "Subtract three-digit numbers, including regrouping across a zero and from 1000.",
  ],
  [
    "add-multidigit",
    "Add multidigit numbers",
    "whole-add-subtract",
    "3–5",
    "Add whole numbers of four to six digits with the standard algorithm.",
  ],
  [
    "subtract-multidigit",
    "Subtract multidigit numbers",
    "whole-add-subtract",
    "3–5",
    "Subtract whole numbers of four to six digits, including regrouping across zeros.",
  ],
] as const;
export const addSubtractTemplates: readonly TemplateMetadata[] =
  definitions.map(([id, title, skillId, gradeBand, description]) => ({
    id,
    title,
    skillId,
    gradeBand,
    description,
    version: 1,
  }));

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

const places = [
  "ones",
  "tens",
  "hundreds",
  "thousands",
  "ten thousands",
  "hundred thousands",
  "millions",
];
const one = (place: number) => places[place]!.replace(/s$/, "");
const Cap = (text: string) => text[0]!.toUpperCase() + text.slice(1);
const digits = (n: number) => String(n).split("").reverse().map(Number);

/** Places where the column algorithm carries (addition). */
export function carries(a: number, b: number): number[] {
  const x = digits(a),
    y = digits(b),
    out: number[] = [];
  let carry = 0;
  for (let p = 0; p < Math.max(x.length, y.length); p++) {
    carry = (x[p] ?? 0) + (y[p] ?? 0) + carry >= 10 ? 1 : 0;
    if (carry) out.push(p);
  }
  return out;
}
/** Places that must borrow, and whether any borrow crosses a zero. */
export function borrows(a: number, b: number) {
  const top = digits(a),
    bottom = digits(b),
    at: number[] = [];
  let acrossZero = false;
  for (let p = 0; p < top.length; p++) {
    if (top[p]! < (bottom[p] ?? 0)) {
      at.push(p);
      let q = p + 1;
      while (top[q] === 0) {
        acrossZero = true;
        top[q] = 9;
        q++;
      }
      top[q]!--;
      top[p]! += 10;
    }
  }
  return { at, acrossZero };
}

function additionSteps(a: number, b: number): string[] {
  const x = digits(a),
    y = digits(b),
    steps: string[] = [];
  let carry = 0;
  const n = Math.max(x.length, y.length);
  for (let p = 0; p < n; p++) {
    const terms = [
      ...(p < x.length ? [x[p]!] : []),
      ...(p < y.length ? [y[p]!] : []),
      ...(carry ? [carry] : []),
    ];
    const total = terms.reduce((s, t) => s + t, 0);
    const sum = `${terms.join(" + ")} = ${total}`;
    carry = total >= 10 ? 1 : 0;
    steps.push(
      carry
        ? p === n - 1
          ? `${Cap(places[p]!)}: ${sum}. Write ${total % 10} ${places[p]} and 1 ${one(p + 1)}.`
          : `${Cap(places[p]!)}: ${sum}. Write ${total % 10} and regroup 10 ${places[p]} as 1 ${one(p + 1)}.`
        : terms.length === 1
          ? `${Cap(places[p]!)}: ${total}, with nothing to add.`
          : `${Cap(places[p]!)}: ${sum}.`,
    );
  }
  steps.push(
    `So ${formatWhole(a)} + ${formatWhole(b)} = ${formatWhole(a + b)}.`,
  );
  return steps;
}

function subtractionSteps(a: number, b: number): string[] {
  const top = digits(a),
    original = digits(a),
    bottom = digits(b),
    steps: string[] = [];
  const lastNonzero = digits(a - b).length - 1;
  for (let p = 0; p < top.length; p++) {
    const d = bottom[p] ?? 0;
    let lead = "";
    if (top[p]! < d) {
      let q = p + 1;
      while (top[q] === 0) q++;
      const chain: string[] = [];
      for (let k = q; k > p; k--)
        chain.push(`1 ${one(k)} as 10 ${places[k - 1]}`);
      lead = `${top[p]} < ${d}, so regroup ${chain.join(", then ")}. `;
      top[q]!--;
      for (let k = q - 1; k > p; k--) top[k] = 9;
      top[p]! += 10;
    }
    // Leading zeros of the difference need no step once the subtrahend is used up.
    if (p > lastNonzero && p >= bottom.length && !lead) continue;
    const left =
      !lead && top[p] !== original[p]
        ? `${top[p]} left after regrouping; `
        : "";
    steps.push(
      `${Cap(places[p]!)}: ${lead}${left}${top[p]} − ${d} = ${top[p]! - d}.`,
    );
  }
  steps.push(
    `So ${formatWhole(a)} − ${formatWhole(b)} = ${formatWhole(a - b)}. Check: ${formatWhole(a - b)} + ${formatWhole(b)} = ${formatWhole(a)}.`,
  );
  return steps;
}

/** The first move of column addition for these two numbers. */
function additionHint(a: number, b: number): string {
  const x = digits(a),
    y = digits(b),
    first = carries(a, b)[0];
  const start = `Line up ${formatWhole(a)} and ${formatWhole(b)} by place and start with the ones: ${x[0]} + ${y[0]}`;
  if (first === undefined)
    return `${start}. No column reaches 10, so nothing regroups.`;
  if (first === 0)
    return `${start} is 10 or more, so regroup 10 ones as 1 ten.`;
  return `${start} is less than 10. The ${places[first]} are the first column to reach 10; regroup there.`;
}
/** The first move of column subtraction, naming the first place that regroups. */
function subtractionHint(a: number, b: number): string {
  const top = digits(a),
    bottom = digits(b),
    p = borrows(a, b).at[0];
  const start = `Line up ${formatWhole(a)} − ${formatWhole(b)} by place and start with the ones: ${top[0]} − ${bottom[0]}`;
  if (p === undefined)
    return `${start}. Each top digit is at least the digit below it, so nothing regroups.`;
  let q = p + 1;
  while (top[q] === 0) q++;
  const short =
    p === 0
      ? `${start}. ${top[0]} is less than ${bottom[0]}`
      : `${start} needs no regrouping. In the ${places[p]}, ${top[p]} is less than ${bottom[p]}`;
  return q === p + 1
    ? `${short}, so regroup 1 ${one(q)} as 10 ${places[p]}.`
    : `${short}, and the ${places[p + 1]} digit is 0. Regroup from the ${places[q]} first; each 0 passed becomes 9.`;
}

/** Pick a target case, then draw candidates until one has it. */
function draw<T>(
  r: Random,
  cases: readonly string[],
  candidate: (target: string) => T,
  has: (value: T, target: string) => boolean,
): T {
  const target = cases[r(0, cases.length - 1)]!;
  for (let i = 0; i < 4000; i++) {
    const value = candidate(target);
    if (has(value, target)) return value;
  }
  throw new Error(`No ${target} case`);
}

export function generateAddSubtractProblem(
  templateId: string,
  seed: string,
): GeneratedProblem {
  const meta = addSubtractTemplates.find((t) => t.id === templateId);
  if (!meta) throw new Error(`Unknown addition template: ${templateId}`);
  if (typeof seed !== "string" || !seed.length || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const r = random(templateId, seed);
  let prompt = "",
    answer = 0,
    hint = "",
    explanation: string[] = [],
    figure: SemanticFigure | undefined;
  switch (templateId) {
    case "add-two-digit-regroup": {
      const [a, b] = draw(
        r,
        ["regroup", "regroup", "regroup", "none", "hundred"],
        (target) => {
          const a = r(10, 89);
          return [a, target === "hundred" ? 100 - a : r(10, 99 - a)] as const;
        },
        ([a, b], target) =>
          b >= 10 &&
          (target === "hundred"
            ? a + b === 100
            : a + b < 100 && (target === "none") === (a % 10) + (b % 10) < 10),
      );
      figure = { kind: "base-ten-pair", values: [a, b] };
      prompt = `What is ${a} + ${b}?`;
      answer = a + b;
      hint = additionHint(a, b);
      explanation = additionSteps(a, b);
      break;
    }
    case "make-hundred": {
      // One in five starts on a whole ten; the rest need a ten completed first.
      const round = r(0, 4) === 0;
      let start = round ? 10 * r(1, 9) : r(11, 89);
      if (!round && start % 10 === 0) start += 1;
      prompt = `${start} + □ = 100. What number goes in the box?`;
      answer = 100 - start;
      const next = Math.ceil(start / 10) * 10;
      hint =
        start % 10 === 0
          ? `${start} is ${start / 10} tens, and 100 is ten tens. How many more tens make 100?`
          : `Count up from ${start} to the next ten, ${next}. Then count by tens from ${next} to 100.`;
      explanation =
        start % 10 === 0
          ? [
              `${start} is ${start / 10} tens, and 100 is 10 tens.`,
              `10 − ${start / 10} = ${10 - start / 10} tens, which is ${answer}.`,
              `Check: ${start} + ${answer} = 100.`,
            ]
          : [
              `${start} + ${next - start} = ${next}, the next ten.`,
              `${next} + ${100 - next} = 100.`,
              `Together: ${next - start} + ${100 - next} = ${answer}. Check: ${start} + ${answer} = 100.`,
            ];
      break;
    }
    case "subtract-two-digit-regroup": {
      const [a, b] = draw(
        r,
        ["regroup", "regroup", "none", "round", "hundred"],
        (target) => {
          const a =
            target === "hundred"
              ? 100
              : target === "round"
                ? 10 * r(3, 9)
                : r(30, 99);
          return [a, r(10, a - 10)] as const;
        },
        ([a, b], target) => {
          const regroup = a % 10 < b % 10;
          if (target === "none") return !regroup && a < 100;
          if (target === "round") return a % 10 === 0 && b % 10 > 0;
          if (target === "hundred") return a === 100 && b % 10 > 0;
          return regroup && a % 10 > 0 && a < 100;
        },
      );
      prompt = `What is ${a} − ${b}?`;
      answer = a - b;
      hint = subtractionHint(a, b);
      explanation = subtractionSteps(a, b);
      break;
    }
    case "add-three-digit": {
      const [a, b] = draw(
        r,
        ["ones", "tens", "both", "none", "thousand"],
        (target) => {
          const a = r(101, 899);
          return [
            a,
            target === "thousand" ? 1000 - a : r(100, 999 - a),
          ] as const;
        },
        ([a, b], target) => {
          if (b < 100) return false;
          if (target === "thousand") return a + b === 1000;
          const c = carries(a, b).join();
          return (
            a + b <= 999 &&
            c === { ones: "0", tens: "1", both: "0,1", none: "" }[target]
          );
        },
      );
      prompt = `What is ${formatWhole(a)} + ${formatWhole(b)}?`;
      answer = a + b;
      hint = additionHint(a, b);
      explanation = additionSteps(a, b);
      break;
    }
    case "subtract-three-digit": {
      const [a, b] = draw(
        r,
        ["ones", "tens", "both", "zero", "none", "thousand"],
        (target) => {
          const a =
            target === "thousand"
              ? 1000
              : target === "zero"
                ? 100 * r(2, 9) + r(0, 9)
                : r(200, 999);
          return [a, r(100, a - 1)] as const;
        },
        ([a, b], target) => {
          const { at, acrossZero } = borrows(a, b);
          if (target === "thousand") return a === 1000 && b % 10 > 0;
          if (a === 1000) return false;
          if (target === "zero") return acrossZero;
          return (
            !acrossZero &&
            at.join() ===
              { ones: "0", tens: "1", both: "0,1", none: "" }[target]
          );
        },
      );
      prompt = `What is ${formatWhole(a)} − ${formatWhole(b)}?`;
      answer = a - b;
      hint = subtractionHint(a, b);
      explanation = subtractionSteps(a, b);
      break;
    }
    case "add-multidigit": {
      const [a, b] = draw(
        r,
        ["chain", "new-digit", "mixed"],
        () => {
          const la = r(4, 6),
            lb = r(4, la);
          return [
            r(10 ** (la - 1), 10 ** la - 1),
            r(10 ** (lb - 1), 10 ** lb - 1),
          ] as const;
        },
        ([a, b], target) => {
          if (a + b > 999999) return false;
          const c = carries(a, b);
          const longer = String(a + b).length > String(a).length;
          if (target === "new-digit") return longer;
          const run = c.filter((p) => c.includes(p - 1) && c.includes(p - 2));
          if (target === "chain") return !longer && run.length > 0;
          return !longer && !run.length && c.length >= 1;
        },
      );
      prompt = `What is ${formatWhole(a)} + ${formatWhole(b)}?`;
      answer = a + b;
      hint = additionHint(a, b);
      explanation = additionSteps(a, b);
      break;
    }
    case "subtract-multidigit": {
      const [a, b] = draw(
        r,
        ["zeros", "zeros", "mixed"],
        (target) => {
          const la = r(4, 6);
          const top = Array.from({ length: la }, (_, i) =>
            i === 0
              ? r(1, 9)
              : target === "zeros" && i < la - 1 && r(0, 1)
                ? 0
                : r(0, 9),
          );
          const a = Number(top.join(""));
          const lb = r(Math.max(4, la - 1), la);
          const low = 10 ** (lb - 1);
          return [
            a,
            r(low, Math.max(low, Math.min(a - 1, 10 * low - 1))),
          ] as const;
        },
        ([a, b], target) => {
          if (b < 1000 || b >= a) return false;
          const { at, acrossZero } = borrows(a, b);
          if (target === "zeros")
            return acrossZero && /[1-9]00/.test(String(a));
          return !acrossZero && at.length >= 2;
        },
      );
      prompt = `What is ${formatWhole(a)} − ${formatWhole(b)}?`;
      answer = a - b;
      hint = subtractionHint(a, b);
      explanation = subtractionSteps(a, b);
      break;
    }
  }
  return {
    public: {
      id: createHash("sha256")
        .update(JSON.stringify([templateId, 1, seed]))
        .digest("hex"),
      templateId,
      templateVersion: 1,
      seed,
      prompt,
      skillId: meta.skillId,
      response: { kind: "number", label: "Answer" },
      ...(figure ? { figure } : {}),
    },
    answer: String(answer),
    hint,
    explanation,
  };
}
