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

test("every practiced skill has at least three next steps and two foundations", () => {
  const practiced = new Set(templates.map((t) => t.skillId));
  const leadsTo = new Map<string, Set<string>>();
  const buildsOn = new Map<string, Set<string>>();
  const link = (from: string, to: string) => {
    for (const [map, key, value] of [
      [leadsTo, from, to],
      [buildsOn, to, from],
    ] as const) {
      if (!map.has(key)) map.set(key, new Set());
      map.get(key)!.add(value);
    }
  };
  for (const skill of skills)
    for (const id of skill.prerequisites) link(id, skill.id);
  for (const { from, to } of curriculumConnections) link(from, to);
  // Entry skills with nothing honestly earlier; each lists the foundations it has.
  const fewerFoundations = new Map<string, number>([
    ["count-to-20", 0], // counting is the first skill; no skill precedes it
    ["compare-attributes", 0], // the first measurement idea; nothing precedes it
    ["name-shapes", 1], // only comparing attributes precedes naming shapes
  ]);
  const leadsToShort = [...practiced].filter(
    (id) => (leadsTo.get(id)?.size ?? 0) < 3,
  );
  const buildsOnShort = [...practiced].filter(
    (id) => (buildsOn.get(id)?.size ?? 0) < 2 && !fewerFoundations.has(id),
  );
  assert.deepEqual(leadsToShort, []);
  assert.deepEqual(buildsOnShort, []);
  for (const [id, count] of fewerFoundations)
    assert.equal(
      buildsOn.get(id)?.size ?? 0,
      count,
      `${id} has gained foundations; remove it from the exception list`,
    );
});

test("editorial connections never contradict the prerequisite order", () => {
  const byId = new Map(skills.map((s) => [s.id, s]));
  const reaches = (from: string, target: string, seen = new Set<string>()) => {
    for (const p of byId.get(from)!.prerequisites) {
      if (p === target) return true;
      if (!seen.has(p) && (seen.add(p), reaches(p, target, seen))) return true;
    }
    return false;
  };
  for (const { from, to } of curriculumConnections) {
    assert(!reaches(from, to), `${from} already builds on ${to}`);
    assert(
      !byId.get(to)!.prerequisites.includes(from),
      `${from} → ${to} duplicates a prerequisite`,
    );
  }
});
