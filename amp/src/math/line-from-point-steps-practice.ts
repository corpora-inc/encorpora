import type { TemplateMetadata } from "./contracts";
import { chainFamily, dispatch, gcd, pick } from "./chain-kit";
import { workModeAxisNoOrder } from "./structured-work-kit";
import { rowsWork, workSurface, type RowSpec } from "./structured-work-rows";
import { defineAxis } from "./variation/axes";

/**
 * Write the equation of a line in slope-intercept form from its slope and a
 * point, or from two points, as labeled written work: the slope, the product
 * of the slope and the point's x-coordinate, the y-intercept, and the typed
 * equation. Each step is graded exactly on the server; the equation is
 * graded as the same relation, so y must stand alone.
 */

const capability = "structured-work-v1" as const;
export const lineFromPointTemplates: readonly TemplateMetadata[] = [
  {
    id: "line-from-point-steps",
    version: 1,
    title: "Show the work: write a line from a point",
    skillId: "linear-models",
    gradeBand: "6–8",
    difficultyOffset: 0.3,
    requiredResponseCapability: capability,
    description:
      "Write the equation $y=mx+b$ of a line from a fractional slope and a point, or from two points, entering the slope, the product of the slope and $x$, the $y$-intercept and the typed equation.",
  },
];

interface Model {
  given: "slope-and-point" | "two-points";
  p: number; // slope numerator
  q: number; // slope denominator, at least 2
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  b: number;
}

const frac = (p: number, q: number) =>
  `${p < 0 ? "-" : ""}\\frac{${Math.abs(p)}}{${q}}`;
const signed = (n: number) => (n < 0 ? `-${-n}` : `+${n}`);

const family = chainFamily({
  template: lineFromPointTemplates[0]!,
  axes: {
    mode: workModeAxisNoOrder,
    given: defineAxis("given", ["slope-and-point", "two-points"] as const),
  },
  model: (r, axes): Model => {
    const q = r(2, 5);
    const p = pick(r, [-7, -5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 7]);
    if (gcd(Math.abs(p), q) !== 1) throw new Error("Need three retry");
    const k = pick(r, [-4, -3, -2, -1, 1, 2, 3, 4]);
    const x1 = q * k;
    const y1 = r(-8, 8);
    const b = y1 - p * k;
    if (b === 0 || Math.abs(b) > 14) throw new Error("Need three retry");
    // The second point is a whole number of runs of q away.
    const t = pick(r, [-3, -2, 2, 3]);
    return {
      given: axes.given,
      p,
      q,
      x1,
      y1,
      x2: x1 + q * t,
      y2: y1 + p * t,
      b,
    };
  },
  render: (m, axes, r) => {
    const { p, q, x1, y1, b } = m;
    const slopeTerm = `${p === 1 ? "" : p === -1 ? "-" : p}x/${q}`;
    const equation = `y=${slopeTerm}${b < 0 ? b : `+${b}`}`;
    const product = (p * x1) / q;
    const rows: RowSpec[] = [];
    if (m.given === "two-points")
      rows.push({
        label: "Slope of the line",
        fields: [
          {
            caption: "Number",
            kind: "number",
            value: `${p}/${q}`,
            maxLength: 8,
          },
        ],
      });
    rows.push(
      {
        label: `Slope times the $x$-coordinate of $(${x1},${y1})$`,
        fields: [{ caption: "Number", kind: "number", value: `${product}` }],
      },
      {
        label: "The $y$-intercept $b$",
        fields: [{ caption: "Number", kind: "number", value: `${b}` }],
      },
      {
        label: "Equation of the line in slope-intercept form",
        fields: [
          {
            caption: "Equation",
            kind: "expression",
            value: equation,
            match: "sides",
            relations: true,
            variables: ["x", "y"],
            maxLength: 20,
          },
        ],
      },
    );
    const built = rowsWork(rows, axes.mode, r, "Your work");
    const task =
      axes.mode === "build"
        ? "Enter each step."
        : "Some steps are filled in. Enter the others.";
    const prompt =
      m.given === "slope-and-point"
        ? `A line has slope $${frac(p, q)}$ and passes through the point $(${x1},${y1})$. Write its equation in slope-intercept form, $y=mx+b$. ${task}`
        : `A line passes through the points $(${x1},${y1})$ and $(${m.x2},${m.y2})$. Write its equation in slope-intercept form, $y=mx+b$. ${task}`;
    const tail = `Put in $y=${y1}$: $${y1}=${product}+b$. Undo the adding to get $b$ alone: $b=${y1}${product < 0 ? "+" : "-"}${Math.abs(product)}=${b}$. So the equation of the line is $y=${frac(p, q)}x${signed(b)}$.`;
    return workSurface(built, {
      prompt,
      hint:
        m.given === "slope-and-point"
          ? `Write $y=${frac(p, q)}x+b$. The point $(${x1},${y1})$ is on the line, so $x=${x1}$ and $y=${y1}$ make the equation true. Solve for $b$.`
          : `Slope is rise over run: the change in $y$ from $${y1}$ to $${m.y2}$ over the change in $x$ from $${x1}$ to $${m.x2}$. Then use one of the points to find $b$.`,
      explanation: [
        `In $y=mx+b$, $m$ is the slope (how steep the line is: the change in $y$ for each 1 step in $x$) and $b$ is where the line crosses the $y$-axis.`,
        ...(m.given === "two-points"
          ? [
              `Slope is the change in $y$ divided by the change in $x$ between the two points: $\\frac{${m.y2}-${y1 < 0 ? `(${y1})` : y1}}{${m.x2}-${x1 < 0 ? `(${x1})` : x1}}=\\frac{${m.y2 - y1}}{${m.x2 - x1}}=${frac(p, q)}$.`,
            ]
          : []),
        `The point $(${x1},${y1})$ is on the line, so its numbers make $y=mx+b$ true. Multiply the slope by its $x$: $${frac(p, q)}\\cdot${x1 < 0 ? `(${x1})` : x1}=${product}$.`,
        tail,
      ],
    });
  },
  variant: (m) => m.given,
});

export const lineFromPointGenerate = dispatch(lineFromPointTemplates, {
  "line-from-point-steps": (seed) => family.generate(seed).problem,
});
export const lineFromPointCases = {
  "line-from-point-steps": family.generate,
};
