import type { Scene } from "@babylonjs/core/scene"
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder"
import { Mesh } from "@babylonjs/core/Meshes/mesh"
import "@babylonjs/core/Meshes/instancedMesh" // side-effect: enables Mesh.createInstance
import { TransformNode } from "@babylonjs/core/Meshes/transformNode"
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture"
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial"
import { Color3, Color4 } from "@babylonjs/core/Maths/math"
import type { InstancedMesh } from "@babylonjs/core/Meshes/instancedMesh"
import type { GroundedCutout, DrawFn } from "../render/cutout"
import { sharedContactShadow, PLANE_H } from "../render/cutout"
import type { CharacterSpec } from "./characterSpec"
import { CHAR_TEX } from "./characterArt"

/**
 * figure3d — the REAL 3D "bubble person" character look.
 *
 * This is the `create3DLook()` the art-direction docs reserved behind the
 * `createGroundedCutout` seam (docs/DECISIONS.md, docs/SPARK_ASSETS.md). It is a
 * DROP-IN for the flat paper-billboard cutout: it returns the exact same
 * `GroundedCutout` handle (root / body / pickMesh / shadow / setGroundPos / hop /
 * squash / setScale / redraw / faceCamera / dispose / baseScale), so the player
 * controller, the crowd, population, and remoteAvatar consume it with ZERO change
 * to their call sites — they keep calling `root.position`, `setGroundPos`,
 * `setScale`, `setEnabled(root)`, and the animator keeps driving `hop`/`squash`/
 * `redraw`. Only the LOOK swaps under the hood.
 *
 * WHAT IT BUILDS (genuine volume, reads from every camera angle):
 *   • a rounded BODY capsule (the "bubble" torso)            ← clothing.top.color
 *   • a HEAD sphere on a short neck                          ← skinTone
 *   • two stubby ARM spheres at the shoulders               ← clothing.top.color
 *   • two LEG capsules under the body                       ← clothing.bottom.color
 *   • two foot dots                                          ← darker bottom
 *   • a billboarded FACE CARD on the front of the head, painted by the SAME
 *     `characterDraw` the animator already feeds — so blink/talk/expression/
 *     identity all animate exactly as before, just on a card welded to a real 3D
 *     head instead of on a flat plane that IS the whole character.
 *
 * The face card is the only billboarding element; the BODY is real 3D geometry
 * that the scene's "sun"/"hemi" lights shade, giving honest volume + form from
 * any orbit angle (no "paper-thin at grazing angle" failure).
 *
 * PERFORMANCE (crowd of ~28 + stationed specials must stay at 60fps):
 *   • Geometry is SHARED. One master sphere + one master capsule per scene are
 *     built once and cached; every body part is an `InstancedMesh` of a master,
 *     so 30 characters add ~180 instances of ~2 source meshes — cheap, batched.
 *   • ONE material for the WHOLE population. Per-character identity colour rides a
 *     per-instance "color" buffer (registered on each master) that Babylon
 *     multiplies into the diffuse — so the crowd is 2 source meshes + 1 material,
 *     yet every part is tinted independently (no per-colour material explosion,
 *     and InstancedMesh does not support per-instance materials anyway).
 *   • The contact shadow reuses the exact same shared blob texture/material the
 *     cutout uses (one 128px texture for the whole scene).
 */

/* ------------------------------------------- shared geometry + ONE material */

interface SharedGeo {
  sphere: Mesh
  capsule: Mesh
  material: StandardMaterial
}
const GEO_CACHE = new WeakMap<Scene, SharedGeo>()

/**
 * ONE master sphere + ONE master capsule + ONE shared matte material for the
 * WHOLE scene's character population. Per-character identity colour is supplied
 * via a per-instance "color" buffer (registered on each master), which Babylon
 * multiplies into the material's diffuse — so 30 characters share 2 source meshes
 * and 1 material, yet each part can be tinted independently. This is the cheap,
 * instanced, per-palette path the perf budget needs (no per-colour material
 * explosion, no material-per-instance which InstancedMesh does not support).
 */
function sharedGeo(scene: Scene): SharedGeo {
  const hit = GEO_CACHE.get(scene)
  if (hit) return hit

  // Matte, slightly self-lit base material. Instance "color" tints the diffuse;
  // a small emissive keeps characters from going muddy in shadow while the "sun"
  // still sculpts real form. No specular → no white blown highlight on the big
  // smooth spheres (that was washing out identity hue).
  const material = new StandardMaterial("wp-fig-mat", scene)
  material.diffuseColor = new Color3(1, 1, 1)
  material.specularColor = new Color3(0, 0, 0)
  material.emissiveColor = new Color3(0.12, 0.12, 0.12)

  const sphere = MeshBuilder.CreateSphere("wp-fig-sphere", { diameter: 1, segments: 12 }, scene)
  sphere.isVisible = false
  sphere.isPickable = false
  sphere.setEnabled(false)
  sphere.material = material
  sphere.registerInstancedBuffer("color", 4) // per-instance diffuse tint (RGBA)

  const capsule = MeshBuilder.CreateCapsule(
    "wp-fig-capsule",
    { radius: 0.5, height: 1, tessellation: 10, subdivisions: 1, capSubdivisions: 4 },
    scene,
  )
  capsule.isVisible = false
  capsule.isPickable = false
  capsule.setEnabled(false)
  capsule.material = material
  capsule.registerInstancedBuffer("color", 4)

  const geo: SharedGeo = { sphere, capsule, material }
  GEO_CACHE.set(scene, geo)
  return geo
}

/** hex → Color4 instance tint (with a touch of emissive baked via the material). */
function tint(hex: string): Color4 {
  const c = Color3.FromHexString(normalizeHex(hex))
  return new Color4(c.r, c.g, c.b, 1)
}

/** Accept #rgb / #rrggbb / rgba()-ish; fall back to a warm neutral. */
function normalizeHex(input: string): string {
  const s = (input || "").trim()
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s
  if (/^#[0-9a-fA-F]{3}$/.test(s)) {
    return "#" + s[1] + s[1] + s[2] + s[2] + s[3] + s[3]
  }
  return "#cbb083"
}

/** Darken a hex by a factor (for leg/foot shade) without a colour lib. */
function darken(hex: string, f: number): string {
  const c = Color3.FromHexString(normalizeHex(hex))
  return c.scale(f).toHexString()
}

/* ------------------------------------------------------------- build sizes */

function buildScale(spec: CharacterSpec): { w: number; h: number } {
  switch (spec.build) {
    case "slim": return { w: 0.86, h: 1.0 }
    case "stocky": return { w: 1.2, h: 0.96 }
    case "tall": return { w: 0.92, h: 1.12 }
    case "child": return { w: 0.8, h: 0.8 }
    default: return { w: 1.0, h: 1.0 }
  }
}

let uid = 0

export interface Figure3DOptions {
  shadowRadius?: number
  shadowAlpha?: number
  pickTag?: string
  /** keep the face texture mutable for animation redraws. default true. */
  animatable?: boolean
}

/**
 * Build a real 3D character figure that satisfies the GroundedCutout contract.
 * `spec` supplies identity colours (skin/hair/top/bottom) mapped onto materials.
 */
export function create3DFigure(scene: Scene, spec: CharacterSpec, opts: Figure3DOptions = {}): GroundedCutout {
  const id = `wp-fig-${uid++}`
  const animatable = opts.animatable ?? true
  const geo = sharedGeo(scene)
  const bs = buildScale(spec)

  // --- node hierarchy mirrors the cutout: root(feet) → body(hops) → parts ---
  const root = new TransformNode(`${id}-root`, scene)
  const body = new TransformNode(`${id}-body`, scene)
  body.parent = root

  // resolve identity colours from the spec (same fields characterArt paints).
  const skinTint = tint(spec.skinTone)
  const topTint = tint(spec.clothing.top?.color ?? "#cbb083")
  const bottomColor = spec.clothing.bottom?.color ?? "#5a4636"
  const legTint = tint(bottomColor)
  const footTint = tint(darken(bottomColor, 0.7))
  const hasHair = spec.hair.style !== "none" && spec.hair.style !== "bald"
  const hairTint = hasHair ? tint(spec.hair.color) : null

  // Proportions (world units). PLANE_H≈2.6 is the cutout's full height; we keep
  // the 3D figure to a similar standing height so it reads at the same scale.
  const H = 2.4 * bs.h
  const torsoH = H * 0.4
  const torsoR = 0.42 * bs.w
  const legH = H * 0.34
  const legR = 0.16 * bs.w
  const headR = 0.34 * bs.w * (spec.build === "child" ? 1.08 : 1)
  const armR = 0.18 * bs.w

  const parts: InstancedMesh[] = []
  const instance = (master: Mesh, name: string, color: Color4) => {
    const inst = master.createInstance(`${id}-${name}`)
    inst.instancedBuffers.color = color // per-instance diffuse tint
    inst.parent = body
    inst.isPickable = false
    parts.push(inst)
    return inst
  }

  // --- legs (two capsules under the torso) ---
  const legBase = legH / 2 + 0.02
  const leftLeg = instance(geo.capsule, "legL", legTint)
  leftLeg.scaling.set(legR * 2, legH, legR * 2)
  leftLeg.position.set(-torsoR * 0.45, legBase, 0)
  const rightLeg = instance(geo.capsule, "legR", legTint)
  rightLeg.scaling.set(legR * 2, legH, legR * 2)
  rightLeg.position.set(torsoR * 0.45, legBase, 0)

  // --- feet (small flattened spheres) ---
  const footY = 0.12
  const leftFoot = instance(geo.sphere, "footL", footTint)
  leftFoot.scaling.set(legR * 2.1, legR * 1.2, legR * 3)
  leftFoot.position.set(-torsoR * 0.45, footY, legR * 0.6)
  const rightFoot = instance(geo.sphere, "footR", footTint)
  rightFoot.scaling.set(legR * 2.1, legR * 1.2, legR * 3)
  rightFoot.position.set(torsoR * 0.45, footY, legR * 0.6)

  // --- torso (the rounded "bubble" body) ---
  const torsoY = legH + torsoH * 0.42
  const torso = instance(geo.sphere, "torso", topTint)
  // egg/bubble shape: a touch taller than wide, belly forward read.
  torso.scaling.set(torsoR * 2.05, torsoH * 1.25, torsoR * 1.9)
  torso.position.set(0, torsoY, 0)

  // --- arms (stubby spheres at the shoulders) ---
  const shoulderY = torsoY + torsoH * 0.18
  const armX = torsoR * 1.15
  const leftArm = instance(geo.sphere, "armL", topTint)
  leftArm.scaling.set(armR * 2, armR * 2.6, armR * 2)
  leftArm.position.set(-armX, shoulderY, 0)
  const rightArm = instance(geo.sphere, "armR", topTint)
  rightArm.scaling.set(armR * 2, armR * 2.6, armR * 2)
  rightArm.position.set(armX, shoulderY, 0)
  // hands (skin dots at the bottom of each arm)
  const handY = shoulderY - armR * 2.2
  const leftHand = instance(geo.sphere, "handL", skinTint)
  leftHand.scaling.set(armR * 1.5, armR * 1.5, armR * 1.5)
  leftHand.position.set(-armX, handY, 0.02)
  const rightHand = instance(geo.sphere, "handR", skinTint)
  rightHand.scaling.set(armR * 1.5, armR * 1.5, armR * 1.5)
  rightHand.position.set(armX, handY, 0.02)

  // --- head (skin sphere) on a short neck ---
  const headY = torsoY + torsoH * 0.62 + headR * 0.9
  const head = instance(geo.sphere, "head", skinTint)
  head.scaling.set(headR * 2, headR * 2.08, headR * 2)
  head.position.set(0, headY, 0)

  // --- hair (a slightly larger cap sphere behind/over the head) ---
  if (hairTint) {
    const hair = instance(geo.sphere, "hair", hairTint)
    const longHair = spec.hair.style === "long" || spec.hair.style === "braid"
    hair.scaling.set(headR * 2.18, headR * (longHair ? 2.4 : 1.7), headR * 2.18)
    // sit it up + back so the face stays clear at the front.
    hair.position.set(0, headY + headR * (longHair ? 0.25 : 0.5), -headR * 0.28)
  }

  // --- FACE CARD: a billboarded plane on the front of the head, painted by the
  // SAME body DrawFn the animator feeds. We crop (via UV scale/offset) to the
  // head region of the 256×384 body texture so only the face shows on the card.
  const tex = new DynamicTexture(`${id}-face`, { width: CHAR_TEX.w, height: CHAR_TEX.h }, scene, animatable)
  tex.hasAlpha = true
  const ctx = tex.getContext() as unknown as CanvasRenderingContext2D
  // characterArt paints the head centred at (w/2, 0.3h) with radius hr≈0.2w. We
  // crop a square window around it onto the card.
  const headCx = 0.5 // fraction
  const headCy = 0.29 // head centre in the 256×384 body texture (≈0.3h)
  // Window just tall enough for head + hair fringe, NOT the torso below the chin
  // (a taller window bled the painted tunic onto the face card).
  const winFrac = 0.4 // window height as a fraction of texture height
  const winH = winFrac
  const winW = winFrac * (CHAR_TEX.h / CHAR_TEX.w) // keep window square in pixels
  tex.uScale = winW
  tex.vScale = winH
  tex.uOffset = headCx - winW / 2
  // texture V is bottom-up in Babylon; our canvas head is at y=0.3 from the top.
  tex.vOffset = 1 - (headCy + winH / 2)

  const faceMat = new StandardMaterial(`${id}-face-mat`, scene)
  faceMat.diffuseTexture = tex
  faceMat.useAlphaFromDiffuseTexture = true
  faceMat.emissiveColor = new Color3(0.6, 0.6, 0.6)
  faceMat.specularColor = new Color3(0, 0, 0)
  faceMat.backFaceCulling = false
  faceMat.disableDepthWrite = false
  faceMat.zOffset = -2 // sit the face just in front of the head sphere

  const faceCardSize = headR * 2.2
  const faceCard = MeshBuilder.CreatePlane(`${id}-facecard`, { size: faceCardSize }, scene)
  faceCard.material = faceMat
  faceCard.parent = body
  faceCard.position.set(0, headY, headR * 0.92) // in front of the head
  faceCard.billboardMode = Mesh.BILLBOARDMODE_Y
  faceCard.isPickable = true
  if (opts.pickTag) faceCard.metadata = { tag: opts.pickTag }

  // A pickable hit proxy spanning the whole figure so taps anywhere on the body
  // route (the face card alone is a small target). Invisible, body-parented.
  const pick = MeshBuilder.CreatePlane(`${id}-pick`, { width: torsoR * 3, height: H }, scene)
  pick.position.set(0, H * 0.5, 0)
  pick.billboardMode = Mesh.BILLBOARDMODE_Y
  pick.isVisible = false
  pick.isPickable = true
  pick.parent = body
  if (opts.pickTag) pick.metadata = { tag: opts.pickTag }

  // --- contact shadow (reuse the shared blob; identical to the cutout) ---
  const shadowRadius = opts.shadowRadius ?? 0.62
  const baseAlpha = opts.shadowAlpha ?? 0.3
  const shared = sharedContactShadow(scene)
  const shadow = MeshBuilder.CreatePlane(`${id}-shadow`, { size: shadowRadius * 2 }, scene)
  shadow.rotation.x = Math.PI / 2
  shadow.position.y = 0.02
  shadow.isPickable = false
  shadow.billboardMode = Mesh.BILLBOARDMODE_NONE
  shadow.parent = root
  shadow.material = shared.material
  shadow.visibility = baseAlpha

  // initial face paint (rest pose). The animator will redraw per its cadence.
  paintFace(ctx, tex)

  const groundPos = { x: 0, z: 0 }

  const setGroundPos = (x: number, z: number, y = 0) => {
    groundPos.x = x
    groundPos.z = z
    root.position.x = x
    root.position.z = z
    root.position.y = y
  }

  const hop = (dy: number) => {
    const h = dy < 0 ? 0 : dy
    body.position.y = h
    const k = Math.min(h / 0.5, 1)
    const grow = 1 + k * 0.45
    shadow.scaling.set(grow, grow, grow)
    shadow.visibility = baseAlpha * (1 - k * 0.5)
  }

  // squash/setScale operate on the body node exactly like the cutout, so the
  // animator's idle-breathe + stride-squash + juice-pop all drive real 3D form.
  const baseBodyScale = { x: 1, y: 1, z: 1 }
  const squash = (sx: number, sy: number) => {
    body.scaling.x = baseBodyScale.x * sx
    body.scaling.y = baseBodyScale.y * sy
    body.scaling.z = baseBodyScale.z * sx
  }
  const setScale = (s: number) => {
    baseBodyScale.x = s
    baseBodyScale.y = s
    baseBodyScale.z = s
    body.scaling.set(s, s, s)
  }

  const redraw = (draw: DrawFn) => {
    ctx.clearRect(0, 0, CHAR_TEX.w, CHAR_TEX.h)
    draw(ctx, CHAR_TEX.w, CHAR_TEX.h)
    tex.update()
  }

  return {
    root,
    body,
    pickMesh: pick,
    shadow,
    setGroundPos,
    getGroundPos: () => ({ x: groundPos.x, z: groundPos.z }),
    hop,
    squash,
    setScale,
    redraw,
    faceCamera: () => {
      /* face card uses BILLBOARDMODE_Y per-frame; no-op for parity. */
    },
    baseScale: 1,
    dispose: () => {
      // shared geo/materials/shadow texture are scene-cached; dispose only ours.
      tex.dispose()
      faceMat.dispose()
      faceCard.dispose()
      pick.dispose()
      shadow.dispose()
      for (const p of parts) p.dispose()
      body.dispose()
      root.dispose()
    },
  }
}

/** Paint a neutral resting face card before the animator takes over. Kept tiny;
 *  the animator immediately repaints with the real characterDraw on first frame. */
function paintFace(ctx: CanvasRenderingContext2D, tex: DynamicTexture) {
  ctx.clearRect(0, 0, CHAR_TEX.w, CHAR_TEX.h)
  tex.update()
}

export { PLANE_H }
