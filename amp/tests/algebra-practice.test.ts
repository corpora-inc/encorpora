import assert from "node:assert/strict";
import test from "node:test";
import { algebraDefinitions } from "../src/content/algebra-definitions.js";
import {
  algebraRequirements,
  validateAlgebraCoverage,
} from "../src/content/algebra-coverage.js";
import {
  algebraTemplates,
  generateAlgebraProblem,
} from "../src/math/algebra-practice.js";
import {
  generateProblem,
  polishProblem,
  templates,
} from "../src/math/engine.js";
import { generatedProblemSchema } from "../src/math/contracts.js";
import { lessons } from "../src/content/lessons.js";
test("sixteen algebra families have exact teaching pages, bounded scope and reference instruction", () => {
  assert.equal(algebraDefinitions.length, 16);
  validateAlgebraCoverage();
  for (const d of algebraDefinitions) {
    assert.equal(templates.filter((t) => t.id === d.id).length, 1);
    assert.equal(lessons.filter((l) => l.templateIds.includes(d.id)).length, 1);
    assert.ok(
      algebraRequirements.some(
        (r) =>
          r.templateIds.includes(d.id) && r.remainingRequirements.length > 100,
      ),
    );
    assert.deepEqual(
      generateProblem(d.id, "dispatch"),
      polishProblem(generateAlgebraProblem(d.id, "dispatch")),
    );
  }
});
test("8192 algebra instances preserve exact fractions, deterministic choices and meaningful boundary cases", () => {
  const edges = new Set<string>();
  for (const t of algebraTemplates) {
    const positions = new Set<string>();
    for (let i = 0; i < 512; i++) {
      const p = generateAlgebraProblem(t.id, `boundary-${i}`);
      generatedProblemSchema.parse(p);
      assert.deepEqual(p, generateAlgebraProblem(t.id, `boundary-${i}`));
      assert.ok(p.public.prompt.length <= 205, `${t.id} prompt too long`);
      assert.ok(p.hint.length > 30 && p.explanation.length >= 2);
      assert.ok(!("answer" in p.public) && !("choiceFeedback" in p.public));
      const response = p.public.response;
      if (response.kind === "choice") {
        assert.equal(t.requiredResponseCapability, "single-choice-v1");
        assert.equal(
          new Set(response.options.map((o) => o.label)).size,
          response.options.length,
        );
        assert.equal(
          response.options.filter((o) => o.id === p.answer).length,
          1,
        );
        assert.equal(
          Object.keys(p.choiceFeedback!).length,
          response.options.length - 1,
        );
        positions.add(p.answer);
      } else {
        assert.equal(t.requiredResponseCapability, undefined);
        assert.match(p.answer, /^-?\d+(?:\/[1-9]\d*)?$/);
        if (p.answer.includes("/")) edges.add(`${t.id}.fraction`);
        if (p.answer.startsWith("-")) edges.add(`${t.id}.negative`);
        if (p.answer === "0") edges.add(`${t.id}.zero`);
      }
      if (t.id === "first-cheaper-whole-input") {
        const numbers = p.public.prompt.match(/\d+/g)!.map(Number),
          [fee, low, high] = numbers as [number, number, number];
        const x = Number(p.answer);
        assert.ok(Number.isInteger(x) && x > 0 && x <= 24);
        assert.ok(fee + low * x < high * x);
        assert.ok(fee + low * (x - 1) >= high * (x - 1));
        edges.add(
          fee % (high - low) === 0 ? "threshold.tie" : "threshold.fraction",
        );
        if (fee < high - low) edges.add("threshold.subunit");
      }
      if (t.id === "relation-function-choice") {
        const chosen =
          response.kind === "choice"
            ? response.options.find((o) => o.id === p.answer)!.label
            : "";
        const pairs = [...chosen.matchAll(/\((-?\d+), (-?\d+)\)/g)].map((m) => [
          m[1],
          m[2],
        ]);
        if (new Set(pairs.map((p) => p.join(","))).size < pairs.length)
          edges.add("function.duplicate");
        if (
          new Set(pairs.map((p) => p[0])).size === 3 &&
          new Set(pairs.map((p) => p[1])).size === 1
        )
          edges.add("function.shared-output");
      }
    }
    if (t.requiredResponseCapability)
      assert.equal(positions.size, 3, `${t.id} answer position bias`);
  }
  for (const edge of [
    "grouped-linear-equation.fraction",
    "negative-coefficient-equation.negative",
    "rational-coefficient-equation.fraction",
    "both-sides-linear-equation.zero",
    "combine-like-coefficient.zero",
    "unequal-step-rate.negative",
    "predict-linear-output.fraction",
    "threshold.tie",
    "threshold.fraction",
    "threshold.subunit",
    "function.duplicate",
    "function.shared-output",
  ])
    assert.ok(edges.has(edge), edge);
  assert.throws(() => generateAlgebraProblem("missing", "seed"));
  assert.throws(() => generateAlgebraProblem("grouped-linear-equation", ""));
  assert.throws(() =>
    generateAlgebraProblem("grouped-linear-equation", "x".repeat(129)),
  );
});
