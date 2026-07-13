// src/contentPacks/phrasePackInstall.ts
//
// Pure helpers behind the simplified onboarding phrase-pack step: compute the
// "packs you don't have installed yet" set (+ total download size) that the
// one-tap "Install all" call-to-action acts on, and reconcile the optimistic
// activation after a batch install so a pack that FAILED to download is never
// left active (the main loop would otherwise try to sample from a pack that
// isn't on disk).
//
// Kept UI-free + dependency-free so it's unit-testable without React/zustand.

import type { PhrasePackCatalogEntry } from "./phrasePackCatalog"

export type InstallAllPlan = {
  /** Starter packs not already installed AND installable in onboarding
   *  (free / entitled) — exactly what "Install all" downloads. */
  available: PhrasePackCatalogEntry[]
  /** Sum of `sizeMb` across `available`. Missing sizes contribute 0, so render
   *  copy should say "~N MB", never "exactly N MB". */
  totalSizeMb: number
}

/**
 * Plan the one-tap install: from the starter pool, keep the packs the user
 * doesn't already have on disk and is allowed to install here (paid/un-entitled
 * packs are excluded — they stay in the à-la-carte "Choose individually" list).
 */
export function planInstallAll(
  starterPacks: PhrasePackCatalogEntry[],
  installedIds: Iterable<string>,
  isEntitled: (p: PhrasePackCatalogEntry) => boolean,
): InstallAllPlan {
  const installed =
    installedIds instanceof Set ? installedIds : new Set(installedIds)
  const available = starterPacks.filter(
    (p) => !installed.has(p.id) && isEntitled(p),
  )
  const totalSizeMb = available.reduce((sum, p) => sum + (p.sizeMb ?? 0), 0)
  return { available, totalSizeMb }
}

export type BatchOutcome = {
  installed: string[]
  failed: Array<{ id: string; error: string }>
}

/**
 * After a batch install, drop any pack that FAILED from the optimistically-
 * activated id list — so a partial failure never leaves an un-downloaded pack
 * active. Returns the reconciled active list (unchanged when nothing failed).
 */
export function reconcileActiveAfterBatch(
  activeIds: string[],
  outcome: BatchOutcome,
): string[] {
  if (outcome.failed.length === 0) return activeIds
  const failed = new Set(outcome.failed.map((f) => f.id))
  return activeIds.filter((id) => !failed.has(id))
}
