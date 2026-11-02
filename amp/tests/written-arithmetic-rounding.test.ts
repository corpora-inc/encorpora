import assert from "node:assert/strict";
import test from "node:test";
import { generateProblem } from "../src/math/engine.js";

/** A written "a × b ≈ c" step rounds the product it shows, not a nearby one. */
test("sas-area-steps rounds the product it writes", () => {
  for (let i = 0; i < 200; i++) {
    const p = generateProblem("sas-area-steps", `round-${i}`);
    const step = p.explanation.find(
      (s) => s.includes("\\approx") && s.includes("\\times"),
    )!;
    const m = /([\d.]+)\\times([\d.]+)\\approx([\d.]+)/.exec(step)!;
    const [a, b, c] = [m[1], m[2], m[3]].map(Number) as [
      number,
      number,
      number,
    ];
    const places = (m[3]!.split(".")[1] ?? "").length;
    assert.ok(
      Math.abs(a * b - c) <= 0.5 * 10 ** -Math.max(places, 0) + 1e-9 &&
        Math.abs(a * b - c) <= 0.005 + 1e-9,
      `${step}: ${a} × ${b} = ${a * b}`,
    );
  }
});
