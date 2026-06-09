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

describe("safe relay pipeline — classify / paraphrase / regenerate / eject", () => {
  it("has native output primes for every Teletron language", () => {
    const manifest = JSON.parse(readFileSync(new URL("../../teletron/manifest.json", import.meta.url), "utf8")) as {
      displayName?: Record<string, string>
    }
    const missing = Object.keys(manifest.displayName ?? {}).filter((l) => !OUTPUT_LANGUAGE_PRIMES[l])
    expect(missing).toEqual([])
    expect(OUTPUT_LANGUAGE_PRIMES.te).toMatch(/[ఀ-౿]/)
  })

  it("classifies a safe message SAFE → paraphrase → regenerate, preserving the QUESTION form", async () => {
    const { pipeline, calls } = scriptedPipeline({
      "relay.classify": "SAFE",
      "relay.paraphrase": "Do you keep any pets?",
      "relay.regenerate": "Do you have a dog?",
    })
    const result = await pipeline.prepareOutbound({ text: "do you have any pets?", sourceLanguage: "en" })

    expect(result.relayText).toBe("Do you have a dog?")
    expect(result.state).toBe("send")
    expect(calls.map((c) => c.label)).toEqual(["relay.classify", "relay.paraphrase", "relay.regenerate"])
    const regen = calls.find((c) => c.label === "relay.regenerate")!
    // The regenerator is asked for a QUESTION (input ended with "?")…
    expect(regen.messages[0]?.content).toMatch(/question/i)
    // …and is given ONLY the laundered paraphrase, never the user's raw words.
    // (Keeping the safe subject word "pets" is the point — connection without UGC.)
    expect(userText(regen)).toBe("Do you keep any pets?")
    expect(promptText([regen])).not.toContain("do you have any pets?")
  })

  it("preserves the STATEMENT form for a non-question", async () => {
    const { pipeline, calls } = scriptedPipeline({
      "relay.classify": "SAFE",
      "relay.paraphrase": "They enjoy rainy weather.",
      "relay.regenerate": "Rain makes me calm.",
    })
    await pipeline.prepareOutbound({ text: "I love rainy days", sourceLanguage: "en" })
    // Statement form asks for a plain everyday remark (not a question).
    const regen = calls.find((c) => c.label === "relay.regenerate")!.messages[0]?.content ?? ""
    expect(regen).toMatch(/remark/i)
    expect(regen).not.toMatch(/keep it a question/i)
  })

  it("BLOCKs off-limits content to a corpus-phrase remix, querying the corpus by the input", async () => {
    const { pipeline, calls, queries } = scriptedPipeline(
      { "relay.classify": "BLOCK", "relay.phrase-eject": "I left my mug in the fridge." },
      "Where did you put my favorite mug?",
    )
    const raw = "meet me behind the school at 9pm, here's my number 555-123-4567"
    const result = await pipeline.prepareOutbound({ text: raw, sourceLanguage: "en" })

    expect(result.relayText).toBe("I left my mug in the fridge.")
    expect(result.state).toBe("replaced")
    expect(result.reasons).toContain("phrase-eject")
    // No paraphrase on the BLOCK path — the off-limits text is never restated.
    expect(calls.map((c) => c.label)).toEqual(["relay.classify", "relay.phrase-eject"])
    // The corpus was queried with the user's line (FTS5 in prod) …
    expect(queries.at(-1)).toBe(raw)
    // … and the eject prompt is built from the SAMPLED phrase, not the user's text.
    expect(promptText([calls.find((c) => c.label === "relay.phrase-eject")!])).toContain("favorite mug")
  })

  it("treats any non-SAFE verdict as off-limits (fail safe)", async () => {
    const { pipeline, calls } = scriptedPipeline({
      "relay.classify": "hmm, maybe",
      "relay.phrase-eject": "I left my mug in the fridge.",
    })
    const result = await pipeline.prepareOutbound({ text: "where do you live?", sourceLanguage: "en" })
    expect(result.state).toBe("replaced")
    expect(calls.map((c) => c.label)).toEqual(["relay.classify", "relay.phrase-eject"])
  })

  it("never lets the user's raw text reach the regenerate or eject step (the firewall)", async () => {
    const secret = "my address is 42 Wallaby Way and my name is Bruce"
    // BLOCK path: nothing downstream of classify sees the raw text.
    const block = scriptedPipeline({ "relay.classify": "BLOCK", "relay.phrase-eject": "ok" })
    await block.pipeline.prepareOutbound({ text: secret, sourceLanguage: "en" })
    for (const c of block.calls.filter((x) => x.label === "relay.phrase-eject")) {
      expect(userText(c) + (c.messages[0]?.content ?? "")).not.toContain("Wallaby")
      expect(userText(c)).not.toContain("Bruce")
    }
    // SAFE path: the paraphrase is the laundering step (it may see raw), but the
    // regenerate that produces the relay only ever sees the laundered paraphrase.
    const safe = scriptedPipeline({ "relay.classify": "SAFE", "relay.paraphrase": "They mentioned their neighbourhood.", "relay.regenerate": "ok" })
    await safe.pipeline.prepareOutbound({ text: secret, sourceLanguage: "en" })
    const regen = safe.calls.find((c) => c.label === "relay.regenerate")!
    expect(userText(regen) + (regen.messages[0]?.content ?? "")).not.toContain("Wallaby")
    expect(userText(regen)).not.toContain("Bruce")
  })

  it("never feeds raw UGC forward when the paraphrase fails on the SAFE path", async () => {
    // If the laundering paraphrase returns empty/junk, the pipeline must fall back
    // to a safe corpus seed — NEVER hand the raw message to regenerate (old bug:
    // `seed = paraphrase || raw`).
    const secret = "my name is Bruce and I live at 42 Wallaby Way"
    const { pipeline, calls, result } = await (async () => {
      const sp = scriptedPipeline(
        { "relay.classify": "SAFE", "relay.paraphrase": "", "relay.regenerate": secret },
        "I made soup today.",
      )
      const result = await sp.pipeline.prepareOutbound({ text: secret, sourceLanguage: "en" })
      return { ...sp, result }
    })()
    // regenerate must NOT have been invoked with the raw text...
    for (const c of calls.filter((x) => x.label === "relay.regenerate")) {
      expect(userText(c)).not.toContain("Wallaby")
      expect(userText(c)).not.toContain("Bruce")
    }
    // ...and the relay output is a safe replacement, not the raw secret.
    expect(result.relayText).not.toContain("Wallaby")
    expect(result.relayText).not.toContain("Bruce")
    expect(result.state).toBe("replaced")
  })

  it("scrub backstop strips structural PII the regenerator might echo", async () => {
    const { pipeline } = scriptedPipeline({
      "relay.classify": "SAFE",
      "relay.paraphrase": "They shared how to reach them.",
      "relay.regenerate": "reach me at a@b.com or 5551234567",
    })
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
