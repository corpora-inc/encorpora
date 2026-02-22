import {
  Color3,
  DynamicTexture,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  TransformNode,
  Vector3,
} from "@babylonjs/core"
import type { TimelineWord } from "../core/types"
import {
  CRAWL_CURVE_STRENGTH,
  CURRENT_WORD_SCALE,
  FADE_IN_Z,
  FADE_OUT_Z,
  LINE_SPACING_Y,
  LOOK_AHEAD_Z,
  LOOK_BEHIND_Z,
  MS_PER_Z_UNIT,
  WORD_BASE_Y,
  WORD_FONT,
  WORD_FONT_SIZE,
  WORD_POOL_SIZE,
  WORD_SCALE,
  WORD_SPACING_X,
  WORD_TEXTURE_SIZE,
  WORDS_PER_LINE,
} from "../core/constants"
import { findVisibleRange, wordToZ } from "../core/timeline"

type WordMesh = {
  plane: Mesh
  texture: DynamicTexture
  material: StandardMaterial
  active: boolean
  assignedWord: string
}

export type WordStream = {
  root: TransformNode
  update: (currentMs: number, words: TimelineWord[], currentWordIndex: number) => void
  dispose: () => void
}

/**
 * Measure text width using a shared canvas context for layout calculations.
 */
function measureTextWidth(text: string, ctx: CanvasRenderingContext2D): number {
  ctx.font = WORD_FONT
  return ctx.measureText(text).width
}

/**
 * Create the word stream renderer.
 *
 * Uses a pool of plane meshes with DynamicTextures. Words are assigned to meshes
 * from the pool and positioned along the z-axis based on their precomputed timestamps.
 * Includes Star Wars crawl curve and fade zones.
 */
export function createWordStream(scene: Scene): WordStream {
  const root = new TransformNode("word-stream", scene)
  const pool: WordMesh[] = []

  // Shared measurement canvas
  const measureCanvas = document.createElement("canvas")
  const measureCtx = measureCanvas.getContext("2d")!

  // Color palette
  const normalColor = new Color3(0.85, 0.92, 1.0)
  const currentColor = new Color3(0.5, 0.85, 1.0)
  const dimColor = new Color3(0.4, 0.5, 0.65)

  // Create mesh pool
  for (let i = 0; i < WORD_POOL_SIZE; i++) {
    const texture = new DynamicTexture(
      `word-tex-${i}`,
      { width: WORD_TEXTURE_SIZE, height: WORD_TEXTURE_SIZE / 2 },
      scene,
      false
    )
    texture.hasAlpha = true

    const material = new StandardMaterial(`word-mat-${i}`, scene)
    material.emissiveColor = normalColor.clone()
    material.diffuseTexture = texture
    material.opacityTexture = texture
    material.disableLighting = true
    material.backFaceCulling = false

    const plane = MeshBuilder.CreatePlane(
      `word-plane-${i}`,
      { width: 2, height: 1 },
      scene
    )
    plane.material = material
    plane.parent = root
    plane.isVisible = false
    plane.isPickable = false

    pool.push({
      plane,
      texture,
      material,
      active: false,
      assignedWord: "",
    })
  }

  /**
   * Render text onto a word mesh's DynamicTexture.
   */
  function renderWord(mesh: WordMesh, text: string) {
    if (mesh.assignedWord === text) return
    mesh.assignedWord = text

    const ctx = mesh.texture.getContext() as unknown as CanvasRenderingContext2D
    const w = WORD_TEXTURE_SIZE
    const h = WORD_TEXTURE_SIZE / 2

    ctx.clearRect(0, 0, w, h)
    ctx.font = WORD_FONT
    ctx.fillStyle = "#ffffff"
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText(text, w / 2, h / 2)
    mesh.texture.update()

    // Scale plane width to match text proportions
    const textWidth = measureTextWidth(text, measureCtx)
    const aspect = textWidth / WORD_FONT_SIZE
    const planeHeight = 1.0
    const planeWidth = Math.max(0.5, planeHeight * aspect * 1.1)
    mesh.plane.scaling.x = planeWidth
  }

  /**
   * Compute x,y layout position for a word based on its index within the visible window.
   * Words flow left-to-right, wrapping to new lines.
   */
  function layoutPosition(
    _wordIndex: number,
    lineWordIndex: number,
    lineIndex: number,
    _totalInLine: number
  ): { x: number; y: number } {
    // Center each line horizontally
    const x = (lineWordIndex - (WORDS_PER_LINE - 1) / 2) * WORD_SPACING_X
    const y = WORD_BASE_Y - lineIndex * LINE_SPACING_Y
    return { x, y }
  }

  let poolIndex = 0

  function acquireMesh(): WordMesh | null {
    // Find an inactive mesh in the pool
    for (let i = 0; i < WORD_POOL_SIZE; i++) {
      const idx = (poolIndex + i) % WORD_POOL_SIZE
      if (!pool[idx].active) {
        poolIndex = (idx + 1) % WORD_POOL_SIZE
        pool[idx].active = true
        return pool[idx]
      }
    }
    return null
  }

  // Track which word indices are currently assigned to which pool meshes
  const assignedMeshes = new Map<number, WordMesh>()

  return {
    root,

    update: (currentMs: number, words: TimelineWord[], currentWordIndex: number) => {
      const lookAheadMs = LOOK_AHEAD_Z * MS_PER_Z_UNIT
      const lookBehindMs = LOOK_BEHIND_Z * MS_PER_Z_UNIT

      const [visStart, visEnd] = findVisibleRange(
        words,
        currentMs,
        lookAheadMs,
        lookBehindMs
      )

      // Release meshes for words no longer visible
      for (const [wordIdx, mesh] of assignedMeshes) {
        if (wordIdx < visStart || wordIdx >= visEnd) {
          mesh.active = false
          mesh.plane.isVisible = false
          assignedMeshes.delete(wordIdx)
        }
      }

      // Assign/update meshes for visible words
      let lineIndex = 0
      let lineWordCount = 0

      for (let i = visStart; i < visEnd; i++) {
        const word = words[i]
        const midpointMs = (word.absoluteStartMs + word.absoluteEndMs) / 2
        const z = wordToZ(midpointMs, currentMs)

        // Skip words too far away
        if (z > LOOK_AHEAD_Z || z < -LOOK_BEHIND_Z) continue

        // Get or acquire mesh
        let mesh = assignedMeshes.get(i)
        if (!mesh) {
          const acquired = acquireMesh()
          if (!acquired) break // pool exhausted
          mesh = acquired
          assignedMeshes.set(i, mesh)
        }

        // Render text
        renderWord(mesh, word.word)
        mesh.plane.isVisible = true

        // Layout: group words into lines
        const posInStream = i - visStart
        lineIndex = Math.floor(posInStream / WORDS_PER_LINE)
        lineWordCount = posInStream % WORDS_PER_LINE

        const { x, y } = layoutPosition(
          posInStream,
          lineWordCount,
          lineIndex,
          WORDS_PER_LINE
        )

        // Star Wars crawl curve: y drops as z increases
        const curvedY = y - CRAWL_CURVE_STRENGTH * z * z

        mesh.plane.position = new Vector3(x, curvedY, z)

        // Scale: current word gets a boost
        const isCurrent = i === currentWordIndex
        const scale = isCurrent ? CURRENT_WORD_SCALE : WORD_SCALE
        mesh.plane.scaling.y = scale
        // x scaling is set by renderWord based on text width

        // Color & opacity
        const alpha = computeFade(z)
        mesh.material.alpha = alpha

        if (isCurrent) {
          mesh.material.emissiveColor = currentColor
        } else if (z < 0) {
          mesh.material.emissiveColor = dimColor
        } else {
          mesh.material.emissiveColor = normalColor
        }
      }
    },

    dispose: () => {
      for (const mesh of pool) {
        mesh.texture.dispose()
        mesh.material.dispose()
        mesh.plane.dispose()
      }
      assignedMeshes.clear()
      root.dispose()
    },
  }
}

/**
 * Compute fade alpha based on z-position.
 * Fade in from far to FADE_IN_Z, fully visible in the middle, fade out behind FADE_OUT_Z.
 */
function computeFade(z: number): number {
  if (z > FADE_IN_Z) {
    return 0
  }
  if (z > FADE_IN_Z - 10) {
    return 1 - (z - (FADE_IN_Z - 10)) / 10
  }
  if (z < FADE_OUT_Z) {
    return 0
  }
  if (z < FADE_OUT_Z + 3) {
    return (z - FADE_OUT_Z) / 3
  }
  return 1
}
