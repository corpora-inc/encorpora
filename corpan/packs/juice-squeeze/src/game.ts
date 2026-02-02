import {
  Camera,
  Color3,
  Color4,
  DirectionalLight,
  DynamicTexture,
  Engine,
  HemisphericLight,
  Mesh,
  MeshBuilder,
  ParticleSystem,
  PointerDragBehavior,
  Scene,
  SceneLoader,
  ShadowGenerator,
  StandardMaterial,
  Texture,
  TransformNode,
  UniversalCamera,
  Vector3,
} from "@babylonjs/core"
import "@babylonjs/loaders/glTF"
import type { HostApi, StackConfig } from "./sdk/types"
import { loadUtterance, type Utterance } from "./data"
import { useGameStore, LEVEL_FRUIT_COLORS, BOTTLES_PER_LEVEL, getAllFruits, type CEFRLevel, type FruitDef } from "./store/gameState"
import { createJuiceGlass, type JuiceGlass } from "./juiceAnimation"
import { createBottle3D, type Bottle3D } from "./bottle3D"
import { t } from "./translations"
import successSoundUrl from "./sounds/success.mp3"
import corpanLogoUrl from "./assets/corpan-logo.png"

// Helper to darken/lighten hex colors
const shadeColor = (color: string, percent: number): string => {
  const num = parseInt(color.replace("#", ""), 16)
  const amt = Math.round(2.55 * percent)
  const R = (num >> 16) + amt
  const G = (num >> 8 & 0x00FF) + amt
  const B = (num & 0x0000FF) + amt
  return "#" + (
    0x1000000 +
    (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
    (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
    (B < 255 ? (B < 1 ? 0 : B) : 255)
  ).toString(16).slice(1)
}

// Helper to redraw a word block's texture with new text (for fruit flip feature)
const updateBlockText = (
  texture: DynamicTexture,
  newText: string,
  fruitColor: string
) => {
  // Get actual texture dimensions (may vary by word length)
  const textureSize = texture.getSize()
  const textureWidth = textureSize.width
  const textureHeight = textureSize.height
  const ctx = texture.getContext() as CanvasRenderingContext2D

  // Rounded rectangle helper
  const roundRect = (x: number, y: number, w: number, h: number, r: number) => {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + w - r, y)
    ctx.quadraticCurveTo(x + w, y, x + w, y + r)
    ctx.lineTo(x + w, y + h - r)
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
    ctx.lineTo(x + r, y + h)
    ctx.quadraticCurveTo(x, y + h, x, y + h - r)
    ctx.lineTo(x, y + r)
    ctx.quadraticCurveTo(x, y, x + r, y)
    ctx.closePath()
  }

  // Clear texture
  ctx.clearRect(0, 0, textureWidth, textureHeight)

  const padding = 16
  const radius = 48

  // Draw rounded block with gradient for depth
  roundRect(padding, padding, textureWidth - padding * 2, textureHeight - padding * 2, radius)

  // Premium gradient - brighter top, richer bottom for shine
  const lighterColor = shadeColor(fruitColor, 15)
  const gradient = ctx.createLinearGradient(0, 0, 0, textureHeight)
  gradient.addColorStop(0, lighterColor)
  gradient.addColorStop(0.4, fruitColor)
  gradient.addColorStop(1, shadeColor(fruitColor, -25))

  ctx.fillStyle = gradient
  ctx.fill()

  // Glossy highlight at top - bright and extended for premium candy look
  const highlightGradient = ctx.createLinearGradient(0, padding, 0, textureHeight * 0.5)
  highlightGradient.addColorStop(0, "rgba(255, 255, 255, 0.95)")
  highlightGradient.addColorStop(0.2, "rgba(255, 255, 255, 0.6)")
  highlightGradient.addColorStop(0.5, "rgba(255, 255, 255, 0.15)")
  highlightGradient.addColorStop(1, "rgba(255, 255, 255, 0)")
  roundRect(padding, padding, textureWidth - padding * 2, textureHeight - padding * 2, radius)
  ctx.fillStyle = highlightGradient
  ctx.fill()

  // Clean solid border with subtle shadow for premium look
  ctx.shadowColor = shadeColor(fruitColor, -20)
  ctx.shadowBlur = 8
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = 3
  roundRect(padding, padding, textureWidth - padding * 2, textureHeight - padding * 2, radius)
  ctx.strokeStyle = shadeColor(fruitColor, -40)
  ctx.lineWidth = 8
  ctx.stroke()
  ctx.shadowBlur = 0
  ctx.shadowOffsetY = 0

  // Calculate font size to fill texture width
  // Long text uses 90% of width, shorter text uses 80%
  const textFillRatio = newText.length >= 12 ? 0.9 : 0.8
  let fontSize = 300
  ctx.font = `bold ${fontSize}px Arial`
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"

  let textWidth = ctx.measureText(newText).width

  while (textWidth > textureWidth * textFillRatio && fontSize > 48) {
    fontSize -= 10
    ctx.font = `bold ${fontSize}px Arial`
    textWidth = ctx.measureText(newText).width
  }

  // For short text (like emojis), make them HUGE
  if (newText.length <= 3) {
    const maxVerticalSize = textureHeight * 0.7
    fontSize = Math.min(fontSize, maxVerticalSize)
    ctx.font = `bold ${fontSize}px Arial`
  }

  // Text shadow for depth
  ctx.shadowColor = "rgba(0, 0, 0, 0.4)"
  ctx.shadowBlur = 24
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = 10

  // Dark text
  ctx.fillStyle = "#2a2a2a"
  ctx.fillText(newText, textureWidth / 2, textureHeight / 2)

  // Reset shadow
  ctx.shadowColor = "transparent"
  ctx.shadowBlur = 0
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = 0

  // CRITICAL: Push changes to GPU
  texture.update()
}

// Utility functions for smooth responsive scaling
const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value))

const lerp = (a: number, b: number, t: number): number =>
  a + (b - a) * clamp(t, 0, 1)

type InitialState = {
  stackConfig?: StackConfig
}

export const createJuiceSqueeze = (
  container: HTMLElement,
  hostApi: HostApi,
  initialState?: InitialState
) => {
  // Stop any lingering TTS from Corpán main experience
  if (typeof hostApi.stopSpeech === "function") {
    hostApi.stopSpeech()
  }

  let disposed = false

  // Track rotation index for multi-language stacks (3+ languages)
  let targetLangRotationIndex = 0

  const root = document.createElement("div")
  root.className = "juice-squeeze"
  container.appendChild(root)

  // Preload success sound for instant playback on win
  console.log("[juice-squeeze] Creating success sound with URL:", successSoundUrl)
  const successSound = new Audio(successSoundUrl)
  successSound.preload = "auto"
  successSound.volume = 0.9
  successSound.addEventListener("canplaythrough", () => {
    console.log("[juice-squeeze] Success sound preloaded and ready")
  })
  successSound.addEventListener("error", (e) => {
    console.error("[juice-squeeze] Success sound load error:", e)
  })

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

  const canvas = document.createElement("canvas")
  canvas.style.width = "100%"
  canvas.style.height = "100%"
  root.appendChild(canvas)

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
  // Dark grey background for immersive juice experience
  scene.clearColor = new Color4(0.1, 0.1, 0.1, 1) // Dark grey #1a1a1a

  // Camera setup - ORTHOGRAPHIC for 2D view
  const camera = new UniversalCamera("camera", new Vector3(0, 0, -15), scene)
  camera.mode = Camera.ORTHOGRAPHIC_CAMERA
  camera.setTarget(Vector3.Zero())
  camera.inputs.clear()

  // Create subtle Corpan logo checkerboard background pattern
  const createLogoBackground = () => {
    const bgSize = 50 // Large plane to cover viewport
    const bgPlane = MeshBuilder.CreatePlane("logo-background", { size: bgSize }, scene)
    bgPlane.position = new Vector3(0, 0, 10) // Behind all game elements

    const bgMaterial = new StandardMaterial("logo-bg-material", scene)
    const logoTexture = new Texture(corpanLogoUrl, scene)
    logoTexture.hasAlpha = true
    // Tile the logo across the background
    logoTexture.uScale = 8 // Repeat 8 times horizontally
    logoTexture.vScale = 8 // Repeat 8 times vertically

    bgMaterial.diffuseTexture = logoTexture
    bgMaterial.emissiveColor = new Color3(0.25, 0.25, 0.25) // Grey tint instead of orange
    bgMaterial.alpha = 0.06 // Very subtle, ~6% opacity
    bgMaterial.disableLighting = true
    bgMaterial.backFaceCulling = false

    bgPlane.material = bgMaterial
    return bgPlane
  }
  const logoBackground = createLogoBackground()

  // Create 3D bottle with liquid animation
  const initialBottleProgress = useGameStore.getState().bottleProgress
  const bottle3D: Bottle3D = createBottle3D(scene, initialBottleProgress?.currentLevel || "A0")

  // Color cycling for visual variety between bottles - use all 26 tropical fruits
  const allFruits: FruitDef[] = getAllFruits()
  // Initialize from persisted color index
  let colorIndex = initialBottleProgress?.currentColorIndex ?? 0
  if (colorIndex < 0 || colorIndex >= allFruits.length) colorIndex = 0

  // Helper to get current fruit colors (for backward compatibility with level-based API)
  const getCurrentFruitAsLevel = (): CEFRLevel => allFruits[colorIndex].level

  // Track current utterance for word count and TTS
  let currentUtterance: Utterance | null = null

  // Track TTS timeout to prevent phantom phrases on quick exit/reopen
  let ttsTimeoutId: number | null = null

  // Schedule TTS with proper cleanup
  const scheduleTTS = (lang: string, text: string, delayMs: number = 500) => {
    // Clear any pending TTS timeout
    if (ttsTimeoutId !== null) {
      window.clearTimeout(ttsTimeoutId)
      ttsTimeoutId = null
    }

    ttsTimeoutId = window.setTimeout(() => {
      if (!disposed) {
        speak(lang, text)
      }
      ttsTimeoutId = null
    }, delayMs)
  }

  // Fast TTS - speak immediately, canceling any queued speech
  // Use only when interruption is desired (e.g., game init)
  const speakFast = (lang: string, text: string) => {
    // Stop any currently playing speech for instant response
    if (typeof hostApi.stopSpeech === "function") {
      hostApi.stopSpeech()
    }
    if (typeof hostApi.speak === "function") {
      hostApi.speak(lang, text)
    }
  }

  // Speak without interrupting - allows audio to overlap using concurrent TTS
  const speak = (lang: string, text: string) => {
    // Prefer speakConcurrent for true overlapping audio
    if (typeof hostApi.speakConcurrent === "function") {
      hostApi.speakConcurrent(lang, text)
    } else if (typeof hostApi.speak === "function") {
      hostApi.speak(lang, text)
    }
  }

  // Smart join that doesn't add spaces around apostrophes
  // Handles cases like ["d", "'", "art"] → "d'art" instead of "d ' art"
  const smartJoinWords = (words: string[]): string => {
    let result = ""
    for (let i = 0; i < words.length; i++) {
      const word = words[i]
      const prev = words[i - 1]

      // Don't add space before apostrophes or after single-letter + apostrophe
      if (i === 0) {
        result = word
      } else if (word === "'" || /^['']/.test(word)) {
        // Apostrophe - no space before
        result += word
      } else if (prev === "'" || /['']$/.test(prev)) {
        // Previous was apostrophe - no space after
        result += word
      } else {
        // Normal word - add space
        result += " " + word
      }
    }
    return result
  }

  // Layout metrics type
  type LayoutMetrics = {
    worldWidth: number
    worldHeight: number
    targetPhraseY: number
    sentenceAreaY: number
    wordBlocksY: number
    blockLabelY: number
    pixelsPerUnit: number
  }

  // Get viewport-based layout metrics
  const getLayoutMetrics = (): LayoutMetrics => {
    const canvasElement = engine.getRenderingCanvas()
    if (!canvasElement) {
      // Fallback values
      return {
        worldWidth: 20,
        worldHeight: 20,
        targetPhraseY: 7,
        sentenceAreaY: 2,
        wordBlocksY: -5,
        blockLabelY: -8,
        pixelsPerUnit: 16,
      }
    }

    const canvasW = canvasElement.width
    const canvasH = canvasElement.height
    const aspectRatio = canvasW / canvasH

    // World units that map to screen
    // Keep world at constant 20 units - mesh scaling handles responsive behavior
    // At 320px: 1 world unit = 16 pixels
    // At 640px: 1 world unit = 32 pixels
    // At 200px: 1 world unit = 10 pixels
    const baseWidth = 20
    const worldWidth = baseWidth
    const worldHeight = worldWidth / aspectRatio

    // Calculate pixels per world unit for HTML overlay positioning
    const pixelsPerUnit = canvasW / worldWidth

    // Regions in world coordinates (0,0 = center)
    // Top region: 80-95% of screen height = 85% from bottom = 15% from top
    // In world coords: positive Y is up, so 85% up = worldHeight * 0.35
    const targetPhraseY = worldHeight * 0.48

    // Middle region: 45-70% of screen height = 60% from bottom = 40% from top
    // In world coords: 60% up = worldHeight * 0.1
    const sentenceAreaY = worldHeight * 0.1

    // Bottom region: 5-35% of screen height = 25% from bottom
    // In world coords: 25% down = -worldHeight * 0.25
    const wordBlocksY = -worldHeight * 0.25

    // Block label: 40% from bottom
    const blockLabelY = -worldHeight * 0.4

    return {
      worldWidth,
      worldHeight,
      targetPhraseY,
      sentenceAreaY,
      wordBlocksY,
      blockLabelY,
      pixelsPerUnit,
    }
  }

  // Layout constants for responsive design
  // These are BASE values at 320px viewport - they scale proportionally with viewport
  const BASE_MIN_BLOCK_WIDTH = 2.0 // Base minimum block width at 320px (reduced to fit more)
  const BASE_MIN_BLOCK_HEIGHT = 1.0 // Base minimum block height at 320px (reduced to fit more)
  const MAX_BLOCKS_PER_ROW = 5 // Force 2-row layout above this

  // Get ideal width for a word proportional to character count
  // This replaces the tiered multiplier system with a smooth proportional formula
  // baseUnit is the width for a "standard" 6-char word
  const getIdealWidthMultiplier = (word: string): number => {
    const len = word.length

    // Punctuation gets half-width blocks
    if (len === 1 && /^[\p{P}]$/u.test(word)) return 0.5

    // Proportional to character count: len/6, clamped to [1.0, 3.0]
    // 6 chars → 1.0x, 12 chars → 2.0x, 18+ chars → 3.0x (capped)
    return Math.min(3.0, Math.max(0.5, len / 6))
  }

  // Alias for backwards compatibility where getWordWidthMultiplier was used
  const getWordWidthMultiplier = getIdealWidthMultiplier

  // Multi-row sentence area constants
  const MAX_SENTENCE_ROWS = 4 // Increased to fit longer phrases
  const SENTENCE_BLOCKS_PER_ROW_MOBILE = 3 // ≤480px viewport width
  const SENTENCE_BLOCKS_PER_ROW_TABLET = 4 // 481-720px
  const SENTENCE_BLOCKS_PER_ROW_DESKTOP = 6 // >720px
  const SENTENCE_ROW_SPACING_RATIO = 0.4 // Gap between rows as ratio of block height

  // Calculate dynamic block size with fill-available-space algorithm
  // Blocks ALWAYS fill 90% of available width - scaling up or down as needed
  const calculateBlockSize = (words: string[], metrics: LayoutMetrics) => {
    const wordCount = words.length
    if (wordCount === 0) {
      // Fallback for empty words array
      return { baseWidth: 2.0, width: 2.0, height: 1.0, gap: 0.3, fontSize: 32, twoRowLayout: false }
    }

    // Available space
    const availableWidth = metrics.worldWidth * 0.9 // 90% of screen width
    const gapRatio = 0.15 // 15% of base unit as gap

    // Calculate ideal multipliers for each word
    const multipliers = words.map(getIdealWidthMultiplier)
    const totalMultiplier = multipliers.reduce((sum, m) => sum + m, 0)

    // Check if we need 2-row layout (more than 5 words)
    const needsTwoRows = wordCount > MAX_BLOCKS_PER_ROW

    let effectiveWordCount: number
    let effectiveMultiplier: number

    if (needsTwoRows) {
      // WORST CASE: assume all largest words end up in one row after shuffle
      // Sort multipliers descending, sum the top N (where N = blocks per row)
      const topRowCount = Math.ceil(wordCount / 2)
      const sortedMultipliers = [...multipliers].sort((a, b) => b - a)
      const worstCaseRowSum = sortedMultipliers.slice(0, topRowCount).reduce((sum, m) => sum + m, 0)

      effectiveMultiplier = worstCaseRowSum
      effectiveWordCount = topRowCount
    } else {
      effectiveMultiplier = totalMultiplier
      effectiveWordCount = wordCount
    }

    // Calculate base unit that fills available space exactly
    // totalWidth = effectiveMultiplier * baseUnit + (effectiveWordCount - 1) * gapRatio * baseUnit
    // availableWidth = baseUnit * (effectiveMultiplier + (effectiveWordCount - 1) * gapRatio)
    const totalGapMultiplier = (effectiveWordCount - 1) * gapRatio
    const baseUnit = availableWidth / (effectiveMultiplier + totalGapMultiplier)

    // Apply maximum bound only - let blocks shrink as needed to fit
    const viewportScale = metrics.worldWidth / 20
    const maxBaseUnit = BASE_MIN_BLOCK_WIDTH * viewportScale * 3.0 // Cap for few words
    const clampedBaseUnit = Math.min(maxBaseUnit, baseUnit)

    // Height is proportional to base unit
    const blockHeight = clampedBaseUnit * 0.5

    // Font size = 40% of block height in pixels
    const rawFontSize = Math.floor(blockHeight * metrics.pixelsPerUnit * 0.4)
    const fontSize = Math.max(16, Math.min(rawFontSize, 200))

    return {
      baseWidth: clampedBaseUnit,  // Base width for 1x multiplier
      width: clampedBaseUnit,      // For backwards compatibility
      height: blockHeight,
      gap: clampedBaseUnit * gapRatio,
      fontSize,
      twoRowLayout: needsTwoRows,
    }
  }

  // Get max blocks per row for sentence area based on viewport width
  const getSentenceBlocksPerRow = (viewportWidth: number): number => {
    if (viewportWidth <= 480) return SENTENCE_BLOCKS_PER_ROW_MOBILE
    if (viewportWidth <= 720) return SENTENCE_BLOCKS_PER_ROW_TABLET
    return SENTENCE_BLOCKS_PER_ROW_DESKTOP
  }

  // Calculate number of rows needed for sentence area
  const calculateSentenceRows = (
    wordCount: number,
    metrics: LayoutMetrics,
    blockSize: { width: number }
  ): number => {
    const canvasElement = engine.getRenderingCanvas()
    const viewportWidth = canvasElement?.width || 720

    // Get max blocks per row based on viewport
    const maxBlocksPerRow = getSentenceBlocksPerRow(viewportWidth)

    // Also check available width vs block size
    const availableWidth = metrics.worldWidth * 0.85
    const blocksPerRowByWidth = Math.floor(availableWidth / (blockSize.width * 1.15))

    // Use the more restrictive limit
    const effectiveBlocksPerRow = Math.max(2, Math.min(maxBlocksPerRow, blocksPerRowByWidth))

    // Calculate rows needed
    const rowsNeeded = Math.ceil(wordCount / effectiveBlocksPerRow)
    return Math.min(MAX_SENTENCE_ROWS, Math.max(1, rowsNeeded))
  }

  // Get row Y positions for sentence area
  const getSentenceRowYPositions = (
    rowCount: number,
    sentenceAreaCenterY: number,
    rowHeight: number
  ): number[] => {
    if (rowCount === 1) {
      return [sentenceAreaCenterY]
    }

    // Center the rows around sentenceAreaCenterY
    // Top row is highest Y (positive), bottom row is lowest
    const totalHeight = (rowCount - 1) * rowHeight
    const topRowY = sentenceAreaCenterY + totalHeight / 2

    return Array.from({ length: rowCount }, (_, i) => topRowY - i * rowHeight)
  }

  // Get target row from drop Y position
  const getTargetRow = (
    dropY: number,
    rowYPositions: number[]
  ): number => {
    if (rowYPositions.length === 1) return 0

    // Find closest row
    let closestRow = 0
    let closestDistance = Math.abs(dropY - rowYPositions[0])

    for (let i = 1; i < rowYPositions.length; i++) {
      const distance = Math.abs(dropY - rowYPositions[i])
      if (distance < closestDistance) {
        closestDistance = distance
        closestRow = i
      }
    }

    return closestRow
  }

  // Reflow blocks in sentence area across multiple rows
  // Reflow sentence blocks with variable widths
  const reflowSentenceBlocks = (metrics: LayoutMetrics) => {
    // Get all blocks in sentence area with their data
    const blocksInSentence = Array.from(wordBlockData.entries())
      .filter(([_, data]) => data.isInSentence)
      .map(([mesh, data]) => ({ mesh, data }))

    if (blocksInSentence.length === 0) return

    // Calculate current block size for gap reference
    const currentWords = currentUtterance?.words || []
    const currentBlockSize = calculateBlockSize(currentWords, metrics)
    const blockGap = currentBlockSize.gap * 1.15 // Sentence area gap

    // Get max blocks per row
    const canvasElement = engine.getRenderingCanvas()
    const viewportWidth = canvasElement?.width || 720
    const maxBlocksPerRow = getSentenceBlocksPerRow(viewportWidth)

    // Also check available width (use base width for estimation)
    const availableWidth = metrics.worldWidth * 0.85
    const avgBlockWidth = currentBlockSize.baseWidth * 1.15
    const blocksPerRowByWidth = Math.floor(availableWidth / avgBlockWidth)
    const effectiveBlocksPerRow = Math.max(2, Math.min(maxBlocksPerRow, blocksPerRowByWidth))

    // Sort blocks by row first, then by X position within row (left to right)
    blocksInSentence.sort((a, b) => {
      if (a.data.sentenceRow !== b.data.sentenceRow) {
        return a.data.sentenceRow - b.data.sentenceRow
      }
      return a.mesh.position.x - b.mesh.position.x
    })

    // Group blocks into rows
    const rows: typeof blocksInSentence[] = []
    blocksInSentence.forEach((item, globalIndex) => {
      const row = Math.floor(globalIndex / effectiveBlocksPerRow)
      if (!rows[row]) rows[row] = []
      rows[row].push(item)
    })

    // Position each row with variable widths
    rows.forEach((rowBlocks, rowIndex) => {
      // Get widths for blocks in this row
      const rowWidths = rowBlocks.map((item) => item.data.baseWidth || currentBlockSize.baseWidth)
      const rowTotalWidth = rowWidths.reduce((sum, w) => sum + w, 0) + (rowBlocks.length - 1) * blockGap

      // Calculate starting X for this row (centered)
      let currentX = -rowTotalWidth / 2

      rowBlocks.forEach((item, indexInRow) => {
        const thisWidth = rowWidths[indexInRow]
        item.mesh.position.x = currentX + thisWidth / 2
        item.mesh.position.y = sentenceRowYPositions[rowIndex] || metrics.sentenceAreaY
        item.mesh.position.z = -0.5 // Keep in front
        currentX += thisWidth + blockGap

        // Update data
        item.data.sentenceRow = rowIndex
      })
    })
  }

  // Position word blocks in the word bank (NOT in sentence area)
  // Uses stored baseWidth values directly - no position scaling
  const positionWordBlocks = (
    blocks: Mesh[],
    metrics: LayoutMetrics,
    blockSize: { width: number; height: number; gap: number; twoRowLayout?: boolean }
  ) => {
    // Filter to only blocks NOT in sentence area
    const blocksInWordBank = blocks.filter((block) => {
      const data = wordBlockData.get(block)
      return data && !data.isInSentence
    })

    const wordCount = blocksInWordBank.length
    if (wordCount === 0) return

    // Get widths for each block from stored data
    const blockWidths = blocksInWordBank.map((block) => {
      const data = wordBlockData.get(block)
      return data?.baseWidth || blockSize.width
    })

    // Use gap from blockSize
    const gap = blockSize.gap

    if (blockSize.twoRowLayout && wordCount > 1) {
      // Two-row layout for many words
      const topRowCount = Math.ceil(wordCount / 2)
      const rowGap = blockSize.height * 0.5

      // Calculate widths for each row
      const topRowWidths = blockWidths.slice(0, topRowCount)
      const bottomRowWidths = blockWidths.slice(topRowCount)

      // Position top row (first half of words)
      const topRowTotalWidth = topRowWidths.reduce((sum, w) => sum + w, 0) + (topRowCount - 1) * gap
      let topCurrentX = -topRowTotalWidth / 2
      const topY = metrics.wordBlocksY + rowGap / 2 + blockSize.height / 2

      for (let i = 0; i < topRowCount; i++) {
        const thisWidth = topRowWidths[i]
        blocksInWordBank[i].position.x = topCurrentX + thisWidth / 2
        blocksInWordBank[i].position.y = topY
        blocksInWordBank[i].position.z = 0
        topCurrentX += thisWidth + gap
        const data = wordBlockData.get(blocksInWordBank[i])
        if (data) {
          data.originalPosition = blocksInWordBank[i].position.clone()
        }
      }

      // Position bottom row (remaining words)
      const bottomRowCount = bottomRowWidths.length
      if (bottomRowCount > 0) {
        const bottomRowTotalWidth = bottomRowWidths.reduce((sum, w) => sum + w, 0) + (bottomRowCount - 1) * gap
        let bottomCurrentX = -bottomRowTotalWidth / 2
        const bottomY = metrics.wordBlocksY - rowGap / 2 - blockSize.height / 2

        for (let i = topRowCount; i < wordCount; i++) {
          const j = i - topRowCount
          const thisWidth = bottomRowWidths[j]
          blocksInWordBank[i].position.x = bottomCurrentX + thisWidth / 2
          blocksInWordBank[i].position.y = bottomY
          blocksInWordBank[i].position.z = 0
          bottomCurrentX += thisWidth + gap
          const data = wordBlockData.get(blocksInWordBank[i])
          if (data) {
            data.originalPosition = blocksInWordBank[i].position.clone()
          }
        }
      }
    } else {
      // Single row layout with variable widths
      const totalWidth = blockWidths.reduce((sum, w) => sum + w, 0) + (wordCount - 1) * gap
      let currentX = -totalWidth / 2

      blocksInWordBank.forEach((block, i) => {
        const thisWidth = blockWidths[i]
        block.position.x = currentX + thisWidth / 2
        block.position.y = metrics.wordBlocksY
        block.position.z = 0
        currentX += thisWidth + gap

        // Update originalPosition in wordBlockData for snap-back
        const data = wordBlockData.get(block)
        if (data) {
          data.originalPosition = block.position.clone()
        }
      })
    }
  }

  // Update camera to fit layout metrics
  const updateCamera = (metrics: LayoutMetrics) => {
    // Apply slight padding factor for narrow screens to prevent edge clipping
    const canvasElement = engine.getRenderingCanvas()
    const viewportWidth = canvasElement?.width || 320
    // On narrow screens (< 400px), add 5% padding to prevent edge clipping
    const paddingFactor = lerp(1.05, 1.0, clamp((viewportWidth - 300) / 200, 0, 1))

    camera.orthoLeft = -metrics.worldWidth / 2 * paddingFactor
    camera.orthoRight = metrics.worldWidth / 2 * paddingFactor
    camera.orthoBottom = -metrics.worldHeight / 2 * paddingFactor
    camera.orthoTop = metrics.worldHeight / 2 * paddingFactor
  }

  // Initial camera setup
  const initialMetrics = getLayoutMetrics()
  updateCamera(initialMetrics)

  // Initial 3D bottle layout
  bottle3D.updateLayout(initialMetrics.worldWidth, initialMetrics.worldHeight)

  // Light setup - bright tropical lighting with shadows
  const hemi = new HemisphericLight("hemi", new Vector3(0, 1, 0), scene)
  hemi.intensity = 0.9 // Slightly less ambient
  hemi.diffuse = new Color3(1, 0.98, 0.94) // Warm
  hemi.groundColor = new Color3(0.7, 0.65, 0.6) // Darker ground bounce for contrast

  // Add directional light for better 3D depth and shadows
  const dirLight = new DirectionalLight("dirLight", new Vector3(-0.5, -1, -0.3), scene)
  dirLight.intensity = 0.6
  dirLight.diffuse = new Color3(1, 1, 0.95)

  // Shadow generator for 3D depth
  const shadowGenerator = new ShadowGenerator(2048, dirLight)
  shadowGenerator.useBlurExponentialShadowMap = true
  shadowGenerator.blurKernel = 32
  shadowGenerator.setDarkness(0.3)

  // Word blocks storage for dragging and sentence building (Babylon.js rendering state - stays local)
  let wordBlocks: Mesh[] = []
  let wordBlockData: Map<Mesh, { word: string; originalIndex: number; originalPosition: Vector3; isInSentence: boolean; sentenceRow: number; baseWidth: number; baseHeight: number; textTexture?: DynamicTexture; fruitColor?: string }> = new Map()

  // Track currently enlarged block - only one block can be enlarged at a time
  let currentActiveBlock: Mesh | null = null
  const blockShrinkCallbacks = new Map<Mesh, () => void>()
  const shrinkOtherBlocks = (active: Mesh) => {
    blockShrinkCallbacks.forEach((shrink, mesh) => {
      if (mesh !== active) {
        shrink()
      }
    })
  }

  // Track active drag state to prevent swipe navigation during block drags
  let isDragging = false
  let dragEndTime = 0
  const DRAG_SWIPE_LOCKOUT_MS = 200 // Prevent swipe for 200ms after drag ends

  let sentenceAreaMesh: Mesh | null = null // Store reference to update size
  let sentenceAreaWidth = 60 // Track current sentence area width for collision detection
  let sentenceAreaHeight = 5 // Track current sentence area height for collision detection
  let sentenceRowCount = 1 // Track number of rows in sentence area
  let sentenceRowHeight = 2 // Track height of each row
  let sentenceRowYPositions: number[] = [] // Y positions for each row

  // Fruit slice colors (orange, mango, papaya)
  // Vibrant tropical fruit color palette for word blocks
  const fruitColors = [
    "#FF6B35", // Vibrant Orange
    "#FF4D6D", // Hot Pink/Strawberry
    "#FFCE00", // Bright Golden Yellow
    "#7CB518", // Fresh Kiwi Green
    "#9B5DE5", // Vivid Grape Purple
    "#00BBF9", // Tropical Blue
  ]

  // Create sentence building area with dynamic sizing
  const createSentenceArea = (metrics: LayoutMetrics, blockSize?: { width: number; height?: number; gap: number }, wordCount?: number) => {
    // Dispose old area if exists
    if (sentenceAreaMesh) {
      sentenceAreaMesh.dispose()
    }

    // Calculate width from word count and block size, or use default
    let areaWidth: number
    if (blockSize && wordCount) {
      const totalWidth = wordCount * blockSize.width + (wordCount - 1) * blockSize.gap
      areaWidth = Math.max(metrics.worldWidth * 0.6, totalWidth + metrics.worldWidth * 0.1) // Add 10% padding
    } else {
      areaWidth = metrics.worldWidth * 0.8 // Default width
    }

    sentenceAreaWidth = areaWidth // Store width for collision detection

    // Calculate number of rows needed
    const rowCount = blockSize && wordCount
      ? calculateSentenceRows(wordCount, metrics, blockSize)
      : 1
    sentenceRowCount = rowCount

    // Calculate row height (block height + spacing)
    const blockHeight = blockSize?.height || BASE_MIN_BLOCK_HEIGHT
    const rowHeightValue = blockHeight * (1 + SENTENCE_ROW_SPACING_RATIO)
    sentenceRowHeight = rowHeightValue

    // Calculate total area height based on row count
    const areaHeight = rowCount === 1
      ? metrics.worldHeight * 0.12 // Single row: original size
      : rowCount * rowHeightValue + blockHeight * 0.3 // Multi-row: fit all rows with padding
    sentenceAreaHeight = areaHeight // Store for collision detection

    const areaY = metrics.sentenceAreaY

    // Calculate and store row Y positions
    sentenceRowYPositions = getSentenceRowYPositions(rowCount, areaY, rowHeightValue)

    const area = MeshBuilder.CreatePlane("sentence-area", { width: areaWidth, height: areaHeight }, scene)
    area.position = new Vector3(0, areaY, 2) // Push even further behind blocks

    const areaTexture = new DynamicTexture("sentence-area-texture", { width: 1024, height: 512 }, scene, true)
    areaTexture.hasAlpha = true
    const ctx = areaTexture.getContext() as CanvasRenderingContext2D

    // Rounded rectangle helper for sentence area
    const roundRect = (x: number, y: number, w: number, h: number, r: number) => {
      ctx.beginPath()
      ctx.moveTo(x + r, y)
      ctx.lineTo(x + w - r, y)
      ctx.quadraticCurveTo(x + w, y, x + w, y + r)
      ctx.lineTo(x + w, y + h - r)
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
      ctx.lineTo(x + r, y + h)
      ctx.quadraticCurveTo(x, y + h, x, y + h - r)
      ctx.lineTo(x, y + r)
      ctx.quadraticCurveTo(x, y, x + r, y)
      ctx.closePath()
    }

    // Make sentence area invisible - it's only used for collision detection
    // Word blocks float directly against the juice/bottle background
    ctx.clearRect(0, 0, 1024, 512) // Fully transparent

    // Draw subtle row separator lines for multi-row layouts (optional visual guide)
    if (rowCount > 1) {
      ctx.strokeStyle = "rgba(255, 255, 255, 0.2)" // Very subtle white lines
      ctx.lineWidth = 2
      ctx.setLineDash([10, 10]) // Dashed line

      for (let i = 1; i < rowCount; i++) {
        const y = (512 * i) / rowCount
        ctx.beginPath()
        ctx.moveTo(48, y)
        ctx.lineTo(1024 - 48, y)
        ctx.stroke()
      }

      ctx.setLineDash([]) // Reset dash
    }

    areaTexture.update()

    const areaMaterial = new StandardMaterial("sentence-area-material", scene)
    areaMaterial.alpha = 0 // Completely invisible
    areaMaterial.disableDepthWrite = true
    area.material = areaMaterial

    sentenceAreaMesh = area
    return area
  }

  // Convert language code to readable name
  const getLanguageName = (code: string): string => {
    const languageNames: Record<string, string> = {
      en: "English",
      es: "Spanish",
      fr: "French",
      it: "Italian",
      "pt-BR": "Portuguese (BR)",
      de: "German",
      pl: "Polish",
      ru: "Russian",
      hu: "Hungarian",
      tr: "Turkish",
      ar: "Arabic",
      fa: "Persian",
      hi: "Hindi",
      bn: "Bengali",
      th: "Thai",
      vi: "Vietnamese",
      id: "Indonesian",
      "zh-Hans": "Chinese (Simplified)",
      "zh-Hant": "Chinese (Traditional)",
      "ko-polite": "Korean (Polite)",
      ja: "Japanese",
      ta: "Tamil",
      te: "Telugu",
      kn: "Kannada",
      mr: "Marathi",
      gu: "Gujarati",
      "pa-Guru": "Punjabi (Gurmukhi)",
      "pa-Arab": "Punjabi (Shahmukhi)",
      ur: "Urdu",
    }
    return languageNames[code] || code
  }

  // Get language name in its own language/script (for display to native speakers)
  const getNativeLanguageName = (code: string): string => {
    const nativeNames: Record<string, string> = {
      en: "English",
      es: "español",
      fr: "français",
      it: "italiano",
      "pt-BR": "português",
      de: "Deutsch",
      pl: "polski",
      ru: "русский",
      hu: "magyar",
      tr: "Türkçe",
      ar: "العربية",
      fa: "فارسی",
      hi: "हिन्दी",
      bn: "বাংলা",
      th: "ไทย",
      vi: "Tiếng Việt",
      id: "Bahasa Indonesia",
      "zh-Hans": "中文",
      "zh-Hant": "中文",
      "ko-polite": "한국어",
      ja: "日本語",
      ta: "தமிழ்",
      te: "తెలుగు",
      kn: "ಕನ್ನಡ",
      mr: "मराठी",
      gu: "ગુજરાતી",
      "pa-Guru": "ਪੰਜਾਬੀ",
      "pa-Arab": "پنجابی",
      ur: "اردو",
    }
    return nativeNames[code] || code
  }

  // Create target phrase display with language label (viewport-based)
  const createTargetPhraseDisplay = (text: string, languageCode: string, metrics: LayoutMetrics) => {
    // Remove old display if exists
    const oldDisplay = root.querySelector(".target-phrase-display")
    if (oldDisplay) {
      oldDisplay.remove()
    }

    const languageName = getLanguageName(languageCode)
    const canvasElement = engine.getRenderingCanvas()
    if (!canvasElement) return

    // Get canvas bounding rect for pixel positioning
    const canvasRect = canvasElement.getBoundingClientRect()
    const canvasHeight = canvasElement.height

    // Position in the top space: 40% down from title area to sentence area
    // This percentage approach works consistently across different aspect ratios
    const titleApproxHeight = 60
    const topSpaceStart = canvasRect.top + titleApproxHeight
    const sentenceWorldY = metrics.sentenceAreaY
    const sentencePixelY = canvasRect.top + (canvasHeight / 2) - (sentenceWorldY * metrics.pixelsPerUnit)

    // Position at 25% between title and sentence area (gives more room for multi-line phrases)
    const pixelY = topSpaceStart + (sentencePixelY - topSpaceStart) * 0.25

    // Responsive font sizes based on viewport percentage
    const viewportWidth = canvasElement.width
    const phraseFontSize = Math.max(20, Math.min(36, viewportWidth * 0.055)) // 5.5% of width

    const display = document.createElement("div")
    display.className = "target-phrase-display"
    display.style.top = `${pixelY}px`

    // Create phrase text (no language label - user's native language is assumed)
    const phrase = document.createElement("div")
    phrase.textContent = text

    display.appendChild(phrase)

    // Add tap-to-speak functionality
    display.addEventListener("click", () => {
      const phraseState = useGameStore.getState().phrase
      if (phraseState.targetText && phraseState.targetLang) {
        try {
          speak(phraseState.targetLang, phraseState.targetText)
        } catch (error) {
          console.error("[juice-squeeze] ❌ Target phrase tap TTS error:", error)
        }
      }
    })

    root.appendChild(display)
  }

  // Create "Build in: [Language]" label near word blocks area (viewport-based)
  const createBlockLanguageLabel = (languageCode: string, metrics: LayoutMetrics) => {
    // Remove old label if exists
    const oldLabel = root.querySelector(".block-language-label")
    if (oldLabel) {
      oldLabel.remove()
    }

    const nativeName = getNativeLanguageName(languageCode)
    const canvasElement = engine.getRenderingCanvas()
    if (!canvasElement) return

    // Get canvas bounding rect for pixel positioning
    const canvasRect = canvasElement.getBoundingClientRect()
    const canvasHeight = canvasElement.height

    // Convert world Y coordinate to CSS pixel position
    // World Y is positive up, CSS Y is positive down from top
    const worldY = metrics.blockLabelY
    const pixelY = canvasRect.top + (canvasHeight / 2) - (worldY * metrics.pixelsPerUnit)

    // Responsive font size based on viewport percentage
    const viewportWidth = canvasElement.width
    const labelFontSize = Math.max(16, Math.min(24, viewportWidth * 0.04)) // 4% of width
    const padding = Math.max(6, Math.min(12, viewportWidth * 0.02)) // 2% of width

    const label = document.createElement("div")
    label.className = "block-language-label"
    label.textContent = nativeName
    label.style.top = `${pixelY}px`
    root.appendChild(label)
  }

  // Create fruit particle texture for win animations
  const createFruitParticleTexture = () => {
    return new Texture(
      "data:image/svg+xml;base64," +
      btoa(
        `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32">` +
        `<circle cx="16" cy="16" r="14" fill="white"/>` +
        `</svg>`
      ),
      scene
    )
  }

  // Helper to convert hex color to Color4
  const hexToColor4 = (hex: string, alpha: number = 1): Color4 => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    if (result) {
      return new Color4(
        parseInt(result[1], 16) / 255,
        parseInt(result[2], 16) / 255,
        parseInt(result[3], 16) / 255,
        alpha
      )
    }
    return new Color4(1, 0.6, 0, alpha) // Default orange
  }

  // Create win particle explosion with current fruit color
  const createWinParticles = (position: Vector3, fruitColors: typeof LEVEL_FRUIT_COLORS[CEFRLevel]) => {
    try {
      const particleSystem = new ParticleSystem("winParticles", 300, scene)

      particleSystem.createSphereEmitter(2.0) // Larger emitter for more visible effect
      particleSystem.particleTexture = createFruitParticleTexture()

      // Use current fruit gradient colors
      particleSystem.color1 = hexToColor4(fruitColors.gradient[0], 1) // Lightest
      particleSystem.color2 = hexToColor4(fruitColors.gradient[1], 1) // Primary
      particleSystem.colorDead = hexToColor4(fruitColors.gradient[2], 0) // Darkest, fade out

      // Juicy, glowy particles
      particleSystem.minSize = 0.15
      particleSystem.maxSize = 0.4
      particleSystem.minLifeTime = 1.0
      particleSystem.maxLifeTime = 2.0
      particleSystem.emitRate = 3000
      particleSystem.manualEmitCount = 300 // More particles
      particleSystem.minEmitPower = 2
      particleSystem.maxEmitPower = 5
      particleSystem.blendMode = ParticleSystem.BLENDMODE_ADD // Glowy!
      particleSystem.updateSpeed = 0.01
      particleSystem.gravity = new Vector3(0, -2, 0) // Stronger gravity

      particleSystem.emitter = position.clone()
      particleSystem.start()

      setTimeout(() => {
        particleSystem.stop()
        particleSystem.dispose()
      }, 2000) // Longer duration
    } catch (error) {
      console.error("[juice-squeeze] ❌ Error creating particles:", error)
    }
  }

  // Create ABSOLUTELY WILD juice explosion - juice EVERYWHERE!
  const createCrazyJuiceExplosion = (position: Vector3, fruitColors: typeof LEVEL_FRUIT_COLORS[CEFRLevel]) => {
    try {
      const metrics = getLayoutMetrics()

      // Main explosion - MASSIVE burst from center
      const mainExplosion = new ParticleSystem("mainJuiceExplosion", 2000, scene)
      mainExplosion.createSphereEmitter(3.0)
      mainExplosion.particleTexture = createFruitParticleTexture()

      // Use current fruit gradient colors for vibrant juice
      mainExplosion.color1 = hexToColor4(fruitColors.gradient[0], 1) // Lightest
      mainExplosion.color2 = hexToColor4(fruitColors.gradient[1], 1) // Primary
      mainExplosion.colorDead = hexToColor4(fruitColors.gradient[2], 0) // Darkest, fade

      mainExplosion.minSize = 0.3
      mainExplosion.maxSize = 1.2 // HUGE particles
      mainExplosion.minLifeTime = 1.5
      mainExplosion.maxLifeTime = 3.0
      mainExplosion.emitRate = 8000
      mainExplosion.manualEmitCount = 1500 // TONS of particles
      mainExplosion.minEmitPower = 8
      mainExplosion.maxEmitPower = 20 // Launch them FAR
      mainExplosion.blendMode = ParticleSystem.BLENDMODE_ADD
      mainExplosion.updateSpeed = 0.008
      mainExplosion.gravity = new Vector3(0, -3, 0)

      mainExplosion.emitter = position.clone()
      mainExplosion.start()

      // Create multiple directional blasts - juice flying in all directions
      const directions = [
        new Vector3(1, 1, 0),   // Top right
        new Vector3(-1, 1, 0),  // Top left
        new Vector3(1, -1, 0),  // Bottom right
        new Vector3(-1, -1, 0), // Bottom left
        new Vector3(0, 1, 0),   // Straight up
        new Vector3(1, 0, 0),   // Right
        new Vector3(-1, 0, 0),  // Left
      ]

      directions.forEach((dir, i) => {
        setTimeout(() => {
          if (disposed) return

          const blast = new ParticleSystem(`juiceBlast${i}`, 800, scene)
          blast.particleTexture = createFruitParticleTexture()
          blast.createDirectedSphereEmitter(1.5, dir, new Vector3(0.1, 0.1, 0.1))

          blast.color1 = hexToColor4(fruitColors.gradient[0], 1)
          blast.color2 = hexToColor4(fruitColors.gradient[1], 1)
          blast.colorDead = hexToColor4(fruitColors.gradient[2], 0)

          blast.minSize = 0.4
          blast.maxSize = 1.0
          blast.minLifeTime = 1.0
          blast.maxLifeTime = 2.5
          blast.manualEmitCount = 400
          blast.minEmitPower = 10
          blast.maxEmitPower = 25
          blast.blendMode = ParticleSystem.BLENDMODE_ADD
          blast.gravity = new Vector3(0, -2.5, 0)

          blast.emitter = position.clone()
          blast.start()

          setTimeout(() => {
            blast.stop()
            blast.dispose()
          }, 2500)
        }, i * 80) // Stagger blasts for cascading effect
      })

      // Splatter effects - particles that stick around
      const splatter = new ParticleSystem("juiceSplatter", 1000, scene)
      splatter.createSphereEmitter(5.0)
      splatter.particleTexture = createFruitParticleTexture()

      splatter.color1 = hexToColor4(fruitColors.gradient[0], 0.8)
      splatter.color2 = hexToColor4(fruitColors.gradient[1], 0.8)
      splatter.colorDead = hexToColor4(fruitColors.gradient[2], 0)

      splatter.minSize = 0.2
      splatter.maxSize = 0.8
      splatter.minLifeTime = 3.0
      splatter.maxLifeTime = 5.0 // Long lifetime for "splatter" effect
      splatter.manualEmitCount = 500
      splatter.minEmitPower = 15
      splatter.maxEmitPower = 30
      splatter.blendMode = ParticleSystem.BLENDMODE_STANDARD
      splatter.gravity = new Vector3(0, -4, 0) // Falls fast
      splatter.updateSpeed = 0.01

      splatter.emitter = position.clone()
      splatter.start()

      // Cleanup
      setTimeout(() => {
        mainExplosion.stop()
        mainExplosion.dispose()
        splatter.stop()
        splatter.dispose()
      }, 3000)

    } catch (error) {
      console.error("[juice-squeeze] ❌ Error creating crazy juice explosion:", error)
    }
  }

  // Check if sentence is complete and correct
  const checkWin = () => {
    const state = useGameStore.getState()
    const { hasWon, phrase } = state

    if (hasWon) {
      return // Prevent multiple wins
    }

    // Check if current language is RTL
    const blockLang = phrase.blockLang || "en"
    const isBlockLangRTL = isRTL(blockLang)

    // Get blocks in sentence area, sorted by row first (top to bottom), then X
    // For RTL: right to left (descending X), for LTR: left to right (ascending X)
    const wordsInSentence = Array.from(wordBlockData.entries())
      .filter(([_, data]) => data.isInSentence)
      .sort(([meshA, dataA], [meshB, dataB]) => {
        // First sort by row (ascending = top to bottom in reading order)
        if (dataA.sentenceRow !== dataB.sentenceRow) {
          return dataA.sentenceRow - dataB.sentenceRow
        }
        // Then sort by X within same row
        // RTL: right to left (descending), LTR: left to right (ascending)
        return isBlockLangRTL ? meshB.position.x - meshA.position.x : meshA.position.x - meshB.position.x
      })
      .map(([_, data]) => data.word)

    if (wordsInSentence.length === phrase.correctWords.length) {
      const isCorrect = wordsInSentence.every((word, i) => word === phrase.correctWords[i])

      if (isCorrect && !hasWon) {
        useGameStore.getState().setWon(true)
        useGameStore.getState().incrementCompletedPhrases()
        useGameStore.getState().incrementScore()

        // Record completed phrase with word count for all-time score
        // Pass the current visual color level and gradient so bottles show correct color in collection
        const phraseId = phrase.id || `phrase-${Date.now()}`
        const wordCount = wordsInSentence.length
        const phraseDetails = {
          targetText: phrase.targetText || "",
          blockText: phrase.blockText || "",
          targetLang: phrase.targetLang || "",
          blockLang: phrase.blockLang || "",
        }
        const currentFruit = allFruits[colorIndex]
        useGameStore.getState().recordCompletedPhrase(phraseId, wordCount, getCurrentFruitAsLevel(), phraseDetails, currentFruit.gradient)

        // WIN! Create WILD juice particles everywhere with current fruit color
        // Position at z=-2 to render clearly in front of bottle (which is at z=5)
        const currentMetrics = getLayoutMetrics()
        const centerPos = new Vector3(0, currentMetrics.sentenceAreaY, -2)
        const currentFruitColors = allFruits[colorIndex]
        createWinParticles(centerPos, currentFruitColors)
        createCrazyJuiceExplosion(centerPos, currentFruitColors)

        // Trigger juice glass squeeze animation and update fill
        juiceGlass.triggerSqueeze()
        bottle3D.triggerSqueeze()

        // Get fill level from bottle progress (phrases in current bottle)
        const updatedBottleProgress = useGameStore.getState().bottleProgress
        const newFillLevel = useGameStore.getState().getBottleFillPercent() / 100

        // Check if a bottle was just completed (fill level is 0 after incrementing)
        // This happens when phrasesInCurrentBottle was 9, then incremented to 10, then reset to 0
        const bottleJustCompleted = newFillLevel === 0 && updatedBottleProgress.bottleCollection.length > 0

        if (bottleJustCompleted) {
          // First fill the bottle to 100%
          bottle3D.updateFill(1.0)
          juiceGlass.updateFill(1.0)

          // Trigger completion animation after a short delay
          setTimeout(async () => {
            // Get target position for mini bottle (top-left collection area)
            const metrics = getLayoutMetrics()
            const collectionX = -metrics.worldWidth * 0.35
            const collectionY = metrics.worldHeight * 0.35

            // Trigger overflow for dramatic effect
            bottle3D.triggerOverflow()
            juiceGlass.triggerOverflow()

            // Wait for overflow animation, then trigger completion
            setTimeout(async () => {
              await bottle3D.triggerCompletion(collectionX, collectionY)

              // Reset bottle for next round
              bottle3D.reset()
              juiceGlass.updateFill(0)

              // Cycle to next fruit color for variety (26 tropical fruits) and persist it
              colorIndex = (colorIndex + 1) % allFruits.length
              useGameStore.getState().setColorIndex(colorIndex)
              bottle3D.setColor(allFruits[colorIndex])
              juiceGlass.setColor(allFruits[colorIndex])

              // Update bottle collection display
              renderBottleCollection()

              // Check if level is complete (based on bottles filled, not stale localStorage level)
              // Also show popup at 99 bottles (max cap) to recommend upgrading level
              const currentBp = useGameStore.getState().bottleProgress
              const bottlesNeeded = BOTTLES_PER_LEVEL[currentBp.currentLevel]
              if (currentBp.bottlesCompletedThisLevel >= bottlesNeeded || currentBp.bottlesCompletedThisLevel >= 99) {
                // Show level completion celebration after a short delay
                // Use the current fruit (visual cycling) - decoupled from phrase level
                setTimeout(() => {
                  showLevelComplete(allFruits[colorIndex], currentBp.bottlesCompletedThisLevel)
                }, 500)
              }
            }, 800)
          }, 500)
        } else {
          // Normal fill update
          juiceGlass.updateFill(newFillLevel)
          bottle3D.updateFill(newFillLevel)
        }

        // Update score display with animation
        const updatedStats = useGameStore.getState().stats
        const newScore = updatedStats?.allTimeScore || 0
        const scoreValue = scoreDisplay.querySelector(".score-value") as HTMLElement
        const pointsAdded = wordCount

        // Show floating +points animation
        const floatingPoints = document.createElement("div")
        floatingPoints.className = "floating-points"
        floatingPoints.textContent = `+${pointsAdded}`
        scoreDisplay.appendChild(floatingPoints)
        setTimeout(() => floatingPoints.remove(), 2000)

        // Animate score value
        scoreValue.classList.add("score-pulse")
        setTimeout(() => {
          scoreValue.textContent = String(newScore)
          setTimeout(() => scoreValue.classList.remove("score-pulse"), 500)
        }, 200)

        // Trigger overflow animation when glass is nearly full (>=90%)
        if (newFillLevel >= 0.9) {
          juiceGlass.triggerOverflow()
          bottle3D.triggerOverflow()
        }

        // Play success sound instantly, then TTS after sound completes
        // Build sentence properly: attach punctuation to previous word without spaces
        let completeSentence = ""
        wordsInSentence.forEach((word, i) => {
          if (isOnlyPunctuation(word)) {
            // Attach punctuation directly to previous word
            completeSentence += word
          } else {
            // Add space before non-punctuation words (except first word)
            if (i > 0 && !isOnlyPunctuation(wordsInSentence[i - 1])) {
              completeSentence += " "
            }
            completeSentence += word
          }
        })
        const currentState = useGameStore.getState()
        const blockLang = currentState.phrase.blockLang || "en"

        // Play sparkle sound
        successSound.currentTime = 0
        console.log("[juice-squeeze] Playing success sound, url:", successSoundUrl)
        successSound.play().then(() => {
          console.log("[juice-squeeze] Success sound started playing")
        }).catch((err) => {
          console.error("[juice-squeeze] Sound play failed:", err)
        })

        // Play TTS after a short delay for the sound to be heard
        setTimeout(() => {
          if (disposed) return
          try {
            speak(blockLang, completeSentence)
          } catch (error) {
            console.error("[juice-squeeze] ❌ TTS call error:", error)
          }
        }, 400) // 400ms delay for sparkle sound to be heard first
      }
    }
  }

  // Sentence area will be created when word blocks are loaded

  // Create 3D Corpán avatar (from hover-runner)
  const createCorpanAvatar = async () => {
    try {
      // Load the same GLB model hover-runner uses
      // Path from games/juice-squeeze/src to games/hover-runner/src/assets/models
      const corpanLogoUrl = "../../hover-runner/src/assets/models/corpan_logo.glb"
      const avatarContainer = new TransformNode("corpan-avatar-container", scene)
      avatarContainer.position = new Vector3(-10, 5, 0)

      // Gentle floating animation
      let floatTime = 0
      const floatAnimation = () => {
        if (disposed) return
        floatTime += 0.01
        avatarContainer.position.y = 5 + Math.sin(floatTime) * 0.3
        requestAnimationFrame(floatAnimation)
      }
      floatAnimation()

      SceneLoader.LoadAssetContainerAsync("", corpanLogoUrl, scene)
        .then((logoAsset) => {
          if (disposed) return
          logoAsset.addAllToScene()
          const logoRoot = logoAsset.transformNodes.find(
            (node) => node.name === "corpan_logo_root"
          )
          if (logoRoot) {
            logoRoot.parent = avatarContainer
          } else {
            logoAsset.meshes.forEach((mesh) => {
              if (!mesh.parent) {
                mesh.parent = avatarContainer
              }
            })
          }

          // Scale avatar to appropriate size for 2D orthographic view
          avatarContainer.scaling = new Vector3(2, 2, 2)

          console.log("[juice-squeeze] ✅ Corpán avatar loaded at (-10, 5, 0)")
        })
        .catch((error) => {
          console.warn("[juice-squeeze] Could not load Corpán avatar:", error)
        })

      return avatarContainer
    } catch (error) {
      console.warn("[juice-squeeze] Could not create Corpán avatar:", error)
      return null
    }
  }

  createCorpanAvatar()

  // Create title "Juice Squeeze" (responsive)
  const titleElement = document.createElement("div")
  titleElement.textContent = "🍊 JUICE SQUEEZE 🍊"
  titleElement.className = "game-title"
  root.appendChild(titleElement)

  // Create exit button (top-right X)
  const exitButton = document.createElement("button")
  exitButton.textContent = "✕"
  exitButton.className = "exit-btn"
  exitButton.addEventListener("click", () => {
    window.dispatchEvent(new CustomEvent("corpan:exit"))
  })
  root.appendChild(exitButton)

  // Create ear button for audio-only (bottom-right, above eye)
  const earButton = document.createElement("button")
  const earImg = document.createElement("img")
  earImg.src = corpanLogoUrl
  earImg.alt = "Listen"
  earImg.style.width = "100%"
  earImg.style.height = "100%"
  earImg.style.objectFit = "contain"
  earImg.style.borderRadius = "50%"
  earButton.appendChild(earImg)
  earButton.className = "ear-btn icon-btn"
  earButton.title = "Listen to answer"
  earButton.addEventListener("click", () => {
    const { phrase } = useGameStore.getState()
    if (!phrase.correctWords.length) return
    if (phrase.blockLang) {
      speak(phrase.blockLang, smartJoinWords(phrase.correctWords))
    }
  })
  root.appendChild(earButton)

  // Create show answer button (bottom-right) - eye icon
  const giveUpButton = document.createElement("button")
  giveUpButton.innerHTML = "👁"
  giveUpButton.className = "give-up-btn icon-btn"
  giveUpButton.title = "Show answer"
  giveUpButton.addEventListener("click", () => {
    const { phrase } = useGameStore.getState()
    if (!phrase.correctWords.length) return

    // Create overlay
    const overlay = document.createElement("div")
    overlay.className = "answer-overlay"

    // Create answer card
    const card = document.createElement("div")
    card.className = "answer-card"

    const title = document.createElement("div")
    title.className = "answer-icon"
    title.innerHTML = "✓"

    const answerText = document.createElement("div")
    answerText.className = "answer-text"
    answerText.textContent = smartJoinWords(phrase.correctWords)

    const continueBtn = document.createElement("button")
    continueBtn.innerHTML = "→"
    continueBtn.className = "continue-icon-btn"
    continueBtn.title = "Next"
    continueBtn.addEventListener("click", () => {
      overlay.remove()
      // Load next phrase
      createWordBlocks()
    })

    card.appendChild(title)
    card.appendChild(answerText)
    card.appendChild(continueBtn)
    overlay.appendChild(card)

    // Close on overlay click (outside card)
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        overlay.remove()
      }
    })

    root.appendChild(overlay)

    // Play TTS for the answer
    if (phrase.blockLang) {
      speak(phrase.blockLang, smartJoinWords(phrase.correctWords))
    }
  })
  root.appendChild(giveUpButton)

  // Create fruit flip button (bottom-left)
  const fruitButton = document.createElement("button")
  fruitButton.innerHTML = "🍊"
  fruitButton.className = "fruit-btn icon-btn"
  fruitButton.title = "Flip to fruits"
  root.appendChild(fruitButton)

  // Fruit flip state - initialize from persisted store
  const fruitEmojis = ["🍊", "🥭", "🍍", "🍋", "🍇", "🍎", "🍓", "🍑"]
  const initialFruitState = useGameStore.getState().settings.fruitsEnabled
  fruitButton.classList.toggle("active", initialFruitState)

  // Helper to update all blocks based on fruit state
  const updateAllBlockTexts = () => {
    const fruitsEnabled = useGameStore.getState().settings.fruitsEnabled
    wordBlocks.forEach((block, index) => {
      const data = wordBlockData.get(block)
      if (!data?.textTexture || !data?.fruitColor) return

      const displayText = fruitsEnabled
        ? fruitEmojis[index % fruitEmojis.length]
        : data.word

      updateBlockText(data.textTexture, displayText, data.fruitColor)
    })
  }

  fruitButton.addEventListener("click", () => {
    useGameStore.getState().toggleFruits()
    const fruitsEnabled = useGameStore.getState().settings.fruitsEnabled
    fruitButton.classList.toggle("active", fruitsEnabled)
    updateAllBlockTexts()
  })

  // Create juice glass animation (centered)
  const juiceGlass: JuiceGlass = createJuiceGlass(root)

  // Create score display on juice glass (like a label)
  const scoreDisplay = document.createElement("div")
  scoreDisplay.className = "juice-score-display"
  const initialStats = useGameStore.getState().stats
  const initialScore = initialStats?.allTimeScore || 0
  scoreDisplay.innerHTML = `
    <div class="score-value">${initialScore}</div>
  `
  root.appendChild(scoreDisplay)

  // Create bottle collection display (below score)
  const bottleCollection = document.createElement("div")
  bottleCollection.className = "bottle-collection"
  root.appendChild(bottleCollection)

  // Render bottle collection from state
  const renderBottleCollection = () => {
    const bp = useGameStore.getState().bottleProgress
    const bottles = bp?.bottleCollection || []

    // Only show last 6 bottles to save space
    const visibleBottles = bottles.slice(-6)
    const hiddenCount = bottles.length - visibleBottles.length

    bottleCollection.innerHTML = visibleBottles.map((bottle) => {
      // Use stored gradient if available, fallback to level colors for older bottles
      const gradient = bottle.gradient || LEVEL_FRUIT_COLORS[bottle.level].gradient
      return `
        <div class="mini-bottle" title="${bottle.level}">
          <div class="mini-bottle-liquid" style="background: linear-gradient(to bottom, ${gradient[0]}, ${gradient[1]}, ${gradient[2]})"></div>
          <div class="mini-bottle-glass"></div>
        </div>
      `
    }).join("") + (hiddenCount > 0 ? `<div class="bottles-overflow">+${hiddenCount}</div>` : "")
  }

  // Initial render
  renderBottleCollection()

  // Create level completion overlay (hidden by default)
  const levelCompleteOverlay = document.createElement("div")
  levelCompleteOverlay.className = "level-complete-overlay"
  levelCompleteOverlay.style.display = "none"
  root.appendChild(levelCompleteOverlay)

  // CEFR level order for progression
  const LEVEL_ORDER: CEFRLevel[] = ["A0", "A1", "A2", "B1", "B2", "C1"]

  // Get next level to suggest (stack-aware)
  // Returns the first level NOT in user's stack that's higher than their current levels
  const getNextLevelSuggestion = (): CEFRLevel | null => {
    const stackLevels = hostApi.getStackConfig().levels
    if (stackLevels.length === 0) {
      return null // No levels configured, no suggestion
    }
    // Find highest level in user's stack
    let highestIndex = -1
    for (const level of stackLevels) {
      const idx = LEVEL_ORDER.indexOf(level as CEFRLevel)
      if (idx > highestIndex) highestIndex = idx
    }
    // Suggest the next level after their highest
    if (highestIndex >= 0 && highestIndex < LEVEL_ORDER.length - 1) {
      return LEVEL_ORDER[highestIndex + 1]
    }
    return null // Already at max or no valid suggestion
  }

  // Show level completion celebration
  // Uses the current fruit (from visual cycling) and stack-aware level suggestion
  const showLevelComplete = (fruitDef: FruitDef, bottlesCompleted: number) => {
    const nextLevel = getNextLevelSuggestion()
    const uiLang = hostApi.getStackConfig().languages[0] || "en"

    levelCompleteOverlay.innerHTML = `
      <div class="level-complete-content">
        <div class="level-complete-confetti"></div>
        <div class="level-complete-title">🎉 ${t("levelComplete", uiLang)} 🎉</div>
        <div class="level-complete-fruit">${fruitDef.fruit}</div>
        <div class="level-complete-stats">
          <div class="bottles-count">${t("bottlesFilled", uiLang, { n: bottlesCompleted })}</div>
        </div>
        ${nextLevel ? `
          <div class="level-complete-next">
            <div class="next-level-hint">
              ${t("harderPhrasesHint", uiLang, { level: nextLevel })}
            </div>
          </div>
        ` : `
          <div class="level-complete-max">
            <div class="max-level-text">🏆 ${t("masteredAllLevels", uiLang)} 🏆</div>
          </div>
        `}
        <div class="level-complete-buttons">
          <button class="level-btn review-btn">📜 ${t("reviewPhrases", uiLang)}</button>
          <button class="level-btn stay-btn">${t("continuePlaying", uiLang)}</button>
        </div>
      </div>
    `

    // Add button event listeners
    const stayBtn = levelCompleteOverlay.querySelector(".stay-btn")
    const reviewBtn = levelCompleteOverlay.querySelector(".review-btn")

    reviewBtn?.addEventListener("click", () => {
      showPhraseReview()
    })

    stayBtn?.addEventListener("click", () => {
      levelCompleteOverlay.style.display = "none"
    })

    levelCompleteOverlay.style.display = "flex"
  }

  // Show phrase review modal
  const showPhraseReview = () => {
    const bp = useGameStore.getState().bottleProgress
    // Get most recent completed bottle's phrases
    const lastBottle = bp.bottleCollection[bp.bottleCollection.length - 1]
    const phrases = lastBottle?.phrases || []
    const uiLang = hostApi.getStackConfig().languages[0] || "en"

    // Language code to flag mapping
    const langFlags: Record<string, string> = {
      es: "🇪🇸", ko: "🇰🇷", ja: "🇯🇵", zh: "🇨🇳", fr: "🇫🇷",
      de: "🇩🇪", it: "🇮🇹", pt: "🇵🇹", ru: "🇷🇺", ar: "🇸🇦",
      en: "🇺🇸", vi: "🇻🇳", th: "🇹🇭", id: "🇮🇩", fa: "🇮🇷",
      hi: "🇮🇳", bn: "🇧🇩", ta: "🇮🇳", te: "🇮🇳", kn: "🇮🇳",
      mr: "🇮🇳", gu: "🇮🇳", ur: "🇵🇰", pa: "🇮🇳", hu: "🇭🇺",
      pl: "🇵🇱", tr: "🇹🇷",
    }

    const getFlag = (lang: string) => langFlags[lang.split("-")[0]] || "🌐"

    const phraseListHtml = phrases.length > 0
      ? phrases.map(p => `
          <div class="review-phrase-item">
            <div class="review-phrase-target">${getFlag(p.targetLang)} ${p.targetText}</div>
            <div class="review-phrase-block">${getFlag(p.blockLang)} ${p.blockText}</div>
          </div>
        `).join("")
      : `<div class="review-empty">${t("noPhrases", uiLang)}</div>`

    // Create overlay
    const reviewOverlay = document.createElement("div")
    reviewOverlay.className = "phrase-review-overlay"
    reviewOverlay.innerHTML = `
      <div class="phrase-review-content">
        <div class="phrase-review-header">
          <h2>📜 ${t("phrasesCompleted", uiLang)}</h2>
          <button class="review-close-btn">✕</button>
        </div>
        <div class="phrase-review-list">
          ${phraseListHtml}
        </div>
      </div>
    `

    root.appendChild(reviewOverlay)

    // Close button handler
    const closeBtn = reviewOverlay.querySelector(".review-close-btn")
    closeBtn?.addEventListener("click", () => reviewOverlay.remove())

    // Click outside to close
    reviewOverlay.addEventListener("click", (e) => {
      if (e.target === reviewOverlay) reviewOverlay.remove()
    })
  }

  // Initialize fill level from bottle progress (phrases in current bottle)
  const initialFillLevel = useGameStore.getState().getBottleFillPercent() / 100
  juiceGlass.updateFill(initialFillLevel)
  bottle3D.updateFill(initialFillLevel)
  // Use persisted color index for consistency across sessions (cycles through 26 fruits)
  bottle3D.setColor(allFruits[colorIndex])
  juiceGlass.setColor(allFruits[colorIndex])

  // Utterance history for back/forward navigation
  const utteranceHistory: Utterance[] = []
  let historyIndex = -1

  // Create utterance navigation container (near Build label)
  const utteranceNav = document.createElement("div")
  utteranceNav.className = "utterance-nav"
  root.appendChild(utteranceNav)

  // Back arrow button (previous utterance)
  const prevButton = document.createElement("button")
  prevButton.innerHTML = "←"
  prevButton.className = "nav-arrow prev-arrow"
  prevButton.disabled = true
  prevButton.addEventListener("click", () => {
    if (historyIndex > 0) {
      historyIndex--
      loadUtteranceFromHistory(utteranceHistory[historyIndex])
    }
  })
  utteranceNav.appendChild(prevButton)

  // Forward arrow button (next utterance)
  const nextButton = document.createElement("button")
  nextButton.innerHTML = "→"
  nextButton.className = "nav-arrow next-arrow"
  nextButton.disabled = true
  nextButton.addEventListener("click", () => {
    if (historyIndex < utteranceHistory.length - 1) {
      historyIndex++
      loadUtteranceFromHistory(utteranceHistory[historyIndex])
    } else {
      // Load new utterance
      createWordBlocks()
    }
  })
  utteranceNav.appendChild(nextButton)

  // Update navigation button states
  const updateNavButtons = () => {
    prevButton.disabled = historyIndex <= 0
    nextButton.disabled = false // Always allow going forward (loads new if at end)
  }

  // Swipe navigation for mobile
  let touchStartX = 0
  let touchStartY = 0
  const SWIPE_THRESHOLD = 50 // Minimum swipe distance in pixels
  const SWIPE_VERTICAL_LIMIT = 100 // Max vertical movement to count as horizontal swipe

  root.addEventListener("touchstart", (e) => {
    touchStartX = e.touches[0].clientX
    touchStartY = e.touches[0].clientY
  }, { passive: true })

  root.addEventListener("touchend", (e) => {
    // Skip swipe detection if we were dragging or just finished dragging
    if (isDragging) return
    if (Date.now() - dragEndTime < DRAG_SWIPE_LOCKOUT_MS) return

    const touchEndX = e.changedTouches[0].clientX
    const touchEndY = e.changedTouches[0].clientY
    const deltaX = touchEndX - touchStartX
    const deltaY = touchEndY - touchStartY

    // Only register as swipe if horizontal movement is significant
    // and vertical movement is limited (not a scroll or drag)
    if (Math.abs(deltaX) > SWIPE_THRESHOLD && Math.abs(deltaY) < SWIPE_VERTICAL_LIMIT) {
      if (deltaX < 0) {
        // Swipe left → next utterance
        if (historyIndex < utteranceHistory.length - 1) {
          historyIndex++
          loadUtteranceFromHistory(utteranceHistory[historyIndex])
        } else {
          createWordBlocks()
        }
      } else {
        // Swipe right → previous utterance
        if (historyIndex > 0) {
          historyIndex--
          loadUtteranceFromHistory(utteranceHistory[historyIndex])
        }
      }
    }
  }, { passive: true })

  // Load utterance from history (reuses existing utterance)
  const loadUtteranceFromHistory = async (utterance: Utterance) => {
    clearWordBlocks()
    useGameStore.getState().setWon(false)
    useGameStore.getState().resetBlocks()

    const stackConfig = hostApi.getStackConfig()
    const [targetLang, blockLang] = pickLanguagePair(stackConfig.languages)

    currentUtterance = utterance

    const words = utterance.words
    useGameStore.getState().loadNewPhrase({
      id: utterance.id,
      targetText: utterance.targetText || null,
      blockText: utterance.text,
      targetLang,
      blockLang,
      correctWords: [...words],
      words: [...words],
    })

    const metrics = getLayoutMetrics()
    const blockSize = calculateBlockSize(words, metrics)

    if (utterance.targetText) {
      createTargetPhraseDisplay(utterance.targetText, targetLang, metrics)
    }
    createBlockLanguageLabel(blockLang, metrics)
    createSentenceArea(metrics, blockSize, words.length)
    updateCamera(metrics)

    await buildWordBlockMeshes(utterance, words, blockLang, targetLang, metrics, blockSize)
    updateNavButtons()

    // Play target phrase TTS
    if (utterance.targetText) {
      const ttsTargetLang = useGameStore.getState().phrase.targetLang || targetLang
      scheduleTTS(ttsTargetLang, utterance.targetText, 500)
    }
  }

  // Clear old word blocks
  const clearWordBlocks = () => {
    wordBlocks.forEach((block) => {
      // Detach drag behavior to unsubscribe observables
      const dragBehavior = block.getBehaviorByName("PointerDrag")
      if (dragBehavior) {
        block.removeBehavior(dragBehavior)
      }
      block.dispose()
    })
    wordBlocks = []
    wordBlockData = new Map()
    blockShrinkCallbacks.clear()
    currentActiveBlock = null

    // Fruit state persists across phrases - no reset needed

    // Clear language labels
    const oldTargetDisplay = root.querySelector(".target-phrase-display")
    if (oldTargetDisplay) {
      oldTargetDisplay.remove()
    }
    const oldBlockLabel = root.querySelector(".block-language-label")
    if (oldBlockLabel) {
      oldBlockLabel.remove()
    }
  }

  // Pick language pair from stack config for translation practice
  // For 3+ languages, rotates through block languages each phrase
  const pickLanguagePair = (languages: string[]): [string, string] => {
    if (languages.length === 0) {
      return ["en", "en"] // Fallback
    }
    if (languages.length === 1) {
      return [languages[0], languages[0]] // Same language if only one
    }

    // languages[0] = target language (what user is learning) - top in settings
    // languages[1] = primary language (user's native) - bottom in settings
    // Return: [targetLang (phrase at top), blockLang (words to build)]
    if (languages.length === 2) {
      return [languages[0], languages[1]]
    }

    // 3+ languages: display stays same, rotate through other languages for blocks
    // This lets users practice building sentences in all their target languages
    const displayLang = languages[0]
    const blockLangs = languages.slice(1) // All non-display languages
    const blockLang = blockLangs[targetLangRotationIndex % blockLangs.length]
    targetLangRotationIndex++

    return [displayLang, blockLang]
  }

  // Check if language is RTL (right-to-left)
  const isRTL = (langCode: string): boolean => {
    const rtlLanguages = ['ar', 'fa', 'ur', 'he', 'pa-Arab']
    return rtlLanguages.includes(langCode)
  }

  // Check if text is only punctuation (don't speak these in TTS)
  // Uses Unicode property escapes to catch ALL punctuation from any language
  const isOnlyPunctuation = (text: string): boolean => {
    return /^[\p{P}\s]+$/u.test(text)
  }

  // Create word blocks from loaded utterance
  const createWordBlocks = async () => {
    // Clear existing blocks
    clearWordBlocks()
    useGameStore.getState().setWon(false)
    useGameStore.getState().resetBlocks()

    const stackConfig = hostApi.getStackConfig()

    // Pick two random languages for this round
    const [targetLang, blockLang] = pickLanguagePair(stackConfig.languages)

    const utterance = await loadUtterance(hostApi, 2, blockLang, targetLang)

    if (!utterance) {
      console.warn("[juice-squeeze] No utterance loaded!")
      return
    }

    // Add to history
    // If we're not at the end, truncate forward history
    if (historyIndex < utteranceHistory.length - 1) {
      utteranceHistory.splice(historyIndex + 1)
    }
    utteranceHistory.push(utterance)
    historyIndex = utteranceHistory.length - 1
    updateNavButtons()

    // Store current utterance for camera calculation
    currentUtterance = utterance

    // Store phrase data in store
    const words = utterance.words
    useGameStore.getState().loadNewPhrase({
      id: utterance.id,
      targetText: utterance.targetText || null,
      blockText: utterance.text,
      targetLang,
      blockLang,
      correctWords: [...words], // Store correct order for win condition checking
      words: [...words],
    })

    const wordCount = words.length

    if (wordCount === 0) {
      console.warn("[juice-squeeze] No words in utterance!")
      return
    }

    // Get current layout metrics
    const metrics = getLayoutMetrics()

    // Calculate dynamic block size based on words
    const blockSize = calculateBlockSize(words, metrics)

    // Show target phrase (target language) below title with language label
    if (utterance.targetText) {
      createTargetPhraseDisplay(utterance.targetText, targetLang, metrics)
    } else {
      console.warn("[juice-squeeze] No target text available!")
      return
    }

    // Show "Build in: [Language]" label near word blocks area
    createBlockLanguageLabel(blockLang, metrics)

    // Create sentence area with dynamic sizing
    createSentenceArea(metrics, blockSize, wordCount)

    // Update camera to fit layout
    updateCamera(metrics)

    // Build the word block meshes
    await buildWordBlockMeshes(utterance, words, blockLang, targetLang, metrics, blockSize)

    // Play target phrase TTS at round start
    if (utterance.targetText) {
      const ttsTargetLang = useGameStore.getState().phrase.targetLang || targetLang
      scheduleTTS(ttsTargetLang, utterance.targetText, 500)
    }
  }

  // Build word block meshes (extracted for reuse in history navigation)
  const buildWordBlockMeshes = async (
    utterance: Utterance,
    words: string[],
    blockLang: string,
    targetLang: string,
    metrics: LayoutMetrics,
    blockSize: { baseWidth: number; width: number; height: number; gap: number; fontSize: number; twoRowLayout?: boolean }
  ) => {
    const wordCount = words.length

    // Create shuffled copy of words array for gameplay challenge!
    const shuffledWords = [...words].sort(() => Math.random() - 0.5)

    // Calculate per-word widths based on word length
    // calculateBlockSize already computed baseWidth to fill available space
    const wordWidths = shuffledWords.map((word) => blockSize.baseWidth * getIdealWidthMultiplier(word))

    // Calculate block positions - variable width based on word length
    const blockPositions: { x: number; y: number; z: number; width: number }[] = []
    const totalWidth = wordWidths.reduce((sum, w) => sum + w, 0) + (wordCount - 1) * blockSize.gap

    let currentX = -totalWidth / 2

    shuffledWords.forEach((_, index) => {
      const thisWidth = wordWidths[index]
      const x = currentX + thisWidth / 2
      blockPositions.push({ x, y: metrics.wordBlocksY, z: 0, width: thisWidth })
      currentX += thisWidth + blockSize.gap
    })

    // Create texture for each word with fruit slice colors (using shuffled order)
    shuffledWords.forEach((word, shuffledIndex) => {
      // Find original index for correct ordering
      const originalIndex = words.indexOf(word)

      // Get position from calculated layout
      const pos = blockPositions[shuffledIndex]
      if (!pos) {
        console.error(`[juice-squeeze] No position for block ${shuffledIndex}`)
        return
      }

      // Texture resolution scaled with word width to maintain aspect ratio
      // This prevents text from looking stretched on wider blocks
      // Cap at 2048 to avoid WebGL max texture size issues
      const widthMultiplier = getIdealWidthMultiplier(word)
      const textureWidth = Math.min(2048, Math.floor(1024 * widthMultiplier))
      const textureHeight = 512
      const texture = new DynamicTexture(
        `word-texture-${utterance.id}-${shuffledIndex}`,
        { width: textureWidth, height: textureHeight },
        scene,
        true
      )
      texture.hasAlpha = false // Blocks are fully opaque to prevent whiteout
      const ctx = texture.getContext() as CanvasRenderingContext2D

      // Use fruit slice color (cycle through colors)
      const fruitColor = fruitColors[shuffledIndex % fruitColors.length]

      // Rounded rectangle helper for word blocks
      const roundRect = (x: number, y: number, w: number, h: number, r: number) => {
        ctx.beginPath()
        ctx.moveTo(x + r, y)
        ctx.lineTo(x + w - r, y)
        ctx.quadraticCurveTo(x + w, y, x + w, y + r)
        ctx.lineTo(x + w, y + h - r)
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
        ctx.lineTo(x + r, y + h)
        ctx.quadraticCurveTo(x, y + h, x, y + h - r)
        ctx.lineTo(x, y + r)
        ctx.quadraticCurveTo(x, y, x + r, y)
        ctx.closePath()
      }

      // Clear texture
      ctx.clearRect(0, 0, textureWidth, textureHeight)

      const padding = 16
      const radius = 48

      // Draw rounded block with gradient for depth
      roundRect(padding, padding, textureWidth - padding * 2, textureHeight - padding * 2, radius)

      // Premium gradient - brighter top, richer bottom for shine
      const lighterColor = shadeColor(fruitColor, 15) // Lighter highlight
      const gradient = ctx.createLinearGradient(0, 0, 0, textureHeight)
      gradient.addColorStop(0, lighterColor)
      gradient.addColorStop(0.4, fruitColor)
      gradient.addColorStop(1, shadeColor(fruitColor, -25)) // Rich darker bottom

      ctx.fillStyle = gradient
      ctx.fill()

      // Glossy highlight at top - bright and extended for premium candy look
      const highlightGradient = ctx.createLinearGradient(0, padding, 0, textureHeight * 0.5)
      highlightGradient.addColorStop(0, "rgba(255, 255, 255, 0.95)")   // Bright top
      highlightGradient.addColorStop(0.2, "rgba(255, 255, 255, 0.6)")  // Extended glow
      highlightGradient.addColorStop(0.5, "rgba(255, 255, 255, 0.15)") // Subtle middle
      highlightGradient.addColorStop(1, "rgba(255, 255, 255, 0)")
      roundRect(padding, padding, textureWidth - padding * 2, textureHeight - padding * 2, radius)
      ctx.fillStyle = highlightGradient
      ctx.fill()

      // Clean solid border with subtle shadow for premium look
      ctx.shadowColor = shadeColor(fruitColor, -20)
      ctx.shadowBlur = 8
      ctx.shadowOffsetX = 0
      ctx.shadowOffsetY = 3
      roundRect(padding, padding, textureWidth - padding * 2, textureHeight - padding * 2, radius)
      ctx.strokeStyle = shadeColor(fruitColor, -40) // Dark solid border
      ctx.lineWidth = 8
      ctx.stroke()
      ctx.shadowBlur = 0
      ctx.shadowOffsetY = 0

      // Calculate font size to fill texture width
      // Long words use 90% of width, shorter words use 80%
      const textFillRatio = word.length >= 12 ? 0.9 : 0.8
      let fontSize = 300 // Start big
      ctx.font = `bold ${fontSize}px Arial`
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"

      let textWidth = ctx.measureText(word).width

      // Shrink until text fits the target width ratio
      while (textWidth > textureWidth * textFillRatio && fontSize > 48) {
        fontSize -= 10
        ctx.font = `bold ${fontSize}px Arial`
        textWidth = ctx.measureText(word).width
      }

      // For short words, make them HUGE (fill vertically too)
      if (word.length <= 3) {
        const maxVerticalSize = textureHeight * 0.7
        fontSize = Math.min(fontSize, maxVerticalSize)
        ctx.font = `bold ${fontSize}px Arial`
      }

      // Text shadow for depth - more dramatic
      ctx.shadowColor = "rgba(0, 0, 0, 0.4)"
      ctx.shadowBlur = 24
      ctx.shadowOffsetX = 0
      ctx.shadowOffsetY = 10

      // Dark but not pure black text
      ctx.fillStyle = "#2a2a2a"
      ctx.fillText(word, textureWidth / 2, textureHeight / 2)

      // Reset shadow
      ctx.shadowColor = "transparent"
      ctx.shadowBlur = 0
      ctx.shadowOffsetX = 0
      ctx.shadowOffsetY = 0

      texture.update()

      // Create plane mesh for word block with per-word width
      const thisBlockWidth = pos.width
      const block = MeshBuilder.CreatePlane(
        `word-block-${utterance.id}-${shuffledIndex}`,
        {
          width: thisBlockWidth,
          height: blockSize.height
        },
        scene
      )

      // Position block from calculated layout
      const originalPosition = new Vector3(pos.x, pos.y, pos.z)
      block.position = originalPosition.clone()


      // Apply texture material with enhanced 3D depth
      const material = new StandardMaterial(`word-material-${utterance.id}-${shuffledIndex}`, scene)
      material.diffuseTexture = texture
      material.useAlphaFromDiffuseTexture = false // No transparency - blocks are fully opaque
      material.emissiveTexture = texture
      // Premium candy-like material - bright and vivid
      material.emissiveColor = new Color3(0.95, 0.95, 0.95) // Brighter for more pop
      material.specularColor = new Color3(0.8, 0.8, 0.8) // Strong shine for glossy look
      material.specularPower = 48 // Sharper, focused highlight
      material.ambientColor = new Color3(0.5, 0.5, 0.5)
      // Ensure blocks render in front and don't get occluded by sentence area
      material.disableDepthWrite = false
      material.zOffset = -5 // Render blocks in front
      block.material = material

      // Enable shadows for 3D depth
      block.receiveShadows = true
      shadowGenerator.addShadowCaster(block)

      // Store block data with base dimensions for resize scaling
      wordBlockData.set(block, {
        word,
        originalIndex: originalIndex, // Use originalIndex for win checking
        originalPosition,
        isInSentence: false,
        sentenceRow: -1, // -1 means not in sentence area
        baseWidth: thisBlockWidth,    // Store per-word width for scaling
        baseHeight: blockSize.height, // Store creation-time height for scaling
        textTexture: texture,         // Store for fruit flip feature
        fruitColor,                   // Store color for texture redraw
      })

      // Add dragging behavior
      const dragBehavior = new PointerDragBehavior({
        dragPlaneNormal: new Vector3(0, 0, 1), // Drag in XY plane
      })
      dragBehavior.attach(block)

      // Track drag state for tap detection
      let dragStartTime = 0
      let dragMoved = false
      let dragStartPos: Vector3 | null = null
      let shrinkAnimationId: number | null = null // Track shrink animation to cancel on new drag
      let growAnimationId: number | null = null // Track grow animation to cancel on other taps

      // Set default rendering group for proper z-ordering
      block.renderingGroupId = 1

      // Track if block was already enlarged when drag started (for tap-to-toggle)
      let wasAlreadyEnlarged = false

      dragBehavior.onDragStartObservable.add(() => {
        isDragging = true // Track drag state for swipe prevention
        const data = wordBlockData.get(block)
        if (!data) return

        // Check if this block is already the active (enlarged) one
        wasAlreadyEnlarged = currentActiveBlock === block

        shrinkOtherBlocks(block)
        currentActiveBlock = block

        // Cancel any running shrink animation to prevent jerkiness
        if (shrinkAnimationId !== null) {
          cancelAnimationFrame(shrinkAnimationId)
          shrinkAnimationId = null
        }
        if (growAnimationId !== null) {
          cancelAnimationFrame(growAnimationId)
          growAnimationId = null
        }

        dragStartTime = Date.now()
        dragMoved = false
        dragStartPos = block.position.clone()

        // Play TTS on touch - allows audio to overlap for rapid taps
        // Skip TTS for punctuation-only blocks
        const lang = useGameStore.getState().phrase.blockLang || "en"
        if (!isOnlyPunctuation(data.word)) {
          speak(lang, data.word)
        }

        // Bring block to front layer so it renders on top of other blocks
        block.renderingGroupId = 2
        block.position.z = data.originalPosition.z - 1.0

        // Only grow if not already enlarged
        if (!wasAlreadyEnlarged) {
          // Animate smooth growth: uniform 1.7x for all blocks
          const growthFactor = 1.7
          const animateGrow = () => {
            const currentScale = block.scaling.x
            const diff = growthFactor - currentScale
            if (Math.abs(diff) > 0.05) {
              const newScale = currentScale + diff * 0.15
              block.scaling = new Vector3(newScale, newScale, 1)
              growAnimationId = requestAnimationFrame(animateGrow)
            } else {
              block.scaling = new Vector3(growthFactor, growthFactor, 1)
              growAnimationId = null
            }
          }
          animateGrow()
        }
      })

      // Track if block actually moved during drag (X/Y only, ignore Z lift)
      dragBehavior.onDragObservable.add(() => {
        if (dragStartPos) {
          const dx = block.position.x - dragStartPos.x
          const dy = block.position.y - dragStartPos.y
          const movedDistance = Math.sqrt(dx * dx + dy * dy)
          if (movedDistance > 0.3) {
            dragMoved = true
          }
        }
      })

      // Shrink function for this block - can be called externally when another block is touched
      const triggerShrink = () => {
        // Restore normal rendering layer
        block.renderingGroupId = 1
        if (currentActiveBlock === block) {
          currentActiveBlock = null
        }

        if (growAnimationId !== null) {
          cancelAnimationFrame(growAnimationId)
          growAnimationId = null
        }

        // Animate smooth shrink back to normal size
        const animateShrink = () => {
          const currentScale = block.scaling.x
          if (currentScale > 1.05) {
            const newScale = currentScale * 0.85
            block.scaling = new Vector3(newScale, newScale, 1)
            shrinkAnimationId = requestAnimationFrame(animateShrink)
          } else {
            block.scaling = new Vector3(1, 1, 1)
            shrinkAnimationId = null
          }
        }
        animateShrink()
      }
      blockShrinkCallbacks.set(block, triggerShrink)

      dragBehavior.onDragEndObservable.add(() => {
        isDragging = false // Clear drag state
        dragEndTime = Date.now() // Record end time for swipe lockout

        // Restore rendering layer
        block.renderingGroupId = 1

        const data = wordBlockData.get(block)
        if (!data) return

        // Check if dropped in sentence area (using tracked dimensions)
        const currentMetrics = getLayoutMetrics()
        const sentenceAreaCenterY = currentMetrics.sentenceAreaY
        const isInSentenceArea =
          block.position.y >= sentenceAreaCenterY - sentenceAreaHeight / 2 &&
          block.position.y <= sentenceAreaCenterY + sentenceAreaHeight / 2 &&
          Math.abs(block.position.x) <= sentenceAreaWidth / 2

        const placeBlockAtSentenceEnd = (metrics: LayoutMetrics) => {
          const currentBlockLang = useGameStore.getState().phrase.blockLang || "en"
          const isBlockLangRTL = isRTL(currentBlockLang)

          const blocksInSentence = Array.from(wordBlockData.entries())
            .filter(([mesh, entry]) => entry.isInSentence && mesh !== block)
            .map(([mesh, entry]) => ({ mesh, entry }))

          let targetRow = 0
          let targetX = 0

          // Get this block's width for proper spacing
          const thisBlockWidth = data.baseWidth || 2.0
          const blockGap = thisBlockWidth * 0.15 // 15% gap

          if (blocksInSentence.length > 0) {
            // Calculate max blocks per row
            const currentWords = currentUtterance?.words || []
            const currentBlockSize = calculateBlockSize(currentWords, metrics)
            const avgSpacing = currentBlockSize.baseWidth * 1.15

            const canvasElement = engine.getRenderingCanvas()
            const viewportWidth = canvasElement?.width || 720
            const maxBlocksPerRow = getSentenceBlocksPerRow(viewportWidth)
            const availableWidth = metrics.worldWidth * 0.85
            const blocksPerRowByWidth = Math.floor(availableWidth / avgSpacing)
            const effectiveBlocksPerRow = Math.max(2, Math.min(maxBlocksPerRow, blocksPerRowByWidth))

            // Sort by row, then by reading order (RTL: right-to-left, LTR: left-to-right)
            blocksInSentence.sort((a, b) => {
              if (a.entry.sentenceRow !== b.entry.sentenceRow) {
                return a.entry.sentenceRow - b.entry.sentenceRow
              }
              return isBlockLangRTL ? b.mesh.position.x - a.mesh.position.x : a.mesh.position.x - b.mesh.position.x
            })
            const last = blocksInSentence[blocksInSentence.length - 1]
            const lastWidth = last.entry.baseWidth || currentBlockSize.baseWidth
            targetRow = last.entry.sentenceRow

            // Count how many blocks are in the current row
            const blocksInCurrentRow = blocksInSentence.filter(b => b.entry.sentenceRow === targetRow).length

            // Check if current row is full
            if (blocksInCurrentRow >= effectiveBlocksPerRow) {
              // Move to next row
              targetRow++
              // Start at beginning of new row (right for RTL, left for LTR)
              if (isBlockLangRTL) {
                targetX = thisBlockWidth / 2
              } else {
                targetX = -thisBlockWidth / 2
              }
            } else {
              // Add to current row, accounting for variable widths
              // Gap is half of last block's width + gap + half of this block's width
              const spacing = lastWidth / 2 + blockGap + thisBlockWidth / 2
              targetX = isBlockLangRTL
                ? last.mesh.position.x - spacing
                : last.mesh.position.x + spacing
            }
          }

          data.isInSentence = true
          data.sentenceRow = targetRow
          block.position.x = targetX
          block.position.y = sentenceRowYPositions[targetRow] || metrics.sentenceAreaY
          block.position.z = -0.5
        }

        const wasTap = !dragMoved

        const removeFromSentence = () => {
          data.isInSentence = false
          data.sentenceRow = -1
          const targetPos = data.originalPosition.clone()

          // Animate snap back to word bank
          const snapBack = () => {
            const currentPos = block.position
            const diff = targetPos.subtract(currentPos)
            if (diff.length() > 0.1) {
              block.position = currentPos.add(diff.scale(0.2))
              requestAnimationFrame(snapBack)
            } else {
              block.position = targetPos
              block.position.z = data.originalPosition.z // Reset Z position to original
            }
          }
          snapBack()

          reflowSentenceBlocks(currentMetrics)
        }

        if (wasTap && data.isInSentence) {
          removeFromSentence()
          triggerShrink()
          return
        }

        if (wasTap && !isInSentenceArea && !data.isInSentence) {
          placeBlockAtSentenceEnd(currentMetrics)
          triggerShrink()
          reflowSentenceBlocks(currentMetrics)
          checkWin()
          return
        }

        // Shrink block if:
        // 1. Dropped in sentence area (always shrink when placed)
        // 2. Tap-to-toggle: was already enlarged and didn't drag (just tapped)
        const shouldShrink = isInSentenceArea || (wasAlreadyEnlarged && wasTap)

        if (shouldShrink) {
          triggerShrink()
        }

        if (isInSentenceArea) {
          // Mark as in sentence area (but still draggable!)
          data.isInSentence = true

          // Determine which row to place the block in
          const targetRow = getTargetRow(block.position.y, sentenceRowYPositions)
          data.sentenceRow = targetRow

          // Get current language direction
          const currentBlockLang = useGameStore.getState().phrase.blockLang || "en"
          const isBlockLangRTL = isRTL(currentBlockLang)

          // Find blocks in the same row to determine insertion position
          const blocksInSameRow = Array.from(wordBlockData.entries())
            .filter(([mesh, d]) => d.isInSentence && mesh !== block && d.sentenceRow === targetRow)
            .map(([mesh, d]) => ({ mesh, data: d }))

          // Adjust X position based on drop position and reading direction
          // This ensures the block sorts into the correct position before reflow
          const dropX = block.position.x

          if (blocksInSameRow.length > 0) {
            // Sort blocks by reading order
            blocksInSameRow.sort((a, b) =>
              isBlockLangRTL ? b.mesh.position.x - a.mesh.position.x : a.mesh.position.x - b.mesh.position.x
            )

            // Find insertion position based on drop X
            let insertIndex = blocksInSameRow.length // Default: insert at end

            for (let i = 0; i < blocksInSameRow.length; i++) {
              const existingX = blocksInSameRow[i].mesh.position.x

              if (isBlockLangRTL) {
                // RTL: insert before blocks that are to the left (lower X)
                if (dropX > existingX) {
                  insertIndex = i
                  break
                }
              } else {
                // LTR: insert before blocks that are to the right (higher X)
                if (dropX < existingX) {
                  insertIndex = i
                  break
                }
              }
            }

            // Set X position to sort correctly: place between neighbors
            if (insertIndex === 0) {
              // Insert at beginning
              const firstBlock = blocksInSameRow[0]
              block.position.x = isBlockLangRTL
                ? firstBlock.mesh.position.x + 1.0  // Further right
                : firstBlock.mesh.position.x - 1.0  // Further left
            } else if (insertIndex === blocksInSameRow.length) {
              // Insert at end
              const lastBlock = blocksInSameRow[blocksInSameRow.length - 1]
              block.position.x = isBlockLangRTL
                ? lastBlock.mesh.position.x - 1.0  // Further left
                : lastBlock.mesh.position.x + 1.0  // Further right
            } else {
              // Insert between two blocks
              const prevBlock = blocksInSameRow[insertIndex - 1]
              const nextBlock = blocksInSameRow[insertIndex]
              block.position.x = (prevBlock.mesh.position.x + nextBlock.mesh.position.x) / 2
            }
          }

          // Snap Z forward
          block.position.z = -0.5

          // Reflow all blocks in sentence area with multi-row support
          reflowSentenceBlocks(currentMetrics)

          // Check win condition (but don't lock blocks)
          checkWin()
        } else {
          // Dragged out of sentence area - return to original position
          removeFromSentence()
        }
      })

      wordBlocks.push(block)
    })

    // Position all blocks using the positioning function
    positionWordBlocks(wordBlocks, metrics, blockSize)

    // Apply initial fruit flip state from store
    updateAllBlockTexts()
  }

  // Load and create word blocks
  createWordBlocks().catch((err) => {
    console.error("[juice-squeeze] Failed to load utterances:", err)
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

    // Get new layout metrics
    const metrics = getLayoutMetrics()

    // Update camera
    updateCamera(metrics)

    // Update 3D bottle layout
    bottle3D.updateLayout(metrics.worldWidth, metrics.worldHeight)

    // If we have blocks, reposition them (no mesh scaling to avoid mismatch)
    if (currentUtterance && wordBlocks.length > 0) {
      const words = currentUtterance.words
      const blockSize = calculateBlockSize(words, metrics)

      // Don't scale meshes - they keep their creation-time dimensions
      // This prevents the overlap/squash bug from scaling mismatches
      // Just reposition based on stored widths

      // Update sentence area first (this recalculates row positions)
      createSentenceArea(metrics, blockSize, words.length)

      // Reposition word bank blocks (blocks not in sentence)
      positionWordBlocks(wordBlocks, metrics, blockSize)

      // Reflow blocks that are in the sentence area
      reflowSentenceBlocks(metrics)

      // Update UI overlays
      const phraseState = useGameStore.getState().phrase
      if (phraseState.targetText && phraseState.targetLang) {
        createTargetPhraseDisplay(phraseState.targetText, phraseState.targetLang, metrics)
      }
      if (phraseState.blockLang) {
        createBlockLanguageLabel(phraseState.blockLang, metrics)
      }
    }
  }

  // Initial camera setup already done above

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

  engine.runRenderLoop(() => {
    if (!disposed) {
      scene.render()
    }
  })

  const dispose = () => {
    if (disposed) {
      return
    }
    disposed = true

    // Clear pending TTS timeout to prevent phantom phrases
    if (ttsTimeoutId !== null) {
      window.clearTimeout(ttsTimeoutId)
      ttsTimeoutId = null
    }

    // Clear word blocks
    clearWordBlocks()

    // Remove UI elements
    exitButton.remove()
    earButton.remove()
    giveUpButton.remove()
    fruitButton.remove()
    utteranceNav.remove()
    titleElement.remove()
    scoreDisplay.remove()
    bottleCollection.remove()
    levelCompleteOverlay.remove()
    juiceGlass.dispose()
    bottle3D.dispose()

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
    engine.stopRenderLoop()
    scene.dispose()
    engine.dispose()
    root.remove()
  }

  return { dispose }
}
