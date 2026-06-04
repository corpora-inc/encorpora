import type { Item } from "../items/itemTypes"
import { getItemDef } from "./inventory"
import type { InventoryStore } from "./inventory"

/**
 * questItems — the SPICE: which items matter for which quest, and which are junk.
 *
 * The same Ferry Token is *precious* on the Guadalajara route (it gates the
 * docks step) and *useless* on the café quest. We model that asymmetry as a
 * per-quest relevance table so quests, NPCs, and the shop can all answer the
 * same questions:
 *
 *   - does the player have the piece this quest step needs?  (`hasNeeded`)
 *   - what is still missing?                                  (`missingFor`)
 *   - is this item meaningful for the active quest, or junk?  (`relevance`)
 *   - what clue should the NPC lean on to point the player at it? (`clueFor`)
 *
 * SOURCES of relevance, in priority order:
 *   1. STATIC per-quest declarations here (`QUEST_ITEM_RULES`) — authoritative,
 *      content-reviewable, the seed the quest designers edit.
 *   2. TAG affinity — an item whose `tags` overlap a quest's `relevantTags`
 *      counts as "useful" even without an explicit rule (so new catalog items
 *      light up on the right journeys automatically).
 *   3. Everything else is JUNK for that quest (tradable flavour, not progress).
 *
 * This file is data + pure helpers — no UI, no storage. The quest engine and the
 * NPC prompt-program import it; the shop uses `relevance` to badge "useful here".
 */

/** A required item for a specific quest step, with the clue an NPC can reveal. */
export interface QuestItemRequirement {
  /** quest step id (matches Quest.steps[].id). */
  stepId: string
  /** item id the player must hold to satisfy this step. */
  itemId: string
  /**
   * In-character clue the NPC is leaned to reveal so progress feels DISCOVERED,
   * not handed over (PREMIUM_FOUNDATIONS §6 "clues & quest progression").
   */
  clue: string
  /** Optional: the anchor/NPC most likely to hand it over (for hint UI). */
  sourceAnchorId?: string
}

/** Per-quest item rules: what's required, and what tags make an item "useful". */
export interface QuestItemRules {
  questId: string
  /** Step → required item(s) + their clues. */
  requirements: QuestItemRequirement[]
  /**
   * Items whose tags overlap any of these are "useful" for this quest (worth
   * keeping / buying), even if not strictly required. Drives the shop badge +
   * "don't sell this" nudge.
   */
  relevantTags: string[]
  /**
   * Items the player should be steered to SELL on this quest (pure junk here).
   * Optional allow-list; if absent, "not relevant" ⇒ junk by default.
   */
  junkTags?: string[]
}

export type ItemRelevance = "required" | "useful" | "junk"

/* ------------------------------------------------------------ static rules */

/**
 * Seed rules for the shipping quests. New quests add an entry here; new items
 * light up automatically via `relevantTags`. Designed to be extracted into
 * `content/quests/*.json` later (the shape is JSON-friendly).
 */
export const QUEST_ITEM_RULES: Record<string, QuestItemRules> = {
  // The café quest (es-cafe-travel) — coffee/food matter; ferry tokens are junk.
  "es-cafe-travel": {
    questId: "es-cafe-travel",
    requirements: [
      {
        stepId: "order",
        itemId: "coffee-sack",
        clue: "The café owner murmurs: 'If only I had a fresh sack of coffee — try the market stalls.'",
        sourceAnchorId: "market",
      },
    ],
    relevantTags: ["coffee", "food", "market"],
    junkTags: ["ferry", "treasure", "gem"],
  },

  // Across Corpan City — the ferry token is the precious key for the harbor crossing.
  "es-guadalajara-route": {
    questId: "es-guadalajara-route",
    requirements: [
      {
        stepId: "docks",
        itemId: "ferry-token",
        clue: "The ferry hand won't even look up: 'No token, no crossing. Ask around the plaza — someone always has a spare.'",
        sourceAnchorId: "plaza",
      },
      {
        stepId: "gate",
        itemId: "city-gate-pass",
        clue: "The bridge keeper waves you back: 'The river bridge needs a pass. The market clerk hands them out.'",
        sourceAnchorId: "market",
      },
    ],
    relevantTags: ["travel", "ferry", "harbor", "bridge", "map"],
    junkTags: ["spice", "pottery"],
  },
}

/* --------------------------------------------------------------- helpers */

function rulesFor(questId: string): QuestItemRules | undefined {
  return QUEST_ITEM_RULES[questId]
}

/** All item ids this quest requires (across every step). */
export function requiredItemIds(questId: string): string[] {
  return rulesFor(questId)?.requirements.map((r) => r.itemId) ?? []
}

/** Item ids required specifically for one step. */
export function requiredForStep(questId: string, stepId: string): string[] {
  return (
    rulesFor(questId)
      ?.requirements.filter((r) => r.stepId === stepId)
      .map((r) => r.itemId) ?? []
  )
}

/**
 * Classify an item for a quest: required / useful / junk. The core of "precious
 * here, useless there." Pure — takes the item def, no store needed.
 */
export function relevance(questId: string, item: Item | string): ItemRelevance {
  const def = typeof item === "string" ? getItemDef(item) : item
  if (!def) return "junk"
  const rules = rulesFor(questId)
  if (!rules) return "junk"
  if (rules.requirements.some((r) => r.itemId === def.id)) return "required"
  const tags = def.tags ?? []
  if (rules.relevantTags.some((t) => tags.includes(t))) return "useful"
  return "junk"
}

/** Convenience: is this item required for the active quest's CURRENT step? */
export function isRequiredForStep(questId: string, stepId: string, itemId: string): boolean {
  return requiredForStep(questId, stepId).includes(itemId)
}

/** Does the player hold everything this step needs? */
export function hasNeeded(store: InventoryStore, questId: string, stepId: string): boolean {
  return store.hasAll(requiredForStep(questId, stepId))
}

/** The required ids the player is still MISSING for a step (for hint UI). */
export function missingFor(store: InventoryStore, questId: string, stepId: string): string[] {
  return requiredForStep(questId, stepId).filter((id) => !store.has(id))
}

/**
 * The clue(s) an NPC should reveal to nudge the player toward the missing piece.
 * Only returns clues for items the player does NOT yet hold (no point teasing a
 * key they already have). The prompt-program injects these into the NPC system
 * prompt so the reveal is in-character.
 */
export function cluesFor(store: InventoryStore, questId: string, stepId?: string): string[] {
  const rules = rulesFor(questId)
  if (!rules) return []
  return rules.requirements
    .filter((r) => (stepId ? r.stepId === stepId : true))
    .filter((r) => !store.has(r.itemId))
    .map((r) => r.clue)
}

/**
 * Where to find a missing required item (anchor id), for an on-map hint marker.
 */
export function sourceHints(
  store: InventoryStore,
  questId: string,
): Array<{ itemId: string; anchorId?: string }> {
  const rules = rulesFor(questId)
  if (!rules) return []
  return rules.requirements
    .filter((r) => !store.has(r.itemId))
    .map((r) => ({ itemId: r.itemId, anchorId: r.sourceAnchorId }))
}

/**
 * Should the shop steer the player to SELL this item on the active quest? True
 * when it's junk here AND it's actually tradable (don't suggest selling keys).
 * The shop uses this for a gentle "safe to sell" badge — never auto-sells.
 */
export function safeToSell(questId: string, item: Item | string): boolean {
  const def = typeof item === "string" ? getItemDef(item) : item
  if (!def || !def.tradable) return false
  return relevance(questId, def) === "junk"
}
