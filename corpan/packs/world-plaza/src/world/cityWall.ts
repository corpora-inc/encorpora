import type { Scene as BabylonScene } from "@babylonjs/core/scene"
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder"
import { Mesh } from "@babylonjs/core/Meshes/mesh"
import { TransformNode } from "@babylonjs/core/Meshes/transformNode"
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial"
import { Color3, Matrix, Quaternion, Vector3 } from "@babylonjs/core/Maths/math"
import "@babylonjs/core/Meshes/thinInstanceMesh"
import type { CityWallRect } from "../city/layout"

/**
 * cityWall.ts — the crafted WORLD-EDGE RAMPART for Corpan City (#32).
 *
 * The world boundary is intentional, not a fog dead-end: the +Z edge is the
 * river/sea, and the three LAND edges (south/east/west) get a stone perimeter
 * RAMPART with gate openings. This module builds the rampart MESH from the SAME
 * `CityWallRect[]` segments collision.ts turns into box obstacles, so what you
 * see (the wall) and what stops you (the collider) are one and the same — you
 * meet a designed wall at the edge, never raw ground or void.
 *
 * It is an ADDITIVE, bounded layer (its own create + dispose, like
 * harborWater.ts / riverwalk.ts): it does NOT touch the city streaming spine. The
 * rampart is far from the spawn plaza and rarely fully in frame, and everything
 * repeated is built as merged geometry / thin instances and FROZEN, so the whole
 * perimeter is a handful of draw calls. There is no per-frame cost (no update()).
 *
 * GATES. A segment with a `gateGap` is an opening (an avenue passes through, or
 * the bridge mouth on the sea wall). We build the wall body only OUTSIDE the gap
 * and flank each gate with a pair of taller GATE PIERS so the opening reads as a
 * deliberate gateway, not a missing chunk of wall.
 */

export interface CityWall {
  /** the root holding every rampart mesh — already world-positioned. */
  root: TransformNode
  dispose: () => void
}

export interface CityWallOptions {
  /** the per-chunk wall segments (collision's source of truth). */
  segments: CityWallRect[]
  palette?: Record<string, string>
  /** wall body height (world units). default 4.6 — a real rampart that reads as a
   *  designed edge from eye level, not a low curb. */
  height?: number
}

const hexC3 = (hex: string | undefined, fallback: string): Color3 =>
  Color3.FromHexString(hex ?? fallback)
const shade = (c: Color3, t: number): Color3 =>
  t >= 0
    ? new Color3(c.r + (1 - c.r) * t, c.g + (1 - c.g) * t, c.b + (1 - c.b) * t)
    : new Color3(c.r * (1 + t), c.g * (1 + t), c.b * (1 + t))

let wuid = 0

export function buildCityWall(scene: BabylonScene, opts: CityWallOptions): CityWall {
  const tag = `wp-citywall-${wuid++}`
  const H = opts.height ?? 4.6
  const root = new TransformNode(`${tag}-root`, scene)

  const stoneC = hexC3(opts.palette?.stone, "#d8c8a6")
  const mBody = new StandardMaterial(`${tag}-body`, scene)
  mBody.diffuseColor = shade(stoneC, -0.06)
  mBody.emissiveColor = shade(stoneC, -0.06).scale(0.28)
  mBody.specularColor = new Color3(0, 0, 0)
  const mCap = new StandardMaterial(`${tag}-cap`, scene)
  mCap.diffuseColor = shade(stoneC, 0.12)
  mCap.emissiveColor = shade(stoneC, 0.12).scale(0.32)
  mCap.specularColor = new Color3(0, 0, 0)
  const mPier = new StandardMaterial(`${tag}-pier`, scene)
  mPier.diffuseColor = shade(stoneC, -0.14)
  mPier.emissiveColor = shade(stoneC, -0.14).scale(0.26)
  mPier.specularColor = new Color3(0, 0, 0)
  for (const m of [mBody, mCap, mPier]) m.freeze()

  // ── wall body: one merged box per [a,b] run of each segment (outside the gate),
  // plus a slim CAP box on top so the rampart reads crenellated, not a slab. ──
  const bodyParts: Mesh[] = []
  const capParts: Mesh[] = []
  // gate-pier placements (square towers flanking each gate opening).
  const pierPlacements: Array<{ x: number; z: number }> = []

  const addRun = (
    longX: boolean,
    a0: number,
    a1: number,
    shortC: number,
    thickness: number,
  ) => {
    const len = a1 - a0
    if (len <= 0.1) return
    const ac = (a0 + a1) / 2
    const w = longX ? len : thickness
    const d = longX ? thickness : len
    const body = MeshBuilder.CreateBox(`${tag}-b`, { width: w, height: H, depth: d }, scene)
    body.position.set(longX ? ac : shortC, H / 2, longX ? shortC : ac)
    bodyParts.push(body)
    const cap = MeshBuilder.CreateBox(`${tag}-c`, { width: w + 0.3, height: 0.4, depth: d + 0.3 }, scene)
    cap.position.set(longX ? ac : shortC, H + 0.2, longX ? shortC : ac)
    capParts.push(cap)
  }

  for (const seg of opts.segments) {
    const longX = seg.side === "north" || seg.side === "south"
    const x0 = Math.min(seg.x0, seg.x1)
    const x1 = Math.max(seg.x0, seg.x1)
    const z0 = Math.min(seg.z0, seg.z1)
    const z1 = Math.max(seg.z0, seg.z1)
    const shortC = longX ? (z0 + z1) / 2 : (x0 + x1) / 2
    const thickness = longX ? z1 - z0 : x1 - x0
    const lo = longX ? x0 : z0
    const hi = longX ? x1 : z1
    if (!seg.gateGap) {
      addRun(longX, lo, hi, shortC, thickness)
    } else {
      const [g0, g1] = seg.gateGap[0] <= seg.gateGap[1] ? seg.gateGap : [seg.gateGap[1], seg.gateGap[0]]
      addRun(longX, lo, Math.min(g0, hi), shortC, thickness)
      addRun(longX, Math.max(g1, lo), hi, shortC, thickness)
      // gate piers flank the opening (only if the gap is genuinely inside this seg).
      if (g0 > lo - 1 && g0 < hi + 1) pierPlacements.push(longX ? { x: g0, z: shortC } : { x: shortC, z: g0 })
      if (g1 > lo - 1 && g1 < hi + 1) pierPlacements.push(longX ? { x: g1, z: shortC } : { x: shortC, z: g1 })
    }
  }

  const merged: Mesh[] = []
  const bodyMesh = bodyParts.length ? Mesh.MergeMeshes(bodyParts, true, true, undefined, false, false) : null
  if (bodyMesh) {
    bodyMesh.name = `${tag}-bodymesh`
    bodyMesh.material = mBody
    finalize(bodyMesh)
    merged.push(bodyMesh)
  }
  const capMesh = capParts.length ? Mesh.MergeMeshes(capParts, true, true, undefined, false, false) : null
  if (capMesh) {
    capMesh.name = `${tag}-capmesh`
    capMesh.material = mCap
    finalize(capMesh)
    merged.push(capMesh)
  }

  // ── gate piers: a square crenellated tower master, thin-instanced at each gate
  // jamb. Taller than the wall so the gateway reads as a deliberate threshold. ──
  let pierInst: Mesh | null = null
  if (pierPlacements.length) {
    const pier = buildPier(scene, tag, H)
    pier.material = mPier
    pier.setEnabled(false)
    pierInst = pier.clone(`${tag}-pier-inst`, null) as Mesh
    pierInst.makeGeometryUnique()
    pierInst.parent = root
    pierInst.isPickable = false
    const buf = new Float32Array(pierPlacements.length * 16)
    pierPlacements.forEach((p, i) => {
      Matrix.Compose(
        new Vector3(1, 1, 1),
        Quaternion.Identity(),
        new Vector3(p.x, 0, p.z),
      ).copyToArray(buf, i * 16)
    })
    pierInst.thinInstanceSetBuffer("matrix", buf, 16, true)
    pierInst.thinInstanceRefreshBoundingInfo(false)
    finalize(pierInst)
    pier.dispose()
  }

  function finalize(m: Mesh) {
    m.parent = root
    m.isPickable = false
    m.alwaysSelectAsActiveMesh = true
    m.doNotSyncBoundingInfo = true
    m.freezeWorldMatrix()
  }

  return {
    root,
    dispose: () => {
      for (const m of merged) m.dispose()
      if (pierInst) pierInst.dispose()
      for (const m of [mBody, mCap, mPier]) m.dispose()
      root.dispose()
    },
  }
}

/** A square gate-pier/tower: a plinth + shaft + a heavier crenellated cap. */
function buildPier(scene: BabylonScene, tag: string, wallH: number): Mesh {
  const parts: Mesh[] = []
  const box = (w: number, h: number, d: number, y: number) => {
    const m = MeshBuilder.CreateBox(`${tag}-pp`, { width: w, height: h, depth: d }, scene)
    m.position.y = y
    parts.push(m)
    return m
  }
  const top = wallH + 1.6 // overtops the wall body
  box(2.4, 0.4, 2.4, 0.2) // base
  box(2.0, top - 0.4, 2.0, (top + 0.2) / 2) // shaft
  box(2.6, 0.5, 2.6, top + 0.05) // cap
  const merged = Mesh.MergeMeshes(parts, true, true, undefined, false, false)!
  merged.name = `${tag}-pier`
  return merged
}

/** Pull every wall segment out of a layout's chunks (the source of truth). */
export function wallSegmentsOf(chunks: Array<{ walls: CityWallRect[] }>): CityWallRect[] {
  return chunks.flatMap((c) => c.walls)
}
