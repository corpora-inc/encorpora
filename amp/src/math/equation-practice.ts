import { createHash } from "node:crypto";
import type {
  GeneratedProblem,
  SemanticFigure,
  TemplateMetadata,
} from "./contracts";

/** One- and two-step equations (grades 6–7) and simple inequalities (grade 6). */
type Random = (low: number, high: number) => number;
type Rational = { n: number; d: number };
type Mode = "whole" | "decimal" | "fraction";
type Relation = "<" | ">" | "≤" | "≥";
type Candidate = { label: string; correct: boolean; feedback?: string };
type Case = {
  prompt: string;
  explanation: string[];
  hint: string;
  tags: string[];
  figure?: SemanticFigure;
} & (
  | { kind: "number" | "fraction"; label: string; answer: string }
  | {
      kind: "choice";
      label: string;
      candidates: Candidate[];
      /** Keep the authored order (A, B, C, D) instead of shuffling. */
      fixedOrder?: boolean;
    }
);

const choice = { requiredResponseCapability: "single-choice-v1" as const };
export const equationTemplates: readonly TemplateMetadata[] = [
  {
    id: "one-step-equation",
    version: 1,
    title: "Solve a one-step equation",
    skillId: "one-step-equations",
    gradeBand: "6–8",
    description:
      "Solve x + p = q, x − p = q, px = q or x ÷ p = q with whole numbers, decimals or fractions by doing the inverse operation to both sides.",
  },
  {
    id: "one-step-equation-story",
    version: 1,
    title: "Write and solve a one-step equation",
    skillId: "one-step-equations",
    gradeBand: "6–8",
    description:
      "Choose the one-step equation that represents a story and its correct solution.",
    ...choice,
  },
  {
    id: "balance-one-step",
    version: 1,
    title: "Read a balance as a one-step equation",
    skillId: "one-step-equations",
    gradeBand: "6–8",
    description:
      "Find the weight of one unknown block on a level balance by removing equal weights or splitting both pans equally.",
  },
  {
    id: "two-step-equation",
    version: 1,
    title: "Solve a two-step equation",
    skillId: "two-step-equations",
    gradeBand: "6–8",
    description:
      "Solve px + q = r and p(x + q) = r with signed integers or decimals by undoing the operations in reverse order.",
  },
  {
    id: "two-step-word-problem",
    version: 1,
    title: "Solve a two-step equation story",
    skillId: "two-step-equations",
    gradeBand: "6–8",
    description:
      "Write px + q = r or p(x + q) = r for a story and solve it for the unknown quantity.",
  },
  {
    id: "two-step-equation-model",
    version: 1,
    title: "Choose the equation for a story",
    skillId: "two-step-equations",
    gradeBand: "6–8",
    description:
      "Choose the two-step equation that represents a story, distinguishing a rate from a fixed amount and px + q from p(x + q).",
    ...choice,
  },
  {
    id: "balance-two-step",
    version: 1,
    title: "Read a balance as a two-step equation",
    skillId: "two-step-equations",
    gradeBand: "6–8",
    description:
      "Find the weight of one unknown block on a level balance showing px + q = r or p(x + q) = r.",
  },
  {
    id: "inequality-from-context",
    version: 1,
    title: "Write an inequality for a condition",
    skillId: "simple-inequalities",
    gradeBand: "6–8",
    description:
      "Choose x > c, x < c, x ≥ c or x ≤ c for a condition stated in words.",
    ...choice,
  },
  {
    id: "inequality-from-number-line",
    version: 1,
    title: "Read an inequality from a number line",
    skillId: "simple-inequalities",
    gradeBand: "6–8",
    description:
      "Name the inequality whose solutions a number-line graph shows, reading the boundary, the circle and the direction.",
    ...choice,
  },
  {
    id: "inequality-number-line-choice",
    version: 1,
    title: "Choose the graph of an inequality",
    skillId: "simple-inequalities",
    gradeBand: "6–8",
    description:
      "Choose the number line that shows every solution of a simple inequality.",
    ...choice,
  },
  {
    id: "inequality-solution-set",
    version: 1,
    title: "Recognize the solutions of an inequality",
    skillId: "simple-inequalities",
    gradeBand: "6–8",
    description:
      "Decide which numbers are solutions of x > c, x < c, x ≥ c or x ≤ c, and recognize that there are infinitely many.",
    ...choice,
  },
];

// ---------------------------------------------------------------- arithmetic
const gcd = (a: number, b: number): number => {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
};
function q(n: number, d = 1): Rational {
  if (!Number.isSafeInteger(n) || !Number.isSafeInteger(d) || d === 0)
    throw new Error("Expected exact rational arithmetic");
  if (d < 0) [n, d] = [-n, -d];
  const g = gcd(n, d) || 1;
  return { n: n / g, d: d / g };
}
const add = (a: Rational, b: Rational) => q(a.n * b.d + b.n * a.d, a.d * b.d);
const sub = (a: Rational, b: Rational) => q(a.n * b.d - b.n * a.d, a.d * b.d);
const mul = (a: Rational, b: Rational) => q(a.n * b.n, a.d * b.d);
const div = (a: Rational, b: Rational) => q(a.n * b.d, a.d * b.n);
const lcm = (a: number, b: number) => (a / gcd(a, b)) * b;
const isInteger = (v: Rational) => v.d === 1;

/** Exact decimal digits for a denominator built from 2s and 5s. */
function decimal(v: Rational): string {
  let d = v.d,
    places = 0;
  while (d % 10 === 0 || d % 2 === 0 || d % 5 === 0) {
    if (d % 10 === 0) d /= 10;
    else if (d % 2 === 0) d /= 2;
    else d /= 5;
    places++;
    if (places > 6) break;
  }
  if (d !== 1) throw new Error("Not a terminating decimal");
  // Smallest number of places that makes the value an integer.
  let scale = 1,
    k = 0;
  while ((v.n * scale) % v.d !== 0) {
    scale *= 10;
    k++;
  }
  const whole = Math.abs((v.n * scale) / v.d);
  const digits = String(whole).padStart(k + 1, "0");
  const text = k ? `${digits.slice(0, -k)}.${digits.slice(-k)}` : digits;
  return v.n < 0 ? `−${text}` : text;
}
const fraction = (v: Rational) =>
  `${v.n < 0 ? "−" : ""}${Math.abs(v.n)}${v.d === 1 ? "" : `/${v.d}`}`;
/** Display a value in the problem's number system, with a typographic minus. */
const show = (v: Rational, mode: Mode) =>
  mode === "decimal" ? decimal(v) : fraction(v);
/** Signed operand: negative values are parenthesized after an operator. */
const operand = (v: Rational, mode: Mode = "whole") =>
  v.n < 0 ? `(${show(v, mode)})` : show(v, mode);
const answerText = (v: Rational, mode: Mode) =>
  (mode === "decimal" ? decimal(v) : fraction(v)).replace("−", "-");
const cents = (c: number) =>
  c % 100 === 0
    ? String(c / 100)
    : `${Math.floor(c / 100)}.${String(c % 100).padStart(2, "0")}`;
const dollars = (c: number) => `${cents(c)} dollars`;

function random(id: string, seed: string): Random {
  let counter = 0;
  return (low, high) => {
    const span = high - low + 1,
      limit = Math.floor(0x100000000 / span) * span;
    let value: number;
    do
      value = createHash("sha256")
        .update(JSON.stringify([id, 1, seed, counter++]))
        .digest()
        .readUInt32BE(0);
    while (value >= limit);
    return low + (value % span);
  };
}
function shuffle<T>(items: T[], r: Random): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = r(0, i);
    [items[i], items[j]] = [items[j]!, items[i]!];
  }
  return items;
}
const pick = <T>(r: Random, items: readonly T[]) =>
  items[r(0, items.length - 1)]!;

// ------------------------------------------------------- one-step equations
const letters = ["x", "n", "y", "m", "k", "t", "w"] as const;
type OneStepForm = "add" | "sub" | "mul" | "div";

/** A positive value in the chosen number system; fractions are never whole. */
function value(r: Random, mode: Mode, max: number): Rational {
  if (mode === "whole") return q(r(1, max));
  if (mode === "decimal") {
    const scale = r(0, 1) ? 10 : 100;
    let n: number;
    do n = r(1, max * scale);
    while (n % scale === 0);
    return q(n, scale);
  }
  const d = pick(r, [2, 3, 4, 5, 6, 8, 10, 12]);
  let n: number;
  do n = r(1, 3 * d);
  while (n % d === 0);
  return q(n, d);
}

/** Subtraction or addition of fractions with the common-denominator step shown. */
function combine(a: Rational, b: Rational, op: "+" | "−", mode: Mode) {
  const result = op === "+" ? add(a, b) : sub(a, b);
  const head = `${show(a, mode)} ${op} ${show(b, mode)}`;
  if (mode !== "fraction" || a.d === b.d || isInteger(a) || isInteger(b))
    return `${head} = ${show(result, mode)}`;
  const L = lcm(a.d, b.d);
  const an = a.n * (L / a.d),
    bn = b.n * (L / b.d),
    rn = op === "+" ? an + bn : an - bn;
  const raw = `${rn < 0 ? "−" : ""}${Math.abs(rn)}/${L}`;
  return `${head} = ${an}/${L} ${op} ${bn}/${L} = ${raw}${raw === show(result, mode) ? "" : ` = ${show(result, mode)}`}`;
}

function oneStepCase(r: Random): Case {
  const form = pick<OneStepForm>(r, ["add", "sub", "mul", "div"]);
  const roll = r(0, 4);
  const mode: Mode = roll <= 2 ? "whole" : roll === 3 ? "decimal" : "fraction";
  const v = pick(r, letters);
  let equation: string, x: Rational;
  const explanation: string[] = [];
  let hint: string;
  let commuted = false;
  if (form === "add" || form === "sub") {
    let p: Rational, other: Rational;
    do {
      p = value(r, mode, mode === "whole" ? 95 : 20);
      other = value(r, mode, mode === "whole" ? 95 : 20);
    } while (
      mode === "fraction" &&
      lcm(p.d, other.d) > 24 // keep common denominators manageable
    );
    if (form === "add") {
      x = other;
      const total = add(x, p);
      commuted = r(0, 3) === 0;
      equation = commuted
        ? `${show(p, mode)} + ${v} = ${show(total, mode)}`
        : `${v} + ${show(p, mode)} = ${show(total, mode)}`;
      explanation.push(
        `The equation says that adding ${show(p, mode)} to ${v} gives ${show(total, mode)}. Subtraction undoes addition, so subtract ${show(p, mode)} from both sides. Taking the same amount from two equal amounts leaves equal amounts.`,
        `${v} = ${combine(total, p, "−", mode)}.`,
        `Check: ${combine(x, p, "+", mode)}.`,
      );
      hint = `Subtract ${show(p, mode)} from both sides so that ${v} is alone on one side.`;
    } else {
      const result = other;
      x = add(result, p);
      equation = `${v} − ${show(p, mode)} = ${show(result, mode)}`;
      explanation.push(
        `The equation says that taking ${show(p, mode)} away from ${v} leaves ${show(result, mode)}. Addition undoes subtraction, so add ${show(p, mode)} to both sides. Adding the same amount to two equal amounts keeps them equal.`,
        `${v} = ${combine(result, p, "+", mode)}.`,
        `Check: ${combine(x, p, "−", mode)}.`,
      );
      hint = `Add ${show(p, mode)} to both sides so that ${v} is alone on one side.`;
    }
  } else if (form === "mul") {
    const p = r(2, 12);
    let total: Rational;
    if (mode === "whole") {
      x = q(r(2, 25));
      total = mul(x, q(p));
    } else if (mode === "decimal") {
      x = value(r, "decimal", 12);
      total = mul(x, q(p));
    } else {
      // The fraction appears in the equation, so the number system is visible.
      total = value(r, "fraction", 4);
      x = div(total, q(p));
    }
    equation = `${p}${v} = ${show(total, mode)}`;
    const quotient =
      mode === "fraction"
        ? `${show(total, mode)} ÷ ${p} = ${total.n}/${total.d * p}${q(total.n, total.d * p).d === total.d * p ? "" : ` = ${show(x, mode)}`}`
        : `${show(total, mode)} ÷ ${p} = ${show(x, mode)}`;
    explanation.push(
      `${p}${v} means ${p} × ${v}. Division undoes multiplication, so divide both sides by ${p}. Dividing two equal amounts into ${p} equal parts gives equal parts.`,
      `${v} = ${quotient}.`,
      `Check: ${p} × ${show(x, mode)} = ${show(total, mode)}.`,
    );
    hint = `${p}${v} means ${p} × ${v}. Divide both sides by ${p}.`;
  } else {
    const p = r(2, 12);
    const quotient =
      mode === "whole"
        ? q(r(2, 20))
        : mode === "decimal"
          ? value(r, "decimal", 9)
          : value(r, "fraction", 4);
    x = mul(quotient, q(p));
    equation = `${v} ÷ ${p} = ${show(quotient, mode)}`;
    const product =
      mode === "fraction"
        ? `${show(quotient, mode)} × ${p} = ${quotient.n * p}/${quotient.d}${q(quotient.n * p, quotient.d).d === quotient.d ? "" : ` = ${show(x, mode)}`}`
        : `${show(quotient, mode)} × ${p} = ${show(x, mode)}`;
    explanation.push(
      `The equation says that ${v} divided into ${p} equal parts gives ${show(quotient, mode)}. Multiplication undoes division, so multiply both sides by ${p}.`,
      `${v} = ${product}.`,
      `Check: ${show(x, mode)} ÷ ${p} = ${show(quotient, mode)}.`,
    );
    hint = `Multiply both sides by ${p} so that ${v} is alone on one side.`;
  }
  return {
    prompt: `Solve for ${v}: ${equation}.`,
    kind: mode === "fraction" ? "fraction" : "number",
    label: `Value of ${v}`,
    answer: answerText(x, mode),
    explanation,
    hint,
    tags: [form, mode, ...(commuted ? ["commuted"] : [])],
  };
}

// --------------------------------------------------- one-step story choice
type Story = {
  key: string;
  form: OneStepForm;
  v: string;
  text: (p: number, q: number) => string;
};
const oneStepStories: Story[] = [
  {
    key: "stickers",
    form: "add",
    v: "s",
    text: (p, total) =>
      `A class had some stickers. The teacher added ${p} more, and now the class has ${total} stickers. Let $s$ be the number of stickers the class had at first.`,
  },
  {
    key: "water",
    form: "add",
    v: "d",
    text: (p, total) =>
      `Rain raised the water in a barrel by ${p} centimeters. The water is now ${total} centimeters deep. Let $d$ be the depth before the rain, in centimeters.`,
  },
  {
    key: "muffins",
    form: "sub",
    v: "m",
    text: (p, left) =>
      `A bakery sold ${p} muffins in the morning and had ${left} muffins left. Let $m$ be the number of muffins the bakery had at the start.`,
  },
  {
    key: "ribbon",
    form: "sub",
    v: "r",
    text: (p, left) =>
      `A ${p}-centimeter piece was cut from a ribbon, leaving ${left} centimeters. Let $r$ be the ribbon's original length, in centimeters.`,
  },
  {
    key: "tickets",
    form: "mul",
    v: "t",
    text: (p, total) =>
      `Museum tickets cost ${p} dollars each. A class paid ${total} dollars for tickets. Let $t$ be the number of tickets the class bought.`,
  },
  {
    key: "chairs",
    form: "mul",
    v: "r",
    text: (p, total) =>
      `A hall has ${total} chairs set out in rows of ${p}. Let $r$ be the number of rows.`,
  },
  {
    key: "pencils",
    form: "div",
    v: "n",
    text: (p, each) =>
      `A box of pencils is shared equally among ${p} students, and each student gets ${each} pencils. Let $n$ be the number of pencils in the box.`,
  },
  {
    key: "rope",
    form: "div",
    v: "L",
    text: (p, each) =>
      `A rope is cut into ${p} pieces of equal length. Each piece is ${each} meters long. Let $L$ be the length of the rope, in meters.`,
  },
];

function oneStepStoryCase(r: Random): Case {
  const story = pick(r, oneStepStories);
  const { form, v } = story;
  let p: number, given: number, solution: number, other: number;
  let equation: string, wrong: string, meaning: string, inverse: string;
  if (form === "add") {
    p = r(3, 60);
    solution = r(5, 90);
    given = solution + p;
    other = given + p;
    equation = `${v} + ${p} = ${given}`;
    wrong = `${v} − ${p} = ${given}`;
    meaning = `${p} is added to the unknown amount`;
    inverse = `subtract ${p} from both sides: ${v} = ${given} − ${p} = ${solution}`;
  } else if (form === "sub") {
    p = r(3, 40);
    given = r(p + 2, 90);
    solution = given + p;
    other = given - p;
    equation = `${v} − ${p} = ${given}`;
    wrong = `${v} + ${p} = ${given}`;
    meaning = `${p} is taken away from the unknown amount`;
    inverse = `add ${p} to both sides: ${v} = ${given} + ${p} = ${solution}`;
  } else if (form === "mul") {
    p = r(2, 12);
    solution = r(2, 15);
    given = p * solution;
    other = given * p;
    equation = `${p}${v} = ${given}`;
    wrong = `${v} ÷ ${p} = ${given}`;
    meaning = `the unknown number of groups of ${p} makes ${given}`;
    inverse = `divide both sides by ${p}: ${v} = ${given} ÷ ${p} = ${solution}`;
  } else {
    p = r(2, 9);
    const k = r(2, 9);
    given = p * k;
    solution = given * p;
    other = k;
    equation = `${v} ÷ ${p} = ${given}`;
    wrong = `${p}${v} = ${given}`;
    meaning = `the unknown amount divided into ${p} equal parts gives ${given}`;
    inverse = `multiply both sides by ${p}: ${v} = ${given} × ${p} = ${solution}`;
  }
  const label = (e: string, s: number) => `${e}; ${v} = ${s}`;
  const candidates: Candidate[] = [
    { label: label(equation, solution), correct: true },
    {
      label: label(equation, other),
      correct: false,
      feedback: `The equation matches the story, but ${v} = ${other} does not solve it. Use the inverse operation: ${inverse}.`,
    },
    {
      label: label(wrong, other),
      correct: false,
      feedback: `${wrong} does not match the story, because ${meaning}. The equation is ${equation}.`,
    },
    {
      label: label(wrong, solution),
      correct: false,
      feedback: `${wrong} does not match the story, and ${solution} does not solve it. In the story ${meaning}, so the equation is ${equation}.`,
    },
  ];
  return {
    prompt: `${story.text(p, given)} Which equation represents the situation, and what is its solution?`,
    kind: "choice",
    label: "Choose the equation and its solution",
    candidates,
    explanation: [
      `In the story, ${meaning}. The equation is ${equation}.`,
      `To find ${v}, ${inverse}.`,
      `Check: ${
        form === "add"
          ? `${solution} + ${p} = ${given}`
          : form === "sub"
            ? `${solution} − ${p} = ${given}`
            : form === "mul"
              ? `${p} × ${solution} = ${given}`
              : `${solution} ÷ ${p} = ${given}`
      }.`,
    ],
    hint: `In the story, ${meaning}. Write that operation on ${v}, then undo it to find ${v}.`,
    tags: [story.key, form],
  };
}

// ----------------------------------------------------------------- balances
type Balance = Extract<SemanticFigure, { kind: "balance-scale" }>;

function balanceCase(r: Random, twoStep: boolean): Case {
  let groups = 1,
    blocks: number,
    units: number,
    x: number,
    right: number;
  let form: string;
  if (!twoStep) {
    if (r(0, 1)) {
      form = "add";
      blocks = 1;
      do {
        units = r(1, 12);
        x = r(1, 14);
      } while (x + units > 24);
    } else {
      form = "mul";
      units = 0;
      do {
        blocks = r(2, 5);
        x = r(2, 7);
      } while (blocks * x > 30);
    }
  } else if (r(0, 2)) {
    form = "plain";
    do {
      blocks = r(2, 4);
      units = r(1, 9);
      x = r(1, 6);
    } while (blocks * x + units > 30);
  } else {
    form = "grouped";
    blocks = 1;
    do {
      groups = r(2, 3);
      units = r(1, 4);
      x = r(1, 6);
    } while (groups * (x + units) > 30);
  }
  right = groups * (blocks * x + units);
  const figure: Balance = {
    kind: "balance-scale",
    groups,
    blocks,
    units,
    right,
  };
  const prompt =
    groups > 1
      ? `The balance is level. The left pan holds ${groups} identical bags, and each bag holds one $x$ block and ${units} ${units === 1 ? "cube" : "cubes"}. The right pan holds ${right} cubes. Each cube weighs 1 gram. How many grams does one $x$ block weigh?`
      : `The balance is level. Every block labeled $x$ has the same weight, and each small cube weighs 1 gram. How many grams does one $x$ block weigh?`;
  const cubes = (n: number) => `${n} ${n === 1 ? "cube" : "cubes"}`;
  const explanation: string[] = [];
  let hint: string;
  if (form === "add") {
    explanation.push(
      `The left pan holds one $x$ block and ${cubes(units)}; the right pan holds ${cubes(right)}. Level pans mean equal weights: x + ${units} = ${right}.`,
      `Remove ${cubes(units)} from each pan. Equal weights taken from both pans keep the balance level: x = ${right} − ${units} = ${x}.`,
      `Check: ${x} + ${units} = ${right}.`,
    );
    hint = `Take the same number of cubes off both pans until the $x$ block is alone.`;
  } else if (form === "mul") {
    explanation.push(
      `The left pan holds ${blocks} $x$ blocks; the right pan holds ${cubes(right)}. Level pans mean equal weights: ${blocks}x = ${right}.`,
      `Split each pan into ${blocks} equal groups. One group on the left is one $x$ block, and it balances one group on the right: x = ${right} ÷ ${blocks} = ${x}.`,
      `Check: ${blocks} × ${x} = ${right}.`,
    );
    hint = `Split both pans into ${blocks} equal groups, one $x$ block in each group on the left.`;
  } else if (form === "plain") {
    explanation.push(
      `The left pan holds ${blocks} $x$ blocks and ${cubes(units)}; the right pan holds ${cubes(right)}. Level pans mean equal weights: ${blocks}x + ${units} = ${right}.`,
      `Remove ${cubes(units)} from each pan. The balance stays level: ${blocks}x = ${right} − ${units} = ${right - units}.`,
      `Split each pan into ${blocks} equal groups. One $x$ block balances one group: x = ${right - units} ÷ ${blocks} = ${x}.`,
      `Check: ${blocks} × ${x} + ${units} = ${right}.`,
    );
    hint = `First remove the loose cubes from both pans. Then split both pans into ${blocks} equal groups.`;
  } else {
    const each = right / groups;
    explanation.push(
      `Each bag weighs x + ${units}, and there are ${groups} bags: ${groups}(x + ${units}) = ${right}.`,
      `Split each pan into ${groups} equal groups. One bag balances ${right} ÷ ${groups} = ${each} cubes: x + ${units} = ${each}.`,
      `Remove ${cubes(units)} from each side of that smaller balance: x = ${each} − ${units} = ${x}.`,
      `Check: ${groups} × (${x} + ${units}) = ${groups} × ${each} = ${right}.`,
    );
    hint = `Split both pans into ${groups} equal groups, one bag in each. Then remove the cubes that are in the bag.`;
  }
  return {
    prompt,
    figure,
    kind: "number",
    label: "Weight of one $x$ block, in grams",
    answer: String(x),
    explanation,
    hint,
    tags: [form],
  };
}

// --------------------------------------------------- two-step symbolic solve
const term = (p: Rational, v: string, mode: Mode = "whole") =>
  p.n === 1 && p.d === 1
    ? v
    : p.n === -1 && p.d === 1
      ? `−${v}`
      : `${show(p, mode)}${v}`;
const signed = (c: Rational, mode: Mode = "whole") =>
  `${c.n < 0 ? "−" : "+"} ${show(q(Math.abs(c.n), c.d), mode)}`;

function twoStepCase(r: Random): Case {
  const roll = r(0, 7);
  const form = roll <= 3 ? "plain" : roll <= 6 ? "grouped" : "decimal";
  const v = pick(r, letters);
  const nz = (max: number) => r(1, max) * (r(0, 1) ? 1 : -1);
  let x: Rational;
  let equation: string;
  const explanation: string[] = [];
  let hint: string;
  const tags: string[] = [form];
  if (form === "grouped") {
    let p: number, c: number, xi: number;
    do {
      p = nz(9);
      c = nz(12);
      xi = r(-12, 12);
    } while (Math.abs(p) < 2 || xi + c === 0);
    x = q(xi);
    const inner = q(xi + c),
      right = q(p * (xi + c));
    equation = `${p < 0 ? "−" : ""}${Math.abs(p)}(${v} ${signed(q(c))}) = ${show(right, "whole")}`;
    explanation.push(
      `The parentheses are multiplied by ${show(q(p), "whole")}. Undo that last operation first: divide both sides by ${show(q(p), "whole")}. ${v} ${signed(q(c))} = ${show(right, "whole")} ÷ ${operand(q(p))} = ${show(inner, "whole")}.`,
      `${c > 0 ? `Subtract ${c} from` : `Add ${-c} to`} both sides: ${v} = ${show(inner, "whole")} ${c > 0 ? "−" : "+"} ${Math.abs(c)} = ${show(x, "whole")}.`,
      `Check: ${show(q(p), "whole")} × (${show(x, "whole")} ${signed(q(c))}) = ${show(q(p), "whole")} × ${operand(inner)} = ${show(right, "whole")}.`,
    );
    hint = `Divide both sides by ${show(q(p), "whole")} first, then undo the ${c > 0 ? "addition" : "subtraction"} inside the parentheses.`;
    tags.push(p < 0 ? "negative-coefficient" : "positive-coefficient");
  } else {
    const mode: Mode = form === "decimal" ? "decimal" : "whole";
    let p: Rational, c: Rational, xi: number;
    if (form === "decimal") {
      p = pick(r, [
        q(1, 2),
        q(3, 2),
        q(5, 2),
        q(1, 5),
        q(2, 5),
        q(6, 5),
        q(5, 4),
        q(3, 4),
      ]);
      if (r(0, 3) === 0) p = q(-p.n, p.d);
      c = q(nz(95), 10);
      // A whole-number product px keeps the decimal arithmetic short.
      do xi = r(-10, 10);
      while (xi === 0 || !Number.isInteger((xi * p.n) / p.d));
    } else {
      let pi: number;
      do pi = nz(9);
      while (Math.abs(pi) < 2);
      p = q(pi);
      c = q(nz(15));
      do xi = r(-12, 12);
      while (xi === 0);
    }
    x = q(xi);
    const right = add(mul(p, x), c);
    const constantFirst = form === "plain" && r(0, 3) === 0;
    equation = constantFirst
      ? `${show(c, mode)} ${p.n < 0 ? "−" : "+"} ${term(q(Math.abs(p.n), p.d), v, mode)} = ${show(right, mode)}`
      : `${term(p, v, mode)} ${signed(c, mode)} = ${show(right, mode)}`;
    const moved = sub(right, c);
    explanation.push(
      `${c.n > 0 ? `Subtract ${show(c, mode)} from` : `Add ${show(q(-c.n, c.d), mode)} to`} both sides to undo the ${c.n > 0 ? "addition" : "subtraction"}: ${term(p, v, mode)} = ${show(right, mode)} ${c.n > 0 ? "−" : "+"} ${show(q(Math.abs(c.n), c.d), mode)} = ${show(moved, mode)}.`,
      `${term(p, v, mode)} means ${operand(p, mode)} × ${v}. Divide both sides by ${show(p, mode)}: ${v} = ${show(moved, mode)} ÷ ${operand(p, mode)} = ${show(x, mode)}.`,
      `Check: ${operand(p, mode)} × ${operand(x, mode)} ${signed(c, mode)} = ${show(mul(p, x), mode)} ${signed(c, mode)} = ${show(right, mode)}.`,
    );
    hint = `Undo the ${c.n > 0 ? "addition" : "subtraction"} first by ${c.n > 0 ? "subtracting" : "adding"} ${show(q(Math.abs(c.n), c.d), mode)} on both sides; then divide both sides by ${show(p, mode)}.`;
    tags.push(
      p.n < 0 ? "negative-coefficient" : "positive-coefficient",
      ...(constantFirst ? ["constant-first"] : []),
    );
  }
  tags.push(x.n < 0 ? "negative-solution" : "positive-solution");
  return {
    prompt: `Solve for ${v}: ${equation}.`,
    kind: "number",
    label: `Value of ${v}`,
    answer: answerText(x, "whole"),
    explanation,
    hint,
    tags,
  };
}

// ---------------------------------------------------- two-step story models
type Model = "plain" | "decreasing" | "grouped" | "grouped-minus";
const capitalize = (text: string) => text[0]!.toUpperCase() + text.slice(1);
type TwoStepStory = {
  key: string;
  model: Model;
  v: string;
  story: string;
  define: string;
  question: string;
  label: string;
  unit: string;
  /** Equation coefficients as displayed (cents become dollars). */
  p: Rational;
  c: Rational;
  r: Rational;
  x: number;
  mode: Mode;
  /** What p and c mean in the story, for explanations and feedback. */
  pMeaning: string;
  cMeaning: string;
  /** The quantities' relationship in words, read straight into the equation. */
  relation: string;
};

function twoStepStory(r: Random): TwoStepStory {
  const kind = r(0, 6);
  if (kind === 0) {
    const fee = r(15, 60),
      rate = r(8, 30),
      x = r(2, 12);
    return {
      key: "gym",
      model: "plain",
      v: "m",
      story: `A gym charges a ${fee}-dollar sign-up fee plus ${rate} dollars per month. Ravi has paid ${rate * x + fee} dollars in all.`,
      define: "Let $m$ be the number of months Ravi has paid for.",
      question: "For how many months has Ravi paid?",
      label: "Number of months",
      unit: "months",
      p: q(rate),
      c: q(fee),
      r: q(rate * x + fee),
      x,
      relation: `The total paid is ${rate} dollars for each of $m$ months plus the ${fee}-dollar fee`,
      mode: "whole",
      pMeaning: `${rate} dollars is paid once for each month`,
      cMeaning: `the ${fee}-dollar fee is paid once`,
    };
  }
  if (kind === 1) {
    const saved = r(10, 80),
      rate = r(5, 25),
      x = r(2, 15);
    return {
      key: "savings",
      model: "plain",
      v: "w",
      story: `Mia has ${saved} dollars saved and adds ${rate} dollars each week. She wants to have ${saved + rate * x} dollars.`,
      define: "Let $w$ be the number of weeks until Mia has that amount.",
      question: `After how many weeks will Mia have exactly ${saved + rate * x} dollars?`,
      label: "Number of weeks",
      unit: "weeks",
      p: q(rate),
      c: q(saved),
      r: q(saved + rate * x),
      x,
      relation: `The amount saved is ${rate} dollars for each of $w$ weeks plus the ${saved} dollars already saved`,
      mode: "whole",
      pMeaning: `${rate} dollars is added once for each week`,
      cMeaning: `the ${saved} dollars are already saved at the start`,
    };
  }
  if (kind === 2) {
    const start = pick(r, [250, 300, 350, 400]),
      rate = pick(r, [125, 150, 175, 200, 225, 250, 275]),
      x = r(2, 15);
    const total = start + rate * x;
    return {
      key: "taxi",
      model: "plain",
      v: "d",
      story: `A taxi ride costs ${dollars(start)} to start plus ${dollars(rate)} for each mile. Ana's ride cost ${dollars(total)}.`,
      define: "Let $d$ be the number of miles Ana rode.",
      question: "How many miles did Ana ride?",
      label: "Number of miles",
      unit: "miles",
      p: q(rate, 100),
      c: q(start, 100),
      r: q(total, 100),
      x,
      relation: `The cost is ${dollars(rate)} for each of $d$ miles plus the starting charge of ${dollars(start)}`,
      mode: "decimal",
      pMeaning: `${dollars(rate)} is charged once for each mile`,
      cMeaning: `the starting charge of ${dollars(start)} is paid once`,
    };
  }
  if (kind === 3) {
    const rate = r(2, 15),
      x = r(2, 12),
      left = r(5, 60);
    const full = left + rate * x;
    return {
      key: "tank",
      model: "decreasing",
      v: "t",
      story: `A tank holds ${full} liters of water. It drains ${rate} liters each minute until it holds ${left} liters.`,
      define: "Let $t$ be the number of minutes the tank drains.",
      question: `After how many minutes does the tank hold ${left} liters?`,
      label: "Number of minutes",
      unit: "minutes",
      p: q(rate),
      c: q(full),
      r: q(left),
      x,
      relation: `The water left is the ${full} liters at the start minus ${rate} liters for each of $t$ minutes`,
      mode: "whole",
      pMeaning: `${rate} liters drain out once for each minute`,
      cMeaning: `the tank starts with ${full} liters`,
    };
  }
  if (kind === 4) {
    const friends = r(2, 6),
      snack = r(2, 8),
      x = r(6, 15);
    return {
      key: "tickets",
      model: "grouped",
      v: "c",
      story: `Each of ${friends} friends buys one movie ticket and one ${snack}-dollar snack. Together they spend ${friends * (x + snack)} dollars.`,
      define: "Let $c$ be the cost of one ticket, in dollars.",
      question: "What does one ticket cost, in dollars?",
      label: "Cost of one ticket, in dollars",
      unit: "dollars",
      p: q(friends),
      c: q(snack),
      r: q(friends * (x + snack)),
      x,
      relation: `Each friend spends c + ${snack} dollars, and ${friends} friends spend ${friends} times that amount`,
      mode: "whole",
      pMeaning: `each of the ${friends} friends pays for a ticket and a snack`,
      cMeaning: `each friend's snack costs ${snack} dollars`,
    };
  }
  if (kind === 5) {
    const length = r(5, 30);
    let x: number;
    do x = r(2, 25);
    while (x === length);
    return {
      key: "perimeter",
      model: "grouped",
      v: "w",
      story: `A rectangle has a perimeter of ${2 * (x + length)} centimeters. Its length is ${length} centimeters.`,
      define: "Let $w$ be the rectangle's width, in centimeters.",
      question: "What is the rectangle's width, in centimeters?",
      label: "Width, in centimeters",
      unit: "centimeters",
      p: q(2),
      c: q(length),
      r: q(2 * (x + length)),
      x,
      relation: `The perimeter is two widths plus two lengths, which is 2 times (w + ${length})`,
      mode: "whole",
      pMeaning:
        "the perimeter goes around the rectangle, using each length and each width twice",
      cMeaning: `each length is ${length} centimeters`,
    };
  }
  const off = r(3, 12),
    shirts = r(2, 6),
    x = r(off + 4, off + 25);
  return {
    key: "sale",
    model: "grouped-minus",
    v: "s",
    story: `In a sale, every shirt is ${off} dollars off its regular price. Jo buys ${shirts} shirts at the sale price and pays ${shirts * (x - off)} dollars.`,
    define: "Let $s$ be the regular price of one shirt, in dollars.",
    question: "What is the regular price of one shirt, in dollars?",
    label: "Regular price, in dollars",
    unit: "dollars",
    p: q(shirts),
    c: q(off),
    r: q(shirts * (x - off)),
    x,
    relation: `Each shirt costs s − ${off} dollars at the sale price, and ${shirts} shirts cost ${shirts} times that amount`,
    mode: "whole",
    pMeaning: `Jo pays the sale price once for each of ${shirts} shirts`,
    cMeaning: `each shirt's price is reduced by ${off} dollars`,
  };
}

/** Display text and solution of the story's equation shapes. */
function shape(
  model: Model | "swap" | "minus" | "plus",
  s: TwoStepStory,
  p = s.p,
  c = s.c,
): { text: string; solution: Rational } {
  const m = s.mode,
    v = s.v,
    P = show(p, m),
    C = show(c, m),
    R = show(s.r, m);
  switch (model) {
    case "plain":
      return { text: `${P}${v} + ${C} = ${R}`, solution: div(sub(s.r, c), p) };
    case "minus":
      return { text: `${P}${v} − ${C} = ${R}`, solution: div(add(s.r, c), p) };
    case "decreasing":
      return { text: `${C} − ${P}${v} = ${R}`, solution: div(sub(c, s.r), p) };
    case "plus":
      return { text: `${C} + ${P}${v} = ${R}`, solution: div(sub(s.r, c), p) };
    case "grouped":
      return {
        text: `${P}(${v} + ${C}) = ${R}`,
        solution: sub(div(s.r, p), c),
      };
    case "grouped-minus":
      return {
        text: `${P}(${v} − ${C}) = ${R}`,
        solution: add(div(s.r, p), c),
      };
    case "swap":
      return { text: `${P}${v} + ${C} = ${R}`, solution: div(sub(s.r, c), p) };
  }
}
function storyDistractors(s: TwoStepStory) {
  const swap = (model: Model) => shape(model, s, s.c, s.p);
  switch (s.model) {
    case "plain":
      return [
        { ...swap("plain"), why: `${s.pMeaning}, and ${s.cMeaning}` },
        { ...shape("grouped", s), why: `${s.cMeaning}, not once per unit` },
        { ...shape("minus", s), why: `${s.cMeaning}, so it is added` },
      ];
    case "decreasing":
      return [
        { ...shape("plus", s), why: `water drains out, so it is subtracted` },
        {
          ...shape("minus", s),
          why: `${s.cMeaning}, and the drained water is subtracted from that amount`,
        },
        {
          text: `${show(s.p, s.mode)} − ${show(s.c, s.mode)}${s.v} = ${show(s.r, s.mode)}`,
          solution: div(sub(s.p, s.r), s.c),
          why: `${s.pMeaning}, and ${s.cMeaning}`,
        },
      ];
    case "grouped":
      return [
        { ...shape("plain", s), why: `${s.pMeaning}` },
        { ...swap("grouped"), why: `${s.pMeaning}, and ${s.cMeaning}` },
        { ...shape("grouped-minus", s), why: `${s.cMeaning}, so it is added` },
      ];
    case "grouped-minus":
      return [
        { ...shape("minus", s), why: `${s.pMeaning}` },
        { ...shape("grouped", s), why: `${s.cMeaning}, so it is subtracted` },
        { ...swap("grouped-minus"), why: `${s.pMeaning}, and ${s.cMeaning}` },
      ];
  }
}
const sameRational = (a: Rational, b: Rational) => a.n === b.n && a.d === b.d;

function storyExplanation(s: TwoStepStory, equation: string) {
  const m = s.mode,
    P = show(s.p, m),
    C = show(s.c, m),
    R = show(s.r, m),
    X = String(s.x),
    v = s.v;
  const steps = [`${s.define} ${s.relation}: ${equation}.`];
  if (s.model === "plain") {
    const rest = sub(s.r, s.c);
    steps.push(
      `Subtract ${C} from both sides: ${P}${v} = ${R} − ${C} = ${show(rest, m)}.`,
      `Divide both sides by ${P}: ${v} = ${show(rest, m)} ÷ ${P} = ${X}.`,
      `Check: ${P} × ${X} + ${C} = ${show(mul(s.p, q(s.x)), m)} + ${C} = ${R}.`,
    );
  } else if (s.model === "decreasing") {
    const drained = sub(s.c, s.r);
    steps.push(
      `Add ${P}${v} to both sides and subtract ${R} from both sides: ${P}${v} = ${C} − ${R} = ${show(drained, m)}.`,
      `Divide both sides by ${P}: ${v} = ${show(drained, m)} ÷ ${P} = ${X}.`,
      `Check: ${C} − ${P} × ${X} = ${C} − ${show(mul(s.p, q(s.x)), m)} = ${R}.`,
    );
  } else {
    const each = div(s.r, s.p);
    const plus = s.model === "grouped";
    steps.push(
      `Divide both sides by ${P}: ${v} ${plus ? "+" : "−"} ${C} = ${R} ÷ ${P} = ${show(each, m)}.`,
      `${plus ? `Subtract ${C} from` : `Add ${C} to`} both sides: ${v} = ${show(each, m)} ${plus ? "−" : "+"} ${C} = ${X}.`,
      `Check: ${P} × (${X} ${plus ? "+" : "−"} ${C}) = ${P} × ${show(each, m)} = ${R}.`,
    );
  }
  return steps;
}

function twoStepWordCase(r: Random): Case {
  const s = twoStepStory(r);
  const equation = shape(s.model, s).text;
  return {
    prompt: `${s.story} ${s.question}`,
    kind: "number",
    label: s.label,
    answer: String(s.x),
    explanation: storyExplanation(s, equation),
    hint: `${capitalize(s.pMeaning)}, and ${s.cMeaning}. Write one equation in ${s.v} for the total ${show(s.r, s.mode)}, then undo its steps in reverse order.`,
    tags: [s.key, s.model, s.mode],
  };
}

function twoStepModelCase(r: Random): Case {
  let s: TwoStepStory, wrong: ReturnType<typeof storyDistractors>;
  const correct = () => shape(s.model, s);
  // Every distractor must have a different solution, so no wrong equation also finds the value.
  do {
    s = twoStepStory(r);
    wrong = storyDistractors(s);
  } while (
    sameRational(s.p, s.c) ||
    wrong.some(
      (w) =>
        sameRational(w.solution, correct().solution) ||
        w.text === correct().text,
    ) ||
    new Set(wrong.map((w) => w.text)).size !== wrong.length
  );
  const right = correct();
  const candidates: Candidate[] = [
    { label: right.text, correct: true },
    ...wrong.map((w) => ({
      label: w.text,
      correct: false,
      feedback: `This equation does not match the story: ${w.why}. The equation is ${right.text}, which gives ${s.v} = ${s.x}.`,
    })),
  ];
  return {
    prompt: `${s.story} ${s.define} Which equation can be used to find ${s.v}?`,
    kind: "choice",
    label: "Choose the equation",
    candidates,
    explanation: storyExplanation(s, right.text),
    hint: `${capitalize(s.pMeaning)}, and ${s.cMeaning}. Find the equation where the repeated amount multiplies ${s.model === "grouped" || s.model === "grouped-minus" ? `a group containing ${s.v}` : s.v} and the result is ${show(s.r, s.mode)}.`,
    tags: [s.key, s.model, s.mode],
  };
}

// --------------------------------------------------------- simple inequalities
type InequalityLines = Extract<SemanticFigure, { kind: "inequality-lines" }>;
const words: Record<Relation, string> = {
  ">": "greater than",
  "<": "less than",
  "≥": "greater than or equal to",
  "≤": "less than or equal to",
};
const relations: Relation[] = [">", "<", "≥", "≤"];
const holds = (value: Rational, op: Relation, c: number) => {
  const left = value.n,
    right = c * value.d;
  return op === ">"
    ? left > right
    : op === "<"
      ? left < right
      : op === "≥"
        ? left >= right
        : left <= right;
};
const pointsRight = (op: Relation) => op === ">" || op === "≥";
const inclusive = (op: Relation) => op === "≥" || op === "≤";
const relationOf = (right: boolean, included: boolean): Relation =>
  right ? (included ? "≥" : ">") : included ? "≤" : "<";
const int = (n: number) => (n < 0 ? `−${-n}` : String(n));

type Condition = {
  key: string;
  op: Relation;
  v: string;
  low: number;
  high: number;
  quote: (c: number) => string;
  text: (c: number) => string;
};
const conditions: Condition[] = [
  {
    key: "ride",
    quote: (c) => `taller than ${c} inches`,
    op: ">",
    v: "h",
    low: 40,
    high: 54,
    text: (c) =>
      `A ride admits only riders taller than ${c} inches. Let $h$ be the height of a rider the ride admits, in inches.`,
  },
  {
    key: "shipping",
    quote: (c) => `more than ${c} dollars`,
    op: ">",
    v: "t",
    low: 20,
    high: 60,
    text: (c) =>
      `An order ships free only when its total is more than ${c} dollars. Let $t$ be the total of an order that ships free, in dollars.`,
  },
  {
    key: "warm",
    quote: (c) => `above ${int(c)} °$C$`,
    op: ">",
    v: "t",
    low: -9,
    high: 9,
    text: (c) =>
      `All afternoon the temperature stayed above ${int(c)} °$C$. Let $t$ be an afternoon temperature, in degrees Celsius.`,
  },
  {
    key: "bridge",
    quote: (c) => `less than ${c} tons`,
    op: "<",
    v: "w",
    low: 8,
    high: 20,
    text: (c) =>
      `A bridge allows only trucks that weigh less than ${c} tons. Let $w$ be the weight of a truck the bridge allows, in tons.`,
  },
  {
    key: "freezer",
    quote: (c) => `colder than ${int(c)} °$C$`,
    op: "<",
    v: "t",
    low: -20,
    high: -5,
    text: (c) =>
      `A freezer must stay colder than ${int(c)} °$C$. Let $t$ be an allowed freezer temperature, in degrees Celsius.`,
  },
  {
    key: "bus",
    quote: (c) => `younger than ${c} years`,
    op: "<",
    v: "a",
    low: 3,
    high: 7,
    text: (c) =>
      `Children younger than ${c} years ride the bus free. Let a be the age of a child who rides free, in years.`,
  },
  {
    key: "team",
    quote: (c) => `at least ${c} players`,
    op: "≥",
    v: "p",
    low: 4,
    high: 11,
    text: (c) =>
      `A team needs at least ${c} players to start a game. Let $p$ be the number of players on a team that can start.`,
  },
  {
    key: "pass",
    quote: (c) => `${c} points or more`,
    op: "≥",
    v: "s",
    low: 60,
    high: 80,
    text: (c) =>
      `A test is passed with a score of ${c} points or more. Let $s$ be a passing score, in points.`,
  },
  {
    key: "elevator",
    quote: (c) => `at most ${c} people`,
    op: "≤",
    v: "n",
    low: 8,
    high: 16,
    text: (c) =>
      `An elevator may carry at most ${c} people. Let $n$ be the number of people on the elevator during a trip.`,
  },
  {
    key: "bag",
    quote: (c) => `no more than ${c} kilograms`,
    op: "≤",
    v: "w",
    low: 7,
    high: 23,
    text: (c) =>
      `A carry-on bag may weigh no more than ${c} kilograms. Let $w$ be the weight of an allowed bag, in kilograms.`,
  },
];

function relationFeedback(chosen: Relation, op: Relation, said: string) {
  const sameDirection = pointsRight(chosen) === pointsRight(op);
  if (sameDirection)
    return inclusive(op)
      ? `The condition “${said}” includes the boundary value itself, so the symbol must include equality: ${op}.`
      : `The condition “${said}” excludes the boundary value itself, so the symbol must not include equality: ${op}.`;
  return `This points the wrong way: “${said}” describes values ${pointsRight(op) ? "greater" : "less"} than the boundary, so use ${op}.`;
}

function contextCase(r: Random): Case {
  const cond = pick(r, conditions);
  const c = r(cond.low, cond.high);
  const v = cond.v,
    op = cond.op;
  const candidates = relations.map((rel) => ({
    label: `${v} ${rel} ${int(c)}`,
    correct: rel === op,
    ...(rel === op
      ? {}
      : { feedback: relationFeedback(rel, op, cond.quote(c)) }),
  }));
  return {
    prompt: `${cond.text(c)} Which inequality describes all possible values of ${v}?`,
    kind: "choice",
    label: "Choose the inequality",
    candidates,
    explanation: [
      `The condition “${cond.quote(c)}” describes values ${words[op]} ${int(c)}. On a number line they lie ${pointsRight(op) ? "to the right of" : "to the left of"} ${int(c)}, and ${int(c)} itself is ${inclusive(op) ? "allowed" : "not allowed"}.`,
      `So ${v} ${op} ${int(c)}.`,
    ],
    hint: `The condition is “${cond.quote(c)}”. Does it allow values greater or less than ${int(c)}, and does it allow ${int(c)} itself?`,
    tags: [cond.key, `operator:${op}`, c < 0 ? "negative" : "nonnegative"],
  };
}

/** A ten-unit window that contains the boundary at an uneven position. */
function window(r: Random, c: number) {
  const min = c - r(2, 8);
  return { min, max: min + 10 };
}
function lineDescription(op: Relation, c: number) {
  return `${inclusive(op) ? "a filled circle" : "an open circle"} at ${int(c)} and a thick ray ${pointsRight(op) ? "to the right" : "to the left"}`;
}

function numberLineReadCase(r: Random): Case {
  const op = pick(r, relations);
  const c = r(-9, 12);
  const figure: InequalityLines = {
    kind: "inequality-lines",
    ...window(r, c),
    lines: [
      {
        boundary: c,
        direction: pointsRight(op) ? "right" : "left",
        included: inclusive(op),
      },
    ],
  };
  const candidates = relations.map((rel) => ({
    label: `x ${rel} ${int(c)}`,
    correct: rel === op,
    ...(rel === op
      ? {}
      : {
          feedback:
            pointsRight(rel) !== pointsRight(op)
              ? `The ray points ${pointsRight(op) ? "right, toward greater" : "left, toward lesser"} numbers, so the solutions are ${pointsRight(op) ? "greater" : "less"} than ${int(c)}.`
              : `The circle at ${int(c)} is ${inclusive(op) ? "filled, so" : "open, so"} ${int(c)} ${inclusive(op) ? "is" : "is not"} a solution: use ${op}.`,
        }),
  }));
  return {
    prompt: "Which inequality does the number line show?",
    figure,
    kind: "choice",
    label: "Choose the inequality",
    candidates,
    explanation: [
      `The graph has ${lineDescription(op, c)}.`,
      `The ray covers every number ${pointsRight(op) ? "greater" : "less"} than ${int(c)}. ${inclusive(op) ? `The filled circle means ${int(c)} is also a solution` : `The open circle means ${int(c)} is not a solution`}.`,
      `So the graph shows x ${op} ${int(c)}.`,
    ],
    hint: `The circle sits at ${int(c)}, the boundary. Is the circle open or filled, and which way does the ray point from ${int(c)}?`,
    tags: [`operator:${op}`, c < 0 ? "negative" : "nonnegative"],
  };
}

function numberLineChoiceCase(r: Random): Case {
  const op = pick(r, relations);
  const c = r(-9, 12);
  const verbal = r(0, 2) === 0;
  const lines = shuffle(
    [
      [true, true],
      [true, false],
      [false, true],
      [false, false],
    ],
    r,
  ).map(([right, included], i) => ({
    label: "ABCD"[i] as "A" | "B" | "C" | "D",
    boundary: c,
    direction: (right ? "right" : "left") as "right" | "left",
    included: included!,
  }));
  const figure: InequalityLines = {
    kind: "inequality-lines",
    ...window(r, c),
    lines,
  };
  const target = verbal
    ? `all numbers ${words[op]} ${int(c)}`
    : `the solutions of x ${op} ${int(c)}`;
  const candidates = lines.map((line) => {
    const rel = relationOf(line.direction === "right", line.included);
    return {
      label: `Number line ${line.label}`,
      correct: rel === op,
      ...(rel === op
        ? {}
        : {
            feedback: `Number line ${line.label} shows x ${rel} ${int(c)}. ${pointsRight(rel) !== pointsRight(op) ? `Its ray points the wrong way: the solutions are ${pointsRight(op) ? "greater" : "less"} than ${int(c)}.` : `Its circle is ${line.included ? "filled" : "open"}, but ${int(c)} ${inclusive(op) ? "is" : "is not"} a solution.`}`,
          }),
    };
  });
  const answer = lines.find(
    (line) => relationOf(line.direction === "right", line.included) === op,
  )!;
  return {
    prompt: `Which number line shows ${target}?`,
    figure,
    kind: "choice",
    label: "Choose the number line",
    candidates,
    fixedOrder: true,
    explanation: [
      `Every number ${words[op]} ${int(c)} is a solution of x ${op} ${int(c)}, and no other number is. The ray must point ${pointsRight(op) ? "right, toward greater numbers" : "left, toward lesser numbers"}.`,
      `${int(c)} ${inclusive(op) ? "is" : "is not"} a solution, so the circle at ${int(c)} is ${inclusive(op) ? "filled" : "open"}.`,
      `Number line ${answer.label} has ${lineDescription(op, c)}.`,
    ],
    hint: `For ${target}, first decide whether ${int(c)} itself is a solution: that sets a filled or an open circle. Then decide which way the ray points.`,
    tags: [
      `operator:${op}`,
      verbal ? "verbal" : "symbolic",
      c < 0 ? "negative" : "nonnegative",
    ],
  };
}

const tenth = (n: number) => q(n, 10);
const list = (values: Rational[]) =>
  [...values]
    .sort((a, b) => a.n * b.d - b.n * a.d)
    .map((v) => decimal(v))
    .join(", ");

function solutionSetCase(r: Random): Case {
  const op = pick(r, relations);
  const statements = r(0, 1) === 0;
  const right = pointsRight(op);
  const sign = right ? 1 : -1;
  if (statements) {
    const c = r(5, 15);
    const strictText = `Every number ${right ? "greater" : "less"} than ${c} is a solution, but ${c} is not. There are infinitely many solutions.`;
    const inclusiveText = `${c} and every number ${right ? "greater" : "less"} than ${c} are solutions. There are infinitely many solutions.`;
    const first = inclusive(op) ? c : c + sign;
    const wholeText = right
      ? `Only the whole numbers ${first}, ${first + 1}, ${first + 2} and so on are solutions.`
      : `Only the whole numbers 0, 1, 2 and so on up to ${first} are solutions.`;
    const oneText = `${first} is the only solution.`;
    const decimalExample = decimal(add(q(c), tenth(sign * 5)));
    const candidates: Candidate[] = [
      {
        label: strictText,
        correct: !inclusive(op),
        ...(inclusive(op)
          ? { feedback: `${c} ${op} ${c} is true, so ${c} is a solution too.` }
          : {}),
      },
      {
        label: inclusiveText,
        correct: inclusive(op),
        ...(inclusive(op)
          ? {}
          : {
              feedback: `${int(c)} ${op} ${int(c)} is false, so ${int(c)} is not a solution.`,
            }),
      },
      {
        label: wholeText,
        correct: false,
        feedback: `Numbers between whole numbers are solutions too: ${decimalExample} ${op} ${c} is true.`,
      },
      {
        label: oneText,
        correct: false,
        feedback: `${first} is one solution, but ${decimalExample} and ${int(c + sign * 20)} are solutions too. An inequality like this has infinitely many solutions.`,
      },
    ];
    return {
      prompt: `Which statement about the solutions of x ${op} ${c} is true?`,
      kind: "choice",
      label: "Choose the true statement",
      candidates,
      explanation: [
        `A solution is any number that makes x ${op} ${c} true. Every number ${right ? "greater" : "less"} than ${c} works, including numbers that are not whole, such as ${decimalExample}, and numbers far away, such as ${int(c + sign * 20)}.`,
        `${c} ${op} ${c} is ${inclusive(op) ? "true" : "false"}, so ${c} ${inclusive(op) ? "is" : "is not"} a solution.`,
        `Between any two solutions there are more solutions, so there are infinitely many.`,
      ],
      hint: `Test three numbers in x ${op} ${c}: ${c} itself, a number that is not whole such as ${decimalExample}, and a number far from ${c}.`,
      tags: [`operator:${op}`, "statements"],
    };
  }
  const c = r(-8, 15);
  /** Distinct values on the solution side: one near the boundary, one moderate, one far. */
  const inside = (count: number, withBoundary: boolean): Rational[] => {
    const near = add(q(c), tenth(sign * r(1, 9)));
    const mid = q(c + sign * r(2, 6));
    const far = q(c + sign * r(10, 40));
    return (withBoundary ? [q(c), mid, far] : [near, mid, far]).slice(0, count);
  };
  const across = add(q(c), tenth(-sign * r(1, 9)));
  const outside = [across, q(c - sign * r(2, 6)), q(c - sign * r(10, 30))];
  const correctValues = inclusive(op) ? inside(3, true) : inside(3, false);
  const boundaryList = inclusive(op)
    ? [q(c), q(c - sign * r(1, 4)), q(c + sign * r(2, 9))]
    : [q(c), q(c + sign * r(1, 5)), q(c + sign * r(8, 30))];
  const nearList = [inside(1, false)[0]!, across, q(c + sign * r(7, 20))];
  const options: { values: Rational[]; why?: string }[] = [
    { values: correctValues },
    {
      values: boundaryList,
      why: inclusive(op)
        ? undefined
        : `${int(c)} ${op} ${int(c)} is false, so ${int(c)} is not a solution.`,
    },
    {
      values: outside,
      why: `These numbers are on the wrong side of ${int(c)}.`,
    },
    {
      values: nearList,
      why: `${decimal(across)} ${op} ${int(c)} is false; it is just across the boundary.`,
    },
  ];
  // For inclusive signs the boundary list fails because of its other value.
  if (inclusive(op))
    options[1]!.why = `${decimal(boundaryList[1]!)} ${op} ${int(c)} is false.`;
  const candidates: Candidate[] = options.map((o, i) => ({
    label: list(o.values),
    correct: i === 0,
    ...(o.why ? { feedback: o.why } : {}),
  }));
  for (const cand of candidates)
    if (
      cand.correct !==
      cand.label.split(", ").every((t) => holds(parseDecimal(t), op, c))
    )
      throw new Error("Solution list contradicts its role");
  return {
    prompt: `Which list contains only solutions of x ${op} ${int(c)}?`,
    kind: "choice",
    label: "Choose the list",
    candidates,
    explanation: [
      `x ${op} ${int(c)} is true for every number ${words[op]} ${int(c)}; ${int(c)} itself is ${inclusive(op) ? "a solution" : "not a solution"}.`,
      `In the list ${list(correctValues)}, every number is ${words[op]} ${int(c)}, so each one is a solution.`,
      `Every other list contains a number that makes x ${op} ${int(c)} false.`,
    ],
    hint: `Substitute each number for $x$ and ask whether the comparison with ${int(c)} is true. One false value rules out the list.`,
    tags: [`operator:${op}`, "lists", c < 0 ? "negative" : "nonnegative"],
  };
}
function parseDecimal(text: string): Rational {
  const t = text.replace("−", "-");
  const [whole, frac = ""] = t.split(".");
  const negative = whole!.startsWith("-");
  const n =
    Number(whole!.replace("-", "")) * 10 ** frac.length + Number(frac || "0");
  return q(negative ? -n : n, 10 ** frac.length);
}

// ------------------------------------------------------------------ registry
const builders: Record<string, (r: Random) => Case> = {
  "one-step-equation": oneStepCase,
  "one-step-equation-story": oneStepStoryCase,
  "balance-one-step": (r) => balanceCase(r, false),
  "two-step-equation": twoStepCase,
  "two-step-word-problem": twoStepWordCase,
  "two-step-equation-model": twoStepModelCase,
  "balance-two-step": (r) => balanceCase(r, true),
  "inequality-from-context": contextCase,
  "inequality-from-number-line": numberLineReadCase,
  "inequality-number-line-choice": numberLineChoiceCase,
  "inequality-solution-set": solutionSetCase,
};

export function equationPrintCase(
  id: string,
  seed: string,
): { problem: GeneratedProblem; tags: string[]; caseKey: string } {
  const metadata = equationTemplates.find((t) => t.id === id);
  if (!metadata) throw new Error(`Unknown equation template ${id}`);
  if (typeof seed !== "string" || !seed.length || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const r = random(id, seed);
  const c = builders[id]!(r);
  const base = {
    id: createHash("sha256")
      .update(JSON.stringify([id, 1, seed]))
      .digest("hex"),
    templateId: id,
    templateVersion: 1 as const,
    seed,
    skillId: metadata.skillId,
    prompt: c.prompt,
    ...(c.figure ? { figure: c.figure } : {}),
  };
  let problem: GeneratedProblem;
  if (c.kind === "choice") {
    const ordered = c.fixedOrder ? c.candidates : shuffle([...c.candidates], r);
    const options = ordered.map((o, i) => ({
      id: `option-${"abcd"[i]}`,
      ...o,
    }));
    if (options.filter((o) => o.correct).length !== 1)
      throw new Error(`Expected exactly one correct choice: ${id}`);
    problem = {
      public: {
        ...base,
        response: {
          kind: "choice",
          label: c.label,
          options: options.map(({ id, label }) => ({ id, label })),
        },
      },
      answer: options.find((o) => o.correct)!.id,
      explanation: c.explanation,
      hint: c.hint,
      choiceFeedback: Object.fromEntries(
        options
          .filter((o) => !o.correct)
          .map((o) => [
            o.id,
            o.feedback ??
              "Check the boundary and the direction against the inequality.",
          ]),
      ),
    };
  } else {
    problem = {
      public: { ...base, response: { kind: c.kind, label: c.label } },
      answer: c.answer,
      explanation: c.explanation,
      hint: c.hint,
    };
  }
  // The prompt and figure state every given, so they identify the case.
  return {
    problem,
    tags: c.tags,
    caseKey: JSON.stringify([c.prompt, c.figure ?? null]),
  };
}
export const generateEquationProblem = (
  id: string,
  seed: string,
): GeneratedProblem => equationPrintCase(id, seed).problem;
