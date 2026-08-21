import { test } from "node:test"
import assert from "node:assert/strict"

import {
  isConnect,
  isHostEvent,
  isOrientation,
  isResponse,
  isStreamEnd,
  isStreamUpdate,
  numberParam,
  parseRequest,
  stringParam,
  unitParam,
} from "./protocol.ts"

test("a well-formed request parses and carries an object of params", () => {
  const parsed = parseRequest({ id: 3, method: "items.next", params: { skillId: "add.1" } })
  assert.equal(parsed.ok, true)
  if (!parsed.ok) return
  assert.equal(parsed.request.id, 3)
  assert.equal(parsed.request.method, "items.next")
  assert.deepEqual(parsed.request.params, { skillId: "add.1" })
})

test("missing params become an empty object rather than undefined", () => {
  const parsed = parseRequest({ id: 0, method: "session.end" })
  assert.equal(parsed.ok, true)
  if (!parsed.ok) return
  assert.deepEqual(parsed.request.params, {})
})

test("an unknown method is unknown_method, not invalid_params", () => {
  // The distinction matters: one is a pack built against a newer SDK, which the
  // host can tell a parent about; the other is a bug in the pack.
  const parsed = parseRequest({ id: 1, method: "items.eval" })
  assert.equal(parsed.ok, false)
  if (parsed.ok) return
  assert.equal(parsed.code, "unknown_method")
})

test("everything that is not a request is rejected", () => {
  const bad: unknown[] = [
    null,
    undefined,
    7,
    "items.next",
    [],
    {},
    { id: 1 },
    { method: "items.next" },
    { id: -1, method: "items.next" },
    { id: 1.5, method: "items.next" },
    { id: Number.MAX_SAFE_INTEGER + 2, method: "items.next" },
    { id: "1", method: "items.next" },
    { id: 1, method: "items.next", params: [] },
    { id: 1, method: "items.next", params: "x" },
  ]
  for (const value of bad) {
    assert.equal(parseRequest(value).ok, false, `${JSON.stringify(value)} parsed`)
  }
})

test("a prototype-polluting payload is just data", () => {
  // Structured clone will not carry a prototype across, but the guard should
  // not depend on that: `params` is read with bracket access and never spread
  // onto anything the host owns.
  const parsed = parseRequest(JSON.parse('{"id":1,"method":"storage.set","params":{"__proto__":{"x":1},"key":"k","value":"v"}}'))
  assert.equal(parsed.ok, true)
  if (!parsed.ok) return
  assert.equal(stringParam(parsed.request.params, "key"), "k")
  assert.equal(({} as Record<string, unknown>)["x"], undefined)
})

test("string parameters are present, non-empty and bounded", () => {
  assert.equal(stringParam({ k: "v" }, "k"), "v")
  assert.equal(stringParam({ k: "" }, "k"), null)
  assert.equal(stringParam({ k: "x".repeat(257) }, "k"), null)
  assert.equal(stringParam({ k: "x".repeat(257) }, "k", 300), "x".repeat(257))
  assert.equal(stringParam({}, "k"), null)
  assert.equal(stringParam({ k: 7 }, "k"), null)
  assert.equal(stringParam({ k: null }, "k"), null)
})

test("number parameters clamp rather than reject, but refuse nonsense", () => {
  assert.equal(numberParam({ n: 5 }, "n", 10), 5)
  assert.equal(numberParam({ n: 50 }, "n", 10), 10, "a long latency is clamped, not an error")
  assert.equal(numberParam({ n: -1 }, "n", 10), null)
  assert.equal(numberParam({ n: Number.NaN }, "n", 10), null)
  assert.equal(numberParam({ n: Number.POSITIVE_INFINITY }, "n", 10), null)
  assert.equal(numberParam({ n: "5" }, "n", 10), null)
})

test("a unit parameter clamps at both ends, and absent means absent", () => {
  assert.equal(unitParam({ d: 0.25 }, "d"), 0.25)
  assert.equal(unitParam({ d: 0 }, "d"), 0)
  assert.equal(unitParam({ d: 1 }, "d"), 1)
  // Both ends clamp. `numberParam(_, _, 1)` returns null for a negative, which
  // at a call site that reads null as "absent" turns an out-of-range request
  // into no request at all — silently. A number is a number.
  assert.equal(unitParam({ d: 1.4 }, "d"), 1)
  assert.equal(unitParam({ d: -0.5 }, "d"), 0)
  assert.equal(numberParam({ d: -0.5 }, "d", 1), null, "the guard this one exists to replace")
  // Only a non-number is absent.
  assert.equal(unitParam({ d: "0.5" }, "d"), null)
  assert.equal(unitParam({ d: Number.NaN }, "d"), null)
  assert.equal(unitParam({}, "d"), null)
})

test("the guards a pack uses on host traffic are equally exact", () => {
  assert.equal(isResponse({ id: 1, ok: true, result: null }), true)
  assert.equal(isResponse({ id: 1, ok: false, error: { code: "denied", message: "" } }), true)
  assert.equal(isResponse({ id: 1, ok: false }), false)
  assert.equal(isResponse({ ok: true, result: 1 }), false)
  assert.equal(isResponse(null), false)

  assert.equal(isHostEvent({ event: "pause" }), true)
  assert.equal(isHostEvent({ event: "settings", data: {} }), true)
  assert.equal(isHostEvent({ event: "connect" }), false)
  assert.equal(isHostEvent({ event: "destroy" }), false)

  const connect = {
    event: "connect",
    protocol: 1,
    sdk: "1.0.0",
    host: "0.1.0",
    packId: "abacus.tower",
    granted: ["items"],
    settings: {},
  }
  assert.equal(isConnect(connect), true)
  assert.equal(isConnect({ ...connect, granted: "items" }), false)
  assert.equal(isConnect({ ...connect, event: "ready" }), false)
})

test("the three host-to-pack envelopes are told apart by shape alone", () => {
  // The property the guest's demultiplexer depends on. If any two of these
  // could match the same message, a sensor sample would resolve a promise or a
  // response would be fed to a game as a sample — both silent.
  const update = { stream: 7, seq: 1, data: { x: 0, y: 0, degrees: { x: 0, y: 0 } } }
  const end = { stream: 7, done: true, reason: "cancelled" }
  const response = { id: 7, ok: true, result: null }
  const event = { event: "pause" }

  assert.equal(isStreamUpdate(update), true)
  assert.equal(isStreamEnd(update), false)
  assert.equal(isResponse(update), false)
  assert.equal(isHostEvent(update), false)

  assert.equal(isStreamEnd(end), true)
  assert.equal(isStreamUpdate(end), false, "an end must not also read as an update")
  // And an envelope carrying BOTH is an end, not an update. This is the case the
  // `done` check in `isStreamUpdate` exists for: an end has no `seq`, so without
  // one that carries a `seq` the check is unreachable and would have been deleted
  // by anyone measuring it. A message that is both would otherwise be dispatched
  // to a game as a sample and never end the stream.
  assert.equal(isStreamUpdate({ ...end, seq: 1 }), false, "a done envelope read as a sample")
  assert.equal(isStreamEnd({ ...end, seq: 1 }), true)
  assert.equal(isResponse(end), false)

  assert.equal(isResponse(response), true)
  assert.equal(isStreamUpdate(response), false)
  assert.equal(isStreamEnd(response), false)

  assert.equal(isHostEvent(event), true)
  assert.equal(isStreamUpdate(event), false)
  assert.equal(isStreamEnd(event), false)
})

test("a stream envelope that is not one is rejected", () => {
  for (const value of [
    null,
    7,
    [],
    {},
    { stream: 7 },
    { stream: 7, seq: 0 },
    { stream: 7, seq: -1 },
    { stream: 7, seq: 1.5 },
    { stream: -1, seq: 1 },
    { stream: 1.5, seq: 1 },
    { stream: "7", seq: 1 },
  ]) {
    assert.equal(isStreamUpdate(value), false, `${JSON.stringify(value)} parsed as an update`)
  }
  for (const value of [
    { stream: 7, done: true },
    { stream: 7, done: true, reason: "bored" },
    { stream: 7, done: false, reason: "cancelled" },
    { stream: 7, reason: "cancelled" },
    { done: true, reason: "cancelled" },
  ]) {
    assert.equal(isStreamEnd(value), false, `${JSON.stringify(value)} parsed as an end`)
  }
  // Every reason the contract names is accepted, so the guard cannot drift from
  // the union by somebody adding one to the type and not to the list.
  for (const reason of ["complete", "cancelled", "unavailable", "closed", "internal"]) {
    assert.equal(isStreamEnd({ stream: 0, done: true, reason }), true, reason)
  }
})

test("a tilt sample must be finite and in range, or it is not a sample", () => {
  assert.equal(isOrientation({ x: 0, y: 0, degrees: { x: 0, y: 0 } }), true)
  assert.equal(isOrientation({ x: -1, y: 1, degrees: { x: -25, y: 25 } }), true)
  // Every one of these would put a NaN or an out-of-range multiplier through a
  // game's steering, and none of them would throw.
  for (const value of [
    null,
    {},
    { x: 0, y: 0 },
    { x: Number.NaN, y: 0, degrees: { x: 0, y: 0 } },
    { x: 0, y: Number.POSITIVE_INFINITY, degrees: { x: 0, y: 0 } },
    { x: 1.5, y: 0, degrees: { x: 0, y: 0 } },
    { x: -1.5, y: 0, degrees: { x: 0, y: 0 } },
    { x: "0", y: 0, degrees: { x: 0, y: 0 } },
    { x: 0, y: 0, degrees: { x: Number.NaN, y: 0 } },
    { x: 0, y: 0, degrees: null },
  ]) {
    assert.equal(isOrientation(value), false, `${JSON.stringify(value)} passed as a tilt sample`)
  }
})

test("cancelling a stream is a request like any other", () => {
  const parsed = parseRequest({ id: 4, method: "stream.cancel", params: { stream: 7 } })
  assert.equal(parsed.ok, true)
  if (!parsed.ok) return
  assert.equal(parsed.request.method, "stream.cancel")
})

test("a connect without `available` is still a connect", () => {
  // The 1.0 host. A pack on one reads the absent field as "everything granted
  // works", which is exactly what it was already assuming, so an older host
  // must not fail the guard.
  const connect = {
    event: "connect",
    protocol: 1,
    sdk: "1.0.0",
    host: "0.1.0",
    packId: "abacus.tower",
    granted: ["items"],
    settings: {},
  }
  assert.equal(isConnect(connect), true)
  assert.equal(isConnect({ ...connect, available: ["items"] }), true)
})
