// Streak — shared per-pack "visit streak" retention primitive for Corpán packs.
//
// Counts consecutive local days a pack was opened, shown to ALL users. It is a
// retention signal, NOT a gate (no paywall path here). The host records visits
// at the pack-enter boundary; packs/UI read via getPackStreak / the host API and
// subscribe to the `corpan:streak-changed` window event. See ./src/streak.ts.

export { recordPackVisit, getPackStreak, localDay } from "./src/streak"

export type { StreakState, StreakChangedDetail } from "./src/types"
