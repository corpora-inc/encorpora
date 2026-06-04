/**
 * compose.ts — generate the FULL generation matrix of system prompts using the
 * REAL World Plaza prompt machinery (`composeSystemPrompt`, `generatePersona`,
 * `selectMood`), plus the PROMPT-VARIANTS we A/B/n.
 *
 * This file is bundled by esbuild (`scripts/bundle.mjs`) and run with `node` to
 * emit `out/cells.json` — one record per (persona × mood × stepState ×
 * queuedChallenge × variant) cell, carrying the composed system prompt and the
 * metadata the Python runner/judge/stats need. The multi-turn PLAYER SCRIPTS
 * live here too so the whole matrix is one artifact.
 *
 * IMPORTANT: variants are expressed as either (a) different ComposeArgs fed to
 * the REAL composer, or (b) a post-process on the composed string. Both keep the
 * study honest: every prompt we score is one we could actually ship. The
 * recommended changes in docs/NPC_PROMPT_STUDY.md map 1:1 to these variants.
 */

import {
  composeSystemPrompt,
  selectMood,
  MOOD_BEATS,
  type ComposeArgs,
  type QuestFacts,
} from "../../src/npc/promptProgram"
import { generatePersona } from "../../src/npc/personaGen"
import type {
  NpcRole,
  Scene,
  Quest,
  LearnerPair,
} from "@world-plaza/contracts"
import type { CharacterSpec, Demeanor } from "../../src/character/characterSpec"

// ---------------------------------------------------------------- fixtures ----

const SCENE: Scene = {
  id: "antigua-1770",
  topologyId: "plaza-sq-a",
  setting: { place: "Antigua", era: "1770", mood: "warm colonial morning" },
  themeId: "paper",
  narrativeBlurb:
    "Cobblestones still wet with dew; a café opens its shutters and a bell rings.",
  anchorSkins: {},
  npcSkins: {
    cafe_counter: { spriteRef: { url: "placeholder:npc-baker" }, voiceHint: "es-ES" },
  },
  palette: { ground: "#d9c7a3", sky: "#bfe0e8", accent: "#c46b4a" },
} as unknown as Scene

// The MVP quest (item-chain authored). es→en, beginner, travel.
const QUEST: Quest = {
  id: "es-guadalajara-route",
  title: "The Road to Guadalajara",
  narrative: "Antigua → Guadalajara",
  learnerPair: { target: "es", native: "en" },
  domain: "travel",
  objective: { kind: "completeDialogues", count: 3 },
  steps: [
    { id: "docks", label: "Cross at the docks", anchorId: "docks" },
    { id: "gate", label: "Pass the city gate", anchorId: "city_gate" },
  ],
  promptProgram: {
    personaTemplate:
      "{persona} You are teaching a learner whose goal is to {objective}. Today's theme is {domain}. Teach {target} to a {native} speaker at a {scaffold} level: keep the learner moving toward the docks, naming travel words, and being polite.",
    scaffold: "beginner",
    ragSources: ["base-travel"],
    contentSelector: { levels: ["A1", "A2"], domains: ["travel"], languageCodes: ["es"] },
    toolWhitelist: ["word-scramble", "fast-translate", "picture-match", "number-drill"],
  },
  rewards: { xp: 50, coins: 10 },
} as unknown as Quest

const PAIR: LearnerPair = { target: "es", native: "en" }
// Single-language (immersion) pair, to exercise that branch of the composer.
const PAIR_IMMERSION: LearnerPair = { target: "es", native: "es" }

/** Build a CharacterSpec stub with a given demeanor (only `.demeanor` is read). */
function spec(demeanor: Demeanor): CharacterSpec {
  return { demeanor } as unknown as CharacterSpec
}

// A small, deliberately varied persona panel (archetype × demeanor), built via
// the REAL generator so personas are exactly what ships. The seed pins them.
const PERSONA_SEEDS: { seed: string; demeanor: Demeanor; tends: "vendor" | "npc_station" }[] = [
  { seed: "baker-1", demeanor: "cheery", tends: "vendor" },
  { seed: "scribe-1", demeanor: "shy", tends: "npc_station" },
  { seed: "fishmonger-1", demeanor: "gruff", tends: "vendor" },
  { seed: "elder-1", demeanor: "sleepy", tends: "npc_station" },
  { seed: "musician-1", demeanor: "friendly", tends: "either" as "vendor" },
  { seed: "merchant-1", demeanor: "sly", tends: "vendor" },
]

function buildPersona(p: (typeof PERSONA_SEEDS)[number]): NpcRole {
  return generatePersona(p.seed, {
    scene: SCENE,
    spec: spec(p.demeanor),
    tends: p.tends,
  }) as NpcRole
}

// QuestFacts for the SPECIAL-NPC (boatman at the docks) — the screenshot context.
const QUEST_FACTS_NEEDS: QuestFacts = {
  npcName: "Bartolo",
  npcRoleLabel: "the boatman at the docks",
  stepLabel: "Cross at the docks",
  stepState: "needs-item",
  neededItemLabel: "the ferry token",
  authoredClue: "No token, no crossing — ask around the market, someone always has a spare.",
  target: "Spanish",
  native: "English",
  maxSentences: 2,
}

// ----------------------------------------------------------- player scripts ----

/**
 * Multi-turn PLAYER scripts. Repetition + fixation are multi-turn phenomena, so
 * we drive several turns. The "probe" script directly reproduces the screenshot:
 * the player asks vague follow-ups that tempt the model to re-explain one word.
 */
export type PlayerScript = { id: string; lines: string[] }

const SCRIPTS: PlayerScript[] = [
  {
    // The screenshot reproduction: vague, looping follow-ups.
    id: "probe-loop",
    lines: ["Travel?", "Palabra?", "which one?", "and then?", "again?"],
  },
  {
    // A cooperative learner who actually progresses.
    id: "progressive",
    lines: [
      "Hola, ¿cómo estás?",
      "How do I order coffee?",
      "What else can I say?",
      "Can you teach me a number?",
      "Thank you, goodbye.",
    ],
  },
  {
    // A terse learner — one-word prods, stress-tests brevity + non-repetition.
    id: "terse",
    lines: ["¿Qué?", "más", "otra", "y?", "sí"],
  },
]

// ------------------------------------------------------------------ variants ----

/**
 * A PROMPT VARIANT is a named transform over (ComposeArgs → systemPrompt). Some
 * change the args fed to the REAL composer; some post-process the string; some
 * also flag a per-TURN behaviour (e.g. inject the last-N NPC lines as
 * anti-repetition context, or drop the segue after turn 0) that the Python
 * runner applies. We emit BOTH the base system prompt AND the per-turn policy.
 */
export type TurnPolicy = {
  /** Append the segue/challenge invite only on turn 0 (segue-once), not every turn. */
  segueOnce?: boolean
  /**
   * Before each model turn, inject a short anti-repetition reminder that quotes
   * the NPC's own last N lines and says "don't repeat yourself; move the topic on".
   * 0 = off. The runner builds the reminder from the live transcript.
   */
  antiRepeatLastN?: number
  /** Temperature override for this variant (else the matrix default sweep). */
  temperature?: number
}

export type Variant = {
  id: string
  /** Human description (goes into the report). */
  desc: string
  /** Build the ComposeArgs for this variant from the base args. */
  args: (base: ComposeArgs) => ComposeArgs
  /** Optional post-process of the composed system prompt string. */
  post?: (prompt: string) => string
  /** Per-turn runner policy. */
  policy?: TurnPolicy
}

/** A tiny RAG block: a handful of on-topic corpus phrases the NPC may weave in.
 *  Stand-in for a real host-corpus lookup (levels+domains) — content is real
 *  A1/A2 travel Spanish so the grounding signal is honest. */
const RAG_PHRASES = [
  "el ferry (the ferry)",
  "el muelle (the dock)",
  "¿cuánto cuesta? (how much is it?)",
  "el boleto (the ticket)",
  "¡buen viaje! (have a good trip!)",
]
function ragSection(): string {
  return (
    "CORPUS (you may weave ONE of these real travel phrases in naturally, never list them):\n" +
    RAG_PHRASES.map((p) => `  • ${p}`).join("\n")
  )
}

const VARIANTS: Variant[] = [
  // ----- BASELINE: exactly the shipping prompt + the shipping bug (segue stays
  // in the system prompt every turn because the runtime composes once). -----
  {
    id: "baseline",
    desc: "Current shipping prompt; challenge segue present in system prompt every turn (reproduces the verbatim-invite repeat).",
    args: (b) => b,
  },

  // ----- V1: SEGUE-ONCE. The segue/challenge invite fires only on turn 0. -----
  {
    id: "segue-once",
    desc: "Challenge invite injected only on the opening turn (turn 0); dropped from the system prompt thereafter.",
    args: (b) => b,
    policy: { segueOnce: true },
  },

  // ----- V2: ANTI-REPETITION CONTEXT INJECTION (last 2 NPC lines + 'move on'). -
  {
    id: "anti-repeat-2",
    desc: "Before each turn, inject the NPC's last 2 lines + an explicit 'do not repeat yourself; move the topic forward' reminder.",
    args: (b) => b,
    policy: { antiRepeatLastN: 2 },
  },

  // ----- V3: SEGUE-ONCE + ANTI-REPETITION (the combined fix). -----
  {
    id: "segue-once+anti-repeat",
    desc: "Combined: segue fires once, AND last-2 anti-repetition reminder each turn.",
    args: (b) => b,
    policy: { segueOnce: true, antiRepeatLastN: 2 },
  },

  // ----- V4: ADD AN EXPLICIT NON-REPETITION RAIL to the system prompt. -----
  {
    id: "rail-no-repeat",
    desc: "Add one rail clause: 'never repeat a sentence you already said; each turn say something new and move forward'.",
    args: (b) => b,
    post: (p) =>
      p.replace(
        "do not list or ramble.",
        "do not list or ramble · NEVER repeat a sentence you already said · each turn say something NEW and move the conversation forward.",
      ),
  },

  // ----- V5: STRONGER MOOD (mood beat placed at the TOP, emphasized). -----
  {
    id: "mood-strong",
    desc: "Move the rotating mood beat to the very top of the prompt and emphasize it ('Play this strongly:').",
    args: (b) => ({ ...b, mood: b.mood }),
    post: (p) => {
      // Pull the "Right now you are X." line to the top, emphasized.
      const m = p.match(/Right now you are [^\n]+/)
      if (!m) return p
      const without = p.replace(m[0] + "\n", "").replace(m[0], "")
      return `Play this mood strongly in every line: ${m[0]}\n${without}`
    },
  },

  // ----- V6: RAG grounding (real corpus travel phrases offered). -----
  {
    id: "rag",
    desc: "Inject a small CORPUS block of real on-topic A1/A2 travel phrases the NPC may weave in (grounding without changing rails).",
    args: (b) => b,
    post: (p) => p + "\n" + ragSection(),
  },

  // ----- V7: RAG + segue-once + anti-repeat (the 'everything that helps' combo). -
  {
    id: "rag+segue-once+anti-repeat",
    desc: "RAG grounding + segue-once + last-2 anti-repetition (the kitchen-sink candidate).",
    args: (b) => b,
    post: (p) => p + "\n" + ragSection(),
    policy: { segueOnce: true, antiRepeatLastN: 2 },
  },

  // ----- V8: HIGHER PERSONA SPECIFICITY (favor the persona's backstory hook). --
  {
    id: "persona-rich",
    desc: "Append the persona's backstory hook + a 'lean on your own character/trade' nudge for more characterful variety.",
    args: (b) => b,
    post: (p) => {
      return p + "\nLean on your own trade and little quirks; let your character colour every reply."
    },
  },
]

// --------------------------------------------------------------- temperatures --

// Temperature sweep. On-device default (runtime) is 0.6; the plugin default is
// 0.55. We sweep around it to map the creativity↔cohesion frontier.
const TEMPS = [0.3, 0.6, 0.9]

// Which variants × which step contexts. We run the SPECIAL (questFacts) context
// AND the generic (queuedChallenge) context — the screenshot is the special one,
// but the segue bug lives on the generic path. We cover both.
type CtxKind = "generic-challenge" | "special-needs-item" | "immersion"

// ------------------------------------------------------------------- emit ------

type Cell = {
  cellId: string
  variantId: string
  variantDesc: string
  ctx: CtxKind
  personaSeed: string
  archetype: string
  demeanor: string
  mood: string
  moodIndex: number
  scriptId: string
  scriptLines: string[]
  temperature: number
  systemPrompt: string
  policy: TurnPolicy
  // For repeat-visit analysis: same persona+script run across N visits with
  // rotating mood. visitMoods is the mood for each simulated visit.
  visitMoods: string[]
}

function baseArgsFor(ctx: CtxKind, role: NpcRole, mood: string): ComposeArgs {
  if (ctx === "special-needs-item") {
    return {
      npcRole: role,
      scene: SCENE,
      quest: QUEST,
      learnerPair: PAIR,
      mood,
      questFacts: QUEST_FACTS_NEEDS,
      clues: [QUEST_FACTS_NEEDS.authoredClue!],
    }
  }
  if (ctx === "immersion") {
    return {
      npcRole: role,
      scene: SCENE,
      quest: QUEST,
      learnerPair: PAIR_IMMERSION,
      mood,
    }
  }
  // generic-challenge: CHANGE 1 decoupled the challenge segue from the prompt — the
  // model is no longer told about challenges (the segue is a deterministic runtime
  // line now). This context is retained for the free-conversation baseline; it no
  // longer injects any challenge instruction.
  return {
    npcRole: role,
    scene: SCENE,
    quest: QUEST,
    learnerPair: PAIR,
    mood,
  }
}

function main() {
  const cells: Cell[] = []
  const ctxs: CtxKind[] = ["generic-challenge", "special-needs-item", "immersion"]

  for (const pseed of PERSONA_SEEDS) {
    const role = buildPersona(pseed)
    const archetype = (role as unknown as { archetype?: string }).archetype ?? "?"
    for (const ctx of ctxs) {
      for (const script of SCRIPTS) {
        for (const variant of VARIANTS) {
          for (const temp of TEMPS) {
            // visit 0 mood (deterministic, exactly as runtime selects it).
            const visit = 0
            const mood = selectMood(role.id, visit)
            const moodIndex = MOOD_BEATS.indexOf(mood)
            const baseArgs = baseArgsFor(ctx, role, mood)
            let prompt = composeSystemPrompt(variant.args(baseArgs))
            if (variant.post) prompt = variant.post(prompt)
            // 3 simulated repeat-visits for cross-visit repetition analysis.
            const visitMoods = [0, 1, 2].map((v) => selectMood(role.id, v))
            cells.push({
              cellId: `${variant.id}|${ctx}|${pseed.seed}|${script.id}|t${temp}`,
              variantId: variant.id,
              variantDesc: variant.desc,
              ctx,
              personaSeed: pseed.seed,
              archetype,
              demeanor: pseed.demeanor,
              mood,
              moodIndex,
              scriptId: script.id,
              scriptLines: script.lines,
              temperature: temp,
              systemPrompt: prompt,
              policy: variant.policy ?? {},
              visitMoods,
            })
          }
        }
      }
    }
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    model: "llm-base-qwen3-4b-v1 (Qwen3-4B GGUF, on-device shipped)",
    notes:
      "System prompts composed via the REAL composeSystemPrompt. ChatML + sampler must match the corpan-llm plugin: penalties(last_n=64,repeat), top_k=40, top_p=0.9, temp, dist(seed); ctx=4096; AddBos always.",
    variants: VARIANTS.map((v) => ({ id: v.id, desc: v.desc, policy: v.policy ?? {} })),
    scripts: SCRIPTS,
    temperatures: TEMPS,
    cellCount: cells.length,
    cells,
  }
  process.stdout.write(JSON.stringify(manifest, null, 2))
}

main()
