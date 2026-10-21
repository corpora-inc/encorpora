import type { TemplateMetadata, GeneratedProblem } from "./contracts";
import {
  assemble,
  constText,
  linearText,
  n,
  pick,
  p,
  rat,
  seeded,
  termText,
} from "./algebra-one-kit";
import { f, graph } from "./scene/author";

/** A short thread from reading shared points to substitution and counting roots. */
export const nonlinearSystemTemplates: readonly TemplateMetadata[] = [
  {
    id: "nonlinear-system-read",
    title: "Read a line and parabola intersection",
    description:
      "Read the smaller or larger intersection coordinate from a graph and its equations.",
    difficultyOffset: -0.5,
    requiredFigureCapability: "scenes-v1",
  },
  {
    id: "nonlinear-system-solve",
    title: "Solve a line and parabola system",
    description:
      "Substitute a line into a quadratic and recover a requested coordinate from two distinct integer intersections.",
    difficultyOffset: 0,
  },
  {
    id: "nonlinear-system-count",
    title: "Count line and parabola intersections",
    description:
      "Use the discriminant to count zero, one or two real solutions, including irrational intersections.",
    difficultyOffset: 0.5,
  },
].map((t) => ({
  ...t,
  skillId:
    t.id === "nonlinear-system-read"
      ? "nonlinear-intersection-reading"
      : t.id === "nonlinear-system-count"
        ? "nonlinear-intersection-count"
        : "nonlinear-systems",
  version: 1,
  gradeBand: "9–12",
})) as readonly TemplateMetadata[];

export function nonlinearSystemCase(id: string, seed: string) {
  const meta = nonlinearSystemTemplates.find((t) => t.id === id);
  if (!meta) throw new Error("Unknown nonlinear-system template");
  if (typeof seed !== "string" || seed.length < 1 || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const r = seeded(id, seed);
  const reading = id === "nonlinear-system-read",
    counting = id === "nonlinear-system-count";
  const a = reading ? 1 : pick(r, [-2, -1, 1, 2]);
  const m = reading ? pick(r, [-1, 0, 1]) : r(-3, 3),
    b = r(-4, 4);
  const left = r(-3, 1),
    right = left + r(1, 4);
  // Quadratic minus line = a(x-left)(x-right), or a((x-h)^2 + k).
  const h = r(-3, 3),
    k = pick(r, [-4, -2, -1, 0, 1, 2, 4]);
  const c = counting ? m - 2 * a * h : m - a * (left + right);
  const d = counting ? b + a * (h * h + k) : b + a * left * right;
  const quadratic = `${termText(a, "x^2")}${termText(c, "x", false)}${constText(d)}`;
  const line = linearText(m, b);
  const small = r(0, 1) === 0;
  const coordinate = !reading && r(0, 1) === 1 ? "y" : "x";
  const selected = small ? left : right;
  const count = k < 0 ? 2 : k === 0 ? 1 : 0;
  const answer = counting
    ? count
    : coordinate === "x"
      ? selected
      : m * selected + b;
  const prompt = `The system is $y = ${quadratic}$ and $y = ${line}$. ${counting ? "How many distinct real ordered-pair solutions does the system have?" : `What is the $${coordinate}$-coordinate of the intersection with the ${small ? "smaller" : "larger"} $x$-coordinate?`}`;
  const B = c - m,
    C = d - b,
    discriminant = B * B - 4 * a * C;
  const reduced = `${termText(a, "x^2")}${termText(B, "x", false)}${constText(C)}`;
  const explanation = counting
    ? [
        `At a shared point both expressions equal $y$, so $${quadratic} = ${line}$. Subtract the line's expression to obtain $${reduced} = 0$.`,
        `For $Ax^2 + Bx + C = 0$, the discriminant is $B^2 - 4AC$. Here it is $${p(B)}^2 - 4 \\cdot ${p(a)} \\cdot ${p(C)} = ${n(discriminant)}$.`,
        `${discriminant > 0 ? "A positive discriminant gives two distinct real roots" : discriminant === 0 ? "A zero discriminant gives one repeated real root" : "A negative discriminant gives no real roots"}. Each real $x$ gives exactly one $y$ on the line, so the system has ${count} distinct real solutions.`,
      ]
    : [
        `At an intersection the two values of $y$ agree: $${quadratic} = ${line}$. Subtract to get $${reduced} = 0$.`,
        `Factor: $${a === 1 ? "" : n(a)}(x${constText(-left)})(x${constText(-right)}) = 0$. A product is zero only when a factor is zero, so $x = ${n(left)}$ or $x = ${n(right)}$.`,
        `Substitute each into $y = ${line}$: the shared points are $\\left(${n(left)}, ${n(m * left + b)}\\right)$ and $\\left(${n(right)}, ${n(m * right + b)}\\right)$. The requested coordinate is ${n(answer)}.`,
      ];
  if (reading)
    explanation.unshift(
      `On the graph, find the shared points $\\left(${n(left)}, ${n(m * left + b)}\\right)$ and $\\left(${n(right)}, ${n(m * right + b)}\\right)$. Choose the ${small ? "left" : "right"} crossing for the ${small ? "smaller" : "larger"} horizontal coordinate. The algebra below checks these readings.`,
    );
  const scene = reading
    ? graph({ id: "g", x: [-5, 7], y: [-12, 12], grid: [1, 2], tick: [1, 2] })
        .curve(f.poly(a, c, d), { color: "accent" })
        .curve(f.poly(m, b), { color: "warm", dash: "dash" })
        .scene({
          title: `The solid parabola y = ${quadratic} and dashed line y = ${line}. Read their shared points.`,
        })
    : undefined;
  return assemble(
    meta,
    seed,
    {
      prompt,
      answer: rat(answer),
      explanation,
      scene,
      hint: counting
        ? `Set $${quadratic}$ equal to $${line}$, then move all terms to one side before counting real roots.`
        : reading
          ? `Follow the dashed line $y = ${line}$ to where it meets the parabola $y = ${quadratic}$; compare the horizontal positions of those crossings.`
          : `Replace $y$ in the quadratic by $${line}$, using the line's equation, then collect the terms of $${quadratic}$ on one side.`,
      tags: [
        counting ? `count-${count}` : small ? "smaller" : "larger",
        coordinate,
        `a-${a}`,
      ],
    },
    r,
    counting ? "Number of solutions" : `${coordinate}-coordinate`,
  );
}
export function generateNonlinearSystemProblem(
  id: string,
  seed: string,
): GeneratedProblem {
  return nonlinearSystemCase(id, seed).problem;
}
