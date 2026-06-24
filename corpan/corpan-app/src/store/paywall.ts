import { create } from "zustand"
import { useEntitlementStore } from "@/store/entitlements"
import {
  trackPaywallShownFunnel,
  trackPaywallDismissedFunnel,
  trackPaywallConvertedFunnel,
} from "@/util/analytics"

/**
 * Corpán Plus paywall sheet state. Opened by:
 *   - the `corpan:request-unlock` window event (reader hit end of free preview,
 *     Library "Unlock with Plus", etc.)
 *   - the onboarding Plus pitch + the small Home "Plus" chip
 *   - well-timed engagement moments (book finished, streak milestone)
 * The sheet itself reuses <SubscriptionOffer /> for the actual purchase flow.
 *
 * Two guard rules live HERE so every current/future trigger is safe by
 * construction:
 *   1. Suppress entirely when the user is subscribed or IAP is unavailable.
 *   2. Frequency-cap the AUTO-fired engagement surfaces so we never nag; the
 *      user-initiated / strong-intent surfaces are never capped.
 */
export type PaywallSurface =
  | "reader_eof_free"
  | "library_unlock"
  | "onboarding_pitch"
  | "home_chip"
  | "streak_milestone"
  | "book_finished"
  | "settings"
  // Per-pack interaction-gated surfaces. Per-pack cadence (action-count /
  // daily quota / time-armed) is owned pack-side by the shared paywall-gate
  // helper; the 48h engagement cap below is only a GLOBAL BACKSTOP and does
  // NOT apply to these (they are not in ENGAGEMENT_SURFACES).
  | "beatlounge_session"
  | "tutomaton_daily"
  | "parlometron_daily"
  | "hanzipan_chars"
  | "hover_phrases"
  | "phrase_flips"
  | "juice_phrases"
  | "other"

/** Auto-fired moments we frequency-cap (vs. user-initiated/strong-intent). */
const ENGAGEMENT_SURFACES = new Set<PaywallSurface>(["streak_milestone", "book_finished"])
/** At most one auto engagement interstitial per this window (ms). */
const ENGAGEMENT_CAP_MS = 2 * 24 * 60 * 60 * 1000
const META_KEY = "corpan:paywall-v1"

function lastEngagementAt(): number {
  try {
    const raw = localStorage.getItem(META_KEY)
    return raw ? (JSON.parse(raw).lastEngagementAt ?? 0) : 0
  } catch {
    return 0
  }
}
function stampEngagement(now: number) {
  try {
    localStorage.setItem(META_KEY, JSON.stringify({ lastEngagementAt: now }))
  } catch (e) {
    console.warn("[paywall] could not persist engagement stamp", e)
  }
}

/**
 * Tell the active content pack / reader to pause (or resume) while a blocking
 * overlay is up. The paywall is a full-screen modal — anything playing behind
 * it (pack gameplay, reader narration audio) must stop so it doesn't compete
 * for the user's attention/ears, then resume cleanly on dismiss.
 *
 * This is a GENERIC host signal (reusable by any future blocking overlay),
 * following the `corpan:host-dispose` convention. Listeners already shipped:
 *   - hover-runner (PR #459) pauses its game loop.
 *   - the shared reader shell (stargate/earthgate) pauses narration audio.
 *   - lingo-hero (follow-up) pauses its rhythm game.
 * Listeners must only resume the pause THEY caused (track a `hostPaused` flag),
 * so a host-resume never overrides a user's own manual pause.
 */
function dispatchHostBlock(type: "pause" | "resume"): void {
  try {
    window.dispatchEvent(new CustomEvent(`corpan:host-${type}`))
  } catch (e) {
    // Best-effort — host absent / SSR. Never let it break the paywall.
    console.warn(`[paywall] corpan:host-${type} dispatch failed`, e)
  }
}

/** Legacy per-reader skin hint. Readers still pass this on `request-unlock`,
 *  but the universal paywall IGNORES it — there is ONE dark, brand-defining
 *  paywall everywhere now (no per-pack theming). Kept only so existing callers
 *  type-check; safe to drop once readers stop sending it. */
export type PaywallTheme = "earthgate" | "stargate"

export type PaywallContext = {
  surface: PaywallSurface
  /** Pack that requested the paywall, when a pack triggered it (analytics). */
  packId?: string
  /** Book title to name in the subhead, if the trigger knows it. */
  bookTitle?: string
  bookId?: string
  language?: string
  /** Visual skin to apply; set by readers, ignored elsewhere. */
  theme?: PaywallTheme
}

type PaywallState = {
  open: boolean
  context: PaywallContext | null
  /** Opens the sheet unless suppressed (subscribed / no IAP / capped). Returns
   *  whether it actually opened — callers can ignore the return. */
  openPaywall: (context: PaywallContext) => boolean
  closePaywall: () => void
}

export const usePaywallStore = create<PaywallState>((set, get) => ({
  open: false,
  context: null,
  openPaywall: (context) => {
    const ent = useEntitlementStore.getState()
    // Rule 1: never nag subscribers / when purchases aren't available.
    if (!ent.iapAvailable || ent.subscription.active) return false
    // Rule 2: frequency-cap auto-fired engagement moments.
    if (ENGAGEMENT_SURFACES.has(context.surface)) {
      const now = Date.now()
      if (now - lastEngagementAt() < ENGAGEMENT_CAP_MS) return false
      stampEngagement(now)
    }
    const wasOpen = get().open
    set({ open: true, context })
    // Pause the active pack/reader the moment the blocking overlay appears, but
    // only on a genuine closed→open transition (never re-fire if it was already
    // up — e.g. a second surface racing the first), so resume stays balanced.
    if (!wasOpen) dispatchHostBlock("pause")
    // Funnel: paywall_shown — fired at the single open chokepoint so it can
    // never drift from the visual component the paywall team owns.
    trackPaywallShownFunnel(context.surface, context.packId)
    return true
  },
  closePaywall: () => {
    // Funnel: at the close chokepoint, classify by entitlement state. If the
    // user is now subscribed, the sheet closed AFTER a successful purchase →
    // paywall_converted; otherwise it was dismissed without converting. (The
    // store-level converted event is a backstop; the authoritative plan/code/
    // platform conversion is emitted from purchase.ts.)
    const wasOpen = get().open
    const ctx = get().context
    if (ctx) {
      const sub = useEntitlementStore.getState().subscription
      if (sub.active) {
        trackPaywallConvertedFunnel(ctx.surface, sub.plan ?? "monthly", false)
      } else {
        trackPaywallDismissedFunnel(ctx.surface)
      }
    }
    set({ open: false, context: null })
    // Resume the active pack/reader once — and only when we were actually open,
    // so an idempotent close (e.g. unmount after dismiss) can't double-resume.
    if (wasOpen) dispatchHostBlock("resume")
  },
}))
