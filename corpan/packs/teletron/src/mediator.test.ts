import { describe, expect, it } from "vitest"
import { MediatedChatInput, type LanguageCode } from "@corpan-city/contracts"
import { createChatMediator } from "./mediator.js"
import type {
  HostApi,
  LlmApi,
  LlmChatHandlers,
  LlmChatMessage,
  LlmChatOptions,
} from "../../corpan-city/src/npc/hostTypes"

// A long, benign translated message — well past the old 280-char MAX_TEXT cap,
// with no PII/links/places so the safe-relay pipeline keeps it verbatim. The
// distinctive tail is what a silent mid-word `.slice(0, 280)` would drop.
const LONG_TAIL = "and that is the very last clause the recipient must still read and hear."
const LONG_MESSAGE = [
  "I spent the whole afternoon describing how I learned to cook with my grandmother,",
  "how she taught me to taste the broth before adding salt, to chop the onions slowly,",
  "to let the stew rest so the flavors settle, and to always share the first bowl with a",
  "neighbor because a warm meal feels better when someone else is at the table too,",
  LONG_TAIL,
].join(" ")

// Build a host whose on-device LLM always streams the same long benign line, so
// every safe-relay stage (re-clean, translate-target, translate-native) yields
// the full text. We drive the REAL mediator/pipeline, not a reimplementation.
function hostReturning(text: string): HostApi {
  const llm = {
    chat: async (
      _args: { messages: LlmChatMessage[]; options?: LlmChatOptions },
      handlers: LlmChatHandlers,
    ) => {
      // Stream a couple of tokens then finish, mirroring the real runtime.
      handlers.onToken(text.slice(0, 10))
      handlers.onDone(text)
      return { sessionId: "s1", cancel: async () => {} }
    },
  } as unknown as LlmApi
  return { llm } as unknown as HostApi
}

describe("teletron mediator — no silent truncation of mediated chat", () => {
  it("keeps a long mediated message intact in visibleText (displayed + spoken)", async () => {
    const mediator = createChatMediator(hostReturning(LONG_MESSAGE))
    const input = MediatedChatInput.parse({
      from: "p1",
      to: "p2",
      interactionId: "i1",
      source: { kind: "text", text: LONG_MESSAGE },
      sourceLanguage: "en",
      targetLanguage: "de",
      mode: "advanced",
    })
    const artifact = await mediator.lessonify(input, {
      native: "en" as LanguageCode,
      target: "de" as LanguageCode,
    })
    mediator.dispose()

    // The whole message survives — both the bytes AND the final clause. A
    // `.slice(0, 280)` would have chopped the message mid-word and dropped the
    // tail; visibleText feeds both the bubble and speakNow().
    expect(artifact.visibleText.length).toBeGreaterThan(280)
    expect(artifact.visibleText).toContain(LONG_TAIL)
    expect(artifact.visibleText).toBe(LONG_MESSAGE)
    // The native gloss (shown as the small "detail" line) is likewise intact.
    expect(artifact.naturalTranslation).toBe(LONG_MESSAGE)
  })
})
