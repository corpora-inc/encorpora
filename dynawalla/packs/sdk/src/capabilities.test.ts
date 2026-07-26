import { test } from "node:test"
import assert from "node:assert/strict"

import {
  CAPABILITIES,
  CAPABILITY_IDS,
  METHODS,
  SESSION_METHODS,
  capabilityOf,
  isCapability,
  isMethod,
  labelOf,
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
