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
import {
  record as recordLocalEvent,
  drainForUpload,
  acknowledge,
  count as localEventCount,
} from "@/util/storage/eventStore"

declare const __APP_VERSION__: string

const ANALYTICS_ENDPOINT = "https://d1xp3xghrx3jfa.cloudfront.net/v1/events"
const READER_ID = "corpan-app"

// Build-time kill switch. Default ON (opt-out model).
const KILL_SWITCH_OFF = import.meta.env.VITE_ANALYTICS_ENABLED === "false"

let initialized = false

/* -------------------------------------------------------------------------- */
/*  Single analytics path: cloud queue + durable on-device event store        */
/* -------------------------------------------------------------------------- */
//
// `emit()` is THE chokepoint. Every tracked event flows through it so there is
// exactly one analytics path for the whole app:
//   1. `analytics.track` → the shared module's in-memory + spillover cloud
//      queue (network sync, opt-out-gated, CORS-safe keepalive fetch).
//   2. `recordLocalEvent` → the IndexedDB ring-buffer (durable, on-device,
//      survives reload, quota-safe). This is the "almost full analytics"
//      substrate: rich capture without blowing storage.
// Both are safe-by-construction and never throw to the caller.

type EventProps = Record<string, string | number | boolean>

function emit(eventName: string, props?: EventProps): void {
  try {
    analytics.track(eventName, props ?? {})
  } catch {
    /* unreachable; shared track() is safe-by-construction */
  }
  try {
    // Respect the SAME opt-out flag as the cloud path: when opted out we keep
    // nothing on device either. (getOptOut reads the shared localStorage flag.)
    if (!analytics.getOptOut()) {
      void recordLocalEvent(eventName, props)
    }
  } catch (err) {
    console.error("[analytics] local record failed:", err)
  }
}

// Session-scope counters — plain module refs, not React state.
// Reset implicitly on page reload (the session itself ends).
let packsEntered = 0
let segmentsPlayed = 0
const languagesUsed = new Set<string>()

function emitSessionSummary(): void {
  try {
    emit("app_session_summary", {
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
    emit("app_pack_entered", { pack_id: packId, language })
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
    emit("app_pack_heartbeat", {
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
    emit("app_pack_exited", {
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
    emit("app_language_switched", {
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
    emit("app_onboarding_completed")
  } catch {
    /* unreachable */
  }
}

/** Fired when onboarding auto-launches a best-fit experience (the "aha
 *  moment"). `target` is the launched pack id, or "home" when the user chose
 *  to explore / no confident best-fit was found. */
export function trackOnboardingLaunch(target: string): void {
  try {
    emit("app_onboarding_launch", { target })
  } catch {
    /* unreachable */
  }
}

export function trackPaidUnlockViewed(surface: string, packId?: string): void {
  try {
    emit("app_paid_unlock_viewed", {
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
    emit("app_paywall_shown", {
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
    emit("app_paywall_dismissed", {
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
    emit("app_paywall_converted", { plan, surface })
  } catch {
    /* unreachable */
  }
}

/* ── Recommendation / ratings (on-device, no identifiers) ── */

/** An experience was surfaced to the user. `surface`: "tour" | "home" | "cycle". */
export function trackPackRecommended(surface: string, packId: string, position: number): void {
  try {
    emit("app_pack_recommended", { surface, pack_id: packId, position })
  } catch {
    /* unreachable */
  }
}

/** The user liked / kept an experience (thumbs-up, or chose "Try it"). */
export function trackPackKept(packId: string, surface: string): void {
  try {
    emit("app_pack_kept", { pack_id: packId, surface })
  } catch {
    /* unreachable */
  }
}

/** The user dismissed / skipped an experience ("Maybe later", thumbs-down). */
export function trackPackDiscarded(packId: string, surface: string): void {
  try {
    emit("app_pack_discarded", { pack_id: packId, surface })
  } catch {
    /* unreachable */
  }
}

/** The recommendation cycle advanced (e.g. "Show me another"). */
export function trackCycleAdvanced(fromId: string | null, toId: string): void {
  try {
    emit("app_cycle_advanced", { from_id: fromId ?? "", to_id: toId })
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

/* -------------------------------------------------------------------------- */
/*  Rich event capture (sessions / screens / challenges / errors)             */
/* -------------------------------------------------------------------------- */
//
// "Almost full analytics" without blowing storage: these all flow through the
// same `emit()` chokepoint, so they hit both the cloud queue and the durable
// on-device ring buffer. New event types should be added here (a one-liner),
// not by reaching for `analytics.track` directly — that would bypass the
// on-device log.

/** A top-level screen / route was shown. */
export function trackScreenView(screen: string, props?: EventProps): void {
  emit("app_screen_view", { screen, ...(props ?? {}) })
}

/** A pack/experience was opened (distinct from `trackPackEntered`, which also
 *  bumps the session counters — use this for non-phrase experiences). */
export function trackPackOpen(packId: string, source?: string): void {
  emit("app_pack_open", { pack_id: packId, ...(source ? { source } : {}) })
}

/** A challenge / exercise / lesson was completed. */
export function trackChallengeCompleted(
  challengeId: string,
  props?: EventProps,
): void {
  emit("app_challenge_completed", { challenge_id: challengeId, ...(props ?? {}) })
}

/** A handled error worth telemetry (NOT a silent swallow — the caller should
 *  also log). Keep the message short + non-PII. */
export function trackError(where: string, message: string): void {
  emit("app_error", { where, message: String(message).slice(0, 200) })
}

/** Escape hatch for one-off events. Prefer a named wrapper above. */
export function trackEvent(eventName: string, props?: EventProps): void {
  emit(eventName, props)
}

/* -------------------------------------------------------------------------- */
/*  Sync seam — drain the on-device log to the cloud /v1/events endpoint       */
/* -------------------------------------------------------------------------- */
//
// The on-device ring buffer is the source of truth for retention; the shared
// module's own queue handles the live, low-latency cloud path. This seam is a
// belt-and-suspenders RECONCILE: it batch-uploads any locally-durable events
// the live path may have dropped (e.g. the device was offline when they were
// recorded, then the app was killed before the spillover flushed), and acks
// them out of the local log on success. It is intentionally decoupled from the
// network transport: swap `uploadBatch` to retarget without touching capture.

let syncInFlight = false

async function uploadBatch(events: { seq: number; event: string; ts: number; props?: EventProps }[]): Promise<boolean> {
  try {
    // CORS-safe: credentials omitted, wildcard ACAO honored (see the shared
    // module's CORS note). We post the same envelope shape the endpoint takes.
    const res = await fetch(ANALYTICS_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        events: events.map((e) => ({
          schema: 1,
          event: e.event,
          ts: new Date(e.ts).toISOString(),
          reader_id: READER_ID,
          app_version: __APP_VERSION__,
          props: e.props ?? {},
        })),
      }),
      credentials: "omit",
      mode: "cors",
      keepalive: true,
    })
    return res.ok || res.status === 204
  } catch (err) {
    console.error("[analytics] reconcile upload failed:", err)
    return false
  }
}

/** Reconcile the on-device event log with the cloud. Opt-out-gated, single-
 *  flight, best-effort. Returns the number of events successfully uploaded. */
export async function syncLocalEvents(): Promise<number> {
  if (KILL_SWITCH_OFF) return 0
  if (syncInFlight) return 0
  try {
    if (analytics.getOptOut()) return 0
  } catch {
    /* if the flag read throws, err on the side of not uploading */
    return 0
  }
  syncInFlight = true
  let uploaded = 0
  try {
    // Drain in batches until the log is empty or a batch fails.
    // Bounded loop so a huge backlog can't monopolize the main thread.
    for (let i = 0; i < 20; i += 1) {
      const batch = await drainForUpload()
      if (batch.length === 0) break
      const ok = await uploadBatch(batch)
      if (!ok) break
      await acknowledge(batch.map((e) => e.seq))
      uploaded += batch.length
      if (batch.length < 50) break
    }
  } catch (err) {
    console.error("[analytics] syncLocalEvents failed:", err)
  } finally {
    syncInFlight = false
  }
  return uploaded
}

/** Count of events durably stored on-device (for a debug / settings surface). */
export async function getLocalEventCount(): Promise<number> {
  try {
    return await localEventCount()
  } catch {
    return 0
  }
}
