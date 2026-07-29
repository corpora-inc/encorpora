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
import { permits } from "./capabilities.ts"
import type {
  Connect,
  HapticCue,
  HostEventName,
  Item,
  Judgement,
  LearnerSummary,
  Settings,
  SoundCue,
  TransitionKind,
} from "./protocol.ts"
import { isConnect, isResponse, PROTOCOL_VERSION } from "./protocol.ts"
import { installTapZoomGuard } from "./tapzoom.ts"

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
  /** Live: re-read it, it follows the host's `settings` event. */
  readonly settings: Settings

  can(method: Method): boolean

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
  const listeners = new Map<HostEventName, Set<(data: unknown) => void>>()
  let nextId = 1
  let closed = false

  const settings: { current: Settings } = { current: connectMessage.settings }

  port.onmessage = (event: MessageEvent) => {
    const data: unknown = event.data
    if (isResponse(data)) {
      const entry = pending.get(data.id)
      if (!entry) return
      pending.delete(data.id)
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

  const close = () => {
    if (closed) return
    closed = true
    for (const entry of pending.values()) {
      entry.reject(new PackError("closed", "the host closed this pack"))
    }
    pending.clear()
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
    return new Promise<unknown>((resolve, reject) => {
      pending.set(id, { resolve, reject })
      port.postMessage({ id, method, params })
    })
  }

  return {
    packId: connectMessage.packId,
    hostVersion: connectMessage.host,
    granted: connectMessage.granted,
    get settings() {
      return settings.current
    },

    can: (method) => permits(connectMessage.granted, method),

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
