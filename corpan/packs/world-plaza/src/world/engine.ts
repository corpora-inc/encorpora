import { Engine } from "@babylonjs/core/Engines/engine"
import { Scene } from "@babylonjs/core/scene"
import { Color3, Color4, Vector3 } from "@babylonjs/core/Maths/math"
import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera"
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight"
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight"
import { Ray } from "@babylonjs/core/Culling/ray"
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh"
import { isBoomBlocker } from "./cameraOcclusion"
import "@babylonjs/core/Materials/standardMaterial"

/**
 * Clean-room Babylon foundation for World Plaza. Built from first principles
 * (NOT forked from hover-runner/stargate). Owns the engine, scene, a scripted
 * third-person follow camera (inputs cleared — movement feeds it), lighting,
 * the render loop, a per-frame update bus, and an on-screen perf HUD.
 *
 * The camera is third-person on purpose: the player should see their own
 * dressed paper-doll cutout. Movement is data-driven; the camera follows.
 */

export interface WorldEngine {
  engine: Engine
  scene: Scene
  camera: UniversalCamera
  /** register a per-frame callback (dt in seconds, capped) */
  onFrame: (cb: (dt: number) => void) => () => void
  /** target the camera follows; set each frame by the controller */
  setCameraTarget: (pos: Vector3, yaw: number) => void
  start: () => void
  setPerfHudVisible: (v: boolean) => void
  dispose: () => void
}

/**
 * Third-person "cruise" camera tunables. Defaults give a LOW, flat,
 * over-the-shoulder rig that looks OUT toward the horizon (not down at the
 * ground) and keeps the paper-doll player large + readable as they move.
 * Every value is named + overridable so the feel can be dialed without code
 * surgery.
 */
export interface CameraRig {
  /** vertical FOV in radians (lower = longer lens, calmer, more cinematic) */
  fov: number
  /** horizontal distance the camera trails behind the player */
  distance: number
  /** camera eye height above the ground plane */
  height: number
  /**
   * height of the look-AT point above the player's feet. Raising this lifts the
   * gaze toward the horizon (flatter pitch); the player still fills frame
   * because the camera is low + close.
   */
  lookHeight: number
  /**
   * 0..1 follow smoothing per frame for camera POSITION (higher = snappier).
   * Critically-damped-ish; framerate-compensated so feel is fps-independent.
   */
  followLerp: number
  /** 0..1 follow smoothing for the look-AT target (slightly snappier than pos). */
  aimLerp: number
}

const DEFAULT_RIG: CameraRig = {
  fov: 0.62, // ~35.5° — a touch longer than the old 0.7 for a premium cruise lens
  distance: 8.8, // midpoint between the old wide rig (11) and the close cruise cam (6.6)
  height: 5.5, // midpoint between old (8) and low (3) — looks out with a touch more overview
  lookHeight: 2.6, // gaze still lifts toward the horizon from the slightly higher eye
  followLerp: 0.12, // smooth, juicy trail (fps-compensated below)
  aimLerp: 0.2,
}

export interface EngineOptions {
  skyColor?: string
  /** how far the camera can see — raise to reveal a deep horizon + landmark */
  maxZ?: number
  /** camera rig tunables; merged over DEFAULT_RIG */
  rig?: Partial<CameraRig>
  /** @deprecated use rig.distance */
  camDistance?: number
  /** @deprecated use rig.height */
  camHeight?: number
}

const hexToColor4 = (hex: string, alpha = 1): Color4 => {
  const c = Color3.FromHexString(hex)
  return new Color4(c.r, c.g, c.b, alpha)
}

export function createWorldEngine(
  canvas: HTMLCanvasElement,
  hudHost: HTMLElement,
  opts: EngineOptions = {},
): WorldEngine {
  // Cap DPR at 2 — high-DPI phones multiply GPU cost for no visible gain.
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const engine = new Engine(canvas, true, {
    antialias: dpr >= 2,
    preserveDrawingBuffer: false,
    powerPreference: "high-performance",
    stencil: false,
  })
  engine.setHardwareScalingLevel(1 / dpr)

  const scene = new Scene(engine)
  scene.clearColor = hexToColor4(opts.skyColor ?? "#bfe0e8")
  scene.skipPointerMovePicking = true // we only need pick on tap
  scene.autoClear = true

  // Merge the camera rig (named tunables; legacy camDistance/camHeight honored).
  const rig: CameraRig = {
    ...DEFAULT_RIG,
    ...opts.rig,
    ...(opts.camDistance != null ? { distance: opts.camDistance } : {}),
    ...(opts.camHeight != null ? { height: opts.camHeight } : {}),
  }

  // Scripted third-person "cruise" camera; inputs cleared so movement drives it.
  // Low + close + flat so the eye looks OUT toward the horizon, not down.
  const camera = new UniversalCamera("cam", new Vector3(0, rig.height, rig.distance), scene)
  camera.fov = rig.fov
  // DEPTH-BUFFER PRECISION (anti-z-fight). The near/far RATIO sets how much
  // precision the depth buffer has in the mid-distance where the city's roofs +
  // coplanar facade decals (plinths/awnings/signs on alpha planes) live. The old
  // 0.1 / 600 was a 6000:1 ratio → mid-distance precision was starved and
  // coplanar surfaces flickered in the bigger city. The chase cam sits ~8.8u back
  // and any wall closer than this is already faded by the occlusion-fade system,
  // so the near plane can push out to 0.8 with no visible clipping. And since the
  // distant vista is retired and chunks dispose beyond ~175u (nothing renders
  // past that), the far plane drops from 600 → 380 (well past all live geometry).
  // New ratio ≈ 475:1 — ~13× more mid-distance precision, ZERO perf cost.
  camera.minZ = 0.8
  camera.maxZ = opts.maxZ ?? 380
  camera.inputs.clear()

  // Soft daylight: hemispheric fill + a gentle directional for cutout shadows.
  const hemi = new HemisphericLight("hemi", new Vector3(0, 1, 0), scene)
  hemi.intensity = 0.85
  hemi.diffuse = new Color3(1, 0.98, 0.92)
  hemi.groundColor = new Color3(0.5, 0.46, 0.4)

  const sun = new DirectionalLight("sun", new Vector3(-0.4, -1, 0.3), scene)
  sun.intensity = 0.5
  sun.position = new Vector3(20, 40, -20)

  const frameCbs = new Set<(dt: number) => void>()
  const onFrame = (cb: (dt: number) => void) => {
    frameCbs.add(cb)
    return () => frameCbs.delete(cb)
  }

  // Camera follow target, updated by the movement controller each frame.
  const followPos = new Vector3(0, 0, 0)
  let followYaw = 0
  const setCameraTarget = (pos: Vector3, yaw: number) => {
    followPos.copyFrom(pos)
    followYaw = yaw
  }
  const tmpDesired = new Vector3()
  // Smoothed look-AT point so the gaze eases instead of snapping when the player
  // turns. Seeded at the rig's look height a little ahead so frame 0 isn't a jerk.
  const aim = new Vector3(0, rig.lookHeight, 0)

  // ── #25 CAMERA BOOM COLLISION (don't clip into buildings) ──────────────────
  // Cast from the player's head toward the DESIRED eye; if a building body/roof is
  // hit before the boom's full length, pull the eye in to just before the hit so
  // the camera never ends up INSIDE a house seeing the roof underside. The fade
  // system still handles a building that's merely between cam and player; this
  // keeps the camera body physically OUT of geometry. Cheap: one ray vs the
  // building/roof bbox set, bounding-info only, reusing scratch (no per-frame GC).
  const boomRay = new Ray(Vector3.Zero(), Vector3.Up(), 1)
  const boomFrom = new Vector3()
  const boomDir = new Vector3()
  const CAM_RADIUS = 0.45 // keep the eye this far off the wall it would hit
  // hard floor on the boomed eye-distance. Big enough that the player stays
  // FRAMED even when the boom is forced short against a wall/awning (at a tiny
  // standoff the near-flat lens drops the player off the bottom of the screen —
  // the #59 "I can't see myself in the market" report). The faded occluder
  // (cameraFade) guarantees we still see THROUGH whatever we're tucked against,
  // so a generous floor here trades a hair of wall-poke (dissolved anyway) for a
  // always-readable shot of the player.
  const MIN_BOOM = 2.4
  // Building/roof meshes to test the boom against. Buildings are `isPickable=false`
  // (frozen), so `scene.pickWithRay` would skip them — we test each mesh directly
  // with `ray.intersectsMesh` (bounding-info only). Resynced only when the building
  // count changes (scene flip), never per frame.
  // #59: SOLID one-off world meshes block the boom — building bodies, roofs, the
  // bridge, walls, fountain — via `isBoomBlocker` (a deny-list, not a fragile name
  // whitelist). THIN-INSTANCED airy props (market stalls/awnings) are deliberately
  // EXCLUDED: their single union AABB spans the whole chunk and would collapse the
  // camera onto the player the instant it nears a market row; the per-object FADE
  // keeps those from ever hiding the player instead. Resynced when the scene mesh
  // set changes (streaming / scene flip), never recomputed per frame.
  const boomMeshes: AbstractMesh[] = []
  let boomMeshSceneCount = -1
  const syncBoomMeshes = () => {
    boomMeshes.length = 0
    for (const m of scene.meshes) {
      if (isBoomBlocker(m)) boomMeshes.push(m)
    }
    boomMeshSceneCount = scene.meshes.length
  }
  /** Shorten the boom IN PLACE on `tmpDesired` when a building occludes the eye. */
  const collideBoom = () => {
    if (scene.meshes.length !== boomMeshSceneCount) syncBoomMeshes()
    if (boomMeshes.length === 0) return
    // ray from head (lifted look point) out to the desired eye.
    boomFrom.set(followPos.x, rig.lookHeight, followPos.z)
    boomDir.copyFrom(tmpDesired).subtractInPlace(boomFrom)
    const boomLen = boomDir.length()
    if (boomLen < 1e-3) return
    boomDir.scaleInPlace(1 / boomLen)
    boomRay.origin.copyFrom(boomFrom)
    boomRay.direction.copyFrom(boomDir)
    boomRay.length = boomLen
    // only test occluders NEAR the boom (it's short, ~rig.distance) — a cheap
    // squared-distance reject keeps this O(near meshes), not O(all city meshes),
    // so it scales to the big streamed city.
    const NEAR_SQ = (rig.distance + 6) * (rig.distance + 6)
    let nearest = boomLen
    for (let i = 0; i < boomMeshes.length; i++) {
      const m = boomMeshes[i]
      const c = m.getBoundingInfo().boundingSphere.centerWorld
      const ddx = c.x - boomFrom.x
      const ddz = c.z - boomFrom.z
      if (ddx * ddx + ddz * ddz > NEAR_SQ) continue
      const pick = boomRay.intersectsMesh(m, true /* fastCheck */, undefined, true /* onlyBoundingInfo */)
      if (pick.hit && pick.distance < nearest) nearest = pick.distance
    }
    if (nearest < boomLen) {
      const d = Math.max(MIN_BOOM, nearest - CAM_RADIUS)
      tmpDesired.set(boomFrom.x + boomDir.x * d, boomFrom.y + boomDir.y * d, boomFrom.z + boomDir.z * d)
    }
  }

  // ---- Perf HUD (benchmark harness seed) ----
  const hud = document.createElement("div")
  hud.className = "wp-perf-hud"
  hud.style.cssText =
    "position:absolute;top:6px;left:6px;z-index:30;font:11px/1.35 ui-monospace,Menlo,monospace;" +
    "color:#0a1f2b;background:rgba(255,255,255,.55);padding:4px 6px;border-radius:6px;" +
    "white-space:pre;pointer-events:none;backdrop-filter:blur(2px)"
  hud.style.display = "none"
  hudHost.appendChild(hud)
  let hudVisible = false
  let hudTimer = 0

  const updateHud = (dtMs: number) => {
    if (!hudVisible) return
    hudTimer += dtMs
    if (hudTimer < 250) return
    hudTimer = 0
    const e = engine as unknown as { drawCalls?: number }
    hud.textContent =
      `fps ${Math.round(engine.getFps())}  frame ${dtMs.toFixed(1)}ms\n` +
      `draws ${e.drawCalls ?? "n/a"}  meshes ${scene.getActiveMeshes().length}/${scene.meshes.length}\n` +
      `verts ${scene.getTotalVertices()}  tex ${scene.textures.length}`
  }

  const renderLoop = () => {
    const dtMs = engine.getDeltaTime()
    const dt = Math.min(dtMs / 1000, 0.05) // cap to avoid post-stall overshoot
    for (const cb of frameCbs) cb(dt)

    // Desired eye: LOW + CLOSE behind the player along its yaw. The low height
    // + lifted look target give a flat, look-OUT-to-the-horizon pitch while the
    // close distance keeps the paper-doll player large and fully readable.
    const sin = Math.sin(followYaw)
    const cos = Math.cos(followYaw)
    tmpDesired.set(
      followPos.x + sin * rig.distance,
      rig.height,
      followPos.z + cos * rig.distance,
    )
    // #25: pull the desired eye in if a building/roof sits between it and the
    // player, so the camera body never clips inside a house.
    collideBoom()
    // Frame-rate-compensated smoothing: convert a per-60fps lerp into a true
    // exponential so the trail feels identical at 30 / 60 / 120 fps (no jerk,
    // no spring overshoot). aPos < aAim → camera body eases, gaze stays locked.
    const aPos = 1 - Math.pow(1 - rig.followLerp, dt * 60)
    const aAim = 1 - Math.pow(1 - rig.aimLerp, dt * 60)
    Vector3.LerpToRef(camera.position, tmpDesired, aPos, camera.position)

    // Smoothly chase a gaze point lifted toward the horizon (flat pitch).
    aim.x += (followPos.x - aim.x) * aAim
    aim.z += (followPos.z - aim.z) * aAim
    aim.y += (followPos.y + rig.lookHeight - aim.y) * aAim
    camera.setTarget(aim)

    updateHud(dtMs)
    scene.render()
  }

  const onResize = () => engine.resize()
  window.addEventListener("resize", onResize)

  return {
    engine,
    scene,
    camera,
    onFrame,
    setCameraTarget,
    start: () => engine.runRenderLoop(renderLoop),
    setPerfHudVisible: (v: boolean) => {
      hudVisible = v
      hud.style.display = v ? "block" : "none"
    },
    dispose: () => {
      window.removeEventListener("resize", onResize)
      frameCbs.clear()
      hud.remove()
      scene.dispose()
      engine.dispose()
    },
  }
}
