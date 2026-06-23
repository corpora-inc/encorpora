/**
 * beatlounge — agent preset tests: every agent yields a non-empty bundle of
 * valid addModulator commands that apply through the real reducer, picks targets
 * from the live doc, and chaos scales with intensity.
 */

import { describe, expect, it } from "vitest"
import {
  AGENT_NAMES,
  agentCommands,
  agentModulators,
  chaosCommands,
} from "./agents"
import { reduce } from "../model/reduce"
import { createDefaultDoc } from "../model/document"
import { newId } from "../model/ids"
import { defaultEffectParams } from "../effects/params"
import type { BeatloungeDoc } from "../model/document"
import type { Command } from "../model/command"

const apply = (doc: BeatloungeDoc, commands: Command[]): BeatloungeDoc =>
  commands.reduce((d, c) => reduce(d, c), doc)

/** A doc that has a filter insert + a send + a bus, to exercise insert targets. */
const richDoc = (): BeatloungeDoc => {
  let doc = createDefaultDoc(0)
  const busId = newId("bus")
  doc = reduce(doc, {
    t: "addBus",
    bus: { name: "FX", role: "fx", inserts: [], sends: [], volume: 0.8, mute: false },
  })
  const bus = doc.buses[0]
  const t0 = doc.tracks[0].id
  doc = reduce(doc, {
    t: "addInsert",
    trackId: t0,
    effect: { kind: "filter", enabled: true, params: defaultEffectParams("filter") },
  })
  doc = reduce(doc, {
    t: "addInsert",
    trackId: t0,
    effect: { kind: "delay", enabled: true, params: defaultEffectParams("delay") },
  })
  doc = reduce(doc, { t: "addSend", trackId: t0, send: { busId: bus.id, level: 0.3 } })
  void busId
  return doc
}

describe("agent presets", () => {
  it("every agent yields a non-empty bundle of addModulator commands that applies", () => {
    for (const name of AGENT_NAMES) {
      const doc = richDoc()
      const cmds = agentCommands(name, doc)
      expect(cmds.length, name).toBeGreaterThan(0)
      for (const c of cmds) expect(c.t).toBe("addModulator")
      const next = apply(doc, cmds)
      expect(next.modulators.length, name).toBe(doc.modulators.length + cmds.length)
    }
  })

  it("every produced modulator has a valid shape, depth, center and target", () => {
    for (const name of AGENT_NAMES) {
      const doc = richDoc()
      for (const m of agentModulators(name, doc)) {
        expect(m.depth).toBeGreaterThanOrEqual(0)
        expect(m.depth).toBeLessThanOrEqual(1)
        expect(m.center).toBeGreaterThanOrEqual(0)
        expect(m.center).toBeLessThanOrEqual(1)
        expect(m.enabled).toBe(true)
        expect(["sine", "triangle", "saw", "square", "random", "drift"]).toContain(m.shape)
        expect(m.target.scope).toBeTruthy()
      }
    }
  })

  it("works on a bare default doc (no inserts) — agents never come back empty", () => {
    for (const name of AGENT_NAMES) {
      const doc = createDefaultDoc(0)
      expect(agentModulators(name, doc).length, name).toBeGreaterThan(0)
    }
  })

  it("breathe drives the master and a track volume", () => {
    const doc = createDefaultDoc(0)
    const mods = agentModulators("breathe", doc)
    expect(mods.some((m) => m.target.scope === "master")).toBe(true)
    expect(mods.some((m) => m.target.scope === "track" && m.target.param === "volume")).toBe(true)
  })

  it("drift uses the drift shape on pans", () => {
    const doc = createDefaultDoc(0)
    const mods = agentModulators("drift", doc)
    expect(mods.some((m) => m.shape === "drift" && m.target.scope === "track" && m.target.param === "pan")).toBe(true)
  })

  it("chaos targets inserts + sends when present and uses random", () => {
    const doc = richDoc()
    const mods = agentModulators("chaos", doc)
    expect(mods.some((m) => m.target.scope === "insert")).toBe(true)
    expect(mods.some((m) => m.shape === "random")).toBe(true)
  })

  it("chaosCommands scales count/depth with intensity", () => {
    const doc = richDoc()
    const low = chaosCommands(doc, 0.5)
    const high = chaosCommands(doc, 2)
    expect(low.length).toBeGreaterThan(0)
    expect(high.length).toBeGreaterThan(0)
  })

  it("pulse uses tempo-synced square/triangle on volumes", () => {
    const doc = createDefaultDoc(0)
    const mods = agentModulators("pulse", doc)
    expect(mods.every((m) => m.syncBeats !== undefined)).toBe(true)
    expect(mods.some((m) => m.shape === "square" || m.shape === "triangle")).toBe(true)
  })
})
