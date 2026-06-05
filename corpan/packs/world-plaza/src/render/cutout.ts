import type { Scene } from "@babylonjs/core/scene"
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder"
import { Mesh } from "@babylonjs/core/Meshes/mesh"
import { TransformNode } from "@babylonjs/core/Meshes/transformNode"
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture"
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial"
import { Texture } from "@babylonjs/core/Materials/Textures/texture"
import { Color3 } from "@babylonjs/core/Maths/math"

/**
 * cutout.ts — the DEFINITIVE grounded cutout primitive.
 *
 * Fixes the whole shadow/grounding bug class from first principles:
 *
 *   • The CONTACT POINT (feet) is the only anchor. `root` sits at y=0 on the
 *     ground; `setGroundPos(x,z)` moves it. Everything hangs off `root`.
 *   • The BODY is a child node (`body`) that hops/squashes/animates WITHOUT
 *     touching `root` — so the feet never leave the ground and the contact
 *     point is immovable.
 *   • The CONTACT SHADOW is a ground decal parented to `root` at a fixed local
 *     position (0, 0.02, 0). It can NEVER drift: it inherits the contact
 *     point's world transform and nothing else. Camera orbit, player movement,
 *     hops — the shadow is welded to the feet by construction.
 *   • The shadow REACTS to hop height like a real penumbra: as the body rises,
 *     the occluder moves away from the ground, so the shadow GROWS and SOFTENS
 *     (radius up, opacity down). `hop()` drives both the body Y and the shadow.
 *
 * Shadow technique (chosen): a soft radial-gradient BLOB DECAL, done right.
 *   Evaluated three:
 *     (a) soft blob decal — ONE shared 128px radial-alpha texture + ONE shared
 *         material across every cutout; a flat ground disc per agent. Zero extra
 *         render passes, trivially batchable, and it can react to hop height.
 *     (b) real shadow-only light + shadow map — a depth pass per caster; with
 *         20–40 agents on a phone that blows the frame budget and gives hard,
 *         art-wrong edges for a paper-cutout look.
 *     (c) baked gradient decal — cheap but static; can't react to the hop, so
 *         hopping characters look pasted-on.
 *   (a) wins on 60fps-phone + look + correctness. It's the contact shadow for
 *   ALL characters (player + crowd). (b) is reserved, if ever, for a single
 *   hero set-piece — not the population.
 *
 * Characters YAW-BILLBOARD (always face the camera, stay upright). The shadow
 * is a fixed ground decal (billboardMode OFF) so it never sweeps.
 */

export type DrawFn = (ctx: CanvasRenderingContext2D, w: number, h: number) => void

/** Cutout plane height in world units; feet at y=0, head at PLANE_H. */
const PLANE_H = 2.6

let uid = 0

/* --------------------------------------------------------- shared resources */

/**
 * ONE radial-alpha blob texture + ONE shadow material, shared by every cutout
 * in the scene. Created lazily per-scene and cached on the scene object so the
 * crowd of 40 pays for a single 128px texture and a single material.
 */
interface SharedShadow {
  texture: Texture
  material: StandardMaterial
}
const SHADOW_CACHE = new WeakMap<Scene, SharedShadow>()

/**
 * The ONE shared contact-shadow blob (texture + material) for a scene. Exported
 * so the 3D character look (`figure3d.ts`) reuses the EXACT same shadow as the
 * paper cutout — one 128px texture for the whole population, cutout or 3D.
 */
export function sharedContactShadow(scene: Scene): SharedShadow {
  return sharedShadow(scene)
}

function sharedShadow(scene: Scene): SharedShadow {
  const hit = SHADOW_CACHE.get(scene)
  if (hit) return hit

  const size = 128
  const dt = new DynamicTexture("wp-shadow-blob", { width: size, height: size }, scene, false)
  const ctx = dt.getContext() as unknown as CanvasRenderingContext2D
  ctx.clearRect(0, 0, size, size)
  // Soft penumbra: opaque-ish core fading to nothing at the rim. Drawn in WHITE
  // so the material's diffuse/alpha tint it black at a chosen opacity — sharing
  // one texture for any colour/strength.
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, "rgba(255,255,255,1)")
  g.addColorStop(0.55, "rgba(255,255,255,0.85)")
  g.addColorStop(0.8, "rgba(255,255,255,0.35)")
  g.addColorStop(1, "rgba(255,255,255,0)")
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2)
  ctx.fill()
  dt.hasAlpha = true
  dt.update()

  const mat = new StandardMaterial("wp-shadow-mat", scene)
  mat.diffuseColor = new Color3(0, 0, 0)
  mat.emissiveColor = new Color3(0, 0, 0)
  mat.specularColor = new Color3(0, 0, 0)
  mat.disableLighting = true
  mat.opacityTexture = dt // alpha from the blob; colour stays pure shadow black
  mat.backFaceCulling = false
  // Render shadows just above the ground, below cutouts; no depth-write so many
  // overlapping shadows blend cleanly without z-fighting each other.
  mat.disableDepthWrite = true
  mat.alpha = 1
  mat.zOffset = -1

  const shared: SharedShadow = { texture: dt, material: mat }
  SHADOW_CACHE.set(scene, shared)
  return shared
}

/* ------------------------------------------------------------ the primitive */

export interface GroundedCutout {
  /** ground-fixed anchor at the contact point (feet). Owns the shadow. */
  root: TransformNode
  /** the hopping/animating body node; cutout plane is its child. */
  body: TransformNode
  /** the pickable cutout plane; carries `metadata.tag` for tap routing. */
  pickMesh: Mesh
  /** the contact-shadow ground decal (parented to root; never drifts). */
  shadow: Mesh

  /** move the contact point. `y` (default 0) lifts the whole figure onto a raised
   *  walk surface like a bridge deck (#40); flat ground leaves it 0. */
  setGroundPos: (x: number, z: number, y?: number) => void
  /** read the contact point. */
  getGroundPos: () => { x: number; z: number }
  /**
   * lift the BODY by `dy` world units without moving the contact point, and
   * react the owned shadow to it (grow + soften). Pass 0 to plant.
   */
  hop: (dy: number) => void
  /** non-uniform squash/stretch of the body (sx,sy); contact point fixed. */
  squash: (sx: number, sy: number) => void
  /** uniform scale of the body (juice pop). */
  setScale: (s: number) => void
  /** repaint the cutout texture (e.g. animator mouth/arm frame). */
  redraw: (draw: DrawFn) => void
  /** explicit billboard refresh hook (Babylon does it per-frame; here for API parity / fixed mode). */
  faceCamera: () => void
  /**
   * Orient the figure to face a world heading (yaw, radians) so it turns toward
   * its movement direction instead of moonwalking. Only the 3D figure honours
   * this (it rotates its root); the legacy yaw-billboard cutout always faces the
   * camera, so it implements this as a no-op. Optional for source-compat.
   */
  setHeading?: (yaw: number) => void

  baseScale: number
  dispose: () => void
}

export interface CutoutOptions {
  w: number
  h: number
  draw: DrawFn
  /** contact-shadow radius in world units (≈ footprint). default 0.62. */
  shadowRadius?: number
  /** base shadow opacity at rest. default 0.30. */
  shadowAlpha?: number
  pickTag?: string
  /** false = fixed-oriented décor; default true = yaw-billboard (characters). */
  billboard?: boolean
  /** fixed yaw (radians) when billboard:false. */
  faceYaw?: number
  /** keep the dynamic texture mutable for animation redraws. default true. */
  animatable?: boolean
}

export function createGroundedCutout(scene: Scene, opts: CutoutOptions): GroundedCutout {
  const id = `wp-cut-${uid++}`
  const animatable = opts.animatable ?? true

  // --- cutout texture + material ---
  const tex = new DynamicTexture(`${id}-tex`, { width: opts.w, height: opts.h }, scene, animatable)
  tex.hasAlpha = true
  const ctx = tex.getContext() as unknown as CanvasRenderingContext2D
  ctx.clearRect(0, 0, opts.w, opts.h)
  opts.draw(ctx, opts.w, opts.h)
  tex.update()

  const mat = new StandardMaterial(`${id}-mat`, scene)
  mat.diffuseTexture = tex
  mat.useAlphaFromDiffuseTexture = true
  mat.emissiveColor = new Color3(0.55, 0.55, 0.55) // lift flats; sun adds shape
  mat.specularColor = new Color3(0, 0, 0)
  mat.backFaceCulling = false
  // Cutouts depth-write so they occlude correctly; a tiny camera-facing zOffset
  // pushes them off coplanar walls so soft alpha edges resolve without z-fight.
  mat.zOffset = 2

  const aspect = opts.w / opts.h
  const plane = MeshBuilder.CreatePlane(id, { width: PLANE_H * aspect, height: PLANE_H }, scene)
  plane.material = mat
  plane.isPickable = true
  if (opts.pickTag) plane.metadata = { tag: opts.pickTag }
  // plane sits so its bottom edge is at the body node's origin (feet line)
  plane.position.y = PLANE_H / 2

  if (opts.billboard === false) {
    plane.billboardMode = Mesh.BILLBOARDMODE_NONE
    plane.rotation.y = opts.faceYaw ?? 0
  } else {
    plane.billboardMode = Mesh.BILLBOARDMODE_Y
  }

  // --- node hierarchy: root (contact point) → body (hops) → plane ---
  const root = new TransformNode(`${id}-root`, scene)
  const body = new TransformNode(`${id}-body`, scene)
  body.parent = root
  plane.parent = body

  // --- owned contact shadow (ground decal, never drifts) ---
  const shadowRadius = opts.shadowRadius ?? 0.62
  const baseAlpha = opts.shadowAlpha ?? 0.3
  const shared = sharedShadow(scene)
  const shadow = MeshBuilder.CreatePlane(`${id}-shadow`, { size: shadowRadius * 2 }, scene)
  shadow.rotation.x = Math.PI / 2 // lie flat on the ground
  shadow.position.y = 0.02 // hover just above the floor to avoid z-fight
  shadow.isPickable = false
  shadow.billboardMode = Mesh.BILLBOARDMODE_NONE
  shadow.parent = root // owned by the contact point — welded by construction
  // Per-cutout material instance is avoidable: share the material, vary alpha
  // via instancedBuffer-free path — but StandardMaterial alpha is per-material.
  // To keep ONE material while reacting per-agent, we clone ONLY the cheap
  // material wrapper lazily when a non-default look is needed; default agents
  // share. Most agents use the same baseAlpha so we just reuse the shared mat
  // and animate opacity via the mesh's visibility (per-mesh, no new material).
  shadow.material = shared.material
  shadow.visibility = baseAlpha // per-mesh opacity multiplier — no extra material

  const groundPos = { x: 0, z: 0 }

  const setGroundPos = (x: number, z: number, y = 0) => {
    groundPos.x = x
    groundPos.z = z
    root.position.x = x
    root.position.z = z
    // Contact point Y is 0 on flat ground, but a RAISED WALK SURFACE (e.g. a
    // bridge deck, #40) lifts the whole figure — root + its welded shadow — to the
    // deck height so the character (and its contact shadow) sit ON the deck, not
    // under it. Defaults to 0 so every existing 2-arg call is unchanged.
    root.position.y = y
  }

  const hop = (dy: number) => {
    const h = dy < 0 ? 0 : dy
    body.position.y = h
    // Penumbra reaction: occluder rising → shadow grows + fades. Clamp so it
    // never vanishes or balloons. ~0 at rest, gentle at full hop.
    const k = Math.min(h / 0.5, 1) // hops are small (<~0.5wu)
    const grow = 1 + k * 0.45
    shadow.scaling.set(grow, grow, grow)
    shadow.visibility = baseAlpha * (1 - k * 0.5)
  }

  const squash = (sx: number, sy: number) => {
    body.scaling.x = sx
    body.scaling.y = sy
  }

  const setScale = (s: number) => {
    body.scaling.set(s, s, s)
  }

  const redraw = (draw: DrawFn) => {
    ctx.clearRect(0, 0, opts.w, opts.h)
    draw(ctx, opts.w, opts.h)
    tex.update()
  }

  return {
    root,
    body,
    pickMesh: plane,
    shadow,
    setGroundPos,
    getGroundPos: () => ({ x: groundPos.x, z: groundPos.z }),
    hop,
    squash,
    setScale,
    redraw,
    faceCamera: () => {
      /* Babylon's BILLBOARDMODE_Y handles it per-frame; no-op for parity. */
    },
    baseScale: 1,
    dispose: () => {
      // shared texture/material are scene-cached; only dispose our own nodes.
      tex.dispose()
      mat.dispose()
      shadow.dispose()
      plane.dispose()
      body.dispose()
      root.dispose()
    },
  }
}

export { PLANE_H }
