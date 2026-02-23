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

/**
 * Catmull-Rom spline interpolation.
 * Takes raw sample points and produces 4x as many smooth points.
 */
function catmullRomInterpolate(raw: Vector3[]): Vector3[] {
  const result: Vector3[] = []
  const n = raw.length
  const subsegments = 4

  for (let i = 0; i < n - 1; i++) {
    const p0 = raw[Math.max(i - 1, 0)]
    const p1 = raw[i]
    const p2 = raw[Math.min(i + 1, n - 1)]
    const p3 = raw[Math.min(i + 2, n - 1)]

    for (let s = 0; s < subsegments; s++) {
      const t = s / subsegments
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

      result.push(new Vector3(x, y, 0))
    }
  }

  // Add the final point
  result.push(raw[n - 1].clone())
  return result
}

/**
 * Create the oscilloscope — a thin transparent ribbon that swings wildly
 * across the screen, smoothed with Catmull-Rom interpolation.
 */
export function createOscilloscope(scene: Scene): Oscilloscope {
  const halfWidth = OSCILLOSCOPE_TRACE_WIDTH / 2

  // Build initial flat ribbon paths, then interpolate
  const rawTop: Vector3[] = []
  const rawBottom: Vector3[] = []
  for (let i = 0; i <= OSCILLOSCOPE_SEGMENTS; i++) {
    const x = (i / OSCILLOSCOPE_SEGMENTS - 0.5) * OSCILLOSCOPE_WIDTH
    rawTop.push(new Vector3(x, OSCILLOSCOPE_Y + halfWidth, 0))
    rawBottom.push(new Vector3(x, OSCILLOSCOPE_Y - halfWidth, 0))
  }

  const smoothTop = catmullRomInterpolate(rawTop)
  const smoothBottom = catmullRomInterpolate(rawBottom)

  const ribbonMesh = MeshBuilder.CreateRibbon(
    "oscilloscope",
    {
      pathArray: [smoothTop, smoothBottom],
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

  return {
    mesh: ribbonMesh,

    update: (analyserData: Uint8Array, intensity: number) => {
      const len = analyserData.length

      // Build raw sample points from analyser data
      const rawPoints: Vector3[] = []
      for (let i = 0; i <= OSCILLOSCOPE_SEGMENTS; i++) {
        const sampleIndex = Math.floor((i / OSCILLOSCOPE_SEGMENTS) * (len - 1))
        const normalized = (analyserData[sampleIndex] - 128) / 128
        const y = OSCILLOSCOPE_Y + normalized * OSCILLOSCOPE_AMPLITUDE * intensity
        const x = (i / OSCILLOSCOPE_SEGMENTS - 0.5) * OSCILLOSCOPE_WIDTH
        rawPoints.push(new Vector3(x, y, 0))
      }

      // Smooth with Catmull-Rom
      const smooth = catmullRomInterpolate(rawPoints)

      const topPath: Vector3[] = []
      const bottomPath: Vector3[] = []
      for (const pt of smooth) {
        topPath.push(new Vector3(pt.x, pt.y + halfWidth, 0))
        bottomPath.push(new Vector3(pt.x, pt.y - halfWidth, 0))
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
      mat.emissiveColor = new Color3(r, g, b)
    },

    dispose: () => {
      mat.dispose()
      ribbonMesh.dispose()
    },
  }
}
