import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  OUTPUT_LANGUAGE_PRIMES,
  createSafeRelayPipeline,
  type SafeRelayChatMessage,
  type SafeRelayChatOptions,
} from "./index"

type Call = { label: string; messages: SafeRelayChatMessage[]; options: SafeRelayChatOptions }

// Scripted LLM keyed by label substring, so tests don't depend on call order.
function scriptedPipeline(byLabel: Record<string, string>, phrase = "I made soup today.") {
  const calls: Call[] = []
  const queries: Array<string | undefined> = []
  const pipeline = createSafeRelayPipeline({
    sampleSafePhrase: async (_lang, query) => {
      if (query !== undefined) queries.push(query)
      return phrase
    },
    runLlm: async (messages, options, label) => {
      calls.push({ label, messages, options })
      const key = Object.keys(byLabel).find((k) => label.includes(k))
      return key ? byLabel[key] : ""
    },
  })
  return { pipeline, calls, queries }
}

const promptText = (calls: Call[]) => calls.flatMap((c) => c.messages.map((m) => m.content)).join("\n")
const userText = (call?: Call) => call?.messages.find((m) => m.role === "user")?.content ?? ""

describe("safe relay pipeline — gate / eject / regenerate", () => {
  it("has native output primes for every Teletron language", () => {
    const manifest = JSON.parse(readFileSync(new URL("../../teletron/manifest.json", import.meta.url), "utf8")) as {
      displayName?: Record<string, string>
    }
    const missing = Object.keys(manifest.displayName ?? {}).filter((l) => !OUTPUT_LANGUAGE_PRIMES[l])
    expect(missing).toEqual([])
    expect(OUTPUT_LANGUAGE_PRIMES.te).toMatch(/[ఀ-౿]/)
  })

  it("gates a safe message to an on-topic regenerate, preserving the QUESTION form", async () => {
    const { pipeline, calls } = scriptedPipeline({ "relay.gate": "pets", "relay.regenerate": "Do you have a dog?" })
    const result = await pipeline.prepareOutbound({ text: "do you have any pets?", sourceLanguage: "en" })

    expect(result.relayText).toBe("Do you have a dog?")
    expect(calls.map((c) => c.label)).toEqual(["relay.gate", "relay.regenerate"])
    const regen = calls.find((c) => c.label === "relay.regenerate")!
    // The regenerator is asked for a QUESTION (input ended with "?")…
    expect(regen.messages[0]?.content).toMatch(/question/i)
    // …and is given ONLY the topic label, never the user's raw words.
    expect(userText(regen)).toBe("Topic: pets")
    expect(promptText([regen])).not.toContain("pets?")
  })

  it("preserves the STATEMENT form for a non-question", async () => {
    const { pipeline, calls } = scriptedPipeline({ "relay.gate": "weather", "relay.regenerate": "Rain makes me calm." })
    await pipeline.prepareOutbound({ text: "I love rainy days", sourceLanguage: "en" })
    expect(calls.find((c) => c.label === "relay.regenerate")!.messages[0]?.content).toMatch(/statement/i)
  })

  it("EJECTs off-limits content to a corpus-phrase remix, querying the corpus by the input", async () => {
    const { pipeline, calls, queries } = scriptedPipeline(
      { "relay.gate": "EJECT", "relay.phrase-eject": "I left my mug in the fridge." },
      "Where did you put my favorite mug?",
    )
    const raw = "meet me behind the school at 9pm, here's my number 555-123-4567"
    const result = await pipeline.prepareOutbound({ text: raw, sourceLanguage: "en" })

    expect(result.relayText).toBe("I left my mug in the fridge.")
    expect(result.state).toBe("replaced")
    expect(result.reasons).toContain("phrase-eject")
    expect(calls.map((c) => c.label)).toEqual(["relay.gate", "relay.phrase-eject"])
    // The corpus was queried with the user's line (FTS5 in prod) …
    expect(queries.at(-1)).toBe(raw)
    // … and the eject prompt is built from the SAMPLED phrase, not the user's text.
    expect(promptText([calls.find((c) => c.label === "relay.phrase-eject")!])).toContain("favorite mug")
  })

  it("never lets the user's raw text reach the regenerate or eject step (the firewall)", async () => {
    const secret = "my address is 42 Wallaby Way and my name is Bruce"
    for (const gate of ["EJECT", "neighbours"]) {
      const { calls } = await (async () => {
        const sp = scriptedPipeline({ "relay.gate": gate, "relay.regenerate": "ok", "relay.phrase-eject": "ok" })
        await sp.pipeline.prepareOutbound({ text: secret, sourceLanguage: "en" })
        return sp
      })()
      // The gate alone is allowed to see the raw text; nothing downstream may.
      for (const c of calls.filter((x) => x.label !== "relay.gate")) {
        expect(userText(c) + (c.messages[0]?.content ?? "")).not.toContain("Wallaby")
        expect(userText(c)).not.toContain("Bruce")
      }
    }
  })

  it("scrub backstop strips structural PII the regenerator might echo", async () => {
    const { pipeline } = scriptedPipeline({ "relay.gate": "contact", "relay.regenerate": "reach me at a@b.com or 5551234567" })
    const result = await pipeline.prepareOutbound({ text: "what's up", sourceLanguage: "en" })
    expect(result.relayText).not.toContain("a@b.com")
    expect(result.relayText).not.toMatch(/\d{7,}/)
  })

  it("recipient side cleans independently and translates target/native with separate calls", async () => {
    const { pipeline, calls } = scriptedPipeline({
      "recipient-clean": "Would you like to play soccer?",
      "translate-target.es": "¿Te gustaría jugar al fútbol?",
      "translate-native.en": "Would you like to play soccer?",
      "replies.es": "¡Sí, vamos!\nClaro, juguemos.",
    })
    const lesson = await pipeline.lessonify({ relayText: "Would you like to play soccer?", targetLanguage: "es", nativeLanguage: "en" })
    expect(lesson.targetText).toBe("¿Te gustaría jugar al fútbol?")
    expect(lesson.nativeText).toBe("Would you like to play soccer?")
    expect(lesson.suggestedReplies).toEqual(["¡Sí, vamos!", "Claro, juguemos."])
    expect(calls.map((c) => c.label)).toEqual([
      "relay.recipient-clean",
      "relay.translate-target.es",
      "relay.translate-native.en",
      "relay.replies.es",
    ])
  })

  it("translates with a fully in-language directive and injects the CEFR band", async () => {
    const { pipeline, calls } = scriptedPipeline({
      "recipient-clean": "Let's talk about music.",
      "translate-target.ja": "音楽について話しましょう。",
      "translate-native.es": "Hablemos de música.",
      "replies.ja": "いいですね。",
    })
    await pipeline.lessonify({ relayText: "Let's talk about music.", targetLanguage: "ja", nativeLanguage: "es", level: "A2" })
    const ja = calls.find((c) => c.label === "relay.translate-target.ja")!.messages[0]?.content ?? ""
    expect(ja).toContain("自然な日本語に翻訳")
    expect(ja).not.toContain("Translate the English")
    expect(ja).not.toContain("{level}")
    expect(ja).toContain("とても簡単で")
    const es = calls.find((c) => c.label === "relay.translate-native.es")!.messages[0]?.content ?? ""
    expect(es).toContain("Traduce al español")
  })

  it("falls back to a primed English body for an unsupported language", async () => {
    const { pipeline, calls } = scriptedPipeline({
      "recipient-clean": "Let's talk about music.",
      "translate-target.tl": "...",
      "translate-native.en": "...",
      "replies.tl": "...",
    })
    await pipeline.lessonify({ relayText: "Let's talk about music.", targetLanguage: "tl", nativeLanguage: "en" })
    const tl = calls.find((c) => c.label === "relay.translate-target.tl")!.messages[0]?.content ?? ""
    expect(tl).toContain("Translate the English chat line into tl")
  })
})
