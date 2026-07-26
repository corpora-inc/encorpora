// The guest client, driven over a real `MessageChannel`.
//
// Node has `MessageChannel` and `MessagePort`, so the only thing stubbed here
// is the frame relationship — `window.parent` and one `postMessage`. Everything
// the pack actually talks over is the real transport, which is what makes this
// a test of the handshake rather than of a mock.

import { test } from "node:test"
import assert from "node:assert/strict"

import { connect, PackError } from "./guest.ts"
import type { HostClient } from "./guest.ts"
import type { Request, Response } from "./protocol.ts"

type Listener = (event: { data: unknown; ports: readonly MessagePort[] }) => void

type Frame = {
  client: Promise<HostClient>
  /** Requests the fake host received, in order. */
  seen: Request[]
  /** The host's end of the port, for pushing events at the pack. */
  hostPort: MessagePort
}

/** Stand up a fake frame, then answer its `ready` the way the host does. */
function withFakeFrame(
  options: {
    granted?: string[]
    /** Answers one request. Return `undefined` to leave it pending. */
    answer?: (request: Request) => Omit<Response, "id"> | undefined
    framed?: boolean
  } = {},
): Frame {
  const listeners = new Set<Listener>()
  const seen: Request[] = []
  const channel = new MessageChannel()

  const postMessage = (data: unknown) => {
    // This is the pack's `ready`. The host answers by transferring a port.
    if ((data as { event?: string }).event !== "ready") return
    queueMicrotask(() => {
      for (const listener of [...listeners]) {
        listener({
          data: {
            event: "connect",
            protocol: 1,
            sdk: "1.0.0",
            host: "0.1.0",
            packId: "abacus.tower",
            granted: options.granted ?? ["items", "storage"],
            settings: {
              locale: "en",
              reducedMotion: false,
              quality: "high",
              textScale: 1,
              colorScheme: "light",
              sound: true,
              haptics: true,
            },
          },
          ports: [channel.port2],
        })
      }
    })
  }

  const fakeWindow: Record<string, unknown> = {
    addEventListener: (_type: string, listener: Listener) => listeners.add(listener),
    removeEventListener: (_type: string, listener: Listener) => listeners.delete(listener),
    postMessage,
  }
  fakeWindow["parent"] = options.framed === false ? fakeWindow : { postMessage }
  ;(globalThis as { window?: unknown }).window = fakeWindow

  channel.port1.onmessage = (event: MessageEvent) => {
    const request = event.data as Request
    seen.push(request)
    const reply = options.answer?.(request)
    if (reply !== undefined) channel.port1.postMessage({ id: request.id, ...reply })
  }
  channel.port1.start()

  open.push(channel.port1, channel.port2)
  return { client: connect({ timeoutMs: 500 }), seen, hostPort: channel.port1 }
}

/**
 * Ports opened by a test. A live `MessagePort` is a ref'd handle: leaving one
 * open holds the event loop open and the whole run hangs after the last
 * assertion passes, which looks exactly like a failing test and is not one.
 */
const open: MessagePort[] = []

const cleanup = () => {
  delete (globalThis as { window?: unknown }).window
  for (const port of open.splice(0)) port.close()
}

const ok = (result: unknown) => ({ ok: true as const, result })

test("the handshake completes and the grant set arrives with it", async (t) => {
  t.after(cleanup)
  const { client } = withFakeFrame({ granted: ["items"] })
  const host = await client
  assert.equal(host.packId, "abacus.tower")
  assert.equal(host.hostVersion, "0.1.0")
  assert.deepEqual(host.granted, ["items"])
  assert.equal(host.settings.locale, "en")
  assert.equal(host.can("items.next"), true)
  assert.equal(host.can("storage.get"), false)
  host.dispose()
})

test("an ungranted call fails locally, without reaching the host", async (t) => {
  t.after(cleanup)
  const { client, seen } = withFakeFrame({ granted: ["items"] })
  const host = await client
  await assert.rejects(
    () => host.storage.get("k"),
    (error: unknown) => error instanceof PackError && error.code === "denied",
  )
  // The point: the host never had to refuse it, so a denial costs no round trip
  // and a pack cannot probe what a parent declined by timing the answer.
  assert.deepEqual(seen, [])
  host.dispose()
})

test("a call round-trips and returns the host's result", async (t) => {
  t.after(cleanup)
  const item = {
    id: "i1",
    skillId: "add.1",
    level: 1,
    form: "binary-op",
    operands: ["2", "3"],
    prompt: "2 plus 3",
    answerKind: "integer",
  }
  const { client, seen } = withFakeFrame({
    answer: (request) => (request.method === "items.next" ? ok({ item }) : ok({})),
  })
  const host = await client
  assert.deepEqual(await host.nextItem({ skillId: "add.1" }), item)
  assert.deepEqual(seen[0], { id: 1, method: "items.next", params: { skillId: "add.1" } })
  host.dispose()
})

test("no item is null, not an error — a pack renders a finished session", async (t) => {
  t.after(cleanup)
  const { client } = withFakeFrame({ answer: () => ok({ item: null }) })
  const host = await client
  assert.equal(await host.nextItem(), null)
  host.dispose()
})

test("an error response becomes a PackError carrying the host's code", async (t) => {
  t.after(cleanup)
  const { client } = withFakeFrame({
    answer: () => ({ ok: false as const, error: { code: "rate_limited" as const, message: "slow down" } }),
  })
  const host = await client
  await assert.rejects(
    () => host.nextItem(),
    (error: unknown) =>
      error instanceof PackError && error.code === "rate_limited" && error.message === "slow down",
  )
  host.dispose()
})

test("answering reports the attempt and gets the canonical value back", async (t) => {
  t.after(cleanup)
  const { client, seen } = withFakeFrame({
    answer: () =>
      ok({ correct: false, canonical: "2203", diagnosis: "smaller-from-larger", advance: true }),
  })
  const host = await client
  const judgement = await host.answer({
    itemId: "i1",
    response: "3797",
    latencyMs: 4200,
    revisions: 1,
  })
  assert.equal(judgement.correct, false)
  // 5001 − 2798 = 2203. 3797 is smaller-from-larger, and the host is the only
  // thing that gets to say so.
  assert.equal(judgement.canonical, "2203")
  assert.equal(judgement.diagnosis, "smaller-from-larger")
  assert.deepEqual(seen[0]?.params, {
    itemId: "i1",
    response: "3797",
    latencyMs: 4200,
    revisions: 1,
  })
  host.dispose()
})

test("revisions default to zero rather than to undefined on the wire", async (t) => {
  t.after(cleanup)
  const { client, seen } = withFakeFrame({ answer: () => ok({}) })
  const host = await client
  await host.answer({ itemId: "i1", response: "5", latencyMs: 100 })
  assert.equal((seen[0]?.params as { revisions: number }).revisions, 0)
  host.dispose()
})

test("host events reach listeners, and settings follow the host", async (t) => {
  t.after(cleanup)
  const { client, hostPort } = withFakeFrame()
  const host = await client

  const paused: unknown[] = []
  const off = host.on("pause", (data) => paused.push(data ?? "paused"))
  hostPort.postMessage({ event: "pause" })
  await new Promise((resolve) => setTimeout(resolve, 10))
  assert.deepEqual(paused, ["paused"])

  off()
  hostPort.postMessage({ event: "pause" })
  await new Promise((resolve) => setTimeout(resolve, 10))
  assert.equal(paused.length, 1, "unsubscribing unsubscribed")

  hostPort.postMessage({
    event: "settings",
    data: { ...host.settings, reducedMotion: true, quality: "low" },
  })
  await new Promise((resolve) => setTimeout(resolve, 10))
  assert.equal(host.settings.reducedMotion, true)
  assert.equal(host.settings.quality, "low")
  host.dispose()
})

test("a dispose event from the host closes the client", async (t) => {
  t.after(cleanup)
  const { client, hostPort } = withFakeFrame()
  const host = await client
  hostPort.postMessage({ event: "dispose" })
  await new Promise((resolve) => setTimeout(resolve, 10))
  await assert.rejects(
    () => host.nextItem(),
    (error: unknown) => error instanceof PackError && error.code === "closed",
  )
})

test("closing rejects everything still in flight instead of leaking it", async (t) => {
  t.after(cleanup)
  const { client } = withFakeFrame({ answer: () => undefined })
  const host = await client
  const pending = host.nextItem()
  host.dispose()
  await assert.rejects(
    () => pending,
    (error: unknown) => error instanceof PackError && error.code === "closed",
  )
})

test("a document that is not framed says so instead of hanging", async (t) => {
  t.after(cleanup)
  const { client } = withFakeFrame({ framed: false })
  await assert.rejects(
    () => client,
    (error: unknown) => error instanceof PackError && error.code === "no_host",
  )
})

test("no host at all times out with a reason", async (t) => {
  t.after(cleanup)
  const listeners = new Set<Listener>()
  ;(globalThis as { window?: unknown }).window = {
    addEventListener: (_type: string, listener: Listener) => listeners.add(listener),
    removeEventListener: (_type: string, listener: Listener) => listeners.delete(listener),
    postMessage: () => {},
    parent: { postMessage: () => {} },
  }
  await assert.rejects(
    () => connect({ timeoutMs: 20 }),
    (error: unknown) => error instanceof PackError && error.code === "timeout",
  )
})

test("after dispose, every call fails closed and dispose is idempotent", async (t) => {
  t.after(cleanup)
  const { client } = withFakeFrame({ answer: () => ok({}) })
  const host = await client
  host.dispose()
  host.dispose()
  await assert.rejects(
    () => host.nextItem(),
    (error: unknown) => error instanceof PackError && error.code === "closed",
  )
})
