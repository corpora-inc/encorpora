import assert from "node:assert/strict";
import test from "node:test";
import { generateProblem, gradeAnswer, templates } from "../src/math/engine";
import { buildClause, clauseFamilies } from "../src/math/clause-variants";
import {
  clientCanDraw,
  figureCapabilities,
  generatedProblemSchema,
  responseCapabilities,
} from "../src/math/contracts";
import { guessChance, problemGuessChance } from "../src/math/guess-chance";
import { problemLesson } from "../src/content/problem-lessons";
import { clauseMethod } from "../src/content/clause-variant-lessons";
import { typographyIssues } from "./fixtures/math-typography";

const affected = templates.filter(
  (t) =>
    clauseFamilies[t.id] ||
    [
      "three-digit-number-names",
      "similarity-by-transformation-grade-8",
    ].includes(t.id),
);
const kindCapability = {
  choice: "single-choice-v1",
  "multi-select": "multi-select-v1",
  "point-plot": "point-plot-v1",
  "multi-part-choice": "multi-part-choice-v1",
  "figure-choice": "figure-choice-v1",
  "structured-work": "structured-work-v1",
} as const;

test("clause variants are reachable, grade their answers, and declare every answer capability", () => {
  const chances = new Set<string>();
  for (const meta of affected) {
    const seen = new Set<string>(),
      chance = guessChance(meta);
    let translations = 0;
    for (let i = 0; i < 120; i++) {
      const p = generateProblem(meta.id, `clause-integration:${i}`);
      generatedProblemSchema.parse(p);
      assert.ok(
        gradeAnswer(p, p.answer),
        `${meta.id}/${p.variant?.id}: ${p.answer}`,
      );
      if (p.variant) seen.add(p.variant.id);
      if (p.variant?.id === "translation-image") translations++;
      const capability =
        kindCapability[p.public.response.kind as keyof typeof kindCapability];
      if (capability)
        assert.ok(
          [
            meta.requiredResponseCapability,
            ...(meta.requiredResponseCapabilities ?? []),
          ].includes(capability),
          `${meta.id} omits ${capability}`,
        );
      if (chance + 1e-12 < problemGuessChance(p))
        chances.add(
          `${meta.id}: guess chance ${chance} < ${problemGuessChance(p)}`,
        );
    }
    for (const family of clauseFamilies[meta.id] ?? [])
      assert.ok(seen.has(family), `${meta.id}/${family} is unreachable`);
    assert.ok(
      clientCanDraw(meta, { responseCapabilities, figureCapabilities }),
    );
    for (const cap of meta.requiredResponseCapabilities ?? [])
      assert.equal(
        clientCanDraw(meta, {
          responseCapabilities: responseCapabilities.filter((c) => c !== cap),
          figureCapabilities,
        }),
        false,
        `${meta.id} accepts a client without ${cap}`,
      );
    if (meta.id === "transformation-image")
      assert.ok(
        translations >= 30,
        "At least 25% of 120 current transformation draws are translations",
      );
    if (clauseFamilies[meta.id]) {
      for (let i = 0; i < 8; i++) {
        const old = generateProblem(meta.id, `stored:${i}`, meta.version - 1);
        assert.ok(
          !old.variant?.axes?.clause,
          `${meta.id} changed a stored version`,
        );
        assert.deepEqual(
          old,
          generateProblem(meta.id, `stored:${i}`, meta.version - 1),
        );
      }
    }
  }
  assert.deepEqual([...chances], []);
});

test("each clause has an instance-matched lesson and typeset learner prose", () => {
  const errors = new Set<string>();
  for (const meta of affected) {
    for (const family of clauseFamilies[meta.id] ?? [
      meta.id === "three-digit-number-names"
        ? "number-names"
        : "grade-8-origin",
    ]) {
      assert.ok(clauseMethod(family), family);
      for (let i = 0; i < 6; i++) {
        const p = clauseFamilies[meta.id]
          ? buildClause(meta, `lesson-review:${i}`, family)
          : generateProblem(meta.id, `lesson-review:${i}`);
        const texts = [p.public.prompt, p.hint, ...p.explanation];
        const r = p.public.response;
        if (r.kind === "choice" || r.kind === "multi-select")
          texts.push(...r.options.map((o) => o.label));
        if (r.kind === "multi-part-choice")
          texts.push(...r.blanks.flatMap((b) => b.options.map((o) => o.label)));
        if (r.kind === "structured-work")
          texts.push(
            ...r.rows.flatMap((row) => (row.label ? [row.label] : [])),
            ...r.banks.flatMap((b) => b.options.map((o) => o.label)),
          );
        const method = clauseMethod(family)!;
        texts.push(
          method.goal,
          ...(method.intuition ? [method.intuition] : []),
          ...method.method,
          ...(method.watch ? [method.watch] : []),
        );
        for (const text of texts)
          for (const issue of typographyIssues(text))
            errors.add(`${meta.id}/${family}: ${issue.rule}: ${issue.excerpt}`);
      }
      const learner = clauseFamilies[meta.id]
        ? buildClause(meta, "lesson-match", family)
        : generateProblem(meta.id, "lesson-match");
      assert.doesNotThrow(() =>
        problemLesson(
          meta.id,
          "lesson-match-example",
          learner.public.prompt,
          learner.public.response,
          learner,
        ),
      );
    }
  }
  assert.deepEqual([...errors], []);
});

test("CPCTC proof grading enforces dependencies while allowing independent givens to swap", () => {
  const meta = templates.find((t) => t.id === "two-column-congruence-proof")!;
  for (let i = 0; i < 30; i++) {
    const p = buildClause(
      meta,
      `proof-dependencies:${i}`,
      "cpctc-relationship",
    );
    const answer: string[][] = JSON.parse(p.answer);
    const swapped = answer.map((row) => [...row]);
    [swapped[0], swapped[1]] = [swapped[1]!, swapped[0]!];
    assert.ok(gradeAnswer(p, JSON.stringify(swapped)));
    const early = answer.map((row) => [...row]);
    [early[0], early[3]] = [early[3]!, early[0]!];
    assert.equal(gradeAnswer(p, JSON.stringify(early)), false);
  }
});
