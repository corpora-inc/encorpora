/**
 * beatlounge — one-time MIGRATION: infer a delay's tempo `sync` from its saved
 * time, so OLD delays (authored before the sync field existed) stay locked to
 * whatever note length they were on.
 *
 * A pre-`sync` delay stored only `delayTime` (seconds), computed at the BPM it
 * was set. On load the doc's BPM is still that BPM, so the closest note-length
 * division at `doc.bpm` recovers the musical intent: a delay that was a dotted
 * 1/16 becomes `sync: "1/16."` and recomputes to stay a dotted 1/16 as the tempo
 * changes; a delay on an off-grid custom time becomes `sync: "free"` and keeps
 * its raw seconds. Delays that already carry a `sync` (anything added since the
 * field landed) are left untouched.
 *
 * Runs ONCE on load (see store/persistence) — pure, idempotent, and OUT of the
 * audio path, so there is zero per-frame cost: the engine just reads `sync`.
 */

import type { BeatloungeDoc, EffectNode } from "../model/document"
import { closestNoteLengthId } from "./noteLengths"

/** Default seconds a pre-sync delay used when it had no explicit time. */
const DEFAULT_DELAY_SECONDS = 0.9375

const migrateInsert = (node: EffectNode, bpm: number): EffectNode => {
  if (node.kind !== "delay") return node
  if (typeof node.params.sync === "string") return node // already migrated / new
  const time =
    typeof node.params.delayTime === "number" ? node.params.delayTime : DEFAULT_DELAY_SECONDS
  const id = closestNoteLengthId(time, bpm)
  return { ...node, params: { ...node.params, sync: id ?? "free" } }
}

/** Infer `sync` for every pre-sync delay insert in the doc (tracks + buses).
 *  Returns the SAME reference when nothing changed (no churn). */
export const migrateDelaySync = (doc: BeatloungeDoc): BeatloungeDoc => {
  const bpm = doc.bpm
  let changed = false

  const mapInserts = (inserts: EffectNode[]): EffectNode[] => {
    let any = false
    const next = inserts.map((n) => {
      const m = migrateInsert(n, bpm)
      if (m !== n) any = true
      return m
    })
    if (any) changed = true
    return any ? next : inserts
  }

  const tracks = doc.tracks.map((t) => {
    const ni = mapInserts(t.inserts)
    return ni === t.inserts ? t : { ...t, inserts: ni }
  })
  const buses = doc.buses.map((b) => {
    const ni = mapInserts(b.inserts)
    return ni === b.inserts ? b : { ...b, inserts: ni }
  })

  return changed ? { ...doc, tracks, buses } : doc
}
