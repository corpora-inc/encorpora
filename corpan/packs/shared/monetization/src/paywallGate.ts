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
// "gate v2" (monetization daily quota): set `dailyLimit` for a HARD per-local-day
// cap that resets at local midnight (the DAU lever). Optional `softNagEvery`
// fires a dismissible `corpan:request-unlock` every N actions BEFORE the cap
// ("soft, soft, hard"); at the cap `note()` dispatches the NEW
// `corpan:daily-locked` event (with doneToday/limit/resetAt/unitLabel) for the
// host's positive "you did your N today ✓" accomplishment-lock overlay, and
// `isBlocked()` stays true until the next local day.
//
// Folds in the per-pack quota patterns previously duplicated in
// tutomaton (`tutomaton.quota`) and teletron (`teletron.quota`): localStorage
// JSON `{ day, count }`, local-midnight reset, robust to malformed/missing
// storage (an in-memory mirror carries the session if WebKit storage is full).

import type {
  DailyLockedDetail,
  EntitlementSnapshot,
  GateConfig,
  GateRegistry,
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

/** Next local midnight (start of the next local day) as epoch ms — when the
 *  daily counter resets. The gate-v2 lock counts down to this. */
function nextLocalMidnight(now: number): number {
  const d = new Date(now)
  // setHours with the LOCAL components rolls to the next local day's 00:00:00.
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0, 0).getTime()
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

/**
 * Whether the host can render the gate-v2 daily-lock overlay.
 *
 * Backwards compatibility: packs ship over-the-air and run inside OLDER Corpán
 * apps (pre-0.18.1) that have no `DailyLockOverlay` and don't listen for
 * `corpan:daily-locked`. Hard-blocking there would freeze the user with no
 * explanation and no upgrade path. So the NEW host advertises support via
 * `__CORPAN_HOST_CAPS.dailyLock`; when that's absent the gate must NOT hard-block
 * — it degrades to the legacy, dismissible `corpan:request-unlock` soft nag,
 * which every host (old and new) already renders. Graceful degradation over
 * gating packs to a minimum app version.
 */
function hostSupportsDailyLock(): boolean {
  const caps = (globalThis as { __CORPAN_HOST_CAPS?: { dailyLock?: boolean } })
    .__CORPAN_HOST_CAPS
  return Boolean(caps?.dailyLock)
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

/** Dispatches the NEW `corpan:daily-locked` window event (gate-v2 hard cap). */
function defaultRequestDailyLock(detail: DailyLockedDetail): void {
  try {
    const w = globalThis as { dispatchEvent?: (e: Event) => boolean }
    if (typeof w.dispatchEvent !== "function" || typeof CustomEvent === "undefined") return
    w.dispatchEvent(new CustomEvent("corpan:daily-locked", { detail }))
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

/** The live-gate registry on globalThis (lazily created). DEV debug API reads it. */
function gateRegistry(): GateRegistry {
  const g = globalThis as { __corpanGates?: GateRegistry }
  return (g.__corpanGates ??= {})
}

export function createPaywallGate(config: GateConfig): PaywallGate {
  const {
    packId,
    surface,
    mode,
    limit,
    intervalMs,
    dailyLimit,
    softNagEvery,
    unitLabel = "actions",
    hardness = "soft",
    sessionCap = DEFAULT_SESSION_CAP,
    detail: extraDetail,
    legacyKey,
    isSubscribed = defaultIsSubscribed,
    requestPaywall = defaultRequestPaywall,
    requestDailyLock = defaultRequestDailyLock,
    onFire,
    now = Date.now,
    storage = defaultStorage(),
  } = config

  // gate-v2: a `dailyLimit` makes this a per-local-day counter even if the
  // caller left `mode:"action"` — so the count resets at local midnight like
  // `mode:"daily"` does. (Soft-nags below also key off this counter.)
  const isDailyCounter = mode === "daily" || typeof dailyLimit === "number"

  const storageKey = `corpan:gate:${packId}:${surface}`

  // Legacy-key migration: a pre-gate build wrote a `<packId>.quota` { day, count }
  // key (e.g. `tutomaton.quota`). If the standard key is ABSENT but the legacy key
  // is present, import its count ONCE into the standard key so the upgrade
  // preserves today's progress and the old inconsistent key dies. Tiny + fully
  // storage-failure-safe (any throw is swallowed → no migration, no crash).
  if (legacyKey && storage) {
    try {
      const hasStandard = storage.getItem(storageKey) != null
      const rawLegacy = storage.getItem(legacyKey)
      if (!hasStandard && rawLegacy) {
        const parsed = JSON.parse(rawLegacy) as { day?: unknown; count?: unknown }
        const day = typeof parsed.day === "string" ? parsed.day : localDay(now())
        const count = Math.max(0, Number(parsed.count) || 0)
        storage.setItem(storageKey, JSON.stringify({ day, count, lastFireAt: 0 }))
      }
    } catch {
      /* malformed/unavailable legacy storage — skip migration, start fresh */
    }
  }

  // In-memory mirror so the gate survives WebKit storage being full/unavailable,
  // and so the timed anchor works even with no storage at all.
  let memory: GateState | null = null
  // Wall-clock at construction — the timed interval is measured from here until
  // the first real fire, so it doesn't drift forward on every read.
  const mountedAt = now()
  // Session backstop — counted in memory, never persisted.
  let sessionFires = 0
  // gate-v2: the local-day stamp we last dispatched a `corpan:daily-locked` for,
  // so the hard-lock event fires once per day (not on every subsequent note()).
  let lockDay = ""
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

    // Daily counter (mode:"daily" OR a gate-v2 dailyLimit): a new local day
    // zeroes the count.
    if (isDailyCounter && state.day !== today) {
      state = { day: today, count: 0, lastFireAt: state.lastFireAt }
    } else if (isDailyCounter) {
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

  /** action/daily: count has crossed the free limit (legacy `limit`). */
  function countArmed(state: GateState): boolean {
    if (mode === "timed") return false
    if (typeof limit !== "number") return false
    return state.count >= limit
  }

  /** gate-v2: count has reached the hard daily cap. */
  function dailyLocked(state: GateState): boolean {
    if (mode === "timed") return false
    if (typeof dailyLimit !== "number") return false
    return state.count >= dailyLimit
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

  /**
   * gate-v2 hard cap reached → dispatch `corpan:daily-locked` for the host's
   * accomplishment-lock overlay. One-shot per local day (`lockDay`) so a
   * still-locked pack re-`note()`-ing doesn't re-spam the overlay; the per-day
   * guard auto-clears on the next local day (a fresh `state.day`).
   */
  function fireDailyLock(state: GateState): void {
    if (typeof dailyLimit !== "number") return
    if (lockDay === state.day) return // already announced today
    lockDay = state.day
    emitDailyLock(state)
  }

  /** Build + dispatch the daily-lock payload (no per-day guard). */
  function emitDailyLock(state: GateState): void {
    if (typeof dailyLimit !== "number") return
    const payload: DailyLockedDetail = {
      ...(extraDetail ?? {}),
      packId,
      surface,
      doneToday: state.count,
      limit: dailyLimit,
      resetAt: new Date(nextLocalMidnight(now())).toISOString(),
      unitLabel,
    }
    requestDailyLock(payload)
    if (onFire) {
      try {
        onFire(payload)
      } catch {
        /* analytics must never affect gating */
      }
    }
  }

  const registryKey = `${packId}:${surface}`

  const api: PaywallGate = {
    note() {
      if (disposed || isSubscribed()) return
      if (mode === "timed") return // timed gates don't count actions
      const state = readState()
      // Don't keep counting once already at the hard daily cap — the pack is
      // blocked; further taps shouldn't inflate `doneToday`.
      if (dailyLocked(state)) return
      // Cap the stored count so it doesn't grow unboundedly. With a gate-v2
      // dailyLimit the ceiling is the cap itself; otherwise limit+1 (legacy).
      const ceiling =
        typeof dailyLimit === "number"
          ? dailyLimit
          : typeof limit === "number"
            ? limit + 1
            : state.count + 1
      const next: GateState = {
        ...state,
        count: Math.min(ceiling, state.count + 1),
      }
      writeState(next)

      // gate-v2 "soft, soft, hard": the soft-nag + hard-lock both fire at the
      // action boundary (inside note()), not on the next discrete interaction.
      if (typeof dailyLimit === "number") {
        if (dailyLocked(next)) {
          fireDailyLock(next)
        } else if (
          typeof softNagEvery === "number" &&
          softNagEvery > 0 &&
          next.count > 0 &&
          next.count % softNagEvery === 0
        ) {
          // Dismissible soft paywall before the cap.
          fire(isDailyCounter ? "daily" : "action")
        }
      }
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
      if (disposed || isSubscribed()) return false
      if (mode === "timed") return false
      const state = readState()
      // gate-v2: the daily HARD cap blocks at the cap — but ONLY when the host
      // can render the daily-lock overlay. In an older host (OTA pack in a
      // pre-0.18.1 app) there's no overlay, so we degrade to soft (the
      // `corpan:request-unlock` nags still fired in `note()`) rather than freeze
      // the user behind an invisible wall. See `hostSupportsDailyLock`.
      if (typeof dailyLimit === "number") {
        return hostSupportsDailyLock() && dailyLocked(state)
      }
      // Legacy: only a `hardness:"hard"` gate blocks at its `limit`.
      if (hardness !== "hard") return false
      return countArmed(state)
    },

    remaining() {
      if (isSubscribed()) return Infinity
      if (mode === "timed") return null
      // gate-v2 dailyLimit takes precedence over the legacy `limit`.
      const cap = typeof dailyLimit === "number" ? dailyLimit : limit
      if (typeof cap !== "number") return null
      const state = readState()
      return Math.max(0, cap - state.count)
    },

    resetAt() {
      return new Date(nextLocalMidnight(now())).toISOString()
    },

    requestDailyLock() {
      // Explicit re-show: a blocked free user tapped again. Re-dispatch the
      // `corpan:daily-locked` overlay event regardless of the once-per-day
      // `note()` guard (that guard only suppresses re-spam from the metering
      // path, not a deliberate re-show on a blocked interaction). No-op for
      // subscribers / non-daily gates.
      if (disposed || isSubscribed()) return
      if (typeof dailyLimit !== "number") return
      emitDailyLock(readState())
    },

    reset() {
      memory = null
      sessionFires = 0
      lockDay = ""
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
      // Unregister from the live-gate registry (no leak across remounts).
      try {
        const reg = gateRegistry()
        if (reg[registryKey]?.gate === api) delete reg[registryKey]
      } catch {
        /* no globalThis registry available — nothing to clean up */
      }
    },
  }

  // Register on the live-gate registry so the host's DEV debug API can inspect
  // and live-set ANY pack's gate (including OTA packs) without a reload. Cheap
  // and harmless in prod (just a globalThis map entry); dropped on dispose().
  try {
    gateRegistry()[registryKey] = { packId, surface, gate: api }
  } catch {
    /* no globalThis — skip registration (SSR/unusual host) */
  }

  return api
}
