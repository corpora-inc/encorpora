// createPaywallGate — the shared "paywall moment" primitive for all packs.
//
// Packs gate at NATURAL interaction boundaries (the user's next discrete tap),
// never by interrupting an in-progress action. Two trigger types:
//   • action / daily — count meaningful actions, fire when past `limit`
//                       (daily resets each local day → the DAU lever)
//   • timed          — arm after `intervalMs` elapsed, fire on the next tap
//
// Subscribers are a total no-op. A per-session in-memory backstop caps fires so
// even a long session is never spammed.
//
// Folds in the per-pack quota patterns previously duplicated in
// tutomaton (`tutomaton.quota`) and teletron (`teletron.quota`): localStorage
// JSON `{ day, count }`, local-midnight reset, robust to malformed/missing
// storage (an in-memory mirror carries the session if WebKit storage is full).

import type {
  EntitlementSnapshot,
  GateConfig,
  PaywallGate,
  PaywallRequestDetail,
  StorageLike,
} from "./types"

const DEFAULT_SESSION_CAP = 3

/** Persisted gate state. `lastFireAt` anchors the timed-mode interval. */
type GateState = {
  /** local-day stamp (daily mode); empty for non-daily. */
  day: string
  /** meaningful-action count (action/daily). */
  count: number
  /** wall-clock of the last paywall fire (or mount), anchors timed re-arm. */
  lastFireAt: number
}

// ── defaults (overridable for tests) ─────────────────────────────

/** Local-day stamp, matching tutomaton/teletron `localDay()`. */
function localDay(now: number): string {
  const d = new Date(now)
  const yyyy = String(d.getFullYear())
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

/** Reads the host-injected entitlement globals (matches tutomaton's isPlus). */
function defaultIsSubscribed(): boolean {
  const injected = globalThis as {
    __CORPAN_PLUS?: boolean
    __CORPAN_ENTITLEMENT?: EntitlementSnapshot
  }
  return Boolean(
    injected.__CORPAN_PLUS ||
      injected.__CORPAN_ENTITLEMENT?.plus ||
      injected.__CORPAN_ENTITLEMENT?.subscription?.active
  )
}

/** Dispatches the `corpan:request-unlock` window event the host listens for. */
function defaultRequestPaywall(detail: PaywallRequestDetail): void {
  try {
    const w = globalThis as { dispatchEvent?: (e: Event) => boolean }
    if (typeof w.dispatchEvent !== "function" || typeof CustomEvent === "undefined") return
    w.dispatchEvent(new CustomEvent("corpan:request-unlock", { detail }))
  } catch {
    /* host not present (e.g. SSR/standalone) — silently skip */
  }
}

/** localStorage, guarded — undefined in non-DOM contexts. */
function defaultStorage(): StorageLike | undefined {
  try {
    const ls = (globalThis as { localStorage?: StorageLike }).localStorage
    return ls ?? undefined
  } catch {
    return undefined
  }
}

export function createPaywallGate(config: GateConfig): PaywallGate {
  const {
    packId,
    surface,
    mode,
    limit,
    intervalMs,
    hardness = "soft",
    sessionCap = DEFAULT_SESSION_CAP,
    detail: extraDetail,
    isSubscribed = defaultIsSubscribed,
    requestPaywall = defaultRequestPaywall,
    onFire,
    now = Date.now,
    storage = defaultStorage(),
  } = config

  const storageKey = `corpan:gate:${packId}:${surface}`

  // In-memory mirror so the gate survives WebKit storage being full/unavailable,
  // and so the timed anchor works even with no storage at all.
  let memory: GateState | null = null
  // Wall-clock at construction — the timed interval is measured from here until
  // the first real fire, so it doesn't drift forward on every read.
  const mountedAt = now()
  // Session backstop — counted in memory, never persisted.
  let sessionFires = 0
  let disposed = false

  function readState(): GateState {
    const today = localDay(now())
    let stored: Partial<GateState> = {}
    if (storage) {
      try {
        stored = JSON.parse(storage.getItem(storageKey) || "{}") as Partial<GateState>
      } catch {
        stored = {}
      }
    }
    // Reconcile stored vs memory; take the higher count so a fuller mirror wins.
    const storedDay = typeof stored.day === "string" ? stored.day : ""
    const storedCount = Math.max(0, Number(stored.count) || 0)
    const storedFire = Math.max(0, Number(stored.lastFireAt) || 0)

    let state: GateState = {
      day: storedDay,
      count: storedCount,
      lastFireAt: storedFire,
    }
    if (memory) {
      state = {
        day: memory.day || state.day,
        count: Math.max(state.count, memory.count),
        lastFireAt: Math.max(state.lastFireAt, memory.lastFireAt),
      }
    }

    // Daily mode: a new local day zeroes the count.
    if (mode === "daily" && state.day !== today) {
      state = { day: today, count: 0, lastFireAt: state.lastFireAt }
    } else if (mode === "daily") {
      state.day = today
    }

    // No prior fire persisted: anchor the timed interval to construction time
    // (a stable point), not the moment of this read.
    if (state.lastFireAt === 0) state.lastFireAt = mountedAt
    return state
  }

  function writeState(state: GateState): void {
    memory = state
    if (storage) {
      try {
        storage.setItem(storageKey, JSON.stringify(state))
      } catch {
        /* memory mirror carries this session */
      }
    }
  }

  /** action/daily: count has crossed the free limit. */
  function countArmed(state: GateState): boolean {
    if (mode === "timed") return false
    if (typeof limit !== "number") return false
    return state.count >= limit
  }

  /** timed: enough wall-clock has elapsed since the last fire/mount. */
  function timeArmed(state: GateState): boolean {
    if (mode !== "timed") return false
    if (typeof intervalMs !== "number") return false
    return now() - state.lastFireAt >= intervalMs
  }

  function fire(reason: "action" | "daily" | "timed"): void {
    if (sessionFires >= sessionCap) return
    sessionFires += 1
    const payload: PaywallRequestDetail = {
      ...(extraDetail ?? {}),
      surface,
      packId,
      reason,
      hardness,
    }
    requestPaywall(payload)
    // Optional analytics observation — never let it break the paywall flow.
    if (onFire) {
      try {
        onFire(payload)
      } catch {
        /* analytics must never affect gating */
      }
    }
  }

  return {
    note() {
      if (disposed || isSubscribed()) return
      if (mode === "timed") return // timed gates don't count actions
      const state = readState()
      // Cap the stored count at limit+1 so we don't grow unboundedly; once past
      // the limit, subsequent notes don't change armed-ness.
      const ceiling = typeof limit === "number" ? limit + 1 : state.count + 1
      const next: GateState = {
        ...state,
        count: Math.min(ceiling, state.count + 1),
      }
      writeState(next)
    },

    onInteraction() {
      if (disposed || isSubscribed()) return
      const state = readState()

      if (mode === "timed") {
        if (timeArmed(state)) {
          fire("timed")
          // Re-arm: anchor the next interval to now.
          writeState({ ...state, lastFireAt: now() })
        }
        return
      }

      // action / daily
      if (countArmed(state)) {
        fire(mode)
        // Persist the (possibly day-reconciled) state so daily resets stick.
        writeState(state)
      }
    },

    isBlocked() {
      if (disposed || hardness !== "hard" || isSubscribed()) return false
      if (mode === "timed") return false
      return countArmed(readState())
    },

    remaining() {
      if (isSubscribed()) return Infinity
      if (mode === "timed" || typeof limit !== "number") return null
      const state = readState()
      return Math.max(0, limit - state.count)
    },

    reset() {
      memory = null
      sessionFires = 0
      if (storage) {
        try {
          storage.removeItem(storageKey)
        } catch {
          /* ignore */
        }
      }
    },

    dispose() {
      disposed = true
      memory = null
    },
  }
}
