import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { generatedProblemSchema } from "../src/math/contracts";
import { generateProblem, templates } from "../src/math/engine";
import { satCompletionAxes } from "../src/math/sat-completion-practice";
import {
  quadraticSolutionAxes,
  rootRelationsAxes,
} from "../src/math/sat-numeric-entry-practice";
import { polynomialAxes } from "../src/math/polynomial-practice";
import { exponentialAxes } from "../src/math/exponential-practice";
import { coordinateCircleAxes } from "../src/math/coordinate-circle-practice";
import type { Axis } from "../src/math/variation/axes";
import { objectiveForSkill } from "../src/curriculum/selection";

/** Every high-school number-domain / surface axis added to an existing family. */
const varied: Record<string, Record<string, Axis>> = {
  ...(satCompletionAxes as Record<string, Record<string, Axis>>),
  "sat-entry-quadratic-solution": quadraticSolutionAxes,
  "sat-entry-root-relations": rootRelationsAxes,
  "polynomial-addition": polynomialAxes,
  "polynomial-subtraction": polynomialAxes,
  ...(exponentialAxes as Record<string, Record<string, Axis>>),
  ...(coordinateCircleAxes as Record<string, Record<string, Axis>>),
};
const ids = Object.keys(varied).sort();
const seeds = Array.from({ length: 400 }, (_, i) => `hs:${i}`);

test("every varied family keeps its template, skill and exposure objective", () => {
  assert.equal(ids.length, 11);
  for (const id of ids) {
    const matches = templates.filter((t) => t.id === id);
    assert.equal(matches.length, 1, id);
    assert.ok(objectiveForSkill(matches[0]!.skillId), id);
    assert.ok(!templates.some((t) => t.id.startsWith(`${id}-`)), id);
  }
});

test("legacy axis values reproduce the pre-axis output byte for byte", () => {
  const golden = JSON.parse(
    readFileSync(
      new URL(
        "./fixtures/hs-number-domain-legacy-digests.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as Record<string, string[]>;
  assert.deepEqual(Object.keys(golden).sort(), ids);
  for (const [id, digests] of Object.entries(golden)) {
    let legacy = 0;
    digests.forEach((digest, i) => {
      const problem = generateProblem(id, `legacy:${i}`);
      const axes = problem.variant!.axes!;
      assert.deepEqual(
        Object.keys(axes).sort(),
        Object.keys(varied[id]!).sort(),
      );
      if (!Object.values(varied[id]!).every((a) => axes[a.id] === a.legacy))
        return;
      legacy++;
      const { variant, ...before } = problem;
      void variant;
      assert.equal(
        createHash("sha256")
          .update(JSON.stringify(before))
          .digest("hex")
          .slice(0, 16),
        digest,
        `${id} legacy:${i}`,
      );
    });
    assert.ok(legacy >= 30, `${id} reaches its legacy surface (${legacy})`);
  }
});

test("every axis value of every family is reachable, valid and deterministic", () => {
  for (const id of ids) {
    const seen = new Map<string, Set<string>>();
    for (const seed of seeds) {
      const problem = generateProblem(id, seed);
      generatedProblemSchema.parse(problem);
      assert.deepEqual(generateProblem(id, seed), problem, `${id} ${seed}`);
      for (const [axis, value] of Object.entries(problem.variant!.axes!)) {
        assert.ok(
          varied[id]![axis]!.values.includes(value),
          `${id} ${axis}=${value}`,
        );
        (seen.get(axis) ?? seen.set(axis, new Set()).get(axis)!).add(value);
      }
    }
    for (const axis of Object.values(varied[id]!))
      assert.deepEqual(
        [...(seen.get(axis.id) ?? [])].sort(),
        [...axis.values].sort(),
        `${id} reaches every ${axis.id} value`,
      );
  }
});

test("choices are distinct, one is keyed, and the prompt and hint never state the answer", () => {
  for (const id of ids) {
    const hints = new Map<string, Set<string>>();
    for (const seed of seeds) {
      const problem = generateProblem(id, seed);
      const { prompt, response } = problem.public;
      const key = JSON.stringify(problem.variant!.axes);
      (hints.get(key) ?? hints.set(key, new Set()).get(key)!).add(problem.hint);
      let token = problem.answer;
      if (response.kind === "choice") {
        const labels = response.options.map((o) => o.label);
        assert.equal(
          new Set(labels).size,
          labels.length,
          `${id} ${seed} labels`,
        );
        const keyed = response.options.filter((o) => o.id === problem.answer);
        assert.equal(keyed.length, 1, `${id} ${seed} keyed`);
        token = keyed[0]!.label;
        // Every wrong choice carries its own feedback.
        for (const option of response.options)
          if (option.id !== problem.answer)
            assert.ok(
              problem.choiceFeedback?.[option.id],
              `${id} ${seed} feedback`,
            );
      }
      // A polynomial result may equal a term of an operand; its choices are
      // checked as whole expressions by the oracle instead.
      if (
        !id.startsWith("polynomial-") &&
        (token.length >= 4 || /[/.]/.test(token))
      ) {
        const standalone = new RegExp(
          `(?<![\\w.^{/-])${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w/}])`,
        );
        for (const [where, text] of [
          ["prompt", prompt],
          ["hint", problem.hint],
        ] as const)
          assert.ok(
            !standalone.test(text),
            `${id} ${seed} ${where} quotes ${token}`,
          );
      }
    }
    // Hints name the instance's own givens: they vary within every surface.
    for (const [key, set] of hints)
      if (key.includes('"') && !key.includes("legacy"))
        assert.ok(set.size > 3, `${id} ${key} hints vary (${set.size})`);
  }
});

test("new surfaces state what they ask: rounding, the other quantity, the equation form", () => {
  const find = (id: string, axis: string, value: string) => {
    for (const seed of seeds) {
      const p = generateProblem(id, seed);
      if (p.variant!.axes![axis] === value) return p;
    }
    throw new Error(`${id} ${axis}=${value}`);
  };
  assert.match(
    find("exponential-model-value", "number-domain", "rounded-decimals").public
      .prompt,
    /Round to the nearest cent\./,
  );
  assert.match(
    find("exponential-time-scale", "number-domain", "decimal-periods").public
      .prompt,
    /four decimal places/,
  );
  assert.match(
    find("sat-entry-quadratic-solution", "ask", "smaller").public.prompt,
    /(smaller|negative) solution/,
  );
  assert.match(
    find("sat-entry-root-relations", "equation-form", "both-sides").public
      .prompt,
    /=[^=]*x/,
  );
  assert.match(
    find("perpendicular-slopes", "line-given", "standard-form").public.prompt,
    /has equation \$[^$]*x [+-] \d*y = -?\d+\$/,
  );
  assert.equal(
    find("perpendicular-slopes", "line-given", "slope-intercept").public.figure,
    undefined,
  );
  assert.match(
    find("quadratic-parameter-root", "leading-sign", "negative").public.prompt,
    /\$-\d*x\^2/,
  );
  assert.match(
    find("similar-solid-volume", "scale-given", "surface-areas").public.prompt,
    /surface area/,
  );
});
