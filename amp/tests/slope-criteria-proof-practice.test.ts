import test from "node:test";
import assert from "node:assert/strict";
import { generatedProblemSchema } from "../src/math/contracts";
import {
  VALID_REASONS,
  generateSlopeCriteriaProof,
} from "../src/math/slope-criteria-proof-practice";
import { slopeCriteriaProofLessons } from "../src/content/slope-criteria-proof-lessons";
import { layoutScene } from "../src/math/scene";

const ORDER = {
  parallel: [
    "parallel-runs",
    "parallel-right",
    "parallel-angles",
    "parallel-cong",
    "parallel-parts",
  ],
  converse: [
    "converse-rises",
    "converse-sas",
    "converse-parts",
    "converse-lines",
  ],
  perpendicular: ["perp-preserve", "perp-turn", "perp-slope", "perp-product"],
} as const;

test("slope proofs follow a fixed reason table and do not invent the proof", () => {
  assert.match(slopeCriteriaProofLessons[0]!.summary, /not inventing/);
  const seen = new Set<string>();
  for (let i = 0; i < 200; i++) {
    const problem = generateSlopeCriteriaProof("slope-criteria-proof", `sp-${i}`);
    generatedProblemSchema.parse(problem);
    assert.equal(problem.public.figure?.kind, "scene");
    if (problem.public.figure?.kind === "scene")
      layoutScene(problem.public.figure.scene);
    if (problem.public.response.kind !== "multi-part-choice")
      throw new Error("parts");
    const kind = problem.variant!.id as keyof typeof ORDER;
    seen.add(kind);
    const steps = ORDER[kind];
    const answer = JSON.parse(problem.answer) as Record<string, string>;
    assert.deepEqual(
      Object.keys(answer),
      steps.map((_, n) => `s${n + 1}`),
    );
    problem.public.response.blanks.forEach((blank, index) => {
      const step = steps[index]!;
      const key = blank.options.find((o) => o.id === answer[blank.id])!.label;
      if (step !== "perp-slope") {
        assert.equal(key, VALID_REASONS[step]);
        for (const option of blank.options)
          if (option.label !== key)
            assert.ok(!Object.values(VALID_REASONS).includes(option.label));
      }
    });
    if (kind === "perpendicular") {
      const match = /run (\d+) and rise (\d+)/.exec(problem.public.prompt)!;
      const run = Number(match[1]);
      const rise = Number(match[2]);
      assert.equal((rise / run) * (-run / rise), -1);
      const slope = problem.public.response.blanks[2]!.options.find(
        (o) => o.id === answer.s3,
      )!.label;
      const others = problem.public.response.blanks[2]!.options
        .filter((o) => o.id !== answer.s3)
        .map((o) => o.label);
      assert.equal(new Set([slope, ...others]).size, 4);
      assert.ok(others.every((label) => label !== slope));
    }
  }
  assert.deepEqual([...seen].sort(), ["converse", "parallel", "perpendicular"]);
});
