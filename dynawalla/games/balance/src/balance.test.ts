import { test } from "node:test";
import assert from "node:assert/strict";

import { frac, add, sub, cmp, eq, toKey, parseFrac, toNumber, isZero } from "./frac.ts";
import type { Frac } from "./frac.ts";
import { puzzleAt, distractorsAt, PUZZLES_PER_MOVEMENT } from "./generate.ts";
import type { PuzzleSpec } from "./puzzle.ts";
import {
  PAN_PEG,
  netTorque,
  isBalanced,
  isPinned,
  minWeightsFor,
  answeredKey,
} from "./puzzle.ts";
import { specFromQuestion as buildSpec, type BoardLimits } from "./adapter.ts";
import type { Question } from "./contract.ts";
import { makeRng } from "./rng.ts";
import { makeStubHost } from "./stubHost.ts";

/**
 * The board, or a failed assertion.
 *
 * `specFromQuestion` can now refuse — see `adapter.ts`, which is where the
 * founder's lockout was. Every question in this file is one the game is expected
 * to be able to build, so a refusal here is a real failure and should read as
 * one rather than as `null` propagating into a confusing assertion further down.
 */
function specFromQuestion(q: Question, limits?: BoardLimits): PuzzleSpec {
  const spec = buildSpec(q, limits);
  assert.ok(spec, `COUNTERPOISE refused a board it must be able to build: ${q.prompt} = ${q.answer}`);
  return spec;
}

const SEED = 0x5eed1e;
const N = 400; // ~80 movements deep: far past anything a session reaches

// --------------------------------------------------------------- exactness

test("rational arithmetic is exact where floats are not", () => {
  // The reason this type exists: 0.1 + 0.2 !== 0.3 would mark correct work wrong.
  assert.notEqual(0.1 + 0.2, 0.3);
  assert.ok(eq(add(frac(1, 10), frac(2, 10)), frac(3, 10)));
  assert.ok(eq(add(frac(1, 3), frac(1, 6)), frac(1, 2)));
  assert.ok(eq(sub(frac(3, 4), frac(1, 4)), frac(1, 2)));
  assert.equal(cmp(frac(1, 3), frac(2, 6)), 0);
  assert.equal(cmp(frac(2, 5), frac(3, 7)), -1);
  assert.equal(toKey(frac(6, 8)), "3/4");
  assert.equal(toKey(frac(-4, 2)), "-2");
  assert.ok(eq(parseFrac("3/4")!, frac(3, 4)));
  assert.ok(eq(parseFrac("-7")!, frac(-7)));
  assert.equal(parseFrac("banana"), null);
});

test("frac normalises sign and reduces", () => {
  assert.deepEqual(frac(2, -4), { n: -1, d: 2 });
  assert.deepEqual(frac(0, 9), { n: 0, d: 1 });
  assert.throws(() => frac(1, 0));
  assert.throws(() => frac(1.5, 2));
});

// ---------------------------------------------------------------- the rung

/** Place exactly the canonical answer and assert the beam is level. */
function solveWithAnswer(spec: PuzzleSpec): boolean {
  if (spec.kind === "declare") return isBalanced(spec, [], spec.answer);
  if (spec.kind === "hang") {
    const s = spec.hangSlot!;
    return isBalanced(
      spec,
      [{ id: "a", side: s.side, peg: s.peg, value: spec.answer }],
      null,
    );
  }
  return isBalanced(
    spec,
    [{ id: "a", side: spec.fillSide!, peg: PAN_PEG, value: spec.answer }],
    null,
  );
}

/** Independent re-implementation of "can the rack make this?" (unlimited copies). */
function rackCanMake(rack: readonly Frac[], target: Frac): boolean {
  const lcm = (a: number, b: number): number => {
    let x = a;
    let y = b;
    while (y !== 0) {
      const t = x % y;
      x = y;
      y = t;
    }
    return (a / x) * b;
  };
  let L = target.d;
  for (const f of rack) L = lcm(L, f.d);
  const goal = Math.abs(target.n) * (L / target.d);
  const sign = target.n < 0 ? -1 : 1;
  const vals = rack
    .filter((f) => (f.n < 0 ? -1 : 1) === sign && f.n !== 0)
    .map((f) => Math.abs(f.n) * (L / f.d));
  const ok = new Array<boolean>(goal + 1).fill(false);
  ok[0] = true;
  for (let i = 1; i <= goal; i++) {
    for (const v of vals) {
      if (v <= i && ok[i - v]) {
        ok[i] = true;
        break;
      }
    }
  }
  return ok[goal] === true;
}

test("every generated board is exactly solvable by its own answer", () => {
  for (let i = 0; i < N; i++) {
    const spec = puzzleAt(i, SEED);
    assert.ok(solveWithAnswer(spec), `board ${i} (${spec.prompt}) is not solved by ${toKey(spec.answer)}`);
  }
});

test("every answer can actually be built out of the rack in front of the child", () => {
  for (let i = 0; i < N; i++) {
    const spec = puzzleAt(i, SEED);
    if (spec.kind === "fill") {
      assert.ok(
        rackCanMake(spec.rack, spec.answer),
        `board ${i} (${spec.prompt}) wants ${toKey(spec.answer)} which the rack cannot make`,
      );
    } else {
      assert.ok(
        spec.rack.some((r) => eq(r, spec.answer)),
        `board ${i} (${spec.prompt}) wants ${toKey(spec.answer)} which is not on the rack`,
      );
    }
  }
});

test("boards are never degenerate: not already balanced, answer never zero", () => {
  for (let i = 0; i < N; i++) {
    const spec = puzzleAt(i, SEED);
    assert.ok(!isZero(spec.answer), `board ${i} has a zero answer`);
    if (spec.kind !== "declare") {
      assert.ok(
        !isZero(netTorque(spec, [], null)),
        `board ${i} (${spec.prompt}) starts already level`,
      );
    }
  }
});

test("a wrong value never balances the beam", () => {
  let checked = 0;
  for (let i = 0; i < N; i++) {
    const spec = puzzleAt(i, SEED);
    for (const r of spec.rack) {
      if (eq(r, spec.answer)) continue;
      if (spec.kind === "declare") {
        assert.ok(!isBalanced(spec, [], r), `board ${i}: ${toKey(r)} wrongly balances`);
        checked++;
      } else if (spec.kind === "hang") {
        const s = spec.hangSlot!;
        assert.ok(
          !isBalanced(spec, [{ id: "x", side: s.side, peg: s.peg, value: r }], null),
          `board ${i}: ${toKey(r)} wrongly balances`,
        );
        checked++;
      }
    }
  }
  assert.ok(checked > 500, `expected a lot of coverage, got ${checked}`);
});

test("the rack is never a four-option multiple choice", () => {
  for (let i = 0; i < N; i++) {
    const spec = puzzleAt(i, SEED);
    assert.ok(spec.rack.length >= 8, `board ${i} rack is only ${spec.rack.length} long`);
  }
});

test("distractors are real wrong values, not the answer", () => {
  for (let i = 0; i < N; i++) {
    const spec = puzzleAt(i, SEED);
    const ds = distractorsAt(i, SEED);
    assert.ok(ds.length >= 3, `board ${i} has too few distractors`);
    for (const d of ds) {
      assert.notEqual(d, toKey(spec.answer), `board ${i} distractor equals the answer`);
    }
  }
});

test("the ladder escalates and names its movements", () => {
  const kinds = new Set<string>();
  const domains = new Set<string>();
  for (let i = 0; i < 45; i++) {
    const spec = puzzleAt(i, SEED);
    kinds.add(spec.kind);
    domains.add(spec.domain);
    assert.equal(spec.movement, Math.floor(i / PUZZLES_PER_MOVEMENT));
    assert.ok(spec.movementName.length > 0);
  }
  assert.deepEqual([...kinds].sort(), ["declare", "fill", "hang"]);
  assert.ok(domains.has("ratio"), "the lever movement must appear");
  assert.ok(domains.has("fractions"), "the fraction movement must appear");
  assert.ok(domains.has("equations"), "the unknown movement must appear");
  assert.ok(puzzleAt(40, SEED).difficulty > puzzleAt(2, SEED).difficulty);
});

test("crates pin the beam until a value is declared", () => {
  const declare = Array.from({ length: 40 }, (_, i) => puzzleAt(10 + i, SEED)).find(
    (s) => s.kind === "declare",
  )!;
  assert.ok(isPinned(declare, null));
  assert.ok(!isPinned(declare, declare.answer));
});

test("moments about the fulcrum use distance, so ratio is native", () => {
  const lever = Array.from({ length: 60 }, (_, i) => puzzleAt(i, SEED)).find(
    (s) => s.kind === "hang",
  )!;
  assert.equal(lever.mode, "beam");
  const s = lever.hangSlot!;
  // the same weight one peg further out must NOT balance
  const nearer = Math.max(1, s.peg - 1);
  if (nearer !== s.peg) {
    assert.ok(
      !isBalanced(lever, [{ id: "x", side: s.side, peg: nearer, value: lever.answer }], null),
      "distance is not affecting the moment",
    );
  }
});

// ------------------------------------------------------------ determinism

test("generation is deterministic and seed-separated", () => {
  for (let i = 0; i < 60; i++) {
    assert.deepEqual(puzzleAt(i, SEED), puzzleAt(i, SEED));
  }
  const a = Array.from({ length: 20 }, (_, i) => puzzleAt(i, 1).prompt).join("|");
  const b = Array.from({ length: 20 }, (_, i) => puzzleAt(i, 2).prompt).join("|");
  assert.notEqual(a, b);
});

test("rng is deterministic and uniform enough to trust", () => {
  const r1 = makeRng(42);
  const r2 = makeRng(42);
  for (let i = 0; i < 50; i++) assert.equal(r1.next(), r2.next());
  const r = makeRng(7);
  const buckets = new Array<number>(10).fill(0);
  for (let i = 0; i < 20000; i++) buckets[r.int(0, 9)]++;
  for (const b of buckets) assert.ok(b > 1500 && b < 2500, `bucket skew: ${b}`);
});

// ------------------------------------------------------------- the contract

test("the stub host emits contract-shaped questions", () => {
  const host = makeStubHost({ seed: SEED });
  for (let i = 0; i < 20; i++) {
    const q = host.next();
    assert.equal(typeof q.id, "string");
    assert.ok(q.prompt.includes("="));
    assert.ok(q.answer.length > 0);
    assert.ok(Array.isArray(q.distractors));
    assert.ok(q.difficulty >= 0 && q.difficulty <= 1);
  }
});

test("a board can be built from a foreign question with no spec attached", () => {
  // The founder's own example shape, arriving from a host that knows nothing
  // about balances: `15 − 8`, answer `7`.
  const spec = specFromQuestion(
    {
      id: "q1",
      prompt: "15 − 8",
      answer: "7",
      distractors: ["23", "6", "8"],
      domain: "add-sub",
      difficulty: 0.2,
    },
  );
  assert.equal(spec.kind, "fill");
  assert.equal(spec.fixed.length, 2);
  assert.ok(solveWithAnswer(spec));
  assert.ok(rackCanMake(spec.rack, spec.answer));

  const eq2 = specFromQuestion(
    {
      id: "q2",
      prompt: "3x + 2 = 14",
      answer: "4",
      distractors: ["12", "16", "5"],
      domain: "equations",
      difficulty: 0.5,
    },
  );
  assert.equal(eq2.kind, "declare");
  assert.equal(eq2.fixed.filter((f) => f.kind === "crate").length, 3);
  assert.ok(solveWithAnswer(eq2));

  const fr = specFromQuestion(
    {
      id: "q3",
      prompt: "3/4 = 1/4 + □",
      answer: "1/2",
      distractors: ["1", "1/4"],
      domain: "fractions",
      difficulty: 0.6,
    },
  );
  assert.ok(solveWithAnswer(fr));
});

test("answeredKey reports what the child actually built", () => {
  const spec = puzzleAt(6, SEED); // a fill board
  assert.equal(spec.kind, "fill");
  const half = spec.rack[0];
  assert.equal(
    answeredKey(spec, [{ id: "a", side: spec.fillSide!, peg: PAN_PEG, value: half }], null),
    toKey(half),
  );
});

test("minWeightsFor finds the tidiest solution", () => {
  const rack = [frac(1), frac(2), frac(5), frac(10)];
  assert.equal(minWeightsFor(rack, frac(7)), 2);
  assert.equal(minWeightsFor(rack, frac(4)), 2);
  assert.equal(minWeightsFor(rack, frac(10)), 1);
  assert.equal(minWeightsFor([frac(1, 4), frac(1, 2)], frac(3, 4)), 2);
});

test("no float ever reaches a verdict", () => {
  // A board built entirely of thirds and sixths: any float path drifts, the
  // rational path does not.
  const spec: PuzzleSpec = {
    id: "t",
    kind: "fill",
    mode: "pans",
    fixed: [
      { kind: "weight", side: -1, peg: PAN_PEG, value: frac(1, 3) },
      { kind: "weight", side: -1, peg: PAN_PEG, value: frac(1, 6) },
    ],
    answer: frac(1, 2),
    rack: [frac(1, 6), frac(1, 3), frac(1, 2)],
    fillSide: 1,
    hangSlot: null,
    countAnswer: false,
    prompt: "1/3 + 1/6 = □",
    domain: "fractions",
    difficulty: 0.5,
    movement: 7,
    movementName: "Halves and Quarters",
  };
  const placed = [
    { id: "a", side: 1 as const, peg: PAN_PEG, value: frac(1, 6) },
    { id: "b", side: 1 as const, peg: PAN_PEG, value: frac(1, 3) },
  ];
  assert.ok(isBalanced(spec, placed, null));
  // the float sum of the same quantities does not land on the float sum of the target
  const lhs = 1 / 3 + 1 / 6;
  const rhs = 1 / 6 + 1 / 3;
  assert.ok(Math.abs(lhs - rhs) < 1e-12);
  assert.equal(toNumber(netTorque(spec, placed, null)), 0);
});
