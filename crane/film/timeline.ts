/**
 * A crane figure's state at film time t, from the shot's `crane` actions.
 * Pure: the same t always gives the same picture, so seeking backwards,
 * storyboards and the live player agree.
 *
 * - `set` eases named values (`boom.radius`) from where they are to the new
 *   value over the action's `dur`.
 * - `show` / `hide` fade parts in and out. A name covers everything under it:
 *   `boom` is the whole boom piece, `chart.cell.30.74` one cell.
 * - `light` emphasizes parts from its word to `until` (or the end of its beat),
 *   with the kit's short ease in and out.
 */

export type CraneAction = {
  do: "crane";
  set?: Record<string, number>;
  show?: string | string[];
  hide?: string | string[];
  light?: string | string[];
  at?: string;
  dur?: number;
};
/** One action in film time, as the stage times it (stage.ts `entries`). */
export type CraneEntry = { a: CraneAction; t0: number; dur: number; beatEnd: number; highlightEnd?: number; setup?: boolean };

/** The kit's ease: quick to start, long settle (stage.ts). */
export const ease = (u: number) => {
  const x = u < 0 ? 0 : u > 1 ? 1 : u;
  return x * x * x * (x * (x * 6 - 15) + 10);
};
/** The kit's light timing (stage.ts EMPH_IN / EMPH_OUT). */
export const LIGHT_IN = 0.2, LIGHT_OUT = 0.22;
/** A fade's length; a setup fade (the shot's opening state) takes none. */
export const FADE = 0.4;

const list = (x: string | string[] | undefined) => (x === undefined ? [] : Array.isArray(x) ? x : [x]);
/** `boom` covers `boom.block`; `chart.cell.3` does not cover `chart.cell.30`. */
export const covers = (target: string, part: string) => part === target || part.startsWith(`${target}.`);

export class CraneTimeline {
  private sets: { key: string; to: number; t0: number; dur: number }[] = [];
  private fades: { target: string; on: boolean; t0: number; dur: number }[] = [];
  private lights: { target: string; t0: number; end: number }[] = [];
  /** Every name an action used: the mount checks each against its parts. */
  readonly named = new Set<string>();
  readonly setKeys = new Set<string>();

  constructor(private initial: Record<string, number>, private hidden: readonly string[], entries: readonly CraneEntry[]) {
    for (const e of [...entries].sort((x, y) => x.t0 - y.t0)) {
      const a = e.a;
      for (const [key, to] of Object.entries(a.set ?? {})) {
        this.sets.push({ key, to, t0: e.t0, dur: e.setup ? 0 : e.dur });
        this.setKeys.add(key);
      }
      const fade = e.setup ? 0 : a.dur ?? FADE;
      for (const target of list(a.show)) { this.fades.push({ target, on: true, t0: e.t0, dur: Math.min(fade, FADE) }); this.named.add(target); }
      for (const target of list(a.hide)) { this.fades.push({ target, on: false, t0: e.t0, dur: Math.min(fade, FADE) }); this.named.add(target); }
      for (const target of list(a.light)) { this.lights.push({ target, t0: e.t0, end: e.highlightEnd ?? e.beatEnd }); this.named.add(target); }
    }
  }

  /** A named value at t: its start, eased through every `set` up to t. */
  value(key: string, t: number): number {
    let v = this.initial[key] ?? 0;
    for (const s of this.sets) {
      if (s.key !== key || s.t0 > t) continue;
      const u = s.dur <= 0 ? 1 : ease((t - s.t0) / s.dur);
      v = v + (s.to - v) * u;
    }
    return v;
  }

  /** The value the last `set` before t is heading to (a readout shows where a motion lands). */
  target(key: string, t: number): number {
    let v = this.initial[key] ?? 0;
    for (const s of this.sets) if (s.key === key && s.t0 <= t) v = s.to;
    return v;
  }

  /** 0 (gone) to 1 (shown). The nearest name that covers the part decides, latest action first. */
  opacity(part: string, t: number): number {
    const start = this.hidden.some((h) => covers(h, part)) ? 0 : 1;
    let o = start;
    for (const f of this.fades) {
      if (!covers(f.target, part) || f.t0 > t) continue;
      const u = f.dur <= 0 ? 1 : ease((t - f.t0) / f.dur);
      o = o + ((f.on ? 1 : 0) - o) * u;
    }
    return o;
  }

  /** 0 (plain) to 1 (fully lit), the strongest light that covers the part. */
  light(part: string, t: number): number {
    let em = 0;
    for (const l of this.lights) {
      if (!covers(l.target, part) || t < l.t0) continue;
      const up = ease((t - l.t0) / LIGHT_IN);
      const down = t <= l.end ? 1 : 1 - ease((t - l.end) / LIGHT_OUT);
      em = Math.max(em, Math.min(up, down));
    }
    return em;
  }

  /** Every moment something changes, for the stage's framing and still-screen checks. */
  moments(): number[] {
    return [...this.sets.flatMap((s) => [s.t0, s.t0 + s.dur]), ...this.fades.flatMap((f) => [f.t0, f.t0 + f.dur]), ...this.lights.flatMap((l) => [l.t0, l.end])];
  }
}
