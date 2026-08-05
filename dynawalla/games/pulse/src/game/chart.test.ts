import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MODES,
  pickSoundscape,
  type Soundscape,
} from "../../../../packs/shared/game-soundscape/index.ts";
import { hashSeed } from "../rng.ts";
import {
  bandBeats,
  barNotes,
  BEATS_PER_BAR,
  chartContext,
  laneKinds,
  laneVoices,
  _clearChartCache,
  type ChartContext,
  type ChartNote,
  type NoteKind,
} from "./chart.ts";
import { LANE_UP_ACCURACY, readyForMoreLanes, STAGES, stageAt } from "./stages.ts";

const KINDS: readonly NoteKind[] = ["kick", "snare", "hat", "tom"];

/**
 * A run's context, as `Run` builds one: a seed, whatever key the app is in, and
 * the living groove that walks away from it.
 *
 * Built through `chartContext` rather than by hand so that a test cannot get a
 * context the game could never produce — which is what happened to the version
 * of this helper that spelled the object out and then had to be taught about a
 * new field.
 */
function ctx(seed: string, scape?: Soundscape): ChartContext {
  return chartContext(seed, scape ?? pickSoundscape(hashSeed(seed)));
}

/** What a child would hear from one bar: the instants and the hands. */
function barSig(stage: number, c: ChartContext, bar: number): string {
  return barNotes(stageAt(stage), c, bar)
    .map((n) => `${n.beatInBar.toFixed(3)}/${n.lane}`)
    .join(" ");
}

function freshSeeds(n: number): ChartContext[] {
  return Array.from({ length: n }, (_, i) => ctx(`run-${i}-${(i * 2654435761) % 99991}`));
}

// ---------------------------------------------------------------- determinism

test("the same seed and bar is always the same bar", () => {
  const c = ctx("seed-a");
  const a = barNotes(STAGES[3]!, c, 17);
  _clearChartCache();
  const b = barNotes(STAGES[3]!, c, 17);
  assert.deepEqual(a, b);
  _clearChartCache();
  const d = barNotes(STAGES[3]!, ctx("seed-b"), 17);
  assert.notDeepEqual(a, d);
});

test("a seed replays a whole session exactly, cache cold or warm", () => {
  const play = (): string[] => {
    _clearChartCache();
    const c = ctx("replay-me");
    const out: string[] = [];
    for (let s = 0; s < 6; s++) for (let b = 0; b < 12; b++) out.push(barSig(s, c, b));
    return out;
  };
  const first = play();
  assert.ok(first.some((s) => s.length > 0), "a replay of nothing proves nothing");
  assert.deepEqual(play(), first);
});

// ---------------------------------------------- the founder's actual question

test("two fresh runs are two different charts, from the very first bar", () => {
  const runs = freshSeeds(24);
  for (const stage of [0, 1, 2, 3, 4]) {
    const bar0 = new Set<string>();
    const first4 = new Set<string>();
    for (const c of runs) {
      _clearChartCache();
      bar0.add(barSig(stage, c, 0));
      first4.add([0, 1, 2, 3].map((b) => barSig(stage, c, b)).join("|"));
    }
    /**
     * Before this change stage 0 produced ONE bar-0 across 24 fresh runs: the
     * same four quarter notes, every single time anyone opened the game.
     *
     * The bar the thresholds are set at is the size of the space, because that
     * is the only honest bar. Stage 0's grid is four instants wide and one of
     * them is the downbeat, so there are exactly EIGHT bars it can possibly
     * produce; a one-lane stage also has no hand to choose, which halves the
     * space again. Asking a four-slot grid for the spread a twelve-slot grid
     * can give is asking for a bar that does not exist. Asking it for most of
     * the space it HAS is the real claim — and one it failed 1-to-8 before.
     */
    const oneLane = stageAt(stage).lanes === 1;
    const wantBars = stage === 0 ? 6 : oneLane ? 10 : 15;
    const wantPhrases = oneLane ? 12 : 18;
    assert.ok(
      bar0.size >= wantBars,
      `stage ${stage}: only ${bar0.size} distinct opening bars across 24 fresh runs`,
    );
    assert.ok(
      first4.size >= wantPhrases,
      `stage ${stage}: only ${first4.size} distinct opening phrases across 24 fresh runs`,
    );
  }
});

test("the key the app is in really changes the groove", () => {
  /**
   * Held fixed: the seed, so the RNG stream is bit-for-bit the same in every
   * column. The ONLY thing that varies is the mode, and the only path from the
   * mode to a note is `grooveMatrix`. If that stopped reading the mode this
   * would be one groove repeated, which is precisely what it asserts against —
   * an earlier version of this test salted the RNG with the mode id and passed
   * with the matrix switched off.
   */
  const modes = [
    "western.ionian",
    "western.hirajoshi",
    "western.minorPentatonic",
    "maqam.rast",
    "maqam.saba",
    "thaat.todi",
  ];
  let pairs = 0;
  let differed = 0;
  for (let s = 0; s < 12; s++) {
    const seed = `same-child-${s}`;
    const sigs = modes.map((modeId) => {
      _clearChartCache();
      const c = ctx(seed, { modeId, rootHz: 130.81, seed: 4242, tension: 0.2 });
      return Array.from({ length: 16 }, (_, b) => barSig(4, c, b)).join("|");
    });
    assert.ok(sigs[0]!.length > 0, "an empty chart would make every key look alike");
    for (let i = 0; i < sigs.length; i++) {
      for (let j = i + 1; j < sigs.length; j++) {
        pairs++;
        if (sigs[i] !== sigs[j]) differed++;
      }
    }
  }
  // Not all of them: several of the 38 modes are one degree apart, and two
  // near-identical scales projected onto a twelve-slot bar can land on the same
  // draws. Four in five is the measured figure and the honest claim.
  assert.ok(
    differed >= pairs * 0.8,
    `only ${differed} of ${pairs} key pairs grooved differently from one seed`,
  );
});

test("every stage still teaches its own subdivision, in all 38 modes", () => {
  /**
   * The counterweight to letting the key shape the bar.
   *
   * A mode may make an instant three times rarer than another, so it must not
   * be able to make one vanish: TRIPLETS has to contain triplets whatever key
   * the app launched in, or the game silently stops teaching the thing its
   * stage card names. Measured over the stage's own length, because a single
   * bar of plain quarters inside an eighths stage is music, not a defect.
   */
  for (const stage of STAGES) {
    const fastest = Math.max(...stage.divs);
    if (fastest === 1) continue;
    for (const mode of MODES) {
      const c = ctx("subdivision", { modeId: mode.id, rootHz: 130.81, seed: 11, tension: 0.2 });
      _clearChartCache();
      let found = 0;
      for (let b = 0; b < stage.bars; b++) {
        for (const n of barNotes(stage, c, b)) if (n.div === fastest) found++;
      }
      assert.ok(
        found > 0,
        `${stage.title} in ${mode.id} never played a 1/${fastest * 4} in ${stage.bars} bars`,
      );
    }
  }
});

test("a run with no published soundscape still gets a groove, and a stable one", () => {
  const a = chartContext("no-host");
  const b = chartContext("no-host");
  assert.equal(a.scape.modeId, b.scape.modeId, "one seed must always mean one key");
  assert.equal(a.seed, "no-host");
  assert.ok(a.scape.modeId.length > 0, "a run must always have a key to groove in");
});

// ------------------------------------------------------------------- playable

test("every bar is playable: in range, in bounds, and not a wall", () => {
  for (let s = 0; s < 14; s++) {
    const stage = stageAt(s);
    const c = ctx("playable");
    for (let bar = 0; bar < 24; bar++) {
      const notes = barNotes(stage, c, bar);
      assert.ok(notes.length > 0, `stage ${s} bar ${bar} is empty`);
      assert.ok(notes.length <= 30, `stage ${s} bar ${bar} has ${notes.length} notes`);
      for (const n of notes) {
        assert.ok(n.beatInBar >= 0 && n.beatInBar < BEATS_PER_BAR, `beat ${n.beatInBar} out of bar`);
        assert.ok(n.lane >= 0 && n.lane < stage.lanes, `lane ${n.lane} outside ${stage.lanes}`);
        assert.ok(KINDS.includes(n.kind), `unplayable voice ${n.kind}`);
      }
    }
  }
});

test("no lane is ever asked for two notes at the same instant", () => {
  for (let s = 0; s < 14; s++) {
    const stage = stageAt(s);
    for (let bar = 0; bar < 16; bar++) {
      const seen = new Set<string>();
      for (const n of barNotes(stage, ctx("collide"), bar)) {
        const key = `${n.lane}:${n.beatInBar.toFixed(4)}`;
        assert.ok(!seen.has(key), `stage ${s} bar ${bar}: duplicate at ${key}`);
        seen.add(key);
      }
    }
  }
});

test("hands stay physically possible, including across the bar line", () => {
  for (let s = 0; s < 14; s++) {
    const stage = stageAt(s);
    const spb = 60 / stage.bpm;
    const byLane = new Map<number, number[]>();
    for (let bar = 0; bar < 16; bar++) {
      for (const n of barNotes(stage, ctx("speed"), bar)) {
        const arr = byLane.get(n.lane) ?? [];
        arr.push(bar * BEATS_PER_BAR + n.beatInBar);
        byLane.set(n.lane, arr);
      }
    }
    for (const [lane, beats] of byLane) {
      beats.sort((a, b) => a - b);
      for (let i = 1; i < beats.length; i++) {
        const ms = (beats[i]! - beats[i - 1]!) * spb * 1000;
        assert.ok(ms >= 85, `stage ${s} lane ${lane}: ${ms.toFixed(1)} ms apart`);
      }
    }
  }
});

test("the downbeat is always there — the groove has an anchor", () => {
  for (let s = 0; s < STAGES.length; s++) {
    for (const c of freshSeeds(6)) {
      for (let bar = 0; bar < 8; bar++) {
        assert.ok(
          barNotes(STAGES[s]!, c, bar).some((n) => n.beatInBar === 0),
          `stage ${s} bar ${bar} has no downbeat`,
        );
      }
    }
  }
});

test("a polyrhythm stage really lays N notes evenly across the bar", () => {
  const stage = STAGES.find((s) => s.poly?.perBar === 3)!;
  assert.ok(stage.poly);
  const notes = barNotes(stage, ctx("poly"), 4).filter((n) => n.div === -stage.poly!.perBar);
  assert.equal(notes.length, stage.poly!.perBar);
  const beats = notes.map((n) => n.beatInBar).sort((a, b) => a - b);
  for (let i = 0; i < beats.length; i++) {
    assert.ok(
      Math.abs(beats[i]! - (i * BEATS_PER_BAR) / stage.poly!.perBar) < 1e-6,
      `poly note ${i} at ${beats[i]}`,
    );
  }
});

test("a phrase restates itself rather than being fresh noise every bar", () => {
  const sig = (c: ChartContext, bar: number): string[] =>
    barNotes(STAGES[2]!, c, bar)
      .map((n) => `${n.lane}@${n.beatInBar}`)
      .sort();
  let held = 0;
  const runs = freshSeeds(10);
  for (const c of runs) {
    _clearChartCache();
    const a = sig(c, 0);
    assert.ok(a.length > 0, "an empty bar cannot restate anything");
    const b = new Set(sig(c, 2));
    if (a.filter((x) => b.has(x)).length >= a.length * 0.7) held++;
  }
  assert.ok(held >= 9, `only ${held} of 10 runs restated their motif in bar 2`);
});

// ----------------------------------------------------------- sparse, and long

test("the opening stays sparse: notes per bar over the written ladder", () => {
  const perBar = (s: number): number => {
    let total = 0;
    let bars = 0;
    for (const c of freshSeeds(12)) {
      _clearChartCache();
      for (let b = 0; b < 8; b++) {
        total += barNotes(stageAt(s), c, b).length;
        bars++;
      }
    }
    return total / bars;
  };
  const opening = perBar(0);
  // Before: exactly 4.0 — every quarter of every bar, saturated by construction.
  assert.ok(opening <= 2.8, `the first stage averages ${opening.toFixed(2)} notes a bar`);
  assert.ok(opening >= 1.5, `the first stage averages ${opening.toFixed(2)} notes a bar — too empty`);
  // Two lanes arrive without the bar suddenly doubling. Before: 8.0 flat.
  const twoHands = perBar(2);
  assert.ok(twoHands <= 4.2, `TWO HANDS averages ${twoHands.toFixed(2)} notes a bar`);
  // The top of the written ladder is busier than the bottom, but not by much.
  const top = perBar(STAGES.length - 1);
  assert.ok(top > opening, "the ladder must climb");
  assert.ok(top <= 9, `the last written stage averages ${top.toFixed(2)} notes a bar`);
});

test("notes per SECOND rises slowly, and is gentle for the first two minutes", () => {
  const c = ctx("curve");
  const buckets: number[] = [];
  let t = 0;
  for (let s = 0; s < 20 && t < 300; s++) {
    const stage = stageAt(s);
    _clearChartCache();
    const barSec = (BEATS_PER_BAR * 60) / stage.bpm;
    for (let b = 0; b < stage.bars && t < 300; b++) {
      const i = Math.floor(t / 60);
      buckets[i] = (buckets[i] ?? 0) + barNotes(stage, c, b).length;
      t += barSec;
    }
  }
  const perSec = buckets.map((n) => n / 60);
  assert.ok(perSec.length >= 5, `only measured ${perSec.length} minutes`);
  // Before: 1.47/s in the first half-minute and 4.0/s by four minutes.
  assert.ok(perSec[0]! <= 1.2, `first minute is ${perSec[0]!.toFixed(2)} notes/s`);
  assert.ok(perSec[1]! <= 1.6, `second minute is ${perSec[1]!.toFixed(2)} notes/s`);
  assert.ok(perSec[4]! > perSec[0]!, "it must still get busier");
  for (let i = 1; i < perSec.length; i++) {
    assert.ok(
      perSec[i]! <= perSec[i - 1]! + 1.1,
      `minute ${i} jumps from ${perSec[i - 1]!.toFixed(2)} to ${perSec[i]!.toFixed(2)} notes/s`,
    );
  }
});

// --------------------------------------------------------------- lanes, kinds

test("two lanes carry the whole written ladder; three is past the end of it", () => {
  for (const s of STAGES) assert.ok(s.lanes <= 2, `written stage ${s.id} asks for ${s.lanes} lanes`);
  assert.equal(stageAt(STAGES.length).lanes, 3, "endless mode is where the third hand lives");
  // Monotone: a lane is never taken away and then given back.
  let lanes = 0;
  for (let i = 0; i < 40; i++) {
    assert.ok(stageAt(i).lanes >= lanes, `stage ${i} dropped a lane`);
    lanes = stageAt(i).lanes;
  }
  assert.equal(lanes, 3, "the third lane must exist somewhere");
});

test("a third lane is bought with accuracy, never with elapsed time", () => {
  const base = { stageGatesCorrect: 9, gatesToClear: 2 };
  assert.equal(readyForMoreLanes({ ...base, accuracy: 1 }), true);
  assert.equal(readyForMoreLanes({ ...base, accuracy: LANE_UP_ACCURACY }), true);
  assert.equal(readyForMoreLanes({ ...base, accuracy: LANE_UP_ACCURACY - 0.01 }), false);
  // Passing the stage is not the same as being ready to grow a hand.
  assert.equal(
    readyForMoreLanes({ accuracy: 1, stageGatesCorrect: 2, gatesToClear: 2 }),
    false,
    "clearing exactly what the stage asked must not buy a lane",
  );
});

test("more than one kind of note from the very first stage", () => {
  const kindsIn = (s: number, bars: number): Set<NoteKind> => {
    const out = new Set<NoteKind>();
    for (const c of freshSeeds(8)) {
      _clearChartCache();
      for (let b = 0; b < bars; b++) for (const n of barNotes(stageAt(s), c, b)) out.add(n.kind);
    }
    return out;
  };
  // Before: stage 0 was `{kick}` and nothing else for its whole length.
  const first = kindsIn(0, 8);
  assert.ok(first.size >= 2, `the opening stage speaks in ${[...first].join(",")}`);
  assert.ok(kindsIn(1, 8).size >= 3, "the second stage should add a third voice");
  assert.equal(kindsIn(2, 8).size, 4, "all four voices by the time there are two lanes");
});

test("pitch still maps to height: no lane's voice outranks the lane above it", () => {
  // Low to high, which is also the order `run.onHit` plays them in.
  const REGISTER: Record<NoteKind, number> = { kick: 0, tom: 1, snare: 2, hat: 3 };
  for (const lanes of [2, 3] as const) {
    for (let lane = 1; lane < lanes; lane++) {
      const above = laneKinds(lane - 1, lanes).map((k) => REGISTER[k]);
      const here = laneKinds(lane, lanes).map((k) => REGISTER[k]);
      assert.ok(
        Math.min(...above) > Math.max(...here),
        `${lanes} lanes: lane ${lane - 1} (${above}) must sit above lane ${lane} (${here})`,
      );
    }
  }
  assert.deepEqual(laneVoices(2), ["snare", "kick"]);
});

test("a note's voice matches the lane it was actually placed in", () => {
  let checked = 0;
  for (let s = 0; s < 14; s++) {
    const stage = stageAt(s);
    if (stage.lanes <= 1) continue;
    for (let bar = 0; bar < 8; bar++) {
      for (const n of barNotes(stage, ctx("voices"), bar) as ChartNote[]) {
        if (n.div < 0) continue; // the polyrhythm lane speaks for itself
        const allowed: readonly NoteKind[] =
          stage.lanes >= 3 && n.lane === 1 ? ["tom", "snare"] : laneKinds(n.lane, stage.lanes);
        assert.ok(
          allowed.includes(n.kind) || (stage.lanes >= 3 && n.kind === "tom"),
          `stage ${s}: lane ${n.lane} spoke as ${n.kind}`,
        );
        checked++;
      }
    }
  }
  assert.ok(checked > 200, `only ${checked} notes were checked`);
});

// -------------------------------------------------------------------- ladder

test("escalation is monotone where it should be and bounded where it must be", () => {
  for (let i = 1; i < STAGES.length; i++) {
    assert.ok(STAGES[i]!.bpm >= STAGES[i - 1]!.bpm, `stage ${i} slowed down`);
    assert.ok(STAGES[i]!.gateFloor > STAGES[i - 1]!.gateFloor, `stage ${i} got easier`);
  }
  for (let i = STAGES.length; i < 80; i++) {
    const s = stageAt(i);
    assert.ok(s.bpm <= 168, `endless stage ${i} runs at ${s.bpm} bpm`);
    assert.ok(s.gateFloor <= 1, `endless stage ${i} floor ${s.gateFloor}`);
    assert.ok(s.density <= 0.5, `endless stage ${i} density ${s.density}`);
    assert.ok(s.lanes <= 3 && s.bars > 0);
  }
  assert.ok(stageAt(40).bpm > STAGES[STAGES.length - 1]!.bpm, "endless mode must keep climbing");
});

// ── The band, which is what "the main rhythm" meant ──────────────────────────
//
// The founder: *"the main rhythm is static."* It was, literally — the bass was
// a hand-written array of beat offsets, the arp a three-bar modulo. The chart a
// child PLAYS was already varied; the thing underneath it never moved. These
// assertions are about the layer he was hearing.

/** One bar of a backing layer, as a string. */
function bandSig(c: ChartContext, bar: number, density: number): string {
  return bandBeats(c, bar, "bass", density).join(",");
}

/** How often each instant of the bar was struck, over a window. */
function bandProfile(c: ChartContext, from: number, n: number, density: number): Map<number, number> {
  const out = new Map<number, number>();
  for (let bar = from; bar < from + n; bar++) {
    if (bar > 0 && bar % 4 === 0) c.groove.advance(4);
    for (const b of bandBeats(c, bar, "bass", density)) out.set(b, (out.get(b) ?? 0) + 1);
  }
  for (const [k, v] of out) out.set(k, v / n);
  return out;
}

test("the band's pattern is drawn from the groove, not written down", () => {
  // `BASS_PATTERNS[2]` was `[0, 1.5, 2]` in every bar of every run at that
  // tier, forever. Three distinct patterns in 64 bars would already beat it;
  // this is far past that, and the number that used to be right here is ONE.
  const c = ctx("band-variety");
  const seen = new Set<string>();
  for (let bar = 0; bar < 64; bar++) seen.add(bandSig(c, bar, 3 / 8));
  assert.ok(seen.size >= 12, `only ${seen.size} distinct bass bars in 64 — the band is still a loop`);
  // The downbeat is not negotiable in the band either: it is the thing the rest
  // of the bar is heard against.
  for (let bar = 0; bar < 64; bar++) {
    assert.ok(bandSig(c, bar, 3 / 8).startsWith("0"), `bar ${bar} lost its downbeat`);
  }
});

test("the band changes its MIND over minutes, not merely its notes", () => {
  /**
   * The distinction that matters, and the one the first version of this work
   * got wrong. A per-bar draw already gives different bars; what "static" meant
   * is that the ODDS never changed, so the same instants won forever. So this
   * measures the odds — how often each instant is actually struck — early in a
   * session against later in it, with the walk on and with it off.
   *
   * **The window has to be 200 bars and the reason is arithmetic.** A strike
   * rate measured over N bars carries sampling noise of about
   * `sqrt(p(1-p)/N)`, which at 96 bars is 0.05 per instant — the same size as
   * the drift, so the two are indistinguishable and the first version of this
   * test asserted a ratio of 1.16 and failed. Noise falls as `1/sqrt(N)` and
   * the drift does not, so a longer window separates them: measured, 0.029
   * against 0.059 at 200 bars, a clean factor of two.
   */
  const WINDOW = 200;
  const shift = (drift: boolean): number => {
    let total = 0;
    for (let r = 0; r < 24; r++) {
      _clearChartCache();
      const c = ctx(`band-drift-${r}`);
      if (!drift) {
        // The A/B: the same generator with the walk switched off. Everything
        // else — the seed, the matrix, the per-bar draw — is identical.
        (c.groove as unknown as { advance: (n: number) => void }).advance = () => {};
      }
      const early = bandProfile(c, 0, WINDOW, 3 / 8);
      const late = bandProfile(c, WINDOW + 56, WINDOW, 3 / 8);
      let d = 0;
      for (const b of new Set([...early.keys(), ...late.keys()])) {
        d += Math.abs((early.get(b) ?? 0) - (late.get(b) ?? 0));
      }
      total += d / 8;
    }
    return total / 24;
  };
  const frozen = shift(false);
  const alive = shift(true);
  assert.ok(
    alive > frozen * 1.6,
    `the band shifted ${alive.toFixed(4)} with the walk on and ${frozen.toFixed(4)} with it off`,
  );
});

test("the band and the chart read ONE groove, in either order", () => {
  /**
   * Both layers call `matrix` with different grids in the same bar — the chart
   * with the stage's subdivisions, the band with eighths — and `Groove` keeps
   * the union of every grid it is shown precisely so that which of them happens
   * to be called first cannot change the music. That is a real hazard and not a
   * theory: `scheduleBacking` runs before the player notes are laid, and moving
   * one line would swap them.
   *
   * The two orders run INTERLEAVED, bar by bar, with the phrase cache dropped
   * between them — because `barNotes` memoises on the run's seed, so two
   * contexts sharing a seed would otherwise hand each other bars and the test
   * would compare a cache with itself.
   */
  const a = ctx("order");
  const b = ctx("order");
  const stage = STAGES[5]!;
  for (let bar = 0; bar < 40; bar++) {
    if (bar > 0 && bar % 4 === 0) {
      a.groove.advance(4);
      b.groove.advance(4);
    }
    _clearChartCache();
    const chartFirst = [barSig(5, a, bar), bandSig(a, bar, 3 / 8)];
    _clearChartCache();
    const bandFirst = [bandSig(b, bar, 3 / 8), barSig(5, b, bar)];
    assert.ok(chartFirst[0]!.length > 0, "an empty chart would make every order look alike");
    assert.equal(chartFirst[0], bandFirst[1], `bar ${bar}: asking the band first changed the chart`);
    assert.equal(chartFirst[1], bandFirst[0], `bar ${bar}: asking the chart first changed the band`);
  }
  void stage;
});

// ── The chart's own drift, and the cache that must not lie about it ──────────

test("a phrase cannot change under a child, even when the cache is evicted", () => {
  /**
   * The guarantee: what a child is two beats into cannot become something else.
   *
   * `barNotes` memoises all four bars at the phrase's first bar and the cache is
   * cleared wholesale at 64 entries, so an eviction mid-phrase is a real event
   * and the rebuild has to agree with what was already played. What makes that
   * true is that `agree()` and `makeRoom()` are QUEUED to the next `advance` —
   * this test fails within a millisecond if either of them starts landing
   * immediately, which is the mutation it was written against.
   */
  const c = ctx("evict");
  const stage = STAGES[3]!;
  for (let phrase = 0; phrase < 12; phrase++) {
    const bars = [0, 1, 2, 3].map((k) => barNotes(stage, c, phrase * 4 + k));
    // Everything a gate could do, mid-phrase, plus the cache falling over.
    c.groove.agree();
    c.groove.makeRoom();
    _clearChartCache();
    for (let k = 0; k < 4; k++) {
      assert.deepEqual(
        barNotes(stage, c, phrase * 4 + k),
        bars[k],
        `phrase ${phrase} bar ${k} changed under the child`,
      );
    }
    c.groove.advance(4);
  }
});

test("right and wrong shape the chart, and right never makes it busier", () => {
  const stage = STAGES[2]!;
  const notesIn = (c: ChartContext, from: number, n: number): number => {
    let total = 0;
    for (let bar = from; bar < from + n; bar++) total += barNotes(stage, c, bar).length;
    return total;
  };
  let thinner = 0;
  let rightTotal = 0;
  let quietTotal = 0;
  const runs = 40;
  for (let r = 0; r < runs; r++) {
    const right = ctx(`ab-${r}`);
    const wrong = ctx(`ab-${r}`);
    const quiet = ctx(`ab-${r}`);
    for (let i = 0; i < 10; i++) {
      right.groove.agree();
      right.groove.advance(4);
      wrong.groove.makeRoom();
      wrong.groove.advance(4);
      quiet.groove.advance(4);
    }
    _clearChartCache();
    const withRight = notesIn(right, 100, 40);
    _clearChartCache();
    const withWrong = notesIn(wrong, 100, 40);
    _clearChartCache();
    const withNothing = notesIn(quiet, 100, 40);
    if (withWrong < withRight) thinner++;
    rightTotal += withRight;
    quietTotal += withNothing;
  }
  assert.ok(thinner >= runs * 0.7, `a run of misses left more room in only ${thinner} of ${runs}`);
  /**
   * Being right must never hand a child MORE to hit.
   *
   * Against a run that answered NOTHING, not against the same run earlier: a
   * per-bar draw over forty bars carries several notes of sampling noise, so a
   * per-run bound with slack tight enough to mean anything fails six times in
   * forty on noise alone — which is what the first version of this did. The
   * aggregate over 1600 bars has the noise averaged out of it, and the exact
   * claim — that the EXPECTED count is bit-identical — is asserted where it can
   * be, on the matrix, in `game-soundscape/evolve.test.ts`.
   */
  assert.ok(
    rightTotal <= quietTotal * 1.02,
    `ten right answers bought ${rightTotal} notes against ${quietTotal} for answering nothing`,
  );
});
