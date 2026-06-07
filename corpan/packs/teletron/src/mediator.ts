import {
  MediatedChatArtifact,
  MediatedChatInput,
  type LanguageCode,
  type LearnerPair,
  type PlayerId,
} from "@corpan-city/contracts"
import type { HostApi, LlmChatMessage, LlmChatOptions } from "../../corpan-city/src/npc/hostTypes"

const MAX_TEXT = 280
const CONTACT =
  /(?:https?:\/\/|www\.|[\w.+-]+@[\w.-]+\.[a-z]{2,}|@\w{2,}|\+?\d[\d\s().-]{6,}\d)/i
const OUTBOUND_FALLBACK = "My translator got a little goofy. Let's change the subject."
const INBOUND_FALLBACK = "Their translator got a little goofy. Try another message."

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

function bounded(value: unknown, max = MAX_TEXT): string {
  return typeof value === "string" ? value.trim().slice(0, max) : ""
}

function parseObject<T extends object>(raw: string): T | null {
  try {
    const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
    const body = (fence?.[1] ?? raw).trim()
    const start = body.indexOf("{")
    const end = body.lastIndexOf("}")
    if (start < 0 || end < start) return null
    const parsed = JSON.parse(body.slice(start, end + 1))
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as T) : null
  } catch {
    return null
  }
}

function mint(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function sourceText(input: MediatedChatInput): string {
  if (input.source.kind === "text") return input.source.text
  if (input.source.kind === "speech") return input.source.transcript
  return ""
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
    suggestedReplies: [],
    lessonNotes: [],
    moderation: { decision: "transform", reasons: [reason], confidence: 1 },
    safetyClass: "softened",
  }
}

export function createChatMediator(hostApi: HostApi): ChatMediator {
  let disposed = false

  async function run(messages: LlmChatMessage[], options: LlmChatOptions): Promise<string> {
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
          { messages, options },
          {
            onToken: (token) => {
              acc += token
            },
            onDone: (full) => finish(full || acc),
            onError: () => finish(""),
          },
        )
        .then((started) => {
          handle = started
        })
        .catch(() => finish(""))
    })
  }

  return {
    async prepareOutbound(args) {
      const raw = bounded(args.text)
      const messages: LlmChatMessage[] = [
        {
          role: "system",
          content:
            "Rewrite this message into a short friendly safe intent before it leaves the device. " +
            "Preserve language, meaning, personality, and humor when safe. Remove links, contact " +
            "details, addresses, attempts to meet, coercion, threats, sexual content, targeted " +
            "abuse, and identifying details. Never include removed material. Reply ONLY as JSON: " +
            '{"cleaned":"safe intent","blocked":false}.',
        },
        { role: "user", content: raw },
      ]
      const result = parseObject<{ cleaned?: string }>(
        await run(messages, { temperature: 0.2, topP: 0.8, maxTokens: 180 }),
      )
      const cleaned = bounded(result?.cleaned)
      return MediatedChatInput.parse({
        ...args,
        source: {
          kind: "text",
          text: cleaned && !CONTACT.test(cleaned) ? cleaned : OUTBOUND_FALLBACK,
        },
      })
    },

    async lessonify(input, recipient) {
      const parsed = MediatedChatInput.safeParse(input)
      if (!parsed.success) return fallbackArtifact(input, recipient, "bad-input")
      const messages: LlmChatMessage[] = [
        {
          role: "system",
          content:
            "Independently safety-check this already-cleaned peer message. Preserve its meaning " +
            `and personality. Render it naturally in ${recipient.target}, then its meaning in ` +
            `${recipient.native}. Remove links, contact details, addresses, attempts to meet, ` +
            "coercion, threats, sexual content, targeted abuse, and identifying details. Reply " +
            'ONLY as JSON: {"target":"...","native":"...","blocked":false}.',
        },
        { role: "user", content: sourceText(parsed.data) },
      ]
      const result = parseObject<{ target?: string; native?: string; blocked?: boolean }>(
        await run(messages, { temperature: 0.25, topP: 0.85, maxTokens: 240 }),
      )
      const target = bounded(result?.target)
      const native = bounded(result?.native)
      if (!target || CONTACT.test(target) || CONTACT.test(native)) {
        return fallbackArtifact(parsed.data, recipient, "recipient-output-unverified")
      }
      return MediatedChatArtifact.parse({
        artifactId: mint("artifact"),
        interactionId: parsed.data.interactionId,
        sourcePlayerId: parsed.data.from,
        targetPlayerId: parsed.data.to,
        sourceLanguage: parsed.data.sourceLanguage,
        targetLanguage: recipient.target,
        visibleText: target,
        naturalTranslation: native || undefined,
        suggestedReplies: [],
        lessonNotes: [],
        moderation: {
          decision: result?.blocked ? "transform" : "allow",
          reasons: result?.blocked ? ["sender-intent-softened"] : [],
          confidence: 0.85,
        },
        safetyClass: result?.blocked ? "softened" : "ok",
      })
    },

    dispose() {
      disposed = true
    },
  }
}
