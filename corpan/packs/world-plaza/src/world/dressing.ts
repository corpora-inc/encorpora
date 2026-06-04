import type { Scene as BabylonScene } from "@babylonjs/core/scene"
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder"
import { Mesh } from "@babylonjs/core/Meshes/mesh"
import { TransformNode } from "@babylonjs/core/Meshes/transformNode"
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial"
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture"
import { Color3, Matrix } from "@babylonjs/core/Maths/math"
import "@babylonjs/core/Meshes/thinInstanceMesh"
import type { RoomTopology, Scene as WorldScene } from "@world-plaza/contracts"
import {
  resolvePropPalette,
  buildLamp,
  buildTree,
  buildPalm,
  buildPlanter,
  buildBarrel,
  buildCrate,
  buildSack,
  buildSignpost,
  buildCart,
  buildStall,
  buildBench,
  buildTrough,
  buildFountainSolid,
  instanceMatrix,
  type PropPalette,
} from "./props3d"
import { composeDressing, type SpeciesId, type CompositionCaps } from "./composition"
import { propFootprints, type CircleObstacle } from "./collision"

/**
 * dressWorld — the SET DRESSING layer for World Plaza.
 *
 * Places a lived-in colonial town's worth of props: street lamps, trees,
 * potted palms, planters, market crates/barrels/sacks, signposts, carts,
 * market-stall canopies, benches, water troughs, and a grand multi-tier
 * fountain.
 *
 * PLACEMENT is no longer a haphazard per-anchor scatter (which read as "a
 * tornado dropped 50 benches in a pile" once the map grew). It is now driven by
 * composition.ts — a PURE zoning/spacing planner that lays the SAME props into
 * legible ZONES with real breathing room: a central PLAZA, ONE MARKET quarter,
 * tree-lined AVENUES along the roads, a GARDEN green, and thinning RESIDENTIAL
 * edges. dressWorld is the thin INSTANTIATION layer: it owns the meshes (one
 * merged thin-instanced mesh per species), turns each planned `Placement` into a
 * thin instance + blob shadow, lights the lamps, and animates the water.
 *
 * REAL 3D (the whole point of this rewrite): every prop is a low-poly,
 * stylized, MERGED 3D mesh with actual VOLUME (props3d.ts) — not a flat
 * paper cutout. Orbiting the camera 360° never reveals a paper-thin edge,
 * and the props read as the same warm toy-diorama world as the buildings.
 *
 * PERFORMANCE is the whole game. A big town means dozens of props, so every
 * repeated prop is a SINGLE merged mesh drawn via THIN INSTANCES (one draw
 * call, one small material set for the entire species). Because the props are
 * real 3D volumes, there is NO per-instance billboarding (the old flat path's
 * per-frame yaw pass is gone) — instances bake a fixed yaw and are FROZEN
 * (freezeWorldMatrix). `lean` (phone) tier caps counts and drops extras.
 * Subtle deterministic per-instance jitter (seeded) keeps it from looking
 * tiled. A cheap shared blob-shadow decal grounds each prop.
 */

export interface Dressing {
  dispose: () => void
  /**
   * Collision footprints (circles) for the SOLID props this dressing placed —
   * fed into the unified obstacle field (collision.ts) so the player and crowd
   * route around props instead of walking through them. Non-blocking décor
   * (lamp glow, shadows) is excluded; sizes come from the real mesh footprints.
   */
  footprints: CircleObstacle[]
}

export interface DressOptions {
  palette?: Record<string, string>
  /** per-frame bus (engine.onFrame); returns an unsubscribe. */
  onFrame?: (cb: (dt: number) => void) => () => void
  /** deterministic variation seed. */
  seed?: number
  /** phone tier — caps counts and drops expensive extras. */
  lean?: boolean
}

type Box = { x: number; z: number; w: number; d: number }
type Anchor = RoomTopology["anchors"][number]

/* --------------------------------------------------------------- species pool */

interface Species {
  mesh: Mesh
  matrices: number[] // flattened 16-float thin-instance buffer
  count: number
}

function makeSpeciesPool(mesh: Mesh): Species {
  return { mesh, matrices: [], count: 0 }
}

function pushInstance(sp: Species, m: Matrix): number {
  const idx = sp.count
  m.copyToArray(sp.matrices, idx * 16)
  sp.count++
  return idx
}

/** Commit a species' thin-instance buffer as a STATIC frozen batch (props are
 * real 3D volumes → no per-frame facing needed → freeze the world matrix). */
function commit(sp: Species) {
  if (sp.count === 0) {
    sp.mesh.dispose()
    return
  }
  const buf = new Float32Array(sp.matrices)
  sp.mesh.thinInstanceSetBuffer("matrix", buf, 16, true)
  sp.mesh.thinInstanceRefreshBoundingInfo(false)
  sp.mesh.isPickable = false
  sp.mesh.freezeWorldMatrix()
}

/* ----------------------------------------------------- glow / shadow decals */

/** A flat additive glow card species (for the warm lamp halo). */
function makeGlowSpecies(babylon: BabylonScene): Mesh {
  const size = 256
  const tex = new DynamicTexture("wp-glow-tex", { width: size, height: size }, babylon, true)
  const ctx = tex.getContext() as unknown as CanvasRenderingContext2D
  ctx.clearRect(0, 0, size, size)
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  // A TIGHT warm core, not a big halo — additive blooms hard in daylight, so the
  // gradient must fall off fast and stay small or it whites out the whole view.
  g.addColorStop(0, "rgba(255,226,156,0.62)")
  g.addColorStop(0.2, "rgba(255,198,112,0.24)")
  g.addColorStop(0.46, "rgba(255,182,96,0.06)")
  g.addColorStop(1, "rgba(255,170,90,0)")
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  tex.update()
  const mat = new StandardMaterial("wp-glow-mat", babylon)
  mat.diffuseTexture = tex
  mat.useAlphaFromDiffuseTexture = true
  mat.emissiveColor = new Color3(1, 1, 1)
  mat.disableLighting = true
  mat.specularColor = new Color3(0, 0, 0)
  mat.alphaMode = 1 // ADD
  mat.backFaceCulling = false
  // Small card; the bright emissive orb in the lamp mesh does the heavy lifting,
  // this is just a soft sheen around it.
  const plane = MeshBuilder.CreatePlane("wp-glow", { size: 0.62 }, babylon)
  plane.material = mat
  plane.billboardMode = Mesh.BILLBOARDMODE_ALL
  plane.isPickable = false
  plane.doNotSyncBoundingInfo = true
  plane.alwaysSelectAsActiveMesh = true
  return plane
}

/** A flat soft blob-shadow ground decal species. */
function makeShadowSpecies(babylon: BabylonScene): Mesh {
  const size = 128
  const tex = new DynamicTexture("wp-pshadow-tex", { width: size, height: size }, babylon, true)
  const ctx = tex.getContext() as unknown as CanvasRenderingContext2D
  ctx.clearRect(0, 0, size, size)
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, "rgba(0,0,0,0.34)")
  g.addColorStop(0.7, "rgba(0,0,0,0.18)")
  g.addColorStop(1, "rgba(0,0,0,0)")
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  tex.update()
  const mat = new StandardMaterial("wp-pshadow-mat", babylon)
  mat.diffuseTexture = tex
  mat.useAlphaFromDiffuseTexture = true
  mat.emissiveColor = new Color3(0.5, 0.5, 0.5)
  mat.specularColor = new Color3(0, 0, 0)
  mat.backFaceCulling = false
  mat.freeze()
  const plane = MeshBuilder.CreatePlane("wp-pshadow", { size: 1 }, babylon)
  plane.material = mat
  plane.rotation.x = Math.PI / 2
  plane.bakeCurrentTransformIntoVertices()
  plane.isPickable = false
  plane.doNotSyncBoundingInfo = true
  return plane
}

/* --------------------------------------------------------------------- caps */

// Caps are the composition planner's per-species budget. On the enlarged ±120
// map these are deliberately MODEST: the same order of props as the old tight
// map, now spread across ~9× the area, so the town reads relaxed (sparse), not
// piled. composition.ts enforces min-gaps, so a cap is an upper bound the zones
// rarely all hit.
/** Default composition seed (must match `dressWorld`'s default so a separately
 * built obstacle field lines up exactly with the placed props). */
export const DRESSING_DEFAULT_SEED = 1770

export const FULL_CAPS: CompositionCaps = {
  trees: 120, // the avenues' allée + the garden grove + residential edges
  palms: 12, // a restrained few framing the plaza
  lamps: 90, // the avenue rhythm down a big road grid
  planters: 36,
  marketProps: 48, // ONE tight market quarter, not a town-wide sprinkle
  signposts: 28, // one per door
  carts: 2,
  stalls: 6,
  benches: 14,
  troughs: 2,
}

export const LEAN_CAPS: CompositionCaps = {
  trees: 56,
  palms: 8,
  lamps: 44,
  planters: 18,
  marketProps: 28,
  signposts: 14,
  carts: 2,
  stalls: 4,
  benches: 10,
  troughs: 2,
}

/* ====================================================================== main */

export function dressWorld(
  babylon: BabylonScene,
  topology: RoomTopology,
  opts: DressOptions = {},
  _scene?: WorldScene,
): Dressing {
  void _scene // reserved for era/setting-aware dressing
  const lean = !!opts.lean
  const caps = lean ? LEAN_CAPS : FULL_CAPS
  const pal: PropPalette = resolvePropPalette(opts.palette)

  const blockers = topology.blockers as Box[]
  const anchors = topology.anchors as Anchor[]

  // BUILDING blockers = blockers that aren't a plaza-feature (decor) footprint.
  // Used only for the wall-aware yaw fallback (props hard against a wall face
  // outward); composition.ts owns all placement/avoidance.
  const wallBoxes: Box[] = blockers.filter(
    (b) =>
      !anchors.some(
        (a) => a.role === "decor" && Math.abs(a.x - b.x) <= b.w / 2 && Math.abs(a.z - b.z) <= b.d / 2,
      ),
  )

  const root = new TransformNode("wp-dressing-root", babylon)

  // ---------- species meshes (one draw call each, real 3D volume) ----------
  const treeSp = makeSpeciesPool(buildTree(babylon, pal))
  const palmSp = makeSpeciesPool(buildPalm(babylon, pal))
  const lampSp = makeSpeciesPool(buildLamp(babylon, pal))
  const planterSp = makeSpeciesPool(buildPlanter(babylon, pal))
  const barrelSp = makeSpeciesPool(buildBarrel(babylon, pal))
  const crateSp = makeSpeciesPool(buildCrate(babylon, pal))
  const sackSp = makeSpeciesPool(buildSack(babylon, pal))
  const signSp = makeSpeciesPool(buildSignpost(babylon, pal))
  const cartSp = makeSpeciesPool(buildCart(babylon, pal))
  const stallSp = makeSpeciesPool(buildStall(babylon, pal))
  const benchSp = makeSpeciesPool(buildBench(babylon, pal))
  const troughSp = makeSpeciesPool(buildTrough(babylon, pal).mesh)
  const glowSp = makeSpeciesPool(makeGlowSpecies(babylon))
  const shadowSp = makeSpeciesPool(makeShadowSpecies(babylon))

  const allSpecies = [
    treeSp, palmSp, lampSp, planterSp, barrelSp, crateSp, sackSp,
    signSp, cartSp, stallSp, benchSp, troughSp, glowSp, shadowSp,
  ]
  for (const s of allSpecies) s.mesh.parent = root

  // species lookup so we can instantiate planner output by SpeciesId.
  const speciesById: Record<SpeciesId, Species> = {
    tree: treeSp,
    palm: palmSp,
    lamp: lampSp,
    planter: planterSp,
    barrel: barrelSp,
    crate: crateSp,
    sack: sackSp,
    signpost: signSp,
    cart: cartSp,
    stall: stallSp,
    bench: benchSp,
    trough: troughSp,
  }

  /* ----------------- compose: the ZONED, SPACED layout plan ---------------
   * All WHERE / HOW MANY / HOW SPACED decisions live in composition.ts (a pure,
   * testable planner). Here we just turn each planned Placement into a thin
   * instance + blob shadow, and a warm glow on every lamp. Yaw is baked from the
   * plan (benches face the fountain, stalls face the street, etc.); where the
   * plan leaves yaw undefined we fall back to a wall-aware bake so a prop hard
   * against a building reads as attached. */
  const plan = composeDressing(topology, { seed: opts.seed ?? 1770, caps })

  // a tiny seeded yaw source for plan entries that don't pin a facing.
  let yawSeed = (opts.seed ?? 1770) >>> 0
  const nextYaw = () => {
    yawSeed = (yawSeed * 1664525 + 1013904223) >>> 0
    return (yawSeed / 4294967296) * Math.PI * 2
  }
  const wallAwareYaw = (x: number, z: number): number => {
    let nearest: Box | null = null
    let nd = Infinity
    for (const b of wallBoxes) {
      const dx = Math.max(Math.abs(x - b.x) - b.w / 2, 0)
      const dz = Math.max(Math.abs(z - b.z) - b.d / 2, 0)
      const d = Math.hypot(dx, dz)
      if (d < nd) {
        nd = d
        nearest = b
      }
    }
    if (nearest && nd < 1.5) return Math.atan2(x - nearest.x, z - nearest.z)
    return nextYaw()
  }

  for (const p of plan.placements) {
    const sp = speciesById[p.species]
    const yaw = p.yaw ?? wallAwareYaw(p.x, p.z)
    pushInstance(sp, instanceMatrix(p.x, 0, p.z, p.scale, yaw))
    if (p.shadow > 0) pushInstance(shadowSp, instanceMatrix(p.x, 0.02, p.z, p.shadow, 0))
    if (p.species === "lamp") {
      // warm glow halo at the orb height beside the post.
      pushInstance(glowSp, instanceMatrix(p.x + 0.38, 2.5, p.z, 1, 0))
    }
  }

  // ---- grand multi-tier fountain (one centrepiece, full tier only) ----
  let fountain: { root: Mesh; shimmer: Mesh } | null = null
  const decorAnchors = anchors.filter((a) => a.role === "decor")
  const decorAnchor = decorAnchors.reduce<Anchor | undefined>(
    (best, a) => (!best || a.x * a.x + a.z * a.z < best.x * best.x + best.z * best.z ? a : best),
    undefined,
  )
  if (decorAnchor) {
    fountain = buildFountainSolid(babylon, pal)
    fountain.root.parent = root
    fountain.root.position.set(decorAnchor.x, 0, decorAnchor.z)
    fountain.root.freezeWorldMatrix()
    pushInstance(shadowSp, instanceMatrix(decorAnchor.x, 0.02, decorAnchor.z, 6, 0))
  }

  // ---------- commit all thin-instance buffers (freezes static matrices) ----
  for (const s of allSpecies) commit(s)

  /* ------------------------- gentle life via onFrame ---------------------- */
  let unsub: (() => void) | undefined
  if (opts.onFrame && (glowSp.count > 0 || fountain)) {
    let t = 0
    const glowMat = glowSp.count > 0 ? (glowSp.mesh.material as StandardMaterial) : null
    const shimmerMat = fountain ? (fountain.shimmer.material as StandardMaterial) : null
    unsub = opts.onFrame((dt) => {
      t += dt
      // lamp glow: a slow warm flicker (one shared material alpha — 1 op).
      if (glowMat) {
        // keep the daylight bloom gentle — a soft warm sheen, not a flare.
        const flick = 0.42 + Math.sin(t * 2.1) * 0.05 + Math.sin(t * 11.3) * 0.03
        glowMat.alpha = Math.max(0.28, flick)
      }
      // fountain shimmer: pulse the top water tier emissive subtly (1 op).
      if (shimmerMat) {
        shimmerMat.emissiveColor.set(0.18 + Math.sin(t * 3) * 0.05, 0.32, 0.36)
      }
    })
  }

  // Collision footprints for the SOLID props (skip décor). The caller (game.ts)
  // appends these to the building+fountain obstacles to form the unified field.
  const footprints = propFootprints(plan.placements)

  return {
    footprints,
    dispose: () => {
      if (unsub) unsub()
      for (const s of allSpecies) s.mesh.dispose()
      if (fountain) {
        fountain.root.getChildMeshes().forEach((m) => m.dispose())
        fountain.root.dispose()
      }
      root.dispose()
    },
  }
}
