import { test } from "node:test";
import assert from "node:assert/strict";
import { generatedProblemSchema } from "../src/math/contracts.js";
import { methodTermId } from "../src/glossary/resolve";
import {
  generateQuadrilateralHierarchyMultiselect,
  quadrilateralHierarchyMultiselectTemplate,
} from "../src/math/quadrilateral-hierarchy-multiselect.js";
import {
  parseSelection,
  serializeSelection,
} from "../src/math/selection-response.js";
import {
  polygonLessons,
  polygonMethods,
  polygonPrinciples,
} from "../src/content/polygon-lessons.js";
import { polygonFacetMappings } from "../src/content/polygon-coverage.js";
import { releasedItems } from "../src/curriculum/released-items/index.js";

const id = "quadrilateral-hierarchy-multiselect";

test("hierarchy selection instances are deterministic and keep grading data private", () => {
  const lengths = new Set<number>();
  const labels = new Set<string>();
  const hints = new Set<string>();
  const positionCounts = new Map<number, Set<string>>();
  for (let index = 0; index < 256; index++) {
    const seed = `hierarchy-author-${index}`;
    const problem = generateQuadrilateralHierarchyMultiselect(seed);
    assert.deepEqual(problem, generateQuadrilateralHierarchyMultiselect(seed));
    generatedProblemSchema.parse(problem);
    const response = problem.public.response;
    assert.equal(response.kind, "multi-select");
    assert.equal(response.selectionCount, 3);
    assert.ok([5, 6].includes(response.options.length));
    lengths.add(response.options.length);
    assert.equal(
      new Set(response.options.map((option) => option.label)).size,
      response.options.length,
    );
    const selected = parseSelection(problem.answer);
    assert.ok(selected);
    assert.equal(selected.length, 3);
    assert.equal(problem.answer, serializeSelection(selected));
    assert.ok(
      selected.every((choice) =>
        response.options.some((option) => option.id === choice),
      ),
    );
    assert.equal(problem.explanation.length, response.options.length);
    assert.equal(
      problem.explanation.filter((line) => line.includes(" True:")).length,
      3,
    );
    assert.equal(
      problem.explanation.filter((line) => line.includes(" False:")).length,
      response.options.length - 3,
    );
    for (const option of response.options) {
      assert.deepEqual(Object.keys(option).sort(), ["id", "label"]);
      labels.add(option.label);
      assert.ok(
        problem.explanation.some((line) => line.includes(option.label)),
      );
    }
    assert.deepEqual(Object.keys(problem.public).sort(), [
      "id",
      "prompt",
      "response",
      "seed",
      "skillId",
      "templateId",
      "templateVersion",
    ]);
    assert.ok(problem.hint.includes("3 true statements"));
    assert.ok(
      response.options.some((option) => problem.hint.includes(option.label)),
    );
    assert.doesNotMatch(problem.hint, /True:|False:|option-[a-f]/);
    hints.add(problem.hint);
    const counts = positionCounts.get(response.options.length) ?? new Set();
    selected.forEach((choice) => counts.add(choice));
    positionCounts.set(response.options.length, counts);
  }
  assert.deepEqual([...lengths].sort(), [5, 6]);
  assert.equal(
    labels.size,
    20,
    "Every original statement variant is exercised",
  );
  assert.ok(
    hints.size > 10,
    "Hints name an actual statement from each instance",
  );
  assert.equal(positionCounts.get(5)?.size, 5);
  assert.equal(positionCounts.get(6)?.size, 6);
});

test("the family uses the existing skill, lesson, and narrow partial hierarchy facet", () => {
  const template = quadrilateralHierarchyMultiselectTemplate;
  assert.equal(template.id, id);
  assert.equal(template.skillId, "shape-hierarchy");
  assert.equal(template.requiredResponseCapability, "multi-select-v1");
  const lesson = polygonLessons.find((candidate) =>
    candidate.templateIds.includes(id),
  );
  assert.equal(lesson?.id, "quadrilateral-hierarchy");
  assert.ok(lesson.sections.some((section) => section.stage === "intuition"));
  assert.ok(lesson.sections.some((section) => section.stage === "method"));
  assert.ok(
    lesson.closingSections?.some((section) => section.stage === "formal"),
  );
  const method = polygonMethods[id]!;
  assert.ok(method.intuition);
  assert.ok(method.method.length >= 2);
  assert.ok(method.watch);
  assert.ok(
    method.terms?.some((term) => methodTermId(term) === "counterexample"),
  );
  assert.match(polygonPrinciples[id]!, /one counterexample/);
  const facet = polygonFacetMappings.find(
    (mapping) => mapping.templateId === id,
  );
  assert.equal(facet?.facetId, "shape-hierarchy.inclusion");
  assert.equal(facet?.extent, "partial");
  assert.match(facet.rationale, /Does not assess/);
  const item = releasedItems.find(
    (row) => row.sourceId === "mcas-2025-5" && row.item.number === "8",
  );
  assert.ok(item);
  assert.ok(item.templateIds.includes(id));
  assert.deepEqual(item.standards, ["5.G.B.4"]);
  assert.equal(item.responseFormat, "multi-select");
  assert.match(item.limitations, /three-of-six/);
  assert.match(item.limitations, /written justification are unassessed/);
});

test("hierarchy generation rejects invalid seeds before creating an instance", () => {
  assert.throws(() => generateQuadrilateralHierarchyMultiselect(""), /Seed/);
  assert.throws(
    () => generateQuadrilateralHierarchyMultiselect("x".repeat(129)),
    /Seed/,
  );
});
