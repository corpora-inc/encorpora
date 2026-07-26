import { test } from "node:test"
import assert from "node:assert/strict"

import { createProgressStore, ephemeral, INITIAL_PROGRESS } from "./progress.ts"
import { DEFAULT_PROFILE_ID, isProfileId, storageKey } from "../app/profile.ts"

test("keys are namespaced by profile, and cannot collide across profiles", () => {
  assert.equal(storageKey("p1", "progress"), "dynawalla.p1.progress")
  assert.notEqual(storageKey("p1", "progress"), storageKey("p2", "progress"))
  // The separator is banned inside an id, which is what stops `a.b` + `c` and
  // `a` + `b.c` from resolving to one key and silently merging two children.
  assert.equal(isProfileId("a.b"), false)
  assert.throws(() => storageKey("a.b", "progress"), RangeError)
  assert.throws(() => storageKey("", "progress"), RangeError)
})

test("three children on one device have independent progress", () => {
  // `Q-12`, from the storage side. The device half is a device item; this is the
  // test that catches a shared key, which a device check would only find after a
  // family had already used the app.
  ephemeral.clear()
  const stores = ["a", "b", "c"].map((id) => ({ id, store: createProgressStore(id) }))

  stores.forEach(({ store }, i) => {
    store.getState().savePosition({ learner: `state-${String(i)}`, seedCursor: i * 10, day: i })
    for (let n = 0; n <= i; n++) store.getState().recordAnswer(true)
    store.getState().countBug("mis.add.borrow-across-zero")
  })

  stores.forEach(({ store }, i) => {
    assert.equal(store.getState().learner, `state-${String(i)}`)
    assert.equal(store.getState().seedCursor, i * 10)
    assert.equal(store.getState().correct, i + 1)
  })

  const keys = [...ephemeral.keys()].sort()
  assert.deepEqual(keys, ["dynawalla.a.progress", "dynawalla.b.progress", "dynawalla.c.progress"])
  for (const { id, store } of stores) {
    const written = ephemeral.get(storageKey(id, "progress"))
    assert.ok(written !== undefined)
    assert.equal((JSON.parse(written) as { state: { learner: string } }).state.learner, store.getState().learner)
  }
})

test("progress survives a relaunch: a new store on the same key reads it back", () => {
  ephemeral.clear()
  const first = createProgressStore("relaunch")
  first.getState().savePosition({ learner: "a-model", seedCursor: 41, day: 7 })
  first.getState().recordAnswer(true)
  first.getState().recordAnswer(false)

  const second = createProgressStore("relaunch")
  assert.equal(second.getState().learner, "a-model")
  assert.equal(second.getState().day, 7)
  assert.equal(second.getState().seedCursor, 41)
  assert.equal(second.getState().answered, 2)
  assert.equal(second.getState().correct, 1)
})

test("totals only rise: no action lowers a count", () => {
  ephemeral.clear()
  const store = createProgressStore("monotone")
  store.getState().savePosition({ learner: "a-model", seedCursor: 9, day: 1 })
  for (let i = 0; i < 5; i++) store.getState().recordAnswer(false)
  assert.equal(store.getState().answered, 5)
  assert.equal(store.getState().correct, 0)
  assert.equal(store.getState().learner, "a-model", "a run of wrong answers cleared the model")
})

test("diagnoses are counted, and only as ids", () => {
  ephemeral.clear()
  const store = createProgressStore("bugs")
  store.getState().countBug("mis.add.borrow-across-zero")
  store.getState().countBug("mis.add.borrow-across-zero")
  store.getState().countBug("mis.add.smaller-from-larger")
  assert.deepEqual(store.getState().bugs, {
    "mis.add.borrow-across-zero": 2,
    "mis.add.smaller-from-larger": 1,
  })
})

test("a fresh profile starts at the bottom of the ladder", () => {
  ephemeral.clear()
  const store = createProgressStore(DEFAULT_PROFILE_ID)
  assert.equal(store.getState().learner, INITIAL_PROGRESS.learner)
  assert.equal(store.getState().seedCursor, 0)
})
