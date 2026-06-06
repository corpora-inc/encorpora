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
 * Each persona archetype's DOMAIN AFFINITY — the real corpus domains its role
 * naturally talks about. A baker talks food (→ everyday + numbers/prices); a
 * guide/courier/commuter/cyclist talks travel; an office-worker talks business/
 * civic; a student/busker/elder talks education/culture/social; a cleaner talks
 * everyday/civic; a kid talks everyday/education. Ordered by relevance (first is
 * the strongest pull). Keyed by the persona `archetype` id from `personaGen.ts`.
 */
const ARCHETYPE_DOMAINS: Record<string, readonly CorpusDomain[]> = {
  // MODERN Corpan City wandering roles (#107). Keyed by the persona `archetype`
  // id from personaGen.ts — these MUST stay in lockstep with that catalogue (a
  // test asserts every PERSONA_ARCHETYPES entry has a real-domain row here).
  baker: ["everyday", "numbers", "social"],
  vendor: ["everyday", "numbers", "social"],
  shopkeeper: ["everyday", "numbers", "business"],
  "dog-walker": ["everyday", "environment", "social"],
  student: ["education", "culture", "social"],
  guide: ["travel", "culture", "everyday"],
  courier: ["travel", "numbers", "business"],
  cook: ["everyday", "numbers", "social"],
  busker: ["culture", "social", "everyday"],
  elder: ["social", "culture", "everyday"],
  child: ["everyday", "education", "social"],
  "cart-vendor": ["everyday", "numbers", "social"],
  "office-worker": ["business", "civic", "education"],
  barber: ["everyday", "social", "culture"],
  florist: ["everyday", "environment", "culture"],
  commuter: ["travel", "numbers", "everyday"],
  cyclist: ["travel", "everyday", "numbers"],
  cleaner: ["everyday", "civic", "housing"],
  fixer: ["travel", "civic", "business"],
  // VENUE-FIT roles (#107): the objective NPC at a clinic/café/market/station/
  // exchange. Domains match the venue so its minigame vocab is on-topic.
  doctor: ["health", "everyday", "social"],
  pharmacist: ["health", "numbers", "everyday"],
  barista: ["everyday", "social", "numbers"],
  grocer: ["everyday", "numbers", "social"],
  conductor: ["travel", "numbers", "everyday"],
  banker: ["business", "numbers", "civic"],
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
 * LANGUAGES: the quest's `contentSelector.languageCodes` (the TARGET code(s)) PLUS
 * the learner's NATIVE code when a distinct `pair` is given. This list is NOT just
 * an entry gate — the bundled corpus reuses it as the TRANSLATION WHITELIST
 * (`fetch_entry_with_translations` only returns translation rows whose language is
 * in the list). So a target-ONLY list makes the corpus drop the native (e.g.
 * English) row, and the challenge's native gloss then collapses to the target →
 * the ES→ES "tap the one that means «el pan»" tautology (#81). Threading the
 * native code in keeps BOTH sides available so cross-language games stay
 * two-language. SINGLE-LANGUAGE SAFE: when `native === target` (a one-language
 * immersion stack) there is no separate native to add, so the list stays the single
 * target code — never `["es","es"]`.
 */
export function resolveMinigameContent(
  npc: NpcRole | null | undefined,
  quest: Quest,
  step: QuestStep | null,
  /**
   * The learner's (target, native) pair. Optional for back-compat; when given and
   * `native !== target`, the native code is added to `filter.languageCodes` so the
   * corpus returns the native translation alongside the target (the #81 fix).
   */
  pair?: { target: string; native: string },
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

  // The corpus reuses `languageCodes` as the translation whitelist, so it must carry
  // BOTH the learner's TARGET and NATIVE — otherwise a row is dropped and the
  // challenge collapses (the #81 ES→ES tautology when native is missing; an EMPTY
  // 0-round flash-fail when the TARGET is missing). The pair-agnostic quests (#75)
  // pin NO `languageCodes`, so we CANNOT rely on the quest to supply the target — we
  // seed the whitelist from the PAIR itself (target first, then a distinct native),
  // then union any quest-pinned codes. De-duped + order-preserved. A single-language
  // pair (native === target) yields the one code, never `["es","es"]`, and never an
  // EMPTY filter (which would let the corpus return rows missing that language).
  const langCodes: string[] = []
  const seenLang = new Set<string>()
  const pairCodes = pair ? (pair.native === pair.target ? [pair.target] : [pair.target, pair.native]) : []
  for (const code of [...pairCodes, ...stepContent.languageCodes]) {
    if (!seenLang.has(code)) {
      seenLang.add(code)
      langCodes.push(code)
    }
  }
  if (langCodes.length) filter.languageCodes = langCodes

  return {
    coreEntryIds: stepContent.entryIds,
    questDomain: stepContent.domain,
    filter,
  }
}

/** Exposed for tests/tooling: the full archetype→domain affinity table. */
export const ARCHETYPE_DOMAIN_AFFINITY = ARCHETYPE_DOMAINS
