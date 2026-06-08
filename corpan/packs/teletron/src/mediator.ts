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
import type { HostApi, LlmChatMessage, LlmChatOptions } from "../../corpan-city/src/npc/hostTypes"

const MAX_TEXT = 280
const INBOUND_FALLBACK = "Let's talk about something friendly."

export type PrepareOutboundArgs = {
  from: PlayerId
  to: PlayerId
  interactionId: string
  text: string
  sourceLanguage: LanguageCode
  targetLanguage: LanguageCode
  mode: "beginner" | "advanced"
}

export interface ChatMediator {
  prepareOutbound: (args: PrepareOutboundArgs) => Promise<MediatedChatInput>
  lessonify: (input: MediatedChatInput, recipient: LearnerPair) => Promise<MediatedChatArtifact>
  dispose: () => void
}

export type ChatMediatorEvents = {
  onToken?: (label: string, token: string) => void
  onDone?: (label: string, fullText: string) => void
}

function bounded(value: unknown, max = MAX_TEXT): string {
  return typeof value === "string" ? value.trim().slice(0, max) : ""
}

function mint(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function sourceText(input: MediatedChatInput): string {
  if (input.source.kind === "text") return input.source.text
  if (input.source.kind === "speech") return input.source.transcript
  return ""
}

function composeSafeRelayInput(
  args: PrepareOutboundArgs,
  outbound: SafeRelayOutbound,
): MediatedChatInput {
  return MediatedChatInput.parse({
    from: args.from,
    to: args.to,
    interactionId: args.interactionId,
    source: {
      kind: "text",
      text: bounded(outbound.relayText) || INBOUND_FALLBACK,
    },
    sourceLanguage: "en" as LanguageCode,
    targetLanguage: args.targetLanguage,
    mode: args.mode,
  })
}

function fallbackArtifact(
  input: MediatedChatInput,
  recipient: LearnerPair,
  reason: string,
): MediatedChatArtifact {
  return {
    artifactId: mint("artifact"),
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
  return MediatedChatArtifact.parse({
    artifactId: mint("artifact"),
    interactionId: input.interactionId,
    sourcePlayerId: input.from,
    targetPlayerId: input.to,
    sourceLanguage: input.sourceLanguage,
    targetLanguage: recipient.target,
    visibleText: bounded(lesson.targetText) || INBOUND_FALLBACK,
    naturalTranslation: bounded(lesson.nativeText) || undefined,
    suggestedReplies: lesson.suggestedReplies
      .map((label, index) => ({ id: `r${index}`, label: bounded(label, 80) }))
      .filter((reply) => reply.label),
    lessonNotes: [],
    moderation: {
      decision: lesson.state === "send" ? "allow" : "transform",
      reasons: lesson.reasons,
      confidence: lesson.state === "send" ? 0.9 : 1,
    },
    safetyClass: lesson.state === "send" ? "ok" : "softened",
  })
}

export function createChatMediator(hostApi: HostApi, events: ChatMediatorEvents = {}): ChatMediator {
  let disposed = false

  async function run(
    messages: SafeRelayChatMessage[],
    options: SafeRelayChatOptions,
    label = "relay",
  ): Promise<string> {
    if (disposed || !hostApi.llm) return ""
    return new Promise((resolve) => {
      let done = false
      let acc = ""
      let handle: { cancel: () => Promise<void> } | null = null
      const finish = (text: string) => {
        if (done) return
        done = true
        clearTimeout(timer)
        resolve(text)
      }
      const timer = setTimeout(() => {
        void handle?.cancel().catch(() => {})
        finish("")
      }, 20000)
      void hostApi.llm!
        .chat(
          { messages: messages as LlmChatMessage[], options: options as LlmChatOptions },
          {
            onToken: (token) => {
              acc += token
              events.onToken?.(label, token)
            },
            onDone: (full) => {
              const text = full || acc
              events.onDone?.(label, text)
              finish(text)
            },
            onError: () => {
              events.onDone?.(label, acc)
              finish("")
            },
          },
        )
        .then((started) => {
          handle = started
        })
        .catch(() => finish(""))
    })
  }

  const pipeline = createSafeRelayPipeline({
    runLlm: (messages, options, label) => run(messages, options, label),
    sampleSafePhrase: createHostSafePhraseSampler(hostApi),
  })

  return {
    async prepareOutbound(args) {
      const outbound = await pipeline.prepareOutbound({
        text: args.text,
        sourceLanguage: args.sourceLanguage,
        targetLanguage: args.targetLanguage,
        scope: args.interactionId,
      })
      return composeSafeRelayInput(args, outbound)
    },

    async lessonify(input, recipient) {
      const parsed = MediatedChatInput.safeParse(input)
      if (!parsed.success) return fallbackArtifact(input, recipient, "bad-input")
      const lesson = await pipeline.lessonify({
        relayText: sourceText(parsed.data),
        targetLanguage: recipient.target,
        nativeLanguage: recipient.native,
      })
      return artifactFromLesson(parsed.data, recipient, lesson)
    },

    dispose() {
      disposed = true
      pipeline.clear()
    },
  }
}
