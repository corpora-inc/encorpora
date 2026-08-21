// Tests for the simplified-onboarding phrase-pack helpers:
//   - planInstallAll: the "not installed yet" set + total size the one-tap
//     "Install all" acts on (installed packs and paid/un-entitled packs excluded).
//   - reconcileActiveAfterBatch: partial-failure handling — a pack that failed
//     to download is dropped from the optimistically-activated set.
//   - shouldAutoSkipPhrasePacks: the fully-installed-starter-set silent-skip
//     guard (CTO feedback) — including the Back-navigation re-entry guard.
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

type AutoSkipInputs = {
  lastFetched: number | null | undefined
  hasStarter: boolean
  planAvailableCount: number
  phase: "idle" | "installing" | "failed"
  expanded: boolean
  alreadySkipped: boolean
}
type ShouldAutoSkipPhrasePacks = (inputs: AutoSkipInputs) => boolean

const mod = (await import("./phrasePackInstall.ts")) as unknown as {
  planInstallAll: PlanInstallAll
  reconcileActiveAfterBatch: ReconcileActiveAfterBatch
  shouldAutoSkipPhrasePacks: ShouldAutoSkipPhrasePacks
}
const { planInstallAll, reconcileActiveAfterBatch, shouldAutoSkipPhrasePacks } = mod

/** Baseline "everything says skip" inputs — each test overrides one field to
 *  prove it's the thing gating the decision. */
function autoSkipInputs(overrides: Partial<AutoSkipInputs> = {}): AutoSkipInputs {
  return {
    lastFetched: 1_700_000_000_000,
    hasStarter: true,
    planAvailableCount: 0,
    phase: "idle",
    expanded: false,
    alreadySkipped: false,
    ...overrides,
  }
}

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

test("shouldAutoSkipPhrasePacks: everything installed, catalog loaded → skip", () => {
  assert.equal(shouldAutoSkipPhrasePacks(autoSkipInputs()), true)
})

test("shouldAutoSkipPhrasePacks: anything still to install → never skip", () => {
  assert.equal(
    shouldAutoSkipPhrasePacks(autoSkipInputs({ planAvailableCount: 1 })),
    false,
  )
})

test("shouldAutoSkipPhrasePacks: catalog not fetched yet (null/undefined lastFetched) → never skip", () => {
  // The async-catalog caveat: an unloaded catalog must never be treated as
  // "nothing to install" (that would skip the step for every first-boot
  // user before the real starter list has even landed).
  assert.equal(
    shouldAutoSkipPhrasePacks(autoSkipInputs({ lastFetched: null })),
    false,
  )
  assert.equal(
    shouldAutoSkipPhrasePacks(autoSkipInputs({ lastFetched: undefined })),
    false,
  )
})

test("shouldAutoSkipPhrasePacks: no starter packs at all → never skip (renders its own placeholder)", () => {
  assert.equal(
    shouldAutoSkipPhrasePacks(autoSkipInputs({ hasStarter: false })),
    false,
  )
})

test("shouldAutoSkipPhrasePacks: mid-install or after a partial failure → never skip", () => {
  assert.equal(
    shouldAutoSkipPhrasePacks(autoSkipInputs({ phase: "installing" })),
    false,
  )
  assert.equal(
    shouldAutoSkipPhrasePacks(autoSkipInputs({ phase: "failed" })),
    false,
  )
})

test("shouldAutoSkipPhrasePacks: the à-la-carte grid is open → never yank it away", () => {
  assert.equal(
    shouldAutoSkipPhrasePacks(autoSkipInputs({ expanded: true })),
    false,
  )
})

test("shouldAutoSkipPhrasePacks: already skipped once this session → never fire again (the Back-navigation guard)", () => {
  // Without this guard, Back navigation into a step that already silently
  // advanced would immediately re-trigger the same skip and bounce the user
  // forward again — trapping them with no way back past this step.
  assert.equal(
    shouldAutoSkipPhrasePacks(autoSkipInputs({ alreadySkipped: true })),
    false,
  )
})
