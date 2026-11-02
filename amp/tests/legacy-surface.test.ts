import { test } from "node:test";
import assert from "node:assert/strict";
import { generateProblem } from "../src/math/engine";
import { legacySurface } from "./fixtures/legacy-surface";

test("a legacy-surface digest ignores teaching text and keeps what is graded", () => {
  const p = generateProblem("right-triangle", "legacy:0");
  const same = (q: typeof p) =>
    JSON.stringify(legacySurface(q)) === JSON.stringify(legacySurface(p));
  assert.ok(same({ ...p, explanation: ["Rewritten."], hint: "Rewritten." }));
  assert.ok(same({ ...p, choiceFeedback: { a: "Rewritten." } }));
  assert.ok(!same({ ...p, answer: `${p.answer}1` }));
  assert.ok(!same({ ...p, public: { ...p.public, prompt: "Changed." } }));
  for (const key of ["variant", "explanation", "hint", "choiceFeedback"])
    assert.ok(!(key in legacySurface(p)), key);
});
