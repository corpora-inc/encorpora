/**
 * The line through two points, read as y = mx + b: its slope m and the value b
 * where it meets the y axis. A label fills `@m` and `@b` from it on every
 * frame, so the numbers count as the line slides or tilts. Pure: the same two
 * points always read the same, whichever way the film is seeking.
 */
export type LinePoint = [number, number];
export type LineReading = { m: number; b: number };

/** Slope and y-intercept. A vertical line has neither: both are NaN. */
export function readLine(p: LinePoint, q: LinePoint): LineReading {
  const run = q[0] - p[0];
  if (Math.abs(run) < 1e-9) return { m: NaN, b: NaN };
  const m = (q[1] - p[1]) / run;
  return { m, b: p[1] - m * p[0] };
}

/** `@m` and `@b` in a label's TeX, replaced by the line's numbers. `fmt` writes one number. */
export function fillLine(tex: string, line: LineReading, fmt: (v: number) => string): string {
  return tex.replace(/@m/g, fmt(line.m)).replace(/@b/g, fmt(line.b));
}

/** True when a label's TeX asks for a line's slope or intercept. */
export const readsLine = (tex: string) => /@[mb]/.test(tex);
