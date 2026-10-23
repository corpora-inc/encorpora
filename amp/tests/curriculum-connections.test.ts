import test from "node:test";
import assert from "node:assert/strict";
import { skills } from "../src/curriculum/catalog";
import { templates } from "../src/math/engine";
import {
  auditConnectionEvidence,
  curriculumConnections,
} from "../src/curriculum/connections";

test("authored connections cite real endpoint problem families and expose their inverse", () => {
  assert.deepEqual(auditConnectionEvidence(skills, templates), []);
  for (const edge of curriculumConnections) {
    const from = skills.find((s) => s.id === edge.from)!;
    const to = skills.find((s) => s.id === edge.to)!;
    const forward = from.connections!.find((c) => c.skillId === to.id)!;
    const backward = to.connections!.find((c) => c.skillId === from.id)!;
    assert.equal(forward.direction, "forward");
    assert.equal(backward.direction, "backward");
    assert.equal(forward.kind, backward.kind);
    assert.equal(forward.explanation, backward.explanation);
    assert.deepEqual(forward.templateIds, backward.templateIds);
  }
});

test("connection audit rejects missing/self endpoints, duplicate edges and unrelated evidence", () => {
  const first = curriculumConnections[0]!;
  for (const mutation of [
    [{ ...first, to: "missing" }],
    [{ ...first, to: first.from }],
    [first, { ...first, from: first.to, to: first.from }],
    [{ ...first, templateIds: [] }],
    [{ ...first, templateIds: ["missing"] }],
    [{ ...first, templateIds: ["event-set-count"] }],
    [{ ...first, explanation: " " }],
  ])
    assert(auditConnectionEvidence(skills, templates, mutation).length > 0);
});
