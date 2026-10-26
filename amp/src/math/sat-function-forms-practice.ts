import type { GeneratedProblem, TemplateMetadata } from "./contracts";
import { assemble, random } from "./distribution-practice";
import { gcd, lin, q, qs, tex, type Q } from "./sat-numeric-entry-practice";

/**
 * SAT function forms: linear and exponential functions written in function
 * notation, the equation or model chosen from a description, and the value of
 * a related expression found by structure. Numeric templates ask for an exact
 * integer, fraction or decimal (SAT student-produced response); choice
 * templates use four distinct, feedback-bearing choices.
 */
type R = (lo: number, hi: number) => number;
type Choice = { label: string; correct?: true; feedback?: string };
type Case = {
  variant: string;
  prompt: string;
  hint: string;
  explanation: string[];
  /** Private givens, used by independent checks. */
  data: Record<string, number | string>;
  answer?: Q;
  choices?: Choice[];
};

const nz = (r: R, m: number) => r(1, m) * (r(0, 1) ? 1 : -1);
const pick = <T>(r: R, items: readonly T[]): T =>
  items[r(0, items.length - 1)]!;
/** Coefficient text: "x", "-x", "3x". */
const term = (c: number, s: string) =>
  c === 1 ? s : c === -1 ? `-${s}` : `${c}${s}`;
const dec = (n: number) => String(Number(n.toFixed(6)));
const signed = (n: number) => (n < 0 ? `-${-n}` : `+${n}`);
const pn = (n: number) => (n < 0 ? `(${n})` : `${n}`);
/** A rational times a symbol, e.g. -\frac{2}{3}x. */
const qterm = (x: Q, s: string) =>
  x[1] === 1
    ? term(x[0], s)
    : `${x[0] < 0 ? "-" : ""}\\frac{${Math.abs(x[0])}}{${x[1]}}${s}`;
const withConstant = (lead: string, b: number) =>
  b === 0 ? lead : `${lead}${signed(b)}`;
const line = (m: Q, b: number, lhs = "y") =>
  `${lhs}=${withConstant(qterm(m, "x"), b)}`;

function meta(
  id: string,
  title: string,
  skillId: string,
  difficultyOffset: number,
  description: string,
  choice: boolean,
): TemplateMetadata {
  return {
    id,
    version: 1,
    title,
    skillId,
    gradeBand: "9–12",
    difficultyOffset,
    description,
    ...(choice
      ? { requiredResponseCapability: "single-choice-v1" as const }
      : {}),
  };
}

/** Correct choice plus the first three distinct wrong choices. */
function choicesOf(
  correct: string,
  wrong: { label: string; feedback: string }[],
): Choice[] {
  const seen = new Set([correct]);
  const out: Choice[] = [{ label: correct, correct: true }];
  for (const w of wrong) {
    if (seen.has(w.label)) continue;
    seen.add(w.label);
    out.push(w);
    if (out.length === 4) return out;
  }
  throw new Error("Insufficient distinct choices");
}

// ------------------------------------------------ linear functions, f(x)
const fnNames = ["f", "g", "h", "p"] as const;
const stories = [
  {
    fn: "C",
    v: "h",
    qty: "total charge, in dollars,",
    per: "hours of work",
    intro: (a: number, m: number) =>
      `A plumber charges a fixed fee of ${a} dollars plus ${m} dollars for each hour of work.`,
    sign: 1,
  },
  {
    fn: "H",
    v: "w",
    qty: "height, in centimeters,",
    per: "weeks",
    intro: (a: number, m: number) =>
      `A seedling is ${a} centimeters tall when first measured and grows ${m} centimeters each week.`,
    sign: 1,
  },
  {
    fn: "B",
    v: "d",
    qty: "balance, in dollars,",
    per: "days",
    intro: (a: number, m: number) =>
      `A prepaid card starts with ${a} dollars, and the owner spends ${m} dollars from it each day.`,
    sign: -1,
  },
  {
    fn: "V",
    v: "t",
    qty: "volume of water, in liters,",
    per: "minutes",
    intro: (a: number, m: number) =>
      `A tank holds ${a} liters of water and drains at ${m} liters each minute.`,
    sign: -1,
  },
] as const;

function linearNotation(r: R): Case {
  const variant = r(0, 8);
  const nm = pick(r, fnNames);
  if (variant === 0) {
    const m = nz(r, 6);
    const b = nz(r, 14);
    const a = nz(r, 7);
    const rule = withConstant(term(m, "x"), b);
    const ans = m * a + b;
    return {
      variant: "evaluate-integer",
      prompt: `The function $${nm}$ is defined by $${nm}(x)=${rule}$. What is the value of $${nm}(${a})$?`,
      hint: `$${nm}(${a})$ means "the output when the input is ${a}". Replace every $x$ in the rule with ${a}, using parentheses around a negative input, then simplify.`,
      explanation: [
        `Substitute $x=${a}$: $${nm}(${a})=${m}\\cdot ${pn(a)}${signed(b)}$.`,
        `Multiply: $${m * a}${signed(b)}=${ans}$.`,
        `So $${nm}(${a})=${ans}$.`,
      ],
      data: { kind: "evaluate", m, b, a },
      answer: q(ans),
    };
  }
  if (variant === 1) {
    const d = pick(r, [2, 3, 4, 5]);
    let p = nz(r, 7);
    while (gcd(p, d) !== 1) p = nz(r, 7);
    const s = nz(r, 5);
    const a = d * s;
    const b = nz(r, 15);
    const ans = p * s + b;
    return {
      variant: "evaluate-fraction-coefficient",
      prompt: `The function $${nm}$ is defined by $${nm}(x)=${withConstant(qterm([p, d], "x"), b)}$. What is the value of $${nm}(${a})$?`,
      hint: `Replace $x$ with ${a}. The input ${a} is a multiple of ${d}, so multiply the fraction by it before adding the constant.`,
      explanation: [
        `Substitute $x=${a}$: $${nm}(${a})=\\frac{${p}}{${d}}\\cdot ${pn(a)}${signed(b)}$.`,
        `$\\frac{${p}}{${d}}\\cdot ${pn(a)}=${pn(p)}\\cdot ${pn(s)}=${p * s}$.`,
        `Then $${p * s}${signed(b)}=${ans}$.`,
      ],
      data: { kind: "evaluate-fraction", p, d, a, b },
      answer: q(ans),
    };
  }
  if (variant === 2) {
    const d = pick(r, [3, 4, 5, 6, 8]);
    let p = nz(r, 7);
    while (gcd(p, d) !== 1) p = nz(r, 7);
    const k = nz(r, 5);
    const m = d * k;
    const b = nz(r, 15);
    const ans = k * p + b;
    return {
      variant: "evaluate-fraction-input",
      prompt: `The function $${nm}$ is defined by $${nm}(x)=${withConstant(term(m, "x"), b)}$. What is the value of $${nm}\\left(${tex([p, d])}\\right)$?`,
      hint: `Replace $x$ with $${tex([p, d])}$. The coefficient ${m} is a multiple of ${d}, so the denominator cancels when you multiply.`,
      explanation: [
        `Substitute: $${nm}\\left(${tex([p, d])}\\right)=${m}\\cdot ${p < 0 ? `\\left(${tex([p, d])}\\right)` : tex([p, d])}${signed(b)}$.`,
        `$${m}\\cdot ${p < 0 ? "-" : ""}\\frac{${Math.abs(p)}}{${d}}=${k}\\cdot ${p}=${k * p}$, because $${m}=${d}\\cdot ${k}$.`,
        `Then $${k * p}${signed(b)}=${ans}$.`,
      ],
      data: { kind: "evaluate-fraction-input", m, p, d, b },
      answer: q(ans),
    };
  }
  if (variant === 3) {
    const s = pick(r, stories);
    const a = s.sign > 0 ? r(15, 60) : r(80, 200);
    const m = s.sign > 0 ? r(2, 14) : r(3, 9);
    const t = s.sign > 0 ? r(3, 12) : r(3, 9);
    const rule = s.sign > 0 ? `${a}+${m}${s.v}` : `${a}-${m}${s.v}`;
    const ans = a + s.sign * m * t;
    return {
      variant: "evaluate-contextual",
      prompt: `${s.intro(a, m)} The function $${s.fn}(${s.v})=${rule}$ gives the ${s.qty} after $${s.v}$ ${s.per}. What is the value of $${s.fn}(${t})$?`,
      hint: `$${s.fn}(${t})$ is the ${s.qty} after ${t} ${s.per}. Put ${t} in place of $${s.v}$ in the rule, multiply first, then combine with ${a}.`,
      explanation: [
        `Substitute $${s.v}=${t}$: $${s.fn}(${t})=${a}${s.sign > 0 ? "+" : "-"}${m}\\cdot ${t}$.`,
        `Multiply: $${m}\\cdot ${t}=${m * t}$.`,
        `So $${s.fn}(${t})=${a}${s.sign > 0 ? "+" : "-"}${m * t}=${ans}$.`,
      ],
      data: { kind: "evaluate-context", a, m, t, sign: s.sign },
      answer: q(ans),
    };
  }
  if (variant === 4) {
    const frac = r(0, 2) === 0;
    let k: Q;
    if (frac) {
      const d = pick(r, [2, 3, 4, 5]);
      let p = nz(r, 7);
      while (gcd(p, d) !== 1) p = nz(r, 7);
      k = [p, d];
    } else {
      // A coefficient of 1 or -1 makes the rule the input itself and gives the answer away.
      let c = nz(r, 9);
      while (Math.abs(c) === 1) c = nz(r, 9);
      k = [c, 1];
    }
    const x = nz(r, 12);
    const v = q(k[0] * x, k[1]);
    return {
      variant: "input-proportional",
      prompt: `The function $${nm}$ is defined by $${nm}(x)=${qterm(k, "x")}$. For what value of $x$ is $${nm}(x)=${tex(v)}$?`,
      hint: `$${nm}(x)=${tex(v)}$ says the output equals $${tex(v)}$. Write $${qterm(k, "x")}=${tex(v)}$ and undo the multiplication by the coefficient.`,
      explanation: [
        `Set the output equal to the target: $${qterm(k, "x")}=${tex(v)}$.`,
        k[1] === 1
          ? `Divide both sides by ${k[0]}: $x=\\frac{${tex(v)}}{${k[0]}}=${x}$.`
          : `Multiply both sides by the reciprocal $${tex([k[1], k[0]])}$: $x=${tex(v)}\\cdot ${par(q(k[1], k[0]))}=${x}$.`,
        `Check: $${nm}(${x})=${tex(k)}\\cdot ${x < 0 ? `(${x})` : x}=${tex(v)}$.`,
      ],
      data: { kind: "input-proportional", kn: k[0], kd: k[1], v: qs(v) },
      answer: q(x),
    };
  }
  if (variant === 5) {
    const profit = r(0, 1) === 1;
    const m = r(2, 12);
    const f = r(40, 400);
    const x = Math.ceil(f / m) + r(2, 15);
    if (profit) {
      const target = m * x - f;
      return {
        variant: "input-contextual",
        prompt: `A club's profit, in dollars, from selling $n$ tickets is given by $P(n)=${m}n-${f}$. For how many tickets sold is the profit ${target} dollars?`,
        hint: `Set $P(n)$ equal to ${target}: the equation is $${m}n-${f}=${target}$. Add the ${f} first, then divide.`,
        explanation: [
          `Set $P(n)=${target}$: $${m}n-${f}=${target}$.`,
          `Add ${f} to both sides: $${m}n=${target + f}$.`,
          `Divide by ${m}: $n=${x}$.`,
        ],
        data: { kind: "input-profit", m, f, x },
        answer: q(x),
      };
    }
    const fee = r(10, 90);
    const total = fee + m * x;
    return {
      variant: "input-contextual",
      prompt: `A rental costs a fixed fee plus a charge per hour. The total cost, in dollars, for $h$ hours is $C(h)=${fee}+${m}h$. For how many hours is the total cost ${total} dollars?`,
      hint: `Set $C(h)$ equal to ${total}: $${fee}+${m}h=${total}$. Remove the fixed fee from both sides before dividing by the hourly charge.`,
      explanation: [
        `Set $C(h)=${total}$: $${fee}+${m}h=${total}$.`,
        `Subtract ${fee}: $${m}h=${total - fee}$.`,
        `Divide by ${m}: $h=${x}$.`,
      ],
      data: { kind: "input-fee", m, fee, x },
      answer: q(x),
    };
  }
  if (variant === 6) {
    const p = nz(r, 7);
    const c = nz(r, 9);
    const x = nz(r, 10);
    const v = p * (x + c);
    const rule = `${p === 1 ? "" : p === -1 ? "-" : p}(x${signed(c)})`;
    return {
      variant: "input-grouped",
      prompt: `The function $${nm}$ is defined by $${nm}(x)=${rule}$. For what value of $x$ is $${nm}(x)=${v}$?`,
      hint: `Write $${rule}=${v}$. The factor ${p} multiplies the whole group, so divide both sides by ${p} before you deal with ${signed(c)}.`,
      explanation: [
        `Set the output equal to ${v}: $${rule}=${v}$.`,
        `Divide both sides by ${p}: $x${signed(c)}=${x + c}$.`,
        `${c > 0 ? `Subtract ${c}` : `Add ${-c}`} on both sides: $x=${x}$.`,
      ],
      data: { kind: "input-grouped", p, c, v },
      answer: q(x),
    };
  }
  if (variant === 7) {
    const m = nz(r, 8);
    const b = nz(r, 20);
    const zero = r(0, 3) === 0;
    const a = zero ? 0 : nz(r, 6);
    const v = m * a + b;
    return {
      variant: "constant-term",
      prompt: `The linear function $${nm}$ is defined by $${nm}(x)=${term(m, "x")}+c$, where $c$ is a constant. If $${nm}(${a})=${v}$, what is the value of $c$?`,
      hint:
        a === 0
          ? `The input 0 makes the $x$ term vanish. Put $x=0$ in the rule and compare with $${nm}(0)=${v}$.`
          : `Replace $x$ with ${a} in the rule to get an equation in $c$, then use $${nm}(${a})=${v}$ to solve for $c$.`,
      explanation: [
        `Substitute $x=${a}$: $${nm}(${a})=${m}(${a})+c=${m * a}+c$.`,
        `This equals ${v}, so $${m * a}+c=${v}$.`,
        `Subtract ${m * a}: $c=${v - m * a}$.`,
      ],
      data: { kind: "constant", m, a, v },
      answer: q(b),
    };
  }
  const start = r(20, 90);
  const rate = r(3, 15);
  const n = r(4, 12);
  const down = r(0, 3) === 0;
  const ans = down ? start * 3 - rate * n : start + rate * n;
  return {
    variant: "growth-words",
    prompt: down
      ? `A reservoir holds ${start * 3} thousand liters and loses ${rate} thousand liters each day. How many thousand liters does it hold after ${n} days?`
      : `A savings account holds ${start} dollars and ${rate} dollars is added at the end of each week. How many dollars are in the account after ${n} weeks?`,
    hint: down
      ? `The amount lost grows by ${rate} each day. Find the total lost in ${n} days, then subtract it from the starting amount.`
      : `Each week adds the same amount. Find the total added in ${n} weeks, then add it to the starting amount.`,
    explanation: down
      ? [
          `Total lost in ${n} days: ${rate}×${n}=${rate * n} thousand liters.`,
          `Remaining: $${start * 3}-${rate * n}=${ans}$ thousand liters.`,
        ]
      : [
          `Total added in ${n} weeks: ${rate}×${n}=${rate * n} dollars.`,
          `Balance: $${start}+${rate * n}=${ans}$ dollars.`,
        ],
    data: {
      kind: "growth",
      start: down ? start * 3 : start,
      rate,
      n,
      down: down ? 1 : 0,
    },
    answer: q(ans),
  };
}
const par = (x: Q) => (x[0] < 0 ? `\\left(${tex(x)}\\right)` : tex(x));

// ------------------------------------------- choose the line's equation
function lineEquationChoice(r: R): Case {
  const variant = r(0, 2);
  if (variant === 0 || variant === 1) {
    const frac = r(0, 1) === 1;
    const d = frac ? pick(r, [2, 3, 4, 5]) : 1;
    let p = nz(r, frac ? 7 : 6);
    while (frac && gcd(p, d) !== 1) p = nz(r, 7);
    const m: Q = [p, d];
    const b = nz(r, 9);
    if (variant === 0) {
      const style = r(0, 2);
      const lhs = style === 2 ? "f(x)" : "y";
      const correct = line(m, b, lhs);
      const prompt =
        style === 0
          ? `A line in the $xy$-plane has slope $${tex(m)}$ and passes through the point $(0,${b})$. Which equation represents the line?`
          : style === 1
            ? `A line in the $xy$-plane has slope $${tex(m)}$ and a $y$-intercept of ${b}. Which equation represents the line?`
            : `The graph of the linear function $f$ has slope $${tex(m)}$ and passes through the point $(0,${b})$. Which of the following defines $f$?`;
      const wrongs = [
        {
          label: `$${line([-p, d], b, lhs)}$`,
          feedback:
            "The slope keeps its sign: it is the coefficient of $x$ exactly as given.",
        },
        d === 1
          ? {
              label: `$${lhs}=${withConstant(term(b, "x"), p)}$`,
              feedback:
                "The slope and the $y$-intercept are swapped. The slope multiplies $x$; the constant term is the $y$-value at $x=0$.",
            }
          : {
              label: `$${line([d, p], b, lhs)}$`,
              feedback:
                "The slope is inverted. The slope is the coefficient of $x$ exactly as given, not its reciprocal.",
            },
        {
          label: `$${line(m, -b, lhs)}$`,
          feedback:
            "The constant term is the $y$-coordinate of the point on the $y$-axis, with its sign.",
        },
        {
          label: `$${line([-p, d], -b, lhs)}$`,
          feedback:
            "Both signs are reversed; keep the slope and intercept as given.",
        },
      ];
      return {
        variant: "slope-intercept-point",
        prompt,
        hint: `A line with slope $m$ and $y$-intercept $b$ has the form $y=mx+b$. The $y$-intercept is the value of $y$ when $x=0$; decide which given number it is.`,
        explanation: [
          `The $y$-intercept is ${b}, the $y$-value at $x=0$.`,
          `With slope $${tex(m)}$ and $y$-intercept ${b}, $y=mx+b$ becomes $${correct}$.`,
        ],
        data: { kind: "slope-intercept", pn: p, d, b },
        choices: choicesOf(`$${correct}$`, wrongs),
      };
    }
    const k = nz(r, 5);
    const x0 = d * k;
    const y0 = nz(r, 12);
    const bb = y0 - p * k;
    if (bb === 0 || bb === y0) return lineEquationChoice(r);
    const correct = line(m, bb);
    return {
      variant: "slope-point",
      prompt: `A line in the $xy$-plane has slope $${tex(m)}$ and passes through the point $(${x0},${y0})$. Which equation represents the line?`,
      hint: `Start with $y=${qterm(m, "x")}+b$. The point $(${x0},${y0})$ is on the line, so replacing $x$ and $y$ with its coordinates gives an equation that determines $b$.`,
      explanation: [
        `Use $y=${qterm(m, "x")}+b$ and substitute the point: $${y0}=${tex(m)}\\cdot ${x0 < 0 ? `(${x0})` : x0}+b$.`,
        `$${tex(m)}\\cdot ${x0 < 0 ? `(${x0})` : x0}=${p * k}$, so $${y0}=${p * k}+b$ and $b=${bb}$.`,
        `The equation is $${correct}$.`,
      ],
      data: { kind: "slope-point", pn: p, d, x0, y0 },
      choices: choicesOf(`$${correct}$`, [
        {
          label: `$${line(m, y0)}$`,
          feedback: `The point (${x0}, ${y0}) is not the $y$-intercept because its $x$-coordinate is not 0. Find $b$ by substituting the point.`,
        },
        {
          label: `$${line(m, y0 + p * k)}$`,
          feedback:
            "The slope term must be subtracted from the $y$-coordinate to get $b$: $b=y-mx$.",
        },
        {
          label: `$${line(m, -bb)}$`,
          feedback: "The intercept has the opposite sign; recompute $b=y-mx$.",
        },
        {
          label: `$${line([-p, d], y0 + p * k)}$`,
          feedback: "Keep the slope's sign and compute $b=y-mx$ with it.",
        },
      ]),
    };
  }
  const rate = r(2, 9) * (r(0, 1) ? 1 : -1);
  const t0 = r(2, 8);
  const b = r(12, 60);
  const y0 = b + rate * t0;
  if (y0 <= 0) return lineEquationChoice(r);
  const up = rate > 0;
  const mag = Math.abs(rate);
  const eq = (m: number, c: number) => `y=${withConstant(term(m, "x"), c)}`;
  return {
    variant: "rate-point",
    prompt: `The water level in a pool ${up ? "rises" : "falls"} at a constant rate of ${mag} centimeters each hour. After ${t0} hours the level is ${y0} centimeters. Which equation gives the level $y$, in centimeters, after $x$ hours?`,
    hint: `A constant rate is the slope. Write $y=${term(rate, "x")}+b$, then use "after ${t0} hours the level is ${y0}" to find the starting level $b$.`,
    explanation: [
      `The level changes by ${rate} centimeters each hour, so the slope is ${rate} and $y=${term(rate, "x")}+b$.`,
      `At $x=${t0}$ the level is ${y0}: $${y0}=${rate}\\cdot ${t0}+b=${rate * t0}+b$, so $b=${b}$.`,
      `The equation is $${eq(rate, b)}$.`,
    ],
    data: { kind: "rate-point", rate, t0, y0 },
    choices: choicesOf(`$${eq(rate, b)}$`, [
      {
        label: `$${eq(rate, y0)}$`,
        feedback: `${y0} is the level after ${t0} hours, not the starting level at $x=0$.`,
      },
      {
        label: `$${eq(rate, y0 + rate * t0)}$`,
        feedback:
          "To get back to the start, undo the change over the elapsed hours: subtract the rate times the time from the later level.",
      },
      {
        label: `$${eq(-rate, b)}$`,
        feedback: `The level ${up ? "rises" : "falls"}, so the slope is ${rate}.`,
      },
      {
        label: `$${eq(Math.round(y0 / t0) === rate ? y0 : Math.round(y0 / t0), 0)}$`,
        feedback:
          "That line passes through the origin, so it says the level is 0 at the start. The pool already had water at $x=0$.",
      },
    ]),
  };
}

// ----------------------------------------- choose a two-variable equation
function constraintChoice(r: R): Case {
  const variant = r(0, 3);
  const eq = (a: number, b: number, c: number) =>
    `${lin([
      [a, "x"],
      [b, "y"],
    ])}=${c}`;
  if (variant === 3) {
    let pp = r(3, 12);
    let qq = r(3, 12);
    while (pp === qq || gcd(pp, qq) !== 1) {
      pp = r(3, 12);
      qq = r(3, 12);
    }
    const correct = `${lin([
      [qq, "x"],
      [pp, "y"],
    ])}=${pp * qq}`;
    return {
      variant: "capacity-intercepts",
      prompt: `A truck is full when it carries exactly ${pp} small crates and no large crates, or exactly ${qq} large crates and no small crates. It is loaded with $x$ small crates and $y$ large crates and is full. Which equation represents this situation?`,
      hint: `A full load is the line through the two extreme loads $(${pp},0)$ and $(0,${qq})$. Test each choice at those two points: both must satisfy it.`,
      explanation: [
        `The extreme loads are $(x,y)=(${pp},0)$ and $(0,${qq})$.`,
        `Substituting $(${pp},0)$ into $${correct}$ gives $${qq}\\cdot ${pp}=${pp * qq}$, and $(0,${qq})$ gives $${pp}\\cdot ${qq}=${pp * qq}$, so both hold.`,
        `A line is determined by two points, so the equation is $${correct}$.`,
      ],
      data: { kind: "capacity", p: pp, q: qq },
      choices: choicesOf(`$${correct}$`, [
        {
          label: `$${lin([
            [pp, "x"],
            [qq, "y"],
          ])}=${pp * qq}$`,
          feedback: `The coefficients are swapped: at $(${pp},0)$ this gives ${pp * pp}, not ${pp * qq}.`,
        },
        {
          label: `$${lin([
            [qq, "x"],
            [pp, "y"],
          ])}=${pp + qq}$`,
          feedback: `Test $(${pp},0)$: the left side is ${pp * qq}, not ${pp + qq}.`,
        },
        {
          label: `$x+y=${pp + qq}$`,
          feedback: `This line does not pass through $(${pp},0)$; it would let a full truck carry ${pp + qq} of a single crate type.`,
        },
      ]),
    };
  }
  const a = r(3, 15);
  let b = r(3, 30);
  while (b === a) b = r(3, 30);
  const c = r(10, 90) * 10;
  const ctx = [
    {
      kind: "sales",
      prompt: `A store sold small candles for ${a} dollars each and large candles for ${b} dollars each. The sales from candles were ${c} dollars. If $x$ small candles and $y$ large candles were sold, which equation represents this situation?`,
      hint: `Each kind of candle contributes (price)×(number sold) to the sales. Write the two contributions, then set their sum equal to the total.`,
      why: `Sales from small candles are $${a}x$ and from large candles $${b}y$.`,
    },
    {
      kind: "distance",
      prompt: `A cyclist rode $x$ hours at ${a} kilometers per hour and then $y$ hours at ${b} kilometers per hour, for a total distance of ${c} kilometers. Which equation represents this situation?`,
      hint: `Distance is speed times time. Find the distance of each part of the ride, then add the parts to get the total.`,
      why: `The first part covers $${a}x$ kilometers and the second part $${b}y$ kilometers.`,
    },
    {
      kind: "points",
      prompt: `A quiz has easy questions worth ${a} points each and hard questions worth ${b} points each. A student earned ${c} points by answering $x$ easy and $y$ hard questions correctly. Which equation represents this situation?`,
      hint: `Points from a type of question are (points per question)×(number answered). Add the two amounts and set the sum equal to the total.`,
      why: `Easy questions give $${a}x$ points and hard questions $${b}y$ points.`,
    },
  ][variant]!;
  const correct = eq(a, b, c);
  return {
    variant: ctx.kind,
    prompt: ctx.prompt,
    hint: ctx.hint,
    explanation: [
      ctx.why,
      `Their sum is the total of ${c}, so the equation is $${correct}$.`,
    ],
    data: { kind: ctx.kind, a, b, c },
    choices: choicesOf(`$${correct}$`, [
      {
        label: `$${eq(b, a, c)}$`,
        feedback: `The rates are attached to the wrong quantities: ${a} goes with $x$ and ${b} goes with $y$.`,
      },
      {
        label: `$\\frac{x}{${a}}+\\frac{y}{${b}}=${c}$`,
        feedback:
          "That divides each count by its rate. A total is built by multiplying each count by its rate.",
      },
      {
        label: `$(${a}+${b})(x+y)=${c}$`,
        feedback:
          "That applies the sum of the two rates to every unit. Each rate applies only to its own count.",
      },
      {
        label: `$${eq(a, -b, c)}$`,
        feedback:
          "The two contributions are added to make the total, not subtracted.",
      },
    ]),
  };
}

// ----------------------------------------------- choose an exponential model
function exponentialChoice(r: R): Case {
  const variant = r(0, 4);
  if (variant === 0) {
    const pct = pick(r, [120, 150, 175, 200, 250]);
    const a = r(2, 9) * 50;
    const fac = 1 + pct / 100;
    const f = (b: number) => `$f(t)=${a}\\cdot ${dec(b)}^{t}$`;
    return {
      variant: "percent-over-100",
      prompt: `A colony has ${a} cells at time $t=0$. Each hour the number of cells increases by ${pct}% of the number at the start of that hour. Which function models the number of cells after $t$ hours?`,
      hint: `An increase of ${pct}% adds ${pct}% of the current amount to the current amount, which is 100% of itself. Find the single factor that multiplies the amount each hour.`,
      explanation: [
        `Each hour the amount becomes 100% + ${pct}% = ${100 + pct}% of what it was, which is the factor ${dec(fac)}.`,
        `Starting from ${a}, after $t$ hours the number is ${a} multiplied by ${dec(fac)} a total of $t$ times.`,
        `So $f(t)=${a}\\cdot ${dec(fac)}^{t}$.`,
      ],
      data: { kind: "percent", a, pct },
      choices: choicesOf(f(fac), [
        {
          label: f(pct / 100),
          feedback: `${dec(pct / 100)} is only the increase, expressed as a decimal. The factor must also include the original 100%.`,
        },
        {
          label: f(pct),
          feedback:
            "A percent must be converted to a decimal before it is used as a factor.",
        },
        {
          label: `$f(t)=${a}\\left(1+${dec(pct / 100)}t\\right)$`,
          feedback:
            "This adds the same number of cells each hour. A percent increase is taken of the current number, so the amount multiplies each hour.",
        },
      ]),
    };
  }
  if (variant === 1) {
    const b = pick(r, [2, 3]);
    const word = b === 2 ? "doubles" : "triples";
    const k = pick(r, [2, 3, 4, 5]);
    const a = r(2, 9) * 100;
    const f = (e: string) => `$P(t)=${a}\\cdot ${e}$`;
    return {
      variant: "multi-year-period",
      prompt: `A town had ${a} residents in 2000. Its population ${word} every ${k} years. Which function gives the population $P(t)$ $t$ years after 2000?`,
      hint: `The population is multiplied by ${b} once every ${k} years, not once per year. The number of multiplications after $t$ years is the number of ${k}-year periods in $t$.`,
      explanation: [
        `The number of ${k}-year periods in $t$ years is $\\frac{t}{${k}}$.`,
        `Each period multiplies the population by ${b}, so the population is ${a} times ${b} to the power $\\frac{t}{${k}}$.`,
        `$P(t)=${a}\\cdot ${b}^{t/${k}}$.`,
      ],
      data: { kind: "period", a, b, k },
      choices: choicesOf(f(`${b}^{t/${k}}`), [
        {
          label: f(`${b}^{${k}t}`),
          feedback: `This multiplies by ${b} ${k} times each year. Here it happens once every ${k} years.`,
        },
        {
          label: f(`${b}^{t}`),
          feedback: `This multiplies by ${b} every year, which is faster than every ${k} years.`,
        },
        // 2^(2t) and 4^t are the same function, so that pair needs a different third wrong choice.
        b ** k === b * k
          ? {
              label: f(`${b}^{t+${k}}`),
              feedback: `Adding ${k} to the exponent only multiplies the starting value by ${b ** k}; it does not slow the growth to once every ${k} years.`,
            }
          : {
              label: f(`${b * k}^{t}`),
              feedback: `The growth factor each year is not ${b * k}; ${b} is the factor for a full ${k}-year period.`,
            },
      ]),
    };
  }
  if (variant === 2) {
    const b = pick(r, [2, 3, 4]);
    const n = r(3, 5);
    const a = r(2, 9);
    const v = a * b ** n;
    const f = (base: string) => `$N(d)=${a}\\cdot ${base}^{d}$`;
    return {
      variant: "factor-from-later-value",
      prompt: `A culture contained ${a} thousand bacteria at the start. The count is multiplied by the same constant factor each day, and after ${n} days it was ${v} thousand. Which function models the count $N(d)$, in thousands, after $d$ days?`,
      hint: `The count after ${n} days is ${a} times the daily factor used ${n} times. Divide ${v} by ${a}, then ask which number multiplied by itself ${n} times gives that quotient.`,
      explanation: [
        `With daily factor $b$, $${a}\\cdot b^{${n}}=${v}$, so $b^{${n}}=${v / a}$.`,
        `$${b}^{${n}}=${v / a}$, so the daily factor is $b=${b}$.`,
        `$N(d)=${a}\\cdot ${b}^{d}$.`,
      ],
      data: { kind: "root-factor", a, b, n },
      choices: choicesOf(f(`${b}`), [
        {
          label: f(`\\left(\\frac{1}{${b}}\\right)`),
          feedback:
            "The count grows from the start, so the daily factor is greater than 1.",
        },
        {
          label: f(`${v / a}`),
          feedback: `${v / a} is the total change over ${n} days, not the factor for one day.`,
        },
        {
          label: f(`${b + 1}`),
          feedback: `The count is multiplied by ${b} each day; ${b + 1} would give a different value after ${n} days.`,
        },
      ]),
    };
  }
  if (variant === 3) {
    const pct = pick(r, [2, 4, 5, 6, 8]);
    const a = 1000;
    const g = 1 + pct / 100;
    const v1 = a * g;
    const v2 = v1 * g;
    const fmt = (n: number) => String(Number(n.toFixed(4)));
    const f = (e: string) => `$f(x)=${a}\\cdot ${e}$`;
    return {
      variant: "small-rate-table",
      prompt: `The function $f$ gives the value of an account after $x$ years, and each year it changes by the same percent. The values are $f(0)=${a}$, $f(1)=${fmt(v1)}$ and $f(2)=${fmt(v2)}$. Which equation defines $f$?`,
      hint: `Divide each value by the one before it. The common quotient is the yearly factor; then write the factor as 1 plus a decimal rate.`,
      explanation: [
        `$\\frac{${fmt(v1)}}{${a}}=${fmt(g)}$ and $\\frac{${fmt(v2)}}{${fmt(v1)}}=${fmt(g)}$, so the yearly factor is ${fmt(g)}.`,
        `The starting value is ${a}, so $f(x)=${a}\\cdot ${fmt(g)}^{x}$.`,
        `The factor ${fmt(g)} equals $1+${fmt(pct / 100)}$: the account grows ${pct}% each year.`,
      ],
      data: { kind: "table-rate", a, pct },
      choices: choicesOf(f(`${fmt(g)}^{x}`), [
        {
          label: f(`${fmt(pct / 100)}^{x}`),
          feedback:
            "A base below 1 would shrink the value; the factor must include the original 100%.",
        },
        {
          label: f(`${fmt(1 - pct / 100)}^{x}`),
          feedback: "This is a decay factor, but the values increase.",
        },
        {
          label: `$f(x)=${a}\\left(1+${fmt(pct / 100)}x\\right)$`,
          feedback:
            "This adds the same amount each year. The table adds a growing amount, because each change is a percent of the current value.",
        },
        {
          label: f(`${(1 + pct).toString()}^{x}`),
          feedback:
            "The percent must be written as a decimal, not as a whole number, before it is added to 1.",
        },
      ]),
    };
  }
  const c = pick(r, [2, 3]);
  const n0 = pick(r, c === 2 ? [64, 96, 128, 160] : [81, 108, 135, 162]);
  const f = (e: string) => `$f(x)=${e}$`;
  const good = `${n0}\\left(\\frac{1}{${c}}\\right)^{x-1}`;
  return {
    variant: "first-round-coefficient",
    prompt: `A tournament has ${n0} teams in round 1. Each later round has $\\frac{1}{${c}}$ as many teams as the round before. Which function gives the number of teams $f(x)$ in round $x$, for $x=1,2,3,\\ldots$?`,
    hint: `Check your choice at round 1: it must give ${n0}. Round 2 is the first round that has been multiplied by $\\frac{1}{${c}}$, so count how many times the factor has been used by round $x$.`,
    explanation: [
      `Round 1 has ${n0} teams and no multiplication by $\\frac{1}{${c}}$ has happened yet.`,
      `By round $x$ it has happened $x-1$ times.`,
      `So $f(x)=${good}$. Check: $f(1)=${n0}$ and $f(2)=${n0 / c}$.`,
    ],
    data: { kind: "first-round", n0, c },
    choices: choicesOf(f(good), [
      {
        label: f(`${n0}\\left(\\frac{1}{${c}}\\right)^{x}`),
        feedback: `At $x=1$ this gives ${n0 / c}, but round 1 has ${n0} teams. The exponent counts rounds after the first.`,
      },
      {
        label: f(`${n0}\\left(\\frac{1}{${c}}\\right)^{x+1}`),
        feedback: `At $x=1$ this gives ${n0 / c ** 2}, not ${n0}.`,
      },
      {
        label: f(`${n0}\\cdot ${c}^{x-1}`),
        feedback:
          "The number of teams decreases each round, so the factor is less than 1.",
      },
    ]),
  };
}

// ----------------------------------------------- exponential, numeric entry
function exponentialNumeric(r: R): Case {
  if (r(0, 1) === 0) {
    const b = pick(r, [2, 3]);
    const m = r(2, 4);
    const k = pick(r, [2, 3, 5]);
    const a = r(3, 40);
    const v = a * b ** m;
    const word = b === 2 ? "doubles" : "triples";
    return {
      variant: "initial-from-later",
      prompt: `The number of members of an online group ${word} every ${k} years. After ${m * k} years the group has ${v} members. How many members did it have at the start?`,
      hint: `In ${m * k} years there are ${m} periods of ${k} years. Undo one ${b === 2 ? "doubling" : "tripling"} per period by dividing, once for each period.`,
      explanation: [
        `${m * k} years contain ${m} periods of ${k} years, so the count was multiplied by ${b} a total of ${m} times.`,
        `Starting count times $${b}^{${m}}$ equals ${v}, and $${b}^{${m}}=${b ** m}$.`,
        `Starting count $=\\frac{${v}}{${b ** m}}=${a}$.`,
      ],
      data: { kind: "initial", a, b, m, k, v },
      answer: q(a),
    };
  }
  const b = pick(r, [2, 3, 4]);
  const n = pick(r, [2, 3]);
  const a = r(2, 7);
  const v = a * b ** n;
  return {
    variant: "base-then-next-output",
    prompt: `For the exponential function $f(x)=${a}\\cdot b^{x}$, where $b$ is a positive constant, $f(${n})=${v}$. What is the value of $f(${n + 1})$?`,
    hint: `First find $b$: divide both sides of $${a}\\cdot b^{${n}}=${v}$ by ${a}, then take the ${n === 2 ? "square" : "cube"} root. Then multiply the known output by $b$ once.`,
    explanation: [
      `$${a}\\cdot b^{${n}}=${v}$ gives $b^{${n}}=${v / a}$, so $b=${b}$ because $b>0$.`,
      `Going from input ${n} to ${n + 1} multiplies the output by $b$.`,
      `$f(${n + 1})=${v}\\cdot ${b}=${v * b}$.`,
    ],
    data: { kind: "base-next", a, b, n, v },
    answer: q(v * b),
  };
}

// ------------------------------------------ value of a related expression
function relatedValue(r: R): Case {
  const variant = r(0, 5);
  if (variant === 0) {
    const frac = r(0, 1) === 1;
    const d = frac ? pick(r, [2, 3, 4, 5]) : 1;
    let p = r(2, 9);
    while (frac && gcd(p, d) !== 1) p = r(2, 9);
    const s = nz(r, 8);
    const x = d * s;
    const c = p * s;
    // With a whole coefficient the asked multiple must differ from the given one, or the question restates the equation.
    let k = pick(r, [2, 3, 4, 5, 6, 7]);
    while (d === 1 && k === p) k = pick(r, [2, 3, 4, 5, 6, 7]);
    const coef: Q = [p, d];
    return {
      variant: "scaled-term",
      prompt: `If $${qterm(coef, "x")}=${c}$, what is the value of $${term(k, "x")}$?`,
      hint: `Solve the equation for $x$ by undoing the coefficient, then multiply that value of $x$ by ${k}.`,
      explanation: [
        d === 1
          ? `Divide both sides by ${p}: $x=${x}$.`
          : `Multiply both sides by $\\frac{${d}}{${p}}$: $x=${c}\\cdot \\frac{${d}}{${p}}=${x}$.`,
        `Then $${term(k, "x")}=${k}\\cdot ${x < 0 ? `(${x})` : x}=${k * x}$.`,
      ],
      data: { kind: "scaled-term", p, d, c, k },
      answer: q(k * x),
    };
  }
  if (variant === 1) {
    const a = r(2, 9);
    const c = r(2, 9);
    const u = nz(r, 8);
    const rhs = a * u;
    return {
      variant: "common-factor",
      prompt: `If $${a}x-${a * c}=${rhs}$, what is the value of $x-${c}$?`,
      hint: `Look at ${a}x and ${a * c}: both are multiples of ${a}. Divide every term of the equation by ${a} and compare with $x-${c}$.`,
      explanation: [
        `Both terms on the left are multiples of ${a}: $${a}x-${a * c}=${a}(x-${c})$.`,
        `So $${a}(x-${c})=${rhs}$.`,
        `Divide by ${a}: $x-${c}=${u}$.`,
      ],
      data: { kind: "common-factor", a, c, rhs },
      answer: q(u),
    };
  }
  if (variant === 2) {
    const p = nz(r, 9);
    let qq = nz(r, 9);
    while (qq === p) qq = nz(r, 9);
    return {
      variant: "reciprocal-ratio",
      prompt: `If $x$ and $y$ are nonzero and $\\frac{x}{y}=${tex([p, qq])}$, what is the value of $\\frac{y}{x}$?`,
      hint: `$\\frac{y}{x}$ is the reciprocal of $\\frac{x}{y}$. The reciprocal of a fraction swaps its numerator and denominator and keeps the sign.`,
      explanation: [
        `$\\frac{y}{x}=1\\div\\frac{x}{y}$.`,
        `$1\\div ${par(q(p, qq))}=${tex(q(qq, p))}$.`,
      ],
      data: { kind: "reciprocal", p, qq },
      answer: q(qq, p),
    };
  }
  if (variant === 3) {
    const a = 2 * r(1, 5);
    const b = 2 * nz(r, 5);
    const c = nz(r, 20);
    const k = pick(r, [-1, -2, 3, 4]);
    const half = r(0, 2) === 0;
    if (half) {
      return {
        variant: "scaled-equation",
        prompt: `If $${lin([
          [a, "x"],
          [b, "y"],
        ])}=${2 * c}$, what is the value of $${lin([
          [a / 2, "x"],
          [b / 2, "y"],
        ])}$?`,
        hint: `Compare $${lin([
          [a / 2, "x"],
          [b / 2, "y"],
        ])}$ with the left side of the equation: it is the same expression divided by 2. Do the same to the right side.`,
        explanation: [
          `Each coefficient on the left is half of the original: $${lin([
            [a / 2, "x"],
            [b / 2, "y"],
          ])}=\\frac12(${lin([
            [a, "x"],
            [b, "y"],
          ])})$.`,
          `Half of ${2 * c} is ${c}.`,
        ],
        data: { kind: "scaled-equation", a, b, c: 2 * c, num: 1, den: 2 },
        answer: q(c),
      };
    }
    return {
      variant: "scaled-equation",
      prompt: `If $${lin([
        [a, "x"],
        [b, "y"],
      ])}=${c}$, what is the value of $${lin([
        [k * a, "x"],
        [k * b, "y"],
      ])}$?`,
      hint: `Compare $${lin([
        [k * a, "x"],
        [k * b, "y"],
      ])}$ with the left side of the equation: each coefficient is multiplied by ${k}. Multiply the right side by the same number.`,
      explanation: [
        `Each coefficient is ${k} times the original: $${lin([
          [k * a, "x"],
          [k * b, "y"],
        ])}=${k}(${lin([
          [a, "x"],
          [b, "y"],
        ])})$.`,
        `So its value is $${k}\\cdot ${c < 0 ? `(${c})` : c}=${k * c}$.`,
      ],
      data: { kind: "scaled-equation", a, b, c, num: k, den: 1 },
      answer: q(k * c),
    };
  }
  if (variant === 4) {
    const p = r(3, 9);
    let s2 = r(2, 6);
    while (s2 >= p) s2 = r(2, 6);
    const u = nz(r, 8);
    const s = r(1, 20);
    const t = (p - s2) * u + s;
    const c = nz(r, 7);
    const grp = `(x${signed(c)})`;
    return {
      variant: "grouped-unit",
      prompt: `If $${p}${grp}+${s}=${s2}${grp}${signed(t)}$, what is the value of $x${signed(c)}$?`,
      hint: `The group $x${signed(c)}$ appears on both sides. Treat it as one unknown: collect the groups on one side and the plain numbers on the other.`,
      explanation: [
        `Let $u=x${signed(c)}$. The equation is $${p}u+${s}=${s2}u${signed(t)}$.`,
        `Subtract $${s2}u$ and ${s}: $${p - s2}u=${t - s}$.`,
        `Divide by ${p - s2}: $u=${u}$, so $x${signed(c)}=${u}$.`,
      ],
      data: { kind: "grouped-unit", p, s2, s, t },
      answer: q(u),
    };
  }
  const a = r(2, 9);
  const b = r(2, 9);
  const u = nz(r, 7);
  const rhs = a * u;
  return {
    variant: "common-factor-added",
    prompt: `If $${a}x+${a * b}=${rhs}$, what is the value of $x+${b}$?`,
    hint: `Both terms on the left are multiples of ${a}. Factor ${a} out of the left side and compare what is left with $x+${b}$.`,
    explanation: [
      `Factor: $${a}x+${a * b}=${a}(x+${b})$.`,
      `So $${a}(x+${b})=${rhs}$.`,
      `Divide by ${a}: $x+${b}=${u}$.`,
    ],
    data: { kind: "common-factor-added", a, b, rhs },
    answer: q(u),
  };
}

// ----------------------------------------------------------------- registry
const defs: {
  template: TemplateMetadata;
  make: (r: R) => Case;
  numeric: boolean;
}[] = [
  {
    template: meta(
      "sat-entry-fn-linear-notation",
      "Linear functions in function notation",
      "function-evaluation",
      0.35,
      "Evaluate a linear function written in function notation, find the input for a stated output, or find its constant term, in plain and contextual forms with fractional values.",
      false,
    ),
    make: linearNotation,
    numeric: true,
  },
  {
    template: meta(
      "sat-fn-line-equation-choice",
      "Choose a line's equation from its slope and a point",
      "linear-models",
      0.4,
      "Choose the slope-intercept equation of a line from a slope and the y-intercept point or another point, including fractional and negative slopes and a constant rate in context.",
      true,
    ),
    make: lineEquationChoice,
    numeric: false,
  },
  {
    template: meta(
      "sat-fn-constraint-choice",
      "Choose a two-variable equation for a total",
      "linear-equation-modeling",
      0.4,
      "Choose the two-variable linear equation for a total built from two rates or prices, or for a full load described by its two extreme cases.",
      true,
    ),
    make: constraintChoice,
    numeric: false,
  },
  {
    template: meta(
      "sat-fn-exponential-choice",
      "Choose an exponential model",
      "exponential-models",
      0.55,
      "Choose an exponential function from a percent increase above 100 percent, a multi-year period, a later value, a table with a small rate, or a coefficient that is not the first value.",
      true,
    ),
    make: exponentialChoice,
    numeric: false,
  },
  {
    template: meta(
      "sat-entry-fn-exponential",
      "Enter an exponential value",
      "exponential-models",
      0.55,
      "Enter the initial amount of a quantity that doubles or triples over a multi-year period, or recover an exponential base and find the next output.",
      false,
    ),
    make: exponentialNumeric,
    numeric: true,
  },
  {
    template: meta(
      "sat-entry-fn-related-value",
      "Enter the value of a related expression",
      "linear-equations",
      0.4,
      "Find the value of an expression related to a linear equation, such as a multiple of the variable, a grouped factor, a reciprocal ratio or a scaled left side, by structure.",
      false,
    ),
    make: relatedValue,
    numeric: true,
  },
];

export const satFunctionFormsTemplates: readonly TemplateMetadata[] = defs.map(
  (d) => d.template,
);

/** Private exact model; only the prompt, hint and response protocol are public. */
export function satFunctionFormsCase(id: string, seed: string) {
  if (typeof seed !== "string" || !seed.length || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const def = defs.find((d) => d.template.id === id);
  if (!def) throw new Error(`Unknown SAT function-forms template ${id}`);
  const r = random(id, seed);
  const made = def.make(r);
  const problem: GeneratedProblem = assemble(def.template, seed, r, {
    prompt: made.prompt,
    answer: made.answer ? qs(made.answer) : "",
    ...(made.answer ? { fraction: true } : {}),
    hint: made.hint,
    explanation: made.explanation,
    ...(made.choices ? { choices: made.choices } : {}),
  });
  if (def.numeric) problem.entryPolicy = "sat-spr";
  return { ...made, problem };
}

export function generateSatFunctionFormsProblem(
  id: string,
  seed: string,
): GeneratedProblem {
  return satFunctionFormsCase(id, seed).problem;
}

/** True when a template's problems carry the SAT entry policy. */
export const hasFunctionFormsEntryPolicy = (templateId: string): boolean =>
  defs.some((d) => d.template.id === templateId && d.numeric);
