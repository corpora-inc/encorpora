import { test } from "node:test";
import assert from "node:assert/strict";
import { buildWave } from "./wall.ts";
import { guilty } from "./rules.ts";

const WAVES = 40;

test("a wall is a pure function of (seed, index)", () => {
  for (const index of [0, 3, 9, 17]) {
    const a = buildWave({ seed: 12345, index });
    const b = buildWave({ seed: 12345, index });
    assert.deepEqual(
      a.tiles.map((t) => [t.col, t.row, t.face.text, t.guilty, t.kind]),
      b.tiles.map((t) => [t.col, t.row, t.face.text, t.guilty, t.kind]),
    );
    const c = buildWave({ seed: 12346, index });
    assert.notDeepEqual(
      a.tiles.map((t) => t.face.text),
      c.tiles.map((t) => t.face.text),
    );
  }
});

test("guilt is mirror-symmetric about the vertical axis", () => {
  for (let index = 0; index < WAVES; index++) {
    const w = buildWave({ seed: 0xa11ce, index });
    const at = new Map<string, boolean>();
    for (const t of w.tiles) at.set(`${t.col},${t.row}`, t.guilty);
    for (const t of w.tiles) {
      const mirror = at.get(`${w.cols - 1 - t.col},${t.row}`);
      assert.equal(mirror, t.guilty, `wave ${index} at ${t.col},${t.row} (${w.layout})`);
    }
  }
});

test("occupancy is mirror-symmetric too — the window is a designed shape", () => {
  for (let index = 0; index < WAVES; index++) {
    const w = buildWave({ seed: 7, index });
    const occupied = new Set(w.tiles.map((t) => `${t.col},${t.row}`));
    for (const t of w.tiles) {
      assert.ok(occupied.has(`${w.cols - 1 - t.col},${t.row}`), `wave ${index} ${w.layout}`);
    }
  }
});

test("every tile's printed face agrees with the rule that judged it", () => {
  for (let index = 0; index < WAVES; index++) {
    for (const seed of [1, 999, 0xbeef]) {
      const w = buildWave({ seed, index });
      for (const t of w.tiles) {
        assert.equal(
          guilty(w.rule, t.face.value),
          t.guilty,
          `wave ${index} seed ${seed}: "${t.face.text}" vs ${w.rule.kind}`,
        );
      }
    }
  }
});

test("every wave is winnable and worth playing: enough targets, not all targets", () => {
  for (let index = 0; index < WAVES; index++) {
    for (const seed of [1, 42, 0xfeed]) {
      const w = buildWave({ seed, index });
      assert.ok(w.guiltyTotal >= 4, `wave ${index} has only ${w.guiltyTotal} targets`);
      assert.ok(w.guiltyTotal < w.tiles.length, `wave ${index} is all targets`);
      assert.ok(w.tiles.length >= 20, `wave ${index} has only ${w.tiles.length} tiles`);
      // A wall that is mostly target is a chore; mostly masonry is a maze.
      const share = w.guiltyTotal / w.tiles.length;
      assert.ok(share > 0.15 && share < 0.7, `wave ${index} share ${share.toFixed(2)}`);
    }
  }
});

test("wave 1 is the tutorial and has no tutorial", () => {
  const w = buildWave({ seed: 3, index: 0 });
  // Even numbers, no descent, no crystal or star to explain. The SHAPE is no
  // longer part of the contract — see the opening-board tests below.
  assert.equal(w.rule.kind, "multiple");
  assert.equal(w.rule.target.n, 2);
  assert.equal(w.descentRate, 0);
  for (const t of w.tiles) assert.equal(t.kind, "glass");
});

// ---------------------------------------------------------------------------
// The opening board
//
// "The first board is just a rectangle of the numbers and it's boring." It was:
// measured over four hundred seeds, wave one produced exactly ONE shape — a
// filled 9×4 block, fill fraction 1.000, every run the game has ever played.
// These four tests are the ones that would go green again if the carve were
// deleted, so they assert the property and not the implementation.
// ---------------------------------------------------------------------------

/** A shape key: which cells are occupied, independent of what is printed on them. */
function shapeKey(w: ReturnType<typeof buildWave>): string {
  return (
    w.tiles
      .map((t) => `${t.col},${t.row}`)
      .sort()
      .join("|") + `#${w.cols}x${w.rows}`
  );
}

const SPREAD_SEEDS = Array.from({ length: 300 }, (_, i) => (i * 2654435761 + 12345) >>> 0);

test("the opening board is not a filled rectangle", () => {
  let full = 0;
  for (const seed of SPREAD_SEEDS) {
    const w = buildWave({ seed, index: 0 });
    if (w.tiles.length === w.cols * w.rows) full++;
  }
  // A carve may legitimately roll back to nothing on the odd seed; a majority
  // of full rectangles would mean the carve is not doing its job.
  assert.ok(full / SPREAD_SEEDS.length < 0.05, `${full}/${SPREAD_SEEDS.length} openings were solid blocks`);
});

test("the opening board is a different shape nearly every run", () => {
  const shapes = new Set(SPREAD_SEEDS.map((seed) => shapeKey(buildWave({ seed, index: 0 }))));
  assert.ok(
    shapes.size > SPREAD_SEEDS.length * 0.8,
    `only ${shapes.size} distinct opening shapes across ${SPREAD_SEEDS.length} seeds`,
  );
});

test("the opening board is not always the same KIND of window either", () => {
  // The carve alone would satisfy the two tests above while wave one still
  // drew from a single hard-coded mask for ever. It does not: the opening
  // draws from a family of shapes that stay legible at four or five rows.
  const families = new Set(SPREAD_SEEDS.map((seed) => buildWave({ seed, index: 0 }).layout));
  assert.ok(families.size >= 3, `the opening only ever uses ${[...families].join(", ")}`);
});

test("two fresh sessions do not open on the same wall", () => {
  // What `mount.ts` actually does: seed from the clock. Consecutive launches a
  // few milliseconds apart must still differ.
  const now = 1785000000000;
  const a = buildWave({ seed: (now ^ 0x5eed1e) >>> 0, index: 0 });
  const b = buildWave({ seed: ((now + 1) ^ 0x5eed1e) >>> 0, index: 0 });
  const c = buildWave({ seed: ((now + 17) ^ 0x5eed1e) >>> 0, index: 0 });
  assert.notEqual(shapeKey(a), shapeKey(b));
  assert.notEqual(shapeKey(b), shapeKey(c));
  assert.notDeepEqual(
    a.tiles.map((t) => t.face.text),
    b.tiles.map((t) => t.face.text),
  );
});

test("carving never takes a wall below the floor it promises", () => {
  for (let index = 0; index < WAVES; index++) {
    for (const seed of SPREAD_SEEDS.slice(0, 60)) {
      const w = buildWave({ seed, index });
      assert.ok(w.tiles.length >= 20, `wave ${index} seed ${seed} carved down to ${w.tiles.length}`);
      assert.equal(w.guiltyShare, w.guiltyTotal / w.tiles.length);
    }
  }
});

test("difficulty escalates monotonically where it should", () => {
  const early = buildWave({ seed: 5, index: 1 });
  const late = buildWave({ seed: 5, index: 25 });
  assert.ok(late.ballSpeed > early.ballSpeed);
  assert.ok(late.descentRate > early.descentRate);
  assert.ok(late.rows >= early.rows);
});

test("faces never print a float or a negative", () => {
  for (let index = 0; index < WAVES; index++) {
    const w = buildWave({ seed: 0x5a17, index });
    for (const t of w.tiles) {
      assert.equal(/^[0-9]+([+−×÷][0-9]+)?$|^[0-9]+\/[0-9]+$/.test(t.face.text), true, t.face.text);
      assert.ok(Number.isInteger(t.face.value.n));
      assert.ok(Number.isInteger(t.face.value.d));
      assert.ok(t.face.value.d > 0);
    }
  }
});
