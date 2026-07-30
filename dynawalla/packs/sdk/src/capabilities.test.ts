import { test } from "node:test"
import assert from "node:assert/strict"

import {
  CAPABILITIES,
  CAPABILITY_IDS,
  METHODS,
  NATIVE_CAPABILITIES,
  SESSION_BUDGET_MS,
  SESSION_METHODS,
  STREAM_METHODS,
  budgetOf,
  capabilityOf,
  isCapability,
  isMethod,
  isNativeBacked,
  labelOf,
  opensStream,
  permits,
} from "./capabilities.ts"
import type { Method } from "./capabilities.ts"

test("every method belongs to exactly one capability, or to the session", () => {
  // The property that makes `permits` a complete gate. A method reachable from
  // no capability would be callable by every pack; a method in two would make
  // "which grant does this need" ambiguous at the install sheet.
  const owners = new Map<string, string[]>()
  for (const entry of CAPABILITIES) {
    for (const method of entry.methods) {
      owners.set(method, [...(owners.get(method) ?? []), entry.id])
    }
  }
  for (const [method, list] of owners) {
    assert.equal(list.length, 1, `${method} is owned by ${list.join(" and ")}`)
  }
  for (const method of METHODS) {
    const session = (SESSION_METHODS as readonly string[]).includes(method)
    assert.ok(session !== owners.has(method), `${method} is both a session method and a grant`)
  }
})

test("no method name is duplicated across the whole surface", () => {
  assert.equal(new Set(METHODS).size, METHODS.length)
})

test("an ungranted method is refused, one capability at a time", () => {
  for (const entry of CAPABILITIES) {
    const others = CAPABILITY_IDS.filter((id) => id !== entry.id)
    for (const method of entry.methods) {
      assert.equal(permits([entry.id], method), true, `${entry.id} should permit ${method}`)
      assert.equal(permits(others, method), false, `${method} passed without ${entry.id}`)
      assert.equal(permits([], method), false, `${method} passed with no grants at all`)
    }
  }
})

test("session methods need no grant and nothing else does", () => {
  for (const method of SESSION_METHODS) {
    assert.equal(permits([], method), true)
    assert.equal(capabilityOf(method), null)
  }
  for (const entry of CAPABILITIES) {
    for (const method of entry.methods) assert.equal(capabilityOf(method), entry.id)
  }
})

test("a method that is not a method is not a method", () => {
  for (const value of ["items.eval", "", "__proto__", "toString", null, 7, {}, ["items.next"]]) {
    assert.equal(isMethod(value), false, `${JSON.stringify(value)} was accepted`)
    assert.equal(permits(CAPABILITY_IDS, value as Method), false)
  }
  assert.equal(isMethod("items.next"), true)
})

test("a capability that is not a capability is not a capability", () => {
  for (const value of ["filesystem", "network", "", null, "__proto__"]) {
    assert.equal(isCapability(value), false)
  }
  for (const id of CAPABILITY_IDS) assert.equal(isCapability(id), true)
})

test("every capability has a sentence a parent can read", () => {
  for (const id of CAPABILITY_IDS) {
    const label = labelOf(id)
    assert.notEqual(label, id, `${id} has no parent-facing label`)
    assert.ok(label.length > 12 && label.length < 80, `${id}: ${label}`)
    assert.match(label, /^[A-Z]/)
    // No jargon a parent would have to look up.
    assert.doesNotMatch(label, /\b(API|IPC|capability|sandbox|IndexedDB)\b/i)
  }
})

test("reading the answer early is its own grant, separate from asking questions", () => {
  // A game that needs the key to place a target declares it; a game that does
  // not, cannot get it by declaring `items`.
  assert.equal(permits(["items"], "items.reveal"), false)
  assert.equal(permits(["items.reveal"], "items.reveal"), true)
})

test("nothing in the table grants the things a pack must never have", () => {
  const surface = JSON.stringify(CAPABILITIES).toLowerCase()
  for (const forbidden of ["fetch", "network", "http", "file", "exec", "invoke", "eval", "camera", "microphone", "location"]) {
    assert.ok(!surface.includes(forbidden), `the capability table mentions ${forbidden}`)
  }
})

test("every method has a budget, and it is a number a pack can wait out", () => {
  // Totality is the property that matters: the guest arms its deadline from
  // this, so a method with no budget is a method a pack waits on forever, which
  // is the failure this field exists to end. A `?? SESSION_BUDGET_MS` fallback
  // makes that unobservable at the call site, so it is checked here instead.
  for (const method of METHODS) {
    const budget = budgetOf(method)
    assert.equal(typeof budget, "number")
    assert.ok(Number.isFinite(budget) && budget > 0, `${method} has a budget of ${String(budget)}`)
    // A minute is not a budget, it is a hang with extra steps: nothing a child
    // is waiting on may be allowed to take that long.
    assert.ok(budget <= 30_000, `${method} may take ${String(budget)}ms`)
  }
  for (const method of SESSION_METHODS) {
    assert.equal(budgetOf(method), SESSION_BUDGET_MS)
  }
})

test("a native-backed capability is allowed longer than a local one", () => {
  // Not decoration. The whole reason `budgetMs` is per capability rather than
  // one constant is that an on-device model and a store read cannot share a
  // deadline, and a native capability that inherited the local budget would
  // time out on a device that was working correctly.
  const local = CAPABILITIES.filter((entry) => !entry.native)
  const native = CAPABILITIES.filter((entry) => entry.native)
  assert.ok(native.length > 0, "there is no native-backed capability to check")
  const slowestLocal = Math.max(...local.map((entry) => entry.budgetMs))
  for (const entry of native) {
    assert.ok(
      entry.budgetMs > slowestLocal,
      `${entry.id} has ${String(entry.budgetMs)}ms, no more than the slowest local ${String(slowestLocal)}ms`,
    )
  }
})

test("the native-backed list is derived from the table, not written twice", () => {
  // Widened deliberately: TypeScript infers a type predicate from
  // `(entry) => entry.native` and narrows the array to the one native row, which
  // would make `includes` below reject every other capability at compile time
  // instead of answering the question the test is asking.
  const fromTable: readonly string[] = CAPABILITIES.filter((entry) => entry.native).map(
    (entry) => entry.id,
  )
  assert.deepEqual([...NATIVE_CAPABILITIES], fromTable)
  for (const id of CAPABILITY_IDS) {
    assert.equal(isNativeBacked(id), fromTable.includes(id), `isNativeBacked disagrees about ${id}`)
  }
})

test("every streaming method is a real method, and needs a grant", () => {
  for (const method of STREAM_METHODS) {
    assert.equal(isMethod(method), true, `${method} is in STREAM_METHODS and is not a method`)
    assert.equal(opensStream(method), true)
    // A stream is a subscription to something outside the WebView. Nothing that
    // opens one may be a session method, or every pack would hold one whether
    // its manifest declared it or not.
    assert.notEqual(capabilityOf(method), null, `${method} opens a stream with no capability`)
  }
  for (const method of METHODS) {
    if ((STREAM_METHODS as readonly string[]).includes(method)) continue
    assert.equal(opensStream(method), false, `${method} claims to open a stream`)
  }
})

test("cancelling a stream is not a privilege", () => {
  // A pack that could not stop a stream is a pack that leaves a sensor running
  // after a child has left, and it could only be stopped by tearing the whole
  // session down. Ownership is structural instead: the host's stream table is
  // per pack, so a cancel can only ever reach a stream this pack opened.
  assert.equal(permits([], "stream.cancel"), true)
  assert.equal(capabilityOf("stream.cancel"), null)
})

test("the tilt capability grants a stream and nothing else", () => {
  assert.equal(permits(["sensors.orientation"], "sensors.orientation.start"), true)
  // Not reachable by declaring anything else, and in particular not by
  // declaring every other capability in the table.
  const others = CAPABILITY_IDS.filter((id) => id !== "sensors.orientation")
  assert.equal(permits(others, "sensors.orientation.start"), false)
  assert.equal(isNativeBacked("sensors.orientation"), true)
})
