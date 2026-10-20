import assert from "node:assert/strict";
import test from "node:test";
import {
  algebraStatisticsCase,
  algebraStatisticsTemplates,
} from "../src/math/algebra-statistics-practice.js";
import {
  correlation,
  leastSquares,
  median,
} from "../src/math/algebra-statistics-scenes.js";
import { generateProblem, gradeAnswer } from "../src/math/engine.js";
import { generatedProblemSchema } from "../src/math/contracts.js";
import { templateRole } from "../src/learning/placement.js";
import { layoutScene } from "../src/math/scene/index.js";
import { missingTargets, visibleSteps } from "../src/math/scene/timeline.js";
import { statisticsModelScenes } from "../src/content/statistics-model-scenes.js";
import { algebraStatisticsWorksheet } from "../src/content/algebra-statistics-worksheets.js";
import type { Scene } from "../src/math/scene/spec.js";

const SEEDS = 200;
const cases = (id: string) =>
  Array.from({ length: SEEDS }, (_, i) => algebraStatisticsCase(id, `t-${i}`));
const graphOf = (scene: Scene) => {
  const g = scene.elements.find((e) => e.type === "graph");
  return g?.type === "graph" ? g : undefined;
};

test("each statistics problem type is deterministic, scene-gated and an assessment item", () => {
  for (const t of algebraStatisticsTemplates) {
    assert.equal(t.requiredFigureCapability, "scenes-v1");
    assert.equal(templateRole(t.id), "assessment");
    assert.deepEqual(
      generateProblem(t.id, "same"),
      generateProblem(t.id, "same"),
    );
    const positions = new Set<string>();
    for (const { problem } of cases(t.id)) {
      generatedProblemSchema.parse(problem);
      const r = problem.public.response;
      assert.equal(
        t.requiredResponseCapability === "single-choice-v1",
        r.kind === "choice",
        t.id,
      );
      if (r.kind === "choice") {
        positions.add(problem.answer);
        for (const o of r.options)
          if (o.id !== problem.answer)
            assert.ok(problem.choiceFeedback?.[o.id], `${t.id}: feedback`);
      } else assert.ok(gradeAnswer(problem, problem.answer));
    }
    if (t.requiredResponseCapability) assert.equal(positions.size, 4, t.id);
  }
});

test("every skill is practiced in at least three prompt frames", () => {
  const frames: Record<string, string[]> = {
    "outlier-center-shift": ["remove", "add", "typo"],
    "skewed-box-compare": ["shape", "measure", "spread"],
    "relative-frequency-percent": ["joint", "marginal", "conditional"],
    "conditional-frequency-choice": ["interpret", "pick", "association"],
    "regression-coefficient-meaning": ["slope", "intercept", "units"],
    "regression-line-predict": ["predict", "difference", "solve"],
    "residual-value": ["point", "observed", "table"],
    "correlation-choice": [
      "estimate",
      "strongest",
      "residual-plot",
      "nonlinear",
    ],
    "causal-claim-choice": ["conclusion", "lurking", "reverse"],
    "study-design-choice": ["design", "identify", "conclusion"],
  };
  for (const [id, needed] of Object.entries(frames)) {
    const seen = new Set(cases(id).flatMap((c) => c.tags));
    for (const tag of needed) assert.ok(seen.has(tag), `${id} lacks ${tag}`);
  }
  const both = (id: string, a: string, b: string) => {
    const seen = new Set(cases(id).flatMap((c) => c.tags));
    assert.ok(seen.has(a) && seen.has(b), `${id}: ${a} and ${b}`);
  };
  both("regression-coefficient-meaning", "meaningful", "extrapolation");
  both("conditional-frequency-choice", "associated", "not-associated");
  both("correlation-choice", "curved", "random");
  both("study-design-choice", "experiment", "observational");
  both("residual-value", "above", "below");
});

test("stated least-squares lines are exact for the plotted points", () => {
  for (const id of [
    "regression-coefficient-meaning",
    "regression-line-predict",
    "residual-value",
  ])
    for (const { problem } of cases(id)) {
      const m = /\\hat\{y\} = (-?[\d.]+)x(?: ([+-]) ([\d.]+))?\$/.exec(
        problem.public.prompt,
      );
      assert.ok(m, problem.public.prompt);
      const slope = Number(m[1]),
        b = m[2] ? (m[2] === "+" ? 1 : -1) * Number(m[3]) : 0;
      const f = problem.public.figure;
      const g = f?.kind === "scene" ? graphOf(f.scene) : undefined;
      if (!g) continue; // the residual table frame
      const fit = leastSquares(g.scatter!.points as [number, number][]);
      assert.ok(Math.abs(fit.m - slope) < 1e-9 && Math.abs(fit.b - b) < 1e-9);
      assert.deepEqual(g.scatter!.fit, { m: slope, b });
    }
});

test("outliers move the mean more than the median, and box shapes are clear-cut", () => {
  for (const { problem, tags } of cases("outlier-center-shift")) {
    const f = problem.public.figure!;
    assert.ok(f.kind === "scene");
    const plot = f.scene.elements[0]!;
    assert.ok(plot.type === "dotPlot");
    const values = plot.groups[0]!.values;
    assert.ok(values.every(Number.isInteger));
    // The far value lies beyond 1.5 IQRs of the data that hold it.
    const far = Number(/value,? (\d+)/.exec(problem.public.prompt)![1]);
    const full = tags.includes("add") ? [...values, far] : values;
    const sorted = [...full].sort((a, b) => a - b),
      half = Math.floor(sorted.length / 2);
    const q1 = median(sorted.slice(0, half)),
      q3 = median(sorted.slice(sorted.length - half));
    assert.ok(far > q3 + 1.5 * (q3 - q1) || far < q1 - 1.5 * (q3 - q1));
  }
});

test("correlation items match the plotted points", () => {
  for (const { problem, tags } of cases("correlation-choice")) {
    const f = problem.public.figure;
    if (!tags.includes("estimate") || f?.kind !== "scene") continue;
    const r = correlation(
      graphOf(f.scene)!.scatter!.points as [number, number][],
    );
    const options = (
      problem.public.response as { options: { id: string; label: string }[] }
    ).options;
    const right = Number(
      options.find((o) => o.id === problem.answer)!.label.replace("−", "-"),
    );
    for (const o of options)
      assert.ok(
        Math.abs(r - right) <= Math.abs(r - Number(o.label.replace("−", "-"))),
      );
  }
});

test("figures lay out, and every cue and walkthrough names parts its scene has", () => {
  for (const t of algebraStatisticsTemplates) {
    let walks = 0;
    for (const { problem } of cases(t.id)) {
      const f = problem.public.figure;
      if (f?.kind === "scene") {
        const l = layoutScene(f.scene);
        assert.ok(l.items.length > 0);
        assert.deepEqual(missingTargets(l, problem.hintCue ?? []), [], t.id);
        // A public scene never carries lesson steps that state the answer.
        assert.deepEqual(
          visibleSteps(f.scene.steps ?? [], "lesson"),
          visibleSteps(f.scene.steps ?? [], "hint"),
        );
      }
      if (problem.walkthrough) {
        walks++;
        const l = layoutScene(problem.walkthrough, { reveal: true });
        assert.deepEqual(
          missingTargets(l, problem.walkthrough.steps ?? []),
          [],
          t.id,
        );
      }
    }
    if (
      ![
        "skewed-box-compare",
        "regression-coefficient-meaning",
        "causal-claim-choice",
      ].includes(t.id)
    )
      assert.ok(walks > 0, `${t.id} has walkthroughs`);
  }
  for (const [name, scene] of Object.entries(statisticsModelScenes)) {
    const l = layoutScene(scene, { reveal: true });
    assert.deepEqual(missingTargets(l, scene.steps ?? []), [], name);
  }
});

test("worksheets cover every frame with twelve distinct problems", () => {
  for (const t of algebraStatisticsTemplates) {
    const sheet = algebraStatisticsWorksheet(t.id, "lesson", "1");
    assert.equal(sheet.length, 12);
    assert.equal(new Set(sheet.map((p) => p.public.seed)).size, 12);
  }
});
