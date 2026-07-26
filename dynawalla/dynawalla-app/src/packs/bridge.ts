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
  Response,
  Settings,
  SoundCue,
} from "../../../packs/sdk/src/index.ts"
import {
  MAX_REQUESTS_PER_SECOND,
  numberParam,
  parseRequest,
  permits,
  stringParam,
} from "../../../packs/sdk/src/index.ts"

/** A pack's own key-value store. Small on purpose: it is not a database. */
export const MAX_STORAGE_KEYS = 200
export const MAX_STORAGE_KEY_LENGTH = 128
export const MAX_STORAGE_VALUE_LENGTH = 16 * 1024

/** A latency a pack reports is clamped to this. Anything longer is not a fact. */
const MAX_LATENCY_MS = 10 * 60 * 1000
const MAX_REVISIONS = 1000

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
  nextItem(input: { packId: string; skillId?: string }): Promise<Item | null>
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
  progress(input: { packId: string; fraction: number }): void
  end(input: { packId: string; reason: "finished" | "quit" }): void
  settings(): Settings
}

export type Bridge = {
  /** One message in, one response out. `null` for a message with no reply. */
  handle(message: unknown): Promise<Response | null>
  /** Counters, for the developer surface and for the tests. */
  readonly stats: { denied: number; rateLimited: number; malformed: number; served: number }
}

export type BridgeOptions = {
  readonly packId: string
  readonly granted: readonly Capability[]
  readonly services: HostServices
  /** Injectable so a test does not sleep. Milliseconds. */
  readonly now?: () => number
  readonly maxRequestsPerSecond?: number
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

      case "items.next": {
        const skillId = stringParam(params, "skillId", 128)
        const item = await services.nextItem(skillId === null ? { packId } : { packId, skillId })
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
    }
  }

  return {
    stats,
    handle: async (message: unknown): Promise<Response | null> => {
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
