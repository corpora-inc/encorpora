// Tests for the shared single-flight map (offline-cache.md §3.4): N
// concurrent callers for one key share exactly one run; settlement (resolve
// OR reject) releases the slot; distinct keys never serialize.

import { test, beforeEach } from "node:test"
import assert from "node:assert/strict"

import { singleflight, isInFlight, __resetSingleflightForTests } from "./singleflight.ts"

beforeEach(() => {
  __resetSingleflightForTests()
})

test("N concurrent callers for one key -> exactly one run, shared result", async () => {
  let runs = 0
  let release: (v: string) => void = () => {}
  const gate = new Promise<string>((r) => {
    release = r
  })
  const run = () => {
    runs += 1
    return gate
  }

  const callers = [
    singleflight("k", run),
    singleflight("k", run),
    singleflight("k", run),
  ]
  assert.equal(runs, 1, "only the first caller starts a run")
  assert.equal(isInFlight("k"), true)

  release("payload")
  const results = await Promise.all(callers)
  assert.deepEqual(results, ["payload", "payload", "payload"])
})

test("settlement releases the slot -> a later call runs again", async () => {
  let runs = 0
  await singleflight("k", async () => {
    runs += 1
    return runs
  })
  assert.equal(isInFlight("k"), false, "slot released after resolve")
  const second = await singleflight("k", async () => {
    runs += 1
    return runs
  })
  assert.equal(runs, 2)
  assert.equal(second, 2)
})

test("rejection is shared by concurrent callers AND releases the slot", async () => {
  let runs = 0
  const failing = () => {
    runs += 1
    return Promise.reject(new Error("boom"))
  }
  const a = singleflight("k", failing)
  const b = singleflight("k", failing)
  await assert.rejects(a, /boom/)
  await assert.rejects(b, /boom/)
  assert.equal(runs, 1, "concurrent callers shared the failing run")
  assert.equal(isInFlight("k"), false, "failed slot released — retry possible")

  const recovered = await singleflight("k", async () => "recovered")
  assert.equal(recovered, "recovered")
})

test("distinct keys don't serialize", async () => {
  const order: string[] = []
  let releaseA: () => void = () => {}
  const gateA = new Promise<void>((r) => {
    releaseA = r
  })

  const a = singleflight("a", async () => {
    await gateA
    order.push("a")
  })
  const b = singleflight("b", async () => {
    order.push("b")
  })

  await b // b completes while a is still blocked
  assert.deepEqual(order, ["b"])
  releaseA()
  await a
  assert.deepEqual(order, ["b", "a"])
})

test("a throwing (synchronous) run still settles + releases", async () => {
  await assert.rejects(
    singleflight("k", () => {
      throw new Error("sync-boom")
    }),
    /sync-boom/,
  )
  assert.equal(isInFlight("k"), false)
})
