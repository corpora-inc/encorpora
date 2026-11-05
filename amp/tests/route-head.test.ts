import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import {
  applyRouteHead,
  pitchDescription,
  routeHead,
} from "../src/web/app/route-head.js";
import { googlePageTitle } from "../src/analytics/google-analytics.js";

const { JSDOM } = createRequire(import.meta.url)("jsdom") as {
  JSDOM: new (html: string) => { window: { document: Document } };
};
const indexHtml = readFileSync(
  new URL("../index.html", import.meta.url),
  "utf8",
);
const fresh = () => new JSDOM(indexHtml).window.document;
const content = (doc: Document, selector: string) =>
  doc.head.querySelector(selector)?.getAttribute("content");

test("index.html paints the plain pitch's head, so / never changes it", () => {
  const doc = fresh();
  const pitch = routeHead("/", "pitch")!;
  assert.equal(doc.title, pitch.title);
  assert.equal(content(doc, 'meta[name="description"]'), pitch.description);
  assert.equal(content(doc, 'meta[property="og:title"]'), pitch.title);
  assert.equal(
    content(doc, 'meta[property="og:description"]'),
    pitch.description,
  );
  assert.equal(
    content(doc, 'meta[property="og:url"]'),
    "https://amp.corpora.inc/",
  );
  assert.equal(content(doc, 'meta[property="og:type"]'), "website");
  assert.equal(
    content(doc, 'meta[name="twitter:card"]'),
    "summary_large_image",
  );
  assert.equal(content(doc, 'meta[name="twitter:title"]'), pitch.title);
  assert.equal(
    content(doc, 'meta[name="twitter:description"]'),
    pitch.description,
  );
  assert.ok(content(doc, 'meta[name="theme-color"]'));
  // Served for every route, so a static canonical would claim every private
  // screen is the pitch. The router writes it per public route.
  assert.equal(doc.head.querySelectorAll('link[rel="canonical"]').length, 0);
  // The build adds the generated card inside the block it strips from skill pages.
  assert.match(
    indexHtml,
    /<!--amp-product-social-start-->[\s\S]*og:title[\s\S]*<!--amp-product-social-end-->/,
  );
  const before = doc.head.innerHTML;
  applyRouteHead(doc, pitch);
  const canonical = doc.head.querySelector('link[rel="canonical"]');
  canonical?.remove();
  assert.equal(doc.head.innerHTML, before, "/ rewrites nothing it painted");
});

test("canonical URLs drop campaign, click, program and private parameters", () => {
  for (const [location, canonical] of [
    [
      "/?program=ar-efa&utm_source=google&utm_medium=cpc&gclid=Valid_Click_123",
      "https://amp.corpora.inc/",
    ],
    [
      "/sign-up?entry=pitch-try&return=free-practice",
      "https://amp.corpora.inc/sign-up",
    ],
    [
      "/purchase/arizona-esa/?token=private",
      "https://amp.corpora.inc/purchase/arizona-esa",
    ],
    [
      "/invoice/arkansas-efa?program=ar-efa",
      "https://amp.corpora.inc/invoice/arkansas-efa",
    ],
  ] as const)
    assert.equal(routeHead(location, "pitch")?.canonical, canonical, location);
});

test("private screens and the signed-in home have no canonical", () => {
  for (const location of [
    "/practice",
    "/family/learners",
    "/try/practice",
    "/start/name",
  ])
    assert.equal(routeHead(location, "pitch")?.canonical, null, location);
  assert.equal(routeHead("/", "app")?.canonical, null);
  assert.equal(routeHead("/", "app")?.title, "AMP · Adaptive Math Pathways");
  // The skill map owns its own head.
  assert.equal(routeHead("/pathways/count-to-20", "pitch"), undefined);
});

test("a funded-program pitch names the program in title and description", () => {
  const head = routeHead("/?program=nh-efa&utm_source=google", "pitch")!;
  assert.equal(
    head.title,
    "AMP: Adaptive Math Pathways for New Hampshire EFA families",
  );
  assert.equal(head.description, pitchDescription("New Hampshire EFA"));
  assert.match(head.description, /for New Hampshire EFA families/);
  assert.equal(
    routeHead("/?program=tx-esa", "pitch")!.description,
    pitchDescription(),
  );
});

test("the document title of every public route is the title GA receives", () => {
  for (const location of [
    "/",
    "/?program=ar-efa",
    "/?program=tx-esa",
    "/sign-up",
    "/sign-up?entry=pitch-try&return=free-practice",
    "/sign-up?entry=pitch-workbook&return=free-practice",
    "/sign-up?entry=pitch-buy",
    "/sign-in",
    "/plans",
    "/purchase/arkansas-efa",
    "/invoice/new-hampshire-efa",
  ])
    assert.equal(
      routeHead(location, "pitch")?.title,
      googlePageTitle(`https://amp.corpora.inc${location}`, "pitch"),
      location,
    );
});

test("route changes rewrite one set of tags and never touch skill-page tags", () => {
  const doc = fresh();
  const skillOg = doc.createElement("meta");
  skillOg.setAttribute("property", "og:title");
  skillOg.setAttribute("content", "Count to 20 | AMP Pathways");
  skillOg.setAttribute("data-pathways-static", "");
  doc.head.append(skillOg);
  applyRouteHead(
    doc,
    routeHead("/sign-up?entry=pitch-buy&program=ar-efa", "pitch")!,
  );
  applyRouteHead(
    doc,
    routeHead("/?program=ar-efa&gclid=Valid_Click_123", "pitch")!,
  );
  assert.equal(
    doc.title,
    "AMP: Adaptive Math Pathways for Arkansas EFA families",
  );
  assert.equal(doc.head.querySelectorAll('link[rel="canonical"]').length, 1);
  assert.equal(
    doc.head.querySelector('link[rel="canonical"]')?.getAttribute("href"),
    "https://amp.corpora.inc/",
  );
  for (const selector of [
    'meta[name="description"]',
    'meta[property="og:description"]',
    'meta[property="og:url"]',
    'meta[name="twitter:title"]',
  ])
    assert.equal(doc.head.querySelectorAll(selector).length, 1, selector);
  assert.equal(
    doc.head.querySelectorAll(
      'meta[property="og:title"]:not([data-pathways-static])',
    ).length,
    1,
  );
  assert.equal(skillOg.getAttribute("content"), "Count to 20 | AMP Pathways");
  applyRouteHead(doc, routeHead("/practice", "pitch")!);
  assert.equal(doc.title, "Math Practice | AMP");
  assert.equal(doc.head.querySelectorAll('link[rel="canonical"]').length, 0);
  assert.equal(
    content(doc, 'meta[property="og:url"]'),
    "https://amp.corpora.inc/",
  );
});
