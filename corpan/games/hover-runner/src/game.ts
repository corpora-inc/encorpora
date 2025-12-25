import {
  Camera,
  Color3,
  Color4,
  DirectionalLight,
  DynamicTexture,
  Engine,
  GlowLayer,
  HemisphericLight,
  ImageProcessingConfiguration,
  Mesh,
  MeshBuilder,
  ParticleSystem,
  PBRMaterial,
  PointLight,
  Quaternion,
  Scene,
  SceneLoader,
  ShadowGenerator,
  StandardMaterial,
  TransformNode,
  Texture,
  UniversalCamera,
  Vector3,
} from "@babylonjs/core"
import "@babylonjs/loaders/glTF"
import { getSfx } from "./audio"
import { tuningStore } from "./tuningStore"
import type { EntryOut, HostApi, StackConfig, TranslationOut } from "./sdk/types"

// Import Corpán logo meshes as bundled assets (offline-first)
import pyramidStep1Url from "./assets/models/pyramid_step_1.glb"
import pyramidStep2Url from "./assets/models/pyramid_step_2.glb"
import pyramidStep3Url from "./assets/models/pyramid_step_3.glb"
import pyramidStep4Url from "./assets/models/pyramid_step_4.glb"
import earOuterUrl from "./assets/models/ear_outer.glb"
import earSpiralUrl from "./assets/models/ear_spiral.glb"

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max)

const lerp = (start: number, end: number, t: number) =>
  start + (end - start) * t

const colorToCss = (color: Color3, alpha = 1) =>
  `rgba(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)}, ${alpha})`

const scaleColor = (color: Color3, factor: number) =>
  new Color3(
    clamp(color.r * factor, 0, 1),
    clamp(color.g * factor, 0, 1),
    clamp(color.b * factor, 0, 1)
  )

/**
 * Calculate score points based on phrase length
 * CJK languages (Chinese, Japanese, Korean): character count
 * Other languages: word count
 */
const getPhraseScore = (text: string, lang: string): number => {
  // Detect CJK languages
  const isCJK = /^(zh|ja|ko)/i.test(lang)

  if (isCJK) {
    // For CJK, count characters (excluding spaces and punctuation)
    return text.replace(/[\s\p{P}]/gu, "").length
  } else {
    // For other languages, count words
    const words = text.trim().split(/\s+/)
    return words.filter((w) => w.length > 0).length
  }
}

/**
 * Calculate dynamic duration based on phrase length
 * Returns milliseconds = baseMs + (units * msPerUnit)
 * For CJK: units = characters, msPerUnit = 200ms
 * For other languages: units = words, msPerUnit = 200ms
 */
const getPhraseDuration = (text: string, lang: string, baseMs = 800): number => {
  const isCJK = /^(zh|ja|ko)/i.test(lang)
  const units = getPhraseScore(text, lang)

  if (isCJK) {
    // CJK: 200ms per character (more time for speech comprehension)
    return baseMs + units * 200
  } else {
    // Other: 200ms per word
    return baseMs + units * 200
  }
}

const createEmissivePbr = (
  name: string,
  scene: Scene,
  albedo: Color3,
  emissive: Color3,
  metallic = 0.2,
  roughness = 0.6
) => {
  const material = new PBRMaterial(name, scene)
  material.albedoColor = albedo
  material.emissiveColor = emissive
  material.metallic = metallic
  material.roughness = roughness
  return material
}

const tuneLogoMaterial = (material: PBRMaterial, sheenBoost = 1.15) => {
  material.clearCoat.isEnabled = true
  material.clearCoat.intensity = 0.9
  material.clearCoat.roughness = 0.08
  material.clearCoat.indexOfRefraction = 1.52
  material.sheen.isEnabled = true
  material.sheen.intensity = 0.35
  material.sheen.color = scaleColor(material.albedoColor, sheenBoost)
  material.emissiveColor = scaleColor(material.emissiveColor, 1.15)
}

const getSettings = () => tuningStore.getState().settings

const getPhraseSpeed = () => {
  const { basePhraseSpeed, phraseSpeedMin, phraseSpeedMax } = getSettings()
  const { speedDelta } = tuningStore.getState().runtime
  return clamp(basePhraseSpeed + speedDelta, phraseSpeedMin, phraseSpeedMax)
}

const pickRandom = <T,>(items: T[]) => {
  if (!items.length) {
    return null
  }
  const idx = Math.floor(Math.random() * items.length)
  return items[idx] ?? null
}

const GRID = {
  leftX: -2,
  rightX: 2,
  topY: 2,
  midY: -0.,
  bottomY: -2,
  z: 0.18,
}

const SECTOR = {
  width: Math.abs(GRID.rightX - GRID.leftX) * 0.95,
  height: Math.abs(GRID.topY - GRID.midY) * 1.05,
}

const ROAD = {
  width: 8.8,
  length: 90,
  segments: 50,
  speed: 20,
  curveAmount: 2,
  y: -3.0,
  zOffset: -10.0,
}

const MOVE_SPEED = 25
const PHRASE_START_Z = ROAD.length + ROAD.zOffset
const PHRASE_END_Z = -12
const PHRASE_HIT_Z = GRID.z
const PHRASE_HIT_WINDOW = 0.25
const LANE_ROWS = [GRID.topY, GRID.midY, GRID.bottomY]
const LANE_COLS = [GRID.leftX, GRID.rightX]

const computeCurve = (curveTime: number, z: number) => {
  const blend = Math.pow(z / ROAD.length, 1.35)
  return Math.sin(curveTime + z * 0.08) * ROAD.curveAmount * blend
}

const rowToY = (row: number) => {
  if (row <= 0) {
    return GRID.topY
  }
  if (row === 1) {
    return GRID.midY
  }
  return GRID.bottomY
}

const normalizeLang = (lang: string) => lang.trim().toLowerCase()

const isNoSpaceLanguage = (lang: string) => {
  const base = normalizeLang(lang).split("-")[0]
  return ["zh", "ja", "ko", "th", "lo", "km", "my"].includes(base)
}

const pickByLang = (map: Record<string, string>, lang: string) => {
  const desired = normalizeLang(lang)
  if (map[desired]) {
    return map[desired]
  }
  const base = desired.split("-")[0]
  if (map[base]) {
    return map[base]
  }
  const fallback = Object.entries(map).find(
    ([code]) => code.startsWith(base) || base.startsWith(code)
  )
  return fallback?.[1]
}

const buildEntryLookup = (translations: TranslationOut[]): EntryLookup => {
  const textByCode: Record<string, string> = {}
  const romByCode: Record<string, string> = {}
  translations.forEach((translation) => {
    const code = normalizeLang(translation.language_code)
    if (!textByCode[code]) {
      textByCode[code] = translation.text
    }
    if (translation.romanization && !romByCode[code]) {
      romByCode[code] = translation.romanization
    }
  })
  return { textByCode, romByCode }
}

const pickLanguages = (stack: StackConfig | null) => {
  const languages = stack?.languages?.length ? stack.languages : ["en"]
  if (languages.length === 1) {
    return { promptLang: languages[0], answerLang: languages[0] }
  }
  const promptLang = pickRandom(languages) ?? languages[0]
  const remaining = languages.filter((lang) => lang !== promptLang)
  const answerLang = pickRandom(remaining) ?? promptLang
  return { promptLang, answerLang }
}

type RoadPalette = {
  road: Color3
  emissive: Color3
  center: Color3
  edge: Color3
}

type RoadState = {
  mesh: Mesh
  update: (dt: number) => void
  getFarCenterX: () => number
  getTravel: () => number
  getCurveAt: (z: number) => number
  setPalette: (palette: RoadPalette) => void
}

const createRoadTexture = (scene: Scene, palette: RoadPalette) => {
  const size = 1024
  const texture = new DynamicTexture(
    "road-texture",
    { width: size, height: size },
    scene,
    false
  )
  texture.wrapU = Texture.WRAP_ADDRESSMODE
  texture.wrapV = Texture.WRAP_ADDRESSMODE
  texture.uScale = 1
  texture.vScale = 4
  texture.anisotropicFilteringLevel = 8

  const ctx = texture.getContext()

  const draw = (next: RoadPalette) => {
    ctx.clearRect(0, 0, size, size)
    ctx.fillStyle = colorToCss(next.road)
    ctx.fillRect(0, 0, size, size)

    const bandColor = scaleColor(next.road, 0.85)
    ctx.fillStyle = colorToCss(bandColor, 0.55)
    for (let y = 0; y < size; y += 128) {
      ctx.fillRect(0, y, size, 64)
    }

    const gritColor = scaleColor(next.road, 0.65)
    ctx.fillStyle = colorToCss(gritColor, 0.35)
    for (let i = 0; i < 200; i += 1) {
      ctx.fillRect(
        Math.random() * size,
        Math.random() * size,
        2,
        2
      )
    }

    const edgeWidth = 44
    ctx.fillStyle = colorToCss(next.edge, 0.9)
    ctx.fillRect(0, 0, edgeWidth, size)
    ctx.fillRect(size - edgeWidth, 0, edgeWidth, size)

    const dashWidth = 28
    const dashHeight = 140
    const dashGap = 70
    const centerX = size / 2 - dashWidth / 2
    ctx.fillStyle = colorToCss(next.center, 0.92)
    for (let y = 0; y < size; y += dashHeight + dashGap) {
      ctx.fillRect(centerX, y, dashWidth, dashHeight)
    }

    ctx.globalAlpha = 0.22
    ctx.fillStyle = colorToCss(next.center, 0.8)
    ctx.fillRect(centerX - 24, 0, dashWidth + 48, size)
    ctx.globalAlpha = 1

    texture.update()
  }

  draw(palette)

  return { texture, draw }
}

const createSkyDome = (scene: Scene) => {
  const size = 1024
  const texture = new DynamicTexture(
    "sky-texture",
    { width: size, height: size },
    scene,
    false
  )
  const ctx = texture.getContext()

  const material = new StandardMaterial("sky-mat", scene)
  material.backFaceCulling = false
  material.disableLighting = true
  material.emissiveTexture = texture
  material.emissiveColor = new Color3(1, 1, 1)

  const dome = MeshBuilder.CreateSphere(
    "sky-dome",
    { diameter: 220, segments: 32 },
    scene
  )
  dome.material = material
  dome.isPickable = false
  dome.infiniteDistance = true

  const setColor = (color: Color4) => {
    const base = new Color3(color.r, color.g, color.b)
    const top = scaleColor(base, 1.25)
    const bottom = scaleColor(base, 0.55)
    const gradient = ctx.createLinearGradient(0, 0, 0, size)
    gradient.addColorStop(0, colorToCss(top))
    gradient.addColorStop(0.55, colorToCss(base))
    gradient.addColorStop(1, colorToCss(bottom))
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, size, size)

    ctx.fillStyle = "rgba(255, 255, 255, 0.08)"
    for (let i = 0; i < 120; i += 1) {
      ctx.fillRect(Math.random() * size, Math.random() * size * 0.6, 2, 2)
    }

    texture.update()
  }

  return { mesh: dome, setColor }
}

const createRoad = (scene: Scene): RoadState => {
  const pathArray: Vector3[][] = [[], []]

  for (let i = 0; i < ROAD.segments; i += 1) {
    pathArray[0].push(new Vector3())
    pathArray[1].push(new Vector3())
  }

  const road = MeshBuilder.CreateRibbon(
    "road",
    {
      pathArray,
      updatable: true,
      sideOrientation: Mesh.DOUBLESIDE,
    },
    scene
  )

  const basePalette: RoadPalette = {
    road: new Color3(0.06, 0.08, 0.12),
    emissive: new Color3(0.02, 0.04, 0.08),
    center: new Color3(0.25, 0.7, 1),
    edge: new Color3(0.12, 0.55, 0.95),
  }
  const { texture: roadTexture, draw: drawRoadTexture } = createRoadTexture(
    scene,
    basePalette
  )

  const roadMaterial = new PBRMaterial("road-mat", scene)
  roadMaterial.albedoTexture = roadTexture
  roadMaterial.emissiveTexture = roadTexture
  roadMaterial.albedoColor = new Color3(1, 1, 1)
  roadMaterial.emissiveColor = new Color3(1, 1, 1)
  roadMaterial.metallic = 0.1
  roadMaterial.roughness = 0.82
  road.material = roadMaterial
  road.receiveShadows = true
  road.isPickable = false

  const applyPalette = (palette: RoadPalette) => {
    drawRoadTexture(palette)
    roadMaterial.emissiveColor = scaleColor(palette.emissive, 6)
  }

  let travel = 0
  let curveTime = 0
  let farCenterX = 0

  const update = (dt: number) => {
    travel = (travel + ROAD.speed * dt) % ROAD.length
    curveTime += dt * 0.35
    const spacing = ROAD.length / (ROAD.segments - 1)
    roadTexture.vOffset =
      ((travel / ROAD.length) * roadTexture.vScale) % 1

    for (let i = 0; i < ROAD.segments; i += 1) {
      const baseZ = ROAD.length - i * spacing
      const z = baseZ + ROAD.zOffset
      const curve = computeCurve(curveTime, baseZ)

      const left = pathArray[0][i]
      const right = pathArray[1][i]

      left.x = curve - ROAD.width / 2
      left.y = ROAD.y
      left.z = z

      right.x = curve + ROAD.width / 2
      right.y = ROAD.y
      right.z = z

      if (i === 0) {
        farCenterX = curve
      }
    }

    MeshBuilder.CreateRibbon("road", { pathArray, instance: road })
  }

  return {
    mesh: road,
    update,
    getFarCenterX: () => farCenterX,
    getTravel: () => travel,
    getCurveAt: (z: number) => computeCurve(curveTime, z),
    setPalette: applyPalette,
  }
}

type HoverVariant = {
  id: string
  name: string
  pivot: TransformNode
  board: Mesh
}

type PhraseSpec = {
  id: string
  text: string
  romanization?: string
  lang: string
  isCorrect: boolean
}

type PhraseInstance = {
  spec: PhraseSpec
  mesh: Mesh
  lane: number
  baseWidth: number
  baseHeight: number
}

type RoundState = {
  id: string
  promptLang: string
  answerLang: string
  prompt: string
  promptRomanization?: string
  answer: string
  answerRomanization?: string
  choices: PhraseSpec[]
}

type EntryLookup = {
  textByCode: Record<string, string>
  romByCode: Record<string, string>
}

type GameState = {
  stackConfig: StackConfig | null
  round: RoundState | null
  roundLoading: boolean
  roundSolved: boolean
  roundGeneration: number
  activePhrases: PhraseInstance[]
  lastLane: number
  lastPhraseId: string | null
  spawnCooldown: number
  incorrectStreak: number
  phase: "intro" | "celebrate" | "play"
}

type GameStore<T> = {
  getState: () => T
  update: (updater: (draft: T) => void) => void
  subscribe: (listener: (state: T) => void) => () => void
}

const createGameStore = <T extends Record<string, unknown>>(
  initial: T
): GameStore<T> => {
  let state = { ...initial }
  const listeners = new Set<(next: T) => void>()
  const getState = () => state
  const update = (updater: (draft: T) => void) => {
    const next = { ...state }
    updater(next)
    state = next
    listeners.forEach((listener) => listener(state))
  }
  const subscribe = (listener: (next: T) => void) => {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }
  return { getState, update, subscribe }
}

const createHoverboard = (scene: Scene) => {
  const root = new TransformNode("hover-root", scene)
  let corpanRig:
    | {
        container: TransformNode
        earPivot: TransformNode
        earFacingOffset: Quaternion
        rings: Mesh[]
        glowMats: StandardMaterial[]
        baseGlow: Color3
        baseAccent: Color3
        light: PointLight
      }
    | null = null

  const createVariant = (
    id: string,
    name: string,
    build: (pivot: TransformNode) => Mesh
  ): HoverVariant => {
    const pivot = new TransformNode(`${id}-pivot`, scene)
    pivot.parent = root
    const board = build(pivot)
    return { id, name, pivot, board }
  }

  const corpan = createVariant("corpan", "Corpán Signal", (pivot) => {
    const clay = new Color3(0.835, 0.416, 0.102) // #d56a1a - brand color

    const boardMaterial = createEmissivePbr(
      "corpan-board-mat",
      scene,
      clay,
      scaleColor(clay, 0.35),
      0.6,
      0.35
    )
    tuneLogoMaterial(boardMaterial, 1.1)

    const earMaterial = createEmissivePbr(
      "corpan-ear-mat",
      scene,
      clay,
      scaleColor(clay, 0.4),
      0.5,
      0.4
    )
    tuneLogoMaterial(earMaterial, 1.1)

    const glowMaterial = new StandardMaterial("corpan-glow-mat", scene)
    glowMaterial.emissiveColor = scaleColor(clay, 1.05)
    glowMaterial.disableLighting = true
    glowMaterial.alpha = 0.5

    const accentMaterial = new StandardMaterial("corpan-accent-mat", scene)
    accentMaterial.emissiveColor = scaleColor(clay, 0.9)
    accentMaterial.disableLighting = true
    accentMaterial.alpha = 0.6

    const ringMaterial = new StandardMaterial("corpan-ring-mat", scene)
    ringMaterial.emissiveColor = scaleColor(clay, 0.85)
    ringMaterial.disableLighting = true
    ringMaterial.alpha = 0.65

    const container = new TransformNode("corpan-logo-container", scene)
    container.parent = pivot

    const earPivot = new TransformNode("corpan-ear-pivot", scene)
    earPivot.parent = container
    earPivot.rotationQuaternion = Quaternion.Identity()
    const earFacingOffset = Quaternion.RotationAxis(Vector3.Up(), Math.PI)
    const earMeshes: Mesh[] = []

    const board = MeshBuilder.CreateBox(
      "corpan-rig",
      { width: 1.4, height: 0.08, depth: 0.9 },
      scene
    )
    board.parent = pivot
    board.position.y = 0.08
    board.visibility = 0

    container.parent = board
    container.position.y = 0.06

    // Load the 4 pyramid steps using bundled URLs (offline-ready)
    const stepUrls = [pyramidStep1Url, pyramidStep2Url, pyramidStep3Url, pyramidStep4Url]
    const outlineColor = scaleColor(clay, 1.1)
    const applyLogoMesh = (
      mesh: Mesh,
      material: PBRMaterial,
      glowMat: StandardMaterial,
      parent: TransformNode = container,
      withGlow = true,
      withOutline = true
    ) => {
      mesh.parent = parent
      mesh.material = material
      mesh.isPickable = false
      mesh.renderOutline = withOutline
      if (withOutline) {
        mesh.outlineColor = outlineColor
        mesh.outlineWidth = 0.025
      }

      if (withGlow) {
        const glow = mesh.clone(`${mesh.name}-glow`)
        if (glow) {
          glow.parent = parent
          glow.material = glowMat
          glow.position.copyFrom(mesh.position)
          glow.rotation.copyFrom(mesh.rotation)
          glow.scaling = mesh.scaling.scale(1.03)
          glow.isPickable = false
        }
      }
    }

    const stepPromises = stepUrls.map((url) =>
      SceneLoader.ImportMeshAsync("", url, "", scene).then((result) => {
        const meshes = result.meshes
        meshes.forEach((mesh) => {
          if (mesh instanceof Mesh) {
            applyLogoMesh(mesh, boardMaterial, glowMaterial)
          }
        })
        return meshes[0]
      })
    )

    // Load the ear outer contour
    const earOuterPromise = SceneLoader.ImportMeshAsync(
      "",
      earOuterUrl,
      "",
      scene
    ).then((result) => {
      const meshes = result.meshes
      meshes.forEach((mesh) => {
        if (mesh instanceof Mesh) {
          applyLogoMesh(mesh, earMaterial, accentMaterial, earPivot, false)
          earMeshes.push(mesh)
        }
      })
      return meshes[0]
    })

    // Load the ear spiral (inner detail)
    const earSpiralPromise = SceneLoader.ImportMeshAsync(
      "",
      earSpiralUrl,
      "",
      scene
    ).then((result) => {
      const meshes = result.meshes
      meshes.forEach((mesh) => {
        if (mesh instanceof Mesh) {
          applyLogoMesh(mesh, earMaterial, accentMaterial, earPivot, false, false)
          earMeshes.push(mesh)
        }
      })
      return meshes[0]
    })

    const outerRing = MeshBuilder.CreateTorus(
      "corpan-ring-outer",
      { diameter: 1.65, thickness: 0.018, tessellation: 96 },
      scene
    )
    outerRing.parent = board
    outerRing.position.y = 0.12
    outerRing.rotation.x = Math.PI / 2
    outerRing.material = ringMaterial

    const innerRing = MeshBuilder.CreateTorus(
      "corpan-ring-inner",
      { diameter: 1.1, thickness: 0.012, tessellation: 84 },
      scene
    )
    innerRing.parent = board
    innerRing.position.y = 0.38
    innerRing.rotation.x = Math.PI / 2
    innerRing.material = ringMaterial

    const crownRing = MeshBuilder.CreateTorus(
      "corpan-ring-crown",
      { diameter: 0.82, thickness: 0.01, tessellation: 72 },
      scene
    )
    crownRing.parent = board
    crownRing.position.y = 0.62
    crownRing.rotation.x = Math.PI / 2
    crownRing.material = accentMaterial

    // Wait for all meshes to load
    Promise.all([...stepPromises, earOuterPromise, earSpiralPromise])
      .then((loadedMeshes) => {
        if (earMeshes.length) {
          container.computeWorldMatrix(true)
          earMeshes.forEach((mesh) => mesh.computeWorldMatrix(true))
          const toContainer = container.getWorldMatrix().clone().invert()
          let min = new Vector3(
            Number.POSITIVE_INFINITY,
            Number.POSITIVE_INFINITY,
            Number.POSITIVE_INFINITY
          )
          let max = new Vector3(
            Number.NEGATIVE_INFINITY,
            Number.NEGATIVE_INFINITY,
            Number.NEGATIVE_INFINITY
          )
          earMeshes.forEach((mesh) => {
            const bounds = mesh.getBoundingInfo().boundingBox
            bounds.vectorsWorld.forEach((corner) => {
              const local = Vector3.TransformCoordinates(corner, toContainer)
              min = Vector3.Minimize(min, local)
              max = Vector3.Maximize(max, local)
            })
          })
          const center = min.add(max).scale(0.5)
          earPivot.position.copyFrom(center)
          earMeshes.forEach((mesh) => {
            mesh.position.subtractInPlace(center)
          })
        }
        console.log("✓ Corpán logo meshes loaded:", loadedMeshes.length)
      })
      .catch((error) => {
        console.error("Failed to load Corpán logo meshes:", error)
      })

    const logoLight = new PointLight(
      "corpan-logo-light",
      new Vector3(0, 0.6, 0.4),
      scene
    )
    logoLight.parent = board
    logoLight.diffuse = new Color3(1, 0.72, 0.4)
    logoLight.intensity = 0.85
    logoLight.range = 6

    corpanRig = {
      container,
      earPivot,
      earFacingOffset,
      rings: [outerRing, innerRing, crownRing],
      glowMats: [glowMaterial, accentMaterial, ringMaterial],
      baseGlow: clay,
      baseAccent: clay,
      light: logoLight,
    }

    return board
  })

  const neon = createVariant("neon", "Neon Drift", (pivot) => {
    const board = MeshBuilder.CreateBox(
      "neon-board",
      { width: 1.4, height: 0.08, depth: 0.6 },
      scene
    )
    board.parent = pivot
    board.position.y = 0.08

    const boardMaterial = createEmissivePbr(
      "neon-board-mat",
      scene,
      new Color3(0.08, 0.16, 0.3),
      new Color3(0.2, 0.4, 0.8),
      0.25,
      0.45
    )
    board.material = boardMaterial

    const rider = MeshBuilder.CreateSphere(
      "neon-rider",
      { diameter: 0.42 },
      scene
    )
    rider.parent = pivot
    rider.position.y = 0.55

    const riderMaterial = createEmissivePbr(
      "neon-rider-mat",
      scene,
      new Color3(0.9, 0.97, 1),
      new Color3(0.5, 0.8, 1),
      0.1,
      0.3
    )
    rider.material = riderMaterial

    const halo = MeshBuilder.CreateTorus(
      "neon-halo",
      { diameter: 0.55, thickness: 0.04 },
      scene
    )
    halo.parent = pivot
    halo.position.y = 0.78
    halo.rotation.x = Math.PI / 2
    const haloMat = createEmissivePbr(
      "neon-halo-mat",
      scene,
      new Color3(0.04, 0.08, 0.15),
      new Color3(0.25, 0.9, 1),
      0,
      0.2
    )
    halo.material = haloMat

    return board
  })

  const desert = createVariant("desert", "Sunset Skimmer", (pivot) => {
    const board = MeshBuilder.CreateCylinder(
      "desert-board",
      { height: 0.08, diameter: 1.6 },
      scene
    )
    board.parent = pivot
    board.position.y = 0.08

    const boardMaterial = createEmissivePbr(
      "desert-board-mat",
      scene,
      new Color3(0.35, 0.16, 0.08),
      new Color3(0.45, 0.2, 0.12),
      0.15,
      0.7
    )
    board.material = boardMaterial

    const nose = MeshBuilder.CreateCylinder(
      "desert-nose",
      { height: 0.18, diameterTop: 0.12, diameterBottom: 0.4 },
      scene
    )
    nose.parent = pivot
    nose.position.z = 0.45
    nose.position.y = 0.12
    nose.rotation.x = Math.PI / 2
    nose.material = boardMaterial

    const riderCore = MeshBuilder.CreateBox(
      "desert-rider",
      { width: 0.28, height: 0.5, depth: 0.28 },
      scene
    )
    riderCore.parent = pivot
    riderCore.position.y = 0.55

    const riderMaterial = createEmissivePbr(
      "desert-rider-mat",
      scene,
      new Color3(0.92, 0.86, 0.74),
      new Color3(0.7, 0.5, 0.32),
      0.05,
      0.65
    )
    riderCore.material = riderMaterial

    return board
  })

  const glacier = createVariant("glacier", "Glacier Pulse", (pivot) => {
    const board = MeshBuilder.CreateBox(
      "glacier-board",
      { width: 1.6, height: 0.06, depth: 0.7 },
      scene
    )
    board.parent = pivot
    board.position.y = 0.08

    const boardMaterial = createEmissivePbr(
      "glacier-board-mat",
      scene,
      new Color3(0.12, 0.2, 0.35),
      new Color3(0.25, 0.5, 0.85),
      0.25,
      0.45
    )
    board.material = boardMaterial

    const finLeft = MeshBuilder.CreateBox(
      "glacier-fin-left",
      { width: 0.12, height: 0.06, depth: 0.4 },
      scene
    )
    finLeft.parent = pivot
    finLeft.position.set(-0.7, 0.1, 0)
    finLeft.material = boardMaterial

    const finRight = finLeft.clone("glacier-fin-right")
    if (finRight) {
      finRight.parent = pivot
      finRight.position.x = 0.7
    }

    const rider = MeshBuilder.CreateSphere(
      "glacier-rider",
      { diameter: 0.34 },
      scene
    )
    rider.parent = pivot
    rider.position.y = 0.54

    const riderMaterial = createEmissivePbr(
      "glacier-rider-mat",
      scene,
      new Color3(0.86, 0.94, 1),
      new Color3(0.5, 0.75, 1),
      0.2,
      0.4
    )
    rider.material = riderMaterial

    return board
  })

  const crystalWave = createVariant("crystal-wave", "Crystal Wave", (pivot) => {
    // Main hexagonal prism body
    const prism = MeshBuilder.CreateCylinder(
      "crystal-prism",
      { height: 0.6, diameter: 0.5, tessellation: 6 },
      scene
    )
    prism.parent = pivot
    prism.position.y = 0.4
    prism.rotation.y = Math.PI / 6

    const prismMaterial = createEmissivePbr(
      "crystal-prism-mat",
      scene,
      new Color3(0.3, 0.15, 0.5),
      new Color3(0.6, 0.3, 0.9),
      0.8,
      0.1
    )
    prism.material = prismMaterial

    // Floating crystal shards
    const createShard = (name: string, x: number, y: number, z: number, scale: number) => {
      const shard = MeshBuilder.CreateBox(
        name,
        { width: 0.08 * scale, height: 0.25 * scale, depth: 0.08 * scale },
        scene
      )
      shard.parent = pivot
      shard.position.set(x, y, z)
      shard.rotation.set(
        Math.random() * Math.PI * 0.3,
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 0.3
      )

      const shardMaterial = createEmissivePbr(
        `${name}-mat`,
        scene,
        new Color3(0.5, 0.3, 0.7),
        new Color3(0.8, 0.5, 1),
        0.9,
        0.05
      )
      shard.material = shardMaterial
      return shard
    }

    createShard("crystal-shard-1", -0.4, 0.6, 0.2, 0.8)
    createShard("crystal-shard-2", 0.35, 0.5, -0.15, 0.9)
    createShard("crystal-shard-3", 0.1, 0.75, 0.3, 0.7)
    createShard("crystal-shard-4", -0.2, 0.3, -0.25, 0.6)

    return prism
  })

  const solarFlare = createVariant("solar-flare", "Solar Flare", (pivot) => {
    // Surfboard-style base
    const board = MeshBuilder.CreateCylinder(
      "solar-board",
      { height: 1.8, diameterTop: 0.25, diameterBottom: 0.3, tessellation: 16 },
      scene
    )
    board.parent = pivot
    board.position.y = 0.12
    board.rotation.x = Math.PI / 2
    board.rotation.z = Math.PI / 2

    const boardMaterial = createEmissivePbr(
      "solar-board-mat",
      scene,
      new Color3(0.4, 0.15, 0.05),
      new Color3(1, 0.4, 0.1),
      0.3,
      0.4
    )
    board.material = boardMaterial

    // Flame fins
    const createFlameFin = (name: string, x: number) => {
      const fin = MeshBuilder.CreateBox(
        name,
        { width: 0.08, height: 0.35, depth: 0.25 },
        scene
      )
      fin.parent = pivot
      fin.position.set(x, 0.12, 0)

      const finMaterial = createEmissivePbr(
        `${name}-mat`,
        scene,
        new Color3(0.5, 0.1, 0.05),
        new Color3(1, 0.3, 0),
        0.1,
        0.3
      )
      fin.material = finMaterial
      return fin
    }

    createFlameFin("solar-fin-left", -0.7)
    createFlameFin("solar-fin-right", 0.7)

    // Central orb
    const orb = MeshBuilder.CreateSphere("solar-orb", { diameter: 0.4 }, scene)
    orb.parent = pivot
    orb.position.y = 0.55

    const orbMaterial = createEmissivePbr(
      "solar-orb-mat",
      scene,
      new Color3(0.9, 0.4, 0.1),
      new Color3(1, 0.6, 0.2),
      0.1,
      0.2
    )
    orb.material = orbMaterial

    return board
  })

  const variants = [corpan, neon, desert, glacier, crystalWave, solarFlare]
  let activeVariant = variants[0]
  variants.forEach((variant, index) => {
    variant.pivot.setEnabled(index === 0)
  })

  const setVariant = (id: string) => {
    const next = variants.find((variant) => variant.id === id)
    if (!next || next === activeVariant) {
      return
    }
    activeVariant.pivot.setEnabled(false)
    next.pivot.setEnabled(true)
    activeVariant = next
  }

  return {
    root,
    variants,
    setVariant,
    getActivePivot: () => activeVariant.pivot,
    getActiveBoard: () => activeVariant.board,
    updateLogo: (time: number, camera?: Camera | null) => {
      if (!corpanRig || activeVariant.id !== "corpan") {
        return
      }
      const pulse = 0.65 + Math.sin(time * 2.2) * 0.2
      const glow = scaleColor(corpanRig.baseGlow, 0.85 + pulse * 0.45)
      const accent = scaleColor(corpanRig.baseAccent, 0.9 + pulse * 0.6)
      corpanRig.glowMats[0].emissiveColor.copyFrom(glow)
      corpanRig.glowMats[1].emissiveColor.copyFrom(accent)
      corpanRig.glowMats[2].emissiveColor.copyFrom(
        scaleColor(corpanRig.baseAccent, 0.7 + pulse * 0.8)
      )
      corpanRig.rings[0].rotation.z = time * 0.35
      corpanRig.rings[1].rotation.z = -time * 0.55
      corpanRig.rings[2].rotation.z = time * 0.28
      corpanRig.container.rotation.y = Math.sin(time * 0.65) * 0.08
      corpanRig.container.rotation.x = Math.sin(time * 0.8) * 0.05
      corpanRig.light.intensity = 0.75 + pulse * 0.45
      if (camera) {
        const forward = camera.position.subtract(
          corpanRig.earPivot.getAbsolutePosition()
        )
        forward.y = 0
        if (forward.lengthSquared() > 0.0001) {
          forward.normalize()
          const yaw = Math.atan2(forward.x, forward.z)
          const target = Quaternion.FromEulerAngles(0, yaw, 0)
          const desired = target.multiply(corpanRig.earFacingOffset)
          const current =
            corpanRig.earPivot.rotationQuaternion ?? Quaternion.Identity()
          corpanRig.earPivot.rotationQuaternion = Quaternion.Slerp(
            current,
            desired,
            0.18
          )
        }
      }
    },
  }
}

type ElectricField = {
  root: TransformNode
  update: (dt: number, target: Mesh | null, intensity: number) => void
  setColor: (color: Color3) => void
}

const createElectricField = (
  scene: Scene,
  parent: TransformNode,
  baseColor: Color3
): ElectricField => {
  const root = new TransformNode("electric-field", scene)
  root.parent = parent
  root.position.y = 0.2

  const core = MeshBuilder.CreateSphere(
    "electric-core",
    { diameter: 0.25, segments: 12 },
    scene
  )
  core.parent = root
  core.position.y = 0.45
  core.isPickable = false

  const coreMat = new StandardMaterial("electric-core-mat", scene)
  coreMat.emissiveColor = baseColor.clone()
  coreMat.disableLighting = true
  core.material = coreMat

  const buildArc = (
    index: number,
    label: string,
    radius: number,
    pointCount: number,
    reachScale: number
  ) => {
    const points = Array.from({ length: pointCount }, () => new Vector3())
    const mesh = MeshBuilder.CreateTube(
      `electric-arc-${label}-${index}`,
      {
        path: points,
        radius,
        tessellation: 6,
        updatable: true,
      },
      scene
    )
    mesh.parent = root
    mesh.isPickable = false
    const material = new StandardMaterial(`electric-arc-mat-${label}-${index}`, scene)
    material.emissiveColor = baseColor.clone()
    material.disableLighting = true
    material.alpha = 0.85
    mesh.material = material
    return {
      mesh,
      points,
      material,
      seed: Math.random() * Math.PI * 2,
      phase: Math.random() * Math.PI * 2,
      reachScale,
    }
  }

  const arcs = [
    ...Array.from({ length: 12 }, (_, index) =>
      buildArc(index, "main", 0.01, 16, 1)
    ),
    ...Array.from({ length: 8 }, (_, index) =>
      buildArc(index, "branch", 0.006, 12, 0.65)
    ),
  ]

  let time = 0
  let currentColor = baseColor.clone()

  const setColor = (color: Color3) => {
    currentColor = color.clone()
    coreMat.emissiveColor = scaleColor(currentColor, 1.35)
    arcs.forEach((arc) => {
      arc.material.emissiveColor = scaleColor(currentColor, 1.25)
    })
  }

  const update = (dt: number, target: Mesh | null, intensity: number) => {
    time += dt
    const targetWorld = target?.getAbsolutePosition() ?? null
    const rootWorld = root.getAbsolutePosition()
    const targetLocal = targetWorld ? targetWorld.subtract(rootWorld) : null
    const reach = clamp(intensity, 0, 1)

    arcs.forEach((arc, index) => {
      const start = new Vector3(0, 0.45, 0)
      const theta = arc.seed + time * 0.9 + index * 0.4
      const phi = arc.phase + time * 0.7 + index * 0.2
      const sphereRadius = 0.85 + Math.sin(time * 1.4 + arc.seed) * 0.15
      const randomEnd = new Vector3(
        Math.cos(theta) * Math.sin(phi),
        Math.cos(phi),
        Math.sin(theta) * Math.sin(phi)
      ).scale(sphereRadius).addInPlace(start)

      let end = randomEnd
      if (targetLocal && index < 5) {
        end = Vector3.Lerp(randomEnd, targetLocal, reach * arc.reachScale)
      }

      const dir = end.subtract(start)
      const axis = Math.abs(dir.y) > 0.9 ? Vector3.Right() : Vector3.Up()
      const orthoA = Vector3.Cross(dir, axis).normalize()
      const orthoB = Vector3.Cross(dir, orthoA).normalize()

      for (let i = 0; i < arc.points.length; i += 1) {
        const t = i / (arc.points.length - 1)
        const wobble =
          Math.sin(t * 14 + time * 11 + arc.seed) * 0.1 +
          Math.cos(t * 18 + time * 9 + arc.phase) * 0.08
        const twist = Math.sin(t * 20 + time * 12 + arc.phase) * 0.09
        const fade = (1 - t) * 0.9 + 0.1
        const offset = orthoA
          .scale(wobble * fade)
          .add(orthoB.scale(twist * fade))
        const point = start.add(dir.scale(t)).add(offset)
        arc.points[i].copyFrom(point)
      }

      MeshBuilder.CreateTube(
        arc.mesh.name,
        { path: arc.points, instance: arc.mesh }
      )
      arc.material.emissiveColor = scaleColor(
        currentColor,
        1.05 + reach * 0.75
      )
    })
  }

  setColor(baseColor)

  return { root, update, setColor }
}

type SceneProp = {
  mesh: Mesh
  baseZ: number
  offsetX: number
  baseY: number
  side: -1 | 1
}

const createPropField = (
  root: TransformNode,
  options: {
    count: number
    spacing: number
    offsetX: number
    offsetXJitter: number
    baseY: number
    baseYJitter: number
    buildMesh: (index: number) => Mesh
  }
): SceneProp[] => {
  const props: SceneProp[] = []
  for (let i = 0; i < options.count; i += 1) {
    const mesh = options.buildMesh(i)
    mesh.parent = root
    mesh.isPickable = false
    mesh.receiveShadows = true
    const side = i % 2 === 0 ? -1 : 1
    const offsetX =
      options.offsetX + (Math.random() - 0.5) * options.offsetXJitter
    const baseY =
      options.baseY + (Math.random() - 0.5) * options.baseYJitter
    props.push({
      mesh,
      baseZ: i * options.spacing,
      offsetX,
      baseY,
      side,
    })
  }
  return props
}

const updatePropField = (props: SceneProp[], road: RoadState) => {
  const travel = road.getTravel()
  props.forEach((prop) => {
    const baseZ = ROAD.length - ((prop.baseZ + travel) % ROAD.length)
    const z = baseZ + ROAD.zOffset
    const curve = road.getCurveAt(baseZ)
    prop.mesh.position.x =
      curve + prop.side * (ROAD.width / 2 + prop.offsetX)
    prop.mesh.position.y = ROAD.y + prop.baseY
    prop.mesh.position.z = z
  })
}

type Skin = {
  id: string
  name: string
  variantId: string
  palette: RoadPalette
  sky: Color4
  hemi: {
    intensity: number
    diffuse: Color3
    ground: Color3
  }
  accent: {
    intensity: number
    color: Color3
  }
  envRoot: TransformNode
  props: SceneProp[]
}

type InputState = {
  row: number
  col: number
  tiltEnabled: boolean
  tiltActive: boolean
  tiltX: number
  tiltY: number
}

const initInput = (
  canvas: HTMLCanvasElement,
  tiltButton: HTMLButtonElement
) => {
  const state: InputState = {
    row: 2,
    col: 0,
    tiltEnabled: false,
    tiltActive: false,
    tiltX: 0,
    tiltY: 0,
  }

  const onKey = (event: KeyboardEvent) => {
    // Start music on first keyboard interaction (if not already playing)
    const audio = getSfx()
    if (tuningStore.getState().settings.musicEnabled && !audio.isMusicPlaying()) {
      audio.unlock()
      audio.playMusic()
    }

    if (event.key === "ArrowUp" || event.key === "w") {
      state.row = clamp(state.row - 1, 0, 2)
    }
    if (event.key === "ArrowDown" || event.key === "s") {
      state.row = clamp(state.row + 1, 0, 2)
    }
    if (event.key === "ArrowLeft" || event.key === "a") {
      state.col = 0
    }
    if (event.key === "ArrowRight" || event.key === "d") {
      state.col = 1
    }
  }

  const onPointer = (event: PointerEvent) => {
    // Start music on first canvas interaction (if not already playing)
    const audio = getSfx()
    if (tuningStore.getState().settings.musicEnabled && !audio.isMusicPlaying()) {
      audio.unlock()
      audio.playMusic()
    }

    const rect = canvas.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    state.col = x < rect.width / 2 ? 0 : 1
    if (y < rect.height / 3) {
      state.row = 0
    } else if (y < (rect.height * 2) / 3) {
      state.row = 1
    } else {
      state.row = 2
    }
  }

  const orientationHandler = (event: DeviceOrientationEvent) => {
    if (event.gamma == null || event.beta == null) {
      return
    }
    state.tiltActive = true
    state.tiltX = clamp(event.gamma / 16, -1, 1)
    const minPitch = 52
    const maxPitch = 62
    const pitch = clamp(event.beta, minPitch, maxPitch)
    const normalized = (pitch - minPitch) / (maxPitch - minPitch)
    state.tiltY = normalized * 2 - 1
  }

  const enableTilt = () => {
    if (state.tiltEnabled) {
      return
    }
    state.tiltEnabled = true
    tiltButton.textContent = "Motion Active"
    window.addEventListener("deviceorientation", orientationHandler)
  }

  const requestTilt = async () => {
    const requestPermission = (
      DeviceOrientationEvent as unknown as {
        requestPermission?: () => Promise<"granted" | "denied">
      }
    ).requestPermission

    if (typeof requestPermission === "function") {
      try {
        const result = await requestPermission()
        if (result === "granted") {
          enableTilt()
        }
      } catch {
        // Ignore permission failures.
      }
    } else {
      enableTilt()
    }
  }

  window.addEventListener("keydown", onKey)
  canvas.addEventListener("pointerdown", onPointer)
  tiltButton.addEventListener("click", requestTilt)
  const prefersTilt =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(pointer: coarse)").matches
  if (
    prefersTilt &&
    !(DeviceOrientationEvent as unknown as { requestPermission?: unknown })
      .requestPermission
  ) {
    enableTilt()
  }

  const dispose = () => {
    window.removeEventListener("keydown", onKey)
    canvas.removeEventListener("pointerdown", onPointer)
    window.removeEventListener("deviceorientation", orientationHandler)
    tiltButton.removeEventListener("click", requestTilt)
  }

  return { state, dispose }
}

type InitialState = {
  stackConfig?: StackConfig
}

export const createHoverRunner = (
  container: HTMLElement,
  hostApi: HostApi,
  initialState?: InitialState
) => {
  let disposed = false
  const root = document.createElement("div")
  root.className = "hover-runner"
  container.appendChild(root)

  const sfx = getSfx()
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

  const hudBackdrop = document.createElement("div")
  hudBackdrop.className = "hud-backdrop"
  root.appendChild(hudBackdrop)

  const hudPanel = document.createElement("div")
  hudPanel.className = "hud-panel"
  root.appendChild(hudPanel)

  const hudControls = document.createElement("div")
  hudControls.className = "hud-controls"

  hudPanel.append(hudControls)

  const tuningPanel = document.createElement("div")
  tuningPanel.className = "tuning-panel"
  hudPanel.appendChild(tuningPanel)

  const phraseHud = document.createElement("div")
  phraseHud.className = "phrase-hud"
  const hudPromptLabel = document.createElement("div")
  hudPromptLabel.className = "phrase-hud-label"
  hudPromptLabel.textContent = "Listen"
  const hudPrompt = document.createElement("div")
  hudPrompt.className = "phrase-hud-text"
  hudPrompt.textContent = "Waiting for phrase..."
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
  hudScore.textContent = "Score 0"
  const hudStreak = document.createElement("div")
  hudStreak.className = "status-streak"
  hudStreak.textContent = "Streak 0"
  statusHud.append(hudScore, hudStreak)
  root.appendChild(statusHud)

  const promptToggle = document.createElement("label")
  promptToggle.className = "hud-toggle"
  const promptToggleInput = document.createElement("input")
  promptToggleInput.type = "checkbox"
  promptToggleInput.checked = true
  const promptToggleLabel = document.createElement("span")
  promptToggleLabel.textContent = "Show prompt"
  promptToggle.append(promptToggleInput, promptToggleLabel)

  const tiltButton = document.createElement("button")
  tiltButton.className = "tilt-button"
  tiltButton.type = "button"
  tiltButton.textContent = "Enable Motion"
  hudControls.appendChild(tiltButton)

  const hudExit = document.createElement("button")
  hudExit.className = "hud-exit"
  hudExit.type = "button"
  hudExit.textContent = "Exit"
  hudControls.appendChild(hudExit)

  // Accordion section helper
  const createAccordionSection = (title: string, expanded = false) => {
    const section = document.createElement("div")
    section.className = "accordion-section"
    if (expanded) section.classList.add("expanded")

    const header = document.createElement("button")
    header.className = "accordion-header"
    header.type = "button"
    header.innerHTML = `<span>${title}</span><span class="accordion-icon">▼</span>`

    const content = document.createElement("div")
    content.className = "accordion-content"

    header.addEventListener("click", () => {
      const wasExpanded = section.classList.contains("expanded")
      // Close all sections
      tuningPanel.querySelectorAll(".accordion-section").forEach((s) => {
        s.classList.remove("expanded")
      })
      // Toggle this section
      if (!wasExpanded) {
        section.classList.add("expanded")
      }
    })

    section.append(header, content)
    tuningPanel.appendChild(section)
    return content
  }

  const createTuningControl = (
    label: string,
    key: keyof ReturnType<typeof tuningStore.getState>["settings"],
    min: number,
    max: number,
    step: number,
    helpText: string,
    parent: HTMLElement = tuningPanel
  ) => {
    const row = document.createElement("div")
    row.className = "tuning-row"
    const labelWrap = document.createElement("div")
    labelWrap.className = "tuning-label-wrap"
    const text = document.createElement("div")
    text.className = "tuning-label"
    text.textContent = label
    const help = document.createElement("button")
    help.type = "button"
    help.className = "tuning-help"
    help.textContent = "?"
    help.dataset.help = helpText
    help.title = helpText
    help.setAttribute("aria-label", `${label} info`)
    labelWrap.append(text, help)
    const value = document.createElement("div")
    value.className = "tuning-value"
    const input = document.createElement("input")
    input.type = "range"
    input.min = String(min)
    input.max = String(max)
    input.step = String(step)
    input.dataset.settingKey = key
    const setValue = (next: number) => {
      value.textContent = Number.isInteger(step) ? `${next}` : next.toFixed(2)
    }
    const current = tuningStore.getState().settings[key] as number
    input.value = String(current)
    setValue(current)
    input.addEventListener("input", () => {
      const next = Number(input.value)
      tuningStore.getState().setSetting(key, next)
      setValue(next)
    })
    row.append(labelWrap, value, input)
    parent.appendChild(row)
    return { row, input, setValue, key }
  }

  // Helper for toggle (checkbox) controls
  const createToggleControl = (
    label: string,
    key: keyof ReturnType<typeof tuningStore.getState>["settings"],
    helpText: string,
    onChange?: (checked: boolean) => void,
    parent: HTMLElement = tuningPanel
  ) => {
    const row = document.createElement("div")
    row.className = "tuning-row tuning-row-toggle"
    const labelWrap = document.createElement("div")
    labelWrap.className = "tuning-label-wrap"
    const text = document.createElement("div")
    text.className = "tuning-label"
    text.textContent = label
    const help = document.createElement("button")
    help.type = "button"
    help.className = "tuning-help"
    help.textContent = "?"
    help.dataset.help = helpText
    help.title = helpText
    help.setAttribute("aria-label", `${label} info`)
    labelWrap.append(text, help)
    const input = document.createElement("input")
    input.type = "checkbox"
    input.className = "tuning-checkbox"
    input.dataset.settingKey = key
    const current = tuningStore.getState().settings[key] as boolean
    input.checked = current
    input.addEventListener("change", () => {
      tuningStore.getState().setSetting(key, input.checked)
      onChange?.(input.checked)
    })
    row.append(labelWrap, input)
    parent.appendChild(row)
    return { row, input, key }
  }

  // Gameplay Settings Section (expanded by default)
  const gameplaySection = createAccordionSection("Gameplay", true)
  const tuningControls = [
    createTuningControl(
      "Speed",
      "basePhraseSpeed",
      8,
      22,
      0.5,
      "Base phrase travel speed. Shifts with correct/wrong answers.",
      gameplaySection
    ),
    createTuningControl(
      "Respawn",
      "respawnDelay",
      0.2,
      1.2,
      0.05,
      "Delay before another candidate spawns after a phrase resolves.",
      gameplaySection
    ),
    createTuningControl(
      "Lead-in",
      "promptLeadMs",
      200,
      2000,
      50,
      "Delay after intro ends before the first candidate spawns.",
      gameplaySection
    ),
    createTuningControl(
      "Intro Hold",
      "introHoldMs",
      400,
      2500,
      100,
      "How long the new prompt stays centered before sliding down.",
      gameplaySection
    ),
    createTuningControl(
      "Intro Gap",
      "introRepeatMs",
      200,
      2000,
      100,
      "Pause before repeating the prompt after it settles at the bottom.",
      gameplaySection
    ),
    createTuningControl(
      "Celebrate",
      "celebrationMs",
      600,
      2500,
      100,
      "Minimum time to hold the match celebration on success.",
      gameplaySection
    ),
    createTuningControl(
      "Post Celebrate",
      "postCelebrateMs",
      200,
      2500,
      100,
      "Extra pause after celebration before the next phrase intro.",
      gameplaySection
    ),
    createTuningControl(
      "Correct Weight",
      "correctWeight",
      1,
      4,
      0.1,
      "Higher values make correct answers appear more often.",
      gameplaySection
    ),
    createTuningControl(
      "Distractors",
      "maxDistractors",
      1,
      6,
      1,
      "Maximum number of wrong answers in the pool.",
      gameplaySection
    ),
    createTuningControl(
      "Max Misses",
      "maxIncorrectStreak",
      1,
      5,
      1,
      "Force a correct answer after this many misses.",
      gameplaySection
    ),
    createTuningControl(
      "Text Scale",
      "textScaleFactor",
      0.5,
      3,
      0.1,
      "Scale multiplier for phrase meshes on the road.",
      gameplaySection
    ),
    createTuningControl(
      "Overflow",
      "textOverflowFactor",
      1,
      2,
      0.05,
      "Allow phrases to exceed their lane bounds (1 = strict).",
      gameplaySection
    ),
  ]

  // Audio Settings Section
  const audioSection = createAccordionSection("Audio")
  createToggleControl(
    "Music",
    "musicEnabled",
    "Enable or disable background music.",
    (enabled) => {
      if (enabled) {
        sfx.playMusic()
      } else {
        sfx.stopMusic()
      }
    },
    audioSection
  )
  createToggleControl(
    "Sound FX",
    "sfxEnabled",
    "Enable or disable sound effects.",
    undefined,
    audioSection
  )
  createTuningControl(
    "Music Vol",
    "musicVolume",
    0,
    1,
    0.05,
    "Background music volume (0-100%).",
    audioSection
  )
  createTuningControl(
    "SFX Vol",
    "sfxVolume",
    0,
    1,
    0.05,
    "Sound effects volume (0-100%).",
    audioSection
  )

  // Chaos Mode Section
  const chaosSection = createAccordionSection("Chaos Mode")
  createTuningControl(
    "Max Phrases",
    "maxSimultaneousPhrases",
    1,
    5,
    1,
    "Maximum simultaneous phrases (1-5). Higher = more chaos!",
    chaosSection
  )

  // Apply initial audio settings
  const initSettings = tuningStore.getState().settings
  sfx.setMusicVolume(initSettings.musicVolume)
  sfx.setSfxVolume(initSettings.sfxVolume)

  // Subscribe to audio setting changes
  tuningStore.subscribe((state) => {
    sfx.setMusicVolume(state.settings.musicVolume)
    sfx.setSfxVolume(state.settings.sfxVolume)
  })

  const fabButton = document.createElement("button")
  fabButton.className = "hud-fab"
  fabButton.type = "button"
  fabButton.setAttribute("aria-label", "Open menu")
  fabButton.innerHTML = `
    <span class="hud-fab-icon" aria-hidden="true">⚙︎</span>
  `
  root.appendChild(fabButton)

  let panelOpen = false
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
  const setPanelOpen = (next: boolean) => {
    panelOpen = next
    hudPanel.classList.toggle("open", panelOpen)
    hudBackdrop.classList.toggle("open", panelOpen)
    fabButton.classList.toggle("open", panelOpen)
    fabButton.setAttribute("aria-label", panelOpen ? "Close menu" : "Open menu")
    setPaused(panelOpen)
  }

  const requestExit = () => {
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

  const onFabClick = () => {
    setPanelOpen(!panelOpen)
  }
  const onBackdropClick = () => {
    setPanelOpen(false)
  }

  const onWakeLockGesture = () => {
    void requestWakeLock()
    sfx.unlock()
    // Start background music after user gesture unlocks audio (if enabled)
    if (tuningStore.getState().settings.musicEnabled) {
      sfx.playMusic()
    }
    window.removeEventListener("pointerdown", onWakeLockGesture)
  }

  document.addEventListener("visibilitychange", onVisibilityChange)
  window.addEventListener("pointerdown", onWakeLockGesture)
  void requestWakeLock()

  fabButton.addEventListener("click", onFabClick)
  hudBackdrop.addEventListener("click", onBackdropClick)
  hudExit.addEventListener("click", requestExit)

  const engine = new Engine(canvas, true, {
    preserveDrawingBuffer: true,
    stencil: true,
    antialias: true,
  })
  engine.setHardwareScalingLevel(1 / Math.min(window.devicePixelRatio || 1, 2))

  const scene = new Scene(engine)
  scene.clearColor = new Color4(0.02, 0.04, 0.08, 1)
  scene.imageProcessingConfiguration.toneMappingEnabled = true
  scene.imageProcessingConfiguration.toneMappingType =
    ImageProcessingConfiguration.TONEMAPPING_ACES
  scene.imageProcessingConfiguration.exposure = 1.05
  scene.imageProcessingConfiguration.contrast = 1.08
  scene.fogMode = Scene.FOGMODE_EXP2
  scene.fogDensity = 0.015
  scene.fogColor = new Color3(0.02, 0.04, 0.08)

  const sky = createSkyDome(scene)

  const camera = new UniversalCamera(
    "camera",
    new Vector3(0, -0.05, -4.1),
    scene
  )
  camera.setTarget(new Vector3(0, -1.05, 10))
  camera.fov = 1.46
  camera.minZ = 0.1
  camera.maxZ = 200
  camera.inputs.clear()

  const hemi = new HemisphericLight("hemi", new Vector3(0, 1, 0.4), scene)
  hemi.intensity = 0.5
  hemi.diffuse = new Color3(0.6, 0.75, 1)
  hemi.groundColor = new Color3(0.06, 0.08, 0.12)

  const accent = new DirectionalLight(
    "accent",
    new Vector3(-0.2, -1, 0.6),
    scene
  )
  accent.position = new Vector3(6, 8, -6)
  accent.intensity = 0.2
  accent.diffuse = new Color3(0.6, 0.7, 0.9)

  const glow = new GlowLayer("glow", scene, { blurKernelSize: 64 })
  glow.intensity = 0.45
  glow.addExcludedMesh(sky.mesh)

  const shadowGenerator = new ShadowGenerator(1024, accent)
  shadowGenerator.useBlurExponentialShadowMap = true
  shadowGenerator.blurKernel = 16
  shadowGenerator.bias = 0.0005
  shadowGenerator.normalBias = 0.02

  const road = createRoad(scene)
  const hoverboard = createHoverboard(scene)
  hoverboard.root.position = new Vector3(GRID.leftX, GRID.bottomY, GRID.z)
  const electricField = createElectricField(
    scene,
    hoverboard.root,
    new Color3(0.35, 0.9, 1)
  )

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

  const neonProps = createPropField(neonRoot, {
    count: 26,
    spacing: 3.2,
    offsetX: 1.1,
    offsetXJitter: 0.6,
    baseY: 0.45,
    baseYJitter: 0.2,
    buildMesh: (index) => {
      const height = 0.7 + (index % 4) * 0.35
      const mesh = MeshBuilder.CreateCylinder(
        `neon-pylon-${index}`,
        { height, diameter: 0.12 },
        scene
      )
      mesh.material = neonMat
      mesh.rotation.y = Math.random() * Math.PI
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

  const desertProps = createPropField(desertRoot, {
    count: 22,
    spacing: 4.2,
    offsetX: 1.4,
    offsetXJitter: 0.8,
    baseY: 0.9,
    baseYJitter: 0.3,
    buildMesh: (index) => {
      const height = 1.6 + (index % 3) * 0.6
      const mesh = MeshBuilder.CreateCylinder(
        `desert-spire-${index}`,
        { height, diameterTop: 0.18, diameterBottom: 0.6 },
        scene
      )
      mesh.material = desertMat
      mesh.rotation.y = Math.random() * Math.PI
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

  const glacierProps = createPropField(glacierRoot, {
    count: 24,
    spacing: 3.8,
    offsetX: 1.25,
    offsetXJitter: 0.7,
    baseY: 0.6,
    baseYJitter: 0.25,
    buildMesh: (index) => {
      const height = 1.2 + (index % 4) * 0.5
      const mesh = MeshBuilder.CreateCylinder(
        `glacier-shard-${index}`,
        { height, diameterTop: 0.08, diameterBottom: 0.5 },
        scene
      )
      mesh.material = glacierMat
      mesh.rotation.y = Math.random() * Math.PI
      mesh.rotation.z = (Math.random() - 0.5) * 0.2
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
      sky: new Color4(0.02, 0.04, 0.08, 1),
      hemi: {
        intensity: 0.6,
        diffuse: new Color3(0.6, 0.75, 1),
        ground: new Color3(0.06, 0.08, 0.12),
      },
      accent: {
        intensity: 0.25,
        color: new Color3(0.6, 0.8, 1),
      },
    },
    {
      id: "desert",
      name: "Sunset Skimmer",
      variantId: "corpan",
      envRoot: desertRoot,
      props: desertProps,
      palette: {
        road: new Color3(0.12, 0.08, 0.06),
        emissive: new Color3(0.08, 0.04, 0.02),
        center: new Color3(1, 0.64, 0.3),
        edge: new Color3(0.85, 0.35, 0.2),
      },
      sky: new Color4(0.08, 0.04, 0.02, 1),
      hemi: {
        intensity: 0.5,
        diffuse: new Color3(1, 0.75, 0.5),
        ground: new Color3(0.18, 0.1, 0.08),
      },
      accent: {
        intensity: 0.3,
        color: new Color3(1, 0.6, 0.35),
      },
    },
    {
      id: "glacier",
      name: "Glacier Pulse",
      variantId: "corpan",
      envRoot: glacierRoot,
      props: glacierProps,
      palette: {
        road: new Color3(0.04, 0.1, 0.16),
        emissive: new Color3(0.02, 0.05, 0.12),
        center: new Color3(0.45, 0.9, 1),
        edge: new Color3(0.28, 0.7, 0.95),
      },
      sky: new Color4(0.02, 0.06, 0.12, 1),
      hemi: {
        intensity: 0.55,
        diffuse: new Color3(0.7, 0.88, 1),
        ground: new Color3(0.04, 0.08, 0.16),
      },
      accent: {
        intensity: 0.28,
        color: new Color3(0.5, 0.8, 1),
      },
    },
  ]

  let activeSkin = skins[0]
  const applySkin = (id: string) => {
    const next = skins.find((skin) => skin.id === id) ?? skins[0]
    skins.forEach((skin) => {
      const enabled = skin.id === next.id
      skin.props.forEach((prop) => prop.mesh.setEnabled(enabled))
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
  applySkin(activeSkin.id)

  const skinPanel = document.createElement("div")
  skinPanel.className = "skin-panel"
  const skinLabel = document.createElement("label")
  skinLabel.textContent = "Skin"
  const skinSelect = document.createElement("select")
  skinSelect.className = "skin-select"
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
  skinCycle.textContent = "Cycle"
  skinPanel.append(skinLabel, skinSelect, skinCycle)
  hudControls.insertBefore(skinPanel, tiltButton)
  hudControls.insertBefore(promptToggle, tiltButton)

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

  const input = initInput(canvas, tiltButton)
  const target = new Vector3()
  const velocity = new Vector3()
  const lastPos = hoverboard.root.position.clone()
  let hoverTime = 0
  let electricTarget: Mesh | null = null
  let electricIntensity = 0
  let highlightTime = 0

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

  const estimateSpeakMs = (text: string) => {
    const trimmed = text.trim()
    if (!trimmed) {
      return 800
    }
    const words = trimmed.split(/\s+/).filter(Boolean).length
    const wordMs = words * 520
    const charMs = trimmed.length * 60
    const base = clamp(Math.max(wordMs, charMs), 800, 5000)
    const rate = Math.max(gameStore.getState().stackConfig?.rate ?? 1, 0.4)
    return base / rate
  }

  const createSuccessParticles = (position: Vector3) => {
    const particleSystem = new ParticleSystem("successParticles", 100, scene)

    // Use a simple sphere emitter
    particleSystem.createSphereEmitter(0.2)

    // Particle appearance - gold/orange colors
    particleSystem.color1 = new Color4(1, 0.7, 0, 1) // Gold
    particleSystem.color2 = new Color4(1, 0.5, 0, 1) // Orange
    particleSystem.colorDead = new Color4(1, 0.3, 0, 0) // Fade to transparent

    // Size
    particleSystem.minSize = 0.05
    particleSystem.maxSize = 0.15

    // Lifetime
    particleSystem.minLifeTime = 0.5
    particleSystem.maxLifeTime = 1.0

    // Emission
    particleSystem.emitRate = 1000 // High rate for burst effect
    particleSystem.manualEmitCount = 100 // Emit all at once

    // Speed and direction
    particleSystem.minEmitPower = 2
    particleSystem.maxEmitPower = 4
    particleSystem.updateSpeed = 0.01

    // Gravity
    particleSystem.gravity = new Vector3(0, -2, 0)

    // Position
    particleSystem.emitter = position.clone()

    // Start the system
    particleSystem.start()

    // Auto-dispose after 1 second
    setTimeout(() => {
      particleSystem.stop()
      particleSystem.dispose()
    }, 1000)
  }

  const createFailParticles = (position: Vector3) => {
    const particleSystem = new ParticleSystem("failParticles", 80, scene)

    // Use a simple sphere emitter
    particleSystem.createSphereEmitter(0.2)

    // Particle appearance - dark red colors
    particleSystem.color1 = new Color4(0.6, 0, 0, 1) // Dark red
    particleSystem.color2 = new Color4(0.4, 0, 0, 1) // Darker red
    particleSystem.colorDead = new Color4(0.2, 0, 0, 0) // Fade to transparent

    // Size
    particleSystem.minSize = 0.04
    particleSystem.maxSize = 0.12

    // Lifetime
    particleSystem.minLifeTime = 0.4
    particleSystem.maxLifeTime = 0.8

    // Emission
    particleSystem.emitRate = 800
    particleSystem.manualEmitCount = 80

    // Speed and direction - mostly downward
    particleSystem.minEmitPower = 1
    particleSystem.maxEmitPower = 2
    particleSystem.updateSpeed = 0.01

    // Strong downward gravity
    particleSystem.gravity = new Vector3(0, -5, 0)

    // Direction - bias downward
    particleSystem.direction1 = new Vector3(-1, -2, -1)
    particleSystem.direction2 = new Vector3(1, -1, 1)

    // Position
    particleSystem.emitter = position.clone()

    // Start the system
    particleSystem.start()

    // Auto-dispose after 1 second
    setTimeout(() => {
      particleSystem.stop()
      particleSystem.dispose()
    }, 1000)
  }

  let shakeOffset = new Vector3(0, 0, 0)
  let shakeActive = false

  const triggerScreenShake = () => {
    if (shakeActive) return
    shakeActive = true

    const startTime = performance.now()
    const duration = 200 // 200ms
    const intensity = 0.03 // Subtle shake

    const shakeInterval = setInterval(() => {
      const elapsed = performance.now() - startTime
      if (elapsed >= duration) {
        clearInterval(shakeInterval)
        shakeOffset.set(0, 0, 0)
        shakeActive = false
        return
      }

      // Decay over time
      const decay = 1 - elapsed / duration
      const amount = intensity * decay

      // Random shake
      shakeOffset.x = (Math.random() - 0.5) * amount * 2
      shakeOffset.y = (Math.random() - 0.5) * amount * 2
      shakeOffset.z = (Math.random() - 0.5) * amount
    }, 16) // ~60fps
  }

  const shuffle = <T,>(items: T[]) => {
    for (let i = items.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1))
      const temp = items[i]
      items[i] = items[j]
      items[j] = temp
    }
    return items
  }

  const createPhraseMesh = (spec: PhraseSpec) => {
    const scale = getTextScale() * 1.45 * getSettings().textScaleFactor
    const wrapText = (text: string, lang?: string, maxChars = 18) => {
      const trimmed = text.trim()
      if (!trimmed) {
        return []
      }
      if (lang && isNoSpaceLanguage(lang)) {
        const chars = Array.from(trimmed)
        const lines: string[] = []
        for (let i = 0; i < chars.length; i += maxChars) {
          lines.push(chars.slice(i, i + maxChars).join(""))
        }
        return lines.slice(0, 3)
      }
      const words = trimmed.split(/\s+/).filter(Boolean)
      const lines: string[] = []
      let current = ""
      words.forEach((word) => {
        const next = current ? `${current} ${word}` : word
        if (next.length > maxChars && current) {
          lines.push(current)
          current = word
        } else {
          current = next
        }
      })
      if (current) {
        lines.push(current)
      }
      return lines.slice(0, 3)
    }

    const lines = wrapText(spec.text, spec.lang, 18)
    const romLines =
      spec.romanization && gameStore.getState().stackConfig?.showRomanization
        ? wrapText(spec.romanization, undefined, 30)
        : []
    const maxLineLength = Math.max(
      ...lines.map((line) => line.length),
      ...romLines.map((line) => line.length),
      6
    )
    const planeWidth =
      clamp(maxLineLength * 0.22, 2.8, 7.8) * scale
    const lineCount = lines.length + (romLines.length ? romLines.length : 0)
    const planeHeight = clamp(0.9 + lineCount * 0.5, 1.2, 2.6) * scale
    const texture = new DynamicTexture(
      `phrase-texture-${spec.id}`,
      { width: 2048, height: 1024 },
      scene,
      true
    )
    texture.hasAlpha = true
    const ctx = texture.getContext() as CanvasRenderingContext2D
    ctx.clearRect(0, 0, 2048, 512)
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"

    const drawTextLine = (
      text: string,
      y: number,
      font: string,
      fill: string
    ) => {
      ctx.font = font
      ctx.lineWidth = 16
      ctx.strokeStyle = "rgba(5, 10, 20, 0.7)"
      ctx.shadowColor = "rgba(0, 0, 0, 0.55)"
      ctx.shadowBlur = 16
      ctx.strokeText(text, 1024, y)
      ctx.shadowBlur = 0
      ctx.fillStyle = fill
      ctx.fillText(text, 1024, y)
    }

    const baseY = 320 - (lines.length - 1) * 90 - (romLines.length ? 45 : 0)
    lines.forEach((line, index) => {
      drawTextLine(
        line,
        baseY + index * 170,
        "700 190px 'Trebuchet MS', 'Helvetica Neue', sans-serif",
        "rgba(245, 250, 255, 0.98)"
      )
    })
    if (romLines.length) {
      romLines.forEach((line, index) => {
        drawTextLine(
          line,
          baseY + lines.length * 170 + 30 + index * 95,
          "600 85px 'Trebuchet MS', 'Helvetica Neue', sans-serif",
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
    const baseEmissive = new Color3(0.35, 0.6, 0.95)
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
    return { mesh, baseWidth: planeWidth, baseHeight: planeHeight }
  }

  const setPhraseHighlight = (mesh: Mesh, strength: number) => {
    const material = mesh.material
    if (!(material instanceof StandardMaterial)) {
      return
    }
    const base =
      (mesh.metadata as { baseEmissive?: Color3 } | undefined)?.baseEmissive ??
      material.emissiveColor
    const boosted = scaleColor(base, 1 + strength * 1.4)
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
        const { promptLang, answerLang } = pickLanguages(stackConfig)
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
        const { maxDistractors } = getSettings()
        for (
          let attempt = 0;
          attempt < 14 && distractors.length < maxDistractors;
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
        const nextRound: RoundState = {
          id: roundId,
          promptLang,
          answerLang,
          prompt,
          promptRomanization,
          answer,
          answerRomanization,
          choices: shuffle([correct, ...distractors]),
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
      phrase.mesh.dispose()
      gameStore.update((draft) => {
        draft.activePhrases = draft.activePhrases.filter((p) => p !== phrase)
      })
    } else {
      // Clear all phrases
      state.activePhrases.forEach((p) => p.mesh.dispose())
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
    })
    clearActivePhrase()
    clearTransition()
    hudPromptLabel.textContent = getPromptLabel()
    updatePromptText(null)
    clearSpeakRepeat()
    void buildRound(gameStore.getState().roundGeneration)
  }

  const updateStackConfig = (next: StackConfig) => {
    const prev = gameStore.getState().stackConfig
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
      return `${current.promptLang.toUpperCase()} → ${current.answerLang.toUpperCase()}`
    }
    return "Listen"
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
      hudPrompt.textContent = "Waiting for phrase..."
      hudPromptRomanization.textContent = ""
      hudAnswer.textContent = ""
      hudAnswerRomanization.textContent = ""
      hudAnswer.style.display = "none"
      hudAnswerRomanization.style.display = "none"
      return
    }
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
    hudAnswer.textContent = ""
    hudAnswerRomanization.textContent = ""
    hudAnswer.style.display = "none"
    hudAnswerRomanization.style.display = "none"
  }

  const showMatchHud = (nextRound: RoundState) => {
    phraseHud.classList.add("match")
    hudPromptLabel.textContent = "Matched"
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
    }, getSettings().speakRepeatMs)
  }

  const onPromptToggle = () => {
    showPrompt = promptToggleInput.checked
    updatePromptVisibility()
  }
  promptToggleInput.addEventListener("change", onPromptToggle)
  updatePromptVisibility()

  const syncTuningControls = () => {
    const { settings } = tuningStore.getState()
    tuningControls.forEach((control) => {
      const next = settings[control.key] as number
      if (Number(control.input.value) !== next) {
        control.input.value = String(next)
        control.setValue(next)
      }
    })
  }

  const updateStatsHud = () => {
    const { score, streak, bestStreak } = tuningStore.getState().stats
    hudScore.textContent = `Score ${score}`
    hudStreak.textContent = `Streak ${streak} • Best ${bestStreak}`
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
    })
    clearActivePhrase()
    updatePromptText(nextRound)
    phraseHud.classList.add("intro")
    clearSpeakRepeat()
    hostApi.speak(nextRound.promptLang, nextRound.prompt)

    const { introRepeatMs, promptLeadMs } = getSettings()
    const firstSpeakMs = estimateSpeakMs(nextRound.prompt)
    const dynamicIntroMs = getPhraseDuration(nextRound.prompt, nextRound.promptLang, 800)
    const holdMs = Math.max(dynamicIntroMs, firstSpeakMs + 200)
    const gapMs = Math.max(introRepeatMs, 200)
    const secondSpeakMs = estimateSpeakMs(nextRound.prompt)
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
    electricIntensity = 0
    gameStore.update((draft) => {
      draft.phase = "celebrate"
    })
    showMatchHud(nextRound)
    phraseHud.classList.add("celebrate")
    clearSpeakRepeat()
    hostApi.speak(nextRound.answerLang, nextRound.answer)
    const promptDuration = estimateSpeakMs(nextRound.prompt)
    const answerDuration = estimateSpeakMs(nextRound.answer)
    const speakGapMs = 220
    setTransitionTimeout(() => {
      hostApi.speak(nextRound.promptLang, nextRound.prompt)
    }, answerDuration + speakGapMs)
    const dynamicCelebrationMs = getPhraseDuration(
      nextRound.answer,
      nextRound.answerLang,
      600
    )
    const celebrationDelay = Math.max(
      dynamicCelebrationMs,
      answerDuration + speakGapMs + promptDuration + 250
    )
    setTransitionTimeout(() => {
      startNewRound()
    }, celebrationDelay + getSettings().postCelebrateMs)
  }

  const spawnPhrase = (spec: PhraseSpec, lane: number) => {
    const { mesh, baseWidth, baseHeight } = createPhraseMesh(spec)
    mesh.position.copyFrom(laneToPosition(lane))
    const newPhrase: PhraseInstance = { spec, mesh, lane, baseWidth, baseHeight }
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
    const { correctWeight, maxIncorrectStreak } = getSettings()
    const correct = choices.find((choice) => choice.isCorrect) ?? null
    if (correct && state.incorrectStreak >= maxIncorrectStreak) {
      return correct
    }
    let pool = choices
    if (choices.length > 1 && state.lastPhraseId) {
      const filtered = choices.filter((choice) => choice.id !== state.lastPhraseId)
      if (filtered.length) {
        pool = filtered
      }
    }
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
    const maxPhrases = getSettings().maxSimultaneousPhrases
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
          const baseSpawnInterval = travelTime / maxPhrases
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
    const pulse = 0.55 + Math.sin(highlightTime * 7) * 0.35

    // Find the closest phrase in the player's lane (for electric field)
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

    // Set electric field target to closest phrase in player's lane
    electricTarget = closestInLane ? closestInLane.mesh : null
    electricIntensity = closestInLane ? 1 : 0

    // Process each active phrase
    for (const current of activePhrases) {
      current.mesh.position.z -= getPhraseSpeed() * dt
      const depth = clamp(
        (PHRASE_START_Z - current.mesh.position.z) / (PHRASE_START_Z - PHRASE_HIT_Z),
        0,
        1
      )
      const targetScale = 0.85 + depth * 2.3
      const { textOverflowFactor } = getSettings()
      const maxScaleX = (SECTOR.width / current.baseWidth) * textOverflowFactor
      const maxScaleY = (SECTOR.height / current.baseHeight) * textOverflowFactor
      const scale = Math.min(targetScale, maxScaleX, maxScaleY)
      current.mesh.scaling.x = scale
      current.mesh.scaling.y = scale

      const laneMatch = hoverLane === current.lane
      setPhraseHighlight(current.mesh, laneMatch ? pulse : 0)

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
        createSuccessParticles(phrasePosition)
        startCelebration(round)
      } else if (!current.spec.isCorrect) {
        gameStore.update((draft) => {
          draft.incorrectStreak += 1
        })
        tuningStore.getState().recordWrong()
        if (tuningStore.getState().settings.sfxEnabled) sfx.playFail()
        createFailParticles(phrasePosition)
        triggerScreenShake()
        setPromptStatus("Wrong - dodge!", true)
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
        gameStore.update((draft) => {
          draft.incorrectStreak = getSettings().maxIncorrectStreak
        })
        tuningStore.getState().recordWrong()
        if (tuningStore.getState().settings.sfxEnabled) sfx.playFail()
        createFailParticles(passedPosition)
        triggerScreenShake()
        setPromptStatus("Missed!", true)
        if (round) {
          hostApi.speak(round.answerLang, round.answer)
        }
      } else {
        gameStore.update((draft) => {
          draft.incorrectStreak += 1
        })
        tuningStore.getState().recordDodge()
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
        gameStore.update((draft) => {
          draft.incorrectStreak = getSettings().maxIncorrectStreak
        })
        tuningStore.getState().recordWrong()
        if (tuningStore.getState().settings.sfxEnabled) sfx.playFail()
        createFailParticles(endPosition)
        triggerScreenShake()
        setPromptStatus("Missed!", true)
        if (round) {
          hostApi.speak(round.answerLang, round.answer)
        }
      } else {
        gameStore.update((draft) => {
          draft.incorrectStreak += 1
        })
        tuningStore.getState().recordDodge()
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
      target.y = rowToY(input.state.row)
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

  engine.runRenderLoop(() => {
    const dt = Math.min(engine.getDeltaTime() / 1000, 0.05)
    if (!paused) {
      road.update(dt)
      updatePlayer(dt)
      updatePhrases(dt)
      updatePropField(activeSkin.props, road)
      electricField.update(dt, electricTarget, electricIntensity)
    }
    const farX = road.getFarCenterX()
    camera.setTarget(
      new Vector3(farX * 0.2 + shakeOffset.x, cameraTargetY + shakeOffset.y, 10 + shakeOffset.z)
    )
    scene.render()
  })

  const onResize = () => {
    engine.setHardwareScalingLevel(1 / Math.min(window.devicePixelRatio || 1, 2))
    engine.resize()
    updateCameraForViewport()
  }
  window.addEventListener("resize", onResize)

  const dispose = () => {
    disposed = true
    if (promptStatusTimeout) {
      window.clearTimeout(promptStatusTimeout)
      promptStatusTimeout = null
    }
    clearSpeakRepeat()
    clearActivePhrase()
    clearTransition()
    stackUnsubscribe?.()
    tuningUnsubscribe?.()
    hostApi.stopSpeech?.()
    input.dispose()
    window.removeEventListener("resize", onResize)
    document.removeEventListener("visibilitychange", onVisibilityChange)
    window.removeEventListener("pointerdown", onWakeLockGesture)
    hudBackdrop.removeEventListener("click", onBackdropClick)
    fabButton.removeEventListener("click", onFabClick)
    hudExit.removeEventListener("click", requestExit)
    skinSelect.removeEventListener("change", onSkinChange)
    skinCycle.removeEventListener("click", onSkinCycle)
    promptToggleInput.removeEventListener("change", onPromptToggle)
    if (wakeLock) {
      void wakeLock.release()
      wakeLock = null
    }
    sfx.dispose()
    engine.stopRenderLoop()
    scene.dispose()
    engine.dispose()
    root.remove()
  }

  return { dispose }
}
