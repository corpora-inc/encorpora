import { test } from "node:test";
import assert from "node:assert/strict";
import {
  clientCanDraw,
  figureCapabilities,
  generatedProblemSchema,
  responseCapabilities,
} from "../src/math/contracts";
import { generateProblem, gradeAnswer, templates } from "../src/math/engine";
import { clauseExtensions, clauseProblem } from "../src/math/clause-extensions";
import {
  triangleProofProblem,
  triangleProofVariants,
} from "../src/math/geometric-proof-clauses";
import { withTemplateVersion } from "../src/math/variation/axes";
import { problemLesson } from "../src/content/problem-lessons";
import { clauseMethods } from "../src/content/clause-methods";
import { typographyIssues } from "./fixtures/math-typography";
import { unnamedGivens } from "./fixtures/hint-rules";
import { buildCoverageManifest } from "../src/content/coverage";

test("every clause surface validates, has a credited key, and replays deterministically", () => {
  const errors: string[] = [];
  for (const [id, extension] of Object.entries(clauseExtensions)) {
    const meta = templates.find((t) => t.id === id)!;
    assert.ok(meta, id);
    for (const variant of extension.variants)
      for (let i = 0; i < 80; i++) {
        const seed = `clause-${i}`;
        let p;
        try {
          p = clauseProblem(meta, seed, variant)!;
          generatedProblemSchema.parse(p);
        } catch (error) {
          errors.push(
            `${id}/${variant}/${seed}: ${String(error).slice(0, 180)}`,
          );
          break;
        }
        assert.ok(gradeAnswer(p, p.answer), `${id}/${variant}/${seed}`);
        assert.deepEqual(p, clauseProblem(meta, seed, variant));
        assert.ok(!gradeAnswer(p, "not-an-answer"));
      }
    assert.equal(
      withTemplateVersion(meta.version - 1, () =>
        clauseProblem(meta, "old-seed"),
      ),
      null,
    );
    const legacy = generateProblem(id, "old-seed", meta.version - 1);
    assert.ok(!legacy.variant?.axes?.clause);
  }
  assert.deepEqual(errors, []);
});

test("triangle proof families validate and reject unsupported proof steps", () => {
  for (const variant of triangleProofVariants)
    for (let i = 0; i < 100; i++) {
      const p = triangleProofProblem(`proof-${i}`, variant);
      try {
        generatedProblemSchema.parse(p);
      } catch (error) {
        throw new Error(`${variant}/${i}: ${error}`);
      }
      assert.ok(gradeAnswer(p, p.answer));
      const response = p.public.response;
      assert.equal(response.kind, "structured-work");
      if (response.kind !== "structured-work") continue;
      if (response.mode === "build") {
        const rows = JSON.parse(p.answer) as string[][];
        const reversed = JSON.stringify([...rows].reverse());
        assert.ok(
          !gradeAnswer(p, reversed),
          `${variant} rejects its conclusion before its support`,
        );
      }
    }
});

test("normal dispatch reaches every clause and mixed-format metadata excludes unsupported clients", () => {
  const capabilities = { responseCapabilities, figureCapabilities };
  const forKind = {
    choice: "single-choice-v1",
    "multi-select": "multi-select-v1",
    "point-plot": "point-plot-v1",
    "line-plot-build": "line-plot-build-v1",
    "unit-square-marking": "unit-square-marking-v1",
    "counter-builder": "counter-builder-v1",
    "shape-composer": "shape-composer-v1",
    "multi-part-choice": "multi-part-choice-v1",
    "figure-choice": "figure-choice-v1",
    "structured-work": "structured-work-v1",
    "multi-part-cards": "multi-part-cards-v1",
  } as const;
  for (const [id, extension] of Object.entries(clauseExtensions)) {
    const meta = templates.find((t) => t.id === id)!;
    const seen = new Set<string>();
    assert.ok(clientCanDraw(meta, capabilities), id);
    for (let i = 0; i < 150; i++) {
      const p = generateProblem(id, `dispatch-${i}`);
      if (p.variant?.axes?.clause) seen.add(p.variant.axes.clause);
      const kind = p.public.response.kind;
      if (kind !== "number" && kind !== "fraction") {
        const required = forKind[kind];
        assert.equal(
          clientCanDraw(meta, {
            ...capabilities,
            responseCapabilities: responseCapabilities.filter(
              (c) => c !== required,
            ),
          }),
          false,
          `${id}/${kind}`,
        );
      }
    }
    assert.deepEqual([...seen].sort(), [...extension.variants].sort(), id);
    for (const seed of ["", "x".repeat(129)])
      assert.throws(() => generateProblem(id, seed), /Seed/);
  }
  for (const seed of ["", "x".repeat(129)])
    assert.throws(() => triangleProofProblem(seed), /Seed/);
});

test("clause lessons follow the active variant and authored notation typesets", () => {
  const failures = new Set<string>();
  const check = (owner: string, text: string) => {
    const issues = typographyIssues(text);
    if (issues.length)
      failures.add(
        `${owner}: ${text}: ${issues.map((i) => i.rule).join(", ")}`,
      );
  };
  for (const [id, extension] of Object.entries(clauseExtensions)) {
    const meta = templates.find((t) => t.id === id)!;
    for (const variant of extension.variants) {
      const method = clauseMethods[variant]!;
      assert.ok(method, `${id}/${variant}`);
      for (const text of [
        method.goal,
        method.intuition ?? "",
        ...method.method,
        method.watch ?? "",
      ])
        check(variant, text);
      for (let i = 0; i < 20; i++) {
        const p = clauseProblem(meta, `typography-${i}`, variant)!;
        for (const text of [
          p.public.prompt,
          p.hint,
          ...p.explanation,
          ...Object.values(p.choiceFeedback ?? {}),
        ])
          check(`${id}/${variant}`, text);
        const response = p.public.response;
        if (
          response.kind === "choice" ||
          response.kind === "figure-choice" ||
          response.kind === "multi-select"
        )
          response.options.forEach((o) => check(variant, o.label));
        if (response.kind === "multi-part-choice")
          response.blanks.forEach((b) => {
            check(variant, b.label);
            b.options.forEach((o) => check(variant, o.label));
          });
        if (i === 0) {
          const lesson = problemLesson(
            id,
            "clause-method-review",
            p.public.prompt,
            p.public.response,
            p,
          );
          assert.equal(lesson.goal, method.goal, `${id}/${variant}`);
          assert.ok(lesson.example.steps.length >= 1);
        }
      }
    }
  }
  assert.deepEqual([...failures], []);
});

test("clause hints name the current instance's givens", () => {
  assert.deepEqual(Object.keys(clauseExtensions).filter(unnamedGivens), []);
});

test("triangle proof registration uses facets owned by its skill", () => {
  const manifest = buildCoverageManifest();
  assert.deepEqual(
    manifest.errors.filter((error) =>
      error.includes("two-column-triangle-proof"),
    ),
    [],
  );
});
