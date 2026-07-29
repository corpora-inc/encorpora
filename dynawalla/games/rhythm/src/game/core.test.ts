/**
 * Splitbeat, played by bots, on a hand-driven clock.
 *
 * The bots strike through `game.hit(lane, audioTime)` — the same call the
 * keyboard and the pointer make — and every assertion is about what the *host*
 * was told, what the *difficulty* did, or how long a question was on screen.
 * Nothing here forces a verdict or writes a score.
 *
 * They all drum the ordinary notes dead on, because missing notes costs charge
 * and a run at zero charge stops planning bars: a bot that only touched gates
 * would break down in the first eight seconds and prove nothing.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { installFakeAudio } from "../dev/fakeAudio.ts";

const audio = installFakeAudio();

// After the fake is installed, so `new AudioEngine()` finds it.
const { Game, MAX_CHARGE, READ_SEC } = await import("./core.ts");

import type { Host } from "../contract.ts";

type Report = { questionId: string; correct: boolean; ms: number; answered: string };

type Played = {
  difficulty: number;
  bpm: number;
  /** Gates the child actually answered. */
  answered: number;
  correct: number;
  charge: number;
  phase: string;
  reports: Report[];
  /** Seconds between a question appearing and its answer having to be struck. */
  readingWindows: number[];
  difficultyAsked: number[];
};

/**
 * @param answer what the bot does at a gate: strike the right tile, strike a
 *               wrong one, or leave it alone and let it close.
 */
async function play(
  answer: "right" | "wrong" | "never",
  seconds: number,
  startDifficulty = 1,
): Promise<Played> {
  const reports: Report[] = [];
  const difficultyAsked: number[] = [];
  const readingWindows: number[] = [];
  let n = 0;

  const host: Host = {
    next(opts) {
      n += 1;
      difficultyAsked.push(opts?.difficulty ?? 0);
      return {
        id: `q${n}`,
        prompt: `${n} + 3`,
        answer: "4",
        distractors: ["3", "6"],
        domain: "add-sub",
        difficulty: (opts?.difficulty ?? 1) / 10,
      };
    },
    report(r) {
      reports.push(r);
    },
    haptic() {},
    prefersReducedMotion() {
      return true;
    },
  };

  const game = new Game(host);
  game.difficulty = startDifficulty;
  game.soundOn = false;
  const ctx = audio.latest();
  await game.start();

  const pump = (game as unknown as { pump(): void }).pump.bind(game);
  const measured = new Set<number>();

  for (let i = 0; i < Math.round(seconds / 0.02); i++) {
    ctx.currentTime += 0.02;
    pump();

    // A choice tile exists once the gate bar is planned, so its strike time is
    // final. The window the child got is that time minus when the question
    // appeared.
    for (const note of game.notes) {
      if (!note.active || !note.isChoice || measured.has(note.gateId)) continue;
      const gate = game.gates.find((g) => g.active && g.id === note.gateId);
      if (!gate) continue;
      measured.add(note.gateId);
      readingWindows.push(note.time - gate.revealAt);
    }

    // `hit` finds the nearest pending note in the lane itself, so the bot only
    // has to say "there is something due in this lane, now".
    const due = ctx.currentTime - 0.012;
    for (const note of game.notes) {
      if (!note.active || note.state !== 0) continue;
      if (Math.abs(note.time - due) > 0.015) continue;
      if (note.isChoice) {
        if (answer === "never") continue;
        if (note.correct !== (answer === "right")) continue;
      }
      game.hit(note.lane, note.time + 0.012);
    }

    game.update(0.02);
  }

  const out: Played = {
    difficulty: game.difficulty,
    bpm: game.bpm,
    answered: game.gatesTotal,
    correct: game.gatesCorrect,
    charge: game.charge,
    phase: game.phase,
    reports,
    readingWindows,
    difficultyAsked,
  };
  game.destroy();
  return out;
}

/** Four minutes — long enough for the ladder to move several rungs. */
const LONG_RUN_SEC = 240;

test("a gate that expires reports NOTHING to the host", async () => {
  const r = await play("never", LONG_RUN_SEC);

  assert.ok(
    r.difficultyAsked.length > 4,
    `only ${r.difficultyAsked.length} gates were served; the bot has to have been asked things`,
  );
  assert.deepEqual(
    r.reports,
    [],
    "nobody struck a tile, so nobody answered; the host must hear nothing about it",
  );
  const filed: Report[] = r.reports;
  assert.equal(
    filed.find((x) => x.answered === "" && !x.correct),
    undefined,
    "motor lateness filed as an empty wrong answer is indistinguishable from not knowing the sum",
  );
});

test("a gate that expires does not move the difficulty and does not cost charge", async () => {
  const r = await play("never", LONG_RUN_SEC, 5);

  assert.ok(r.difficultyAsked.length > 4);
  assert.equal(
    r.difficulty,
    5,
    "a child who was still computing has said nothing about the maths; the ladder must not move",
  );
  assert.equal(r.charge, MAX_CHARGE, "the run was played perfectly; only the gates went unanswered");
  assert.equal(r.phase, "playing", "an unanswered gate must not be able to end a run on its own");
});

test("an answered gate reports the exact payload, right or wrong", async () => {
  const right = await play("right", 120);
  assert.ok(right.reports.length > 0);
  for (const report of right.reports) {
    assert.equal(report.correct, true);
    assert.equal(report.answered, "4");
    assert.match(report.questionId, /^q\d+$/);
    assert.ok(report.ms > 0 && Number.isInteger(report.ms));
  }

  const wrong = await play("wrong", 120);
  assert.ok(wrong.reports.length > 0);
  for (const report of wrong.reports) {
    assert.equal(report.correct, false);
    assert.notEqual(report.answered, "", "a struck tile always has a label on it");
  }
});

/**
 * SPLITBEAT was already the fleet's reference for this: it has never escalated
 * on the clock. The test is here to keep it that way.
 */
test("escalation is on the gate outcome, and only on the gate outcome", async () => {
  const right = await play("right", LONG_RUN_SEC);
  assert.ok(right.correct > 4, `only ${right.correct} gates were answered right`);
  assert.ok(
    right.difficulty > 1,
    "a child who is getting them right must be given harder maths",
  );
  assert.ok(
    Math.max(...right.difficultyAsked) > Math.min(...right.difficultyAsked),
    "the host must actually be asked for harder questions, not just told internally",
  );

  const wrong = await play("wrong", LONG_RUN_SEC, 5);
  assert.ok(wrong.answered > 4);
  assert.ok(
    wrong.difficulty < 5,
    `a run of nothing but wrong answers ended at difficulty ${wrong.difficulty}; it must come down`,
  );
});

test("the reading window never shrinks because the tempo went up", async () => {
  const r = await play("right", LONG_RUN_SEC);

  assert.ok(r.readingWindows.length > 4, "no gates were measured");
  assert.ok(r.difficulty > 3, `the run only reached difficulty ${r.difficulty}; push it harder`);
  assert.ok(r.bpm > 110, `the tempo only reached ${r.bpm} BPM; the coupling would not show`);

  const worst = Math.min(...r.readingWindows);
  assert.ok(
    worst >= READ_SEC,
    `a child got ${worst.toFixed(2)}s to read a question at ${r.bpm} BPM; the floor is ` +
      `${READ_SEC}s and it must not fall as the music speeds up`,
  );
});
