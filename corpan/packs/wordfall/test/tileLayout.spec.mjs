/**
 * tileLayout unit test — the falling-tile text fit (WS-C+G fix: long phrases
 * must never overflow a lane sideways; tiles in different lanes must never
 * overlap).
 *
 * Drives the REAL `tileLayout.ts` headless with a deterministic fake
 * `measure()` (no canvas available under plain Node) that models a
 * monospace-ish font: width = text.length * fontPx * CHAR_W.
 *
 * Proves:
 *   (a) short labels stay on one line at the largest font;
 *   (b) a label too wide even at the smallest single-line font wraps to
 *       ≤ TILE_MAX_LINES lines, each of which fits maxWidth;
 *   (c) a no-space "word" (e.g. a CJK-style run) that alone exceeds maxWidth
 *       still gets split and fits — never returned wider than maxWidth;
 *   (d) a label so long it doesn't fit even wrapped is truncated with an
 *       ellipsis on the last line, and that line still fits maxWidth;
 *   (e) tileHeightFor grows with line count and never drops below the base
 *       height.
 *
 * Run:  node test/tileLayout.spec.mjs   (node >= 18)
 */

import { fileURLToPath } from "node:url"
import path from "node:path"
import { mkdtempSync, writeFileSync, rmSync } from "node:fs"
import os from "node:os"

const here = path.dirname(fileURLToPath(import.meta.url))
const packRoot = path.join(here, "..")
const src = path.join(packRoot, "src")

let failures = 0
const fail = (m) => { console.error("FAIL:", m); failures++ }
const ok = (m) => console.log("OK  ", m)
const assert = (cond, m) => { if (cond) ok(m); else fail(m) }

const { build } = await import("esbuild")

async function bundleAndImport(entryText) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "wf-tilelayout-test-"))
  const entry = path.join(dir, "entry.ts")
  writeFileSync(entry, entryText)
  const res = await build({
    entryPoints: [entry],
    bundle: true,
    format: "esm",
    write: false,
    platform: "node",
    absWorkingDir: dir,
  })
  const code = res.outputFiles[0].text
  const mod = path.join(dir, "out.mjs")
  writeFileSync(mod, code)
  return await import(mod + "?t=" + Date.now())
  // (tmp dir left for the OS to clean, matching the journey spec's convention)
  void rmSync
}

const mod = await bundleAndImport(`
  export * from ${JSON.stringify(path.join(src, "tileLayout.ts"))}
`)

const {
  layoutTileText,
  tileHeightFor,
  TILE_MIN_FONT,
  TILE_MAX_FONT,
  TILE_MAX_LINES,
  TILE_PAD_X,
} = mod

// Deterministic fake glyph metrics: no canvas under plain Node.
const CHAR_W = 0.6
const measure = (text, fontPx) => Array.from(text).length * fontPx * CHAR_W

// ---------------------------------------------------------------- (a)

{
  const { lines, fontPx } = layoutTileText("agua", 200, measure)
  assert(lines.length === 1 && lines[0] === "agua", "short label stays on one line")
  assert(fontPx === TILE_MAX_FONT, "short label keeps the largest font")
}

// ---------------------------------------------------------------- (b)

{
  const longPhrase = "una frase bastante larga para una sola linea de verdad"
  const maxWidth = 140
  const { lines, fontPx } = layoutTileText(longPhrase, maxWidth, measure)
  assert(fontPx === TILE_MIN_FONT, "a too-wide phrase falls back to the min font")
  assert(lines.length >= 1 && lines.length <= TILE_MAX_LINES,
    `wraps to between 1 and TILE_MAX_LINES lines (got ${lines.length})`)
  const usable = maxWidth - TILE_PAD_X
  for (const line of lines) {
    assert(measure(line, fontPx) <= usable + 1e-6, `line "${line}" fits within usable width`)
  }
}

// ---------------------------------------------------------------- (c)

{
  // A single run with no spaces (models a no-space script / long compound)
  // that alone is far wider than the lane.
  const noSpaceWord = "supercalifragilisticexpialidocious"
  const maxWidth = 100
  const { lines, fontPx } = layoutTileText(noSpaceWord, maxWidth, measure)
  const usable = maxWidth - TILE_PAD_X
  assert(lines.length <= TILE_MAX_LINES, "a single unbreakable word still respects TILE_MAX_LINES")
  for (const line of lines) {
    assert(measure(line, fontPx) <= usable + 1e-6,
      `no-space word chunk "${line}" fits within usable width (never overflows the lane)`)
  }
}

// ---------------------------------------------------------------- (d)

{
  const veryLong = Array.from({ length: 20 }, (_, i) => `palabra${i}`).join(" ")
  const maxWidth = 120
  const { lines, fontPx } = layoutTileText(veryLong, maxWidth, measure)
  assert(lines.length <= TILE_MAX_LINES, "an unfittable label is capped at TILE_MAX_LINES lines")
  const last = lines[lines.length - 1]
  assert(last.endsWith("…"), "the last line is ellipsized when the label doesn't fully fit")
  const usable = maxWidth - TILE_PAD_X
  assert(measure(last, fontPx) <= usable + 1e-6, "the ellipsized line still fits maxWidth")
}

// ---------------------------------------------------------------- (e)

{
  const base = 52
  assert(tileHeightFor(1, base) === base, "a single-line tile keeps the base height")
  assert(tileHeightFor(2, base) > tileHeightFor(1, base), "a two-line tile is taller than a one-line tile")
}

// ---------------------------------------------------------------------------
console.log("")
if (failures) {
  console.error(`\n${failures} assertion(s) FAILED`)
  process.exit(1)
} else {
  console.log("All tileLayout assertions passed.")
}
