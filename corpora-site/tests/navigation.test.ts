import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { analyticsPath, externalLinks, redirects } from "../src/navigation.js";
import { marketingScreen } from "../../amp/src/analytics/site-categories.js";
import { RedirectPage, routesFor } from "../src/pages.js";
import React, { renderToStaticMarkup } from "../src/react.js";
import { configSchema } from "../src/config.js";
const { JSDOM } = createRequire(import.meta.url)("../../amp/node_modules/jsdom");

test("external browser destinations open without an opener and preserve referrer attribution", () => {
  const html = externalLinks('<a href="https://app.example.test/try?a=1&amp;b=2" target="_self" rel="nofollow">Try</a><a href="//research.example.test/paper">Study</a><a href="https://site.example.test/amp/">AMP</a><a href="/workbooks/">Paper</a><a href="#paper">Section</a><a href="mailto:support@example.test">Email</a>', "https://site.example.test/");
  const links = [...new JSDOM(html).window.document.querySelectorAll("a")] as HTMLAnchorElement[];
  for (const link of links.slice(0, 2)) {
    assert.equal(link.target, "_blank");
    assert.ok(link.relList.contains("noopener"));
    assert.ok(!link.relList.contains("noreferrer"));
  }
  assert.ok(links[0]!.relList.contains("nofollow"));
  assert.equal(links[0]!.getAttribute("href"), "https://app.example.test/try?a=1&b=2");
  for (const link of links.slice(2)) assert.equal(link.target, "");
  assert.equal(externalLinks(html, "https://site.example.test/"), html);
});

test("moved guides have one canonical route and retain their historical analytics grouping", () => {
  const routes = routesFor(configSchema.parse({}));
  for (const [previous, destination] of Object.entries(redirects)) {
    assert.ok(!routes.includes(previous));
    assert.ok(routes.includes(destination));
    assert.equal(marketingScreen(analyticsPath(destination)), marketingScreen(previous));
    assert.equal(analyticsPath(destination.slice(0, -1)), previous);
  }
  assert.equal(analyticsPath("/workbooks/grade-3/"), "/workbooks/grade-3/");
});

test("production redirects remain discoverable without executing JavaScript", () => {
  const config = { ...configSchema.parse({ siteUrl: "https://corpora.inc/" }), mode: "production" as const };
  const doc = new JSDOM(renderToStaticMarkup(React.createElement(RedirectPage, { destination: "/amp/how-it-works/", config }))).window.document;
  assert.equal(doc.querySelector('meta[name="robots"]'), null);
  assert.equal(doc.querySelector('head > meta[http-equiv="refresh"]').content, "0;url=/amp/how-it-works/");
  assert.equal(doc.querySelector('link[rel="canonical"]').href, "https://corpora.inc/amp/how-it-works/");
  const preview = new JSDOM(renderToStaticMarkup(React.createElement(RedirectPage, { destination: "/amp/how-it-works/", config: configSchema.parse({}) }))).window.document;
  assert.equal(preview.querySelector('meta[name="robots"]').content, "noindex, nofollow");
});
