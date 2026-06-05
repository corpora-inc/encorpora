/**
 * minigameContent — the CONTENT-RESOLUTION layer that makes every minigame draw
 * RICH, VARIED, RELEVANT phrases from the full ~10k-per-language corpus instead
 * of a stale loop of six fixed phrases.
 *
 * THE PROBLEM this fixes: the challenge launch used to pass ONLY the quest step's
 * pinned `entryIds` (a tiny fixed set) or, lacking those, a fully RANDOM draw —
 * so a café host and a dock keeper drilled the same handful of generic phrases
 * and the corpus's richness was wasted. The binding felt disconnected + repetitive.
 *
 * THE FIX — blend THREE relevance axes into one resolved content set:
 *   1. RELEVANT TO THE NPC   — each persona archetype (baker→food, boatman→travel,
 *      scribe→business…) maps to a set of REAL corpus domain codes (the 13 in
 *      `dja/cor/fixtures/domains.json`: everyday/travel/business/health/education/
 *      social/housing/environment/emergency/civic/numbers/technology/culture).
 *   2. RELEVANT TO THE QUEST — the quest's `promptProgram.contentSelector`
 *      (domains/levels/languageCodes) + the step's authored `entryIds`.
 *   3. SCALED TO THE PLAYER  — the quest's CEFR `levels` (the author scales these
 *      per quest; a beginner quest pins A1/A2). This is the level signal the data
 *      already carries; we thread it as the difficulty filter.
 *
 * VARIETY: the step's authored `entryIds` stay pinned as a small COHESIVE CORE
 * (so the game still feels on-topic), but the rest of each round is filled from a
 * THEMED + LEVEL-SCALED random draw (`ChallengeRuntimeHost.getRandomEntries({
 * domains, levels, ... })`). Across repeat plays that draw pulls DIFFERENT phrases
 * from the matching pool — bottomless variety, never the same six.
 *
 * This module is PURE + dependency-light: it decides WHAT to ask for (ids + a
 * filter). The actual corpus fetch is the challenge host's job. The challenge tools
 * read the filter off `ChallengeSpec.params.contentFilter` and route their random
 * fill through it (see `tools/_shared.ts :: randomEntries`).
 */

import type { Quest, QuestStep, NpcRole } from "@world-plaza/contracts"
import type { EntryFilter } from "../challenges/host"
import { resolveStepContent } from "./questContent"

/* ----------------------------------------------- archetype → domain map ----- */

/**
 * The REAL corpus domain codes (mirrors `dja/cor/fixtures/domains.json`). The quest
 * authoring + persona topics use friendlier words ("food", "market", "directions");
 * those are NOT corpus domains, so we map the NPC's TRADE onto these real codes —
 * the only ones the bundled-corpus filter actually matches.
 */
export type CorpusDomain =
  | "everyday"
  | "travel"
  | "business"
  | "health"
  | "education"
  | "social"
  | "housing"
  | "environment"
  | "emergency"
  | "civic"
  | "numbers"
  | "technology"
  | "culture"

const ALL_DOMAINS: ReadonlySet<string> = new Set<CorpusDomain>([
  "everyday",
  "travel",
  "business",
  "health",
  "education",
  "social",
  "housing",
  "environment",
  "emergency",
  "civic",
  "numbers",
  "technology",
  "culture",
])

/**
 * Each persona archetype's DOMAIN AFFINITY — the real corpus domains its trade
 * naturally talks about. A baker talks food/market (→ everyday + numbers/prices);
 * a boatman/sailor/dockhand talks travel; a scribe talks business/civic; a friar/
 * elder talks social/culture; a herbalist talks health; a child talks everyday/
 * education. Ordered by relevance (the first is the strongest pull). Keyed by the
 * persona `archetype` id from `personaGen.ts`.
 */
const ARCHETYPE_DOMAINS: Record<string, readonly CorpusDomain[]> = {
  baker: ["everyday", "numbers", "social"],
  fishmonger: ["everyday", "numbers", "environment"],
  weaver: ["everyday", "culture", "business"],
  herbalist: ["health", "environment", "everyday"],
  friar: ["social", "culture", "education"],
  sailor: ["travel", "environment", "everyday"],
  dockhand: ["travel", "numbers", "business"],
  merchant: ["business", "numbers", "travel"],
  musician: ["culture", "social", "everyday"],
  elder: ["social", "culture", "everyday"],
  child: ["everyday", "education", "social"],
  "water-seller": ["everyday", "numbers", "health"],
  scribe: ["business", "civic", "education"],
  lamplighter: ["everyday", "housing", "environment"],
  "flower-girl": ["everyday", "environment", "culture"],
  smuggler: ["travel", "civic", "business"],
}

/**
 * The corpus domains an NPC's TRADE talks about. Reads the persona's `archetype`
 * (present on every generated crowd/stroller persona) and maps it onto real
 * corpus domain codes. A hand-authored special role without an archetype, or an
 * unknown archetype, yields `[]` (the quest's own domains then carry the theme).
 */
export function npcDomains(npc: NpcRole | null | undefined): CorpusDomain[] {
  if (!npc) return []
  // The persona is structurally a `GeneratedPersona` (superset of NpcRole) — read
  // its archetype id defensively (absent on a bare authored role).
  const archetype = (npc as { archetype?: unknown }).archetype
  if (typeof archetype !== "string") return []
  return [...(ARCHETYPE_DOMAINS[archetype] ?? [])]
}

/* ------------------------------------------------- blended content shape ---- */

/**
 * The resolved content for ONE minigame launch: the cohesive CORE (the step's
 * authored ids) plus the THEMED + LEVEL-SCALED FILTER used to draw the varied
 * remainder. game.ts puts `coreEntryIds` into `ChallengeContext.entryIds` (when
 * the tool wants pinned ids) and the `filter` into `ChallengeContext` →
 * `ChallengeSpec.params.contentFilter`, which the tools' random fill honors.
 */
export interface MinigameContent {
  /** The quest step's authored ids — a small on-topic CORE (may be empty). */
  coreEntryIds: number[]
  /** The domain to label the challenge with (the quest's domain). */
  questDomain: string
  /** The THEMED + LEVEL-SCALED filter for the varied random draw. */
  filter: EntryFilter
}

/**
 * Blend an NPC's domain affinity with the quest's theme + the step's pinned vocab,
 * scaled to the player's level, into one resolved content set.
 *
 * BLEND RULE for domains (NPC × quest):
 *   - Start from the quest's `contentSelector.domains` ∩ real corpus domains (the
 *     quest's THEME — strongest constraint).
 *   - UNION the NPC's trade domains so a café host's variety leans food/everyday
 *     even within a travel quest — relevance to WHO you're talking to.
 *   - If the quest pinned no usable domains, the NPC's domains carry the theme.
 *   - If NEITHER yields a real corpus domain, leave domains empty → an unfiltered
 *     (but still level-scaled) draw, so content never dead-ends.
 *
 * LEVELS (scaled to the player): the quest's `contentSelector.levels` (the author
 * scales these per quest; a beginner quest pins A1/A2). Passed straight through as
 * the difficulty filter.
 *
 * LANGUAGES: the quest's `contentSelector.languageCodes` (constrains to entries
 * that have the target translation). SINGLE-LANGUAGE SAFE — this is the TARGET
 * code(s); it never gates on a SECOND/native language, so a one-language immersion
 * stack resolves content exactly the same way.
 */
export function resolveMinigameContent(
  npc: NpcRole | null | undefined,
  quest: Quest,
  step: QuestStep | null,
): MinigameContent {
  const stepContent = resolveStepContent(quest, step)

  // Quest theme domains, kept only if they're REAL corpus codes (quest files may
  // carry legacy/friendly domains like "food"/"market" that the corpus can't match).
  const questDomains = stepContent.domains
    .map((d) => d.toLowerCase())
    .filter((d) => ALL_DOMAINS.has(d))

  const trade = npcDomains(npc)

  // Union quest-theme ∩ corpus  with  NPC trade ∩ corpus. Quest theme first
  // (strongest pull), then the NPC's trade for relevant variety. De-duped, order
  // preserved. When the quest pinned no usable domain, the NPC's domains lead.
  const blended: string[] = []
  const seen = new Set<string>()
  for (const d of [...questDomains, ...trade]) {
    if (!seen.has(d)) {
      seen.add(d)
      blended.push(d)
    }
  }

  const filter: EntryFilter = {}
  if (blended.length) filter.domains = blended
  if (stepContent.levels.length) filter.levels = stepContent.levels
  if (stepContent.languageCodes.length) filter.languageCodes = stepContent.languageCodes

  return {
    coreEntryIds: stepContent.entryIds,
    questDomain: stepContent.domain,
    filter,
  }
}

/** Exposed for tests/tooling: the full archetype→domain affinity table. */
export const ARCHETYPE_DOMAIN_AFFINITY = ARCHETYPE_DOMAINS
