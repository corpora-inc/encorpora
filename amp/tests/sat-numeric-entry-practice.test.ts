import test from "node:test";
import assert from "node:assert/strict";
import {
  satNumericEntryCase,
  satNumericEntryTemplates,
} from "../src/math/sat-numeric-entry-practice";
import {
  generateProblem,
  gradeAnswer,
  isValidResponse,
  templates,
} from "../src/math/engine";
import { problemLesson } from "../src/content/problem-lessons";
import { buildSatCoverage } from "../src/curriculum/sat-coverage";

const skills: Record<string, string> = {
  "sat-entry-system-solve": "linear-systems",
  "sat-entry-system-expression": "linear-systems",
  "sat-entry-quadratic-solution": "quadratic-equations",
  "sat-entry-root-relations": "quadratic-equations",
  "sat-entry-absolute-equation": "absolute-value-equations",
  "sat-entry-radical-equation": "radical-equations",
  "sat-entry-rational-equation": "rational-equations",
  "sat-entry-polynomial-zeros": "polynomial-zeros",
  "sat-entry-quadratic-context": "nonlinear-equation-modeling",
  "sat-entry-rate-numeric": "linear-equation-modeling",
  "sat-entry-radian-conversion": "radians-unit-circle",
  "sat-entry-inequality-integer": "linear-inequalities",
};
const variants: Record<string, string[]> = {
  "sat-entry-system-solve": ["integer-", "signed-", "fractional-", "zero-"],
  "sat-entry-system-expression": ["sum", "difference", "multiples", "half-sum"],
  "sat-entry-quadratic-solution": [
    "monic-greater",
    "nonmonic-positive",
    "rearranged-greater",
    "single-solution",
  ],
  "sat-entry-root-relations": [
    "sum",
    "product",
    "reciprocal-sum",
    "sum-of-squares",
  ],
  "sat-entry-absolute-equation": [
    "greater-solution",
    "sum-of-solutions",
    "reject-extraneous",
    "equal-distances",
  ],
  "sat-entry-radical-equation": [
    "reject-extraneous",
    "sum-both-valid",
    "isolate-root",
    "zero-right-side",
  ],
  "sat-entry-rational-equation": [
    "reject-excluded",
    "cross-multiply",
    "sum-both-valid",
  ],
  "sat-entry-polynomial-zeros": [
    "least-zero",
    "sum-distinct-repeated",
    "fractional-positive",
    "no-real-zero-factor",
  ],
  "sat-entry-quadratic-context": [
    "time-at-maximum",
    "maximum-height",
    "landing-time",
    "maximum-from-ground",
  ],
  "sat-entry-rate-numeric": [
    "combined-integer",
    "combined-decimal",
    "fill-and-drain",
    "two-phase",
    "mixture",
  ],
  "sat-entry-radian-conversion": [
    "degrees-to-radians",
    "radians-to-degrees",
    "negative-angle",
    "beyond-full-turn",
  ],
  "sat-entry-inequality-integer": [
    "greatest-integer",
    "strict-boundary",
    "negative-coefficient-least",
    "count-positive-integers",
  ],
};
const num = (s: string) => {
  const [n, d] = s.split("/");
  return Number(n) / Number(d ?? 1);
};
const close = (a: number, b: number, tol = 1e-9) =>
  assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} vs ${b}`);
const nums = (s: string) => String(s).split(",").map(num);
const quadRoots = (a: number, b: number, c: number) => {
  const d = Math.sqrt(b * b - 4 * a * c);
  return [(-b - d) / (2 * a), (-b + d) / (2 * a)];
};

/** Independent check from the private givens: substitution, brute force or float simulation. */
function verify(id: string, c: ReturnType<typeof satNumericEntryCase>) {
  const d = c.data as Record<string, number | string>;
  const n = (k: string) => Number(d[k]);
  const ans = num(c.problem.answer);
  switch (id) {
    case "sat-entry-system-solve": {
      const [a1, b1, c1, a2, b2, c2] = ["a1", "b1", "c1", "a2", "b2", "c2"].map(
        n,
      ) as number[];
      // Solve the first equation for the other variable, then test the second equation.
      let x: number, y: number;
      if (d.ask === "x") {
        x = ans;
        y = (c1 - a1 * x) / b1;
      } else {
        y = ans;
        x = (c1 - b1 * y) / a1;
      }
      close(a2! * x + b2! * y, c2!);
      break;
    }
    case "sat-entry-system-expression": {
      const [a, b, cc, dd, e, f] = ["a", "b", "c", "d", "e", "f"].map(
        n,
      ) as number[];
      const det = a! * e! - b! * dd!;
      const x = (cc! * e! - b! * f!) / det;
      const y = (a! * f! - cc! * dd!) / det;
      close(n("p") * x + n("s") * y, ans);
      break;
    }
    case "sat-entry-quadratic-solution": {
      const [a, b, cc] = nums(String(d.coeffs)) as [number, number, number];
      const roots = quadRoots(a, b, cc);
      const pick =
        d.ask === "greater"
          ? Math.max(...roots)
          : d.ask === "positive"
            ? roots.find((r) => r > 0)!
            : roots[0]!;
      if (d.ask === "only") close(roots[0]!, roots[1]!, 1e-6);
      close(ans, pick, 1e-9);
      break;
    }
    case "sat-entry-root-relations": {
      const [p, q] = quadRoots(n("a"), n("b"), n("c")) as [number, number];
      assert.notEqual(p, q);
      const value = {
        sum: p + q,
        product: p * q,
        "reciprocal-sum": 1 / p + 1 / q,
        "sum-of-squares": p * p + q * q,
      }[String(d.ask)]!;
      close(ans, value, 1e-9);
      break;
    }
    case "sat-entry-absolute-equation": {
      const kind = d.kind;
      if (kind === "distance") {
        const sols = [n("h") - n("k"), n("h") + n("k")];
        close(ans, Math.max(...sols));
      } else if (kind === "sum") {
        const sols = [(n("k") - n("s")) / n("p"), (-n("k") - n("s")) / n("p")];
        for (const s of sols) close(Math.abs(n("p") * s + n("s")), n("k"));
        close(ans, sols[0]! + sols[1]!);
      } else if (kind === "extraneous") {
        // Scan a fine rational grid for exact-equality solutions of the original equation.
        const hits: number[] = [];
        for (let k = -4000; k <= 4000; k++) {
          const x = k / 60;
          if (Math.abs(Math.abs(x - n("h")) - (n("m") * x + n("k"))) < 1e-9)
            hits.push(x);
        }
        assert.equal(hits.length, 1);
        close(ans, hits[0]!, 1e-9);
      } else {
        const x = ans;
        close(Math.abs(x - n("h")), Math.abs(x - n("t")));
        assert.notEqual(n("h"), n("t"));
      }
      break;
    }
    case "sat-entry-radical-equation": {
      if (d.kind === "isolate") {
        close(n("k") * Math.sqrt(ans + n("a")), n("n"));
        break;
      }
      const roots = quadRoots(1, 2 * n("c") - n("a"), n("c") * n("c") - n("b"));
      const valid = roots.filter(
        (x) => Math.abs(Math.sqrt(n("a") * x + n("b")) - (x + n("c"))) < 1e-9,
      );
      if (d.ask === "sum") {
        assert.equal(valid.length, 2);
        close(ans, valid[0]! + valid[1]!);
      } else {
        assert.equal(valid.length, 1);
        close(ans, valid[0]!);
      }
      break;
    }
    case "sat-entry-rational-equation": {
      if (d.kind === "cross") {
        const x = ans;
        assert.notEqual(x, n("s"));
        assert.notEqual(x, n("t"));
        close((x + n("a")) / (x - n("s")), (x + n("b")) / (x - n("t")));
      } else {
        const valid = [n("r1"), n("r2")].filter((x) => x !== n("s"));
        close(
          ans,
          valid.reduce((s, x) => s + x, 0),
        );
        assert.equal(valid.length, d.kind === "excluded" ? 1 : 2);
      }
      break;
    }
    case "sat-entry-polynomial-zeros": {
      const zeros = nums(String(d.zeros));
      const pick =
        d.ask === "least"
          ? Math.min(...zeros)
          : d.ask === "positive"
            ? zeros.find((z) => z > 0)!
            : zeros.reduce((s, z) => s + z, 0);
      close(ans, pick);
      break;
    }
    case "sat-entry-quadratic-context": {
      const h = (t: number) => -n("a") * t * t + n("b") * t + n("c");
      if (d.kind === "landing") {
        let lo = 0;
        let hi = 100;
        for (let i = 0; i < 200; i++) {
          const mid = (lo + hi) / 2;
          if (h(mid) > 0) lo = mid;
          else hi = mid;
        }
        close(ans, lo, 1e-9);
      } else {
        // Ternary search for the maximum of a concave function.
        let lo = 0;
        let hi = 60;
        for (let i = 0; i < 300; i++) {
          const m1 = lo + (hi - lo) / 3;
          const m2 = hi - (hi - lo) / 3;
          if (h(m1) < h(m2)) lo = m1;
          else hi = m2;
        }
        const bestT = (lo + hi) / 2;
        const best = h(bestT);
        if (d.ask === "time") assert.ok(Math.abs(bestT - ans) <= 1e-6);
        else close(ans, best, 1e-6);
      }
      break;
    }
    case "sat-entry-rate-numeric": {
      if (d.kind === "combined") close(ans / n("a") + ans / n("b"), 1);
      else if (d.kind === "fill-drain") close(ans / n("a") - ans / n("b"), 1);
      else if (d.kind === "two-phase")
        close(
          n("p") * Math.min(ans, n("t1")) +
            n("rate2") * Math.max(0, ans - n("t1")),
          n("total"),
        );
      else
        close(n("A") * n("p1") + ans * n("p2"), n("pt") * (n("A") + ans), 1e-9);
      break;
    }
    case "sat-entry-radian-conversion": {
      if (d.kind === "to-radians") close(ans * 180, n("deg"));
      else close(ans, (n("n") / n("d")) * 180);
      break;
    }
    case "sat-entry-inequality-integer": {
      const lhs = (x: number) =>
        d.kind === "least" ? -n("a") * x + n("b") : n("a") * x + n("b");
      const ok = (x: number) =>
        d.kind === "strict" || d.kind === "least"
          ? lhs(x) < n("c")
          : lhs(x) <= n("c");
      const range = Array.from({ length: 801 }, (_, i) => i - 400);
      const sat = range.filter(ok);
      if (d.kind === "greatest" || d.kind === "strict")
        assert.equal(Math.max(...sat), ans);
      else if (d.kind === "least") assert.equal(Math.min(...sat), ans);
      else assert.equal(sat.filter((x) => x > 0).length, ans);
      break;
    }
    default:
      assert.fail(id);
  }
}

for (const template of satNumericEntryTemplates) {
  const id = template.id;
  test(`${id}: independent answers, grading, reachability and hint safety`, () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 400; seed++) {
      const s = `oracle:${seed}`;
      const c = satNumericEntryCase(id, s);
      const generated = generateProblem(id, s);
      assert.deepEqual(generated.public, c.problem.public);
      assert.equal(generated.answer, c.problem.answer);
      assert.deepEqual(satNumericEntryCase(id, s).problem, c.problem);
      assert.equal(generated.public.response.kind, "fraction");
      assert.ok(!generated.public.prompt.includes("undefined"));
      assert.ok(!generated.public.prompt.includes("NaN"));
      for (const text of [...generated.explanation, generated.hint])
        assert.ok(!/NaN|undefined|--|\+ -/.test(text), text);
      verify(id, c);
      seen.add(c.variant);
      // Exact grading: equivalent forms pass, near misses fail.
      assert.ok(gradeAnswer(generated, generated.answer));
      const value = num(generated.answer);
      assert.ok(!gradeAnswer(generated, String(value + 1)));
      assert.ok(isValidResponse(generated.public, generated.answer));
      if (Number.isInteger(value)) {
        assert.ok(gradeAnswer(generated, `${value}.0`));
        assert.ok(gradeAnswer(generated, `${value * 2}/2`));
      } else {
        const [n, dd] = generated.answer.split("/").map(Number) as [
          number,
          number,
        ];
        assert.ok(gradeAnswer(generated, `${n * 3}/${dd * 3}`));
        const decimal = (n / dd).toString();
        if (
          Math.abs(Number(decimal) - n / dd) === 0 &&
          decimal.length < 12 &&
          !/e/.test(decimal)
        )
          if (
            BigInt(dd) &&
            [2, 4, 5, 8, 10, 16, 20, 25, 32, 40, 50, 100].includes(dd)
          )
            assert.ok(gradeAnswer(generated, decimal));
      }
      assert.ok(generated.explanation.length >= 2);
      // The hint teaches a first step; it never states the final answer sentence.
      assert.ok(generated.hint !== generated.explanation.at(-1));
      if (c.answer[1] !== 1) {
        const [n, dd] = c.answer;
        assert.ok(
          !generated.hint.includes(
            `=${n < 0 ? "-" : ""}\\frac{${Math.abs(n)}}{${dd}}`,
          ),
        );
      }
    }
    const expected = variants[id]!;
    for (const v of expected)
      assert.ok(
        [...seen].some((s) => s === v || s.startsWith(v)),
        `${id} missing ${v}; saw ${[...seen].join(",")}`,
      );
  });

  test(`${id}: skill, instruction and SAT binding`, () => {
    const registered = templates.find((t) => t.id === id);
    assert.equal(registered?.skillId, skills[id]);
    assert.equal(registered?.requiredResponseCapability, undefined);
    const lesson = problemLesson(id, "library");
    assert.ok((lesson.intuition ?? "").length > 40);
    assert.ok(lesson.method.length >= 3);
    assert.ok(lesson.watch);
    assert.ok(lesson.principle);
    assert.ok(lesson.example.steps.length >= 2);
    const coverage = buildSatCoverage();
    assert.ok(coverage.tasks.some((task) => task.templateIds.includes(id)));
  });
}

test("SAT coverage with numeric-entry families stays valid", () => {
  assert.deepEqual(buildSatCoverage().errors, []);
});

test("numeric entry covers negative, fractional and zero answers", () => {
  const kinds = new Set<string>();
  for (const template of satNumericEntryTemplates)
    for (let seed = 0; seed < 400; seed++) {
      const answer = generateProblem(template.id, `kinds:${seed}`).answer;
      if (answer.startsWith("-")) kinds.add("negative");
      if (answer.includes("/")) kinds.add("fraction");
      if (answer === "0") kinds.add("zero");
    }
  assert.deepEqual([...kinds].sort(), ["fraction", "negative", "zero"]);
});
