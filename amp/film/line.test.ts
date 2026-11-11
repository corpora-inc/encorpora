import { describe, expect, it } from "vitest";
import { fillLine, readLine, readsLine } from "./line";
import { fmtNum } from "./stage";

describe("a line read as y = mx + b", () => {
  it("reads the slope and where the line meets the y axis", () => {
    expect(readLine([0, 4], [4, 16])).toEqual({ m: 3, b: 4 });
    expect(readLine([3, 1], [2, 3])).toEqual({ m: -2, b: 7 });
    expect(readLine([2, -8], [4, 16])).toEqual({ m: 12, b: -32 });
  });
  it("reads the same line from either end", () => {
    expect(readLine([4, 16], [0, 4])).toEqual(readLine([0, 4], [4, 16]));
  });
  it("keeps the slope when the line slides, and the start when it tilts about its start", () => {
    const slid = readLine([0, 8], [4, 20]);
    expect(slid).toEqual({ m: 3, b: 8 });
    const tilted = readLine([0, 4], [4, 0]);
    expect(tilted).toEqual({ m: -1, b: 4 });
  });
  it("has no slope and no intercept when the line is vertical", () => {
    const v = readLine([2, 1], [2, 5]);
    expect(v.m).toBeNaN();
    expect(v.b).toBeNaN();
  });
  it("fills @m and @b in a label, every time they occur", () => {
    const fmt = (v: number) => fmtNum(v, 2);
    expect(fillLine("m=@m,\\ b=@b", readLine([0, 4], [4, 16]), fmt)).toBe("m=3,\\ b=4");
    expect(fillLine("@m\\cdot 2+@b=@b+2\\cdot @m", { m: 0.5, b: -1 }, fmt)).toBe("0.5\\cdot 2+-1=-1+2\\cdot 0.5");
    // partway through a tilt the slope is rounded to two places, and -0 never shows
    expect(fillLine("@m", { m: 1 / 3, b: 0 }, fmt)).toBe("0.33");
    expect(fillLine("@m", { m: -0.001, b: 0 }, fmt)).toBe("0");
    expect(fillLine("@m", readLine([2, 1], [2, 5]), fmt)).toBe("\\text{undefined}");
  });
  it("knows which labels ask for a line", () => {
    expect(readsLine("m=@m")).toBe(true);
    expect(readsLine("b=@b")).toBe(true);
    expect(readsLine("y=@y")).toBe(false);
    expect(readsLine("@n")).toBe(false);
  });
});
