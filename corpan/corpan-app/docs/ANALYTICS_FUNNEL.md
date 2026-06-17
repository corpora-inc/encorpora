# Monetization Funnel Analytics

How Corpán measures the path from **entering a pack** → **hitting the paywall** →
**converting**. This documents the event taxonomy and where each event is
instrumented.

## Privacy contract (non-negotiable)

- **Anonymous + opt-in.** The only identifier is an in-memory **session UUID**
  generated per app session by `@shared/analytics` (gone on reload). No account,
  no device ID, no install ID, no IP storage. (A separate persistent anon
  `subjectId` exists for IAP/entitlement verification only — it is **not** sent
  with analytics events.)
- **One opt-out flag.** `localStorage["corpan-analytics-disabled"]` (Settings →
  "Send anonymous usage data", `AnonymousAnalyticsToggle.tsx`). When set, no
  network and no on-device record happen.
- **Build kill switch.** `VITE_ANALYTICS_ENABLED=false` disables all main-app
  analytics.
- **No PII, low cardinality.** Event + property names are `lowercase_snake`.
  Values are string / number / boolean only — no free text, no high-cardinality
  identifiers.

## Architecture (audited)

Analytics are **anonymous-aggregate telemetry**, not purely on-device. Every
tracked event flows through the single chokepoint `emit()` in
`src/util/analytics.ts`, which does two things (both opt-out-gated,
safe-by-construction, never throws):

1. `@shared/analytics.track()` → in-memory + `localStorage` spillover queue →
   batched POST to the ingest endpoint
   `https://d1xp3xghrx3jfa.cloudfront.net/v1/events`
   (`aws_cloudfront_distribution.analytics` in terraform). `credentials: "omit"`,
   `keepalive` fetch (CORS-safe from the Tauri `corpan-pack://` origin), flushed
   on a 30s timer / batch threshold / `pagehide`.
2. `recordLocalEvent()` → durable IndexedDB ring buffer (quota-safe). A
   belt-and-suspenders `syncLocalEvents()` reconcile re-uploads anything the live
   path dropped.

Events carry a `reader_id` (`"corpan-app"` for the host; reader packs use their
own) so host + pack events coexist without collision.

> The repo `CLAUDE.md` line "on-device analytics only" is outdated — the real
> architecture is anonymous-aggregate with an opt-in consent gate. The privacy
> *promise* (anonymous, no accounts/IDs, opt-out) holds.

## Funnel taxonomy

All funnel events use the `app_funnel_*` namespace so the warehouse can build the
funnel from one coherent set. They are **additive** — legacy events
(`app_pack_entered`, `app_paywall_shown`, `app_paywall_converted`, …) keep firing
unchanged.

| Event | Props | Fired when |
|---|---|---|
| `app_funnel_pack_enter` | `pack_id` | A pack/experience overlay mounts |
| `app_funnel_pack_exit` | `pack_id`, `duration_ms` | The pack overlay unmounts (dwell time) |
| `app_funnel_gate_hit` | `pack_id`, `surface`, `mode` | The shared paywall gate fires (`mode` = gate reason: action/daily/timed) |
| `app_funnel_paywall_shown` | `surface`, `pack_id?` | The paywall sheet becomes visible |
| `app_funnel_paywall_dismissed` | `surface` | Sheet closed WITHOUT converting |
| `app_funnel_paywall_cta_tapped` | `surface`, `plan` | User taps Subscribe (intent, pre-store) |
| `app_funnel_paywall_converted` | `surface`, `plan`, `had_code` | Sheet closed AFTER becoming subscribed |
| `app_funnel_trial_started` | `plan` | An intro/offer (trial) purchase path was used |
| `app_funnel_subscription_purchased` | `plan`, `platform`, `code?` | Platform confirms a subscription purchase |
| `app_funnel_subscription_restored` | — | A prior subscription is re-verified via Restore |
| `app_funnel_code_field_opened` | — | First non-empty input into the code field |
| `app_funnel_code_resolved` | `classification`, `purchase_action` | Server `/code/resolve` accepts a code |
| `app_funnel_code_redeemed` | `partner` | Server confirms affiliate/offer attribution on a purchase |
| `app_onboarding_launch` | `target` | Onboarding auto-launches a best-fit experience (pre-existing) |

`surface` ∈ the `PaywallSurface` union (`reader_eof_free`, `library_unlock`,
`onboarding_pitch`, `home_chip`, `settings`, `beatlounge_session`,
`subscription_offer`, `other`, …). `plan` ∈ `{monthly, annual}`.
`mode` ∈ `{action, daily, timed}`.

## Instrumentation map (file : symbol)

- `pack_enter` / `pack_exit` — `src/components/ContentPackOverlay.tsx`
  (`trackPackEnter` at mount, `trackPackExit` with dwell on unmount).
- `gate_hit` — `src/App.tsx` `onRequestUnlock` listener. Emits ONLY for genuine
  shared-gate fires (the `corpan:request-unlock` detail carries both `packId` and
  `reason`); user-initiated dispatches (Library "Unlock", reader EOF) omit those
  and do not emit `gate_hit`. Host-owned so packs need no analytics dependency.
  The shared gate also exposes an optional `onFire` hook
  (`packs/shared/monetization`) for standalone hosts.
- `paywall_shown` / `paywall_dismissed` / `paywall_converted` (store backstop) —
  `src/store/paywall.ts`. `openPaywall` emits `paywall_shown` at the single open
  chokepoint; `closePaywall` classifies by entitlement state (now-subscribed →
  converted, else dismissed). The visual components
  (`PaywallSheet.tsx` / `SubscriptionOffer.tsx`) are not touched for these.
- `paywall_cta_tapped` / `code_field_opened` — `src/components/packs/SubscriptionOffer.tsx`
  (function-body logic only, no markup change): CTA in `handleSubscribe`
  (surface from the active paywall context); code field via a one-shot ref on
  first non-empty input.
- `trial_started` / `subscription_purchased` / `code_resolved` / `code_redeemed`
  / `subscription_restored` — `src/contentPacks/purchase.ts`
  (`purchaseAndVerify`, `resolveCode`, `restoreAndSync`). `subscription_purchased`
  fires on PLATFORM confirmation (the source of truth), so it is captured even if
  backend verification later fails.
- `onboarding_launch` — `src/onboarding/graph.ts` (`trackOnboardingLaunch`,
  pre-existing).

## Adding a new funnel event

Add a named wrapper in `src/util/analytics.ts` that calls `emit("app_funnel_…",
{…})` — never call `@shared/analytics.track` directly (that bypasses the durable
on-device log). Keep names `lowercase_snake` and low-cardinality.
