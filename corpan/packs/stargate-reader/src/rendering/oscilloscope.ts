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
  OSCILLOSCOPE_WIDTH,
} from "../core/constants"

export type Oscilloscope = {
  mesh: Mesh
  update: (analyserData: Uint8Array, intensity: number) => void
  dispose: () => void
}

/**
 * Create the oscilloscope ribbon mesh at z=0 ("the now" plane).
 *
 * A ribbon spanning the screen width whose vertex y-positions are driven
 * by the AnalyserNode's time domain data (waveform). Styled with neon glow
 * and color pulsing with audio amplitude.
 */
export function createOscilloscope(scene: Scene): Oscilloscope {
  // Build initial ribbon paths (two paths for ribbon width)
  const pathTop: Vector3[] = []
  const pathBottom: Vector3[] = []

  for (let i = 0; i <= OSCILLOSCOPE_SEGMENTS; i++) {
    const x = (i / OSCILLOSCOPE_SEGMENTS - 0.5) * OSCILLOSCOPE_WIDTH
    pathTop.push(new Vector3(x, 0.15, 0))
    pathBottom.push(new Vector3(x, -0.15, 0))
  }

  const ribbon = MeshBuilder.CreateRibbon(
    "oscilloscope",
    {
      pathArray: [pathTop, pathBottom],
      updatable: true,
      sideOrientation: Mesh.DOUBLESIDE,
    },
    scene
  )

  const material = new StandardMaterial("oscilloscope-mat", scene)
  material.emissiveColor = new Color3(0.3, 0.8, 1.0)
  material.disableLighting = true
  material.alpha = 0.85
  material.backFaceCulling = false
  ribbon.material = material

  ribbon.isPickable = false

  // Store reference paths for updates
  const topPath = pathTop
  const bottomPath = pathBottom

  return {
    mesh: ribbon,

    update: (analyserData: Uint8Array, intensity: number) => {
      const len = analyserData.length

      for (let i = 0; i <= OSCILLOSCOPE_SEGMENTS; i++) {
        const sampleIndex = Math.floor((i / OSCILLOSCOPE_SEGMENTS) * (len - 1))
        // Convert byte (0-255) to normalized (-1 to 1)
        const normalized = (analyserData[sampleIndex] - 128) / 128
        const y = normalized * OSCILLOSCOPE_AMPLITUDE * intensity

        const x = (i / OSCILLOSCOPE_SEGMENTS - 0.5) * OSCILLOSCOPE_WIDTH
        topPath[i].x = x
        topPath[i].y = y + 0.1
        topPath[i].z = 0

        bottomPath[i].x = x
        bottomPath[i].y = y - 0.1
        bottomPath[i].z = 0
      }

      // Rebuild ribbon with updated paths
      MeshBuilder.CreateRibbon(
        "oscilloscope",
        {
          pathArray: [topPath, bottomPath],
          instance: ribbon,
        }
      )

      // Color pulse with intensity
      const r = 0.3 + intensity * 0.4
      const g = 0.7 + intensity * 0.3
      const b = 1.0
      material.emissiveColor.r = r
      material.emissiveColor.g = g
      material.emissiveColor.b = b
      material.alpha = 0.6 + intensity * 0.35
    },

    dispose: () => {
      material.dispose()
      ribbon.dispose()
    },
  }
}
