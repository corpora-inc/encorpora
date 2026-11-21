import { test } from "node:test";
import assert from "node:assert/strict";
import {
  generateProblem,
  gradeAnswer,
  isValidResponse,
  normalizeAnswer,
  templates,
} from "../src/math/engine";
import { acceptedAnswer } from "../src/math/answer-format";
import { checkEntry, type WorkField } from "../src/math/structured-work";
import { ungroupThousands } from "../src/math/thousands";
import type { GeneratedProblem } from "../src/math/contracts";

/** A real number-kind problem whose key is `answer`, as the server holds it. */
function numberProblem(answer: string): GeneratedProblem {
  const base = generateProblem("make-hundred", "thousands", 1);
  assert.equal(base.public.response.kind, "number");
  return { ...base, answer };
}

const right = [
  "29,674",
  "1,234,567",
  "1,234.5",
  "-1,234",
  "+1,000",
  "999,999.25",
];
const malformed = [
  "29,67",
  "2,9674",
  "1,23,456",
  ",500",
  "1,,000",
  "1,000,",
  "1,0000",
  "1 ,000",
  "1,234,5",
  "1,2345.6",
  "0,5",
  "1.234,5",
];

test("the classroom case: 21,986 + 7,688 accepts 29,674 and 29674, in the entry check and the server", () => {
  const p = numberProblem("29674");
  for (const typed of ["29,674", "29674", " 29,674 "]) {
    assert.equal(acceptedAnswer(typed), true, typed);
    assert.equal(isValidResponse(p.public, typed), true, typed);
    assert.equal(gradeAnswer(p, typed), true, typed);
  }
  assert.equal(gradeAnswer(p, "29,675"), false);
});

test("correctly placed separators are the number they spell", () => {
  for (const typed of right) {
    const plain = typed.replaceAll(",", "").replace(/^\+/, "");
    assert.equal(acceptedAnswer(typed), true, typed);
    assert.equal(
      normalizeAnswer(ungroupThousands(typed)),
      normalizeAnswer(plain),
    );
    const p = numberProblem(plain);
    assert.equal(isValidResponse(p.public, typed), true, typed);
    assert.equal(gradeAnswer(p, typed), true, typed);
  }
  const half = numberProblem("1234.5");
  assert.equal(gradeAnswer(half, "1,234.5"), true);
  assert.equal(gradeAnswer(half, "1,234.6"), false);
});

test("a malformed grouping is never read as a number: it is invalid, so the learner is asked again", () => {
  for (const typed of malformed) {
    assert.equal(ungroupThousands(typed), typed, typed);
    assert.equal(acceptedAnswer(typed), false, typed);
    // The same path as any other unparseable text: invalid, not graded wrong.
    const p = numberProblem(typed.replaceAll(",", "").replace(/\s/g, ""));
    assert.equal(isValidResponse(p.public, typed), false, typed);
    assert.equal(gradeAnswer(p, typed), false, typed);
  }
});

test("a comma is not a decimal comma and fractions keep their meaning", () => {
  assert.equal(acceptedAnswer("3,5"), false);
  assert.equal(acceptedAnswer("0,5"), false);
  assert.equal(gradeAnswer(numberProblem("35"), "3,5"), false);
  assert.equal(gradeAnswer(numberProblem("5"), "0,5"), false);
  assert.equal(acceptedAnswer("1,234/5"), false);
  assert.equal(acceptedAnswer("3/4"), true);
  assert.equal(acceptedAnswer("-3.5"), true);
  assert.equal(acceptedAnswer(".5"), true);
});

test("the answer key is not rewritten: only the learner's entry is ungrouped", () => {
  assert.equal(gradeAnswer(numberProblem("1,234"), "1,234"), false);
  assert.equal(gradeAnswer(numberProblem("1,234"), "1234"), false);
});

test("structured-work number fields take grouping; other entries keep their comma", () => {
  const field = { kind: "number" } as unknown as WorkField;
  const r = {} as Parameters<typeof checkEntry>[0];
  assert.deepEqual(checkEntry(r, field, "1,234"), { ok: true, value: "1234" });
  assert.deepEqual(checkEntry(r, field, "1,234.5"), {
    ok: true,
    value: "1234.5",
  });
  assert.equal(checkEntry(r, field, "1,23").ok, false);
  assert.equal(checkEntry(r, field, "3,5").ok, false);
});

test("every answer kind where a comma means something else behaves as before: comma text is never valid or right", () => {
  const strings = [...right, ...malformed, "(2,3)", "1,2,3", "[1,5)", "{1,2}"];
  const seen = new Set<string>();
  for (const t of templates) {
    let p: GeneratedProblem;
    try {
      p = generateProblem(t.id, "comma", 1);
    } catch {
      continue;
    }
    const kind = p.public.response.kind;
    if (kind === "number" || kind === "fraction") continue;
    seen.add(kind);
    for (const typed of strings) {
      assert.equal(isValidResponse(p.public, typed), false, `${t.id} ${typed}`);
      assert.equal(gradeAnswer(p, typed), false, `${t.id} ${typed}`);
    }
  }
  for (const kind of [
    "choice",
    "multi-select",
    "point-plot",
    "structured-work",
  ])
    assert.ok(seen.has(kind), kind);
});
