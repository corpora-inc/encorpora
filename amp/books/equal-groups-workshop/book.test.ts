import assert from "node:assert/strict";
import test from "node:test";
import { equalGroupsWorkshop as book } from "./book.js";
import {
  equalGroupsAlignments,
  validateEqualGroupsAlignments,
} from "./alignments.js";
import { skills, standards } from "../../src/curriculum/catalog.js";
import { templates } from "../../src/math/engine.js";
import { validateBook } from "../../src/publishing/validate.js";
const blocks = book.pages.flatMap((p) => p.blocks);
const tasks = blocks.filter((b) => b.kind === "task");
const solutions = blocks.filter((b) => b.kind === "solution");
const diagrams = blocks
  .filter((b) => b.kind === "diagram")
  .map((b) => b.diagram);
const solution = (id: string) => {
  const s = solutions.find((s) => s.taskId === id);
  assert.ok(s, id);
  return s;
};
const task = (id: string) => {
  const t = tasks.find((t) => t.id === id);
  assert.ok(t, id);
  return t;
};
test("complete authored book has unique anchors and one reasoned key per learner task", () => {
  validateBook(book);
  assert.equal(tasks.length, 88);
  assert.equal(solutions.length, tasks.length);
  const ids = [
    ...book.pages.map((p) => p.id),
    ...tasks.map((t) => t.id),
    ...diagrams.map((d) => d.id),
  ];
  assert.equal(new Set(ids).size, ids.length);
  for (const t of tasks) {
    assert.equal(solutions.filter((s) => s.taskId === t.id).length, 1, t.id);
    assert.ok(solution(t.id).reasoning.length > 45);
  }
  assert.ok(solutions.every((s) => tasks.some((t) => t.id === s.taskId)));
  const keys = book.pages.filter((p) => p.kind === "solutions");
  assert.ok(keys.every((p) => p.blocks.length >= 2 && p.blocks.length <= 5));
  assert.ok(
    tasks.filter(
      (t) => t.response.kind === "blank" || t.response.kind === "grid",
    ).length >= 12,
  );
});
test("each task maps to real scoped curriculum and no mapping claims complete mastery", () => {
  validateEqualGroupsAlignments(skills, templates, standards);
  for (const t of tasks)
    assert.ok(
      equalGroupsAlignments.some((a) => a.taskIds.includes(t.id)),
      t.id,
    );
  for (const a of equalGroupsAlignments) {
    assert.ok(a.unassessedRequirements.length);
    assert.ok(a.scope.trim());
  }
  const sample = equalGroupsAlignments[0]!;
  for (const invalid of [
    { ...sample, skillId: "missing" },
    { ...sample, pageIds: ["missing"] },
    { ...sample, taskIds: ["absent"] },
    { ...sample, standardIds: ["3.OA.fake"] },
    { ...sample, standardIds: ["2.OA.C.3"] },
    { ...sample, templateIds: ["missing"] },
    { ...sample, templateIds: ["divide-facts"] },
    { ...sample, unassessedRequirements: [] },
  ])
    assert.throws(() =>
      validateEqualGroupsAlignments(skills, templates, standards, [invalid]),
    );
  assert.throws(() =>
    validateEqualGroupsAlignments(skills, templates, standards, [
      sample,
      sample,
    ]),
  );
});
test("array regions count every cell once and worked visual totals agree", () => {
  const expected: Record<string, number> = {
    "welcome-array": 12,
    "equal-groups-array": 12,
    "array-four-five": 20,
    "symbols-array": 12,
    "turn-array": 12,
    "double-array": 24,
    "split-five-array": 42,
    "nines-array": 54,
    "associative-array": 24,
    "area-unit-grid": 20,
    "area-split-grid": 42,
    "tens-array": 48,
    "share-array": 18,
    "measure-array": 18,
    "inverse-array": 24,
    "chunk-array": 84,
    "factor-array": 12,
    "prime-array": 7,
    "even-product-array": 12,
  };
  for (const d of diagrams) {
    assert.ok(d.caption.length > 20 && d.alt.length > 20, d.id);
    if (d.kind !== "array") continue;
    assert.equal(d.rows * d.columns, expected[d.id], d.id);
    const heights = d.splitAfterRow
      ? [d.splitAfterRow, d.rows - d.splitAfterRow]
      : [d.rows];
    const widths = d.splitAfterColumn
      ? [d.splitAfterColumn, d.columns - d.splitAfterColumn]
      : [d.columns];
    assert.ok(heights.every((n) => n > 0) && widths.every((n) => n > 0));
    assert.equal(
      heights
        .flatMap((h) => widths.map((w) => h * w))
        .reduce((a, b) => a + b, 0),
      d.rows * d.columns,
    );
  }
  const chunk = diagrams.find((d) => d.id === "chunk-array");
  assert.ok(chunk?.kind === "array");
  assert.equal(chunk.splitAfterColumn, 10);
  assert.match(chunk.rowLabel, /7 items per column/);
  assert.match(chunk.columnLabel, /12 groups/);
  const entry = diagrams.find((d) => d.id === "array-four-five");
  assert.ok(entry?.kind === "array");
  assert.ok(entry.rows <= 5 && entry.columns <= 5);
});
test("number-line jumps, integer groups, and proportional scales preserve public quantities", () => {
  for (const d of diagrams) {
    if (d.kind === "number-line") {
      assert.equal(d.min[0] / d.min[1], 0);
      assert.equal(d.max[0] / d.max[1], 20);
      assert.equal(d.integerLabelInterval, 5);
      assert.equal(d.jumps?.length, 4);
      d.jumps!.forEach((j, i) => {
        assert.equal(j.from[0] / j.from[1], i * 5);
        assert.equal(j.to[0] / j.to[1], (i + 1) * 5);
      });
    } else if (d.kind === "groups") {
      const n = d.total[0] / d.total[1],
        g = d.groupSize[0] / d.groupSize[1];
      assert.equal(d.unitDivisions, 1);
      assert.ok(Number.isInteger(n) && Number.isInteger(g));
      assert.deepEqual(
        [Math.floor(n / g), n % g],
        d.id === "pairs-model" ? [7, 1] : [3, 2],
      );
    } else if (d.kind === "double-line") {
      const nonzero = d.pairs.find((p) => p.top[0] !== 0)!;
      for (const p of d.pairs)
        assert.equal(
          p.bottom[0] * nonzero.top[0] * p.top[1] * nonzero.bottom[1],
          nonzero.bottom[0] * p.top[0] * p.bottom[1] * nonzero.top[1],
        );
    }
  }
});
test("public remainder stories produce different full-kit and capacity decisions", () => {
  const kit = task("boxes-full").prompt.match(
    /There are (\d+) beads.*exactly (\d+) beads/,
  )!;
  assert.ok(kit);
  const total = Number(kit[1]),
    size = Number(kit[2]);
  const quotient = Math.floor(total / size),
    remainder = total - size * quotient;
  assert.match(
    solution("boxes-full").answer,
    new RegExp(`^${quotient} complete kits, with ${remainder} beads left`),
  );
  const seats = task("seats-needed").prompt;
  assert.match(seats, /Twenty-nine/);
  const capacity = Number(seats.match(/seat (\d+) visitors/)![1]);
  assert.equal(total, 29);
  assert.equal(capacity, size);
  assert.match(
    solution("seats-needed").answer,
    new RegExp(`^${Math.ceil(total / capacity)} vans`),
  );
  assert.notEqual(Math.ceil(total / capacity), quotient);
  const repair = task("remainder-repair").prompt.match(
    /Repair (\d+) ÷ (\d+) = (\d+) remainder (\d+)/,
  )!;
  const n = Number(repair[1]),
    d = Number(repair[2]);
  assert.ok(Number(repair[4]) >= d);
  assert.match(
    solution("remainder-repair").answer,
    new RegExp(`${Math.floor(n / d)} remainder ${n % d}`),
  );
});
test("inventory transfer exhausts the allowed choices rather than accepting one convenient plan", () => {
  const p = book.pages.find((p) => p.id === "kit-design")!;
  const intro = p.blocks.find((b) => b.kind === "text")!;
  assert.ok(intro.kind === "text");
  const match = intro.text.match(
    /(\d+) stickers and (\d+) pencils.*between (\d+) and (\d+) identical/,
  )!;
  assert.ok(match);
  const [stickers, pencils, min, max] = match.slice(1).map(Number);
  const possibilities = Array.from(
    { length: max! - min! + 1 },
    (_, i) => i + min!,
  ).filter((n) => stickers! % n === 0 && pencils! % n === 0);
  assert.deepEqual(possibilities, [4, 8]);
  for (const n of possibilities) {
    assert.ok(
      solution("kit-plans").answer.includes(
        `${n} kits: ${stickers! / n} stickers and ${pencils! / n} pencils`,
      ),
    );
  }
  assert.deepEqual(
    possibilities.filter((n) => pencils! / n >= 4),
    [4],
  );
  assert.match(solution("kit-change").answer, /Only the 4-kit plan/);
});

import {
  equalGroupsPracticeBindings,
  validateEqualGroupsPracticeBindings,
} from "./practice.js";
test("practice support has exact template and book pages without grading explanations", () => {
  validateEqualGroupsPracticeBindings(templates);
  assert.deepEqual(
    equalGroupsPracticeBindings.map((b) => b.templateId).sort(),
    ["divide-facts", "multiply-facts", "rectangle-area"],
  );
  const first = equalGroupsPracticeBindings[0]!;
  for (const b of [
    { ...first, bookId: "missing" },
    { ...first, pageIds: ["missing"] },
    { ...first, skillId: "division-facts" },
    { ...first, templateId: "missing" },
    { ...first, unassessedRequirements: [] },
    { ...first, practiceScope: "" },
  ])
    assert.throws(() => validateEqualGroupsPracticeBindings(templates, [b]));
  assert.throws(() =>
    validateEqualGroupsPracticeBindings(templates, [first, first]),
  );
});
