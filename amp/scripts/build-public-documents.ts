/** Generate direct-response metadata and the static server's known-route map. */
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { documentRoutesNginxMap } from "./lib/nginx-map";
import { brandTitle } from "../src/brand.js";
import { createRequire } from "node:module";
import { routeHead, applyRouteHead, publicOrigin, type RouteHead } from "../src/web/app/route-head.js";
import { documentRoutePatterns, publicDocumentPaths } from "../src/web/app/document-routes.js";
import { researchJsonLd, researchStaticHtml, researchStaticStyles } from "../src/research/static-document.js";
import { versusPath } from "../src/versus/catalog.js";
import { readVersus } from "../src/versus/files.js";
import { versusHubHead, versusHubJsonLd, versusPageHead, versusPageJsonLd } from "../src/versus/head.js";
import { versusHubStaticHtml, versusPageStaticHtml, versusStaticClass, versusStaticStyles } from "../src/versus/static-document.js";
const { JSDOM } = createRequire(import.meta.url)("jsdom") as { JSDOM: new (html: string) => { window: { document: Document }; serialize(): string } };
const dist = new URL("../dist/", import.meta.url);
const shell = await readFile(new URL("index.html", dist), "utf8");
/** A page's words and structured data, in the document itself, for crawlers
 * that don't run the app. The words sit after `#root`, hidden: a browser
 * paints the loading wave and then the page, never a third layout, and
 * `#root` keeps the wave as its only child for the entry guard. Without
 * JavaScript, the noscript style shows them. */
type StaticWords = {
  /** One element, carrying `className`. */
  html: string;
  className: string;
  styles: string;
  data: readonly object[];
  /** Marks the structured data, for a screen that replaces its own. */
  dataAttribute?: string;
};
async function writeDocument(path: string, head: RouteHead, words?: StaticWords) {
  const dom = new JSDOM(shell);
  const doc = dom.window.document;
  applyRouteHead(doc, head);
  if (words) {
    const root = doc.getElementById("root");
    if (!root) throw new Error("The app shell has no #root");
    const holder = doc.createElement("div");
    holder.innerHTML = words.html;
    const article = holder.firstElementChild;
    if (!article || holder.childElementCount !== 1 || !article.classList.contains(words.className))
      throw new Error(`The static words of ${path} are not one .${words.className} element`);
    article.setAttribute("hidden", "");
    root.after(article);
    const style = doc.createElement("style");
    style.textContent = words.styles;
    doc.head.append(style);
    for (const entry of words.data) {
      const data = doc.createElement("script");
      data.type = "application/ld+json";
      if (words.dataAttribute) data.setAttribute(words.dataAttribute, "");
      data.textContent = JSON.stringify(entry).replace(/</g, "\\u003c");
      doc.head.append(data);
    }
  }
  const directory = new URL(`${path.slice(1)}/`, dist);
  await mkdir(directory, { recursive: true });
  // A parser with scripting on reads <noscript> as text, so it goes in last.
  const html = words
    ? dom.serialize().replace("</head>", `<noscript><style>.${words.className}[hidden]{display:block}</style></noscript></head>`)
    : dom.serialize();
  await writeFile(new URL("index.html", directory), html);
}
// The comparisons (`/versus`): read from disk and checked, so a build never
// publishes content the validator rejects (npm run versus:check).
const versus = readVersus();
const versusWords = (html: string, data: readonly object[]): StaticWords => ({
  html,
  className: versusStaticClass,
  styles: versusStaticStyles,
  data,
  dataAttribute: "data-versus-data",
});
const staticWords: Readonly<Record<string, StaticWords>> = {
  "/research": {
    html: researchStaticHtml(),
    className: "research-static",
    styles: researchStaticStyles,
    data: [researchJsonLd()],
  },
};
for (const path of publicDocumentPaths.filter(path => path !== "/")) {
  const head = routeHead(path, "pitch");
  if (!head?.canonical) throw new Error(`Missing public document metadata: ${path}`);
  await writeDocument(path, head, staticWords[path]);
}
// The comparisons' hub, then one document per comparison, each with its own
// head, words and data.
await writeDocument("/versus", versusHubHead, versusWords(versusHubStaticHtml(versus.catalog), versusHubJsonLd()));
for (const page of versus.pages)
  await writeDocument(
    versusPath(page.slug),
    versusPageHead(page),
    versusWords(versusPageStaticHtml(page, versus.catalog), versusPageJsonLd(page)),
  );
const missing = new JSDOM(shell);
const doc = missing.window.document;
// The page names AMP by its brand title (src/brand.ts), never a second name.
// A missing page has no share card.
applyRouteHead(doc, { title: `Page not found | ${brandTitle}`, description: "Find AMP mathematics, free lessons and printable workbooks.", canonical: null, robots: "noindex, follow", image: null });
// A missing URL has a useful document without booting the learning application.
doc.querySelectorAll('script,link[rel="modulepreload"]').forEach(node => node.remove());
doc.body.innerHTML = `<main class="amp-missing"><p>${brandTitle}</p><h1>Page not found</h1><p>This address does not lead to a page. Choose a place to continue.</p><nav aria-label="Find a page"><a href="/">Open AMP</a><a href="/pathways">Explore math skills</a><a href="https://corpora.inc/resources/">Free lessons and workbooks</a><a href="https://corpora.inc/support/">Get help</a></nav></main>`;
const style = doc.createElement("link"); style.rel = "stylesheet"; style.href = "/not-found.css"; doc.head.append(style);
await writeFile(new URL("404.html", dist), missing.serialize());
const tokens = await readFile(new URL("../src/web/ui/tokens.css", import.meta.url), "utf8");
await writeFile(new URL("not-found.css", dist), tokens + '\nbody{margin:0;background:var(--color-surface);color:var(--color-on-surface);font-family:system-ui,sans-serif}.amp-missing{box-sizing:border-box;width:min(100%,var(--width-form));margin:var(--space-7) auto;padding:var(--space-5)}.amp-missing h1{font-family:var(--font-display);font-size:var(--text-heading-1);line-height:1.2}.amp-missing p{line-height:1.6}.amp-missing nav{display:grid;gap:var(--space-3);margin-top:var(--space-5)}.amp-missing a{display:flex;align-items:center;min-height:var(--target-size);color:var(--color-on-surface);text-underline-offset:.2em}.amp-missing a:focus-visible{outline:3px solid var(--color-focus-ring);outline-offset:var(--space-1)}\n');
// Every public page names its own share card, at full size, with its alt
// text, and the card is in the build (`/` is the home document and the
// app's shell; scripts/build-share-cards.ts writes the others' cards).
for (const path of publicDocumentPaths)
  for (const file of path === "/" ? ["index.html", "home.html"] : [`${path.slice(1)}/index.html`]) {
    const page = new JSDOM(await readFile(new URL(file, dist), "utf8")).window.document;
    const tag = (selector: string) => page.head.querySelector<HTMLMetaElement>(`meta[${selector}]`)?.content ?? "";
    const image = tag('property="og:image"');
    const problem =
      !image.startsWith(`${publicOrigin}/assets/`) ? "no og:image"
      : tag('name="twitter:image"') !== image ? "a twitter:image that isn't its og:image"
      : tag('property="og:image:width"') !== "1200" || tag('property="og:image:height"') !== "630" ? "no 1200×630 size"
      : !tag('property="og:image:alt"') || !tag('name="twitter:image:alt"') ? "no alt text for its card"
      : !(await stat(new URL(image.slice(publicOrigin.length + 1), dist)).catch(() => null))?.isFile() ? `a card the build lacks (${image})`
      : image !== (routeHead(path, "pitch")?.image ?? image) || (path === "/" && !image.includes("/pathway-cards/product-")) ? `another page's card (${image})`
      : null;
    if (problem) throw new Error(`The public document ${path} (${file}) has ${problem}`);
  }
const artifacts = new URL("../artifacts/", import.meta.url);
await mkdir(artifacts, { recursive: true });
await writeFile(new URL("document-routes-nginx-map.conf", artifacts), documentRoutesNginxMap(documentRoutePatterns));
console.log(`Built public school, research and comparison documents (${versus.pages.length} comparisons), a 404 document and the browser-route map.`);
