import { test } from "node:test";
import assert from "node:assert/strict";
import { sweep, variantsOf } from "./fixtures/algebra-kit-checks";
import {
  add,
  eq,
  mul,
  parseQ,
  parseSlopeIntercept,
  parseStandard,
  q,
  sub,
  type Q,
} from "./fixtures/kit-rational";

type Problem = ReturnType<typeof sweep>[number];
const options = (p: Problem) => {
  const r = p.public.response;
  if (r.kind !== "choice") throw new Error("choice expected");
  return r.options;
};
const mathSpans = (s: string) =>
  [...s.matchAll(/\$([^$]+)\$/g)].map((m) => m[1]!);

/** Rank-based count of solutions of two equations ax + by = c. */
function solutions(
  p: { a: number; b: number; c: number },
  s: { a: number; b: number; c: number },
): "none" | "one" | "infinite" {
  const coef = p.a * s.b - s.a * p.b;
  if (coef !== 0) return "one";
  // Rank of the augmented matrix equals the rank of the coefficient matrix.
  const minors = [p.a * s.c - s.a * p.c, p.b * s.c - s.b * p.c];
  return minors.every((v) => v === 0) ? "infinite" : "none";
}
/** Substitution check, independent of the rank method: look for a common point. */
function shareAPoint(
  p: { a: number; b: number; c: number },
  s: { a: number; b: number; c: number },
): boolean {
  for (let x = -60; x <= 60; x++)
    for (let y = -60; y <= 60; y++)
      if (p.a * x + p.b * y === p.c && s.a * x + s.b * y === s.c) return true;
  return false;
}

function firstEquation(p: Problem) {
  const span = mathSpans(p.public.prompt)[0]!;
  if (span.startsWith("y ")) {
    const { m, k } = parseSlopeIntercept(span);
    // y = m x + k  ->  -m x + y = k, scaled to integers
    const d = m[1] * k[1];
    return { a: -m[0] * (d / m[1]), b: d, c: k[0] * (d / k[1]) };
  }
  return parseStandard(span);
}

test("system-second-equation: the keyed equation is the only one with the asked count", () => {
  const problems = sweep("system-second-equation");
  for (const p of problems) {
    const first = firstEquation(p);
    const goal = p.variant!.id.replace(/-(standard|slope-intercept)$/, "");
    const fits = (s: ReturnType<typeof parseStandard>) => {
      const kind = solutions(first, s);
      return goal === "no-solution"
        ? kind === "none"
        : goal === "infinitely-many"
          ? kind === "infinite"
          : goal === "exactly-one"
            ? kind === "one"
            : kind !== "none";
    };
    const keyed = options(p).filter((o) => fits(parseStandard(o.label)));
    assert.equal(keyed.length, 1, `${p.public.seed} ${goal}`);
    assert.equal(keyed[0]!.id, p.answer, `${p.public.seed} ${goal}`);
    // A second method: brute-force search for a shared lattice point.
    for (const o of options(p)) {
      const s = parseStandard(o.label);
      const kind = solutions(first, s);
      if (kind === "none") assert.equal(shareAPoint(first, s), false);
    }
  }
});

test("system-second-equation: every goal and given form is reachable", () => {
  const seen = variantsOf(sweep("system-second-equation"));
  for (const goal of [
    "no-solution",
    "infinitely-many",
    "exactly-one",
    "at-least-one",
  ])
    for (const form of ["standard", "slope-intercept"])
      assert.ok(seen.has(`${goal}-${form}`), `${goal}-${form}`);
});

test("parallel-line-intercept: the keyed line is parallel and passes through the stated point", () => {
  const problems = sweep("parallel-line-intercept");
  for (const p of problems) {
    const spans = mathSpans(p.public.prompt);
    const given = spans.find((s) => s.includes("="))!;
    const slope: Q = given.startsWith("y ")
      ? parseSlopeIntercept(given).m
      : (() => {
          const s = parseStandard(given);
          return q(-s.a, s.b);
        })();
    const variant = p.variant!.id;
    let through: [Q, Q];
    if (variant.endsWith("other-line")) {
      const other = parseStandard(spans.filter((s) => s.includes("="))[1]!);
      through = [q(0), q(other.c, other.b)];
    } else {
      const point = spans.find((s) => /^\(/.test(s))!;
      const [x, y] = point
        .slice(1, -1)
        .split(",")
        .map((v) => parseQ(v));
      through = [x!, y!];
    }
    const keyed = options(p).filter((o) => {
      const { m, k } = parseSlopeIntercept(o.label);
      return eq(m, slope) && eq(add(mul(m, through[0]), k), through[1]);
    });
    assert.equal(keyed.length, 1, p.public.seed);
    assert.equal(keyed[0]!.id, p.answer, p.public.seed);
  }
});

test("parallel-line-intercept: every given form and anchor is reachable", () => {
  const seen = variantsOf(sweep("parallel-line-intercept"));
  for (const form of ["standard", "slope-intercept"])
    for (const anchor of ["y-intercept", "x-intercept", "other-line"])
      assert.ok(seen.has(`${form}-${anchor}`), `${form}-${anchor}`);
});

function tableOf(p: Problem): { xs: Q[]; ys: Q[] } {
  const fig = JSON.parse(JSON.stringify(p.public.figure));
  const rows: string[][] = fig.scene.elements[0].rows;
  return {
    xs: rows[0]!.slice(1).map(parseQ),
    ys: rows[1]!.slice(1).map(parseQ),
  };
}

test("table-standard-form: the keyed equation holds in every column and no other choice does", () => {
  const problems = sweep("table-standard-form");
  for (const p of problems) {
    const { xs, ys } = tableOf(p);
    assert.equal(xs.length, 4);
    const variant = p.variant!.id;
    const shift = (() => {
      const m = p.public.prompt.match(/f\(x\) ([+−]) (\d+)\$/);
      return m ? (m[1] === "−" ? -1 : 1) * Number(m[2]) : 0;
    })();
    const holds = (label: string) => {
      if (variant.endsWith("standard-form")) {
        const s = parseStandard(label);
        return xs.every((x, i) =>
          eq(add(mul(q(s.a), x), mul(q(s.b), ys[i]!)), q(s.c)),
        );
      }
      const { m, k } = parseSlopeIntercept(label);
      return xs.every((x, i) => eq(add(mul(m, x), k), add(ys[i]!, q(shift))));
    };
    const keyed = options(p).filter((o) => holds(o.label));
    assert.equal(keyed.length, 1, p.public.seed);
    assert.equal(keyed[0]!.id, p.answer, p.public.seed);
    if (variant.endsWith("standard-form")) {
      const s = parseStandard(options(p).find((o) => o.id === p.answer)!.label);
      assert.ok(s.a > 0, "positive leading coefficient");
      const g = (a: number, b: number): number =>
        b ? g(b, a % b) : Math.abs(a);
      assert.equal(g(g(s.a, s.b), s.c), 1, "lowest terms");
    }
    // Inputs are unevenly spaced or fractions, as the variant says.
    const gaps = xs.slice(1).map((x, i) => sub(x, xs[i]!).join("/"));
    if (variant.startsWith("uneven-steps"))
      assert.ok(new Set(gaps).size > 1, p.public.seed);
    else
      assert.ok(
        xs.some((x) => x[1] === 2),
        p.public.seed,
      );
  }
});

test("table-standard-form: every inputs and ask value is reachable", () => {
  const seen = variantsOf(sweep("table-standard-form"));
  for (const inputs of ["uneven-steps", "fractions"])
    for (const ask of ["standard-form", "shifted-rule"])
      assert.ok(seen.has(`${inputs}-${ask}`), `${inputs}-${ask}`);
});
