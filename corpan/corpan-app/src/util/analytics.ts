// Anonymous main-app analytics — thin wrapper over @shared/analytics.
//
// Privacy + crash-safety contract:
//   - The shared module is safe-by-construction: every exported function is
//     wrapped in try/catch and cannot throw. We rely on that AND add a second
//     try/catch in every public function here (defends against future module
//     API changes and against thrown errors in prop-builder logic).
//   - Identifier: in-memory session UUID from the shared module. No persistent
//     device ID, no install ID, no user account. Opt-out via localStorage flag
//     `corpan-analytics-disabled` (exposed via Settings toggle).
//   - Kill switch: `VITE_ANALYTICS_ENABLED=false` at build time disables all
//     main-app analytics. Lets us hotfix without a code revert.
//   - Performance: session counters are plain module-level refs, not Zustand
//     state. Increments do not trigger re-renders. See plan §7 (P1–P8).
//
// Reader packs (stargate/earthgate/world-radio) emit their own events with
// their own reader_id. The main app emits with reader_id="corpan-app". Both
// can coexist in the same WebView session without collision (the events are
// disambiguated by reader_id in the Glue table).

import * as analytics from "@shared/analytics"

declare const __APP_VERSION__: string

const ANALYTICS_ENDPOINT = "https://d1xp3xghrx3jfa.cloudfront.net/v1/events"
const READER_ID = "corpan-app"

// Build-time kill switch. Default ON (opt-out model).
const KILL_SWITCH_OFF = import.meta.env.VITE_ANALYTICS_ENABLED === "false"

let initialized = false

// Session-scope counters — plain module refs, not React state.
// Reset implicitly on page reload (the session itself ends).
let packsEntered = 0
let segmentsPlayed = 0
const languagesUsed = new Set<string>()

function emitSessionSummary(): void {
  try {
    analytics.track("app_session_summary", {
      packs_entered: packsEntered,
      segments_played: segmentsPlayed,
      languages_used: [...languagesUsed].slice(0, 32).join(","),
    })
  } catch {
    /* unreachable in practice; the module's track() is safe-by-construction */
  }
}

export function initAnalytics(): void {
  if (initialized) return
  if (KILL_SWITCH_OFF) return
  initialized = true

  try {
    // Pagehide listener registered BEFORE analytics.init so it runs first;
    // our session_summary lands in the queue ahead of the module's sendBeacon
    // flush on pagehide.
    if (typeof window !== "undefined") {
      window.addEventListener("pagehide", emitSessionSummary)
    }

    analytics.init({
      readerId: READER_ID,
      readerVersion: __APP_VERSION__,
      endpoint: ANALYTICS_ENDPOINT,
      appVersion: __APP_VERSION__,
    })
  } catch {
    /* unreachable */
  }
}

export function trackPackEntered(packId: string, language: string): void {
  try {
    packsEntered++
    if (language) languagesUsed.add(language)
    analytics.track("app_pack_entered", { pack_id: packId, language })
  } catch {
    /* unreachable */
  }
}

export function trackPackHeartbeat(
  packId: string,
  language: string,
  segmentsDelta: number,
): void {
  try {
    analytics.track("app_pack_heartbeat", {
      pack_id: packId,
      language,
      segments_delta: segmentsDelta,
    })
  } catch {
    /* unreachable */
  }
}

export function trackPackExited(
  packId: string,
  language: string,
  durationMs: number,
  segmentsPlayedInPack: number,
): void {
  try {
    analytics.track("app_pack_exited", {
      pack_id: packId,
      language,
      duration_ms: durationMs,
      segments_played: segmentsPlayedInPack,
    })
  } catch {
    /* unreachable */
  }
}

export function trackLanguageSwitched(
  fromLanguage: string,
  toLanguage: string,
  scope: "ui" | "pack",
): void {
  try {
    if (toLanguage) languagesUsed.add(toLanguage)
    analytics.track("app_language_switched", {
      from_language: fromLanguage,
      to_language: toLanguage,
      scope,
    })
  } catch {
    /* unreachable */
  }
}

export function trackOnboardingCompleted(): void {
  try {
    analytics.track("app_onboarding_completed")
  } catch {
    /* unreachable */
  }
}

export function trackPaidUnlockViewed(surface: string, packId?: string): void {
  try {
    analytics.track("app_paid_unlock_viewed", {
      surface,
      ...(packId ? { pack_id: packId } : {}),
    })
  } catch {
    /* unreachable */
  }
}

// ── Corpán Plus paywall funnel ──
export function trackPaywallShown(
  surface: string,
  bookId?: string,
  language?: string,
): void {
  try {
    analytics.track("app_paywall_shown", {
      surface,
      ...(bookId ? { book_id: bookId } : {}),
      ...(language ? { language } : {}),
    })
  } catch {
    /* unreachable */
  }
}

export function trackPaywallDismissed(surface: string, bookId?: string): void {
  try {
    analytics.track("app_paywall_dismissed", {
      surface,
      ...(bookId ? { book_id: bookId } : {}),
    })
  } catch {
    /* unreachable */
  }
}

export function trackPaywallConverted(
  plan: "monthly" | "annual",
  surface: string,
): void {
  try {
    analytics.track("app_paywall_converted", { plan, surface })
  } catch {
    /* unreachable */
  }
}

/* ── Recommendation / ratings (on-device, no identifiers) ── */

/** An experience was surfaced to the user. `surface`: "tour" | "home" | "cycle". */
export function trackPackRecommended(surface: string, packId: string, position: number): void {
  try {
    analytics.track("app_pack_recommended", { surface, pack_id: packId, position })
  } catch {
    /* unreachable */
  }
}

/** The user liked / kept an experience (thumbs-up, or chose "Try it"). */
export function trackPackKept(packId: string, surface: string): void {
  try {
    analytics.track("app_pack_kept", { pack_id: packId, surface })
  } catch {
    /* unreachable */
  }
}

/** The user dismissed / skipped an experience ("Maybe later", thumbs-down). */
export function trackPackDiscarded(packId: string, surface: string): void {
  try {
    analytics.track("app_pack_discarded", { pack_id: packId, surface })
  } catch {
    /* unreachable */
  }
}

/** The recommendation cycle advanced (e.g. "Show me another"). */
export function trackCycleAdvanced(fromId: string | null, toId: string): void {
  try {
    analytics.track("app_cycle_advanced", { from_id: fromId ?? "", to_id: toId })
  } catch {
    /* unreachable */
  }
}

/** Hot-path increment, called from the TTS chokepoint. O(1) integer add. */
export function incrementSegmentCounter(language?: string): void {
  try {
    segmentsPlayed++
    if (language) languagesUsed.add(language)
  } catch {
    /* unreachable */
  }
}

/** Read the current session segment counter (snapshot, does not reset). */
export function getSessionSegmentCount(): number {
  return segmentsPlayed
}

// Opt-out toggle UI binds to these — same source of truth (localStorage flag)
// as everywhere else in the analytics module.
export const getOptOut = analytics.getOptOut
export const setOptOut = analytics.setOptOut
