import { test } from "node:test"
import assert from "node:assert/strict"

import {
  isConnect,
  isHostEvent,
  isResponse,
  numberParam,
  parseRequest,
  stringParam,
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
