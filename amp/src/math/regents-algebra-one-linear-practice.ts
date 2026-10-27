import type { TemplateMetadata } from "./contracts";
import { defineAxis } from "./variation/axes";
import {
  chainFamily,
  choiceSurface,
  dispatch,
  numberSurface,
  pick,
} from "./chain-kit";
import { frac, linear, par, roundText } from "./regents-kit";

const meta = (
  m: Omit<TemplateMetadata, "version" | "gradeBand"> & {
    gradeBand?: string;
  },
): TemplateMetadata =>
  ({
    version: 1,
    gradeBand: "9–12",
    ...m,
  }) as TemplateMetadata;

export const decimalBothSidesTemplate = meta({
  id: "decimal-both-sides-equation",
  title:
    "Solve an equation with decimal coefficients and variables on both sides",
  skillId: "linear-equations",
  difficultyOffset: 0.35,
  requiredResponseCapability: "single-choice-v1",
  description:
    "Solve $ax+b=cx+d$ whose coefficients and constants are one-place decimals, and choose the solution among values that come from sign, operation and decimal-place slips.",
});
export const groupedBothSidesTemplate = meta({
  id: "grouped-both-sides-solve",
  title: "Distribute, collect the variable terms on one side, and solve",
  skillId: "linear-equations",
  difficultyOffset: 0.3,
  description:
    "Solve $p(x+q)+rx=sx+t$ for $x$: distribute, combine the variable terms from both sides, then isolate $x$.",
});
export const pointSlopeTwoPointsTemplate = meta({
  id: "point-slope-two-points",
  title: "Choose the point-slope equation of the line through two points",
  skillId: "linear-equation-modeling",
  difficultyOffset: 0.4,
  requiredResponseCapability: "single-choice-v1",
  description:
    "Find the slope from two points, then choose the point-slope equation that uses one of them, with sign and slope slips as the other choices.",
});
export const totalAndCostEquationTemplate = meta({
  id: "total-and-cost-equation",
  title: "Write one equation for two quantities with a known total and cost",
  skillId: "systems-modeling",
  difficultyOffset: 0.4,
  requiredResponseCapability: "single-choice-v1",
  description:
    "For two kinds of item with known prices, a known count and a known total cost, choose the one-variable equation that uses the count to express the other quantity.",
});
export const isolateTwoTermFormulaTemplate = meta({
  id: "isolate-two-term-formula",
  title: "Solve a formula with a sum of terms for one variable",
  skillId: "formula-rearrangement",
  difficultyOffset: 0.5,
  requiredResponseCapability: "single-choice-v1",
  description:
    "Solve a surface-area or trapezoid-area formula for one variable by removing the other term of the sum first and then dividing by the whole coefficient.",
});
export const substituteIntoEquationTemplate = meta({
  id: "substitute-into-equation",
  title: "Choose the equation that results from substitution",
  skillId: "linear-systems",
  difficultyOffset: 0.4,
  requiredResponseCapability: "single-choice-v1",
  description:
    "Solve one equation of a linear system for $y$ when its $y$ coefficient is $-1$, then choose the one-variable equation formed by substituting into the other equation.",
});

const signedConst = (v: string) =>
  v.startsWith("-") ? `- ${v.slice(1)}` : `+ ${v}`;

/* ------------------------------------------------ decimal both sides */
const decimalAxes = {
  order: defineAxis("order", ["variable-first", "constant-first"] as const),
};
interface DecimalModel {
  a: number;
  b: number;
  c: number;
  d: number;
  x: number;
}
function decimalModel(r: (lo: number, hi: number) => number): DecimalModel {
  const a = r(2, 9);
  let c = r(-9, 9);
  if (c === a || c === 0) c = a > 5 ? a - 3 : a + 3;
  const x = r(-8, 12) || 5;
  const b = r(-60, 60);
  if (b === 0) throw new Error("Need three retries");
  return { a, b, c, d: b + (a - c) * x, x };
}
const dec = (t: number) => roundText(t / 10, 1);
export const decimalBothSides = chainFamily({
  template: decimalBothSidesTemplate,
  axes: decimalAxes,
  model: decimalModel,
  variant: (m) => (m.x < 0 ? "negative-solution" : "positive-solution"),
  render: (m, a, r) => {
    const side = (coef: number, k: number) =>
      a.order === "variable-first"
        ? `${dec(coef)}x ${signedConst(dec(k))}`
        : `${dec(k)} ${coef < 0 ? "-" : "+"} ${dec(Math.abs(coef))}x`;
    const eq = `${side(m.a, m.b)} = ${side(m.c, m.d)}`;
    const xv = (n: number, d: number) => `$${frac(n, d)}$`;
    const dd = m.d - m.b;
    return choiceSurface(r, {
      prompt: `What is the solution of $${eq}$?`,
      label: "Choose the solution",
      options: [
        { label: xv(m.x, 1), correct: true },
        {
          label: xv(dd, m.a + m.c),
          feedback: `To collect the $x$ terms, subtract $${dec(m.c)}x$ from both sides; adding it changes the coefficient to $${dec(m.a + m.c)}$.`,
        },
        {
          label: xv(m.d + m.b, m.a - m.c),
          feedback: `Subtract the constant $${dec(m.b)}$ from both sides to move it across; adding it doubles its effect.`,
        },
        {
          label: xv(m.x, 10),
          feedback:
            "A decimal like $0.4$ is 4 tenths. Dividing by the decimal coefficient keeps its place value, so the answer is ten times larger than this.",
        },
        {
          label: xv(10 * m.x, 1),
          feedback:
            "Check the decimal places of the coefficients: the constants are written with a decimal point too, so the answer is not that large.",
        },
        {
          label: xv(-m.x, 1),
          feedback:
            "Substitute this value back into both sides: they are not equal. A sign was lost when the terms were moved.",
        },
      ],
      hint: `Collect the $x$ terms on one side first: subtract $${dec(m.c)}x$ from both sides, then move the constant $${dec(m.b)}$.`,
      explanation: [
        `Subtract $${dec(m.c)}x$ from both sides: $${dec(m.a - m.c)}x ${signedConst(dec(m.b))} = ${dec(m.d)}$.`,
        `${m.b < 0 ? "Add" : "Subtract"} $${dec(Math.abs(m.b))}$ ${m.b < 0 ? "to" : "from"} both sides: $${dec(m.a - m.c)}x = ${dec(m.d - m.b)}$.`,
        `Divide by $${dec(m.a - m.c)}$: $x = ${m.x}$.`,
        `Check: the left side is $${dec(m.a * m.x + m.b * 1)}$ and the right side is $${dec(m.c * m.x + m.d)}$.`,
      ],
    });
  },
});

/* ------------------------------------------------ grouped both sides */
const groupedAxes = {
  side: defineAxis("side", ["group-left", "group-right"] as const),
};
interface GroupedModel {
  p: number;
  q: number;
  r: number;
  s: number;
  t: number;
  x: number;
}
function groupedModel(r: (lo: number, hi: number) => number): GroupedModel {
  const p = r(2, 6);
  const q = r(-9, 9);
  const rr = r(-4, 4);
  const s = r(-4, 8);
  const x = r(-9, 9);
  const t = p * (x + q) + rr * x - s * x;
  if (!q || t === 0 || p + rr - s === 0 || p + rr === 0)
    throw new Error("Need three retries");
  return { p, q, r: rr, s, t, x };
}
const withX = (c: number) =>
  c === 0 ? "" : `${c === 1 ? "" : c === -1 ? "-" : c}x`;
export const groupedBothSides = chainFamily({
  template: groupedBothSidesTemplate,
  axes: groupedAxes,
  model: groupedModel,
  variant: (m) => (m.x < 0 ? "negative-solution" : "nonnegative-solution"),
  render: (m, a) => {
    const lhs = `${m.p}(x ${signedConst(String(m.q))})${m.r === 0 ? "" : ` ${m.r < 0 ? "-" : "+"} ${Math.abs(m.r) === 1 ? "" : Math.abs(m.r)}x`}`;
    const rhs = `${m.s === 0 ? "" : `${withX(m.s)} `}${m.s === 0 ? m.t : signedConst(String(m.t))}`;
    const [left, right] = a.side === "group-left" ? [lhs, rhs] : [rhs, lhs];
    const net = m.p + m.r - m.s;
    return numberSurface({
      prompt: `Solve for $x$: $${left} = ${right}$`,
      answer: String(m.x),
      label: "Answer",
      hint: `Distribute the ${m.p} across $(x ${signedConst(String(m.q))})$ first. Then collect every $x$ term on one side before moving the constants.`,
      explanation: [
        `Distribute and combine like terms on the side with the group: $${linear(m.p + m.r, m.p * m.q)}$. The equation is $${linear(m.p + m.r, m.p * m.q)} = ${rhs}$.`,
        m.s === 0
          ? `There is no $x$ term on the other side, so move the constant ${m.p * m.q} across: $${linear(m.p + m.r, 0)} = ${m.t - m.p * m.q}$.`
          : `Subtract $${linear(m.s, 0)}$ from both sides: $${linear(net, m.p * m.q)} = ${m.t}$. Then ${m.p * m.q < 0 ? "add" : "subtract"} ${Math.abs(m.p * m.q)} ${m.p * m.q < 0 ? "to" : "from"} both sides: $${linear(net, 0)} = ${m.t - m.p * m.q}$.`,
        `Divide by ${net}: $x = ${m.x}$.`,
      ],
    });
  },
});

/* ------------------------------------------------ point-slope */
const pointSlopeAxes = {
  slope: defineAxis("slope", ["whole", "fraction"] as const),
};
interface PointSlopeModel {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}
function pointSlopeModel(
  r: (lo: number, hi: number) => number,
  a: { slope: "whole" | "fraction" },
): PointSlopeModel {
  const x1 = r(-6, 5);
  const y1 = r(-6, 6);
  const dx = a.slope === "whole" ? r(1, 3) : r(2, 5);
  const num = a.slope === "whole" ? r(-4, 4) * dx : r(-5, 5);
  const dy = num;
  if (
    dy === 0 ||
    (a.slope === "fraction" && (dy % dx === 0 || Math.abs(dy) > 9))
  )
    throw new Error("Need three retries");
  if (y1 * dx === dy * x1) throw new Error("Need three retries");
  return { x1, y1, x2: x1 + dx, y2: y1 + dy };
}
const shift = (v: string, k: number) =>
  k === 0 ? v : `${v} ${k > 0 ? "-" : "+"} ${Math.abs(k)}`;
const slopeTex = (n: number, d: number) => {
  const f = frac(n, d);
  return f === "1" ? "" : f === "-1" ? "-" : f.startsWith("-") ? f : f;
};
export const pointSlopeTwoPoints = chainFamily({
  template: pointSlopeTwoPointsTemplate,
  axes: pointSlopeAxes,
  model: pointSlopeModel,
  variant: (m) =>
    (m.y2 - m.y1) / (m.x2 - m.x1) < 0 ? "negative-slope" : "positive-slope",
  render: (m, _a, r) => {
    const dx = m.x2 - m.x1;
    const dy = m.y2 - m.y1;
    const eq = (n: number, d: number, x: number, y: number) => {
      const s = slopeTex(n, d);
      const inner = shift("x", x);
      const body =
        s === "" ? inner : s === "-" ? `-(${inner})` : `${s}(${inner})`;
      return `$${shift("y", y)} = ${body}$`;
    };
    return choiceSurface(r, {
      prompt: `A line passes through the points $(${m.x1}, ${m.y1})$ and $(${m.x2}, ${m.y2})$. Which equation is an equation of this line?`,
      label: "Choose the equation",
      options: [
        { label: eq(dy, dx, m.x1, m.y1), correct: true },
        {
          label: eq(dy, dx, -m.x1, -m.y1),
          feedback: `The point-slope form uses $y-y_1$ and $x-x_1$. For the point $(${m.x1}, ${m.y1})$ the subtracted numbers are ${m.y1} and ${m.x1}, not their opposites.`,
        },
        {
          label: eq(dx, dy, m.x1, m.y1),
          feedback:
            "The slope is the change in $y$ over the change in $x$. This equation uses the reciprocal, change in $x$ over change in $y$.",
        },
        {
          label: eq(-dy, dx, m.x1, m.y1),
          feedback:
            "Subtract the coordinates in the same order for $y$ and for $x$. Reversing only one subtraction changes the sign of the slope.",
        },
        {
          label: eq(dy, dx, m.x2, m.y1),
          feedback:
            "The $x$ and $y$ in a point-slope equation must come from the same point. This one mixes the two points.",
        },
      ],
      hint: `Find the slope first: the change in $y$ from $${m.y1}$ to $${m.y2}$ over the change in $x$ from $${m.x1}$ to $${m.x2}$. Then pair one point's $x$ and $y$ in $y-y_1=m(x-x_1)$.`,
      explanation: [
        `Slope: $m=\\frac{${m.y2}-${par(m.y1)}}{${m.x2}-${par(m.x1)}}=${frac(dy, dx)}$.`,
        `Use the point $(${m.x1}, ${m.y1})$ in $y-y_1=m(x-x_1)$.`,
        `The equation is ${eq(dy, dx, m.x1, m.y1)}. Either given point can be used; the other point gives an equivalent equation.`,
      ],
    });
  },
});

/* ------------------------------------------------ total and cost */
const totalAxes = {
  unknown: defineAxis("unknown", ["costlier-item", "cheaper-item"] as const),
};
const stories = [
  {
    place: "A school play sells",
    hi: "adult tickets",
    lo: "student tickets",
    unit: "tickets",
    pay: "collects",
  },
  {
    place: "A cafe sells",
    hi: "large drinks",
    lo: "small drinks",
    unit: "drinks",
    pay: "takes in",
  },
  {
    place: "A bookstore sells",
    hi: "hardcover books",
    lo: "paperback books",
    unit: "books",
    pay: "takes in",
  },
  {
    place: "A food truck sells",
    hi: "dinner plates",
    lo: "lunch plates",
    unit: "plates",
    pay: "collects",
  },
] as const;
interface TotalModel {
  story: number;
  hiPrice: number;
  loPrice: number;
  count: number;
  hiCount: number;
}
function totalModel(r: (lo: number, hi: number) => number): TotalModel {
  const loPrice = r(3, 9);
  const hiPrice = loPrice + r(2, 6);
  const count = r(20, 60);
  return {
    story: r(0, stories.length - 1),
    hiPrice,
    loPrice,
    count,
    hiCount: r(Math.ceil(count / 4), Math.floor((3 * count) / 4)),
  };
}
function totalModelChecked(r: (lo: number, hi: number) => number): TotalModel {
  const m = totalModel(r);
  if (2 * m.hiCount === m.count) throw new Error("Need three retries");
  return m;
}
export const totalAndCostEquation = chainFamily({
  template: totalAndCostEquationTemplate,
  axes: totalAxes,
  model: totalModelChecked,
  variant: (m) => `story-${m.story}`,
  render: (m, a, r) => {
    const s = stories[m.story]!;
    const total = m.hiPrice * m.hiCount + m.loPrice * (m.count - m.hiCount);
    const hiUnknown = a.unknown === "costlier-item";
    const [P, Q] = hiUnknown ? [m.hiPrice, m.loPrice] : [m.loPrice, m.hiPrice];
    const name = hiUnknown ? s.hi : s.lo;
    const other = hiUnknown ? s.lo : s.hi;
    const v = "n";
    const eqs = (p: number, q: number, rhs: number) =>
      `$${p}${v} + ${q}(${m.count} - ${v}) = ${rhs}$`;
    return choiceSurface(r, {
      prompt: `${s.place} ${name} for $${P}$ dollars each and ${other} for $${Q}$ dollars each. In one day it sells ${m.count} ${s.unit} and ${s.pay} $${total}$ dollars. Let $n$ be the number of ${name} sold. Which equation can be used to find $n$?`,
      label: "Choose the equation",
      options: [
        { label: eqs(P, Q, total), correct: true },
        {
          label: `$${P}${v} + ${Q}${v} = ${total}$`,
          feedback: `The ${other} are not $n$ of them. Their number is the total, ${m.count}, minus $n$.`,
        },
        {
          label: eqs(Q, P, total),
          feedback: `Match each price with its own count: $n$ ${name} cost $${P}$ dollars each, so $${P}n$ is their cost.`,
        },
        {
          label: `$${P}${v} + ${Q}(${m.count}) = ${total}$`,
          feedback: `The ${other} number ${m.count} minus $n$, not all ${m.count}. Using ${m.count} counts the ${name} twice.`,
        },
        {
          label: `$${P}${v} + ${Q}(${m.count} - ${v}) = ${m.count}$`,
          feedback: `The right side should be the money taken in, $${total}$ dollars, not the number of ${s.unit}.`,
        },
      ],
      hint: `If $n$ of the ${m.count} ${s.unit} are ${name}, how many are ${other}? Write each group's money as price times count, then set the sum equal to $${total}$.`,
      explanation: [
        `The ${name} number $n$, so the ${other} number $${m.count}-n$.`,
        `The ${name} bring in $${P}n$ dollars and the ${other} bring in $${Q}(${m.count}-n)$ dollars.`,
        `Together they bring in $${total}$ dollars: $${P}n + ${Q}(${m.count}-n) = ${total}$.`,
      ],
    });
  },
});

/* ------------------------------------------------ isolate two-term */
const isolateAxes = {
  formula: defineAxis("formula", [
    "cylinder",
    "cone",
    "square-prism",
    "trapezoid",
  ] as const),
};
export const isolateTwoTermFormula = chainFamily({
  template: isolateTwoTermFormulaTemplate,
  axes: isolateAxes,
  model: (_r, a) => ({ formula: a.formula }),
  variant: (m) => m.formula,
  render: (m, _a, r) => {
    if (m.formula === "cylinder") {
      const good = "\\frac{S - 2\\pi r^2}{2\\pi r}";
      const bad: Array<[string, string]> = [
        [
          "\\frac{S}{2\\pi r} - 2\\pi r^2",
          "Dividing only $S$ by the coefficient leaves $2\\pi r^2$ undivided. Subtract the term first, then divide the whole difference.",
        ],
        [
          "S - 2\\pi r^2 - 2\\pi r",
          "The term $2\\pi r h$ is a product. Undo the multiplication by dividing by $2\\pi r$; subtracting it does not isolate $h$.",
        ],
        [
          "\\frac{S + 2\\pi r^2}{2\\pi r}",
          "Subtract $2\\pi r^2$ from both sides. Adding it moves the term the wrong way.",
        ],
        [
          "\\frac{S - 2\\pi r^2}{2\\pi}",
          "The term $2\\pi rh$ has the factor $r$ as well, so divide by $2\\pi r$, not just $2\\pi$.",
        ],
      ];
      return choiceSurface(r, {
        prompt:
          "The surface area of a cylinder with radius $r$ and height $h$ is $S = 2\\pi r^2 + 2\\pi r h$. Which expression gives $h$ in terms of $S$ and $r$?",
        label: "Choose the expression",
        options: [
          { label: `$h = ${good}$`, correct: true },
          ...bad.map(([e, f]) => ({ label: `$h = ${e}$`, feedback: f })),
        ],
        hint: "The height appears only in the term $2\\pi r h$. Subtract the term $2\\pi r^2$, which has no $h$, from both sides before you divide.",
        explanation: [
          "Subtract $2\\pi r^2$ from both sides: $S - 2\\pi r^2 = 2\\pi r h$.",
          "Divide both sides by $2\\pi r$: $h = \\frac{S - 2\\pi r^2}{2\\pi r}$.",
        ],
      });
    }
    if (m.formula === "cone") {
      const bad: Array<[string, string]> = [
        [
          "\\frac{A}{\\pi r} - \\pi r^2",
          "Dividing only $A$ by $\\pi r$ leaves $\\pi r^2$ undivided. Subtract the base area first, then divide the whole difference.",
        ],
        [
          "\\frac{A - \\pi r^2}{\\pi}",
          "The term $\\pi r s$ has the factor $r$ as well, so divide by $\\pi r$, not just $\\pi$.",
        ],
        [
          "\\frac{A + \\pi r^2}{\\pi r}",
          "Subtract $\\pi r^2$ from both sides. Adding it moves the term the wrong way.",
        ],
        [
          "A - \\pi r^2 - \\pi r",
          "The term $\\pi r s$ is a product. Undo the multiplication by dividing by $\\pi r$; subtracting it does not isolate $s$.",
        ],
      ];
      return choiceSurface(r, {
        prompt:
          "The total surface area of a cone with radius $r$ and slant height $s$ is $A = \\pi r^2 + \\pi r s$. Which expression gives $s$ in terms of $A$ and $r$?",
        label: "Choose the expression",
        options: [
          { label: "$s = \\frac{A - \\pi r^2}{\\pi r}$", correct: true },
          ...bad.map(([e, f]) => ({ label: `$s = ${e}$`, feedback: f })),
        ],
        hint: "The slant height appears only in the term $\\pi r s$ of $A = \\pi r^2 + \\pi r s$. Subtract the term without $s$ from both sides, then divide by what multiplies $s$.",
        explanation: [
          "Subtract $\\pi r^2$ from both sides: $A - \\pi r^2 = \\pi r s$.",
          "Divide both sides by $\\pi r$: $s = \\frac{A - \\pi r^2}{\\pi r}$.",
        ],
      });
    }
    if (m.formula === "square-prism") {
      const bad: Array<[string, string]> = [
        [
          "\\frac{S}{4b} - 2b^2",
          "Dividing only $S$ by $4b$ leaves $2b^2$ undivided. Subtract the term first, then divide the whole difference.",
        ],
        [
          "\\frac{S - 2b^2}{4}",
          "Both $b$ and 4 multiply $h$ in $4bh$, so divide by $4b$.",
        ],
        [
          "\\frac{S + 2b^2}{4b}",
          "Subtract $2b^2$ from both sides. Adding it moves the term the wrong way.",
        ],
        [
          "\\frac{S - 2b}{4b}",
          "The two square bases have area $2b^2$, not $2b$.",
        ],
      ];
      return choiceSurface(r, {
        prompt:
          "A rectangular prism has a square base with side $b$ and height $h$. Its surface area is $S = 2b^2 + 4bh$. Which expression gives $h$ in terms of $S$ and $b$?",
        label: "Choose the expression",
        options: [
          { label: "$h = \\frac{S - 2b^2}{4b}$", correct: true },
          ...bad.map(([e, f]) => ({ label: `$h = ${e}$`, feedback: f })),
        ],
        hint: "In $S = 2b^2 + 4bh$ only the term $4bh$ contains $h$. Subtract the term $2b^2$ from both sides first, then divide by what multiplies $h$.",
        explanation: [
          "Subtract $2b^2$ from both sides: $S - 2b^2 = 4bh$.",
          "Divide both sides by $4b$: $h = \\frac{S - 2b^2}{4b}$.",
        ],
      });
    }
    const bad: Array<[string, string]> = [
      [
        "\\frac{2A}{h} + b_2",
        "Subtract $b_2$ from $\\frac{2A}{h}$. Adding it moves the term the wrong way.",
      ],
      [
        "\\frac{A}{h} - b_2",
        "The formula has a factor of $\\frac12$, so multiply by 2 before dividing by $h$: the factor 2 belongs with $A$.",
      ],
      [
        "\\frac{2A - b_2}{h}",
        "Here $b_2$ is divided by $h$ as well. Divide $2A$ by $h$ first and then subtract $b_2$.",
      ],
      [
        "2Ah - b_2",
        "Multiply both sides by 2 and divide by $h$; do not multiply by $h$.",
      ],
    ];
    return choiceSurface(r, {
      prompt:
        "The area of a trapezoid with bases $b_1$ and $b_2$ and height $h$ is $A = \\frac12 (b_1 + b_2) h$. Which expression gives $b_1$ in terms of $A$, $b_2$ and $h$?",
      label: "Choose the expression",
      options: [
        { label: "$b_1 = \\frac{2A}{h} - b_2$", correct: true },
        ...bad.map(([e, f]) => ({ label: `$b_1 = ${e}$`, feedback: f })),
      ],
      hint: "The sum $b_1 + b_2$ is multiplied by $\\frac{1}{2}h$ in $A = \\frac{1}{2}(b_1 + b_2)h$. Undo that multiplication by clearing the $\\frac{1}{2}$ and dividing by $h$, then subtract $b_2$.",
      explanation: [
        "Multiply both sides by 2: $2A = (b_1 + b_2)h$.",
        "Divide both sides by $h$: $\\frac{2A}{h} = b_1 + b_2$.",
        "Subtract $b_2$: $b_1 = \\frac{2A}{h} - b_2$.",
      ],
    });
  },
});

/* ------------------------------------------------ substitute */
const substituteAxes = {
  mix: defineAxis("mix", ["negative-constant", "positive-constant"] as const),
};
interface SubstituteModel {
  a: number;
  b: number;
  e: number;
  u: number;
  w: number;
}
function substituteModel(
  r: (lo: number, hi: number) => number,
  ax: { mix: "negative-constant" | "positive-constant" },
): SubstituteModel {
  const w = r(1, 9) * (ax.mix === "negative-constant" ? 1 : -1);
  return {
    a: r(1, 5),
    b: r(2, 6),
    e: r(5, 30),
    u: pick(r, [2, 3, 4, 5] as const),
    w,
  };
}
export const substituteIntoEquation = chainFamily({
  template: substituteIntoEquationTemplate,
  axes: substituteAxes,
  model: substituteModel,
  variant: (m) => (m.w > 0 ? "y-equals-ux-minus-w" : "y-equals-ux-plus-w"),
  render: (m, _a, r) => {
    // Second equation: u x - y = w  =>  y = u x - w.
    const second = `${m.u}x - y = ${m.w}`;
    const first = `${m.a === 1 ? "" : m.a}x + ${m.b}y = ${m.e}`;
    const sub = (inner: string) =>
      `${m.a === 1 ? "" : m.a}x + ${m.b}(${inner}) = ${m.e}`;
    const y = linear(m.u, -m.w);
    const flipped = linear(m.u, m.w);
    return choiceSurface(r, {
      prompt: `A system is given by $${first}$ and $${second}$. Which equation results from solving the second equation for $y$ and substituting into the first?`,
      label: "Choose the equation",
      options: [
        { label: `$${sub(y)}$`, correct: true },
        {
          label: `$${sub(flipped)}$`,
          feedback: `Solving $${second}$ for $y$ gives $y=${y}$. Moving $y$ to the right side changes every sign, so the sign of $${m.w}$ must change as well.`,
        },
        {
          label: `$${m.a === 1 ? "" : m.a}x + ${m.b}(${m.u}x) ${m.w > 0 ? "-" : "+"} ${Math.abs(m.w)} = ${m.e}$`,
          feedback: `The expression for $y$ is substituted as a group, so $${m.b}$ multiplies both of its terms, including the constant.`,
        },
        {
          label: `$${m.a === 1 ? "" : m.a}(${y}) + ${m.b}y = ${m.e}$`,
          feedback:
            "Substitute for $y$, not for $x$. The expression found in the second equation equals $y$.",
        },
        {
          label: `$${sub(linear(-m.u, m.w))}$`,
          feedback: `Solving $${second}$ for $y$ gives $${m.u}x$ with the constant moved across, not $-${m.u}x$: only the sign of the constant changes.`,
        },
      ],
      hint: `In $${second}$ the $y$ term is $-y$. Move $${m.u}x$ or $y$ so that $y$ is alone on one side, watching every sign, then place that expression in for $y$ in $${first}$.`,
      explanation: [
        `From $${second}$, add $y$ and subtract $${m.w}$: $y=${y}$.`,
        `Replace $y$ in $${first}$ with $(${y})$: $${sub(y)}$.`,
      ],
    });
  },
});

export const regentsAlgebraOneLinearTemplates = [
  decimalBothSidesTemplate,
  groupedBothSidesTemplate,
  pointSlopeTwoPointsTemplate,
  totalAndCostEquationTemplate,
  isolateTwoTermFormulaTemplate,
  substituteIntoEquationTemplate,
];
export const regentsAlgebraOneLinearGenerate = dispatch(
  regentsAlgebraOneLinearTemplates,
  {
    "decimal-both-sides-equation": (s) => decimalBothSides.generate(s).problem,
    "grouped-both-sides-solve": (s) => groupedBothSides.generate(s).problem,
    "point-slope-two-points": (s) => pointSlopeTwoPoints.generate(s).problem,
    "total-and-cost-equation": (s) => totalAndCostEquation.generate(s).problem,
    "isolate-two-term-formula": (s) =>
      isolateTwoTermFormula.generate(s).problem,
    "substitute-into-equation": (s) =>
      substituteIntoEquation.generate(s).problem,
  },
);
