/**
 * Timing judgment. Pure and DOM-free so it can be tested in node.
 *
 * Windows are absolute seconds, not fractions of a beat — a human's timing accuracy
 * does not get better because the tempo went up. They are generous by rhythm-game
 * standards (PERFECT is ±55 ms where a hard game uses ±25) because the point is to
 * make a nine-year-old feel like a drummer, and PERFECT is still worth chasing since
 * it is the only grade that raises the combo melody an extra step.
 */

import type { NoteKind } from "./chart.ts";

export type Judgment = "perfect" | "great" | "good" | "miss";

export const WINDOWS = {
  perfect: 0.055,
  great: 0.105,
  good: 0.17,
} as const;

export const JUDGE_SCORE: Record<Judgment, number> = {
  perfect: 100,
  great: 60,
  good: 30,
  miss: 0,
};

export function classify(deltaSec: number): Judgment {
  const d = Math.abs(deltaSec);
  if (d <= WINDOWS.perfect) return "perfect";
  if (d <= WINDOWS.great) return "great";
  if (d <= WINDOWS.good) return "good";
  return "miss";
}

/** ×1 at combo 0, +1 every 10, capped at ×8. Never resets to below ×1. */
export function multiplierFor(combo: number): number {
  return Math.min(8, 1 + Math.floor(combo / 10));
}

export type GateInfo = {
  questionId: string;
  label: string;
  correct: boolean;
  /** Rational value as a float in (0,1] — only ever used to place a pixel. */
  pos: number;
};

export type LiveNote = {
  id: number;
  time: number;
  beat: number;
  lane: number;
  div: number;
  kind: NoteKind;
  accent: boolean;
  judged: Judgment | null;
  /** Set on fraction-gate candidates. */
  gate?: GateInfo;
  /** Render-only bookkeeping. */
  pop: number;
};

export type HitResult = { note: LiveNote; delta: number; judgment: Judgment };

export class NoteQueue {
  private notes: LiveNote[] = [];
  private nextId = 1;

  add(n: Omit<LiveNote, "id" | "judged" | "pop">): LiveNote {
    const note: LiveNote = { ...n, id: this.nextId++, judged: null, pop: 0 };
    this.notes.push(note);
    return note;
  }

  all(): readonly LiveNote[] {
    return this.notes;
  }

  /** Unjudged gate candidates currently on screen. */
  gateNotes(): LiveNote[] {
    return this.notes.filter((n) => n.gate !== undefined && n.judged === null);
  }

  /**
   * Nearest unjudged note in `lane` inside the GOOD window. Nearest-wins is what
   * keeps dense sixteenth runs from mis-assigning a hit to the note behind.
   */
  hit(lane: number, t: number, anyLane = false): HitResult | null {
    let best: LiveNote | null = null;
    let bestAbs = Infinity;
    for (const n of this.notes) {
      if (n.judged !== null) continue;
      if (!anyLane && n.lane !== lane) continue;
      const d = Math.abs(n.time - t);
      if (d < bestAbs) {
        bestAbs = d;
        best = n;
      }
    }
    if (!best || bestAbs > WINDOWS.good) return null;
    const delta = t - best.time;
    const judgment = classify(delta);
    best.judged = judgment;
    return { note: best, delta, judgment };
  }

  /** Notes that have run past the window unhit. Marks them missed and returns them. */
  reap(t: number): LiveNote[] {
    const out: LiveNote[] = [];
    for (const n of this.notes) {
      if (n.judged === null && n.time < t - WINDOWS.good) {
        n.judged = "miss";
        out.push(n);
      }
    }
    return out;
  }

  /** Forget everything older than `t`. Keeps the array small and the loop O(visible). */
  prune(t: number): void {
    if (this.notes.length < 96) return;
    this.notes = this.notes.filter((n) => n.time > t - 1.6);
  }

  clear(): void {
    this.notes = [];
  }

  /** Cancel unjudged notes in a beat range without scoring them (stage change). */
  cancelAfter(t: number): void {
    this.notes = this.notes.filter((n) => n.time <= t);
  }
}
