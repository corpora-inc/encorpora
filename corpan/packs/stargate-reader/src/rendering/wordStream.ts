import {
  Color3,
  DynamicTexture,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  TransformNode,
} from "@babylonjs/core"
import type { TimelineWord } from "@shared/core"
import {
  CURRENT_WORD_SCALE,
  FADE_IN_Z,
  FADE_OUT_Z,
  HOLD_ATTACK,
  HOLD_RELEASE,
  HOLD_Y,
  HOLD_Z_PULL,
  LOOK_AHEAD_Z,
  LOOK_BEHIND_Z,
  MS_PER_Z_UNIT,
  WORD_FONT_SIZE,
  WORD_POOL_SIZE,
  WORD_SCALE,
  WORD_TEXTURE_SIZE,
} from "@shared/core"
import { crawlY, findVisibleRange, wordToZ } from "@shared/core"

type WordMesh = {
  plane: Mesh
  texture: DynamicTexture
  material: StandardMaterial
  active: boolean
  assignedWord: string
}

export type WordHoldConfig = { holdY?: number; zPull?: number }

/**
 * Per-frame rasterization stats, surfaced for the perf diagnostic overlay.
 *
 * - `rasterized`: glyphs drawn to a DynamicTexture this frame (budgeted pre-warm
 *   + any forced must-be-legible draws).
 * - `forced`: glyphs that had to be drawn this frame because the word was already
 *   at/inside the fade-in zone with no pre-warmed texture ready. This is the
 *   metric that spikes on an unmitigated segment boundary; the pre-warm pass
 *   aims to keep it at 0.
 */
export type WordStreamStats = {
  rasterized: number
  forced: number
}

export type WordStream = {
  root: TransformNode
  update: (currentMs: number, words: TimelineWord[], currentWordIndex: number, wordHold?: boolean) => void
  configure: (config: WordHoldConfig) => void
  /** Stats from the most recent update() call (for the perf diagnostic). */
  getLastFrameStats: () => WordStreamStats
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

  // Mutable hold config (overridden via configure())
  let holdY = HOLD_Y
  let holdZPull = Math.abs(HOLD_Z_PULL)

  // Color palette
  const approachColor = new Color3(0.5, 0.85, 1.0)   // cyan while traveling down
  const currentColor = new Color3(1.0, 1.0, 1.0)      // white when spoken
  const dimColor = new Color3(0.4, 0.3, 0.55)         // purple fade after passing

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
    material.emissiveColor = approachColor.clone()
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

  // Per-frame rasterization budget. Drawing a glyph onto a DynamicTexture
  // (measureText + fillText + a 512x384 GPU upload) is the most expensive
  // synchronous step in this renderer. When several words cross into the
  // legible zone in the same frame (dense phrase, post-seek, post-swipe, and —
  // the case #455 targets — the first words of a new segment arriving as a
  // cluster after the inter-segment pause), doing all of them at once is a
  // one-frame hitch: the inter-segment jerk.
  //
  // Words are fully transparent (computeFade === 0) while z > FADE_IN_Z, and the
  // look-ahead range extends to LOOK_AHEAD_Z (well beyond FADE_IN_Z), so a word
  // has a long runway of invisible frames before it must be legible. We use that
  // runway to PRE-WARM textures: each frame we rasterize up to this many words,
  // chosen NEAREST-to-fade-in first, so by the time any word crosses FADE_IN_Z
  // its glyph is already drawn (renderWord() early-returns) and nothing has to be
  // drawn at the boundary. The must-be-legible fallback below stays as a
  // correctness backstop, but in normal playback it should fire ~0 times.
  //
  // Deferred far words stay invisible (alpha 0) regardless, so output is identical.
  const MAX_RASTERIZE_PER_FRAME = 2

  // Reused scratch buffer for the pre-warm priority pass (avoid per-frame alloc).
  const prewarmCandidates: { idx: number; margin: number }[] = []

  const lastFrameStats: WordStreamStats = { rasterized: 0, forced: 0 }

  return {
    root,

    update: (currentMs: number, words: TimelineWord[], currentWordIndex: number, wordHold = true) => {
      let rasterizeBudget = MAX_RASTERIZE_PER_FRAME
      let rasterizedThisFrame = 0
      let forcedThisFrame = 0
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

      // ── Pre-warm pass ──────────────────────────────────────────────────
      // Before assigning/positioning, decide which still-invisible far words to
      // rasterize this frame. We prioritise by how close each word is to crossing
      // FADE_IN_Z (smallest positive margin first) so the budget is always spent
      // on the words that will need to be legible soonest — never starved by
      // words that are still far up the runway. This is what eliminates the
      // boundary burst: the first words of the next segment get warmed during the
      // current segment's invisible runway, frame by frame, ahead of the boundary.
      prewarmCandidates.length = 0
      for (let i = visStart; i < visEnd; i++) {
        const word = words[i]
        const midpointMs = (word.absoluteStartMs + word.absoluteEndMs) / 2
        const z = wordToZ(midpointMs, currentMs)
        // Only far (still-transparent) words that don't yet have their glyph.
        if (z <= FADE_IN_Z || z > LOOK_AHEAD_Z) continue
        const existing = assignedMeshes.get(i)
        if (existing && existing.assignedWord === word.word) continue
        prewarmCandidates.push({ idx: i, margin: z - FADE_IN_Z })
      }
      if (prewarmCandidates.length > 1) {
        prewarmCandidates.sort((a, b) => a.margin - b.margin)
      }
      for (let k = 0; k < prewarmCandidates.length && rasterizeBudget > 0; k++) {
        const i = prewarmCandidates[k].idx
        let mesh = assignedMeshes.get(i)
        if (!mesh) {
          const acquired = acquireMesh()
          if (!acquired) break // pool exhausted
          mesh = acquired
          assignedMeshes.set(i, mesh)
          mesh.plane.isVisible = false // stays hidden (alpha 0) until it crosses FADE_IN_Z
        }
        renderWord(mesh, words[i].word)
        rasterizeBudget--
        rasterizedThisFrame++
      }

      // ── Assign/update/position visible words ───────────────────────────
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

        // Render text (only on assignment change). The pre-warm pass above has
        // already drawn most upcoming glyphs while they were still invisible.
        const needsRender = mesh.assignedWord !== word.word
        if (needsRender) {
          if (z <= FADE_IN_Z) {
            // Must be legible this frame and the pre-warm didn't reach it — draw
            // now (correctness backstop). Each occurrence is a potential boundary
            // hitch; the diagnostic counts these so smoothness is measurable.
            renderWord(mesh, word.word)
            rasterizedThisFrame++
            forcedThisFrame++
          } else if (rasterizeBudget > 0) {
            // Far word the priority pass had budget left for.
            renderWord(mesh, word.word)
            rasterizeBudget--
            rasterizedThisFrame++
          } else {
            // Defer: word is fully transparent at this z, so leaving the stale
            // texture for a frame is visually identical. Keep it hidden until
            // its glyph is ready to avoid flashing a previous word's texture.
            mesh.plane.isVisible = false
            continue
          }
        }
        mesh.plane.isVisible = true

        mesh.plane.position.x = 0
        const isCurrent = i === currentWordIndex

        // Soft z-cap: past words asymptotically approach z=-3 instead of racing to near-clip
        const posZ = z < 0 ? -3 * (1 - Math.exp(z / 8)) : z

        if (isCurrent && wordHold && word.durationMs > 0) {
          const t = (currentMs - word.absoluteStartMs) / word.durationMs
          const env = holdEnvelope(t, HOLD_ATTACK, HOLD_RELEASE)
          const naturalY = crawlY(z)
          mesh.plane.position.y = naturalY + env * (holdY - naturalY)
          mesh.plane.position.z = posZ + env * -holdZPull
        } else {
          mesh.plane.position.y = crawlY(z)
          mesh.plane.position.z = posZ
        }

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
          mesh.material.emissiveColor = approachColor
        }
      }

      lastFrameStats.rasterized = rasterizedThisFrame
      lastFrameStats.forced = forcedThisFrame
    },

    configure: (config: WordHoldConfig) => {
      if (config.holdY !== undefined) holdY = config.holdY
      if (config.zPull !== undefined) holdZPull = config.zPull
    },

    getLastFrameStats: () => lastFrameStats,

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
function holdEnvelope(t: number, attack: number, release: number): number {
  if (t <= 0 || t >= 1) return 0
  const totalRamp = attack + release
  const s = totalRamp > 1 ? 1 / totalRamp : 1
  const a = attack * s
  const r = release * s
  if (t < a) { const u = t / a; return u * u * (3 - 2 * u) }
  if (t > 1 - r) { const u = (1 - t) / r; return u * u * (3 - 2 * u) }
  return 1
}

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
  if (z < FADE_OUT_Z + 10) {
    return (z - FADE_OUT_Z) / 10
  }
  return 1
}
