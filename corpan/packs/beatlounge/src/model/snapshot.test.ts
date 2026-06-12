import { describe, expect, it } from "vitest"
import { createDefaultDoc, findTrack, isInstrumentTrack } from "./document"
import { reduce } from "./reduce"
import { applySnapshot, captureSnapshot, snapshotsEqual } from "./snapshot"

const baseDoc = () => createDefaultDoc(1000)

describe("snapshot — captureSnapshot", () => {
  it("captures the musical subset and EXCLUDES identity/volatile fields", () => {
    const doc = baseDoc()
    const snap = captureSnapshot(doc) as unknown as Record<string, unknown>
    // musical fields present
    expect(snap.loopLengthTicks).toBe(doc.loopLengthTicks)
    expect(snap.bpm).toBe(doc.bpm)
    expect((snap.tracks as unknown[]).length).toBe(doc.tracks.length)
    expect(snap.harmony).toBeTruthy()
    // identity / volatile / structural EXCLUDED
    expect("id" in snap).toBe(false)
    expect("name" in snap).toBe(false)
    expect("createdAt" in snap).toBe(false)
    expect("updatedAt" in snap).toBe(false)
    expect("schema" in snap).toBe(false)
    expect("ppq" in snap).toBe(false)
  })

  it("deep-clones so later doc edits do not mutate the snapshot", () => {
    const doc = baseDoc()
    const snap = captureSnapshot(doc)
    const trackId = doc.tracks[0].id
    const next = reduce(doc, { t: "setTrackProp", trackId, prop: "volume", value: 0.1 })
    // snapshot's copy of that track is untouched
    expect(snap.tracks[0].volume).toBe(doc.tracks[0].volume)
    expect(next.tracks[0].volume).toBe(0.1)
  })

  it("defaults harmony for a pre-harmony doc", () => {
    const doc = baseDoc()
    const { harmony, ...rest } = doc
    void harmony
    const snap = captureSnapshot(rest as typeof doc)
    expect(snap.harmony.mode).toBe("modal")
  })
})

describe("snapshot — round-trips through capture → apply", () => {
  it("applySnapshot restores the musical state exactly", () => {
    const a = baseDoc()
    // evolve to B
    let b = reduce(a, { t: "setTempo", bpm: 150 })
    b = reduce(b, { t: "setLoopLength", ticks: 1920 })
    b = reduce(b, { t: "setMasterVolume", v: 0.3 })
    const snapB = captureSnapshot(b)

    // apply B's snapshot over A
    const restored = applySnapshot(a, snapB)
    expect(restored.bpm).toBe(150)
    expect(restored.loopLengthTicks).toBe(1920)
    expect(restored.masterVolume).toBe(0.3)
    expect(captureSnapshot(restored)).toEqual(snapB)
  })

  it("preserves the live doc id / name / schema / ppq / createdAt on load", () => {
    const a = baseDoc()
    const b = reduce(a, { t: "renameSong", name: "OTHER" })
    const snapB = captureSnapshot(b)
    const restored = applySnapshot({ ...a, id: "song_A", name: "A NAME" }, snapB)
    expect(restored.id).toBe("song_A")
    expect(restored.name).toBe("A NAME") // name is identity, NOT snapshotted
    expect(restored.schema).toBe(a.schema)
    expect(restored.ppq).toBe(a.ppq)
    expect(restored.createdAt).toBe(a.createdAt)
  })

  it("does not alias the snapshot arrays (load → edit → snapshot intact)", () => {
    const a = baseDoc()
    const snap = captureSnapshot(reduce(a, { t: "setTempo", bpm: 111 }))
    const loaded = applySnapshot(a, snap)
    const edited = reduce(loaded, {
      t: "setTrackProp",
      trackId: loaded.tracks[0].id,
      prop: "pan",
      value: 0.9,
    })
    void edited
    expect(snap.tracks[0].pan).toBe(a.tracks[0].pan)
  })
})

describe("snapshot — loadScene reduce command", () => {
  it("is the loadScene reducer body, applied atomically", () => {
    const a = baseDoc()
    const b = reduce(a, { t: "setTempo", bpm: 200 })
    const snap = captureSnapshot(b)
    const out = reduce({ ...a, id: "keepme" }, { t: "loadScene", snapshot: snap })
    expect(out.bpm).toBe(200)
    expect(out.id).toBe("keepme")
  })
})

describe("snapshot — snapshotsEqual", () => {
  it("equal for identical state, unequal after a musical change", () => {
    const a = baseDoc()
    const sa = captureSnapshot(a)
    expect(snapshotsEqual(sa, captureSnapshot(a))).toBe(true)
    const b = reduce(a, { t: "setTempo", bpm: 97 })
    expect(snapshotsEqual(sa, captureSnapshot(b))).toBe(false)
  })

  it("is BLIND to identity-only changes (renaming the song)", () => {
    const a = baseDoc()
    const sa = captureSnapshot(a)
    const renamed = reduce(a, { t: "renameSong", name: "zzz" })
    expect(snapshotsEqual(sa, captureSnapshot(renamed))).toBe(true)
  })
})

// keep the import used so tree-shake-free typecheck stays honest
void findTrack
void isInstrumentTrack
