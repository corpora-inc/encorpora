// The pack's side of the wire: `connect()` and a typed client.
//
// A pack does `const host = await connect()` and then calls methods. It never
// touches `postMessage`, never sees an envelope, and never has to know that the
// grant set it was given is the reason a method it declared is missing — the
// client simply does not expose an ungranted surface, so "hide what you cannot
// drive" is the default rather than a discipline.
//
// The handshake, in full:
//
//   1. The pack document loads and this module posts `{ event: "ready" }` to
//      its parent.
//   2. The host answers by transferring one end of a `MessageChannel`.
//   3. Everything after that is on the port.
//
// Step 2 is the capability: an opaque-origin frame has no reference to the
// host, cannot name it, and cannot obtain a port by asking a third party for
// one. The `connect` payload itself carries no secret — a token would have to
// be posted with `targetOrigin: "*"` (an opaque origin cannot be named either)
// and would therefore be worth nothing.

import type { Capability, Method } from "./capabilities.ts"
import { budgetOf, permits } from "./capabilities.ts"
import type {
  Connect,
  HapticCue,
  HostEventName,
  Item,
  Judgement,
  LearnerSummary,
  Orientation,
  Settings,
  SoundCue,
  TransitionKind,
} from "./protocol.ts"
import {
  isConnect,
  isOrientation,
  isResponse,
  isStreamEnd,
  isStreamUpdate,
  PROTOCOL_VERSION,
} from "./protocol.ts"
import { installTapZoomGuard } from "./tapzoom.ts"

/**
 * Say something to whoever is building this pack, once, and loudly.
 *
 * The rule for a native-backed capability is that absence is **loud to the
 * developer and invisible to the child**: a tablet with no gyroscope is not a
 * fault and a child must never see a message about one, but a pack author whose
 * tilt control silently does nothing has to be told why, in a sentence that
 * names what to do. Four packs have shipped blank in this repository and every
 * one of them was quiet about it.
 *
 * `console.error` rather than `warn`: Vite's dev client forwards errors to the
 * terminal and nothing else, and on a device this is what reaches a
 * WebInspector session. Once per reason **per connected pack**, because a game
 * loop would otherwise print it sixty times a second and the message would
 * become the noise it is meant to cut through — and per pack rather than per
 * process so that the second pack a session mounts is told the same things as
 * the first.
 */
function makeAnnouncer(): (key: string, message: string) => void {
  const said = new Set<string>()
  return (key, message) => {
    if (said.has(key)) return
    said.add(key)
    console.error(message)
  }
}

/**
 * Reading the tilt of the device, as a pack sees it.
 *
 * Shaped so that **absence is not an error path**. `start` never throws and
 * never returns a rejected promise; on a device that cannot do this it returns a
 * stop function that stops nothing and the handler is simply never called. A
 * game therefore needs no try/catch and no fallback branch to be correct — it
 * needs one `available` check, and only if it draws a control that would
 * otherwise be a lie.
 */
export type TiltReader = {
  /**
   * Whether this device can report a tilt right now.
   *
   * False when the pack did not declare `sensors.orientation`, when the build
   * has no orientation source, when the hardware has no sensor, or when a
   * permission was declined. A pack is told the answer, never the reason: which
   * of those it is is not a pack's business and is not stable enough to branch
   * on.
   */
  readonly available: boolean
  /**
   * Start reading. Returns a stop function; both are always safe to call.
   *
   * Stop is idempotent, is safe before the stream has even opened, and is safe
   * after the host has closed it. Call it when the child leaves the part of the
   * game that steers — the host ends every stream at teardown regardless, so
   * nothing outlives the pack, but a sensor running behind a menu is a sensor
   * costing a battery for nothing.
   */
  start(onSample: (sample: Orientation) => void): () => void
}

export class PackError extends Error {
  readonly code: string
  constructor(code: string, message: string) {
    super(message)
    this.name = "PackError"
    this.code = code
  }
}

/**
 * What a pack may ask for when it asks for a question.
 *
 * Every field is a *request*, never an instruction. The host owns the ladder,
 * and a pack that names something the host cannot serve gets the nearest thing
 * the host has rather than an error — a pack built against a later curriculum
 * must still be playable.
 */
export type ItemRequest = {
  /** A skill the pack covers. An unknown id falls back to the ladder. */
  readonly skillId?: string
  /**
   * How hard, 0..1, across the host's whole ladder: 0 is the easiest content
   * the host can generate and 1 the hardest.
   *
   * Relative rather than absolute because a pack cannot know how many rungs the
   * host has, and because the floor moves: when the curriculum grows easier
   * rungs, 0 follows them down and no pack has to be rebuilt. The item that
   * comes back reports the position it was actually drawn from, on the same
   * scale, so a pack can see when a request was clamped.
   */
  readonly difficulty?: number
  /** A ceiling on the same 0..1 scale. Never serve harder than this. */
  readonly maxDifficulty?: number
}

export type HostClient = {
  readonly packId: string
  /** The host app's version, for a pack that renders a compatibility note. */
  readonly hostVersion: string
  readonly granted: readonly Capability[]
  /**
   * The granted capabilities this device can actually do.
   *
   * A subset of `granted`. Everything that is not native-backed is always in
   * here; a native one may be missing because the hardware, the build or a
   * person said no. See `available`.
   */
  readonly usable: readonly Capability[]
  /** Live: re-read it, it follows the host's `settings` event. */
  readonly settings: Settings

  can(method: Method): boolean
  /**
   * Whether a granted capability can do anything on this device.
   *
   * The check to write before **drawing a control** that depends on a native
   * capability — an on/off switch for tilt steering, a "read it to me" button.
   * It is not the check to write before *calling* one: calling an unavailable
   * capability is already harmless, and a guard on every call site is a guard
   * somebody will forget.
   */
  available(capability: Capability): boolean

  /** The next question for this pack, or `null` when the host has none. */
  nextItem(options?: ItemRequest): Promise<Item | null>
  /**
   * Record an attempt and learn whether it was right.
   *
   * The attempt is recorded before the answer comes back, which is what makes
   * `canonical` safe to return: there is no way to read it without spending
   * the attempt.
   */
  answer(input: {
    itemId: string
    response: string
    latencyMs: number
    revisions?: number
  }): Promise<Judgement>
  skip(itemId: string): Promise<void>
  /** Requires the `items.reveal` capability. */
  reveal(itemId: string): Promise<string>

  learnerSummary(): Promise<LearnerSummary>
  haptic(cue: HapticCue): Promise<void>
  sound(cue: SoundCue): Promise<void>
  milestone(name: string): Promise<void>

  /** Requires the `sensors.orientation` capability. Degrades to nothing. */
  readonly tilt: TiltReader

  storage: {
    get(key: string): Promise<string | null>
    set(key: string, value: string): Promise<void>
    remove(key: string): Promise<void>
    keys(): Promise<string[]>
  }

  /** Fraction in 0–1. The host draws the progress, the pack does not. */
  progress(fraction: number): Promise<void>
  end(reason: "finished" | "quit"): Promise<void>
  /**
   * Something ended by itself: a level cleared, a run completed, a boss down.
   *
   * Call it and keep going — the promise resolves immediately and the pack is
   * not told what the host did with it. What the host may do is put something
   * over the frame, in which case the pack receives `pause` through `on` in the
   * usual way, so a game that already handles `pause` handles this too.
   *
   * **Never send one after a failure.** See `TransitionKind`.
   */
  transition(kind: TransitionKind, label?: string): Promise<void>

  on(event: HostEventName, listener: (data: unknown) => void): () => void
  dispose(): void
}

type Pending = {
  resolve: (value: unknown) => void
  reject: (error: PackError) => void
  /** Armed from `budgetOf(method)`. See `call`. */
  timer: ReturnType<typeof setTimeout>
}

/** One open stream, from the pack's side. */
type Sink = {
  /** The highest `seq` delivered. A repeat or a reordering is dropped. */
  lastSeq: number
  deliver: (data: unknown) => void
}

const DEFAULT_TIMEOUT_MS = 15_000

/**
 * Wait for the host to hand over a port.
 *
 * Rejects rather than hanging: a pack that is loaded outside a host — opened
 * directly in a browser, say — should say so on its own surface instead of
 * showing a frozen loading state forever.
 */
export function connect(options: { timeoutMs?: number } = {}): Promise<HostClient> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  // Before the handshake, not after it. A pack draws a loading state while it
  // waits for a port, and a child tapping at that is exactly as able to zoom
  // the host as one tapping at a running game. See `tapzoom.ts` for why this
  // belongs to the pack and cannot belong to the host.
  installTapZoomGuard()
  return new Promise<HostClient>((resolve, reject) => {
    if (typeof window === "undefined" || window.parent === window) {
      reject(new PackError("no_host", "this document is not framed by a Dynawalla host"))
      return
    }

    const timer = setTimeout(() => {
      window.removeEventListener("message", onMessage)
      reject(new PackError("timeout", `no host connect within ${timeoutMs}ms`))
    }, timeoutMs)

    const onMessage = (event: MessageEvent) => {
      if (!isConnect(event.data)) return
      const port = event.ports[0]
      if (!port) return
      clearTimeout(timer)
      window.removeEventListener("message", onMessage)
      resolve(makeClient(event.data, port))
    }

    window.addEventListener("message", onMessage)
    // The host is listening for this before it frames anything.
    window.parent.postMessage({ event: "ready", protocol: PROTOCOL_VERSION }, "*")
  })
}

function makeClient(connectMessage: Connect, port: MessagePort): HostClient {
  const pending = new Map<number, Pending>()
  const streams = new Map<number, Sink>()
  const listeners = new Map<HostEventName, Set<(data: unknown) => void>>()
  let nextId = 1
  let closed = false

  const settings: { current: Settings } = { current: connectMessage.settings }
  const announce = makeAnnouncer()

  // A 1.0 host does not send `available`. Falling back to `granted` restores
  // exactly what a pack on that host was already assuming, rather than reading
  // a missing field as "nothing works".
  const usable: readonly Capability[] = connectMessage.available ?? connectMessage.granted
  const usableSet = new Set<Capability>(usable)

  port.onmessage = (event: MessageEvent) => {
    const data: unknown = event.data
    // Streams first: on an open sensor these outnumber everything else on the
    // port by two orders of magnitude, and none of the shapes overlap — an
    // update carries `stream`, a response carries `id`, an event carries
    // `event`.
    if (isStreamUpdate(data)) {
      const sink = streams.get(data.stream)
      if (!sink) return
      // Monotonic from 1, so a repeat or a reordering is a host bug and is
      // dropped rather than fed to a game as a step backwards in time.
      if (data.seq <= sink.lastSeq) return
      sink.lastSeq = data.seq
      sink.deliver(data.data)
      return
    }
    if (isStreamEnd(data)) {
      const sink = streams.get(data.stream)
      streams.delete(data.stream)
      if (sink && data.reason === "unavailable") {
        announce(
          "stream-unavailable",
          "[pack] the host ended a stream because the device stopped being able to " +
            "feed it. Nothing is wrong with this pack; whatever it was reading is " +
            "gone until the next launch, and the game has to keep playing without it.",
        )
      }
      return
    }
    if (isResponse(data)) {
      const entry = settle(data.id)
      if (!entry) return
      if (data.ok) entry.resolve(data.result)
      else entry.reject(new PackError(data.error.code, data.error.message))
      return
    }
    if (typeof data === "object" && data !== null && "event" in data) {
      const name = (data as { event: HostEventName }).event
      const payload = (data as { data?: unknown }).data
      if (name === "settings" && payload && typeof payload === "object") {
        settings.current = payload as Settings
      }
      for (const listener of listeners.get(name) ?? []) listener(payload)
      if (name === "dispose") close()
    }
  }
  port.start()

  /**
   * Take a pending call off the book and disarm its deadline.
   *
   * One function, so that no path can resolve a promise and leave its timer
   * armed. A timer that fires after its promise settled is harmless today —
   * `pending` no longer has the id — but it is harmless by luck rather than by
   * construction, and a leaked timer per call is a leak per call.
   */
  const settle = (id: number): Pending | null => {
    const entry = pending.get(id)
    if (!entry) return null
    pending.delete(id)
    clearTimeout(entry.timer)
    return entry
  }

  const close = () => {
    if (closed) return
    closed = true
    for (const id of [...pending.keys()]) {
      const entry = settle(id)
      entry?.reject(new PackError("closed", "the host closed this pack"))
    }
    pending.clear()
    // Not cancelled over the wire: the port is about to close and the host ends
    // every stream it opened for this pack at teardown. Dropping the sinks is
    // what stops a late sample reaching a game that has already been torn down.
    streams.clear()
    port.onmessage = null
    port.close()
  }

  const call = (method: Method, params: Record<string, unknown> = {}): Promise<unknown> => {
    if (closed) return Promise.reject(new PackError("closed", "the host closed this pack"))
    if (!permits(connectMessage.granted, method)) {
      // Locally, without a round trip: the host would refuse this anyway, and a
      // pack should not be able to tell the difference between a capability it
      // did not declare and one the parent declined.
      return Promise.reject(new PackError("denied", `${method} was not granted to this pack`))
    }
    const id = nextId++
    const budget = budgetOf(method)
    return new Promise<unknown>((resolve, reject) => {
      // The deadline. Before this, a host that never answered left the pack
      // holding a promise that never settled — no error, no log, and a game
      // stuck on a loading state forever. The budget is the capability's own,
      // declared in `capabilities.ts`, because "how long may this take" is part
      // of the contract and not something a pack should have to guess: two
      // seconds for a store read, ten for something that may have to ask a
      // person for permission first.
      const timer = setTimeout(() => {
        pending.delete(id)
        reject(new PackError("timeout", `${method} did not answer within ${String(budget)}ms`))
      }, budget)
      pending.set(id, { resolve, reject, timer })
      port.postMessage({ id, method, params })
    })
  }

  /**
   * Open a stream and route it, or say why not and route nothing.
   *
   * The whole degradation policy for a native capability lives here, once, so
   * that adding text-to-speech or an on-device model is a call to this rather
   * than a second copy of the same four failure branches.
   */
  const openStream = (
    method: Method,
    capability: Capability,
    params: Record<string, unknown>,
    deliver: (data: unknown) => void,
  ): (() => void) => {
    const noop = () => {}
    if (!permits(connectMessage.granted, method)) {
      announce(
        `ungranted:${capability}`,
        `[pack] this pack called ${method} without declaring "${capability}" in its ` +
          `manifest, so nothing will happen. Add it to \`capabilities\` in ` +
          `manifest.json and rebuild the pack. A child sees no error, which is why ` +
          `this line is the only sign.`,
      )
      return noop
    }
    if (!usableSet.has(capability)) {
      announce(
        `unavailable:${capability}`,
        `[pack] "${capability}" was granted but this device cannot do it, so ` +
          `${method} will not be called and nothing will happen. This is not a bug ` +
          `and it is not rare — the build may have shipped without the plugin, the ` +
          `hardware may have no such sensor, or somebody may have declined a ` +
          `permission. Read host.available("${capability}") before drawing a ` +
          `control that depends on it, and make sure the game is playable without it.`,
      )
      return noop
    }

    let stream: number | null = null
    let stopped = false

    const cancel = (id: number) => {
      // `.catch` and not `await`: the pack is not told whether a cancel landed,
      // and a rejected cancel — the port already closed, say — is not a failure
      // a game can do anything about.
      void call("stream.cancel", { stream: id }).catch(() => {})
    }

    const stop = () => {
      if (stopped) return
      stopped = true
      if (stream === null) return
      streams.delete(stream)
      cancel(stream)
    }

    void call(method, params)
      .then((result) => {
        const handle = (result as { stream?: unknown } | null)?.stream
        if (typeof handle !== "number") {
          announce(
            `nohandle:${method}`,
            `[pack] ${method} answered without a stream handle, so no samples can be ` +
              `routed. This is a host bug rather than a pack bug; the game will run ` +
              `with nothing arriving on this stream.`,
          )
          return
        }
        // Stopped while the start was still in flight. The host has an open
        // stream it does not know is unwanted, so it is told.
        if (stopped || closed) {
          cancel(handle)
          return
        }
        stream = handle
        streams.set(handle, { lastSeq: 0, deliver })
      })
      .catch((error: unknown) => {
        const code = error instanceof PackError ? error.code : "unknown"
        announce(
          `startfailed:${method}`,
          `[pack] ${method} failed to start (${code}), so nothing will arrive on it. ` +
            `The game must keep playing: a child cannot be shown this and cannot fix it.`,
        )
      })

    return stop
  }

  const tilt: TiltReader = {
    available:
      permits(connectMessage.granted, "sensors.orientation.start") &&
      usableSet.has("sensors.orientation"),
    start: (onSample) =>
      openStream("sensors.orientation.start", "sensors.orientation", {}, (data) => {
        // Guarded even though the host is the more trusted side, because the
        // failure it prevents is silent: one NaN through a game's steering makes
        // every position after it NaN, the world vanishes, and nothing throws.
        if (isOrientation(data)) {
          onSample(data)
          return
        }
        announce(
          "badsample",
          "[pack] the host sent a tilt sample that is not one, and it was dropped. " +
            "Every sample carries x and y in −1..1 and degrees.x / degrees.y; " +
            "anything else would put a NaN through this game's steering.",
        )
      }),
  }

  return {
    packId: connectMessage.packId,
    hostVersion: connectMessage.host,
    granted: connectMessage.granted,
    usable,
    get settings() {
      return settings.current
    },

    can: (method) => permits(connectMessage.granted, method),
    available: (capability) =>
      connectMessage.granted.includes(capability) && usableSet.has(capability),

    nextItem: async (options = {}) => {
      // Built by omission rather than by sending `undefined`: a structured
      // clone carries an explicit `undefined` across, and the host's parameter
      // guards read "present but not a number" differently from "absent".
      const params: Record<string, unknown> = {}
      if (options.skillId !== undefined) params["skillId"] = options.skillId
      if (options.difficulty !== undefined) params["difficulty"] = options.difficulty
      if (options.maxDifficulty !== undefined) params["maxDifficulty"] = options.maxDifficulty
      const result = await call("items.next", params)
      return (result as { item: Item | null }).item
    },
    answer: async (input) =>
      (await call("items.answer", {
        itemId: input.itemId,
        response: input.response,
        latencyMs: input.latencyMs,
        revisions: input.revisions ?? 0,
      })) as Judgement,
    skip: async (itemId) => {
      await call("items.skip", { itemId })
    },
    reveal: async (itemId) =>
      ((await call("items.reveal", { itemId })) as { canonical: string }).canonical,

    learnerSummary: async () => (await call("learner.summary")) as LearnerSummary,
    haptic: async (cue) => {
      await call("feedback.haptic", { cue })
    },
    sound: async (cue) => {
      await call("feedback.sound", { cue })
    },
    milestone: async (name) => {
      await call("milestone.reach", { name })
    },

    tilt,

    storage: {
      get: async (key) => ((await call("storage.get", { key })) as { value: string | null }).value,
      set: async (key, value) => {
        await call("storage.set", { key, value })
      },
      remove: async (key) => {
        await call("storage.remove", { key })
      },
      keys: async () => ((await call("storage.keys")) as { keys: string[] }).keys,
    },

    progress: async (fraction) => {
      await call("session.progress", { fraction })
    },
    end: async (reason) => {
      await call("session.end", { reason })
    },
    transition: async (kind, label) => {
      await call("session.transition", label === undefined ? { kind } : { kind, label })
    },

    on: (event, listener) => {
      const set = listeners.get(event) ?? new Set()
      set.add(listener)
      listeners.set(event, set)
      return () => {
        set.delete(listener)
      }
    },

    dispose: close,
  }
}
