// src/components/home/recommend.ts
//
// Home recommendation ranking. Scoring lives in `@/experiences/registry`; this
// adapter assembles the CANDIDATE set CATALOG-FIRST — every catalog pack
// contributes its own metadata (categories / order / good-for-class), so newly
// published packs rank automatically without an app release. The built-in
// phrase experience and any catalog gaps fall back to the local registry.

import {
  rankExperiences,
  resolveExperienceMeta,
  type ExperienceMeta,
  type RankOpts,
} from "@/experiences/registry"
import type { CatalogGame } from "@/contentPacks/catalog"

/**
 * Ranked experiences best-first for this user, drawn from the catalog (+ the
 * built-in phrase experience + installed packs), driven by interests + profile.
 */
export function rankHomeExperiences(
  opts: RankOpts,
  catalogGames: CatalogGame[],
  installedIds: Set<string>,
): ExperienceMeta[] {
  const metas = new Map<string, ExperienceMeta>()
  // Built-in phrase experience is always available (registry fallback).
  metas.set("phrase_main", resolveExperienceMeta("phrase_main"))
  // Catalog packs are the primary source of recommendation metadata.
  for (const g of catalogGames) metas.set(g.id, resolveExperienceMeta(g.id, g))
  // Installed packs missing from the catalog still rank (registry fallback).
  for (const id of installedIds) {
    if (!metas.has(id)) metas.set(id, resolveExperienceMeta(id))
  }
  return rankExperiences(opts, [...metas.values()])
}

export type { ExperienceMeta, RankOpts }
