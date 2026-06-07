import type { Scene } from "@babylonjs/core/scene"
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder"
import { Mesh } from "@babylonjs/core/Meshes/mesh"
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture"
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial"
import { Color3, Vector3 } from "@babylonjs/core/Maths/math"
import { cutoutDraw } from "./cutoutArt"

/**
 * 2.5D billboard cutouts — the heart of the paper-cutout aesthetic. Each cutout
 * is a textured plane that yaw-billboards to face the camera while staying
 * upright, with a soft blob shadow grounding it. Textures are painted onto a
 * 2D canvas (DynamicTexture) — for now PROCEDURALLY (placeholder art in
 * cutoutArt.ts); the same surface later just blits a real Spark-generated
 * sprite atlas region.
 */

export interface Billboard {
  root: Mesh
  /** the pickable cutout plane; carries `metadata.tag` for tap routing. */
  pickMesh: Mesh
  setPosition: (x: number, z: number) => void
  /** uniform scale of the cutout, used by juice (squash/pop). */
  setScale: (s: number) => void
  /** vertical hop of the cutout ONLY (the shadow stays planted under the feet). */
  setBob: (dy: number) => void
  baseScale: number
  dispose: () => void
}

type DrawFn = (ctx: CanvasRenderingContext2D, w: number, h: number) => void

let uid = 0

function makeCutout(
  scene: Scene,
  w: number,
  h: number,
  draw: DrawFn,
  orient?: { billboard?: boolean; faceYaw?: number },
): Mesh {
  const id = `wp-bb-${uid++}`
  const tex = new DynamicTexture(`${id}-tex`, { width: w, height: h }, scene, true)
  tex.hasAlpha = true
  const ctx = tex.getContext() as unknown as CanvasRenderingContext2D
  ctx.clearRect(0, 0, w, h)
  draw(ctx, w, h)
  tex.update()

  const mat = new StandardMaterial(`${id}-mat`, scene)
  mat.diffuseTexture = tex
  mat.useAlphaFromDiffuseTexture = true
  mat.emissiveColor = new Color3(0.55, 0.55, 0.55) // lift flats; sun adds shape
  mat.specularColor = new Color3(0, 0, 0)
  mat.backFaceCulling = false

  const aspect = w / h
  const plane = MeshBuilder.CreatePlane(id, { width: PLANE_H * aspect, height: PLANE_H }, scene)
  plane.material = mat
  // Characters billboard (always face the camera). Decorations stay FIXED so the
  // rotating plane never sweeps its width into a nearby wall (the z-fight/clip).
  if (orient?.billboard === false) {
    plane.billboardMode = 0
    plane.rotation.y = orient.faceYaw ?? 0
  } else {
    plane.billboardMode = Mesh.BILLBOARDMODE_Y
  }
  plane.isPickable = true
  plane.position.y = PLANE_H / 2
  return plane
}

/** Cutout plane height in world units; feet sit at y=0, head at PLANE_H. */
const PLANE_H = 2.6

/* ----------------------------------------------------------- wall proximity */

/** A building footprint on the XZ plane. */
export interface WallBox {
  x: number
  z: number
  w: number
  d: number
}

/**
 * Wall-proximity orientation decision for a free-standing-vs-wall-adjacent
 * décor prop. Given a prop's ground position and the building blockers, decide
 * whether the prop should yaw-billboard (free-standing) or stay FIXED facing
 * away from the wall it reads as attached to.
 *
 * THE TENSION this resolves (learned the hard way in Corpan City): a billboard
 * prop that orbits toward a wall sweeps its flat width INTO the wall (clip /
 * z-fight); a fixed prop in the open goes edge-on / paper-thin when you orbit.
 * So: props hard against a building stay FIXED (oriented to present their face
 * outward, away from the wall, so the back never swings through it); everything
 * out in the open billboards toward the camera and never goes thin.
 *
 * @param x,z      prop ground position
 * @param walls    building footprints (exclude plaza-feature/decor blockers)
 * @param prox     "within this many world units of a wall edge ⇒ wall-adjacent"
 * @returns        `{ billboard: true }` for free-standing props, or
 *                 `{ billboard: false, faceYaw }` (radians, yaw of the outward
 *                 normal) for wall-adjacent props.
 */
export function wallOrientation(
  x: number,
  z: number,
  walls: WallBox[],
  prox = 1.5,
): { billboard: true } | { billboard: false; faceYaw: number } {
  let nearest: WallBox | null = null
  let nearestD = Infinity
  for (const b of walls) {
    // signed distance to the box edge on each axis (0 inside the span).
    const dx = Math.max(Math.abs(x - b.x) - b.w / 2, 0)
    const dz = Math.max(Math.abs(z - b.z) - b.d / 2, 0)
    const d = Math.hypot(dx, dz)
    if (d < nearestD) {
      nearestD = d
      nearest = b
    }
  }
  if (!nearest || nearestD > prox) return { billboard: true }
  // Face away from the wall: outward normal points from the wall centre toward
  // the prop. The cutout plane's front (+z in local space) should look outward,
  // so faceYaw = atan2(outwardX, outwardZ).
  const ox = x - nearest.x
  const oz = z - nearest.z
  const yaw = Math.atan2(ox, oz)
  return { billboard: false, faceYaw: yaw }
}

function makeBlobShadow(scene: Scene, radius: number): Mesh {
  const disc = MeshBuilder.CreateDisc(`wp-shadow-${uid++}`, { radius, tessellation: 18 }, scene)
  disc.rotation.x = Math.PI / 2
  disc.position.y = 0.02
  disc.isPickable = false
  const mat = new StandardMaterial(`${disc.name}-mat`, scene)
  mat.diffuseColor = new Color3(0, 0, 0)
  mat.emissiveColor = new Color3(0, 0, 0)
  mat.specularColor = new Color3(0, 0, 0)
  mat.alpha = 0.22
  disc.material = mat
  return disc
}

export function createBillboard(
  scene: Scene,
  opts: {
    w: number
    h: number
    draw: DrawFn
    shadowRadius?: number
    pickTag?: string
    /** false = fixed orientation (decorations); default true = billboard (characters). */
    billboard?: boolean
    /** fixed yaw (radians) when billboard:false. */
    faceYaw?: number
  },
): Billboard {
  const cutout = makeCutout(scene, opts.w, opts.h, opts.draw, {
    billboard: opts.billboard,
    faceYaw: opts.faceYaw,
  })
  if (opts.pickTag) cutout.metadata = { tag: opts.pickTag }
  const shadow = makeBlobShadow(scene, opts.shadowRadius ?? 0.7)
  const root = new Mesh(`wp-bbroot-${uid++}`, scene)
  cutout.parent = root
  shadow.parent = root
  return {
    root,
    pickMesh: cutout,
    baseScale: 1,
    setPosition: (x: number, z: number) => root.position.set(x, 0, z),
    setScale: (s: number) => cutout.scaling.set(s, s, s),
    setBob: (dy: number) => {
      cutout.position.y = PLANE_H / 2 + dy
    },
    dispose: () => root.dispose(false, true),
  }
}

/**
 * Resolve a Scene spriteRef url (e.g. "placeholder:npc-baker") to a draw fn +
 * plane dims. Delegates to the premium procedural cutout art — a stand-in until
 * the Spark 2D sprite pipeline emits real atlases (the ids + layering are the
 * durable contract; only the pixels get swapped).
 */
export function placeholderDraw(
  url: string,
  accent?: string,
): { w: number; h: number; draw: DrawFn; shadow: number } {
  return cutoutDraw(url, accent)
}

/* ---- ground ---- */

export function createGround(scene: Scene, palette: Record<string, string> | undefined, size: number): Mesh {
  const g1 = palette?.ground ?? "#d9c7a3"
  const g2 = palette?.groundAlt ?? "#cdb892"
  const tex = new DynamicTexture("wp-ground", { width: 512, height: 512 }, scene, false)
  const ctx = tex.getContext() as unknown as CanvasRenderingContext2D
  const cells = 8
  const cs = 512 / cells
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? g1 : g2
      ctx.fillRect(x * cs, y * cs, cs, cs)
    }
  }
  tex.update()
  const ground = MeshBuilder.CreateGround("wp-ground-mesh", { width: size, height: size }, scene)
  const mat = new StandardMaterial("wp-ground-mat", scene)
  mat.diffuseTexture = tex
  mat.specularColor = new Color3(0, 0, 0)
  ;(tex as unknown as { uScale: number; vScale: number }).uScale = 4
  ;(tex as unknown as { uScale: number; vScale: number }).vScale = 4
  ground.material = mat
  ground.position = new Vector3(0, 0, 0)
  ground.isPickable = false
  return ground
}
