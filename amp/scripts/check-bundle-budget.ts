/**
 * The first screens' code budget, checked at the end of `npm run build`.
 * Every visitor's phone downloads and runs the entry bundle and stylesheet
 * before any screen; a signed-out visitor from an ad gets the pitch, so
 * its document must not spend bandwidth on anything the pitch doesn't show.
 * Sizes are gzip, as served (docker/nginx.conf, level 6). Measured screens:
 * scripts/measure-first-screens.ts.
 *
 *     npx tsx scripts/check-bundle-budget.ts [dist-dir]
 *
 * Raise a limit only with a measurement that shows why; lower it when a
 * change makes room.
 */
import { readdirSync, readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

const KB = 1024;
const budget = {
  /** The entry bundle every screen runs first (2026-11-15: 279 KB). */
  entryJs: 290 * KB,
  /** The global stylesheet, render-blocking everywhere (55 KB). */
  entryCss: 60 * KB,
  /** Pathways' own code; the 3D map (three.js) loads only when chosen. */
  pathwaysJs: 15 * KB,
  /** Practice's code beyond the entry: the app screen and the practice
   * workspace with everything they import (2026-11-15: 525 KB; 696 KB
   * while the coin and bill pictures were inside it). */
  practiceJs: 540 * KB,
};

const dist = process.argv[2]
  ? new URL(`file://${process.argv[2].replace(/\/?$/, "/")}`)
  : new URL("../dist/", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, dist));
const gz = (path: string) => gzipSync(read(path), { level: 6 }).length;
const home = read("home.html").toString();
const shell = read("index.html").toString();
const entry = shell.match(
  /<script type="module"[^>]*src="\/(assets\/[^"]+\.js)"/,
)?.[1];
const css = shell.match(
  /<link rel="stylesheet"[^>]*href="\/(assets\/[^"]+\.css)"/,
)?.[1];
if (!entry || !css)
  throw new Error("check-bundle-budget: no entry in index.html");
const assets = readdirSync(new URL("assets/", dist));
const pathways = assets.find((name) => /^PathwaysScreen-.*\.js$/.test(name));
if (!pathways) throw new Error("check-bundle-budget: no PathwaysScreen chunk");

/** A chunk and every chunk it imports statically, as built. */
const closure = (file: string, seen = new Set<string>()) => {
  if (seen.has(file)) return seen;
  seen.add(file);
  for (const [, next] of read(file)
    .toString()
    .matchAll(/(?:from|import)\s*"\.\/([^"]+\.js)"/g))
    closure(`assets/${next}`, seen);
  return seen;
};
const chunk = (pattern: RegExp) => {
  const name = assets.find((file) => pattern.test(file));
  if (!name) throw new Error(`check-bundle-budget: no chunk ${pattern}`);
  return `assets/${name}`;
};
const shared = closure(entry);
const practice = [
  ...new Set([
    ...closure(chunk(/^LegacyApp-.*\.js$/)),
    ...closure(chunk(/^PracticeWorkspace-.*\.js$/)),
  ]),
].filter((file) => !shared.has(file));

const failures: string[] = [];
const check = (name: string, size: number, limit: number) => {
  console.log(
    `${name}: ${(size / KB).toFixed(1)} KB gzip (budget ${limit / KB} KB)`,
  );
  if (size > limit) failures.push(`${name} is over its budget`);
};
check("entry JS", gz(entry), budget.entryJs);
check("entry CSS", gz(css), budget.entryCss);
check("Pathways JS", gz(`assets/${pathways}`), budget.pathwaysJs);
check(
  "practice JS",
  practice.reduce((sum, file) => sum + gz(file), 0),
  budget.practiceJs,
);
// Coins and bills are files the browser caches (src/web/scene/money-art.ts),
// never pictures inside the code every deploy re-sends.
for (const file of assets.filter((name) => name.endsWith(".js")))
  if (
    /data:image\/(?:webp|svg\+xml);base64,/.test(
      read(`assets/${file}`).toString(),
    )
  )
    failures.push(`${file} embeds a picture as a data URL`);
// The pitch shows no math and needs no math fonts.
if (/as="font"/.test(home))
  failures.push("the pitch document preloads fonts it doesn't show");
// The pitch asks for its two boot answers with the document.
for (const api of ["/api/v1/auth-config", "/api/auth/get-session"])
  if (!home.includes(`href="${api}"`))
    failures.push(`the pitch document doesn't preload ${api}`);
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("Bundle budget met.");
