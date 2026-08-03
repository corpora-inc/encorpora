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
    /** What the device can actually do. Defaults to all of `granted`. */
    available?: string[]
    /** Omit `available` from the connect payload, the way a 1.0 host does. */
    legacyHost?: boolean
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
            ...(options.legacyHost
              ? {}
              : { available: options.available ?? options.granted ?? ["items", "storage"] }),
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

test("a difficulty request is on the wire, and only the fields that were named", async (t) => {
  t.after(cleanup)
  const item = {
    id: "i1",
    skillId: "add.1",
    level: 1,
    difficulty: 0.25,
    form: "binary-op",
    operands: ["2", "3"],
    prompt: "2 plus 3",
    answerKind: "integer",
  }
  const { client, seen } = withFakeFrame({
    answer: (request) => (request.method === "items.next" ? ok({ item }) : ok({})),
  })
  const host = await client

  // The whole point: a pack can say how hard it wants the next question, and
  // the ordinate it was actually served comes back on the item.
  // Both halves of the capability window travel, and the floor is asserted here
  // rather than assumed: a field the guest never packs is a field the host never
  // sees, every test on either side of the wire still passes, and the child gets
  // the empty screen the pack declared it was avoiding. That is TREBUCHET's bug
  // one layer further out.
  const served = await host.nextItem({
    difficulty: 0.25,
    maxDifficulty: 0.6,
    minDifficulty: 0.1,
  })
  assert.equal(served?.difficulty, 0.25)
  assert.deepEqual(seen[0], {
    id: 1,
    method: "items.next",
    params: { difficulty: 0.25, maxDifficulty: 0.6, minDifficulty: 0.1 },
  })

  // A field nobody named is absent rather than an explicit `undefined`: a
  // structured clone carries `undefined` across, and "present but not a
  // number" is a different thing at the host's guards from "absent".
  await host.nextItem()
  assert.deepEqual(seen[1], { id: 2, method: "items.next", params: {} })
  await host.nextItem({ skillId: "add.1" })
  assert.deepEqual(seen[2], { id: 3, method: "items.next", params: { skillId: "add.1" } })
  host.dispose()
})

test("connecting installs the tap guard on the pack document", async (t) => {
  // The one wire that makes this automatic. If `connect()` stops calling
  // `installTapZoomGuard`, twenty-seven packs silently get their double-tap
  // zoom back and every test in `tapzoom.test.ts` still passes.
  const bound: string[] = []
  const document = {
    addEventListener: (type: string) => {
      bound.push(type)
    },
    removeEventListener: () => {},
  }
  ;(globalThis as { document?: unknown }).document = document
  t.after(() => {
    delete (globalThis as { document?: unknown }).document
    cleanup()
  })

  const { client } = withFakeFrame()
  const host = await client
  assert.ok(bound.includes("touchend"), `no touchend guard on the pack document: ${bound.join(", ")}`)
  assert.ok(bound.includes("touchstart"))
  host.dispose()
})

/* ─── deadlines ──────────────────────────────────────────────────────────── */

test("a host that never answers times out, and the budget is the capability's own", async (t) => {
  t.after(cleanup)
  // Two failures in one test, because the second only means anything next to
  // the first.
  //
  // Before the deadline, a host that dropped a request left the pack holding a
  // promise that never settled: a game awaiting it sat on its loading state for
  // the rest of the session with nothing in any log. `answer: () => undefined`
  // is exactly that host.
  //
  // And a *single* global deadline would be wrong in both directions — it would
  // either give a store read ten seconds to fail in, or time out a working
  // sensor that had to ask a person for permission first. So the same silent
  // host is asked for both at once: `items.next` gives up at its 2s budget while
  // `sensors.orientation.start`, on 10s, is still waiting.
  const said: string[] = []
  const real = console.error
  console.error = (...args: unknown[]) => said.push(args.map(String).join(" "))
  t.after(() => {
    console.error = real
  })

  const { client } = withFakeFrame({
    granted: ["items", "sensors.orientation"],
    answer: () => undefined,
  })
  const host = await client

  const stop = host.tilt.start(() => {})
  const local = assert.rejects(
    () => host.nextItem(),
    (error: unknown) =>
      error instanceof PackError &&
      error.code === "timeout" &&
      // The message names the budget: "it timed out" without the number is a
      // line nobody can act on.
      /items\.next did not answer within 2000ms/.test(error.message),
  )
  const started = Date.now()
  await local
  const elapsed = Date.now() - started
  assert.ok(elapsed >= 1900, `items.next gave up after ${String(elapsed)}ms`)

  // 600ms past the local budget, and the native start has said nothing: it is
  // still on its own, longer deadline rather than on a shared one.
  await new Promise((resolve) => setTimeout(resolve, 600))
  assert.deepEqual(said, [], "the native start gave up on the local budget")
  stop()
  host.dispose()
})

test("a settled call disarms its deadline rather than leaving it armed", async (t) => {
  t.after(cleanup)
  // Measured, not read. The first version of this test asserted that `dispose`
  // returned quickly and passed perfectly with the `clearTimeout` deleted — the
  // leaked timers were real (the suite went from 2.6s to 13.2s, because node will
  // not exit while a timer is pending) and the assertion could not see one.
  //
  // `process.getActiveResourcesInfo()` can. A leaked deadline per call is a leak
  // per call, and in a real pack that is one live timer for every question a
  // child answers.
  const timers = () => process.getActiveResourcesInfo().filter((name) => name === "Timeout").length

  const { client } = withFakeFrame({ granted: ["items"], answer: () => ok({ item: null }) })
  const host = await client
  const before = timers()
  for (let index = 0; index < 8; index += 1) {
    assert.equal(await host.nextItem(), null)
  }
  assert.equal(
    timers(),
    before,
    "a settled call left its 2s deadline armed — eight calls, eight live timers",
  )
  host.dispose()
})

/* ─── absence ────────────────────────────────────────────────────────────── */

test("granted and available are different questions", async (t) => {
  t.after(cleanup)
  const { client } = withFakeFrame({
    granted: ["items", "sensors.orientation"],
    available: ["items"],
  })
  const host = await client
  // The pack declared it, the build implements it, so the method is not refused
  // — a pack cannot tell a declined permission from a missing sensor.
  assert.equal(host.can("sensors.orientation.start"), true)
  // But this device cannot do it, and that is the check a game reads before
  // drawing a control that would otherwise be a lie.
  assert.equal(host.available("sensors.orientation"), false)
  assert.equal(host.available("items"), true)
  assert.deepEqual([...host.usable], ["items"])
  assert.equal(host.tilt.available, false)
  host.dispose()
})

test("an older host that sends no `available` is read as everything working", async (t) => {
  t.after(cleanup)
  // A 1.0 host cannot send the field. Reading its absence as "nothing works"
  // would break every pack on it; reading it as "everything granted works" is
  // exactly what those packs were already assuming.
  const { client } = withFakeFrame({ granted: ["items", "storage"], legacyHost: true })
  const host = await client
  assert.equal(host.available("items"), true)
  assert.equal(host.available("storage"), true)
  assert.deepEqual([...host.usable], ["items", "storage"])
  host.dispose()
})

test("starting an unavailable capability is silent for a child and loud for a developer", async (t) => {
  t.after(cleanup)
  const said: string[] = []
  const real = console.error
  console.error = (...args: unknown[]) => said.push(args.map(String).join(" "))
  t.after(() => {
    console.error = real
  })

  const { client, seen } = withFakeFrame({
    granted: ["items", "sensors.orientation"],
    available: ["items"],
  })
  const host = await client

  const samples: unknown[] = []
  // Never throws and never rejects: absence is not an error path, so a game
  // needs no try/catch to be correct.
  const stop = host.tilt.start((sample) => samples.push(sample))
  await new Promise((resolve) => setTimeout(resolve, 20))

  assert.deepEqual(samples, [], "an unavailable capability delivered something")
  // And it cost no round trip, so a pack cannot probe what a device or a person
  // declined by timing the answer.
  assert.deepEqual(seen, [])
  // Stop is safe on a stream that never opened.
  stop()
  stop()

  assert.equal(said.length, 1, `expected one loud line, got ${String(said.length)}`)
  const line = said[0] ?? ""
  assert.match(line, /sensors\.orientation/)
  assert.match(line, /host\.available/, "the message does not say what to do about it")
  host.dispose()
})

test("calling an undeclared native capability says which manifest field is missing", async (t) => {
  t.after(cleanup)
  const said: string[] = []
  const real = console.error
  console.error = (...args: unknown[]) => said.push(args.map(String).join(" "))
  t.after(() => {
    console.error = real
  })

  const { client, seen } = withFakeFrame({ granted: ["items"] })
  const host = await client
  assert.equal(host.tilt.available, false)
  const samples: unknown[] = []
  host.tilt.start((sample) => samples.push(sample))
  await new Promise((resolve) => setTimeout(resolve, 20))

  assert.deepEqual(samples, [])
  assert.deepEqual(seen, [])
  assert.equal(said.length, 1)
  assert.match(said[0] ?? "", /manifest\.json/)
  host.dispose()
})

/* ─── streams ────────────────────────────────────────────────────────────── */

/** A sample the host would send. `degrees` is what a gauge reads. */
const sample = (x: number, y: number) => ({
  x,
  y,
  degrees: { x: x * 25, y: y * 25 },
})

test("a stream opens, delivers, and is cancelled by the stop function", async (t) => {
  t.after(cleanup)
  const { client, seen, hostPort } = withFakeFrame({
    granted: ["sensors.orientation"],
    answer: (request) =>
      request.method === "sensors.orientation.start" ? ok({ stream: request.id }) : ok(null),
  })
  const host = await client
  assert.equal(host.tilt.available, true)

  const samples: { x: number; y: number }[] = []
  const stop = host.tilt.start((value) => samples.push({ x: value.x, y: value.y }))
  await new Promise((resolve) => setTimeout(resolve, 20))

  const start = seen.find((request) => request.method === "sensors.orientation.start")
  assert.ok(start, "the start never reached the host")
  // The stream id IS the request id. No second namespace, and the pack already
  // held the number.
  hostPort.postMessage({ stream: start.id, seq: 1, data: sample(0.5, -0.25) })
  hostPort.postMessage({ stream: start.id, seq: 2, data: sample(-1, 1) })
  await new Promise((resolve) => setTimeout(resolve, 20))
  assert.deepEqual(samples, [
    { x: 0.5, y: -0.25 },
    { x: -1, y: 1 },
  ])

  stop()
  await new Promise((resolve) => setTimeout(resolve, 20))
  const cancel = seen.find((request) => request.method === "stream.cancel")
  assert.ok(cancel, "stopping did not tell the host")
  assert.deepEqual(cancel.params, { stream: start.id })

  // And nothing arrives after the stop, even if the host is still sending.
  hostPort.postMessage({ stream: start.id, seq: 3, data: sample(1, 1) })
  await new Promise((resolve) => setTimeout(resolve, 20))
  assert.equal(samples.length, 2)
  host.dispose()
})

test("stopping before the host has answered still cancels the stream it opened", async (t) => {
  t.after(cleanup)
  // The leak this prevents: a child leaves during the round trip, the pack's
  // stop runs before there is a handle to cancel, and the host is left feeding a
  // sensor to a stream nobody is reading.
  // A holder rather than a `let`: assigned inside a callback, so TypeScript's
  // control-flow analysis still believes the variable is `null` at the assertion
  // below and narrows it to `never`.
  const held: { release: (() => void) | null } = { release: null }
  const { client, seen, hostPort } = withFakeFrame({
    granted: ["sensors.orientation"],
    answer: (request) => {
      if (request.method !== "sensors.orientation.start") return ok(null)
      held.release = () =>
        hostPort.postMessage({ id: request.id, ok: true, result: { stream: request.id } })
      return undefined
    },
  })
  const host = await client
  const samples: unknown[] = []
  const stop = host.tilt.start((value) => samples.push(value))
  await new Promise((resolve) => setTimeout(resolve, 20))

  stop()
  assert.ok(held.release, "the host never saw the start")
  held.release()
  await new Promise((resolve) => setTimeout(resolve, 20))

  const start = seen.find((request) => request.method === "sensors.orientation.start")
  assert.ok(start)
  const cancel = seen.find((request) => request.method === "stream.cancel")
  assert.ok(cancel, "a stream opened after the stop was never cancelled")
  assert.deepEqual(cancel.params, { stream: start.id })
  // And the late handle is not registered, so a sample on it goes nowhere.
  hostPort.postMessage({ stream: start.id, seq: 1, data: sample(1, 0) })
  await new Promise((resolve) => setTimeout(resolve, 20))
  assert.deepEqual(samples, [])
  host.dispose()
})

test("a sample that is not a sample is dropped rather than fed to the game", async (t) => {
  t.after(cleanup)
  const said: string[] = []
  const real = console.error
  console.error = (...args: unknown[]) => said.push(args.map(String).join(" "))
  t.after(() => {
    console.error = real
  })

  const { client, seen, hostPort } = withFakeFrame({
    granted: ["sensors.orientation"],
    answer: (request) =>
      request.method === "sensors.orientation.start" ? ok({ stream: request.id }) : ok(null),
  })
  const host = await client
  const samples: unknown[] = []
  host.tilt.start((value) => samples.push(value))
  await new Promise((resolve) => setTimeout(resolve, 20))
  const id = seen.find((request) => request.method === "sensors.orientation.start")?.id ?? 0

  // One NaN through a game's steering makes every position after it NaN, the
  // world vanishes and nothing throws. That is the blank screen this drops.
  hostPort.postMessage({ stream: id, seq: 1, data: { x: Number.NaN, y: 0, degrees: { x: 0, y: 0 } } })
  hostPort.postMessage({ stream: id, seq: 2, data: sample(0.25, 0) })
  await new Promise((resolve) => setTimeout(resolve, 20))
  assert.deepEqual(samples, [sample(0.25, 0)])
  assert.equal(said.length, 1, "a dropped sample was dropped quietly")
  host.dispose()
})

test("a repeated or reordered sequence number is dropped", async (t) => {
  t.after(cleanup)
  const { client, seen, hostPort } = withFakeFrame({
    granted: ["sensors.orientation"],
    answer: (request) =>
      request.method === "sensors.orientation.start" ? ok({ stream: request.id }) : ok(null),
  })
  const host = await client
  const samples: number[] = []
  host.tilt.start((value) => samples.push(value.x))
  await new Promise((resolve) => setTimeout(resolve, 20))
  const id = seen.find((request) => request.method === "sensors.orientation.start")?.id ?? 0

  hostPort.postMessage({ stream: id, seq: 1, data: sample(0.1, 0) })
  hostPort.postMessage({ stream: id, seq: 3, data: sample(0.3, 0) })
  // Behind the high-water mark: a step backwards in time for whatever this is
  // steering, so it is dropped rather than replayed.
  hostPort.postMessage({ stream: id, seq: 2, data: sample(0.2, 0) })
  hostPort.postMessage({ stream: id, seq: 3, data: sample(0.9, 0) })
  hostPort.postMessage({ stream: id, seq: 4, data: sample(0.4, 0) })
  await new Promise((resolve) => setTimeout(resolve, 20))
  // A gap (2 missing) is deliberate — the host throttles — so 3 is delivered.
  assert.deepEqual(samples, [0.1, 0.3, 0.4])
  host.dispose()
})

test("a stream on a pack that was disposed delivers nothing", async (t) => {
  t.after(cleanup)
  const { client, seen, hostPort } = withFakeFrame({
    granted: ["sensors.orientation"],
    answer: (request) =>
      request.method === "sensors.orientation.start" ? ok({ stream: request.id }) : ok(null),
  })
  const host = await client
  const samples: unknown[] = []
  host.tilt.start((value) => samples.push(value))
  await new Promise((resolve) => setTimeout(resolve, 20))
  const id = seen.find((request) => request.method === "sensors.orientation.start")?.id ?? 0

  hostPort.postMessage({ stream: id, seq: 1, data: sample(0.5, 0) })
  await new Promise((resolve) => setTimeout(resolve, 20))
  assert.equal(samples.length, 1)

  host.dispose()
  hostPort.postMessage({ stream: id, seq: 2, data: sample(1, 1) })
  await new Promise((resolve) => setTimeout(resolve, 20))
  // Two independent mechanisms hold this and either one alone is enough —
  // dropping the sink table, and tearing the port down. Removing either on its
  // own leaves this green, which was measured; removing both fails it here. The
  // test is written against the property rather than against a mechanism, and the
  // redundancy is deliberate: the port stops delivery, the table stops a
  // reference to a torn-down game's closure being held.
  assert.equal(samples.length, 1, "a sample reached a game that had been torn down")
})

test("a stream the host says has become unavailable stops quietly for the child", async (t) => {
  t.after(cleanup)
  const said: string[] = []
  const real = console.error
  console.error = (...args: unknown[]) => said.push(args.map(String).join(" "))
  t.after(() => {
    console.error = real
  })

  const { client, seen, hostPort } = withFakeFrame({
    granted: ["sensors.orientation"],
    answer: (request) =>
      request.method === "sensors.orientation.start" ? ok({ stream: request.id }) : ok(null),
  })
  const host = await client
  const samples: unknown[] = []
  const stop = host.tilt.start((value) => samples.push(value))
  await new Promise((resolve) => setTimeout(resolve, 20))
  const id = seen.find((request) => request.method === "sensors.orientation.start")?.id ?? 0

  hostPort.postMessage({ stream: id, done: true, reason: "unavailable" })
  await new Promise((resolve) => setTimeout(resolve, 20))
  hostPort.postMessage({ stream: id, seq: 1, data: sample(1, 1) })
  await new Promise((resolve) => setTimeout(resolve, 20))
  assert.deepEqual(samples, [], "an ended stream kept delivering")
  assert.equal(said.length, 1)
  assert.match(said[0] ?? "", /keep playing|without it/i)
  // And stopping an already-ended stream is not an error.
  stop()
  host.dispose()
})

test("a start the host refuses is announced, and the game is left running", async (t) => {
  t.after(cleanup)
  const said: string[] = []
  const real = console.error
  console.error = (...args: unknown[]) => said.push(args.map(String).join(" "))
  t.after(() => {
    console.error = real
  })

  const { client } = withFakeFrame({
    granted: ["sensors.orientation"],
    answer: () => ({ ok: false as const, error: { code: "unavailable" as const, message: "no sensor" } }),
  })
  const host = await client
  const samples: unknown[] = []
  // No throw, no rejection: a game must not have to catch this to be correct.
  const stop = host.tilt.start((value) => samples.push(value))
  await new Promise((resolve) => setTimeout(resolve, 20))
  stop()
  assert.deepEqual(samples, [])
  assert.equal(said.length, 1)
  assert.match(said[0] ?? "", /unavailable/)
  host.dispose()
})
