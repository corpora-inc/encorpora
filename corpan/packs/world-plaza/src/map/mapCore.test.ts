/**
 * mapCore venue classification (#72): the FROZEN ANCHOR-CONTRACT venues must all
 * resolve to a DISTINCT, SIGNIFICANT POI category so they appear on the map with
 * a legible icon — even though the city generator emits them as generic
 * `portal`/`spawn`/`landmark` kinds (which would otherwise be filtered to a faint
 * tick). The owner's bug: "none of those things are on the map so I don't know
 * where to go." This guards against that regressing.
 */

import { describe, it, expect } from "vitest"
import type { Anchor } from "@world-plaza/contracts"
import {
  categoryOf,
  SIGNIFICANT,
  markerStyleForCat,
  type PoiCategory,
} from "./mapCore"

/** The frozen anchor-contract ids → the category each MUST plot as. Mirrors the
 *  ids the WORLD agent guarantees + how generateCity emits them today. */
const CONTRACT: Array<{ id: string; kind?: Anchor["kind"]; role: Anchor["role"]; cat: PoiCategory }> = [
  // transit — generateCity emits these as `portal` kind; the map must still tell
  // them apart (this is the literal bug in the task title).
  { id: "airport", kind: "portal", role: "portal", cat: "airport" },
  { id: "rail_station", kind: "portal", role: "portal", cat: "rail" },
  { id: "bus_station", kind: "portal", role: "portal", cat: "bus" },
  { id: "station", kind: "portal", role: "portal", cat: "taxi" },
  // shops + café — sit on generic anchors / are id-only.
  { id: "cafe", role: "decor", cat: "cafe" },
  { id: "outfitter", role: "decor", cat: "outfitter" },
  { id: "general_store", role: "decor", cat: "store" },
  // civic
  { id: "hospital", kind: "landmark", role: "decor", cat: "hospital" },
  { id: "exchange", role: "decor", cat: "cityhall" },
  // landmarks
  { id: "market", kind: "vendor", role: "vendor", cat: "vendor" },
  { id: "harbor", kind: "docks", role: "portal", cat: "docks" },
  { id: "fountain", kind: "fountain", role: "decor", cat: "fountain" },
  { id: "plaza", kind: "spawn", role: "spawn", cat: "fountain" },
  { id: "central_green", role: "decor", cat: "park" },
  { id: "central-green", role: "decor", cat: "park" },
  { id: "stadium", role: "decor", cat: "stadium" },
  { id: "bridge_n", kind: "landmark", role: "decor", cat: "bridge" },
  { id: "bridge_s", kind: "landmark", role: "decor", cat: "bridge" },
]

const anchor = (id: string, role: Anchor["role"], kind?: Anchor["kind"]): Anchor => ({
  id,
  role,
  ...(kind ? { kind } : {}),
  x: 0,
  z: 0,
})

describe("map venue classification (#72)", () => {
  it("every contract venue id resolves to its distinct category", () => {
    for (const c of CONTRACT) {
      expect(categoryOf(anchor(c.id, c.role, c.kind)), `${c.id}`).toBe(c.cat)
    }
  })

  it("every contract venue is SIGNIFICANT (plotted, never a faint tick)", () => {
    for (const c of CONTRACT) {
      expect(SIGNIFICANT.has(c.cat), `${c.id} → ${c.cat}`).toBe(true)
    }
  })

  it("transit modes are told apart by colour AND shape (not hue alone)", () => {
    const cats: PoiCategory[] = ["airport", "rail", "bus", "taxi"]
    const styles = cats.map(markerStyleForCat)
    // distinct colours
    expect(new Set(styles.map((s) => s.color)).size).toBe(cats.length)
    // each carries a mode glyph so the legend reads at a glance
    for (const s of styles) expect(s.glyph && s.glyph.length).toBeGreaterThan(0)
  })

  it("the airport (a `portal` anchor) is no longer dropped as a doorway", () => {
    // BEFORE #72: kind:"portal" → category "portal" → not SIGNIFICANT → faint tick.
    const a = anchor("airport", "portal", "portal")
    expect(categoryOf(a)).toBe("airport")
    expect(SIGNIFICANT.has(categoryOf(a))).toBe(true)
  })

  it("a genuinely unknown portal anchor still stays a faint doorway tick", () => {
    // id-aware classification must not promote EVERY portal — only contract venues.
    const a = anchor("some_random_door", "portal", "portal")
    expect(categoryOf(a)).toBe("portal")
    expect(SIGNIFICANT.has(categoryOf(a))).toBe(false)
  })
})
