import type { Scene } from "@babylonjs/core/scene"
import type { Camera } from "@babylonjs/core/Cameras/camera"
import { Color3, Vector3 } from "@babylonjs/core/Maths/math"
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight"
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight"
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator"
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent"
import { RawCubeTexture } from "@babylonjs/core/Materials/Textures/rawCubeTexture"
import { Texture } from "@babylonjs/core/Materials/Textures/texture"
import { Constants } from "@babylonjs/core/Engines/constants"
import { DefaultRenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline"
// side-effect: registers the PostProcessRenderPipelineManager on the scene (the
// tree-shaken `.pure` build strips it, which crashes DefaultRenderingPipeline).
import "@babylonjs/core/PostProcesses/RenderPipeline/postProcessRenderPipelineManagerSceneComponent"
import { ImageProcessingConfiguration } from "@babylonjs/core/Materials/imageProcessingConfiguration"
import { SSAO2RenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/ssao2RenderingPipeline"
// side-effect: SSAO2 depends on the geometry buffer renderer + depth renderer.
import "@babylonjs/core/Rendering/geometryBufferRendererSceneComponent"
import "@babylonjs/core/Rendering/prePassRendererSceneComponent"
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh"

/**
 * render/pipeline.ts — World Plaza's CINEMATIC RENDERING rig.
 *
 * This is the single biggest lever between "flat 2010 prototype" and "premium,
 * lovingly-lit game." It layers, on top of a finished `createWorldEngine` scene,
 * everything that makes light read as REAL:
 *
 *   1. A LIGHTING RIG tuned to GOLDEN HOUR — a warm directional KEY (the sun)
 *      raking low across the town, a cool sky FILL (hemispheric) so shadows stay
 *      luminous (not black), and a faint ambient floor so nothing crushes.
 *   2. CONTACT-HARDENING SHADOWS from the sun via a `ShadowGenerator` with a
 *      blur-exponential / PCF kernel. The shadow frustum is kept TIGHT around the
 *      player (the light re-centers each frame) so a single modest shadow map
 *      covers the streamed city at full quality without paying for the whole map.
 *      Other systems opt MESHES in as casters via `registerShadowCaster`.
 *   3. IMAGE-BASED LIGHTING — a small procedural gradient environment cube so PBR
 *      surfaces (characters, opt-in materials) pick up real ambient + a soft sky
 *      reflection instead of reading flat. Tiny (16² faces), no asset download.
 *   4. A `DefaultRenderingPipeline` — ACES tone-mapping, a gentle exposure /
 *      contrast / vignette image-processing pass, tasteful BLOOM on highlights,
 *      and FXAA. This is the "color grade" that gives the HD-2D / Octopath warmth.
 *   5. Optional SSAO2 (contact occlusion in the crevices) — gated behind a perf
 *      tier check so phones never pay for it.
 *
 * EVERYTHING is data-driven by a `TimeOfDay` mood so the hour can change later
 * (dawn / golden / day / dusk) with one call; the default is a gorgeous GOLDEN
 * key — the single most "premium" mood.
 *
 * OWNERSHIP / SEAMS. The pipeline OWNS the sun + fill + ambient lights, the
 * shadow generator, the environment texture, and the post pipeline. It exposes
 * `registerShadowCaster(mesh)` and `getShadowGenerator()` so the city + character
 * systems opt their meshes in (engine.ts re-exports these so callers never reach
 * in here). `update(playerPos)` re-centers the shadow frustum each frame; the
 * engine drives it from the render loop.
 */

export type TimeOfDayName = "dawn" | "golden" | "day" | "dusk"

export interface TimeOfDayMood {
  /** sun direction (FROM the sun TOWARD the scene); low + raking for long shadows. */
  sunDir: Vector3
  /** warm key colour of the sun. */
  sunColor: Color3
  /** sun intensity (PBR-ish; we light Standard* + PBR both). */
  sunIntensity: number
  /** sky fill (hemispheric) up colour — cool so warm/cool separation reads. */
  skyColor: Color3
  /** ground bounce colour for the hemispheric fill. */
  groundColor: Color3
  /** hemispheric fill intensity. */
  fillIntensity: number
  /** zenith colour of the IBL environment (top of the sky dome). */
  envZenith: Color3
  /** horizon colour of the IBL environment. */
  envHorizon: Color3
  /** overall IBL ambient strength baked into the env cube. */
  envStrength: number
  /** post exposure (1 = neutral). */
  exposure: number
  /** post contrast (1 = neutral). */
  contrast: number
  /** bloom threshold (lower = more glow). */
  bloomThreshold: number
  /** bloom weight (intensity of the glow). */
  bloomWeight: number
  /** colour-grade tint multiplied into the image (warm push). */
  colorGrade: Color3
}

/**
 * The MOOD library. The default `golden` is a low warm sun raking across the
 * town, a cool sky fill, soft warm exposure, and a gentle bloom — the premium
 * Octopath / HD-2D golden hour. The others are authored so a future time-of-day
 * system can cross-fade without touching this file.
 *
 * INTENSITY CALIBRATION. The city's WORLD materials (render/materials.ts) are
 * PBR with `directIntensity ≈ 0.62` and `usePhysicalLightFalloff = false`, so
 * they're tuned for a MODERATE key (~0.5–0.9). A hot key (>1.2) blows the stucco
 * walls past the ACES knee and they read as a white silhouette (verified: at sun
 * 1.5 the building walls vanished; at 0.5 the town read perfectly). So sun
 * intensities here stay in the material-friendly band; the warm "golden" feel
 * comes from the sun COLOUR + exposure + IBL glow, NOT raw intensity.
 */
export const MOODS: Record<TimeOfDayName, TimeOfDayMood> = {
  // Low warm sun from the front-left, long soft shadows, cool sky — THE look.
  golden: {
    sunDir: new Vector3(-0.42, -0.62, 0.66).normalize(),
    sunColor: new Color3(1.0, 0.82, 0.58),
    sunIntensity: 0.72,
    skyColor: new Color3(0.62, 0.74, 0.92),
    groundColor: new Color3(0.34, 0.3, 0.26),
    fillIntensity: 0.62,
    envZenith: new Color3(0.32, 0.5, 0.78),
    envHorizon: new Color3(0.96, 0.82, 0.62),
    envStrength: 0.9,
    exposure: 1.18,
    contrast: 1.16,
    bloomThreshold: 0.78,
    bloomWeight: 0.4,
    colorGrade: new Color3(1.04, 1.0, 0.94),
  },
  dawn: {
    sunDir: new Vector3(-0.3, -0.5, 0.8).normalize(),
    sunColor: new Color3(1.0, 0.76, 0.62),
    sunIntensity: 0.62,
    skyColor: new Color3(0.6, 0.68, 0.9),
    groundColor: new Color3(0.3, 0.28, 0.3),
    fillIntensity: 0.6,
    envZenith: new Color3(0.36, 0.44, 0.72),
    envHorizon: new Color3(0.98, 0.78, 0.66),
    envStrength: 0.85,
    exposure: 1.12,
    contrast: 1.12,
    bloomThreshold: 0.78,
    bloomWeight: 0.38,
    colorGrade: new Color3(1.03, 0.99, 0.97),
  },
  day: {
    sunDir: new Vector3(-0.25, -0.92, 0.3).normalize(),
    sunColor: new Color3(1.0, 0.96, 0.88),
    sunIntensity: 0.92,
    skyColor: new Color3(0.7, 0.82, 1.0),
    groundColor: new Color3(0.4, 0.38, 0.34),
    fillIntensity: 0.68,
    envZenith: new Color3(0.4, 0.6, 0.95),
    envHorizon: new Color3(0.86, 0.9, 0.96),
    envStrength: 1.0,
    exposure: 1.0,
    contrast: 1.08,
    bloomThreshold: 0.85,
    bloomWeight: 0.28,
    colorGrade: new Color3(1.0, 1.0, 1.0),
  },
  dusk: {
    sunDir: new Vector3(0.55, -0.4, -0.6).normalize(),
    sunColor: new Color3(1.0, 0.58, 0.4),
    sunIntensity: 0.66,
    skyColor: new Color3(0.5, 0.52, 0.72),
    groundColor: new Color3(0.3, 0.24, 0.24),
    fillIntensity: 0.5,
    envZenith: new Color3(0.24, 0.3, 0.56),
    envHorizon: new Color3(0.92, 0.56, 0.46),
    envStrength: 0.8,
    exposure: 1.14,
    contrast: 1.18,
    bloomThreshold: 0.7,
    bloomWeight: 0.46,
    colorGrade: new Color3(1.05, 0.97, 0.92),
  },
}

export interface CinematicPipeline {
  /** the sun directional light (the key + shadow source). */
  sun: DirectionalLight
  /** the hemispheric sky fill. */
  fill: HemisphericLight
  /** the shadow generator (for casters/receivers to opt in). */
  getShadowGenerator: () => ShadowGenerator
  /** opt a mesh in as a shadow caster (deduped; safe to call repeatedly). */
  registerShadowCaster: (mesh: AbstractMesh) => void
  /** the active mood. */
  mood: TimeOfDayMood
  /** swap the time-of-day mood (re-tunes lights + post + env). */
  setTimeOfDay: (name: TimeOfDayName) => void
  /** re-center the tight shadow frustum on the player each frame. */
  update: (playerPos: Vector3) => void
  /** the post pipeline (for advanced tweaks/tests). */
  rendering: DefaultRenderingPipeline
  /** true if SSAO is active (perf-gated). */
  ssaoEnabled: boolean
  dispose: () => void
}

export interface PipelineOptions {
  /** starting mood; defaults to the premium golden hour. */
  timeOfDay?: TimeOfDayName
  /**
   * shadow map edge. 2048 is crisp on desktop; phones drop to 1024. The frustum
   * is tight (player-local) so even 1024 holds sharp contact shadows.
   */
  shadowMapSize?: number
  /** half-size (world units) of the tight shadow frustum around the player. */
  shadowRadius?: number
  /** force SSAO on/off; default = auto by perf tier. */
  ssao?: boolean
}

/** Perf tier — phones (DPR-capped, small viewport) get the lean path. */
function isLeanTier(): boolean {
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const small = Math.min(window.innerWidth, window.innerHeight) < 720
  return small || dpr < 2
}

/** SSAO is OFF unless opted in. Persists across reload via localStorage
 *  (`localStorage['wp:ssao'] = '1'`) or the `?ssao` URL flag — a `window.__wpSSAO`
 *  set in the console does NOT survive a reload, so the persistent forms are the
 *  ones that work for an A/B. */
function ssaoOptIn(): boolean {
  if (typeof window === "undefined") return false
  try {
    if (localStorage.getItem("wp:ssao") === "1") return true
    if (new URLSearchParams(window.location.search).has("ssao")) return true
  } catch {
    /* ignore */
  }
  return (window as unknown as { __wpSSAO?: boolean }).__wpSSAO === true
}

/**
 * Build a tiny procedural gradient environment cube (zenith→horizon→nadir) so
 * PBR materials get believable ambient + a soft sky reflection with ZERO asset
 * download. 16² faces is plenty for diffuse-dominant IBL; the prefiltered mips
 * Babylon generates give a soft gloss reflection too.
 */
function makeEnvCube(scene: Scene, mood: TimeOfDayMood): RawCubeTexture {
  const S = 16
  const faces: Float32Array[] = []
  const zen = mood.envZenith.scale(mood.envStrength)
  const hor = mood.envHorizon.scale(mood.envStrength)
  const nad = mood.groundColor.scale(mood.envStrength * 0.9)
  // For each cube face, map texel → direction, then colour by the up-component.
  // Face order matches Babylon: +X, -X, +Y, -Y, +Z, -Z.
  for (let f = 0; f < 6; f++) {
    const data = new Float32Array(S * S * 4)
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        // normalized face coords in [-1, 1]
        const u = (2 * (x + 0.5)) / S - 1
        const v = (2 * (y + 0.5)) / S - 1
        let dx = 0
        let dy = 0
        let dz = 0
        switch (f) {
          case 0: dx = 1; dy = -v; dz = -u; break // +X
          case 1: dx = -1; dy = -v; dz = u; break // -X
          case 2: dx = u; dy = 1; dz = v; break // +Y
          case 3: dx = u; dy = -1; dz = -v; break // -Y
          case 4: dx = u; dy = -v; dz = 1; break // +Z
          case 5: dx = -u; dy = -v; dz = -1; break // -Z
        }
        const len = Math.hypot(dx, dy, dz) || 1
        const up = dy / len // -1 (down) .. 1 (up)
        let r: number, g: number, b: number
        if (up >= 0) {
          const t = up
          r = hor.r + (zen.r - hor.r) * t
          g = hor.g + (zen.g - hor.g) * t
          b = hor.b + (zen.b - hor.b) * t
        } else {
          const t = -up
          r = hor.r + (nad.r - hor.r) * t
          g = hor.g + (nad.g - hor.g) * t
          b = hor.b + (nad.b - hor.b) * t
        }
        const i = (y * S + x) * 4
        data[i] = r
        data[i + 1] = g
        data[i + 2] = b
        data[i + 3] = 1
      }
    }
    faces.push(data)
  }
  const cube = new RawCubeTexture(
    scene,
    faces as unknown as ArrayBufferView[],
    S,
    Constants.TEXTUREFORMAT_RGBA,
    Constants.TEXTURETYPE_FLOAT,
    false, // no auto mipmaps (we'll prefilter for IBL)
    false,
    Texture.TRILINEAR_SAMPLINGMODE,
  )
  cube.gammaSpace = false // linear data → correct IBL energy
  cube.name = "wp-ibl-env"
  return cube
}

export function createCinematicPipeline(
  scene: Scene,
  camera: Camera,
  opts: PipelineOptions = {},
): CinematicPipeline {
  const lean = isLeanTier()
  let mood = MOODS[opts.timeOfDay ?? "golden"]

  const shadowMapSize = opts.shadowMapSize ?? (lean ? 1024 : 2048)
  const shadowRadius = opts.shadowRadius ?? 26

  // ── LIGHTS ────────────────────────────────────────────────────────────────
  // The engine ships a "hemi" + "sun" rig; the cinematic look wants a stronger,
  // colour-graded key + a clean cool fill. We OWN our own lights here and dim the
  // engine's pre-existing ones so we don't double-light (atmosphere.ts also
  // retunes the named lights; we leave those for it and stack a premium key on
  // top). Net: one warm key (shadow source), one cool fill.
  const engineSun = scene.getLightByName("sun")
  const engineHemi = scene.getLightByName("hemi")
  const prevEngineSunI = engineSun?.intensity ?? 0
  const prevEngineHemiI = engineHemi?.intensity ?? 0
  // Soften the engine's lights so OUR rig dominates (but keep a touch so a Look
  // that retunes them isn't fully overridden).
  if (engineSun) engineSun.intensity = 0
  if (engineHemi) engineHemi.intensity = 0.18

  const fill = new HemisphericLight("wp-cine-fill", mood.sunDir.scale(-1), scene)
  fill.intensity = mood.fillIntensity
  fill.diffuse = mood.skyColor
  fill.groundColor = mood.groundColor
  fill.specular = new Color3(0, 0, 0)

  const sun = new DirectionalLight("wp-cine-sun", mood.sunDir.clone(), scene)
  sun.intensity = mood.sunIntensity
  sun.diffuse = mood.sunColor
  sun.specular = mood.sunColor.scale(0.4)
  // Place the sun back up its ray so the shadow camera sits ABOVE/behind the
  // player looking down the sun direction. We let Babylon AUTO-FIT the ortho
  // shadow box to the registered casters each frame (the proven, robust path):
  // because casters are registered per-near-chunk (game.ts de-registers far
  // chunks), the auto-fit box stays player-local and the shadow map stays crisp.
  // `shadowFrustumSize` caps the box so even a wide caster spread can't blow the
  // resolution out.
  sun.position = mood.sunDir.scale(-shadowRadius * 0.5)
  sun.shadowMinZ = 0.1
  sun.shadowMaxZ = shadowRadius * 4
  // AUTO-FIT the ortho box to the registered casters each frame (Babylon's proven
  // directional-shadow path). The box tracks the caster set; because the lead's
  // integration registers casters PER-NEAR-CHUNK (far chunks de-register on
  // stream-out), the fit stays player-local and a single modest shadow map holds
  // crisp contact shadows across the streamed city.
  sun.autoUpdateExtends = true
  sun.autoCalcShadowZBounds = true

  // ── IBL ENVIRONMENT ─────────────────────────────────────────────────────────
  let env = makeEnvCube(scene, mood)
  const prevEnv = scene.environmentTexture
  scene.environmentTexture = env
  // a gentle global IBL so PBR materials (characters / opt-in surfaces) read with
  // real ambient + sky reflection. The world ground materials zero their own
  // env intensity, so this lifts characters + future PBR without blowing the
  // baked ground — exactly the seam we want.
  scene.environmentIntensity = 0.85

  // ── POST PIPELINE (tone-map + grade + bloom + AA) ───────────────────────────
  const rendering = new DefaultRenderingPipeline("wp-cine", true, scene, [camera])
  rendering.fxaaEnabled = true
  // FXAA already does the edge AA; 4× MSAA on top was a redundant per-frame resolve
  // (expensive at the backbuffer res). FXAA alone — 1 sample — is plenty for this
  // stylized look and a real fill win toward 60 fps.
  rendering.samples = 1

  // Image processing: ACES tone-map, warm exposure, gentle contrast + vignette.
  rendering.imageProcessingEnabled = true
  const ip = rendering.imageProcessing
  ip.toneMappingEnabled = true
  ip.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES
  ip.exposure = mood.exposure
  ip.contrast = mood.contrast
  ip.vignetteEnabled = true
  ip.vignetteWeight = 2.2
  ip.vignetteStretch = 0.4
  ip.vignetteCameraFov = camera.fov ?? 0.62
  // a warm, gentle vignette (corners darkened + faintly warmed) — premium framing.
  ip.vignetteColor.set(0.06, 0.03, 0.02, 0)
  // colour grade: a subtle warm push so the whole frame reads golden, not clinical.
  ip.colorCurvesEnabled = false

  // BLOOM — tasteful glow on the brightest highlights (sun-lit roof ridges, water
  // glints, lamp emissives), NOT a hazy wash.
  rendering.bloomEnabled = true
  rendering.bloomThreshold = mood.bloomThreshold
  rendering.bloomWeight = mood.bloomWeight
  rendering.bloomKernel = 32 // smaller blur kernel — cheaper, still a soft glow
  rendering.bloomScale = 0.5

  // ── SSAO (perf-gated) ───────────────────────────────────────────────────────
  let ssao: SSAO2RenderingPipeline | null = null
  // SSAO2 (16 samples + blur, full-screen) is the single most expensive post pass —
  // 5–15 ms at desktop res for a subtle crevice darkening this stylized world barely
  // needs. OFF by default now; opt in with `?ssao` or `window.__wpSSAO = true`.
  const wantSsao = opts.ssao ?? ssaoOptIn()
  if (wantSsao) {
    try {
      ssao = new SSAO2RenderingPipeline("wp-ssao", scene, { ssaoRatio: 0.5, blurRatio: 1 }, [camera])
      ssao.radius = 1.6
      ssao.totalStrength = 0.9
      ssao.base = 0.1
      ssao.samples = 16
      ssao.maxZ = 120
      ssao.minZAspect = 0.2
    } catch (e) {
      // SSAO can fail on some GL contexts; never let it take the whole render down.
      console.warn("[wp/pipeline] SSAO2 unavailable, continuing without it:", e)
      ssao = null
    }
  }

  // ── colour grade (warm push) applied as a post tint via image-processing ────
  // DefaultRenderingPipeline has no direct RGB multiply, so we fold the warm push
  // into the env + exposure already; the vignette colour adds the corner warmth.
  // (Kept as a hook so a future LUT can slot in here without a caller change.)

  // ── SHADOWS (contact-hardening) ─────────────────────────────────────────────
  // The ShadowGenerator is created LAZILY, on the first `registerShadowCaster`
  // call. WHY: a ShadowGenerator constructed inline with the
  // DefaultRenderingPipeline (during scene init) produces NO shadows — the
  // pipeline's image-processing pass and the post render-target wiring race the
  // generator's shadow-map registration, so the map renders but is never sampled
  // by receivers (verified: an identically-configured generator created AFTER
  // init casts correctly). Deferring creation until the first caster registers
  // (which, in-game, happens after full init when chunks stream) sidesteps the
  // race entirely and is the proven-reliable path. We build it once, lazily.
  let shadowGen: ShadowGenerator | null = null
  const ensureShadowGen = (): ShadowGenerator => {
    if (shadowGen) return shadowGen
    const sg = new ShadowGenerator(shadowMapSize, sun)
    // PCF: crisp contact shadows that read reliably on varied PBR receivers
    // (exponential-shadow-map can wash out to nothing on our materials). Quality
    // scales by tier so phones stay cheap.
    sg.usePercentageCloserFiltering = true
    sg.filteringQuality = lean ? ShadowGenerator.QUALITY_LOW : ShadowGenerator.QUALITY_HIGH
    sg.bias = 0.008
    sg.normalBias = 0.02
    sg.darkness = 0.2 // shadows are deep but never crushed-black
    sg.frustumEdgeFalloff = 0.4 // fade shadows at the frustum rim (no hard cut)
    // Render the shadow map EVERY frame (refreshRate = 1) — the frustum tracks the
    // player. (refreshRate = 0 is RENDER_ONCE: bakes one empty map then never
    // updates → silently disables shadows.)
    const map = sg.getShadowMap()
    if (map) map.refreshRate = 1
    shadowGen = sg
    return sg
  }

  const casters = new Set<AbstractMesh>()
  const registerShadowCaster = (mesh: AbstractMesh) => {
    if (!mesh || casters.has(mesh)) return
    const sg = ensureShadowGen()
    casters.add(mesh)
    sg.addShadowCaster(mesh, false)
    // a caster is almost always also a receiver in a town (walls catch each
    // other's shadows); cheap to flag and reads far richer.
    mesh.receiveShadows = true
    // Force this mesh's material to recompile WITH the shadow sampler — a material
    // that already compiled before becoming a receiver renders shadowless.
    mesh.material?.markAsDirty(Constants.MATERIAL_LightDirtyFlag)
  }

  // ── frustum follow ──────────────────────────────────────────────────────────
  // Keep the directional light's position riding above the player so the tight
  // ortho frustum always frames the player + their immediate surroundings. The
  // ortho extents are fixed (shadowRadius); only the position moves.
  // With auto-extends ON, the shadow box fits the casters — so the light position
  // only needs to sit up the sun ray FROM the player (near the active caster set)
  // so the depth range brackets them. We lift it a little above the player along
  // the ray each frame; the box itself fits the casters.
  const SUN_LIFT = shadowRadius * 0.5
  const update = (playerPos: Vector3) => {
    sun.position.set(
      playerPos.x - mood.sunDir.x * SUN_LIFT,
      playerPos.y - mood.sunDir.y * SUN_LIFT,
      playerPos.z - mood.sunDir.z * SUN_LIFT,
    )
  }

  const applyMood = (m: TimeOfDayMood) => {
    mood = m
    sun.direction.copyFrom(m.sunDir)
    sun.diffuse = m.sunColor
    sun.specular = m.sunColor.scale(0.4)
    sun.intensity = m.sunIntensity
    fill.direction = m.sunDir.scale(-1)
    fill.intensity = m.fillIntensity
    fill.diffuse = m.skyColor
    fill.groundColor = m.groundColor
    ip.exposure = m.exposure
    ip.contrast = m.contrast
    rendering.bloomThreshold = m.bloomThreshold
    rendering.bloomWeight = m.bloomWeight
    // rebuild the env cube for the new sky colours.
    const next = makeEnvCube(scene, m)
    scene.environmentTexture = next
    env.dispose()
    env = next
  }

  const setTimeOfDay = (name: TimeOfDayName) => applyMood(MOODS[name])

  return {
    sun,
    fill,
    // lazily ensures the generator exists so callers always get a real one.
    getShadowGenerator: () => ensureShadowGen(),
    registerShadowCaster,
    get mood() {
      return mood
    },
    setTimeOfDay,
    update,
    rendering,
    ssaoEnabled: ssao != null,
    dispose: () => {
      shadowGen?.dispose()
      sun.dispose()
      fill.dispose()
      rendering.dispose()
      ssao?.dispose()
      env.dispose()
      scene.environmentTexture = prevEnv
      casters.clear()
      if (engineSun) engineSun.intensity = prevEngineSunI
      if (engineHemi) engineHemi.intensity = prevEngineHemiI
    },
  }
}
