/**
 * score unit test — Drift's arcade scoring (score.ts). Pure, headless.
 *
 * Proves:
 *   (a) catchPoints: 100 floor + up to 50 early bonus, clamped;
 *   (b) multiplierForStreak tiers (×1 / ×1.5@3 / ×2@6);
 *   (c) starsForAccuracy thresholds (.5 / .75 / 1);
 *   (d) parseBest/mergeBest are defensive + higher-score-wins;
 *   (e) starGlyphs renders filled + hollow.
 *
 * Run:  node test/score.spec.mjs   (node >= 18)
 */

import { fileURLToPath } from "node:url"
import path from "node:path"
import { mkdtempSync, writeFileSync } from "node:fs"
import os from "node:os"

const here = path.dirname(fileURLToPath(import.meta.url))
const src = path.join(here, "..", "src")

let failures = 0
const fail = (m) => { console.error("FAIL:", m); failures++ }
const ok = (m) => console.log("OK  ", m)
const assert = (cond, m) => { if (cond) ok(m); else fail(m) }

const { build } = await import("esbuild")
async function bundleAndImport(entryText) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "drift-score-test-"))
  const entry = path.join(dir, "entry.ts")
  writeFileSync(entry, entryText)
  const res = await build({ entryPoints: [entry], bundle: true, format: "esm", write: false, platform: "node", absWorkingDir: dir })
  const mod = path.join(dir, "out.mjs")
  writeFileSync(mod, res.outputFiles[0].text)
  return await import(mod + "?t=" + Date.now())
}

const mod = await bundleAndImport(`export * from ${JSON.stringify(path.join(src, "score.ts"))}`)
const { catchPoints, multiplierForStreak, starsForAccuracy, parseBest, mergeBest, starGlyphs, bestStorageKey } = mod

// ---- (a) catchPoints -------------------------------------------------------
assert(catchPoints(1) === 150, "full early catch pays 150")
assert(catchPoints(0) === 100, "last-second catch still pays 100")
assert(catchPoints(0.5) === 125, "half-early catch pays 125")
assert(catchPoints(-1) === 100, "negative rf clamps to floor 100")
assert(catchPoints(2) === 150, "rf > 1 clamps to 150")

// ---- (b) multiplier tiers --------------------------------------------------
assert(multiplierForStreak(0) === 1, "streak 0 ⇒ ×1")
assert(multiplierForStreak(2) === 1, "streak 2 ⇒ ×1")
assert(multiplierForStreak(3) === 1.5, "streak 3 ⇒ ×1.5")
assert(multiplierForStreak(5) === 1.5, "streak 5 ⇒ ×1.5")
assert(multiplierForStreak(6) === 2, "streak 6 ⇒ ×2")
assert(multiplierForStreak(99) === 2, "streak 99 ⇒ ×2")

// ---- (c) star thresholds ---------------------------------------------------
assert(starsForAccuracy(1) === 3, "100% ⇒ 3 stars")
assert(starsForAccuracy(0.9) === 2, "90% ⇒ 2 stars")
assert(starsForAccuracy(0.75) === 2, "75% ⇒ 2 stars")
assert(starsForAccuracy(0.6) === 1, "60% ⇒ 1 star")
assert(starsForAccuracy(0.5) === 1, "50% ⇒ 1 star")
assert(starsForAccuracy(0.49) === 0, "49% ⇒ 0 stars")
assert(starsForAccuracy(0) === 0, "0% ⇒ 0 stars")

// ---- (d) best persistence --------------------------------------------------
assert(parseBest(null) === null, "parseBest(null) ⇒ null")
assert(parseBest("not json") === null, "parseBest(garbage) ⇒ null")
assert(parseBest('{"arcadeScore":840,"stars":2}').arcadeScore === 840, "parseBest reads a valid blob")
{
  const prev = { arcadeScore: 840, stars: 2 }
  assert(mergeBest(prev, { arcadeScore: 900, stars: 3 }).arcadeScore === 900, "higher score wins")
  assert(mergeBest(prev, { arcadeScore: 500, stars: 1 }).arcadeScore === 840, "lower score keeps the old best")
  assert(mergeBest(null, prev) === prev, "no prior best ⇒ take the new run")
}

// ---- (e) star glyphs + key -------------------------------------------------
assert(starGlyphs(2) === "★★☆", "2 stars ⇒ ★★☆")
assert(starGlyphs(0) === "☆☆☆", "0 stars ⇒ ☆☆☆")
assert(starGlyphs(3) === "★★★", "3 stars ⇒ ★★★")
assert(bestStorageKey("first-light") === "drift.best.first-light", "best key is scene-scoped")

console.log("")
if (failures) { console.error(`\n${failures} assertion(s) FAILED`); process.exit(1) }
else console.log("All score assertions passed.")
