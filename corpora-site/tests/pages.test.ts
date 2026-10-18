import assert from "node:assert/strict";
import test from "node:test";
import React, { renderToStaticMarkup } from "../src/react.js";
const { createElement } = React;
import { FractionPracticeFigure } from "../../amp/src/web/FractionPracticeFigure.js";
import { Page } from "../src/pages.js";
import { configSchema } from "../src/config.js";
import { product } from "../src/product.js";
test("pages encode configured content and keep scripts first-party", () => {
  const config = configSchema.parse({
    operator: {
      legalName: '<img src=x onerror="alert(1)">',
      postalAddress: "Example address",
      telephone: "Example phone",
    },
  });
  const html = renderToStaticMarkup(
    createElement(Page, { route: "/legal/terms/", config }),
  );
  assert.ok(html.includes("&lt;img"));
  assert.ok(!html.includes("<img"));
  assert.ok(html.includes("Draft for counsel review"));
  assert.ok(html.includes('name="robots" content="noindex, nofollow"'));
  assert.ok(!html.includes("<script"));
});
test("coverage follows actual catalog and qualifies standards coverage", () => {
  assert.ok(product.summary.templatesPresent > 0);
  const html = renderToStaticMarkup(
    createElement(Page, { route: "/amp/", config: configSchema.parse({}) }),
  );
  assert.ok(html.includes(String(product.summary.templatesPresent)));
  assert.ok(html.includes("not a complete K–12 course"));
  assert.ok(html.includes("katex-mathml"));
  assert.ok(!html.includes("choiceFeedback"));
});

test("shared AMP figures with hooks use the renderer's React runtime", () => {
  const html = renderToStaticMarkup(
    createElement(FractionPracticeFigure, {
      figure: {
        kind: "rational-line",
        denominator: 4,
        maxWhole: 2,
        points: [{ numerator: 3, label: "P" }],
        unit: "one unit",
      },
    }),
  );
  assert.ok(html.includes("<svg"));
});

test("worksheet markup separates questions from the solution key", () => {
  const html = renderToStaticMarkup(
    createElement(Page, { route: "/samples/", config: configSchema.parse({}) }),
  );
  const questions = html
    .split('class="worksheet"')[1]!
    .split('class="answer-key"')[0]!;
  assert.ok(questions.includes("<svg"));
  assert.ok(!questions.includes("<details"));
  assert.ok(!questions.includes("Answer:"));
});
