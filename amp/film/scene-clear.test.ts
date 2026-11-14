import { describe, expect, it } from "vitest";
import { startsCleared } from "./example";

describe("a shot that begins by clearing parts", () => {
  const scene = (t0: number, ...does: string[]) => ({ a: { do: "scene", actions: does.map((d) => ({ do: d, target: "x" })) } as any, t0 });
  const text = (t0: number) => ({ a: { do: "text", text: "A line" } as any, t0 });
  it("starts without them when the clear is the shot's first cue", () => {
    expect(startsCleared([scene(0.5, "disappear", "disappear"), text(0.5), scene(2, "appear")])).toBe(true);
  });
  it("also starts set up when the first cue hides parts and moves others into place in an instant", () => {
    const setup = { a: { do: "scene", actions: [{ do: "disappear", target: "x" }, { do: "move", target: "y", by: [1, 0] }] } as any, t0: 0.5, dur: 0.01 };
    expect(startsCleared([setup, text(0.5)])).toBe(true);
    // a move that takes time on the first word is something to watch, not setup
    expect(startsCleared([{ ...setup, dur: 0.6 }, text(0.5)])).toBe(false);
  });
  it("starts set up when the first cue shows some parts and hides others in an instant", () => {
    const setup = { a: { do: "scene", actions: [{ do: "appear", target: "x" }, { do: "disappear", target: "y" }] } as any, t0: 0.5, dur: 0.01 };
    expect(startsCleared([setup, text(0.5)])).toBe(true);
    expect(startsCleared([{ ...setup, dur: 0.5 }, text(0.5)])).toBe(false);
  });
  it("keeps parts that are shown first and taken away later, or cleared together with an entrance", () => {
    expect(startsCleared([text(0.5), scene(4, "disappear")])).toBe(false);
    expect(startsCleared([scene(0.5, "disappear", "appear")])).toBe(false);
    expect(startsCleared([scene(0.5, "appear"), scene(3, "disappear")])).toBe(false);
    expect(startsCleared([text(0.5)])).toBe(false);
  });
});
