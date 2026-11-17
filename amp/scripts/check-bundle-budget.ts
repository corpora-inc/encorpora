/**
 * The first screens' code budget, checked at the end of `npm run build`.
 * Every visitor's phone downloads and runs an entry's code and stylesheets
 * before any screen: the app's (index.html, every route but `/`) or the
 * pitch's light entry (home.html, `/`). A signed-out visitor from an ad gets
 * the pitch, so its document must not spend bandwidth on anything the pitch
 * doesn't show. An entry's code is its script and every chunk the document
 * preloads for it.
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
  /** The app's entry code, which every screen but the pitch runs first
   * (2026-11-15: 288 KB, as three chunks: the app, what it shares with the
   * pitch's entry, and its start). 2026-11-17: main 289.2 KB; sign-up's
   * arrival (why a tab signs up, read on every arrival before any screen,
   * the one-hop clean-up of older sign-up addresses, and the analytics
   * title that reads it) adds 1.1 KB that must run first: 290.3 KB. */
  entryJs: 291 * KB,
  /** The pitch's light entry: React, the pitch and its measurement, no app
   * (2026-11-15: 152 KB). */
  pitchJs: 160 * KB,
  /** The global stylesheets, render-blocking everywhere (57 KB). */
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
/** A document's entry script and the modules it preloads. */
const code = (html: string) =>
  [
    ...html.matchAll(
      /<(?:script type="module"[^>]*src|link rel="modulepreload"[^>]*href)="\/(assets\/[^"]+\.js)"/g,
    ),
  ].map((match) => match[1]!);
const sheets = (html: string) =>
  [
    ...html.matchAll(
      /<link rel="stylesheet"[^>]*href="\/(assets\/[^"]+\.css)"/g,
    ),
  ].map((match) => match[1]!);
const entry = code(shell);
const css = sheets(shell);
const pitch = code(home);
if (!entry.length || !css.length || !pitch.length)
  throw new Error("check-bundle-budget: no entry in index.html or home.html");
const total = (files: string[]) =>
  files.reduce((sum, file) => sum + gz(file), 0);
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
const shared = new Set<string>();
for (const file of entry) closure(file, shared);
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
check("entry JS", total(entry), budget.entryJs);
check("pitch JS", total(pitch), budget.pitchJs);
check("entry CSS", total(css), budget.entryCss);
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
// The signed-out pitch carries no app code it doesn't show: not the app's
// auth layer, nor the auth clients it wraps, nor the router (the pitch moves
// through features/pitch/nav.tsx). Each is recognized by a string only it
// contains; the app's entry, which does carry them, proves the strings
// still identify them in a build.
const authCode: [string, string][] = [
  ["src/web/auth.ts", "School sign out did not finish"],
  ["better-auth", "better-auth:focus-manager"],
  ["oidc-client-ts", '"oidc."'],
  ["@simplewebauthn/browser", "WebAuthn is not supported in this browser"],
  ["@tanstack/react-router", "__TSR_index"],
];
const pitchClosure = new Set<string>();
for (const file of pitch) closure(file, pitchClosure);
const appClosure = new Set<string>();
for (const file of entry) closure(file, appClosure);
const contains = (files: Set<string>, text: string) =>
  [...files].some((file) => read(file).toString().includes(text));
for (const [module, text] of authCode) {
  if (contains(pitchClosure, text))
    failures.push(`the pitch's code includes ${module}, which it never shows`);
}
// One of them must still be found where it belongs, or the check proves
// nothing (a string renamed away in a build).
if (!authCode.some(([, text]) => contains(appClosure, text)))
  failures.push("check-bundle-budget: no app code found in the app entry");
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
