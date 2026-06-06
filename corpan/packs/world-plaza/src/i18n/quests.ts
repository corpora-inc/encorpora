/**
 * Quest string catalog (LOCALIZATION.md §3) — the SECOND i18n namespace, for quest
 * CONTENT copy (title / narrative / step label / special-NPC name). Kept separate
 * from the UI-chrome catalog (`strings.ts`) because quest copy is content-register
 * (authored + tuned differently from button/menu UI), but it uses the SAME
 * mechanism: an `en` source-of-truth, a `GENERATED_LOCALES` block filled by
 * `tools/gen_i18n.py`, and a resolver that collapses variants + falls back per-key
 * to English (never blank).
 *
 * Keys are DERIVED from the ids the quest JSON already carries, so a quest needs no
 * hand-assigned keys — just author the English value under the derived key:
 *   - `quest.<questId>.title`
 *   - `quest.<questId>.narrative`
 *   - `quest.<questId>.step.<stepId>`     (a step label)
 *   - `special.<questId>.<anchorId>.name` (a special-NPC display name — the shape
 *      `content/npc/special.json`'s `nameKey` already uses)
 *
 * `questString(key, lang, fallback)` is the resolver every quest-bearing surface
 * calls: it returns the localized string, or the AUTHORED LITERAL fallback (the
 * quest JSON's raw `title`/`narrative`/`label`/`name`) when the catalog has no
 * entry — so an un-keyed or not-yet-translated quest still renders clean English.
 *
 * Rendered in the immersion resolver's `uiLocale()` (native by default, target
 * under immersion) — identical to the chrome catalog, so quest copy localizes AND
 * immersion-flips for free.
 */

import { baseLocale } from "./strings"

/** Derive the catalog key for a quest's title. */
export const questTitleKey = (questId: string): string => `quest.${questId}.title`
/** Derive the catalog key for a quest's narrative. */
export const questNarrativeKey = (questId: string): string => `quest.${questId}.narrative`
/** Derive the catalog key for a quest step's label. */
export const questStepKey = (questId: string, stepId: string): string =>
  `quest.${questId}.step.${stepId}`
/** Derive the catalog key for a special-NPC display name (matches special.json). */
export const specialNameKey = (questId: string, anchorId: string): string =>
  `special.${questId}.${anchorId}.name`

/**
 * The English source-of-truth + generated locales. AUTHORED keys live under `en`;
 * `tools/gen_i18n.py` (a second invocation, pointed at this file) fills the rest.
 * Seeded EMPTY: every quest currently renders via its JSON literal fallback, so the
 * pack is fully functional today; filling `en` here + generating is the translation
 * step (LOCALIZATION.md §4), with ZERO runtime risk (fallback covers every miss).
 */
const en: Record<string, string> = {
  // ── legacy ES quests (back-compat ids; literals already in the JSON, keyed here
  //    so the catalog path is exercised + ready for `gen_i18n.py` to translate). ──
  "quest.es-cafe-travel.title": "Coffee on the Plaza",
  "quest.es-cafe-travel.narrative": "Your very first words in the city: order a coffee at the plaza café.",
  "quest.es-cafe-travel.step.order-coffee": "Order a coffee at the plaza café",
  "quest.es-market-haggle.title": "A Deal at the Market",
  "quest.es-market-haggle.narrative": "Practice your numbers and prices with the market clerk.",
  "quest.es-market-haggle.step.haggle": "Ask the price at the market",
  "quest.es-directions.title": "Which Way to the Fountain?",
  "quest.es-directions.narrative": "Ask for directions at the plaza fountain and learn the way around.",
  "quest.es-directions.step.ask-way": "Ask for directions at the fountain",
  "quest.es-guadalajara-route.title": "Across Corpan City",
  "quest.es-guadalajara-route.narrative": "Find your way across Corpan City — from the harbor to the river bridge.",
  "quest.es-guadalajara-route.step.docks": "Ask for the ferry at the harbor",
  "quest.es-guadalajara-route.step.gate": "Meet the keeper at the river bridge",

  // ── plaza ──────────────────────────────────────────────────────────────────
  "quest.plaza-greetings.title": "First Hellos",
  "quest.plaza-greetings.narrative": "Trade greetings with the crowd on the plaza — your first warm words.",
  "quest.plaza-greetings.step.say-hello": "Greet a stranger on the plaza",
  "quest.plaza-cafe-order.title": "A Table at the Café",
  "quest.plaza-cafe-order.narrative": "Step into the café, settle in, and order something with confidence.",
  "quest.plaza-cafe-order.step.order": "Order food and drink at the café",
  "quest.plaza-cafe-order.step.pay": "Settle the bill and thank the barista",
  "quest.plaza-business.title": "Talking Shop",
  "quest.plaza-business.narrative": "A merchant on the square wants to do business. Introduce yourself and your trade.",
  "quest.plaza-business.step.introduce": "Introduce yourself to the merchant",
  "quest.plaza-business.step.propose": "Propose a deal",

  // ── market ─────────────────────────────────────────────────────────────────
  "quest.market-numbers.title": "Counting at the Stalls",
  "quest.market-numbers.narrative": "Learn your numbers and prices haggling through the market stalls.",
  "quest.market-numbers.step.ask-price": "Ask the price at a market stall",
  "quest.market-numbers.step.haggle": "Make an offer and close the deal",
  "quest.market-groceries.title": "The Grocer's Round",
  "quest.market-groceries.narrative": "Fill your basket: name the fruit, the bread, the spices, all in the market tongue.",
  "quest.market-groceries.step.name-goods": "Name the goods on the grocer's table",

  // ── fountain ───────────────────────────────────────────────────────────────
  "quest.fountain-directions.title": "Which Way From the Fountain?",
  "quest.fountain-directions.narrative": "Stand by the fountain and learn the words for left, right, and the way across town.",
  "quest.fountain-directions.step.ask-way": "Ask the way at the fountain",
  "quest.fountain-directions.step.follow": "Repeat the directions back",
  "quest.fountain-meetup.title": "Meet Me at the Fountain",
  "quest.fountain-meetup.narrative": "A local wants to make plans. Talk times, days, and where to meet.",
  "quest.fountain-meetup.step.make-plans": "Make plans to meet at the fountain",

  // ── harbor ─────────────────────────────────────────────────────────────────
  "quest.harbor-ferry-ride.title": "Down to the Harbor",
  "quest.harbor-ferry-ride.narrative": "Find the ferry at the harbor and learn the words for boats, fares, and the water.",
  "quest.harbor-ferry-ride.step.find-ferry": "Ask for the ferry at the harbor",
  "quest.harbor-ferry-ride.step.buy-fare": "Buy a fare and board",
  "quest.harbor-fishmonger.title": "The Day's Catch",
  "quest.harbor-fishmonger.narrative": "The fishmonger lays out the morning's catch. Name it, weigh it, buy it.",
  "quest.harbor-fishmonger.step.name-catch": "Name the catch at the harbor stall",
  "quest.harbor-route-master.title": "The Long Way Round",
  "quest.harbor-route-master.narrative": "A grand tour: market to harbor to the far bank — and say your farewell aloud.",
  "quest.harbor-route-master.step.stock-up": "Stock up at the market",
  "quest.harbor-route-master.step.to-harbor": "Reach the harbor",
  "quest.harbor-route-master.step.farewell": "Say your farewell aloud at the harbor",

  // ── station ────────────────────────────────────────────────────────────────
  "quest.station-departures.title": "Reading the Departures",
  "quest.station-departures.narrative": "At the rail station, read the board, buy a ticket, and find your platform.",
  "quest.station-departures.step.buy-ticket": "Buy a ticket at the rail station",
  "quest.station-departures.step.find-platform": "Ask which platform and when it leaves",

  // ── civic ──────────────────────────────────────────────────────────────────
  "quest.civic-cityhall.title": "Papers, Please",
  "quest.civic-cityhall.narrative": "A clerk at City Hall needs your details. Fill the form, in the local tongue.",
  "quest.civic-cityhall.step.fill-form": "Answer the clerk at City Hall",
  "quest.civic-clinic.title": "At the Clinic",
  "quest.civic-clinic.narrative": "Not feeling well. Explain your symptoms at the clinic and ask for help.",
  "quest.civic-clinic.step.describe": "Describe how you feel at the clinic",
  "quest.civic-clinic.step.ask-remedy": "Ask for a remedy and the dose",

  // ── bridge ─────────────────────────────────────────────────────────────────
  "quest.bridge-crossing.title": "Across the River",
  "quest.bridge-crossing.narrative": "Talk your way past the bridge keeper, then cross to the far bank yourself.",
  "quest.bridge-crossing.step.greet-keeper": "Greet the keeper at the north bridge",
  "quest.bridge-crossing.step.cross": "Cross the bridge to the far bank",
}

// GENERATED_QUEST_LOCALES_START
const LOCALES: Record<string, Record<string, string>> = {
  en,
}
// GENERATED_QUEST_LOCALES_END

function interpolate(s: string, params?: Record<string, string | number>): string {
  if (!params) return s
  return s.replace(/\{(\w+)\}/g, (m, k) => (k in params ? String(params[k]) : m))
}

/**
 * Resolve a quest-content string into `lang`, falling back to the authored LITERAL
 * (the quest JSON's raw value) when the catalog has no entry — never blank. This is
 * the keyed-quest contract (LOCALIZATION.md §3): prefer the key, fall back to the
 * literal, so an un-keyed/not-yet-translated quest renders clean English.
 */
export function questString(
  key: string,
  lang: string,
  fallbackLiteral: string,
  params?: Record<string, string | number>,
): string {
  const loc = baseLocale(lang)
  const hit = LOCALES[lang]?.[key] ?? LOCALES[loc]?.[key] ?? en[key]
  return interpolate(hit ?? fallbackLiteral, params)
}

/** True when the catalog actually has a (non-fallback) entry for `key` in `lang`. */
export function hasQuestString(key: string, lang: string): boolean {
  const loc = baseLocale(lang)
  return Boolean(LOCALES[lang]?.[key] ?? LOCALES[loc]?.[key] ?? en[key])
}

/** Present quest-catalog locales (for tests/dev). */
export function presentQuestLocales(): string[] {
  return Object.keys(LOCALES)
}

export { LOCALES as __QUEST_LOCALES_FOR_TEST }
