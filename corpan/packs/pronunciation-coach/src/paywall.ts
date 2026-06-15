// Parlometron daily quota → shared gate v2 (per-pack, release-tunable).
//
// A free user gets PARLO_DAILY_LIMIT pronunciation rounds per local day, with a
// dismissible soft nag every PARLO_DAILY_NAG_EVERY before the hard cap ("soft,
// soft, hard"); at the cap the gate dispatches `corpan:daily-locked` for the
// host's accomplishment-lock overlay and stays blocked until local midnight or
// subscribe. Subscribers are a no-op (the gate reads the host-injected Plus
// globals). One module-level singleton so solo (game.ts) and multiplayer
// (multiplayer/round.ts) share a single per-day count under the persisted key
// `corpan:gate:pronunciation_coach:parlometron_daily`.

import { createPaywallGate } from "@shared/monetization"

const PARLO_DAILY_LIMIT = 15
const PARLO_DAILY_NAG_EVERY = 5

export const paywallGate = createPaywallGate({
  packId: "pronunciation_coach",
  surface: "parlometron_daily",
  mode: "daily",
  dailyLimit: PARLO_DAILY_LIMIT,
  softNagEvery: PARLO_DAILY_NAG_EVERY,
  unitLabel: "rounds",
})
