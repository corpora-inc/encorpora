import type { Scene as BabylonScene } from "@babylonjs/core/scene"
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder"
import { Mesh } from "@babylonjs/core/Meshes/mesh"
import { TransformNode } from "@babylonjs/core/Meshes/transformNode"
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial"
import { Color3, Vector3 } from "@babylonjs/core/Maths/math"
import { registerWalkSurface } from "./walkSurface"

/**
 * world/bridge.ts — a REAL 3D stone ARCH BRIDGE across the river (#29).
 *
 * The river crossing used to be a flat cobblestone road painted at water level —
 * "a normal road coloured blue by the water behind it". This builds an actual
 * raised structure: a cambered stone DECK well above the water, balustraded
 * PARAPETS down both sides, semicircular ARCHES springing from PIERS that stand in
 * the river, and stone APPROACH RAMPS that rise from each bank up onto the deck —
 * so the water visibly flows BENEATH and you walk UP and OVER it.
 *
 * Pure additive set-dressing (its own create + dispose), like the fountain /
 * riverwalk: it does NOT touch the streaming spine, collision, or layout. The
 * walkable corridor is already open in the collision field (places' `bridgeX` /
 * `bridgeHalfW`), and quest-flow's traverse trigger keys off the `bridge_n`
 * anchor — so this mesh just makes the crossing READ as a bridge; nothing depends
 * on it for gameplay. Coordinates come from `layout.water` (the canonical truth):
 * the deck spans `[nearZ, farZ]` over the river band and sits above `waterY`.
 */

type RGB = { r: number; g: number; b: number }
const hex = (h: string): RGB => {
  const c = Color3.FromHexString(h)
  return { r: c.r, g: c.g, b: c.b }
}
const mix = (a: RGB, b: RGB, t: number): RGB => ({
  r: a.r + (b.r - a.r) * t,
  g: a.g + (b.g - a.g) * t,
  b: a.b + (b.b - a.b) * t,
})
const shade = (c: RGB, t: number): RGB => (t >= 0 ? mix(c, { r: 1, g: 1, b: 1 }, t) : mix(c, { r: 0, g: 0, b: 0 }, -t))
const toC3 = (c: RGB): Color3 => new Color3(c.r, c.g, c.b)

export interface BridgeOptions {
  /** crossing centre X (the open corridor; places' `bridgeX`). */
  x: number
  /** river water surface Y the arches spring above (riverwalk sheet ≈ 0.07). */
  waterY?: number
  /** world-Z where the deck meets the NEAR bank (you step on here, `bankZ`). */
  nearZ: number
  /** world-Z where the deck meets the FAR bank (`farPromZ`). */
  farZ: number
  /** half-width of the walkable deck (places' `bridgeHalfW`). */
  halfWidth: number
  palette?: Record<string, string>
}

export interface Bridge {
  root: TransformNode
  /**
   * The WALK-SURFACE height (world Y) at (x,z): the top of the deck/ramp when the
   * point is on the bridge footprint (approach ramp → cambered deck → far ramp),
   * else 0 (ground). The movement controller samples this each frame so the player
   * walks UP and OVER the deck instead of under it (#40). It is the SAME profile
   * the mesh is built from, so the collision surface can never drift from the
   * visual deck. A small `pad` widens the X footprint so you don't fall off the
   * edge from numerical jitter at the rails.
   */
  heightAt: (x: number, z: number) => number
  /** the deck-top Y at the near approach (z = nearZ) — where the keeper stands. */
  nearDeckY: number
  dispose: () => void
}

/** deck top height above ground — a person-height clearance so water flows under. */
const DECK_Y = 3.0
/** how much the deck cambers UP at midspan (a gentle hump, reads as an arch road). */
const CAMBER = 0.7
const DECK_THICK = 0.5

export function buildBridge(scene: BabylonScene, opts: BridgeOptions): Bridge {
  const root = new TransformNode("wp-bridge", scene)
  const x = opts.x
  const waterY = opts.waterY ?? 0.07
  const hw = Math.max(3, opts.halfWidth)
  const nearZ = Math.min(opts.nearZ, opts.farZ)
  const farZ = Math.max(opts.nearZ, opts.farZ)
  const span = farZ - nearZ

  // ---- materials (warm stone in the city key, matching props/buildings) ----
  // LOW emissive (0.16) so the directional sun carves real shape into the deck +
  // arches (a higher lift washes the pale stone flat — same trap the trough water
  // hit). Wider shade spread (deck/stone/dk/lt) gives the masonry readable depth.
  const stoneBase = hex(opts.palette?.stone ?? "#cdbf9f")
  const mk = (name: string, rgb: RGB, emissive = 0.16): StandardMaterial => {
    const m = new StandardMaterial(`wp-bridge-${name}`, scene)
    m.diffuseColor = toC3(rgb)
    m.emissiveColor = toC3(rgb).scale(emissive)
    m.specularColor = new Color3(0, 0, 0)
    m.freeze()
    return m
  }
  const matDeck = mk("deck", shade(stoneBase, -0.12))
  const matStone = mk("stone", stoneBase)
  const matStoneDk = mk("stoneDk", shade(stoneBase, -0.32))
  const matStoneLt = mk("stoneLt", shade(stoneBase, 0.16))

  const add = (m: Mesh, mat: StandardMaterial): Mesh => {
    m.material = mat
    m.isPickable = false
    m.parent = root
    m.alwaysSelectAsActiveMesh = true
    m.doNotSyncBoundingInfo = true
    return m
  }
  const box = (name: string, w: number, h: number, d: number, px: number, py: number, pz: number, mat: StandardMaterial): Mesh => {
    const m = MeshBuilder.CreateBox(`wp-bridge-${name}`, { width: w, height: h, depth: d }, scene)
    m.position.set(px, py, pz)
    return add(m, mat)
  }

  // height of the cambered deck top at a given z (0 at the banks of the camber arc,
  // up to +CAMBER at midspan), so the deck reads as a humped arch road.
  const deckTopAt = (z: number): number => {
    const t = span > 1e-3 ? (z - nearZ) / span : 0.5
    return DECK_Y + Math.sin(Math.PI * t) * CAMBER
  }

  // ---- DECK: a run of cambered stone slabs across the span ----
  const SEGN = Math.max(8, Math.round(span / 4))
  for (let i = 0; i < SEGN; i++) {
    const z0 = nearZ + (span * i) / SEGN
    const z1 = nearZ + (span * (i + 1)) / SEGN
    const cz = (z0 + z1) / 2
    const segD = z1 - z0 + 0.02 // tiny overlap so no seam gaps
    const top = deckTopAt(cz)
    box("deck", hw * 2, DECK_THICK, segD, x, top - DECK_THICK / 2, cz, matDeck)
  }

  // ---- PARAPETS: a low stone wall + a coping rail down each side, following the
  //      camber. Pierced by square balusters so it reads as a real bridge rail.
  const railOuter = hw + 0.35
  const wallH = 0.7
  for (const side of [-1, 1]) {
    const sx = x + side * (hw - 0.05)
    // solid kerb wall under the rail
    for (let i = 0; i < SEGN; i++) {
      const z0 = nearZ + (span * i) / SEGN
      const z1 = nearZ + (span * (i + 1)) / SEGN
      const cz = (z0 + z1) / 2
      const top = deckTopAt(cz)
      box("kerb", 0.5, wallH, z1 - z0 + 0.02, sx, top + wallH / 2, cz, matStone)
    }
    // coping rail along the top (a continuous capstone band)
    const railSeg = Math.max(10, Math.round(span / 3))
    for (let i = 0; i < railSeg; i++) {
      const cz = nearZ + (span * (i + 0.5)) / railSeg
      const top = deckTopAt(cz)
      box("coping", 0.7, 0.22, span / railSeg + 0.03, sx, top + wallH + 0.11, cz, matStoneLt)
    }
    // balusters (little posts) spaced along the rail
    const balN = Math.max(6, Math.round(span / 5))
    for (let i = 0; i <= balN; i++) {
      const bz = nearZ + (span * i) / balN
      const top = deckTopAt(bz)
      box("baluster", 0.34, wallH * 0.9, 0.34, sx, top + wallH * 0.45, bz, matStoneDk)
    }
    void railOuter
  }

  // ---- ARCHES + PIERS: semicircular stone arches spanning the river, springing
  //      from piers that stand IN the water. The arch ring is approximated by a fan
  //      of thin voussoir boxes — cheap, reads clearly as a masonry arch from the
  //      bank. We place 2–3 arches across the river depending on span.
  const archCount = span > 50 ? 3 : 2
  const pierW = hw * 2 + 0.4
  for (let aIdx = 0; aIdx <= archCount; aIdx++) {
    const pz = nearZ + (span * aIdx) / archCount
    // PIER: a stone column from the water up to the deck underside (skip the very
    // ends — those land on the banks, not the river).
    if (aIdx > 0 && aIdx < archCount) {
      const top = deckTopAt(pz) - DECK_THICK
      const pierH = top - waterY
      box("pier", 1.6, pierH, pierW, x, waterY + pierH / 2, pz, matStoneDk)
      // a wider footing where the pier meets the water (a cutwater nose upstream).
      box("footing", 2.1, 0.5, pierW + 0.6, x, waterY + 0.25, pz, matStone)
    }
  }
  // ARCH RINGS between consecutive piers/abutments.
  for (let aIdx = 0; aIdx < archCount; aIdx++) {
    const za = nearZ + (span * aIdx) / archCount
    const zb = nearZ + (span * (aIdx + 1)) / archCount
    const cz = (za + zb) / 2
    const archHalf = (zb - za) / 2 - 0.7 // gap to the piers
    const springY = waterY + 0.4 // arches spring just above the water
    const deckUnder = deckTopAt(cz) - DECK_THICK
    const radius = Math.min(archHalf, deckUnder - springY)
    if (radius < 0.6) continue
    const VOUS = 11
    for (let v = 0; v <= VOUS; v++) {
      const ang = (v / VOUS) * Math.PI // 0..π across the semicircle
      const az = cz - Math.cos(ang) * radius
      const ay = springY + Math.sin(ang) * radius
      // a thin voussoir block oriented roughly tangent — kept axis-aligned + small
      // (cheap), the ring of them reads as a curved arch under the cruise cam.
      const vb = box("voussoir", pierW * 0.98, 0.5, 0.55, x, ay, az, matStone)
      // tilt each voussoir to follow the arch tangent (rotate about X).
      vb.rotation.x = ang - Math.PI / 2
      vb.computeWorldMatrix(true)
    }
    // a spandrel infill wall above the arch (between the arch crown and the deck)
    box("spandrel", pierW * 0.9, Math.max(0.1, deckUnder - (springY + radius) + 0.1), (zb - za) * 0.5, x, (springY + radius + deckUnder) / 2, cz, matStoneDk)
  }

  // ---- APPROACH RAMPS: short wedges from each bank up to the deck ends, so you
  //      walk UP onto the bridge instead of stepping into a floating slab. Built as
  //      a few stacked slabs that rise from ground (y≈0) to the deck end height.
  const RAMP_LEN = 4.5
  const ramp = (bankZ: number, dir: number) => {
    const endTop = deckTopAt(bankZ)
    const steps = 4
    const rampLen = RAMP_LEN
    for (let i = 0; i < steps; i++) {
      const t0 = i / steps
      const t1 = (i + 1) / steps
      const z = bankZ + dir * rampLen * (1 - (t0 + t1) / 2)
      const top = endTop * (t0 + t1) / 2 // rise from ~0 at the bank to deck top
      const segLen = rampLen / steps + 0.05
      box("ramp", hw * 2, Math.max(0.3, top), segLen, x, top / 2, z, matDeck)
    }
  }
  ramp(nearZ, -1) // ramp DOWN toward the near bank (−Z)
  ramp(farZ, 1) // ramp DOWN toward the far bank (+Z)

  // freeze everything (static).
  for (const m of root.getChildMeshes()) m.freezeWorldMatrix()

  // WALK-SURFACE height profile (#40) — matches the mesh above exactly:
  //   near ramp [nearZ-RAMP_LEN, nearZ]: 0 → deckTopAt(nearZ)
  //   deck      [nearZ, farZ]:           deckTopAt(z) (cambered)
  //   far ramp  [farZ, farZ+RAMP_LEN]:   deckTopAt(farZ) → 0
  // outside the X footprint (±hw + a small pad so you don't slip off at the rail)
  // or the Z span → 0 (ordinary ground).
  const X_PAD = 0.6
  const heightAt = (px: number, pz: number): number => {
    if (Math.abs(px - x) > hw + X_PAD) return 0
    if (pz >= nearZ && pz <= farZ) return deckTopAt(pz) // on the deck
    if (pz < nearZ && pz >= nearZ - RAMP_LEN) {
      const t = (pz - (nearZ - RAMP_LEN)) / RAMP_LEN // 0 at bank → 1 at deck
      return deckTopAt(nearZ) * t
    }
    if (pz > farZ && pz <= farZ + RAMP_LEN) {
      const t = (farZ + RAMP_LEN - pz) / RAMP_LEN // 1 at deck → 0 at bank
      return deckTopAt(farZ) * t
    }
    return 0
  }

  // SELF-WIRING (#40): register the height profile on the scene's walk-surface
  // registry so the player controller + crowd lift onto the deck automatically —
  // no game.ts wire required (forgetting that wire is exactly the regression). The
  // disposer below deregisters it so a scene teardown can't leak.
  const unregister = registerWalkSurface(scene, heightAt)

  return {
    root,
    heightAt,
    nearDeckY: deckTopAt(nearZ),
    dispose: () => {
      unregister()
      for (const m of root.getChildMeshes()) m.dispose(false, false)
      matDeck.dispose()
      matStone.dispose()
      matStoneDk.dispose()
      matStoneLt.dispose()
      root.dispose()
    },
  }
}

export { Vector3 }
