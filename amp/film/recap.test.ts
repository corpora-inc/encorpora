import { describe, expect, it } from "vitest";
import { recapCut, WIDE } from "./stage";

describe("a recap card taller than the frame", () => {
  const cut = (cardH: number) => recapCut(cardH, WIDE.recap, WIDE.h);
  it("shows whole while its steps need no more than the frame's height", () => {
    expect(cut(600)).toBe(0);
    expect(cut(WIDE.recap.h)).toBe(0);
    // taller than its place, it eats into the margin and still shows whole
    expect(cut(WIDE.h)).toBe(0);
    // a rounding sliver is not a cut-off step
    expect(cut(WIDE.h + 0.8)).toBe(0);
  });
  it("reports how many pixels are lost at each end", () => {
    expect(cut(WIDE.h + 20)).toBe(10);
    expect(cut(1157)).toBe(38);
  });
  it("measures the worse end when the card's place is not centred in the frame", () => {
    // 900 px of card centred on a place whose middle is at 400: its top is 50 px above the frame
    expect(recapCut(900, { y: 0, h: 800 }, 1080)).toBe(50);
    expect(recapCut(900, { y: 280, h: 800 }, 1080)).toBe(50);
  });
  it("keeps the 16:9 card's place centred, with a margin above and below", () => {
    expect(WIDE.recap.y).toBeGreaterThan(0);
    expect(WIDE.recap.y * 2 + WIDE.recap.h).toBe(WIDE.h);
  });
});
