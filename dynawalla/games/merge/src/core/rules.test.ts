import { test } from "node:test";
import assert from "node:assert/strict";
import {
  COLS,
  ROWS,
  applyGravity,
  boardValues,
  cascade,
  dropRow,
  emptyBoard,
  fillRatio,
  findGroups,
  groupScore,
  idx,
  planDrop,
  previewFuse,
  riseBoard,
  selectGroups,
  strandedTiles,
  type Board,
  type CoreTile,
} from "./rules.ts";

let nextId = 1;
const T = (value: number): CoreTile => ({ id: nextId++, value });

function put(b: Board, r: number, c: number, value: number): CoreTile {
  const t = T(value);
  b[idx(r, c)] = t;
  return t;
}

test("dropRow finds the floor and then stacks", () => {
  const b = emptyBoard();
  assert.equal(dropRow(b, 0), ROWS - 1);
  put(b, ROWS - 1, 0, 3);
  assert.equal(dropRow(b, 0), ROWS - 2);
  for (let r = 0; r < ROWS; r++) b[idx(r, 1)] = T(1);
  assert.equal(dropRow(b, 1), -1);
});

test("a horizontal pair summing to the key is a group", () => {
  const b = emptyBoard();
  put(b, ROWS - 1, 0, 3);
  put(b, ROWS - 1, 1, 7);
  const g = findGroups(b, 10);
  assert.equal(g.length, 1);
  assert.equal(g[0]!.cells.length, 2);
  assert.equal(g[0]!.sum, 10);
});

test("a vertical pair summing to the key is a group", () => {
  const b = emptyBoard();
  put(b, ROWS - 1, 2, 4);
  put(b, ROWS - 2, 2, 6);
  assert.equal(findGroups(b, 10).length, 1);
});

test("diagonal neighbours never fuse", () => {
  const b = emptyBoard();
  put(b, ROWS - 1, 0, 4);
  put(b, ROWS - 2, 1, 6);
  assert.equal(findGroups(b, 10).length, 0);
});

test("a connected triple summing to the key is a group", () => {
  const b = emptyBoard();
  put(b, ROWS - 1, 0, 3);
  put(b, ROWS - 1, 1, 3);
  put(b, ROWS - 1, 2, 4);
  const gs = findGroups(b, 10);
  const triples = gs.filter((g) => g.cells.length === 3);
  assert.equal(triples.length, 1);
  assert.equal(triples[0]!.sum, 10);
});

test("an L-shaped triple counts, a disconnected trio does not", () => {
  const b = emptyBoard();
  put(b, ROWS - 1, 0, 2);
  put(b, ROWS - 1, 1, 3);
  put(b, ROWS - 2, 1, 5);
  assert.equal(
    findGroups(b, 10).filter((g) => g.cells.length === 3).length,
    1,
  );

  const d = emptyBoard();
  put(d, ROWS - 1, 0, 2);
  put(d, ROWS - 1, 2, 3);
  put(d, ROWS - 1, 4, 5);
  assert.equal(findGroups(d, 10).length, 0);
});

test("groups are deduplicated by tile identity", () => {
  const b = emptyBoard();
  put(b, ROWS - 1, 1, 5);
  put(b, ROWS - 1, 0, 2);
  put(b, ROWS - 1, 2, 3);
  const gs = findGroups(b, 10);
  const sigs = new Set(gs.map((g) => g.ids.join(",")));
  assert.equal(sigs.size, gs.length);
});

test("selectGroups prefers triples and never overlaps", () => {
  const b = emptyBoard();
  // 3 | 3 | 4  -> the triple (10) and the pair 3+... nothing else
  put(b, ROWS - 1, 0, 6);
  put(b, ROWS - 1, 1, 4);
  put(b, ROWS - 1, 2, 6);
  const chosen = selectGroups(findGroups(b, 10));
  const seen = new Set<number>();
  for (const g of chosen) for (const id of g.ids) {
    assert.equal(seen.has(id), false, "a tile may not be in two chosen groups");
    seen.add(id);
  }
});

test("selection is deterministic across identical boards", () => {
  const build = () => {
    const b = emptyBoard();
    put(b, ROWS - 1, 0, 6);
    put(b, ROWS - 1, 1, 4);
    put(b, ROWS - 1, 2, 6);
    put(b, ROWS - 2, 1, 4);
    return b;
  };
  nextId = 500;
  const a = selectGroups(findGroups(build(), 10)).map((g) => g.cells.map((p) => idx(p.r, p.c)));
  nextId = 500;
  const z = selectGroups(findGroups(build(), 10)).map((g) => g.cells.map((p) => idx(p.r, p.c)));
  assert.deepEqual(a, z);
});

test("gravity collapses a column and reports the moves", () => {
  const b = emptyBoard();
  const t = put(b, 2, 3, 9);
  const moves = applyGravity(b);
  assert.equal(b[idx(ROWS - 1, 3)]!.id, t.id);
  assert.deepEqual(moves, [{ id: t.id, from: { r: 2, c: 3 }, to: { r: ROWS - 1, c: 3 } }]);
});

test("planDrop does not mutate the board it was given", () => {
  const b = emptyBoard();
  put(b, ROWS - 1, 0, 3);
  const before = b.map((t) => t?.value ?? 0);
  planDrop(b, 0, T(7), { key: 10, nextId: () => nextId++ });
  assert.deepEqual(
    b.map((t) => t?.value ?? 0),
    before,
  );
});

test("a drop that completes the key fuses and empties the well", () => {
  const b = emptyBoard();
  put(b, ROWS - 1, 0, 3);
  const plan = planDrop(b, 0, T(7), { key: 10, nextId: () => nextId++ });
  assert.equal(plan.steps.length, 1);
  assert.equal(plan.steps[0]!.fused.length, 1);
  assert.equal(plan.steps[0]!.fused[0]!.sum, 10);
  assert.equal(boardValues(plan.final).length, 0);
  assert.equal(plan.totalScore, groupScore(10, 2, 1));
});

test("a fuse leaves nothing behind by default", () => {
  const b = emptyBoard();
  put(b, ROWS - 1, 0, 4);
  const plan = planDrop(b, 0, T(6), { key: 10, nextId: () => nextId++ });
  assert.equal(plan.steps[0]!.born.length, 0);
  assert.equal(plan.final.filter(Boolean).length, 0);
});

test("bornValue seam leaves a live tile when asked", () => {
  const b = emptyBoard();
  put(b, ROWS - 1, 0, 4);
  const plan = planDrop(b, 0, T(6), { key: 10, bornValue: 10, nextId: () => nextId++ });
  assert.equal(plan.steps[0]!.born.length, 1);
  assert.deepEqual(boardValues(plan.final), [10]);
});

test("planDrop resolves every group it finds, not only the dropped tile's", () => {
  // A settled board never actually holds a live pair — the previous drop would
  // have cleared it — but the solver must not depend on that.
  const b = emptyBoard();
  put(b, ROWS - 1, 0, 1);
  put(b, ROWS - 2, 0, 9);
  const plan = planDrop(b, 0, T(5), { key: 10, nextId: () => nextId++ });
  assert.equal(plan.steps.length, 1);
  assert.equal(plan.steps[0]!.chain, 1);
  assert.deepEqual(boardValues(plan.final), [5]);
});

test("removing a tile lets the stack fall into a second fuse", () => {
  //        c0   c1   c2   c3
  //  r-2:   .    3    .    .
  //  r-1:   4    6    7   (1 dropped)
  // 4+6 fuses; the 3 falls beside the 7; 3+7 fuses at chain 2.
  const b = emptyBoard();
  put(b, ROWS - 1, 0, 4);
  put(b, ROWS - 1, 1, 6);
  put(b, ROWS - 1, 2, 7);
  put(b, ROWS - 2, 1, 3);
  const plan = planDrop(b, 3, T(1), { key: 10, nextId: () => nextId++ });
  assert.equal(plan.maxChain, 2);
  assert.equal(plan.steps.length, 2);
  assert.equal(plan.steps[0]!.score, groupScore(10, 2, 1));
  assert.equal(plan.steps[1]!.score, groupScore(10, 2, 2));
  assert.equal(plan.totalScore, 60);
  assert.deepEqual(boardValues(plan.final), [1]);
});

test("a full column is a breach", () => {
  const b = emptyBoard();
  for (let r = 0; r < ROWS; r++) b[idx(r, 2)] = T(1);
  const plan = planDrop(b, 2, T(1), { key: 10, nextId: () => nextId++ });
  assert.equal(plan.landing, null);
  assert.equal(plan.breach, true);
});

test("a tile settling in the top row is a breach", () => {
  const b = emptyBoard();
  for (let r = 1; r < ROWS; r++) b[idx(r, 4)] = T(1);
  const plan = planDrop(b, 4, T(1), { key: 10, nextId: () => nextId++ });
  assert.notEqual(plan.landing, null);
  assert.equal(plan.breach, true);
});

test("previewFuse shows the landing cell and stays quiet when nothing fuses", () => {
  const b = emptyBoard();
  put(b, ROWS - 1, 0, 3);
  put(b, ROWS - 1, 1, 8);
  // a 4 landing on the 3 makes 7, and beside the 8 diagonally: nothing fuses
  const p = previewFuse(b, 0, 4, 10);
  assert.deepEqual(p.landing, { r: ROWS - 2, c: 0 });
  assert.equal(p.cells.length, 0);
  // a 7 landing on the same cell is vertically adjacent to the 3: it fuses
  const q = previewFuse(b, 0, 7, 10);
  assert.equal(q.cells.length, 2);
});

test("previewFuse lights the partner when the drop lands beside it", () => {
  const b = emptyBoard();
  put(b, ROWS - 1, 1, 3);
  const p = previewFuse(b, 0, 7, 10);
  assert.equal(p.cells.length, 2);
});

test("previewFuse on a full column reports no landing", () => {
  const b = emptyBoard();
  for (let r = 0; r < ROWS; r++) b[idx(r, 5)] = T(2);
  assert.deepEqual(previewFuse(b, 5, 8, 10).landing, null);
});

test("fillRatio grows as the well fills", () => {
  const b = emptyBoard();
  assert.equal(fillRatio(b), 0);
  put(b, ROWS - 1, 0, 1);
  assert.ok(fillRatio(b) > 0 && fillRatio(b) < 0.2);
  put(b, 0, 0, 1);
  assert.equal(fillRatio(b), 1);
});

test("strandedTiles finds what the new key can never use", () => {
  const b = emptyBoard();
  const dead = put(b, ROWS - 1, 0, 9);
  put(b, ROWS - 1, 1, 3);
  // key 40, pool 1..39: 9 needs 31 (spawnable) -> alive. 3 needs 37 -> alive.
  assert.equal(strandedTiles(b, 40, [1, 2, 3]).length, 2);
  const pool: number[] = [];
  for (let v = 1; v < 40; v++) pool.push(v);
  assert.equal(strandedTiles(b, 40, pool).length, 0);
  // key 5: a 9 can never help
  assert.deepEqual(
    strandedTiles(b, 5, [1, 2, 3, 4]).map((t) => t.id),
    [dead.id],
  );
});

test("groupScore is exact integer arithmetic", () => {
  assert.equal(groupScore(10, 2, 1), 20);
  assert.equal(groupScore(10, 3, 4), 120);
  assert.equal(Number.isInteger(groupScore(75, 3, 7)), true);
});

test("the board geometry is what the renderer assumes", () => {
  assert.equal(COLS, 6);
  assert.equal(ROWS, 11);
  assert.equal(emptyBoard().length, COLS * ROWS);
});

test("a rise pushes every chip up one row and lays a fresh floor", () => {
  const b = emptyBoard();
  const a = put(b, ROWS - 1, 0, 4);
  const z = put(b, ROWS - 2, 0, 5);
  const out = riseBoard(b, [1, 2, 3, 4, 5, 6], () => nextId++);
  assert.equal(out.breach, false);
  assert.equal(b[idx(ROWS - 2, 0)]!.id, a.id);
  assert.equal(b[idx(ROWS - 3, 0)]!.id, z.id);
  assert.deepEqual(
    Array.from({ length: COLS }, (_, c) => b[idx(ROWS - 1, c)]!.value),
    [1, 2, 3, 4, 5, 6],
  );
  assert.equal(out.born.length, COLS);
  assert.equal(out.moves.length, 2);
});

test("a rise refuses rather than deleting a chip out of the top row", () => {
  const b = emptyBoard();
  for (let r = 0; r < ROWS; r++) b[idx(r, 3)] = T(1);
  const before = b.map((t) => t?.id ?? 0);
  const out = riseBoard(b, [1, 1, 1, 1, 1, 1], () => nextId++);
  assert.equal(out.breach, true);
  assert.deepEqual(
    b.map((t) => t?.id ?? 0),
    before,
    "the board must be untouched when a rise is refused",
  );
});

test("a rise can itself set off a cascade", () => {
  const b = emptyBoard();
  put(b, ROWS - 1, 0, 7);
  const out = riseBoard(b, [3, 1, 1, 1, 1, 1], () => nextId++);
  assert.equal(out.breach, false);
  const res = cascade(b, { key: 10, nextId: () => nextId++ });
  assert.equal(res.steps.length, 1, "the 7 lands on the new 3 and fuses");
  assert.equal(res.maxChain, 1);
});

test("cascade and planDrop agree on the same board", () => {
  const build = () => {
    const b = emptyBoard();
    put(b, ROWS - 1, 0, 4);
    put(b, ROWS - 1, 1, 6);
    put(b, ROWS - 1, 2, 7);
    put(b, ROWS - 2, 1, 3);
    return b;
  };
  nextId = 900;
  const viaPlan = planDrop(build(), 3, T(1), { key: 10, nextId: () => nextId++ });
  nextId = 900;
  const live = build();
  live[idx(ROWS - 1, 3)] = T(1);
  const viaCascade = cascade(live, { key: 10, nextId: () => nextId++ });
  assert.equal(viaCascade.steps.length, viaPlan.steps.length);
  assert.equal(viaCascade.totalScore, viaPlan.totalScore);
  assert.deepEqual(
    live.map((t) => t?.value ?? 0),
    viaPlan.final.map((t) => t?.value ?? 0),
  );
});
