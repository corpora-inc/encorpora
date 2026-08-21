// Learners, and the storage they own.
//
// `Q-12`'s rule — everything a child does is namespaced by their profile id —
// is the one that cannot be retrofitted: by the time a second child exists, the
// first one's record is on a real family's tablet and the migration has to be
// right the first time. So the namespace is asserted from both ends here: three
// learners write three keys, and removing a learner takes their keys with them
// and nobody else's.

import { test } from "node:test"
import assert from "node:assert/strict"

import {
  DEFAULT_PROFILE_ID,
  deviceKey,
  forgetProfile,
  isProfileId,
  ownedKeys,
  storageBytes,
  storageKey,
} from "../app/profile.ts"
import { ephemeral } from "../app/persist.ts"
import { createRecordStore } from "../learner/record.ts"
import { cleanName, nextProfileId, useProfiles } from "./store.ts"

/** A `Storage` that lives in a Map, for the functions that read the global. */
function fakeStorage(seed: Record<string, string> = {}): Storage {
  const held = new Map(Object.entries(seed))
  return {
    get length() {
      return held.size
    },
    key: (index: number) => [...held.keys()][index] ?? null,
    getItem: (key: string) => held.get(key) ?? null,
    setItem: (key: string, value: string) => void held.set(key, value),
    removeItem: (key: string) => void held.delete(key),
    clear: () => held.clear(),
  }
}

test("a key names one learner and one thing, and cannot be forged", () => {
  assert.equal(storageKey("p2", "record"), "dynawalla.p2.record")
  assert.equal(deviceKey("settings"), "dynawalla.settings")

  // The separator is banned inside an id, which is what stops `a.b` + `c` and
  // `a` + `b.c` from colliding on one key — the failure that would silently
  // merge two children's records and only show up on a family's tablet.
  assert.ok(!isProfileId("a.b"))
  assert.ok(!isProfileId(""))
  assert.throws(() => storageKey("a.b", "record"), RangeError)
  assert.throws(() => storageKey("p1", "a.b"), RangeError)
})

test("three learners write three keys and never read each other's", () => {
  const a = createRecordStore("p1")
  const b = createRecordStore("p2")
  const c = createRecordStore("p3")

  a.getState().answer(true)
  a.getState().answer(false)
  b.getState().answer(true)
  // A learner who has done nothing has written nothing — there is no key on
  // disk until there is something in it — so `c` is asked for one answer it
  // then discards, purely so all three namespaces exist to be compared.
  c.getState().answer(true)
  c.setState({ answered: 0, correct: 0 })

  assert.deepEqual(
    [a.getState(), b.getState(), c.getState()].map((state) => [state.answered, state.correct]),
    [
      [2, 1],
      [1, 1],
      [0, 0],
    ],
  )

  for (const id of ["p1", "p2", "p3"]) {
    assert.ok(ephemeral.has(storageKey(id, "record")), `${id} wrote no key of its own`)
  }
})

test("a total never goes down, whatever is on disk", () => {
  // No loss is a product rule, and this is where it is enforced rather than
  // promised. The inputs are the ones that actually occur: a half-written blob,
  // a negative from a hand-edited devtools session, a string from an older
  // schema. None of them may take a child's history backwards.
  ephemeral.set(
    storageKey("p9", "record"),
    JSON.stringify({ state: { answered: -5, correct: "many" }, version: 1 }),
  )
  const store = createRecordStore("p9")
  assert.deepEqual(
    [store.getState().answered, store.getState().correct],
    [0, 0],
    "rehydration must clamp rather than trust",
  )

  store.getState().answer(true)
  assert.deepEqual([store.getState().answered, store.getState().correct], [1, 1])
})

test("the next learner id is derived from the ids in use, not from the count", () => {
  // Removing the second of three and adding one would otherwise mint an id that
  // is already on disk, and the new child would inherit the removed one's record.
  assert.equal(nextProfileId([{ id: "p1", name: "" }]), "p2")
  assert.equal(nextProfileId([{ id: "p1", name: "" }, { id: "p3", name: "" }]), "p4")
  assert.equal(nextProfileId([]), "p1")
})

test("a name is trimmed, bounded and never blank on screen", () => {
  assert.equal(cleanName("  Aster  ", "Learner 1"), "Aster")
  assert.equal(cleanName("   ", "Learner 1"), "Learner 1")
  assert.equal(cleanName("x".repeat(80), "Learner 1").length, 40)
})

test("adding, switching and removing a learner", () => {
  const store = useProfiles.getState()
  assert.equal(store.currentId, DEFAULT_PROFILE_ID)

  store.add("")
  const added = useProfiles.getState()
  assert.equal(added.profiles.length, 2)
  assert.equal(added.currentId, "p2", "a learner you just added is the learner you meant")

  added.rename("p2", "Aster")
  assert.equal(useProfiles.getState().profiles[1]?.name, "Aster")

  added.select("p1")
  assert.equal(useProfiles.getState().currentId, "p1")

  useProfiles.getState().remove("p2")
  assert.equal(useProfiles.getState().profiles.length, 1)

  // There is no state of this app with nobody in it.
  useProfiles.getState().remove("p1")
  assert.equal(useProfiles.getState().profiles.length, 1)
})

test("removing a learner erases their keys and only theirs", () => {
  const kept = deviceKey("settings")
  globalThis.localStorage = fakeStorage({
    [storageKey("p1", "record")]: "{}",
    [storageKey("p1", "world")]: "{}",
    [storageKey("p2", "record")]: "{}",
    [kept]: "{}",
    "someone.else": "{}",
  })

  assert.equal(ownedKeys().length, 4, "only this app's keys are this app's business")
  assert.ok(storageBytes() > 0)

  forgetProfile("p1")

  assert.deepEqual(ownedKeys().sort(), [kept, storageKey("p2", "record")].sort())
  assert.equal(localStorage.getItem("someone.else"), "{}")
})
