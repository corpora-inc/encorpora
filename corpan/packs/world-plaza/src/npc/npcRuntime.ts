/**
 * npcRuntime — orchestrates a single NPC conversation.
 *
 *   broker.ensureLLM()                         // resident Qwen3 (lazy, §6 doc)
 *     → composeSystemPrompt(role × scene × quest × pair)
 *     → hostApi.llm.chat({system + history}, stream)
 *       → splitToolBlock: stream PROSE to the bubble, capture the tool block
 *     → parseNpcIntent → fire onIntent (callTool/reward/questStep/end)
 *     → optional TTS via hostApi.speak(voiceCode, prose)
 *
 * When the LLM is unavailable (no host llm / model not installed / load failed /
 * memory) it runs the deterministic `NpcRole.scriptedFallback` so NPCs ALWAYS
 * work. Conversation history is kept to a short window. `dispose()` cancels any
 * in-flight stream and releases the model to the broker's idle timer.
 */

import type {
  NpcRole,
  Quest,
  Scene,
  LearnerPair,
  NpcIntent,
  ChallengeToolId,
} from "@world-plaza/contracts"
import type { HostApi, LlmChatHandle, LlmChatMessage } from "./hostTypes"
import type { ModelBroker } from "./modelBroker"
import { createModelBroker } from "./modelBroker"
import {
  composeSystemPrompt,
  splitToolBlock,
  parseToolBlock,
  languageName,
  resolveGameOffer,
  selectMood,
  type GameOffer,
  type QuestFacts,
} from "./promptProgram"
import { resolveSegueForSeed } from "./challengeSegues"
import { createNpcVoiceResolver, type NpcVoiceResolver } from "./npcVoice"
import { createDialogueUI, type DialogueUIHandle } from "./dialogueUI"
import type { InventoryStore } from "../economy/inventory"
import { cluesFor, requiredForStep } from "../economy/questItems"
import {
  authoredClueForStep,
  authoredNextHint,
  type QuestEngine,
} from "../quest/questState"
import { getItemDef } from "../economy/inventory"

const LOG = "[wp/npcRuntime]"

/** How many prior (user,assistant) messages we replay into the prompt. */
const HISTORY_WINDOW = 8

/**
 * Localization-ready connective copy the runtime uses around the deterministic
 * game offer. These are short, in-character glue lines (NOT the persona pretext,
 * which comes from the persona itself); the caller may override them per-locale.
 */
export type RuntimeStrings = {
  /** Chip label for the deterministic "Play a game" offer. */
  playChip: string
  /** Short congratulatory line after a challenge is COMPLETED (a win). */
  congrats: string
  /** Calm, no-pressure line when a challenge is DISMISSED/bailed (#62) — never a
   *  congratulation. */
  challengeSkipped: string
  /** Invite to play another after a win. */
  playAnother: string
  /**
   * R2 (NPC-prompt study) anti-repetition reminder, TARGET-LANGUAGE. Prepended
   * (invisibly, in the user turn) before each post-greeting model turn, quoting
   * the NPC's own last line(s) so a 4B model stops fixating/re-asking the same
   * framing question. `{lines}` is replaced with the quoted recent lines. Default
   * is Spanish (the shipping Antigua world); override per-locale.
   */
  antiRepeat: string
}

const DEFAULT_RUNTIME_STRINGS: RuntimeStrings = {
  playChip: "🎮 Play",
  congrats: "Nicely done! 🎉",
  challengeSkipped: "No worries — maybe later.",
  playAnother: "Want to try another?",
  antiRepeat: "(Ya dijiste: {lines}. No te repitas — di algo NUEVO y avanza la conversación.)",
}

/**
 * Per-NPC VISIT counter. Drives the deterministic mood rotation (`selectMood`)
 * so the SAME npc feels different each time you talk to them — surprise with no
 * model improvisation. Persisted in localStorage (tiny: one int per npc) and
 * incremented once per `open()`; degrades to an in-memory map if storage throws.
 */
const VISIT_KEY = "wp:npc:visits:v1"
const visitMem = new Map<string, number>()

function nextVisit(npcId: string): number {
  try {
    const raw = localStorage.getItem(VISIT_KEY)
    const map = raw ? (JSON.parse(raw) as Record<string, number>) : {}
    const v = (map[npcId] ?? 0) + 1
    map[npcId] = v
    localStorage.setItem(VISIT_KEY, JSON.stringify(map))
    return v
  } catch (e) {
    console.warn(`${LOG} visit-counter storage unavailable, using memory:`, e)
    const v = (visitMem.get(npcId) ?? 0) + 1
    visitMem.set(npcId, v)
    return v
  }
}

export type OpenArgs = {
  npcRole: NpcRole
  scene: Scene
  quest: Quest
  learnerPair: LearnerPair
  /** Where the panel mounts (the game overlay element). */
  container: HTMLElement
  /** A friendly NPC name for the header (else derived from role id). */
  npcName?: string
  /**
   * EXPLICIT TTS-voice-LANGUAGE override (BCP-47). Optional escape hatch for
   * vignettes/tests. When omitted, the voice language is `learnerPair.target` (the
   * language being LEARNED), so the spoken voice matches the target-language text.
   * Do NOT pass a scene-derived `voiceHint` here — that re-introduces the R2-2
   * mismatch (Spanish voice on English text + a non-BCP-47 ":warm" suffix).
   */
  voiceCode?: string
  /** Fired whenever the model emits a structured NpcIntent. */
  onIntent?: (intent: NpcIntent) => void
  /** Fired once when the panel closes (X / scrim / Escape / end-intent) so the
   *  caller can re-enable world input. */
  onClose?: () => void
  /** Suggested opening reply chips (localized by the caller). */
  starterChips?: string[]
  /** Localized connective copy around the deterministic game offer. */
  strings?: Partial<RuntimeStrings>
  /**
   * The deterministic quest engine (§3.1). When provided AND this NPC is the
   * SPECIAL NPC for the current step (`isSpecial`), the runtime:
   *   - injects deterministic FACTS into the system prompt so the model RE-VOICES
   *     the authored beat for the step's state (needs-item / ready-to-deliver),
   *   - surfaces a "Hand over the {item}" affordance when the step is
   *     ready-to-deliver, routing the delivery through `questEngine.advance`.
   * ADDITIVE — absent (a generic crowd NPC) ⇒ behaviour is exactly as today.
   */
  questEngine?: QuestEngine
  /** Live inventory store (for clue/facts computation). Required with questEngine. */
  inventory?: InventoryStore
  /**
   * True iff THIS NPC is the quest's special NPC for the active step (M2 marks
   * these by anchor; for M1 the caller may set it via a test/dev hook). Only a
   * special NPC injects FACTS and offers the hand-over. A generic NPC ignores the
   * engine entirely.
   */
  isSpecial?: boolean
  /** Localized "Hand over the {item}" affordance label (special NPC only). */
  handOverLabel?: (itemLabel: string) => string
  /**
   * The special NPC's DUTY at this anchor ("clue" hands a route item; "deliver"
   * accepts one). ADDITIVE + optional — passed by the orchestrator from the
   * resolved `SpecialNpcEntry.duty`. Drives the deterministic clue-giver grant
   * (CHANGE 3): a `duty:"clue"` NPC with `givesItemId` grants that item itself.
   */
  specialDuty?: "clue" | "deliver"
  /**
   * For a `duty:"clue"` NPC: the item id it GIVES the traveler (from the resolved
   * `SpecialNpcEntry.gives`). When present + held-check passes, the RUNTIME grants
   * it deterministically via `inventory()` (idempotent) and fires a juicy reveal —
   * the model NEVER grants items (it would hallucinate the handoff). Optional.
   */
  givesItemId?: string
  /**
   * Localized "Received the {item}!" reveal copy for the clue-giver grant (CHANGE
   * 3). `{item}` is replaced with the item's friendly label. Defaults to a
   * celebratory English string; the orchestrator overrides per-locale.
   */
  itemReceivedLabel?: (itemLabel: string) => string
  /**
   * DETERMINISTIC objective trigger (A2). When THIS NPC is the objective NPC for
   * the active quest step, the orchestrator passes the step's challenge here so a
   * clear "Begin" affordance ALWAYS appears after the greeting — regardless of
   * `resolveGameOffer` (which returns null when the persona∩quest whitelist is
   * empty). It SEEDS `currentOffer` (the same standing-offer the Play chip + the
   * dedup'd `launchChallenge` path already use), so the launch never depends on
   * the model emitting `<<tool>>`. `chipLabel` is the localized "Begin" label.
   * ADDITIVE — absent ⇒ behaviour is exactly as today (offer from the whitelist,
   * may be null). Only set for the CURRENT step's objective NPC.
   *
   * `onConfirm` (#55, conversation-driven completion): when set, the Begin chip is
   * a CONFIRM, not a challenge launch — tapping it greets you and calls
   * `onConfirm()` (the orchestrator marks the step beaten + advances), then closes
   * the dialogue. Used for TRAVERSE/FIND steps so "cross the bridge" completes by
   * TALKING to the keeper (not a silent proximity trigger) — the NPC is woven into
   * the step. Absent ⇒ the Begin chip launches `tool` as a challenge (talk steps).
   */
  forcedOffer?: { tool: ChallengeToolId; chipLabel: string; onConfirm?: () => void }
}

export interface NpcDialogueHandle {
  /** Programmatically send a user line (same path as typing). */
  send(text: string): void
  /**
   * Hand over the current step's required item to THIS special NPC, routing the
   * delivery through the deterministic quest engine (consume → advance → reward).
   * No-op (returns false) for a non-special NPC or an unsatisfied step — the
   * engine is the referee. M4's premium UI calls this; M1 exposes the hook.
   */
  deliver(): boolean
  close(): void
  dispose(): void
}

export interface NpcRuntime {
  open(args: OpenArgs): NpcDialogueHandle
  /** Forward app lifecycle so the broker can reclaim the model. */
  onBackground(): void
  /** Shared broker (exposed for tests / external lifecycle wiring). */
  broker: ModelBroker
  dispose(): Promise<void>
}

export function createNpcRuntime(hostApi: HostApi, sharedBroker?: ModelBroker): NpcRuntime {
  const broker = sharedBroker ?? createModelBroker(hostApi)
  // STICKY per-NPC voice (CHANGE 2): one shared resolver across conversations so
  // the same NPC keeps the SAME voice every visit (persisted in localStorage).
  const voiceResolver: NpcVoiceResolver = createNpcVoiceResolver(hostApi)

  function open(args: OpenArgs): NpcDialogueHandle {
    // Header name: an explicit one wins; else the persona's generated name; else a
    // stable made-up short name hashed from the role id — so an NPC NEVER shows its
    // raw seed id ("Crowd:Baker:Ambient:4173071802…") in the UI.
    const npcName = args.npcName ?? npcDisplayName(args.npcRole as { id: string; name?: string })
    // R2-2 — the TTS VOICE language must be the TARGET language (what the player is
    // LEARNING), so the spoken voice matches the spoken text. We deliberately do
    // NOT fall back to `scene.npcSkins[id].voiceHint`: that hint is SCENE-derived
    // (Spanish for the Antigua world) AND carries a non-BCP-47 ":warm" character
    // suffix, so it spoke English NPC text through a Spanish voice (ES→EN) and fed a
    // junk language code to TTS. Per-NPC voice VARIETY is handled separately +
    // deterministically by `npcVoice.pickVoiceId` (hashing the npc id over the
    // TARGET language's voice set), so the scene hint is not needed here. An
    // explicit `args.voiceCode` override still wins (vignettes/tests).
    const voiceCode = args.voiceCode ?? args.learnerPair.target

    // R2-2 DIAGNOSTIC (noisy, not silent): make the TOP of the voice chain visible
    // on-device so we can confirm the real values rather than guess — the TARGET we
    // resolved, the full pair, and whether an explicit voiceCode override was in
    // play. If this logs voiceCode="en" but TTS sounds Spanish, the cause is in the
    // resolver/host below (see npcVoice's per-decision logs); if it logs anything
    // other than the expected target, the pair/override upstream is the cause.
    console.info(
      `${LOG} open NPC "${args.npcRole.id}": voiceCode="${voiceCode}" ` +
        `(target="${args.learnerPair.target}", native="${args.learnerPair.native}"` +
        `${args.voiceCode ? `, OVERRIDE="${args.voiceCode}"` : ""}).`,
    )

    const strings: RuntimeStrings = { ...DEFAULT_RUNTIME_STRINGS, ...(args.strings ?? {}) }

    const palette = args.scene.palette
    const ui = createDialogueUI(
      args.container,
      {
        npcName,
        subtitle: `${args.scene.setting.place} · ${args.quest.title}`,
        palette: { accent: palette?.accent, paper: palette?.ground },
        strings: { playOffer: strings.playChip },
      },
      {
        onSubmit: (text) => void handleUserLine(text),
        onReplay: (text) => void speak(text),
        onClose: () => handle.close(),
        onPlay: () => onPlayChipTapped(),
      },
    )
    ui.open()
    ui.focusInput()
    if (args.starterChips?.length) ui.setChips(args.starterChips)

    const history: LlmChatMessage[] = []
    let systemPrompt: string | null = null
    let scripted: { index: number } | null = null
    let activeStream: LlmChatHandle | null = null
    let closed = false
    let kickoffStarted = false

    // ---- Deterministic game-offer state ------------------------------------
    // `offerTurn` rotates the offered tool so "play another" is a fresh game.
    // `challengeLive` guards the dedupe between the chip path and the LLM path:
    // exactly one challenge launches per offer, whichever fires first.
    let offerTurn = 0
    let challengeLive = false
    /**
     * Resolve the standing game offer for the current `offerTurn`. The
     * DETERMINISTIC objective trigger (A2): when `args.forcedOffer` is set (this
     * is the objective NPC for the active step), ALWAYS return a step-bound offer
     * with the "Begin" chip label — bypassing `resolveGameOffer`'s null return on
     * an empty persona∩quest whitelist. The segue is the same deterministic,
     * hardcoded, target-language phrase the whitelist path uses, so the flavour is
     * identical. Non-objective NPCs fall through to the whitelist offer (may be
     * null → no broken offer).
     */
    function resolveStandingOffer(turn: number): GameOffer | null {
      if (args.forcedOffer) {
        return {
          tool: args.forcedOffer.tool,
          // A CONFIRM offer (#55, traverse/find completion) carries NO challenge
          // segue — the chip is "Done", not "repeat after me"; the keeper's own
          // greeting is the flavour. A challenge forced-offer keeps its segue.
          segue: args.forcedOffer.onConfirm
            ? ""
            : resolveSegueForSeed(
                args.forcedOffer.tool,
                args.learnerPair.target,
                `${args.npcRole.id}|begin|${turn}`,
              ),
          chipLabel: args.forcedOffer.chipLabel,
        }
      }
      return resolveGameOffer(
        args.npcRole,
        args.quest,
        turn,
        args.learnerPair.target,
        args.learnerPair.native,
      )
    }
    let currentOffer: GameOffer | null = resolveStandingOffer(offerTurn)
    let challengeObserver: MutationObserver | null = null

    // The rotating MOOD for THIS conversation: deterministic from npc id + a
    // per-NPC visit counter, so the same character surprises across visits.
    const visit = nextVisit(args.npcRole.id)
    const mood = selectMood(args.npcRole.id, visit)

    /**
     * The intro/segue line for the CURRENT offer, shown as the Play chip's caption
     * (NOT a chat bubble, NOT spoken). Set when an offer is presented; consumed by
     * `showPlayOffer`. Cleared once the chip is dismissed/launched.
     */
    let pendingSegue: string | null = null

    /** Surface the standing deterministic Play chip (no-op if no offerable tool,
     *  or while a challenge is live). The challenge intro line rides ALONG as the
     *  chip's caption — by the button, not in the dialog log. */
    function showPlayOffer(): void {
      if (closed || challengeLive) return
      currentOffer ??= resolveStandingOffer(offerTurn)
      // The Play-chip label is TARGET-LANGUAGE (from the offer), not English.
      ui.setPlayOffer(
        currentOffer != null,
        currentOffer?.chipLabel ?? strings.playChip,
        pendingSegue ?? undefined,
      )
    }

    /**
     * The DETERMINISTIC, hardcoded, TARGET-LANGUAGE challenge segue the runtime
     * speaks right before the Play chip (CHANGE 1). NEVER the model, never English.
     * Picked deterministically from the tool + a per-NPC + per-visit + per-offer
     * seed, so it VARIES across NPCs/visits/"play another" yet is stable on reload.
     */
    function segueForOffer(offer: GameOffer): string {
      // A CONFIRM forced-offer (#55) has NO challenge segue — its chip is "Done";
      // the keeper's greeting carries the moment, no "repeat after me" caption.
      if (args.forcedOffer?.onConfirm) return ""
      return resolveSegueForSeed(
        offer.tool,
        args.learnerPair.target,
        `${args.npcRole.id}|${visit}|${offerTurn}`,
      )
    }

    /**
     * Present the FIRST game offer + the prominent Play chip. Idempotent — fired
     * once after the NPC's opening line so the offer appears promptly + reliably,
     * never depending on the model emitting a tool-call.
     *
     * The challenge intro is a deterministic, hardcoded TARGET-LANGUAGE segue — on
     * BOTH the model and no-LLM paths, because the model is no longer told about
     * challenges and never weaves an invite (CHANGE 1). It is NOT a chat bubble and
     * NOT spoken: it rides as the Play chip's CAPTION, by the activate button, so
     * the challenge invite lives with its button and never clutters the dialog log
     * (owner ask — recurring). The model's own conversational line still streams
     * into the log + is voiced; only this meta-invite moves to the button.
     */
    let offerPresented = false
    function presentOffer(): void {
      if (offerPresented || closed || challengeLive) return
      if (!currentOffer) return // NPC has no offerable tool → no broken offer
      offerPresented = true
      pendingSegue = segueForOffer(currentOffer)
      showPlayOffer()
    }

    /** The single launch path — used by BOTH the Play chip and a valid LLM
     *  tool-call, so we never double-launch. `intent.spec` (when the model
     *  supplied one) is forwarded; the chip path sends an empty spec and the
     *  tool builds its own from the language context. */
    function launchChallenge(tool: ChallengeToolId, spec: Record<string, unknown>): void {
      if (closed || challengeLive) return
      challengeLive = true
      // No prompt recompose needed (CHANGE 1): the system prompt never mentions
      // challenges, so launching one doesn't change what the model is told.
      pendingSegue = null // consumed — don't let a stale caption reappear
      ui.setPlayOffer(false)
      ui.showToolCard(tool)
      // Fire the existing onIntent→runChallenge→reward path (game.ts owns it).
      emitIntent({ kind: "callTool", tool, spec })
      // We don't get a resolution callback from game.ts; instead we watch the
      // challenge overlay (mounted into the SAME container) and react when it
      // unmounts — an in-character congrats + a fresh "play another" offer.
      watchForChallengeEnd()
    }

    /** Forward an intent to the caller's handler (the onIntent→runChallenge→reward
     *  bridge) without any local UI side-effects. */
    function emitIntent(intent: NpcIntent): void {
      try {
        args.onIntent?.(intent)
      } catch (e) {
        console.error(`${LOG} onIntent handler threw:`, e)
      }
    }

    /** Player tapped the deterministic Play chip. For a CONFIRM-style forced offer
     *  (#55: traverse/find steps), this completes the step via `onConfirm` + closes
     *  the dialogue — talking to the NPC IS the completion, no challenge. Otherwise
     *  it launches the offer's tool as a challenge (the normal talk-step path). */
    function onPlayChipTapped(): void {
      const confirm = args.forcedOffer?.onConfirm
      if (confirm) {
        ui.setPlayOffer(false)
        try {
          confirm()
        } catch (e) {
          console.error(`${LOG} forcedOffer.onConfirm threw:`, e)
        }
        // The step is done — close out the conversation so the loop flows on.
        handle.close()
        return
      }
      const offer = currentOffer ?? resolveStandingOffer(offerTurn)
      if (!offer) return
      launchChallenge(offer.tool, {})
    }

    /** Observe the container for the challenge overlay (`.wp-ch-scrim`) lifecycle
     *  so we can flow the conversation around the game without editing game.ts.
     *  Caches the live scrim node so that when it disappears we can read the
     *  `data-wp-ch-outcome` it stamped on close (#62 — congratulate only on a win,
     *  never on a bail). */
    function watchForChallengeEnd(): void {
      challengeObserver?.disconnect()
      let scrimEl: HTMLElement | null = null
      const obs = new MutationObserver(() => {
        const present = args.container.querySelector<HTMLElement>(".wp-ch-scrim")
        if (present) scrimEl = present
        else if (scrimEl) {
          // overlay appeared then went away → the challenge resolved/cancelled.
          obs.disconnect()
          challengeObserver = null
          // The scrim is detached now but keeps the dataset it stamped on close;
          // absent ⇒ treat as completed (back-compat, e.g. an external unmount).
          const outcome = scrimEl.dataset.wpChOutcome === "aborted" ? "aborted" : "completed"
          onChallengeEnded(outcome)
        }
      })
      obs.observe(args.container, { childList: true, subtree: true })
      challengeObserver = obs
    }

    /** After the centered challenge closes: the NPC reacts + re-offers. On a WIN it
     *  congratulates; on a BAIL (`outcome:"aborted"`) it says a neutral line and
     *  still offers another — NEVER "Nicely done" (#62). */
    function onChallengeEnded(outcome: "completed" | "aborted"): void {
      if (closed) return
      challengeLive = false
      offerTurn += 1
      currentOffer = resolveStandingOffer(offerTurn)
      // A short, in-character reaction keeps the conversation flowing (the reward
      // toast/HUD is game.ts's job). Congratulate ONLY on a real finish; a bail
      // gets a calm, no-pressure line.
      ui.addNote(outcome === "completed" ? strings.congrats : strings.challengeSkipped)
      if (currentOffer) {
        // The "play another" RE-OFFER framing also lives by the button (NOT a
        // bubble, not spoken): the deterministic target-language segue (new
        // `offerTurn` → a fresh phrase) IS the caption. Every line that frames a
        // challenge belongs at the launch button, never in the dialog log.
        pendingSegue = segueForOffer(currentOffer)
        showPlayOffer()
      }
    }

    async function speak(text: string): Promise<void> {
      const clean = text.trim()
      if (!clean) return
      try {
        // STICKY per-NPC voice (CHANGE 2): route through the resolver so EVERY line
        // of THIS conversation uses the SAME deterministic voice for this NPC (the
        // resolver caches + persists per-NPC, so it never rotates mid-conversation).
        // `voiceCode` is the TTS language code = `learnerPair.target` (the language
        // being LEARNED), so the resolver enumerates + speaks from the TARGET
        // language's voices (R2-2). When the host can't pin a voice (host gap), the
        // resolver degrades to the language-only speak path — still TARGET language.
        await voiceResolver.speak(args.npcRole.id, voiceCode, clean)
      } catch (e) {
        // Loud, never silent (project rule). TTS failing must not break chat.
        console.error(`${LOG} TTS speak failed:`, e)
      }
    }

    /** Drive one scripted-fallback line (deterministic, no model). */
    function scriptedTurn(): void {
      const lines = args.npcRole.scriptedFallback
      if (lines.length === 0) {
        ui.addNote("…")
        return
      }
      scripted ??= { index: 0 }
      const line = lines[scripted.index % lines.length].text
      scripted.index += 1
      ui.endNpcTurn(line)
      void speak(line)
    }

    /**
     * R2: a short TARGET-LANGUAGE reminder built from the NPC's last 1-2 spoken
     * lines, or "" when there is none yet (greeting). Localized via
     * `strings.antiRepeat` ({lines} → the quoted recent lines).
     */
    function buildAntiRepeatReminder(): string {
      const recent = history
        .filter((m) => m.role === "assistant" && m.content.trim())
        .slice(-2)
        .map((m) => m.content.trim())
      if (recent.length === 0) return ""
      const quoted = recent.map((s) => `"${s}"`).join(" / ")
      return strings.antiRepeat.replace("{lines}", quoted)
    }

    /**
     * Prepend the reminder to the LAST user message of the replayed window (the
     * turn the model is about to answer), transiently — does not mutate `history`.
     */
    function applyAntiRepeat(
      replayed: LlmChatMessage[],
      reminder: string,
    ): LlmChatMessage[] {
      if (!reminder || replayed.length === 0) return replayed
      let lastUser = -1
      for (let i = replayed.length - 1; i >= 0; i--) {
        if (replayed[i].role === "user") {
          lastUser = i
          break
        }
      }
      if (lastUser === -1) return replayed
      const out = replayed.slice()
      out[lastUser] = {
        ...out[lastUser],
        content: `${reminder}\n${out[lastUser].content}`,
      }
      return out
    }

    /** Stream one model turn given the current history. */
    async function modelTurn(): Promise<void> {
      if (!hostApi.llm || systemPrompt === null) {
        scriptedTurn()
        return
      }
      ui.setThinking(true)
      ui.setInputEnabled(false)
      let bubble: { appendToken: (t: string) => void } | null = null
      let accumulated = ""
      let proseShown = ""

      try {
        // R2 (NPC-prompt study, ΔDelight; kills fixation/opener-repeat): build a
        // short TARGET-LANGUAGE anti-repetition reminder from the NPC's own last
        // 1-2 lines and prepend it INVISIBLY to the latest user turn — only in the
        // wire messages, NOT in `history`, so reminders never accumulate or get
        // quoted back. The bubble the player saw stays clean (added in
        // handleUserLine). Skipped on the greeting (no prior NPC line yet).
        const replayed = history.slice(-HISTORY_WINDOW * 2)
        const reminder = buildAntiRepeatReminder()
        const messages: LlmChatMessage[] = [
          { role: "system", content: systemPrompt },
          ...applyAntiRepeat(replayed, reminder),
        ]
        await new Promise<void>((resolve) => {
          let settled = false
          let watchdog: ReturnType<typeof setTimeout> | null = null
          const finish = () => {
            if (settled) return
            settled = true
            if (watchdog) {
              clearTimeout(watchdog)
              watchdog = null
            }
            resolve()
          }
          // WATCHDOG: the host's llm.chat streams tokens via per-session Tauri
          // events whose listeners attach AFTER the chat invoke resolves — so a
          // dropped/early event (or a stalled native inference) leaves the promise
          // unsettled and the bubble stuck on "…" forever. If NOT A SINGLE token,
          // done, or error arrives within the window, give up loudly and speak a
          // scripted line so the NPC ALWAYS responds. Cleared the moment the first
          // token lands (a real response is streaming → never cut it off).
          watchdog = setTimeout(() => {
            if (settled) return
            console.error(
              `${LOG} llm.chat watchdog: no token/done/error in 15s — host LLM hung or the token stream was dropped. Falling back to scripted.`,
            )
            ui.setThinking(false)
            try {
              void activeStream?.cancel?.()
            } catch (e) {
              console.error(`${LOG} watchdog cancel threw:`, e)
            }
            if (!bubble) scriptedTurn()
            else ui.endNpcTurn(proseShown)
            finish()
          }, 15000)
          void hostApi
            .llm!.chat(
              {
                messages,
                options: {
                  temperature: 0.6,
                  topP: 0.9,
                  repeatPenalty: 1.15,
                  maxTokens: 400,
                },
              },
              {
                onToken: (tk) => {
                  accumulated += tk
                  const { prose, toolStarted } = splitToolBlock(accumulated)
                  // Only reveal NEW prose, and stop revealing once the tool
                  // block opener appears (we never show/speak control JSON).
                  // First real content → the stream is alive; cancel the watchdog
                  // so a long response is never truncated.
                  if (watchdog) {
                    clearTimeout(watchdog)
                    watchdog = null
                  }
                  if (!toolStarted && prose.length > proseShown.length) {
                    if (!bubble) {
                      ui.setThinking(false)
                      bubble = ui.beginNpcTurn()
                    }
                    bubble.appendToken(prose.slice(proseShown.length))
                    proseShown = prose
                  }
                },
                onDone: (full) => {
                  accumulated = full || accumulated
                  finalizeTurn(accumulated)
                  finish()
                },
                onError: (err) => {
                  console.error(`${LOG} llm.chat error:`, err)
                  ui.setThinking(false)
                  // Degrade gracefully to a scripted line this turn.
                  if (!bubble) scriptedTurn()
                  else ui.endNpcTurn(proseShown)
                  finish()
                },
              },
            )
            .then((h) => {
              activeStream = h
            })
            .catch((e) => {
              console.error(`${LOG} llm.chat failed to start:`, e)
              ui.setThinking(false)
              scriptedTurn()
              finish()
            })
        })
      } finally {
        activeStream = null
        ui.setInputEnabled(true)
        ui.setThinking(false)
        if (!closed) ui.focusInput()
      }
    }

    /** Split final stream text → prose (bubble + TTS + history) + intent (fire). */
    function finalizeTurn(full: string): void {
      const split = splitToolBlock(full)
      const prose = split.prose.trim()
      ui.endNpcTurn(prose)
      if (prose) {
        history.push({ role: "assistant", content: prose })
        void speak(prose)
      }
      if (split.rawTool !== undefined) {
        const intent = parseToolBlock(split.rawTool)
        if (intent) fireIntent(intent)
      }
    }

    function fireIntent(intent: NpcIntent): void {
      // The LLM-emitted tool-call goes through the SAME dedup'd launch path as the
      // deterministic Play chip — so a model tool-call and a chip tap can never
      // double-launch, and the chip stays the guarantee when the model stays mum.
      if (intent.kind === "callTool") {
        launchChallenge(intent.tool, intent.spec)
        return
      }
      emitIntent(intent)
      switch (intent.kind) {
        case "reward":
          ui.addNote(
            intent.coins != null
              ? `+${intent.xp} XP · +${intent.coins} coins`
              : `+${intent.xp} XP`,
          )
          break
        case "questStep":
          ui.addNote(`✓ ${intent.stepId}`)
          break
        case "end":
          ui.addNote("…")
          window.setTimeout(() => handle.close(), 900)
          break
        case "say":
          // Already rendered as prose; nothing extra.
          break
      }
    }

    async function handleUserLine(text: string): Promise<void> {
      const clean = text.trim()
      if (!clean || closed) return
      // Intercept the special-NPC hand-over chip → route through the engine
      // (deterministically gated), never into the model.
      if (special && activeHandOverChip && clean === activeHandOverChip) {
        ui.setChips([])
        activeHandOverChip = null
        deliver()
        return
      }
      ui.setChips([])
      ui.addUserMessage(clean)
      history.push({ role: "user", content: clean })
      await modelTurn()
    }

    // ---- Special-NPC quest binding (§7) ------------------------------------
    /** Is this the quest's special NPC AND do we have the engine + inventory? */
    const special = Boolean(args.isSpecial && args.questEngine && args.inventory)
    const handOverLabel =
      args.handOverLabel ?? ((item: string) => `🤝 Hand over ${item}`)
    const itemReceivedLabel =
      args.itemReceivedLabel ?? ((item: string) => `🎁 Received the ${item}!`)

    /** Friendly label for an item id ("the ferry token"), from the catalog. */
    function itemLabel(itemId: string): string {
      return getItemDef(itemId)?.name ?? itemId
    }

    /**
     * CHANGE 3 — the DETERMINISTIC clue-giver item grant + juicy reveal.
     *
     * The owner couldn't tell if the traveler actually GOT the ferry-token — the
     * model might just CLAIM it (hallucination). So the ENGINE grants it, never the
     * model: when this special NPC is a `duty:"clue"` giver with a `givesItemId`,
     * the runtime grants that item via `inventory()` and fires a celebratory
     * in-overlay reveal. IDEMPOTENT — a repeat visit re-checks ownership and does
     * NOT double-grant. Fires at most once per open.
     */
    let grantFired = false
    function maybeGrantClueItem(): void {
      if (grantFired || closed) return
      grantFired = true
      const itemId = args.givesItemId
      if (args.specialDuty !== "clue" || !itemId || !args.inventory) return
      if (!getItemDef(itemId)) {
        console.warn(`${LOG} clue-giver gives unknown item "${itemId}" — skipping grant.`)
        return
      }
      // IDEMPOTENT: already held → no grant, no reveal (silent on repeat visits).
      if (args.inventory.has(itemId)) return
      args.inventory.grant(itemId, 1)
      // Juicy reveal — the same celebratory in-overlay moment the reward path uses.
      const label = itemLabel(itemId)
      ui.addNote(itemReceivedLabel(label))
      console.info(`${LOG} clue-giver granted "${itemId}" to the traveler (deterministic).`)
    }

    /** The live clues to LEAN on (for ANY quest-bound NPC), per the current step. */
    function liveClues(): string[] {
      if (!args.inventory) return []
      const stepId = args.questEngine?.currentStep()?.id
      return cluesFor(args.inventory, args.quest.id, stepId)
    }

    /**
     * Compute the deterministic FACTS for THIS special NPC + the active step
     * (§7.2). Returns undefined for a non-special NPC or when there is no active
     * step — then no FACTS block is injected and the prompt is unchanged.
     */
    function computeQuestFacts(): QuestFacts | undefined {
      if (!special || !args.questEngine || !args.inventory) return undefined
      const step = args.questEngine.currentStep()
      if (!step) return undefined
      // The special-NPC FACTS only distinguish needs-item / ready-to-deliver /
      // done. A challenge-gated step ("needs-challenge", no inventory rule) maps
      // to "ready-to-deliver" for the re-voiced beat — the deterministic "Begin"
      // affordance (not the FACTS) drives the challenge launch.
      const rawState = args.questEngine.stepState(step.id)
      const stepState: "needs-item" | "ready-to-deliver" | "done" =
        rawState === "needs-challenge" ? "ready-to-deliver" : rawState
      const authoredClue = authoredClueForStep(args.inventory, args.quest.id, step.id)
      const nextHint = authoredNextHint(args.inventory, args.quest, step.id)
      // The needed item label = first required id for the step the player lacks.
      const neededId = requiredForStep(args.quest.id, step.id).find(
        (id) => !args.inventory!.has(id),
      )
      return {
        npcName,
        npcRoleLabel: prettyRole(args.npcRole.id),
        stepLabel: step.label || step.id,
        stepState,
        neededItemLabel: neededId ? itemLabel(neededId) : undefined,
        authoredClue,
        authoredNextHint: nextHint,
        target: languageName(args.learnerPair.target),
        native: languageName(args.learnerPair.native),
        maxSentences: 2,
      }
    }

    /** The item the player is about to hand over for a step (first required, held). */
    function deliverableItemLabel(stepId: string): string {
      if (!args.inventory) return "it"
      const held = requiredForStep(args.quest.id, stepId).find((id) => args.inventory!.has(id))
      return held ? itemLabel(held) : "it"
    }

    /**
     * The HAND-OVER affordance hook (§5.3). When this special NPC's current step
     * is ready-to-deliver, surface a delivery chip; tapping it routes the
     * delivery through the DETERMINISTIC engine (`deliver`→`advance`), which
     * consumes the item, marks the step done, and (when final) grants the quest
     * reward. The full premium UI lands in M4; M1 exposes the hook + the routing.
     */
    let activeHandOverChip: string | null = null
    function maybeOfferHandOver(): void {
      if (!special || !args.questEngine || closed) return
      const step = args.questEngine.currentStep()
      if (!step) {
        activeHandOverChip = null
        return
      }
      if (args.questEngine.stepState(step.id) !== "ready-to-deliver") {
        activeHandOverChip = null
        return
      }
      activeHandOverChip = handOverLabel(deliverableItemLabel(step.id))
      ui.setChips([activeHandOverChip])
    }

    /**
     * Scripted (no-LLM) special-NPC line (§7.5): speak the AUTHORED clue (when
     * the step needs an item) or the authored next-hint verbatim. The
     * deterministic chain runs identically without the model.
     */
    function scriptedSpecialTurn(): void {
      const facts = computeQuestFacts()
      const line =
        facts?.stepState === "needs-item"
          ? facts.authoredClue
          : facts?.authoredNextHint
      if (line) {
        ui.endNpcTurn(line)
        void speak(line)
      } else {
        scriptedTurn()
      }
    }

    /**
     * Route a delivery through the engine. Public on the handle so M4's UI (and
     * the M1 chip) can trigger it; deterministically gated, so it no-ops unless
     * the step is genuinely satisfied. Returns true iff the step advanced.
     */
    function deliver(): boolean {
      if (!special || !args.questEngine) return false
      const step = args.questEngine.currentStep()
      if (!step) return false
      const ok = args.questEngine.advance(step.id)
      if (ok) {
        ui.setChips([])
        ui.addNote(`✓ ${step.label || step.id}`)
        // Re-voice the onward beat on the next turn (FACTS recompute to the new step).
        if (systemPrompt !== null) systemPrompt = composeSpecialPrompt()
      }
      return ok
    }

    /**
     * Compose the system prompt for THIS turn: persona seed + the rotating MOOD +
     * the hard rails (always); the M1 clues/facts (when special). The model is
     * NEVER told about challenges (CHANGE 1): the challenge intro is a
     * deterministic, hardcoded, target-language segue the runtime speaks itself
     * (`segueForOffer`) right before the Play chip, so the 4B model's brain is
     * spent only on the free, natural conversation.
     */
    function composeSpecialPrompt(): string {
      return composeSystemPrompt({
        npcRole: args.npcRole,
        scene: args.scene,
        quest: args.quest,
        learnerPair: args.learnerPair,
        mood,
        clues: liveClues(),
        questFacts: computeQuestFacts(),
      })
    }

    /** Lazy-load the model and greet (or fall back) on first open. */
    async function kickoff(): Promise<void> {
      if (kickoffStarted) return
      kickoffStarted = true
      ui.setThinking(true)
      const state = await broker.ensureLLM()
      if (closed) return
      if (!state.ready || !hostApi.llm) {
        ui.setThinking(false)
        console.warn(`${LOG} LLM unavailable (${state.reason ?? "?"}) → scripted NPC.`)
        // Special NPC with no model: speak the AUTHORED clue/next-hint verbatim
        // (§7.5) so the deterministic chain stays cohesive without the model.
        if (special) scriptedSpecialTurn()
        else scriptedTurn()
        // CHANGE 3: a clue-giver hands over its item deterministically (engine, not
        // model) + a juicy reveal — even with no model.
        maybeGrantClueItem()
        maybeOfferHandOver()
        // No model: the NPC reliably OFFERS a game (deterministic chip) AND speaks
        // the hardcoded TARGET-LANGUAGE segue (no English, no model).
        presentOffer()
        return
      }
      systemPrompt = composeSpecialPrompt()
      // Greet: an empty-history model turn produces the opening in-character line.
      history.push({
        role: "user",
        content: `A traveler walks up to your station. Greet them warmly in ${languageName(
          args.learnerPair.target,
        )} and invite them to talk.`,
      })
      await modelTurn()
      // Don't keep the synthetic greeting prompt in the running window.
      if (history[0]?.role === "user") history.shift()
      // CHANGE 3: a clue-giver hands over its item deterministically (engine, not
      // model) + a juicy reveal, AFTER the model's greeting so the reveal follows
      // the NPC's line. Idempotent — a repeat visit re-checks ownership.
      maybeGrantClueItem()
      // Special NPC ready-to-deliver → surface the hand-over affordance.
      maybeOfferHandOver()
      // After the greeting, the runtime speaks the deterministic, hardcoded
      // TARGET-LANGUAGE segue and surfaces the Play chip (CHANGE 1). The model's
      // greeting was free of any challenge talk — no English, no per-turn invite
      // pathology. If the model itself already sprang a <<tool>> block (rare; the
      // tool protocol still exists), `challengeLive`/`offerPresented` short-circuit.
      presentOffer()
    }

    void kickoff()

    const handle: NpcDialogueHandle = {
      send: (text) => void handleUserLine(text),
      deliver: () => deliver(),
      close: () => {
        if (closed) return
        closed = true
        challengeObserver?.disconnect()
        challengeObserver = null
        void activeStream?.cancel().catch((e) => console.error(`${LOG} cancel failed:`, e))
        ui.dispose()
        // Become idle-eligible; the broker reclaims the model if no NPC re-engages.
        broker.releaseLLM()
        args.onClose?.()
      },
      dispose: () => {
        if (!closed) handle.close()
      },
    }
    return handle
  }

  return {
    open,
    onBackground: () => broker.onBackground(),
    broker,
    dispose: () => broker.dispose(),
  }
}

function prettyRole(id: string): string {
  return id
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim()
}

/** A pool of short, neutral, era-agnostic given names for ambient NPCs that lack a
 *  generated persona name. Kept small + diverse; the id-hash spreads picks. */
const NPC_NAMES = [
  "Mara", "Tomas", "Lena", "Iker", "Sora", "Nia", "Ben", "Cleo", "Rafe", "Yara",
  "Otto", "Mira", "Dax", "Suki", "Pavel", "Nora", "Emil", "Lux", "Tariq", "Vera",
  "Hugo", "Ines", "Kofi", "Mei", "Bruno", "Alba", "Niko", "Saba", "Elio", "Wren",
  "Goro", "Lila", "Per", "Anka", "Remy", "Tova", "Cyrus", "Juno", "Bo", "Faye",
]

/** A clean, stable display name for an NPC. Prefers the persona's generated name;
 *  falls back to a made-up name deterministically hashed from the role id (so the
 *  same NPC always shows the same name) — never the raw seed id. */
export function npcDisplayName(role: { id?: string; name?: string }): string {
  // a persona name is fine UNLESS it's itself a seed-like token (has :/_ or digits).
  if (role.name && !/[:_]/.test(role.name) && !/\d{3,}/.test(role.name)) return role.name
  const id = role.id ?? "npc"
  let h = 2166136261 >>> 0
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return NPC_NAMES[(h >>> 0) % NPC_NAMES.length]
}

export type { DialogueUIHandle }
