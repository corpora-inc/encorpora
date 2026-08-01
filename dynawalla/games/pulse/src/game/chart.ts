/**
 * Chart generation — a probability matrix, read with a seeded stream, composed
 * into phrases.
 *
 * The founder, on what shipped before this file was rewritten: *"every time you
 * enter it's the same sequence? we should see if we could make some probability
 * matrix that makes a nice tune on the beat … when the input is sort of the mode
 * and the desired density."* He was right about the opening and it was worse
 * than "similar": stage 0's density of 0.9 was multiplied by an on-beat weight
 * of 1.25, so every slot fired with certainty and **bar 0 was the identical four
 * quarter notes in 24 of 24 fresh runs**. The first forty-six seconds a child
 * ever played were a metronome, every single time.
 *
 * So the two inputs are now exactly the ones he named:
 *
 *   **The mode.** `packs/shared/game-soundscape` already carries the app's key —
 *   38 modes as exact cents, chosen by the host and inherited by every pack — and
 *   `groove.ts` reads that same soundscape as TIME rather than as pitch. A mode
 *   is a set of positions in a cyclic space and so is a bar; projecting one onto
 *   the other gives a bar this key likes the shape of. **PULSE never names a
 *   pitch, and it never chooses the key** — it is told, like every other pack.
 *
 *   **The density.** One number per stage, and it now means what it says:
 *   expected notes per bar over slots in the bar. See `groove.ts`.
 *
 * Random notes still feel like static, so the phrase architecture is kept: four
 * bars generated as a unit, bars 0–2 restating a motif with small mutations and
 * bar 3 answering with a fill. What is new underneath it is that the motif is
 * drawn rather than written, from a matrix that differs by key, and that the
 * backbeat figure is drawn from a vocabulary instead of being the same 1-and-3
 * every phrase of every run.
 */

import {
  currentSoundscape,
  divOfBeat,
  grooveMatrix,
  grooveSlotBeats,
  pickSoundscape,
  type GrooveSlot,
  type Soundscape,
} from "../../../../packs/shared/game-soundscape/index.ts";
import { makeRng, hashSeed, type Rng } from "../rng.ts";
import type { StageSpec } from "./stages.ts";

export type NoteKind = "kick" | "snare" | "hat" | "tom";

export type ChartNote = {
  /** Beat offset inside the bar. Exact grid rational rendered as a float position. */
  beatInBar: number;
  lane: number;
  /** Subdivision family. Positive = per-beat division. Negative = |n| notes per bar. */
  div: number;
  kind: NoteKind;
  accent: boolean;
};

export const BEATS_PER_BAR = 4;

/**
 * Everything a chart is generated from, other than the stage and the bar.
 *
 * The soundscape is resolved ONCE, when a run is constructed, and carried here.
 * Re-reading it per bar would let the app's key change under a child mid-phrase
 * — which `SOUNDSCAPE_DESIGN_2026-07.md` forbids for exactly the same reason
 * here as there: the groove they are two bars into is not allowed to become a
 * different groove because a rotation timer went off.
 */
export type ChartContext = {
  /** The run's seed. Same seed, same chart, forever. */
  readonly seed: string;
  /** The app's key, as a rhythm generator. Never used to make a sound. */
  readonly scape: Soundscape;
};

/**
 * The chart context for a run.
 *
 * The host publishes the app's soundscape and every pack inherits it, so a run
 * that starts in Rast grooves differently from one that starts in Hirajoshi and
 * the whole bazaar agrees about which it is. When no host has published one —
 * an older host, or a parent who turned Music off — the run picks one from its
 * own seed. That is not a pack choosing a key: nothing here reaches an
 * oscillator. It is a pack needing a probability matrix and taking the only
 * honest source of one it has.
 */
export function chartContext(seed: string): ChartContext {
  return { seed, scape: currentSoundscape() ?? pickSoundscape(hashSeed(seed)) };
}

/**
 * The timbres a lane may speak in, ordered low pitch first.
 *
 * Top lane is the highest voice and bottom lane the lowest — pitch maps to
 * height, and that property is load-bearing, so the sets never overlap in
 * register. Ordering, low to high: kick, tom, snare, hat.
 *
 * Two timbres per lane rather than one is the cheap half of *"we can mix types
 * of notes pretty early on"*: the child hears four different sounds from the
 * first two-lane bar, without a third lane and without a denser bar. Variety of
 * KIND rather than variety of VOLUME.
 */
export function laneKinds(lane: number, lanes: number): readonly [NoteKind, NoteKind] {
  // One lane is the only case with no height to map onto, so it gets the whole
  // kit and the metre alone decides — which is what makes the very first stage,
  // four quarter notes wide, already sound like a drummer rather than a click.
  if (lanes <= 1) return ["kick", "snare"];
  if (lanes === 2) return lane === 0 ? ["snare", "hat"] : ["kick", "tom"];
  if (lane === 0) return ["hat", "hat"];
  if (lane === 1) return ["tom", "snare"];
  return ["kick", "kick"];
}

/** The voice a lane leads with. Kept for the HUD and for tests that read registers. */
export function laneVoices(lanes: number): NoteKind[] {
  return Array.from({ length: Math.max(1, lanes) }, (_, i) => laneKinds(i, lanes)[0]);
}

/**
 * Which of a lane's two timbres this instant gets.
 *
 * Strong instants take the heavier voice and offbeats take the lighter one,
 * which is what a drummer does without thinking about it. On one lane the whole
 * kit is in play, so an odd-numbered beat becomes a backbeat and a subdivision
 * becomes a hat.
 */
function kindFor(beat: number, div: number, lane: number, lanes: number): NoteKind {
  const pair = laneKinds(lane, lanes);
  const onBeat = Math.abs(beat - Math.round(beat)) < 1e-6;
  if (lanes <= 1) {
    if (!onBeat) return "hat";
    if (beat === 0) return "kick";
    return Math.round(beat) % 2 === 1 ? "snare" : "tom";
  }
  void div;
  return onBeat ? pair[0] : pair[1];
}

/**
 * The backbeat figures a phrase may be built on.
 *
 * The old generator anchored every phrase of every run on beats 1 and 3 and
 * nothing else, which is most of why one run sounded like the last one however
 * the dust around it fell. One of these is drawn per phrase, so the SHAPE
 * changes and not merely the ornament. Beat 0 is not in any of them because it
 * is never optional.
 */
const FIGURES: readonly (readonly number[])[] = [
  [1, 3],
  [2],
  [1, 2, 3],
  [3],
  [1.5, 3],
  [2, 3],
  [1, 2.5],
];

/**
 * The smallest gap one hand may be asked for, in beats.
 *
 * 88 ms is about the floor for a repeated single-limb strike, and it is also the
 * point below which two notes stop being two notes and start being one smear the
 * judge cannot attribute. Capped at 0.24 beats so a sixteenth run (0.25) survives
 * even at the endless-mode tempo ceiling, while the genuinely lethal case — a
 * sixteenth and a triplet 1/12 of a beat apart — is always refused.
 */
export function minGapBeats(bpm: number): number {
  return Math.min(0.24, (0.088 * bpm) / 60);
}

/** Enforces "one lane, one hand": unique slots and a humanly playable gap. */
class Placer {
  private readonly byLane = new Map<number, number[]>();
  private readonly gap: number;
  private readonly downbeatLane: number;

  constructor(gap: number, downbeatLane: number) {
    this.gap = gap;
    this.downbeatLane = downbeatLane;
  }

  can(beat: number, lane: number): boolean {
    // Leave room for the next bar's downbeat, which lands in its own lane at 0.
    if (lane === this.downbeatLane && BEATS_PER_BAR - beat < this.gap) return false;
    const xs = this.byLane.get(lane);
    if (!xs) return true;
    for (const x of xs) if (Math.abs(x - beat) < this.gap - 1e-9) return false;
    return true;
  }

  take(beat: number, lane: number): boolean {
    if (!this.can(beat, lane)) return false;
    const xs = this.byLane.get(lane);
    if (xs) xs.push(beat);
    else this.byLane.set(lane, [beat]);
    return true;
  }
}

/**
 * Which hand an instant falls to.
 *
 * The bottom lane carries the pulse and the top lane carries what is between
 * it, so two hands alternate rather than one hand doing everything — but only
 * *mostly*, because a groove where the assignment is a lookup table is a groove
 * a child stops reading after four bars.
 */
function laneFor(beat: number, div: number, lanes: number, polyLane: number, rng: Rng): number {
  const pick = (): number => {
    if (lanes <= 1) return 0;
    const onBeat = Math.abs(beat - Math.round(beat)) < 1e-6;
    const bottom = lanes - 1;
    if (lanes === 2) {
      if (onBeat) return rng.bool(0.78) ? bottom : 0;
      return rng.bool(0.82) ? 0 : bottom;
    }
    if (beat === 0) return bottom;
    if (onBeat) return rng.bool(0.6) ? bottom : 1;
    if (div >= 4) return rng.bool(0.7) ? 0 : 1;
    return rng.bool(0.55) ? 1 : 0;
  };
  const lane = pick();
  if (lane !== polyLane) return lane;
  /**
   * The polyrhythm owns its lane outright, so a grid note that wanted it goes
   * to the other hand rather than being thrown away.
   *
   * Dropping it was survivable when a polyrhythm stage had three lanes — two
   * were left. On two lanes it deleted most of the bar: THREE OVER FOUR
   * produced four distinct opening bars across twenty-four fresh runs, because
   * almost everything that was not the polyrhythm had been discarded.
   */
  return lanes <= 1 ? 0 : polyLane === 0 ? 1 : polyLane - 1;
}

/** A ceiling on how much can be asked of two thumbs at once, whatever the matrix says. */
function maxNotes(lanes: number): number {
  return lanes >= 3 ? 20 : lanes === 2 ? 14 : 8;
}

type MotifNote = { beat: number; div: number; lane: number; accent: boolean };

function buildPhrase(stage: StageSpec, ctx: ChartContext, phrase: number): ChartNote[][] {
  /**
   * The key is NOT in the stream.
   *
   * It would be the obvious thing to hash in, and it would make two keys give
   * two charts — for the wrong reason, and untestably. The mode's whole
   * contribution has to arrive through the matrix, because that is the claim:
   * *"a probability matrix … when the input is sort of the mode and the desired
   * density."* Salting the RNG with the mode id would make a chart differ
   * between keys even if `grooveMatrix` ignored the mode entirely, which is a
   * test that passes while the feature is switched off.
   */
  const rng = makeRng(hashSeed(`${ctx.seed}|s${stage.id}|p${phrase}`));
  const gap = minGapBeats(stage.bpm);
  const downbeatLane = stage.lanes - 1;
  const polyLane = stage.poly ? Math.min(stage.poly.lane, stage.lanes - 1) : -1;

  const matrix = grooveMatrix(ctx.scape, {
    beatsPerBar: BEATS_PER_BAR,
    divs: stage.divs,
    density: stage.density,
  });

  // --- The motif: which grid slots this phrase, in this key, likes.
  const motif: MotifNote[] = [];
  const motifPlacer = new Placer(gap, downbeatLane);
  const place = (beat: number, lane: number, accent: boolean): void => {
    if (motif.length >= maxNotes(stage.lanes)) return;
    if (!motifPlacer.take(beat, lane)) return;
    motif.push({ beat, div: divOfBeat(beat, stage.divs), lane, accent });
  };

  // The downbeat, always, in the lane that owns it.
  place(0, downbeatLane, true);

  // Then the matrix, slot by slot, leaning on this phrase's figure. This is the
  // whole of the "randomness and variability": every instant in the bar is a
  // coin whose bias the key set and the figure tilted. The figure is spent from
  // the SAME budget rather than laid on top of it, so leaning on beats 1 and 3
  // costs the ornament between them and a sparse stage stays sparse.
  const figure = new Set(
    rng
      .pick(FIGURES)
      .map((raw) => nearestSlot(raw, matrix))
      .filter((b): b is number => b !== null),
  );
  for (const slot of leanOn(matrix, figure)) {
    if (motif.length >= maxNotes(stage.lanes)) break;
    if (slot.beat === 0) continue;
    if (!rng.bool(slot.p)) continue;
    const lane = laneFor(slot.beat, slot.div, stage.lanes, polyLane, rng);
    place(slot.beat, lane, figure.has(slot.beat) || (slot.metre >= 0.74 && rng.bool(0.4)));
  }
  motif.sort((a, b) => a.beat - b.beat || a.lane - b.lane);

  // --- Four bars: restate, mutate, restate, answer.
  const bars: ChartNote[][] = [];
  for (let b = 0; b < 4; b++) {
    const out: ChartNote[] = [];
    const placer = new Placer(gap, downbeatLane);
    const isAnswer = b === 3;
    const mutate = b === 1 || b === 3;

    // The polyrhythm is laid first: it owns its lane outright.
    if (stage.poly) {
      const perBar = stage.poly.perBar;
      for (let k = 0; k < perBar; k++) {
        const beat = (k * BEATS_PER_BAR) / perBar;
        if (!placer.take(beat, polyLane)) continue;
        out.push({
          beatInBar: beat,
          lane: polyLane,
          div: -perBar,
          kind: kindFor(beat, 1, polyLane, stage.lanes),
          accent: k === 0,
        });
      }
    }

    for (const m of motif) {
      const isAnchor = m.beat === 0;
      if (mutate && !isAnchor && rng.bool(0.14)) continue; // drop a note
      let lane = m.lane;
      if (mutate && !isAnchor && stage.lanes > 1 && rng.bool(0.12)) {
        const moved = Math.min(stage.lanes - 1, Math.max(0, lane + (rng.bool(0.5) ? 1 : -1)));
        if (moved !== polyLane) lane = moved;
      }
      if (!placer.take(m.beat, lane)) continue;
      out.push({
        beatInBar: m.beat,
        lane,
        div: m.div,
        kind: kindFor(m.beat, m.div, lane, stage.lanes),
        accent: m.accent,
      });
    }

    if (isAnswer) {
      /**
       * The fourth bar answers the other three, and it answers them AT THE
       * DENSITY THE STAGE IS AT. A fixed six-note run of the fastest
       * subdivision was a spike a sparse stage could not absorb — the whole
       * point of starting sparse is lost if every fourth bar is a drum solo.
       * One extra instant at the opening density; a real run once the child is
       * being served sixteenths.
       */
      const fastest = Math.max(...stage.divs);
      const steps = Math.max(1, Math.min(6, Math.round(stage.density * fastest * 2.2)));
      const start = BEATS_PER_BAR - 1;
      for (let k = 0; k < steps; k++) {
        const beat = start + k / fastest;
        if (beat >= BEATS_PER_BAR) break;
        let lane = stage.lanes >= 3 ? (k % 2 === 0 ? 1 : 0) : Math.max(0, stage.lanes - 2);
        if (lane === polyLane) lane = Math.max(0, Math.min(stage.lanes - 1, lane === 0 ? 1 : 0));
        if (!placer.take(beat, lane)) continue;
        out.push({
          beatInBar: beat,
          lane,
          div: fastest,
          kind: stage.lanes >= 3 ? "tom" : kindFor(beat, fastest, lane, stage.lanes),
          accent: k === 0,
        });
      }
    }

    out.sort((a, b2) => a.beatInBar - b2.beatInBar || a.lane - b2.lane);
    bars.push(out);
  }
  return bars;
}

/**
 * The matrix, tilted toward this phrase's figure, at the same expected fullness.
 *
 * Boost the figure's instants, take the same amount back from everything else
 * in proportion to what it had. Two phrases in the same key and at the same
 * density therefore hold the same number of notes and differ in SHAPE, which is
 * the only kind of variety that does not also make the game harder.
 */
function leanOn(matrix: readonly GrooveSlot[], figure: ReadonlySet<number>): GrooveSlot[] {
  if (figure.size === 0) return [...matrix];
  const MAX_LEAN = 0.7;
  let headroom = 0;
  let spare = 0;
  for (const s of matrix) {
    if (s.beat === 0) continue;
    if (figure.has(s.beat)) headroom += 1 - s.p;
    else spare += s.p;
  }
  if (headroom <= 0 || spare <= 0) return [...matrix];
  /**
   * Lean only as far as the rest of the bar can pay for, and never far enough
   * to silence it.
   *
   * Without the first cap a four-slot grid — the opening stage — bought a 0.7
   * lean on two slots out of a budget of one, and the "sparse" opening came out
   * 40% fuller than the density it was configured with. With only the first
   * cap it paid for the lean by taking the last slot to zero, and then the
   * opening bar had exactly four shapes it could ever be, which is the defect
   * this whole file exists to remove. A third of the spare always survives, so
   * every instant the key likes stays reachable.
   */
  const MIN_KEEP = 0.35;
  const lean = Math.min(MAX_LEAN, (spare * (1 - MIN_KEEP)) / headroom);
  const keep = Math.max(0, 1 - (headroom * lean) / spare);
  return matrix.map((s) => {
    if (s.beat === 0) return s;
    const p = figure.has(s.beat) ? s.p + (1 - s.p) * lean : s.p * keep;
    return { ...s, p };
  });
}

/** The grid instant closest to a figure's ideal position, or null if there is none near. */
function nearestSlot(want: number, matrix: readonly GrooveSlot[]): number | null {
  let best: number | null = null;
  let bestD = Infinity;
  for (const s of matrix) {
    const d = Math.abs(s.beat - want);
    if (d < bestD) {
      bestD = d;
      best = s.beat;
    }
  }
  return bestD <= 0.5 + 1e-9 ? best : null;
}

type PhraseKey = string;
const phraseCache = new Map<PhraseKey, ChartNote[][]>();

export function barNotes(stage: StageSpec, ctx: ChartContext, bar: number): ChartNote[] {
  const phrase = Math.floor(bar / 4);
  const key = `${ctx.seed}|${ctx.scape.modeId}|${stage.id}|${phrase}`;
  let bars = phraseCache.get(key);
  if (!bars) {
    bars = buildPhrase(stage, ctx, phrase);
    if (phraseCache.size > 64) phraseCache.clear();
    phraseCache.set(key, bars);
  }
  return bars[bar % 4] ?? [];
}

/** Test seam — drop memoised phrases so a determinism test starts clean. */
export function _clearChartCache(): void {
  phraseCache.clear();
}

export { grooveSlotBeats };

function round6(v: number): number {
  return Math.round(v * 1e6) / 1e6;
}
