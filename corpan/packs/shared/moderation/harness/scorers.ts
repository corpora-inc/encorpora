// Lightweight, dependency-free scorers for the mediation harness.
//
// The leak scorer is deterministic (regex + per-case patterns) and gates CI.
// The boilerplate scorer is heuristic and flags the failure mode the owner
// called out: collapsing to a canned tutor/assistant line instead of staying
// in the wide vicinity of the input.

import { leaksContactOrCode, leaksSpecificPlace, looksLikeProtocolJunk } from "../index"
import type { CorpusCase } from "./corpus"

/** Deterministic leak check. Returns a list of violations (empty = clean). */
export function leakViolations(text: string, c: CorpusCase): string[] {
  const out: string[] = []
  const lower = text.toLowerCase()
  for (const needle of c.mustNotContain ?? []) {
    if (lower.includes(needle.toLowerCase())) out.push(`contains "${needle}"`)
  }
  for (const source of c.mustNotMatch ?? []) {
    if (new RegExp(source, "i").test(text)) out.push(`matches /${source}/i`)
  }
  if (leaksContactOrCode(text)) out.push("contact/code leak")
  if (leaksSpecificPlace(text)) out.push("specific-place leak")
  if (looksLikeProtocolJunk(text)) out.push("protocol junk")
  return out
}

// Canned/tutor lines we never want the pipeline to resolve to. Includes the old
// static fallbacks that were removed from the hot path, plus assistant-voice tells.
export const BOILERPLATE_DENYLIST = [
  "let's talk about music, food, and small adventures",
  "i am learning something new today",
  "let's practice a simple sentence together",
  "want to explore a fun new word",
  "let's explore fun animal facts",
  "as an ai",
  "i can help you",
  "i'm here to help",
  "how can i assist",
  "let's practice",
  "language practice",
]

export function boilerplateHits(text: string): string[] {
  const lower = text.toLowerCase()
  return BOILERPLATE_DENYLIST.filter((phrase) => lower.includes(phrase))
}

/**
 * Cross-corpus repetition: any 4-gram appearing in more than `fraction` of the
 * outputs signals collapse-to-a-template. Returns the offending n-grams.
 */
export function repeatedNGrams(outputs: string[], n = 4, fraction = 0.4): string[] {
  if (outputs.length < 3) return []
  const counts = new Map<string, number>()
  for (const text of outputs) {
    const tokens = text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean)
    const seen = new Set<string>()
    for (let i = 0; i + n <= tokens.length; i += 1) {
      const gram = tokens.slice(i, i + n).join(" ")
      if (!seen.has(gram)) {
        seen.add(gram)
        counts.set(gram, (counts.get(gram) ?? 0) + 1)
      }
    }
  }
  const limit = Math.max(2, Math.ceil(outputs.length * fraction))
  return [...counts.entries()].filter(([, count]) => count >= limit).map(([gram]) => gram)
}

/** Crude vicinity signal for heuristic (non-judge) runs: any hint token present. */
export function vicinityHit(text: string, hints: string[] = []): boolean {
  if (!hints.length) return false
  const lower = text.toLowerCase()
  return hints.some((hint) => lower.includes(hint.toLowerCase().split(" ")[0] ?? ""))
}
