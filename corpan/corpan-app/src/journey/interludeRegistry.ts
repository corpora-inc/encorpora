// src/journey/interludeRegistry.ts
//
// Builds the list of INSTALLED interlude-capable packs the Journey mixer may
// schedule as game spikes / reader breaths (PREMIUM_SCROLL §2.2/§2.3). This is
// the generalization of the old lingo-hero-only path: instead of a hardcoded
// provider, the mixer picks among whatever interlude packs are installed,
// classified into game vs reader by their catalog `packType` and keyed by their
// DECLARED `activities` (activity-contract.md §4.3).
//
// A pack qualifies when:
//   1. it is INSTALLED (present in the passed installed-id set), and
//   2. its catalog entry declares at least one journey activity, and
//   3. that activity requires only the `journey` host api (an interlude drills
//      one phrase through the pack↔host result ABI — no stt/llm gating here),
//      and its packType classifies it as a game or a reader.
//
// Pure + host-free so the engine test can drive it headless; the wiring layer
// (runtimeWiring.buildInterludeProviders) feeds it the live catalog + installed
// registry.

import type { CatalogGame } from "../contentPacks/catalog.ts"
import type { InterludeProvider } from "./engine/types.ts"

/** packType → interlude kind. Unknown/other types are NOT interludes. */
function interludeKindOf(packType: string | undefined): "game" | "reader" | null {
  if (packType === "game") return "game"
  if (packType === "reader") return "reader"
  return null
}

/**
 * Build the installed interlude providers from the app catalog + the set of
 * installed pack ids. Deterministic order (game providers first, then readers,
 * each in catalog order) so the mixer's pick is stable across renders.
 */
export function buildInterludeProviders(
  catalog: readonly CatalogGame[],
  installedIds: ReadonlySet<string>,
): InterludeProvider[] {
  const out: InterludeProvider[] = []
  for (const entry of catalog) {
    if (!installedIds.has(entry.id)) continue
    const kind = interludeKindOf(entry.packType)
    if (!kind) continue
    const activities = entry.activities ?? []
    for (const act of activities) {
      // An interlude must speak the pack↔host result ABI over just `journey`.
      // A required stt/llm dependency means it can't be a drop-anywhere sip.
      const apis = act.requiredHostApis ?? ["journey"]
      if (!apis.includes("journey")) continue
      if (apis.some((a) => a !== "journey")) continue
      if ((act.modelNeeds ?? []).length > 0) continue
      const itemKinds = act.itemKinds ?? []
      if (itemKinds.length === 0) continue
      out.push({
        provider: entry.id,
        kind,
        activityType: act.activityType,
        itemKinds: [...itemKinds],
        estSec: act.typicalDurationSec ?? 40,
      })
    }
  }
  // game providers first (spikes), then readers (breaths) — a stable, kind-
  // grouped order the mixer relies on for deterministic selection.
  return out.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "game" ? -1 : 1))
}
