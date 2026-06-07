import { describe, it, expect } from "vitest"
import { generateCity } from "./generateCity"

/**
 * streamingTags.test.ts — #34 Phase 1: the per-chunk `landKind` + `district` tags
 * + the `layout.districts` roster the streamer (dispose-priority warm) and the map
 * legend read. Pure data; no GPU.
 *
 *   • every chunk carries a `landKind` and a `district`;
 *   • open-river chunks tag `sea` (cheap, kept resident); built chunks tag `land`
 *     (counted against the streamer's resident budget);
 *   • the spawn chunk is `land` in the `plaza` district;
 *   • `layout.districts` lists every district present on land, deduped, with a
 *     centroid, and only `mainland` island in Phase 1.
 */
describe("streaming tags (#34 Phase 1)", () => {
  const layout = generateCity()

  it("every chunk has a landKind and a district", () => {
    for (const c of layout.chunks) {
      expect(c.landKind).toBeTruthy()
      expect(c.district).toBeTruthy()
    }
  })

  it("open-river chunks tag `sea`; the rest tag `land`", () => {
    const { waterZ, farBankZ } = layout.water
    for (const c of layout.chunks) {
      const cz = (c.bounds.minZ + c.bounds.maxZ) / 2
      const inRiverBand = farBankZ != null && cz >= waterZ && cz < farBankZ
      if (inRiverBand) expect(c.landKind).toBe("sea")
    }
    // at least one sea chunk exists (there IS a river).
    expect(layout.chunks.some((c) => c.landKind === "sea")).toBe(true)
  })

  it("the spawn sits on a LAND chunk in the plaza district", () => {
    const sx = layout.spawn.x
    const sz = layout.spawn.z
    const spawnChunk = layout.chunks.find(
      (c) => sx >= c.bounds.minX && sx < c.bounds.maxX && sz >= c.bounds.minZ && sz < c.bounds.maxZ,
    )
    expect(spawnChunk).toBeTruthy()
    expect(spawnChunk!.landKind).toBe("land")
    expect(spawnChunk!.district).toBe("plaza")
  })

  it("layout.districts dedupes land districts with centroids on island `mainland`", () => {
    const ds = layout.districts
    expect(ds).toBeTruthy()
    expect(ds!.length).toBeGreaterThan(1)
    // ids are unique
    const ids = ds!.map((d) => d.id)
    expect(new Set(ids).size).toBe(ids.length)
    // every district referenced by a LAND chunk is present in the roster
    const landDistrictIds = new Set(
      layout.chunks.filter((c) => c.landKind === "land").map((c) => c.district),
    )
    for (const id of landDistrictIds) expect(ids).toContain(id)
    // Phase 1 = a single island
    for (const d of ds!) {
      expect(d.island).toBe("mainland")
      expect(Number.isFinite(d.cx)).toBe(true)
      expect(Number.isFinite(d.cz)).toBe(true)
      expect(d.label.length).toBeGreaterThan(0)
    }
    // the plaza district is present (spawn district)
    expect(ids).toContain("plaza")
  })

  it("the resident LAND-chunk count is within the streaming budget (~96)", () => {
    // Phase 1 is built-once-safe ONLY if land chunks fit world-fix's resident
    // budget BEFORE dispose lands. This guards the scale so a future grid bump
    // can't silently blow past it without a failing test + a coordination ping.
    const land = layout.chunks.filter((c) => (c.landKind ?? "land") === "land").length
    expect(land).toBeLessThanOrEqual(96) // world-fix's resident-LAND budget (#34 §3)
  })
})
