/**
 * Audio and picture, on a device whose audio clock is coarse.
 *
 * "On chromebook the timing seems to be a little bit off for the music and the
 * visual. It must be 100% in sync to work."
 *
 * `AudioContext.currentTime` is published to the main thread once per output
 * callback and holds still in between, so any read of it is uniformly 0..q too
 * small. `q` is a property of the device's audio stack — 2.7 ms where a browser
 * manages a 128-frame quantum, 10-20 ms where it does not. The old code read it
 * raw and INDEPENDENTLY for two things: where to draw the notes, once a frame,
 * and what moment a tap happened at, on every tap. Two reads, two independent
 * errors, no relationship between them.
 *
 * These play the real transport through `FakeAudioContext` with a coarse
 * quantum and a hand-driven `performance.now()`, and the bot strikes on what it
 * can SEE — `run.nowBeat()`, the same number the renderer positions notes from —
 * rather than on a note's private schedule time. That is the whole point: a
 * child aims at the picture, so the picture is what the judge has to agree with.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { installFakeAudio, installFakeNow } from "../dev/fakeAudio.ts";

const nowClock = installFakeNow();
const audio = installFakeAudio();

const { Run } = await import("./run.ts");
const { BEATS_PER_BAR } = await import("./chart.ts");
const { TransportClock } = await import("../audio/clock.ts");
const { WINDOWS } = await import("./judge.ts");

import type { Host } from "../contract.ts";
import type { Fx } from "./run.ts";

/** A 960-frame output callback at 48 kHz. Chromebook-shaped, and legal. */
const COARSE_QUANTUM = 0.02;
const FRAME_SEC = 1 / 60;

const question = (n: number) => ({
  id: `q${n}`,
  prompt: `1/2 + 1/4 (${n})`,
  answer: "3/4",
  distractors: ["1/4", "1/2", "1/8"],
  domain: "fractions",
  difficulty: 0.5,
});

const silentFx = (): Fx => ({
  hit() {},
  miss() {},
  stray() {},
  gateOpen() {},
  gateResolved() {},
  bar() {},
  stageChanged() {},
  drop() {},
  stumble() {},
  overdrive() {},
  layerEarned() {},
});

const host = (): Host => {
  let n = 0;
  return {
    next: () => question(++n),
    report() {},
    haptic() {},
    prefersReducedMotion: () => true,
  };
};

// ------------------------------------------------------------------- the model

test("the transport recovers what a coarse audio callback throws away", () => {
  // A clock the game cannot see, and the rounded-down one it can.
  let truth = 0;
  let perf = 0;
  const visible = (): number => Math.floor(truth / COARSE_QUANTUM + 1e-9) * COARSE_QUANTUM;
  const clock = new TransportClock({ audio: visible, perf: () => perf });

  let worstModel = 0;
  let worstRaw = 0;
  // Frames deliberately NOT in phase with the callback: a test that samples on
  // the quantum boundary measures nothing. The first second is warm-up and is
  // not scored — the estimator cannot know where the boundary is until it has
  // seen one, and a run has a title screen and a count-in before a note lands.
  for (let i = 0; i < 360; i++) {
    const jitter = ((i * 7919) % 1000) / 1000000; // sub-millisecond, deterministic
    truth += FRAME_SEC + jitter;
    perf += FRAME_SEC + jitter;
    const model = Math.abs(clock.now() - truth);
    const raw = Math.abs(visible() - truth);
    if (i < 60) continue;
    worstModel = Math.max(worstModel, model);
    worstRaw = Math.max(worstRaw, raw);
  }

  // Proves the harness is exercising the defect rather than a perfect clock.
  assert.ok(
    worstRaw > COARSE_QUANTUM * 0.75,
    `the raw reading was only ${(worstRaw * 1000).toFixed(2)} ms out — the coarse ` +
      `clock is not being simulated and this test proves nothing`,
  );
  assert.ok(
    worstModel < 0.0025,
    `the transport was ${(worstModel * 1000).toFixed(2)} ms out against a raw ` +
      `${(worstRaw * 1000).toFixed(2)} ms; the model must not inherit the quantisation`,
  );
});

test("a suspended context does not leave the transport running ahead", () => {
  // Pause suspends the AudioContext, which freezes `currentTime` while
  // `performance.now()` keeps going. Bleeding that off at the drift rate would
  // take minutes; it has to re-anchor.
  let audioT = 0;
  let perf = 0;
  const clock = new TransportClock({ audio: () => audioT, perf: () => perf });
  for (let i = 0; i < 60; i++) {
    audioT += FRAME_SEC;
    perf += FRAME_SEC;
    clock.now();
  }
  // Two seconds of pause: the audio clock stands still.
  perf += 2;
  clock.now();
  for (let i = 0; i < 10; i++) {
    audioT += FRAME_SEC;
    perf += FRAME_SEC;
    clock.now();
  }
  assert.ok(
    Math.abs(clock.now() - audioT) < 0.01,
    `after a 2 s pause the transport was ${((clock.now() - audioT) * 1000).toFixed(0)} ms ` +
      `ahead of the audio clock`,
  );
});

// --------------------------------------------------------------- the whole game

test("a strike aimed at the drawn line is judged there, on a coarse clock", () => {
  /**
   * The player model: watch the field, and tap when the note is on the line.
   *
   * The tap does NOT happen at the same instant the frame was drawn — a pointer
   * event arrives when a thumb arrives, at some arbitrary phase inside the
   * frame, and that is the whole difficulty. A test that strikes in the same
   * tick as it looks would have BOTH reads land on the same rounded
   * `currentTime` and the two errors would cancel, which is how a broken
   * transport passes a lazy test.
   */
  const TAP_PHASE_SEC = 0.005;

  const deltas: number[] = [];
  const grades: string[] = [];
  const fx = silentFx();
  fx.hit = (_n, judgment, delta) => {
    deltas.push(delta);
    grades.push(judgment);
  };

  nowClock.set(0);
  const run = new Run({ host: host(), fx, seed: "sync" });
  const ctx = audio.latest();
  ctx.currentTime = 0;
  ctx.quantumSec = COARSE_QUANTUM;
  run.start();

  const struck = new Set<number>();
  for (let frame = 0; frame < 60 * 60; frame++) {
    ctx.advance(FRAME_SEC);
    nowClock.advance(FRAME_SEC * 1000);
    run.update();
    const beat = run.nowBeat();
    const wanted = run.notes
      .all()
      .filter((n) => n.judged === null && !struck.has(n.id) && !n.gate)
      .filter((n) => (n.beat - beat) / BEATS_PER_BAR <= 0);
    if (wanted.length === 0) continue;
    // The thumb lands part-way through the frame it decided on.
    ctx.advance(TAP_PHASE_SEC);
    nowClock.advance(TAP_PHASE_SEC * 1000);
    for (const n of wanted) {
      struck.add(n.id);
      run.input(n.lane, performance.now());
    }
  }
  run.dispose();

  assert.ok(deltas.length > 60, `only ${deltas.length} notes were struck; nothing was measured`);

  // Everything a strike can honestly be off by: the note crossed the line at
  // some point inside the frame that noticed, and the thumb landed at a fixed
  // phase after it. One frame, and no more. Anything wider than that came out
  // of the clock rather than out of the play.
  const spread = Math.max(...deltas) - Math.min(...deltas);
  assert.ok(
    spread <= FRAME_SEC * 1.25,
    `strikes aimed at the same drawn position were judged across a ` +
      `${(spread * 1000).toFixed(1)} ms band on a ${COARSE_QUANTUM * 1000} ms audio ` +
      `callback; one 60 Hz frame is ${(FRAME_SEC * 1000).toFixed(1)} ms and the rest is ` +
      `the audio clock's quantisation leaking into the judgment`,
  );
  assert.deepEqual(
    [...new Set(grades)],
    ["perfect"],
    `a player dead on the drawn line was graded ${[...new Set(grades)].join("/")}`,
  );
});

test("the picture is pushed forward to meet the display, not left behind it", () => {
  nowClock.set(0);
  const run = new Run({ host: host(), fx: silentFx(), seed: "lead" });
  const ctx = audio.latest();
  ctx.currentTime = 0;
  ctx.quantumSec = 0;
  run.start();
  for (let i = 0; i < 120; i++) {
    ctx.advance(FRAME_SEC);
    nowClock.advance(FRAME_SEC * 1000);
    run.update();
  }

  const heard = run.heard();
  assert.equal(run.shown(), heard, "with nothing being presented the lead must be zero");

  run.visualLeadSec = FRAME_SEC;
  assert.ok(
    Math.abs(run.shown() - (heard + FRAME_SEC)) < 1e-9,
    "the drawn moment must lead the heard moment by exactly the display's latency",
  );
  const drawn = run.nowBeat();
  run.visualLeadSec = 0;
  const behind = run.nowBeat();
  assert.ok(
    drawn > behind,
    "compensating the display must move the field FORWARD in the music, not back",
  );
  // And it is bounded: a frame of lead is a small fraction of a beat, never a
  // shortcut for scrolling the field faster.
  assert.ok(drawn - behind < 0.2, `a frame of lead moved the field ${drawn - behind} beats`);
  run.dispose();
});

test("transport time advances by what actually elapsed, not by a whole callback", () => {
  /**
   * The structural claim, and the one a same-instant test cannot make.
   *
   * Read the transport, let five milliseconds pass, read it again. The
   * difference must be five milliseconds. Read raw, `currentTime` has either
   * not moved at all or has jumped a whole callback, so the interval between a
   * frame and the tap aimed at it is reported as 0 ms or 20 ms and never as the
   * 5 ms it was — which is precisely the error the judge then scores.
   */
  const GAP_SEC = 0.005;
  nowClock.set(0);
  const run = new Run({ host: host(), fx: silentFx(), seed: "one-clock" });
  const ctx = audio.latest();
  ctx.currentTime = 0;
  ctx.quantumSec = COARSE_QUANTUM;
  run.start();
  for (let i = 0; i < 90; i++) {
    ctx.advance(FRAME_SEC);
    nowClock.advance(FRAME_SEC * 1000);
    run.update();
  }

  let worst = 0;
  for (let i = 0; i < 200; i++) {
    const before = run.heard();
    ctx.advance(GAP_SEC);
    nowClock.advance(GAP_SEC * 1000);
    const after = run.engine.timeAtPerf(performance.now() / 1000) - run.engine.latency();
    worst = Math.max(worst, Math.abs(after - before - GAP_SEC));
  }
  run.dispose();

  assert.ok(
    worst < 0.0015,
    `${GAP_SEC * 1000} ms between the frame and the tap aimed at it was reported as far ` +
      `as ${((worst + GAP_SEC) * 1000).toFixed(1)} ms — off by ${(worst * 1000).toFixed(1)} ms, ` +
      `which is the output callback, not the play`,
  );
  assert.ok(WINDOWS.perfect > 0);
});
