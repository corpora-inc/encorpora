/**
 * The shipped ladder: one connected climb from `0 + 1` to four-digit column work.
 *
 * The gates check the graph's *integrity* — acyclic, no dangling edge, every
 * consumed capability provided somewhere upstream. None of them checks the thing
 * a game actually needs, which is that `activeNodes()` is a ladder: a single
 * rooted chain with a bottom rung a five-year-old can stand on, ordered so that
 * walking it never puts a skill before its own prerequisites.
 *
 * That property has to be a test rather than a comment because it is what an
 * adaptive controller walks in both directions. Before the fact rows the active
 * graph had **two** roots, both of them two-digit column arithmetic, and a child
 * who slid to the bottom landed on `43 + 25` and could go no further down. That
 * failure was invisible to every gate in the set: the graph was perfectly valid,
 * it simply had no floor.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { activeNodes, allNodes } from "./graph.ts";
import {
  SKILL_ADD_ACROSS_TEN,
  SKILL_ADD_MULTIDIGIT,
  SKILL_ADD_NO_REGROUP,
  SKILL_ADD_WITHIN_TEN,
  SKILL_SUBTRACT_ACROSS_TEN,
  SKILL_SUBTRACT_MULTIDIGIT,
  SKILL_SUBTRACT_NO_REGROUP,
  SKILL_SUBTRACT_WITHIN_TEN,
} from "./domains/add.ts";
import { cmp, toString as ratToString } from "../math/rational.ts";
import type { SkillId } from "../types/ids.ts";

const ORDERING_KINDS = ["requires", "extends"];
const ACTIVE = activeNodes(allNodes);
const ACTIVE_IDS = new Set<string>(ACTIVE.map((node) => String(node.id)));

/** Everything `id` transitively requires, within the active graph. */
function ancestorsOf(id: SkillId): Set<string> {
  const seen = new Set<string>();
  const stack = [String(id)];
  while (stack.length > 0) {
    const current = stack.pop();
    if (current === undefined) continue;
    const node = ACTIVE.find((candidate) => String(candidate.id) === current);
    for (const edge of node?.prereqs ?? []) {
      if (!ORDERING_KINDS.includes(edge.kind)) continue;
      if (seen.has(String(edge.to))) continue;
      seen.add(String(edge.to));
      stack.push(String(edge.to));
    }
  }
  return seen;
}

test("the active graph has exactly one root, and it is the number facts", () => {
  const roots = ACTIVE.filter(
    (node) => !node.prereqs.some((edge) => ORDERING_KINDS.includes(edge.kind) && ACTIVE_IDS.has(String(edge.to))),
  );
  assert.deepEqual(
    roots.map((node) => String(node.id)),
    [String(SKILL_ADD_WITHIN_TEN)],
    "the shipped graph does not have a single entry point",
  );
});

test("every active skill climbs from the root, so nothing is stranded above the floor", () => {
  for (const node of ACTIVE) {
    if (String(node.id) === String(SKILL_ADD_WITHIN_TEN)) continue;
    assert.ok(
      ancestorsOf(node.id).has(String(SKILL_ADD_WITHIN_TEN)),
      `${node.id} does not transitively require ${SKILL_ADD_WITHIN_TEN}: a child reaching it has no route down`,
    );
  }
});

test("the ladder's named rungs are wired the way the mathematics runs", () => {
  const requires = (from: SkillId, to: SkillId): void => {
    assert.ok(
      ancestorsOf(from).has(String(to)),
      `${from} should sit above ${to} and does not`,
    );
  };

  // The column rows sit above the facts they are made of, and this is the whole
  // point of the change: a carry is a sum across ten and a borrow is a difference
  // across ten, so the multi-digit rows cannot be reached without the fact rows.
  requires(SKILL_ADD_NO_REGROUP, SKILL_ADD_WITHIN_TEN);
  requires(SKILL_SUBTRACT_NO_REGROUP, SKILL_SUBTRACT_WITHIN_TEN);
  requires(SKILL_ADD_MULTIDIGIT, SKILL_ADD_ACROSS_TEN);
  requires(SKILL_SUBTRACT_MULTIDIGIT, SKILL_SUBTRACT_ACROSS_TEN);
  // And the two-digit rows are still above the facts they always needed.
  requires(SKILL_ADD_MULTIDIGIT, SKILL_ADD_WITHIN_TEN);
  requires(SKILL_SUBTRACT_MULTIDIGIT, SKILL_SUBTRACT_WITHIN_TEN);
});

test("activeNodes() is already in prerequisite order, which is the order games walk", () => {
  // A game reads the list the host hands it and does not topologically sort. A row
  // appearing before its own prerequisite would reorder difficulty everywhere at
  // once, silently, for every pack — so the order is asserted rather than assumed.
  const position = new Map<string, number>(ACTIVE.map((node, index) => [String(node.id), index]));
  ACTIVE.forEach((node, index) => {
    for (const edge of node.prereqs) {
      if (!ORDERING_KINDS.includes(edge.kind)) continue;
      const at = position.get(String(edge.to));
      if (at === undefined) continue;
      assert.ok(
        at < index,
        `${node.id} is at ${String(index)} and its prerequisite ${edge.to} is at ${String(at)}`,
      );
    }
  });
});

test("the bottom rung is a number fact, and it is well below the column work", () => {
  const levels = ACTIVE.flatMap((node) => node.difficulty.levels.map((b) => ({ node, b })));
  const easiest = levels.reduce((low, current) => (cmp(current.b, low.b) < 0 ? current : low));
  assert.equal(
    String(easiest.node.id),
    String(SKILL_ADD_WITHIN_TEN),
    `the easiest active item belongs to ${easiest.node.id} at ${ratToString(easiest.b)}`,
  );
  assert.equal(ratToString(easiest.b), "-3", "the root rung is not where the level table puts it");

  // Every fact item is below every column item, with no overlap. The two families
  // are a ladder and not two ladders side by side.
  const factLevels = ACTIVE.filter((node) => node.cluster === "facts").flatMap((node) => node.difficulty.levels);
  const columnLevels = ACTIVE.filter((node) => node.cluster !== "facts").flatMap((node) => node.difficulty.levels);
  assert.ok(factLevels.length >= 14 && columnLevels.length >= 13);
  const hardestFact = factLevels.reduce((high, current) => (cmp(current, high) > 0 ? current : high));
  const easiestColumn = columnLevels.reduce((low, current) => (cmp(current, low) < 0 ? current : low));
  assert.ok(
    cmp(hardestFact, easiestColumn) < 0,
    `the hardest fact item ${ratToString(hardestFact)} is not below the easiest column item ${ratToString(easiestColumn)}`,
  );
});

test("the fact rows are active, because a draft floor is not a floor", () => {
  for (const id of [
    SKILL_ADD_WITHIN_TEN,
    SKILL_SUBTRACT_WITHIN_TEN,
    SKILL_ADD_ACROSS_TEN,
    SKILL_SUBTRACT_ACROSS_TEN,
  ]) {
    const node = allNodes.find((candidate) => candidate.id === id);
    assert.ok(node !== undefined, `${id} is missing from the graph`);
    assert.equal(node.status, "active", `${id} is ${node.status}: a controller walking activeNodes() cannot reach it`);
  }
});
