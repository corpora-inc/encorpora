// Unit tests for the generic installed-data-pack registry + the exact
// recognition predicate the Journey runtime composes over it (imagepan is the
// first — and today only — consumer). Run with: `npm test`.
//
// The store persists via `createJSONStorage(() => localStorage)`, so we shim a
// minimal localStorage before importing it (same shim runtimeImageChoice.test
// uses).

import { test, beforeEach } from "node:test"
import assert from "node:assert/strict"

if (typeof globalThis.localStorage === "undefined") {
  const bag = new Map<string, string>()
  ;(globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => bag.get(k) ?? null,
    setItem: (k: string, v: string) => void bag.set(k, String(v)),
    removeItem: (k: string) => void bag.delete(k),
    clear: () => bag.clear(),
    key: () => null,
    length: 0,
  }
}

const { useDataPacksStore } = await import("./dataPacks.ts")

/** The recognition predicate as `runtimeWiring.buildJourneyDeps` composes it:
 *  the course pack id, any journey pack, OR any registered data pack. Here we
 *  exercise the data-pack arm (journey arms are covered by runtime tests). */
function findInstalledPack(pid: string): boolean {
  return useDataPacksStore.getState().has(pid)
}

beforeEach(() => {
  useDataPacksStore.setState({ installed: {}, declined: {} })
})

test("imagepan is NOT recognized until registered (ships inert)", () => {
  assert.equal(findInstalledPack("imagepan"), false)
})

test("registering imagepan flips the sync recognition gate to true", () => {
  useDataPacksStore.getState().register({
    id: "imagepan",
    version: "0.1.0",
    installedAt: new Date().toISOString(),
    source: "catalog",
  })
  assert.equal(findInstalledPack("imagepan"), true)
  assert.equal(useDataPacksStore.getState().get("imagepan")?.version, "0.1.0")
})

test("register overwrites a prior version (upgrade in place)", () => {
  const reg = useDataPacksStore.getState().register
  reg({ id: "imagepan", version: "0.1.0", installedAt: "a", source: "catalog" })
  reg({ id: "imagepan", version: "0.2.0", installedAt: "b", source: "catalog" })
  assert.equal(useDataPacksStore.getState().list().length, 1)
  assert.equal(useDataPacksStore.getState().get("imagepan")?.version, "0.2.0")
})

test("unregister removes a pack; unknown id is a no-op", () => {
  const st = useDataPacksStore.getState()
  st.register({ id: "imagepan", version: "0.1.0", installedAt: "a", source: "catalog" })
  st.unregister("nonesuch")
  assert.equal(useDataPacksStore.getState().has("imagepan"), true)
  useDataPacksStore.getState().unregister("imagepan")
  assert.equal(useDataPacksStore.getState().has("imagepan"), false)
})

test("registry is generic — a second data pack coexists", () => {
  const reg = useDataPacksStore.getState().register
  reg({ id: "imagepan", version: "0.1.0", installedAt: "a", source: "catalog" })
  reg({ id: "otherpan", version: "1.0.0", installedAt: "b", source: "manual" })
  assert.equal(findInstalledPack("imagepan"), true)
  assert.equal(findInstalledPack("otherpan"), true)
  assert.equal(findInstalledPack("nope"), false)
})

// -------------------------------------------------- consent-offer decline flag
// The persisted decline is how the one-tap install offer (ImagePackOfferBanner)
// avoids nagging every session.

test("decline is remembered; undecline clears it (offer can re-surface)", () => {
  const st = useDataPacksStore.getState()
  assert.equal(st.isDeclined("imagepan"), false)
  st.decline("imagepan")
  assert.equal(useDataPacksStore.getState().isDeclined("imagepan"), true)
  useDataPacksStore.getState().undecline("imagepan")
  assert.equal(useDataPacksStore.getState().isDeclined("imagepan"), false)
})

test("decline is idempotent and independent of the installed registry", () => {
  const st = useDataPacksStore.getState()
  st.decline("imagepan")
  st.decline("imagepan")
  assert.equal(useDataPacksStore.getState().isDeclined("imagepan"), true)
  // declining never registers the pack (no silent install side effect)
  assert.equal(useDataPacksStore.getState().has("imagepan"), false)
  // undecline of an unknown id is a no-op
  useDataPacksStore.getState().undecline("nonesuch")
  assert.equal(useDataPacksStore.getState().isDeclined("imagepan"), true)
})

test("declining one pack does not decline another (keyed by id)", () => {
  const st = useDataPacksStore.getState()
  st.decline("imagepan")
  assert.equal(useDataPacksStore.getState().isDeclined("imagepan"), true)
  assert.equal(useDataPacksStore.getState().isDeclined("otherpan"), false)
})
