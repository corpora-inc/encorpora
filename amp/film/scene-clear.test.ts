import { describe, expect, it } from "vitest";
import { startsCleared } from "./example";

describe("a shot that begins by clearing parts", () => {
  const scene = (t0: number, ...does: string[]) => ({ a: { do: "scene", actions: does.map((d) => ({ do: d, target: "x" })) } as any, t0 });
  const text = (t0: number) => ({ a: { do: "text", text: "A line" } as any, t0 });
  it("starts without them when the clear is the shot's first cue", () => {
    expect(startsCleared([scene(0.5, "disappear", "disappear"), text(0.5), scene(2, "appear")])).toBe(true);
  });
  it("keeps parts that are shown first and taken away later, or cleared together with an entrance", () => {
    expect(startsCleared([text(0.5), scene(4, "disappear")])).toBe(false);
    expect(startsCleared([scene(0.5, "disappear", "appear")])).toBe(false);
    expect(startsCleared([scene(0.5, "appear"), scene(3, "disappear")])).toBe(false);
    expect(startsCleared([text(0.5)])).toBe(false);
  });
});
