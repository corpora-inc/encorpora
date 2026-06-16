// src/onboarding/resolveLanding.ts
//
// The DETERMINISTIC landing call. The final onboarding question ("Where should
// we begin?") maps directly to where we drop the user — clearer than inferring
// from the multi-select interests (those still feed Home's "For you" list).
//
// Routes (see the route audit in the plan):
//   read       → Earthgate Reader (→ Stargate Reader → Phrase Flip)
//   study      → Phrase Flip  — UNLESS the target is Chinese → Hanzipan (a STUDY
//                experience, character/handwriting drill)
//   playMusic  → beatlounge
//   playGames  → Juice Squeeze (→ Hover Runner → Phrase Flip fallback)
//   surprise   → a (lightly) random pick across the launchable experiences —
//                surfaces Corpán's breadth on the way in.
//
// "Launchable" for a content game pack = present in the runtime catalog (so we
// can install it during the transition) or already installed. Anything we can't
// reach falls back to Phrase Flip, which is app-native and always ready — so we
// NEVER route into a dead end. Pure + deterministic (RNG injected for tests).

import type { LandingIntent } from "@/store/landing"
import { PHRASE_PACK_ID } from "./bestFit"

export type WhatToStart = "read" | "study" | "playMusic" | "playGames" | "surprise"

/** Reader pack ids (share the reader app shell). */
export const READER_PACK_IDS = ["earthgate_reader", "stargate_reader"]

/** Default book a brand-new reader user is seeded into (the instant-wow): the
 *  Tropical Rainforest from the Biomes series — preview narrations exist in 25+
 *  languages, so a new user's whole stack can be auto-downloaded for free. The
 *  reader installs the preview narrations on first launch (see appShell
 *  `seedFirstBook`); the host passes this id as the launch `seedBookId`. */
export const DEFAULT_READER_SEED_BOOK = "book_biomes_tropical_rainforest"

export function isReaderPack(id: string): boolean {
  return READER_PACK_IDS.includes(id)
}

/** Map the single-choice answer to an interest tag (seeds Home recs when the
 *  multi-select was skipped). "surprise" carries no interest signal. */
export const WHAT_TO_START_INTEREST: Record<WhatToStart, string | null> = {
  read: "read",
  study: "study",
  playMusic: "wild",
  playGames: "games",
  surprise: null,
}

export type ResolveLandingInput = {
  choice: WhatToStart
  /** User's languages (primary + targets). Gates Chinese → Hanzipan. */
  languages: string[]
  /** Game-pack ids present in the runtime catalog (installable during the
   *  transition). */
  catalogIds: string[]
  /** Game-pack ids already installed on disk. */
  installedIds: string[]
  /** Injected RNG for "surprise" (default Math.random) — keeps this pure/testable. */
  rng?: () => number
}

export type LandingResolution = {
  /** The landing intent to set (always carries `razzle: true`). */
  intent: LandingIntent
  /** Experience id to FEATURE in the razzle collage (the card that centers +
   *  washes) — the resolved pack id, or `phrase_main`. */
  chosenId: string
  /** Content game pack to quiet-install during the transition, or `null` when
   *  the landing needs no install (native phrase / already installed). */
  installPackId: string | null
}

const CHINESE_BASES = new Set(["zh", "yue"])

/**
 * GA content packs we can deterministically route a new user into. Static on
 * PURPOSE: the runtime game catalog fetches asynchronously, so at onboarding-
 * commit it may not be loaded yet — gating the routing DECISION on the live
 * catalog snapshot made "read" fall back to Phrase Flip on a cold first run.
 * These ids are stable + always published, so we route to them regardless and
 * let the install (which awaits the catalog) + the reveal-time fallback handle
 * the rare genuinely-unavailable case. corpan_city/teletron are intentionally
 * excluded (preview).
 */
const LAUNCHABLE_CONTENT_PACKS = new Set<string>([
  "earthgate_reader",
  "stargate_reader",
  "beatlounge",
  "juice_squeeze",
  "hover_runner",
  "pronunciation_coach",
  "hanzipan",
])

function baseLang(tag: string): string {
  return (tag.split("-")[0] || tag).toLowerCase()
}

function hasChinese(languages: string[]): boolean {
  return languages.some((l) => CHINESE_BASES.has(baseLang(l)))
}

function phraseResolution(): LandingResolution {
  return {
    intent: { kind: "experience", packId: PHRASE_PACK_ID, razzle: true },
    chosenId: PHRASE_PACK_ID,
    installPackId: null,
  }
}

function packResolution(packId: string, installedIds: string[]): LandingResolution {
  return {
    intent: { kind: "experience", packId, razzle: true },
    chosenId: packId,
    installPackId: installedIds.includes(packId) ? null : packId,
  }
}

/**
 * Resolve the deterministic landing for the chosen "start with" answer. Pure;
 * always returns a reachable landing (falls back to Phrase Flip).
 */
export function resolveLanding(input: ResolveLandingInput): LandingResolution {
  const { choice, languages, catalogIds, installedIds } = input
  const rng = input.rng ?? Math.random
  // A pack is routable if it's a known GA content pack OR present in the live
  // catalog OR already installed. The static set is what makes routing immune to
  // the async catalog load (the bug behind "read → Phrase Flip" on a cold run).
  const canPack = (id: string) =>
    LAUNCHABLE_CONTENT_PACKS.has(id) || catalogIds.includes(id) || installedIds.includes(id)
  const chinese = hasChinese(languages)

  switch (choice) {
    case "read":
      // Land in a reader (Earthgate, then Stargate); fall back to Phrase Flip.
      if (canPack("earthgate_reader")) return packResolution("earthgate_reader", installedIds)
      if (canPack("stargate_reader")) return packResolution("stargate_reader", installedIds)
      return phraseResolution()

    case "study":
      // Chinese learners get the character/handwriting studio (a STUDY pack);
      // everyone else gets the universal Phrase Flip.
      if (chinese && canPack("hanzipan")) return packResolution("hanzipan", installedIds)
      return phraseResolution()

    case "playMusic":
      return canPack("beatlounge")
        ? packResolution("beatlounge", installedIds)
        : phraseResolution()

    case "playGames":
      if (canPack("juice_squeeze")) return packResolution("juice_squeeze", installedIds)
      if (canPack("hover_runner")) return packResolution("hover_runner", installedIds)
      return phraseResolution()

    case "surprise": {
      // A (lightly) random landing across what's actually launchable — shows off
      // the breadth on the way in. Pool is curated to reachable, non-preview
      // experiences; Phrase Flip is always in it.
      const packPool = [
        "earthgate_reader",
        "stargate_reader",
        "beatlounge",
        "juice_squeeze",
        "hover_runner",
        "pronunciation_coach",
      ].filter(canPack)
      if (chinese && canPack("hanzipan")) packPool.push("hanzipan")
      // Kinds: "phrase" or a specific pack id.
      const pool: string[] = ["phrase", ...packPool]
      const pick = pool[Math.floor(Math.min(0.999999, Math.max(0, rng())) * pool.length)] ?? "phrase"
      if (pick === "phrase") return phraseResolution()
      return packResolution(pick, installedIds)
    }

    default:
      return phraseResolution()
  }
}
