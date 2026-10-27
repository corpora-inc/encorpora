import test from "node:test";
import assert from "node:assert/strict";
import { checkTemplate } from "./fixtures/regents-check";
import { generateProblem } from "../src/math/engine";
import {
  decimalBothSides,
  groupedBothSides,
  totalAndCostEquation,
} from "../src/math/regents-algebra-one-linear-practice";

const labelOf = (p: ReturnType<typeof generateProblem>, id: string) => {
  const r = p.public.response;
  assert.equal(r.kind, "choice");
  return r.kind === "choice" ? r.options.find((o) => o.id === id)!.label : "";
};
const optionsOf = (p: ReturnType<typeof generateProblem>) =>
  p.public.response.kind === "choice" ? p.public.response.options : [];

test("decimal both sides: model balances and key matches", () => {
  checkTemplate("decimal-both-sides-equation", {
    variants: ["negative-solution", "positive-solution"],
    axes: { order: ["variable-first", "constant-first"] },
  });
  for (let i = 0; i < 200; i++) {
    const { model: m, problem } = decimalBothSides.generate(`d:${i}`);
    assert.equal(m.a * m.x + m.b, m.c * m.x + m.d);
    assert.equal(labelOf(problem, problem.answer), `$${m.x}$`);
  }
});
test("grouped both sides: model balances", () => {
  checkTemplate("grouped-both-sides-solve", {
    variants: ["negative-solution", "nonnegative-solution"],
    axes: { side: ["group-left", "group-right"] },
  });
  for (let i = 0; i < 200; i++) {
    const { model: m, problem } = groupedBothSides.generate(`g:${i}`);
    assert.equal(m.p * (m.x + m.q) + m.r * m.x, m.s * m.x + m.t);
    assert.equal(problem.answer, String(m.x));
  }
});

/** Parse "$y - 3 = -\\frac{2}{3}(x + 1)$" and test whether a point lies on it. */
function onLine(label: string, x: number, y: number) {
  const [lhs, rhs] = label.replaceAll("$", "").split(" = ");
  const ly = lhs!.match(/^y(?: ([+-]) (\d+))?$/)!;
  const y1 = ly[1] ? (ly[1] === "-" ? Number(ly[2]) : -Number(ly[2])) : 0;
  const m = rhs!.match(
    /^(-?)(\\frac\{(\d+)\}\{(\d+)\}|\d+)?(?:\((x(?: [+-] \d+)?)\)|(x(?: [+-] \d+)?))$/,
  );
  assert.ok(m, `parse ${label}`);
  const inner = (m[5] ?? m[6])!.match(/^x(?: ([+-]) (\d+))?$/)!;
  const x1 = inner[1]
    ? inner[1] === "-"
      ? Number(inner[2])
      : -Number(inner[2])
    : 0;
  const mag = m[3] ? Number(m[3]) / Number(m[4]) : m[2] ? Number(m[2]) : 1;
  const slope = (m[1] ? -1 : 1) * mag;
  return Math.abs(y - y1 - slope * (x - x1)) < 1e-9;
}
test("point-slope: only the key passes through both points", () => {
  checkTemplate("point-slope-two-points", {
    variants: ["negative-slope", "positive-slope"],
    axes: { slope: ["whole", "fraction"] },
  });
  for (let i = 0; i < 300; i++) {
    const p = generateProblem("point-slope-two-points", `ps:${i}`);
    const pts = [...p.public.prompt.matchAll(/\((-?\d+), (-?\d+)\)/g)].map(
      (m) => [Number(m[1]), Number(m[2])] as const,
    );
    assert.equal(pts.length, 2);
    for (const o of optionsOf(p)) {
      const both = pts.every(([x, y]) => onLine(o.label, x, y));
      assert.equal(both, o.id === p.answer, `${p.public.prompt} ${o.label}`);
    }
  }
});

test("total and cost: only the key holds at the true count", () => {
  checkTemplate("total-and-cost-equation", {
    variants: ["story-0", "story-1", "story-2", "story-3"],
    axes: { unknown: ["costlier-item", "cheaper-item"] },
  });
  for (let i = 0; i < 300; i++) {
    const { model: m, axes, problem } = totalAndCostEquation.generate(`t:${i}`);
    const n =
      axes.unknown === "costlier-item" ? m.hiCount : m.count - m.hiCount;
    const holds = (label: string) => {
      const [l, rr] = label.replaceAll("$", "").split(" = ");
      const js = l!.replace(/(\d+)n/g, "($1*n)").replace(/(\d+)\(/g, "$1*(");
      return new Function("n", `return ${js};`)(n) === Number(rr);
    };
    for (const o of optionsOf(problem))
      assert.equal(holds(o.label), o.id === problem.answer, o.label);
  }
});

test("isolate two-term formula: keys", () => {
  checkTemplate("isolate-two-term-formula", {
    variants: ["cylinder", "cone", "square-prism", "trapezoid"],
    hintsMin: 4,
  });
  const keys: Record<string, string> = {};
  for (let i = 0; i < 100; i++) {
    const p = generateProblem("isolate-two-term-formula", `iso:${i}`);
    keys[p.variant!.id] = labelOf(p, p.answer);
  }
  assert.deepEqual(keys, {
    cylinder: "$h = \\frac{S - 2\\pi r^2}{2\\pi r}$",
    cone: "$s = \\frac{A - \\pi r^2}{\\pi r}$",
    "square-prism": "$h = \\frac{S - 2b^2}{4b}$",
    trapezoid: "$b_1 = \\frac{2A}{h} - b_2$",
  });
});

test("substitute: key is the sign-corrected substitution", () => {
  checkTemplate("substitute-into-equation", {
    variants: ["y-equals-ux-minus-w", "y-equals-ux-plus-w"],
    axes: { mix: ["negative-constant", "positive-constant"] },
  });
  for (let i = 0; i < 300; i++) {
    const p = generateProblem("substitute-into-equation", `s:${i}`);
    const [, a, b, e, u, w] = p.public.prompt
      .match(/\$(\d*)x \+ (\d+)y = (\d+)\$ and \$(\d+)x - y = (-?\d+)\$/)!
      .map(Number) as number[];
    const A = a || 1;
    // y = u x - w; first equation becomes A x + b (u x - w) = e
    const key = labelOf(p, p.answer);
    const [lhs] = key.replaceAll("$", "").split(" = ");
    for (const x of [-2, 0, 3]) {
      const y = u! * x - w!;
      const js = lhs!
        .replace(/(\d+)x/g, "($1*x)")
        .replace(/(^|[^\d*])x/g, "$1(x)")
        .replace(/(\d+)\(/g, "$1*(");
      const value = new Function("x", `return ${js};`)(x);
      assert.equal(value, A * x + b! * y, `${key} at ${x}`);
    }
    assert.equal(Number(key.replaceAll("$", "").split(" = ")[1]), e);
  }
});
