/**
 * specialNpc — the SpecialNpcResolver (COHESION M2 / Seam 5).
 *
 * THESIS (COHESION_ITERATION §3.3): you can walk up and talk to ANYONE in the
 * plaza — every crowd agent is a generic, fully-voiced persona. But the
 * clue→item→deliver→advance chain only flows through the NPCs the quest
 * *designates* at specific anchors. This resolver is the lookup that answers, for
 * a given anchor + active quest, "is the agent standing here a SPECIAL quest NPC,
 * and if so, what is its duty?" — so:
 *
 *   - the orchestrator (game.ts) MARKS held specials and passes the `questEngine`
 *     + `inventory` into their dialogue (activating the authored clues/FACTS path
 *     M1 wired in npcRuntime), and
 *   - delivery routes ONLY through the marked NPC at the step's anchor — the
 *     engine (`questEngine.advance`) is the referee, never the model.
 *
 * The data lives in `content/npc/special.json` (a list of `SpecialNpcDef` plus a
 * few additive, JSON-only fields this resolver reads). It is DATA + pure lookups
 * — no DOM, no storage, no model.
 *
 * Two duties per quest (the route example, end to end):
 *   - "clue"    NPC: hands the player a route item (`gives`) — the source of the
 *               step's required key (the fountain traveler → the ferry token; the
 *               market clerk → the city-gate pass). The give itself is the M4
 *               inventory/give surface; this resolver only DECLARES the source so
 *               the map/dialogue can point at it.
 *   - "deliver" NPC: accepts the held item at the step's anchor and advances the
 *               step through the deterministic engine (the boatman at the docks;
 *               the gatekeeper at the city gate).
 */

import type {
  SpecialNpcDef,
  SpecialNpcResolver,
} from "../contracts/runtime"
import type { Translate } from "../contracts/runtime"

const LOG = "[wp/specialNpc]"

/** Which side of the clue→deliver chain a special NPC tends at its anchor. */
export type SpecialDuty = "clue" | "deliver"

/**
 * One parsed `content/npc/special.json` entry: the FROZEN `SpecialNpcDef` surface
 * (anchorId/questId/role/name/stepIds) plus a few additive, JSON-only fields this
 * resolver owns. Additive only — a consumer that knows only `SpecialNpcDef` still
 * works (the extra fields are ignored).
 */
export interface SpecialNpcEntry extends SpecialNpcDef {
  /**
   * What this NPC does for the chain: "clue" (hands a route item) or "deliver"
   * (accepts the item + advances the step). Defaults to "deliver" when omitted
   * (a marked NPC at a step's anchor is, by default, the one who accepts).
   */
  duty?: SpecialDuty
  /**
   * For a "clue" NPC: the item id it hands the player (the source of the step's
   * required key). Drives "where to find the X" labelling + the M4 give surface.
   */
  gives?: string
  /** Localization key for `name` (resolved via the `Translate` seam when present). */
  nameKey?: string
}

/* ----------------------------------------------------------- normalization */

/**
 * Validate + normalize a raw JSON list into entries. Noisy (never silent): a
 * malformed entry is logged and skipped, not crashed on — a missing producer or
 * a typo'd anchor degrades to "no special here," exactly the documented stub.
 */
function normalizeContent(raw: unknown): SpecialNpcEntry[] {
  if (!Array.isArray(raw)) {
    console.warn(`${LOG} special.json is not an array — treating as no specials.`)
    return []
  }
  const out: SpecialNpcEntry[] = []
  for (const r of raw) {
    if (!r || typeof r !== "object") {
      console.warn(`${LOG} skipping non-object special entry:`, r)
      continue
    }
    const e = r as Record<string, unknown>
    const anchorId = typeof e.anchorId === "string" ? e.anchorId : null
    const questId = typeof e.questId === "string" ? e.questId : null
    const role = typeof e.role === "string" ? e.role : null
    const name = typeof e.name === "string" ? e.name : null
    if (!anchorId || !questId || !role || !name) {
      console.warn(`${LOG} skipping special entry missing anchorId/questId/role/name:`, r)
      continue
    }
    const stepIds = Array.isArray(e.stepIds)
      ? e.stepIds.filter((s): s is string => typeof s === "string")
      : undefined
    const duty: SpecialDuty | undefined =
      e.duty === "clue" || e.duty === "deliver" ? e.duty : undefined
    const entry: SpecialNpcEntry = {
      anchorId,
      questId,
      role,
      name,
      ...(stepIds && stepIds.length ? { stepIds } : {}),
      ...(duty ? { duty } : {}),
      ...(typeof e.gives === "string" ? { gives: e.gives } : {}),
      ...(typeof e.nameKey === "string" ? { nameKey: e.nameKey } : {}),
    }
    out.push(entry)
  }
  return out
}

/* ---------------------------------------------------------- the resolver */

/**
 * The resolver the contract names, EXTENDED with the helpers the orchestrator +
 * map need: duty classification, the deliver/clue lookups, and a localized
 * display name. The base `SpecialNpcResolver` surface (`isSpecial`/`forAnchor`/
 * `forQuest`) is unchanged so a consumer that only knows the contract compiles.
 */
export interface SpecialNpcResolverFull extends SpecialNpcResolver {
  forAnchor(anchorId: string, questId: string): SpecialNpcEntry | null
  forQuest(questId: string): SpecialNpcEntry[]
  /**
   * The DELIVER special tending a step's anchor for a quest, or null. This is the
   * ONE NPC the engine accepts a delivery through for `stepId` — anyone else is a
   * generic persona (or a clue-giver, who hands items but never advances).
   */
  deliverFor(questId: string, stepId: string): SpecialNpcEntry | null
  /** All CLUE-giving specials for a step (the sources of its required items). */
  cluesFor(questId: string, stepId: string): SpecialNpcEntry[]
  /**
   * Does THIS marked special accept a delivery for the active step? True only for
   * a `duty:"deliver"` entry whose `stepIds` covers (or omits → any) the step.
   * The hand-over affordance is gated on this; clue NPCs never advance a step.
   */
  acceptsDelivery(anchorId: string, questId: string, stepId: string): boolean
  /**
   * A special's friendly display name, localized through the `Translate` seam
   * when both `t` and the entry's `nameKey` are present; else the authored
   * English `name`. Used by the map `anchorName` resolver + the dialogue header.
   */
  displayName(def: SpecialNpcDef, t?: Translate, lang?: string): string
  /** Resolve a friendly name straight from an anchor id (map `anchorName` helper). */
  anchorName(anchorId: string, questId: string, t?: Translate, lang?: string): string | null
}

/** Does an entry's `stepIds` cover this step? (omitted/empty → any step). */
function handlesStep(entry: SpecialNpcEntry, stepId: string): boolean {
  return !entry.stepIds || entry.stepIds.length === 0 || entry.stepIds.includes(stepId)
}

/** A "clue" NPC hands items; everyone else marked is a "deliver" NPC by default. */
function dutyOf(entry: SpecialNpcEntry): SpecialDuty {
  return entry.duty ?? "deliver"
}

/**
 * Build the resolver from raw `content/npc/special.json`. Pass the imported JSON;
 * malformed entries are dropped (noisy). With an empty/absent list it behaves
 * exactly as the documented `noSpecials` stub — every NPC is generic.
 */
export function createSpecialNpcResolver(raw: unknown): SpecialNpcResolverFull {
  const entries = normalizeContent(raw)

  // Index by `${anchorId}::${questId}` for O(1) `forAnchor` (a single agent tends
  // one anchor per quest; if a topology ever doubles up we keep the FIRST + warn).
  const byAnchor = new Map<string, SpecialNpcEntry>()
  const byQuest = new Map<string, SpecialNpcEntry[]>()
  for (const e of entries) {
    const key = `${e.anchorId}::${e.questId}`
    if (byAnchor.has(key)) {
      console.warn(`${LOG} duplicate special at anchor "${e.anchorId}" for "${e.questId}" — keeping first.`)
    } else {
      byAnchor.set(key, e)
    }
    const list = byQuest.get(e.questId) ?? []
    list.push(e)
    byQuest.set(e.questId, list)
  }

  const forAnchor = (anchorId: string, questId: string): SpecialNpcEntry | null =>
    byAnchor.get(`${anchorId}::${questId}`) ?? null

  const forQuest = (questId: string): SpecialNpcEntry[] => (byQuest.get(questId) ?? []).slice()

  const displayName = (def: SpecialNpcDef, t?: Translate, lang?: string): string => {
    const nameKey = (def as SpecialNpcEntry).nameKey
    if (t && nameKey && lang) {
      const localized = t(nameKey, lang)
      // The seam returns the key back when it has no entry → don't show the key.
      if (localized && localized !== nameKey) return localized
    }
    return def.name
  }

  return {
    isSpecial: (anchorId, questId) => forAnchor(anchorId, questId) !== null,
    forAnchor,
    forQuest,
    deliverFor: (questId, stepId) =>
      forQuest(questId).find((e) => dutyOf(e) === "deliver" && handlesStep(e, stepId)) ?? null,
    cluesFor: (questId, stepId) =>
      forQuest(questId).filter((e) => dutyOf(e) === "clue" && handlesStep(e, stepId)),
    acceptsDelivery: (anchorId, questId, stepId) => {
      const e = forAnchor(anchorId, questId)
      return e !== null && dutyOf(e) === "deliver" && handlesStep(e, stepId)
    },
    displayName,
    anchorName: (anchorId, questId, t, lang) => {
      const e = forAnchor(anchorId, questId)
      return e ? displayName(e, t, lang) : null
    },
  }
}
