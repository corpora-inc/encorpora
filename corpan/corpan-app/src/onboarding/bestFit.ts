// src/onboarding/bestFit.ts
//
// The onboarding "aha moment" router. At the end of onboarding we drop the
// user STRAIGHT into the single best-fit experience for what they told us,
// instead of handing them a choice-overloaded Home where low-agency users
// freeze and bounce.
//
// This is a thin, deterministic wrapper over the SAME ranking that powers
// Home's "For you" recommendation (`@/experiences/registry`) — so the auto-
// launched experience is exactly the one Home would have starred. We do NOT
// hand-roll a parallel mapping; we reuse `rankExperiences` and then pick the
// top candidate that is actually LAUNCHABLE right now.
//
// Launchable = the built-in phrase experience (always available) OR a pack
// that is already installed. We never auto-launch a pack the user doesn't
// have on disk (the host launch path needs an installed game), and we never
// auto-launch a preview/excluded pack. If nothing better is launchable we
// fall back to the phrase experience; if even that's unclear we return null,
// which preserves today's behavior (land on Home / the guided tour).

import { rankExperiences, type ExperienceMeta } from "@/experiences/registry"
import type { UserClass } from "@/store/settings"

/** The built-in phrase experience pack id (no manifest — app-native overlay). */
export const PHRASE_PACK_ID = "phrase_main"

/**
 * Packs we must NEVER auto-launch at onboarding finish, even if installed
 * (e.g. dev-seeded). These are preview/owner-excluded experiences that should
 * not be the first thing an average new user sees. Mirrors the catalog's
 * `channel: "preview"` exclusion, but applied defensively here since the
 * best-fit decision runs at commit time without the catalog channel in scope.
 */
const AUTO_LAUNCH_BLOCKLIST = new Set<string>(["corpan_city", "teletron"])

export type BestFitInput = {
  userClass: UserClass | null
  /** Interest tags from onboarding's "What do you want to do?" multi-select. */
  interests: string[]
  /** CEFR levels chosen during calibration (e.g. ["A0"]). Currently advisory. */
  level?: string[]
  /** The stack's languages (primary + targets). Gates language-specific packs. */
  languages: string[]
  /**
   * Ids that can actually be launched right now: the phrase experience plus
   * every installed pack. The caller supplies this from the games store so the
   * mapping stays pure + testable (no store access inside this module).
   */
  installedIds: string[]
}

export type BestFitTarget =
  | { kind: "pack"; packId: string }
  | { kind: "phrase" }

/**
 * Compute the single best-fit experience to auto-launch at the end of
 * onboarding. Returns `null` when there's no confident pick — the caller then
 * preserves today's behavior (Home / guided tour). Pure + deterministic.
 */
export function bestFitExperience(input: BestFitInput): BestFitTarget | null {
  const launchable = new Set<string>(input.installedIds)
  // The phrase experience is always launchable (app-native, no install).
  launchable.add(PHRASE_PACK_ID)

  // Rank with the exact Home scoring (interests + class + language gate). We
  // pass the built-in registry as candidates (catalog metadata isn't needed
  // here — every candidate we'd auto-launch is a known built-in/GA pack).
  const ranked: ExperienceMeta[] = rankExperiences({
    interests: input.interests ?? [],
    userClass: input.userClass,
    ageBand: null,
    userLanguages: input.languages,
  })

  // Walk best-first; take the top experience that is launchable + not blocked.
  for (const meta of ranked) {
    if (AUTO_LAUNCH_BLOCKLIST.has(meta.id)) continue
    if (!launchable.has(meta.id)) continue
    if (meta.id === PHRASE_PACK_ID) return { kind: "phrase" }
    return { kind: "pack", packId: meta.id }
  }

  // Nothing ranked was launchable — fall back to the universal phrase
  // experience if it's available (it always is), else give up → Home.
  if (launchable.has(PHRASE_PACK_ID)) return { kind: "phrase" }
  return null
}
