import test from "node:test";
import assert from "node:assert/strict";

import type { Host, Question } from "../contract.ts";
import { tierByName } from "../core/tier.ts";
import { BK, EK, PACE } from "./constants.ts";
import { bossDefeated, launchBoss, onOrbTouched, stepBoss, tryLock } from "./seal.ts";
import { startRun, step, stratumOf, rosterOf } from "./sim.ts";
import type { Bullet, Enemy } from "./types.ts";
import { makeWorld, type World } from "./world.ts";

type Report = { questionId: string; correct: boolean; ms: number; answered: string };

/**
 * A host with the shape and the MAGNITUDES the shipping curriculum has.
 *
 * `dw.add.column.add-no-regroup` L0 — the first rung of the ladder, the one a
 * child actually starts on — answers in the twenties to the nineties, and the
 * rungs above it answer in the thousands. Nothing here fits the ±20 core band,
 * which is the whole point: it is what the Warden's clamp was silently doing to
 * every answer it reported.
 */
function fakeHost(answers: readonly { answer: string; distractors: string[] }[]): {
  host: Host;
  reports: Report[];
  served: Question[];
} {
  const reports: Report[] = [];
  const served: Question[] = [];
  let n = 0;
  const host: Host = {
    next: () => {
      const spec = answers[n % answers.length] as { answer: string; distractors: string[] };
      n++;
      const q: Question = {
        id: `q${String(n)}`,
        prompt: `item ${String(n)}`,
        answer: spec.answer,
        distractors: spec.distractors,
        domain: "add-sub",
        difficulty: 0.2,
      };
      served.push(q);
      return q;
    },
    report: (r) => reports.push(r),
    haptic: () => {},
    prefersReducedMotion: () => true,
  };
  return { host, reports, served };
}

const CURRICULUM = [
  { answer: "3916", distractors: ["3906", "4916", "3917"] },
  { answer: "137", distractors: ["127", "237", "138"] },
  { answer: "64", distractors: ["54", "74", "65"] },
];

function world(host: Host): World {
  const w = makeWorld(host, tierByName("low"), 0x50147);
  startRun(w);
  return w;
}

/** Run a boss's choreography until it has asked, or give up. */
function askUntilSeal(w: World, e: Enemy): void {
  for (let i = 0; i < 2000 && w.seal.state !== "asking"; i++) {
    w.t += 1 / 60;
    stepBoss(w, e, 1 / 60, 1);
  }
}

function orbs(w: World, serial: number): Bullet[] {
  const out: Bullet[] = [];
  for (let i = 0; i < w.bulletN; i++) {
    const b = w.bullets[i] as Bullet;
    if (b.kind === BK.Orb && b.seal === serial) out.push(b);
  }
  return out;
}

// ---------------------------------------------------------------------------
// what is reported is what the child did
// ---------------------------------------------------------------------------

test("a Bearer reports the value the child actually flew into", () => {
  const { host, reports } = fakeHost(CURRICULUM);
  const w = world(host);
  launchBoss(w);
  const e = w.enemies[w.enemyN - 1] as Enemy;
  askUntilSeal(w, e);
  assert.equal(w.seal.state, "asking");

  const wrong = orbs(w, w.seal.serial).find((b) => !b.correct);
  assert.ok(wrong, "the Bearer dropped no wrong orb to fly into");
  const touched = wrong.v;
  onOrbTouched(w, wrong);

  assert.equal(reports.length, 1);
  const r = reports[0] as Report;
  assert.equal(r.answered, String(touched));
  assert.equal(r.correct, false);
  assert.ok(
    CURRICULUM.some((c) => c.distractors.includes(r.answered)),
    `${r.answered} is not one of the options that were on the field`,
  );
});

test("a correct Bearer answer is reported as the canonical answer, unaltered", () => {
  const { host, reports, served } = fakeHost(CURRICULUM);
  const w = world(host);
  launchBoss(w);
  const e = w.enemies[w.enemyN - 1] as Enemy;
  askUntilSeal(w, e);

  const right = orbs(w, w.seal.serial).find((b) => b.correct);
  assert.ok(right);
  onOrbTouched(w, right);

  const r = reports[0] as Report;
  const q = served[0] as Question;
  assert.equal(r.correct, true);
  assert.equal(
    r.answered,
    q.answer,
    "a child who flew into the right orb was reported as answering something else",
  );
});

/** A Warden, already on the field, driven to the moment its lock opens. */
function warden(w: World): Enemy {
  for (let i = 0; i < PACE.wardenEvery - 1; i++) w.bearerCount++;
  launchBoss(w);
  const e = w.enemies[w.enemyN - 1] as Enemy;
  assert.equal(e.kind, EK.Warden, "wanted a Warden");
  for (let i = 0; i < 2000 && e.lockState !== 1; i++) {
    w.t += 1 / 60;
    stepBoss(w, e, 1 / 60, 1);
  }
  assert.equal(e.lockState, 1, "the lock never opened");
  return e;
}

test("the core band never rewrites what a Warden reports", () => {
  const { host, reports, served } = fakeHost(CURRICULUM);
  const w = world(host);
  const e = warden(w);

  // The lock demands a total inside the band the core can actually reach, and
  // it is the game's own number: no item was drawn for it at all.
  assert.ok(
    Math.abs(e.lockWant) <= w.cap && Math.abs(e.lockWant) >= 3,
    `the lock wants ${String(e.lockWant)}, and the core band is ±${String(w.cap)}`,
  );
  assert.equal(served.length, 0, "the Warden pulled an item it has no way to ask");
  assert.equal(w.seal.state, "idle");

  // Play the lock perfectly. It scores, it hurts the boss, and it reports
  // NOTHING — because the curriculum never asked for a core total.
  const hpBefore = e.hp;
  w.core = e.lockWant;
  assert.equal(tryLock(w, e), "exact");
  assert.ok(e.hp < hpBefore, "an exact lock did no damage");
  assert.equal(
    reports.length,
    0,
    `breaking the lock reported ${JSON.stringify(reports)} — the band's number, not the child's answer`,
  );
});

test("a Warden's lock is reachable and its target never leaves the band", () => {
  const { host } = fakeHost(CURRICULUM);
  for (let run = 0; run < 40; run++) {
    const w = makeWorld(host, tierByName("low"), 0x1000 + run);
    startRun(w);
    const e = warden(w);
    // `releaseYield` refuses to vent below a magnitude of 3, so a target of 1 or
    // 2 would be a lock with no key.
    assert.ok(Math.abs(e.lockWant) >= 3, `unventable lock target ${String(e.lockWant)}`);
    assert.ok(Math.abs(e.lockWant) <= w.cap, `lock target ${String(e.lockWant)} outside the band`);
  }
});

test("nothing this game reports is a value that was never on the field", () => {
  const { host, reports, served } = fakeHost(CURRICULUM);
  const w = world(host);
  let answered = 0;
  for (let boss = 0; boss < 9; boss++) {
    launchBoss(w);
    const e = w.enemies[w.enemyN - 1] as Enemy;
    if (e.kind === EK.Warden) {
      // No question, so nothing to answer. Break its lock and move on. (Stepped
      // only to the moment the lock opens: a Warden left running fills the
      // bullet pool, and that is the harness's problem, not the game's.)
      for (let i = 0; i < 2000 && e.lockState !== 1; i++) {
        w.t += 1 / 60;
        stepBoss(w, e, 1 / 60, 1);
      }
      w.core = e.lockWant;
      tryLock(w, e);
      w.bossActive = false;
      continue;
    }
    askUntilSeal(w, e);
    assert.equal(w.seal.state, "asking");
    const pool = orbs(w, w.seal.serial);
    assert.ok(pool.length >= 2, "a seal was asked with nothing to choose between");
    onOrbTouched(w, pool[boss % pool.length] as Bullet);
    answered++;
    bossDefeated(w, e);
  }
  assert.equal(reports.length, answered);
  assert.ok(answered >= 5);
  for (const r of reports) {
    const q = served.find((s) => s.id === r.questionId);
    assert.ok(q, `reported an id nothing served: ${r.questionId}`);
    assert.ok(
      [q.answer, ...q.distractors].includes(r.answered),
      `reported ${JSON.stringify(r.answered)}, which was never an option for ${q.prompt}`,
    );
  }
});

test("an orb left over from a finished seal is never an answer to the next one", () => {
  const { host, reports, served } = fakeHost(CURRICULUM);
  const w = world(host);

  // Seal one: answer it WRONG. That deliberately leaves the correct orb hanging
  // on the field, and it carries `life = 40` — longer than the gap to the next
  // Bearer.
  launchBoss(w);
  const first = w.enemies[w.enemyN - 1] as Enemy;
  askUntilSeal(w, first);
  const q1 = served[0] as Question;
  const stale = orbs(w, w.seal.serial).find((b) => b.correct);
  assert.ok(stale);
  const staleValue = stale.v;
  const wrong = orbs(w, w.seal.serial).find((b) => !b.correct);
  assert.ok(wrong);
  onOrbTouched(w, wrong);
  assert.equal(reports.length, 1);
  assert.ok(stale.live, "the leftover orb is the whole point of this test");

  // Seal two, from a different Bearer with a different answer.
  w.bossActive = false;
  launchBoss(w);
  const second = w.enemies[w.enemyN - 1] as Enemy;
  askUntilSeal(w, second);
  const q2 = served[1] as Question;
  assert.notEqual(q2.answer, q1.answer, "the two seals must differ for this to mean anything");

  if (stale.live) {
    onOrbTouched(w, stale);
    assert.equal(
      reports.length,
      1,
      `a leftover orb worth ${String(staleValue)} was reported as an answer to ${q2.prompt}: ` +
        JSON.stringify(reports.at(1)),
    );
  }
  assert.equal(w.seal.state, "asking", "the leftover orb resolved a seal it does not belong to");
});

test("a defeated Bearer takes its orbs with it", () => {
  const { host } = fakeHost(CURRICULUM);
  const w = world(host);
  launchBoss(w);
  const e = w.enemies[w.enemyN - 1] as Enemy;
  askUntilSeal(w, e);
  const wrong = orbs(w, w.seal.serial).find((b) => !b.correct);
  assert.ok(wrong);
  onOrbTouched(w, wrong);
  assert.ok(orbs(w, w.seal.serial).some((b) => b.live), "nothing was left to clean up");
  bossDefeated(w, e);
  assert.equal(
    orbs(w, w.seal.serial).filter((b) => b.live).length,
    0,
    "an orb outlived the boss that dropped it",
  );
});

test("a seal with only one option is declined — that is not a question", () => {
  const errors: unknown[][] = [];
  const real = console.error;
  console.error = (...a: unknown[]) => errors.push(a);
  try {
    const { host, reports } = fakeHost([{ answer: "64", distractors: [] }]);
    const w = world(host);
    launchBoss(w);
    const e = w.enemies[w.enemyN - 1] as Enemy;
    askUntilSeal(w, e);
    assert.notEqual(w.seal.state, "asking", "a one-orb seal was asked");
    assert.equal(reports.length, 0, "a child was credited for touching the only thing on screen");
  } finally {
    console.error = real;
  }
  assert.ok(errors.length > 0);
});

// ---------------------------------------------------------------------------
// an item the game cannot draw is declined out loud, never drawn blank
// ---------------------------------------------------------------------------

test("an item with an answer this game cannot print is declined, not shown unlabelled", () => {
  const errors: unknown[][] = [];
  const real = console.error;
  console.error = (...a: unknown[]) => errors.push(a);
  try {
    const { host, reports } = fakeHost([{ answer: "1/2", distractors: ["1/3"] }]);
    const w = world(host);
    launchBoss(w);
    const e = w.enemies[w.enemyN - 1] as Enemy;
    askUntilSeal(w, e);
    assert.notEqual(w.seal.state, "asking", "an undrawable item was asked anyway");
    assert.equal(orbs(w, w.seal.serial).length, 0, "an undrawable item put orbs on the field");
    assert.equal(reports.length, 0);
  } finally {
    console.error = real;
  }
  assert.ok(errors.length > 0, "an item was silently dropped — the whole failure mode, again");
  const said = errors.map((line) => String(line[0])).join("\n");
  assert.match(said, /declined an item/);
  // And the rung it came from is named, not just the item — because refusing
  // the same rung six times and then going quiet is the soft-lock.
  assert.match(said, /capping the stream/);
});

test("a boss that could not ask does not sweep the playfield clean", () => {
  const real = console.error;
  console.error = () => {};
  try {
    const { host } = fakeHost([{ answer: "1/2", distractors: [] }]);
    const w = world(host);
    for (let i = 0; i < PACE.wardenEvery - 1; i++) w.bearerCount++;
    launchBoss(w);
    const e = w.enemies[w.enemyN - 1] as Enemy;
    // Right through the lock phase and its timeout, with the ask refused.
    for (let i = 0; i < 3000; i++) {
      w.t += 1 / 60;
      stepBoss(w, e, 1 / 60, 1);
    }
    // Its own chaff is still in flight. `killSealOrbs(serial 0)` would have
    // taken every bullet on the field with it.
    let live = 0;
    for (let i = 0; i < w.bulletN; i++) if ((w.bullets[i] as Bullet).live) live++;
    assert.ok(live > 0, "a declined ask wiped the playfield");
  } finally {
    console.error = real;
  }
});

test("every orb a Bearer drops carries a numeral", () => {
  const { host } = fakeHost(CURRICULUM);
  const w = world(host);
  for (let boss = 0; boss < 12; boss++) {
    launchBoss(w);
    const e = w.enemies[w.enemyN - 1] as Enemy;
    askUntilSeal(w, e);
    assert.equal(w.seal.state, "asking", "the Bearer never asked anything");
    const dropped = orbs(w, w.seal.serial);
    assert.equal(dropped.length, 4, `the Bearer dropped ${String(dropped.length)} orbs, not four`);
    for (const b of dropped) {
      assert.equal(b.labelled, 1, `an orb worth ${String(b.v)} was going to be drawn blank`);
    }
    w.bossActive = false;
  }
});

// ---------------------------------------------------------------------------
// pacing
// ---------------------------------------------------------------------------

test("the run does not get harder while a child is still reading", () => {
  const { host } = fakeHost(CURRICULUM);
  const w = world(host);
  // Ten minutes of wall clock and not one seal broken: a child taking their time
  // over an answer is not a thing this game charges for. (Shields are topped up
  // because nobody is flying the ship — the run has to survive to be measured.)
  for (let i = 0; i < 60 * 800; i++) {
    w.shields = 3;
    w.invuln = 1;
    if (w.phase !== "play") w.phase = "play";
    step(w, 1 / 60);
  }
  assert.ok(w.t > 300, `only ${String(w.t)}s elapsed`);
  assert.equal(w.stats.right, 0, "the run answered something on its own");
  assert.equal(
    w.stratum,
    0,
    `the run climbed to stratum ${String(w.stratum)} on the clock alone, ` +
      "with nothing answered — comprehension time is the child's, measured, never limited",
  );
});

test("the world still widens for a child who is flying and not answering", () => {
  const { host } = fakeHost(CURRICULUM);
  const w = world(host);
  assert.equal(rosterOf(w), 0);
  // Charge absorbed is the ship's own arithmetic, performed by flying. A child
  // doing that well meets more of the world without having answered anything.
  w.stats.absorbs = 200;
  assert.ok(rosterOf(w) > 0, "the sky stayed empty for a child who was playing well");
  assert.equal(stratumOf(w), 0, "absorbing charge is not answering a question");
});

test("the run gets harder on seals broken", () => {
  const { host } = fakeHost(CURRICULUM);
  const w = world(host);
  assert.equal(stratumOf(w), 0);
  w.stats.right = 3;
  assert.equal(stratumOf(w), 3);
  step(w, 1 / 60);
  assert.equal(w.stratum, 3);
  assert.ok(w.events.includes("stratum"), "nothing marked the depth the child earned");
});
