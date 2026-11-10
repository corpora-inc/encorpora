import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  templates,
  generateProblem,
  gradeAnswer,
  isValidResponse,
} from "../src/math/engine";
import { generatedProblemSchema } from "../src/math/contracts";
import { problemGuessChance } from "../src/math/guess-chance";
import { lessons } from "../src/content/lessons";
import { methods } from "../src/content/problem-methods";
import { principles } from "../src/content/problem-principles";
import {
  problemLesson,
  lessonGlossaryContext,
} from "../src/content/problem-lessons";
import { publicationProblems } from "../src/content/publications";
import { ReferenceLesson } from "../src/content/ReferenceLesson";
import { PrintExerciseBody } from "../src/content/print-exercise";
import { buildCoverageManifest } from "../src/content/coverage";
import { actualFacetMappings } from "../src/content/facet-mappings";
import { auditCurriculum } from "../src/curriculum/audit";
import { buildReleasedItemLedger } from "../src/curriculum/released-items";
import { hasGlossaryEntry } from "../src/glossary";
import { methodTermId } from "../src/glossary/resolve";
import { contextConflicts } from "../src/glossary/link";
import { books } from "../src/books/catalog";
import { renderBook } from "../src/publishing/book";
import { publicationSourceHashes } from "../src/publishing/source-manifest";
import { publicationDocuments } from "../scripts/publication-documents";
import {
  familyFiles,
  familyIndexLines,
  renderFamilyIndex,
} from "../scripts/gen-family-index";

// This is the source-artifact preflight, not the 256-seed quality inventory.
// Use production builders; never mirror their routing in a second type list.
const seed = "independent-0";
const root = fileURLToPath(new URL("../", import.meta.url));
const instruction = new Map(
  templates.map((t) => [
    t.id,
    lessons.filter((l) => l.templateIds.includes(t.id)),
  ]),
);
const bookTypes = new Set(
  books.flatMap((b) => b.bindings.map((binding) => binding.templateId)),
);
const mapped = new Set(
  actualFacetMappings.map((mapping) => mapping.templateId),
);

test("complete catalog: family discovery, curriculum, facets and released references", () => {
  assert.ok(templates.length > 0);
  assert.equal(new Set(templates.map((t) => t.id)).size, templates.length);
  const directory = new URL("../src/families/", import.meta.url);
  assert.deepEqual(
    familyIndexLines(readFileSync(new URL("index.ts", directory), "utf8")),
    familyIndexLines(renderFamilyIndex(familyFiles(readdirSync(directory)))),
    "run npm run families:index",
  );
  for (const report of [
    auditCurriculum(),
    buildCoverageManifest(),
    buildReleasedItemLedger(),
  ])
    assert.deepEqual(report.errors, []);
});

for (const template of templates) {
  test(`complete problem type: ${template.id}`, () => {
    const id = template.id;
    const problem = generateProblem(id, seed);
    generatedProblemSchema.parse(problem); // Includes answer/response and scene schemas.
    assert.equal(problem.public.templateId, id);
    assert.ok(
      isValidResponse(problem.public, problem.answer),
      "answer fits its response",
    );
    assert.ok(
      gradeAnswer(problem, problem.answer),
      "exact grader accepts the key",
    );
    const chance = problemGuessChance(problem);
    assert.ok(
      Number.isFinite(chance) && chance >= 0 && chance <= 1,
      "guess chance",
    );
    assert.ok(mapped.has(id), "facet mapping");
    assert.ok(problem.hint.trim(), "instance hint");
    const method = methods[id];
    assert.ok(method?.goal.trim(), "written method");
    assert.ok(method.method.length >= 2, "method steps");
    assert.ok(method.watch?.trim(), "method watch line");
    assert.ok(principles[id]?.trim(), "principle");
    for (const term of method.terms ?? [])
      assert.ok(
        hasGlossaryEntry(methodTermId(term)),
        `glossary term ${methodTermId(term)}`,
      );
    const context = lessonGlossaryContext(id);
    assert.deepEqual(contextConflicts(context), [], "lesson glossary context");
    for (const sense of Object.values(context.senses))
      assert.ok(hasGlossaryEntry(sense), `glossary sense ${sense}`);
    const teaching = problemLesson(id, seed);
    assert.equal(teaching.templateId, id);
    assert.ok(teaching.example.steps.length > 0, "worked example");
    const bound = instruction.get(id)!;
    assert.ok(
      bound.length || bookTypes.has(id),
      "printable lesson or validated book binding",
    );
    // Same dispatch, edition and lesson seed as publicationHtml, without PDF
    // rendering or repeated full-document HTML/font embedding.
    for (const lesson of bound) {
      const problems = publicationProblems({ ...lesson, templateIds: [id] });
      assert.equal(problems.length, 12, `${lesson.id}: worksheet size`);
      for (const item of problems)
        assert.equal(
          item.public.templateId,
          id,
          `${lesson.id}: worksheet type`,
        );
    }
    // Shared print components must accept each response and generated figure.
    for (const solutions of [false, true])
      assert.ok(
        renderToStaticMarkup(
          createElement(PrintExerciseBody, { problem, solutions, number: 1 }),
        ),
      );
  });
}

test("complete print catalog: lesson scenes, documents and book inputs build", async () => {
  const documents = publicationDocuments();
  assert.equal(documents.length, lessons.length * 3);
  for (const lesson of lessons) {
    assert.ok(
      renderToStaticMarkup(
        createElement(ReferenceLesson, { lesson, print: true }),
      ),
    );
    const entries = documents.filter((d) => d.lessonId === lesson.id);
    assert.deepEqual(entries.map((d) => d.kind).sort(), [
      "lesson",
      "solutions",
      "workbook",
    ]);
    for (const entry of entries)
      assert.deepEqual(entry.formats, ["Letter", "A4"]);
    for (const sense of Object.values(lesson.senses ?? {}))
      assert.ok(
        hasGlossaryEntry(sense),
        `${lesson.id}: glossary sense ${sense}`,
      );
  }
  for (const { content } of books) {
    assert.ok(renderBook(content));
    await publicationSourceHashes(root, content.id);
  }
});

test("complete oracle catalog: every registered type reaches the independent solver", () => {
  const result = spawnSync(
    "python3",
    [
      "-c",
      `
import json, runpy, sys
sys.path.insert(0, 'scripts')
review = runpy.run_path('scripts/independent-math-review.py')
problems = json.load(sys.stdin)
ids = {p['templateId'] for p in problems}
errors = []
if ids != review['SUPPORTED']:
    errors.append('Oracle inventory mismatch: unknown=' + str(sorted(ids - review['SUPPORTED'])) + ', missing=' + str(sorted(review['SUPPORTED'] - ids)))
for public in problems:
    try:
        review['solve'](public)
    except Exception as error:
        errors.append(public['templateId'] + ': ' + str(error))
print(json.dumps(errors))
`,
    ],
    {
      cwd: root,
      input: JSON.stringify(
        templates.map((t) => generateProblem(t.id, seed).public),
      ),
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024,
    },
  );
  assert.equal(result.status, 0, result.stderr || String(result.error));
  assert.deepEqual(JSON.parse(result.stdout), []);
});
