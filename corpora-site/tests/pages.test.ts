import assert from "node:assert/strict";
import test from "node:test";
import React, { renderToStaticMarkup } from "../src/react.js";
const { createElement } = React;
import { FractionPracticeFigure } from "../../amp/src/web/FractionPracticeFigure.js";
import { Page, routesFor } from "../src/pages.js";
import { configSchema } from "../src/config.js";
import { product } from "../src/product.js";
import { guidedFundingFixture } from "./funding-fixture.js";
import { ico } from "../src/icons.js";
import { title } from "../src/pages.js";
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
  assert.ok(
    html.includes("a particular learning result, grade placement or test"),
  );
  assert.ok(!html.includes("complete grade-level coverage"));
  assert.ok(html.includes('name="robots" content="noindex, nofollow"'));
  assert.ok(!html.includes("<script"));
});
test("the AMP page claims the complete curriculum and proves it with catalog counts", () => {
  assert.ok(product.summary.templatesPresent > 0);
  const html = renderToStaticMarkup(
    createElement(Page, { route: "/amp/", config: configSchema.parse({}) }),
  );
  assert.ok(
    html.includes("A complete math curriculum, from counting to precalculus."),
  );
  assert.ok(
    html.includes(product.summary.templatesPresent.toLocaleString("en-US")),
  );
  for (const group of product.bands)
    assert.ok(
      html.includes(
        `${group.templates.length.toLocaleString("en-US")} problem types`,
      ),
    );
  assert.ok(
    html.includes('id="coverage"'),
    "legal and funding pages link to this anchor",
  );
  assert.ok(html.includes("katex-mathml"));
  assert.ok(!html.includes("choiceFeedback"));
});

test("marketing pages never undersell AMP (#1996); legal pages are exempt", () => {
  const config = configSchema.parse({
    funding: [
      {
        ...guidedFundingFixture,
        kind: "classwallet-direct-pay",
        page: { ...guidedFundingFixture.page, slug: "arkansas-efa" },
      },
    ],
  });
  const marketing = routesFor(config).filter(
    (route) => !route.startsWith("/legal/"),
  );
  assert.ok(marketing.includes("/esa/arkansas-efa/"));
  for (const route of marketing) {
    const html = renderToStaticMarkup(createElement(Page, { route, config }));
    for (const retired of [
      "not a complete",
      "selected skills",
      "cannot prove",
      "not a placement",
      "not an assessment",
      "Catalog inventory and limitations",
      "Coverage, stated precisely",
    ])
      assert.ok(!html.includes(retired), `${route} says "${retired}"`);
  }
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

test("privacy distinguishes placement expiry from trial and event retention", () => {
  const html = renderToStaticMarkup(
    createElement(Page, {
      route: "/legal/privacy/",
      config: configSchema.parse({}),
    }),
  );
  assert.ok(html.includes("Trial milestones"));
  assert.ok(html.includes("random identifier, an event type, and a timestamp"));
  assert.ok(html.includes("90 days after creation"));
  assert.ok(html.includes("including trials saved into a family account"));
  assert.ok(html.includes("14-day cleanup"));
  assert.ok(!html.includes("does not automatically expire"));
  assert.ok(!html.includes("keeps this link until the learner is deleted"));
});

test("funding page titles fit search results without losing the program", () => {
  const titled = (program: string) => {
    const config = {
      funding: [{ program, page: { slug: "example-fund" } }],
    } as never;
    return title("/esa/example-fund/", config);
  };
  assert.equal(
    titled("Short Fund"),
    "Short Fund and AMP Mathematics · Corpora",
  );
  const medium = "A Program With A Name Of About Fifty Characters";
  assert.equal(titled(medium), `${medium} and AMP`);
  const long =
    "Florida Family Empowerment Scholarship for Students with Unique Abilities";
  assert.equal(titled(long), long);
});

test("the ICO header points at each embedded image", () => {
  const png = Buffer.from([1, 2, 3, 4]);
  const file = ico([
    { size: 16, png },
    { size: 32, png },
  ]);
  assert.equal(file.readUInt16LE(2), 1);
  assert.equal(file.readUInt16LE(4), 2);
  assert.equal(file[6], 16);
  assert.equal(file[22], 32);
  assert.equal(file.readUInt32LE(6 + 12), 6 + 32);
  assert.equal(file.readUInt32LE(22 + 12), 6 + 32 + 4);
});
