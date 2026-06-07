import type { Scene as BabylonScene } from "@babylonjs/core/scene"
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder"
import { Mesh } from "@babylonjs/core/Meshes/mesh"
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial"
import { Color3 } from "@babylonjs/core/Maths/math"

/**
 * fountain.ts — the PLAZA CENTREPIECE for Corpan City (MASTER_BACKLOG C5).
 *
 * The spawn plaza's `fountain` anchor (at 0,0) had NO mesh — its collider was a
 * phantom wall the player spawned against, so it was removed. This builds a
 * believable HD-2D stone fountain there (a warm, premium, real-3D volume that
 * reads from every camera angle, matching the city's octopath buildings) and
 * exposes the metadata `city/collision.ts` needs to RESTORE a matching circle
 * collider now that real geometry backs it.
 *
 * SHAPE (a classic civic basin, read bottom→top):
 *   • a low octagon-ish stone PLINTH ring just proud of the cobbles;
 *   • a thick BASIN wall (outer + inner step) holding a still water disc;
 *   • a tapered central PEDESTAL rising to a wide upper BOWL;
 *   • a second smaller bowl + a finial, with a thin upper water disc;
 *   • a faint vertical water JET column the eye reads as "running".
 *
 * PERFORMANCE (it sits at spawn — on screen the whole session, must be free):
 *   • the WHOLE fountain merges into ONE static mesh per material family (stone /
 *     dark stone), plus TWO thin water discs kept separate so they can shimmer.
 *     ~3 draw calls total, world matrix frozen on the solids.
 *   • the only per-frame work is a single emissive lerp on the two water
 *     materials (2 cheap ops) — and it is OPT-OUT under reduced-motion (the
 *     water just sits still). No particle system, no post-process.
 *   • bounded, additive geometry: ~a few hundred tris, one-time at spawn, never
 *     rebuilt or streamed. It does not touch the city streaming spine.
 *
 * Returns the root (parent it / position it at the anchor), an `update(dt)` for
 * the shimmer, the `collider` circle for `city/collision.ts`, and `dispose()`.
 */

export interface Fountain {
  /** the merged centrepiece root — position it at the fountain anchor. */
  root: Mesh
  /** per-frame water shimmer (no-op under reduced motion). drive from onFrame. */
  update: (dt: number) => void
  /** circle the collision field should block (world-space; add anchor offset). */
  collider: { x: number; z: number; r: number }
  dispose: () => void
}

export interface FountainOptions {
  /** scene palette → warm stone/water hues that belong to the town. */
  palette?: Record<string, string>
  /** honour the user's reduced-motion preference (still water, no shimmer). */
  reducedMotion?: boolean
  /** uniform scale (1 ≈ a ~5u-wide basin). */
  scale?: number
}

const hexC3 = (hex: string | undefined, fallback: string): Color3 =>
  Color3.FromHexString(hex ?? fallback)
const shade = (c: Color3, t: number): Color3 =>
  t >= 0
    ? new Color3(c.r + (1 - c.r) * t, c.g + (1 - c.g) * t, c.b + (1 - c.b) * t)
    : new Color3(c.r * (1 + t), c.g * (1 + t), c.b * (1 + t))

let fuid = 0

/**
 * The local-space collider RADIUS of the basin wall (before `scale`). The basin
 * outer wall is ~5.3 wide → ~2.65 radius; we block a touch inside the lip so the
 * player can brush the rim. Exported as a const so collision can mirror it.
 */
export const FOUNTAIN_BASE_RADIUS = 2.55

export function buildFountain(scene: BabylonScene, opts: FountainOptions = {}): Fountain {
  const tag = `wp-fountain-${fuid++}`
  const scale = opts.scale ?? 1

  // ---- warm stone + water palette, derived from the scene -----------------
  const stoneC = hexC3(opts.palette?.stone, "#d8c8a6")
  const stone = stoneC
  const stoneDk = shade(stoneC, -0.22)
  const stoneLt = shade(stoneC, 0.14)
  // Water leans toward the sky/trim so the basin reflects the warm-day air.
  const waterC = hexC3(opts.palette?.trim, "#5aa0a8")
  const water = shade(waterC, 0.18)

  const mat = (name: string, c: Color3, o: { emissive?: number; alpha?: number } = {}) => {
    const m = new StandardMaterial(`${tag}-${name}`, scene)
    m.diffuseColor = c
    m.emissiveColor = c.scale(o.emissive ?? 0.3) // emissive lift = shape w/o gloom
    m.specularColor = new Color3(0, 0, 0)
    if (o.alpha !== undefined) m.alpha = o.alpha
    return m
  }

  const mStone = mat("stone", stone, { emissive: 0.32 })
  const mStoneDk = mat("stoneDk", stoneDk, { emissive: 0.28 })
  const mStoneLt = mat("stoneLt", stoneLt, { emissive: 0.36 })
  // two water materials kept LIVE (unfrozen) so update() can lerp their glow.
  const mWaterLo = mat("waterLo", water, { emissive: 0.42, alpha: 0.9 })
  const mWaterHi = mat("waterHi", shade(water, 0.12), { emissive: 0.5, alpha: 0.86 })
  const mJet = mat("jet", shade(water, 0.3), { emissive: 0.55, alpha: 0.34 })

  // Solids merge per-material → 3 merged meshes (stone / dark / light). Build the
  // parts into colour buckets, merge, then merge the buckets under one root.
  const stoneParts: Mesh[] = []
  const darkParts: Mesh[] = []
  const liteParts: Mesh[] = []

  const cyl = (
    bucket: Mesh[],
    name: string,
    o: { d?: number; dTop?: number; dBot?: number; h: number; tess?: number; y: number },
  ): Mesh => {
    const m = MeshBuilder.CreateCylinder(
      `${tag}-${name}`,
      o.d !== undefined
        ? { diameter: o.d, height: o.h, tessellation: o.tess ?? 16 }
        : { diameterTop: o.dTop ?? 0, diameterBottom: o.dBot ?? 0, height: o.h, tessellation: o.tess ?? 16 },
      scene,
    )
    m.position.y = o.y
    m.isPickable = false
    bucket.push(m)
    return m
  }

  // ── plinth: a wide, low step the basin sits on (octagon read via 8-tess) ──
  cyl(liteParts, "plinth", { d: 6.0, h: 0.22, tess: 8, y: 0.11 })
  cyl(stoneParts, "plinth2", { d: 5.6, h: 0.18, tess: 8, y: 0.31 })

  // ── basin: thick outer wall (outer cone + a darker inner step) ──
  cyl(stoneParts, "basin-out", { dTop: 5.0, dBot: 5.3, h: 0.74, tess: 24, y: 0.68 })
  cyl(darkParts, "basin-lip", { d: 5.0, h: 0.12, tess: 24, y: 1.0 })
  cyl(darkParts, "basin-floor", { d: 4.5, h: 0.16, tess: 24, y: 0.5 })

  // ── central pedestal → wide bowl → small pedestal → small bowl → finial ──
  cyl(stoneParts, "ped", { dTop: 0.72, dBot: 1.06, h: 1.35, tess: 14, y: 1.18 })
  cyl(liteParts, "bowl", { dTop: 2.1, dBot: 0.82, h: 0.42, tess: 18, y: 1.9 })
  cyl(stoneParts, "ped2", { dTop: 0.42, dBot: 0.64, h: 0.92, tess: 12, y: 2.5 })
  cyl(liteParts, "bowl2", { dTop: 1.1, dBot: 0.46, h: 0.26, tess: 14, y: 3.02 })
  const finial = MeshBuilder.CreateSphere(`${tag}-finial`, { diameter: 0.42, segments: 10 }, scene)
  finial.position.y = 3.32
  finial.isPickable = false
  darkParts.push(finial)

  // merge each colour bucket into one mesh w/ its material.
  const mergeBucket = (parts: Mesh[], m: StandardMaterial, name: string): Mesh | null => {
    if (!parts.length) return null
    const merged = parts.length === 1 ? parts[0] : Mesh.MergeMeshes(parts, true, true, undefined, false, false)
    if (!merged) return null
    merged.material = m
    merged.name = `${tag}-${name}`
    merged.isPickable = false
    return merged
  }
  const stoneMesh = mergeBucket(stoneParts, mStone, "stone")
  const darkMesh = mergeBucket(darkParts, mStoneDk, "dark")
  const liteMesh = mergeBucket(liteParts, mStoneLt, "lite")

  // ── water discs — SEPARATE meshes so they can shimmer (not merged in) ──
  const wLo = MeshBuilder.CreateCylinder(`${tag}-water-lo`, { diameter: 4.35, height: 0.14, tessellation: 24 }, scene)
  wLo.position.y = 0.62
  wLo.material = mWaterLo
  wLo.isPickable = false
  const wHi = MeshBuilder.CreateCylinder(`${tag}-water-hi`, { diameter: 1.92, height: 0.1, tessellation: 18 }, scene)
  wHi.position.y = 2.05
  wHi.material = mWaterHi
  wHi.isPickable = false

  // ── the running JET: a faint translucent column the eye reads as flowing
  // water rising from the centre. Static + thin; it sells "alive" for free. ──
  const jet = MeshBuilder.CreateCylinder(`${tag}-jet`, { diameterTop: 0.16, diameterBottom: 0.34, height: 1.5, tessellation: 8 }, scene)
  jet.position.y = 2.05 + 0.75
  jet.material = mJet
  jet.isPickable = false

  // ── assemble under one root, apply scale, freeze the solids ──
  const root = new Mesh(`${tag}-root`, scene)
  root.isPickable = false
  for (const m of [stoneMesh, darkMesh, liteMesh, wLo, wHi, jet]) {
    if (m) m.parent = root
  }
  root.scaling.setAll(scale)
  // solids never move → freeze their world matrices (water/jet too: shimmer is a
  // material lerp, not a transform, so freezing geometry is safe + cheap).
  for (const m of root.getChildMeshes()) {
    m.alwaysSelectAsActiveMesh = true
    m.doNotSyncBoundingInfo = true
    m.freezeWorldMatrix()
  }

  // ---- shimmer: a gentle emissive breathing on the two water discs --------
  const reduce = !!opts.reducedMotion
  let t = 0
  const baseLo = mWaterLo.emissiveColor.clone()
  const baseHi = mWaterHi.emissiveColor.clone()
  const baseJet = mJet.alpha
  const update = (dt: number) => {
    if (reduce) return
    t += dt
    // two out-of-phase slow sines → light catching moving water, never strobing.
    const a = 0.5 + 0.5 * Math.sin(t * 1.6)
    const b = 0.5 + 0.5 * Math.sin(t * 1.6 + 2.1)
    mWaterLo.emissiveColor = baseLo.scale(0.86 + 0.22 * a)
    mWaterHi.emissiveColor = baseHi.scale(0.86 + 0.26 * b)
    mJet.alpha = baseJet * (0.78 + 0.3 * b) // the jet pulses faintly = "running"
  }

  return {
    root,
    update,
    collider: { x: 0, z: 0, r: FOUNTAIN_BASE_RADIUS * scale },
    dispose: () => {
      for (const m of root.getChildMeshes()) m.dispose()
      root.dispose()
      for (const m of [mStone, mStoneDk, mStoneLt, mWaterLo, mWaterHi, mJet]) m.dispose()
    },
  }
}
