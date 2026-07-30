// The host's side of the wire. This is the enforcement point.
//
// Every message a pack ever sends arrives at `handle`. It is validated, gated,
// rate-limited, its parameters are checked, and only then does anything the
// host owns get called. There is no other path: `PackFrame` gives the pack one
// `MessagePort` and this module is the only thing on the other end of it.
//
// The order is fixed and matters:
//
//   shape → method exists → capability granted → rate → parameters → dispatch
//
// A denial must never depend on the parameters, or the error a pack gets back
// tells it something about what it was denied. And rate limiting sits before
// parameter validation so that a flood of malformed messages costs the same as
// a flood of well-formed ones.
//
// The bridge is deliberately ignorant of what an item is. It hands opaque
// values to `HostServices` and returns whatever comes back. The adaptive engine
// chooses, the curriculum judges, and neither of them is reachable from here
// except through that interface — which is what keeps this file a boundary
// rather than a second implementation of the practice loop.

import type {
  Capability,
  ErrorCode,
  HapticCue,
  Item,
  Judgement,
  LearnerSummary,
  Method,
  Orientation,
  Response,
  Settings,
  SoundCue,
  StreamEnd,
  StreamEndReason,
  StreamUpdate,
  TransitionKind,
} from "../../../packs/sdk/src/index.ts"
import {
  MAX_REQUESTS_PER_SECOND,
  isTransitionKind,
  numberParam,
  parseRequest,
  permits,
  stringParam,
  unitParam,
} from "../../../packs/sdk/src/index.ts"

/** A pack's own key-value store. Small on purpose: it is not a database. */
export const MAX_STORAGE_KEYS = 200
export const MAX_STORAGE_KEY_LENGTH = 128
export const MAX_STORAGE_VALUE_LENGTH = 16 * 1024

/** A latency a pack reports is clamped to this. Anything longer is not a fact. */
const MAX_LATENCY_MS = 10 * 60 * 1000
const MAX_REVISIONS = 1000

/**
 * How many streams one pack may hold open at once.
 *
 * A stream is a subscription to something outside the WebView — a sensor, and
 * one day a synthesiser or a model — and each one costs a device resource that
 * nothing else can reclaim. Four is more than any game has a use for and small
 * enough that a loop calling `start` cannot exhaust the device before the rate
 * limiter catches it.
 */
export const MAX_OPEN_STREAMS = 4

const HAPTIC_CUES: readonly HapticCue[] = ["tick", "seat", "settle", "refuse"]
const SOUND_CUES: readonly SoundCue[] = ["tick", "seat", "settle", "refuse", "arrive"]

/**
 * Everything the host can be asked to do, as one interface.
 *
 * The pack surface is this list and the SDK's method table, and they are the
 * same size on purpose. Adding a capability means adding a method here and a
 * row in the SDK's table; there is no way to add reach to a pack by editing
 * only one file.
 */
export type HostServices = {
  nextItem(input: {
    packId: string
    skillId?: string
    /** 0..1 across the host's whole ladder. A request, not an instruction. */
    difficulty?: number
    /** 0..1 ceiling. The stream never goes above it. */
    maxDifficulty?: number
  }): Promise<Item | null>
  /** Records the attempt and judges it. One call, in that order. */
  judge(input: {
    packId: string
    itemId: string
    response: string
    latencyMs: number
    revisions: number
  }): Promise<Judgement>
  skip(input: { packId: string; itemId: string }): Promise<void>
  reveal(input: { packId: string; itemId: string }): Promise<string>
  learnerSummary(input: { packId: string }): Promise<LearnerSummary>
  haptic(input: { packId: string; cue: HapticCue }): Promise<void>
  sound(input: { packId: string; cue: SoundCue }): Promise<void>
  milestone(input: { packId: string; name: string }): Promise<void>
  storage: {
    get(input: { packId: string; key: string }): Promise<string | null>
    set(input: { packId: string; key: string; value: string }): Promise<void>
    remove(input: { packId: string; key: string }): Promise<void>
    keys(input: { packId: string }): Promise<string[]>
  }
  /**
   * The native-backed surface: things answered by the device rather than here.
   *
   * Separated from everything above it because the shape is different, and the
   * difference is the whole reason `docs/NATIVE_CAPABILITIES.md` exists. A method
   * up there returns a value, quickly, always. One down here may have to ask
   * somebody for permission, may take seconds, may answer over time, and may
   * turn out to be impossible on this particular device — so it returns a
   * *subscription*, and `null` for "not on this hardware" is a first-class
   * answer rather than an error.
   */
  sensors: {
    /**
     * Start feeding orientation samples to `emit`.
     *
     * Resolves to a stop function, or `null` when this device cannot do it at
     * all — no source in the build, no sensor in the hardware, or a permission
     * somebody declined. `lost` is for the case that only shows up after
     * starting: subscribed successfully, and then nothing usable ever arrived.
     */
    orientation(input: {
      packId: string
      emit: (sample: Orientation) => void
      lost: () => void
    }): Promise<(() => void) | null>
  }
  /**
   * Everything this DEVICE can do, right now.
   *
   * Not what the build supports — `library.ts`'s `HOST_SUPPORTS` is that, and it
   * must never shrink to express a missing sensor, because a capability dropped
   * from it refuses to *install* a pack rather than letting the pack degrade.
   * This is the runtime layer: the frame intersects it with the pack's grants
   * and sends the result as `Connect.available`.
   */
  available(): readonly Capability[]
  progress(input: { packId: string; fraction: number }): void
  end(input: { packId: string; reason: "finished" | "quit" }): void
  /**
   * A natural stopping point the pack reached. The host decides what, if
   * anything, happens next; the pack is told nothing.
   */
  transition(input: { packId: string; kind: TransitionKind; label?: string }): void
  settings(): Settings
}

export type Bridge = {
  /** One message in, one response out. `null` for a message with no reply. */
  handle(message: unknown): Promise<Response | null>
  /**
   * Stop delivering stream samples, or start again.
   *
   * A paused pack is a pack with something over it — the day-pass sheet — and a
   * game steering behind a sheet is a game the child is not playing. The samples
   * are **dropped**, not queued: a buffer of stale tilt delivered all at once on
   * resume would snap whatever it steers across the screen. The gap shows up in
   * the stream's `seq`, which is exactly what `seq` is for.
   */
  setPaused(paused: boolean): void
  /**
   * End every open stream and release what is behind it.
   *
   * The one guarantee that matters here: **nothing outlives the pack.** A sensor
   * left running after a child leaves is a battery cost nobody can see and
   * nothing else in this app would notice.
   */
  close(): void
  /** Open stream handles. For the developer surface and for the tests. */
  readonly streams: () => readonly number[]
  /** Counters, for the developer surface and for the tests. */
  readonly stats: { denied: number; rateLimited: number; malformed: number; served: number }
}

export type BridgeOptions = {
  readonly packId: string
  readonly granted: readonly Capability[]
  readonly services: HostServices
  /**
   * Where an unsolicited stream message goes, host → pack.
   *
   * The third envelope, and the reason it is a constructor argument rather than
   * a return value: `handle` answers one message with one response, and a stream
   * is by definition traffic nobody asked for at the moment it is sent. Absent
   * in a test that only exercises request/response, in which case a pack that
   * opens a stream gets one that delivers nothing — which is why every stream
   * test passes one.
   */
  readonly push?: (message: StreamUpdate | StreamEnd) => void
  /** Injectable so a test does not sleep. Milliseconds. */
  readonly now?: () => number
  readonly maxRequestsPerSecond?: number
}

/** One stream this pack has open, from the host's side. */
type Open = {
  /** Monotonic from 1. The pack drops anything at or below its high-water mark. */
  seq: number
  /** Release whatever is behind it. Replaced once the source has started. */
  stop: () => void
  /**
   * Whether the pack has been given the handle yet.
   *
   * A start that is cancelled while it is still starting never becomes a stream
   * the pack knows about, so it gets no end message: "exactly one end per stream
   * that was opened" is a promise about streams that were opened.
   */
  handed: boolean
}

const ok = (id: number, result: unknown): Response => ({ id, ok: true, result })
const err = (id: number, code: ErrorCode, message: string): Response => ({
  id,
  ok: false,
  error: { code, message },
})

export function createBridge(options: BridgeOptions): Bridge {
  const { packId, granted, services } = options
  const now = options.now ?? (() => Date.now())
  const limit = options.maxRequestsPerSecond ?? MAX_REQUESTS_PER_SECOND
  const stats = { denied: 0, rateLimited: 0, malformed: 0, served: 0 }

  /* ------------------------------- streams -------------------------------- */

  const open = new Map<number, Open>()
  const push = options.push
  let paused = false
  let closed = false

  const emit = (stream: number, data: unknown): void => {
    if (closed || paused) return
    const entry = open.get(stream)
    if (!entry || !entry.handed) return
    entry.seq += 1
    push?.({ stream, seq: entry.seq, data })
  }

  /**
   * End one stream, once.
   *
   * Deleting from the table before stopping the source is deliberate: `stop` is
   * host code that can throw, and a throw that left the handle in the table
   * would leave a stream nothing can ever end.
   */
  const endStream = (stream: number, reason: StreamEndReason): void => {
    const entry = open.get(stream)
    if (!entry) return
    open.delete(stream)
    try {
      entry.stop()
    } catch (error) {
      console.error(`[packs] ${packId} stream ${String(stream)} failed to stop`, error)
    }
    if (entry.handed) push?.({ stream, done: true, reason })
  }

  /**
   * Open a stream against a native source, or say why not.
   *
   * The whole lifecycle is here rather than in the `switch` below so that adding
   * speech or a model is one more call to this: reserve the handle, await a
   * source that may be asking a person for permission, and handle the two things
   * that can go wrong meanwhile — the device saying no, and the pack having
   * cancelled while we waited.
   */
  const openStream = async (
    id: number,
    source: (input: {
      emit: (sample: Orientation) => void
      lost: () => void
    }) => Promise<(() => void) | null>,
    unavailable: string,
  ): Promise<Response> => {
    if (open.size >= MAX_OPEN_STREAMS) {
      return err(id, "quota", `a pack may hold ${MAX_OPEN_STREAMS} streams open`)
    }
    // The handle is reserved BEFORE the await, so a `stream.cancel` arriving
    // while a permission prompt is on screen has something to find. Its `stop`
    // is a flag until the real one exists.
    let cancelled = false
    const entry: Open = { seq: 0, stop: () => (cancelled = true), handed: false }
    open.set(id, entry)

    const stop = await source({
      emit: (sample) => emit(id, sample),
      lost: () => endStream(id, "unavailable"),
    })

    if (stop === null) {
      open.delete(id)
      return err(id, "unavailable", unavailable)
    }
    if (cancelled || closed) {
      // Nothing was ever handed out, so there is no stream to end — just a
      // source to release. The pack learns this as a failed start, and its SDK
      // stays quiet about it because the pack is the thing that cancelled.
      open.delete(id)
      stop()
      return err(id, "unavailable", "the stream was cancelled while it was starting")
    }
    entry.stop = stop
    entry.handed = true
    // The handle IS the request id. Echoed anyway, so nothing has to infer it.
    return ok(id, { stream: id })
  }

  /**
   * A sliding one-second window rather than a token bucket: the rule the SDK
   * documents is "requests per second", and a bucket with a refill rate is a
   * different rule that is only approximately that one.
   */
  const window: number[] = []
  const withinRate = (): boolean => {
    const cutoff = now() - 1000
    while (window.length > 0 && (window[0] ?? 0) <= cutoff) window.shift()
    if (window.length >= limit) return false
    window.push(now())
    return true
  }

  const dispatch = async (
    id: number,
    method: Method,
    params: Readonly<Record<string, unknown>>,
  ): Promise<Response | null> => {
    switch (method) {
      case "session.settings":
        return ok(id, services.settings())

      case "session.progress": {
        const fraction = numberParam(params, "fraction", 1)
        if (fraction === null) return err(id, "invalid_params", "fraction must be 0–1")
        services.progress({ packId, fraction })
        return ok(id, null)
      }

      case "session.end": {
        const reason = params["reason"]
        if (reason !== "finished" && reason !== "quit") {
          return err(id, "invalid_params", "reason must be finished or quit")
        }
        services.end({ packId, reason })
        return ok(id, null)
      }

      case "session.transition": {
        const kind = params["kind"]
        if (!isTransitionKind(kind)) {
          return err(id, "invalid_params", "kind must be level, run or boss")
        }
        // Optional, short, and for a log rather than for a screen: nothing the
        // host draws comes from a pack, because a pack's string is not
        // translated and is not the host's copy.
        const label = stringParam(params, "label", 64)
        services.transition(label === null ? { packId, kind } : { packId, kind, label })
        // Deliberately answered `null`. A pack that could read the verdict
        // could branch on whether the child has paid, and a game that plays
        // differently for a paying child is the thing this model is not.
        return ok(id, null)
      }

      case "items.next": {
        const skillId = stringParam(params, "skillId", 128)
        // Clamped rather than refused, like every other number a pack sends: a
        // difficulty of 1.4 is a bug in a pack, and refusing the question would
        // turn it into a blank screen in a child's game. The pack's own adapter
        // is where an out-of-range value is announced, because that is the side
        // an author can act on.
        const difficulty = unitParam(params, "difficulty")
        const maxDifficulty = unitParam(params, "maxDifficulty")
        const item = await services.nextItem({
          packId,
          ...(skillId === null ? {} : { skillId }),
          ...(difficulty === null ? {} : { difficulty }),
          ...(maxDifficulty === null ? {} : { maxDifficulty }),
        })
        return ok(id, { item })
      }

      case "items.answer": {
        const itemId = stringParam(params, "itemId", 128)
        // A response can be long — a pack may collect a written expression —
        // but it is bounded, and it is a string so no float ever enters here.
        const response = stringParam(params, "response", 256)
        const latencyMs = numberParam(params, "latencyMs", MAX_LATENCY_MS)
        const revisions = numberParam(params, "revisions", MAX_REVISIONS)
        if (itemId === null || response === null || latencyMs === null || revisions === null) {
          return err(id, "invalid_params", "itemId, response, latencyMs and revisions are required")
        }
        const judgement = await services.judge({
          packId,
          itemId,
          response,
          latencyMs,
          revisions: Math.round(revisions),
        })
        return ok(id, judgement)
      }

      case "items.skip": {
        const itemId = stringParam(params, "itemId", 128)
        if (itemId === null) return err(id, "invalid_params", "itemId is required")
        await services.skip({ packId, itemId })
        return ok(id, null)
      }

      case "items.reveal": {
        const itemId = stringParam(params, "itemId", 128)
        if (itemId === null) return err(id, "invalid_params", "itemId is required")
        return ok(id, { canonical: await services.reveal({ packId, itemId }) })
      }

      case "learner.summary":
        return ok(id, await services.learnerSummary({ packId }))

      case "feedback.haptic": {
        const cue = params["cue"]
        if (!HAPTIC_CUES.includes(cue as HapticCue)) {
          return err(id, "invalid_params", "cue is not one of the named haptics")
        }
        await services.haptic({ packId, cue: cue as HapticCue })
        return ok(id, null)
      }

      case "feedback.sound": {
        const cue = params["cue"]
        if (!SOUND_CUES.includes(cue as SoundCue)) {
          return err(id, "invalid_params", "cue is not one of the named sounds")
        }
        await services.sound({ packId, cue: cue as SoundCue })
        return ok(id, null)
      }

      case "milestone.reach": {
        const name = stringParam(params, "name", 64)
        if (name === null) return err(id, "invalid_params", "name is required")
        await services.milestone({ packId, name })
        return ok(id, null)
      }

      case "storage.get": {
        const key = stringParam(params, "key", MAX_STORAGE_KEY_LENGTH)
        if (key === null) return err(id, "invalid_params", "key is required")
        return ok(id, { value: await services.storage.get({ packId, key }) })
      }

      case "storage.set": {
        const key = stringParam(params, "key", MAX_STORAGE_KEY_LENGTH)
        const value = params["value"]
        if (key === null) return err(id, "invalid_params", "key is required")
        if (typeof value !== "string") return err(id, "invalid_params", "value must be a string")
        if (value.length > MAX_STORAGE_VALUE_LENGTH) {
          return err(id, "quota", `a value is capped at ${MAX_STORAGE_VALUE_LENGTH} characters`)
        }
        const existing = await services.storage.keys({ packId })
        if (!existing.includes(key) && existing.length >= MAX_STORAGE_KEYS) {
          return err(id, "quota", `a pack may keep ${MAX_STORAGE_KEYS} keys`)
        }
        await services.storage.set({ packId, key, value })
        return ok(id, null)
      }

      case "storage.remove": {
        const key = stringParam(params, "key", MAX_STORAGE_KEY_LENGTH)
        if (key === null) return err(id, "invalid_params", "key is required")
        await services.storage.remove({ packId, key })
        return ok(id, null)
      }

      case "storage.keys":
        return ok(id, { keys: await services.storage.keys({ packId }) })

      case "sensors.orientation.start": {
        // Checked here and not only in the guest. The guest short-circuits an
        // unavailable capability to save a round trip, and this is the boundary:
        // it cannot rely on the other side of itself having done the check.
        if (!services.available().includes("sensors.orientation")) {
          return err(id, "unavailable", "this device cannot report how it is being held")
        }
        return openStream(
          id,
          (input) => services.sensors.orientation({ packId, ...input }),
          "this device cannot report how it is being held",
        )
      }

      case "stream.cancel": {
        const stream = numberParam(params, "stream", Number.MAX_SAFE_INTEGER)
        if (stream === null) return err(id, "invalid_params", "stream must be a stream handle")
        // Idempotent, and silent about what it found. Cancelling something that
        // has already ended is not an error — a pack racing its own teardown
        // against a stream the host closed is the normal case — and a pack must
        // not be able to learn whether a handle it invented was ever real.
        endStream(Math.round(stream), "cancelled")
        return ok(id, null)
      }
    }
  }

  return {
    stats,
    streams: () => [...open.keys()],
    setPaused: (value) => {
      paused = value
    },
    close: () => {
      if (closed) return
      closed = true
      // A copy of the keys: `endStream` mutates the map it is walking.
      for (const stream of [...open.keys()]) endStream(stream, "closed")
    },
    handle: async (message: unknown): Promise<Response | null> => {
      // A closed bridge answers nothing. `close()` runs before the port does, so
      // a message already in flight can land here — and the one that must not be
      // served is a stream start, which would subscribe to a sensor for a session
      // that has ended.
      if (closed) return null
      const parsed = parseRequest(message)
      if (!parsed.ok) {
        stats.malformed += 1
        // A message with no readable id cannot be answered — replying with a
        // made-up id would resolve a promise the pack is holding for something
        // else. It is dropped, and counted.
        const id = (message as { id?: unknown })?.id
        if (typeof id !== "number" || !Number.isSafeInteger(id) || id < 0) return null
        return err(id, parsed.code, parsed.message)
      }

      const { id, method, params } = parsed.request

      if (!permits(granted, method)) {
        stats.denied += 1
        return err(id, "denied", `${method} was not granted to this pack`)
      }

      if (!withinRate()) {
        stats.rateLimited += 1
        return err(id, "rate_limited", `at most ${limit} requests per second`)
      }

      try {
        const response = await dispatch(id, method, params)
        stats.served += 1
        return response
      } catch (error) {
        // The pack is told that it failed and nothing else. A host stack trace
        // is not a pack's business and is not a child's.
        console.error(`[packs] ${packId} ${method} failed`, error)
        return err(id, "internal", "the app could not do that")
      }
    },
  }
}
