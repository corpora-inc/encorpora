import {
  Color3,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Vector3,
} from "@babylonjs/core"
import {
  OSCILLOSCOPE_AMPLITUDE,
  OSCILLOSCOPE_SEGMENTS,
  OSCILLOSCOPE_TRACE_WIDTH,
  OSCILLOSCOPE_WIDTH,
  OSCILLOSCOPE_Y,
} from "../core/constants"

export type Oscilloscope = {
  /** The ribbon mesh */
  mesh: Mesh
  update: (analyserData: Uint8Array, intensity: number) => void
  dispose: () => void
}

/** Number of Catmull-Rom subsegments between each raw sample */
const CR_SUBSEGMENTS = 4

/** Total smooth points: (SEGMENTS) * subsegments + 1 (final point) */
const SMOOTH_COUNT = OSCILLOSCOPE_SEGMENTS * CR_SUBSEGMENTS + 1

/**
 * Catmull-Rom spline interpolation — writes into pre-allocated destination array.
 */
function catmullRomInterpolate(raw: Vector3[], dest: Vector3[]): void {
  const n = raw.length
  let idx = 0

  for (let i = 0; i < n - 1; i++) {
    const p0 = raw[Math.max(i - 1, 0)]
    const p1 = raw[i]
    const p2 = raw[Math.min(i + 1, n - 1)]
    const p3 = raw[Math.min(i + 2, n - 1)]

    for (let s = 0; s < CR_SUBSEGMENTS; s++) {
      const t = s / CR_SUBSEGMENTS
      const t2 = t * t
      const t3 = t2 * t

      const x =
        0.5 *
        (2 * p1.x +
          (-p0.x + p2.x) * t +
          (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
          (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3)

      const y =
        0.5 *
        (2 * p1.y +
          (-p0.y + p2.y) * t +
          (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
          (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3)

      dest[idx++].set(x, y, 0)
    }
  }

  // Final point
  const last = raw[n - 1]
  dest[idx].set(last.x, last.y, 0)
}

/**
 * Pre-allocate an array of Vector3s.
 */
function allocVector3Array(count: number): Vector3[] {
  const arr: Vector3[] = new Array(count)
  for (let i = 0; i < count; i++) {
    arr[i] = new Vector3(0, 0, 0)
  }
  return arr
}

/**
 * Create the oscilloscope — a thin transparent ribbon that swings wildly
 * across the screen, smoothed with Catmull-Rom interpolation.
 *
 * Performance: all Vector3 arrays are pre-allocated once. Per-frame
 * updates use .set() to write new values, eliminating ~1500 allocations/frame.
 */
export function createOscilloscope(scene: Scene): Oscilloscope {
  const halfWidth = OSCILLOSCOPE_TRACE_WIDTH / 2
  const RAW_COUNT = OSCILLOSCOPE_SEGMENTS + 1

  // Pre-allocate all reusable Vector3 arrays
  const rawPoints = allocVector3Array(RAW_COUNT)
  const smoothPoints = allocVector3Array(SMOOTH_COUNT)
  const topPath = allocVector3Array(SMOOTH_COUNT)
  const bottomPath = allocVector3Array(SMOOTH_COUNT)

  // Build initial flat ribbon paths, then interpolate
  const rawTop: Vector3[] = []
  const rawBottom: Vector3[] = []
  for (let i = 0; i <= OSCILLOSCOPE_SEGMENTS; i++) {
    const x = (i / OSCILLOSCOPE_SEGMENTS - 0.5) * OSCILLOSCOPE_WIDTH
    rawTop.push(new Vector3(x, OSCILLOSCOPE_Y + halfWidth, 0))
    rawBottom.push(new Vector3(x, OSCILLOSCOPE_Y - halfWidth, 0))
  }

  const initSmoothTop = allocVector3Array(SMOOTH_COUNT)
  const initSmoothBottom = allocVector3Array(SMOOTH_COUNT)
  catmullRomInterpolate(rawTop, initSmoothTop)
  catmullRomInterpolate(rawBottom, initSmoothBottom)

  const ribbonMesh = MeshBuilder.CreateRibbon(
    "oscilloscope",
    {
      pathArray: [initSmoothTop, initSmoothBottom],
      updatable: true,
      sideOrientation: Mesh.DOUBLESIDE,
    },
    scene
  )

  const mat = new StandardMaterial("oscilloscopeMat", scene)
  mat.emissiveColor = new Color3(0.8, 1.0, 1.0)
  mat.disableLighting = true
  mat.backFaceCulling = false
  mat.alpha = 0.35
  ribbonMesh.material = mat
  ribbonMesh.isPickable = false
  ribbonMesh.renderingGroupId = 2

  return {
    mesh: ribbonMesh,

    update: (analyserData: Uint8Array, intensity: number) => {
      const len = analyserData.length

      // Write raw sample points from analyser data into pre-allocated array
      for (let i = 0; i < RAW_COUNT; i++) {
        const sampleIndex = Math.floor((i / OSCILLOSCOPE_SEGMENTS) * (len - 1))
        const normalized = (analyserData[sampleIndex] - 128) / 128
        const y = OSCILLOSCOPE_Y + normalized * OSCILLOSCOPE_AMPLITUDE * intensity
        const x = (i / OSCILLOSCOPE_SEGMENTS - 0.5) * OSCILLOSCOPE_WIDTH
        rawPoints[i].set(x, y, 0)
      }

      // Smooth with Catmull-Rom into pre-allocated array
      catmullRomInterpolate(rawPoints, smoothPoints)

      // Build top/bottom paths by offsetting — reuse pre-allocated arrays
      for (let i = 0; i < SMOOTH_COUNT; i++) {
        const pt = smoothPoints[i]
        topPath[i].set(pt.x, pt.y + halfWidth, 0)
        bottomPath[i].set(pt.x, pt.y - halfWidth, 0)
      }

      MeshBuilder.CreateRibbon(
        "oscilloscope",
        {
          pathArray: [topPath, bottomPath],
          instance: ribbonMesh,
        }
      )

      // Color pulse: cyan at rest, white-hot at peak
      const r = 0.5 + intensity * 0.4
      const g = 0.85 + intensity * 0.15
      const b = 1.0
      mat.emissiveColor.set(r, g, b)
    },

    dispose: () => {
      mat.dispose()
      ribbonMesh.dispose()
    },
  }
}
