import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { knownDocumentPath, indexableDocumentPath } from "../src/web/app/document-routes.js";
import { applyPathwaysMetadata } from "../src/web/features/pathways/pathways-metadata.js";
import { applyRouteHead, routeHead } from "../src/web/app/route-head.js";
const { JSDOM } = createRequire(import.meta.url)("jsdom") as { JSDOM: new(html:string) => { window: { document: Document } } };

test("known deep links survive while missing route shapes do not become app documents", () => {
  for (const path of ["/", "/practice", "/overview", "/progress", "/books", "/books/number-builders", "/lessons/count-objects", "/account/billing/purchases", "/family/privacy/export", "/start/parent/name", "/school/org/classes/class/today", "/family/family/kids/child/pathways", "/sign-in/forgot", "/try/retired-path"]) assert.ok(knownDocumentPath(path), path);
  for (const path of ["/does-not-exist", "/schools/missing", "/school/org/unknown", "/family/family/unknown", "/purchase/missing", "/sign-in/missing", "/dev/personas", "/plans"]) assert.equal(knownDocumentPath(path), false, path);
  assert.equal(indexableDocumentPath("/sign-up"), false);
  assert.equal(indexableDocumentPath("/family/family/kids/child/pathways"), false);
  assert.equal(indexableDocumentPath("/pathways/count-to-20"), true);
});

test("public and private maps have one metadata owner across route transitions", () => {
  const doc = new JSDOM('<html><head><title>Map</title><meta name="description" content="Map"><link rel="canonical" href="https://amp.corpora.inc/pathways/count-to-20" data-pathways-static><meta property="og:image" content="https://amp.corpora.inc/assets/test-skill.png" data-pathways-static></head><body></body></html>').window.document;
  const skill = { id: "count-to-20", title: "Count to 20", description: "Count a group of objects." };
  const canonical = () => doc.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href;
  const robots = () => doc.querySelector<HTMLMetaElement>('meta[name="robots"]')?.content;
  applyPathwaysMetadata(doc, "/pathways/count-to-20", skill);
  assert.equal(robots(), undefined);
  assert.equal(canonical(), "https://amp.corpora.inc/pathways/count-to-20");
  assert.equal(doc.querySelector<HTMLMetaElement>('meta[property="og:image"]')?.content, "https://amp.corpora.inc/assets/test-skill.png");
  applyRouteHead(doc, routeHead("/sign-in", "pitch")!);
  assert.equal(robots(), "noindex, follow");
  assert.equal(canonical(), undefined);
  assert.equal(doc.querySelector('meta[property="og:image"]'), null);
  applyPathwaysMetadata(doc, "/family/private-family/kids/private-child/pathways", skill);
  assert.equal(robots(), "noindex, follow");
  assert.equal(canonical(), undefined);
  assert.ok(!doc.head.innerHTML.includes("private-family"));
  applyPathwaysMetadata(doc, "/pathways/count-to-20", skill);
  assert.equal(robots(), undefined);
  assert.equal(canonical(), "https://amp.corpora.inc/pathways/count-to-20");
  applyPathwaysMetadata(doc, "/pathways/missing", undefined, true);
  assert.equal(robots(), "noindex, follow");
  assert.equal(canonical(), undefined);
  applyPathwaysMetadata(doc, "/pathways", undefined);
  assert.equal(robots(), undefined);
  assert.equal(canonical(), "https://amp.corpora.inc/pathways");
  for (const selector of ['meta[name="description"]', 'link[rel="canonical"]', 'meta[property="og:title"]']) assert.equal(doc.querySelectorAll(selector).length, 1, selector);
});
