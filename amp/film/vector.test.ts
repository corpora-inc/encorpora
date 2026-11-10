import { describe, expect, it } from "vitest";
import { planVector, vectorPath, type VectorPoint } from "./vector";
import { partSchema } from "./schema";

describe("endpoint arrows", () => {
  it("places the tip at the actual endpoint in all four quadrants", () => {
    for (const head of [[120, 80], [-120, 80], [-120, -80], [120, -80]] as VectorPoint[]) {
      const p = planVector([0, 0], head)!;
      expect(p.tip).toEqual(head);
      for (const w of p.wings) {
        expect((w[0] - head[0]) * head[0] + (w[1] - head[1]) * head[1]).toBeLessThan(0);
      }
    }
  });
  it("slides an addend tip to tail without changing its displacement", () => {
    const before = planVector([0, 0], [-100, 200])!;
    const after = planVector([300, 100], [200, 300])!;
    expect(after.tip).toEqual([200, 300]);
    before.wings.forEach((p, i) => {
      expect(after.wings[i]![0]).toBeCloseTo(p[0] + 300, 10);
      expect(after.wings[i]![1]).toBeCloseTo(p[1] + 100, 10);
    });
    expect(after.tip.map((v, i) => v - after.tail[i]!)).toEqual([-100, 200]);
  });
  it("moves the arrowhead with the drawn tip, not ahead of it", () => {
    const p = planVector([10, 20], [110, 220], 0.25)!;
    expect(p.tip).toEqual([35, 70]);
  });
  it("scales the head down on a short arrow and early in a trace", () => {
    const p = planVector([0, 0], [100, 0], 0.01)!;
    expect(p.tip).toEqual([1, 0]);
    expect(p.wings[0][0]).toBeCloseTo(0.6);
    expect(p.wings[0][1]).toBeCloseTo(0.208);
  });
  it("does not invent a direction for zero or draw before the start", () => {
    expect(planVector([4, 5], [4, 5])).toBeNull();
    expect(planVector([0, 0], [10, 0], -1)).toBeNull();
    expect(vectorPath(null)).toBe("");
    expect(planVector([0, 0], [10, 0], 2)!.tip).toEqual([10, 0]);
  });
  it("seeks backwards reproducibly without mutating its input", () => {
    const a: VectorPoint = [0, 0], b: VectorPoint = [100, 0];
    const mid = vectorPath(planVector(a, b, 0.5));
    planVector(a, b, 1);
    expect(vectorPath(planVector(a, b, 0.5))).toBe(mid);
    expect(a).toEqual([0, 0]);
    expect(b).toEqual([100, 0]);
  });
  it("has its own schema field, separate from parallel marks on segments", () => {
    expect(partSchema.parse({ id: "v", vector: ["O", "P"], ink: "accent" })).toHaveProperty("vector");
    expect(partSchema.safeParse({ id: "v", vector: ["O"] }).success).toBe(false);
    expect(partSchema.safeParse({ id: "v", vector: ["O", "P"], arrows: 2 }).success).toBe(false);
    expect(partSchema.parse({ id: "s", seg: ["O", "P"], arrows: 2 })).toHaveProperty("arrows", 2);
  });
});
