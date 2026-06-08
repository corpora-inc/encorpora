import { describe, expect, it, vi } from "vitest"
import type {
  LanguageCode,
  LearnerPair,
  MediatedChatInput,
  PlayerId,
} from "@corpan-city/contracts"
import type { HostApi, LlmChatHandlers, LlmChatMessage } from "../npc/hostTypes"
import type { ModelBroker } from "../npc/modelBroker"
import { createChatMediator, type PrepareOutboundArgs } from "./mediatedChat"

const A_TO_B: PrepareOutboundArgs = {
  from: "p-ar" as PlayerId,
  to: "p-en" as PlayerId,
  interactionId: "ix-1",
  text: "bonjour, on joue au foot ?",
  sourceLanguage: "fr" as LanguageCode,
  targetLanguage: "fr" as LanguageCode,
  mode: "beginner",
}

const B_PAIR = {
  native: "en",
  target: "es",
} as LearnerPair

const bannedRelayTerm = new RegExp("\\bin" + "tent\\b", "i")

function brokerStub(ready: boolean): ModelBroker {
  return {
    ensureLLM: async () => ({ ready, reason: ready ? undefined : "not-installed" }),
    releaseLLM: vi.fn(),
    onBackground: () => {},
    status: () => ({ llmLoaded: ready, inProcessLargeModel: "none", busy: false, idleMsRemaining: null }),
    llmAvailable: async () => ready,
    canLoadWhisper: () => true,
    claimWhisperSlot: () => () => {},
    dispose: async () => {},
  } as ModelBroker
}

function hostWithResponses(responses: string[]) {
  const calls: LlmChatMessage[][] = []
  const host = {
    speak: async () => {},
    llm: {
      status: async () => ({ loaded: true }),
      isInstalled: async () => true,
      load: async () => {},
      unload: async () => {},
      chat: async (
        args: { messages: LlmChatMessage[] },
        handlers: LlmChatHandlers,
      ) => {
        calls.push(args.messages)
        handlers.onDone(responses.shift() ?? "")
        return { sessionId: "s", cancel: async () => {} }
      },
    },
  } as unknown as HostApi
  return { host, calls }
}

function cleanedRelay(text = "Do you want to play soccer?"): MediatedChatInput {
  return {
    from: A_TO_B.from,
    to: A_TO_B.to,
    interactionId: A_TO_B.interactionId,
    source: { kind: "text", text },
    sourceLanguage: "en" as LanguageCode,
    targetLanguage: A_TO_B.targetLanguage,
    mode: A_TO_B.mode,
  }
}

describe("two-sided mediated chat", () => {
  it("never sends raw text when the author's LLM is unavailable", async () => {
    const raw = "call me at +1 555 867 5309"
    const mediator = createChatMediator(
      { speak: async () => {} } as HostApi,
      brokerStub(false),
    )
    const input = await mediator.prepareOutbound({ ...A_TO_B, text: raw })
    expect(input.source).not.toEqual({ kind: "text", text: raw })
    expect(JSON.stringify(input)).not.toContain("555")
  })

  it("uses the author's local LLM to produce safe relay text before sending", async () => {
    const { host, calls } = hostWithResponses([
      "Do you want to play soccer?",
      "Do you want to play soccer?",
      "Do you want to play soccer?",
      "Do you want to play soccer?",
      "Do you want to play soccer?",
      "Do you want to play soccer?",
      "Do you want to play soccer?",
    ])
    const mediator = createChatMediator(host, brokerStub(true))
    const input = await mediator.prepareOutbound(A_TO_B)
    expect(input.source).toEqual({ kind: "text", text: "Do you want to play soccer?" })
    expect(input.sourceLanguage).toBe("en")
    expect(calls[0]?.[0]?.content).toContain("Translate this learner chat line into clear")
    expect(JSON.stringify(calls)).not.toMatch(/json/i)
    expect(JSON.stringify(calls)).not.toMatch(bannedRelayTerm)
  })

  it("replaces an author's unverified or contact-bearing model output", async () => {
    const { host } = hostWithResponses([
      "message me at https://example.com",
    ])
    const mediator = createChatMediator(host, brokerStub(true))
    const input = await mediator.prepareOutbound(A_TO_B)
    expect(JSON.stringify(input)).not.toContain("example.com")
    expect(input.source.kind === "text" ? input.source.text : "").toBeTruthy()
  })

  it("recipient independently cleans and translates relay text into their learning language", async () => {
    const { host, calls } = hostWithResponses([
      "Want to play soccer?",
      "¿Jugamos al fútbol?",
      "Want to play soccer?",
      "¡Sí, vamos!",
    ])
    const mediator = createChatMediator(host, brokerStub(true))
    const artifact = await mediator.lessonify(cleanedRelay(), B_PAIR)
    expect(artifact.visibleText).toBe("¿Jugamos al fútbol?")
    expect(artifact.naturalTranslation).toBe("Want to play soccer?")
    expect(artifact.targetLanguage).toBe("es")
    expect(artifact.suggestedReplies[0]?.label).toBe("¡Sí, vamos!")
    expect(calls.map((call) => call[0]?.content).join("\n")).toContain(
      "Independently clean this already-transformed English relay text",
    )
    expect(calls.map((call) => call[0]?.content).join("\n")).toContain("Translate the English relay text into es")
    expect(JSON.stringify(calls)).not.toMatch(/json/i)
    expect(JSON.stringify(calls)).not.toMatch(bannedRelayTerm)
  })

  it("recipient gets a playful safe rewrite when serious content is flagged", async () => {
    const { host } = hostWithResponses([
      "Someone is changing the subject kindly.",
      "Alguien cambia de tema con amabilidad.",
      "Someone is changing the subject kindly.",
      "¿Qué música te gusta?",
    ])
    const mediator = createChatMediator(host, brokerStub(true))
    const artifact = await mediator.lessonify(cleanedRelay("unsafe relay text"), B_PAIR)
    expect(artifact.visibleText).toContain("amabilidad")
    expect(artifact.safetyClass).toBe("softened")
    expect(artifact.moderation.decision).toBe("transform")
  })

  it("never reveals received relay text when the recipient pass is unavailable or invalid", async () => {
    const secret = "received relay text that must not be shown without pass two"
    const noLlm = createChatMediator(
      { speak: async () => {} } as HostApi,
      brokerStub(false),
    )
    const unavailable = await noLlm.lessonify(cleanedRelay(secret), B_PAIR)
    expect(unavailable.visibleText).not.toContain(secret)
    expect(unavailable.safetyClass).toBe("softened")

    const { host } = hostWithResponses(["not json"])
    const invalid = await createChatMediator(host, brokerStub(true)).lessonify(
      cleanedRelay(secret),
      B_PAIR,
    )
    expect(invalid.visibleText).not.toContain(secret)
  })

  it("runs both local model passes without putting the author's raw text on the wire", async () => {
    const author = hostWithResponses([
      "Do you want to play soccer?",
      "Do you want to play soccer?",
      "Do you want to play soccer?",
      "Do you want to play soccer?",
      "Do you want to play soccer?",
      "Do you want to play soccer?",
    ])
    const recipient = hostWithResponses([
      "Want to play soccer?",
      "¿Jugamos al fútbol?",
      "Want to play soccer?",
      "¡Claro!",
    ])
    const outbound = await createChatMediator(author.host, brokerStub(true)).prepareOutbound({
      ...A_TO_B,
      text: "bonjour, on joue au foot ? +1 555 867 5309",
    })
    expect(JSON.stringify(outbound)).not.toContain("555")

    const artifact = await createChatMediator(recipient.host, brokerStub(true)).lessonify(
      outbound,
      B_PAIR,
    )
    expect(artifact.visibleText).toBe("¿Jugamos al fútbol?")
    expect(artifact.naturalTranslation).toBe("Want to play soccer?")
  })
})
