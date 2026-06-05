import type { Scene as BabylonScene } from "@babylonjs/core/scene"
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder"
import { Mesh } from "@babylonjs/core/Meshes/mesh"
import { TransformNode } from "@babylonjs/core/Meshes/transformNode"
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial"
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture"
import { Color3, Matrix, Quaternion, Vector3 } from "@babylonjs/core/Maths/math"
import "@babylonjs/core/Meshes/thinInstanceMesh"

/**
 * riverwalk.ts — the premium WATERFRONT DRESSING for Corpan City (env-art, the
 * task #31 "riverwalk + special places: stunning, not Hello-World" visual half).
 *
 * WHAT THIS IS. An ADDITIVE, bounded detail layer (its own create + per-frame
 * `update` + `dispose`, exactly like fountain.ts / harborWater.ts) that dresses
 * the +Z waterfront edge so the riverwalk reads as a hand-crafted Octopath quay
 * rather than a flat blue rectangle butting a flat ground. It does NOT touch the
 * city streaming spine, the engine/camera, or the bridge STRUCTURE (world-fix
 * owns the bridge, #29) — it lays decoration ALONG the existing water edge:
 *
 *   • a continuous STONE BALUSTRADE (capping rail + bottom rail + a run of turned
 *     balusters + heavier piers at intervals) along the quay, with a clean GAP
 *     where the bridge crosses so the deck is never walled off;
 *   • a richer WATER SHEET layered a hair above the baked water surface — a
 *     painted depth gradient (dark out, luminous near the bank) with a soft
 *     SHORELINE FOAM band, gently breathing under light (still under reduced
 *     motion). This is the "premium water vs. flat blue" half;
 *   • MOORING BOLLARDS + waterfront lamp piers spaced along the walk for life.
 *
 * PERFORMANCE (the whole game is perf). The waterfront can be 200u+ long, so
 * everything repeated is ONE merged master mesh drawn via THIN INSTANCES (one
 * draw call + one shared frozen material for the entire run of that part):
 *   • balusters: one turned-cylinder master → N thin instances, frozen;
 *   • piers + bollards: one master each → thin instances, frozen;
 *   • the two rails: ONE merged long box each (capping + base), frozen;
 *   • the water sheet: ONE quad + ONE painted material; the only per-frame cost
 *     is a single emissive/UV-offset lerp, skipped entirely under reduced motion.
 * Nothing here streams or rebuilds; it is built once and frozen. Bounded.
 *
 * EDGE DATA. The caller passes the water EDGE (a line z = `edgeZ` along +Z, the
 * walkable side at z < edgeZ), the city `bounds`, and the bridge `gap` (centre x
 * + half-width) so the balustrade opens for the deck. These are read in game.ts
 * from the `bridge_n`/`harbor` anchors + `layout.bounds` (graceful fallback if
 * an anchor is absent — the layer just isn't built). If the `places` teammate
 * later defines a real bank polyline, this same module decorates that instead by
 * swapping how `edgeZ`/`gap` are derived — the dressing geometry is unchanged.
 */

export interface Riverwalk {
  /** the root holding every dressing mesh — already world-positioned. */
  root: TransformNode
  /** per-frame water shimmer + foam drift (no-op under reduced motion). */
  update: (dt: number) => void
  dispose: () => void
}

export interface RiverwalkOptions {
  /** world Z of the NEAR water edge; the near quay (walkable) is at z < edgeZ. */
  edgeZ: number
  /**
   * world Z of the FAR water edge (CityWater.farBankZ). When set, the river is a
   * BAND `[edgeZ, farEdgeZ]`: the water sheet is capped at `farEdgeZ` (it does NOT
   * run to the world edge, which would paint over the far bank + sea wall), and
   * the foam laps BOTH shorelines. Absent → legacy water-to-edge behaviour.
   */
  farEdgeZ?: number
  /** full-city world bounds (the balustrade spans the waterfront width). */
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number }
  /** bridge opening so the balustrade leaves the deck clear (centre x + half-width). */
  gap?: { x: number; halfWidth: number }
  palette?: Record<string, string>
  reducedMotion?: boolean
  /** cap the baluster count on lean (phone) tiers; default unlimited. */
  maxBalusters?: number
}

/* ------------------------------------------------------------- palette --- */

const hexC3 = (hex: string | undefined, fallback: string): Color3 =>
  Color3.FromHexString(hex ?? fallback)
const shade = (c: Color3, t: number): Color3 =>
  t >= 0
    ? new Color3(c.r + (1 - c.r) * t, c.g + (1 - c.g) * t, c.b + (1 - c.b) * t)
    : new Color3(c.r * (1 + t), c.g * (1 + t), c.b * (1 + t))

let ruid = 0

export function buildRiverwalk(scene: BabylonScene, opts: RiverwalkOptions): Riverwalk {
  const tag = `wp-riverwalk-${ruid++}`
  const reduce = !!opts.reducedMotion

  // Warm stone for the balustrade (agrees with the buildings/fountain key); iron
  // for the lamp piers + bollard caps; water leans on trim/sky like the fountain.
  const stoneC = hexC3(opts.palette?.stone, "#d8c8a6")
  const stone = stoneC
  const stoneDk = shade(stoneC, -0.2)
  const stoneLt = shade(stoneC, 0.12)
  const ironC = hexC3(opts.palette?.trim, "#3a342c")
  const iron = shade(ironC, -0.45)
  const waterC = hexC3(opts.palette?.trim, "#5aa0a8")

  const root = new TransformNode(`${tag}-root`, scene)

  const mat = (name: string, c: Color3, o: { emissive?: number; alpha?: number } = {}) => {
    const m = new StandardMaterial(`${tag}-${name}`, scene)
    m.diffuseColor = c
    m.emissiveColor = c.scale(o.emissive ?? 0.3) // emissive lift = shape, not gloom
    m.specularColor = new Color3(0, 0, 0)
    if (o.alpha !== undefined) m.alpha = o.alpha
    return m
  }
  // NOTE on emissive: the sun/hemi rig is bright; a 0.34+ emissive lift on a pale
  // stone blows out to flat WHITE (the trough §9 lesson). Keep stone lifts LOW so
  // the balustrade reads as carved stone with real shadow between the balusters,
  // not an overexposed bar.
  const mStone = mat("stone", stone, { emissive: 0.18 })
  const mStoneDk = mat("stoneDk", stoneDk, { emissive: 0.16 })
  const mStoneLt = mat("stoneLt", stoneLt, { emissive: 0.2 })
  const mIron = mat("iron", iron, { emissive: 0.2 })
  const mLamp = mat("lamp", hexC3(undefined, "#ffd98a"), { emissive: 0.85 })
  for (const m of [mStone, mStoneDk, mStoneLt, mIron]) m.freeze()

  const disposables: Array<{ dispose: () => void }> = [
    mStone, mStoneDk, mStoneLt, mIron, mLamp,
  ]

  /* ---- the run: the waterfront span, split by the bridge gap into segments. */
  // The balustrade sits a touch SHOREWARD of the water edge (railings cap the
  // quay, they don't float over the water) and faces the water.
  const railZ = opts.edgeZ - 0.7
  const x0 = opts.bounds.minX + 6
  const x1 = opts.bounds.maxX - 6
  const gap = opts.gap
  // segments of [xa, xb] the rail occupies (everything except the bridge gap).
  const segments: Array<[number, number]> = []
  if (gap && gap.x - gap.halfWidth > x0 && gap.x + gap.halfWidth < x1) {
    segments.push([x0, gap.x - gap.halfWidth])
    segments.push([gap.x + gap.halfWidth, x1])
  } else {
    segments.push([x0, x1])
  }

  /* ---- baluster master: a chunky turned vase-post (foot → bulged belly → neck
   * → cap), ~1.25u tall and fat enough to READ as carved stone from a distance.
   * One merged mesh, thin-instanced for the whole run. Low-poly (8 tess). ----- */
  const BAL_H = 1.25 // overall baluster height (under the capping rail)
  const buildBaluster = (): Mesh => {
    const parts: Mesh[] = []
    const c = (d: number, h: number, y: number, dTop?: number, t = 8) => {
      const m = MeshBuilder.CreateCylinder(
        `${tag}-bal`,
        dTop === undefined
          ? { diameter: d, height: h, tessellation: t }
          : { diameterBottom: d, diameterTop: dTop, height: h, tessellation: t },
        scene,
      )
      m.position.y = y
      parts.push(m)
      return m
    }
    // a classic vase baluster, fattened so it isn't a hair-thin sliver.
    c(0.5, 0.16, 0.08) // square-ish foot block
    c(0.36, 0.22, 0.3, 0.6) // flare up into the belly
    c(0.62, 0.46, 0.66, 0.28) // big belly tapering up
    c(0.28, 0.22, 1.0, 0.38) // neck
    c(0.54, 0.12, 1.19) // top block under the cap
    const merged = Mesh.MergeMeshes(parts, true, true, undefined, false, false)!
    merged.name = `${tag}-baluster`
    return merged
  }

  /* ---- pier master: a heavier square plinth + a ball finial. Placed at the
   * ends + at intervals so the rail reads as bays between piers. ------------ */
  const buildPier = (): Mesh => {
    const parts: Mesh[] = []
    const box = (w: number, h: number, d: number, y: number) => {
      const m = MeshBuilder.CreateBox(`${tag}-pierp`, { width: w, height: h, depth: d }, scene)
      m.position.y = y
      parts.push(m)
      return m
    }
    box(0.62, 0.18, 0.62, 0.09) // base
    box(0.5, 1.18, 0.5, 0.77) // shaft
    box(0.64, 0.16, 0.64, 1.44) // cap
    const fin = MeshBuilder.CreateSphere(`${tag}-pierf`, { diameter: 0.42, segments: 8 }, scene)
    fin.position.y = 1.72
    parts.push(fin)
    const merged = Mesh.MergeMeshes(parts, true, true, undefined, false, false)!
    merged.name = `${tag}-pier`
    return merged
  }

  /* ---- bollard master: a mooring post (iron-capped stone stub) by the water. */
  const buildBollard = (): Mesh => {
    const stub = MeshBuilder.CreateCylinder(`${tag}-bolb`, { diameterBottom: 0.46, diameterTop: 0.38, height: 0.74, tessellation: 10 }, scene)
    stub.position.y = 0.37
    stub.material = mStoneDk
    const cap = MeshBuilder.CreateSphere(`${tag}-bolc`, { diameter: 0.46, segments: 8 }, scene)
    cap.scaling.y = 0.6
    cap.position.y = 0.78
    cap.material = mIron
    // two-material → keep as a tiny parented pair (still thin-instanced as a set
    // by instancing the merged geometry; merge keeps both colours as submeshes).
    const merged = Mesh.MergeMeshes([stub, cap], true, true, undefined, false, true)!
    merged.name = `${tag}-bollard`
    return merged
  }

  /* ---- waterfront lamp post: a classic harbor lamp — stone plinth + a tapered
   * iron column rising to a six-sided LANTERN (glass body + a peaked iron roof +
   * a finial) with the glowing orb inside it. The lantern crowns the post (not a
   * side arm — that read clunky); the glass + orb are their own emissive submesh
   * so it reads as a warm lit lantern by day or dusk. ---------------------- */
  const mGlass = mat("glass", hexC3(undefined, "#ffe6a8"), { emissive: 0.7, alpha: 0.6 })
  disposables.push(mGlass)
  const buildLampPier = (): Mesh => {
    const iron: Mesh[] = []
    const c = (d: number, h: number, y: number, dTop?: number, t = 8) => {
      const m = MeshBuilder.CreateCylinder(
        `${tag}-lpp`,
        dTop === undefined ? { diameter: d, height: h, tessellation: t } : { diameterBottom: d, diameterTop: dTop, height: h, tessellation: t },
        scene,
      )
      m.position.y = y
      iron.push(m)
      return m
    }
    c(0.62, 0.22, 0.11, 0.5, 8) // stone-ish plinth (iron-dark base)
    c(0.26, 2.7, 1.45, 0.18, 8) // tapered column
    c(0.42, 0.14, 2.85, 0.3, 8) // collar / lantern base
    // lantern roof (peaked hex cone) + finial.
    c(0.5, 0.34, 3.42, 0.0, 6) // roof cone
    const fin = MeshBuilder.CreateSphere(`${tag}-lpfin`, { diameter: 0.16, segments: 6 }, scene)
    fin.position.y = 3.66
    iron.push(fin)
    const ironMesh = Mesh.MergeMeshes(iron, true, true, undefined, false, false)!
    ironMesh.material = mIron
    // glass lantern body (hex prism) — translucent, glowing.
    const glass = MeshBuilder.CreateCylinder(`${tag}-lpglass`, { diameter: 0.34, height: 0.5, tessellation: 6 }, scene)
    glass.position.y = 3.16
    glass.material = mGlass
    // the hot orb inside the glass.
    const orb = MeshBuilder.CreateSphere(`${tag}-lporb`, { diameter: 0.2, segments: 8 }, scene)
    orb.position.y = 3.16
    orb.material = mLamp
    const merged = Mesh.MergeMeshes([ironMesh, glass, orb], true, true, undefined, false, true)!
    merged.name = `${tag}-lamppier`
    return merged
  }

  /* ---- instance one master across placements as ONE thin-instanced clone. --- */
  const instanceSet = (master: Mesh, placements: Array<{ x: number; z: number; yaw: number; scale: number }>): Mesh | null => {
    master.setEnabled(false)
    if (!placements.length) return null
    const clone = master.clone(`${master.name}-inst`, null) as Mesh
    clone.makeGeometryUnique() // world-fix §2: own geometry so thin buffers don't clobber
    clone.setEnabled(true) // the master was disabled as a template; the live clone draws
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
    return clone
  }

  /* ---- lay the run: rails (merged long boxes per segment) + baluster/pier/
   * bollard/lamp placements along it. --------------------------------------- */
  const BAL_SPACING = 0.92 // centre-to-centre of balusters (fatter posts, wider gap)
  const PIER_SPACING = 7.0 // a pier every ~7u (a "bay")
  const RAIL_TOP_Y = BAL_H + 0.1 // capping rail (h 0.2) sits ON TOP of the balusters
  const balPlacements: Array<{ x: number; z: number; yaw: number; scale: number }> = []
  const pierPlacements: Array<{ x: number; z: number; yaw: number; scale: number }> = []
  const bollardPlacements: Array<{ x: number; z: number; yaw: number; scale: number }> = []
  const lampPlacements: Array<{ x: number; z: number; yaw: number; scale: number }> = []
  const railParts: Mesh[] = []
  const baseParts: Mesh[] = []

  const maxBal = opts.maxBalusters ?? Infinity

  for (const [xa, xb] of segments) {
    const len = xb - xa
    if (len < 1) continue
    const cx = (xa + xb) / 2
    // capping rail — one long box ON TOP of the baluster row. Its depth (0.46) is
    // a touch under the baluster belly (0.52) so the bellies bulge past it and the
    // posts read as 3D, never a flush flat curb. A slim shadow-line lip beneath.
    const cap = MeshBuilder.CreateBox(`${tag}-cap`, { width: len, height: 0.2, depth: 0.34 }, scene)
    cap.position.set(cx, RAIL_TOP_Y, railZ)
    railParts.push(cap)
    const capLip = MeshBuilder.CreateBox(`${tag}-caplip`, { width: len, height: 0.08, depth: 0.5 }, scene)
    capLip.position.set(cx, RAIL_TOP_Y - 0.14, railZ)
    railParts.push(capLip)
    // bottom kerb the balusters stand on (slimmer depth than the feet → feet sit
    // proud of it). Raised so the baluster feet (y 0..) plant on its top.
    const base = MeshBuilder.CreateBox(`${tag}-base`, { width: len, height: 0.28, depth: 0.56 }, scene)
    base.position.set(cx, -0.14, railZ)
    baseParts.push(base)

    // balusters across the bay (between the kerb and the cap).
    const n = Math.max(2, Math.floor(len / BAL_SPACING))
    for (let i = 0; i <= n; i++) {
      if (balPlacements.length >= maxBal) break
      const x = xa + (i / n) * len
      balPlacements.push({ x, z: railZ, yaw: 0, scale: 1 })
    }
    // piers at the segment ends + spaced bays in between.
    const np = Math.max(1, Math.round(len / PIER_SPACING))
    for (let i = 0; i <= np; i++) {
      const x = xa + (i / np) * len
      pierPlacements.push({ x, z: railZ, yaw: 0, scale: 1 })
    }
    // mooring bollards on the PROMENADE side of the rail (you walk past them),
    // between piers — staggered shoreward so they never hide behind a baluster.
    const nb = Math.max(1, Math.round(len / (PIER_SPACING * 1.6)))
    for (let i = 0; i < nb; i++) {
      const x = xa + ((i + 0.5) / nb) * len
      bollardPlacements.push({ x, z: railZ - 1.4, yaw: 0, scale: 1 })
    }
    // a lamp pier every ~2 bays, set just shoreward of the rail.
    const nl = Math.max(1, Math.round(len / (PIER_SPACING * 2)))
    for (let i = 0; i <= nl; i++) {
      const x = xa + (i / nl) * len
      lampPlacements.push({ x, z: railZ - 0.5, yaw: 0, scale: 1 })
    }
  }

  // merge + place the two rails (one mesh each, frozen).
  const railMesh = railParts.length ? Mesh.MergeMeshes(railParts, true, true, undefined, false, false) : null
  if (railMesh) {
    railMesh.name = `${tag}-railcap`
    railMesh.material = mStoneLt
    railMesh.parent = root
    railMesh.isPickable = false
    railMesh.alwaysSelectAsActiveMesh = true
    railMesh.doNotSyncBoundingInfo = true
    railMesh.freezeWorldMatrix()
  }
  const baseMesh = baseParts.length ? Mesh.MergeMeshes(baseParts, true, true, undefined, false, false) : null
  if (baseMesh) {
    baseMesh.name = `${tag}-railbase`
    baseMesh.material = mStone
    baseMesh.parent = root
    baseMesh.isPickable = false
    baseMesh.alwaysSelectAsActiveMesh = true
    baseMesh.doNotSyncBoundingInfo = true
    baseMesh.freezeWorldMatrix()
  }

  // instance the repeated parts (each its own master → thin instances → freed).
  const balMaster = buildBaluster()
  balMaster.material = mStone
  const balInst = instanceSet(balMaster, balPlacements)
  const pierMaster = buildPier()
  pierMaster.material = mStoneDk
  const pierInst = instanceSet(pierMaster, pierPlacements)
  const bollardMaster = buildBollard()
  const bollardInst = instanceSet(bollardMaster, bollardPlacements)
  const lampMaster = buildLampPier()
  const lampInst = instanceSet(lampMaster, lampPlacements)
  // masters are disabled templates; dispose them (clones carry unique geometry).
  for (const m of [balMaster, pierMaster, bollardMaster, lampMaster]) m.dispose()
  const instMeshes = [railMesh, baseMesh, balInst, pierInst, bollardInst, lampInst].filter(Boolean) as Mesh[]

  /* =========================== RICHER WATER SHEET =========================== */
  // A single large quad a hair above the baked water surface, textured with a
  // painted DEPTH GRADIENT (deep teal far out → luminous near the bank) and a
  // soft SHORELINE FOAM band at the edge. It breathes (emissive + a gentle UV
  // scroll for the foam) so the harbour reads as living water, not flat blue.
  // ONE quad, ONE material — the whole atmosphere half for ~free.
  const z0 = opts.edgeZ - 1.5 // overlap the bank a touch so the foam laps the kerb
  const z1 = opts.bounds.maxZ + 30
  const wWidth = opts.bounds.maxX - opts.bounds.minX + 40
  const wDepth = z1 - z0
  const wcx = (opts.bounds.minX + opts.bounds.maxX) / 2
  const wcz = (z0 + z1) / 2

  // Paint the depth+ripple+foam texture. V runs across the strip (V→1 at the bank
  // after the flip below, V→0 far out); U runs ALONG the shore and is wide enough
  // to carry tiling RIPPLE striations that the per-frame U-scroll drifts sideways.
  const TEX_W = 256
  const TEX_H = 256
  const wtex = new DynamicTexture(`${tag}-wtex`, { width: TEX_W, height: TEX_H }, scene, false)
  const wctx = wtex.getContext() as unknown as CanvasRenderingContext2D
  const deep = shade(waterC, -0.5) // far, deep water
  const shallow = shade(waterC, 0.16) // luminous near the bank
  const css = (c: Color3, a = 1) =>
    `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${a})`
  const grad = wctx.createLinearGradient(0, 0, 0, TEX_H)
  // row 0 = far edge (deep); row H = near the bank (shallow + foam).
  grad.addColorStop(0, css(deep))
  grad.addColorStop(0.55, css(shade(waterC, -0.18)))
  grad.addColorStop(0.86, css(shallow))
  wctx.fillStyle = grad
  wctx.fillRect(0, 0, TEX_W, TEX_H)
  // RIPPLE striations: faint wavy horizontal bands of light/dark across the bay,
  // denser + brighter toward the bank, so the water has texture + catches light
  // (vs. a flat wash). Drawn as gently sinusoidal 1px strokes that tile in U.
  const rippleLt = css(shade(waterC, 0.4), 1)
  const rippleDk = css(shade(waterC, -0.34), 1)
  for (let row = 6; row < TEX_H - 28; row += 7) {
    const depthT = row / TEX_H // 0 far … 1 bank
    const amp = 1.4 + depthT * 2.6 // bigger ripples near the bank
    const alpha = 0.05 + depthT * 0.13
    wctx.strokeStyle = (Math.floor(row / 7) % 2 === 0 ? rippleLt : rippleDk).replace(/[\d.]+\)$/, `${alpha})`)
    wctx.lineWidth = 1
    wctx.beginPath()
    for (let x = 0; x <= TEX_W; x += 4) {
      // two summed sines → an organic, seamlessly-tiling wave (periods divide W).
      const y = row + Math.sin((x / TEX_W) * Math.PI * 4 + row * 0.6) * amp + Math.sin((x / TEX_W) * Math.PI * 8 + row) * amp * 0.4
      if (x === 0) wctx.moveTo(x, y)
      else wctx.lineTo(x, y)
    }
    wctx.stroke()
  }
  // soft foam band hugging the bank (bottom rows), with a wavy lapping lip.
  const foam = wctx.createLinearGradient(0, TEX_H * 0.84, 0, TEX_H)
  foam.addColorStop(0, "rgba(255,255,255,0)")
  foam.addColorStop(0.6, "rgba(244,250,252,0.45)")
  foam.addColorStop(1, "rgba(255,255,255,0.8)")
  wctx.fillStyle = foam
  wctx.fillRect(0, TEX_H * 0.84, TEX_W, TEX_H * 0.16)
  // a brighter scalloped foam lip right at the waterline.
  wctx.strokeStyle = "rgba(255,255,255,0.9)"
  wctx.lineWidth = 2
  wctx.beginPath()
  for (let x = 0; x <= TEX_W; x += 3) {
    const y = TEX_H - 6 + Math.sin((x / TEX_W) * Math.PI * 10) * 3
    if (x === 0) wctx.moveTo(x, y)
    else wctx.lineTo(x, y)
  }
  wctx.stroke()
  wtex.update(false)
  wtex.wrapU = 1 // WRAP_ADDRESSMODE so the gentle U scroll tiles the ripple
  wtex.wrapV = 1
  wtex.hasAlpha = false

  const sheet = MeshBuilder.CreateGround(`${tag}-water`, { width: wWidth, height: wDepth, subdivisions: 1 }, scene)
  sheet.position.set(wcx, 0.07, wcz) // a hair above the baked water (no z-fight)
  sheet.parent = root
  sheet.isPickable = false
  sheet.alwaysSelectAsActiveMesh = true
  sheet.doNotSyncBoundingInfo = true
  sheet.applyFog = false

  const wmat = new StandardMaterial(`${tag}-watermat`, scene)
  wmat.diffuseTexture = wtex
  wmat.emissiveTexture = wtex
  wmat.emissiveColor = new Color3(0.42, 0.46, 0.5)
  wmat.specularColor = new Color3(0, 0, 0)
  wmat.alpha = 0.9
  wmat.backFaceCulling = true
  sheet.material = wmat
  // V maps along Z (depth): the CreateGround default UV already runs 0→1 over the
  // height (Z). Orient so V=1 (foam) lands at the BANK (near z0, shoreward). The
  // ground's V increases with +Z (out to sea), so flip V by tiling -1 + offset 1.
  wtex.vScale = -1
  wtex.vOffset = 1
  // Tile the ripples several times ALONG the shore so they read at quay scale (one
  // 256px texture stretched over the whole waterfront would be far too sparse).
  wtex.uScale = Math.max(6, Math.round(wWidth / 80))
  sheet.freezeWorldMatrix()
  disposables.push(wtex, wmat, sheet)

  /* ---------------------------- per-frame life ---------------------------- */
  const baseEm = wmat.emissiveColor.clone()
  let t = 0
  const update = (dt: number) => {
    if (reduce) return
    t += dt
    // a slow, wide swell on the emissive + a gentle U scroll so the painted
    // ripple/foam crawls sideways like a tide lapping the quay.
    const s = 0.5 + 0.5 * Math.sin(t * 0.6)
    wmat.emissiveColor = baseEm.scale(0.88 + 0.2 * s)
    wtex.uOffset = (t * 0.04) % 1
  }

  return {
    root,
    update,
    dispose: () => {
      for (const m of instMeshes) m.dispose()
      for (const d of disposables) d.dispose()
      root.dispose()
    },
  }
}
