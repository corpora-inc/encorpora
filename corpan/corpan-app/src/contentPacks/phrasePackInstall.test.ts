// Tests for the simplified-onboarding phrase-pack helpers:
//   - planInstallAll: the "not installed yet" set + total size the one-tap
//     "Install all" acts on (installed packs and paid/un-entitled packs excluded).
//   - reconcileActiveAfterBatch: partial-failure handling — a pack that failed
//     to download is dropped from the optimistically-activated set.
// Run with: `npm test` (node --experimental-strip-types --test). The module's
// only import is `import type`, erased by the type-stripping loader.

import { test } from "node:test"
import assert from "node:assert/strict"

// The helpers only read `id`/`sizeMb`; the real PhrasePackCatalogEntry has many
// required fields we don't care about here, so we exercise them through a loose
// signature (same pattern as resolveLanding.test's loosely-typed export).
type Pack = { id: string; sizeMb?: number; paid?: boolean }
type PlanInstallAll = (
  starter: Pack[],
  installed: Iterable<string>,
  isEntitled: (p: Pack) => boolean,
) => { available: Pack[]; totalSizeMb: number }
type ReconcileActiveAfterBatch = (
  activeIds: string[],
  outcome: { installed: string[]; failed: Array<{ id: string; error: string }> },
) => string[]

const mod = (await import("./phrasePackInstall.ts")) as unknown as {
  planInstallAll: PlanInstallAll
  reconcileActiveAfterBatch: ReconcileActiveAfterBatch
}
const { planInstallAll, reconcileActiveAfterBatch } = mod

/** Minimal pack shape — only the fields the helpers read. */
function pack(id: string, sizeMb?: number, extra: Partial<Pack> = {}): Pack {
  return { id, sizeMb, ...extra }
}

const free = () => true

test("planInstallAll: excludes already-installed, sums size of the rest", () => {
  const starter = [pack("a", 1.5), pack("b", 2), pack("c", 0.5)]
  const plan = planInstallAll(starter, ["b"], free)
  assert.deepEqual(
    plan.available.map((p) => p.id),
    ["a", "c"],
  )
  assert.equal(plan.totalSizeMb, 2.0)
})

test("planInstallAll: accepts a Set of installed ids too", () => {
  const starter = [pack("a", 1), pack("b", 1)]
  const plan = planInstallAll(starter, new Set(["a"]), free)
  assert.deepEqual(
    plan.available.map((p) => p.id),
    ["b"],
  )
})

test("planInstallAll: missing sizeMb contributes 0", () => {
  const starter = [pack("a", undefined), pack("b", 3)]
  const plan = planInstallAll(starter, [], free)
  assert.equal(plan.totalSizeMb, 3)
})

test("planInstallAll: un-entitled (paid) packs are excluded from Install all", () => {
  const starter = [pack("free1", 1), pack("paid1", 5, { paid: true })]
  const isEntitled = (p: Pack) => !p.paid
  const plan = planInstallAll(starter, [], isEntitled)
  assert.deepEqual(
    plan.available.map((p) => p.id),
    ["free1"],
  )
  assert.equal(plan.totalSizeMb, 1)
})

test("planInstallAll: everything installed → empty plan, zero size", () => {
  const starter = [pack("a", 2), pack("b", 2)]
  const plan = planInstallAll(starter, ["a", "b"], free)
  assert.deepEqual(plan.available, [])
  assert.equal(plan.totalSizeMb, 0)
})

test("reconcileActiveAfterBatch: no failures → unchanged", () => {
  const active = ["a", "b", "c"]
  const out = reconcileActiveAfterBatch(active, { installed: active, failed: [] })
  assert.deepEqual(out, ["a", "b", "c"])
})

test("reconcileActiveAfterBatch: drops failed ids, keeps the rest", () => {
  const active = ["a", "b", "c"]
  const out = reconcileActiveAfterBatch(active, {
    installed: ["a", "c"],
    failed: [{ id: "b", error: "network" }],
  })
  assert.deepEqual(out, ["a", "c"])
})

test("reconcileActiveAfterBatch: all failed → empty active list", () => {
  const active = ["a", "b"]
  const out = reconcileActiveAfterBatch(active, {
    installed: [],
    failed: [
      { id: "a", error: "x" },
      { id: "b", error: "y" },
    ],
  })
  assert.deepEqual(out, [])
})
