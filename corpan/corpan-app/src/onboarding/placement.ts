// src/onboarding/placement.ts
//
// Pure derivation used to MERGE the two "prior exposure" onboarding questions
// into one. The Learn path already asks `calibrateLearn`
// ("Have you studied {{lang}} before?"), which sets `draft.levels`. That single
// answer is enough to decide the guided-Journey placement, so we no longer ask
// a second "are you new / do you know some?" screen (was `journeyPlacementOffer`).
//
//   levels === ["A0"]  (the "Never — total beginner" answer)  → zero-beginner
//   anything else       (any prior exposure)                   → probe
//
// "zero-beginner" pre-declines the in-surface probe offer (start at unit 1);
// "probe" leaves real placement to the Journey surface's own PlacementFlow.

export type JourneyPlacement = "zero-beginner" | "probe"

/** Derive the guided-Journey placement from the calibrateLearn `levels`.
 *  Only a total beginner (A0-only) starts at unit 1; any prior exposure is
 *  probed by the live PlacementFlow. Undefined/empty → probe (safe: the
 *  surface can always place them). */
export function derivePlacement(levels: string[] | undefined): JourneyPlacement {
  return levels && levels.length === 1 && levels[0] === "A0"
    ? "zero-beginner"
    : "probe"
}
