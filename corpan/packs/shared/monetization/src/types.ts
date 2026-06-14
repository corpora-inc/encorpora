// Shared monetization types — the host ↔ pack entitlement + paywall seam.
//
// These mirror the undocumented globals packs read today
// (`__CORPAN_PLUS`, `__CORPAN_ENTITLEMENT`) and the `corpan:request-unlock`
// window event the host listens for. Kept here so every pack gates the same
// way without re-declaring the shapes.

/** A subscription/entitlement snapshot, matching the host-injected global. */
export type EntitlementSnapshot = {
  plus?: boolean
  subscription?: {
    active?: boolean
    plan?: "monthly" | "annual" | null
    expiresAt?: string | null
    autoRenew?: boolean
  }
  checkedAt?: number | null
}

/** Soft = dismiss-and-continue. Hard = blocked past the free limit until subscribed. */
export type Hardness = "soft" | "hard"

/**
 * - `action`  — count meaningful actions; gate when the count crosses `limit`.
 * - `daily`   — like `action`, but the counter resets each local day (the DAU lever).
 * - `timed`   — arm a flag after `intervalMs` of elapsed wall-clock; fire on the
 *               next discrete interaction (never on a bare timer).
 */
export type GateMode = "action" | "daily" | "timed"

/** Detail carried in the `corpan:request-unlock` CustomEvent. */
export type PaywallRequestDetail = {
  /** The PaywallSurface string the host uses to skin/route the paywall. */
  surface: string
  packId: string
  /** Why the gate fired — useful for analytics + per-pack copy. */
  reason: GateMode
  /** Gate hardness at fire time. */
  hardness: Hardness
  /** Arbitrary per-pack extras (bookTitle, theme, language, …). */
  [key: string]: unknown
}

export interface GateConfig {
  /** Pack identifier, e.g. "tutomaton". Namespaces the persisted key. */
  packId: string
  /** PaywallSurface string carried in the request-unlock detail. */
  surface: string
  mode: GateMode
  /** action/daily: number of free actions before a gate arms. */
  limit?: number
  /** timed: arm the gate after this much elapsed wall-clock (ms). */
  intervalMs?: number
  /** Default "soft". */
  hardness?: Hardness
  /**
   * Max paywall fires per session (in-memory backstop so even a long session
   * is never spammed). Default 3. The gate keeps tracking state after the cap.
   */
  sessionCap?: number
  /** Extra detail merged into every paywall request (theme, language, …). */
  detail?: Record<string, unknown>
  /** Injected; default reads `__CORPAN_PLUS` / `__CORPAN_ENTITLEMENT`. */
  isSubscribed?: () => boolean
  /** Injected; default dispatches the `corpan:request-unlock` window event. */
  requestPaywall?: (detail: PaywallRequestDetail) => void
  /** Injected clock for tests. Default `Date.now`. */
  now?: () => number
  /** Injected storage for tests. Default `localStorage` (guarded). */
  storage?: StorageLike
}

/** The slice of the Web Storage API the gate uses (so tests can inject a stub). */
export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface PaywallGate {
  /**
   * Record one meaningful action (action/daily modes). Increments the persisted
   * counter; once it crosses `limit` the gate is armed. No-op in timed mode and
   * for subscribers.
   */
  note(): void
  /**
   * Call on each discrete UI interaction. If the gate is armed
   * (timed: interval elapsed; action/daily: count past limit) this fires the
   * paywall (subject to the session cap) and re-arms timed gates. No-op for
   * subscribers.
   */
  onInteraction(): void
  /**
   * Hard mode only: true once the free limit is exceeded, until subscribed.
   * Always false for soft gates, timed gates, and subscribers.
   */
  isBlocked(): boolean
  /**
   * Free actions left (action/daily). `Infinity` for subscribers. `null` for
   * timed gates or when no `limit` is configured.
   */
  remaining(): number | null
  /** Reset persisted + in-memory counters (e.g. on subscribe or manual clear). */
  reset(): void
  /** Detach listeners / drop references. Safe to call multiple times. */
  dispose(): void
}
