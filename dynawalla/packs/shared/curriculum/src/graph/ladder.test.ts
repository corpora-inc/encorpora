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
  SKILL_LONG_MULTIPLICATION,
  SKILL_TABLES_TO_TWELVE,
  SKILL_TABLES_WITHIN_FIVE,
  SKILL_TIMES_ONE_DIGIT,
  SKILL_TIMES_TWO_DIGIT,
} from "./domains/mul.ts";
import { SKILL_DIVIDE_EXACT, SKILL_DIVISION_FACTS } from "./domains/div.ts";
import { SKILL_ADD_SIGNED, SKILL_MULTIPLY_SIGNED, SKILL_PAST_ZERO } from "./domains/int.ts";
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

  // Every addition fact is below every column item, with no overlap. The two
  // families are a ladder and not two ladders side by side.
  //
  // Scoped to `add` since the multiplicative strand arrived. `dw.mul.facts.*` is
  // also a `facts` cluster and it sits *above* two-digit column addition, which is
  // correct — a times-table fact is grade-3 content and `43 + 25` is grade 1 — and
  // would break an unscoped reading of this claim. The claim was always about the
  // additive ladder; the multiplicative one has its own assertion below.
  const additive = ACTIVE.filter((node) => node.domain === "add");
  const factLevels = additive.filter((node) => node.cluster === "facts").flatMap((node) => node.difficulty.levels);
  const columnLevels = additive.filter((node) => node.cluster !== "facts").flatMap((node) => node.difficulty.levels);
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

/**
 * The strands above the addition spine, asserted over the **whole** graph rather
 * than over the active part of it.
 *
 * Every row named here is `draft` — see `promotionBlockers.ts` — so an assertion
 * scoped to `activeNodes()` would pass on an empty set and go on passing after
 * they are promoted with the edges cut. The claim is about the mathematics, which
 * does not wait for a renderer.
 */
const ALL_BY_ID = new Map<string, (typeof allNodes)[number]>(allNodes.map((node) => [String(node.id), node]));

/** Everything `id` transitively requires, across the whole graph. */
function requiresAll(id: SkillId): Set<string> {
  const seen = new Set<string>();
  const stack = [String(id)];
  while (stack.length > 0) {
    const current = stack.pop();
    if (current === undefined) continue;
    for (const edge of ALL_BY_ID.get(current)?.prereqs ?? []) {
      if (!ORDERING_KINDS.includes(edge.kind)) continue;
      if (seen.has(String(edge.to))) continue;
      seen.add(String(edge.to));
      stack.push(String(edge.to));
    }
  }
  return seen;
}

test("the multiplicative strand climbs from the tables, and the tables climb from the facts", () => {
  const requires = (from: SkillId, to: SkillId): void => {
    assert.ok(requiresAll(from).has(String(to)), `${from} should sit above ${to} and does not`);
  };

  // The mathematics, in edges. A single-digit pass of a written multiplication is
  // a table fact and a carry; a long division picks its quotient digits out of a
  // table; a table fact is reached by skip counting, which crosses ten.
  requires(SKILL_TABLES_WITHIN_FIVE, SKILL_ADD_ACROSS_TEN);
  requires(SKILL_TABLES_TO_TWELVE, SKILL_TABLES_WITHIN_FIVE);
  requires(SKILL_TIMES_ONE_DIGIT, SKILL_TABLES_TO_TWELVE);
  requires(SKILL_TIMES_TWO_DIGIT, SKILL_TIMES_ONE_DIGIT);
  requires(SKILL_LONG_MULTIPLICATION, SKILL_TIMES_TWO_DIGIT);
  requires(SKILL_DIVISION_FACTS, SKILL_TABLES_TO_TWELVE);
  requires(SKILL_DIVIDE_EXACT, SKILL_DIVISION_FACTS);
  // And the whole strand still stands on the floor the addition rows are.
  requires(SKILL_LONG_MULTIPLICATION, SKILL_ADD_WITHIN_TEN);
  requires(SKILL_DIVIDE_EXACT, SKILL_ADD_WITHIN_TEN);

  // The integer strand, which is where pre-algebra starts.
  requires(SKILL_PAST_ZERO, SKILL_SUBTRACT_ACROSS_TEN);
  requires(SKILL_ADD_SIGNED, SKILL_PAST_ZERO);
  requires(SKILL_MULTIPLY_SIGNED, SKILL_TABLES_TO_TWELVE);
});

test("every table fact is below every written multiplication, and the strands do not overlap", () => {
  const levelsOf = (id: SkillId): readonly { readonly n: bigint; readonly d: bigint }[] =>
    ALL_BY_ID.get(String(id))?.difficulty.levels ?? [];
  const hardest = (ids: readonly SkillId[]) =>
    ids.flatMap(levelsOf).reduce((high, current) => (cmp(current, high) > 0 ? current : high));
  const easiest = (ids: readonly SkillId[]) =>
    ids.flatMap(levelsOf).reduce((low, current) => (cmp(current, low) < 0 ? current : low));

  const tables = hardest([SKILL_TABLES_WITHIN_FIVE, SKILL_TABLES_TO_TWELVE]);
  const written = easiest([SKILL_TIMES_ONE_DIGIT, SKILL_TIMES_TWO_DIGIT, SKILL_LONG_MULTIPLICATION]);
  assert.ok(
    cmp(tables, written) < 0,
    `the hardest table fact ${ratToString(tables)} is not below the easiest written multiplication ${ratToString(written)}`,
  );

  // And the top of the arithmetic spine is the top of this strand: the hardest
  // item in `add`, `mul` and `div` together is `48,826 × 82,726`. Not the hardest
  // in the graph — `dw.frac.*` reaches further and should, since a fraction row is
  // grade-5 content standing on all of this — so the claim is scoped to the three
  // whole-number domains rather than overstated.
  const spine = allNodes
    .filter((node) => ["add", "mul", "div"].includes(node.domain))
    .flatMap((node) => node.difficulty.levels.map((b) => ({ node, b })));
  const highest = spine.reduce((high, current) => (cmp(current.b, high.b) > 0 ? current : high));
  assert.equal(
    String(highest.node.id),
    String(SKILL_LONG_MULTIPLICATION),
    `the hardest whole-number item belongs to ${highest.node.id} at ${ratToString(highest.b)}`,
  );
  assert.equal(highest.b, ALL_BY_ID.get(String(SKILL_LONG_MULTIPLICATION))?.difficulty.levels[2]);
});
