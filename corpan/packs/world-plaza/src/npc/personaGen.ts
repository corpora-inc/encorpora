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
 *   2. a role ARCHETYPE (baker, fishmonger, scribe, musician, …) chosen by seed
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
  /** Human label used in the system prompt ("a baker", "a wandering musician"). */
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
 * The archetype catalogue — Antigua-1770 era-appropriate (16 trades incl. the
 * rare smuggler). Shapes are era-agnostic; only the flavour words are colonial.
 */
const ARCHETYPES: readonly Archetype[] = [
  {
    id: "baker",
    label: "a warm-hearted baker",
    tends: "vendor",
    toneSeeds: ["warm", "generous", "flour-dusted and cheerful", "always offering a taste"],
    quirkSeeds: [
      "press a warm roll into the traveler's hands",
      "name every bread on the shelf",
      "praise the smallest attempt to order",
      "smell of cinnamon and toasted maize",
    ],
    tools: ["word-scramble", "picture-match", "fast-translate", "category-sort"],
    pretexts: [
      "the chalkboard menu smudged and the bread names are all jumbled",
      "a gust scattered the labels off the loaves",
    ],
    topics: ["bread", "pastry", "café", "morning", "market", "sweet", "coffee"],
    names: ["Doña Pan", "Mateo", "Rosalba", "Tomás", "Aurelia", "Beto"],
    hooks: [
      "saves day-old loaves for travelers headed to the docks",
      "knows which merchant just got a fresh sack of coffee",
    ],
    voice: "warm",
  },
  {
    id: "fishmonger",
    label: "a brisk fishmonger",
    tends: "vendor",
    toneSeeds: ["brisk", "salt-of-the-earth", "loud and good-humoured", "quick to bargain"],
    quirkSeeds: [
      "shout the day's catch like a song",
      "weigh things by eye and dare you to argue",
      "smell of brine and lime",
    ],
    tools: ["number-drill", "fast-translate", "odd-one-out", "listen-choose-pic"],
    pretexts: [
      "the morning's prices got muddled and need calling out again",
      "a basket tipped and the catch needs naming before it spoils",
    ],
    topics: ["fish", "price", "market", "sea", "basket", "fresh", "weigh"],
    names: ["Lucho", "Nereida", "Pablo", "Marina", "Chucho", "Dolores"],
    hooks: [
      "trades with the boatmen and hears every dock rumour",
      "swears the ferryman owes him a token",
    ],
    voice: "bright",
  },
  {
    id: "weaver",
    label: "a patient weaver",
    tends: "vendor",
    toneSeeds: ["patient", "proud of fine work", "soft-spoken", "precise"],
    quirkSeeds: [
      "hold a thread to the light to judge its colour",
      "teach one cloth word at a time",
      "hum while the loom clacks",
    ],
    tools: ["picture-match", "memory-pairs", "category-sort", "spot-typo"],
    pretexts: [
      "the colour labels fell off the skeins and got mixed",
      "the pattern names on the loom need matching to their cloth",
    ],
    topics: ["cloth", "thread", "colour", "weave", "huipil", "pattern", "loom"],
    names: ["Itzel", "Manuela", "Catalina", "Soledad", "Ximena"],
    hooks: [
      "weaves a sash said to bring safe passage on the road",
      "knows the tailor always needs one more spool",
    ],
    voice: "soft",
  },
  {
    id: "herbalist",
    label: "a gentle herbalist",
    tends: "either",
    toneSeeds: ["gentle", "knowing", "calm", "a little mysterious"],
    quirkSeeds: [
      "crush a leaf and ask you to name the smell",
      "speak in little remedies and proverbs",
      "keep dried bundles hanging from the cart",
    ],
    tools: ["picture-match", "odd-one-out", "memory-pairs", "true-false"],
    pretexts: [
      "the remedy jars lost their labels and must be sorted by smell",
      "two herbs look alike and one must be picked out",
    ],
    topics: ["herb", "remedy", "leaf", "tea", "garden", "cure", "smell"],
    names: ["Yamileth", "Don Remedio", "Esperanza", "Bruno", "Floriana"],
    hooks: [
      "brews a tonic for the seasick before they sail",
      "trades cures for stories of faraway towns",
    ],
    voice: "soft",
  },
  {
    id: "friar",
    label: "a kindly friar",
    tends: "npc_station",
    toneSeeds: ["kindly", "patient", "gently humorous", "unhurried"],
    quirkSeeds: [
      "bless every small effort",
      "quote a line of scripture, then wink",
      "tend the plaza's flowers between bells",
    ],
    tools: ["fill-the-blank", "dialogue-fill", "true-false", "build-sentence"],
    pretexts: [
      "a page of the day's reading smudged and a word is missing",
      "the hymn's last line is lost and needs filling in",
    ],
    topics: ["bell", "garden", "blessing", "prayer", "kindness", "patience"],
    names: ["Fray Anselmo", "Hermana Paz", "Fray Lucas", "Padre Tomás"],
    hooks: [
      "keeps the gate-keeper's confidence and knows the dawn schedule",
      "writes letters for those who cannot, and hears every secret",
    ],
    voice: "old",
  },
  {
    id: "sailor",
    label: "a sea-weathered sailor",
    tends: "either",
    toneSeeds: ["weathered", "full of tall tales", "easy-going", "salty"],
    quirkSeeds: [
      "point toward the horizon when naming places",
      "swear by the tide and the stars",
      "carry a satchel of trinkets from far ports",
    ],
    tools: ["listen-choose", "say-it-back", "build-sentence", "countdown-recall"],
    pretexts: [
      "a logbook page got wet and the port names ran together",
      "the rigging chant lost a word and needs filling",
    ],
    topics: ["sea", "port", "ship", "tide", "star", "voyage", "rope"],
    names: ["Capitán Remo", "Joaquín", "Vidal", "Selena", "Cosme"],
    hooks: [
      "once carried a ferry token clear to Guadalajara",
      "knows which dock the next boat leaves from",
    ],
    voice: "deep",
  },
  {
    id: "dockhand",
    label: "a sturdy dockhand",
    tends: "either",
    toneSeeds: ["gruff but fair", "tired and plain-spoken", "strong and steady", "no-nonsense"],
    quirkSeeds: [
      "count crates under your breath",
      "wipe your brow and sigh at the workload",
      "warm up once you trust someone",
    ],
    tools: ["number-drill", "countdown-recall", "word-search", "fast-translate"],
    pretexts: [
      "the cargo tally got smudged and needs recounting",
      "the crate labels fell in the water and must be matched again",
    ],
    topics: ["crate", "cargo", "rope", "dock", "load", "heavy", "tally"],
    names: ["Bartolo", "Gaspar", "Nico", "Ramón", "Quique"],
    hooks: [
      "decides whose crate goes on the next boat",
      "grumbles that the gatekeeper won't open before dawn",
    ],
    voice: "deep",
  },
  {
    id: "merchant",
    label: "a shrewd travelling merchant",
    tends: "vendor",
    toneSeeds: ["shrewd", "charming", "well-travelled", "quick with a deal"],
    quirkSeeds: [
      "drop the names of faraway cities",
      "haggle for sport, then give a fair price",
      "spread wares across a bright cloth",
    ],
    tools: ["fast-translate", "number-drill", "translate-fast", "category-sort"],
    pretexts: [
      "the price tags blew off the wares and need re-pairing",
      "two goods got swapped and the odd one must be spotted",
    ],
    topics: ["price", "trade", "silver", "goods", "bargain", "city", "road"],
    names: ["Don Próspero", "Valentina", "Casimiro", "Renata", "Severo"],
    hooks: [
      "sells maps of the road to Guadalajara",
      "always has a spare ferry token — for a price",
    ],
    voice: "bright",
  },
  {
    id: "musician",
    label: "a wandering musician",
    tends: "either",
    toneSeeds: ["lively", "playful", "lyrical", "head full of songs"],
    quirkSeeds: [
      "tap out a rhythm while you talk",
      "turn new words into a little rhyme",
      "tune a small guitar between sentences",
    ],
    tools: ["rhyme-match", "listen-choose", "say-it-back", "repeat-after"],
    pretexts: [
      "a verse fell apart and the rhyming words got scattered",
      "the song's matching sounds need pairing up again",
    ],
    topics: ["song", "rhyme", "rhythm", "dance", "tune", "verse", "fiesta"],
    names: ["Cancio", "Lira", "Melodía", "Tito", "Paloma", "Rumbo"],
    hooks: [
      "knows a song that names every town on the road",
      "trades a tune for news from travelers",
    ],
    voice: "young",
  },
  {
    id: "elder",
    label: "a wise plaza elder",
    tends: "npc_station",
    toneSeeds: ["wise", "unhurried", "fond of stories", "twinkle-eyed"],
    quirkSeeds: [
      "begin every answer with 'in my day…'",
      "remember names of long-gone travelers",
      "rest on a cane and watch the square",
    ],
    tools: ["dialogue-fill", "true-false", "memory-pairs", "countdown-recall"],
    pretexts: [
      "a half-remembered proverb is missing its ending",
      "an old story's order got jumbled and needs setting right",
    ],
    topics: ["memory", "story", "town", "long ago", "family", "wisdom"],
    names: ["Abuela Inés", "Don Eustaquio", "Doña Faustina", "Abuelo Cleto"],
    hooks: [
      "remembers the secret of the city gate at dawn",
      "knew the boatman's father — and his debts",
    ],
    voice: "old",
  },
  {
    id: "child",
    label: "a bright-eyed child",
    tends: "either",
    toneSeeds: ["bright", "curious", "giggly", "endlessly questioning"],
    quirkSeeds: [
      "ask 'why?' about everything",
      "want to race or play a game",
      "show off a found pebble or feather",
    ],
    tools: ["picture-match", "memory-pairs", "word-scramble", "odd-one-out"],
    pretexts: [
      "the picture cards got shuffled and need matching again",
      "a game's letters tumbled and want unscrambling",
    ],
    topics: ["play", "game", "colour", "animal", "friend", "toy", "fun"],
    names: ["Pepito", "Lucía", "Tonito", "Chela", "Memo", "Pili"],
    hooks: [
      "saw where the lost token rolled under a cart",
      "follows the musician around all day",
    ],
    voice: "young",
    weight: 2,
  },
  {
    id: "water-seller",
    label: "a tireless water-seller",
    tends: "vendor",
    toneSeeds: ["chatty", "ever-present", "good-natured", "quick on their feet"],
    quirkSeeds: [
      "ring a little bell to announce fresh water",
      "count coins twice, smiling",
      "know everyone's name in the square",
    ],
    tools: ["number-drill", "fast-translate", "listen-choose-pic", "tap-translation"],
    pretexts: [
      "the day's takings got muddled and need counting again",
      "the jug labels swapped and the prices need re-matching",
    ],
    topics: ["water", "jug", "coin", "price", "thirst", "fresh", "cool"],
    names: ["Aguador Lalo", "Chave", "Tonia", "Goyo", "Lupe"],
    hooks: [
      "hears every deal struck in the plaza",
      "knows who just bought passage on the ferry",
    ],
    voice: "bright",
  },
  {
    id: "scribe",
    label: "a meticulous scribe",
    tends: "npc_station",
    toneSeeds: ["meticulous", "bookish", "softly proud", "precise with words"],
    quirkSeeds: [
      "blow on wet ink before you read",
      "wince at a misspelled word",
      "keep a quill tucked behind the ear",
    ],
    tools: ["spot-typo", "fill-the-blank", "fill-blank", "build-sentence", "dialogue-fill"],
    pretexts: [
      "a copied page has a misspelled word that must be caught",
      "a blank was left in the letter and needs the right word",
    ],
    topics: ["letter", "ink", "word", "spelling", "scroll", "name", "sign"],
    names: ["Don Plácido", "Escriba Aldo", "Serafina", "Cándido", "Ofelia"],
    hooks: [
      "copied the very pass the gatekeeper demands",
      "keeps the ledger of who owes the ferryman",
    ],
    voice: "soft",
  },
  {
    id: "lamplighter",
    label: "a dusk-loving lamplighter",
    tends: "npc_station",
    toneSeeds: ["quiet", "dreamy", "watchful", "a little sleepy by day"],
    quirkSeeds: [
      "yawn and talk of the night ahead",
      "carry a long pole and a small flame",
      "know which corners stay dark",
    ],
    tools: ["odd-one-out", "memory-pairs", "listen-choose", "true-false"],
    pretexts: [
      "the lamp-route list got smudged and the stops need sorting",
      "one lantern among many is unlit and must be picked out",
    ],
    topics: ["lamp", "night", "flame", "dusk", "street", "shadow", "glow"],
    names: ["Faroles", "Nocturno", "Brígida", "Silvano", "Lumi"],
    hooks: [
      "sees who slips through the gate after dark",
      "knows the quiet path to the docks",
    ],
    voice: "soft",
    weight: 2,
  },
  {
    id: "flower-girl",
    label: "a cheerful flower-girl",
    tends: "vendor",
    toneSeeds: ["cheerful", "sweet", "sunny", "quick to laugh"],
    quirkSeeds: [
      "tuck a blossom behind your ear",
      "name flowers by their colours",
      "hum a market tune",
    ],
    tools: ["picture-match", "category-sort", "word-scramble", "rhyme-match"],
    pretexts: [
      "the flower names spilled and got jumbled in the basket",
      "the colours need sorting back into their right posies",
    ],
    topics: ["flower", "colour", "garden", "basket", "spring", "bloom", "sweet"],
    names: ["Florita", "Margarita", "Jacinta", "Amapola", "Rosita"],
    hooks: [
      "gives the friar his garden cuttings",
      "saw a traveler drop something shiny by the fountain",
    ],
    voice: "young",
  },
  {
    // RARE, never mean: a roguish-but-likeable smuggler. Sly demeanor leans here.
    id: "smuggler",
    label: "a roguish smuggler with a wink",
    tends: "either",
    toneSeeds: ["sly but likeable", "low-voiced", "playfully secretive", "quick-eyed"],
    quirkSeeds: [
      "glance over your shoulder before answering",
      "speak in hints and half-prices",
      "always seem to have what you need… for a favour",
    ],
    tools: ["fast-translate", "odd-one-out", "translate-fast", "countdown-recall"],
    pretexts: [
      "a 'manifest' got scrambled on purpose and only a clever traveler can read it",
      "a code word is hidden among decoys and must be spotted",
    ],
    topics: ["secret", "deal", "token", "passage", "hush", "favour", "night"],
    names: ["El Zorro", "Tuerto", "La Sombra", "Garra", "Mecha"],
    hooks: [
      "can get you a ferry token — no questions, small favour",
      "knows a way past the city gate that the friar won't mention",
    ],
    voice: "sly",
    weight: 1,
  },
]

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
    greet: ["¡Buenos días, viajero! ¿Un pan dulce?", "Bienvenido. Huele a pan recién hecho, ¿verdad?"],
    teach: ['Esto se llama "{topic}". Repite conmigo: {topic}.', "Prueba un poco. ¿Cómo se dice en tu tierra?"],
    bye: ["¡Vuelve cuando quieras, con hambre!"],
  },
  fishmonger: {
    greet: ["¡Pescado fresco! ¿Qué te llevas hoy?", "¡Eh, viajero! Mira esta belleza del mar."],
    teach: ['"{topic}" — repite, que el precio es justo.', "¿Cuánto crees que cuesta? ¡Adivina!"],
    bye: ["¡Anda con bien, y vuelve con hambre de mar!"],
  },
  scribe: {
    greet: ["Un momento, que la tinta está fresca. Bienvenido.", "¿Una carta? ¿Un nombre bien escrito?"],
    teach: ['Mira esta palabra: "{topic}". ¿La escribes bien?', "Cuidado con la ortografía, amigo."],
    bye: ["Que tus palabras viajen lejos. Hasta pronto."],
  },
  musician: {
    greet: ["¡Ay, llega quien me falta para la canción!", "Siéntate, que tengo una rima para ti."],
    teach: ['"{topic}"… ¿con qué rima? ¡Cántalo!', "Repite el ritmo: la-la, {topic}."],
    bye: ["¡Que la música te acompañe en el camino!"],
  },
  friar: {
    greet: ["La paz contigo, viajero.", "Bienvenido al amparo de la plaza."],
    teach: ['Una palabra para el alma: "{topic}".', "Despacio, que el que aprende también reza."],
    bye: ["Ve con bien. Las campanas te guarden."],
  },
}

/** Generic, language-neutral fallback (used for non-Spanish scenes). */
const NEUTRAL_FALLBACK: FallbackPack = {
  greet: ["Welcome, traveler! Stay a while.", "Hello there — what brings you to the plaza?"],
  teach: ['Here, a word for you: "{topic}". Try saying it.', "Let us practice together, slowly."],
  bye: ["Safe travels, friend. Come back soon."],
}

/** Which teaching language does this scene primarily use, for fallback flavour. */
function fallbackLangOf(scene: Scene): "es" | "neutral" {
  // The Antigua scenes teach Spanish; recognise by palette/era rather than a
  // hard scene-id list so new colonial scenes inherit it. Cheap + safe default.
  const era = scene.setting.era.toLowerCase()
  const place = scene.setting.place.toLowerCase()
  if (era.includes("177") || place.includes("antigua") || place.includes("guadalajara")) return "es"
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
    teach: ['Aprende esta palabra: "{topic}". Repite conmigo.', "¿Cómo se dice en tu idioma?"],
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
  /** human label ("a warm-hearted baker") used in the system prompt. */
  archetypeLabel: string
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
}

/* ------------------------------------------------- demeanor → archetype lean */

/**
 * Gently bias archetype choice by demeanor so the FACE and the PERSONA agree
 * (a gruff face → more likely a dockhand/fishmonger; a sleepy face → lamplighter;
 * a sly face → smuggler/merchant). This is a soft re-roll, not a hard rule, so
 * variety stays huge.
 */
const DEMEANOR_LEAN: Partial<Record<Demeanor, readonly string[]>> = {
  gruff: ["dockhand", "fishmonger", "merchant", "sailor"],
  sleepy: ["lamplighter", "elder", "herbalist"],
  shy: ["weaver", "scribe", "flower-girl", "child"],
  cheery: ["baker", "flower-girl", "water-seller", "musician"],
  sly: ["smuggler", "merchant"],
  friendly: ["baker", "friar", "merchant", "musician", "elder"],
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

  const arch = chooseArchetype(r, tends, demeanor)
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

  return {
    id,
    anchorId,
    basePersona: { tone, quirks },
    scriptedFallback,
    // ---- enrichment (additive; runtime ignores these) ----
    archetype: arch.id,
    archetypeLabel: arch.label,
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
