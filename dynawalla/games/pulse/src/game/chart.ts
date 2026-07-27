/**
 * Chart generation — seeded, deterministic, and *composed* rather than sprinkled.
 *
 * Random notes feel like static. Real grooves are a motif repeated with variation, so
 * a phrase of four bars is generated as a unit: bars 0-2 restate a motif with small
 * mutations and bar 3 is a fill. That is the difference between a pattern a child
 * wants to learn and a pattern they merely survive.
 */

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

/** Top lane is the highest voice, bottom lane the lowest — pitch maps to height. */
export function laneVoices(lanes: number): NoteKind[] {
  if (lanes <= 1) return ["kick"];
  if (lanes === 2) return ["snare", "kick"];
  return ["hat", "snare", "kick"];
}

/** Smallest per-beat division that lands exactly on this offset. */
function divOf(beat: number, divs: readonly number[]): number {
  const sorted = [...divs].sort((a, b) => a - b);
  for (const d of sorted) {
    const x = beat * d;
    if (Math.abs(x - Math.round(x)) < 1e-6) return d;
  }
  return sorted[sorted.length - 1] ?? 1;
}

function gridSlots(divs: readonly number[]): number[] {
  const set = new Set<number>();
  for (const d of divs) {
    for (let k = 0; k < BEATS_PER_BAR * d; k++) set.add(Math.round((k / d) * 1e6) / 1e6);
  }
  return [...set].sort((a, b) => a - b);
}

function laneFor(div: number, lanes: number, rng: Rng): number {
  if (lanes <= 1) return 0;
  if (lanes === 2) return div >= 2 ? 0 : 1;
  if (div >= 4) return 0;
  if (div === 3) return rng.bool(0.65) ? 0 : 1;
  if (div === 2) return rng.bool(0.55) ? 1 : 0;
  return rng.bool(0.7) ? 2 : 1;
}

function maxNotes(lanes: number): number {
  return lanes >= 3 ? 20 : lanes === 2 ? 15 : 10;
}

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

type PhraseKey = string;
const phraseCache = new Map<PhraseKey, ChartNote[][]>();

function buildPhrase(stage: StageSpec, runSeed: string, phrase: number): ChartNote[][] {
  const rng = makeRng(hashSeed(`${runSeed}|s${stage.id}|p${phrase}`));
  const voices = laneVoices(stage.lanes);
  const slots = gridSlots(stage.divs);
  const gap = minGapBeats(stage.bpm);
  const downbeatLane = stage.lanes - 1;
  const polyLane = stage.poly ? Math.min(stage.poly.lane, stage.lanes - 1) : -1;

  // --- The motif: which grid slots this phrase likes.
  const motif: { beat: number; div: number; lane: number; accent: boolean }[] = [];
  const motifPlacer = new Placer(gap, downbeatLane);
  const place = (beat: number, lane: number, accent: boolean): void => {
    if (!motifPlacer.take(beat, lane)) return;
    motif.push({ beat, div: divOf(beat, stage.divs), lane, accent });
  };

  // Anchors first: the downbeat, then the backbeat if there is a snare lane.
  place(0, downbeatLane, true);
  if (stage.lanes >= 2) {
    place(1, Math.max(0, stage.lanes - 2), true);
    place(3, Math.max(0, stage.lanes - 2), true);
  } else if (rng.bool(0.8)) {
    place(2, 0, true);
  }

  for (const beat of slots) {
    if (motif.length >= maxNotes(stage.lanes)) break;
    const d = divOf(beat, stage.divs);
    const weight = d === 1 ? 1 : d === 2 ? 0.8 : d === 3 ? 0.62 : 0.5;
    const onBeat = Math.abs(beat - Math.round(beat)) < 1e-6;
    const p = stage.density * weight * (onBeat ? 1.25 : 1);
    if (!rng.bool(p)) continue;
    const lane = laneFor(d, stage.lanes, rng);
    // The polyrhythm lane belongs to the polyrhythm; grid notes stay out of it.
    if (lane === polyLane) continue;
    place(beat, lane, onBeat && rng.bool(0.4));
  }
  motif.sort((a, b) => a.beat - b.beat || a.lane - b.lane);

  // --- Four bars: restate, mutate, restate, fill.
  const bars: ChartNote[][] = [];
  for (let b = 0; b < 4; b++) {
    const out: ChartNote[] = [];
    const placer = new Placer(gap, downbeatLane);
    const isFill = b === 3;
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
          kind: voices[polyLane] ?? "tom",
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
        kind: voices[lane] ?? "kick",
        accent: m.accent,
      });
    }

    if (isFill) {
      // A fill is a run of the stage's fastest subdivision across the last beat.
      const fastest = Math.max(...stage.divs);
      const start = BEATS_PER_BAR - 1;
      const steps = Math.min(6, fastest);
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
          kind: stage.lanes >= 3 ? "tom" : (voices[lane] ?? "snare"),
          accent: k === 0,
        });
      }
    }

    out.sort((a, b2) => a.beatInBar - b2.beatInBar || a.lane - b2.lane);
    bars.push(out);
  }
  return bars;
}

export function barNotes(stage: StageSpec, runSeed: string, bar: number): ChartNote[] {
  const phrase = Math.floor(bar / 4);
  const key = `${runSeed}|${stage.id}|${phrase}`;
  let bars = phraseCache.get(key);
  if (!bars) {
    bars = buildPhrase(stage, runSeed, phrase);
    if (phraseCache.size > 64) phraseCache.clear();
    phraseCache.set(key, bars);
  }
  return bars[bar % 4] ?? [];
}

/** Test seam — drop memoised phrases so a determinism test starts clean. */
export function _clearChartCache(): void {
  phraseCache.clear();
}
