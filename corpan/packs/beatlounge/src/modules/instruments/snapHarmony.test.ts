/**
 * beatlounge — HARMONY → SCORE SNAP tests. When the song's mode changes, the
 * melody re-quantizes to the nearest in-key pitch: ONLY pitch moves (tick /
 * duration / velocity preserved), it's deterministic, a no-op when already in
 * key, one `setNotes` command, and `snapAllMelodicTracksToHarmony` batches.
 */

import { describe, expect, it } from "vitest"
import { createDefaultDoc, isInstrumentTrack } from "../../model/document"
import type { BeatloungeDoc, NoteEvent } from "../../model/document"
import { reduce } from "../../model/reduce"
import { inHarmony } from "../../music/resolver"
import { snapTrackToHarmony, snapAllMelodicTracksToHarmony } from "./snapHarmony"
import { newInstrumentTrackInit } from "./addTrack"

const doc = (): BeatloungeDoc => createDefaultDoc(0)

const melodic = (d: BeatloungeDoc) => {
  const t = d.tracks.find((t) => isInstrumentTrack(t) && t.instrument.kind !== "drumSampler")
  if (!t || !isInstrumentTrack(t)) throw new Error("no melodic track")
  return t
}

/** Switch the doc to C natural minor (aeolian): E natural (pc 4) is now out. */
const toAeolian = (d: BeatloungeDoc): BeatloungeDoc =>
  reduce(d, { t: "setScale", family: "western", id: "western.aeolian" })

describe("snapTrackToHarmony", () => {
  it("moves only out-of-key pitches to the nearest in-key note", () => {
    const d = toAeolian(doc())
    const t = melodic(d)
    const cmd = snapTrackToHarmony(d, t.id)
    expect(cmd).not.toBeNull()
    expect(cmd!.t).toBe("setNotes")
    if (cmd!.t !== "setNotes") return
    // Default lead is 60,64,67,72. In C-aeolian only 64 (E) is out → 63 (Eb).
    const before = t.notes.map((n) => n.pitch)
    const after = cmd!.notes.map((n) => n.pitch)
    expect(before).toEqual([60, 64, 67, 72])
    expect(after).toEqual([60, 63, 67, 72])
    // Every resulting pitch is genuinely in the new harmony.
    for (const n of cmd!.notes) expect(inHarmony(n.pitch, d, n.tick)).toBe(true)
  })

  it("preserves tick / duration / velocity (moves only pitch)", () => {
    const d = toAeolian(doc())
    const t = melodic(d)
    const cmd = snapTrackToHarmony(d, t.id)!
    if (cmd.t !== "setNotes") throw new Error("expected setNotes")
    cmd.notes.forEach((n: Omit<NoteEvent, "id">, i: number) => {
      expect(n.tick).toBe(t.notes[i].tick)
      expect(n.duration).toBe(t.notes[i].duration)
      expect(n.velocity).toBe(t.notes[i].velocity)
    })
  })

  it("is deterministic — same input, same command", () => {
    const d = toAeolian(doc())
    const t = melodic(d)
    expect(snapTrackToHarmony(d, t.id)).toEqual(snapTrackToHarmony(d, t.id))
  })

  it("is a no-op (null) when the melody is already in key", () => {
    // The default doc is C-major; its lead (C E G C) is already in key.
    const d = doc()
    expect(snapTrackToHarmony(d, melodic(d).id)).toBeNull()
  })

  it("returns null for a missing / non-melodic / empty track", () => {
    const d = toAeolian(doc())
    expect(snapTrackToHarmony(d, "nope")).toBeNull()
    const drum = d.tracks.find((t) => isInstrumentTrack(t) && t.instrument.kind === "drumSampler")!
    expect(snapTrackToHarmony(d, drum.id)).toBeNull()
  })

  it("dispatches as exactly one undo step via setNotes", () => {
    const d = toAeolian(doc())
    const t = melodic(d)
    const cmd = snapTrackToHarmony(d, t.id)!
    const next = reduce(d, cmd)
    const nt = next.tracks.find((x) => x.id === t.id)!
    if (!isInstrumentTrack(nt)) throw new Error("melodic")
    expect(nt.notes.map((n) => n.pitch)).toEqual([60, 63, 67, 72])
  })
})

describe("snapAllMelodicTracksToHarmony", () => {
  it("batches every moving melodic track and skips the drum track", () => {
    const d = toAeolian(doc())
    const cmd = snapAllMelodicTracksToHarmony(d)
    expect(cmd).not.toBeNull()
    expect(cmd!.t).toBe("batch")
    if (cmd!.t !== "batch") return
    // Only the one synth track moves; the drum track is never melodic.
    expect(cmd!.commands).toHaveLength(1)
    expect(cmd!.commands[0].t).toBe("setNotes")
  })

  it("is null when nothing moves (already in key)", () => {
    expect(snapAllMelodicTracksToHarmony(doc())).toBeNull()
  })

  it("snaps EVERY melodic track (not just one) when several are out of key", () => {
    // Add a SECOND melodic track with an out-of-key note (E, pc 4), then switch
    // to aeolian where E is out → BOTH the default lead and the new track snap.
    const init = newInstrumentTrackInit(0)
    let d = reduce(doc(), { t: "addTrack", track: init })
    d = reduce(d, {
      t: "setNotes",
      trackId: init.id!,
      notes: [{ tick: 0, duration: 24, pitch: 64, velocity: 100 }],
    })
    d = toAeolian(d)

    const cmd = snapAllMelodicTracksToHarmony(d)
    expect(cmd).not.toBeNull()
    if (cmd!.t !== "batch") throw new Error("expected batch")
    // Two melodic tracks move (default lead has E; the added track is just E).
    expect(cmd!.commands).toHaveLength(2)
    const ids = cmd!.commands.map((c) => (c.t === "setNotes" ? c.trackId : null))
    expect(ids).toContain(init.id)

    // Applying the batch puts the added track's E (64) onto Eb (63) — in key.
    const next = reduce(d, cmd!)
    const added = next.tracks.find((t) => t.id === init.id)!
    if (!isInstrumentTrack(added)) throw new Error("melodic")
    expect(added.notes.map((n) => n.pitch)).toEqual([63])
  })
})
