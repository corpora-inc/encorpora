// The isolation, asserted rather than described.
//
// `mountPack` takes its `document` and `window`, so the whole handshake runs in
// Node against a fake frame and a real `MessageChannel`. What cannot be tested
// here is the WebView's enforcement of the sandbox attribute — but the
// attribute itself is the entire boundary, and an edit that drops
// `allow-same-origin` back in would be invisible in every other test in this
// repository. This is the one that fails.

import { readFileSync } from "node:fs"
import { test, type TestContext } from "node:test"
import assert from "node:assert/strict"

import {
  describeFault,
  fillsWindow,
  LIVENESS,
  MIN_FILL,
  mountPack,
  newWatch,
  step,
  stillWatching,
  type LivenessFault,
  type LivenessLimits,
  type Observation,
  type Watch,
} from "./frame.ts"
import type { HostServices } from "./bridge.ts"
import { CAPABILITY_IDS } from "../../../packs/sdk/src/index.ts"
import type {
  Capability,
  Connect,
  Orientation,
  Settings,
  StreamUpdate,
} from "../../../packs/sdk/src/index.ts"

const SETTINGS: Settings = {
  locale: "en",
  reducedMotion: false,
  quality: "high",
  textScale: 1,
  colorScheme: "light",
  sound: true,
  haptics: true,
}

const services = (overrides: Partial<HostServices> = {}): HostServices => ({
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
  sensors: { orientation: async () => null },
  available: () => CAPABILITY_IDS,
  settings: () => SETTINGS,
  ...overrides,
})

type Posted = { data: unknown; targetOrigin: string; transfer: readonly MessagePort[] }

type Harness = {
  mounted: ReturnType<typeof mountPack>
  frame: Record<string, unknown>
  posted: Posted[]
  children: unknown[]
  listeners: Map<string, Set<(event: unknown) => void>>
  removed: boolean
  /** Faults the host reported, in order. */
  faults: LivenessFault[]
  /** The box the frame reports from here on. */
  setBox(width: number, height: number): void
  fire(event: { source: unknown; data: unknown }): void
}

/** How a mount may be varied. Everything omitted behaves like a healthy app. */
type HarnessOptions = {
  readonly granted?: readonly Capability[]
  /** The frame's box. Defaults to a 820x1180 tablet, which is what it is. */
  readonly box?: { readonly width: number; readonly height: number }
  readonly liveness?: Partial<LivenessLimits>
  /** Replaces part of the host surface. For the native-backed capabilities. */
  readonly services?: Partial<HostServices>
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
function harness(t: TestContext, options: HarnessOptions = {}): Harness {
  const granted = options.granted ?? ["items"]
  const posted: Posted[] = []
  const children: unknown[] = []
  const faults: LivenessFault[] = []
  const listeners = new Map<string, Set<(event: unknown) => void>>()
  const attributes = new Map<string, string>()
  const state = { removed: false }
  // A real frame, in a real app, on a real tablet. The liveness watch measures
  // this, so a fake that reported nothing would make every liveness assertion
  // below vacuous.
  const box = { width: options.box?.width ?? 820, height: options.box?.height ?? 1180 }

  const contentWindow = {
    postMessage: (data: unknown, targetOrigin: string, transfer: readonly MessagePort[] = []) => {
      posted.push({ data, targetOrigin, transfer })
    },
  }

  const frame: Record<string, unknown> = {
    contentWindow,
    isConnected: true,
    getBoundingClientRect: () => ({ ...box }),
    setAttribute: (name: string, value: string) => attributes.set(name, value),
    getAttribute: (name: string) => attributes.get(name) ?? null,
    addEventListener: () => {},
    remove: () => {
      state.removed = true
    },
  }

  const doc = { createElement: () => frame, visibilityState: "visible" } as unknown as Document
  const win = {
    innerWidth: 820,
    innerHeight: 1180,
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
    services: services(options.services ?? {}),
    hostVersion: "0.4.0",
    title: "Abacus Tower",
    document: doc,
    window: win,
    onFault: (fault) => faults.push(fault),
    ...(options.liveness ? { liveness: options.liveness } : {}),
  })
  t.after(() => mounted.dispose())

  return {
    mounted,
    frame,
    posted,
    children,
    listeners,
    faults,
    setBox: (width, height) => {
      box.width = width
      box.height = height
    },
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
  const test = harness(t, { granted: ["items", "haptics"] })
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
  const test = harness(t, { granted: ["items"] })
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

/* -------------------------------------------------------------------------- */
/* Liveness: noticing that a pack is showing a child nothing.                  */
/*                                                                            */
/* VOLTA shipped blank on both platforms and the only net was the handshake    */
/* timeout, which a pack that connects and then draws nothing sails past.      */
/* These are the two faults the host can observe for itself, and most of what  */
/* is below is the other half of the job: proving the watch stays quiet in     */
/* every situation where a working pack legitimately measures zero or says     */
/* nothing. A false "this pack is broken" is worse than the silence.           */
/* -------------------------------------------------------------------------- */

/** A healthy tablet: visible, measurable, filling the window, and it has spoken. */
const HEALTHY: Observation = {
  visible: true,
  measurable: true,
  width: 820,
  height: 1180,
  windowWidth: 820,
  windowHeight: 1180,
  messages: 1,
}

/**
 * Run a sequence of observations through the watch and collect everything said.
 *
 * `dtMs` defaults to the real poll interval, so a count of observations is a
 * duration and the thresholds under test are the shipped ones.
 */
function watchThrough(
  observations: readonly Observation[],
  asksForItems = true,
  limits: LivenessLimits = LIVENESS,
): { readonly said: readonly LivenessFault[]; readonly watch: Watch } {
  let watch = newWatch()
  const said: LivenessFault[] = []
  for (const observation of observations) {
    const result = step(watch, observation, limits.pollMs, asksForItems, limits)
    watch = result.watch
    said.push(...result.faults)
  }
  return { said, watch }
}

/** `count` copies of one observation. */
const held = (observation: Observation, count: number): Observation[] =>
  Array.from({ length: count }, () => observation)

/** Enough ticks to pass a threshold twice over. */
const ticksFor = (ms: number): number => Math.ceil((ms / LIVENESS.pollMs) * 2)

test("a working pack is never accused, and stops being watched almost at once", () => {
  const run = watchThrough(held(HEALTHY, ticksFor(LIVENESS.muteAfterMs)))
  assert.equal(run.said.length, 0, `a healthy pack was accused of ${run.said.join(", ")}`)
  // And the poll stops: the watch has its answer after one measurement, so a
  // child's forty-minute session does not carry a timer that can never fire.
  assert.equal(
    stillWatching(run.watch, HEALTHY.messages, true),
    false,
    "the host kept polling a pack it had already cleared",
  )
})

test("a frame with no box is reported, once, after five seconds of being visible", () => {
  const blank: Observation = { ...HEALTHY, width: 820, height: 0 }
  // One tick short of the threshold: still nothing said.
  const early = watchThrough(held(blank, LIVENESS.blankAfterMs / LIVENESS.pollMs - 1))
  assert.equal(early.said.length, 0, "the watch accused a frame before its grace ran out")

  const run = watchThrough(held(blank, ticksFor(LIVENESS.blankAfterMs)))
  assert.deepEqual(run.said, ["no-room"], "a frame measuring 820x0 was not reported exactly once")
  assert.equal(stillWatching(run.watch, blank.messages, true), false)
})

test("the shape the host's own chain actually breaks into is reported", () => {
  // 300x150 is not a guess. `Stage.tsx` wraps the frame in a `fixed; inset: 0`
  // div, and `.pack-frame` / `.pack-frame-host` take their whole box from it by
  // percentage. Taking that one declaration away was tried in a browser against
  // the real `packs.css`: the frame does not become 0x0, it becomes 300x150 —
  // an iframe's intrinsic default, which is what a replaced element falls back to
  // when a percentage has nothing to resolve against.
  //
  // This is the case a check written against zero would have watched go past, and
  // it is the most likely way this failure ever happens.
  const defaulted: Observation = { ...HEALTHY, width: 300, height: 150 }
  assert.equal(fillsWindow(defaulted), false, "a 300x150 iframe counts as filling a tablet")
  const run = watchThrough(held(defaulted, ticksFor(LIVENESS.blankAfterMs)))
  assert.deepEqual(run.said, ["no-room"], "the measured failure shape went unreported")
})

test("either axis counts — a frame the window's height but a sliver wide shows no game", () => {
  for (const box of [
    { width: 0, height: 1180 },
    { width: 820, height: 0 },
    { width: 0, height: 0 },
    { width: 300, height: 150 },
    { width: 820, height: 1180 * MIN_FILL - 1 },
    { width: 820 * MIN_FILL - 1, height: 1180 },
  ]) {
    const run = watchThrough(held({ ...HEALTHY, ...box }, ticksFor(LIVENESS.blankAfterMs)))
    assert.deepEqual(run.said, ["no-room"], `${box.width}x${box.height} was not reported`)
  }
})

test("a small window is not a fault — the yardstick is the window, not a floor", () => {
  // The false positive a fixed pixel floor would have shipped. A desktop user who
  // drags the window down to a strip, a phone in split view, a WebView that has
  // not finished sizing: in every one the frame still fills what it was given, and
  // a pack drawn into all of a small window is a small game, not a broken one.
  for (const [name, w, h] of [
    ["a 320x568 phone", 320, 568],
    ["a window dragged to a strip", 400, 180],
    ["a single row of pixels", 900, 2],
  ] as const) {
    const small: Observation = {
      ...HEALTHY,
      width: w,
      height: h,
      windowWidth: w,
      windowHeight: h,
    }
    assert.equal(fillsWindow(small), true, `${name}: a frame filling its window read as too small`)
    const run = watchThrough(held(small, ticksFor(LIVENESS.muteAfterMs)))
    assert.equal(run.said.length, 0, `${name}: reported ${run.said.join(", ")}`)
  }
})

test("exactly at the threshold is not a fault; a pixel under it is", () => {
  const at: Observation = { ...HEALTHY, width: 820 * MIN_FILL, height: 1180 * MIN_FILL }
  assert.equal(fillsWindow(at), true, "the threshold is exclusive where it should be inclusive")
  assert.equal(fillsWindow({ ...at, height: at.height - 1 }), false)
})

test("one full measurement, ever, settles it — a stage animating in is not broken", () => {
  // The frame is zero for four seconds and then has a box. This is a stage
  // transitioning in, a frame measured before first layout, and a tab that has
  // just come back; all three had to be safe before this could ship at all.
  const collapsed: Observation = { ...HEALTHY, height: 0 }
  const run = watchThrough([
    ...held(collapsed, (LIVENESS.blankAfterMs / LIVENESS.pollMs) - 4),
    ...held(HEALTHY, ticksFor(LIVENESS.blankAfterMs)),
  ])
  assert.equal(run.said.length, 0, `an animating stage was accused of ${run.said.join(", ")}`)
  assert.equal(run.watch.everFilled, true)
})

test("a frame that had a box and then lost it is the host's doing, not the pack's", () => {
  // The other half of the latch, and the reason it is a latch rather than a
  // first-few-seconds grace. A pack's stage either has a box or it does not, and
  // which one is settled at mount; a frame going to zero *after* a minute of
  // being fine is the host — a sheet, a rotation, a route change, a teardown —
  // and blaming the pack for it would fire on every game a child ever leaves.
  const run = watchThrough([
    ...held(HEALTHY, 40),
    ...held({ ...HEALTHY, height: 0 }, ticksFor(LIVENESS.blankAfterMs) * 4),
  ])
  assert.equal(run.said.length, 0, `a pack the host put away was accused of ${run.said.join(", ")}`)
})

test("time spent hidden or unmeasurable is not counted, however long it lasts", () => {
  const cases: Array<[string, Observation]> = [
    // A backgrounded tab. Layout may be stale and rAF is stopped; nothing
    // measured here is evidence about the pack.
    ["a backgrounded app", { ...HEALTHY, visible: false, width: 0, height: 0, messages: 0 }],
    // The host hid the frame itself: a sheet over a paused pack, a teardown in
    // flight, an ancestor with `display: none`.
    ["a frame the host hid", { ...HEALTHY, measurable: false, width: 0, height: 0, messages: 0 }],
  ]
  for (const [name, observation] of cases) {
    const run = watchThrough(held(observation, ticksFor(LIVENESS.muteAfterMs)))
    assert.equal(run.said.length, 0, `${name}: reported ${run.said.join(", ")}`)
    assert.equal(run.watch.visibleMs, 0, `${name}: unusable time was counted against the pack`)
  }
})

test("a hidden app that comes back is judged on what it does afterwards, not before", () => {
  const hiddenBlank: Observation = { ...HEALTHY, visible: false, height: 0, messages: 0 }
  const visibleBlank: Observation = { ...HEALTHY, height: 0, messages: 0 }
  const run = watchThrough([
    ...held(hiddenBlank, 400),
    ...held(visibleBlank, ticksFor(LIVENESS.blankAfterMs)),
  ])
  assert.deepEqual(run.said, ["no-room"])
  // The five seconds were the visible ones, not the hundred spent hidden.
  assert.ok(
    run.watch.visibleMs < 400 * LIVENESS.pollMs,
    "hidden time was charged to the pack after all",
  )
})

test("a pack that spoke once is never called mute, however long it then idles", () => {
  // Measured in a framed pack: 129 messages in the first 1.3 seconds and 13 more
  // across the next five, whether anyone was playing or not. A gap in traffic is
  // an idle child as often as a dead pack, so only never-having-spoken counts.
  const idle: Observation = { ...HEALTHY, messages: 129 }
  const run = watchThrough(held(idle, ticksFor(LIVENESS.muteAfterMs) * 4))
  assert.equal(run.said.length, 0, `an idle pack was accused of ${run.said.join(", ")}`)
})

test("a pack that took its port and never used it is reported, once, after 30s", () => {
  const mute: Observation = { ...HEALTHY, messages: 0 }
  const early = watchThrough(held(mute, LIVENESS.muteAfterMs / LIVENESS.pollMs - 1))
  assert.equal(early.said.length, 0, "the watch accused a pack that was still starting up")

  const run = watchThrough(held(mute, ticksFor(LIVENESS.muteAfterMs)))
  assert.deepEqual(run.said, ["never-spoke"])
})

test("a pack that was not granted items is not expected to ask for one", () => {
  const mute: Observation = { ...HEALTHY, messages: 0 }
  const run = watchThrough(held(mute, ticksFor(LIVENESS.muteAfterMs) * 4), false)
  assert.equal(run.said.length, 0, `a pack with no items grant was accused of ${run.said.join(", ")}`)
  assert.equal(stillWatching(run.watch, 0, false), false, "it is still being polled for nothing")
})

test("a pack that is both blank and mute is told about both, and each once", () => {
  const dead: Observation = { ...HEALTHY, width: 820, height: 0, messages: 0 }
  const run = watchThrough(held(dead, ticksFor(LIVENESS.muteAfterMs)))
  assert.deepEqual(run.said, ["no-room", "never-spoke"])
  assert.deepEqual(run.watch.said, ["no-room", "never-spoke"])
})

test("what is said names the pack, the measurement, and the lie it contradicts", () => {
  const blank = describeFault("dynawalla.fuse", "no-room", { ...HEALTHY, width: 300, height: 150 })
  assert.match(blank, /dynawalla\.fuse/)
  assert.match(blank, /300x150/, "the message does not say what was measured")
  assert.match(blank, /820x1180/, "the message does not say what it was measured against")

  const mute = describeFault("dynawalla.fuse", "never-spoke", { ...HEALTHY, messages: 0 })
  assert.match(mute, /dynawalla\.fuse/)
  // The whole reason this fault is worth reporting: every game's entry answers a
  // failed start by drawing "<GAME> runs inside Dynawalla", which is the
  // standalone message. When the host sees this fault it knows that is false.
  assert.match(mute, /runs\s+inside Dynawalla/)
  assert.match(mute, /false/)
})

/* -------------------------------------------------------------------------- */
/* Why the box is worth watching at all: the host's own stylesheet.            */
/* -------------------------------------------------------------------------- */

/** The declarations of one rule in the real `packs.css`. */
function packsCssRule(selector: string): Map<string, string> {
  const css = readFileSync(new URL("./packs.css", import.meta.url), "utf8")
  // Comments first: `packs.css` is mostly prose, and a selector inside a comment
  // is not a rule.
  const source = css.replace(/\/\*[\s\S]*?\*\//g, "")
  const rule = new RegExp(`${selector.replace(".", "\\.")}\\s*\\{([^}]*)\\}`).exec(source)
  assert.ok(rule, `packs.css has no ${selector} rule; this test is measuring the wrong element`)
  const declarations = new Map<string, string>()
  for (const part of (rule[1] ?? "").split(";")) {
    const colon = part.indexOf(":")
    if (colon < 0) continue
    declarations.set(part.slice(0, colon).trim(), part.slice(colon + 1).trim())
  }
  return declarations
}

/** Every way a box can be given a size of its own, in one place. */
const OWN_SIZE = [
  "height",
  "block-size",
  "min-height",
  "min-block-size",
  "width",
  "min-width",
  "min-inline-size",
  "aspect-ratio",
]

test("the frame's box is entirely its ancestor's, which is why it is watched", () => {
  // The precondition the `no-room` fault exists for, read out of the real
  // stylesheet rather than restated. `.pack-frame` is 100% of `.pack-frame-host`,
  // which is 100% of the `fixed; inset: 0` div in `Stage.tsx`. Nothing in the
  // chain has a size of its own, so the whole app is one edit away from handing a
  // child a 300x150 iframe where a game should be.
  //
  // If this ever fails because the frame was given a real size, the fault is less
  // necessary than it is today — and that is worth knowing deliberately rather
  // than by a test quietly going green.
  for (const selector of [".pack-frame", ".pack-frame-host"]) {
    const rule = packsCssRule(selector)
    assert.equal(rule.get("block-size"), "100%", `${selector} no longer sizes by percentage`)
    assert.equal(rule.get("inline-size"), "100%", `${selector} no longer sizes by percentage`)
    for (const property of OWN_SIZE) {
      if (property === "block-size") continue
      // `.pack-frame-host` sets `min-inline-size: 0`, which takes a size away
      // rather than giving one.
      if (property === "min-inline-size" && rule.get(property) === "0") continue
      assert.equal(rule.get(property), undefined, `${selector} now has its own ${property}`)
    }
  }
})

/**
 * An iframe's intrinsic size — what a replaced element falls back to when its
 * percentage has nothing to resolve against. Not a choice of this codebase's:
 * measured in a browser at exactly this, against this stylesheet.
 */
const IFRAME_DEFAULT = { width: 300, height: 150 }

/**
 * The used box of the frame, given the box of the ancestor `Stage.tsx` wraps it in.
 *
 * Resolved from what `packs.css` actually declares, down the real chain
 * `.pack-frame-host` -> `.pack-frame`, rather than from what the file is
 * remembered to say. A deliberately tiny slice of CSS and only the slice the
 * frame's box depends on: a percentage of the containing block, an explicit
 * length, or — when the containing block has no definite size of its own and the
 * percentage therefore cannot resolve — the replaced element's intrinsic default.
 *
 * `null` on an axis is a containing block with no definite size on that axis,
 * which is what taking `fixed; inset: 0` off the stage div produces. It is passed
 * *through the real declarations* rather than short-circuited, so this returns
 * 300x150 only because `packs.css` really does size both boxes by percentage.
 */
function frameBox(ancestor: {
  width: number | null
  height: number | null
}): { width: number; height: number } {
  const resolve = (
    declared: string | undefined,
    against: number | null,
    intrinsic: number,
  ): number | null => {
    if (declared === undefined) return null
    if (declared.endsWith("px")) return Number.parseFloat(declared)
    if (!declared.endsWith("%")) return null
    // A percentage of an indefinite containing block does not resolve. For an
    // iframe — a replaced element — what is left is its intrinsic size.
    return against === null ? intrinsic : (against * Number.parseFloat(declared)) / 100
  }

  let box: { width: number | null; height: number | null } = { ...ancestor }
  for (const selector of [".pack-frame-host", ".pack-frame"]) {
    const rule = packsCssRule(selector)
    box = {
      width: resolve(rule.get("inline-size"), box.width, IFRAME_DEFAULT.width),
      height: resolve(rule.get("block-size"), box.height, IFRAME_DEFAULT.height),
    }
  }
  return {
    width: box.width ?? IFRAME_DEFAULT.width,
    height: box.height ?? IFRAME_DEFAULT.height,
  }
}

test("the box the host's chain hands the frame, in both states, is what the watch judges", () => {
  // The arithmetic joined to the fault. The frame's box IS the stage div's, so the
  // failure is one edit away in `Stage.tsx` or in one rule here — and both
  // directions are asserted, because a check that fires on a healthy 820x1180
  // frame is worse than no check at all.
  const window = { windowWidth: 820, windowHeight: 1180 }
  const healthy = frameBox({ width: 820, height: 1180 })
  assert.deepEqual(healthy, { width: 820, height: 1180 }, "the frame no longer fills its ancestor")

  const broken = frameBox({ width: null, height: null })
  // The measurement, pinned, and reached through the real declarations rather than
  // asserted about a constant: a percentage of an indefinite box does not resolve,
  // and what an iframe is left with is 300x150. If this ever stops being that, the
  // threshold above was derived against a shape that no longer happens.
  assert.deepEqual(broken, IFRAME_DEFAULT, "a boxless ancestor no longer defaults the frame")
  assert.equal(fillsWindow({ ...HEALTHY, ...broken, ...window }), false)

  const good = watchThrough(held({ ...HEALTHY, ...healthy, ...window }, ticksFor(LIVENESS.blankAfterMs)))
  assert.equal(good.said.length, 0, `a full-size frame was accused of ${good.said.join(", ")}`)

  const bad = watchThrough(held({ ...HEALTHY, ...broken, ...window }, ticksFor(LIVENESS.blankAfterMs)))
  assert.deepEqual(bad.said, ["no-room"], "a defaulted frame went unreported")
})

/* -------------------------------------------------------------------------- */
/* The same two faults, through the real mount.                                */
/* -------------------------------------------------------------------------- */

/**
 * Short clocks, so the suite does not wait out half a minute of real time.
 *
 * Only ONE fault is armed at a time. Both thresholds live on the same visible
 * clock, so a test that shortened both would be racing its own assertion against
 * the second fault arriving — the exact shape of flake this file's `until`
 * helper was written to avoid.
 */
const WATCH_BOX: Partial<LivenessLimits> = { pollMs: 4, blankAfterMs: 24, muteAfterMs: 3_600_000 }
const WATCH_MUTE: Partial<LivenessLimits> = { pollMs: 4, blankAfterMs: 3_600_000, muteAfterMs: 40 }

test("the watch starts at the handshake, not before it", async (t) => {
  // A pack that never says `ready` is the handshake timeout's business, and
  // accusing it of silence as well would be two messages about one failure.
  t.mock.method(console, "error", () => {})
  const test = harness(t, { box: { width: 0, height: 0 }, liveness: { pollMs: 4, blankAfterMs: 24, muteAfterMs: 40 } })
  await new Promise((resolve) => setTimeout(resolve, 150))
  assert.equal(test.faults.length, 0, `an unconnected pack was accused of ${test.faults.join(", ")}`)
})

test("a mounted pack whose frame has no box is reported through the real mount", async (t) => {
  const said: string[] = []
  t.mock.method(console, "error", (message: string) => said.push(message))
  const test = harness(t, { box: { width: 820, height: 0 }, liveness: WATCH_BOX })
  shake(test)

  await until(() => test.faults.includes("no-room"))
  assert.deepEqual(test.faults, ["no-room"])
  assert.deepEqual(test.mounted.faults(), ["no-room"])
  // Once. A 250ms poll over a forty-minute session would otherwise be ten
  // thousand copies of the same line, which is a log nobody reads.
  await new Promise((resolve) => setTimeout(resolve, 60))
  assert.deepEqual(test.faults, ["no-room"], "the fault was repeated")
  assert.equal(said.length, 1, "the fault was not said out loud exactly once")
  assert.match(said[0] ?? "", /820x0/)
})

test("a frame that gains a box before the grace runs out is never reported", async (t) => {
  t.mock.method(console, "error", () => {})
  const test = harness(t, { box: { width: 820, height: 0 }, liveness: WATCH_BOX })
  shake(test)
  await new Promise((resolve) => setTimeout(resolve, 8))
  test.setBox(820, 1180)

  await new Promise((resolve) => setTimeout(resolve, 150))
  assert.equal(test.faults.length, 0, `reported ${test.faults.join(", ")}`)
})

test("a pack that uses its port is never called mute; one that does not, is", async (t) => {
  t.mock.method(console, "error", () => {})
  const talker = harness(t, { liveness: WATCH_MUTE })
  shake(talker)
  const port = talker.posted[0]?.transfer[0]
  assert.ok(port)
  t.after(() => port.close())
  port.start()
  port.postMessage({ id: 1, method: "items.next", params: {} })

  const mute = harness(t, { liveness: WATCH_MUTE })
  shake(mute)

  await until(() => mute.faults.includes("never-spoke"))
  assert.deepEqual(mute.faults, ["never-spoke"], "a pack that never spoke was not reported")
  assert.equal(
    talker.faults.length,
    0,
    `a pack that used its port was accused of ${talker.faults.join(", ")}`,
  )
})

test("disposing stops the watch, and clears its timer", async (t) => {
  // Two claims, and the second is the expensive one.
  //
  // "A disposed pack is not accused" passes with the interval still running,
  // because `tick` also returns early once `disposed` is set — so asserting only
  // that would prove nothing about the teardown. What has to be asserted is the
  // handle: a repeating timer nobody cleared keeps node's event loop alive, and
  // this file's own harness note is about the fifteen minutes of runner time the
  // last leaked handle here cost.
  const started: unknown[] = []
  const stopped: unknown[] = []
  const reallySet = globalThis.setInterval
  const reallyClear = globalThis.clearInterval
  t.mock.method(globalThis, "setInterval", ((...args: Parameters<typeof globalThis.setInterval>) => {
    const id = reallySet(...args)
    started.push(id)
    return id
  }) as typeof globalThis.setInterval)
  t.mock.method(globalThis, "clearInterval", ((id: Parameters<typeof globalThis.clearInterval>[0]) => {
    stopped.push(id)
    reallyClear(id)
  }) as typeof globalThis.clearInterval)
  // So that this test *fails* rather than hangs when the assertion below trips.
  // A 4ms interval nobody cleared keeps node's loop alive, and the last leaked
  // handle in this file turned a 700ms run into forty-five seconds.
  t.after(() => {
    for (const id of started) reallyClear(id as Parameters<typeof globalThis.clearInterval>[0])
  })
  t.mock.method(console, "error", () => {})

  const test = harness(t, { box: { width: 0, height: 0 }, liveness: WATCH_BOX })
  shake(test)
  assert.equal(started.length, 1, "the handshake started no liveness watch at all")

  test.mounted.dispose()
  assert.equal(stopped.length, 1, "dispose cleared no interval")
  assert.equal(stopped[0], started[0], "dispose cleared some other interval")

  await new Promise((resolve) => setTimeout(resolve, 150))
  assert.equal(test.faults.length, 0, `a disposed pack was accused of ${test.faults.join(", ")}`)
})

/* ─── native-backed capabilities, at the frame ────────────────────────────── */

test("the connect payload states what is granted AND what this device can do", async (t) => {
  // Two different questions, and conflating them is the mistake the field exists
  // to prevent. A grant is a decision about a pack; availability is a fact about
  // a device — a tablet with no gyroscope, a build with no plugin, a permission
  // somebody declined.
  const test1 = harness(t, {
    granted: ["items", "sensors.orientation"],
    services: { available: () => ["items", "haptics"] },
  })
  shake(test1)
  await until(() => test1.mounted.connected())
  const connect = test1.posted[0]?.data as Connect
  assert.deepEqual([...connect.granted], ["items", "sensors.orientation"])
  // Intersected, so "available" can never exceed "granted": `haptics` is
  // something this device can do and this pack did not ask for.
  assert.deepEqual([...(connect.available ?? [])], ["items"])
})

test("everything granted is available when the device can do it all", async (t) => {
  const test1 = harness(t, { granted: ["items", "sensors.orientation"] })
  shake(test1)
  await until(() => test1.mounted.connected())
  const connect = test1.posted[0]?.data as Connect
  assert.deepEqual([...(connect.available ?? [])], ["items", "sensors.orientation"])
})

test("no sensor outlives the pack it was started for", async (t) => {
  // The failure this is the net for is invisible: a stream left open holds a
  // subscription in the host's realm, the frame is removed, the child goes back
  // to the catalogue, and the sensor keeps running for the rest of the app's
  // life with nothing on the other end of it.
  let released = 0
  const test1 = harness(t, {
    granted: ["sensors.orientation"],
    services: {
      sensors: {
        orientation: async () => () => {
          released += 1
        },
      },
    },
  })
  shake(test1)
  await until(() => test1.mounted.connected())
  const started = await test1.mounted.bridge.handle({
    id: 1,
    method: "sensors.orientation.start",
    params: {},
  })
  assert.ok(started?.ok)
  assert.deepEqual(test1.mounted.bridge.streams(), [1])

  test1.mounted.dispose()
  assert.equal(released, 1, "the pack was torn down and the sensor was not")
  assert.deepEqual(test1.mounted.bridge.streams(), [])
})

test("stream samples reach the pack's port, and a paused pack gets none", async (t) => {
  // Read from the pack's own end of the port — the one the frame transferred —
  // so this is the wire and not a spy on the bridge. Two things it holds that
  // nothing else does: `push` is actually wired to the port at all, and `send`
  // reaches `setPaused`, without which a game keeps steering behind the day-pass
  // sheet.
  const feed: ((sample: Orientation) => void)[] = []
  const test1 = harness(t, {
    granted: ["sensors.orientation"],
    services: {
      sensors: {
        orientation: async (input) => {
          feed.push(input.emit)
          return () => {}
        },
      },
    },
  })
  shake(test1)
  await until(() => test1.mounted.connected())

  const port = test1.posted[0]?.transfer[0]
  assert.ok(port, "no port was transferred")
  const seen: StreamUpdate[] = []
  port.onmessage = (event: MessageEvent) => {
    const data: unknown = event.data
    if (data !== null && typeof data === "object" && "seq" in data) seen.push(data as StreamUpdate)
  }
  port.start()
  t.after(() => {
    port.onmessage = null
  })

  await test1.mounted.bridge.handle({ id: 1, method: "sensors.orientation.start", params: {} })
  const emit = feed[0]
  assert.ok(emit)

  const sample: Orientation = { x: 0.5, y: 0, degrees: { x: 12, y: 0 } }
  emit(sample)
  await until(() => seen.length === 1)
  assert.deepEqual(seen, [{ stream: 1, seq: 1, data: sample }])

  test1.mounted.send("pause")
  emit(sample)
  emit(sample)
  await new Promise((resolve) => setTimeout(resolve, 20))
  assert.equal(seen.length, 1, "a paused pack was still being fed")

  test1.mounted.send("resume")
  emit(sample)
  await until(() => seen.length === 2)
  // The gap is visible in `seq`, which is exactly what `seq` is for: the pack can
  // tell that samples were dropped rather than that the sensor went quiet.
  assert.deepEqual(
    seen.map((message) => message.seq),
    [1, 2],
  )
  assert.deepEqual(test1.mounted.bridge.streams(), [1])
})
