import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { openFixture, type RawPack } from "./fixture.ts";
import { rationaleProblem, rationaleProblems } from "./rationale.ts";

const e = openFixture(JSON.parse(readFileSync(new URL("./fixture/pack.json", import.meta.url), "utf8")) as RawPack);

test("placeholder reasons fail the content rule", () => {
  for (const bad of ["", "Correct.", "Correct", "Correct. Up to 50 kV: 10 feet.", "Incorrect. The rule says otherwise here.", "Not listed.", "Not as stated."]) {
    assert.ok(rationaleProblem(bad), bad);
  }
  assert.equal(rationaleProblem("Lines up to 50 kV need 10 feet of clearance under Table A."), null);
  const note = "Over 350 kV the same test uses 50 feet.";
  assert.deepEqual(rationaleProblems({ q_id: "x", choices: ["a", "b"], rationales: ["The same reason for both choices here.", "The same reason for both choices here."], note }), ["x: two choices share a reason"]);
  assert.deepEqual(rationaleProblems({ q_id: "y", choices: ["a"], rationales: ["A real reason that is long enough."] }), ["y note: empty"]);
});

test("every practice question in the fixture has a real reason for every choice and a note", () => {
  // The raw rows, not the engine's list: the engine hides items that fail, which would hide a regression here.
  const rows = (JSON.parse(readFileSync(new URL("./fixture/pack.json", import.meta.url), "utf8")) as RawPack).question;
  assert.equal(e.questions.length, rows.length, "the engine hides no fixture item");
  for (const r of rows) {
    const q = { q_id: String(r.q_id), choices: JSON.parse(String(r.choices)) as string[], rationales: JSON.parse(String(r.rationales)) as string[], note: (r.note as string | null) ?? null };
    assert.deepEqual(rationaleProblems(q), [], q.q_id);
  }
});
