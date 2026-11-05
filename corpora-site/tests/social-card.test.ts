import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import React, { renderToStaticMarkup } from "../src/react.js";
import { configSchema } from "../src/config.js";
import { Page, routesFor } from "../src/pages.js";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";
import {
  ruleY,
  cardHeight,
  cardSpec,
  cardSvg,
  cardWidth,
  parseTokens,
  renderCard,
} from "../src/social-card.js";
import { fundingFixture } from "./funding-fixture.js";
const { createElement } = React;

const tokens = parseTokens(
  await readFile(new URL("../../amp/src/web/ui/tokens.css", import.meta.url), "utf8"),
);
const config = configSchema.parse({
  siteUrl: "https://corpora.inc",
  funding: [
    fundingFixture,
    {
      ...fundingFixture,
      state: "DC",
      program: "District program",
      page: { ...fundingFixture.page, slug: "district-program" },
    },
  ],
});

function pngSize(png: Buffer) {
  assert.equal(png.subarray(1, 4).toString("ascii"), "PNG");
  return [png.readUInt32BE(16), png.readUInt32BE(20)];
}

test("every route renders a large-image share card", () => {
  const names = new Set<string>();
  for (const route of routesFor(config)) {
    const card = renderCard(route, config, tokens);
    assert.deepEqual(pngSize(card.png), [cardWidth, cardHeight], route);
    assert.match(card.name, /^[a-z0-9-]+-[0-9a-f]{12}\.png$/);
    assert.ok(card.alt.length > 20, route);
    names.add(card.name);
  }
  assert.equal(names.size, routesFor(config).length);
});

test("cards repeat the heading and eyebrow the page shows", () => {
  const html = renderToStaticMarkup(
    createElement(Page, { route: "/parents/", config }),
  );
  const spec = cardSpec("/parents/", config);
  assert.ok(html.includes(`<h1>${spec.heading}</h1>`));
  assert.ok(html.includes(`>${spec.label}</p>`));
  assert.equal(cardSpec("/esa/", config).art.kind, "states");
  assert.deepEqual(cardSpec("/esa/synthetic-program/", config).art, {
    kind: "state",
    state: "AZ",
  });
});

test("pages declare absolute share images only when the origin is known", () => {
  const socialImage = { path: "/assets/social/home-0123456789ab.png", alt: "Card" };
  const html = renderToStaticMarkup(
    createElement(Page, { route: "/", config, socialImage }),
  );
  for (const tag of [
    '<meta property="og:image" content="https://corpora.inc/assets/social/home-0123456789ab.png"/>',
    '<meta property="og:image:width" content="1200"/>',
    '<meta property="og:image:height" content="630"/>',
    '<meta property="og:url" content="https://corpora.inc/"/>',
    '<meta name="twitter:card" content="summary_large_image"/>',
    '<meta name="twitter:image" content="https://corpora.inc/assets/social/home-0123456789ab.png"/>',
  ])
    assert.ok(html.includes(tag), tag);
  const preview = renderToStaticMarkup(
    createElement(Page, { route: "/", config: configSchema.parse({}), socialImage }),
  );
  assert.ok(preview.includes('property="og:title"'));
  assert.ok(!preview.includes("og:image"));
});

test("long configured text degrades instead of overflowing or failing", () => {
  const headline =
    "Use your Arizona Empowerment Scholarship Account for adaptive mathematics practice, lessons and printable worksheets for every learner in the family";
  assert.ok(headline.length <= 160);
  const long = configSchema.parse({
    ...config,
    funding: [
      {
        ...fundingFixture,
        page: {
          ...fundingFixture.page,
          presentation: {
            headline,
            statusLabel: "Synthetic route",
            actionLabel: "Request an invoice",
            actionSubject: "Invoice question",
          },
        },
      },
    ],
  });
  // The longest valid headline still fits without truncation.
  const svg = cardSvg(cardSpec("/esa/synthetic-program/", long), tokens);
  assert.ok(svg.includes("family") && !svg.includes("…"));
  const overlong = cardSvg(
    { ...cardSpec("/esa/synthetic-program/", long), heading: `${headline} ${headline}` },
    tokens,
  );
  assert.ok(overlong.includes("…"));
  // DC's eyebrow drops "Education funds" rather than running into the panel.
  const dc = cardSvg(cardSpec("/esa/district-program/", config), tokens);
  assert.ok(dc.includes("DISTRICT OF COLUMBIA"));
  assert.ok(!dc.includes("EDUCATION FUNDS"));
});

test("characters the card fonts lack fail the build instead of rendering boxes", () => {
  assert.throws(
    () =>
      cardSvg(
        { ...cardSpec("/try/", config), heading: "Start with 练习." },
        tokens,
      ),
    /no glyph/,
  );
});

test("headings of every length stay clear of the rule above the address", () => {
  const fontFiles = ["Main-Regular", "Main-Italic"].map((name) =>
    fileURLToPath(
      new URL(`../../amp/node_modules/katex/dist/fonts/KaTeX_${name}.ttf`, import.meta.url),
    ),
  );
  const headings = [
    "Get help with AMP.",
    "A complete math curriculum, from counting to precalculus.",
    // Production New Hampshire guide headline: four lines at full size used
    // to run into the rule.
    "Use your New Hampshire EFA funds for AMP Math",
    "Use your Arizona Empowerment Scholarship Account for adaptive mathematics practice, lessons and printable worksheets for every learner in the family",
  ];
  for (const heading of headings) {
    const svg = cardSvg({ ...cardSpec("/try/", config), heading }, tokens);
    const text = svg.match(/<text[^>]*font-family="KaTeX_Main"[\s\S]*?<\/text>/g)!.join("");
    const box = new Resvg(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${cardWidth}" height="${cardHeight}">${text}</svg>`,
      { font: { fontFiles, loadSystemFonts: false, defaultFontFamily: "KaTeX_Main" } },
    ).getBBox()!;
    assert.ok(box.y + box.height <= ruleY - 20, `${heading}: ink ends at ${box.y + box.height}`);
  }
});
