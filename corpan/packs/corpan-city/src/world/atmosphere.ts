import { Scene } from "@babylonjs/core/scene"
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder"
import { Mesh } from "@babylonjs/core/Meshes/mesh"
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture"
import { Texture } from "@babylonjs/core/Materials/Textures/texture"
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial"
import { Color3 } from "@babylonjs/core/Maths/math"

/**
 * applyAtmosphere — the "premium air" layer for Corpan City.
 *
 * Without touching engine.ts, this wraps a finished createWorldEngine() scene
 * in a warm, alive atmosphere that reads like a cozy pop-up diorama caught in
 * morning light:
 *
 *   • a painted sky DOME (soft vertical gradient + a low warm sun glow), drawn
 *     once to a DynamicTexture and mapped to the inside of a large sphere that
 *     rides with the camera so it never has an edge;
 *   • gentle exponential distance FOG tinted toward the sky/accent so far
 *     cutouts melt into the horizon (depth without heavy geometry);
 *   • a WARMER LIGHT RIG — it looks up the engine's "hemi"/"sun" by name and
 *     tunes them toward golden morning, then adds a soft cool RIM light from
 *     behind so paper cutouts get a luminous edge;
 *   • floating DUST MOTES — a tiny soft-additive particle system (cheap, low
 *     count) drifting in the light shaft;
 *   • a painted VIGNETTE — a fullscreen-ish inward-facing ring billboard that
 *     darkens the corners and warms the center, era-appropriate and free
 *     (no post-process pipeline required on mobile).
 *
 * Everything is cheap and feature-detected; counts scale down on low-DPR
 * phones. Returns a dispose() that removes exactly what it added.
 */

export interface Atmosphere {
  dispose: () => void
}

type Palette = Record<string, string> | undefined

/**
 * Distant-horizon look, read from `scene.sky` (contracts). All optional with
 * warm-Antigua-day defaults so the air looks finished even before a Scene
 * authors it. Mirrors the contract shape (hex strings + a 0..1 fog scaler).
 */
export interface SkyLook {
  horizon?: string // hex — lower sky / haze band at the horizon
  zenith?: string // hex — top of sky
  fog?: number // 0..1 distance-fog density scaler (1 ≈ the lean baseline)
  fogColor?: string // hex — usually ≈ horizon
  timeOfDay?: "dawn" | "day" | "dusk" | "night"
}

const hex = (s: string | undefined, fallback: string): Color3 =>
  Color3.FromHexString(s ?? fallback)

const mix = (a: Color3, b: Color3, t: number): Color3 =>
  new Color3(a.r + (b.r - a.r) * t, a.g + (b.g - a.g) * t, a.b + (b.b - a.b) * t)

const lighten = (c: Color3, t: number): Color3 => mix(c, new Color3(1, 1, 1), t)

const css = (c: Color3): string =>
  `rgb(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)})`

let auid = 0

export function applyAtmosphere(
  scene: Scene,
  palette: Palette,
  // kept in the signature for callers; the vignette (its only user) moved to CSS.
  _onFrame: (cb: (dt: number) => void) => () => void,
  /** distant-horizon look from `scene.sky` (optional; warm-day defaults). */
  skyLook?: SkyLook,
): Atmosphere {
  const tag = `wp-atmo-${auid++}`
  const disposers: Array<() => void> = []

  // Quality tier — phones (DPR-capped, small viewport) get the lean path.
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const small = Math.min(window.innerWidth, window.innerHeight) < 520
  const lean = small || dpr < 2

  const night = skyLook?.timeOfDay === "night"

  const accent = hex(palette?.accent, "#c46b4a")

  // ZENITH (top of sky) + HORIZON (haze band) drive a tall vertical gradient so
  // long sightlines read with real depth. Defaults: a deep warm-Antigua-day
  // blue overhead easing to a pale warm haze at the horizon. A Scene can flip
  // the whole hour (neon Tokyo night) just by authoring scene.sky.
  const zenith = hex(skyLook?.zenith, night ? "#0a1230" : "#5b9fd4")
  const horizonBand = hex(skyLook?.horizon, night ? "#241a3a" : "#d8ecf0")

  // Warm "morning" key colour derived from the accent — drives sun glow, fog,
  // rim light and vignette so the whole air reads as one coherent hour.
  const warm = lighten(mix(accent, new Color3(1, 0.86, 0.62), 0.45), 0.12)

  // ---------------------------------------------------------------- sky dome
  {
    const size = 512
    const tex = new DynamicTexture(`${tag}-sky`, { width: size, height: size }, scene, true)
    const ctx = tex.getContext() as unknown as CanvasRenderingContext2D

    // ZENITH overhead → a soft mid sky → HORIZON haze band where distant
    // geometry melts in. Authored (or warm-day defaults). The bottom of the
    // texture maps to the horizon line, so the haze sits exactly where the fog
    // dissolves the far map — one coherent depth cue.
    const midSky = mix(zenith, horizonBand, 0.5)
    const haze = mix(horizonBand, warm, night ? 0.12 : 0.32)

    const grad = ctx.createLinearGradient(0, 0, 0, size)
    grad.addColorStop(0, css(zenith))
    grad.addColorStop(0.5, css(midSky))
    grad.addColorStop(0.78, css(lighten(horizonBand, night ? 0 : 0.12)))
    grad.addColorStop(1, css(haze))
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, size, size)

    // low warm sun glow (or a cool neon city-glow at night), sitting toward the
    // horizon band so the light source agrees with the fog colour.
    const sx = size * 0.32
    const sy = size * 0.78
    const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, size * 0.42)
    if (night) {
      glow.addColorStop(0, "rgba(180,140,255,0.55)")
      glow.addColorStop(0.22, "rgba(140,120,230,0.32)")
      glow.addColorStop(0.55, "rgba(110,100,200,0.1)")
      glow.addColorStop(1, "rgba(110,100,200,0)")
    } else {
      glow.addColorStop(0, "rgba(255,246,224,0.95)")
      glow.addColorStop(0.18, "rgba(255,238,200,0.6)")
      glow.addColorStop(0.5, "rgba(255,226,180,0.18)")
      glow.addColorStop(1, "rgba(255,226,180,0)")
    }
    ctx.fillStyle = glow
    ctx.fillRect(0, 0, size, size)

    // a couple of soft paper clouds (kept faint so they never distract). At
    // night the sky stays clean (city haze, no white daytime puffs).
    if (!night) {
      ctx.globalAlpha = 0.5
      ctx.fillStyle = "rgba(255,255,255,0.9)"
      const cloud = (cx: number, cy: number, s: number) => {
        ctx.beginPath()
        ctx.ellipse(cx, cy, s, s * 0.5, 0, 0, Math.PI * 2)
        ctx.ellipse(cx + s * 0.7, cy + s * 0.08, s * 0.7, s * 0.4, 0, 0, Math.PI * 2)
        ctx.ellipse(cx - s * 0.7, cy + s * 0.1, s * 0.6, s * 0.36, 0, 0, Math.PI * 2)
        ctx.fill()
      }
      cloud(size * 0.7, size * 0.28, size * 0.07)
      cloud(size * 0.18, size * 0.2, size * 0.055)
      ctx.globalAlpha = 1
    }
    tex.update()
    tex.wrapU = Texture.CLAMP_ADDRESSMODE
    tex.wrapV = Texture.CLAMP_ADDRESSMODE

    const dome = MeshBuilder.CreateSphere(
      `${tag}-dome`,
      { diameter: 400, segments: 16, sideOrientation: Mesh.BACKSIDE },
      scene,
    )
    const mat = new StandardMaterial(`${tag}-dome-mat`, scene)
    mat.diffuseColor = new Color3(0, 0, 0)
    mat.emissiveTexture = tex
    mat.disableLighting = true
    mat.backFaceCulling = false
    mat.specularColor = new Color3(0, 0, 0)
    dome.material = mat
    dome.infiniteDistance = true // rides with the camera; no visible edge
    dome.isPickable = false
    dome.applyFog = false
    dome.renderingGroupId = 0

    disposers.push(() => {
      dome.dispose()
      mat.dispose()
      tex.dispose()
    })
  }

  // ---------------------------------------------------------------------- fog
  {
    const prevMode = scene.fogMode
    const prevColor = scene.fogColor?.clone?.()
    const prevDensity = scene.fogDensity
    scene.fogMode = Scene.FOGMODE_EXP2
    // Fog colour ≈ the horizon haze band so far geometry melts into the SKY at
    // the horizon line (no hard cut). Authored fogColor wins; else derive from
    // the horizon band (warmed slightly by day).
    scene.fogColor = skyLook?.fogColor
      ? hex(skyLook.fogColor, "#d8ecf0")
      : night
        ? mix(horizonBand, zenith, 0.3)
        : lighten(mix(horizonBand, warm, 0.32), 0.1)
    // EXP2 density tuned for the LARGER, relaxed map: distance fog should reveal
    // long sightlines (the landmark stays visible) yet still haze the far edge.
    // `scene.sky.fog` (0..1) scales the baseline; 1 ≈ baseline, lower = clearer.
    const fogScale = skyLook?.fog ?? 1
    // Deeper EXP2 haze (was 0.0075/0.009): the chunk load boundary (~107u, stream.ts
    // visibilityRadius 165) now sits at ~85% fog, so streamed geometry EMERGES from
    // atmospheric depth instead of hard-popping into clear view — premium distance,
    // not a snap. Long landmark sightlines survive (EXP2 falls off gently up close).
    scene.fogDensity = (lean ? 0.011 : 0.013) * fogScale
    disposers.push(() => {
      scene.fogMode = prevMode ?? Scene.FOGMODE_NONE
      if (prevColor) scene.fogColor = prevColor
      scene.fogDensity = prevDensity ?? 0.1
    })
  }

  // ---------------------------------------------------------------- light rig
  // ALL lighting now lives in the CINEMATIC PIPELINE (render/pipeline.ts): the
  // warm KEY sun (the shadow source), the cool sky FILL, and the IBL ambient.
  // Atmosphere owns ONLY the sky-dome + fog mood (above).
  //
  // The old back-RIM DirectionalLight that lived here is REMOVED — not just for
  // tidiness: a third directional light added AFTER the cinematic ShadowGenerator
  // forced a material recompile that DROPPED the shadow sampler from receivers,
  // so the sun's contact shadows silently stopped landing on the ground (verified
  // by bisection: removing the rim restores shadows). The cinematic key + cool
  // hemispheric fill + IBL already give cutouts their luminous edge, so the rim
  // is redundant as well as harmful. Do NOT re-add a stray light here.

  // Dust motes REMOVED (2026-06-03): the additive sparkle volume over the plaza
  // read as gimmicky/distracting and "didn't add to the scene" (owner). HD-2D
  // atmosphere should come from the sky/fog/light, not floating glints. If we
  // ever want ambient motes, they must be FAR subtler (very low count, low alpha,
  // no additive blend) — not a bright cloud at the plaza centre.

  // ----------------------------------------------------------------- vignette
  // The vignette is now a SCREEN-SPACE CSS layer (`.wp-vignette` in game.ts /
  // styles.css), welded to the viewport. The old world-space camera quad that
  // lived here lagged the camera by a frame and visibly jerked toward center
  // during movement — a screen-edge effect must never be a world object. Removed.

  return {
    dispose: () => {
      // dispose in reverse add order
      for (let i = disposers.length - 1; i >= 0; i--) disposers[i]()
    },
  }
}
