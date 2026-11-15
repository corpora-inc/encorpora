import assert from "node:assert/strict";
import test from "node:test";
import { existsSync } from "node:fs";
import React, { renderToStaticMarkup } from "../src/react.js";
import { articles, articleByPath } from "../src/library/catalog.js";
import { Page, routesFor } from "../src/pages.js";
import { configSchema } from "../src/config.js";

test("the editorial library exposes readable, connected pages without JavaScript", () => {
  const config = configSchema.parse({});
  const routes = new Set(routesFor(config));
  assert.equal(articleByPath.size, articles.length);
  for (const article of articles) {
    assert.ok(routes.has(article.path));
    const html = renderToStaticMarkup(React.createElement(Page, {route: article.path, config}));
    assert.equal((html.match(/<h1[ >]/g) ?? []).length, 1, article.path);
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
    assert.equal(ids.length, new Set(ids).size, `Duplicate anchors: ${article.path}`);
    for (const match of html.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.includes(match[1]), `Missing anchor ${match[1]} in ${article.path}`);
    for (const path of article.related) assert.ok(routes.has(path), `Missing related page ${path}`);
    for (const section of article.sections) {
      if (section.shot) for (const size of ["desktop", "mobile"]) assert.ok(existsSync(`public/product/${section.shot}-${size}.webp`));
      for (const source of section.sources ?? []) assert.equal(new URL(source.url).protocol, "https:");
    }
    assert.ok(!html.includes("undefined"), article.path);
  }
});
