import assert from "node:assert/strict"
import test from "node:test"

import {
  MODELS,
  RAM_THRESHOLDS,
  modelById,
  recommendedContext,
  selectTier,
} from "../src/modelTiering.ts"

const ID_06 = "llm-base-qwen3-0.6b-v1"
const ID_17 = "llm-base-qwen3-1.7b-v1"
const ID_4B = "llm-base-qwen3-4b-v1"

test("registry: three sizes, smallest→largest, all published", () => {
  assert.deepEqual(
    MODELS.map((m) => m.id),
    [ID_06, ID_17, ID_4B],
  )
  assert.deepEqual(
    MODELS.map((m) => m.published),
    [true, true, true],
  )
  // hybrid sizes need the non-thinking prefix; the 4B is native instruct
  assert.deepEqual(
    MODELS.map((m) => m.reasoning),
    ["hybrid", "hybrid", "instruct"],
  )
  // footprints increase with size
  const f = MODELS.map((m) => m.footprintMb)
  assert.ok(f[0] < f[1] && f[1] < f[2])
  assert.equal(modelById(ID_4B).displayName, "Qwen3 4B")
  assert.throws(() => modelById("nope"))
})

// Exactly one size is "recommended" on any device.
function recommendedCount(stateById) {
  return Object.values(stateById).filter((s) => s === "recommended").length
}

test("3 GB phone: 0.6B recommended, 1.7B try-anyway, 4B disabled", () => {
  const { recommendedId, stateById } = selectTier(3000)
  assert.equal(recommendedId, ID_06)
  assert.equal(stateById[ID_06], "recommended")
  assert.equal(stateById[ID_17], "try-anyway")
  assert.equal(stateById[ID_4B], "disabled")
  assert.equal(recommendedCount(stateById), 1)
})

test("4 GB phone: 1.7B recommended, 0.6B available, 4B disabled (needs 6GB+)", () => {
  const { recommendedId, stateById } = selectTier(4000)
  assert.equal(recommendedId, ID_17)
  assert.equal(stateById[ID_06], "available")
  assert.equal(stateById[ID_17], "recommended")
  assert.equal(stateById[ID_4B], "disabled")
})

test("5 GB phone: still 1.7B recommended, 4B disabled (below try line)", () => {
  const { stateById } = selectTier(5000)
  assert.equal(stateById[ID_17], "recommended")
  assert.equal(stateById[ID_4B], "disabled")
})

test("6 GB phone (the one that crashed 4B): 1.7B recommended, 4B try-anyway", () => {
  const { recommendedId, stateById } = selectTier(6000)
  assert.equal(recommendedId, ID_17)
  assert.equal(stateById[ID_06], "available")
  assert.equal(stateById[ID_17], "recommended")
  assert.equal(stateById[ID_4B], "try-anyway")
})

test("6.9 GB phone: still 1.7B recommended, 4B try-anyway (under the 7GB safe line)", () => {
  const { recommendedId, stateById } = selectTier(6900)
  assert.equal(recommendedId, ID_17)
  assert.equal(stateById[ID_4B], "try-anyway")
})

test("7 GB (8GB-class): 4B recommended, smaller sizes available", () => {
  const { recommendedId, stateById } = selectTier(7000)
  assert.equal(recommendedId, ID_4B)
  assert.equal(stateById[ID_4B], "recommended")
  assert.equal(stateById[ID_17], "available")
  assert.equal(stateById[ID_06], "available")
  assert.equal(recommendedCount(stateById), 1)
})

test("8 GB+: 4B recommended", () => {
  assert.equal(selectTier(8000).recommendedId, ID_4B)
  assert.equal(selectTier(12000).recommendedId, ID_4B)
})

test("unknown/desktop (null/0): assume capable → 4B recommended, all available", () => {
  for (const v of [null, undefined, 0, NaN]) {
    const { recommendedId, stateById } = selectTier(v)
    assert.equal(recommendedId, ID_4B, `ram=${String(v)}`)
    assert.equal(stateById[ID_06], "available")
    assert.equal(stateById[ID_17], "available")
    assert.equal(stateById[ID_4B], "recommended")
  }
})

test("tiny device below the 1.7B floor: only 0.6B, 1.7B + 4B disabled", () => {
  const { recommendedId, stateById } = selectTier(RAM_THRESHOLDS.M1_7B_MIN - 1)
  assert.equal(recommendedId, ID_06)
  assert.equal(stateById[ID_17], "disabled")
  assert.equal(stateById[ID_4B], "disabled")
})

test("Metal (iOS/macOS) relaxes the 4B line: 6 GB recommends 4B", () => {
  const plain = selectTier(6000)
  assert.equal(plain.recommendedId, ID_17)
  const metal = selectTier(6000, { metal: true })
  assert.equal(metal.recommendedId, ID_4B)
  assert.equal(metal.stateById[ID_4B], "recommended")
})

test("recommendedContext: bigger ctx only for 4B on ≥12 GB", () => {
  assert.equal(recommendedContext(ID_4B, 12000), 8192)
  assert.equal(recommendedContext(ID_4B, 8000), 4096)
  assert.equal(recommendedContext(ID_17, 12000), 4096)
  assert.equal(recommendedContext(ID_4B, null), 4096)
})

test("boundary monotonicity: recommended size never shrinks as RAM grows", () => {
  const rank = { [ID_06]: 0, [ID_17]: 1, [ID_4B]: 2 }
  let prev = -1
  for (const ram of [1000, 2200, 3000, 4000, 5500, 6000, 7000, 8000, 12000, 16000]) {
    const r = rank[selectTier(ram).recommendedId]
    assert.ok(r >= prev, `recommended shrank at ram=${ram}`)
    prev = r
  }
})
