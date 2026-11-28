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
  assert.deepEqual(rationaleProblems({ q_id: "x", choices: ["a", "b"], rationales: ["The same reason for both choices here.", "The same reason for both choices here."] }), ["x: two choices share a reason"]);
});

test("every practice question in the pack has a real reason for every choice", () => {
  assert.ok(e.questions.length > 0);
  for (const q of e.questions) if (q.kind === "mc") assert.deepEqual(rationaleProblems(q), [], q.q_id);
});
