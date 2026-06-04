#!/usr/bin/env node
// scripts/check-i18n.mjs
//
// Localization completeness gate. Runs in `npm run build` (before tsc/vite) so
// a missing or untranslated string can never ship silently.
//
// `public/locales/en/common.json` is the single source of truth: it is also
// the file `src/i18next.d.ts` imports to derive the compile-time `t()` key
// type. This check enforces the two invariants that the TS type alone cannot:
//
//   1. CODE ⊆ TYPE — every statically-written `t("key")` in src/ exists in
//      en/common.json. Without this, a `t("x", { defaultValue: "English" })`
//      whose key is absent from the JSON silently renders English in EVERY
//      language (the bug that motivated this check: onboarding.engage.*).
//
//   2. EVERY LOCALE ≡ TYPE — each public/locales/<lng>/common.json implements
//      exactly the en key set: no missing keys (would fall back to English),
//      no stale extra keys (dead translations / renamed keys left behind).
//
// Dynamic keys (`t(`socials.${key}.title`)`) cannot be verified statically and
// are skipped — keep their parents covered by the locale-equality check.
//
// Exit code 0 = clean, 1 = problems found (fails the build).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "src");
const LOCALES = path.join(ROOT, "public", "locales");
const NS = "common.json";
const REF = "en";

/** Flatten a nested translation object to dotted leaf keys. */
function flatKeys(obj, prefix = "", out = new Set()) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix + k;
    if (v && typeof v === "object" && !Array.isArray(v)) flatKeys(v, key + ".", out);
    else out.add(key);
  }
  return out;
}

function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function walk(dir, exts, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, exts, out);
    else if (exts.some((x) => e.name.endsWith(x))) out.push(p);
  }
  return out;
}

/**
 * Extract literal first-argument keys from t(...) calls.
 * Matches t("k"), t('k'), t(`k`), and member forms like i18n.t("k").
 * Template literals containing ${...} are returned separately as "dynamic".
 */
function extractKeys(source) {
  const re = /\bt\(\s*(["'`])((?:[^"'`\\]|\\.)*?)\1/g;
  const stat = new Set();
  const dyn = new Set();
  let m;
  while ((m = re.exec(source))) {
    const [quote, val] = [m[1], m[2]];
    if (quote === "`" && val.includes("${")) dyn.add(val);
    else stat.add(val);
  }
  return { stat, dyn };
}

const problems = [];

// ---- Load the reference (en) key set ----------------------------------------
const refPath = path.join(LOCALES, REF, NS);
if (!fs.existsSync(refPath)) {
  console.error(`✗ reference locale missing: ${path.relative(ROOT, refPath)}`);
  process.exit(1);
}
const refKeys = flatKeys(readJSON(refPath));

// ---- Invariant 1: every static t() key exists in en -------------------------
const codeKeys = new Set();
const dynamicPatterns = new Set();
for (const file of walk(SRC, [".ts", ".tsx"])) {
  const { stat, dyn } = extractKeys(fs.readFileSync(file, "utf8"));
  for (const k of stat) codeKeys.add(k);
  for (const d of dyn) dynamicPatterns.add(d);
}
const orphanKeys = [...codeKeys].filter((k) => !refKeys.has(k)).sort();
if (orphanKeys.length) {
  problems.push(
    `${orphanKeys.length} t() key(s) used in src/ but absent from ${REF}/${NS} ` +
      `(these render their English defaultValue in every language):\n` +
      orphanKeys.map((k) => `    • ${k}`).join("\n"),
  );
}

// ---- Invariant 2: every locale implements exactly the en key set ------------
const locales = fs
  .readdirSync(LOCALES, { withFileTypes: true })
  .filter((e) => e.isDirectory() && fs.existsSync(path.join(LOCALES, e.name, NS)))
  .map((e) => e.name)
  .sort();

for (const lng of locales) {
  if (lng === REF) continue;
  const keys = flatKeys(readJSON(path.join(LOCALES, lng, NS)));
  const missing = [...refKeys].filter((k) => !keys.has(k)).sort();
  const extra = [...keys].filter((k) => !refKeys.has(k)).sort();
  if (missing.length) {
    problems.push(
      `${lng}: missing ${missing.length} key(s) (fall back to English):\n` +
        missing.map((k) => `    • ${k}`).join("\n"),
    );
  }
  if (extra.length) {
    problems.push(
      `${lng}: ${extra.length} stale key(s) not in ${REF}/${NS} (remove or add to en):\n` +
        extra.map((k) => `    • ${k}`).join("\n"),
    );
  }
}

// ---- Report -----------------------------------------------------------------
if (problems.length) {
  console.error("✗ i18n check failed:\n");
  for (const p of problems) console.error("  " + p + "\n");
  console.error(
    `Reference: ${REF}/${NS} (${refKeys.size} keys) · ${locales.length} locales · ` +
      `${codeKeys.size} static t() keys${dynamicPatterns.size ? ` · ${dynamicPatterns.size} dynamic patterns skipped` : ""}`,
  );
  process.exit(1);
}

console.log(
  `✓ i18n check passed: ${refKeys.size} keys × ${locales.length} locales in sync; ` +
    `all ${codeKeys.size} static t() keys defined` +
    (dynamicPatterns.size ? ` (${dynamicPatterns.size} dynamic patterns skipped)` : "") +
    ".",
);
