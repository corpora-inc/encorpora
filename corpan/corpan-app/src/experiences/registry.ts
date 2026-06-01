// src/experiences/registry.ts
//
// Catalog-shaped metadata for the built-in + pack experiences, plus a pure,
// deterministic ranking used by the Home "For you" recommendation. Kept as a
// local map for now; when the published catalog grows these fields, read them
// from the catalog and fall back to this map. NO hardcoded per-class lists in
// the UI — ranking is a score over (interests + profile) × this metadata.

import type { UserClass, AgeBand } from "@/store/settings"

/** The interest tags collected by onboarding's "What do you want to do?". */
export type ExperienceCategory =
  | "read"
  | "audio"
  | "games"
  | "speak"
  | "study"
  | "wild"

export type ExperienceMeta = {
  id: string
  categories: ExperienceCategory[]
  /** User classes this experience is an especially good fit for. */
  goodForClass: UserClass[]
  /** i18n keys (name falls back to the catalog's localized name when present). */
  nameKey: string
  blurbKey: string
  /** Cold-start order / tiebreak — lower surfaces earlier when scores tie. */
  order: number
  /** Gentle, kid-friendly content (small bonus for the child journey). */
  kidFriendly?: boolean
  /**
   * Language tags this experience is SPECIFIC to (e.g. Hanzipan → Chinese). If
   * set and NONE of the user's languages overlap (by base language), the
   * experience is heavily penalized so it sinks to the bottom — Hanzipan should
   * never top the list for an English learner. Omit for language-agnostic packs.
   */
  languages?: string[]
}

/**
 * The experience metadata. `phrase_main` (Phrase Flip) is intentionally
 * `order: 8` with narrow categories so it is NOT the default star — it only
 * rises when the user signals study/speak interest or is a learner/polyglot.
 */
export const EXPERIENCES: ExperienceMeta[] = [
  {
    id: "earthgate_reader",
    categories: ["read", "audio"],
    goodForClass: ["enjoyer", "kid_native", "learner", "polyglot"],
    nameKey: "experiences.earthgate_reader.name",
    blurbKey: "experiences.earthgate_reader.blurb",
    order: 1,
    kidFriendly: true,
  },
  {
    id: "stargate_reader",
    categories: ["read", "audio", "wild"],
    goodForClass: ["enjoyer", "polyglot"],
    nameKey: "experiences.stargate_reader.name",
    blurbKey: "experiences.stargate_reader.blurb",
    order: 2,
  },
  {
    id: "world_radio",
    categories: ["audio", "wild"],
    goodForClass: ["enjoyer", "polyglot", "learner", "kid_native"],
    nameKey: "experiences.world_radio.name",
    blurbKey: "experiences.world_radio.blurb",
    order: 3,
  },
  {
    id: "hover_runner",
    categories: ["games", "read"],
    goodForClass: ["kid_native", "learner"],
    nameKey: "experiences.hover_runner.name",
    blurbKey: "experiences.hover_runner.blurb",
    order: 4,
    kidFriendly: true,
  },
  {
    id: "juice_squeeze",
    categories: ["games", "study"],
    goodForClass: ["learner", "kid_native"],
    nameKey: "experiences.juice_squeeze.name",
    blurbKey: "experiences.juice_squeeze.blurb",
    order: 5,
    kidFriendly: true,
  },
  {
    id: "pronunciation_coach",
    categories: ["speak", "games"],
    goodForClass: ["learner", "kid_native"],
    nameKey: "experiences.pronunciation_coach.name",
    blurbKey: "experiences.pronunciation_coach.blurb",
    order: 6,
  },
  {
    id: "hanzipan",
    categories: ["games", "study", "wild"],
    goodForClass: ["polyglot", "learner"],
    nameKey: "experiences.hanzipan.name",
    blurbKey: "experiences.hanzipan.blurb",
    order: 7,
    // Mandarin/Cantonese character studio — only relevant if the user has a
    // Chinese language; otherwise it must NOT top the list (e.g. English learner).
    languages: ["zh-Hans", "zh-Hant", "yue-Hant-HK"],
  },
  {
    id: "phrase_main",
    categories: ["study", "speak"],
    goodForClass: ["learner", "polyglot"],
    nameKey: "experiences.phrase_main.name",
    blurbKey: "experiences.phrase_main.blurb",
    order: 8,
  },
  {
    // On-device multilingual LLM tutor (Plus). Strong fit for learners/polyglots
    // who want to converse and study; language-agnostic (manages its own langs).
    id: "tutomaton",
    categories: ["speak", "study"],
    goodForClass: ["learner", "polyglot"],
    nameKey: "experiences.tutomaton.name",
    blurbKey: "experiences.tutomaton.blurb",
    order: 9,
  },
]

export const EXPERIENCE_BY_ID: Record<string, ExperienceMeta> = Object.fromEntries(
  EXPERIENCES.map((e) => [e.id, e]),
)

const VALID_CATEGORIES = new Set<string>(["read", "audio", "games", "speak", "study", "wild"])

/** A minimal catalog shape this resolver reads (so registry has no hard dep on
 *  the full CatalogGame type). All recommendation fields are optional. */
export type CatalogExperienceFields = {
  id: string
  categories?: string[]
  goodForClass?: string[]
  recommendOrder?: number
  kidFriendly?: boolean
  languages?: string[]
}

/** Base language (drop region/script): "zh-Hans" → "zh", "en-GB" → "en". */
function baseLang(tag: string): string {
  return (tag.split("-")[0] || tag).toLowerCase()
}

/**
 * Resolve the effective recommendation metadata for an experience —
 * CATALOG-FIRST (so new packs self-configure OTA), falling back to the local
 * registry for built-ins (phrase_main) and catalogs that don't carry the
 * fields yet. `order` defaults large so unknown packs sort after curated ones.
 */
export function resolveExperienceMeta(
  id: string,
  catalog?: CatalogExperienceFields | null,
): ExperienceMeta {
  const fb = EXPERIENCE_BY_ID[id]
  const cats = catalog?.categories?.filter((c) => VALID_CATEGORIES.has(c)) as
    | ExperienceCategory[]
    | undefined
  return {
    id,
    categories: cats ?? fb?.categories ?? [],
    goodForClass: (catalog?.goodForClass as UserClass[] | undefined) ?? fb?.goodForClass ?? [],
    nameKey: fb?.nameKey ?? `experiences.${id}.name`,
    blurbKey: fb?.blurbKey ?? `experiences.${id}.blurb`,
    order: catalog?.recommendOrder ?? fb?.order ?? 50,
    kidFriendly: catalog?.kidFriendly ?? fb?.kidFriendly,
    languages: catalog?.languages ?? fb?.languages,
  }
}

export type RankOpts = {
  interests: string[]
  userClass: UserClass | null
  ageBand: AgeBand | null
  /** Per-experience rating signal (+1 liked, −1 dismissed) from packRating. */
  ratings?: Record<string, number>
  /** The user's languages (primary + targets). Used to gate language-specific
   *  experiences (e.g. Hanzipan) so they don't surface to the wrong learner. */
  userLanguages?: string[]
}

/** Per-matched-interest weight — the dominant signal. */
const INTEREST_WEIGHT = 3
/** Bonus when the experience is a declared good fit for the user's class. */
const CLASS_WEIGHT = 2
/** Bonus for kid-friendly experiences on the child journey. */
const KID_WEIGHT = 2
/** Strong pull from explicit like/dismiss so ratings dominate the cycle. */
const RATING_WEIGHT = 5
/** Heavy penalty for a language-specific experience the user can't use, so it
 *  sinks below everything else (but isn't removed entirely). */
const LANG_MISMATCH_PENALTY = 100

/**
 * Score one experience for a user. Higher = better. Pure + deterministic:
 *   interests matched × 3  +  class-fit × 2  +  kid-fit × 2  +  order tiebreak.
 * With no interest signal (skipped), scores fall back to class-fit + order, so
 * the result is still sensible (and never makes Phrase Flip the default star).
 */
export function scoreExperience(meta: ExperienceMeta, opts: RankOpts): number {
  const interests = new Set(opts.interests)
  let score = 0
  for (const c of meta.categories) if (interests.has(c)) score += INTEREST_WEIGHT
  if (opts.userClass && meta.goodForClass.includes(opts.userClass)) score += CLASS_WEIGHT
  if (opts.ageBand && opts.ageBand !== "adult" && meta.kidFriendly) score += KID_WEIGHT
  score += (opts.ratings?.[meta.id] ?? 0) * RATING_WEIGHT
  // Language gate: a Chinese-only pack (Hanzipan) sinks for an English learner.
  if (meta.languages?.length) {
    const userBases = new Set((opts.userLanguages ?? []).map(baseLang))
    const relevant = meta.languages.some((l) => userBases.has(baseLang(l)))
    if (!relevant) score -= LANG_MISMATCH_PENALTY
  }
  // Stable cold-start tiebreak (small, never outweighs a real signal).
  score += (100 - meta.order) * 0.01
  return score
}

/**
 * Rank experiences best-first for this user. Pure, network-free. `candidates`
 * defaults to the built-in registry, but the Home passes catalog-derived metas
 * so newly published packs rank without an app release.
 */
export function rankExperiences(
  opts: RankOpts,
  candidates: ExperienceMeta[] = EXPERIENCES,
): ExperienceMeta[] {
  return [...candidates]
    .map((meta) => ({ meta, score: scoreExperience(meta, opts) }))
    .sort((a, b) => b.score - a.score || a.meta.order - b.meta.order)
    .map((x) => x.meta)
}
