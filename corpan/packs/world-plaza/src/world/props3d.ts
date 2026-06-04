import type { Scene as BabylonScene } from "@babylonjs/core/scene"
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder"
import { Mesh } from "@babylonjs/core/Meshes/mesh"
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial"
import { Color3, Matrix, Quaternion, Vector3 } from "@babylonjs/core/Maths/math"

/**
 * props3d.ts — REAL 3D, low-poly, stylized procedural prop meshes for World
 * Plaza's set dressing.
 *
 * WHY THIS FILE EXISTS: the old dressing scattered FLAT paper-cutout planes that
 * went paper-thin the instant you orbited the camera ("busts the illusion").
 * The buildings (buildings.ts) are real 3D volumes that read right from every
 * angle — the props must match. Each prop here is built from a handful of cheap
 * boxes / cylinders / cones / spheres, MERGED into ONE mesh per species, so it
 * has actual volume you can never catch edge-on.
 *
 * PERFORMANCE is the whole game (dozens of props + 28 characters + 28 buildings
 * @ 60fps on a phone):
 *  • ONE merged mesh per species → thin-instanced for every placement = ONE draw
 *    call + ONE material + (almost) zero per-instance cost for the whole town's
 *    worth of that prop. Static instance matrices are frozen.
 *  • Low poly on purpose: cylinders/cones use 6–8 sides, spheres 6–8 segments.
 *    Each whole prop lands well under a few hundred triangles.
 *  • Materials are SHARED across a species and FROZEN. The palette is sampled
 *    once into a small warm family so the props read as the same toy-diorama as
 *    the buildings.
 *  • Because these are real 3D volumes, NO per-instance billboarding is needed
 *    (the old flat path's per-frame yaw pass is gone) — props are simply placed
 *    with a baked yaw and frozen. Pure win.
 *
 * Each `buildXxx()` returns a single `Mesh` positioned around local origin with
 * its FEET at y=0, ready for `thinInstanceSetBuffer`. The caller owns placement,
 * thin-instancing, freezing and disposal.
 */

/* ----------------------------------------------------------------- palette */

type RGB = { r: number; g: number; b: number }

const hexToRgb = (hex: string): RGB => {
  const c = Color3.FromHexString(hex)
  return { r: c.r, g: c.g, b: c.b }
}
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)
const mix = (a: RGB, b: RGB, t: number): RGB => ({
  r: a.r + (b.r - a.r) * t,
  g: a.g + (b.g - a.g) * t,
  b: a.b + (b.b - a.b) * t,
})
/** lighten (t>0 toward white) / darken (t<0 toward black). */
const shade = (c: RGB, t: number): RGB =>
  t >= 0 ? mix(c, { r: 1, g: 1, b: 1 }, t) : mix(c, { r: 0, g: 0, b: 0 }, -t)
const toC3 = (c: RGB): Color3 => new Color3(clamp01(c.r), clamp01(c.g), clamp01(c.b))

/**
 * The warm "Antigua 1770" prop palette, derived from the scene palette so the
 * dressing always belongs to its town. Building/accent/stone hues are pulled
 * from the scene; the rest are tuned constants in the same key.
 */
export interface PropPalette {
  trunk: RGB
  trunkDk: RGB
  leaf: RGB
  leafDk: RGB
  leafLt: RGB
  palmLeaf: RGB
  wood: RGB
  woodDk: RGB
  iron: RGB
  ironLt: RGB
  stone: RGB
  stoneDk: RGB
  terracotta: RGB
  terracottaDk: RGB
  sack: RGB
  sackDk: RGB
  canvasA: RGB // stall stripe A
  canvasB: RGB // stall stripe B
  water: RGB
  flame: RGB
  bloomCols: RGB[]
}

export function resolvePropPalette(p?: Record<string, string>): PropPalette {
  const accent = hexToRgb(p?.accent ?? "#c46b4a")
  const wood = hexToRgb(p?.trim ?? "#9a6a3c")
  const stone = hexToRgb(p?.stone ?? "#cdbf9f")
  const terracotta = hexToRgb(p?.roof ?? "#b05a3c")
  return {
    trunk: hexToRgb("#8a5a36"),
    trunkDk: hexToRgb("#6a4528"),
    leaf: hexToRgb("#6f9c54"),
    leafDk: hexToRgb("#4f7a3a"),
    leafLt: hexToRgb("#8cb968"),
    palmLeaf: hexToRgb("#5f8f4a"),
    wood,
    woodDk: shade(wood, -0.28),
    iron: hexToRgb("#3a342c"),
    ironLt: hexToRgb("#534b40"),
    stone,
    stoneDk: shade(stone, -0.22),
    terracotta,
    terracottaDk: shade(terracotta, -0.24),
    sack: hexToRgb("#d8c79a"),
    sackDk: hexToRgb("#bca878"),
    canvasA: shade(accent, 0.08),
    canvasB: hexToRgb("#f3ead2"),
    water: hexToRgb("#a9dcea"),
    flame: hexToRgb("#ffcf6b"),
    bloomCols: ["#e0556b", "#e8b84a", "#f2f2f2", "#c87fd0", "#ee8f4a"].map(hexToRgb),
  }
}

/* -------------------------------------------------------- material factory */

let muid = 0

/** A shared, frozen StandardMaterial in the building key (emissive lift so the
 * sun adds shape, not gloom — same trick buildings.ts uses). */
export function propMat(
  scene: BabylonScene,
  rgb: RGB,
  opts: { emissive?: number; alpha?: number } = {},
): StandardMaterial {
  const m = new StandardMaterial(`wp-prop3d-${muid++}`, scene)
  m.diffuseColor = toC3(rgb)
  m.emissiveColor = toC3(rgb).scale(opts.emissive ?? 0.32)
  m.specularColor = new Color3(0, 0, 0)
  if (opts.alpha !== undefined) m.alpha = opts.alpha
  m.freeze()
  return m
}

/* --------------------------------------------------------- geometry helpers */

let guid = 0
const nm = (s: string) => `wp-p3d-${s}-${guid++}`

interface Part {
  mesh: Mesh
  color: RGB
  emissive: number
}

/** A tiny scene-local merge builder: accumulate coloured parts, then merge by
 * colour into ONE mesh carrying a small multi-material. Returns the merged mesh
 * with feet at y=0. Cheap: a prop is ~4–12 parts → 1 mesh, 1–4 submesh draws,
 * but all instances of the species still batch to ONE draw call each via thin
 * instancing because they share the merged mesh + materials. */
class PropForge {
  private parts: Part[] = []
  constructor(private scene: BabylonScene) {}

  add(mesh: Mesh, color: RGB, emissive = 0.32): Mesh {
    mesh.isPickable = false
    this.parts.push({ mesh, color, emissive })
    return mesh
  }

  box(w: number, h: number, d: number, color: RGB, x = 0, y = 0, z = 0): Mesh {
    const m = MeshBuilder.CreateBox(nm("box"), { width: w, height: h, depth: d }, this.scene)
    m.position.set(x, y, z)
    return this.add(m, color)
  }

  cyl(
    diameter: number,
    height: number,
    color: RGB,
    x = 0,
    y = 0,
    z = 0,
    tess = 8,
    diaTop?: number,
  ): Mesh {
    const m = MeshBuilder.CreateCylinder(
      nm("cyl"),
      diaTop === undefined
        ? { diameter, height, tessellation: tess }
        : { diameterBottom: diameter, diameterTop: diaTop, height, tessellation: tess },
      this.scene,
    )
    m.position.set(x, y, z)
    return this.add(m, color)
  }

  cone(diameter: number, height: number, color: RGB, x = 0, y = 0, z = 0, tess = 8): Mesh {
    const m = MeshBuilder.CreateCylinder(
      nm("cone"),
      { diameterBottom: diameter, diameterTop: 0, height, tessellation: tess },
      this.scene,
    )
    m.position.set(x, y, z)
    return this.add(m, color)
  }

  sphere(diameter: number, color: RGB, x = 0, y = 0, z = 0, seg = 8): Mesh {
    const m = MeshBuilder.CreateSphere(nm("sph"), { diameter, segments: seg }, this.scene)
    m.position.set(x, y, z)
    return this.add(m, color)
  }

  /** A bright emissive part (e.g. the lamp orb) — own colour group, lit hot. */
  emissiveSphere(diameter: number, color: RGB, x: number, y: number, z: number, emissive = 1, seg = 8): Mesh {
    const m = MeshBuilder.CreateSphere(nm("esph"), { diameter, segments: seg }, this.scene)
    m.position.set(x, y, z)
    return this.add(m, color, emissive)
  }

  /** Build the final merged species mesh. Parts are grouped by quantized colour
   * so identical-colour parts share one submesh+material (a barrel's staves all
   * merge). multiMaterials=true keeps distinct colours as submeshes of ONE mesh. */
  forge(name: string): Mesh {
    // group parts by colour + emissive key
    const groups = new Map<string, { color: RGB; emissive: number; meshes: Mesh[] }>()
    for (const p of this.parts) {
      const key = `${Math.round(p.color.r * 64)},${Math.round(p.color.g * 64)},${Math.round(p.color.b * 64)},${Math.round(p.emissive * 8)}`
      let g = groups.get(key)
      if (!g) {
        g = { color: p.color, emissive: p.emissive, meshes: [] }
        groups.set(key, g)
      }
      g.meshes.push(p.mesh)
    }
    // merge each colour group into one mesh w/ its material, then merge the
    // group-meshes into the final multimaterial mesh.
    const groupMeshes: Mesh[] = []
    for (const g of groups.values()) {
      const merged =
        g.meshes.length === 1
          ? g.meshes[0]
          : Mesh.MergeMeshes(g.meshes, true, true, undefined, false, false)
      if (!merged) continue
      merged.material = propMat(this.scene, g.color, { emissive: g.emissive })
      groupMeshes.push(merged)
    }
    let final: Mesh | null
    if (groupMeshes.length === 1) {
      final = groupMeshes[0]
    } else {
      // multiMultiMaterials=true → one mesh, submesh per colour, materials kept.
      final = Mesh.MergeMeshes(groupMeshes, true, true, undefined, false, true)
    }
    if (!final) final = groupMeshes[0]
    final.name = name
    final.isPickable = false
    final.doNotSyncBoundingInfo = true
    final.alwaysSelectAsActiveMesh = true
    return final
  }
}

/* ============================================================ prop species */
/* Each returns ONE mesh, feet at y=0, ~unit-ish scale (caller scales/places). */

/** Street lamp: iron post + base + cross-arm + a glowing emissive orb. The warm
 * point-glow halo is a SEPARATE additive species the caller adds (so it can
 * pulse); here we bake the solid orb + ironwork. */
export function buildLamp(scene: BabylonScene, pal: PropPalette): Mesh {
  const f = new PropForge(scene)
  const H = 2.5
  f.cyl(0.42, 0.18, pal.iron, 0, 0.09, 0, 8) // base plinth
  f.cyl(0.16, H, pal.iron, 0, H / 2, 0, 6) // post (tapered look via thin)
  f.cyl(0.24, 0.16, pal.ironLt, 0, H - 0.02, 0, 6) // collar near top
  f.box(0.5, 0.07, 0.07, pal.iron, 0.18, H + 0.02, 0) // cross-arm
  // lantern cage (small dark box) hung off the arm
  f.box(0.26, 0.3, 0.26, pal.iron, 0.38, H - 0.02, 0)
  // glowing orb — bright emissive sphere inside the cage
  f.emissiveSphere(0.26, pal.flame, 0.38, H - 0.02, 0, 1, 8)
  // little cap on top of the cage
  f.cone(0.34, 0.18, pal.iron, 0.38, H + 0.18, 0, 6)
  return f.forge("wp-lamp")
}

/** Leafy tree: trunk + 3 stacked rounded foliage spheres (a soft cloud crown). */
export function buildTree(scene: BabylonScene, pal: PropPalette): Mesh {
  const f = new PropForge(scene)
  f.cyl(0.46, 1.7, pal.trunk, 0, 0.85, 0, 6, 0.32) // tapered trunk
  // foliage cluster — overlapping squashed spheres
  const fol = (d: number, y: number, x: number, z: number, c: RGB, seg = 8) => {
    const s = f.sphere(d, c, x, y, z, seg)
    s.scaling.y = 0.82
  }
  fol(2.1, 2.3, 0, 0, pal.leaf)
  fol(1.5, 2.0, 0.55, 0.3, pal.leafDk)
  fol(1.4, 2.1, -0.5, -0.35, pal.leafDk)
  fol(1.2, 2.85, 0.1, 0, pal.leafLt)
  fol(1.0, 2.55, -0.4, 0.45, pal.leaf)
  return f.forge("wp-tree")
}

/** Potted palm: terracotta pot + slim trunk + a crown of low-poly fronds (flat
 * tapered boxes fanned out + tilted down). Real volume from every angle. */
export function buildPalm(scene: BabylonScene, pal: PropPalette): Mesh {
  const f = new PropForge(scene)
  // pot
  f.cyl(0.85, 0.5, pal.terracotta, 0, 0.25, 0, 10, 1.0)
  f.cyl(1.0, 0.12, pal.terracottaDk, 0, 0.52, 0, 10) // rim
  // trunk — a few stacked tapering segments, slight lean baked straight
  const TH = 2.4
  f.cyl(0.3, TH, pal.trunk, 0, 0.5 + TH / 2, 0, 6, 0.2)
  const crownY = 0.5 + TH
  // fronds — tapered flat boxes radiating out and drooping
  const N = 7
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2
    const len = 1.5
    const frond = f.box(len, 0.06, 0.34, pal.palmLeaf, 0, 0, 0)
    // build along +x then rotate/translate so its inner end meets the crown
    frond.bakeCurrentTransformIntoVertices()
    frond.position.set(Math.cos(a) * len * 0.5, crownY - 0.05, Math.sin(a) * len * 0.5)
    frond.rotation.y = -a
    frond.rotation.z = -0.34 // droop
    frond.bakeCurrentTransformIntoVertices()
  }
  // a couple of date clusters
  f.sphere(0.4, pal.leafDk, 0, crownY - 0.1, 0, 6)
  return f.forge("wp-palm")
}

/** Planter / flower box: a wooden trough + soil + little rounded blooms. */
export function buildPlanter(scene: BabylonScene, pal: PropPalette): Mesh {
  const f = new PropForge(scene)
  const W = 1.6
  const D = 0.6
  const Hb = 0.5
  // trough walls (4 thin boxes) + floor-ish base for solidity
  f.box(W, Hb, D, pal.wood, 0, Hb / 2, 0) // solid body
  f.box(W + 0.12, 0.12, D + 0.12, pal.woodDk, 0, Hb - 0.02, 0) // top rim band
  f.box(W + 0.1, 0.1, D + 0.1, pal.woodDk, 0, 0.05, 0) // foot band
  // soil
  f.box(W - 0.18, 0.1, D - 0.18, pal.trunkDk, 0, Hb + 0.02, 0)
  // blooms — little low-poly spheres. Kept to 3 colours + greenery so the
  // merged mesh stays a handful of submeshes (cheap), at low segment counts.
  let bi = 0
  for (let ix = -1; ix <= 1; ix++) {
    for (let iz = -1; iz <= 1; iz += 2) {
      const x = ix * (W / 4)
      const z = iz * (D / 5)
      f.sphere(0.13, pal.leafDk, x, Hb + 0.1, z, 5) // greenery clump
      const c = pal.bloomCols[bi % 3]
      f.sphere(0.16, c, x, Hb + 0.22, z, 5)
      bi++
    }
  }
  return f.forge("wp-planter")
}

/** Barrel: a banded cylinder (slightly belled middle) + iron hoops + lid. */
export function buildBarrel(scene: BabylonScene, pal: PropPalette): Mesh {
  const f = new PropForge(scene)
  const H = 1.05
  // body — middle bell via a wider mid disc sandwich
  f.cyl(0.66, H, pal.wood, 0, H / 2, 0, 10, 0.58) // lower
  f.cyl(0.74, 0.34, pal.wood, 0, H * 0.5, 0, 10) // belly bulge
  f.cyl(0.62, 0.06, pal.terracottaDk, 0, H, 0, 10) // lid
  // iron hoops
  f.cyl(0.7, 0.07, pal.iron, 0, H * 0.22, 0, 10)
  f.cyl(0.76, 0.07, pal.iron, 0, H * 0.5, 0, 10)
  f.cyl(0.7, 0.07, pal.iron, 0, H * 0.8, 0, 10)
  return f.forge("wp-barrel")
}

/** Crate: a box body + raised plank/frame edges so it reads as slatted wood. */
export function buildCrate(scene: BabylonScene, pal: PropPalette): Mesh {
  const f = new PropForge(scene)
  const S = 0.9
  f.box(S, S, S, pal.wood, 0, S / 2, 0)
  // corner posts + edge frames (darker) on the 4 vertical edges + top/bottom
  const t = 0.1
  const e = S / 2
  const post = (x: number, z: number) => f.box(t, S + 0.02, t, pal.woodDk, x, S / 2, z)
  post(e, e)
  post(-e, e)
  post(e, -e)
  post(-e, -e)
  // top + bottom rails on front/back
  for (const z of [e, -e]) {
    f.box(S, t, t, pal.woodDk, 0, S - 0.06, z)
    f.box(S, t, t, pal.woodDk, 0, 0.06, z)
  }
  for (const x of [e, -e]) {
    f.box(t, t, S, pal.woodDk, x, S - 0.06, 0)
    f.box(t, t, S, pal.woodDk, x, 0.06, 0)
  }
  return f.forge("wp-crate")
}

/** Sack: a rounded tapered body (squashed spheres) cinched at a neck. */
export function buildSack(scene: BabylonScene, pal: PropPalette): Mesh {
  const f = new PropForge(scene)
  // bulgy lower body
  const body = f.sphere(0.85, pal.sack, 0, 0.42, 0, 8)
  body.scaling.set(1, 1.05, 1)
  // a second smaller bulge stacked for the cinch shape
  const upper = f.sphere(0.5, pal.sack, 0, 0.86, 0, 8)
  upper.scaling.y = 0.9
  // cinched neck band
  f.cyl(0.36, 0.12, pal.sackDk, 0, 1.0, 0, 8)
  // little gathered top
  f.sphere(0.34, pal.sackDk, 0, 1.12, 0, 6)
  return f.forge("wp-sack")
}

/** Signpost: a post + a base + two angled directional boards. */
export function buildSignpost(scene: BabylonScene, pal: PropPalette): Mesh {
  const f = new PropForge(scene)
  const H = 2.2
  f.cyl(0.34, 0.16, pal.stoneDk, 0, 0.08, 0, 8) // stone base
  f.box(0.16, H, 0.16, pal.woodDk, 0, H / 2, 0) // post
  f.box(0.18, 0.18, 0.18, pal.iron, 0, H, 0) // finial
  // two arrow boards, angled, pointing opposite ways
  const board = (y: number, dir: number, col: RGB) => {
    const b = f.box(0.95, 0.26, 0.07, col, 0, 0, 0)
    b.bakeCurrentTransformIntoVertices()
    b.position.set(dir * 0.5, y, 0)
    b.rotation.y = dir > 0 ? -0.12 : 0.12
    b.bakeCurrentTransformIntoVertices()
  }
  board(H * 0.72, 1, pal.wood)
  board(H * 0.55, -1, shade(pal.wood, -0.12))
  return f.forge("wp-signpost")
}

/** Cart: a wooden bed on a frame + two side rails + two spoked-ish wheels +
 * piled produce. Real depth — wheels are short cylinders, bed is a box. */
export function buildCart(scene: BabylonScene, pal: PropPalette): Mesh {
  const f = new PropForge(scene)
  const bedY = 0.62
  f.box(2.0, 0.22, 1.0, pal.wood, 0, bedY, 0) // bed
  // side rails
  f.box(2.0, 0.36, 0.1, pal.woodDk, 0, bedY + 0.28, 0.45)
  f.box(2.0, 0.36, 0.1, pal.woodDk, 0, bedY + 0.28, -0.45)
  f.box(0.1, 0.36, 1.0, pal.woodDk, 0.95, bedY + 0.28, 0)
  // axle + handle
  f.cyl(0.1, 2.1, pal.woodDk, 0, bedY - 0.18, 0, 6) // (rotated below)
  // wheels — short fat cylinders on the sides, lying on Z axis
  const wheel = (z: number) => {
    const w = f.cyl(0.7, 0.16, pal.trunkDk, 0, 0.35, z, 10)
    w.rotation.x = Math.PI / 2
    w.bakeCurrentTransformIntoVertices()
    const hub = f.cyl(0.2, 0.2, pal.iron, 0, 0.35, z, 8)
    hub.rotation.x = Math.PI / 2
    hub.bakeCurrentTransformIntoVertices()
  }
  wheel(0.58)
  wheel(-0.58)
  // produce piled in
  f.sphere(0.34, pal.bloomCols[0], -0.4, bedY + 0.3, 0, 6)
  f.sphere(0.34, pal.bloomCols[4], 0.0, bedY + 0.32, 0.15, 6)
  f.sphere(0.34, pal.leafDk, 0.4, bedY + 0.3, -0.1, 6)
  return f.forge("wp-cart")
}

/** Market-stall canopy: a low-poly striped tent — 4 posts + a peaked, striped
 * roof. The stripes are two colour groups baked into the merged mesh. */
export function buildStall(scene: BabylonScene, pal: PropPalette): Mesh {
  const f = new PropForge(scene)
  const W = 2.6
  const D = 2.0
  const postH = 1.9
  const hw = W / 2
  const hd = D / 2
  // 4 posts
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    f.box(0.12, postH, 0.12, pal.woodDk, sx * (hw - 0.1), postH / 2, sz * (hd - 0.1))
  }
  // counter board across the front
  f.box(W, 0.14, 0.5, pal.wood, 0, 1.0, hd - 0.25)
  // peaked striped roof — ridge along X; alternating slats of two canvas colours
  const ridgeY = postH + 0.55
  const eaveY = postH + 0.02
  const slats = 6
  for (let i = 0; i < slats; i++) {
    const col = i % 2 === 0 ? pal.canvasA : pal.canvasB
    const x = -hw + (i + 0.5) * (W / slats)
    const sw = (W / slats) * 1.02
    // two sloped panels (front & back) per slat → a tent peak
    for (const side of [1, -1]) {
      const panel = f.box(sw, 0.06, hd + 0.3, col, 0, 0, 0)
      panel.bakeCurrentTransformIntoVertices()
      // pivot at ridge: translate so inner edge at ridge, then tilt down to eave
      panel.position.set(x, ridgeY, side * (hd + 0.3) * 0.5)
      panel.rotation.x = side * -0.62 // slope down toward eaves
      panel.bakeCurrentTransformIntoVertices()
      void eaveY
    }
  }
  // ridge beam
  f.box(W + 0.1, 0.1, 0.1, pal.woodDk, 0, ridgeY, 0)
  // scalloped valance strip along the front eave (a thin striped board)
  f.box(W + 0.2, 0.22, 0.06, pal.canvasA, 0, eaveY + 0.15, hd + 0.32)
  return f.forge("wp-stall")
}

/** Bench: a slatted seat + back + 2 legs, all real boxes. */
export function buildBench(scene: BabylonScene, pal: PropPalette): Mesh {
  const f = new PropForge(scene)
  const W = 1.8
  const seatY = 0.5
  // legs (iron)
  for (const sx of [-1, 1]) {
    f.box(0.12, seatY, 0.5, pal.iron, sx * (W / 2 - 0.18), seatY / 2, 0)
  }
  // seat slats (3)
  for (let i = 0; i < 3; i++) {
    f.box(W, 0.08, 0.16, pal.wood, 0, seatY, -0.18 + i * 0.18)
  }
  // back slats (2) on iron uprights
  for (const sx of [-1, 1]) {
    f.box(0.1, 0.6, 0.1, pal.iron, sx * (W / 2 - 0.18), seatY + 0.3, -0.2)
  }
  for (let i = 0; i < 2; i++) {
    f.box(W, 0.1, 0.08, pal.wood, 0, seatY + 0.3 + i * 0.22, -0.24)
  }
  return f.forge("wp-bench")
}

/** Water trough: a stone box with a hollowed rim + a shimmering water slab. The
 * water is the LAST colour group; caller can grab its material to shimmer. */
export function buildTrough(scene: BabylonScene, pal: PropPalette): { mesh: Mesh } {
  const f = new PropForge(scene)
  const W = 1.8
  const D = 0.8
  const H = 0.55
  // outer stone shell as 4 walls + base (so there's a real basin)
  const t = 0.14
  f.box(W, t, D, pal.stoneDk, 0, t / 2, 0) // floor
  f.box(W, H, t, pal.stone, 0, H / 2, D / 2 - t / 2) // far wall
  f.box(W, H, t, pal.stone, 0, H / 2, -D / 2 + t / 2) // near wall
  f.box(t, H, D, pal.stone, W / 2 - t / 2, H / 2, 0) // right
  f.box(t, H, D, pal.stone, -W / 2 + t / 2, H / 2, 0) // left
  // water slab inside, near the top
  f.box(W - 2 * t, 0.06, D - 2 * t, pal.water, 0, H - 0.1, 0)
  return { mesh: f.forge("wp-trough") }
}

/**
 * Grand multi-tier fountain — ONE solid centrepiece (not instanced). Returned as
 * a parent mesh + the water-tier mesh (so the caller can shimmer it). Built from
 * stone cylinders/discs with real volume. Sits at local origin; caller positions.
 */
export function buildFountainSolid(
  scene: BabylonScene,
  pal: PropPalette,
): { root: Mesh; shimmer: Mesh } {
  const stone = propMat(scene, pal.stone)
  const stoneDk = propMat(scene, pal.stoneDk)
  const water = propMat(scene, pal.water, { emissive: 0.4, alpha: 0.92 })

  const root = new Mesh(nm("fountain"), scene)
  root.isPickable = false

  const piece = (m: Mesh, mat: StandardMaterial) => {
    m.material = mat
    m.isPickable = false
    m.parent = root
    return m
  }

  // outer basin wall (a thick ring approximated by an outer + inner step)
  piece(
    MeshBuilder.CreateCylinder(nm("f-basin"), { diameterTop: 5.0, diameterBottom: 5.3, height: 0.7, tessellation: 20 }, scene),
    stone,
  ).position.y = 0.35
  // basin floor
  piece(
    MeshBuilder.CreateCylinder(nm("f-floor"), { diameter: 4.6, height: 0.18, tessellation: 20 }, scene),
    stoneDk,
  ).position.y = 0.12
  // lower water
  const w1 = piece(
    MeshBuilder.CreateCylinder(nm("f-w1"), { diameter: 4.4, height: 0.16, tessellation: 20 }, scene),
    water,
  )
  w1.position.y = 0.5
  // pedestal
  piece(
    MeshBuilder.CreateCylinder(nm("f-ped"), { diameterTop: 0.7, diameterBottom: 1.0, height: 1.3, tessellation: 14 }, scene),
    stone,
  ).position.y = 1.15
  // mid bowl
  piece(
    MeshBuilder.CreateCylinder(nm("f-bowl"), { diameterTop: 2.0, diameterBottom: 0.8, height: 0.4, tessellation: 18 }, scene),
    stone,
  ).position.y = 1.85
  // upper pedestal
  piece(
    MeshBuilder.CreateCylinder(nm("f-ped2"), { diameterTop: 0.4, diameterBottom: 0.6, height: 0.9, tessellation: 12 }, scene),
    stone,
  ).position.y = 2.45
  // finial sphere
  piece(MeshBuilder.CreateSphere(nm("f-fin"), { diameter: 0.4, segments: 8 }, scene), stoneDk).position.y = 2.95
  // top water (shimmer target)
  const shimmer = piece(
    MeshBuilder.CreateCylinder(nm("f-w2"), { diameter: 1.8, height: 0.1, tessellation: 16 }, scene),
    water.clone(`${water.name}-top`),
  )
  shimmer.position.y = 2.08
  const sm = shimmer.material as StandardMaterial
  sm.unfreeze()

  for (const c of root.getChildMeshes()) c.freezeWorldMatrix()
  return { root, shimmer }
}

/* ---------------------------------------------------------- instance matrix */

/** Build a 4x4 thin-instance matrix: uniform scale, yaw about Y, translate. */
export function instanceMatrix(x: number, y: number, z: number, scale: number, yaw: number): Matrix {
  return Matrix.Compose(
    new Vector3(scale, scale, scale),
    Quaternion.RotationAxis(Vector3.Up(), yaw),
    new Vector3(x, y, z),
  )
}

export { Vector3 }
