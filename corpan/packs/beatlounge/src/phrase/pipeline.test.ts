import { describe, it, expect } from "vitest"
import {
  resolvePhraseContent,
  phraseLanguageCodes,
  scaleDegreeSemis,
  buildClip,
  buildSynthVoxClip,
  clipToCommands,
} from "./pipeline"
import type { AudioSource, ResolvedFragmentAudio } from "./audioSource"
import type { EntryOut, HostApi, StackConfig } from "../sdk/types"
import { PPQ, tickForStep, stepsInLoop } from "../model/timing"
import { isFragmentTrack } from "../model/document"

const entry: EntryOut = {
  entry_id: 42,
  level: "A1",
  domains: ["travel"],
  source: "base",
  translations: [
    { language_code: "en", text: "let's go" },
    { language_code: "es", text: "vamos ahora", romanization: undefined },
  ],
}

const cjkEntry: EntryOut = {
  entry_id: 7,
  level: "A2",
  domains: [],
  source: "base",
  translations: [
    { language_code: "en", text: "hello" },
    { language_code: "ja", text: "こんにちは", romanization: "konnichiwa" },
  ],
}

/** A deterministic fake AudioSource — always synthVox floor, no IDB. */
const fakeAudioSource = (): AudioSource => ({
  async resolveFragmentAudio(text, lang): Promise<ResolvedFragmentAudio> {
    return {
      hash: `h_${lang}_${text}`,
      tier: "synthVox",
      text,
      language: lang,
      durationSec: 0.4,
    }
  },
  async getCachedAudio() {
    return null
  },
})

const fakeHost = (): HostApi => ({
  speak: () => {},
  getStackConfig: (): StackConfig => ({
    languages: ["en", "es"],
    domains: [],
    levels: [],
    rate: 1,
    textSize: "medium",
    showRomanization: true,
  }),
})

describe("resolvePhraseContent", () => {
  it("maps native gloss + target text for a two-language stack", () => {
    const c = resolvePhraseContent(entry, ["en", "es"])
    expect(c.targetLang).toBe("es")
    expect(c.nativeLang).toBe("en")
    expect(c.phraseText).toBe("vamos ahora")
    expect(c.gloss).toBe("let's go")
  })

  it("single-language stack: target is the one language, no native gloss", () => {
    const c = resolvePhraseContent(entry, ["es"])
    expect(c.targetLang).toBe("es")
    expect(c.nativeLang).toBeNull()
    expect(c.phraseText).toBe("vamos ahora")
    expect(c.gloss).toBe("")
  })

  it("carries romanization through", () => {
    const c = resolvePhraseContent(cjkEntry, ["en", "ja"])
    expect(c.romanization).toBe("konnichiwa")
  })
})

describe("phraseLanguageCodes", () => {
  it("returns [native, target] deduped", () => {
    expect(phraseLanguageCodes(["en", "es"])).toEqual(["en", "es"])
  })
  it("single language ⇒ one code", () => {
    expect(phraseLanguageCodes(["es"])).toEqual(["es"])
  })
})

describe("scaleDegreeSemis (major pentatonic, climbing)", () => {
  it("walks the pentatonic and wraps an octave up", () => {
    expect([0, 1, 2, 3, 4, 5].map(scaleDegreeSemis)).toEqual([0, 2, 4, 7, 9, 12])
  })
  it("is monotonically non-decreasing", () => {
    let prev = -Infinity
    for (let n = 0; n < 16; n++) {
      const v = scaleDegreeSemis(n)
      expect(v).toBeGreaterThanOrEqual(prev)
      prev = v
    }
  })
})

describe("buildClip — stack mode (the riff)", () => {
  it("places ONE word on every step with an ascending in-scale pitch", async () => {
    const content = resolvePhraseContent(entry, ["en", "es"])
    const clip = await buildClip(
      { audioSource: fakeAudioSource(), hostApi: fakeHost() },
      { content, mode: "stack" }
    )
    const steps = stepsInLoop(PPQ * 4, { denominator: 16 })
    expect(clip.fragments).toHaveLength(1)
    expect(clip.steps).toHaveLength(steps)
    // every step references the single fragment, pitch climbs the scale
    expect(clip.steps.every((s) => s.fragmentIndex === 0)).toBe(true)
    expect(clip.steps.map((s) => s.pitchSemis)).toEqual(
      Array.from({ length: steps }, (_v, i) => scaleDegreeSemis(i))
    )
    expect(clip.fragments[0].text).toBe("vamos") // first token of "vamos ahora"
  })
})

describe("buildClip — scatter mode (phrase across the bar)", () => {
  it("lays each token on a successive step at root pitch", async () => {
    const content = resolvePhraseContent(entry, ["en", "es"])
    const clip = await buildClip(
      { audioSource: fakeAudioSource(), hostApi: fakeHost() },
      { content, mode: "scatter" }
    )
    expect(clip.fragments.map((f) => f.text)).toEqual(["vamos", "ahora"])
    expect(clip.steps.map((s) => s.step)).toEqual([0, 1])
    expect(clip.steps.every((s) => s.pitchSemis === 0)).toBe(true)
  })

  it("tokenizes a no-space target per character", async () => {
    const content = resolvePhraseContent(cjkEntry, ["en", "ja"])
    const clip = await buildClip(
      { audioSource: fakeAudioSource(), hostApi: fakeHost() },
      { content, mode: "scatter" }
    )
    expect(clip.fragments.map((f) => f.text)).toEqual(["こ", "ん", "に", "ち", "は"])
  })
})

describe("clipToCommands — valid command sequence", () => {
  it("emits registerFragment(s) → addTrack(FragmentTrack) → placeFragment(s)", async () => {
    const content = resolvePhraseContent(entry, ["en", "es"])
    const clip = await buildClip(
      { audioSource: fakeAudioSource(), hostApi: fakeHost() },
      { content, mode: "stack" }
    )
    const cmds = clipToCommands(clip)

    const reg = cmds.filter((c) => c.t === "registerFragment")
    const add = cmds.filter((c) => c.t === "addTrack")
    const place = cmds.filter((c) => c.t === "placeFragment")

    expect(reg).toHaveLength(1)
    expect(add).toHaveLength(1)
    expect(place.length).toBe(clip.steps.length)

    // ordering: register(s) before addTrack before place(s)
    const addIdx = cmds.findIndex((c) => c.t === "addTrack")
    expect(cmds.findIndex((c) => c.t === "registerFragment")).toBeLessThan(addIdx)
    expect(cmds.findIndex((c) => c.t === "placeFragment")).toBeGreaterThan(addIdx)

    // addTrack carries a FragmentTrack with the clip's explicit id + tts instrument
    const track = (add[0] as Extract<typeof add[number], { t: "addTrack" }>).track
    expect(track.id).toBe(clip.trackId)
    expect(track.kind).toBe("fragment")
    if (isFragmentTrack(track as never)) {
      // type-narrowing for the instrument check below
    }
    expect((track as { instrument: { kind: string } }).instrument.kind).toBe("ttsFragment")

    // placeFragment ticks line up with the grid steps + fragmentId is registered
    const refId = (reg[0] as Extract<typeof reg[number], { t: "registerFragment" }>).ref.id
    place.forEach((p, i) => {
      const pc = p as Extract<typeof place[number], { t: "placeFragment" }>
      expect(pc.trackId).toBe(clip.trackId)
      expect(pc.frag.fragmentId).toBe(refId)
      expect(pc.frag.tick).toBe(tickForStep(i, clip.grid))
      expect(pc.frag.pitchSemis).toBe(scaleDegreeSemis(i))
    })
  })
})

describe("buildSynthVoxClip — synchronous LLM action path", () => {
  it("builds a riff clip from plain text with the synthVox tier", () => {
    const clip = buildSynthVoxClip({
      text: "agua",
      targetLang: "es",
      mode: "stack",
      loopTicks: PPQ * 4,
    })
    expect(clip.fragments).toHaveLength(1)
    expect(clip.fragments[0].tier).toBe("synthVox")
    expect(clip.steps.length).toBe(stepsInLoop(PPQ * 4, { denominator: 16 }))
    // its commands are well-formed too
    const cmds = clipToCommands(clip)
    expect(cmds.some((c) => c.t === "addTrack")).toBe(true)
    expect(cmds.filter((c) => c.t === "placeFragment").length).toBe(clip.steps.length)
  })
})
