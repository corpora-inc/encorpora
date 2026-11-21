import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { publicDocumentPaths } from "../src/web/app/document-index.js";
import { applyRouteHead, routeHead } from "../src/web/app/route-head.js";
import {
  renderShareCards,
  shareCardRecord,
  shareCardsJson,
} from "../scripts/lib/public-share-cards.js";

const { JSDOM } = createRequire(import.meta.url)("jsdom") as {
  JSDOM: new (html: string) => { window: { document: Document } };
};
const indexHtml = readFileSync(
  new URL("../index.html", import.meta.url),
  "utf8",
);
const content = (doc: Document, selector: string) =>
  doc.head.querySelector<HTMLMetaElement>(`meta[${selector}]`)?.content;
/** The six tags a link preview reads for a card, as the document has them. */
const cardTags = (doc: Document) => ({
  image: content(doc, 'property="og:image"'),
  twitterImage: content(doc, 'name="twitter:image"'),
  width: content(doc, 'property="og:image:width"'),
  height: content(doc, 'property="og:image:height"'),
  alt: content(doc, 'property="og:image:alt"'),
  twitterAlt: content(doc, 'name="twitter:image:alt"'),
});
const pages = publicDocumentPaths.filter((path) => path !== "/");

test("every public page but / has its own share card, and / keeps the product card", () => {
  const recorded = JSON.parse(readFileSync(shareCardsJson, "utf8")) as Record<
    string,
    unknown
  >;
  // A new public page without a card fails here. `/` is the product card,
  // which the build adds to index.html (scripts/build-public-pathways.ts).
  assert.deepEqual(Object.keys(recorded).sort(), [...pages].sort());
  assert.match(
    indexHtml,
    /<!--amp-product-social-start-->[\s\S]*<!--amp-product-social-end-->/,
  );
  assert.equal(routeHead("/", "pitch")?.image, undefined);
  const images = new Set<string>();
  for (const path of pages) {
    const head = routeHead(path, "pitch");
    assert.match(
      head?.image ?? "",
      /^https:\/\/amp\.corpora\.inc\/assets\/share-cards\/[a-z-]+-[0-9a-f]{12}\.png$/,
      path,
    );
    assert.ok((head?.imageAlt ?? "").length > 20, `${path} has alt text`);
    images.add(head!.image!);
    // The prerendered document (scripts/build-public-documents.ts) writes
    // the head into the app's shell the same way the app does.
    const doc = new JSDOM(indexHtml).window.document;
    applyRouteHead(doc, head!);
    assert.deepEqual(
      cardTags(doc),
      {
        image: head!.image,
        twitterImage: head!.image,
        width: "1200",
        height: "630",
        alt: head!.imageAlt,
        twitterAlt: head!.imageAlt,
      },
      path,
    );
    // One of each tag, never a second beside the shell's.
    for (const selector of [
      'property="og:image"',
      'property="og:image:alt"',
      'name="twitter:image"',
    ])
      assert.equal(
        doc.head.querySelectorAll(`meta[${selector}]`).length,
        1,
        `${path} ${selector}`,
      );
  }
  assert.equal(images.size, pages.length, "each page has a card of its own");
  // A trailing slash is the same page.
  assert.equal(
    routeHead("/research/", "pitch")?.image,
    routeHead("/research", "pitch")?.image,
  );
});

test("src/web/app/share-cards.json records the cards the build makes", () => {
  assert.equal(
    readFileSync(shareCardsJson, "utf8"),
    shareCardRecord(renderShareCards()),
    "src/web/app/share-cards.json is out of date: run `npm run build:share-cards` in amp/ and commit it.",
  );
});

test("a page's card survives the app's head updates and never outlives its page", () => {
  const doc = new JSDOM(indexHtml).window.document;
  // Served at /research: the prerendered head, then the app's own on boot.
  applyRouteHead(doc, routeHead("/research", "pitch")!);
  applyRouteHead(doc, routeHead("/research", "pitch")!);
  assert.equal(cardTags(doc).image, routeHead("/research", "pitch")!.image);
  // To another public page: its card replaces this one, alt text and all.
  applyRouteHead(doc, routeHead("/research/pilot", "pitch")!);
  assert.equal(
    cardTags(doc).image,
    routeHead("/research/pilot", "pitch")!.image,
  );
  assert.equal(
    cardTags(doc).twitterAlt,
    routeHead("/research/pilot", "pitch")!.imageAlt,
  );
  // To a page without a card: none, never the last page's.
  applyRouteHead(doc, routeHead("/practice", "pitch")!);
  assert.deepEqual(Object.values(cardTags(doc)), Array(6).fill(undefined));
  applyRouteHead(doc, routeHead("/schools", "pitch")!);
  assert.equal(cardTags(doc).image, routeHead("/schools", "pitch")!.image);
  assert.equal(cardTags(doc).width, "1200");
});
