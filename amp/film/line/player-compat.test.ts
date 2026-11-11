import { describe, expect, it } from "vitest";
import type { SemanticFigure } from "../../src/math/contracts";
import { checkPlayedExample, compatibleExample } from "./player-compat";

const line = (max: number): SemanticFigure => ({ kind: "scene", scene: {
  v: 1, width: 360, elements: [{ type: "numberLine", min: 0, max, step: max/10 }],
} });

describe("installed grading player compatibility", () => {
  it("excludes the large-coordinate scale regression", () => {
    expect(compatibleExample(line(10))).toBe(true);
    expect(compatibleExample(line(1_000_000))).toBe(false);
  });
  it("checks the chosen example but permits an independently drawn picture", () => {
    const figure = line(1_000_000);
    expect(() => checkPlayedExample({ figure, script: { shots: [{ figure: { example: true } }] } })).toThrow("0.01");
    expect(() => checkPlayedExample({ figure, script: { shots: [{ figure: { points: [] } }] } })).not.toThrow();
  });
});
