import { z } from "zod"

/**
 * The registry of modular microgame "challenge tools". NPCs (via parsed
 * tool-calls) and player duels (via InteractionRequest) invoke these by id.
 * Kept in a leaf module so both `economy` (XpEvent) and `challenge` can import
 * it without a cycle.
 */
export const ChallengeToolId = z.enum([
  // ---- original ids (kept for back-compat with NPC prompt-programs) ----
  "pronunciation-duel",
  "speed-drill",
  "listen-choose",
  "translate-fast",
  "fill-blank",
  "repeat-after",
  // ---- the lightweight micro-challenge library (§6) ----
  "word-scramble", // unscramble the letters of a target word
  "read-aloud", // STT: read the phrase aloud, scored
  "listen-choose-pic", // hear it, pick the matching word/translation
  "picture-match", // match emoji/word ↔ translation pairs
  "fast-translate", // tap the correct translation, against the clock
  "fill-the-blank", // choose the word that completes the sentence
  "build-sentence", // order shuffled words into the sentence (Juice-style)
  "number-drill", // price/number listening + tap drill
  "odd-one-out", // pick the word that doesn't belong to the set
  "memory-pairs", // flip-and-match target↔native concentration grid
  "say-it-back", // STT: hear it, then say it back
  "dialogue-fill", // fill the missing line of a short dialogue
  "category-sort", // sort words into two labelled buckets
  "spot-typo", // pick the misspelled word
  "conjugation-tap", // tap the right verb form for the pronoun
  "rhyme-match", // match words that share an ending sound
  "countdown-recall", // memorise a list, then recall before the timer
  "true-false", // true/false: does the translation match?
  "word-search", // find target words hidden in a letter grid (lite)
  "tap-translation", // tap every tile that means the given word
])
export type ChallengeToolId = z.infer<typeof ChallengeToolId>
