// rng parity + known-answer tests (content-resolver.md §6).
//
// `journey/content/rng.ts` is a DELIBERATE duplicate of `journey/engine/rng.ts`
// (the engine barrel is closed). This is the tripwire: known-answer vectors
// pin the canonical algorithms, and when the engine's rng.ts exists in the
// tree (W3), its outputs are compared 1:1 for 1,000 seeds.

import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { fnv1a32, mulberry32, cardRng } from "./rng.ts"

// --- known-answer vectors (canonical FNV-1a 32-bit, ASCII) ------------------

test("fnv1a32 matches the canonical FNV-1a 32-bit vectors", () => {
  assert.equal(fnv1a32(""), 0x811c9dc5)
  assert.equal(fnv1a32("a"), 0xe40c292c)
  assert.equal(fnv1a32("foobar"), 0xbf9cf968)
})

test("fnv1a32 is deterministic on non-ASCII code units", () => {
  assert.equal(fnv1a32("phoneme:journey_en:iː-ɪ"), fnv1a32("phoneme:journey_en:iː-ɪ"))
  assert.notEqual(fnv1a32("愛"), fnv1a32("水"))
})

// --- mulberry32 reference (independent copy — the local tripwire) ----------

function mulberry32Reference(seed: number): () => number {
  let a = seed >>> 0
  return function () {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

test("mulberry32 matches the reference for 1,000 seeds", () => {
  for (let seed = 0; seed < 1000; seed++) {
    const a = mulberry32(seed)
    const b = mulberry32Reference(seed)
    for (let i = 0; i < 5; i++) assert.equal(a(), b())
  }
})

test("mulberry32 output is in [0, 1) and varies", () => {
  const rng = mulberry32(fnv1a32("card-1"))
  const seen = new Set<number>()
  for (let i = 0; i < 1000; i++) {
    const x = rng()
    assert.ok(x >= 0 && x < 1)
    seen.add(x)
  }
  assert.ok(seen.size > 990)
})

test("cardRng is stable per cardId across fresh instances", () => {
  const a = cardRng("js-1700000000-ab12")
  const b = cardRng("js-1700000000-ab12")
  for (let i = 0; i < 100; i++) assert.equal(a(), b())
  const c = cardRng("js-1700000000-ab13")
  assert.notEqual(cardRng("js-1700000000-ab12")(), c())
})

// --- engine parity (activates automatically once W3's rng.ts lands) --------

test("parity with journey/engine/rng.ts when present", async (t) => {
  const here = path.dirname(fileURLToPath(import.meta.url))
  const engineRng = path.join(here, "..", "engine", "rng.ts")
  if (!fs.existsSync(engineRng)) {
    t.skip("journey/engine/rng.ts not in tree yet (W3 in flight) — vectors above pin this copy")
    return
  }
  // Non-literal specifier: tsc must not statically require the module —
  // it only exists once W3 lands (this test then activates at runtime).
  const specifier = "../engine/rng.ts"
  const engine = (await import(specifier)) as {
    fnv1a32?: (s: string) => number
    mulberry32?: (seed: number) => () => number
  }
  assert.ok(engine.fnv1a32 && engine.mulberry32, "engine rng.ts must export fnv1a32 + mulberry32")
  const samples = ["", "a", "foobar", "card-1", "phrase:base:18422", "愛", "iː-ɪ"]
  for (const s of samples) assert.equal(fnv1a32(s), engine.fnv1a32(s))
  for (let seed = 0; seed < 1000; seed++) {
    const ours = mulberry32(seed)
    const theirs = engine.mulberry32(seed)
    for (let i = 0; i < 3; i++) assert.equal(ours(), theirs())
  }
})
