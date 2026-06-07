import type { Scene as BabylonScene } from "@babylonjs/core/scene"
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder"
import { Mesh } from "@babylonjs/core/Meshes/mesh"
import { TransformNode } from "@babylonjs/core/Meshes/transformNode"
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial"
import { Color3, Matrix, Quaternion, Vector3 } from "@babylonjs/core/Maths/math"
import "@babylonjs/core/Meshes/thinInstanceMesh"
import type { CityBoundary } from "../city/layout"

/**
 * gateDressing.ts — GATE-TOWER DRESSING for Corpan City's crafted land edges
 * (env-art, task #32 visual half).
 *
 * `places` builds the perimeter RAMPART + the square gate PIERS that flank each
 * gate opening (`world/cityWall.ts`, from the same `CityWallRect` segments the
 * collider uses). Bare, those gateways read as "a gap in a wall". This dresses
 * each one so it reads as a HANDSOME THRESHOLD you pass through: a tall hanging
 * BANNER down the inner face of each gate pier, a little FLAG on the pier cap,
 * and a warm glowing BRAZIER bowl at the foot of each jamb.
 *
 * It reads the gate positions from `layout.boundary` (the SAME data cityWall uses
 * to place the piers) so the dressing lands exactly on the piers without coupling
 * to that module. Each element is ONE merged master, thin-instanced across every
 * gate jamb + FROZEN; the brazier flame is a tiny emissive sphere with an OPT-OUT
 * flicker (one material lerp, RM-gated). Additive + bounded (own create / update /
 * dispose, like cityWall.ts / harborBoats.ts); never touches the streaming spine.
 */

export interface GateDressing {
  root: TransformNode
  /** gentle brazier-flame flicker (no-op under reduced motion). */
  update: (dt: number) => void
  dispose: () => void
}

export interface GateDressingOptions {
  boundary: CityBoundary
  /** full-city bounds (the rampart sits `inset` inside these on each walled edge). */
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number }
  palette?: Record<string, string>
  reducedMotion?: boolean
  /** the wall body height the dressing hangs against (cityWall default 4.6). */
  wallHeight?: number
}

const hexC3 = (hex: string | undefined, fallback: string): Color3 =>
  Color3.FromHexString(hex ?? fallback)
const shade = (c: Color3, t: number): Color3 =>
  t >= 0
    ? new Color3(c.r + (1 - c.r) * t, c.g + (1 - c.g) * t, c.b + (1 - c.b) * t)
    : new Color3(c.r * (1 + t), c.g * (1 + t), c.b * (1 + t))

let guid = 0

/** A jamb to dress: world position of one gate pier + the inward normal (the
 *  direction the banner faces / the gateway opens toward the city). */
interface Jamb {
  x: number
  z: number
  /** yaw so the banner's face turns toward the gateway opening + city interior. */
  yaw: number
}

export function buildGateDressing(scene: BabylonScene, opts: GateDressingOptions): GateDressing {
  const tag = `wp-gatedress-${guid++}`
  const reduce = !!opts.reducedMotion
  const root = new TransformNode(`${tag}-root`, scene)
  const wallH = opts.wallHeight ?? 4.6
  const half = (opts.bounds.maxX - opts.bounds.minX) / 2
  const inner = half - opts.boundary.inset // the rampart centre-line on each edge

  // ── palette: a rich heraldic BANNER (accent), pale wood/iron flagpole, warm
  // brazier flame. Banner leans on the scene accent so it belongs to the town. ──
  const accent = hexC3(opts.palette?.accent, "#e08a3c")
  const banner = accent
  const bannerDk = shade(accent, -0.26)
  const iron = hexC3(undefined, "#39332b")
  const flame = hexC3(undefined, "#ffc24a")
  const ember = hexC3(undefined, "#e0641e")

  const mat = (name: string, c: Color3, emissive = 0.3, alpha?: number) => {
    const m = new StandardMaterial(`${tag}-${name}`, scene)
    m.diffuseColor = c
    m.emissiveColor = c.scale(emissive)
    m.specularColor = new Color3(0, 0, 0)
    if (alpha !== undefined) m.alpha = alpha
    m.freeze()
    return m
  }
  const mBanner = mat("banner", banner, 0.32)
  const mBannerDk = mat("bannerDk", bannerDk, 0.3)
  const mIron = mat("iron", iron, 0.22)
  const mBowl = mat("bowl", shade(iron, 0.1), 0.24)
  // flame material kept LIVE (unfrozen) for the flicker lerp.
  const mFlame = new StandardMaterial(`${tag}-flame`, scene)
  mFlame.diffuseColor = new Color3(0, 0, 0)
  mFlame.emissiveColor = flame
  mFlame.specularColor = new Color3(0, 0, 0)
  mFlame.alpha = 0.92
  const allMats = [mBanner, mBannerDk, mIron, mBowl, mFlame]

  // ── collect every gate JAMB (a pier flanks each side of every gate opening). ──
  const jambs: Jamb[] = []
  for (const g of opts.boundary.gates) {
    // pier jambs sit at center ± halfWidth along the wall's long axis. The banner
    // faces INWARD (toward the city centre / the gateway), so yaw points the +Z
    // face of the banner toward the interior.
    if (g.side === "south") {
      // south edge runs along X at z = -inner; interior is +Z → face +Z (yaw 0).
      jambs.push({ x: g.center - g.halfWidth, z: -inner, yaw: 0 })
      jambs.push({ x: g.center + g.halfWidth, z: -inner, yaw: 0 })
    } else if (g.side === "west") {
      // west edge runs along Z at x = -inner; interior is +X → face +X (yaw +90°).
      jambs.push({ x: -inner, z: g.center - g.halfWidth, yaw: Math.PI / 2 })
      jambs.push({ x: -inner, z: g.center + g.halfWidth, yaw: Math.PI / 2 })
    } else {
      // east edge at x = +inner; interior is -X → face -X (yaw -90°).
      jambs.push({ x: inner, z: g.center - g.halfWidth, yaw: -Math.PI / 2 })
      jambs.push({ x: inner, z: g.center + g.halfWidth, yaw: -Math.PI / 2 })
    }
  }

  /* ---- BANNER master: a tall cloth hung from a crossbar near the pier top,
   * draping down the pier's inner face, with a darker hem band + a swallowtail
   * notch suggested by two panels, plus a small FLAG on a pole above. Built about
   * a local origin where +Z is the facing (outward to the gateway). ---------- */
  const buildBanner = (): Mesh => {
    const clothParts: Mesh[] = []
    const darkParts: Mesh[] = []
    const ironParts: Mesh[] = []
    const PIER_TOP = wallH + 1.6 // matches cityWall's pier cap height
    const PIER_HALF = 1.0 // pier is ~2.0 wide; banner hangs just proud of its face
    const z = PIER_HALF + 0.08 // a hair off the inner face
    // crossbar the banner hangs from.
    const bar = MeshBuilder.CreateCylinder(`${tag}-bar`, { diameter: 0.14, height: 1.95, tessellation: 6 }, scene)
    bar.rotation.z = Math.PI / 2
    bar.position.set(0, PIER_TOP - 0.45, z)
    ironParts.push(bar)
    // main cloth panel — a long, generous drape down most of the pier face.
    const cloth = MeshBuilder.CreateBox(`${tag}-cloth`, { width: 1.7, height: 4.4, depth: 0.05 }, scene)
    cloth.position.set(0, PIER_TOP - 2.7, z)
    clothParts.push(cloth)
    // a swallowtail point at the bottom (a smaller panel rotated to a V hint).
    const tail = MeshBuilder.CreateCylinder(`${tag}-tail`, { diameter: 1.7, height: 0.05, tessellation: 3 }, scene)
    tail.rotation.x = Math.PI / 2
    tail.rotation.z = Math.PI
    tail.scaling.y = 1.4
    tail.bakeCurrentTransformIntoVertices()
    tail.position.set(0, PIER_TOP - 5.0, z)
    clothParts.push(tail)
    // hem band (darker) near the bottom.
    const hem = MeshBuilder.CreateBox(`${tag}-hem`, { width: 1.74, height: 0.5, depth: 0.06 }, scene)
    hem.position.set(0, PIER_TOP - 4.7, z)
    darkParts.push(hem)
    // a central emblem stripe (darker) down the cloth.
    const stripe = MeshBuilder.CreateBox(`${tag}-stripe`, { width: 0.46, height: 3.6, depth: 0.06 }, scene)
    stripe.position.set(0, PIER_TOP - 2.7, z)
    darkParts.push(stripe)
    // FLAG: a small pennant on a pole rising above the pier cap.
    const pole = MeshBuilder.CreateCylinder(`${tag}-pole`, { diameter: 0.08, height: 1.4, tessellation: 6 }, scene)
    pole.position.set(0, PIER_TOP + 0.7, 0)
    ironParts.push(pole)
    const flag = MeshBuilder.CreateBox(`${tag}-flag`, { width: 0.7, height: 0.42, depth: 0.04 }, scene)
    flag.position.set(0.39, PIER_TOP + 1.1, 0)
    clothParts.push(flag)

    const cloth0 = Mesh.MergeMeshes(clothParts, true, true, undefined, false, false)!
    cloth0.material = mBanner
    const dark0 = Mesh.MergeMeshes(darkParts, true, true, undefined, false, false)!
    dark0.material = mBannerDk
    const iron0 = Mesh.MergeMeshes(ironParts, true, true, undefined, false, false)!
    iron0.material = mIron
    const merged = Mesh.MergeMeshes([cloth0, dark0, iron0], true, true, undefined, false, true)!
    merged.name = `${tag}-banner`
    return merged
  }

  /* ---- BRAZIER master: an iron tripod bowl at the foot of the jamb (set toward
   * the gateway opening), holding a warm emissive flame. The flame is kept as a
   * SEPARATE submesh (live material) so it can flicker. ---------------------- */
  const buildBrazier = (): Mesh => {
    const ironParts: Mesh[] = []
    const z = 1.1 // out toward the gateway from the pier face
    // three splayed legs (thin cylinders) → a tripod.
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2
      const leg = MeshBuilder.CreateCylinder(`${tag}-leg`, { diameter: 0.1, height: 1.0, tessellation: 5 }, scene)
      leg.position.set(Math.cos(a) * 0.22, 0.5, z + Math.sin(a) * 0.22)
      leg.rotation.x = Math.sin(a) * 0.18
      leg.rotation.z = -Math.cos(a) * 0.18
      leg.bakeCurrentTransformIntoVertices()
      ironParts.push(leg)
    }
    // the bowl (a shallow wide cone, open up).
    const bowl = MeshBuilder.CreateCylinder(`${tag}-bowl`, { diameterTop: 0.78, diameterBottom: 0.34, height: 0.4, tessellation: 10 }, scene)
    bowl.position.set(0, 1.2, z)
    bowl.material = mBowl
    const ironMesh = Mesh.MergeMeshes(ironParts, true, true, undefined, false, false)!
    ironMesh.material = mIron
    const solid = Mesh.MergeMeshes([ironMesh, bowl], true, true, undefined, false, true)!
    // flame: a bright emissive teardrop rising from the bowl (own live material).
    const fl = MeshBuilder.CreateSphere(`${tag}-flame`, { diameter: 0.62, segments: 8 }, scene)
    fl.scaling.y = 1.9
    fl.position.set(0, 1.85, z)
    fl.material = mFlame
    const merged = Mesh.MergeMeshes([solid, fl], true, true, undefined, false, true)!
    merged.name = `${tag}-brazier`
    return merged
  }

  /* ---- instance one master across every jamb as ONE thin-instanced clone. ---- */
  const instanceSet = (master: Mesh): Mesh | null => {
    master.setEnabled(false)
    if (!jambs.length) return null
    const clone = master.clone(`${master.name}-inst`, null) as Mesh
    clone.makeGeometryUnique()
    clone.setEnabled(true) // the master is a disabled template; the clone draws
    clone.parent = root
    clone.isPickable = false
    clone.alwaysSelectAsActiveMesh = true
    clone.doNotSyncBoundingInfo = true
    const buf = new Float32Array(jambs.length * 16)
    jambs.forEach((j, i) => {
      Matrix.Compose(
        new Vector3(1, 1, 1),
        Quaternion.RotationAxis(Vector3.Up(), j.yaw),
        new Vector3(j.x, 0, j.z),
      ).copyToArray(buf, i * 16)
    })
    clone.thinInstanceSetBuffer("matrix", buf, 16, true)
    clone.thinInstanceRefreshBoundingInfo(false)
    clone.freezeWorldMatrix()
    return clone
  }

  const bannerMaster = buildBanner()
  const bannerInst = instanceSet(bannerMaster)
  const brazierMaster = buildBrazier()
  const brazierInst = instanceSet(brazierMaster)
  for (const m of [bannerMaster, brazierMaster]) m.dispose()
  const instMeshes = [bannerInst, brazierInst].filter(Boolean) as Mesh[]

  /* ---------------------------- flame flicker ---------------------------- */
  const baseEm = mFlame.emissiveColor.clone()
  let t = 0
  const update = (dt: number) => {
    if (reduce) return
    t += dt
    // a warm flicker: emissive breathes between flame + ember on a jittered sine.
    const f = 0.5 + 0.5 * Math.sin(t * 7.3) * 0.6 + 0.4 * Math.sin(t * 11.1 + 1.3)
    mFlame.emissiveColor = Color3.Lerp(ember, baseEm, 0.5 + 0.5 * Math.min(1, Math.max(0, f)))
  }

  return {
    root,
    update,
    dispose: () => {
      for (const m of instMeshes) m.dispose()
      for (const m of allMats) m.dispose()
      root.dispose()
    },
  }
}
