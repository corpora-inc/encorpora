/**
 * beatlounge — corpus integrity tests. The data must be self-consistent: unique
 * ids, in-range cells, every role mappable to a kit voice, signature lanes
 * present, and broad family coverage.
 */

import { describe, expect, it } from "vitest"
import { RHYTHMS, FAMILY_META } from "./corpus"
import { rhythmCells } from "./types"
import { ROLE_MAP, KIT_PITCHES, resolveRole } from "./roles"
import { families } from "./index"

describe("rhythm corpus", () => {
  it("is comprehensive (a large, multi-family bank)", () => {
    expect(RHYTHMS.length).toBeGreaterThanOrEqual(60)
    // Every advertised family has at least a few entries.
    for (const { family } of FAMILY_META) {
      const n = RHYTHMS.filter((r) => r.family === family).length
      expect(n, `family ${family}`).toBeGreaterThanOrEqual(3)
    }
    // All nine groove families are represented.
    expect(families().length).toBe(9)
  })

  it("has unique ids and names", () => {
    const ids = new Set<string>()
    const names = new Set<string>()
    for (const r of RHYTHMS) {
      expect(ids.has(r.id), `dup id ${r.id}`).toBe(false)
      ids.add(r.id)
      expect(names.has(r.name), `dup name ${r.name}`).toBe(false)
      names.add(r.name)
    }
  })

  it("places every hit inside its rhythm's grid", () => {
    for (const r of RHYTHMS) {
      const cells = rhythmCells(r)
      expect(cells, `${r.id} cells`).toBeGreaterThan(0)
      for (const lane of r.lanes) {
        for (const hit of lane.hits) {
          expect(hit.cell, `${r.id}/${lane.role} cell ${hit.cell}`).toBeGreaterThanOrEqual(0)
          expect(hit.cell, `${r.id}/${lane.role} cell ${hit.cell}`).toBeLessThan(cells)
          if (hit.velocity != null) {
            expect(hit.velocity).toBeGreaterThanOrEqual(0)
            expect(hit.velocity).toBeLessThanOrEqual(1)
          }
        }
      }
    }
  })

  it("gives every rhythm at least one signature lane with hits", () => {
    for (const r of RHYTHMS) {
      const sig = r.lanes.filter((l) => l.signature)
      expect(sig.length, `${r.id} has a signature lane`).toBeGreaterThanOrEqual(1)
      for (const l of sig) expect(l.hits.length, `${r.id} sig hits`).toBeGreaterThan(0)
    }
  })

  it("maps every role used in the corpus to a real kit voice (no silent hits)", () => {
    const usedRoles = new Set<string>()
    for (const r of RHYTHMS) for (const l of r.lanes) usedRoles.add(l.role)
    for (const role of usedRoles) {
      expect(ROLE_MAP[role], `role "${role}" is in ROLE_MAP`).toBeDefined()
      const pitch = resolveRole(role).pitch
      expect(KIT_PITCHES.has(pitch), `role "${role}" → real kit pitch`).toBe(true)
    }
  })

  it("supports non-4/4 and long cycles (waltz, 6/8, talas)", () => {
    const ids = new Set(RHYTHMS.map((r) => r.id))
    expect(ids.has("waltz")).toBe(true) // 3/4
    expect(ids.has("gnawa")).toBe(true) // 6/8
    expect(ids.has("teental")).toBe(true) // 16
    const teental = RHYTHMS.find((r) => r.id === "teental")!
    expect(rhythmCells(teental)).toBe(16)
    const bul = RHYTHMS.find((r) => r.id === "bulería")!
    expect(rhythmCells(bul)).toBe(12)
  })
})
