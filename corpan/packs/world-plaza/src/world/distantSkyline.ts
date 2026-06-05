import type { Scene as BabylonScene } from "@babylonjs/core/scene"
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder"
import { Mesh } from "@babylonjs/core/Meshes/mesh"
import { TransformNode } from "@babylonjs/core/Meshes/transformNode"
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture"
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial"
import { Color3 } from "@babylonjs/core/Maths/math"

/**
 * distantSkyline.ts — the DISTANT CITY SILHOUETTE at the horizon (env-art, task
 * #32 crafted world edge).
 *
 * When the player reaches the world edge — the river/sea or a land gate — the
 * eye should land on a hazy SKYLINE that says "the world continues into a great
 * metropolis", never a hard wall of fog or a bare horizon. This rings the world
 * with a layered, painted city silhouette that sits at the horizon and melts up
 * into the sky.
 *
 * HOW. Two concentric `infiniteDistance` CYLINDER bands (open-ended, normals
 * inward) painted with a layered skyline:
 *   • a FAR layer — a pale, low, hazy ridge of towers (reads as "miles off");
 *   • a NEAR layer — a slightly taller, warmer, more detailed silhouette in
 *     front of it (parallax-free but the two depths still read as depth via tone).
 * Both ride with the camera (`infiniteDistance`), so they have NO edge and stay
 * pinned to the horizon however the player moves — exactly the sky-dome trick
 * atmosphere.ts uses. Each band's texture fades to TRANSPARENT at the top (into
 * the sky) and carries a soft haze gradient at its base so the silhouette's feet
 * dissolve into the distance-fog band — it never looks like a cardboard cut-out
 * standing on the water.
 *
 * PERF: two cylinders + two painted DynamicTextures, FROZEN, drawn in the sky
 * rendering group behind everything. No per-frame cost (no update). Additive +
 * bounded (own create/dispose, like atmosphere.ts / cityWall.ts); never touches
 * the streaming spine. It is pure backdrop.
 */

export interface DistantSkyline {
  root: TransformNode
  dispose: () => void
}

export interface DistantSkylineOptions {
  palette?: Record<string, string>
  /** seed so the skyline shape is varied but stable per world. */
  seed?: number
}

const hexC3 = (hex: string | undefined, fallback: string): Color3 =>
  Color3.FromHexString(hex ?? fallback)
const mix = (a: Color3, b: Color3, t: number): Color3 =>
  new Color3(a.r + (b.r - a.r) * t, a.g + (b.g - a.g) * t, a.b + (b.b - a.b) * t)
const css = (c: Color3, a = 1) =>
  `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${a})`

let suid = 0

export function buildDistantSkyline(scene: BabylonScene, opts: DistantSkylineOptions = {}): DistantSkyline {
  const tag = `wp-skyline-${suid++}`
  const root = new TransformNode(`${tag}-root`, scene)

  // Horizon/haze hue from the sky so the silhouette belongs to the air. The towers
  // tint toward a cool, desaturated far-city grey-blue; the near layer is a touch
  // warmer so the two depths separate without colour clashing with the town.
  const sky = hexC3(opts.palette?.sky, "#cfe6ea")
  const haze = mix(sky, new Color3(1, 1, 1), 0.18)
  // The towers must PUNCH THROUGH the warm distance-haze, so they lean well toward
  // a cool, saturated slate — a pale wash would vanish into the fog band. Far is
  // softer (more sky mixed in), near is markedly darker so the two depths read.
  const farTowers = mix(sky, hexC3(undefined, "#566377"), 0.74) // muted far ridge
  const nearTowers = mix(sky, hexC3(undefined, "#3c4759"), 0.92) // dark near ridge

  // deterministic PRNG so the skyline is varied but stable.
  let s = (opts.seed ?? 1234) >>> 0
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)

  /** Paint one skyline layer onto a wide DynamicTexture. The HORIZON line is the
   *  texture's vertical MIDDLE (V=0.5): towers rise ABOVE it (toward V=0, the sky)
   *  and a soft haze band sits just below it, everything else transparent. Mapped
   *  1:1 onto the cylinder this lands the towers' feet exactly at the horizon. The
   *  top of each tower fades toward the sky; the base dissolves into haze so it
   *  never reads as a cardboard cut-out. `riseFrac` = max tower height as a
   *  fraction of the half-texture above the horizon. */
  const paintLayer = (name: string, color: Color3, density: number, riseFrac: number): DynamicTexture => {
    const W = 2048
    const H = 512
    const horizon = H * 0.5
    const tex = new DynamicTexture(`${tag}-${name}`, { width: W, height: H }, scene, false)
    const ctx = tex.getContext() as unknown as CanvasRenderingContext2D
    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = css(color)
    // towers: each a rectangle from the horizon UP to a random roofline.
    let x = 0
    while (x < W) {
      const w = 14 + rnd() * 52 * density
      const tall = rnd() < 0.14
      const rise = horizon * riseFrac * (0.4 + rnd() * 0.6) * (tall ? 1.4 : 1)
      const topY = horizon - rise
      ctx.fillRect(x, topY, w + 1, horizon - topY + 2) // up to (just past) the horizon
      // a few towers get a peaked/stepped cap for variety.
      if (tall && rnd() < 0.6) {
        ctx.beginPath()
        ctx.moveTo(x, topY)
        ctx.lineTo(x + w / 2, topY - horizon * 0.12)
        ctx.lineTo(x + w, topY)
        ctx.closePath()
        ctx.fill()
      }
      x += w + rnd() * 10
    }
    // soft haze band just BELOW the horizon so the silhouette's feet melt into the
    // distance fog (then transparent further down). Above the towers stays clear.
    const g = ctx.createLinearGradient(0, horizon - 4, 0, horizon + H * 0.16)
    g.addColorStop(0, css(haze, 0.5))
    g.addColorStop(1, css(haze, 0))
    ctx.fillStyle = g
    ctx.fillRect(0, horizon - 4, W, H * 0.16 + 4)
    tex.update(false)
    tex.hasAlpha = true
    tex.wrapU = 1 // tile seamlessly around the ring
    return tex
  }

  /** Build one skyline-band cylinder at a real far RADIUS (just inside the camera
   *  far-clip, beyond the buildable world). It is RE-CENTERED on the camera in X/Z
   *  every frame so it never shows an edge and always rings the horizon, while
   *  keeping REAL depth — so it draws OVER the (infinite-distance) sky dome and is
   *  correctly OCCLUDED by nearer buildings. Open-ended, inward-facing, fog OFF
   *  (the painted haze blends the feet). The texture is V-flipped so the towers
   *  rise ABOVE the cylinder's vertical centre (= the camera's eye level). */
  const band = (name: string, tex: DynamicTexture, radius: number, height: number, alphaIndex: number) => {
    const cyl = MeshBuilder.CreateCylinder(
      `${tag}-${name}`,
      { diameter: radius * 2, height, tessellation: 80, sideOrientation: Mesh.BACKSIDE, cap: 0 as 0 },
      scene,
    )
    cyl.applyFog = false
    cyl.isPickable = false
    cyl.renderingGroupId = 0
    cyl.alphaIndex = alphaIndex // far band before near band
    const mat = new StandardMaterial(`${tag}-${name}-mat`, scene)
    mat.diffuseTexture = tex
    mat.opacityTexture = tex
    mat.emissiveTexture = tex
    mat.emissiveColor = new Color3(1, 1, 1)
    mat.diffuseColor = new Color3(0, 0, 0)
    mat.specularColor = new Color3(0, 0, 0)
    mat.disableLighting = true
    mat.backFaceCulling = false
    // Babylon cylinder V=0 at the BOTTOM. Our texture paints towers in the upper
    // rows (above the horizon at row H/2). Empirically the unflipped mapping lands
    // the towers BELOW the horizon, so FLIP V → towers rise above eye level.
    tex.vScale = -1
    tex.vOffset = 1
    cyl.material = mat
    cyl.parent = root
    return { cyl, mat }
  }

  // FAR layer (bigger, behind) + NEAR layer (smaller, in front, taller/darker).
  // Radii sit just inside the engine far-clip (game maxZ≈380) but beyond the world
  // footprint, so the bands clear the buildings yet never get clipped away.
  // The cylinder spans a modest vertical band so the texture maps compactly
  // around the horizon (a tall cylinder spreads the towers over a huge range).
  // At radius ~365 and height ~150, the towers subtend a believable far-city
  // height. Centre Y is set per-band so the texture's horizon lands at EYE.
  const EYE = 1.6
  const farTex = paintLayer("far", farTowers, 1.0, 0.66)
  const nearTex = paintLayer("near", nearTowers, 1.4, 0.86)
  const far = band("far", farTex, 372, 150, 0)
  const near = band("near", nearTex, 360, 140, 1)

  // ── camera-follow: recentre the bands on the camera in X/Z each frame so the
  // skyline has no edge and always rings the horizon; Y stays fixed (eye height)
  // so the horizon never bobs. Two cheap position writes per frame. ──
  let cb: (() => void) | null = () => {
    const cam = scene.activeCamera
    if (!cam) return
    const p = cam.position
    far.cyl.position.set(p.x, EYE, p.z)
    near.cyl.position.set(p.x, EYE, p.z)
  }
  scene.registerBeforeRender(cb)

  return {
    root,
    dispose: () => {
      if (cb) {
        scene.unregisterBeforeRender(cb)
        cb = null
      }
      far.cyl.dispose()
      near.cyl.dispose()
      far.mat.dispose()
      near.mat.dispose()
      farTex.dispose()
      nearTex.dispose()
      root.dispose()
    },
  }
}
