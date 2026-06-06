/**
 * personaGen — turn EVERY wandering townsperson into a real, talkable character.
 *
 * THE PROBLEM this fixes (PREMIUM_FOUNDATIONS §3 + §6): the crowd used to bind
 * personas only to the 3 hand-authored roles in `content/npc/roles.json`; the
 * other ~25 wanderers fell through to a stub "¡Hola!" toast. "An NPC without
 * conversation/challenge capabilities is a waste of time." So we GENERATE a
 * persona for each agent the same way `characterGen` generates their face and
 * clothes — deterministically, from a seed — yielding a valid `NpcRole` that the
 * existing `npcRuntime` + `promptProgram` already know how to drive.
 *
 * A persona is the join of three things:
 *   1. the agent's `CharacterSpec.demeanor` (friendly/cheery/gruff/shy/sly/sleepy
 *      — already chosen by characterGen and rendered on their FACE),
 *   2. a role ARCHETYPE (baker, vendor, clerk, musician, …) chosen by seed
 *      and biased by which anchor the agent tends (a `vendor` anchor → a market
 *      trade; an `npc_station` anchor → a civic/learned trade),
 *   3. the Scene + Quest (era/place/mood/language) the persona lives inside.
 *
 * The output is a `NpcRole` enriched with extra, optional fields the prompt
 * program leans on (archetype id, voice hint, challenge whitelist, a one-line
 * backstory hook). `NpcRole` from contracts is structurally compatible — the
 * extra keys are additive and the runtime only reads `id/anchorId/basePersona/
 * scriptedFallback`, so nothing downstream breaks.
 *
 * Deterministic + hugely varied: archetype × demeanor × name × quirk-shuffle ×
 * backstory means no two of 40 feel the same, and the SAME seed always rebuilds
 * the SAME person (stable across frames + reloads). Wholesome-heavy: smuggler is
 * rare and never mean; everyone is era-appropriate and safe for a seven-year-old.
 */

import type { NpcRole, Scene, ChallengeToolId } from "@world-plaza/contracts"
import type { CharacterSpec, Demeanor } from "../character/characterSpec"

/* --------------------------------------------------------------- PRNG ------ */

/** Tiny fast deterministic hash → 32-bit (FNV-1a, same family as characterGen). */
function hashStr(s: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** mulberry32 — small, well-distributed seedable PRNG. */
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Rand = () => number
const pick = <T>(r: Rand, arr: readonly T[]): T => arr[Math.floor(r() * arr.length)]
/** Pick `n` distinct items from `arr` (or all if n ≥ length), seed-stable. */
function pickN<T>(r: Rand, arr: readonly T[], n: number): T[] {
  const pool = arr.slice()
  const out: T[] = []
  const k = Math.min(n, pool.length)
  for (let i = 0; i < k; i++) {
    const j = Math.floor(r() * pool.length)
    out.push(pool.splice(j, 1)[0])
  }
  return out
}

/* --------------------------------------------------------- archetypes ------ */

/**
 * An archetype is a TRADE/role read for a townsperson, era-agnostic in shape but
 * flavoured for the active world by the scene. Each carries:
 *  - the personality colour it lends (tone fragments, quirk fragments),
 *  - the challenge tools it likes to SPRING on the traveler (its whitelist) and
 *    the in-character PRETEXT it uses to do so ("my words got scrambled!"),
 *  - a name pool + backstory-hook fragments,
 *  - a voice-pitch hint and the anchor kind it tends toward.
 *
 * The challenge whitelist is the headline: a baker scrambles market words; a
 * scribe hunts typos and fills blanks; a musician matches rhymes and sounds; a
 * water-seller drills numbers/prices. So engaging ANY character can contrive a
 * fitting micro-challenge, never a generic one.
 */
export interface Archetype {
  id: string
  /**
   * Human label, ENGLISH — for analytics + the UI header ONLY, NEVER injected into
   * the system prompt for a non-English target (a 4B model parrots a stray English
   * noun like "lamplighter" → "Soy un lamplighter"). The prompt uses `roleNoun`
   * (target-language) or `venuePhrase` (language-neutral) instead — see #107.
   */
  label: string
  /** Which anchor kind this trade tends near (for seed-biasing only). */
  tends: "vendor" | "npc_station" | "either"
  /** Personality tone fragments — combined with demeanor for basePersona.tone. */
  toneSeeds: readonly string[]
  /** Quirk fragments (in-character behaviours) — sampled into basePersona.quirks. */
  quirkSeeds: readonly string[]
  /** The challenge tools this character likes to spring (the whitelist). */
  tools: readonly ChallengeToolId[]
  /** In-character PRETEXTS for springing a challenge (fed to the prompt program). */
  pretexts: readonly string[]
  /** Topic words this trade talks about — seeds the teaching + challenge content. */
  topics: readonly string[]
  /** Name pools (era-flavoured, fun, NON-identifying — no real-person handles). */
  names: readonly string[]
  /** Backstory-hook fragments — one is chosen for the persona's clue/quest lean. */
  hooks: readonly string[]
  /** Voice-pitch hint suffix appended to the language voice code. */
  voice: "warm" | "bright" | "deep" | "soft" | "sly" | "old" | "young"
  /** Rarity weight in the archetype bag (lower = rarer). Default 3. */
  weight?: number
}

/**
 * The archetype catalogue — MODERN "Corpan City" roles (#107). Re-themed from the
 * old colonial-1770 trades to contemporary city life so venue-fit reads naturally
 * (a clinic NPC is a nurse, not a "lamplighter") and nothing feels like a storybook
 * mismatch in a real modern place. 19 wandering roles — everyday Corpan City people
 * (baker, courier, student, cook, busker, dog-walker, commuter, cyclist, cleaner, …)
 * incl. the rare, wholesome neighbourhood "fixer". Shapes (tools/tends/voice/weight)
 * are unchanged so the minigame fit + crowd balance carry over; flavour is modern.
 */
const ARCHETYPES: readonly Archetype[] = [
  {
    id: "baker",
    label: "a warm-hearted baker",
    tends: "vendor",
    toneSeeds: ["warm", "generous", "cheerful behind the counter", "always offering a taste"],
    quirkSeeds: [
      "slide a fresh pastry across the counter",
      "name every loaf in the case",
      "praise the smallest attempt to order",
      "smell of cinnamon and warm bread",
    ],
    tools: ["word-scramble", "picture-match", "fast-translate", "category-sort"],
    pretexts: [
      "the chalkboard menu smudged and the pastry names are all jumbled",
      "the new labels got stuck on the wrong trays",
    ],
    topics: ["bread", "pastry", "bakery", "morning", "cake", "sweet", "coffee"],
    names: ["Marta", "Mateo", "Rosa", "Tomás", "Aurelia", "Beto"],
    hooks: [
      "saves the last croissants for the late commuters",
      "knows which café just got a new coffee roast",
    ],
    voice: "warm",
  },
  {
    id: "vendor",
    label: "a brisk street-food vendor",
    tends: "vendor",
    toneSeeds: ["brisk", "down-to-earth", "loud and good-humoured", "quick with the orders"],
    quirkSeeds: [
      "call out the day's special like a chant",
      "wrap an order before you finish asking",
      "keep the grill sizzling while you chat",
    ],
    tools: ["number-drill", "fast-translate", "odd-one-out", "listen-choose-pic"],
    pretexts: [
      "the lunch-rush prices got muddled and need calling out again",
      "the order tickets got shuffled and need naming before they pile up",
    ],
    topics: ["food", "price", "snack", "order", "lunch", "fresh", "spicy"],
    names: ["Lucho", "Nerea", "Pablo", "Marina", "Chucho", "Dolores"],
    hooks: [
      "feeds the whole block and hears every bit of street news",
      "swears the cab drivers tip the worst",
    ],
    voice: "bright",
  },
  {
    id: "shopkeeper",
    label: "a patient corner-shop owner",
    tends: "vendor",
    toneSeeds: ["patient", "proud of the little shop", "soft-spoken", "tidy and precise"],
    quirkSeeds: [
      "hold a label up to read it properly",
      "teach one item name at a time",
      "hum while restocking the shelves",
    ],
    tools: ["picture-match", "memory-pairs", "category-sort", "spot-typo"],
    pretexts: [
      "the new price labels fell off and got mixed up",
      "the shelf signs need matching back to their aisles",
    ],
    topics: ["shop", "shelf", "item", "price", "bag", "change", "aisle"],
    names: ["Itzel", "Manuela", "Catalina", "Soledad", "Ximena"],
    hooks: [
      "keeps the keys to half the block's mailboxes",
      "knows the bakery always runs out of milk by noon",
    ],
    voice: "soft",
  },
  {
    id: "dog-walker",
    label: "a friendly dog-walker",
    tends: "either",
    toneSeeds: ["friendly", "easy-going", "warm", "happiest out in the park"],
    quirkSeeds: [
      "introduce each dog by name",
      "wave to everyone on the path",
      "untangle a couple of leashes while you talk",
    ],
    tools: ["picture-match", "odd-one-out", "memory-pairs", "true-false"],
    pretexts: [
      "the dogs' name tags got mixed up and must be sorted back",
      "two of the dogs look alike and one must be picked out",
    ],
    topics: ["dog", "park", "walk", "leash", "bench", "tree", "green"],
    names: ["Yamile", "Beni", "Esperanza", "Bruno", "Flora"],
    hooks: [
      "knows the best shaded benches in the park",
      "hears all the neighbourhood news on the morning loop",
    ],
    voice: "soft",
  },
  {
    id: "student",
    label: "a busy university student",
    tends: "either",
    toneSeeds: ["bright", "a little frazzled", "friendly", "quick on the uptake"],
    quirkSeeds: [
      "balance a coffee and a stack of books",
      "quote something from today's lecture",
      "check the time, then relax and chat",
    ],
    tools: ["fill-the-blank", "dialogue-fill", "true-false", "build-sentence"],
    pretexts: [
      "the lecture notes got jumbled and a word is missing",
      "a sentence in the assignment lost its last word",
    ],
    topics: ["class", "book", "study", "word", "campus", "exam", "library"],
    names: ["Ana", "Diego", "Lucas", "Tomás", "Vale"],
    hooks: [
      "knows which café has the quietest corner to study",
      "always knows what's on at the student union",
    ],
    voice: "young",
  },
  {
    id: "guide",
    label: "a friendly tour guide",
    tends: "either",
    toneSeeds: ["easy-going", "full of city stories", "warm", "always pointing things out"],
    quirkSeeds: [
      "point toward a landmark when naming places",
      "drop a fun fact about the city",
      "carry a folded map of every district",
    ],
    tools: ["listen-choose", "say-it-back", "build-sentence", "countdown-recall"],
    pretexts: [
      "the tour notes got jumbled and the stops ran together",
      "a line of the walking-tour script lost a word",
    ],
    topics: ["city", "tour", "street", "place", "river", "bridge", "park"],
    names: ["Remo", "Joaquín", "Vidal", "Selena", "Cosme"],
    hooks: [
      "knows the fastest way across town on foot",
      "always knows which museum is free today",
    ],
    voice: "deep",
  },
  {
    id: "courier",
    label: "a hard-working delivery courier",
    tends: "either",
    toneSeeds: ["gruff but fair", "always on the move", "plain-spoken", "no-nonsense"],
    quirkSeeds: [
      "count the parcels under your breath",
      "check the time and the address twice",
      "warm up once you trust someone",
    ],
    tools: ["number-drill", "countdown-recall", "word-search", "fast-translate"],
    pretexts: [
      "the delivery list got smudged and needs recounting",
      "the address labels got swapped and must be matched again",
    ],
    topics: ["parcel", "address", "delivery", "bike", "street", "fast", "number"],
    names: ["Bárbara", "Gaspar", "Nico", "Ramón", "Quique"],
    hooks: [
      "knows which buzzers are broken on every block",
      "grumbles that the elevator's always out at the tower",
    ],
    voice: "deep",
  },
  {
    id: "cook",
    label: "a busy line cook",
    tends: "vendor",
    toneSeeds: ["busy", "warm", "quick and chatty", "proud of the food"],
    quirkSeeds: [
      "call out the day's special over the pass",
      "taste the sauce and nod to himself",
      "wave a towel while keeping six pans going",
    ],
    tools: ["fast-translate", "number-drill", "translate-fast", "category-sort"],
    pretexts: [
      "the order tickets got shuffled and need re-pairing",
      "two dishes got swapped and the odd one must be spotted",
    ],
    topics: ["food", "dish", "kitchen", "menu", "order", "plate", "spicy"],
    names: ["Próspero", "Valentina", "Casimiro", "Renata", "Severo"],
    hooks: [
      "feeds half the block their lunch",
      "knows which market stall has the freshest produce",
    ],
    voice: "bright",
  },
  {
    id: "busker",
    label: "a street busker",
    tends: "either",
    toneSeeds: ["lively", "playful", "lyrical", "head full of songs"],
    quirkSeeds: [
      "tap out a rhythm while you talk",
      "turn a new word into a little rhyme",
      "tune the guitar between sentences",
    ],
    tools: ["rhyme-match", "listen-choose", "say-it-back", "repeat-after"],
    pretexts: [
      "a verse fell apart and the rhyming words got scattered",
      "the song's matching sounds need pairing up again",
    ],
    topics: ["song", "rhyme", "rhythm", "dance", "tune", "verse", "music"],
    names: ["Cancio", "Lira", "Melodía", "Tito", "Paloma", "Rumbo"],
    hooks: [
      "knows a song about every corner of the city",
      "trades a tune for news from passers-by",
    ],
    voice: "young",
  },
  {
    id: "elder",
    label: "a friendly neighbourhood regular",
    tends: "npc_station",
    toneSeeds: ["warm", "unhurried", "fond of stories", "twinkle-eyed"],
    quirkSeeds: [
      "begin an answer with 'back in the day…'",
      "remember everyone who's passed through the square",
      "watch the plaza from a favourite bench",
    ],
    tools: ["dialogue-fill", "true-false", "memory-pairs", "countdown-recall"],
    pretexts: [
      "a half-remembered saying is missing its ending",
      "an old story's order got jumbled and needs setting right",
    ],
    topics: ["memory", "story", "city", "years ago", "family", "neighbour"],
    names: ["Abuela Inés", "Don Eustaquio", "Doña Faustina", "Abuelo Cleto"],
    hooks: [
      "remembers when the plaza was just a parking lot",
      "knew the café owner's parents",
    ],
    voice: "old",
  },
  {
    id: "child",
    label: "a bright-eyed kid",
    tends: "either",
    toneSeeds: ["bright", "curious", "giggly", "endlessly questioning"],
    quirkSeeds: [
      "ask 'why?' about everything",
      "want to race or play a game",
      "show off a sticker or a toy",
    ],
    tools: ["picture-match", "memory-pairs", "word-scramble", "odd-one-out"],
    pretexts: [
      "the picture cards got shuffled and need matching again",
      "a game's letters tumbled and want unscrambling",
    ],
    topics: ["play", "game", "colour", "animal", "friend", "toy", "fun"],
    names: ["Pepito", "Lucía", "Tonito", "Chela", "Memo", "Pili"],
    hooks: [
      "saw where the lost keys slid under a bench",
      "follows the street musician around all day",
    ],
    voice: "young",
    weight: 2,
  },
  {
    id: "cart-vendor",
    label: "a tireless coffee-cart vendor",
    tends: "vendor",
    toneSeeds: ["chatty", "ever-present", "good-natured", "quick on their feet"],
    quirkSeeds: [
      "call out fresh coffee to everyone passing",
      "count the change twice, smiling",
      "know everyone's order in the square",
    ],
    tools: ["number-drill", "fast-translate", "listen-choose-pic", "tap-translation"],
    pretexts: [
      "the morning's takings got muddled and need counting again",
      "the cup labels swapped and the prices need re-matching",
    ],
    topics: ["coffee", "cup", "change", "price", "cart", "fresh", "morning"],
    names: ["Lalo", "Chave", "Tonia", "Goyo", "Lupe"],
    hooks: [
      "hears every deal made over a coffee in the square",
      "knows who just caught the early train",
    ],
    voice: "bright",
  },
  {
    id: "office-worker",
    label: "a meticulous office worker",
    tends: "npc_station",
    toneSeeds: ["meticulous", "organised", "quietly proud", "precise with words"],
    quirkSeeds: [
      "double-check a form before handing it over",
      "wince at a typo",
      "keep a pen tucked behind the ear",
    ],
    tools: ["spot-typo", "fill-the-blank", "fill-blank", "build-sentence", "dialogue-fill"],
    pretexts: [
      "a printed form has a typo that must be caught",
      "a blank was left on the form and needs the right word",
    ],
    topics: ["form", "name", "word", "email", "office", "sign", "meeting"],
    names: ["Plácido", "Aldo", "Serafina", "Cándido", "Ofelia"],
    hooks: [
      "knows which floor the good coffee machine is on",
      "keeps the record of who's behind on the paperwork",
    ],
    voice: "soft",
  },
  {
    id: "barber",
    label: "a chatty neighbourhood barber",
    tends: "npc_station",
    toneSeeds: ["chatty", "easy-going", "watchful", "happy to take their time"],
    quirkSeeds: [
      "talk while the clippers buzz",
      "know every bit of block gossip",
      "tilt your head to size up a cut",
    ],
    tools: ["odd-one-out", "memory-pairs", "listen-choose", "true-false"],
    pretexts: [
      "the appointment list got smudged and the times need sorting",
      "one name on the board is out of place and must be picked out",
    ],
    topics: ["hair", "cut", "shop", "chair", "mirror", "comb", "style"],
    names: ["Faro", "Nico", "Brígida", "Silvano", "Lumi"],
    hooks: [
      "hears every secret in the neighbourhood",
      "knows the quiet streets to beat the traffic",
    ],
    voice: "soft",
    weight: 2,
  },
  {
    id: "florist",
    label: "a cheerful florist",
    tends: "vendor",
    toneSeeds: ["cheerful", "sweet", "sunny", "quick to laugh"],
    quirkSeeds: [
      "tuck a stem behind your ear",
      "name flowers by their colours",
      "hum while wrapping a bouquet",
    ],
    tools: ["picture-match", "category-sort", "word-scramble", "rhyme-match"],
    pretexts: [
      "the flower names spilled and got jumbled in the bucket",
      "the colours need sorting back into their right bouquets",
    ],
    topics: ["flower", "colour", "bouquet", "shop", "spring", "bloom", "sweet"],
    names: ["Florita", "Margarita", "Jacinta", "Amapola", "Rosita"],
    hooks: [
      "supplies the café's window flowers",
      "saw someone drop something shiny by the fountain",
    ],
    voice: "young",
  },
  {
    id: "commuter",
    label: "a hurried commuter",
    tends: "npc_station",
    toneSeeds: ["hurried but polite", "friendly once they slow down", "practical", "always checking the time"],
    quirkSeeds: [
      "glance at the departures board mid-sentence",
      "balance a coffee, a bag, and a phone",
      "relax and chat once the train's not due yet",
    ],
    tools: ["number-drill", "listen-choose", "fast-translate", "build-sentence"],
    pretexts: [
      "the timetable got jumbled and the times need sorting",
      "a station sign is missing a word and must be filled",
    ],
    topics: ["train", "time", "platform", "ticket", "work", "commute", "station"],
    names: ["Andrés", "Marta", "Julio", "Rita", "Sole"],
    hooks: [
      "knows every shortcut between platforms",
      "can tell you which train is always late",
    ],
    voice: "bright",
  },
  {
    id: "cyclist",
    label: "a cheerful bike courier on a break",
    tends: "either",
    toneSeeds: ["energetic", "cheerful", "quick-talking", "always on the move"],
    quirkSeeds: [
      "wheel the bike along beside you",
      "point out the best bike lanes",
      "catch your breath and grin",
    ],
    tools: ["fast-translate", "number-drill", "listen-choose", "category-sort"],
    pretexts: [
      "the route list got scrambled and the stops need sorting",
      "two street names got swapped and the odd one must be spotted",
    ],
    topics: ["bike", "street", "lane", "fast", "city", "route", "corner"],
    names: ["Nacho", "Vera", "Pol", "Lucía", "Tin"],
    hooks: [
      "knows the fastest way across town on two wheels",
      "always knows where the road's closed today",
    ],
    voice: "young",
  },
  {
    id: "cleaner",
    label: "a steady street cleaner",
    tends: "npc_station",
    toneSeeds: ["steady", "good-natured", "plain-spoken", "proud of a tidy block"],
    quirkSeeds: [
      "lean on the broom for a friendly chat",
      "nod at the cleaned-up corner with satisfaction",
      "know exactly who drops litter where",
    ],
    tools: ["category-sort", "odd-one-out", "picture-match", "true-false"],
    pretexts: [
      "the bin labels got mixed and must be sorted again",
      "one thing in the pile doesn't belong and must be picked out",
    ],
    topics: ["street", "clean", "bin", "corner", "tidy", "morning", "block"],
    names: ["Goyo", "Tona", "Beto", "Lupe", "Sara"],
    hooks: [
      "knows the whole block before anyone else is awake",
      "keeps an eye on what gets left by the fountain",
    ],
    voice: "deep",
  },
  {
    // RARE, never mean: a roguish-but-likeable neighbourhood "fixer". Sly demeanor
    // leans here. Wholesome — knows everyone, helps for a small favour, never shady.
    id: "fixer",
    label: "a quick-witted neighbourhood fixer",
    tends: "either",
    toneSeeds: ["sly but likeable", "low-voiced", "playfully in-the-know", "quick-eyed"],
    quirkSeeds: [
      "lean in like it's a secret tip",
      "speak in hints and 'I know a guy'",
      "always seem to have what you need… for a small favour",
    ],
    tools: ["fast-translate", "odd-one-out", "translate-fast", "countdown-recall"],
    pretexts: [
      "a 'list' got scrambled on purpose and only a clever traveler can read it",
      "a code word is hidden among decoys and must be spotted",
    ],
    topics: ["tip", "deal", "ticket", "shortcut", "favour", "contact", "city"],
    names: ["Zorro", "Tuerto", "Sombra", "Garra", "Mecha"],
    hooks: [
      "can get you a hard-to-find ticket — small favour, no questions",
      "knows a back way into every sold-out show",
    ],
    voice: "sly",
    weight: 1,
  },

  /* ── VENUE-FIT roles (#107) ────────────────────────────────────────────────
   * Roles that fit a SPECIFIC venue — a clinic doctor, a café barista, a station
   * conductor. These are NEVER in the random wandering bag (`weight: 0`); they are
   * reachable ONLY when the agent is the objective/station NPC at a matching venue
   * anchor (see VENUE_ARCHETYPE + generatePersona's venue override). So the crowd
   * stays the colourful old trades, but the NPC you're SENT to fits where they
   * stand — a clinic never yields a "dusk-loving lamplighter". The label is English
   * (UI/analytics only); the prompt names the role via ROLE_TERMS / venuePhrase. */
  {
    id: "doctor",
    label: "a steady clinic doctor",
    tends: "npc_station",
    toneSeeds: ["calm", "reassuring", "attentive", "kind but unhurried"],
    quirkSeeds: [
      "ask gently how the traveler is feeling",
      "explain one thing slowly and clearly",
      "keep the waiting room calm",
    ],
    tools: ["fill-the-blank", "picture-match", "true-false", "listen-choose"],
    pretexts: [
      "a patient chart smudged and a word needs filling in",
      "the symptom labels got mixed and must be matched again",
    ],
    topics: ["health", "doctor", "clinic", "rest", "care", "fever", "help"],
    names: ["Dra. Elena", "Dr. Marco", "Dra. Sofía", "Dr. Andrés", "Dra. Pilar"],
    hooks: [
      "knows which traveler skipped their rest before the road",
      "keeps the clinic open late for the harbour workers",
    ],
    voice: "warm",
    weight: 0,
  },
  {
    id: "pharmacist",
    label: "a careful pharmacist",
    tends: "npc_station",
    toneSeeds: ["careful", "precise", "patient", "quietly helpful"],
    quirkSeeds: [
      "read the label twice before handing anything over",
      "name each remedy and what it eases",
      "keep the little drawers in perfect order",
    ],
    tools: ["picture-match", "category-sort", "fill-the-blank", "number-drill"],
    pretexts: [
      "the remedy labels fell off and must be matched again",
      "a dosage line got smudged and needs the right number",
    ],
    topics: ["remedy", "pharmacy", "dose", "label", "health", "care", "rest"],
    names: ["Don Ramiro", "Farm. Lucía", "Doña Inés", "Farm. Teo"],
    hooks: [
      "knows which tonic settles a traveler's stomach before a voyage",
      "keeps the clinic's order book straight",
    ],
    voice: "soft",
    weight: 0,
  },
  {
    id: "barista",
    label: "a friendly café barista",
    tends: "vendor",
    toneSeeds: ["friendly", "warm", "quick and cheerful", "glad of a chat"],
    quirkSeeds: [
      "ask how the traveler takes their coffee",
      "slide a little pastry across the counter",
      "name the day's special with a smile",
    ],
    tools: ["fast-translate", "picture-match", "word-scramble", "category-sort"],
    pretexts: [
      "the menu chalk smudged and the drink names are jumbled",
      "the orders got mixed and need calling out again",
    ],
    topics: ["coffee", "café", "order", "pastry", "menu", "morning", "cup"],
    names: ["Marisol", "Diego", "Camila", "Toño", "Bea"],
    hooks: [
      "remembers every regular's usual order",
      "hears all the plaza news across the counter",
    ],
    voice: "bright",
    weight: 0,
  },
  {
    id: "grocer",
    label: "a bustling market grocer",
    tends: "vendor",
    toneSeeds: ["bustling", "good-humoured", "quick to bargain", "warm-hearted"],
    quirkSeeds: [
      "stack the brightest fruit out front",
      "name each item and its price",
      "toss in one extra 'for the road'",
    ],
    tools: ["number-drill", "fast-translate", "category-sort", "picture-match"],
    pretexts: [
      "the price tags blew off the stalls and need re-pairing",
      "the morning prices got muddled and must be called out again",
    ],
    topics: ["fruit", "price", "market", "stall", "fresh", "weigh", "basket"],
    names: ["Doña Carmen", "Nacho", "Lupita", "Beto", "Rosa"],
    hooks: [
      "saves the ripest fruit for travelers headed to the docks",
      "knows which stall has the freshest catch today",
    ],
    voice: "warm",
    weight: 0,
  },
  {
    id: "conductor",
    label: "a brisk station conductor",
    tends: "npc_station",
    toneSeeds: ["brisk", "orderly", "helpful with a hurry", "keeps the clock"],
    quirkSeeds: [
      "call the next departure and platform",
      "check tickets with a quick nod",
      "point the way to the right platform",
    ],
    tools: ["number-drill", "listen-choose", "fill-the-blank", "build-sentence"],
    pretexts: [
      "the departures board scrambled and the times need sorting",
      "a platform sign is missing a word and must be filled",
    ],
    topics: ["train", "platform", "ticket", "depart", "station", "time", "track"],
    names: ["Don Felipe", "Cond. Marta", "Don Julio", "Cond. Rita"],
    hooks: [
      "knows the next boat-and-rail connection to Guadalajara",
      "holds the late platform open for a polite traveler",
    ],
    voice: "bright",
    weight: 0,
  },
  {
    id: "banker",
    label: "a courteous money-changer",
    tends: "npc_station",
    toneSeeds: ["courteous", "precise", "discreet", "patient with numbers"],
    quirkSeeds: [
      "count the coins twice, smiling",
      "name each rate clearly",
      "keep the ledger square",
    ],
    tools: ["number-drill", "fast-translate", "category-sort", "true-false"],
    pretexts: [
      "the exchange rates got muddled and need re-pairing",
      "a figure in the ledger smudged and must be read again",
    ],
    topics: ["coin", "rate", "change", "price", "ledger", "silver", "count"],
    names: ["Don Anselmo", "Cambista Vera", "Don Ruy", "Cambista Lía"],
    hooks: [
      "knows the fair rate before the harbour merchants do",
      "keeps the exchange honest for travelers far from home",
    ],
    voice: "soft",
    weight: 0,
  },
]

/* ─────────────────────────────────────────── venue → role (#107) ───────────
 * The objective/station NPC at a venue must be a role that FITS the venue, NOT a
 * seed-chosen wandering trade. When `generatePersona` is called with an anchorId
 * (or contract anchor kind) in this map, the venue archetype OVERRIDES the
 * demeanor/seed pick — so the clinic NPC is a doctor, the café NPC a barista, the
 * station NPC a conductor, etc. Keys are the contract anchor ids AND a few common
 * aliases (clinic≡hospital, cafe_counter≡cafe). Unknown anchors fall through to
 * the normal seed-chosen archetype (the colourful ambient crowd). */
const VENUE_ARCHETYPE: Record<string, string> = {
  // medical
  hospital: "doctor",
  clinic: "doctor",
  pharmacy: "pharmacist",
  // café / food
  cafe: "barista",
  cafe_counter: "barista",
  plaza: "barista", // the plaza café host quest (special.json es-cafe-travel)
  // market / grocer
  market: "grocer",
  general_store: "grocer",
  spice_stall: "grocer",
  silk_stall: "grocer",
  // transit
  station: "conductor",
  rail_station: "conductor",
  bus_station: "conductor",
  airport: "conductor",
  // finance
  exchange: "banker",
  money_changer: "banker",
  // tailor / outfitter keeps the existing authored weaver-ish feel via roles.json,
  // so it is intentionally NOT mapped here.
}

/**
 * Resolve a venue archetype for an anchor id, if any. Tries the exact id, then a
 * lightly-normalised id (strip a trailing `_n/_s/_e/_w` cardinal + digits) so
 * `market_2`/`harbor_n` still match `market`/`harbor`. Returns null for an unknown
 * anchor (→ the agent keeps its seed-chosen wandering archetype). #107.
 */
function venueArchetypeFor(anchorId: string | undefined): Archetype | null {
  if (!anchorId) return null
  const direct = VENUE_ARCHETYPE[anchorId]
  const base = anchorId.replace(/_(n|s|e|w)$/i, "").replace(/_?\d+$/, "")
  const id = direct ?? VENUE_ARCHETYPE[base]
  if (!id) return null
  return ARCHETYPES.find((a) => a.id === id) ?? null
}

/* ─────────────────────────────────────── target-language role terms (#107) ──
 * The role noun rendered IN THE TARGET LANGUAGE so the persona seed never leaks an
 * English trade word a 4B model would parrot ("Soy un lamplighter"). Keyed by
 * archetype id → { langCode → noun }. `en` is the baseline; `es` covers the live
 * Antigua world. A (archetype, target) with no entry falls back to the archetype's
 * `venuePhrase` (a venue-grounded, language-neutral clause naming NO bare English
 * trade noun) — so EVERY pair gets a clean, non-leaking seed. The target-language
 * DIRECTIVE that ends the prompt (promptLocale) then carries the rest of the
 * in-language framing. Authoring es+en here; the rest backfill via the same i18n
 * pipeline that fills challengeSegues/promptLocale (a follow-up). */
const ROLE_TERMS: Record<string, Record<string, string>> = {
  doctor: { en: "a doctor", es: "médico/a de la clínica" },
  pharmacist: { en: "a pharmacist", es: "farmacéutico/a" },
  barista: { en: "a café barista", es: "barista del café" },
  grocer: { en: "a market grocer", es: "verdulero/a del mercado" },
  conductor: { en: "a station conductor", es: "revisor/a de la estación" },
  banker: { en: "a money-changer", es: "cambista" },
}

/**
 * A language-NEUTRAL, venue-grounded fallback clause for an archetype — used when
 * the target language has no ROLE_TERMS entry, so the seed NEVER carries a bare
 * English trade noun the model parrots. Phrased "who runs/works …" so it reads as
 * a role-by-place; the target directive renders the rest in-language. #107.
 */
const VENUE_PHRASE: Record<string, string> = {
  doctor: "the local who looks after people at the clinic here",
  pharmacist: "the local who runs the pharmacy here",
  barista: "the local who runs the café counter here",
  grocer: "the local who runs the market stall here",
  conductor: "the local who runs the station here",
  banker: "the local who runs the money exchange here",
}

/**
 * Render an archetype's role for the PERSONA SEED in the target language (#107).
 * Order: an authored target-language role term → the language-neutral venuePhrase
 * → (only for an archetype with neither, i.e. the old trades) null, so the caller
 * keeps the legacy English label. NEVER returns a bare English trade noun for a
 * non-English target. `target` is a Corpán language code ("es","ja",…); we match
 * exact then the base subtag ("es-MX"→"es").
 */
export function roleTermFor(archetypeId: string, target: string): string | null {
  const terms = ROLE_TERMS[archetypeId]
  if (terms) {
    const base = target.toLowerCase().split("-")[0]
    const hit = terms[target] ?? terms[target.toLowerCase()] ?? terms[base]
    if (hit) return hit
  }
  return VENUE_PHRASE[archetypeId] ?? null
}

/** Archetypes the seed may choose for a given anchor tendency, with weights. */
function archetypeBagFor(tends: "vendor" | "npc_station"): Archetype[] {
  const bag: Archetype[] = []
  for (const a of ARCHETYPES) {
    if (a.tends !== "either" && a.tends !== tends) continue
    const w = a.weight ?? 3
    for (let i = 0; i < w; i++) bag.push(a)
  }
  return bag
}

/* ----------------------------------------------- demeanor flavour ---------- */

/** A demeanor lends a tone adjective + biases which archetypes feel natural. */
const DEMEANOR_TONE: Record<Demeanor, string> = {
  friendly: "friendly",
  cheery: "cheery and upbeat",
  gruff: "gruff but good-hearted",
  shy: "shy and soft-spoken",
  sly: "sly and knowing",
  sleepy: "drowsy and unhurried",
}

/** Voice-pitch hint → a short suffix the host TTS layer can interpret loosely. */
const VOICE_SUFFIX: Record<Archetype["voice"], string> = {
  warm: "warm",
  bright: "bright",
  deep: "deep",
  soft: "soft",
  sly: "low",
  old: "elder",
  young: "youthful",
}

/* ---------------------------------------- scripted-fallback (no-LLM) -------- */

/**
 * In-character scripted lines for the NO-MODEL path. These must work even when
 * Qwen3 is absent, so we generate a small, warm set FLAVOURED by archetype +
 * demeanor. They are written in the scene's primary teaching language when we
 * recognise it (Spanish for Antigua); otherwise we fall back to a friendly,
 * language-neutral greeting set so the NPC still feels alive in any world.
 *
 * Templates use {name} and {topic} slots filled per-persona. Kept short so they
 * read aloud cleanly via TTS.
 */
type FallbackPack = {
  greet: readonly string[]
  teach: readonly string[]
  bye: readonly string[]
}

const ES_FALLBACK: Record<string, FallbackPack> = {
  baker: {
    greet: ["¡Buenos días! ¿Un pan dulce?", "Bienvenido. Huele a pan recién hecho, ¿verdad?"],
    teach: ['Esto, lo recién horneado, es "{topic}". ¿Lo has probado?', "¿Y en tu ciudad, cómo le dicen a un buen pan?"],
    bye: ["¡Vuelve cuando quieras, con hambre!"],
  },
  vendor: {
    greet: ["¡Recién hecho! ¿Qué te sirvo hoy?", "¡Eh! Mira lo que tengo en la parrilla."],
    teach: ['"{topic}" — repite, que el precio es justo.', "¿Cuánto crees que cuesta? ¡Adivina!"],
    bye: ["¡Que aproveche, y vuelve con hambre!"],
  },
  "office-worker": {
    greet: ["Un momento, que termino este formulario. Bienvenido.", "¿Un trámite? ¿Un nombre bien escrito?"],
    teach: ['Mira esta palabra: "{topic}". ¿La escribes bien?', "Cuidado con la ortografía, por favor."],
    bye: ["Listo el papeleo. Hasta pronto."],
  },
  busker: {
    greet: ["¡Ay, llega quien me falta para la canción!", "Quédate, que tengo una rima para ti."],
    teach: ['"{topic}"… ¿con qué rima? ¡Cántalo!', "Repite el ritmo: la-la, {topic}."],
    bye: ["¡Que la música te acompañe!"],
  },
  student: {
    greet: ["¡Hola! Perdona, voy con prisas entre clases.", "¿Tú también estudias por aquí?"],
    teach: ['Apunto esta palabra: "{topic}". ¿La repasamos?', "Despacio, que así se aprende mejor."],
    bye: ["Me voy a clase. ¡Nos vemos!"],
  },
}

/** Generic, language-neutral fallback (used for non-Spanish scenes). */
const NEUTRAL_FALLBACK: FallbackPack = {
  greet: ["Welcome, traveler! Stay a while.", "Hello there — what brings you to the plaza?"],
  teach: ['Around here we call this "{topic}". Ever seen one?', "What would you call it back home?"],
  bye: ["Safe travels, friend. Come back soon."],
}

/** Which teaching language does this scene primarily use, for fallback flavour. */
function fallbackLangOf(scene: Scene): "es" | "neutral" {
  // The "Corpan City" scenes (the warm paper-craft world that teaches Spanish) use
  // the es scripted fallback. The setting text is now modern ("Corpan City" /
  // "today" — #109), so we recognise the world by its STABLE scene id (unchanged:
  // antigua-grand / antigua-1770) or the place, and keep the legacy place/era tokens
  // for back-compat. NOTE: do NOT key on themeId — the dev Tokyo scene also uses the
  // "paper" theme but teaches a different language, so it must stay neutral. Cheap +
  // safe default (neutral) otherwise.
  const id = scene.id.toLowerCase()
  const place = scene.setting.place.toLowerCase()
  const era = scene.setting.era.toLowerCase()
  if (
    id.includes("antigua") || // the Corpan City scene ids (unchanged)
    place.includes("corpan") ||
    era.includes("177") || // legacy colonial tokens (back-compat)
    place.includes("antigua") ||
    place.includes("guadalajara")
  )
    return "es"
  return "neutral"
}

function buildScriptedFallback(
  r: Rand,
  arch: Archetype,
  scene: Scene,
  name: string,
  topic: string,
): { text: string }[] {
  const lang = fallbackLangOf(scene)
  const pack =
    lang === "es" ? ES_FALLBACK[arch.id] ?? defaultEsPack(arch) : NEUTRAL_FALLBACK
  const fill = (s: string) => s.replace("{name}", name).replace(/\{topic\}/g, topic)
  // 3–5 lines: greet → 1–2 teach → bye. Seed-shuffled within each bucket.
  const teachCount = 1 + (r() < 0.5 ? 1 : 0)
  const lines = [
    pick(r, pack.greet),
    ...pickN(r, pack.teach, teachCount),
    pick(r, pack.bye),
  ]
  return lines.map((text) => ({ text: fill(text) }))
}

/** A reasonable Spanish pack for archetypes without a bespoke one. */
function defaultEsPack(arch: Archetype): FallbackPack {
  return {
    greet: [`¡Hola, viajero! Soy ${arch.label.replace(/^a |^an /, "")}.`, "Bienvenido a la plaza."],
    teach: ['Por aquí a esto le decimos "{topic}". ¿Te suena?', "¿Y en tu idioma, cómo se diría?"],
    bye: ["¡Buen viaje! Nos vemos por aquí."],
  }
}

/* ----------------------------------------- the generated persona shape ----- */

/**
 * A generated persona: a contract-valid `NpcRole` PLUS the extra, optional fields
 * the prompt program leans on. The runtime only reads the `NpcRole` keys, so this
 * is safe to pass anywhere an `NpcRole` is expected.
 */
export interface GeneratedPersona extends NpcRole {
  /** archetype id (baker/scribe/…) — for the prompt program + analytics. */
  archetype: string
  /** human label ("a warm-hearted baker") — ENGLISH, for the UI header + analytics
   *  ONLY. NOT injected into the system prompt for a non-English target (#107). */
  archetypeLabel: string
  /**
   * The role rendered for the PERSONA SEED, in the TARGET language when authored
   * (ROLE_TERMS), else a language-neutral venue-grounded clause (venuePhrase), else
   * — for an unmapped old trade — the English `archetypeLabel` (the legacy path for
   * the colourful wandering crowd, where an in-world Spanish label is fine). NEVER a
   * bare English trade noun for a venue NPC on a non-English pair. #107.
   */
  roleTerm: string
  /** true when this persona's archetype was forced by its VENUE anchor (#107). */
  venueRole: boolean
  /** the demeanor this persona was built from (mirrors the CharacterSpec face). */
  demeanor: Demeanor
  /** a fun, non-identifying name for the header + in-character self-reference. */
  name: string
  /** TTS voice hint (e.g. "es:warm") the dialogue layer may pass to host.speak. */
  voiceHint: string
  /** the challenge tools this persona likes to spring (the whitelist). */
  challengeTools: ChallengeToolId[]
  /** in-character pretexts for springing a challenge ("my words got scrambled!"). */
  pretexts: string[]
  /** topic words this persona teaches/talks about (seed the challenge content). */
  topics: string[]
  /** one-line backstory hook — used to lean a quest clue in character. */
  backstoryHook: string
}

export interface PersonaContext {
  scene: Scene
  /** the agent's generated body/face — its demeanor drives the persona's mood. */
  spec: CharacterSpec
  /**
   * The anchor kind this agent tends near ("vendor" → market trade, "npc_station"
   * → civic/learned trade). Defaults to a seed-chosen mix when unknown.
   */
  tends?: "vendor" | "npc_station"
  /** stable anchor id for dialogue routing (defaults to a crowd id from seed). */
  anchorId?: string
  /**
   * The learner's TARGET language code ("es","ja",…). When set, a venue NPC's role
   * is rendered IN this language (ROLE_TERMS) for the persona seed, so the prompt
   * never leaks an English trade noun. Defaults to the scene's teaching language
   * (es for Antigua) when omitted, so existing callers still get a clean seed. #107.
   */
  target?: string
}

/* ------------------------------------------------- demeanor → archetype lean */

/**
 * Gently bias archetype choice by demeanor so the FACE and the PERSONA agree
 * (a gruff face → more likely a dockhand/fishmonger; a sleepy face → lamplighter;
 * a sly face → smuggler/merchant). This is a soft re-roll, not a hard rule, so
 * variety stays huge.
 */
const DEMEANOR_LEAN: Partial<Record<Demeanor, readonly string[]>> = {
  gruff: ["courier", "cleaner", "vendor", "cook"],
  sleepy: ["barber", "elder", "cleaner"],
  shy: ["shopkeeper", "office-worker", "florist", "child"],
  cheery: ["baker", "florist", "cart-vendor", "busker", "cyclist"],
  sly: ["fixer", "commuter"],
  friendly: ["baker", "student", "dog-walker", "busker", "elder"],
}

function chooseArchetype(r: Rand, tends: "vendor" | "npc_station", demeanor: Demeanor): Archetype {
  const bag = archetypeBagFor(tends)
  let chosen = pick(r, bag)
  // One soft re-roll toward the demeanor's natural trades, if a match exists in
  // the bag — keeps face↔persona coherent without killing variety.
  const lean = DEMEANOR_LEAN[demeanor]
  if (lean && r() < 0.6) {
    const matches = bag.filter((a) => lean.includes(a.id))
    if (matches.length) chosen = pick(r, matches)
  }
  return chosen
}

/* --------------------------------------------------------- the generator --- */

/**
 * Deterministically build a rich, wholesome, era-appropriate persona for one
 * townsperson. Same `seed` + `ctx` → the same persona, forever.
 *
 * @param seed  any stable string (e.g. "antigua:crowd:7" or a bound role id).
 * @param ctx   the scene + the agent's CharacterSpec (demeanor) + anchor tend.
 */
export function generatePersona(seed: string, ctx: PersonaContext): GeneratedPersona {
  const { scene, spec } = ctx
  const r = rng(hashStr(`persona|${scene.id}|${seed}`))

  const demeanor: Demeanor = spec.demeanor ?? "friendly"
  // If the caller didn't say which anchor we tend, let the seed decide (a 50/50
  // split, lightly nudged by the build — a child/stocky reads more "market").
  const tends: "vendor" | "npc_station" =
    ctx.tends ?? (r() < 0.55 ? "vendor" : "npc_station")

  // VENUE OVERRIDE (#107): if this agent is the objective/station NPC at a known
  // venue anchor, its role MUST fit the venue — a clinic doctor, a café barista, a
  // station conductor — NOT a seed-/demeanor-chosen wandering trade (the bug: a
  // "dusk-loving lamplighter" stationed at the clinic). The venue archetype wins
  // over the demeanor lean. Unmapped anchors (the ambient crowd) keep the colourful
  // seed-chosen trade.
  const venueArch = venueArchetypeFor(ctx.anchorId)
  const venueRole = venueArch != null
  const arch = venueArch ?? chooseArchetype(r, tends, demeanor)
  const name = pick(r, arch.names)
  const topics = pickN(r, arch.topics, Math.min(4, arch.topics.length))
  const backstoryHook = pick(r, arch.hooks)
  const pretexts = pickN(r, arch.pretexts, arch.pretexts.length)
  const challengeTools = dedupeTools(arch.tools)

  // tone = demeanor adjective + an archetype tone seed, woven into one line.
  const toneSeed = pick(r, arch.toneSeeds)
  const tone = `${DEMEANOR_TONE[demeanor]}, ${toneSeed}`

  // quirks = 2 archetype behaviours + (sometimes) a demeanor-coloured tic.
  const quirks = pickN(r, arch.quirkSeeds, 2)
  if (demeanor === "shy" && r() < 0.5) quirks.push("speak softly and look down before warming up")
  if (demeanor === "sleepy" && r() < 0.5) quirks.push("stifle a yawn between sentences")

  // a stable, routable id. Bound roles keep their id; crowd uses the seed.
  const id = ctx.anchorId ?? `crowd:${arch.id}:${seed}`
  const anchorId = ctx.anchorId ?? id

  const voiceHint = `${scene.npcSkins[id]?.voiceHint ?? voiceBase(scene)}:${VOICE_SUFFIX[arch.voice]}`

  const scriptedFallback = buildScriptedFallback(r, arch, scene, name, topics[0] ?? "café")

  // ROLE TERM for the persona seed (#107): a venue role is rendered in the TARGET
  // language (ROLE_TERMS) or a language-neutral venue clause (venuePhrase) so the
  // prompt NEVER carries a bare English trade noun the model parrots. An UNMAPPED
  // old trade has neither → keep its in-world English label (the legacy wandering
  // crowd, where a Spanish-flavoured label is fine in the Antigua world). Target
  // defaults to the scene's teaching language so existing callers stay clean.
  const target = ctx.target ?? (fallbackLangOf(scene) === "es" ? "es" : "en")
  const roleTerm = roleTermFor(arch.id, target) ?? arch.label

  return {
    id,
    anchorId,
    basePersona: { tone, quirks },
    scriptedFallback,
    // ---- enrichment (additive; runtime ignores these) ----
    archetype: arch.id,
    archetypeLabel: arch.label,
    roleTerm,
    venueRole,
    demeanor,
    name,
    voiceHint,
    challengeTools,
    pretexts,
    topics,
    backstoryHook,
  }
}

/** De-dup the tool list (a couple of archetypes list back-compat aliases). */
function dedupeTools(tools: readonly ChallengeToolId[]): ChallengeToolId[] {
  return Array.from(new Set(tools))
}

/** A base TTS language code for the scene (so voiceHint is never empty). */
function voiceBase(scene: Scene): string {
  return fallbackLangOf(scene) === "es" ? "es" : "en"
}

/* ------------------------------------------------------------- introspection */

/** Exposed for tooling/tests: the full archetype catalogue + their tool sets. */
export const PERSONA_ARCHETYPES = ARCHETYPES
export function archetypeIds(): string[] {
  return ARCHETYPES.map((a) => a.id)
}
