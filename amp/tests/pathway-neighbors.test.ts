import assert from "node:assert/strict";
import test from "node:test";
import { skillNeighbors } from "../src/web/features/pathways/neighbors";
import { answerPathways } from "../src/web/features/practice/answer-pathways";
import { skills as catalogSkills } from "../src/curriculum/catalog";

const link = (
  skillId: string,
  kind: "extension" | "application" | "related",
  direction: "forward" | "backward",
) => ({ skillId, kind, direction, explanation: `${skillId} ${kind}` });
const graph = [
  {
    id: "hub",
    gradeBand: "4",
    prerequisites: ["pre"],
    connections: [
      link("far-next", "application", "forward"),
      link("near-next", "extension", "forward"),
      link("near-app", "application", "forward"),
      link("old", "extension", "backward"),
      link("peer", "related", "forward"),
      link("dep", "extension", "forward"),
    ],
  },
  { id: "pre", title: "pre", gradeBand: "3", prerequisites: [] },
  { id: "dep", title: "dep", gradeBand: "5", prerequisites: ["hub"] },
  { id: "far-next", title: "far-next", gradeBand: "8", prerequisites: [] },
  { id: "near-next", title: "near-next", gradeBand: "5", prerequisites: [] },
  { id: "near-app", title: "near-app", gradeBand: "5", prerequisites: [] },
  { id: "old", title: "old", gradeBand: "K", prerequisites: [] },
  { id: "peer", title: "peer", gradeBand: "4", prerequisites: [] },
];

test("strict edges lead each list, then connections by grade proximity and kind", () => {
  const n = skillNeighbors(graph, "hub");
  assert.deepEqual(
    n.buildsOn.map((i) => [i.skill.id, i.source]),
    [
      ["pre", "prerequisite"],
      ["old", "connection"],
    ],
  );
  assert.deepEqual(
    n.leadsTo.map((i) => i.skill.id),
    ["dep", "near-next", "near-app", "far-next"],
  );
  assert.deepEqual(
    n.related.map((i) => i.skill.id),
    ["peer"],
  );
});

test("a connection duplicating a prerequisite edge appears once, as the prerequisite", () => {
  const n = skillNeighbors(graph, "hub");
  assert.equal(n.leadsTo.filter((i) => i.skill.id === "dep").length, 1);
  assert.equal(n.leadsTo[0]!.connection, undefined);
});

test("every authored catalog connection is reachable from both endpoints", () => {
  for (const skill of catalogSkills) {
    const n = skillNeighbors(catalogSkills, skill.id);
    const shown = new Set(
      [...n.buildsOn, ...n.leadsTo, ...n.related].map((i) => i.skill.id),
    );
    for (const connection of skill.connections ?? [])
      assert(
        shown.has(connection.skillId),
        `${skill.id} hides ${connection.skillId}`,
      );
  }
});

test("answer feedback adds the nearest connections without displacing strict edges", () => {
  const templates = graph.map((s) => ({ id: s.id + "-p", skillId: s.id }));
  const paths = answerPathways("hub", graph, templates);
  assert.deepEqual(
    paths.leadsTo.map((s) => s.id),
    ["dep", "near-next", "near-app", "far-next"],
  );
  assert.equal(paths.leadsTo[1]!.connected?.label, "Extend the idea");
  assert.equal(paths.leadsTo[0]!.connected, undefined);
  assert.deepEqual(
    paths.buildsOn.map((s) => s.id),
    ["pre", "old"],
  );
  const noTemplates = answerPathways("hub", graph, [
    { id: "x", skillId: "dep" },
  ]);
  assert.deepEqual(
    noTemplates.leadsTo.map((s) => s.id),
    ["dep"],
  );
});
