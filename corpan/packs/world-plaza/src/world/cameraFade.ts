import type { Scene } from "@babylonjs/core/scene"
import type { Camera } from "@babylonjs/core/Cameras/camera"
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh"
import { Ray } from "@babylonjs/core/Culling/ray"
import { Vector3 } from "@babylonjs/core/Maths/math"
import { isFadeEligible } from "./cameraOcclusion"
import { walkSurfaceHeight } from "./walkSurface"

/**
 * cameraFade.ts — premium 3rd-person CAMERA-OCCLUSION FADE for World Plaza.
 *
 * THE PROBLEM (owner playtest): it's rare-but-possible to drive the scripted
 * follow camera INTO/behind a building (e.g. inside a roof) and lose sight of
 * the paper-doll player entirely. Many 3rd-person games solve this with a
 * "camera cutaway": geometry between the camera and the character — or geometry
 * the camera is sitting inside — smoothly fades out, then smoothly restores
 * once it no longer blocks the shot. You never lose your character.
 *
 * THIS MODULE is fully self-contained. It reads the live scene + camera + a
 * player-position getter at runtime and, each frame, adjusts `mesh.visibility`
 * on a small set of FADE-ELIGIBLE meshes. It edits NOTHING else — the caller
 * just wires `update(dt)` into the render loop and `dispose()` into teardown.
 *
 * ── WHAT'S ELIGIBLE ────────────────────────────────────────────────────────
 * BUILDING BODY MESHES ONLY. In `buildings.ts` each building's solid geometry
 * (walls + facade decals) is MERGED into ONE mesh named `wp-building-<n>`
 * (pickable=false, frozen world matrix, a frozen SHARED material pool). Fading
 * `mesh.visibility` is per-OBJECT (it does NOT touch the shared frozen
 * material), so we can fade a whole building cleanly without flickering its
 * neighbours that share the same stucco material. Roofs/props are deliberately
 * NOT eligible:
 *   • Roof/stone pieces are separate frozen meshes, but the body box already
 *     spans the full footprint+height, so fading the body alone reveals the
 *     character inside; chasing every roof shard would be churn for no gain.
 *     (We DO, however, fade the body when the camera is buried in the roof,
 *     because the body is what stands between camera and character.)
 *   • Small props are THIN-INSTANCED (one mesh = a whole species); fading the
 *     template would blink every lamp/tree in town. Skipped on purpose.
 *
 * ── DETECTION (cheap, robust, zero per-frame allocation) ───────────────────
 * Per frame we recompute, for each eligible mesh, a boolean "is this mesh
 * occluding the character right now?" and drive a per-mesh TARGET visibility:
 *   1) CAMERA-INSIDE-MESH — if the camera eye is inside (or within a small skin
 *      of) a building's world AABB, that building is fading: you must be able to
 *      see OUT. This is the literal "camera drove into the roof" case.
 *   2) SEGMENT OCCLUSION — cast ONE ray from the camera eye toward the
 *      character's head. Any eligible mesh whose bounding box is hit BEFORE the
 *      character (hit distance < distance-to-head) is between camera and
 *      character → fade it. We test bounding boxes only (onlyBoundingInfo) for
 *      speed and because a building body box tightly wraps its footprint; this
 *      avoids per-triangle cost and is conservative (fades a hair early, which
 *      reads as a clean cutaway, never a pop-through).
 * A mesh that is neither inside nor occluding restores to full visibility.
 *
 * ── SMOOTHING ──────────────────────────────────────────────────────────────
 * Each mesh lerps `visibility` toward its target (FADED_VISIBILITY when
 * occluding, 1 when clear) with an fps-compensated exponential, so fades ease
 * in/out and never pop. Faded buildings render in alpha (visibility < 1 forces
 * Babylon to treat the mesh as transparent), giving the cutaway look for free.
 *
 * ── PERF ────────────────────────────────────────────────────────────────────
 *   • Eligible set is gathered ONCE on construction (and lazily re-synced only
 *     when the building count changes — scene flips rebuild buildings), never
 *     per frame.
 *   • Hot path reuses preallocated Vector3s + one Ray; no allocations.
 *   • One ray vs N building AABBs + N AABB-inside tests per frame; N is ~20.
 */

/** How transparent a fully-faded occluder gets (0 = invisible, 1 = solid).
 * MUST be 0: a building mesh is a merge of the stucco box + four double-sided
 * facade decal planes sitting +0.02 proud of the walls. At any PARTIAL alpha
 * those near-coplanar double-sided layers alpha-blend in an unstable, view-
 * dependent order (no depth pre-pass, samples=1) → a mottled "dirty screen that
 * swims with the camera" wash. Fully dissolving (0) removes the partial-alpha
 * layering entirely, so the cutaway reads clean. (A soft ghost would need
 * needDepthPrePass on faded bodies — deferred; the materials are frozen.) */
const FADED_VISIBILITY = 0
/** per-60fps lerp toward the target visibility (fps-compensated below). */
const FADE_LERP = 0.18
/** snap-to-target threshold so visibility settles exactly at 1 / FADED. */
const SETTLE_EPS = 0.004
/** player head height above feet for the camera→character sight ray. */
const HEAD_HEIGHT = 1.6
/** skin (world units) added around a building AABB for the inside test, so a
 *  camera grazing a wall/eave also fades (you're "in" the roof overhang). */
const INSIDE_SKIN = 0.6
/** don't fade a mesh whose near hit is basically AT the camera-to-head segment
 *  end — give the character a small clear bubble so its own footprint building
 *  isn't counted when standing flush against a wall. */
const OCCLUDER_MARGIN = 0.35

export interface CameraFade {
  /** call once per frame from the render loop (dt seconds, unused but kept for
   *  symmetry/future ease curves — smoothing is fps-compensated internally). */
  update: (dt: number) => void
  /** restore all faded meshes to solid and drop references. */
  dispose: () => void
}

interface Tracked {
  mesh: AbstractMesh
  /** target visibility this frame: FADED_VISIBILITY (occluding) or 1 (clear). */
  target: number
}

/**
 * Build the camera-occlusion fade system.
 *
 * @param scene         live Babylon scene (read-only).
 * @param camera        the follow camera (read-only).
 * @param getPlayerPos  () => player world position on the ground plane {x,z}.
 *                      We add HEAD_HEIGHT for the sight-ray endpoint.
 * @param opts.match    predicate selecting fade-eligible meshes by name. Default
 *                      matches building bodies (`wp-building-*`).
 */
export function createCameraFade(
  scene: Scene,
  camera: Camera,
  getPlayerPos: () => { x: number; z: number },
  opts: { match?: (mesh: AbstractMesh) => boolean } = {},
): CameraFade {
  // #59: fade ANY solid occluder between the camera and the player — buildings,
  // roofs, market STALLS/AWNINGS, the bridge, walls, fountain — via the shared
  // `isCameraOccluder` deny-list, NOT a fragile name whitelist (the whitelist
  // missed the market stalls, which is exactly how the camera-in-the-roof bug
  // survived). The boom-collision in engine.ts keeps the eye OUT of geometry; this
  // fade is the belt-and-braces so a mesh merely BETWEEN cam + player never hides it.
  // Fade ONLY solid one-off occluders (buildings, roofs, walls, bridge, fountain).
  // Thin-instanced scatter (trees, planters, lamps, stalls) is EXCLUDED: a whole
  // species shares one UNION bounding box spanning the chunk, so a ray grazing it
  // ghosted EVERY tree/planter at once — "objects disappear in front of me". A
  // narrow prop briefly clipping the player reads far better than the whole grove
  // dissolving. Same solid-one-off set the boom uses — but via `isFadeEligible`,
  // which (unlike the boom's `isBoomBlocker`) does NOT gate on current visibility,
  // so a mesh THIS system has faded toward 0 stays eligible and can be restored.
  const match = opts.match ?? isFadeEligible

  // Eligible meshes + their per-frame target visibility. Resynced only when the
  // scene's building population changes (scene flip), never per frame.
  const tracked: Tracked[] = []
  let lastSceneMeshCount = -1

  const syncEligible = () => {
    const prev = tracked.slice()
    tracked.length = 0
    for (const m of scene.meshes) {
      if (match(m)) tracked.push({ mesh: m, target: 1 })
    }
    // SAFETY: any mesh that WAS tracked (possibly mid-fade, visibility < 1) but is
    // no longer eligible gets restored to solid here — so a rebuild can never strand
    // a building ghost-transparent (its box collision still blocks you otherwise).
    const nowTracked = new Set(tracked.map((t) => t.mesh))
    for (const t of prev) {
      if (!nowTracked.has(t.mesh) && !t.mesh.isDisposed() && t.mesh.visibility !== 1) {
        t.mesh.visibility = 1
      }
    }
    lastSceneMeshCount = scene.meshes.length
  }
  syncEligible()

  // ---- preallocated hot-path scratch (no per-frame GC) ----
  const head = new Vector3()
  const camPos = new Vector3()
  const dir = new Vector3()
  const ray = new Ray(Vector3.Zero(), Vector3.Up(), 1)

  const update = (dt: number) => {
    // Cheap resync if the scene rebuilt buildings (Antigua⇄Tokyo flip changes
    // the mesh count). Comparing a single int is nearly free.
    if (scene.meshes.length !== lastSceneMeshCount) syncEligible()
    if (tracked.length === 0) return

    const p = getPlayerPos()
    // The sight-ray endpoint rides the player's ELEVATION (the walk-surface they
    // stand on). An absolute head height sent the ray from the camera DOWN through
    // the bridge deck to a ground-level "head" — fading the very deck you're
    // standing on. Sampling the deck height keeps the ray above the deck, so the
    // floor under you never dissolves. General: any raised walk-surface.
    head.set(p.x, walkSurfaceHeight(scene, p.x, p.z) + HEAD_HEIGHT, p.z)
    camPos.copyFrom(camera.globalPosition)

    // sight segment camera→head
    dir.copyFrom(head)
    dir.subtractInPlace(camPos)
    const segLen = dir.length()
    if (segLen > 1e-4) {
      dir.scaleInPlace(1 / segLen)
      ray.origin.copyFrom(camPos)
      ray.direction.copyFrom(dir)
      ray.length = segLen
    }

    // a mesh further than the cam→player segment (+ its own radius) can't be
    // between them — skip it so this stays O(near meshes) in the big streamed city.
    const reachSq = (segLen + 6) * (segLen + 6)
    for (let i = 0; i < tracked.length; i++) {
      const t = tracked[i]
      const mesh = t.mesh
      const sc = mesh.getBoundingInfo().boundingSphere.centerWorld
      const cdx = sc.x - camPos.x
      const cdz = sc.z - camPos.z
      if (cdx * cdx + cdz * cdz > reachSq) {
        if (mesh.visibility !== 1) t.target = 1 // let a now-far faded mesh restore
        continue
      }
      let occluding = false

      // (1) camera INSIDE / grazing this building's world AABB → fade it so you
      //     can see out. World matrix is frozen; bounding info is in world space.
      const bb = mesh.getBoundingInfo().boundingBox
      const min = bb.minimumWorld
      const max = bb.maximumWorld
      if (
        camPos.x >= min.x - INSIDE_SKIN &&
        camPos.x <= max.x + INSIDE_SKIN &&
        camPos.y >= min.y - INSIDE_SKIN &&
        camPos.y <= max.y + INSIDE_SKIN &&
        camPos.z >= min.z - INSIDE_SKIN &&
        camPos.z <= max.z + INSIDE_SKIN
      ) {
        occluding = true
      } else if (segLen > 1e-4) {
        // (2) does the sight ray hit this building's bbox BEFORE the head?
        //     onlyBoundingInfo → no per-triangle cost; conservative + cheap.
        const pick = ray.intersectsMesh(
          mesh,
          true /* fastCheck */,
          undefined,
          true /* onlyBoundingInfo */,
        )
        if (pick.hit && pick.distance < segLen - OCCLUDER_MARGIN) {
          occluding = true
        }
      }

      t.target = occluding ? FADED_VISIBILITY : 1
    }

    // ---- smooth each mesh toward its target (fps-compensated, no pop) ----
    const a = 1 - Math.pow(1 - FADE_LERP, Math.max(0.0001, dt) * 60)
    for (let i = 0; i < tracked.length; i++) {
      const mesh = tracked[i].mesh
      const target = tracked[i].target
      const cur = mesh.visibility
      if (cur === target) continue
      let next = cur + (target - cur) * a
      if (Math.abs(next - target) < SETTLE_EPS) next = target
      mesh.visibility = next
    }
  }

  const dispose = () => {
    for (let i = 0; i < tracked.length; i++) {
      // restore solid so a re-mount / teardown never leaves ghost-transparent
      // buildings behind.
      const mesh = tracked[i].mesh
      if (!mesh.isDisposed()) mesh.visibility = 1
    }
    tracked.length = 0
  }

  return { update, dispose }
}
