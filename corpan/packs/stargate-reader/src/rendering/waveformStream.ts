import {
  Color3,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Vector3,
  VertexBuffer,
} from "@babylonjs/core"
import type { TimelineWord } from "@shared/core"
import type { WaveformCache } from "@shared/audio"
import {
  ENVELOPE_BINS,
  FADE_IN_Z,
  FADE_OUT_Z,
  CAMERA_Z,
  LOOK_AHEAD_Z,
  LOOK_BEHIND_Z,
  MS_PER_Z_UNIT,
  WAVEFORM_STREAM_ALPHA,
  WAVEFORM_STREAM_FALLBACK_AMP,
  WAVEFORM_STREAM_MAX_RADIUS,
  WAVEFORM_STREAM_MIN_RADIUS,
  WAVEFORM_STREAM_SAMPLES,
  WAVEFORM_STREAM_SMOOTH_PASSES,
  WAVEFORM_STREAM_SMOOTH_RADIUS,
  WAVEFORM_STREAM_TESSELLATION,
} from "@shared/core"

export type WaveformStream = {
  mesh: Mesh
  update: (
    currentMs: number,
    words: TimelineWord[],
    waveformCache: WaveformCache,
    currentWordHint: number
  ) => void
  configure: (config: { maxRadius?: number; alpha?: number; minRadius?: number }) => void
  dispose: () => void
}

/**
 * Compute fade alpha based on z-position (same logic as wordStream).
 */
function computeFade(z: number): number {
  if (z > FADE_IN_Z) return 0
  if (z > FADE_IN_Z - 10) return 1 - (z - (FADE_IN_Z - 10)) / 10
  if (z < FADE_OUT_Z) return 0
  if (z < FADE_OUT_Z + 3) return (z - FADE_OUT_Z) / 3
  return 1
}

/**
 * Create the waveform stream — a tube mesh flowing along Z whose
 * radius swells with the audio waveform envelope.
 *
 * Silence = thin wire following the word crawl curve.
 * Speech = tube swells smoothly with amplitude.
 *
 * Performance: instead of rebuilding the tube mesh every frame via
 * CreateTube, we pre-compute a sin/cos table for the circular
 * cross-section and write vertex positions directly into a
 * Float32Array. One call to updateVerticesData() pushes to the GPU.
 */
export function createWaveformStream(scene: Scene): WaveformStream {
  const SAMPLES = WAVEFORM_STREAM_SAMPLES
  let minRadius = WAVEFORM_STREAM_MIN_RADIUS
  let maxRadius = WAVEFORM_STREAM_MAX_RADIUS
  const TESSELLATION = WAVEFORM_STREAM_TESSELLATION
  const zStep = (LOOK_AHEAD_Z + LOOK_BEHIND_Z) / (SAMPLES - 1)
  // "Now" plane sits just in front of the camera — peak hits right before the screen
  const NOW_Z = CAMERA_Z + 1

  // Pre-allocate reusable arrays — two buffers for ping-pong smoothing
  const rawAmplitudes = new Float32Array(SAMPLES)
  const smoothA = new Float32Array(SAMPLES)
  const smoothB = new Float32Array(SAMPLES)

  // Radii array — updated each frame
  const radii = new Float32Array(SAMPLES)
  radii.fill(minRadius)

  // Pre-compute Z positions (constant — never changes)
  const zPositions = new Float32Array(SAMPLES)
  for (let i = 0; i < SAMPLES; i++) {
    zPositions[i] = -LOOK_BEHIND_Z + i * zStep
  }

  // Pre-compute sin/cos table for cross-section vertices
  const cosTable = new Float32Array(TESSELLATION)
  const sinTable = new Float32Array(TESSELLATION)
  for (let j = 0; j < TESSELLATION; j++) {
    const angle = (j / TESSELLATION) * Math.PI * 2
    cosTable[j] = Math.cos(angle)
    sinTable[j] = Math.sin(angle)
  }

  // Straight path down the center — tube comes at viewer like a tunnel
  const tubePath: Vector3[] = []
  for (let i = 0; i < SAMPLES; i++) {
    tubePath.push(new Vector3(0, 0, zPositions[i]))
  }

  // Create initial tube mesh (once — used for geometry topology + material)
  const tubeMesh = MeshBuilder.CreateTube(
    "waveformStream",
    {
      path: tubePath,
      radiusFunction: (i) => radii[Math.min(i, SAMPLES - 1)],
      tessellation: TESSELLATION,
      updatable: true,
      sideOrientation: Mesh.DOUBLESIDE,
    },
    scene
  )

  const mat = new StandardMaterial("waveformStreamMat", scene)
  mat.emissiveColor = new Color3(0.3, 0.7, 0.85)
  mat.disableLighting = true
  mat.backFaceCulling = false
  mat.alpha = WAVEFORM_STREAM_ALPHA

  tubeMesh.material = mat
  tubeMesh.renderingGroupId = 0
  tubeMesh.isPickable = false

  // Grab the initial positions buffer to determine vertex layout
  const initialPositions = tubeMesh.getVerticesData(VertexBuffer.PositionKind)
  if (!initialPositions) {
    throw new Error("waveformStream: could not read initial vertex positions")
  }
  const positions = new Float32Array(initialPositions.length)

  /**
   * Multi-pass box-filter smooth (3 passes ≈ Gaussian).
   * Ping-pongs between two buffers to avoid allocation.
   */
  function multiPassSmooth(src: Float32Array, out: Float32Array): void {
    const R = WAVEFORM_STREAM_SMOOTH_RADIUS
    const passes = WAVEFORM_STREAM_SMOOTH_PASSES

    // Copy source into smoothA for first pass input
    smoothA.set(src)

    let input = smoothA
    let output = smoothB

    for (let pass = 0; pass < passes; pass++) {
      // Running sum for O(n) box filter
      let windowSum = 0
      // Seed: sum the first R+1 elements (right half of first window)
      for (let j = 0; j <= R && j < SAMPLES; j++) {
        windowSum += input[j]
      }

      for (let i = 0; i < SAMPLES; i++) {
        // Add the element entering the right edge
        const addIdx = i + R
        if (addIdx > R && addIdx < SAMPLES) {
          windowSum += input[addIdx]
        }
        // Remove the element leaving the left edge
        const removeIdx = i - R - 1
        if (removeIdx >= 0) {
          windowSum -= input[removeIdx]
        }

        const lo = Math.max(0, i - R)
        const hi = Math.min(SAMPLES - 1, i + R)
        output[i] = windowSum / (hi - lo + 1)
      }

      // Swap buffers for next pass
      const tmp = input
      input = output
      output = tmp
    }

    // After all passes, `input` holds the final result
    if (input !== out) {
      out.set(input)
    }
  }

  return {
    mesh: tubeMesh,

    update(
      currentMs: number,
      words: TimelineWord[],
      waveformCache: WaveformCache,
      currentWordHint: number
    ) {
      // --- Sample raw amplitudes along Z ---
      let wordCursor = Math.max(0, currentWordHint - 30)

      // Walk back to cover the full look-behind range (shifted by CAMERA_Z)
      const lookBehindMs = (LOOK_BEHIND_Z + NOW_Z) * MS_PER_Z_UNIT
      while (
        wordCursor > 0 &&
        words[wordCursor].absoluteEndMs > currentMs - lookBehindMs
      ) {
        wordCursor--
      }

      for (let i = 0; i < SAMPLES; i++) {
        const z = zPositions[i]
        const timeMs = currentMs + (z - NOW_Z) * MS_PER_Z_UNIT

        // Advance cursor to find word at this time
        while (
          wordCursor < words.length - 1 &&
          words[wordCursor].absoluteEndMs < timeMs
        ) {
          wordCursor++
        }

        const w = words[wordCursor]
        if (w && timeMs >= w.absoluteStartMs && timeMs <= w.absoluteEndMs) {
          // Inside a word — sample its envelope
          const envelope = waveformCache.getEnvelope(w.segmentId, w.wordIndex)
          if (envelope) {
            const t = Math.max(0, Math.min(1, (timeMs - w.absoluteStartMs) / w.durationMs))
            const binF = t * (ENVELOPE_BINS - 1)
            const binLo = Math.floor(binF)
            const binHi = Math.min(binLo + 1, ENVELOPE_BINS - 1)
            const frac = binF - binLo
            rawAmplitudes[i] = envelope[binLo] * (1 - frac) + envelope[binHi] * frac
          } else {
            rawAmplitudes[i] = WAVEFORM_STREAM_FALLBACK_AMP
          }
        } else {
          // In a gap — set to 0, smoothing will blend from neighbors
          rawAmplitudes[i] = 0
        }
      }

      // --- Multi-pass smoothing (box filter × passes ≈ Gaussian) ---
      multiPassSmooth(rawAmplitudes, smoothA)

      // --- Compute radii ---
      for (let i = 0; i < SAMPLES; i++) {
        const z = zPositions[i]
        const swell = smoothA[i] * maxRadius
        const distFade = computeFade(z)
        radii[i] = minRadius + swell * distFade
      }

      // --- Direct vertex buffer write ---
      // For a straight tube along Z, each vertex is simply:
      //   x = radius * cos(angle), y = radius * sin(angle), z = zPosition
      // CreateTube lays out vertices as: for each path point i, TESSELLATION
      // vertices around the cross-section, plus a closing duplicate vertex.
      const vertsPerRing = TESSELLATION + 1
      for (let i = 0; i < SAMPLES; i++) {
        const r = radii[i]
        const z = zPositions[i]
        const base = i * vertsPerRing * 3
        for (let j = 0; j < TESSELLATION; j++) {
          const idx = base + j * 3
          positions[idx] = r * cosTable[j]
          positions[idx + 1] = r * sinTable[j]
          positions[idx + 2] = z
        }
        // Closing vertex duplicates vertex 0 to seal the ring
        const closeIdx = base + TESSELLATION * 3
        positions[closeIdx] = r * cosTable[0]
        positions[closeIdx + 1] = r * sinTable[0]
        positions[closeIdx + 2] = z
      }

      tubeMesh.updateVerticesData(VertexBuffer.PositionKind, positions)
    },

    configure(config: { maxRadius?: number; alpha?: number; minRadius?: number }) {
      if (config.maxRadius !== undefined) maxRadius = config.maxRadius
      if (config.alpha !== undefined) mat.alpha = config.alpha
      if (config.minRadius !== undefined) minRadius = config.minRadius
    },

    dispose() {
      mat.dispose()
      tubeMesh.dispose()
    },
  }
}
