// The isolation, asserted rather than described.
//
// `mountPack` takes its `document` and `window`, so the whole handshake runs in
// Node against a fake frame and a real `MessageChannel`. What cannot be tested
// here is the WebView's enforcement of the sandbox attribute — but the
// attribute itself is the entire boundary, and an edit that drops
// `allow-same-origin` back in would be invisible in every other test in this
// repository. This is the one that fails.

import { test, type TestContext } from "node:test"
import assert from "node:assert/strict"

import { mountPack } from "./frame.ts"
import type { HostServices } from "./bridge.ts"
import type { Capability, Connect, Settings } from "../../../packs/sdk/src/index.ts"

const SETTINGS: Settings = {
  locale: "en",
  reducedMotion: false,
  quality: "high",
  textScale: 1,
  colorScheme: "light",
  sound: true,
  haptics: true,
}

const services = (): HostServices => ({
  nextItem: async () => null,
  judge: async () => ({ correct: true, canonical: "2203", advance: true }),
  skip: async () => {},
  reveal: async () => "2203",
  learnerSummary: async () => ({ skills: [] }),
  haptic: async () => {},
  sound: async () => {},
  milestone: async () => {},
  storage: {
    get: async () => null,
    set: async () => {},
    remove: async () => {},
    keys: async () => [],
  },
  progress: () => {},
  end: () => {},
  transition: () => {},
  settings: () => SETTINGS,
})

type Posted = { data: unknown; targetOrigin: string; transfer: readonly MessagePort[] }

type Harness = {
  mounted: ReturnType<typeof mountPack>
  frame: Record<string, unknown>
  posted: Posted[]
  children: unknown[]
  listeners: Map<string, Set<(event: unknown) => void>>
  removed: boolean
  fire(event: { source: unknown; data: unknown }): void
}

/**
 * Mount a pack against a fake frame.
 *
 * Takes the test context so teardown can be registered as an `after` hook
 * rather than trailing the assertions. A `mountPack` holds a live
 * `MessageChannel`, and an open port is a handle: if an assertion throws before
 * the `dispose()` at the foot of a test, the port is never closed, node's event
 * loop never drains and the process never exits. That is not a slow test, it is
 * a hung job — one flake here cost fifteen minutes of runner time and a
 * merge-queue slot on a suite that finishes in twenty seconds.
 *
 * `dispose()` is idempotent (there is a test for it), so tests may still call it
 * themselves where the call is the thing being asserted.
 */
function harness(t: TestContext, granted: readonly Capability[] = ["items"]): Harness {
  const posted: Posted[] = []
  const children: unknown[] = []
  const listeners = new Map<string, Set<(event: unknown) => void>>()
  const attributes = new Map<string, string>()
  const state = { removed: false }

  const contentWindow = {
    postMessage: (data: unknown, targetOrigin: string, transfer: readonly MessagePort[] = []) => {
      posted.push({ data, targetOrigin, transfer })
    },
  }

  const frame: Record<string, unknown> = {
    contentWindow,
    setAttribute: (name: string, value: string) => attributes.set(name, value),
    getAttribute: (name: string) => attributes.get(name) ?? null,
    addEventListener: () => {},
    remove: () => {
      state.removed = true
    },
  }

  const doc = { createElement: () => frame } as unknown as Document
  const win = {
    addEventListener: (type: string, listener: (event: unknown) => void) => {
      const set = listeners.get(type) ?? new Set()
      set.add(listener)
      listeners.set(type, set)
    },
    removeEventListener: (type: string, listener: (event: unknown) => void) => {
      listeners.get(type)?.delete(listener)
    },
  } as unknown as Window

  const container = {
    appendChild: (child: unknown) => children.push(child),
  } as unknown as HTMLElement

  const mounted = mountPack({
    container,
    packId: "abacus.tower",
    entryUrl: "dynawalla-pack://localhost/abacus.tower/index.html",
    granted,
    services: services(),
    hostVersion: "0.4.0",
    title: "Abacus Tower",
    document: doc,
    window: win,
  })
  t.after(() => mounted.dispose())

  return {
    mounted,
    frame,
    posted,
    children,
    listeners,
    get removed() {
      return state.removed
    },
    fire: (event) => {
      for (const listener of [...(listeners.get("message") ?? [])]) listener(event)
    },
  }
}

const shake = (test: Harness) => test.fire({ source: test.frame["contentWindow"], data: { event: "ready" } })

/**
 * Wait for a condition, not for a duration.
 *
 * A fixed sleep is a bet that a two-core CI runner schedules a `MessageChannel`
 * round trip as fast as this laptop does, and it is a bet that is only ever
 * settled in one direction: too short and the suite fails for no reason, too
 * long and every green run pays for it. Polling costs a few milliseconds in the
 * normal case and tolerates a contended runner.
 */
async function until(done: () => boolean, ms = 2000): Promise<void> {
  const deadline = Date.now() + ms
  while (!done() && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
}

test("the frame is sandboxed without allow-same-origin — this is the boundary", (t) => {
  const test = harness(t)
  const sandbox = (test.frame["getAttribute"] as (n: string) => string | null)("sandbox")
  assert.equal(sandbox, "allow-scripts")
  assert.ok(!sandbox?.includes("allow-same-origin"), "the pack would share the app's origin")
  assert.ok(!sandbox?.includes("allow-top-navigation"), "a pack could replace the app")
  assert.ok(!sandbox?.includes("allow-popups"))
  test.mounted.dispose()
})

test("the frame asks for no device permissions and leaks no referrer", (t) => {
  const test = harness(t)
  const get = test.frame["getAttribute"] as (n: string) => string | null
  assert.equal(get("allow"), "", "a permissions-policy grant would reach the camera or the mic")
  assert.equal(get("referrerpolicy"), "no-referrer")
  test.mounted.dispose()
})

test("the pack is framed at the pack scheme and nothing else", (t) => {
  const test = harness(t)
  assert.match(String(test.frame["src"]), /^dynawalla-pack:\/\//)
  assert.equal(test.children.length, 1)
  test.mounted.dispose()
})

test("a ready from anywhere but this frame is ignored", (t) => {
  // `event.origin` is the string "null" for a sandboxed frame and authenticates
  // nothing. The frame identity is the only thing that can.
  const test = harness(t)
  test.fire({ source: { not: "our frame" }, data: { event: "ready" } })
  test.fire({ source: test.frame["contentWindow"], data: { event: "hello" } })
  test.fire({ source: test.frame["contentWindow"], data: null })
  assert.equal(test.mounted.connected(), false)
  assert.deepEqual(test.posted, [])
  test.mounted.dispose()
})

test("the handshake transfers exactly one port and states the grant set", (t) => {
  const test = harness(t, ["items", "haptics"])
  shake(test)
  assert.equal(test.mounted.connected(), true)
  assert.equal(test.posted.length, 1)

  const message = test.posted[0]
  assert.equal(message?.transfer.length, 1, "the port IS the grant")
  // An opaque origin cannot be named, so the payload must carry no secret.
  assert.equal(message?.targetOrigin, "*")

  const connect = message?.data as Connect
  assert.equal(connect.event, "connect")
  assert.equal(connect.packId, "abacus.tower")
  assert.equal(connect.host, "0.4.0")
  assert.deepEqual(connect.granted, ["items", "haptics"])
  assert.deepEqual(connect.settings, SETTINGS)
  test.mounted.dispose()
})

test("a second ready does not hand out a second port", (t) => {
  const test = harness(t)
  shake(test)
  shake(test)
  assert.equal(test.posted.length, 1)
  test.mounted.dispose()
})

test("traffic on the port reaches the bridge and comes back", async (t) => {
  const test = harness(t, ["items"])
  shake(test)
  const packPort = test.posted[0]?.transfer[0]
  assert.ok(packPort)
  t.after(() => packPort.close())

  const replies: unknown[] = []
  packPort.onmessage = (event: MessageEvent) => replies.push(event.data)
  packPort.start()
  packPort.postMessage({ id: 1, method: "items.next", params: {} })
  // And something the pack was not granted, to prove the bridge is in the path.
  packPort.postMessage({ id: 2, method: "storage.get", params: { key: "k" } })

  await until(() => replies.length >= 2)
  assert.deepEqual(replies[0], { id: 1, ok: true, result: { item: null } })
  assert.deepEqual(replies[1], { id: 2, ok: false, error: { code: "denied", message: "storage.get was not granted to this pack" } })
})

test("host events only go out once a pack is connected", (t) => {
  const test = harness(t)
  test.mounted.send("pause")
  assert.deepEqual(test.posted, [], "an event was sent to a frame that had not connected")
  test.mounted.dispose()
})

test("dispose is idempotent, unhooks the listener and destroys the frame", (t) => {
  const test = harness(t)
  shake(test)
  assert.equal(test.listeners.get("message")?.size, 1)

  test.mounted.dispose()
  test.mounted.dispose()

  assert.equal(test.listeners.get("message")?.size, 0, "a message listener outlived the pack")
  assert.equal(test.removed, true, "the frame element was left in the document")
  assert.equal(test.frame["src"], "about:blank")
})

test("dispose before the handshake is safe, and the frame never connects afterwards", (t) => {
  const test = harness(t)
  test.mounted.dispose()
  shake(test)
  assert.equal(test.mounted.connected(), false)
  assert.deepEqual(test.posted, [])
})

test("mounting twice makes two independent packs — StrictMode does exactly this", (t) => {
  // Two Babylon engines in one console is the tell for the bug this prevents.
  // The contract is that disposing the first leaves the second untouched.
  const first = harness(t)
  const second = harness(t)
  shake(first)
  shake(second)
  first.mounted.dispose()

  assert.equal(second.mounted.connected(), true)
  assert.equal(second.removed, false)
  second.mounted.dispose()
})
