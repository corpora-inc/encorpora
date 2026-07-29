/**
 * The run, played by bots, on a hand-driven clock.
 *
 * Nothing here reaches into `Run` to award a point or force a stage. The bots
 * strike through `run.input(lane, perfMs)` — the same call a thumb makes,
 * including the clock conversion and the judgment windows — and every
 * assertion is about what the *host* was told or what the *stage* did.
 *
 * `FakeAudioContext.currentTime` is the only clock PULSE reads, so advancing it
 * in 20 ms steps plays a real four-minute run in a few milliseconds. Steps have
 * to stay under 0.6 s: a longer gap is what `Run.update` calls a stall, and it
 * sweeps notes off the board unjudged rather than punishing a child for a hitch
 * the game caused — so a coarser step would silently stop testing the misses.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { installFakeAudio } from "../dev/fakeAudio.ts";

const audio = installFakeAudio();

// After the fake is installed, so `createEngine()` finds it.
const { GATE_READ_SEC, Run } = await import("./run.ts");
const { gatesToClear, stageAt } = await import("./stages.ts");

import type { Host } from "../contract.ts";
import type { Fx } from "./run.ts";
import type { LiveNote } from "./judge.ts";

type Report = { questionId: string; correct: boolean; ms: number; answered: string };

/**
 * `dynawalla-app/src/packs/items.ts` moves the arithmetic ladder UP only on
 * `verdict.correct && latencyMs <= QUICK_MS`, and `QUICK_MS` is 6000. A game
 * that reports a latency structurally above it can never raise the maths a
 * child is served, however well they play — which is the same defect as
 * escalating on the clock, wearing a different hat.
 */
const HOST_QUICK_MS = 6000;

/** 3/4 is in the bar, so the gate stays a number line. */
function question(n: number) {
  return {
    id: `q${n}`,
    prompt: `1/2 + 1/4 (${n})`,
    answer: "3/4",
    distractors: ["1/4", "1/2", "1/8"],
    domain: "fractions",
    difficulty: 0.5,
  };
}

type Rig = {
  run: InstanceType<typeof Run>;
  reports: Report[];
  /** Stage indices the run actually reached, in order. */
  stages: number[];
  /** Audio-clock seconds between a gate appearing and its answer arriving. */
  readingWindows: number[];
  /** Every `gateResolved` outcome, in order. */
  outcomes: string[];
  play(seconds: number): void;
  dispose(): void;
};

/**
 * @param answer what the bot does at every gate: strike the right candidate,
 *               strike a wrong one, or nothing at all.
 */
function rig(answer: "right" | "wrong" | "never", startStage = 0): Rig {
  const reports: Report[] = [];
  const stages: number[] = [];
  const readingWindows: number[] = [];
  const outcomes: string[] = [];
  let n = 0;

  const host: Host = {
    next() {
      n += 1;
      return question(n);
    },
    report(r) {
      reports.push(r);
    },
    haptic() {},
    prefersReducedMotion() {
      return true;
    },
  };

  const fx: Fx = {
    hit() {},
    miss() {},
    stray() {},
    gateOpen(built) {
      // The window a child gets to read this question: from the moment it is
      // on screen to the moment the right answer crosses the strike line.
      const target = run.notes
        .all()
        .find((x) => x.gate?.questionId === built.questionId && x.gate.correct);
      if (target) readingWindows.push(target.time - ctx.currentTime);
    },
    gateResolved(outcome) {
      outcomes.push(outcome);
    },
    bar() {},
    stageChanged(_spec, index) {
      stages.push(index);
    },
    drop() {},
    stumble() {},
    overdrive() {},
    layerEarned() {},
  };

  const run = new Run({ host, fx, seed: "bots", startStage });
  const ctx = audio.latest();
  run.start();

  const planned = new Set<number>();

  /** Strike a note by working back through the same conversion `input` does. */
  const strike = (note: LiveNote, lane: number): void => {
    const offset = ctx.currentTime - performance.now() / 1000;
    const perfMs = (note.time - offset + 0.012) * 1000;
    run.input(lane, perfMs);
  };

  /**
   * The bot drums every ordinary note dead on. That is not decoration: missing
   * them drains health, and a stumble steps the stage back down, so a bot that
   * only ever touched gates would spend the whole run pinned to stage 0 and
   * prove nothing about the stages above it.
   */
  const botTick = (): void => {
    const heard = run.heard();
    for (const note of run.notes.all()) {
      if (note.judged !== null || planned.has(note.id)) continue;
      if (Math.abs(note.time - heard) > 0.02) continue;
      if (note.gate) {
        if (answer === "never") continue;
        const wanted = answer === "right" ? note.gate.correct : !note.gate.correct;
        if (!wanted) continue;
      }
      planned.add(note.id);
      // A gate tile is struck from a lane it is NOT in, on purpose: its position
      // in the bar is its value and the lane your thumb was over is not part of
      // the answer. If that licence ever narrows, these runs stop resolving.
      strike(note, note.gate ? (note.lane + 2) % 3 : note.lane);
    }
  };

  const step = (): void => {
    ctx.currentTime += 0.02;
    botTick();
    run.update();
  };

  return {
    run,
    reports,
    stages,
    readingWindows,
    outcomes,
    play(seconds) {
      const steps = Math.round(seconds / 0.02);
      for (let i = 0; i < steps; i++) step();
    },
    dispose() {
      run.dispose();
    },
  };
}

/** Four minutes. Long past the point where the old bar counter had climbed. */
const LONG_RUN_SEC = 240;

test("a bot that answers every gate WRONG never leaves the first stage", () => {
  const r = rig("wrong");
  r.play(LONG_RUN_SEC);
  const reached = Math.max(0, ...r.stages);
  r.dispose();

  assert.ok(
    r.run.gatesSeen > 4,
    `the bot has to have actually been asked things; it saw ${r.run.gatesSeen} gates`,
  );
  assert.equal(r.run.gatesCorrect, 0, "the bot answered everything wrong, by construction");
  assert.equal(
    reached,
    0,
    `a run with no correct gate reached stage ${reached}; escalation is on achievement, not bars`,
  );
});

test("a bot that never answers at all never leaves the first stage either", () => {
  const r = rig("never");
  r.play(LONG_RUN_SEC);
  const reached = Math.max(0, ...r.stages);
  r.dispose();

  assert.ok(r.run.gatesSeen > 4);
  assert.equal(reached, 0, `surviving ${LONG_RUN_SEC}s reached stage ${reached}`);
});

test("a bot that answers every gate RIGHT does climb", () => {
  const r = rig("right");
  r.play(LONG_RUN_SEC);
  const reached = Math.max(0, ...r.stages);
  const correct = r.run.gatesCorrect;
  r.dispose();

  assert.ok(correct > 2, `the bot only got ${correct} gates right; it should get nearly all`);
  assert.ok(reached > 0, "a child who is getting them right must be given harder rhythm");
});

test("a stage is passed on gates cleared, not on bars survived", () => {
  // The rule itself, stated once, so the shape is not only inferable from a bot.
  for (let i = 0; i < 12; i++) {
    const spec = stageAt(i);
    assert.ok(gatesToClear(spec) >= 1, `stage ${i} must need at least one right answer`);
  }
});

test("a gate that expires reports NOTHING to the host", () => {
  const r = rig("never");
  r.play(LONG_RUN_SEC);
  const seen = r.run.gatesSeen;
  const reports = [...r.reports];
  r.dispose();

  assert.ok(seen > 4, `only ${seen} gates were served`);
  assert.deepEqual(
    reports,
    [],
    "a gate nobody struck is a question nobody answered; the host must hear nothing about it",
  );
  const filed: Report[] = reports;
  assert.equal(
    filed.find((x) => x.answered === "" && !x.correct),
    undefined,
    "an empty response filed as an attempt is a wrong answer the child never gave",
  );
});

test("an answered gate reports the exact payload, right or wrong", () => {
  const right = rig("right");
  right.play(60);
  const goodReports = [...right.reports];
  right.dispose();

  assert.ok(goodReports.length > 0, "the bot answered gates; something must have been reported");
  for (const report of goodReports) {
    assert.equal(report.correct, true);
    assert.equal(report.answered, "3/4");
    assert.match(report.questionId, /^q\d+$/);
    assert.ok(report.ms >= 1 && Number.isInteger(report.ms));
  }

  const wrong = rig("wrong");
  wrong.play(60);
  const badReports = [...wrong.reports];
  wrong.dispose();

  assert.ok(badReports.length > 0);
  for (const report of badReports) {
    assert.equal(report.correct, false);
    assert.notEqual(report.answered, "", "a struck candidate always has a label");
  }
});

test("the reading window never shrinks because the tempo went up", () => {
  // Stage 9 is deep in the endless loop: 113+ BPM, the shortest bars the game
  // ever plays, and the hardest fractions the host will serve.
  for (const startStage of [0, 4, 9, 14]) {
    const r = rig("right", startStage);
    r.play(120);
    const windows = [...r.readingWindows];
    r.dispose();

    assert.ok(windows.length > 0, `no gate opened at stage ${startStage}`);
    const worst = Math.min(...windows);
    assert.ok(
      worst >= GATE_READ_SEC,
      `at stage ${startStage} a child got ${worst.toFixed(2)}s to read a question; ` +
        `the floor is ${GATE_READ_SEC}s and it must not depend on the tempo`,
    );
  }
});

test("a correct answer is reported as a latency the host can still climb on", () => {
  // Not decoration: the reported `ms` used to run from the moment the question
  // APPEARED, and the reading-window floor put that above HOST_QUICK_MS by
  // construction. A child answering every gate right would then have been held
  // on the easiest rung of the host's ladder for the whole session.
  for (const startStage of [0, 6, 12]) {
    const r = rig("right", startStage);
    r.play(120);
    const reports = [...r.reports];
    r.dispose();

    assert.ok(reports.length > 0, `no gate was answered at stage ${startStage}`);
    const slowest = Math.max(...reports.map((x) => x.ms));
    assert.ok(
      slowest < HOST_QUICK_MS,
      `at stage ${startStage} the slowest correct answer reported ${slowest}ms; the host ` +
        `stops raising the maths above ${HOST_QUICK_MS}ms, so the ladder would never move`,
    );
  }
});

test("every gate served is resolved exactly once, even at the top of the loop", () => {
  // At 168 BPM a gate comes every 5 bars — 7.1 s — against a 6 s scheduling
  // horizon plus the expiry window, so the next gate bar is filled while the
  // last gate is still live. The single `gate` slot has to be cleared on
  // purpose; overwritten, its candidates stay strikeable and a stale tap
  // resolves the question being served right now.
  const r = rig("never", 40);
  r.play(180);
  const seen = r.run.gatesSeen;
  const expired = r.outcomes.filter((o) => o === "expired").length;
  r.dispose();

  assert.ok(seen > 8, `only ${seen} gates were served at the top of the loop`);
  assert.ok(
    expired >= seen - 1,
    `${seen} gates were served but only ${expired} ever resolved — the rest were ` +
      `overwritten in the slot while still live`,
  );
});
