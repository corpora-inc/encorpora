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

/**
 * Detail carried in the NEW `corpan:daily-locked` CustomEvent — the "gate v2"
 * hard daily cap. The host listens for this to render the universal
 * accomplishment-lock overlay (positive "you did your N today ✓" + countdown to
 * reset + upsell). Distinct from `corpan:request-unlock` (the soft paywall).
 */
export type DailyLockedDetail = {
  packId: string
  /** The PaywallSurface string the host uses to route the upsell paywall. */
  surface: string
  /** Actions completed today (== the cap at lock time). */
  doneToday: number
  /** The configured daily cap. */
  limit: number
  /** Next local-midnight as an ISO string — the lock's live countdown target. */
  resetAt: string
  /** Human unit label for the copy ("phrases", "characters", "messages"). */
  unitLabel: string
  /** Arbitrary per-pack extras merged from `config.detail`. */
  [key: string]: unknown
}

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
  /**
   * "gate v2" daily HARD cap (counted per local day, resets at local midnight —
   * the same reset logic as `mode:"daily"`). When set, the gate is implicitly a
   * daily counter: at `count >= dailyLimit` the gate is BLOCKED and dispatches
   * the `corpan:daily-locked` event for the host's accomplishment-lock overlay.
   * Independent of `mode`/`limit` (you can run a soft-nag `dailyLimit` without a
   * legacy `limit`). Ignored in `timed` mode.
   */
  dailyLimit?: number
  /**
   * "gate v2" soft-nag cadence. BEFORE the hard `dailyLimit` is reached, fire a
   * dismissible `corpan:request-unlock` paywall every N counted actions
   * (`count % softNagEvery === 0`, while `count < dailyLimit`). "soft, soft,
   * hard." Requires `dailyLimit`. Omit for no soft nags.
   */
  softNagEvery?: number
  /**
   * Human label for the counted unit ("phrases", "characters", "messages"),
   * carried in the `corpan:daily-locked` detail so the lock overlay copy reads
   * naturally ("You did your 20 phrases today"). Default "actions".
   */
  unitLabel?: string
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
  /**
   * Optional analytics hook — called every time the gate fires the paywall,
   * with the same detail that goes to `requestPaywall`. Host-agnostic: the main
   * app emits `gate_hit` from its `corpan:request-unlock` listener (so packs need
   * no analytics dep), but standalone/embedded hosts can observe fires here
   * without parsing the window event. Optional + fully back-compat. Must not
   * throw (the gate ignores any error). Also fires for the gate-v2 daily HARD
   * lock — with the `DailyLockedDetail` (carries `doneToday`/`limit`/`resetAt`/
   * `unitLabel` instead of `reason`/`hardness`).
   */
  onFire?: (detail: PaywallRequestDetail | DailyLockedDetail) => void
  /**
   * Injected; default dispatches the NEW `corpan:daily-locked` window event for
   * the gate-v2 accomplishment lock. The host's universal lock overlay listens.
   */
  requestDailyLock?: (detail: DailyLockedDetail) => void
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
   * Free actions left today. Honors `dailyLimit` (gate-v2) when set, else the
   * legacy `limit`. `Infinity` for subscribers. `null` for timed gates or when
   * neither cap is configured.
   */
  remaining(): number | null
  /**
   * Next local-midnight as an ISO string — when the daily counter resets. Lets
   * a pack show "N left today" + a countdown without re-deriving the boundary.
   * Always returns the next local midnight (independent of mode/limit).
   */
  resetAt(): string
  /**
   * Re-show the gate-v2 daily-lock overlay (re-dispatch `corpan:daily-locked`).
   * For tap/advance surfaces: when a blocked free user tries the metered action
   * again, call this to bring the accomplishment-lock overlay back. Bypasses the
   * once-per-day re-spam guard that `note()` uses. No-op for subscribers, timed
   * gates, and gates without a `dailyLimit`.
   */
  requestDailyLock(): void
  /** Reset persisted + in-memory counters (e.g. on subscribe or manual clear). */
  reset(): void
  /** Detach listeners / drop references. Safe to call multiple times. */
  dispose(): void
}
