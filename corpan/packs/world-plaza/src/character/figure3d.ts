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
import type { FigurePose } from "./figurePose"

/**
 * figure3d — the REAL 3D "bubble person" character (HD-2D / Animal-Crossing-warm).
 *
 * This is the `create3DLook()` the art-direction docs reserved behind the
 * `createGroundedCutout` seam (docs/DECISIONS.md, docs/SPARK_ASSETS.md). It is a
 * DROP-IN for the flat paper-billboard cutout: it returns the exact same
 * `GroundedCutout` handle (root / body / pickMesh / shadow / setGroundPos / hop /
 * squash / setScale / redraw / faceCamera / dispose / baseScale) PLUS an optional
 * `setPose(pose)` hook the animator uses (when present) to drive real limb motion.
 * The player controller, crowd, population, and remoteAvatar consume it with ZERO
 * change to their call sites.
 *
 * ── THE COHESIVE HEAD (no more floating collar / welded face card) ──
 * The old look billboarded a flat FACE CARD in front of a skin sphere; the card's
 * square window showed the paper-doll's cream rim → a hard white "collar" seam
 * across every neck at most angles. We killed it from first principles:
 *
 *   • The HEAD is ONE skin-tinted sphere. Its texture seam is rotated to the BACK.
 *   • The FACE is painted FEATURES ONLY (eyes/brows/nose/mouth/cheeks — fully
 *     TRANSPARENT everywhere else) onto a thin CURVED face shell that hugs the
 *     front of the head and is PARENTED to the head (NOT billboarded), so it turns
 *     with the head and reads as one form. No rectangular card edge, no deckle, no
 *     skin-mismatch — the transparent gaps simply reveal the head sphere's own
 *     skin underneath, so the face IS the head.
 *   • A HAIR cap covers the crown + back, hiding the sphere's pole/seam entirely.
 *
 * From any orbit — front, 3/4, grazing, back — the head is a continuous skin form
 * with features floating just on its surface. No seam exists to show.
 *
 * ── CHARM (proportions + motion) ──
 *   • Slightly oversized head, soft rounded torso, short planted legs, stubby arms
 *     with rounded shoulders/hands — a friendly chibi silhouette.
 *   • Lively idle: breathing bob (from the animator squash) + a slow weight-shift
 *     sway + an occasional gentle head look-around.
 *   • Believable walk: counter-swinging arms, a little forward lean, leg stride,
 *     a bounce — all driven from `setPose` so it stays in sync with the animator.
 *   • Talk/gesture: head bob + the wave arm raise come through the same pose.
 *
 * PERFORMANCE (crowd of ~38 must stay at 60fps):
 *   • Geometry is SHARED: one master sphere + one master capsule per scene, every
 *     body part an `InstancedMesh`. ~38 characters → a few hundred cheap instances
 *     of 2 source meshes.
 *   • ONE body material for the WHOLE population; per-character identity colour
 *     rides a per-instance "color" buffer multiplied into the diffuse.
 *   • Each character owns ONE small (96px) face-shell texture (features only). The
 *     contact shadow reuses the scene's shared blob.
 */

/* ------------------------------------------- shared geometry + ONE material */

interface SharedGeo {
  sphere: Mesh
  capsule: Mesh
  material: StandardMaterial
}
const GEO_CACHE = new WeakMap<Scene, SharedGeo>()

function sharedGeo(scene: Scene): SharedGeo {
  const hit = GEO_CACHE.get(scene)
  if (hit) return hit

  // Matte body material. Instance "color" tints the diffuse; a soft emissive
  // floor keeps characters from going muddy in shadow while the sun still sculpts
  // form. No specular → no blown highlight washing out identity hue on the big
  // smooth spheres.
  const material = new StandardMaterial("wp-fig-mat", scene)
  material.diffuseColor = new Color3(1, 1, 1)
  material.specularColor = new Color3(0, 0, 0)
  material.emissiveColor = new Color3(0.14, 0.14, 0.14)

  const sphere = MeshBuilder.CreateSphere("wp-fig-sphere", { diameter: 1, segments: 14 }, scene)
  sphere.isVisible = false
  sphere.isPickable = false
  sphere.setEnabled(false)
  sphere.material = material
  sphere.registerInstancedBuffer("color", 4) // per-instance diffuse tint (RGBA)

  const capsule = MeshBuilder.CreateCapsule(
    "wp-fig-capsule",
    { radius: 0.5, height: 1, tessellation: 12, subdivisions: 1, capSubdivisions: 5 },
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

/** hex → Color4 instance tint. */
function tint(hex: string): Color4 {
  const c = Color3.FromHexString(normalizeHex(hex))
  return new Color4(c.r, c.g, c.b, 1)
}

/** Accept #rgb / #rrggbb; fall back to a warm neutral. */
function normalizeHex(input: string): string {
  const s = (input || "").trim()
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s
  if (/^#[0-9a-fA-F]{3}$/.test(s)) {
    return "#" + s[1] + s[1] + s[2] + s[2] + s[3] + s[3]
  }
  return "#cbb083"
}

/** Darken a hex by a factor without a colour lib. */
function darken(hex: string, f: number): string {
  const c = Color3.FromHexString(normalizeHex(hex))
  return c.scale(f).toHexString()
}

/* ------------------------------------------------------------- build sizes */

function buildScale(spec: CharacterSpec): { w: number; h: number } {
  switch (spec.build) {
    case "slim": return { w: 0.9, h: 1.02 }
    case "stocky": return { w: 1.18, h: 0.96 }
    case "tall": return { w: 0.94, h: 1.12 }
    case "child": return { w: 0.84, h: 0.82 }
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
 * The figure handle: the full GroundedCutout contract PLUS an optional `setPose`
 * the animator drives for real limb motion (arm swing, stride, look-around).
 */
export interface Figure3D extends GroundedCutout {
  setPose: (pose: FigurePose) => void
}

/**
 * Build a real 3D character figure. `spec` supplies identity colours
 * (skin/hair/top/bottom) mapped onto materials.
 */
export function create3DFigure(scene: Scene, spec: CharacterSpec, opts: Figure3DOptions = {}): Figure3D {
  const id = `wp-fig-${uid++}`
  const animatable = opts.animatable ?? true
  const geo = sharedGeo(scene)
  const bs = buildScale(spec)

  // --- node hierarchy mirrors the cutout: root(feet) → body(hops) → parts ---
  const root = new TransformNode(`${id}-root`, scene)
  const body = new TransformNode(`${id}-body`, scene)
  body.parent = root

  // resolve identity colours from the spec.
  const skinHex = normalizeHex(spec.skinTone)
  const skinTint = tint(skinHex)
  const topHex = normalizeHex(spec.clothing.top?.color ?? "#cbb083")
  const topTint = tint(topHex)
  const bottomHex = normalizeHex(spec.clothing.bottom?.color ?? "#5a4636")
  const legTint = tint(bottomHex)
  const footTint = tint(darken(bottomHex, 0.66))
  const hasHair = spec.hair.style !== "none" && spec.hair.style !== "bald"
  const hairHex = normalizeHex(spec.hair.color)
  const hairTint = hasHair ? tint(hairHex) : null

  // ── CHARMING PROPORTIONS (chibi-warm) ──
  // Total standing height kept near the cutout's so it reads at the same scale.
  const H = 2.3 * bs.h
  const headR = 0.42 * bs.w * (spec.build === "child" ? 1.1 : 1) // BIG friendly head
  const torsoH = H * 0.34
  const torsoR = 0.4 * bs.w
  const legH = H * 0.26
  const legR = 0.17 * bs.w
  const armR = 0.16 * bs.w
  const armLen = torsoH * 0.92

  const parts: InstancedMesh[] = []
  const instance = (master: Mesh, name: string, color: Color4, parent: TransformNode = body) => {
    // `wp-fig-` prefix so every body-part instance is excluded from the camera
    // occluder/boom deny-list (isCameraOccluder) — characters must never pull or
    // fade the camera. Without it, walking limbs registered as walls → camera pulse.
    const inst = master.createInstance(`wp-fig-${id}-${name}`)
    inst.instancedBuffers.color = color
    inst.parent = parent
    inst.isPickable = false
    // A character is a SMALL cluster of parts that's basically always on screen
    // (the camera follows the player; crowd stays near). Per-PART frustum culling
    // is therefore both pointless and BUGGY here: `doNotSyncBoundingInfo` froze each
    // part's WORLD bbox at spawn, so once the figure walked away its stale box left
    // the frustum and the part vanished — the character dissolving piece by piece.
    // `alwaysSelectAsActiveMesh` skips frustum culling AND the per-frame bbox sync
    // (the same active-mesh CPU win we wanted), and the part can never disappear.
    inst.alwaysSelectAsActiveMesh = true
    parts.push(inst)
    return inst
  }

  // --- legs: pivot nodes at the hip so a stride rotates the whole leg ---
  const hipY = legH + 0.02
  const legSpread = torsoR * 0.5
  const mkLeg = (sign: number, name: string) => {
    const pivot = new TransformNode(`${id}-${name}-pivot`, scene)
    pivot.parent = body
    pivot.position.set(sign * legSpread, hipY, 0)
    const leg = instance(geo.capsule, name, legTint, pivot)
    leg.scaling.set(legR * 2, legH, legR * 2)
    leg.position.set(0, -legH / 2, 0)
    // foot — a small flattened sphere planted at the leg's base
    const foot = instance(geo.sphere, `${name}-foot`, footTint, pivot)
    foot.scaling.set(legR * 2.1, legR * 1.3, legR * 3.1)
    foot.position.set(0, -legH + legR * 0.5, legR * 0.7)
    return pivot
  }
  const leftLeg = mkLeg(-1, "legL")
  const rightLeg = mkLeg(1, "legR")

  // --- torso (soft rounded bubble body) ---
  const torsoY = hipY + torsoH * 0.46
  const torso = instance(geo.sphere, "torso", topTint)
  torso.scaling.set(torsoR * 2.05, torsoH * 1.18, torsoR * 1.78)
  torso.position.set(0, torsoY, 0)
  // a soft belly/chest shade band: a slightly darker lower torso sphere for read
  // (kept cheap — one extra instance). Skipped for child to keep them simple.
  if (spec.build !== "child") {
    const hip = instance(geo.sphere, "hip", tint(darken(topHex, 0.92)))
    hip.scaling.set(torsoR * 1.96, torsoH * 0.7, torsoR * 1.7)
    hip.position.set(0, hipY + torsoH * 0.12, 0)
  }

  // --- arms: pivot at the shoulder so swing rotates the whole arm ---
  const shoulderY = torsoY + torsoH * 0.34
  const shoulderX = torsoR * 1.02
  const mkArm = (sign: number, name: string) => {
    const pivot = new TransformNode(`${id}-${name}-pivot`, scene)
    pivot.parent = body
    pivot.position.set(sign * shoulderX, shoulderY, 0)
    const arm = instance(geo.capsule, name, topTint, pivot)
    arm.scaling.set(armR * 2, armLen, armR * 2)
    arm.position.set(0, -armLen / 2, 0)
    const hand = instance(geo.sphere, `${name}-hand`, skinTint, pivot)
    hand.scaling.set(armR * 1.7, armR * 1.7, armR * 1.7)
    hand.position.set(0, -armLen + armR * 0.3, 0.02)
    return pivot
  }
  const leftArm = mkArm(-1, "armL")
  const rightArm = mkArm(1, "armR")

  // --- head: a pivot so it can look around / nod, the skin sphere, hair, face ---
  const neckH = torsoH * 0.16
  const headPivot = new TransformNode(`${id}-head-pivot`, scene)
  headPivot.parent = body
  headPivot.position.set(0, torsoY + torsoH * 0.62 + neckH, 0)

  // a short neck so the head doesn't float — tinted skin, tucked into the collar
  const neck = instance(geo.sphere, "neck", skinTint, headPivot)
  neck.scaling.set(torsoR * 0.7, neckH * 2.2, torsoR * 0.66)
  neck.position.set(0, -neckH * 0.5, 0)

  const head = instance(geo.sphere, "head", skinTint, headPivot)
  head.scaling.set(headR * 2, headR * 2.02, headR * 1.94)
  head.position.set(0, headR * 0.82, 0)
  // rotate the sphere so its UV pole-seam faces straight BACK (out of view).
  head.rotation.y = Math.PI

  // ── FACE SHELL — features-only, painted on a curved cap hugging the head front ──
  const faceTex = new DynamicTexture(
    `${id}-face`,
    { width: FACE_TEX.w, height: FACE_TEX.h },
    scene,
    animatable,
  )
  faceTex.hasAlpha = true
  const fctx = faceTex.getContext() as unknown as CanvasRenderingContext2D

  const faceMat = new StandardMaterial(`${id}-face-mat`, scene)
  faceMat.diffuseTexture = faceTex
  faceMat.useAlphaFromDiffuseTexture = true
  // emissive lifts the features so they read in shade without lighting wash.
  faceMat.emissiveColor = new Color3(0.55, 0.55, 0.55)
  faceMat.specularColor = new Color3(0, 0, 0)
  // Two-sided so the painted features show regardless of the plane's facing (the
  // face is symmetric, so a mirrored back-face read is identical). zOffset biases
  // the features toward the camera so they never z-fight the head sphere.
  faceMat.backFaceCulling = false
  faceMat.disableDepthWrite = false
  faceMat.zOffset = -4

  // A per-character face plane (one tiny plane each — cheap). Built fresh, NOT
  // cloned from the disabled master (a clone of a setEnabled(false) mesh inherits
  // the disabled state and never draws — a known World-Plaza thin-instance trap).
  //
  // It's flat, but kept NARROW + tucked close to the head surface so it stays
  // inside the head's silhouette from a 3/4 angle (a wide card juts off the cheek;
  // a snug one reads as features ON the head). The transparent background means
  // there's no card edge — only the painted features show, on the head's own skin.
  const shell = MeshBuilder.CreatePlane(`${id}-faceshell`, { size: 1 }, scene)
  shell.material = faceMat
  shell.isPickable = false
  shell.alwaysSelectAsActiveMesh = true // never per-part frustum-cull (see instances)
  shell.parent = headPivot
  const faceW = headR * 1.42
  const faceH = headR * 1.66
  shell.scaling.set(faceW, faceH, 1)
  // Sit the plane just in front of the head's front pole (≈0.97·headR) — close
  // enough to read as ON the head, far enough that zOffset keeps it off the skin.
  shell.position.set(0, head.position.y + headR * 0.05, headR * 1.02)

  // hair: a cap covering crown + back, plus style-specific volume. Built from the
  // body material via instances so it shares the population material + tint.
  const headWorldR = headR
  const headTopY = head.position.y
  if (hairTint) {
    const style = spec.hair.style
    const long = style === "long" || style === "braid"
    const tied = style === "tied" || style === "bun"
    // crown cap — a sphere slightly larger than the head, pushed up + back so the
    // FACE stays clear at the front but crown/back/sides are covered (no seam).
    const cap = instance(geo.sphere, "hair", hairTint, headPivot)
    cap.scaling.set(headWorldR * 2.16, headWorldR * (style === "curly" ? 2.1 : 1.9), headWorldR * 2.12)
    cap.position.set(0, headTopY + headWorldR * 0.34, -headWorldR * 0.16)
    if (long) {
      // back length falling behind the head/neck
      const fall = instance(geo.sphere, "hairFall", hairTint, headPivot)
      fall.scaling.set(headWorldR * 1.9, headWorldR * 2.3, headWorldR * 1.2)
      fall.position.set(0, headTopY - headWorldR * 0.55, -headWorldR * 0.7)
    }
    if (tied) {
      const bun = instance(geo.sphere, "hairBun", hairTint, headPivot)
      bun.scaling.set(headWorldR * 0.95, headWorldR * 0.95, headWorldR * 0.95)
      bun.position.set(0, headTopY + headWorldR * 1.1, -headWorldR * 0.5)
    }
  }

  // hat sits on top of the hair (kept simple — a tinted dome + brim from spheres).
  if (spec.clothing.hat) {
    const hatHex = normalizeHex(spec.clothing.hat.color)
    const crown = instance(geo.sphere, "hatCrown", tint(hatHex), headPivot)
    crown.scaling.set(headWorldR * 1.7, headWorldR * 1.1, headWorldR * 1.7)
    crown.position.set(0, headTopY + headWorldR * 0.95, -headWorldR * 0.05)
    const brim = instance(geo.sphere, "hatBrim", tint(darken(hatHex, 0.9)), headPivot)
    brim.scaling.set(headWorldR * 2.7, headWorldR * 0.22, headWorldR * 2.7)
    brim.position.set(0, headTopY + headWorldR * 0.5, -headWorldR * 0.05)
  }

  // A pickable hit proxy spanning the whole figure so taps anywhere route.
  const pick = MeshBuilder.CreatePlane(`${id}-pick`, { width: torsoR * 3, height: H }, scene)
  pick.position.set(0, H * 0.5, 0)
  pick.billboardMode = Mesh.BILLBOARDMODE_Y
  pick.isVisible = false
  pick.isPickable = true
  pick.parent = body
  if (opts.pickTag) pick.metadata = { tag: opts.pickTag }

  // --- contact shadow (reuse the shared blob; identical to the cutout) ---
  const shadowRadius = opts.shadowRadius ?? 0.6
  const baseAlpha = opts.shadowAlpha ?? 0.3
  const shared = sharedContactShadow(scene)
  const shadow = MeshBuilder.CreatePlane(`${id}-shadow`, { size: shadowRadius * 2 }, scene)
  shadow.rotation.x = Math.PI / 2
  shadow.position.y = 0.02
  shadow.isPickable = false
  shadow.alwaysSelectAsActiveMesh = true // never per-part frustum-cull (see instances)
  shadow.billboardMode = Mesh.BILLBOARDMODE_NONE
  shadow.parent = root
  shadow.material = shared.material
  shadow.visibility = baseAlpha

  // colours the face painter needs (cheeks/brows/lips derive from skin/hair).
  const palette: FacePalette = {
    skin: skinHex,
    hair: hairHex,
    cheek: "#e3856a",
    lip: "#a14b38",
    brow: hairTint ? darken(hairHex, 0.85) : "#5a4636",
    iris: normalizeHex(spec.face.eyeColor ?? "#5a3a22"),
  }

  // initial face paint (rest). The animator will redraw via `redraw`.
  paintFace(fctx, faceTex, spec, {}, palette)

  const groundPos = { x: 0, z: 0 }
  const setGroundPos = (x: number, z: number, y = 0) => {
    groundPos.x = x
    groundPos.z = z
    root.position.set(x, y, z)
  }

  const hop = (dy: number) => {
    const h = dy < 0 ? 0 : dy
    body.position.y = h
    const k = Math.min(h / 0.5, 1)
    const grow = 1 + k * 0.45
    shadow.scaling.set(grow, grow, grow)
    shadow.visibility = baseAlpha * (1 - k * 0.5)
  }

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
    // The animator hands us the FULL body DrawFn; we don't paint a body texture
    // (the body is real geometry) — but we DO want the animated FACE. We re-run
    // our features-only painter from the pose the animator last set (see setPose),
    // ignoring the body draw. The face repaint itself happens in setPose.
    void draw
  }

  // ── setPose: the animator's per-frame channels → real 3D motion + face paint ──
  let lastFaceKey = ""
  const setPose = (pose: FigurePose) => {
    // ARMS — swing opposite to stride on walk; a wave raises the right arm.
    const stride = pose.stride ?? 0
    const swing = stride * 0.9 // radians at full stride
    rightArm.rotation.x = -swing
    leftArm.rotation.x = swing
    // legs counter the arms for a believable gait
    rightLeg.rotation.x = swing * 0.85
    leftLeg.rotation.x = -swing * 0.85

    // wave / gesture — raise the right arm forward+out, overriding the swing.
    const rArm = pose.rightArm ?? 0
    if (rArm > 0.02) {
      rightArm.rotation.x = -rArm * 2.5 // forward/up
      rightArm.rotation.z = rArm * 0.5 // out a touch
    } else {
      rightArm.rotation.z = 0
    }
    const lArm = pose.leftArm ?? 0
    if (lArm > 0.02) {
      leftArm.rotation.x = -lArm * 2.5
      leftArm.rotation.z = -lArm * 0.5
    } else {
      leftArm.rotation.z = 0
    }

    // forward LEAN into motion + body sway (weight shift).
    const lean = (pose.lean ?? 0)
    body.rotation.x = lean
    body.rotation.z = pose.sway ?? 0

    // HEAD look-around / nod-tilt.
    headPivot.rotation.y = pose.headYaw ?? 0
    headPivot.rotation.z = pose.headTilt ?? 0
    headPivot.rotation.x = (pose.headNod ?? 0)

    // FACE repaint — only when the visible (quantized) channels change.
    const q = (v: number, s: number) => Math.round((v ?? 0) * s) / s
    const key =
      `${q(pose.mouth ?? 0, 4)}|${(pose.blink ?? 0) > 0.6 ? 1 : 0}|` +
      `${pose.emotion ?? ""}:${q(pose.emotionAmt ?? 0, 5)}|${q(pose.browRaise ?? 0, 4)}`
    if (key !== lastFaceKey) {
      lastFaceKey = key
      paintFace(fctx, faceTex, spec, pose, palette)
    }
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
    setPose,
    faceCamera: () => {
      /* head face shell is parented (not billboarded); no-op for parity. */
    },
    setHeading: (yaw: number) => {
      // Turn the whole figure to face a world heading so it walks the way it's
      // pointed instead of moonwalking/strafing sideways. The model's default
      // forward is +Z (root.rotation.y = 0 faces the +Z camera); setting
      // rotation.y here rotates that forward to `yaw`. setPose's lean/sway live
      // on `body` (a child), so they compose on top of this.
      root.rotation.y = yaw
    },
    baseScale: 1,
    dispose: () => {
      faceTex.dispose()
      faceMat.dispose()
      shell.dispose()
      pick.dispose()
      shadow.dispose()
      for (const p of parts) p.dispose()
      leftLeg.dispose()
      rightLeg.dispose()
      leftArm.dispose()
      rightArm.dispose()
      headPivot.dispose()
      body.dispose()
      root.dispose()
    },
  }
}

/* --------------------------------------------------------------- face paint */

/** Small features-only face texture. Square-ish; mapped to the front head cap. */
const FACE_TEX = { w: 128, h: 128 } as const

interface FacePalette {
  skin: string
  hair: string
  cheek: string
  lip: string
  brow: string
  iris: string
}

/**
 * Paint FEATURES ONLY (transparent everywhere else) onto the face-shell texture.
 * The transparent gaps reveal the head sphere's own skin underneath, so there is
 * no card, no rim, no collar — the face is part of the head.
 *
 * Coordinate frame: the cap subtends roughly the front-centre of the head; we
 * paint into the centred region of the texture and keep features inside a safe
 * margin so the cap's curvature never crops an eye.
 */
function paintFace(
  ctx: CanvasRenderingContext2D,
  tex: DynamicTexture,
  spec: CharacterSpec,
  pose: FacePose,
  pal: FacePalette,
) {
  const w = FACE_TEX.w
  const h = FACE_TEX.h
  ctx.clearRect(0, 0, w, h)

  // Face features live in a centred box; the cap curvature spreads them across
  // the front of the head. cx/cy = face centre; r = feature scale unit.
  const cx = w * 0.5
  const cy = h * 0.5
  const r = w * 0.3

  const emo = resolveExpr(spec, pose)
  const blink = (pose.blink ?? 0) > 0.6 ? 1 : 0
  const lid = Math.max(emo.lid, blink)
  const browRaise = pose.browRaise ?? 0

  // ── eyes ── friendly, a touch larger than tiny; clearly spaced (cute, not bug).
  const ex = r * 0.54 // eye spread from centre
  const ey = cy - r * 0.06
  const er = r * 0.188 * emo.eyeScale
  drawEye(ctx, cx - ex, ey, er, lid, pal)
  drawEye(ctx, cx + ex, ey, er, lid, pal)

  // ── brows ── soft strokes a small gap above the eyes; raise for emphasis.
  const browY = ey - er * (1.35 + browRaise * 0.9) + emo.browLift * r
  ctx.strokeStyle = pal.brow
  ctx.lineWidth = r * 0.095
  ctx.lineCap = "round"
  const bhw = er * 1.3
  const inner = -emo.browInner * r * 0.16
  // a GENTLE arch — the control point lifts only slightly so the brow reads as a
  // soft, friendly curve, not a worried "^" peak. Outer ends sit a touch lower.
  const arch = emo.browArch * r * 0.32
  ctx.beginPath()
  ctx.moveTo(cx - ex - bhw, browY + r * 0.02)
  ctx.quadraticCurveTo(cx - ex, browY - arch, cx - ex + bhw, browY + inner)
  ctx.moveTo(cx + ex + bhw, browY + r * 0.02)
  ctx.quadraticCurveTo(cx + ex, browY - arch, cx + ex - bhw, browY + inner)
  ctx.stroke()

  // ── nose ── a tiny soft mark.
  ctx.strokeStyle = "rgba(120,80,52,0.45)"
  ctx.lineWidth = r * 0.07
  ctx.lineCap = "round"
  ctx.beginPath()
  ctx.moveTo(cx - r * 0.06, cy + r * 0.16)
  ctx.quadraticCurveTo(cx, cy + r * 0.28, cx + r * 0.06, cy + r * 0.16)
  ctx.stroke()

  // ── cheeks ── soft rosy dots, brighter with a genuine smile.
  if (spec.face.cheeks || emo.cheek > 0.4) {
    ctx.save()
    ctx.globalAlpha = 0.28 + emo.cheek * 0.22
    dot(ctx, cx - r * 0.78, cy + r * 0.2, r * 0.2, pal.cheek)
    dot(ctx, cx + r * 0.78, cy + r * 0.2, r * 0.2, pal.cheek)
    ctx.restore()
  }

  // ── mouth ── talk amplitude opens it; else the resting expression curve.
  const my = cy + r * 0.66
  drawMouth(ctx, cx, my, r, emo, pose.mouth ?? 0, pal)

  // ── beard hint ── (kept subtle; just a shade under the chin/jaw).
  if (spec.face.beard && spec.face.beard !== "none") {
    ctx.save()
    ctx.globalAlpha = spec.face.beard === "stubble" ? 0.22 : 0.5
    ctx.fillStyle = "rgba(40,28,18,1)"
    if (spec.face.beard === "mustache") {
      roundRect(ctx, cx - r * 0.34, my - r * 0.26, r * 0.68, r * 0.16, r * 0.08)
      ctx.fill()
    } else {
      ctx.beginPath()
      ctx.ellipse(cx, my + r * 0.32, r * 0.62, r * 0.5, 0, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }

  tex.update()
}

interface ResolvedExpr {
  curve: number // mouth corner curve (+ = smile)
  open: number // resting mouth open
  width: number // grin widen
  teeth: boolean
  lid: number // eyelid droop 0..1
  browLift: number
  browInner: number
  browArch: number
  cheek: number // cheek raise / rosiness 0..1
  eyeScale: number
  skew: number // one-sided (sly only)
}

function resolveExpr(spec: CharacterSpec, pose: FacePose): ResolvedExpr {
  let e = restingExpr(spec.face.expression)
  const emoAmt = pose.emotionAmt ?? 0
  if (emoAmt > 0 && pose.emotion) {
    const t = Math.max(0, Math.min(1, emoAmt))
    const o = restingExpr(pose.emotion)
    const mix = (a: number, b: number) => a + (b - a) * t
    e = {
      curve: mix(e.curve, o.curve),
      open: mix(e.open, o.open),
      width: mix(e.width, o.width),
      teeth: t > 0.5 ? o.teeth || e.teeth : e.teeth,
      lid: mix(e.lid, o.lid),
      browLift: mix(e.browLift, o.browLift),
      browInner: mix(e.browInner, o.browInner),
      browArch: mix(e.browArch, o.browArch),
      cheek: mix(e.cheek, o.cheek),
      eyeScale: mix(e.eyeScale, o.eyeScale),
      skew: e.skew > 0 ? mix(e.skew, Math.min(o.skew, 1)) : 0,
    }
  }
  return e
}

function restingExpr(e: CharacterSpec["face"]["expression"]): ResolvedExpr {
  const base: ResolvedExpr = {
    curve: 0.1, open: 0, width: 0, teeth: false, lid: 0,
    browLift: 0, browInner: 0, browArch: 0.5, cheek: 0.1, eyeScale: 1, skew: 0,
  }
  switch (e) {
    case "smile":
    case "warm":
      return { ...base, curve: 0.5, cheek: 0.55, browArch: 0.6 }
    case "grin":
    case "cheery":
      return { ...base, curve: 0.7, width: 0.4, teeth: true, cheek: 0.8, browArch: 0.7 }
    case "content":
      return { ...base, curve: 0.38, lid: 0.3, cheek: 0.5 }
    case "shy":
      return { ...base, curve: 0.34, width: -0.15, browInner: 0.5, cheek: 0.45, eyeScale: 0.95 }
    case "frown":
    case "stern":
      return { ...base, curve: -0.3, browLift: -0.4, browInner: -0.2, cheek: 0.05, browArch: 0.2 }
    case "surprised":
      return { ...base, curve: 0.05, open: 0.5, browLift: 0.7, browInner: 0.3, cheek: 0.2, eyeScale: 1.12, browArch: 0.8 }
    case "sleepy":
    case "tired":
      return { ...base, curve: 0.12, lid: 0.6, cheek: 0.15, eyeScale: 0.9 }
    case "smirk":
    case "sly":
      return { ...base, curve: 0.2, skew: 1, lid: 0.14, cheek: 0.3 }
    case "sneer":
      return { ...base, curve: -0.05, skew: 1.2, browLift: -0.1, lid: 0.2, cheek: 0 }
    case "neutral":
      return { ...base, curve: 0.12, cheek: 0.12 }
    default:
      return { ...base, curve: 0.42, cheek: 0.5 } // warm default
  }
}

function drawEye(
  ctx: CanvasRenderingContext2D,
  ex: number, ey: number, er: number,
  lid: number, pal: FacePalette,
) {
  if (lid > 0.85) {
    // closed → a happy upturned arc (blink/sleep)
    ctx.strokeStyle = "#2a2018"
    ctx.lineWidth = er * 0.34
    ctx.lineCap = "round"
    ctx.beginPath()
    ctx.moveTo(ex - er, ey + er * 0.1)
    ctx.quadraticCurveTo(ex, ey - er * 0.5, ex + er, ey + er * 0.1)
    ctx.stroke()
    return
  }
  const eh = er * (1 - lid * 0.5)
  // soft white bed (a touch wider than the iris so a friendly sclera shows)
  ctx.fillStyle = "rgba(255,255,255,0.96)"
  ctx.beginPath(); ctx.ellipse(ex, ey, er * 0.96, eh, 0, 0, Math.PI * 2); ctx.fill()
  // IRIS — a warm coloured disc (not a black void). Sits slightly low in the eye.
  const iy = ey + eh * 0.12
  const ir = Math.min(er * 0.62, eh * 0.84)
  ctx.fillStyle = pal.iris
  ctx.beginPath(); ctx.ellipse(ex, iy, ir, ir, 0, 0, Math.PI * 2); ctx.fill()
  // a subtle darker iris rim for depth
  ctx.strokeStyle = "rgba(40,26,16,0.5)"; ctx.lineWidth = er * 0.07
  ctx.beginPath(); ctx.ellipse(ex, iy, ir, ir, 0, 0, Math.PI * 2); ctx.stroke()
  // pupil (modest — the warmth comes from the iris ring, not a giant black hole)
  ctx.fillStyle = "#241a12"
  ctx.beginPath(); ctx.ellipse(ex, iy, ir * 0.5, ir * 0.5, 0, 0, Math.PI * 2); ctx.fill()
  // two catchlights — the sparkle of life
  ctx.fillStyle = "rgba(255,255,255,0.98)"
  ctx.beginPath(); ctx.ellipse(ex - ir * 0.34, iy - ir * 0.38, ir * 0.3, ir * 0.3, 0, 0, Math.PI * 2); ctx.fill()
  ctx.globalAlpha = 0.7
  ctx.beginPath(); ctx.ellipse(ex + ir * 0.3, iy + ir * 0.28, ir * 0.16, ir * 0.16, 0, 0, Math.PI * 2); ctx.fill()
  ctx.globalAlpha = 1
  // upper lash line — a soft arc framing the eye (never a harsh squint)
  ctx.strokeStyle = "rgba(50,36,26,0.9)"
  ctx.lineWidth = er * 0.16
  ctx.lineCap = "round"
  ctx.beginPath()
  ctx.moveTo(ex - er * 0.92, ey - eh * 0.34)
  ctx.quadraticCurveTo(ex, ey - eh * 1.15, ex + er * 0.92, ey - eh * 0.34)
  ctx.stroke()
}

function drawMouth(
  ctx: CanvasRenderingContext2D,
  cx: number, my: number, r: number,
  emo: ResolvedExpr, mouthOpen: number, pal: FacePalette,
) {
  const hw = r * (0.34 + emo.width * 0.16)
  const open = Math.max(mouthOpen, emo.open)
  if (open > 0.06) {
    const oh = r * (0.05 + open * 0.34)
    const ow = hw * (1 - open * 0.16)
    ctx.fillStyle = "#6e2f22"
    ctx.beginPath(); ctx.ellipse(cx, my, ow, oh, 0, 0, Math.PI * 2); ctx.fill()
    if (open > 0.2 || emo.teeth) {
      ctx.save()
      ctx.beginPath(); ctx.ellipse(cx, my, ow, oh, 0, 0, Math.PI * 2); ctx.clip()
      ctx.fillStyle = "#fff"
      ctx.beginPath(); ctx.ellipse(cx, my - oh * 0.66, ow * 0.92, oh * 0.42, 0, 0, Math.PI * 2); ctx.fill()
      ctx.restore()
    }
    ctx.strokeStyle = pal.lip; ctx.lineWidth = r * 0.07; ctx.lineCap = "round"
    ctx.beginPath(); ctx.ellipse(cx, my, ow, oh, 0, 0, Math.PI * 2); ctx.stroke()
    return
  }
  // closed smile/frown arc
  ctx.strokeStyle = pal.lip
  ctx.lineWidth = r * 0.12
  ctx.lineCap = "round"
  const dip = emo.curve * r * 0.5
  const ry = my - emo.skew * r * 0.18 // sly: lift right corner
  ctx.beginPath()
  ctx.moveTo(cx - hw, my)
  ctx.quadraticCurveTo(cx, my + dip, cx + hw, ry)
  ctx.stroke()
  if (emo.teeth && emo.curve > 0.2) {
    ctx.strokeStyle = "rgba(255,255,255,0.85)"
    ctx.lineWidth = r * 0.06
    ctx.beginPath()
    ctx.moveTo(cx - hw * 0.7, my + r * 0.02)
    ctx.quadraticCurveTo(cx, my + dip + r * 0.06, cx + hw * 0.7, ry + r * 0.02)
    ctx.stroke()
  }
}

const dot = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number, c: string) => {
  ctx.beginPath(); ctx.fillStyle = c; ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
}
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

/** The face channels paintFace consumes (a subset of FigurePose). */
type FacePose = Pick<
  FigurePose,
  "mouth" | "blink" | "emotion" | "emotionAmt" | "browRaise"
>

export { PLANE_H }
