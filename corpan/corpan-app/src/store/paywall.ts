import { create } from "zustand"
import { useEntitlementStore } from "@/store/entitlements"

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

/** Visual skin for the paywall sheet. Readers pass their own so the sheet that
 *  overlays a running reader feels like part of it (earth-toned vs. space).
 *  Absent / unknown → the default Corpán (purple) treatment. */
export type PaywallTheme = "earthgate" | "stargate"

export type PaywallContext = {
  surface: PaywallSurface
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

export const usePaywallStore = create<PaywallState>((set) => ({
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
    set({ open: true, context })
    return true
  },
  closePaywall: () => set({ open: false, context: null }),
}))
