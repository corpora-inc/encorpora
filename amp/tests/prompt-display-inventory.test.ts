import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { templates, generateProblem } from "../src/math/engine";
import { trailingDisplayMath } from "../src/content/prompt-structure";
import { segmentPrintText } from "../src/content/math-typesetting";
import { MathText } from "../src/web/MathText";
import { PrintMathText } from "../src/content/PrintMathText";
import { createRequire } from "node:module";
import { learnerTexts } from "./fixtures/math-typography";
const { JSDOM } = createRequire(import.meta.url)("jsdom") as {
  JSDOM: new (html: string) => { window: { document: Document } };
};

const document = new JSDOM("").window.document;
function assertSentenceBoundaries(text: string, label: string) {
  const boundaries = text.match(/\d\.\s+\d/g);
  if (!boundaries) return false;
  for (const Component of [MathText, PrintMathText]) {
    const element = document.createElement("div");
    element.innerHTML = renderToStaticMarkup(
      React.createElement(Component, { text }),
    );
    for (const formula of element.querySelectorAll("[data-plain]"))
      assert.doesNotMatch(
        formula.getAttribute("data-plain")!,
        /\d\.\s+\d/,
        label,
      );
    // Inspect the visible notation once, excluding its accessible MathML twin.
    element.querySelectorAll(".katex-mathml").forEach((node) => node.remove());
    const visible = element.textContent!.replace(/[\u200b-\u200d\ufeff]/g, "");
    // Fraction DOM order can place a denominator before its numerator. Count
    // preserved sentence spaces without assuming linear glyph order in math.
    assert.equal(
      (visible.match(/\d\.\s+\d/g) ?? []).length,
      boundaries.length,
      `${Component.name}: ${label}\nRendered: ${visible}`,
    );
  }
  return true;
}

test("all template explanations, methods and lesson worked steps preserve numeric sentence boundaries", (t) => {
  const texts = learnerTexts();
  const owners = new Set(texts.map((item) => item.owner));
  for (const template of templates)
    assert.ok(owners.has(template.id), template.id);
  let boundaries = 0;
  for (const { text, owner, where } of texts)
    if (assertSentenceBoundaries(text, `${owner}/${where}: ${text}`))
      boundaries++;
  assert.ok(
    boundaries > 0,
    "the corpus must exercise numeric sentence boundaries",
  );
  t.diagnostic(
    JSON.stringify({
      templates: templates.length,
      texts: texts.length,
      boundaryTexts: boundaries,
    }),
  );
});

// Independent expectation: a final tokenized formula after a colon/imperative
// must be displayed. This does not ask the formatter whether it supports it.
function expectedDisplay(text: string) {
  const tokens = segmentPrintText(text);
  if (
    tokens.at(-1)?.kind === "text" &&
    /^[.!?;\s]*$/.test(tokens.at(-1)!.source)
  )
    tokens.pop();
  const last = tokens.pop();
  if (last?.kind !== "math") return false;
  const lead = tokens
    .map((t) => t.source)
    .join("")
    .trim();
  return (
    /:\s*$/.test(lead) ||
    /^(?:Solve(?: for (?:real )?\$?[a-z]\$?)?|Simplify|Evaluate|Factor(?: completely)?|Expand(?: and simplify)?|Calculate|Compute|Rationalize the denominator and simplify)$/i.test(
      lead,
    )
  );
}

test("every template generates clean prompt and worked-step displays in web and print", (t) => {
  const affected = new Set<string>();
  const worked = new Set<string>();
  const visited = new Set<string>();
  const rendered = new Set<string>();
  let samples = 0;
  for (const template of templates) {
    visited.add(template.id);
    // Current clause variants and saved version-one prompts both reach readers.
    for (const version of new Set([1, template.version]))
      for (let seed = 0; seed < 20; seed++) {
        const problem = generateProblem(
          template.id,
          `display-${seed}`,
          version,
        );
        samples++;
        for (const [index, text] of [
          problem.public.prompt,
          ...problem.explanation,
          problem.hint,
        ].entries()) {
          const label = `${template.id}@${version}/${seed}/${index}: ${text}`;
          assertSentenceBoundaries(text, label);
          const display = trailingDisplayMath(text);
          if (expectedDisplay(text)) assert.ok(display, label);
          const standalone = trailingDisplayMath(text, true);
          if (standalone && index === 0 && version === template.version)
            assert.equal(standalone.punctuation, "", label);
          if (!display) continue;
          (index === 0 ? affected : worked).add(template.id);
          // Sample rendered markup for every affected family and surface;
          // all seeds above still pass the independent structure/period lint.
          const key = `${template.id}@${version}/${index === 0 ? "prompt" : "worked"}`;
          if (rendered.has(key)) continue;
          rendered.add(key);
          for (const Component of [MathText, PrintMathText]) {
            const html = renderToStaticMarkup(
              React.createElement(Component, { text }),
            );
            assert.match(html, /class="math-display"/, label);
            assert.match(html, /class="katex-display"/, label);
            assert.doesNotMatch(html, /katex-error/, label);
          }
        }
      }
  }
  assert.equal(visited.size, templates.length);
  assert.ok(
    affected.size > 30 && worked.size > 30,
    "the sweep must exercise prompts and explanations",
  );
  t.diagnostic(
    JSON.stringify({
      templates: visited.size,
      samples,
      promptTemplates: affected.size,
      workedTemplates: worked.size,
      renderedSurfaces: rendered.size,
    }),
  );
});
