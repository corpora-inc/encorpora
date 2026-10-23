import test from "node:test";
import assert from "node:assert/strict";
import { skills } from "../src/curriculum/catalog";
import {
  crystal,
  layout,
  frontierRange,
  connections,
  previewEvidence,
} from "../src/web/features/pathways/model";

test("crystal growth survives a miss and a retrieval streak reset", () => {
  const before = {
    skillId: "test",
    attempts: 20,
    independentCorrect: 20,
    independentOccasions: 5,
    status: "review-ready" as const,
    reviewDueAt: null,
  };
  const after = {
    ...before,
    attempts: 21,
    independentOccasions: 0,
    status: "practicing" as const,
  };
  assert.equal(crystal(before).stage, 3);
  assert.equal(crystal(after).stage, 3);
  assert.equal(crystal(after).strong, false);
  assert.equal(crystal(undefined).stage, 0);
});
test("catalog layout is deterministic, finite, collision free, independent of input order", () => {
  const positions = layout(skills);
  assert.equal(
    new Set(positions.map((p) => p.position.join(","))).size,
    skills.length,
  );
  const reversed = new Map(
    layout([...skills].reverse()).map((p) => [p.skill.id, p.position]),
  );
  for (const node of positions) {
    assert(node.position.every(Number.isFinite));
    assert.deepEqual(node.position, reversed.get(node.skill.id));
  }
});
test("frontier ranges use independent area estimates and omit unmeasured areas", () => {
  const overall = { level: 7, sd: 0.5, answered: 10, independent: 8 };
  const frontier = {
    expected: 4,
    overall,
    strands: { algebra: { ...overall, level: 9, sd: 1 } },
  };
  assert.deepEqual(frontierRange(frontier, "algebra"), {
    level: 9,
    lo: 7.36,
    hi: 10.64,
  });
  assert.equal(frontierRange(frontier, "geometry"), null);
  assert.equal(
    frontierRange({ ...frontier, overall: { ...overall, answered: 0 } }),
    null,
  );
});

test("highlighted paths cross neighborhoods and do not invent prerequisite credit", () => {
  const target = skills.find((s) => s.id === "nonlinear-systems")!;
  const paths = connections(skills, target.id);
  for (const id of target.prerequisites) assert(paths.prerequisites.has(id));
  assert(!paths.prerequisites.has(target.id));
  assert(!paths.dependents.has(target.id));
  const evidence = previewEvidence(skills);
  assert(evidence.length > 0 && evidence.length < skills.length);
  assert(evidence.every((e) => e.independentCorrect > 0));
  assert.deepEqual(evidence, previewEvidence(skills));
});
