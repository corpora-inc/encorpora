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
import { useGameStore } from "./store/gameState"
import { createJuiceGlass, type JuiceGlass } from "./juiceAnimation"
import successSoundUrl from "./sounds/success.mp3"

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
  const textureWidth = 1024
  const textureHeight = 512
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

  // Juicy gradient
  const gradient = ctx.createLinearGradient(0, 0, 0, textureHeight)
  gradient.addColorStop(0, fruitColor)
  gradient.addColorStop(0.5, fruitColor)
  gradient.addColorStop(1, shadeColor(fruitColor, -20))

  ctx.fillStyle = gradient
  ctx.fill()

  // Glossy highlight at top
  const highlightGradient = ctx.createLinearGradient(0, padding, 0, textureHeight * 0.3)
  highlightGradient.addColorStop(0, "rgba(255, 255, 255, 0.75)")
  highlightGradient.addColorStop(1, "rgba(255, 255, 255, 0)")
  roundRect(padding, padding, textureWidth - padding * 2, textureHeight - padding * 2, radius)
  ctx.fillStyle = highlightGradient
  ctx.fill()

  // Soft inner shadow at bottom
  roundRect(padding, padding, textureWidth - padding * 2, textureHeight - padding * 2, radius)
  ctx.strokeStyle = "rgba(0, 0, 0, 0.15)"
  ctx.lineWidth = 4
  ctx.stroke()

  // Draw juicy drip effects
  const drawDrip = (x: number, height: number, width: number) => {
    const dripGradient = ctx.createLinearGradient(x, textureHeight - padding, x, textureHeight - padding + height)
    dripGradient.addColorStop(0, shadeColor(fruitColor, -10))
    dripGradient.addColorStop(0.5, fruitColor)
    dripGradient.addColorStop(1, "rgba(255, 255, 255, 0)")

    ctx.beginPath()
    ctx.moveTo(x - width / 2, textureHeight - padding)
    ctx.quadraticCurveTo(x - width / 2, textureHeight - padding + height * 0.7, x, textureHeight - padding + height)
    ctx.quadraticCurveTo(x + width / 2, textureHeight - padding + height * 0.7, x + width / 2, textureHeight - padding)
    ctx.closePath()
    ctx.fillStyle = dripGradient
    ctx.fill()
  }

  const dripPositions = [0.25, 0.55, 0.8]
  dripPositions.forEach((pos, i) => {
    const dripX = padding + (textureWidth - padding * 2) * pos
    const dripHeight = 30 + (i % 2) * 20
    const dripWidth = 16 + (i % 2) * 8
    drawDrip(dripX, dripHeight, dripWidth)
  })

  // Calculate font size to fill 80% of texture width
  let fontSize = 300
  ctx.font = `bold ${fontSize}px Arial`
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"

  let textWidth = ctx.measureText(newText).width

  while (textWidth > textureWidth * 0.8 && fontSize > 48) {
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
  // Tropical sunset background (warm orange/pink)
  scene.clearColor = new Color4(0, 1, 1, 1) // Cyan background

  // Camera setup - ORTHOGRAPHIC for 2D view
  const camera = new UniversalCamera("camera", new Vector3(0, 0, -15), scene)
  camera.mode = Camera.ORTHOGRAPHIC_CAMERA
  camera.setTarget(Vector3.Zero())
  camera.inputs.clear()
  
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
        speakFast(lang, text)
      }
      ttsTimeoutId = null
    }, delayMs)
  }

  // Fast TTS - speak immediately (caller decides when to stop any active speech)
  const speakFast = (lang: string, text: string) => {
    if (typeof hostApi.speak === "function") {
      hostApi.speak(lang, text)
    }
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

  // Multi-row sentence area constants
  const MAX_SENTENCE_ROWS = 4 // Increased to fit longer phrases
  const SENTENCE_BLOCKS_PER_ROW_MOBILE = 3 // ≤480px viewport width
  const SENTENCE_BLOCKS_PER_ROW_TABLET = 4 // 481-720px
  const SENTENCE_BLOCKS_PER_ROW_DESKTOP = 6 // >720px
  const SENTENCE_ROW_SPACING_RATIO = 0.4 // Gap between rows as ratio of block height

  // Calculate dynamic block size based on word count and viewport
  const calculateBlockSize = (wordCount: number, metrics: LayoutMetrics) => {
    // Scale minimum block dimensions with viewport
    // At 320px (worldWidth=20): minBlockWidth = 2.5
    // At 640px (worldWidth=40): minBlockWidth = 5.0 (larger blocks for larger screens)
    // At 160px (worldWidth=10): minBlockWidth = 1.25 (smaller blocks for smaller screens)
    const viewportScale = metrics.worldWidth / 20 // 1.0 at baseline 320px
    const minBlockWidth = BASE_MIN_BLOCK_WIDTH * viewportScale
    const minBlockHeight = BASE_MIN_BLOCK_HEIGHT * viewportScale

    // Blocks must fit horizontally with gaps
    const availableWidth = metrics.worldWidth * 0.9 // 90% of screen width
    const gapRatio = 0.15 // 15% of block width as gap

    // Check if we need 2-row layout - use scaled minimum for comparison
    const singleRowWidth = availableWidth / (wordCount + (wordCount - 1) * gapRatio)
    const needsTwoRows = wordCount > MAX_BLOCKS_PER_ROW || singleRowWidth < minBlockWidth

    // Calculate effective word count for sizing (half for 2-row)
    const effectiveWordCount = needsTwoRows ? Math.ceil(wordCount / 2) : wordCount

    // Calculate max block width that fits all words
    const totalGaps = (effectiveWordCount - 1) * gapRatio
    let maxBlockWidth = availableWidth / (effectiveWordCount + totalGaps)

    // Enforce scaled minimum dimensions
    maxBlockWidth = Math.max(minBlockWidth, maxBlockWidth)
    const blockHeight = Math.max(minBlockHeight, maxBlockWidth * 0.5)

    // Font size = 40% of block height in pixels
    // pixelsPerUnit is constant (16) since world scales with viewport
    const rawFontSize = Math.floor(blockHeight * metrics.pixelsPerUnit * 0.4)
    // Clamp font size: min 16px for legibility, max 200px
    const fontSize = Math.max(16, Math.min(rawFontSize, 200))

    return {
      width: maxBlockWidth,
      height: blockHeight,
      gap: maxBlockWidth * gapRatio,
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
  const reflowSentenceBlocks = (metrics: LayoutMetrics) => {
    // Get all blocks in sentence area with their data
    const blocksInSentence = Array.from(wordBlockData.entries())
      .filter(([_, data]) => data.isInSentence)
      .map(([mesh, data]) => ({ mesh, data }))

    if (blocksInSentence.length === 0) return

    // Calculate current block size
    const currentWordCount = currentUtterance?.words?.length || blocksInSentence.length
    const currentBlockSize = calculateBlockSize(currentWordCount, metrics)
    const sentenceSpacing = currentBlockSize.width * 1.15

    // Get max blocks per row
    const canvasElement = engine.getRenderingCanvas()
    const viewportWidth = canvasElement?.width || 720
    const maxBlocksPerRow = getSentenceBlocksPerRow(viewportWidth)

    // Also check available width
    const availableWidth = metrics.worldWidth * 0.85
    const blocksPerRowByWidth = Math.floor(availableWidth / sentenceSpacing)
    const effectiveBlocksPerRow = Math.max(2, Math.min(maxBlocksPerRow, blocksPerRowByWidth))

    // Sort blocks by row first, then by X position within row (left to right)
    blocksInSentence.sort((a, b) => {
      if (a.data.sentenceRow !== b.data.sentenceRow) {
        return a.data.sentenceRow - b.data.sentenceRow
      }
      return a.mesh.position.x - b.mesh.position.x
    })

    // Redistribute blocks into rows sequentially
    blocksInSentence.forEach((item, globalIndex) => {
      const row = Math.floor(globalIndex / effectiveBlocksPerRow)
      const indexInRow = globalIndex % effectiveBlocksPerRow

      // Count how many blocks are in this row
      const rowStartIndex = row * effectiveBlocksPerRow
      const rowEndIndex = Math.min((row + 1) * effectiveBlocksPerRow, blocksInSentence.length)
      const blocksInThisRow = rowEndIndex - rowStartIndex

      // Calculate row width and starting X
      const rowWidth = blocksInThisRow * sentenceSpacing - (sentenceSpacing - currentBlockSize.width)
      const rowStartX = -rowWidth / 2 + currentBlockSize.width / 2

      // Position block
      item.mesh.position.x = rowStartX + indexInRow * sentenceSpacing
      item.mesh.position.y = sentenceRowYPositions[row] || metrics.sentenceAreaY
      item.mesh.position.z = -0.5 // Keep in front

      // Update data
      item.data.sentenceRow = row
    })
  }

  // Position word blocks in the word bank (NOT in sentence area)
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

    if (blockSize.twoRowLayout && wordCount > 1) {
      // Two-row layout for many words or narrow screens
      const topRowCount = Math.ceil(wordCount / 2)
      const bottomRowCount = wordCount - topRowCount
      const rowGap = blockSize.height * 0.5 // Vertical gap between rows

      // Position top row (first half of words)
      const topRowWidth = topRowCount * blockSize.width + (topRowCount - 1) * blockSize.gap
      const topStartX = -topRowWidth / 2 + blockSize.width / 2
      const topY = metrics.wordBlocksY + rowGap / 2 + blockSize.height / 2

      for (let i = 0; i < topRowCount; i++) {
        blocksInWordBank[i].position.x = topStartX + i * (blockSize.width + blockSize.gap)
        blocksInWordBank[i].position.y = topY
        blocksInWordBank[i].position.z = 0
        const data = wordBlockData.get(blocksInWordBank[i])
        if (data) {
          data.originalPosition = blocksInWordBank[i].position.clone()
        }
      }

      // Position bottom row (remaining words)
      const bottomRowWidth = bottomRowCount * blockSize.width + (bottomRowCount - 1) * blockSize.gap
      const bottomStartX = -bottomRowWidth / 2 + blockSize.width / 2
      const bottomY = metrics.wordBlocksY - rowGap / 2 - blockSize.height / 2

      for (let i = topRowCount; i < wordCount; i++) {
        const j = i - topRowCount
        blocksInWordBank[i].position.x = bottomStartX + j * (blockSize.width + blockSize.gap)
        blocksInWordBank[i].position.y = bottomY
        blocksInWordBank[i].position.z = 0
        const data = wordBlockData.get(blocksInWordBank[i])
        if (data) {
          data.originalPosition = blocksInWordBank[i].position.clone()
        }
      }
    } else {
      // Single row layout (original behavior)
      const totalWidth = wordCount * blockSize.width + (wordCount - 1) * blockSize.gap
      const startX = -totalWidth / 2 + blockSize.width / 2

      blocksInWordBank.forEach((block, i) => {
        block.position.x = startX + i * (blockSize.width + blockSize.gap)
        block.position.y = metrics.wordBlocksY
        block.position.z = 0

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
  const fruitColors = ["#FFB84D", "#FF6B6B", "#FFE66D"] // Orange, Pink, Yellow

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
    
    // Frosted glass background - subtle teal tint that contrasts with blocks
    const areaGradient = ctx.createLinearGradient(0, 0, 0, 512)
    areaGradient.addColorStop(0, "rgba(230, 245, 245, 0.9)") // Subtle teal tint
    areaGradient.addColorStop(1, "rgba(220, 235, 235, 0.85)")
    
    // Rounded rectangle
    roundRect(16, 16, 1024 - 32, 512 - 32, 32)
    ctx.fillStyle = areaGradient
    ctx.fill()
    
    // Subtle colored border (teal or matching accent)
    ctx.strokeStyle = "rgba(11, 107, 111, 0.4)"
    ctx.lineWidth = 3
    ctx.stroke()
    
    // Inner highlight
    roundRect(20, 20, 1024 - 40, 512 - 40, 28)
    ctx.strokeStyle = "rgba(255, 255, 255, 0.8)"
    ctx.lineWidth = 2
    ctx.stroke()

    // Draw subtle row separator lines for multi-row layouts
    if (rowCount > 1) {
      ctx.strokeStyle = "rgba(11, 107, 111, 0.2)" // Subtle teal lines
      ctx.lineWidth = 2
      ctx.setLineDash([10, 10]) // Dashed line

      for (let i = 1; i < rowCount; i++) {
        const y = 16 + ((512 - 32) * i) / rowCount
        ctx.beginPath()
        ctx.moveTo(48, y)
        ctx.lineTo(1024 - 48, y)
        ctx.stroke()
      }

      ctx.setLineDash([]) // Reset dash
    }

    areaTexture.update()
    
    const areaMaterial = new StandardMaterial("sentence-area-material", scene)
    areaMaterial.diffuseTexture = areaTexture
    areaMaterial.useAlphaFromDiffuseTexture = true
    areaMaterial.emissiveColor = new Color3(1, 1, 1)
    areaMaterial.opacityTexture = areaTexture
    areaMaterial.disableDepthWrite = true // Render behind everything
    areaMaterial.zOffset = 10 // Push back in render order
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
    
    // Position in the top space above the sentence area
    // Calculate two positions and blend them for optimal placement

    // Position 1: Based on world coordinates (original approach - higher)
    const worldY = metrics.targetPhraseY
    const worldBasedY = canvasRect.top + (canvasHeight / 2) - (worldY * metrics.pixelsPerUnit)

    // Position 2: Midpoint between title and sentence area (lower)
    const titleApproxHeight = 60
    const topSpaceStart = canvasRect.top + titleApproxHeight
    const sentenceWorldY = metrics.sentenceAreaY
    const sentencePixelY = canvasRect.top + (canvasHeight / 2) - (sentenceWorldY * metrics.pixelsPerUnit)
    const midpointBasedY = (topSpaceStart + sentencePixelY) / 2

    // Blend with 70% weight on world-based (higher) and 30% on midpoint (lower)
    const pixelY = worldBasedY * 0.7 + midpointBasedY * 0.3
    
    // Responsive font sizes based on viewport percentage
    const viewportWidth = canvasElement.width
    const labelFontSize = Math.max(14, Math.min(22, viewportWidth * 0.04)) // 4% of width
    const phraseFontSize = Math.max(20, Math.min(36, viewportWidth * 0.055)) // 5.5% of width
    
    const display = document.createElement("div")
    display.className = "target-phrase-display"
    display.style.top = `${pixelY}px`
    
    // Create language label
    const label = document.createElement("div")
    label.textContent = `${languageName}:`
    
    // Create phrase text
    const phrase = document.createElement("div")
    phrase.textContent = text
    
    display.appendChild(label)
    display.appendChild(phrase)

    // Add tap-to-speak functionality
    display.addEventListener("click", () => {
      const phraseState = useGameStore.getState().phrase
      if (phraseState.targetText && phraseState.targetLang) {
        try {
          speakFast(phraseState.targetLang, phraseState.targetText)
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

  // Create win particle explosion
  const createWinParticles = (position: Vector3) => {
    try {
      const particleSystem = new ParticleSystem("winParticles", 300, scene)
      
      particleSystem.createSphereEmitter(2.0) // Larger emitter for more visible effect
      particleSystem.particleTexture = createFruitParticleTexture()
      
      // Bright fruit colors (orange, pink, yellow)
      particleSystem.color1 = new Color4(1, 0.72, 0.3, 1) // Orange
      particleSystem.color2 = new Color4(1, 0.42, 0.42, 1) // Pink
      particleSystem.colorDead = new Color4(1, 0.9, 0.43, 0) // Yellow fade
      
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

        // WIN! Create particles
        const currentMetrics = getLayoutMetrics()
        const centerPos = new Vector3(0, currentMetrics.sentenceAreaY, 0)
        createWinParticles(centerPos)

        // Trigger juice glass squeeze animation and update fill
        juiceGlass.triggerSqueeze()
        const updatedStats = useGameStore.getState().stats
        const newFillLevel = Math.min(1, updatedStats.completedPhrases / 10)
        juiceGlass.updateFill(newFillLevel)

        // Trigger overflow animation when glass is nearly full (>=90%)
        if (newFillLevel >= 0.9) {
          juiceGlass.triggerOverflow()
        }

        // Play success sound instantly, then TTS after sound completes
        const completeSentence = wordsInSentence.join(" ")
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
            speakFast(blockLang, completeSentence)
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
  earButton.innerHTML = "👂"
  earButton.className = "ear-btn icon-btn"
  earButton.title = "Listen to answer"
  earButton.addEventListener("click", () => {
    const { phrase } = useGameStore.getState()
    if (!phrase.correctWords.length) return
    if (phrase.blockLang) {
      speakFast(phrase.blockLang, phrase.correctWords.join(" "))
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
    answerText.textContent = phrase.correctWords.join(" ")

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
      speakFast(phrase.blockLang, phrase.correctWords.join(" "))
    }
  })
  root.appendChild(giveUpButton)

  // Create fruit flip button (bottom-left)
  const fruitButton = document.createElement("button")
  fruitButton.innerHTML = "🍊"
  fruitButton.className = "fruit-btn icon-btn"
  fruitButton.title = "Flip to fruits"
  root.appendChild(fruitButton)

  // Fruit flip state
  const fruitEmojis = ["🍊", "🥭", "🍍", "🍋", "🍇", "🍎", "🍓", "🍑"]
  let blocksAreFlipped = false

  fruitButton.addEventListener("click", () => {
    blocksAreFlipped = !blocksAreFlipped
    fruitButton.classList.toggle("active", blocksAreFlipped)

    wordBlocks.forEach((block, index) => {
      const data = wordBlockData.get(block)
      if (!data?.textTexture || !data?.fruitColor) return

      const displayText = blocksAreFlipped
        ? fruitEmojis[index % fruitEmojis.length]
        : data.word

      updateBlockText(data.textTexture, displayText, data.fruitColor)
    })
  })

  // Create juice glass animation (centered)
  const juiceGlass: JuiceGlass = createJuiceGlass(root)
  // Initialize fill level from store
  const initialStats = useGameStore.getState().stats
  const initialFillLevel = Math.min(1, initialStats.completedPhrases / 10)
  juiceGlass.updateFill(initialFillLevel)

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
    const blockSize = calculateBlockSize(words.length, metrics)

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

    // Reset fruit flip state
    blocksAreFlipped = false
    fruitButton.classList.remove("active")

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

    // Calculate dynamic block size based on word count
    const blockSize = calculateBlockSize(wordCount, metrics)

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
    blockSize: { width: number; height: number; gap: number; fontSize: number; twoRowLayout?: boolean }
  ) => {
    const wordCount = words.length

    // Create shuffled copy of words array for gameplay challenge!
    const shuffledWords = [...words].sort(() => Math.random() - 0.5)

    // Calculate block positions - uniform width for all blocks
    const blockPositions: { x: number; y: number; z: number }[] = []
    const totalWidth = wordCount * blockSize.width + (wordCount - 1) * blockSize.gap
    const startX = -totalWidth / 2 + blockSize.width / 2

    shuffledWords.forEach((_, index) => {
      const x = startX + index * (blockSize.width + blockSize.gap)
      blockPositions.push({ x, y: metrics.wordBlocksY, z: 0 })
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
      
      // High-quality texture resolution (1024x512 as specified)
      const textureWidth = 1024
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
      
      // Juicy gradient - lighter at top, darker at bottom
      const gradient = ctx.createLinearGradient(0, 0, 0, textureHeight)
      gradient.addColorStop(0, fruitColor)
      gradient.addColorStop(0.5, fruitColor)
      gradient.addColorStop(1, shadeColor(fruitColor, -20)) // Darker at bottom
      
      ctx.fillStyle = gradient
      ctx.fill()
      
      // Glossy highlight at top - brighter for juicy candy look
      const highlightGradient = ctx.createLinearGradient(0, padding, 0, textureHeight * 0.3)
      highlightGradient.addColorStop(0, "rgba(255, 255, 255, 0.75)")
      highlightGradient.addColorStop(1, "rgba(255, 255, 255, 0)")
      roundRect(padding, padding, textureWidth - padding * 2, textureHeight - padding * 2, radius)
      ctx.fillStyle = highlightGradient
      ctx.fill()
      
      // Soft inner shadow at bottom
      roundRect(padding, padding, textureWidth - padding * 2, textureHeight - padding * 2, radius)
      ctx.strokeStyle = "rgba(0, 0, 0, 0.15)"
      ctx.lineWidth = 4
      ctx.stroke()

      // Draw juicy drip effects at bottom of block
      const drawDrip = (x: number, height: number, width: number) => {
        const dripGradient = ctx.createLinearGradient(x, textureHeight - padding, x, textureHeight - padding + height)
        dripGradient.addColorStop(0, shadeColor(fruitColor, -10))
        dripGradient.addColorStop(0.5, fruitColor)
        dripGradient.addColorStop(1, "rgba(255, 255, 255, 0)")

        ctx.beginPath()
        ctx.moveTo(x - width / 2, textureHeight - padding)
        ctx.quadraticCurveTo(x - width / 2, textureHeight - padding + height * 0.7, x, textureHeight - padding + height)
        ctx.quadraticCurveTo(x + width / 2, textureHeight - padding + height * 0.7, x + width / 2, textureHeight - padding)
        ctx.closePath()
        ctx.fillStyle = dripGradient
        ctx.fill()
      }

      // Add 2-3 drips at varied positions with varied sizes
      const dripPositions = [0.25, 0.55, 0.8]
      dripPositions.forEach((pos, i) => {
        const dripX = padding + (textureWidth - padding * 2) * pos
        const dripHeight = 30 + (i % 2) * 20 // Vary height: 30, 50, 30
        const dripWidth = 16 + (i % 2) * 8 // Vary width: 16, 24, 16
        drawDrip(dripX, dripHeight, dripWidth)
      })

      // Calculate font size to fill 80% of texture width
      // Start with large font size and shrink until text fits
      let fontSize = 300 // Start big
      ctx.font = `bold ${fontSize}px Arial`
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      
      let textWidth = ctx.measureText(word).width
      
      // Shrink until text fits 80% of texture width
      while (textWidth > textureWidth * 0.8 && fontSize > 48) {
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

      // Create plane mesh for word block with uniform size
      const block = MeshBuilder.CreatePlane(
        `word-block-${utterance.id}-${shuffledIndex}`,
        {
          width: blockSize.width,
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
      // Juicy candy-like material
      material.emissiveColor = new Color3(0.85, 0.85, 0.85)
      material.specularColor = new Color3(0.6, 0.6, 0.6) // More shine for glossy look
      material.specularPower = 32 // Broader, softer highlight
      material.ambientColor = new Color3(0.4, 0.4, 0.4)
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
        baseWidth: blockSize.width,   // Store uniform width for scaling
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

        // Play TTS immediately on touch - stopSpeech clears queue for instant response
        const lang = useGameStore.getState().phrase.blockLang || "en"
        speakFast(lang, data.word)

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

          if (blocksInSentence.length > 0) {
            // Calculate max blocks per row
            const currentWordCount = currentUtterance?.words?.length || blocksInSentence.length + 1
            const currentBlockSize = calculateBlockSize(currentWordCount, metrics)
            const sentenceSpacing = currentBlockSize.width * 1.15

            const canvasElement = engine.getRenderingCanvas()
            const viewportWidth = canvasElement?.width || 720
            const maxBlocksPerRow = getSentenceBlocksPerRow(viewportWidth)
            const availableWidth = metrics.worldWidth * 0.85
            const blocksPerRowByWidth = Math.floor(availableWidth / sentenceSpacing)
            const effectiveBlocksPerRow = Math.max(2, Math.min(maxBlocksPerRow, blocksPerRowByWidth))

            // Sort by row, then by reading order (RTL: right-to-left, LTR: left-to-right)
            blocksInSentence.sort((a, b) => {
              if (a.entry.sentenceRow !== b.entry.sentenceRow) {
                return a.entry.sentenceRow - b.entry.sentenceRow
              }
              return isBlockLangRTL ? b.mesh.position.x - a.mesh.position.x : a.mesh.position.x - b.mesh.position.x
            })
            const last = blocksInSentence[blocksInSentence.length - 1]
            targetRow = last.entry.sentenceRow

            // Count how many blocks are in the current row
            const blocksInCurrentRow = blocksInSentence.filter(b => b.entry.sentenceRow === targetRow).length

            // Check if current row is full
            if (blocksInCurrentRow >= effectiveBlocksPerRow) {
              // Move to next row
              targetRow++
              // Start at beginning of new row (right for RTL, left for LTR)
              const rowWidth = sentenceSpacing
              if (isBlockLangRTL) {
                targetX = rowWidth / 2 - currentBlockSize.width / 2
              } else {
                targetX = -rowWidth / 2 + currentBlockSize.width / 2
              }
            } else {
              // Add to current row
              // For RTL, add to the left (subtract spacing); for LTR, add to the right (add spacing)
              targetX = isBlockLangRTL
                ? last.mesh.position.x - sentenceSpacing
                : last.mesh.position.x + sentenceSpacing
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
    
    // If we have blocks, recalculate and reposition everything
    if (currentUtterance && wordBlocks.length > 0) {
      const wordCount = currentUtterance.words.length
      const blockSize = calculateBlockSize(wordCount, metrics)

      // Scale block meshes to new calculated size
      wordBlocks.forEach((block) => {
        const data = wordBlockData.get(block)
        if (data && data.baseWidth && data.baseHeight) {
          block.scaling.x = blockSize.width / data.baseWidth
          block.scaling.y = blockSize.height / data.baseHeight
          // Keep Z scaling at 1
        }
      })

      // Update sentence area first (this recalculates row positions)
      createSentenceArea(metrics, blockSize, wordCount)

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
    juiceGlass.dispose()

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
