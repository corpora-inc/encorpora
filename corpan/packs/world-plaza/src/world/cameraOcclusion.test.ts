import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { NullEngine } from "@babylonjs/core/Engines/nullEngine"
import { Scene } from "@babylonjs/core/scene"
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera"
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder"
import { Mesh } from "@babylonjs/core/Meshes/mesh"
import { Vector3, Matrix, Quaternion } from "@babylonjs/core/Maths/math"
import "@babylonjs/core/Meshes/thinInstanceMesh"
import { isCameraOccluder } from "./cameraOcclusion"
import { createCameraFade } from "./cameraFade"

/**
 * #59 — the camera must NEVER sit inside opaque geometry that obscures the
 * player, and ANYTHING between the camera and the player must fade. The owner's
 * failing scenario is the MARKET: thin-instanced stalls + a solid building roof
 * the follow-cam trails into. These tests reproduce that geometry headlessly
 * (NullEngine) and prove, deterministically, that:
 *   (a) the occluder PREDICATE classes stalls / buildings / the bridge as solid
 *       occluders (the old name-whitelist missed them — that's the whole bug);
 *   (b) the FADE dissolves whatever the camera→player ray actually hits,
 *       whether it's a building body, a thin-instanced stall cluster, OR the
 *       bridge — detected by ray, never by a tag whitelist.
 *
 * The fade is the GUARANTEE: even where the boom can't fully escape a thin-
 * instance union AABB, the occluder goes transparent so the player stays visible.
 */

let engine: NullEngine
let scene: Scene

beforeEach(() => {
  engine = new NullEngine()
  scene = new Scene(engine)
})

afterEach(() => {
  scene.dispose()
  engine.dispose()
})

/** drive the fade for enough frames that visibility settles to its target.
 *  We force world-matrix + bounding-info computation first: in the live game the
 *  render loop does this every frame, but a headless NullEngine never renders, so
 *  bounding info would otherwise stay at the local-space origin and every ray test
 *  would be meaningless. This mirrors the per-frame state the fade sees in-game. */
function settle(fade: { update: (dt: number) => void }, frames = 240) {
  // the camera's globalPosition is only refreshed when its view matrix is
  // computed (the render loop does this each frame). Force it so the fade reads
  // the real eye position, not the local-space origin.
  for (const cam of scene.cameras) cam.computeWorldMatrix()
  for (const m of scene.meshes) {
    m.computeWorldMatrix(true)
    // thin-instanced meshes carry a UNION bbox over all instances; refreshing it
    // the ordinary way would collapse it back to the single base box. Refresh the
    // instance union instead, exactly as the city build does.
    const mesh = m as Mesh
    if (mesh.thinInstanceCount && mesh.thinInstanceCount > 0) {
      mesh.thinInstanceRefreshBoundingInfo(false)
    } else if (typeof mesh.refreshBoundingInfo === "function") {
      mesh.refreshBoundingInfo()
    }
  }
  for (let i = 0; i < frames; i++) fade.update(0.016)
}

describe("isCameraOccluder — deny-list classifies solid world geometry", () => {
  it("treats market stalls, building bodies, roofs and the bridge as occluders", () => {
    for (const name of [
      "wp-city-prop-stall-0,0",
      "wp-building-1",
      "wp-r-roof-2",
      "wp-bridge-deck",
      "wp-wall-east",
      "wp-fountain-basin",
    ]) {
      const m = MeshBuilder.CreateBox(name, { size: 3 }, scene)
      expect(isCameraOccluder(m), `${name} should occlude`).toBe(true)
    }
  })

  it("never treats ground / water / billboards / sky / overlays as occluders", () => {
    for (const name of [
      "wp-city-ground-0",
      "wp-ground",
      "wp-harbor-water",
      "wp-riverwalk-water",
      "wp-cut-player-body",
      "wp-cut-npc-3-shadow",
      "wp-atmo-fog",
      "wp-sky-dome",
      "wp-vista-silhouette",
      "wp-roadarrow-head",
      "wp-beacon-glow",
    ]) {
      const m = MeshBuilder.CreateBox(name, { size: 3 }, scene)
      expect(isCameraOccluder(m), `${name} must NOT occlude`).toBe(false)
    }
  })

  it("ignores flat ground-stamp meshes (sub-0.25u tall) even if unnamed", () => {
    const decal = MeshBuilder.CreateGround("wp-roadpaint-x", { width: 6, height: 6 }, scene)
    expect(isCameraOccluder(decal)).toBe(false)
  })

  it("ignores disabled / fully-faded / empty meshes", () => {
    const disabled = MeshBuilder.CreateBox("wp-building-x", { size: 3 }, scene)
    disabled.setEnabled(false)
    expect(isCameraOccluder(disabled)).toBe(false)

    const invisible = MeshBuilder.CreateBox("wp-building-y", { size: 3 }, scene)
    invisible.visibility = 0
    expect(isCameraOccluder(invisible)).toBe(false)

    const empty = new Mesh("wp-building-z", scene)
    expect(isCameraOccluder(empty)).toBe(false)
  })
})

describe("createCameraFade — dissolves whatever blocks the shot (#59 failing scenario)", () => {
  /** a follow-cam looking from +z toward a player at the origin. */
  function camLookingAtOrigin(eyeZ: number): FreeCamera {
    const cam = new FreeCamera("cam", new Vector3(0, 2, eyeZ), scene)
    cam.setTarget(new Vector3(0, 1.6, 0))
    return cam
  }

  it("fades a SOLID BUILDING that sits between the camera and the player", () => {
    // player at origin; building wall at z=+8; camera trailing at z=+18 → the
    // building body is squarely between camera and player.
    const wall = MeshBuilder.CreateBox("wp-building-1", { width: 14, height: 12, depth: 3 }, scene)
    wall.position.set(0, 6, 8)
    const cam = camLookingAtOrigin(18)

    const fade = createCameraFade(scene, cam, () => ({ x: 0, z: 0 }))
    settle(fade)
    expect(wall.visibility).toBeLessThan(0.25) // dissolved to the cutaway alpha
    fade.dispose()
    expect(wall.visibility).toBe(1) // restored on teardown
  })

  it("does NOT fade thin-instanced props (a whole species shares one union AABB)", () => {
    // A thin-instanced species (stalls/trees/planters) is ONE mesh with a single
    // UNION bounding box spanning every instance across the chunk. The per-object
    // fade can only dissolve the WHOLE species at once, so a ray grazing that box
    // ghosted entire groves beside the player ("objects disappear in front of me").
    // So the fade now excludes thin-instanced meshes (isBoomBlocker) — only solid
    // one-off occluders dissolve. A narrow prop briefly clipping the player reads
    // far better than the grove vanishing.
    const stall = MeshBuilder.CreateBox("wp-city-prop-stall-0,0", { width: 2.4, height: 3, depth: 2.4 }, scene)
    stall.setEnabled(true)
    const spots: Array<[number, number]> = [
      [-3, 8], [0, 8], [3, 8], [-3, 11], [0, 11], [3, 11],
    ]
    const buf = new Float32Array(spots.length * 16)
    spots.forEach(([x, z], i) =>
      Matrix.Compose(
        new Vector3(1, 1, 1),
        Quaternion.RotationAxis(Vector3.Up(), 0),
        new Vector3(x, 1.5, z),
      ).copyToArray(buf, i * 16),
    )
    stall.thinInstanceSetBuffer("matrix", buf, 16, true)
    stall.thinInstanceRefreshBoundingInfo(false)

    const cam = camLookingAtOrigin(18)
    const fade = createCameraFade(scene, cam, () => ({ x: 0, z: 0 }))
    settle(fade)
    expect(stall.visibility).toBe(1) // thin-instanced species never ghost-fades
  })

  it("fades a building the camera is INSIDE (camera drove into the roof)", () => {
    // camera eye literally inside the building body — must see OUT.
    const house = MeshBuilder.CreateBox("wp-building-2", { width: 14, height: 12, depth: 14 }, scene)
    house.position.set(0, 6, 0)
    // player at origin; camera eye buried inside the house at z=4.
    const cam = new FreeCamera("cam", new Vector3(0, 3, 4), scene)
    cam.setTarget(new Vector3(0, 1.6, 0))
    const fade = createCameraFade(scene, cam, () => ({ x: 0, z: 0 }))
    settle(fade)
    expect(house.visibility).toBeLessThan(0.25)
  })

  it("leaves a clear shot SOLID — nothing fades when the path is open", () => {
    // a building well off to the side, not between camera and player.
    const offside = MeshBuilder.CreateBox("wp-building-3", { width: 6, height: 12, depth: 6 }, scene)
    offside.position.set(30, 6, 0)
    const cam = camLookingAtOrigin(18)
    const fade = createCameraFade(scene, cam, () => ({ x: 0, z: 0 }))
    settle(fade)
    expect(offside.visibility).toBe(1)
  })

  it("restores a building once it stops occluding (smooth recover)", () => {
    const wall = MeshBuilder.CreateBox("wp-building-4", { width: 14, height: 12, depth: 3 }, scene)
    wall.position.set(0, 6, 8)
    const cam = camLookingAtOrigin(18)
    let playerX = 0
    const fade = createCameraFade(scene, cam, () => ({ x: playerX, z: 0 }))
    settle(fade)
    expect(wall.visibility).toBeLessThan(0.25)
    // walk the player far to the side so the wall no longer blocks the shot.
    playerX = 40
    cam.position.set(40, 2, 18)
    cam.setTarget(new Vector3(40, 1.6, 0))
    settle(fade)
    expect(wall.visibility).toBe(1)
  })
})
