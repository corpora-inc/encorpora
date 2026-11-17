/** Generate direct-response metadata and the static server's known-route map. */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { documentRoutesNginxMap } from "./lib/nginx-map";
import { createRequire } from "node:module";
import { routeHead, applyRouteHead } from "../src/web/app/route-head.js";
import { documentRoutePatterns, publicDocumentPaths } from "../src/web/app/document-routes.js";
const { JSDOM } = createRequire(import.meta.url)("jsdom") as { JSDOM: new (html: string) => { window: { document: Document }; serialize(): string } };
const dist = new URL("../dist/", import.meta.url);
const shell = await readFile(new URL("index.html", dist), "utf8");
for (const path of publicDocumentPaths.filter(path => path !== "/")) {
  const dom = new JSDOM(shell);
  const head = routeHead(path, "pitch");
  if (!head?.canonical) throw new Error(`Missing public document metadata: ${path}`);
  applyRouteHead(dom.window.document, head);
  const directory = new URL(`${path.slice(1)}/`, dist);
  await mkdir(directory, { recursive: true });
  await writeFile(new URL("index.html", directory), dom.serialize());
}
const missing = new JSDOM(shell);
const doc = missing.window.document;
applyRouteHead(doc, { title: "Page not found | AMP", description: "Find AMP mathematics, free lessons and printable workbooks.", canonical: null, robots: "noindex, follow" });
// A missing URL has a useful document without booting the learning application.
doc.querySelectorAll('script,link[rel="modulepreload"],meta[property="og:image"],meta[name="twitter:image"]').forEach(node => node.remove());
doc.body.innerHTML = '<main class="amp-missing"><p>AMP Mathematics</p><h1>Page not found</h1><p>This address does not lead to a page. Choose a place to continue.</p><nav aria-label="Find a page"><a href="/">Open AMP</a><a href="/pathways">Explore math skills</a><a href="https://corpora.inc/resources/">Free lessons and workbooks</a><a href="https://corpora.inc/support/">Get help</a></nav></main>';
const style = doc.createElement("link"); style.rel = "stylesheet"; style.href = "/not-found.css"; doc.head.append(style);
await writeFile(new URL("404.html", dist), missing.serialize());
const tokens = await readFile(new URL("../src/web/ui/tokens.css", import.meta.url), "utf8");
await writeFile(new URL("not-found.css", dist), tokens + '\nbody{margin:0;background:var(--color-surface);color:var(--color-on-surface);font-family:system-ui,sans-serif}.amp-missing{box-sizing:border-box;width:min(100%,var(--width-form));margin:var(--space-7) auto;padding:var(--space-5)}.amp-missing h1{font-family:var(--font-display);font-size:var(--text-heading-1);line-height:1.2}.amp-missing p{line-height:1.6}.amp-missing nav{display:grid;gap:var(--space-3);margin-top:var(--space-5)}.amp-missing a{display:flex;align-items:center;min-height:var(--target-size);color:var(--color-on-surface);text-underline-offset:.2em}.amp-missing a:focus-visible{outline:3px solid var(--color-focus-ring);outline-offset:var(--space-1)}\n');
const artifacts = new URL("../artifacts/", import.meta.url);
await mkdir(artifacts, { recursive: true });
await writeFile(new URL("document-routes-nginx-map.conf", artifacts), documentRoutesNginxMap(documentRoutePatterns));
console.log("Built public school metadata, a 404 document and the browser-route map.");
