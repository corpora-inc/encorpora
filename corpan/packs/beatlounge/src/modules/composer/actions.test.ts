/**
 * beatlounge — composer module action tests. The jam action writes a valid,
 * applyable part onto the synth and is reproducible given the action RNG.
 */

import { describe, expect, it } from "vitest"
import { jamAction, composerActions } from "./actions"
import { reduce } from "../../model/reduce"
import { createDefaultDoc, isInstrumentTrack } from "../../model/document"
import type { ActionContext } from "../../contracts/module"

const seededRng = (seed: number) => {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const ctx = (seed: number): ActionContext => ({
  doc: createDefaultDoc(0),
  rng: seededRng(seed),
})

/** A context over a SHARED doc (stable track ids) for determinism comparisons. */
const sharedDoc = createDefaultDoc(0)
const ctxShared = (seed: number): ActionContext => ({
  doc: sharedDoc,
  rng: seededRng(seed),
})

describe("composer jam action", () => {
  it("writes a part onto the synth that applies through the reducer", () => {
    const c = ctx(5)
    const r = jamAction.run(c, { key: "D", mode: "dorian", feel: "melody", template: "vamp" })
    expect(r.commands.length).toBeGreaterThan(0)
    let doc = c.doc
    for (const cmd of r.commands) doc = reduce(doc, cmd)
    const synth = doc.tracks.find((t) => isInstrumentTrack(t) && t.instrument.kind !== "drumSampler")!
    expect(isInstrumentTrack(synth) && synth.notes.length).toBeGreaterThan(0)
    expect(r.summary.toLowerCase()).toContain("jam")
  })

  it("is reproducible given the same action RNG seed", () => {
    const a = jamAction.run(ctxShared(42), { key: "G", mode: "minor", feel: "arp" })
    const b = jamAction.run(ctxShared(42), { key: "G", mode: "minor", feel: "arp" })
    expect(JSON.stringify(a.commands)).toBe(JSON.stringify(b.commands))
  })

  it("degrades gracefully on unknown args", () => {
    const r = jamAction.run(ctx(1), { key: "Z", mode: "klingon", feel: "yodel", template: "??" })
    expect(r.commands.length).toBeGreaterThan(0)
  })

  it("is registered as a stochastic mutate action", () => {
    expect(composerActions).toHaveLength(1)
    expect(jamAction.stochastic).toBe(true)
    expect(jamAction.impact).toBe("mutate")
  })
})
