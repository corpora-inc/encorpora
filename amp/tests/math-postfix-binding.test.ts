import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import katex from "katex";
import { renderToStaticMarkup } from "react-dom/server";
import { createRequire } from "node:module";
import { expressionToTex } from "../src/content/math-typesetting";
import { trailingDisplayMath } from "../src/content/prompt-structure";
import { MathText } from "../src/web/MathText";
import { PrintMathText } from "../src/content/PrintMathText";
const { JSDOM } = createRequire(import.meta.url)("jsdom") as {
  JSDOM: new (html: string) => { window: { document: Document } };
};
const document = new JSDOM("").window.document;
function meaning(html: string) {
  const el = document.createElement("div");
  el.innerHTML = html;
  const math = el.querySelector("math")!;
  math.querySelectorAll("annotation").forEach((n) => n.remove());
  math.removeAttribute("display");
  return math.outerHTML;
}

// Independent, explicitly scoped TeX is the expected MathML for each input.
const cases = [
  ["√(9)!", String.raw`\sqrt{9}!`],
  ["√(9!)", String.raw`\sqrt{9!}`],
  ["(√(9))!", String.raw`(\sqrt{9})!`],
  ["√(16)! + 1", String.raw`\sqrt{16}! + 1`],
  ["√((9))!", String.raw`\sqrt{(9)}!`],
  ["√(√(16))!", String.raw`\sqrt{\sqrt{16}}!`],
  ["log_2(8)!", String.raw`\log_{2}{(8)}!`],
  ["log_2(8!)", String.raw`\log_{2}{(8!)}`],
  ["√(9)%", String.raw`\sqrt{9}\%`],
  ["√(9%)", String.raw`\sqrt{9\%}`],
  ["(3 + 6)%", String.raw`(3 + 6)\%`],
  ["√(9)^2", String.raw`\sqrt{9}^{2}`],
  ["√(9²)", String.raw`\sqrt{9^{2}}`],
  ["(2 + 3)^2", String.raw`{(2 + 3)}^{2}`],
  ["(2 + 3)²", String.raw`{(2 + 3)}^{2}`],
  ["√(9)!^2", String.raw`{\sqrt{9}!}^{2}`],
  ["2^3!", String.raw`2^{3!}`],
  ["2³!", String.raw`2^{3}!`],
  ["√(9)²!", String.raw`\sqrt{9}^{2}!`],
  ["2^(3)!", String.raw`2^{(3)!}`],
  ["(2^3)!", String.raw`(2^{3})!`],
  ["2^(√(9))!", String.raw`2^{(\sqrt{9})!}`],
  ["2^(3!)", String.raw`2^{3!}`],
  ["x_2!", String.raw`x_{2}!`],
  ["x₂!", String.raw`x_{2}!`],
  ["x_(2!)", String.raw`x_{2!}`],
  ["|−3|!", String.raw`\left|-3\right|!`],
  ["|3!|", String.raw`\left|3!\right|`],
  ["|−3|%", String.raw`\left|-3\right|\%`],
  ["|−3|^2", String.raw`\left|-3\right|^{2}`],
  ["√(|−9|)!", String.raw`\sqrt{\left|-9\right|}!`],
  ["2(3 + 4)!", String.raw`2(3 + 4)!`],
  ["(2 + 3)!(4 + 5)", String.raw`(2 + 3)!(4 + 5)`],
];

test("postfix operators bind outside closed arguments in parser, web and PDF markup", () => {
  for (const [source, expected] of cases) {
    assert.equal(expressionToTex(source!), expected, source);
    const text = `Evaluate: ${source}.`;
    assert.equal(trailingDisplayMath(text)?.tex, expected, text);
    const expectedMath = meaning(
      katex.renderToString(expected!, { displayMode: true }),
    );
    for (const Component of [MathText, PrintMathText])
      assert.equal(
        meaning(renderToStaticMarkup(React.createElement(Component, { text }))),
        expectedMath,
        `${Component.name}: ${text}`,
      );
  }
});

test("explicit TeX primes preserve their operand; unsupported plain primes stay unparsed", () => {
  for (const source of ["√(9)'", "√(9)′", "(x + 1)'", "|x|′"])
    assert.equal(expressionToTex(source), null, source);
  for (const tex of [
    String.raw`\sqrt{9}'`,
    String.raw`(x+1)''`,
    String.raw`\left|x\right|'`,
    String.raw`f'(x)`,
    String.raw`\sqrt{9'}`,
  ]) {
    const text = `Evaluate: $${tex}$.`;
    assert.equal(trailingDisplayMath(text)?.tex, tex);
    for (const Component of [MathText, PrintMathText])
      assert.equal(
        meaning(renderToStaticMarkup(React.createElement(Component, { text }))),
        meaning(katex.renderToString(tex, { displayMode: true })),
        `${Component.name}: ${text}`,
      );
  }
});
