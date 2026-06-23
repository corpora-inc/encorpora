import {
  MediatedChatArtifact,
  MediatedChatInput,
  type LanguageCode,
  type LearnerPair,
  type PlayerId,
} from "@corpan-city/contracts"
import {
  createHostSafePhraseSampler,
  createSafeRelayPipeline,
  type SafeRelayChatMessage,
  type SafeRelayChatOptions,
  type SafeRelayLesson,
  type SafeRelayOutbound,
} from "@shared/moderation"
import type { ModelBroker } from "../npc/modelBroker"
import type { HostApi, LlmChatMessage, LlmChatOptions } from "../npc/hostTypes"
import { mintId } from "./protocol"

/**
 * Peer chat uses a shared safe relay pipeline:
 *
 *   author text (local only)
 *     -> author's LLM rewrites it into safe English relay text
 *     -> safe English relay text crosses the server
 *     -> recipient's LLM independently rewrites it again
 *     -> recipient's LLM translates it with separate target/native calls
 *
 * Unreviewed author text never enters a MediatedChatInput. Failure paths use
 * corpus/static safe language-learning text instead of surfacing unverified text.
 */

const LOG = "[mp/chat]"
const MAX_WIRE_TEXT = 280
const MAX_REPLY_TEXT = 80
const INBOUND_FALLBACK = "Let's talk about something friendly."

function sourceText(input: MediatedChatInput): string {
  const source = input.source
  if (source.kind === "text") return source.text
  if (source.kind === "speech") return source.transcript
  return ""
}

function boundedText(value: unknown, max = MAX_WIRE_TEXT): string {
  return typeof value === "string" ? value.trim().slice(0, max) : ""
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

function composeSafeRelayInput(
  args: PrepareOutboundArgs,
  outbound: SafeRelayOutbound,
): MediatedChatInput {
  return {
    from: args.from,
    to: args.to,
    interactionId: args.interactionId,
    source: { kind: "text", text: boundedText(outbound.relayText) || INBOUND_FALLBACK },
    sourceLanguage: "en" as LanguageCode,
    targetLanguage: args.targetLanguage,
    mode: args.mode,
  }
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
    naturalTranslation: INBOUND_FALLBACK,
    suggestedReplies: [],
    lessonNotes: [],
    moderation: { decision: "transform", reasons: [reason], confidence: 1 },
    safetyClass: "softened",
  }
}

function artifactFromLesson(
  input: MediatedChatInput,
  recipient: LearnerPair,
  lesson: SafeRelayLesson,
): MediatedChatArtifact {
  const replies = lesson.suggestedReplies
    .map((reply) => boundedText(reply, MAX_REPLY_TEXT))
    .filter(Boolean)
    .slice(0, 3)
    .map((label, index) => ({ id: `r${index}`, label }))
  return {
    artifactId: mintId("art"),
    interactionId: input.interactionId,
    sourcePlayerId: input.from,
    targetPlayerId: input.to,
    sourceLanguage: input.sourceLanguage,
    targetLanguage: recipient.target,
    visibleText: boundedText(lesson.targetText) || INBOUND_FALLBACK,
    naturalTranslation: boundedText(lesson.nativeText) || undefined,
    suggestedReplies: replies,
    lessonNotes: [],
    moderation: {
      decision: lesson.state === "send" ? "allow" : "transform",
      reasons: lesson.reasons,
      confidence: lesson.state === "send" ? 0.9 : 1,
    },
    safetyClass: lesson.state === "send" ? "ok" : "softened",
  }
}

export interface ChatMediator {
  /** Rewrite raw local text into the only text permitted to cross the wire. */
  prepareOutbound: (args: PrepareOutboundArgs) => Promise<MediatedChatInput>
  /** Clean again, translate, and turn received safe relay text into a lesson. */
  lessonify: (
    input: MediatedChatInput,
    recipient: LearnerPair,
  ) => Promise<MediatedChatArtifact>
  dispose: () => void
}

export function createChatMediator(hostApi: HostApi, broker: ModelBroker): ChatMediator {
  let disposed = false

  async function runLocalPass(
    messages: SafeRelayChatMessage[],
    options: SafeRelayChatOptions,
    label: string,
  ): Promise<string> {
    if (disposed || !hostApi.llm) return ""
    const ready = await broker.ensureLLM().catch((error) => {
      console.error(`${LOG} ensureLLM threw during ${label}:`, error)
      return { ready: false as const }
    })
    if (!ready.ready) return ""
    try {
      return await runChat(hostApi, messages as LlmChatMessage[], options as LlmChatOptions)
    } catch (error) {
      console.error(`${LOG} local model pass failed during ${label}:`, error)
      return ""
    } finally {
      broker.releaseLLM()
    }
  }

  const pipeline = createSafeRelayPipeline({
    runLlm: runLocalPass,
    sampleSafePhrase: createHostSafePhraseSampler(hostApi),
  })

  const prepareOutbound: ChatMediator["prepareOutbound"] = async (args) => {
    const outbound = await pipeline.prepareOutbound({
      text: args.text,
      sourceLanguage: args.sourceLanguage,
      targetLanguage: args.targetLanguage,
      scope: args.interactionId,
    })
    return MediatedChatInput.parse(composeSafeRelayInput(args, outbound))
  }

  const lessonify: ChatMediator["lessonify"] = async (input, recipient) => {
    const parsedInput = MediatedChatInput.safeParse(input)
    const parsedRecipient = (
      recipient && typeof recipient === "object"
        ? recipient
        : { target: "en", native: "en" }
    ) as LearnerPair
    if (!parsedInput.success) {
      console.warn(`${LOG} dropped malformed received relay text`)
      return safeArtifact(input, parsedRecipient, "bad-input")
    }

    const lesson = await pipeline.lessonify({
      relayText: sourceText(parsedInput.data),
      targetLanguage: parsedRecipient.target,
      nativeLanguage: parsedRecipient.native,
    })
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
      pipeline.clear()
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
