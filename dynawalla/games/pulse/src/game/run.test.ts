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
const { GATE_READ_SEC, Run, candidatesForStage } = await import("./run.ts");
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
  /** How many candidates each gate carried, in order, with its stage. */
  gateShapes: Array<{ stage: number; candidates: number; wrong: number }>;
  /** Every `session.transition` the run sent the host, in order. */
  transitions: Array<{ kind: string; label: string | undefined }>;
  play(seconds: number): void;
  dispose(): void;
};

/**
 * @param answer what the bot does: strike the right candidate at every gate,
 *               strike a wrong one, ignore gates but drum everything else, or —
 *               `"silent"` — put its hands in its pockets and touch nothing.
 *
 * `"silent"` exists because the other three cannot reach the stumble. A bot
 * that drums every ordinary note dead on earns back more health than a wrong
 * gate costs, so `rig("wrong", 4)` played for five minutes and never once fell
 * a stage — which made an assertion about what happens when a stage IS lost
 * vacuous, and it passed with the guard it was testing deleted. Missing
 * everything drains health at 0.05 a note and stumbles inside a stage.
 */
function rig(answer: "right" | "wrong" | "never" | "silent", startStage = 0): Rig {
  const reports: Report[] = [];
  const stages: number[] = [];
  const readingWindows: number[] = [];
  const outcomes: string[] = [];
  const gateShapes: Array<{ stage: number; candidates: number; wrong: number }> = [];
  const transitions: Array<{ kind: string; label: string | undefined }> = [];
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
    transition(kind, label) {
      transitions.push({ kind, label });
    },
  };

  const fx: Fx = {
    hit() {},
    miss() {},
    stray() {},
    gateOpen(built) {
      gateShapes.push({
        stage: run.stageIndex,
        candidates: built.candidates.length,
        wrong: built.candidates.filter((c) => !c.correct).length,
      });
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
  // A screen with room to spare, so what these runs measure is the STAGE's
  // ceiling on how many numbers a child is shown, not the phone's. `Run`
  // defaults to the smallest phone's answer until a layout tells it otherwise,
  // and a rig that left it there would be testing that default forever.
  run.setGateFit({ maxCandidates: 4, minGapDenom: 4 });
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
    if (answer === "silent") return;
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
    transitions,
    reports,
    stages,
    readingWindows,
    outcomes,
    gateShapes,
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

// --------------------------------------------------------------- the opening
//
// "starts too hard too ... it should start easy (and more sparse maybe with
// wrong answers)".
//
// The first fraction gate a child ever saw carried four candidates — one right
// and THREE wrong — because the single call site passed `maxCandidates: 4` and
// nothing about it ever moved. The rhythm escalated; the arithmetic did not.
// That is ARENA's defect in another costume: the opening frame was already
// carrying the twentieth minute's density.

test("the first question a child ever sees is sparse", () => {
  const r = rig("never");
  // Long enough to reach the first two gate bars of stage 0 and no further:
  // nothing has been cleared, so nothing escalates.
  r.play(90);
  const shapes = [...r.gateShapes];
  r.dispose();

  assert.ok(shapes.length > 0, "no gate opened at all; this test measured nothing");
  const first = shapes[0]!;
  assert.equal(first.stage, 0, "the first gate must belong to the first stage");
  assert.equal(
    first.wrong,
    1,
    `the first question a child is ever asked put ${first.wrong} wrong answers on the ` +
      `screen at once`,
  );
  for (const s of shapes) {
    assert.equal(s.stage, 0, "a bot that answers nothing must not escalate");
    assert.ok(
      s.candidates <= 2,
      `stage 0 served ${s.candidates} candidates; the opening is meant to be sparse`,
    );
    assert.ok(s.candidates >= 2, "and never a single unmissable target");
  }
});

test("density is part of the escalation, not a constant", () => {
  // Stated once as a rule, so the shape is not only inferable from a bot that
  // happens to reach stage 4.
  assert.equal(candidatesForStage(0), 2);
  assert.ok(
    candidatesForStage(0) < candidatesForStage(12),
    "a child deep in the run must be asked to discriminate between more numbers " +
      "than a child on their first bar",
  );
  let prev = 0;
  for (let i = 0; i < 30; i++) {
    const n = candidatesForStage(i);
    assert.ok(n >= prev, `stage ${i} is sparser than stage ${i - 1}`);
    assert.ok(n >= 2 && n <= 4, `stage ${i} wants ${n} candidates`);
    prev = n;
  }
});

test("a child who is climbing IS given more to discriminate between", () => {
  // The other half of the rule: sparse must not mean permanently sparse, or
  // the fix for "starts too hard" has quietly capped the whole game. Compared
  // against the opening rather than against a constant, because how many of the
  // host's distractors actually survive the spacing is the host's business.
  const opening = rig("never");
  opening.play(90);
  const openWidest = Math.max(...opening.gateShapes.map((s) => s.candidates));
  opening.dispose();

  const deep = rig("right", 6);
  deep.play(120);
  const shapes = [...deep.gateShapes];
  deep.dispose();

  assert.ok(shapes.length > 0, "no gate opened deep in the run");
  const widest = Math.max(...shapes.map((s) => s.candidates));
  assert.ok(
    widest > openWidest,
    `stage 6 offered at most ${widest} candidates and the opening offered ${openWidest}; ` +
      `the game has been flattened, not made gentle`,
  );
});

test("the viewport can hold the count down, but never below a real choice", () => {
  // A phone too small for four orbs must be given fewer, and a stage that wants
  // fewer must not be talked into more by a big screen. The run ANDs the two.
  const r = rig("right", 8);
  r.run.setGateFit({ maxCandidates: 2, minGapDenom: 3 });
  assert.equal(r.run.gateFit().maxCandidates, 2, "the screen's ceiling must bind");
  assert.equal(r.run.gateFit().minGapDenom, 3, "and its spacing must be used verbatim");
  r.run.setGateFit({ maxCandidates: 4, minGapDenom: 6 });
  assert.equal(
    r.run.gateFit().maxCandidates,
    candidatesForStage(r.run.stageIndex),
    "with room to spare the stage decides",
  );
  r.dispose();
});

// ── The groove, in a real run ────────────────────────────────────────────────
//
// The founder: *"pulse is somewhat improved but it needs to gradually evolve
// more — the main rhythm is static … Maybe being 'right' or 'wrong' should
// affect the beat in different ways."* These are the assertions that the
// machinery in `packs/shared/game-soundscape/evolve.ts` is actually reached by
// a thumb, rather than merely existing and being unit-tested next door.

/**
 * Play a rig and always tear it down, even when an assertion throws.
 *
 * A `Run` that is not disposed leaves its lookahead running, so a FAILING
 * assertion held the whole test file open until Node's own timeout — sixty
 * seconds of nothing where one line of red belonged. Found while
 * mutation-testing these very tests, which is what mutation-testing is for.
 */
function played(answer: "right" | "wrong" | "never" | "silent", seconds: number, startStage = 0) {
  const r = rig(answer, startStage);
  try {
    r.play(seconds);
    return { r, done: () => r.dispose() };
  } catch (error) {
    r.dispose();
    throw error;
  }
}

test("a run ages its groove, one phrase at a time and never faster", () => {
  const { r, done } = played("right", 180);
  try {
    const g = r.run.chart.groove;
    // 180 s at 80-96 BPM is roughly 60 bars, so about 15 phrases. The exact
    // count depends on how far the bot climbed; the claim is that it aged, in
    // phrases, and that it neither stood still nor raced.
    assert.ok(g.revision >= 8, `three minutes of play only aged the groove ${g.revision} times`);
    assert.ok(g.revision <= 40, `the groove aged ${g.revision} times in three minutes — that is not "slowly"`);
    assert.ok(g.bars >= g.revision * 4, "bars and mutations came apart");
  } finally {
    done();
  }
});

test("right and wrong steer the same run's groove in opposite directions", () => {
  // Two bots, one seed, one difference: what they do at a gate. Nothing else
  // about the run differs, so a difference in the groove is caused by the
  // arithmetic and by nothing else.
  const spec = { beatsPerBar: 4, divs: [1, 2], density: 0.34 };
  const net = (g: Rig["run"]["chart"]["groove"]): number => {
    const now = g.matrix(spec);
    const seed = g.seedMatrix(spec);
    let out = 0;
    for (let i = 1; i < now.length; i++) {
      const d = (now[i]?.affinity ?? 0) - (seed[i]?.affinity ?? 0);
      if (d >= 0.12) out++;
      else if (d <= -0.12) out--;
    }
    return out;
  };

  const right = played("right", 240);
  const wrong = played("wrong", 240);
  try {
    assert.ok(right.r.outcomes.includes("correct"), "the right bot never answered anything");
    assert.ok(wrong.r.outcomes.includes("wrong"), "the wrong bot never answered anything");
    assert.ok(
      net(right.r.run.chart.groove) > net(wrong.r.run.chart.groove),
      `right netted ${net(right.r.run.chart.groove)} and wrong netted ${net(wrong.r.run.chart.groove)} — the beat did not hear the difference`,
    );
    // And the miss left ROOM rather than a hole: the openness dial is up on the
    // bot that got everything wrong and down on the one that got it right.
    assert.ok(
      wrong.r.run.chart.groove.openness > right.r.run.chart.groove.openness,
      "a run of wrong answers left no more room than a run of right ones",
    );
  } finally {
    right.done();
    wrong.done();
  }
});

test("a stage climbed is a transition; a stage LOST is not", () => {
  // The host reads a transition as a licence to change the app's key, and the
  // SDK's rule is absolute: *"a transition is a thing the child finished, never
  // a thing that beat them"*. `checkStumble` steps a stage BACK through the
  // same method, so the two paths have to be told apart.
  const climbing = played("right", 300);
  try {
    assert.ok(climbing.r.run.stageIndex > 0, "the fixture never climbed, so this proves nothing");
    assert.ok(climbing.r.transitions.length > 0, "a stage was climbed and the host was never told");
    for (const t of climbing.r.transitions) assert.equal(t.kind, "level");
    assert.equal(
      climbing.r.transitions.length,
      climbing.r.run.stageIndex,
      "one transition per stage climbed, no more and no fewer",
    );
  } finally {
    climbing.done();
  }

  // A bot that touches nothing misses every note, drains its health, stumbles
  // and is stepped back down a stage. Not one of those is a transition. It has
  // to be `"silent"`: a bot that drums perfectly and only fumbles the sums
  // earns back more health than it loses and never falls at all — see `rig`.
  const falling = played("silent", 300, 4);
  try {
    assert.ok(
      falling.r.run.stageIndex < 4,
      `the fixture never lost a stage (ended at ${falling.r.run.stageIndex}), so this proves nothing`,
    );
    assert.equal(
      falling.r.transitions.length,
      0,
      "a failure was reported to the host as something the child finished",
    );
  } finally {
    falling.done();
  }
});
