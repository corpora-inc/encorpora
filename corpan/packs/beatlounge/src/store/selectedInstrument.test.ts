/**
 * beatlounge — SELECTED-INSTRUMENT slice tests. The doc-keyed melodic-track
 * selection that survives leaving the page: persist, restore, and fall back to
 * the first melodic track when the stored id has vanished. Pure (no DOM).
 */

import { describe, expect, it, beforeEach } from "vitest"
import { createDefaultDoc, isInstrumentTrack } from "../model/document"
import type { BeatloungeDoc } from "../model/document"
import { reduce } from "../model/reduce"
import {
  __resetSelectedInstrumentForTest,
  getSelectedInstrumentTrackId,
  getStoredInstrumentTrackId,
  resolveSelectedInstrumentTrackId,
  seedSelectionOnMount,
  setSelectedInstrumentTrackId,
} from "./selectedInstrument"

beforeEach(() => __resetSelectedInstrumentForTest())

const doc = (): BeatloungeDoc => createDefaultDoc(0)

const melodicId = (d: BeatloungeDoc): string => {
  const t = d.tracks.find((t) => isInstrumentTrack(t) && t.instrument.kind !== "drumSampler")
  if (!t) throw new Error("no melodic track")
  return t.id
}

describe("resolveSelectedInstrumentTrackId (pure)", () => {
  it("keeps a stored id that is still a melodic track", () => {
    const d = doc()
    const id = melodicId(d)
    expect(resolveSelectedInstrumentTrackId(d, id)).toBe(id)
  })

  it("falls back to the first melodic track when stored id is missing", () => {
    const d = doc()
    expect(resolveSelectedInstrumentTrackId(d, "trk_gone")).toBe(melodicId(d))
    expect(resolveSelectedInstrumentTrackId(d, undefined)).toBe(melodicId(d))
  })

  it("never resolves to a drum track", () => {
    const d = doc()
    const drum = d.tracks.find((t) => isInstrumentTrack(t) && t.instrument.kind === "drumSampler")!
    // A stored drum id is not a melodic track ⇒ falls back to the synth.
    expect(resolveSelectedInstrumentTrackId(d, drum.id)).toBe(melodicId(d))
  })
})

describe("selection store (persist / restore / fallback)", () => {
  it("persists and reads back per doc id", () => {
    const d = doc()
    const id = melodicId(d)
    setSelectedInstrumentTrackId(d.id, id)
    expect(getStoredInstrumentTrackId(d.id)).toBe(id)
    expect(getSelectedInstrumentTrackId(d)).toBe(id)
  })

  it("is idempotent (no churn when unchanged)", () => {
    const d = doc()
    const id = melodicId(d)
    setSelectedInstrumentTrackId(d.id, id)
    setSelectedInstrumentTrackId(d.id, id)
    expect(getStoredInstrumentTrackId(d.id)).toBe(id)
  })

  it("keeps selections isolated per document", () => {
    const a = doc()
    const b = createDefaultDoc(1)
    setSelectedInstrumentTrackId(a.id, melodicId(a))
    expect(getStoredInstrumentTrackId(b.id)).toBeUndefined()
    expect(getSelectedInstrumentTrackId(b)).toBe(melodicId(b))
  })

  it("falls back when a stored selection later vanishes from the doc", () => {
    const d = doc()
    // Add a second melodic track, select it, then remove it.
    const after = reduce(d, {
      t: "addTrack",
      track: {
        kind: "instrument",
        name: "Lead",
        grid: { denominator: 16 },
        volume: 0.8,
        pan: 0,
        mute: false,
        solo: false,
        inserts: [],
        sends: [],
        automation: [],
        instrument: { kind: "synth", osc: "sawtooth", filter: { type: "lowpass", frequency: 3000, q: 1 }, env: { attack: 0.01, decay: 0.2, sustain: 0.6, release: 0.3 } },
        notes: [],
      },
    })
    const added = after.tracks[after.tracks.length - 1].id
    setSelectedInstrumentTrackId(after.id, added)
    expect(getSelectedInstrumentTrackId(after)).toBe(added)
    // Remove the selected track → resolves to the first melodic (the synth).
    const removed = reduce(after, { t: "removeTrack", trackId: added })
    expect(getSelectedInstrumentTrackId(removed)).toBe(melodicId(removed))
  })
})

describe("seedSelectionOnMount — persisted selection wins, never resets to first", () => {
  it("seeds the mount's track when there is no stored selection", () => {
    const d = doc()
    const id = melodicId(d)
    expect(seedSelectionOnMount(d, undefined, id)).toBe(id)
  })

  it("does NOT seed (keeps the persisted pick) when something is already stored", () => {
    const d = doc()
    const stored = melodicId(d)
    // The mount requests a DIFFERENT melodic track; the persisted one must win.
    const after = reduce(d, {
      t: "addTrack",
      track: {
        kind: "instrument",
        name: "Lead",
        grid: { denominator: 16 },
        volume: 0.8,
        pan: 0,
        mute: false,
        solo: false,
        inserts: [],
        sends: [],
        automation: [],
        instrument: { kind: "synth", osc: "sawtooth", filter: { type: "lowpass", frequency: 3000, q: 1 }, env: { attack: 0.01, decay: 0.2, sustain: 0.6, release: 0.3 } },
        notes: [],
      },
    })
    const added = after.tracks[after.tracks.length - 1].id
    // Stored = the added lead; the mount points at the first track — must NOT seed.
    expect(seedSelectionOnMount(after, added, stored)).toBeUndefined()
  })

  it("never seeds a requested id that is not a real melodic track", () => {
    const d = doc()
    const drum = d.tracks.find((t) => isInstrumentTrack(t) && t.instrument.kind === "drumSampler")!
    expect(seedSelectionOnMount(d, undefined, "trk_gone")).toBeUndefined()
    expect(seedSelectionOnMount(d, undefined, drum.id)).toBeUndefined()
    expect(seedSelectionOnMount(d, undefined, undefined)).toBeUndefined()
  })
  it("persists the chosen track to localStorage (survives reload)", () => {
    const d = doc()
    const lead = d.tracks.find((t) => isInstrumentTrack(t) && t.instrument.kind !== "drumSampler")!
    setSelectedInstrumentTrackId(d.id, lead.id)
    // written through to storage under the namespaced key…
    const raw = localStorage.getItem("beatlounge:selectedInstrument")
    expect(raw).toBeTruthy()
    expect(JSON.parse(raw!)[d.id]).toBe(lead.id)
    // …and a fresh read (what the store hydrates from on reload) returns it.
    expect(getStoredInstrumentTrackId(d.id)).toBe(lead.id)
  })
})
