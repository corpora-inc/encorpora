import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { clauseExtensions, clauseProblem } from "../src/math/clause-extensions";
import {
  triangleProofProblem,
  triangleProofVariants,
} from "../src/math/geometric-proof-clauses";
import type { GeneratedProblem, TemplateMetadata } from "../src/math/contracts";

test("independent public-payload oracle checks every clause and rejects changed keys", (t) => {
  const problems: GeneratedProblem[] = [];
  for (const [id, extension] of Object.entries(clauseExtensions)) {
    const meta: TemplateMetadata = {
      id,
      version: 2,
      title: id,
      skillId: "triangle-proofs",
      gradeBand: "9–12",
      description: "Oracle fixture",
    };
    for (const variant of extension.variants)
      for (let i = 0; i < 60; i++)
        problems.push(clauseProblem(meta, `oracle-${i}`, variant)!);
  }
  for (const variant of triangleProofVariants)
    for (let i = 0; i < 80; i++)
      problems.push(triangleProofProblem(`oracle-${i}`, variant));
  const run = spawnSync("python3", ["scripts/clause_coverage_oracle.py"], {
    input: problems.map((p) => JSON.stringify(p)).join("\n"),
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  assert.match(run.stdout, new RegExp(`${problems.length} cases passed`));
  t.diagnostic(run.stdout.trim());
  function rejects(changed: GeneratedProblem, message: string) {
    const rejected = spawnSync(
      "python3",
      ["scripts/clause_coverage_oracle.py"],
      { input: JSON.stringify(changed), encoding: "utf8" },
    );
    assert.notEqual(rejected.status, 0, message);
  }
  // Numerical, plotting, choice, figure-choice, blanks and proof keys are all
  // values under test. A mutation never becomes input to the public solver.
  for (const kind of new Set(problems.map((p) => p.public.response.kind))) {
    const original = problems.find((p) => p.public.response.kind === kind)!;
    const changed = { ...original, answer: "incorrect-key" };
    rejects(changed, `${kind} accepted a changed key`);
  }
  const duplicateGraph = structuredClone(
    problems.find((p) => p.public.templateId === "polynomial-graph-match")!,
  );
  assert.equal(duplicateGraph.public.response.kind, "figure-choice");
  if (duplicateGraph.public.response.kind === "figure-choice") {
    const wrong = duplicateGraph.public.response.options.filter(
      (o) => o.id !== duplicateGraph.answer,
    );
    wrong[1].scene = structuredClone(wrong[0].scene);
    rejects(duplicateGraph, "Equivalent wrong graphs were accepted");
  }
  const proof = structuredClone(
    problems.find((p) => p.workGrading?.mode === "proof")!,
  );
  assert.equal(proof.workGrading?.mode, "proof");
  if (proof.workGrading?.mode === "proof") {
    const claim = Object.values(proof.workGrading.claims)
      .flatMap(Object.values)
      .find((alternatives) => alternatives[0].length > 0)!;
    claim[0] = [];
    rejects(proof, "An unsupported private proof dependency was accepted");
  }
  const inverse = structuredClone(
    problems.find(
      (p) =>
        p.public.templateId === "inverse-expression" &&
        p.public.prompt.includes("\\sqrt[3]"),
    )!,
  );
  inverse.public.prompt = inverse.public.prompt.replace("{x/2}", "{x/3}");
  rejects(inverse, "A false public inverse claim was accepted");
});
