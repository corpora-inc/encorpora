import {
  Color3,
  DynamicTexture,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  TransformNode,
} from "@babylonjs/core"
import type { TimelineWord } from "../core/types"
import {
  CURRENT_WORD_SCALE,
  FADE_IN_Z,
  FADE_OUT_Z,
  LOOK_AHEAD_Z,
  LOOK_BEHIND_Z,
  MS_PER_Z_UNIT,
  WORD_FONT_SIZE,
  WORD_POOL_SIZE,
  WORD_SCALE,
  WORD_TEXTURE_SIZE,
} from "../core/constants"
import { crawlY, findVisibleRange, wordToZ } from "../core/timeline"

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
 * Create the word stream renderer.
 *
 * Uses a pool of billboard plane meshes with DynamicTextures. Words flow
 * single-file down the center of the screen (x=0), descending from top
 * to bottom via a waterslide power curve, positioned along the z-axis based
 * on precomputed timestamps.
 */
export function createWordStream(scene: Scene): WordStream {
  const root = new TransformNode("word-stream", scene)
  const pool: WordMesh[] = []

  // Color palette
  const normalColor = new Color3(0.85, 0.92, 1.0)
  const currentColor = new Color3(0.5, 0.85, 1.0)
  const dimColor = new Color3(0.4, 0.5, 0.65)

  // Create mesh pool — each mesh is a simple plane in the x-y plane
  for (let i = 0; i < WORD_POOL_SIZE; i++) {
    const texture = new DynamicTexture(
      `word-tex-${i}`,
      { width: WORD_TEXTURE_SIZE, height: 384 },
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
      { width: 1, height: 0.75, updatable: false },
      scene
    )
    plane.material = material
    plane.parent = root
    plane.isVisible = false
    plane.isPickable = false
    plane.renderingGroupId = 1

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
    const h = 384

    ctx.clearRect(0, 0, w, h)

    // Start at default font size, shrink if text overflows texture width
    let fontSize = WORD_FONT_SIZE
    const pad = w * 0.05
    ctx.font = `bold ${fontSize}px 'Trebuchet MS', 'Lucida Sans Unicode', sans-serif`
    let textWidth = ctx.measureText(text).width
    if (textWidth > w - pad) {
      fontSize = Math.floor(fontSize * (w - pad) / textWidth)
      ctx.font = `bold ${fontSize}px 'Trebuchet MS', 'Lucida Sans Unicode', sans-serif`
    }

    ctx.fillStyle = "#ffffff"
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText(text, w / 2, h / 2)
    mesh.texture.update()
  }

  let poolIndex = 0

  function acquireMesh(): WordMesh | null {
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

        // Render text (only on assignment change)
        renderWord(mesh, word.word)
        mesh.plane.isVisible = true

        // Single-file layout: centered on x, y rises with z so distant words
        // appear at top of screen and descend toward camera (like 3read)
        mesh.plane.position.x = 0
        mesh.plane.position.y = crawlY(z)
        mesh.plane.position.z = z

        // Scale: current word gets a boost
        const isCurrent = i === currentWordIndex
        const scale = isCurrent ? CURRENT_WORD_SCALE : WORD_SCALE
        mesh.plane.scaling.x = scale
        mesh.plane.scaling.y = scale

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
