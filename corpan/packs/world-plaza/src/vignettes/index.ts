/**
 * Vignettes — the enterable sub-experience framework (the v2 scene seam).
 *
 * Barrel + the built-in registration helper. The orchestrator (game.ts) builds
 * the host with the live services, calls `registerBuiltinVignettes`, then wires
 * city portal anchors to `host.enter(id, { anchorId })`. See `docs/VIGNETTES.md`.
 *
 * Public surface:
 *   - createVignetteHost(opts)         — the lifecycle host the city drives.
 *   - registerBuiltinVignettes(host, opts?) — registers the shipped roster.
 *   - createTaxiVignette(opts)         — the reference taxi (register directly to
 *                                        inject real destinations).
 *   - types: Vignette, VignetteContext, VignetteResult, VignetteServices, …
 */

export * from "./types"
export { createVignetteHost } from "./host"
export { createTaxiVignette } from "./taxi"
export type { TaxiDestination, TaxiOptions } from "./taxi"
export { createBoardingVignette } from "./boarding"
export type { BoardingDestination, BoardingOptions, BoardingMode } from "./boarding"
export { createPlaceVignette } from "./place"
export type { PlaceKind, PlaceOptions, PlaceObjective } from "./place"

import type { VignetteHost } from "./types"
import { createTaxiVignette, type TaxiOptions } from "./taxi"
import { createBoardingVignette, type BoardingDestination } from "./boarding"
import { createPlaceVignette, type PlaceObjective } from "./place"

/** Canonical ids the city's portals key on (one per shipped vignette). The three
 *  transit-hero ids match the city anchors the orchestrator binds them to:
 *  `bus` ↔ `bus_station`, `train` ↔ `rail_station`, `flight` ↔ `airport`. The
 *  `cafe` enterable-PLACE id matches the `cafe` city anchor (#14). */
export const VIGNETTE_IDS = {
  taxi: "taxi",
  bus: "bus",
  train: "train",
  flight: "flight",
  cafe: "cafe",
} as const

export type VignetteId = (typeof VIGNETTE_IDS)[keyof typeof VIGNETTE_IDS]

/** Destinations a boarding vignette offers (injected per-mode by the orchestrator). */
export interface BoardingSlot {
  destinations?: BoardingDestination[]
  clerkId?: string
  clerkName?: string
}

/**
 * Options for the built-in roster. Each shipped vignette gets its own slot so the
 * orchestrator can inject live, content-derived config (real topology
 * destinations) at registration time. All optional — omitting a slot registers
 * that vignette with its self-contained standalone defaults.
 */
/** Options for the enterable CAFÉ place (#14): which objective the order action
 *  runs + a quest step it satisfies, and the resident barista's stable id/name. */
export interface CafeSlot {
  /** The order objective (challenge tool + the quest step it advances). */
  objective?: PlaceObjective
  baristaId?: string
  baristaName?: string
}

export interface BuiltinVignetteOptions {
  taxi?: TaxiOptions
  bus?: BoardingSlot
  train?: BoardingSlot
  flight?: BoardingSlot
  cafe?: CafeSlot
}

/**
 * Register the shipped vignette roster onto a host. The taxi is the bespoke
 * back-seat reference; the BUS / TRAIN / FLIGHT transit heroes share the boarding
 * vignette (one factory, three mode skins). Each factory is invoked per ENTRY (a
 * fresh instance per trip), so injected options are captured here.
 */
export function registerBuiltinVignettes(
  host: VignetteHost,
  opts: BuiltinVignetteOptions = {},
): void {
  host.register(VIGNETTE_IDS.taxi, () => createTaxiVignette(opts.taxi))
  host.register(VIGNETTE_IDS.bus, () => createBoardingVignette({ mode: "bus", ...opts.bus }))
  host.register(VIGNETTE_IDS.train, () => createBoardingVignette({ mode: "train", ...opts.train }))
  host.register(VIGNETTE_IDS.flight, () => createBoardingVignette({ mode: "flight", ...opts.flight }))
  // The enterable CORNER CAFÉ (#14): a warm place-interior where the café-order
  // objective plays out (overlay scene — perf-zero). The orchestrator injects the
  // objective (quest step + reward) so ordering advances the active café quest.
  host.register(VIGNETTE_IDS.cafe, () =>
    createPlaceVignette({
      kind: "cafe",
      copyKey: "cafe",
      fallback: {
        sign: "Café",
        title: "Corner Café",
        sub: "Coffee, pastries & a warm welcome",
        keeper: "the barista",
        greet: [
          "Welcome in! What can I get you?",
          "The coffee's fresh — what would you like?",
          "Take a seat, I'll be right with you.",
        ],
      },
      keeperId: opts.cafe?.baristaId ?? "cafe-barista",
      keeperName: opts.cafe?.baristaName,
      persona: {
        tone: "a warm, easygoing barista who loves a friendly chat over the counter",
        quirks: [
          "greets you and asks what you'd like to order",
          "recommends today's special with a little pride",
          "wishes you a good day whether or not you order",
        ],
      },
      objective: opts.cafe?.objective,
    }),
  )
}
