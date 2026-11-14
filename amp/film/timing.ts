import type { BeatTime } from "./schema";

/** Resolve a spoken-word cue identically for an action's start and release. */
export function wordTime(beat: BeatTime, word: string, nth = 1) {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const hits = beat.words.filter((w) => norm(w.text) === norm(word));
  const hit = hits[nth - 1];
  if (!hit) throw new Error(`Word "${word}" (occurrence ${nth}) is not in: ${beat.words.map((w) => w.text).join(" ")}`);
  return hit.start;
}

export function highlightEnd(beat: BeatTime, a: { until?: string; untilNth?: number }, t0: number): number | undefined {
  if (a.until === undefined) return undefined;
  const end = wordTime(beat, a.until, a.untilNth);
  if (end < t0) throw new Error(`Highlight until word "${a.until}" (occurrence ${a.untilNth ?? 1}) is before the action starts, in: ${beat.words.map((w) => w.text).join(" ")}`);
  return end;
}

/** Peak of a scene light's linear entrance and release, even when they overlap. */
export function sceneHighlightHeld(t0: number, end: number, dur: number) {
  return Math.min(t0 + dur, (t0 + end + dur) / 2);
}
