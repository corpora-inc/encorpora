/**
 * A sheer polygon: the screenplay accepts the option on a poly only, its fill
 * is painted see-through while a piece without it is painted exactly as
 * before, and a sheer tile's thickness is cut away from under its face.
 */
import { describe, expect, it } from "vitest";
import { scriptSchema } from "./schema";
import { polyPaint, SHEER, SHEER_SHADOW, sheerSide } from "./stage";

const film = (part: Record<string, unknown>) => ({
  id: "t", title: "t",
  shots: [{
    figure: { view: [0, 0, 4, 4], points: { A: [0, 0], B: [4, 0], C: [4, 4], D: [0, 4] }, parts: [part] },
    beats: [{ say: "A tile." }],
  }],
});

describe("a sheer polygon", () => {
  it("is an option of a poly, and of nothing else", () => {
    const tile = { id: "tile", poly: ["A", "B", "C", "D"], fill: "warm-fill", ink: "ink", start: true };
    expect(scriptSchema.safeParse(film({ ...tile, sheer: true })).success).toBe(true);
    expect(scriptSchema.safeParse(film({ ...tile, solid: true, sheer: true })).success).toBe(true);
    expect(scriptSchema.safeParse(film({ ...tile, sheer: "half" })).success).toBe(false);
    expect(scriptSchema.safeParse(film({ id: "s", seg: ["A", "B"], sheer: true })).success).toBe(false);
  });

  it("paints its fill see-through and its shadow lighter; without it nothing changes", () => {
    for (const o of [1, 0.4, 0]) {
      expect(polyPaint({}, o)).toEqual({ fill: o, shadow: 1 });
      expect(polyPaint({ sheer: false }, o)).toEqual({ fill: o, shadow: 1 });
      expect(polyPaint({ sheer: true }, o)).toEqual({ fill: o * SHEER, shadow: SHEER_SHADOW });
    }
    // enough of the fill to read as its colour, enough of what is under it to read through
    expect(SHEER).toBeGreaterThan(0.4);
    expect(SHEER).toBeLessThan(0.7);
    expect(SHEER_SHADOW).toBeLessThan(0.5);
  });

  it("cuts a sheer tile's thickness away from under its face", () => {
    // the face sits 7 px above the side; the side tucks 1 px under it
    expect(sheerSide([[10, 20], [50, 20], [50, 60]], 7)).toBe("M-99999 -99999H99999V99999H-99999ZM10.00 12.00L50.00 12.00L50.00 52.00Z");
  });
});
