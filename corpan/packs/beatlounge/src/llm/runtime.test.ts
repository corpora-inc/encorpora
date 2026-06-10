/**
 * beatlounge — runtime end-to-end tests with a FAKE llm chat double.
 *
 * Covers the full pipeline against a controllable model:
 *  • a model that streams a clean <<tool>> block → source "model"
 *  • a model that streams messy JSON → still interpreted via repair
 *  • a model that streams unusable prose first, then a valid block → "model-repair"
 *  • a model that always emits garbage → keyword fallback
 *  • no host LLM at all → keyword-no-llm
 *  • a model that stalls (never calls onDone) → watchdog → keyword fallback
 *  • the relative-tempo sentinel resolves against the live doc
 *
 * And the headline guarantee: EVERY utterance yields a legal, applyable command
 * list (user-visible success ~100%).
 */

import { describe, expect, it } from "vitest"
import { createLlmGridRuntime } from "./runtime"
import { TOOL_CLOSE, TOOL_OPEN } from "./protocol"
import { createCommandBus } from "../model/commandBus"
import { createBeatloungeStore } from "../store/store"
import { createDefaultDoc } from "../model/document"
import { reduce } from "../model/reduce"
import type { HostApi, LlmChatHandlers } from "../sdk/types"
import type { BeatloungeDoc } from "../model/document"
import type { Command } from "../model/command"

// ----------------------------------------------------------------- harness
const makeStore = () => {
  const bus = createCommandBus(createDefaultDoc(0))
  return createBeatloungeStore(bus)
}

/** A fake llm that streams a scripted reply (char by char) and calls onDone. */
type Replier = (userText: string, attempt: number) => string | null

const fakeHost = (replier?: Replier, opts?: { loaded?: boolean; stall?: boolean }): HostApi => {
  let attempt = 0
  const base: HostApi = {
    speak: () => {},
    getStackConfig: () => ({
      languages: ["en"],
      domains: [],
      levels: [],
      rate: 1,
      textSize: "medium",
      showRomanization: false,
    }),
    isMock: true,
  }
  if (!replier) return base // no llm
  return {
    ...base,
    llm: {
      status: async () => ({ loaded: opts?.loaded ?? true }),
      chat: async (args, handlers: LlmChatHandlers) => {
        const userMsg = [...args.messages].reverse().find((m) => m.role === "user")
        const reply = replier(userMsg?.content ?? "", attempt++)
        // Schedule async so the watchdog/race logic is exercised realistically.
        if (!opts?.stall) {
          queueMicrotask(() => {
            if (reply == null) {
              handlers.onError("no reply", "EMPTY")
              return
            }
            for (const ch of reply) handlers.onToken(ch)
            handlers.onDone(reply)
          })
        }
        return { sessionId: "fake", cancel: async () => {} }
      },
    },
  }
}

const block = (json: string) => `${TOOL_OPEN}${json}${TOOL_CLOSE}`

/** Apply a run result's commands through the reducer (proves they're legal). */
const applies = (doc: BeatloungeDoc, commands: Command[]): BeatloungeDoc =>
  commands.reduce((d, c) => reduce(d, c), doc)

// ----------------------------------------------------------------- tests
describe("runtime — model paths", () => {
  it("interprets a clean tool block as source 'model'", async () => {
    const store = makeStore()
    const host = fakeHost(() => block('{"name":"setTempo","args":{"bpm":128}}'))
    const rt = createLlmGridRuntime({ hostApi: host, store })
    const r = await rt.run("speed up please")
    expect(r.source).toBe("model")
    expect(r.call).toEqual({ name: "setTempo", args: { bpm: 128 } })
    expect(applies(store.vanilla.getState().doc, r.commands).bpm).toBe(128)
  })

  it("interprets MESSY model JSON via repair", async () => {
    const store = makeStore()
    const host = fakeHost(() => `Sure!\n${TOOL_OPEN}{name: density, args: {drum: hat, dir: more,}`)
    const rt = createLlmGridRuntime({ hostApi: host, store })
    const r = await rt.run("more hats")
    expect(r.source).toBe("model")
    expect(r.call.name).toBe("density")
  })

  it("uses the one-shot repair retry when the first reply is unusable", async () => {
    const store = makeStore()
    const host = fakeHost((_u, attempt) =>
      attempt === 0 ? "I cannot do that." : block('{"name":"setMood","args":{"mood":"dark"}}'),
    )
    const rt = createLlmGridRuntime({ hostApi: host, store })
    const r = await rt.run("make it darker")
    expect(r.source).toBe("model-repair")
    expect(r.call).toEqual({ name: "setMood", args: { mood: "dark" } })
  })

  it("rejects a hallucinated unknown tool, then falls back to keywords", async () => {
    const store = makeStore()
    // Always emits an unknown tool → both attempts fail validation → keyword.
    const host = fakeHost(() => block('{"name":"explode","args":{}}'))
    const rt = createLlmGridRuntime({ hostApi: host, store })
    const r = await rt.run("more hihats")
    expect(r.source).toBe("keyword")
    expect(r.call.name).toBe("density")
  })
})

describe("runtime — fallback paths", () => {
  it("no host LLM → keyword-no-llm", async () => {
    const store = makeStore()
    const rt = createLlmGridRuntime({ hostApi: fakeHost(), store })
    const r = await rt.run("latin feel")
    expect(r.source).toBe("keyword-no-llm")
    expect(r.call).toEqual({ name: "setMood", args: { mood: "latin" } })
  })

  it("a stalled model → watchdog → keyword fallback", async () => {
    const store = makeStore()
    const host = fakeHost(() => block('{"name":"setTempo","args":{"bpm":120}}'), { stall: true })
    const rt = createLlmGridRuntime({ hostApi: host, store, watchdogMs: 20 })
    const r = await rt.run("faster")
    expect(r.source).toBe("keyword")
    // relative tempo sentinel resolved against the live doc (96 → 108).
    expect(r.call).toEqual({ name: "setTempo", args: { bpm: 108 } })
  })

  it("resolves the relative-tempo sentinel from keyword route against live doc", async () => {
    const store = makeStore()
    const rt = createLlmGridRuntime({ hostApi: fakeHost(), store })
    const slower = await rt.run("slow it down")
    expect(slower.call).toEqual({ name: "setTempo", args: { bpm: 84 } }) // 96 - 12
  })
})

describe("runtime — llmAvailable", () => {
  it("reports false with no host llm", async () => {
    const rt = createLlmGridRuntime({ hostApi: fakeHost(), store: makeStore() })
    expect(await rt.llmAvailable()).toBe(false)
  })
  it("reports true when status.loaded", async () => {
    const rt = createLlmGridRuntime({ hostApi: fakeHost(() => block('{"name":"setSwing","args":{"amount":0.3}}')), store: makeStore() })
    expect(await rt.llmAvailable()).toBe(true)
  })
  it("reports false when the model is not loaded", async () => {
    const rt = createLlmGridRuntime({
      hostApi: fakeHost(() => block("{}"), { loaded: false }),
      store: makeStore(),
    })
    expect(await rt.llmAvailable()).toBe(false)
  })
})

describe("runtime — the headline guarantee (≈100% success)", () => {
  const utterances = [
    "more hihats",
    "make it darker",
    "latin feel",
    "tresillo on the kick",
    "loosen up the drums",
    "faster",
    "slower",
    "set the bpm to 140",
    "add swing",
    "fewer claps",
    "euclidean 5 over 8",
    "clear the drums",
    "asdfghjkl",
    "do something interesting",
    "🎵",
    "make it pop",
  ]

  it("EVERY utterance yields a legal, applyable command list — with a model", async () => {
    // A deliberately unreliable model: alternates garbage so both model + fallback fire.
    const store = makeStore()
    let n = 0
    const host = fakeHost(() => (n++ % 2 === 0 ? "uhh, not sure" : block('{"name":"density","args":{"dir":"more"}}')))
    const rt = createLlmGridRuntime({ hostApi: host, store, watchdogMs: 50 })
    for (const u of utterances) {
      const r = await rt.run(u)
      expect(r.call.name, `no call for "${u}"`).toBeTruthy()
      expect(() => applies(store.vanilla.getState().doc, r.commands)).not.toThrow()
    }
  })

  it("EVERY utterance yields a legal, applyable result — with NO model", async () => {
    // The guarantee: a known tool call + an applyable command list + a summary.
    // (A genuine no-op like "fewer claps" on an empty lane is a CORRECT musical
    // answer — it still returns a legal result with a human summary, not an error.)
    const store = makeStore()
    const rt = createLlmGridRuntime({ hostApi: fakeHost(), store })
    for (const u of utterances) {
      const r = await rt.run(u)
      expect(r.call.name, `no call for "${u}"`).toBeTruthy()
      expect(typeof r.summary, `no summary for "${u}"`).toBe("string")
      expect(() => applies(store.vanilla.getState().doc, r.commands)).not.toThrow()
    }
  })

  it("MOST utterances actually mutate the loop (no-ops are the exception)", async () => {
    const store = makeStore()
    const rt = createLlmGridRuntime({ hostApi: fakeHost(), store })
    let mutated = 0
    for (const u of utterances) {
      const r = await rt.run(u)
      if (r.commands.length > 0) mutated++
    }
    // At least the vast majority produce a real change.
    expect(mutated).toBeGreaterThanOrEqual(utterances.length - 1)
  })

  it("reroll with a fresh seed varies a stochastic result", async () => {
    const store = makeStore()
    const rt = createLlmGridRuntime({ hostApi: fakeHost(), store })
    const a = await rt.run("more hihats", { seed: 1 })
    const b = await rt.run("more hihats", { seed: 2 })
    // Different seeds → (very likely) different step picks.
    expect(JSON.stringify(a.commands)).not.toBe(JSON.stringify(b.commands))
  })
})
