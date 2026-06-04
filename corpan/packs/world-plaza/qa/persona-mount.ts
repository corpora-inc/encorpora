/**
 * Standalone mount for the PERSONA system (no 2.4 GB model).
 *
 * 1. Generates ~40 townsfolk personas exactly the way the crowd does
 *    (generateCharacter → demeanor → generatePersona), computes the
 *    archetype/demeanor distribution, and exposes it on `window.__wpPersona`.
 * 2. Opens real dialogue panels for two DISTINCT archetypes using the mock host,
 *    each fed turns flavoured by THAT persona (its own opening line + a contrived
 *    challenge tool-call drawn from its OWN whitelist) — proving different
 *    in-character openings and fitting challenges per character.
 * 3. Verifies the compiled system prompt (composeSystemPrompt) carries the
 *    persona, the challenge-pretext lean, the trade tools, and the quest clue.
 */

import { Quest, Scene, type NpcIntent } from "@world-plaza/contracts"
import questJson from "../content/quests/es-cafe.json"
import sceneJson from "../content/scenes/antigua-1770.json"
import { createNpcRuntime, type NpcDialogueHandle } from "../src/npc/npcRuntime"
import { createMockHost } from "../src/npc/mockHost"
import { generateCharacter, ANTIGUA_1770 } from "../src/character/characterGen"
import { generatePersona, archetypeIds, type GeneratedPersona } from "../src/npc/personaGen"
import { composeSystemPrompt } from "../src/npc/promptProgram"

const quest = Quest.parse(questJson)
const scene = Scene.parse(sceneJson)
const learnerPair = { target: "es", native: "en" }
const stage = document.getElementById("wp-stage")!

/* -------------------------------------------------- 1. generate 40 personas */

type Row = {
  seed: string
  archetype: string
  demeanor: string
  name: string
  tone: string
  tools: string[]
  hook: string
  greet: string
}

const N = 40
const personas: GeneratedPersona[] = []
const rows: Row[] = []
// alternate the tend kind like the crowd does over vendor/npc_station anchors
const tends: Array<"vendor" | "npc_station"> = ["vendor", "npc_station"]
for (let i = 0; i < N; i++) {
  const seed = `antigua:crowd:${i}`
  const spec = generateCharacter("crowd", seed, ANTIGUA_1770)
  const p = generatePersona(seed, { scene, spec, tends: tends[i % 2] })
  personas.push(p)
  rows.push({
    seed,
    archetype: p.archetype,
    demeanor: p.demeanor,
    name: p.name,
    tone: p.basePersona.tone,
    tools: p.challengeTools,
    hook: p.backstoryHook,
    greet: p.scriptedFallback[0]?.text ?? "",
  })
}

const dist = (key: "archetype" | "demeanor") => {
  const c: Record<string, number> = {}
  for (const r of rows) c[r[key]] = (c[r[key]] ?? 0) + 1
  return c
}

/* ------------------------------------- 2. two DISTINCT archetype conversations */

const runtime = createNpcRuntime(createMockHost())

/** Pick the first persona of a given archetype (or any if absent). */
function personaOf(archetype: string): GeneratedPersona {
  return personas.find((p) => p.archetype === archetype) ?? personas[0]
}

const intents: Record<string, NpcIntent[]> = {}
const handles: NpcDialogueHandle[] = []

/** Build archetype-flavoured mock turns: an in-character opening + a contrived
 *  challenge using the persona's OWN first whitelisted tool + a clue whisper. */
function turnsFor(p: GeneratedPersona): string[] {
  const tool = p.challengeTools[0]
  const topic = p.topics[0] ?? "café"
  const pretext = p.pretexts[0] ?? "my words got all scrambled"
  return [
    `¡Hola! Soy ${p.name}. ${capitalize(p.archetypeLabel)} a tu servicio. (in character)`,
    `Oye… ${pretext}. ¿Me ayudas con "${topic}"?\n` +
      `<<tool>{"kind":"callTool","tool":"${tool}","spec":{"word":"${topic}"}}</tool>>`,
  ]
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function openPersona(p: GeneratedPersona, container: HTMLElement): void {
  // Use a per-persona mock host so each renders its own flavoured turns.
  const host = createMockHost({ scriptedTurns: turnsFor(p) })
  const rt = createNpcRuntime(host)
  intents[p.archetype] = []
  const h = rt.open({
    npcRole: p,
    scene,
    quest,
    learnerPair,
    container,
    npcName: p.name,
    onIntent: (i) => intents[p.archetype].push(i),
  })
  handles.push(h)
}

// Two visibly different archetypes (fall back gracefully if seed didn't yield them).
const want = ["baker", "scribe", "musician", "fishmonger"].filter((a) =>
  personas.some((p) => p.archetype === a),
)
const pickA = want[0] ?? personas[0].archetype
const pickB = want.find((a) => a !== pickA) ?? archetypeIds()[1]

// Mount the FIRST conversation visibly on the stage now; the harness can switch.
openPersona(personaOf(pickA), stage)

/* --------------------------------------- 3. system-prompt verification probe */

function promptProbe(p: GeneratedPersona): string {
  return composeSystemPrompt({
    npcRole: p,
    scene,
    quest,
    learnerPair,
    clues: [
      "The boatman won't even look up: 'No token, no crossing. Ask around the market.'",
    ],
  })
}

/* -------------------------------------------------- QA observability hooks */

;(window as unknown as Record<string, unknown>).__wpPersona = {
  count: N,
  archetypeIds: archetypeIds(),
  rows,
  distArchetype: dist("archetype"),
  distDemeanor: dist("demeanor"),
  pickA,
  pickB,
  // open the SECOND archetype's conversation (harness calls then screenshots)
  openSecond: () => {
    for (const h of handles) h.close()
    handles.length = 0
    stage.querySelectorAll(".wp-npc-root, .wp-npc-panel").forEach((el) => el.remove())
    openPersona(personaOf(pickB), stage)
  },
  // the compiled system prompts for the two demo personas (string introspection)
  promptA: () => promptProbe(personaOf(pickA)),
  promptB: () => promptProbe(personaOf(pickB)),
  bubbles: () =>
    Array.from(document.querySelectorAll(".wp-npc-msg")).map((el) => el.textContent ?? ""),
  toolCards: () =>
    Array.from(document.querySelectorAll(".wp-npc-toolcard")).map((el) => el.textContent ?? ""),
  intents: () => JSON.parse(JSON.stringify(intents)),
}

void runtime // keep reference; silences unused in some configs
