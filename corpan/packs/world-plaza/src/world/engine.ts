import { Engine } from "@babylonjs/core/Engines/engine"
import { Scene } from "@babylonjs/core/scene"
import { Color3, Color4, Vector3 } from "@babylonjs/core/Maths/math"
import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera"
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight"
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight"
import { Ray } from "@babylonjs/core/Culling/ray"
import { SceneInstrumentation } from "@babylonjs/core/Instrumentation/sceneInstrumentation"
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh"
import { isBoomBlocker } from "./cameraOcclusion"
import "@babylonjs/core/Materials/standardMaterial"
import {
  createCinematicPipeline,
  type CinematicPipeline,
  type TimeOfDayName,
} from "../render/pipeline"
import type { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator"

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
  /**
   * Opt a mesh into the sun's contact-hardening shadows (it becomes a caster +
   * receiver). City + character systems call this as their meshes stream in.
   * Safe to call repeatedly with the same mesh (deduped).
   */
  registerShadowCaster: (mesh: AbstractMesh) => void
  /** the sun's shadow generator (advanced: bulk caster lists, receiver flags). */
  getShadowGenerator: () => ShadowGenerator
  /** swap the cinematic time-of-day mood (lights + post + IBL). */
  setTimeOfDay: (name: TimeOfDayName) => void
  /** the full cinematic rendering rig (lights / shadows / post / IBL). */
  cinematic: CinematicPipeline
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
  // Raised eye + LOWER gaze lift = a slightly steeper HD-2D pitch (~28° vs the old
  // ~18°). This drops the far horizon haze out of frame, so the world can render a
  // SMALLER radius without feeling like you see less forward — fewer objects, same
  // sense of distance. Live-tunable via `window.__wpCam = { height, lookHeight,
  // distance, fov }` (read each frame) so the balance can be dialled on-device.
  height: 6.8, // was 5.5 — eye up a notch for more downward overview
  lookHeight: 1.9, // was 2.6 — gaze drops off the horizon toward the near ground
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
  /** starting cinematic time-of-day mood; defaults to the premium golden hour. */
  timeOfDay?: TimeOfDayName
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
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const engine = new Engine(canvas, true, {
    antialias: dpr >= 2,
    preserveDrawingBuffer: false,
    powerPreference: "high-performance",
    stencil: false,
  })
  // Render at ~CSS-pixel resolution, NOT 2× retina. Supersampling a draw/CPU-bound
  // scene to 4× the pixels (a retina fullscreen is ~7.5 MP) buys nothing but fill
  // cost; 1 CSS px is plenty crisp with AA. `hardwareScalingLevel` 1.0 = CSS res;
  // 0.5 would be 2× retina. Never go finer than CSS (cap fill); coarser is allowed
  // for the opt-in adaptive path on a genuinely fill-bound device.
  const baseScale = Math.max(1 / dpr, 1.0)
  engine.setHardwareScalingLevel(baseScale)

  // ── Adaptive resolution ──────────────────────────────────────────────────
  // The single biggest GPU cost here is FILL RATE: at 2× retina the bloom +
  // shadow + fog stack shades 4× the pixels of 1×, which is what drags a strong
  // retina Mac to ~12 fps while a headless 1× box looks fine. So instead of
  // pinning the render scale, we trade RESOLUTION to hold the frame budget: the
  // native (sharpest) scale is 1/dpr; under sustained load we RAISE
  // hardwareScalingLevel (shade fewer pixels) up to a floor, and relax back
  // toward native when there's headroom. Self-tuning: a capable machine stays
  // crisp, a struggling one softens just enough to stay smooth. Geometry/draw
  // calls are untouched, so nothing in the WORLD is removed — only pixel density
  // flexes. Disable with `window.__wpAdaptiveRes = false`.
  const nativeScale = baseScale
  const MAX_SCALE = 2.0 // worst case: half-res per axis (¼ the pixels)
  let curScale = nativeScale
  let emaMs = 16.7
  let adaptCooldown = 60 // let the scene settle before first adjust
  const adaptResolution = (dtMs: number) => {
    // OFF by default: measured draw-call bound (~860 draws ≈ 62ms at 600×484), so
    // shrinking resolution only softened the image for zero fps — pure downside.
    // Opt in with `window.__wpAdaptiveRes = true` only on a genuinely fill-bound
    // device. (The real lever is fewer draws/verts, handled elsewhere.)
    if ((window as unknown as { __wpAdaptiveRes?: boolean }).__wpAdaptiveRes !== true) return
    emaMs += (Math.min(dtMs, 100) - emaMs) * 0.1 // ~10-frame EMA, spike-clamped
    if (adaptCooldown > 0) {
      adaptCooldown--
      return
    }
    const HI = 20 // >50 fps-equivalent budget exceeded → drop resolution
    const LO = 13 // comfortably under 60 fps → restore resolution
    if (emaMs > HI && curScale < MAX_SCALE) {
      curScale = Math.min(MAX_SCALE, curScale + 0.15)
      engine.setHardwareScalingLevel(curScale)
      adaptCooldown = 30 // ~0.5s settle before the next step (RT resize isn't free)
    } else if (emaMs < LO && curScale > nativeScale) {
      curScale = Math.max(nativeScale, curScale - 0.1)
      engine.setHardwareScalingLevel(curScale)
      adaptCooldown = 45
    }
  }
  ;(window as unknown as { __wpRenderScale?: () => number }).__wpRenderScale = () => curScale

  const scene = new Scene(engine)
  scene.clearColor = hexToColor4(opts.skyColor ?? "#bfe0e8")
  scene.skipPointerMovePicking = true // we only need pick on tap
  scene.autoClear = true

  // Real per-frame DRAW-CALL + active-mesh counters (Babylon 9 dropped
  // engine.drawCalls). The perf HUD reads these; a draw-call count near the mesh
  // count means we're draw-call bound (each mesh = its own GPU submission), which
  // adaptive resolution can't fix — only fewer/merged meshes can.
  const inst = new SceneInstrumentation(scene)
  inst.captureActiveMeshesEvaluationTime = true
  inst.captureRenderTargetsRenderTime = true
  inst.captureFrameTime = true
  inst.captureRenderTime = true
  ;(window as unknown as { __wpDraws?: () => number }).__wpDraws = () =>
    inst.drawCallsCounter.current
  // Frame-PHASE breakdown (ms) — pinpoints WHERE the 75ms goes: re-evaluating all
  // resident meshes (activeMeshEval), the render-target passes (shadow/post), the
  // main render, vs total. `meshesTotal` exposes the resident-mesh accumulation.
  ;(window as unknown as { __wpPhases?: () => unknown }).__wpPhases = () => ({
    frameMs: +inst.frameTimeCounter.current.toFixed(1),
    activeMeshEvalMs: +inst.activeMeshesEvaluationTimeCounter.current.toFixed(2),
    renderMs: +inst.renderTimeCounter.current.toFixed(1),
    renderTargetsMs: +inst.renderTargetsRenderTimeCounter.current.toFixed(1),
    draws: inst.drawCallsCounter.current,
    meshesActive: scene.getActiveMeshes().length,
    meshesTotal: scene.meshes.length,
  })
  // Active-mesh breakdown by name prefix — pinpoints which subsystem owns the
  // draw calls (characters vs buildings vs props) so cuts are targeted.
  ;(window as unknown as { __wpActive?: () => unknown }).__wpActive = () => {
    const am = scene.getActiveMeshes()
    const by: Record<string, number> = {}
    for (let i = 0; i < am.length; i++) {
      const nm = am.data[i]?.name ?? "?"
      const k = nm.replace(/[-_][a-z0-9]+$/i, "").replace(/[-_]\d+.*$/, "").slice(0, 16)
      by[k] = (by[k] ?? 0) + 1
    }
    return {
      activeTotal: am.length,
      top: Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 16),
    }
  }

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

  // ── CINEMATIC RENDERING RIG ────────────────────────────────────────────────
  // The single biggest lever from "flat prototype" to "premium game": a real
  // warm KEY sun casting contact-hardening shadows, a cool sky FILL, IBL ambient,
  // and a tone-mapped/bloomed/graded post pipeline. It OWNS its own premium
  // lights and softens the basic "hemi"/"sun" above so we don't double-light.
  // `update(playerPos)` (driven from the render loop) keeps the tight shadow
  // frustum on the player so a single modest shadow map covers the streamed city.
  const cinematic = createCinematicPipeline(scene, camera, { timeOfDay: opts.timeOfDay })

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
    // ray from head (lifted look point, riding the player's elevation) out to the
    // desired eye — so on the bridge deck the boom samples from the real head, not
    // a ground-level point under the deck.
    boomFrom.set(followPos.x, followPos.y + rig.lookHeight, followPos.z)
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
    hud.textContent =
      `fps ${Math.round(engine.getFps())}  frame ${dtMs.toFixed(1)}ms\n` +
      `draws ${inst.drawCallsCounter.current}  meshes ${scene.getActiveMeshes().length}/${scene.meshes.length}\n` +
      `verts ${scene.getTotalVertices()}  tex ${scene.textures.length}\n` +
      `renderScale ${curScale.toFixed(2)} (native ${nativeScale.toFixed(2)})  px ${Math.round(engine.getRenderWidth())}×${Math.round(engine.getRenderHeight())}`
  }

  const renderLoop = () => {
    const dtMs = engine.getDeltaTime()
    const dt = Math.min(dtMs / 1000, 0.05) // cap to avoid post-stall overshoot
    for (const cb of frameCbs) cb(dt)

    // Live camera-rig override (dial the HD-2D pitch on-device without a rebuild):
    // `window.__wpCam = { height, lookHeight, distance, fov }`. Any subset applies.
    const camOv = (window as unknown as { __wpCam?: Partial<CameraRig> }).__wpCam
    if (camOv) {
      if (typeof camOv.height === "number") rig.height = camOv.height
      if (typeof camOv.lookHeight === "number") rig.lookHeight = camOv.lookHeight
      if (typeof camOv.distance === "number") rig.distance = camOv.distance
      if (typeof camOv.fov === "number" && camera.fov !== camOv.fov) camera.fov = camOv.fov
    }

    // Desired eye: LOW + CLOSE behind the player along its yaw. The low height
    // + lifted look target give a flat, look-OUT-to-the-horizon pitch while the
    // close distance keeps the paper-doll player large and fully readable.
    const sin = Math.sin(followYaw)
    const cos = Math.cos(followYaw)
    // The eye rides the player's ELEVATION (followPos.y), not an absolute height —
    // so on a raised surface (the bridge deck) the camera climbs WITH the player
    // and keeps the same framing. Using an absolute height made the eye stay at
    // ground level while the aim rose onto the deck → a steep up-crane that jammed
    // the boom into the deck and zoomed the player's head. General: any elevation.
    tmpDesired.set(
      followPos.x + sin * rig.distance,
      followPos.y + rig.height,
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

    // Re-center the tight sun-shadow frustum on the player so the streamed city
    // keeps crisp contact shadows without paying for a city-wide shadow map.
    cinematic.update(followPos)

    adaptResolution(dtMs)
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
    registerShadowCaster: cinematic.registerShadowCaster,
    getShadowGenerator: cinematic.getShadowGenerator,
    setTimeOfDay: cinematic.setTimeOfDay,
    cinematic,
    dispose: () => {
      window.removeEventListener("resize", onResize)
      frameCbs.clear()
      hud.remove()
      cinematic.dispose()
      scene.dispose()
      engine.dispose()
    },
  }
}
