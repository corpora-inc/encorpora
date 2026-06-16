import {
  Color3,
  Color4,
  DefaultRenderingPipeline,
  DirectionalLight,
  DynamicTexture,
  Engine,
  EngineInstrumentation,
  GlowLayer,
  HemisphericLight,
  ImageProcessingConfiguration,
  Mesh,
  MeshBuilder,
  Scene,
  SceneInstrumentation,
  ShadowGenerator,
  SSAO2RenderingPipeline,
  StandardMaterial,
  TransformNode,
  UniversalCamera,
  Vector3,
} from "@babylonjs/core"
import "@babylonjs/loaders/glTF"
import { getSfx } from "./audio"
import { tuningStore } from "./tuningStore"
import type { EntryOut, HostApi, StackConfig } from "./sdk/types"
import { t, setLanguage as setUiLanguage, onChange as onUiLangChange } from "./i18n"
import { createSettingsDrawer, type MotionControl } from "./ui/settingsDrawer"
import { createMotionPermissionOverlay, type MotionPermissionOverlay } from "./ui/motionPermissionOverlay"
import type { TiltState } from "./systems/input"
import type { DrawerSectionDef } from "@shared/ui"

// Core modules
import {
  GRID,
  MOVE_SPEED,
  PHRASE_START_Z,
  PHRASE_END_Z,
  PHRASE_HIT_Z,
  PHRASE_HIT_WINDOW,
  LANE_ROWS,
  LANE_COLS,
} from "./core/constants"
import {
  SCENE,
  CAMERA,
  LIGHTING,
  GLOW,
  SSAO,
  PYRAMIDS,
} from "./core/visualConfig"
import type {
  GameState,
  RoundState,
  PhraseSpec,
  PhraseInstance,
  InitialState,
  Skin,
  SceneProp,
} from "./core/types"
import {
  clamp,
  lerp,
  scaleColor,
  getPhraseScore,
  getPhraseDuration,
  estimateSpeechDuration,
  createEmissivePbr,
  getSettings,
  getPhraseSpeed,
  pickRandom,
  rowToY,
  isNoSpaceLanguage,
  pickByLang,
  shuffle,
  getProgressionParams,
} from "./core/utils"
import { createGameStore } from "./core/gameStore"

// Rendering systems
import { createRoad } from "./rendering/road"
import { createSkyDome } from "./rendering/sky"
import { createPropField, updatePropField } from "./rendering/props"
import { createElectricField } from "./rendering/electricField"
import { createHoverboard } from "./rendering/hoverboard"
import { createPhraseSurfaceEffects } from "./rendering/phraseSurfaceEffects"

// Systems
import { createSuccessParticles, createFailParticles, createScreenShake, clearAllParticleTimeouts, createAmbientParticles, createStarfieldParticles, createEnergyFieldParticles, createSpeedLines } from "./systems/particles"
import { createScoreAnimator } from "./ui/scoreAnimation"
import { initInput } from "./systems/input"
import { createDailyQuota } from "@shared/monetization"

// Gameplay helpers
import { buildEntryLookup, pickLanguages } from "./gameplay/entryHelpers"

export const createHoverRunner = (
  container: HTMLElement,
  hostApi: HostApi,
  initialState?: InitialState
) => {
  let disposed = false

  // gate v2 daily quota. Limit/nag/unit live in the central registry
  // (QUOTAS.hover_phrases — 20 phrases/local day, soft nag every 5, "soft, soft,
  // hard"). At the cap the gate is BLOCKED until tomorrow or subscribe and
  // dispatches `corpan:daily-locked` for the host's accomplishment-lock overlay.
  // `note()` counts a completed phrase (and fires the nag/lock internally).
  // Disposed in dispose().
  const paywallGate = createDailyQuota("hover_phrases")

  // iOS detection removed - no longer needed for platform-specific hacks
  const debugFlags =
    typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null
  const showFps = debugFlags?.has("fps") ?? false
  const globalPerf =
    (globalThis as { __corpanPerf?: boolean }).__corpanPerf ?? false
  const showPerf = (debugFlags?.has("perf") ?? false) || globalPerf
  const debugElectricTarget = debugFlags?.has("debugElectric") ?? false
  const root = document.createElement("div")
  root.className = "hover-runner"
  container.appendChild(root)

  const updateViewportSize = () => {
    const viewport = window.visualViewport
    const width = Math.round(viewport?.width ?? window.innerWidth)
    const height = Math.round(viewport?.height ?? window.innerHeight)
    if (!Number.isFinite(width) || !Number.isFinite(height)) {
      return
    }
    container.style.width = `${width}px`
    container.style.height = `${height}px`
    root.style.width = `${width}px`
    root.style.height = `${height}px`
  }

  updateViewportSize()

  const sfx = getSfx()
  const scoreAnimator = createScoreAnimator(root)

  // References for reset functionality
  let skinSelectElement: HTMLSelectElement | null = null
  let applySkinFunction: ((id: string) => void) | null = null
  let forceProgressionUpdate: (() => void) | null = null

  let wakeLock: { release: () => Promise<void> } | null = null
  const requestWakeLock = async () => {
    const wakeLockApi = (navigator as typeof navigator & {
      wakeLock?: { request?: (type: "screen") => Promise<{ release: () => Promise<void> }> }
    }).wakeLock
    if (!wakeLockApi?.request) {
      return
    }
    try {
      wakeLock = await wakeLockApi.request("screen")
    } catch {
      // Ignore wake lock failures.
    }
  }
  const onVisibilityChange = () => {
    if (document.visibilityState === "visible" && !wakeLock) {
      void requestWakeLock()
    }
  }

  const canvas = document.createElement("canvas")
  root.appendChild(canvas)

  const fpsHud = showFps ? document.createElement("div") : null
  let showInstrumentation = false // Hidden by default, toggle with 'i' key
  if (fpsHud) {
    fpsHud.textContent = "0 fps"
    fpsHud.style.cssText =
      "position:absolute;top:calc(8px + var(--safe-top));left:calc(8px + var(--safe-left));" +
      "padding:4px 8px;border-radius:8px;background:rgba(3,6,12,0.6);" +
      "color:#dfe9ff;font:12px/1.2 'Trebuchet MS','Helvetica Neue',sans-serif;" +
      "letter-spacing:0.04em;z-index:40;pointer-events:none;opacity:0;"
    root.appendChild(fpsHud)
  }

  // Seed the active UI language from the host's stack config; further
  // changes are picked up via `hostApi.onStackConfigChange` below.
  setUiLanguage(hostApi.getStackConfig().languages[0] || "en")

  const phraseHud = document.createElement("div")
  phraseHud.className = "phrase-hud"
  const hudPromptLabel = document.createElement("div")
  hudPromptLabel.className = "phrase-hud-label"
  hudPromptLabel.textContent = t("phrase.listen")
  const hudPrompt = document.createElement("div")
  hudPrompt.className = "phrase-hud-text"
  hudPrompt.textContent = t("phrase.waiting")
  const hudPromptRomanization = document.createElement("div")
  hudPromptRomanization.className = "phrase-hud-romanization"
  const hudAnswer = document.createElement("div")
  hudAnswer.className = "phrase-hud-answer"
  const hudAnswerRomanization = document.createElement("div")
  hudAnswerRomanization.className = "phrase-hud-answer-romanization"
  phraseHud.append(
    hudPromptLabel,
    hudPrompt,
    hudPromptRomanization,
    hudAnswer,
    hudAnswerRomanization
  )
  root.appendChild(phraseHud)

  const statusHud = document.createElement("div")
  statusHud.className = "status-hud"
  const hudScore = document.createElement("div")
  hudScore.className = "status-score"
  hudScore.textContent = t("hud.score", { n: 0 })
  const hudStreak = document.createElement("div")
  hudStreak.className = "status-streak"
  hudStreak.textContent = t("hud.streak", { n: 0 })
  statusHud.append(hudScore, hudStreak)
  root.appendChild(statusHud)

  // promptToggle (Show Prompt) — DOM created here, attached into the
  // settings drawer's "Display" section below.
  const promptToggle = document.createElement("label")
  promptToggle.className = "hud-toggle"
  const promptToggleInput = document.createElement("input")
  promptToggleInput.type = "checkbox"
  promptToggleInput.checked = true
  const promptToggleLabel = document.createElement("span")
  promptToggleLabel.textContent = t("hud.show_prompt")
  promptToggle.append(promptToggleInput, promptToggleLabel)

  // Motion / tilt support detection. Motion is enabled by default
  // (see `tuningStore` defaults). On iOS we wait for the first user
  // gesture before calling `requestPermission()` — same listener that
  // unlocks audio. On Android we just `enableTilt()` at mount. The
  // legacy floating "Enable Motion" button is gone — its state now
  // lives in the single Motion Controls row inside the drawer's
  // Gameplay section.
  const supportsOrientation =
    typeof DeviceOrientationEvent !== "undefined" &&
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(pointer: coarse)").matches
  const needsIosPermission =
    supportsOrientation &&
    typeof (DeviceOrientationEvent as unknown as { requestPermission?: unknown })
      .requestPermission === "function"

  // Settings UI (accordion popover) was replaced by the bottom command
  // drawer in 0.2.0 — see `./ui/settingsDrawer.ts`. The drawer is
  // constructed below, after the skin picker (used in the Display
  // section) and reset side-effects have their references in scope.


  // Store references for later cleanup

  // Apply initial audio settings
  const initSettings = tuningStore.getState().settings
  sfx.setMusicVolume(initSettings.musicVolume)
  sfx.setSfxVolume(initSettings.sfxVolume)

  // Subscribe to audio setting changes
  tuningStore.subscribe((state) => {
    sfx.setMusicVolume(state.settings.musicVolume)
    sfx.setSfxVolume(state.settings.sfxVolume)
  })


  let paused = false
  const setPaused = (next: boolean) => {
    paused = next
    if (paused) {
      clearSpeakRepeat()
      hostApi.stopSpeech?.()
    } else {
      const state = gameStore.getState()
      if (state.round && !state.roundSolved && state.phase === "play") {
        scheduleSpeakRepeat()
      }
    }
  }

  const requestExit = () => {
    dispose()
    try {
      window.dispatchEvent(new CustomEvent("corpan:exit"))
    } catch {
      // Ignore exit dispatch failures.
    }
    try {
      window.close()
    } catch {
      // Ignore window close failures.
    }
  }
  const onWakeLockGesture = (event: PointerEvent) => {
    const target = event.target
    if (
      target instanceof Element &&
      target.closest('[data-hr-motion-permission-trigger="true"]')
    ) {
      return
    }
    void requestWakeLock()
    sfx.unlock()
    // Start background music after user gesture unlocks audio (if enabled)
    if (tuningStore.getState().settings.musicEnabled) {
      sfx.playMusic()
    }
    window.removeEventListener("pointerdown", onWakeLockGesture)
  }

  // Feed the paywall gate one interaction per tap. Capture-phase so it sees
  // every tap regardless of which handler consumes it. Under gate v2 the daily
  // nag/lock fire from `note()` (per completed phrase); this keeps the tap-driven
  // interaction seam in place (no-op unless a legacy `limit` is reintroduced).
  const onPaywallInteraction = () => paywallGate.onInteraction()

  document.addEventListener("visibilitychange", onVisibilityChange)
  window.addEventListener("pointerdown", onWakeLockGesture)
  window.addEventListener("pointerdown", onPaywallInteraction, { capture: true })
  void requestWakeLock()
  const onHostDispose = () => {
    dispose()
  }
  window.addEventListener("corpan:host-dispose", onHostDispose as EventListener)

  // --- Settings drawer ---
  //
  // The "Display" section hosts hover-runner-specific game chrome that
  // historically lived inside the old right-side popover: the
  // Show-Prompt toggle (built above) and the Skin picker (built later
  // in the mount sequence). We stash the section's container here and
  // append the skin picker into it once it exists.

  // Refs that the language listener and display section close over.
  // Skin elements are assigned later when the picker is constructed.
  let displayContainer: HTMLElement | null = null
  let skinPanelEl: HTMLElement | null = null
  let skinLabelEl: HTMLLabelElement | null = null
  let skinCycleEl: HTMLButtonElement | null = null

  const displaySection: DrawerSectionDef = {
    id: "hr-display",
    title: t("settings.display.title"),
    priority: 5,
    render: (c) => {
      displayContainer = c
      c.appendChild(promptToggle)
      // Skin picker, if already built, is re-appended here on rerender.
      // We hold a direct reference rather than querySelector(".skin-panel")
      // because the drawer's rerender wipes the section container's
      // innerHTML before invoking render — at that moment the panel has
      // been detached from the DOM and `root.querySelector` can't find
      // it anywhere. The direct ref survives detachment and is safe to
      // re-append.
      if (skinPanelEl && skinPanelEl.parentElement !== c) {
        c.appendChild(skinPanelEl)
      }
    },
  }

  // Wire input early so the drawer can subscribe to tilt state below.
  // The orientation listener is attached lazily via requestTilt() / enableTilt();
  // initInput() itself only sets up keyboard + pointer.
  let tiltListeners = new Set<(s: TiltState) => void>()
  const input = initInput(canvas, {
    onTiltStateChange: (s) => {
      for (const cb of tiltListeners) cb(s)
    },
  })

  const motionControl: MotionControl | undefined = supportsOrientation
    ? {
        request: () => input.requestTilt(),
        disable: () => input.disableTilt(),
        getState: () => input.getTiltState(),
        subscribe: (cb) => {
          tiltListeners.add(cb)
          return () => {
            tiltListeners.delete(cb)
          }
        },
      }
    : undefined

  const settingsDrawer = createSettingsDrawer({
    parent: root,
    isMobileDevice: typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(pointer: coarse)").matches,
    sfx,
    motion: motionControl,
    extraSections: [displaySection],
    onOpen: () => setPaused(true),
    onClose: () => setPaused(false),
    onExit: () => requestExit(),
    onResetExtras: () => {
      if (skinSelectElement && applySkinFunction) {
        skinSelectElement.value = skinSelectElement.options[0]?.value || ""
        applySkinFunction(skinSelectElement.value)
      }
      if (forceProgressionUpdate) {
        forceProgressionUpdate()
      }
    },
  })

  // First-run motion bootstrap.
  //
  // On non-iOS platforms (no `requestPermission`) we just enable tilt
  // at mount. On iOS we cannot enable from any background listener:
  // WebKit's `requestPermission()` requires user activation, and
  // every other handler in the canvas's pointerdown chain
  // (audio.unlock, Babylon's pointer wiring) consumes the activation
  // before our call can land. The only reliable gesture surface is a
  // direct click on a real `<button>` the user explicitly taps — so
  // we show a one-shot overlay with a single Enable Motion button.
  //
  // The overlay is shown only when motion is supported, the platform
  // needs permission, AND the user's setting is still ON (we never
  // pester someone who has opted out).
  let motionOverlay: MotionPermissionOverlay | null = null
  let unsubMotionOverlay: (() => void) | null = null
  const ensureMotionOverlay = () => {
    if (!supportsOrientation || !needsIosPermission) {
      return
    }
    if (!tuningStore.getState().settings.motionControlsEnabled) {
      return
    }
    if (motionOverlay) {
      return
    }
    motionOverlay = createMotionPermissionOverlay({
      parent: root,
      onAllow: () => {
        // Synchronous from the button's click handler — preserves
        // the user-activation context iOS demands.
        input.requestTilt()
      },
      onDismiss: () => {
        // User chose touch — persist the preference so they don't
        // get re-prompted next launch.
        tuningStore.getState().setSetting("motionControlsEnabled", false)
      },
    })
    if (!motionControl) {
      return
    }
    unsubMotionOverlay?.()
    unsubMotionOverlay = motionControl.subscribe((state) => {
      // Capture the current overlay reference up front — `motionOverlay`
      // can be replaced by a later `ensureMotionOverlay()` call before
      // this callback fires, and we want to dispose the exact instance
      // we were forwarding state to.
      const overlay = motionOverlay
      overlay?.setTiltState(state)
      if (state === "waiting" || state === "active" || state === "off") {
        unsubMotionOverlay?.()
        unsubMotionOverlay = null
        // Tear down the overlay's DOM + button listeners before
        // dropping the reference. The old code left them mounted.
        overlay?.dispose()
        if (motionOverlay === overlay) {
          motionOverlay = null
        }
      }
    })
  }

  if (supportsOrientation && tuningStore.getState().settings.motionControlsEnabled) {
    if (needsIosPermission) {
      ensureMotionOverlay()
    } else {
      input.enableTilt()
    }
  }

  // Live-localize UI strings that live OUTSIDE the drawer. The drawer
  // manages its own labels via its own onChange listener.
  const unsubUiLang = onUiLangChange(() => {
    hudPromptLabel.textContent = t("phrase.listen")
    promptToggleLabel.textContent = t("hud.show_prompt")
    if (skinLabelEl) skinLabelEl.textContent = t("skin.label")
    if (skinCycleEl) skinCycleEl.textContent = t("skin.cycle")
    // Update the "Display" section title too — the drawer caches
    // section titles at construction time and doesn't know to refresh.
    if (displayContainer) {
      const titleEl = displayContainer.parentElement?.querySelector(
        ".command-drawer-section-title",
      )
      if (titleEl) titleEl.textContent = t("settings.display.title")
    }
  })

  // Keep the UI language in sync with the host's primary language.
  let unsubHostLang: (() => void) | null = null
  if (hostApi.onStackConfigChange) {
    unsubHostLang = hostApi.onStackConfigChange((next) => {
      setUiLanguage(next.languages[0] || "en")
    })
  }

  const maxDevicePixelRatio = 2
  const engine = new Engine(canvas, true, {
    preserveDrawingBuffer: false,
    stencil: true,
    antialias: true,
  })
  engine.setHardwareScalingLevel(
    1 / Math.min(window.devicePixelRatio || 1, maxDevicePixelRatio)
  )

  const scene = new Scene(engine)
  scene.clearColor = new Color4(SCENE.clearColor.r, SCENE.clearColor.g, SCENE.clearColor.b, SCENE.clearColor.a)
  scene.imageProcessingConfiguration.toneMappingEnabled = true
  scene.imageProcessingConfiguration.toneMappingType =
    ImageProcessingConfiguration.TONEMAPPING_ACES
  scene.imageProcessingConfiguration.exposure = SCENE.exposure
  scene.imageProcessingConfiguration.contrast = SCENE.contrast
  scene.fogMode = Scene.FOGMODE_EXP2
  scene.fogDensity = SCENE.fogDensity
  scene.fogColor = new Color3(SCENE.fogColor.r, SCENE.fogColor.g, SCENE.fogColor.b)

  const sky = createSkyDome(scene)

  const camera = new UniversalCamera(
    "camera",
    new Vector3(CAMERA.position.x, CAMERA.position.y, CAMERA.position.z),
    scene
  )
  camera.setTarget(new Vector3(CAMERA.target.x, CAMERA.target.y, CAMERA.target.z))
  camera.fov = CAMERA.fov
  camera.minZ = CAMERA.minZ
  camera.maxZ = CAMERA.maxZ
  camera.inputs.clear()

  const hemi = new HemisphericLight(
    "hemi",
    new Vector3(LIGHTING.hemi.direction.x, LIGHTING.hemi.direction.y, LIGHTING.hemi.direction.z),
    scene
  )
  hemi.intensity = LIGHTING.hemi.intensity
  hemi.diffuse = new Color3(LIGHTING.hemi.diffuse.r, LIGHTING.hemi.diffuse.g, LIGHTING.hemi.diffuse.b)
  hemi.groundColor = new Color3(LIGHTING.hemi.ground.r, LIGHTING.hemi.ground.g, LIGHTING.hemi.ground.b)

  // Main directional light
  const accent = new DirectionalLight(
    "accent",
    new Vector3(LIGHTING.accent.direction.x, LIGHTING.accent.direction.y, LIGHTING.accent.direction.z),
    scene
  )
  accent.position = new Vector3(LIGHTING.accent.position.x, LIGHTING.accent.position.y, LIGHTING.accent.position.z)
  accent.intensity = LIGHTING.accent.intensity
  accent.diffuse = new Color3(LIGHTING.accent.diffuse.r, LIGHTING.accent.diffuse.g, LIGHTING.accent.diffuse.b)
  accent.specular = new Color3(LIGHTING.accent.specular.r, LIGHTING.accent.specular.g, LIGHTING.accent.specular.b)

  // Rim light for depth separation
  const rimLight = new DirectionalLight(
    "rim",
    new Vector3(LIGHTING.rim.direction.x, LIGHTING.rim.direction.y, LIGHTING.rim.direction.z),
    scene
  )
  rimLight.position = new Vector3(LIGHTING.rim.position.x, LIGHTING.rim.position.y, LIGHTING.rim.position.z)
  rimLight.intensity = LIGHTING.rim.intensity
  rimLight.diffuse = new Color3(LIGHTING.rim.diffuse.r, LIGHTING.rim.diffuse.g, LIGHTING.rim.diffuse.b)
  rimLight.specular = new Color3(LIGHTING.rim.specular.r, LIGHTING.rim.specular.g, LIGHTING.rim.specular.b)

  const glow = new GlowLayer("glow", scene, {
    blurKernelSize: GLOW.blurKernelSize,
  })
  glow.intensity = GLOW.intensity
  glow.addExcludedMesh(sky.mesh)

  // Higher quality shadow generator
  const shadowGenerator = new ShadowGenerator(2048, accent)
  shadowGenerator.usePercentageCloserFiltering = true
  shadowGenerator.filteringQuality = ShadowGenerator.QUALITY_HIGH
  shadowGenerator.bias = 0.0004
  shadowGenerator.normalBias = 0.015
  shadowGenerator.darkness = 0.55
  shadowGenerator.frustumEdgeFalloff = 0.3

  // SSAO for ambient occlusion (can cause WebGL errors with StandardMaterial - disable if needed)
  let ssao: SSAO2RenderingPipeline | null = null
  if (SSAO.enabled) {
    ssao = new SSAO2RenderingPipeline("ssao", scene, {
      ssaoRatio: SSAO.ssaoRatio,
      blurRatio: SSAO.blurRatio,
    })
    ssao.radius = SSAO.radius
    ssao.totalStrength = SSAO.totalStrength
    ssao.base = SSAO.base
    ssao.expensiveBlur = SSAO.expensiveBlur
    ssao.samples = SSAO.samples
    ssao.maxZ = SSAO.maxZ
    scene.postProcessRenderPipelineManager.attachCamerasToRenderPipeline("ssao", camera)
  }

  // Default rendering pipeline for cinematic effects
  const renderPipeline = new DefaultRenderingPipeline(
    "defaultPipeline",
    true,
    scene,
    [camera]
  )
  // Chromatic aberration for sci-fi aesthetic
  renderPipeline.chromaticAberrationEnabled = true
  renderPipeline.chromaticAberration.aberrationAmount = 15
  renderPipeline.chromaticAberration.radialIntensity = 0.8

  // Subtle vignette for focus
  renderPipeline.imageProcessing.vignetteEnabled = true
  renderPipeline.imageProcessing.vignetteWeight = 1.5
  renderPipeline.imageProcessing.vignetteStretch = 0.5
  renderPipeline.imageProcessing.vignetteCameraFov = camera.fov

  // Minimal bloom - keep things sharp
  renderPipeline.bloomEnabled = true
  renderPipeline.bloomThreshold = 0.9  // Very high threshold - only brightest
  renderPipeline.bloomWeight = 0.99    // Very subtle
  renderPipeline.bloomKernel = 32
  renderPipeline.bloomScale = 0.3

  // Sharpen for crisp visuals
  renderPipeline.sharpenEnabled = true
  renderPipeline.sharpen.edgeAmount = 0.2

  // Subtle film grain for cinematic texture
  renderPipeline.grainEnabled = true
  renderPipeline.grain.intensity = 3  // Reduced from 8 for crispness
  renderPipeline.grain.animated = true

  const road = createRoad(scene)
  const hoverboard = createHoverboard(scene)
  hoverboard.root.position = new Vector3(GRID.leftX, GRID.bottomY, GRID.z)

  // Initialize geometry pool for avatar progression (performance optimization)
  hoverboard.initGeometryPool?.()

  const electricField = createElectricField(
    scene,
    hoverboard.visualRoot,
    new Color3(0.35, 0.9, 1)
  )

  // Ambient background particle systems for visual depth
  const ambientParticles = createAmbientParticles(scene, camera.position)
  const starfieldParticles = createStarfieldParticles(scene, camera.position)
  const energyFieldLeft = createEnergyFieldParticles(scene, "left")
  const energyFieldRight = createEnergyFieldParticles(scene, "right")
  const speedLines = createSpeedLines(scene, camera.position)

  // Distant pyramid - background scenery
  const distantPyramid = MeshBuilder.CreateCylinder(
    "distant-pyramid",
    {
      height: PYRAMIDS.main.height,
      diameterTop: 0,
      diameterBottom: PYRAMIDS.main.diameter,
      tessellation: 5,  // 4 sides = pyramid
    },
    scene
  )
  distantPyramid.position = new Vector3(
    PYRAMIDS.main.position.x,
    PYRAMIDS.main.position.y,
    PYRAMIDS.main.position.z
  )
  distantPyramid.rotation.y = PYRAMIDS.main.rotation
  const pyramidMat = createEmissivePbr(
    "pyramid-mat",
    scene,
    new Color3(PYRAMIDS.material.albedo.r, PYRAMIDS.material.albedo.g, PYRAMIDS.material.albedo.b),
    new Color3(PYRAMIDS.material.emissive.r, PYRAMIDS.material.emissive.g, PYRAMIDS.material.emissive.b),
    PYRAMIDS.material.metallic,
    PYRAMIDS.material.roughness
  )
  distantPyramid.material = pyramidMat
  distantPyramid.isPickable = false

  // Second smaller pyramid for depth
  const distantPyramid2 = MeshBuilder.CreateCylinder(
    "distant-pyramid-2",
    {
      height: PYRAMIDS.secondary.height,
      diameterTop: 0,
      diameterBottom: PYRAMIDS.secondary.diameter,
      tessellation: 5,
    },
    scene
  )
  distantPyramid2.position = new Vector3(
    PYRAMIDS.secondary.position.x,
    PYRAMIDS.secondary.position.y,
    PYRAMIDS.secondary.position.z
  )
  distantPyramid2.rotation.y = PYRAMIDS.secondary.rotation
  distantPyramid2.material = pyramidMat
  distantPyramid2.isPickable = false

  const perfHud = showPerf ? document.createElement("div") : null
  if (perfHud) {
    perfHud.textContent = "perf"
    perfHud.style.cssText =
      "position:absolute;top:calc(8px + var(--safe-top));right:calc(8px + var(--safe-right));" +
      "padding:6px 8px;border-radius:10px;background:rgba(3,6,12,0.65);" +
      "color:#dfe9ff;font:12px/1.3 'Trebuchet MS','Helvetica Neue',sans-serif;" +
      "letter-spacing:0.03em;z-index:40;pointer-events:none;white-space:pre;opacity:0;"
    root.appendChild(perfHud)
  }
  const sceneInstrumentation = showPerf ? new SceneInstrumentation(scene) : null
  if (sceneInstrumentation) {
    sceneInstrumentation.captureFrameTime = true
    sceneInstrumentation.captureRenderTime = true
    sceneInstrumentation.captureInterFrameTime = true
  }
  const engineInstrumentation = showPerf ? new EngineInstrumentation(engine) : null
  if (engineInstrumentation) {
    engineInstrumentation.captureGPUFrameTime = true
  }

  const neonRoot = new TransformNode("env-neon", scene)
  const desertRoot = new TransformNode("env-desert", scene)
  const glacierRoot = new TransformNode("env-glacier", scene)

  const neonMat = createEmissivePbr(
    "neon-prop-mat",
    scene,
    new Color3(0.04, 0.08, 0.14),
    new Color3(0.2, 0.75, 1),
    0.25,
    0.55
  )
  neonMat.emissiveColor = scaleColor(neonMat.emissiveColor, 1.6)

  const neonProps = createPropField(neonRoot, {
    count: 26,
    spacing: 3.2,
    offsetX: 1.1,
    offsetXJitter: 0.6,
    baseY: 0.45,
    baseYJitter: 0.2,
    buildMesh: (index) => {
      const shapeType = index % 4
      let mesh: Mesh

      if (shapeType === 0) {
        // Tall thin pylons
        const height = 0.7 + (index % 4) * 0.35
        mesh = MeshBuilder.CreateCylinder(
          `neon-pylon-${index}`,
          { height, diameter: 0.12 },
          scene
        )
      } else if (shapeType === 1) {
        // Floating rings
        mesh = MeshBuilder.CreateTorus(
          `neon-ring-${index}`,
          { diameter: 0.6, thickness: 0.08, tessellation: 16 },
          scene
        )
      } else if (shapeType === 2) {
        // Boxes
        const size = 0.3 + (index % 3) * 0.15
        mesh = MeshBuilder.CreateBox(
          `neon-box-${index}`,
          { size, height: size * 1.5 },
          scene
        )
      } else {
        // Octahedrons
        const size = 0.4 + (index % 3) * 0.2
        mesh = MeshBuilder.CreatePolyhedron(
          `neon-oct-${index}`,
          { type: 1, size },
          scene
        )
      }

      mesh.material = neonMat
      mesh.rotation.y = Math.random() * Math.PI
      mesh.rotation.x = (Math.random() - 0.5) * 0.3
      return mesh
    },
  })

  const desertMat = createEmissivePbr(
    "desert-prop-mat",
    scene,
    new Color3(0.4, 0.22, 0.12),
    new Color3(0.2, 0.12, 0.08),
    0.1,
    0.75
  )
  desertMat.emissiveColor = scaleColor(desertMat.emissiveColor, 1.4)

  const desertProps = createPropField(desertRoot, {
    count: 22,
    spacing: 4.2,
    offsetX: 1.4,
    offsetXJitter: 0.8,
    baseY: 0.9,
    baseYJitter: 0.3,
    buildMesh: (index) => {
      const shapeType = index % 3
      let mesh: Mesh

      if (shapeType === 0) {
        // Classic spires
        const height = 1.6 + (index % 3) * 0.6
        mesh = MeshBuilder.CreateCylinder(
          `desert-spire-${index}`,
          { height, diameterTop: 0.18, diameterBottom: 0.6 },
          scene
        )
      } else if (shapeType === 1) {
        // Stacked discs
        const height = 1.2 + (index % 4) * 0.4
        mesh = MeshBuilder.CreateCylinder(
          `desert-disc-${index}`,
          { height, diameter: 0.5, tessellation: 8 },
          scene
        )
      } else {
        // Crystal clusters
        const size = 0.6 + (index % 3) * 0.3
        mesh = MeshBuilder.CreatePolyhedron(
          `desert-crystal-${index}`,
          { type: 0, size },
          scene
        )
      }

      mesh.material = desertMat
      mesh.rotation.y = Math.random() * Math.PI
      mesh.rotation.z = (Math.random() - 0.5) * 0.15
      return mesh
    },
  })

  const glacierMat = createEmissivePbr(
    "glacier-prop-mat",
    scene,
    new Color3(0.15, 0.25, 0.42),
    new Color3(0.2, 0.55, 0.95),
    0.2,
    0.5
  )
  glacierMat.emissiveColor = scaleColor(glacierMat.emissiveColor, 1.5)

  const glacierProps = createPropField(glacierRoot, {
    count: 24,
    spacing: 3.8,
    offsetX: 1.25,
    offsetXJitter: 0.7,
    baseY: 0.6,
    baseYJitter: 0.25,
    buildMesh: (index) => {
      const shapeType = index % 4
      let mesh: Mesh

      if (shapeType === 0) {
        // Tall ice shards
        const height = 1.2 + (index % 4) * 0.5
        mesh = MeshBuilder.CreateCylinder(
          `glacier-shard-${index}`,
          { height, diameterTop: 0.08, diameterBottom: 0.5 },
          scene
        )
      } else if (shapeType === 1) {
        // Ice spheres
        const diameter = 0.5 + (index % 3) * 0.2
        mesh = MeshBuilder.CreateSphere(
          `glacier-orb-${index}`,
          { diameter, segments: 12 },
          scene
        )
      } else if (shapeType === 2) {
        // Prisms
        const height = 0.8 + (index % 3) * 0.4
        mesh = MeshBuilder.CreateCylinder(
          `glacier-prism-${index}`,
          { height, diameter: 0.4, tessellation: 6 },
          scene
        )
      } else {
        // Dodecahedrons
        const size = 0.35 + (index % 3) * 0.15
        mesh = MeshBuilder.CreatePolyhedron(
          `glacier-dodec-${index}`,
          { type: 2, size },
          scene
        )
      }

      mesh.material = glacierMat
      mesh.rotation.y = Math.random() * Math.PI
      mesh.rotation.z = (Math.random() - 0.5) * 0.2
      mesh.rotation.x = (Math.random() - 0.5) * 0.15
      return mesh
    },
  })

  hoverboard.root.getChildMeshes().forEach((mesh) => {
    shadowGenerator.addShadowCaster(mesh)
  })
  const allProps = [...neonProps, ...desertProps, ...glacierProps]
  allProps.forEach((prop) => {
    shadowGenerator.addShadowCaster(prop.mesh)
  })

  // Skins use LIGHTING intensities so they can be tweaked in visualConfig
  const skins: Skin[] = [
    {
      id: "neon",
      name: "Neon Drift",
      variantId: "corpan",
      envRoot: neonRoot,
      props: neonProps,
      palette: {
        road: new Color3(0.06, 0.08, 0.12),
        emissive: new Color3(0.02, 0.04, 0.08),
        center: new Color3(0.25, 0.7, 1),
        edge: new Color3(0.12, 0.55, 0.95),
      },
      sky: new Color4(0.01, 0.02, 0.04, 1),
      hemi: {
        intensity: LIGHTING.hemi.intensity,  // From visualConfig
        diffuse: new Color3(0.4, 0.5, 0.7),
        ground: new Color3(0.02, 0.03, 0.05),
      },
      accent: {
        intensity: LIGHTING.accent.intensity,  // From visualConfig
        color: new Color3(0.4, 0.6, 0.9),
      },
    },
    {
      id: "desert",
      name: "Sunset Skimmer",
      variantId: "desert",
      envRoot: desertRoot,
      props: desertProps,
      palette: {
        road: new Color3(0.12, 0.08, 0.06),
        emissive: new Color3(0.08, 0.04, 0.02),
        center: new Color3(1, 0.64, 0.3),
        edge: new Color3(0.85, 0.35, 0.2),
      },
      sky: new Color4(0.03, 0.015, 0.01, 1),
      hemi: {
        intensity: LIGHTING.hemi.intensity,  // From visualConfig
        diffuse: new Color3(0.6, 0.45, 0.3),
        ground: new Color3(0.06, 0.04, 0.03),
      },
      accent: {
        intensity: LIGHTING.accent.intensity,  // From visualConfig
        color: new Color3(0.8, 0.5, 0.3),
      },
    },
    {
      id: "glacier",
      name: "Glacier Pulse",
      variantId: "glacier",
      envRoot: glacierRoot,
      props: glacierProps,
      palette: {
        road: new Color3(0.04, 0.1, 0.16),
        emissive: new Color3(0.02, 0.05, 0.12),
        center: new Color3(0.45, 0.9, 1),
        edge: new Color3(0.28, 0.7, 0.95),
      },
      sky: new Color4(0.01, 0.025, 0.05, 1),
      hemi: {
        intensity: LIGHTING.hemi.intensity,  // From visualConfig
        diffuse: new Color3(0.45, 0.55, 0.7),
        ground: new Color3(0.02, 0.04, 0.06),
      },
      accent: {
        intensity: LIGHTING.accent.intensity,  // From visualConfig
        color: new Color3(0.4, 0.6, 0.85),
      },
    },
  ]

  let activeSkin = skins[0]
  const applySkin = (id: string) => {
    const next = skins.find((skin) => skin.id === id) ?? skins[0]
    skins.forEach((skin) => {
      const enabled = skin.id === next.id
      skin.props.forEach((prop: SceneProp) => prop.mesh.setEnabled(enabled))
    })
    hoverboard.setVariant(next.variantId)
    road.setPalette(next.palette)
    scene.clearColor = next.sky
    sky.setColor(next.sky)
    scene.fogColor = new Color3(next.sky.r, next.sky.g, next.sky.b)
    electricField.setColor(next.palette.center)
    hemi.intensity = next.hemi.intensity
    hemi.diffuse = next.hemi.diffuse
    hemi.groundColor = next.hemi.ground
    accent.intensity = next.accent.intensity
    accent.diffuse = next.accent.color
    activeSkin = next
  }
  // Store reference for reset functionality
  applySkinFunction = applySkin
  applySkin(activeSkin.id)

  const skinPanel = document.createElement("div")
  skinPanel.className = "skin-panel"
  const skinLabel = document.createElement("label")
  skinLabel.textContent = t("skin.label")
  const skinSelect = document.createElement("select")
  skinSelect.className = "skin-select"
  // Store reference for reset functionality
  skinSelectElement = skinSelect
  skins.forEach((skin) => {
    const option = document.createElement("option")
    option.value = skin.id
    option.textContent = skin.name
    skinSelect.appendChild(option)
  })
  skinSelect.value = activeSkin.id
  const skinCycle = document.createElement("button")
  skinCycle.className = "skin-cycle"
  skinCycle.type = "button"
  skinCycle.textContent = t("skin.cycle")
  skinPanel.append(skinLabel, skinSelect, skinCycle)

  // Publish skin label refs so the language listener can re-localize.
  skinPanelEl = skinPanel
  skinLabelEl = skinLabel
  skinCycleEl = skinCycle

  // Drop the skin picker into the drawer's "Display" section. The
  // drawer rendered that section during its own construction (above),
  // so `displayContainer` is set. The Show-Prompt toggle was already
  // appended there.
  const dc = displayContainer as HTMLElement | null
  if (dc) {
    dc.appendChild(skinPanel)
  } else {
    // Defensive: if the drawer hasn't rendered yet, stash on root so
    // the displaySection.render callback picks it up via querySelector.
    root.appendChild(skinPanel)
  }

  const onSkinChange = () => {
    applySkin(skinSelect.value)
  }
  const onSkinCycle = () => {
    const currentIndex = skins.findIndex((skin) => skin.id === activeSkin.id)
    const nextIndex = (currentIndex + 1) % skins.length
    const next = skins[nextIndex]
    skinSelect.value = next.id
    applySkin(next.id)
  }
  skinSelect.addEventListener("change", onSkinChange)
  skinCycle.addEventListener("click", onSkinCycle)

  // `input` was created earlier; the first-run motion bootstrap was
  // moved up near the drawer setup so its declarations are in scope
  // for both the call site and the dispose path.

  // Subscribe to tuningStore so that programmatic changes to
  // `motionControlsEnabled` (e.g. Reset-All) propagate to the input
  // layer. The drawer's Motion row itself calls `motion.request()` /
  // `motion.disable()` synchronously from the click handler, so this
  // subscriber is only for indirect/programmatic flips.
  let lastMotionEnabled = tuningStore.getState().settings.motionControlsEnabled
  const motionUnsubscribe = tuningStore.subscribe((state) => {
    const next = state.settings.motionControlsEnabled
    if (next === lastMotionEnabled) return
    lastMotionEnabled = next
    if (!supportsOrientation) return
    if (next) {
      if (needsIosPermission) {
        const tiltState = input.getTiltState()
        if (tiltState === "pending" || tiltState === "waiting" || tiltState === "active") {
          return
        }
        ensureMotionOverlay()
      } else {
        input.enableTilt()
      }
    } else {
      input.disableTilt()
    }
  })

  // (Legacy tilt-button click handler removed in 0.2.0 — the drawer's
  // Motion Controls row now owns the toggle + permission flow.)

  // Keyboard handler for toggling instrumentation (FPS/perf) with 'i' key
  const toggleInstrumentation = () => {
    showInstrumentation = !showInstrumentation
    const opacity = showInstrumentation ? "1" : "0"
    if (fpsHud) {
      fpsHud.style.opacity = opacity
    }
    if (perfHud) {
      perfHud.style.opacity = opacity
    }
  }
  const onKeyDownGlobal = (event: KeyboardEvent) => {
    if (event.key === "i" || event.key === "I") {
      toggleInstrumentation()
    }
  }
  window.addEventListener("keydown", onKeyDownGlobal)

  const target = new Vector3()
  const velocity = new Vector3()
  const lastPos = hoverboard.root.position.clone()
  let hoverTime = 0
  let electricTarget: Mesh | null = null
  let electricTargetPhrase: PhraseInstance | null = null
  let electricIntensity = 0
  let highlightTime = 0
  let lastProgressionLevel = -1
  let lastProgressionNetCorrect = -1
  let cachedProgression: ReturnType<typeof getProgressionParams> | null = null

  // Store reference for forcing progression update on reset
  forceProgressionUpdate = () => {
    console.log("[PROGRESSION] Force update - resetting tracking vars")
    lastProgressionLevel = -1
    lastProgressionNetCorrect = -1
    cachedProgression = null
  }

  const gameStore = createGameStore<GameState>({
    stackConfig: initialState?.stackConfig ?? hostApi.getStackConfig(),
    round: null,
    roundLoading: false,
    roundSolved: false,
    roundGeneration: 0,
    activePhrases: [],
    lastLane: -1,
    lastPhraseId: null,
    spawnCooldown: 0,
    incorrectStreak: 0,
    phase: "intro",
    hasSpokenMissedAnswer: false,
  })
  let stackUnsubscribe: (() => void) | null = null
  let tuningUnsubscribe: (() => void) | null = null
  let showPrompt = true
  let promptStatusTimeout: number | null = null
  const phraseRoot = new TransformNode("phrase-root", scene)
  const entryBuffer: EntryOut[] = []
  let fetchingEntries = false
  let speakRepeatTimeout: number | null = null
  const transitionTimeouts: number[] = []

  const getTextScale = () => {
    const size = gameStore.getState().stackConfig?.textSize
    if (size === "large") return 1.1
    if (size === "small") return 0.9
    return 1
  }

  const estimateSpeakMs = (text: string, lang?: string) => {
    const trimmed = text.trim()
    if (!trimmed) {
      return 800
    }

    // CJK languages need much more time per character for TTS
    const isCJK = lang && /^(zh|ja|ko)/i.test(lang)
    if (isCJK) {
      const chars = trimmed.replace(/[\s\p{P}]/gu, "").length
      const base = clamp(chars * 350, 800, 5000)
      const rate = Math.max(gameStore.getState().stackConfig?.rate ?? 1, 0.4)
      return base / rate
    }

    // Non-CJK languages: word-based timing
    const words = trimmed.split(/\s+/).filter(Boolean).length
    const wordMs = words * 520
    const charMs = trimmed.length * 60
    const base = clamp(Math.max(wordMs, charMs), 800, 5000)
    const rate = Math.max(gameStore.getState().stackConfig?.rate ?? 1, 0.4)
    return base / rate
  }

  // Initialize screen shake system
  const { shakeOffset, trigger: triggerScreenShake } = createScreenShake()

  const createPhraseMesh = (spec: PhraseSpec) => {
    const scale = getTextScale() * 1.45 * getSettings().textScaleFactor
    const textureWidth = 2048
    const baseTextureHeight = 1024
    const paddingX = 200
    const paddingY = 160
    const mainFont = "700 190px 'Trebuchet MS', 'Helvetica Neue', sans-serif"
    const romanFont = "600 85px 'Trebuchet MS', 'Helvetica Neue', sans-serif"
    const mainLineHeight = 170
    const romanLineHeight = 95
    const romanGap = 30
    const maxLineWidth = textureWidth - paddingX * 2
    const measureCanvas =
      typeof document !== "undefined" ? document.createElement("canvas") : null
    const measureCtx = measureCanvas?.getContext("2d") ?? null
    const measureTextWidth = (text: string, font: string) => {
      if (!measureCtx) {
        return text.length * 100
      }
      measureCtx.font = font
      return measureCtx.measureText(text).width
    }
    const wrapText = (text: string, lang: string | undefined, font: string) => {
      const trimmed = text.trim()
      if (!trimmed) {
        return []
      }
      const isNoSpace = Boolean(lang && isNoSpaceLanguage(lang))
      const tokens = isNoSpace ? Array.from(trimmed) : trimmed.split(/\s+/).filter(Boolean)
      const lines: string[] = []
      let current = ""
      const joinToken = (line: string, token: string) =>
        line ? (isNoSpace ? `${line}${token}` : `${line} ${token}`) : token

      const commitLine = (line: string) => {
        if (line) {
          lines.push(line)
        }
      }

      tokens.forEach((token) => {
        const next = joinToken(current, token)
        if (measureTextWidth(next, font) <= maxLineWidth || !current) {
          current = next
          return
        }
        commitLine(current)
        current = token
        if (!isNoSpace && measureTextWidth(token, font) > maxLineWidth) {
          current = ""
          Array.from(token).forEach((char) => {
            const attempt = `${current}${char}`
            if (measureTextWidth(attempt, font) > maxLineWidth && current) {
              commitLine(current)
              current = char
            } else {
              current = attempt
            }
          })
        }
      })
      commitLine(current)
      return lines
    }

    const lines = wrapText(spec.text, spec.lang, mainFont)
    const romLines =
      spec.romanization && gameStore.getState().stackConfig?.showRomanization
        ? wrapText(spec.romanization, undefined, romanFont)
        : []
    const maxLineLength = Math.max(
      ...lines.map((line) => line.length),
      ...romLines.map((line) => line.length),
      1
    )
    const planeWidth = maxLineLength * 0.22 * scale
    const lineCount = lines.length + (romLines.length ? romLines.length : 0)
    const planeHeight = (0.9 + lineCount * 0.5) * scale

    const mainBlockHeight = lines.length * mainLineHeight
    const romanBlockHeight = romLines.length
      ? romanGap + romLines.length * romanLineHeight
      : 0
    const totalBlockHeight = mainBlockHeight + romanBlockHeight
    const textureHeight = Math.max(
      baseTextureHeight,
      Math.ceil(totalBlockHeight + paddingY * 2)
    )
    const blockTop = (textureHeight - totalBlockHeight) / 2

    const texture = new DynamicTexture(
      `phrase-texture-${spec.id}`,
      { width: textureWidth, height: textureHeight },
      scene,
      true
    )
    texture.hasAlpha = true
    const ctx = texture.getContext() as CanvasRenderingContext2D
    ctx.clearRect(0, 0, textureWidth, textureHeight)
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"

    const drawTextLine = (
      text: string,
      y: number,
      font: string,
      fill: string
    ) => {
      ctx.font = font
      ctx.lineWidth = 12
      ctx.strokeStyle = "rgba(5, 10, 20, 0.85)"
      ctx.shadowColor = "rgba(0, 0, 0, 0.4)"
      ctx.shadowBlur = 6
      ctx.strokeText(text, 1024, y)
      ctx.shadowBlur = 0
      ctx.fillStyle = fill
      ctx.fillText(text, 1024, y)
    }

    const baseY = blockTop + mainLineHeight / 2
    lines.forEach((line, index) => {
      drawTextLine(
        line,
        baseY + index * mainLineHeight,
        mainFont,
        "rgba(245, 250, 255, 0.98)"
      )
    })
    if (romLines.length) {
      romLines.forEach((line, index) => {
        drawTextLine(
          line,
          baseY +
          lines.length * mainLineHeight +
          romanGap +
          romanLineHeight / 2 +
          index * romanLineHeight,
          romanFont,
          "rgba(150, 210, 255, 0.95)"
        )
      })
    }
    texture.update()

    const material = new StandardMaterial(`phrase-mat-${spec.id}`, scene)
    material.diffuseTexture = texture
    material.emissiveTexture = texture
    material.opacityTexture = texture
    material.useAlphaFromDiffuseTexture = true
    material.specularColor = new Color3(0.02, 0.04, 0.08)
    const baseEmissive = new Color3(0.22, 0.4, 0.7)
    material.emissiveColor = baseEmissive.clone()

    const mesh = MeshBuilder.CreatePlane(
      `phrase-${spec.id}`,
      { width: planeWidth, height: planeHeight },
      scene
    )
    mesh.material = material
    mesh.metadata = { baseEmissive }
    mesh.billboardMode = Mesh.BILLBOARDMODE_ALL
    mesh.isPickable = false
    mesh.parent = phraseRoot
    mesh.scaling.z = 0.35

    // Calculate letter positions for electric field targeting
    const letterPositions: Vector3[] = []
    const textureCenterX = textureWidth / 2

    const estimateCharWidth = (char: string, fontSize: number) => {
      // Rough estimate: CJK chars are square, others vary
      const isCJK = /[\u4e00-\u9fa5\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/.test(char)
      return isCJK ? fontSize * 0.9 : fontSize * 0.5
    }

    // Calculate positions for main text lines
    lines.forEach((line, lineIndex) => {
      const fontSize = 190
      const y = baseY + lineIndex * mainLineHeight
      const lineChars = Array.from(line)
      const totalWidth = lineChars.reduce((sum, char) => sum + estimateCharWidth(char, fontSize), 0)
      let x = textureCenterX - totalWidth / 2

      lineChars.forEach((char) => {
        if (char.trim()) { // Skip spaces
          const charWidth = estimateCharWidth(char, fontSize)
          // Convert texture coords to mesh local coords
          const localX = ((x + charWidth / 2 - textureCenterX) / textureWidth) * planeWidth
          const localY = ((textureHeight / 2 - y) / textureHeight) * planeHeight
          letterPositions.push(new Vector3(localX, localY, 0))
          x += charWidth
        } else {
          x += estimateCharWidth(char, fontSize)
        }
      })
    })

    // Calculate positions for romanization lines
    if (romLines.length) {
      romLines.forEach((line, lineIndex) => {
        const fontSize = 85
        const y =
          baseY +
          lines.length * mainLineHeight +
          romanGap +
          romanLineHeight / 2 +
          lineIndex * romanLineHeight
        const lineChars = Array.from(line)
        const totalWidth = lineChars.reduce((sum, char) => sum + estimateCharWidth(char, fontSize), 0)
        let x = textureCenterX - totalWidth / 2

        lineChars.forEach((char) => {
          if (char.trim()) { // Skip spaces
            const charWidth = estimateCharWidth(char, fontSize)
            const localX = ((x + charWidth / 2 - textureCenterX) / textureWidth) * planeWidth
            const localY = ((textureHeight / 2 - y) / textureHeight) * planeHeight
            letterPositions.push(new Vector3(localX, localY, 0))
            x += charWidth
          } else {
            x += estimateCharWidth(char, fontSize)
          }
        })
      })
    }

    return { mesh, baseWidth: planeWidth, baseHeight: planeHeight, letterPositions }
  }

  const setPhraseHighlight = (mesh: Mesh, strength: number) => {
    const material = mesh.material
    if (!(material instanceof StandardMaterial)) {
      return
    }
    const base =
      (mesh.metadata as { baseEmissive?: Color3 } | undefined)?.baseEmissive ??
      material.emissiveColor
    const boosted = scaleColor(base, 1 + strength * 0.8)
    material.emissiveColor.copyFrom(boosted)
  }

  const laneToPosition = (lane: number) => {
    const row = Math.floor(lane / 2)
    const col = lane % 2
    return new Vector3(
      LANE_COLS[col] ?? GRID.leftX,
      LANE_ROWS[row] ?? GRID.bottomY,
      PHRASE_START_Z
    )
  }

  const ensureEntryBuffer = async (min: number) => {
    if (disposed || fetchingEntries || entryBuffer.length >= min) {
      return
    }
    fetchingEntries = true
    try {
      const needed = Math.max(min - entryBuffer.length, 4)
      if (hostApi.getRandomEntries) {
        const batch = await hostApi.getRandomEntries(needed)
        entryBuffer.push(...batch)
      } else if (hostApi.getRandomEntry) {
        for (let i = 0; i < needed; i += 1) {
          const entry = await hostApi.getRandomEntry()
          if (entry) {
            entryBuffer.push(entry)
          }
        }
      }
    } catch {
      // Ignore host API fetch failures.
    } finally {
      fetchingEntries = false
    }
  }

  const buildRound = async (generation: number) => {
    if (disposed) {
      return
    }
    const state = gameStore.getState()
    if (state.roundLoading) {
      return
    }
    gameStore.update((draft) => {
      draft.roundLoading = true
    })
    try {
      await ensureEntryBuffer(4)
      if (disposed) {
        return
      }
      for (let attempt = 0; attempt < 8; attempt += 1) {
        const entry = entryBuffer.shift()
        if (!entry) {
          await ensureEntryBuffer(2)
          if (disposed) {
            return
          }
          continue
        }
        const lookup = buildEntryLookup(entry.translations)
        const stackConfig = gameStore.getState().stackConfig
        const { promptLang, answerLang, singleLanguage } = pickLanguages(stackConfig)
        const prompt = pickByLang(lookup.textByCode, promptLang)
        const answer = pickByLang(lookup.textByCode, answerLang)
        if (!prompt || !answer) {
          continue
        }
        if (generation !== gameStore.getState().roundGeneration) {
          return
        }
        const promptRomanization = pickByLang(lookup.romByCode, promptLang)
        const answerRomanization = pickByLang(lookup.romByCode, answerLang)
        await ensureEntryBuffer(4)
        if (disposed) {
          return
        }
        const distractors: PhraseSpec[] = []
        const { dynamicDistractors } = getSettings()
        for (
          let attempt = 0;
          attempt < 14 && distractors.length < dynamicDistractors;
          attempt += 1
        ) {
          const candidate = entryBuffer.shift()
          if (!candidate) {
            await ensureEntryBuffer(2)
            if (disposed) {
              return
            }
            continue
          }
          const candidateLookup = buildEntryLookup(candidate.translations)
          const text = pickByLang(candidateLookup.textByCode, answerLang)
          if (!text || text === answer) {
            continue
          }
          const romanization = pickByLang(candidateLookup.romByCode, answerLang)
          distractors.push({
            id: `wrong-${candidate.entry_id}-${Date.now()}`,
            text,
            romanization,
            lang: answerLang,
            isCorrect: false,
          })
        }
        const roundId = `round-${entry.entry_id}-${Date.now()}`
        const correct: PhraseSpec = {
          id: `correct-${roundId}-${Date.now()}`,
          text: answer,
          romanization: answerRomanization,
          lang: answerLang,
          isCorrect: true,
        }

        // Always include correct answer in choices pool
        // Difficulty is controlled by spawn probability in pickNextPhrase()
        const choices = shuffle([correct, ...distractors])

        const nextRound: RoundState = {
          id: roundId,
          promptLang,
          answerLang,
          prompt,
          promptRomanization,
          answer,
          answerRomanization,
          choices,
          singleLanguage,
        }
        beginIntro(nextRound)
        return
      }
    } finally {
      gameStore.update((draft) => {
        draft.roundLoading = false
      })
    }
  }

  const clearActivePhrase = (phrase?: PhraseInstance) => {
    const state = gameStore.getState()
    if (phrase) {
      // Remove specific phrase
      phrase.surfaceEffects?.dispose()
      phrase.mesh.dispose()
      gameStore.update((draft) => {
        draft.activePhrases = draft.activePhrases.filter((p) => p !== phrase)
      })
    } else {
      // Clear all phrases
      state.activePhrases.forEach((p) => {
        p.surfaceEffects?.dispose()
        p.mesh.dispose()
      })
      gameStore.update((draft) => {
        draft.activePhrases = []
      })
    }
  }

  const startNewRound = () => {
    gameStore.update((draft) => {
      draft.roundGeneration += 1
      draft.round = null
      draft.roundSolved = false
      draft.roundLoading = false
      draft.lastPhraseId = null
      draft.lastLane = -1
      draft.spawnCooldown = 0
      draft.incorrectStreak = 0
      draft.phase = "intro"
      draft.hasSpokenMissedAnswer = false
    })
    clearActivePhrase()
    clearTransition()
    hudPromptLabel.textContent = getPromptLabel()
    updatePromptText(null)
    clearSpeakRepeat()
    void buildRound(gameStore.getState().roundGeneration)
  }

  // Helper for array comparison
  const arraysEqual = (a: unknown[], b: unknown[]) => {
    if (a.length !== b.length) return false
    return a.every((val, idx) => val === b[idx])
  }

  const updateStackConfig = (next: StackConfig) => {
    const prev = gameStore.getState().stackConfig

    // Deep equality check to avoid unnecessary updates
    const hasChanged = (
      !prev ||
      !arraysEqual(prev.languages, next.languages) ||
      !arraysEqual(prev.domains, next.domains) ||
      !arraysEqual(prev.levels, next.levels) ||
      prev.rate !== next.rate ||
      prev.textSize !== next.textSize ||
      prev.showRomanization !== next.showRomanization
    )

    if (!hasChanged) {
      return // Skip update if nothing changed
    }

    const normalized = {
      ...next,
      languages: [...next.languages],
      domains: [...next.domains],
      levels: [...next.levels],
    }
    gameStore.update((draft) => {
      draft.stackConfig = normalized
    })
    if (prev?.showRomanization !== normalized.showRomanization) {
      updatePromptText(gameStore.getState().round)
    }
  }

  if (hostApi.onStackConfigChange) {
    stackUnsubscribe = hostApi.onStackConfigChange(updateStackConfig)
  }

  const updatePromptVisibility = () => {
    const enabled = showPrompt
    phraseHud.style.display = enabled ? "flex" : "none"
  }

  function getPromptLabel() {
    const current = gameStore.getState().round
    if (current) {
      // Single-language (listening-match) rounds have no source→target
      // direction to show; the player matches by ear, so just say "Listen".
      if (current.singleLanguage) {
        return t("phrase.listen")
      }
      return `${current.promptLang.toUpperCase()} → ${current.answerLang.toUpperCase()}`
    }
    return t("phrase.listen")
  }

  const setPromptStatus = (text: string, isBad = false) => {
    if (promptStatusTimeout) {
      window.clearTimeout(promptStatusTimeout)
      promptStatusTimeout = null
    }
    hudPromptLabel.textContent = text
    hudPromptLabel.classList.toggle("bad", isBad)
    promptStatusTimeout = window.setTimeout(() => {
      hudPromptLabel.textContent = getPromptLabel()
      hudPromptLabel.classList.remove("bad")
      promptStatusTimeout = null
    }, 850)
  }

  function updatePromptText(nextRound: RoundState | null) {
    phraseHud.classList.remove("match")
    hudPromptLabel.textContent = getPromptLabel()
    if (!nextRound) {
      hudPrompt.textContent = t("phrase.waiting")
      hudPromptRomanization.textContent = ""
      hudAnswer.textContent = ""
      hudAnswerRomanization.textContent = ""
      hudAnswer.style.display = "none"
      hudAnswerRomanization.style.display = "none"
      return
    }
    // Listening-match (single-language) rounds hide the written prompt so the
    // player must recognize it by ear among the gates. We show a speaker cue
    // instead of the text — revealing the phrase would make the match trivial.
    if (nextRound.singleLanguage) {
      hudPrompt.textContent = t("phrase.listen_cue")
      hudPromptRomanization.textContent = ""
      hudPromptRomanization.style.display = "none"
    } else {
      hudPrompt.textContent = nextRound.prompt
      if (
        gameStore.getState().stackConfig?.showRomanization &&
        nextRound.promptRomanization
      ) {
        hudPromptRomanization.textContent = nextRound.promptRomanization
        hudPromptRomanization.style.display = "block"
      } else {
        hudPromptRomanization.textContent = ""
        hudPromptRomanization.style.display = "none"
      }
    }
    hudAnswer.textContent = ""
    hudAnswerRomanization.textContent = ""
    hudAnswer.style.display = "none"
    hudAnswerRomanization.style.display = "none"
  }

  const showMatchHud = (nextRound: RoundState) => {
    phraseHud.classList.add("match")
    hudPromptLabel.textContent = t("phrase.matched")
    hudPrompt.textContent = nextRound.prompt
    if (
      gameStore.getState().stackConfig?.showRomanization &&
      nextRound.promptRomanization
    ) {
      hudPromptRomanization.textContent = nextRound.promptRomanization
      hudPromptRomanization.style.display = "block"
    } else {
      hudPromptRomanization.textContent = ""
      hudPromptRomanization.style.display = "none"
    }
    // Single-language rounds: prompt and answer are the same phrase, so the
    // celebration is the moment we finally reveal what they heard (shown via
    // hudPrompt above). Showing it twice as the "answer" row would just
    // duplicate the line, so skip the answer row here.
    if (nextRound.singleLanguage) {
      hudAnswer.textContent = ""
      hudAnswer.style.display = "none"
      hudAnswerRomanization.textContent = ""
      hudAnswerRomanization.style.display = "none"
      return
    }
    hudAnswer.textContent = nextRound.answer
    hudAnswer.style.display = "block"
    if (
      gameStore.getState().stackConfig?.showRomanization &&
      nextRound.answerRomanization
    ) {
      hudAnswerRomanization.textContent = nextRound.answerRomanization
      hudAnswerRomanization.style.display = "block"
    } else {
      hudAnswerRomanization.textContent = ""
      hudAnswerRomanization.style.display = "none"
    }
  }

  const clearSpeakRepeat = () => {
    if (speakRepeatTimeout) {
      window.clearTimeout(speakRepeatTimeout)
      speakRepeatTimeout = null
    }
  }

  const scheduleSpeakRepeat = () => {
    clearSpeakRepeat()
    if (disposed) {
      return
    }
    if (paused) {
      return
    }
    const state = gameStore.getState()
    if (!state.round || state.roundSolved) {
      return
    }
    const roundId = state.round.id

    // Calculate delay based on phrase length + base gap (~5s after phrase finishes)
    const phraseText = state.round.prompt
    const speakDuration = estimateSpeechDuration(phraseText)
    const baseGap = getSettings().speakRepeatMs
    const totalDelay = speakDuration + baseGap

    speakRepeatTimeout = window.setTimeout(() => {
      if (disposed) {
        return
      }
      if (paused) {
        return
      }
      const current = gameStore.getState()
      if (!current.round || current.roundSolved || current.round.id !== roundId) {
        return
      }
      hostApi.speak(current.round.promptLang, current.round.prompt)
      scheduleSpeakRepeat()
    }, totalDelay)
  }

  const onPromptToggle = () => {
    showPrompt = promptToggleInput.checked
    updatePromptVisibility()
  }
  promptToggleInput.addEventListener("change", onPromptToggle)
  updatePromptVisibility()

  const syncTuningControls = () => {
    // 0.2.0: all tuning controls now live in the bottom drawer and
    // bind directly to `tuningStore` through `createSettingsDrawer`,
    // so there's nothing to sync from the outside anymore. Kept as a
    // no-op so call-sites don't need to be touched.
  }

  const updateStatsHud = () => {
    const { score, streak, bestStreak, netCorrect } = tuningStore.getState().stats
    const netStr = `${netCorrect >= 0 ? "+" : ""}${netCorrect}`
    hudScore.textContent = t("hud.score_with_net", { n: score, net: netStr })
    hudStreak.textContent = t("hud.streak_with_best", { n: streak, best: bestStreak })
  }

  syncTuningControls()
  updateStatsHud()
  tuningUnsubscribe = tuningStore.subscribe(() => {
    syncTuningControls()
    updateStatsHud()
  })

  const setTransitionTimeout = (fn: () => void, delay: number) => {
    const id = window.setTimeout(fn, delay)
    transitionTimeouts.push(id)
  }

  const clearTransition = () => {
    while (transitionTimeouts.length) {
      const id = transitionTimeouts.pop()
      if (id) {
        window.clearTimeout(id)
      }
    }
    phraseHud.classList.remove("match", "intro", "celebrate")
  }

  const beginIntro = (nextRound: RoundState) => {
    clearTransition()
    // Clear electric field when entering intro phase
    electricTarget = null
    electricTargetPhrase = null
    electricIntensity = 0
    gameStore.update((draft) => {
      draft.round = nextRound
      draft.roundSolved = false
      draft.phase = "intro"
      draft.activePhrases = []
      draft.lastPhraseId = null
      draft.lastLane = -1
      draft.spawnCooldown = 0
      draft.incorrectStreak = 0
      draft.hasSpokenMissedAnswer = false
    })
    clearActivePhrase()
    updatePromptText(nextRound)
    phraseHud.classList.add("intro")
    clearSpeakRepeat()
    hostApi.speak(nextRound.promptLang, nextRound.prompt)

    const { introRepeatMs, promptLeadMs } = getSettings()
    const firstSpeakMs = estimateSpeakMs(nextRound.prompt, nextRound.promptLang)
    const dynamicIntroMs = getPhraseDuration(nextRound.prompt, nextRound.promptLang, 800)
    const holdMs = Math.max(dynamicIntroMs, firstSpeakMs + 200)
    const gapMs = Math.max(introRepeatMs, 200)
    const secondSpeakMs = estimateSpeakMs(nextRound.prompt, nextRound.promptLang)
    setTransitionTimeout(() => {
      phraseHud.classList.remove("intro")
      setTransitionTimeout(() => {
        hostApi.speak(nextRound.promptLang, nextRound.prompt)
        setTransitionTimeout(() => {
          gameStore.update((draft) => {
            draft.phase = "play"
            draft.spawnCooldown = 0
          })
          scheduleSpeakRepeat()
        }, secondSpeakMs + promptLeadMs)
      }, gapMs)
    }, holdMs)
  }

  const startCelebration = (nextRound: RoundState) => {
    clearTransition()
    // Clear electric field immediately when entering celebration
    electricTarget = null
    electricTargetPhrase = null
    electricIntensity = 0
    gameStore.update((draft) => {
      draft.phase = "celebrate"
    })
    showMatchHud(nextRound)
    phraseHud.classList.add("celebrate")
    clearSpeakRepeat()
    hostApi.speak(nextRound.answerLang, nextRound.answer)
    const promptDuration = estimateSpeakMs(nextRound.prompt, nextRound.promptLang)
    const answerDuration = estimateSpeakMs(nextRound.answer, nextRound.answerLang)
    const speakGapMs = 220
    setTransitionTimeout(() => {
      hostApi.speak(nextRound.promptLang, nextRound.prompt)
    }, answerDuration + speakGapMs)
    // Give CJK languages more base time in celebration for comprehension
    const isCJK = /^(zh|ja|ko)/i.test(nextRound.answerLang)
    const celebrationBaseMs = isCJK ? 900 : 600
    const dynamicCelebrationMs = getPhraseDuration(
      nextRound.answer,
      nextRound.answerLang,
      celebrationBaseMs
    )
    const celebrationDelay = Math.max(
      dynamicCelebrationMs,
      answerDuration + speakGapMs + promptDuration + 250
    )
    setTransitionTimeout(() => {
      // Hard daily cap: the phrase just celebrated was the last one counted by
      // note(). If the free user has now reached the cap, do NOT start the next
      // round — re-show the accomplishment-lock overlay instead. Subscribers
      // never block. They got EXACTLY the daily cap (QUOTAS.hover_phrases).
      if (paywallGate.isBlocked()) {
        paywallGate.requestDailyLock()
        return
      }
      startNewRound()
    }, celebrationDelay + getSettings().postCelebrateMs)
  }

  const spawnPhrase = (spec: PhraseSpec, lane: number) => {
    const { mesh, baseWidth, baseHeight, letterPositions } = createPhraseMesh(spec)
    const startPos = laneToPosition(lane)
    mesh.position.copyFrom(startPos)
    const baseY = startPos.y
    const newPhrase: PhraseInstance = { spec, mesh, lane, baseWidth, baseHeight, baseY, letterPositions }
    gameStore.update((draft) => {
      draft.activePhrases.push(newPhrase)
      draft.lastLane = lane
      draft.lastPhraseId = spec.id
    })
  }

  const pickNextPhrase = () => {
    const state = gameStore.getState()
    const choices = state.round?.choices ?? []
    if (!choices.length) {
      return null
    }
    const { dynamicMaxMisses, dynamicCorrectProb } = getSettings()
    const correct = choices.find((choice) => choice.isCorrect) ?? null
    // Force correct answer after too many misses
    if (correct && state.incorrectStreak >= dynamicMaxMisses) {
      return correct
    }
    let pool = choices
    if (choices.length > 1 && state.lastPhraseId) {
      const filtered = choices.filter((choice) => choice.id !== state.lastPhraseId)
      if (filtered.length) {
        pool = filtered
      }
    }
    // Calculate weight for correct answer based on desired probability
    // If correctProb = 0.5 and we have 3 distractors (weight 1 each):
    //   correctWeight = 0.5 * 3 / (1 - 0.5) = 3.0
    // If correctProb = 0.1 and we have 5 distractors:
    //   correctWeight = 0.1 * 5 / (1 - 0.1) = 0.556
    const distractorCount = pool.filter((c) => !c.isCorrect).length
    const targetProb = clamp(dynamicCorrectProb, 0.05, 0.95) // Avoid division by zero
    const correctWeight = distractorCount * targetProb / (1 - targetProb)

    let total = 0
    const weights = pool.map((choice) => {
      const weight = choice.isCorrect ? correctWeight : 1
      total += weight
      return weight
    })
    if (total <= 0) {
      return pickRandom(pool)
    }
    let pick = Math.random() * total
    for (let i = 0; i < pool.length; i += 1) {
      pick -= weights[i]
      if (pick <= 0) {
        return pool[i]
      }
    }
    return pool[pool.length - 1] ?? null
  }

  const pickLane = (lastLane: number) => {
    let lane = Math.floor(Math.random() * 6)
    if (lane === lastLane) {
      lane = (lane + 1 + Math.floor(Math.random() * 5)) % 6
    }
    return lane
  }

  const updatePhrases = (dt: number) => {
    if (disposed) {
      return
    }
    const state = gameStore.getState()
    if (!state.round && !state.roundLoading) {
      void buildRound(state.roundGeneration)
    }
    if (state.phase !== "play") {
      return
    }

    // Spawn new phrases if needed (staggered spawning for chaos mode)
    // Use ceil to allow smooth float-based phrase count
    const maxPhrases = Math.ceil(tuningStore.getState().runtime.currentPhraseCount)
    if (!state.roundSolved && state.activePhrases.length < maxPhrases) {
      if (state.spawnCooldown > 0) {
        gameStore.update((draft) => {
          draft.spawnCooldown = Math.max(0, draft.spawnCooldown - dt)
        })
      }
      const refreshed = gameStore.getState()
      if (
        refreshed.round &&
        refreshed.activePhrases.length < maxPhrases &&
        refreshed.spawnCooldown <= 0
      ) {
        const spec = pickNextPhrase()
        if (spec) {
          spawnPhrase(spec, pickLane(refreshed.lastLane))
          // Calculate even spacing: divide travel time by number of phrases
          const speed = getPhraseSpeed()
          const travelDistance = PHRASE_START_Z - PHRASE_END_Z
          const travelTime = travelDistance / speed
          // Spawn phrases 25% more frequently for better flow
          const baseSpawnInterval = travelTime / (maxPhrases * 1.25)
          // Add random noise for variety (+/- 15%)
          const noise = (Math.random() - 0.5) * 0.3 * baseSpawnInterval
          const spawnInterval = Math.max(0.3, baseSpawnInterval + noise)
          gameStore.update((draft) => {
            draft.spawnCooldown = spawnInterval
          })
        }
      }
    }

    const activePhrases = gameStore.getState().activePhrases
    if (activePhrases.length === 0) {
      electricTarget = null
      electricTargetPhrase = null
      electricIntensity = 0
      return
    }

    // Calculate player's current lane once
    const isTiltActive = input.state.tiltEnabled && input.state.tiltActive
    const midX = (GRID.leftX + GRID.rightX) * 0.5
    const rowCutA = (GRID.topY + GRID.midY) * 0.5
    const rowCutB = (GRID.midY + GRID.bottomY) * 0.5
    const hoverCol = hoverboard.root.position.x < midX ? 0 : 1
    const hoverRow =
      hoverboard.root.position.y > rowCutA
        ? 0
        : hoverboard.root.position.y > rowCutB
          ? 1
          : 2
    const hoverLane = hoverRow * 2 + hoverCol
    highlightTime += dt
    const pulse = 0.4 + Math.sin(highlightTime * 5) * 0.2

    // Find the closest phrase in the player's lane ONLY
    let closestInLane: PhraseInstance | null = null
    let closestDistance = Infinity
    for (const phrase of activePhrases) {
      if (phrase.lane === hoverLane && phrase.mesh.position.z > PHRASE_HIT_Z) {
        const distance = phrase.mesh.position.z - PHRASE_HIT_Z
        if (distance < closestDistance) {
          closestDistance = distance
          closestInLane = phrase
        }
      }
    }

    // Set electric field target to closest phrase
    const newTarget = closestInLane ? closestInLane.mesh : null
    const targetChanged = electricTarget !== newTarget
    electricTarget = newTarget
    electricTargetPhrase = closestInLane

    // Increase electric intensity when closer to target
    if (closestInLane) {
      const normalizedDistance = clamp(closestDistance / (PHRASE_START_Z - PHRASE_HIT_Z), 0, 1)
      electricIntensity = 1.2 - normalizedDistance * 0.2 // 1.2 when close, 1.0 when far
      if (debugElectricTarget && targetChanged) {
        console.log("Electric target LOCKED:", {
          phraseLane: closestInLane.lane,
          playerLane: hoverLane,
          phraseZ: closestInLane.mesh.position.z.toFixed(2),
          distance: closestDistance.toFixed(2),
          intensity: electricIntensity.toFixed(2),
        })
      }
    } else {
      electricIntensity = 0
      electricTargetPhrase = null
      if (debugElectricTarget && targetChanged && electricTarget === null) {
        console.log("Electric target LOST - no phrase in lane", {
          playerLane: hoverLane,
          totalPhrases: activePhrases.length,
          phraseLanes: activePhrases.map((p) => p.lane),
        })
      }
    }

    // Process each active phrase
    for (const current of activePhrases) {
      current.mesh.position.z -= getPhraseSpeed() * dt
      const depth = clamp(
        (PHRASE_START_Z - current.mesh.position.z) / (PHRASE_START_Z - PHRASE_HIT_Z),
        0,
        1
      )
      const targetScale = 0.85 + depth * 2.3
      current.mesh.scaling.x = targetScale
      current.mesh.scaling.y = targetScale

      // Gentle arc trajectory: phrases start elevated and descend to lane height
      // Uses parabolic curve for natural motion
      const arcProgress = 1 - depth // 1 when far, 0 when close
      const arcHeight = 2.0 // Max height offset when far away
      const yOffset = arcProgress * arcProgress * arcHeight
      current.mesh.position.y = current.baseY + yOffset

      const laneMatch = hoverLane === current.lane
      const isElectricTarget = current === closestInLane
      // Electric target gets modest highlight boost - keeping text readable
      const highlightStrength = isElectricTarget ? pulse * 1.4 : (laneMatch ? pulse * 0.6 : 0)
      setPhraseHighlight(current.mesh, highlightStrength)

      // Create surface effects for electric target
      if (isElectricTarget && electricIntensity > 0.2) {
        if (!current.surfaceEffects) {
          current.surfaceEffects = createPhraseSurfaceEffects(
            scene,
            current.mesh,
            activeSkin.palette.center
          )
        }
        // Update with reduced intensity for cleaner text readability
        current.surfaceEffects.update(dt, electricIntensity * 0.5)
      } else if (current.surfaceEffects) {
        // Fade out surface effects when no longer target
        current.surfaceEffects.update(dt, 0)
      }

      const dx = current.mesh.position.x - hoverboard.root.position.x
      const dy = current.mesh.position.y - hoverboard.root.position.y
      const dz = current.mesh.position.z - PHRASE_HIT_Z
      const isHit =
        Math.abs(dz) <= PHRASE_HIT_WINDOW &&
        (isTiltActive
          ? hoverLane === current.lane
          : Math.hypot(dx, dy) < 0.6)
      const hasPassed = current.mesh.position.z < PHRASE_HIT_Z - PHRASE_HIT_WINDOW

      if (isHit) {
        const round = gameStore.getState().round
        const phrasePosition = current.mesh.position.clone()
        clearActivePhrase(current)
        // Immediately clear electric field when phrase is hit
        electricTarget = null
        electricTargetPhrase = null
        electricIntensity = 0
        gameStore.update((draft) => {
          draft.spawnCooldown = getSettings().respawnDelay
        })
        if (current.spec.isCorrect && round && !gameStore.getState().roundSolved) {
          gameStore.update((draft) => {
            draft.roundSolved = true
            draft.incorrectStreak = 0
          })
          if (tuningStore.getState().settings.sfxEnabled) sfx.playSuccess()
          const points = getPhraseScore(round.answer, round.answerLang)
          tuningStore.getState().recordCorrect(points)
          hoverboard.adjustParticleIntensity?.(true)
          tuningStore.getState().recordPhraseResult(
            current.spec.id,
            round.promptLang,
            round.answerLang,
            true
          )
          scoreAnimator.showScorePopup(points)
          createSuccessParticles(scene, phrasePosition)
          // One phrase completed — advance the soft action gate's count.
          paywallGate.note()
          startCelebration(round)
        } else if (!current.spec.isCorrect) {
          gameStore.update((draft) => {
            draft.incorrectStreak += 1
          })
          const round = gameStore.getState().round
          tuningStore.getState().recordWrong()
          hoverboard.adjustParticleIntensity?.(false)
          if (round) {
            tuningStore.getState().recordPhraseResult(
              current.spec.id,
              round.promptLang,
              round.answerLang,
              false
            )
          }
          if (tuningStore.getState().settings.sfxEnabled) sfx.playFail()
          createFailParticles(scene, phrasePosition)
          triggerScreenShake()
          setPromptStatus(t("phrase.wrong"), true)
        }
        continue
      }

      if (hasPassed) {
        const passedPosition = current.mesh.position.clone()
        clearActivePhrase(current)
        gameStore.update((draft) => {
          draft.spawnCooldown = getSettings().respawnDelay
        })
        if (current.spec.isCorrect) {
          const round = gameStore.getState().round
          const hasSpoken = gameStore.getState().hasSpokenMissedAnswer
          gameStore.update((draft) => {
            draft.incorrectStreak = getSettings().dynamicMaxMisses
            if (!hasSpoken) {
              draft.hasSpokenMissedAnswer = true
            }
          })
          tuningStore.getState().recordWrong()
          hoverboard.adjustParticleIntensity?.(false)
          if (tuningStore.getState().settings.sfxEnabled) sfx.playFail()
          createFailParticles(scene, passedPosition)
          triggerScreenShake()
          setPromptStatus(t("phrase.missed"), true)
          if (round && !hasSpoken) {
            hostApi.speak(round.answerLang, round.answer)
          }
        } else {
          // Successfully dodged a wrong answer - no miss increment!
          tuningStore.getState().recordDodge()
          scoreAnimator.showScorePopup(1)
          if (tuningStore.getState().settings.sfxEnabled) sfx.playSuccess()
        }
        continue
      }

      if (current.mesh.position.z < PHRASE_END_Z) {
        const endPosition = current.mesh.position.clone()
        clearActivePhrase(current)
        gameStore.update((draft) => {
          draft.spawnCooldown = getSettings().respawnDelay
        })
        if (current.spec.isCorrect) {
          const round = gameStore.getState().round
          const hasSpoken = gameStore.getState().hasSpokenMissedAnswer
          gameStore.update((draft) => {
            draft.incorrectStreak = getSettings().dynamicMaxMisses
            if (!hasSpoken) {
              draft.hasSpokenMissedAnswer = true
            }
          })
          tuningStore.getState().recordWrong()
          hoverboard.adjustParticleIntensity?.(false)
          if (tuningStore.getState().settings.sfxEnabled) sfx.playFail()
          createFailParticles(scene, endPosition)
          triggerScreenShake()
          setPromptStatus(t("phrase.missed"), true)
          if (round && !hasSpoken) {
            hostApi.speak(round.answerLang, round.answer)
          }
        } else {
          // Successfully dodged a wrong answer - no miss increment!
          tuningStore.getState().recordDodge()
          scoreAnimator.showScorePopup(1)
          if (tuningStore.getState().settings.sfxEnabled) sfx.playSuccess()
        }
      }
    }
  }

  startNewRound()

  const updatePlayer = (dt: number) => {
    if (input.state.tiltEnabled && input.state.tiltActive) {
      const tX = (input.state.tiltX + 1) / 2
      const tY = (input.state.tiltY + 1) / 2
      target.x = lerp(GRID.leftX, GRID.rightX, tX)
      target.y = lerp(GRID.bottomY, GRID.topY, tY)
    } else {
      target.x = input.state.col === 0 ? GRID.leftX : GRID.rightX
      target.y = rowToY(input.state.row, GRID)
    }
    target.z = GRID.z

    const smoothing = 1 - Math.exp(-MOVE_SPEED * dt)
    Vector3.LerpToRef(hoverboard.root.position, target, smoothing, hoverboard.root.position)

    velocity.copyFrom(hoverboard.root.position).subtractInPlace(lastPos)
    lastPos.copyFrom(hoverboard.root.position)

    hoverTime += dt
    const activePivot = hoverboard.getActivePivot()
    const activeBoard = hoverboard.getActiveBoard()
    activePivot.position.y = 0.08 + Math.sin(hoverTime * 5) * 0.03

    hoverboard.updateLogo?.(hoverTime, camera)

    hoverboard.updateSacredGeometries?.(hoverTime, dt)

    // Update visual progression based on level + netCorrect
    const stats = tuningStore.getState().stats
    const currentLevel = stats.level
    const netCorrect = stats.netCorrect
    const seed = stats.allTimeBestStreak || 1 // Use allTimeBestStreak as seed for reproducibility

    // Only reconfigure geometries when progression actually changes
    if (currentLevel !== lastProgressionLevel || netCorrect !== lastProgressionNetCorrect) {
      lastProgressionLevel = currentLevel
      lastProgressionNetCorrect = netCorrect

      // Cache progression for reuse in render loop (electric field)
      cachedProgression = getProgressionParams(currentLevel, netCorrect, seed)

      hoverboard.updateRings?.(
        cachedProgression.ringHeightOffset,
        cachedProgression.ringAlpha,
        cachedProgression.ringCount,
        cachedProgression.ringScale
      )

      // Configure sacred geometries from pool (no create/destroy for performance)
      hoverboard.configureGeometries?.(cachedProgression.sacredGeometries)
      console.log(`[PROGRESSION] Level ${currentLevel}, NetCorrect ${netCorrect}, Geometries: ${cachedProgression.sacredGeometries.length}`)
    }

    activeBoard.rotation.z = clamp(-velocity.x * 4, -0.45, 0.45)
    activeBoard.rotation.x = clamp(velocity.y * 6, -0.35, 0.35)
  }

  let cameraTargetY = -1.05
  const updateCameraForViewport = () => {
    const width = engine.getRenderWidth()
    const height = engine.getRenderHeight()
    const minWidth = 320
    const widthFactor = clamp((width - minWidth) / 520, 0, 1)
    const heightFactor = clamp((height - 520) / 360, 0, 1)
    const narrowFactor = 1 - widthFactor
    const shortFactor = 1 - heightFactor

    camera.fov = lerp(1.68, 1.38, widthFactor)
    camera.position.y = lerp(-0.35, 0.2, widthFactor)
    camera.position.z = lerp(-3.85, -4.7, widthFactor)
    cameraTargetY = lerp(-1.35, -0.75, widthFactor) - shortFactor * 0.28
    camera.position.y -= shortFactor * 0.4
    camera.position.z += narrowFactor * 0.2
  }

  updateCameraForViewport()

  // Frame counter for performance optimizations
  let frameCount = 0
  const cameraTarget = new Vector3()
  let fpsTimer = 0
  let perfTimer = 0
  let lastLongFrameLog = 0

  engine.runRenderLoop(() => {
    const dt = Math.min(engine.getDeltaTime() / 1000, 0.05)
    const dtMs = dt * 1000
    if (!paused) {
      frameCount++
      road.update(dt, frameCount)
      sky.update(dt)
      updatePlayer(dt)
      updatePhrases(dt)
      updatePropField(activeSkin.props, road, frameCount)

      // Apply visual progression to electric field (use cached progression)
      if (cachedProgression) {
        electricField.update(
          dt,
          electricTarget,
          electricIntensity,
          electricTargetPhrase?.letterPositions,
          cachedProgression.mainArcCount,
          cachedProgression.branchArcCount,
          cachedProgression.electricIntensity
        )
      }
    }
    const farX = road.getFarCenterX()
    cameraTarget.set(
      farX * 0.2 + shakeOffset.x,
      cameraTargetY + shakeOffset.y,
      10 + shakeOffset.z
    )
    camera.setTarget(cameraTarget)
    scene.render()

    if (fpsHud) {
      fpsTimer += dt
      if (fpsTimer >= 0.25) {
        fpsHud.textContent = `${Math.round(engine.getFps())} fps`
        fpsTimer = 0
      }
    }

    if (perfHud) {
      perfTimer += dt
      if (perfTimer >= 0.25) {
        const fps = Math.round(engine.getFps())
        const frameMs = dtMs.toFixed(1)
        const gpuMs = engineInstrumentation?.gpuFrameTimeCounter?.current
        const renderMs = sceneInstrumentation?.renderTimeCounter?.current
        const interMs = sceneInstrumentation?.interFrameTimeCounter?.current
        const activeMeshes = scene.getActiveMeshes().length
        const totalMeshes = scene.meshes.length
        const textures = scene.textures.length
        const totalVertices = scene.getTotalVertices()
        const drawCalls =
          (engine as unknown as { getDrawCalls?: () => number }).getDrawCalls?.() ??
          (engine as unknown as { drawCalls?: number }).drawCalls ??
          0

        perfHud.textContent =
          `fps ${fps} | frame ${frameMs}ms\n` +
          `gpu ${gpuMs ? gpuMs.toFixed(1) : "n/a"}ms | render ${renderMs ? renderMs.toFixed(1) : "n/a"}ms\n` +
          `inter ${interMs ? interMs.toFixed(1) : "n/a"}ms | draws ${drawCalls}\n` +
          `meshes ${activeMeshes}/${totalMeshes} | verts ${totalVertices}\n` +
          `textures ${textures}`
        perfTimer = 0
      }
    }

    if (showPerf && dtMs > 40) {
      const now = performance.now()
      if (now - lastLongFrameLog > 1000) {
        lastLongFrameLog = now
        const gpuMs = engineInstrumentation?.gpuFrameTimeCounter?.current
        const renderMs = sceneInstrumentation?.renderTimeCounter?.current
        const activeMeshes = scene.getActiveMeshes().length
        const drawCalls =
          (engine as unknown as { getDrawCalls?: () => number }).getDrawCalls?.() ??
          (engine as unknown as { drawCalls?: number }).drawCalls ??
          0
        console.warn("[hover-runner][perf] long frame", {
          dtMs: Number(dtMs.toFixed(1)),
          gpuMs: gpuMs ? Number(gpuMs.toFixed(1)) : null,
          renderMs: renderMs ? Number(renderMs.toFixed(1)) : null,
          activeMeshes,
          drawCalls,
        })
      }
    }
  })

  const onResize = () => {
    if (disposed) {
      return
    }
    updateViewportSize()
    engine.setHardwareScalingLevel(
      1 / Math.min(window.devicePixelRatio || 1, maxDevicePixelRatio)
    )
    engine.resize()
    updateCameraForViewport()
  }

  let resizeFrame = 0
  let resizeTimeout: number | null = null
  const scheduleResize = () => {
    if (resizeFrame) {
      window.cancelAnimationFrame(resizeFrame)
    }
    resizeFrame = window.requestAnimationFrame(() => {
      resizeFrame = 0
      onResize()
    })
    if (resizeTimeout != null) {
      window.clearTimeout(resizeTimeout)
    }
    resizeTimeout = window.setTimeout(onResize, 250)
  }

  scheduleResize()
  window.addEventListener("resize", scheduleResize)
  window.addEventListener("orientationchange", scheduleResize)
  if (window.screen?.orientation) {
    window.screen.orientation.addEventListener("change", scheduleResize)
  }
  const visualViewport = window.visualViewport
  if (visualViewport) {
    visualViewport.addEventListener("resize", scheduleResize)
    visualViewport.addEventListener("scroll", scheduleResize)
  }

  const dispose = () => {
    if (disposed) {
      return
    }
    disposed = true

    if (promptStatusTimeout) {
      window.clearTimeout(promptStatusTimeout)
      promptStatusTimeout = null
    }
    clearSpeakRepeat()
    clearActivePhrase()
    clearTransition()
    clearAllParticleTimeouts()
    scoreAnimator.cleanup()
    stackUnsubscribe?.()
    tuningUnsubscribe?.()
    motionUnsubscribe?.()
    hostApi.stopSpeech?.()
    input.dispose()
    window.removeEventListener("keydown", onKeyDownGlobal)
    if (resizeFrame) {
      window.cancelAnimationFrame(resizeFrame)
      resizeFrame = 0
    }
    if (resizeTimeout != null) {
      window.clearTimeout(resizeTimeout)
      resizeTimeout = null
    }
    window.removeEventListener("resize", scheduleResize)
    window.removeEventListener("orientationchange", scheduleResize)
    if (window.screen?.orientation) {
      window.screen.orientation.removeEventListener("change", scheduleResize)
    }
    if (visualViewport) {
      visualViewport.removeEventListener("resize", scheduleResize)
      visualViewport.removeEventListener("scroll", scheduleResize)
    }
    document.removeEventListener("visibilitychange", onVisibilityChange)
    window.removeEventListener("pointerdown", onWakeLockGesture)
    window.removeEventListener("pointerdown", onPaywallInteraction, { capture: true })
    paywallGate.dispose()
    window.removeEventListener(
      "corpan:host-dispose",
      onHostDispose as EventListener
    )
    settingsDrawer.dispose()
    unsubUiLang()
    unsubHostLang?.()
    unsubMotionOverlay?.()
    motionOverlay?.dispose()
    motionOverlay = null
    skinSelect.removeEventListener("change", onSkinChange)
    skinCycle.removeEventListener("click", onSkinCycle)
    promptToggleInput.removeEventListener("change", onPromptToggle)
    if (wakeLock) {
      void wakeLock.release()
      wakeLock = null
    }
    sfx.dispose()
    // Dispose background particle systems
    ambientParticles.dispose()
    starfieldParticles.dispose()
    energyFieldLeft.dispose()
    energyFieldRight.dispose()
    speedLines.dispose()
    // Dispose post-processing pipelines
    ssao?.dispose()
    renderPipeline.dispose()
    sceneInstrumentation?.dispose()
    engineInstrumentation?.dispose()
    engine.stopRenderLoop()
    scene.dispose()
    engine.dispose()
    root.remove()
  }

  return { dispose }
}
