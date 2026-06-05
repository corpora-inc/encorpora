import type { Scene as BabylonScene } from "@babylonjs/core/scene"
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder"
import { Mesh } from "@babylonjs/core/Meshes/mesh"
import { TransformNode } from "@babylonjs/core/Meshes/transformNode"
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial"
import { Matrix, Quaternion, Vector3 } from "@babylonjs/core/Maths/math"
import "@babylonjs/core/Meshes/thinInstanceMesh"
import { resolvePropPalette, buildTree, propMat, type PropPalette } from "./props3d"

/**
 * specialPlaces.ts — CURATED premium dressing for the named landmarks (env-art,
 * the #31 "special places: stunning, not Hello-World" half).
 *
 * The city already SCATTERS generic street furniture per block (generateCity's
 * `dressBlock` → thin-instanced props). That gives a lived-in streetscape, but
 * the HERO places — the civic plaza around the fountain, the market square —
 * read as bare flagstone with a few random props. This adds a small amount of
 * DELIBERATE, hand-placed detail at specific anchors so those places feel
 * composed, not scattered:
 *
 *   • PLAZA — a formal RING of raised stone flower-beds (full of blooms) +
 *     ornamental trees encircling the fountain, leaving the centre open to walk.
 *   • MARKET — festive BUNTING garlands (triangular pennants on poles) strung
 *     around the square so it reads as a lively marketplace.
 *
 * It reads the anchor world positions the caller passes (from `city.getAnchor`)
 * and is fully ADDITIVE + bounded (its own create + dispose; no `update` — it is
 * static): each species is ONE merged master, thin-instanced across its ring/run
 * and FROZEN. A handful of draw calls total. It does NOT touch the streaming
 * spine, collision, or the generic scatter. Honours reduced-motion trivially (no
 * animation). Skips any place whose anchor is absent (graceful on any layout).
 */

export interface SpecialPlaces {
  root: TransformNode
  dispose: () => void
}

export interface PlaceAnchor {
  x: number
  z: number
}

export interface SpecialPlacesOptions {
  /** the civic plaza centre (usually the `fountain` anchor at 0,0). */
  plaza?: PlaceAnchor
  /** the market square centre (the `market` anchor). */
  market?: PlaceAnchor
  /** the transit-station forecourt (the `station` anchor) — gets a banner ARCH
   *  threshold + flanking planters. `facing` (radians) orients the arch across the
   *  approach (the avenue runs along `facing`). */
  station?: PlaceAnchor & { facing?: number }
  /**
   * The near riverwalk PROMENADE — a line of formal planters strolling along it.
   * `edgeZ` is the near water edge (layout.water.waterZ); planters sit a touch
   * shoreward. `bounds` spans the waterfront width; `gap` keeps the bridge clear.
   */
  promenade?: {
    edgeZ: number
    bounds: { minX: number; maxX: number }
    gap?: { x: number; halfWidth: number }
  }
  palette?: Record<string, string>
  /** clear radius the plaza ring must stay OUTSIDE (the fountain basin). default 4. */
  fountainRadius?: number
  /**
   * A HERO clock tower — the town's memorable landmark on every sightline. Placed
   * at this world position (usually just off the plaza). It rises well above the
   * rooflines so it reads as a singular silhouette wherever you stand. Omit to skip.
   */
  clockTower?: PlaceAnchor
}

let spuid = 0

export function buildSpecialPlaces(scene: BabylonScene, opts: SpecialPlacesOptions): SpecialPlaces {
  const tag = `wp-special-${spuid++}`
  const root = new TransformNode(`${tag}-root`, scene)
  const pal: PropPalette = resolvePropPalette(opts.palette)

  const disposables: Array<{ dispose: () => void }> = []
  const instMeshes: Mesh[] = []

  /** group coloured parts by material, merge each group, then merge the groups into
   *  ONE multimaterial master mesh (one submesh per colour). Materials are tracked
   *  for disposal. The shared body of every species builder here. */
  const mergeByMat = (parts: Array<{ m: Mesh; mat: StandardMaterial }>, name: string): Mesh => {
    const byMat = new Map<StandardMaterial, Mesh[]>()
    for (const p of parts) {
      let arr = byMat.get(p.mat)
      if (!arr) byMat.set(p.mat, (arr = []))
      arr.push(p.m)
    }
    const groupMeshes: Mesh[] = []
    for (const [mat, ms] of byMat) {
      const merged = ms.length === 1 ? ms[0] : Mesh.MergeMeshes(ms, true, true, undefined, false, false)!
      merged.material = mat
      groupMeshes.push(merged)
      disposables.push(mat)
    }
    const final = groupMeshes.length === 1 ? groupMeshes[0] : Mesh.MergeMeshes(groupMeshes, true, true, undefined, false, true)!
    final.name = name
    return final
  }

  /** clone a master → unique geometry → thin-instance across placements → freeze.
   *  (The master is built disabled as a template; the live clone draws — the
   *  disabled-clone trap.) */
  const instanceSet = (
    master: Mesh,
    placements: Array<{ x: number; z: number; yaw: number; scale: number }>,
  ): void => {
    master.setEnabled(false)
    disposables.push(master)
    if (!placements.length) return
    const clone = master.clone(`${master.name}-inst`, null) as Mesh
    clone.makeGeometryUnique()
    clone.setEnabled(true)
    clone.parent = root
    clone.isPickable = false
    clone.alwaysSelectAsActiveMesh = true
    clone.doNotSyncBoundingInfo = true
    const buf = new Float32Array(placements.length * 16)
    placements.forEach((p, i) => {
      Matrix.Compose(
        new Vector3(p.scale, p.scale, p.scale),
        Quaternion.RotationAxis(Vector3.Up(), p.yaw),
        new Vector3(p.x, 0, p.z),
      ).copyToArray(buf, i * 16)
    })
    clone.thinInstanceSetBuffer("matrix", buf, 16, true)
    clone.thinInstanceRefreshBoundingInfo(false)
    clone.freezeWorldMatrix()
    instMeshes.push(clone)
  }

  /* ---- a raised round STONE FLOWER-BED brimming with blooms: a low stone drum
   * + a darker rim + soil + a dome of little bloom spheres in 3 colours. Reads as
   * a formal civic planting from any angle. One merged mesh. ----------------- */
  const buildFlowerBed = (): Mesh => {
    const stone = propMat(scene, pal.stone, { emissive: 0.3 })
    const stoneDk = propMat(scene, { r: pal.stone.r * 0.8, g: pal.stone.g * 0.8, b: pal.stone.b * 0.8 }, { emissive: 0.26 })
    const soil = propMat(scene, pal.trunkDk, { emissive: 0.2 })
    const leaf = propMat(scene, pal.leafDk, { emissive: 0.3 })
    const blooms = pal.bloomCols.map((c) => propMat(scene, c, { emissive: 0.42 }))
    const parts: Array<{ m: Mesh; mat: StandardMaterial }> = []
    const drum = MeshBuilder.CreateCylinder(`${tag}-fb`, { diameter: 2.0, height: 0.5, tessellation: 16 }, scene)
    drum.position.y = 0.25
    parts.push({ m: drum, mat: stone })
    const rim = MeshBuilder.CreateCylinder(`${tag}-fbr`, { diameter: 2.16, height: 0.12, tessellation: 16 }, scene)
    rim.position.y = 0.5
    parts.push({ m: rim, mat: stoneDk })
    const dirt = MeshBuilder.CreateCylinder(`${tag}-fbs`, { diameter: 1.7, height: 0.1, tessellation: 16 }, scene)
    dirt.position.y = 0.52
    parts.push({ m: dirt, mat: soil })
    // a soft dome of greenery + blooms.
    let bi = 0
    for (let ring = 0; ring < 3; ring++) {
      const rr = 0.2 + ring * 0.32
      const cnt = 4 + ring * 3
      for (let i = 0; i < cnt; i++) {
        const a = (i / cnt) * Math.PI * 2 + ring * 0.4
        const x = Math.cos(a) * rr
        const z = Math.sin(a) * rr
        const y = 0.62 + (0.32 - ring * 0.08)
        const green = MeshBuilder.CreateSphere(`${tag}-fg`, { diameter: 0.2, segments: 5 }, scene)
        green.position.set(x, y - 0.05, z)
        parts.push({ m: green, mat: leaf })
        const bloom = MeshBuilder.CreateSphere(`${tag}-fl`, { diameter: 0.22, segments: 5 }, scene)
        bloom.position.set(x, y + 0.06, z)
        parts.push({ m: bloom, mat: blooms[bi % blooms.length] })
        bi++
      }
    }
    return mergeByMat(parts, `${tag}-flowerbed`)
  }

  /* ---- a BUNTING garland: two poles + a swag of triangular pennants strung
   * between them. The pennants alternate two festive colours. One merged mesh
   * (poles + cloth). Spans ~5u; placed in a ring/run around the market. ------ */
  const buildBunting = (): Mesh => {
    const wood = propMat(scene, pal.woodDk, { emissive: 0.24 })
    const cA = propMat(scene, pal.canvasA, { emissive: 0.4 })
    const cB = propMat(scene, pal.bloomCols[0], { emissive: 0.4 })
    const span = 5.0
    const poleH = 2.6
    const parts: Array<{ m: Mesh; mat: StandardMaterial }> = []
    for (const sx of [-1, 1]) {
      const pole = MeshBuilder.CreateCylinder(`${tag}-bp`, { diameter: 0.14, height: poleH, tessellation: 6 }, scene)
      pole.position.set(sx * span * 0.5, poleH / 2, 0)
      parts.push({ m: pole, mat: wood })
      const cap = MeshBuilder.CreateSphere(`${tag}-bc`, { diameter: 0.2, segments: 6 }, scene)
      cap.position.set(sx * span * 0.5, poleH + 0.05, 0)
      parts.push({ m: cap, mat: wood })
    }
    // pennants hang from a gentle catenary between the two pole tops.
    const N = 10
    for (let i = 0; i < N; i++) {
      const t = (i + 0.5) / N
      const x = (t - 0.5) * span
      // catenary sag: lowest in the middle.
      const sag = Math.sin(t * Math.PI) * 0.5
      const y = poleH - 0.15 - sag
      const tri = MeshBuilder.CreateCylinder(`${tag}-bt`, { diameter: 0.34, height: 0.42, tessellation: 3 }, scene)
      tri.rotation.x = Math.PI // point DOWN
      tri.position.set(x, y - 0.21, 0)
      parts.push({ m: tri, mat: i % 2 === 0 ? cA : cB })
    }
    return mergeByMat(parts, `${tag}-bunting`)
  }

  /* ---- a BANNER ARCH: two stone piers spanned by a beam, with a hanging cloth
   * valance + a centred crest banner + two flags — a ceremonial THRESHOLD over an
   * approach. Built around local origin spanning the X axis (the caller yaws it to
   * straddle the avenue). One merged mesh. ----------------------------------- */
  const buildArch = (): Mesh => {
    const stone = propMat(scene, pal.stone, { emissive: 0.3 })
    const stoneDk = propMat(scene, { r: pal.stone.r * 0.78, g: pal.stone.g * 0.78, b: pal.stone.b * 0.78 }, { emissive: 0.26 })
    const cloth = propMat(scene, pal.canvasA, { emissive: 0.4 })
    const clothDk = propMat(scene, pal.bloomCols[0], { emissive: 0.4 })
    const wood = propMat(scene, pal.woodDk, { emissive: 0.24 })
    const span = 7.0
    const pierH = 4.2
    const parts: Array<{ m: Mesh; mat: StandardMaterial }> = []
    for (const sx of [-1, 1]) {
      const base = MeshBuilder.CreateBox(`${tag}-ab`, { width: 0.9, height: 0.4, depth: 0.9 }, scene)
      base.position.set(sx * span * 0.5, 0.2, 0)
      parts.push({ m: base, mat: stoneDk })
      const pier = MeshBuilder.CreateBox(`${tag}-ap`, { width: 0.7, height: pierH, depth: 0.7 }, scene)
      pier.position.set(sx * span * 0.5, pierH / 2 + 0.4, 0)
      parts.push({ m: pier, mat: stone })
      const cap = MeshBuilder.CreateBox(`${tag}-ac`, { width: 0.92, height: 0.3, depth: 0.92 }, scene)
      cap.position.set(sx * span * 0.5, pierH + 0.55, 0)
      parts.push({ m: cap, mat: stoneDk })
      // a flag on each cap.
      const pole = MeshBuilder.CreateCylinder(`${tag}-afp`, { diameter: 0.08, height: 1.2, tessellation: 6 }, scene)
      pole.position.set(sx * span * 0.5, pierH + 1.3, 0)
      parts.push({ m: pole, mat: wood })
      const flag = MeshBuilder.CreateBox(`${tag}-aff`, { width: 0.6, height: 0.36, depth: 0.04 }, scene)
      flag.position.set(sx * span * 0.5 + sx * 0.33, pierH + 1.55, 0)
      parts.push({ m: flag, mat: sx > 0 ? cloth : clothDk })
    }
    // the lintel beam across the top.
    const beam = MeshBuilder.CreateBox(`${tag}-albeam`, { width: span + 0.4, height: 0.5, depth: 0.5 }, scene)
    beam.position.set(0, pierH + 0.45, 0)
    parts.push({ m: beam, mat: stoneDk })
    // a hanging cloth VALANCE under the beam (scalloped via alternating panels).
    const M = 7
    for (let i = 0; i < M; i++) {
      const x = (i / (M - 1) - 0.5) * (span - 0.6)
      const drop = MeshBuilder.CreateCylinder(`${tag}-alv`, { diameter: 0.7, height: 0.7, tessellation: 3 }, scene)
      drop.rotation.x = Math.PI // point down
      drop.position.set(x, pierH + 0.05, 0.12)
      parts.push({ m: drop, mat: i % 2 === 0 ? cloth : clothDk })
    }
    // a central CREST banner draping from the beam.
    const crest = MeshBuilder.CreateBox(`${tag}-alc`, { width: 1.1, height: 1.6, depth: 0.05 }, scene)
    crest.position.set(0, pierH - 0.5, 0.12)
    parts.push({ m: crest, mat: cloth })
    const emblem = MeshBuilder.CreateBox(`${tag}-ale`, { width: 0.36, height: 1.0, depth: 0.06 }, scene)
    emblem.position.set(0, pierH - 0.5, 0.13)
    parts.push({ m: emblem, mat: clothDk })
    return mergeByMat(parts, `${tag}-arch`)
  }

  /* ---- a tall formal URN PLANTER: a pedestal + a flared urn bowl + a mounded
   * planting of greenery + blooms. Reads as a promenade ornament. One merged. -- */
  const buildUrn = (): Mesh => {
    const stone = propMat(scene, pal.stone, { emissive: 0.3 })
    const stoneDk = propMat(scene, { r: pal.stone.r * 0.8, g: pal.stone.g * 0.8, b: pal.stone.b * 0.8 }, { emissive: 0.26 })
    const leaf = propMat(scene, pal.leafDk, { emissive: 0.3 })
    const blooms = pal.bloomCols.map((c) => propMat(scene, c, { emissive: 0.42 }))
    const parts: Array<{ m: Mesh; mat: StandardMaterial }> = []
    const foot = MeshBuilder.CreateBox(`${tag}-uf`, { width: 0.7, height: 0.2, depth: 0.7 }, scene)
    foot.position.y = 0.1
    parts.push({ m: foot, mat: stoneDk })
    const ped = MeshBuilder.CreateCylinder(`${tag}-up`, { diameterTop: 0.42, diameterBottom: 0.56, height: 0.9, tessellation: 10 }, scene)
    ped.position.y = 0.65
    parts.push({ m: ped, mat: stone })
    const bowl = MeshBuilder.CreateCylinder(`${tag}-ub`, { diameterTop: 1.0, diameterBottom: 0.44, height: 0.55, tessellation: 12 }, scene)
    bowl.position.y = 1.2
    parts.push({ m: bowl, mat: stone })
    const rim = MeshBuilder.CreateCylinder(`${tag}-ur`, { diameter: 1.08, height: 0.12, tessellation: 12 }, scene)
    rim.position.y = 1.46
    parts.push({ m: rim, mat: stoneDk })
    // a mound of greenery + blooms spilling over.
    let bi = 0
    for (let ring = 0; ring < 2; ring++) {
      const rr = 0.16 + ring * 0.28
      const cnt = 5 + ring * 4
      for (let i = 0; i < cnt; i++) {
        const a = (i / cnt) * Math.PI * 2 + ring
        const x = Math.cos(a) * rr
        const z = Math.sin(a) * rr
        const y = 1.6 - ring * 0.12
        const g = MeshBuilder.CreateSphere(`${tag}-ug`, { diameter: 0.22, segments: 5 }, scene)
        g.position.set(x, y - 0.04, z)
        parts.push({ m: g, mat: leaf })
        const bl = MeshBuilder.CreateSphere(`${tag}-ubl`, { diameter: 0.2, segments: 5 }, scene)
        bl.position.set(x, y + 0.07, z)
        parts.push({ m: bl, mat: blooms[bi % blooms.length] })
        bi++
      }
    }
    return mergeByMat(parts, `${tag}-urn`)
  }

  /* ---- a HERO CLOCK TOWER: a tall tapered stone shaft on a stepped base, a
   * darker belfry band with arched openings + a clock face on each side, a railed
   * gallery, then a steep pyramidal cap topped with a finial. ~18u tall — it clears
   * the 2–4-storey town so it's the landmark on every sightline. ONE merged mesh
   * (NOT instanced — there is exactly one). Built around local origin, feet at 0. */
  const buildClockTower = (): Mesh => {
    const stone = propMat(scene, pal.stone, { emissive: 0.3 })
    const stoneDk = propMat(scene, { r: pal.stone.r * 0.74, g: pal.stone.g * 0.74, b: pal.stone.b * 0.74 }, { emissive: 0.26 })
    const roof = propMat(scene, pal.terracotta, { emissive: 0.3 })
    const roofDk = propMat(scene, pal.terracottaDk, { emissive: 0.26 })
    const trim = propMat(scene, pal.iron, { emissive: 0.3 })
    const face = propMat(scene, { r: 0.96, g: 0.92, b: 0.82 }, { emissive: 0.5 }) // pale clock dial
    const gold = propMat(scene, pal.flame, { emissive: 0.7 })
    const parts: Array<{ m: Mesh; mat: StandardMaterial }> = []
    const W = 4.2 // shaft side
    // stepped base
    const base0 = MeshBuilder.CreateBox(`${tag}-ct0`, { width: W + 2.2, height: 0.7, depth: W + 2.2 }, scene)
    base0.position.y = 0.35
    parts.push({ m: base0, mat: stoneDk })
    const base1 = MeshBuilder.CreateBox(`${tag}-ct1`, { width: W + 1.0, height: 0.6, depth: W + 1.0 }, scene)
    base1.position.y = 1.0
    parts.push({ m: base1, mat: stone })
    // main shaft (slightly tapered via a top cornice), ~11u tall
    const shaftH = 11
    const shaft = MeshBuilder.CreateBox(`${tag}-cts`, { width: W, height: shaftH, depth: W }, scene)
    shaft.position.y = 1.3 + shaftH / 2
    parts.push({ m: shaft, mat: stone })
    // vertical quoin bands at the corners (darker) for a built-up stone read
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const q = MeshBuilder.CreateBox(`${tag}-ctq`, { width: 0.5, height: shaftH, depth: 0.5 }, scene)
      q.position.set(sx * (W / 2), 1.3 + shaftH / 2, sz * (W / 2))
      parts.push({ m: q, mat: stoneDk })
    }
    const topShaft = 1.3 + shaftH
    // cornice band
    const cornice = MeshBuilder.CreateBox(`${tag}-ctc`, { width: W + 0.6, height: 0.5, depth: W + 0.6 }, scene)
    cornice.position.y = topShaft + 0.25
    parts.push({ m: cornice, mat: stoneDk })
    // belfry: a slightly inset darker band with a CLOCK FACE on all four sides
    const belfryH = 2.6
    const belfryY = topShaft + 0.5 + belfryH / 2
    const belfry = MeshBuilder.CreateBox(`${tag}-ctb`, { width: W - 0.3, height: belfryH, depth: W - 0.3 }, scene)
    belfry.position.y = belfryY
    parts.push({ m: belfry, mat: stoneDk })
    // four clock faces (a pale disc + a darker ring + hands) on each wall
    for (let s = 0; s < 4; s++) {
      const a = (s / 4) * Math.PI * 2
      const nx = Math.sin(a)
      const nz = Math.cos(a)
      const r = (W - 0.3) / 2 + 0.06
      const ring = MeshBuilder.CreateCylinder(`${tag}-ctfr`, { diameter: 1.7, height: 0.12, tessellation: 16 }, scene)
      ring.rotation.x = Math.PI / 2
      ring.rotation.y = a
      ring.position.set(nx * r, belfryY, nz * r)
      parts.push({ m: ring, mat: stone })
      const dial = MeshBuilder.CreateCylinder(`${tag}-ctfd`, { diameter: 1.45, height: 0.14, tessellation: 16 }, scene)
      dial.rotation.x = Math.PI / 2
      dial.rotation.y = a
      dial.position.set(nx * (r + 0.02), belfryY, nz * (r + 0.02))
      parts.push({ m: dial, mat: face })
      // hour + minute hands: thin boxes lying flat on the dial. The dial plane has
      // a vertical UP axis (world Y) and a horizontal RIGHT axis (tangent = (nz,-nx)).
      // A hand of length `len` at clock-angle `ang` (0 = up) ends at up*cos + right*sin.
      const dz = r + 0.12 // a hair proud of the dial
      const hand = (len: number, ang: number, wide: number) => {
        const ex = Math.sin(ang) * len * 0.5 // along RIGHT
        const ey = Math.cos(ang) * len * 0.5 // along UP
        const h = MeshBuilder.CreateBox(`${tag}-cth`, { width: wide, height: len, depth: 0.06 }, scene)
        // rotate the height axis to point along (right*sin + up*cos) within the face
        h.rotation.z = -ang
        h.rotation.y = a
        h.bakeCurrentTransformIntoVertices()
        h.position.set(nx * dz + nz * ex, belfryY + ey, nz * dz - nx * ex)
        parts.push({ m: h, mat: trim })
      }
      hand(0.62, Math.PI * 0.33, 0.08) // minute hand
      hand(0.42, Math.PI * 1.15, 0.1) // hour hand
    }
    // railed gallery band above the belfry
    const gallY = belfryY + belfryH / 2 + 0.2
    const gall = MeshBuilder.CreateBox(`${tag}-ctg`, { width: W + 0.5, height: 0.4, depth: W + 0.5 }, scene)
    gall.position.y = gallY
    parts.push({ m: gall, mat: stone })
    // steep pyramidal CAP (4-sided cone) + finial
    const capBase = gallY + 0.2
    const capH = 3.4
    const cap = MeshBuilder.CreateCylinder(`${tag}-ctcap`, { diameterBottom: (W + 0.5) * Math.SQRT2 * 0.72, diameterTop: 0, height: capH, tessellation: 4 }, scene)
    cap.rotation.y = Math.PI / 4
    cap.position.y = capBase + capH / 2
    parts.push({ m: cap, mat: roof })
    // a darker ridge collar at the cap base
    const collar = MeshBuilder.CreateCylinder(`${tag}-ctcol`, { diameter: (W + 0.5) * 1.02, height: 0.3, tessellation: 4 }, scene)
    collar.rotation.y = Math.PI / 4
    collar.position.y = capBase + 0.15
    parts.push({ m: collar, mat: roofDk })
    // finial: a small ball + spike
    const ball = MeshBuilder.CreateSphere(`${tag}-ctfb`, { diameter: 0.5, segments: 8 }, scene)
    ball.position.y = capBase + capH + 0.2
    parts.push({ m: ball, mat: gold })
    const spike = MeshBuilder.CreateCylinder(`${tag}-ctsp`, { diameterBottom: 0.12, diameterTop: 0, height: 0.9, tessellation: 6 }, scene)
    spike.position.y = capBase + capH + 0.75
    parts.push({ m: spike, mat: gold })
    return mergeByMat(parts, `${tag}-clocktower`)
  }

  /* ====================== HERO CLOCK TOWER ====================== */
  if (opts.clockTower) {
    const tower = buildClockTower()
    tower.parent = root
    tower.position.set(opts.clockTower.x, 0, opts.clockTower.z)
    tower.isPickable = false
    tower.alwaysSelectAsActiveMesh = true
    tower.freezeWorldMatrix()
    instMeshes.push(tower)
  }

  /* ============================ PLAZA RING ============================ */
  if (opts.plaza) {
    const cx = opts.plaza.x
    const cz = opts.plaza.z
    const ringR = (opts.fountainRadius ?? 4) + 6.5 // outside the fountain basin
    // 8 flower-beds + 8 ornamental trees, interleaved on the ring (trees on the
    // diagonals, beds on the cardinals), so the plaza reads as a formal garden
    // court framing the fountain without blocking the cross paths.
    const bedPlacements: Array<{ x: number; z: number; yaw: number; scale: number }> = []
    const treePlacements: Array<{ x: number; z: number; yaw: number; scale: number }> = []
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2
      const x = cx + Math.cos(a) * ringR
      const z = cz + Math.sin(a) * ringR
      if (i % 2 === 0) bedPlacements.push({ x, z, yaw: a, scale: 1 })
      else treePlacements.push({ x, z, yaw: a * 1.7, scale: 0.85 })
    }
    instanceSet(buildFlowerBed(), bedPlacements)
    const tree = buildTree(scene, pal)
    tree.name = `${tag}-tree`
    instanceSet(tree, treePlacements)
  }

  /* ============================ MARKET BUNTING ============================ */
  if (opts.market) {
    const cx = opts.market.x
    const cz = opts.market.z
    const buntPlacements: Array<{ x: number; z: number; yaw: number; scale: number }> = []
    // a loose ring of bunting garlands around the market square, tangent to the
    // ring (yaw so each garland faces along the circle).
    const R = 12
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3
      const x = cx + Math.cos(a) * R
      const z = cz + Math.sin(a) * R
      buntPlacements.push({ x, z, yaw: a + Math.PI / 2, scale: 1 })
    }
    instanceSet(buildBunting(), buntPlacements)
  }

  /* ====================== STATION FORECOURT ARCH ====================== */
  if (opts.station) {
    const sx = opts.station.x
    const sz = opts.station.z
    const facing = opts.station.facing ?? 0
    // ONE ceremonial banner arch straddling the station approach, set a few metres
    // out into the forecourt from the anchor, plus a pair of urn planters flanking
    // the threshold. The arch spans across `facing` (yaw = facing) so you pass
    // THROUGH it; it sits `out` toward the approach (−forward of the anchor facing).
    const out = 9
    const ax = sx - Math.sin(facing) * out
    const az = sz - Math.cos(facing) * out
    instanceSet(buildArch(), [{ x: ax, z: az, yaw: facing, scale: 1 }])
    // urns just inside the arch piers (offset laterally along the arch span).
    const lat = 4.4
    const urnPlace = [
      { x: ax + Math.cos(facing) * lat, z: az - Math.sin(facing) * lat, yaw: 0, scale: 1 },
      { x: ax - Math.cos(facing) * lat, z: az + Math.sin(facing) * lat, yaw: 0, scale: 1 },
    ]
    instanceSet(buildUrn(), urnPlace)
  }

  /* ====================== RIVERWALK PROMENADE URNS ====================== */
  if (opts.promenade) {
    // a stroll of formal urn planters along the near promenade, a touch shoreward
    // of the rail, evenly spaced and skipping the bridge gap. They punctuate the
    // long quay between the balustrade lamp posts.
    const pz = opts.promenade.edgeZ - 2.6 // shoreward of the rail (rail ≈ edgeZ-0.7)
    const x0 = opts.promenade.bounds.minX + 12
    const x1 = opts.promenade.bounds.maxX - 12
    const gap = opts.promenade.gap
    const SPACING = 11
    const n = Math.max(1, Math.floor((x1 - x0) / SPACING))
    const urnPlace: Array<{ x: number; z: number; yaw: number; scale: number }> = []
    for (let i = 0; i <= n; i++) {
      const x = x0 + (i / n) * (x1 - x0)
      if (gap && Math.abs(x - gap.x) < gap.halfWidth + 3) continue // keep the deck clear
      urnPlace.push({ x, z: pz, yaw: 0, scale: 1.05 })
    }
    instanceSet(buildUrn(), urnPlace)
  }

  return {
    root,
    dispose: () => {
      for (const m of instMeshes) m.dispose()
      for (const d of disposables) d.dispose()
      root.dispose()
    },
  }
}
