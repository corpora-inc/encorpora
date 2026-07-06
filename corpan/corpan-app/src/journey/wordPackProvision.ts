// src/journey/wordPackProvision.ts
//
// Pure availability resolver for the Journey inline word-explanation offer.
// wordpan "word-explanation" packs enrich the resolver's word cards (native
// meaning paragraph + etymology gems, see content/resolve.ts::resolveWord +
// cards/WordEnrichment) once the (native→target) pair pack is installed. We
// NEVER auto-download — the inline WordPackOfferBanner asks the user first.
// This module answers only "is there a pack to offer for this pair, and which
// index entry is it?" — a side-effect-free index lookup, unit-testable without
// a DOM or Tauri.
//
// GENERIC BY DESIGN: nothing here assumes target === "en" or native === "es".
// Availability is purely the index lookup, so the day an en→fr pack is
// published it is offered to en-native / fr-target stacks with zero changes.

import {
  findWordPackForPair,
  visibleWordPacks,
  type WordPackCatalog,
  type WordPackCatalogEntry,
} from "../contentPacks/wordPackCatalog"

/**
 * The word-pack index entry to offer for a (native→target) pair, or null when
 * there is nothing to offer: no catalog, an empty/degenerate (same-language)
 * pair, or no published pack for the pair.
 *
 * `devMode: true` is passed to `visibleWordPacks` on PURPOSE: it bypasses the
 * preview-CHANNEL discovery gate (the current 53 packs all ship as
 * `channel: "preview"`) while STILL honoring `minAppVersion` — the Journey
 * offer surfaces the pair regardless of the Settings channel policy, but never
 * an entry a stale app cannot render.
 */
export function matchWordPackOffer(
  catalog: WordPackCatalog | null | undefined,
  appVersion: string,
  nativeLang: string,
  targetLang: string,
): WordPackCatalogEntry | null {
  if (!catalog) return null
  const n = (nativeLang || "").trim()
  const t = (targetLang || "").trim()
  if (!n || !t) return null
  // A language does not explain its own words (base-subtag compare).
  if (n.split("-")[0] === t.split("-")[0]) return null
  const entry = findWordPackForPair(
    visibleWordPacks(catalog, appVersion, true),
    n,
    t,
  )
  return entry ?? null
}
