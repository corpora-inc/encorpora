import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { configSchema } from "../src/config.js";
import { writeDiscovery } from "../src/discovery.js";
import { Page, routesFor } from "../src/pages.js";
import { resources, videos, videoPath } from "../src/resources/catalog.js";
import { workbookManifestSchema } from "../src/resources/workbook-manifest.js";
import bundled from "../src/resources/workbooks.json";
import React, { renderToStaticMarkup } from "../src/react.js";
const { JSDOM } = createRequire(import.meta.url)("../../amp/node_modules/jsdom");

test("discovery describes real canonical pages and playable video assets", async () => {
  const config = { ...configSchema.parse({ siteUrl: "https://corpora.inc", discovery: { indexNowKey: "test-public-key-123456" } }), mode: "production" as const };
  const routes = routesFor(config);
  const output = await mkdtemp(join(tmpdir(), "amp-discovery-test-"));
  try {
    for (const route of routes) { await mkdir(`${output}${route}`, { recursive: true }); await writeFile(`${output}${route}index.html`, `<h1>${route}</h1>`); }
    await writeDiscovery(output, config, routes);
    const map = new JSDOM(await readFile(`${output}/video-sitemap.xml`, "utf8"), { contentType: "application/xml" }).window.document;
    assert.equal(map.querySelectorAll("parsererror").length, 0);
    assert.equal(map.querySelectorAll("url").length, videos.length);
    for (const video of videos) assert.ok(map.documentElement.textContent.includes(`https://corpora.inc${videoPath(video)}`) && map.documentElement.textContent.includes(video.videoUrl));
    const catalog = JSON.parse(await readFile(`${output}/resource-catalog.json`, "utf8"));
    assert.equal(catalog.resources.length, resources.length);
    for (const resource of catalog.resources) assert.ok(routes.includes(new URL(resource.url).pathname));
    assert.equal(catalog.resources.filter((r: any) => r.video).length, 13);
    const index = JSON.parse(await readFile(`${output}/search-index.json`, "utf8"));
    assert.equal(index.documents.length, routes.length);
    assert.equal(new Set(index.documents.map((d: any) => d.url)).size, routes.length);
    assert.equal(await readFile(`${output}/test-public-key-123456.txt`, "utf8"), "test-public-key-123456");
    const guide = await readFile(`${output}/llms.txt`, "utf8");
    for (const [,url] of guide.matchAll(/\]\((https:\/\/corpora\.inc[^)]+)\)/g)) {
      const path = new URL(url!).pathname;
      assert.ok(routes.includes(path) || ["/resource-catalog.json", "/workbook-editions.json", "/sitemap.xml", "/video-sitemap.xml"].includes(path), path);
    }
  } finally { await rm(output, { recursive: true, force: true }); }
});

test("incomplete, corrupt and mismatched-date workbook editions cannot publish", () => {
  assert.ok(workbookManifestSchema.safeParse(bundled).success);
  const mutate = (fn: (manifest: typeof bundled) => void) => { const copy = structuredClone(bundled); fn(copy); assert.equal(workbookManifestSchema.safeParse(copy).success, false); };
  mutate(m => { m.editions.pop(); });
  mutate(m => { m.editions[1]!.grade = "K"; });
  mutate(m => { m.editions[0]!.files[0]!.sha256 = "not-a-hash"; });
  mutate(m => { m.editions[0]!.files[0]!.pages++; });
  mutate(m => { m.editions[0]!.date = "2026-11-14"; });
  mutate(m => { m.editions[0]!.files[0]!.url = "https://example.invalid/invoice.pdf"; });
});

test("missing pages offer working resource links and stay out of search", () => {
  const config = { ...configSchema.parse({ siteUrl: "https://corpora.inc" }), mode: "production" as const };
  const html = renderToStaticMarkup(React.createElement(Page, { route: "/404/", config }));
  const doc = new JSDOM(html).window.document;
  assert.match(doc.title, /Page not found/);
  assert.equal(doc.querySelector('meta[name="robots"]').content, "noindex, follow");
  assert.equal(doc.querySelector('link[rel="canonical"]'), null);
  assert.equal(doc.querySelectorAll("h1").length, 1);
  assert.ok(!routesFor(config).includes("/404/"));
  for (const a of doc.querySelectorAll('main a[href^="/"]')) assert.ok(routesFor(config).includes(a.getAttribute("href")));
});
