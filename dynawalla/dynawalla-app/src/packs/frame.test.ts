// The isolation, asserted rather than described.
//
// `mountPack` takes its `document` and `window`, so the whole handshake runs in
// Node against a fake frame and a real `MessageChannel`. What cannot be tested
// here is the WebView's enforcement of the sandbox attribute — but the
// attribute itself is the entire boundary, and an edit that drops
// `allow-same-origin` back in would be invisible in every other test in this
// repository. This is the one that fails.

import { test } from "node:test"
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

function harness(granted: readonly Capability[] = ["items"]): Harness {
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

test("the frame is sandboxed without allow-same-origin — this is the boundary", () => {
  const test = harness()
  const sandbox = (test.frame["getAttribute"] as (n: string) => string | null)("sandbox")
  assert.equal(sandbox, "allow-scripts")
  assert.ok(!sandbox?.includes("allow-same-origin"), "the pack would share the app's origin")
  assert.ok(!sandbox?.includes("allow-top-navigation"), "a pack could replace the app")
  assert.ok(!sandbox?.includes("allow-popups"))
  test.mounted.dispose()
})

test("the frame asks for no device permissions and leaks no referrer", () => {
  const test = harness()
  const get = test.frame["getAttribute"] as (n: string) => string | null
  assert.equal(get("allow"), "", "a permissions-policy grant would reach the camera or the mic")
  assert.equal(get("referrerpolicy"), "no-referrer")
  test.mounted.dispose()
})

test("the pack is framed at the pack scheme and nothing else", () => {
  const test = harness()
  assert.match(String(test.frame["src"]), /^dynawalla-pack:\/\//)
  assert.equal(test.children.length, 1)
  test.mounted.dispose()
})

test("a ready from anywhere but this frame is ignored", () => {
  // `event.origin` is the string "null" for a sandboxed frame and authenticates
  // nothing. The frame identity is the only thing that can.
  const test = harness()
  test.fire({ source: { not: "our frame" }, data: { event: "ready" } })
  test.fire({ source: test.frame["contentWindow"], data: { event: "hello" } })
  test.fire({ source: test.frame["contentWindow"], data: null })
  assert.equal(test.mounted.connected(), false)
  assert.deepEqual(test.posted, [])
  test.mounted.dispose()
})

test("the handshake transfers exactly one port and states the grant set", () => {
  const test = harness(["items", "haptics"])
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

test("a second ready does not hand out a second port", () => {
  const test = harness()
  shake(test)
  shake(test)
  assert.equal(test.posted.length, 1)
  test.mounted.dispose()
})

test("traffic on the port reaches the bridge and comes back", async () => {
  const test = harness(["items"])
  shake(test)
  const packPort = test.posted[0]?.transfer[0]
  assert.ok(packPort)

  const replies: unknown[] = []
  packPort.onmessage = (event: MessageEvent) => replies.push(event.data)
  packPort.start()
  packPort.postMessage({ id: 1, method: "items.next", params: {} })
  // And something the pack was not granted, to prove the bridge is in the path.
  packPort.postMessage({ id: 2, method: "storage.get", params: { key: "k" } })

  await new Promise((resolve) => setTimeout(resolve, 20))
  assert.deepEqual(replies[0], { id: 1, ok: true, result: { item: null } })
  assert.deepEqual(replies[1], { id: 2, ok: false, error: { code: "denied", message: "storage.get was not granted to this pack" } })
  packPort.close()
  test.mounted.dispose()
})

test("host events only go out once a pack is connected", () => {
  const test = harness()
  test.mounted.send("pause")
  assert.deepEqual(test.posted, [], "an event was sent to a frame that had not connected")
  test.mounted.dispose()
})

test("dispose is idempotent, unhooks the listener and destroys the frame", () => {
  const test = harness()
  shake(test)
  assert.equal(test.listeners.get("message")?.size, 1)

  test.mounted.dispose()
  test.mounted.dispose()

  assert.equal(test.listeners.get("message")?.size, 0, "a message listener outlived the pack")
  assert.equal(test.removed, true, "the frame element was left in the document")
  assert.equal(test.frame["src"], "about:blank")
})

test("dispose before the handshake is safe, and the frame never connects afterwards", () => {
  const test = harness()
  test.mounted.dispose()
  shake(test)
  assert.equal(test.mounted.connected(), false)
  assert.deepEqual(test.posted, [])
})

test("mounting twice makes two independent packs — StrictMode does exactly this", () => {
  // Two Babylon engines in one console is the tell for the bug this prevents.
  // The contract is that disposing the first leaves the second untouched.
  const first = harness()
  const second = harness()
  shake(first)
  shake(second)
  first.mounted.dispose()

  assert.equal(second.mounted.connected(), true)
  assert.equal(second.removed, false)
  second.mounted.dispose()
})
