import type { TemplateMetadata } from "./contracts";
import { defineAxis } from "./variation/axes";
import {
  chainFamily,
  choiceSurface,
  dispatch,
  numberSurface,
  pick,
} from "./chain-kit";
import { frac, par } from "./regents-kit";
import {
  binomial,
  gcd,
  isPerfectSquare,
  isSquarefree,
  polyTex,
} from "./regents-algebra-two-kit";

const meta = (
  id: string,
  title: string,
  skillId: string,
  difficultyOffset: number,
  description: string,
  choice = true,
): TemplateMetadata => ({
  id,
  version: 1,
  title,
  skillId,
  gradeBand: "9–12",
  difficultyOffset,
  ...(choice
    ? { requiredResponseCapability: "single-choice-v1" as const }
    : {}),
  description,
});

export const nonmonicComplexQuadraticTemplate = meta(
  "nonmonic-complex-quadratic",
  "Solve a quadratic with nonreal solutions and a leading coefficient other than 1",
  "complex-numbers",
  0.6,
  "Use the quadratic formula on $ax^2+bx+c=0$ with $a=2,3$ or 5 and a negative discriminant, and choose the solutions written with $i$ over $2a$.",
);
export const inverseExponentialRootTemplate = meta(
  "inverse-exponential-root",
  "Write the inverse of an exponential function, or a function from its cube-root inverse",
  "inverse-functions",
  0.5,
  "Choose the inverse of $b^x$, $a\\cdot b^x$ or $b^x+k$ as a logarithm, or recover $f$ from an inverse that is a cube root of a linear expression.",
);
export const circleLineSystemTemplate = meta(
  "circle-line-system",
  "Solve or classify a system of a circle and a line",
  "nonlinear-systems",
  0.6,
  "Find the lattice-point solutions of a circle centered at the origin and a line, or classify the solutions of a circle and a vertical line as rational, irrational or nonreal.",
);
export const rationalTwoDenominatorsTemplate = meta(
  "rational-two-denominators",
  "Solve a rational equation with two denominators and reject an excluded value",
  "rational-equations",
  0.65,
  "Multiply through by the common denominator $(x+p)(x-r)$ of an equation with two variable denominators, solve the resulting quadratic and reject the root that makes a denominator zero.",
);
export const trinomialProductTemplate = meta(
  "trinomial-product",
  "Multiply two trinomials and combine like terms",
  "polynomial-arithmetic",
  0.4,
  "Multiply two quadratic trinomials, or square one, and write the product in standard form.",
);
export const cubicQuotientRemainderTemplate = meta(
  "cubic-quotient-remainder",
  "Divide a cubic by a linear binomial and write the quotient plus remainder over the divisor",
  "polynomial-division",
  0.5,
  "Divide a cubic by $x+k$ or $x-k$ and choose the result written as a quadratic plus the remainder over the divisor.",
);
export const powersOfISumTemplate = meta(
  "powers-of-i-sum",
  "Simplify a sum of imaginary powers with variable coefficients",
  "complex-numbers",
  0.45,
  "Reduce powers of $i$ in a sum of three or four terms with a letter or number as coefficient and write the result as a real part plus an imaginary part.",
);
export const twoRadicalEquationTemplate = meta(
  "two-radical-equation",
  "Solve an equation with two square roots and reject the extraneous value",
  "radical-equations",
  0.7,
  "Isolate one square root, square, isolate the other root, square again, and test both candidates to enter the valid solution.",
  false,
);
export const absoluteValueLinearTemplate = meta(
  "absolute-value-linear",
  "Find where an absolute-value function equals a linear function",
  "absolute-value-equations",
  0.55,
  "Split $|x-p|=qx+r$ into its two cases, solve each, and keep only the solutions that satisfy the original equation.",
);
export const shiftedTrinomialFactorTemplate = meta(
  "shifted-trinomial-factor",
  "Factor a trinomial written in terms of a binomial",
  "expression-structure",
  0.5,
  "Treat $x-k$ as one quantity, factor the trinomial in it, and write the factors as binomials in $x$.",
);
export const rationalExponentProductTemplate = meta(
  "rational-exponent-product",
  "Rewrite roots and powers as one power with a rational exponent",
  "rational-exponents",
  0.5,
  "Combine a cube root, powers and a quotient of one variable into a single power, or take the cube root of a perfect-cube coefficient inside a radical times a power.",
);

/* ------------------------------------------- nonmonic complex quadratic */
const complexAxes = {
  arrangement: defineAxis("arrangement", [
    "zero-right",
    "constant-right",
  ] as const),
};
interface ComplexModel {
  a: number;
  b: number;
  c: number;
  n: number; // -discriminant
}
function complexModel(r: (lo: number, hi: number) => number): ComplexModel {
  const a = pick(r, [2, 3, 3, 5] as const);
  const b = r(-9, 9);
  const c = r(1, 9);
  const n = 4 * a * c - b * b;
  if (b === 0 || n <= 1 || !isSquarefree(n))
    throw new Error("Need three retries");
  return { a, b, c, n };
}
const sol = (
  b: number,
  n: number,
  den: number,
  sign: "i" | "real" = "i",
  flip = false,
) => {
  const first = flip ? b : -b;
  const root = sign === "i" ? `i\\sqrt{${n}}` : `\\sqrt{${n}}`;
  return `$x=\\dfrac{${first}\\pm ${root}}{${den}}$`;
};
export const nonmonicComplexQuadratic = chainFamily({
  template: nonmonicComplexQuadraticTemplate,
  axes: complexAxes,
  model: complexModel,
  variant: (m) => `a-${m.a}`,
  render: (m, ax, r) => {
    const eqText =
      ax.arrangement === "zero-right"
        ? `${polyTex([m.a, m.b, m.c])}=0`
        : `${polyTex([m.a, m.b, 0])}=-${m.c}`;
    const D = m.b * m.b - 4 * m.a * m.c;
    return choiceSurface(r, {
      prompt: `What are the solutions of $${eqText}$?`,
      options: [
        { label: sol(m.b, m.n, 2 * m.a), correct: true },
        {
          label: sol(m.b, m.n, 2 * m.a, "real"),
          feedback: `This drops the $i$. The discriminant, $b^2-4ac=${D}$, is negative, and the square root of a negative number is imaginary: $\\sqrt{${D}}=i\\sqrt{${m.n}}$.`,
        },
        {
          label: sol(m.b, m.n, 2 * m.a, "i", true),
          feedback: `This is a sign error in the first term. The formula starts with $-b$, the opposite of $b$. Here $b=${m.b}$, so the first term is $${-m.b}$.`,
        },
        {
          label: sol(m.b, m.n, m.a),
          feedback: `This divides by $a$ only. The denominator of the quadratic formula is $2a$, two times $a$, which is ${2 * m.a}.`,
        },
        ...(4 * m.a * m.c !== m.n
          ? [
              {
                label: sol(m.b, 4 * m.a * m.c, 2 * m.a),
                feedback: `This leaves out the $b^2$ term. The radicand, the number under the square root, is $b^2-4ac=${D}$, which gives $i\\sqrt{${m.n}}$.`,
              },
            ]
          : []),
      ],
      hint: `Identify $a=${m.a}$, $b=${m.b}$, $c=${m.c}$ and find the discriminant $b^2-4ac$ first. Its sign tells whether the solutions are real.`,
      explanation: [
        `${ax.arrangement === "zero-right" ? "The equation already has 0 on one side." : `Add ${m.c} to both sides so one side is 0: $${polyTex([m.a, m.b, m.c])}=0$.`} Compare it with $ax^2+bx+c=0$: $a=${m.a}$, $b=${m.b}$ and $c=${m.c}$.`,
        `The quadratic formula solves any such equation: $x=\\dfrac{-b\\pm\\sqrt{b^2-4ac}}{2a}$. The sign $\\pm$ means "plus or minus", giving two solutions.`,
        `First find the discriminant, the part under the square root: $b^2-4ac=${m.b * m.b}-${4 * m.a * m.c}=${D}$.`,
        `It is negative, so the solutions are not real numbers. The square root of a negative number uses $i$, where $i^2=-1$: $\\sqrt{${D}}=i\\sqrt{${m.n}}$.`,
        `Substitute: $x=\\dfrac{${-m.b}\\pm i\\sqrt{${m.n}}}{${2 * m.a}}$. ${m.n} has no square factor, so the root is fully simplified.`,
        `The solutions are $x=\\dfrac{${-m.b}\\pm i\\sqrt{${m.n}}}{${2 * m.a}}$.`,
      ],
    });
  },
});

/* ------------------------------------------------- inverse of exp/root */
const inverseAxes = {
  kind: defineAxis("kind", [
    "exponential",
    "scaled-exponential",
    "shifted-exponential",
    "from-cube-root",
  ] as const),
};
interface InverseModel {
  b: number;
  a: number;
  k: number;
  m: number;
}
function inverseModel(r: (lo: number, hi: number) => number): InverseModel {
  return {
    b: pick(r, [2, 3, 4, 5] as const),
    a: pick(r, [2, 3, 5] as const),
    k: pick(r, [-4, -3, -2, 2, 3, 5] as const),
    m: pick(r, [2, 3] as const),
  };
}
export const inverseExponentialRoot = chainFamily({
  template: inverseExponentialRootTemplate,
  axes: inverseAxes,
  model: inverseModel,
  variant: (m) => `base-${m.b}`,
  render: (m, ax, r) => {
    const { a, b, k } = m;
    const sh = (v: number) => (v < 0 ? `+ ${-v}` : `- ${v}`);
    if (ax.kind === "exponential")
      return choiceSurface(r, {
        prompt: `What is the inverse of $f(x)=${b}^{x}$?`,
        options: [
          { label: `$f^{-1}(x)=\\log_{${b}} x$`, correct: true },
          {
            label: `$f^{-1}(x)=\\log_{x} ${b}$`,
            feedback: `This swaps the base and the input. The base of the logarithm stays ${b}, and $x$ is the number we take the logarithm of.`,
          },
          {
            label: `$f^{-1}(x)=x^{${b}}$`,
            feedback: `This swaps the base and the exponent. $x^{${b}}$ raises $x$ to a fixed power, a different function. The inverse of an exponential is a logarithm.`,
          },
          {
            label: `$f^{-1}(x)=\\dfrac{1}{${b}^{x}}$`,
            feedback:
              "This is the reciprocal, one over $f(x)$. The $-1$ in $f^{-1}$ does not mean a power here. The inverse undoes $f$: it swaps inputs and outputs.",
          },
          {
            label: `$f^{-1}(x)=\\dfrac{x}{${b}}$`,
            feedback: `This undoes multiplying by ${b}. But $f$ raises ${b} to the power $x$, which only a logarithm undoes.`,
          },
        ],
        hint: `Write $y=${b}^{x}$, swap $x$ and $y$ to get $x=${b}^{y}$, then ask which logarithm solves for $y$.`,
        explanation: [
          `The inverse $f^{-1}$, read "$f$ inverse", undoes $f$. It sends each output of $f$ back to its input.`,
          `To find it, write $y=${b}^{x}$ and swap $x$ and $y$: $x=${b}^{y}$. Swapping trades inputs and outputs.`,
          `Now solve for $y$. $y$ is the power of ${b} that gives $x$, and a logarithm names that power: $y=\\log_{${b}} x$.`,
          `So $f^{-1}(x)=\\log_{${b}} x$.`,
        ],
      });
    if (ax.kind === "scaled-exponential")
      return choiceSurface(r, {
        prompt: `What is the inverse of $f(x)=${a}\\cdot${b}^{x}$?`,
        options: [
          {
            label: `$f^{-1}(x)=\\log_{${b}}\\left(\\dfrac{x}{${a}}\\right)$`,
            correct: true,
          },
          {
            label: `$f^{-1}(x)=\\dfrac{\\log_{${b}} x}{${a}}$`,
            feedback: `This divides the logarithm by ${a}. But ${a} multiplies the power, so divide it out first. Then take the logarithm of $\\dfrac{x}{${a}}$.`,
          },
          {
            label: `$f^{-1}(x)=${a}\\log_{${b}} x$`,
            feedback: `This multiplies by ${a} instead of dividing. Undo multiplying by ${a} by dividing, inside the logarithm.`,
          },
          {
            label: `$f^{-1}(x)=\\log_{${b}} x-${a}$`,
            feedback: `This subtracts ${a}. But ${a} multiplies $${b}^x$, so undo it by dividing, not by subtracting.`,
          },
          {
            label: `$f^{-1}(x)=\\log_{${a}}\\left(\\dfrac{x}{${b}}\\right)$`,
            feedback: `This swaps the base and the coefficient, the number in front. The base of the logarithm is the base of the power, ${b}.`,
          },
        ],
        hint: `Write $y=${a}\\cdot${b}^{x}$, swap to $x=${a}\\cdot${b}^{y}$ and isolate $${b}^{y}$ by dividing by ${a} before using a logarithm.`,
        explanation: [
          `The inverse $f^{-1}$, read "$f$ inverse", undoes $f$. To find it, write $y=${a}\\cdot${b}^{x}$ and swap $x$ and $y$: $x=${a}\\cdot${b}^{y}$.`,
          `Now solve for $y$. First get the power alone: ${a} multiplies it, so divide both sides by ${a}. That gives $${b}^{y}=\\dfrac{x}{${a}}$.`,
          `$y$ is the power of ${b} that gives $\\dfrac{x}{${a}}$. A logarithm names that power: $y=\\log_{${b}}\\left(\\dfrac{x}{${a}}\\right)$.`,
          `So $f^{-1}(x)=\\log_{${b}}\\left(\\dfrac{x}{${a}}\\right)$.`,
        ],
      });
    if (ax.kind === "shifted-exponential")
      return choiceSurface(r, {
        prompt: `What is the inverse of $f(x)=${b}^{x}${k < 0 ? "-" : "+"}${Math.abs(k)}$?`,
        options: [
          {
            label: `$f^{-1}(x)=\\log_{${b}}\\left(x ${sh(k)}\\right)$`,
            correct: true,
          },
          {
            label: `$f^{-1}(x)=\\log_{${b}}x ${sh(k)}$`,
            feedback: `This removes ${Math.abs(k)} after taking the logarithm. In $f$ the ${Math.abs(k)} is ${k < 0 ? "subtracted" : "added"} last, so the inverse undoes it first, inside the parentheses.`,
          },
          {
            label: `$f^{-1}(x)=\\log_{${b}}\\left(x ${sh(-k)}\\right)$`,
            feedback: `This is a sign error. Undo ${k < 0 ? "subtracting" : "adding"} ${Math.abs(k)} by ${k < 0 ? "adding" : "subtracting"} it.`,
          },
          {
            label: `$f^{-1}(x)=\\dfrac{\\log_{${b}}x}{${k}}$`,
            feedback:
              "This divides by the constant. A constant added to the power is undone by subtracting it, not by dividing the logarithm.",
          },
          {
            label: `$f^{-1}(x)=${b}^{x}${k < 0 ? "+" : "-"}${Math.abs(k)}$`,
            feedback:
              "This only flips the sign of the constant and keeps the power. The inverse of an exponential is a logarithm: swap $x$ and $y$ and solve for $y$.",
          },
        ],
        hint: `Write $y=${b}^{x}${k < 0 ? "-" : "+"}${Math.abs(k)}$, swap $x$ and $y$, then remove the ${Math.abs(k)} from the side with $${b}^{y}$ before using a logarithm.`,
        explanation: [
          `The inverse $f^{-1}$, read "$f$ inverse", undoes $f$. To find it, write $y=${b}^{x}${k < 0 ? "-" : "+"}${Math.abs(k)}$ and swap $x$ and $y$: $x=${b}^{y}${k < 0 ? "-" : "+"}${Math.abs(k)}$.`,
          `Now solve for $y$. First get the power alone by ${k < 0 ? "adding" : "subtracting"} ${Math.abs(k)} on both sides: $${b}^{y}=x ${sh(k)}$.`,
          `$y$ is the power of ${b} that gives $x ${sh(k)}$. A logarithm names that power: $y=\\log_{${b}}\\left(x ${sh(k)}\\right)$.`,
          `So $f^{-1}(x)=\\log_{${b}}\\left(x ${sh(k)}\\right)$.`,
        ],
      });
    // from the cube-root inverse
    const mm = m.m;
    const kk = m.k;
    const gtext = `\\dfrac{\\sqrt[3]{x${kk < 0 ? "-" : "+"}${Math.abs(kk)}}}{${mm}}`;
    const lab = (c: string, add: number) =>
      `$f(x)=${c}x^{3}${add < 0 ? "-" : "+"}${Math.abs(add)}$`;
    return choiceSurface(r, {
      prompt: `The inverse of a function $f$ is $f^{-1}(x)=${gtext}$. Which equation defines $f$?`,
      options: [
        { label: lab(String(mm ** 3), -kk), correct: true },
        {
          label: lab(String(mm), -kk),
          feedback: `This forgets to cube the ${mm}. Solving for $x$ multiplies by ${mm} and then cubes both sides, so the coefficient is $${mm}^3=${mm ** 3}$.`,
        },
        {
          label: lab(String(mm ** 3), kk),
          feedback: `This is a sign error. Cubing gives $x${kk < 0 ? "-" : "+"}${Math.abs(kk)}=(${mm}y)^3$, and moving the constant to the other side changes its sign.`,
        },
        {
          label: lab("\\frac{1}{" + String(mm ** 3) + "}", -kk),
          feedback: `This divides by $${mm}^3$ instead of multiplying. Undo dividing by ${mm} by multiplying by ${mm}, then cube.`,
        },
        {
          label: lab("", -kk).replace("x^{3}", "x^{3}"),
          feedback:
            "This drops the coefficient. The inverse divides by a number, so $f$ must multiply by that number cubed.",
        },
      ],
      hint: `Set $y=${gtext}$, swap $x$ and $y$ (or solve for $x$), then multiply by ${mm} and cube both sides to undo the cube root.`,
      explanation: [
        `$f$ and $f^{-1}$ undo each other, so $f$ is the inverse of $f^{-1}$. Write $y=${gtext}$ and solve for $x$.`,
        `Undo the division first: multiply both sides by ${mm}. That gives $${mm}y=\\sqrt[3]{x${kk < 0 ? "-" : "+"}${Math.abs(kk)}}$.`,
        `Undo the cube root, $\\sqrt[3]{\\ }$, by cubing both sides, raising them to the power 3: $${mm ** 3}y^3=x${kk < 0 ? "-" : "+"}${Math.abs(kk)}$.`,
        `${kk < 0 ? "Add" : "Subtract"} ${Math.abs(kk)} on both sides: $x=${mm ** 3}y^3${-kk < 0 ? "-" : "+"}${Math.abs(kk)}$.`,
        `Renaming the input as $x$ gives $f(x)=${mm ** 3}x^3${-kk < 0 ? "-" : "+"}${Math.abs(kk)}$.`,
      ],
    });
  },
});

/* ------------------------------------------------------ circle and line */
const circlePoints: Record<number, [number, number][]> = {
  5: [
    [3, 4],
    [4, 3],
    [-3, 4],
    [-4, 3],
    [3, -4],
    [4, -3],
    [-3, -4],
    [-4, -3],
    [0, 5],
    [5, 0],
    [0, -5],
    [-5, 0],
  ],
  10: [
    [6, 8],
    [8, 6],
    [-6, 8],
    [-8, 6],
    [6, -8],
    [8, -6],
    [-6, -8],
    [-8, -6],
    [0, 10],
    [10, 0],
    [0, -10],
    [-10, 0],
  ],
  13: [
    [5, 12],
    [12, 5],
    [-5, 12],
    [-12, 5],
    [5, -12],
    [12, -5],
    [-5, -12],
    [-12, -5],
  ],
};
const lineText = (A: number, B: number, C: number) => {
  const x = A === 1 ? "x" : `${A}x`;
  const y = B === 1 ? "+ y" : B === -1 ? "- y" : B < 0 ? `- ${-B}y` : `+ ${B}y`;
  return `${x} ${y} = ${C}`;
};
const ptText = (p: [number, number]) => `(${p[0]},\\ ${p[1]})`;
const circleAxes = {
  ask: defineAxis("ask", ["solve-points", "classify-solutions"] as const),
};
type CircleModel =
  | {
      kind: "points";
      R: number;
      P: [number, number];
      Q: [number, number];
      A: number;
      B: number;
      C: number;
      extra: [number, number];
    }
  | { kind: "classify"; h: number; k: number; R2: number; d: number };
function circleModel(
  r: (lo: number, hi: number) => number,
  ax: { ask: string },
): CircleModel {
  if (ax.ask === "classify-solutions") {
    const h = r(-4, 4);
    const k = r(-4, 4);
    const d = r(1, 5) * (r(0, 1) ? 1 : -1);
    const R2 = pick(r, [
      9, 10, 13, 16, 17, 20, 25, 26, 29, 36, 41, 50,
    ] as const);
    return { kind: "classify", h, k, R2, d };
  }
  const R = pick(r, [5, 10, 13] as const);
  const pts = circlePoints[R]!;
  const P = pick(r, pts);
  const Q = pick(r, pts);
  if (P[0] === Q[0] && P[1] === Q[1]) throw new Error("Need three retries");
  let dx = Q[0] - P[0];
  let dy = Q[1] - P[1];
  const g = gcd(dx, dy);
  dx /= g;
  dy /= g;
  let A = dy;
  let B = -dx;
  if (A < 0 || (A === 0 && B < 0)) {
    A = -A;
    B = -B;
  }
  const C = A * P[0] + B * P[1];
  if (C === 0 || A === 0 || B === 0 || Math.abs(A) > 3 || Math.abs(B) > 3)
    throw new Error("Need three retries");
  const others = pts.filter((p) => A * p[0] + B * p[1] !== C);
  if (others.length < 1) throw new Error("Need three retries");
  return { kind: "points", R, P, Q, A, B, C, extra: pick(r, others) };
}
export const circleLineSystem = chainFamily({
  template: circleLineSystemTemplate,
  axes: circleAxes,
  model: circleModel,
  variant: (m) => m.kind,
  render: (m, _ax, r) => {
    if (m.kind === "points") {
      // Points are listed in a fixed order, so one pair has one label.
      const set = (a: [number, number], b: [number, number]) => {
        const [first, second] =
          a[0] < b[0] || (a[0] === b[0] && a[1] <= b[1]) ? [a, b] : [b, a];
        return `$\\{${ptText(first)},\\ ${ptText(second)}\\}$`;
      };
      const { P, Q } = m;
      const eqL = lineText(m.A, m.B, m.C);
      return choiceSurface(r, {
        prompt: `Which pair of points is the solution of the system $x^{2}+y^{2}=${m.R ** 2}$ and $${eqL}$?`,
        options: [
          { label: set(P, Q), correct: true },
          {
            label: set(P, m.extra),
            feedback: `This checks only the circle. The point $${ptText(m.extra)}$ is on the circle but not on the line $${eqL}$. A solution must make both equations true.`,
          },
          {
            label: set([-P[0], -P[1]], [-Q[0], -Q[1]]),
            feedback: `This flips the signs of both coordinates. These points are on the circle, but the line $${eqL}$ does not pass through them. Check each point in the line equation.`,
          },
          {
            label: set([P[0], -P[1]], [Q[0], -Q[1]]),
            feedback:
              "This flips the sign of each $y$-coordinate. That gives other points of the circle, but they miss the line. Test each point in the line equation too.",
          },
          {
            label: set([P[1], P[0]], [Q[1], Q[0]]),
            feedback:
              "This swaps the $x$- and $y$-coordinates. That gives points of the circle, but they miss the line. Test them in the line equation.",
          },
        ],
        hint: `Solve $${eqL}$ for one variable and substitute it into $x^{2}+y^{2}=${m.R ** 2}$. Or test each pair of points in both equations.`,
        explanation: [
          `$x^{2}+y^{2}=${m.R ** 2}$ is a circle centered at $(0, 0)$ with radius ${m.R}. $${eqL}$ is a straight line.`,
          `A solution of the system is a point on both, where the line crosses the circle. It must make both equations true.`,
          `$${ptText(P)}$: $${par(P[0])}^2+${par(P[1])}^2=${m.R ** 2}$ and $${m.A}\\cdot${par(P[0])}+${par(m.B)}\\cdot${par(P[1])}=${m.C}$. It satisfies both.`,
          `$${ptText(Q)}$: $${par(Q[0])}^2+${par(Q[1])}^2=${m.R ** 2}$ and $${m.A}\\cdot${par(Q[0])}+${par(m.B)}\\cdot${par(Q[1])}=${m.C}$. It satisfies both.`,
          `A line meets a circle at most twice, so these are all the solutions. The solution set is ${set(P, Q)}.`,
        ],
      });
    }
    const { h, k, R2, d } = m;
    const disc = R2 - d * d;
    const cls =
      disc < 0
        ? "nonreal"
        : disc === 0
          ? "one"
          : isPerfectSquare(disc)
            ? "rational"
            : "irrational";
    const xline = h + d;
    const circ = `${h === 0 ? "x^{2}" : `(x${h < 0 ? "+" : "-"}${Math.abs(h)})^{2}`}+${k === 0 ? "y^{2}" : `(y${k < 0 ? "+" : "-"}${Math.abs(k)})^{2}`}=${R2}`;
    const labels = {
      rational: "Two real solutions, both coordinates rational",
      irrational: "Two real solutions with irrational $y$-coordinates",
      nonreal: "Two nonreal complex solutions",
      one: "Exactly one real solution (the line is tangent)",
    } as const;
    const actual =
      cls === "nonreal"
        ? "negative, so the roots are nonreal"
        : cls === "one"
          ? "zero, so there is exactly one root"
          : cls === "rational"
            ? `the perfect square $${Math.sqrt(disc)}^{2}$, so the roots are rational`
            : "positive and not a perfect square, so the roots are irrational";
    const options: { label: string; correct?: true; feedback?: string }[] = [
      { label: labels[cls], correct: true },
      ...(Object.keys(labels) as (keyof typeof labels)[])
        .filter((c) => c !== cls)
        .map((c) => ({
          label: labels[c],
          feedback: `Substitute $x=${xline}$ and solve for the squared $y$-part. It equals $${R2}-${par(d)}^{2}=${disc}$, which is ${actual}. So this description does not fit.`,
        })),
    ];
    return choiceSurface(r, {
      prompt: `Consider the system $${circ}$ and $x=${xline}$. Which statement describes its solutions?`,
      options,
      hint: `Substitute $x=${xline}$ into the circle equation: its $x$-part becomes ${d * d}. Compare that with the right side, ${R2}, to decide whether the squared $y$-part is positive, zero or negative.`,
      explanation: [
        `The first equation is a circle and $x=${xline}$ is a vertical line. Solutions are the points on both, so put $x=${xline}$ into the circle's equation.`,
        `Substitute $x=${xline}$: $${h === 0 ? `${xline}^{2}` : `(${xline}${h < 0 ? "+" : "-"}${Math.abs(h)})^{2}`}+${k === 0 ? "y^{2}" : `(y${k < 0 ? "+" : "-"}${Math.abs(k)})^{2}`}=${R2}$.`,
        `The $x$-part equals $${d * d}$, so $${k === 0 ? "y" : `(y${k < 0 ? "+" : "-"}${Math.abs(k)})`}^{2}=${R2}-${d * d}=${disc}$.`,
        disc < 0
          ? `The square of a real number is never negative, so it cannot equal ${disc}. The solutions are nonreal: $y${k === 0 ? "" : `${k < 0 ? "+" : "-"}${Math.abs(k)}`}=\\pm i\\sqrt{${-disc}}$, where $i^2=-1$. The line misses the circle.`
          : disc === 0
            ? "Only 0 squares to 0, so there is exactly one solution. The line is tangent: it touches the circle at one point."
            : isPerfectSquare(disc)
              ? `Two numbers square to ${disc}: ${Math.sqrt(disc)} and its opposite. ${disc} is a perfect square, so both solutions have rational coordinates, numbers that can be written as fractions.`
              : `Two numbers square to ${disc}: $\\pm\\sqrt{${disc}}$. ${disc} is not a perfect square, so $\\sqrt{${disc}}$ is irrational: it cannot be written as a fraction.`,
        `So the system has: ${labels[cls].charAt(0).toLowerCase()}${labels[cls].slice(1)}.`,
      ],
    });
  },
});

/* ------------------------------------------ rational equation, two denominators */
const fac = (c: number) => (c >= 0 ? `x+${c}` : `x-${-c}`);
interface RationalModel {
  p: number;
  r: number;
  s: number;
  M: number;
}
function rationalModel(rnd: (lo: number, hi: number) => number): RationalModel {
  const p = rnd(-6, 6);
  const r = rnd(-6, 6);
  const s = rnd(-6, 6);
  if (!p || !r || !s || p + r === 0 || s === r || s === -p || r === -p)
    throw new Error("Need three retries");
  return { p, r, s, M: -s * (p + r) };
}
export const rationalTwoDenominators = chainFamily({
  template: rationalTwoDenominatorsTemplate,
  axes: { order: defineAxis("order", ["plain", "swapped"] as const) },
  model: rationalModel,
  variant: (m) => (m.s > 0 ? "positive-solution" : "negative-solution"),
  render: (m, ax, rnd) => {
    const F1 = fac(m.p);
    const F2 = fac(-m.r);
    const first = `\\dfrac{x}{${F1}}`;
    const second = `\\dfrac{${Math.abs(m.s)}}{${F2}}`;
    const op = m.s > 0 ? "-" : "+";
    const lhs =
      ax.order === "plain"
        ? `${first} ${op} ${second}`
        : m.s > 0
          ? `-${second} + ${first}`
          : `${second} + ${first}`;
    const eq = `${lhs}=\\dfrac{${m.M}}{(${F1})(${F2})}`;
    return choiceSurface(rnd, {
      prompt: `Which is the solution set of $${eq}$?`,
      options: [
        { label: `$x=${m.s}$ only`, correct: true },
        {
          label: `$x=${m.r}$ only`,
          feedback: `This keeps the wrong root. $x=${m.r}$ makes the denominator $${F2}$ equal to zero, and dividing by zero is undefined, so it is excluded.`,
        },
        {
          label: `$x=${m.s}$ and $x=${m.r}$`,
          feedback: `This keeps an extraneous root, one that comes from the algebra but fails the original equation. $x=${m.r}$ makes $${F2}$ equal to zero, so it must be rejected.`,
        },
        {
          label: "No solution",
          feedback: `This rejects both roots. $x=${m.s}$ does not make any denominator zero and makes the original equation true, so there is a solution.`,
        },
      ],
      hint: `Multiply both sides by $(${F1})(${F2})$. Before you finish, list the $x$-values that make $${F1}$ or $${F2}$ equal to zero.`,
      explanation: [
        `Dividing by zero is undefined. So first list the $x$-values that make a denominator, a bottom of a fraction, zero: $x=${-m.p}$ and $x=${m.r}$. These cannot be solutions.`,
        `Clear the fractions by multiplying every term by $(${F1})(${F2})$, the common denominator. That gives $x(${F2}) ${op} ${Math.abs(m.s)}(${F1})=${m.M}$.`,
        `Multiply out and move everything to one side: $${polyTex([1, -(m.r + m.s), m.r * m.s])}=0$.`,
        `This factors as $(${fac(-m.s)})(${fac(-m.r)})=0$. A product is zero only when a factor is zero, so $x=${m.s}$ or $x=${m.r}$.`,
        `$x=${m.r}$ makes $${F2}$ zero, so it is extraneous: it came from the algebra but does not work in the original equation.`,
        `The solution set is $x=${m.s}$ only.`,
      ],
    });
  },
});

/* ----------------------------------------------------- trinomial product */
interface ProductModel {
  p: number[];
  q: number[];
  square: boolean;
}
function productModel(
  rnd: (lo: number, hi: number) => number,
  ax: { shape: "trinomial-times-trinomial" | "square-trinomial" },
): ProductModel {
  const nz = () => {
    const v = rnd(-4, 4);
    if (!v) throw new Error("Need three retries");
    return v;
  };
  const p = [pick(rnd, [1, 1, 2, -1] as const), nz(), nz()];
  const square = ax.shape === "square-trinomial";
  const q = square ? p : [pick(rnd, [1, 2, -1, 3] as const), nz(), nz()];
  return { p, q, square };
}
const mulPoly = (a: number[], b: number[]) => {
  const out = new Array(a.length + b.length - 1).fill(0);
  a.forEach((x, i) => b.forEach((y, j) => (out[i + j] += x * y)));
  return out;
};
export const trinomialProduct = chainFamily({
  template: trinomialProductTemplate,
  axes: {
    shape: defineAxis("shape", [
      "trinomial-times-trinomial",
      "square-trinomial",
    ] as const),
  },
  model: productModel,
  variant: (m) => (m.square ? "square" : "product"),
  render: (m, _ax, rnd) => {
    const [a, b, c] = m.p as [number, number, number];
    const [d, e, f] = m.q as [number, number, number];
    const tex = (cs: number[]) => `$${polyTex(cs)}$`;
    const good = mulPoly(m.p, m.q);
    const wrongSame = [a * d, 0, b * e, 0, c * f];
    const noMid = [a * d, a * e + b * d, a * f + c * d, b * f + c * e, c * f];
    noMid[2] = a * f + c * d; // omits b*e from the x^2 coefficient
    const signSlip = [a * d, a * e + b * d, good[2]!, b * f - c * e, c * f];
    const crossSlip = [a * d, a * e - b * d, good[2]!, good[3]!, c * f];
    const p1 = `${polyTex(m.p)}`;
    const q1 = `${polyTex(m.q)}`;
    return choiceSurface(rnd, {
      prompt: m.square
        ? `Which expression is equivalent to $(${p1})^{2}$?`
        : `Which expression is equivalent to $(${p1})(${q1})$?`,
      options: [
        { label: tex(good), correct: true },
        {
          label: tex(wrongSame),
          feedback:
            "This multiplies only the matching terms, first with first and so on. That leaves out the cross products. Every term in the first factor must multiply every term in the second.",
        },
        {
          label: tex(noMid),
          feedback: `This misses one of the three products that make $x^2$. The two $x$ terms also multiply to an $x^2$ term: $(${polyTex([b, 0])})(${polyTex([e, 0])})$.`,
        },
        {
          label: tex(signSlip),
          feedback: `This has a sign error in the $x$ term. Two products make $x$ terms: the first factor's $x$ term times the second's constant, and its constant times the second's $x$ term. Check each sign before adding.`,
        },
        {
          label: tex(crossSlip),
          feedback: `This has a sign error in the $x^3$ term. Two products make $x^3$: each $x^2$ term times the other factor's $x$ term. Check each sign before adding.`,
        },
      ],
      hint: `Multiply each term of $${p1}$ by every term of the second factor ($${m.square ? p1 : q1}$), starting with $${a === 1 ? "" : a === -1 ? "-" : a}x^{2}$ times each, then combine terms with the same power of $x$.`,
      explanation: [
        `${m.square ? `Squaring means multiplying a thing by itself, so this is $(${p1})(${p1})$.` : `The two factors are multiplied.`} To distribute, multiply every term of the first factor by every term of the second.`,
        `Each factor has 3 terms, so there are $3 \\times 3 = 9$ products. Multiplying powers of $x$ adds their exponents, for example $x^2\\cdot x=x^3$.`,
        `Like terms have the same power of $x$. Add the products for each power.`,
        `The $x^4$ coefficient, the number multiplying $x^4$, is $${a * d}$. For $x^3$ it is $${a * e + b * d}$, and for $x^2$ it is $${a * f + b * e + c * d}$.`,
        `For $x$ it is $${b * f + c * e}$, and the constant term, with no $x$, is $${c * f}$.`,
        `So the product is $${polyTex(good)}$.`,
      ],
    });
  },
});

/* ---------------------------------------------- cubic quotient and remainder */
interface DivisionModel {
  q: [number, number, number];
  R: number;
  k: number;
}
function divisionModel(rnd: (lo: number, hi: number) => number): DivisionModel {
  const q: [number, number, number] = [
    pick(rnd, [1, 1, 2, 3] as const),
    rnd(-5, 5),
    rnd(-5, 5),
  ];
  const R = rnd(-9, 9);
  const k = pick(rnd, [-3, -2, -1, 1, 2, 3] as const);
  if (!R) throw new Error("Need three retries");
  return { q, R, k };
}
export const cubicQuotientRemainder = chainFamily({
  template: cubicQuotientRemainderTemplate,
  axes: { divisor: defineAxis("divisor", ["x-plus", "x-minus"] as const) },
  model: (rnd, ax) => {
    const m = divisionModel(rnd);
    // x-plus: divisor x+|k|; x-minus: divisor x-|k|.
    return {
      ...m,
      k: ax.divisor === "x-plus" ? Math.abs(m.k) : -Math.abs(m.k),
    };
  },
  variant: (m) => (m.k > 0 ? "plus" : "minus"),
  render: (m, _ax, rnd) => {
    const [q2, q1, q0] = m.q;
    const k = m.k;
    const dividend = [q2, q1 + k * q2, q0 + k * q1, m.R + k * q0];
    const D = fac(k);
    const frac2 = (R: number, den = D) =>
      `${R < 0 ? "-" : "+"} \\dfrac{${Math.abs(R)}}{${den}}`;
    const quo = (a: number[]) => polyTex(a);
    // wrong root: synthetic division with +k instead of -k
    const b0 = dividend[0]!;
    const b1 = dividend[1]! + k * b0;
    const b2 = dividend[2]! + k * b1;
    const Rw = dividend[3]! + k * b2;
    return choiceSurface(rnd, {
      prompt: `Which expression is equivalent to $\\dfrac{${polyTex(dividend)}}{${D}}$?`,
      options: [
        { label: `$${quo(m.q)} ${frac2(m.R)}$`, correct: true },
        {
          label: `$${quo(m.q)} ${m.R < 0 ? "-" : "+"} ${Math.abs(m.R)}$`,
          feedback:
            "This adds the remainder as a plain number. The remainder is still divided by the divisor, so write it as a fraction: the remainder over the divisor.",
        },
        {
          label: `$${quo([b0, b1, b2])} ${frac2(Rw)}$`,
          feedback: `This used ${k} in synthetic division, the wrong sign. Use the zero of the divisor, the $x$ that makes $${D}$ zero, which is $x=${-k}$.`,
        },
        {
          label: `$${quo(m.q)} ${frac2(-m.R)}$`,
          feedback:
            "This flips the remainder's sign. Keep the sign the remainder has when the division stops.",
        },
        {
          label: `$${quo(m.q)} ${frac2(m.R, fac(-k))}$`,
          feedback: `This puts the wrong binomial under the remainder. The remainder fraction has the divisor, $${D}$, as its denominator.`,
        },
      ],
      hint: `Divide $${polyTex(dividend)}$ by $${D}$. With synthetic division, use the zero of the divisor, $x=${-k}$, and bring down ${dividend[0]} first.`,
      explanation: [
        `Dividing a polynomial gives a quotient, the main result, and a remainder, what is left over. Synthetic division is a short way to divide by a binomial like $${D}$.`,
        `It uses the zero of the divisor, the $x$ that makes $${D}$ zero: $x=${-k}$. Write the dividend's coefficients, the numbers in front of each power: ${dividend.join(", ")}.`,
        `Bring down the first coefficient, ${dividend[0]}. Then repeat: multiply by ${-k}, add to the next coefficient. This gives ${dividend[1]! + -k * dividend[0]!}, then ${q0}, then ${m.R}.`,
        `The last number, ${m.R}, is the remainder. The others, ${m.q.join(", ")}, are the quotient's coefficients, one power lower: $${quo(m.q)}$.`,
        `The remainder is still divided by the divisor, so it becomes a fraction. The expression equals $${quo(m.q)} ${frac2(m.R)}$.`,
      ],
    });
  },
});

/* ---------------------------------------------------- powers of i in a sum */
interface IModel {
  v: string;
  terms: { c: number; withVar: boolean; e: number }[];
}
function iModel(rnd: (lo: number, hi: number) => number): IModel {
  const v = pick(rnd, ["x", "a", "k"] as const);
  const n = rnd(3, 4);
  const terms = Array.from({ length: n }, () => ({
    c: pick(rnd, [1, 2, 3, 4, 5, -1, -2, -3] as const),
    withVar: rnd(0, 1) === 1,
    e: rnd(2, 11),
  }));
  return { v, terms };
}
/** Real and imaginary parts as [varCoeff, constant] pairs under a power map. */
function reduceI(m: IModel, map: readonly [number, number][]) {
  const re = [0, 0];
  const im = [0, 0];
  for (const t of m.terms) {
    const [rp, ip] = map[t.e % 4]!;
    const slot = t.withVar ? 0 : 1;
    re[slot]! += t.c * rp;
    im[slot]! += t.c * ip;
  }
  return { re, im };
}
const exactMap: [number, number][] = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];
const iText = (parts: { re: number[]; im: number[] }, v: string) => {
  const real = polyTex([parts.re[0]!, parts.re[1]!], v);
  const [i0, i1] = parts.im as [number, number];
  if (i0 !== 0 && i1 !== 0) return `${real} + (${polyTex([i0, i1], v)})i`;
  const c = i0 !== 0 ? i0 : i1;
  const body =
    i0 !== 0
      ? `${Math.abs(c) === 1 ? "" : Math.abs(c)}${v}i`
      : `${Math.abs(c) === 1 ? "" : Math.abs(c)}i`;
  return `${real} ${c < 0 ? "-" : "+"} ${body}`;
};
export const powersOfISum = chainFamily({
  template: powersOfISumTemplate,
  axes: { terms: defineAxis("terms", ["three", "four"] as const) },
  model: (rnd, ax) => {
    const m = iModel(rnd);
    const want = ax.terms === "three" ? 3 : 4;
    const terms = m.terms.slice(0, want);
    while (terms.length < want) terms.push({ c: 2, withVar: false, e: 5 });
    return { ...m, terms };
  },
  variant: (m) => `${m.terms.length}-terms`,
  render: (m, _ax, rnd) => {
    const good = reduceI(m, exactMap);
    if (good.re.every((x) => x === 0) || good.im.every((x) => x === 0))
      return null;
    if (!m.terms.some((t) => t.withVar)) return null;
    // the imaginary part must be a real combination we can format plainly
    const expr = m.terms
      .map((t, i) => {
        const body = t.withVar
          ? `${Math.abs(t.c) === 1 ? "" : Math.abs(t.c)}${m.v}i^{${t.e}}`
          : `${Math.abs(t.c)}i^{${t.e}}`;
        return i === 0
          ? t.c < 0
            ? `-${body}`
            : body
          : ` ${t.c < 0 ? "-" : "+"} ${body}`;
      })
      .join("");
    const lab = (parts: { re: number[]; im: number[] }) =>
      `$${iText(parts, m.v)}$`;
    const swap = { re: good.im, im: good.re };
    const evenWrong = reduceI(m, [
      [1, 0],
      [0, 1],
      [1, 0],
      [0, -1],
    ]);
    const oddWrong = reduceI(m, [
      [1, 0],
      [0, 1],
      [-1, 0],
      [0, 1],
    ]);
    const conjugate = { re: good.re, im: good.im.map((x) => -x) };
    const valid = (x: { re: number[]; im: number[] }) =>
      !x.re.every((y) => y === 0) && !x.im.every((y) => y === 0);
    const wrongs = [
      {
        v: evenWrong,
        f: "This treats $i^2$ as 1. In fact $i^2=-1$, so any power 2 more than a multiple of 4 is also $-1$.",
      },
      {
        v: oddWrong,
        f: "This treats $i^3$ as $i$. In fact $i^3=i^2\\cdot i=-i$, so any power 3 more than a multiple of 4 is $-i$.",
      },
      {
        v: swap,
        f: "This swaps the real and imaginary parts. The real part collects terms whose power of $i$ becomes 1 or $-1$. The imaginary part collects those that become $i$ or $-i$.",
      },
      {
        v: conjugate,
        f: "This has the wrong sign on the imaginary part. Check each odd power: 1 more than a multiple of 4 gives $i$, but 3 more gives $-i$.",
      },
    ].filter((w) => valid(w.v));
    const lines = m.terms.map((t) => {
      const base = ["1", "i", "-1", "-i"][t.e % 4]!;
      return `$i^{${t.e}}=${base}$`;
    });
    return choiceSurface(rnd, {
      prompt: `Which expression is equivalent to $${expr}$, where $${m.v}$ is a real number?`,
      options: [
        { label: lab(good), correct: true },
        ...wrongs.map((w) => ({ label: lab(w.v), feedback: w.f })),
      ],
      hint: `Reduce each power of $i$ first. The powers of $i$ repeat every 4: $i^1=i$, $i^2=-1$, $i^3=-i$, $i^4=1$. Start with $i^{${m.terms[0]!.e}}$, then collect real and imaginary parts.`,
      explanation: [
        `$i$ is the imaginary unit: $i^2=-1$. Its powers repeat in a cycle of 4: $i^1=i$, $i^2=-1$, $i^3=-i$, $i^4=1$, then $i^5=i$ again.`,
        `So only the remainder after dividing the exponent by 4 matters. Every $i^4$ is 1 and drops out.`,
        `Reduce each power: ${lines.join(", ")}.`,
        `Substitute these values. Terms with no $i$ left form the real part, and terms with $i$ form the imaginary part.`,
        `The real part is $${polyTex([good.re[0]!, good.re[1]!], m.v)}$ and the number multiplying $i$ is $${polyTex([good.im[0]!, good.im[1]!], m.v)}$.`,
        `The sum is $${iText(good, m.v)}$.`,
      ],
    });
  },
});

/* ---------------------------------------------- two-radical equations */
interface RadicalCase {
  p: number;
  a: number;
  b: number;
  c: number;
  good: number;
  bad: number;
}
const radicalCases: RadicalCase[] = (() => {
  const out: RadicalCase[] = [];
  for (const p of [2, 3, 4, 5])
    for (let a = -4; a <= 12; a++)
      for (let b = -4; b <= 12; b++)
        for (const c of [1, 2, 3]) {
          const K = a - b - c * c;
          const A = (p - 1) ** 2;
          const B = 2 * (p - 1) * K - 4 * c * c;
          const C = K * K - 4 * c * c * b;
          const D = B * B - 4 * A * C;
          if (D <= 0 || !isPerfectSquare(D)) continue;
          const sq = Math.sqrt(D);
          const roots = [(-B + sq) / (2 * A), (-B - sq) / (2 * A)];
          if (!roots.every(Number.isInteger)) continue;
          const holds = (x: number) =>
            x + b >= 0 &&
            p * x + a >= 0 &&
            Math.abs(Math.sqrt(p * x + a) - Math.sqrt(x + b) - c) < 1e-9;
          const valid = roots.filter(holds);
          if (valid.length !== 1) continue;
          const bad = roots.find((x) => !holds(x))!;
          if (valid[0]! < 0) continue;
          out.push({ p, a, b, c, good: valid[0]!, bad });
        }
  return out;
})();
export const twoRadicalEquation = chainFamily({
  template: twoRadicalEquationTemplate,
  axes: {
    arrangement: defineAxis("arrangement", [
      "difference",
      "radical-isolated",
    ] as const),
  },
  model: (rnd) => radicalCases[rnd(0, radicalCases.length - 1)]!,
  variant: (m) => `coefficient-${m.p}`,
  render: (m, ax) => {
    const R1 = polyTex([m.p, m.a]);
    const R2 = polyTex([1, m.b]);
    const eq =
      ax.arrangement === "difference"
        ? `\\sqrt{${R1}}-\\sqrt{${R2}}=${m.c}`
        : `\\sqrt{${R1}}=\\sqrt{${R2}}+${m.c}`;
    const K = m.a - m.b - m.c * m.c;
    const A = (m.p - 1) ** 2;
    const B = 2 * (m.p - 1) * K - 4 * m.c * m.c;
    const C = K * K - 4 * m.c * m.c * m.b;
    const lin = polyTex([m.p - 1, K]);
    const badNeg = m.bad + m.b < 0 || m.p * m.bad + m.a < 0;
    return numberSurface({
      prompt: `Solve $${eq}$ for $x$. Enter the solution that satisfies the equation.`,
      answer: String(m.good),
      label: "Answer ($x$)",
      hint: `Isolate one radical, for example $\\sqrt{${R1}}=${m.c}+\\sqrt{${R2}}$, then square both sides. One radical remains; isolate it and square again. Test both candidates in $${eq}$.`,
      explanation: [
        `A radical is a root sign, here a square root. Squaring undoes a square root, but it works best with one radical alone on a side.`,
        `Isolate $\\sqrt{${R1}}$: $\\sqrt{${R1}}=${m.c}+\\sqrt{${R2}}$. Square both sides. The right side is a binomial, so use $(p+q)^2=p^2+2pq+q^2$: $${R1}=${m.c * m.c}+${2 * m.c}\\sqrt{${R2}}+${R2}$.`,
        `One radical remains. Move everything else to the left: $${lin}=${2 * m.c}\\sqrt{${R2}}$. Square again: $(${lin})^{2}=${4 * m.c * m.c}(${R2})$.`,
        `Multiply out and collect terms in standard form: $${polyTex([A, B, C])}=0$. Solving gives $x=${m.good}$ or $x=${m.bad}$.`,
        `Squaring can create extraneous solutions, answers that fail the original equation. So check both.`,
        `Check $x=${m.good}$: $\\sqrt{${m.p * m.good + m.a}}-\\sqrt{${m.good + m.b}}=${Math.sqrt(m.p * m.good + m.a)}-${Math.sqrt(m.good + m.b)}=${m.c}$. It works.`,
        badNeg
          ? `Check $x=${m.bad}$: it makes a radicand negative, so it is not a solution.`
          : isPerfectSquare(m.p * m.bad + m.a) && isPerfectSquare(m.bad + m.b)
            ? `Check $x=${m.bad}$: $\\sqrt{${m.p * m.bad + m.a}}-\\sqrt{${m.bad + m.b}}=${Math.sqrt(m.p * m.bad + m.a)}-${Math.sqrt(m.bad + m.b)}=${Math.sqrt(m.p * m.bad + m.a) - Math.sqrt(m.bad + m.b)}$, not ${m.c}, so it is extraneous.`
            : `Check $x=${m.bad}$: the left side is about ${(Math.sqrt(m.p * m.bad + m.a) - Math.sqrt(m.bad + m.b)).toFixed(2)}, not ${m.c}, so it is extraneous.`,
        `The solution is $x=${m.good}$.`,
      ],
    });
  },
});

/* --------------------------------------- absolute value equals linear */
interface AbsModel {
  p: number;
  qn: number;
  qd: number;
  r: number;
  x1: number;
  x2: number;
  v1: boolean;
  v2: boolean;
}
function absModel(rnd: (lo: number, hi: number) => number): AbsModel {
  const p = rnd(-5, 6);
  const [qn, qd] = pick(rnd, [
    [2, 1],
    [3, 1],
    [-2, 1],
    [-3, 1],
    [1, 2],
    [-1, 2],
  ] as const);
  const r = rnd(-9, 9);
  // |x - p| = (qn/qd) x + r. Case 1: x - p = q x + r. Case 2: p - x = q x + r.
  const n1 = qd * (p + r);
  const d1 = qd - qn;
  const n2 = qd * (p - r);
  const d2 = qd + qn;
  if (n1 % d1 !== 0 || n2 % d2 !== 0) throw new Error("Need three retries");
  const x1 = n1 / d1;
  const x2 = n2 / d2;
  const holds = (x: number) => Math.abs(x - p) * qd === qn * x + r * qd;
  const v1 = holds(x1);
  const v2 = holds(x2);
  if (x1 === x2 || (!v1 && !v2)) throw new Error("Need three retries");
  return { p, qn, qd, r, x1, x2, v1, v2 };
}
const absLine = (m: AbsModel) =>
  m.qd === 1
    ? polyTex([m.qn, m.r])
    : `${m.qn < 0 ? "-" : ""}\\frac{1}{${m.qd}}x${m.r === 0 ? "" : m.r < 0 ? ` - ${-m.r}` : ` + ${m.r}`}`;
export const absoluteValueLinear = chainFamily({
  template: absoluteValueLinearTemplate,
  axes: {
    notation: defineAxis("notation", ["equation", "functions"] as const),
  },
  model: absModel,
  variant: (m) => (m.v1 && m.v2 ? "two-solutions" : "one-extraneous"),
  render: (m, ax, rnd) => {
    const inner = polyTex([1, -m.p]);
    const lin = absLine(m);
    const setLabel = (xs: number[]) =>
      xs.length === 0
        ? "No solution"
        : xs.length === 1
          ? `$x=${xs[0]}$`
          : `$x=${Math.min(...xs)}$ and $x=${Math.max(...xs)}$`;
    const good = [m.v1 ? m.x1 : null, m.v2 ? m.x2 : null].filter(
      (v): v is number => v !== null,
    );
    const rhsAt = (x: number) => frac(m.qn * x + m.r * m.qd, m.qd);
    const why = (x: number) => {
      const left = Math.abs(x - m.p);
      const equal = left * m.qd === m.qn * x + m.r * m.qd;
      return `At $x=${x}$ the left side is $|${m.p === 0 ? par(x) : `${par(x)}${m.p < 0 ? "+" : "-"}${Math.abs(m.p)}`}|=${left}$ and the right side is $${rhsAt(x)}$, which ${equal ? "equals it" : "does not equal it"}.`;
    };
    const options = [
      { label: setLabel(good), correct: true as const },
      {
        label: setLabel([m.x1, m.x2]),
        feedback: `This keeps both case answers without checking them. An absolute value is never negative, so one answer can fail. ${why(!m.v1 ? m.x1 : m.x2)}`,
      },
      {
        label: setLabel([m.x1]),
        feedback: m.v2
          ? `This misses the second case, where the inside is negative. It also gives a solution. ${why(m.x2)}`
          : `${why(m.x1)}`,
      },
      {
        label: setLabel([m.x2]),
        feedback: m.v1
          ? `This misses the first case, where the inside is positive. It also gives a solution. ${why(m.x1)}`
          : `${why(m.x2)}`,
      },
      {
        label: "No solution",
        feedback: `This rejects every answer, but one value does make the equation true. ${why(good[0]!)}`,
      },
    ];
    return choiceSurface(rnd, {
      prompt:
        ax.notation === "equation"
          ? `Which is the solution set of $|${inner}|=${lin}$?`
          : `Let $f(x)=|${inner}|$ and $g(x)=${lin}$. For which values of $x$ is $f(x)=g(x)$?`,
      options,
      hint: `Split into two cases: $${inner}=${lin}$ and $${inner}=-(${lin})$. Solve each, then check both answers in the original equation, since $|${inner}|$ cannot be negative.`,
      explanation: [
        `The absolute value $|${inner}|$ is the distance of $${inner}$ from 0, so it is never negative. The inside can be the right side, or its opposite.`,
        `Case 1, the inside equals the right side: $${inner}=${lin}$ gives $x=${m.x1}$.`,
        `Case 2, the inside equals the opposite of the right side: $${inner}=-(${lin})$ gives $x=${m.x2}$.`,
        `The right side may be negative at one of these, which an absolute value can never equal. So check both in the original equation.`,
        `Check $x=${m.x1}$. ${why(m.x1)}`,
        `Check $x=${m.x2}$. ${why(m.x2)}`,
        good.length === 2
          ? `Both work, so the solution set is ${setLabel(good)}.`
          : `Only $x=${good[0]}$ works. The other value is extraneous, an answer from the algebra that fails the original equation. The solution set is ${setLabel(good)}.`,
      ],
    });
  },
});

/* -------------------------------------------- factor a shifted trinomial */
interface ShiftModel {
  k: number;
  lead: boolean;
  p: number;
  q: number;
  r: number;
  s: number;
}
function shiftModel(
  rnd: (lo: number, hi: number) => number,
  ax: { leading: "monic" | "non-monic" },
): ShiftModel {
  const k = rnd(2, 6) * (rnd(0, 1) ? 1 : -1);
  const lead = ax.leading === "non-monic";
  const p = lead ? pick(rnd, [1, 2, 3] as const) : 1;
  const r = lead ? pick(rnd, [1, 2, 3] as const) : 1;
  const q = rnd(-6, 6);
  const s = rnd(-6, 6);
  if (
    !q ||
    !s ||
    (lead && p * r === 1) ||
    (!lead && q === s) ||
    gcd(p, Math.abs(q)) !== 1 ||
    gcd(r, Math.abs(s)) !== 1
  )
    throw new Error("Need three retries");
  if (lead && p === r && q === s) throw new Error("Need three retries");
  return { k, lead, p, q, r, s };
}
const shifted = (c: number) => `x${c < 0 ? "+" : "-"}${Math.abs(c)}`;
export const shiftedTrinomialFactor = chainFamily({
  template: shiftedTrinomialFactorTemplate,
  axes: { leading: defineAxis("leading", ["monic", "non-monic"] as const) },
  model: shiftModel,
  variant: (m) => (m.lead ? "non-monic" : "monic"),
  render: (m, _ax, rnd) => {
    const { k, p, q, r, s } = m;
    const u = `(${shifted(k)})`;
    const A = p * r;
    const B = p * s + q * r;
    const C = q * s;
    const part = (coef: number, body: string, first: boolean) => {
      const abs = Math.abs(coef);
      const text = `${abs === 1 && body ? "" : abs}${body}`;
      return first
        ? `${coef < 0 ? "-" : ""}${text}`
        : ` ${coef < 0 ? "-" : "+"} ${text}`;
    };
    const expr = `${part(A, `${u}^{2}`, true)}${part(B, u, false)}${part(C, "", false)}`;
    const good = [binomial(p, q - p * k), binomial(r, s - r * k)];
    const wrap = (t: string) => (/^[a-z]$/.test(t) ? t : `(${t})`);
    // Factors commute: list them in a fixed order so one product has one label.
    const f = (a: string, b: string) =>
      `$${[wrap(a), wrap(b)].sort().join("")}$`;
    const opts = [
      { label: f(good[0]!, good[1]!), correct: true as const },
      {
        label: f(binomial(p, q), binomial(r, s)),
        feedback: `This factors correctly in terms of $u=${shifted(k)}$, but then writes $u$ as $x$. Substitute $${shifted(k)}$ back for $u$ in each factor.`,
      },
      {
        label: f(binomial(p, q + p * k), binomial(r, s + r * k)),
        feedback: `This is a sign error when substituting back. A factor $pu+q$ with $u=${shifted(k)}$ becomes $px+(q-pk)$. Here $k=${k}$, and this answer added $pk$ instead of subtracting it.`,
      },
      {
        label: f(binomial(p, q - k), binomial(r, s - k)),
        feedback: `This multiplied only the first term of $${shifted(k)}$ by the factor's coefficient. Distribute over both terms: a factor $pu+q$ becomes $px+(q-pk)$, so the constant changes by $p$ times ${k}, not by ${k}.`,
      },
      {
        label: f(binomial(p, -q - p * k), binomial(r, -s - r * k)),
        feedback:
          "This flips the signs of the constants. Those signs come from factoring the trinomial in $u$: the constants must multiply and add to the right numbers. Negating them gives a different trinomial.",
      },
    ];
    const hint = m.lead
      ? `Let $u=${shifted(k)}$. The expression is $${polyTex([A, B, C], "u")}$. Factor that trinomial first, then replace $u$ by $${shifted(k)}$.`
      : `Let $u=${shifted(k)}$. The expression is $${polyTex([A, B, C], "u")}$. Find two numbers with product ${C} and sum ${B}, then replace $u$ by $${shifted(k)}$.`;
    return choiceSurface(rnd, {
      prompt: `Which expression is equivalent to $${expr}$?`,
      options: opts,
      hint,
      explanation: [
        `The group $${u}$ appears twice, like one variable. Name it $u=${shifted(k)}$ so the structure is easy to see.`,
        `With that name the expression is $${polyTex([A, B, C], "u")}$, an ordinary trinomial, an expression with three terms.`,
        m.lead
          ? `Factor it as a product of two binomials, expressions with two terms: $${polyTex([A, B, C], "u")}=(${binomial(p, q, "u")})(${binomial(r, s, "u")})$. Multiplying back checks it.`
          : `Find two numbers that multiply to ${C} and add to ${B}: ${q} and ${s}. So $${polyTex([A, B, C], "u")}=(${binomial(p, q, "u")})(${binomial(r, s, "u")})$.`,
        `Replace $u$ by $${shifted(k)}$: $(${binomial(p, q, `(${shifted(k)})`)})(${binomial(r, s, `(${shifted(k)})`)})$.`,
        `Distribute and combine the numbers in each factor: $${f(good[0]!, good[1]!).replaceAll("$", "")}$.`,
        `So the expression is equivalent to ${f(good[0]!, good[1]!)}.`,
      ],
    });
  },
});

/* -------------------------------------- roots and powers, one exponent */
const expTex = (num: number, den: number) =>
  den === 1 ? String(num) : `\\frac{${num}}{${den}}`;
const rationalExponentAxes = {
  form: defineAxis("form", [
    "quotient-of-powers",
    "coefficient-radical",
  ] as const),
};
interface RationalExponentModel {
  P12: number;
  Q12: number;
  c: number;
  d: number;
  m: number;
  P: number;
}
function rationalExponentModel(
  rnd: (lo: number, hi: number) => number,
): RationalExponentModel {
  return {
    P12: pick(rnd, [24, 36, 48, 6, 18, 30] as const),
    Q12: pick(rnd, [6, 24, 18, 12, 3] as const),
    c: pick(rnd, [2, 3, 5] as const),
    d: pick(rnd, [2, 3] as const),
    m: pick(rnd, [1, 2, 4, 5] as const),
    P: pick(rnd, [1, 2, 3] as const),
  };
}
const exp12 = (n12: number) => {
  const g = gcd(Math.abs(n12), 12) || 1;
  return expTex(n12 / g, 12 / g);
};
export const rationalExponentProduct = chainFamily({
  template: rationalExponentProductTemplate,
  axes: rationalExponentAxes,
  model: rationalExponentModel,
  variant: (m) => (m.P12 > 12 ? "large-power" : "small-power"),
  render: (m, ax, rnd) => {
    if (ax.form === "quotient-of-powers") {
      const e = 4 + m.P12 - m.Q12;
      if (e === 0 || e === 12) return null;
      const pw = (n12: number) =>
        exp12(n12) === "1" ? "a" : `a^{${exp12(n12)}}`;
      const P = pw(m.P12);
      const Q = pw(m.Q12);
      return choiceSurface(rnd, {
        prompt: `Which expression is equivalent to $\\dfrac{\\sqrt[3]{a}\\cdot ${P}}{${Q}}$, where $a>0$?`,
        options: [
          { label: `$${pw(e)}$`, correct: true },
          {
            label: `$${pw(4 + m.P12 + m.Q12)}$`,
            feedback:
              "This added the denominator's exponent. Dividing powers with the same base subtracts the exponents.",
          },
          {
            label: `$${pw(m.P12 - m.Q12)}$`,
            feedback:
              "This leaves out the cube root. $\\sqrt[3]{a}$ is $a^{1/3}$, and its exponent $\\frac13$ joins the sum.",
          },
          {
            label: `$${pw(36 + m.P12 - m.Q12)}$`,
            feedback:
              "This treats the cube root as cubing. The cube root of $a$ is $a^{1/3}$, not $a^{3}$.",
          },
          {
            label: `$${pw(m.Q12 - m.P12 - 4)}$`,
            feedback:
              "This subtracts in the wrong order. The denominator's exponent is subtracted from the numerator's.",
          },
        ],
        hint: `Write $\\sqrt[3]{a}$ as $a^{1/3}$. Then add it to the exponent $${exp12(m.P12)}$ in the numerator and subtract the exponent of the denominator, $${exp12(m.Q12)}$.`,
        explanation: [
          `Write every factor as a power of $a$, so exponent rules apply. A cube root is the power $\\frac13$: $\\sqrt[3]{a}=a^{1/3}$, since three factors of $a^{1/3}$ multiply to $a$.`,
          `Multiplying powers of the same base adds the exponents. The numerator is $a^{1/3}\\cdot ${P}=a^{1/3+${exp12(m.P12)}}$.`,
          `Dividing powers of the same base subtracts the exponents. So subtract the exponent of $${Q}$.`,
          `The exponent is $\\frac13+${exp12(m.P12)}-${exp12(m.Q12)}=${exp12(e)}$. Use twelfths, a common denominator, to add these fractions.`,
          `So the expression equals $${pw(e)}$.`,
        ],
      });
    }
    const { c, d, m: mm, P } = m;
    const e3 = 3 * P + mm; // exponent in thirds
    const xp = (n: number, den: number) =>
      `x^{${expTex(n, den)}}`.replace(/x\^\{1\}/, "x");
    const lab = (coef: number, num: number, den: number) =>
      `$${coef}${xp(num, den)}$`;
    return choiceSurface(rnd, {
      prompt: `Which expression is equivalent to $${c}x^{${P}}\\sqrt[3]{${d ** 3}x^{${mm}}}$, where $x>0$?`,
      options: [
        { label: lab(c * d, e3, 3), correct: true },
        {
          label: lab(c * d ** 3, e3, 3),
          feedback: `This leaves ${d ** 3} outside the cube root. The root applies to the number too: $\\sqrt[3]{${d ** 3}}=${d}$, so ${c} is multiplied by ${d}, not ${d ** 3}.`,
        },
        {
          label: lab(c * d, 3 * P + mm, 1),
          feedback: `This forgets to divide the inner exponent by 3. The cube root gives the exponent $\\frac{${mm}}{3}$, so the total is $${P}+\\frac{${mm}}{3}$, not $${P}+${mm}$.`,
        },
        {
          label: lab(c * d, P * mm, 3),
          feedback: `This multiplies the exponents. When multiplying powers of the same base, add the exponents: $${P}+\\frac{${mm}}{3}$.`,
        },
        {
          label: lab(c * d, 3 * P + mm, 9),
          feedback: `This puts $${c}x^{${P}}$ under the root too. It is outside the radical, so its exponent ${P} is not divided by 3.`,
        },
      ],
      hint: `Take the cube root of ${d ** 3} separately, and write $\\sqrt[3]{x^{${mm}}}$ as a power of $x$ with exponent $\\frac{${mm}}{3}$. Then combine the powers of $x$.`,
      explanation: [
        `A cube root, $\\sqrt[3]{\\ }$, undoes cubing. It applies to each factor under it, the number and the power of $x$.`,
        `The number: $${d}^3=${d ** 3}$, so $\\sqrt[3]{${d ** 3}}=${d}$. The power: a cube root is the power $\\frac13$, so $\\sqrt[3]{x^{${mm}}}=x^{${mm}/3}$.`,
        `So $\\sqrt[3]{${d ** 3}x^{${mm}}}=${d}x^{${mm}/3}$.`,
        `Multiply by $${c}x^{${P}}$. Multiply the coefficients, the numbers in front: $${c}\\cdot${d}=${c * d}$. Add the exponents of $x$: $${P}+\\frac{${mm}}{3}=${expTex(e3, 3)}$.`,
        `So the expression equals $${c * d}x^{${expTex(e3, 3)}}$.`,
      ],
    });
  },
});

export const regentsAlgebraTwoAlgebraTemplates = [
  nonmonicComplexQuadraticTemplate,
  inverseExponentialRootTemplate,
  circleLineSystemTemplate,
  rationalTwoDenominatorsTemplate,
  trinomialProductTemplate,
  cubicQuotientRemainderTemplate,
  powersOfISumTemplate,
  twoRadicalEquationTemplate,
  absoluteValueLinearTemplate,
  shiftedTrinomialFactorTemplate,
  rationalExponentProductTemplate,
];
export const regentsAlgebraTwoAlgebraGenerate = dispatch(
  regentsAlgebraTwoAlgebraTemplates,
  {
    "nonmonic-complex-quadratic": (s) =>
      nonmonicComplexQuadratic.generate(s).problem,
    "inverse-exponential-root": (s) =>
      inverseExponentialRoot.generate(s).problem,
    "circle-line-system": (s) => circleLineSystem.generate(s).problem,
    "rational-two-denominators": (s) =>
      rationalTwoDenominators.generate(s).problem,
    "trinomial-product": (s) => trinomialProduct.generate(s).problem,
    "cubic-quotient-remainder": (s) =>
      cubicQuotientRemainder.generate(s).problem,
    "powers-of-i-sum": (s) => powersOfISum.generate(s).problem,
    "two-radical-equation": (s) => twoRadicalEquation.generate(s).problem,
    "absolute-value-linear": (s) => absoluteValueLinear.generate(s).problem,
    "shifted-trinomial-factor": (s) =>
      shiftedTrinomialFactor.generate(s).problem,
    "rational-exponent-product": (s) =>
      rationalExponentProduct.generate(s).problem,
  },
);
