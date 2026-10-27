import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  generateProblem,
  gradeAnswer,
  templates,
  type GeneratedProblem,
} from "../src/math/engine";
import { generatedProblemSchema } from "../src/math/contracts";
import {
  exactDecimal,
  nearestRoot,
  sweepAxes,
  withLegacySurfaces,
  type SweepId,
} from "../src/math/number-domain-axes";

/** Digests of the pre-axis output (before this change), seeds legacy:0..299,
 * over canonical JSON (sorted keys, floats to 9 decimals) and without the private `variant`. */
const golden = JSON.parse(
  readFileSync(
    new URL("./fixtures/number-domain-sweep-digests.json", import.meta.url),
    "utf8",
  ),
) as Record<string, string[]>;

const canonical = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(canonical)
    : value && typeof value === "object"
      ? Object.fromEntries(
          Object.entries(value as Record<string, unknown>)
            .sort(([a], [b]) => (a < b ? -1 : 1))
            .map(([k, v]) => [k, canonical(v)]),
        )
      : typeof value === "number" && !Number.isInteger(value)
        ? // Trigonometric coordinates differ in the last bits between
          // platforms' math libraries; the digest compares 9 decimals.
          Number(value.toFixed(9))
        : value;
const digest = (problem: GeneratedProblem) => {
  const { variant, ...rest } = problem;
  void variant;
  return createHash("sha256")
    .update(JSON.stringify(canonical(rest)))
    .digest("hex")
    .slice(0, 16);
};
const ids = Object.keys(sweepAxes) as SweepId[];
const isLegacy = (id: SweepId, axes: Record<string, string>) =>
  Object.entries(sweepAxes[id]).every(
    ([key, axis]) => axes[key] === axis.legacy,
  );
const seeds = (n: number, prefix: string) =>
  Array.from({ length: n }, (_, i) => `${prefix}:${i}`);

test("the sweep covers exactly the frozen families", () => {
  assert.deepEqual(Object.keys(golden).sort(), [...ids].sort());
});

test("legacy axis values reproduce the pre-axis output exactly", () => {
  for (const id of ids) {
    let legacy = 0;
    golden[id]!.forEach((expected, i) => {
      const problem = generateProblem(id, `legacy:${i}`);
      const axes = problem.variant?.axes;
      assert.ok(axes, `${id} legacy:${i} records its axis values`);
      assert.deepEqual(
        Object.keys(axes).sort(),
        Object.keys(sweepAxes[id]).sort(),
      );
      if (!isLegacy(id, axes)) return;
      legacy++;
      assert.equal(digest(problem), expected, `${id} legacy:${i}`);
    });
    assert.ok(legacy >= 30, `${id} reaches its legacy surface (${legacy})`);
  }
});

test("printed editions build on legacy surfaces for every seed", () => {
  withLegacySurfaces(() => {
    for (const id of ids)
      golden[id]!.forEach((expected, i) => {
        const problem = generateProblem(id, `legacy:${i}`);
        assert.ok(isLegacy(id, problem.variant!.axes!), `${id} legacy:${i}`);
        assert.equal(digest(problem), expected, `${id} legacy:${i}`);
      });
  });
});

test("every axis value is reachable and every instance is valid, deterministic and gradable", () => {
  for (const id of ids) {
    const reached: Record<string, Set<string>> = {};
    for (const seed of seeds(400, "reach")) {
      const problem = generateProblem(id, seed);
      generatedProblemSchema.parse(problem);
      assert.deepEqual(problem, generateProblem(id, seed), `${id} ${seed}`);
      const axes = problem.variant!.axes!;
      for (const [key, value] of Object.entries(axes))
        (reached[key] ??= new Set()).add(value);
      const response = problem.public.response;
      if (response.kind === "choice") {
        const labels = response.options.map((o) => o.label);
        assert.equal(new Set(labels).size, labels.length, `${id} ${seed}`);
        assert.ok(response.options.some((o) => o.id === problem.answer));
        assert.equal(
          Object.keys(problem.choiceFeedback ?? {}).length,
          labels.length - 1,
          `${id} ${seed} one corrective feedback per wrong choice`,
        );
        const correct = response.options.find((o) => o.id === problem.answer)!;
        assert.ok(
          correct.label.length < 3 || !problem.hint.includes(correct.label),
          `${id} ${seed} hint names the answer`,
        );
        for (const option of response.options)
          assert.equal(
            gradeAnswer(problem, option.id),
            option.id === problem.answer,
          );
      } else {
        assert.ok(gradeAnswer(problem, problem.answer), `${id} ${seed}`);
        // A hint may repeat a given that equals the answer, never reveal it.
        // One- and two-digit answers collide with step counts and givens by
        // chance; the independent oracle reads the hint's meaning for those.
        const named = new RegExp(
          `(?<![\\d.])${problem.answer.replace(".", "\\.")}(?![\\d]|\\.\\d)`,
        );
        assert.ok(
          problem.answer.length < 3 ||
            !named.test(problem.hint) ||
            named.test(problem.public.prompt),
          `${id} ${seed} hint names the answer ${problem.answer}: ${problem.hint}`,
        );
      }
      assert.ok(problem.explanation.length >= 2, `${id} ${seed}`);
    }
    for (const [key, axis] of Object.entries(sweepAxes[id]))
      assert.deepEqual(
        [...(reached[key] ?? [])].sort(),
        [...axis.values].sort(),
        `${id} reaches every ${key} value`,
      );
  }
});

test("axes add no templates and keep each family's skill", () => {
  for (const id of ids) {
    assert.equal(templates.filter((t) => t.id === id).length, 1, id);
  }
});

test("exact decimal text and the nearest square root", () => {
  assert.equal(exactDecimal(21, 2), "10.5");
  assert.equal(exactDecimal(7, 8), "0.875");
  assert.equal(exactDecimal(50, 1), "50");
  assert.equal(exactDecimal(-3, 4), "-0.75");
  assert.throws(() => exactDecimal(1, 3), /terminate/);
  for (let m = 2; m <= 6000; m++) {
    if (Number.isInteger(Math.sqrt(m))) {
      assert.throws(() => nearestRoot(m), /perfect square/);
      continue;
    }
    const { lower, nearest } = nearestRoot(m);
    assert.ok(lower * lower < m && m < (lower + 1) ** 2, `${m}`);
    const root = Math.sqrt(m);
    assert.equal(
      nearest,
      Math.abs(root - lower) < Math.abs(lower + 1 - root) ? lower : lower + 1,
    );
  }
});

/** Public prompts only: each new surface is checked from its own words. */
const forAxis = (id: SweepId, key: string, value: string, count = 60) => {
  const found: GeneratedProblem[] = [];
  for (let i = 0; found.length < count && i < 2000; i++) {
    const problem = generateProblem(id, `axis:${i}`);
    if (problem.variant!.axes![key] === value) found.push(problem);
  }
  assert.equal(found.length, count, `${id} ${key}=${value}`);
  return found;
};
const numbers = (text: string) =>
  (text.match(/\d+(?:\.\d+)?/g) ?? []).map(Number);

test("ratio-missing decimal scale: the target is not a whole multiple and the answer is exact", () => {
  for (const p of forAxis("ratio-missing", "scale-factor", "decimal")) {
    const [blue, white, target] = numbers(p.public.prompt);
    assert.ok(target! % white! !== 0, p.public.prompt);
    assert.ok((blue! * target!) % white! !== 0, p.public.prompt);
    assert.equal(Number(p.answer) * white!, blue! * target!, p.public.prompt);
  }
});

test("geometric sequences that shrink end on a whole number", () => {
  for (const form of ["divide-whole", "unit-fraction"]) {
    for (const p of forAxis("geometric-sequence", "ratio-form", form)) {
      const text = p.public.prompt.replace(/\\frac\{1\}\{(\d+)\}/, "1/$1");
      const [start, divisor, term] = numbers(text.replace("1/", ""));
      let value = start!;
      for (let step = 1; step < term!; step++) {
        assert.equal(value % divisor!, 0, p.public.prompt);
        value /= divisor!;
      }
      assert.equal(String(value), p.answer, p.public.prompt);
    }
  }
});

test("signed decimal quotients take the sign from the operands", () => {
  const expected: Record<string, number> = {
    "negative-dividend": -1,
    "negative-divisor": -1,
    "both-negative": 1,
  };
  for (const [sign, direction] of Object.entries(expected))
    for (const p of forAxis("multidigit-decimal-quotient", "sign", sign)) {
      const [dividend, divisor] = p.public.prompt
        .replace(/\\left|\\right/g, "")
        .match(/-?\d+(?:\.\d+)?/g)!
        .map(Number);
      assert.ok(Math.sign(dividend! / divisor!) === direction, p.public.prompt);
      assert.ok(
        Math.abs(Math.abs(Number(p.answer) * divisor!) - Math.abs(dividend!)) <
          1e-9,
        p.public.prompt,
      );
      assert.equal(Math.sign(Number(p.answer)), direction, p.public.prompt);
    }
});

test("rounded roots are the nearest value at the stated place", () => {
  const cases: [SweepId, string, string, number][] = [
    ["right-triangle", "hypotenuse", "nearest-whole", 0],
    ["right-triangle", "hypotenuse", "nearest-tenth", 1],
  ];
  for (const [id, key, value, places] of cases)
    for (const p of forAxis(id, key, value)) {
      const [a, b] = numbers(p.public.prompt);
      const hypotenuse = Math.sqrt(a! * a! + b! * b!);
      assert.equal(p.answer, hypotenuse.toFixed(places).replace(/\.0+$/, ""));
    }
  for (const p of forAxis(
    "right-triangle-missing-leg",
    "lengths",
    "tenths-nearest-tenth",
  )) {
    const [h, k] = numbers(p.public.prompt);
    assert.equal(
      p.answer,
      Math.sqrt(h! * h! - k! * k!)
        .toFixed(1)
        .replace(/\.0$/, ""),
    );
  }
});

test("circle area with pi taken as 3.14", () => {
  for (const p of forAxis("circle-area-coefficient", "pi-form", "pi-3-14")) {
    const [given] = numbers(p.public.prompt);
    const radius = p.public.prompt.includes("diameter") ? given! / 2 : given!;
    assert.equal(Math.round(Number(p.answer) * 100), 314 * radius * radius);
  }
});

test("turn degrees from a fraction of the circle", () => {
  for (const p of forAxis("turn-degrees", "turn-form", "fraction-of-circle")) {
    const [num, den] = numbers(
      p.public.prompt.replace(/\\frac\{(\d+)\}\{(\d+)\}/, "$1 $2"),
    );
    assert.equal(Number(p.answer), (360 * num!) / den!);
  }
});
