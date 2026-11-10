import test from "node:test";
import assert from "node:assert/strict";
import {
  statisticsProbabilityTemplates,
  statisticsProbabilityVariant,
} from "../src/math/statistics-probability-practice";
import { generateProblem, templates } from "../src/math/engine";
import { generatedProblemSchema } from "../src/math/contracts";
import { problemLesson } from "../src/content/problem-lessons";

// Fixed witnesses keep the independent mathematical cases below exercised.
// They are not a complete inventory; new types come from the registry.
const regressionCases: Record<string, string[]> = {
  "normal-model-rule": [
    "between-symmetric",
    "between-asymmetric",
    "one-sided",
    "find-interval",
    "z-compare",
    "model-appropriate",
  ],
  "random-variable-distribution": [
    "list-probability",
    "define-variable",
    "read-distribution",
    "missing-probability",
    "graph-the-distribution",
  ],
  "theoretical-distribution-expectation": [
    "two-dice-probability",
    "game-expected-value",
    "binomial-probability",
    "binomial-expectation",
  ],
  "empirical-distribution-expectation": [
    "relative-frequency",
    "expected-per-trial",
    "expected-total",
  ],
  "strategy-expected-value": ["compare-games", "warranty", "sure-or-gamble"],
  "fair-selection-procedure": [
    "choose-procedure",
    "two-dice-chance",
    "remainder-chance",
    "reroll-chance",
  ],
  "simulation-consistency-check": ["two-sided", "one-sided", "boundary"],
  "randomization-test-decision": ["two-sided", "one-sided", "boundary"],
  "report-flaw-critique": [
    "single-voluntary",
    "single-convenience",
    "single-small",
    "single-missing",
    "single-axis",
    "mixed-pair",
  ],
  "model-residual-conclusion": [
    "curved-pattern",
    "no-pattern",
    "extrapolation",
    "compare-models",
  ],
};
const SEEDS = 400;

test("every statistics template has one correct distinct choice, no leaks and reaches every variant", () => {
  for (const meta of statisticsProbabilityTemplates) {
    const seen = new Set<string>();
    for (let seed = 0; seed < SEEDS; seed++) {
      const id = `s${seed}`;
      const generated = generateProblem(meta.id, id);
      const again = generateProblem(meta.id, id);
      assert.deepEqual(generatedProblemSchema.parse(generated), generated);
      assert.deepEqual(generated, again, `${meta.id} ${id} not deterministic`);
      assert.equal(generated.public.skillId, meta.skillId);
      const response = generated.public.response;
      assert.equal(response.kind, "choice");
      if (response.kind !== "choice") continue;
      const labels = response.options.map((o) => o.label);
      assert.equal(response.options.length, 4);
      assert.equal(
        new Set(labels).size,
        4,
        `${meta.id} ${id} duplicate labels`,
      );
      const correct = response.options.filter((o) => o.id === generated.answer);
      assert.equal(correct.length, 1);
      const wrong = response.options.filter((o) => o.id !== generated.answer);
      for (const option of wrong)
        assert.ok(
          generated.choiceFeedback?.[option.id]?.length,
          `${meta.id} ${id} missing feedback`,
        );
      const variant = statisticsProbabilityVariant(meta.id, id);
      const label = correct[0]!.label;
      const shows = (text: string) =>
        new RegExp(
          `(?<![\\w.−-])${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w.])`,
        ).test(text);
      // The four-game question names its games in the prompt by design.
      assert.ok(
        variant === "compare-games" || !shows(generated.public.prompt),
        `${meta.id} ${id} prompt shows the answer`,
      );
      assert.ok(
        !shows(generated.hint),
        `${meta.id} ${id} hint shows the answer`,
      );
      assert.ok(generated.explanation.length >= 3);
      assert.ok(generated.hint.length > 40);
      seen.add(variant);
    }
    for (const variant of regressionCases[meta.id] ?? [])
      assert.ok(
        seen.has(variant),
        `${meta.id}: mathematical case ${variant} was not exercised`,
      );
  }
});

test("empirical expectation matches an independent recomputation from the plotted counts", () => {
  for (let seed = 0; seed < SEEDS; seed++) {
    const id = `e${seed}`;
    if (
      statisticsProbabilityVariant("empirical-distribution-expectation", id) !==
      "expected-per-trial"
    )
      continue;
    const g = generateProblem("empirical-distribution-expectation", id);
    const fig = g.public.figure;
    assert.equal(fig?.kind, "bar-chart");
    if (fig?.kind !== "bar-chart") continue;
    const n = fig.values.reduce((a, b) => a + b, 0);
    const total = fig.values.reduce(
      (a, c, i) => a + c * Number(fig.categories[i]),
      0,
    );
    const response = g.public.response;
    if (response.kind !== "choice") continue;
    const label = response.options.find((o) => o.id === g.answer)!.label;
    assert.ok(Math.abs(Number(label) - total / n) < 1e-9, `${id}: ${label}`);
  }
});

test("simulation and randomization tail counts match the plotted bars", () => {
  for (let seed = 0; seed < SEEDS; seed++) {
    const id = `t${seed}`;
    for (const templateId of [
      "simulation-consistency-check",
      "randomization-test-decision",
    ]) {
      const g = generateProblem(templateId, id);
      const fig = g.public.figure;
      assert.equal(fig?.kind, "bar-chart");
      if (fig?.kind !== "bar-chart") continue;
      const expectedTotal = templateId.startsWith("sim") ? 100 : 200;
      assert.equal(
        fig.values.reduce((a, b) => a + b, 0),
        expectedTotal,
      );
      const response = g.public.response;
      if (response.kind !== "choice") continue;
      const label = response.options.find((o) => o.id === g.answer)!.label;
      const count = Number(/^(\d+) of/.exec(label)![1]);
      const sim = templateId.startsWith("sim");
      const prompt = g.public.prompt;
      const cutoff = Number(/(?:Fewer|less) than (\d+)%/i.exec(prompt)![1]);
      let tail: number;
      if (sim) {
        const observed = Number(
          /test of 20 \w+, [^.]*? (\d+) (?:times|shots)\./.exec(prompt)![1],
        );
        const oneSided = /with \d+ or more/.test(prompt);
        const d = Math.abs(observed - 10);
        tail = fig.values.reduce((a, v, i) => {
          const c = Number(fig.categories[i]);
          const hit = oneSided ? c >= observed : Math.abs(c - 10) >= d;
          return hit ? a + v : a;
        }, 0);
        const percent = count;
        assert.equal(count, tail, id);
        assert.equal(/not consistent/.test(label), percent < cutoff, id);
      } else {
        const d = Number(/was (\d+) /.exec(prompt)![1]);
        const twoSided = /or −\d+ or less/.test(prompt);
        tail = fig.values.reduce((a, v, i) => {
          const c = Number(fig.categories[i]);
          const hit = twoSided ? Math.abs(c) >= d : c >= d;
          return hit ? a + v : a;
        }, 0);
        assert.equal(count, tail, id);
        assert.equal(/: significant;/.test(label), tail / 2 < cutoff, id);
      }
    }
  }
});

test("two-dice and fair-procedure probabilities agree with enumeration", () => {
  for (let seed = 0; seed < SEEDS; seed++) {
    const id = `d${seed}`;
    if (
      statisticsProbabilityVariant(
        "theoretical-distribution-expectation",
        id,
      ) === "two-dice-probability"
    ) {
      const g = generateProblem("theoretical-distribution-expectation", id);
      const m = /P\(X(\\ge |=)(\d+)\)/.exec(g.public.prompt)!;
      const s = Number(m[2]);
      let ways = 0;
      for (let a = 1; a <= 6; a++)
        for (let b = 1; b <= 6; b++)
          if (m[1] === "=" ? a + b === s : a + b >= s) ways++;
      const response = g.public.response;
      if (response.kind !== "choice") continue;
      const label = response.options.find((o) => o.id === g.answer)!.label;
      const frac = /\\frac\{(\d+)\}\{(\d+)\}/.exec(label);
      const value = frac
        ? Number(frac[1]) / Number(frac[2])
        : Number(label.replace(/\$/g, ""));
      assert.ok(Math.abs(value - ways / 36) < 1e-12, `${id}: ${label}`);
    }
    if (
      statisticsProbabilityVariant("fair-selection-procedure", id) ===
      "remainder-chance"
    ) {
      const g = generateProblem("fair-selection-procedure", id);
      const n = Number(
        /dividing the result by (\d+)/.exec(g.public.prompt)![1],
      );
      const j = Number(/student (\d+) is chosen/.exec(g.public.prompt)![1]);
      let hits = 0;
      for (let roll = 1; roll <= 12; roll++) if ((roll % n || n) === j) hits++;
      const response = g.public.response;
      if (response.kind !== "choice") continue;
      const label = response.options.find((o) => o.id === g.answer)!.label;
      const frac = /\\frac\{(\d+)\}\{(\d+)\}/.exec(label)!;
      assert.ok(
        Math.abs(Number(frac[1]) / Number(frac[2]) - hits / 12) < 1e-12,
        `${id}: ${label}`,
      );
    }
  }
});

test("each statistics template has registered lesson support bound to its skill", () => {
  for (const meta of statisticsProbabilityTemplates) {
    assert.equal(
      templates.find((t) => t.id === meta.id)?.skillId,
      meta.skillId,
    );
    const lesson = problemLesson(meta.id, "library");
    assert.ok(lesson.intuition && lesson.intuition.length > 80, meta.id);
    assert.ok(lesson.method.length >= 3, meta.id);
    assert.ok(lesson.watch, meta.id);
    assert.ok(lesson.principle, meta.id);
    assert.ok(lesson.example.steps.length >= 3, meta.id);
  }
});

test("graph the distribution lists every value, and version 1 does not", () => {
  let seen = 0;
  for (let seed = 0; seed < 120; seed++) {
    const id = `g${seed}`;
    const old = generateProblem("random-variable-distribution", id, 1);
    assert.equal(
      old.public.prompt.includes("Which list is the probability distribution"),
      false,
    );
    if (
      statisticsProbabilityVariant("random-variable-distribution", id) !==
      "graph-the-distribution"
    )
      continue;
    seen++;
    const problem = generateProblem("random-variable-distribution", id);
    assert.equal(problem.variant?.id, "graph-the-distribution");
    const response = problem.public.response;
    assert.equal(response.kind, "choice");
    if (response.kind !== "choice") continue;
    const parse = (label: string) => {
      const pairs = [...label.matchAll(/P\((\d+)\)=(\d+)(?:\/(\d+))?/g)];
      const dist = new Map(
        pairs.map((m) => [
          Number(m[1]),
          Number(m[2]) / (m[3] ? Number(m[3]) : 1),
        ]),
      );
      return dist;
    };
    const correct = response.options.find((o) => o.id === problem.answer)!.label;
    const dist = parse(correct);
    let sum = 0;
    for (const p of dist.values()) sum += p;
    assert.ok(Math.abs(sum - 1) < 1e-6, correct);
    const others = response.options.filter((o) => o.id !== problem.answer);
    for (const other of others) {
      const alt = parse(other.label);
      const same =
        alt.size === dist.size &&
        [...dist].every(([k, v]) => alt.get(k) === v);
      assert.equal(same, false, other.label);
    }
    assert.equal(problem.hint.includes(correct), false);
  }
  assert.ok(seen > 10);
});

test("strategy expected value compares strategies rather than pricing one option", () => {
  const seen = new Set<string>();
  for (let seed = 0; seed < 80; seed++) {
    const id = `strategy-${seed}`;
    const variant = statisticsProbabilityVariant("strategy-expected-value", id);
    seen.add(variant);
    const prompt = generateProblem("strategy-expected-value", id).public.prompt;
    assert.match(
      prompt,
      /Which game has the greatest|comparing expected costs|sure .+ or a gamble/,
    );
  }
  assert.deepEqual(
    [...seen].sort(),
    ["compare-games", "sure-or-gamble", "warranty"],
  );
});
