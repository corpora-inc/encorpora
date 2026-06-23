// Parlometron daily quota → shared gate via the central quota registry.
//
// The limit/nag/unit live in ONE place — QUOTAS.parlometron_daily in
// @shared/monetization (15 rounds/local day, soft nag every 5, "soft, soft,
// hard"). At the cap the gate dispatches `corpan:daily-locked` for the host's
// accomplishment-lock overlay and stays blocked until local midnight or
// subscribe. Subscribers are a no-op (the gate reads the host-injected Plus
// globals). One module-level singleton so solo (game.ts) and multiplayer
// (multiplayer/round.ts) share a single per-day count under the persisted key
// `corpan:gate:pronunciation_coach:parlometron_daily`.

import { createDailyQuota } from "@shared/monetization"

export const paywallGate = createDailyQuota("parlometron_daily")
