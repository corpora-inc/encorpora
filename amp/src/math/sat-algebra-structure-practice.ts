import type { GeneratedProblem, TemplateMetadata } from "./contracts";
import { sweepChoose, sweepVariant } from "./number-domain-axes";
import { writeRational } from "./variation/number-domain";
import {
  assemble,
  random,
  type Draft,
  type Random,
} from "./distribution-practice";

const template = (
  id: string,
  title: string,
  skillId: string,
  description: string,
  difficultyOffset: number,
  gradeBand: TemplateMetadata["gradeBand"] = "9–12",
): TemplateMetadata => ({
  id,
  version: 1,
  title,
  skillId,
  gradeBand,
  difficultyOffset,
  requiredResponseCapability: "single-choice-v1",
  description,
});

export const satAlgebraStructureTemplates: readonly TemplateMetadata[] = [
  template(
    "quadratic-root-relations",
    "Use the coefficients of a quadratic to relate its solutions",
    "quadratic-equations",
    "Find the sum, product, a symmetric expression, a missing coefficient or the other solution of a quadratic from its coefficients and one solution, without solving for both roots.",
    0.4,
  ),
  template(
    "system-expression-value",
    "Find the value of an expression from linear equations",
    "linear-systems",
    "Find the exact value of a requested combination of two variables by scaling and adding the given equations, including systems whose variables cannot be found separately.",
    0.3,
  ),
  template(
    "variation-constant",
    "Direct and inverse variation",
    "proportional-relationships",
    "Find a constant of variation, predict a value, choose an equation or table model, or find the change factor for direct and inverse variation in context.",
    0.35,
    "6–8",
  ),
  template(
    "rate-combination-model",
    "Combine rates in a word problem",
    "linear-equation-modeling",
    "Combine constant rates exactly: shared work, filling with a drain, mixtures, average speed over equal distances and two-phase rates.",
    0.4,
  ),
  template(
    "absolute-compound-inequality",
    "Absolute-value and compound inequalities",
    "linear-inequalities",
    "Choose the solution set of an absolute-value, and-compound or or-compound inequality, or the absolute-value inequality for a described set on a number line.",
    0.35,
  ),
  template(
    "quadratic-from-data",
    "Write a quadratic from its zeros, vertex or points",
    "quadratic-graphs",
    "Choose the quadratic equation fixed by two zeros and a point, a vertex and a point, a table with equal steps, or three points.",
    0.4,
  ),
];

/* ---------- exact arithmetic and notation ---------- */

type Q = readonly [number, number];
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));
function q(n: number, d = 1): Q {
  if (d === 0) throw new Error("Zero denominator");
  const g = gcd(n, d) || 1;
  const s = d < 0 ? -1 : 1;
  return [(s * n) / g, (s * d) / g];
}
const add = (x: Q, y: Q) => q(x[0] * y[1] + y[0] * x[1], x[1] * y[1]);
const sub = (x: Q, y: Q) => q(x[0] * y[1] - y[0] * x[1], x[1] * y[1]);
const mul = (x: Q, y: Q) => q(x[0] * y[0], x[1] * y[1]);
const div = (x: Q, y: Q) => q(x[0] * y[1], x[1] * y[0]);
const neg = (x: Q) => q(-x[0], x[1]);
const eq = (x: Q, y: Q) => x[0] === y[0] && x[1] === y[1];
const tex = (x: Q) =>
  x[1] === 1
    ? `${x[0]}`
    : `${x[0] < 0 ? "-" : ""}\\frac{${Math.abs(x[0])}}{${x[1]}}`;
const m = (x: Q) => `$${tex(x)}$`;
const whole = (n: number) => q(n);

/** A signed term: `first` suppresses a leading plus. */
function term(c: number, v: string, first: boolean): string {
  const mag = Math.abs(c) === 1 && v ? "" : `${Math.abs(c)}`;
  const sign = c < 0 ? (first ? "-" : " - ") : first ? "" : " + ";
  return `${sign}${mag}${v}`;
}
function quadratic(a: number, b: number, c: number): string {
  let s = term(a, "x^2", true);
  if (b) s += term(b, "x", false);
  if (c) s += term(c, "", false);
  return s;
}
const linear = (a: number, b: number) =>
  term(a, "x", true) + (b ? term(b, "", false) : "");
const pair = (a: number, b: number) => term(a, "x", true) + term(b, "y", false);
const paren = (n: number) => (n < 0 ? `(${n})` : `${n}`);

type Cand = { label: string; feedback: string };
/** The correct label plus the first three distinct, different candidates. */
function choices(correct: string, candidates: Cand[]): Draft["choices"] {
  const seen = new Set([correct]);
  const wrong: Cand[] = [];
  for (const c of candidates) {
    if (seen.has(c.label)) continue;
    seen.add(c.label);
    wrong.push(c);
  }
  if (wrong.length < 3) throw new Error("Insufficient distinct choices");
  return [{ label: correct, correct: true }, ...wrong.slice(0, 3)];
}
const qc = (x: Q, feedback: string): Cand => ({ label: m(x), feedback });
const pick = <T>(r: Random, items: readonly T[]): T =>
  items[r(0, items.length - 1)]!;
const signed = (r: Random, lo: number, hi: number) =>
  r(lo, hi) * (r(0, 1) ? 1 : -1);

type Built = { variant: number; draft: Draft };

/* ---------- quadratic-root-relations ---------- */

function realQuadratic(r: Random) {
  for (;;) {
    const a = r(1, 4) * (r(0, 3) === 0 ? -1 : 1);
    const b = signed(r, 1, 12);
    const c = signed(r, 1, 9);
    const disc = b * b - 4 * a * c;
    if (disc > 0) return { a, b, c, disc };
  }
}

function quadraticRootRelations(r: Random): Built {
  const variant = r(0, 5);
  if (variant === 2) {
    const a = r(1, 3);
    const root = signed(r, 1, 5);
    let other = signed(r, 1, 5);
    while (other === root || other + root === 0) other = signed(r, 1, 5);
    const c = a * root * other;
    const k = -a * (root + other);
    const equation = `${a === 1 ? "" : a}x^2 + kx ${c < 0 ? "-" : "+"} ${Math.abs(c)}`;
    return {
      variant,
      draft: {
        prompt: `One solution of $${equation}=0$ is $x=${root}$. What is the value of $k$?`,
        answer: "",
        hint: `Because $x=${root}$ is a solution, replacing $x$ by $${root}$ must make $${equation}=0$ true. Do that and solve the resulting one-variable equation for $k$.`,
        explanation: [
          `Substitute $x=${root}$: $${a}(${root})^2+k(${root})${c < 0 ? "-" : "+"}${Math.abs(c)}=0$, which is $${a * root * root + c}${root < 0 ? "-" : "+"}${Math.abs(root)}k=0$.`,
          `Solve for $k$: $k=${k}$.`,
          `Check with the relations: the product of the solutions is $c/a=${c}/${a}$, so the other solution is $${other}$, and the sum $${root}+(${other})$ equals $-k/a=${tex(q(-k, a))}$.`,
          `The value is $k=${k}$.`,
        ],
        choices: choices(`$${k}$`, [
          qc(
            whole(-k),
            "Check the sign: the sum of the solutions is $-b/a$, so $b=-a(r+s)$.",
          ),
          qc(
            q(k, a),
            "The sum of the solutions is $-b/a$. Multiply by $a$ to find $b$.",
          ),
          qc(
            whole(c),
            "That is the constant term, not the coefficient $k$ of $x$.",
          ),
          qc(
            q(-k, a),
            "That is the sum of the solutions. $k$ equals $-a$ times that sum.",
          ),
          qc(
            whole(a * (root - other)),
            "The coefficient of $x$ uses the sum of the solutions, not their difference.",
          ),
        ]),
      },
    };
  }
  if (variant === 3) {
    const denominator = pick(r, [2, 3, 4, 5]);
    let p = signed(r, 1, 7);
    while (gcd(p, denominator) !== 1) p = signed(r, 1, 7);
    const root = signed(r, 1, 4);
    const a = denominator;
    const b = -(p + denominator * root);
    const c = p * root;
    const sum = q(-b, a);
    const product = q(c, a);
    const other = q(p, denominator);
    return {
      variant,
      draft: {
        prompt: `One solution of $${quadratic(a, b, c)}=0$ is $x=${root}$. What is the other solution?`,
        answer: "",
        hint: `The two solutions of $${quadratic(a, b, c)}=0$ add up to $-b/a$, where $a$ and $b$ are the coefficients of $x^2$ and $x$. Subtract the known solution $${root}$ from that sum.`,
        explanation: [
          `For $${quadratic(a, b, c)}=0$, $a=${a}$ and $b=${b}$. The solutions add to $-b/a=${tex(sum)}$.`,
          `The other solution is $${tex(sum)}-(${root})=${tex(other)}$.`,
          `Check with the product: $${root}\\cdot ${tex(other)}=${tex(mul(whole(root), other))}$, and $c/a=${tex(product)}$.`,
        ],
        choices: choices(m(other), [
          qc(
            sum,
            "That is the sum of both solutions. Subtract the known solution to get the other one.",
          ),
          qc(
            product,
            "That is the product of the solutions. Divide it by the known solution, or subtract the known solution from the sum.",
          ),
          qc(
            neg(other),
            "Check the sign: the sum of the solutions is $-b/a$, then subtract the known solution.",
          ),
          qc(
            sub(neg(sum), whole(root)),
            "The sum of the solutions is $-b/a$, not $b/a$.",
          ),
          qc(
            add(sum, whole(root)),
            "Subtract the known solution from the sum; do not add it.",
          ),
        ]),
      },
    };
  }
  const { a, b, c, disc } = realQuadratic(r);
  const equation = `${quadratic(a, b, c)}=0`;
  const sum = q(-b, a);
  const product = q(c, a);
  const facts = `$a=${a}$, $b=${b}$ and $c=${c}$. Its discriminant is $b^2-4ac=${disc}>0$, so it has two real solutions $p$ and $q$.`;
  const relation =
    "Since $ax^2+bx+c=a(x-p)(x-q)=ax^2-a(p+q)x+apq$, matching coefficients gives $p+q=-\\frac{b}{a}$ and $pq=\\frac{c}{a}$.";
  const read = `$p+q=-\\frac{${b}}{${a}}=${tex(sum)}$ and $pq=\\frac{${c}}{${a}}=${tex(product)}$`;
  if (variant === 0) {
    return {
      variant,
      draft: {
        prompt: `Without solving, find the sum of the two real solutions of $${equation}$.`,
        answer: "",
        hint: `In $${equation}$, call the coefficient of $x^2$ $a$ and the coefficient of $x$ $b$. If the solutions are $p$ and $q$, then $ax^2+bx+c=a(x-p)(x-q)$. Compare the coefficient of $x$ on both sides.`,
        explanation: [
          `The equation has ${facts}`,
          relation,
          `So ${read}.`,
          `The sum is $${tex(sum)}$.`,
        ],
        choices: choices(m(sum), [
          qc(
            q(b, a),
            "The sum is $-b/a$. The sign of the $x$ coefficient reverses.",
          ),
          qc(product, "$c/a$ is the product of the solutions, not their sum."),
          qc(whole(-b), "Divide by $a$: the sum is $-b/a$, not $-b$."),
          qc(
            q(-b, 2 * a),
            "$-b/(2a)$ is the $x$-coordinate of the vertex, the average of the solutions. The sum is twice that.",
          ),
          qc(
            neg(product),
            "$-c/a$ is not a standard relation here; the sum uses the $x$ coefficient.",
          ),
          qc(
            q(b, 2 * a),
            "The sum is $-b/a$: the sign reverses and there is no extra factor of 2.",
          ),
          qc(
            add(sum, product),
            "The sum of the solutions uses only the $x$ coefficient and $a$.",
          ),
        ]),
      },
    };
  }
  if (variant === 1) {
    return {
      variant,
      draft: {
        prompt: `Without solving, find the product of the two real solutions of $${equation}$.`,
        answer: "",
        hint: `In $${equation}$, call the coefficient of $x^2$ $a$ and the constant term $c$. If the solutions are $p$ and $q$, then $ax^2+bx+c=a(x-p)(x-q)$. Compare the constant terms on both sides.`,
        explanation: [
          `The equation has ${facts}`,
          relation,
          `So ${read}.`,
          `The product is $${tex(product)}$.`,
        ],
        choices: choices(m(product), [
          qc(sum, "$-b/a$ is the sum of the solutions, not their product."),
          qc(
            neg(product),
            "The constant term $apq$ equals $c$ with its own sign: $pq=c/a$.",
          ),
          qc(whole(c), "Divide by $a$: the product is $c/a$, not $c$."),
          qc(q(a, c), "The product is $c/a$, not $a/c$."),
          qc(
            q(c, 2 * a),
            "Dividing by $2a$ belongs to the vertex formula; the product is $c/a$.",
          ),
        ]),
      },
    };
  }
  if (variant === 4) {
    const value = sub(mul(sum, sum), mul(whole(2), product));
    return {
      variant,
      draft: {
        prompt: `The real solutions of $${equation}$ are $p$ and $q$. What is the value of $p^2+q^2$?`,
        answer: "",
        hint: `Expanding $(p+q)^2$ gives $p^2+2pq+q^2$, so $p^2+q^2$ can be written using only $p+q$ and $pq$. Read both from the coefficients of $${equation}$.`,
        explanation: [
          `The equation has ${facts}`,
          relation,
          `Use $p^2+q^2=(p+q)^2-2pq$. With ${read}, this is $(${tex(sum)})^2-2(${tex(product)})=${tex(value)}$.`,
        ],
        choices: choices(m(value), [
          qc(
            mul(sum, sum),
            "$(p+q)^2$ also contains $2pq$. Subtract $2pq$ to leave $p^2+q^2$.",
          ),
          qc(sub(mul(sum, sum), product), "Subtract $2pq$, not $pq$."),
          qc(
            add(mul(sum, sum), mul(whole(2), product)),
            "$(p+q)^2=p^2+2pq+q^2$, so subtract $2pq$.",
          ),
          qc(
            sub(mul(whole(2), product), mul(sum, sum)),
            "The subtraction runs the other way: $(p+q)^2-2pq$.",
          ),
          qc(
            sub(sum, mul(whole(2), product)),
            "Square the sum first: $(p+q)^2-2pq$.",
          ),
        ]),
      },
    };
  }
  const value = div(sum, product);
  return {
    variant: 5,
    draft: {
      prompt: `The real solutions of $${equation}$ are $p$ and $q$. What is the value of $\\frac{1}{p}+\\frac{1}{q}$?`,
      answer: "",
      hint: `Add $\\frac{1}{p}+\\frac{1}{q}$ over the common denominator $pq$; the numerator is $p+q$. Then read the coefficients of $${equation}$ to find $p+q$ and $pq$.`,
      explanation: [
        `The equation has ${facts}`,
        relation,
        `Combine: $\\frac{1}{p}+\\frac{1}{q}=\\frac{p+q}{pq}$. With ${read}, this is $\\frac{${tex(sum)}}{${tex(product)}}=${tex(value)}$.`,
      ],
      choices: choices(m(value), [
        qc(
          div(product, sum),
          "That is $\\frac{pq}{p+q}$. The numerator is the sum $p+q$ and the denominator is the product.",
        ),
        qc(neg(value), "Check the signs of the sum and the product."),
        qc(sum, "That is only the numerator, $p+q$. Divide by $pq$."),
        qc(product, "That is only the denominator, $pq$."),
        qc(
          add(sum, product),
          "Combine the fractions over $pq$; do not add the sum and product.",
        ),
      ]),
    },
  };
}

/* ---------- system-expression-value ---------- */

function systemExpressionValue(r: Random): Built {
  const variant = r(0, 5);
  const coefficient = () => signed(r, 1, 5);
  const solve = (a: number, b: number, x0: number, y0: number) =>
    a * x0 + b * y0;
  const target = (tx: number, ty: number) => pair(tx, ty);
  const x0 = r(-4, 5);
  const y0 = r(-4, 5);

  if (variant === 2 || variant === 5) {
    const a0 = signed(r, 1, 4);
    const b0 = signed(r, 1, 4);
    const p0 = signed(r, 1, 9);
    const multipliers: number[] = [];
    const wanted = variant === 2 ? 2 : 3;
    while (multipliers.length < wanted) {
      const next =
        multipliers.length === wanted - 1 && r(0, 3) === 0 ? -r(1, 3) : r(1, 6);
      if (!multipliers.includes(next) && next !== 0) multipliers.push(next);
    }
    const [m1, m2, m3] = multipliers as [number, number, number?];
    const goalMultiplier = variant === 2 ? m2 : m3!;
    const first = `${pair(m1 * a0, m1 * b0)}=${m1 * p0}`;
    const second = variant === 5 ? `${pair(m2 * a0, m2 * b0)}=${m2 * p0}` : "";
    const goal = target(goalMultiplier * a0, goalMultiplier * b0);
    const answer = goalMultiplier * p0;
    const givens = variant === 2 ? `$${first}$` : `$${first}$ and $${second}$`;
    const undetermined: Cand = {
      label: "The value cannot be determined",
      feedback:
        variant === 2
          ? "The equation alone cannot fix $x$ and $y$, but it does not need to: the target's coefficients are a constant multiple of the equation's, so its value is fixed."
          : "The two equations describe the same line, so $x$ and $y$ are not fixed separately. The target is still a multiple of that line's equation, so its value is fixed.",
    };
    return {
      variant,
      draft: {
        prompt: `If ${givens}, what is the value of $${goal}$?`,
        answer: "",
        hint:
          variant === 2
            ? `Compare the coefficients of $${goal}$ with those of $${first.split("=")[0]}$: one number multiplies both coefficients of the equation to give the target's. Apply that same number to the right side, ${m1 * p0}.`
            : `Compare $${goal}$ with the left sides of $${first.split("=")[0]}$ and $${second.split("=")[0]}$. Each is a multiple of the same pair of coefficients, so find the multiple that gives the target and apply it to the right side.`,
        explanation: [
          variant === 2
            ? `Each coefficient of $${goal}$ is $\\frac{${goalMultiplier}}{${m1}}$ times the matching coefficient of $${first.split("=")[0]}$.`
            : `The left sides are $${m1}$, $${m2}$ and $${goalMultiplier}$ times $${pair(a0, b0)}$. The two equations describe one line, so $x$ and $y$ cannot be found separately.`,
          variant === 2
            ? `Multiply the right side the same way: $\\frac{${goalMultiplier}}{${m1}}\\cdot ${m1 * p0}=${answer}$.`
            : `The first equation says $${pair(a0, b0)}=${p0}$. Multiplying by ${goalMultiplier} gives $${goal}=${goalMultiplier}\\cdot ${paren(p0)}=${answer}$.`,
          `The value is $${answer}$ even though $x$ and $y$ are not determined individually.`,
        ],
        choices: choices(`$${answer}$`, [
          undetermined,
          {
            label: `$${m1 * p0}$`,
            feedback:
              "That is the right side of the given equation. The target has different coefficients, so scale the right side too.",
          },
          {
            label: `$${p0}$`,
            feedback:
              "That is the value of the reduced expression. Scale it to match the target's coefficients.",
          },
          {
            label: `$${answer + p0}$`,
            feedback:
              "Scaling an equation multiplies its right side; it does not add to it.",
          },
          {
            label: `$${-answer}$`,
            feedback:
              "Check the sign of the multiplier you applied to the right side.",
          },
        ]),
      },
    };
  }

  if (variant === 4) {
    const a = r(1, 7);
    let b = signed(r, 1, 7);
    while (Math.abs(b) === a) b = signed(r, 1, 7);
    const plus = r(0, 1) === 0;
    const p = solve(a, b, x0, y0);
    const second = solve(b, a, x0, y0);
    const first = `${pair(a, b)}=${p}`;
    const other = `${pair(b, a)}=${second}`;
    const goal = plus ? "x + y" : "x - y";
    const value = plus ? x0 + y0 : x0 - y0;
    const combined = plus ? p + second : p - second;
    const factor = plus ? a + b : a - b;
    return {
      variant,
      draft: {
        prompt: `If $${first}$ and $${other}$, what is the value of $${goal}$?`,
        answer: "",
        hint: `${plus ? "Add the equations" : "Subtract the second equation from the first in"} $${first}$ and $${other}$. The $x$ and $y$ coefficients on the left become equal, so the left side is a multiple of $${goal}$.`,
        explanation: [
          `${plus ? "Add" : "Subtract"} the equations: the left side is $${plus ? `(${a}+${paren(b)})x+(${paren(b)}+${a})y` : `(${a}-${paren(b)})x+(${paren(b)}-${a})y`}$ and the right side is $${p}${plus ? "+" : "-"}${paren(second)}=${combined}$.`,
          plus
            ? `That gives $${factor}x+${factor}y=${combined}$, so $${factor}(x+y)=${combined}$.`
            : `That gives $${factor}x+${paren(-factor)}y=${combined}$, so $${factor}(x-y)=${combined}$.`,
          `Divide by ${factor}: $${goal}=${value}$.`,
        ],
        choices: choices(`$${value}$`, [
          {
            label: `$${combined}$`,
            feedback: `Divide by the common factor ${factor} after combining the equations.`,
          },
          {
            label: `$${tex(q(combined, 2))}$`,
            feedback: `The common factor is ${factor}, not 2.`,
          },
          {
            label: `$${-value}$`,
            feedback: "Check the signs when combining the equations.",
          },
          {
            label: `$${tex(q(plus ? p - second : p + second, plus ? a - b : a + b))}$`,
            feedback: `${plus ? "Adding" : "Subtracting"} the equations is what makes the coefficients match.`,
          },
          {
            label: `$${p}$`,
            feedback: "That is the right side of one equation only.",
          },
          {
            label: `$${second}$`,
            feedback: "That is the right side of one equation only.",
          },
          {
            label: `$${tex(q(combined, factor === -1 ? 2 : factor + 1))}$`,
            feedback: `The common factor after combining is ${factor}.`,
          },
        ]),
      },
    };
  }

  let a: number, b: number, c: number, d: number, u: number, v: number;
  for (;;) {
    a = coefficient();
    b = coefficient();
    c = coefficient();
    d = coefficient();
    u = 1;
    v = variant === 0 ? 1 : variant === 1 ? -1 : 1;
    if (variant === 3) {
      u = signed(r, 1, 3);
      v = signed(r, 1, 3);
      if (Math.abs(u) === 1 && Math.abs(v) === 1) continue;
    }
    const tx = u * a + v * c;
    const ty = u * b + v * d;
    if (
      a * d - b * c !== 0 &&
      tx !== 0 &&
      ty !== 0 &&
      Math.abs(tx) <= 20 &&
      Math.abs(ty) <= 20
    )
      break;
  }
  const p = solve(a, b, x0, y0);
  const second = solve(c, d, x0, y0);
  const tx = u * a + v * c;
  const ty = u * b + v * d;
  const first = `${pair(a, b)}=${p}`;
  const other = `${pair(c, d)}=${second}`;
  const goal = target(tx, ty);
  const answer = u * p + v * second;
  return {
    variant,
    draft: {
      prompt: `If $${first}$ and $${other}$, what is the value of $${goal}$?`,
      answer: "",
      hint: `Look for multipliers $u$ and $v$ so that $u(${pair(a, b)})+v(${pair(c, d)})$ has the same $x$ terms and $y$ terms as $${goal}$. Match the $x$ terms first, confirm the $y$ terms, and then use the same $u$ and $v$ on the right sides. You do not need $x$ or $y$ separately.`,
      explanation: [
        `Look for multipliers $u$ and $v$ so that $u(${pair(a, b)})+v(${pair(c, d)})=${goal}$. Matching $x$: $${u}\\cdot ${paren(a)}+${paren(v)}\\cdot ${paren(c)}=${tx}$. Matching $y$: $${u}\\cdot ${paren(b)}+${paren(v)}\\cdot ${paren(d)}=${ty}$. So $u=${u}$ and $v=${v}$.`,
        `Apply the same multipliers to the right sides: $${u}\\cdot ${paren(p)}+${paren(v)}\\cdot ${paren(second)}=${answer}$.`,
        `So $${goal}=${answer}$. The system has one solution, but it was not needed.`,
      ],
      choices: choices(`$${answer}$`, [
        {
          label: `$${p + second}$`,
          feedback:
            "Add the right sides only after multiplying each equation by its own multiplier.",
        },
        {
          label: `$${u * p + second}$`,
          feedback: `Multiply the second equation's right side by ${v} as well.`,
        },
        {
          label: `$${p + v * second}$`,
          feedback: `Multiply the first equation's right side by ${u} as well.`,
        },
        {
          label: `$${u * p - v * second}$`,
          feedback: `The second multiplier is ${v}; keep its sign when combining.`,
        },
        {
          label: `$${-answer}$`,
          feedback: "Check the signs of the multipliers.",
        },
        {
          label: `$${p * second}$`,
          feedback:
            "Combine the right sides with the multipliers; do not multiply them.",
        },
        {
          label: `$${p}$`,
          feedback:
            "That is the right side of the first equation only. Include the second equation with its multiplier.",
        },
        {
          label: `$${second}$`,
          feedback:
            "That is the right side of the second equation only. Include the first equation with its multiplier.",
        },
      ]),
    },
  };
}

/* ---------- variation-constant ---------- */

const directContexts = [
  {
    y: "C",
    x: "n",
    text: "The cost $C$, in dollars, of a bulk order varies directly with the number $n$ of items ordered.",
  },
  {
    y: "d",
    x: "t",
    text: "At a steady speed, the distance $d$, in miles, that a train travels varies directly with the time $t$, in hours.",
  },
  {
    y: "m",
    x: "V",
    text: "The mass $m$, in grams, of a block cut from one metal varies directly with its volume $V$, in cubic centimeters.",
  },
  {
    y: "P",
    x: "h",
    text: "A worker's pay $P$, in dollars, varies directly with the number $h$ of hours worked.",
  },
];
const inverseContexts = [
  {
    y: "t",
    x: "n",
    text: "The time $t$, in days, that a crew needs for a job varies inversely with the number $n$ of workers, who all work at the same pace.",
  },
  {
    y: "t",
    x: "s",
    text: "The time $t$, in hours, to drive a fixed route varies inversely with the average speed $s$, in miles per hour.",
  },
  {
    y: "V",
    x: "P",
    text: "At constant temperature, the volume $V$, in liters, of a gas varies inversely with its pressure $P$, in kilopascals.",
  },
  {
    y: "w",
    x: "n",
    text: "A fixed prize pool is split equally, so each winner's share $w$, in dollars, varies inversely with the number $n$ of winners.",
  },
];
type Context = { y: string; x: string; text: string };
const directEquation = (ctx: Context, k: Q) =>
  `${ctx.y}=${eq(k, q(1)) ? "" : tex(k)}${ctx.x}`;
const inverseEquation = (ctx: Context, k: Q) =>
  `${ctx.y}=\\frac{${tex(k)}}{${ctx.x}}`;

function coprimeRatio(r: Random) {
  for (;;) {
    const n = r(2, 9);
    const d = pick(r, [1, 2, 3, 4]);
    if (gcd(n, d) === 1) return { n, d };
  }
}

/** Direct variation with mixed-number inputs and a fractional constant. */
function fractionalDirectVariation(r: Random): Built {
  const ctx = pick(r, directContexts);
  const k = pick(r, [
    q(3, 2),
    q(5, 2),
    q(3, 4),
    q(5, 4),
    q(7, 2),
    q(2, 3),
    q(4, 3),
    q(5, 3),
  ]);
  const mixedNumber = (x: Q) => writeRational(x, "mixed");
  const label = (x: Q) => `$${mixedNumber(x)}$`;
  // Quarters or halves that are not whole numbers.
  const quarter = (): Q => {
    for (;;) {
      const x = q(r(5, 15), pick(r, [2, 4]));
      if (x[1] !== 1) return x;
    }
  };
  const x1 = quarter();
  let x2 = quarter();
  while (eq(x1, x2)) x2 = quarter();
  const y1 = mul(k, x1);
  const y2 = mul(k, x2);
  // A given that contains the answer's digits ("8¾" inside "18¾") would
  // look like a hint to the answer: draw again.
  if (
    [x1, y1, x2].some((v) =>
      writeRational(v, "mixed").includes(writeRational(y2, "mixed")),
    )
  )
    throw new Error("Insufficient distinct choices");
  return {
    variant: 0,
    draft: {
      prompt: `${ctx.text} When $${ctx.x}=${mixedNumber(x1)}$, $${ctx.y}=${mixedNumber(y1)}$. What is $${ctx.y}$ when $${ctx.x}=${mixedNumber(x2)}$?`,
      answer: "",
      hint: `Direct variation means $${ctx.y}=k${ctx.x}$ for one constant $k$. Use the pair $${ctx.x}=${mixedNumber(x1)}$, $${ctx.y}=${mixedNumber(y1)}$ to find $k$ first.`,
      explanation: [
        `"Varies directly" means $${ctx.y}$ is always the same number $k$ times $${ctx.x}$: $${ctx.y}=k${ctx.x}$.`,
        `Find $k$ from the pair you know. $${mixedNumber(y1)}=k\\cdot ${mixedNumber(x1)}$, so divide: $k=${mixedNumber(y1)}\\div ${mixedNumber(x1)}=${tex(k)}$.`,
        `The same $k$ works for every pair, so $${ctx.y}=${tex(k)}\\cdot ${mixedNumber(x2)}=${mixedNumber(y2)}$.`,
        `When $${ctx.x}=${mixedNumber(x2)}$, $${ctx.y}=${mixedNumber(y2)}$.`,
      ],
      choices: choices(label(y2), [
        {
          label: label(div(mul(y1, x1), x2)),
          feedback:
            "That treats the relationship as inverse variation. In direct variation the ratio $y/x$ stays constant.",
        },
        {
          label: label(add(y1, sub(x2, x1))),
          feedback:
            "Direct variation multiplies by a constant; it does not add the same amount to both quantities.",
        },
        {
          label: label(mul(y1, x2)),
          feedback: "Find $k=y/x$ first, then multiply $k$ by the new input.",
        },
        {
          label: label(div(mul(x1, x2), y1)),
          feedback: "That uses the ratio $x/y$. The constant is $y/x$.",
        },
        {
          label: label(y1),
          feedback:
            "$y$ changes when $x$ changes; use the constant ratio $y/x$ to find the new value.",
        },
      ]),
    },
  };
}

function variationConstant(r: Random, axes?: Record<string, string>): Built {
  if (axes?.values === "fractional") return fractionalDirectVariation(r);
  const variant = r(0, 5);
  if (variant === 0) {
    const ctx = pick(r, directContexts);
    const { n, d } = coprimeRatio(r);
    const s1 = r(1, 5);
    let s2 = r(1, 9);
    while (s2 === s1) s2 = r(1, 9);
    const x1 = d * s1;
    const y1 = n * s1;
    const x2 = d * s2;
    const answer = n * s2;
    const k = q(n, d);
    return {
      variant,
      draft: {
        prompt: `${ctx.text} When $${ctx.x}=${x1}$, $${ctx.y}=${y1}$. What is $${ctx.y}$ when $${ctx.x}=${x2}$?`,
        answer: "",
        hint: `Direct variation means $${ctx.y}=k${ctx.x}$ for one constant $k$. Use the pair $${ctx.x}=${x1}$, $${ctx.y}=${y1}$ to find $k$ first.`,
        explanation: [
          `"Varies directly" means $${ctx.y}$ is always the same number $k$ times $${ctx.x}$: $${ctx.y}=k${ctx.x}$.`,
          `Find $k$ from the pair you know. $${y1}=k\\cdot ${x1}$, so divide: $k=\\frac{${y1}}{${x1}}=${tex(k)}$.`,
          `The same $k$ works for every pair, so $${ctx.y}=${tex(k)}\\cdot ${x2}=${answer}$.`,
          `When $${ctx.x}=${x2}$, $${ctx.y}=${answer}$.`,
        ],
        choices: choices(`$${answer}$`, [
          qc(
            q(y1 * x1, x2),
            "That treats the relationship as inverse variation. In direct variation the ratio $y/x$ stays constant.",
          ),
          qc(
            whole(y1 + x2 - x1),
            "Direct variation multiplies by a constant; it does not add the same amount to both quantities.",
          ),
          qc(
            whole(y1 * x2),
            "Find $k=y/x$ first, then multiply $k$ by the new input.",
          ),
          qc(
            q(x1 * x2, y1),
            "That uses the ratio $x/y$. The constant is $y/x$.",
          ),
          qc(
            whole(y1),
            "$y$ changes when $x$ changes; use the constant ratio $y/x$ to find the new value.",
          ),
        ]),
      },
    };
  }
  if (variant === 1) {
    const ctx = pick(r, inverseContexts);
    const x1 = r(2, 12);
    const y1 = r(2, 12);
    const K = x1 * y1;
    const divisors = Array.from({ length: 40 }, (_, i) => i + 1).filter(
      (n) => K % n === 0 && n !== x1 && n > 1,
    );
    const x2 = pick(r, divisors);
    const answer = K / x2;
    return {
      variant,
      draft: {
        prompt: `${ctx.text} When $${ctx.x}=${x1}$, $${ctx.y}=${y1}$. What is $${ctx.y}$ when $${ctx.x}=${x2}$?`,
        answer: "",
        hint: `Inverse variation means $${ctx.y}=\\frac{k}{${ctx.x}}$, so $${ctx.x}${ctx.y}$ is constant. Use $${ctx.x}=${x1}$ and $${ctx.y}=${y1}$ to find $k$ first.`,
        explanation: [
          `"Varies inversely" means the product $${ctx.x}\\cdot ${ctx.y}$ always equals the same number $k$: $${ctx.y}=\\frac{k}{${ctx.x}}$. As one grows, the other shrinks.`,
          `Find $k$ from the pair you know: $k=${x1}\\cdot ${y1}=${K}$.`,
          `The product stays ${K}, so $${ctx.y}=\\frac{${K}}{${x2}}=${answer}$.`,
          `When $${ctx.x}=${x2}$, $${ctx.y}=${answer}$.`,
        ],
        choices: choices(`$${answer}$`, [
          qc(
            q(y1 * x2, x1),
            "That treats the relationship as direct variation. Here the product $xy$ stays constant, so $y$ falls as $x$ rises.",
          ),
          qc(
            whole(y1 - (x2 - x1)),
            "Inverse variation divides a constant by $x$; it does not subtract the same amount.",
          ),
          qc(
            whole(K),
            "That is the constant $k=xy$. Divide it by the new $x$.",
          ),
          qc(
            whole(y1 * x2),
            "Multiplying by the new input gives a direct-variation answer. Divide $k$ by it.",
          ),
          qc(
            whole(y1),
            "$y$ changes when $x$ changes; use the constant product $xy$ to find the new value.",
          ),
        ]),
      },
    };
  }
  if (variant === 2) {
    const direct = r(0, 1) === 0;
    const ctx = pick(r, direct ? directContexts : inverseContexts);
    let x1: number;
    let y1: number;
    if (direct) {
      const { n, d } = coprimeRatio(r);
      const s = r(1, 5);
      x1 = d * s;
      y1 = n * s;
    } else {
      x1 = r(2, 12);
      y1 = r(2, 12);
    }
    const k = direct ? q(y1, x1) : whole(x1 * y1);
    const correct = direct ? directEquation(ctx, k) : inverseEquation(ctx, k);
    const additive = y1 - x1;
    const candidates: Cand[] = direct
      ? [
          {
            label: `$${inverseEquation(ctx, whole(x1 * y1))}$`,
            feedback:
              "That is inverse variation. Direct variation has a constant ratio $y/x$.",
          },
          {
            label: `$${ctx.y}=${ctx.x}${additive < 0 ? "-" : "+"}${Math.abs(additive)}$`,
            feedback:
              "Direct variation multiplies the input by a constant; it does not add a constant.",
          },
          {
            label: `$${directEquation(ctx, q(x1, y1))}$`,
            feedback: "The constant is $y/x$, not $x/y$.",
          },
          {
            label: `$${directEquation(ctx, whole(x1 * y1))}$`,
            feedback:
              "The constant of direct variation is $y/x$, not the product $xy$.",
          },
        ]
      : [
          {
            label: `$${directEquation(ctx, q(y1, x1))}$`,
            feedback:
              "That is direct variation. Inverse variation has a constant product $xy$.",
          },
          {
            label: `$${directEquation(ctx, whole(x1 * y1))}$`,
            feedback:
              "The product $xy$ is the constant in $y=k/x$; it does not multiply $x$.",
          },
          {
            label: `$${ctx.y}=\\frac{${ctx.x}}{${x1 * y1}}$`,
            feedback: "In inverse variation the input is in the denominator.",
          },
          {
            label: `$${inverseEquation(ctx, whole(x1 + y1))}$`,
            feedback: "The constant is the product $xy$, not the sum.",
          },
        ];
    return {
      variant,
      draft: {
        prompt: `${ctx.text} The value of $${ctx.y}$ is ${y1} when $${ctx.x}$ is ${x1}. Which equation models the relationship?`,
        answer: "",
        hint: direct
          ? `Direct variation has the form $${ctx.y}=k${ctx.x}$. Substitute $${ctx.x}=${x1}$ and $${ctx.y}=${y1}$ and solve for $k$.`
          : `Inverse variation has the form $${ctx.y}=\\frac{k}{${ctx.x}}$. Substitute $${ctx.x}=${x1}$ and $${ctx.y}=${y1}$ and solve for $k$.`,
        explanation: direct
          ? [
              `"Varies directly" means $${ctx.y}$ is always the same number $k$ times $${ctx.x}$: $${ctx.y}=k${ctx.x}$.`,
              `Put in the pair you know: $${y1}=k\\cdot ${x1}$. Divide both sides by ${x1}: $k=${tex(k)}$.`,
              `The equation is $${correct}$.`,
            ]
          : [
              `"Varies inversely" means the product of the two quantities stays the same number $k$: $${ctx.y}=\\frac{k}{${ctx.x}}$.`,
              `Put in the pair you know: $${y1}=\\frac{k}{${x1}}$. Multiply both sides by ${x1}: $k=${x1}\\cdot ${y1}=${x1 * y1}$.`,
              `The equation is $${correct}$.`,
            ],
        choices: choices(`$${correct}$`, candidates),
      },
    };
  }
  if (variant === 3) {
    const truth = r(0, 2);
    const pickRows = (values: number[]) => {
      const rows = [...values];
      while (rows.length > 3) rows.splice(r(0, rows.length - 1), 1);
      return rows;
    };
    let xs: number[];
    let ys: number[];
    let correct: string;
    let kind: string;
    let reason: string[];
    if (truth === 0) {
      const n = r(2, 7);
      const d = n % 2 === 0 ? 1 : pick(r, [1, 2]);
      const k = q(n, d);
      xs = pickRows([1, 2, 3, 4, 5, 6]).map((s) => d * s);
      ys = xs.map((x) => (n * x) / d);
      correct = `y=${eq(k, q(1)) ? "" : tex(k)}x`;
      kind = "direct";
      reason = [
        `In every row $y\\div x=${tex(k)}$, so $y$ varies directly with $x$ and the equation is $${correct}$.`,
      ];
    } else if (truth === 1) {
      const K = pick(r, [12, 24, 36, 48]);
      const divisors = Array.from({ length: 48 }, (_, i) => i + 1).filter(
        (n) => K % n === 0,
      );
      xs = pickRows(divisors);
      ys = xs.map((x) => K / x);
      correct = `y=\\frac{${K}}{x}`;
      kind = "inverse";
      reason = [
        `In every row $xy=${K}$, so $y$ varies inversely with $x$ and the equation is $${correct}$.`,
      ];
    } else {
      const slope = r(2, 4);
      const intercept = signed(r, 1, 5);
      for (;;) {
        xs = pickRows([1, 2, 3, 4, 5, 6]);
        ys = xs.map((x) => slope * x + intercept);
        if (ys.every((y) => y !== 0)) break;
      }
      correct = `y=${slope}x${intercept < 0 ? "-" : "+"}${Math.abs(intercept)}`;
      kind = "linear";
      reason = [
        `Here $y\\div x$ and $xy$ both change from row to row, so this is neither direct nor inverse variation.`,
        `$y$ rises by ${slope} for each increase of 1 in $x$, so $y=${slope}x+b$; the first row gives $b=${ys[0]}-${slope}\\cdot ${xs[0]}=${intercept}$. The equation is $${correct}$.`,
      ];
    }
    reason.unshift(
      `In direct variation $y\\div x$ is the same in every row; in inverse variation $x\\cdot y$ is. Check each row for both. The ratios are ${xs.map((x, i) => `$${tex(q(ys[i]!, x))}$`).join(", ")}; the products are ${xs.map((x, i) => `$${x * ys[i]!}$`).join(", ")}.`,
    );
    const [x1, x2, x3] = xs as [number, number, number];
    const [y1, y2, y3] = ys as [number, number, number];
    const rows = xs.map((x, i) => [x, ys[i]!] as const);
    type Model = { label: string; at: (x: number) => Q; feedback?: string };
    const models: Model[] = [
      {
        label: `y=${eq(q(y1, x1), q(1)) ? "" : tex(q(y1, x1))}x`,
        at: (x) => mul(q(y1, x1), whole(x)),
      },
      { label: `y=\\frac{${x1 * y1}}{x}`, at: (x) => q(x1 * y1, x) },
      {
        label: `y=x${y1 - x1 < 0 ? "-" : "+"}${Math.abs(y1 - x1)}`,
        at: (x) => whole(x + y1 - x1),
      },
      { label: `y=${tex(q(x1, y1))}x`, at: (x) => mul(q(x1, y1), whole(x)) },
    ];
    if (kind === "linear") {
      const slope = (y2 - y1) / (x2 - x1);
      models.push(
        { label: `y=${slope}x`, at: (x) => whole(slope * x) },
        { label: correct, at: (x) => whole(slope * x + (y1 - slope * x1)) },
      );
    }
    const fits = (model: Model) =>
      rows.every(([x, y]) => eq(model.at(x), whole(y)));
    const winners = models.filter(
      (model) => model.label === correct || fits(model),
    );
    const unique = new Set(winners.map((model) => model.label));
    if (unique.size !== 1 || !unique.has(correct))
      throw new Error("Table model is not unique");
    // Distinct labels can still be the same function (for example y=x and
    // y=x+0 when the first row has y=x); offer each function once.
    const seenFunctions = new Set<string>();
    const wrong: Cand[] = models
      .filter((model) => !fits(model))
      .filter((model) => {
        const signature = [1, 2, 3, 5, 7, 11]
          .map((x) => tex(model.at(x)))
          .join("|");
        if (seenFunctions.has(signature)) return false;
        seenFunctions.add(signature);
        return true;
      })
      .map((model) => {
        const [x, y] = rows.find(([x, y]) => !eq(model.at(x), whole(y)))!;
        return {
          label: `$${model.label}$`,
          feedback: `Test this equation on the row $x=${x}$: it gives $y=${tex(model.at(x))}$, but the table shows $y=${y}$.`,
        };
      });
    return {
      variant,
      draft: {
        prompt: `The table shows three values of $y$ for three values of $x$. Which equation fits every row?\n$\\begin{array}{c|ccc}x&${x1}&${x2}&${x3}\\\\\\hline y&${y1}&${y2}&${y3}\\end{array}$`,
        answer: "",
        hint: `Direct variation keeps $y\\div x$ constant; inverse variation keeps $xy$ constant. Compute both for the rows $x=${x1}$, $x=${x2}$ and $x=${x3}$ and see which, if either, stays the same.`,
        explanation: reason,
        choices: choices(`$${correct}$`, wrong),
      },
    };
  }
  if (variant === 4) {
    const direct = r(0, 1) === 0;
    const a = r(2, 9);
    let b = r(2, 9);
    while (b === a) b = r(2, 9);
    const factor = direct ? q(b, a) : q(a, b);
    const inverse = direct ? q(a, b) : q(b, a);
    const word = direct ? "directly" : "inversely";
    const times = (value: Q) => `$y$ is multiplied by $${tex(value)}$`;
    const change =
      b > a ? `$y$ increases by $${b - a}$` : `$y$ decreases by $${a - b}$`;
    return {
      variant,
      draft: {
        prompt: `The quantity $y$ varies ${word} with $x$. By what factor does $y$ change when $x$ changes from ${a} to ${b}?`,
        answer: "",
        hint: direct
          ? `Direct variation means $y=kx$. Compare $y$ at $x=${a}$ with $y$ at $x=${b}$ using the same $k$ and divide the second by the first.`
          : `Inverse variation means $y=\\frac{k}{x}$. Compare $y$ at $x=${a}$ with $y$ at $x=${b}$ using the same $k$ and divide the second by the first.`,
        explanation: [
          direct
            ? `"Varies directly" means $y=kx$ for one number $k$, so $y$ grows by the same factor as $x$.`
            : `"Varies inversely" means $y=\\frac{k}{x}$ for one number $k$, so $y$ changes by the flipped factor.`,
          direct
            ? `With $y=kx$, the new value is $k\\cdot ${b}$ and the old value is $k\\cdot ${a}$. Their ratio is $\\frac{${b}}{${a}}=${tex(factor)}$.`
            : `With $y=\\frac{k}{x}$, the new value is $\\frac{k}{${b}}$ and the old value is $\\frac{k}{${a}}$. Their ratio is $\\frac{${a}}{${b}}=${tex(factor)}$.`,
          `So ${times(factor)}.`,
        ],
        choices: choices(times(factor), [
          {
            label: times(inverse),
            feedback: direct
              ? "That is the factor for inverse variation. In direct variation $y$ changes by the same factor as $x$."
              : "That is the factor for direct variation. In inverse variation $y$ changes by the reciprocal of the factor for $x$.",
          },
          {
            label: change,
            feedback:
              "Variation compares quantities by multiplication. Find the factor, not the difference.",
          },
          {
            label: times(mul(factor, factor)),
            feedback:
              "Square factors belong to relationships like $y=kx^2$, not this one.",
          },
        ]),
      },
    };
  }
  const direct = r(0, 1) === 0;
  const ctx = pick(r, direct ? directContexts : inverseContexts);
  let x1: number;
  let y1: number;
  if (direct) {
    x1 = r(2, 9);
    y1 = r(2, 15);
    while (y1 === x1) y1 = r(2, 15);
  } else {
    x1 = r(2, 12);
    y1 = r(2, 12);
  }
  const constant = direct ? q(y1, x1) : whole(x1 * y1);
  const form = direct ? `${ctx.y}=k${ctx.x}` : `${ctx.y}=\\frac{k}{${ctx.x}}`;
  return {
    variant: 5,
    draft: {
      prompt: `${ctx.text} The relationship is $${form}$, and $${ctx.y}=${y1}$ when $${ctx.x}=${x1}$. What is the constant of variation $k$?`,
      answer: "",
      hint: `Substitute $${ctx.x}=${x1}$ and $${ctx.y}=${y1}$ into $${form}$ and solve for $k$.`,
      explanation: direct
        ? [
            `The constant of variation $k$ is the fixed number in $${form}$.`,
            `Put in the pair you know: $${y1}=k\\cdot ${x1}$.`,
            `Divide both sides by ${x1} to get $k$ alone: $k=\\frac{${y1}}{${x1}}=${tex(constant)}$.`,
            `The constant of variation is $k=${tex(constant)}$.`,
          ]
        : [
            `The constant of variation $k$ is the fixed number in $${form}$.`,
            `Put in the pair you know: $${y1}=\\frac{k}{${x1}}$.`,
            `Multiply both sides by ${x1} to get $k$ alone: $k=${x1}\\cdot ${y1}=${x1 * y1}$.`,
            `The constant of variation is $k=${x1 * y1}$.`,
          ],
      choices: choices(
        m(constant),
        direct
          ? [
              qc(q(x1, y1), "In $y=kx$, $k=y/x$, not $x/y$."),
              qc(
                whole(x1 * y1),
                "The product $xy$ is the constant for inverse variation. Here divide $y$ by $x$.",
              ),
              qc(
                whole(y1 - x1),
                "The constant multiplies $x$; it is not a difference.",
              ),
              qc(
                whole(x1 + y1),
                "The constant multiplies $x$; it is not a sum.",
              ),
            ]
          : [
              qc(
                q(y1, x1),
                "That is the constant for direct variation. Here $k=xy$.",
              ),
              qc(q(x1, y1), "In $y=k/x$, multiply both sides by $x$: $k=xy$."),
              qc(
                whole(x1 + y1),
                "The constant is the product $xy$, not the sum.",
              ),
              qc(
                whole(y1 - x1),
                "The constant is the product $xy$, not the difference.",
              ),
            ],
      ),
    },
  };
}

/* ---------- rate-combination-model ---------- */

const vol = (n: number) => `${n} ${n === 1 ? "liter" : "liters"}`;
const unitLabel = (x: Q, one: string, many: string) =>
  `$${tex(x)}$ ${eq(x, q(1)) ? one : many}`;

function rateCombinationModel(r: Random): Built {
  const variant = r(0, 5);
  if (variant === 0 || variant === 5) {
    const a = r(2, 15);
    let b = r(2, 15);
    while (b === a) b = r(2, 15);
    if (variant === 5) {
      const fill = Math.min(a, b);
      const drain = Math.max(a, b);
      const time = q(fill * drain, drain - fill);
      const unit = (x: Q) => unitLabel(x, "hour", "hours");
      return {
        variant,
        draft: {
          prompt: `A pipe alone can fill an empty tank in ${fill} hours. A drain alone can empty a full tank in ${drain} hours. With the tank empty, both are opened and each works at its constant rate. How long until the tank is full? Give the exact time in hours.`,
          answer: "",
          hint: `The pipe adds $\\frac{1}{${fill}}$ of the tank each hour and the drain removes $\\frac{1}{${drain}}$ of a tank each hour. Subtract the rates, then find how long one whole tank takes at the net rate.`,
          explanation: [
            `Net rate: $\\frac{1}{${fill}}-\\frac{1}{${drain}}=\\frac{${drain}-${fill}}{${fill}\\cdot ${drain}}=\\frac{${drain - fill}}{${fill * drain}}$ tank per hour.`,
            `Time for one tank: the reciprocal, $\\frac{${fill * drain}}{${drain - fill}}=${tex(time)}$ hours.`,
          ],
          choices: choices(unit(time), [
            {
              label: unit(q(fill * drain, fill + drain)),
              feedback:
                "That adds the rates, as if the drain helped fill the tank. The drain works against the pipe, so subtract.",
            },
            {
              label: unit(whole(drain - fill)),
              feedback: "Subtract the rates (tanks per hour), not the times.",
            },
            {
              label: unit(q(fill + drain, 2)),
              feedback:
                "Averaging the times ignores how the rates combine. Subtract the hourly rates.",
            },
            {
              label: unit(whole(fill * drain)),
              feedback:
                "That is the product of the times. The net rate is $\\frac{1}{fill}-\\frac{1}{drain}$; take its reciprocal.",
            },
          ]),
        },
      };
    }
    const names = pick(r, [
      ["Ana", "Ben", "paint a fence"],
      ["the first printer", "the second printer", "complete a print run"],
      ["the first pump", "the second pump", "fill a reservoir"],
    ] as const);
    const time = q(a * b, a + b);
    const unit = (x: Q) => unitLabel(x, "hour", "hours");
    return {
      variant,
      draft: {
        prompt: `Working alone, ${names[0]} can ${names[2]} in ${a} hours and ${names[1]} can do the same job in ${b} hours. Working together, each at the same constant rate as before, how long do they need? Give the exact time in hours.`,
        answer: "",
        hint: `In one hour ${names[0]} completes $\\frac{1}{${a}}$ of the job and ${names[1]} completes $\\frac{1}{${b}}$. Add those rates, then find how long one whole job takes at the combined rate.`,
        explanation: [
          `Combined rate: $\\frac{1}{${a}}+\\frac{1}{${b}}=\\frac{${b}+${a}}{${a}\\cdot ${b}}=\\frac{${a + b}}{${a * b}}$ job per hour.`,
          `Time for one job: the reciprocal, $\\frac{${a * b}}{${a + b}}=${tex(time)}$ hours.`,
        ],
        choices: choices(unit(time), [
          {
            label: unit(q(a + b, 2)),
            feedback:
              "Averaging the times ignores how rates combine. Add the hourly rates instead.",
          },
          {
            label: unit(whole(a + b)),
            feedback:
              "Working together must be faster than either alone, so the time must be less than both.",
          },
          {
            label: unit(q(a + b, a * b)),
            feedback:
              "That is the combined rate in jobs per hour. Take its reciprocal to get hours per job.",
          },
          {
            label: unit(whole(a * b)),
            feedback:
              "That is the product of the times, not the time for the pair.",
          },
        ]),
      },
    };
  }
  if (variant === 1 || variant === 2) {
    const u = r(1, 9);
    const w = r(1, 9);
    const s = r(1, 3);
    const p = r(2, 40);
    const mix = p + u;
    const strong = mix + w;
    const x = w * s;
    const y = u * s;
    if (variant === 1) {
      const answer = whole(mix);
      const percent = (v: Q) => `$${tex(v)}\\%$`;
      return {
        variant,
        draft: {
          prompt: `A lab mixes ${vol(x)} of a ${p}% salt solution with ${vol(y)} of a ${strong}% salt solution. What is the salt concentration of the mixture, as a percent?`,
          answer: "",
          hint: `Find the salt in each part: ${p}% of ${vol(x)} and ${strong}% of ${vol(y)}. Add the amounts of salt and divide by the total volume ${x + y}.`,
          explanation: [
            `Salt in the first solution: $${p / 100}\\cdot ${x}=${(p * x) / 100}$ liters. Salt in the second: $${strong / 100}\\cdot ${y}=${(strong * y) / 100}$ liters.`,
            `Total salt over total volume: $\\frac{${(p * x + strong * y) / 100}}{${x + y}}=${mix / 100}$, which is ${mix}%.`,
          ],
          choices: choices(percent(answer), [
            {
              label: percent(q(p + strong, 2)),
              feedback:
                "A plain average ignores the different volumes. Weight each concentration by its volume.",
            },
            {
              label: percent(q(p * y + strong * x, x + y)),
              feedback:
                "The concentrations are weighted by the volumes of their own solutions, not the other solution's.",
            },
            {
              label: percent(whole(100 - mix)),
              feedback: "That is the concentration of everything except salt.",
            },
            {
              label: percent(q(p * x + strong * y, 100)),
              feedback:
                "Divide the total salt by the total volume, not by 100.",
            },
            {
              label: percent(whole(p + strong)),
              feedback:
                "A mixture cannot be stronger than its strongest part; weight and average.",
            },
          ]),
        },
      };
    }
    const liters = (v: Q) => unitLabel(v, "liter", "liters");
    return {
      variant,
      draft: {
        prompt: `How many liters of a ${strong}% salt solution must be added to ${vol(x)} of a ${p}% salt solution to make a mixture that is ${mix}% salt?`,
        answer: "",
        hint: `Let $y$ be the liters added. The salt in the mixture, $${mix / 100}(${x}+y)$, must equal the salt from the ${vol(x)} of ${p}% solution plus the salt from $y$ liters of ${strong}% solution.`,
        explanation: [
          `Salt: $${p / 100}\\cdot ${x}+${strong / 100}y=${mix / 100}(${x}+y)$.`,
          `Collect: $${(p * x) / 100}+${strong / 100}y=${(mix * x) / 100}+${mix / 100}y$, so $${(strong - mix) / 100}y=${((mix - p) * x) / 100}$.`,
          `Therefore $y=\\frac{${(mix - p) * x}}{${strong - mix}}=${y}$ liters.`,
        ],
        choices: choices(liters(whole(y)), [
          {
            label: liters(q(x * w, u)),
            feedback:
              "The ratio is inverted. The amount added times its excess over the target balances the original amount times its shortfall.",
          },
          {
            label: liters(whole(mix - p)),
            feedback: "That is the percentage-point gap, not a volume.",
          },
          {
            label: liters(q(x * u, strong - p)),
            feedback:
              "The denominator is the gap between the added solution and the target, not between the two solutions.",
          },
          {
            label: liters(whole(x)),
            feedback:
              "Equal volumes would give a mixture exactly halfway between the strengths.",
          },
          {
            label: liters(whole(x + y)),
            feedback:
              "That is the total volume of the mixture, not the amount added.",
          },
          {
            label: liters(q(x * (strong - mix), strong - p)),
            feedback:
              "That is the share of the original solution in a different balance. Set up the salt equation.",
          },
        ]),
      },
    };
  }
  if (variant === 3) {
    const speeds = [20, 24, 30, 36, 40, 45, 48, 50, 60, 72];
    const u = pick(r, speeds);
    let v = pick(r, speeds);
    while (v === u) v = pick(r, speeds);
    const d = r(12, 60);
    const average = q(2 * u * v, u + v);
    const mph = (x: Q) => `$${tex(x)}$ mph`;
    return {
      variant,
      draft: {
        prompt: `A driver goes ${d} miles to a lake at an average speed of ${u} miles per hour and returns the same ${d} miles at ${v} miles per hour. What is the average speed for the whole round trip, in miles per hour? Give the exact value.`,
        answer: "",
        hint: `Average speed is total distance divided by total time. Find the time for each ${d}-mile leg using ${u} and ${v} miles per hour, add them, and divide the ${2 * d}-mile total distance by that time.`,
        explanation: [
          `Total distance: $2\\cdot ${d}=${2 * d}$ miles. Time out: $\\frac{${d}}{${u}}$ hours. Time back: $\\frac{${d}}{${v}}$ hours.`,
          `Total time: $${d}\\left(\\frac{1}{${u}}+\\frac{1}{${v}}\\right)=\\frac{${d * (u + v)}}{${u * v}}$ hours.`,
          `Average speed: $\\frac{${2 * d}}{${d * (u + v)}/${u * v}}=\\frac{${2 * u * v}}{${u + v}}=${tex(average)}$ miles per hour.`,
        ],
        choices: choices(mph(average), [
          {
            label: mph(q(u + v, 2)),
            feedback:
              "The driver spends more time at the slower speed, so the average speed is below the plain average of the two speeds.",
          },
          {
            label: mph(q(u * v, u + v)),
            feedback: "That omits the factor 2 for the round-trip distance.",
          },
          {
            label: mph(q(Math.abs(u - v), 2)),
            feedback:
              "Average speed is total distance over total time, not half the difference of the speeds.",
          },
          {
            label: mph(whole(u + v)),
            feedback:
              "Speeds do not add over a round trip; use total distance and total time.",
          },
        ]),
      },
    };
  }
  const v0 = pick(r, [0, 0, 20, 50, 100]);
  const r1 = r(3, 12);
  let r2 = r(2, 9);
  while (r2 === r1) r2 = r(2, 9);
  const t1 = r(2, 9);
  const t2 = r(1, 9);
  const extra = r(0, 1) ? 0 : r(1, r2 - 1);
  const target = v0 + r1 * t1 + r2 * t2 + extra;
  const total = add(whole(t1 + t2), q(extra, r2));
  const minutes = (x: Q) => unitLabel(x, "minute", "minutes");
  const remaining = target - v0;
  return {
    variant: 4,
    draft: {
      prompt: `${v0 === 0 ? "An empty tank is being filled." : `A tank holds ${v0} liters.`} For the first ${t1} minutes a pump adds ${r1} liters per minute. Then a second pump takes over and adds ${r2} liters per minute. How many minutes after the start does the tank hold ${target} liters? Give the exact time in minutes.`,
      answer: "",
      hint: `First find how many liters the ${r1}-liter-per-minute pump adds in its ${t1} minutes, and how many liters are still needed to reach ${target}. The second pump supplies only those remaining liters at ${r2} per minute.`,
      explanation: [
        `The first pump adds $${r1}\\cdot ${t1}=${r1 * t1}$ liters, so the tank holds $${v0 + r1 * t1}$ liters after ${t1} minutes.`,
        `Still needed: $${target}-${v0 + r1 * t1}=${target - v0 - r1 * t1}$ liters, at ${r2} liters per minute: $\\frac{${target - v0 - r1 * t1}}{${r2}}=${tex(q(target - v0 - r1 * t1, r2))}$ minutes.`,
        `Total time: $${t1}+${tex(q(target - v0 - r1 * t1, r2))}=${tex(total)}$ minutes.`,
      ],
      choices: choices(minutes(total), [
        {
          label: minutes(q(remaining, r2)),
          feedback:
            "That runs the whole job at the second rate. The first pump did the first part.",
        },
        {
          label: minutes(add(whole(t1), q(remaining, r2))),
          feedback:
            "The second pump only supplies what the first pump has not already added. Subtract the first pump's liters.",
        },
        {
          label: minutes(q(remaining, r1)),
          feedback:
            "That runs the whole job at the first rate. The second pump changes the rate after the first phase.",
        },
        {
          label: minutes(q(2 * remaining, r1 + r2)),
          feedback:
            "An average of the two rates does not fit: each pump works for a different length of time.",
        },
        {
          label: minutes(whole(t1 + Math.floor((target - v0 - r1 * t1) / r2))),
          feedback:
            "Keep the exact fraction of a minute for the remaining liters.",
        },
      ]),
    },
  };
}

/* ---------- absolute-compound-inequality ---------- */

const lt = (strict: boolean) => (strict ? "<" : "\\le ");
const gt = (strict: boolean) => (strict ? ">" : "\\ge ");
const inside = (lo: Q, hi: Q, sl: boolean, sh: boolean) =>
  `$${tex(lo)}${lt(sl)}x${lt(sh)}${tex(hi)}$`;
const outside = (lo: Q, hi: Q, sl: boolean, sh: boolean) =>
  `$x${lt(sl)}${tex(lo)}$ or $x${gt(sh)}${tex(hi)}$`;
const absolute = (center: number, radius: number, rel: string) =>
  `$|x${center > 0 ? `-${center}` : center < 0 ? `+${-center}` : ""}|${rel}${radius}$`;
const ordered = (x: Q, y: Q): [Q, Q] =>
  x[0] * y[1] <= y[0] * x[1] ? [x, y] : [y, x];

function absoluteCompoundInequality(r: Random): Built {
  const variant = r(0, 5);
  const a = r(1, 4) * (r(0, 2) === 0 ? -1 : 1);
  const b = signed(r, 1, 9);
  const strict = r(0, 1) === 0;
  const expression = linear(a, b);
  if (variant === 0 || variant === 1) {
    const c = r(1, 12);
    const [lo, hi] = ordered(q(-c - b, a), q(c - b, a));
    const [rawLo, rawHi] = ordered(whole(-c - b), whole(c - b));
    const [flipLo, flipHi] = ordered(q(-c + b, a), q(c + b, a));
    const flip =
      a < 0
        ? " Dividing by the negative coefficient reverses each inequality."
        : "";
    const symbol = variant === 0 ? lt(strict) : gt(strict);
    const reading =
      variant === 0
        ? `$|${expression}|${symbol}${c}$ means $${expression}$ is within ${c} of 0: $-${c}${lt(strict)}${expression}${lt(strict)}${c}$.`
        : `$|${expression}|${symbol}${c}$ means $${expression}$ is at least ${c} from 0: $${expression}${lt(strict)}-${c}$ or $${expression}${gt(strict)}${c}$.`;
    const insideCorrect = inside(lo, hi, strict, strict);
    const outsideCorrect = outside(lo, hi, strict, strict);
    return {
      variant,
      draft: {
        prompt: `Which gives all real solutions of $|${expression}|${symbol}${c}$?`,
        answer: "",
        hint:
          variant === 0
            ? `Since ${c} is positive, $|${expression}|${symbol}${c}$ says $${expression}$ lies within ${c} of 0. Write it as one compound inequality, $-${c}$ on the left of $${expression}$ and ${c} on the right, and solve all three parts at once.`
            : `Since ${c} is positive, $|${expression}|${symbol}${c}$ says $${expression}$ is at least ${c} away from 0. Write the two separate cases, $${expression}$ below $-${c}$ or above $${c}$, and solve each.`,
        explanation: [
          reading,
          `Subtract ${b} from every part: the endpoints for $${linear(a, 0)}$ are $${-c - b}$ and $${c - b}$.`,
          `Divide by ${a}.${flip} The endpoints are $${tex(lo)}$ and $${tex(hi)}$.`,
          variant === 0
            ? `The solution set is ${insideCorrect}.`
            : `The solution set is ${outsideCorrect}.`,
        ],
        choices:
          variant === 0
            ? choices(insideCorrect, [
                {
                  label: outsideCorrect,
                  feedback:
                    'That is the set where the absolute value is greater. For "less than", the expression stays within the distance.',
                },
                {
                  label: inside(rawLo, rawHi, strict, strict),
                  feedback: `Divide the endpoints by ${a} to solve for $x$.`,
                },
                {
                  label: inside(flipLo, flipHi, strict, strict),
                  feedback: `Subtract ${b} from the endpoints; do not add it.`,
                },
                {
                  label: inside(lo, hi, !strict, !strict),
                  feedback: `The inequality ${strict ? "is strict, so the endpoints are excluded" : "includes equality, so the endpoints are included"}.`,
                },
                {
                  label: `$x${lt(strict)}${tex(hi)}$`,
                  feedback:
                    "The solution has a lower endpoint too: both ends of the compound inequality matter.",
                },
              ])
            : choices(outsideCorrect, [
                {
                  label: insideCorrect,
                  feedback:
                    'That is the set where the absolute value is less. For "greater than", the expression is far from 0 on either side.',
                },
                {
                  label: outside(rawLo, rawHi, strict, strict),
                  feedback: `Divide the endpoints by ${a} to solve for $x$.`,
                },
                {
                  label: outside(flipLo, flipHi, strict, strict),
                  feedback: `Subtract ${b} from the endpoints; do not add it.`,
                },
                {
                  label: outside(lo, hi, !strict, !strict),
                  feedback: `The inequality ${strict ? "is strict, so the endpoints are excluded" : "includes equality, so the endpoints are included"}.`,
                },
                {
                  label: `$x${lt(strict)}${tex(lo)}$ and $x${gt(strict)}${tex(hi)}$`,
                  feedback:
                    'No number is both below the lower endpoint and above the upper one. The solution is either case, joined by "or".',
                },
              ]),
      },
    };
  }
  if (variant === 2) {
    const lower = r(-12, 2);
    const upper = lower + r(3, 14);
    const sl = r(0, 1) === 0;
    const sh = r(0, 1) === 0;
    const x1 = q(lower - b, a);
    const x2 = q(upper - b, a);
    const solutionLo = a > 0 ? x1 : x2;
    const solutionHi = a > 0 ? x2 : x1;
    const strictLo = a > 0 ? sl : sh;
    const strictHi = a > 0 ? sh : sl;
    const correct = inside(solutionLo, solutionHi, strictLo, strictHi);
    const [rawLo, rawHi] = [whole(lower - b), whole(upper - b)];
    const [signLo, signHi] =
      a > 0
        ? [q(lower + b, a), q(upper + b, a)]
        : [q(upper + b, a), q(lower + b, a)];
    return {
      variant,
      draft: {
        prompt: `Which gives all real $x$ satisfying $${lower}${lt(sl)}${expression}${lt(sh)}${upper}$?`,
        answer: "",
        hint: `Whatever you do to the middle you must do to all three parts. First remove the constant ${b} from $${expression}$ everywhere, then deal with the coefficient ${a} of $x$${a < 0 ? ", watching what multiplying or dividing by a negative does" : ""}.`,
        explanation: [
          `Subtract ${b} from all three parts: $${lower - b}${lt(sl)}${linear(a, 0)}${lt(sh)}${upper - b}$.`,
          `Divide all parts by ${a}.${a < 0 ? " The coefficient is negative, so each inequality reverses and the endpoints swap places." : ""}`,
          `The solution set is ${correct}.`,
        ],
        choices: choices(correct, [
          {
            label: inside(solutionLo, solutionHi, !strictLo, !strictHi),
            feedback:
              "Check which ends are included: a strict inequality excludes the endpoint, and dividing by a negative number moves each end's strictness to the opposite end.",
          },
          {
            label: inside(...ordered(rawLo, rawHi), strictLo, strictHi),
            feedback: `Divide all three parts by ${a} to isolate $x$.`,
          },
          {
            label: inside(signLo, signHi, strictLo, strictHi),
            feedback: `Subtract ${b} from all parts; do not add it.`,
          },
          {
            label: outside(solutionLo, solutionHi, strictLo, strictHi),
            feedback:
              'A chain with both bounds means "and": $x$ lies between the endpoints, not outside them.',
          },
          {
            label: inside(
              solutionLo,
              solutionHi,
              a > 0 ? strictHi : strictLo,
              a > 0 ? strictLo : strictHi,
            ),
            feedback:
              "Keep each endpoint's strictness with the bound it came from.",
          },
        ]),
      },
    };
  }
  if (variant === 3) {
    const left = r(-8, 2);
    const right = left + r(2, 9);
    const a1 = r(1, 4) * (r(0, 2) === 0 ? -1 : 1);
    const a2 = r(1, 4) * (r(0, 2) === 0 ? -1 : 1);
    const b1 = signed(r, 1, 9);
    const b2 = signed(r, 1, 9);
    const s1 = r(0, 1) === 0;
    const s2 = r(0, 1) === 0;
    const t1 = a1 * left + b1;
    const t2 = a2 * right + b2;
    const piece1 = `${linear(a1, b1)}${a1 > 0 ? lt(s1) : gt(s1)}${t1}`;
    const piece2 = `${linear(a2, b2)}${a2 > 0 ? gt(s2) : lt(s2)}${t2}`;
    const correct = outside(whole(left), whole(right), s1, s2);
    const L = whole(left);
    const R = whole(right);
    const noFlip = `$x${a1 < 0 ? gt(s1) : lt(s1)}${left}$ or $x${a2 < 0 ? lt(s2) : gt(s2)}${right}$`;
    return {
      variant,
      draft: {
        prompt: `Which gives every real $x$ that satisfies $${piece1}$ or $${piece2}$?`,
        answer: "",
        hint: `Solve each inequality on its own: undo ${b1} and divide by ${a1} in the first, undo ${b2} and divide by ${a2} in the second. Then combine the two solution sets with \"or\", meaning a number counts if it satisfies either one.`,
        explanation: [
          `First inequality: subtract ${b1}, then divide by ${a1}${a1 < 0 ? " (reversing the inequality because the coefficient is negative)" : ""}: $x${lt(s1)}${left}$.`,
          `Second inequality: subtract ${b2}, then divide by ${a2}${a2 < 0 ? " (reversing the inequality because the coefficient is negative)" : ""}: $x${gt(s2)}${right}$.`,
          `\"Or\" joins the two sets: ${correct}.`,
        ],
        choices: choices(correct, [
          {
            label: inside(L, R, s1, s2),
            feedback:
              '"Or" gives the union of two sets, not the numbers between the endpoints.',
          },
          {
            label: noFlip,
            feedback:
              "Dividing by a negative coefficient reverses the inequality sign. Check each coefficient.",
          },
          {
            label: outside(L, R, !s1, !s2),
            feedback:
              "Check whether each endpoint is included: strict signs exclude it, and $\\le$, $\\ge$ include it.",
          },
          {
            label: outside(whole(t1 - b1), whole(t2 - b2), s1, s2),
            feedback:
              "Divide by the coefficient of $x$ as well as removing the constant.",
          },
          {
            label: `$x${gt(s1)}${left}$ or $x${lt(s2)}${right}$`,
            feedback:
              "These two rays overlap and together cover every real number; check which side each solution lies on.",
          },
        ]),
      },
    };
  }
  if (variant === 4) {
    const lo = r(-9, 3);
    const span = 2 * r(1, 6);
    const hi = lo + span;
    const center = (lo + hi) / 2;
    const radius = span / 2;
    const kind = r(0, 3);
    const isInside = kind < 2;
    const closed = kind % 2 === 0;
    const rel = isInside ? lt(!closed) : gt(!closed);
    const swapRel = isInside ? gt(!closed) : lt(!closed);
    const description = isInside
      ? `On a number line, the solution set is the segment from $${lo}$ to $${hi}$, with ${closed ? "both endpoints included" : "neither endpoint included"}.`
      : `On a number line, the solution set is every point ${closed ? "at or to the left of" : "to the left of"} $${lo}$ together with every point ${closed ? "at or to the right of" : "to the right of"} $${hi}$.`;
    return {
      variant,
      draft: {
        prompt: `${description} Which inequality has exactly this solution set?`,
        answer: "",
        hint: `Find the midpoint of ${lo} and ${hi}, and the distance from that midpoint to each endpoint. Then decide whether the set is the points within that distance of the midpoint or the points at least that far from it.`,
        explanation: [
          `The midpoint of ${lo} and ${hi} is $\\frac{${lo}+${paren(hi)}}{2}=${center}$, and each endpoint is $${radius}$ from it.`,
          `So the set is described by the distance from $x$ to ${center}, written $|x-${paren(center)}|$, ${isInside ? "being at most/less than" : "being at least/more than"} ${radius}.`,
          `${closed ? "Endpoints are included, so the sign has equality" : "Endpoints are excluded, so the sign is strict"}: ${absolute(center, radius, rel)}.`,
        ],
        choices: choices(absolute(center, radius, rel), [
          {
            label: absolute(center, radius, swapRel),
            feedback: isInside
              ? "That describes points far from the midpoint, the opposite of the segment."
              : "That describes points near the midpoint, the opposite of the two rays.",
          },
          {
            label: absolute(center, radius, isInside ? lt(closed) : gt(closed)),
            feedback: closed
              ? "The described endpoints are included, so equality belongs in the sign."
              : "The described endpoints are excluded, so the sign is strict.",
          },
          {
            label: absolute(center, radius, isInside ? gt(closed) : lt(closed)),
            feedback:
              "Check both the direction of the inequality and whether the endpoints are included.",
          },
          {
            label: absolute(-center, radius, rel),
            feedback:
              "The center is the midpoint; $|x-c|$ measures distance from $c$, so use the opposite sign inside the bars.",
          },
          {
            label: absolute(center, hi, rel),
            feedback:
              "The radius is the distance from the midpoint to an endpoint, not the endpoint itself.",
          },
          {
            label: absolute(center, span, rel),
            feedback:
              "The radius is half the length of the segment between the endpoints.",
          },
        ]),
      },
    };
  }
  const type = r(0, 2);
  const c = r(1, 9);
  const root = q(-b, a);
  const [lo, hi] = ordered(q(-c - b, a), q(c - b, a));
  const none = "There are no real solutions";
  const every = "Every real number is a solution";
  const only = `Only $x=${tex(root)}$`;
  const except = `Every real number except $x=${tex(root)}$`;
  if (type === 2) {
    return {
      variant: 5,
      draft: {
        prompt: `Which describes all real solutions of $|${expression}|\\le 0$?`,
        answer: "",
        hint: `An absolute value is never negative, so $|${expression}|\\le 0$ is possible only when $|${expression}|=0$. Decide which $x$ makes $${expression}$ equal 0.`,
        explanation: [
          `An absolute value is at least 0, so $|${expression}|\\le 0$ means $|${expression}|=0$.`,
          `That happens only when $${expression}=0$, so $x=${tex(root)}$.`,
        ],
        choices: choices(only, [
          {
            label: none,
            feedback:
              'The absolute value can equal 0, which satisfies "$\\le 0$".',
          },
          {
            label: every,
            feedback:
              'The absolute value is positive for every other $x$, which fails "$\\le 0$".',
          },
          {
            label: except,
            feedback:
              "That is the set where the absolute value is positive. The inequality needs it to be 0.",
          },
        ]),
      },
    };
  }
  const symbol = type === 0 ? "<" : ">";
  const bogus =
    type === 0 ? inside(lo, hi, true, true) : outside(lo, hi, true, true);
  return {
    variant: 5,
    draft: {
      prompt: `Which describes all real solutions of $|${expression}|${symbol}${-c}$?`,
      answer: "",
      hint: `Ask what values $|${expression}|$ can take. It is a distance, so compare it with the negative number ${-c} before doing any algebra.`,
      explanation: [
        `An absolute value is never negative, so $|${expression}|\\ge 0$ for every real $x$.`,
        type === 0
          ? `Nothing that is at least 0 can be less than ${-c}, so there are no solutions.`
          : `Every number that is at least 0 is greater than ${-c}, so every real number works.`,
      ],
      choices:
        type === 0
          ? choices(none, [
              {
                label: every,
                feedback:
                  "A value that is at least 0 is never less than a negative number.",
              },
              {
                label: only,
                feedback: `At that $x$ the absolute value is 0, which is still not less than ${-c}.`,
              },
              {
                label: bogus,
                feedback: `That solves the inequality as if the right side were ${c}. With ${-c}, no value works.`,
              },
            ])
          : choices(every, [
              {
                label: none,
                feedback:
                  "A value that is at least 0 is always greater than a negative number.",
              },
              {
                label: except,
                feedback: `At $x=${tex(root)}$ the absolute value is 0, and 0 is greater than ${-c}.`,
              },
              {
                label: bogus,
                feedback: `That solves the inequality as if the right side were ${c}. With ${-c}, every real number works.`,
              },
            ]),
    },
  };
}

/* ---------- quadratic-from-data ---------- */

const lead = (a: number) => (a === 1 ? "" : a === -1 ? "-" : `${a}`);
const factor = (root: number) =>
  root === 0 ? "x" : `(x${root < 0 ? "+" : "-"}${Math.abs(root)})`;
const zerosForm = (a: number, p: number, qq: number) =>
  `y=${lead(a)}${factor(p)}${factor(qq)}`;
const vertexForm = (a: number, h: number, k: number) =>
  `y=${lead(a)}${h === 0 ? "x^2" : `(x${h < 0 ? "+" : "-"}${Math.abs(h)})^2`}${k === 0 ? "" : `${k < 0 ? "-" : "+"}${Math.abs(k)}`}`;
const standard = (a: number, b: number, c: number) => `y=${quadratic(a, b, c)}`;
const evaluate = (a: number, b: number, c: number, x: number) =>
  a * x * x + b * x + c;

function quadraticFromData(r: Random): Built {
  const variant = r(0, 3);
  if (variant === 0) {
    for (;;) {
      const p = r(-6, 5);
      const qq = p + r(1, 6);
      const a = signed(r, 1, 3);
      const h = r(-6, 6);
      if (h === p || h === qq) continue;
      const k = a * (h - p) * (h - qq);
      if (Math.abs(k) > 60) continue;
      const wrongLead = h - p !== 0 && k % (h - p) === 0 ? k / (h - p) : 1;
      return {
        variant,
        draft: {
          prompt: `A parabola crosses the $x$-axis at $x=${p}$ and $x=${qq}$ and passes through the point $(${h},${k})$. Which equation represents the parabola?`,
          answer: "",
          hint: `A parabola with $x$-intercepts ${p} and ${qq} has the form $y=a(x-${paren(p)})(x-${paren(qq)})$. Substitute the point $(${h},${k})$ to find $a$.`,
          explanation: [
            `The zeros ${p} and ${qq} give $y=a(x-${paren(p)})(x-${paren(qq)})$.`,
            `Substitute $(${h},${k})$: $${k}=a(${h}-${paren(p)})(${h}-${paren(qq)})=a\\cdot ${(h - p) * (h - qq)}$, so $a=${a}$.`,
            `The equation is $${zerosForm(a, p, qq)}$.`,
          ],
          choices: choices(`$${zerosForm(a, p, qq)}$`, [
            {
              label: `$${zerosForm(1, p, qq)}$`,
              feedback: `The zeros do not fix the leading coefficient. At $x=${h}$ this gives $y=${(h - p) * (h - qq)}$, not ${k}.`,
            },
            {
              label: `$${zerosForm(-a, p, qq)}$`,
              feedback: `Check the sign of $a$ by substituting $(${h},${k})$: this equation gives $y=${-k}$.`,
            },
            {
              label: `$${zerosForm(a, -qq, -p)}$`,
              feedback:
                "A zero at $x=r$ comes from the factor $(x-r)$, so the sign inside the factor is opposite to the zero.",
            },
            {
              label: `$${zerosForm(wrongLead, p, qq)}$`,
              feedback:
                "Divide by the value of both factors at the point, not just one of them.",
            },
            {
              label: `$${zerosForm(a === -1 ? 2 : a + 1, p, qq)}$`,
              feedback: `Substituting $(${h},${k})$ must give exactly ${k}.`,
            },
          ]),
        },
      };
    }
  }
  if (variant === 1) {
    for (;;) {
      const h = r(-6, 6);
      const k = r(-6, 6);
      const a = signed(r, 1, 3);
      const x = r(-6, 6);
      if (x === h || Math.abs(x - h) > 5) continue;
      const y = a * (x - h) * (x - h) + k;
      return {
        variant,
        draft: {
          prompt: `A parabola has its vertex at $(${h},${k})$ and passes through the point $(${x},${y})$. Which equation represents the parabola?`,
          answer: "",
          hint: `With vertex $(${h},${k})$ the equation has the form $y=a(x-${paren(h)})^2+${paren(k)}$. Substitute the point $(${x},${y})$ to find $a$.`,
          explanation: [
            `The vertex $(${h},${k})$ gives $y=a(x-${paren(h)})^2+${paren(k)}$.`,
            `Substitute $(${x},${y})$: $${y}=a(${x}-${paren(h)})^2+${paren(k)}$, so $${y - k}=a\\cdot ${(x - h) * (x - h)}$ and $a=${a}$.`,
            `The equation is $${vertexForm(a, h, k)}$.`,
          ],
          choices: choices(`$${vertexForm(a, h, k)}$`, [
            {
              label: `$${vertexForm(a, -h, k)}$`,
              feedback:
                "In vertex form the horizontal shift appears as $x-h$, so it has the opposite sign of the vertex's $x$-coordinate.",
            },
            {
              label: `$${vertexForm(a, h, -k)}$`,
              feedback: "The vertex's $y$-coordinate is added: $y=a(x-h)^2+k$.",
            },
            {
              label: `$${vertexForm(-a, h, k)}$`,
              feedback: `Substituting $(${x},${y})$ gives the wrong sign for $a$: this equation produces $y=${-a * (x - h) * (x - h) + k}$.`,
            },
            {
              label: `$${vertexForm((y - k) % (x - h) === 0 ? (y - k) / (x - h) : a === -1 ? 2 : a + 1, h, k)}$`,
              feedback: "Square $(x-h)$ before dividing: $y-k=a(x-h)^2$.",
            },
            {
              label: `$${vertexForm(1, h, k)}$`,
              feedback: `The vertex does not fix $a$. With $a=1$ this gives $y=${(x - h) * (x - h) + k}$ at $x=${x}$, not ${y}.`,
            },
          ]),
        },
      };
    }
  }
  const a = signed(r, 1, 3);
  const b = r(-6, 6);
  const c = r(-8, 8);
  if (variant === 2) {
    const step = pick(r, [1, 2]);
    const x0 = r(-3, 2);
    const xs = [x0, x0 + step, x0 + 2 * step] as const;
    const ys = xs.map((x) => evaluate(a, b, c, x)) as [number, number, number];
    const second = ys[2] - 2 * ys[1] + ys[0];
    const wrong = (cand: [number, number, number], note: string): Cand => {
      const bad = xs.findIndex((x, i) => evaluate(...cand, x) !== ys[i]);
      return {
        label: `$${standard(...cand)}$`,
        feedback: `${note} Test it at $x=${xs[bad]}$: it gives $y=${evaluate(...cand, xs[bad]!)}$, but the table has ${ys[bad]}.`,
      };
    };
    const slope1 = ys[1] - ys[0];
    return {
      variant,
      draft: {
        prompt: `The table shows three values of a quadratic function $y=f(x)$. Which equation defines $f$?\n$\\begin{array}{c|ccc}x&${xs[0]}&${xs[1]}&${xs[2]}\\\\\\hline y&${ys[0]}&${ys[1]}&${ys[2]}\\end{array}$`,
        answer: "",
        hint: `The $x$-values go up by ${step} each time. Find the differences of the $y$-values ${ys[0]}, ${ys[1]}, ${ys[2]}, then the difference of those differences: it equals $2a\\cdot ${step}^2$.`,
        explanation: [
          `The $y$ differences are $${ys[1]}-${paren(ys[0])}=${slope1}$ and $${ys[2]}-${paren(ys[1])}=${ys[2] - ys[1]}$. Their difference is $${second}$.`,
          `For equal steps of ${step} in $x$, that second difference equals $2a\\cdot ${step}^2$, so $a=\\frac{${second}}{${2 * step * step}}=${a}$.`,
          `Subtract the first two rows: $${slope1}=a(${xs[1]}^2-${paren(xs[0])}^2)+b\\cdot ${step}$, so $b=${b}$. Then $c=${ys[0]}-a x^2-bx$ at $x=${xs[0]}$ gives $c=${c}$.`,
          `The equation is $${standard(a, b, c)}$.`,
        ],
        choices: choices(`$${standard(a, b, c)}$`, [
          wrong([second, b, c], "The second difference is $2a h^2$, not $a$."),
          wrong([a, -b, c], "Check the sign of the $x$ coefficient."),
          wrong(
            [a, b, ys[0]],
            "$c$ is the value at $x=0$, which is not the first row unless that row has $x=0$.",
          ),
          wrong([-a, b, c], "Check the sign of the leading coefficient."),
          wrong([a, b, c + 1], "All three rows must fit."),
        ]),
      },
    };
  }
  for (;;) {
    const x1 = r(-3, 1);
    const x2 = x1 + r(1, 3);
    const x3 = x2 + r(1, 3);
    if (x2 - x1 === x3 - x2) continue;
    const xs = [x1, x2, x3] as const;
    const ys = xs.map((x) => evaluate(a, b, c, x)) as [number, number, number];
    const s1 = (ys[1] - ys[0]) / (x2 - x1);
    const s2 = (ys[2] - ys[1]) / (x3 - x2);
    if (!Number.isInteger(s1) || !Number.isInteger(s2)) continue;
    const wrong = (cand: [number, number, number], note: string): Cand => {
      const bad = xs.findIndex((x, i) => evaluate(...cand, x) !== ys[i]);
      return {
        label: `$${standard(...cand)}$`,
        feedback: `${note} Test it at $x=${xs[bad]}$: it gives $y=${evaluate(...cand, xs[bad]!)}$, but the point has $y=${ys[bad]}$.`,
      };
    };
    return {
      variant,
      draft: {
        prompt: `The graph of a quadratic function $y=f(x)$ passes through $(${x1},${ys[0]})$, $(${x2},${ys[1]})$ and $(${x3},${ys[2]})$. Which equation defines $f$?`,
        answer: "",
        hint: `Write $f(x)=ax^2+bx+c$ and substitute each point, for example $f(${x1})=${ys[0]}$. Subtract equations in pairs to eliminate $c$.`,
        explanation: [
          `For $f(x)=ax^2+bx+c$, subtracting two points gives the slope between them: $\\frac{${ys[1]}-${paren(ys[0])}}{${x2}-${paren(x1)}}=${s1}=a(${x1}+${paren(x2)})+b$ and $\\frac{${ys[2]}-${paren(ys[1])}}{${x3}-${paren(x2)}}=${s2}=a(${x2}+${paren(x3)})+b$.`,
          `Subtract those: $${s2 - s1}=a(${x3}-${paren(x1)})$, so $a=${a}$. Then $b=${s1}-${paren(a)}(${x1}+${paren(x2)})=${b}$.`,
          `$c=${ys[0]}-${paren(a)}(${x1})^2-${paren(b)}(${x1})=${c}$. The equation is $${standard(a, b, c)}$.`,
        ],
        choices: choices(`$${standard(a, b, c)}$`, [
          wrong([a, -b, c], "Check the sign of the $x$ coefficient."),
          wrong([-a, b, c], "Check the sign of the leading coefficient."),
          wrong(
            [a, b, ys[0]],
            "$c$ is the value at $x=0$, not at the first listed point.",
          ),
          wrong(
            [a === -1 ? 2 : a + 1, b, c],
            "All three points must fit; compare the slopes between the points.",
          ),
          wrong([a, b, -c], "Check the sign of the constant term."),
        ]),
      },
    };
  }
}

/* ---------- registry ---------- */

const builders: Record<
  string,
  (r: Random, axes?: Record<string, string>) => Built
> = {
  "quadratic-root-relations": quadraticRootRelations,
  "system-expression-value": systemExpressionValue,
  "variation-constant": variationConstant,
  "rate-combination-model": rateCombinationModel,
  "absolute-compound-inequality": absoluteCompoundInequality,
  "quadratic-from-data": quadraticFromData,
};

/** Private exact model; only the prompt and shuffled choices reach the learner. */
export function satAlgebraStructureCase(
  templateId: string,
  seed: string,
): { variant: number; problem: GeneratedProblem } {
  if (typeof seed !== "string" || !seed.length || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const meta = satAlgebraStructureTemplates.find((t) => t.id === templateId);
  const build = builders[templateId];
  if (!meta || !build) throw new Error(`Unknown template ${templateId}`);
  const r = random(meta.id, seed);
  const axes =
    templateId === "variation-constant"
      ? sweepChoose(templateId, seed)
      : undefined;
  // A rare draw whose misconceptions coincide with the answer is redrawn from
  // the same deterministic stream, so a seed always yields the same problem.
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      const { variant, draft } = build(r, axes);
      const problem = assemble(meta, seed, r, draft);
      return {
        variant,
        problem: axes
          ? { ...problem, variant: sweepVariant(`variant-${variant}`, axes) }
          : problem,
      };
    } catch (error) {
      if (
        !(error instanceof Error) ||
        error.message !== "Insufficient distinct choices"
      )
        throw error;
    }
  }
  throw new Error("Could not draw a problem with four distinct choices");
}

export function generateSatAlgebraStructureProblem(
  templateId: string,
  seed: string,
): GeneratedProblem {
  return satAlgebraStructureCase(templateId, seed).problem;
}
