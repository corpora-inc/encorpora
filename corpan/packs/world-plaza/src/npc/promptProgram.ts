/**
 * promptProgram — compile a Quest's `promptProgram` × NpcRole × Scene ×
 * LearnerPair into the Qwen3 system prompt, and define the JS-side tool-call
 * protocol (the corpan-llm plugin is TEXT-ONLY — there is no native tool
 * calling, so the NPC emits a parseable block we split out of the stream).
 *
 * Protocol: the model speaks natural in-character prose, then OPTIONALLY ends
 * its turn with a single fenced control block:
 *
 *     <<tool>{"kind":"callTool","tool":"speed-drill","spec":{...}}</tool>>
 *
 * The JSON inside is exactly an `NpcIntent` (the discriminated union from the
 * contracts). `splitToolBlock` separates spoken prose (streamed to the UI) from
 * the raw block; `parseNpcIntent` validates it against the Zod schema. We use a
 * stop-sequence-friendly opener so streaming can hide the block the instant the
 * opener appears, and never speak/TTS the control JSON.
 */

import {
  NpcIntent,
  parseNpcIntent,
  type NpcRole,
  type Quest,
  type Scene,
  type LearnerPair,
  type ChallengeToolId,
} from "@world-plaza/contracts"
import { segueChipLabel, resolveSegue } from "./challengeSegues"
import { targetLanguageDirective } from "./promptLocale"

/**
 * The optional persona-enrichment a `GeneratedPersona` (from personaGen) carries
 * ON TOP of the plain `NpcRole`. The prompt program reads these when present so a
 * generated baker/scribe/musician stays in character, teaches their trade's
 * words, and contrives a FITTING challenge — without coupling to personaGen's
 * concrete type (we read the shape structurally so plain authored roles still
 * work, just with less flavour).
 */
type PersonaEnrichment = {
  archetypeLabel?: string
  name?: string
  challengeTools?: readonly ChallengeToolId[]
  pretexts?: readonly string[]
  topics?: readonly string[]
  backstoryHook?: string
}

/** Read the (optional) generated-persona enrichment off an NpcRole, safely. */
export function enrichmentOf(role: NpcRole): PersonaEnrichment {
  return role as NpcRole & PersonaEnrichment
}

/** The control-block delimiters. Kept terse + unusual so they never collide
 *  with normal prose, and the opener doubles as the streaming hide-trigger. */
export const TOOL_OPEN = "<<tool>"
export const TOOL_CLOSE = "</tool>>"

/** A good `stop` sequence for the LLM options — ends generation right after the
 *  block closes so we don't pay for trailing tokens. (The opener is NOT a stop;
 *  we want the whole block.) */
export const TOOL_STOP_SEQUENCES = [TOOL_CLOSE]

/** Human-readable language names for the prompt. Minimal + localization-ready:
 *  the prompt names languages by code when we don't have a friendly label, which
 *  is fine for the model. Extend as needed; never block on a missing entry. */
const LANG_NAME: Record<string, string> = {
  en: "English",
  es: "Spanish",
  "pt-BR": "Brazilian Portuguese",
  "pt-PT": "European Portuguese",
  fr: "French",
  de: "German",
  it: "Italian",
  ja: "Japanese",
  "ko-polite": "Korean",
  "zh-Hans": "Mandarin Chinese",
  ru: "Russian",
}

export function languageName(code: string): string {
  return LANG_NAME[code] ?? code
}

/** Fill the quest's `personaTemplate` slots. Unknown slots are left intact so a
 *  template author sees the literal `{slot}` rather than silent emptiness. */
function fillTemplate(template: string, slots: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (m, key: string) =>
    key in slots ? slots[key] : m,
  )
}

/**
 * Deterministic FACTS the engine injects for a SPECIAL (quest-bound) NPC
 * (COHESION_ITERATION §7.2). The model receives a single authored line to
 * RE-VOICE in character + target language, plus the hard branch + caps — it
 * cannot wander because the beat is pre-decided by the engine, not the model.
 */
export type QuestFacts = {
  /** The NPC's name ("Serafina"). */
  npcName: string
  /** A short role label ("the café scribe"). */
  npcRoleLabel: string
  /** The traveler's current task ("Cross at the docks"). */
  stepLabel: string
  /** Which deterministic branch the model must speak this turn. */
  stepState: "needs-item" | "ready-to-deliver" | "done"
  /** The item the player still needs ("the ferry token"), when needs-item. */
  neededItemLabel?: string
  /** Verbatim authored line to RE-VOICE as a hint (needs-item). */
  authoredClue?: string
  /** Verbatim authored line to RE-VOICE onward (ready-to-deliver / done). */
  authoredNextHint?: string
  /** Friendly target language name ("Spanish"). */
  target: string
  /** Friendly native language name ("English"). */
  native: string
  /** Hard sentence cap for the turn (default 2). */
  maxSentences: number
}

export type ComposeArgs = {
  npcRole: NpcRole
  scene: Scene
  quest: Quest
  learnerPair: LearnerPair
  /**
   * In-character quest clues to LEAN toward revealing (from
   * `economy/questItems.cluesFor(store, questId, stepId)` — only the clues for
   * pieces the player does NOT yet hold). The NPC is told it MAY drop one of
   * these in character, as a hint, never as a hand-over. Optional: when absent or
   * empty, the NPC simply teaches + plays without a quest nudge.
   */
  clues?: readonly string[]
  /**
   * Deterministic FACTS for a SPECIAL quest-bound NPC (§7.2). When present, a
   * tight, branchy FACTS block is prepended and the NPC is told to re-voice the
   * ONE authored line for the current `stepState`. ADDITIVE: a normal NPC with no
   * `questFacts` composes EXACTLY as before (regression-guarded).
   */
  questFacts?: QuestFacts
  /**
   * A rotating MOOD/BEAT for THIS conversation (from `selectMood(npcId, visit)`).
   * One short clause that colours the persona so the same NPC feels different
   * across visits. Optional: when absent, the prompt omits the mood line.
   */
  mood?: string
}

/**
 * Decide which challenge tools THIS NPC may spring. The persona's own
 * `challengeTools` (a baker → market-word scrambles; a scribe → typo/fill-blank)
 * are the character's repertoire; we intersect with the quest's `toolWhitelist`
 * so a quest can still constrain the toolbox. If the intersection is empty (the
 * persona's trade and the quest don't overlap) we prefer the PERSONA's tools —
 * keeping every character able to play to their nature — and only fall back to
 * the quest's list when the persona has none.
 */
export function resolveToolWhitelist(
  personaTools: readonly ChallengeToolId[] | undefined,
  questTools: readonly ChallengeToolId[],
): ChallengeToolId[] {
  const persona = personaTools ?? []
  if (persona.length === 0) return [...questTools]
  if (questTools.length === 0) return [...persona]
  const inter = persona.filter((t) => questTools.includes(t))
  return inter.length ? inter : [...persona]
}

/** Tiny stable hash (FNV-1a) → 32-bit, for deterministic offer selection. */
function hashStr(s: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/* ----------------------------------------------------------------- mood ---- *
 * A small model gets MORE character from a sharp seed + a rotating BEAT than
 * from a long, vague prompt. We inject ONE mood per conversation, chosen
 * DETERMINISTICALLY from the NPC seed + a visit counter, from a small set. The
 * SAME npc feels different across visits → pleasant surprise with ZERO model
 * improvisation. ~10 tokens.
 * --------------------------------------------------------------------------- */

/** The mood beats. Short imperative colour the model overlays on its persona. */
export const MOOD_BEATS: readonly string[] = [
  "delighted to see them — beaming",
  "a little drowsy, speaking softly",
  "in a gossipy, confiding mood",
  "rushed, with somewhere to be",
  "feeling nostalgic about old days",
  "quietly proud of their work today",
  "playful and a touch mischievous",
  "warm and unhurried, savoring the moment",
] as const

/**
 * Pick the mood for a conversation DETERMINISTICALLY from the NPC's id + the
 * visit counter. Same (id, visit) → same mood, forever; consecutive visits step
 * to a different beat so the character surprises across visits without the model
 * inventing anything.
 */
export function selectMood(npcId: string, visit = 0): string {
  const base = hashStr(`mood|${npcId}`)
  return MOOD_BEATS[(base + Math.max(0, visit)) % MOOD_BEATS.length]
}

/**
 * The PERSONA SEED — one sharp clause: name + role + ONE vivid quirk. Specificity
 * (not length) is what gives a 4B model character. We read the generated-persona
 * enrichment (name/label/first-quirk) and the scene so it lands in the world.
 * ~25 tokens. Falls back gracefully for a plain authored role.
 */
export function personaSeed(role: NpcRole, scene: Scene): string {
  const e = enrichmentOf(role)
  const who = e.name
    ? `${e.name}, ${e.archetypeLabel ?? "a townsperson"}`
    : e.archetypeLabel
      ? e.archetypeLabel
      : `a townsperson of the "${role.id}" spot`
  const quirk = role.basePersona.quirks[0]
  const quirkClause = quirk ? `; you ${quirk}` : ""
  return `You are ${who} in ${scene.setting.place}${quirkClause}.`
}

/**
 * A deterministic, in-character game offer for an NPC. This is the BACKBONE of
 * the reliable "Play a game" affordance: it does NOT depend on the LLM emitting a
 * `<<tool>>` block. We resolve the NPC's challenge whitelist (persona ∩ quest, the
 * SAME rule the system prompt uses) and pick one tool deterministically from the
 * NPC's id + a turn index, so the same NPC always offers the same first game
 * (stable across reloads) yet "play another" rotates to a fresh one.
 */
export type GameOffer = {
  /** The tool the chip will launch (always from the resolved whitelist). */
  tool: ChallengeToolId
  /**
   * A SHORT TARGET-LANGUAGE segue phrase for the NO-LLM fallback path (the model
   * path weaves its own one-clause invite). REPLACES the old English `pretext`
   * that was being spoken by the target-language TTS voice — the bug we killed.
   */
  segue: string
  /** A short TARGET-LANGUAGE label for the Play chip ("Jugar", "Leer"). */
  chipLabel: string
}

/** Resolve THIS NPC's offerable tools (persona ∩ quest), persona-preferred. */
export function offerableTools(npcRole: NpcRole, quest: Quest): ChallengeToolId[] {
  const e = enrichmentOf(npcRole)
  return resolveToolWhitelist(e.challengeTools, quest.promptProgram.toolWhitelist)
}

/**
 * Deterministically choose the NPC's game offer for a given turn. `turn` rotates
 * the tool (and the pretext) so successive "play another" offers vary without the
 * model. Returns null only when the NPC has no offerable tools (then we don't show
 * a Play chip at all — never a broken offer).
 */
export function resolveGameOffer(
  npcRole: NpcRole,
  quest: Quest,
  turn = 0,
  target = "en",
): GameOffer | null {
  const tools = offerableTools(npcRole, quest)
  if (tools.length === 0) return null
  const base = hashStr(npcRole.id)
  const tool = tools[(base + turn) % tools.length]
  return {
    tool,
    segue: resolveSegue(tool, target, turn),
    chipLabel: segueChipLabel(tool, target),
  }
}

/**
 * Build the full Qwen3 system prompt. Combines:
 *  - persona (role × scene),
 *  - the quest's persona template with {persona},{target},{native},{domain},
 *    {scaffold},{objective} filled,
 *  - hard teaching rules (target/native language discipline, brevity),
 *  - the tool-call protocol spec + the whitelisted tools.
 */
export function composeSystemPrompt(args: ComposeArgs): string {
  const { npcRole, scene, quest, learnerPair } = args
  const pp = quest.promptProgram
  const target = languageName(learnerPair.target)
  const native = languageName(learnerPair.native)

  // PERSONA SEED (sharp, ~25 tokens) fills the quest template's {persona} slot —
  // a small model gets more character from this than from a long paragraph.
  const seed = personaSeed(npcRole, scene)
  const objective = describeObjective(quest)
  const filled = fillTemplate(pp.personaTemplate, {
    persona: seed,
    target,
    native,
    domain: quest.domain,
    scaffold: pp.scaffold,
    objective,
  })

  // MOOD BEAT (~10 tokens): the rotating colour for THIS conversation.
  const moodLine = args.mood ? `Right now you are ${args.mood}.` : ""

  const e = enrichmentOf(npcRole)
  const toolList = resolveToolWhitelist(e.challengeTools, pp.toolWhitelist)
  const toolSpec =
    toolList.length > 0
      ? toolProtocolSection(toolList)
      : "You have no challenge tools; teach through conversation only. Emit no control block."

  // The character's TOPICS seed what they teach (one short clause).
  const topicLine =
    e.topics && e.topics.length
      ? `Favor words about ${e.topics.slice(0, 4).join(", ")}.`
      : ""

  // NO CHALLENGE SEGUE in the prompt (CHANGE 1): the model is NEVER told about
  // challenges. Telling a 4B model to end every turn with a play-invite burned its
  // brain and forced a redundant "¿me ayudas…?" on every turn (NPC_PROMPT_STUDY
  // pathology #1). The challenge intro is now a DETERMINISTIC, hardcoded,
  // target-language segue spoken by the RUNTIME (npcRuntime → resolveSegue) right
  // before the Play chip appears — no model, no English. The model does ONLY the
  // free, natural conversation (greeting, quest clues, chat).

  // CLUE lean (M1): authored quest whispers the NPC may drop as a hint.
  const clueLean = cluesLeanSection(args.clues, target)

  // SPECIAL-NPC FACTS (M1): deterministic branchy block; empty for a normal NPC.
  const questFactsBlock = args.questFacts ? questFactsSection(args.questFacts) : ""

  // LANGUAGE + RAILS directive, composed IN THE TARGET LANGUAGE (R2-2). A 4B model
  // writes the language its instructions are in: an English "reply in Arabic" rail
  // produced Latin-letter babble, not Arabic. The decisive directive — speak ONLY
  // in {target} (its own script), at most 2 short sentences, stay in character, no
  // translation/parenthetical, never reveal being an AI — is now rendered in the
  // target language so the model is primed to continue IN that language/script.
  // (Replaces the old English `languageDiscipline` + `rails`; native help still
  // comes from the UI / suggested replies, never a model gloss.) Single-language
  // stacks get the immersion variant ("rephrase, don't translate").
  const single = learnerPair.target === learnerPair.native
  const targetDirective = targetLanguageDirective(learnerPair.target, single)

  // #37: LIGHT, human direction (instruction the model reads ABOUT itself, not text
  // to echo) — kept short. The owner's note: stop OVERSPECIFYING ("repeat after
  // me…") and let the model be a creative, warm local. So we steer for variety +
  // coherence + naturalness, NOT a drill: be a real local, say something NEW each
  // turn, weave useful words in naturally, never literally say "repeat after me" or
  // run a drill, never ramble or break character.
  const antiRamble =
    "You are a real, warm local — chat naturally and stay in character. Say " +
    "something NEW every turn (never repeat your last line or drill the same phrase; " +
    'never literally say "repeat after me"). Weave a useful word or two into real ' +
    "talk. Keep it coherent and don't ramble."

  return [
    filled,
    moodLine,
    SCAFFOLD_RULES[pp.scaffold],
    topicLine,
    antiRamble,
    clueLean,
    questFactsBlock,
    "",
    // The in-language language+behaviour directive comes LAST so it is the freshest
    // instruction in context before the model speaks — maximizing the priming.
    targetDirective,
    "",
    toolSpec,
  ]
    .filter(Boolean)
    .join("\n")
}

/**
 * Lean the NPC toward DROPPING a quest clue in character — discovered, not handed
 * over. We feed it the live clues for pieces the player still needs; the NPC may
 * weave ONE into conversation as a hint (then optionally mark a quest step).
 */
function cluesLeanSection(clues: readonly string[] | undefined, target: string): string {
  if (!clues || clues.length === 0) return ""
  const list = clues.map((c) => `  • ${c}`).join("\n")
  return (
    "QUEST WHISPERS — you happen to know something the traveler needs. If it fits naturally, " +
    `drop ONE of these as a HINT, in character and in ${target} (paraphrased, never read verbatim). ` +
    "Make them DISCOVER it; never just hand over the item or the answer:\n" +
    list
  )
}

/**
 * The SPECIAL-NPC FACTS block (§7.3). Deterministic + branchy: the model gets a
 * single authored line to re-voice for the current `stepState`, hard caps, and a
 * "never invent quest facts" guard. The subtlety is the AUTHOR's line; the model
 * only translates + flavours it, so it cannot fail to be a good hint.
 */
export function questFactsSection(f: QuestFacts): string {
  const cap = Math.max(1, f.maxSentences || 2)
  const lines: string[] = [
    `You are ${f.npcName}, ${f.npcRoleLabel}. Stay in character; you are warm and safe for a child.`,
    "",
    "QUEST CONTEXT (facts — obey exactly, do not contradict):",
    `- The traveler's current task: "${f.stepLabel}".`,
    `- Situation: ${f.stepState}.`,
    `- Speak in ${f.target} ONLY — never translate, never add a parenthetical or ${f.native} ` +
      `gloss. Keep it to AT MOST ${cap} short sentences.`,
    "",
    "WHAT TO SAY THIS TURN:",
  ]

  if (f.stepState === "needs-item") {
    const clue = f.authoredClue ?? "Hint that the traveler is missing something they will need."
    lines.push(
      `Drop THIS hint ONCE, in your own words, in ${f.target}, as something you happen to know — ` +
        `never hand it over, make them discover it:`,
      `  "${clue}"`,
      // Anti-fixation (NPC-prompt study): if the hint is already given, DON'T
      // re-ask the same framing question each turn — teach a fresh word or react.
      `If you have already given this hint, do NOT repeat it — say something NEW (teach a ` +
        `useful ${f.target} travel word or react warmly) and keep them moving.`,
    )
  } else if (f.stepState === "ready-to-deliver") {
    const item = f.neededItemLabel ? ` ${f.neededItemLabel}` : " what you needed"
    const next = f.authoredNextHint ?? "Thank them warmly and point them onward to the next step."
    lines.push(
      `They have${item}. Warmly accept it and react, then re-voice this next beat in ${f.target}:`,
      `  "${next}"`,
    )
  } else {
    const next = f.authoredNextHint ?? "Acknowledge their progress warmly and point them onward."
    lines.push(
      `Briefly, warmly acknowledge progress in ${f.target} and point onward:`,
      `  "${next}"`,
    )
  }

  lines.push(
    "",
    "Never invent new quest facts, items, or place names beyond what is given here. " +
      "Never break character to mention being an AI or a prompt.",
  )
  return lines.join("\n")
}

const SCAFFOLD_RULES: Record<string, string> = {
  // #37: "lots of repetition" made a 4B model drill the same line every turn. Light
  // direction instead — keep it easy, but stay fresh.
  beginner: "Keep it easy: short, very common words and the present tense.",
  intermediate: "Natural, everyday phrasing; slip in one new useful expression.",
  advanced: "Natural and idiomatic; only correct a mistake that really matters.",
}

/**
 * A SOFT, human objective for the persona template. #37: we deliberately do NOT
 * leak the mechanical challenge `toolId` ("repeat-after") or counts into the
 * prompt — that made a 4B model parrot "Repeat after me: X" every turn. The model
 * does only natural conversation; the challenge is launched separately by the
 * runtime. So every objective collapses to the same warm, human goal: help the
 * traveler pick up a few useful phrases through real talk.
 */
function describeObjective(_quest: Quest): string {
  return "help the traveler pick up a few useful, real phrases through natural conversation"
}

/** The tool-call protocol instructions appended to the system prompt. Terse on
 *  purpose: the format EXAMPLE is the load-bearing part; most replies need no
 *  block. (This block is outside the persona/mood/rails ~200-token budget.) */
function toolProtocolSection(tools: readonly string[]): string {
  const list = tools.map((t) => `"${t}"`).join(", ")
  return [
    "TOOLS (optional, at most once, at the VERY END, on its own line — most replies need none):",
    `  ${TOOL_OPEN}{"kind":"callTool","tool":<one of ${list}>,"spec":{}}${TOOL_CLOSE}`,
    `  also: {"kind":"reward","xp":N}, {"kind":"questStep","stepId":"…"}, {"kind":"end"} (same delimiters).`,
    "Must be valid JSON, after your spoken line, nothing after the closing delimiter.",
  ].join("\n")
}

// ============================================================
// Streaming-aware tool-block splitter + parser
// ============================================================

export type SplitResult = {
  /** The spoken prose with any (partial or complete) control block removed. */
  prose: string
  /** The raw control block contents (the JSON between the delimiters), if a
   *  COMPLETE block was found; else undefined. */
  rawTool?: string
  /** True once the opener has appeared — the UI should stop streaming prose. */
  toolStarted: boolean
}

/** The `NpcIntent.kind` discriminants — a bare JSON object carrying one of these
 *  is a CONTROL payload that must NEVER be shown/spoken (#38). Kept in sync with
 *  the `NpcIntent` discriminated union in contracts/npc.ts. */
const CONTROL_KINDS = new Set(["say", "callTool", "reward", "questStep", "end"])

/**
 * Find the FIRST bare control-JSON object in `text` — a balanced `{...}` that
 * parses to an object with a control `kind` (the discriminant). Small models
 * sometimes emit `{"kind":"reward","xp":10}` WITHOUT the `<<tool>…</tool>>`
 * delimiters; without this it leaks into the bubble (the #38 bug).
 *
 * Returns the slice bounds + the raw JSON, or:
 *  - `partial:true` when an OPEN brace has appeared but the object isn't closed
 *    yet (streaming) — the caller should HOLD the prose from that brace.
 *  - null when there is no control object (a normal `{…}` in prose that ISN'T a
 *    control payload — e.g. an emoji-free aside — is left untouched).
 */
function findBareControl(
  text: string,
): { start: number; end: number; raw: string } | { partial: true; start: number } | null {
  let searchFrom = 0
  for (;;) {
    const open = text.indexOf("{", searchFrom)
    if (open === -1) return null
    // Walk to the matching close brace (string-aware, so braces inside JSON
    // strings don't fool the depth counter).
    let depth = 0
    let inStr = false
    let esc = false
    let end = -1
    for (let i = open; i < text.length; i++) {
      const c = text[i]
      if (inStr) {
        if (esc) esc = false
        else if (c === "\\") esc = true
        else if (c === '"') inStr = false
        continue
      }
      if (c === '"') inStr = true
      else if (c === "{") depth++
      else if (c === "}") {
        depth--
        if (depth === 0) {
          end = i + 1
          break
        }
      }
    }
    if (end === -1) {
      // Unbalanced so far. If this open brace plausibly begins a control object
      // (we can already see a `"kind"` key forming), tell the caller it's partial
      // so streaming holds the prose; otherwise keep scanning past this brace.
      if (/\{\s*("kind"|"[a-z]+"\s*:)/.test(text.slice(open))) {
        return { partial: true, start: open }
      }
      searchFrom = open + 1
      continue
    }
    const raw = text.slice(open, end)
    try {
      const parsed = JSON.parse(raw) as unknown
      if (
        parsed &&
        typeof parsed === "object" &&
        typeof (parsed as { kind?: unknown }).kind === "string" &&
        CONTROL_KINDS.has((parsed as { kind: string }).kind)
      ) {
        return { start: open, end, raw }
      }
    } catch {
      // Not valid JSON (a normal brace in prose) — keep scanning.
    }
    searchFrom = end
  }
}

/**
 * Split accumulated stream text into spoken prose + (optionally) the raw tool
 * JSON. Safe to call on every token with the running accumulator: once the
 * opener appears we stop revealing prose, and we only surface `rawTool` when the
 * matching closer has also arrived. A bare opener with no closer (e.g. the model
 * was cut off) yields `toolStarted:true` and no `rawTool`.
 *
 * #38: ALSO catches a BARE control-JSON object (no `<<tool>>` delimiters) — a
 * small model emitting `{"kind":"reward",…}` as plain text. Such an object is
 * extracted as `rawTool` (parsed-or-dropped downstream) and STRIPPED from the
 * prose, so control JSON is never shown or spoken.
 */
export function splitToolBlock(accumulated: string): SplitResult {
  const open = accumulated.indexOf(TOOL_OPEN)
  if (open !== -1) {
    const prose = accumulated.slice(0, open)
    const afterOpen = accumulated.slice(open + TOOL_OPEN.length)
    const close = afterOpen.indexOf(TOOL_CLOSE)
    if (close === -1) {
      // Opener present, closer not yet (or never). Hold the prose, no tool yet.
      return { prose, toolStarted: true }
    }
    const rawTool = afterOpen.slice(0, close).trim()
    return { prose, rawTool, toolStarted: true }
  }

  // No delimiter block — check for a BARE control-JSON object (#38).
  const bare = findBareControl(accumulated)
  if (!bare) {
    return { prose: accumulated, toolStarted: false }
  }
  if ("partial" in bare) {
    // A control object is forming but not closed yet → hold the prose before it
    // (same as a bare `<<tool>` opener) so we never reveal a partial JSON object.
    return { prose: accumulated.slice(0, bare.start), toolStarted: true }
  }
  // Complete bare control object: strip it from prose, surface it as the tool.
  const before = accumulated.slice(0, bare.start)
  const after = accumulated.slice(bare.end)
  return { prose: (before + after), rawTool: bare.raw.trim(), toolStarted: true }
}

/**
 * Parse a raw control block (the JSON between the delimiters) into a validated
 * `NpcIntent`. Returns null + logs on malformed JSON or a schema mismatch — a
 * small model sometimes emits a not-quite-right block, and a bad block must
 * degrade to "no action", never crash the conversation.
 */
export function parseToolBlock(rawTool: string): NpcIntent | null {
  let json: unknown
  try {
    json = JSON.parse(rawTool)
  } catch (e) {
    console.warn("[wp/promptProgram] tool block was not valid JSON:", rawTool, e)
    return null
  }
  try {
    return parseNpcIntent(json)
  } catch (e) {
    console.warn("[wp/promptProgram] tool block failed NpcIntent validation:", rawTool, e)
    return null
  }
}

/** Convenience: from full stream text → { prose, intent } in one call. */
export function extractProseAndIntent(accumulated: string): {
  prose: string
  intent: NpcIntent | null
} {
  const split = splitToolBlock(accumulated)
  const prose = split.prose.trim()
  if (split.rawTool === undefined) {
    return { prose, intent: null }
  }
  return { prose, intent: parseToolBlock(split.rawTool) }
}

/** Re-export so the runtime can build a `say` intent for plain replies. */
export { NpcIntent }
