import type { Scene as BabylonScene } from "@babylonjs/core/scene"
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder"
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial"
import { Color3 } from "@babylonjs/core/Maths/math"

/**
 * harborWater.ts — the premium HARBOR WATER SHEEN for Corpan City
 * (MASTER_BACKLOG C7, the atmosphere pass).
 *
 * The city already BAKES a flat water-coloured ground surface along the +Z
 * waterfront (cityGround). That reads as "painted floor", not water. This lays a
 * single large, low, semi-transparent SHEEN PLANE a hair above that baked
 * surface — a horizontal sheet (never a vertical billboard, so it cannot occlude
 * the horizon — that lesson is honoured) that gently breathes its highlight so
 * the harbour reads as living water catching the warm sky.
 *
 * It is ONE quad with ONE additive material; the only per-frame cost is a single
 * emissive/alpha lerp, and that is skipped entirely under reduced motion (the
 * sheen just sits as a faint static gloss). Bounded + additive: it does not touch
 * the streaming spine, and it sits far out at the quay so it is rarely even in
 * frame near the spawn plaza — pure atmosphere, no budget pressure.
 */

export interface HarborWater {
  update: (dt: number) => void
  dispose: () => void
}

export interface HarborWaterOptions {
  /** the harbor/docks anchor world position (water lies just beyond it, +Z). */
  harbor: { x: number; z: number }
  /** full-city world bounds (to size the sheet across the waterfront). */
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number }
  palette?: Record<string, string>
  reducedMotion?: boolean
}

const hexC3 = (hex: string | undefined, fallback: string): Color3 =>
  Color3.FromHexString(hex ?? fallback)

let huid = 0

export function buildHarborWater(scene: BabylonScene, opts: HarborWaterOptions): HarborWater {
  const tag = `wp-harbor-${huid++}`
  const reduce = !!opts.reducedMotion

  // Water hue leans on the trim/sky so it agrees with the warm-day air.
  const base = hexC3(opts.palette?.trim, "#5aa0a8")
  const sheen = new Color3(
    base.r * 0.6 + 0.4,
    base.g * 0.6 + 0.42,
    base.b * 0.6 + 0.45,
  )

  // The sheet spans the city width and covers from a little in front of the quay
  // out to the far +Z edge. Centred on the midpoint of that span.
  const width = opts.bounds.maxX - opts.bounds.minX + 40
  const z0 = opts.harbor.z - 4 // start just shoreward of the docks
  const z1 = opts.bounds.maxZ + 30 // out past the far edge
  const depth = z1 - z0
  const cz = (z0 + z1) / 2
  const cx = (opts.bounds.minX + opts.bounds.maxX) / 2

  const sheet = MeshBuilder.CreateGround(`${tag}-sheet`, { width, height: depth, subdivisions: 1 }, scene)
  sheet.position.set(cx, 0.06, cz) // a hair above the baked water surface
  sheet.isPickable = false
  sheet.alwaysSelectAsActiveMesh = true
  sheet.doNotSyncBoundingInfo = true
  // far out + flat → no fog wash needed; keep it crisp against the haze.
  sheet.applyFog = false

  const mat = new StandardMaterial(`${tag}-mat`, scene)
  mat.diffuseColor = new Color3(0, 0, 0)
  mat.emissiveColor = sheen
  mat.specularColor = new Color3(0, 0, 0)
  mat.alpha = 0.34
  mat.backFaceCulling = true
  sheet.material = mat
  sheet.freezeWorldMatrix()

  const baseAlpha = mat.alpha
  const baseEm = mat.emissiveColor.clone()
  let t = 0
  const update = (dt: number) => {
    if (reduce) return
    t += dt
    // a slow, wide swell — the highlight breathes across the whole bay.
    const s = 0.5 + 0.5 * Math.sin(t * 0.7)
    mat.alpha = baseAlpha * (0.82 + 0.32 * s)
    mat.emissiveColor = baseEm.scale(0.9 + 0.18 * s)
  }

  return {
    update,
    dispose: () => {
      sheet.dispose()
      mat.dispose()
    },
  }
}
