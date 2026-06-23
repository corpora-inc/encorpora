import { describe, expect, it } from "vitest"
import {
  createDefaultDoc,
  isFragmentTrack,
  isInstrumentTrack,
  type FragmentTrack,
  type Track,
} from "../../model/document"
import { newId } from "../../model/ids"
import { resolveTrackDeeplink, deeplinkLabel } from "./trackDeeplink"

const doc = createDefaultDoc(0)

const drumTrack = (): Track => {
  const t = doc.tracks.find((x) => isInstrumentTrack(x) && x.instrument.kind === "drumSampler")
  if (!t) throw new Error("no drum track")
  return t
}
const synthTrack = (): Track => {
  const t = doc.tracks.find((x) => isInstrumentTrack(x) && x.instrument.kind !== "drumSampler")
  if (!t) throw new Error("no synth track")
  return t
}
const phraseTrack = (): FragmentTrack => ({
  id: newId("trk"),
  kind: "fragment",
  name: "Phrases",
  color: "#7cf2c0",
  grid: { denominator: 16 },
  volume: 0.8,
  pan: 0,
  mute: false,
  solo: false,
  inserts: [],
  sends: [],
  automation: [],
  instrument: { kind: "ttsFragment" },
  fragments: [],
})

describe("resolveTrackDeeplink — strip → its detail page", () => {
  it("a drum track opens the Drums step-grid (no instrument binding)", () => {
    const r = resolveTrackDeeplink(drumTrack())
    expect(r.moduleId).toBe("step-grid")
    expect(r.selectInstrumentTrackId).toBeUndefined()
  })

  it("a melodic synth track opens Instruments, bound to THAT synth", () => {
    const t = synthTrack()
    const r = resolveTrackDeeplink(t)
    expect(r.moduleId).toBe("instruments")
    expect(r.selectInstrumentTrackId).toBe(t.id)
  })

  it("a fragment track opens Phrase Jam (no instrument binding)", () => {
    const t = phraseTrack()
    expect(isFragmentTrack(t)).toBe(true)
    const r = resolveTrackDeeplink(t)
    expect(r.moduleId).toBe("phrase-jam")
    expect(r.selectInstrumentTrackId).toBeUndefined()
  })
})

describe("deeplinkLabel", () => {
  it("labels each target by its kind", () => {
    expect(deeplinkLabel("step-grid")).toBe("Drums")
    expect(deeplinkLabel("instruments")).toBe("Synth")
    expect(deeplinkLabel("phrase-jam")).toBe("Phrases")
  })
})
