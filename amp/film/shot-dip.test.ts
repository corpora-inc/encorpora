// @vitest-environment jsdom
/**
 * Two different app figures in consecutive shots sit in the same card. Dissolved over
 * each other they read as one garbled picture, so the second waits until the first has gone.
 * The same figure carried into the next shot still dissolves, which reads as no change at all.
 */
import { describe, expect, it } from "vitest";
import { Film } from "./stage";
import { scriptSchema, type Timing } from "./schema";

const scene = (text: string) => ({ scene: { v: 1, elements: [{ type: "text", id: "a", text, at: [0, 0], font: "sans" }] } });

function film(first: unknown, second: unknown) {
  const script = scriptSchema.parse({
    id: "t", title: "t",
    shots: [first, second].map((figure) => ({ figure, beats: [{ say: "One two three." }] })),
  });
  const beat = (t0: number) => ({ start: t0, end: t0 + 1.4, words: ["One", "two", "three."].map((text, k) => ({ text, start: t0 + k * 0.5, end: t0 + k * 0.5 + 0.4 })) });
  const timing: Timing = { duration: 14, shots: [[beat(0.5)], [beat(6.5)]] };
  const root = document.createElement("div");
  document.body.appendChild(root);
  const f = new Film(root, script, timing, undefined, { checks: false });
  const [a, b] = f.shots;
  /** How much of each shot shows at t (0 when hidden). */
  const shown = (t: number) => { f.seek(t); return [a!, b!].map((s) => (s.el.style.visibility === "hidden" ? 0 : Number(s.el.style.opacity))); };
  return { change: b!.t0, shown };
}

describe("a shot change between two app figures", () => {
  it("never shows both: the second arrives after the first has gone", () => {
    const { change, shown } = film(scene("Set A"), scene("Set B"));
    for (let t = change - 0.2; t < change + 1.2; t += 0.02) {
      const [first, second] = shown(t);
      expect(Math.min(first!, second!)).toBeLessThan(0.05);
    }
    expect(shown(change + 1)[1]).toBe(1);
  });
  it("still dissolves when the figure is the same in both shots", () => {
    const { change, shown } = film(scene("Set A"), scene("Set A"));
    const [first, second] = shown(change + 0.15);
    expect(first!).toBeGreaterThan(0.2);
    expect(second!).toBeGreaterThan(0.05);
  });
});
