import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  trailingDisplayMath,
  normalizeTrailingMath,
} from "../src/content/prompt-structure";
import { segmentPrintText } from "../src/content/math-typesetting";
import { MathText } from "../src/web/MathText";
import { PrintMathText } from "../src/content/PrintMathText";

const examples = [
  ["Evaluate: $2+3.$", "Evaluate:", "$2+3$"],
  ["Solve for k 2.5k − 4.1 = −9.1.", "Solve for k", "2.5k − 4.1 = −9.1"],
  ["Solve for k: 2.5k − 4.1 = −9.1.", "Solve for k:", "2.5k − 4.1 = −9.1"],
  ["Solve for $k$: $2.5k-4.1=-9.1$.", "Solve for $k$:", "$2.5k-4.1=-9.1$"],
  ["Solve: $2x + 3 \\le 9$.", "Solve:", "$2x + 3 \\le 9$"],
  ["Simplify: $3(x+2)-x$.", "Simplify:", "$3(x+2)-x$"],
  ["Evaluate 2 + 3.", "Evaluate", "2 + 3"],
  ["Factor $x^2+4x+4$.", "Factor", "$x^2+4x+4$"],
  [
    "Expand and simplify (3x + 2)(x² − x + 3).",
    "Expand and simplify",
    "(3x + 2)(x² − x + 3)",
  ],
  [
    "Subtract 3 from both sides: $x=4$.",
    "Subtract 3 from both sides:",
    "$x=4$",
  ],
  ["Solve: □ + 3 = 8.", "Solve:", "□ + 3 = 8"],
  ["Evaluate \\(\\frac{1}{2}+3\\).", "Evaluate", "\\(\\frac{1}{2}+3\\)"],
  ["Use the diagram. Solve: 2x = 10.", "Use the diagram. Solve:", "2x = 10"],
];

test("display structure preserves the complete formula and removes sentence punctuation", () => {
  for (const [text, lead, source] of examples) {
    const display = trailingDisplayMath(text!);
    assert.ok(display, text);
    assert.equal(display.lead, lead);
    assert.equal(display.source, source);
    assert.equal(normalizeTrailingMath(text!), `${lead} ${source}`);
    assert.equal(
      normalizeTrailingMath(normalizeTrailingMath(text!)),
      normalizeTrailingMath(text!),
    );
  }
});

test("inline mathematics, currency, clock times and prose after mathematics are unchanged", () => {
  for (const text of [
    "For $x=4$, evaluate $x+2$ in your head.",
    "The result is $x=5$.",
    "What is $2+3$?",
    "Solve $x^2=4$ for all real $x$.",
    "A pen costs $3 and a book costs $5.",
    "Which clock shows 1:41?",
    "At 12:05, the train leaves.",
    "Lengths: 4 cm and 5 cm.",
    "Find the total: 4 + 5 dollars.",
    "Use $f(x)=x^2$: explain why it is positive.",
    "A choice: Store A.",
  ]) {
    assert.equal(trailingDisplayMath(text), null, text);
    assert.equal(normalizeTrailingMath(text), text);
  }
  assert.equal(
    trailingDisplayMath("$x+2$"),
    null,
    "a choice/label keeps its existing layout",
  );
  assert.equal(normalizeTrailingMath("$x+2$."), "$x+2$");
});

test("web, lesson and print markup display the same formula without a final period", () => {
  for (const Component of [MathText, PrintMathText])
    for (const [text, lead, source] of examples) {
      const html = renderToStaticMarkup(
        React.createElement(Component, { text: text! }),
      );
      assert.equal((html.match(/class="math-display"/g) ?? []).length, 1, text);
      assert.match(html, /class="katex-display"/);
      assert.doesNotMatch(html, /katex-error|\\text\{[.!?]\}/);
      assert.ok(html.endsWith("</span>"), text);
      assert.equal(
        html.replace(/ data-plain="[^"]*"/g, ""),
        renderToStaticMarkup(
          React.createElement(Component, { text: `${lead} ${source}` }),
        ).replace(/ data-plain="[^"]*"/g, ""),
      );
    }
});

test("systems keep all equations together in a stacked display", () => {
  assert.equal(
    trailingDisplayMath("Solve: 2x + 4y = 2; 5x + 2y = -3.")?.tex,
    "\\begin{gathered}2x + 4y = 2\\\\5x + 2y = -3\\end{gathered}",
  );
  const source = "$\\begin{cases}x+y=2\\\\x-y=4\\end{cases}$";
  assert.equal(trailingDisplayMath(`Solve: ${source}.`)?.source, source);
});

test("factorial operators survive punctuation cleanup, including powers", () => {
  for (const [text, source, tex] of [
    ["Evaluate 5!", "5!", "5!"],
    ["Compute 4!.", "4!", "4!"],
    ["Simplify: 2 + 3!", "2 + 3!", "2 + 3!"],
    ["Evaluate 2^3!.", "2^3!", "2^{3!}"],
    ["Evaluate (2^3)!.", "(2^3)!", "(2^{3})!"],
    ["Evaluate $5!$.", "$5!$", "5!"],
    ["Evaluate x_2!.", "x_2!", "x_{2}!"],
    ["Evaluate $x_2!$.", "$x_2!$", "x_2!"],
    ["Evaluate $x^2!$.", "$x^2!$", "x^2!"],
  ]) {
    const display = trailingDisplayMath(text!);
    assert.equal(display?.source, source, text);
    assert.equal(display?.tex, tex, text);
    assert.ok(normalizeTrailingMath(text!).endsWith(source!));
  }
});

test("TeX delimiter dots and exclaimed currency are not sentence math", () => {
  const text = String.raw`Evaluate: $\left(x\right.$.`;
  assert.equal(trailingDisplayMath(text)?.tex, String.raw`\left(x\right.`);
  assert.equal(normalizeTrailingMath(text), text.slice(0, -1));
  assert.deepEqual(segmentPrintText("A pen costs $3! A book costs $5."), [
    { kind: "text", source: "A pen costs $3! A book costs $5." },
  ]);
});
