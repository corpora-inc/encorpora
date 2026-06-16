// src/onboarding/resolveLanding.ts
//
// The DETERMINISTIC landing call. The final onboarding question ("Where should
// we begin?") maps directly to where we drop the user — clearer than inferring
// from the multi-select interests (those still feed Home's "For you" list).
//
// Routes (see the route audit in the plan):
//   read       → Library (books live there; no game-pack install)
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
   *  washes). For a Library landing this is the sentinel `"library"`. */
  chosenId: string
  /** Content game pack to quiet-install during the transition, or `null` when
   *  the landing needs no install (native phrase / Library / already installed). */
  installPackId: string | null
}

/** Sentinel "experience" id for the read→Library landing's collage card. */
export const LIBRARY_CARD_ID = "library"

const CHINESE_BASES = new Set(["zh", "yue"])

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

function libraryResolution(): LandingResolution {
  return {
    intent: { kind: "home", tab: "library", razzle: true },
    chosenId: LIBRARY_CARD_ID,
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
  const available = new Set<string>([...catalogIds, ...installedIds])
  const canPack = (id: string) => available.has(id)
  const chinese = hasChinese(languages)

  switch (choice) {
    case "read":
      // Books live in the Library — land there (no game-pack install).
      return libraryResolution()

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
      // experiences; Phrase Flip + Library are always in it.
      const packPool = ["beatlounge", "juice_squeeze", "hover_runner", "pronunciation_coach"].filter(
        canPack,
      )
      if (chinese && canPack("hanzipan")) packPool.push("hanzipan")
      // Kinds: "phrase", "library", or a specific pack id.
      const pool: string[] = ["phrase", "library", ...packPool]
      const pick = pool[Math.floor(Math.min(0.999999, Math.max(0, rng())) * pool.length)] ?? "phrase"
      if (pick === "phrase") return phraseResolution()
      if (pick === "library") return libraryResolution()
      return packResolution(pick, installedIds)
    }

    default:
      return phraseResolution()
  }
}
