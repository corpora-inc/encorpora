import { describe, it, expect } from "vitest"
import type { MediatedChatInput, PlayerId, LanguageCode } from "@world-plaza/contracts"
import type { HostApi, LlmChatHandlers } from "../npc/hostTypes"
import type { ModelBroker } from "../npc/modelBroker"
import { createChatMediator, composeOutbound, passthroughArtifact } from "./mediatedChat"

const INPUT: MediatedChatInput = {
  from: "p-1" as PlayerId,
  to: "p-2" as PlayerId,
  interactionId: "ix-1",
  source: { kind: "text", text: "buenos días" },
  sourceLanguage: "es" as LanguageCode,
  targetLanguage: "en" as LanguageCode,
  mode: "beginner",
}

/** A broker stub that reports the LLM ready (or not). */
function brokerStub(ready: boolean): ModelBroker {
  return {
    ensureLLM: async () => ({ ready, reason: ready ? undefined : "not-installed" }),
    releaseLLM: () => {},
    onBackground: () => {},
    status: () => ({ llmLoaded: ready, inProcessLargeModel: "none", busy: false, idleMsRemaining: null }),
    llmAvailable: async () => ready,
    canLoadWhisper: () => true,
    claimWhisperSlot: () => () => {},
    dispose: async () => {},
  } as ModelBroker
}

/** A host whose llm.chat streams a fixed full text via onDone. */
function hostWithLlm(full: string): HostApi {
  return {
    speak: async () => {},
    llm: {
      status: async () => ({ loaded: true }),
      isInstalled: async () => true,
      load: async () => {},
      unload: async () => {},
      chat: async (_args: unknown, handlers: LlmChatHandlers) => {
        handlers.onDone(full)
        return { sessionId: "s", cancel: async () => {} }
      },
    },
  } as unknown as HostApi
}

describe("composeOutbound", () => {
  it("wraps text into a typed input with the language pair", () => {
    const out = composeOutbound({
      from: "p-1" as PlayerId,
      to: "p-2" as PlayerId,
      interactionId: "ix",
      text: "hi",
      sourceLanguage: "en" as LanguageCode,
      targetLanguage: "es" as LanguageCode,
      mode: "beginner",
    })
    expect(out.source).toEqual({ kind: "text", text: "hi" })
    expect(out.sourceLanguage).toBe("en")
  })
})

describe("mediated chat lessonify", () => {
  it("degrades to a clean passthrough when there is no host LLM", async () => {
    const host = { speak: async () => {} } as unknown as HostApi
    const m = createChatMediator(host, brokerStub(false))
    const art = await m.lessonify(INPUT, "en" as LanguageCode)
    expect(art.visibleText).toBe("buenos días")
    expect(art.naturalTranslation).toBeUndefined()
    expect(art.moderation.reasons).toContain("no-host-llm")
  })

  it("degrades to passthrough when the model isn't ready", async () => {
    const host = hostWithLlm("{}")
    const m = createChatMediator(host, brokerStub(false))
    const art = await m.lessonify(INPUT, "en" as LanguageCode)
    expect(art.visibleText).toBe("buenos días")
  })

  it("produces a teaching artifact from the model's fenced JSON", async () => {
    const json =
      '```json\n{"natural":"Good morning","original":"buenos días",' +
      '"translit":"","gloss":"good days","replies":["buenos días","¿cómo estás?"],' +
      '"note":"A common morning greeting.","blocked":false}\n```'
    const host = hostWithLlm(json)
    const m = createChatMediator(host, brokerStub(true))
    const art = await m.lessonify(INPUT, "en" as LanguageCode)
    expect(art.visibleText).toBe("Good morning")
    expect(art.learnerText).toBe("buenos días")
    expect(art.naturalTranslation).toBe("Good morning")
    expect(art.suggestedReplies).toHaveLength(2)
    expect(art.lessonNotes[0]?.text).toContain("morning")
    expect(art.safetyClass).toBe("ok")
  })

  it("softens a blocked message", async () => {
    const json = '```json\n{"natural":"(hi)","original":"call me 555","blocked":true}\n```'
    const host = hostWithLlm(json)
    const m = createChatMediator(host, brokerStub(true))
    const art = await m.lessonify(INPUT, "en" as LanguageCode)
    expect(art.safetyClass).toBe("softened")
    expect(art.moderation.decision).toBe("transform")
  })

  it("falls back to passthrough on unparseable model output", async () => {
    const host = hostWithLlm("sorry, I cannot help with that")
    const m = createChatMediator(host, brokerStub(true))
    const art = await m.lessonify(INPUT, "en" as LanguageCode)
    expect(art.visibleText).toBe("buenos días")
  })
})

describe("passthroughArtifact", () => {
  it("carries the original text and a reason", () => {
    const art = passthroughArtifact(INPUT, "test")
    expect(art.visibleText).toBe("buenos días")
    expect(art.moderation.reasons).toContain("test")
  })
})
