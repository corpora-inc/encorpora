import {
  Color3,
  MeshBuilder,
  Scene,
  Vector3,
  type LinesMesh,
} from "@babylonjs/core"
import {
  CAMERA_Z,
  PULSE_RING_COLOR_B,
  PULSE_RING_COLOR_G,
  PULSE_RING_COLOR_R,
  PULSE_RING_FADE_MS,
  PULSE_RING_GHOST_COUNT,
  PULSE_RING_MAX_RADIUS,
  PULSE_RING_SEGMENTS,
} from "@shared/core"

export type PulseRing = {
  mesh: LinesMesh
  update: (intensity: number) => void
  configure: (config: { maxRadius?: number; fadeMs?: number }) => void
  setVisible: (visible: boolean) => void
  dispose: () => void
}

type Ghost = {
  mesh: LinesMesh
  points: Vector3[]
  birthTime: number
  active: boolean
}

/**
 * A thin electric circle at the NOW plane whose radius tracks
 * the current audio amplitude. Spawns ghost rings that hold
 * their radius and fade out, leaving a dancing trail.
 */
export function createPulseRing(scene: Scene): PulseRing {
  const nowZ = CAMERA_Z + 1
  const SEGMENTS = PULSE_RING_SEGMENTS
  let maxRadius = PULSE_RING_MAX_RADIUS
  let fadeMs = PULSE_RING_FADE_MS
  const color = new Color3(
    PULSE_RING_COLOR_R,
    PULSE_RING_COLOR_G,
    PULSE_RING_COLOR_B,
  )

  // Pre-compute unit circle
  const cosTable = new Float32Array(SEGMENTS + 1)
  const sinTable = new Float32Array(SEGMENTS + 1)
  for (let i = 0; i <= SEGMENTS; i++) {
    const angle = (i / SEGMENTS) * Math.PI * 2
    cosTable[i] = Math.cos(angle)
    sinTable[i] = Math.sin(angle)
  }

  /** Build a set of points for a circle at the given radius */
  function makePoints(r: number): Vector3[] {
    const pts: Vector3[] = []
    for (let i = 0; i <= SEGMENTS; i++) {
      pts.push(new Vector3(r * cosTable[i], r * sinTable[i], nowZ))
    }
    return pts
  }

  // Live ring — tracks amplitude directly.
  // `useVertexAlpha` is required for `mesh.alpha` to blend: Babylon's LinesMesh
  // bakes alpha blending into its shader material at creation time, and only
  // enables it when this flag is set. Without it `mesh.alpha` is ignored at the
  // blend stage, so rings render fully opaque and never visibly fade.
  const livePoints = makePoints(0)
  const liveMesh = MeshBuilder.CreateLines(
    "pulseRing",
    { points: livePoints, updatable: true, useVertexAlpha: true },
    scene
  )
  liveMesh.color = color
  liveMesh.isPickable = false
  liveMesh.renderingGroupId = 2

  // Ghost pool — pre-allocated rings that fade out
  const ghosts: Ghost[] = []
  for (let g = 0; g < PULSE_RING_GHOST_COUNT; g++) {
    const pts = makePoints(0)
    const mesh = MeshBuilder.CreateLines(
      `pulseGhost${g}`,
      { points: pts, updatable: true, useVertexAlpha: true },
      scene
    )
    mesh.color = color
    mesh.isPickable = false
    mesh.renderingGroupId = 2
    mesh.alpha = 0
    ghosts.push({ mesh, points: pts, birthTime: 0, active: false })
  }
  let ghostIndex = 0
  let lastRadius = 0

  return {
    mesh: liveMesh,

    update(intensity: number) {
      const now = performance.now()
      const r = intensity * maxRadius

      // Update live ring
      for (let i = 0; i <= SEGMENTS; i++) {
        livePoints[i].x = r * cosTable[i]
        livePoints[i].y = r * sinTable[i]
      }
      MeshBuilder.CreateLines("pulseRing", { points: livePoints, instance: liveMesh })
      liveMesh.alpha = intensity

      // Spawn a ghost at the previous radius when the live ring moves
      if (lastRadius > 0.001) {
        const ghost = ghosts[ghostIndex]
        ghostIndex = (ghostIndex + 1) % PULSE_RING_GHOST_COUNT
        for (let i = 0; i <= SEGMENTS; i++) {
          ghost.points[i].x = lastRadius * cosTable[i]
          ghost.points[i].y = lastRadius * sinTable[i]
        }
        MeshBuilder.CreateLines(`pulseGhost${ghostIndex}`, {
          points: ghost.points,
          instance: ghost.mesh,
        })
        ghost.birthTime = now
        ghost.active = true
        ghost.mesh.alpha = 1
      }
      lastRadius = r

      // Fade ghosts
      for (const ghost of ghosts) {
        if (!ghost.active) continue
        const age = now - ghost.birthTime
        if (age >= fadeMs) {
          ghost.active = false
          ghost.mesh.alpha = 0
        } else {
          ghost.mesh.alpha = 1 - age / fadeMs
        }
      }
    },

    configure(config: { maxRadius?: number; fadeMs?: number }) {
      if (config.maxRadius !== undefined) maxRadius = config.maxRadius
      if (config.fadeMs !== undefined) fadeMs = config.fadeMs
    },

    setVisible(visible: boolean) {
      liveMesh.setEnabled(visible)
      for (const ghost of ghosts) ghost.mesh.setEnabled(visible)
    },

    dispose() {
      liveMesh.dispose()
      for (const ghost of ghosts) {
        ghost.mesh.dispose()
      }
    },
  }
}
