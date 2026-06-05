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
  const farTowers = mix(sky, hexC3(undefined, "#6f7e93"), 0.62) // pale, distant
  const nearTowers = mix(sky, hexC3(undefined, "#54637a"), 0.78) // a hair darker/closer

  // deterministic PRNG so the skyline is varied but stable.
  let s = (opts.seed ?? 1234) >>> 0
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)

  /** Paint one skyline layer onto a wide DynamicTexture: a run of rectangular
   *  towers of varied width/height along U, the silhouette colour below the
   *  rooflines and TRANSPARENT above, with a haze gradient lifting from the base
   *  so the feet dissolve. `baseFrac`/`maxFrac` set how tall the band of towers is
   *  within the texture (0 = top of texture/sky, 1 = bottom/horizon). */
  const paintLayer = (
    name: string,
    color: Color3,
    density: number,
    baseFrac: number,
    maxFrac: number,
  ): DynamicTexture => {
    const W = 2048
    const H = 256
    const tex = new DynamicTexture(`${tag}-${name}`, { width: W, height: H }, scene, false)
    const ctx = tex.getContext() as unknown as CanvasRenderingContext2D
    ctx.clearRect(0, 0, W, H)
    // towers: walk along U, each a rectangle from the horizon (bottom) up to a
    // random roofline. Widths/heights vary; occasional taller "landmark" towers.
    let x = 0
    const fill = css(color)
    ctx.fillStyle = fill
    while (x < W) {
      const w = 12 + rnd() * 46 * density
      const tall = rnd() < 0.12
      const hFrac = baseFrac + rnd() * (maxFrac - baseFrac) * (tall ? 1 : 0.66)
      const topY = H * (1 - hFrac)
      ctx.fillRect(x, topY, w + 1, H - topY) // +1 to avoid hairline gaps
      // a few towers get a stepped/peaked cap for variety.
      if (tall && rnd() < 0.6) {
        ctx.beginPath()
        ctx.moveTo(x, topY)
        ctx.lineTo(x + w / 2, topY - H * 0.06)
        ctx.lineTo(x + w, topY)
        ctx.closePath()
        ctx.fill()
      }
      x += w + rnd() * 8
    }
    // haze gradient at the base → the silhouette's feet melt into the fog band.
    const g = ctx.createLinearGradient(0, H * 0.7, 0, H)
    g.addColorStop(0, css(haze, 0))
    g.addColorStop(1, css(haze, 0.55))
    ctx.fillStyle = g
    ctx.fillRect(0, H * 0.7, W, H * 0.3)
    tex.update(false)
    tex.hasAlpha = true
    tex.wrapU = 1 // tile seamlessly around the ring
    return tex
  }

  /** Build one infinite-distance cylinder band wearing a painted skyline texture.
   *  Open-ended, single-sided facing INWARD (we see its inner wall), no fog, sky
   *  rendering group so it sits behind the world. */
  const band = (name: string, tex: DynamicTexture, diameter: number, height: number, yOff: number) => {
    const cyl = MeshBuilder.CreateCylinder(
      `${tag}-${name}`,
      { diameter, height, tessellation: 48, sideOrientation: Mesh.BACKSIDE, cap: 0 as 0 },
      scene,
    )
    cyl.position.y = yOff
    cyl.infiniteDistance = true // rides with the camera → pinned to the horizon
    cyl.applyFog = false
    cyl.isPickable = false
    cyl.renderingGroupId = 0 // with the sky dome, behind the world
    const mat = new StandardMaterial(`${tag}-${name}-mat`, scene)
    mat.diffuseTexture = tex
    mat.opacityTexture = tex // alpha from the painted texture
    mat.emissiveTexture = tex // flat-lit silhouette (no shading on a backdrop)
    mat.emissiveColor = new Color3(1, 1, 1)
    mat.diffuseColor = new Color3(0, 0, 0)
    mat.specularColor = new Color3(0, 0, 0)
    mat.disableLighting = true
    mat.backFaceCulling = false
    cyl.material = mat
    cyl.parent = root
    cyl.freezeWorldMatrix()
    return { cyl, mat }
  }

  // FAR layer first (drawn behind), then NEAR layer slightly smaller radius so it
  // overlaps in front. Heights/offsets place the rooflines right at the horizon
  // line of the infinite-distance projection.
  const farTex = paintLayer("far", farTowers, 1.0, 0.22, 0.5)
  const nearTex = paintLayer("near", nearTowers, 1.35, 0.3, 0.66)
  const far = band("far", farTex, 1800, 420, 40)
  const near = band("near", nearTex, 1500, 360, 26)

  return {
    root,
    dispose: () => {
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
