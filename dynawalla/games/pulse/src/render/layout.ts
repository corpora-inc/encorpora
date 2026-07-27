/**
 * Playfield geometry — the conceit of the whole game.
 *
 * The distance from the strike line to the far edge is **exactly one bar**. Not "a
 * comfortable scroll speed": one bar. So the field is a fraction bar you can see:
 * a thing halfway across is at 1/2, and it arrives halfway through the measure.
 * Position, value and moment are the same fact, which is why answering `1/2 + 1/4`
 * here is a rhythmic act rather than a quiz.
 *
 * Coordinates: `u` runs along time (0 = strike line, 1 = one bar ahead, negative =
 * already played); `v` runs across lanes, 0..1. Landscape scrolls right-to-left like
 * a drum score; portrait falls top-to-bottom like every phone rhythm game since
 * Cytus, and it is the same code with the axes swapped.
 */

export type Orientation = "h" | "v";

export type Layout = {
  orient: Orientation;
  w: number;
  h: number;
  laneCount: number;
  /** Screen pixels for one bar. */
  runLen: number;
  /** Lane pitch in pixels across the field. */
  lanePitch: number;
  fieldThickness: number;
  compact: boolean;
  pt(u: number, v: number, out?: { x: number; y: number }): { x: number; y: number };
  laneV(lane: number): number;
  /** Unit vector along +u, in screen space. */
  along: { x: number; y: number };
  /** Unit vector along +v, in screen space. */
  across: { x: number; y: number };
  /** Where the strike line meets v=0 and v=1. */
  strikeA: { x: number; y: number };
  strikeB: { x: number; y: number };
  /** u beyond which a note is off-screen and can be dropped. */
  uMax: number;
  uMin: number;
};

export function computeLayout(w: number, h: number, laneCount: number): Layout {
  const orient: Orientation = w >= h * 1.02 ? "h" : "v";
  const compact = Math.min(w, h) < 460;

  if (orient === "h") {
    const fieldThickness = Math.min(h * 0.56, Math.max(196, 128 * Math.max(1, laneCount) + 40));
    const top = h * 0.5 - fieldThickness / 2 + h * 0.02;
    const strikeX = Math.max(72, Math.min(160, w * 0.19));
    const runLen = w - strikeX - Math.max(12, w * 0.02);
    const lanePitch = fieldThickness / laneCount;
    return {
      orient,
      w,
      h,
      laneCount,
      runLen,
      lanePitch,
      fieldThickness,
      compact,
      pt(u, v, out) {
        const o = out ?? { x: 0, y: 0 };
        o.x = strikeX + u * runLen;
        o.y = top + v * fieldThickness;
        return o;
      },
      laneV: (lane) => (lane + 0.5) / laneCount,
      along: { x: 1, y: 0 },
      across: { x: 0, y: 1 },
      strikeA: { x: strikeX, y: top },
      strikeB: { x: strikeX, y: top + fieldThickness },
      uMax: 1.06,
      uMin: -strikeX / runLen - 0.06,
    };
  }

  const fieldThickness = Math.min(w * 0.94, Math.max(190, 132 * Math.max(1, laneCount) + 30));
  const left = w / 2 - fieldThickness / 2;
  const strikeY = h * 0.775;
  const runLen = strikeY - Math.max(64, h * 0.13);
  const lanePitch = fieldThickness / laneCount;
  return {
    orient,
    w,
    h,
    laneCount,
    runLen,
    lanePitch,
    fieldThickness,
    compact,
    pt(u, v, out) {
      const o = out ?? { x: 0, y: 0 };
      o.x = left + v * fieldThickness;
      o.y = strikeY - u * runLen;
      return o;
    },
    laneV: (lane) => (lane + 0.5) / laneCount,
    along: { x: 0, y: -1 },
    across: { x: 1, y: 0 },
    strikeA: { x: left, y: strikeY },
    strikeB: { x: left + fieldThickness, y: strikeY },
    uMax: 1.06,
    uMin: -(h - strikeY) / runLen - 0.06,
  };
}

/** Which lane a pointer at screen (x,y) belongs to. */
export function laneAtPoint(l: Layout, x: number, y: number): number {
  if (l.orient === "h") {
    const v = (y - l.strikeA.y) / l.fieldThickness;
    return Math.max(0, Math.min(l.laneCount - 1, Math.floor(v * l.laneCount)));
  }
  const v = (x - l.strikeA.x) / l.fieldThickness;
  return Math.max(0, Math.min(l.laneCount - 1, Math.floor(v * l.laneCount)));
}
