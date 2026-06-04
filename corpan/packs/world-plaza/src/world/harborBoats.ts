import type { Scene as BabylonScene } from "@babylonjs/core/scene"
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder"
import { Mesh } from "@babylonjs/core/Meshes/mesh"
import { TransformNode } from "@babylonjs/core/Meshes/transformNode"
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial"
import { Color3, Matrix, Quaternion, Vector3 } from "@babylonjs/core/Maths/math"
import "@babylonjs/core/Meshes/thinInstanceMesh"

/**
 * harborBoats.ts — DOCKED BOATS in the harbour for Corpan City's crafted world
 * edge (env-art, task #32 visual half).
 *
 * The +Z edge is a real RIVER BAND (CityWater: `[waterZ, farBankZ)` open water
 * between the near + far quays). An empty river reads as "the map ends in blue".
 * This moors a handful of low-poly HD-2D boats along the quays so the harbour
 * reads as a living, designed waterfront — the thing you sail to, not a dead end.
 *
 * Two hull species (a fat little fishing SMACK and a longer SLOOP with a tall
 * mast) give variety; each is ONE merged low-poly mesh, thin-instanced along the
 * water edges and FROZEN. The whole fleet is a couple of draw calls + a tiny,
 * OPT-OUT bob (a single per-frame Y/​roll lerp on the instanced roots, skipped
 * under reduced motion). Additive + bounded (own create/update/dispose, like
 * riverwalk.ts / cityWall.ts); never touches the streaming spine.
 *
 * Boats float at the WATER surface (y≈0) just OFF each quay, facing along the
 * shore, kept inside the open-river band so none beach on the promenade. The
 * caller passes the band geometry (`waterZ`/`bankZ`/`farBankZ`/`farPromZ` +
 * bounds + the bridge gap to keep the channel clear) — read in game.ts from
 * `layout.water`.
 */

export interface HarborBoats {
  root: TransformNode
  /** gentle moored bob (no-op under reduced motion). drive from onFrame. */
  update: (dt: number) => void
  dispose: () => void
}

export interface HarborBoatsOptions {
  /** the river band (CityWater): near water edge, far water edge, bounds. */
  waterZ: number
  farBankZ: number
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number }
  /** keep boats clear of the bridge channel (centre x + half-width). */
  bridge?: { x: number; halfWidth: number }
  palette?: Record<string, string>
  reducedMotion?: boolean
  /** rough number of boats along EACH quay (default 6; lean tiers pass fewer). */
  perQuay?: number
}

const hexC3 = (hex: string | undefined, fallback: string): Color3 =>
  Color3.FromHexString(hex ?? fallback)
const shade = (c: Color3, t: number): Color3 =>
  t >= 0
    ? new Color3(c.r + (1 - c.r) * t, c.g + (1 - c.g) * t, c.b + (1 - c.b) * t)
    : new Color3(c.r * (1 + t), c.g * (1 + t), c.b * (1 + t))

let buid = 0

export function buildHarborBoats(scene: BabylonScene, opts: HarborBoatsOptions): HarborBoats {
  const tag = `wp-boats-${buid++}`
  const reduce = !!opts.reducedMotion
  const root = new TransformNode(`${tag}-root`, scene)

  // ── warm boat palette: dark waterline hulls, warm wood decks, cream/red trim,
  // off-white sails. Derived from the scene so the fleet belongs to the town. ──
  const wood = hexC3(opts.palette?.trim, "#9a6a3c")
  const hullCols = [
    hexC3(opts.palette?.accent, "#b8543a"), // a warm red hull
    shade(hexC3(opts.palette?.trim, "#3a6a78"), -0.1), // a teal hull
    hexC3(undefined, "#3d4a52"), // a dark slate hull
  ]
  const deck = shade(wood, 0.1)
  const trimDk = shade(wood, -0.34)
  const sail = hexC3(undefined, "#efe6d2")
  const mast = shade(wood, -0.2)

  const mat = (name: string, c: Color3, emissive = 0.3, alpha?: number) => {
    const m = new StandardMaterial(`${tag}-${name}`, scene)
    m.diffuseColor = c
    m.emissiveColor = c.scale(emissive)
    m.specularColor = new Color3(0, 0, 0)
    if (alpha !== undefined) m.alpha = alpha
    m.freeze()
    return m
  }
  const mDeck = mat("deck", deck)
  const mTrim = mat("trim", trimDk)
  const mMast = mat("mast", mast)
  const mSail = mat("sail", sail, 0.42)
  const hullMats = hullCols.map((c, i) => mat(`hull${i}`, c, 0.26))
  const allMats = [mDeck, mTrim, mMast, mSail, ...hullMats]

  /* ---- a hull mesh: a boat-shaped low-poly body. Built from a box hull with a
   * tapered bow (a wedge) + a raised gunwale rim + a small cabin, all merged with
   * ONE hull colour. Feet at the waterline (y=0); the hull dips slightly below. */
  const buildHull = (len: number, beam: number, hullMat: StandardMaterial, withCabin: boolean): Mesh => {
    const hullParts: Mesh[] = []
    const woodParts: Mesh[] = []
    const box = (
      arr: Mesh[], w: number, h: number, d: number, x: number, y: number, z: number,
    ) => {
      const m = MeshBuilder.CreateBox(`${tag}-h`, { width: w, height: h, depth: d }, scene)
      m.position.set(x, y, z)
      arr.push(m)
      return m
    }
    const hullH = 0.7
    // main hull body (sits with its waterline a touch below y=0).
    box(hullParts, beam, hullH, len * 0.78, 0, -0.05, 0)
    // tapered bow wedge at +Z end (a short box scaled to a point via a prism).
    const bow = MeshBuilder.CreateCylinder(`${tag}-bow`, { diameter: beam, height: len * 0.34, tessellation: 3 }, scene)
    bow.rotation.x = Math.PI / 2
    bow.rotation.y = Math.PI / 6
    bow.scaling.x = 1
    bow.position.set(0, -0.05, len * 0.42)
    hullParts.push(bow)
    // stern cap
    box(hullParts, beam, hullH, len * 0.1, 0, -0.05, -len * 0.42)
    // gunwale rim (a thin wood lip around the top of the hull).
    box(woodParts, beam + 0.12, 0.14, len * 0.82, 0, hullH * 0.5 - 0.05, 0)
    // deck inset (wood floor just below the rim).
    box(woodParts, beam - 0.18, 0.1, len * 0.7, 0, hullH * 0.5 - 0.18, 0)
    if (withCabin) {
      // a small cabin box toward the stern.
      box(woodParts, beam - 0.3, 0.5, len * 0.24, 0, hullH * 0.5 + 0.2, -len * 0.18)
    }
    // merge hull-colour parts and wood parts separately, then into one mesh.
    const hullMesh = Mesh.MergeMeshes(hullParts, true, true, undefined, false, false)!
    hullMesh.material = hullMat
    const woodMesh = Mesh.MergeMeshes(woodParts, true, true, undefined, false, false)!
    woodMesh.material = mDeck
    const merged = Mesh.MergeMeshes([hullMesh, woodMesh], true, true, undefined, false, true)!
    merged.name = `${tag}-hull`
    return merged
  }

  /* ---- a mast + furled sail: a vertical mast, a yard (cross-spar), and a soft
   * furled/half-set sail (a thin tapered box). Its own merged mesh (mast wood +
   * sail), instanced together with a hull placement. ---------------------- */
  const buildRig = (mastH: number): Mesh => {
    const woodParts: Mesh[] = []
    const sailParts: Mesh[] = []
    const m = MeshBuilder.CreateCylinder(`${tag}-mast`, { diameter: 0.16, height: mastH, tessellation: 6 }, scene)
    m.position.y = mastH / 2
    woodParts.push(m)
    const yard = MeshBuilder.CreateCylinder(`${tag}-yard`, { diameter: 0.1, height: mastH * 0.6, tessellation: 6 }, scene)
    yard.rotation.z = Math.PI / 2
    yard.position.y = mastH * 0.78
    woodParts.push(yard)
    // a soft sail hung from the yard (thin tapered panel, slightly bellied).
    const s = MeshBuilder.CreateBox(`${tag}-sail`, { width: mastH * 0.52, height: mastH * 0.5, depth: 0.05 }, scene)
    s.position.set(0, mastH * 0.5, 0.04)
    sailParts.push(s)
    const woodMesh = Mesh.MergeMeshes(woodParts, true, true, undefined, false, false)!
    woodMesh.material = mMast
    const sailMesh = Mesh.MergeMeshes(sailParts, true, true, undefined, false, false)!
    sailMesh.material = mSail
    const merged = Mesh.MergeMeshes([woodMesh, sailMesh], true, true, undefined, false, true)!
    merged.name = `${tag}-rig`
    return merged
  }

  /* ---- species: a SMACK (short, fat, cabin, no sail) + a SLOOP (longer, tall
   * masted sail). Each is hull (+ optional rig merged in) → one master mesh. */
  const buildSmack = (hullMat: StandardMaterial): Mesh => buildHull(3.4, 1.5, hullMat, true)
  const buildSloop = (hullMat: StandardMaterial): Mesh => {
    const hull = buildHull(5.2, 1.7, hullMat, false)
    const rig = buildRig(4.2)
    rig.position.set(0, 0.3, 0.4)
    const merged = Mesh.MergeMeshes([hull, rig], true, true, undefined, false, true)!
    merged.name = `${tag}-sloop`
    return merged
  }

  /* ---- placements: line boats along each quay just inside the open water, a
   * couple of metres OFF the quay edge, facing along the shore (yaw 0 ≈ broadside
   * to the bank), kept out of the bridge channel. ------------------------- */
  interface Placement { x: number; z: number; yaw: number; species: 0 | 1; hull: number }
  const placements: Placement[] = []
  const perQuay = opts.perQuay ?? 6
  const x0 = opts.bounds.minX + 24
  const x1 = opts.bounds.maxX - 24
  const span = x1 - x0
  const bridge = opts.bridge
  // a deterministic tiny PRNG so the fleet is varied but stable per build.
  let seed = 0x9e37 ^ Math.round(opts.waterZ * 7)
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)

  const lineQuay = (edgeZ: number, intoWater: number) => {
    for (let i = 0; i < perQuay; i++) {
      const x = x0 + ((i + 0.5) / perQuay) * span + (rnd() - 0.5) * 6
      // skip boats that would sit in the bridge channel.
      if (bridge && Math.abs(x - bridge.x) < bridge.halfWidth + 4) continue
      const z = edgeZ + intoWater + (rnd() - 0.5) * 2
      const yaw = (rnd() - 0.5) * 0.5 // mostly broadside, a little scatter
      const species: 0 | 1 = rnd() < 0.55 ? 0 : 1
      placements.push({ x, z, yaw, species, hull: Math.floor(rnd() * hullCols.length) })
    }
  }
  // near quay: boats just OUTBOARD of the near water edge (+Z into the river).
  lineQuay(opts.waterZ, 3.2)
  // far quay: boats just INBOARD of the far water edge (−Z into the river).
  lineQuay(opts.farBankZ, -3.2)

  /* ---- build one master per (species × hull colour) actually used, then thin-
   * instance each. Keeps it to ≤ 2×3 masters; most builds use a few. -------- */
  const masters = new Map<string, Mesh>()
  const masterFor = (species: 0 | 1, hull: number): Mesh => {
    const key = `${species}:${hull}`
    let m = masters.get(key)
    if (!m) {
      m = species === 0 ? buildSmack(hullMats[hull]) : buildSloop(hullMats[hull])
      m.setEnabled(false)
      masters.set(key, m)
    }
    return m
  }
  // group placements by master key.
  const byKey = new Map<string, Placement[]>()
  for (const p of placements) {
    const key = `${p.species}:${p.hull}`
    masterFor(p.species, p.hull)
    let arr = byKey.get(key)
    if (!arr) byKey.set(key, (arr = []))
    arr.push(p)
  }

  const instMeshes: Mesh[] = []
  // remember the moored bob phase per instanced mesh (one phase set per mesh).
  // `out` is pre-allocated ONCE per bobber so the per-frame bob never allocates.
  const bobbers: Array<{ mesh: Mesh; base: Float32Array; out: Float32Array; phase: Float32Array }> = []
  for (const [key, ps] of byKey) {
    const master = masters.get(key)!
    const clone = master.clone(`${tag}-${key.replace(":", "-")}-inst`, null) as Mesh
    clone.makeGeometryUnique()
    clone.setEnabled(true) // the master is a disabled template; the clone draws
    clone.parent = root
    clone.isPickable = false
    clone.alwaysSelectAsActiveMesh = true
    clone.doNotSyncBoundingInfo = true
    const buf = new Float32Array(ps.length * 16)
    const phase = new Float32Array(ps.length)
    ps.forEach((p, i) => {
      Matrix.Compose(
        new Vector3(1, 1, 1),
        Quaternion.RotationAxis(Vector3.Up(), p.yaw),
        new Vector3(p.x, 0, p.z),
      ).copyToArray(buf, i * 16)
      phase[i] = rnd() * Math.PI * 2
    })
    clone.thinInstanceSetBuffer("matrix", buf, 16, !reduce) // staticBuffer only if frozen
    clone.thinInstanceRefreshBoundingInfo(false)
    if (reduce) clone.freezeWorldMatrix()
    instMeshes.push(clone)
    if (!reduce) bobbers.push({ mesh: clone, base: buf.slice(), out: buf.slice(), phase })
  }

  /* ---------------------------- moored bob ---------------------------- */
  let t = 0
  const update = (dt: number) => {
    if (reduce || !bobbers.length) return
    t += dt
    for (const b of bobbers) {
      const buf = b.base
      const out = b.out
      const count = buf.length / 16
      for (let i = 0; i < count; i++) {
        const ph = b.phase[i]
        const lift = Math.sin(t * 0.9 + ph) * 0.06 // gentle heave
        const roll = Math.sin(t * 0.7 + ph) * 0.025 // gentle roll
        // rebuild the instance matrix: base translation + small Y lift, base yaw +
        // small roll about Z. We only have the composed base; recompose from it by
        // reading its translation + a yaw we re-derive from base columns.
        const tx = buf[i * 16 + 12]
        const ty = buf[i * 16 + 13]
        const tz = buf[i * 16 + 14]
        // yaw from base matrix (atan2 of forward x/z basis).
        const yaw = Math.atan2(buf[i * 16 + 8], buf[i * 16 + 10])
        const q = Quaternion.RotationYawPitchRoll(yaw, 0, roll)
        Matrix.Compose(new Vector3(1, 1, 1), q, new Vector3(tx, ty + lift, tz)).copyToArray(out, i * 16)
      }
      b.mesh.thinInstanceSetBuffer("matrix", out, 16, false)
    }
  }

  return {
    root,
    update,
    dispose: () => {
      for (const m of instMeshes) m.dispose()
      for (const m of masters.values()) m.dispose()
      for (const m of allMats) m.dispose()
      root.dispose()
    },
  }
}
