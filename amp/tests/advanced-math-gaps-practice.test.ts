import test from "node:test";
import assert from "node:assert/strict";
import {
  advancedMathGapCase,
  advancedMathGapTemplates,
} from "../src/math/advanced-math-gaps-practice";
import { generateProblem, templates } from "../src/math/engine";
import { problemLesson } from "../src/content/problem-lessons";

const variants: Record<string, string[]> = {
  "series-recursion": [
    "series-listed",
    "series-story",
    "series-sigma",
    "recursive-to-explicit",
    "explicit-to-recursive",
    "table-term",
    "recursion-term",
  ],
  "compound-growth": [
    "periodic",
    "continuous",
    "period-factor",
    "annual-rate",
    "read-formula",
  ],
  "polynomial-factoring-patterns": [
    "cubes",
    "gcf-cubes",
    "grouping",
    "grouping-complete",
    "quadratic-form",
    "quadratic-form-irreducible",
    "fourth-power-difference",
  ],
  "residual-function-fit": [
    "residual-u",
    "residual-cap",
    "residual-random",
    "table-type",
    "residual-compute",
    "residual-meaning",
  ],
  "function-graph-features": [
    "exp-asymptote-range",
    "exp-y-intercept",
    "exp-graph-statement",
    "exp-end-behavior",
    "log-domain-asymptote",
    "log-graph-domain",
    "log-graph-intercept",
  ],
};
const skills: Record<string, string> = {
  "series-recursion": "arithmetic-sequences",
  "compound-growth": "exponential-models",
  "polynomial-factoring-patterns": "factor-quadratics",
  "residual-function-fit": "regression-interpretation",
  "function-graph-features": "logarithms",
};

for (const id of Object.keys(variants)) {
  test(`${id}: deterministic, every variant reachable, one correct distinct choice`, () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 400; seed++) {
      const a = advancedMathGapCase(id, `s${seed}`);
      const b = advancedMathGapCase(id, `s${seed}`);
      assert.deepEqual(a.problem, b.problem);
      const via = generateProblem(id, `s${seed}`);
      assert.equal(via.public.templateId, a.problem.public.templateId);
      assert.deepEqual(via.public.response, a.problem.public.response);
      assert.equal(via.answer, a.problem.answer);
      seen.add(a.variant);
      const response = a.problem.public.response;
      assert.equal(response.kind, "choice");
      if (response.kind !== "choice") continue;
      const labels = response.options.map((o) => o.label);
      assert.equal(response.options.length, 4);
      assert.equal(new Set(labels).size, 4, `${a.variant}: ${labels}`);
      assert.equal(labels.filter((l) => l === a.correctLabel).length, 1);
      const correct = response.options.find((o) => o.label === a.correctLabel)!;
      assert.equal(a.problem.answer, correct.id);
      const feedback = a.problem.choiceFeedback ?? {};
      for (const option of response.options) {
        if (option.id !== correct.id)
          assert.ok(feedback[option.id]?.length, `${a.variant}: feedback`);
      }
      const visible = a.problem.public.prompt + a.problem.hint;
      assert.ok(!visible.includes(a.correctLabel), `${a.variant}: leaks label`);
      assert.ok(a.problem.explanation.length >= 2);
      assert.ok(a.problem.hint.length > 20);
    }
    assert.deepEqual([...seen].sort(), [...variants[id]!].sort());
  });
}

test("templates are registered against existing skills", () => {
  for (const t of advancedMathGapTemplates) {
    const registered = templates.find((x) => x.id === t.id);
    assert.equal(registered?.skillId, skills[t.id]);
    const lesson = problemLesson(t.id, "library");
    assert.ok(lesson.method.length >= 3);
    assert.ok(lesson.watch);
    assert.ok(lesson.principle);
    assert.ok(lesson.example.steps.length >= 3);
  }
});

test("series sums, compound balances and factorizations match independent arithmetic", () => {
  let sums = 0,
    balances = 0,
    products = 0;
  for (let seed = 0; seed < 400; seed++) {
    const s = advancedMathGapCase("series-recursion", `o${seed}`);
    const m =
      /sum of the first (\d+) terms of the arithmetic series \$(-?\d+)\+\((-?\d+)\)/.exec(
        s.problem.public.prompt,
      );
    if (m) {
      const n = Number(m[1]),
        a = Number(m[2]),
        d = Number(m[3]) - a;
      let total = 0;
      for (let k = 0; k < n; k++) total += a + k * d;
      assert.equal(s.correctLabel, `$${total}$`);
      sums++;
    }
    const c = advancedMathGapCase("compound-growth", `o${seed}`);
    const q =
      /^([\d,]+) dollars is deposited at (\d+)% annual interest, compounded (annually|semiannually|quarterly|monthly)/.exec(
        c.problem.public.prompt,
      );
    const t = /after (\d+) years/.exec(c.problem.public.prompt);
    if (q && t && c.variant === "periodic") {
      const n = { annually: 1, semiannually: 2, quarterly: 4, monthly: 12 }[
        q[3] as "annually"
      ];
      let balance = Number(q[1]!.replace(",", ""));
      for (let k = 0; k < n * Number(t[1]); k++)
        balance *= 1 + Number(q[2]) / 100 / n;
      assert.equal(
        c.correctLabel,
        `${Math.round(balance).toLocaleString("en-US")} dollars`,
      );
      balances++;
    }
    const f = advancedMathGapCase("polynomial-factoring-patterns", `o${seed}`);
    if (f.variant === "quadratic-form") {
      // x^4 - (m^2+n^2)x^2 + m^2 n^2: the listed roots must each vanish.
      const e = /\$(?:x\^\{4\})([^$]*)\$/.exec(f.problem.public.prompt)!;
      const coefficients = /-(\d+)x\^\{2\}\+(\d+)/.exec(e[1]!)!;
      const roots = [...f.correctLabel.matchAll(/\(x([+-])(\d+)\)/g)].map(
        (g) => (g[1] === "+" ? -1 : 1) * Number(g[2]),
      );
      assert.equal(roots.length, 4);
      for (const x of roots)
        assert.equal(
          x ** 4 - Number(coefficients[1]) * x ** 2 + Number(coefficients[2]),
          0,
        );
      products++;
    }
  }
  assert.ok(sums > 20 && balances > 20 && products > 20);
});
