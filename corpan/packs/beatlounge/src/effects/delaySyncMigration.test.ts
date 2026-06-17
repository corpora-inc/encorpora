import { describe, it, expect } from "vitest"
import { migrateDelaySync } from "./delaySyncMigration"
import { delaySeconds } from "./createEffect"
import { noteLengthSeconds } from "./noteLengths"
import { createDefaultDoc, type BeatloungeDoc, type EffectNode } from "../model/document"

/** A doc with one delay insert (no `sync`) on its first track, at `bpm`. */
const docWithDelay = (delayTime: number, bpm: number): BeatloungeDoc => {
  const base = createDefaultDoc(0)
  const delay: EffectNode = {
    id: "fx1",
    kind: "delay",
    enabled: true,
    params: { delayTime, feedback: 0.35, wet: 0.3 }, // pre-sync: NO `sync` field
  }
  const tracks = base.tracks.map((t, i) => (i === 0 ? { ...t, inserts: [delay] } : t))
  return { ...base, bpm, tracks }
}

const delayOf = (doc: BeatloungeDoc): EffectNode =>
  (doc.tracks[0] as { inserts: EffectNode[] }).inserts[0]

describe("migrateDelaySync — old delays stay locked to their note length", () => {
  it("infers a dotted 1/16 and keeps it a dotted 1/16 across tempo changes", () => {
    const bpm = 120
    const dotted16 = noteLengthSeconds((1 / 16) * 1.5, bpm) // the saved seconds
    const migrated = migrateDelaySync(docWithDelay(dotted16, bpm))
    expect(delayOf(migrated).params.sync).toBe("1/16.")
    // It now recomputes with tempo — still a dotted 1/16 at a NEW bpm.
    const p = delayOf(migrated).params
    expect(delaySeconds(p, 90)).toBeCloseTo(noteLengthSeconds((1 / 16) * 1.5, 90), 6)
    expect(delaySeconds(p, 90)).not.toBeCloseTo(dotted16, 4) // it actually moved
  })

  it("marks an off-grid custom time as 'free' (keeps raw seconds)", () => {
    const migrated = migrateDelaySync(docWithDelay(0.313, 120))
    expect(delayOf(migrated).params.sync).toBe("free")
    expect(delaySeconds(delayOf(migrated).params, 200)).toBe(0.313) // ignores bpm
  })

  it("leaves a delay that already has `sync` untouched (idempotent)", () => {
    const base = docWithDelay(0.5, 120)
    base.tracks[0].inserts[0].params.sync = "1/8"
    const migrated = migrateDelaySync(base)
    expect(migrated).toBe(base) // same reference — no churn
  })

  it("no-ops a doc with no delays", () => {
    const d = createDefaultDoc(0)
    expect(migrateDelaySync(d)).toBe(d)
  })
})
