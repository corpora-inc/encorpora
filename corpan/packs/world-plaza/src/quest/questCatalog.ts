/**
 * questCatalog — the data-driven quest GRAPH the completion interlude reads.
 *
 * Every authored quest in `content/quests/*.json` is statically imported, parsed
 * against the frozen `Quest` contract (fail-loud, noisy-skip a bad one), and
 * exposed by id. The completion interlude's next-quest picker reads `nextQuests`,
 * and the entry quest (`entryQuestId`) is what a brand-new player auto-starts.
 *
 * This is the minimal authoring change for the picker: a per-quest `nextQuestIds`
 * declares the 2–3 follow-ups; the catalog resolves them to live `Quest`s,
 * filtering unknown ids and capping at 3. When a quest declares no follow-ups (or
 * none resolve), `nextQuests` falls back to "every OTHER known quest" (capped) so
 * the picker is NEVER empty — the loop always offers somewhere to go next.
 *
 * Pure data + tiny helpers — no DOM, no host, no storage. The orchestrator owns
 * which quest is ACTIVE and persists that choice; this module just answers
 * "what quests exist, and what comes after X".
 */

import { Quest } from "@world-plaza/contracts"
import cafeJson from "../../content/quests/es-cafe.json"
import marketJson from "../../content/quests/es-market.json"
import directionsJson from "../../content/quests/es-directions.json"
import guadalajaraJson from "../../content/quests/es-guadalajara.json"

const LOG = "[wp/questCatalog]"

/** The raw authored quest JSONs, in the canonical authoring order. */
const RAW_QUESTS: unknown[] = [cafeJson, marketJson, directionsJson, guadalajaraJson]

/** Max follow-ups the picker shows (the design's 2–3-way picker). */
const MAX_NEXT = 3

/** Parse all authored quests once; a malformed one is noisy-skipped (never throws). */
function parseAll(): Quest[] {
  const out: Quest[] = []
  for (const raw of RAW_QUESTS) {
    const r = Quest.safeParse(raw)
    if (r.success) out.push(r.data)
    else console.error(`${LOG} skipping malformed quest:`, r.error?.issues ?? r.error)
  }
  return out
}

const QUESTS: Quest[] = parseAll()
const BY_ID = new Map<string, Quest>(QUESTS.map((q) => [q.id, q]))

/**
 * The quest a brand-new player auto-starts: the FIRST authored quest (the
 * dead-simple 1-step entry quest, `es-cafe-travel`). Kept as the head of the
 * authoring order so re-ordering the array re-points onboarding with no code
 * change.
 */
export const entryQuestId: string = QUESTS[0]?.id ?? "es-cafe-travel"

/** Every known quest (parse order). */
export function allQuests(): Quest[] {
  return QUESTS.slice()
}

/** Look up a quest by id (undefined when unknown). */
export function getQuest(id: string): Quest | undefined {
  return BY_ID.get(id)
}

/**
 * The 2–3 follow-up quests offered after completing `questId`. Resolves the
 * quest's `nextQuestIds` to live quests (noisy-skipping unknown ids), capped at
 * {@link MAX_NEXT}. When the quest declares none, OR none resolve, falls back to
 * "every OTHER known quest" (capped) so the picker is never empty.
 */
export function nextQuests(questId: string): Quest[] {
  const quest = BY_ID.get(questId)
  const ids = quest?.nextQuestIds ?? []
  const resolved: Quest[] = []
  const seen = new Set<string>([questId])
  for (const id of ids) {
    if (resolved.length >= MAX_NEXT) break
    if (seen.has(id)) continue
    const q = BY_ID.get(id)
    if (!q) {
      console.warn(`${LOG} quest "${questId}" → unknown nextQuestId "${id}" (skipped)`)
      continue
    }
    seen.add(id)
    resolved.push(q)
  }
  if (resolved.length > 0) return resolved
  // Fallback: any other known quest, so the loop always continues.
  return QUESTS.filter((q) => q.id !== questId).slice(0, MAX_NEXT)
}

/** The first step of a quest (where the picker says "go here / do this"), or null. */
export function firstStep(quest: Quest): Quest["steps"][number] | null {
  return quest.steps[0] ?? null
}

/**
 * Every distinct step ANCHOR across the WHOLE catalog (#58). The orchestrator
 * stations a talkable objective NPC at each, so whichever quest the player
 * switches to, its objective always has a person under the beacon — the crowd is
 * built once but covers them all. Pure + deterministic (catalog order).
 */
export function objectiveAnchorIds(): string[] {
  const ids: string[] = []
  const seen = new Set<string>()
  for (const q of QUESTS) {
    for (const s of q.steps) {
      if (s.anchorId && !seen.has(s.anchorId)) {
        seen.add(s.anchorId)
        ids.push(s.anchorId)
      }
    }
  }
  return ids
}
