/**
 * lantern unit test — the "catch the drift" spawn/timing model (lantern.ts).
 * Drives the REAL module headless via esbuild (mirrors challenge.spec.mjs).
 *
 * Proves:
 *   (a) layout is deterministic for a fixed seed;
 *   (b) guaranteedFirst puts the CORRECT lantern first, pulsing (early-win);
 *   (c) lanes alternate and non-reduced runs stagger launches; reduced = no stagger;
 *   (d) every option becomes exactly one lantern, target flagged;
 *   (e) remainingFraction / crossingProgress are clamped + monotonic.
 *
 * Run:  node test/lantern.spec.mjs   (node >= 18)
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
  const dir = mkdtempSync(path.join(os.tmpdir(), "drift-lantern-test-"))
  const entry = path.join(dir, "entry.ts")
  writeFileSync(entry, entryText)
  const res = await build({ entryPoints: [entry], bundle: true, format: "esm", write: false, platform: "node", absWorkingDir: dir })
  const mod = path.join(dir, "out.mjs")
  writeFileSync(mod, res.outputFiles[0].text)
  return await import(mod + "?t=" + Date.now())
}

const mod = await bundleAndImport(`export * from ${JSON.stringify(path.join(src, "lantern.ts"))}`)
const { layoutLanterns, remainingFraction, crossingProgress, LANE_COUNT, STAGGER_MS, CROSS_MS } = mod

const options = ["mar", "luz", "mañana", "despacio"]
const target = "mañana"

// ---- (a) determinism -------------------------------------------------------
{
  const a = JSON.stringify(layoutLanterns(options, target, 42))
  const b = JSON.stringify(layoutLanterns(options, target, 42))
  assert(a === b, "same seed ⇒ identical layout")
}

// ---- (b) guaranteed early win ---------------------------------------------
{
  const f = layoutLanterns(options, target, 3, { guaranteedFirst: true })
  assert(f.lanterns[0].isTarget === true, "guaranteedFirst: correct lantern launches first")
  assert(f.lanterns[0].pulse === true, "guaranteedFirst: first lantern pulses")
  assert(f.lanterns[0].startDelayMs === 0, "first lantern launches at t=0")
  assert(f.lanterns.filter((l) => l.pulse).length === 1, "only one lantern pulses")
}

// ---- (c) lanes + stagger ---------------------------------------------------
{
  const f = layoutLanterns(options, target, 5)
  f.lanterns.forEach((l, i) => {
    if (l.lane !== i % LANE_COUNT) fail(`lantern ${i} lane = ${l.lane}`)
    if (l.startDelayMs !== i * STAGGER_MS) fail(`lantern ${i} stagger = ${l.startDelayMs}`)
  })
  ok("lanes alternate + launches stagger by STAGGER_MS")
  const r = layoutLanterns(options, target, 5, { reduced: true })
  assert(r.lanterns.every((l) => l.startDelayMs === 0), "reduced motion ⇒ no stagger (all t=0)")
}

// ---- (d) completeness ------------------------------------------------------
{
  const f = layoutLanterns(options, target, 9)
  assert(f.lanterns.length === options.length, "one lantern per option")
  const words = f.lanterns.map((l) => l.word).sort()
  assert(JSON.stringify(words) === JSON.stringify([...options].sort()), "all options represented")
  assert(f.lanterns.filter((l) => l.isTarget).length === 1, "exactly one lantern is the target")
}

// ---- (e) fraction math -----------------------------------------------------
{
  assert(remainingFraction(0, CROSS_MS) === 1, "rf = 1 at launch")
  assert(remainingFraction(CROSS_MS, CROSS_MS) === 0, "rf = 0 at end of crossing")
  assert(remainingFraction(CROSS_MS * 2, CROSS_MS) === 0, "rf clamps to 0 past the end")
  assert(remainingFraction(-100, CROSS_MS) === 1, "rf clamps to 1 before launch")
  assert(Math.abs(remainingFraction(CROSS_MS / 2, CROSS_MS) - 0.5) < 1e-9, "rf = 0.5 at half crossing")
  assert(crossingProgress(0, CROSS_MS) === 0 && crossingProgress(CROSS_MS, CROSS_MS) === 1, "progress spans 0..1")
  assert(remainingFraction(100, 0) === 0, "rf safe when crossMs = 0")
}

console.log("")
if (failures) { console.error(`\n${failures} assertion(s) FAILED`); process.exit(1) }
else console.log("All lantern assertions passed.")
