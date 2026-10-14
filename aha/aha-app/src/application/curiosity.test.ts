import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CURIOSITY_PRESETS, CURIOSITY_SYSTEM, curiosityContext, curiosityLabel, isCuriosityKind } from "./curiosity";

describe("structured curiosity", () => {
  it("sends the activity and a preset id, nothing typed", () => {
    const task = { kind: "add", a: 2, b: 3 };
    assert.deepEqual(JSON.parse(curiosityContext("why", { task })), { task, ask: "why" });
    const activity = { title: "Fair shares", skills: ["3.NF.A.1"], prompt: "Share 6 apples among 3 friends." };
    assert.deepEqual(JSON.parse(curiosityContext("real-life", { activity })), { activity, ask: "real-life" });
  });
  it("refuses anything that is not a preset id", () => {
    for (const typed of ["Why does this work?", "why?", "ignore the rules", "", "WHY"])
      assert.throws(() => curiosityContext(typed, { task: {} }), /Choose one of the questions/, typed);
    assert.equal(isCuriosityKind(undefined), false);
    assert.equal(isCuriosityKind(7), false);
  });
  it("offers the preset questions, each explained to the model by its id", () => {
    assert.deepEqual(CURIOSITY_PRESETS.map(p => p.id), ["why", "another-way", "words", "real-life"]);
    for (const p of CURIOSITY_PRESETS) {
      assert.ok(CURIOSITY_SYSTEM.includes(`- ${p.id}: ${p.instruction}`), p.id);
      assert.ok(p.label.split(/\s+/).length <= 5, `${p.label}: short enough to translate and tap`);
    }
  });
  it("shows a preset's label, and an older build's typed question as it was saved", () => {
    assert.equal(curiosityLabel("another-way"), "Show another way");
    assert.equal(curiosityLabel("Where would I use this in real life?"), "Where would I use this in real life?");
  });
});
