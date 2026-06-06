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
import { pickNextQuests, hashSeed } from "./questVariety"
// ── Legacy ES-pair quests (kept for back-compat: special.json + item rules + QA
//    harnesses reference these ids; the entry quest stays `es-cafe-travel`). ──────
import cafeJson from "../../content/quests/es-cafe.json"
import marketJson from "../../content/quests/es-market.json"
import directionsJson from "../../content/quests/es-directions.json"
import guadalajaraJson from "../../content/quests/es-guadalajara.json"
// ── Pair-agnostic, keyed quest catalog (QUESTS-AT-SCALE). Each declares a domain
//    + CEFR levels (the phrase resolver consumes them) and NO hardcoded entryIds,
//    so target vocab comes from the corpus for whatever language pair is live. ────
import plazaGreetingsJson from "../../content/quests/plaza-greetings.json"
import plazaCafeOrderJson from "../../content/quests/plaza-cafe-order.json"
import plazaBusinessJson from "../../content/quests/plaza-business.json"
import marketNumbersJson from "../../content/quests/market-numbers.json"
import marketGroceriesJson from "../../content/quests/market-groceries.json"
import fountainDirectionsJson from "../../content/quests/fountain-directions.json"
import fountainMeetupJson from "../../content/quests/fountain-meetup.json"
import harborFerryRideJson from "../../content/quests/harbor-ferry-ride.json"
import harborFishmongerJson from "../../content/quests/harbor-fishmonger.json"
import harborRouteMasterJson from "../../content/quests/harbor-route-master.json"
import stationDeparturesJson from "../../content/quests/station-departures.json"
import civicCityHallJson from "../../content/quests/civic-cityhall.json"
import civicClinicJson from "../../content/quests/civic-clinic.json"
import bridgeCrossingJson from "../../content/quests/bridge-crossing.json"

const LOG = "[wp/questCatalog]"

/**
 * The raw authored quest JSONs, in the canonical authoring order. The legacy ES
 * quests lead (so `entryQuestId` = `es-cafe-travel` and the QA harnesses that name
 * the legacy ids keep working); the pair-agnostic catalog follows, giving the city
 * a broad, branching journey across every scene + domain.
 */
const RAW_QUESTS: unknown[] = [
  // legacy ES set (entry quest + the inventory-gated Guadalajara chain)
  cafeJson,
  marketJson,
  directionsJson,
  guadalajaraJson,
  // pair-agnostic catalog — plaza
  plazaGreetingsJson,
  plazaCafeOrderJson,
  plazaBusinessJson,
  // market
  marketNumbersJson,
  marketGroceriesJson,
  // fountain
  fountainDirectionsJson,
  fountainMeetupJson,
  // harbor
  harborFerryRideJson,
  harborFishmongerJson,
  harborRouteMasterJson,
  // station
  stationDeparturesJson,
  // civic (City Hall + clinic, stationed at the hospital anchor)
  civicCityHallJson,
  civicClinicJson,
  // bridge (a traverse journey)
  bridgeCrossingJson,
]

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

/** Replay-variety inputs for the next-quest picker (all optional). */
export interface NextQuestVariety {
  /**
   * Recently-played quest ids (most-recent-first). The catalog BACKFILL is biased
   * away from these so a replay rarely re-offers the same cards; the authored
   * `nextQuestIds` fork is NOT suppressed (the designer's branch always shows).
   */
  recent?: readonly string[]
  /**
   * A varying seed (e.g. a per-pair play counter) so the BACKFILL rotates between
   * replays. Omitted ⇒ a stable seed derived from the quest id (deterministic, but
   * then identical across replays — pass a counter for true rotation).
   */
  seed?: number
}

/**
 * The 2–3 follow-up quests offered after completing `questId`. The authored
 * `nextQuestIds` fork leads; the rest of the catalog BACKFILLS — shuffled by the
 * variety `seed`, with recently-played quests pushed to the back — so the picker is
 * never empty AND replays surface fresh cards (the variety engine,
 * `questVariety.pickNextQuests`). Back-compat: called with no `variety` it behaves
 * exactly as before (authored fork, then catalog order) — existing callers + tests
 * are unchanged.
 */
export function nextQuests(questId: string, variety?: NextQuestVariety): Quest[] {
  const quest = BY_ID.get(questId)
  const preferredIds = quest?.nextQuestIds ?? []
  for (const id of preferredIds) {
    if (!BY_ID.has(id)) console.warn(`${LOG} quest "${questId}" → unknown nextQuestId "${id}" (skipped)`)
  }
  const ids = pickNextQuests({
    completedId: questId,
    preferredIds,
    allIds: QUESTS.map((q) => q.id),
    recent: variety?.recent,
    // NO CONSECUTIVE-VENUE REPEAT: don't open the next quest at the SAME place the
    // player just finished (the "same special three quests running" bug). Compare a
    // candidate's OPENING anchor against the completed quest's CLOSING anchor.
    anchorOf: questOpeningAnchor,
    completedVenue: questClosingAnchor(questId),
    // No seed ⇒ derive a stable one from the quest id (deterministic; matches the
    // legacy "catalog order" feel for callers that don't rotate).
    seed: variety?.seed ?? hashSeed(questId),
    max: MAX_NEXT,
  })
  return ids.map((id) => BY_ID.get(id)).filter((q): q is Quest => Boolean(q))
}

/** The first step of a quest (where the picker says "go here / do this"), or null. */
export function firstStep(quest: Quest): Quest["steps"][number] | null {
  return quest.steps[0] ?? null
}

/**
 * The venue a quest OPENS at — its first step's anchor (where the next-quest fork
 * sends the player). Undefined when the quest/step carries no anchor. Used by the
 * no-consecutive-venue rule (so the picker doesn't send you back to the same place).
 */
export function questOpeningAnchor(questId: string): string | undefined {
  return BY_ID.get(questId)?.steps[0]?.anchorId
}

/**
 * The venue a quest ENDS at — its last step's anchor (where the player just stood
 * when they completed it). The no-consecutive-venue rule compares THIS against the
 * next candidates' opening anchors. Undefined when no last step carries an anchor.
 */
export function questClosingAnchor(questId: string): string | undefined {
  const steps = BY_ID.get(questId)?.steps ?? []
  for (let i = steps.length - 1; i >= 0; i--) {
    if (steps[i].anchorId) return steps[i].anchorId
  }
  return undefined
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
