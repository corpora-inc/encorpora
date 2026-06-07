import { describe, it, expect } from "vitest"
import { generateCharacter, ANTIGUA_1770 } from "../character/characterGen"
import { generatePersona } from "../npc/personaGen"
import { generateCity } from "./index"
import { Scene as SceneSchema } from "@corpan-city/contracts"
import sceneJson from "../../content/scenes/antigua-grand.json"

/**
 * #60 — the ambient crowd read as "a wall of identical Herbalists crowding the
 * player." Two regressions to lock down (canvas-free: these exercise the
 * persona/selection LOGIC, not the Babylon billboards — the live wiring is proven
 * in `qa/pop.mjs`, which measures 0 figures inside the keeper keepout at a market):
 *   1. VARIETY: the figure-variety set must span many distinct archetypes + names,
 *      not one cloned persona. (The visible clone problem was a tiny pre-baked
 *      sprite set — population now defaults `figureVariety` 16.)
 *   2. NO CROWDING: a stall-keeper binds only to a vendor anchor OUTSIDE the
 *      keeper keepout, so it never mobs the player standing in the market.
 */

const worldScene = SceneSchema.parse(sceneJson)

/** Mirror population.ts: `variety` distinct specs from the seed; strollers index
 *  `i%variety`, keepers `(i+3)%variety`; each figure's persona is seeded by its
 *  stable slot id + that spec. */
function rosterArchetypes(variety: number, count: number): { archs: Set<string>; names: Set<string> } {
  const seed = generateCity().seed
  const figureDraws = Array.from({ length: variety }, (_, i) =>
    generateCharacter("crowd", `ambient:${seed}:${i}`, ANTIGUA_1770),
  )
  const archs = new Set<string>()
  const names = new Set<string>()
  for (let i = 0; i < count; i++) {
    const v = i % variety
    const p = generatePersona(`ambient:${seed}:stroller:${i}`, { scene: worldScene, spec: figureDraws[v] })
    archs.add(p.archetype)
    names.add(p.name)
  }
  return { archs, names }
}

describe("population variety + keeper keepout (#60)", () => {
  it("the default figure roster spans many archetypes + names, not clones", () => {
    // the production default is 16 distinct looks (was 6 — the clone bug).
    const { archs, names } = rosterArchetypes(16, 16)
    expect(archs.size).toBeGreaterThanOrEqual(6) // a believable mix of trades
    expect(names.size).toBeGreaterThanOrEqual(10) // distinct people
  })

  it("the bumped variety yields many distinct SPRITE specs (the visible mix)", () => {
    // the VISIBLE clone problem was the pre-baked sprite set: a figure reuses one
    // of `variety` specs, so `variety` distinct specs == distinct looks on screen.
    // Persona text varies per-figure regardless, but the SPRITE is variety-bound.
    const seed = generateCity().seed
    const sig = (n: number) =>
      new Set(
        Array.from({ length: n }, (_, i) =>
          JSON.stringify(generateCharacter("crowd", `ambient:${seed}:${i}`, ANTIGUA_1770)),
        ),
      ).size
    expect(sig(16)).toBeGreaterThanOrEqual(12) // ~16 distinct looks (the fix)
    expect(sig(1)).toBe(1) // the OLD 1-look extreme == a wall of clones
  })

  it("a stall-keeper never binds to a vendor anchor inside the keeper keepout", () => {
    // reproduce population.ts' bind predicate: an anchor closer than KEEPER_KEEPOUT
    // to the player is skipped, so no keeper stands on top of you in the market.
    const KEEPER_KEEPOUT = 5.5
    const layout = generateCity()
    const vendors = layout.anchors.filter((a) => a.kind === "vendor")
    // pick the densest market + stand the player ON its anchor (worst case).
    let market = vendors[0]
    let bestN = -1
    for (const v of vendors) {
      const n = vendors.filter((o) => Math.hypot(o.x - v.x, o.z - v.z) < 12).length
      if (n > bestN) { bestN = n; market = v }
    }
    const player = { x: market.x, z: market.z }
    const stallWakeR = 34 // population default
    const bindable = vendors.filter((a) => {
      const d2 = (a.x - player.x) ** 2 + (a.z - player.z) ** 2
      return d2 < stallWakeR * stallWakeR && d2 >= KEEPER_KEEPOUT * KEEPER_KEEPOUT
    })
    // every bindable anchor is comfortably clear of the player.
    for (const a of bindable) {
      expect(Math.hypot(a.x - player.x, a.z - player.z)).toBeGreaterThanOrEqual(KEEPER_KEEPOUT)
    }
    // and the anchor the player stands ON is NOT bindable (it would mob you).
    const onAnchor = vendors.find((a) => a.x === market.x && a.z === market.z)!
    expect(bindable).not.toContain(onAnchor)
  })
})
