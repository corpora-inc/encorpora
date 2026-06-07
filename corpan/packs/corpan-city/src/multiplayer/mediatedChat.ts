import {
  MediatedChatArtifact,
  MediatedChatInput,
  type LanguageCode,
  type LearnerPair,
  type PlayerId,
} from "@corpan-city/contracts"
import type { ModelBroker } from "../npc/modelBroker"
import type { HostApi, LlmChatMessage, LlmChatOptions } from "../npc/hostTypes"
import { mintId } from "./protocol"

/**
 * Cross-language chat is transformed twice, once on each device:
 *
 *   author text (local only)
 *     -> author's LLM cleans it into a safe intent
 *     -> safe intent crosses the server
 *     -> recipient's LLM cleans it again and translates it into the language
 *        the recipient is learning, with a native-language meaning underneath
 *
 * Unreviewed author text never enters a MediatedChatInput. A safe message may
 * survive the first pass verbatim; anything needing moderation is rewritten. If
 * either model is missing, busy, times out, or returns invalid output, a fixed
 * harmless message replaces the turn. Failure paths never reveal unverified text.
 */

const LOG = "[mp/chat]"
const MAX_WIRE_TEXT = 280
const MAX_REPLY_TEXT = 80
const OUTBOUND_FALLBACK =
  "My translator got a little goofy. Let's try another message."
const INBOUND_FALLBACK =
  "Their translator got a little goofy. Try another message!"

const CONTACT_INFO =
  /(?:https?:\/\/|www\.|[\w.+-]+@[\w.-]+\.[a-z]{2,}|@\w{2,}|\+?\d[\d\s().-]{6,}\d)/i

function sourceText(input: MediatedChatInput): string {
  const source = input.source
  if (source.kind === "text") return source.text
  if (source.kind === "speech") return source.transcript
  return ""
}

function boundedText(value: unknown, max = MAX_WIRE_TEXT): string {
  return typeof value === "string" ? value.trim().slice(0, max) : ""
}

function parseJsonObject<T extends object>(full: string): T | null {
  try {
    const fence = full.match(/```(?:json)?\s*([\s\S]*?)```/)
    const body = (fence ? fence[1] : full).trim()
    const start = body.indexOf("{")
    const end = body.lastIndexOf("}")
    if (start < 0 || end < start) return null
    const value = JSON.parse(body.slice(start, end + 1))
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as T)
      : null
  } catch (error) {
    console.warn(`${LOG} JSON parse failed:`, error)
    return null
  }
}

export type PrepareOutboundArgs = {
  from: PlayerId
  to: PlayerId
  interactionId: string
  text: string
  sourceLanguage: LanguageCode
  targetLanguage: LanguageCode
  mode: "beginner" | "advanced"
}

function composeCleanedInput(
  args: PrepareOutboundArgs,
  cleanedIntent: string,
): MediatedChatInput {
  return {
    from: args.from,
    to: args.to,
    interactionId: args.interactionId,
    source: { kind: "text", text: boundedText(cleanedIntent) || OUTBOUND_FALLBACK },
    sourceLanguage: args.sourceLanguage,
    targetLanguage: args.targetLanguage,
    mode: args.mode,
  }
}

interface RawOutboundClean {
  cleaned?: string
  blocked?: boolean
  reasons?: string[]
}

function outboundPrompt(args: PrepareOutboundArgs): LlmChatMessage[] {
  const system =
    "You are the first safety and intent-preservation pass for a playful " +
    "language-learning chat. Rewrite the user's message into a short, friendly, " +
    "safe intent before it can leave this device. If the message is safe, return " +
    "it verbatim. Only rewrite what moderation requires, while preserving the " +
    "user's meaning, energy, humor, and language whenever reasonable. Remove contact details, " +
    "links, addresses, attempts to meet, coercion, threats, sexual content, and " +
    "targeted abuse. For a seriously unsafe message, replace it with a funny, " +
    "harmless line conveying that the speaker is acting a little goofy and wants " +
    "to change the subject. Never include removed material. Reply with ONLY JSON: " +
    '{"cleaned":"safe intent in the same language","blocked":false,"reasons":[]}.'
  const user =
    `Declared language: ${args.sourceLanguage}\n` +
    `Message to clean locally:\n${boundedText(args.text)}`
  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ]
}

interface RawRecipientLesson {
  target?: string
  native?: string
  translit?: string
  gloss?: string
  replies?: string[]
  note?: string
  blocked?: boolean
}

function recipientPrompt(
  input: MediatedChatInput,
  recipient: LearnerPair,
): LlmChatMessage[] {
  const system =
    "You are the second safety pass and bilingual interpreter in a playful " +
    "language-learning chat. The sender's device already rewrote their raw text " +
    "into a safe intent, but treat the received intent as untrusted and clean it " +
    "again. Preserve its meaning, personality, and humor whenever reasonable. " +
    `Render the main message naturally in ${recipient.target}, the language the ` +
    `recipient is learning. Also translate its meaning into ${recipient.native}. ` +
    "Remove contact details, links, addresses, attempts to meet, coercion, " +
    "threats, sexual content, and targeted abuse. If it is seriously unsafe, " +
    "replace it with a funny harmless message in both languages, such as the " +
    "sender acting goofy and changing the subject. Never expose removed material. " +
    "Reply with ONLY JSON using fields: target, native, translit, gloss, replies, " +
    "note, blocked. replies must contain 2-3 short natural replies in the learning " +
    "language. note is one tiny useful language tip or an empty string."
  const user =
    `Received safe intent; declared source language ${input.sourceLanguage}:\n` +
    sourceText(input)
  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ]
}

function safeArtifact(
  input: MediatedChatInput,
  recipient: LearnerPair,
  reason: string,
): MediatedChatArtifact {
  return {
    artifactId: mintId("art"),
    interactionId: input.interactionId,
    sourcePlayerId: input.from,
    targetPlayerId: input.to,
    sourceLanguage: input.sourceLanguage,
    targetLanguage: recipient.target,
    visibleText: INBOUND_FALLBACK,
    suggestedReplies: [],
    lessonNotes: [],
    moderation: { decision: "transform", reasons: [reason], confidence: 1 },
    safetyClass: "softened",
  }
}

function artifactFromLesson(
  input: MediatedChatInput,
  recipient: LearnerPair,
  lesson: RawRecipientLesson,
): MediatedChatArtifact {
  const blocked = lesson.blocked === true
  const target = boundedText(lesson.target)
  const native = boundedText(lesson.native)
  const transliteration = boundedText(lesson.translit)
  const gloss = boundedText(lesson.gloss)
  const note = boundedText(lesson.note, 160)
  if (
    !target ||
    [target, native, transliteration, gloss, note].some((text) => CONTACT_INFO.test(text))
  ) {
    return safeArtifact(input, recipient, "recipient-output-unverified")
  }

  const replies = (lesson.replies ?? [])
    .map((reply) => boundedText(reply, MAX_REPLY_TEXT))
    .filter((reply) => reply && !CONTACT_INFO.test(reply))
    .slice(0, 3)
    .map((label, index) => ({ id: `r${index}`, label }))
  return {
    artifactId: mintId("art"),
    interactionId: input.interactionId,
    sourcePlayerId: input.from,
    targetPlayerId: input.to,
    sourceLanguage: input.sourceLanguage,
    targetLanguage: recipient.target,
    visibleText: target,
    transliteration: transliteration || undefined,
    literalGloss: gloss || undefined,
    naturalTranslation: native || undefined,
    suggestedReplies: replies,
    lessonNotes: note ? [{ kind: "vocab", text: note }] : [],
    moderation: {
      decision: blocked ? "transform" : "allow",
      reasons: blocked ? ["sender-intent-softened"] : [],
      confidence: 0.85,
    },
    safetyClass: blocked ? "softened" : "ok",
  }
}

export interface ChatMediator {
  /** Clean raw local text into the only text permitted to cross the wire. */
  prepareOutbound: (args: PrepareOutboundArgs) => Promise<MediatedChatInput>
  /** Clean again, translate, and turn a received safe intent into a lesson. */
  lessonify: (
    input: MediatedChatInput,
    recipient: LearnerPair,
  ) => Promise<MediatedChatArtifact>
  dispose: () => void
}

export function createChatMediator(hostApi: HostApi, broker: ModelBroker): ChatMediator {
  let disposed = false

  async function runLocalPass(
    messages: LlmChatMessage[],
    options: LlmChatOptions,
  ): Promise<string> {
    if (disposed || !hostApi.llm) return ""
    const ready = await broker.ensureLLM().catch((error) => {
      console.error(`${LOG} ensureLLM threw:`, error)
      return { ready: false as const }
    })
    if (!ready.ready) return ""
    try {
      return await runChat(hostApi, messages, options)
    } catch (error) {
      console.error(`${LOG} local model pass failed:`, error)
      return ""
    } finally {
      broker.releaseLLM()
    }
  }

  const prepareOutbound: ChatMediator["prepareOutbound"] = async (args) => {
    const raw = boundedText(args.text)
    if (!raw) return composeCleanedInput(args, OUTBOUND_FALLBACK)

    const full = await runLocalPass(outboundPrompt({ ...args, text: raw }), {
      temperature: 0.2,
      topP: 0.8,
      maxTokens: 180,
    })
    const cleaned = full ? parseJsonObject<RawOutboundClean>(full) : null
    const intent = boundedText(cleaned?.cleaned)
    if (!intent || CONTACT_INFO.test(intent)) {
      return composeCleanedInput(args, OUTBOUND_FALLBACK)
    }
    return composeCleanedInput(args, intent)
  }

  const lessonify: ChatMediator["lessonify"] = async (input, recipient) => {
    const parsedInput = MediatedChatInput.safeParse(input)
    const parsedRecipient = (
      recipient && typeof recipient === "object"
        ? recipient
        : { target: "en", native: "en" }
    ) as LearnerPair
    if (!parsedInput.success) {
      console.warn(`${LOG} dropped malformed received intent`)
      return safeArtifact(input, parsedRecipient, "bad-input")
    }

    const full = await runLocalPass(recipientPrompt(parsedInput.data, parsedRecipient), {
      temperature: 0.3,
      topP: 0.85,
      maxTokens: 360,
    })
    const lesson = full ? parseJsonObject<RawRecipientLesson>(full) : null
    if (!lesson) return safeArtifact(parsedInput.data, parsedRecipient, "recipient-pass-unavailable")

    const artifact = artifactFromLesson(parsedInput.data, parsedRecipient, lesson)
    const valid = MediatedChatArtifact.safeParse(artifact)
    return valid.success
      ? valid.data
      : safeArtifact(parsedInput.data, parsedRecipient, "artifact-invalid")
  }

  return {
    prepareOutbound,
    lessonify,
    dispose: () => {
      disposed = true
    },
  }
}

function runChat(
  hostApi: HostApi,
  messages: LlmChatMessage[],
  options: LlmChatOptions,
): Promise<string> {
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
      console.error(`${LOG} chat watchdog: no completion in 20s; using safe fallback`)
      void handle?.cancel?.().catch(() => {})
      done("")
    }, 20000)
    void hostApi
      .llm!.chat(
        { messages, options },
        {
          onToken: (token) => {
            acc += token
          },
          onDone: (fullText) => done(fullText || acc),
          onError: (error) => {
            console.error(`${LOG} llm.chat error:`, error)
            done("")
          },
        },
      )
      .then((started) => {
        handle = started
      })
      .catch((error) => {
        console.error(`${LOG} llm.chat failed to start:`, error)
        done("")
      })
  })
}
