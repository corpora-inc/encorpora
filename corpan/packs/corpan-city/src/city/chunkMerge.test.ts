// @vitest-environment happy-dom
// (MaterialLibrary bakes PBR textures into a <canvas> — needs a DOM.)
import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { NullEngine } from "@babylonjs/core/Engines/nullEngine"
import { Scene } from "@babylonjs/core/scene"
import "@babylonjs/core/Meshes/thinInstanceMesh"
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera"
import { Vector3 } from "@babylonjs/core/Maths/math"
import { MaterialLibrary } from "../render/materials"
import { createCityCache } from "./cityCache"
import { buildChunkMesh } from "./chunkMesh"
import { createCameraFade } from "../world/cameraFade"
import { isFadeEligible } from "../world/cameraOcclusion"
import type { CityChunk } from "./layout"
import { chunkKey } from "./layout"

/**
 * chunkMerge.test — proves the chunk-level building-detail MERGE PASS
 * (chunkMesh.beginChunkMesh stage 2) actually collapses the per-building detail
 * meshes into ONE combined mesh per (class, material) group, and leaves NO
 * individual roof cap / door step / contact shadow behind. This is the draw-call
 * win that lets the city scale, so it's worth a deterministic guard.
 *
 * We build a chunk with several buildings under a NullEngine (no GPU), then walk
 * the scene's enabled meshes and assert:
 *   • there are `wp-r-merged-…`, `wp-st-merged-…`, `wp-sh-merged-…` combined meshes;
 *   • ZERO un-merged per-building `wp-r-<id>` / `wp-st-<id>` / `wp-sh-<id>` survive;
 *   • the merged ROOF stays a `wp-r-` name (the shadow/camera-occlusion systems key
 *     off that prefix — merging must not break the silhouette caster contract);
 *   • the merged geometry carries real vertices (it isn't an empty husk).
 */

let engine: NullEngine
let scene: Scene
let lib: MaterialLibrary

/**
 * happy-dom ships a `<canvas>` whose 2D context is a thin stub (no real raster).
 * The building/material bake only PAINTS into that context — the geometry +
 * mesh merge we're testing don't read pixels back — so a no-op 2D context lets
 * the real build path run headlessly. We install a permissive Proxy-backed stub
 * so every canvas call (fillRect, drawImage, gradients, …) is a silent no-op.
 */
function installCanvasStub() {
  const ctx2d = new Proxy(
    {},
    {
      get: (_t, prop) => {
        if (prop === "canvas") return { width: 1, height: 1 }
        if (prop === "createLinearGradient" || prop === "createRadialGradient")
          return () => ({ addColorStop: () => {} })
        if (prop === "getImageData") return () => ({ data: new Uint8ClampedArray(4) })
        if (prop === "measureText") return () => ({ width: 0 })
        return () => {}
      },
      set: () => true,
    },
  )
  const proto = (globalThis as { HTMLCanvasElement?: { prototype: { getContext: unknown } } })
    .HTMLCanvasElement?.prototype
  if (proto) proto.getContext = () => ctx2d as unknown as CanvasRenderingContext2D
}

beforeEach(() => {
  installCanvasStub()
  engine = new NullEngine()
  scene = new Scene(engine)
  lib = new MaterialLibrary(scene, undefined, { texSize: 64, mips: false })
})

afterEach(() => {
  scene.dispose()
  engine.dispose()
})

function chunkWithBuildings(n: number): CityChunk {
  const buildings = []
  for (let i = 0; i < n; i++) {
    buildings.push({ x: i * 14, z: 0, w: 8, d: 8, kind: "house", door: { x: i * 14, z: 5 } })
  }
  return {
    gx: 0,
    gz: 0,
    key: chunkKey(0, 0),
    bounds: { minX: -10, maxX: n * 14 + 10, minZ: -10, maxZ: 20 },
    zone: "residential",
    buildings,
    props: [],
    ground: [],
    anchors: [],
    water: [],
    walls: [],
    landKind: "land",
    district: "uptown",
  }
}

describe("chunk building-detail merge pass", () => {
  it("collapses same-material roof/step/shadow groups; leaves no per-building originals", () => {
    const cache = createCityCache(scene, lib)
    const chunk = chunkWithBuildings(5)
    const mesh = buildChunkMesh(scene, chunk, { cache, lib, baseSurface: "dirt" })

    const enabled = scene.meshes.filter((m) => m.isEnabled())
    const names = enabled.map((m) => m.name)

    // combined meshes exist, one per merged class (5 buildings → 1 roof, 1 step,
    // 1 shadow combined mesh — all houses share roof/stone/shadow materials).
    const merged = (cls: string) => names.filter((nm) => nm.startsWith(`${cls}-merged-`))
    expect(merged("wp-r").length).toBe(1)
    expect(merged("wp-st").length).toBe(1)
    expect(merged("wp-sh").length).toBe(1)

    // and NONE of the per-building originals (wp-r-<num>, wp-st-<num>, wp-sh-<num>)
    // survive — the merge disposed every source it folded in.
    const survivingOriginals = names.filter((nm) => /^wp-(r|st|sh)-\d/.test(nm))
    expect(survivingOriginals).toEqual([])

    // the combined roof carries real geometry (not an empty husk).
    const roof = enabled.find((m) => m.name.startsWith("wp-r-merged-"))!
    expect(roof.getTotalVertices()).toBeGreaterThan(0)

    // the per-building merged BODIES are still one-per-building (unique facades).
    expect(names.filter((nm) => nm.startsWith("wp-building-")).length).toBe(5)

    mesh.dispose()
    cache.dispose()
  })

  it("a real LOW building roof drapes over the player → it fades (#59 roof-hides-player)", () => {
    // The owner's repeated report: a building ROOF hides the player and won't go
    // transparent. We build a REAL low building (a `chapel` → a ~4u flat cap, the
    // height a roof actually drapes over the standing 2.6u figure), put the player
    // UNDER the roof's footprint with the camera in front + low (the follow rig),
    // and assert the roof DISSOLVES. This is the literal failing scene: the roof
    // covers the player's upper silhouette but sits above the old single 1.6u head
    // ray, so it never registered as an occluder. The crown ray (#59) catches it.
    const cache = createCityCache(scene, lib)
    const roofChunk: CityChunk = {
      ...chunkWithBuildings(1),
      buildings: [{ x: 0, z: 0, w: 8, d: 8, kind: "chapel", door: { x: 0, z: 5 } }],
    }
    const mesh = buildChunkMesh(scene, roofChunk, { cache, lib, baseSurface: "dirt" })

    // the single building's roof cap (un-merged with n=1; same `wp-r-` prefix +
    // 0.2u cap the merge produces, so it exercises the same predicate + fade path).
    const roof = scene.meshes.find((m) => /^wp-r(-merged)?-/.test(m.name))!
    expect(roof, "a roof cap exists").toBeTruthy()
    expect(isFadeEligible(roof), "the low roof cap must be fade-eligible").toBe(true)

    // player tucked UNDER the roof footprint (z=-2, the roof spans z≈[-4.2,4.2] at
    // y≈4.3); camera in FRONT + low (the cruise rig height). The roof is squarely
    // over the player's crown but above the 1.6u head point.
    const px = 0
    const pz = -2
    const cam = new FreeCamera("cam", new Vector3(px, 6.0, 8.0), scene)
    cam.setTarget(new Vector3(px, 2.0, pz))
    const fade = createCameraFade(scene, cam, () => ({ x: px, z: pz }))

    cam.computeWorldMatrix()
    for (const m of scene.meshes) m.computeWorldMatrix(true)
    if (typeof roof.refreshBoundingInfo === "function") roof.refreshBoundingInfo({ applySkeleton: true })
    for (let i = 0; i < 240; i++) fade.update(0.016)

    expect(
      roof.visibility,
      "a roof draped over the player's silhouette must fade (owner's roof-hides-player bug)",
    ).toBeLessThan(0.5)

    fade.dispose()
    mesh.dispose()
    cache.dispose()
  })

  it("disposes cleanly with no leaked enabled meshes (merge + originals all freed)", () => {
    const cache = createCityCache(scene, lib)
    const chunk = chunkWithBuildings(4)
    const before = scene.meshes.length
    const mesh = buildChunkMesh(scene, chunk, { cache, lib, baseSurface: "dirt" })
    expect(scene.meshes.length).toBeGreaterThan(before)
    mesh.dispose()
    // every chunk-owned mesh (bodies, merged roof/step/shadow, ground) is gone;
    // only the cache's hidden masters / shared materials remain (not chunk meshes).
    const leaked = scene.meshes.filter(
      (m) => m.name.includes("-merged-") || m.name.startsWith("wp-building-"),
    )
    expect(leaked).toEqual([])
    cache.dispose()
  })
})
