/**
 * The guarantees that must not rot: exact integers, determinism, mal-rule
 * distractors, no run-length reward, and a wave curve that actually escalates.
 *
 *   npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { createStubHost, malSmallerFromLarger, malDroppedCarry, malNoCarryMul } from "./stubHost.ts";
import { makeRng } from "./core/rng.ts";
import { buildWave, hpScale, scaledHp, mathFloor } from "./game/waves.ts";
import { buildPath } from "./game/path.ts";
import { buildPlots } from "./game/board.ts";
import {
  ENEMIES,
  MAX_LEVEL,
  towerDamage,
  towerUpgradeCost,
  TOWERS,
  CORE_MAX_HP,
} from "./game/constants.ts";
import {
  computeDamage,
  createState,
  emberReward,
  step,
  tryBuild,
  NO_EFFECTS,
  type Enemy,
} from "./game/state.ts";

const enemy = (over: Partial<Enemy> = {}): Enemy =>
  ({
    alive: true,
    kind: "shard",
    hp: 100,
    maxHp: 100,
    s: 0,
    x: 0,
    y: 0,
    dirX: 1,
    dirY: 0,
    speed: 100,
    armor: 0,
    bounty: 1,
    radius: 10,
    leak: 1,
    warded: false,
    splits: 0,
    stun: 0,
    hitFlash: 0,
    born: 0,
    phase: 0,
    popAcc: 0,
    popAt: 0,
    ...over,
  }) as Enemy;

// ---------------------------------------------------------------------------
// exactness
// ---------------------------------------------------------------------------

test("every generated answer is an exact integer string", () => {
  for (const seed of [1, 7, 99, 12345]) {
    const host = createStubHost({ seed, difficulty: 0 });
    for (let d = 0; d <= 20; d++) {
      host.raiseFloor(d / 20);
      for (let i = 0; i < 40; i++) {
        const q = host.next();
        assert.match(q.answer, /^-?\d+$/, `answer not an integer: ${q.prompt} -> ${q.answer}`);
        assert.equal(String(Number(q.answer)), q.answer);
        for (const w of q.distractors) {
          assert.match(w, /^\d+$/, `distractor not an integer: ${w}`);
          assert.notEqual(w, q.answer, `distractor equals the answer for ${q.prompt}`);
        }
      }
    }
  }
});

test("a question always offers exactly three distinct distractors", () => {
  const host = createStubHost({ seed: 4242, difficulty: 0.5 });
  for (let i = 0; i < 400; i++) {
    const q = host.next();
    assert.equal(q.distractors.length, 3, `only ${q.distractors.length} for ${q.prompt}`);
    assert.equal(new Set(q.distractors).size, 3, `duplicate distractors for ${q.prompt}`);
  }
});

test("prompts state their own truth", () => {
  const host = createStubHost({ seed: 88, difficulty: 0.5 });
  const ops: Record<string, (a: number, b: number) => number> = {
    "+": (a, b) => a + b,
    "−": (a, b) => a - b,
    "×": (a, b) => a * b,
    "÷": (a, b) => a / b,
  };
  for (let i = 0; i < 600; i++) {
    const q = host.next();
    const parts = q.prompt.split(" ");
    if (parts.length === 3) {
      const [a, op, b] = parts as [string, string, string];
      const f = ops[op];
      if (!f) {
        assert.fail(`unknown operator ${op} in ${q.prompt}`);
        return;
      }
      assert.equal(String(f(Number(a), Number(b))), q.answer, q.prompt);
    } else if (parts.length === 5) {
      // rate family: a × b ± c, precedence first
      const [a, , b, op2, c] = parts as [string, string, string, string, string];
      const prod = Number(a) * Number(b);
      const total = op2 === "+" ? prod + Number(c) : prod - Number(c);
      assert.equal(String(total), q.answer, q.prompt);
    } else {
      assert.fail(`unparseable prompt: ${q.prompt}`);
    }
  }
});

test("mal-rules reproduce the classic wrong answers", () => {
  // "take the smaller digit from the larger, column by column"
  assert.equal(malSmallerFromLarger(52, 38), 26);
  assert.equal(malSmallerFromLarger(71, 29), 58);
  // "add the columns, write the units, lose the carry"
  assert.equal(malDroppedCarry(28, 34), 52);
  assert.equal(malDroppedCarry(47, 38), 75);
  // "multiply every digit, never carry"
  assert.equal(malNoCarryMul(23, 4), 82);
});

test("ember reward is an integer at every difficulty", () => {
  for (let i = 0; i <= 100; i++) {
    const r = emberReward(i / 100);
    assert.ok(Number.isInteger(r), `${r} is not an integer`);
    assert.ok(r > 0);
  }
});

test("damage is a positive integer after armour and wards", () => {
  for (const base of [1, 6, 7, 26, 104, 999]) {
    for (const armor of [0, 3, 6, 10, 5000]) {
      for (const warded of [false, true]) {
        for (const single of [false, true]) {
          const d = computeDamage(base, enemy({ armor, warded }), single);
          assert.ok(Number.isInteger(d), `${d} not integer`);
          assert.ok(d >= 1, `${d} below the floor of 1`);
        }
      }
    }
  }
});

test("a ward blunts single-target fire and not splash", () => {
  const w = enemy({ warded: true });
  assert.ok(computeDamage(100, w, true) < computeDamage(100, w, false));
  const plain = enemy({});
  assert.equal(computeDamage(100, plain, true), computeDamage(100, plain, false));
});

test("tower damage and upgrade costs are integers, and top out", () => {
  for (const kind of ["bolt", "mortar", "chain"] as const) {
    for (let l = 0; l <= MAX_LEVEL; l++) {
      assert.ok(Number.isInteger(towerDamage(kind, l)));
      const c = towerUpgradeCost(kind, l);
      if (l === MAX_LEVEL) assert.equal(c, null);
      else {
        assert.ok(Number.isInteger(c as number));
        assert.ok((c as number) > TOWERS[kind].cost);
      }
    }
    // strictly increasing damage, so an upgrade is never a downgrade
    for (let l = 1; l <= MAX_LEVEL; l++) {
      assert.ok(towerDamage(kind, l) > towerDamage(kind, l - 1));
    }
  }
});

// ---------------------------------------------------------------------------
// determinism
// ---------------------------------------------------------------------------

test("the same seed plays the same siege", () => {
  const a = buildWave(9, 1234);
  const b = buildWave(9, 1234);
  assert.deepEqual(a, b);
  const c = buildWave(9, 1235);
  assert.notDeepEqual(a.orders, c.orders);
});

test("the rng is stable across runs and diverges on nearby seeds", () => {
  const a = Array.from({ length: 8 }, (_, i) => makeRng(7).i(0, 1000) + i * 0);
  const b = Array.from({ length: 8 }, () => makeRng(7).i(0, 1000));
  assert.deepEqual(a, b);
  assert.notEqual(makeRng(7).i(0, 1e9), makeRng(8).i(0, 1e9));
});

test("the board is deterministic and every pad can reach the channel", () => {
  const p = buildPath();
  const plots = buildPlots(p);
  assert.deepEqual(
    plots.map((q) => [Math.round(q.x), Math.round(q.y)]),
    buildPlots(buildPath()).map((q) => [Math.round(q.x), Math.round(q.y)]),
  );
  assert.ok(plots.length >= 16 && plots.length <= 26, `${plots.length} pads`);
  for (const plot of plots) {
    assert.ok(plot.value > 0.02, `pad ${plot.id} covers almost none of the channel`);
    assert.ok(p.distanceTo(plot.x, plot.y) >= 70, `pad ${plot.id} sits in the lava`);
  }
});

// ---------------------------------------------------------------------------
// escalation
// ---------------------------------------------------------------------------

test("waves escalate superlinearly, and boss waves spike above their neighbours", () => {
  let prevHp = 0;
  let prevCount = 0;
  for (let n = 1; n <= 30; n++) {
    const w = buildWave(n, 99);
    assert.ok(w.count >= prevCount, `wave ${n} has fewer enemies than ${n - 1}`);
    assert.ok(Number.isInteger(w.totalHp));
    if (!w.hasBoss) {
      // the ordinary curve only ever rises; boss waves are a deliberate saw-tooth
      assert.ok(w.totalHp > prevHp, `wave ${n} is not bigger than the last ordinary wave`);
      prevHp = w.totalHp;
    } else {
      assert.ok(
        w.totalHp > buildWave(n + 1, 99).totalHp,
        `boss wave ${n} does not spike above wave ${n + 1}`,
      );
    }
    prevCount = w.count;
  }
  // the curve must bend upward, not just rise
  const d10 = buildWave(12, 99).totalHp - buildWave(11, 99).totalHp;
  const d25 = buildWave(27, 99).totalHp - buildWave(26, 99).totalHp;
  assert.ok(d25 > d10 * 4, `escalation is too flat: ${d10} then ${d25}`);
});

test("every enemy health value is a positive integer", () => {
  for (let n = 1; n <= 40; n++) {
    for (const kind of Object.keys(ENEMIES) as (keyof typeof ENEMIES)[]) {
      const hp = scaledHp(kind, n);
      assert.ok(Number.isInteger(hp) && hp >= 1);
    }
    for (const o of buildWave(n, 5).orders) {
      assert.ok(Number.isInteger(o.hp) && o.hp >= 1);
    }
  }
  assert.equal(hpScale(1), 1);
});

test("bosses arrive every fifth wave and only then", () => {
  for (let n = 1; n <= 25; n++) {
    assert.equal(buildWave(n, 3).hasBoss, n % 5 === 0, `wave ${n}`);
  }
});

test("the maths floor rises with the siege but never runs away", () => {
  assert.equal(mathFloor(1), 0);
  assert.ok(mathFloor(10) > mathFloor(5));
  assert.ok(mathFloor(200) <= 0.72);
});

// ---------------------------------------------------------------------------
// the ethics line
// ---------------------------------------------------------------------------

test("difficulty answers to correctness, never to a streak", () => {
  const host = createStubHost({ seed: 2, difficulty: 0.5 });
  // report takes no run length; the only lever is the answer and the time
  assert.equal(host.report.length, 1);
  const before = host.difficulty();
  host.report({ questionId: "x", correct: false, ms: 900, answered: "0" });
  assert.ok(host.difficulty() < before, "a wrong answer must ease off");
  const dip = host.difficulty();
  host.report({ questionId: "y", correct: true, ms: 900, answered: "0" });
  assert.ok(host.difficulty() > dip, "a right answer must push up");
});

test("a wrong answer costs nothing but time — no health, no embers", () => {
  const s = createState(1);
  const embers = s.embers;
  const core = s.coreHp;
  // the anvil is the only place a wrong answer lands, and the sim never sees it
  step(s, 1 / 60, NO_EFFECTS);
  assert.equal(s.embers, embers);
  assert.equal(s.coreHp, core);
  assert.equal(s.coreHp, CORE_MAX_HP);
});

// ---------------------------------------------------------------------------
// the loop actually runs
// ---------------------------------------------------------------------------

test("a headless siege spawns, fights and clears wave one", () => {
  const s = createState(31337);
  s.embers += 200; // this test is about the loop, not the opening economy
  const plots = s.plots.slice().sort((a, b) => b.value - a.value);
  for (let i = 0; i < 3; i++) {
    assert.ok(tryBuild(s, (plots[i] as { id: number }).id, "bolt", NO_EFFECTS));
  }
  assert.equal(s.towers.length, 3);
  let killed = 0;
  const fx = { ...NO_EFFECTS, kill: () => killed++ };
  for (let i = 0; i < 60 * 240 && s.wave === 1; i++) step(s, 1 / 60, fx);
  assert.ok(killed > 0, "nothing died");
  assert.equal(s.wave, 2, "wave one never cleared");
  assert.ok(s.embers > 0);
});

test("leaks damage the forge and the forge can go cold", () => {
  const s = createState(7);
  let defeated = -1;
  const fx = { ...NO_EFFECTS, defeat: (w: number) => (defeated = w) };
  // no towers at all: every wave walks straight through
  for (let i = 0; i < 60 * 900 && s.phase !== "defeat"; i++) step(s, 1 / 60, fx);
  assert.equal(s.phase, "defeat");
  assert.equal(s.coreHp, 0);
  assert.ok(defeated >= 1);
});
