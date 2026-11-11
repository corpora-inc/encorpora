/**
 * The practice heat scale: cold blue for no practice, a neutral at the weekly
 * target, hot red at twice the target and beyond. Continuous: a value is
 * placed on nine token stops (`--color-heat-0` … `--color-heat-8`, in
 * tokens.css for light and dark) and mixed between its two neighbours in
 * OKLab, so 31 minutes and 33 minutes are different colours. The target is
 * the midpoint of a scale, never a pass mark.
 */

/** Stops either side of the midpoint. */
export const HEAT_ARM = 4;
export const HEAT_STOPS = HEAT_ARM * 2 + 1;
/** The scale runs from 0 to this many times the midpoint. */
export const HEAT_SPAN = 2;

/** Where a value sits on the scale: −1 at zero, 0 at the midpoint, +1 at twice
 * the midpoint or more. Null when there's no midpoint to scale by. */
export function heatPosition(value: number, midpoint: number | null) {
  if (midpoint === null || !(midpoint > 0) || !Number.isFinite(value))
    return null;
  const ratio = Math.max(0, value) / midpoint;
  return Math.max(-1, Math.min(1, ratio - 1));
}

/** The two stops a position falls between and how far toward the upper one
 * (0 to 1). Exactly on a stop, `mix` is 0 and `from` is that stop. */
export function heatStops(position: number) {
  const scaled = ((Math.max(-1, Math.min(1, position)) + 1) / 2) * (HEAT_STOPS - 1);
  const from = Math.min(HEAT_STOPS - 2, Math.floor(scaled));
  const mix = scaled - from;
  return mix >= 1 - 1e-9
    ? { from: from + 1, to: from + 1, mix: 0 }
    : { from, to: from + 1, mix };
}

/** A CSS colour for a position: a token, or two neighbouring tokens mixed. */
export function heatColor(position: number | null): string | undefined {
  if (position === null) return undefined;
  const { from, to, mix } = heatStops(position);
  if (mix < 0.005 || from === to) return `var(--color-heat-${from})`;
  if (mix > 0.995) return `var(--color-heat-${to})`;
  const share = Math.round(mix * 1000) / 10;
  return `color-mix(in oklab, var(--color-heat-${to}) ${share}%, var(--color-heat-${from}))`;
}

/** The value at each labelled legend tick: 0, half the midpoint, the
 * midpoint, one and a half, twice. */
export const heatTicks = (midpoint: number) =>
  [0, 0.5, 1, 1.5, 2].map((share) => share * midpoint);
