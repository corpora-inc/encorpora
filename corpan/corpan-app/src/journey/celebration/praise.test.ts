// Praise-word sampler tests (PREMIUM_SCROLL §3.4): the tier-1 splash draws a
// FRESH exclamation every time — never repeating within the avoidance window —
// so the learner keeps playing to see the next word. Pure logic, no renderer.

import { test } from "node:test"
import assert from "node:assert/strict"
import { createPraiseSampler, PRAISE_KEYS } from "./praise.ts"

// A tiny deterministic RNG so the draws are reproducible.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let tt = Math.imul(a ^ (a >>> 15), 1 | a)
    tt = (tt + Math.imul(tt ^ (tt >>> 7), 61 | tt)) ^ tt
    return ((tt ^ (tt >>> 14)) >>> 0) / 4294967296
  }
}

test("every draw is a real key from the pool", () => {
  const s = createPraiseSampler({ rng: mulberry32(1) })
  for (let i = 0; i < 200; i++) {
    assert.ok((PRAISE_KEYS as readonly string[]).includes(s.next()))
  }
})

test("never repeats within the avoidance window (avoid=2)", () => {
  const s = createPraiseSampler({ avoid: 2, rng: mulberry32(42) })
  const seen: string[] = []
  for (let i = 0; i < 500; i++) {
    const k = s.next()
    // must differ from the last two picks
    assert.notEqual(k, seen[seen.length - 1], `immediate repeat at ${i}`)
    assert.notEqual(k, seen[seen.length - 2], `near-repeat at ${i}`)
    seen.push(k)
  }
})

test("draws stay varied — many distinct keys appear over a run", () => {
  const s = createPraiseSampler({ rng: mulberry32(7) })
  const seen = new Set<string>()
  for (let i = 0; i < 300; i++) seen.add(s.next())
  // With 12 keys and non-repeating draws, we should visit most of the pool.
  assert.ok(seen.size >= PRAISE_KEYS.length - 1, `only ${seen.size} distinct`)
})

test("avoidance never starves a tiny pool (clamped)", () => {
  const pool = [PRAISE_KEYS[0], PRAISE_KEYS[1]] as const
  const s = createPraiseSampler({ pool, avoid: 5, rng: mulberry32(3) })
  // avoid is clamped to pool.length-1, so a 2-key pool still alternates cleanly.
  const a = s.next()
  const b = s.next()
  assert.notEqual(a, b)
  assert.ok((pool as readonly string[]).includes(a))
})

test("avoid=0 may repeat (no window) but still returns valid keys", () => {
  const s = createPraiseSampler({ avoid: 0, rng: mulberry32(9) })
  for (let i = 0; i < 50; i++) {
    assert.ok((PRAISE_KEYS as readonly string[]).includes(s.next()))
  }
})
