// The enforcement point, exercised as an adversary would.
//
// Half of these send messages no honest pack would ever send. That is the test:
// the bridge is the only thing between third-party code and the host, in a
// product used by children, and "no pack would do that" is not a security
// property.

import { test } from "node:test"
import assert from "node:assert/strict"

import {
  createBridge,
  MAX_OPEN_STREAMS,
  MAX_STORAGE_KEYS,
  MAX_STORAGE_VALUE_LENGTH,
} from "./bridge.ts"
import type { HostServices } from "./bridge.ts"
import { CAPABILITIES, CAPABILITY_IDS, METHODS, SESSION_METHODS } from "../../../packs/sdk/src/index.ts"
import type {
  Capability,
  Item,
  Orientation,
  Response,
  StreamEnd,
  StreamUpdate,
} from "../../../packs/sdk/src/index.ts"

const ITEM: Item = {
  id: "i1",
  skillId: "sub.4digit.zero",
  level: 3,
  form: "binary-op",
  operator: "-",
  operands: ["5001", "2798"],
  prompt: "5001 minus 2798",
  answerKind: "integer",
  digits: 4,
}

type Calls = { name: string; input: unknown }[]

function services(calls: Calls, overrides: Partial<HostServices> = {}): HostServices {
  const store = new Map<string, string>()
  const record = <T>(name: string, value: T) => (input: unknown) => {
    calls.push({ name, input })
    return value
  }
  return {
    nextItem: async (input) => record("nextItem", ITEM)(input),
    // 5001 − 2798 = 2203, verified by hand. 3797 is smaller-from-larger: it
    // subtracts the smaller digit from the larger in each column rather than
    // borrowing across the zero.
    judge: async (input) => {
      calls.push({ name: "judge", input })
      const correct = (input as { response: string }).response === "2203"
      return correct
        ? { correct: true, canonical: "2203", advance: true }
        : { correct: false, canonical: "2203", diagnosis: "smaller-from-larger", advance: true }
    },
    skip: async (input) => void record("skip", undefined)(input),
    reveal: async (input) => record("reveal", "2203")(input),
    learnerSummary: async (input) => record("learnerSummary", { skills: [] })(input),
    haptic: async (input) => void record("haptic", undefined)(input),
    sound: async (input) => void record("sound", undefined)(input),
    milestone: async (input) => void record("milestone", undefined)(input),
    storage: {
      get: async ({ key }) => store.get(key) ?? null,
      set: async ({ key, value }) => void store.set(key, value),
      remove: async ({ key }) => void store.delete(key),
      keys: async () => [...store.keys()],
    },
    // Inert by default: a device with no sensor, which is the case every test
    // that is not about streams should be running against.
    sensors: { orientation: async () => null },
    available: () => CAPABILITY_IDS.filter((id) => id !== "sensors.orientation"),
    progress: (input) => void record("progress", undefined)(input),
    end: (input) => void record("end", undefined)(input),
    transition: (input) => void record("transition", undefined)(input),
    settings: () => ({
      locale: "en",
      reducedMotion: false,
      quality: "high",
      textScale: 1,
      colorScheme: "light",
      sound: true,
      haptics: true,
    }),
    ...overrides,
  }
}

const bridgeWith = (granted: readonly Capability[], calls: Calls = [], extra: Partial<HostServices> = {}) =>
  createBridge({ packId: "abacus.tower", granted, services: services(calls, extra) })

const errorOf = (response: Response | null) => (response && !response.ok ? response.error.code : null)

test("a granted method reaches the host", async () => {
  const calls: Calls = []
  const bridge = bridgeWith(["items"], calls)
  const response = await bridge.handle({ id: 1, method: "items.next", params: {} })
  assert.deepEqual(response, { id: 1, ok: true, result: { item: ITEM } })
  assert.equal(calls[0]?.name, "nextItem")
})

test("every method of every capability is denied to a pack without it", async () => {
  // The exhaustive version. A method added to the SDK without a grant would be
  // callable by every pack, and this is what notices.
  for (const entry of CAPABILITIES) {
    const others = CAPABILITY_IDS.filter((id) => id !== entry.id)
    for (const method of entry.methods) {
      const calls: Calls = []
      const bridge = bridgeWith(others, calls)
      const response = await bridge.handle({ id: 1, method, params: {} })
      assert.equal(errorOf(response), "denied", `${method} was not denied`)
      assert.deepEqual(calls, [], `${method} reached the host while denied`)
      assert.equal(bridge.stats.denied, 1)
    }
  }
})

test("a denial does not depend on the parameters", async () => {
  // Otherwise the error a pack gets back tells it about what it was denied.
  const bridge = bridgeWith([])
  const withGarbage = await bridge.handle({ id: 1, method: "items.answer", params: { itemId: 5 } })
  const withNothing = await bridge.handle({ id: 2, method: "items.answer", params: {} })
  assert.equal(errorOf(withGarbage), "denied")
  assert.equal(errorOf(withNothing), "denied")
})

test("session methods work with no grants at all", async () => {
  const calls: Calls = []
  const bridge = bridgeWith([], calls)
  for (const method of SESSION_METHODS) {
    const params =
      method === "session.progress"
        ? { fraction: 0.5 }
        : method === "session.end"
          ? { reason: "quit" }
          : method === "session.transition"
            ? { kind: "level" }
            : method === "stream.cancel"
              ? // A handle this pack never opened. Cancelling is idempotent and
                // says nothing about what it found, so a pack cannot probe for
                // another stream's existence by inventing a number.
                { stream: 0 }
              : {}
    const response = await bridge.handle({ id: 1, method, params })
    assert.ok(response?.ok, `${method} was refused`)
  }
})

test("an unknown method is refused and never dispatched", async () => {
  const calls: Calls = []
  const bridge = bridgeWith(CAPABILITY_IDS, calls)
  assert.equal(errorOf(await bridge.handle({ id: 1, method: "items.eval", params: {} })), "unknown_method")
  assert.equal(errorOf(await bridge.handle({ id: 2, method: "__proto__", params: {} })), "unknown_method")
  assert.equal(errorOf(await bridge.handle({ id: 3, method: "constructor", params: {} })), "unknown_method")
  assert.deepEqual(calls, [])
})

test("a message with no usable id is dropped rather than answered", async () => {
  // Answering with an invented id would resolve a promise the pack is holding
  // for something else.
  const bridge = bridgeWith(CAPABILITY_IDS)
  assert.equal(await bridge.handle(null), null)
  assert.equal(await bridge.handle("items.next"), null)
  assert.equal(await bridge.handle({ method: "items.next" }), null)
  assert.equal(await bridge.handle({ id: -1, method: "items.next" }), null)
  assert.equal(bridge.stats.malformed, 4)
})

test("the whole method table is reachable when everything is granted", async () => {
  // A method in the SDK that the bridge forgot to implement would return
  // undefined and hang the pack's promise forever.
  //
  // A device that can do everything, deliberately: a native method refused
  // because the fixture has no sensor would pass this test for the wrong reason
  // and hide the case where the dispatch arm is missing entirely.
  const bridge = createBridge({
    packId: "abacus.tower",
    granted: CAPABILITY_IDS,
    services: services([], {
      available: () => CAPABILITY_IDS,
      sensors: { orientation: async () => () => {} },
    }),
    push: () => {},
  })
  const params: Record<string, unknown> = {
    stream: 0,
    itemId: "i1",
    response: "2203",
    latencyMs: 100,
    revisions: 0,
    key: "k",
    value: "v",
    name: "tower.built",
    cue: "seat",
    fraction: 0.5,
    reason: "quit",
    kind: "level",
  }
  for (const method of METHODS) {
    const response = await bridge.handle({ id: 1, method, params })
    assert.notEqual(response, null, `${method} produced no response`)
    assert.ok(response?.ok, `${method} failed: ${JSON.stringify(response)}`)
  }
})

test("reading the answer costs the attempt", async () => {
  // The property the whole design turns on: `items.next` does not carry the
  // canonical value, and the only way to get it is `items.answer`, which
  // records the attempt first. A pack cannot learn what is right for free.
  const calls: Calls = []
  const bridge = bridgeWith(["items"], calls)

  const served = await bridge.handle({ id: 1, method: "items.next", params: {} })
  assert.ok(served?.ok)
  const item = (served as { result: { item: Item } }).result.item
  assert.ok(!JSON.stringify(item).includes("2203"), "the served item carried the answer")

  const wrong = await bridge.handle({
    id: 2,
    method: "items.answer",
    params: { itemId: "i1", response: "3797", latencyMs: 4200, revisions: 0 },
  })
  assert.ok(wrong?.ok)
  const judgement = (wrong as { result: { correct: boolean; canonical: string; diagnosis?: string } }).result
  assert.equal(judgement.correct, false)
  assert.equal(judgement.canonical, "2203")
  assert.equal(judgement.diagnosis, "smaller-from-larger")
  assert.equal(calls.filter((call) => call.name === "judge").length, 1, "the attempt was not recorded")
})

test("reading the answer early is a separate grant", async () => {
  const withItems = bridgeWith(["items"])
  assert.equal(
    errorOf(await withItems.handle({ id: 1, method: "items.reveal", params: { itemId: "i1" } })),
    "denied",
  )
  const withReveal = bridgeWith(["items", "items.reveal"])
  const response = await withReveal.handle({ id: 1, method: "items.reveal", params: { itemId: "i1" } })
  assert.deepEqual(response, { id: 1, ok: true, result: { canonical: "2203" } })
})

test("parameters are checked, and a wrong one is invalid_params rather than a crash", async () => {
  const bridge = bridgeWith(CAPABILITY_IDS)
  const cases: [string, Record<string, unknown>][] = [
    ["items.answer", { response: "1", latencyMs: 1, revisions: 0 }],
    ["items.answer", { itemId: "i1", response: 5, latencyMs: 1, revisions: 0 }],
    ["items.answer", { itemId: "i1", response: "1", latencyMs: -1, revisions: 0 }],
    ["items.answer", { itemId: "i1", response: "1", latencyMs: Number.NaN, revisions: 0 }],
    ["items.skip", {}],
    ["items.reveal", { itemId: "" }],
    ["feedback.haptic", { cue: "explode" }],
    ["feedback.sound", { cue: 7 }],
    ["milestone.reach", {}],
    ["session.progress", { fraction: "half" }],
    ["session.end", { reason: "crashed" }],
    ["session.transition", { kind: "defeat" }],
    ["storage.get", {}],
    ["storage.set", { key: "k" }],
    ["storage.set", { key: "k", value: 7 }],
  ]
  for (const [method, params] of cases) {
    const response = await bridge.handle({ id: 1, method, params })
    assert.equal(errorOf(response), "invalid_params", `${method} ${JSON.stringify(params)}`)
  }
})

test("a latency nobody could have produced is clamped, not refused", async () => {
  // A child who leaves the tablet on the sofa for an hour has not answered in
  // an hour; refusing the report would lose the attempt entirely.
  const calls: Calls = []
  const bridge = bridgeWith(["items"], calls)
  await bridge.handle({
    id: 1,
    method: "items.answer",
    params: { itemId: "i1", response: "2203", latencyMs: 99_999_999, revisions: 3.7 },
  })
  const judged = calls.find((call) => call.name === "judge")?.input as {
    latencyMs: number
    revisions: number
  }
  assert.equal(judged.latencyMs, 600_000)
  assert.equal(judged.revisions, 4, "revisions are whole")
})

test("a pack that floods is rate-limited, and recovers when it stops", async () => {
  let clock = 1_000
  const calls: Calls = []
  const bridge = createBridge({
    packId: "abacus.tower",
    granted: ["items"],
    services: services(calls),
    now: () => clock,
    maxRequestsPerSecond: 5,
  })

  for (let index = 0; index < 5; index += 1) {
    const response = await bridge.handle({ id: index, method: "items.next", params: {} })
    assert.ok(response?.ok, `request ${index} should have been served`)
  }
  assert.equal(errorOf(await bridge.handle({ id: 5, method: "items.next", params: {} })), "rate_limited")
  assert.equal(calls.length, 5, "a rate-limited request still reached the host")

  clock += 1001
  assert.ok((await bridge.handle({ id: 6, method: "items.next", params: {} }))?.ok)
  assert.equal(bridge.stats.rateLimited, 1)
})

test("rate limiting is applied after the denial, so a denied flood is still denied", async () => {
  const clock = 1_000
  const bridge = createBridge({
    packId: "abacus.tower",
    granted: [],
    services: services([]),
    now: () => clock,
    maxRequestsPerSecond: 2,
  })
  for (let index = 0; index < 10; index += 1) {
    assert.equal(errorOf(await bridge.handle({ id: index, method: "items.next", params: {} })), "denied")
  }
})

test("pack storage is bounded in both directions", async () => {
  // Filling the key budget takes more requests than a second allows, which is
  // the rate limiter doing its job and not what this test is about.
  const bridge = createBridge({
    packId: "abacus.tower",
    granted: ["storage"],
    services: services([]),
    maxRequestsPerSecond: 100_000,
  })
  const set = (key: string, value: string) =>
    bridge.handle({ id: 1, method: "storage.set", params: { key, value } })

  assert.ok((await set("level", "7"))?.ok)
  assert.deepEqual(await bridge.handle({ id: 2, method: "storage.get", params: { key: "level" } }), {
    id: 2,
    ok: true,
    result: { value: "7" },
  })

  assert.equal(errorOf(await set("big", "x".repeat(MAX_STORAGE_VALUE_LENGTH + 1))), "quota")

  for (let index = 0; index < MAX_STORAGE_KEYS; index += 1) {
    await set(`k${index}`, "v")
  }
  assert.equal(errorOf(await set("one-too-many", "v")), "quota")
  // Overwriting an existing key is always allowed, full or not.
  assert.ok((await set("k0", "w"))?.ok)
})

test("a host that throws tells the pack nothing about why", async () => {
  const bridge = bridgeWith(["items"], [], {
    nextItem: async () => {
      throw new Error("SQLITE_CORRUPT: /Users/someone/Library/…/learner.db")
    },
  })
  const response = await bridge.handle({ id: 1, method: "items.next", params: {} })
  assert.equal(errorOf(response), "internal")
  assert.ok(response && !response.ok)
  if (response && !response.ok) {
    assert.doesNotMatch(response.error.message, /SQLITE|Users|db/)
  }
})

test("the pack id the host is told is the host's, never the pack's", async () => {
  // A pack that puts a `packId` in its params must not be able to read or write
  // another pack's storage with it.
  const calls: Calls = []
  const bridge = bridgeWith(["storage", "items"], calls)
  await bridge.handle({
    id: 1,
    method: "items.next",
    params: { packId: "someone.else", skillId: "add.1" },
  })
  assert.deepEqual(calls[0]?.input, { packId: "abacus.tower", skillId: "add.1" })
})

test("a difficulty request crosses the boundary, clamped rather than refused", async () => {
  const calls: Calls = []
  const bridge = createBridge({ packId: "p", granted: ["items"], services: services(calls) })

  await bridge.handle({
    id: 1,
    method: "items.next",
    params: { difficulty: 0.25, maxDifficulty: 0.75 },
  })
  assert.deepEqual(calls[0]?.input, {
    packId: "p",
    difficulty: 0.25,
    maxDifficulty: 0.75,
  })

  // Out of range is a bug in a pack, and refusing the question would turn it
  // into a blank screen in a child's game. Clamped, like every other number
  // this boundary takes, and announced on the pack's side where an author can
  // act on it.
  const clamped = await bridge.handle({
    id: 2,
    method: "items.next",
    params: { difficulty: 4, maxDifficulty: -3 },
  })
  assert.equal(clamped?.ok, true)
  assert.deepEqual(calls[1]?.input, { packId: "p", difficulty: 1, maxDifficulty: 0 })

  // Not a number at all is absent, not zero: a pack that sends a string must
  // not thereby pin every question to the easiest rung on the ladder.
  await bridge.handle({ id: 3, method: "items.next", params: { difficulty: "hard" } })
  assert.deepEqual(calls[2]?.input, { packId: "p" })
})

test("a floor crosses the boundary too, and it is not silently dropped", async () => {
  // The half of the capability window this boundary did not carry. A field the
  // wire drops is the worst shape of this bug — the pack states it, every test
  // on either side passes, and the child still gets the empty field, because
  // nothing between them ever said the word. TREBUCHET spent three releases in
  // exactly that state for want of the field itself.
  const calls: Calls = []
  const bridge = createBridge({ packId: "p", granted: ["items"], services: services(calls) })

  await bridge.handle({
    id: 1,
    method: "items.next",
    params: { difficulty: 0.28, minDifficulty: 0.28, maxDifficulty: 0.9 },
  })
  assert.deepEqual(calls[0]?.input, {
    packId: "p",
    difficulty: 0.28,
    maxDifficulty: 0.9,
    minDifficulty: 0.28,
  })

  // Clamped like every other number here, and absent when it is not a number:
  // a floor of `NaN` must not become a floor of zero, which reads as "no floor"
  // and is the failure this field exists to prevent.
  await bridge.handle({ id: 2, method: "items.next", params: { minDifficulty: 7 } })
  assert.deepEqual(calls[1]?.input, { packId: "p", minDifficulty: 1 })
  await bridge.handle({ id: 3, method: "items.next", params: { minDifficulty: "high" } })
  assert.deepEqual(calls[2]?.input, { packId: "p" })
})

/* ─── streams, and the native-backed capability behind them ────────────────── */
//
// A stream is the first thing on this seam that OUTLIVES the message that opened
// it, and it is the first thing on it that holds a device resource. Both are new
// kinds of mistake: a stream nothing ends, and a sensor nothing releases.

type Sensor = {
  /** A working source. Every started stream is recorded here. */
  readonly orientation: HostServices["sensors"]["orientation"]
  /** How many times a stop function was called. */
  released: () => number
  /** How many subscriptions were ever handed out. */
  started: () => number
  /** Push a sample at every live subscription. */
  feed: (sample: Orientation) => void
  /** Tell every live subscription its source has gone. */
  lose: () => void
}

function sensor(options: { present?: boolean } = {}): Sensor {
  let released = 0
  let started = 0
  const live = new Set<{ emit: (sample: Orientation) => void; lost: () => void }>()
  return {
    orientation: async (input) => {
      if (options.present === false) return null
      started += 1
      const entry = { emit: input.emit, lost: input.lost }
      live.add(entry)
      return () => {
        released += 1
        live.delete(entry)
      }
    },
    released: () => released,
    started: () => started,
    feed: (sample) => {
      for (const entry of [...live]) entry.emit(sample)
    },
    lose: () => {
      for (const entry of [...live]) entry.lost()
    },
  }
}

const SAMPLE: Orientation = { x: 0.5, y: -0.25, degrees: { x: 12, y: -6 } }

function streamBridge(options: { present?: boolean; granted?: readonly Capability[] } = {}) {
  const pushed: (StreamUpdate | StreamEnd)[] = []
  const device = sensor(options.present === false ? { present: false } : {})
  const bridge = createBridge({
    packId: "abacus.tower",
    granted: options.granted ?? ["sensors.orientation"],
    services: services([], {
      sensors: { orientation: device.orientation },
      available: () =>
        options.present === false
          ? CAPABILITY_IDS.filter((id) => id !== "sensors.orientation")
          : CAPABILITY_IDS,
    }),
    push: (message) => pushed.push(message),
  })
  return { bridge, device, pushed }
}

const updates = (pushed: readonly (StreamUpdate | StreamEnd)[]): StreamUpdate[] =>
  pushed.filter((message): message is StreamUpdate => !("done" in message))

const ends = (pushed: readonly (StreamUpdate | StreamEnd)[]): StreamEnd[] =>
  pushed.filter((message): message is StreamEnd => "done" in message)

test("a stream hands back its own request id and numbers its samples from one", async () => {
  const { bridge, device, pushed } = streamBridge()
  const response = await bridge.handle({ id: 9, method: "sensors.orientation.start", params: {} })
  assert.ok(response?.ok)
  // The handle IS the request id: no second namespace, and the pack already held
  // the number it sent.
  assert.deepEqual(response.result, { stream: 9 })
  assert.deepEqual(bridge.streams(), [9])
  assert.equal(device.started(), 1)

  device.feed(SAMPLE)
  device.feed(SAMPLE)
  assert.deepEqual(updates(pushed), [
    { stream: 9, seq: 1, data: SAMPLE },
    { stream: 9, seq: 2, data: SAMPLE },
  ])
})

test("a pack that did not declare the capability cannot open the stream", async () => {
  const { bridge, device } = streamBridge({ granted: ["items"] })
  const response = await bridge.handle({ id: 1, method: "sensors.orientation.start", params: {} })
  assert.equal(errorOf(response), "denied")
  // And the denial happened before anything touched the device.
  assert.equal(device.started(), 0)
  assert.deepEqual(bridge.streams(), [])
})

test("a source that refuses is unavailable rather than an open stream", async () => {
  const { bridge, device } = streamBridge({ present: false })
  const response = await bridge.handle({ id: 1, method: "sensors.orientation.start", params: {} })
  assert.equal(errorOf(response), "unavailable")
  assert.equal(device.started(), 0)
  assert.deepEqual(bridge.streams(), [])
})

test("the bridge refuses an unavailable capability before it touches the device", async () => {
  // Checked HERE and not only in the guest: the guest short-circuits to save a
  // round trip, and the bridge is the boundary — it cannot rely on the other side
  // of itself having done the check.
  //
  // The device in this fixture WORKS. That is the whole point of it: a fixture
  // whose source also returns `null` makes this test pass with the bridge's check
  // deleted, because the refusal then comes from the source instead. It was
  // written that way first and measured passing with the fix removed.
  const device = sensor()
  const bridge = createBridge({
    packId: "abacus.tower",
    granted: ["sensors.orientation"],
    services: services([], {
      sensors: { orientation: device.orientation },
      available: () => CAPABILITY_IDS.filter((id) => id !== "sensors.orientation"),
    }),
    push: () => {},
  })
  const response = await bridge.handle({ id: 1, method: "sensors.orientation.start", params: {} })
  assert.equal(errorOf(response), "unavailable")
  assert.equal(device.started(), 0, "a capability the device cannot do was started anyway")
  assert.deepEqual(bridge.streams(), [])
})

test("cancelling ends the stream once and releases the device", async () => {
  const { bridge, device, pushed } = streamBridge()
  await bridge.handle({ id: 3, method: "sensors.orientation.start", params: {} })
  const response = await bridge.handle({ id: 4, method: "stream.cancel", params: { stream: 3 } })
  assert.ok(response?.ok)
  assert.equal(device.released(), 1, "the sensor was left running")
  assert.deepEqual(ends(pushed), [{ stream: 3, done: true, reason: "cancelled" }])
  assert.deepEqual(bridge.streams(), [])

  // Nothing arrives afterwards, even if the source is still being fed.
  device.feed(SAMPLE)
  assert.deepEqual(updates(pushed), [])

  // And cancelling again is not an error and does not end it twice: a pack
  // racing its own teardown against a host that already closed the stream is the
  // normal case, not a fault.
  const again = await bridge.handle({ id: 5, method: "stream.cancel", params: { stream: 3 } })
  assert.ok(again?.ok)
  assert.equal(ends(pushed).length, 1)
  assert.equal(device.released(), 1)
})

test("cancelling a handle the pack invented says nothing about it", async () => {
  const { bridge, pushed } = streamBridge()
  const response = await bridge.handle({ id: 1, method: "stream.cancel", params: { stream: 7777 } })
  assert.ok(response?.ok, "a pack learned that a handle was not real")
  assert.deepEqual(pushed, [])
  assert.equal(
    errorOf(await bridge.handle({ id: 2, method: "stream.cancel", params: {} })),
    "invalid_params",
  )
})

test("a stream cancelled while it was still starting leaves nothing behind", async () => {
  // A permission prompt is on screen, the child presses the back button, and the
  // pack cancels a stream whose handle it has not been given yet. Before the
  // handle is reserved ahead of the await there is nothing for the cancel to
  // find, and the sensor stays subscribed to a stream nobody is reading.
  const pushed: (StreamUpdate | StreamEnd)[] = []
  let released = 0
  // A holder rather than a `let`: assigned inside a callback, so TypeScript's
  // control-flow analysis still believes the variable is `null` at the assertion
  // below and narrows it to `never`.
  const held: { release: (() => void) | null } = { release: null }
  const bridge = createBridge({
    packId: "abacus.tower",
    granted: ["sensors.orientation"],
    services: services([], {
      available: () => CAPABILITY_IDS,
      sensors: {
        orientation: async () =>
          new Promise<() => void>((resolve) => {
            held.release = () =>
              resolve(() => {
                released += 1
              })
          }),
      },
    }),
    push: (message) => pushed.push(message),
  })

  const start = bridge.handle({ id: 2, method: "sensors.orientation.start", params: {} })
  await new Promise((resolve) => setImmediate(resolve))
  // The handle exists before the source has finished starting, which is the
  // whole point: the cancel has something to find.
  assert.deepEqual(bridge.streams(), [2])
  await bridge.handle({ id: 3, method: "stream.cancel", params: { stream: 2 } })
  assert.ok(held.release)
  held.release()

  const response = await start
  assert.equal(errorOf(response), "unavailable")
  assert.equal(released, 1, "a source started for a cancelled stream was never released")
  assert.deepEqual(bridge.streams(), [])
  // No end message: nothing was ever handed out, so there was no stream to end.
  // "Exactly one end per stream" is a promise about streams that were opened.
  assert.deepEqual(ends(pushed), [])
})

test("a source that turns out to be feeding nothing ends the stream unavailable", async () => {
  const { bridge, device, pushed } = streamBridge()
  await bridge.handle({ id: 1, method: "sensors.orientation.start", params: {} })
  device.lose()
  assert.deepEqual(ends(pushed), [{ stream: 1, done: true, reason: "unavailable" }])
  assert.equal(device.released(), 1)
  assert.deepEqual(bridge.streams(), [])
})

test("a paused pack stops receiving samples, and the gap shows in the sequence", async () => {
  const { bridge, device, pushed } = streamBridge()
  await bridge.handle({ id: 1, method: "sensors.orientation.start", params: {} })
  device.feed(SAMPLE)

  // A game steering behind the day-pass sheet is a game the child is not
  // playing. The samples are DROPPED rather than queued: a buffer of stale tilt
  // delivered all at once on resume would snap whatever it steers across the
  // screen.
  bridge.setPaused(true)
  device.feed(SAMPLE)
  device.feed(SAMPLE)
  assert.equal(updates(pushed).length, 1)

  bridge.setPaused(false)
  device.feed(SAMPLE)
  const seen = updates(pushed)
  assert.deepEqual(
    seen.map((message) => message.seq),
    [1, 2],
    "a dropped sample consumed a sequence number",
  )
  assert.equal(seen.length, 2)
})

test("closing the bridge ends every stream and releases every device", async () => {
  // The one guarantee that matters: nothing outlives the pack. A sensor left
  // subscribed after a child has left is a battery cost nobody can see and
  // nothing else in this app would notice.
  const { bridge, device, pushed } = streamBridge()
  await bridge.handle({ id: 1, method: "sensors.orientation.start", params: {} })
  await bridge.handle({ id: 2, method: "sensors.orientation.start", params: {} })
  assert.equal(device.started(), 2)

  bridge.close()
  assert.equal(device.released(), 2)
  assert.deepEqual(ends(pushed), [
    { stream: 1, done: true, reason: "closed" },
    { stream: 2, done: true, reason: "closed" },
  ])
  assert.deepEqual(bridge.streams(), [])

  // And a message already in flight when the session ended is not served — the
  // one that must not be is another stream start.
  assert.equal(await bridge.handle({ id: 3, method: "sensors.orientation.start", params: {} }), null)
  assert.equal(device.started(), 2)
  bridge.close()
  assert.equal(device.released(), 2, "close ran twice")
})

test("a source whose stop throws still leaves the stream ended", async () => {
  // `stop` is host code and host code throws. A throw that left the handle in
  // the table would leave a stream nothing can ever end.
  const pushed: (StreamUpdate | StreamEnd)[] = []
  const bridge = createBridge({
    packId: "abacus.tower",
    granted: ["sensors.orientation"],
    services: services([], {
      available: () => CAPABILITY_IDS,
      sensors: {
        orientation: async () => () => {
          throw new Error("the sensor was already gone")
        },
      },
    }),
    push: (message) => pushed.push(message),
  })
  await bridge.handle({ id: 1, method: "sensors.orientation.start", params: {} })
  bridge.close()
  assert.deepEqual(bridge.streams(), [])
  assert.deepEqual(ends(pushed), [{ stream: 1, done: true, reason: "closed" }])
})

test("a pack cannot hoard streams", async () => {
  const { bridge, device } = streamBridge()
  for (let id = 1; id <= MAX_OPEN_STREAMS; id += 1) {
    assert.ok((await bridge.handle({ id, method: "sensors.orientation.start", params: {} }))?.ok)
  }
  const over = await bridge.handle({
    id: MAX_OPEN_STREAMS + 1,
    method: "sensors.orientation.start",
    params: {},
  })
  assert.equal(errorOf(over), "quota")
  assert.equal(device.started(), MAX_OPEN_STREAMS)
  bridge.close()
})

test("a bridge with nowhere to push does not pretend to stream", async () => {
  // `push` is optional so that a test about request/response need not supply
  // one. A pack in that host gets a stream that delivers nothing, which must not
  // be a throw: this is the shape every existing bridge test constructs.
  const device = sensor()
  const bridge = createBridge({
    packId: "abacus.tower",
    granted: ["sensors.orientation"],
    services: services([], {
      available: () => CAPABILITY_IDS,
      sensors: { orientation: device.orientation },
    }),
  })
  assert.ok((await bridge.handle({ id: 1, method: "sensors.orientation.start", params: {} }))?.ok)
  device.feed(SAMPLE)
  bridge.close()
  assert.equal(device.released(), 1)
})
