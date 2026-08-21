// src/contentPacks/phrasePackInstall.ts
//
// Pure helpers behind the simplified onboarding phrase-pack step: compute the
// "packs you don't have installed yet" set (+ total download size) that the
// one-tap "Install all" call-to-action acts on, reconcile the optimistic
// activation after a batch install so a pack that FAILED to download is never
// left active (the main loop would otherwise try to sample from a pack that
// isn't on disk), and decide when the step should silently auto-skip itself
// (CTO feedback: a fully-installed starter set should never be shown).
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

export type AutoSkipInputs = {
  /** The catalog store's freshness stamp — null/undefined means the catalog
   *  hasn't landed yet (still loading, or offline first-boot with nothing
   *  cached). Only a CONFIRMED catalog can justify skipping the step. */
  lastFetched: number | null | undefined
  /** Whether the (already-fetched) catalog has any starter packs at all —
   *  an empty starter pool renders its own placeholder, never auto-skips. */
  hasStarter: boolean
  /** `planInstallAll(...).available.length` — zero means every starter pack
   *  the user is entitled to is already installed. */
  planAvailableCount: number
  /** The step's own UI phase; auto-skip only applies to a fresh, idle view —
   *  never mid-install or after a partial-failure notice. */
  phase: "idle" | "installing" | "failed"
  /** The user opened the à-la-carte grid — never yank it away mid-browse. */
  expanded: boolean
  /** True once this step has already auto-skipped itself once this
   *  onboarding session (persisted on the graph draft, survives the step's
   *  own unmount). Without this the ONLY way back to a prior step (Back)
   *  would just re-trigger the skip and bounce the user forward again. */
  alreadySkipped: boolean
}

/**
 * Decide whether the pickPhrasePacks onboarding step should silently
 * auto-advance instead of ever rendering its "you already have the starter
 * packs" message. Pure so the guard conditions are unit-testable without
 * mounting React; `OnboardingPickPhrasePacks` wires this to a layout effect
 * because the catalog fetch + installed registry are only known
 * asynchronously — this can't be decided at onboarding-graph-transition time
 * (see that component's file header for the full writeup, including why the
 * `alreadySkipped` / Back-navigation guard exists).
 */
export function shouldAutoSkipPhrasePacks(inputs: AutoSkipInputs): boolean {
  return (
    !inputs.alreadySkipped &&
    inputs.phase === "idle" &&
    !inputs.expanded &&
    inputs.lastFetched != null &&
    inputs.hasStarter &&
    inputs.planAvailableCount === 0
  )
}
