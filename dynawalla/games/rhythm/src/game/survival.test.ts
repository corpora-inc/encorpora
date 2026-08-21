/**
 * CAN A BEGINNER SURVIVE THIS, AND DOES IT EVER TAKE THEM BACK TO THE START?
 *
 * The founder, who is a drummer and a mathematician: *"It's too hard. … I can't
 * last more than a few seconds really. It should be easier to start."* And:
 * *"it shouldn't take you back to the beginning … it should flow with the
 * regular game and not be a reset … continue into further evolution adapting
 * the difficulty."*
 *
 * Every bot here strikes through `game.hit(lane, audioTime)` — the same call the
 * keyboard and the pointer make — on a hand-driven audio clock, so a four-minute
 * run plays in milliseconds and every bar line lands exactly where it would on a
 * device. Nothing forces a verdict, a heart level or a difficulty.
 *
 * Measured against `origin/main` before this branch, for the same bots:
 *
 *   | player   | run ended at | times |
 *   |----------|--------------|-------|
 *   | watching  |  3.14 s     |  74   |
 *   | moderate  | 44.46 s     |  16   |
 *
 * "Ended" meaning `enterBreakdown()`: notes deleted, tape stop, modal, and a
 * `reanchorSoft()` on the way out. The first question did not appear until
 * 12.69 s, so the watching player never saw one.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { installFakeAudio } from "../dev/fakeAudio.ts";

const audio = installFakeAudio();

const { Game, SPLITBEAT_FLOW } = await import("./core.ts");
const { createStubHost } = await import("../stubHost.ts");

import type { Host, Question } from "../contract.ts";
import { barSignature } from "./groove.ts";

/** What the founder could not survive: a few seconds of merely watching. */
const WATCHING_MUST_SURVIVE = 30;
/** A player of moderate skill must be able to play for four minutes. */
const MODERATE_MUST_SURVIVE = 240;

const LONG_RUN_SEC = 240;

type Bot = {
  /** probability of even attempting a given ordinary note */
  attempt: number;
  /** timing error, in ms, uniform +/- */
  jitterMs: number;
  /** what the bot does at a gate */
  gate: "right" | "wrong" | "never";
};

const WATCHING: Bot = { attempt: 0, jitterMs: 0, gate: "never" };
const MODERATE: Bot = { attempt: 0.7, jitterMs: 55, gate: "right" };
const FLAILING: Bot = { attempt: 0.15, jitterMs: 130, gate: "wrong" };

type Run = {
  seconds: number;
  /** clock seconds at which the heart first ran out, or Infinity */
  firstHeartOut: number;
  heartOuts: number;
  /** clock second the first question was readable */
  firstQuestionAt: number;
  /** every (item difficulty, delivered reading seconds) pair, in order */
  itemVsWindow: [number, number][];
  /** every (item difficulty, delivered strike half-window seconds) pair */
  itemVsStrike: [number, number][];
  intensity: number;
  difficulty: number;
  bpm: number;
  minIntensity: number;
  maxIntensity: number;
  notesHit: number;
  notesMissed: number;
  /** the transport's bar index at the end — proves the clock never rewound */
  bars: number;
  /** every planned bar as (start, duration), in the order they were planned */
  barSpans: [number, number][];
  /** every distinct bar pattern the run produced, in order of first appearance */
  patterns: string[];
  patternSeq: string[];
  reveals: number;
  /** every distinct lane that ever received an ordinary note */
  lanesUsed: Set<number>;
  /** lanes that received a note in the FIRST four bars */
  openingLanes: Set<number>;
};

function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * `Game.start()` arms a `setInterval` for the planner, and node keeps its event
 * loop — and therefore the whole test process — alive while one is pending. A
 * test that throws before reaching `game.destroy()` therefore HANGS the runner
 * rather than reporting a failure, which is the worst possible behaviour for an
 * assertion: it looks identical to a slow test, and it takes the rest of the
 * file with it. Found by mutation testing, when a deliberately broken build
 * turned a two-second run into a four-minute timeout.
 */
function closing(game: InstanceType<typeof Game>): Disposable {
  return { [Symbol.dispose]: () => game.destroy() };
}

/** A host that serves the pack's own generated questions, at the asked rung. */
function realHost(seed: number, asked: number[]): Host {
  const stub = createStubHost({ seed });
  return {
    next(opts): Question {
      asked.push(opts?.difficulty ?? 0);
      return stub.next(opts);
    },
    report() {},
    haptic() {},
    prefersReducedMotion: () => true,
  };
}

async function run(bot: Bot, seconds: number, seed = 7, startDifficulty?: number): Promise<Run> {
  const asked: number[] = [];
  const game = new Game(realHost(seed, asked));
  game.soundOn = false;
  if (startDifficulty !== undefined) game.difficulty = startDifficulty;
  const ctx = audio.latest();
  await game.start();
  using _ = closing(game);
  const pump = (game as unknown as { pump(): void }).pump.bind(game);
  const rnd = mulberry(seed * 7919 + 13);

  const out: Run = {
    seconds,
    firstHeartOut: Infinity,
    heartOuts: 0,
    firstQuestionAt: Infinity,
    itemVsWindow: [],
    itemVsStrike: [],
    intensity: 0,
    difficulty: 0,
    bpm: 0,
    minIntensity: Infinity,
    maxIntensity: -Infinity,
    notesHit: 0,
    notesMissed: 0,
    bars: 0,
    barSpans: [],
    patterns: [],
    patternSeq: [],
    reveals: 0,
    lanesUsed: new Set(),
    openingLanes: new Set(),
  };
  const seenPattern = new Set<string>();
  const seenGate = new Set<number>();
  const seenNote = new Set<number>();
  const bar0 = game.barGrid.map(() => -99);
  let prevDebt = false;
  let prevReveal: unknown = null;

  for (let i = 0; i < Math.round(seconds / 0.02); i++) {
    ctx.currentTime += 0.02;
    pump();
    const now = ctx.currentTime;

    if (!prevDebt && game.heartDebt) {
      out.heartOuts++;
      if (out.firstHeartOut === Infinity) out.firstHeartOut = now;
    }
    prevDebt = game.heartDebt;
    if (game.reveal && game.reveal !== prevReveal) out.reveals++;
    prevReveal = game.reveal;

    out.minIntensity = Math.min(out.minIntensity, game.intensity);
    out.maxIntensity = Math.max(out.maxIntensity, game.intensity);

    // A bar's pattern, sampled once, as it becomes current.
    for (let k = 0; k < game.barGrid.length; k++) {
      const bg = game.barGrid[k]!;
      if (bg.t === bar0[k] || bg.t < 0) continue;
      bar0[k] = bg.t;
      out.bars++;
      out.barSpans.push([bg.t, bg.dur]);
      const inBar = game.notes
        .filter((n) => n.active && !n.isChoice && n.time >= bg.t - 1e-9 && n.time < bg.t + bg.dur - 1e-9)
        .sort((a, b) => a.time - b.time);
      if (inBar.length === 0) continue;
      for (const n of inBar) {
        out.lanesUsed.add(n.lane);
        if (out.bars <= 4) out.openingLanes.add(n.lane);
      }
      const sig = barSignature(
        inBar.map((n) => ({ beat: 0, lane: n.lane, accent: n.accent, cell: n.cell, cells: n.cells })),
        bg.cells,
      );
      out.patternSeq.push(sig);
      if (!seenPattern.has(sig)) {
        seenPattern.add(sig);
        out.patterns.push(sig);
      }
    }

    for (const g of game.gates) {
      if (!g.active || seenGate.has(g.id) || !g.q) continue;
      const tile = game.notes.find((n) => n.active && n.isChoice && n.gateId === g.id);
      if (!tile) continue;
      seenGate.add(g.id);
      if (out.firstQuestionAt === Infinity) out.firstQuestionAt = g.revealAt;
      out.itemVsWindow.push([g.q.difficulty, tile.time - g.revealAt]);
      out.itemVsStrike.push([g.q.difficulty, tile.strikeSec]);
    }

    const due = now - 0.012;
    for (const note of game.notes) {
      if (!note.active || note.state !== 0) continue;
      if (Math.abs(note.time - due) > 0.015) continue;
      if (seenNote.has(note.time * 1e6 + note.lane)) continue;
      if (note.isChoice) {
        if (bot.gate === "never") continue;
        if (note.correct !== (bot.gate === "right")) continue;
        seenNote.add(note.time * 1e6 + note.lane);
        game.hit(note.lane, note.time + 0.012);
        continue;
      }
      seenNote.add(note.time * 1e6 + note.lane);
      if (rnd() >= bot.attempt) continue;
      game.hit(note.lane, note.time + ((rnd() * 2 - 1) * bot.jitterMs) / 1000 + 0.012);
    }

    game.update(0.02);
  }

  out.intensity = game.intensity;
  out.difficulty = game.difficulty;
  out.bpm = game.bpm;
  out.notesHit = game.notesHit;
  out.notesMissed = game.notesMissed;
  return out;
}

/* -------------------------------------------------- 1. survivable from cold */

test("a player who is merely WATCHING meets a question long before they meet a consequence", async () => {
  const r = await run(WATCHING, LONG_RUN_SEC);

  assert.ok(
    Number.isFinite(r.firstQuestionAt),
    "a watching player was never shown a question at all in four minutes",
  );
  assert.ok(
    r.firstQuestionAt < 9,
    `the first question did not appear until ${r.firstQuestionAt.toFixed(2)}s; on main it was ` +
      `12.69 s and the run was already over by then`,
  );
  assert.ok(
    r.firstHeartOut > WATCHING_MUST_SURVIVE,
    `a player who touched nothing ran the heart out after ${r.firstHeartOut.toFixed(2)}s; on main ` +
      `this was 3.14 s and the floor for it is ${WATCHING_MUST_SURVIVE}s`,
  );
  assert.ok(
    r.firstQuestionAt < r.firstHeartOut,
    `the consequence (${r.firstHeartOut.toFixed(2)}s) arrived before the first question ` +
      `(${r.firstQuestionAt.toFixed(2)}s), so a beginner is punished before being taught`,
  );
});

test("a player of MODERATE skill plays four minutes without the heart ever running out", async () => {
  const r = await run(MODERATE, MODERATE_MUST_SURVIVE);

  assert.ok(r.notesHit > 100, `the bot only landed ${r.notesHit} notes; it is not playing`);
  assert.ok(r.notesMissed > 20, `the bot missed only ${r.notesMissed}; it is not a MODERATE player`);
  assert.equal(
    r.heartOuts,
    0,
    `a 70%-accurate player ran the heart out ${r.heartOuts} time(s) in four minutes; on main ` +
      `the same bot broke down at 44.46 s and 16 times over the run`,
  );
});

/* ------------------------------------------- 2. the failure state is not a reset */

test("the heart running out does NOT stop the music, delete the field, or rewind the run", async () => {
  const r = await run(WATCHING, LONG_RUN_SEC);
  assert.ok(r.heartOuts > 0, "the heart never ran out, so this proves nothing — make the bot worse");

  // On main this was `phase = "breakdown"`, which the planner refuses to plan
  // in, plus `flushNotes()` and a `reanchorSoft()` on the way out.
  const game = new Game(realHost(3, []));
  game.soundOn = false;
  const ctx = audio.latest();
  await game.start();
  using _ = closing(game);
  const pump = (game as unknown as { pump(): void }).pump.bind(game);
  const inner = game as unknown as { oweHeart(): void; noteCursor: number };

  for (let i = 0; i < 600; i++) {
    ctx.currentTime += 0.02;
    pump();
    game.update(0.02);
  }
  const barsBefore = inner.noteCursor;
  const notesBefore = game.notes.filter((n) => n.active).length;
  const timesBefore = game.notes.filter((n) => n.active).map((n) => n.time).sort((a, b) => a - b);
  assert.ok(notesBefore > 0, "no notes were in flight, so nothing could be proven about deleting them");

  inner.oweHeart();

  assert.equal(game.phase, "playing", "the heart running out changed the phase — that IS the reset");
  assert.equal(
    game.notes.filter((n) => n.active).length,
    notesBefore,
    "notes in flight were deleted; the field must not be cleared",
  );
  assert.deepEqual(
    game.notes.filter((n) => n.active).map((n) => n.time).sort((a, b) => a - b),
    timesBefore,
    "a note already in flight had its time moved; the transport must not be re-seated",
  );
  assert.ok(
    inner.noteCursor >= barsBefore,
    `the bar cursor went backwards, from ${barsBefore} to ${inner.noteCursor}`,
  );

  // …and the run keeps planning bars, which a "breakdown" phase would not.
  for (let i = 0; i < 300; i++) {
    ctx.currentTime += 0.02;
    pump();
    game.update(0.02);
  }
  assert.ok(
    inner.noteCursor > barsBefore,
    "the transport stopped planning bars after the heart ran out; the music has stopped",
  );
});

test("the owed question is an ORDINARY gate, on the beat, in the lanes", async () => {
  const game = new Game(realHost(5, []));
  game.soundOn = false;
  const ctx = audio.latest();
  await game.start();
  using _ = closing(game);
  const pump = (game as unknown as { pump(): void }).pump.bind(game);
  const inner = game as unknown as { oweHeart(): void };
  for (let i = 0; i < 400; i++) {
    ctx.currentTime += 0.02;
    pump();
    game.update(0.02);
  }
  inner.oweHeart();
  assert.ok(game.heartDebt, "the debt was not raised");

  let tiles = 0;
  let banner: (typeof game.gates)[number] | undefined;
  for (let i = 0; i < 2500 && tiles === 0; i++) {
    ctx.currentTime += 0.02;
    pump();
    game.update(0.02);
    const t = game.notes.filter((n) => n.active && n.isChoice);
    if (t.length) {
      tiles = t.length;
      banner = game.gates.find((g) => g.active && g.id === t[0]!.gateId);
    }
  }
  assert.equal(tiles, 3, `the owed question produced ${tiles} tiles instead of three lanes of one`);
  assert.ok(banner, "the tiles belong to no gate");
  assert.ok(banner!.debt, "the owed gate is not flagged, so RESTART THE HEART would not be drawn on it");
  assert.ok(
    banner!.time - banner!.revealAt >= 6,
    `the owed question gave ${(banner!.time - banner!.revealAt).toFixed(2)}s to read; on main the ` +
      `revive question appeared in a modal with no lead at all`,
  );
});

test("a player who keeps running the heart out is never sent back to the beginning", async () => {
  const r = await run(FLAILING, LONG_RUN_SEC);
  assert.ok(r.heartOuts >= 2, `only ${r.heartOuts} heart-outs; this bot has to bottom out repeatedly`);
  assert.ok(r.bars > 60, `only ${r.bars} bars were played in four minutes of flailing`);

  // THE MUSIC IS CONTINUOUS. Every bar begins exactly where the one before it
  // ended — no gap, no overlap, no re-seat. `reanchorSoft()`, which the old
  // breakdown ran on its way out, sets the next bar to `now + LEAD_IN` and so
  // opens a hole here; there is no way to restart a transport without one.
  const spans = [...r.barSpans].sort((a, b) => a[0] - b[0]);
  for (let i = 1; i < spans.length; i++) {
    const [prevT, prevDur] = spans[i - 1]!;
    const [t] = spans[i]!;
    assert.ok(
      Math.abs(t - (prevT + prevDur)) < 1e-6,
      `bar ${i} starts at ${t.toFixed(3)}s but the bar before it ended at ` +
        `${(prevT + prevDur).toFixed(3)}s — a ${(t - prevT - prevDur).toFixed(3)}s seam in the music`,
    );
  }
  assert.ok(spans.length > 60, `only ${spans.length} bar spans were sampled`);
});

/* --------------------------------------------- 3. relief without reaching a gate */

test("MISSING NOTES eases the game — the channel that did not exist", async () => {
  // On main, `adjustDifficulty` moved on a gate outcome and nothing else, so a
  // player who never survived to reach a gate never got one gram of relief.
  const r = await run({ attempt: 0, jitterMs: 0, gate: "never" }, 120, 11, 9);
  assert.ok(
    r.difficulty < 5,
    `a player who landed nothing and answered nothing ended at difficulty ${r.difficulty.toFixed(2)}, ` +
      `having started at 9; missing notes must ease the game on their own`,
  );
  assert.ok(
    r.minIntensity < 0.2,
    `the world only ever came down to intensity ${r.minIntensity.toFixed(3)}`,
  );
});

test("relief comes from the NOTES themselves, not only from bottoming the heart out", async () => {
  // The test above passes even if per-note evidence is deleted, because running
  // the heart out ALSO steps the world down — so it cannot tell the two apart.
  // A 55%-accurate player never bottoms out, so this one can: every gram of the
  // relief below came from notes being missed and from nothing else.
  const r = await run({ attempt: 0.55, jitterMs: 40, gate: "never" }, 150, 17, 9);
  assert.equal(
    r.heartOuts,
    0,
    `the heart ran out ${r.heartOuts} time(s), so the relief could have come from there instead`,
  );
  assert.ok(r.notesMissed > 40, `only ${r.notesMissed} notes were missed; there is no evidence to act on`);
  assert.ok(r.notesHit > 40, `only ${r.notesHit} notes were landed; this is not a struggling player`);
  assert.ok(
    r.difficulty < 4,
    `a 55%-accurate player started at 9 and ended at ${r.difficulty.toFixed(2)} without ever ` +
      `bottoming out; the per-note channel is not steering`,
  );
});

test("LANDING notes keeps the heart, with no help from any question", async () => {
  // The other half of the same mechanism, isolated the same way: this player
  // answers nothing, so no gate can refill them. Only their own playing can.
  const r = await run({ attempt: 0.8, jitterMs: 45, gate: "never" }, MODERATE_MUST_SURVIVE, 19);
  assert.ok(r.notesMissed > 40, `only ${r.notesMissed} notes were missed; nothing was draining`);
  assert.equal(
    r.heartOuts,
    0,
    `an 80%-accurate player who never answered a question ran the heart out ${r.heartOuts} time(s); ` +
      `landing a note has to put charge BACK, or the meter is a countdown with extra steps`,
  );
});

test("the world comes DOWN and goes back UP on the same scalar", async () => {
  const struggling = await run(FLAILING, LONG_RUN_SEC, 11, 8);
  const thriving = await run({ attempt: 1, jitterMs: 8, gate: "right" }, LONG_RUN_SEC, 11, 2);

  assert.ok(
    struggling.difficulty < 4,
    `a struggling run started at 8 and ended at ${struggling.difficulty.toFixed(2)}`,
  );
  assert.ok(
    thriving.difficulty > 6,
    `a thriving run started at 2 and only reached ${thriving.difficulty.toFixed(2)}`,
  );
  assert.ok(
    struggling.bpm < thriving.bpm - 15,
    `the two runs ended ${(thriving.bpm - struggling.bpm).toFixed(0)} BPM apart; the tempo is ` +
      `supposed to breathe with the same scalar`,
  );
});

/* --------------------------------------------------- 4. continuous variability */

test("a long run does not repeat its tune", async () => {
  const r = await run({ attempt: 1, jitterMs: 10, gate: "right" }, LONG_RUN_SEC);
  assert.ok(r.patternSeq.length > 80, `only ${r.patternSeq.length} bars were sampled`);
  assert.ok(
    r.patterns.length >= 20,
    `four minutes produced only ${r.patterns.length} distinct bar patterns out of ` +
      `${r.patternSeq.length} bars; on main the same measurement produced ONE`,
  );
  // No eight-bar phrase repeats verbatim: the thing a player gets tired of is a
  // loop, not a shortage of shapes.
  const phrases = new Map<string, number>();
  for (let i = 0; i + 8 <= r.patternSeq.length; i++) {
    const key = r.patternSeq.slice(i, i + 8).join("|");
    phrases.set(key, (phrases.get(key) ?? 0) + 1);
  }
  const worst = Math.max(...phrases.values());
  assert.equal(worst, 1, `an eight-bar phrase repeated ${worst} times inside one run`);
});

test("every lane is playable from the very first bars", async () => {
  const r = await run({ attempt: 1, jitterMs: 10, gate: "right" }, 60);
  assert.deepEqual(
    [...r.openingLanes].sort(),
    [0, 1, 2],
    `the opening used lanes ${[...r.openingLanes].sort().join(",")}; on main lane 2 (HIGH) got ZERO ` +
      `notes at the opening, so the top third of the field was dead while the game killed you`,
  );
});

/* ------------------------------------------------ 5. the window, as delivered */

test("the DELIVERED reading window is exactly the item's plan, at every tempo", async () => {
  const r = await run({ attempt: 1, jitterMs: 8, gate: "right" }, LONG_RUN_SEC);
  assert.ok(r.itemVsWindow.length > 6, `only ${r.itemVsWindow.length} gates were measured`);
  assert.ok(r.bpm > 120, `the tempo only reached ${r.bpm.toFixed(0)} BPM; the coupling would not show`);

  const { answerPlan } = await import("./answer.ts");
  for (const [difficulty, delivered] of r.itemVsWindow) {
    const planned = answerPlan({ difficulty }).readSec;
    assert.ok(
      Math.abs(delivered - planned) < 1e-6,
      `an item of difficulty ${difficulty.toFixed(3)} was planned ${planned.toFixed(3)}s of reading ` +
        `and delivered ${delivered.toFixed(3)}s`,
    );
  }
  for (const [difficulty, strike] of r.itemVsStrike) {
    assert.equal(strike, answerPlan({ difficulty }).strikeSec);
  }

  // Sorted by item difficulty, the delivered windows must not fall.
  const sorted = [...r.itemVsWindow].sort((a, b) => a[0] - b[0]);
  let prev = -Infinity;
  for (const [difficulty, delivered] of sorted) {
    assert.ok(
      delivered >= prev - 1e-9,
      `a harder item (${difficulty.toFixed(3)}) was delivered ${delivered.toFixed(3)}s when an ` +
        `easier one had already been given ${prev.toFixed(3)}s`,
    );
    prev = delivered;
  }
});

/* ------------------------------------------------- 6. the reveal has no deadline */

test("a wrong answer completes the sum in front of the child", async () => {
  const r = await run({ attempt: 0, jitterMs: 0, gate: "wrong" }, LONG_RUN_SEC);
  assert.ok(r.reveals > 0, "no sum was ever completed in front of the player");
});

test("a completed sum has NO deadline — two minutes of clock cannot take it down", async () => {
  const { revealPlan, REVEAL_SETTLE_MS } = await import("../../../../packs/shared/game-pacing/index.ts");
  const plan = revealPlan(SPLITBEAT_FLOW, 0);
  assert.equal(plan.holdMs, Number.POSITIVE_INFINITY, "a shown reveal must never expire on its own");
  assert.equal(plan.settleMs, REVEAL_SETTLE_MS);

  const game = new Game(realHost(21, []));
  game.soundOn = false;
  const ctx = audio.latest();
  await game.start();
  using _ = closing(game);
  const pump = (game as unknown as { pump(): void }).pump.bind(game);

  // Play until a question's tiles are up, then strike a wrong one.
  let struck = false;
  for (let i = 0; i < 3000 && !struck; i++) {
    ctx.currentTime += 0.02;
    pump();
    game.update(0.02);
    const tile = game.notes.find(
      (n) => n.active && n.isChoice && !n.correct && Math.abs(n.time - ctx.currentTime) < 0.03,
    );
    if (tile) {
      game.hit(tile.lane, tile.time);
      struck = true;
    }
  }
  assert.ok(struck, "never reached a question to get wrong");
  assert.ok(game.reveal, "a wrong answer did not complete the sum");
  const held = game.reveal!;

  // Two minutes of frames, with the planner deliberately NOT pumped so no new
  // question can arrive. Nothing but the child may end this.
  for (let i = 0; i < 6000; i++) {
    ctx.currentTime += 0.02;
    game.update(0.02);
  }
  assert.equal(
    game.reveal,
    held,
    "the completed sum was taken down by the passage of time alone after 120 seconds",
  );
});

test("a tap still in flight cannot eat the sum before it has settled", async () => {
  const { REVEAL_SETTLE_MS } = await import("../../../../packs/shared/game-pacing/index.ts");
  const game = new Game(realHost(23, []));
  game.soundOn = false;
  const ctx = audio.latest();
  await game.start();
  using _ = closing(game);
  const inner = game as unknown as {
    reveal: unknown;
    showReveal(g: unknown): void;
    dismissReveal(): void;
  };
  const gate = game.gates[0]!;
  gate.q = { id: "q", prompt: "7 + 5", answer: "12", distractors: ["11", "13"], domain: "add-sub", difficulty: 0.2 };
  inner.showReveal(gate);
  assert.ok(game.reveal, "the reveal was not put up");

  // A hair inside the settle window: the sum survives.
  ctx.currentTime += (REVEAL_SETTLE_MS - 1) / 1000;
  inner.dismissReveal();
  assert.ok(game.reveal, `a tap ${REVEAL_SETTLE_MS - 1}ms after the reveal took it down`);

  // A hair outside: the child meant it.
  ctx.currentTime += 0.002;
  inner.dismissReveal();
  assert.equal(game.reveal, null, "the child's own next note must be able to end it");
});
