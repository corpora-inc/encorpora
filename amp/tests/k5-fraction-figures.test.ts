import { test } from "node:test";
import assert from "node:assert/strict";
import { generateProblem } from "../src/math/engine";

const seeds = (n: number, p: string) =>
  Array.from({ length: n }, (_, i) => `${p}-${i}`);

test("a fraction comparison's lesson model shades each fraction; the practice figure stays unshaded", () => {
  for (const id of [
    "compare-like-denominators",
    "compare-like-numerators",
    "compare-unlike-fractions",
  ])
    for (const seed of seeds(40, id)) {
      const p = generateProblem(id, seed);
      const figure = p.public.figure as {
        kind: string;
        bars: { parts: number; shaded: number; label: string }[];
      };
      // The practice figure must not shade the answer (part-whole oracle).
      assert.ok(
        figure.bars.every((b) => b.shaded === 0),
        `${id} ${seed}`,
      );
      // The worked model in the lesson shades each fraction's top number.
      const bars = (
        p.walkthrough?.elements.find(
          (e) => (e as { type?: string }).type === "fractionBar",
        ) as { bars: { parts: number; shaded: number }[] } | undefined
      )?.bars;
      assert.ok(bars, `${id} ${seed} has a shaded walkthrough`);
      figure.bars.forEach((b, i) => {
        const [top, bottom] = b.label.split("/").map(Number);
        assert.deepEqual(
          { parts: bars![i]!.parts, shaded: bars![i]!.shaded },
          { parts: bottom, shaded: top },
          `${id} ${seed}`,
        );
      });
    }
});

test("tenths become hundredths by a shown multiplication", () => {
  for (const seed of seeds(60, "tenths")) {
    const p = generateProblem("tenths-as-hundredths", seed);
    const text = p.explanation.join(" ");
    if (!/\/10\b|0\.\d = /.test(p.public.prompt)) continue;
    assert.doesNotMatch(text, /You can only add/, seed);
    if (/□\/100/.test(p.public.prompt))
      assert.match(text, /\d+ × 10 = \d+ hundredths/, `${seed}: ${text}`);
  }
});
