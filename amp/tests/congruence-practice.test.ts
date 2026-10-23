import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  congruenceCase,
  congruenceTemplates,
} from "../src/math/congruence-practice";
import { generateProblem, gradeAnswer } from "../src/math/engine";
import { semanticFigureSchema } from "../src/math/contracts";
import { layoutScene } from "../src/math/scene";
import { missingTargets } from "../src/math/scene/timeline";
import { congruenceScenes } from "../src/content/congruence-lessons";
import { selectionObjectives } from "../src/curriculum/selection";

const id = "triangle-congruence-criteria";
const samples = Array.from({ length: 512 }, (_, i) =>
  congruenceCase(id, `author-${i}`),
);
test("an independently authored oracle checks public givens, unique choices and drawn geometry", () => {
  const result = spawnSync(
    "python3",
    [
      "-c",
      "import json, sys; from triangle_congruence_math_oracle import review_problem, self_test; self_test(); [review_problem(json.loads(line)) for line in sys.stdin]",
    ],
    {
      cwd: fileURLToPath(new URL("../scripts/", import.meta.url)),
      input: samples.map((c) => JSON.stringify(c.problem)).join("\n"),
      encoding: "utf8",
    },
  );
  assert.equal(result.status, 0, result.stderr || String(result.error));
});
test("congruence has one versioned public family in its existing exposure objective", () => {
  const metadata = congruenceTemplates[0]!;
  assert.equal(metadata.requiredResponseCapability, "single-choice-v1");
  assert.equal(metadata.requiredFigureCapability, "scenes-v1");
  assert.deepEqual(
    selectionObjectives
      .filter((o) => o.skills.includes(metadata.skillId))
      .map((o) => o.id),
    ["transformations-similarity"],
  );
  assert.deepEqual(
    generateProblem(id, "repeat"),
    generateProblem(id, "repeat"),
  );
  for (const seed of ["", "a".repeat(129)])
    assert.throws(() => generateProblem(id, seed));
});
test("every criterion and non-example is reached in the appropriate prompt frames", () => {
  const seen = new Set(samples.map((c) => c.tags.join("/")));
  for (const frame of ["identify", "assess-claim"])
    for (const rule of ["SSS", "SAS", "ASA", "AAS", "SSA", "AAA"])
      assert.ok(seen.has(`${frame}/${rule}`));
  for (const rule of ["SSS", "SAS", "ASA", "AAS"])
    assert.ok(seen.has(`complete-criterion/${rule}`));
});
test("AAS completion offers only one non-included side", () => {
  for (const { problem, tags } of samples) {
    if (tags.join("/") !== "complete-criterion/AAS") continue;
    const response = problem.public.response;
    assert.equal(response.kind, "choice");
    if (response.kind !== "choice") continue;
    // Angles A and B are given: AB is included, and both BC and CA
    // are non-included. Offering both would make two answers correct.
    assert.equal(
      response.options.filter((o) => /BC = EF|CA = FD/.test(o.label)).length,
      1,
    );
  }
});
test("public choices grade only by option identity and scenes disclose only marked givens", () => {
  const positions = new Set<string>();
  for (const { problem, tags } of samples) {
    const response = problem.public.response;
    assert.equal(response.kind, "choice");
    if (response.kind !== "choice") continue;
    assert.equal(new Set(response.options.map((o) => o.label)).size, 4);
    positions.add(problem.answer);
    for (const option of response.options) {
      assert.equal(
        gradeAnswer(problem, option.id),
        option.id === problem.answer,
      );
      assert.equal(gradeAnswer(problem, option.label), false);
    }
    assert.equal(Object.keys(problem.choiceFeedback!).length, 3);
    assert.equal(
      semanticFigureSchema.safeParse(problem.public.figure).success,
      true,
    );
    const figure = problem.public.figure!;
    assert.equal(figure.kind, "scene");
    if (figure.kind !== "scene") continue;
    assert.ok(layoutScene(figure.scene).items.length > 0);
    assert.equal(figure.scene.elements.length, 2);
    for (const t of figure.scene.elements) {
      assert.equal(t.type, "triangle");
      if (t.type !== "triangle") continue;
      const marked = [...(t.sides ?? []), ...(t.angles ?? [])].filter(
        (x) => "ticks" in x || "mark" in x,
      );
      assert.equal(marked.length, tags[0] === "complete-criterion" ? 2 : 3);
    }
    assert.equal("answer" in problem.public, false);
    assert.equal("hint" in problem.public, false);
  }
  assert.equal(positions.size, 4);
});
test("the standalone lesson's animation targets exist in both masked and revealed views", () => {
  for (const model of Object.values(congruenceScenes))
    for (const reveal of [false, true])
      assert.deepEqual(
        missingTargets(layoutScene(model, { reveal }), model.steps!),
        [],
      );
});
