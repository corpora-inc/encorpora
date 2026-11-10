import { describe, expect, it } from "vitest";
import { axisSpan, foot, glided, onCircle, sectorAngles, sweepLabelAngle, traceRange } from "./wave";

const near = (a: number[], b: number[]) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i]!, 9));

describe("onCircle", () => {
  it("starts at three o'clock and turns counterclockwise", () => {
    near(onCircle([-4, 0], 3, 0), [-1, 0]);
    near(onCircle([-4, 0], 3, 90), [-4, 3]);
    near(onCircle([-4, 0], 3, 180), [-7, 0]);
    near(onCircle([-4, 0], 3, 270), [-4, -3]);
    near(onCircle([-4, 0], 3, 360), [-1, 0]);
  });
  it("is never higher than the radius: the height is the sine", () => {
    for (let d = 0; d <= 720; d += 15) {
      const [, y] = onCircle([0, 0], 3, d);
      expect(Math.abs(y)).toBeLessThanOrEqual(3 + 1e-9);
      expect(y).toBeCloseTo(3 * Math.sin((d * Math.PI) / 180), 9);
    }
  });
});

describe("foot", () => {
  it("drops a point to the x axis", () => {
    expect(foot([2.5, -1.7])).toEqual([2.5, 0]);
  });
});

describe("sectorAngles", () => {
  it("outlines the swept angle from 0 and ends exactly on it", () => {
    const a = sectorAngles(100, 10);
    expect(a[0]).toBe(0);
    expect(a[a.length - 1]).toBe(100);
    expect(a).toEqual([0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
  });
  it("is a full disc past one turn and nothing before it starts", () => {
    expect(sectorAngles(500)[sectorAngles(500).length - 1]).toBe(360);
    expect(sectorAngles(-20)).toEqual([0]);
  });
  it("puts the reading label on the bisector", () => {
    expect(sweepLabelAngle(90)).toBe(45);
    expect(sweepLabelAngle(400)).toBe(180);
  });
});

describe("traceRange", () => {
  it("draws no farther than the point it is traced up to", () => {
    expect(traceRange(0, 4, [-1, 6], 2.5)).toEqual([0, 2.5]);
    expect(traceRange(0, 4, [-1, 6])).toEqual([0, 4]);
    expect(traceRange(undefined, undefined, [-1, 6], 10)).toEqual([-1, 6]);
  });
  it("is nothing when the point has not left the start", () => {
    expect(traceRange(0, 4, [-1, 6], 0)).toBeNull();
  });
});

describe("axisSpan", () => {
  it("keeps the x axis out of the circle's room", () => {
    expect(axisSpan([-8, 5], [0, 4.2])).toEqual([0, 4.2]);
    expect(axisSpan([-8, 5])).toEqual([-8, 5]);
    expect(axisSpan([-8, -1], [0, 4])).toBeNull();
  });
});

describe("glided", () => {
  const lin = (u: number) => Math.min(1, Math.max(0, u));
  it("follows each glide in order and holds the last value", () => {
    const g = [{ t0: 1, dur: 2, from: 0, to: 360 }, { t0: 5, dur: 2, from: 360, to: 720 }];
    expect(glided(0, g, 0.5, lin)).toBe(0);
    expect(glided(0, g, 2, lin)).toBe(180);
    expect(glided(0, g, 4, lin)).toBe(360);
    expect(glided(0, g, 6, lin)).toBe(540);
    expect(glided(0, g, 9, lin)).toBe(720);
  });
  it("two glides with the same start and length stay in step: the circle and the wave agree", () => {
    const turn = [{ t0: 1, dur: 4, from: 0, to: 360 }], run = [{ t0: 1, dur: 4, from: 0, to: 2 }];
    for (let t = 1; t <= 5; t += 0.25) {
      const deg = glided(0, turn, t, lin), x = glided(0, run, t, lin);
      // y = 3 sin(pi x) is the height of the point at angle deg on a circle of radius 3
      expect(onCircle([0, 0], 3, deg)[1]).toBeCloseTo(3 * Math.sin(Math.PI * x), 9);
    }
  });
});
