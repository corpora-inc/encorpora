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

import type { VignetteHost } from "./types"
import { createTaxiVignette, type TaxiOptions } from "./taxi"

/** Canonical ids the city's portals key on (one per shipped vignette). */
export const VIGNETTE_IDS = {
  taxi: "taxi",
} as const

export type VignetteId = (typeof VIGNETTE_IDS)[keyof typeof VIGNETTE_IDS]

/**
 * Options for the built-in roster. Each shipped vignette gets its own slot so the
 * orchestrator can inject live, content-derived config (e.g. the taxi's real
 * topology destinations) at registration time. All optional — omitting a slot
 * registers that vignette with its self-contained standalone defaults.
 */
export interface BuiltinVignetteOptions {
  taxi?: TaxiOptions
}

/**
 * Register the shipped vignette roster onto a host. The taxi is the reference;
 * future entries (café, bank, bus, subway, airport gate, restaurant) register the
 * same way — each a factory under its canonical id. The factory is invoked per
 * ENTRY (one fresh instance per ride), so injected options are captured here.
 */
export function registerBuiltinVignettes(
  host: VignetteHost,
  opts: BuiltinVignetteOptions = {},
): void {
  host.register(VIGNETTE_IDS.taxi, () => createTaxiVignette(opts.taxi))
}
