import assert from "node:assert/strict";
import test from "node:test";
import katex from "katex";
import { mathmlMeaning } from "./fixtures/mathml-meaning";
const meaning = (tex: string, displayMode = false) =>
  mathmlMeaning(katex.renderToString(tex, { displayMode }));

test("semantic comparison allows display style and spacing while preserving operator scope", () => {
  for (const tex of [
    String.raw`\sqrt{9}!`,
    String.raw`\frac{1}{2} + x^2`,
    String.raw`\left|x\right|'`,
    String.raw`\sum_{k=1}^{16}(-4k+3)`,
  ])
    assert.equal(meaning(tex), meaning(tex, true), tex);
  assert.equal(meaning("x + 2"), meaning(String.raw`x\, +\; 2`));
  for (const [before, after] of [
    [String.raw`\sqrt{9}!`, String.raw`\sqrt{9!}`],
    [String.raw`\sqrt{9}\%`, String.raw`\sqrt{9\%}`],
    [String.raw`\sqrt{9}'`, String.raw`\sqrt{9'}`],
    [String.raw`{(x+1)}^2`, String.raw`(x+1^2)`],
    [String.raw`\left|x\right|!`, String.raw`\left|x!\right|`],
    [String.raw`\frac{1}{2+x}`, String.raw`\frac{1}{2}+x`],
    ["8.10 + 8 = 18", "10 + 8 = 18"],
    [String.raw`\sum_{k=1}^{16} k`, String.raw`\sum_{k=2}^{16} k`],
  ])
    assert.notEqual(meaning(before!), meaning(after!), `${before} -> ${after}`);
  assert.notEqual(
    mathmlMeaning("x+2"),
    meaning("x+2"),
    "a raw-source fallback must not silently disappear",
  );
  assert.notEqual(
    mathmlMeaning(
      '<math><mstyle mathvariant="bold"><mi>x</mi></mstyle></math>',
    ),
    mathmlMeaning("<math><mi>x</mi></math>"),
    "a notation variant inherited from mstyle must survive",
  );
});
