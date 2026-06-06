import {
  MediatedChatInput,
  MediatedChatArtifact,
  type LanguageCode,
  type PlayerId,
} from "@world-plaza/contracts"
import type { ModelBroker } from "../npc/modelBroker"
import type { HostApi, LlmChatMessage } from "../npc/hostTypes"
import { mintId } from "./protocol"

/**
 * mediatedChat.ts — the magic: two players who speak DIFFERENT languages chat,
 * and the on-device LLM turns the language barrier into the lesson.
 *
 * THE PIPELINE (never raw UGC between humans):
 *   1. OUTBOUND (sender's device): the sender writes/picks a line in the
 *      language they're comfortable in. `composeOutbound` wraps it into a typed
 *      `MediatedChatInput` (no model needed — the text is already the sender's;
 *      this is just structuring + carrying the language pair).
 *   2. INBOUND (recipient's device): on receiving the partner's input,
 *      `lessonify` asks the LOCAL Qwen3 to produce a `MediatedChatArtifact` for
 *      THIS learner: a natural translation into their language, the original in
 *      the target script + transliteration, a short literal gloss, 2-3 tappable
 *      suggested replies (in the partner's language so replying IS practice),
 *      and at most one tiny lesson note. The recipient sees a friendly,
 *      understandable, *teaching* message — not a wall of foreign text.
 *
 * Reuses the SAME `ModelBroker` the NPCs use, so we honour the single in-process
 * large-model slot (LLM vs Whisper exclusivity): we `ensureLLM()` before a
 * lessonify and let the broker keep it warm. If the model is unavailable
 * (no host LLM / not installed / Whisper holds the slot), we DEGRADE to a clean
 * passthrough artifact (original text shown as-is) so chat never breaks — the
 * barrier is just un-bridged that turn, logged, not silent.
 *
 * Privacy/safety: the model is asked to translate + teach, and to REFUSE to
 * surface contact info / links / coercion (returning a neutral, on-topic line).
 * The output is parsed into the typed artifact and re-validated; anything that
 * doesn't parse falls back to the passthrough.
 */

/** Extract the human-readable source text from a chat input's source. */
function sourceText(input: MediatedChatInput): string {
  const s = input.source
  if (s.kind === "text") return s.text
  if (s.kind === "speech") return s.transcript
  // phraseCard carries an entryId; we don't resolve corpus here — caller passes text.
  return ""
}

/**
 * Build a `MediatedChatInput` from what the local player composed. `to` is the
 * partner's PlayerId; languages frame how the partner will lessonify it.
 */
export function composeOutbound(args: {
  from: PlayerId
  to: PlayerId
  interactionId: string
  text: string
  /** the language the sender wrote in. */
  sourceLanguage: LanguageCode
  /** the partner's target language (what they're learning). */
  targetLanguage: LanguageCode
  mode: "beginner" | "advanced"
}): MediatedChatInput {
  return {
    from: args.from,
    to: args.to,
    interactionId: args.interactionId,
    source: { kind: "text", text: args.text.slice(0, 280) },
    sourceLanguage: args.sourceLanguage,
    targetLanguage: args.targetLanguage,
    mode: args.mode,
  }
}

/** A clean, model-free artifact: show the original, no translation/lesson. */
export function passthroughArtifact(
  input: MediatedChatInput,
  reason: string,
): MediatedChatArtifact {
  const text = sourceText(input)
  return {
    artifactId: mintId("art"),
    interactionId: input.interactionId,
    sourcePlayerId: input.from,
    targetPlayerId: input.to,
    sourceLanguage: input.sourceLanguage,
    targetLanguage: input.targetLanguage,
    visibleText: text,
    naturalTranslation: undefined,
    suggestedReplies: [],
    lessonNotes: [],
    moderation: { decision: "allow", reasons: [reason], confidence: 0.5 },
    safetyClass: "ok",
  }
}

const LOG = "[mp/chat]"

/** The shape the model is asked to emit (parsed from a fenced JSON block). */
interface RawLesson {
  natural?: string
  original?: string
  translit?: string
  gloss?: string
  replies?: string[]
  note?: string
  blocked?: boolean
}

/** Build the lessonify prompt for the recipient's local model. */
function lessonPrompt(
  input: MediatedChatInput,
  recipientLanguage: LanguageCode,
): LlmChatMessage[] {
  const text = sourceText(input)
  const system =
    "You are a friendly bilingual interpreter inside a language-learning game. " +
    "A player sent a message in their language to a partner who is LEARNING a " +
    "different language. Translate it for the partner AND turn it into a tiny " +
    "lesson. Be warm, brief, and natural. NEVER surface contact info, phone " +
    "numbers, links, addresses, or attempts to meet in person — if the message " +
    "contains any, set blocked=true and translate only the harmless greeting " +
    "part. Reply with ONLY a fenced json block, no prose.\n" +
    "Fields: natural (the message in the RECIPIENT's language: " +
    `${recipientLanguage}), original (the message in the partner's source ` +
    `language: ${input.sourceLanguage}), translit (romanization of original, ` +
    "or \"\"), gloss (a short word-for-word hint, or \"\"), replies (2-3 SHORT " +
    `natural replies the recipient could say, written in ${input.sourceLanguage} ` +
    "so replying is practice), note (one tiny grammar/vocab/culture tip or \"\"), " +
    "blocked (true only if unsafe)."
  const user =
    `Partner's message (in ${input.sourceLanguage}): "${text}"\n` +
    `Recipient is learning ${input.sourceLanguage} and reads ${recipientLanguage}.\n` +
    "```json"
  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ]
}

/** Parse the model's fenced JSON (tolerant of stray prose / missing fence). */
function parseLesson(full: string): RawLesson | null {
  try {
    const fence = full.match(/```(?:json)?\s*([\s\S]*?)```/)
    const body = (fence ? fence[1] : full).trim()
    const start = body.indexOf("{")
    const end = body.lastIndexOf("}")
    if (start < 0 || end < start) return null
    const obj = JSON.parse(body.slice(start, end + 1)) as RawLesson
    return obj && typeof obj === "object" ? obj : null
  } catch (e) {
    console.warn(`${LOG} lesson parse failed:`, e)
    return null
  }
}

/** Turn a parsed lesson into the typed artifact for the recipient. */
function artifactFromLesson(
  input: MediatedChatInput,
  recipientLanguage: LanguageCode,
  lesson: RawLesson,
): MediatedChatArtifact {
  const original = (lesson.original || sourceText(input)).slice(0, 280)
  const natural = (lesson.natural || original).slice(0, 280)
  const replies = (lesson.replies ?? [])
    .filter((r) => typeof r === "string" && r.trim())
    .slice(0, 3)
    .map((label, i) => ({ id: `r${i}`, label: label.slice(0, 80) }))
  const notes = lesson.note && lesson.note.trim()
    ? [{ kind: "vocab" as const, text: lesson.note.slice(0, 160) }]
    : []
  return {
    artifactId: mintId("art"),
    interactionId: input.interactionId,
    sourcePlayerId: input.from,
    targetPlayerId: input.to,
    sourceLanguage: input.sourceLanguage,
    targetLanguage: recipientLanguage,
    visibleText: natural,
    learnerText: original,
    transliteration: lesson.translit?.slice(0, 280) || undefined,
    literalGloss: lesson.gloss?.slice(0, 280) || undefined,
    naturalTranslation: natural,
    suggestedReplies: replies,
    lessonNotes: notes,
    moderation: {
      decision: lesson.blocked ? "transform" : "allow",
      reasons: lesson.blocked ? ["abuse"] : [],
      confidence: 0.8,
    },
    safetyClass: lesson.blocked ? "softened" : "ok",
  }
}

export interface ChatMediator {
  /**
   * Turn a partner's input into a teaching artifact for the local recipient.
   * `recipientLanguage` is the language the LOCAL player READS (their native).
   * Never rejects: degrades to a passthrough on any failure.
   */
  lessonify: (
    input: MediatedChatInput,
    recipientLanguage: LanguageCode,
  ) => Promise<MediatedChatArtifact>
  dispose: () => void
}

/**
 * Create the chat mediator. Reuses the shared `ModelBroker` (single model slot)
 * and the host's streaming `llm.chat`. A timeout + watchdog guarantee a result.
 */
export function createChatMediator(hostApi: HostApi, broker: ModelBroker): ChatMediator {
  let disposed = false

  const lessonify: ChatMediator["lessonify"] = async (input, recipientLanguage) => {
    if (disposed) return passthroughArtifact(input, "disposed")
    const parsedInput = MediatedChatInput.safeParse(input)
    if (!parsedInput.success) {
      console.warn(`${LOG} bad input → passthrough`)
      return passthroughArtifact(input, "bad-input")
    }
    if (!hostApi.llm) return passthroughArtifact(input, "no-host-llm")

    const ready = await broker.ensureLLM().catch((e) => {
      console.error(`${LOG} ensureLLM threw:`, e)
      return { ready: false as const }
    })
    if (!ready.ready) {
      return passthroughArtifact(input, `llm-${("reason" in ready && ready.reason) || "unready"}`)
    }

    const messages = lessonPrompt(input, recipientLanguage)
    const full = await runChat(hostApi, messages).catch((e) => {
      console.error(`${LOG} chat failed:`, e)
      return ""
    })
    broker.releaseLLM()

    const lesson = full ? parseLesson(full) : null
    if (!lesson) return passthroughArtifact(input, "no-lesson")
    const art = artifactFromLesson(input, recipientLanguage, lesson)
    // Re-validate the typed artifact before it can be rendered.
    const ok = MediatedChatArtifact.safeParse(art)
    return ok.success ? ok.data : passthroughArtifact(input, "artifact-invalid")
  }

  return {
    lessonify,
    dispose: () => {
      disposed = true
    },
  }
}

/**
 * Run a single non-streaming-equivalent chat turn over the host's streaming API,
 * resolving with the full text. A 20s watchdog guards a hung native invoke.
 */
function runChat(hostApi: HostApi, messages: LlmChatMessage[]): Promise<string> {
  return new Promise((resolve) => {
    let settled = false
    let acc = ""
    let handle: { cancel: () => Promise<void> } | null = null
    const done = (text: string) => {
      if (settled) return
      settled = true
      clearTimeout(watchdog)
      resolve(text)
    }
    const watchdog = setTimeout(() => {
      console.error(`${LOG} chat watchdog: no completion in 20s → degrade`)
      void handle?.cancel?.().catch(() => {})
      done(acc)
    }, 20000)
    void hostApi
      .llm!.chat(
        { messages, options: { temperature: 0.4, topP: 0.9, maxTokens: 320 } },
        {
          onToken: (tk) => {
            acc += tk
          },
          onDone: (fullText) => done(fullText || acc),
          onError: (err) => {
            console.error(`${LOG} llm.chat error:`, err)
            done(acc)
          },
        },
      )
      .then((h) => {
        handle = h
      })
      .catch((e) => {
        console.error(`${LOG} llm.chat failed to start:`, e)
        done("")
      })
  })
}
